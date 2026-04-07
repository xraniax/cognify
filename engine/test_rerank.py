import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.reranker import reranker

query = "How do I study for exams?"
docs = [
    "To study for exams, you should review your notes and practice past papers.",
    "The weather is nice today.",
    "Cooking pasta requires boiling water.",
    "Effective study techniques include active recall and spaced repetition."
]

print(f"Query: {query}")
scores = reranker.rank(query, docs)

results = sorted(zip(scores, docs), key=lambda x: x[0], reverse=True)
for score, doc in results:
    print(f"[{score:.4f}] {doc}")
