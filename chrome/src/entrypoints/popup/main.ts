import '../../assets/tailwind.css';

import {
    DEFAULT_PORT,
    DEFAULT_SETTINGS,
    resolveSettings,
    type Settings,
} from '../../lib/settings';

const storageArea = chrome.storage.local;

type HealthResponse = {
    app?: unknown;
    version?: unknown;
};

type MessageName =
    | 'actionTitle'
    | 'connectionLabel'
    | 'defaultPortLabel'
    | 'enabledLabel'
    | 'loadError'
    | 'portLabel'
    | 'popupWarningMatch'
    | 'saveButton'
    | 'saveFeedback'
    | 'statusChecking'
    | 'statusConnected'
    | 'statusNotRunning';

function t(name: MessageName, substitutions?: string | string[]): string {
    return chrome.i18n.getMessage(name, substitutions) || name;
}

function getUiLanguage(): string {
    return chrome.i18n.getUILanguage?.() || navigator.language || 'en';
}

function createTimeoutSignal(timeoutMs: number): AbortSignal {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), {
        once: true,
    });

    return controller.signal;
}

async function loadSettings(): Promise<Settings> {
    return new Promise((resolve, reject) => {
        storageArea.get(DEFAULT_SETTINGS, (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            resolve(resolveSettings(result));
        });
    });
}

async function saveSettings(settings: Settings): Promise<void> {
    return new Promise((resolve, reject) => {
        storageArea.set(settings, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            resolve();
        });
    });
}

async function checkConnection(port: number): Promise<boolean> {
    try {
        const res = await fetch(`http://localhost:${port}/health`, {
            signal: createTimeoutSignal(2000),
        });
        if (!res.ok) return false;

        const body = (await res.json()) as HealthResponse;
        return body.app === 'ophelia';
    } catch {
        return false;
    }
}

function renderStatus(connected: boolean): string {
    const dot = connected
        ? `<span class="inline-block w-2 h-2 rounded-full bg-accent mr-1.5"></span>`
        : `<span class="inline-block w-2 h-2 rounded-full bg-destructive mr-1.5"></span>`;
    const label = connected ? t('statusConnected') : t('statusNotRunning');
    return `${dot}<span class="${connected ? 'text-accent' : 'text-destructive'}">${label}</span>`;
}

function getSwitchTrackClass(enabled: boolean): string {
    return enabled
        ? 'bg-accent border-accent/70 shadow-[0_0_0_1px_rgba(126,211,127,0.15)]'
        : 'bg-surface-alt border-white/10';
}

function getSwitchThumbClass(enabled: boolean): string {
    return enabled
        ? 'translate-x-4 bg-bg'
        : 'translate-x-0 bg-white';
}

