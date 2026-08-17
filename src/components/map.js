/**
 * Map Component (Leaflet.js + MarkerCluster)
 * Dynamic zoom rendering:
 * - Zoom <= 10: Clusters (Leaflet.markercluster)
 * - Zoom 11-14: Custom Emoji Pins
 * - Zoom >= 15: Photo Micro-Thumbnails
 */
import L from 'leaflet';
import 'leaflet.markercluster';
import { geoService } from '../services/geoService.js';
import { fetchPhotosForGeohashes } from '../services/firebase.js';
import { openPhotoDetailModal } from './photoDetailModal.js';
import { showToast } from '../utils/toast.js';

let mapInstance = null;
let clusterGroup = null;
let singleMarkersLayer = null;
let isPickerActive = false;
let onLocationSelectedCallback = null;
let debounceTimer = null;

// Default map view: Center of Ukraine / Europe view
const DEFAULT_CENTER = [48.3794, 31.1656];
const DEFAULT_ZOOM = 6;

/**
 * Initialize Leaflet Map
 */
export function initMap(containerId = 'map') {
  if (mapInstance) return mapInstance;

  // Initialize Map with smooth wheel zoom and attribution
  mapInstance = L.map(containerId, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    minZoom: 3,
    maxZoom: 19,
    zoomControl: false // Using custom controls
  });

  // Soft Eye-Care CartoDB Positron TileLayer
  const tileLayer = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }
  );
  tileLayer.addTo(mapInstance);

  // Initialize Cluster Layer with custom styling
  clusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
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

  // Listen to map movements & zoom level changes
  mapInstance.on('moveend zoomend', handleMapViewportChange);

  // Initial load
  handleMapViewportChange();

  return mapInstance;
}

/**
 * Handle viewport move/zoom event with debounce to prevent extra queries
 */
async function handleMapViewportChange() {
  if (!mapInstance) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const bounds = mapInstance.getBounds();
    const zoom = mapInstance.getZoom();

    // 1. Find uncached geohash cells in current viewport
    const uncachedHashes = geoService.getUncachedGeohashes(bounds, zoom);

    if (uncachedHashes.length > 0) {
      // Fetch only for new geohashes
      const newPhotos = await fetchPhotosForGeohashes(uncachedHashes);
      geoService.addPhotosToCache(newPhotos);
      geoService.markGeohashesQueried(uncachedHashes);
    }

    // 2. Render all visible points from in-memory cache according to zoom level
    renderMapMarkers();
  }, 220);
}

import { getActiveGroupCode, getFilterMode, onGroupChange } from '../services/groupService.js';

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

  // Filter photos based on group mode
  const visiblePhotos = allVisiblePhotos.filter((photo) => {
    if (filterMode === 'group' && activeGroup) {
      return photo.groupCode === activeGroup;
    }
    // 'all' mode: show public photos + current group photos
    if (!photo.groupCode) return true;
    return photo.groupCode === activeGroup;
  });

  clusterGroup.clearLayers();
  singleMarkersLayer.clearLayers();

  if (currentZoom <= 10) {
    // Zoom Out: Use Marker Clusters
    const markers = visiblePhotos.map((photo) => createMarkerForPhoto(photo, 'emoji'));
    clusterGroup.addLayers(markers);
  } else if (currentZoom >= 11 && currentZoom <= 14) {
    // Medium Zoom: Use Custom Emoji Pins
    visiblePhotos.forEach((photo) => {
      const marker = createMarkerForPhoto(photo, 'emoji');
      singleMarkersLayer.addLayer(marker);
    });
  } else {
    // Zoom In (>= 15): Use Photo Micro-Thumbnail Pins
    visiblePhotos.forEach((photo) => {
      const marker = createMarkerForPhoto(photo, 'thumb');
      singleMarkersLayer.addLayer(marker);
    });
  }
}

/**
 * Create Leaflet Marker with Custom DivIcon
 * @param {Object} photo 
 * @param {'emoji'|'thumb'} styleType 
 */
function createMarkerForPhoto(photo, styleType = 'emoji') {
  let iconHtml = '';
  let iconSize = [38, 44];
  let iconAnchor = [19, 44];

  if (styleType === 'thumb' && photo.thumbUrl) {
    iconHtml = `
      <div class="thumb-pin-container">
        <img class="thumb-pin-image" src="${photo.thumbUrl}" alt="${photo.description || 'Фото'}" loading="lazy" />
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

  // On Click -> Open Photo Detail Modal
  marker.on('click', () => {
    openPhotoDetailModal(photo);
  });

  return marker;
}

/**
 * Center map on user's current GPS location
 */
export function locateUser() {
  if (!mapInstance) return;

  if (!navigator.geolocation) {
    showToast('Геолокація не підтримується цим браузером', 'error');
    return;
  }

  showToast('Визначення вашого місцезнаходження...', 'info', 2000);

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      mapInstance.flyTo([lat, lng], 14, { duration: 1.5 });
      showToast('Локацію знайдено!', 'success');
    },
    (err) => {
      console.warn('Geolocation error:', err);
      showToast('Не вдалося отримати геолокацію. Перевірте дозволи браузера.', 'error');
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

/**
 * Manual Pin / Crosshair Picker Mode
 */
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

/**
 * Fly map to coordinates
 */
export function flyToCoords(lat, lng, zoom = 15) {
  if (mapInstance) {
    mapInstance.flyTo([lat, lng], zoom, { duration: 1.2 });
  }
}

export function getMapInstance() {
  return mapInstance;
}
