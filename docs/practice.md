# 실습 절차

이 문서는 실습 당일에 두 실습을 준비하고 제출하는 절차를 설명합니다. [README 의 1. 사전 준비](../README.md#1-사전-준비-교육-전날까지)를 마친 뒤 이 절차를 따릅니다. 과제는 [과제](task.md)에, 실습 중에 지킬 것은 [지킬 것](rules.md)에 있으며, 막히면 [문제 해결](troubleshooting.md)을 확인합니다.

명령은 모두 저장소 폴더에서 실행합니다. 아래 명령의 `{id}` 에는 진행자가 알려 준 참가자 ID(예: `P01`)를 넣고, `{Claude-Code|Codex|Antigravity|Cursor|GitHub-Copilot|Cline}` 에는 사용하는 도구의 `--tool` 값 하나(예: `Claude-Code`)를 넣습니다. 중괄호(`{}`)와 `|` 는 입력하지 않습니다. 예를 들어 참가자 ID 가 `P01` 이고 Claude Code 를 쓰면 `npm run setup --test nomcp --id P01 --tool Claude-Code` 를 실행합니다.

## 1. 첫 번째 실습: nomcp (30분)

1. 진행자의 안내에 따라 실습을 준비합니다.
   ```bash
    npm run setup --test nomcp --id {id} --tool {Claude-Code|Codex|Antigravity|Cursor|GitHub-Copilot|Cline}
   ```

    다음과 같이 `--` 를 넣은 형태도 같은 뜻입니다. 앞의 형태에서 인자 오류가 나면 이 형태로 실행합니다.
   ```bash
    npm run setup -- --test nomcp --id {id} --tool {Claude-Code|Codex|Antigravity|Cursor|GitHub-Copilot|Cline}
   ```

    npm 11 이상에서는 `--` 가 없는 형태를 실행할 때 `Unknown cli config` 같은 경고가 나올 수 있습니다. 이 경고는 결과에 영향을 주지 않으며, `--` 를 넣은 형태로 실행하면 나오지 않습니다.

    setup 명령은 다음 일을 합니다.
   - 제출용 로컬 브랜치 `submit/{id}` 을 만들고 그 브랜치로 전환합니다.
   - 실습 워크스페이스 `submissions/{id}/nomcp` 를 만들고 `TASK.md` 와 작업 범위 지침 파일을 씁니다. 지침 파일은 AI 도구에게 이 폴더 밖을 참고하지 말라고 알리는 파일이며, 파일 이름은 도구마다 다릅니다.
   - 참가자 기록 `submissions/{id}/participant.json` 에 도구, 모델, 운영체제, 도구 버전, 준비 시각을 남깁니다. 켜져 있는 개인 MCP 서버의 이름과 AI 도구가 자동으로 읽는 지침 파일의 위치도 함께 남깁니다. 이 기록은 PR 과 함께 공개되며, PC 의 절대 경로와 사용자 이름은 넣지 않습니다.
   - 마지막에 열 폴더의 경로, 도구 문서, 첫 프롬프트, 제한 시간과 예상 종료 시각을 보여 줍니다.
2. AI 도구로 실습 워크스페이스 `submissions/{id}/nomcp` 를 엽니다. 저장소 폴더 전체를 열지 않습니다. 여는 방법은 도구 문서의 '작업 방법' 절에 있습니다.
3. 도구 문서의 '연결 확인' 절에 따라 `egovframe-codegen` 서버가 연결되어 있지 않은지 확인합니다.
4. 첫 프롬프트로 다음 문장을 입력합니다. 그다음에는 평소처럼 AI 와 대화하며 작업합니다.
   ```text
    TASK.md 를 읽고 이 폴더에 board-app 프로젝트를 만들어 줘.
   ```
5. 작업을 마치거나 제한 시간이 되면 AI 도구의 작업을 멈춥니다. 그리고 저장소 폴더에서 다음 명령으로 제출합니다.
   ```bash
    npm run submit
   ```

    submit 명령은 먼저 gh 에 로그인된 GitHub 계정과 계정마다의 `Active account` 값을 보여 줍니다. 계정이 둘 이상이면 화살표 키로 제출에 쓸 계정에 커서를 두고 Enter 를 누릅니다. 고른 계정이 활성 계정이 아니면 submit 명령이 그 계정의 `Active account` 를 `true` 로 바꾼 뒤(`gh auth switch`) 제출을 이어 갑니다. 처음에는 커서가 지금의 활성 계정에 있으므로 그 계정으로 제출하려면 Enter 만 누르면 됩니다. 로그인에 실패한 계정은 고를 수 없고, Esc 를 누르면 아무것도 바꾸지 않고 제출을 그만둡니다. 계정이 하나뿐이면 묻지 않고 그 계정으로 제출합니다.

    그다음 submit 명령은 실습 워크스페이스와 참가자 기록을 커밋하고, 본인의 Fork 에 push 한 뒤, 원본 저장소에 PR 을 만듭니다. 출력의 마지막 부분에 PR 주소가 나옵니다. 제출에는 실습 워크스페이스의 파일과 `participant.json` 만 들어갑니다. 다만 빌드 결과(`target/`)는 빌드하면 다시 생기므로 제출하지 않습니다. 실습 워크스페이스 바로 아래의 도구 설정(`.mcp.json`, `.claude/`, `.codex/`, `.agents/`, `.cursor/`)도 이 PC 에서만 쓰는 설정이고 절대 경로가 들어 있을 수 있어 제출하지 않습니다. 20MB 를 넘는 파일은 자동으로 제출에서 빠집니다.

## 2. 두 번째 실습: mcp (20분)

1. nomcp 실습을 제출한 뒤 진행자의 안내에 따라 mcp 실습을 준비합니다. `--tool` 값은 첫 번째 실습과 같아야 합니다.
   ```bash
    npm run setup --test mcp --id {id} --tool {Claude-Code|Codex|Antigravity|Cursor|GitHub-Copilot|Cline}
   ```

    이번에는 setup 명령이 실습 워크스페이스 `submissions/{id}/mcp` 에 MCP 연결 설정도 씁니다. 이 설정은 이 폴더를 연 AI 도구에만 `egovframe-codegen` 서버를 연결하며, 명령 `node` 와 인자 `"<저장소 폴더>/.mcp-servers/egovframe-mcp-codegen/package/build/index.js"`(절대 경로)로 서버를 실행합니다. 서버 패키지는 저장소에 풀린 채로 들어 있어 실행할 때 압축을 풀지 않으므로, AI 도구가 서버를 띄우자마자 연결됩니다. setup 명령은 설정을 쓰기 전에 같은 명령으로 서버를 한 번 띄워 확인합니다. Cline 은 폴더 단위 설정이 없으므로, setup 명령이 Cline 전역 설정에 `egovframe-codegen` 항목을 넣고 켭니다(nomcp 실습에서는 꺼 둡니다). 실습 워크스페이스의 `TASK.md` 맨 위에는 egovframe-mcp-codegen MCP 서버의 도구를 사용해 프로젝트를 만들라는 안내가 붙습니다.
2. nomcp 작업에 쓰던 창이나 세션을 닫고, 새 창이나 새 세션에서 `submissions/{id}/mcp` 를 엽니다. 앞 실습의 대화를 이어서 쓰지 않습니다.
3. 처음 열 때 폴더 신뢰나 MCP 서버 사용을 묻는 창이 나오면 허용합니다. 그리고 도구 문서의 '연결 확인' 절에 따라 `egovframe-codegen` 서버와 도구 4개가 보이는지 확인합니다.
4. 첫 프롬프트로 다음 문장을 입력합니다. nomcp 실습의 첫 프롬프트에 egovframe-mcp-codegen MCP 를 사용하라는 말이 더해진 문장입니다. 그다음에는 평소처럼 AI 와 대화하며 작업합니다.
   ```text
    TASK.md 를 읽고 egovframe-mcp-codegen MCP 를 사용해서 이 폴더에 board-app 프로젝트를 만들어 줘.
   ```
5. 작업을 마치거나 제한 시간이 되면 저장소 폴더에서 `npm run submit` 을 실행합니다. 이번 제출은 첫 번째 제출에서 만든 PR 에 더해지고, PR 본문의 실습 기록 표에도 mcp 실습의 준비 시각, 제출 시각, 소요 시간이 채워집니다.

두 실습을 모두 제출한 뒤에 할 일은 [실습 후](after-practice.md)에 있습니다.
