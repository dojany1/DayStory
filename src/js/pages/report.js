/* =====================================================================
   report.js — 오류 신고 페이지
   =====================================================================
   일화의 내용에 오탈자, 사실 오류 등을 발견했을 때 신고하는 페이지입니다.
   
   구성:
     - 신고 유형 선택 (오탈자 / 사실 오류 / 기타)
     - 상세 설명 입력 텍스트 영역
     - 신고 제출 버튼
   ===================================================================== */

import { navigate, getParams } from '../router.js';
import { showToast } from '../components/toast.js';


/**
 * renderReport — 오류 신고 페이지를 생성합니다
 * @returns {HTMLElement} 오류 신고 페이지 DOM 요소
 */
export function renderReport() {
  const params = getParams();  /* URL에서 storyId 파라미터 가져오기 */
  const page = document.createElement('div');
  page.className = 'report-page page';

  page.innerHTML = `
    <!-- 페이지 헤더: 뒤로가기 + 제목 -->
    <div class="page-header" style="padding-left:0;padding-right:0;">
      <button class="page-header-back" id="report-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="page-header-title" style="margin-left:var(--space-3)">오류 신고</h1>
      <div></div>
    </div>

    <!-- 신고 유형 선택 -->
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

    <!-- 상세 설명 입력 -->
    <div class="input-group" style="margin-bottom:var(--space-6);">
      <label class="input-label">상세 설명</label>
      <textarea class="report-textarea" id="report-description" 
                placeholder="발견한 오류를 자세히 설명해주세요..."></textarea>
    </div>

    <!-- 제출 버튼 -->
    <button class="btn btn-primary btn-full btn-large" id="report-submit">신고 제출</button>
  `;

  /* ---- 이벤트 리스너 연결 ---- */
  setTimeout(() => {
    /* 뒤로가기 */
    document.getElementById('report-back')?.addEventListener('click', () => window.history.back());

    /* 신고 유형 선택: 클릭한 항목만 .selected 표시 */
    document.querySelectorAll('.report-category').forEach(category => {
      category.addEventListener('click', () => {
        document.querySelectorAll('.report-category').forEach(c => c.classList.remove('selected'));
        category.classList.add('selected');
      });
    });

    /* 신고 제출 */
    document.getElementById('report-submit')?.addEventListener('click', () => {
      const description = document.getElementById('report-description').value.trim();

      if (!description) {
        return showToast('설명을 입력해주세요', 'warning');
      }

      showToast('신고가 접수되었습니다. 감사합니다! ✅', 'success');

      /* 1초 후 이전 페이지로 돌아감 */
      setTimeout(() => window.history.back(), 1000);
    });
  }, 0);

  return page;
}
