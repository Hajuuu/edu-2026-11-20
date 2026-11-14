// npm run setup 종단 시험: 이 저장소 일부를 복사한 임시 작업 저장소와 임시 홈에서 실행한다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SRC, removeTemps, tempDir, git, gitRun, commitAll, workRepo, runScript, put, readParticipant } from './helpers.mjs';

const NOMCP_HEADER = '> 이 폴더에서는 MCP 없이 AI 도구의 기본 기능만 사용합니다.';
const MCP_HEADER = '> 이 폴더의 AI 도구에는 eGovFrame 코드 생성 MCP(`egovframe-codegen`)가 연결되어 있습니다.';
const FIRST_PROMPT = 'TASK.md 를 읽고 이 폴더에 board-app 프로젝트를 만들어 줘.';

after(removeTemps);

const runSetup = (ctx, nodeArgs, args) => runScript(ctx, 'setup.mjs', args, { nodeArgs });
const setup = (ctx, ...args) => runSetup(ctx, [], args);
const runDir = (ctx, id, t) => path.join(ctx.repo, 'submissions', id, t);
const codegenEntryOf = (ctx) => path.join(ctx.repo, '.mcp-servers', 'egovframe-mcp-codegen', 'package', 'build', 'index.js');
const branch = (ctx) => git(ctx.repo, 'symbolic-ref', '--short', 'HEAD');
const firstLine = (file) => fs.readFileSync(file, 'utf8').split(/\r?\n/)[0];

test('nomcp codex', () => {
  const ctx = workRepo();
  const r = setup(ctx, '--test', 'nomcp', '--id', 'T01', '--tool', 'codex');
  assert.equal(r.code, 0, r.out);
  assert.equal(branch(ctx), 'submit/T01');

  const run = runDir(ctx, 'T01', 'nomcp');
  const original = fs.readFileSync(path.join(SRC, 'task', 'TASK.md'), 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  assert.equal(fs.readFileSync(path.join(run, 'TASK.md'), 'utf8'), `${NOMCP_HEADER}${eol}${eol}${original}`);
  assert.ok(fs.existsSync(path.join(run, 'AGENTS.md')));
  assert.ok(!fs.existsSync(path.join(run, '.codex')));
  // nomcp 에서도 번들이 없으면 설치해 둔다 (깨진 번들을 mcp 실행 전에 발견).
  assert.ok(fs.statSync(codegenEntryOf(ctx)).isFile());

  const p = readParticipant(ctx, 'T01');
  assert.equal(p.id, 'T01');
  assert.equal(p.tool, 'Codex');
  assert.equal(p.runs.nomcp.limitMinutes, 30);
  assert.equal(p.platform, `${process.platform}-${process.arch}`);
  assert.equal(p.versions.node, process.versions.node);
  assert.equal(p.versions.gh, null);
  assert.deepEqual(p.runs.nomcp.warnings, []);

  for (const s of [run, 'docs/setup-codex.md', FIRST_PROMPT, '30분', 'npm run submit', '--test mcp']) {
    assert.ok(r.out.includes(s), `출력에 ${s} 가 있어야 합니다\n${r.out}`);
  }
  assert.match(r.out, /\b\d{2}:\d{2}\b/);
});

test('mcp before nomcp submitted', () => {
  const ctx = workRepo();
  let r = setup(ctx, '--test', 'mcp', '--id', 'T01', '--tool', 'codex');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /nomcp/);
  assert.match(r.out, /먼저/);
  assert.ok(!fs.existsSync(runDir(ctx, 'T01', 'mcp')));

  r = setup(ctx, '--test', 'mcp', '--id', 'T01', '--tool', 'codex', '--force');
  assert.equal(r.code, 0, r.out);
  const toml = fs.readFileSync(path.join(runDir(ctx, 'T01', 'mcp'), '.codex', 'config.toml'), 'utf8');
  assert.ok(toml.includes('[mcp_servers.egovframe-codegen]'));
  assert.equal(readParticipant(ctx, 'T01').runs.mcp.limitMinutes, 20);
});

test('mcp claude', () => {
  const ctx = workRepo();
  assert.equal(setup(ctx, '--test', 'nomcp', '--id', 'T02', '--tool', 'claude').code, 0);
  const pfile = path.join(ctx.repo, 'submissions', 'T02', 'participant.json');
  const before = readParticipant(ctx, 'T02');
  before.runs.nomcp.submittedAt = new Date().toISOString();
  fs.writeFileSync(pfile, JSON.stringify(before, null, 2));

  const r = setup(ctx, '--test', 'mcp', '--id', 'T02', '--tool', 'claude');
  assert.equal(r.code, 0, r.out);
  const run = runDir(ctx, 'T02', 'mcp');
  const server = JSON.parse(fs.readFileSync(path.join(run, '.mcp.json'), 'utf8')).mcpServers['egovframe-codegen'];
  assert.equal(server.command, process.execPath);
  assert.ok(fs.statSync(server.args[0]).isFile(), server.args[0]);
  assert.ok(fs.existsSync(path.join(run, 'CLAUDE.md')));
  assert.ok(fs.existsSync(path.join(run, '.claude', 'settings.json')));
  assert.equal(firstLine(path.join(run, 'TASK.md')), MCP_HEADER);
  assert.ok(!fs.existsSync(path.join(runDir(ctx, 'T02', 'nomcp'), '.mcp.json')));

  const p = readParticipant(ctx, 'T02');
  assert.equal(p.tool, 'Claude-Code');
  assert.equal(p.runs.mcp.limitMinutes, 20);
  assert.equal(p.runs.nomcp.submittedAt, before.runs.nomcp.submittedAt);
  assert.ok(r.out.includes('20분'), r.out);
});

