// 제출(npm run submit): 마지막으로 준비한 실행을 기록하고 커밋한 뒤 Fork(origin)에 push 하고 원본 저장소에 PR 을 만든다.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, IS_WIN, log, fail, upstreamConfig } from './lib/env.mjs';
import { parseArgs, ID_PATTERN } from './lib/cli.mjs';
import {
  git,
  requireRepoRoot,
  currentBranch,
  remoteSlug,
  parseSlug,
  ensureIdentity,
  viewerCanPush,
  findOpenPr,
  createPr,
  forkWithRemote,
  compareUrl,
} from './lib/git.mjs';
import { LIMIT_MINUTES, participantPath, loadParticipant, saveParticipant, recordSubmit, lastSetupTest } from './lib/participant.mjs';
import { readGlobalChanges } from './lib/mcp-config.mjs';
import { ghInfo } from './lib/versions.mjs';

const BIG_FILE_BYTES = 20 * 1024 * 1024;
const OWNER_PLACEHOLDER = '<GitHub계정>';
const EXCLUDE_HEADER = '# npm run submit 이 제출에서 뺀 20MB 초과 파일';
// 막 만든 Fork 는 GitHub 이 준비하는 데 몇 초 걸릴 수 있어 push 를 몇 번 다시 시도한다.
const FORK_PUSH_TRIES = 4;
const FORK_PUSH_WAIT_MS = 5000;
const SKIP_DIRS = new Set(['target', 'node_modules', 'build']);

const setupCommand = (test, id, tool) => `npm run setup --test ${test} --id ${id} --tool ${tool}`;
const sameSlug = (a, b) => Boolean(a && b) && a.toLowerCase() === b.toLowerCase();
const fromRepo = (rel) => path.join(REPO_ROOT, ...rel.split('/'));
const shellArg = (a) => (/^[\w@%+=:,./-]+$/.test(a) ? a : JSON.stringify(a));
const showCmd = (cmd, args) => [cmd, ...args].map(shellArg).join(' ');
const lines = (text) => String(text || '').split(/\r?\n/).filter((l) => l.trim());
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function listed(items, max = 5) {
  const shown = items.slice(0, max).join(', ');
  return items.length > max ? `${shown} 외 ${items.length - max}개` : shown;
}

function gitMessage(r) {
  if (r.error) return `git 을 실행할 수 없습니다: ${r.error.message}`;
  return (r.stderr || r.stdout || '').trim() || `git 이 종료 코드 ${r.status} 로 끝났습니다.`;
}

// git 명령이 실패하면 git 의 메시지를 그대로 보여 주고 끝낸다.
function gitOrFail(args, what) {
  const r = git(args);
  if (r.status === 0) return r;
  log.err(`${what} git 이 알려 준 내용은 다음과 같습니다.`);
  for (const l of lines(gitMessage(r))) console.error(`    ${l}`);
  console.error('  문제를 해결한 뒤 npm run submit 을 다시 실행해 주세요. 해결하기 어려우면 진행자에게 알려 주세요.');
  process.exit(1);
}

function readArgs() {
  const args = parseArgs(process.argv.slice(2), process.env, { require: [] });
  if (args.errors.length) {
    for (const e of args.errors) log.err(e);
    log.info('사용법: npm run submit');
    process.exit(1);
  }
  // npm 은 --dry-run 을 npm_config_dry_run=true 로, --no-pr 를 빈 값의 npm_config_pr 로만 넘긴다.
  const pr = process.env.npm_config_pr;
  return {
    dryRun: args.flags.has('dry-run') || process.env.npm_config_dry_run === 'true',
    noPr: args.flags.has('no-pr') || pr === '' || pr === 'false',
    id: args.id,
    test: args.test,
  };
}

function readUpstream() {
  const { upstream, base } = upstreamConfig();
  if (!upstream || !parseSlug(`https://github.com/${upstream}`)) {
    fail('package.json 에서 원본 저장소(edu.upstream)를 읽지 못했습니다. git status 로 package.json 이 바뀌었는지 확인하고 되돌린 뒤 다시 실행해 주세요.');
  }
  return { upstream, base: base || 'main' };
}

