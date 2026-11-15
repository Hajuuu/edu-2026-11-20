// 전날 환경 점검: 도구 확인, 저장소 위치 확인, 전역 설정에 남은 codegen MCP 서버 확인, codegen MCP 설치, Maven 의존성 미리 받기.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { REPO_ROOT, homeDir, appDataDir, run, mvnInvocation, log, upstreamConfig } from './lib/env.mjs';
import { parseArgs } from './lib/cli.mjs';
import { installBundle } from './lib/bundle.mjs';
import { scaffoldBoard } from './lib/mcp-client.mjs';
import { remoteSlug, repoRootStatus, NOT_REPO_ROOT } from './lib/git.mjs';
import { scanGlobalMcp, removalHint } from './lib/guard.mjs';
import { MCP_SERVER_NAME } from './lib/mcp-config.mjs';
import { TOOL_NAMES } from './lib/tools.mjs';
import {
  NODE_RECOMMENDED_MAJOR,
  JDK_MAJOR,
  MAVEN_MIN,
  nodeInfo,
  javaInfo,
  mavenInfo,
  mavenAdvice,
  mavenJavaWarning,
  gitInfo,
  ghInfo,
} from './lib/versions.mjs';

const MAVEN_MIN_TEXT = MAVEN_MIN.join('.');
const failures = [];
const warnings = [];
const ok = (m) => log.ok(m);
const warn = (m) => {
  warnings.push(m);
  log.warn(m);
};
const err = (m) => {
  failures.push(m);
  log.err(m);
};

// 버전 확인과 기준은 lib/versions.mjs 에 모아 setup 과 같은 기준을 쓴다.
function checkJdk() {
  const j = javaInfo();
  if (!j.found) return err(`JDK 를 찾지 못했습니다. JDK ${JDK_MAJOR} 을 설치하고 터미널을 다시 열어 주세요.`);
  if (j.ok) ok(`JDK ${JDK_MAJOR} 을 확인했습니다. (${j.line})`);
  else warn(`JDK ${j.major} 이(가) 설치되어 있습니다. 교육은 JDK ${JDK_MAJOR} 기준이므로 JDK ${JDK_MAJOR} 을 설치해 주세요.`);
}

function checkMaven() {
  const m = mavenInfo();
  if (!m.found) return err(`Maven 을 찾지 못했습니다. Maven ${MAVEN_MIN_TEXT} 이상을 설치하고 터미널을 다시 열어 주세요.`);
  if (m.ok) ok(`Maven 을 확인했습니다. (${m.line})`);
  else warn(`Maven ${m.version} 이(가) 설치되어 있습니다. ${mavenAdvice(m)}`);
  // README 는 mvn -version 의 Java version 을 눈으로 확인하게 하므로, 같은 값을 여기서도 확인한다.
  const java = mavenJavaWarning(m);
  if (java) warn(java);
}

function checkNode() {
  const n = nodeInfo();
  if (n.level === 'unsupported') {
    err(`Node.js ${n.version} 은(는) 너무 낮습니다. Node.js ${NODE_RECOMMENDED_MAJOR} 이상을 설치해 주세요.`);
    return false;
  }
  if (n.level === 'old') warn(`Node.js ${n.version} 이(가) 설치되어 있습니다. Node.js ${NODE_RECOMMENDED_MAJOR} 이상을 권장합니다.`);
  else ok(`Node.js ${n.version} 을(를) 확인했습니다.`);
  return true;
}

function checkGit() {
  const g = gitInfo();
  if (g.found) ok(`Git 을 확인했습니다. (${g.line})`);
  else err('Git 을 찾지 못했습니다. Git 을 설치하고 터미널을 다시 열어 주세요.');
  return g.found;
}

function checkGh() {
  const h = ghInfo();
  if (!h.found) return err('GitHub CLI(gh) 를 찾지 못했습니다. gh 를 설치하고 터미널을 다시 열어 주세요.');
  ok(`GitHub CLI 를 확인했습니다. (${h.line})`);
  const a = run('gh', ['auth', 'status']);
  if (a.status === 0) ok('GitHub 로그인 상태를 확인했습니다.');
  else warn('GitHub 에 로그인되어 있지 않습니다. gh auth login 을 실행해 로그인해 주세요.');
}

const FORK_SECTION = 'README 의 1.2 GitHub 로그인과 Fork 절';

// setup 과 submit 은 git 으로 clone 한 저장소의 루트에서만 진행하므로 같은 기준으로 미리 확인한다.
// 루트가 아니면 해결해야 할 항목으로 남기고, origin 은 확인하지 않는다 (바깥 저장소의 origin 을 볼 수 있음).
function checkRepo(gitFound) {
  if (!gitFound) return;
  const s = repoRootStatus();
  if (!s.ok) {
    err(`${NOT_REPO_ROOT} ZIP 으로 받은 폴더나 다른 폴더에서는 setup 과 submit 명령이 진행되지 않습니다. ${FORK_SECTION}에 따라 본인의 Fork 를 clone 한 폴더에서 npm run check 를 다시 실행해 주세요.`);
    if (s.why) console.error(`  git 메시지: ${s.why}`);
    return;
  }
  checkOrigin();
}