test('rerun keeps work', () => {
  const ctx = workRepo();
  const args = ['--test', 'nomcp', '--id', 'T03', '--tool', 'Cursor'];
  assert.equal(setup(ctx, ...args).code, 0);
  const run = runDir(ctx, 'T03', 'nomcp');
  const pom = path.join(run, 'board-app', 'pom.xml');
  put(pom, '<project>내 작업</project>\n');
  fs.writeFileSync(path.join(run, 'TASK.md'), '고친 내용\n');
  put(path.join(run, '.cursor', 'mcp.json'), '{"mcpServers":{}}\n');
  git(ctx.repo, 'switch', '-q', 'main');

  const r = setup(ctx, ...args);
  assert.equal(r.code, 0, r.out);
  assert.equal(branch(ctx), 'submit/T03');
  assert.equal(fs.readFileSync(pom, 'utf8'), '<project>내 작업</project>\n');
  assert.equal(firstLine(path.join(run, 'TASK.md')), NOMCP_HEADER);
  assert.ok(fs.existsSync(path.join(run, '.cursor', 'rules', 'workspace-boundary.mdc')));
  assert.ok(!fs.existsSync(path.join(run, '.cursor', 'mcp.json')));
});

test('cline toggles global', () => {
  const ctx = workRepo();
  const settings = path.join(ctx.home, '.cline', 'data', 'settings', 'cline_mcp_settings.json');
  const original = '{"mcpServers":{"mine":{"command":"x"}}}';
  put(settings, original);

  let r = setup(ctx, '--test', 'nomcp', '--id', 'T04', '--tool', 'cline');
  assert.equal(r.code, 0, r.out);
  let doc = JSON.parse(fs.readFileSync(settings, 'utf8'));
  assert.equal(doc.mcpServers['egovframe-codegen'].disabled, true);
  assert.ok(fs.statSync(doc.mcpServers['egovframe-codegen'].args[0]).isFile());
  assert.deepEqual(doc.mcpServers.mine, { command: 'x' });
  assert.match(r.out, /\[주의\][^\n]*mine/);
  const p = readParticipant(ctx, 'T04');
  assert.ok(p.runs.nomcp.warnings.some((w) => w.includes('mine')), JSON.stringify(p.runs.nomcp.warnings));
  assert.ok(!JSON.stringify(p).includes(ctx.home), '참가자 기록에 홈 경로가 들어가면 안 됩니다');
  assert.ok(fs.existsSync(path.join(runDir(ctx, 'T04', 'nomcp'), '.clinerules', 'workspace-boundary.md')));

  r = setup(ctx, '--test', 'mcp', '--id', 'T04', '--tool', 'cline', '--force');
  assert.equal(r.code, 0, r.out);
  doc = JSON.parse(fs.readFileSync(settings, 'utf8'));
  const entry = doc.mcpServers['egovframe-codegen'];
  assert.equal(entry.disabled, false);
  assert.ok(fs.statSync(entry.args[0]).isFile(), entry.args[0]);
  assert.deepEqual(doc.mcpServers.mine, { command: 'x' });
  for (const f of ['.mcp.json', '.claude', '.codex', '.agents', '.cursor']) {
    assert.ok(!fs.existsSync(path.join(runDir(ctx, 'T04', 'mcp'), f)), f);
  }

  const changesFile = path.join(ctx.repo, '.edu', 'global-changes.json');
  let changes = JSON.parse(fs.readFileSync(changesFile, 'utf8'));
  assert.equal(changes.changes.length, 1);
  const c = changes.changes[0];
  assert.equal(c.tool, 'Cline');
  assert.equal(c.file, settings);
  assert.equal(c.server, 'egovframe-codegen');
  assert.equal(c.enabled, true);
  assert.equal(c.previousEntry, null);
  assert.ok(!Number.isNaN(Date.parse(c.at)));
  assert.equal(fs.readFileSync(path.join(ctx.repo, '.edu', 'backup', 'cline_mcp_settings.json'), 'utf8'), original);

  // 켜 둔 관리 항목은 nomcp 를 막지 않고 다시 꺼진다.
  r = setup(ctx, '--test', 'nomcp', '--id', 'T04', '--tool', 'cline');
  assert.equal(r.code, 0, r.out);
  assert.equal(JSON.parse(fs.readFileSync(settings, 'utf8')).mcpServers['egovframe-codegen'].disabled, true);
  changes = JSON.parse(fs.readFileSync(changesFile, 'utf8'));
  assert.equal(changes.changes.length, 1);
  assert.equal(changes.changes[0].enabled, false);
});

