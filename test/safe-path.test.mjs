// 커밋되는 기록용 경로 축약: 실제 파일 시스템 없이 경로 문자열만으로 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { safePath } from '../scripts/lib/safe-path.mjs';

const WIN = {
  repo: 'C:\\work\\edu-2026-11-20',
  home: 'C:\\Users\\hong.gildong',
  appData: '\\\\fs01\\profiles$\\hong.gildong\\AppData\\Roaming',
  platform: 'win32',
};

function expectSafe(p, roots, expected) {
  const out = safePath(p, roots);
  assert.equal(out, expected, p);
  assert.doesNotMatch(out, /hong/i, `사용자 이름이 남으면 안 됩니다: ${out}`);
  assert.doesNotMatch(out, /^([A-Za-z]:|[\\/])/, `절대 경로가 남으면 안 됩니다: ${out}`);
}

test('windows: AppData redirected to a UNC share', () => {
  expectSafe('\\\\fs01\\profiles$\\hong.gildong\\AppData\\Roaming\\Code\\User\\mcp.json', WIN, '%APPDATA%/Code/User/mcp.json');
});

test('windows: another drive or an unrelated UNC path keeps only the file name', () => {
  expectSafe('D:\\Users\\hong.gildong\\AGENTS.md', WIN, '…/AGENTS.md');
  expectSafe('\\\\fs01\\home\\hong.gildong\\.codex\\config.toml', WIN, '…/config.toml');
  expectSafe('\\\\fs01\\home\\hong.gildong\\.claude\\rules', WIN, '…/rules');
});

test('windows: repo, home and local AppData, ignoring case', () => {
  expectSafe('C:\\work\\edu-2026-11-20\\submissions\\AGENTS.md', WIN, 'submissions/AGENTS.md');
  expectSafe('c:\\users\\HONG.GILDONG\\.codex\\config.toml', WIN, '~/.codex/config.toml');
  const local = { ...WIN, appData: 'C:\\Users\\hong.gildong\\AppData\\Roaming' };
  expectSafe('C:\\Users\\hong.gildong\\AppData\\Roaming\\Code\\User\\mcp.json', local, '~/AppData/Roaming/Code/User/mcp.json');
});

test('posix: repo, home and outside paths', () => {
  const roots = {
    repo: '/Users/hong/edu-2026-11-20',
    home: '/Users/hong',
    appData: '/Users/hong/Library/Application Support',
    platform: 'darwin',
  };
  expectSafe('/Users/hong/edu-2026-11-20/submissions/CLAUDE.md', roots, 'submissions/CLAUDE.md');
  expectSafe('/Users/hong/.claude.json', roots, '~/.claude.json');
  expectSafe('/Users/hong/Library/Application Support/Code/User/mcp.json', roots, '~/Library/Application Support/Code/User/mcp.json');
  expectSafe('/Volumes/share/hong/AGENTS.md', roots, '…/AGENTS.md');
  expectSafe('/AGENTS.md', roots, '…/AGENTS.md');
  expectSafe('/Users/hong/..hidden/AGENTS.md', roots, '~/..hidden/AGENTS.md');
});

test('xdg config outside home uses the AppData label', () => {
  const roots = { repo: '/srv/edu', home: '/home/hong', appData: '/cfg/hong', platform: 'linux' };
  expectSafe('/cfg/hong/Code/User/mcp.json', roots, '<AppData>/Code/User/mcp.json');
});
