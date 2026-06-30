import express from "express";
import { replay } from "./src/events/replay.js";
import { log } from "./src/core/logger.js";

import intentRouter from "./src/api/intent.js";
import stateRouter  from "./src/api/state.js";
import healthRouter, { setReplayManifest } from "./src/api/health.js";

const PORT = process.env.PORT || 8080;

// ─── Startup: Replay persisted events to rebuild world state ─────────────────
// replay() is the constitutional entry point. It reads events.jsonl,
// applies every event through the projector, and returns a manifest
// describing what was loaded. The manifest is exposed via GET /health.
const manifest = replay();
setReplayManifest(manifest);

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.use("/intent", intentRouter);
app.use("/state",  stateRouter);
app.use("/health", healthRouter);

app.listen(PORT, () => {
  log("info", `WorldMonitor v0.3 LIVE`, { port: PORT, replayStatus: manifest.status });
});
