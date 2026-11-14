import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanGlobalMcp, findInstructionLeaks, removalHint } from '../scripts/lib/guard.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
const put = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof text === 'string' ? text : JSON.stringify(text));
};

test('codex toml: enabled, disabled, other', () => {
  const home = tmp();
  const f = path.join(home, '.codex', 'config.toml');
  put(f, '[mcp_servers.egovframe-codegen]\ncommand = "node"\n[mcp_servers."other"]\ncommand = "x"\n[mcp_servers.other.env]\nA = "1"\n');
  const ctx = { home, appData: home, env: {}, runDir: home };
  let hits = scanGlobalMcp('Codex', ctx);
  assert.deepEqual(hits.map((h) => [h.name, h.enabled, h.codegen]), [
    ['egovframe-codegen', true, true],
    ['other', true, false],
  ]);
  assert.equal(hits[0].source, f);
  put(f, '[mcp_servers.egovframe-codegen]\ncommand = "node"\nenabled = false\n');
  hits = scanGlobalMcp('Codex', ctx);
  assert.equal(hits[0].enabled, false);
  assert.equal(hits[0].codegen, true);
});

test('codex honors CODEX_HOME and detects codegen by args', () => {
  const home = tmp();
  const ch = path.join(home, 'ch');
  put(path.join(ch, 'config.toml'), '[mcp_servers.foo]\nargs = ["/x/egovframe-mcp-codegen/build/index.js"]\n');
  const hits = scanGlobalMcp('Codex', { home, appData: home, env: { CODEX_HOME: ch }, runDir: home });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].codegen, true);
});

test('antigravity disabled flag', () => {
  const home = tmp();
  put(path.join(home, '.gemini', 'config', 'mcp_config.json'), {
    mcpServers: { 'egovframe-codegen': { command: 'node', disabled: true }, b: { command: 'x' } },
  });
  const hits = scanGlobalMcp('Antigravity', { home, appData: home, env: {}, runDir: home });
  assert.equal(hits.find((h) => h.name === 'egovframe-codegen').enabled, false);
  assert.equal(hits.find((h) => h.name === 'b').enabled, true);
});

test('claude code: user scope and matching project paths only', () => {
  const home = tmp();
  const run = path.join(home, 'edu', 'submissions', 'a', 'nomcp');
  put(path.join(home, '.claude.json'), {
    mcpServers: { 'egovframe-codegen': { command: 'node' } },
    projects: {
      [path.join(home, 'edu')]: {
        mcpServers: { p1: { command: 'x', args: ['egovframe-mcp-codegen'] }, p2: { command: 'y' } },
        disabledMcpServers: ['p2'],
      },
      [path.join(home, 'unrelated')]: { mcpServers: { nope: { command: 'z' } } },
    },
  });
  const hits = scanGlobalMcp('Claude-Code', { home, appData: home, env: {}, runDir: run });
  assert.deepEqual(hits.map((h) => h.name).sort(), ['egovframe-codegen', 'p1', 'p2']);
  assert.equal(hits.find((h) => h.name === 'p2').enabled, false);
  assert.equal(hits.find((h) => h.name === 'p1').codegen, true);
});

test('copilot reads both files and both keys', () => {
  const home = tmp();
  const appData = path.join(home, 'AD');
  put(path.join(home, '.copilot', 'mcp-config.json'), { mcpServers: { a: { command: 'x' } } });
  put(path.join(appData, 'Code', 'User', 'mcp.json'), { servers: { b: { command: 'y', disabled: true } } });
  const hits = scanGlobalMcp('GitHub-Copilot', { home, appData, env: {}, runDir: home });
  assert.deepEqual(hits.map((h) => [h.name, h.enabled]).sort(), [['a', true], ['b', false]]);
});

test('cursor and cline', () => {
  const home = tmp();
  put(path.join(home, '.cursor', 'mcp.json'), { mcpServers: { c: { command: 'x' } } });
  assert.equal(scanGlobalMcp('Cursor', { home, appData: home, env: {}, runDir: home }).length, 1);
  const cl = path.join(home, 'cl.json');
  put(cl, '{"mcpServers":{"egovframe-codegen":{"command":"n","disabled":true}}}');
  const hits = scanGlobalMcp('Cline', { home, appData: home, env: { CLINE_MCP_SETTINGS_PATH: cl }, runDir: home });
  assert.equal(hits[0].enabled, false);
});

