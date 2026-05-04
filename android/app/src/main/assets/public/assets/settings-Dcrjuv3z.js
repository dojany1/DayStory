import{n as e,r as t}from"./state-BzUx61zh.js";import{H as n,h as r}from"./index.esm-Chrrxead.js";import{_ as i,d as a,l as o,m as s,n as c,t as l,v as u,y as d}from"./firebase-CTTG2K72.js";import{i as f,v as p}from"./index-C_6SX2a3.js";var m={name:`daystory`,version:`1.1.2`,private:!0,type:`module`,scripts:{dev:`vite`,build:`vite build`,preview:`vite preview`},devDependencies:{"@capacitor/assets":`^3.0.5`,vite:`^8.0.1`},dependencies:{"@capacitor-firebase/authentication":`^8.2.0`,"@capacitor/android":`^8.3.0`,"@capacitor/app":`^8.1.0`,"@capacitor/cli":`^8.3.0`,"@capacitor/core":`^8.3.0`,"@capacitor/device":`^8.0.2`,"@capacitor/haptics":`^8.0.2`,"@capacitor/share":`^8.0.1`,"@capacitor/splash-screen":`^8.0.1`,"@capacitor/status-bar":`^8.0.2`,"browser-image-compression":`^2.0.2`,cropperjs:`^1.6.2`,firebase:`^12.11.0`}};function h(){let h=document.createElement(`div`);h.className=`settings-page page`;let _=e(`user`),v=e(`theme`);e(`fontSize`);let y=e(`profile`);return h.innerHTML=`
    <!-- 페이지 제목 & 뒤로가기 -->
    <div class="page-header" style="height: 60px; padding: 0 16px; align-items:center; display:flex; justify-content:flex-start; gap:12px;">
      <button class="settings-back-btn" onclick="history.back()" style="width:32px; height:32px; padding:0; background:none; border:none; display:flex; align-items:center; justify-content:center; color:var(--color-text-primary); cursor:pointer;">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <h1 class="page-header-title" style="margin:0; font-size:1.2rem; line-height:1;">앱 설정</h1>
    </div>


    <!-- ===== 디스플레이 섹션 ===== -->
    <div class="settings-section">
      <div class="settings-section-title">디스플레이</div>

      <!-- 테마 선택 (UI/UX 개선: 버튼형) -->
      <div class="theme-option-group">
        <div class="theme-option ${v===`light`?`active`:``}" data-theme="light">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <div class="theme-option-label">라이트</div>
        </div>
        <div class="theme-option ${v===`dark`?`active`:``}" data-theme="dark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          <div class="theme-option-label">다크</div>
        </div>
        <div class="theme-option ${v===`system`?`active`:``}" data-theme="system">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <div class="theme-option-label">시스템</div>
        </div>
      </div>
    </div>

    <!-- ===== 에디터 도구 섹션 (에디터 권한이 있을 때만 표시) ===== -->
    ${y&&y.role===`editor`?`
    <div class="settings-section">
      <div class="settings-section-title">에디터 도구</div>
      <div class="list-item" id="setting-editor">
        <div class="list-item-content">
          <div class="list-item-title">콘텐츠 관리</div>
          <div class="list-item-subtitle">일화 작성/편집/발행</div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </div>
    `:``}


    <!-- ===== 계정 섹션 ===== -->
    ${_&&_.id!==`guest`?`
    <div class="settings-section">
      <div class="settings-section-title">계정</div>

      <!-- 로그아웃 -->
      <div class="list-item" id="setting-logout">
        <div class="list-item-content">
          <div class="list-item-title" style="color:var(--color-error)">로그아웃</div>
        </div>
      </div>

      <!-- 회원 탈퇴 -->
      <div class="list-item" id="setting-withdraw">
        <div class="list-item-content">
          <div class="list-item-title" style="color:var(--color-text-tertiary)">회원 탈퇴</div>
        </div>
      </div>
    </div>
    `:``}

    <!-- ===== 앱 정보 섹션 ===== -->
    <div class="settings-section">
      <div class="settings-section-title">앱 정보</div>
      <div class="list-item" id="setting-tutorial">
        <div class="list-item-content">
          <div class="list-item-title">튜토리얼 다시 보기</div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
      <div class="list-item" id="setting-license">
        <div class="list-item-content">
          <div class="list-item-title">이미지 출처 및 라이선스</div>
        </div>
        <div class="list-item-action">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- 개인정보처리방침 -->
    <div style="text-align:center; margin-top:var(--space-8); margin-bottom:-12px;">
      <a href="https://0729.notion.site/336c0180451480a4b0a8c60dba754daf?source=copy_link" target="_blank" rel="noopener noreferrer" style="color:var(--color-text-tertiary); font-size:var(--text-xs); text-decoration:underline; opacity:0.8;">
        개인정보처리방침
      </a>
    </div>

    <!-- 앱 버전 정보 -->
    <div style="text-align:center;padding:var(--space-6);color:var(--color-text-tertiary);font-size:var(--text-xs);">
      DayStory v${m.version}
    </div>
  `,h.querySelectorAll(`.theme-option`).forEach(e=>{e.addEventListener(`click`,()=>{let n=e.dataset.theme;t(`theme`,n),h.querySelectorAll(`.theme-option`).forEach(e=>e.classList.remove(`active`)),e.classList.add(`active`),f(`테마: ${g(n)}`,`success`)})}),h.querySelector(`#setting-editor`)?.addEventListener(`click`,()=>{p(`/editor`)}),h.querySelector(`#setting-tutorial`)?.addEventListener(`click`,()=>{localStorage.setItem(`swipe_tutorial_step`,`0`),f(`튜토리얼 초기화`,`success`),p(`/editorstory`)}),h.querySelector(`#setting-license`)?.addEventListener(`click`,()=>{p(`/license`)}),h.querySelector(`#setting-logout`)?.addEventListener(`click`,async()=>{try{l&&await Promise.race([n(l),new Promise(e=>setTimeout(e,2e3))])}catch(e){console.warn(`로그아웃 오류 (무시됨):`,e)}t(`user`,null),t(`profile`,null);let e=document.getElementById(`bottom-nav`);e&&(e.style.display=`none`),window.location.hash=`#/login`,f(`로그아웃 되었습니다`,`success`)}),h.querySelector(`#setting-withdraw`)?.addEventListener(`click`,async()=>{if(!(!l||!l.currentUser)&&confirm(`정말로 회원을 탈퇴하시겠습니까?\\n모든 정보(북마크, 설정 등)가 즉시 삭제되며 복구할 수 없습니다.`))try{let e=l.currentUser,n=e.uid;if(c)try{await o(d(c,`profiles`,n)),(await a(s(u(c,`bookmarks`),i(`user_id`,`==`,n)))).forEach(e=>o(e.ref))}catch(e){console.warn(`DB 데이터 삭제 실패 (일부 무시됨):`,e)}await r(e),f(`회원 탈퇴가 완료되었습니다.`,`success`),t(`user`,null),t(`profile`,null);let m=document.getElementById(`bottom-nav`);m&&(m.style.display=`flex`),p(`/editorstory`)}catch(e){if(console.error(`회원 탈퇴 실패:`,e),e.code===`auth/requires-recent-login`||e.code===`auth/user-token-expired`){f(`보안 정책에 따라 다시 로그인한 뒤 탈퇴하실 수 있습니다.`,`error`),t(`user`,null);let e=document.getElementById(`bottom-nav`);e&&(e.style.display=`none`),p(`/login`)}else f(e.message||`회원 탈퇴 처리 중 오류가 발생했습니다.`,`error`)}}),h}function g(e){return{system:`시스템 설정`,light:`라이트`,dark:`다크`}[e]}export{h as renderSettings};