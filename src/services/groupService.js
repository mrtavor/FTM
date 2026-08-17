/**
 * Friends Circle & Group Sharing Service
 * Allows users to create/join private circles using a shared group code.
 */

const GROUP_KEY = 'ftm_active_group_code';
const GROUP_FILTER_KEY = 'ftm_group_filter_mode'; // 'all' | 'group'

let activeGroupCode = '';
let filterMode = 'all'; // 'all' or 'group'
const groupListeners = [];

// Initialize from URL query params or localStorage
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

/**
 * Generate shareable link for friends
 */
export function getGroupShareUrl(code) {
  const targetCode = code || activeGroupCode;
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?group=${encodeURIComponent(targetCode)}`;
}
