/* ============================================
   DayStory — Report Page
   ============================================ */
import { navigate, getParams } from '../router.js';
import { showToast } from '../components/toast.js';

export function renderReport() {
  const params = getParams();
  const page = document.createElement('div');
  page.className = 'report-page page';

  page.innerHTML = `
    <div class="page-header" style="padding-left:0;padding-right:0;">
      <button class="page-header-back" id="report-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="page-header-title" style="margin-left:var(--space-3)">오류 신고</h1>
      <div></div>
    </div>

    <div class="section-title" style="margin-top:var(--space-2);">신고 유형</div>
    <div class="report-category-group" id="report-categories">
      <label class="report-category selected" data-value="typo">
        <div class="report-category-radio"></div>
        <span>오탈자</span>
      </label>
      <label class="report-category" data-value="factual_error">
        <div class="report-category-radio"></div>
        <span>사실 오류</span>
      </label>
      <label class="report-category" data-value="other">
        <div class="report-category-radio"></div>
        <span>기타</span>
      </label>
    </div>

    <div class="input-group" style="margin-bottom:var(--space-6);">
      <label class="input-label">상세 설명</label>
      <textarea class="report-textarea" id="report-description" placeholder="발견한 오류를 자세히 설명해주세요..."></textarea>
    </div>

    <button class="btn btn-primary btn-full btn-large" id="report-submit">신고 제출</button>
  `;

  setTimeout(() => {
    document.getElementById('report-back')?.addEventListener('click', () => window.history.back());

    /* Category selection */
    document.querySelectorAll('.report-category').forEach(cat => {
      cat.addEventListener('click', () => {
        document.querySelectorAll('.report-category').forEach(c => c.classList.remove('selected'));
        cat.classList.add('selected');
      });
    });

    /* Submit */
    document.getElementById('report-submit')?.addEventListener('click', () => {
      const desc = document.getElementById('report-description').value.trim();
      if (!desc) return showToast('설명을 입력해주세요', 'warning');
      showToast('신고가 접수되었습니다. 감사합니다! ✅', 'success');
      setTimeout(() => window.history.back(), 1000);
    });
  }, 0);

  return page;
}
