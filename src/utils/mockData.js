/**
 * Sample Demo Data for Instant Exploration & Testing
 * Covers various locations (Kyiv, Lviv, Odesa, Carpathians, etc.)
 */
import { geoService } from '../services/geoService.js';

export const SAMPLE_LOCATIONS = [
  {
    id: 'demo_kyiv_sofia',
    lat: 50.4528,
    lng: 30.5144,
    geohash: 'u8vx5r',
    description: 'Софійський собор у серці стародавнього Києва 🏰',
    emoji: '🏰',
    mainUrl: 'https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?w=800&auto=format&fit=crop&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1596484552834-6a58f850e0a1?w=160&auto=format&fit=crop&q=80',
    userId: 'demo_user',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'demo_kyiv_dnipro',
    lat: 50.4402,
    lng: 30.5630,
    geohash: 'u8vx7f',
    description: 'Захід сонця на набережній Дніпра 🌅',
    emoji: '🌅',
    mainUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&auto=format&fit=crop&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=160&auto=format&fit=crop&q=80',
    userId: 'demo_user',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString()
  },
  {
    id: 'demo_lviv_ratusza',
    lat: 49.8418,
    lng: 24.0315,
    geohash: 'u82k9m',
    description: 'Ароматна львівська кава на площі Ринок ☕',
    emoji: '☕',
    mainUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=160&auto=format&fit=crop&q=80',
    userId: 'demo_user',
    createdAt: new Date(Date.now() - 3600000 * 72).toISOString()
  },
  {
    id: 'demo_carpathians_hoverla',
    lat: 48.1603,
    lng: 24.5002,
    geohash: 'u80s5t',
    description: 'Підйом на Говерлу, неймовірні гірські краєвиди 🌲',
    emoji: '🌲',
    mainUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=160&auto=format&fit=crop&q=80',
    userId: 'demo_user',
    createdAt: new Date(Date.now() - 3600000 * 96).toISOString()
  },
  {
    id: 'demo_odesa_opera',
    lat: 46.4854,
    lng: 30.7412,
    geohash: 'u85jzk',
    description: 'Морський бриз та театр в Одесі ⛵',
    emoji: '⛵',
    mainUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=160&auto=format&fit=crop&q=80',
    userId: 'demo_user',
    createdAt: new Date(Date.now() - 3600000 * 120).toISOString()
  }
];

export function loadSampleLocations() {
  geoService.addPhotosToCache(SAMPLE_LOCATIONS);
}
