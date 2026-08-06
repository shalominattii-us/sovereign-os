import { createHash } from "node:crypto";

export function normalizeWhitespace(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).normalize("NFKC").trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

export function canonicalToken(value, fallback = "unknown") {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return fallback;
  return normalized
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "-") || fallback;
}

export function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

export function titleHash(title) {
  return sha256(canonicalToken(title)).slice(0, 24);
}

export function buildDeduplicationKey({ issuer, identifier, title, deadline }) {
  const hash = titleHash(title);
  return [
    canonicalToken(issuer),
    canonicalToken(identifier),
    hash,
    canonicalToken(deadline),
  ].join("|");
}

export function opportunityIdFromKey(deduplicationKey) {
  return `opp_${sha256(deduplicationKey).slice(0, 24)}`;
}

export function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function artifactHash(value) {
  return sha256(stableStringify(value));
}

export function uniqueStrings(values) {
  const result = [];
  const seen = new Set();
  for (const value of values ?? []) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    const key = normalized.toLocaleLowerCase("en-US");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function isoTimestamp(value = new Date()) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function normalizeIsoDate(value) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.valueOf())) return normalized;
  return date.toISOString().slice(0, 10);
}
