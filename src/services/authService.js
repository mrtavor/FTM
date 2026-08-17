/**
 * Privacy-First Authentication & Pseudonymous Profile Service
 * Allows users to register dedicated site logins (Username + PIN/Password)
 * without disclosing real emails or passwords used in other services.
 */
import {
  signInAnonymously,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  signOut
} from 'firebase/auth';
import { auth } from './firebase.js';

let currentUser = null;
const authListeners = [];
const NICKNAME_KEY = 'ftm_user_display_name';

/**
 * Format custom username into an internal secure alias for Firebase Auth
 * e.g. "alex" -> "alex@geosnap.local" (no real email needed!)
 */
function formatUsernameAlias(username) {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
  return `${clean}@geosnap.local`;
}

export function initAuth(firebaseAuth) {
  const targetAuth = firebaseAuth || auth;
  const savedNick = localStorage.getItem(NICKNAME_KEY) || 'Мандрівник';

  if (!targetAuth) {
    let demoUserId = localStorage.getItem('ftm_demo_user_id');
    if (!demoUserId) {
      demoUserId = 'user_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('ftm_demo_user_id', demoUserId);
    }
    currentUser = {
      uid: demoUserId,
      isAnonymous: true,
      displayName: savedNick
    };
    notifyListeners(currentUser);
    return;
  }

  onAuthStateChanged(targetAuth, async (user) => {
    if (user) {
      if (!user.displayName && savedNick) {
        try {
          await updateProfile(user, { displayName: savedNick });
        } catch (e) { /* ignore */ }
      }
      currentUser = user;
      notifyListeners(currentUser);
    } else {
      // Sign in anonymously by default so user can view & interact immediately
      try {
        const cred = await signInAnonymously(targetAuth);
        if (savedNick) {
          await updateProfile(cred.user, { displayName: savedNick });
        }
        currentUser = cred.user;
        notifyListeners(currentUser);
      } catch (err) {
        console.error('Auto anon auth failed:', err);
      }
    }
  });
}

/**
 * Register a dedicated in-app account (Username + Password)
 * @param {string} username - In-app nickname/login
 * @param {string} password - Dedicated password for this map only
 * @param {string} displayName - Visible name on photos
 */
export async function registerDedicatedAccount(username, password, displayName) {
  if (!auth) throw new Error('Firebase Auth не ініціалізовано');

  const emailAlias = formatUsernameAlias(username);
  const cred = await createUserWithEmailAndPassword(auth, emailAlias, password);
  
  const finalName = displayName?.trim() || username.trim();
  await updateProfile(cred.user, { displayName: finalName });
  localStorage.setItem(NICKNAME_KEY, finalName);
  
  currentUser = cred.user;
  notifyListeners(currentUser);
  return cred.user;
}

/**
 * Login into existing dedicated in-app account
 * @param {string} usernameOrEmail 
 * @param {string} password 
 */
export async function loginDedicatedAccount(usernameOrEmail, password) {
  if (!auth) throw new Error('Firebase Auth не ініціалізовано');

  let emailToUse = usernameOrEmail.trim();
  if (!emailToUse.includes('@')) {
    emailToUse = formatUsernameAlias(usernameOrEmail);
  }

  const cred = await signInWithEmailAndPassword(auth, emailToUse, password);
  currentUser = cred.user;
  if (cred.user.displayName) {
    localStorage.setItem(NICKNAME_KEY, cred.user.displayName);
  }
  notifyListeners(currentUser);
  return cred.user;
}

/**
 * Update display nickname
 */
export async function setDisplayNickname(name) {
  const trimmed = name.trim();
  if (!trimmed) return;

  localStorage.setItem(NICKNAME_KEY, trimmed);

  if (auth && auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: trimmed });
    currentUser = auth.currentUser;
  } else if (currentUser) {
    currentUser.displayName = trimmed;
  }
  notifyListeners(currentUser);
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentUserId() {
  return currentUser ? currentUser.uid : 'anonymous_guest';
}

export function getCurrentDisplayName() {
  if (currentUser && currentUser.displayName) {
    return currentUser.displayName;
  }
  return localStorage.getItem(NICKNAME_KEY) || 'Мандрівник';
}

export function onAuthChange(callback) {
  authListeners.push(callback);
  if (currentUser) {
    callback(currentUser);
  }
  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx !== -1) authListeners.splice(idx, 1);
  };
}

function notifyListeners(user) {
  authListeners.forEach((fn) => {
    try { fn(user); } catch (e) { console.error(e); }
  });
}

export async function logoutUser() {
  if (auth) {
    await signOut(auth);
    // After sign out, create a new clean anonymous session
    const cred = await signInAnonymously(auth);
    currentUser = cred.user;
    notifyListeners(currentUser);
  }
}
