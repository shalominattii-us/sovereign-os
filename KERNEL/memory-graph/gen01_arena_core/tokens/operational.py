from .base import AegenticToken
from typing import Dict, Any

class ArenaEntryToken(AegenticToken):
    def __init__(self, permissions: list, risk_envelope: Dict[str, Any]):
        super().__init__("Arena-Entry", "AET")
        self.state = {
            "permissions": permissions,
            "risk_envelope": risk_envelope,
            "budget_limit": risk_envelope.get("max_compute", 1000)
        }

    def bind_to_arena(self, arena_id: str):
        self.state["bound_arena"] = arena_id
        return True

    def validate(self) -> bool:
        return "permissions" in self.state and "risk_envelope" in self.state

class ComputeCycleToken(AegenticToken):
    def __init__(self, total_cycles: int):
        super().__init__("Compute-Cycle", "CCT")
        self.state = {
            "available_cycles": total_cycles,
            "consumed_cycles": 0,
            "tick_rate": "1ms"
        }

    def bind_to_arena(self, arena_id: str):
        self.state["compute_target"] = arena_id
        return True

    def validate(self) -> bool:
        return self.state["available_cycles"] > 0

class NanotransactionToken(AegenticToken):
    def __init__(self, currency: str = "SOV"):
        super().__init__("Nanotransaction", "NTX")
        self.state = {
            "currency": currency,
            "heartbeat_interval": "100ms",
            "transaction_count": 0
        }

    def bind_to_arena(self, arena_id: str):
        self.state["market_id"] = f"MARKET-{arena_id}"
        return True

    def validate(self) -> bool:
        return "currency" in self.state

class ThreatResponseToken(AegenticToken):
    def __init__(self, threat_graph_ref: str):
        super().__init__("Threat-Response", "TRT")
        self.state = {
            "threat_graph": threat_graph_ref,
            "active_defenses": [],
            "anomaly_threshold": 0.85
        }

    def bind_to_arena(self, arena_id: str):
        self.state["protection_zone"] = arena_id
        return True

    def validate(self) -> bool:
        return "threat_graph" in self.state

class SwarmMergeToken(AegenticToken):
    def __init__(self, node_id: str):
        super().__init__("Swarm-Merge", "SMT")
        self.state = {
            "primary_node": node_id,
            "memory_fabric_id": None,
            "merge_policy": "consensus"
        }

    def bind_to_arena(self, arena_id: str):
        self.state["swarm_id"] = f"SWARM-{arena_id}"
        return True

    def validate(self) -> bool:
        return "primary_node" in self.state

class EscrowWalletToken(AegenticToken):
    def __init__(self, contract_address: str, stablecoin: str = "USDC"):
        super().__init__("Escrow-Wallet", "EWT")
        self.state = {
            "vault_address": contract_address,
            "asset": stablecoin,
            "locked_value": 0,
            "status": "locked"
        }

    def bind_to_arena(self, arena_id: str):
        self.state["escrow_id"] = f"ESCROW-{arena_id}"
        return True

    def validate(self) -> bool:
        return self.state["vault_address"].startswith("0x")

class IncursionAccessToken(AegenticToken):
    def __init__(self, user_id: str):
        super().__init__("Incursion-Access", "IAT")
        self.state = {
            "operator_id": user_id,
            "xr_portal_link": "meta-horizon://portal",
            "presence_status": "offline"
        }

    def bind_to_arena(self, arena_id: str):
        self.state["portal_session"] = f"SESSION-{arena_id}"
        return True

    def validate(self) -> bool:
        return "operator_id" in self.state
