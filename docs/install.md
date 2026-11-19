# 운영체제별 설치

이 문서는 [README 의 1. 사전 준비](../README.md#1-사전-준비-교육-전날까지)에 있는 JDK, Maven, Node.js, Git, gh 를 운영체제별로 설치하는 방법의 예입니다. 이미 설치되어 있으면 [README 의 1.1 설치 확인](../README.md#11-설치-확인)에 따라 버전만 확인합니다. Node.js 는 nvm 으로 설치하며, 22 보다 높은 버전도 그대로 쓸 수 있습니다. Maven 은 3.9.9 를 권장하며, 3.9 이상인 3.x 버전이면 `npm run check` 점검을 통과합니다. 미리 보기 단계인 Maven 4 는 쓰지 않습니다. 설치하거나 환경 변수를 바꾼 뒤에는 터미널을 새로 열어야 바뀐 내용이 적용됩니다.

## Windows x64 와 Windows on Arm (ARM64)

명령은 PowerShell(Windows 터미널)에서 실행합니다. WSL(Linux 환경)은 지원 대상이 아니므로, 저장소 명령과 AI 도구를 모두 Windows 에서 실행합니다. Windows on Arm PC 에서는 각 프로그램의 ARM64 판을 설치합니다. Claude Code, Cursor, VS Code, Antigravity 는 Windows ARM64 를 지원합니다. Windows on Arm 에서 Codex 를 쓴다면 npm 으로 설치하는 방법(`npm install -g @openai/codex`)을 쓸 수 있으며, 이 패키지에는 Windows ARM64 용 실행 파일이 들어 있습니다. 설치한 뒤에는 PowerShell 에서 `codex --version` 이 실행되는지 미리 확인합니다. PowerShell 이 `codex.ps1` 파일을 로드할 수 없다고 하면 [문제 해결](troubleshooting.md)의 `npm.ps1` 항목과 같은 방법으로 해결합니다.

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
4. Node.js 22 를 nvm 으로 설치합니다. Windows 에서는 NVM for Windows 를 씁니다. [NVM for Windows 릴리스 페이지](https://github.com/nvm-windows/nvm/releases/latest)에서 x64 PC 는 `nvm-<버전>-x64-setup.exe` 를, ARM64 PC 는 `nvm-<버전>-arm64-setup.exe` 를 받아 실행합니다. 설치 파일은 관리자 권한으로 실행하지 않습니다. Node.js 공식 설치 파일로 설치한 Node.js 가 이미 있으면 설치 마법사가 그 Node.js 를 가져올지(Adopt) 지울지(Drop) 묻는데, 어느 쪽을 골라도 됩니다. 설치를 마치면 새 PowerShell 창에서 다음 명령을 실행합니다. `nvm use` 로 고른 버전이 새 터미널의 기본 버전이 됩니다.
   ```powershell
    nvm install 22
    nvm use 22
    node --version
   ```

    ARM64 PC 에서는 `node -p process.arch` 가 `arm64` 를 보여 주는지도 확인합니다. `x64` 가 나와도 Windows 의 x64 에뮬레이션으로 동작하므로 실습에는 지장이 없습니다.
5. Git 과 gh 를 설치합니다. winget 을 쓰거나 [Git 다운로드 페이지](https://git-scm.com/install/windows)와 [GitHub CLI 페이지](https://cli.github.com)에서 설치 파일을 받습니다. ARM64 PC 용 설치 파일은 Git 의 `Git-<버전>-arm64.exe` 와 gh 의 `gh_<버전>_windows_arm64.msi` 입니다.
   ```powershell
    winget install --id Git.Git -e --source winget
    winget install --id GitHub.cli
   ```
6. 새 PowerShell 창에서 [README 의 1.1 설치 확인](../README.md#11-설치-확인)의 확인 명령을 실행합니다. `mvn -version` 출력의 `Java version` 이 17 인지도 확인합니다.

## macOS (Apple silicon 과 Intel)

명령은 터미널(zsh)에서 실행합니다. bash 를 쓰고 있다면 아래 명령의 `~/.zshrc` 를 `~/.bash_profile` 로 바꿉니다. 이미 다른 방법(SDKMAN 등)으로 설치했다면 그대로 써도 되며, [README 의 1.1 설치 확인](../README.md#11-설치-확인)의 확인 명령이 맞는 버전을 보여 주면 됩니다.

**Apple silicon: Homebrew 로 설치합니다.** [Homebrew](https://brew.sh) 가 없으면 먼저 설치합니다.

```bash
brew install openjdk@17 maven git gh
```

Homebrew 는 `openjdk@17` 을 PATH 에 자동으로 넣지 않습니다. 또한 Homebrew 의 `maven` 은 `JAVA_HOME` 이 없으면 Homebrew 의 최신 JDK 로 실행됩니다. 그래서 다음 명령으로 `JAVA_HOME` 을 JDK 17 로 정하고 PATH 에 JDK 17 의 `bin` 폴더를 넣습니다. Node.js 는 아래의 nvm 으로 설치합니다. Homebrew 의 `maven` 은 3.9 보다 높은 3.x 버전(예: 3.10.0)일 수 있으며, `npm run check` 를 통과하면 그대로 씁니다.

```bash
echo 'export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"' >> ~/.zshrc
echo 'export PATH="$JAVA_HOME/bin:$PATH"' >> ~/.zshrc
```

**Intel: 공식 설치 파일로 설치합니다.** Homebrew 는 Intel Mac 용 새 바이너리를 더 만들지 않아, Intel Mac 에서는 설치할 때 소스에서 빌드하느라 오래 걸리거나 실패할 수 있습니다. Apple silicon 에서도 이 방법을 쓸 수 있습니다.

1. JDK 17 을 설치합니다. [Microsoft Build of OpenJDK 다운로드 페이지](https://learn.microsoft.com/ko-kr/java/openjdk/download)에서 OpenJDK 17 의 macOS `pkg` 파일을 받습니다. Intel 은 `macos-x64` 파일을, Apple silicon 은 `macos-aarch64` 파일을 받습니다.
2. Git 을 설치합니다. 터미널에서 `xcode-select --install` 을 실행해 Command Line Tools 를 설치하면 git 이 함께 설치됩니다.
3. gh 를 설치합니다. [GitHub CLI 페이지](https://cli.github.com)에서 macOS 설치 파일(`gh_<버전>_macOS_universal.pkg`)을 받습니다.
4. 다음 명령으로 Maven 3.9.9 를 홈 폴더의 `tools` 폴더에 풀고, `JAVA_HOME` 과 PATH 를 정합니다.
   ```bash
    mkdir -p ~/tools
    curl -fL https://archive.apache.org/dist/maven/maven-3/3.9.9/binaries/apache-maven-3.9.9-bin.tar.gz | tar -xzf - -C ~/tools
    echo 'export JAVA_HOME="$(/usr/libexec/java_home -v 17)"' >> ~/.zshrc
    echo 'export PATH="$JAVA_HOME/bin:$HOME/tools/apache-maven-3.9.9/bin:$PATH"' >> ~/.zshrc
   ```

**Node.js: nvm 으로 설치합니다(Apple silicon 과 Intel 공통).** nvm 설치 스크립트는 Command Line Tools 가 있어야 동작하므로 위의 설치를 먼저 마칩니다. Apple silicon 에서는 Homebrew 를 설치할 때 Command Line Tools 가 함께 설치됩니다. nvm 은 `~/.zshrc` 에 설정을 더하므로, 이 파일이 없을 때를 대비해 먼저 만들어 둡니다.

```bash
touch ~/.zshrc
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.41.0/install.sh | bash
```

새 터미널을 열고 다음 명령으로 Node.js 22 를 설치합니다. `nvm alias default 22` 는 새 터미널에서 기본으로 쓸 버전을 정합니다. `nvm` 명령을 찾지 못하면 터미널을 다시 열고 `command -v nvm` 으로 확인합니다.

```bash
nvm install 22
nvm alias default 22
```

설치를 마치면 새 터미널에서 [README 의 1.1 설치 확인](../README.md#11-설치-확인)의 확인 명령을 실행합니다. `mvn -version` 출력의 `Java version` 이 17 인지도 확인합니다. AI 도구는 `node` 로 MCP 서버를 띄우므로, Node.js 를 설치한 뒤에는 열려 있던 AI 도구도 다시 시작합니다.
