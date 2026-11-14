// git 과 GitHub CLI(gh) 호출 도우미. Node 내장 모듈만 사용한다.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, IS_WIN, run, log, fail } from './env.mjs';

export function git(args, opts = {}) {
  return run('git', ['-C', REPO_ROOT, ...args], opts);
}

function canonical(p) {
  let r;
  try {
    r = fs.realpathSync.native(p);
  } catch {
    r = path.resolve(p);
  }
  return IS_WIN ? r.toLowerCase() : r;
}

// 이 스크립트가 들어 있는 폴더가 git 저장소의 루트인지 확인하고, 아니면 이유를 알리고 끝낸다
// (ZIP 으로 받은 폴더, 다른 저장소 안의 복사본에서 git 명령이 바깥 저장소에 적용되는 것을 막는다).
export function requireRepoRoot() {
  const top = git(['rev-parse', '--show-toplevel']);
  if (top.error) fail('Git 을 찾지 못했습니다. Git 을 설치하고 터미널을 다시 연 뒤 실행해 주세요.');
  if (top.status === 0 && canonical(top.stdout.trim()) === canonical(REPO_ROOT)) return;
  log.err(`이 폴더(${REPO_ROOT})는 git 으로 clone 한 저장소의 루트가 아닙니다. 본인의 Fork 를 git clone 한 폴더에서 실행해 주세요.`);
  const why = top.status === 0 ? '' : (top.stderr || '').trim();
  if (why) console.error(`  git 메시지: ${why}`);
  process.exit(1);
}

