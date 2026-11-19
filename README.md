# 표준프레임워크 기술 심화교육 MCP 과목 실습 저장소

이 저장소는 2026년 11월 20일에 열리는 표준프레임워크 기술 심화교육 MCP 과목의 실습 저장소입니다. 이 문서는 교육 전날까지 준비할 내용과 실습 당일의 진행 절차를 설명합니다.

## 개요

교육생은 AI 코딩 도구로 전자정부 표준프레임워크(eGovFrame) 5.0 Boot 기반 게시판 프로젝트(`board-app`)를 두 번 만듭니다. 첫 번째 실습(nomcp)에서는 MCP 없이 AI 도구의 기본 기능만 사용하고, 두 번째 실습(mcp)에서는 eGovFrame 코드 생성 MCP 서버(`egovframe-codegen`)를 연결해 사용합니다.

| 순서 | 실습 | MCP 연결 | 제한 시간 | 실습 워크스페이스 |
|---|---|---|---|---|
| 1 | nomcp | 연결하지 않음 | 30분 | `submissions/{id}/nomcp` |
| 2 | mcp | `egovframe-codegen` 연결 | 20분 | `submissions/{id}/mcp` |

- `{id}` 는 진행자가 알려 주는 참가자 ID(예: `P01`)입니다.
- 실습 순서는 모든 교육생이 같습니다. nomcp 실습을 제출해야 mcp 실습을 준비할 수 있습니다.
- 실습마다 `npm run setup` 명령으로 실습 워크스페이스를 준비하고, AI 도구로 그 폴더를 열어 작업한 뒤, `npm run submit` 명령으로 제출합니다.
- 제출은 이 저장소(원본 저장소)로 보내는 Pull Request(PR)로 이루어집니다. 두 번째 제출은 첫 번째 제출에서 만든 PR 에 더해집니다.
- 시작 시각은 진행자가 알려 줍니다. setup 명령은 제한 시간과 예상 종료 시각을 보여 주고, submit 명령은 준비부터 제출까지 걸린 시간을 기록합니다.
- 제출물은 실습이 끝난 뒤 평가합니다.

준비나 실습 중에 막히면 [문제 해결](docs/troubleshooting.md)을 먼저 확인합니다.

## 1. 사전 준비 (교육 전날까지)

| 도구 | 버전 | 확인 |
|---|---|---|
| JDK | 17 | `java -version` |
| Maven | 3.9 (3.9.9 권장) | `mvn -version` |
| Node.js | 22 | `node --version` |
| Git | 최신 | `git --version` |
| gh (GitHub CLI) | 최신 | `gh --version` |

AI 코딩 도구는 다음 중 하나를 준비하고, 모델과 노력 수준을 맞춥니다.

| 사용 도구 | 모델 · 노력 수준 | 문서 |
|---|---|---|
| Claude Code (권장) | **Sonnet 5.5 · medium** | [docs/setup-claude-code.md](docs/setup-claude-code.md) |
| Codex (권장) | **GPT-6.1 Terra · medium** | [docs/setup-codex.md](docs/setup-codex.md) |
| Antigravity (IDE) | **Claude Sonnet 5.5 (Thinking)** | [docs/setup-antigravity.md](docs/setup-antigravity.md) |
| Cursor | **Claude Sonnet 5.5 · medium** | [docs/setup-cursor.md](docs/setup-cursor.md) |
| GitHub Copilot | **Claude Sonnet 5.5 · medium** | [docs/setup-github-copilot.md](docs/setup-github-copilot.md) |
| 상용 AI 를 쓸 수 없는 경우 | VS Code **Cline** + OpenRouter(API Key 는 실습 중 센터 제공) · **Qwen3.8 Flash** | [docs/setup-cline.md](docs/setup-cline.md) |

`npm run setup` 명령의 `--tool` 에는 아래 표의 값을 넣습니다. 위 모델을 쓰려면 각 도구에서 다음 요금제가 필요합니다. 자세한 조건과 모델 설정 방법은 도구별 문서에 있습니다.

