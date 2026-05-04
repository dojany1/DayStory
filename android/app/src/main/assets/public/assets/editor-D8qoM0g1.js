import{n as e,t}from"./cropper-DRzLYBQ1.js";import{n}from"./state-BzUx61zh.js";import{t as r}from"./firebase-CTTG2K72.js";import{c as i,g as a,h as o,i as s,l as c,p as l,u,v as d,y as f}from"./index-C_6SX2a3.js";var p=e(t(),1);function m(){let e=document.createElement(`div`);e.className=`editor-page page`;let t=n(`profile`);if(!t||t.role!==`editor`)return e.innerHTML=`
      <div class="page-header"><h1 class="page-header-title">에디터</h1></div>
      <div class="empty-state">
        <div class="empty-state-title">에디터 권한이 필요합니다</div>
        <div class="empty-state-desc">관리자에게 에디터 권한을 요청하세요</div>
      </div>
    `,e;e.innerHTML=`
    <!-- 헤더: 제목 + 새 일화 버튼 -->
    <div class="page-header">
      <h1 class="page-header-title">콘텐츠 관리</h1>
      <button class="btn btn-primary" id="editor-new" style="padding:var(--space-2) var(--space-4);font-size:var(--text-sm);">
        + 새 일화
      </button>
    </div>

    <!-- 통계 카드: 전체/발행/초안/예약 개수 (클릭 시 필터 역할) -->
    <div class="editor-stats" id="editor-stats">
      <div class="editor-stat active" data-filter="all"><span class="editor-stat-value" id="stat-total">-</span><span class="editor-stat-label">전체</span></div>
      <div class="editor-stat" data-filter="published"><span class="editor-stat-value" id="stat-published">-</span><span class="editor-stat-label">발행됨</span></div>
      <div class="editor-stat" data-filter="scheduled"><span class="editor-stat-value" id="stat-scheduled">-</span><span class="editor-stat-label">예약</span></div>
      <div class="editor-stat" data-filter="draft"><span class="editor-stat-value" id="stat-draft">-</span><span class="editor-stat-label">초안</span></div>
    </div>

    <!-- 일화 목록 -->
    <div id="editor-list" class="editor-list">
      <div style="display:flex;justify-content:center;padding:var(--space-8);">
        <div class="loading-spinner"></div>
      </div>
    </div>
  `;let r=[],i=`all`;async function a(){r=await u(),o(),l()}function o(){let e=e=>document.getElementById(e);e(`stat-total`)&&(e(`stat-total`).textContent=r.length,e(`stat-published`).textContent=r.filter(e=>e.status===`published`).length,e(`stat-draft`).textContent=r.filter(e=>e.status===`draft`).length,e(`stat-scheduled`).textContent=r.filter(e=>e.status===`scheduled`).length)}function l(){let e=document.getElementById(`editor-list`);if(!e)return;let t=i===`all`?r:r.filter(e=>e.status===i);if(!t.length){e.innerHTML=`
        <div class="empty-state" style="padding:var(--space-6);">
          <div class="empty-state-title">아직 콘텐츠가 없습니다</div>
        </div>
      `;return}e.innerHTML=t.map(e=>{let t=new Date(e.publish_date),n=`${t.getFullYear()}.${t.getMonth()+1}.${t.getDate()}`,r={published:`<span class="badge badge-accent">발행됨</span>`,draft:`<span class="badge" style="background:var(--color-text-tertiary);color:#fff;">초안</span>`,scheduled:`<span class="badge" style="background:var(--color-info);color:#fff;">예약</span>`,archived:`<span class="badge" style="background:var(--color-bg-secondary);">보관</span>`}[e.status]||``;return`
        <div class="editor-item" data-id="${e.id}">
          <div class="editor-item-thumb">
            ${e.image_url?`<img src="${e.image_url}" alt="" />`:`<div style="width:100%;height:100%;background:var(--color-bg-secondary);display:flex;align-items:center;justify-content:center;">📷</div>`}
          </div>
          <div class="editor-item-info">
            <div class="editor-item-meta">${n} · ${e.country||`-`} ${r}</div>
            <div class="editor-item-title">${e.title||e.figure_name}</div>
          </div>
          <div class="editor-item-actions">
            <button class="editor-edit-btn" data-id="${e.id}" aria-label="편집">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
            <button class="editor-delete-btn" data-id="${e.id}" aria-label="삭제">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </div>
      `}).join(``),e.querySelectorAll(`.editor-edit-btn`).forEach(e=>{e.addEventListener(`click`,t=>{t.stopPropagation(),d(`/editor/new?edit=${e.dataset.id}`)})}),e.querySelectorAll(`.editor-delete-btn`).forEach(e=>{e.addEventListener(`click`,async t=>{if(t.stopPropagation(),confirm(`이 일화를 삭제하시겠습니까?`))try{await c(e.dataset.id),s(`삭제 완료`,`success`),a()}catch(e){s(`삭제 실패: `+e.message,`error`)}})})}return setTimeout(()=>{document.getElementById(`editor-new`)?.addEventListener(`click`,()=>{d(`/editor/new`)}),e.querySelectorAll(`.editor-stat`).forEach(t=>{t.addEventListener(`click`,()=>{e.querySelectorAll(`.editor-stat`).forEach(e=>e.classList.remove(`active`)),t.classList.add(`active`),i=t.dataset.filter,l()})}),a()},0),e}function h(){let e=document.createElement(`div`);e.className=`editor-new-page page`;let t=n(`profile`);if(!t||t.role!==`editor`)return e.innerHTML=`
      <div class="page-header"><h1 class="page-header-title">권한 없음</h1></div>
    `,e;let c=window.location.hash,d=null;c.includes(`?`)&&(d=new URLSearchParams(c.split(`?`)[1]).get(`edit`)),e.innerHTML=`
    <!-- 상단 헤더 -->
    <div class="editor-new-header">
      <button class="page-header-back" id="editor-new-back">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
      </button>
      <h1 class="page-header-title" style="flex:1; text-align:center;">${d?`일화 수정`:`새 일화 작성`}</h1>
      <div style="width:36px;"></div> <!-- 중앙 정렬 맞춤용 -->
    </div>

    <!-- 미리보기 -->
    <div class="editor-preview-section">
      <div class="preview-scale-wrapper" id="editor-preview-area">
        <!-- 스켈레톤 상태나 카드가 렌더링 될 영역 -->
      </div>
      <div style="text-align:center; margin-top:var(--space-3); font-size:var(--text-xs); color:var(--color-text-tertiary);"></div>
    </div>

    <!-- 입력 폼 -->
    <div class="editor-form-section section">
      <form id="story-form" class="story-form">
        <!-- 1. 제목 (가로 단독) -->
        <div class="input-group">
          <label class="input-label">제목 (인물/사건명) *</label>
          <input class="input-field" id="sf-title" placeholder="예: Isaac Newton" required />
        </div>

        <!-- 2. 역사적 연도 / 발행일 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
          <div class="input-group">
            <label class="input-label">역사적 연도</label>
            <input class="input-field" type="number" id="sf-hist-year" placeholder="1666" />
          </div>
          <div class="input-group">
            <label class="input-label">발행일 *</label>
            <input class="input-field" type="date" id="sf-publish-date" required />
          </div>
        </div>

        <!-- 3. 국가 -->
        <div class="input-group">
          <label class="input-label">국가</label>
          <input class="input-field" id="sf-country" placeholder="영국" />
        </div>

        <!-- 4. 본문 -->
        <div class="input-group">
          <label class="input-label">본문 *</label>
          <textarea class="input-field" id="sf-body" placeholder="역사 일화 본문을 입력하세요..." style="min-height:200px; resize:vertical; line-height:1.6; font-family:var(--font-body);" required></textarea>
        </div>

        <!-- 4-1. 에디터 한마디 -->
        <div class="input-group">
          <label class="input-label">에디터 한마디</label>
          <textarea class="input-field" id="sf-editor-comment" placeholder="카드 뒷면에 표시될 에디터의 코멘트" rows="3" style="resize:vertical; line-height:1.6; font-family:var(--font-body);"></textarea>
        </div>

        <!-- 5. 이미지 업로드/URL -->
        <div class="input-group">
          <label class="input-label">이미지 업로드 및 URL</label>
          <div style="display:flex; gap:var(--space-2); align-items:center;">
            <input class="input-field" id="sf-image" placeholder="URL 직접 입력 또는 사진 선택" style="flex:1;" />
            <button type="button" id="sf-image-edit-btn" class="btn btn-secondary" style="display:none; margin:0; padding:var(--space-2) var(--space-3); font-size:var(--text-sm); white-space:nowrap;">편집</button>
            <label for="sf-image-file" class="btn btn-secondary" style="cursor:pointer; margin:0; padding:var(--space-2) var(--space-3); font-size:var(--text-sm); white-space:nowrap;">
              사진 추가
            </label>
            <input type="file" id="sf-image-file" accept="image/*" style="display:none;" />
          </div>
          <div id="sf-image-status" style="font-size:var(--text-xs); color:var(--color-primary); margin-top:var(--space-1); display:none;">사진을 업로드하는 중입니다... ⏳</div>
        </div>

        <!-- 6. 이미지 출처 및 라이선스 -->
        <div class="input-group">
          <label class="input-label">이미지 출처 및 라이선스</label>
          <input class="input-field" id="sf-image-source" placeholder="예: Unsplash (CC0), Wikimedia Commons" />
        </div>

        <div style="display:flex;flex-direction:column;gap:var(--space-3);margin-top:var(--space-6);margin-bottom:var(--space-10);">
          <button type="submit" class="btn btn-primary btn-full" style="font-size:var(--text-md); padding:var(--space-4);">발행하기</button>
          <div style="display:flex;gap:var(--space-3);">
            <button type="button" class="btn btn-secondary btn-full" id="sf-save-draft">초안 저장</button>
            <button type="button" class="btn btn-full" id="sf-schedule" style="background:var(--color-info);color:#fff;border:none;">예약 발행</button>
          </div>
        </div>
      </form>
    </div>
  `;let m=!1,h=!1,g=e=>{m&&!h&&(e.preventDefault(),e.returnValue=``)};window.addEventListener(`beforeunload`,g),f(e=>!h&&m&&!window.confirm(`저장되지 않은 정보가 있습니다. 정말 나가시겠습니까?`)?!1:(window.removeEventListener(`beforeunload`,g),f(null),!0)),setTimeout(async()=>{let e=!1,t=[];try{t=await u()}catch{}if(d){let t=await l(d);t&&(document.getElementById(`sf-hist-year`).value=t.historical_year||``,document.getElementById(`sf-publish-date`).value=t.publish_date||``,document.getElementById(`sf-title`).value=t.title||t.figure_name||``,document.getElementById(`sf-country`).value=t.country||``,document.getElementById(`sf-body`).value=t.body||``,document.getElementById(`sf-image`).value=t.image_url||``,document.getElementById(`sf-image-source`).value=t.image_source||``,document.getElementById(`sf-editor-comment`).value=t.editor_comment||t.editor&&t.editor.comment||``,e=!0)}document.getElementById(`editor-new-back`)?.addEventListener(`click`,()=>{history.back()});function c(){let e=document.getElementById(`sf-image`)?.value.trim(),t=document.getElementById(`sf-image-edit-btn`);t&&(t.style.display=e?`inline-block`:`none`)}let f=document.getElementById(`story-form`);f&&f.addEventListener(`input`,()=>{m=!0,_(),c()}),_(e),c();async function g(e,t=!1,n){let r=e;if(t){if(!(e.includes(`firebasestorage.googleapis.com`)||e.includes(`.firebasestorage.app`))){s(`외부 이미지는 편집할 수 없습니다.
[사진 추가]로 새 이미지를 업로드해주세요.`,`error`);return}try{let t=await fetch(e);if(!t.ok)throw Error(`이미지 다운로드 실패`);let n=await t.blob();r=URL.createObjectURL(n)}catch(e){console.error(`이미지 fetch 실패:`,e),s(`이미지를 불러올 수 없습니다. 다시 시도해주세요.`,`error`);return}}let i=document.createElement(`div`);i.className=`crop-modal-overlay`,i.innerHTML=`
        <div class="crop-modal-header">자르기 및 회전</div>
        <div class="crop-modal-body">
          <img id="cropper-image" src="${r}" style="max-width: 100%; display: block;" />
        </div>
        <div class="crop-modal-footer">
          <button type="button" class="btn-rotate" id="btn-crop-rotate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.53-11.23l5.67 5.66" />
            </svg>
            회전
          </button>
          <button type="button" class="btn-crop-confirm" id="btn-crop-confirm">다음</button>
        </div>
      `,(document.querySelector(`.mobile-wrapper`)||document.body).appendChild(i),setTimeout(()=>i.style.opacity=`1`,10);let a=i.querySelector(`#cropper-image`),o;a.onload=()=>{o=new p.default(a,{aspectRatio:3/4.8,viewMode:1,dragMode:`move`,autoCropArea:.9,restore:!1,guides:!0,center:!0,highlight:!1,cropBoxMovable:!0,cropBoxResizable:!0,toggleDragModeOnDblclick:!1})},a.onerror=()=>{s(`이미지를 불러올 수 없어 편집이 제한됩니다.`,`error`),t&&r.startsWith(`blob:`)&&URL.revokeObjectURL(r),i.remove()},i.querySelector(`#btn-crop-rotate`).addEventListener(`click`,()=>{o&&o.rotate(90)}),i.querySelector(`#btn-crop-confirm`).addEventListener(`click`,()=>{let e=i.querySelector(`#btn-crop-confirm`);e.textContent=`처리 중...`,e.disabled=!0,o&&o.getCroppedCanvas({maxWidth:1200,maxHeight:1920,imageSmoothingEnabled:!0,imageSmoothingQuality:`high`}).toBlob(async a=>{if(!a){s(`크롭 오류가 발생했습니다.`,`error`),e.textContent=`다음`,e.disabled=!1;return}i.style.opacity=`0`,setTimeout(()=>{o.destroy(),t&&r.startsWith(`blob:`)&&URL.revokeObjectURL(r),i.remove()},300),n(a)},`image/jpeg`,.85)})}async function v(e,t){let n=document.getElementById(`sf-image-status`),r=document.getElementById(`sf-image`);if(!(!n||!r))try{n.style.display=`block`,n.style.color=`var(--color-primary)`,n.textContent=`사진을 업로드하는 중입니다... ⏳`,e.name=t,r.value=await a(e),n.textContent=`업로드 완료! ✅`,n.style.color=`var(--color-info)`,m=!0,r.dispatchEvent(new Event(`input`,{bubbles:!0}))}catch(e){console.error(`이미지 업로드 오류:`,e),n.style.color=`var(--color-error)`,n.textContent=`업로드 실패: `+e.message,s(`이미지 업로드 실패: `+e.message,`error`)}finally{let e=document.getElementById(`sf-image-file`);e&&(e.value=``),setTimeout(()=>{n&&n.textContent.includes(`완료`)&&(n.style.display=`none`)},3e3)}}document.getElementById(`sf-image-file`)?.addEventListener(`change`,e=>{let t=e.target.files[0];if(!t)return;let n=new FileReader;n.onload=e=>{g(e.target.result,!1,e=>{v(e,t.name||`cropped_image.jpeg`)})},n.readAsDataURL(t)}),document.getElementById(`sf-image-edit-btn`)?.addEventListener(`click`,async()=>{let e=document.getElementById(`sf-image`)?.value.trim();e&&g(e,!0,e=>{v(e,`edited_image.jpeg`)})});let y=document.getElementById(`sf-schedule`),b=document.getElementById(`sf-publish-date`);function x(){if(!y||!b)return;let e=b.value;if(!e){y.disabled=!0,y.style.opacity=`0.4`,y.title=`발행일을 먼저 선택하세요`;return}let t=new Date(e+`T00:00:00`),n=new Date;n.setHours(0,0,0,0);let r=t>n;y.disabled=!r,y.style.opacity=r?`1`:`0.4`,y.title=r?``:`예약 발행일은 미래 날짜여야 합니다`}x(),b?.addEventListener(`change`,e=>{let n=e.target.value;n&&t.find(e=>e.publish_date===n&&String(e.id)!==String(d))&&(s(`이미 등록된 일화가 있는 날짜입니다.`,`error`),e.target.value=``,m=!0,_()),x()});function S(){let e=document.getElementById(`sf-title`).value.trim(),t=parseInt(document.getElementById(`sf-hist-year`).value)||null,i=r?.currentUser,a=n(`user`),o=n(`profile`)||{},s={uid:i?.uid||a?.id||`dokhubooks_uid`,email:i?.email||a?.email||`dokhubooks@gmail.com`,displayName:i?.displayName||o.displayName||(a?.email?a.email.split(`@`)[0]:`DayStory`),photoURL:i?.photoURL||o.photoURL||``};return{figure_name:e,title:e,summary:``,body:document.getElementById(`sf-body`).value.trim(),historical_date:t?`${t}년`:``,historical_year:t,country:document.getElementById(`sf-country`).value.trim(),publish_date:document.getElementById(`sf-publish-date`).value,image_url:document.getElementById(`sf-image`).value.trim(),image_source:document.getElementById(`sf-image-source`).value.trim(),card_count:``,editor:s,editor_comment:document.getElementById(`sf-editor-comment`).value.trim()}}document.getElementById(`sf-save-draft`)?.addEventListener(`click`,async()=>{h=!0;let e=S();e.status=`draft`;try{d?(await o(d,e),s(`초안 저장 완료`,`success`)):(await i(e),s(`초안 생성 완료`,`success`)),history.back()}catch(e){h=!1,s(`저장 실패: `+e.message,`error`)}}),f?.addEventListener(`submit`,async e=>{e.preventDefault(),h=!0;let t=S();t.status=`published`,t.published_at=new Date().toISOString();try{d?(await o(d,t),s(`수정 및 발행 완료`,`success`)):(await i(t),s(`새 일화 발행 완료!`,`success`)),history.back()}catch(e){h=!1,s(`발행 실패: `+e.message,`error`)}}),document.getElementById(`sf-schedule`)?.addEventListener(`click`,async()=>{let e=S();if(!e.publish_date){s(`예약 발행일을 선택해주세요`,`error`);return}e.publish_date=e.publish_date.split(`T`)[0],e.scheduled_date=e.publish_date,h=!0,e.status=`scheduled`;try{d?await o(d,e):await i(e),s(`${e.publish_date}에 발행 예약됨`,`success`),history.back()}catch(e){h=!1,s(`예약 실패: `+e.message,`error`)}})},0);function _(t=!1){let i=e.querySelector(`#editor-preview-area`);if(!i)return;let a=document.getElementById(`sf-title`)?.value.trim(),o=document.getElementById(`sf-body`)?.value.trim(),s=document.getElementById(`sf-image`)?.value.trim();if(!t&&!a&&!o&&!s){i.innerHTML=`<div style="width:360px; max-width:100%; zoom:0.7;"><div class="skeleton-card"></div></div>`;return}let c=e=>(e||``).replace(/[&<>'"]/g,e=>({"&":`&amp;`,"<":`&lt;`,">":`&gt;`,"'":`&#39;`,'"':`&quot;`})[e]),l=c(a||`제목 없음`),u=(o||`본문이 표시됩니다...`).split(/\n|\\n/).map(e=>e.trim()?`<p>${c(e)}</p>`:`<p><br></p>`).join(``),d=c(document.getElementById(`sf-hist-year`)?.value||`???`),f=c(document.getElementById(`sf-country`)?.value||``),p=document.getElementById(`sf-publish-date`)?.value;p||=new Date().toISOString().split(`T`)[0];let m=new Date(p),h=m.getMonth()+1,g=m.getDate(),_=new Date().getFullYear(),v=s||`data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='400' viewBox='0 0 300 400'%3E%3Crect fill='%23e0e0e0' width='300' height='400'/%3E%3Ctext x='50%25' y='45%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='40'%3E%F0%9F%93%B7%3C/text%3E%3Ctext x='50%25' y='58%25' dominant-baseline='middle' text-anchor='middle' fill='%23999' font-size='14' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E`,y=r?.currentUser,b=n(`profile`)||{},x=y?.photoURL||b.photoURL||``,S=c(document.getElementById(`sf-editor-comment`)?.value.trim()||``);i.innerHTML=`
        <div class="flip-container">
          <div class="flipper" id="preview-flipper">
            <div class="front history-card-front">
              <div class="history-card-top">
                <div class="card-top-left">
                  <div class="card-year">${d}</div>
                  <div class="card-date">${h}. ${g}</div>
                </div>
                <div class="card-top-right">
                  <div class="card-actions">
                    <!-- 미리보기용 비활성 액션 버튼 -->
                    <button class="card-action-btn" aria-label="공유" disabled>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                    </button>
                    <button class="card-action-btn" aria-label="북마크" disabled>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    </button>
                  </div>
                  <div class="card-meta">
                    ${f}<br>
                    ${_} / ${String(h).padStart(2,`0`)} / ${String(g).padStart(2,`0`)}
                  </div>
                </div>
              </div>
              <div class="history-card-image-wrap">
                <img src="${c(v)}" alt="${l}" onerror="this.style.display='none'" draggable="false" />
                <div class="card-image-title">${l}</div>
              </div>
            </div>
            <div class="back history-card-back">
              <div class="back-title">${l}</div>
              <hr class="back-divider" />
              <div class="back-body">
                ${u||`<p>본문이 표시됩니다...</p>`}
              </div>
              <div class="back-footer">
                <button class="back-editor-btn" type="button" title="에디터 한마디" style="${S&&S.trim()!==``?``:`visibility: hidden; pointer-events: none;`}">
                  <img src="${c(x)}" alt="editor" class="back-editor-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" />
                  <span class="back-editor-avatar-fallback" style="display:none">✍️</span>
                </button>
                <div class="back-date">${d}년 ${h}월 ${g}일</div>
              </div>
            </div>
          </div>
        </div>
    `;let C=i.querySelector(`#preview-flipper`);C&&C.addEventListener(`click`,e=>{e.target.closest(`.back-editor-btn`)||C.classList.toggle(`flipped`)});let w=i.querySelector(`.back-editor-btn`);if(w){let e=e=>{e&&(e.stopPropagation(),e.type===`touchend`&&e.preventDefault());let t=document.getElementById(`sf-editor-comment`)?.value.trim()||`에디터 코멘트가 없습니다.`,n=i.querySelector(`.editor-comment-bubble`);if(n){n.remove();return}let r=document.createElement(`div`);r.className=`editor-comment-bubble`,r.textContent=t,w.parentElement.appendChild(r),setTimeout(()=>{r.parentNode&&r.remove()},3e3)};w.addEventListener(`click`,e),w.addEventListener(`touchend`,e)}}return e}export{m as renderEditor,h as renderEditorNew};