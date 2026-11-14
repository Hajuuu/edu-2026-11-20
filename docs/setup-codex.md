# Codex 설정

Codex 로 실습하는 교육생을 위한 안내입니다. `npm run setup` 명령에는 `--tool Codex` 를 넣습니다. 전체 절차는 [README 의 실습 절차](../README.md#3-실습-절차)를 따르고, 이 문서는 Codex 에서 할 일을 설명합니다. 이 문서는 터미널에서 실행하는 Codex CLI 를 기준으로 합니다.

설치와 로그인은 [Codex CLI 공식 안내](https://learn.chatgpt.com/docs/codex/cli)를 따릅니다. Windows 에서는 setup 명령을 실행한 PowerShell 에서 Codex 를 실행합니다. WSL 안에서 Codex 를 실행하면 setup 명령이 적어 둔 Windows 용 Node.js 경로를 쓸 수 없어 MCP 가 연결되지 않습니다.

## 1. 모델과 노력 수준

두 실행 모두 **GPT-6.1 Sol**(`gpt-6.1-sol`) 모델과 추론 노력 수준(reasoning effort) **medium** 을 씁니다. GPT-6.1 Sol 은 OpenAI 의 최상위 모델(Astra)이 아니라 Opus 5.5 에 대응하는 등급의 모델이며, Codex CLI v0.161.0 부터 기본 모델입니다.

다음 방법 가운데 하나로 모델과 노력 수준을 맞춥니다.

- 화면에서 선택하기: Codex 에서 `/model` 을 입력하고 GPT-6.1 Sol 을 선택한 뒤 Medium 을 선택합니다.
- 시작할 때 정하기: `codex -m gpt-6.1-sol` 로 시작하면 모델이 정해집니다. 노력 수준은 `/model` 이나 설정 파일로 맞춥니다.
- 설정 파일로 정하기: `~/.codex/config.toml` 에 다음 두 줄을 넣습니다. 이 두 줄은 파일의 맨 위, 즉 첫 번째 `[...]` 머리보다 앞에 둡니다. Codex IDE 확장도 같은 파일을 읽습니다.

  ```toml
  model = "gpt-6.1-sol"
  model_reasoning_effort = "medium"
  ```

`/status` 를 입력하면 지금 세션의 모델과 설정을 확인할 수 있습니다.

## 2. 요금제

ChatGPT Plus, Pro, Business, Enterprise, Edu 요금제 가운데 하나가 필요합니다.

## 3. 개인 설정 끄기

실습 동안 다음 개인 설정을 끄고, 실습이 끝나면 되돌립니다. setup 명령은 찾을 수 있는 개인 MCP 서버와 지침 파일을 `[주의]` 로 알려 줍니다. 환경 변수 `CODEX_HOME` 을 쓰고 있다면 아래의 `~/.codex` 대신 그 폴더를 봅니다.

- 전역 지침 파일 `~/.codex/AGENTS.md` 와 `~/.codex/AGENTS.override.md` 는 이름을 바꿔 둡니다(예: `AGENTS.md.off`).
- 개인 MCP 서버는 `codex mcp list` 로 확인합니다. 실습 동안 `~/.codex/config.toml` 의 `[mcp_servers.<이름>]` 아래에 `enabled = false` 를 넣어 끄거나, `codex mcp remove <이름>` 으로 지웁니다.
- 특히 전역 설정에 `egovframe-codegen` 서버가 남아 있으면 setup 명령이 nomcp 실행 준비를 멈춥니다. 이때는 `codex mcp remove egovframe-codegen` 을 실행한 뒤 setup 명령을 다시 실행합니다.

## 4. setup 이 실행 폴더에 쓰는 파일

| 실행 | 파일 | 역할 |
|---|---|---|
| nomcp, mcp | `TASK.md` | 과제. 맨 위에 실행 종류를 알리는 한 줄이 붙습니다 |
| nomcp, mcp | `AGENTS.md` | 작업 범위 지침. Codex 가 자동으로 읽습니다 |
| mcp | `.codex/config.toml` | `egovframe-codegen` 서버 연결 설정(`[mcp_servers.egovframe-codegen]` 의 `command`, `args`) |

nomcp 실행 폴더에는 MCP 연결 설정을 쓰지 않습니다. `.codex/` 에는 이 PC 의 절대 경로가 들어 있어 제출에서 빠집니다. MCP 연결 설정의 명령은 setup 명령을 실행한 Node.js 의 절대 경로이고, 서버 파일은 저장소 폴더 안의 `.mcp-servers/egovframe-mcp-codegen/package/build/index.js` 입니다. 따라서 Node.js 를 다시 설치했거나 저장소 폴더를 옮겼다면 setup 명령을 다시 실행합니다.

## 5. 처음 한 번 확인할 것

Codex 는 신뢰한 프로젝트에서만 프로젝트의 `.codex/config.toml` 을 읽습니다. 실행 폴더에서 Codex 를 처음 실행할 때 이 폴더를 신뢰할지 물으면 신뢰를 선택합니다. 신뢰는 git 저장소의 루트(저장소 폴더)를 기준으로 기록됩니다. 신뢰하지 않으면 mcp 실행에서 `egovframe-codegen` 서버가 연결되지 않습니다.

## 6. 연결 확인

mcp 실행에서는 실행 폴더에서 Codex 를 시작한 뒤 `/mcp` 를 입력합니다.

```bash
cd submissions/P01/mcp
codex
```

`egovframe-codegen` 서버와 다음 도구 4개가 보여야 합니다.

- `egov_scaffold_project`
- `egov_add_entity`
- `egov_add_query_view`
- `egov_add_attach_file_infrastructure`

nomcp 실행에서는 `/mcp` 에 `egovframe-codegen` 서버가 없어야 합니다. 두 실행 모두 개인 MCP 서버는 보이지 않아야 합니다.

## 7. 작업 방법

1. 새 터미널을 열고 저장소 폴더에서 실행 폴더로 이동한 뒤 `codex` 를 실행합니다. 아래 예는 nomcp 실행이며, mcp 실행에서는 `nomcp` 를 `mcp` 로 바꿉니다.

   ```bash
   cd submissions/P01/nomcp
   codex
   ```

2. `/status` 로 모델과 노력 수준을 확인하고 첫 프롬프트를 입력합니다.

   ```text
   TASK.md 를 읽고 이 폴더에 board-app 프로젝트를 만들어 줘.
   ```

3. 파일 수정이나 명령 실행 승인을 물으면 평소처럼 판단해 응답합니다.
4. 작업을 마치면 Codex 를 끝냅니다. 그리고 저장소 폴더로 돌아가(`cd ../../..`) `npm run submit` 을 실행합니다.
5. mcp 실행은 새 세션으로 시작합니다. 이전 대화를 이어 가는 기능(`codex resume` 등)으로 nomcp 실행의 대화를 이어 가지 않습니다.

## 8. 문제 해결

**`/mcp` 에 `egovframe-codegen` 서버가 없습니다.**
`codex` 를 `submissions/<ID>/mcp` 폴더에서 시작했는지, 그 폴더에 `.codex/config.toml` 이 있는지 확인합니다. 폴더를 신뢰하지 않았다면 프로젝트 설정을 읽지 않습니다. `~/.codex/config.toml` 에 저장소 폴더의 항목이 `trust_level = "untrusted"` 로 남아 있으면 `"trusted"` 로 바꾸고 Codex 를 다시 시작합니다. 설정 이름은 버전에 따라 다를 수 있습니다.

**`egovframe-codegen` 서버가 시작되지 않습니다.**
Node.js 를 다시 설치했거나 저장소 폴더를 옮긴 경우입니다. 저장소 폴더에서 mcp setup 명령(`npm run setup --test mcp --id P01 --tool Codex`)을 다시 실행한 뒤 Codex 를 다시 시작합니다.

**nomcp 실행인데 `/mcp` 에 `egovframe-codegen` 서버가 보입니다.**
작업을 멈추고 진행자에게 알립니다. 전역 설정 `~/.codex/config.toml` 에 같은 서버가 남아 있는 경우이므로 `codex mcp remove egovframe-codegen` 으로 지운 뒤 nomcp setup 명령을 다시 실행합니다.

공통 문제는 [README 의 문제 해결](../README.md#5-문제-해결)에 있습니다.
