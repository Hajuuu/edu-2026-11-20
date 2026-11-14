# Cursor 설정

Cursor 로 실습하는 교육생을 위한 안내입니다. `npm run setup` 명령에는 `--tool Cursor` 를 넣습니다. 전체 절차는 [README 의 실습 절차](../README.md#3-실습-절차)를 따르고, 이 문서는 Cursor 에서 할 일을 설명합니다.

설치는 [Cursor 공식 다운로드 페이지](https://cursor.com/download)를 따릅니다. Cursor 는 화면 구성이 자주 바뀌므로 아래의 메뉴 이름과 단축키는 버전에 따라 다를 수 있습니다.

## 1. 모델과 노력 수준

두 실행 모두 **Claude Opus 5.5** 모델과 노력 수준 **Medium** 을 씁니다.

1. Cursor Settings 의 Models 에서 Claude Opus 5.5 를 켭니다.
2. Agent 채팅의 모델 선택 메뉴에서 Auto 를 쓰지 않고 Claude Opus 5.5 를 직접 선택합니다.
3. 노력 수준을 Medium 으로 맞춥니다. 모델 목록에는 `Claude Opus 5.5 Medium` 처럼 보이며, Windows 는 Ctrl+Shift+/, macOS 는 Cmd+Shift+/ 로 노력 수준을 바꿀 수 있습니다. 이 표기와 단축키는 사용자 게시판에서 확인한 내용이라 버전에 따라 다를 수 있습니다.
4. Fast 모드는 끕니다. 모델 목록에 Fast 판(예: `claude-opus-5-5-fast`)이 따로 보이면 선택하지 않습니다.

이전 요금제를 쓰고 있다면 Max Mode 를 켜야 할 수 있으므로 2절을 확인합니다.

## 2. 요금제

Premium(월 30달러) 이상의 요금제가 필요합니다. 이 문서에서 이전 요금제는 Pro, Pro+, Ultra 를 가리킵니다. 이전 요금제와 Teams, Enterprise 에서도 Claude Opus 5.5 를 쓸 수 있으며, 이전 요금제 가운데 요청 수로 과금하는 요금제에서는 Max Mode 를 켜야 합니다. Free 와 Plus 요금제에는 Claude Opus 5.5 같은 외부 모델이 들어 있지 않습니다.

## 3. 개인 설정 끄기

실습 동안 다음 개인 설정을 끄고, 실습이 끝나면 되돌립니다. setup 명령은 찾을 수 있는 개인 MCP 서버와 지침 파일을 `[주의]` 로 알려 주며, 그 내용은 참가자 기록에 남아 PR 과 함께 공개됩니다. 그러므로 setup 명령을 실행하기 전에 미리 끕니다.

- Cursor Settings 의 User Rules 는 내용을 메모 파일 같은 다른 곳에 복사해 둔 뒤 비웁니다. 실습이 끝나면 복사해 둔 내용을 다시 넣습니다. 전역 규칙 폴더 `~/.cursor/rules` 는 이름을 바꿔 둡니다(예: `rules.off`).
- 개인 MCP 서버는 전역 MCP 설정 파일에서 지웁니다. 파일 위치는 macOS 가 `~/.cursor/mcp.json`, Windows 가 `%USERPROFILE%\.cursor\mcp.json` 입니다. 먼저 이 파일을 복사해 두고(예: `mcp.json.bak`), 파일에서 개인 서버 항목을 지운 뒤, 실습이 끝나면 복사해 둔 파일로 되돌립니다. 개인 서버를 모두 빼도 된다면 파일 이름을 바꿔 두는 방법(예: `mcp.json.off`)이 가장 간단합니다.
- Cursor 화면에서 서버를 끈 상태는 이 파일에 남지 않을 수 있습니다. 이 경우 setup 명령은 여전히 켜진 서버로 보고 `[주의]` 를 내므로, 화면에서 끄는 것만으로 끝내지 않고 파일에서 지웁니다.
- 특히 전역 설정에 `egovframe-codegen` 서버가 있으면 setup 명령이 nomcp 실행 준비를 멈춥니다. 이 서버 항목을 파일에서 지운 뒤 setup 명령을 다시 실행합니다.

## 4. setup 이 실행 폴더에 쓰는 파일

| 실행 | 파일 | 역할 |
|---|---|---|
| nomcp, mcp | `TASK.md` | 과제. 맨 위에 실행 종류를 알리는 한 줄이 붙습니다 |
| nomcp, mcp | `.cursor/rules/workspace-boundary.mdc` | 작업 범위 지침. `alwaysApply: true` 라서 항상 적용됩니다 |
| mcp | `.cursor/mcp.json` | `egovframe-codegen` 서버 연결 설정 |

nomcp 실행 폴더에는 MCP 연결 설정을 쓰지 않습니다. 실행 폴더 바로 아래의 `.cursor/` 폴더는 이 PC 에서만 쓰는 도구 설정으로 보아 통째로 제출에서 빠집니다. 그래서 작업 범위 지침 파일도 제출되지 않으며, mcp 실행의 `.cursor/mcp.json` 에는 이 PC 의 절대 경로도 들어 있습니다. MCP 연결 설정의 명령은 setup 명령을 실행한 Node.js 의 절대 경로이고, 서버 파일은 저장소 폴더 안의 `.mcp-servers/egovframe-mcp-codegen/package/build/index.js` 입니다. 따라서 Node.js 를 다시 설치했거나 저장소 폴더를 옮겼다면 setup 명령을 다시 실행합니다.

## 5. 처음 한 번 확인할 것

- 실행 폴더는 새 창에서 엽니다. 이미 연 창에 폴더를 추가하지 않습니다.
- mcp 실행 폴더를 처음 열면 Cursor 가 새 MCP 서버를 켤지 물을 수 있습니다. 이때 Enable 을 선택합니다.
- Cursor 는 MCP 도구를 쓰기 전에 기본적으로 승인을 묻습니다. 작업 중에 `egovframe-codegen` 도구 사용 승인을 물으면 허용합니다.

## 6. 연결 확인

MCP 서버 목록을 엽니다. 최신 공식 문서는 사이드바의 Customize 화면에서 MCP 서버를 켜고 끈다고 안내하며, 버전에 따라 Cursor Settings 의 MCP 항목에 목록이 있을 수 있습니다.

mcp 실행에서는 `egovframe-codegen` 서버가 켜져 있고(초록색 표시) 다음 도구 4개가 보여야 합니다.

- `egov_scaffold_project`
- `egov_add_entity`
- `egov_add_query_view`
- `egov_add_attach_file_infrastructure`

nomcp 실행에서는 켜진 `egovframe-codegen` 서버가 없어야 합니다. 두 실행 모두 개인 MCP 서버는 목록에 없거나 꺼져 있어야 합니다.

## 7. 작업 방법

1. File 메뉴의 New Window 로 새 창을 열고, Open Folder 로 실행 폴더(`submissions/P01/nomcp`)를 엽니다. 저장소 폴더 전체를 열지 않습니다.
2. Agent 채팅에서 모델이 Claude Opus 5.5 이고 노력 수준이 Medium 인지 확인한 뒤 첫 프롬프트를 입력합니다.

   ```text
   TASK.md 를 읽고 이 폴더에 board-app 프로젝트를 만들어 줘.
   ```

3. 파일 수정이나 명령 실행 승인을 물으면 평소처럼 판단해 응답합니다.
4. 작업을 마치면 저장소 폴더에서 연 터미널(PowerShell 또는 macOS 터미널)에서 `npm run submit` 을 실행합니다.
5. mcp 실행에서는 nomcp 창을 닫고, 새 창에서 `submissions/P01/mcp` 를 연 뒤 새 채팅으로 시작합니다. nomcp 실행의 채팅을 이어 가지 않습니다.

## 8. 문제 해결

아래 해결 방법 가운데에는 setup 명령을 다시 실행하는 방법이 있습니다. 아직 제출하지 않은 실행에서 setup 명령을 다시 실행하면 그 실행의 준비 시각이 새로 기록되어, 걸린 시간이 다시 실행한 때부터 계산됩니다. 그러므로 작업 중에 다시 실행했다면 처음 시작한 시각을 진행자에게 알립니다.

**MCP 서버 목록에 `egovframe-codegen` 서버가 없습니다.**
연 폴더가 `submissions/<ID>/mcp` 인지 확인합니다. 저장소 폴더나 `submissions` 폴더를 열면 실행 폴더의 `.cursor/mcp.json` 을 읽지 않습니다. 그 폴더에 `.cursor/mcp.json` 이 있는지 확인한 뒤, 명령 팔레트(Windows 는 Ctrl+Shift+P, macOS 는 Cmd+Shift+P)에서 `Developer: Reload Window` 를 실행해 창을 다시 불러옵니다.

**`egovframe-codegen` 서버가 오류 상태이거나 시작되지 않습니다.**
대개 Node.js 를 다시 설치했거나 저장소 폴더를 옮긴 경우입니다. 저장소 폴더에서 mcp setup 명령(`npm run setup --test mcp --id P01 --tool Cursor`)을 다시 실행한 뒤 창을 다시 불러옵니다.

**nomcp 실행인데 `egovframe-codegen` 서버가 보입니다.**
작업을 멈추고 진행자에게 알립니다. 전역 설정 파일(`~/.cursor/mcp.json`, Windows 는 `%USERPROFILE%\.cursor\mcp.json`)에 같은 서버가 있는 경우입니다. 3절의 방법으로 파일을 복사해 둔 뒤 그 서버 항목을 지우고 nomcp setup 명령을 다시 실행합니다. 화면에서 끄기만 하면 파일에 서버가 남아 setup 명령이 계속 멈출 수 있습니다.

**모델 목록에 Claude Opus 5.5 가 없습니다.**
Cursor Settings 의 Models 에서 Claude Opus 5.5 를 켰는지 확인합니다. 요금제가 Premium 이상인지, 요청 수로 과금하는 이전 요금제라면 Max Mode 를 켰는지도 확인합니다.

공통 문제는 [README 의 문제 해결](../README.md#5-문제-해결)에 있습니다.
