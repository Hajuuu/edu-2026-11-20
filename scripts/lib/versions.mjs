// 도구 버전 확인과 기준. 전날 점검(check)과 실행 준비(setup)가 같은 기준을 쓴다. Node 내장 모듈만 사용한다.
import { run, mvnInvocation } from './env.mjs';
import { gh } from './git.mjs';

// setup 은 자신을 실행한 Node 로 codegen MCP 서버를 띄우고, 번들의 MCP SDK 는 Node.js 18 이상을 요구한다.
export const NODE_MIN_MAJOR = 18;
export const NODE_RECOMMENDED_MAJOR = 22;
export const JDK_MAJOR = 17;
export const MAVEN_MIN = [3, 9];

const firstLine = (s) => String(s || '').split(/\r?\n/).find((l) => l.trim()) || '';

// level: 'unsupported'(MCP 서버를 띄울 수 없음), 'old'(동작하지만 권장보다 낮음), 'ok'
export function nodeInfo(version = process.versions.node) {
  const major = Number(String(version).split('.')[0]);
  let level = 'ok';
  if (!(major >= NODE_MIN_MAJOR)) level = 'unsupported';
  else if (major < NODE_RECOMMENDED_MAJOR) level = 'old';
  return { version, major, level };
}

// java -version 출력(stderr 와 stdout 을 합친 것)을 해석한다. 1.8 형식은 8 로 본다.
export function parseJava(text) {
  const m = String(text || '').match(/version "((\d+)(?:\.(\d+))?[^"]*)"/);
  if (!m) return { found: false, version: null, major: null, ok: false, line: '' };
  const major = m[2] === '1' ? Number(m[3]) : Number(m[2]);
  return { found: true, version: m[1], major, ok: major === JDK_MAJOR, line: firstLine(text) };
}

export function parseMaven(stdout) {
  const m = String(stdout || '').match(/Apache Maven ((\d+)\.(\d+)[\w.-]*)/);
  if (!m) return { found: false, version: null, major: null, minor: null, ok: false, line: '' };
  const [major, minor] = [Number(m[2]), Number(m[3])];
  const ok = major === MAVEN_MIN[0] && minor >= MAVEN_MIN[1];
  return { found: true, version: m[1], major, minor, ok, line: firstLine(stdout) };
}

export function javaInfo() {
  const r = run('java', ['-version']);
  return parseJava(`${r.stderr}\n${r.stdout}`);
}

// Windows 의 mvn.cmd 는 셸을 거치고, 찾지 못해도 오류 객체 없이 종료 코드만 남으므로 종료 코드로 판단한다.
export function mavenInfo() {
  const { cmd, shell } = mvnInvocation();
  const r = run(cmd, ['-version'], { shell });
  return r.status === 0 ? parseMaven(r.stdout) : parseMaven('');
}

function commandInfo(r, re) {
  if (r.status !== 0) return { found: false, version: null, line: '' };
  const m = String(r.stdout || '').match(re);
  return { found: true, version: m ? m[1] : null, line: firstLine(r.stdout) };
}

export function gitInfo() {
  return commandInfo(run('git', ['--version']), /git version (\S+)/);
}

export function ghInfo() {
  return commandInfo(gh(['--version']), /gh version (\S+)/);
}
