/**
 * Configuration & Credentials Manager
 * Loads from environment variables (import.meta.env) with localStorage fallback
 */

const STORAGE_KEY = 'ftm_firebase_config';

export function getFirebaseConfig() {
  // Check localStorage first (user-provided via Settings UI)
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

  // Fallback to Vite environment variables
  const envConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
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
