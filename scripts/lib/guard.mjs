// 전날 점검과 setup 이 쓰는 감지 모듈: 전역에 남은 MCP 서버, 자동으로 읽히는 지침 파일.
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './env.mjs';
import { MCP_SERVER_NAME, clineSettingsPath } from './mcp-config.mjs';

const CODEGEN_PKG = 'egovframe-mcp-codegen';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function readDoc(file) {
  const doc = readJson(file, null);
  return isObj(doc) && !doc.__invalid ? doc : null;
}

function hit(source, name, enabled, text, extra = {}) {
  return { source, name, enabled, codegen: name === MCP_SERVER_NAME || text.includes(CODEGEN_PKG), ...extra };
}

function fromServers(source, servers, keepDisabledFlag = true) {
  if (!isObj(servers)) return [];
  return Object.entries(servers).map(([name, def]) =>
    hit(source, name, !(keepDisabledFlag && isObj(def) && def.disabled === true), JSON.stringify(def ?? '')),
  );
}

function jsonSource(file, keys) {
  const doc = readDoc(file);
  if (!doc) return [];
  return keys.flatMap((k) => fromServers(file, doc[k]));
}

function isSameOrParent(dir, target) {
  const rel = path.relative(path.resolve(dir), path.resolve(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function claudeCode({ home, runDir }) {
  const file = path.join(home, '.claude.json');
  const doc = readDoc(file);
  if (!doc) return [];
  const out = fromServers(file, doc.mcpServers).map((h) => ({ ...h, scope: 'user' }));
  if (isObj(doc.projects)) {
    for (const [proj, cfg] of Object.entries(doc.projects)) {
      if (!isObj(cfg) || !runDir || !isSameOrParent(proj, runDir)) continue;
      const off = Array.isArray(cfg.disabledMcpServers) ? cfg.disabledMcpServers : [];
      for (const h of fromServers(file, cfg.mcpServers, false)) {
        out.push({ ...h, enabled: !off.includes(h.name), scope: 'local' });
      }
    }
  }
  return out;
}

function unquote(raw) {
  const t = raw.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function codex({ home, env }) {
  const file = path.join(env.CODEX_HOME || path.join(home, '.codex'), 'config.toml');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const out = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const head = line.match(/^\s*\[\s*([^\[\]]+?)\s*\]\s*(#.*)?$/);
    if (head) {
      const m = head[1].match(/^mcp_servers\.("[^"]+"|'[^']+'|[A-Za-z0-9_-]+)$/);
      cur = m ? { name: unquote(m[1]), body: [], enabled: true } : null;
      if (cur) out.push(cur);
      continue;
    }
    if (/^\s*\[/.test(line)) {
      cur = null;
      continue;
    }
    if (cur) {
      cur.body.push(line);
      if (/^\s*enabled\s*=\s*false\b/.test(line)) cur.enabled = false;
    }
  }
  return out.map((s) => hit(file, s.name, s.enabled, `${s.name}\n${s.body.join('\n')}`));
}

export function scanGlobalMcp(tool, ctx) {
  const { home, appData, runDir } = ctx;
  const env = ctx.env || {};
  switch (tool) {
    case 'Claude-Code':
      return claudeCode({ home, runDir });
    case 'Codex':
      return codex({ home, env });
    case 'Antigravity':
      return jsonSource(path.join(home, '.gemini', 'config', 'mcp_config.json'), ['mcpServers']);
    case 'Cursor':
      return jsonSource(path.join(home, '.cursor', 'mcp.json'), ['mcpServers']);
    case 'GitHub-Copilot':
      return [
        ...jsonSource(path.join(env.COPILOT_HOME || path.join(home, '.copilot'), 'mcp-config.json'), ['mcpServers', 'servers']),
        ...jsonSource(path.join(appData, 'Code', 'User', 'mcp.json'), ['mcpServers', 'servers']),
      ];
    case 'Cline':
      return jsonSource(clineSettingsPath(env), ['mcpServers']);
    default:
      return [];
  }
}

const PARENT_FILES = ['CLAUDE.md', 'CLAUDE.local.md', 'AGENTS.md', 'AGENTS.override.md', 'GEMINI.md', '.mcp.json'];
const PARENT_DIRS = ['.agents', path.join('.claude', 'rules')];

const exists = (p) => {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
};

export function findInstructionLeaks(runDir, home, env = process.env) {
  const found = new Set();
  let dir = path.dirname(path.resolve(runDir));
  for (;;) {
    for (const f of [...PARENT_FILES, ...PARENT_DIRS]) {
      const p = path.join(dir, f);
      if (exists(p)) found.add(p);
    }
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  const codexHome = env.CODEX_HOME || path.join(home, '.codex');
  const personal = [
    path.join(home, '.claude', 'CLAUDE.md'),
    path.join(codexHome, 'AGENTS.md'),
    path.join(codexHome, 'AGENTS.override.md'),
    path.join(home, '.gemini', 'GEMINI.md'),
  ];
  for (const p of personal) if (exists(p)) found.add(p);
  return [...found].sort();
}

// VS Code 의 사용자 프로필 mcp.json(<AppData>/Code/User/mcp.json). Copilot 의 파일(mcp-config.json)과 구분한다.
const isVsCodeUserMcp = (source) =>
  path.basename(source) === 'mcp.json' && path.basename(path.dirname(source)) === 'User';

// 화면에서 끈 상태는 setup 이 읽는 파일에 남지 않을 수 있어(VS Code, Cursor), 파일에서 항목을 지우게 안내한다.
const KEEP_COPY = '실습 후 되돌릴 수 있도록 지우기 전에 파일을 복사해 두세요.';

export function removalHint(tool, h) {
  const n = h.name;
  switch (tool) {
    case 'Claude-Code':
      return `터미널에서 \`claude mcp remove ${n} -s ${h.scope === 'local' ? 'local' : 'user'}\` 명령으로 제거해 주세요.`;
    case 'Codex':
      return `터미널에서 \`codex mcp remove ${n}\` 명령으로 제거해 주세요.`;
    case 'Antigravity':
      return `터미널에서 \`agy mcp remove ${n}\` 명령으로 제거하거나 ${h.source} 파일에서 "disabled": true 로 꺼 주세요.`;
    case 'Cursor':
      return `${h.source} 파일에서 ${n} 항목을 지워 주세요. Cursor 화면에서 끈 상태는 이 파일에 남지 않을 수 있습니다. ${KEEP_COPY}`;
    case 'GitHub-Copilot':
      if (isVsCodeUserMcp(h.source)) {
        return `VS Code 사용자 설정 파일(${h.source})에서 ${n} 항목을 지워 주세요. 명령 팔레트의 MCP: Open User Configuration 으로 이 파일을 열 수 있으며, VS Code 화면에서 끈 상태는 이 파일에 남지 않습니다. ${KEEP_COPY}`;
      }
      return `터미널에서 \`copilot mcp remove ${n}\` 명령으로 제거하거나 ${h.source} 파일에서 ${n} 항목을 지워 주세요. ${KEEP_COPY}`;
    case 'Cline':
      return 'Cline 의 MCP Servers 화면에서 해당 서버를 꺼 주세요.';
    default:
      return `${h.source} 파일에서 ${n} 서버를 제거해 주세요.`;
  }
}
