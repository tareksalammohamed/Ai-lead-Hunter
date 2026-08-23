import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aileadhunter.app',
  appName: 'AI Lead Hunter',
  webDir: 'dist',
  bundledWebRuntime: false,
  backgroundColor: '#081B33',
  plugins: {
    SplashScreen: {
      launchShowDuration: 350,
      launchAutoHide: true,
      backgroundColor: '#081B33',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#081B33',
      overlaysWebView: false,
    },
  },
};

export default config;
