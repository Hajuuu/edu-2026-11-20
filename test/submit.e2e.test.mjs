// npm run submit 과 npm run cleanup 종단 시험: 임시 작업 저장소에서 setup 으로 실행을 준비하고
// 로컬 bare 저장소를 origin 으로 둔다. gh 는 없는 명령이거나, 인자를 기록하는 가짜 명령이다.
// GitHub 주소처럼 보이는 origin 은 pushInsteadOf 로 로컬 bare 저장소에 push 되게 한다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { removeTemps, tempDir, git, gitRun, workRepo, runScript, put, readParticipant } from './helpers.mjs';

after(removeTemps);

const UPSTREAM = 'swanpark8538/edu-2026-11-20';
const NO_CHANGE = '바뀐 것이 없어 새 커밋을 만들지 않습니다';
const MB = 1024 * 1024;

const setup = (ctx, ...args) => runScript(ctx, 'setup.mjs', args);
const submit = (ctx, args = [], env = {}) => runScript(ctx, 'submit.mjs', args, { env });
const cleanup = (ctx) => runScript(ctx, 'cleanup.mjs');
const runDir = (ctx, id, t) => path.join(ctx.repo, 'submissions', id, t);
const participantFile = (ctx, id) => path.join(ctx.repo, 'submissions', id, 'participant.json');
const commitCount = (ctx) => Number(git(ctx.repo, 'rev-list', '--count', 'HEAD'));
const remoteHas = (bare, branch) => gitRun(bare, 'rev-parse', '--verify', '--quiet', `refs/heads/${branch}`).status === 0;
const remoteFiles = (bare, branch) => git(bare, 'ls-tree', '-r', '--name-only', branch).split('\n');
const readJsonFile = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function bare(prefix) {
  const dir = path.join(tempDir(prefix), 'repo.git');
  git(path.dirname(dir), 'init', '-q', '--bare', dir);
  return dir;
}

// setup 과 같은 작업 저장소에 로컬 bare 저장소를 origin 으로 붙인다.
function submitRepo() {
  const ctx = workRepo();
  ctx.remote = bare('edu-origin-');
  git(ctx.repo, 'remote', 'add', 'origin', ctx.remote);
  return ctx;
}

// origin 주소를 GitHub 주소로 바꾸되 push 는 로컬 bare 저장소로 가게 한다.
function githubRemote(ctx, url, target) {
  git(ctx.repo, 'remote', 'set-url', 'origin', url);
  git(ctx.repo, 'config', `url.${target}.pushInsteadOf`, url);
}

// nomcp 실행을 준비하고 AI 가 만든 것처럼 파일을 둔다. target/ 과 .codex/ 는 제출되면 안 되는 파일이다.
function prepared(id) {
  const ctx = submitRepo();
  const r = setup(ctx, '--test', 'nomcp', '--id', id, '--tool', 'codex');
  assert.equal(r.code, 0, r.out);
  const run = runDir(ctx, id, 'nomcp');
  put(path.join(run, 'board-app', 'pom.xml'), '<project/>\n');
  put(path.join(run, 'board-app', 'src', 'main', 'java', 'App.java'), 'class App {}\n');
  put(path.join(run, 'board-app', 'target', 'board-app.jar'), 'jar\n');
  put(path.join(run, '.codex', 'config.toml'), '[mcp_servers.x]\ncommand = "x"\n');
  return ctx;
}

test('dry run', () => {
  const ctx = prepared('T01');
  put(path.join(runDir(ctx, 'T01', 'nomcp'), 'board-app', 'big.bin'), Buffer.alloc(21 * MB));
  const before = commitCount(ctx);
  const record = fs.readFileSync(participantFile(ctx, 'T01'), 'utf8');
  const excludeFile = path.join(ctx.repo, '.git', 'info', 'exclude');
  const exclude = fs.readFileSync(excludeFile, 'utf8');

  for (const r of [submit(ctx, ['--dry-run']), submit(ctx, [], { npm_config_dry_run: 'true' })]) {
    assert.equal(r.code, 0, r.out);
    for (const s of ['git add', 'git commit', 'git push', 'gh pr create', 'big.bin']) assert.ok(r.out.includes(s), `${s}\n${r.out}`);
    assert.equal(commitCount(ctx), before);
    assert.equal(fs.readFileSync(participantFile(ctx, 'T01'), 'utf8'), record);
    assert.equal(fs.readFileSync(excludeFile, 'utf8'), exclude);
    assert.ok(!remoteHas(ctx.remote, 'submit/T01'));
  }
});

