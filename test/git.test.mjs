import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  compareUrl,
  gh,
  ghLogin,
  viewerCanPush,
  findOpenPr,
  createPr,
  forkWithRemote,
} from '../scripts/lib/git.mjs';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temps = [];
after(() => {
  for (const d of temps) fs.rmSync(d, { recursive: true, force: true });
});

function tempDir(prefix) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  temps.push(d);
  return d;
}

function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// 인자를 기록하고 정해진 응답을 돌려주는 가짜 gh (셸 없이 실행되도록 shebang 사용)
const FAKE_GH = `
const fs = require('node:fs');
const a = process.argv.slice(2);
if (process.env.FAKE_GH_LOG) fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(a) + '\\n');
const out = (v) => process.stdout.write(typeof v === 'string' ? v + '\\n' : JSON.stringify(v));
if (a[0] === 'api' && a[1] === 'user') out({ login: 'kim', id: 42 });
else if (a[0] === 'api' && a[1].startsWith('repos/')) out({ full_name: a[1].slice(6), permissions: { push: a[1] === 'repos/kim/edu' } });
else if (a[0] === 'pr' && a[1] === 'list') out([
  { url: 'https://github.com/up/edu/pull/1', headRepositoryOwner: { login: 'lee' } },
  { url: 'https://github.com/up/edu/pull/2', headRepositoryOwner: { login: 'Kim' } },
]);
else if (a[0] === 'pr' && a[1] === 'create') {
  if (fs.readFileSync(0, 'utf8') !== '본문\\n둘째 줄') { process.stderr.write('body mismatch'); process.exit(1); }
  out('https://github.com/up/edu/pull/3');
} else { process.stderr.write('unsupported: ' + a.join(' ')); process.exit(1); }
`;

const canFake = process.platform !== 'win32' && !/\s/.test(process.execPath);

function fakeGh() {
  const dir = tempDir('fake-gh-');
  const file = path.join(dir, 'gh');
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"commonjs"}\n');
  fs.writeFileSync(file, `#!${process.execPath}\n${FAKE_GH}`);
  fs.chmodSync(file, 0o755);
  return { file, log: path.join(dir, 'calls.log') };
}

const calls = (log) =>
  fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('compareUrl', () => {
  assert.equal(
    compareUrl('up/edu', 'main', 'kim', 'edu', 'submit/P01'),
    'https://github.com/up/edu/compare/main...kim:submit/P01?expand=1',
  );
  assert.equal(
    compareUrl('up/edu', 'main', 'kim', 'my-edu', 'submit/P01'),
    'https://github.com/up/edu/compare/main...kim:my-edu:submit/P01?expand=1',
  );
  assert.equal(
    compareUrl('up/edu', 'main', '<GitHub계정>', null, 'submit/P01'),
    'https://github.com/up/edu/compare/main...<GitHub계정>:submit/P01?expand=1',
  );
});

test('gh helpers without gh', () =>
  withEnv({ EDU_GH: 'edu-no-such-gh' }, () => {
    assert.notEqual(gh(['--version']).status, 0);
    assert.equal(ghLogin(), null);
    assert.equal(viewerCanPush('up/edu'), null);
    assert.equal(findOpenPr('up/edu', 'kim', 'submit/P01'), null);
    const pr = createPr({ slug: 'up/edu', base: 'main', head: 'kim:submit/P01', title: 't', body: 'b' });
    assert.equal(pr.url, undefined);
    assert.ok(pr.error);
    const fork = forkWithRemote();
    assert.equal(fork.ok, false);
    assert.ok(fork.message);
  }));

