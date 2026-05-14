"""
Lightweight concept prioritization for the summary pipeline.

Zero LLM calls. Zero heavy NLP dependencies (no spaCy, NLTK, or transformers).
Runs on post-MAP chunks before the REDUCE generation pass.
Target: <100 ms for 25 k chars on any hardware.

Pipeline:
  chunks → term extraction → co-occurrence graph → scoring → clustering → plan

Public API: create_summary_plan(chunks, difficulty) → (SummaryPlan, prompt_block)
"""

from __future__ import annotations

import math
import re
import time
import logging
from collections import Counter
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any

logger = logging.getLogger("engine-concept-planner")

# ── Stop words ────────────────────────────────────────────────────────────────
_STOP: frozenset = frozenset({
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "into", "through", "during", "before",
    "after", "above", "below", "between", "about", "against",
    "is", "was", "are", "were", "be", "been", "being",
    "have", "has", "had", "having", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "shall", "can",
    "this", "that", "these", "those",
    "i", "we", "you", "he", "she", "it", "they",
    "me", "us", "him", "her", "them", "my", "our", "your", "his", "its", "their",
    "what", "which", "who", "whom", "when", "where", "why", "how",
    "all", "each", "every", "both", "few", "more", "most", "other",
    "some", "such", "no", "not", "only", "same", "so", "than", "too",
    "very", "just", "also", "then", "here", "there", "up", "out", "any",
    "if", "while", "although", "because", "since", "unless", "until",
    "though", "whether", "either", "neither", "even", "still", "yet",
    "however", "therefore", "thus", "hence", "whereas", "meanwhile",
    "furthermore", "moreover", "additionally", "consequently",
    "nevertheless", "nonetheless", "accordingly", "subsequently",
    "first", "second", "third", "finally", "next", "last",
    "one", "two", "three", "four", "five",
    "many", "much", "several", "various", "certain", "particular",
    "following", "given", "known", "called", "used", "shown", "based",
    "including", "according", "related", "using", "without",
    "new", "old", "good", "large", "small", "high", "low",
    "different", "important", "main", "general", "common", "specific",
    "example", "case", "way", "part", "number", "type", "kind",
    "point", "set", "term", "value", "level", "result", "system",
    "note", "see", "refer", "consider", "define", "describe", "explain",
})

# ── Regex patterns ────────────────────────────────────────────────────────────
_RE_HEADING = re.compile(
    r'(?:^|\n)[ \t]*([A-Z][A-Za-z0-9 \-/]{2,50})[ \t]*(?:\n|:)',
    re.MULTILINE,
)
_RE_DEFINITION = re.compile(
    r'\b(?:is defined (?:as|by)|refers to|is (?:an?|the)\b|means(?: that)?|'
    r'is called|is known as|can be defined|we define|defined as)\b',
    re.IGNORECASE,
)
_RE_SENT = re.compile(r'(?<=[.!?])\s+(?=[A-Z])')
_RE_TOKEN = re.compile(r'[a-zA-Z]{2,}')
# Valid concept name: lowercase alpha words separated by single spaces.
# Each word must be >= 2 chars and the name must start with a letter.
_RE_VALID_CONCEPT = re.compile(r'^[a-z][a-z]*(?:\s[a-z][a-z]+)*$')

# ── Tuning ────────────────────────────────────────────────────────────────────
_CO_WINDOW = 3       # consecutive sentences for co-occurrence
_MAX_CONCEPTS = 80   # cap before clustering — keeps O(n²) fast
_MAX_CLUSTERS = 6
_JOIN_THRESHOLD = 1  # minimum co-occurrence strength to join a cluster

# Importance weight vector (sum = 1.0)
_W_FREQ = 0.22
_W_COVERAGE = 0.28
_W_CENTRALITY = 0.18
_W_DENSITY = 0.10
_W_HEADING = 0.12
_W_DEFINITION = 0.10

# Classification thresholds
_CORE_THRESH = 0.60
_SUPPORT_THRESH = 0.30


# ── Concept name normalization ────────────────────────────────────────────────