// 제출 브랜치(submit/{id})에서만 제출한다. 참가자 ID 는 브랜치 이름에서 얻는다.
function readBranch(opts) {
  const branch = currentBranch();
  const m = branch.match(/^submit\/(.+)$/);
  if (!m || !ID_PATTERN.test(m[1])) {
    log.err(`지금 브랜치(${branch || '브랜치 없음'})는 제출 브랜치(submit/참가자ID)가 아닙니다. 먼저 ${setupCommand('nomcp', '참가자ID', '도구')} 로 실행을 준비하고 작업한 뒤 제출해 주세요.`);
    const own = lines(git(['branch', '--list', '--format=%(refname:short)', 'submit/*']).stdout);
    if (own.length) {
      console.error(`  이미 준비했다면 git switch ${own[0]} 을 실행해 제출 브랜치로 돌아간 뒤 npm run submit 을 다시 실행해 주세요.`);
    }
    process.exit(1);
  }
  const id = m[1];
  if (opts.id && opts.id !== id) {
    fail(`--id 값(${opts.id})이 지금 브랜치(${branch})의 참가자 ID(${id})와 다릅니다. 본인의 제출 브랜치에서 --id 없이 npm run submit 을 실행해 주세요.`);
  }
  return { id, branch };
}

function readRecord(id, opts) {
  const shown = `submissions/${id}/participant.json`;
  const p = loadParticipant(id);
  if (!p) {
    if (fs.existsSync(participantPath(id))) {
      fail(`참가자 기록(${shown})을 읽을 수 없습니다. 파일 내용이 올바른 JSON 인지 확인해 주세요. 고치기 어려우면 진행자에게 알려 주세요.`);
    }
    fail(`참가자 기록(${shown})이 없습니다. 먼저 ${setupCommand('nomcp', id, '도구')} 로 실행을 준비해 주세요.`);
  }
  const test = lastSetupTest(p);
  if (!test) fail(`참가자 기록(${shown})에 준비한 실행이 없습니다. 먼저 ${setupCommand('nomcp', id, '도구')} 로 실행을 준비해 주세요.`);
  if (opts.test && opts.test !== test) {
    log.warn(`npm run submit 은 마지막으로 준비한 실행을 제출합니다. --test ${opts.test} 대신 ${test} 실행을 제출합니다.`);
  }
  const tool = p.tool || p.runs[test]?.tool || '도구';
  return { p, test, tool };
}

// 실행 폴더에서 세 단계 깊이까지 pom.xml 을 찾는다. 과제가 정한 위치는 board-app/pom.xml 이다.
function findPoms(runDir) {
  const found = [];
  const walk = (dir, rel, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isFile() && e.name === 'pom.xml') found.push(relPath);
      else if (e.isDirectory() && depth < 3 && !e.name.startsWith('.') && !SKIP_DIRS.has(e.name)) {
        walk(path.join(dir, e.name), relPath, depth + 1);
      }
    }
  };
  walk(runDir, '', 1);
  return found.sort();
}

function checkRunFolder({ id, test, tool }) {
  const rel = `submissions/${id}/${test}`;
  log.step(`실행 폴더를 점검합니다. (${rel})`);
  const dir = fromRepo(rel);
  if (!fs.existsSync(dir)) fail(`실행 폴더(${rel})가 없습니다. ${setupCommand(test, id, tool)} 로 다시 준비해 주세요.`);
  const poms = findPoms(dir);
  if (poms.includes('board-app/pom.xml')) {
    log.ok('프로젝트 파일(board-app/pom.xml)을 확인했습니다.');
  } else if (poms.length) {
    log.warn(`pom.xml 이 과제에서 정한 위치(board-app/pom.xml)가 아닌 곳에 있습니다(${listed(poms)}). 지금 상태 그대로 제출합니다.`);
  } else {
    log.warn('실행 폴더에서 pom.xml 을 찾지 못했습니다. 과제는 board-app/pom.xml 이 생기도록 프로젝트를 만드는 것이지만, 지금 상태 그대로 제출합니다.');
  }
}

