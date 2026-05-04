# UI 디자인 가이드

## 디자인 원칙
1. **카드가 주인공** — 모든 콘텐츠는 카드 1장으로 환원된다. 카드가 화면 중앙을 차지하고, 그 주변엔 휠 피커·하단 탭 외 장식이 없다.
2. **모바일 한 손 조작** — 데스크톱에서도 모바일 폭 `430px` 으로 고정. 주요 액션(중앙 ➕ 쓰기 버튼, 좌우 스와이프, 탭 플립)은 엄지손가락 영역 안에 둔다.
3. **차분함** — 그라데이션·네온·유리 효과 없이 무채색 + 시맨틱 색상 1세트로 충분하다. 콘텐츠(역사/일기 텍스트와 사진)가 시선을 가져가야 한다.

## AI 슬롭 안티패턴 — 하지 마라
| 금지 사항 | 이유 |
|-----------|------|
| `backdrop-filter: blur()` 남용 | glass morphism 은 AI 템플릿의 가장 흔한 징후. 하단 탭 외엔 쓰지 않는다 |
| gradient text (배경 그라데이션 텍스트) | AI SaaS 랜딩의 1번 특징. DayStory 는 단색 텍스트만 |
| "AI 추천", "Powered by AI" 배지 | 기능이 아니라 장식. 사용자에게 가치 없음 |
| `box-shadow` 글로우 / 펄스 애니메이션 | 네온 글로우 = AI 슬롭. 그림자는 토큰 그림자만 |
| 보라/인디고 브랜드 색상 | "AI = 보라색" 클리셰. 강조색은 라이트=검정, 다크=흰색 고정 |
| 모든 카드에 `radius-xl` (20px) 일률 적용 | 균일한 큰 라운드는 템플릿 느낌. 카드 = `radius-md/lg`, 모달 시트만 `radius-xl` |
| 배경 gradient orb (`blur-3xl` 원형) | 모든 AI 랜딩 페이지의 장식. 페이지 배경은 `--color-bg-tertiary` 단색 |
| 무지개/형광 시맨틱 색상 | 시맨틱은 iOS 표준 톤(아래 표) 으로 고정 |

## 색상
모든 색상은 `src/css/variables.css` 의 토큰을 통해서만 사용한다. 하드코딩 금지.

### 배경
| 용도 | 토큰 | 라이트 | 다크 |
|------|------|--------|------|
| 데스크톱 외부 | `--color-bg-desktop` | #e8e8ed | #000000 |
| 모바일 래퍼 | `--color-bg-primary` | #f9f9fb | #1c1c1e |
| 페이지 컨테이너 | `--color-bg-tertiary` | (라이트는 primary 와 동일 톤) | #2a2a2b 계열 |
| 카드 | `--color-bg-card` | #ffffff | #303033 |
| 부유 요소(토스트/시트) | `--color-bg-elevated` | #ffffff | #1c1c1e |
| 오버레이 | `--color-bg-overlay` | rgba(0,0,0,.45) | rgba(0,0,0,.75) |

### 텍스트
| 용도 | 토큰 | 라이트 | 다크 |
|------|------|--------|------|
| 본문 (주) | `--color-text-primary` | #111111 | #f5f5f7 |
| 보조 | `--color-text-secondary` | #636366 | #aeaeb2 |
| 3차/비활성 | `--color-text-tertiary` | #8e8e93 | #636366 |
| 반전 (강조 위) | `--color-text-inverse` | #ffffff | #111111 |

### 강조 / 시맨틱
| 용도 | 토큰 | 라이트 | 다크 |
|------|------|--------|------|
| 강조 (1차 버튼/링크) | `--color-accent` | #000000 | #ffffff |
| 성공 | `--color-success` | #34c759 | (동일) |
| 경고 | `--color-warning` | #ff9f0a | (동일) |
| 오류 | `--color-error` | #ff3b30 | (동일) |
| 정보 | `--color-info` | #14ade5 | (동일) |

### 테두리 / 구분선
- `--color-border`, `--color-border-light`, `--color-divider` — 카드/입력/섹션 구분선에만 사용. 그림자로 분리하지 마라.

## 컴포넌트
### 카드
```
.card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md);   /* 8px — 큰 라운드 금지 */
  box-shadow: var(--shadow-card);
  aspect-ratio: var(--card-aspect-ratio);  /* 3.1 / 4.8 */
}
```

### 버튼
```
Primary  : background: var(--color-accent); color: var(--color-text-inverse); border-radius: var(--radius-md);
Secondary: background: transparent; color: var(--color-text-primary); border: 1px solid var(--color-border);
Text     : color: var(--color-text-secondary); → hover/active 시 --color-text-primary
Danger   : color: var(--color-error); (텍스트 버튼). 배경 빨강은 confirmDialog 의 [삭제]/[탈퇴] 버튼에만.
```

### 입력 필드
```
.input {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  color: var(--color-text-primary);
}
```

### 토스트 (`src/js/components/toast.js`)
- 화면 상단 정중앙에서 위→아래로 등장, `toastIn` 0.2s.
- 상태별 테두리만 다르게 (`.success` / `.error` / `.warning`). 배경은 항상 `--color-bg-elevated`.

