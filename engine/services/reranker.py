import logging
from typing import List, Any
import time
try:
    from sentence_transformers import CrossEncoder
except ImportError:
    CrossEncoder = None

logger = logging.getLogger("engine-reranker")

class ReRanker:
    _instance = None
    _model = None
    _model_name = "cross-encoder/ms-marco-TinyBERT-L-2-v2"

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ReRanker, cls).__new__(cls)
            if CrossEncoder is None:
                logger.error("sentence-transformers not installed. Reranking disabled.")
                return cls._instance
            
            start = time.perf_counter()
            logger.info(f"RERANKER: Loading model {cls._model_name}...")
            try:
                # Use CPU by default for the small model to save GPU for Ollama if needed, 
                # but CrossEncoder handles device automatically.
                cls._model = CrossEncoder(cls._model_name, max_length=512)
                logger.info(f"RERANKER: Model loaded in {time.perf_counter() - start:.2f}s")
            except Exception as e:
                logger.error(f"RERANKER: Failed to load model: {e}")
                cls._model = None
        return cls._instance

    def rank(self, query: str, documents: List[str]) -> List[float]:
        """
        Score a list of documents against a query.
        Returns a list of scores corresponding to each document.
        """
        if not self._model or not documents:
            return [0.0] * len(documents)
        
        try:
            start = time.perf_counter()
            pairs = [[query, doc] for doc in documents]
            scores = self._model.predict(pairs)
            logger.debug(f"RERANKER: Scored {len(documents)} pairs in {time.perf_counter() - start:.4f}s")
            return scores.tolist()
        except Exception as e:
            logger.error(f"RERANKER: Scoring error: {e}")
            return [0.0] * len(documents)

# Singleton export
reranker = ReRanker()
