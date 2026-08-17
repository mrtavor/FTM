/**
 * High-Performance Optimized Map Component (Leaflet.js + MarkerCluster)
 * Dynamic zoom rendering:
 * - Zoom <= 10: Smooth Clusters
 * - Zoom 11-14: Custom Emoji Pins
 * - Zoom >= 15: Photo Micro-Thumbnails
 */
import L from 'leaflet';
import 'leaflet.markercluster';
import { geoService } from '../services/geoService.js';
import { fetchPhotosForGeohashes, subscribeToGroupUpdates, subscribeToGroupMetadata } from '../services/firebase.js';
import { getActiveGroupCode, getFilterMode, onGroupChange, notifyNewGroupPhoto, clearActiveGroup, setActiveGroup } from '../services/groupService.js';
import { getCurrentDisplayName } from '../services/authService.js';
import { updateHeaderGroupBadge } from './friendsModal.js';
import { openPhotoDetailModal } from './photoDetailModal.js';
import { showToast } from '../utils/toast.js';

let mapInstance = null;
let clusterGroup = null;
let singleMarkersLayer = null;
let isPickerActive = false;
let onLocationSelectedCallback = null;
let debounceTimer = null;
let groupUnsubscribe = null;
let metaUnsubscribe = null;

const DEFAULT_CENTER = [48.3794, 31.1656];
const DEFAULT_ZOOM = 6;

/**
 * Initialize Leaflet Map with optimized tile caching
 */
export function initMap(containerId = 'map') {
  if (mapInstance) return mapInstance;

  mapInstance = L.map(containerId, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    minZoom: 3,
    maxZoom: 19,
    zoomControl: false,
    preferCanvas: true
  });

  // Fast Eye-Care CartoDB Voyager TileLayer with pre-buffering
  const tileLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; OSM',
      subdomains: 'abcd',
      maxZoom: 20,
      keepBuffer: 6,
      updateInterval: 120
    }
  );
  tileLayer.addTo(mapInstance);

  // Cluster Layer
  clusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 45,
    spiderfyOnMaxZoom: true,
    chunkedLoading: true,
    chunkInterval: 100,
    iconCreateFunction: (cluster) => {
      const count = cluster.getChildCount();
      let sizeClass = '';
      if (count >= 50) sizeClass = 'cluster-large';
      else if (count >= 15) sizeClass = 'cluster-medium';

      return L.divIcon({
        html: `<div class="cluster-inner ${sizeClass}">${count}</div>`,
        className: 'marker-cluster-custom',
        iconSize: L.point(44, 44),
        iconAnchor: [22, 22]
      });
    }
  });

  singleMarkersLayer = L.layerGroup();
  mapInstance.addLayer(clusterGroup);
  mapInstance.addLayer(singleMarkersLayer);

  mapInstance.on('moveend zoomend', handleMapViewportChange);

  // Setup real-time listener for current group and metadata
  onGroupChange(({ activeGroupCode }) => {
    if (groupUnsubscribe) {
      groupUnsubscribe();
      groupUnsubscribe = null;
    }
    if (metaUnsubscribe) {
      metaUnsubscribe();
      metaUnsubscribe = null;
    }

    if (activeGroupCode) {
      // 1. Photos real-time sync (instant pin add/remove)
      groupUnsubscribe = subscribeToGroupUpdates(
        activeGroupCode,
        (newPhoto) => {
          notifyNewGroupPhoto(newPhoto, (lat, lng) => {
            flyToCoords(lat, lng, 15);
          });
          renderMapMarkers();
        },
        (removedPhotoId) => {
          renderMapMarkers();
        }
      );

      // 2. Group metadata real-time sync (name change, ban, deletion)
      metaUnsubscribe = subscribeToGroupMetadata(activeGroupCode, (meta) => {
        const currentUserName = getCurrentDisplayName();
        if (!meta.exists) {
          clearActiveGroup();
          updateHeaderGroupBadge();
          showToast('Цю групу було видалено адміністратором', 'info');
          renderMapMarkers();
        } else {
          const banned = Array.isArray(meta.bannedMembers) ? meta.bannedMembers : [];
          if (banned.includes(currentUserName)) {
            clearActiveGroup();
            updateHeaderGroupBadge();
            showToast('Вас було вилучено з цієї групи', 'error');
            renderMapMarkers();
          } else if (meta.name) {
            setActiveGroup(activeGroupCode, meta.name);
            updateHeaderGroupBadge();
          }
        }
      });
    }
    renderMapMarkers();
  });

  handleMapViewportChange();

  return mapInstance;
}

/**
 * Handle viewport move/zoom event with debounce
 */
