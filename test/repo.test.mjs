import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function isIgnored(path) {
  const r = spawnSync('git', ['check-ignore', '-q', '--no-index', path], { cwd: root });
  return r.status === 0;
}

test('ignored paths', () => {
  const paths = [
    'grading/rubric.md',
    'README-local.md',
    'docs/superpowers/x.md',
    '.mcp-servers/a',
    '.edu/state.json',
    '.claude/settings.local.json',
    'submissions/P01/mcp/.mcp.json',
    'submissions/P01/mcp/.claude/settings.json',
    'submissions/P01/mcp/.codex/config.toml',
    'submissions/P01/mcp/.agents/mcp_config.json',
    'submissions/P01/mcp/.cursor/mcp.json',
    'submissions/P01/nomcp/board-app/target/a.jar',
  ];
  for (const p of paths) assert.ok(isIgnored(p), `${p} 는 무시되어야 합니다`);
});

test('kept paths', () => {
  const paths = [
    'submissions/P01/participant.json',
    'submissions/P01/nomcp/TASK.md',
    'submissions/P01/nomcp/CLAUDE.md',
    'submissions/P01/nomcp/AGENTS.md',
    'submissions/P01/nomcp/.github/copilot-instructions.md',
    'submissions/P01/nomcp/.clinerules/workspace-boundary.md',
    'submissions/P01/mcp/board-app/.claude/skills/x/SKILL.md',
    'submissions/P01/mcp/board-app/pom.xml',
  ];
  for (const p of paths) assert.ok(!isIgnored(p), `${p} 는 무시되면 안 됩니다`);
});

test('no instruction files at root', () => {
  for (const f of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md', '.mcp.json']) {
    assert.ok(!existsSync(join(root, f)), `루트에 ${f} 가 있으면 안 됩니다`);
  }
});
