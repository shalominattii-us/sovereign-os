"""
AEGENTIS CORPORATION - Autonomous Agent Base Class
All AEGENTIS AI agents inherit from this class.
Implements the TOTE (Test-Operate-Test-Exit) cognitive loop.
"""

import os
import time
import uuid
import requests
from abc import ABC, abstractmethod
from datetime import datetime

KERNEL_URL = os.getenv("KERNEL_EVENT_BUS_URL", "http://kernel-event-bus:8080/intent")


class AegentisAgent(ABC):
    def __init__(self, agent_id: str, division: str, loop_interval: float = 5.0):
        self.agent_id = agent_id
        self.division = division
        self.loop_interval = loop_interval
        self.cycle = 0
        self.memory = {}
        self.is_running = False

    def emit(self, event_type: str, payload: dict, trace_id: str = None):
        """Emit an event to the Kernel Event Bus."""
        event = {
            "event_version": 1,
            "domain": self.division.lower(),
            "type": event_type,
            "entity_id": self.agent_id,
            "source": f"aegentis-{self.division.lower()}",
            "actor": f"agent:{self.agent_id}",
            "trace_id": trace_id or str(uuid.uuid4()),
            "payload": payload
        }
        try:
            r = requests.post(KERNEL_URL, json=event, timeout=5)
            return r.json()
        except Exception as e:
            print(f"[{self.agent_id}] Emit failed: {e}")
            return None

    def get_world_state(self) -> dict:
        """Read current world state from the Kernel."""
        try:
            r = requests.get(KERNEL_URL.replace("/intent", "/state"), timeout=5)
            return r.json().get("state", {})
        except Exception:
            return {}

    @abstractmethod
    def observe(self, world_state: dict) -> dict:
        """Observe the world and return an observation."""
        pass

    @abstractmethod
    def decide(self, observation: dict) -> dict:
        """Decide on an action based on the observation."""
        pass

    @abstractmethod
    def execute(self, decision: dict) -> dict:
        """Execute the decided action."""
        pass

    def run(self):
        """Start the TOTE cognitive loop."""
        self.is_running = True
        self.emit("AGENT_SPAWNED", {
            "division": self.division,
            "loop_interval": self.loop_interval,
            "spawned_at": datetime.utcnow().isoformat()
        })
        print(f"[{self.agent_id}] TOTE loop started")

        while self.is_running:
            self.cycle += 1
            trace_id = str(uuid.uuid4())

            # OBSERVE
            world_state = self.get_world_state()
            observation = self.observe(world_state)
            self.emit("OBSERVATION_RECORDED", {
                "cycle": self.cycle,
                "observation": observation
            }, trace_id=trace_id)

            # DECIDE
            decision = self.decide(observation)
            self.emit("DECISION_MADE", {
                "cycle": self.cycle,
                "decision": decision
            }, trace_id=trace_id)

            # EXECUTE
            result = self.execute(decision)
            self.emit("EXECUTION_DISPATCHED", {
                "cycle": self.cycle,
                "result": result
            }, trace_id=trace_id)

            time.sleep(self.loop_interval)

    def stop(self):
        self.is_running = False
        self.emit("AGENT_STOPPED", {"cycle": self.cycle})
