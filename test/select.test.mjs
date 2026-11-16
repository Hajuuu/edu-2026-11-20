// 화살표 키 목록(selectOne) 시험: 터미널 대신 키 입력을 흘려 넣는 가짜 입력 스트림과 출력을 모으는 가짜 출력 스트림을 쓴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { selectOne, displayWidth } from '../scripts/lib/select.mjs';

const KEY = { up: '\u001b[A', down: '\u001b[B', enter: '\r', esc: '\u001b', ctrlC: '\u0003' };

function fakeTerminal() {
  const input = new PassThrough();
  input.isTTY = true;
  input.isRaw = false;
  input.rawCalls = [];
  input.setRawMode = (on) => {
    input.isRaw = on;
    input.rawCalls.push(on);
    return input;
  };
  const output = new PassThrough();
  output.columns = 80;
  let text = '';
  output.on('data', (d) => {
    text += d;
  });
  return { input, output, text: () => text };
}

// 키를 하나씩 보낸다. readline 이 키마다 keypress 를 내도록 다음 틱에 보낸다.
async function press(input, ...keys) {
  for (const k of keys) {
    await new Promise((r) => setImmediate(r));
    input.write(k);
  }
}

const ITEMS = [{ label: 'kim' }, { label: 'lee', disabled: true }, { label: 'park' }];

test('arrow keys skip disabled items and Enter returns the index', async () => {
  const t = fakeTerminal();
  const p = selectOne(ITEMS, { initial: 0, input: t.input, output: t.output });
  await press(t.input, KEY.down, KEY.enter);
  assert.equal(await p, 2);
  // 입력 모드를 되돌리고, 목록을 고른 항목 한 줄로 접으며, 숨긴 커서를 다시 보인다.
  assert.deepEqual(t.input.rawCalls, [true, false]);
  assert.ok(t.text().endsWith('\u001b[3A\r\u001b[0J  ✔ park\n\u001b[?25h'), JSON.stringify(t.text()));
  assert.equal(t.input.listenerCount('keypress'), 0);
});

test('doneLabel replaces the label of the chosen item', async () => {
  const t = fakeTerminal();
  const p = selectOne([{ label: 'kim  Active account: true', doneLabel: 'kim 을 골랐습니다.' }], { input: t.input, output: t.output });
  await press(t.input, KEY.enter);
  assert.equal(await p, 0);
  assert.match(t.text(), /✔ kim 을 골랐습니다\.\n/);
});

test('the cursor starts on the initial item and wraps around', async () => {
  const t = fakeTerminal();
  const p = selectOne(ITEMS, { initial: 2, input: t.input, output: t.output });
  await press(t.input, KEY.down, KEY.down, KEY.up, KEY.enter);
  // park → kim(넘어감) → park → kim
  assert.equal(await p, 0);
});

test('a disabled initial item moves the cursor to the first selectable item', async () => {
  const t = fakeTerminal();
  const p = selectOne(ITEMS, { initial: 1, input: t.input, output: t.output });
  await press(t.input, KEY.enter);
  assert.equal(await p, 0);
});

test('Esc and Ctrl+C cancel', async () => {
  for (const key of [KEY.esc, KEY.ctrlC]) {
    const t = fakeTerminal();
    const p = selectOne(ITEMS, { input: t.input, output: t.output });
    await press(t.input, key);
    assert.equal(await p, null);
    assert.deepEqual(t.input.rawCalls, [true, false]);
    assert.doesNotMatch(t.text(), /✔/);
  }
});

test('nothing to choose returns null without reading keys', async () => {
  const t = fakeTerminal();
  assert.equal(await selectOne([{ label: 'x', disabled: true }], { input: t.input, output: t.output }), null);
  assert.deepEqual(t.input.rawCalls, []);
  assert.equal(t.text(), '');
});

test('redraw moves up by the rows the list took, counting wrapped lines', async () => {
  const t = fakeTerminal();
  t.output.columns = 20;
  // 한글 10자(20칸)와 표시 앞머리(4칸)를 더하면 24칸이라 두 줄을 차지한다.
  const p = selectOne([{ label: '가나다라마바사아자차' }, { label: 'b' }], { input: t.input, output: t.output });
  await press(t.input, KEY.down, KEY.enter);
  assert.equal(await p, 1);
  assert.ok(t.text().includes('\u001b[3A'), JSON.stringify(t.text()));
});

test('display width counts wide characters as two columns', () => {
  assert.equal(displayWidth('kim'), 3);
  assert.equal(displayWidth('한글 a'), 6);
  assert.equal(displayWidth('\u001b[1mbold\u001b[0m'), 4);
});
