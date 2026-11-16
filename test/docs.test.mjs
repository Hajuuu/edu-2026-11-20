// 공개 문서 시험: README.md 와 도구별 설정 문서(docs/*.md)의 링크, 도구 표, 스크립트와 맞는 안내,
// 공개 파일의 평가 내용 유출, 쓰지 않기로 한 문장 부호를 확인한다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TOOLS, TOOL_NAMES } from '../scripts/lib/tools.mjs';
import { cleanEnv, removeTemps } from './helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const abs = (rel) => path.join(ROOT, ...rel.split('/'));
const read = (rel) => fs.readFileSync(abs(rel), 'utf8');

// README 의 AI 도구 표 (진행자가 정한 순서와 표기)
const TOOL_ROWS = [
  { tool: 'Claude-Code', label: 'Claude Code (권장)', model: '**Opus 5.5 · medium**', doc: 'docs/setup-claude-code.md' },
  { tool: 'Codex', label: 'Codex (권장)', model: '**GPT-6.1 Sol · medium**', doc: 'docs/setup-codex.md' },
  // 작업 영역의 MCP 설정을 공식 문서가 설명하는 IDE 로 진행한다 (docs/setup-antigravity.md).
  { tool: 'Antigravity', label: 'Antigravity (IDE)', model: '**Claude Opus 5.5 (Thinking)**', doc: 'docs/setup-antigravity.md' },
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
const DOC_SECTIONS = ['모델', '요금제', '실습 워크스페이스에 쓰는 파일', '처음 한 번', '연결 확인', '작업 방법', '문제 해결'];

// 공개 파일에 쓰지 않는 말의 목록은 이 파일이 그 말을 드러내지 않도록 일부러 SHA-256 값으로만 둔다.
// 모든 공개 파일(README.md, docs/*.md, task/TASK.md, scripts/**, test/**)에 적용한다.
const LEAK_DIGESTS = new Set([
  '48720c8a0d8a8389665296431aa16495c2d50dfb5479537e5c57ff7048da27c3',
  '5b950e77941d01cdf246d00b1ece546bc95234b77d98b44c9187e2733afa696a',
  '6cd28ed32abf73d0d64218a8ce983fd5e460ac662b660a556b8939d9d6ae37a3',
  'a791366f6f6201254edcac9ec72017b12d8a69513b5e1e29a29a4048ffb16e27',
  '8a214cef6d474c9ad7249b3267218f8f0b7a5ad3a0f3ff09c692251fe9b827ca',
  'f8b11396955efba8f96826d575e809f6968acea1654dd72419d83f1a746c8585',
  '5a8d9d953da5c01ef1fc6caa41c67cf8eecec39632fa4e77ceb5b1a090ff1c3c',
  '68c3c99a0f433f5c25286bf20ca45115b062b165627c2c28d0fb19d4a64b4ad2',
]);
// README.md 와 docs/*.md 에만 적용한다.
const DOC_LEAK_DIGESTS = new Set([
  '6d528a3f0f840164c926b6e1ec2d7fbf35e4064a44fa96af7534da154a873280',
  '49672f0ef3b3a542b3b86b475936cc9adf1ddf60369e9b120ba33900294c99d8',
]);

// README 와 도구 문서에 쓰지 않는 진행자 전용 경로 이름. 이미 .gitignore 에 공개된 이름이라 그대로 둔다.
const PRIVATE_PATHS = ['grading', 'README-local', 'superpowers'];

// 한글은 조사가 붙어 낱말 전체로는 비교할 수 없으므로, 공백 하나로 이어진 한글 낱말들 안의 구간을 이 길이까지 본다.
const HANGUL_WINDOW = 12;

// setup 이 실습마다 안내하는 첫 프롬프트 ({ nomcp, mcp })
const FIRST_PROMPTS = Object.fromEntries(
  [...(read('scripts/setup.mjs').match(/const FIRST_PROMPTS = \{([\s\S]*?)\};/)?.[1] ?? '').matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]),
);
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

const digestCache = new Map();
function digestOf(word) {
  let d = digestCache.get(word);
  if (d === undefined) {
    d = crypto.createHash('sha256').update(word, 'utf8').digest('hex');
    digestCache.set(word, d);
  }
  return d;
}

const isHangul = (ch) => ch >= '가' && ch <= '힣';

// 글에서 비교할 낱말 후보와 그 위치를 만든다. 영문·숫자·_ 낱말은 낱말 전체만 보고(대소문자 구분),
// 한글은 공백 하나로 이어진 한글 낱말들 안에서 한글로 시작하고 끝나는 모든 구간(HANGUL_WINDOW 자까지)을 본다.
// 그래서 한글 낱말 하나, 조사가 붙은 낱말, 공백 하나로 이어진 두 낱말을 모두 비교한다.
function* wordCandidates(text) {
  for (const m of text.matchAll(/[A-Za-z0-9_]+/g)) yield { word: m[0], index: m.index };
  for (const m of text.matchAll(/[가-힣]+(?: [가-힣]+)*/g)) {
    const run = m[0];
    for (let i = 0; i < run.length; i++) {
      if (!isHangul(run[i])) continue;
      const end = Math.min(run.length, i + HANGUL_WINDOW);
      for (let j = i + 1; j <= end; j++) {
        if (isHangul(run[j - 1])) yield { word: run.slice(i, j), index: m.index + i };
      }
    }
  }
}

// 공개하지 않는 말이 있으면 첫 위치를 돌려준다.
function findLeak(text, digests) {
  for (const c of wordCandidates(text)) {
    if (digests.some((set) => set.has(digestOf(c.word)))) return c;
  }
  return null;
}

