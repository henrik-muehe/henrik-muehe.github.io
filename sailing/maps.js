/* The default renderer for every sailing map, old and new. Requires Leaflet 1.9.4. */
(function () {
  'use strict';
  const discovered = new WeakSet();
  let nextId = 0;

  function legend(element, preview) {
    element.classList.add('speed-legend');
    element.innerHTML = '<strong>Estimated speed over ground · knots</strong>' +
      '<div class="speed-gradient" aria-hidden="true"></div>' +
      '<div class="speed-ticks" aria-hidden="true"><span>0</span><span>2</span><span>4</span>' +
      '<span>6</span><span>8</span><span>10</span><span>12+</span></div>' +
      '<p class="speed-hint">Blue = slow, red = fast (0–12+ kn). Gray = speed unavailable. ' +
      (preview ? 'Open any entry, then hover over the track or tap it to see speed and time.' :
        'Hover over the track or tap it to see speed and time.') +
      ' Colors show GPS averages between fixes, not instantaneous instrument readings.</p>';
    SailingSpeed.fillLegend(element);
    element.hidden = false;
  }

  function message(element, text, state) {
    element.textContent = text;
    element.dataset.mapState = state;
    element.setAttribute('role', 'status');
  }

  async function render(element, inlineSource, preview) {
    element.dataset.mapState = 'loading';
    let map;
    try {
      let source = inlineSource;
      if (element.dataset.gpxSrc) {
        const response = await fetch(element.dataset.gpxSrc);
        if (!response.ok) throw new Error('Could not load GPX track (HTTP ' + response.status + ')');
        source = await response.text();
      } else if (element.dataset.gpxInline) {
        const script = document.getElementById(element.dataset.gpxInline);
        if (!script) throw new Error('Embedded GPX source is missing');
        source = script.textContent;
      }
      if (!source || !source.trim()) {
        message(element, 'No track available.', 'empty');
        return;
      }
      const gpx = new DOMParser().parseFromString(source, 'application/xml');
      if (gpx.querySelector('parsererror')) throw new Error('Could not parse GPX track');
      const legs = SailingSpeed.buildLegs(SailingSpeed.parseGPX(gpx));
      if (!legs.length) {
        message(element, 'No track available.', 'empty');
        return;
      }
      const timeZone = element.dataset.timeZone || 'UTC';
      // Validate explicitly; do not silently put Californian/Hawaiian tracks in Berlin time.
      new Intl.DateTimeFormat('en-GB', { timeZone: timeZone });
      map = L.map(element, {
        zoomControl: !preview, dragging: !preview, touchZoom: !preview,
        doubleClickZoom: !preview, scrollWheelZoom: !preview, boxZoom: !preview, keyboard: !preview
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      const track = SailingSpeed.drawTrack(L, legs).addTo(map);
      map.fitBounds(track.getBounds(), { padding: preview ? [15, 15] : [20, 20] });
      if (!preview) {
        SailingSpeed.addSpeedHover(L, map, legs, timeZone);
        const first = legs[0].a, last = legs[legs.length - 1].b;
        [[first, 'Start', '#18864b'], [last, 'Finish', '#c83232']].forEach(function (entry) {
          L.circleMarker([entry[0].lat, entry[0].lng], {
            radius: 6, color: '#fff', weight: 2, fillColor: entry[2], fillOpacity: 1, bubblingMouseEvents: false
          }).addTo(map).bindPopup(entry[1] + ' · ' + SailingSpeed.formatTime(entry[0].time, timeZone));
        });
        const key = document.createElement('div');
        key.id = element.id + '-legend';
        element.insertAdjacentElement('afterend', key);
        element.setAttribute('aria-describedby', key.id);
        legend(key, false);
        const distance = document.getElementById(element.dataset.distanceTarget || 'distance');
        if (distance) distance.textContent = (legs.reduce(function (sum, leg) { return sum + leg.meters; }, 0) / 1852).toFixed(2);
      }
      element.dataset.legCount = String(legs.length);
      element.dataset.unknownSpeedCount = String(legs.filter(function (leg) { return !Number.isFinite(leg.knots); }).length);
      element.dataset.mapState = 'ready';
    } catch (error) {
      if (map) map.remove();
      message(element, 'Track map unavailable: ' + error.message, 'error');
    }
  }

  const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const load = pending.get(entry.target);
      pending.delete(entry.target);
      if (load) load();
    });
  }, { rootMargin: '300px' }) : null;
  const pending = new WeakMap();

  function register(element, source, preview) {
    if (!element || discovered.has(element)) return;
    discovered.add(element);
    element.classList.add('sailing-map');
    if (!element.id) element.id = 'sailing-map-' + (++nextId);
    if (!element.hasAttribute('aria-label')) element.setAttribute('aria-label', 'Sailing track colored by estimated speed');
    element.dataset.mapState = 'pending';
    if (preview && observer) {
      pending.set(element, function () { render(element, source, true); });
      observer.observe(element);
    } else {
      render(element, source, preview);
    }
  }

  function init(root = document) {
    root.querySelectorAll('[data-sailing-legend]').forEach(function (element) { legend(element, true); });
    // Compatibility with the historical index's inline GPX cards. Color is the
    // default for every card: no data-speed flag or per-entry JS is necessary.
    root.querySelectorAll('.gpx-data').forEach(function (script) {
      const element = document.getElementById('map-' + script.dataset.filename);
      if (element && script.dataset.src) element.dataset.gpxSrc = script.dataset.src;
      register(element, script.textContent, true);
    });
    root.querySelectorAll('.sailing-map').forEach(function (element) {
      register(element, '', element.classList.contains('minimap'));
    });
  }

  window.SailingMaps = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); });
  else init();
})();
