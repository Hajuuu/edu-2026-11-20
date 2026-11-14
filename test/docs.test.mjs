// 공개 문서 시험: README.md 와 도구별 설정 문서(docs/*.md)의 링크, 도구 표, 스크립트와 맞는 안내,
// 공개 파일의 평가 내용 유출, 쓰지 않기로 한 문장 부호를 확인한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TOOLS, TOOL_NAMES } from '../scripts/lib/tools.mjs';

const SELF = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SELF), '..');
const abs = (rel) => path.join(ROOT, ...rel.split('/'));
const read = (rel) => fs.readFileSync(abs(rel), 'utf8');

// README 의 AI 도구 표 (진행자가 정한 순서와 표기)
const TOOL_ROWS = [
  { tool: 'Claude-Code', label: 'Claude Code (권장)', model: '**Opus 5.5 · medium**', doc: 'docs/setup-claude-code.md' },
  { tool: 'Codex', label: 'Codex (권장)', model: '**GPT-6.1 Sol · medium**', doc: 'docs/setup-codex.md' },
  { tool: 'Antigravity', label: 'Antigravity', model: '**Claude Opus 5.5 (Thinking)**', doc: 'docs/setup-antigravity.md' },
  { tool: 'Cursor', label: 'Cursor', model: '**Claude Opus 5.5 · medium**', doc: 'docs/setup-cursor.md' },
  { tool: 'GitHub-Copilot', label: 'GitHub Copilot', model: '**Claude Opus 5.5 · medium**', doc: 'docs/setup-github-copilot.md' },
  {
    tool: 'Cline',
    label: '상용 AI 를 쓸 수 없는 경우',
    model: 'VS Code **Cline** + OpenRouter(API Key 는 실습 중 센터 제공) · **GPT-OSS-120B**',
    doc: 'docs/setup-cline.md',
  },
];

// README 의 사전 준비 표: [도구 이름에 들어갈 말, 버전, 확인 명령]
const PREREQ_ROWS = [
  ['JDK', '17', '`java -version`'],
  ['Maven', '3.9 (3.9.9 권장)', '`mvn -version`'],
  ['Node.js', '22', '`node --version`'],
  ['Git', '최신', '`git --version`'],
  ['gh', '최신', '`gh --version`'],
];

const MCP_TOOLS = ['egov_scaffold_project', 'egov_add_entity', 'egov_add_query_view', 'egov_add_attach_file_infrastructure'];

// 도구 문서마다 있어야 하는 절 (제목에 들어갈 말)
const DOC_SECTIONS = ['모델', '요금제', '개인 설정', '실행 폴더에 쓰는 파일', '처음 한 번', '연결 확인', '작업 방법', '문제 해결'];

// README 와 도구 문서에 쓰지 않는 말: 진행자 전용 자료와 평가 방법
const PRIVATE_WORDS = ['채점', 'grading', 'rubric', 'README-local', 'superpowers'];

// <forbidden-tokens>
const FORBIDDEN = [/가중치/, /\bB1\b/, /\bF5\b/, /\bR1\b/, /\bC3\b/, /\begov_check_compliance\b/, /채점\s*기준/];
// </forbidden-tokens>
// 이 파일을 검사할 때는 위 목록만 빼고 본다. 아래 정규식의 원문은 표시 줄과 같지 않으므로 자기 자신과 맞지 않는다.
const TOKEN_BLOCK = /\/\/ <forbidden-tokens>[\s\S]*?\/\/ <\/forbidden-tokens>/;

const FIRST_PROMPT = read('scripts/setup.mjs').match(/const FIRST_PROMPT = '([^']+)'/)?.[1];
const UPSTREAM = JSON.parse(read('package.json')).edu.upstream;

