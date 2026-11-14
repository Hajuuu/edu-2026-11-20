import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { REPO_ROOT, IS_WIN } from '../scripts/lib/env.mjs';
import { extractTar, extractTgz, installBundle, codegenEntry } from '../scripts/lib/bundle.mjs';

const CODEGEN_TGZ = path.join(REPO_ROOT, 'mcp', 'egovframe-mcp-codegen', 'egovframe-mcp-codegen-1.0.0.tgz');

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

test('matches system tar', { skip: IS_WIN || !fs.existsSync(CODEGEN_TGZ) }, () => {
  const a = tmp();
  const b = tmp();
  const { files } = extractTgz(CODEGEN_TGZ, a);
  const r = spawnSync('tar', ['-xzf', CODEGEN_TGZ, '-C', b]);
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

test('install idempotent', { skip: !fs.existsSync(CODEGEN_TGZ) }, () => {
  const repoRoot = tmp();
  const dir = path.join(repoRoot, 'mcp', 'egovframe-mcp-codegen');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(CODEGEN_TGZ, path.join(dir, path.basename(CODEGEN_TGZ)));
  const first = installBundle('codegen', { repoRoot });
  assert.equal(first.installed, true);
  assert.ok(fs.existsSync(first.entry));
  assert.equal(first.entry, codegenEntry(repoRoot));
  const second = installBundle('codegen', { repoRoot });
  assert.equal(second.installed, false);
  assert.ok(fs.existsSync(second.entry));
});

test('missing bundle throws a Korean error', () => {
  const repoRoot = tmp();
  assert.throws(() => installBundle('check', { repoRoot, platform: 'linux-x64' }), /linux-x64/);
});
