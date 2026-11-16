// gh 계정 읽기와 제출 계정 고르기 시험. gh auth status 의 두 출력 형식(--json, 사람용)을 읽고,
// 가짜 gh(EDU_GH)와 가짜 선택 함수로 chooseAccount 의 흐름(묻기, 활성 계정 바꾸기, 그만두기)을 확인한다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseAuthJson, parseAuthText, accountLines, listAccounts, chooseAccount } from '../scripts/lib/gh-account.mjs';
import { removeTemps, tempDir } from './helpers.mjs';

after(removeTemps);

// gh 2.76 의 사람용 출력 (활성 계정이 먼저 나오고, 로그인에 실패한 계정은 X 로 시작한다)
const TEXT = `github.com
  ✓ Logged in to github.com account kim (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token: gho_************************************
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'

  X Failed to log in to github.com account old-bad (keyring)
  - Active account: false
  - The token in keyring is invalid.
  - To re-authenticate, run: gh auth login -h github.com
  - To forget about this account, run: gh auth logout -h github.com -u old-bad

  ✓ Logged in to github.com account lee (keyring)
  - Active account: false
  - Git operations protocol: https

ghe.example.com
  ✓ Logged in to ghe.example.com account corp (keyring)
  - Active account: true
`;

test('parse the text output of gh auth status', () => {
  assert.deepEqual(parseAuthText(TEXT), [
    { login: 'kim', active: true, state: 'success', ok: true, source: 'keyring' },
    { login: 'old-bad', active: false, state: 'error', ok: false, source: 'keyring' },
    { login: 'lee', active: false, state: 'success', ok: true, source: 'keyring' },
  ]);
  assert.deepEqual(parseAuthText(TEXT, 'ghe.example.com').map((a) => a.login), ['corp']);
  // 시간 초과, 만료, 색 코드
  const other = parseAuthText(
    [
      '  X Timeout trying to log in to github.com account slow (keyring)',
      '  - Active account: true',
      '  X Token for github.com account exp (keyring) has expired',
      '  - Active account: false',
      '  \u001b[32m✓\u001b[0m Logged in to github.com account \u001b[1mcolor\u001b[0m (keyring)',
      '  - Active account: \u001b[1mfalse\u001b[0m',
    ].join('\n'),
  );
  assert.deepEqual(
    other.map((a) => [a.login, a.state, a.ok, a.active]),
    [
      ['slow', 'timeout', false, true],
      ['exp', 'expired', false, false],
      ['color', 'success', true, false],
    ],
  );
  // 여러 계정을 지원하기 전의 gh: Active account 줄이 없으면 하나뿐인 계정이 활성 계정이다.
  assert.deepEqual(parseAuthText('github.com\n  ✓ Logged in to github.com as solo (keyring)\n')[0].active, true);
  assert.deepEqual(parseAuthText('You are not logged into any GitHub hosts. To log in, run: gh auth login'), []);
});

test('parse the json output of gh auth status', () => {
  const doc = {
    hosts: {
      'github.com': [
        { state: 'success', active: true, host: 'github.com', login: 'kim', tokenSource: 'keyring', gitProtocol: 'https' },
        { state: 'error', error: 'bad token', active: false, host: 'github.com', login: 'old-bad', tokenSource: 'keyring' },
      ],
    },
  };
  assert.deepEqual(parseAuthJson(JSON.stringify(doc)), [
    { login: 'kim', active: true, state: 'success', ok: true, source: 'keyring' },
    { login: 'old-bad', active: false, state: 'error', ok: false, source: 'keyring' },
  ]);
  assert.deepEqual(parseAuthJson('{"hosts":{}}'), []);
  assert.equal(parseAuthJson('unknown flag: --json'), null);
  assert.equal(parseAuthJson('[]'), null);
});

test('account lines show Active account and notes', () => {
  const lines = accountLines(parseAuthText(TEXT), 'LEE');
  assert.deepEqual(lines, [
    'kim      Active account: true',
    'old-bad  Active account: false  (로그인 실패)',
    'lee      Active account: false  (origin 저장소의 계정)',
  ]);
});

