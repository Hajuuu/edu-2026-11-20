import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, IS_WIN } from '../scripts/lib/env.mjs';
import zlib from 'node:zlib';
import { extractTar, extractTgz, bundlePath, npxServer, verifyBundle, codegenServer, codegenPackageDir } from '../scripts/lib/bundle.mjs';

// 저장소에 남아 있는 실제 tgz 는 check 번들뿐이다 (codegen 은 .mcp-servers/ 에 푼 채로 들어 있다).
const CHECK_DIR = path.join(REPO_ROOT, 'mcp', 'egovframe-mcp-check');
const CHECK_TGZ = fs.existsSync(CHECK_DIR)
  ? fs.readdirSync(CHECK_DIR).filter((f) => f.endsWith('.tgz')).map((f) => path.join(CHECK_DIR, f))[0]
  : undefined;

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-test-'));
}

function octal(n, len) {
  return `${n.toString(8).padStart(len - 1, '0')}\0`;
}

// 테스트용 tar 헤더/본문 조립기
function entry({ name, prefix = '', body = '', type = '0', mode = 0o644 }) {
  const data = Buffer.from(body);
  const h = Buffer.alloc(512);
  h.write(name, 0, 100);
  h.write(octal(mode, 8), 100);
  h.write(octal(0, 8), 108);
  h.write(octal(0, 8), 116);
  h.write(octal(data.length, 12), 124);
  h.write(octal(0, 12), 136);
  h.write('        ', 148);
  h.write(type, 156);
  h.write('ustar\0', 257);
  h.write('00', 263);
  h.write(prefix, 345, 155);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148);
  const pad = Buffer.alloc((512 - (data.length % 512)) % 512);
  return Buffer.concat([h, data, pad]);
}

function tar(...entries) {
  return Buffer.concat([...entries, Buffer.alloc(1024)]);
}

function paxRecord(key, value) {
  const rest = ` ${key}=${value}\n`;
  let len = rest.length + 1;
  while (String(len).length + rest.length !== len) len = String(len).length + rest.length;
  return `${len}${rest}`;
}

function walk(dir, base = dir, out = {}) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, base, out);
    else {
      const rel = path.relative(base, p).split(path.sep).join('/');
      out[rel] = {
        sha: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),
        exec: (fs.statSync(p).mode & 0o111) !== 0,
      };
    }
  }
  return out;
}

test('matches system tar', { skip: IS_WIN || !CHECK_TGZ }, () => {
  const a = tmp();
  const b = tmp();
  const { files } = extractTgz(CHECK_TGZ, a);
  const r = spawnSync('tar', ['-xzf', CHECK_TGZ, '-C', b]);
  assert.equal(r.status, 0);
  const wa = walk(a);
  const wb = walk(b);
  assert.equal(files, Object.keys(wa).length);
  assert.deepEqual(wa, wb);
});

test('long names', () => {
  const dest = tmp();
  const dirPart = 'd'.repeat(60) + '/' + 'e'.repeat(60);
  const prefixed = `${dirPart}/${'f'.repeat(50)}.txt`; // > 100
  const longName = `package/${'x'.repeat(120)}/${'y'.repeat(120)}/file.txt`; // > 200
  const buf = tar(
    entry({ name: `${'f'.repeat(50)}.txt`, prefix: dirPart, body: 'one' }),
    entry({ name: 'PaxHeader', type: 'x', body: paxRecord('path', longName) }),
    entry({ name: 'truncated', body: 'two' }),
  );
  assert.equal(extractTar(buf, dest).files, 2);
  assert.equal(fs.readFileSync(path.join(dest, ...prefixed.split('/')), 'utf8'), 'one');
  assert.equal(fs.readFileSync(path.join(dest, ...longName.split('/')), 'utf8'), 'two');
});

