# 과제

과제는 **전자정부 표준프레임워크(eGovFrame) 5.0 Boot 기반 게시판 프로젝트**를 만드는 것입니다. 자세한 요구 사항은 [task/TASK.md](../task/TASK.md)에 있으며, setup 명령이 이 파일을 실습 워크스페이스에 `TASK.md` 로 복사합니다. 게시판 테이블은 다음과 같습니다.

```sql
CREATE TABLE BOARD (
  BOARD_ID VARCHAR(20) NOT NULL,
  TITLE    VARCHAR(200) NOT NULL,
  CONTENT  VARCHAR(4000),
  WRITER   VARCHAR(50) NOT NULL,
  PRIMARY KEY (BOARD_ID)
);
```