function renderPopup(settings: Settings): void {
    const root = document.getElementById('root')!;
    const extensionTitle = t('actionTitle');
    const defaultPortText = t('defaultPortLabel', String(DEFAULT_PORT));

    document.title = extensionTitle;
    document.documentElement.lang = getUiLanguage();

    root.innerHTML = `
    <div class="w-[320px] p-4 space-y-4">

      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <img src="/icon-32.png" class="w-5 h-5" alt="${extensionTitle}" />
          <span class="text-sm font-semibold tracking-tight">${extensionTitle}</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="inline-flex min-h-8 items-center rounded-full border border-white/10 bg-surface px-2.5 py-1 text-xs" id="status">
            <span class="text-muted-fg">${t('statusChecking')}</span>
          </div>
          <button
            id="enabled-switch"
            type="button"
            role="switch"
            aria-label="${t('enabledLabel')}"
            aria-checked="${settings.enabled ? 'true' : 'false'}"
            class="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 ${getSwitchTrackClass(settings.enabled)}"
          >
            <span
              id="enabled-switch-thumb"
              class="pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200 ${getSwitchThumbClass(settings.enabled)}"
            ></span>
          </button>
        </div>
      </div>

      <div class="h-px bg-white/5"></div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-widest text-muted-fg mb-3">${t('connectionLabel')}</p>
        <div class="bg-surface rounded-xl p-3 space-y-3">
          <div class="flex items-center justify-between gap-3">
            <label class="text-xs text-on-surface-alt" for="port-input">${t('portLabel')}</label>
            <div class="flex items-center gap-2">
              <input
                id="port-input"
                type="number"
                min="1024"
                max="65535"
                value="${settings.port}"
                class="w-24 bg-surface-alt border border-white/10 rounded-lg px-2.5 py-1 text-xs text-on-surface text-right focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition-colors"
              />
              <span class="text-xs text-muted-fg">${defaultPortText}</span>
            </div>
          </div>
        </div>
        <p class="mt-2 text-[11px] leading-relaxed text-muted-fg/90">${t('popupWarningMatch')}</p>
      </div>

      <div class="flex items-center gap-3">
        <button
          id="save-btn"
          class="px-3 py-1.5 text-xs font-semibold bg-accent text-bg rounded-lg hover:bg-accent-dim transition-colors"
        >
          ${t('saveButton')}
        </button>
        <span id="save-feedback" class="text-xs text-muted-fg opacity-0 transition-opacity duration-300">${t('saveFeedback')}</span>
      </div>

    </div>
  `;

    const portInput = document.getElementById('port-input') as HTMLInputElement;
    const enabledSwitch = document.getElementById('enabled-switch') as HTMLButtonElement;
    const enabledSwitchThumb = document.getElementById('enabled-switch-thumb') as HTMLSpanElement;
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
    const statusEl = document.getElementById('status')!;
    const feedback = document.getElementById('save-feedback')!;
    let savedSettings: Settings = { ...settings };
    let draftSettings: Settings = { ...settings };

    function syncDraftControls() {
        portInput.value = String(draftSettings.port);
        enabledSwitch.setAttribute('aria-checked', draftSettings.enabled ? 'true' : 'false');
        enabledSwitch.className =
            `relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 ${getSwitchTrackClass(draftSettings.enabled)}`;
        enabledSwitchThumb.className =
            `pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200 ${getSwitchThumbClass(draftSettings.enabled)}`;
    }

    async function refreshStatus() {
        if (!savedSettings.enabled) {
            statusEl.innerHTML = renderStatus(false);
            return;
        }

        statusEl.innerHTML = `<span class="text-muted-fg text-xs">${t('statusChecking')}</span>`;
        const ok = await checkConnection(savedSettings.port);
        statusEl.innerHTML = renderStatus(ok);
    }

    syncDraftControls();
    void refreshStatus();

    portInput.addEventListener('input', () => {
        const port = parseInt(portInput.value, 10);
        if (Number.isInteger(port) && port >= 1024 && port <= 65535) draftSettings.port = port;
    });

    enabledSwitch.addEventListener('click', () => {
        draftSettings.enabled = !draftSettings.enabled;
        syncDraftControls();
    });

    saveBtn.addEventListener('click', async () => {
        const port = parseInt(portInput.value, 10);
        if (!Number.isInteger(port) || port < 1024 || port > 65535) return;

        draftSettings = { port, enabled: draftSettings.enabled };
        await saveSettings(draftSettings);
        savedSettings = await loadSettings();
        draftSettings = { ...savedSettings };
        syncDraftControls();
        feedback.style.opacity = '1';
        setTimeout(() => (feedback.style.opacity = '0'), 2000);
        void refreshStatus();
    });
}

async function mount() {
    renderPopup({ ...DEFAULT_SETTINGS });

    try {
        renderPopup(await loadSettings());
    } catch (error) {
        const root = document.getElementById('root')!;
        root.innerHTML = `
          <div class="w-[320px] min-h-[220px] p-4 flex items-center">
            <p class="text-sm text-destructive">${t('loadError')}</p>
          </div>
        `;
        console.error('Failed to load popup', error);
    }
}

void mount();
