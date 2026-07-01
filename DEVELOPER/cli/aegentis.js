#!/usr/bin/env node
/**
 * AEGENTIS CORPORATION - Developer CLI
 * The command-line interface for AEGENTIX CYBERNETICS.
 * Interact with the Kernel, Treasury, AI, XR, and all divisions.
 */

const KERNEL_URL = process.env.KERNEL_EVENT_BUS_URL || 'http://localhost:8080';

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${KERNEL_URL}${path}`, opts);
    return await res.json();
  } catch (e) {
    return { error: e.message };
  }
}

const commands = {
  async health() {
    const data = await request('GET', '/health');
    console.log('\n[AEGENTIS KERNEL] Health Status');
    console.log('================================');
    console.log(`  Version:       ${data.version}`);
    console.log(`  Uptime:        ${Math.round((data.uptime || 0) / 1000)}s`);
    console.log(`  Events stored: ${data.eventCount}`);
    if (data.replay) {
      console.log(`  Replay status: ${data.replay.status}`);
      console.log(`  Events applied: ${data.replay.applied}`);
    }
    console.log('');
  },

  async state() {
    const data = await request('GET', '/state');
    console.log('\n[AEGENTIS KERNEL] World State');
    console.log('==============================');
    console.log(JSON.stringify(data, null, 2));
  },

  async emit(domain, type, entityId, ...rest) {
    const payload = rest.length ? JSON.parse(rest.join(' ')) : {};
    const data = await request('POST', '/intent', {
      domain, type, entity_id: entityId, payload,
      source: 'aegentis-cli', actor: 'cli:developer'
    });
    console.log('\n[AEGENTIS KERNEL] Event Emitted');
    console.log('================================');
    console.log(JSON.stringify(data, null, 2));
  },

  async divisions() {
    const divisions = [
      'KERNEL', 'TREASURY', 'FINANCE', 'AI', 'XR',
      'CLOUD', 'DATA', 'SECURITY', 'DEVELOPER', 'ECOSYSTEM'
    ];
    console.log('\n[AEGENTIX CYBERNETICS] Divisions');
    console.log('=================================');
    divisions.forEach(d => console.log(`  • AEGENTIS ${d}`));
    console.log('');
  },

  help() {
    console.log(`
AEGENTIS CLI — AEGENTIX CYBERNETICS

Usage:
  aegentis <command> [args]

Commands:
  health                          Check Kernel health and replay status
  state                           Get current world state
  emit <domain> <type> <entityId> [payload_json]
                                  Emit an intent to the Kernel
  divisions                       List all AEGENTIS divisions
  help                            Show this help

Environment:
  KERNEL_EVENT_BUS_URL            Kernel URL (default: http://localhost:8080)

Examples:
  aegentis health
  aegentis state
  aegentis emit robotics MOVE_COMMAND robot-arm-01 '{"action":"move","position":[10,20,30],"approved":true,"force":1}'
  aegentis emit treasury DEPOSIT_RECORDED wallet-001 '{"asset":"USD","amount":1000}'
`);
  }
};

async function main() {
  const [,, cmd, ...args] = process.argv;
  if (!cmd || !commands[cmd]) {
    commands.help();
    process.exit(0);
  }
  await commands[cmd](...args);
}

main().catch(e => {
  console.error('[AEGENTIS CLI] Error:', e.message);
  process.exit(1);
});
