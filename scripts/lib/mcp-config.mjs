// 실행 폴더의 도구별 MCP 설정 파일, 작업 범위 지침 파일, Cline 전역 토글과 그 기록·되돌리기. Node 내장 모듈만 사용한다.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, homeDir, readJson, writeJson } from './env.mjs';
import { TOOLS, normalizeTool } from './tools.mjs';

export const MCP_SERVER_NAME = 'egovframe-codegen';

const toJson = (obj) => `${JSON.stringify(obj, null, 2)}\n`;
const isObj = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

export const ALL_FOLDER_MCP_PATHS = [
  '.mcp.json',
  '.claude/settings.json',
  '.codex/config.toml',
  '.agents/mcp_config.json',
  '.cursor/mcp.json',
];

function requireTool(tool) {
  const name = normalizeTool(tool);
  if (!name) throw new Error(`알 수 없는 도구: ${tool}`);
  return name;
}

// Claude Code 가 claude.ai 계정에서 가져오는 커넥터(MCP 서버)를 끈다. 두 실행 폴더에 똑같이 써서
// 두 실행의 차이가 egovframe-codegen 하나가 되게 한다. 프로젝트 설정의 true 는 다른 설정보다 앞선다.
const CLAUDE_NO_CONNECTORS = { disableClaudeAiConnectors: true };

// mcp 실행 폴더에 쓰는 도구 설정
export function folderMcpFiles(tool, server) {
  const name = requireTool(tool);
  const stdio = { type: 'stdio', command: server.command, args: server.args };
  const stdioDoc = toJson({ mcpServers: { [MCP_SERVER_NAME]: stdio } });
  switch (name) {
    case 'Claude-Code':
      return {
        '.mcp.json': stdioDoc,
        '.claude/settings.json': toJson({ enabledMcpjsonServers: [MCP_SERVER_NAME], ...CLAUDE_NO_CONNECTORS }),
      };
    case 'GitHub-Copilot':
      return { '.mcp.json': stdioDoc };
    case 'Cursor':
      return { '.cursor/mcp.json': stdioDoc };
    case 'Antigravity':
      return {
        '.agents/mcp_config.json': toJson({
          mcpServers: { [MCP_SERVER_NAME]: { command: server.command, args: server.args } },
        }),
      };
    case 'Codex':
      return {
        '.codex/config.toml': [
          '# 이 실행 폴더에서만 연결하는 MCP 서버',
          `[mcp_servers.${MCP_SERVER_NAME}]`,
          `command = ${JSON.stringify(server.command)}`,
          `args = [${server.args.map((a) => JSON.stringify(a)).join(', ')}]`,
          '',
        ].join('\n'),
      };
    default:
      return {};
  }
}

// nomcp 실행 폴더에 쓰는 도구 설정. MCP 서버는 연결하지 않고, mcp 실행에도 똑같이 들어가는 설정만 쓴다
// (지금은 Claude Code 의 claude.ai 커넥터 끄기 하나). setup 은 nomcp 에서 MCP 연결 설정을 지울 때 이 파일은 남긴다.
export function folderNomcpFiles(tool) {
  const name = requireTool(tool);
  if (name === 'Claude-Code') return { '.claude/settings.json': toJson(CLAUDE_NO_CONNECTORS) };
  return {};
}

export function instructionFile(tool, ctx) {
  const name = requireTool(tool);
  const body = [
    '# 작업 범위',
    '',
    `이 폴더(\`submissions/${ctx.id}/${ctx.test}\`)가 이번 작업 영역의 전부입니다.`,
    '',
    '- 이 폴더 밖의 파일과 폴더(상위 폴더, 다른 실행 폴더, 저장소의 다른 폴더)는 읽거나 검색하거나 참고하지 않습니다.',
    '- 파일은 이 폴더 안에서만 만들고 고칩니다.',
    '- JDK, Maven, Maven 로컬 저장소(~/.m2)는 평소대로 사용합니다.',
    '',
  ].join('\n');
  const front = name === 'Cursor' ? '---\ndescription: 작업 범위\nalwaysApply: true\n---\n' : '';
  return { path: TOOLS[name].instruction, content: front + body };
}

export function clineSettingsPath(env = process.env) {
  if (env.CLINE_MCP_SETTINGS_PATH) return env.CLINE_MCP_SETTINGS_PATH;
  const file = path.join('settings', 'cline_mcp_settings.json');
  if (env.CLINE_DATA_DIR) return path.join(env.CLINE_DATA_DIR, file);
  if (env.CLINE_DIR) return path.join(env.CLINE_DIR, 'data', file);
  return path.join(homeDir(), '.cline', 'data', file);
}

