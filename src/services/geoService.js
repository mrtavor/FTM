/**
 * Geo Service: Geohashing, Bounding Box calculation & Smart Firestore Querying
 * Highly optimized for Firebase Spark plan limits (50k reads/day)
 */
import geohash from 'ngeohash';

export class GeoService {
  constructor() {
    // In-memory cache to store already loaded photos (id -> photoDoc)
    this.cache = new Map();
    // Set of geohashes already queried in the current session
    this.queriedGeohashes = new Set();
  }

  /**
   * Encode lat/lng to geohash string
   * @param {number} lat 
   * @param {number} lng 
   * @param {number} precision 
   * @returns {string}
   */
  encode(lat, lng, precision = 9) {
    return geohash.encode(lat, lng, precision);
  }

  /**
   * Determine optimal geohash precision based on Leaflet zoom level
   * @param {number} zoom 
   * @returns {number}
   */
  getPrecisionForZoom(zoom) {
    if (zoom <= 4) return 2;
    if (zoom <= 7) return 3;
    if (zoom <= 10) return 4;
    if (zoom <= 13) return 5;
    return 6;
  }

  /**
   * Get all geohash cells covering the Leaflet bounds at given zoom
   * @param {L.LatLngBounds} bounds 
   * @param {number} zoom 
   * @returns {string[]}
   */
  getGeohashCellsInBounds(bounds, zoom) {
    const precision = this.getPrecisionForZoom(zoom);
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Clamp coordinates
    const minLat = Math.max(-85, sw.lat);
    const minLng = Math.max(-180, sw.lng);
    const maxLat = Math.min(85, ne.lat);
    const maxLng = Math.min(180, ne.lng);

    const hashes = geohash.bboxes(minLat, minLng, maxLat, maxLng, precision);
    // Limit to max 9-12 bounding cells per viewport query to prevent excessive queries
    return hashes.slice(0, 16);
  }

  /**
   * Get list of geohashes in viewport that have NOT been queried yet
   * @param {L.LatLngBounds} bounds 
   * @param {number} zoom 
   * @returns {string[]}
   */
  getUncachedGeohashes(bounds, zoom) {
    const cells = this.getGeohashCellsInBounds(bounds, zoom);
    const uncached = cells.filter((cell) => !this.queriedGeohashes.has(cell));
    return uncached;
  }

  /**
   * Mark geohash cells as fetched
   * @param {string[]} cells 
   */
  markGeohashesQueried(cells) {
    cells.forEach((cell) => this.queriedGeohashes.add(cell));
  }

  /**
   * Add photo items to in-memory cache
   * @param {Array<Object>} photos 
   */
  addPhotosToCache(photos) {
    photos.forEach((photo) => {
      if (photo && photo.id) {
        this.cache.set(photo.id, photo);
      }
    });
  }

  /**
   * Get all cached photos that fall inside current bounds
   * @param {L.LatLngBounds} bounds 
   * @returns {Array<Object>}
   */
  getCachedPhotosInBounds(bounds) {
    const results = [];
    for (const photo of this.cache.values()) {
      if (
        photo.lat >= bounds.getSouth() &&
        photo.lat <= bounds.getNorth() &&
        photo.lng >= bounds.getWest() &&
        photo.lng <= bounds.getEast()
      ) {
        results.push(photo);
      }
    }
    return results;
  }

  /**
   * Clear in-memory cache
   */
  clearCache() {
    this.cache.clear();
    this.queriedGeohashes.clear();
  }
}

export const geoService = new GeoService();