test('broken JSON and missing files give empty arrays', () => {
  const home = tmp();
  const ctx = { home, appData: home, env: {}, runDir: home };
  assert.deepEqual(scanGlobalMcp('Claude-Code', ctx), []);
  put(path.join(home, '.claude.json'), '{ broken');
  put(path.join(home, '.gemini', 'config', 'mcp_config.json'), '{ broken');
  assert.deepEqual(scanGlobalMcp('Claude-Code', ctx), []);
  assert.deepEqual(scanGlobalMcp('Antigravity', ctx), []);
});

test('instruction leaks: parents and personal files, not runDir', () => {
  const root = tmp();
  const home = path.join(root, 'home');
  const run = path.join(root, 'a', 'b', 'run');
  fs.mkdirSync(run, { recursive: true });
  put(path.join(root, 'AGENTS.md'), 'x');
  put(path.join(root, 'a', '.claude', 'rules', 'r.md'), 'x');
  put(path.join(root, 'a', 'b', '.mcp.json'), '{}');
  put(path.join(run, 'CLAUDE.md'), 'own');
  put(path.join(home, '.claude', 'CLAUDE.md'), 'x');
  put(path.join(home, '.gemini', 'GEMINI.md'), 'x');
  const leaks = findInstructionLeaks(run, home, {});
  assert.ok(leaks.includes(path.join(root, 'AGENTS.md')));
  assert.ok(leaks.includes(path.join(root, 'a', '.claude', 'rules')));
  assert.ok(leaks.includes(path.join(root, 'a', 'b', '.mcp.json')));
  assert.ok(leaks.includes(path.join(home, '.claude', 'CLAUDE.md')));
  assert.ok(leaks.includes(path.join(home, '.gemini', 'GEMINI.md')));
  assert.ok(!leaks.includes(path.join(run, 'CLAUDE.md')));
  assert.deepEqual(leaks, [...leaks].sort());
});

test('removalHint', () => {
  const top = { name: 'egovframe-codegen', source: '/h/.claude.json', scope: 'user' };
  assert.match(removalHint('Claude-Code', top), /claude mcp remove egovframe-codegen -s user/);
  assert.match(removalHint('Claude-Code', { ...top, scope: 'local' }), /-s local/);
  assert.match(removalHint('Codex', top), /codex mcp remove egovframe-codegen/);
  assert.match(removalHint('Antigravity', top), /agy mcp remove egovframe-codegen/);
  assert.match(removalHint('Cursor', top), /Cursor/);
  assert.match(removalHint('GitHub-Copilot', top), /copilot mcp remove/);
  assert.match(removalHint('Cline', top), /Cline/);
});

// 화면에서 끄기만 하면 파일에 남아 setup 이 계속 막으므로, 파일에서 지우는 방법과 그 파일을 알려 줘야 한다.
test('removalHint names the file to edit for Cursor and both Copilot files', () => {
  const home = tmp();
  const appData = path.join(home, 'AD');
  const vscodeFile = path.join(appData, 'Code', 'User', 'mcp.json');
  const copilotFile = path.join(home, '.copilot', 'mcp-config.json');
  const cursorFile = path.join(home, '.cursor', 'mcp.json');
  put(vscodeFile, { servers: { 'egovframe-codegen': { command: 'node' } } });
  put(copilotFile, { mcpServers: { 'egovframe-codegen': { command: 'node' } } });
  put(cursorFile, { mcpServers: { 'egovframe-codegen': { command: 'node' } } });

  const hits = scanGlobalMcp('GitHub-Copilot', { home, appData, env: {}, runDir: home });
  const fromVsCode = hits.find((h) => h.source === vscodeFile);
  const fromCopilot = hits.find((h) => h.source === copilotFile);
  assert.ok(fromVsCode && fromCopilot, '두 파일의 서버를 모두 찾아야 합니다');

  const vs = removalHint('GitHub-Copilot', fromVsCode);
  assert.ok(vs.includes(vscodeFile), vs);
  assert.match(vs, /egovframe-codegen 항목을 지워/);
  assert.match(vs, /MCP: Open User Configuration/);
  assert.match(vs, /복사해 두세요/);
  assert.doesNotMatch(vs, /copilot mcp remove/);

  const cli = removalHint('GitHub-Copilot', fromCopilot);
  assert.match(cli, /copilot mcp remove egovframe-codegen/);
  assert.ok(cli.includes(copilotFile), cli);

  const [cursorHit] = scanGlobalMcp('Cursor', { home, appData, env: {}, runDir: home });
  const cur = removalHint('Cursor', cursorHit);
  assert.ok(cur.includes(cursorFile), cur);
  assert.match(cur, /egovframe-codegen 항목을 지워/);
  assert.match(cur, /복사해 두세요/);
  assert.doesNotMatch(cur, /화면에서 끄거나/);
});
