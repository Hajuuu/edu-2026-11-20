// MCP 번들(.tgz)을 찾아 npx 로 띄우는 명령을 만들고, 외부 tar 없이 tar 를 푼다(채점 수집이 쓴다). Node 내장 모듈만 사용한다.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { REPO_ROOT, IS_WIN, platformKey } from './env.mjs';

const BLOCK = 512;

function cstr(buf, start, end) {
  const slice = buf.subarray(start, end);
  const nul = slice.indexOf(0);
  return slice.subarray(0, nul < 0 ? slice.length : nul).toString('utf8');
}

function octal(buf, start, end) {
  const s = cstr(buf, start, end).trim();
  return s ? parseInt(s, 8) : 0;
}

function parsePax(data) {
  const out = {};
  let pos = 0;
  while (pos < data.length) {
    const sp = data.indexOf(0x20, pos);
    if (sp < 0) break;
    const len = parseInt(data.subarray(pos, sp).toString('utf8'), 10);
    if (!(len > 0)) break;
    const rec = data.subarray(sp + 1, pos + len - 1).toString('utf8');
    const eq = rec.indexOf('=');
    if (eq > 0) out[rec.slice(0, eq)] = rec.slice(eq + 1);
    pos += len;
  }
  return out;
}

// 절대 경로(/x, \x, C:...)와 `..` 구간을 거부하고 dest 안의 경로를 돌려준다.
function safeTarget(dest, name) {
  const norm = name.replace(/\\/g, '/');
  if (norm.startsWith('/') || /^[A-Za-z]:/.test(norm) || norm.split('/').includes('..')) {
    throw new Error(`안전하지 않은 경로가 들어 있어 해제를 중단합니다: ${name}`);
  }
  const root = path.resolve(dest);
  const target = path.resolve(root, ...norm.split('/').filter(Boolean));
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`대상 폴더 밖으로 나가는 경로라 해제를 중단합니다: ${name}`);
  }
  return target;
}

