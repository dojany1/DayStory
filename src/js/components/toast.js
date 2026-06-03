/* =====================================================================
   toast.js — 토스트 알림 컴포넌트
   =====================================================================
   화면 하단에 잠깐 나타났다 사라지는 알림 메시지입니다.
   성공, 오류, 경고, 정보 등 다양한 타입을 지원합니다.

   마지막 수정 날짜 : 2026-03-31 20:00
   ===================================================================== */

/* 현재 화면에 떠있는 토스트의 사라짐 예약을 추적하는 타이머 변수 */
let currentToastTimer = null;

/**
 * showToast — 토스트 알림을 화면에 표시합니다
 * @param {string} message  - 표시할 메시지 텍스트
 * @param {string} type     - 알림 유형 ('info', 'success', 'error', 'warning')
 * @param {number} duration - 표시 시간 (밀리초, 기본 2500ms = 2.5초)
 */

export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  /* 1) 이전 타이머 및 기존 토스트 즉시 제거 */
  if (currentToastTimer) {
    clearTimeout(currentToastTimer);
    currentToastTimer = null;
  }
  const existingToast = container.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  /* 2) 새 토스트 생성 */
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);


  /* 3) 사라짐 예약 */
  currentToastTimer = setTimeout(() => {
    toast.classList.add('hide');

    /* 애니메이션 종료 후 요소 삭제 */
    toast.addEventListener('animationend', () => {
      toast.remove();
      // 현재 타이머가 이 토스트의 것이라면 초기화
      if (currentToastTimer) {
        currentToastTimer = null;
      }
    }, { once: true });
  }, duration);
}

/**
 * dismissToast — 현재 표시 중인 토스트를 즉시 제거합니다.
 * 로딩 인디케이터용 장기 토스트를 공유 시트 등이 뜨기 전에 제거할 때 사용.
 */
export function dismissToast() {
  if (currentToastTimer) {
    clearTimeout(currentToastTimer);
    currentToastTimer = null;
  }
  const container = document.getElementById('toast-container');
  if (!container) return;
  const existing = container.querySelector('.toast');
  if (existing) {
    existing.classList.add('hide');
    existing.addEventListener('animationend', () => existing.remove(), { once: true });
  }
}

