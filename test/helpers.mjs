// 종단 시험 공용 도우미: 이 저장소 일부를 복사한 임시 작업 저장소, 임시 홈, 정리된 자식 프로세스 환경.
// 자식 프로세스는 실제 홈의 도구 설정, git 전역·시스템 설정, 다른 저장소를 가리키는 GIT_* 변수
// (훅 안에서 시험을 돌릴 때의 GIT_DIR, GIT_INDEX_FILE 등), npm 이 넘긴 npm_config_* 변수를 보지 않는다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COPY = ['package.json', '.gitignore', '.gitattributes', 'scripts', 'task', path.join('mcp', 'egovframe-mcp-codegen')];
const STRIP_ENV = ['CODEX_HOME', 'COPILOT_HOME', 'CLINE_MCP_SETTINGS_PATH', 'CLINE_DATA_DIR', 'CLINE_DIR', 'APPDATA', 'XDG_CONFIG_HOME', 'EMAIL'];

const temps = [];

// 각 시험 파일에서 after(removeTemps) 로 등록한다.
export function removeTemps() {
  for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
}

export function tempDir(prefix) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  temps.push(d);
  return d;
}

let gitConfigDir = null;

// git 전역 설정은 비어 있는 파일로 바꾸고, 기본 위치(~/.config/git)의 무시·속성 파일도 읽지 않게 한다.
function hermeticGitConfig() {
  if (!gitConfigDir) {
    gitConfigDir = tempDir('edu-gitcfg-');
    const slash = gitConfigDir.split(path.sep).join('/');
    fs.writeFileSync(
      path.join(gitConfigDir, 'gitconfig'),
      `[core]\n\texcludesFile = ${slash}/no-ignore\n\tattributesFile = ${slash}/no-attributes\n`,
    );
  }
  return path.join(gitConfigDir, 'gitconfig');
}

export function cleanEnv(extra = {}) {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    const key = k.toUpperCase();
    if (key.startsWith('GIT_') || key.startsWith('NPM_CONFIG_') || STRIP_ENV.includes(key)) continue;
    env[k] = v;
  }
  return {
    ...env,
    GIT_CONFIG_GLOBAL: hermeticGitConfig(),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    ...extra,
  };
}

export function gitRun(cwd, ...args) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', env: cleanEnv() });
}

export function git(cwd, ...args) {
  const r = gitRun(cwd, ...args);
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

export function commitAll(cwd, message) {
  git(cwd, 'add', '-A');
  git(cwd, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', message);
}

// 교육생 clone 과 같은 모양의 작업 저장소(main 브랜치 커밋 하나)와 비어 있는 임시 홈
export function workRepo() {
  const repo = tempDir('edu-repo-');
  for (const rel of COPY) fs.cpSync(path.join(SRC, rel), path.join(repo, rel), { recursive: true });
  git(repo, 'init', '-q', '-b', 'main');
  commitAll(repo, 'init');
  return { repo, home: tempDir('edu-home-') };
}

// scripts/<script> 를 작업 저장소에서 실행한다. gh 는 기본적으로 없는 명령으로 둔다.
export function runScript(ctx, script, args = [], opts = {}) {
  const env = cleanEnv({ EDU_HOME: ctx.home, EDU_GH: 'edu-no-such-gh', ...(opts.env || {}) });
  const r = spawnSync(process.execPath, [...(opts.nodeArgs || []), path.join('scripts', script), ...args], {
    cwd: ctx.repo,
    env,
    encoding: 'utf8',
  });
  return { code: r.status, out: `${r.stdout}\n${r.stderr}` };
}

export function put(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

export const readParticipant = (ctx, id) =>
  JSON.parse(fs.readFileSync(path.join(ctx.repo, 'submissions', id, 'participant.json'), 'utf8'));
