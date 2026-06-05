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
import { t } from '../i18n/index.js';


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
    <div class="page-header" style="height: 60px; padding: 0 16px; align-items:center; display:flex; justify-content:flex-start; gap:8px;">
      <button class="page-header-back" id="report-back" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="page-header-title" style="margin:0; font-size:1.2rem; line-height:1;">${t('report.title')}</h1>
    </div>

    <!-- 신고 유형 선택 -->
    <div class="section-title" style="margin-top:var(--space-2);">${t('report.type')}</div>
    <div class="report-category-group" id="report-categories">
      <label class="report-category selected" data-value="typo">
        <div class="report-category-radio"></div>
        <span>${t('report.type_typo')}</span>
      </label>
      <label class="report-category" data-value="factual_error">
        <div class="report-category-radio"></div>
        <span>${t('report.type_fact')}</span>
      </label>
      <label class="report-category" data-value="other">
        <div class="report-category-radio"></div>
        <span>${t('report.type_etc')}</span>
      </label>
    </div>

    <!-- 상세 설명 입력 -->
    <div class="input-group" style="margin-bottom:var(--space-6);">
      <label class="input-label">${t('report.detail')}</label>
      <textarea class="report-textarea" id="report-description"
                placeholder="${t('report.placeholder')}"></textarea>
    </div>

    <!-- 제출 버튼 -->
    <button class="btn btn-primary btn-full btn-large" id="report-submit">${t('report.submit')}</button>
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
        return showToast(t('report.toast_need_detail'), 'warning');
      }

      showToast(t('report.toast_done'), 'success');

      /* 1초 후 이전 페이지로 돌아감 */
      setTimeout(() => window.history.back(), 1000);
    });
  }, 0);

  return page;
}
