// 터미널에서 화살표 키로 항목 하나를 고르는 목록. Node 내장 모듈만 사용한다.
import readline from 'node:readline';

const CSI = '\u001b[';
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]/g;

// 동아시아 문자처럼 터미널에서 두 칸을 차지하는 글자
function isWide(c) {
  return (
    (c >= 0x1100 && c <= 0x115f) ||
    (c >= 0x2e80 && c <= 0xa4cf) ||
    (c >= 0xac00 && c <= 0xd7a3) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0xfe30 && c <= 0xfe4f) ||
    (c >= 0xff00 && c <= 0xff60) ||
    (c >= 0xffe0 && c <= 0xffe6) ||
    (c >= 0x1f300 && c <= 0x1faff)
  );
}

// 글이 터미널에서 차지하는 칸 수. 줄을 다시 그릴 때 접혀 넘어간 줄까지 세려고 쓴다.
export function displayWidth(text) {
  let w = 0;
  for (const ch of String(text).replace(ANSI, '')) {
    const c = ch.codePointAt(0);
    if (c < 0x20 || (c >= 0x7f && c < 0xa0)) continue;
    w += isWide(c) ? 2 : 1;
  }
  return w;
}

// items: [{ label, disabled, doneLabel }]. ↑↓(또는 k, j) 로 커서를 옮기고 Enter 로 고른다. disabled 인 항목은 커서가 건너뛴다.
// 고르면 목록을 고른 항목 한 줄(doneLabel, 없으면 label)로 접는다.
// 고른 항목의 번호를 돌려주고, Esc 나 Ctrl+C 로 그만두면 null 을 돌려준다. 고를 수 있는 항목이 없으면 바로 null 이다.
// input 은 터미널(TTY)이어야 한다. 끝나면 입력 모드를 되돌리고 입력을 멈춰 프로세스가 끝날 수 있게 한다.
export function selectOne(items, { initial = 0, input = process.stdin, output = process.stdout } = {}) {
  const choices = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0);
  if (!choices.length) return Promise.resolve(null);
  let cur = choices.includes(initial) ? initial : choices[0];
  let rows = 0;

  const draw = (done) => {
    if (rows) output.write(`${CSI}${rows}A\r${CSI}0J`);
    const lines = done
      ? [`  ✔ ${items[cur].doneLabel ?? items[cur].label}`]
      : items.map((it, i) => `${i === cur ? '  ❯ ' : '    '}${it.label}`);
    output.write(`${lines.join('\n')}\n`);
    const cols = output.columns > 0 ? output.columns : 80;
    rows = lines.reduce((n, l) => n + Math.max(1, Math.ceil(displayWidth(l) / cols)), 0);
  };

  return new Promise((resolve) => {
    const raw = Boolean(input.isTTY && typeof input.setRawMode === 'function');
    const wasRaw = Boolean(input.isRaw);
    const move = (step) => {
      const k = choices.indexOf(cur);
      cur = choices[(k + step + choices.length) % choices.length];
      draw(false);
    };
    const finish = (value) => {
      input.removeListener('keypress', onKey);
      if (raw) input.setRawMode(wasRaw);
      input.pause();
      if (value !== null) draw(true);
      output.write(`${CSI}?25h`);
      resolve(value);
    };
    function onKey(_str, key = {}) {
      if ((key.ctrl && key.name === 'c') || key.name === 'escape') finish(null);
      else if (key.name === 'up' || key.name === 'k') move(-1);
      else if (key.name === 'down' || key.name === 'j') move(1);
      else if (key.name === 'return' || key.name === 'enter') finish(cur);
    }
    readline.emitKeypressEvents(input);
    if (raw) input.setRawMode(true);
    output.write(`${CSI}?25l`);
    draw(false);
    input.on('keypress', onKey);
    input.resume();
  });
}