| 사용 도구 | `--tool` 값 | 필요한 요금제 |
|---|---|---|
| Claude Code | `Claude-Code` | Pro, Max, Ultra, Team, Enterprise 또는 API(Console) 계정 |
| Codex | `Codex` | ChatGPT Plus, Pro, Business, Enterprise, Edu |
| Antigravity | `Antigravity` | Google AI Pro(유료 구독, 체험판 제외), Ultra, Enterprise |
| Cursor | `Cursor` | Premium 이상, 이전 요금제(Pro, Pro+, Ultra), Teams, Enterprise |
| GitHub Copilot | `GitHub-Copilot` | Copilot Pro, Pro+, Max, Business, Enterprise (Free, Student 제외) |
| Cline | `Cline` | 필요 없음 (OpenRouter API Key 는 실습 중 센터 제공) |

AI 도구의 설치와 로그인 방법은 도구별 문서의 첫 부분에 있습니다. 두 실습은 같은 도구, 같은 모델, 같은 노력 수준으로 진행합니다. 정해진 모델을 선택할 수 없으면 다른 모델로 바꾸지 말고 교육 전에 진행자에게 알립니다.

### 1.1 설치 확인

저장소 명령(`npm run check`, `npm run setup`, `npm run submit`)과 AI 도구는 다음 명령을 이름만으로 실행합니다. 그래서 각 프로그램이 설치되어 있고, 그 실행 파일이 있는 폴더가 PATH 환경 변수에 등록되어 있어야 합니다. Maven 이 JDK 17 로 실행되도록 `JAVA_HOME` 환경 변수도 JDK 17 폴더로 정해 두어야 합니다.

새 터미널(Windows 는 PowerShell, macOS 는 터미널)을 열고 다음 확인 명령을 하나씩 실행합니다.

| PATH 에 있어야 하는 명령 | 확인 명령 | 확인할 내용 |
|---|---|---|
| `java` (JDK 17) | `java -version` | 버전이 `17` 로 시작합니다 |
| `mvn` (Maven) | `mvn -version` | `Apache Maven 3.9` 이상의 3.x 버전이고, `Java version` 이 `17` 로 시작합니다 |
| `node`, `npm` (Node.js) | `node --version`, `npm --version` | `node` 버전이 `v22` 이상이고, `npm` 버전이 나옵니다 |
| `git` (Git) | `git --version` | 버전이 나옵니다 |
| `gh` (GitHub CLI) | `gh --version` | 버전이 나옵니다 |

`JAVA_HOME` 은 macOS 에서는 `echo $JAVA_HOME` 으로, Windows PowerShell 에서는 `echo $env:JAVA_HOME` 으로 확인하며, JDK 17 폴더가 나와야 합니다. 터미널에서 실행하는 AI 도구(Claude Code, Codex)를 쓴다면 `claude --version` 이나 `codex --version` 도 실행되는지 확인합니다.

명령을 찾을 수 없다는 오류가 나오거나 버전이 맞지 않으면 [운영체제별 설치](docs/install.md)에 따라 설치하거나 PATH 와 `JAVA_HOME` 을 정한 뒤, 새 터미널을 열고 다시 확인합니다.

### 1.2 GitHub 로그인과 Fork

gh 로그인에는 직접 만든 GitHub 토큰(Personal access token (classic))을 씁니다. 브라우저로 로그인하는 방법(`Login with a web browser`)으로 로그인한 PC 에서 `npm run submit` 이 제대로 진행되지 않은 사례가 있으므로 쓰지 않습니다. 이미 브라우저 방법으로 로그인했다면 아래 방법으로 다시 로그인합니다.

먼저 토큰을 만듭니다. 토큰에는 `repo` 와 `read:org` 권한이 반드시 있어야 하며, `read:org` 가 없으면 gh 가 토큰을 받아들이지 않습니다.