def _clean_term_name(raw: str) -> Optional[str]:
    """
    Normalize a candidate concept token and return the cleaned name, or None
    if the token should be rejected.

    Normalization steps:
      1. Strip leading/trailing whitespace and control characters.
      2. Replace any non-printable ASCII (including stray \\n, \\r, \\t embedded
         mid-string) with a space, then collapse runs of spaces.

    Rejection criteria:
      - Empty after normalization.
      - Contains characters outside lowercase alpha and single spaces
        (digits, punctuation, mixed-case — all indicate extraction artifacts).
      - Any component word is < 2 characters (single-letter prefix artifacts).

    The function deliberately does NOT perform semantic validation (no dictionary
    lookup, no domain whitelist) — it only guarantees structural integrity so
    that concept names are safe to store in Redis and compare as strings.
    """
    if not raw:
        return None
    cleaned = raw.strip()
    # Replace embedded control chars / non-printable bytes with a space
    cleaned = re.sub(r'[^\x20-\x7e]', ' ', cleaned)
    # Collapse multiple spaces and re-strip
    cleaned = re.sub(r' {2,}', ' ', cleaned).strip()
    if not cleaned:
        return None
    # Must be purely lowercase alpha words
    if not _RE_VALID_CONCEPT.match(cleaned):
        return None
    # Every component word must be >= 2 chars (rejects 'n', 'x', 'nb' fragments)
    if any(len(w) < 2 for w in cleaned.split()):
        return None
    return cleaned


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class _Term:
    name: str
    frequency: int = 0
    chunk_set: set = field(default_factory=set)
    in_heading: bool = False
    near_definition: bool = False
    co_occurring: Counter = field(default_factory=Counter)
    sent_lengths: List[int] = field(default_factory=list)
    snippets: List[str] = field(default_factory=list)


@dataclass
class Concept:
    name: str
    cluster_id: int = -1
    frequency: int = 0
    chunk_coverage: float = 0.0
    importance_score: float = 0.0
    concept_class: str = "MINOR"       # CORE | SUPPORTING | MINOR
    depth_instruction: str = "brief"   # exhaustive | detailed | brief | skip
    related: List[str] = field(default_factory=list)
    snippets: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "cluster_id": self.cluster_id,
            "frequency": self.frequency,
            "chunk_coverage": round(self.chunk_coverage, 2),
            "importance_score": round(self.importance_score, 3),
            "class": self.concept_class,
            "depth": self.depth_instruction,
            "related": self.related[:5],
            "snippets": self.snippets[:2],
        }


@dataclass
class TopicCluster:
    id: int
    label: str
    concept_names: List[str] = field(default_factory=list)
    importance: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "concepts": self.concept_names[:6],
            "importance": round(self.importance, 2),
        }


@dataclass
class SummaryPlan:
    topic_clusters: List[Dict]
    core_concepts: List[Dict]
    supporting_concepts: List[Dict]
    minor_concepts: List[Dict]
    depth_plan: Dict[str, str]
    stats: Dict[str, Any] = field(default_factory=dict)


# ── Extraction ────────────────────────────────────────────────────────────────

def _split_sentences(text: str) -> List[str]:
    parts = _RE_SENT.split(text)
    # Also split on double newlines (paragraph boundaries)
    result = []
    for p in parts:
        result.extend(s.strip() for s in p.split('\n\n') if len(s.strip()) > 10)
    return result


def _adaptive_min_freq(total_chunks: int, n_words: int) -> int:
    """Scale minimum frequency down for small corpora to avoid empty plans."""
    if total_chunks <= 4:
        return 1
    if total_chunks <= 10:
        return 1 if n_words >= 2 else 2
    return {1: 3, 2: 2, 3: 2}.get(n_words, 2)


