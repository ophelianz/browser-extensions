export const DEFAULT_PORT = 7373;

export type Settings = {
    port: number;
    enabled: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
    port: DEFAULT_PORT,
    enabled: true,
};

export function resolvePort(value: unknown): number {
    return typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= 1024 &&
        value <= 65535
        ? value
        : DEFAULT_PORT;
}

export function resolveEnabled(value: unknown): boolean {
    return typeof value === 'boolean' ? value : DEFAULT_SETTINGS.enabled;
}

export function resolveSettings(value: { port?: unknown; enabled?: unknown }): Settings {
    return {
        port: resolvePort(value.port),
        enabled: resolveEnabled(value.enabled),
    };
}