1. 브라우저에서 GitHub 에 로그인한 뒤 <https://github.com/settings/tokens> 를 엽니다. Personal access tokens (classic) 화면이 열립니다.
2. `Generate new token` 토글을 펼치면 `Generate new token` 과 `Generate new token (classic)` 이 나옵니다. 이 가운데 `Generate new token (classic)` 을 선택합니다.
3. `Note` 에 토큰 이름(예: `edu-2026-11-20`)을 적고, `Expiration` 에서 교육이 끝날 때까지 쓸 수 있는 기간을 고릅니다.
4. `Select scopes` 에서 `repo` 와 `read:org` 체크박스를 반드시 체크합니다. `read:org` 는 `admin:org` 아래에 있으며, `admin:org` 전체가 아니라 `read:org` 만 체크합니다.
5. 화면 아래의 `Generate token` 을 누르고, 화면에 나온 토큰(`ghp_` 로 시작)을 복사합니다. 토큰은 이 화면에서 한 번만 보이므로 창을 닫기 전에 복사해 둡니다. 토큰은 비밀번호와 같으므로 다른 사람에게 보여 주거나 공개된 곳에 붙여 넣지 않습니다.

그다음 터미널에서 gh 로 로그인합니다.

```bash
gh auth login
```

질문마다 화살표 키로 아래 답을 고르고 Enter 를 누릅니다. gh 버전에 따라 질문의 순서가 다를 수 있습니다.

| 질문 | 답 |
|---|---|
| `Where do you use GitHub?` | `GitHub.com` |
| `What is your preferred protocol for Git operations on this host?` | `HTTPS` |
| `Authenticate Git with your GitHub credentials?` (나올 때만) | `Yes` |
| `How would you like to authenticate GitHub CLI?` | `Paste an authentication token` |
| `Paste your authentication token:` | 복사한 토큰을 붙여 넣고 Enter (붙여 넣은 토큰은 화면에 그대로 보이지 않습니다) |

