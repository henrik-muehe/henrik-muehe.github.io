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

test('palette interpolates smoothly and clamps to a fixed 0–12 knot scale', () => {
  for (const [knots, color] of speed.palette) assert.equal(speed.colorForSpeed(knots), color);
  assert.equal(speed.colorForSpeed(-1), speed.palette[0][1]);
  assert.equal(speed.colorForSpeed(50), speed.palette.at(-1)[1]);
  assert.notEqual(speed.colorForSpeed(3), speed.colorForSpeed(2));
  assert.notEqual(speed.colorForSpeed(3), speed.colorForSpeed(4));
  assert.equal(speed.colorForSpeed(NaN), '#858b95');
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
  const tooltip = speed.tooltipHTML(fastest);
  assert.match(tooltip, /10\.7 kn/);
  assert.match(tooltip, /12:59:45–12:59:49 CEST/);
  assert.match(tooltip, /GPS segment average · 4 s/);
});
