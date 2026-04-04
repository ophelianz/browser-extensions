(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=7373,t=chrome.storage.local;function n(e,t){return chrome.i18n.getMessage(e,t)||e}function r(){return chrome.i18n.getUILanguage?.()||navigator.language||`en`}function i(t){return typeof t==`number`?t:e}function a(e){let t=new AbortController,n=setTimeout(()=>t.abort(),e);return t.signal.addEventListener(`abort`,()=>clearTimeout(n),{once:!0}),t.signal}async function o(){return new Promise((n,r)=>{t.get({port:e},e=>{if(chrome.runtime.lastError){r(Error(chrome.runtime.lastError.message));return}n({port:i(e.port)})})})}async function s(e){return new Promise((n,r)=>{t.set(e,()=>{if(chrome.runtime.lastError){r(Error(chrome.runtime.lastError.message));return}n()})})}async function c(e){try{return(await fetch(`http://localhost:${e}/health`,{signal:a(2e3)})).ok}catch{return!1}}function l(e){let t=e?`<span class="inline-block w-2 h-2 rounded-full bg-accent mr-1.5"></span>`:`<span class="inline-block w-2 h-2 rounded-full bg-destructive mr-1.5"></span>`,r=n(e?`statusConnected`:`statusNotRunning`);return`${t}<span class="${e?`text-accent`:`text-destructive`}">${r}</span>`}function u(t){let i=document.getElementById(`root`),a=n(`actionTitle`),o=n(`defaultPortLabel`,String(e));document.title=a,document.documentElement.lang=r(),i.innerHTML=`
    <div class="w-[320px] p-4 space-y-4">

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <img src="/icon-32.png" class="w-5 h-5" alt="${a}" />
          <span class="text-sm font-semibold tracking-tight">${a}</span>
        </div>
        <div class="flex items-center text-xs" id="status">
          <span class="text-muted-fg">${n(`statusChecking`)}</span>
        </div>
      </div>

      <div class="h-px bg-white/5"></div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-fg mb-3">${n(`connectionLabel`)}</p>
        <div class="bg-surface rounded-xl p-3 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <label class="text-xs text-on-surface-alt" for="port-input">${n(`portLabel`)}</label>
            <div class="flex items-center gap-2">
              <input
                id="port-input"
                type="number"
                min="1024"
                max="65535"
                value="${t.port}"
                class="w-24 bg-surface-alt border border-white/10 rounded-lg px-2.5 py-1 text-xs text-on-surface text-right focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors"
              />
              <span class="text-xs text-muted-fg">${o}</span>
            </div>
          </div>
        </div>
        <span class="text-s text-red-500">${n(`popupWarningMatch`)} </span>
      </div>

      <div class="flex items-center gap-3">
        <button
          id="save-btn"
          class="px-3 py-1.5 text-xs font-semibold bg-accent text-bg rounded-lg hover:bg-accent-dim transition-colors"
        >
          ${n(`saveButton`)}
        </button>
        <span id="save-feedback" class="text-xs text-muted-fg opacity-0 transition-opacity duration-300">${n(`saveFeedback`)}</span>
      </div>

    </div>
  `;let u=document.getElementById(`port-input`),d=document.getElementById(`save-btn`),f=document.getElementById(`status`),p=document.getElementById(`save-feedback`);async function m(e){f.innerHTML=`<span class="text-muted-fg text-xs">${n(`statusChecking`)}</span>`,f.innerHTML=l(await c(e))}m(t.port),u.addEventListener(`change`,()=>{let e=parseInt(u.value,10);e>=1024&&e<=65535&&m(e)}),d.addEventListener(`click`,async()=>{let e=parseInt(u.value,10);e<1024||e>65535||(await s({port:e}),p.style.opacity=`1`,setTimeout(()=>p.style.opacity=`0`,2e3),m(e))})}async function d(){u({port:e});try{u(await o())}catch(e){let t=document.getElementById(`root`);t.innerHTML=`
          <div class="w-[320px] min-h-[220px] p-4 flex items-center">
            <p class="text-sm text-destructive">${n(`loadError`)}</p>
          </div>
        `,console.error(`Failed to load popup`,e)}}d();