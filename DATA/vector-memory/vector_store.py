"""
AEGENTIS CORPORATION - Vector Memory Store
Persistent semantic memory for all AEGENTIS AI agents.
Stores embeddings with metadata for similarity search and recall.
"""

import os
import json
import math
import uuid
from pathlib import Path
from datetime import datetime

VECTOR_DB_PATH = Path(os.getenv("AEGENTIS_VECTOR_DB", "/data/aegentis/vectors.jsonl"))


class VectorStore:
    def __init__(self):
        VECTOR_DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.index = []
        self._load()

    def _load(self):
        if VECTOR_DB_PATH.exists():
            with open(VECTOR_DB_PATH) as f:
                for line in f:
                    try:
                        self.index.append(json.loads(line))
                    except Exception:
                        pass

    def _cosine_similarity(self, a, b):
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x ** 2 for x in a))
        norm_b = math.sqrt(sum(x ** 2 for x in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def store(self, text: str, embedding: list, metadata: dict = None) -> dict:
        """Store a memory with its embedding."""
        entry = {
            "memory_id": str(uuid.uuid4()),
            "text": text,
            "embedding": embedding,
            "metadata": metadata or {},
            "stored_at": datetime.utcnow().isoformat()
        }
        self.index.append(entry)
        with open(VECTOR_DB_PATH, 'a') as f:
            # Store without embedding for JSONL (too large); store separately
            record = {k: v for k, v in entry.items() if k != 'embedding'}
            record['embedding_dim'] = len(embedding)
            f.write(json.dumps(record) + '\n')
        return entry

    def search(self, query_embedding: list, top_k: int = 5, threshold: float = 0.7) -> list:
        """Find the most semantically similar memories."""
        results = []
        for entry in self.index:
            if 'embedding' not in entry:
                continue
            score = self._cosine_similarity(query_embedding, entry['embedding'])
            if score >= threshold:
                results.append({
                    "memory_id": entry["memory_id"],
                    "text": entry["text"],
                    "metadata": entry["metadata"],
                    "score": round(score, 4),
                    "stored_at": entry["stored_at"]
                })
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]

    def recall_by_domain(self, domain: str, limit: int = 20) -> list:
        """Retrieve memories filtered by domain metadata."""
        return [
            e for e in self.index
            if e.get("metadata", {}).get("domain") == domain
        ][-limit:]

    def stats(self) -> dict:
        return {
            "total_memories": len(self.index),
            "db_path": str(VECTOR_DB_PATH)
        }


vector_store = VectorStore()