test('push without pr, then the mcp run', () => {
  const ctx = prepared('T01');
  const before = commitCount(ctx);
  let r = submit(ctx, ['--no-pr']);
  assert.equal(r.code, 0, r.out);
  assert.equal(commitCount(ctx), before + 1);
  assert.equal(git(ctx.repo, 'log', '-1', '--format=%s'), 'submit: T01 nomcp');
  // gh 가 없으면 PC 계정 이름 대신 중립 이름으로 커밋한다.
  assert.match(git(ctx.repo, 'log', '-1', '--format=%ae'), /\.invalid$/);
  assert.equal(git(ctx.remote, 'rev-parse', 'submit/T01'), git(ctx.repo, 'rev-parse', 'HEAD'));

  const files = remoteFiles(ctx.remote, 'submit/T01');
  for (const f of [
    'submissions/T01/participant.json',
    'submissions/T01/nomcp/TASK.md',
    'submissions/T01/nomcp/AGENTS.md',
    'submissions/T01/nomcp/board-app/pom.xml',
  ]) {
    assert.ok(files.includes(f), `${f}\n${files.join('\n')}`);
  }
  assert.ok(!files.some((f) => f.includes('/.codex/') || f.includes('/target/')), files.join('\n'));

  const p = readParticipant(ctx, 'T01');
  assert.ok(!Number.isNaN(Date.parse(p.runs.nomcp.submittedAt)), JSON.stringify(p));
  assert.equal(typeof p.runs.nomcp.elapsedMinutes, 'number');
  assert.equal(p.runs.nomcp.overLimit, false);
  const pushed = JSON.parse(git(ctx.remote, 'show', 'submit/T01:submissions/T01/participant.json'));
  assert.equal(pushed.runs.nomcp.submittedAt, p.runs.nomcp.submittedAt);
  assert.match(r.out, /\[완료\][^\n]*분/);
  assert.ok(r.out.includes(`https://github.com/${UPSTREAM}/compare/`), r.out);
  assert.ok(r.out.trimEnd().endsWith('npm run setup --test mcp --id T01 --tool Codex 를 실행해 주세요.'), r.out);

  // 두 번째 실행(mcp): setup 이 nomcp 제출 기록을 보고 진행하고, 도구 설정 폴더는 제출되지 않는다.
  r = setup(ctx, '--test', 'mcp', '--id', 'T01', '--tool', 'codex');
  assert.equal(r.code, 0, r.out);
  put(path.join(runDir(ctx, 'T01', 'mcp'), 'board-app', 'pom.xml'), '<project/>\n');
  r = submit(ctx, ['--no-pr']);
  assert.equal(r.code, 0, r.out);
  assert.equal(git(ctx.repo, 'log', '-1', '--format=%s'), 'submit: T01 mcp');
  const mcpFiles = remoteFiles(ctx.remote, 'submit/T01');
  assert.ok(mcpFiles.includes('submissions/T01/mcp/TASK.md'));
  assert.ok(mcpFiles.includes('submissions/T01/mcp/board-app/pom.xml'));
  assert.ok(!mcpFiles.some((f) => f.startsWith('submissions/T01/mcp/.codex/')), mcpFiles.join('\n'));
  assert.ok(readParticipant(ctx, 'T01').runs.mcp.submittedAt);
  assert.ok(!r.out.includes('--test mcp'), r.out);
});

