/**
 * Clean & Secure Google-First Authentication Service
 */
import {
  signInAnonymously,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { auth } from './firebase.js';

let currentUser = null;
const authListeners = [];
const NICKNAME_KEY = 'ftm_user_display_name';

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
      if (!user.isAnonymous && user.displayName) {
        localStorage.setItem(NICKNAME_KEY, user.displayName);
      } else if (!user.displayName && savedNick) {
        try {
          await updateProfile(user, { displayName: savedNick });
        } catch (e) { /* ignore */ }
      }
      currentUser = user;
      notifyListeners(currentUser);
    } else {
      try {
        const cred = await signInAnonymously(targetAuth);
        if (savedNick) {
          await updateProfile(cred.user, { displayName: savedNick });
        }
        currentUser = cred.user;
        notifyListeners(currentUser);
      } catch (err) {
        console.error('Auto anonymous auth:', err);
      }
    }
  });
}

export function getCurrentUser() {
  return currentUser;
}

export function isGoogleUser() {
  if (!currentUser || currentUser.isAnonymous) return false;
  return true;
}

export async function ensureAuthenticatedUser() {
  if (auth && auth.currentUser) {
    return auth.currentUser;
  }
  if (auth) {
    try {
      const cred = await signInAnonymously(auth);
      currentUser = cred.user;
      return cred.user;
    } catch (e) {
      console.warn('Auth fallback:', e);
    }
  }
  return currentUser;
}

export function getCurrentUserId() {
  if (auth && auth.currentUser) {
    return auth.currentUser.uid;
  }
  return currentUser ? currentUser.uid : 'guest';
}

export function getCurrentDisplayName() {
  if (currentUser && currentUser.displayName) {
    return currentUser.displayName;
  }
  return localStorage.getItem(NICKNAME_KEY) || 'Мандрівник';
}

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

export async function loginWithGoogle() {
  if (!auth) throw new Error('Помилка авторизації');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  currentUser = cred.user;
  if (cred.user.displayName) {
    localStorage.setItem(NICKNAME_KEY, cred.user.displayName);
  }
  notifyListeners(currentUser);
  return cred.user;
}

export async function logoutUser() {
  if (auth) {
    await signOut(auth);
    const cred = await signInAnonymously(auth);
    currentUser = cred.user;
    notifyListeners(currentUser);
  }
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
