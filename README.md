# 표준프레임워크 기술 심화교육 MCP 과목 실습 저장소

이 저장소는 2026년 11월 20일에 열리는 표준프레임워크 기술 심화교육 MCP 과목의 실습 저장소입니다. 이 문서는 교육 전날까지 준비할 내용과 실습 당일의 진행 절차를 설명합니다.

## 개요

교육생은 AI 코딩 도구로 전자정부 표준프레임워크(eGovFrame) 5.0 Boot 기반 게시판 프로젝트(`board-app`)를 두 번 만듭니다. 첫 번째 실습(nomcp)에서는 MCP 없이 AI 도구의 기본 기능만 사용하고, 두 번째 실습(mcp)에서는 eGovFrame 코드 생성 MCP 서버(`egovframe-codegen`)를 연결해 사용합니다.

| 순서 | 실습 | MCP 연결 | 제한 시간 | 실습 워크스페이스 |
|---|---|---|---|---|
| 1 | nomcp | 연결하지 않음 | 30분 | `submissions/<ID>/nomcp` |
| 2 | mcp | `egovframe-codegen` 연결 | 20분 | `submissions/<ID>/mcp` |

- `<ID>` 는 진행자가 알려 주는 참가자 ID(예: `P01`)입니다.
- 실습 순서는 모든 교육생이 같습니다. nomcp 실습을 제출해야 mcp 실습을 준비할 수 있습니다.
- 실습마다 `npm run setup` 명령으로 실습 워크스페이스를 준비하고, AI 도구로 그 폴더를 열어 작업한 뒤, `npm run submit` 명령으로 제출합니다.
- 제출은 이 저장소(원본 저장소)로 보내는 Pull Request(PR)로 이루어집니다. 두 번째 제출은 첫 번째 제출에서 만든 PR 에 더해집니다.
- 시작 시각은 진행자가 알려 줍니다. setup 명령은 제한 시간과 예상 종료 시각을 보여 주고, submit 명령은 준비부터 제출까지 걸린 시간을 기록합니다.
- 제출물은 실습이 끝난 뒤 평가합니다.