### 확인 모달 (`src/js/components/confirmDialog.js`)
- ESC 키 / 바깥 클릭으로 닫힘.
- [확인]은 액션에 따라 색상: 일반 = 검정, 삭제/탈퇴 = `--color-error` 배경.
- [취소]는 항상 회색 텍스트 버튼.
- `window.confirm()` 절대 사용 금지.

## 레이아웃
- **전체 폭**: `max-width: var(--mobile-max-width)` = 430px. 데스크톱에서는 중앙에 카드처럼 배치 (`box-shadow: var(--shadow-wrapper)`).
- **세로 구조**: `status-bar-spacer` → `page-container` (스크롤) → `bottom-nav` (fixed, 5탭).
- **하단 탭**: 5개 (편지·캘린더·내 일기[중앙 원형 ➕]·북마크·설정). 일부 화면(상세, 신고, 로그인, 라이선스, 설정)에서는 자동 숨김.
- **간격**: `--space-3` (12px), `--space-4` (16px) 가 기본. 섹션 간 `--space-8` (32px). 그 밖의 임의 px 사용 금지.
- **정렬**: 좌측 정렬 기본. 카드 본문 중앙 정렬은 인용/타이틀에서만.
- **페이지 헤더**: 제목만 있는 화면은 `.page-header-centered`, 뒤로가기 화면은 `.page-header-with-back` + `.page-header-spacer` 로 제목을 물리적 중앙에 둔다. 헤더/제목 정렬용 인라인 스타일을 쓰지 않는다.

## 튜토리얼
- 설정의 “튜토리얼 다시 보기”는 별도 페이지가 아니라 현재 앱 화면 위에 `.tutorial-tour-*` 오버레이를 올린다.
- 각 단계는 대상 요소를 먼저 화면 중앙으로 맞춘 뒤 포커스 링을 그린다. 대상이 아직 렌더링되지 않았거나 크기가 0이면 짧게 재시도한다.
- 포커스 링은 큰 컨테이너가 아니라 실제 조작 요소(활성 날짜 버튼, 토글 버튼, 검색 input, 설정 row)를 기준으로 잡는다.
- [다음]은 한 번 누를 때 한 단계만 진행한다. 라우트가 바뀌는 단계에서는 기존 안내 카드를 잠시 유지하고 버튼을 비활성화해 연속 탭으로 휙휙 넘어가지 않게 한다.
- 안내 범위는 오늘의 카드, 날짜 휠, 캘린더, 내 일기, 북마크, 알림, 홈 화면 위젯 설정을 포함한다.
- 튜토리얼 중에는 `.tutorial-tour-layer` 가 배경 조작을 막고 안내 카드의 [다음]/[건너뛰기]만 동작한다. 별도 `.tutorial-blocker` 나 `body.tutorial-active` 클래스는 쓰지 않는다.

## 타이포그래피
| 용도 | 스타일 | 토큰 |
|------|--------|------|
| 스플래시 타이틀 | font-size 56px, weight 800, letter-spacing -0.04em | `--text-5xl` + `--font-display` |
| 페이지 제목 | font-size 32px, weight 700 | `--text-3xl` |
| 카드 제목 | font-size 20~24px, weight 600 | `--text-xl` ~ `--text-2xl` |
| 본문 | font-size 15px, line-height 1.6 | `--text-base` + `--font-body` |
| 보조 / 캡션 | font-size 13px, color secondary | `--text-sm` |
| 뱃지 / 날짜 | font-size 11px | `--text-xs` |

폰트 패밀리는 모두 `LINESeedKR, Inter, sans-serif` (한글-영문 통일감).

## 애니메이션
허용:
- 페이지 진입: `pageEnter` (0.35s, opacity + translateY 12px)
- 토스트: `toastIn` / `toastOut` (각 0.2s)
- 스플래시: `splashPulse` (2.2s loop, scale 1↔1.04)
- 카드 플립: GSAP rotateY 600~700ms

금지:
- 무한 펄스/글로우 (스플래시 외)
- 패럴랙스 스크롤
- 마우스 추적 효과
- 등장 시 회전/확대 동시 적용 (어지러움)

트랜지션 토큰만 사용:
- `--transition-fast` (200ms) — hover, 색상 변경
- `--transition-base` (400ms) — 페이지 전환
- `--transition-spring` (800ms) — 카드 휠 피커 등 튕기는 동작

## 아이콘
- SVG 인라인. `stroke-width: 2`, `stroke: currentColor` 로 텍스트 색을 따라가게 한다.
- 하단 탭 아이콘은 28x28, 그 외 본문 아이콘은 16~24.
- 아이콘을 둥근 배경 박스(`background-color` + `border-radius`)로 감싸지 않는다 — 단, 하단 탭 중앙 ➕ 버튼은 예외 (44x44 원형 + `--color-accent` 배경).
- 안드로이드 위젯 아이콘은 별도 (`android/app/src/main/res/drawable/ic_widget_*.xml`).
