import { defineConfig } from 'wxt';

export default defineConfig({
    browser: 'firefox',
    targetBrowsers: ['firefox'],
    srcDir: 'src',
    manifest: {
        default_locale: 'en',
        name: '__MSG_extName__',
        description: '__MSG_extDescription__',
        permissions: ['downloads', 'storage'],
        host_permissions: ['<all_urls>'],
        action: {
            default_title: '__MSG_actionTitle__',
        },
        icons: {
            16: 'icon-16.png',
            32: 'icon-32.png',
            48: 'icon-48.png',
            128: 'icon-128.png',
        },
    },
});
