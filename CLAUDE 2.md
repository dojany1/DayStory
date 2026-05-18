# 프로젝트: DayStory

> "오늘 하루의 역사 한 조각"과 "내가 쓴 일기"를 카드 형식으로 모아 보여주는 한국어 모바일 앱.
> 웹(Vite)과 안드로이드(Capacitor)를 단일 코드베이스로 운영한다.

## 기술 스택

- Vanilla JavaScript (ESM, 빌드 외 프레임워크 없음)
- Vite 8 (개발/번들)
- Capacitor 8 (안드로이드 래퍼, 위젯, 로컬 알림, 햅틱, Share)
- Firebase 10 (Auth / Firestore / Storage)
- Vitest 4 + jsdom (테스트)
- GSAP (카드 플립 애니메이션), browser-image-compression, CropperJS

## 아키텍처 규칙

- **CRITICAL**: Firestore / Storage 접근은 반드시 `src/js/services/*` 를 통해서만 한다. 페이지(`src/js/pages/*`)에서 Firebase SDK를 직접 호출하지 마라. 이유: 게스트 폴백·5초 타임아웃·캐싱 정책이 service 레이어에 모여 있다.
- **CRITICAL**: 사용자 입력 텍스트(닉네임, 일기 제목/본문, 검색어)는 DOM에 삽입하기 전 반드시 `src/js/utils/sanitize.js` 를 통과시킨다. `innerHTML` 직접 조립 금지. 이유: XSS 방어선이 한 곳뿐이다.
- **CRITICAL**: 페이지가 `window` / `document` / Capacitor 이벤트 리스너를 등록했다면 `src/js/router.js`의 `setOnUnmount(fn)` 으로 정리 함수를 등록한다. 이유: SPA 특성상 떠난 페이지의 리스너가 누적되면 메모리 누수와 잘못된 핸들러 호출이 발생한다 (기능명세서에서 이미 1차 수정한 항목).
- **CRITICAL**: 확인/삭제 등 UX 모달에서 브라우저 `confirm()` / `alert()` 사용 금지. `src/js/components/confirmDialog.js` 의 자체 모달을 사용한다. 이유: 모바일 웹뷰에서 `confirm()` 호출 시 라이프사이클이 깨진 사례가 있다.
- 컴포넌트는 `src/js/components/`, 페이지는 `src/js/pages/`, 데이터/외부 SDK 래퍼는 `src/js/services/`, 순수 유틸은 `src/js/utils/` 에 둔다.
- CSS 토큰(색상, 간격, z-index 등)은 `src/css/variables.css` 에 정의된 `var(--*)` 만 사용한다. 페이지/컴포넌트 CSS에서 하드코딩 색상 금지.
- 테마는 `data-theme="dark"` / `data-font-size` 속성으로 토글된다. 컴포넌트는 두 테마 모두에서 동작해야 한다.
- 라우트 등록은 `src/js/router.js` 의 `registerRoute(path, handler)` 만 사용한다. handler는 `HTMLElement` 또는 HTML 문자열을 반환한다.

## 개발 프로세스

