"""
jarvis/jarvis_binding.py

Jarvis Binding Adapter for AEGENTIX CYBERNETICS
================================================
Wraps the agentic-ai-orchestrator and routes every decision,
pipeline step, and sovereign action into the WorldMonitor
event bus via POST /intent (EVENT_SPEC_v1).

Architecture:
  Jarvis Orchestrator
        ↓
  JarvisBinding (this module)
        ↓
  POST /intent → WorldMonitor
        ↓
  EventStore.append() → events.jsonl
        ↓
  Projector.apply() → world state
        ↓
  Router.dispatch() → downstream adapters
"""

import os
import uuid
import time
import json
import logging
import requests
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logging.basicConfig(
    level=logging.INFO,
    format='{"ts":"%(asctime)s","level":"%(levelname)s","component":"jarvis","message":"%(message)s"}'
)
log = logging.getLogger("jarvis")

WORLDMONITOR_URL = os.environ.get("WORLDMONITOR_URL", "http://localhost:8080")
JARVIS_SOURCE    = "jarvis"
JARVIS_ACTOR     = "agent:jarvis"

# ── Pipeline step → WorldMonitor event type mapping ──────────────────────────
PIPELINE_EVENT_MAP = {
    "herald.brief_sovereign":       "SOVEREIGN_BRIEFING",
    "query_tsl.evidence":           "LEDGER_QUERY",
    "arbiter.deliberate":           "ARBITER_DECISION",
    "escrow_lock.settlement":       "ESCROW_LOCKED",
    "shadow.verify_integrity":      "INTEGRITY_VERIFIED",
    "broadcast_tribunal.verdict":   "TRIBUNAL_VERDICT",
    "generate_blueprint":           "BLUEPRINT_GENERATED",
    "deploy_agent":                 "AGENT_SPAWNED",
    "observe":                      "OBSERVATION_RECORDED",
    "decide":                       "DECISION_MADE",
    "execute":                      "EXECUTION_DISPATCHED",
}

