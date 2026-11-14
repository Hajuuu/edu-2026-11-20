// 전날 환경 점검: 도구 확인, 저장소 위치 확인, codegen MCP 설치, Maven 의존성 미리 받기.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run, mvnInvocation, log, upstreamConfig } from './lib/env.mjs';
import { parseArgs } from './lib/cli.mjs';
import { installBundle } from './lib/bundle.mjs';
import { scaffoldBoard } from './lib/mcp-client.mjs';
import { remoteSlug } from './lib/git.mjs';

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

function firstLine(s) {
  return (s || '').split(/\r?\n/).find((l) => l.trim()) || '';
}

function checkJdk() {
  const r = run('java', ['-version']);
  const text = `${r.stderr}\n${r.stdout}`;
  const m = text.match(/version "(\d+)(?:\.(\d+))?[^"]*"/);
  if (!m) return err('JDK 를 찾지 못했습니다. JDK 17 을 설치하고 터미널을 다시 열어 주세요.');
  const major = m[1] === '1' ? Number(m[2]) : Number(m[1]);
  if (major === 17) ok(`JDK 17 을 확인했습니다. (${firstLine(text)})`);
  else warn(`JDK ${major} 이(가) 설치되어 있습니다. 교육은 JDK 17 기준이므로 JDK 17 을 설치해 주세요.`);
}

function checkMaven() {
  const { cmd, shell } = mvnInvocation();
  const r = run(cmd, ['-version'], { shell });
  const m = r.status === 0 ? r.stdout.match(/Apache Maven (\d+)\.(\d+)/) : null;
  if (!m) return err('Maven 을 찾지 못했습니다. Maven 3.9 이상을 설치하고 터미널을 다시 열어 주세요.');
  const [major, minor] = [Number(m[1]), Number(m[2])];
  if (major === 3 && minor >= 9) ok(`Maven 을 확인했습니다. (${firstLine(r.stdout)})`);
  else warn(`Maven ${major}.${minor} 이(가) 설치되어 있습니다. Maven 3.9 이상으로 올려 주세요.`);
}

function checkNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) {
    err(`Node.js ${process.versions.node} 은(는) 너무 낮습니다. Node.js 22 이상을 설치해 주세요.`);
    return false;
  }
  if (major < 22) warn(`Node.js ${process.versions.node} 이(가) 설치되어 있습니다. Node.js 22 이상을 권장합니다.`);
  else ok(`Node.js ${process.versions.node} 을(를) 확인했습니다.`);
  return true;
}

function checkGit() {
  const r = run('git', ['--version']);
  if (r.status === 0) ok(`Git 을 확인했습니다. (${firstLine(r.stdout)})`);
  else err('Git 을 찾지 못했습니다. Git 을 설치하고 터미널을 다시 열어 주세요.');
}

function checkGh() {
  const r = run('gh', ['--version']);
  if (r.status !== 0) return err('GitHub CLI(gh) 를 찾지 못했습니다. gh 를 설치하고 터미널을 다시 열어 주세요.');
  ok(`GitHub CLI 를 확인했습니다. (${firstLine(r.stdout)})`);
  const a = run('gh', ['auth', 'status']);
  if (a.status === 0) ok('GitHub 로그인 상태를 확인했습니다.');
  else warn('GitHub 에 로그인되어 있지 않습니다. gh auth login 을 실행해 로그인해 주세요.');
}

function checkOrigin() {
  const { upstream } = upstreamConfig();
  const slug = remoteSlug();
  if (slug && upstream && slug.toLowerCase() === upstream.toLowerCase()) {
    warn(`이 저장소는 원본(${upstream})을 그대로 clone 한 것입니다. 본인의 Fork 를 clone 해 주세요. 아직 Fork 가 없다면 npm run submit 이 자동으로 만들어 줍니다.`);
  } else {
    ok(`origin 원격을 확인했습니다. (${slug ?? '확인할 수 없음'})`);
  }
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
  checkGit();
  checkGh();
  checkOrigin();
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
