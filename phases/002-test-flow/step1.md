# Step 1: harness 새 흐름 검증

## Context
새 harness 시스템 (Claude 직접 처리 방식)이 올바르게 작동하는지 확인한다.

## Acceptance Criteria
- [ ] `npm test` 가 exit 0으로 완료된다
- [ ] `npm run build` 가 exit 0으로 완료된다
- [ ] `phases/002-test-flow/step1.result.json` 을 올바른 스키마로 작성한다

## Scope
- 읽기 전용 — 소스 파일 수정 없음

## Out of Scope
- 소스 코드 수정
