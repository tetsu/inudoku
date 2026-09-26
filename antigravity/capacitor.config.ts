import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.inudoku.game',
  appName: 'Shibadoku',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
  },
};

export default config;
