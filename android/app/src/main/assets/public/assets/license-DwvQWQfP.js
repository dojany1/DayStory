import{f as e}from"./index-C_6SX2a3.js";async function t(){let t=document.createElement(`div`);return t.className=`license-page page`,t.innerHTML=`
    <!-- 페이지 헤더: 뒤로가기 + 제목 -->
    <div class="page-header" style="height: 60px; padding: 0 16px; align-items:center; display:flex; justify-content:flex-start; gap:8px;">
      <button class="page-header-back" id="license-back" style="width:32px; height:32px; padding:0; display:flex; align-items:center; justify-content:center;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <h1 class="page-header-title" style="margin:0; font-size:1.2rem; line-height:1;">이미지 출처 안내</h1>
    </div>

    <!-- 로딩 스피너 -->
    <div id="license-loading" style="display:flex; justify-content:center; padding:var(--space-8);">
      <div class="loading-spinner"></div>
    </div>

    <!-- 라이선스 목록 영역 -->
    <ul id="license-list" class="license-list" style="display:none;"></ul>
  `,setTimeout(async()=>{let t=document.getElementById(`license-back`);t&&t.addEventListener(`click`,()=>window.history.back());let n=document.getElementById(`license-list`),r=document.getElementById(`license-loading`);if(!(!n||!r))try{let t=await e();if(r.style.display=`none`,n.style.display=`flex`,t.length===0){n.innerHTML=`
          <div class="empty-state">
            <div class="empty-state-title">등록된 라이선스가 없습니다</div>
            <div class="empty-state-desc">이미지 출처 정보가 포함된 발행글이 없습니다.</div>
          </div>
        `;return}n.innerHTML=t.map(e=>`
          <li class="license-item">
            <span class="license-date">[${(e.publish_date||``).replace(/-/g,`.`)}]</span>
            <span class="license-text">${String(e.image_license).replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#039;`)}</span>
          </li>
        `).join(``)}catch(e){console.error(e),r.style.display=`none`,n.style.display=`flex`,n.innerHTML=`<div class="empty-state"><div class="empty-state-title">오류 발생</div></div>`}},0),t}export{t as renderLicense};