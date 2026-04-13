(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=7373,t={port:e,enabled:!0};function n(t){return typeof t==`number`&&Number.isInteger(t)&&t>=1024&&t<=65535?t:e}function r(e){return typeof e==`boolean`?e:t.enabled}function i(e){return{port:n(e.port),enabled:r(e.enabled)}}var a=chrome.storage.local;function o(e,t){return chrome.i18n.getMessage(e,t)||e}function s(){return chrome.i18n.getUILanguage?.()||navigator.language||`en`}function c(e){let t=new AbortController,n=setTimeout(()=>t.abort(),e);return t.signal.addEventListener(`abort`,()=>clearTimeout(n),{once:!0}),t.signal}async function l(){return new Promise((e,n)=>{a.get(t,t=>{if(chrome.runtime.lastError){n(Error(chrome.runtime.lastError.message));return}e(i(t))})})}async function u(e){return new Promise((t,n)=>{a.set(e,()=>{if(chrome.runtime.lastError){n(Error(chrome.runtime.lastError.message));return}t()})})}async function d(e){try{let t=await fetch(`http://localhost:${e}/health`,{signal:c(2e3)});return t.ok?(await t.json()).app===`ophelia`:!1}catch{return!1}}function f(e){let t=e?`<span class="inline-block w-2 h-2 rounded-full bg-accent mr-1.5"></span>`:`<span class="inline-block w-2 h-2 rounded-full bg-destructive mr-1.5"></span>`,n=o(e?`statusConnected`:`statusNotRunning`);return`${t}<span class="${e?`text-accent`:`text-destructive`}">${n}</span>`}function p(e){return e?`bg-accent border-accent/70 shadow-[0_0_0_1px_rgba(126,211,127,0.15)]`:`bg-surface-alt border-white/10`}function m(e){return e?`translate-x-4 bg-bg`:`translate-x-0 bg-white`}function h(t){let n=document.getElementById(`root`),r=o(`actionTitle`),i=o(`defaultPortLabel`,String(e));document.title=r,document.documentElement.lang=s(),n.innerHTML=`
    <div class="w-[320px] p-4 space-y-4">

      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <img src="/icon-32.png" class="w-5 h-5" alt="${r}" />
          <span class="text-sm font-semibold tracking-tight">${r}</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="inline-flex min-h-8 items-center rounded-full border border-white/10 bg-surface px-2.5 py-1 text-xs" id="status">
            <span class="text-muted-fg">${o(`statusChecking`)}</span>
          </div>
          <button
            id="enabled-switch"
            type="button"
            role="switch"
            aria-label="${o(`enabledLabel`)}"
            aria-checked="${t.enabled?`true`:`false`}"
            class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 ${p(t.enabled)}"
          >
            <span
              id="enabled-switch-thumb"
              class="pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200 ${m(t.enabled)}"
            ></span>
          </button>
        </div>
      </div>

      <div class="h-px bg-white/5"></div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-fg mb-3">${o(`connectionLabel`)}</p>
        <div class="bg-surface rounded-xl p-3 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <label class="text-xs text-on-surface-alt" for="port-input">${o(`portLabel`)}</label>
            <div class="flex items-center gap-2">
              <input
                id="port-input"
                type="number"
                min="1024"
                max="65535"
                value="${t.port}"
                class="w-24 bg-surface-alt border border-white/10 rounded-lg px-2.5 py-1 text-xs text-on-surface text-right focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors"
              />
              <span class="text-xs text-muted-fg">${i}</span>
            </div>
          </div>
        </div>
        <p class="mt-2 text-[11px] leading-relaxed text-muted-fg/90">${o(`popupWarningMatch`)}</p>
      </div>

      <div class="flex items-center gap-3">
        <button
          id="save-btn"
          class="px-3 py-1.5 text-xs font-semibold bg-accent text-bg rounded-lg hover:bg-accent-dim transition-colors"
        >
          ${o(`saveButton`)}
        </button>
        <span id="save-feedback" class="text-xs text-muted-fg opacity-0 transition-opacity duration-300">${o(`saveFeedback`)}</span>
      </div>

    </div>
  `;let a=document.getElementById(`port-input`),c=document.getElementById(`enabled-switch`),h=document.getElementById(`enabled-switch-thumb`),g=document.getElementById(`save-btn`),_=document.getElementById(`status`),v=document.getElementById(`save-feedback`),y={...t},b={...t};function x(){a.value=String(b.port),c.setAttribute(`aria-checked`,b.enabled?`true`:`false`),c.className=`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 ${p(b.enabled)}`,h.className=`pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200 ${m(b.enabled)}`}async function S(){if(!y.enabled){_.innerHTML=f(!1);return}_.innerHTML=`<span class="text-muted-fg text-xs">${o(`statusChecking`)}</span>`,_.innerHTML=f(await d(y.port))}x(),S(),a.addEventListener(`input`,()=>{let e=parseInt(a.value,10);Number.isInteger(e)&&e>=1024&&e<=65535&&(b.port=e)}),c.addEventListener(`click`,()=>{b.enabled=!b.enabled,x()}),g.addEventListener(`click`,async()=>{let e=parseInt(a.value,10);!Number.isInteger(e)||e<1024||e>65535||(b={port:e,enabled:b.enabled},await u(b),y=await l(),b={...y},x(),v.style.opacity=`1`,setTimeout(()=>v.style.opacity=`0`,2e3),S())})}async function g(){h({...t});try{h(await l())}catch(e){let t=document.getElementById(`root`);t.innerHTML=`
          <div class="w-[320px] min-h-[220px] p-4 flex items-center">
            <p class="text-sm text-destructive">${o(`loadError`)}</p>
          </div>
        `,console.error(`Failed to load popup`,e)}}g();