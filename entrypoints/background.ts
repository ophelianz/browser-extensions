import { defineBackground } from 'wxt/utils/define-background';

import { handleDownload } from '../lib/background-logic';
import {
    DEFAULT_SETTINGS,
    resolveEnabled,
    resolvePort,
    resolveSettings,
    type Settings,
} from '../lib/settings';

let settings: Settings = { ...DEFAULT_SETTINGS };
const extensionBaseUrl = chrome.runtime.getURL('');
const storageArea = chrome.storage.local;

function createTimeoutSignal(timeoutMs: number): AbortSignal {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), {
        once: true,
    });

    return controller.signal;
}

async function loadPersistedSettings(): Promise<void> {
    settings = await new Promise((resolve, reject) => {
        storageArea.get(DEFAULT_SETTINGS, (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }

            resolve(resolveSettings(result));
        });
    });
}

async function isOpheliaAvailable(port: number): Promise<boolean> {
    try {
        const response = await fetch(`http://localhost:${port}/health`, {
            signal: createTimeoutSignal(2000),
        });

        if (!response.ok) return false;

        const body = (await response.json()) as { app?: unknown };
        return body.app === 'ophelia';
    } catch {
        return false;
    }
}

async function cancelDownload(downloadId: number): Promise<boolean> {
    return new Promise((resolve) => {
        chrome.downloads.cancel(downloadId, () => {
            resolve(!chrome.runtime.lastError);
        });
    });
}

async function postDownload(
    port: number,
    payload: { url: string; filename: string },
): Promise<boolean> {
    try {
        const response = await fetch(`http://localhost:${port}/download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: createTimeoutSignal(3000),
        });

        return response.ok;
    } catch {
        return false;
    }
}

async function redownload(payload: {
    url: string;
    filename: string;
}): Promise<void> {
    await new Promise<void>((resolve) => {
        chrome.downloads.download(payload, () => resolve());
    });
}

const settingsReady = loadPersistedSettings().catch((error) => {
    settings = { ...DEFAULT_SETTINGS };
    console.error(
        'Failed to load background settings, falling back to defaults.',
        error,
    );
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    if (changes.port) settings.port = resolvePort(changes.port.newValue);
    if (changes.enabled)
        settings.enabled = resolveEnabled(changes.enabled.newValue);
});

// URLs we've explicitly handed back to the browser after Ophelia was unreachable.
// When onCreated fires for these, we let them through instead of intercepting again.
const passThroughUrls = new Set<string>();

export default defineBackground(() => {
    chrome.downloads.onCreated.addListener(async (item) => {
        await handleDownload(item, {
            extensionBaseUrl,
            passThroughUrls,
            ensureSettingsReady: () => settingsReady,
            getSettings: () => settings,
            isOpheliaAvailable,
            cancelDownload,
            postDownload,
            redownload,
        });
    });
});
