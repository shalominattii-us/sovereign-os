from typing import List, Dict, Any
from datetime import datetime

class ThreatGraph:
    def __init__(self):
        self.threats = [
            {"id": "T01", "name": "Zero-Day Exploit", "vector": "Remote Code Execution", "severity": "CRITICAL"},
            {"id": "T02", "name": "Distributed Denial of Service", "vector": "Network Volumetric", "severity": "HIGH"},
            {"id": "T03", "name": "Credential Stuffing", "vector": "Authentication", "severity": "MEDIUM"},
            {"id": "T04", "name": "Man-in-the-Middle", "vector": "Interception", "severity": "HIGH"},
            {"id": "T05", "name": "SQL Injection", "vector": "Data Layer", "severity": "HIGH"}
        ]
        # Extending to represent the "Top 50" conceptually
        for i in range(6, 51):
            self.threats.append({
                "id": f"T{i:02d}",
                "name": f"Threat Vector {i}",
                "vector": "Algorithmic Anomaly",
                "severity": "VARIABLE"
            })

    def get_threat_by_id(self, threat_id: str):
        return next((t for t in self.threats if t["id"] == threat_id), None)

class SwarmDefense:
    def __init__(self, telemetry):
        self.telemetry = telemetry
        self.active_defense_nodes = []
        self.defense_log = []

    def deploy_swarm(self, threat_id: str, nodes: List[str]):
        self.active_defense_nodes = nodes
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "threat_id": threat_id,
            "action": "SWARM_DEPLOYED",
            "nodes": nodes,
            "status": "ENGAGED"
        }
        self.defense_log.append(event)
        self.telemetry.log_event("SWARM", f"Swarm deployed against {threat_id} using nodes: {', '.join(nodes)}")

    def neutralize_threat(self, threat_id: str):
        event = {
            "timestamp": datetime.utcnow().isoformat(),
            "threat_id": threat_id,
            "action": "NEUTRALIZED",
            "status": "SUCCESS"
        }
        self.defense_log.append(event)
        self.telemetry.log_event("SWARM", f"Threat {threat_id} NEUTRALIZED.", level="INFO")
        self.active_defense_nodes = []

    def get_forensic_trace(self) -> List[Dict[str, Any]]:
        return self.defense_log