test('broken cline settings stop before writing', () => {
  const ctx = workRepo();
  const settings = path.join(ctx.home, '.cline', 'data', 'settings', 'cline_mcp_settings.json');
  put(settings, '{ broken');
  const r = setup(ctx, '--test', 'nomcp', '--id', 'T08', '--tool', 'cline');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[오류\][^\n]*Cline/);
  assert.equal(fs.readFileSync(settings, 'utf8'), '{ broken');
  assert.ok(!fs.existsSync(path.join(ctx.repo, 'submissions', 'T08')));
  assert.ok(!fs.existsSync(path.join(ctx.repo, '.edu', 'global-changes.json')));
});

test('broken bundle stops nomcp before writing', () => {
  const ctx = workRepo();
  const dir = path.join(ctx.repo, 'mcp', 'egovframe-mcp-codegen');
  const tgz = fs.readdirSync(dir).find((f) => f.endsWith('.tgz'));
  fs.writeFileSync(path.join(dir, tgz), 'not a bundle');
  const r = setup(ctx, '--test', 'nomcp', '--id', 'T09', '--tool', 'codex');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[오류\][^\n]*codegen/);
  assert.ok(!fs.existsSync(path.join(ctx.repo, 'submissions', 'T09')));
});

test('node below 18 stops before the branch', () => {
  const ctx = workRepo();
  const preload = path.join(tempDir('setup-preload-'), 'old-node.mjs');
  fs.writeFileSync(
    preload,
    "Object.defineProperty(process, 'versions', { value: { ...process.versions, node: '16.20.2' }, configurable: true, enumerable: true });\n",
  );
  const r = runSetup(ctx, ['--import', pathToFileURL(preload).href], ['--test', 'nomcp', '--id', 'T10', '--tool', 'codex']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[오류\][^\n]*Node\.js 16\.20\.2[^\n]*18/);
  assert.equal(branch(ctx), 'main');
  assert.ok(!fs.existsSync(path.join(ctx.repo, 'submissions')));
  assert.ok(!fs.existsSync(path.join(ctx.repo, '.mcp-servers')));
});

test('codex leftover blocks nomcp', () => {
  const ctx = workRepo();
  put(
    path.join(ctx.home, '.codex', 'config.toml'),
    '[mcp_servers.egovframe-codegen]\ncommand = "node"\nargs = ["/old/egovframe-mcp-codegen/build/index.js"]\n',
  );
  let r = setup(ctx, '--test', 'nomcp', '--id', 'T05', '--tool', 'codex');
  assert.equal(r.code, 1, r.out);
  assert.ok(r.out.includes('codex mcp remove egovframe-codegen'), r.out);
  assert.ok(!fs.existsSync(path.join(ctx.repo, 'submissions', 'T05')));

  r = setup(ctx, '--test', 'mcp', '--id', 'T05', '--tool', 'codex', '--force');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\[주의\][^\n]*egovframe-codegen/);
});

test('branch from origin main without upstream', () => {
  const base = workRepo();
  const clone = path.join(tempDir('setup-clone-'), 'work');
  git(base.repo, 'clone', '-q', base.repo, clone);
  git(clone, 'switch', '-q', '-c', 'scratch');
  git(clone, 'branch', '-q', '-D', 'main');
  const ctx = { repo: clone, home: base.home };

  const r = setup(ctx, '--test', 'nomcp', '--id', 'T07', '--tool', 'codex');
  assert.equal(r.code, 0, r.out);
  assert.equal(branch(ctx), 'submit/T07');
  assert.ok(r.out.includes('origin/main'), r.out);
  const upstream = gitRun(clone, 'rev-parse', '--abbrev-ref', 'submit/T07@{upstream}');
  assert.notEqual(upstream.status, 0, upstream.stdout);
});

test('blocked branch switch writes nothing', () => {
  const ctx = workRepo();
  const note = path.join(ctx.repo, 'note.txt');
  fs.writeFileSync(note, 'a\n');
  commitAll(ctx.repo, 'note');
  git(ctx.repo, 'switch', '-q', '-c', 'submit/T06');
  fs.writeFileSync(note, 'b\n');
  commitAll(ctx.repo, 'note b');
  git(ctx.repo, 'switch', '-q', 'main');
  fs.writeFileSync(note, 'c\n');

  const r = setup(ctx, '--test', 'nomcp', '--id', 'T06', '--tool', 'codex');
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /note\.txt/);
  assert.match(r.out, /git status/);
  assert.equal(branch(ctx), 'main');
  assert.ok(!fs.existsSync(path.join(ctx.repo, 'submissions', 'T06')));
});
