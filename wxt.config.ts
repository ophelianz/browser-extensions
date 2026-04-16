import { defineConfig } from 'wxt';

const FIREFOX_EXTENSION_ID = 'extension@ophelia.app';
const FIREFOX_MIN_VERSION = '109.0';

export default defineConfig({
  outDir: 'output',
  suppressWarnings: {
    firefoxDataCollection: true,
  },
  targetBrowsers: ['chrome', 'firefox'],
  manifest: ({ browser }) => {
    const baseManifest = {
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
    };

    if (browser !== 'firefox') return baseManifest;

    return {
      ...baseManifest,
      browser_specific_settings: {
        gecko: {
          id: FIREFOX_EXTENSION_ID,
          strict_min_version: FIREFOX_MIN_VERSION,
        },
      },
    };
  },
  hooks: {
    'build:manifestGenerated': (_, manifest) => {
      const geckoSettings = manifest.browser_specific_settings?.gecko as
        | { data_collection_permissions?: { required: string[] } }
        | undefined;
      if (!geckoSettings) return;

      geckoSettings.data_collection_permissions = {
        required: ['none'],
      };
    },
  },
});