def _extract_candidate_terms(chunks: List[str]) -> Dict[str, _Term]:
    """
    Extract unigram/bigram/trigram candidates from all chunks.

    Per-chunk tracking gives us chunk_coverage (cross-file recurrence signal).
    Heading and definition context are detected per-sentence.
    Sentence lengths are tracked per term for explanation-density scoring.
    """
    terms: Dict[str, _Term] = {}
    total_chunks = len(chunks)

    # Collect heading tokens from the full joined text once
    full_text = "\n".join(chunks)
    heading_terms: set = set()
    for m in _RE_HEADING.finditer(full_text):
        htokens = [t.lower() for t in _RE_TOKEN.findall(m.group(1)) if t.lower() not in _STOP]
        for ht in htokens:
            heading_terms.add(ht)
        for i in range(len(htokens) - 1):
            heading_terms.add(f"{htokens[i]} {htokens[i + 1]}")

    for chunk_idx, chunk in enumerate(chunks):
        for sent in _split_sentences(chunk):
            raw_tokens = _RE_TOKEN.findall(sent.lower())
            content = [t for t in raw_tokens if t not in _STOP and len(t) >= 3]
            if not content:
                continue

            near_def = bool(_RE_DEFINITION.search(sent))
            sent_len = len(raw_tokens)

            def _upsert(name: str, n_words: int) -> None:
                clean = _clean_term_name(name)
                if clean is None:
                    logger.debug("[PLANNER] dropping invalid term %r", name)
                    return
                if clean != name:
                    logger.debug("[PLANNER] term normalized %r → %r", name, clean)
                name = clean
                if name not in terms:
                    terms[name] = _Term(name=name)
                t = terms[name]
                t.frequency += 1
                t.chunk_set.add(chunk_idx)
                t.sent_lengths.append(sent_len)
                if near_def:
                    t.near_definition = True
                if name in heading_terms:
                    t.in_heading = True
                if len(t.snippets) < 2:
                    snippet = sent.strip()[:120]
                    if snippet not in t.snippets:
                        t.snippets.append(snippet)

            for tok in content:
                _upsert(tok, 1)
            for i in range(len(content) - 1):
                _upsert(f"{content[i]} {content[i + 1]}", 2)
            for i in range(len(content) - 2):
                _upsert(f"{content[i]} {content[i + 1]} {content[i + 2]}", 3)

    # Frequency filter — thresholds adapt to corpus size
    return {
        name: term for name, term in terms.items()
        if term.frequency >= _adaptive_min_freq(total_chunks, len(name.split()))
    }


# ── Co-occurrence ─────────────────────────────────────────────────────────────

def _build_cooccurrence(terms: Dict[str, _Term], chunks: List[str]) -> None:
    """
    Sliding sentence-window co-occurrence using token-set matching.

    Only considers top-N terms by frequency so the O(n²) pair loop stays fast.
    Token-set matching avoids substring false-positives ("term" ∈ "terminal").
    """
    top_names: List[str] = sorted(
        terms, key=lambda n: terms[n].frequency, reverse=True
    )[: _MAX_CONCEPTS * 2]

    name_token_sets: Dict[str, frozenset] = {
        n: frozenset(_RE_TOKEN.findall(n.lower())) for n in top_names
    }

    for chunk in chunks:
        sentences = _split_sentences(chunk)
        for i in range(len(sentences)):
            window = " ".join(sentences[i: i + _CO_WINDOW])
            w_tokens = frozenset(_RE_TOKEN.findall(window.lower()))
            present = [n for n in top_names if name_token_sets[n].issubset(w_tokens)]
            for ai in range(len(present)):
                for bi in range(ai + 1, len(present)):
                    a, b = present[ai], present[bi]
                    terms[a].co_occurring[b] += 1
                    terms[b].co_occurring[a] += 1


# ── Scoring ───────────────────────────────────────────────────────────────────

def _score_terms(
    terms: Dict[str, _Term],
    total_chunks: int,
) -> Dict[str, float]:
    """
    Importance = weighted combination of six signals:

      freq_score   (0.22) — log-normalised repetition frequency
      coverage     (0.28) — fraction of chunks containing the term (cross-file recurrence)
      centrality   (0.18) — co-occurrence graph degree (relationship centrality + dependency weight)
      density      (0.10) — average sentence length at occurrence sites (explanation density)
      heading      (0.12) — appeared in a heading-like line
      definition   (0.10) — introduced with definition language

    Bigrams/trigrams receive a small specificity bonus (+0.05) to preference
    technical multi-word terms over generic single words.
    """
    if not terms:
        return {}

    max_freq = max(t.frequency for t in terms.values()) or 1
    max_co = max(len(t.co_occurring) for t in terms.values()) or 1

    # Pre-compute max average sentence length for density normalisation
    def _avg_sent_len(t: _Term) -> float:
        return sum(t.sent_lengths) / len(t.sent_lengths) if t.sent_lengths else 0.0

    max_avg_len = max((_avg_sent_len(t) for t in terms.values()), default=1.0) or 1.0

    scores: Dict[str, float] = {}
    for name, term in terms.items():
        freq_score = math.log1p(term.frequency) / math.log1p(max_freq)
        coverage = len(term.chunk_set) / total_chunks if total_chunks > 0 else 0.0
        centrality = len(term.co_occurring) / max_co
        density = _avg_sent_len(term) / max_avg_len
        heading = 1.0 if term.in_heading else 0.0
        definition = 1.0 if term.near_definition else 0.0

        n_words = len(name.split())
        specificity = 0.05 if n_words >= 2 else 0.0

        raw = (
            _W_FREQ * freq_score
            + _W_COVERAGE * coverage
            + _W_CENTRALITY * centrality
            + _W_DENSITY * density
            + _W_HEADING * heading
            + _W_DEFINITION * definition
            + specificity
        )
        scores[name] = min(raw, 1.0)

    return scores