test('resubmit unchanged', () => {
  const ctx = prepared('T01');
  assert.equal(submit(ctx, ['--no-pr']).code, 0);
  const count = commitCount(ctx);
  const record = fs.readFileSync(participantFile(ctx, 'T01'), 'utf8');
  // 저장소의 다른 곳에서 바뀐 파일은 제출되지 않는다고 알린다.
  fs.appendFileSync(path.join(ctx.repo, 'package.json'), '\n');

  const r = submit(ctx, ['--no-pr']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, new RegExp(`\\[주의\\][^\\n]*${NO_CHANGE}`));
  assert.match(r.out, /\[주의\][^\n]*제출되지 않습니다[^\n]*package\.json/);
  assert.equal(commitCount(ctx), count);
  assert.equal(fs.readFileSync(participantFile(ctx, 'T01'), 'utf8'), record);
  assert.equal(git(ctx.remote, 'rev-parse', 'submit/T01'), git(ctx.repo, 'rev-parse', 'HEAD'));

  // 스테이징해 둔 바깥 변경은 다음 제출 커밋에 섞이지 않고, 파일 내용은 그대로 남는다.
  git(ctx.repo, 'add', 'package.json');
  put(path.join(runDir(ctx, 'T01', 'nomcp'), 'board-app', 'README.md'), '고친 내용\n');
  const again = submit(ctx, ['--no-pr']);
  assert.equal(again.code, 0, again.out);
  assert.equal(commitCount(ctx), count + 1);
  assert.deepEqual(git(ctx.repo, 'show', '--name-only', '--format=', 'HEAD').split('\n').sort(), [
    'submissions/T01/nomcp/board-app/README.md',
    'submissions/T01/participant.json',
  ]);
  assert.equal(git(ctx.repo, 'status', '--porcelain', '--', 'package.json'), 'M package.json');
});

test('a failed push keeps the commit and the next submit pushes it', () => {
  const ctx = prepared('T02');
  git(ctx.repo, 'remote', 'set-url', 'origin', path.join(tempDir('edu-missing-'), 'nowhere.git'));
  let r = submit(ctx, ['--no-pr']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[오류\][^\n]*push/);
  for (const s of ['gh auth login', 'gh auth setup-git']) assert.ok(r.out.includes(s), `${s}\n${r.out}`);
  assert.equal(git(ctx.repo, 'log', '-1', '--format=%s'), 'submit: T02 nomcp');
  const head = git(ctx.repo, 'rev-parse', 'HEAD');

  // npm run submit --no-pr 는 npm 이 빈 값의 npm_config_pr 로만 넘긴다.
  git(ctx.repo, 'remote', 'set-url', 'origin', ctx.remote);
  r = submit(ctx, [], { npm_config_pr: '' });
  assert.equal(r.code, 0, r.out);
  assert.ok(r.out.includes(NO_CHANGE), r.out);
  assert.match(r.out, /\[주의\][^\n]*--no-pr/);
  assert.equal(git(ctx.remote, 'rev-parse', 'submit/T02'), head);
});

test('big file excluded', () => {
  const ctx = prepared('T01');
  const app = path.join(runDir(ctx, 'T01', 'nomcp'), 'board-app');
  fs.writeFileSync(path.join(app, 'big.bin'), Buffer.alloc(21 * MB));
  fs.writeFileSync(path.join(app, 'data.bin'), Buffer.alloc(1024));
  const exclude = path.join(ctx.repo, '.git', 'info', 'exclude');
  const lines = () => fs.readFileSync(exclude, 'utf8').split(/\r?\n/);

  let r = submit(ctx, ['--no-pr']);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\[주의\][^\n]*20MB/);
  assert.ok(r.out.includes('submissions/T01/nomcp/board-app/big.bin'), r.out);
  let files = remoteFiles(ctx.remote, 'submit/T01');
  assert.ok(!files.includes('submissions/T01/nomcp/board-app/big.bin'), files.join('\n'));
  assert.ok(files.includes('submissions/T01/nomcp/board-app/data.bin'));
  assert.ok(lines().includes('/submissions/T01/nomcp/board-app/big.bin'), lines().join('\n'));

  // 이미 제출한 파일이 20MB 를 넘게 커지면 다음 제출에서 빠진다. 작업 폴더의 파일은 그대로 둔다.
  fs.writeFileSync(path.join(app, 'data.bin'), Buffer.alloc(21 * MB));
  r = submit(ctx, ['--no-pr']);
  assert.equal(r.code, 0, r.out);
  assert.ok(r.out.includes('submissions/T01/nomcp/board-app/data.bin'), r.out);
  files = remoteFiles(ctx.remote, 'submit/T01');
  assert.ok(!files.includes('submissions/T01/nomcp/board-app/data.bin'), files.join('\n'));
  assert.equal(fs.statSync(path.join(app, 'data.bin')).size, 21 * MB);
  assert.ok(lines().includes('/submissions/T01/nomcp/board-app/data.bin'));
  assert.equal(lines().filter((l) => l === '/submissions/T01/nomcp/board-app/big.bin').length, 1);
  assert.equal(git(ctx.repo, 'status', '--porcelain'), '');
});

