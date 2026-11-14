// git 호출 도우미. Node 내장 모듈만 사용한다.
import { REPO_ROOT, run } from './env.mjs';

export function git(args, opts = {}) {
  return run('git', ['-C', REPO_ROOT, ...args], opts);
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