export function extractTar(buf, dest) {
  let pos = 0;
  let files = 0;
  let nextName = null;
  fs.mkdirSync(dest, { recursive: true });
  let ended = false;
  while (pos < buf.length) {
    if (pos + BLOCK > buf.length) throw new Error('tar 가 손상되었습니다: 헤더 도중에 끝났습니다.');
    const h = buf.subarray(pos, pos + BLOCK);
    if (h.every((b) => b === 0)) {
      ended = true;
      break;
    }
    checkHeader(h);
    const type = String.fromCharCode(h[156] || 0x30);
    let size = octal(h, 124, 136);
    const mode = octal(h, 100, 108);
    let name = cstr(h, 0, 100);
    const prefix = cstr(h, 345, 500);
    if (prefix) name = `${prefix}/${name}`;
    pos += BLOCK;
    if (!Number.isInteger(size) || size < 0 || pos + size > buf.length) {
      throw new Error('tar 가 손상되었습니다: 항목 크기가 올바르지 않거나 데이터가 모자랍니다.');
    }
    const data = buf.subarray(pos, pos + size);
    pos += Math.ceil(size / BLOCK) * BLOCK;

    if (type === 'x') {
      const pax = parsePax(data);
      if (pax.path) nextName = pax.path;
      continue;
    }
    if (type === 'L') {
      nextName = cstr(data, 0, data.length);
      continue;
    }
    if (type === 'g') continue;

    if (nextName !== null) name = nextName;
    nextName = null;

    if (type !== '0' && type !== '\0' && type !== '5') continue; // 링크 등은 건너뜀
    const target = safeTarget(dest, name);
    if (type === '5') {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
    if (!IS_WIN) fs.chmodSync(target, mode & 0o777);
    files += 1;
  }
  if (!ended) throw new Error('tar 가 손상되었습니다: 종료 블록 없이 끝났습니다.');
  return { files };
}

function checkHeader(h) {
  let unsigned = 0;
  let signed = 0;
  for (let i = 0; i < BLOCK; i += 1) {
    const b = i >= 148 && i < 156 ? 0x20 : h[i];
    unsigned += b;
    signed += b > 127 ? b - 256 : b;
  }
  const stored = octal(h, 148, 156);
  if (stored !== unsigned && stored !== signed) {
    throw new Error('tar 가 손상되었습니다: 헤더 체크섬이 맞지 않습니다.');
  }
}

export function extractTgz(file, dest) {
  return extractTar(zlib.gunzipSync(fs.readFileSync(file)), dest);
}
// MCP 번들은 mcp/<이름>/ 의 tgz 를 그대로 쓴다. 저장소 안에 풀지 않고, npx 가 tgz 를 npm 캐시에 풀어 실행한다.
// 번들에는 의존성이 함께 들어 있어(bundleDependencies) 처음 실행할 때도 npm 레지스트리에 접속하지 않는다.
const KINDS = {
  codegen: { name: 'egovframe-mcp-codegen', dir: 'egovframe-mcp-codegen' },
  check: { name: 'egovframe-mcp-check', dir: 'egovframe-mcp-check' },
};

// kind 의 번들 파일 경로. check 번들은 플랫폼별이고, Windows ARM64 는 x64 번들을 쓴다.
export function bundlePath(kind, { repoRoot = REPO_ROOT, platform = platformKey() } = {}) {
  if (!KINDS[kind]) throw new Error(`알 수 없는 번들 종류입니다: ${kind}`);
  const { name, dir } = KINDS[kind];
  const folder = path.join(repoRoot, 'mcp', dir);
  let names = [];
  try {
    names = fs.readdirSync(folder).sort();
  } catch {
    /* 폴더 없음 */
  }
  const pick = (suffix) => {
    const hit = names.filter((n) => n.startsWith(`${name}-`) && n.endsWith(suffix));
    return hit.length ? path.join(folder, hit[hit.length - 1]) : null;
  };
  let found;
  if (kind === 'codegen') {
    found = pick('.tgz');
  } else {
    found = pick(`-${platform}.tgz`);
    if (!found && platform === 'win32-arm64') found = pick('-win32-x64.tgz');
  }
  if (!found) {
    throw new Error(
      `MCP 번들을 찾을 수 없습니다: 폴더 ${folder} 에 ${platform} 용 ${name} 번들(.tgz)이 없습니다.`,
    );
  }
  return found;
}

// MCP 연결 설정에 쓰는 명령: npx 로 번들 tgz 의 실행 파일(번들 이름과 같음)을 띄운다.
// Windows 의 npx 는 npx.cmd 라서 셸 없이 띄우는 도구가 많으므로 cmd /c 로 감싼다.
export function npxServer(kind, { repoRoot = REPO_ROOT, platform = platformKey(), win = IS_WIN } = {}) {
  const args = ['-y', '--package', bundlePath(kind, { repoRoot, platform }), KINDS[kind].name];
  return win ? { command: 'cmd', args: ['/c', 'npx', ...args] } : { command: 'npx', args };
}

// tar 안의 일반 파일 하나를 문자열로 읽는다. 없으면 null.
function readTarText(buf, wanted) {
  let pos = 0;
  while (pos + BLOCK <= buf.length) {
    const h = buf.subarray(pos, pos + BLOCK);
    if (h.every((b) => b === 0)) break;
    const size = octal(h, 124, 136);
    const type = String.fromCharCode(h[156] || 0x30);
    const prefix = cstr(h, 257, 263).startsWith('ustar') ? cstr(h, 345, 500) : '';
    const name = prefix ? `${prefix}/${cstr(h, 0, 100)}` : cstr(h, 0, 100);
    const start = pos + BLOCK;
    if ((type === '0' || type === '\0') && name === wanted) return buf.subarray(start, start + size).toString('utf8');
    pos = start + Math.ceil(size / BLOCK) * BLOCK;
  }
  return null;
}

// 번들 tgz 가 풀리고 package/package.json 에 실행 파일(bin)이 있는지 확인한다.
// 깨진 번들을 시간 제한이 있는 mcp 실습에서 npx 로 띄우기 전에 알아내기 위해서다.
export function verifyBundle(kind, file) {
  const label = path.basename(file);
  let pkg = null;
  try {
    const text = readTarText(zlib.gunzipSync(fs.readFileSync(file)), 'package/package.json');
    pkg = text === null ? null : JSON.parse(text);
  } catch (e) {
    throw new Error(`번들(${label})을 읽을 수 없습니다: ${e.message}`);
  }
  if (!pkg?.bin?.[KINDS[kind].name]) {
    throw new Error(`번들(${label})에 ${KINDS[kind].name} 실행 파일 정보가 없습니다.`);
  }
}
