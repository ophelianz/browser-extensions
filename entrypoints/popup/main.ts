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

function createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    className?: string,
    textContent?: string,
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);

    if (className) element.className = className;
    if (textContent !== undefined) element.textContent = textContent;

    return element;
}

function setStatusContent(
    statusEl: HTMLElement,
    state: 'checking' | 'connected' | 'notRunning',
): void {
    statusEl.replaceChildren();

    if (state === 'checking') {
        statusEl.append(
            createElement('span', 'text-muted-fg', t('statusChecking')),
        );
        return;
    }

    const connected = state === 'connected';
    const dot = createElement(
        'span',
        connected
            ? 'inline-block h-2 w-2 rounded-full bg-accent mr-1.5'
            : 'inline-block h-2 w-2 rounded-full bg-destructive mr-1.5',
    );
    const label = createElement(
        'span',
        connected ? 'text-accent' : 'text-destructive',
        connected ? t('statusConnected') : t('statusNotRunning'),
    );

    statusEl.append(dot, label);
}

function getSwitchTrackClass(enabled: boolean): string {
    return enabled
        ? 'bg-accent border-accent/70 shadow-[0_0_0_1px_rgba(126,211,127,0.15)]'
        : 'bg-surface-alt border-white/10';
}

function getSwitchThumbClass(enabled: boolean): string {
    return enabled ? 'translate-x-4 bg-bg' : 'translate-x-0 bg-white';
}

function renderPopup(settings: Settings): void {
    const root = document.getElementById('root')!;
    const extensionTitle = t('actionTitle');
    const defaultPortText = t('defaultPortLabel', String(DEFAULT_PORT));

    document.title = extensionTitle;
    document.documentElement.lang = getUiLanguage();

    const container = createElement('div', 'w-[320px] p-4 space-y-4');

    const header = createElement(
        'div',
        'flex items-center justify-between gap-4',
    );
    const brand = createElement('div', 'flex items-center gap-2');
    const logo = createElement('img', 'h-5 w-5') as HTMLImageElement;
    logo.src = '/icon-32.png';
    logo.alt = extensionTitle;
    const title = createElement(
        'span',
        'text-sm font-semibold tracking-tight',
        extensionTitle,
    );
    brand.append(logo, title);

    const headerControls = createElement('div', 'flex items-center gap-2');
    const statusEl = createElement(
        'div',
        'inline-flex min-h-8 items-center rounded-full border border-white/10 bg-surface px-2.5 py-1 text-xs',
    );
    const enabledSwitch = createElement(
        'button',
        `relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 ${getSwitchTrackClass(settings.enabled)}`,
    ) as HTMLButtonElement;
    enabledSwitch.type = 'button';
    enabledSwitch.setAttribute('role', 'switch');
    enabledSwitch.setAttribute('aria-label', t('enabledLabel'));
    enabledSwitch.setAttribute(
        'aria-checked',
        settings.enabled ? 'true' : 'false',
    );

    const enabledSwitchThumb = createElement(
        'span',
        `pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200 ${getSwitchThumbClass(settings.enabled)}`,
    );
    enabledSwitch.append(enabledSwitchThumb);
    headerControls.append(statusEl, enabledSwitch);
    header.append(brand, headerControls);

    const divider = createElement('div', 'h-px bg-white/5');

    const connectionSection = createElement('div');
    const connectionLabel = createElement(
        'p',
        'mb-3 text-xs font-semibold uppercase tracking-widest text-muted-fg',
        t('connectionLabel'),
    );
    const connectionCard = createElement(
        'div',
        'bg-surface rounded-xl p-3 space-y-3',
    );
    const portRow = createElement(
        'div',
        'flex items-center justify-between gap-3',
    );
    const portLabel = createElement(
        'label',
        'text-xs text-on-surface-alt',
        t('portLabel'),
    );
    portLabel.htmlFor = 'port-input';

    const portControls = createElement('div', 'flex items-center gap-2');
    const portInput = createElement(
        'input',
        'w-24 rounded-lg border border-white/10 bg-surface-alt px-2.5 py-1 text-right text-xs text-on-surface transition-colors focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30',
    ) as HTMLInputElement;
    portInput.id = 'port-input';
    portInput.type = 'number';
    portInput.min = '1024';
    portInput.max = '65535';
    portInput.value = String(settings.port);

    const defaultPortLabel = createElement(
        'span',
        'text-xs text-muted-fg',
        defaultPortText,
    );
    portControls.append(portInput, defaultPortLabel);
    portRow.append(portLabel, portControls);
    connectionCard.append(portRow);

    const helperText = createElement(
        'p',
        'mt-2 text-[11px] leading-relaxed text-muted-fg/90',
        t('popupWarningMatch'),
    );
    connectionSection.append(connectionLabel, connectionCard, helperText);

    const actionsRow = createElement('div', 'flex items-center gap-3');
    const saveBtn = createElement(
        'button',
        'rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-bg transition-colors hover:bg-accent-dim',
        t('saveButton'),
    ) as HTMLButtonElement;
    saveBtn.type = 'button';
    const feedback = createElement(
        'span',
        'text-xs text-muted-fg opacity-0 transition-opacity duration-300',
        t('saveFeedback'),
    );
    actionsRow.append(saveBtn, feedback);

    container.append(header, divider, connectionSection, actionsRow);
    root.replaceChildren(container);
    let savedSettings: Settings = { ...settings };
    let draftSettings: Settings = { ...settings };

    function syncDraftControls() {
        portInput.value = String(draftSettings.port);
        enabledSwitch.setAttribute(
            'aria-checked',
            draftSettings.enabled ? 'true' : 'false',
        );
        enabledSwitch.className = `relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/30 ${getSwitchTrackClass(draftSettings.enabled)}`;
        enabledSwitchThumb.className = `pointer-events-none inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200 ${getSwitchThumbClass(draftSettings.enabled)}`;
    }

    async function refreshStatus() {
        if (!savedSettings.enabled) {
            setStatusContent(statusEl, 'notRunning');
            return;
        }

        setStatusContent(statusEl, 'checking');
        const ok = await checkConnection(savedSettings.port);
        setStatusContent(statusEl, ok ? 'connected' : 'notRunning');
    }

    syncDraftControls();
    void refreshStatus();

    portInput.addEventListener('input', () => {
        const port = parseInt(portInput.value, 10);
        if (Number.isInteger(port) && port >= 1024 && port <= 65535)
            draftSettings.port = port;
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
        const container = createElement(
            'div',
            'flex min-h-[220px] w-[320px] items-center p-4',
        );
        container.append(
            createElement('p', 'text-sm text-destructive', t('loadError')),
        );
        root.replaceChildren(container);
        console.error('Failed to load popup', error);
    }
}

void mount();
