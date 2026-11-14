import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  LIMIT_MINUTES,
  participantPath,
  loadParticipant,
  saveParticipant,
  recordSetup,
  recordSubmit,
  lastSetupTest,
} from '../scripts/lib/participant.mjs';

const base = (over = {}) => ({
  id: 'hong',
  test: 'nomcp',
  tool: 'Codex',
  model: 'm',
  platform: 'darwin-arm64',
  versions: { node: '22' },
  warnings: [],
  now: new Date('2026-11-20T01:00:00Z'),
  ...over,
});
const min = (n) => new Date(new Date('2026-11-20T01:00:00Z').getTime() + n * 60000);

test('limits', () => {
  assert.deepEqual(LIMIT_MINUTES, { nomcp: 30, mcp: 20 });
});

test('first setup records nomcp run with 30 minute limit', () => {
  const p = recordSetup(null, base());
  assert.equal(p.id, 'hong');
  assert.equal(p.tool, 'Codex');
  assert.equal(p.runs.nomcp.setupAt, '2026-11-20T01:00:00.000Z');
  assert.equal(p.runs.nomcp.limitMinutes, 30);
  assert.equal(p.runs.nomcp.tool, 'Codex');
  assert.deepEqual(p.runs.nomcp.warnings, []);
});

test('re-setup before submit refreshes setupAt; input not mutated', () => {
  const p1 = recordSetup(null, base());
  const snap = JSON.stringify(p1);
  const p2 = recordSetup(p1, base({ now: min(5) }));
  assert.equal(JSON.stringify(p1), snap);
  assert.equal(p2.runs.nomcp.setupAt, min(5).toISOString());
});

test('re-setup after submit keeps setupAt', () => {
  const p1 = recordSetup(null, base());
  const p2 = recordSubmit(p1, { test: 'nomcp', now: min(10) });
  const p3 = recordSetup(p2, base({ now: min(20), tool: 'Cursor' }));
  assert.equal(p3.runs.nomcp.setupAt, '2026-11-20T01:00:00.000Z');
  assert.equal(p3.runs.nomcp.submittedAt, min(10).toISOString());
  assert.equal(p3.runs.nomcp.tool, 'Cursor');
});

test('submit after 35 minutes is over the limit', () => {
  const p1 = recordSetup(null, base());
  const p2 = recordSubmit(p1, { test: 'nomcp', now: min(35) });
  assert.equal(p2.runs.nomcp.elapsedMinutes, 35);
  assert.equal(p2.runs.nomcp.overLimit, true);
  assert.equal(p1.runs.nomcp.submittedAt, undefined);
  const p3 = recordSubmit(p1, { test: 'nomcp', now: new Date(min(0).getTime() + 12.34 * 60000) });
  assert.equal(p3.runs.nomcp.elapsedMinutes, 12.3);
  assert.equal(p3.runs.nomcp.overLimit, false);
});

test('mcp run has 20 minute limit', () => {
  const p = recordSetup(null, base({ test: 'mcp' }));
  assert.equal(p.runs.mcp.limitMinutes, 20);
  const s = recordSubmit(p, { test: 'mcp', now: min(21) });
  assert.equal(s.runs.mcp.overLimit, true);
});

test('submit without setupAt gives null elapsed', () => {
  const s = recordSubmit({ id: 'x', runs: { mcp: { limitMinutes: 20 } } }, { test: 'mcp', now: min(1) });
  assert.equal(s.runs.mcp.elapsedMinutes, null);
  assert.equal(s.runs.mcp.overLimit, false);
});

test('lastSetupTest picks latest setupAt', () => {
  assert.equal(lastSetupTest(null), null);
  let p = recordSetup(null, base());
  p = recordSetup(p, base({ test: 'mcp', now: min(40) }));
  assert.equal(lastSetupTest(p), 'mcp');
  p = recordSetup(p, base({ test: 'nomcp', now: min(50) }));
  assert.equal(lastSetupTest(p), 'nomcp');
});

test('recordSetup marks the run it prepared as current', () => {
  let p = recordSetup(null, base());
  assert.equal(p.current, 'nomcp');
  p = recordSetup(p, base({ test: 'mcp', now: min(40) }));
  assert.equal(p.current, 'mcp');
});

test('lastSetupTest follows the latest setup even when a submitted run keeps its setupAt', () => {
  let p = recordSetup(null, base());
  p = recordSubmit(p, { test: 'nomcp', now: min(25) });
  p = recordSetup(p, base({ test: 'mcp', now: min(40) }));
  assert.equal(lastSetupTest(p), 'mcp');
  p = recordSetup(p, base({ test: 'nomcp', now: min(50) }));
  assert.equal(p.runs.nomcp.setupAt, min(0).toISOString());
  assert.equal(lastSetupTest(p), 'nomcp');
});

test('lastSetupTest without a usable current falls back to the latest setupAt', () => {
  const runs = { nomcp: { setupAt: min(0).toISOString() }, mcp: { setupAt: min(40).toISOString() } };
  assert.equal(lastSetupTest({ runs }), 'mcp');
  assert.equal(lastSetupTest({ runs, current: 'other' }), 'mcp');
  assert.equal(lastSetupTest({ runs: { nomcp: runs.nomcp }, current: 'mcp' }), 'nomcp');
});

test('save and load round trip in a temp repo', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'part-'));
  assert.equal(loadParticipant('hong', root), null);
  const p = recordSetup(null, base());
  saveParticipant('hong', p, root);
  assert.equal(participantPath('hong', root), path.join(root, 'submissions', 'hong', 'participant.json'));
  assert.deepEqual(loadParticipant('hong', root), p);
});
