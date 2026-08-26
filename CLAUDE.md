# 프로젝트: DayStory

> "오늘 하루의 역사 한 조각"과 "내가 쓴 일기"를 카드 형식으로 모아 보여주는 한국어 모바일 앱.
> 웹(Vite)과 iOS/Android(Capacitor)를 단일 코드베이스로 운영한다.

---

## 1. 프로젝트 개요 및 타겟 환경

- **앱 이름:** DayStory (매일 만나는 역사 일화 카드 앱)
- **코어 목표:** 사용자가 매일 새로운 역사 일화 카드를 스와이프하여 읽고, 감동적인 카드를 이미지로 캡처해 소셜 미디어(인스타그램 스토리, 카카오톡 등)에 공유할 수 있도록 지원.

### 🚨 타겟 환경 우선순위 (CRITICAL)

- **iOS / Android 앱 = 최우선 메인 서비스 환경.** 모든 UI/UX, 애니메이션(스와이프), 성능 최적화, 네이티브 공유 및 캡처 기능은 모바일 기기에 100% 맞춰져야 한다.
- **Web 버전 = 개발자 디버깅 및 관리자 콘텐츠 작성용 백오피스.** 일반 사용자를 위한 반응형 레이아웃·크로스 브라우징·웹 기반 공유 호환성에 시간을 낭비하지 않는다. **무조건 앱 중심(App-Only)으로 개발한다.**

---

## 2. 기술 스택

- **Frontend:** Vanilla JavaScript (ESM, 빌드 외 프레임워크 없음)
- **Build Tool:** Vite 8 (개발/번들)
- **Native Wrapper:** Capacitor 8 (iOS/Android, 위젯, 로컬 알림, 햅틱, Share)
- **Backend:** Firebase 10 (Auth / Firestore / Storage)
- **Testing:** Vitest 4 + jsdom
- **Animation:** GSAP (카드 플립), browser-image-compression, CropperJS, Swiper
- **Core Native Plugins:**
  - `@capacitor/filesystem`: 기기 임시 폴더(`Directory.Cache`)에 캡처 이미지 저장
  - `@capacitor/share`: 네이티브 공유 시트(Share Sheet) 호출
  - `html2canvas`: 특정 HTML 영역을 Canvas 이미지로 변환

---

## 3. 아키텍처 규칙

- **CRITICAL**: Firestore / Storage 접근은 반드시 `src/js/services/*` 를 통해서만 한다. 페이지(`src/js/pages/*`)에서 Firebase SDK를 직접 호출하지 마라. 이유: 게스트 폴백·5초 타임아웃·캐싱 정책이 service 레이어에 모여 있다.
- **CRITICAL**: 사용자 입력 텍스트(닉네임, 일기 제목/본문, 검색어)는 DOM에 삽입하기 전 반드시 `src/js/utils/sanitize.js` 를 통과시킨다. `innerHTML` 직접 조립 금지. 이유: XSS 방어선이 한 곳뿐이다.
- **CRITICAL**: 페이지가 `window` / `document` / Capacitor 이벤트 리스너를 등록했다면 `src/js/router.js`의 `setOnUnmount(fn)` 으로 정리 함수를 등록한다. 이유: SPA 특성상 떠난 페이지의 리스너가 누적되면 메모리 누수와 잘못된 핸들러 호출이 발생한다.
- **CRITICAL**: 확인/삭제 등 UX 모달에서 브라우저 `confirm()` / `alert()` 사용 금지. `src/js/components/confirmDialog.js` 의 자체 모달을 사용한다. 이유: 모바일 웹뷰에서 `confirm()` 호출 시 라이프사이클이 깨진 사례가 있다.
- 컴포넌트는 `src/js/components/`, 페이지는 `src/js/pages/`, 데이터/외부 SDK 래퍼는 `src/js/services/`, 순수 유틸은 `src/js/utils/` 에 둔다.
- CSS 토큰(색상, 간격, z-index 등)은 `src/css/variables.css` 에 정의된 `var(--*)` 만 사용한다. 페이지/컴포넌트 CSS에서 하드코딩 색상 금지.
- 테마는 `data-theme="dark"` / `data-font-size` 속성으로 토글된다. 컴포넌트는 두 테마 모두에서 동작해야 한다.
- 라우트 등록은 `src/js/router.js` 의 `registerRoute(path, handler)` 만 사용한다. handler는 `HTMLElement` 또는 HTML 문자열을 반환한다.

---

## 4. 코드 스타일

- **파일/함수 명명:** camelCase (예: `captureAndShareCard()`, `isPublic`)
- **Async Logic:** 네이티브 플러그인·Firebase 통신은 반드시 `async/await` + `try-catch`.
- **CSS:** `<style scoped>` 는 Vue 전용. 이 프로젝트는 Vanilla JS → CSS 파일을 분리하거나 `src/css/variables.css` 토큰만 인라인 참조.