function checkOrigin() {
  const { upstream } = upstreamConfig();
  const slug = remoteSlug();
  if (!slug) {
    warn(`origin 원격이 없거나 GitHub 저장소 주소가 아니어서 본인의 Fork 인지 확인하지 못했습니다. ${FORK_SECTION}에 따라 Fork 를 clone 했는지 확인해 주세요.`);
  } else if (upstream && slug.toLowerCase() === upstream.toLowerCase()) {
    warn(`이 저장소는 원본(${upstream})을 그대로 clone 한 것입니다. 본인의 Fork 를 clone 해 주세요. 아직 Fork 가 없다면 npm run submit 이 자동으로 만들어 줍니다.`);
  } else {
    ok(`origin 원격을 확인했습니다. (${slug})`);
  }
}

// 여섯 AI 도구의 전역 설정에 켜진 codegen MCP 서버가 남아 있으면 지우는 방법을 알린다. 설정은 읽기만 한다.
// nomcp 실습 준비는 선택한 도구에 이런 서버가 있으면 멈추므로, 교육 당일이 아니라 전날 찾아 지우게 한다.
// 실습 워크스페이스는 아직 없으므로, Claude Code 의 로컬 범위 서버는 모든 실습 워크스페이스의 상위인 submissions 폴더를 기준으로 본다.
function checkGlobalMcp() {
  const ctx = { home: homeDir(), appData: appDataDir(), env: process.env, runDir: path.join(REPO_ROOT, 'submissions') };
  let found = 0;
  for (const tool of TOOL_NAMES) {
    let hits = [];
    try {
      hits = scanGlobalMcp(tool, ctx);
    } catch {
      /* 읽을 수 없는 설정은 setup 이 다시 확인한다 */
    }
    for (const h of hits) {
      // Cline 의 egovframe-codegen 항목은 setup 이 실습 종류에 맞춰 직접 켜고 끈다.
      if (!h.enabled || !h.codegen || (tool === 'Cline' && h.name === MCP_SERVER_NAME)) continue;
      found += 1;
      warn(`${tool.replace('-', ' ')} 의 전역 설정(${h.source})에 eGovFrame 코드 생성 MCP 서버(${h.name})가 켜져 있습니다. 이 도구로 실습하면 nomcp 실습 준비가 멈추므로 교육 전에 제거해 주세요. ${removalHint(tool, h)}`);
    }
  }
  if (!found) ok('AI 도구의 전역 설정에 eGovFrame 코드 생성 MCP 서버가 남아 있지 않습니다.');
}

function checkCodegen() {
  try {
    const r = installBundle('codegen');
    ok(r.installed ? 'codegen MCP 서버를 설치했습니다.' : 'codegen MCP 서버가 이미 설치되어 있습니다.');
    return r.entry;
  } catch (e) {
    err(`codegen MCP 서버를 설치하지 못했습니다: ${e.message}`);
    return null;
  }
}

async function warmup(entry) {
  log.step('Maven 의존성을 미리 받습니다. 처음에는 몇 분 걸릴 수 있습니다.');
  const started = Date.now();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egov-warmup-'));
  try {
    const s = await scaffoldBoard(entry, dir);
    if (s.isError) return err(`예열용 프로젝트를 만들지 못했습니다: ${s.text}`);
    const proj = path.join(dir, 'board-app');
    const { cmd, shell } = mvnInvocation();
    const r = run(cmd, ['-B', '-q', '-DskipTests', 'package'], { cwd: proj, shell, stdio: 'inherit' });
    const target = path.join(proj, 'target');
    const jar = fs.existsSync(target) && fs.readdirSync(target).some((f) => f.endsWith('.jar'));
    if (r.status === 0 && jar) ok(`Maven 의존성을 미리 받았습니다. (${Math.round((Date.now() - started) / 1000)}초)`);
    else err('예열용 프로젝트 빌드에 실패했습니다. 인터넷 연결과 Maven, JDK 설정을 확인해 주세요.');
  } catch (e) {
    err(`예열 중 문제가 생겼습니다: ${e.message}`);
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows 파일 잠금이면 임시 폴더에 남겨 둔다 */
    }
  }
}

async function main() {
  const { flags, errors } = parseArgs(process.argv.slice(2), process.env, { require: [] });
  if (errors.length) {
    for (const e of errors) log.err(e);
    process.exit(1);
  }
  log.step('환경을 점검합니다.');
  if (!checkNode()) return summary();
  checkJdk();
  checkMaven();
  const gitFound = checkGit();
  checkGh();
  checkRepo(gitFound);
  checkGlobalMcp();
  const entry = checkCodegen();
  if (flags.has('skip-warmup')) warn('Maven 의존성 미리 받기를 생략했습니다. 수업 전에 한 번은 실행해 두는 것을 권장합니다.');
  else if (entry) await warmup(entry);
  else warn('codegen 설치에 실패해 Maven 의존성 미리 받기를 건너뜁니다.');
  summary();
}

function summary() {
  log.info('');
  log.step('점검 결과');
  if (failures.length) {
    log.info(`해결해야 할 항목 ${failures.length}개:`);
    for (const f of failures) log.info(`  - ${f}`);
  }
  if (warnings.length) {
    log.info(`확인이 필요한 항목 ${warnings.length}개:`);
    for (const w of warnings) log.info(`  - ${w}`);
  }
  if (!failures.length && !warnings.length) log.ok('모든 점검을 통과했습니다.');
  else if (!failures.length) log.ok('필수 점검은 통과했습니다. 위 항목을 확인해 주세요.');
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => {
  log.err(`점검 중 예기치 않은 오류가 발생했습니다: ${e.message}`);
  process.exit(1);
});
