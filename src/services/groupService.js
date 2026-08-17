/**
 * Friends Circle, Group Metadata, Members & Real-time Notifications Service
 */
import { showToast } from '../utils/toast.js';

const GROUP_KEY = 'ftm_active_group_code';
const GROUP_NAME_KEY = 'ftm_active_group_name';
const GROUP_FILTER_KEY = 'ftm_group_filter_mode';
const NOTIFY_GLOBAL_PREFIX = 'ftm_notify_group_';
const NOTIFY_MEMBER_PREFIX = 'ftm_notify_member_';

let activeGroupCode = '';
let activeGroupName = '';
let filterMode = 'all';
const groupListeners = [];

function initGroupFromStorage() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramGroup = urlParams.get('group');
  
  if (paramGroup) {
    activeGroupCode = paramGroup.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    activeGroupName = activeGroupCode;
    localStorage.setItem(GROUP_KEY, activeGroupCode);
    localStorage.setItem(GROUP_NAME_KEY, activeGroupName);
    filterMode = 'group';
  } else {
    activeGroupCode = localStorage.getItem(GROUP_KEY) || '';
    activeGroupName = localStorage.getItem(GROUP_NAME_KEY) || activeGroupCode;
    filterMode = localStorage.getItem(GROUP_FILTER_KEY) || 'all';
  }
}

initGroupFromStorage();

export function getActiveGroupCode() {
  return activeGroupCode;
}

export function getActiveGroupName() {
  return activeGroupName || activeGroupCode || 'Моя група';
}

export function setActiveGroup(tag, name) {
  const cleanTag = (tag || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  activeGroupCode = cleanTag;
  activeGroupName = name?.trim() || cleanTag;

  localStorage.setItem(GROUP_KEY, activeGroupCode);
  localStorage.setItem(GROUP_NAME_KEY, activeGroupName);

  if (activeGroupCode) {
    filterMode = 'group';
    localStorage.setItem(GROUP_FILTER_KEY, 'group');
    requestNotificationPermission();
  }
  notifyGroupListeners();
}

export function setActiveGroupCode(code) {
  setActiveGroup(code, activeGroupName || code);
}

export function clearActiveGroup() {
  activeGroupCode = '';
  activeGroupName = '';
  filterMode = 'all';
  localStorage.removeItem(GROUP_KEY);
  localStorage.removeItem(GROUP_NAME_KEY);
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
  return val === null ? true : val === 'true';
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
  if (!isGroupNotificationEnabled(target)) return false;
  const key = `${NOTIFY_MEMBER_PREFIX}${target}_${authorName}`;
  const val = localStorage.getItem(key);
  return val === null ? true : val === 'true';
}

export function setMemberNotificationEnabled(groupCode, authorName, enabled) {
  const target = groupCode || activeGroupCode;
  if (!target || !authorName) return;
  const key = `${NOTIFY_MEMBER_PREFIX}${target}_${authorName}`;
  localStorage.setItem(key, String(enabled));
  notifyGroupListeners();
}

export async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (e) { /* ignore */ }
  }
}

export function notifyNewGroupPhoto(photo, onNavigate) {
  const group = photo.groupCode;
  const author = photo.authorName || 'Учасник';

  if (!isMemberNotificationEnabled(group, author)) {
    return;
  }

  showToast(`🔔 ${author} щойно виставив(-ла) нове фото в групі "${activeGroupName || group}"!`, 'success', 5000);

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(`Нове фото від ${author} 📍`, {
        body: photo.description ? `"${photo.description}" в групі ${activeGroupName || group}` : `Нове місце в групі ${activeGroupName || group}`,
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
  callback({ activeGroupCode, activeGroupName, filterMode });
  return () => {
    const idx = groupListeners.indexOf(callback);
    if (idx !== -1) groupListeners.splice(idx, 1);
  };
}

function notifyGroupListeners() {
  groupListeners.forEach((fn) => {
    try { fn({ activeGroupCode, activeGroupName, filterMode }); } catch (e) { console.error(e); }
  });
}
