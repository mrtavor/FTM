/**
 * Authentication Service (Anonymous Auth + Google Provider)
 */
import {
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { auth } from './firebase.js';

let currentUser = null;
const authListeners = [];

export function initAuth(firebaseAuth) {
  const targetAuth = firebaseAuth || auth;
  if (!targetAuth) {
    // Generate persistent local anon ID for demo mode
    let demoUserId = localStorage.getItem('ftm_demo_user_id');
    if (!demoUserId) {
      demoUserId = 'anon_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('ftm_demo_user_id', demoUserId);
    }
    currentUser = { uid: demoUserId, isAnonymous: true, displayName: 'Гість' };
    notifyListeners(currentUser);
    return;
  }

  onAuthStateChanged(targetAuth, async (user) => {
    if (user) {
      currentUser = user;
      notifyListeners(currentUser);
    } else {
      // Automatically sign in anonymously to protect Firebase writes
      try {
        const cred = await signInAnonymously(targetAuth);
        currentUser = cred.user;
        notifyListeners(currentUser);
      } catch (err) {
        console.error('Anonymous auth failed:', err);
      }
    }
  });
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentUserId() {
  return currentUser ? currentUser.uid : 'anonymous_guest';
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

export async function loginWithGoogle() {
  if (!auth) throw new Error('Firebase Auth is not initialized');
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(auth, provider);
}

export async function logoutUser() {
  if (auth) {
    await signOut(auth);
  }
}
