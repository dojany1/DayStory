/* =====================================================================
   donate.js — 후원 페이지
   =====================================================================
   에디터에게 커피 한 잔의 응원을 보내는 후원 페이지입니다.
   실제 결제는 아직 구현되지 않았으며, 추후 인앱 결제(IAP)를 연동할 예정입니다.
   
   구성:
     - 후원 안내 메시지
     - 금액 선택 버튼 (₩1,000 / ₩3,000 / ₩5,000)
     - 후원하기 제출 버튼
   ===================================================================== */

import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';


/**
 * renderDonate — 후원 페이지를 생성합니다
 * @returns {HTMLElement} 후원 페이지 DOM 요소
 */
export function renderDonate() {
  const page = document.createElement('div');
  page.className = 'donate-page page';

  page.innerHTML = `
    <!-- 페이지 헤더: 뒤로가기 + 제목 -->
    <div class="page-header" style="height: 60px; padding: 0 16px; align-items:center; display:flex; justify-content:flex-start; gap:8px;">
      <button class="page-header-back" id="donate-back" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="page-header-title" style="margin:0; font-size:1.2rem; line-height:1;">후원하기</h1>
    </div>

    <!-- 후원 안내 영역 -->
    <div class="donate-hero">
      <div class="donate-icon">☕</div>
      <h2 class="donate-title">에디터에게 커피 한 잔</h2>
      <p class="donate-desc">
        매일 역사 일화를 정성껏 작성하는<br/>
        에디터에게 응원의 마음을 전해주세요
      </p>
    </div>

    <!-- 금액 선택 버튼 그룹 -->
    <div class="donate-amounts" id="donate-amounts">
      <button class="donate-amount-btn" data-amount="1000">
        ₩1,000
        <span class="donate-amount-label">커피 한 잔</span>
      </button>
      <button class="donate-amount-btn selected" data-amount="3000">
        ₩3,000
        <span class="donate-amount-label">라떼 한 잔</span>
      </button>
      <button class="donate-amount-btn" data-amount="5000">
        ₩5,000
        <span class="donate-amount-label">케이크 세트</span>
      </button>
    </div>

    <!-- 후원 제출 버튼 -->
    <button class="btn btn-primary btn-full btn-large" id="donate-submit" style="margin-top:var(--space-6);">
      후원하기
    </button>

    <!-- 안내 문구 -->
    <p style="text-align:center;font-size:var(--text-xs);color:var(--color-text-tertiary);margin-top:var(--space-4);line-height:1.6;">
      인앱 결제(Apple/Google)로 안전하게 처리됩니다.<br/>
      후원금은 콘텐츠 제작에 사용됩니다.
    </p>
  `;

  /* ---- 이벤트 리스너 연결 ---- */
  setTimeout(() => {
    /* 뒤로가기 */
    document.getElementById('donate-back')?.addEventListener('click', () => window.history.back());

    /* 금액 선택: 클릭한 버튼만 .selected 적용 */
    document.querySelectorAll('.donate-amount-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.donate-amount-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    /* 후원 제출 버튼 */
    document.getElementById('donate-submit')?.addEventListener('click', () => {
      const selected = document.querySelector('.donate-amount-btn.selected');
      const amount = selected?.dataset.amount || '3000';
      showToast(`₩${Number(amount).toLocaleString()} 후원 감사합니다! 🎉`, 'success');
      /* TODO: 실제 인앱 결제(IAP) 연동 필요 */
    });
  }, 0);

  return page;
}