# ── Clustering ────────────────────────────────────────────────────────────────

def _cluster_terms(
    terms: Dict[str, _Term],
    scores: Dict[str, float],
) -> Tuple[List[TopicCluster], Dict[str, int]]:
    """
    Greedy co-occurrence clustering.

    Process concepts in descending importance order.  Assign each to the
    existing cluster with the strongest co-occurrence link (>= JOIN_THRESHOLD).
    If no suitable cluster exists (and MAX_CLUSTERS not reached), start a new
    one labelled by this concept.  After clustering, sort clusters by importance.
    """
    sorted_names: List[str] = sorted(
        [n for n in scores if n in terms],
        key=lambda n: scores[n],
        reverse=True,
    )[: _MAX_CONCEPTS]

    clusters: List[TopicCluster] = []
    assignment: Dict[str, int] = {}

    for name in sorted_names:
        term = terms[name]

        best_cid, best_strength = -1, 0
        for cluster in clusters:
            strength = sum(term.co_occurring.get(m, 0) for m in cluster.concept_names)
            if strength > best_strength:
                best_strength, best_cid = strength, cluster.id

        if best_cid >= 0 and best_strength >= _JOIN_THRESHOLD:
            clusters[best_cid].concept_names.append(name)
            assignment[name] = best_cid
        elif len(clusters) < _MAX_CLUSTERS:
            cid = len(clusters)
            clusters.append(TopicCluster(id=cid, label=name, concept_names=[name]))
            assignment[name] = cid
        else:
            # All slots taken — attach to the smallest existing cluster
            smallest = min(range(len(clusters)), key=lambda ci: len(clusters[ci].concept_names))
            clusters[smallest].concept_names.append(name)
            assignment[name] = smallest

    # Importance = max concept score within cluster; re-rank clusters
    for cluster in clusters:
        cluster.importance = max((scores.get(n, 0.0) for n in cluster.concept_names), default=0.0)
    clusters.sort(key=lambda c: c.importance, reverse=True)
    for new_id, cluster in enumerate(clusters):
        cluster.id = new_id
        for n in cluster.concept_names:
            assignment[n] = new_id

    return clusters, assignment


# ── Plan assembly ─────────────────────────────────────────────────────────────

def _assign_depth(concept_class: str, difficulty: str) -> str:
    """Map (class × difficulty) → depth instruction for the generation prompt."""
    if concept_class == "CORE":
        return "exhaustive" if difficulty in ("advanced", "hard") else "detailed"
    if concept_class == "SUPPORTING":
        if difficulty in ("advanced", "hard"):
            return "detailed"
        if difficulty == "intermediate":
            return "brief"
        return "skip"
    # MINOR
    return "brief" if difficulty in ("advanced", "hard") else "skip"


def _build_plan(
    terms: Dict[str, _Term],
    scores: Dict[str, float],
    clusters: List[TopicCluster],
    assignment: Dict[str, int],
    total_chunks: int,
    difficulty: str,
) -> SummaryPlan:
    concepts: List[Concept] = []
    for name, score in scores.items():
        term = terms[name]
        concept_class = (
            "CORE" if score >= _CORE_THRESH
            else "SUPPORTING" if score >= _SUPPORT_THRESH
            else "MINOR"
        )
        related = [n for n, _ in term.co_occurring.most_common(6) if n in scores]
        concepts.append(Concept(
            name=name,
            cluster_id=assignment.get(name, -1),
            frequency=term.frequency,
            chunk_coverage=len(term.chunk_set) / total_chunks if total_chunks else 0.0,
            importance_score=score,
            concept_class=concept_class,
            depth_instruction=_assign_depth(concept_class, difficulty),
            related=related,
            snippets=term.snippets[:2],
        ))

    concepts.sort(key=lambda c: c.importance_score, reverse=True)

    core = [c.to_dict() for c in concepts if c.concept_class == "CORE"]
    supporting = [c.to_dict() for c in concepts if c.concept_class == "SUPPORTING"]
    minor = [c.to_dict() for c in concepts if c.concept_class == "MINOR"]

    return SummaryPlan(
        topic_clusters=[cl.to_dict() for cl in clusters],
        core_concepts=core,
        supporting_concepts=supporting,
        minor_concepts=minor,
        depth_plan={c["name"]: c["depth"] for c in core + supporting + minor},
        stats={
            "total_candidate_terms": len(terms),
            "scored_concepts": len(concepts),
            "core": len(core),
            "supporting": len(supporting),
            "minor": len(minor),
            "clusters": len(clusters),
        },
    )