// git status --porcelain -z 의 항목: { x, y, path }. 이름 바꾸기 항목은 원래 이름(from)이 따라온다.
function statusEntries(pathspecs, untracked) {
  const r = gitOrFail(['status', '--porcelain', '-z', `--untracked-files=${untracked}`, '--', ...pathspecs], 'git status 를 실행하지 못했습니다.');
  const parts = r.stdout.split('\0');
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const s = parts[i];
    if (s.length < 4) continue;
    const e = { x: s[0], y: s[1], path: s.slice(3) };
    if (e.x === 'R' || e.x === 'C') e.from = parts[++i];
    out.push(e);
  }
  return out;
}

// 실행 폴더 안에서 git init 을 하면 그 폴더는 파일 대신 빈 참조로만 커밋된다. 제출이 비지 않게 미리 막는다.
function stopOnNestedRepos(entries) {
  const nested = entries.filter((e) => e.x === '?' && e.path.endsWith('/'));
  if (!nested.length) return;
  log.err('제출 폴더 안에 별도의 git 저장소(.git 폴더)가 있어 그 안의 파일이 제출되지 않습니다. 아래 .git 폴더를 지운 뒤 npm run submit 을 다시 실행해 주세요. 작업한 파일은 그대로 남습니다.');
  for (const e of nested) {
    const dotGit = path.join(...e.path.replace(/\/+$/, '').split('/'), '.git');
    console.error(`  - ${dotGit}`);
    console.error(`    지우는 명령: ${IS_WIN ? `Remove-Item -Recurse -Force "${dotGit}"` : `rm -rf "${dotGit}"`}`);
  }
  process.exit(1);
}

// 20MB 를 넘는 파일 가운데 이번에 git 이 더할 파일(새 파일, 바뀐 파일)
function findBigFiles(entries) {
  const big = [];
  for (const e of entries) {
    if (e.x === 'D' || e.y === 'D' || e.path.endsWith('/')) continue;
    let st;
    try {
      st = fs.lstatSync(fromRepo(e.path));
    } catch {
      continue;
    }
    if (st.isFile() && st.size > BIG_FILE_BYTES) big.push({ path: e.path, size: st.size, tracked: e.x !== '?' });
  }
  return big;
}

// .gitignore 형식에서 특별한 뜻이 있는 문자를 이스케이프한다.
const ignoreLine = (rel) => `/${rel.replace(/[\\*?[\]]/g, '\\$&').replace(/ +$/, (sp) => sp.replace(/ /g, '\\ '))}`;

function excludeBigFiles(big, dryRun) {
  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)}MB`;
  if (dryRun) log.warn(`20MB 를 넘는 파일 ${big.length}개는 제출할 때 .git/info/exclude 에 적어 제출에서 뺍니다.`);
  else log.warn(`20MB 를 넘는 파일 ${big.length}개는 제출에서 뺍니다. .git/info/exclude 에 적어 두어 다음 제출에서도 빠집니다.`);
  for (const b of big) log.info(`  - ${b.path} (${mb(b.size)})`);
  const tracked = big.filter((b) => b.tracked).map((b) => b.path);
  const rmArgs = ['--literal-pathspecs', 'rm', '--cached', '-f', '-q', '--', ...tracked];
  if (dryRun) {
    if (tracked.length) log.info(`  실행할 명령: ${showCmd('git', rmArgs)}`);
    return;
  }
  const where = gitOrFail(['rev-parse', '--git-path', 'info/exclude'], '제외 목록 파일의 위치를 찾지 못했습니다.');
  const file = path.resolve(REPO_ROOT, where.stdout.trim());
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    /* 없으면 새로 만든다 */
  }
  const have = new Set(text.split(/\r?\n/));
  const add = [...new Set(big.map((b) => ignoreLine(b.path)))].filter((l) => !have.has(l));
  if (add.length) {
    if (!have.has(EXCLUDE_HEADER)) add.unshift(EXCLUDE_HEADER);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${text && !text.endsWith('\n') ? '\n' : ''}${add.join('\n')}\n`);
  }
  // 이미 커밋한 파일은 제외 목록만으로는 빠지지 않으므로 git 의 관리 대상에서만 뺀다 (작업 폴더의 파일은 그대로 둔다).
  if (tracked.length) gitOrFail(rmArgs, '20MB 를 넘는 파일을 제출에서 빼지 못했습니다.');
}