test('gh helpers read gh output', { skip: !canFake }, () => {
  const fake = fakeGh();
  withEnv({ EDU_GH: fake.file, FAKE_GH_LOG: fake.log }, () => {
    assert.equal(ghLogin(), 'kim');
    assert.equal(viewerCanPush('kim/edu'), true);
    assert.equal(viewerCanPush('up/edu'), false);
    assert.equal(findOpenPr('up/edu', 'kim', 'submit/P01'), 'https://github.com/up/edu/pull/2');
    assert.equal(findOpenPr('up/edu', 'park', 'submit/P01'), null);
    const list = calls(fake.log).find((a) => a[0] === 'pr' && a[1] === 'list');
    assert.equal(list[list.indexOf('--repo') + 1], 'up/edu');
    assert.equal(list[list.indexOf('--head') + 1], 'submit/P01');

    const pr = createPr({ slug: 'up/edu', base: 'main', head: 'kim:submit/P01', title: '[제출] P01', body: '본문\n둘째 줄' });
    assert.deepEqual(pr, { url: 'https://github.com/up/edu/pull/3' });
    const create = calls(fake.log).find((a) => a[0] === 'pr' && a[1] === 'create');
    for (const [flag, value] of [['--repo', 'up/edu'], ['--base', 'main'], ['--head', 'kim:submit/P01'], ['--title', '[제출] P01']]) {
      assert.equal(create[create.indexOf(flag) + 1], value, flag);
    }

    const fork = forkWithRemote();
    assert.equal(fork.ok, false);
    assert.match(fork.message, /unsupported: repo fork/);
  });
});

// ensureIdentity 는 저장소 설정을 바꾸므로 scripts/ 를 복사한 임시 저장소에서 실행한다.
function identityRepo(env) {
  const repo = tempDir('identity-repo-');
  fs.cpSync(path.join(SRC, 'scripts'), path.join(repo, 'scripts'), { recursive: true });
  const r0 = spawnSync('git', ['init', '-q', '-b', 'main', repo], { encoding: 'utf8' });
  assert.equal(r0.status, 0, r0.stderr);
  const emptyGlobal = path.join(tempDir('identity-cfg-'), 'gitconfig');
  fs.writeFileSync(emptyGlobal, '');
  const childEnv = { ...process.env, GIT_CONFIG_GLOBAL: emptyGlobal, GIT_CONFIG_NOSYSTEM: '1', ...env };
  for (const k of ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'EMAIL']) delete childEnv[k];
  const cfg = (key) => spawnSync('git', ['-C', repo, 'config', '--local', '--get', key], { encoding: 'utf8', env: childEnv }).stdout.trim();
  const ensure = () => {
    const url = pathToFileURL(path.join(repo, 'scripts', 'lib', 'git.mjs')).href;
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', `(await import(${JSON.stringify(url)})).ensureIdentity();`], {
      encoding: 'utf8',
      env: childEnv,
    });
    assert.equal(r.status, 0, r.stderr);
  };
  return { repo, cfg, ensure, env: childEnv };
}

test('ensureIdentity uses gh login', { skip: !canFake }, () => {
  const fake = fakeGh();
  const t = identityRepo({ EDU_GH: fake.file });
  t.ensure();
  assert.equal(t.cfg('user.name'), 'kim');
  assert.equal(t.cfg('user.email'), '42+kim@users.noreply.github.com');
});

test('ensureIdentity without gh avoids the PC account name', () => {
  const t = identityRepo({ EDU_GH: 'edu-no-such-gh' });
  t.ensure();
  const name = t.cfg('user.name');
  const email = t.cfg('user.email');
  assert.ok(name);
  assert.notEqual(name, os.userInfo().username);
  assert.match(email, /@\S+\.invalid$/);
});

test('ensureIdentity keeps an existing identity', () => {
  const t = identityRepo({ EDU_GH: 'edu-no-such-gh' });
  for (const [k, v] of [['user.name', 'Hong'], ['user.email', 'hong@example.com']]) {
    spawnSync('git', ['-C', t.repo, 'config', '--local', k, v], { env: t.env });
  }
  t.ensure();
  assert.equal(t.cfg('user.name'), 'Hong');
  assert.equal(t.cfg('user.email'), 'hong@example.com');
});
