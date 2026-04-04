import '../../assets/tailwind.css';

const DEFAULT_PORT = 7373;
const storageArea = chrome.storage.local;

type Settings = { port: number };
type MessageName =
    | 'actionTitle'
    | 'connectionLabel'
    | 'defaultPortLabel'
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

function resolvePort(value: unknown): number {
    return typeof value === 'number' ? value : DEFAULT_PORT;
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
        storageArea.get({ port: DEFAULT_PORT }, (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            resolve({ port: resolvePort(result.port) });
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
        return res.ok;
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

function renderPopup(settings: Settings): void {
    const root = document.getElementById('root')!;
    const extensionTitle = t('actionTitle');
    const defaultPortText = t('defaultPortLabel', String(DEFAULT_PORT));

    document.title = extensionTitle;
    document.documentElement.lang = getUiLanguage();

    root.innerHTML = `
    <div class="w-[320px] p-4 space-y-4">

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <img src="/icon-32.png" class="w-5 h-5" alt="${extensionTitle}" />
          <span class="text-sm font-semibold tracking-tight">${extensionTitle}</span>
        </div>
        <div class="flex items-center text-xs" id="status">
          <span class="text-muted-fg">${t('statusChecking')}</span>
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
        <span class="text-s text-red-500">${t('popupWarningMatch')} </span>
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
    const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
    const statusEl = document.getElementById('status')!;
    const feedback = document.getElementById('save-feedback')!;

    async function refreshStatus(port: number) {
        statusEl.innerHTML = `<span class="text-muted-fg text-xs">${t('statusChecking')}</span>`;
        const ok = await checkConnection(port);
        statusEl.innerHTML = renderStatus(ok);
    }

    refreshStatus(settings.port);

    portInput.addEventListener('change', () => {
        const port = parseInt(portInput.value, 10);
        if (port >= 1024 && port <= 65535) refreshStatus(port);
    });

    saveBtn.addEventListener('click', async () => {
        const port = parseInt(portInput.value, 10);
        if (port < 1024 || port > 65535) return;

        await saveSettings({ port });
        feedback.style.opacity = '1';
        setTimeout(() => (feedback.style.opacity = '0'), 2000);
        refreshStatus(port);
    });
}

async function mount() {
    renderPopup({ port: DEFAULT_PORT });

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
