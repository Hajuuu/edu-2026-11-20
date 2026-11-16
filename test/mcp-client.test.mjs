import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '../scripts/lib/env.mjs';
import { codegenServer } from '../scripts/lib/bundle.mjs';
import { callTool, listTools, scaffoldBoard, BOARD_DDL } from '../scripts/lib/mcp-client.mjs';
import { parseSlug } from '../scripts/lib/git.mjs';

function tmp(p) {
  return fs.mkdtempSync(path.join(os.tmpdir(), p));
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

// MCP 연결 설정과 같은 node 명령으로 저장소의 .mcp-servers/ 에 푼 codegen 패키지를 띄운다.
const server = codegenServer();
const nodeScript = (file) => ({ command: process.execPath, args: [file] });

test('list tools through node', { timeout: 60000 }, async () => {
  const tools = await listTools(server, { timeoutMs: 60000 });
  assert.deepEqual(
    [...tools].sort(),
    ['egov_add_attach_file_infrastructure', 'egov_add_entity', 'egov_add_query_view', 'egov_scaffold_project'],
  );
});

test('scaffold board', { timeout: 120000 }, async () => {
  const out = tmp('mcp-client-out-');
  const r = await scaffoldBoard(server, out);
  assert.equal(r.isError, false, r.text);
  assert.ok(fs.existsSync(path.join(out, 'board-app', 'pom.xml')));
  const hit = findFile(path.join(out, 'board-app', 'src', 'main', 'java'), (p) => /Board/.test(fs.readFileSync(p, 'utf8')));
  assert.ok(hit);
  fs.rmSync(out, { recursive: true, force: true });
});

test('unknown tool', { timeout: 60000 }, async () => {
  const r = await callTool(server, 'no_such_tool_xyz', {}, { timeoutMs: 30000 });
  assert.equal(r.isError, true);
});

test('timeout rejects', { timeout: 20000 }, async () => {
  const stub = path.join(tmp('mcp-stub-'), 'stub.mjs');
  fs.writeFileSync(stub, 'setInterval(() => {}, 1000);\n');
  await assert.rejects(callTool(nodeScript(stub), 'x', {}, { timeoutMs: 500 }), /초/);
});

test('early exit rejects with stderr', { timeout: 20000 }, async () => {
  const stub = path.join(tmp('mcp-stub-'), 'stub.mjs');
  fs.writeFileSync(stub, 'console.error("boom-detail"); process.exit(3);\n');
  await assert.rejects(callTool(nodeScript(stub), 'x', {}, { timeoutMs: 10000 }), /boom-detail/);
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

test('missing command rejects with the command name', { timeout: 20000 }, async () => {
  await assert.rejects(callTool({ command: 'edu-no-such-command-xyz', args: [] }, 'x', {}, { timeoutMs: 10000 }), /edu-no-such-command-xyz/);
});
