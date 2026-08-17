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
import { sanitizeGroupTag } from './groupService.js';

/**
 * Save or create Group metadata (Name + Tag) with uniqueness check
 */
export async function saveGroupMetadata(groupData, isNewCreation = false) {
  if (!groupData.tag) return null;
  const tag = sanitizeGroupTag(groupData.tag);
  if (!tag) return null;

  if (db) {
    const groupRef = doc(db, 'groups', tag);
    
    // If creating a brand new group, verify tag isn't already taken
    if (isNewCreation) {
      try {
        const existingSnap = await getDoc(groupRef);
        if (existingSnap.exists()) {
          const exData = existingSnap.data();
          if (!exData.isDeleted && exData.status !== 'deleted' && exData.ownerId && exData.ownerId !== groupData.ownerId) {
            throw new Error(`Група з ключем #${tag} вже існує! Приєднайтеся до неї або оберіть інший ключ.`);
          }
        }
      } catch (err) {
        if (err.message && err.message.includes('вже існує')) {
          throw err;
        }
      }
    }

    const payload = {
      tag: tag,
      name: groupData.name?.trim() || tag,
      ownerId: groupData.ownerId || '',
      adminName: groupData.adminName || 'Адміністратор',
      members: [{
        uid: groupData.ownerId || '',
        name: groupData.adminName || 'Адміністратор',
        joinedAt: new Date().toISOString()
      }],
      isDeleted: false,
      status: 'active',
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    };

    try {
      await setDoc(groupRef, payload, { merge: true });
    } catch (err) {
      console.error('Firebase save group error:', err);
      throw err;
    }
    return payload;
  }
  return {
    tag,
    name: groupData.name || tag,
    ownerId: groupData.ownerId || ''
  };
}

/**
 * Fetch Group metadata by exact Tag
 */
export async function fetchGroupMetadata(tag) {
  if (!tag) return null;
  const cleanTag = sanitizeGroupTag(tag);
  if (!cleanTag) return null;

  if (db) {
    try {
      const groupRef = doc(db, 'groups', cleanTag);
      const snap = await getDoc(groupRef);
      if (snap.exists()) {
        const data = snap.data();
        if (!data.isDeleted && data.status !== 'deleted') {
          return { ...data, tag: cleanTag };
        }
      }
    } catch (err) {
      console.warn('Error fetching group metadata:', err);
    }
  }
  return null;
}

/**
 * Delete a Group (Admin Only) - Broadcasts deletion signal instantly to all connected users
 */
export async function deleteGroup(tag) {
  const cleanTag = sanitizeGroupTag(tag);
  if (!cleanTag) return;
  if (db) {
    try {
      const groupRef = doc(db, 'groups', cleanTag);
      // 1. Broadcast deletion status so all active onSnapshot listeners trigger immediately
      await setDoc(groupRef, { isDeleted: true, status: 'deleted', updatedAt: serverTimestamp() }, { merge: true });
      // 2. Remove document from Firestore
      setTimeout(async () => {
        try { await deleteDoc(groupRef); } catch (e) {}
      }, 800);
    } catch (e) {
      console.warn('Delete group warning:', e);
    }
  }
  return true;
}

/**
 * Kick a member from Group by adding to banned list
 */
export async function kickMemberFromGroup(groupTag, memberName) {
  const cleanTag = sanitizeGroupTag(groupTag);
  if (!cleanTag || !memberName) return;
  if (db) {
    try {
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
    } catch (e) {
      console.warn('Kick member warning:', e);
    }
  }
  return true;
}

/**
 * Real-time listener for Group Metadata (Name, Tag, Admin changes, Deletion, Ban)
 * Syncs instantaneously across all devices
 */
export function subscribeToGroupMetadata(groupTag, onUpdate) {
  if (!db || !groupTag) return () => {};
  const cleanTag = sanitizeGroupTag(groupTag);
  if (!cleanTag) return () => {};

  const groupRef = doc(db, 'groups', cleanTag);
  const unsubscribe = onSnapshot(groupRef, (snap) => {
    if (typeof onUpdate === 'function') {
      if (snap.exists()) {
        onUpdate({ exists: true, ...snap.data() });
      } else {
        onUpdate({ exists: false, tag: cleanTag });
      }
    }
  }, (err) => {
    console.warn('Group metadata sync error:', err);
  });

  return unsubscribe;
}

/**
 * Register user in group members list
 */
export async function registerGroupMember(groupCode, memberObj) {
  if (!db || !groupCode || !memberObj) return;
  const cleanTag = sanitizeGroupTag(groupCode);
  if (!cleanTag) return;

  try {
    const groupRef = doc(db, 'groups', cleanTag);
    const snap = await getDoc(groupRef);
    if (snap.exists()) {
      const data = snap.data();
      const members = Array.isArray(data.members) ? [...data.members] : [];
      const exists = members.some(m => m.name === memberObj.name || (memberObj.uid && m.uid === memberObj.uid));
      if (!exists) {
        members.push({
          uid: memberObj.uid || '',
          name: memberObj.name || 'Учасник',
          joinedAt: new Date().toISOString()
        });
        await setDoc(groupRef, { members }, { merge: true });
      }
    }
  } catch (err) {
    console.warn('Register group member error:', err);
  }
}

