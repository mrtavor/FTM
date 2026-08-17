/**
 * Friends Circle, Group Metadata, Members & Real-time Notifications Service
 * Strictly preserves exact Unicode / Cyrillic / Latin characters
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

/**
 * Sanitize Group Tag: trim and uppercase, preserving exact characters
 */
export function sanitizeGroupTag(str) {
  if (!str) return '';
  return str
    .trim()
    .toUpperCase()
    .replace(/[\s\/\\]+/g, '_')
    .replace(/[^\p{L}\p{N}_\-]/gu, '');
}

function initGroupFromStorage() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramGroup = urlParams.get('group');
  
  if (paramGroup) {
    activeGroupCode = sanitizeGroupTag(paramGroup);
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
  return activeGroupName || activeGroupCode;
}

export function getFilterMode() {
  return filterMode;
}

export function setActiveGroup(groupCode, groupName = '') {
  const cleanCode = sanitizeGroupTag(groupCode);
  const cleanName = groupName?.trim() || cleanCode;

  activeGroupCode = cleanCode;
  activeGroupName = cleanName;
  filterMode = cleanCode ? 'group' : 'all';

  if (cleanCode) {
    localStorage.setItem(GROUP_KEY, cleanCode);
    localStorage.setItem(GROUP_NAME_KEY, cleanName);
    localStorage.setItem(GROUP_FILTER_KEY, 'group');
  } else {
    localStorage.removeItem(GROUP_KEY);
    localStorage.removeItem(GROUP_NAME_KEY);
    localStorage.setItem(GROUP_FILTER_KEY, 'all');
  }

  notifyGroupListeners();
}

export function clearActiveGroup() {
  setActiveGroup('', '');
}

export function isGroupNotificationEnabled(groupCode) {
  if (!groupCode) return false;
  const clean = sanitizeGroupTag(groupCode);
  const val = localStorage.getItem(NOTIFY_GLOBAL_PREFIX + clean);
  return val === null ? true : val === 'true';
}

export function setGroupNotificationEnabled(groupCode, enabled) {
  if (!groupCode) return;
  const clean = sanitizeGroupTag(groupCode);
  localStorage.setItem(NOTIFY_GLOBAL_PREFIX + clean, enabled ? 'true' : 'false');
}

export function isMemberNotificationEnabled(groupCode, memberName) {
  if (!groupCode || !memberName) return true;
  const cleanGroup = sanitizeGroupTag(groupCode);
  const val = localStorage.getItem(`${NOTIFY_MEMBER_PREFIX}${cleanGroup}_${memberName}`);
  return val === null ? true : val === 'true';
}

export function setMemberNotificationEnabled(groupCode, memberName, enabled) {
  if (!groupCode || !memberName) return;
  const cleanGroup = sanitizeGroupTag(groupCode);
  localStorage.setItem(`${NOTIFY_MEMBER_PREFIX}${cleanGroup}_${memberName}`, enabled ? 'true' : 'false');
}

export function subscribeGroupChanges(callback) {
  if (typeof callback === 'function') {
    groupListeners.push(callback);
  }
}

function notifyGroupListeners() {
  groupListeners.forEach((cb) => {
    try {
      cb({
        groupCode: activeGroupCode,
        groupName: activeGroupName,
        filterMode: filterMode
      });
    } catch (e) {
      console.warn('Group listener error:', e);
    }
  });
}
