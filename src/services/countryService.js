/**
 * Country & Regional Map Position Service
 * Allows users to choose their country/flag in profile, centering the map accordingly
 */
export const COUNTRIES = [
  { code: 'UA', flag: '🇺🇦', name: 'Україна', lat: 48.3794, lng: 31.1656, zoom: 6 },
  { code: 'PL', flag: '🇵🇱', name: 'Польща', lat: 52.2297, lng: 21.0122, zoom: 6 },
  { code: 'DE', flag: '🇩🇪', name: 'Німеччина', lat: 51.1657, lng: 10.4515, zoom: 6 },
  { code: 'GB', flag: '🇬🇧', name: 'Велика Британія', lat: 54.5593, lng: -2.1466, zoom: 6 },
  { code: 'US', flag: '🇺🇸', name: 'США', lat: 39.8283, lng: -98.5795, zoom: 4 },
  { code: 'CA', flag: '🇨🇦', name: 'Канада', lat: 56.1304, lng: -106.3468, zoom: 4 },
  { code: 'ES', flag: '🇪🇸', name: 'Іспанія', lat: 40.4637, lng: -3.7492, zoom: 6 },
  { code: 'IT', flag: '🇮🇹', name: 'Італія', lat: 41.8719, lng: 12.5674, zoom: 6 },
  { code: 'FR', flag: '🇫🇷', name: 'Франція', lat: 46.2276, lng: 2.2137, zoom: 6 },
  { code: 'CZ', flag: '🇨🇿', name: 'Чехія', lat: 49.8175, lng: 15.4730, zoom: 7 },
  { code: 'SK', flag: '🇸🇰', name: 'Словаччина', lat: 48.6690, lng: 19.6990, zoom: 7 },
  { code: 'RO', flag: '🇷🇴', name: 'Румунія', lat: 45.9432, lng: 24.9668, zoom: 7 },
  { code: 'HU', flag: '🇭🇺', name: 'Угорщина', lat: 47.1625, lng: 19.5033, zoom: 7 },
  { code: 'LT', flag: '🇱🇹', name: 'Литва', lat: 55.1694, lng: 23.8813, zoom: 7 },
  { code: 'LV', flag: '🇱🇻', name: 'Латвія', lat: 56.8796, lng: 24.6032, zoom: 7 },
  { code: 'EE', flag: '🇪🇪', name: 'Естонія', lat: 58.5953, lng: 25.0136, zoom: 7 },
  { code: 'GE', flag: '🇬🇪', name: 'Грузія', lat: 42.3154, lng: 43.3569, zoom: 7 },
  { code: 'TR', flag: '🇹🇷', name: 'Туреччина', lat: 38.9637, lng: 35.2433, zoom: 6 },
  { code: 'IL', flag: '🇮🇱', name: 'Ізраїль', lat: 31.0461, lng: 34.8516, zoom: 8 },
  { code: 'JP', flag: '🇯🇵', name: 'Японія', lat: 36.2048, lng: 138.2529, zoom: 6 }
];

const USER_COUNTRY_KEY = 'ftm_user_selected_country';

export function getUserCountry() {
  const savedCode = localStorage.getItem(USER_COUNTRY_KEY) || 'UA';
  const found = COUNTRIES.find(c => c.code === savedCode);
  return found || COUNTRIES[0];
}

export function setUserCountry(code) {
  const found = COUNTRIES.find(c => c.code === code);
  if (found) {
    localStorage.setItem(USER_COUNTRY_KEY, found.code);
    return found;
  }
  return COUNTRIES[0];
}
