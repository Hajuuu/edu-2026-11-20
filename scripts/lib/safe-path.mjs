// 커밋되는 기록(participant.json)에 넣을 경로를 만든다. 절대 경로와 PC 사용자 이름이 남지 않게 줄인다.
import path from 'node:path';

// roots: { repo, home, appData, platform }. 저장소 안이면 저장소 기준 경로, 홈 안이면 ~/...,
// AppData 안이면 %APPDATA%/...(Windows) 또는 <AppData>/... 로 쓰고, 어디에도 속하지 않으면
// (다른 드라이브, 네트워크 경로 등) 파일 이름만 남긴다. 파일 시스템은 읽지 않는다.
export function safePath(p, roots = {}) {
  const platform = roots.platform || process.platform;
  const P = platform === 'win32' ? path.win32 : path.posix;
  const within = (base) => {
    if (!base) return null;
    const rel = P.relative(base, p);
    if (!rel || P.isAbsolute(rel) || rel === '..' || rel.startsWith(`..${P.sep}`)) return null;
    return rel.split(P.sep).join('/');
  };
  const appData = platform === 'win32' ? '%APPDATA%' : '<AppData>';
  for (const [base, prefix] of [
    [roots.repo, ''],
    [roots.home, '~/'],
    [roots.appData, `${appData}/`],
  ]) {
    const rel = within(base);
    if (rel) return prefix + rel;
  }
  return `…/${P.basename(p)}`;
}
