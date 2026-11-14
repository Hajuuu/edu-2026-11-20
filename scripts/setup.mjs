// 실행 준비(npm run setup): 브랜치, 실행 폴더(TASK.md·작업 범위 지침 파일), 도구별 MCP 연결, 참가자 기록, 다음 할 일 안내.
import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  IS_WIN,
  homeDir,
  appDataDir,
  platformKey,
  log,
  fail,
  readJson,
  writeJson,
  upstreamConfig,
} from './lib/env.mjs';
import { parseArgs } from './lib/cli.mjs';
import { TOOLS } from './lib/tools.mjs';
import {
  MCP_SERVER_NAME,
  folderMcpFiles,
  ALL_FOLDER_MCP_PATHS,
  instructionFile,
  clineSettingsPath,
  toggleCline,
} from './lib/mcp-config.mjs';
import { installBundle } from './lib/bundle.mjs';
import { LIMIT_MINUTES, participantPath, loadParticipant, saveParticipant, recordSetup } from './lib/participant.mjs';
import { scanGlobalMcp, findInstructionLeaks, removalHint } from './lib/guard.mjs';
import { git, currentBranch, ensureBranch } from './lib/git.mjs';
import {
  NODE_MIN_MAJOR,
  NODE_RECOMMENDED_MAJOR,
  JDK_MAJOR,
  MAVEN_MIN,
  nodeInfo,
  javaInfo,
  mavenInfo,
  gitInfo,
  ghInfo,
} from './lib/versions.mjs';
import { safePath } from './lib/safe-path.mjs';

const FIRST_PROMPT = 'TASK.md 를 읽고 이 폴더에 board-app 프로젝트를 만들어 줘.';
const TASK_HEADERS = {
  nomcp: '> 이 폴더에서는 MCP 없이 AI 도구의 기본 기능만 사용합니다.',
  mcp: `> 이 폴더의 AI 도구에는 eGovFrame 코드 생성 MCP(\`${MCP_SERVER_NAME}\`)가 연결되어 있습니다.`,
};

const setupCommand = (test, id, tool) => `npm run setup --test ${test} --id ${id} --tool ${tool}`;
const toSlash = (p) => p.split(path.sep).join('/');

function readArgs() {
  const args = parseArgs(process.argv.slice(2), process.env);
  if (args.errors.length) {
    for (const e of args.errors) log.err(e);
    log.info(`사용법: ${setupCommand('nomcp', 'P01', 'Codex')}`);
    process.exit(1);
  }
  // npm 은 --force 를 자기 옵션으로 가져가고 npm_config_force=true 로만 넘긴다.
  const force = args.flags.has('force') || process.env.npm_config_force === 'true';
  return { test: args.test, id: args.id, tool: args.tool, force };
}

function canonical(p) {
  let r;
  try {
    r = fs.realpathSync.native(p);
  } catch {
    r = path.resolve(p);
  }
  return IS_WIN ? r.toLowerCase() : r;
}

// 이 스크립트가 들어 있는 폴더가 git 저장소의 루트인지 확인한다 (ZIP 으로 받은 폴더, 다른 저장소 안의 복사본 방지).
function checkRepo() {
  const top = git(['rev-parse', '--show-toplevel']);
  if (top.error) fail('Git 을 찾지 못했습니다. Git 을 설치하고 터미널을 다시 연 뒤 실행해 주세요.');
  if (top.status === 0 && canonical(top.stdout.trim()) === canonical(REPO_ROOT)) return;
  log.err(`이 폴더(${REPO_ROOT})는 git 으로 clone 한 저장소의 루트가 아닙니다. 본인의 Fork 를 git clone 한 폴더에서 실행해 주세요.`);
  const why = top.status === 0 ? '' : (top.stderr || '').trim();
  if (why) console.error(`  git 메시지: ${why}`);
  process.exit(1);
}

function readTaskTemplate() {
  try {
    return fs.readFileSync(path.join(REPO_ROOT, 'task', 'TASK.md'), 'utf8');
  } catch {
    return fail('과제 원본(task/TASK.md)을 찾을 수 없습니다. git status 로 지워진 파일이 있는지 확인하고 되돌린 뒤 다시 실행해 주세요.');
  }
}

