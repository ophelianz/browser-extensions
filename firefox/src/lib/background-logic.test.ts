import { describe, expect, it } from 'bun:test';

import { handleDownload, type HandleDownloadDeps } from './background-logic';
import type { Settings } from './settings';

function createDeferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((resolvePromise) => {
        resolve = resolvePromise;
    });

    return { promise, resolve };
}

function createDeps(overrides: Partial<HandleDownloadDeps> = {}): HandleDownloadDeps {
    const settings: Settings = { port: 7373, enabled: true };

    return {
        extensionBaseUrl: 'moz-extension://ophelia/',
        passThroughUrls: new Set<string>(),
        ensureSettingsReady: async () => {},
        getSettings: () => settings,
        isOpheliaAvailable: async () => true,
        cancelDownload: async () => true,
        postDownload: async () => true,
        redownload: async () => {},
        ...overrides,
    };
}

describe('handleDownload', () => {
    it('waits for persisted settings before making a decision', async () => {
        const calls: string[] = [];
        const ready = createDeferred();
        const resultPromise = handleDownload(
            { id: 1, url: 'https://example.com/file.zip' },
            createDeps({
                ensureSettingsReady: async () => {
                    calls.push('ensure');
                    await ready.promise;
                },
                getSettings: () => {
                    calls.push('getSettings');
                    return { port: 7373, enabled: false };
                },
                isOpheliaAvailable: async () => {
                    calls.push('health');
                    return true;
                },
            }),
        );

        await Promise.resolve();
        expect(calls).toEqual(['ensure']);

        ready.resolve();

        expect(await resultPromise).toBe('browser');
        expect(calls).toEqual(['ensure', 'getSettings']);
    });

    it('keeps downloads in the browser when interception is disabled', async () => {
        const calls: string[] = [];
        const result = await handleDownload(
            { id: 1, url: 'https://example.com/file.zip' },
            createDeps({
                getSettings: () => ({ port: 7373, enabled: false }),
                isOpheliaAvailable: async () => {
                    calls.push('health');
                    return true;
                },
            }),
        );

        expect(result).toBe('browser');
        expect(calls).toEqual([]);
    });

    it('does not cancel when Ophelia health fails', async () => {
        const calls: string[] = [];
        const result = await handleDownload(
            { id: 1, url: 'https://example.com/file.zip' },
            createDeps({
                isOpheliaAvailable: async () => {
                    calls.push('health');
                    return false;
                },
                cancelDownload: async () => {
                    calls.push('cancel');
                    return true;
                },
            }),
        );

        expect(result).toBe('browser');
        expect(calls).toEqual(['health']);
    });

    it('hands off to Ophelia only after a successful cancel', async () => {
        const calls: string[] = [];
        const result = await handleDownload(
            { id: 7, url: 'https://example.com/video.mp4', filename: 'video.mp4' },
            createDeps({
                isOpheliaAvailable: async () => {
                    calls.push('health');
                    return true;
                },
                cancelDownload: async (downloadId) => {
                    calls.push(`cancel:${downloadId}`);
                    return true;
                },
                postDownload: async (port, payload) => {
                    calls.push(`post:${port}:${payload.filename}`);
                    return true;
                },
            }),
        );

        expect(result).toBe('ophelia');
        expect(calls).toEqual(['health', 'cancel:7', 'post:7373:video.mp4']);
    });

    it('falls back to the browser when Ophelia rejects the handoff', async () => {
        const passThroughUrls = new Set<string>();
        const calls: string[] = [];
        const item = { id: 9, url: 'https://example.com/archive.tar.gz' };

        const result = await handleDownload(
            item,
            createDeps({
                passThroughUrls,
                isOpheliaAvailable: async () => true,
                postDownload: async () => false,
                redownload: async ({ filename }) => {
                    calls.push(`redownload:${filename}`);
                },
            }),
        );

        expect(result).toBe('fallback-browser');
        expect(passThroughUrls.has(item.url)).toBe(true);
        expect(calls).toEqual(['redownload:archive.tar.gz']);
    });
});
