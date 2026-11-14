import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '../scripts/lib/env.mjs';
import { installBundle } from '../scripts/lib/bundle.mjs';
import { callTool, scaffoldBoard, BOARD_DDL } from '../scripts/lib/mcp-client.mjs';
import { parseSlug } from '../scripts/lib/git.mjs';

function tmp(p) {
  return fs.mkdtempSync(path.join(os.tmpdir(), p));
}

function fakeRepo() {
  const root = tmp('mcp-client-repo-');
  const src = path.join(REPO_ROOT, 'mcp', 'egovframe-mcp-codegen');
  const dst = path.join(root, 'mcp', 'egovframe-mcp-codegen');
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) if (f.endsWith('.tgz')) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  return root;
}

function findFile(dir, pred) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const r = findFile(p, pred);
      if (r) return r;
    } else if (pred(p)) return p;
  }
  return null;
}

const root = fakeRepo();
const { entry } = installBundle('codegen', { repoRoot: root });

test('scaffold board', { timeout: 120000 }, async () => {
  const out = tmp('mcp-client-out-');
  const r = await scaffoldBoard(entry, out);
  assert.equal(r.isError, false, r.text);
  assert.ok(fs.existsSync(path.join(out, 'board-app', 'pom.xml')));
  const hit = findFile(path.join(out, 'board-app', 'src', 'main', 'java'), (p) => /Board/.test(fs.readFileSync(p, 'utf8')));
  assert.ok(hit);
  fs.rmSync(out, { recursive: true, force: true });
});

test('unknown tool', { timeout: 60000 }, async () => {
  const r = await callTool(entry, 'no_such_tool_xyz', {}, { timeoutMs: 30000 });
  assert.equal(r.isError, true);
});

test('timeout rejects', { timeout: 20000 }, async () => {
  const stub = path.join(tmp('mcp-stub-'), 'stub.mjs');
  fs.writeFileSync(stub, 'setInterval(() => {}, 1000);\n');
  await assert.rejects(callTool(stub, 'x', {}, { timeoutMs: 500 }), /초/);
});

test('early exit rejects with stderr', { timeout: 20000 }, async () => {
  const stub = path.join(tmp('mcp-stub-'), 'stub.mjs');
  fs.writeFileSync(stub, 'console.error("boom-detail"); process.exit(3);\n');
  await assert.rejects(callTool(stub, 'x', {}, { timeoutMs: 10000 }), /boom-detail/);
});

test('BOARD_DDL matches task/TASK.md', () => {
  const md = fs.readFileSync(path.join(REPO_ROOT, 'task', 'TASK.md'), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(md.includes(BOARD_DDL));
});

test('parseSlug URL forms', () => {
  assert.equal(parseSlug('https://github.com/a/b.git'), 'a/b');
  assert.equal(parseSlug('https://github.com/a/b'), 'a/b');
  assert.equal(parseSlug('git@github.com:a/b.git'), 'a/b');
  assert.equal(parseSlug('ssh://git@github.com/a/b.git'), 'a/b');
  assert.equal(parseSlug('https://gitlab.com/a/b'), null);
  assert.equal(parseSlug(''), null);
});
