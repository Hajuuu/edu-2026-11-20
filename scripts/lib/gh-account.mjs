// gh 에 로그인된 GitHub 계정을 읽고, 제출에 쓸 계정을 골라 활성 계정(Active account: true)으로 바꾼다.
// push(gh 의 git 자격 증명)와 PR 만들기는 활성 계정으로 진행된다. Node 내장 모듈만 사용한다.
import { gh } from './git.mjs';
import { log } from './env.mjs';
import { selectOne, displayWidth } from './select.mjs';

export const GH_HOST = 'github.com';
export const LOGIN_HELP = 'README 의 1.2 절에 따라 토큰으로 gh auth login 을 실행해 로그인해 주세요.';

// 환경 변수의 토큰은 gh 가 늘 먼저 쓰므로 gh auth switch 로 활성 계정을 바꿀 수 없다.
const ENV_TOKEN = /^(GH|GITHUB)_(ENTERPRISE_)?TOKEN$/;
// gh auth status 의 사람용 출력에서 계정 머리 줄의 문구와 상태 (gh 의 상태 이름과 같게 둔다)
const HEAD_STATE = {
  'Logged in to': 'success',
  'Failed to log in to': 'error',
  'Timeout trying to log in to': 'timeout',
  'Token for': 'expired',
};
const STATE_TEXT = { error: '로그인 실패', timeout: '로그인 확인 시간 초과', expired: '토큰 만료', refresh_expired: '토큰 만료' };

const account = (login, active, state, source) => ({ login, active, state, ok: state === 'success', source });

// gh auth status --json hosts 의 출력(gh 2.8x 이상). 형식이 다르면 null.
export function parseAuthJson(text, host = GH_HOST) {
  let doc;
  try {
    doc = JSON.parse(String(text ?? ''));
  } catch {
    return null;
  }
  if (!doc || typeof doc !== 'object' || !doc.hosts || typeof doc.hosts !== 'object') return null;
  const list = Array.isArray(doc.hosts[host]) ? doc.hosts[host] : [];
  return list
    .filter((e) => e && typeof e.login === 'string' && e.login)
    .map((e) => account(e.login, e.active === true, String(e.state || ''), String(e.tokenSource || '')));
}

// --json 이 없는 gh 의 사람용 출력. 계정마다 머리 줄 다음에 "- Active account: true|false" 줄이 온다.
export function parseAuthText(text, host = GH_HOST) {
  const out = [];
  let cur = null;
  let sawActive = false;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.replace(/\u001b\[[0-9;]*m/g, '');
    const head = line.match(/(Logged in to|Failed to log in to|Timeout trying to log in to|Token for) (\S+) (?:account|as) (\S+) \(([^)]*)\)/);
    const refresh = head ? null : line.match(/Refresh token for (\S+) account (\S+) was rejected/);
    if (head || refresh) {
      const [h, login, state, source] = head ? [head[2], head[3], HEAD_STATE[head[1]], head[4]] : [refresh[1], refresh[2], 'refresh_expired', ''];
      cur = h === host ? account(login, false, state, source) : null;
      if (cur) out.push(cur);
      continue;
    }
    const act = line.match(/^\s*-\s*Active account:\s*(true|false)\b/);
    if (act) {
      sawActive = true;
      if (cur) cur.active = act[1] === 'true';
    }
  }
  // 여러 계정을 지원하기 전의 gh 는 호스트마다 계정이 하나이고 Active account 줄이 없다.
  if (!sawActive && out.length === 1) out[0].active = true;
  return out;
}

// { found: gh 를 실행할 수 있는지, accounts }. --json 을 먼저 쓰고, 지원하지 않는 gh 이면 사람용 출력을 읽는다.
export function listAccounts({ host = GH_HOST, activeOnly = false } = {}) {
  const base = ['auth', 'status', '--hostname', host, ...(activeOnly ? ['--active'] : [])];
  const j = gh([...base, '--json', 'hosts']);
  if (j.error) return { found: false, accounts: [] };
  const parsed = j.status === 0 ? parseAuthJson(j.stdout, host) : null;
  if (parsed) return { found: true, accounts: parsed };
  const t = gh(base);
  if (t.error) return { found: false, accounts: [] };
  return { found: true, accounts: parseAuthText(`${t.stdout}\n${t.stderr}`, host) };
}

export const switchArgs = (login, host = GH_HOST) => ['auth', 'switch', '--hostname', host, '--user', login];

export function switchAccount(login, host = GH_HOST) {
  const r = gh(switchArgs(login, host));
  if (r.status === 0) return { ok: true };
  if (r.error) return { ok: false, error: `gh 를 실행할 수 없습니다: ${r.error.message}` };
  return { ok: false, error: (r.stderr || r.stdout || '').trim() || `gh 가 종료 코드 ${r.status} 로 끝났습니다.` };
}

// 목록에 보일 줄: 계정 이름, Active account 값, 로그인 상태와 origin 저장소의 계정인지
export function accountLines(accounts, originOwner = null) {
  const width = Math.max(...accounts.map((a) => displayWidth(a.login)));
  const owner = String(originOwner || '').toLowerCase();
  return accounts.map((a) => {
    const notes = [];
    if (!a.ok) notes.push(STATE_TEXT[a.state] || '로그인 실패');
    if (owner && a.login.toLowerCase() === owner) notes.push('origin 저장소의 계정');
    const pad = ' '.repeat(width - displayWidth(a.login));
    return `${a.login}${pad}  Active account: ${a.active ? 'true ' : 'false'}${notes.length ? `  (${notes.join(', ')})` : ''}`.trimEnd();
  });
}

