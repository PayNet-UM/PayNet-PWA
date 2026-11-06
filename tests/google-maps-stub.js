// A tiny stand-in for the Google Maps JavaScript API, used by tests/e2e.mjs so the Google code path
// runs offline. It draws markers as plain DOM nodes inside the map element.
(function () {
  const cb = new URL(document.currentScript.src).searchParams.get('callback');
  class MVC { constructor() { this._l = {}; } addListener(ev, fn) { (this._l[ev] = this._l[ev] || []).push(fn); return { remove() {} }; } _fire(ev, a) { (this._l[ev] || []).forEach((f) => f(a)); } }
  class LatLng { constructor(a, b) { this._a = a; this._b = b; } lat() { return this._a; } lng() { return this._b; } }
  class Map extends MVC {
    constructor(el, o) {
      super(); this.el = el; this.o = o; this.z = o.zoom;
      el.innerHTML = '<div class="gm-style gm-stub" style="position:relative;width:100%;height:100%;background:#dfe9e2;display:flex;flex-wrap:wrap;gap:6px;padding:8px;align-content:flex-start"></div>';
      this.layer = el.firstChild;
      this.layer.addEventListener('click', (e) => { if (e.target === this.layer) this._fire('click', { latLng: new LatLng(3.1201, 101.6544) }); });
      window.__gmaps = (window.__gmaps || []).concat(this);
    }
    setCenter(c) { this.c = c; } setZoom(z) { this.z = z; } getZoom() { return this.z; }
    fitBounds(b) { this.b = b; setTimeout(() => this._fire('idle'), 0); }
  }
  class AdvancedMarkerElement extends MVC {
    constructor(o) { super(); const { map, ...rest } = o; Object.assign(this, rest); this._map = null; this.map = map; }
    set map(m) {
      if (this._node) this._node.remove(); this._map = m;
      if (m) { this._node = document.createElement('div'); this._node.className = 'gm-stub-marker'; this._node.title = this.title || ''; if (this.content) this._node.append(this.content);
        this._node.onclick = () => { this._fire('click'); this._fire('dragend'); }; m.layer.append(this._node); }
    }
    get map() { return this._map; }
  }
  class InfoWindow { setContent(n) { this.n = n; } open({ map }) { this.close(); this.w = document.createElement('div'); this.w.className = 'gm-stub-info'; this.w.append(this.n); map.layer.append(this.w); } close() { if (this.w) this.w.remove(); } }
  class LatLngBounds { constructor() { this.pts = []; } extend(p) { this.pts.push(p); } }
  window.google = { maps: { Map, InfoWindow, LatLngBounds, LatLng, marker: { AdvancedMarkerElement }, event: { addListenerOnce: (o, ev, fn) => o.addListener(ev, fn) } } };
  setTimeout(() => window[cb](), 0);
})();
