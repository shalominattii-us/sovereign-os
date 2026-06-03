import sys
import json
from gen01_arena_core.binding.controller import ArenaCore

def execute_ignition():
    print("------------------------------------------------------------------")
    print("AMENDMENT TO ACTIVE DIRECTIVE: EXECUTE FULL GEN-01 ARENA IGNITION")
    print("------------------------------------------------------------------")
    print("[+] Initializing GEN01 ARENA CORE...")

    # Configuration for the ignition
    config = {
        "permissions": ["sovereign-core", "compute-admin", "swarm-master"],
        "risk": {"max_compute": 50000, "risk_level": "low"},
        "cycles": 100000000,
        "currency": "SOV",
        "threat_graph": "ACTIVE-THREAT-GRAPH-v1",
        "node_id": "SOV-NODE-01",
        "vault": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
        "user_id": "HEMPEROR"
    }

    # Instantiate the Arena Core
    arena = ArenaCore(arena_id="SOV-ARENA-PRIME")

    # Step 1: Initialize Token Environments
    arena.initialize_tokens(config)
    print("[+] 7 Operational Token Environments Instantiated.")

    # Step 2: Bind & Ignite
    binding_matrix = arena.ignite()
    print("[+] Tokens bound to SOV.AE substrate.")

    # Step 3: GEN-02 Activation
    print("\n[+] Executing GEN-02: ARENA ACTIVATION...")
    arena.activate()
    
    # Allow some time for loops to run
    import time
    print("[+] Monitoring heartbeats (2 seconds)...")
    time.sleep(2)

    # Step 4: Generate Activation Report
    matrix = arena.get_ignition_matrix()
    telemetry = arena.telemetry.get_snapshot()
    
    print("\n" + "="*40)
    print("       ARENA ACTIVATION REPORT (GEN-02)")
    print("="*40)
    print(f"Arena ID:    {matrix['arena_id']}")
    print(f"Core Status: {matrix['status']}")
    print(f"Operational: {'YES' if arena.is_active else 'NO'}")
    print("-" * 40)
    print(f"Heartbeats:  {telemetry['heartbeats']}")
    print(f"Active Loops: {', '.join(telemetry['active_loops'])}")
    
    print("-" * 40)
    print("TOKEN STATE UPDATES:")
    ntx = matrix['token_bindings']['NTX']
    cct = matrix['token_bindings']['CCT']
    print(f"  - NTX Transactions: {ntx['state']['transaction_count']}")
    print(f"  - CCT Cycles Consumed: {cct['state']['consumed_cycles']}")
    
    print("-" * 40)
    print("ACTIVE COMPUTE CHANNELS:")
    for channel in matrix['active_compute_channels']:
        print(f"  - {channel}")
    
    print("-" * 40)
    print("UNRESOLVED PLACEHOLDERS:")
    if not matrix['unresolved_placeholders']:
        print("  - NONE (Clean Boot)")
    else:
        for p in matrix['unresolved_placeholders']:
            print(f"  - {p}")
    print("="*40)

if __name__ == "__main__":
    execute_ignition()
