# GitHub Copilot 설정

VS Code 의 GitHub Copilot 으로 실습하는 교육생을 위한 안내입니다. `npm run setup` 명령에는 `--tool GitHub-Copilot` 을 넣습니다. 전체 절차는 [README 의 실습 절차](../README.md#3-실습-절차)를 따르고, 이 문서는 VS Code 와 Copilot 에서 할 일을 설명합니다.

VS Code 는 [공식 다운로드 페이지](https://code.visualstudio.com/download)에서 설치하고, Copilot 로그인은 [VS Code 의 Copilot 설정 안내](https://code.visualstudio.com/docs/copilot/setup)를 따릅니다. 실습 전에 VS Code 를 최신 버전으로 업데이트합니다. 화면 표기는 버전에 따라 다를 수 있습니다.

## 1. 모델과 노력 수준

두 실습 모두 **Claude Sonnet 5.5** 모델과 노력 수준 **Medium** 을 씁니다. Claude Sonnet 5.5 는 2026년 9월 28일부터 Copilot 에서 정식으로 제공됩니다.

1. 채팅(Chat) 보기를 열고 모드를 Agent 로 선택합니다.
2. 모델 선택 메뉴에서 Auto 가 아니라 Claude Sonnet 5.5 를 직접 선택합니다. Claude Opus 5.5 와 헷갈리지 않도록 주의합니다.
3. 모델 이름 옆의 `›` 를 눌러 노력 수준을 Medium 으로 선택합니다. 노력 수준의 이름과 위치는 공식 문서로 확인하지 못한 내용이라 버전에 따라 다를 수 있습니다.

## 2. 요금제

Copilot Pro, Pro+, Max, Business, Enterprise 요금제 가운데 하나가 필요합니다. Free 와 Student 요금제에서는 Claude Sonnet 5.5 를 직접 선택할 수 없습니다. Business 와 Enterprise 요금제는 조직 관리자가 이 모델을 허용해야 합니다.

## 3. setup 이 실습 워크스페이스에 쓰는 파일

| 실습 | 파일 | 역할 |
|---|---|---|
| nomcp, mcp | `TASK.md` | 과제. 맨 위에 실습 종류를 알리는 안내가 붙고, mcp 실습에서는 egovframe-mcp-codegen MCP 서버의 도구를 사용해 프로젝트를 만들라는 안내도 붙습니다 |
| nomcp, mcp | `.github/copilot-instructions.md` | 작업 범위 지침. Copilot 이 자동으로 읽습니다 |
| mcp | `.mcp.json` | `egovframe-codegen` 서버 연결 설정. 실습 워크스페이스의 루트에 둡니다 |

기본 Copilot 에이전트(하네스)는 `.vscode/mcp.json` 이 아니라 작업 영역 루트의 `.mcp.json` 을 읽습니다. nomcp 실습 워크스페이스에는 MCP 연결 설정을 쓰지 않습니다. `.mcp.json` 에는 이 PC 의 절대 경로가 들어 있어 제출에서 빠집니다. MCP 연결 설정은 `node` 명령으로 저장소 폴더 안의 `.mcp-servers/egovframe-mcp-codegen/package/build/index.js` 를 절대 경로로 실행합니다(Windows 도 같습니다). 서버 패키지는 이 폴더에 풀린 채로 들어 있어 실행할 때 압축을 풀지 않으므로 바로 연결됩니다. 저장소 폴더를 옮겼다면 setup 명령을 다시 실행합니다.

## 4. 처음 한 번 확인할 것

- File 메뉴의 Open Folder 로 실습 워크스페이스를 엽니다. 이 폴더의 작성자를 신뢰할지 물으면 신뢰를 선택합니다. 신뢰하지 않은 작업 영역에서는 MCP 서버가 시작되지 않습니다.
- 작업 중에 도구 실행 승인을 물으면 평소처럼 판단해 응답합니다. `egovframe-codegen` 도구의 사용 승인을 물으면 허용합니다.

## 5. 연결 확인

명령 팔레트(Windows 는 Ctrl+Shift+P, macOS 는 Cmd+Shift+P)에서 `MCP: List Servers` 를 실행해 서버 목록을 확인합니다. Agent 모드의 도구 선택 화면에서도 확인할 수 있습니다.

mcp 실습에서는 `egovframe-codegen` 서버와 다음 도구 4개가 보여야 합니다.

- `egov_scaffold_project`
- `egov_add_entity`
- `egov_add_query_view`
- `egov_add_attach_file_infrastructure`

nomcp 실습에서는 `egovframe-codegen` 서버가 없어야 합니다.

## 6. 작업 방법

1. VS Code 의 File 메뉴에서 New Window 로 새 창을 열고, Open Folder 로 실습 워크스페이스(`submissions/{id}/nomcp`)를 엽니다. 저장소 폴더 전체를 열지 않습니다.
2. 채팅 보기에서 Agent 모드와 Claude Sonnet 5.5 모델, Medium 노력 수준을 확인하고 첫 프롬프트를 입력합니다.

   nomcp 실습에서는 다음 문장을 입력합니다.

   ```text
   TASK.md 를 읽고 이 폴더에 board-app 프로젝트를 만들어 줘.
   ```

   mcp 실습에서는 egovframe-mcp-codegen MCP 를 사용하라는 말이 더해진 다음 문장을 입력합니다.

   ```text
   TASK.md 를 읽고 egovframe-mcp-codegen MCP 를 사용해서 이 폴더에 board-app 프로젝트를 만들어 줘.
   ```

3. 파일 수정이나 명령 실행 승인을 물으면 평소처럼 판단해 응답합니다.
4. 작업을 마치면 저장소 폴더에서 연 터미널(PowerShell 또는 macOS 터미널)에서 `npm run submit` 을 실행합니다.
5. mcp 실습에서는 nomcp 창을 닫고, 새 창에서 `submissions/{id}/mcp` 를 연 뒤 새 채팅으로 시작합니다. nomcp 실습의 채팅을 이어 가지 않습니다.

## 7. 문제 해결

아래 해결 방법 가운데에는 setup 명령을 다시 실행하는 방법이 있습니다. 아직 제출하지 않은 실습에서 setup 명령을 다시 실행하면 그 실습의 준비 시각이 새로 기록되어, 걸린 시간이 다시 실행한 때부터 계산됩니다. 그러므로 작업 중에 다시 실행했다면 처음 시작한 시각을 진행자에게 알립니다.

**`MCP: List Servers` 에 `egovframe-codegen` 서버가 없습니다.**
연 폴더가 `submissions/{id}/mcp` 인지, 그 폴더의 루트에 `.mcp.json` 이 있는지 확인합니다. 작업 영역을 신뢰했는지도 확인합니다. 그다음 명령 팔레트에서 `Developer: Reload Window` 를 실행해 창을 다시 불러옵니다.

**`egovframe-codegen` 서버가 시작되지 않습니다.**
대개 AI 도구가 `node` 를 찾지 못했거나 저장소 폴더를 옮긴 경우입니다. 새 터미널에서 `node --version` 이 실행되는지 확인합니다. 저장소 폴더를 옮겼다면 저장소 폴더에서 mcp setup 명령(`npm run setup --test mcp --id {id} --tool GitHub-Copilot`)을 다시 실행한 뒤 창을 다시 불러옵니다.

**nomcp 실습인데 `egovframe-codegen` 서버가 보입니다.**
작업을 멈추고 진행자에게 알립니다. VS Code 사용자 프로필의 `mcp.json`(macOS `~/Library/Application Support/Code/User/mcp.json`, Windows `%APPDATA%\Code\User\mcp.json`)이나 Copilot 사용자 파일 `mcp-config.json`(macOS `~/.copilot/mcp-config.json`, Windows `%USERPROFILE%\.copilot\mcp-config.json`) 에 같은 서버가 있는 경우입니다. 파일을 복사해 둔 뒤(예: `mcp.json.bak`) 그 서버 항목을 지우고 nomcp setup 명령을 다시 실행합니다. VS Code 화면에서 끄기만 하면 파일에 남아 setup 명령이 계속 멈춥니다.

**모델 목록에 Claude Sonnet 5.5 가 없습니다.**
VS Code 와 Copilot 확장이 최신 버전인지 확인합니다. 요금제가 Pro 이상인지, Business 나 Enterprise 라면 조직 관리자가 모델을 허용했는지도 확인합니다.

공통 문제는 [README 의 문제 해결](../README.md#5-문제-해결)에 있습니다.