// 원격 URL 을 owner/repo 로 바꾼다. GitHub 형식이 아니면 null.
export function parseSlug(url) {
  const u = String(url || '').trim();
  const m =
    u.match(/^https:\/\/(?:[^@/]+@)?github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/) ||
    u.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/) ||
    u.match(/^ssh:\/\/git@github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

export function remoteSlug(remote = 'origin') {
  const r = git(['remote', 'get-url', remote]);
  if (r.status !== 0) return null;
  return parseSlug(r.stdout);
}

// 지금 브랜치 이름. 분리된 HEAD 이면 빈 문자열.
export function currentBranch() {
  const r = git(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  return r.status === 0 ? r.stdout.trim() : '';
}

function refExists(ref) {
  return git(['show-ref', '--verify', '--quiet', ref]).status === 0;
}

export function branchExists(name) {
  return refExists(`refs/heads/${name}`);
}

function gitMessage(r) {
  if (r.error) return `git 을 실행할 수 없습니다: ${r.error.message}`;
  return (r.stderr || r.stdout || '').trim() || `git 이 종료 코드 ${r.status} 로 끝났습니다.`;
}

// name 브랜치로 전환한다. 로컬에 없으면 로컬 base(없으면 origin/base)에서 만들고, 출발점을 from 으로 알려 준다.
// origin 에만 있는 같은 이름의 브랜치는 이어 받지 않는다 (원본 저장소의 리허설 브랜치가 Fork 에 복사될 수 있음).
export function ensureBranch(name, base) {
  if (currentBranch() === name) return { ok: true, created: false };
  if (branchExists(name)) {
    const r = git(['switch', name]);
    return r.status === 0 ? { ok: true, created: false } : { ok: false, created: false, message: gitMessage(r) };
  }
  let start = null;
  if (refExists(`refs/heads/${base}`)) start = base;
  else if (refExists(`refs/remotes/origin/${base}`)) start = `origin/${base}`;
  if (!start) {
    return { ok: false, created: false, message: `기준 브랜치 ${base} 를 로컬과 origin 어디에서도 찾을 수 없습니다.` };
  }
  const r = git(['switch', '--no-track', '-c', name, start]);
  return r.status === 0 ? { ok: true, created: true, from: start } : { ok: false, created: false, message: gitMessage(r) };
}

// gh 명령 이름은 EDU_GH 환경 변수로 바꿀 수 있다 (시험용).
export function gh(args, opts = {}) {
  return run(process.env.EDU_GH || 'gh', args, { cwd: REPO_ROOT, ...opts });
}

function ghJson(args) {
  const r = gh(args);
  if (r.status !== 0) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

function ghUser() {
  const u = ghJson(['api', 'user']);
  return u && typeof u.login === 'string' && u.login ? u : null;
}

export function ghLogin() {
  return ghUser()?.login ?? null;
}

const FALLBACK_IDENTITY = { name: 'edu-participant', email: 'edu-participant@example.invalid' };

// 커밋에 쓸 사용자 정보가 없으면 이 저장소에만 설정한다. git 이 PC 계정 이름으로 추측하지 않게 한다.
export function ensureIdentity() {
  const get = (key) => {
    const r = git(['config', '--get', key]);
    return r.status === 0 ? r.stdout.trim() : '';
  };
  const name = get('user.name');
  const email = get('user.email');
  if (name && email) return;
  const user = ghUser();
  const want = user
    ? {
        name: user.login,
        email: user.id ? `${user.id}+${user.login}@users.noreply.github.com` : `${user.login}@users.noreply.github.com`,
      }
    : FALLBACK_IDENTITY;
  if (!name) git(['config', '--local', 'user.name', want.name]);
  if (!email) git(['config', '--local', 'user.email', want.email]);
}

// 로그인한 계정이 slug 저장소에 push 할 수 있으면 true, 없으면 false, 알 수 없으면 null.
export function viewerCanPush(slug) {
  const repo = ghJson(['api', `repos/${slug}`]);
  const push = repo && repo.permissions ? repo.permissions.push : undefined;
  return typeof push === 'boolean' ? push : null;
}

// slug 저장소에 headOwner 계정의 branch 로 열린 PR 이 있으면 그 주소.
export function findOpenPr(slug, headOwner, branch) {
  const list = ghJson([
    'pr', 'list',
    '--repo', slug,
    '--state', 'open',
    '--head', branch,
    '--json', 'url,headRepositoryOwner',
    '--limit', '100',
  ]);
  if (!Array.isArray(list)) return null;
  const owner = String(headOwner || '').toLowerCase();
  const pr = list.find((p) => String(p?.headRepositoryOwner?.login || '').toLowerCase() === owner);
  return pr && pr.url ? pr.url : null;
}

export function createPr({ slug, base, head, title, body }) {
  const r = gh(
    ['pr', 'create', '--repo', slug, '--base', base, '--head', head, '--title', title, '--body-file', '-'],
    { input: body ?? '' },
  );
  if (r.status === 0) {
    const url = r.stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^https?:\/\//.test(l)).pop();
    if (url) return { url };
  }
  if (r.error) return { error: `gh 를 실행할 수 없습니다: ${r.error.message}` };
  return { error: (r.stderr || r.stdout || '').trim() || `gh 가 종료 코드 ${r.status} 로 끝났습니다.` };
}

// 지금 origin 저장소를 Fork 하고, Fork 를 origin 으로, 원래 origin 을 upstream 으로 바꾼다.
// --remote-name 을 직접 주면 gh 가 기존 origin 의 이름을 바꾸지 않으므로 기본값에 맡긴다.
// --default-branch-only: 원본 저장소의 다른 브랜치(진행자 리허설 브랜치 등)가 교육생 Fork 에 복사되지 않게 한다.
export const FORK_ARGS = ['repo', 'fork', '--remote', '--default-branch-only'];

export function forkWithRemote() {
  const r = gh(FORK_ARGS);
  const text = `${r.stdout || ''}\n${r.stderr || ''}`.trim();
  if (r.error) return { ok: false, message: `gh 를 실행할 수 없습니다: ${r.error.message}` };
  return { ok: r.status === 0, message: text || (r.status === 0 ? 'Fork 를 만들었습니다.' : `gh 가 종료 코드 ${r.status} 로 끝났습니다.`) };
}

// gh 를 쓸 수 없을 때 브라우저로 PR 을 만드는 비교 주소. Fork 이름이 원본과 같으면 저장소 이름을 생략한다.
export function compareUrl(slug, base, headOwner, headRepo, branch) {
  const repoName = String(slug).split('/')[1];
  const head = headRepo && headRepo !== repoName ? `${headOwner}:${headRepo}:${branch}` : `${headOwner}:${branch}`;
  return `https://github.com/${slug}/compare/${base}...${head}?expand=1`;
}