준비나 실습 중에 막히면 [5. 문제 해결](#5-문제-해결)을 먼저 확인합니다.

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
| Claude Code (권장) | **Opus 5.5 · medium** | [docs/setup-claude-code.md](docs/setup-claude-code.md) |
| Codex (권장) | **GPT-6.1 Sol · medium** | [docs/setup-codex.md](docs/setup-codex.md) |
| Antigravity (IDE) | **Claude Opus 5.5 (Thinking)** | [docs/setup-antigravity.md](docs/setup-antigravity.md) |
| Cursor | **Claude Opus 5.5 · medium** | [docs/setup-cursor.md](docs/setup-cursor.md) |
| GitHub Copilot | **Claude Opus 5.5 · medium** | [docs/setup-github-copilot.md](docs/setup-github-copilot.md) |
| 상용 AI 를 쓸 수 없는 경우 | VS Code **Cline** + OpenRouter(API Key 는 실습 중 센터 제공) · **GPT-OSS-120B** | [docs/setup-cline.md](docs/setup-cline.md) |

`npm run setup` 명령의 `--tool` 에는 아래 표의 값을 넣습니다. 위 모델을 쓰려면 각 도구에서 다음 요금제가 필요합니다. 자세한 조건과 모델 설정 방법은 도구별 문서에 있습니다.

| 사용 도구 | `--tool` 값 | 필요한 요금제 |
|---|---|---|
| Claude Code | `Claude-Code` | Pro, Max, Ultra, Team, Enterprise 또는 API(Console) 계정 |
| Codex | `Codex` | ChatGPT Plus, Pro, Business, Enterprise, Edu |
| Antigravity | `Antigravity` | Google AI Pro(유료 구독, 체험판 제외), Ultra, Enterprise |
| Cursor | `Cursor` | Premium 이상, 이전 요금제(Pro, Pro+, Ultra), Teams, Enterprise |
| GitHub Copilot | `GitHub-Copilot` | Copilot Pro+, Max, Business, Enterprise (Free, Pro 제외) |
| Cline | `Cline` | 필요 없음 (OpenRouter API Key 는 실습 중 센터 제공) |

AI 도구의 설치와 로그인 방법은 도구별 문서의 첫 부분에 있습니다. 두 실습은 같은 도구, 같은 모델, 같은 노력 수준으로 진행합니다. 정해진 모델을 선택할 수 없으면 다른 모델로 바꾸지 말고 교육 전에 진행자에게 알립니다.

### 1.1 운영체제별 설치

아래는 설치 방법의 예입니다. 이미 설치되어 있으면 위 표의 확인 명령으로 버전만 확인합니다. Node.js 는 22 보다 높은 버전도 그대로 쓸 수 있습니다. Maven 은 3.9.9 를 권장하며, 3.9 이상인 3.x 버전이면 `npm run check` 점검을 통과합니다. 미리 보기 단계인 Maven 4 는 쓰지 않습니다. 설치하거나 환경 변수를 바꾼 뒤에는 터미널을 새로 열어야 바뀐 내용이 적용됩니다.

#### Windows x64 와 Windows on Arm (ARM64)

명령은 PowerShell(Windows 터미널)에서 실행합니다. WSL(Linux 환경)은 지원 대상이 아니므로, 저장소 명령과 AI 도구를 모두 Windows 에서 실행합니다. Windows on Arm PC 에서는 각 프로그램의 ARM64 판을 설치합니다. Claude Code, Cursor, VS Code, Antigravity 는 Windows ARM64 를 지원합니다. Windows on Arm 에서 Codex 를 쓴다면 npm 으로 설치하는 방법(`npm install -g @openai/codex`)을 쓸 수 있으며, 이 패키지에는 Windows ARM64 용 실행 파일이 들어 있습니다. 설치한 뒤에는 PowerShell 에서 `codex --version` 이 실행되는지 미리 확인합니다. PowerShell 이 `codex.ps1` 파일을 로드할 수 없다고 하면 [5. 문제 해결](#5-문제-해결)의 `npm.ps1` 항목과 같은 방법으로 해결합니다.

1. JDK 17 을 설치합니다. winget 을 쓰거나, [Microsoft Build of OpenJDK 다운로드 페이지](https://learn.microsoft.com/ko-kr/java/openjdk/download)에서 OpenJDK 17 의 Windows `msi` 파일을 받습니다. ARM64 PC 는 `windows-aarch64` 파일을, x64 PC 는 `windows-x64` 파일을 받습니다.

   ```powershell
   winget install --id Microsoft.OpenJDK.17
   ```

2. 새 PowerShell 창에서 `where.exe java` 를 실행해 JDK 17 이 설치된 폴더를 확인합니다. 출력된 경로 가운데 `jdk-17` 이 들어간 경로에서 끝의 `\bin\java.exe` 를 뺀 폴더가 JDK 17 폴더입니다. 다음 명령의 `<JDK 17 폴더>` 자리에 그 폴더를 넣어 `JAVA_HOME` 환경 변수를 정합니다. `java -version` 이 17 이 아닌 버전을 보여 주면 다른 JDK 가 Path 의 앞쪽에 있는 것이므로, 환경 변수 화면에서 JDK 17 의 `bin` 폴더가 다른 JDK 보다 앞에 오도록 순서를 바꿉니다.

   ```powershell
   where.exe java
   [Environment]::SetEnvironmentVariable("JAVA_HOME", "<JDK 17 폴더>", "User")
   ```

3. Maven 3.9.9 를 받아 홈 폴더의 `tools` 폴더에 풀고, `bin` 폴더를 사용자 PATH 에 더합니다. Maven 은 Java 로 실행되므로 x64 와 ARM64 에서 같은 파일을 씁니다.

   ```powershell
   Invoke-WebRequest https://archive.apache.org/dist/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.zip -OutFile "$env:TEMP\apache-maven-3.9.9-bin.zip"
   Expand-Archive "$env:TEMP\apache-maven-3.9.9-bin.zip" -DestinationPath "$HOME\tools"
   $p = [Environment]::GetEnvironmentVariable("Path", "User")
   [Environment]::SetEnvironmentVariable("Path", "$p;$HOME\tools\apache-maven-3.9.9\bin", "User")
   ```

4. Node.js 22 를 설치합니다. [Node.js 다운로드 페이지](https://nodejs.org/ko/download)에서 v22 LTS 의 Windows 설치 파일을 받습니다. ARM64 PC 는 `node-v22.x.x-arm64.msi` 를, x64 PC 는 `node-v22.x.x-x64.msi` 를 받습니다.
5. Git 과 gh 를 설치합니다. winget 을 쓰거나 [Git 다운로드 페이지](https://git-scm.com/install/windows)와 [GitHub CLI 페이지](https://cli.github.com)에서 설치 파일을 받습니다. ARM64 PC 용 설치 파일은 Git 의 `Git-<버전>-arm64.exe` 와 gh 의 `gh_<버전>_windows_arm64.msi` 입니다.

   ```powershell
   winget install --id Git.Git -e --source winget
   winget install --id GitHub.cli
   ```

6. 새 PowerShell 창에서 위 표의 확인 명령을 실행합니다. `mvn -version` 출력의 `Java version` 이 17 인지도 확인합니다.

#### macOS (Apple silicon 과 Intel)

명령은 터미널(zsh)에서 실행합니다. bash 를 쓰고 있다면 아래 명령의 `~/.zshrc` 를 `~/.bash_profile` 로 바꿉니다. 이미 다른 방법(SDKMAN 등)으로 설치했다면 그대로 써도 되며, 위 표의 확인 명령이 맞는 버전을 보여 주면 됩니다.

**Apple silicon: Homebrew 로 설치합니다.** [Homebrew](https://brew.sh) 가 없으면 먼저 설치합니다.

```bash
brew install openjdk@17 maven node@22 git gh
```

Homebrew 는 `openjdk@17` 과 `node@22` 를 PATH 에 자동으로 넣지 않습니다. 또한 Homebrew 의 `maven` 은 `JAVA_HOME` 이 없으면 Homebrew 의 최신 JDK 로 실행됩니다. 그래서 다음 명령으로 `JAVA_HOME` 을 JDK 17 로 정하고 PATH 에 두 폴더를 넣습니다. Homebrew 의 `maven` 은 3.9 보다 높은 3.x 버전(예: 3.10.0)일 수 있으며, `npm run check` 를 통과하면 그대로 씁니다.

```bash
echo 'export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"' >> ~/.zshrc
echo 'export PATH="$JAVA_HOME/bin:/opt/homebrew/opt/node@22/bin:$PATH"' >> ~/.zshrc
```

**Intel: 공식 설치 파일로 설치합니다.** Homebrew 는 Intel Mac 용 새 바이너리를 더 만들지 않아, Intel Mac 에서는 설치할 때 소스에서 빌드하느라 오래 걸리거나 실패할 수 있습니다. Apple silicon 에서도 이 방법을 쓸 수 있습니다.

1. JDK 17 을 설치합니다. [Microsoft Build of OpenJDK 다운로드 페이지](https://learn.microsoft.com/ko-kr/java/openjdk/download)에서 OpenJDK 17 의 macOS `pkg` 파일을 받습니다. Intel 은 `macos-x64` 파일을, Apple silicon 은 `macos-aarch64` 파일을 받습니다.
2. Node.js 22 를 설치합니다. [Node.js 다운로드 페이지](https://nodejs.org/ko/download)에서 v22 LTS 의 macOS 설치 파일(`.pkg`)을 받습니다.
3. Git 을 설치합니다. 터미널에서 `xcode-select --install` 을 실행해 Command Line Tools 를 설치하면 git 이 함께 설치됩니다.
4. gh 를 설치합니다. [GitHub CLI 페이지](https://cli.github.com)에서 macOS 설치 파일(`gh_<버전>_macOS_universal.pkg`)을 받습니다.
5. 다음 명령으로 Maven 3.9.9 를 홈 폴더의 `tools` 폴더에 풀고, `JAVA_HOME` 과 PATH 를 정합니다.

   ```bash
   mkdir -p ~/tools
   curl -fL https://archive.apache.org/dist/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.tar.gz | tar -xzf - -C ~/tools
   echo 'export JAVA_HOME="$(/usr/libexec/java_home -v 17)"' >> ~/.zshrc
   echo 'export PATH="$JAVA_HOME/bin:$HOME/tools/apache-maven-3.9.9/bin:$PATH"' >> ~/.zshrc
   ```

설치를 마치면 새 터미널에서 위 표의 확인 명령을 실행합니다. `mvn -version` 출력의 `Java version` 이 17 인지도 확인합니다.

### 1.2 GitHub 로그인과 Fork

먼저 gh 로 GitHub 에 로그인합니다. 질문에는 `GitHub.com`, `HTTPS` 를 선택하고, `Authenticate Git with your GitHub credentials?` 에는 `Yes` 로 답합니다.

```bash
gh auth login
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

- JDK, Maven, Node.js, Git, gh 의 버전과 GitHub 로그인 상태를 확인합니다. Maven 이 JDK 17 로 실행되는지(`mvn -version` 출력의 `Java version`)도 확인합니다.
- git 으로 clone 한 저장소 폴더에서 실행했는지와, `origin` 이 원본 저장소가 아니라 본인의 Fork 인지 확인합니다.
- 여섯 AI 도구의 전역 설정에 `egovframe-codegen` 서버가 켜져 있는지 확인합니다. 켜져 있으면 지우는 방법을 `[주의]` 로 알려 줍니다. 실습에 쓰는 도구의 서버라면 교육 전에 지웁니다.
- `egovframe-codegen` MCP 서버를 저장소 폴더 안에 설치합니다.
- 임시 폴더에 예제 프로젝트를 만들어 한 번 빌드한 뒤 지웁니다. 이때 내려받은 Maven 의존성은 Maven 로컬 저장소(`~/.m2`)에 남으므로 당일 첫 빌드가 빨라집니다.

점검하는 동안에는 항목마다 `[완료]`, `[주의]`, `[오류]` 가 붙어 나옵니다. 마지막의 점검 결과에는 `[오류]` 였던 항목이 `해결해야 할 항목` 아래에, `[주의]` 였던 항목이 `확인이 필요한 항목` 아래에 모여 나옵니다. 해결해야 할 항목은 안내에 따라 해결한 뒤 `npm run check` 를 다시 실행하고, 확인이 필요한 항목도 읽고 가능한 한 해결합니다. 해결해야 할 항목이 없으면 마지막 줄에 `모든 점검을 통과했습니다.` 또는 `필수 점검은 통과했습니다. 위 항목을 확인해 주세요.` 가 나옵니다.

### 1.4 개인 설정 끄기

실습 동안에는 AI 도구의 개인 설정을 꺼 둡니다. 대상은 전역 지침 파일, 개인 MCP 서버, 계정에 연결한 커넥터, 개인 스킬, 플러그인, 규칙입니다. 도구별 방법은 도구 문서의 '개인 설정 끄기' 절에 있습니다. setup 명령은 찾을 수 있는 개인 MCP 서버와 지침 파일을 `[주의]` 로 알려 주며, 그 내용(서버 이름과 파일 위치)은 참가자 기록에 남아 PR 과 함께 공개됩니다. 그러므로 setup 명령을 실행하기 전에 미리 꺼 둡니다. Cursor 와 GitHub Copilot(VS Code)은 화면에서 끄기만 하면 setup 명령이 읽는 설정 파일에 서버가 그대로 남을 수 있으므로, 도구 문서에 따라 파일에서 서버 항목을 지웁니다.

## 2. 과제

과제는 **전자정부 표준프레임워크(eGovFrame) 5.0 Boot 기반 게시판 프로젝트**를 만드는 것입니다. 자세한 요구 사항은 [task/TASK.md](task/TASK.md)에 있으며, setup 명령이 이 파일을 실습 워크스페이스에 `TASK.md` 로 복사합니다. 게시판 테이블은 다음과 같습니다.

```sql
CREATE TABLE BOARD (
  BOARD_ID VARCHAR(20) NOT NULL,
  TITLE    VARCHAR(200) NOT NULL,
  CONTENT  VARCHAR(4000),
  WRITER   VARCHAR(50) NOT NULL,
  PRIMARY KEY (BOARD_ID)
);
```

## 3. 실습 절차

명령은 모두 저장소 폴더에서 실행합니다. 아래 예의 `P01` 자리에는 진행자가 알려 준 참가자 ID 를, `Claude-Code` 자리에는 사용하는 도구의 `--tool` 값을 넣습니다.

### 3.1 첫 번째 실습: nomcp (30분)

1. 진행자의 안내에 따라 실습을 준비합니다.

   ```bash
   npm run setup --test nomcp --id P01 --tool Claude-Code
   ```

   다음과 같이 `--` 를 넣은 형태도 같은 뜻입니다. 앞의 형태에서 인자 오류가 나면 이 형태로 실행합니다.

   ```bash
   npm run setup -- --test nomcp --id P01 --tool Claude-Code
   ```

   npm 11 이상에서는 `--` 가 없는 형태를 실행할 때 `Unknown cli config` 같은 경고가 나올 수 있습니다. 이 경고는 결과에 영향을 주지 않으며, `--` 를 넣은 형태로 실행하면 나오지 않습니다.

   setup 명령은 다음 일을 합니다.

   - 제출용 로컬 브랜치 `submit/P01` 을 만들고 그 브랜치로 전환합니다.
   - 실습 워크스페이스 `submissions/P01/nomcp` 를 만들고 `TASK.md` 와 작업 범위 지침 파일을 씁니다. 지침 파일은 AI 도구에게 이 폴더 밖을 참고하지 말라고 알리는 파일이며, 파일 이름은 도구마다 다릅니다.
   - 참가자 기록 `submissions/P01/participant.json` 에 도구, 모델, 운영체제, 도구 버전, 준비 시각을 남깁니다. 이 기록에는 PC 의 절대 경로와 사용자 이름을 넣지 않습니다.
   - 마지막에 열 폴더의 경로, 도구 문서, 첫 프롬프트, 제한 시간과 예상 종료 시각을 보여 줍니다.

2. AI 도구로 실습 워크스페이스 `submissions/P01/nomcp` 를 엽니다. 저장소 폴더 전체를 열지 않습니다. 여는 방법은 도구 문서의 '작업 방법' 절에 있습니다.
3. 도구 문서의 '연결 확인' 절에 따라 `egovframe-codegen` 서버가 연결되어 있지 않은지 확인합니다.
4. 첫 프롬프트로 다음 문장을 입력합니다. 그다음에는 평소처럼 AI 와 대화하며 작업합니다.

   ```text
   TASK.md 를 읽고 이 폴더에 board-app 프로젝트를 만들어 줘.
   ```

5. 작업을 마치거나 제한 시간이 되면 AI 도구의 작업을 멈춥니다. 그리고 저장소 폴더에서 다음 명령으로 제출합니다.

   ```bash
   npm run submit
   ```

   submit 명령은 실습 워크스페이스와 참가자 기록을 커밋하고, 본인의 Fork 에 push 한 뒤, 원본 저장소에 PR 을 만듭니다. 출력의 마지막 부분에 PR 주소가 나옵니다. 제출에는 실습 워크스페이스의 파일과 `participant.json` 만 들어갑니다. 다만 빌드 결과(`target/`)는 빌드하면 다시 생기므로 제출하지 않습니다. 실습 워크스페이스 바로 아래의 도구 설정(`.mcp.json`, `.claude/`, `.codex/`, `.agents/`, `.cursor/`)도 이 PC 에서만 쓰는 설정이고 절대 경로가 들어 있을 수 있어 제출하지 않습니다. 20MB 를 넘는 파일은 자동으로 제출에서 빠집니다.

### 3.2 두 번째 실습: mcp (20분)

1. nomcp 실습을 제출한 뒤 진행자의 안내에 따라 mcp 실습을 준비합니다. `--tool` 값은 첫 번째 실습과 같아야 합니다.

   ```bash
   npm run setup --test mcp --id P01 --tool Claude-Code
   ```

   이번에는 setup 명령이 실습 워크스페이스 `submissions/P01/mcp` 에 MCP 연결 설정도 씁니다. 이 설정은 이 폴더를 연 AI 도구에만 `egovframe-codegen` 서버를 연결합니다. Cline 은 폴더 단위 설정이 없으므로, setup 명령이 Cline 전역 설정에 `egovframe-codegen` 항목을 넣고 켭니다(nomcp 실습에서는 꺼 둡니다).

2. nomcp 작업에 쓰던 창이나 세션을 닫고, 새 창이나 새 세션에서 `submissions/P01/mcp` 를 엽니다. 앞 실습의 대화를 이어서 쓰지 않습니다.
3. 처음 열 때 폴더 신뢰나 MCP 서버 사용을 묻는 창이 나오면 허용합니다. 그리고 도구 문서의 '연결 확인' 절에 따라 `egovframe-codegen` 서버와 도구 4개가 보이는지 확인합니다.
4. 첫 프롬프트는 nomcp 실습과 같습니다.
5. 작업을 마치거나 제한 시간이 되면 저장소 폴더에서 `npm run submit` 을 실행합니다. 이번 제출은 첫 번째 제출에서 만든 PR 에 더해집니다.

## 4. 지킬 것

- AI 도구에는 실습 워크스페이스(`submissions/<ID>/nomcp` 또는 `submissions/<ID>/mcp`) 하나만 엽니다. 저장소 폴더나 그 상위 폴더를 열지 않습니다.
- AI 에게 저장소의 다른 파일, 다른 실습의 폴더, 다른 사람의 PR 이나 Fork 를 보여 주지 않습니다. 교육생도 다른 사람의 PR 과 Fork 를 열어 보지 않습니다.
- 두 실습은 같은 도구, 같은 모델, 같은 노력 수준으로 진행합니다.
- 실습 순서(nomcp 다음 mcp)를 지킵니다.
- `submissions/<ID>` 밖의 파일을 고치지 않습니다. setup 명령이 실습 워크스페이스에 쓴 `TASK.md`, 작업 범위 지침 파일, MCP 연결 설정 같은 도구 설정도 고치거나 지우지 않습니다.
- AI 에게 `TASK.md` 밖의 자료(다른 프로젝트의 코드, 예제, 설계 문서 등)를 붙여 넣거나 첨부하지 않습니다.
- 실습 동안 AI 도구의 개인 설정을 꺼 둡니다([1.4 개인 설정 끄기](#14-개인-설정-끄기)).

## 5. 문제 해결

명령은 결과를 `[완료]`, `[주의]`, `[오류]` 머리표로 알립니다. setup 과 submit 명령은 `[오류]` 가 나오면 그 자리에서 멈추므로, 안내에 따라 해결한 뒤 같은 명령을 다시 실행합니다. check 명령은 `[오류]` 가 나와도 끝까지 점검한 뒤, 마지막의 점검 결과에 해결해야 할 항목을 모아 보여 줍니다. 해결하기 어려우면 진행자에게 알립니다.

아래 해결 방법 가운데에는 setup 명령을 다시 실행하는 방법이 있습니다. 아직 제출하지 않은 실습에서 setup 명령을 다시 실행하면 그 실습의 준비 시각이 새로 기록되어, 걸린 시간이 다시 실행한 때부터 계산됩니다. 그러므로 작업 중에 setup 명령을 다시 실행했다면 처음 시작한 시각을 진행자에게 알립니다.

### 준비 단계 (check, setup)

**PowerShell 에서 `npm` 이나 `codex` 같은 명령을 실행하면 `npm.ps1`(또는 `codex.ps1`) 파일을 로드할 수 없다는 오류가 나옵니다.**
PowerShell 의 실행 정책이 npm 으로 설치한 명령의 `.ps1` 파일을 막아서 생기는 오류입니다. 명령 이름 뒤에 `.cmd` 를 붙여 실행합니다(예: `npm.cmd run check`, `codex.cmd`).

**`도구와 ID 를 구분할 수 없습니다` 또는 `어느 값이 --id 인지 알 수 없습니다` 가 나옵니다.**
참가자 ID 가 도구 이름이나 실습 이름과 비슷할 때 생깁니다. `--` 를 넣은 형태(`npm run setup -- --test nomcp --id P01 --tool Claude-Code`)로 다시 실행합니다.

**`git 으로 clone 한 저장소의 루트가 아닙니다` 가 나옵니다.**
ZIP 으로 받은 폴더나 다른 폴더에서 명령을 실행한 경우입니다. [1.2 GitHub 로그인과 Fork](#12-github-로그인과-fork)의 방법으로 clone 한 저장소 폴더에서 실행합니다.

**`submit/P01 브랜치로 바꾸지 못했습니다` 가 나옵니다.**
커밋하지 않은 변경이 있어 브랜치를 전환할 수 없는 경우입니다. `git status` 로 바뀐 파일을 확인하고, 필요한 변경은 커밋하고 필요 없는 변경은 되돌린 뒤 다시 실행합니다.

**`실습 순서는 nomcp 다음 mcp 입니다` 또는 `nomcp 실습을 아직 제출하지 않았습니다` 가 나옵니다.**
mcp 실습은 nomcp 실습을 제출한 뒤에만 준비할 수 있습니다. nomcp 작업을 `npm run submit` 으로 먼저 제출합니다.

**`전역 설정에 eGovFrame 코드 생성 MCP 서버가 켜져 있습니다` 가 나오고 nomcp 준비가 멈춥니다.**
도구의 전역 설정에 `egovframe-codegen` 서버가 켜져 있어 MCP 없이 진행할 수 없는 상태입니다. 출력에 나온 제거 방법(예: `codex mcp remove egovframe-codegen`, `claude mcp remove egovframe-codegen -s user`)을 실행한 뒤 같은 setup 명령을 다시 실행합니다. Cursor 와 GitHub Copilot(VS Code)은 화면에서 끄는 것만으로는 풀리지 않을 수 있으므로, 출력에 나온 파일에서 그 항목을 지웁니다. `npm run check` 도 이런 서버를 `[주의]` 로 미리 알려 주므로, 실습에 쓰는 도구의 서버라면 같은 방법으로 교육 전에 지웁니다.

**`MCP 서버가 켜져 있습니다` 또는 `자동으로 읽을 수 있는 지침 파일이 있습니다` 라는 주의가 나옵니다.**
개인 MCP 서버나 지침 파일이 실습에 섞일 수 있다는 뜻입니다. 지침 파일은 전역 지침 파일(예: `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`)과, 저장소 폴더의 상위 폴더(홈 폴더 포함)에 있는 `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.mcp.json`, `.agents/`, `.claude/CLAUDE.md`, `.claude/rules/` 를 가리킵니다. 실습 동안 이 파일의 이름을 바꾸거나 다른 곳으로 옮기고, 개인 MCP 서버는 도구 문서에 따라 끕니다. Cursor 와 GitHub Copilot(VS Code)은 화면에서 끄기만 하면 설정 파일에 서버가 남아 주의가 계속 나올 수 있으므로, 도구 문서에 따라 파일에서 서버 항목을 지웁니다. 이 주의는 참가자 기록에도 남습니다.

**`Node.js ... 에서는 codegen MCP 서버를 실행할 수 없습니다` 가 나옵니다.**
Node.js 가 18 보다 낮은 경우입니다. Node.js 22 를 설치하고 터미널을 다시 연 뒤 실행합니다.

**`Maven 로컬 저장소(~/.m2)에 eGovFrame Boot 라이브러리가 없어` 라는 주의가 나옵니다.**
Maven 의존성을 아직 내려받지 않아 첫 빌드가 느릴 수 있다는 뜻입니다. 교육 전에 `npm run check` 를 실행해 둡니다.

**`Maven 4 는 쓰지 않습니다` 또는 `Maven 이 쓰는 JDK 는 ... 입니다` 라는 주의가 나옵니다.**
Maven 4 가 설치되어 있으면 [1.1 운영체제별 설치](#11-운영체제별-설치)에 따라 Maven 3.9.9 를 설치하고, PATH 에서 Maven 3.9.9 의 `bin` 폴더가 다른 Maven 보다 앞에 오게 합니다. Maven 이 JDK 17 이 아닌 JDK 로 실행된다는 주의가 나오면 `JAVA_HOME` 을 JDK 17 폴더로 정합니다. 두 경우 모두 터미널을 새로 연 뒤 `mvn -version` 으로 다시 확인합니다.

**`npm run check` 에서 `예열용 프로젝트 빌드에 실패했습니다` 가 나옵니다.**
인터넷 연결, 프록시, Maven 설정(`~/.m2/settings.xml`)을 확인합니다. `mvn -version` 출력의 `Java version` 이 17 인지 확인하고, 아니면 `JAVA_HOME` 을 JDK 17 폴더로 정합니다.

### 작업 단계 (AI 도구)

**mcp 실습인데 AI 도구에 `egovframe-codegen` 서버가 보이지 않습니다.**
AI 도구로 연 폴더가 `submissions/<ID>/mcp` 인지 확인합니다. 처음 열 때 나온 폴더 신뢰나 MCP 서버 사용 확인을 허용했는지도 확인합니다. MCP 연결 설정에는 setup 명령을 실행한 Node.js 와 저장소 폴더의 절대 경로가 들어 있습니다. 그래서 Node.js 를 다시 설치했거나 저장소 폴더를 옮겼다면 mcp setup 명령을 다시 실행합니다. 작업 중에 다시 실행하면 걸린 시간이 다시 계산되므로, 처음 시작한 시각을 진행자에게 알립니다. 그 밖의 확인 방법은 도구 문서의 '문제 해결' 절에 있습니다.

**nomcp 실습인데 `egovframe-codegen` 서버가 보입니다.**
작업을 멈추고 진행자에게 알립니다. 대개 도구의 전역 설정에 서버가 남아 있는 경우이므로, 도구 문서의 '개인 설정 끄기' 절에 따라 전역 설정에서 서버를 끄거나 지운 뒤 nomcp setup 명령을 다시 실행합니다. 이때 걸린 시간이 다시 계산되므로, 처음 시작한 시각도 진행자에게 함께 알립니다.

### 제출 단계 (submit)

**`제출 브랜치(submit/참가자ID)가 아닙니다` 가 나옵니다.**
다른 브랜치로 전환된 상태입니다. 출력에 나온 명령(예: `git switch submit/P01`)으로 제출 브랜치로 돌아간 뒤 `npm run submit` 을 다시 실행합니다.

**`실습 워크스페이스 안에 별도의 git 저장소가 있어` 라는 오류가 나옵니다.**
실습 워크스페이스 안의 폴더(예: `board-app`)에서 `git init` 이 실행되어 별도의 git 저장소가 생긴 경우입니다. 이대로 제출하면 그 폴더가 파일 없이 빈 링크로만 올라갑니다. 출력에 나온 명령을 그대로 실행한 뒤 `npm run submit` 을 다시 실행합니다. macOS 는 `rm -rf "<폴더>/.git"`, Windows 는 `Remove-Item -Recurse -Force "<폴더>\.git"` 형태의 명령이며, 경우에 따라 `git -C "<저장소 폴더>" rm --cached -f -q -- "<폴더>"` 도 함께 나옵니다. 이 명령은 그 폴더의 git 기록(`.git`)만 지우고 작업한 파일은 그대로 둡니다.

**`제출 범위(...) 밖에서 바뀐 파일은 제출되지 않습니다` 라는 주의가 나옵니다.**
실습 워크스페이스와 `participant.json` 밖에서 바뀐 파일이 있다는 뜻입니다. 이 파일들은 제출되지 않습니다. 다른 실습 워크스페이스의 변경도 이번 제출에 넣지 않습니다.

**`20MB 를 넘는 파일` 이 제출에서 빠졌다는 주의가 나옵니다.**
20MB 를 넘는 파일은 자동으로 `.git/info/exclude` 에 적혀 제출에서 빠집니다. 따로 할 일은 없습니다.

**`이 PC 의 git 무시 설정(...) 때문에 실습 워크스페이스의 다음 파일은 제출되지 않습니다` 라는 주의가 나옵니다.**
이 PC 의 git 전역 제외 파일(`core.excludesFile`)이나 `.git/info/exclude` 에 직접 적은 규칙이 실습 워크스페이스의 파일을 제외하고 있다는 뜻입니다. 제출은 그대로 진행되지만 나온 파일은 제출에 들어가지 않습니다. 그 파일도 제출해야 하면 괄호 안의 파일에서 해당 줄을 지우거나 고친 뒤 `npm run submit` 을 다시 실행합니다.

**`제한 시간 ...분을 넘었습니다` 라는 주의가 나옵니다.**
걸린 시간이 제한 시간보다 길다는 뜻입니다. 기록만 남고 제출은 그대로 진행됩니다.

**`origin 에 push 하지 못했습니다` 가 나옵니다.**
`gh auth login` 으로 로그인하고 `gh auth setup-git` 을 한 번 실행한 뒤 다시 제출합니다. 인터넷 연결과 프록시 설정도 확인합니다. 커밋은 PC 에 남아 있으므로 다시 실행하면 이어서 push 합니다. 원격 브랜치에 PC 에 없는 커밋이 있어 push 가 거부되었다는 안내가 나오면 진행자에게 알립니다.

**`Fork 를 만들거나 origin 을 Fork 로 바꾸지 못했습니다` 가 나옵니다.**
원본 저장소를 직접 clone 한 경우 submit 명령은 본인 계정에 Fork 를 만들어 `origin` 을 Fork 로 바꿉니다. 이 과정이 실패한 경우이므로, gh 가 설치되어 있는지와 `gh auth login` 으로 로그인했는지 확인한 뒤 다시 실행합니다.

**PR 이 자동으로 만들어지지 않고 `PR 만들기 주소` 가 나옵니다.**
gh 를 찾지 못했거나 PR 을 만드는 데 실패한 경우입니다. 출력의 `PR 만들기 주소` 를 브라우저에서 열고 `Create pull request` 를 눌러 PR 을 만듭니다. 주소에 `<GitHub계정>` 이 있으면 본인의 GitHub 계정 이름으로 바꿉니다.

**`바뀐 것이 없어 새 커밋을 만들지 않습니다` 가 나옵니다.**
이미 제출한 뒤로 실습 워크스페이스에 바뀐 파일이 없다는 뜻입니다. submit 명령은 앞서 만든 커밋을 다시 push 하고 PR 을 확인합니다.

## 6. 실습 후

- 제출한 PR 은 닫지 않고 그대로 둡니다.
- Cline 을 썼다면 다음 명령으로 setup 명령이 Cline 전역 설정에 넣은 `egovframe-codegen` 항목을 setup 이전 상태로 되돌릴 수 있습니다. 이 단계는 선택이지만, 저장소 폴더를 지울 생각이라면 지우기 전에 이 명령을 먼저 실행합니다. 저장소 폴더를 먼저 지우면 Cline 전역 설정에 지운 폴더를 가리키는 항목이 남습니다. 다른 도구는 setup 명령이 전역 설정을 바꾸지 않으므로 되돌릴 것이 없습니다.

  ```bash
  npm run cleanup
  ```

- 실습 동안 꺼 둔 개인 설정(전역 지침 파일, 개인 MCP 서버 등)을 다시 켭니다.
- Cline 에 넣은 OpenRouter API Key 는 지웁니다.

## 7. 저장소 구성

| 경로 | 내용 |
|---|---|
| `scripts/` | `npm run check`, `npm run setup`, `npm run submit`, `npm run cleanup` 명령의 스크립트 |
| `docs/` | 도구별 설정 문서 (`setup-<도구>.md`) |
| `task/` | 과제 원본 (`TASK.md`) |
| `mcp/` | MCP 서버 묶음 파일. check 와 setup 명령이 여기서 `egovframe-codegen` 서버를 설치합니다 |
| `submissions/` | 제출 폴더. setup 명령이 `submissions/<ID>/` 아래에 실습 워크스페이스를 만듭니다 |
| `test/` | 스크립트 시험 코드 (`npm test`) |
