/**
 * Main Application Bootstrap
 * GeoSnap Map — 100% Client-Side Interactive Photo Map for GitHub Pages & Firebase Spark
 */
import { initFirebase } from './services/firebase.js';
import { initAuth } from './services/authService.js';
import { initMap, locateUser, renderMapMarkers, getMapInstance } from './components/map.js';
import { openUploadModal } from './components/uploadModal.js';
import { openSettingsModal } from './components/settingsModal.js';
import { openInfoModal } from './components/infoModal.js';
import { openProfileModal, updateHeaderNickDisplay } from './components/profileModal.js';
import { openFriendsModal, updateHeaderGroupBadge } from './components/friendsModal.js';
import { loadSampleLocations } from './utils/mockData.js';
import { showToast } from './utils/toast.js';
import { isConfigured } from './utils/config.js';

// Global app state & initialization
document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Firebase & Authentication
  const { auth, isMock } = initFirebase();
  initAuth(auth);
  updateHeaderNickDisplay();
  updateHeaderGroupBadge();

  // 2. Initialize Leaflet Map
  const map = initMap('map');

  // If in demo / unconfigured mode, preload sample locations
  if (isMock || !isConfigured()) {
    loadSampleLocations();
    renderMapMarkers();
  }

  // 3. Bind UI Controls
  setupNavigationAndControls();

  // 4. Welcome Toast
  setTimeout(() => {
    if (isMock) {
      showToast('Додаток готовий (Демо-режим). Натисніть ⚙️ для підключення вашого Firebase', 'info', 4500);
    } else {
      showToast('Підключено до Firebase Spark Plan 🚀', 'success', 3000);
    }
  }, 600);
});

/**
 * Setup Event Listeners for Header, Floating controls and Bottom Bar
 */
function setupNavigationAndControls() {
  const map = getMapInstance();

  // Floating controls
  const btnLocate = document.getElementById('btn-locate-me');
  if (btnLocate) {
    btnLocate.onclick = () => locateUser();
  }

  const btnZoomIn = document.getElementById('btn-zoom-in');
  if (btnZoomIn && map) {
    btnZoomIn.onclick = () => map.zoomIn();
  }

  const btnZoomOut = document.getElementById('btn-zoom-out');
  if (btnZoomOut && map) {
    btnZoomOut.onclick = () => map.zoomOut();
  }

  // Central Upload FAB Button (+)
  const btnUpload = document.getElementById('btn-open-upload');
  if (btnUpload) {
    btnUpload.onclick = () => openUploadModal();
  }

  // Header Actions
  const btnFriends = document.getElementById('btn-friends');
  if (btnFriends) {
    btnFriends.onclick = () => openFriendsModal();
  }

  const groupBadge = document.getElementById('header-group-badge');
  if (groupBadge) {
    groupBadge.onclick = () => openFriendsModal();
  }

  const btnProfile = document.getElementById('btn-profile');
  if (btnProfile) {
    btnProfile.onclick = () => openProfileModal();
  }

  const btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
    btnSettings.onclick = () => openSettingsModal();
  }

  const btnDemo = document.getElementById('btn-demo-data');
  if (btnDemo) {
    btnDemo.onclick = () => {
      loadSampleLocations();
      renderMapMarkers();
      showToast('Демо-мітки завантажено на карту! ✨', 'success');
    };
  }

  // Bottom Navigation
  const navExplore = document.getElementById('nav-btn-explore');
  if (navExplore && map) {
    navExplore.onclick = () => {
      map.flyTo([48.3794, 31.1656], 6, { duration: 1.2 });
    };
  }

  const navInfo = document.getElementById('nav-btn-info');
  if (navInfo) {
    navInfo.onclick = () => openInfoModal();
  }
}
