import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.meetscribe.app',
  appName: 'MeetScribe',
  webDir: 'out',
  server: {
    // For development: point to your live backend
    // Comment this out for production builds
    url: 'https://vpa-backend-338d.onrender.com',
    cleartext: false,
  },
  plugins: {
    Microphone: {
      // Required for audio recording
    },
    Filesystem: {
      // Required for saving transcripts locally
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#0A1628',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0A1628',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
  },
};

export default config;