import time
import threading
from typing import Dict, Any, List
from datetime import datetime

class ArenaTelemetry:
    def __init__(self, arena_id: str):
        self.arena_id = arena_id
        self.metrics: Dict[str, Any] = {
            "start_time": datetime.utcnow().isoformat(),
            "heartbeats": 0,
            "active_loops": [],
            "alerts": []
        }
        self.is_running = False
        self._lock = threading.Lock()

    def log_event(self, component: str, message: str, level: str = "INFO"):
        with self._lock:
            event = {
                "timestamp": datetime.utcnow().isoformat(),
                "component": component,
                "message": message,
                "level": level
            }
            if level == "ALERT":
                self.metrics["alerts"].append(event)
            print(f"[{level}] {component}: {message}")

    def update_metric(self, key: str, value: Any):
        with self._lock:
            self.metrics[key] = value

    def get_snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return self.metrics.copy()

class HeartbeatLoop:
    def __init__(self, name: str, interval: float, callback):
        self.name = name
        self.interval = interval
        self.callback = callback
        self.thread = None
        self.stop_event = threading.Event()

    def _run(self):
        while not self.stop_event.is_set():
            self.callback()
            time.sleep(self.interval)

    def start(self):
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join()