// 코드 블록과 인라인 코드 안의 글자는 링크나 제목이 아니다. 목록 안에서 들여 쓴 코드 블록도 뺀다.
const withoutFences = (md) => md.replace(/^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[^\n]*$/gm, '');
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

// 개발자 PC 의 git 전역·시스템 설정(전역 제외 파일 등)이 결과를 바꾸지 않게 한다.
after(removeTemps);
function isIgnored(rel) {
  const r = spawnSync('git', ['check-ignore', '-q', '--no-index', rel], { cwd: ROOT, env: cleanEnv() });
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
    // setup 과 submit 이 쓰는 Fork 처럼 원본 저장소의 기본 브랜치만 복사해야 한다.
    `gh repo fork ${UPSTREAM} --clone --default-branch-only`,
    'gh auth login',
    'npm run check',
    'npm run setup --test nomcp --id {id} --tool {Claude-Code|Codex|Antigravity|Cursor|GitHub-Copilot|Cline}',
    'npm run setup -- --test nomcp --id {id} --tool {Claude-Code|Codex|Antigravity|Cursor|GitHub-Copilot|Cline}',
    'npm run setup --test mcp --id {id} --tool {Claude-Code|Codex|Antigravity|Cursor|GitHub-Copilot|Cline}',
    'npm run submit',
    'npm run cleanup',
    '30분',
    '20분',
  ]) {
    assert.ok(readme.includes(s), `README 에 ${s} 가 없습니다`);
  }
  assert.deepEqual(Object.keys(FIRST_PROMPTS), ['nomcp', 'mcp'], 'scripts/setup.mjs 에서 실습별 첫 프롬프트를 찾지 못했습니다');
  for (const [t, prompt] of Object.entries(FIRST_PROMPTS)) {
    assert.ok(readme.includes(prompt), `README 의 ${t} 첫 프롬프트가 setup 안내와 다릅니다`);
  }
  // mcp 실습의 첫 프롬프트는 codegen MCP 서버를 쓰라고 하고, nomcp 의 첫 프롬프트는 MCP 를 말하지 않는다.
  assert.ok(FIRST_PROMPTS.mcp.includes('egovframe-mcp-codegen'));
  assert.ok(!FIRST_PROMPTS.nomcp.includes('MCP'));
  assert.ok(readme.includes('.mcp-servers/egovframe-mcp-codegen/package/build/index.js'), 'README 에 codegen MCP 서버의 실행 파일 경로가 없습니다');
  assert.ok(!/\bnpx\b/.test(readme), 'README 에 npx 안내가 남아 있습니다');
  // gh 로그인은 토큰(read:org, repo 권한의 classic 토큰)으로 한다.
  for (const s of ['https://github.com/settings/tokens', 'Generate new token (classic)', '`repo`', '`read:org`', 'Paste an authentication token']) {
    assert.ok(readme.includes(s), `README 의 gh 로그인 안내에 ${s} 가 없습니다`);
  }
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
    for (const s of [`--tool ${row.tool}`, TOOLS[row.tool].instruction, 'egovframe-codegen', ...MCP_TOOLS, FIRST_PROMPTS.nomcp, FIRST_PROMPTS.mcp, 'nomcp', '](../README.md']) {
      assert.ok(md.includes(s), `${row.doc} 에 ${s} 가 없습니다`);
    }
    // MCP 연결 설정은 .mcp-servers/ 에 푼 codegen 패키지를 node 로 바로 실행한다 (npx 로 tgz 를 실행하지 않는다).
    assert.ok(md.includes('`node` 명령으로 저장소 폴더 안의 `.mcp-servers/egovframe-mcp-codegen/package/build/index.js`'), `${row.doc} 에 node 실행 안내가 없습니다`);
    assert.ok(!/\bnpx\b/.test(md), `${row.doc} 에 npx 안내가 남아 있습니다`);
  }
});

test('no evaluation leak', () => {
  const docs = new Set(docFiles());
  const files = [...docs, 'task/TASK.md', ...walk('scripts'), ...walk('test')];
  for (const file of files) {
    const buf = fs.readFileSync(abs(file));
    if (buf.includes(0)) continue;
    const text = buf.toString('utf8');
    const leak = findLeak(text, docs.has(file) ? [LEAK_DIGESTS, DOC_LEAK_DIGESTS] : [LEAK_DIGESTS]);
    if (leak) assert.fail(`${file}:${lineOf(text, leak.index)} 에 공개하지 않는 말(${leak.word})이 있습니다`);
  }
  // README 는 평가를 한 문장에서만 알리고, 도구 문서와 README 는 진행자 전용 경로를 언급하지 않는다.
  const readme = read('README.md');
  assert.equal((readme.match(/평가/g) || []).length, 1, 'README 는 평가를 한 문장에서만 언급해야 합니다');
  for (const file of docs) {
    const text = read(file);
    if (file !== 'README.md') assert.ok(!text.includes('평가'), `${file} 에 평가 이야기가 있습니다`);
    for (const w of PRIVATE_PATHS) assert.ok(!text.includes(w), `${file} 에 ${w} 가 있습니다`);
  }
});

test('no em dash or en dash in docs', () => {
  for (const file of docFiles()) {
    const text = read(file);
    for (const [ch, name] of [['\u2014', 'em dash'], ['\u2013', 'en dash']]) {
      const i = text.indexOf(ch);
      assert.equal(i, -1, `${file}:${lineOf(text, i)} 에 ${name} 가 있습니다`);
    }
  }
});
