import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  MCP_SERVER_NAME,
  folderMcpFiles,
  ALL_FOLDER_MCP_PATHS,
  instructionFile,
  clineSettingsPath,
  toggleCline,
} from '../scripts/lib/mcp-config.mjs';

const SERVER = {
  command: 'C:\\Program Files\\nodejs\\node.exe',
  args: ['C:\\Users\\홍 길동\\edu\\.mcp-servers\\egovframe-mcp-codegen\\package\\build\\index.js'],
};
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mcpcfg-'));

test('json files parse and keep windows paths', () => {
  const cases = [
    ['Claude-Code', '.mcp.json', true],
    ['Antigravity', '.agents/mcp_config.json', false],
    ['Cursor', '.cursor/mcp.json', true],
    ['GitHub-Copilot', '.mcp.json', true],
  ];
  for (const [tool, file, stdio] of cases) {
    const files = folderMcpFiles(tool, SERVER);
    assert.ok(file in files, `${tool} ${file}`);
    const entry = JSON.parse(files[file]).mcpServers[MCP_SERVER_NAME];
    assert.equal(entry.command, SERVER.command);
    assert.deepEqual(entry.args, SERVER.args);
    if (stdio) assert.equal(entry.type, 'stdio');
    else assert.equal('type' in entry, false);
  }
  const s = JSON.parse(folderMcpFiles('Claude-Code', SERVER)['.claude/settings.json']);
  assert.deepEqual(s, { enabledMcpjsonServers: [MCP_SERVER_NAME] });
});

test('codex toml keeps windows paths', () => {
  const toml = folderMcpFiles('Codex', SERVER)['.codex/config.toml'];
  assert.ok(toml.includes('[mcp_servers.egovframe-codegen]'));
  const line = toml.split('\n').find((l) => l.startsWith('command = '));
  assert.equal(JSON.parse(line.slice('command = '.length)), SERVER.command);
  const argsLine = toml.split('\n').find((l) => l.startsWith('args = '));
  assert.deepEqual(JSON.parse(argsLine.slice('args = '.length)), SERVER.args);
});

test('cline has no folder files', () => {
  assert.deepEqual(folderMcpFiles('Cline', SERVER), {});
  for (const p of ['.mcp.json', '.claude/settings.json', '.codex/config.toml', '.agents/mcp_config.json', '.cursor/mcp.json']) {
    assert.ok(ALL_FOLDER_MCP_PATHS.includes(p));
  }
});

test('instruction file per tool', () => {
  const expected = {
    'Claude-Code': 'CLAUDE.md',
    Codex: 'AGENTS.md',
    Antigravity: 'GEMINI.md',
    Cursor: '.cursor/rules/workspace-boundary.mdc',
    'GitHub-Copilot': '.github/copilot-instructions.md',
    Cline: '.clinerules/workspace-boundary.md',
  };
  for (const [tool, p] of Object.entries(expected)) {
    const f = instructionFile(tool, { id: 'P01', test: 'nomcp' });
    assert.equal(f.path, p);
    assert.ok(f.content.includes('submissions/P01/nomcp'));
    assert.ok(!f.content.includes('/Users/') && !f.content.includes('C:\\'));
  }
  assert.ok(instructionFile('Cursor', { id: 'P01', test: 'mcp' }).content.includes('alwaysApply: true'));
  assert.ok(!instructionFile('Codex', { id: 'P01', test: 'mcp' }).content.startsWith('---'));
});

test('cline toggle', () => {
  const dir = tmp();
  const settingsPath = path.join(dir, 'settings', 'cline_mcp_settings.json');
  const backupDir = path.join(dir, 'backup');
  const opts = { settingsPath, backupDir };
  const read = () => JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

  let r = toggleCline(true, SERVER, opts);
  assert.equal(r.changed, true);
  assert.equal(read().mcpServers[MCP_SERVER_NAME].disabled, false);
  assert.deepEqual(read().mcpServers[MCP_SERVER_NAME].autoApprove, []);
  assert.equal(fs.existsSync(backupDir), false);
  assert.equal(toggleCline(true, SERVER, opts).changed, false);

  const cur = read();
  cur.mcpServers.foo = { command: 'x', args: [] };
  cur.other = 1;
  fs.writeFileSync(settingsPath, JSON.stringify(cur));
  r = toggleCline(false, SERVER, opts);
  assert.equal(r.changed, true);
  assert.equal(read().mcpServers[MCP_SERVER_NAME].disabled, true);
  assert.deepEqual(read().mcpServers.foo, { command: 'x', args: [] });
  assert.equal(read().other, 1);
  const bak = path.join(backupDir, 'cline_mcp_settings.json');
  assert.ok(fs.existsSync(bak));
  const bakText = fs.readFileSync(bak, 'utf8');

  toggleCline(true, SERVER, opts);
  assert.equal(fs.readFileSync(bak, 'utf8'), bakText);

  const broken = '{"mcpServers": {,}';
  fs.writeFileSync(settingsPath, broken);
  r = toggleCline(true, SERVER, opts);
  assert.equal(r.changed, false);
  assert.ok(r.aborted);
  assert.equal(fs.readFileSync(settingsPath, 'utf8'), broken);
});

test('cline path from env', () => {
  assert.equal(clineSettingsPath({ CLINE_DATA_DIR: '/x' }), path.join('/x', 'settings', 'cline_mcp_settings.json'));
  assert.equal(clineSettingsPath({ CLINE_MCP_SETTINGS_PATH: '/y.json', CLINE_DATA_DIR: '/x' }), '/y.json');
  assert.equal(clineSettingsPath({ CLINE_DIR: '/c' }), path.join('/c', 'data', 'settings', 'cline_mcp_settings.json'));
});