# ── Prompt serialization ──────────────────────────────────────────────────────

def plan_to_prompt_block(plan: SummaryPlan, difficulty: str) -> str:
    """
    Serialize the plan into a compact prompt prefix (~200-400 chars).

    The block acts as an attention directive for the LLM — it names which
    concepts deserve deep coverage and how topics are organised.  It does NOT
    add new information (everything is already in the context), so it never
    inflates VRAM usage meaningfully.
    """
    lines: List[str] = []

    if plan.topic_clusters:
        parts = []
        for tc in plan.topic_clusters[:5]:
            concepts_str = ", ".join(tc["concepts"][:4])
            parts.append(f"{tc['label']} [{concepts_str}]")
        lines.append("Topic clusters: " + " | ".join(parts))

    if plan.core_concepts:
        names = ", ".join(c["name"] for c in plan.core_concepts[:12])
        lines.append(f"Core concepts (deep coverage required): {names}")

    if difficulty not in ("introductory", "beginner", "easy") and plan.supporting_concepts:
        names = ", ".join(c["name"] for c in plan.supporting_concepts[:8])
        lines.append(f"Supporting concepts (standard coverage): {names}")

    if difficulty in ("advanced", "hard") and plan.minor_concepts:
        names = ", ".join(c["name"] for c in plan.minor_concepts[:6])
        lines.append(f"Minor concepts (brief mention): {names}")

    if not lines:
        return ""

    return "CONTENT PLAN\n" + "\n".join(lines) + "\n"


# ── Public API ────────────────────────────────────────────────────────────────

def create_summary_plan(
    chunks: List[str],
    difficulty: str = "intermediate",
) -> Tuple[SummaryPlan, str]:
    """
    Run the full concept prioritisation pipeline on post-MAP chunks.

    Returns:
        plan        — SummaryPlan dataclass (programmatic access, includes snippets)
        plan_block  — compact string for injection into the REDUCE prompt

    Call this at the start of the REDUCE stage, after MAP has finished,
    before build_summary_prompt().  Wrap in try/except at the call site —
    on failure the caller should continue with plan_block="".
    """
    if not chunks:
        return SummaryPlan([], [], [], [], {}, {}), ""

    t0 = time.perf_counter()
    total_chunks = len(chunks)

    terms = _extract_candidate_terms(chunks)
    t1 = time.perf_counter()

    _build_cooccurrence(terms, chunks)
    t2 = time.perf_counter()

    scores_all = _score_terms(terms, total_chunks)
    # Keep only top-N for clustering
    scores = dict(
        sorted(scores_all.items(), key=lambda kv: kv[1], reverse=True)[: _MAX_CONCEPTS]
    )
    t3 = time.perf_counter()

    clusters, assignment = _cluster_terms(terms, scores)
    t4 = time.perf_counter()

    plan = _build_plan(terms, scores, clusters, assignment, total_chunks, difficulty)
    plan_block = plan_to_prompt_block(plan, difficulty)
    t5 = time.perf_counter()

    logger.info(
        "[PLANNER] chunks=%d candidates=%d scored=%d core=%d supp=%d minor=%d "
        "clusters=%d total_ms=%d "
        "(extract=%.0f co_occ=%.0f score=%.0f cluster=%.0f assemble=%.0f)",
        total_chunks,
        len(terms),
        len(scores),
        plan.stats.get("core", 0),
        plan.stats.get("supporting", 0),
        plan.stats.get("minor", 0),
        len(clusters),
        int((t5 - t0) * 1000),
        (t1 - t0) * 1000,
        (t2 - t1) * 1000,
        (t3 - t2) * 1000,
        (t4 - t3) * 1000,
        (t5 - t4) * 1000,
    )

    return plan, plan_block
