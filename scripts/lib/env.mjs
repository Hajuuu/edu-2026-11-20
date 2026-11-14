// 공용 환경 모듈: 경로, 외부 명령 실행, 출력, JSON 입출력. Node 내장 모듈만 사용한다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const IS_WIN = process.platform === 'win32';

export function homeDir() {
  return process.env.EDU_HOME || os.homedir();
}

export function appDataDir() {
  const home = homeDir();
  const hermetic = Boolean(process.env.EDU_HOME);
  if (process.platform === 'win32') {
    return (!hermetic && process.env.APPDATA) || path.join(home, 'AppData', 'Roaming');
  }
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support');
  return (!hermetic && process.env.XDG_CONFIG_HOME) || path.join(home, '.config');
}

export function platformKey() {
  return `${process.platform}-${process.arch}`;
}

// 셸 없이 외부 명령을 실행한다. 명령이 없어도 예외 없이 결과 객체를 돌려준다.
export function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    env: opts.env ? { ...process.env, ...opts.env } : process.env,
    input: opts.input,
    shell: Boolean(opts.shell),
    windowsHide: true,
    encoding: 'utf8',
    ...(opts.stdio ? { stdio: opts.stdio } : {}),
  });
  const out = { status: r.status ?? null, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  if (r.error) out.error = r.error;
  return out;
}

// Windows 의 Maven 은 mvn.cmd 이므로 셸을 거쳐야 실행된다.
export function mvnInvocation() {
  return IS_WIN ? { cmd: 'mvn.cmd', shell: true } : { cmd: 'mvn', shell: false };
}

export const log = {
  step: (msg) => console.log(`▶ ${msg}`),
  ok: (msg) => console.log(`[완료] ${msg}`),
  warn: (msg) => console.log(`[주의] ${msg}`),
  err: (msg) => console.error(`[오류] ${msg}`),
  info: (msg) => console.log(msg),
};

export function fail(msg, code = 1) {
  log.err(msg);
  process.exit(code);
}

export function readJson(file, fallback) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return fallback;
  }
  try {
    return JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    return { __invalid: true, error: e.message };
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function upstreamConfig() {
  const pkg = readJson(path.join(REPO_ROOT, 'package.json'), {});
  const edu = pkg.edu || {};
  return { upstream: edu.upstream, base: edu.base };
}
