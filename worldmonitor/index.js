import express from "express";
import { loadEvents } from "./src/events/eventStore.js";
import { eventLog } from "./src/core/eventBus.js";
import { apply } from "./src/state/projector.js";
import { log } from "./src/core/logger.js";

import intentRouter from "./src/api/intent.js";
import stateRouter  from "./src/api/state.js";
import healthRouter from "./src/api/health.js";

const PORT = process.env.PORT || 8080;

// ─── Startup: Replay persisted events to rebuild world state ─────────────────
const persisted = loadEvents();
if (persisted.length > 0) {
  log("info", `Replaying ${persisted.length} persisted events from disk...`);
  for (const event of persisted) {
    eventLog.push(event);   // restore in-memory log
    apply(event);            // rebuild world state
  }
  log("info", "Replay complete. World state restored.", { eventCount: persisted.length });
} else {
  log("info", "No persisted events found. Starting with empty world state.");
}

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.use("/intent", intentRouter);
app.use("/state",  stateRouter);
app.use("/health", healthRouter);

app.listen(PORT, () => {
  log("info", `WorldMonitor v0.2 LIVE`, { port: PORT });
});