// 빠른 환경 점검(예열은 npm run check 가 맡는다). 기준은 lib/versions.mjs 를 check 와 함께 쓴다.
// Node 만 막는다: setup 은 자신을 실행한 Node(process.execPath)로 codegen MCP 서버를 띄우게 설정한다.
function checkEnvironment() {
  log.step('환경을 빠르게 점검합니다.');
  const node = nodeInfo();
  if (node.level === 'unsupported') {
    fail(`Node.js ${node.version} 에서는 codegen MCP 서버를 실행할 수 없습니다(${NODE_MIN_MAJOR} 이상 필요). Node.js ${NODE_RECOMMENDED_MAJOR} 이상을 설치하고 터미널을 다시 연 뒤 실행해 주세요.`);
  }
  const java = javaInfo();
  const maven = mavenInfo();
  const gitv = gitInfo();
  const ghv = ghInfo();
  const versions = { node: node.version, java: java.version, maven: maven.version, git: gitv.version, gh: ghv.version };
  const found = [
    ['Node.js', versions.node],
    ['JDK', versions.java],
    ['Maven', versions.maven],
    ['Git', versions.git],
    ['GitHub CLI', versions.gh],
  ].filter(([, ver]) => ver);
  log.ok(`${found.map(([name, ver]) => `${name} ${ver}`).join(', ')} 을(를) 확인했습니다.`);
  const mavenMin = MAVEN_MIN.join('.');
  if (node.level === 'old') log.warn(`지금 쓰는 Node.js 는 ${node.version} 입니다. Node.js ${NODE_RECOMMENDED_MAJOR} 이상을 권장합니다.`);
  if (!java.found) log.warn(`JDK 를 찾지 못했습니다. 프로젝트를 빌드하고 실행하려면 JDK ${JDK_MAJOR} 이 필요합니다.`);
  else if (!java.ok) log.warn(`지금 쓰는 JDK 는 ${java.version} 입니다. 교육은 JDK ${JDK_MAJOR} 기준이니 JDK ${JDK_MAJOR} 로 바꿔 주세요.`);
  if (!maven.found) log.warn(`Maven 을 찾지 못했습니다. 프로젝트를 빌드하려면 Maven ${mavenMin} 이상이 필요합니다.`);
  else if (!maven.ok) log.warn(`지금 쓰는 Maven 은 ${maven.version} 입니다. Maven ${mavenMin} 이상으로 올려 주세요.`);
  if (!ghv.found) log.warn('GitHub CLI(gh) 를 찾지 못했습니다. 제출(npm run submit)할 때 필요하니 미리 설치해 두세요.');
  if (!fs.existsSync(path.join(homeDir(), '.m2', 'repository', 'org', 'egovframe', 'boot'))) {
    log.warn('Maven 로컬 저장소(~/.m2)에 eGovFrame Boot 라이브러리가 없어 첫 빌드가 느릴 수 있습니다. 교육 전날 npm run check 를 실행해 두면 미리 받아 둘 수 있습니다.');
  }
  return versions;
}

function prepareBranch(id) {
  const name = `submit/${id}`;
  log.step(`${name} 브랜치를 준비합니다.`);
  const before = currentBranch();
  const r = ensureBranch(name, upstreamConfig().base || 'main');
  if (!r.ok) {
    log.err(`${name} 브랜치로 바꾸지 못했습니다. git 이 알려 준 이유는 다음과 같습니다.`);
    for (const line of String(r.message || '').split(/\r?\n/)) if (line.trim()) console.error(`    ${line}`);
    console.error('  커밋하지 않은 변경이 있으면 브랜치를 바꿀 수 없습니다. git status 로 바뀐 파일을 확인하고, 필요한 변경은 커밋하고 필요 없는 변경은 되돌린 뒤 다시 실행해 주세요.');
    process.exit(1);
  }
  if (r.created) log.ok(`${r.from} 에서 ${name} 브랜치를 만들어 전환했습니다.`);
  else if (before === name) log.ok(`이미 ${name} 브랜치에서 작업하고 있습니다.`);
  else log.ok(`${name} 브랜치로 전환했습니다.`);
}

