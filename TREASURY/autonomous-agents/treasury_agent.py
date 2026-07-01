"""
AEGENTIS CORPORATION - Autonomous Treasury Agent
Monitors treasury balances, triggers rebalancing, and emits financial events
to the Kernel Event Bus. Runs as a continuous TOTE loop.
"""

import os
import time
import json
import uuid
import requests
from datetime import datetime

KERNEL_URL = os.getenv("KERNEL_EVENT_BUS_URL", "http://kernel-event-bus:8080/intent")
AGENT_ID = os.getenv("TREASURY_AGENT_ID", "treasury-agent-prime")
LOOP_INTERVAL = float(os.getenv("TREASURY_LOOP_INTERVAL", "10.0"))

# Risk thresholds
MIN_LIQUIDITY_RATIO = 0.15  # 15% minimum liquid reserves
REBALANCE_THRESHOLD = 0.05  # Trigger rebalance if drift > 5%


def emit(event_type, payload, entity_id=None, trace_id=None):
    event = {
        "event_version": 1,
        "domain": "treasury",
        "type": event_type,
        "entity_id": entity_id or AGENT_ID,
        "source": "treasury-agent",
        "actor": f"agent:{AGENT_ID}",
        "trace_id": trace_id or str(uuid.uuid4()),
        "payload": payload
    }
    try:
        r = requests.post(KERNEL_URL, json=event, timeout=5)
        return r.json()
    except Exception as e:
        print(f"[TREASURY-AGENT] Emit failed: {e}")
        return None


def observe_treasury_state():
    """Observe current treasury balances via Kernel state API."""
    try:
        state_url = KERNEL_URL.replace("/intent", "/state")
        r = requests.get(state_url, timeout=5)
        state = r.json().get("state", {})
        return state.get("treasury", {})
    except Exception:
        return {}


def assess_risk(treasury_state):
    """Assess liquidity risk across all wallets."""
    risks = []
    for entity_id, data in treasury_state.items():
        assets = data.get("assets", {})
        total = sum(assets.values())
        liquid = assets.get("USD", 0) + assets.get("SOV", 0)
        if total > 0 and (liquid / total) < MIN_LIQUIDITY_RATIO:
            risks.append({
                "entity_id": entity_id,
                "liquidity_ratio": round(liquid / total, 4),
                "threshold": MIN_LIQUIDITY_RATIO,
                "severity": "HIGH"
            })
    return risks


def run():
    print(f"[TREASURY-AGENT] {AGENT_ID} starting — loop interval: {LOOP_INTERVAL}s")
    emit("AGENT_SPAWNED", {"version": "1.0.0", "loop_interval": LOOP_INTERVAL})

    cycle = 0
    while True:
        cycle += 1
        trace_id = str(uuid.uuid4())

        # OBSERVE
        treasury_state = observe_treasury_state()
        emit("TREASURY_OBSERVED", {
            "cycle": cycle,
            "wallet_count": len(treasury_state),
            "observed_at": datetime.utcnow().isoformat()
        }, trace_id=trace_id)

        # ASSESS RISK
        risks = assess_risk(treasury_state)
        if risks:
            for risk in risks:
                emit("LIQUIDITY_RISK_DETECTED", risk,
                     entity_id=risk["entity_id"], trace_id=trace_id)

        # DECIDE & ACT
        if not risks:
            emit("TREASURY_HEALTHY", {
                "cycle": cycle,
                "wallet_count": len(treasury_state),
                "status": "nominal"
            }, trace_id=trace_id)

        time.sleep(LOOP_INTERVAL)


if __name__ == "__main__":
    run()
