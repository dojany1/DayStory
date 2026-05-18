/* =====================================================================
   about.js — DOKHU의 소개 페이지
   =====================================================================
   설정 → "DOKHU의 소개" 메뉴에서 진입.
   현재 언어(ko/en/ja)에 맞춰 docs/dokhu.md 원문을 표시.
   ===================================================================== */

import { t, getCurrentLang } from '../i18n/index.js';
import { ABOUT_CONTENT } from '../../data/about.js';
import { escapeHtml } from '../utils/sanitize.js';

export function renderAbout() {
  const page = document.createElement('div');
  page.className = 'about-page page';

  const lang = getCurrentLang();
  const content = ABOUT_CONTENT[lang] || ABOUT_CONTENT.ko;
  const paragraphs = content.paragraphs
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('');

  page.innerHTML = `
    <div class="page-header page-header-with-back">
      <button class="page-header-back" id="about-back" aria-label="${t('common.back')}">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <h1 class="page-header-title">${escapeHtml(t('settings.row_about'))}</h1>
      <div class="page-header-spacer"></div>
    </div>

    <article class="about-article">
      <h2 class="about-article-title">${escapeHtml(content.title)}</h2>
      <div class="about-article-body">
        ${paragraphs}
      </div>
      <div class="about-article-signature">${escapeHtml(content.signature)}</div>
    </article>
  `;

  page.querySelector('#about-back').addEventListener('click', () => history.back());
  return page;
}