- **CRITICAL**: 새 기능 구현 시 `tests/*.spec.js` 에 Vitest UI 테스트를 먼저 작성하고, 통과시키는 구현을 작성한다 (TDD).
- 커밋 메시지는 conventional commits 형식 (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- 안드로이드에 영향을 주는 변경(`capacitor.config.json`, plugin 추가, `index.html` 메타 등) 후에는 `npx cap sync android` 를 한 번 실행한다.
- 새로운 외부 의존성 추가 전, 비슷한 일을 하는 기존 utility/service 가 있는지 먼저 찾는다 (vanilla 원칙).

## Agent Harness

- Claude는 이 `CLAUDE.md`를, Codex는 `AGENTS.md`를 읽는다. Harness 규칙은 두 파일에서 동일하게 유지한다.
- 활성 harness step 밖에서 사용자가 자동 적용이나 harness 실행을 요청하면, 사용자에게 명령어 입력을 요구하지 말고 에이전트가 `npm run harness:auto`를 직접 실행한다.
- `npm run harness:auto`는 다음 pending phase를 찾고, dirty worktree를 snapshot commit으로 보존하며, step 지시사항을 stdout으로 출력한다. Claude는 이 출력을 읽고 직접 step을 처리한다.
- **harness step 실행 흐름:**
  1. `npm run harness:auto` 실행 → stdout으로 step 지시사항 출력
  2. Claude가 출력을 읽고 step을 직접 구현 (Explore/Plan/구현/검증)
  3. `phases/{phase}/step{N}.result.json` 작성
  4. `npm run harness:commit -- <phase> <stepN>` 실행 → index.json 업데이트 + 커밋
  5. docs/SESSION_LOG.md append
- `npm run harness:auto` 실행 후 재귀 호출 금지. 환경변수 `DAYSTORY_HARNESS_ACTIVE=1`이 설정되면 harness를 다시 실행하지 않는다.
- 수동 실행이 필요하면 `npm run harness -- <phase-dir>`를 사용한다.
- `npm run harness:status` — 현재 phase 목록과 상태만 출력 (dry-run).

## Conversation Autopilot

- English invariant for both agents: check for a pending harness phase first; do not wait for the user to type a command; If no pending phase exists, continue with the user request normally.
- 사용자가 "알아서 해줘", "계속해", "적용해", "구현해", "진행해", "fix it", "continue"처럼 자연어로 작업 진행을 요청하면, 먼저 pending harness phase가 있는지 확인한다.
- pending phase가 있으면 사용자에게 명령어 입력을 기다리지 말고 에이전트가 직접 `npm run harness:auto`를 실행한다.
- pending phase가 없으면 프로젝트 규칙에 따라 사용자의 요청을 일반 작업으로 바로 진행한다.
- 순수 질문, 설명, 리뷰, 계획만 요청한 경우에는 사용자가 적용이나 실행을 요청하지 않는 한 `npm run harness:auto`를 실행하지 않는다.
- 자동화를 준비하면서 사용자 작업을 삭제하거나 reset하지 않는다. dirty worktree는 harness snapshot commit 경로로 보존한다.

## Session Log

- **CRITICAL**: AI가 이 세션에서 파일을 1개라도 변경했다면, 세션 종료 직전 `docs/SESSION_LOG.md` 맨 아래에 한 항목을 **append** 한다 (Edit/Write 도구로). 형식·규칙·템플릿은 그 파일 상단을 참고.
- 항목 필수 필드: `날짜 시간 — 에이전트`, `요구사항`, `구현방법`, `변경파일`. 24시간제 로컬 시각.
- 기존 항목은 수정하지 않는다. 정정이 필요하면 새 항목을 추가한다.
- 순수 질문/설명/리뷰 세션(파일 변경 0개)은 기록하지 않는다.
- harness step 안에서는 step의 요구사항·구현·변경파일을 기준으로 항목을 작성한다.

## Session Checkpoint (자동 GitHub 백업)

- **CRITICAL**: 세션이 끝날 때 모든 변경은 `scripts/session-checkpoint.sh` 로 자동 커밋·푸시되어 GitHub 에 백업되어야 한다. Antigravity 같은 외부 에이전트가 작업물을 망가뜨려도 origin 에 안전망이 남는다.
- Claude Code: `.claude/settings.json` 의 Stop hook 이 자동으로 호출하므로 별도 호출 불필요.
- 그 외 (Codex CLI, Cursor 등): 세션 종료 직전 (SESSION_LOG.md append 직후) 다음을 실행한다:
  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/session-checkpoint.ps1
  ```
- Bash 환경에서는 `bash scripts/session-checkpoint.sh` 를 대신 사용할 수 있다.
- 스크립트 동작:
  - 변경 없음 → no-op
  - main / master 브랜치이면 `session-checkpoint` 브랜치로 자동 전환 (메인 라인 보호)
  - `chore: auto session checkpoint YYYY-MM-DD HH:MM` 메시지로 commit
  - origin 에 push (처음이면 `--set-upstream`). 실패해도 로컬 커밋은 보존
- `.env`, `node_modules`, `dist` 등 `.gitignore` 등록 항목은 자동 제외되므로 비밀 키 누출 위험 없음.
- 절대 force push 안 함. 절대 main/master 직접 커밋 안 함.

## 명령어

- `npm run dev` — Vite 개발 서버
- `npm run build` — 프로덕션 빌드 (`dist/`)
- `npm run harness:auto` — pending phase 자동 실행 (step 지시사항 stdout 출력 → Claude 직접 처리)
- `npm run harness:status` — phase 목록과 상태 출력 (dry-run)
- `npm run harness:commit -- <phase> <stepN>` — step 완료 후 index.json 업데이트 + 커밋
- `npm run harness -- <phase-dir>` — 특정 phase 수동 실행
- `npm run preview` — 빌드 결과 미리보기
- `npm test` — Vitest 1회 실행 (jsdom 환경)
- `npx cap sync android` — Capacitor 안드로이드 동기화
