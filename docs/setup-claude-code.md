# Claude Code 설정

Claude Code 로 실습하는 교육생을 위한 안내입니다. `npm run setup` 명령에는 `--tool Claude-Code` 를 넣습니다. 전체 절차는 [README 의 실습 절차](../README.md#3-실습-절차)를 따르고, 이 문서는 Claude Code 에서 할 일을 설명합니다.

설치와 로그인은 [Claude Code 공식 안내](https://code.claude.com/docs/en/setup)를 따릅니다. 예를 들어 macOS 에서는 `curl -fsSL https://claude.ai/install.sh | bash` 로, Windows PowerShell 에서는 `irm https://claude.ai/install.ps1 | iex` 로 설치합니다.

## 1. 모델과 노력 수준

두 실행 모두 **Claude Opus 5.5**(`claude-opus-5-5`) 모델과 노력 수준(effort) **medium** 을 씁니다. medium 은 Opus 5.5 의 기본 노력 수준입니다. Opus 5.5 는 Claude Code v2.1.280 이상에서 쓸 수 있으므로 먼저 Claude Code 를 업데이트하고 버전을 확인합니다.

```bash
claude update
claude --version
```

다음 세 방법 가운데 하나로 모델과 노력 수준을 맞춥니다.

- 화면에서 선택하기: Claude Code 에서 `/model` 을 입력하고 Opus 를 선택합니다. 그다음 왼쪽과 오른쪽 방향키로 노력 수준을 medium 에 맞추고 Enter 를 누릅니다. 이 선택은 기본값으로 저장됩니다.
- 명령으로 정하기: `/model claude-opus-5-5` 를 입력한 뒤 `/effort medium` 을 입력합니다.
- 설정 파일로 정하기: `~/.claude/settings.json` 에 다음 두 항목을 넣습니다(v2.1.251 이상). 파일이 이미 있으면 기존 내용에 두 항목을 더합니다.

  ```json
  {
    "model": "claude-opus-5-5",
    "modelSettings": {
      "claude-opus-5-5": { "effortLevel": "medium" }
    }
  }
  ```

  설정 파일의 최상위 `effortLevel` 은 Opus 5.5 에 적용되지 않습니다. 그래서 위와 같이 모델별 설정(`modelSettings`) 안에 적습니다.

환경 변수 `CLAUDE_CODE_EFFORT_LEVEL` 은 위 설정보다 먼저 적용되므로 설정되어 있지 않아야 합니다. macOS 에서는 `echo $CLAUDE_CODE_EFFORT_LEVEL` 의 결과가, Windows PowerShell 에서는 `echo $env:CLAUDE_CODE_EFFORT_LEVEL` 의 결과가 비어 있는지 확인합니다.

## 2. 요금제

Claude Code 는 Pro, Max, Ultra, Team, Enterprise 요금제나 API(Console) 계정으로 쓸 수 있으며, 이 요금제에서는 Opus 5.5 가 기본 모델입니다. 무료(Free) 요금제로는 Claude Code 를 쓸 수 없습니다.

## 3. 개인 설정 끄기

실습 동안 다음 개인 설정을 끄고, 실습이 끝나면 되돌립니다. setup 명령은 찾을 수 있는 개인 MCP 서버와 지침 파일을 `[주의]` 로 알려 주며, 그 내용은 참가자 기록에 남아 PR 과 함께 공개됩니다. 그러므로 setup 명령을 실행하기 전에 미리 끕니다.

- 전역 지침 파일 `~/.claude/CLAUDE.md` 는 이름을 바꿔 둡니다. macOS 에서는 `mv ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.off` 를, Windows PowerShell 에서는 `Rename-Item $HOME\.claude\CLAUDE.md CLAUDE.md.off` 를 실행합니다.
- 개인 규칙 폴더 `~/.claude/rules/` 와 개인 스킬 폴더 `~/.claude/skills/` 도 같은 방법으로 이름을 바꿔 둡니다(예: `rules.off`, `skills.off`). 저장소 폴더가 홈 폴더 안에 있으면 setup 명령은 `~/.claude/rules/` 도 `[주의]` 로 알려 줍니다.
- 설치한 플러그인은 `/plugin` 화면에서 실습 동안 끕니다. 화면 표기는 버전에 따라 다를 수 있습니다.
- 사용자 범위 MCP 서버는 `claude mcp list` 로 확인하고, 실습 동안 `claude mcp remove <이름> -s user` 로 지웁니다. 나중에 다시 추가할 수 있도록 지우기 전에 `claude mcp get <이름>` 으로 설정을 확인해 적어 둡니다.
- claude.ai 계정으로 로그인했다면 claude.ai 에 추가한 커넥터(connector)도 `/mcp` 에 claude.ai 에서 왔다는 표시와 함께 나타납니다. 이 커넥터는 setup 명령이 두 실행 폴더의 `.claude/settings.json` 에 `"disableClaudeAiConnectors": true` 를 써서 모두 끄므로 따로 끌 필요가 없습니다. 이 설정은 7절처럼 터미널에서 실행 폴더로 이동해 시작한 Claude Code 에 적용되며, 6절의 연결 확인에서 커넥터가 보이지 않는지 확인합니다.
- claude.ai 계정으로 로그인했다면 claude.ai 계정에서 켠 스킬과 플러그인도 Claude Code 가 내려받아 함께 로드합니다. 실습 동안에는 `~/.claude/settings.json` 에 다음 두 항목을 넣어 이 동기화를 끕니다. 파일이 이미 있으면 기존 내용에 두 항목을 더합니다. 이 두 항목은 실행 폴더의 `.claude/settings.json` 같은 프로젝트 설정에서는 적용되지 않으므로 setup 명령이 대신 넣지 않습니다. 끈 뒤 Claude Code 를 다시 시작하면 이미 내려받은 스킬과 플러그인은 `~/.claude/skills/.trash/` 와 `~/.claude/plugins/.trash/` 로 옮겨지고 로드되지 않습니다. claude.ai 계정의 스킬과 플러그인은 그대로 남아 있으며, 실습이 끝나면 두 항목을 지웁니다.

  ```json
  {
    "syncClaudeAiSkills": false,
    "syncClaudeAiPlugins": false
  }
  ```

## 4. setup 이 실행 폴더에 쓰는 파일

| 실행 | 파일 | 역할 |
|---|---|---|
| nomcp, mcp | `TASK.md` | 과제. 맨 위에 실행 종류를 알리는 한 줄이 붙습니다 |
| nomcp, mcp | `CLAUDE.md` | 작업 범위 지침. Claude Code 가 자동으로 읽습니다 |
| nomcp, mcp | `.claude/settings.json` | claude.ai 커넥터 끄기(`disableClaudeAiConnectors`). mcp 실행에서는 `.mcp.json` 의 `egovframe-codegen` 서버 사용 허용(`enabledMcpjsonServers`)도 들어갑니다 |
| mcp | `.mcp.json` | `egovframe-codegen` 서버 연결 설정 |

nomcp 실행 폴더에는 MCP 연결 설정을 쓰지 않습니다. nomcp 의 `.claude/settings.json` 에는 커넥터를 끄는 항목만 들어갑니다. `.mcp.json` 에는 이 PC 의 절대 경로가 들어 있고 `.claude/` 는 이 PC 에서만 쓰는 도구 설정이라서, 둘 다 제출에서 빠집니다. MCP 연결 설정의 명령은 setup 명령을 실행한 Node.js 의 절대 경로이고, 서버 파일은 저장소 폴더 안의 `.mcp-servers/egovframe-mcp-codegen/package/build/index.js` 입니다. 따라서 Node.js 를 다시 설치했거나 저장소 폴더를 옮겼다면 setup 명령을 다시 실행합니다.

## 5. 처음 한 번 확인할 것

- 실행 폴더에서 `claude` 를 처음 실행하면 폴더를 신뢰할지 묻습니다. 신뢰를 선택합니다. 이 확인은 저장소 폴더(git 저장소의 루트)를 기준으로 기록되므로 두 실행에서 한 번만 나올 수 있습니다.
- mcp 실행에서는 setup 명령이 `.claude/settings.json` 으로 `egovframe-codegen` 서버 사용을 미리 허용해 둡니다. 그래도 `.mcp.json` 의 서버를 사용할지 묻는 창이 나오면 허용합니다.

## 6. 연결 확인

mcp 실행에서는 실행 폴더에서 Claude Code 를 시작한 뒤(시작 방법은 7절) `/mcp` 를 입력합니다. `egovframe-codegen` 서버가 연결됨(connected)으로 보여야 하고, 서버를 선택하면 다음 도구 4개가 보여야 합니다.

- `egov_scaffold_project`
- `egov_add_entity`
- `egov_add_query_view`
- `egov_add_attach_file_infrastructure`

nomcp 실행에서는 `/mcp` 에 `egovframe-codegen` 서버가 없어야 합니다. 두 실행 모두 개인 MCP 서버와 claude.ai 커넥터는 연결되어 있지 않아야 합니다.

## 7. 작업 방법

1. 새 터미널(Windows 는 PowerShell)을 엽니다. setup 명령이 마지막 `다음 할 일` 의 1번 항목에 출력한 실행 폴더의 절대 경로로 이동한 뒤 `claude` 를 실행합니다. 새 터미널은 보통 홈 폴더에서 시작하므로 `submissions/...` 같은 상대 경로로는 이동할 수 없습니다.

   ```bash
   cd "<setup 이 출력한 실행 폴더의 경로>"
   claude
   ```

2. 모델과 노력 수준을 확인하고 첫 프롬프트를 입력합니다.

   ```text
   TASK.md 를 읽고 이 폴더에 board-app 프로젝트를 만들어 줘.
   ```

3. 파일 수정이나 명령 실행 승인을 물으면 평소처럼 판단해 응답합니다.
4. 작업을 마치면 `/exit` 로 Claude Code 를 끝냅니다. 그리고 저장소 폴더로 이동해 `npm run submit` 을 실행합니다. 실행 폴더에서는 `cd ../../..` 로 저장소 폴더에 갈 수 있고, setup 명령이 `다음 할 일` 의 5번 항목에 출력한 저장소 폴더의 경로를 써도 됩니다.
5. mcp 실행은 새 세션으로 시작합니다. `claude --continue` 나 `/resume` 으로 nomcp 실행의 대화를 이어 가지 않습니다.

## 8. 문제 해결

아래 해결 방법 가운데에는 setup 명령을 다시 실행하는 방법이 있습니다. 아직 제출하지 않은 실행에서 setup 명령을 다시 실행하면 그 실행의 준비 시각이 새로 기록되어, 걸린 시간이 다시 실행한 때부터 계산됩니다. 그러므로 작업 중에 다시 실행했다면 처음 시작한 시각을 진행자에게 알립니다.

**`/mcp` 에 `egovframe-codegen` 서버가 없습니다.**
`claude` 를 `submissions/<ID>/mcp` 폴더에서 시작했는지 확인합니다(macOS 는 `pwd`, Windows 는 `Get-Location`). 그 폴더에 `.mcp.json` 이 있는지도 확인합니다. 폴더 신뢰를 선택하지 않았다면 `claude` 를 다시 실행해 신뢰를 선택합니다.

**`egovframe-codegen` 서버가 연결에 실패한 상태로 보입니다.**
대개 Node.js 를 다시 설치했거나 저장소 폴더를 옮긴 경우입니다. 저장소 폴더에서 mcp setup 명령(`npm run setup --test mcp --id P01 --tool Claude-Code`)을 다시 실행한 뒤 Claude Code 를 다시 시작합니다.

**nomcp 실행인데 `/mcp` 에 `egovframe-codegen` 서버가 보입니다.**
작업을 멈추고 진행자에게 알립니다. 사용자 범위나 로컬 범위에 같은 서버가 등록된 경우이므로 `claude mcp list` 로 확인하고, setup 명령이 알려 주는 명령(`claude mcp remove egovframe-codegen -s user` 또는 `-s local`)으로 지운 뒤 nomcp setup 명령을 다시 실행합니다.

**노력 수준이 medium 으로 바뀌지 않습니다.**
환경 변수 `CLAUDE_CODE_EFFORT_LEVEL` 이 설정되어 있는지 확인하고, 설정되어 있으면 지운 뒤 터미널을 다시 엽니다. 설정 파일에는 최상위 `effortLevel` 이 아니라 `modelSettings` 안에 적어야 합니다.

공통 문제는 [README 의 문제 해결](../README.md#5-문제-해결)에 있습니다.