test('no gh fallback', () => {
  const ctx = prepared('T01');
  fs.rmSync(path.join(runDir(ctx, 'T01', 'nomcp'), 'board-app', 'pom.xml'));
  // 제한 시간을 넘긴 제출도 막지 않고 기록만 남긴다.
  const p = readParticipant(ctx, 'T01');
  p.runs.nomcp.setupAt = new Date(Date.now() - 35 * 60000).toISOString();
  fs.writeFileSync(participantFile(ctx, 'T01'), JSON.stringify(p, null, 2));

  let r = submit(ctx);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\[주의\][^\n]*pom\.xml/);
  assert.match(r.out, /\[주의\][^\n]*제한 시간/);
  assert.equal(readParticipant(ctx, 'T01').runs.nomcp.overLimit, true);
  assert.ok(remoteHas(ctx.remote, 'submit/T01'));
  // origin 이 GitHub 주소가 아니면 계정 자리를 비워 둔 비교 주소를 알려 준다.
  assert.ok(r.out.includes(`https://github.com/${UPSTREAM}/compare/main...<GitHub계정>:edu-2026-11-20:submit/T01`), r.out);

  // origin 이 GitHub 의 Fork 주소면 그 계정의 비교 주소를 알려 준다.
  const fork = prepared('T03');
  githubRemote(fork, 'https://github.com/kim/edu-2026-11-20.git', fork.remote);
  r = submit(fork);
  assert.equal(r.code, 0, r.out);
  assert.ok(remoteHas(fork.remote, 'submit/T03'));
  assert.ok(r.out.includes(`https://github.com/${UPSTREAM}/compare/main...kim:submit/T03?expand=1`), r.out);
  assert.match(r.out, /\[주의\][^\n]*gh/);
});

test('not on a submit branch or without a record', () => {
  const ctx = submitRepo();
  let r = submit(ctx);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[오류\][^\n]*submit\//);
  assert.ok(r.out.includes('npm run setup'), r.out);

  git(ctx.repo, 'switch', '-q', '-c', 'submit/T09');
  r = submit(ctx);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[오류\][^\n]*participant\.json/);
  assert.ok(r.out.includes('npm run setup'), r.out);
});

test('a nested git repository stops before committing', () => {
  const ctx = prepared('T01');
  git(path.join(runDir(ctx, 'T01', 'nomcp'), 'board-app'), 'init', '-q');
  const before = commitCount(ctx);
  const record = fs.readFileSync(participantFile(ctx, 'T01'), 'utf8');
  const r = submit(ctx, ['--no-pr']);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[오류\][^\n]*\.git/);
  assert.ok(r.out.includes(path.join('submissions', 'T01', 'nomcp', 'board-app', '.git')), r.out);
  assert.equal(commitCount(ctx), before);
  assert.equal(fs.readFileSync(participantFile(ctx, 'T01'), 'utf8'), record);
});

