/**
 * Friends Circle, Group Members & Real-time Notifications Service
 */
import { showToast } from '../utils/toast.js';

const GROUP_KEY = 'ftm_active_group_code';
const GROUP_FILTER_KEY = 'ftm_group_filter_mode';
const NOTIFY_GLOBAL_PREFIX = 'ftm_notify_group_';
const NOTIFY_MEMBER_PREFIX = 'ftm_notify_member_';

let activeGroupCode = '';
let filterMode = 'all';
const groupListeners = [];

function initGroupFromStorage() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramGroup = urlParams.get('group');
  
  if (paramGroup) {
    activeGroupCode = paramGroup.trim().toUpperCase();
    localStorage.setItem(GROUP_KEY, activeGroupCode);
    filterMode = 'group';
  } else {
    activeGroupCode = localStorage.getItem(GROUP_KEY) || '';
    filterMode = localStorage.getItem(GROUP_FILTER_KEY) || 'all';
  }
}

initGroupFromStorage();

export function getActiveGroupCode() {
  return activeGroupCode;
}

export function setActiveGroupCode(code) {
  activeGroupCode = (code || '').trim().toUpperCase();
  localStorage.setItem(GROUP_KEY, activeGroupCode);
  if (activeGroupCode) {
    filterMode = 'group';
    localStorage.setItem(GROUP_FILTER_KEY, 'group');
    requestNotificationPermission();
  }
  notifyGroupListeners();
}

export function clearActiveGroup() {
  activeGroupCode = '';
  filterMode = 'all';
  localStorage.removeItem(GROUP_KEY);
  localStorage.setItem(GROUP_FILTER_KEY, 'all');
  notifyGroupListeners();
}

export function getFilterMode() {
  return filterMode;
}

export function setFilterMode(mode) {
  filterMode = mode;
  localStorage.setItem(GROUP_FILTER_KEY, mode);
  notifyGroupListeners();
}

/* ==========================================================================
   NOTIFICATION PREFERENCES (Global & Per-Member)
   ========================================================================== */

export function isGroupNotificationEnabled(groupCode) {
  const target = groupCode || activeGroupCode;
  if (!target) return false;
  const val = localStorage.getItem(NOTIFY_GLOBAL_PREFIX + target);
  return val === null ? true : val === 'true'; // Enabled by default
}

export function setGroupNotificationEnabled(groupCode, enabled) {
  const target = groupCode || activeGroupCode;
  if (!target) return;
  localStorage.setItem(NOTIFY_GLOBAL_PREFIX + target, String(enabled));
  notifyGroupListeners();
}

export function isMemberNotificationEnabled(groupCode, authorName) {
  const target = groupCode || activeGroupCode;
  if (!target || !authorName) return false;
  // If global is disabled, member is disabled
  if (!isGroupNotificationEnabled(target)) return false;
  const key = `${NOTIFY_MEMBER_PREFIX}${target}_${authorName}`;
  const val = localStorage.getItem(key);
  return val === null ? true : val === 'true'; // Enabled by default
}

export function setMemberNotificationEnabled(groupCode, authorName, enabled) {
  const target = groupCode || activeGroupCode;
  if (!target || !authorName) return;
  const key = `${NOTIFY_MEMBER_PREFIX}${target}_${authorName}`;
  localStorage.setItem(key, String(enabled));
  notifyGroupListeners();
}

/**
 * Request Browser Notification Permission
 */
export async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (e) { /* ignore */ }
  }
}

/**
 * Trigger notification when a new group photo is posted
 */
export function notifyNewGroupPhoto(photo, onNavigate) {
  const group = photo.groupCode;
  const author = photo.authorName || 'Учасник';

  if (!isMemberNotificationEnabled(group, author)) {
    return;
  }

  // 1. In-App Interactive Notification Toast
  showToast(`🔔 ${author} щойно опублікував(-ла) нове фото в групі "${group}"!`, 'success', 5000);

  // 2. System Browser Notification if allowed
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(`Нове фото від ${author} 📍`, {
        body: photo.description ? `"${photo.description}" в групі ${group}` : `Нове місце на карті в групі ${group}`,
        icon: photo.thumbUrl || '/favicon.ico'
      });
      notif.onclick = () => {
        window.focus();
        if (typeof onNavigate === 'function') {
          onNavigate(photo.lat, photo.lng);
        }
      };
    } catch (e) { /* ignore */ }
  }
}

export function getGroupShareUrl(code) {
  const targetCode = code || activeGroupCode;
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?group=${encodeURIComponent(targetCode)}`;
}

export function onGroupChange(callback) {
  groupListeners.push(callback);
  callback({ activeGroupCode, filterMode });
  return () => {
    const idx = groupListeners.indexOf(callback);
    if (idx !== -1) groupListeners.splice(idx, 1);
  };
}

function notifyGroupListeners() {
  groupListeners.forEach((fn) => {
    try { fn({ activeGroupCode, filterMode }); } catch (e) { console.error(e); }
  });
}
