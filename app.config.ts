import { ConfigContext, ExpoConfig } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const getUniqueIdentifier = () => {
  if (IS_DEV) return 'com.jvstuche.fiftythreexy.dev';
  if (IS_PREVIEW) return 'com.jvstuche.fiftythreexy.preview';
  return 'com.jvstuche.fiftythreexy';
};

const getAppName = () => {
  if (IS_DEV) return '53XY (Dev)';
  if (IS_PREVIEW) return '53XY (Preview)';
  return '53XY';
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: getAppName(),
  slug: '53XY',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/android/adaptive-icon.png',
  scheme: 'fiftythreexy',
  userInterfaceStyle: 'automatic',
  owner: 'justuche224',
  ios: {
    icon: './assets/expo.icon',
    bundleIdentifier: getUniqueIdentifier(),
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#1C1033',
      foregroundImage: './assets/images/android/adaptive-icon.png',
      monochromeImage: './assets/images/android/monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: [
      'android.permission.READ_MEDIA_VIDEO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      'android.permission.ACCESS_MEDIA_LOCATION',
      'android.permission.READ_MEDIA_IMAGES',
      'android.permission.READ_MEDIA_AUDIO',
    ],
    package: getUniqueIdentifier(),
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    ['expo-video', { supportsBackgroundPlayback: true, supportsPictureInPicture: true }],
    'expo-sqlite',
    [
      'expo-media-library',
      {
        photosPermission: 'Allow 53XY to access your videos.',
        savePhotosPermission: 'Allow 53XY to save videos.',
        isAccessMediaLocationEnabled: true,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFFFFF',
        image: './assets/images/splash-icon.png',
        imageWidth: 200,
        resizeMode: 'contain',
        dark: {
          backgroundColor: '#1C1033',
          image: './assets/images/splash-icon-dark.png',
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'bfc694a1-7674-4389-a33d-45206bfbe9e8',
    },
  },
});
