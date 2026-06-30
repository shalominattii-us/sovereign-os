# AEGENTIX CYBERNETICS Event Specification v1

**Version:** 1.0  
**Status:** Active  
**Author:** Mantis AI  

This document defines the canonical event contract for all inter-service communication within the Sovereign OS / AEGENTIX CYBERNETICS platform. 

Whether an event is emitted by WorldMonitor, Treasury, XR, Robotics, or an autonomous AI agent, it **must** conform to this specification. This ensures that the global event log (`events.jsonl`) remains durable, replayable, and uniformly traceable across the entire ecosystem.

---

## 1. Architectural Invariants

1. **The event log is authoritative.** The log is the single source of truth. All state is derived from the log.
2. **Events are immutable.** Once appended to the log, an event is never modified or deleted. If state needs to change, a new corrective event is appended.
3. **State is disposable.** In-memory state can be deleted at any time and deterministically reconstructed by replaying the log.
4. **Replay is isolated.** Replaying the log rebuilds in-memory state but **never** invokes external adapters or side effects (e.g., sending commands to robots or submitting exchange orders).

---

## 2. Event Structure

Every event is a flat JSON object consisting of three sections: **Envelope**, **Tracing**, and **Domain**.

### Example Event

```json
{
  "event_id": "bfcc9438-3097-4892-885e-20af46c63af9",
  "event_version": 1,
  "timestamp": 1782855560406,
  
  "trace_id": "tr-9a8b7c6d5e4f",
  "correlation_id": "cmd-12345",
  "source": "worldmonitor",
  "actor": "agent:planner",
  
  "domain": "robotics",
  "type": "MOVE_COMMAND",
  "entity_id": "robot-arm-01",
  "payload": {
    "approved": true,
    "force": 1,
    "action": "move",
    "position": [10, 20, 30]
  }
}
```

---

## 3. Field Definitions

### 3.1 Envelope (Required)

| Field | Type | Description |
|---|---|---|
| `event_id` | String (UUID) | A globally unique identifier for the event. |
| `event_version` | Integer | Schema version of the event. Currently `1`. |
| `timestamp` | Integer | Epoch timestamp in milliseconds when the event was emitted. |

### 3.2 Tracing & Origin (Required)

| Field | Type | Description |
|---|---|---|
| `trace_id` | String | A unique ID that groups a sequence of related events across multiple services. Auto-generated if not provided by the caller. |
| `correlation_id` | String \| null | ID of the specific command, intent, or request that triggered this event. |
| `source` | String | The service or subsystem that emitted the event (e.g., `worldmonitor`, `treasury`, `xr`). |
| `actor` | String \| null | The user, agent, or system that initiated the action (e.g., `agent:planner`, `user:admin`). |

### 3.3 Domain (Required)

| Field | Type | Description |
|---|---|---|
| `domain` | String | The bounded context the event belongs to (e.g., `robotics`, `treasury`, `xr`, `exchange`). |
| `type` | String | The specific action or state change (e.g., `MOVE_COMMAND`, `ASSET_REGISTERED`). Must be UPPER_SNAKE_CASE. |
| `entity_id` | String | The unique identifier of the specific entity being affected (e.g., `robot-arm-01`, `wallet-001`). |
| `payload` | Object | Domain-specific data required to apply the event to the world state or dispatch it to an adapter. |

---

## 4. Event Lifecycle

The lifecycle of an event during live operation is strictly ordered to guarantee recoverability and router isolation.

1. **Intent:** A request is received (e.g., via `POST /intent`).
2. **Validate:** The Policy Engine validates the intent against domain rules.
3. **Emit & Append:** The event is enriched with metadata (UUID, timestamp, trace_id) and appended to the immutable event log.
4. **Project:** The Projector applies the event to the in-memory world state.
5. **Dispatch:** The Router sends the event to external adapters (side effects).

During **Replay** (startup), the sequence is restricted:

1. **Read:** Events are read sequentially from the log.
2. **Project:** The Projector applies the events to rebuild in-memory state.
3. **STOP:** The Router is **never** invoked during replay.