const errLines = (text) => String(text || '').split(/\r?\n/).filter((l) => l.trim());

// 제출에 쓸 계정을 정한다. 계정이 둘 이상이고 터미널에서 실행했으면(interactive) ↑↓ 와 Enter 로 고르게 하고,
// 고른 계정이 활성 계정이 아니면 gh auth switch 로 활성 계정으로 바꾼다. 터미널이 아니면 묻지 않고 지금의 활성 계정을 쓴다.
// 돌려주는 값: { ok, login, cancelled }. ok 가 거짓이면 제출을 멈춘다 (이때는 아직 커밋도 push 도 하지 않았다).
// gh 가 없거나 로그인한 계정이 없으면 알리기만 하고 진행한다 (push 와 PR 단계가 따로 안내한다).
export async function chooseAccount({ dryRun = false, interactive = false, originOwner = null, select = selectOne, host = GH_HOST } = {}) {
  log.step('제출에 쓸 GitHub 계정을 확인합니다.');
  const { found, accounts } = listAccounts({ host });
  if (!found) {
    log.warn('GitHub CLI(gh)를 찾지 못해 GitHub 계정을 확인하지 않고 진행합니다.');
    return { ok: true, login: null };
  }
  if (!accounts.length) {
    log.warn(`gh 에 로그인된 ${host} 계정이 없어 push 나 PR 만들기가 실패할 수 있습니다. ${LOGIN_HELP}`);
    return { ok: true, login: null };
  }
  const active = accounts.find((a) => a.active) || null;
  const usable = accounts.filter((a) => a.ok);
  const lines = accountLines(accounts, originOwner);
  const envToken = Boolean(active && ENV_TOKEN.test(active.source));
  log.info(`  gh 에 로그인된 ${host} 계정은 다음과 같습니다. 지금 쓰는 계정은 Active account: true 로 표시됩니다.`);

  if (!(interactive && !envToken && usable.length && accounts.length > 1)) {
    for (const l of lines) log.info(`    ${l}`);
    if (envToken) {
      log.warn(`환경 변수 ${active.source} 의 토큰이 쓰이고 있어 활성 계정을 바꿀 수 없습니다. ${active.login} 계정으로 제출합니다.`);
    } else if (active?.ok) {
      log.ok(`활성 계정(${active.login})으로 제출합니다.`);
    } else {
      log.warn(`활성 계정${active ? `(${active.login})` : ''}의 로그인을 확인하지 못해 push 나 PR 만들기가 실패할 수 있습니다. ${LOGIN_HELP}`);
      if (usable.length) {
        log.info(`  로그인된 다른 계정으로 제출하려면 gh ${switchArgs('<계정>', host).join(' ')} 로 활성 계정을 바꾼 뒤 npm run submit 을 다시 실행해 주세요.`);
      }
    }
    return { ok: true, login: active?.login ?? null };
  }

  log.info('  ↑↓ 키로 제출에 쓸 계정을 고르고 Enter 를 누릅니다. 로그인에 실패한 계정은 고를 수 없습니다. (Esc: 제출 그만두기)');
  const initial = accounts.indexOf(active?.ok ? active : usable[0]);
  const picked = await select(
    accounts.map((a, i) => ({ label: lines[i], disabled: !a.ok, doneLabel: `${a.login} 계정을 골랐습니다.` })),
    { initial },
  );
  if (picked === null || picked === undefined) {
    log.warn('계정 선택을 그만두어 제출하지 않았습니다. 다시 제출하려면 npm run submit 을 실행해 주세요.');
    return { ok: false, cancelled: true };
  }
  const chosen = accounts[picked];
  if (chosen.active) {
    log.ok(`활성 계정(${chosen.login})으로 제출합니다.`);
    return { ok: true, login: chosen.login };
  }
  if (dryRun) {
    log.info(`  실행할 명령: gh ${switchArgs(chosen.login, host).join(' ')}`);
    log.ok(`--dry-run 이라 활성 계정은 바꾸지 않았습니다. 실제로 제출하면 ${chosen.login} 계정을 활성 계정으로 바꾼 뒤 제출합니다.`);
    return { ok: true, login: chosen.login };
  }
  const r = switchAccount(chosen.login, host);
  // 바꾼 뒤 활성 계정을 다시 읽어 확인한다. 읽지 못하면 gh auth switch 의 결과를 믿는다.
  const now = r.ok ? listAccounts({ host, activeOnly: true }).accounts.find((a) => a.active) : null;
  if (!r.ok || (now && now.login !== chosen.login)) {
    log.err(`${chosen.login} 계정을 활성 계정으로 바꾸지 못했습니다.${r.ok ? ` 지금 활성 계정은 ${now.login} 입니다.` : ' gh 가 알려 준 내용은 다음과 같습니다.'}`);
    for (const l of errLines(r.error)) console.error(`    ${l}`);
    console.error('  gh auth status 로 계정 상태를 확인한 뒤 npm run submit 을 다시 실행해 주세요. 아직 커밋이나 push 는 하지 않았습니다.');
    return { ok: false };
  }
  log.ok(`${chosen.login} 계정을 활성 계정(Active account: true)으로 바꿨습니다. 이 계정으로 제출합니다.`);
  return { ok: true, login: chosen.login };
}