// 가짜 gh: FAKE_GH_ACCOUNTS 의 계정으로 auth status 에 답하고, auth switch 로 바꾼 활성 계정은 상태 파일에 남긴다.
// FAKE_GH_NO_JSON=1 이면 --json 을 모르는 예전 gh 처럼 실패한다. FAKE_GH_SWITCH_FAIL=1 이면 auth switch 가 실패한다.
const FAKE_GH = `
const fs = require('node:fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(a) + '\\n');
const stateFile = process.env.FAKE_GH_STATE;
const accounts = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : JSON.parse(process.env.FAKE_GH_ACCOUNTS);
if (a[0] === 'auth' && a[1] === 'status') {
  const list = accounts.filter((x) => !a.includes('--active') || x.active);
  if (a.includes('--json')) {
    if (process.env.FAKE_GH_NO_JSON === '1') { process.stderr.write('unknown flag: --json\\n'); process.exit(1); }
    const entries = list.map((x) => ({ state: x.state || 'success', active: Boolean(x.active), host: 'github.com', login: x.login, tokenSource: x.source || 'keyring', gitProtocol: 'https' }));
    process.stdout.write(JSON.stringify({ hosts: entries.length ? { 'github.com': entries } : {} }));
    process.exit(0);
  }
  const text = ['github.com', ...list.map((x) => (x.state || 'success') === 'success'
    ? '  ✓ Logged in to github.com account ' + x.login + ' (keyring)\\n  - Active account: ' + Boolean(x.active)
    : '  X Failed to log in to github.com account ' + x.login + ' (keyring)\\n  - Active account: ' + Boolean(x.active) + '\\n  - The token in keyring is invalid.')].join('\\n') + '\\n';
  const failed = list.some((x) => (x.state || 'success') !== 'success');
  (failed ? process.stderr : process.stdout).write(text);
  process.exit(failed ? 1 : 0);
}
if (a[0] === 'auth' && a[1] === 'switch') {
  if (process.env.FAKE_GH_SWITCH_FAIL === '1') { process.stderr.write('switch denied\\n'); process.exit(1); }
  const user = a[a.indexOf('--user') + 1];
  for (const x of accounts) x.active = x.login === user;
  fs.writeFileSync(stateFile, JSON.stringify(accounts));
  process.exit(0);
}
process.stderr.write('unsupported: ' + a.join(' '));
process.exit(1);
`;

const canFake = process.platform !== 'win32' && !/\s/.test(process.execPath);

function fakeGh(accounts, extraEnv = {}) {
  const dir = tempDir('edu-fake-gh-');
  const file = path.join(dir, 'gh');
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"commonjs"}\n');
  fs.writeFileSync(file, `#!${process.execPath}\n${FAKE_GH}`);
  fs.chmodSync(file, 0o755);
  const logFile = path.join(dir, 'calls.log');
  fs.writeFileSync(logFile, '');
  const env = {
    EDU_GH: file,
    FAKE_GH_LOG: logFile,
    FAKE_GH_STATE: path.join(dir, 'state.json'),
    FAKE_GH_ACCOUNTS: JSON.stringify(accounts),
    ...extraEnv,
  };
  return {
    env,
    calls: () => fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)),
  };
}

