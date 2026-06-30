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
 *
 * This is the ONLY write operation on the log.
 * The log is append-only and immutable — events are never edited or deleted.
 * If something changes in the world, a new corrective event is appended.
 *
 * @param {Object} event - Enriched event object
 */
export function appendEvent(event) {
  ensureStore();
  fs.appendFileSync(STORE_PATH, JSON.stringify(event) + "\n", "utf8");
}

/**
 * Read all persisted events from disk.
 *
 * Returns a structured result so callers (replay.js) can report on
 * data integrity. Malformed lines are counted and skipped rather than
 * throwing, so a single corrupt line cannot prevent system startup.
 *
 * @returns {{ events: Object[], skipped: number }}
 */
export function loadEvents() {
  ensureStore();
  const raw = fs.readFileSync(STORE_PATH, "utf8").trim();
  if (!raw) return { events: [], skipped: 0 };

  let skipped = 0;
  const events = raw
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        skipped++;
        return null;
      }
    })
    .filter(Boolean);

  return { events, skipped };
}

/**
 * Return the number of lines (events) currently in the store.
 * Reads the file synchronously — intended for health checks and tests only.
 *
 * @returns {number}
 */
export function getEventCount() {
  ensureStore();
  const raw = fs.readFileSync(STORE_PATH, "utf8").trim();
  if (!raw) return 0;
  return raw.split("\n").filter(Boolean).length;
}

/**
 * Return the path to the event store file (useful for health checks).
 */
export function getStorePath() {
  return STORE_PATH;
}
