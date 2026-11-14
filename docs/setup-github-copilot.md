# GitHub Copilot 설정

VS Code 의 GitHub Copilot 으로 실습하는 교육생을 위한 안내입니다. `npm run setup` 명령에는 `--tool GitHub-Copilot` 을 넣습니다. 전체 절차는 [README 의 실습 절차](../README.md#3-실습-절차)를 따르고, 이 문서는 VS Code 와 Copilot 에서 할 일을 설명합니다.

VS Code 는 [공식 다운로드 페이지](https://code.visualstudio.com/download)에서 설치하고, Copilot 로그인은 [VS Code 의 Copilot 설정 안내](https://code.visualstudio.com/docs/copilot/setup)를 따릅니다. 실습 전에 VS Code 를 최신 버전으로 업데이트합니다. 화면 표기는 버전에 따라 다를 수 있습니다.

## 1. 모델과 노력 수준

두 실행 모두 **Claude Opus 5.5** 모델과 노력 수준 **Medium** 을 씁니다. Claude Opus 5.5 는 2026년 9월 22일부터 Copilot 에서 정식으로 제공됩니다.

1. 채팅(Chat) 보기를 열고 모드를 Agent 로 선택합니다.
2. 모델 선택 메뉴에서 Auto 가 아니라 Claude Opus 5.5 를 직접 선택합니다.
3. 모델 이름 옆의 `›` 를 눌러 노력 수준을 Medium 으로 선택합니다. 노력 수준의 이름과 위치는 공식 문서로 확인하지 못한 내용이라 버전에 따라 다를 수 있습니다.

## 2. 요금제

Copilot Pro+, Max, Business, Enterprise 요금제 가운데 하나가 필요합니다. Free 와 Pro 요금제에서는 Claude Opus 5.5 를 쓸 수 없습니다. Business 와 Enterprise 요금제는 조직 관리자가 이 모델을 허용해야 합니다.

## 3. 개인 설정 끄기

실습 동안 다음 개인 설정을 끄고, 실습이 끝나면 되돌립니다. setup 명령은 찾을 수 있는 개인 MCP 서버와 지침 파일을 `[주의]` 로 알려 줍니다.

- 개인 MCP 서버를 끕니다. Copilot 사용자 파일 `~/.copilot/mcp-config.json` 과 VS Code 사용자 프로필의 `mcp.json` 에 서버가 등록되어 있을 수 있습니다. 사용자 프로필의 `mcp.json` 은 명령 팔레트의 `MCP: Open User Configuration` 으로 엽니다. 환경 변수 `COPILOT_HOME` 을 쓰고 있다면 `~/.copilot` 대신 그 폴더를 봅니다.
- 특히 전역 설정에 `egovframe-codegen` 서버가 켜져 있으면 setup 명령이 nomcp 실행 준비를 멈춥니다. setup 명령이 알려 주는 방법으로 이 서버를 지우거나 끈 뒤 setup 명령을 다시 실행합니다.
- 사용자 설정이나 사용자 프로필에 넣어 둔 개인 지침(instructions)을 실습 동안 끕니다.

## 4. setup 이 실행 폴더에 쓰는 파일

| 실행 | 파일 | 역할 |
|---|---|---|
| nomcp, mcp | `TASK.md` | 과제. 맨 위에 실행 종류를 알리는 한 줄이 붙습니다 |
| nomcp, mcp | `.github/copilot-instructions.md` | 작업 범위 지침. Copilot 이 자동으로 읽습니다 |
| mcp | `.mcp.json` | `egovframe-codegen` 서버 연결 설정. 실행 폴더의 루트에 둡니다 |

기본 Copilot 은 `.vscode/mcp.json` 이 아니라 작업 영역 루트의 `.mcp.json` 을 읽습니다. nomcp 실행 폴더에는 MCP 연결 설정을 쓰지 않습니다. `.mcp.json` 에는 이 PC 의 절대 경로가 들어 있어 제출에서 빠집니다. MCP 연결 설정의 명령은 setup 명령을 실행한 Node.js 의 절대 경로이고, 서버 파일은 저장소 폴더 안의 `.mcp-servers/egovframe-mcp-codegen/package/build/index.js` 입니다. 따라서 Node.js 를 다시 설치했거나 저장소 폴더를 옮겼다면 setup 명령을 다시 실행합니다.

## 5. 처음 한 번 확인할 것

- File 메뉴의 Open Folder 로 실행 폴더를 엽니다. 이 폴더의 작성자를 신뢰할지 물으면 신뢰를 선택합니다. 신뢰하지 않은 작업 영역에서는 MCP 서버가 시작되지 않습니다.
- 작업 중에 도구 실행 승인을 물으면 평소처럼 판단해 응답합니다. `egovframe-codegen` 도구의 사용 승인을 물으면 허용합니다.

## 6. 연결 확인

명령 팔레트(Windows 는 Ctrl+Shift+P, macOS 는 Cmd+Shift+P)에서 `MCP: List Servers` 를 실행해 서버 목록을 확인합니다. Agent 모드의 도구 선택 화면에서도 확인할 수 있습니다.

mcp 실행에서는 `egovframe-codegen` 서버와 다음 도구 4개가 보여야 합니다.

- `egov_scaffold_project`
- `egov_add_entity`
- `egov_add_query_view`
- `egov_add_attach_file_infrastructure`

nomcp 실행에서는 `egovframe-codegen` 서버가 없어야 합니다. 두 실행 모두 개인 MCP 서버는 보이지 않아야 합니다.

## 7. 작업 방법

1. VS Code 의 File 메뉴에서 New Window 로 새 창을 열고, Open Folder 로 실행 폴더(`submissions/P01/nomcp`)를 엽니다. 저장소 폴더 전체를 열지 않습니다.
2. 채팅 보기에서 Agent 모드와 Claude Opus 5.5 모델, Medium 노력 수준을 확인하고 첫 프롬프트를 입력합니다.

   ```text
   TASK.md 를 읽고 이 폴더에 board-app 프로젝트를 만들어 줘.
   ```

3. 파일 수정이나 명령 실행 승인을 물으면 평소처럼 판단해 응답합니다.
4. 작업을 마치면 저장소 폴더에서 연 터미널(PowerShell 또는 macOS 터미널)에서 `npm run submit` 을 실행합니다.
5. mcp 실행에서는 nomcp 창을 닫고, 새 창에서 `submissions/P01/mcp` 를 연 뒤 새 채팅으로 시작합니다. nomcp 실행의 채팅을 이어 가지 않습니다.

## 8. 문제 해결

**`MCP: List Servers` 에 `egovframe-codegen` 서버가 없습니다.**
연 폴더가 `submissions/<ID>/mcp` 인지, 그 폴더의 루트에 `.mcp.json` 이 있는지 확인합니다. 작업 영역을 신뢰했는지도 확인합니다. 그다음 명령 팔레트에서 `Developer: Reload Window` 를 실행해 창을 다시 불러옵니다.

**`egovframe-codegen` 서버가 시작되지 않습니다.**
Node.js 를 다시 설치했거나 저장소 폴더를 옮긴 경우입니다. 저장소 폴더에서 mcp setup 명령(`npm run setup --test mcp --id P01 --tool GitHub-Copilot`)을 다시 실행한 뒤 창을 다시 불러옵니다.

**nomcp 실행인데 `egovframe-codegen` 서버가 보입니다.**
작업을 멈추고 진행자에게 알립니다. `~/.copilot/mcp-config.json` 이나 VS Code 사용자 프로필의 `mcp.json` 에 같은 서버가 있는 경우이므로, 그 서버를 지우거나 끈 뒤 nomcp setup 명령을 다시 실행합니다.

**모델 목록에 Claude Opus 5.5 가 없습니다.**
VS Code 와 Copilot 확장이 최신 버전인지 확인합니다. 요금제가 Pro+ 이상인지, Business 나 Enterprise 라면 조직 관리자가 모델을 허용했는지도 확인합니다.

공통 문제는 [README 의 문제 해결](../README.md#5-문제-해결)에 있습니다.
