import{d as e,m as t,n,v as r}from"./index-C_6SX2a3.js";function i(){let n=document.createElement(`div`);return n.className=`search-page page`,n.innerHTML=`
    <!-- 페이지 제목 -->
    <div class="page-header" style="height: 60px; padding: 0 16px; align-items:center; display:flex;">
      <h1 class="page-header-title" style="margin:0; line-height:1;">검색</h1>
    </div>

    <!-- 검색창 -->
    <div class="search-bar" id="search-bar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="search-input" placeholder="인물, 사건, 국가로 검색..." autocomplete="off" />
    </div>

    <!-- 검색 결과 목록 -->
    <div id="search-results" class="search-results">
      <div style="display:flex;justify-content:center;padding:var(--space-6);">
        <div class="loading-spinner"></div>
      </div>
    </div>

    <!-- 검색 결과 없음 상태 -->
    <div id="search-empty" class="empty-state" style="display:none;">
      <div class="empty-state-title">검색 결과가 없습니다</div>
      <div class="empty-state-desc">다른 키워드로 검색해보세요</div>
    </div>
  `,(async()=>{let t=await e(),n=document.getElementById(`search-results`);n&&(n.innerHTML=t.map(e=>o(e)).join(``),a())})(),setTimeout(()=>{let n=document.getElementById(`search-input`),r;n?.addEventListener(`input`,()=>{clearTimeout(r),r=setTimeout(async()=>{let r=n.value.trim(),i=document.getElementById(`search-results`),s=document.getElementById(`search-empty`);if(!r){i.innerHTML=(await e()).map(e=>o(e)).join(``),s.style.display=`none`,i.style.display=`flex`,a();return}let c=await t(r);c.length?(i.innerHTML=c.map(e=>o(e)).join(``),s.style.display=`none`,i.style.display=`flex`):(i.style.display=`none`,s.style.display=`flex`),a()},300)})},0),n}function a(){document.querySelectorAll(`.search-result-item`).forEach(e=>{e.addEventListener(`click`,()=>{r(`/detail/`+e.dataset.storyId)})})}function o(e){let t=new Date(e.publish_date),r=`${t.getFullYear()}.${t.getMonth()+1}.${t.getDate()}`;return`
    <div class="search-result-item" data-story-id="${n(e.id)}">
      <div class="search-result-thumb">
        <img src="${n(e.image_url)}" alt="${n(e.figure_name)}" loading="lazy" />
      </div>
      <div class="search-result-info">
        <div class="search-result-date">${r} · ${n(e.country)}</div>
        <div class="search-result-title">${n(e.figure_name)}</div>
        <div class="search-result-summary">${n(e.summary)}</div>
      </div>
    </div>
  `}export{i as renderSearch};