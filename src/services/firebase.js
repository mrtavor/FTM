/**
 * Firebase Service Layer (Modular SDK v10)
 * Auth, Cloud Firestore & Cloud Storage
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseConfig, isConfigured } from '../utils/config.js';
import { geoService } from './geoService.js';

let app = null;
let auth = null;
let db = null;
let storage = null;

export function initFirebase() {
  const config = getFirebaseConfig();

  if (!isConfigured()) {
    console.info('Firebase is not yet configured. Running in Demo / Mock mode.');
    return { app: null, auth: null, db: null, storage: null, isMock: true };
  }

  try {
    if (!getApps().length) {
      app = initializeApp(config);
    } else {
      app = getApp();
    }

    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);

    return { app, auth, db, storage, isMock: false };
  } catch (err) {
    console.error('Firebase initialization error:', err);
    return { app: null, auth: null, db: null, storage: null, isMock: true };
  }
}

import { blobToDataUrl } from './imageProcessor.js';

/**
 * Instant Client-Side Image Storage Processor (Zero Storage Hangs)
 * Converts compressed WebP blobs to optimized data URLs directly stored in Firestore
 * Fits within document limit (< 60 KB) and avoids Cloud Storage network blocks
 * @param {Blob} mainBlob 
 * @param {Blob} thumbBlob 
 * @param {string} userId 
 * @returns {Promise<{mainUrl: string, thumbUrl: string, storagePathMain: string, storagePathThumb: string}>}
 */
export async function uploadPhotoBlobs(mainBlob, thumbBlob, userId) {
  // Convert blobs to ultra-compact WebP Data URLs instantly in memory
  const mainDataUrl = await blobToDataUrl(mainBlob);
  const thumbDataUrl = await blobToDataUrl(thumbBlob);

  return {
    mainUrl: mainDataUrl,
    thumbUrl: thumbDataUrl,
    storagePathMain: '',
    storagePathThumb: ''
  };
}

/**
 * Save photo metadata to Firestore
 * @param {Object} photoData 
 * @returns {Promise<string>} Created photo ID
 */
export async function savePhotoDocument(photoData) {
  const photoId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (!db) {
    // Save to local cache in demo mode
    const mockDoc = {
      id: photoId,
      ...photoData,
      createdAt: new Date().toISOString()
    };
    geoService.addPhotosToCache([mockDoc]);
    return photoId;
  }

  const photoRef = doc(db, 'photos', photoId);
  const payload = {
    id: photoId,
    lat: photoData.lat,
    lng: photoData.lng,
    geohash: photoData.geohash,
    description: photoData.description || '',
    emoji: photoData.emoji || '📸',
    mainUrl: photoData.mainUrl,
    thumbUrl: photoData.thumbUrl,
    authorName: photoData.authorName || 'Мандрівник',
    groupCode: photoData.groupCode || null,
    userId: photoData.userId,
    createdAt: serverTimestamp()
  };

  await setDoc(photoRef, payload);
  // Add to client-side cache immediately
  geoService.addPhotosToCache([payload]);
  return photoId;
}

/**
 * Fetch photos from Firestore for visible geohashes
 * @param {string[]} geohashes 
 * @returns {Promise<Array<Object>>}
 */
export async function fetchPhotosForGeohashes(geohashes) {
  if (!db || geohashes.length === 0) {
    return [];
  }

  const results = [];
  const photosCol = collection(db, 'photos');

  // Firestore range query for each geohash prefix
  // Using Promise.all with small batch (max 10 queries per viewport update)
  const queries = geohashes.slice(0, 10).map(async (hash) => {
    try {
      const q = query(
        photosCol,
        where('geohash', '>=', hash),
        where('geohash', '<=', hash + '~'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        results.push({ id: docSnap.id, ...data });
      });
    } catch (e) {
      console.warn(`Error querying geohash ${hash}:`, e);
    }
  });

  await Promise.all(queries);
  return results;
}

import { onSnapshot, getDoc } from 'firebase/firestore';

/**
 * Save or create Group metadata (Name + Tag)
 */
