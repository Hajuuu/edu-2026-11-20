# Antigravity 설정

Antigravity 로 실습하는 교육생을 위한 안내입니다. `npm run setup` 명령에는 `--tool Antigravity` 를 넣습니다. 전체 절차는 [README 의 실습 절차](../README.md#3-실습-절차)를 따르고, 이 문서는 Antigravity 에서 할 일을 설명합니다.

설치는 [Antigravity 공식 다운로드 페이지](https://antigravity.google/download)를 따릅니다. Antigravity 는 앱(App), IDE, CLI 로 제공되며, 두 실행 모두 **Antigravity IDE** 로 진행하는 것을 권장합니다. setup 명령은 mcp 실행 폴더에 작업 영역(workspace)의 MCP 설정(`.agents/mcp_config.json`)을 쓰는데, [Antigravity 의 MCP 안내](https://antigravity.google/docs/mcp)는 이 파일을 IDE 와 CLI 에 대해서만 설명하고 앱에 대해서는 설명하지 않습니다. 이 문서는 실행 폴더를 작업 영역으로 여는 IDE 를 기준으로 설명하며, 화면 표기는 버전에 따라 다를 수 있습니다.

앱으로 진행하려면 앱이 작업 영역의 MCP 설정을 읽는지 공식 문서로 확인할 수 없다는 점에 주의합니다. mcp 실행을 시작하기 전에 앱의 MCP 서버 목록(6절)에 `egovframe-codegen` 서버가 보이는지 반드시 확인하고, 보이지 않으면 IDE 로 바꿔 같은 실행 폴더를 엽니다.

## 1. 모델과 노력 수준

두 실행 모두 **Claude Opus 5.5 (Thinking)** 을 씁니다. 프롬프트 입력창 아래의 모델 메뉴에서 선택합니다. Antigravity 에서는 Claude 모델의 노력 수준을 선택할 수 없으므로 노력 수준은 Thinking 으로 고정됩니다.

- 목록에 다른 Claude 모델이 보여도 Claude Opus 5.5 (Thinking) 을 선택합니다. Claude Sonnet 4.6, Claude Opus 4.6, GPT-OSS 120B 는 2026년 11월 18일에 목록에서 빠집니다.
- Claude Opus 5.5 (Thinking) 을 선택할 수 없으면 다른 모델로 바꾸지 말고 교육 전에 진행자에게 알립니다.

## 2. 요금제

Google AI Pro(유료 구독, 체험판 제외), Ultra, Enterprise 요금제 가운데 하나가 필요합니다. Free 와 Plus 요금제에서는 Claude Opus 5.5 를 선택할 수 없습니다.

## 3. 개인 설정 끄기

실습 동안 다음 개인 설정을 끄고, 실습이 끝나면 되돌립니다. setup 명령은 찾을 수 있는 개인 MCP 서버와 지침 파일을 `[주의]` 로 알려 주며, 그 내용은 참가자 기록에 남아 PR 과 함께 공개됩니다. 그러므로 setup 명령을 실행하기 전에 미리 끕니다.

- 전역 지침 파일 `~/.gemini/GEMINI.md` 는 이름을 바꿔 둡니다(예: `GEMINI.md.off`).
- 전역 MCP 설정 `~/.gemini/config/mcp_config.json` 에 등록한 개인 MCP 서버는 끕니다. 파일에서는 서버 항목에 `"disabled": true` 를 넣으면 설정을 지우지 않고 끌 수 있습니다. IDE 에서는 에이전트 패널의 `…` 메뉴 > MCP Servers > Manage MCP Servers 에서 View raw config 로 이 파일을 열 수 있습니다. 앱에서는 Customizations 의 Installed 화면에 있는 MCP Servers 에서 서버의 More actions(⋮) 메뉴를 열고 Disable 을 선택합니다. setup 명령은 이 파일만 읽으므로, 화면에서 끈 뒤에는 파일의 그 서버 항목에 `"disabled": true` 가 들어갔는지 확인합니다.
- 특히 전역 설정에 `egovframe-codegen` 서버가 켜져 있으면 setup 명령이 nomcp 실행 준비를 멈춥니다. 이 서버를 끄거나 지운 뒤 setup 명령을 다시 실행합니다.
- 개인 규칙이나 스킬을 만들어 두었다면 실습 동안 끕니다.

## 4. setup 이 실행 폴더에 쓰는 파일

| 실행 | 파일 | 역할 |
|---|---|---|
| nomcp, mcp | `TASK.md` | 과제. 맨 위에 실행 종류를 알리는 한 줄이 붙습니다 |
| nomcp, mcp | `GEMINI.md` | 작업 범위 지침. Antigravity 가 자동으로 읽습니다 |
| mcp | `.agents/mcp_config.json` | 작업 영역의 MCP 설정. `mcpServers` 에 `egovframe-codegen` 서버를 등록합니다 |

nomcp 실행 폴더에는 MCP 연결 설정을 쓰지 않습니다. `.agents/` 에는 이 PC 의 절대 경로가 들어 있어 제출에서 빠집니다. MCP 연결 설정의 명령은 setup 명령을 실행한 Node.js 의 절대 경로이고, 서버 파일은 저장소 폴더 안의 `.mcp-servers/egovframe-mcp-codegen/package/build/index.js` 입니다. 따라서 Node.js 를 다시 설치했거나 저장소 폴더를 옮겼다면 setup 명령을 다시 실행합니다.

## 5. 처음 한 번 확인할 것

- 공식 문서에는 작업 영역의 MCP 설정을 사용하기 전에 따로 허용하는 절차가 나와 있지 않습니다. IDE 에서 실행 폴더를 작업 영역으로 연 뒤 MCP 서버 목록에서 연결을 확인합니다. 작업 영역을 신뢰할지 또는 MCP 서버를 사용할지 묻는 창이 나오면 허용합니다.
- 앱을 쓰는 경우에는 프로젝트를 만들고 첫 프롬프트를 입력하면 실행 방식을 묻습니다. 이때 반드시 Local mode 를 선택합니다. New worktree mode 는 별도의 Git worktree 에서 작업하므로 결과물이 실행 폴더에 생기지 않습니다.

## 6. 연결 확인

MCP 서버 목록은 제품마다 다음 위치에서 확인합니다.

| 제품 | MCP 서버 목록의 위치 |
|---|---|
| IDE (권장) | 에이전트 패널의 `…` 메뉴 > MCP Servers > Manage MCP Servers |
| 앱 | Customizations > Installed 화면의 MCP Servers |
| CLI | `/mcp` 입력 |

mcp 실행에서는 `egovframe-codegen` 서버와 다음 도구 4개가 보여야 합니다. 서버가 보이지 않으면 목록을 새로 고칩니다. 앱에서 새로 고쳐도 보이지 않으면 IDE 로 바꿔 진행합니다.

- `egov_scaffold_project`
- `egov_add_entity`
- `egov_add_query_view`
- `egov_add_attach_file_infrastructure`

nomcp 실행에서는 켜진 `egovframe-codegen` 서버가 없어야 합니다. 두 실행 모두 개인 MCP 서버는 보이지 않아야 합니다.

## 7. 작업 방법

1. 실행 폴더(`submissions/P01/nomcp`)를 작업 영역으로 엽니다. 저장소 폴더 전체를 열지 않습니다.
   - IDE (권장): 편집기에서 실행 폴더를 엽니다(File 메뉴의 Open Folder, 메뉴 이름은 버전에 따라 다를 수 있습니다). 그다음 제목 표시줄의 Toggle Agent 로 에이전트 패널을 엽니다.
   - 앱: 왼쪽 사이드바의 New Project 아이콘(더하기 표시가 있는 폴더)을 누르고, Add Folder 로 실행 폴더 하나만 선택한 뒤 Create 를 누릅니다. 앱을 쓸 때의 주의는 이 문서의 첫 부분에 있습니다.
2. 모델이 Claude Opus 5.5 (Thinking) 인지 확인하고 첫 프롬프트를 입력합니다. 앱에서 실행 방식을 물으면 Local mode 를 선택합니다.

   ```text
   TASK.md 를 읽고 이 폴더에 board-app 프로젝트를 만들어 줘.
   ```

3. 파일 수정이나 명령 실행 승인을 물으면 평소처럼 판단해 응답합니다.
4. 작업을 마치면 저장소 폴더에서 연 터미널(PowerShell 또는 macOS 터미널)에서 `npm run submit` 을 실행합니다.
5. mcp 실행에서는 nomcp 작업 영역을 닫고, 1번과 같은 방법으로 `submissions/P01/mcp` 를 새 작업 영역(앱에서는 새 프로젝트)으로 연 뒤 새 대화로 시작합니다. nomcp 실행의 대화를 이어 가지 않습니다.

## 8. 문제 해결

아래 해결 방법 가운데에는 setup 명령을 다시 실행하는 방법이 있습니다. 아직 제출하지 않은 실행에서 setup 명령을 다시 실행하면 그 실행의 준비 시각이 새로 기록되어, 걸린 시간이 다시 실행한 때부터 계산됩니다. 그러므로 작업 중에 다시 실행했다면 처음 시작한 시각을 진행자에게 알립니다.

**MCP 서버 목록에 `egovframe-codegen` 서버가 없습니다.**
작업 영역으로 연 폴더가 `submissions/<ID>/mcp` 인지 확인합니다. 저장소 폴더나 `submissions` 폴더를 열면 실행 폴더의 설정을 읽지 않습니다. 그 폴더에 `.agents/mcp_config.json` 이 있는지 확인하고 MCP 서버 목록을 새로 고칩니다. 앱을 쓰고 있다면 IDE 로 바꿔 같은 폴더를 엽니다. 앱이 작업 영역의 MCP 설정을 읽는지는 공식 문서에 나와 있지 않습니다.

**`egovframe-codegen` 서버가 시작되지 않습니다.**
대개 Node.js 를 다시 설치했거나 저장소 폴더를 옮긴 경우입니다. 저장소 폴더에서 mcp setup 명령(`npm run setup --test mcp --id P01 --tool Antigravity`)을 다시 실행한 뒤 MCP 서버 목록을 새로 고칩니다.

**nomcp 실행인데 `egovframe-codegen` 서버가 보입니다.**
작업을 멈추고 진행자에게 알립니다. 전역 설정 `~/.gemini/config/mcp_config.json` 에 같은 서버가 켜져 있는 경우이므로, 그 항목에 `"disabled": true` 를 넣거나 항목을 지운 뒤 nomcp setup 명령을 다시 실행합니다.

**Claude Opus 5.5 (Thinking) 이 모델 목록에 없습니다.**
요금제가 Google AI Pro(유료 구독) 이상인지 확인합니다. 그래도 선택할 수 없으면 다른 모델로 바꾸지 말고 진행자에게 알립니다.

공통 문제는 [README 의 문제 해결](../README.md#5-문제-해결)에 있습니다.
