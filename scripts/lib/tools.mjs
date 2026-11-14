// 도구 메타데이터. instruction 은 실행 폴더 기준 작업 범위 지침 파일 경로(/ 구분)다.

export const TOOLS = {
  'Claude-Code': { aliases: ['claude', 'claudecode'], doc: 'docs/setup-claude-code.md', model: 'Claude Opus 5.5 · medium', instruction: 'CLAUDE.md' },
  Codex: { aliases: ['codex'], doc: 'docs/setup-codex.md', model: 'GPT-6.1 Sol (gpt-6.1-sol) · medium', instruction: 'AGENTS.md' },
  Antigravity: { aliases: ['antigravity', 'agy'], doc: 'docs/setup-antigravity.md', model: 'Claude Opus 5.5 (Thinking)', instruction: 'GEMINI.md' },
  Cursor: { aliases: ['cursor'], doc: 'docs/setup-cursor.md', model: 'Claude Opus 5.5 · medium', instruction: '.cursor/rules/workspace-boundary.mdc' },
  'GitHub-Copilot': { aliases: ['githubcopilot', 'copilot', 'ghcopilot'], doc: 'docs/setup-github-copilot.md', model: 'Claude Opus 5.5 · medium', instruction: '.github/copilot-instructions.md' },
  Cline: { aliases: ['cline'], doc: 'docs/setup-cline.md', model: 'openai/gpt-oss-120b (OpenRouter) · Reasoning Effort medium', instruction: '.clinerules/workspace-boundary.md' },
};

export const TOOL_NAMES = Object.keys(TOOLS);

const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

export function normalizeTool(input) {
  const key = squash(input ?? '');
  if (!key) return null;
  for (const name of TOOL_NAMES) {
    if (squash(name) === key || TOOLS[name].aliases.includes(key)) return name;
  }
  return null;
}
