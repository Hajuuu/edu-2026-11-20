// 최소 stdio MCP 클라이언트: 도구 하나를 호출하고 결과를 돌려준다. Node 내장 모듈만 사용한다.
import { spawn } from 'node:child_process';
import path from 'node:path';

export const BOARD_DDL = `CREATE TABLE BOARD (
  BOARD_ID VARCHAR(20) NOT NULL,
  TITLE    VARCHAR(200) NOT NULL,
  CONTENT  VARCHAR(4000),
  WRITER   VARCHAR(50) NOT NULL,
  PRIMARY KEY (BOARD_ID)
);`;

export function callTool(entry, name, args, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 300000;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [entry], {
      cwd: path.dirname(entry),
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let settled = false;
    let buf = '';
    let errText = '';
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.stdin.end();
      } catch {
        /* 이미 닫힘 */
      }
      child.kill();
      fn(value);
    };
    const timer = setTimeout(
      () => finish(reject, new Error(`MCP 서버 응답을 ${Math.round(timeoutMs / 1000)}초 안에 받지 못해 중단했습니다.`)),
      timeoutMs,
    );
    const send = (msg) => {
      if (settled) return;
      try {
        child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...msg })}\n`);
      } catch {
        /* 종료 처리는 close 이벤트에서 한다 */
      }
    };

    const handle = (msg) => {
      if (msg.method !== undefined && msg.id !== undefined) {
        if (msg.method === 'ping') send({ id: msg.id, result: {} });
        else send({ id: msg.id, error: { code: -32601, message: `지원하지 않는 요청입니다: ${msg.method}` } });
        return;
      }
      if (msg.method !== undefined) return; // 알림은 무시
      if (msg.id === 1) {
        if (msg.error) {
          finish(reject, new Error(`MCP 서버 초기화에 실패했습니다: ${msg.error.message}`));
          return;
        }
        send({ method: 'notifications/initialized' });
        send({ id: 2, method: 'tools/call', params: { name, arguments: args } });
      } else if (msg.id === 2) {
        if (msg.error) {
          finish(resolve, { isError: true, text: String(msg.error.message ?? '') });
          return;
        }
        const r = msg.result || {};
        const text = (Array.isArray(r.content) ? r.content : [])
          .map((c) => c?.text)
          .filter((t) => typeof t === 'string')
          .join('\n');
        finish(resolve, { isError: r.isError === true, text });
      }
    };

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let msg;
        try {
          msg = JSON.parse(line);
        } catch {
          continue; // JSON 이 아닌 줄은 무시
        }
        if (msg && typeof msg === 'object') handle(msg);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (c) => {
      errText = (errText + c).slice(-4000);
    });
    child.stdin.on('error', () => {});
    child.on('error', (e) => finish(reject, new Error(`MCP 서버를 시작하지 못했습니다: ${e.message}`)));
    child.on('close', (code) => {
      const tail = errText.trim().split(/\r?\n/).slice(-5).join('\n');
      finish(reject, new Error(`MCP 서버가 결과를 보내기 전에 종료되었습니다. (종료 코드 ${code})${tail ? `\n${tail}` : ''}`));
    });

    send({
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'edu-kit', version: '1.0.0' },
      },
    });
  });
}

export function scaffoldBoard(entry, outputPath, projectName = 'board-app') {
  return callTool(
    entry,
    'egov_scaffold_project',
    {
      projectName,
      packageName: 'egovframework.example.board',
      outputPath,
      entityName: 'Board',
      ddl: BOARD_DDL,
      withAttachment: true,
    },
    { timeoutMs: 120000 },
  );
}
