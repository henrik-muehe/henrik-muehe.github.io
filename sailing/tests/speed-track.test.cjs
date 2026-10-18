// Run with: node --test sailing/tests/speed-track.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const speed = require('../speed-track.js');

const point = (lat, lng, seconds = 0) => ({ lat, lng, time: seconds * 1000 });
const close = (actual, expected, tolerance = 0.001) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected} ± ${tolerance}`);

// GeographicLib WGS84 reference values, not a spherical-distance approximation.
test('WGS84 distance handles coincident, equatorial, meridional and dateline points', () => {
  close(speed.distanceMeters(point(48, 11), point(48, 11)), 0);
  close(speed.distanceMeters(point(0, 0), point(0, 1)), 111319.49079327357);
  close(speed.distanceMeters(point(0, 0), point(1, 0)), 110574.38855779878);
  close(speed.distanceMeters(point(0, 179.999), point(0, -179.999)), 222.6389815876102);
  assert.ok(Number.isFinite(speed.distanceMeters(point(0, 0), point(0, 180))));
});

test('speed uses distance / elapsed time in knots, with stationary legs at zero', () => {
  const [leg] = speed.buildLegs([[point(0, 0), point(0, 1, 3600)]]);
  close(leg.knots, 111319.49079327357 / 1852);
  assert.equal(leg.elapsed, 3600);
  assert.equal(speed.buildLegs([[point(48, 11), point(48, 11, 10)]])[0].knots, 0);
});

test('never joins separate GPX segments or bridges invalid coordinates', () => {
  const legs = speed.buildLegs([
    [point(48, 11), point(48.001, 11, 10)],
    [point(49, 12, 20), point(49.001, 12, 30)]
  ]);
  assert.equal(legs.length, 2);
  assert.equal(speed.buildLegs([[point(48, 11), point(NaN, 11, 10), point(48.001, 11, 20)]]).length, 0);
  assert.equal(speed.buildLegs([[point(91, 11), point(48, 11, 10)]]).length, 0);
  assert.equal(speed.buildLegs([[], [point(48, 11)]]).length, 0);
});

test('missing, identical or backwards timestamps produce unknown speed, not Infinity', () => {
  for (const end of [NaN, 0, -1]) {
    const [leg] = speed.buildLegs([[point(48, 11), point(48.001, 11, end)]]);
    assert.equal(leg.knots, null);
    assert.equal(speed.colorForSpeed(leg.knots), '#858b95');
    assert.match(speed.tooltipHTML(leg), /Speed unavailable/);
  }
});

test('palette interpolates smoothly and clamps to a fixed 0–15 knot scale', () => {
  assert.equal(speed.maxKnots, 15);
  for (const [knots, color] of speed.palette) assert.equal(speed.colorForSpeed(knots), color);
  assert.equal(speed.colorForSpeed(-1), speed.palette[0][1]);
  assert.equal(speed.colorForSpeed(50), speed.palette.at(-1)[1]);
  assert.notEqual(speed.colorForSpeed(3), speed.colorForSpeed(2));
  assert.notEqual(speed.colorForSpeed(3), speed.colorForSpeed(4));
  assert.equal(speed.colorForSpeed(NaN), '#858b95');
});

test('every 0.25 kn display step up to 15 kn has its own color, then clamps', () => {
  const colors = [];
  for (let knots = 0; knots <= speed.maxKnots; knots += speed.displayStep) colors.push(speed.colorForSpeed(speed.displayBucket(knots)));
  assert.equal(colors.length, 61);
  assert.equal(new Set(colors).size, colors.length);
  assert.ok(!colors.includes(speed.unknownColor));
  assert.equal(speed.displayBucket(13.9), 14);
  assert.equal(speed.displayBucket(16.2), 15);
  assert.equal(speed.displayBucket(-0.1), 0);
  assert.equal(speed.displayBucket(null), null);
  assert.equal(speed.maxPaths, colors.length + 1);
});

test('hover selects the nearest segment, respects tolerance, and handles zero-length legs', () => {
  const projected = [
    { leg: 'near', a: { x: 0, y: 0 }, b: { x: 100, y: 0 } },
    { leg: 'far', a: { x: 0, y: 10 }, b: { x: 100, y: 10 } }
  ];
  assert.equal(speed.nearestLeg(projected, { x: 50, y: 2 }, 12).leg, 'near');
  assert.deepEqual(speed.nearestLeg(projected, { x: 50, y: 2 }, 12).point, { x: 50, y: 0 });
  assert.equal(speed.nearestLeg(projected, { x: 50, y: 30 }, 12), null);
  assert.equal(speed.nearestLeg(projected, { x: 50, y: 30 }, 22).leg, 'far');
  const zero = [{ leg: 'zero', a: { x: 1, y: 1 }, b: { x: 1, y: 1 } }];
  assert.equal(speed.nearestLeg(zero, { x: 1, y: 2 }, 12).leg, 'zero');
});

test('the real sailing track matches the original geodesic statistics', () => {
  const gpx = fs.readFileSync(path.join(__dirname, '../20260913/track.gpx'), 'utf8');
  const points = Array.from(gpx.matchAll(/<trkpt\b[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>[\s\S]*?<time>([^<]+)<\/time>[\s\S]*?<\/trkpt>/g),
    m => ({ lat: Number(m[1]), lng: Number(m[2]), time: Date.parse(m[3]) }));
  assert.equal(points.length, 595);
  const legs = speed.buildLegs([points]);
  assert.equal(legs.length, 594);
  assert.ok(legs.every(leg => Number.isFinite(leg.knots) && leg.knots >= 0));
  close(legs.reduce((sum, leg) => sum + speed.distanceMeters(leg.a, leg.b), 0), 21080.65586802683, 0.01);
  close(Math.max(...legs.map(leg => leg.knots)), 10.652876887626181, 0.001);
  assert.equal(legs.reduce((sum, leg) => sum + leg.elapsed, 0), 11106);
  const fastest = legs.reduce((a, b) => a.knots > b.knots ? a : b);
  const tooltip = speed.tooltipHTML(fastest, 'Europe/Berlin');
  assert.match(tooltip, /10\.7 kn/);
  assert.match(tooltip, /12:59:45–12:59:49 CEST/);
  assert.match(tooltip, /GPS segment average · 4 s/);
});

test('historical time zones are explicit, with UTC as the safe default', () => {
  const a = { lat: 37.5, lng: -122.2, time: Date.parse('2018-04-19T22:39:24Z') };
  const b = { lat: 37.501, lng: -122.2, time: Date.parse('2018-04-19T22:39:34Z') };
  const [leg] = speed.buildLegs([[a, b]]);
  assert.match(speed.tooltipHTML(leg, 'America/Los_Angeles'), /15:39:24–15:39:34/);
  assert.match(speed.tooltipHTML(leg, 'Pacific/Honolulu'), /12:39:24–12:39:34/);
  assert.match(speed.tooltipHTML(leg), /22:39:24–22:39:34 UTC/);
  assert.match(speed.tooltipHTML(leg), /19 Apr 2018/);
  assert.equal(speed.formatTime(NaN), 'Time unavailable');
  assert.match(speed.formatTime(a.time, 'America/Los_Angeles'), /15:39:24/);
});

test('multi-day hover includes both recorded dates', () => {
  const [leg] = speed.buildLegs([[
    { ...point(48, 11), time: Date.parse('2026-09-13T23:59:50Z') },
    { ...point(48.001, 11), time: Date.parse('2026-09-14T00:00:10Z') }
  ]]);
  assert.match(speed.tooltipHTML(leg), /13 Sept 2026–14 Sept 2026/);
});

test('long tracks batch rendering without dropping or connecting any legs', () => {
  const legs = Array.from({ length: 10000 }, (_, i) => ({
    a: point(48, 11 + i / 100000), b: point(48.001, 11 + i / 100000),
    knots: i % 127 === 0 ? null : (i % 170) / 10
  }));
  const L = { polyline: (lines, options) => ({ lines, options }), featureGroup: layers => layers };
  const layers = speed.drawTrack(L, legs);
  assert.equal(layers.length, speed.maxPaths);
  // Gray at the bottom, then slow to fast so fast runs are drawn on top.
  const expected = [null];
  for (let knots = 0; knots <= speed.maxKnots; knots += speed.displayStep) expected.push(knots);
  assert.deepEqual(layers.map(layer => layer.options.color), expected.map(speed.colorForSpeed));
  assert.equal(layers.reduce((sum, layer) => sum + layer.lines.length, 0), legs.length);
  assert.ok(layers.every(layer => layer.lines.every(line => line.length === 2)));
  assert.ok(layers.some(layer => layer.options.color === '#858b95'));
  assert.ok(layers.every(layer => layer.options.interactive === false));
  assert.equal(legs[1].knots, 0.1, 'Display quantization must not alter hover speed');
});

test('legend bands use the displayed speed, include the clamped top end, and never unknown speeds', () => {
  assert.equal(speed.bandHalfWidth, 0.5);
  assert.ok(speed.inBand(10.5, 10) && speed.inBand(9.5, 10) && !speed.inBand(10.51, 10));
  assert.ok(speed.inBand(22, 15) && speed.inBand(16, 14.5) && !speed.inBand(16, 14));
  assert.ok(speed.inBand(0, 0) && !speed.inBand(0.6, 0));
  assert.ok(!speed.inBand(null, 5) && !speed.inBand(5, null));
  const legs = [
    { knots: 4.8, meters: 100, elapsed: 20 }, { knots: 5.4, meters: 50, elapsed: 10 },
    { knots: 6, meters: 999, elapsed: 1 }, { knots: null, meters: 999, elapsed: 1 }
  ];
  assert.deepEqual(speed.bandSummary(legs, 5), { legs: 2, meters: 150, seconds: 30 });
  assert.deepEqual(speed.bandSummary(legs, 12), { legs: 0, meters: 0, seconds: 0 });
});

test('direction arrows follow continuous runs and never bridge segment breaks', () => {
  const a = point(48, 11, 0), b = point(48.001, 11, 10), c = point(48.002, 11, 20);
  const d = point(49, 12, 30), e = point(49.001, 12, 40);
  const runs = speed.continuousRuns(speed.buildLegs([[a, b, c], [d, e]]));
  assert.deepEqual(runs, [[a, b, c], [d, e]]);
  // A skipped invalid position also starts a new run.
  const gap = speed.continuousRuns(speed.buildLegs([[a, b, point(NaN, 11, 15), c, point(48.003, 11, 30)]]));
  assert.equal(gap.length, 2);
  assert.equal(speed.continuousRuns([]).length, 0);
});

test('arrows sit at fixed screen spacing and point in the direction of travel', () => {
  const east = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 400, y: 0 }];
  const arrows = speed.arrowPlacements([east], 90, 12);
  assert.deepEqual(arrows.map(arrow => arrow.x), [45, 135, 225, 315]);
  assert.ok(arrows.every(arrow => arrow.y === 0 && arrow.angle === 0));
  const west = speed.arrowPlacements([[...east].reverse()], 90, 12);
  assert.ok(west.every(arrow => Math.abs(Math.abs(arrow.angle) - Math.PI) < 1e-9));
  const south = speed.arrowPlacements([[{ x: 5, y: 0 }, { x: 5, y: 100 }]], 90, 12);
  close(south[0].angle, Math.PI / 2);
  // Separate runs are measured independently; nothing spans the break between them.
  const split = speed.arrowPlacements([[{ x: 0, y: 0 }, { x: 60, y: 0 }], [{ x: 0, y: 50 }, { x: 60, y: 50 }]], 90, 12);
  assert.deepEqual(split.map(arrow => [arrow.x, arrow.y]), [[45, 0], [45, 50]]);
  assert.deepEqual(speed.arrowPlacements([[{ x: 0, y: 0 }, { x: 20, y: 0 }]], 90, 12), []);
});

test('no arrows on GPS jitter while stopped or across a tack', () => {
  const jitter = Array.from({ length: 200 }, (_, i) => ({ x: (i % 2) * 3, y: (i % 3) * 2 }));
  assert.deepEqual(speed.arrowPlacements([jitter], 90, 12), []);
  // A hairpin turn exactly at the arrow position: the chord is short, so skip it.
  const tack = [{ x: 0, y: 0 }, { x: 45, y: 0 }, { x: 0, y: 4 }];
  assert.deepEqual(speed.arrowPlacements([tack], 90, 12), []);
});

test('arrowheads point forward along the heading', () => {
  const [tip, left, notch, right] = speed.arrowShape({ x: 10, y: 20, angle: 0 }, 6);
  assert.deepEqual(tip, { x: 16, y: 20 });
  assert.ok(left.x < 10 && right.x < 10 && notch.x < 10 && notch.x > left.x);
  close(left.y - 20, -(right.y - 20));
  const down = speed.arrowShape({ x: 0, y: 0, angle: Math.PI / 2 }, 6)[0];
  close(down.x, 0);
  close(down.y, 6);
});

test('arrows on a real track agree with the recorded direction of travel', () => {
  const gpx = fs.readFileSync(path.join(__dirname, '../20261017/track.gpx'), 'utf8');
  const points = Array.from(gpx.matchAll(/<trkpt\b[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>[\s\S]*?<time>([^<]+)<\/time>[\s\S]*?<\/trkpt>/g),
    m => ({ lat: Number(m[1]), lng: Number(m[2]), time: Date.parse(m[3]) }));
  const legs = speed.buildLegs([points]);
  // Web Mercator pixels at zoom 15, as Leaflet projects them.
  const project = p => ({
    x: 256 * 2 ** 15 * (p.lng + 180) / 360,
    y: 256 * 2 ** 15 * (1 - Math.log(Math.tan(Math.PI / 4 + p.lat * Math.PI / 360)) / Math.PI) / 2
  });
  const runs = speed.continuousRuns(legs).map(run => run.map(project));
  const arrows = speed.arrowPlacements(runs, 90, 12);
  assert.ok(arrows.length > 100, `${arrows.length} arrows`);
  const projected = legs.map(leg => ({ a: project(leg.a), b: project(leg.b) }));
  const agree = arrows.filter(arrow => {
    const nearest = projected.reduce((best, leg) => {
      const distance = speed.nearestLeg([{ leg, a: leg.a, b: leg.b }], arrow, Infinity);
      const squared = (distance.point.x - arrow.x) ** 2 + (distance.point.y - arrow.y) ** 2;
      return squared < best.squared ? { leg, squared } : best;
    }, { squared: Infinity }).leg;
    const dx = nearest.b.x - nearest.a.x, dy = nearest.b.y - nearest.a.y;
    return dx * Math.cos(arrow.angle) + dy * Math.sin(arrow.angle) > 0;
  });
  assert.ok(agree.length / arrows.length > 0.97, `${agree.length} of ${arrows.length} arrows follow the track`);
});

test('highlight and base tracks share the grouping but may use their own style', () => {
  const legs = [{ a: point(48, 11), b: point(48.001, 11), knots: 5 }];
  const L = { polyline: (lines, options) => ({ lines, options }), featureGroup: layers => layers };
  const [layer] = speed.drawTrack(L, legs, { weight: 6, opacity: 1, className: 'speed-track-match' });
  assert.equal(layer.options.weight, 6);
  assert.equal(layer.options.className, 'speed-track-match');
  assert.equal(layer.options.color, speed.colorForSpeed(5));
  assert.equal(speed.drawTrack(L, legs)[0].options.weight, 4);
});
