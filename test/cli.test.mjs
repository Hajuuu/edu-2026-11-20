import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs, TESTS } from '../scripts/lib/cli.mjs';
import { normalizeTool, TOOL_NAMES, TOOLS } from '../scripts/lib/tools.mjs';
import { homeDir, appDataDir, readJson, writeJson, run, mvnInvocation, IS_WIN } from '../scripts/lib/env.mjs';

const pick = (r) => ({ test: r.test, id: r.id, tool: r.tool });

test('explicit flags', () => {
  const r = parseArgs(['--test', 'nomcp', '--id', 'P01', '--tool', 'Codex'], {});
  assert.deepEqual(pick(r), { test: 'nomcp', id: 'P01', tool: 'Codex' });
  assert.deepEqual(r.errors, []);
});

test('equals form', () => {
  const r = parseArgs(['--test=mcp', '--id=P01', '--tool=claude'], {});
  assert.deepEqual(pick(r), { test: 'mcp', id: 'P01', tool: 'Claude-Code' });
  assert.deepEqual(r.errors, []);
});

test('npm swallowed', () => {
  const env = { npm_config_test: 'true', npm_config_id: 'true', npm_config_tool: 'true' };
  const r = parseArgs(['mcp', 'P01', 'Claude-Code'], env);
  assert.deepEqual(pick(r), { test: 'mcp', id: 'P01', tool: 'Claude-Code' });
  assert.deepEqual(r.errors, []);
});

test('npm swallowed reordered', () => {
  const env = { npm_config_test: 'true', npm_config_id: 'true', npm_config_tool: 'true' };
  const r = parseArgs(['Cursor', 'nomcp', 'P07'], env);
  assert.deepEqual(pick(r), { test: 'nomcp', id: 'P07', tool: 'Cursor' });
  assert.deepEqual(r.errors, []);
});

test('npm env values', () => {
  const env = { npm_config_test: 'nomcp', npm_config_id: 'P02', npm_config_tool: 'GitHub-Copilot' };
  const r = parseArgs([], env);
  assert.deepEqual(pick(r), { test: 'nomcp', id: 'P02', tool: 'GitHub-Copilot' });
  assert.deepEqual(r.errors, []);
});

test('flags', () => {
  const r = parseArgs(['--force', '--dry-run', '--test', 'mcp', '--id', 'P01', '--tool', 'cline'], {});
  assert.ok(r.flags.has('force'));
  assert.ok(r.flags.has('dry-run'));
  assert.equal(r.tool, 'Cline');
  assert.deepEqual(r.errors, []);
});

test('errors: missing tool', () => {
  const r = parseArgs(['--test', 'mcp', '--id', 'P01'], {});
  assert.ok(r.errors.some((e) => e.includes('--tool')));
});

test('errors: invalid id', () => {
  const r = parseArgs(['--test', 'mcp', '--id', 'p 01', '--tool', 'Codex'], {});
  assert.ok(r.errors.some((e) => e.includes('ID')));
});

test('errors: ambiguous leftovers', () => {
  const r = parseArgs(['mcp', 'A', 'B', 'Codex'], {});
  assert.ok(r.errors.length > 0);
  assert.ok(r.errors.some((e) => e.includes('--id')));
});

test('errors: value flag without value', () => {
  const r = parseArgs(['--test', 'mcp', '--tool', 'Codex', '--id'], {});
  assert.ok(r.errors.some((e) => e.includes('--id')));
});

test('errors: invalid test and tool values', () => {
  const r = parseArgs(['--test', 'x', '--id', 'P01', '--tool', 'vim'], {});
  assert.ok(r.errors.some((e) => e.includes('--test')));
  assert.ok(r.errors.some((e) => e.includes('--tool')));
});

test('TESTS order and tool metadata', () => {
  assert.deepEqual(TESTS, ['nomcp', 'mcp']);
  assert.deepEqual(TOOL_NAMES, ['Claude-Code', 'Codex', 'Antigravity', 'Cursor', 'GitHub-Copilot', 'Cline']);
  for (const n of TOOL_NAMES) assert.ok(TOOLS[n].doc && TOOLS[n].model && Array.isArray(TOOLS[n].aliases));
  assert.equal(normalizeTool('agy'), 'Antigravity');
  assert.equal(normalizeTool('GH_Copilot'), 'GitHub-Copilot');
  assert.equal(normalizeTool('vim'), null);
});

function withHome(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edu-env-'));
  const prev = process.env.EDU_HOME;
  process.env.EDU_HOME = dir;
  try { return fn(dir); } finally {
    if (prev === undefined) delete process.env.EDU_HOME; else process.env.EDU_HOME = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('homeDir and appDataDir honor EDU_HOME', () => {
  withHome((dir) => {
    assert.equal(homeDir(), dir);
    assert.ok(appDataDir().startsWith(dir));
  });
});

test('readJson missing, invalid, valid; writeJson creates folders', () => {
  withHome((dir) => {
    const f = path.join(dir, 'a', 'b', 'x.json');
    assert.deepEqual(readJson(f, { d: 1 }), { d: 1 });
    writeJson(f, { k: 1 });
    assert.equal(fs.readFileSync(f, 'utf8'), '{\n  "k": 1\n}\n');
    assert.deepEqual(readJson(f), { k: 1 });
    fs.writeFileSync(f, '{broken');
    const bad = readJson(f, {});
    assert.equal(bad.__invalid, true);
    assert.equal(typeof bad.error, 'string');
  });
});

test('run on a missing command does not throw', () => {
  const r = run('edu-no-such-command-xyz', ['--version']);
  assert.equal(r.status, null);
  assert.equal(r.stdout, '');
  assert.ok(r.error);
});

test('mvnInvocation shape', () => {
  const m = mvnInvocation();
  assert.equal(m.cmd, IS_WIN ? 'mvn.cmd' : 'mvn');
  assert.equal(m.shell, IS_WIN);
});
