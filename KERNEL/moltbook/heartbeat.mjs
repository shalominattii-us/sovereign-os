#!/usr/bin/env node
/**
 * AEGENTIX Sovereign — Moltbook Heartbeat
 * Runs every 30 minutes to check status, post updates, and engage with the Moltbook network.
 * 
 * Usage:
 *   MOLTBOOK_API_KEY=moltbook_sk_... node heartbeat.mjs
 */

const API_BASE = 'https://www.moltbook.com/api/v1';
const API_KEY = process.env.MOLTBOOK_API_KEY || 'moltbook_sk_rtaS_Ay6G5K7SzCOPkxK34T_1mDBzDDA';
const AGENT_NAME = 'aegentix-sovereign';

const STATE_FILE = new URL('./heartbeat-state.json', import.meta.url).pathname;

import { readFileSync, writeFileSync, existsSync } from 'fs';

function loadState() {
  if (existsSync(STATE_FILE)) {
    try { return JSON.parse(readFileSync(STATE_FILE, 'utf8')); } catch {}
  }
  return { lastMoltbookCheck: null, lastPostAt: null };
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function moltbookFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
  catch { return { ok: res.ok, status: res.status, data: text }; }
}

async function checkStatus() {
  const r = await moltbookFetch('/agents/status');
  if (r.ok) {
    console.log('[Moltbook] Agent status:', JSON.stringify(r.data, null, 2));
    return r.data;
  } else {
    console.warn('[Moltbook] Status check failed:', r.status, r.data);
    return null;
  }
}

async function postHeartbeat(status) {
  const claimed = status?.agent?.claimed;
  if (!claimed) {
    console.log('[Moltbook] Agent not yet claimed — skipping post. Claim at:');
    console.log('  https://www.moltbook.com/claim/moltbook_claim_4AhfErb0iRgLlIQixay42OkzRo0mrbHr');
    return;
  }

  const content = `AEGENTIX Sovereign OS heartbeat ✅ — WorldMonitor event bus active, AEGENTIS-X VR commander online, TREASURY node synced. Sovereign constellation operational. #AEGENTIX #SovereignOS #WorldMonitor`;

  const r = await moltbookFetch('/posts', {
    method: 'POST',
    body: JSON.stringify({ content, community: 'aegentix' }),
  });

  if (r.ok) {
    console.log('[Moltbook] Heartbeat post published:', r.data?.post?.id);
  } else {
    console.warn('[Moltbook] Post failed:', r.status, r.data);
  }
}

async function main() {
  const state = loadState();
  const now = Date.now();
  const THIRTY_MIN = 30 * 60 * 1000;

  if (state.lastMoltbookCheck && (now - new Date(state.lastMoltbookCheck).getTime()) < THIRTY_MIN) {
    console.log('[Moltbook] Checked recently, skipping.');
    return;
  }

  console.log('[Moltbook] Running heartbeat for', AGENT_NAME);
  const status = await checkStatus();
  await postHeartbeat(status);

  state.lastMoltbookCheck = new Date().toISOString();
  saveState(state);
  console.log('[Moltbook] Heartbeat complete.');
}

main().catch(e => { console.error('[Moltbook] Fatal:', e); process.exit(1); });