// 제출 폴더 밖의 변경은 제출하지 않는다. 스테이징해 둔 것은 이번 커밋에 섞이지 않게 스테이징만 푼다.
function reportOutside(id, dryRun) {
  const outside = statusEntries(['.', `:(exclude)submissions/${id}`], 'normal');
  if (!outside.length) return;
  log.warn(`submissions/${id} 밖에서 바뀐 파일은 제출되지 않습니다: ${listed(outside.map((e) => e.path))}`);
  const staged = outside.filter((e) => e.x !== ' ' && e.x !== '?' && e.x !== '!');
  if (!staged.length) return;
  const resetArgs = ['reset', '-q', '--', '.', `:(exclude)submissions/${id}`];
  if (dryRun) log.info(`  실행할 명령: ${showCmd('git', resetArgs)}`);
  else {
    gitOrFail(resetArgs, '제출 폴더 밖의 스테이징을 풀지 못했습니다.');
    log.info('  이 가운데 스테이징해 둔 변경은 이번 커밋에 섞이지 않도록 스테이징만 풀었습니다. 파일 내용은 그대로입니다.');
  }
}

function collectChanges(id, dryRun) {
  log.step('제출할 변경을 확인합니다.');
  const entries = statusEntries([`submissions/${id}`], 'all');
  stopOnNestedRepos(entries);
  const big = findBigFiles(entries);
  if (big.length) excludeBigFiles(big, dryRun);
  reportOutside(id, dryRun);
  const skipped = new Set(big.filter((b) => !b.tracked).map((b) => b.path));
  const changes = entries.filter((e) => !skipped.has(e.path));
  if (changes.length) log.ok(`submissions/${id} 에서 바뀐 파일 ${changes.length}개를 제출합니다.`);
  return changes;
}

function reportElapsed(test, run, dryRun) {
  const m = run.elapsedMinutes;
  const limit = run.limitMinutes ?? LIMIT_MINUTES[test];
  if (typeof m !== 'number') {
    log.warn(`${test} 실행을 준비한 시각을 찾지 못해 소요 시간을 계산하지 못했습니다.`);
  } else if (dryRun) {
    const over = run.overLimit ? ` 제한 시간 ${limit}분을 넘지만 제출은 막지 않습니다.` : ` (제한 시간 ${limit}분)`;
    (run.overLimit ? log.warn : log.ok)(`지금 제출하면 ${test} 실행의 소요 시간은 ${m}분으로 기록됩니다.${over}`);
  } else if (run.overLimit) {
    log.warn(`${test} 실행의 소요 시간은 ${m}분으로 제한 시간 ${limit}분을 넘었습니다. 기록만 남기고 제출은 그대로 진행합니다.`);
  } else {
    log.ok(`${test} 실행의 소요 시간은 ${m}분입니다. (제한 시간 ${limit}분)`);
  }
}

// 바뀐 것이 있을 때만 제출 시각을 기록하고 커밋한다. 소요 시간이 마지막 실제 변경에 묶이게 하기 위해서다.
// 아직 제출 기록이 없는 실행은 바뀐 것이 없어도 기록한다 (예: 직접 커밋한 뒤 처음 제출하는 경우).
function commitRun(ctx, changes, dryRun) {
  const { id, test, p } = ctx;
  const run = p.runs[test] || {};
  if (!changes.length && run.submittedAt) {
    log.warn('바뀐 것이 없어 새 커밋을 만들지 않습니다. 앞서 만든 커밋을 다시 push 하고 PR 을 확인합니다.');
    if (typeof run.elapsedMinutes === 'number') log.info(`  ${test} 실행의 제출 기록(소요 시간 ${run.elapsedMinutes}분)은 그대로 둡니다.`);
    return p;
  }
  log.step('제출 기록을 남기고 커밋합니다.');
  const updated = recordSubmit(p, { test, now: new Date() });
  reportElapsed(test, updated.runs[test], dryRun);
  const addArgs = ['add', '-A', '--', `submissions/${id}`];
  const commitArgs = ['commit', '-q', '-m', `submit: ${id} ${test}`];
  if (dryRun) {
    log.info(`  실행할 명령: ${showCmd('git', addArgs)}`);
    log.info(`  실행할 명령: ${showCmd('git', commitArgs)}`);
    return updated;
  }
  saveParticipant(id, updated);
  gitOrFail(addArgs, '제출할 파일을 git 에 더하지 못했습니다.');
  ensureIdentity();
  gitOrFail(commitArgs, '커밋하지 못했습니다.');
  const sha = git(['rev-parse', '--short', 'HEAD']).stdout.trim();
  log.ok(`submissions/${id} 의 변경을 커밋했습니다. (${sha} submit: ${id} ${test})`);
  return updated;
}

