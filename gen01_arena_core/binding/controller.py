from typing import List, Dict, Any
from ..tokens.operational import (
    ArenaEntryToken, ComputeCycleToken, NanotransactionToken,
    ThreatResponseToken, SwarmMergeToken, EscrowWalletToken, IncursionAccessToken
)
from .telemetry import ArenaTelemetry, HeartbeatLoop

class ArenaCore:
    def __init__(self, arena_id: str):
        self.arena_id = arena_id
        self.tokens: Dict[str, Any] = {}
        self.is_ignited = False
        self.is_active = False
        self.telemetry = ArenaTelemetry(arena_id)
        self.loops: List[HeartbeatLoop] = []

    def initialize_tokens(self, config: Dict[str, Any]):
        """Instantiate the 7 operational token environments"""
        self.tokens['AET'] = ArenaEntryToken(
            permissions=config.get('permissions', ['root']),
            risk_envelope=config.get('risk', {'max_compute': 10000})
        )
        self.tokens['CCT'] = ComputeCycleToken(total_cycles=config.get('cycles', 1000000))
        self.tokens['NTX'] = NanotransactionToken(currency=config.get('currency', 'SOV'))
        self.tokens['TRT'] = ThreatResponseToken(threat_graph_ref=config.get('threat_graph', 'SOV-GRAPH-01'))
        self.tokens['SMT'] = SwarmMergeToken(node_id=config.get('node_id', 'NODE-ALPHA'))
        self.tokens['EWT'] = EscrowWalletToken(contract_address=config.get('vault', '0xSOVEREIGN_VAULT'))
        self.tokens['IAT'] = IncursionAccessToken(user_id=config.get('user_id', 'HEMPEROR'))

    def bind_all(self):
        """Bind tokens to the arena substrate"""
        results = {}
        for key, token in self.tokens.items():
            success = token.bind_to_arena(self.arena_id)
            results[key] = "BOUND" if success else "FAILED"
        return results

    def ignite(self):
        """Execute the ignition sequence"""
        if not self.tokens:
            raise Exception("Tokens not initialized")
        
        self.telemetry.log_event("CORE", "Executing Ignition Sequence...")
        binding_matrix = self.bind_all()
        self.is_ignited = True
        self.telemetry.log_event("CORE", "Ignition Complete.")
        return binding_matrix

    def activate(self):
        """Execute GEN-02: Arena Activation"""
        if not self.is_ignited:
            raise Exception("System must be ignited before activation")
        
        self.telemetry.log_event("CORE", "Starting GEN-02 Activation...")
        
        # 1. NTX Heartbeat (100ms)
        ntx_loop = HeartbeatLoop("NTX-HEARTBEAT", 0.1, self._ntx_tick)
        ntx_loop.start()
        self.loops.append(ntx_loop)
        
        # 2. CCT Compute Loop (500ms)
        cct_loop = HeartbeatLoop("CCT-COMPUTE", 0.5, self._cct_tick)
        cct_loop.start()
        self.loops.append(cct_loop)
        
        self.is_active = True
        self.telemetry.log_event("CORE", "Arena Activated. Operational loops running.")
        self.telemetry.update_metric("active_loops", [l.name for l in self.loops])

    def _ntx_tick(self):
        ntx = self.tokens.get('NTX')
        if ntx:
            ntx.state['transaction_count'] += 1
            self.telemetry.update_metric("heartbeats", self.telemetry.get_snapshot()["heartbeats"] + 1)

    def _cct_tick(self):
        cct = self.tokens.get('CCT')
        if cct:
            cct.state['consumed_cycles'] += 100
            cct.state['available_cycles'] -= 100

    def get_ignition_matrix(self):
        return {
            "arena_id": self.arena_id,
            "status": "ACTIVE" if self.is_ignited else "PENDING",
            "token_bindings": {k: v.get_status() for k, v in self.tokens.items()},
            "unresolved_placeholders": [k for k, v in self.tokens.items() if not v.validate()],
            "active_compute_channels": ["LOCAL-OLLAMA", "ULLT-NETWORK"] if self.is_ignited else []
        }
