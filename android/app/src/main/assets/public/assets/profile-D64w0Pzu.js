import{n as e,t}from"./cropper-DRzLYBQ1.js";import{n,r}from"./state-BzUx61zh.js";import{a as i,h as a,n as o,o as s,r as c,s as l,t as u,y as d}from"./firebase-CTTG2K72.js";import{a as f,i as p,n as m,v as h}from"./index-C_6SX2a3.js";var g=e(t(),1);function _(){let e=document.createElement(`div`);e.className=`archive-page page`;let t=n(`user`),r=n(`profile`);return e.innerHTML=`
    <!-- 페이지 헤더: 제목 및 톱니바퀴 -->
    <div class="page-header" style="align-items:center; display:flex; justify-content:space-between;">
      <h1 class="page-header-title" style="margin:0; font-size:1.5rem; font-weight:700;">내 프로필</h1>
      <div style="display:flex; align-items:center; gap:12px;">
        ${r&&r.role===`editor`?`
        <button class="settings-editor-btn btn btn-primary" aria-label="콘텐츠 관리" style="width: 32px; height: 32px; padding: 0; border-radius: 50%; box-shadow: var(--shadow-sm); flex-shrink: 0; min-width: 0;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        `:``}
        <button class="settings-gear-btn" aria-label="설정" style="width:32px; height:32px; padding:0; background:none; border:none; color:var(--color-text-primary); cursor:pointer; display:flex; align-items:center; justify-content:center;">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- ===== 로그인 사용자 정보 섹션 ===== -->
    <div class="settings-user-info" style="margin-top: var(--space-2); margin-bottom: var(--space-2); padding: var(--space-3); background: var(--color-bg-secondary); border-radius: var(--radius-lg);">
      ${t&&t.id!==`guest`?`
        <div style="display:flex; align-items:center; gap: var(--space-4);">
          <div class="profile-avatar-wrap" style="width:50px; height:50px; background:var(--color-bg-primary); border-radius:50%; display:flex; justify-content:center; align-items:center; overflow:hidden; flex-shrink:0;">
            ${r&&r.photoURL||t.photoURL?`<img src="${r&&r.photoURL||t.photoURL}" style="width:100%; height:100%; object-fit:cover;" />`:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px; color:var(--color-text-tertiary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:var(--text-lg); font-weight:600; color:var(--color-text-primary); display:flex; align-items:center; gap:8px;">
              ${r&&r.nickname||t.displayName||(t.email?t.email.split(`@`)[0]:`사용자`)}
              ${r&&r.role===`editor`?`<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: var(--color-accent); color: var(--color-text-tertiary); margin-left: var(--space-1);">관리자</span>`:``}
            </div>
            <div style="font-size:var(--text-sm); color:var(--color-text-tertiary);">
              ${t.email||`이메일 정보 없음`}
            </div>
          </div>
          <!-- 프로필 편집 버튼 -->
          <button id="profile-edit-btn" class="profile-edit-btn" aria-label="프로필 편집">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        </div>
      `:`
        <div style="display:flex; align-items:center; gap: var(--space-4); margin-bottom: var(--space-4);">
          <div style="width:50px; height:50px; background:var(--color-bg-primary); border-radius:50%; display:flex; justify-content:center; align-items:center;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px; color:var(--color-text-tertiary);"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          </div>
          <div>
            <div style="font-size:var(--text-lg); font-weight:600; color:var(--color-text-primary);">
              게스트 모드
            </div>
            <div style="font-size:var(--text-sm); color:var(--color-text-tertiary);">
              로그인하고 기록을 저장하세요
            </div>
          </div>
        </div>
        <button id="goto-login-btn" class="btn btn-primary" style="width:100%; padding: 8px 16px; font-size: var(--text-sm);">
          로그인 / 회원가입 하러 가기
        </button>
      `}
    </div>
    
    <!-- 북마크된 카드 리스트 헤더 및 검색창 (좌우 균등, 중앙 배치) --> 
    <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-4); gap: var(--space-2);">
      <h2 style="font-size: var(--text-base); font-weight: 600; line-height: 1; margin: 0; color: var(--color-text-secondary); white-space: nowrap; transform: translateY(1px);">보관한 스토리</h2>
      <div class="search-bar" id="collection-search-bar" style="margin: 0; padding: 6px 12px; flex: 0 1 180px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; flex-shrink: 0;">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input type="text" id="collection-search-input" placeholder="검색..." autocomplete="off" style="font-size: var(--text-sm);" />
      </div>
    </div>

    <!-- 카드 그리드 영역 (로딩 중에는 스피너 표시) -->
    <div id="archive-content" style="display:flex;justify-content:center;padding: 0 var(--space-4) var(--space-8) var(--space-4);">
      <div class="loading-spinner"></div>
    </div>
  `,setTimeout(()=>{let t=e.querySelector(`.settings-gear-btn`);t&&t.addEventListener(`click`,()=>h(`/settings`));let n=e.querySelector(`.settings-editor-btn`);n&&n.addEventListener(`click`,()=>h(`/editor`));let r=e.querySelector(`#goto-login-btn`);r&&r.addEventListener(`click`,()=>h(`/login`));let i=e.querySelector(`#profile-edit-btn`);i&&i.addEventListener(`click`,()=>b())},0),v(e),e}async function v(e){let t=e.querySelector(`#archive-content`)||document.getElementById(`archive-content`),n=e.querySelector(`#archive-count`);try{let n=await Promise.race([f(),new Promise((e,t)=>setTimeout(()=>t(Error(`시간 초과`)),5e3))])||[];n.sort((e,t)=>{let n=new Date(e.publish_date).getTime()||0;return(new Date(t.publish_date).getTime()||0)-n});let r=e=>{if(!e.length){t.className=``,t.innerHTML=`
          <div class="empty-state">
            <div class="empty-state-title">보관된 카드가 없습니다.</div>
          </div>
        `;return}t.className=`archive-grid`,t.style.display=``,t.style.padding=``,t.innerHTML=e.map(e=>y(e)).join(``),t.querySelectorAll(`.history-card-mini`).forEach(e=>{e.addEventListener(`click`,()=>{h(`/detail/`+e.dataset.storyId)})})};r(n);let i=e.querySelector(`#collection-search-input`);i&&i.addEventListener(`input`,e=>{let t=e.target.value.trim().toLowerCase();r(t?n.filter(e=>(e.figure_name||``).toLowerCase().includes(t)||(e.country||``).toLowerCase().includes(t)||(e.summary||``).toLowerCase().includes(t)):n)})}catch(e){console.error(`컬렉션 로딩 실패:`,e),n&&(n.textContent=`오류 발생`),t.className=``,t.innerHTML=`
      <div class="empty-state">
        <div class="empty-state-title">데이터를 불러오지 못했습니다</div>
        <div class="empty-state-desc">네트워크 상태를 확인해주세요</div>
        <button class="btn btn-primary" onclick="location.reload()" style="margin-top:var(--space-4)">
          다시 시도
        </button>
      </div>
    `}}function y(e){let t=new Date(e.publish_date),n=t.getMonth()+1,r=t.getDate(),i=new Date().getFullYear();return`
    <div class="history-card-mini" data-story-id="${m(e.id)}">
      <div class="mini-card-top">
        <div class="mini-top-left">
          <div class="mini-year">${m(e.historical_year)}</div>
          <div class="mini-date">${n}. ${r<10?`0`+r:r}</div>
        </div>
        <div class="mini-top-right">
          ${m(e.card_count||``)} ${m(e.country)}<br>
          ${i} / ${String(n).padStart(2,`0`)} / ${String(r).padStart(2,`0`)}
        </div>
      </div>
      <div class="mini-card-image-wrap">
        <img src="${m(e.image_url)}" alt="${m(e.figure_name)}" loading="lazy" />
        <div class="mini-card-overlay">
          ${m(e.figure_name)}
        </div>
      </div>
    </div>
  `}function b(){let e=n(`user`),t=n(`profile`)||{};if(!e||e.id===`guest`||document.querySelector(`.profile-edit-overlay`))return;let f=t.photoURL||e.photoURL||``,g=t.nickname||e.displayName||(e.email?e.email.split(`@`)[0]:``),_=document.createElement(`div`);_.className=`profile-edit-overlay`,_.innerHTML=`
    <div class="profile-edit-modal">
      <!-- 모달 헤더 -->
      <div class="profile-edit-header">
        <button class="profile-edit-close" id="profile-edit-close" aria-label="닫기">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <span class="profile-edit-title">프로필 편집</span>
        <button class="profile-edit-save" id="profile-edit-save">저장</button>
      </div>

      <!-- 프로필 이미지 편집 -->
      <div class="profile-edit-avatar-section">
        <div class="profile-edit-avatar" id="profile-edit-avatar">
          ${f?`<img src="${f}" />`:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`}
        </div>
        <button class="profile-edit-photo-btn" id="profile-edit-photo-btn">사진 변경</button>
        <input type="file" id="profile-photo-input" accept="image/*" style="display:none;" />
      </div>

      <!-- 닉네임 입력 -->
      <div class="profile-edit-field">
        <label class="profile-edit-label" for="profile-nickname-input">닉네임</label>
        <input type="text" class="profile-edit-input" id="profile-nickname-input"
               value="${m(g)}" maxlength="20" placeholder="닉네임을 입력하세요" />
        <div class="profile-edit-hint">최대 20자</div>
      </div>
    </div>
  `,(document.querySelector(`.mobile-wrapper`)||document.body).appendChild(_),requestAnimationFrame(()=>_.classList.add(`visible`));let v=null,y=()=>{_.classList.remove(`visible`),setTimeout(()=>_.remove(),200)};_.querySelector(`#profile-edit-close`).addEventListener(`click`,y),_.addEventListener(`click`,e=>{e.target===_&&y()});let b=_.querySelector(`#profile-edit-photo-btn`),S=_.querySelector(`#profile-photo-input`);b.addEventListener(`click`,()=>S.click()),S.addEventListener(`change`,e=>{let t=e.target.files[0];if(!t)return;let n=new FileReader;n.onload=e=>{x(e.target.result,e=>{v=e;let t=_.querySelector(`#profile-edit-avatar`);t.innerHTML=`<img src="${URL.createObjectURL(e)}" />`})},n.readAsDataURL(t),S.value=``}),_.querySelector(`#profile-edit-save`).addEventListener(`click`,async()=>{let n=_.querySelector(`#profile-edit-save`),f=_.querySelector(`#profile-nickname-input`).value.trim();if(!f){p(`닉네임을 입력해주세요.`,`warning`);return}n.textContent=`저장 중...`,n.disabled=!0;try{let n=u?.currentUser?.uid||e.id,m=d(o,`profiles`,n),g={nickname:f};if(v){let e=s(c,`users/${n}/diary/profile_avatar_${Date.now()}.webp`);await l(e,v),g.photoURL=await i(e)}await a(m,g,{merge:!0}),r(`profile`,{...t,...g});let _={...e};_.displayName=f,g.photoURL&&(_.photoURL=g.photoURL),r(`user`,_),p(`프로필이 수정되었습니다.`,`success`),y(),h(`/profile`)}catch(e){console.error(`프로필 저장 실패:`,e),p(`프로필 저장에 실패했습니다.`,`error`),n.textContent=`저장`,n.disabled=!1}})}function x(e,t){let n=document.createElement(`div`);n.className=`crop-modal-overlay`,n.innerHTML=`
    <div class="crop-modal-header">프로필 사진 자르기</div>
    <div class="crop-modal-body">
      <img id="profile-cropper-image" src="${e}" style="max-width: 100%; display: block;" />
    </div>
    <div class="crop-modal-footer">
      <button type="button" class="btn-rotate" id="btn-profile-crop-rotate">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.53-11.23l5.67 5.66" />
        </svg>
        회전
      </button>
      <button type="button" class="btn-crop-confirm" id="btn-profile-crop-confirm">확인</button>
    </div>
  `,(document.querySelector(`.mobile-wrapper`)||document.body).appendChild(n),setTimeout(()=>n.style.opacity=`1`,10);let r=n.querySelector(`#profile-cropper-image`),i;r.onload=()=>{i=new g.default(r,{aspectRatio:1,viewMode:1,dragMode:`move`,autoCropArea:.9,restore:!1,guides:!1,center:!0,highlight:!1,cropBoxMovable:!0,cropBoxResizable:!0,toggleDragModeOnDblclick:!1})},r.onerror=()=>{p(`이미지를 불러올 수 없습니다.`,`error`),n.remove()},n.querySelector(`#btn-profile-crop-rotate`).addEventListener(`click`,()=>{i&&i.rotate(90)}),n.querySelector(`#btn-profile-crop-confirm`).addEventListener(`click`,()=>{let e=n.querySelector(`#btn-profile-crop-confirm`);e.textContent=`처리 중...`,e.disabled=!0,i&&i.getCroppedCanvas({maxWidth:512,maxHeight:512,imageSmoothingEnabled:!0,imageSmoothingQuality:`high`}).toBlob(r=>{if(!r){p(`크롭 오류가 발생했습니다.`,`error`),e.textContent=`확인`,e.disabled=!1;return}t(r),i.destroy(),n.style.opacity=`0`,setTimeout(()=>n.remove(),300)},`image/webp`,.85)})}export{_ as renderProfile};