// 외부 tar 없이 MCP 번들(.tgz)을 해제·설치한다. Node 내장 모듈만 사용한다.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
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
  while (pos + BLOCK <= buf.length) {
    const h = buf.subarray(pos, pos + BLOCK);
    if (h.every((b) => b === 0)) break;
    const type = String.fromCharCode(h[156] || 0x30);
    let size = octal(h, 124, 136);
    const mode = octal(h, 100, 108);
    let name = cstr(h, 0, 100);
    const prefix = cstr(h, 345, 500);
    if (prefix) name = `${prefix}/${name}`;
    pos += BLOCK;
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
  return { files };
}

export function extractTgz(file, dest) {
  return extractTar(zlib.gunzipSync(fs.readFileSync(file)), dest);
}

const KINDS = {
  codegen: { name: 'egovframe-mcp-codegen', dir: 'egovframe-mcp-codegen' },
  check: { name: 'egovframe-mcp-check', dir: 'egovframe-mcp-check' },
};

function installDir(kind, repoRoot) {
  return path.join(repoRoot, '.mcp-servers', KINDS[kind].name);
}

function entryOf(kind, repoRoot) {
  return path.join(installDir(kind, repoRoot), 'package', 'build', 'index.js');
}

export function codegenEntry(repoRoot = REPO_ROOT) {
  return entryOf('codegen', repoRoot);
}

export function checkEntry(repoRoot = REPO_ROOT) {
  return entryOf('check', repoRoot);
}

function findBundle(kind, repoRoot, platform) {
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

export function installBundle(kind, { repoRoot = REPO_ROOT, platform = platformKey() } = {}) {
  if (!KINDS[kind]) throw new Error(`알 수 없는 번들 종류입니다: ${kind}`);
  const bundle = findBundle(kind, repoRoot, platform);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(bundle)).digest('hex');
  const dir = installDir(kind, repoRoot);
  const entry = entryOf(kind, repoRoot);
  const marker = path.join(dir, '.bundle-sha256');
  let stored = '';
  try {
    stored = fs.readFileSync(marker, 'utf8').trim();
  } catch {
    /* 표식 없음 */
  }
  if (stored === sha && fs.existsSync(entry)) return { entry, installed: false, bundle };
  fs.rmSync(dir, { recursive: true, force: true });
  extractTgz(bundle, dir);
  fs.writeFileSync(marker, `${sha}\n`);
  return { entry, installed: true, bundle };
}