// 실행 순서는 nomcp 다음 mcp 로 고정이다. --force 는 진행자용이라 안내 문구에 넣지 않는다.
function checkOrder({ test, id, tool, force }, participant) {
  if (test !== 'mcp') return;
  const nomcp = participant?.runs?.nomcp;
  if (nomcp?.submittedAt) return;
  if (force) {
    log.warn('--force 옵션에 따라 nomcp 제출 여부를 확인하지 않고 mcp 실행을 준비합니다.');
    return;
  }
  if (nomcp?.setupAt) {
    log.err('nomcp 실행을 아직 제출하지 않았습니다. 실행 순서는 nomcp 다음 mcp 이므로 nomcp 작업을 마치고 npm run submit 으로 먼저 제출한 뒤 다시 실행해 주세요.');
  } else {
    log.err(`실행 순서는 nomcp 다음 mcp 입니다. 먼저 ${setupCommand('nomcp', id, tool)} 로 nomcp 실행을 준비하고, 작업을 마친 뒤 npm run submit 으로 제출해 주세요.`);
  }
  process.exit(1);
}

// 참가자 기록은 공개 PR 에 올라가므로 절대 경로와 PC 사용자 이름이 남지 않게 줄인다.
const recordPath = (p) => safePath(p, { repo: REPO_ROOT, home: homeDir(), appData: appDataDir() });

// 전역 설정에 남은 MCP 서버(8.1)와 자동으로 읽히는 지침 파일(8.2)을 확인한다. 파일을 쓰기 전에 실행한다.
function guard({ test, id, tool }, runDir) {
  log.step('전역 MCP 설정과 AI 도구가 자동으로 읽는 지침 파일을 점검합니다.');
  const home = homeDir();
  const warnings = [];
  // Cline 의 egovframe-codegen 항목은 setup 이 실행 종류에 맞춰 직접 켜고 끈다.
  const hits = scanGlobalMcp(tool, { home, appData: appDataDir(), env: process.env, runDir }).filter(
    (h) => h.enabled && !(tool === 'Cline' && h.name === MCP_SERVER_NAME),
  );
  const codegen = hits.filter((h) => h.codegen);
  const blocked = test === 'nomcp' && codegen.length > 0;
  // 막는 경우에도 나머지 주의 사항을 먼저 보여 줘 한 번에 정리할 수 있게 한다.
  for (const h of hits.filter((x) => !x.codegen)) {
    log.warn(`${h.name} MCP 서버가 켜져 있습니다(${h.source}). 실습 동안 꺼 주세요.`);
    warnings.push(`켜져 있는 다른 MCP 서버: ${h.name} (${recordPath(h.source)})`);
  }
  for (const p of findInstructionLeaks(runDir, home, process.env)) {
    log.warn(`AI 도구가 자동으로 읽을 수 있는 지침 파일이 있습니다(${p}). 실습 동안 이름을 바꾸거나 다른 곳으로 옮겨 두세요.`);
    warnings.push(`자동으로 읽힐 수 있는 지침 파일: ${recordPath(p)}`);
  }
  if (blocked) {
    log.err('전역 설정에 eGovFrame 코드 생성 MCP 서버가 켜져 있습니다. nomcp 실행은 MCP 없이 진행해야 하므로 아래 서버를 먼저 제거해 주세요.');
    for (const h of codegen) console.error(`  - ${h.name} 서버 (${h.source}): ${removalHint(tool, h)}`);
    console.error(`  제거한 뒤 ${setupCommand(test, id, tool)} 를 다시 실행해 주세요.`);
    process.exit(1);
  }
  for (const h of codegen) {
    log.warn(`전역 설정(${h.source})에도 ${h.name} 서버가 켜져 있어 이 폴더의 연결과 겹칩니다. 실습 동안에는 전역 설정의 서버를 꺼 두기를 권장합니다. ${removalHint(tool, h)}`);
    warnings.push(`전역 설정에도 codegen MCP 서버가 켜져 있음: ${h.name} (${recordPath(h.source)})`);
  }
  if (!warnings.length) log.ok('실습에 영향을 줄 수 있는 전역 MCP 서버나 지침 파일이 없습니다.');
  return warnings;
}

