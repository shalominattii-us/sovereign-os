import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { publishOutputIndex } from "../src/adapters/event_stream.js";

const INDEX = {
  schema_version: "aegentix.foundry.opportunity-output-index.v1",
  output_run_id: "foundry_output_run_0123456789abcdef01234567",
  generated_at: "2026-08-06T18:00:00.000Z",
  total_outputs: 22,
  human_review_required: 5,
  automatic_dispatches: 0,
  external_actions_executed: 0,
  by_maturity: { HUMAN_REVIEW: 5, CLOSED: 7 },
  by_disposition: { REQUIRES_HUMAN_DECISION: 5 },
  files: [{ record_id: "sensitive-record-not-for-stream" }],
  artifact_hash: "a".repeat(64),
};

async function withServer(handler, callback) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("stream adapter publishes aggregate metadata only when explicitly configured", async () => {
  let received = null;
  const result = await withServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      received = JSON.parse(body);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true, topic: received.topic }));
    });
  }, (streamUrl) => publishOutputIndex(INDEX, { streamUrl, required: true }));

  assert.equal(result.published, true);
  assert.equal(received.topic, "foundry.opportunity-intelligence.output");
  assert.equal(received.event.total_outputs, 22);
  assert.equal(received.event.automatic_dispatches, 0);
  assert.equal(received.event.external_actions_executed, 0);
  assert.equal("files" in received.event, false);
  assert.equal(JSON.stringify(received).includes("sensitive-record-not-for-stream"), false);
});

test("stream adapter is disabled by default and fails closed only when required", async () => {
  const disabled = await publishOutputIndex(INDEX);
  assert.equal(disabled.configured, false);
  assert.equal(disabled.attempted, false);

  await withServer((_request, response) => {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ ok: false }));
  }, async (streamUrl) => {
    const optional = await publishOutputIndex(INDEX, { streamUrl, required: false });
    assert.equal(optional.published, false);
    await assert.rejects(
      () => publishOutputIndex(INDEX, { streamUrl, required: true }),
      /rejected publication/,
    );
  });
});

test("non-local HTTP stream endpoints are rejected", async () => {
  await assert.rejects(
    () => publishOutputIndex(INDEX, { streamUrl: "http://example.com", required: true }),
    /must use HTTPS/,
  );
});
