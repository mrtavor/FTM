/**
 * Configuration & Credentials Manager
 * Pre-configured with geosnap-map project credentials
 */

const STORAGE_KEY = 'ftm_firebase_config';

// Default Firebase Project Configuration
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyByw1eE4bJBGtYGEh3eDwCrCkE-czGk_64",
  authDomain: "geosnap-map-4c1bb.firebaseapp.com",
  projectId: "geosnap-map-4c1bb",
  storageBucket: "geosnap-map-4c1bb.firebasestorage.app",
  messagingSenderId: "247602914803",
  appId: "1:247602914803:web:57e62068578e9e1be25e86",
  measurementId: "G-TKSXDR8FRR"
};

export function getFirebaseConfig() {
  // Check localStorage first
  const savedConfig = localStorage.getItem(STORAGE_KEY);
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      if (parsed && parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved Firebase config from localStorage', e);
    }
  }

  // Fallback to environment variables or defaults
  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_CONFIG.apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_CONFIG.projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId
  };

  return envConfig;
}

export function saveFirebaseConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function isConfigured() {
  const config = getFirebaseConfig();
  return Boolean(
    config.apiKey &&
    config.apiKey !== 'AIzaSyExampleKey123456789' &&
    config.projectId &&
    config.projectId !== 'your-project-id'
  );
}

export function clearFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
}