function prepareCodegen() {
  log.step('codegen MCP 서버를 준비합니다.');
  try {
    const r = installBundle('codegen');
    log.ok(r.installed ? 'codegen MCP 서버를 설치했습니다.' : 'codegen MCP 서버가 이미 설치되어 있습니다.');
    return r.entry;
  } catch (e) {
    return fail(`codegen MCP 서버를 설치하지 못했습니다. ${e.message}`);
  }
}

// setup 이 바꾼 전역 설정을 기록한다. npm run cleanup 이 이 기록만 보고 되돌린다.
function recordGlobalChange(change) {
  const file = path.join(REPO_ROOT, '.edu', 'global-changes.json');
  const doc = readJson(file, null);
  const changes = doc && Array.isArray(doc.changes) ? doc.changes : [];
  const i = changes.findIndex((c) => c && c.tool === change.tool && c.file === change.file && c.server === change.server);
  if (i === -1) changes.push(change);
  else changes[i] = change;
  writeJson(file, { changes });
}

function toggleClineGlobal(test, entry) {
  const settingsPath = clineSettingsPath(process.env);
  const enable = test === 'mcp';
  const backupDir = path.join(REPO_ROOT, '.edu', 'backup');
  const r = toggleCline(enable, { command: process.execPath, args: [entry] }, { settingsPath, backupDir });
  if (r.aborted) fail(`${r.aborted} 파일(${settingsPath})을 고치거나 다른 이름으로 옮긴 뒤 다시 실행해 주세요.`);
  const change = { tool: 'Cline', file: settingsPath, server: MCP_SERVER_NAME, enabled: enable, at: new Date().toISOString() };
  const backup = path.join(backupDir, path.basename(settingsPath));
  if (fs.existsSync(backup)) change.backup = backup;
  recordGlobalChange(change);
  log.ok(`Cline 전역 설정에서 ${MCP_SERVER_NAME} 서버를 ${enable ? '켰습니다' : '껐습니다'}. (${settingsPath})`);
  log.info('  Cline 을 이미 열어 두었다면 MCP Servers 화면에서 바뀐 상태를 확인해 주세요. 실습이 끝나면 npm run cleanup 으로 이 항목을 지울 수 있습니다.');
}