function docFiles() {
  const docs = fs
    .readdirSync(abs('docs'), { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => `docs/${e.name}`)
    .sort();
  return ['README.md', ...docs];
}

function walk(rel) {
  const out = [];
  for (const e of fs.readdirSync(abs(rel), { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const child = `${rel}/${e.name}`;
    if (e.isDirectory()) out.push(...walk(child));
    else if (e.isFile()) out.push(child);
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

// 코드 블록과 인라인 코드 안의 글자는 링크나 제목이 아니다.
const withoutFences = (md) => md.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, '');
const withoutCode = (md) => withoutFences(md).replace(/`[^`\n]*`/g, '');

// GitHub 이 제목에서 만드는 앵커: 소문자로 바꾸고 글자, 숫자, 공백, -, _ 만 남긴 뒤 공백을 - 로 바꾼다.
function headingAnchors(md) {
  const seen = new Map();
  const out = new Set();
  for (const line of withoutFences(md).split(/\r?\n/)) {
    const m = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = m[1].replace(/`/g, '').replace(/\*\*/g, '');
    const slug = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');
    const n = seen.get(slug) || 0;
    seen.set(slug, n + 1);
    out.add(n ? `${slug}-${n}` : slug);
  }
  return out;
}

function isIgnored(rel) {
  const r = spawnSync('git', ['check-ignore', '-q', '--no-index', rel], { cwd: ROOT });
  return r.status === 0;
}

// | a | b | c | 형식의 표 줄을 칸으로 나눈다. 표 줄이 아니면 null.
function cells(line) {
  const t = line.trim();
  if (!t.startsWith('|') || !t.endsWith('|')) return null;
  return t.slice(1, -1).split('|').map((c) => c.trim());
}

function headings(md) {
  return withoutFences(md)
    .split(/\r?\n/)
    .filter((l) => /^#{2,6}\s/.test(l));
}

test('links exist', () => {
  const linkRe = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const file of docFiles()) {
    const md = read(file);
    const dir = path.posix.dirname(file);
    for (const m of withoutCode(md).matchAll(linkRe)) {
      const target = m[1];
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
      const hash = target.indexOf('#');
      const rawPath = hash === -1 ? target : target.slice(0, hash);
      const anchor = hash === -1 ? null : decodeURIComponent(target.slice(hash + 1));
      const rel = rawPath ? path.posix.normalize(path.posix.join(dir, decodeURIComponent(rawPath))) : file;
      assert.ok(rel !== '..' && !rel.startsWith('../'), `${file}: 저장소 밖을 가리키는 링크입니다 (${target})`);
      assert.ok(fs.existsSync(abs(rel.replace(/\/$/, ''))), `${file}: 링크 대상이 없습니다 (${target})`);
      assert.ok(!isIgnored(rel), `${file}: 공개되지 않는 경로를 가리키는 링크입니다 (${target})`);
      if (anchor !== null) {
        assert.ok(rel.endsWith('.md'), `${file}: 앵커는 문서에만 걸 수 있습니다 (${target})`);
        assert.ok(headingAnchors(read(rel)).has(anchor), `${file}: ${rel} 에 #${anchor} 제목이 없습니다`);
      }
    }
  }
});

test('tools table', () => {
  const readme = read('README.md');
  const lines = readme.split(/\r?\n/);
  const head = lines.findIndex((l) => l.trim() === '| 사용 도구 | 모델 · 노력 수준 | 문서 |');
  assert.notEqual(head, -1, 'README 에 AI 도구 표 머리가 없습니다');
  assert.match(lines[head + 1], /^\|\s*-{3,}/, 'AI 도구 표의 구분 줄이 없습니다');
  TOOL_ROWS.forEach((row, i) => {
    const c = cells(lines[head + 2 + i] ?? '');
    assert.ok(c && c.length === 3, `AI 도구 표 ${i + 1}번째 행이 없습니다`);
    assert.equal(c[0], row.label);
    assert.equal(c[1], row.model);
    assert.ok(c[2].includes(`](${row.doc})`), `${row.label} 행에 ${row.doc} 링크가 없습니다`);
  });
  assert.equal(cells(lines[head + 2 + TOOL_ROWS.length] ?? '') ?? null, null, 'AI 도구 표는 여섯 행이어야 합니다');
  assert.ok(readme.includes('AI 코딩 도구는 다음 중 하나를 준비하고, 모델과 노력 수준을 맞춥니다.'));

  // setup 이 안내하는 문서 경로와 도구 이름이 README 와 맞아야 한다.
  assert.deepEqual([...TOOL_NAMES].sort(), TOOL_ROWS.map((r) => r.tool).sort());
  for (const row of TOOL_ROWS) {
    assert.equal(TOOLS[row.tool].doc, row.doc, `${row.tool} 의 문서 경로가 setup 과 다릅니다`);
    assert.ok(fs.existsSync(abs(row.doc)), `${row.doc} 가 없습니다`);
    assert.ok(readme.includes(`\`${row.tool}\``), `README 에 --tool 값 ${row.tool} 이 없습니다`);
  }
});

test('readme prerequisites and commands', () => {
  const readme = read('README.md');
  const rows = readme.split(/\r?\n/).map(cells).filter(Boolean);
  assert.ok(readme.includes('## 1. 사전 준비 (교육 전날까지)'));
  for (const [name, version, command] of PREREQ_ROWS) {
    assert.ok(
      rows.some((c) => c.length === 3 && c[0].includes(name) && c[1] === version && c[2] === command),
      `사전 준비 표에 ${name} ${version} ${command} 행이 없습니다`,
    );
  }
  for (const s of [
    `gh repo fork ${UPSTREAM} --clone`,
    'gh auth login',
    'npm run check',
    'npm run setup --test nomcp --id P01 --tool Claude-Code',
    'npm run setup -- --test nomcp --id P01 --tool Claude-Code',
    'npm run setup --test mcp --id P01 --tool Claude-Code',
    'npm run submit',
    'npm run cleanup',
    '30분',
    '20분',
  ]) {
    assert.ok(readme.includes(s), `README 에 ${s} 가 없습니다`);
  }
  assert.ok(FIRST_PROMPT, 'scripts/setup.mjs 에서 첫 프롬프트를 찾지 못했습니다');
  assert.ok(readme.includes(FIRST_PROMPT), 'README 의 첫 프롬프트가 setup 안내와 다릅니다');
});

test('task section matches TASK.md', () => {
  const lf = (s) => s.replace(/\r\n/g, '\n');
  const readme = lf(read('README.md'));
  const ddl = lf(read('task/TASK.md')).match(/```sql\n[\s\S]*?```/)?.[0];
  assert.ok(ddl, 'task/TASK.md 에서 DDL 을 찾지 못했습니다');
  assert.ok(readme.includes(ddl), 'README 의 DDL 이 task/TASK.md 와 다릅니다');
  assert.ok(readme.includes('](task/TASK.md)'), 'README 에 task/TASK.md 링크가 없습니다');
  assert.ok(readme.includes('전자정부 표준프레임워크(eGovFrame) 5.0 Boot 기반 게시판 프로젝트'));
});

test('tool docs cover each step', () => {
  for (const row of TOOL_ROWS) {
    const md = read(row.doc);
    const hs = headings(md);
    for (const s of DOC_SECTIONS) {
      assert.ok(hs.some((h) => h.includes(s)), `${row.doc} 에 '${s}' 절이 없습니다`);
    }
    for (const s of [`--tool ${row.tool}`, TOOLS[row.tool].instruction, 'egovframe-codegen', ...MCP_TOOLS, FIRST_PROMPT, 'nomcp', '](../README.md']) {
      assert.ok(md.includes(s), `${row.doc} 에 ${s} 가 없습니다`);
    }
  }
});

test('no evaluation leak', () => {
  const files = [...docFiles(), 'task/TASK.md', ...walk('scripts'), ...walk('test')];
  for (const file of files) {
    const buf = fs.readFileSync(abs(file));
    if (buf.includes(0)) continue;
    let text = buf.toString('utf8');
    if (abs(file) === SELF) text = text.replace(TOKEN_BLOCK, '');
    for (const re of FORBIDDEN) {
      const m = re.exec(text);
      assert.equal(m, null, m ? `${file}:${lineOf(text, m.index)} 에 공개하지 않는 말(${m[0]})이 있습니다` : '');
    }
  }
  // README 는 평가를 한 문장에서만 알리고, 도구 문서와 README 는 진행자 전용 자료를 언급하지 않는다.
  const readme = read('README.md');
  assert.equal((readme.match(/평가/g) || []).length, 1, 'README 는 평가를 한 문장에서만 언급해야 합니다');
  for (const file of docFiles()) {
    const text = read(file);
    if (file !== 'README.md') assert.ok(!text.includes('평가'), `${file} 에 평가 이야기가 있습니다`);
    for (const w of PRIVATE_WORDS) assert.ok(!text.includes(w), `${file} 에 ${w} 가 있습니다`);
  }
});

test('no em dash or en dash in docs', () => {
  for (const file of docFiles()) {
    const text = read(file);
    for (const [ch, name] of [['—', 'em dash'], ['–', 'en dash']]) {
      const i = text.indexOf(ch);
      assert.equal(i, -1, `${file}:${lineOf(text, i)} 에 ${name} 가 있습니다`);
    }
  }
});
