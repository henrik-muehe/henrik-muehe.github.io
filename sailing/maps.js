/* The default renderer for every sailing map, old and new. Requires Leaflet 1.9.4. */
(function () {
  'use strict';
  const discovered = new WeakSet();
  let nextId = 0;
  const idleReadout = 'Hover over or drag along the scale to highlight every leg sailed at that speed.';

  function formatDuration(seconds) {
    if (seconds < 60) return Math.round(seconds) + ' s';
    const minutes = Math.round(seconds / 60);
    return minutes < 60 ? minutes + ' min' : Math.floor(minutes / 60) + ' h ' + String(minutes % 60).padStart(2, '0') + ' min';
  }

  function bandLabel(center) {
    const max = SailingSpeed.maxKnots, low = Math.max(0, center - SailingSpeed.bandHalfWidth);
    const high = center + SailingSpeed.bandHalfWidth;
    return high >= max ? low + '+ kn' : low + '–' + high + ' kn';
  }

  function interactiveScale(element, highlight) {
    const max = SailingSpeed.maxKnots;
    const scale = element.querySelector('.speed-scale');
    const band = element.querySelector('.speed-band');
    const readout = element.querySelector('.speed-readout');
    let current = null;
    function select(center) {
      if (center === current) return;
      current = center;
      const total = highlight(center);
      if (center === null) {
        band.hidden = true;
        readout.textContent = idleReadout;
        scale.removeAttribute('aria-valuenow');
        scale.removeAttribute('aria-valuetext');
        return;
      }
      const low = Math.max(0, center - SailingSpeed.bandHalfWidth);
      const high = Math.min(max, center + SailingSpeed.bandHalfWidth);
      band.style.left = (low / max * 100) + '%';
      band.style.width = ((high - low) / max * 100) + '%';
      band.hidden = false;
      const miles = total.meters / 1852;
      const text = total.legs ? miles.toFixed(miles < 1 ? 2 : 1) + ' NM in ' + formatDuration(total.seconds) +
        ' · ' + total.legs + ' GPS legs' : 'No legs at this speed';
      readout.innerHTML = '<strong>' + bandLabel(center) + '</strong> · ' + text;
      scale.setAttribute('aria-valuenow', center);
      scale.setAttribute('aria-valuetext', bandLabel(center) + ', ' + text);
    }
    function fromPointer(event) {
      const box = scale.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
      select(Math.round(fraction * max * 2) / 2);
    }
    let dragging = null;
    scale.addEventListener('pointerdown', function (event) {
      dragging = event.pointerId;
      fromPointer(event);
      // Keeps a drag tracking outside the scale; best effort, the drag works without it.
      try { scale.setPointerCapture(event.pointerId); } catch (error) { /* pointer already gone */ }
    });
    scale.addEventListener('pointermove', function (event) {
      if (event.pointerType === 'mouse' || dragging === event.pointerId) fromPointer(event);
    });
    scale.addEventListener('pointerup', function () { dragging = null; });
    // A mouse clears on leaving; a tap or drag stays highlighted until the next tap elsewhere.
    scale.addEventListener('pointerleave', function (event) { if (event.pointerType === 'mouse') select(null); });
    scale.addEventListener('pointercancel', function () { dragging = null; select(null); });
    document.addEventListener('pointerdown', function (event) { if (!scale.contains(event.target)) select(null); });
    scale.addEventListener('blur', function () { select(null); });
    scale.addEventListener('keydown', function (event) {
      const step = { ArrowRight: .5, ArrowUp: .5, ArrowLeft: -.5, ArrowDown: -.5 }[event.key];
      if (step) select(Math.max(0, Math.min(max, (current === null ? (step > 0 ? -.5 : max + .5) : current) + step)));
      else if (event.key === 'Home') select(0);
      else if (event.key === 'End') select(max);
      else if (event.key === 'Escape') select(null);
      else return;
      event.preventDefault();
    });
  }

  // The legend under a detail map; its scale highlights legs on that map.
  function legend(element, highlight) {
    const max = SailingSpeed.maxKnots;
    // Labels every 3 kn; the minor marks under the gradient show every knot.
    let ticks = '';
    for (let knots = 0; knots <= max; knots += 3) {
      ticks += '<span style="left:' + (knots / max * 100) + '%">' + knots + (knots === max ? '+' : '') + '</span>';
    }
    element.classList.add('speed-legend');
    element.innerHTML = '<strong>Estimated speed over ground · knots</strong>' +
      '<div class="speed-scale" tabindex="0" role="slider" aria-label="Highlight legs by speed" ' +
      'aria-valuemin="0" aria-valuemax="' + max + '">' +
      '<div class="speed-gradient"><div class="speed-band" hidden></div></div>' +
      '<div class="speed-minor-ticks" aria-hidden="true"></div>' +
      '<div class="speed-ticks" aria-hidden="true">' + ticks + '</div></div>' +
      '<p class="speed-readout" aria-live="polite">' + idleReadout + '</p>' +
      '<p class="speed-hint">Blue = slow, yellow ≈ 9 kn, crimson = fast (0–' + max + '+ kn). Gray = speed unavailable. ' +
      'White arrows point in the direction of travel. Hover over the track or tap it to see speed and time.' +
      ' Colors show GPS averages between fixes, not instantaneous instrument readings.</p>';
    SailingSpeed.fillLegend(element);
    interactiveScale(element, highlight);
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
      const arrows = SailingSpeed.addDirectionArrows(L, map, legs, preview ? { spacing: 70, reach: 8, size: 4 } : {});
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
        legend(key, SailingSpeed.bandHighlighter(L, map, legs, track, arrows));
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
