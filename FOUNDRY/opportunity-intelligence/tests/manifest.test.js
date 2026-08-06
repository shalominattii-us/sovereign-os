import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import {
  FOUNDRY_PLUGINS,
  loadFoundryManifest,
  validateFoundryManifest,
} from "../src/foundry.js";

const require = createRequire(import.meta.url);

test("Foundry manifest resolves every plugin, document, policy, schema, and entrypoint", async () => {
  const manifest = await loadFoundryManifest();
  assert.equal(manifest.foundry_id, "foundry.cybercore.opportunity-intelligence");
  assert.equal(manifest.plugins.length, 5);
  assert.deepEqual(
    manifest.plugins.map((plugin) => plugin.id),
    FOUNDRY_PLUGINS.map((plugin) => plugin.id),
  );
  assert.equal(new Set(manifest.plugins.map((plugin) => plugin.hook)).size, 5);
  assert.equal(manifest.output_engine.automatic_dispatch, false);
  assert.equal(manifest.output_engine.external_action_execution, false);
  assert.equal(manifest.safety.authorization_policy, "human_required");
});

test("Foundry manifest validation rejects automatic dispatch and plugin-order drift", async () => {
  const manifest = await loadFoundryManifest();
  const unsafe = structuredClone(manifest);
  unsafe.output_engine.automatic_dispatch = true;
  await assert.rejects(() => validateFoundryManifest(unsafe), /zero-automatic-dispatch/);

  const reordered = structuredClone(manifest);
  [reordered.plugins[0], reordered.plugins[1]] = [reordered.plugins[1], reordered.plugins[0]];
  await assert.rejects(() => validateFoundryManifest(reordered), /plugin order/);
});

test("central plugin registry advertises the executable Foundry composition", () => {
  const registry = require("../../../DEVELOPER/plugin-registry/registry.js");
  const plugin = registry.getPlugin("foundry.cybercore-opportunity-intelligence");

  assert.ok(plugin);
  assert.equal(plugin.manifest, "FOUNDRY/opportunity-intelligence/manifests/cybercore-opportunity-intelligence.plugin.json");
  assert.equal(plugin.entrypoint, "FOUNDRY/opportunity-intelligence/bin/aegentix_foundry_opportunity.js");
  assert.equal(plugin.hooks.length, 5);
  assert.ok(plugin.capabilities.includes("maturity-output"));
  assert.deepEqual(
    registry.getPluginsForHook("foundry.opportunity.emit-output").map((item) => item.pluginId),
    ["foundry.cybercore-opportunity-intelligence"],
  );
});
