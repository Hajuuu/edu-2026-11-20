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

// 로컬 범위 서버(projects[경로].mcpServers)는 그 서버를 등록한 폴더(project)에서만 지울 수 있어 경로를 함께 남긴다.
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
        out.push({ ...h, enabled: !off.includes(h.name), scope: 'local', project: proj });
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

// TOML 의 # 주석을 지운다. 문자열("…", '…', """…""", '''…''') 안의 # 은 그대로 둔다.
function stripTomlComments(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '#') {
      while (i < text.length && text[i] !== '\n') i++;
      continue;
    }
    const triple = text.startsWith('"""', i) ? '"""' : text.startsWith("'''", i) ? "'''" : null;
    if (triple) {
      const end = text.indexOf(triple, i + 3);
      const stop = end === -1 ? text.length : end + 3;
      out += text.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== ch && text[j] !== '\n') j += ch === '"' && text[j] === '\\' ? 2 : 1;
      const stop = Math.min(j + 1, text.length);
      out += text.slice(i, stop);
      i = stop;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

// mcp_servers 키로 시작하는 표 머리나 키 (점 앞뒤의 공백과 따옴표 표기 포함)
const MCP_SERVERS_KEY = /^\s*(?:mcp_servers|"mcp_servers"|'mcp_servers')\s*(?:\.|=|$)/;

// 한 줄에서 문자열 밖의 여는 괄호 수에서 닫는 괄호 수를 뺀 값 (여러 줄에 걸친 배열이 끝났는지 볼 때 쓴다)
function bracketDelta(line) {
  let n = 0;
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (quote === '"' && ch === '\\') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '[' || ch === '{') n++;
    else if (ch === ']' || ch === '}') n--;
  }
  return n;
}

// 주석을 뺀 본문에서 mcp_servers 아래에 있는 줄만 모은다: [mcp_servers…] 표 안의 줄, 맨 위 수준에서 mcp_servers 로
// 시작하는 점 키와 인라인 표(여러 줄에 걸친 값 포함). [projects."경로"] 같은 다른 표에 든 경로는 빼서 잘못 막지 않게 한다.
function mcpServersText(body) {
  const keep = [];
  let inTable = false;
  let atTop = true;
  let depth = 0;
  for (const line of body.split(/\r?\n/)) {
    const head = depth === 0 ? line.match(/^\s*\[\[?\s*([^\[\]]+?)\s*\]\]?\s*$/) : null;
    if (head) {
      atTop = false;
      inTable = MCP_SERVERS_KEY.test(head[1]);
      continue;
    }
    if (inTable) keep.push(line);
    else if (atTop && (depth > 0 || MCP_SERVERS_KEY.test(line))) {
      keep.push(line);
      depth = Math.max(0, depth + bracketDelta(line));
    }
  }
  return keep.join('\n');
}

function codex({ home, env }) {
  const file = path.join(env.CODEX_HOME || path.join(home, '.codex'), 'config.toml');
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const body = stripTomlComments(text);
  const out = [];
  let cur = null;
  for (const line of body.split(/\r?\n/)) {
    const head = line.match(/^\s*\[\s*([^\[\]]+?)\s*\]\s*$/);
    if (head) {
      const m = head[1].match(/^mcp_servers\s*\.\s*("[^"]+"|'[^']+'|[A-Za-z0-9_-]+)$/);
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
  const hits = out.map((s) => hit(file, s.name, s.enabled, `${s.name}\n${s.body.join('\n')}`));
  // [mcp_servers.<이름>] 표 머리가 아닌 TOML 표기([mcp_servers] 아래의 점 키, 인라인 표 등)는 위에서 서버로 읽지 못한다.
  // 그런 표기에 codegen 이 보이면 켜진 codegen 서버 하나로 보고 nomcp 준비가 제거 방법을 안내하며 멈추게 한다.
  if (!hits.some((h) => h.codegen)) {
    const mcp = mcpServersText(body);
    if (mcp.includes(MCP_SERVER_NAME) || mcp.includes(CODEGEN_PKG)) hits.push(hit(file, MCP_SERVER_NAME, true, '', { fallback: true }));
  }
  return hits;
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

// Claude Code 는 상위 폴더의 CLAUDE.md 와 .claude/CLAUDE.md 를 모두 읽는다.
const PARENT_FILES = ['CLAUDE.md', 'CLAUDE.local.md', path.join('.claude', 'CLAUDE.md'), 'AGENTS.md', 'AGENTS.override.md', 'GEMINI.md', '.mcp.json'];
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
      // 로컬 범위 서버는 등록한 폴더의 것이므로 그 폴더에서 실행해야 지워진다.
      if (h.scope === 'local' && h.project) {
        return `터미널에서 이 서버를 등록한 폴더(${h.project})로 이동한 뒤 \`claude mcp remove ${n} -s local\` 명령으로 제거해 주세요.`;
      }
      return `터미널에서 \`claude mcp remove ${n} -s ${h.scope === 'local' ? 'local' : 'user'}\` 명령으로 제거해 주세요.`;
    case 'Codex':
      if (h.fallback) {
        return `${h.source} 파일에서 ${MCP_SERVER_NAME} 또는 ${CODEGEN_PKG} 이 들어간 MCP 서버 설정을 지워 주세요. 서버 이름이 ${MCP_SERVER_NAME} 이면 터미널에서 \`codex mcp remove ${MCP_SERVER_NAME}\` 명령으로도 지울 수 있습니다. ${KEEP_COPY}`;
      }
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
