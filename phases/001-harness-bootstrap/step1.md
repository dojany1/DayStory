# Step 1: Harness 파이프라인 검증

## Context
harness 시스템이 올바르게 설치됐는지 확인하는 첫 번째 step이다.
코드 변경 없이 프로젝트의 빌드·테스트 상태만 확인한다.

## Acceptance Criteria
- [ ] `npm run build` 가 exit 0으로 완료된다
- [ ] `npm test` 가 exit 0으로 완료된다 (실패하는 기존 테스트가 있다면 error_message에 기록)
- [ ] `phases/001-harness-bootstrap/step1.result.json` 을 올바른 스키마로 작성한다

## Scope
- 읽기 전용 — 소스 파일 수정 없음
- `phases/001-harness-bootstrap/step1.result.json` 만 생성

## Out of Scope
- 소스 코드 수정
- 테스트 추가/수정
- 다른 phase 실행

## Instructions
1. `npm run build` 실행 후 결과 기록
2. `npm test` 실행 후 결과 기록
3. 두 명령 모두 성공하면 status: "completed", 하나라도 실패하면 status: "error"
4. `phases/001-harness-bootstrap/step1.result.json` 작성

```json
{
  "status": "completed",
  "summary": "build OK, N tests passed",
  "error_message": null,
  "blocked_reason": null
}
```
