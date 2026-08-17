/**
 * High-Performance Optimized Map Component (Leaflet.js)
 * Dynamic zoom rendering:
 * - Zoom <= 13: Custom Emoji Pins
 * - Zoom >= 14: Photo Micro-Thumbnails
 */
import L from 'leaflet';
import { geoService } from '../services/geoService.js';
import { fetchPhotosForGeohashes, subscribeToGroupUpdates, subscribeToGroupMetadata } from '../services/firebase.js';
import { getActiveGroupCode, getFilterMode, onGroupChange, notifyNewGroupPhoto, clearActiveGroup, setActiveGroup } from '../services/groupService.js';
import { getCurrentDisplayName } from '../services/authService.js';
import { updateHeaderGroupBadge } from './friendsModal.js';
import { showPhotoViewer } from './photoViewer.js';
import { getUserCountry } from '../services/countryService.js';
import { showToast } from '../utils/toast.js';

let mapInstance = null;
let singleMarkersLayer = null;
let isPickerActive = false;
let debounceTimer = null;
let groupUnsubscribe = null;
let metaUnsubscribe = null;

/**
 * Initialize Leaflet Map with country-based initial position
 */
export function initMap(containerId = 'map') {
  if (mapInstance) return mapInstance;

  const country = getUserCountry();

  mapInstance = L.map(containerId, {
    center: [country.lat, country.lng],
    zoom: country.zoom,
    minZoom: 3,
    maxZoom: 19,
    zoomControl: false
  });

  // --- Bulletproof Pin Click Detection (pointerdown + pointerup) ---
  // Leaflet on PC consumes 'click' events via its drag detection.
  // We bypass this by tracking pointerdown and pointerup independently.
  const mapContainer = document.getElementById(containerId);
  if (mapContainer && !mapContainer._hasPhotoClickListener) {
    mapContainer._hasPhotoClickListener = true;

    let downX = 0;
    let downY = 0;
    let downTarget = null;

    mapContainer.addEventListener('pointerdown', (e) => {
      downX = e.clientX;
      downY = e.clientY;
      downTarget = e.target.closest('[data-photo-id]');
    }, { capture: true, passive: true });

    mapContainer.addEventListener('pointerup', (e) => {
      const dx = Math.abs(e.clientX - downX);
      const dy = Math.abs(e.clientY - downY);
      // Treat as a click if pointer barely moved (< 12px) and we had a pin on pointerdown
      if (dx < 12 && dy < 12 && downTarget) {
        const photoId = downTarget.getAttribute('data-photo-id');
        const photo = geoService.cache.get(photoId);
        if (photo) {
          e.preventDefault();
          e.stopPropagation();
          // Defer to next tick so Leaflet finishes its own event processing first
          setTimeout(() => showPhotoViewer(photo, () => renderMapMarkers()), 0);
        }
      }
      downTarget = null;
    }, { capture: true });
  }

  // CartoDB Voyager tiles
  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; OSM',
      subdomains: 'abcd',
      maxZoom: 20,
      keepBuffer: 6,
      updateInterval: 120
    }
  ).addTo(mapInstance);

  singleMarkersLayer = L.layerGroup();
  mapInstance.addLayer(singleMarkersLayer);

  mapInstance.on('moveend zoomend', handleMapViewportChange);

  // Setup real-time listener for current group and metadata
  function attachGroupSync(targetGroupCode) {
    if (groupUnsubscribe) { groupUnsubscribe(); groupUnsubscribe = null; }
    if (metaUnsubscribe) { metaUnsubscribe(); metaUnsubscribe = null; }

    const currentCode = targetGroupCode || getActiveGroupCode();

    if (currentCode) {
      // 1. Live photos sync (instant pin add/remove)
      groupUnsubscribe = subscribeToGroupUpdates(
        currentCode,
        (newPhoto) => {
          if (newPhoto) notifyNewGroupPhoto(newPhoto);
          renderMapMarkers();
        },
        () => renderMapMarkers()
      );

      // 2. Group metadata sync (name change, ban, deletion)
      metaUnsubscribe = subscribeToGroupMetadata(currentCode, (meta) => {
        const currentUserName = getCurrentDisplayName();

        if (!meta.exists || meta.isDeleted || meta.status === 'deleted') {
          clearActiveGroup();
          updateHeaderGroupBadge();
          showToast('Цю групу було видалено адміністратором 🗑️', 'info', 4000);
          document.getElementById('friends-modal-backdrop')?.remove();
          renderMapMarkers();
          return;
        }

        const banned = Array.isArray(meta.bannedMembers) ? meta.bannedMembers : [];
        if (banned.includes(currentUserName)) {
          clearActiveGroup();
          updateHeaderGroupBadge();
          showToast('Вас було вилучено з цієї групи адміністратором 🚫', 'error', 4000);
          document.getElementById('friends-modal-backdrop')?.remove();
          renderMapMarkers();
          return;
        }

        if (meta.name) {
          setActiveGroup(currentCode, meta.name);
          updateHeaderGroupBadge();
        }
      });
    }

    renderMapMarkers();
  }

  attachGroupSync(getActiveGroupCode());

  onGroupChange(({ groupCode }) => {
    attachGroupSync(groupCode);
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
 * Re-render markers based on current zoom level and active group filter
 */
export function renderMapMarkers() {
  if (!mapInstance || !singleMarkersLayer) return;

  const currentZoom = mapInstance.getZoom();
  const bounds = mapInstance.getBounds();
  const activeGroup = getActiveGroupCode();
  const filterMode = getFilterMode();

  let visiblePhotos = [];

  if (filterMode === 'group' && activeGroup) {
    for (const photo of geoService.cache.values()) {
      if (photo.groupCode === activeGroup) visiblePhotos.push(photo);
    }
  } else {
    const allVisible = geoService.getCachedPhotosInBounds(bounds);
    visiblePhotos = allVisible.filter((photo) =>
      !photo.groupCode || photo.groupCode === activeGroup
    );
  }

  singleMarkersLayer.clearLayers();

  visiblePhotos.forEach((photo) => {
    const styleType = currentZoom >= 14 ? 'thumb' : 'emoji';
    singleMarkersLayer.addLayer(createMarkerForPhoto(photo, styleType));
  });
}

/**
 * Create a Leaflet Marker with Custom DivIcon
 * Click is handled exclusively by the container-level pointerdown/pointerup delegation
 */
function createMarkerForPhoto(photo, styleType = 'emoji') {
  let iconHtml = '';
  let iconSize = [38, 44];
  let iconAnchor = [19, 44];

  if (styleType === 'thumb' && photo.thumbUrl) {
    iconHtml = `
      <div class="thumb-pin-container" data-photo-id="${photo.id}">
        <img class="thumb-pin-image" src="${photo.thumbUrl}" alt="Фото" loading="lazy" />
        <span class="thumb-pin-badge">${photo.emoji || '📸'}</span>
      </div>
    `;
    iconSize = [54, 62];
    iconAnchor = [27, 62];
  } else {
    iconHtml = `
      <div class="emoji-pin-bubble" data-photo-id="${photo.id}">
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

  const marker = L.marker([photo.lat, photo.lng], {
    icon: customIcon,
    riseOnHover: true,
    keyboard: true,
    interactive: true,
    bubblingMouseEvents: false
  });

  marker.photoData = photo;
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
      mapInstance.flyTo([pos.coords.latitude, pos.coords.longitude], 14, { duration: 1.4 });
      showToast('Локацію знайдено!', 'success');
    },
    () => {
      showToast('Не вдалося отримати GPS. Перевірте дозволи геоданих.', 'error');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

export function startManualLocationPicker(onConfirmed) {
  isPickerActive = true;

  const crosshair = document.getElementById('crosshair-picker');
  if (crosshair) crosshair.classList.remove('hidden');

  const btnConfirm = document.getElementById('btn-confirm-location');
  if (btnConfirm) {
    btnConfirm.onclick = () => {
      if (!mapInstance) return;
      const center = mapInstance.getCenter();
      stopManualLocationPicker();
      if (typeof onConfirmed === 'function') {
        onConfirmed({
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