---

## 5. 개발 프로세스

- **CRITICAL**: 새 기능 구현 시 `tests/*.spec.js` 에 Vitest UI 테스트를 먼저 작성하고, 통과시키는 구현을 작성한다 (TDD).
- 커밋 메시지는 conventional commits 형식 (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- 안드로이드에 영향을 주는 변경(`capacitor.config.json`, plugin 추가, `index.html` 메타 등) 후에는 `npx cap sync android` 를 한 번 실행한다.
- 새로운 외부 의존성 추가 전, 비슷한 일을 하는 기존 utility/service 가 있는지 먼저 찾는다 (vanilla 원칙).

---

## 6. 카드 이미지 캡처 및 공유 규칙

`captureAndShareCard()` (`src/js/services/sharing.js`) 는 **modern-screenshot(`domToPng`) 1차 + html2canvas 폴백** 구조다. 네이티브 기기에서의 레이아웃 무너짐·이미지 누락(백화 현상)을 방지하기 위해 아래 규칙을 반드시 준수한다.

1. **WYSIWYG 캡처 (픽셀 크기 강제 금지):** 캡처 대상(`.history-card-front`)에 픽셀 사이즈를 JS 로 주입하지 않는다. 실제 브라우저 엔진이 렌더한 화면 레이아웃을 그대로 캡처한다. 기기별 폰트 렌더링·Safe Area·OS 차이를 하드코딩 상수로 따라갈 수 없기 때문이다.
   - **따라서 화면에서 카드 레이아웃이 깨지면 공유 이미지도 똑같이 깨진다.** 카드 크기는 `src/js/utils/cardMetrics.js` 가 주입하는 `--card-w` / `--card-h` / `--card-scale` 이 결정하며, 카드 관련 CSS를 만질 때는 공유 캡처 결과도 함께 확인한다.
2. **CORS 및 네이티브 보안 우회:** Firebase Storage 등 외부 URL 이미지가 네이티브 웹뷰(`capacitor://`) 환경에서 차단되어 하얗게 날아가는 문제를 막기 위해:
   - 캡처 직전 `imageToBase64()`로 외부 이미지를 미리 Base64 Data URL로 교체한다 (네이티브 HTTP → canvas 순서로 시도, 8초 타임아웃).
   - html2canvas 폴백 경로는 `{ useCORS: true, allowTaint: true, scale: 2 }` 를 무조건 포함하고, `onclone` 내에서 `crossOrigin='anonymous'` + cache-bust를 2차로 적용한다.
   - **주의:** DOM `<img>` 태그에 `crossorigin="anonymous"`를 전역 추가하면 Firebase Storage CORS 미설정 origin(`capacitor://` 등)에서 이미지 로드 자체가 실패한다. 절대 `cardImageWrap` 마크업에 추가하지 말 것.
3. **워터마크 임시 주입:** 워터마크는 **복제본에만** 주입한다 (`onCloneNode` / `onclone`). 유저 화면의 DOM 은 건드리지 않는다. 기본 배치는 카드 **상단 액션 슬롯**(`.card-actions` 를 워터마크로 교체)이고, 우측 하단 절대배치는 폴백 경로다.
   - `inline-flex` + `align-items` 조합은 foreignObject/html2canvas 캡처에서 자식 텍스트의 `color` 가 무시되는 알려진 문제가 있다. `display:inline-block` + `line-height` 로 수직 정렬할 것.

---

## 7. 보안 규칙 및 UGC (App Store 출시 정책 대응)

- **Firestore 권한 분리:** 개인 데이터는 작성자 본인만(`request.auth.uid == resource.data.userId`), 공유 데이터는 공유 활성화 상태(`resource.data.isPublic == true`)를 확인하도록 규칙을 설계한다.
- **UGC 신고 기능 유지:** 애플 리젝 방지를 위해 사용자가 부적절한 글을 피드에서 발견했을 때 즉시 신고할 수 있는 기능을 구현하며, 신고 시 Firestore의 `reports` 컬렉션에 `postId`와 `reporterId`가 안전하게 기록되도록 로직을 유지한다.

---

## 8. Agent Harness

- Claude는 이 `CLAUDE.md`를, Codex는 `AGENTS.md`를 읽는다. Harness 규칙은 두 파일에서 동일하게 유지한다.
- 활성 harness step 밖에서 사용자가 자동 적용이나 harness 실행을 요청하면, 사용자에게 명령어 입력을 요구하지 말고 에이전트가 `npm run harness:auto`를 직접 실행한다.
- `npm run harness:auto`는 다음 pending phase를 찾고, dirty worktree를 snapshot commit으로 보존하며, step 지시사항을 stdout으로 출력한다. Claude는 이 출력을 읽고 직접 step을 처리한다.
- **harness step 실행 흐름:**
  1. `npm run harness:auto` 실행 → stdout으로 step 지시사항 출력
  2. Claude가 출력을 읽고 step을 직접 구현 (Explore/Plan/구현/검증)
  3. `phases/{phase}/step{N}.result.json` 작성
  4. `npm run harness:commit -- <phase> <stepN>` 실행 → index.json 업데이트 + 커밋
  5. SESSION_LOG.md append
- `npm run harness:auto` 실행 후 재귀 호출 금지. 환경변수 `DAYSTORY_HARNESS_ACTIVE=1`이 설정되면 harness를 다시 실행하지 않는다.
- 수동 실행이 필요하면 `npm run harness -- <phase-dir>`를 사용한다.
- `npm run harness:status` — 현재 phase 목록과 상태만 출력 (dry-run).

---

## 9. Conversation Autopilot

- English invariant for both agents: check for a pending harness phase first; do not wait for the user to type a command; If no pending phase exists, continue with the user request normally.
- 사용자가 "재개", "알아서 해줘", "계속해", "적용해", "구현해", "진행해", "fix it", "continue"처럼 자연어로 작업 진행을 요청하면, 먼저 pending harness phase가 있는지 확인한다.
- pending phase가 있으면 사용자에게 명령어 입력을 기다리지 말고 에이전트가 직접 `npm run harness:auto`를 실행한다.
- pending phase가 없으면 프로젝트 규칙에 따라 사용자의 요청을 일반 작업으로 바로 진행한다.
- 순수 질문, 설명, 리뷰, 계획만 요청한 경우에는 사용자가 적용이나 실행을 요청하지 않는 한 `npm run harness:auto`를 실행하지 않는다.
- 자동화를 준비하면서 사용자 작업을 삭제하거나 reset하지 않는다. dirty worktree는 harness snapshot commit 경로로 보존한다.

---

## 10. Session Log

- **CRITICAL**: AI가 이 세션에서 파일을 1개라도 변경했다면, 세션 종료 직전 `SESSION_LOG.md` 맨 아래에 한 항목을 **append** 한다 (Edit/Write 도구로). 형식·규칙·템플릿은 그 파일 상단을 참고.
- 항목 필수 필드: `날짜 시간 — 에이전트`, `요구사항`, `구현방법`, `변경파일`. 24시간제 로컬 시각.
- 기존 항목은 수정하지 않는다. 정정이 필요하면 새 항목을 추가한다.
- 순수 질문/설명/리뷰 세션(파일 변경 0개)은 기록하지 않는다.
- harness step 안에서는 step의 요구사항·구현·변경파일을 기준으로 항목을 작성한다.

---

## 11. Session Checkpoint (자동 GitHub 백업)

- **CRITICAL**: 세션이 끝날 때 모든 변경은 `scripts/session-checkpoint.sh` 로 자동 커밋·푸시되어 GitHub 에 백업되어야 한다.
- Claude Code: `.claude/settings.json` 의 Stop hook 이 자동으로 호출하므로 별도 호출 불필요.
- 그 외 (Codex CLI, Cursor 등): 세션 종료 직전 다음을 실행한다:
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

---

## 12. Claude Code Agent Instructions

- **Read Before Write:** 코드를 수정하기 전에 해당 파일의 전체 구조와 의존성을 먼저 철저히 분석하라.
- **No Overkill:** 한 번에 무관한 여러 파일을 대량으로 수정하지 말고, 지정된 컴포넌트나 공유 모듈에만 집중하여 작업하라.
- **Korean Communication:** 코드를 변경하기 전, 어떤 원인으로 인해 어떤 부분을 수정할 것인지 한글로 터미널에 요약하여 먼저 보고하라.

---

## 명령어

- `npm run dev` — Vite 개발 서버
- `npm run build` — 프로덕션 빌드 (`dist/`)
- `npm run preview` — 빌드 결과 미리보기
- `npm test` — Vitest 1회 실행 (jsdom 환경)
- `npx cap sync android` — Capacitor 안드로이드 동기화
- `npx cap sync ios` — Capacitor iOS 동기화
- `npm run harness:auto` — pending phase 자동 실행 (step 지시사항 stdout 출력 → Claude 직접 처리)
- `npm run harness:status` — phase 목록과 상태 출력 (dry-run)
- `npm run harness:commit -- <phase> <stepN>` — step 완료 후 index.json 업데이트 + 커밋
- `npm run harness -- <phase-dir>` — 특정 phase 수동 실행
