import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
// @ts-expect-error — getReactNativePersistence exists at runtime (Metro
// resolves `firebase/auth` to its React Native build via the package's
// "react-native" field) but is missing from the generic .d.ts this package
// ships for bundler-mode TS resolution — a long-standing gap in Firebase's
// types: https://github.com/firebase/firebase-js-sdk/issues/8332
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

// Values are inlined at build time by Expo (EXPO_PUBLIC_* vars), sourced
// from .env.local. Firebase web config identifies the project rather than
// authenticating it, so it's not a secret — access is controlled by
// Firebase Security Rules, not by hiding these values.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// `firebase/analytics` depends on browser-only APIs (window, IndexedDB) and
// isn't included here — it would break on iOS/Android. Native analytics
// would need `@react-native-firebase/analytics`, which requires a custom
// dev client (it doesn't run in Expo Go).
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth(): Auth {
  if (Platform.OS === 'web') {
    return getAuth(firebaseApp);
  }
  try {
    // Without explicit AsyncStorage persistence, RN auth state doesn't
    // survive an app restart and logs a warning on every load.
    return initializeAuth(firebaseApp, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Fast Refresh re-runs this module against an already-initialized auth
    // instance, which throws — fall back to the existing instance.
    return getAuth(firebaseApp);
  }
}

export const auth = createAuth();
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