test('global header, dirs and unsupported types are handled', () => {
  const dest = tmp();
  const buf = tar(
    entry({ name: 'pax_global_header', type: 'g', body: paxRecord('comment', 'abc') }),
    entry({ name: 'dir/', type: '5', mode: 0o755 }),
    entry({ name: 'dir/a.txt', body: 'a' }),
    entry({ name: 'dir/link', type: '2' }),
  );
  assert.equal(extractTar(buf, dest).files, 1);
  assert.ok(fs.statSync(path.join(dest, 'dir')).isDirectory());
  assert.ok(!fs.existsSync(path.join(dest, 'dir', 'link')));
});

test('rejects traversal', () => {
  for (const name of ['../evil', 'a/../../evil', '/abs/evil', '\\abs\\evil', 'C:evil']) {
    const root = tmp();
    const dest = path.join(root, 'dest');
    fs.mkdirSync(dest);
    assert.throws(() => extractTar(tar(entry({ name, body: 'x' })), dest), name);
    assert.deepEqual(fs.readdirSync(root), ['dest']);
    assert.deepEqual(fs.readdirSync(dest), []);
  }
});

// MCP 연결 설정의 명령: node 로 저장소의 .mcp-servers/ 에 푼 codegen 패키지의 실행 파일(package.json 의 bin)을 띄운다.
test('codegenServer runs the unpacked codegen package with node', () => {
  const entry = path.join(REPO_ROOT, '.mcp-servers', 'egovframe-mcp-codegen', 'package', 'build', 'index.js');
  assert.equal(codegenPackageDir(), path.dirname(path.dirname(entry)));
  assert.deepEqual(codegenServer(), { command: 'node', args: [entry] });
  const pkg = JSON.parse(fs.readFileSync(path.join(codegenPackageDir(), 'package.json'), 'utf8'));
  assert.equal(pkg.bin['egovframe-mcp-codegen'], './build/index.js');
  assert.ok(fs.existsSync(path.join(codegenPackageDir(), 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json')));
});

test('codegenServer rejects a missing or broken package', () => {
  const repoRoot = tmp();
  assert.throws(() => codegenServer({ repoRoot }), /codegen MCP 서버 패키지[^\n]*파일이 없습니다/);
  const dir = path.join(repoRoot, '.mcp-servers', 'egovframe-mcp-codegen', 'package');
  fs.mkdirSync(path.join(dir, 'build'), { recursive: true });
  const writePkg = (pkg) => fs.writeFileSync(path.join(dir, 'package.json'), typeof pkg === 'string' ? pkg : JSON.stringify(pkg));
  writePkg('{ broken');
  assert.throws(() => codegenServer({ repoRoot }), /읽을 수 없습니다/);
  writePkg({ name: 'egovframe-mcp-codegen' });
  assert.throws(() => codegenServer({ repoRoot }), /실행 파일 정보가 없습니다/);
  writePkg({ bin: { 'egovframe-mcp-codegen': './build/index.js' } });
  assert.throws(() => codegenServer({ repoRoot }), /build\/index\.js\)이 없습니다/);
  writePkg({ bin: { 'egovframe-mcp-codegen': '../outside.js' } });
  fs.writeFileSync(path.join(dir, '..', 'outside.js'), '');
  assert.throws(() => codegenServer({ repoRoot }), /없습니다/);
  writePkg({ bin: { 'egovframe-mcp-codegen': './build/index.js' } });
  fs.writeFileSync(path.join(dir, 'build', 'index.js'), '');
  assert.deepEqual(codegenServer({ repoRoot }), { command: 'node', args: [path.join(dir, 'build', 'index.js')] });
});

test('missing bundle throws a Korean error', () => {
  const repoRoot = tmp();
  assert.throws(() => bundlePath('check', { repoRoot, platform: 'linux-x64' }), /linux-x64/);
  assert.throws(() => npxServer('check', { repoRoot, platform: 'linux-x64' }), /번들/);
  // codegen 은 tgz 번들로 찾지 않는다.
  assert.throws(() => bundlePath('codegen', { repoRoot }), /알 수 없는 번들 종류/);
});

test('corrupt or truncated tar throws', () => {
  const good = tar(entry({ name: 'a.txt', body: 'abc' }));
  const cases = {
    'data past end': good.subarray(0, 512 + 2),
    'no end blocks': good.subarray(0, 1024),
    'ends inside header': good.subarray(0, 1024 + 100),
    'empty': Buffer.alloc(0),
    'not a tar': Buffer.from('x'.repeat(2048)),
  };
  const bad = Buffer.from(good);
  bad.write('zzzzzzzzzzz\0', 124);
  cases['garbage size'] = bad;
  const sumBad = Buffer.from(good);
  sumBad.write('0000001\0 ', 148);
  cases['bad checksum'] = sumBad;
  const big = tar(entry({ name: 'a.txt', body: 'abc' }));
  big.write(octal(1000, 12), 124); // 크기만 바꾸면 체크섬도 어긋남
  cases['size mismatch'] = big;
  for (const [label, buf] of Object.entries(cases)) {
    const dest = tmp();
    assert.throws(() => extractTar(buf, dest), /tar/, label);
  }
});

test('pax path and GNU L name are checked for traversal', () => {
  for (const type of ['x', 'L']) {
    const root = tmp();
    const dest = path.join(root, 'dest');
    const body = type === 'x' ? paxRecord('path', 'package/../../evil') : 'package/../../evil\0';
    const buf = tar(entry({ name: 'meta', type, body }), entry({ name: 'ok.txt', body: 'x' }));
    assert.throws(() => extractTar(buf, dest), /경로/, type);
    assert.deepEqual(fs.readdirSync(root).filter((n) => n !== 'dest'), []);
  }
  const dest = tmp();
  const buf = tar(entry({ name: 'meta', type: 'L', body: 'long/name.txt\0' }), entry({ name: 'short', body: 'v' }));
  extractTar(buf, dest);
  assert.equal(fs.readFileSync(path.join(dest, 'long', 'name.txt'), 'utf8'), 'v');
});

function fakeCheckRepo(files) {
  const repoRoot = tmp();
  const dir = path.join(repoRoot, 'mcp', 'egovframe-mcp-check');
  fs.mkdirSync(dir, { recursive: true });
  const buf = tar(
    entry({ name: 'package/build/index.js', body: 'console.log(1)' }),
    ...files,
  );
  const file = path.join(dir, 'egovframe-mcp-check-1.0.0-win32-x64.tgz');
  fs.writeFileSync(file, zlib.gzipSync(buf));
  return { repoRoot, file };
}

test('win32-arm64 falls back to the win32-x64 bundle', () => {
  const { repoRoot, file } = fakeCheckRepo([]);
  assert.equal(bundlePath('check', { repoRoot, platform: 'win32-arm64' }), file);
  assert.deepEqual(npxServer('check', { repoRoot, platform: 'win32-arm64', win: true }).args, ['/c', 'npx', '-y', '--package', file, 'egovframe-mcp-check']);
  assert.throws(() => bundlePath('check', { repoRoot, platform: 'linux-x64' }), /linux-x64/);
});

test('verifyBundle accepts the real bundles and rejects broken ones', () => {
  if (CHECK_TGZ) verifyBundle('check', CHECK_TGZ);
  const { file } = fakeCheckRepo([]);
  assert.throws(() => verifyBundle('check', file), /실행 파일 정보가 없습니다/);
  fs.writeFileSync(file, 'not a bundle');
  assert.throws(() => verifyBundle('check', file), /읽을 수 없습니다/);
  const withBin = fakeCheckRepo([entry({ name: 'package/package.json', body: JSON.stringify({ bin: { 'egovframe-mcp-check': './build/index.js' } }) })]);
  verifyBundle('check', withBin.file);
});