/**
 * Fetch list of active members in a group with photo counts
 * Guaranteed to show group creator/admin and all joined members
 */
export async function fetchGroupMembers(groupCode, ownerId = '', currentUserName = '', currentUserId = '') {
  const cleanTag = sanitizeGroupTag(groupCode);
  const membersMap = new Map();

  if (!db || !cleanTag) {
    if (currentUserName) {
      membersMap.set(currentUserName, {
        name: currentUserName,
        count: 0,
        userId: currentUserId,
        isAdmin: true
      });
    }
    return Array.from(membersMap.values());
  }

  // 1. Fetch Group Doc to get owner/admin and registered members
  try {
    const groupRef = doc(db, 'groups', cleanTag);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const groupData = groupSnap.data();
      const realOwnerId = groupData.ownerId || ownerId;

      // Always include Admin in the list
      if (groupData.adminName) {
        membersMap.set(groupData.adminName, {
          name: groupData.adminName,
          count: 0,
          userId: realOwnerId,
          isAdmin: true
        });
      }

      // Include all registered members
      const registeredMembers = Array.isArray(groupData.members) ? groupData.members : [];
      registeredMembers.forEach(m => {
        const isAdm = Boolean(realOwnerId && m.uid && m.uid === realOwnerId);
        const existing = membersMap.get(m.name);
        if (existing) {
          if (m.uid) existing.userId = m.uid;
          existing.isAdmin = isAdm || existing.isAdmin;
        } else {
          membersMap.set(m.name, {
            name: m.name,
            count: 0,
            userId: m.uid || '',
            isAdmin: isAdm
          });
        }
      });
    }
  } catch (e) {
    console.warn('Error reading group doc members:', e);
  }

  // 2. Ensure Current User is in the list
  if (currentUserName) {
    const existing = membersMap.get(currentUserName);
    if (!existing) {
      membersMap.set(currentUserName, {
        name: currentUserName,
        count: 0,
        userId: currentUserId,
        isAdmin: Boolean(ownerId && currentUserId && ownerId === currentUserId)
      });
    }
  }

  // 3. Count photos by member
  try {
    const q = query(collection(db, 'photos'), where('groupCode', '==', cleanTag), limit(150));
    const snapshot = await getDocs(q);
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const name = data.authorName || 'Учасник';
      const userId = data.userId || '';
      const isAdm = Boolean(ownerId && userId && userId === ownerId);

      const existing = membersMap.get(name);
      if (existing) {
        existing.count += 1;
        if (userId) existing.userId = userId;
        if (isAdm) existing.isAdmin = true;
      } else {
        membersMap.set(name, {
          name,
          count: 1,
          userId,
          isAdmin: isAdm
        });
      }
    });
  } catch (err) {
    console.warn('Error counting group member photos:', err);
  }

  return Array.from(membersMap.values());
}

/**
 * Real-time listener for group photos (triggers live notifications & map updates)
 * @param {string} groupCode 
 * @param {Function} onNewPhoto 
 * @param {Function} onPhotoRemoved
 * @returns {Function} Unsubscribe function
 */
export function subscribeToGroupUpdates(groupCode, onNewPhoto, onPhotoRemoved) {
  if (!db || !groupCode) return () => {};
  const cleanTag = sanitizeGroupTag(groupCode);

  let isFirstLoad = true;
  const q = query(
    collection(db, 'photos'),
    where('groupCode', '==', cleanTag),
    limit(100)
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
      } else if (change.type === 'removed') {
        geoService.cache.delete(change.doc.id);
        if (typeof onPhotoRemoved === 'function') {
          onPhotoRemoved(change.doc.id);
        }
      }
    });
  }, (err) => {
    console.warn('Group subscription error:', err);
  });

  return unsubscribe;
}

/**
 * Update Photo Metadata (Description, Emoji, Group Code / Visibility)
 */
export async function updatePhotoDocument(photoId, fieldsToUpdate) {
  if (!photoId) return false;

  // Clean groupCode if provided
  const cleanFields = { ...fieldsToUpdate };
  if ('groupCode' in cleanFields) {
    cleanFields.groupCode = cleanFields.groupCode ? sanitizeGroupTag(cleanFields.groupCode) : null;
  }

  if (db) {
    try {
      const photoRef = doc(db, 'photos', photoId);
      await setDoc(photoRef, cleanFields, { merge: true });
    } catch (err) {
      console.warn('Update photo in firestore error:', err);
    }
  }

  // Update client cache
  const cached = geoService.cache.get(photoId);
  if (cached) {
    Object.assign(cached, cleanFields);
  }
  return true;
}

/**
 * Fetch all photos uploaded by a specific user
 */
export async function fetchUserPhotos(userId) {
  const userPhotos = [];
  if (!userId) return userPhotos;

  // 1. Check client cache first
  geoService.cache.forEach((photo) => {
    if (photo.userId === userId) {
      userPhotos.push(photo);
    }
  });

  // 2. Fetch from Firestore
  if (db) {
    try {
      const q = query(collection(db, 'photos'), where('userId', '==', userId), limit(100));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        if (!userPhotos.some(p => p.id === data.id)) {
          userPhotos.push(data);
        }
      });
    } catch (err) {
      console.warn('Error fetching user photos:', err);
    }
  }

  return userPhotos;
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