// origin 이 원본 저장소면 push 권한이 있을 때(진행자 리허설)만 그대로 쓰고, 아니면 Fork 를 만들어 origin 으로 바꾼다.
function pushTarget(upstream, dryRun) {
  const origin = remoteSlug('origin');
  if (!sameSlug(origin, upstream)) return { slug: origin, forked: false };
  if (dryRun) {
    log.step(`origin 이 원본 저장소(${upstream})입니다. push 권한이 없으면 먼저 본인 계정에 Fork 를 만들고 origin 을 Fork 로 바꿉니다.`);
    log.info(`  실행할 명령: ${showCmd('gh', ['repo', 'fork', '--remote'])}`);
    return { slug: origin, forked: false };
  }
  if (viewerCanPush(upstream) === true) {
    log.warn(`origin 이 원본 저장소(${upstream})이고 push 권한이 있어 원본 저장소에 바로 push 합니다. 진행자 리허설이 아니라면 진행자에게 알려 주세요.`);
    return { slug: origin, forked: false };
  }
  log.step(`origin 이 원본 저장소(${upstream})여서 본인 계정에 Fork 를 만들고 origin 을 Fork 로 바꿉니다.`);
  const f = forkWithRemote();
  const fork = f.ok ? remoteSlug('origin') : null;
  if (!f.ok || !fork || sameSlug(fork, upstream)) {
    log.err('Fork 를 만들거나 origin 을 Fork 로 바꾸지 못했습니다. gh 가 알려 준 내용은 다음과 같습니다.');
    for (const l of lines(f.message)) console.error(`    ${l}`);
    console.error('  GitHub CLI(gh)가 설치되어 있는지, gh auth login 으로 로그인했는지 확인한 뒤 npm run submit 을 다시 실행해 주세요.');
    console.error('  커밋은 이 PC 에 남아 있으니 다시 실행하면 그대로 이어서 제출합니다. 해결하기 어려우면 진행자에게 알려 주세요.');
    process.exit(1);
  }
  log.ok(`Fork(${fork})를 만들어 origin 으로 설정했습니다. 원본 저장소는 upstream 이라는 이름으로 남겨 두었습니다.`);
  return { slug: fork, forked: true };
}

function pushFailed(r) {
  log.err('origin 에 push 하지 못했습니다. git 이 알려 준 내용은 다음과 같습니다.');
  for (const l of lines(gitMessage(r))) console.error(`    ${l}`);
  console.error('  다음을 확인한 뒤 npm run submit 을 다시 실행해 주세요. 커밋은 이 PC 에 남아 있어 다시 실행하면 그대로 push 합니다.');
  console.error('  - GitHub 에 로그인되어 있지 않다면 gh auth login 으로 로그인하고 gh auth setup-git 을 한 번 실행합니다.');
  console.error('  - 인터넷 연결과 프록시 설정을 확인합니다.');
  if (/\[rejected\]|non-fast-forward|fetch first/.test(`${r.stderr}${r.stdout}`)) {
    console.error('  - 원격 브랜치에 이 PC 에 없는 커밋이 있어 push 가 거부되었습니다. 이 경우에는 진행자에게 알려 주세요.');
  }
  process.exit(1);
}

