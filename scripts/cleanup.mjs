// 실습 후 정리(npm run cleanup): setup 이 전역 설정에 넣은 항목(현재는 Cline 의 egovframe-codegen)만 되돌린다.
// 사용자가 원래 갖고 있던 설정과 실행 폴더 단위 설정은 건드리지 않는다.
import fs from 'node:fs';
import { log, fail } from './lib/env.mjs';
import { parseArgs } from './lib/cli.mjs';
import { MCP_SERVER_NAME, readGlobalChanges, writeGlobalChanges, undoClineChange } from './lib/mcp-config.mjs';

// 기록 하나를 되돌리고 결과를 알린다. 'changed'(파일을 고침), 'kept'(고칠 것이 없음), 'failed' 중 하나를 돌려준다.
function undo(change) {
  const server = change.server || MCP_SERVER_NAME;
  const where = `(${change.file})`;
  const r = undoClineChange(change);
  switch (r.result) {
    case 'restored':
      log.ok(`Cline 전역 설정의 ${server} 항목을 setup 이 바꾸기 전 상태로 되돌렸습니다. ${where}`);
      return 'changed';
    case 'removed':
      log.ok(`Cline 전역 설정에서 setup 이 넣은 ${server} 항목을 지웠습니다. ${where}`);
      return 'changed';
    case 'absent':
      log.ok(`Cline 전역 설정에 ${server} 항목이 이미 없어 바꿀 것이 없습니다. ${where}`);
      return 'kept';
    case 'no-file':
      log.warn(`Cline 설정 파일이 없어 바꾸지 않았습니다. ${where}`);
      return 'kept';
    default:
      log.err(`Cline 설정 파일(${change.file})이 올바른 JSON 이 아니어서 건드리지 않았습니다. 이 파일을 고친 뒤 npm run cleanup 을 다시 실행하거나, Cline 의 MCP Servers 화면에서 ${server} 항목을 직접 지워 주세요.`);
      return 'failed';
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2), process.env, { require: [] });
  if (args.errors.length) {
    for (const e of args.errors) log.err(e);
    log.info('사용법: npm run cleanup');
    process.exit(1);
  }
  log.step('setup 이 바꾼 전역 설정을 되돌립니다.');
  const changes = readGlobalChanges();
  if (changes === null) {
    fail(`setup 이 남긴 기록(.edu/global-changes.json)을 읽을 수 없어 되돌리지 못했습니다. Cline 을 썼다면 Cline 의 MCP Servers 화면에서 ${MCP_SERVER_NAME} 항목을 직접 지워 주세요.`);
  }
  if (!changes.length) {
    log.ok('setup 이 바꾼 전역 설정이 없어 되돌릴 것이 없습니다.');
    return;
  }

  const remaining = [];
  const backups = new Set();
  let changed = 0;
  let failed = 0;
  for (const change of changes) {
    if (change.tool !== 'Cline' || typeof change.file !== 'string' || !change.file) {
      log.warn('알 수 없는 기록이 있어 건너뜁니다. 기록은 .edu/global-changes.json 에 그대로 남겨 둡니다.');
      remaining.push(change);
      continue;
    }
    const result = undo(change);
    if (result === 'failed') {
      failed += 1;
      remaining.push(change);
      continue;
    }
    if (result === 'changed') changed += 1;
    if (typeof change.backup === 'string' && fs.existsSync(change.backup)) backups.add(change.backup);
  }
  writeGlobalChanges(remaining);

  if (changed) log.info('  Cline 을 열어 두었다면 MCP Servers 화면에서 바뀐 상태를 확인해 주세요.');
  for (const b of backups) log.info(`  setup 이 처음 바꾸기 전의 설정 파일 사본은 ${b} 에 남겨 두었습니다.`);
  if (failed) process.exit(1);
  log.ok('정리를 마쳤습니다.');
}

try {
  main();
} catch (e) {
  log.err(`정리 중 예기치 않은 오류가 발생했습니다: ${e.message}`);
  process.exit(1);
}
