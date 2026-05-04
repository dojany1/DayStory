import{_ as e,i as t}from"./index-C_6SX2a3.js";function n(){e();let n=document.createElement(`div`);return n.className=`report-page page`,n.innerHTML=`
    <!-- 페이지 헤더: 뒤로가기 + 제목 -->
    <div class="page-header" style="height: 60px; padding: 0 16px; align-items:center; display:flex; justify-content:flex-start; gap:8px;">
      <button class="page-header-back" id="report-back" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="page-header-title" style="margin:0; font-size:1.2rem; line-height:1;">오류 신고</h1>
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
  `,setTimeout(()=>{document.getElementById(`report-back`)?.addEventListener(`click`,()=>window.history.back()),document.querySelectorAll(`.report-category`).forEach(e=>{e.addEventListener(`click`,()=>{document.querySelectorAll(`.report-category`).forEach(e=>e.classList.remove(`selected`)),e.classList.add(`selected`)})}),document.getElementById(`report-submit`)?.addEventListener(`click`,()=>{if(!document.getElementById(`report-description`).value.trim())return t(`설명을 입력해주세요`,`warning`);t(`신고가 접수되었습니다. 감사합니다! ✅`,`success`),setTimeout(()=>window.history.back(),1e3)})},0),n}export{n as renderReport};