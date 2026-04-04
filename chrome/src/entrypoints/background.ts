import { defineBackground } from 'wxt/utils/define-background';

const DEFAULT_PORT = 7373;
let opheliaPort = DEFAULT_PORT;
const extensionBaseUrl = chrome.runtime.getURL('');
const storageArea = chrome.storage.local;

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

storageArea.get({ port: DEFAULT_PORT }, ({ port }) => {
    opheliaPort = resolvePort(port);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.port) opheliaPort = resolvePort(changes.port.newValue);
});

// URLs we've explicitly handed back to the browser after Ophelia was unreachable.
// When onCreated fires for these, we let them through instead of intercepting again.
const passThroughUrls = new Set<string>();

export default defineBackground(() => {
    chrome.downloads.onCreated.addListener(async (item) => {
        if (
            item.url.startsWith('blob:') ||
            item.url.startsWith('data:') ||
            item.url.startsWith(extensionBaseUrl)
        )
            return;

        if (passThroughUrls.has(item.url)) {
            passThroughUrls.delete(item.url);
            return;
        }

        chrome.downloads.cancel(item.id);

        const filename =
            item.filename ||
            new URL(item.url).pathname.split('/').pop() ||
            'download';

        try {
            await fetch(`http://localhost:${opheliaPort}/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: item.url, filename }),
                signal: createTimeoutSignal(3000),
            });
        } catch {
            passThroughUrls.add(item.url);
            chrome.downloads.download({ url: item.url, filename });
        }
    });
});
