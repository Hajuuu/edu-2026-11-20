# Cline 설정

상용 AI 를 쓸 수 없는 교육생을 위한 안내입니다. VS Code 의 확장 Cline 과 OpenRouter 를 씁니다. `npm run setup` 명령에는 `--tool Cline` 을 넣습니다. 전체 절차는 [README 의 실습 절차](../README.md#3-실습-절차)를 따르고, 이 문서는 VS Code 와 Cline 에서 할 일을 설명합니다.

VS Code 는 [공식 다운로드 페이지](https://code.visualstudio.com/download)에서 설치합니다. 그다음 확장 Cline(`saoudrizwan.claude-dev`)을 [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev)나 VS Code 의 확장 화면에서 설치하고 최신 버전으로 업데이트합니다. 자세한 사용법은 [Cline 공식 문서](https://docs.cline.bot)에 있습니다. 화면 표기는 버전에 따라 다를 수 있습니다.

## 1. 모델과 노력 수준

두 실행 모두 OpenRouter 의 **GPT-OSS-120B**(`openai/gpt-oss-120b`) 모델과 Reasoning Effort **Medium** 을 씁니다.

1. Cline 패널에서 설정(⚙)을 엽니다.
2. API Provider 로 OpenRouter 를 선택합니다.
3. 센터가 실습 중에 나눠 주는 OpenRouter API Key 를 붙여 넣습니다. 이 키는 Cline 설정 밖의 다른 곳에 저장하지 않습니다.
4. Model 에서 `openai/gpt-oss-120b` 를 선택합니다.
5. Reasoning Effort 를 Medium 으로 선택합니다. Cline v4.1.26 은 Default, None, Low, Medium, High, Xhigh 를 보여 주며, None 과 Xhigh 는 선택하지 않습니다.
6. Plan 모드와 Act 모드에 같은 모델과 설정을 씁니다.

## 2. 요금제

구독은 필요하지 않습니다. OpenRouter API Key 는 실습 중에 센터가 제공합니다. 키를 받기 전에는 VS Code 와 Cline 설치까지만 마쳐 둡니다.

## 3. 개인 설정 끄기

실습 동안 다음 개인 설정을 끄고, 실습이 끝나면 되돌립니다. setup 명령은 찾을 수 있는 개인 MCP 서버와 지침 파일을 `[주의]` 로 알려 주며, 그 내용은 참가자 기록에 남아 PR 과 함께 공개됩니다. 그러므로 setup 명령을 실행하기 전에 미리 끕니다.

- 개인 규칙(`.clinerules`)과 Custom Instructions 는 내용을 메모 파일 같은 다른 곳에 복사해 둔 뒤 실습 동안 비워 둡니다. 실습이 끝나면 복사해 둔 내용을 다시 넣습니다.
- `egovframe-codegen` 이 아닌 다른 MCP 서버는 MCP Servers 화면에서 끕니다.

## 4. setup 이 실행 폴더에 쓰는 파일

Cline 은 폴더 단위 MCP 설정이 없습니다. 그래서 setup 명령은 실행 폴더에는 과제와 지침 파일만 쓰고, MCP 연결은 Cline 의 전역 설정 파일에서 켜고 끕니다.

| 위치 | 파일 | 역할 |
|---|---|---|
| 실행 폴더 (nomcp, mcp) | `TASK.md` | 과제. 맨 위에 실행 종류를 알리는 한 줄이 붙습니다 |
| 실행 폴더 (nomcp, mcp) | `.clinerules/workspace-boundary.md` | 작업 범위 지침. Cline 이 자동으로 읽습니다 |
| 전역 설정 | `~/.cline/data/settings/cline_mcp_settings.json` | `egovframe-codegen` 서버 항목. Windows 에서는 `%USERPROFILE%\.cline\data\settings\cline_mcp_settings.json` 입니다 |

- nomcp 실행을 준비하면 setup 명령이 전역 설정의 `egovframe-codegen` 항목을 끕니다(`"disabled": true`).
- mcp 실행을 준비하면 같은 항목을 켭니다(`"disabled": false`).
- 전역 설정 파일이 이미 있었다면 setup 명령은 처음 바꾸기 전의 원본 사본을 저장소 폴더의 `.edu/backup/` 에 남깁니다. 바꾼 내용은 `.edu/global-changes.json` 에 기록하며, 실습이 끝난 뒤 `npm run cleanup` 으로 이 항목을 setup 이전 상태로 되돌릴 수 있습니다.
- 환경 변수 `CLINE_MCP_SETTINGS_PATH`, `CLINE_DATA_DIR`, `CLINE_DIR` 가 있으면 setup 명령은 그 경로를 따릅니다. setup 명령이 바꾼 파일의 경로는 setup 출력에 나옵니다.
- 전역 설정의 항목에는 setup 명령을 실행한 Node.js 와 저장소 폴더의 절대 경로가 들어 있습니다. 서버 파일은 저장소 폴더 안의 `.mcp-servers/egovframe-mcp-codegen/package/build/index.js` 입니다. 따라서 Node.js 를 다시 설치했거나 저장소 폴더를 옮겼다면 setup 명령을 다시 실행합니다.

## 5. 처음 한 번 확인할 것

- VS Code 에서 실행 폴더 하나만 작업 영역으로 엽니다(File 메뉴의 Open Folder). 여러 폴더를 함께 연 작업 영역은 쓰지 않습니다. 이 폴더의 작성자를 신뢰할지 물으면 신뢰를 선택합니다.
- setup 명령이 전역 설정을 바꾼 뒤에는 Cline 의 MCP Servers 화면에서 바뀐 상태를 확인합니다. 화면이 바뀌지 않으면 명령 팔레트(Windows 는 Ctrl+Shift+P, macOS 는 Cmd+Shift+P)에서 `Developer: Reload Window` 를 실행해 창을 다시 불러옵니다.

## 6. 연결 확인

Cline 패널 위쪽 도구 모음의 MCP Servers 아이콘을 눌러 서버 목록을 엽니다.

mcp 실행에서는 `egovframe-codegen` 서버가 켜져 있고 다음 도구 4개가 보여야 합니다.

- `egov_scaffold_project`
- `egov_add_entity`
- `egov_add_query_view`
- `egov_add_attach_file_infrastructure`

nomcp 실행에서는 `egovframe-codegen` 서버가 목록에 있어도 꺼져 있어야 합니다. 이 서버를 직접 켜지 않습니다. 두 실행 모두 다른 개인 MCP 서버는 꺼져 있어야 합니다.

## 7. 작업 방법

1. nomcp setup 명령을 실행한 뒤, VS Code 에서 실행 폴더(`submissions/P01/nomcp`)를 엽니다. 저장소 폴더 전체를 열지 않습니다.
2. MCP Servers 화면에서 `egovframe-codegen` 서버가 꺼져 있는지 확인합니다.
3. Cline 에서 새 작업(New Task)을 시작하고 첫 프롬프트를 입력합니다.

   ```text
   TASK.md 를 읽고 이 폴더에 board-app 프로젝트를 만들어 줘.
   ```

4. 파일 수정이나 명령 실행 승인을 물으면 평소처럼 판단해 응답합니다.
5. 작업을 마치면 저장소 폴더에서 연 터미널(PowerShell 또는 macOS 터미널)에서 `npm run submit` 을 실행합니다.
6. mcp 실행에서는 mcp setup 명령을 실행한 뒤 nomcp 창을 닫고, 새 창에서 `submissions/P01/mcp` 를 엽니다. MCP Servers 화면에서 `egovframe-codegen` 서버가 켜졌는지 확인하고, 새 작업으로 시작합니다. nomcp 실행의 작업을 이어 가지 않습니다.
7. 두 실행을 모두 제출한 뒤에는 저장소 폴더에서 `npm run cleanup` 을 실행할 수 있습니다. 이 명령은 setup 명령이 Cline 전역 설정에 넣은 `egovframe-codegen` 항목을 setup 이전 상태로 되돌립니다. Cline 설정에 넣은 OpenRouter API Key 도 지웁니다.

## 8. 문제 해결

아래 해결 방법 가운데에는 setup 명령을 다시 실행하는 방법이 있습니다. 아직 제출하지 않은 실행에서 setup 명령을 다시 실행하면 그 실행의 준비 시각이 새로 기록되어, 걸린 시간이 다시 실행한 때부터 계산됩니다. 그러므로 작업 중에 다시 실행했다면 처음 시작한 시각을 진행자에게 알립니다.

**setup 명령을 실행했는데 MCP Servers 화면이 바뀌지 않습니다.**
명령 팔레트에서 `Developer: Reload Window` 를 실행합니다. 그래도 바뀌지 않으면 MCP Servers 화면의 Configure 탭에서 `Configure MCP Servers` 를 눌러 열리는 파일이 setup 출력에 나온 파일과 같은지 확인합니다. 다르면 진행자에게 알립니다.

**`Cline 설정 파일이 올바른 JSON 이 아니어서 건드리지 않았습니다` 가 나옵니다.**
setup 명령이 전역 설정 파일을 읽지 못해 멈춘 경우입니다. 출력에 나온 파일의 JSON 문법을 고치거나 파일을 다른 이름으로 옮긴 뒤 setup 명령을 다시 실행합니다.

**`egovframe-codegen` 서버가 오류 상태이거나 시작되지 않습니다.**
대개 Node.js 를 다시 설치했거나 저장소 폴더를 옮긴 경우입니다. 저장소 폴더에서 mcp setup 명령(`npm run setup --test mcp --id P01 --tool Cline`)을 다시 실행한 뒤 창을 다시 불러옵니다.

**nomcp 실행인데 `egovframe-codegen` 서버가 켜져 있습니다.**
작업을 멈추고 진행자에게 알립니다. MCP Servers 화면에서 서버를 끄거나, 저장소 폴더에서 nomcp setup 명령을 다시 실행해 서버를 끕니다.

공통 문제는 [README 의 문제 해결](../README.md#5-문제-해결)에 있습니다.