async function handleMapViewportChange() {
  if (!mapInstance) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const bounds = mapInstance.getBounds();
    const zoom = mapInstance.getZoom();

    const uncachedHashes = geoService.getUncachedGeohashes(bounds, zoom);

    if (uncachedHashes.length > 0) {
      const newPhotos = await fetchPhotosForGeohashes(uncachedHashes);
      geoService.addPhotosToCache(newPhotos);
      geoService.markGeohashesQueried(uncachedHashes);
    }

    renderMapMarkers();
  }, 180);
}

/**
 * Re-render markers depending on current zoom level and active group filter
 */
export function renderMapMarkers() {
  if (!mapInstance || !clusterGroup || !singleMarkersLayer) return;

  const currentZoom = mapInstance.getZoom();
  const bounds = mapInstance.getBounds();
  const allVisiblePhotos = geoService.getCachedPhotosInBounds(bounds);

  const activeGroup = getActiveGroupCode();
  const filterMode = getFilterMode();

  const visiblePhotos = allVisiblePhotos.filter((photo) => {
    if (filterMode === 'group' && activeGroup) {
      return photo.groupCode === activeGroup;
    }
    if (!photo.groupCode) return true;
    return photo.groupCode === activeGroup;
  });

  clusterGroup.clearLayers();
  singleMarkersLayer.clearLayers();

  if (currentZoom <= 10) {
    const markers = visiblePhotos.map((photo) => createMarkerForPhoto(photo, 'emoji'));
    clusterGroup.addLayers(markers);
  } else if (currentZoom >= 11 && currentZoom <= 14) {
    visiblePhotos.forEach((photo) => {
      const marker = createMarkerForPhoto(photo, 'emoji');
      singleMarkersLayer.addLayer(marker);
    });
  } else {
    visiblePhotos.forEach((photo) => {
      const marker = createMarkerForPhoto(photo, 'thumb');
      singleMarkersLayer.addLayer(marker);
    });
  }
}

/**
 * Create Leaflet Marker with Custom DivIcon
 */
function createMarkerForPhoto(photo, styleType = 'emoji') {
  let iconHtml = '';
  let iconSize = [38, 44];
  let iconAnchor = [19, 44];

  if (styleType === 'thumb' && photo.thumbUrl) {
    iconHtml = `
      <div class="thumb-pin-container">
        <img class="thumb-pin-image" src="${photo.thumbUrl}" alt="Фото" loading="lazy" />
        <span class="thumb-pin-badge">${photo.emoji || '📸'}</span>
      </div>
    `;
    iconSize = [54, 62];
    iconAnchor = [27, 62];
  } else {
    iconHtml = `
      <div class="emoji-pin-bubble">
        <span>${photo.emoji || '📍'}</span>
      </div>
    `;
  }

  const customIcon = L.divIcon({
    html: iconHtml,
    className: styleType === 'thumb' ? 'custom-thumb-marker' : 'custom-emoji-marker',
    iconSize: L.point(iconSize[0], iconSize[1]),
    iconAnchor: L.point(iconAnchor[0], iconAnchor[1]),
    popupAnchor: [0, -iconAnchor[1] + 10]
  });

  const marker = L.marker([photo.lat, photo.lng], { icon: customIcon });

  marker.on('click', () => {
    openPhotoDetailModal(photo);
  });

  return marker;
}

export function locateUser() {
  if (!mapInstance) return;

  if (!navigator.geolocation) {
    showToast('Геолокація недоступна', 'error');
    return;
  }

  showToast('Визначення вашого місця...', 'info', 1500);

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      mapInstance.flyTo([lat, lng], 14, { duration: 1.4 });
      showToast('Локацію знайдено!', 'success');
    },
    (err) => {
      showToast('Не вдалося отримати GPS. Перевірте дозволи геоданих.', 'error');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

export function startManualLocationPicker(onConfirmed) {
  isPickerActive = true;
  onLocationSelectedCallback = onConfirmed;

  const crosshair = document.getElementById('crosshair-picker');
  if (crosshair) crosshair.classList.remove('hidden');

  const btnConfirm = document.getElementById('btn-confirm-location');
  if (btnConfirm) {
    btnConfirm.onclick = () => {
      if (!mapInstance) return;
      const center = mapInstance.getCenter();
      stopManualLocationPicker();
      if (typeof onLocationSelectedCallback === 'function') {
        onLocationSelectedCallback({
          lat: Number(center.lat.toFixed(6)),
          lng: Number(center.lng.toFixed(6))
        });
      }
    };
  }
}

export function stopManualLocationPicker() {
  isPickerActive = false;
  const crosshair = document.getElementById('crosshair-picker');
  if (crosshair) crosshair.classList.add('hidden');
}

export function flyToCoords(lat, lng, zoom = 15) {
  if (mapInstance) {
    mapInstance.flyTo([lat, lng], zoom, { duration: 1.2 });
  }
}

export function getMapInstance() {
  return mapInstance;
}
