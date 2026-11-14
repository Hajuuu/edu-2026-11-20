// 도구 메타데이터. 도구별 작업 범위 지침 파일 경로 등은 아래 확장 지점에 추가한다.

export const TOOLS = {
  'Claude-Code': { aliases: ['claude', 'claudecode'], doc: 'docs/setup-claude-code.md', model: 'Claude Opus 5.5 · medium' },
  Codex: { aliases: ['codex'], doc: 'docs/setup-codex.md', model: 'GPT-6.1 Sol (gpt-6.1-sol) · medium' },
  Antigravity: { aliases: ['antigravity', 'agy'], doc: 'docs/setup-antigravity.md', model: 'Claude Opus 5.5 (Thinking)' },
  Cursor: { aliases: ['cursor'], doc: 'docs/setup-cursor.md', model: 'Claude Opus 5.5 · medium' },
  'GitHub-Copilot': { aliases: ['githubcopilot', 'copilot', 'ghcopilot'], doc: 'docs/setup-github-copilot.md', model: 'Claude Opus 5.5 · medium' },
  Cline: { aliases: ['cline'], doc: 'docs/setup-cline.md', model: 'openai/gpt-oss-120b (OpenRouter) · Reasoning Effort medium' },
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

// 확장 지점: Task 3 에서 도구별 지침 파일 경로(instructionPath 등)를 여기에 추가한다.
