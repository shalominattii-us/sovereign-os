import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.resolve(__dirname, "../../data/events.jsonl");

/**
 * Ensure the data directory and events file exist.
 */
function ensureStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) fs.writeFileSync(STORE_PATH, "");
}

/**
 * Append a single event as a JSON line to the event store.
 * This is the only write operation — the log is append-only.
 *
 * @param {Object} event - Enriched event object
 */
export function appendEvent(event) {
  ensureStore();
  fs.appendFileSync(STORE_PATH, JSON.stringify(event) + "\n", "utf8");
}

/**
 * Read all persisted events from disk and return them as an array.
 * Used at startup for state replay.
 *
 * @returns {Object[]} - Array of event objects in chronological order
 */
export function loadEvents() {
  ensureStore();
  const raw = fs.readFileSync(STORE_PATH, "utf8").trim();
  if (!raw) return [];

  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;  // skip malformed lines
      }
    })
    .filter(Boolean);
}

/**
 * Return the path to the event store file (useful for health checks).
 */
export function getStorePath() {
  return STORE_PATH;
}
