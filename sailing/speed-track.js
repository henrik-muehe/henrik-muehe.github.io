/* Speed-colored GPX tracks. No build step; shared by detail pages and minimaps. */
(function (global) {
  'use strict';

  const palette = [
    [0, '#3045ad'], [2, '#1685cb'], [4, '#16aa9a'], [6, '#80bb3f'],
    [8, '#e8c638'], [10, '#ed7832'], [12, '#c83232']
  ];
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
    if (!Number.isFinite(knots)) return '#858b95';
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

  function drawTrack(L, legs) {
    // At most 50 SVG paths, even for a multi-day archive. Only display colors are
    // rounded to 0.25 kn; geometry and hover speeds retain their full precision.
    // Every leg remains a separate subpath: never connect disjoint recordings.
    const groups = new Map();
    legs.forEach(function (leg) {
      const bucket = Number.isFinite(leg.knots) ? Math.round(Math.max(0, Math.min(12, leg.knots)) * 4) / 4 : null;
      const color = colorForSpeed(bucket);
      if (!groups.has(color)) groups.set(color, []);
      groups.get(color).push([[leg.a.lat, leg.a.lng], [leg.b.lat, leg.b.lng]]);
    });
    return L.featureGroup(Array.from(groups, function (entry) {
      return L.polyline(entry[1], {
        color: entry[0], weight: 4, opacity: .95,
        interactive: false, className: 'speed-track-leg'
      });
    }));
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
    const gradient = palette.map(function (stop) { return stop[1] + ' ' + (stop[0] / 12 * 100) + '%'; }).join(', ');
    element.querySelector('.speed-gradient').style.background = 'linear-gradient(to right, ' + gradient + ')';
  }

  const api = { palette: palette, distanceMeters: distanceMeters, parseGPX: parseGPX, buildLegs: buildLegs,
    colorForSpeed: colorForSpeed, drawTrack: drawTrack, nearestLeg: nearestLeg,
    formatTime: formatTime, tooltipHTML: tooltipHTML, addSpeedHover: addSpeedHover, fillLegend: fillLegend };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.SailingSpeed = api;
})(typeof window !== 'undefined' ? window : globalThis);