export async function saveGroupMetadata(groupData) {
  if (!db || !groupData.tag) return;
  const tag = groupData.tag.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const groupRef = doc(db, 'groups', tag);
  const payload = {
    tag: tag,
    name: groupData.name?.trim() || tag,
    ownerId: groupData.ownerId || '',
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  };
  await setDoc(groupRef, payload, { merge: true });
  return payload;
}

/**
 * Fetch Group metadata by Tag
 */
export async function fetchGroupMetadata(tag) {
  if (!db || !tag) return null;
  try {
    const cleanTag = tag.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const groupRef = doc(db, 'groups', cleanTag);
    const snap = await getDoc(groupRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn('Error fetching group metadata:', err);
  }
  return null;
}

/**
 * Delete a Group (Admin Only)
 */
export async function deleteGroup(tag) {
  if (!db || !tag) return;
  const cleanTag = tag.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const groupRef = doc(db, 'groups', cleanTag);
  await deleteDoc(groupRef);
  return true;
}

/**
 * Kick a member from Group by adding to banned list
 */
export async function kickMemberFromGroup(groupTag, memberName) {
  if (!db || !groupTag || !memberName) return;
  const cleanTag = groupTag.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const groupRef = doc(db, 'groups', cleanTag);
  const snap = await getDoc(groupRef);
  
  if (snap.exists()) {
    const data = snap.data();
    const banned = Array.isArray(data.bannedMembers) ? data.bannedMembers : [];
    if (!banned.includes(memberName)) {
      banned.push(memberName);
      await setDoc(groupRef, { bannedMembers: banned }, { merge: true });
    }
  }
  return true;
}

/**
 * Fetch list of active members in a group with photo counts
 * @param {string} groupCode 
 * @param {string} ownerId
 * @returns {Promise<Array<{name: string, count: number, userId: string, isAdmin: boolean}>>}
 */
export async function fetchGroupMembers(groupCode, ownerId = '') {
  if (!db || !groupCode) return [];
  try {
    const q = query(collection(db, 'photos'), where('groupCode', '==', groupCode), limit(100));
    const snapshot = await getDocs(q);
    const membersMap = new Map();

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const name = data.authorName || 'Учасник';
      const userId = data.userId || '';
      const current = membersMap.get(name) || {
        name,
        count: 0,
        userId,
        isAdmin: Boolean(ownerId && userId === ownerId)
      };
      current.count += 1;
      if (ownerId && userId === ownerId) {
        current.isAdmin = true;
      }
      membersMap.set(name, current);
    });

    return Array.from(membersMap.values());
  } catch (err) {
    console.warn('Error fetching group members:', err);
    return [];
  }
}

/**
 * Real-time listener for new group photos (triggers live notifications)
 * @param {string} groupCode 
 * @param {Function} onNewPhoto 
 * @returns {Function} Unsubscribe function
 */
export function subscribeToGroupUpdates(groupCode, onNewPhoto) {
  if (!db || !groupCode) return () => {};

  let isFirstLoad = true;
  const q = query(
    collection(db, 'photos'),
    where('groupCode', '==', groupCode),
    limit(50)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (isFirstLoad) {
      isFirstLoad = false;
      const initialPhotos = [];
      snapshot.forEach((docSnap) => initialPhotos.push({ id: docSnap.id, ...docSnap.data() }));
      geoService.addPhotosToCache(initialPhotos);
      return;
    }

    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        const photo = { id: change.doc.id, ...change.doc.data() };
        geoService.addPhotosToCache([photo]);
        if (typeof onNewPhoto === 'function') {
          onNewPhoto(photo);
        }
      }
    });
  }, (err) => {
    console.warn('Group subscription error:', err);
  });

  return unsubscribe;
}

/**
 * Delete a photo document
 */
export async function deletePhoto(photo) {
  if (!db) {
    geoService.cache.delete(photo.id);
    return true;
  }

  const photoRef = doc(db, 'photos', photo.id);
  await deleteDoc(photoRef);
  geoService.cache.delete(photo.id);
  return true;
}

export { auth, db, storage };
