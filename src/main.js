/**
 * Main Application Bootstrap
 * GeoSnap — Simple & Beautiful Interactive Photo Map
 */
import { initFirebase } from './services/firebase.js';
import { initAuth } from './services/authService.js';
import { initMap, locateUser, renderMapMarkers, getMapInstance } from './components/map.js';
import { openUploadModal } from './components/uploadModal.js';
import { openProfileModal, updateHeaderNickDisplay } from './components/profileModal.js';
import { openFriendsModal, updateHeaderGroupBadge } from './components/friendsModal.js';
import { openGalleryModal } from './components/galleryModal.js';
import { initVersionChecker } from './utils/versionChecker.js';
import { loadSampleLocations } from './utils/mockData.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Firebase & Authentication
  const { auth, isMock } = initFirebase();
  initAuth(auth);
  updateHeaderNickDisplay();
  updateHeaderGroupBadge();

  // 2. Initialize Leaflet Map
  const map = initMap('map');

  if (isMock) {
    loadSampleLocations();
    renderMapMarkers();
  }

  // 3. Initialize Version Auto-Update Poller
  initVersionChecker();

  // 4. Bind UI Controls
  setupNavigationAndControls();
});

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

  // Central Upload Button (+)
  const btnUpload = document.getElementById('btn-open-upload');
  if (btnUpload) {
    btnUpload.onclick = () => openUploadModal();
  }

  // Header Actions
  const btnGallery = document.getElementById('btn-gallery');
  if (btnGallery) {
    btnGallery.onclick = () => openGalleryModal();
  }

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

  // Bottom Navigation
  const navExplore = document.getElementById('nav-btn-explore');
  if (navExplore && map) {
    navExplore.onclick = () => {
      map.flyTo([48.3794, 31.1656], 6, { duration: 1.2 });
    };
  }

  const navGallery = document.getElementById('nav-btn-gallery');
  if (navGallery) {
    navGallery.onclick = () => openGalleryModal();
  }

  const navFriendsBottom = document.getElementById('nav-btn-friends-bottom');
  if (navFriendsBottom) {
    navFriendsBottom.onclick = () => openFriendsModal();
  }

  const navProfileBottom = document.getElementById('nav-btn-profile-bottom');
  if (navProfileBottom) {
    navProfileBottom.onclick = () => openProfileModal();
  }
}
