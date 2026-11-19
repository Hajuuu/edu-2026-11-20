# 실습 후

- 제출한 PR 은 닫지 않고 그대로 둡니다.
- Cline 을 썼다면 다음 명령으로 setup 명령이 Cline 전역 설정에 넣은 `egovframe-codegen` 항목을 setup 이전 상태로 되돌릴 수 있습니다. 이 단계는 선택이지만, 저장소 폴더를 지울 생각이라면 지우기 전에 이 명령을 먼저 실행합니다. 저장소 폴더를 먼저 지우면 Cline 전역 설정에 지운 폴더를 가리키는 항목이 남습니다. 다른 도구는 setup 명령이 전역 설정을 바꾸지 않으므로 되돌릴 것이 없습니다.
  ```bash
  npm run cleanup
  ```
- Cline 에 넣은 OpenRouter API Key 는 지웁니다.
- [README 의 1.2 절](../README.md#12-github-로그인과-fork)에서 만든 GitHub 토큰이 더 필요 없으면 <https://github.com/settings/tokens> 에서 지웁니다. 토큰을 지워도 이미 만든 PR 은 그대로 남습니다.
