/**
 * Structured logger for WorldMonitor.
 * Outputs JSON-formatted log lines to stdout for easy ingestion by
 * CloudWatch, Datadog, or any log aggregator.
 *
 * @param {"info"|"warn"|"error"} level
 * @param {string} message
 * @param {Object} [meta]
 */
export function log(level, message, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  console.log(JSON.stringify(entry));
}
