// 실행 폴더의 도구별 MCP 설정 파일, 작업 범위 지침 파일, Cline 전역 토글. Node 내장 모듈만 사용한다.
import fs from 'node:fs';
import path from 'node:path';
import { homeDir, readJson } from './env.mjs';
import { TOOLS, normalizeTool } from './tools.mjs';

export const MCP_SERVER_NAME = 'egovframe-codegen';

const toJson = (obj) => `${JSON.stringify(obj, null, 2)}\n`;

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

export function folderMcpFiles(tool, server) {
  const name = requireTool(tool);
  const stdio = { type: 'stdio', command: server.command, args: server.args };
  const stdioDoc = toJson({ mcpServers: { [MCP_SERVER_NAME]: stdio } });
  switch (name) {
    case 'Claude-Code':
      return {
        '.mcp.json': stdioDoc,
        '.claude/settings.json': toJson({ enabledMcpjsonServers: [MCP_SERVER_NAME] }),
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

export function instructionFile(tool, ctx) {
  const name = requireTool(tool);
  const body = [
    '# 작업 범위',
    '',
    `이 폴더(\`submissions/${ctx.id}/${ctx.test}\`)가 이번 작업 영역의 전부입니다.`,
    '',
    '- 이 폴더 밖의 파일과 폴더(상위 폴더, 다른 실행 폴더, 저장소의 다른 폴더)는 읽거나 검색하거나 참고하지 마세요.',
    '- 파일은 이 폴더 안에서만 만들고 고치세요.',
    '- JDK·Maven 실행과 Maven 로컬 저장소(~/.m2) 사용은 평소대로 하면 됩니다.',
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
  doc.mcpServers[MCP_SERVER_NAME] = {
    command: server.command,
    args: server.args,
    disabled: !enable,
    autoApprove: [],
  };
  const after = toJson(doc);
  if (after === before) return { changed: false };
  if (existed) {
    const backup = path.join(backupDir, path.basename(settingsPath));
    if (!fs.existsSync(backup)) {
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(backup, before);
    }
  }
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, after);
  return { changed: true };
}