// 인자와 표준 입력을 기록하고 정해진 응답을 돌려주는 가짜 gh (셸 없이 실행되도록 shebang 사용)
const FAKE_GH = `
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const a = process.argv.slice(2);
const call = { args: a };
if (a[0] === 'pr' && a[1] === 'create') call.body = fs.readFileSync(0, 'utf8');
fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(call) + '\\n');
const out = (v) => process.stdout.write(typeof v === 'string' ? v + '\\n' : JSON.stringify(v));
if (a[0] === '--version') out('gh version 2.76.2 (2025-07-30)');
else if (a[0] === 'api' && a[1] === 'user') out({ login: 'kim', id: 42 });
else if (a[0] === 'api' && a[1].startsWith('repos/')) out({ permissions: { push: process.env.FAKE_GH_PUSH === '1' } });
else if (a[0] === 'pr' && a[1] === 'list') out(JSON.parse(process.env.FAKE_GH_PRS || '[]'));
else if (a[0] === 'pr' && a[1] === 'create') out('https://github.com/${UPSTREAM}/pull/7');
else if (a[0] === 'repo' && a[1] === 'fork') {
  execFileSync('git', ['remote', 'rename', 'origin', 'upstream']);
  execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/kim/edu-2026-11-20.git']);
  process.stderr.write('Created fork kim/edu-2026-11-20\\n');
} else { process.stderr.write('unsupported: ' + a.join(' ')); process.exit(1); }
`;

const canFake = process.platform !== 'win32' && !/\s/.test(process.execPath);

function fakeGh(extraEnv = {}) {
  const dir = tempDir('edu-fake-gh-');
  const file = path.join(dir, 'gh');
  const log = path.join(dir, 'calls.log');
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"commonjs"}\n');
  fs.writeFileSync(file, `#!${process.execPath}\n${FAKE_GH}`);
  fs.chmodSync(file, 0o755);
  fs.writeFileSync(log, '');
  return {
    env: { EDU_GH: file, FAKE_GH_LOG: log, ...extraEnv },
    calls: () => fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)),
  };
}

const prCreates = (gh) => gh.calls().filter((c) => c.args[0] === 'pr' && c.args[1] === 'create');
const flagOf = (call, flag) => call.args[call.args.indexOf(flag) + 1];

test('opens a pr with gh and reuses the open pr', { skip: !canFake }, () => {
  const ctx = prepared('T04');
  githubRemote(ctx, 'https://github.com/kim/edu-2026-11-20.git', ctx.remote);
  let gh = fakeGh();
  let r = submit(ctx, [], gh.env);
  assert.equal(r.code, 0, r.out);
  assert.ok(r.out.trimEnd().includes(`https://github.com/${UPSTREAM}/pull/7`), r.out);
  const [create] = prCreates(gh);
  assert.equal(flagOf(create, '--repo'), UPSTREAM);
  assert.equal(flagOf(create, '--base'), 'main');
  assert.equal(flagOf(create, '--head'), 'kim:submit/T04');
  assert.equal(flagOf(create, '--title'), '[제출] T04 (Codex)');
  for (const s of ['Codex', 'GPT-6.1 Sol', `${process.platform}-${process.arch}`, '| nomcp |', '| mcp |']) {
    assert.ok(create.body.includes(s), `${s}\n${create.body}`);
  }
  for (const p of [ctx.repo, ctx.home, os.homedir()]) assert.ok(!create.body.includes(p), create.body);
  assert.equal(git(ctx.repo, 'log', '-1', '--format=%ae'), '42+kim@users.noreply.github.com');

  put(path.join(runDir(ctx, 'T04', 'nomcp'), 'board-app', 'README.md'), '고친 내용\n');
  gh = fakeGh({ FAKE_GH_PRS: JSON.stringify([{ url: `https://github.com/${UPSTREAM}/pull/5`, headRepositoryOwner: { login: 'kim' } }]) });
  r = submit(ctx, [], gh.env);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /PR 이 갱신되었습니다/);
  assert.ok(r.out.includes(`https://github.com/${UPSTREAM}/pull/5`), r.out);
  assert.equal(prCreates(gh).length, 0);
  assert.ok(remoteFiles(ctx.remote, 'submit/T04').includes('submissions/T04/nomcp/board-app/README.md'));
});

