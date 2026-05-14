import json
import logging
import os
import re
import time
import datetime
from typing import Dict, List, Any, Optional
import redis

from .concept_planner import create_summary_plan, SummaryPlan, _clean_term_name

logger = logging.getLogger("engine-knowledge-graph")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
KNOWLEDGE_GRAPH_TTL_SECONDS = int(os.getenv("KNOWLEDGE_GRAPH_TTL_SECONDS", "604800"))  # Default 7 days

_client: Optional[redis.Redis] = None


def _get_redis() -> redis.Redis:
    global _client
    if _client is None:
        _client = redis.from_url(REDIS_URL, decode_responses=True)
        logger.info("[REDIS_INIT] knowledge_graph_service connected via %s", REDIS_URL)
    return _client


def _graph_key(subject_id: str) -> str:
    return f"knowledge_graph:{subject_id}"


def _sanitize_concept_list(concepts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Validate and normalize concept names in a serialized concept list before
    writing to Redis.  Entries with missing or invalid names are dropped and
    logged.  The 'related' list inside each entry is also stripped.
    """
    result: List[Dict[str, Any]] = []
    for c in concepts:
        if not isinstance(c, dict):
            continue
        raw_name = c.get("name", "")
        cleaned = _clean_term_name(str(raw_name)) if raw_name else None
        if cleaned is None:
            logger.warning("[KG] dropping concept with invalid name raw=%r", raw_name)
            continue
        if cleaned != raw_name:
            logger.warning("[KG] concept name sanitized %r → %r", raw_name, cleaned)
        entry = dict(c)
        entry["name"] = cleaned
        # Strip concept names in the 'related' list as well
        if "related" in entry and isinstance(entry["related"], list):
            clean_related = []
            for r in entry["related"]:
                rc = _clean_term_name(str(r)) if r else None
                if rc:
                    clean_related.append(rc)
                else:
                    logger.debug("[KG] dropping invalid related name %r in concept %r", r, cleaned)
            entry["related"] = clean_related
        result.append(entry)
    return result


def generate_subject_graph(subject_id: str, chunks: List[str]) -> Optional[Dict[str, Any]]:
    """Generates the knowledge graph from chunks and caches it in Redis."""
    if not chunks:
        logger.warning(f"No chunks provided for subject {subject_id}. Cannot generate graph.")
        return None
        
    logger.info(f"Generating knowledge graph for subject {subject_id} from {len(chunks)} chunks...")
    start_time = time.perf_counter()
    
    try:
        plan, _ = create_summary_plan(chunks, difficulty="intermediate")
        
        # Log raw concept names before sanitization
        raw_names = (
            [c.get("name") for c in plan.core_concepts]
            + [c.get("name") for c in plan.supporting_concepts]
            + [c.get("name") for c in plan.minor_concepts]
        )
        logger.info(
            "[KG] pre-sanitize subject=%s total_concepts=%d sample=%s",
            subject_id, len(raw_names), raw_names[:8],
        )

        # Sanitize concept names — normalize whitespace, validate structure
        clean_core = _sanitize_concept_list(plan.core_concepts)
        clean_supporting = _sanitize_concept_list(plan.supporting_concepts)
        clean_minor = _sanitize_concept_list(plan.minor_concepts)

        dropped = len(raw_names) - (len(clean_core) + len(clean_supporting) + len(clean_minor))
        if dropped:
            logger.warning("[KG] subject=%s dropped %d invalid concept(s) during sanitization", subject_id, dropped)

        # Sanitize cluster concept lists and labels
        clean_clusters = []
        for cluster in plan.topic_clusters:
            entry = dict(cluster)
            if "label" in entry:
                entry["label"] = entry["label"].strip()
            if "concepts" in entry and isinstance(entry["concepts"], list):
                entry["concepts"] = [
                    c.strip() for c in entry["concepts"]
                    if c and _clean_term_name(str(c).strip())
                ]
            clean_clusters.append(entry)

        # Serialize the graph payload with metadata
        graph_data = {
            "subject_id": str(subject_id),
            "graph_version": 1,
            "planner_version": "1.0",
            "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "chunk_count": len(chunks),
            "clusters": clean_clusters,
            "core_concepts": clean_core,
            "supporting_concepts": clean_supporting,
            "minor_concepts": clean_minor,
            "stats": plan.stats,
        }

        logger.info(
            "[KG] post-sanitize subject=%s core=%d supporting=%d minor=%d clusters=%d",
            subject_id, len(clean_core), len(clean_supporting), len(clean_minor), len(clean_clusters),
        )

        # Save to Redis with TTL
        client = _get_redis()
        client.set(
            _graph_key(str(subject_id)),
            json.dumps(graph_data),
            ex=KNOWLEDGE_GRAPH_TTL_SECONDS,
        )
        duration_ms = int((time.perf_counter() - start_time) * 1000)
        logger.info(
            "[KG] cached knowledge graph subject=%s duration_ms=%d chunks=%d",
            subject_id, duration_ms, len(chunks),
        )
        return graph_data
    except Exception as e:
        duration_ms = int((time.perf_counter() - start_time) * 1000)
        logger.error(f"Failed to generate knowledge graph for subject {subject_id} after {duration_ms}ms: {e}")
        return None


def get_subject_graph(subject_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves the cached knowledge graph for a subject."""
    client = _get_redis()
    data = client.get(_graph_key(str(subject_id)))
    if data:
        try:
            parsed = json.loads(data)
            logger.debug(f"Cache hit for knowledge graph: subject {subject_id}")
            return parsed
        except json.JSONDecodeError:
            logger.error(f"Failed to decode knowledge graph for subject {subject_id}")
            return None
    logger.debug(f"Cache miss for knowledge graph: subject {subject_id}")
    return None


def get_concepts_by_difficulty(subject_id: str, difficulty: str) -> List[Dict[str, Any]]:
    """Returns concepts matching the target difficulty.

    Difficulty mapping:
    - beginner / easy: CORE concepts
    - intermediate / medium: SUPPORTING concepts
    - advanced / hard: MINOR concepts
    """
    graph = get_subject_graph(subject_id)
    if not graph:
        return []

    return _concepts_from_graph(graph, difficulty)


def _concepts_from_graph(graph: Dict[str, Any], difficulty: str) -> List[Dict[str, Any]]:
    """Extract the right difficulty tier from a loaded graph dict."""
    normalized = difficulty.lower()
    if normalized in ("beginner", "easy", "introductory"):
        return graph.get("core_concepts", [])
    elif normalized in ("advanced", "hard"):
        return graph.get("minor_concepts", [])
    else:
        return graph.get("supporting_concepts", [])


def get_or_build_concepts(
    subject_id: str,
    difficulty: str,
    db=None,
) -> List[Dict[str, Any]]:
    """Return concepts for subject at given difficulty, building the graph on-demand if absent.

    Resolution order:
    1. Redis cache (existing graph, target difficulty tier).
    2. On-demand graph generation from DB chunks, then Redis cache, then target tier.
    3. Widen to neighbouring difficulty tiers from the (possibly just-built) graph.

    Always returns a list (never raises) — callers must handle empty.
    """
    # 1. Happy path — cached graph has the right tier.
    concepts = get_concepts_by_difficulty(subject_id, difficulty)
    if concepts:
        return concepts

    graph = get_subject_graph(subject_id)

    # 2. If no cached graph but DB is available, build it on-demand.
    if graph is None and db is not None:
        try:
            from .retrieval import retrieve_sequential_chunks
            graph_chunks = retrieve_sequential_chunks(db, subject_id)
            chunk_texts = [c.content for c in graph_chunks if c.content]
            if chunk_texts:
                logger.info(
                    "[KG] on-demand graph build subject=%s chunks=%d",
                    subject_id, len(chunk_texts),
                )
                graph = generate_subject_graph(subject_id, chunk_texts)
            else:
                logger.warning(
                    "[KG] on-demand build skipped — no chunks in DB for subject=%s",
                    subject_id,
                )
        except Exception as exc:
            logger.warning(
                "[KG] on-demand graph build failed subject=%s: %s",
                subject_id, exc,
            )

    if graph is None:
        return []

    # Try the requested difficulty tier first.
    concepts = _concepts_from_graph(graph, difficulty)
    if concepts:
        return concepts

    # 3. Widen to other tiers if the target tier is empty.
    for cat in ("core_concepts", "supporting_concepts", "minor_concepts"):
        concepts = graph.get(cat, [])
        if concepts:
            logger.info(
                "[KG] difficulty tier '%s' empty for subject=%s; widened to %s (%d concepts)",
                difficulty, subject_id, cat, len(concepts),
            )
            return concepts

    return []


def get_related_concepts(subject_id: str, concept_name: str) -> List[str]:
    """Given a concept, returns related concept names from its cluster and co-occurrences."""
    graph = get_subject_graph(subject_id)
    if not graph:
        return []
        
    target_concept = None
    # Find the concept in all classes
    for cat in ["core_concepts", "supporting_concepts", "minor_concepts"]:
        for c in graph.get(cat, []):
            if c.get("name") == concept_name:
                target_concept = c
                break
        if target_concept:
            break
            
    if not target_concept:
        return []
        
    related = set(target_concept.get("related", []))
    
    # Add cluster siblings
    cluster_id = target_concept.get("cluster_id")
    if cluster_id is not None and cluster_id != -1:
        for cluster in graph.get("clusters", []):
            if cluster.get("id") == cluster_id:
                for sibling in cluster.get("concepts", []):
                    if sibling != concept_name:
                        related.add(sibling)
                break
                
    return list(related)


def invalidate_subject_graph(subject_id: str) -> bool:
    """Explicitly invalidates and removes the cached knowledge graph.
    
    Returns True if a graph was deleted, False if it did not exist.
    """
    client = _get_redis()
    deleted = client.delete(_graph_key(str(subject_id)))
    if deleted:
        logger.info(f"Invalidated knowledge graph for subject {subject_id}")
        return True
    return False


def has_subject_graph(subject_id: str) -> bool:
    """Fast check to see if a graph exists without deserializing it."""
    client = _get_redis()
    return bool(client.exists(_graph_key(str(subject_id))))


def is_graph_stale(subject_id: str, last_modified_at: datetime.datetime) -> bool:
    """Checks if the cached graph is older than a given modification timestamp.
    
    Useful for checking if the graph needs regeneration after new documents are uploaded.
    If the graph doesn't exist, it's considered stale.
    """
    graph = get_subject_graph(subject_id)
    if not graph:
        return True
        
    generated_at_str = graph.get("generated_at")
    if not generated_at_str:
        return True
        
    try:
        generated_at = datetime.datetime.fromisoformat(generated_at_str)
        # Compare timezone-aware datetimes
        if last_modified_at.tzinfo is None:
            # Assume UTC if naive
            last_modified_at = last_modified_at.replace(tzinfo=datetime.timezone.utc)
            
        return generated_at < last_modified_at
    except (ValueError, TypeError):
        return True
