import test, { after } from 'node:test';
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
  readGlobalChanges,
  recordGlobalChange,
  undoClineChange,
} from '../scripts/lib/mcp-config.mjs';

// Windows 에서 setup 이 쓰는 모양: cmd /c npx 로 저장소의 번들 tgz 를 실행한다.
const SERVER = {
  command: 'cmd',
  args: ['/c', 'npx', '-y', '--package', 'C:\\Users\\홍 길동\\edu\\mcp\\egovframe-mcp-codegen\\egovframe-mcp-codegen-1.0.0.tgz', 'egovframe-mcp-codegen'],
};
const temps = [];
after(() => {
  for (const d of temps) fs.rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpcfg-'));
  temps.push(d);
  return d;
};

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
  // 개인 MCP 서버와 claude.ai 커넥터는 실습에 써도 되므로 끄지 않는다.
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
    // 지침은 합니다체 평서문으로 쓴다.
    assert.ok(f.content.includes('읽거나 검색하거나 참고하지 않습니다.'), f.content);
    assert.ok(f.content.includes('파일은 이 폴더 안에서만 만들고 고칩니다.'), f.content);
    assert.ok(f.content.includes('평소대로 사용합니다.'), f.content);
    assert.ok(!/세요\.|하면 됩니다\./.test(f.content), f.content);
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

test('cline toggle reports the entry it replaced', () => {
  const dir = tmp();
  const settingsPath = path.join(dir, 'settings', 'cline_mcp_settings.json');
  const opts = { settingsPath, backupDir: path.join(dir, 'backup') };
  assert.equal(toggleCline(false, SERVER, opts).previousEntry, null);

  const theirs = { command: 'old-node', args: ['/old/egovframe-mcp-codegen/build/index.js'], disabled: true };
  fs.writeFileSync(settingsPath, JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: theirs, foo: { command: 'x' } } }));
  let r = toggleCline(true, SERVER, opts);
  assert.equal(r.changed, true);
  assert.deepEqual(r.previousEntry, theirs);
  r = toggleCline(true, SERVER, opts);
  assert.equal(r.changed, false);
  assert.equal(r.previousEntry.command, SERVER.command);

  fs.writeFileSync(settingsPath, JSON.stringify({ other: 1 }));
  assert.equal(toggleCline(true, SERVER, opts).previousEntry, null);
});

test('global change records keep the entry from before the first change', () => {
  const root = tmp();
  const file = path.join(root, '.edu', 'global-changes.json');
  assert.deepEqual(readGlobalChanges(root), []);
  const key = { tool: 'Cline', file: path.join(root, 'cline_mcp_settings.json'), server: MCP_SERVER_NAME };
  const theirs = { command: 'old-node', args: [] };
  const ours = { command: SERVER.command, args: SERVER.args };

  recordGlobalChange({ ...key, enabled: false, at: 't1', previousEntry: theirs }, root);
  recordGlobalChange({ ...key, enabled: true, at: 't2', previousEntry: ours }, root);
  assert.deepEqual(readGlobalChanges(root), [{ ...key, enabled: true, at: 't2', previousEntry: theirs }]);

  recordGlobalChange({ ...key, file: path.join(root, 'other.json'), enabled: true, at: 't3', previousEntry: null }, root);
  assert.equal(readGlobalChanges(root).length, 2);

  // previousEntry 를 남기기 전의 기록은 처음 값을 알 수 없으므로 null(지우기)로 둔다.
  fs.writeFileSync(file, JSON.stringify({ changes: [{ ...key, enabled: false, at: 't0' }] }));
  recordGlobalChange({ ...key, enabled: true, at: 't4', previousEntry: ours }, root);
  assert.deepEqual(readGlobalChanges(root), [{ ...key, enabled: true, at: 't4', previousEntry: null }]);

  // 읽을 수 없는 기록 파일은 null 로 알리고, 다음 기록은 처음 값을 알 수 없는 것으로 남긴다.
  fs.writeFileSync(file, '{ broken');
  assert.equal(readGlobalChanges(root), null);
  recordGlobalChange({ ...key, enabled: true, at: 't5', previousEntry: ours }, root);
  assert.deepEqual(readGlobalChanges(root), [{ ...key, enabled: true, at: 't5', previousEntry: null }]);
});

test('undo cline change touches only the managed entry', () => {
  const dir = tmp();
  const file = path.join(dir, 'cline_mcp_settings.json');
  const ours = { command: SERVER.command, args: SERVER.args, disabled: false, autoApprove: [] };
  const theirs = { command: 'old-node', args: ['/old/index.js'], disabled: true };
  const write = (doc) => fs.writeFileSync(file, JSON.stringify(doc));
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  const change = (extra) => ({ tool: 'Cline', file, server: MCP_SERVER_NAME, ...extra });

  write({ mcpServers: { foo: { command: 'x' }, [MCP_SERVER_NAME]: ours }, other: 1 });
  assert.equal(undoClineChange(change({ previousEntry: null })).result, 'removed');
  assert.deepEqual(read(), { mcpServers: { foo: { command: 'x' } }, other: 1 });
  assert.equal(undoClineChange(change({ previousEntry: null })).result, 'absent');

  write({ mcpServers: { [MCP_SERVER_NAME]: ours, foo: { command: 'x' } } });
  assert.equal(undoClineChange(change({ previousEntry: theirs })).result, 'restored');
  assert.deepEqual(read(), { mcpServers: { [MCP_SERVER_NAME]: theirs, foo: { command: 'x' } } });

  // previousEntry 가 없는 예전 기록은 지우기로 처리한다.
  write({ mcpServers: { [MCP_SERVER_NAME]: ours } });
  assert.equal(undoClineChange(change()).result, 'removed');
  assert.deepEqual(read(), { mcpServers: {} });

  for (const broken of ['{"mcpServers": {,}', '[]', '{"mcpServers": []}']) {
    fs.writeFileSync(file, broken);
    assert.equal(undoClineChange(change({ previousEntry: null })).result, 'invalid', broken);
    assert.equal(fs.readFileSync(file, 'utf8'), broken);
  }

  fs.rmSync(file);
  assert.equal(undoClineChange(change({ previousEntry: theirs })).result, 'no-file');
  assert.equal(fs.existsSync(file), false);
});