로그인을 마치면 다음 명령으로 확인합니다. 출력에 `Logged in to github.com account <본인 계정>` 과 `Active account: true` 가 보이고, `Token scopes` 에 `repo` 와 `read:org` 가 있어야 합니다. gh 에 여러 계정으로 로그인했다면 `Active account: true` 인 계정이 지금 쓰는 계정이며, 제출할 때 `npm run submit` 이 쓸 계정을 고르게 합니다([실습 절차의 첫 번째 실습](docs/practice.md#1-첫-번째-실습-nomcp-30분)의 5번).

```bash
gh auth status
```

다음 명령은 원본 저장소를 본인 계정으로 Fork 하고 그 Fork 를 본인 PC 로 clone 합니다. clone 한 저장소의 `origin` 은 본인의 Fork 를 가리킵니다. `--default-branch-only` 는 원본 저장소의 기본 브랜치(`main`)만 Fork 에 복사해, 원본 저장소에 있는 다른 브랜치가 Fork 에 섞이지 않게 합니다. 이 문서에서는 clone 한 `edu-2026-11-20` 폴더를 저장소 폴더라고 부릅니다.

```bash
gh repo fork swanpark8538/edu-2026-11-20 --clone --default-branch-only
cd edu-2026-11-20
```

이 저장소의 명령은 Node.js 의 기본 기능만 사용하므로 `npm install` 은 필요하지 않습니다.

### 1.3 전날 점검

저장소 폴더에서 다음 명령을 실행합니다. 처음 실행하면 Maven 의존성을 내려받느라 몇 분 걸릴 수 있습니다.

```bash
npm run check
```

이 명령은 다음 일을 합니다.

- JDK, Maven, Node.js, Git, gh 의 버전과 GitHub 로그인 상태를 확인합니다. Maven 이 JDK 17 로 실행되는지(`mvn -version` 출력의 `Java version`)도 확인합니다. gh 에 여러 계정으로 로그인했다면 활성 계정(`Active account: true`)의 로그인을 확인하고, 로그인에 실패한 다른 계정은 `[주의]` 로 따로 알려 줍니다.
- git 으로 clone 한 저장소 폴더에서 실행했는지와, `origin` 이 원본 저장소가 아니라 본인의 Fork 인지 확인합니다.
- 여섯 AI 도구의 전역 설정에 `egovframe-codegen` 서버가 켜져 있는지 확인합니다. 켜져 있으면 지우는 방법을 `[주의]` 로 알려 줍니다. 실습에 쓰는 도구의 서버라면 교육 전에 지웁니다.
- `.mcp-servers` 폴더에 풀린 채로 들어 있는 `egovframe-codegen` MCP 서버(`egovframe-mcp-codegen` 패키지)를 MCP 연결 설정과 같은 `node` 명령으로 한 번 실행해 동작을 확인합니다.
- 임시 폴더에 예제 프로젝트를 만들어 한 번 빌드한 뒤 지웁니다. 이때 내려받은 Maven 의존성은 Maven 로컬 저장소(`~/.m2`)에 남으므로 당일 첫 빌드가 빨라집니다.

점검하는 동안에는 항목마다 `[완료]`, `[주의]`, `[오류]` 가 붙어 나옵니다. 마지막의 점검 결과에는 `[오류]` 였던 항목이 `해결해야 할 항목` 아래에, `[주의]` 였던 항목이 `확인이 필요한 항목` 아래에 모여 나옵니다. 해결해야 할 항목은 안내에 따라 해결한 뒤 `npm run check` 를 다시 실행하고, 확인이 필요한 항목도 읽고 가능한 한 해결합니다. 해결해야 할 항목이 없으면 마지막 줄에 `모든 점검을 통과했습니다.` 또는 `필수 점검은 통과했습니다. 위 항목을 확인해 주세요.` 가 나옵니다.

## 2. 교육 당일에 읽을 문서

사전 준비를 마쳤으면 교육 당일에는 다음 문서를 읽습니다. AI 도구의 설정과 사용 방법은 1절의 표에 있는 도구별 문서에 있습니다.

| 문서 | 내용 |
|---|---|
| [이론 교재](slide-deck/pdf/egovframe-mcp.pdf) | MCP 개요, 에이전트 신뢰 환경, 표준프레임워크 MCP, 마무리 |
| [과제](docs/task.md) | 만들 프로젝트와 게시판 테이블 |
| [실습 절차](docs/practice.md) | nomcp 실습과 mcp 실습의 준비, 작업, 제출 절차 |
| [지킬 것](docs/rules.md) | 실습하는 동안 지킬 것 |
| [문제 해결](docs/troubleshooting.md) | check, setup, submit 명령과 AI 도구에서 막혔을 때의 해결 방법 |
| [실습 후](docs/after-practice.md) | 두 실습을 제출한 뒤에 할 일 |

## 3. 저장소 구성

| 경로 | 내용 |
|---|---|
| `scripts/` | `npm run check`, `npm run setup`, `npm run submit`, `npm run cleanup` 명령의 스크립트 |
| `docs/` | 운영체제별 설치 문서(`install.md`), 교육 당일에 읽을 문서(과제, 실습 절차, 지킬 것, 문제 해결, 실습 후), 도구별 설정 문서 (`setup-<도구>.md`) |
| `task/` | 과제 원본 (`TASK.md`) |
| `.mcp-servers/` | codegen MCP 서버(`egovframe-mcp-codegen` 패키지)를 푼 폴더. MCP 연결 설정이 `node` 로 `egovframe-mcp-codegen/package/build/index.js` 를 바로 실행합니다 |
| `mcp/` | 실습에서는 쓰지 않는 다른 MCP 서버 묶음 파일(`.tgz`) |
| `submissions/` | 제출 폴더. setup 명령이 `submissions/{id}/` 아래에 실습 워크스페이스를 만듭니다 |
| `test/` | 스크립트 시험 코드 (`npm test`) |
