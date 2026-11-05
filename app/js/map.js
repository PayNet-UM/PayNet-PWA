// Campus map helpers: Leaflet (vendored, loaded on demand) with OpenStreetMap/CARTO tiles,
// a pin picker for merchants and walking directions for students.
import { GEO_BOX, inGeoBox } from './data.js';
import { esc } from './ui.js';

export const UM_CENTER = [3.1218, 101.6551];
export { inGeoBox };

let leafletLoading = null;
export function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletLoading) {
    leafletLoading = new Promise((resolve, reject) => {
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'vendor/leaflet/leaflet.css'; document.head.append(css);
      const s = document.createElement('script'); s.src = 'vendor/leaflet/leaflet.js';
      s.onload = () => resolve(window.L); s.onerror = () => { leafletLoading = null; reject(new Error('The map could not load. Check your connection.')); };
      document.head.append(s);
    });
  }
  return leafletLoading;
}

export async function baseMap(el, { center = UM_CENTER, zoom = 16, interactive = true } = {}) {
  const L = await loadLeaflet();
  const map = L.map(el, { zoomControl: interactive, dragging: interactive, scrollWheelZoom: false, tap: true,
    maxBounds: [[GEO_BOX.latMin - 0.03, GEO_BOX.lngMin - 0.03], [GEO_BOX.latMax + 0.03, GEO_BOX.lngMax + 0.03]], minZoom: 13 }).setView(center, zoom);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    maxZoom: 20, subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
  }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  // the map is often created inside a container that is still being laid out
  setTimeout(() => map.invalidateSize(), 60);
  return map;
}

const COLORS = { 'Food & drinks': '#F4A019', Printing: '#258DCE', Laundry: '#29B6F6', Services: '#7A5AF8', 'Student event stall': '#00A547' };
export function pinIcon(type, label = '') {
  const c = COLORS[type] || '#00A547';
  return window.L.divIcon({ className: 'umc-pin', iconSize: [34, 40], iconAnchor: [17, 38], popupAnchor: [0, -34],
    html: `<span class="umc-pin-body${label ? '' : ' dot'}" style="--c:${c}"><i>${esc(label)}</i></span>` });
}
export function meIcon() {
  return window.L.divIcon({ className: 'umc-me', iconSize: [22, 22], iconAnchor: [11, 11], html: '<span></span>' });
}

export const hasPin = (m) => m && Number.isFinite(m.lat) && Number.isFinite(m.lng);
export const directionsUrl = (m) => `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}&travelmode=walking`;
export const wazeUrl = (m) => `https://waze.com/ul?ll=${m.lat},${m.lng}&navigate=yes`;

export function distanceM(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const fmtDistance = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m away` : `${(m / 1000).toFixed(1)} km away`);

// One-shot device location. Resolves {lat, lng, accuracy}; rejects with a readable message.
export function locate({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('This device can’t share its location. Drag the pin instead.'));
    if (!window.isSecureContext) return reject(new Error('Location only works on the https:// address of the app. Drag the pin instead.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(new Error(e.code === 1 ? 'Location permission is blocked. Allow it in your browser settings, or drag the pin instead.'
        : e.code === 3 ? 'Finding your location took too long. Try again outdoors, or drag the pin instead.'
          : 'Your location isn’t available right now. Drag the pin instead.')),
      { enableHighAccuracy: true, timeout, maximumAge: 30000 });
  });
}

// Merchant pin picker. Calls onChange({lat, lng}) whenever the pin moves.
export async function pinPicker(el, start, onChange) {
  const map = await baseMap(el, { center: hasPin(start) ? [start.lat, start.lng] : UM_CENTER, zoom: hasPin(start) ? 18 : 16 });
  const L = window.L; let marker = null; let circle = null;
  const place = (lat, lng, { pan = true, accuracy = 0 } = {}) => {
    lat = +(+lat).toFixed(6); lng = +(+lng).toFixed(6);
    if (!marker) {
      marker = L.marker([lat, lng], { draggable: true, icon: pinIcon('', ''), autoPan: true }).addTo(map);
      marker.on('dragend', () => { const p = marker.getLatLng(); place(p.lat, p.lng, { pan: false }); });
    } else marker.setLatLng([lat, lng]);
    if (circle) { circle.remove(); circle = null; }
    if (accuracy > 15) circle = L.circle([lat, lng], { radius: accuracy, color: '#258DCE', weight: 1, fillOpacity: 0.08 }).addTo(map);
    if (pan) map.setView([lat, lng], Math.max(map.getZoom(), 18));
    onChange({ lat, lng });
  };
  map.on('click', (e) => place(e.latlng.lat, e.latlng.lng, { pan: false }));
  if (hasPin(start)) place(start.lat, start.lng, { pan: false });
  return { map, place, useMyLocation: async () => { const p = await locate(); place(p.lat, p.lng, { accuracy: p.accuracy }); return p; } };
}

// A small map with one shop pin (merchant page, MPP review).
export async function shopPinMap(el, m, { zoom = 17, interactive = true } = {}) {
  const map = await baseMap(el, { center: [m.lat, m.lng], zoom, interactive });
  window.L.marker([m.lat, m.lng], { icon: pinIcon(m.type, (m.name || '?')[0].toUpperCase()), title: m.name, alt: m.name }).addTo(map);
  return map;
}
export const googleMapsPinUrl = (m) => `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`;
