"""
AEGENTIS CORPORATION - Multi-LLM Runtime
Unified interface to multiple LLM providers.
Routes requests based on task type, cost, and capability requirements.
"""

import os
import json
import uuid
import requests
from typing import Optional, List, Dict, Any

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_API_BASE", "https://api.openai.com/v1")
KERNEL_URL = os.getenv("KERNEL_EVENT_BUS_URL", "http://kernel-event-bus:8080/intent")

MODEL_REGISTRY = {
    "reasoning":   {"provider": "openai", "model": "o1-mini"},
    "planning":    {"provider": "openai", "model": "gpt-4o"},
    "fast":        {"provider": "openai", "model": "gpt-4o-mini"},
    "vision":      {"provider": "openai", "model": "gpt-4o"},
    "embedding":   {"provider": "openai", "model": "text-embedding-3-small"},
    "default":     {"provider": "openai", "model": "gpt-4o-mini"},
}


def emit_to_kernel(event_type, payload, trace_id=None):
    event = {
        "event_version": 1,
        "domain": "ai",
        "type": event_type,
        "entity_id": "llm-runtime",
        "source": "aegentis-ai",
        "actor": "system:llm-runtime",
        "trace_id": trace_id or str(uuid.uuid4()),
        "payload": payload
    }
    try:
        requests.post(KERNEL_URL, json=event, timeout=3)
    except Exception:
        pass


class LLMRuntime:
    def __init__(self):
        self.call_count = 0
        self.total_tokens = 0

    def complete(
        self,
        prompt: str,
        task_type: str = "default",
        system: Optional[str] = None,
        messages: Optional[List[Dict]] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        trace_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Route a completion request to the appropriate model."""
        model_config = MODEL_REGISTRY.get(task_type, MODEL_REGISTRY["default"])
        trace_id = trace_id or str(uuid.uuid4())

        if not messages:
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": prompt})

        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }

        body = {
            "model": model_config["model"],
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature
        }

        try:
            response = requests.post(
                f"{OPENAI_BASE_URL}/chat/completions",
                headers=headers,
                json=body,
                timeout=30
            )
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            tokens = result.get("usage", {}).get("total_tokens", 0)

            self.call_count += 1
            self.total_tokens += tokens

            emit_to_kernel("LLM_COMPLETION", {
                "model": model_config["model"],
                "task_type": task_type,
                "tokens": tokens,
                "call_count": self.call_count
            }, trace_id=trace_id)

            return {"ok": True, "content": content, "tokens": tokens, "model": model_config["model"]}

        except Exception as e:
            emit_to_kernel("LLM_ERROR", {"error": str(e), "task_type": task_type}, trace_id=trace_id)
            return {"ok": False, "error": str(e)}

    def embed(self, text: str) -> Dict[str, Any]:
        """Generate embeddings for vector memory."""
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        try:
            response = requests.post(
                f"{OPENAI_BASE_URL}/embeddings",
                headers=headers,
                json={"model": MODEL_REGISTRY["embedding"]["model"], "input": text},
                timeout=10
            )
            result = response.json()
            return {"ok": True, "embedding": result["data"][0]["embedding"]}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def get_stats(self):
        return {"call_count": self.call_count, "total_tokens": self.total_tokens}


llm = LLMRuntime()
