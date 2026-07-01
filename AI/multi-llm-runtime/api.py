"""AEGENTIS AI — Multi-LLM Runtime API"""
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from llm_runtime import llm

app = FastAPI(title="AEGENTIS AI Runtime", version="1.0.0")

class CompletionRequest(BaseModel):
    prompt: str
    task_type: str = "default"
    system: Optional[str] = None
    max_tokens: int = 1024
    temperature: float = 0.7

@app.get("/health")
def health():
    return {"ok": True, "service": "AEGENTIS-AI", "stats": llm.get_stats()}

@app.post("/complete")
def complete(req: CompletionRequest):
    return llm.complete(
        prompt=req.prompt,
        task_type=req.task_type,
        system=req.system,
        max_tokens=req.max_tokens,
        temperature=req.temperature
    )
