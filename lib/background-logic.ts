import type { Settings } from './settings';

export type DownloadItem = {
    id: number;
    url: string;
    filename?: string;
};

type DownloadPayload = {
    url: string;
    filename: string;
};

export type HandleDownloadResult =
    | 'ignored'
    | 'browser'
    | 'ophelia'
    | 'fallback-browser';

export type HandleDownloadDeps = {
    extensionBaseUrl: string;
    passThroughUrls: Set<string>;
    ensureSettingsReady: () => Promise<void>;
    getSettings: () => Settings;
    isOpheliaAvailable: (port: number) => Promise<boolean>;
    cancelDownload: (downloadId: number) => Promise<boolean>;
    postDownload: (port: number, payload: DownloadPayload) => Promise<boolean>;
    redownload: (payload: DownloadPayload) => Promise<void>;
};

export function isManagedByBrowser(url: string, extensionBaseUrl: string): boolean {
    return (
        url.startsWith('blob:') ||
        url.startsWith('data:') ||
        url.startsWith(extensionBaseUrl)
    );
}

export function resolveDownloadFilename(item: Pick<DownloadItem, 'url' | 'filename'>): string {
    if (item.filename) return item.filename;

    try {
        const derivedFilename = new URL(item.url).pathname.split('/').pop();
        if (derivedFilename) return derivedFilename;
    } catch {
        // Fall through to the generic browser-style fallback.
    }

    return 'download';
}

export async function handleDownload(
    item: DownloadItem,
    deps: HandleDownloadDeps,
): Promise<HandleDownloadResult> {
    if (isManagedByBrowser(item.url, deps.extensionBaseUrl)) return 'ignored';

    if (deps.passThroughUrls.has(item.url)) {
        deps.passThroughUrls.delete(item.url);
        return 'browser';
    }

    await deps.ensureSettingsReady();

    const settings = deps.getSettings();
    if (!settings.enabled) return 'browser';

    const filename = resolveDownloadFilename(item);
    if (!(await deps.isOpheliaAvailable(settings.port))) return 'browser';

    const cancelled = await deps.cancelDownload(item.id);
    if (!cancelled) return 'browser';

    const handedOff = await deps.postDownload(settings.port, { url: item.url, filename });
    if (handedOff) return 'ophelia';

    deps.passThroughUrls.add(item.url);
    await deps.redownload({ url: item.url, filename });
    return 'fallback-browser';
}
