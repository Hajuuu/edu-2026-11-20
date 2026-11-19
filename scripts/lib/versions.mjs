// 도구 버전 확인과 기준. 전날 점검(check)과 실습 준비(setup)가 같은 기준을 쓴다. Node 내장 모듈만 사용한다.
import { run, mvnInvocation } from './env.mjs';
import { gh } from './git.mjs';

// MCP 연결 설정은 node 로 codegen MCP 서버를 띄우고, 서버의 MCP SDK 는 Node.js 18 이상을 요구한다.
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

// Java 버전 문자열의 주 버전. 1.8 형식은 8 로 본다.
const javaMajorOf = (first, second) => (first === '1' ? Number(second) : Number(first));

// java -version 출력(stderr 와 stdout 을 합친 것)을 해석한다.
export function parseJava(text) {
  const m = String(text || '').match(/version "((\d+)(?:\.(\d+))?[^"]*)"/);
  if (!m) return { found: false, version: null, major: null, ok: false, line: '' };
  const major = javaMajorOf(m[2], m[3]);
  return { found: true, version: m[1], major, ok: major === JDK_MAJOR, line: firstLine(text) };
}

// mvn -version 출력을 해석한다. Maven 은 JAVA_HOME(없으면 PATH 의 java)으로 실행되므로, Maven 이 쓰는 JDK 는
// java -version 과 다를 수 있어 Java version 줄도 읽는다 (javaVersion, javaMajor, 줄이 없으면 null).
export function parseMaven(stdout) {
  const text = String(stdout || '');
  const m = text.match(/Apache Maven ((\d+)\.(\d+)[\w.-]*)/);
  if (!m) return { found: false, version: null, major: null, minor: null, ok: false, line: '', javaVersion: null, javaMajor: null };
  const [major, minor] = [Number(m[2]), Number(m[3])];
  const ok = major === MAVEN_MIN[0] && minor >= MAVEN_MIN[1];
  const j = text.match(/Java version:\s*((\d+)(?:\.(\d+))?[^\s,]*)/);
  const java = j ? { javaVersion: j[1], javaMajor: javaMajorOf(j[2], j[3]) } : { javaVersion: null, javaMajor: null };
  return { found: true, version: m[1], major, minor, ok, line: firstLine(text), ...java };
}

// Maven 버전이 기준에 맞지 않을 때의 안내. Maven 4 이상은 올리라고 하지 않고 쓰지 않는다고 알린다 (docs/install.md).
export function mavenAdvice(m) {
  if (m.major > MAVEN_MIN[0]) {
    return `교육 기준은 Maven ${MAVEN_MIN.join('.')}.x 입니다. Maven ${m.major} 는 쓰지 않습니다. docs/install.md 에 따라 Maven 3.9.9 를 설치해 주세요.`;
  }
  return `Maven ${MAVEN_MIN.join('.')} 이상으로 올려 주세요.`;
}

// Maven 이 쓰는 JDK 가 교육 기준과 다르면 안내 문장, 같거나 알 수 없으면 null.
export function mavenJavaWarning(m) {
  if (!m.found || m.javaMajor === null || m.javaMajor === JDK_MAJOR) return null;
  return `Maven 이 쓰는 JDK 는 ${m.javaVersion} 입니다(mvn -version 의 Java version). 교육은 JDK ${JDK_MAJOR} 기준이므로 JAVA_HOME 을 JDK ${JDK_MAJOR} 폴더로 정하고 터미널을 다시 열어 주세요.`;
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
