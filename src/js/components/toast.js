/* =====================================================================
   toast.js — 토스트 알림 컴포넌트
   =====================================================================
   화면 하단에 잠깐 나타났다 사라지는 알림 메시지입니다.
   성공, 오류, 경고, 정보 등 다양한 타입을 지원합니다.
   
   사용 예시:
     showToast('저장되었습니다', 'success');
     showToast('오류가 발생했습니다', 'error');
     showToast('주의해주세요', 'warning');
     showToast('참고 정보입니다', 'info');
   ===================================================================== */

/**
 * showToast — 토스트 알림을 화면에 표시합니다
 * @param {string} message  - 표시할 메시지 텍스트
 * @param {string} type     - 알림 유형 ('info', 'success', 'error', 'warning')
 * @param {number} duration - 표시 시간 (밀리초, 기본 2500ms = 2.5초)
 * 
 * 동작:
 *   1) #toast-container에 새 토스트 요소 추가
 *   2) CSS 애니메이션으로 아래에서 슬라이드업
 *   3) duration 후 페이드아웃 애니메이션 실행
 *   4) 애니메이션 종료 후 DOM에서 제거
 */
export function showToast(message, type = 'info', duration = 2500) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');

  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  /* 지정 시간 후에 사라지게 함 */
  setTimeout(() => {
    toast.classList.add('hide');  /* CSS의 페이드아웃 애니메이션 적용 */
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}