// previousEntry 는 이번에 바꾸기 전의 egovframe-codegen 항목(없으면 null)이다. cleanup 이 되돌릴 때 쓴다.
export function toggleCline(enable, server, opts) {
  const { settingsPath, backupDir } = opts;
  const existed = fs.existsSync(settingsPath);
  const before = existed ? fs.readFileSync(settingsPath, 'utf8') : null;
  let doc = { mcpServers: {} };
  if (existed) {
    doc = readJson(settingsPath, null);
    if (!doc || typeof doc !== 'object' || Array.isArray(doc) || doc.__invalid) {
      return { changed: false, aborted: 'Cline 설정 파일이 올바른 JSON 이 아니어서 건드리지 않았습니다.' };
    }
    if (doc.mcpServers === undefined) doc.mcpServers = {};
    if (!doc.mcpServers || typeof doc.mcpServers !== 'object' || Array.isArray(doc.mcpServers)) {
      return { changed: false, aborted: 'Cline 설정 파일의 mcpServers 형식이 올바르지 않아 건드리지 않았습니다.' };
    }
  }
  const previousEntry = Object.hasOwn(doc.mcpServers, MCP_SERVER_NAME) ? doc.mcpServers[MCP_SERVER_NAME] : null;
  doc.mcpServers[MCP_SERVER_NAME] = {
    command: server.command,
    args: server.args,
    disabled: !enable,
    autoApprove: [],
  };
  const after = toJson(doc);
  if (after === before) return { changed: false, previousEntry };
  if (existed) {
    const backup = path.join(backupDir, path.basename(settingsPath));
    if (!fs.existsSync(backup)) {
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(backup, before);
    }
  }
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, after);
  return { changed: true, previousEntry };
}

// setup 이 바꾼 전역 설정의 기록(.edu/global-changes.json). npm run cleanup 은 이 기록만 보고 되돌린다.
export function globalChangesPath(repoRoot = REPO_ROOT) {
  return path.join(repoRoot, '.edu', 'global-changes.json');
}

// 기록 목록. 파일이 없으면 빈 배열, 읽을 수 없으면 null.
export function readGlobalChanges(repoRoot = REPO_ROOT) {
  const doc = readJson(globalChangesPath(repoRoot), undefined);
  if (doc === undefined) return [];
  if (!isObj(doc) || doc.__invalid || !Array.isArray(doc.changes)) return null;
  return doc.changes.filter(isObj);
}

export function writeGlobalChanges(changes, repoRoot = REPO_ROOT) {
  writeJson(globalChangesPath(repoRoot), { changes });
}

const sameTarget = (a, b) => a.tool === b.tool && a.file === b.file && a.server === b.server;

// 같은 파일·서버의 기록은 하나로 유지한다. previousEntry 는 처음 바꾸기 전의 값이므로 처음 기록한 것을 지킨다.
// 처음 값을 알 수 없으면(previousEntry 가 없는 예전 기록, 읽을 수 없는 기록 파일) null 로 두어 cleanup 이 항목을 지우게 한다.
export function recordGlobalChange(change, repoRoot = REPO_ROOT) {
  const changes = readGlobalChanges(repoRoot);
  if (changes === null) {
    writeGlobalChanges([{ ...change, previousEntry: null }], repoRoot);
    return;
  }
  const i = changes.findIndex((c) => sameTarget(c, change));
  if (i === -1) {
    changes.push({ ...change, previousEntry: change.previousEntry ?? null });
  } else {
    const old = changes[i];
    changes[i] = { ...change, previousEntry: Object.hasOwn(old, 'previousEntry') ? old.previousEntry : null };
  }
  writeGlobalChanges(changes, repoRoot);
}

// cleanup: setup 이 Cline 설정에 넣은 항목을 처음 바꾸기 전 상태로 되돌린다. previousEntry 가 있으면 그 값으로,
// 없으면 항목을 지운다. 다른 서버와 키는 그대로 두고, 읽을 수 없는 파일은 건드리지 않는다.
// result: 'restored' | 'removed' | 'absent'(이미 없음) | 'no-file' | 'invalid'
export function undoClineChange(change) {
  const file = change.file;
  const server = change.server || MCP_SERVER_NAME;
  const previousEntry = change.previousEntry ?? null;
  if (!fs.existsSync(file)) return { result: 'no-file' };
  const doc = readJson(file, null);
  if (!isObj(doc) || doc.__invalid) return { result: 'invalid' };
  if (doc.mcpServers !== undefined && !isObj(doc.mcpServers)) return { result: 'invalid' };
  if (previousEntry === null) {
    if (!doc.mcpServers || !Object.hasOwn(doc.mcpServers, server)) return { result: 'absent' };
    delete doc.mcpServers[server];
  } else {
    doc.mcpServers = doc.mcpServers || {};
    doc.mcpServers[server] = previousEntry;
  }
  fs.writeFileSync(file, toJson(doc));
  return { result: previousEntry === null ? 'removed' : 'restored' };
}
