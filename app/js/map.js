// Campus maps. Uses the Google Maps JavaScript API when a key is set in firebase-config.js
// (googleMapsApiKey), and falls back to Leaflet + OpenStreetMap when there is no key, in Demo mode
// without a key, or if Google rejects the key. Both engines sit behind one small interface:
//   const m = await createMap(el, { center, zoom });
//   m.setPins(list, { popup }) · m.setMe(pos) · m.fit(points) · m.setView(lat, lng, zoom)
//   m.onClick(cb) · m.dragPin(lat, lng, onMove) · m.remove()
import { GEO_BOX, inGeoBox } from './data.js';
import { safeImg, esc, colorFor, initials } from './ui.js';
import * as CFG from './firebase-config.js';

export const UM_CENTER = [3.1218, 101.6551];
export { inGeoBox };

const KEY = (CFG.googleMapsApiKey || '').trim();
const MAP_ID = (CFG.googleMapsMapId || '').trim() || 'DEMO_MAP_ID';
let googleBroken = false;
export const mapEngine = () => (KEY && !googleBroken ? 'google' : 'leaflet');

// ------------------------------------------------------------------ shared helpers
export const hasPin = (m) => m && Number.isFinite(m.lat) && Number.isFinite(m.lng);
export const directionsUrl = (m) => `https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}&travelmode=walking`;
export const wazeUrl = (m) => `https://waze.com/ul?ll=${m.lat},${m.lng}&navigate=yes`;
export const googleMapsPinUrl = (m) => `https://www.google.com/maps/search/?api=1&query=${m.lat},${m.lng}`;
export function distanceM(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const fmtDistance = (m) => (m < 1000 ? `${Math.max(10, Math.round(m / 10) * 10)} m away` : `${(m / 1000).toFixed(1)} km away`);

const TYPE_COLORS = { 'Food & drinks': '#F4A019', Printing: '#258DCE', Laundry: '#29B6F6', Services: '#7A5AF8', Shops: '#E85A8C', 'Student event stall': '#00A547' };
// The pin is plain HTML, so both engines show the merchant's logo the same way.
export function pinHTML(m) {
  const c = TYPE_COLORS[m && m.type] || '#00A547';
  const inner = m && safeImg(m.logo) ? `<img src="${safeImg(m.logo)}" alt="">` : m && m.name ? `<b style="background:${colorFor(m.name)}">${esc(initials(m.name))}</b>` : '<i></i>';
  return `<span class="kk-pin" style="--c:${c}"><span class="kk-pin-head">${inner}</span></span>`;
}
const meHTML = () => '<span class="kk-me"><span></span></span>';

const LOC_ERR = (e) => new Error(e.code === 1 ? 'Location permission is blocked. Allow it in your browser settings, then try again.'
  : e.code === 3 ? 'Finding your location took too long. Try again outdoors.'
    : 'Your location isn’t available right now. Try again in a moment.');
function geoReady() {
  if (!('geolocation' in navigator)) return new Error('This device can’t share its location.');
  if (!window.isSecureContext) return new Error('Location only works on the https:// address of the app.');
  return null;
}
// One-shot device location. Resolves {lat, lng, accuracy}; rejects with a readable message.
export function locate({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const bad = geoReady(); if (bad) return reject(bad);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), accuracy: Math.round(p.coords.accuracy) }),
      (e) => reject(LOC_ERR(e)), { enableHighAccuracy: true, timeout, maximumAge: 15000 });
  });
}
// Live location while a screen is open. Returns a stop() function.
export function watchLocation(onPos, onErr) {
  const bad = geoReady(); if (bad) { onErr && onErr(bad); return () => {}; }
  const id = navigator.geolocation.watchPosition(
    (p) => onPos({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), accuracy: Math.round(p.coords.accuracy) }),
    (e) => onErr && onErr(LOC_ERR(e)), { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
  return () => navigator.geolocation.clearWatch(id);
}

// ------------------------------------------------------------------ Google Maps engine
let googleLoading = null;
function loadGoogle() {
  if (window.google && window.google.maps && window.google.maps.Map) return Promise.resolve(window.google.maps);
  if (!googleLoading) {
    googleLoading = new Promise((resolve, reject) => {
      window.__kkMapsReady = () => resolve(window.google.maps);
      window.gm_authFailure = () => { googleBroken = true; window.dispatchEvent(new Event('kk-maps-fallback')); };
      const lang = document.documentElement.lang === 'ms' ? 'ms' : 'en';
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&libraries=marker&loading=async&language=${lang}&region=MY&callback=__kkMapsReady`;
      s.async = true;
      s.onerror = () => { googleLoading = null; googleBroken = true; reject(new Error('Google Maps could not load.')); };
      document.head.append(s);
    });
  }
  return googleLoading;
}
const node = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };
const latOf = (p) => (typeof p.lat === 'function' ? p.lat() : p.lat);
const lngOf = (p) => (typeof p.lng === 'function' ? p.lng() : p.lng);

async function googleMap(el, { center, zoom, interactive }) {
  const g = await loadGoogle();
  const map = new g.Map(el, {
    center: { lat: center[0], lng: center[1] }, zoom, mapId: MAP_ID, clickableIcons: false,
    disableDefaultUI: true, zoomControl: interactive, fullscreenControl: false, gestureHandling: interactive ? 'greedy' : 'none',
    restriction: { latLngBounds: { north: GEO_BOX.latMax + 0.05, south: GEO_BOX.latMin - 0.05, east: GEO_BOX.lngMax + 0.05, west: GEO_BOX.lngMin - 0.05 }, strictBounds: false },
  });
  const AM = g.marker.AdvancedMarkerElement;
  const info = new g.InfoWindow();
  let pins = [], me = null, drag = null;
  const onTap = (marker, fn) => {
    let last = 0; const go = () => { const t = Date.now(); if (t - last > 300) { last = t; fn(); } };
    if (marker.addListener) marker.addListener('click', go);
    if (marker.addEventListener) marker.addEventListener('gmp-click', go);
  };
  return {
    engine: 'google', raw: map,
    setPins(list, { popup } = {}) {
      pins.forEach((p) => { p.map = null; }); pins = [];
      list.filter(hasPin).forEach((m) => {
        const mk = new AM({ map, position: { lat: m.lat, lng: m.lng }, title: m.name || '', content: node(pinHTML(m)), gmpClickable: !!popup });
        if (popup) onTap(mk, () => { info.setContent(node(`<div>${popup(m)}</div>`)); info.open({ anchor: mk, map }); });
        pins.push(mk);
      });
    },
    setMe(pos) {
      if (!pos) return;
      if (me) me.position = { lat: pos.lat, lng: pos.lng };
      else me = new AM({ map, position: { lat: pos.lat, lng: pos.lng }, title: 'You', content: node(meHTML()), zIndex: 1000 });
    },
    fit(points) {
      if (!points.length) return;
      if (points.length === 1) { map.setCenter({ lat: points[0][0], lng: points[0][1] }); map.setZoom(17); return; }
      const b = new g.LatLngBounds(); points.forEach(([a, c]) => b.extend({ lat: a, lng: c }));
      map.fitBounds(b, 48);
      g.event.addListenerOnce(map, 'idle', () => { if (map.getZoom() > 17) map.setZoom(17); });
    },
    setView(lat, lng, z) { map.setCenter({ lat, lng }); if (z) map.setZoom(z); },
    onClick(cb) { map.addListener('click', (e) => e.latLng && cb(e.latLng.lat(), e.latLng.lng())); },
    dragPin(lat, lng, onMove) {
      if (!drag) {
        drag = new AM({ map, position: { lat, lng }, gmpDraggable: true, title: 'Your shop', content: node(pinHTML(null)) });
        const done = () => { const p = drag.position; onMove(latOf(p), lngOf(p)); };
        if (drag.addListener) drag.addListener('dragend', done);
        if (drag.addEventListener) drag.addEventListener('gmp-dragend', done);
      } else drag.position = { lat, lng };
    },
    zoom: () => map.getZoom(),
    remove() { pins.forEach((p) => { p.map = null; }); if (me) me.map = null; if (drag) drag.map = null; info.close(); el.innerHTML = ''; },
  };
}

// ------------------------------------------------------------------ Leaflet fallback
let leafletLoading = null;
function loadLeaflet() {
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
async function leafletMap(el, { center, zoom, interactive }) {
  const L = await loadLeaflet();
  const map = L.map(el, { zoomControl: interactive, dragging: interactive, scrollWheelZoom: false, tap: true, zoomAnimation: false, markerZoomAnimation: false,
    maxBounds: [[GEO_BOX.latMin - 0.03, GEO_BOX.lngMin - 0.03], [GEO_BOX.latMax + 0.03, GEO_BOX.lngMax + 0.03]], minZoom: 13 }).setView(center, zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(map);
  map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
  setTimeout(() => map.invalidateSize(), 60);
  const icon = (html, size = [40, 48], anchor = [20, 46]) => L.divIcon({ className: 'kk-pin-wrap', iconSize: size, iconAnchor: anchor, popupAnchor: [0, -42], html });
  const layer = L.layerGroup().addTo(map); let me = null, drag = null;
  return {
    engine: 'leaflet', raw: map,
    setPins(list, { popup } = {}) {
      layer.clearLayers();
      list.filter(hasPin).forEach((m) => {
        const mk = L.marker([m.lat, m.lng], { icon: icon(pinHTML(m)), title: m.name || '', alt: m.name || '' }).addTo(layer);
        if (popup) mk.bindPopup(popup(m), { minWidth: 200, autoPanPadding: [12, 12], keepInView: true });
      });
    },
    setMe(pos) {
      if (!pos) return;
      if (me) me.setLatLng([pos.lat, pos.lng]);
      else me = L.marker([pos.lat, pos.lng], { icon: icon(meHTML(), [22, 22], [11, 11]), title: 'You', zIndexOffset: 1000 }).addTo(map);
    },
    fit(points) {
      if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 17, animate: false });
      else if (points.length === 1) map.setView(points[0], 17, { animate: false });
    },
    setView(lat, lng, z) { map.setView([lat, lng], z || map.getZoom()); },
    onClick(cb) { map.on('click', (e) => cb(e.latlng.lat, e.latlng.lng)); },
    dragPin(lat, lng, onMove) {
      if (!drag) {
        drag = L.marker([lat, lng], { draggable: true, icon: icon(pinHTML(null)), autoPan: true }).addTo(map);
        drag.on('dragend', () => { const p = drag.getLatLng(); onMove(p.lat, p.lng); });
      } else drag.setLatLng([lat, lng]);
    },
    zoom: () => map.getZoom(),
    remove() { try { map.stop(); map.off(); map.remove(); } catch { /* already gone */ } },
  };
}

// ------------------------------------------------------------------ public API
export async function createMap(el, { center = UM_CENTER, zoom = 16, interactive = true } = {}) {
  if (mapEngine() === 'google') {
    try { return await googleMap(el, { center, zoom, interactive }); } catch (e) { console.warn('Google Maps unavailable, using the basic map', e); googleBroken = true; }
  }
  return leafletMap(el, { center, zoom, interactive });
}

// Merchant pin picker. Calls onChange({lat, lng}) whenever the pin moves.
export async function pinPicker(el, start, onChange) {
  const map = await createMap(el, { center: hasPin(start) ? [start.lat, start.lng] : UM_CENTER, zoom: hasPin(start) ? 18 : 16 });
  const place = (lat, lng, { pan = true } = {}) => {
    lat = +(+lat).toFixed(6); lng = +(+lng).toFixed(6);
    map.dragPin(lat, lng, (a, b) => place(a, b, { pan: false }));
    if (pan) map.setView(lat, lng, Math.max(map.zoom() || 16, 18));
    onChange({ lat, lng });
  };
  map.onClick((lat, lng) => place(lat, lng, { pan: false }));
  if (hasPin(start)) place(start.lat, start.lng, { pan: false });
  return { map, place, useMyLocation: async () => { const p = await locate(); place(p.lat, p.lng); return p; } };
}

// A small map with one shop pin (merchant page, HEP review).
export async function shopPinMap(el, m, { zoom = 17, interactive = true } = {}) {
  const map = await createMap(el, { center: [m.lat, m.lng], zoom, interactive });
  map.setPins([m]);
  return map;
}
