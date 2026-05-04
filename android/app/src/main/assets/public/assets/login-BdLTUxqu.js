const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/web-CNxCLz4P.js","assets/definitions-vit1L4kv.js","assets/dist-DPijVefw.js","assets/index.esm-Chrrxead.js"])))=>i.map(i=>d[i]);
import{r as e}from"./state-BzUx61zh.js";import{B as t,F as n,L as r,i,j as a,m as o}from"./index.esm-Chrrxead.js";import{h as s,n as c,t as l,u,y as d}from"./firebase-CTTG2K72.js";import{r as f,t as p}from"./dist-DPijVefw.js";import{t as m}from"./preload-helper-DzyYoeor.js";import{i as h,v as g}from"./index-C_6SX2a3.js";import"./definitions-vit1L4kv.js";var _=f(`FirebaseAuthentication`,{web:()=>m(()=>import(`./web-CNxCLz4P.js`).then(e=>new e.FirebaseAuthenticationWeb),__vite__mapDeps([0,1,2,3]))}),v=new i,y=`<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>`;function b(){let o=document.createElement(`div`);return o.className=`auth-page page`,o.innerHTML=`
    <!-- 닫기 버튼 -->
    <button id="close-login-btn" class="close-auth-btn" aria-label="닫기">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>

    <!-- 로고 영역 -->
    <div class="auth-logo" style="margin-bottom: var(--space-6);">
      <h1 class="auth-logo-title" style="margin: 0;">DayStory</h1>
      <p class="auth-logo-subtitle" style="margin-top: 5px;">매일의 역사 일화</p>
    </div>

    <!-- 로그인 폼 -->
    <form class="auth-form" id="login-form">
      <div class="input-group">
        <label class="input-label" for="login-email">이메일</label>
        <input class="input-field" type="email" id="login-email"
               placeholder="email@example.com" autocomplete="email" required />
      </div>
      <div class="input-group">
        <label class="input-label" for="login-password">비밀번호</label>
        <input class="input-field" type="password" id="login-password"
               placeholder="비밀번호를 입력하세요" autocomplete="current-password" required />
      </div>
      <button type="submit" class="btn btn-primary btn-full btn-large" id="login-submit">
        <span id="login-btn-text">로그인</span>
      </button>
    </form>

    <!-- 구분선 -->
    <div class="auth-divider">또는</div>

    <!-- Google 소셜 로그인 -->
    <button class="auth-social-btn" id="google-login-btn">
      ${y}
      <span>Google로 계속하기</span>
    </button>

    <!-- 하단 링크 -->
    <div class="auth-footer">
      <p>계정이 없으신가요? <button id="goto-signup">회원가입</button></p>
      <p style="margin-top:var(--space-2)"><button id="forgot-pw">비밀번호를 잊으셨나요?</button></p>
    </div>
  `,setTimeout(()=>{document.getElementById(`close-login-btn`)?.addEventListener(`click`,()=>{document.getElementById(`bottom-nav`).style.display=`flex`,g(`/editorstory`)}),document.getElementById(`login-form`)?.addEventListener(`submit`,async t=>{t.preventDefault();let n=document.getElementById(`login-email`).value.trim(),i=document.getElementById(`login-password`).value;if(!n||!i)return h(`이메일과 비밀번호를 입력하세요`,`warning`);if(!l)return h(`Firebase가 설정되지 않았습니다`,`error`);let a=document.getElementById(`login-btn-text`);a.textContent=`로그인 중...`;try{let t=(await r(l,n,i)).user;e(`user`,{id:t.uid,email:t.email});let a=[`daystory@test.com`,`dokhubooks@gmail.com`].includes(t.email);if(c){let n=d(c,`profiles`,t.uid),r=await u(n),i=r.exists()?r.data():{created_at:new Date().toISOString()};a&&i.role!==`editor`?(i.role=`editor`,await s(n,i,{merge:!0})):r.exists()||await s(n,i),e(`profile`,i)}h(`로그인 성공!`,`success`),document.getElementById(`bottom-nav`).style.display=`flex`,g(`/editorstory`)}catch(e){h(e.message||`로그인 실패`,`error`),a.textContent=`로그인`}}),document.getElementById(`google-login-btn`)?.addEventListener(`click`,async()=>{if(!l)return h(`Firebase가 설정되지 않았습니다`,`error`);try{let r=null;if(p.isNativePlatform()){let e=await _.signInWithGoogle({clientId:`1063822349351-rnk0hgs8gg6nuae0k4ocfl4qhvcg2u2s.apps.googleusercontent.com`});r=(await n(l,i.credential(e.credential?.idToken,e.credential?.accessToken))).user}else r=(await t(l,v)).user;if(!r)throw Error(`사용자 정보를 가져올 수 없습니다.`);if(e(`user`,{id:r.uid,email:r.email}),c)try{let t=d(c,`profiles`,r.uid),n=await u(t),i=n.exists()?n.data():{created_at:new Date().toISOString()};[`daystory@test.com`,`dokhubooks@gmail.com`].includes(r.email)&&i.role!==`editor`?(i.role=`editor`,await s(t,i,{merge:!0})):n.exists()||await s(t,i),e(`profile`,i)}catch(e){console.warn(`구글 로그인 - 프로필 로드 실패`,e)}h(`구글 로그인 성공!`,`success`),document.getElementById(`bottom-nav`).style.display=`flex`,g(`/editorstory`)}catch(e){h(e.message||`Google 로그인 실패`,`error`)}}),document.getElementById(`goto-signup`)?.addEventListener(`click`,()=>g(`/signup`)),document.getElementById(`forgot-pw`)?.addEventListener(`click`,async()=>{let e=document.getElementById(`login-email`).value.trim();if(!e)return h(`이메일을 먼저 입력하세요`,`warning`);if(!l)return h(`Firebase가 설정되지 않았습니다`,`error`);try{await a(l,e),h(`비밀번호 재설정 이메일이 발송되었습니다`,`success`)}catch(e){h(e.message||`이메일 발송 실패`,`error`)}})},0),o}function x(){let t=document.createElement(`div`);return t.className=`auth-page page`,t.innerHTML=`
    <!-- 닫기 버튼 -->
    <button id="close-signup-btn" class="close-auth-btn" aria-label="닫기">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    </button>

    <!-- 로고 영역 -->
    <div class="auth-logo" style="margin-bottom: var(--space-6);">
      <h1 class="auth-logo-title" style="margin: 0;">회원가입</h1>
      <p class="auth-logo-subtitle" style="margin-top: 5px;">매일 새로운 역사 카드를 만나보세요</p>
    </div>

    <!-- 회원가입 폼 -->
    <form class="auth-form" id="signup-form">
      <div class="input-group">
        <label class="input-label" for="signup-email">이메일</label>
        <input class="input-field" type="email" id="signup-email"
               placeholder="email@example.com" autocomplete="email" required />
      </div>
      <div class="input-group">
        <label class="input-label" for="signup-password">비밀번호</label>
        <input class="input-field" type="password" id="signup-password"
               placeholder="8자 이상" autocomplete="new-password" minlength="8" required />
      </div>
      <div class="input-group">
        <label class="input-label" for="signup-password2">비밀번호 확인</label>
        <input class="input-field" type="password" id="signup-password2"
               placeholder="비밀번호를 한번 더 입력하세요" autocomplete="new-password" required />
      </div>

      <!-- 이용약관 동의 -->
      <label style="display:flex;align-items:flex-start;gap:var(--space-2);font-size:var(--text-sm);color:var(--color-text-secondary);cursor:pointer;">
        <input type="checkbox" id="agree-terms" required style="margin-top:3px;" />
        <span>이용약관 및 개인정보 처리방침에 동의합니다</span>
      </label>

      <button type="submit" class="btn btn-primary btn-full btn-large" id="signup-submit">
        <span id="signup-btn-text">가입하기</span>
      </button>
    </form>

    <!-- 하단 링크 -->
    <div class="auth-footer">
      <p>이미 계정이 있으신가요? <button id="goto-login">로그인</button></p>
    </div>
  `,setTimeout(()=>{document.getElementById(`close-signup-btn`)?.addEventListener(`click`,()=>{document.getElementById(`bottom-nav`).style.display=`flex`,g(`/editorstory`)}),document.getElementById(`signup-form`)?.addEventListener(`submit`,async t=>{t.preventDefault();let n=document.getElementById(`signup-email`).value.trim(),r=document.getElementById(`signup-password`).value;if(r!==document.getElementById(`signup-password2`).value)return h(`비밀번호가 일치하지 않습니다`,`error`);if(!l)return h(`Firebase가 설정되지 않았습니다`,`error`);let i=document.getElementById(`signup-btn-text`);i.textContent=`가입 중...`;try{let t=(await o(l,n,r)).user;e(`user`,{id:t.uid,email:t.email});let i=[`daystory@test.com`,`dokhubooks@gmail.com`].includes(t.email);if(c){let n=d(c,`profiles`,t.uid),r=await u(n),a=r.exists()?r.data():{created_at:new Date().toISOString()};i&&a.role!==`editor`?(a.role=`editor`,await s(n,a,{merge:!0})):r.exists()||await s(n,a),e(`profile`,a)}h(`회원가입 완료!`,`success`),document.getElementById(`bottom-nav`).style.display=`flex`,g(`/editorstory`)}catch(e){h(e.message||`회원가입 실패`,`error`),i.textContent=`가입하기`}}),document.getElementById(`goto-login`)?.addEventListener(`click`,()=>g(`/login`))},0),t}export{b as renderLogin,x as renderSignup};