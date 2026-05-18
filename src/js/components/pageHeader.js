const CHEVRON_LEFT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
const CLOSE_X = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
const SPACER = `<div class="page-header-spacer" aria-hidden="true"></div>`;

/**
 * renderPageHeader — 좌측 버튼 + 제목(중앙) + 우측 슬롯 헤더 생성
 * @param {object} options
 * @param {string} options.title          헤더에 표시할 제목
 * @param {string} [options.titleId]      aria-labelledby 등에 사용할 h1 id
 * @param {string} [options.backLabel]    좌측 버튼 aria-label (기본: '뒤로')
 * @param {'back'|'close'|'none'} [options.icon]
 *   'back'  → 좌측에 chevron-left 버튼 (기본)
 *   'close' → 좌측에 X 버튼
 *   'none'  → 좌측에 빈 스페이서 (뒤로가기 없는 탭 헤더용)
 * @param {string} [options.rightAction]  우측 슬롯 HTML (기본: 스페이서)
 */
export function renderPageHeader({
  title,
  titleId = '',
  backLabel = '뒤로',
  icon = 'back',
  rightAction = SPACER,
}) {
  const titleIdAttr = titleId ? ` id="${titleId}"` : '';

  let leftSlot;
  if (icon === 'none') {
    leftSlot = SPACER;
  } else {
    const svgIcon = icon === 'close' ? CLOSE_X : CHEVRON_LEFT;
    leftSlot = `<button type="button" class="page-header-back" aria-label="${backLabel}">${svgIcon}</button>`;
  }

  return `
    <div class="page-header page-header-with-back">
      ${leftSlot}
      <h1 class="page-header-title"${titleIdAttr}>${title}</h1>
      ${rightAction}
    </div>
  `;
}

/**
 * bindPageHeaderBack — .page-header-back 버튼에 클릭 핸들러 바인딩
 * @param {Element} container 헤더가 포함된 루트 엘리먼트
 * @param {Function} handler  클릭 시 실행할 함수
 */
export function bindPageHeaderBack(container, handler) {
  container.querySelector('.page-header-back')?.addEventListener('click', handler);
}