def _build_event(
    domain: str,
    event_type: str,
    entity_id: str,
    payload: Dict[str, Any],
    trace_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a WorldMonitor-compatible intent payload."""
    return {
        "domain":         domain,
        "type":           event_type,
        "entity_id":      entity_id,
        "payload":        payload,
        "source":         JARVIS_SOURCE,
        "actor":          JARVIS_ACTOR,
        "trace_id":       trace_id or f"tr-{uuid.uuid4().hex[:12]}",
        "correlation_id": correlation_id,
    }


def emit(
    domain: str,
    event_type: str,
    entity_id: str,
    payload: Dict[str, Any],
    trace_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Emit a single event to WorldMonitor.
    Returns the full event record from WorldMonitor on success.
    Raises on HTTP error.
    """
    intent = _build_event(domain, event_type, entity_id, payload, trace_id, correlation_id)
    try:
        resp = requests.post(
            f"{WORLDMONITOR_URL}/intent",
            json=intent,
            timeout=5,
        )
        resp.raise_for_status()
        result = resp.json()
        log.info(f"Emitted {domain}.{event_type} → {result['event']['event_id']}")
        return result
    except requests.exceptions.ConnectionError:
        log.warning(f"WorldMonitor unreachable — buffering {domain}.{event_type}")
        return {"status": "buffered", "event": intent}
    except Exception as e:
        log.error(f"Emit failed: {e}")
        raise


def emit_pipeline_step(
    pipeline_name: str,
    step_name: str,
    entity_id: str,
    payload: Dict[str, Any],
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Emit a Jarvis pipeline step as a WorldMonitor event.
    Automatically resolves domain and event_type from PIPELINE_EVENT_MAP.
    """
    event_type = PIPELINE_EVENT_MAP.get(step_name, f"PIPELINE_{step_name.upper().replace('.', '_')}")
    domain = "agents"
    return emit(
        domain=domain,
        event_type=event_type,
        entity_id=entity_id or f"jarvis-{pipeline_name}",
        payload={"pipeline": pipeline_name, "step": step_name, **payload},
        trace_id=trace_id,
        correlation_id=pipeline_name,
    )


def emit_reality_observation(
    sensor: str,
    entity_id: str,
    observation: Dict[str, Any],
    trace_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Emit a physical/spatial reality observation from a sensor (RuView, VR backend, etc.)
    into WorldMonitor as a reality domain event.
    """
    return emit(
        domain="reality",
        event_type="OBSERVATION_RECORDED",
        entity_id=entity_id,
        payload={"sensor": sensor, "observation": observation, "recorded_at": int(time.time() * 1000)},
        trace_id=trace_id,
    )


def get_world_state() -> Dict[str, Any]:
    """Read the current world state from WorldMonitor /state."""
    try:
        resp = requests.get(f"{WORLDMONITOR_URL}/state", timeout=5)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        log.error(f"Failed to read world state: {e}")
        return {}


def health_check() -> bool:
    """Returns True if WorldMonitor is reachable and healthy."""
    try:
        resp = requests.get(f"{WORLDMONITOR_URL}/health", timeout=3)
        return resp.status_code == 200 and resp.json().get("ok") is True
    except Exception:
        return False


# ── Jarvis Orchestrator Loop ──────────────────────────────────────────────────

class JarvisOrchestrator:
    """
    Jarvis — the agentic AI commander for AEGENTIX CYBERNETICS.
    Observes world state, makes decisions, and emits all actions
    as immutable events into the WorldMonitor event bus.
    """

    def __init__(self, entity_id: str = "jarvis-prime", loop_interval: float = 5.0):
        self.entity_id     = entity_id
        self.loop_interval = loop_interval
        self.cycle         = 0
        self.trace_id      = f"tr-{uuid.uuid4().hex[:12]}"
        log.info(f"Jarvis initialised — entity_id={entity_id}")

    def observe(self) -> Dict[str, Any]:
        """Observe the current world state."""
        state = get_world_state()
        emit(
            domain="agents",
            event_type="OBSERVATION_RECORDED",
            entity_id=self.entity_id,
            payload={"cycle": self.cycle, "state_snapshot": state},
            trace_id=self.trace_id,
        )
        return state

    def decide(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deliberate over the observed state and produce a decision.
        This is where AI reasoning, LLM calls, or rule engines plug in.
        """
        decision = {
            "cycle":    self.cycle,
            "action":   "monitor",
            "rationale": "No anomalies detected — maintaining observation posture.",
            "confidence": 1.0,
        }
        emit(
            domain="agents",
            event_type="DECISION_MADE",
            entity_id=self.entity_id,
            payload=decision,
            trace_id=self.trace_id,
        )
        return decision

    def execute(self, decision: Dict[str, Any]) -> None:
        """Execute the decided action and emit the execution event."""
        emit(
            domain="agents",
            event_type="EXECUTION_DISPATCHED",
            entity_id=self.entity_id,
            payload={"cycle": self.cycle, "decision": decision},
            trace_id=self.trace_id,
        )

    def run_cycle(self) -> None:
        """Run one full TOTE cycle: Observe → Decide → Execute."""
        self.cycle += 1
        self.trace_id = f"tr-{uuid.uuid4().hex[:12]}"  # new trace per cycle
        log.info(f"Cycle {self.cycle} begin — trace={self.trace_id}")

        state    = self.observe()
        decision = self.decide(state)
        self.execute(decision)

        log.info(f"Cycle {self.cycle} complete")

    def run(self) -> None:
        """Run the Jarvis orchestrator loop indefinitely."""
        log.info("Jarvis binding active — waiting for WorldMonitor...")
        while not health_check():
            log.warning("WorldMonitor not ready — retrying in 3s")
            time.sleep(3)
        log.info("WorldMonitor connected — Jarvis loop starting")

        emit(
            domain="agents",
            event_type="AGENT_SPAWNED",
            entity_id=self.entity_id,
            payload={"version": "1.0.0", "loop_interval": self.loop_interval},
        )

        while True:
            try:
                self.run_cycle()
            except Exception as e:
                log.error(f"Cycle {self.cycle} error: {e}")
                emit(
                    domain="agents",
                    event_type="AGENT_ERROR",
                    entity_id=self.entity_id,
                    payload={"cycle": self.cycle, "error": str(e)},
                )
            time.sleep(self.loop_interval)


if __name__ == "__main__":
    orchestrator = JarvisOrchestrator(
        entity_id=os.environ.get("JARVIS_ENTITY_ID", "jarvis-prime"),
        loop_interval=float(os.environ.get("JARVIS_LOOP_INTERVAL", "5.0")),
    )
    orchestrator.run()