// 새로 올릴 커밋이 있었는지 돌려준다 (origin 의 브랜치를 마지막으로 본 상태와 비교).
function pushBranch(branch, target, dryRun) {
  const args = ['push', '-u', 'origin', branch];
  log.step(`origin 에 ${branch} 브랜치를 push 합니다.`);
  if (dryRun) {
    log.info(`  실행할 명령: ${showCmd('git', args)}`);
    return true;
  }
  const head = git(['rev-parse', 'HEAD']).stdout.trim();
  const seen = git(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`]).stdout.trim();
  const tries = target.forked ? FORK_PUSH_TRIES : 1;
  let r;
  for (let i = 1; i <= tries; i++) {
    r = git(args);
    if (r.status === 0) break;
    if (i < tries) {
      log.warn(`막 만든 Fork 가 아직 준비되지 않았을 수 있어 ${FORK_PUSH_WAIT_MS / 1000}초 뒤 다시 push 합니다. (${i + 1}/${tries})`);
      sleep(FORK_PUSH_WAIT_MS);
    }
  }
  if (r.status !== 0) pushFailed(r);
  log.ok(`origin 에 ${branch} 브랜치를 push 했습니다.`);
  return seen !== head;
}

const cell = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));

// PR 본문: 도구·모델·플랫폼과 실행별 시각. 절대 경로와 PC 사용자 이름은 넣지 않는다.
function prBody(id, p) {
  const row = (t) => {
    const r = p.runs?.[t];
    if (!r) return `| ${t} | 준비 전 | - | - | ${LIMIT_MINUTES[t]} | - |`;
    const done = Boolean(r.submittedAt);
    return `| ${t} | ${cell(r.setupAt)} | ${done ? r.submittedAt : '제출 전'} | ${done ? cell(r.elapsedMinutes) : '-'} | ${cell(r.limitMinutes)} | ${done ? (r.overLimit ? '예' : '아니요') : '-'} |`;
  };
  return [
    `참가자 ${id} 의 실습 제출입니다. npm run submit 이 만들었습니다.`,
    '',
    `- 도구: ${cell(p.tool)}`,
    `- 모델: ${cell(p.model)}`,
    `- 플랫폼: ${cell(p.platform)}`,
    '',
    '| 실행 | 준비 시각(UTC) | 제출 시각(UTC) | 소요 시간(분) | 제한 시간(분) | 제한 시간 초과 |',
    '|---|---|---|---|---|---|',
    row('nomcp'),
    row('mcp'),
    '',
    `이 표는 PR 을 만들 때의 기록입니다. 최신 기록은 \`submissions/${id}/participant.json\` 에 있습니다.`,
    '',
  ].join('\n');
}

// origin 이 GitHub 주소가 아니면 계정 자리를 비워 둔 비교 주소를 준다.
function compareLink(upstream, base, slug, branch) {
  if (slug) {
    const [owner, repo] = slug.split('/');
    return compareUrl(upstream, base, owner, repo, branch);
  }
  return `https://github.com/${upstream}/compare/${base}...${OWNER_PLACEHOLDER}:${upstream.split('/')[1]}:${branch}?expand=1`;
}

