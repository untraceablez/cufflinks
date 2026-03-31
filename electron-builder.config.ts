import type { Configuration } from 'electron-builder';

const config: Configuration = {
  appId: 'com.cufflinks.app',
  productName: 'Cufflinks',
  directories: {
    output: 'dist',
    buildResources: 'resources',
  },
  files: [
    'packages/main/dist/**',
    'packages/renderer/dist/**',
    'packages/widget/dist/**',
  ],
  extraResources: [
    { from: 'themes', to: 'themes' },
  ],
  win: {
    target: 'nsis',
    icon: 'resources/icon.ico',
  },
  mac: {
    target: 'dmg',
    icon: 'resources/icon.icns',
    category: 'public.app-category.music',
  },
  linux: {
    target: ['AppImage', 'deb'],
    icon: 'resources/icon.png',
    category: 'Audio',
  },
  protocols: [
    {
      name: 'Cufflinks',
      schemes: ['cufflinks'],
    },
  ],
};

export default config;
