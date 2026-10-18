/* Speed-colored GPX tracks. No build step; shared by detail pages and minimaps. */
(function (global) {
  'use strict';

  // One fixed 0–15+ kn scale for every map. The stops are spaced at equal perceptual
  // distance (CIEDE2000 ≈ 14 per knot), so 13 vs 14 kn is as distinct as 5 vs 6 kn.
  const palette = [
    [0, '#2a2a86'], [1, '#2e52c2'], [2, '#2877db'], [3, '#1d9be2'],
    [4, '#15a8c2'], [5, '#10b2a7'], [6, '#22b579'], [7, '#59bf3b'],
    [8, '#accb1d'], [9, '#e3c51a'], [10, '#f3aa1b'], [11, '#f5851e'],
    [12, '#ec581b'], [13, '#d22d28'], [14, '#ad163c'], [15, '#86104f']
  ];
  const maxKnots = palette[palette.length - 1][0];
  // Display colors only; geometry and hover speeds keep full precision.
  const displayStep = 0.25;
  // One path per display color plus unknown-speed gray, even for a multi-day archive.
  const maxPaths = maxKnots / displayStep + 2;
  const unknownColor = '#858b95';
  // Hovering the legend highlights one palette step: the hovered speed ± 0.5 kn.
  const bandHalfWidth = 0.5;
  const radians = Math.PI / 180;

  // Vincenty's inverse on WGS84; agrees with the geodesic calculation in the log.
  // The spherical fallback is only for pathological, nearly antipodal pairs.
  function distanceMeters(a, b) {
    const major = 6378137;
    const flattening = 1 / 298.257223563;
    const minor = major * (1 - flattening);
    const phi1 = a.lat * radians;
    const phi2 = b.lat * radians;
    const longitude = (((b.lng - a.lng + 540) % 360) - 180) * radians;
    const u1 = Math.atan((1 - flattening) * Math.tan(phi1));
    const u2 = Math.atan((1 - flattening) * Math.tan(phi2));
    const sin1 = Math.sin(u1), cos1 = Math.cos(u1);
    const sin2 = Math.sin(u2), cos2 = Math.cos(u2);
    let lambda = longitude;
    let sinSigma, cosSigma, sigma, cosSquaredAlpha, cosDoubleSigma;
    let converged = false;
    for (let iteration = 0; iteration < 100; iteration++) {
      const sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
      sinSigma = Math.hypot(cos2 * sinLambda, cos1 * sin2 - sin1 * cos2 * cosLambda);
      cosSigma = sin1 * sin2 + cos1 * cos2 * cosLambda;
      if (sinSigma < 1e-15 && cosSigma > 0) return 0;
      if (sinSigma < 1e-15) break;
      sigma = Math.atan2(sinSigma, cosSigma);
      const sinAlpha = cos1 * cos2 * sinLambda / sinSigma;
      cosSquaredAlpha = Math.max(0, 1 - sinAlpha * sinAlpha);
      cosDoubleSigma = cosSquaredAlpha > 1e-15 ? cosSigma - 2 * sin1 * sin2 / cosSquaredAlpha : 0;
      const c = flattening / 16 * cosSquaredAlpha * (4 + flattening * (4 - 3 * cosSquaredAlpha));
      const previous = lambda;
      lambda = longitude + (1 - c) * flattening * sinAlpha *
        (sigma + c * sinSigma * (cosDoubleSigma + c * cosSigma * (-1 + 2 * cosDoubleSigma ** 2)));
      if (Math.abs(lambda - previous) < 1e-12) {
        converged = true;
        break;
      }
    }
    if (!converged) {
      const h = Math.sin((phi2 - phi1) / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(longitude / 2) ** 2;
      return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
    }
    const uSquared = cosSquaredAlpha * (major * major - minor * minor) / (minor * minor);
    const aa = 1 + uSquared / 16384 * (4096 + uSquared * (-768 + uSquared * (320 - 175 * uSquared)));
    const bb = uSquared / 1024 * (256 + uSquared * (-128 + uSquared * (74 - 47 * uSquared)));
    const correction = bb * sinSigma * (cosDoubleSigma + bb / 4 *
      (cosSigma * (-1 + 2 * cosDoubleSigma ** 2) - bb / 6 * cosDoubleSigma *
       (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cosDoubleSigma ** 2)));
    return minor * aa * (sigma - correction);
  }

  function parseGPX(gpx) {
    return Array.from(gpx.getElementsByTagNameNS('*', 'trkseg'), function (segment) {
      return Array.from(segment.getElementsByTagNameNS('*', 'trkpt'), function (point) {
        const time = point.getElementsByTagNameNS('*', 'time')[0];
        return {
          lat: parseFloat(point.getAttribute('lat')),
          lng: parseFloat(point.getAttribute('lon')),
          time: time ? Date.parse(time.textContent) : NaN
        };
      });
    });
  }

  function validPosition(point) {
    return Number.isFinite(point.lat) && Math.abs(point.lat) <= 90 &&
      Number.isFinite(point.lng) && Math.abs(point.lng) <= 180;
  }

  function buildLegs(segments) {
    const legs = [];
    segments.forEach(function (points) {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        // Do not bridge missing positions or separate GPX recording segments.
        if (!validPosition(a) || !validPosition(b)) continue;
        const elapsed = (b.time - a.time) / 1000;
        const meters = distanceMeters(a, b);
        const knots = Number.isFinite(a.time) && Number.isFinite(b.time) && elapsed > 0
          ? meters / elapsed * 3600 / 1852 : null;
        legs.push({ a: a, b: b, elapsed: elapsed, meters: meters, knots: knots });
      }
    });
    return legs;
  }

  function colorForSpeed(knots) {
    if (!Number.isFinite(knots)) return unknownColor;
    const value = Math.max(palette[0][0], Math.min(palette[palette.length - 1][0], knots));
    for (let i = 1; i < palette.length; i++) {
      const low = palette[i - 1], high = palette[i];
      if (value > high[0]) continue;
      const fraction = (value - low[0]) / (high[0] - low[0]);
      const channel = function (hex, offset) { return parseInt(hex.slice(offset, offset + 2), 16); };
      return '#' + [1, 3, 5].map(function (offset) {
        return Math.round(channel(low[1], offset) * (1 - fraction) + channel(high[1], offset) * fraction)
          .toString(16).padStart(2, '0');
      }).join('');
    }
  }

  function displayBucket(knots) {
    if (!Number.isFinite(knots)) return null;
    return Math.round(Math.max(0, Math.min(maxKnots, knots)) / displayStep) * displayStep;
  }

  function drawTrack(L, legs, style) {
    style = Object.assign({ weight: 4, opacity: .95, className: 'speed-track-leg' }, style);
    // Legs are grouped by display color into at most maxPaths SVG paths. Every leg
    // remains a separate subpath: never connect disjoint recordings.
    const groups = new Map();
    legs.forEach(function (leg) {
      const bucket = displayBucket(leg.knots);
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket).push([[leg.a.lat, leg.a.lng], [leg.b.lat, leg.b.lng]]);
    });
    // Gray first, then slow to fast: rare fast runs stay visible where tracks cross.
    const order = Array.from(groups.keys()).sort(function (a, b) { return (a === null ? -1 : a) - (b === null ? -1 : b); });
    return L.featureGroup(order.map(function (bucket) {
      return L.polyline(groups.get(bucket), {
        color: colorForSpeed(bucket), weight: style.weight, opacity: style.opacity,
        interactive: false, className: style.className
      });
    }));
  }

  // Bands use the displayed (clamped) speed, so the top band includes everything above 15 kn.
  function inBand(knots, center) {
    return Number.isFinite(knots) && Number.isFinite(center) &&
      Math.abs(Math.max(0, Math.min(maxKnots, knots)) - center) <= bandHalfWidth;
  }

  function bandSummary(legs, center) {
    return legs.reduce(function (sum, leg) {
      if (inBand(leg.knots, center)) {
        sum.legs++;
        sum.meters += leg.meters;
        sum.seconds += leg.elapsed;
      }
      return sum;
    }, { legs: 0, meters: 0, seconds: 0 });
  }

  // Dims the whole track and redraws the legs within the hovered speed band on top.
  function bandHighlighter(L, map, legs, track, arrows, style) {
    style = Object.assign({ weight: 6 }, style);
    let layers = [];
    return function highlight(center) {
      layers.forEach(function (layer) { map.removeLayer(layer); });
      layers = [];
      const active = Number.isFinite(center);
      track.setStyle({ opacity: active ? .2 : .95 });
      if (arrows) arrows.setStyle({ opacity: active ? .15 : .9, fillOpacity: active ? .15 : 1 });
      if (!active) return null;
      const matching = legs.filter(function (leg) { return inBand(leg.knots, center); });
      const lines = matching.map(function (leg) { return [[leg.a.lat, leg.a.lng], [leg.b.lat, leg.b.lng]]; });
      // Added one by one: a FeatureGroup adds its children in Leaflet ID order, not array order.
      layers = [
        L.polyline(lines, { color: '#1d2129', weight: style.weight + 5, opacity: .35, interactive: false }),
        L.polyline(lines, { color: '#fff', weight: style.weight + 3, opacity: 1, interactive: false, className: 'speed-track-match-halo' }),
        drawTrack(L, matching, { weight: style.weight, opacity: 1, className: 'speed-track-match' })
      ];
      layers.forEach(function (layer) { layer.addTo(map); });
      return bandSummary(legs, center);
    };
  }

  // Consecutive legs share point objects. A new run starts at every GPX segment break
  // or skipped invalid position, so direction arrows never span disjoint recordings.
  function continuousRuns(legs) {
    const runs = [];
    legs.forEach(function (leg, i) {
      if (i === 0 || legs[i - 1].b !== leg.a) runs.push([leg.a]);
      runs[runs.length - 1].push(leg.b);
    });
    return runs;
  }

  // Arrow anchors every `spacing` screen pixels along each run of {x, y} pixel points.
  // The heading is the chord across ±reach pixels of track. Where that chord is much
  // shorter than the track between its ends (GPS jitter while stopped, tacks, tight
  // turns), no arrow is drawn rather than a misleading one.
  function arrowPlacements(runs, spacing, reach) {
    const arrows = [];
    runs.forEach(function (run) {
      const lengths = [0];
      for (let i = 1; i < run.length; i++) {
        lengths.push(lengths[i - 1] + Math.hypot(run[i].x - run[i - 1].x, run[i].y - run[i - 1].y));
      }
      const total = lengths[lengths.length - 1];
      function at(distance) {
        let low = 1, high = run.length - 1;
        while (low < high) {
          const middle = (low + high) >> 1;
          if (lengths[middle] < distance) low = middle + 1;
          else high = middle;
        }
        const span = lengths[low] - lengths[low - 1];
        const fraction = span > 0 ? (distance - lengths[low - 1]) / span : 0;
        return { x: run[low - 1].x + fraction * (run[low].x - run[low - 1].x),
          y: run[low - 1].y + fraction * (run[low].y - run[low - 1].y) };
      }
      for (let s = spacing / 2; s < total; s += spacing) {
        const from = Math.max(0, s - reach), to = Math.min(total, s + reach);
        const a = at(from), b = at(to);
        if (to - from < reach || Math.hypot(b.x - a.x, b.y - a.y) < .8 * (to - from)) continue;
        const anchor = at(s);
        arrows.push({ x: anchor.x, y: anchor.y, angle: Math.atan2(b.y - a.y, b.x - a.x) });
      }
    });
    return arrows;
  }

  // Pixel outline of one notched arrowhead, tip ahead of the anchor along the heading.
  function arrowShape(arrow, size) {
    const cos = Math.cos(arrow.angle), sin = Math.sin(arrow.angle);
    return [[1, 0], [-.7, .75], [-.3, 0], [-.7, -.75]].map(function (vertex) {
      const x = vertex[0] * size, y = vertex[1] * size;
      return { x: arrow.x + x * cos - y * sin, y: arrow.y + x * sin + y * cos };
    });
  }

  // Direction-of-travel arrows at a fixed screen spacing, recomputed at every zoom level.
  // One SVG path for all arrowheads; nonzero fill keeps overlapping heads solid.
  function addDirectionArrows(L, map, legs, options) {
    const settings = Object.assign({ spacing: 90, reach: 12, size: 6 }, options);
    const runs = continuousRuns(legs).map(function (run) {
      return run.map(function (point) { return L.latLng(point.lat, point.lng); });
    });
    const layer = L.polygon([], {
      color: '#1d2129', weight: 1, opacity: .9, fillColor: '#fff', fillOpacity: 1, fillRule: 'nonzero',
      smoothFactor: 0, interactive: false, className: 'speed-track-arrows'
    }).addTo(map);
    function update() {
      const zoom = map.getZoom();
      const projected = runs.map(function (run) {
        return run.map(function (latlng) { return map.project(latlng, zoom); });
      });
      layer.setLatLngs(arrowPlacements(projected, settings.spacing, settings.reach).map(function (arrow) {
        return [arrowShape(arrow, settings.size).map(function (point) { return map.unproject(L.point(point.x, point.y), zoom); })];
      }));
    }
    update();
    map.on('zoomend', update);
    return layer;
  }

  // Search in screen pixels so selection remains usable at every zoom level.
  // Unlike wide overlapping hit paths, this chooses the actual nearest leg.
  function nearestLeg(projected, point, radius) {
    let best = null;
    let bestSquared = radius * radius;
    projected.forEach(function (item) {
      const dx = item.b.x - item.a.x, dy = item.b.y - item.a.y;
      const lengthSquared = dx * dx + dy * dy;
      const fraction = lengthSquared > 0
        ? Math.max(0, Math.min(1, ((point.x - item.a.x) * dx + (point.y - item.a.y) * dy) / lengthSquared)) : 0;
      const closest = { x: item.a.x + fraction * dx, y: item.a.y + fraction * dy };
      const squared = (closest.x - point.x) ** 2 + (closest.y - point.y) ** 2;
      if (squared <= bestSquared) {
        bestSquared = squared;
        best = { leg: item.leg, point: closest };
      }
    });
    return best;
  }

  function formatTime(time, timeZone = 'UTC') {
    if (!Number.isFinite(time)) return 'Time unavailable';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23', timeZoneName: 'short'
    }).format(time);
  }

  function tooltipHTML(leg, timeZone = 'UTC') {
    const speed = Number.isFinite(leg.knots) ? leg.knots.toFixed(1) + ' kn' : 'Speed unavailable';
    const timeFormat = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
    let detail = 'Missing or non-increasing GPS timestamps';
    if (Number.isFinite(leg.knots)) {
      const zoneFormat = new Intl.DateTimeFormat('en-GB', { timeZone: timeZone, timeZoneName: 'short' });
      const zone = zoneFormat.formatToParts(leg.b.time).find(function (part) { return part.type === 'timeZoneName'; }).value;
      const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: timeZone, day: '2-digit', month: 'short', year: 'numeric' });
      const startDate = dateFormat.format(leg.a.time), endDate = dateFormat.format(leg.b.time);
      const dates = startDate === endDate ? startDate : startDate + '–' + endDate;
      detail = timeFormat.format(leg.a.time) + '–' + timeFormat.format(leg.b.time) + ' ' + zone +
        '<br>' + dates + '<br>GPS segment average · ' + Number(leg.elapsed.toFixed(1)) + ' s';
    }
    return '<strong>' + speed + '</strong><br><span>' + detail + '</span>';
  }

  function addSpeedHover(L, map, legs, timeZone = 'UTC') {
    const tooltip = L.tooltip({ direction: 'top', offset: [0, -10], opacity: 1, className: 'speed-tooltip' });
    const halo = L.polyline([], { color: '#fff', weight: 10, opacity: .95, interactive: false });
    const highlight = L.polyline([], { weight: 6, opacity: 1, interactive: false });
    let projected = [];
    let activeLeg = null;
    function project() {
      projected = legs.map(function (leg) {
        return { leg: leg, a: map.latLngToContainerPoint([leg.a.lat, leg.a.lng]), b: map.latLngToContainerPoint([leg.b.lat, leg.b.lng]) };
      });
    }
    function hide() {
      map.removeLayer(tooltip);
      map.removeLayer(halo);
      map.removeLayer(highlight);
      activeLeg = null;
    }
    function show(event, radius) {
      const found = nearestLeg(projected, event.containerPoint, radius);
      if (!found) { hide(); return; }
      const leg = found.leg;
      if (activeLeg !== leg) {
        const points = [[leg.a.lat, leg.a.lng], [leg.b.lat, leg.b.lng]];
        halo.setLatLngs(points).addTo(map);
        highlight.setLatLngs(points).setStyle({ color: colorForSpeed(leg.knots) }).addTo(map);
        tooltip.setContent(tooltipHTML(leg, timeZone));
        activeLeg = leg;
      }
      tooltip.setLatLng(map.containerPointToLatLng(found.point)).addTo(map);
    }
    project();
    map.on('zoomend moveend resize', project);
    map.on('movestart zoomstart mouseout', hide);
    map.on('mousemove', function (event) { show(event, 12); });
    // A tap keeps the readout visible until the next tap or map movement.
    map.on('click', function (event) { show(event, 22); });
  }

  function fillLegend(element) {
    const gradient = palette.map(function (stop) { return stop[1] + ' ' + (stop[0] / maxKnots * 100) + '%'; }).join(', ');
    element.querySelector('.speed-gradient').style.background = 'linear-gradient(to right, ' + gradient + ')';
    element.style.setProperty('--speed-max', maxKnots);
  }

  const api = { palette: palette, maxKnots: maxKnots, displayStep: displayStep, maxPaths: maxPaths,
    unknownColor: unknownColor, bandHalfWidth: bandHalfWidth, distanceMeters: distanceMeters, parseGPX: parseGPX,
    buildLegs: buildLegs, colorForSpeed: colorForSpeed, displayBucket: displayBucket, drawTrack: drawTrack,
    inBand: inBand, bandSummary: bandSummary, bandHighlighter: bandHighlighter, continuousRuns: continuousRuns,
    arrowPlacements: arrowPlacements, arrowShape: arrowShape, addDirectionArrows: addDirectionArrows, nearestLeg: nearestLeg,
    formatTime: formatTime, tooltipHTML: tooltipHTML, addSpeedHover: addSpeedHover, fillLegend: fillLegend };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.SailingSpeed = api;
})(typeof window !== 'undefined' ? window : globalThis);
