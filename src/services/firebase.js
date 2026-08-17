/**
 * Firebase Service Layer (Modular SDK v10)
 * Auth, Cloud Firestore & Cloud Storage
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFirebaseConfig, isConfigured } from '../utils/config.js';
import { geoService } from './geoService.js';
import { blobToDataUrl } from './imageProcessor.js';
import { sanitizeGroupTag } from './groupService.js';

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
 * Instant Client-Side Image Storage Processor (Zero Storage Hangs)
 * Converts compressed WebP blobs to optimized data URLs directly stored in Firestore
 * @param {Blob} mainBlob
 * @param {Blob} thumbBlob
 * @param {string} userId
 * @returns {Promise<{mainUrl: string, thumbUrl: string}>}
 */
export async function uploadPhotoBlobs(mainBlob, thumbBlob, userId) {
  const mainDataUrl = await blobToDataUrl(mainBlob);
  const thumbDataUrl = await blobToDataUrl(thumbBlob);
  return { mainUrl: mainDataUrl, thumbUrl: thumbDataUrl };
}

/**
 * Save photo metadata to Firestore
 * @param {Object} photoData
 * @returns {Promise<string>} Created photo ID
 */
export async function savePhotoDocument(photoData) {
  const photoId = `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (!db) {
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
  geoService.addPhotosToCache([payload]);
  return photoId;
}

/**
 * Fetch photos from Firestore for visible geohashes
 */
export async function fetchPhotosForGeohashes(geohashes) {
  if (!db || geohashes.length === 0) return [];

  const results = [];
  const photosCol = collection(db, 'photos');

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
        results.push({ id: docSnap.id, ...docSnap.data() });
      });
    } catch (e) {
      console.warn(`Error querying geohash ${hash}:`, e);
    }
  });

  await Promise.all(queries);
  return results;
}

/**
 * Fetch all photos belonging to a specific group code
 */
export async function fetchGroupPhotos(groupCode) {
  if (!db || !groupCode) return [];
  const cleanTag = sanitizeGroupTag(groupCode);
  if (!cleanTag) return [];

  try {
    const q = query(
      collection(db, 'photos'),
      where('groupCode', '==', cleanTag),
      limit(200)
    );
    const snapshot = await getDocs(q);
    const photos = [];
    snapshot.forEach((docSnap) => {
      photos.push({ id: docSnap.id, ...docSnap.data() });
    });
    return photos;
  } catch (err) {
    console.warn('Error fetching group photos:', err);
    return [];
  }
}

/**
 * Save or create Group metadata (Name + Tag) with uniqueness check
 */
export async function saveGroupMetadata(groupData, isNewCreation = false) {
  if (!groupData.tag) return null;
  const tag = sanitizeGroupTag(groupData.tag);
  if (!tag) return null;

  if (db) {
    const groupRef = doc(db, 'groups', tag);

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
        if (err.message && err.message.includes('вже існує')) throw err;
      }
    }

    const payload = {
      tag,
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

  return { tag, name: groupData.name || tag, ownerId: groupData.ownerId || '' };
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
 * Delete a Group (Admin Only)
 */
export async function deleteGroup(tag) {
  const cleanTag = sanitizeGroupTag(tag);
  if (!cleanTag || !db) return true;

  try {
    const groupRef = doc(db, 'groups', cleanTag);
    // Broadcast deletion so all onSnapshot listeners trigger immediately
    await setDoc(groupRef, { isDeleted: true, status: 'deleted', updatedAt: serverTimestamp() }, { merge: true });
    // Then remove the document
    setTimeout(() => {
      deleteDoc(groupRef).catch(() => {});
    }, 800);
  } catch (e) {
    console.warn('Delete group warning:', e);
  }
  return true;
}

/**
 * Kick a member from Group by adding to banned list
 */
export async function kickMemberFromGroup(groupTag, memberName) {
  const cleanTag = sanitizeGroupTag(groupTag);
  if (!cleanTag || !memberName || !db) return;

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

/**
 * Real-time listener for Group Metadata (Name, Tag, Admin changes, Deletion, Ban)
 */
export function subscribeToGroupMetadata(groupTag, onUpdate) {
  if (!db || !groupTag) return () => {};
  const cleanTag = sanitizeGroupTag(groupTag);
  if (!cleanTag) return () => {};

  const groupRef = doc(db, 'groups', cleanTag);
  return onSnapshot(
    groupRef,
    (snap) => {
      if (typeof onUpdate === 'function') {
        onUpdate(snap.exists() ? { exists: true, ...snap.data() } : { exists: false, tag: cleanTag });
      }
    },
    (err) => { console.warn('Group metadata sync error:', err); }
  );
}

/**
 * Register user in group members list (updates existing member if already registered)
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
      const newName = memberObj.name || 'Учасник';
      const uid = memberObj.uid || '';

      // Match by UID first, or name if no UID
      const existingIdx = members.findIndex(m => (uid && m.uid === uid) || (!m.uid && m.name === newName));

      const isOwner = Boolean(data.ownerId && uid && data.ownerId === uid);
      const updatePayload = {};

      if (existingIdx >= 0) {
        members[existingIdx] = {
          ...members[existingIdx],
          name: newName,
          uid: uid || members[existingIdx].uid || ''
        };
        updatePayload.members = members;
      } else {
        members.push({
          uid: uid,
          name: newName,
          joinedAt: new Date().toISOString()
        });
        updatePayload.members = members;
      }

      if (isOwner) {
        updatePayload.adminName = newName;
      }

      await setDoc(groupRef, updatePayload, { merge: true });
    }
  } catch (err) {
    console.warn('Register group member error:', err);
  }
}

/**
 * Fetch list of active members in a group with photo counts, strictly deduplicated by userId/UID
 */
export async function fetchGroupMembers(groupCode, ownerId = '', currentUserName = '', currentUserId = '') {
  const cleanTag = sanitizeGroupTag(groupCode);
  const membersMap = new Map(); // Key: `uid:${userId}` or `name:${name}`

  const getMemberKey = (uid, name) => {
    if (uid && uid.trim()) return `uid:${uid.trim()}`;
    return `name:${(name || '').trim().toLowerCase()}`;
  };

  if (!db || !cleanTag) {
    if (currentUserName) {
      const key = getMemberKey(currentUserId, currentUserName);
      membersMap.set(key, {
        name: currentUserName,
        count: 0,
        userId: currentUserId,
        isAdmin: true
      });
    }
    return Array.from(membersMap.values());
  }

  let realOwnerId = ownerId;

  // 1. Load group doc to get owner and registered members
  try {
    const groupRef = doc(db, 'groups', cleanTag);
    const groupSnap = await getDoc(groupRef);
    if (groupSnap.exists()) {
      const groupData = groupSnap.data();
      realOwnerId = groupData.ownerId || ownerId;

      // Group creator / admin
      if (realOwnerId || groupData.adminName) {
        const isAdminCurrentUser = Boolean(realOwnerId && currentUserId && realOwnerId === currentUserId);
        const adminDisplayName = isAdminCurrentUser ? currentUserName : (groupData.adminName || 'Адміністратор');
        const adminKey = getMemberKey(realOwnerId, adminDisplayName);

        membersMap.set(adminKey, {
          name: adminDisplayName,
          count: 0,
          userId: realOwnerId || '',
          isAdmin: true
        });
      }

      // Process registered members
      const registeredMembers = Array.isArray(groupData.members) ? groupData.members : [];
      registeredMembers.forEach(m => {
        if (!m) return;
        const isCurrentUser = Boolean(currentUserId && m.uid && m.uid === currentUserId);
        const displayName = isCurrentUser ? (currentUserName || m.name) : (m.name || 'Учасник');
        const isAdm = Boolean(realOwnerId && m.uid && m.uid === realOwnerId);
        const key = getMemberKey(m.uid, displayName);

        const existing = membersMap.get(key);
        if (existing) {
          existing.name = displayName;
          if (m.uid) existing.userId = m.uid;
          if (isAdm) existing.isAdmin = true;
        } else {
          membersMap.set(key, {
            name: displayName,
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

  // 2. Ensure current user is in the list with latest display name
  if (currentUserName || currentUserId) {
    const isAdm = Boolean(realOwnerId && currentUserId && realOwnerId === currentUserId);
    const key = getMemberKey(currentUserId, currentUserName);
    const existing = membersMap.get(key);
    if (existing) {
      existing.name = currentUserName || existing.name;
      existing.userId = currentUserId || existing.userId;
      if (isAdm) existing.isAdmin = true;
    } else {
      membersMap.set(key, {
        name: currentUserName || 'Мандрівник',
        count: 0,
        userId: currentUserId || '',
        isAdmin: isAdm
      });
    }
  }

  // 3. Count photos by member (mapping each photo to its corresponding member)
  try {
    const q = query(collection(db, 'photos'), where('groupCode', '==', cleanTag), limit(150));
    const snapshot = await getDocs(q);
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const photoUid = data.userId || '';
      const photoAuthor = data.authorName || 'Учасник';
      const isAdm = Boolean(realOwnerId && photoUid && photoUid === realOwnerId);

      // Match by UID first, then by name
      let targetKey = null;
      if (photoUid && membersMap.has(`uid:${photoUid}`)) {
        targetKey = `uid:${photoUid}`;
      } else if (membersMap.has(`name:${photoAuthor.trim().toLowerCase()}`)) {
        targetKey = `name:${photoAuthor.trim().toLowerCase()}`;
      } else {
        targetKey = getMemberKey(photoUid, photoAuthor);
      }

      const existing = membersMap.get(targetKey);
      if (existing) {
        existing.count += 1;
        if (photoUid && !existing.userId) existing.userId = photoUid;
        if (isAdm) existing.isAdmin = true;
      } else {
        membersMap.set(targetKey, {
          name: (currentUserId && photoUid === currentUserId) ? (currentUserName || photoAuthor) : photoAuthor,
          count: 1,
          userId: photoUid,
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

  return onSnapshot(
    q,
    (snapshot) => {
      if (isFirstLoad) {
        isFirstLoad = false;
        const initialPhotos = [];
        snapshot.forEach((docSnap) => initialPhotos.push({ id: docSnap.id, ...docSnap.data() }));
        geoService.addPhotosToCache(initialPhotos);
        if (typeof onNewPhoto === 'function') onNewPhoto(null, initialPhotos);
        return;
      }

      snapshot.docChanges().forEach((change) => {
        const photo = { id: change.doc.id, ...change.doc.data() };
        if (change.type === 'added' || change.type === 'modified') {
          geoService.addPhotosToCache([photo]);
          if (typeof onNewPhoto === 'function') onNewPhoto(photo);
        } else if (change.type === 'removed') {
          geoService.cache.delete(change.doc.id);
          if (typeof onPhotoRemoved === 'function') onPhotoRemoved(change.doc.id);
        }
      });
    },
    (err) => { console.warn('Group subscription error:', err); }
  );
}

/**
 * Update Photo Metadata (Description, Emoji, Group Code / Visibility)
 */
export async function updatePhotoDocument(photoId, fieldsToUpdate) {
  if (!photoId) return false;

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
  if (cached) Object.assign(cached, cleanFields);
  return true;
}

/**
 * Fetch all photos uploaded by a specific user
 */
export async function fetchUserPhotos(userId) {
  if (!userId) return [];
  const userPhotos = [];

  // Check client cache first
  geoService.cache.forEach((photo) => {
    if (photo.userId === userId) userPhotos.push(photo);
  });

  // Fetch from Firestore (dedup)
  if (db) {
    try {
      const q = query(collection(db, 'photos'), where('userId', '==', userId), limit(100));
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        if (!userPhotos.some(p => p.id === data.id)) userPhotos.push(data);
      });
    } catch (err) {
      console.warn('Error fetching user photos:', err);
    }
  }

  return userPhotos;
}

/**
 * Delete a photo document from Firestore and cache
 */
export async function deletePhoto(photo) {
  if (!photo || !photo.id) return false;
  geoService.cache.delete(photo.id);

  if (db) {
    const photoRef = doc(db, 'photos', photo.id);
    await deleteDoc(photoRef);
  }
  return true;
}

// ──────────────────────────────────────────────
// Likes (photos/{photoId}/likes/{userId})
// ──────────────────────────────────────────────

/**
 * Toggle like on a photo. One like per user, keyed by userId.
 * @returns {Promise<{liked: boolean}>}
 */
export async function toggleLike(photoId, userId, userName) {
  if (!photoId || !userId) return { liked: false };
  if (!db) return { liked: false };

  const likeRef = doc(db, 'photos', photoId, 'likes', userId);
  try {
    const snap = await getDoc(likeRef);
    if (snap.exists()) {
      await deleteDoc(likeRef);
      return { liked: false };
    } else {
      await setDoc(likeRef, { userId, userName: userName || 'Мандрівник', createdAt: serverTimestamp() });
      return { liked: true };
    }
  } catch (err) {
    console.warn('toggleLike error:', err);
    return { liked: false };
  }
}

/**
 * Real-time listener for likes on a photo.
 * @returns {Function} Unsubscribe
 */
export function subscribeToLikes(photoId, onUpdate) {
  if (!db || !photoId) { onUpdate([]); return () => {}; }
  const likesCol = collection(db, 'photos', photoId, 'likes');
  return onSnapshot(
    likesCol,
    (snap) => {
      const likes = [];
      snap.forEach((d) => likes.push({ id: d.id, ...d.data() }));
      onUpdate(likes);
    },
    () => onUpdate([])
  );
}

// ──────────────────────────────────────────────
// Comments (photos/{photoId}/comments/{autoId})
// ──────────────────────────────────────────────

/**
 * Add a comment to a photo.
 * @returns {Promise<string|null>} Comment ID or null
 */
export async function addComment(photoId, commentData) {
  const text = commentData?.text?.trim();
  if (!photoId || !text) return null;
  if (!db) return null;

  try {
    const commentsCol = collection(db, 'photos', photoId, 'comments');
    const commentRef = doc(commentsCol);
    await setDoc(commentRef, {
      id: commentRef.id,
      userId: commentData.userId || '',
      userName: commentData.userName || 'Мандрівник',
      text,
      createdAt: serverTimestamp()
    });
    return commentRef.id;
  } catch (err) {
    console.warn('addComment error:', err);
    return null;
  }
}

/**
 * Delete a comment from a photo.
 */
export async function deleteComment(photoId, commentId) {
  if (!db || !photoId || !commentId) return;
  try {
    await deleteDoc(doc(db, 'photos', photoId, 'comments', commentId));
  } catch (err) {
    console.warn('deleteComment error:', err);
  }
}

/**
 * Real-time listener for comments on a photo (ordered by time).
 * @returns {Function} Unsubscribe
 */
export function subscribeToComments(photoId, onUpdate) {
  if (!db || !photoId) { onUpdate([]); return () => {}; }
  const q = query(
    collection(db, 'photos', photoId, 'comments'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => {
      const comments = [];
      snap.forEach((d) => comments.push({ id: d.id, ...d.data() }));
      onUpdate(comments);
    },
    () => onUpdate([])
  );
}

export { auth, db, storage };

