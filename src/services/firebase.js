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

/**
 * Upload compressed blobs to Firebase Cloud Storage
 * @param {Blob} mainBlob 
 * @param {Blob} thumbBlob 
 * @param {string} userId 
 * @returns {Promise<{mainUrl: string, thumbUrl: string, storagePathMain: string, storagePathThumb: string}>}
 */
export async function uploadPhotoBlobs(mainBlob, thumbBlob, userId) {
  if (!storage) {
    // Return mock URLs in demo mode
    return {
      mainUrl: URL.createObjectURL(mainBlob),
      thumbUrl: URL.createObjectURL(thumbBlob),
      storagePathMain: `mock_main_${Date.now()}`,
      storagePathThumb: `mock_thumb_${Date.now()}`
    };
  }

  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  const mainPath = `photos/${userId}/${timestamp}_${rand}_main.webp`;
  const thumbPath = `photos/${userId}/${timestamp}_${rand}_thumb.webp`;

  const mainRef = ref(storage, mainPath);
  const thumbRef = ref(storage, thumbPath);

  // Upload main image
  await uploadBytes(mainRef, mainBlob, { contentType: 'image/webp' });
  const mainUrl = await getDownloadURL(mainRef);

  // Upload thumbnail
  await uploadBytes(thumbRef, thumbBlob, { contentType: 'image/webp' });
  const thumbUrl = await getDownloadURL(thumbRef);

  return {
    mainUrl,
    thumbUrl,
    storagePathMain: mainPath,
    storagePathThumb: thumbPath
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

/**
 * Delete a photo document and its storage files
 */
export async function deletePhoto(photo) {
  if (!db) {
    geoService.cache.delete(photo.id);
    return true;
  }

  // Delete from Firestore
  const photoRef = doc(db, 'photos', photo.id);
  await deleteDoc(photoRef);

  // Delete from Storage if possible
  if (storage) {
    if (photo.mainUrl && photo.mainUrl.includes('firebasestorage')) {
      try {
        const mainRef = ref(storage, `photos/${photo.userId}/${photo.id}_main.webp`);
        await deleteObject(mainRef);
      } catch (e) { /* ignore storage clean fail */ }
    }
  }

  geoService.cache.delete(photo.id);
  return true;
}

export { auth, db, storage };