// process.env 를 잠시 바꾸고 콘솔 출력을 모아 fn 을 실행한다.
async function withGh(gh, fn) {
  const saved = {};
  for (const k of Object.keys(gh.env)) saved[k] = process.env[k];
  Object.assign(process.env, gh.env);
  const out = [];
  const keep = { log: console.log, error: console.error };
  console.log = (...m) => out.push(m.join(' '));
  console.error = (...m) => out.push(m.join(' '));
  try {
    const result = await fn();
    return { result, out: out.join('\n') };
  } finally {
    Object.assign(console, keep);
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const TWO = [
  { login: 'kim', active: true },
  { login: 'old-bad', state: 'error' },
  { login: 'lee' },
];
const switches = (gh) => gh.calls().filter((c) => c[0] === 'auth' && c[1] === 'switch');

test('listAccounts falls back to the text output when --json is unknown', { skip: !canFake }, async () => {
  for (const noJson of ['0', '1']) {
    const gh = fakeGh(TWO, { FAKE_GH_NO_JSON: noJson });
    const { result } = await withGh(gh, () => listAccounts());
    assert.equal(result.found, true);
    assert.deepEqual(
      result.accounts.map((a) => [a.login, a.active, a.ok]),
      [
        ['kim', true, true],
        ['old-bad', false, false],
        ['lee', false, true],
      ],
      `noJson=${noJson}`,
    );
  }
  const missing = await withGh({ env: { EDU_GH: 'edu-no-such-gh' } }, () => listAccounts());
  assert.deepEqual(missing.result, { found: false, accounts: [] });
});

test('choosing another account makes it the active account', { skip: !canFake }, async () => {
  const gh = fakeGh(TWO);
  let shown;
  const select = async (items, { initial }) => {
    shown = { items, initial };
    return 2;
  };
  const { result, out } = await withGh(gh, () => chooseAccount({ interactive: true, select, originOwner: 'lee' }));
  assert.deepEqual(result, { ok: true, login: 'lee' });
  // 커서는 활성 계정에서 시작하고, 로그인에 실패한 계정은 고를 수 없다.
  assert.equal(shown.initial, 0);
  assert.deepEqual(shown.items.map((i) => Boolean(i.disabled)), [false, true, false]);
  assert.match(shown.items[0].label, /^kim\s+Active account: true$/);
  assert.match(shown.items[2].label, /origin 저장소의 계정/);
  assert.deepEqual(switches(gh), [['auth', 'switch', '--hostname', 'github.com', '--user', 'lee']]);
  assert.match(out, /\[완료\] lee 계정을 활성 계정\(Active account: true\)으로 바꿨습니다/);
  // 바꾼 뒤 활성 계정만 다시 읽어 확인한다.
  assert.ok(gh.calls().some((c) => c[1] === 'status' && c.includes('--active')));
});

test('keeping the active account does not switch', { skip: !canFake }, async () => {
  const gh = fakeGh(TWO);
  const { result, out } = await withGh(gh, () => chooseAccount({ interactive: true, select: async () => 0 }));
  assert.deepEqual(result, { ok: true, login: 'kim' });
  assert.deepEqual(switches(gh), []);
  assert.match(out, /\[완료\] 활성 계정\(kim\)으로 제출합니다/);
});

test('dry run shows the switch command without switching', { skip: !canFake }, async () => {
  const gh = fakeGh(TWO);
  const { result, out } = await withGh(gh, () => chooseAccount({ interactive: true, dryRun: true, select: async () => 2 }));
  assert.deepEqual(result, { ok: true, login: 'lee' });
  assert.deepEqual(switches(gh), []);
  assert.ok(out.includes('실행할 명령: gh auth switch --hostname github.com --user lee'), out);
});

test('cancel and a failed switch stop the submit', { skip: !canFake }, async () => {
  let gh = fakeGh(TWO);
  let r = await withGh(gh, () => chooseAccount({ interactive: true, select: async () => null }));
  assert.deepEqual(r.result, { ok: false, cancelled: true });
  assert.match(r.out, /계정 선택을 그만두어 제출하지 않았습니다/);

  gh = fakeGh(TWO, { FAKE_GH_SWITCH_FAIL: '1' });
  r = await withGh(gh, () => chooseAccount({ interactive: true, select: async () => 2 }));
  assert.deepEqual(r.result, { ok: false });
  assert.match(r.out, /\[오류\] lee 계정을 활성 계정으로 바꾸지 못했습니다/);
  assert.match(r.out, /switch denied/);
  assert.match(r.out, /아직 커밋이나 push 는 하지 않았습니다/);
});

test('without a terminal the active account is used and the list is shown', { skip: !canFake }, async () => {
  const gh = fakeGh(TWO);
  let asked = false;
  const { result, out } = await withGh(gh, () =>
    chooseAccount({
      interactive: false,
      select: async () => {
        asked = true;
        return 2;
      },
    }),
  );
  assert.equal(asked, false);
  assert.deepEqual(result, { ok: true, login: 'kim' });
  for (const s of ['kim      Active account: true', 'old-bad  Active account: false  (로그인 실패)', 'lee      Active account: false']) {
    assert.ok(out.includes(s), `${s}\n${out}`);
  }
  assert.deepEqual(switches(gh), []);
});

test('a single account or a failed active account is reported without asking', { skip: !canFake }, async () => {
  const ask = async () => assert.fail('묻지 않아야 합니다');
  let gh = fakeGh([{ login: 'kim', active: true }]);
  let r = await withGh(gh, () => chooseAccount({ interactive: true, select: ask }));
  assert.deepEqual(r.result, { ok: true, login: 'kim' });

  gh = fakeGh([{ login: 'kim', active: true, state: 'error' }]);
  r = await withGh(gh, () => chooseAccount({ interactive: true, select: ask }));
  assert.deepEqual(r.result, { ok: true, login: 'kim' });
  assert.match(r.out, /\[주의\] 활성 계정\(kim\)의 로그인을 확인하지 못해[^\n]*gh auth login/);

  gh = fakeGh([]);
  r = await withGh(gh, () => chooseAccount({ interactive: true, select: ask }));
  assert.deepEqual(r.result, { ok: true, login: null });
  assert.match(r.out, /\[주의\] gh 에 로그인된 github\.com 계정이 없어/);

  // 환경 변수의 토큰은 바꿀 수 없으므로 묻지 않는다.
  gh = fakeGh([{ login: 'tok', active: true, source: 'GH_TOKEN' }, { login: 'kim' }]);
  r = await withGh(gh, () => chooseAccount({ interactive: true, select: ask }));
  assert.deepEqual(r.result, { ok: true, login: 'tok' });
  assert.match(r.out, /환경 변수 GH_TOKEN 의 토큰이 쓰이고 있어/);
});

test('when the active account failed the cursor starts on a usable account', { skip: !canFake }, async () => {
  const gh = fakeGh([
    { login: 'bad', active: true, state: 'error' },
    { login: 'kim' },
  ]);
  let initial;
  const { result } = await withGh(gh, () =>
    chooseAccount({
      interactive: true,
      select: async (items, opts) => {
        initial = opts.initial;
        return opts.initial;
      },
    }),
  );
  assert.equal(initial, 1);
  assert.deepEqual(result, { ok: true, login: 'kim' });
  assert.deepEqual(switches(gh), [['auth', 'switch', '--hostname', 'github.com', '--user', 'kim']]);
});
