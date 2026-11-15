// npm run check 종단 시험: 저장소 위치 확인과 전역 설정에 남은 codegen MCP 서버 확인을 임시 폴더와 임시 홈에서 본다.
// Maven 예열은 --skip-warmup 으로 건너뛴다. gh 는 없는 명령으로 두므로 종료 코드는 그것만으로도 1 이 될 수 있어
// 종료 코드와 함께 출력의 머리표와 문구를 확인한다.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { removeTemps, tempDir, copySources, workRepo, runScript, put } from './helpers.mjs';

after(removeTemps);

const NOT_ROOT = 'git 으로 clone 한 저장소의 루트가 아닙니다';
const NO_LEFTOVER = 'AI 도구의 전역 설정에 eGovFrame 코드 생성 MCP 서버가 남아 있지 않습니다.';
const check = (ctx) => runScript(ctx, 'check.mjs', ['--skip-warmup']);
const lines = (out, head) => out.split('\n').filter((l) => l.startsWith(head));

// ZIP 으로 받은 폴더처럼 .git 이 없는 폴더에서는 setup 이 멈추므로 check 도 해결해야 할 항목으로 알린다.
test('a folder that is not a git clone fails the check', () => {
  const ctx = { repo: copySources(tempDir('edu-zip-')), home: tempDir('edu-home-') };
  const r = check(ctx);
  assert.equal(r.code, 1, r.out);
  const errors = lines(r.out, '[오류]').filter((l) => l.includes(NOT_ROOT));
  assert.equal(errors.length, 1, r.out);
  assert.match(errors[0], /README 의 1\.2 GitHub 로그인과 Fork 절/);
  assert.match(r.out, new RegExp(`해결해야 할 항목[\\s\\S]*${NOT_ROOT}`));
  assert.doesNotMatch(r.out, /필수 점검은 통과했습니다|모든 점검을 통과했습니다/);
  // 저장소가 아니므로 origin 은 확인하지 않는다.
  assert.doesNotMatch(r.out, /origin 원격/);
  assert.ok(r.out.includes(`[완료] ${NO_LEFTOVER}`), r.out);
});

// 교육생 clone 에서는 저장소 위치 오류가 없고, origin 이 없으면 완료가 아니라 주의로 알린다.
// 여섯 도구의 전역 설정에 켜진 codegen 서버는 도구를 고르기 전인 전날에 제거 방법과 함께 알린다.
test('codegen servers left in global settings are reported the day before', () => {
  const ctx = workRepo();
  put(path.join(ctx.home, '.codex', 'config.toml'), '[mcp_servers.egovframe-codegen]\ncommand = "node"\nargs = ["/old/index.js"]\n');
  put(
    path.join(ctx.home, '.claude.json'),
    JSON.stringify({
      mcpServers: { 'egovframe-codegen': { command: 'node' } },
      projects: { [ctx.repo]: { mcpServers: { cg: { command: 'node', args: ['/old/egovframe-mcp-codegen/build/index.js'] } } } },
    }),
  );
  // 꺼 둔 서버, codegen 이 아닌 서버, setup 이 직접 켜고 끄는 Cline 의 관리 항목은 알리지 않는다.
  put(path.join(ctx.home, '.gemini', 'config', 'mcp_config.json'), JSON.stringify({ mcpServers: { 'egovframe-codegen': { command: 'node', disabled: true } } }));
  put(path.join(ctx.home, '.cursor', 'mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'x' } } }));
  put(
    path.join(ctx.home, '.cline', 'data', 'settings', 'cline_mcp_settings.json'),
    JSON.stringify({ mcpServers: { 'egovframe-codegen': { command: 'node', args: ['/x/index.js'], disabled: false } } }),
  );

  const r = check(ctx);
  assert.doesNotMatch(r.out, new RegExp(NOT_ROOT));
  assert.match(r.out, /\[주의\][^\n]*origin 원격이 없거나[^\n]*1\.2/);
  const warned = lines(r.out, '[주의]').filter((l) => l.includes('코드 생성 MCP 서버'));
  assert.equal(warned.length, 3, r.out);
  assert.ok(warned.some((l) => l.startsWith('[주의] Codex ') && l.includes('codex mcp remove egovframe-codegen')), r.out);
  assert.ok(warned.some((l) => l.startsWith('[주의] Claude Code ') && l.includes('claude mcp remove egovframe-codegen -s user')), r.out);
  const local = warned.find((l) => l.includes('claude mcp remove cg -s local'));
  assert.ok(local && local.includes(ctx.repo), r.out);
  for (const word of ['Antigravity', 'Cursor', 'Cline']) assert.ok(!warned.some((l) => l.includes(word)), `${word}\n${r.out}`);
  assert.ok(!r.out.includes(NO_LEFTOVER), r.out);
  assert.match(r.out, /확인이 필요한 항목[\s\S]*codex mcp remove egovframe-codegen/);
});