function writeRel(dir, rel, content) {
  const file = path.join(dir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

// TASK.md 와 지침 파일은 매번 새로 쓰고, board-app 등 교육생이 만든 파일은 건드리지 않는다.
function prepareRunFolder({ test, id, tool }, runDir, template) {
  fs.mkdirSync(runDir, { recursive: true });
  const eol = template.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(path.join(runDir, 'TASK.md'), `${TASK_HEADERS[test]}${eol}${eol}${template}`);
  const inst = instructionFile(tool, { id, test });
  writeRel(runDir, inst.path, inst.content);
  log.ok(`TASK.md 와 작업 범위 지침 파일(${inst.path})을 썼습니다.`);
  if (fs.existsSync(path.join(runDir, 'board-app'))) log.ok('이미 있는 board-app 폴더는 그대로 두었습니다.');
}

function wireFolderMcp(test, tool, runDir, entry) {
  if (test === 'mcp') {
    const files = folderMcpFiles(tool, { command: process.execPath, args: [entry] });
    for (const [rel, content] of Object.entries(files)) writeRel(runDir, rel, content);
    const names = Object.keys(files);
    if (names.length) {
      log.ok(`MCP 연결 설정(${names.join(', ')})을 썼습니다. 이 폴더를 연 AI 도구에만 ${MCP_SERVER_NAME} 서버가 연결됩니다.`);
    }
    return;
  }
  const removed = [];
  for (const rel of ALL_FOLDER_MCP_PATHS) {
    const file = path.join(runDir, ...rel.split('/'));
    let stat;
    try {
      stat = fs.lstatSync(file);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    fs.rmSync(file, { force: true });
    removed.push(rel);
    if (rel.includes('/')) {
      try {
        fs.rmdirSync(path.dirname(file));
      } catch {
        /* 다른 파일이 남아 있으면 폴더는 둔다 */
      }
    }
  }
  if (removed.length) log.warn(`이 실행은 MCP 없이 진행하므로 폴더에 남아 있던 MCP 연결 설정(${removed.join(', ')})을 지웠습니다.`);
  else if (tool !== 'Cline') log.ok('이 실행은 MCP 없이 진행하므로 MCP 연결 설정을 쓰지 않았습니다.');
}

function recordRun({ test, id, tool }, participant, versions, warnings, now) {
  log.step('참가자 기록을 남깁니다.');
  const file = participantPath(id);
  const shown = toSlash(path.relative(REPO_ROOT, file));
  if (!participant && fs.existsSync(file)) log.warn(`${shown} 파일을 읽을 수 없어 새로 만듭니다.`);
  if (participant?.tool && participant.tool !== tool) {
    log.warn(`앞선 실행은 ${participant.tool} 도구로 준비했는데 이번에는 ${tool} 도구입니다. 두 실행은 같은 도구로 진행하는 것이 원칙이니 --tool 값을 확인해 주세요.`);
  }
  if (participant?.runs?.[test]?.submittedAt) {
    log.warn(`${test} 실행은 이미 제출했습니다. 다시 작업한 뒤 npm run submit 을 실행하면 제출 기록이 갱신됩니다.`);
  }
  const model = TOOLS[tool].model;
  saveParticipant(id, recordSetup(participant, { id, test, tool, model, platform: platformKey(), versions, warnings, now }));
  log.ok(`${shown} 파일에 이번 실행을 기록했습니다.`);
}

const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function printNext({ test, id, tool }, runDir, now) {
  const limit = LIMIT_MINUTES[test];
  const end = new Date(now.getTime() + limit * 60000);
  log.info('');
  log.step('다음 할 일');
  log.info(`  1. AI 도구(${tool})로 다음 폴더를 엽니다.`);
  log.info(`     ${runDir}`);
  log.info(`  2. 도구 설정과 사용 방법은 ${TOOLS[tool].doc} 문서를 참고합니다.`);
  if (test === 'mcp') {
    log.info(`     처음 열 때 폴더 신뢰나 MCP 서버 사용을 묻는 창이 나오면 허용하고, ${MCP_SERVER_NAME} 서버가 연결되었는지 확인합니다.`);
  }
  log.info('  3. 첫 프롬프트로 다음 문장을 입력합니다.');
  log.info(`     ${FIRST_PROMPT}`);
  log.info(`  4. 제한 시간은 ${limit}분입니다. 지금 시작하면 예상 종료 시각은 ${hhmm(end)} 입니다.`);
  log.info(`  5. 작업을 마치면 저장소 폴더(${REPO_ROOT})에서 npm run submit 을 실행합니다.`);
  if (test === 'nomcp') {
    log.info(`  제출을 마친 뒤의 다음 실행은 mcp 입니다. 그때 ${setupCommand('mcp', id, tool)} 를 실행합니다.`);
  } else {
    log.info('  이번 mcp 실행이 마지막 실행입니다.');
  }
}

function main() {
  const ctx = readArgs();
  const { test, id, tool } = ctx;
  log.step(`실습 실행을 준비합니다. (참가자 ${id}, 실행 ${test}, 도구 ${tool})`);
  checkRepo();
  const template = readTaskTemplate();
  const versions = checkEnvironment();
  prepareBranch(id);

  // 여기부터는 submit/{id} 브랜치의 기록을 본다. 파일을 쓰기 전에 막아야 할 조건을 모두 확인한다.
  const participant = loadParticipant(id);
  checkOrder(ctx, participant);
  const runDir = path.join(REPO_ROOT, 'submissions', id, test);
  const warnings = guard(ctx, runDir);
  // 두 실행 모두 번들이 없으면 설치한다. 깨진 번들을 시간 제한이 있는 mcp 실행 전에 발견하기 위해서다.
  const entry = prepareCodegen();

  log.step(`실행 폴더를 준비합니다. (submissions/${id}/${test})`);
  if (tool === 'Cline') toggleClineGlobal(test, entry);
  prepareRunFolder(ctx, runDir, template);
  wireFolderMcp(test, tool, runDir, entry);

  const now = new Date();
  recordRun(ctx, participant, versions, warnings, now);
  printNext(ctx, runDir, now);
}

try {
  main();
} catch (e) {
  log.err(`실행 준비 중 예기치 않은 오류가 발생했습니다: ${e.message}`);
  process.exit(1);
}
