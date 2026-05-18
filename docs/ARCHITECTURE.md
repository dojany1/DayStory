# 아키텍처

## 디렉토리 구조
```
DayStory-test/
├── index.html              # SPA 진입점 (스플래시, app-container, bottom-nav, page-container)
├── src/
│   ├── main.js             # 라우터 등록 + Firebase 초기화 + 테마/리스너 부팅
│   ├── js/
│   │   ├── router.js       # hash 기반 SPA 라우터, beforeNavigate / setOnUnmount 훅
│   │   ├── state.js        # 전역 상태 (Pub/Sub) + 테마 적용 + localStorage 영속화
│   │   ├── firebase.js     # Firebase 초기화, Auth observer, 5초 타임아웃 게스트 폴백
│   │   ├── pages/          # 라우트별 화면 (1 파일 = 1 화면)
│   │   │   editorstory.js  ·  mystory.js  ·  calendar.js  ·  bookmarks.js
│   │   │   profile.js      ·  settings.js ·  editor.js    ·  detail.js
│   │   │   login.js        ·  search.js   ·  donate.js    ·  report.js
│   │   │   license.js
│   │   ├── components/     # 재사용 UI 조각
│   │   │   confirmDialog.js · notificationSettingsSheet.js
│   │   │   settingsSections.js · toast.js · widgetThemePreview.js
│   │   ├── services/       # 외부 데이터/SDK 래퍼 (페이지가 직접 SDK를 부르지 않도록 차단)
│   │   │   stories.js · mystories.js · bookmarks.js · images.js · notifications.js · widget.js
│   │   ├── utils/
│   │   │   date.js · sanitize.js · imageLoading.js · imageFields.js
│   │   └── config/         # 환경 상수
│   └── css/
│       variables.css       # 디자인 토큰 (색상/폰트/간격/z-index/모바일 폭 430px)
│       base.css            # 리셋, 모바일 래퍼, 스플래시, 하단 탭, 토스트
│       components.css      # 컴포넌트 클래스
│       pages.css           # 페이지별 스타일
├── android/                # Capacitor 안드로이드 프로젝트
│   └── app/src/main/java/com/daystory/app/widget/   # 홈 화면 위젯 (DayStoryWidget)
├── tests/                  # Vitest UI 스펙 (jsdom)
│   calendar.ui.spec.js · detail_nav.ui.spec.js · editorstory.ui.spec.js
│   notifications.ui.spec.js · regression.bugs.spec.js · widget.static.spec.js
├── public/                 # 정적 자산 (아이콘, manifest 등)
├── assets/ · fonts/        # 빌드에 포함되는 자산
├── capacitor.config.json   # 앱 ID, 웹 빌드 디렉토리, 플러그인 설정
├── firebase.json           # Hosting / Firestore 룰
└── docs/                   # 본 하네스 문서 (PRD/ARCHITECTURE/ADR/UI_GUIDE)
```

## 패턴
- **SPA 라우팅**: `#/path` 해시 기반. `registerRoute(path, handler)` 으로 등록하고 handler 는 `HTMLElement` 또는 HTML 문자열을 반환한다. 동적 세그먼트는 `:id` 형태 (예: `/detail/:id`).
- **페이지 라이프사이클**: handler 내부에서 진입 시 데이터 로드와 리스너 부착을 하고, 떠날 때 정리할 게 있으면 `setOnUnmount(() => { ... })` 으로 등록한다. 라우터가 다음 페이지로 가기 직전 1회 호출 후 자동 해제한다.
- **인증 가드**: `setBeforeNavigate((path) => boolean)` 으로 라우트 진입을 차단한다. false 반환 시 이동 취소.
- **컴포넌트 = 함수**: 클래스/인스턴스 없음. 함수가 DOM 노드를 만들어 반환하고, 자체 리스너를 부착한다. 모달은 `open()` / `close()` 메서드를 노출한다 (예: `confirmDialog`).
- **서비스 = 데이터 게이트웨이**: 페이지는 service 함수를 호출하고 데이터를 받는다. service 내부에서만 Firestore SDK·localStorage·5초 타임아웃·게스트 분기를 다룬다.

## 데이터 흐름
```
사용자 입력
  └─▶ 페이지 모듈 (이벤트 핸들러)
        └─▶ utils/sanitize.js   ← 텍스트는 반드시 통과
              └─▶ services/*.js  (Firestore / Storage / localStorage)
                    └─▶ state.setState(key, value)
                          └─▶ subscribe 된 페이지 콜백 → DOM 재렌더
```

특수 흐름:
- **인증 시작**: `firebase.js` 가 `onAuthStateChanged` 등록 + 5초 setTimeout. 5초 안에 응답이 없으면 강제 게스트 모드로 전환해서 무한 로딩 방지.
- **게스트 → 로그인 유도**: 북마크/공유/일기쓰기 버튼 클릭 시 `state.user` 가 null 이면 토스트 안내 후 `navigate('/login')`.
- **사진 업로드**: 파일 선택 → MIME/크기 사전 검사(이미지 + 10MB 이하) → CropperJS 모달 → browser-image-compression 으로 WebP 표시 이미지 압축 + 4:5 WebP 썸네일 생성 → Storage 업로드 → `image_url`/`image_thumb_url` 을 폼에 주입. 사용자가 URL을 직접 수정하면 기존 썸네일 URL은 재사용하지 않는다.

## 상태 관리
- 단일 `state` 객체 (`src/js/state.js`) + Pub/Sub. 키 단위로 `subscribe(key, fn)` 한다.
- 영속화 대상은 `theme`, `fontSize`, `widgetTheme` 3가지. `setState` 가 자동으로 `localStorage` (`ds_*` 접두사)에 저장.
- 테마 적용은 `state.theme` 가 바뀌면 자동으로 `<html data-theme="...">` 속성 갱신. 시스템 테마 변경 (`prefers-color-scheme`) 도 실시간 감지.
- **로그인 사용자 객체 이중 참조 주의**: 현재 `state.user` 와 `firebase.auth.currentUser` 두 곳에서 참조 가능. 새 코드는 `state.user` 를 단일 진실 원천으로 사용한다 (TODO: 헬퍼로 묶기 — ADR-006 참조).
- 북마크: 로그인 시 `bookmarks` 컬렉션, 게스트 시 `localStorage('ds_bookmarks_guest')`. service 가 분기 처리한다.
