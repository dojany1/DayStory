/* ============================================
   DayStory — Donate Page
   ============================================ */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

export function renderDonate() {
  const page = document.createElement('div');
  page.className = 'donate-page page';

  page.innerHTML = `
    <div class="page-header" style="justify-content:flex-start;">
      <button class="page-header-back" id="donate-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="page-header-title" style="margin-left:var(--space-3)">후원하기</h1>
    </div>

    <div class="donate-hero">
      <div class="donate-icon">☕</div>
      <h2 class="donate-title">에디터에게 커피 한 잔</h2>
      <p class="donate-desc">
        매일 역사 일화를 정성껏 작성하는<br/>
        에디터에게 응원의 마음을 전해주세요
      </p>
    </div>

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

    <button class="btn btn-primary btn-full btn-large" id="donate-submit" style="margin-top:var(--space-6);">
      후원하기
    </button>

    <p style="text-align:center;font-size:var(--text-xs);color:var(--color-text-tertiary);margin-top:var(--space-4);line-height:1.6;">
      인앱 결제(Apple/Google)로 안전하게 처리됩니다.<br/>
      후원금은 콘텐츠 제작에 사용됩니다.
    </p>
  `;

  setTimeout(() => {
    document.getElementById('donate-back')?.addEventListener('click', () => window.history.back());

    /* Amount selection */
    document.querySelectorAll('.donate-amount-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.donate-amount-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    /* Submit */
    document.getElementById('donate-submit')?.addEventListener('click', () => {
      const selected = document.querySelector('.donate-amount-btn.selected');
      const amount = selected?.dataset.amount || '3000';
      showToast(`₩${Number(amount).toLocaleString()} 후원 감사합니다! 🎉`, 'success');
      /* TODO: Trigger real IAP here */
    });
  }, 0);

  return page;
}
