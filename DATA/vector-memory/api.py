"""AEGENTIS DATA — Vector Memory API"""
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List
from vector_store import vector_store

app = FastAPI(title="AEGENTIS Data - Vector Memory", version="1.0.0")

class StoreRequest(BaseModel):
    text: str
    embedding: List[float]
    metadata: Optional[dict] = None

class SearchRequest(BaseModel):
    embedding: List[float]
    top_k: int = 5
    threshold: float = 0.7

@app.get("/health")
def health():
    return {"ok": True, "service": "AEGENTIS-DATA", "stats": vector_store.stats()}

@app.post("/store")
def store(req: StoreRequest):
    return vector_store.store(req.text, req.embedding, req.metadata)

@app.post("/search")
def search(req: SearchRequest):
    return vector_store.search(req.embedding, req.top_k, req.threshold)