function handlePr(ctx, target, pushedNew, opts) {
  const { id, tool, p, upstream, base, branch } = ctx;
  const compare = { label: 'PR 만들기 주소', url: compareLink(upstream, base, target.slug, branch) };
  if (opts.noPr) {
    log.warn('--no-pr 옵션에 따라 PR 단계를 건너뜁니다.');
    return compare;
  }
  log.step(`원본 저장소(${upstream})의 PR 을 확인합니다.`);
  const owner = target.slug ? target.slug.split('/')[0] : null;
  const title = `[제출] ${id} (${tool})`;
  const head = `${owner || OWNER_PLACEHOLDER}:${branch}`;
  if (opts.dryRun) {
    log.info('  같은 브랜치로 열린 PR 이 있으면 새로 만들지 않고, push 한 커밋으로 그 PR 이 갱신됩니다.');
    log.info(`  실행할 명령: ${showCmd('gh', ['pr', 'create', '--repo', upstream, '--base', base, '--head', head, '--title', title, '--body-file', '-'])}`);
    return compare;
  }
  if (!owner) {
    log.warn(`origin 이 GitHub 저장소 주소가 아니어서 PR 을 자동으로 만들 수 없습니다. 아래 주소의 ${OWNER_PLACEHOLDER} 을 본인의 GitHub 계정으로 바꿔 브라우저에서 열고 PR 을 만들어 주세요.`);
    return compare;
  }
  if (!ghInfo().found) {
    log.warn('GitHub CLI(gh)를 찾지 못해 PR 을 자동으로 확인하거나 만들 수 없습니다. 아래 주소를 브라우저에서 열어 PR 을 만들어 주세요. 이미 PR 을 만들었다면 push 한 커밋으로 그 PR 이 갱신되었습니다.');
    return compare;
  }
  const open = findOpenPr(upstream, owner, branch);
  if (open) {
    if (pushedNew) log.ok('PR 이 갱신되었습니다. 새로 push 한 커밋이 PR 에 들어갔습니다.');
    else log.ok('이미 열려 있는 PR 이 있습니다. 새로 push 한 커밋은 없습니다.');
    return { label: 'PR', url: open };
  }
  const pr = createPr({ slug: upstream, base, head, title, body: prBody(id, p) });
  if (pr.url) {
    log.ok('원본 저장소에 PR 을 만들었습니다.');
    return { label: 'PR', url: pr.url };
  }
  log.warn('PR 을 자동으로 만들지 못했습니다. gh 가 알려 준 내용은 다음과 같습니다.');
  for (const l of lines(pr.error)) log.info(`    ${l}`);
  log.info('  gh auth login 으로 로그인되어 있는지 확인해 주세요. 이번에는 아래 주소를 브라우저에서 열어 PR 을 만들면 됩니다.');
  return compare;
}

function printNext(ctx, link, dryRun) {
  const { id, test, tool, p } = ctx;
  log.info('');
  log.step('다음 할 일');
  if (dryRun) {
    log.info('  --dry-run 이라 커밋, push, PR 을 하지 않았고 참가자 기록도 바꾸지 않았습니다. 실제로 제출하려면 npm run submit 을 실행해 주세요.');
    return;
  }
  log.info(`  ${link.label}: ${link.url}`);
  const runs = p.runs || {};
  if (test === 'nomcp' && !runs.mcp?.submittedAt) {
    log.info(`  다음 실행은 mcp 입니다. 진행자가 안내하면 ${setupCommand('mcp', id, tool)} 를 실행해 주세요.`);
    return;
  }
  if (runs.nomcp?.submittedAt && runs.mcp?.submittedAt) {
    log.info('  두 실행을 모두 제출했습니다. 수고하셨습니다.');
    const changes = readGlobalChanges();
    if (changes && changes.length) {
      log.info('  실습이 모두 끝나면 npm run cleanup 으로 setup 이 바꾼 전역 설정을 되돌릴 수 있습니다.');
    }
  }
}

function main() {
  const opts = readArgs();
  const { upstream, base } = readUpstream();
  log.step('제출을 준비합니다.');
  requireRepoRoot();
  const { id, branch } = readBranch(opts);
  const { p, test, tool } = readRecord(id, opts);
  log.ok(`참가자 ${id} 의 ${test} 실행을 제출합니다. (도구 ${tool}, 브랜치 ${branch})`);
  if (opts.dryRun) {
    log.warn('--dry-run 옵션에 따라 커밋, push, PR 명령을 실행하지 않고 보여 주기만 합니다. 참가자 기록과 제외 목록도 바꾸지 않습니다.');
  }
  const ctx = { id, test, tool, p, upstream, base, branch };

  checkRunFolder(ctx);
  const changes = collectChanges(id, opts.dryRun);
  ctx.p = commitRun(ctx, changes, opts.dryRun);
  const target = pushTarget(upstream, opts.dryRun);
  const pushedNew = pushBranch(branch, target, opts.dryRun);
  const link = handlePr(ctx, target, pushedNew, opts);
  printNext(ctx, link, opts.dryRun);
}

try {
  main();
} catch (e) {
  log.err(`제출 중 예기치 않은 오류가 발생했습니다: ${e.message}`);
  process.exit(1);
}