test('origin is the upstream: fork first without push permission', { skip: !canFake }, () => {
  const ctx = prepared('T05');
  const forkRemote = bare('edu-fork-');
  githubRemote(ctx, `https://github.com/${UPSTREAM}.git`, ctx.remote);
  git(ctx.repo, 'config', `url.${forkRemote}.pushInsteadOf`, 'https://github.com/kim/edu-2026-11-20.git');
  const gh = fakeGh({ FAKE_GH_PUSH: '0' });
  const r = submit(ctx, [], gh.env);
  assert.equal(r.code, 0, r.out);
  assert.ok(gh.calls().some((c) => c.args[0] === 'repo' && c.args[1] === 'fork'));
  assert.equal(git(ctx.repo, 'remote', 'get-url', 'origin'), 'https://github.com/kim/edu-2026-11-20.git');
  assert.equal(git(ctx.repo, 'remote', 'get-url', 'upstream'), `https://github.com/${UPSTREAM}.git`);
  assert.ok(remoteHas(forkRemote, 'submit/T05'));
  assert.ok(!remoteHas(ctx.remote, 'submit/T05'));
  assert.equal(flagOf(prCreates(gh)[0], '--head'), 'kim:submit/T05');
});

test('origin is the upstream: push directly with push permission', { skip: !canFake }, () => {
  const ctx = prepared('T06');
  githubRemote(ctx, `https://github.com/${UPSTREAM}.git`, ctx.remote);
  const gh = fakeGh({ FAKE_GH_PUSH: '1' });
  const r = submit(ctx, [], gh.env);
  assert.equal(r.code, 0, r.out);
  assert.ok(!gh.calls().some((c) => c.args[0] === 'repo'));
  assert.ok(remoteHas(ctx.remote, 'submit/T06'));
  assert.equal(flagOf(prCreates(gh)[0], '--head'), 'swanpark8538:submit/T06');
});

const clineSettings = (ctx) => path.join(ctx.home, '.cline', 'data', 'settings', 'cline_mcp_settings.json');
const changesFile = (ctx) => path.join(ctx.repo, '.edu', 'global-changes.json');

test('cleanup', () => {
  const ctx = workRepo();
  const settings = clineSettings(ctx);
  put(settings, JSON.stringify({ mcpServers: { mine: { command: 'x' } }, keep: true }));
  assert.equal(setup(ctx, '--test', 'nomcp', '--id', 'T20', '--tool', 'cline').code, 0);
  assert.equal(readJsonFile(settings).mcpServers['egovframe-codegen'].disabled, true);

  let r = cleanup(ctx);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\[완료\][^\n]*egovframe-codegen/);
  assert.deepEqual(readJsonFile(settings), { mcpServers: { mine: { command: 'x' } }, keep: true });
  assert.deepEqual(readJsonFile(changesFile(ctx)).changes, []);

  r = cleanup(ctx);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /되돌릴 것이 없습니다/);
});

test('cleanup restores an entry the user already had', () => {
  const ctx = workRepo();
  const settings = clineSettings(ctx);
  const theirs = { command: 'node', args: ['/old/egovframe-mcp-codegen/build/index.js'], disabled: true };
  put(settings, JSON.stringify({ mcpServers: { 'egovframe-codegen': theirs, mine: { command: 'x' } } }));
  assert.equal(setup(ctx, '--test', 'nomcp', '--id', 'T21', '--tool', 'cline').code, 0);
  assert.equal(setup(ctx, '--test', 'mcp', '--id', 'T21', '--tool', 'cline', '--force').code, 0);
  assert.deepEqual(readJsonFile(changesFile(ctx)).changes[0].previousEntry, theirs);
  assert.equal(readJsonFile(settings).mcpServers['egovframe-codegen'].disabled, false);

  const r = cleanup(ctx);
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(readJsonFile(settings).mcpServers, { 'egovframe-codegen': theirs, mine: { command: 'x' } });
});

test('cleanup leaves a broken settings file alone', () => {
  const ctx = workRepo();
  const settings = clineSettings(ctx);
  assert.equal(setup(ctx, '--test', 'nomcp', '--id', 'T22', '--tool', 'cline').code, 0);
  fs.writeFileSync(settings, '{ broken');
  const r = cleanup(ctx);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /\[오류\][^\n]*Cline/);
  assert.equal(fs.readFileSync(settings, 'utf8'), '{ broken');
  assert.equal(readJsonFile(changesFile(ctx)).changes.length, 1);
});
