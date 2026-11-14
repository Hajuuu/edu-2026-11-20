// 인자 해석: npm 이 플래그를 가져가도 같은 결과를 내도록 값의 모양으로 분류한다.
import { normalizeTool } from './tools.mjs';

export const TESTS = ['nomcp', 'mcp'];
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;

const VALUE_FLAGS = ['test', 'id', 'tool'];
const ID_HELP = 'ID 는 영문자나 숫자로 시작하고 영문자, 숫자, _, - 만 써서 32자 이하여야 합니다.';

export function parseArgs(argv, env = {}, opts = {}) {
  const required = opts.require ?? VALUE_FLAGS;
  const raw = {};
  const flags = new Set();
  const positional = [];
  const errors = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--') || a === '--') {
      positional.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    const name = (eq === -1 ? a.slice(2) : a.slice(2, eq));
    if (!VALUE_FLAGS.includes(name)) {
      flags.add(name);
      continue;
    }
    if (eq !== -1) {
      raw[name] = a.slice(eq + 1);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      raw[name] = argv[++i];
    } else {
      errors.push(`--${name} 뒤에 값이 필요합니다.`);
      raw[name] = undefined;
      raw[`${name}:bad`] = true;
    }
  }

  // npm 이 환경 변수로 넘긴 값. 'true' 나 빈 값은 값 없이 가로챈 플래그다.
  for (const name of VALUE_FLAGS) {
    if (raw[name] !== undefined || raw[`${name}:bad`]) continue;
    const v = env[`npm_config_${name}`];
    if (v !== undefined && v !== '' && v !== 'true') raw[name] = v;
  }

  // 남은 위치 인자를 값의 모양으로 분류한다.
  const idCandidates = [];
  for (const p of positional) {
    if (raw.test === undefined && !raw['test:bad'] && TESTS.includes(p.toLowerCase())) raw.test = p;
    else if (raw.tool === undefined && !raw['tool:bad'] && normalizeTool(p)) raw.tool = p;
    else idCandidates.push(p);
  }
  if (idCandidates.length > 1) {
    errors.push(`어느 값이 --id 인지 알 수 없습니다: ${idCandidates.join(', ')}. --id 를 명시해 주세요.`);
  } else if (idCandidates.length === 1) {
    if (raw.id === undefined && !raw['id:bad']) raw.id = idCandidates[0];
    else errors.push(`알 수 없는 값입니다: ${idCandidates[0]}`);
  }

  const result = { flags, errors };

  if (raw.test !== undefined) {
    const t = raw.test.toLowerCase();
    if (TESTS.includes(t)) result.test = t;
    else errors.push(`--test 값은 ${TESTS.join(' 또는 ')} 중 하나여야 합니다. (입력: ${raw.test})`);
  } else if (required.includes('test') && !raw['test:bad']) {
    errors.push(`--test 가 필요합니다. ${TESTS.join(' 또는 ')} 중 하나를 지정해 주세요.`);
  }

  if (raw.id !== undefined) {
    if (ID_PATTERN.test(raw.id)) result.id = raw.id;
    else errors.push(`--id 형식이 올바르지 않습니다. ${ID_HELP} (입력: ${raw.id})`);
  } else if (required.includes('id') && !raw['id:bad']) {
    errors.push('--id 가 필요합니다. 배정받은 참가자 ID 를 지정해 주세요.');
  }

  if (raw.tool !== undefined) {
    const tool = normalizeTool(raw.tool);
    if (tool) result.tool = tool;
    else errors.push(`--tool 값을 알 수 없습니다. (입력: ${raw.tool})`);
  } else if (required.includes('tool') && !raw['tool:bad']) {
    errors.push('--tool 이 필요합니다. 사용할 도구 이름을 지정해 주세요.');
  }

  return result;
}
