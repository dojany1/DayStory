import{i as e,n as t,o as n,p as r,r as i,s as a,v as o}from"./index-C_6SX2a3.js";function s(e){let t=document.createElement(`div`);return t.className=`detail-page page`,t.innerHTML=`
    <div style="display:flex;justify-content:center;align-items:center;min-height:60vh;">
      <div class="loading-spinner"></div>
    </div>
  `,c(t,e.id),t}async function c(s,c){let l=await r(c);if(!l){s.innerHTML=`
      <div class="empty-state">
        <div class="empty-state-title">일화를 찾을 수 없습니다</div>
      </div>
    `;return}let u=await n(c),d=new Date(l.publish_date),f=d.getMonth()+1,p=d.getDate(),m=l.body.split(`
`).filter(e=>e.trim()).map(e=>`<p>${t(e)}</p>`).join(``),h=l.story_sources||l.sources||[];s.innerHTML=`
    <!-- 상단 헤더: 뒤로가기 + 액션 버튼들 -->
    <div class="detail-header" id="detail-header">
      <button class="page-header-back" id="detail-back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="detail-header-actions">
        <!-- 북마크 버튼 -->
        <button class="btn-icon bookmark-btn ${u?`active`:``}" id="detail-bookmark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
        <!-- 공유 버튼 -->
        <button class="btn-icon" id="detail-share">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 히어로 이미지 영역 -->
    <div class="detail-hero">
      <img src="${t(l.image_url)}" alt="${t(l.figure_name)}" />
      <div class="card-image-title">${t(l.figure_name)}</div>
      <div class="detail-hero-overlay">
        <div class="detail-hero-year">${t(l.historical_year)}</div>
        <div class="detail-hero-monthday">${f}. ${p<10?`0`+p:p}</div>
        <span class="detail-hero-tag">${t(l.card_count||``)} &nbsp;·&nbsp; ${t(l.country)}</span>
      </div>
    </div>

    <!-- 본문 영역 -->
    <div class="detail-content">
      <h1 class="detail-figure-name">${t(l.figure_name)}</h1>
      <div class="detail-body">${m}</div>
      <div class="detail-historical-date">${t(l.historical_date)}</div>

      <!-- 참고 자료 (있을 때만 표시) -->
      ${h.length?`
        <div class="detail-sources">
          <div class="detail-sources-title">참고 자료</div>
          ${h.map(e=>`
            <a href="${i(e.url)}" target="_blank" rel="noopener" class="detail-source-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              ${t(e.title)}
            </a>
          `).join(``)}
        </div>
      `:``}

      <!-- 하단 액션 바 -->
      <div class="detail-actions-bar">
        <button class="detail-action-btn ${u?`active`:``}" id="action-bookmark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          <span>북마크</span>
        </button>
        <button class="detail-action-btn" id="action-share">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          <span>공유</span>
        </button>
        <button class="detail-action-btn" id="action-report">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>오류 신고</span>
        </button>
      </div>
    </div>
  `,document.getElementById(`detail-back`)?.addEventListener(`click`,()=>window.history.back());let g=async()=>{let t=await a(c);if(t.error){e(t.error,`error`);return}u=t.bookmarked,s.querySelectorAll(`#detail-bookmark, #action-bookmark`).forEach(e=>{e.classList.toggle(`active`,u)}),e(u?`북마크에 저장했습니다`:`북마크를 해제했습니다`,`success`)};document.getElementById(`detail-bookmark`)?.addEventListener(`click`,g),document.getElementById(`action-bookmark`)?.addEventListener(`click`,g);let _=async()=>{try{let t=window.location.hostname===`localhost`||window.location.hostname===`127.0.0.1`?`https://daystory.app/detail/${l.id}`:window.location.href;navigator.share?await navigator.share({title:l.figure_name,text:`[DayStory] ${l.figure_name}\n\n${l.summary||``}`,url:t}):(await navigator.clipboard.writeText(`[DayStory] ${l.figure_name}\n\n${l.summary||``}\n${t}`),e(`클립보드에 복사했습니다`,`success`))}catch{}};document.getElementById(`detail-share`)?.addEventListener(`click`,_),document.getElementById(`action-share`)?.addEventListener(`click`,_),document.getElementById(`action-report`)?.addEventListener(`click`,()=>{o(`/report`,{storyId:l.id})})}export{s as renderDetail};