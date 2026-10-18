// Run in agent-browser eval --stdin after opening this site's sailing overview.
// Exercises every real entry and new-template/unknown-speed/error fixtures in isolated frames.
(async function () {
  const baseline = await (await fetch('/sailing/tests/track-baselines.json')).json();
  const template = await (await fetch('/sailing/templates/entry.html')).text();
  const results = [];
  // Sweeps a legend scale in 0.5 kn steps; returns the first speed that highlights legs, or null.
  function sweepLegend(win, legendRoot, mapRoot) {
    const scale = legendRoot.querySelector('.speed-scale');
    const box = scale.getBoundingClientRect();
    const max = win.SailingSpeed.maxKnots;
    const move = (type, knots) => scale.dispatchEvent(new win.PointerEvent(type, {
      bubbles: type !== 'pointerleave', pointerType: 'mouse', clientX: box.left + box.width * knots / max, clientY: box.top + 10 }));
    let found = null;
    for (let knots = 0; knots <= max && found === null; knots += .5) {
      move('pointermove', knots);
      if (mapRoot.querySelector('.speed-track-match')) found = knots;
    }
    if (found !== null) {
      if (legendRoot.querySelector('.speed-band').hidden) throw new Error('Legend band marker not shown');
      if (!/kn · .*GPS legs/.test(legendRoot.querySelector('.speed-readout').textContent)) throw new Error('Legend readout missing');
      const dimmed = mapRoot.querySelector('.speed-track-leg').getAttribute('stroke-opacity');
      if (dimmed !== '0.2') throw new Error('Track not dimmed while highlighting: ' + dimmed);
    }
    move('pointerleave', 0);
    if (mapRoot.querySelector('.speed-track-match')) throw new Error('Highlight not cleared on leaving the legend');
    if (mapRoot.querySelector('.speed-track-leg').getAttribute('stroke-opacity') !== '0.95') throw new Error('Track opacity not restored');
    return found;
  }
  async function inspect(label, url, html, expected, points) {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;top:0;left:0;width:900px;height:700px;z-index:99999;background:white';
    try {
      if (html) frame.srcdoc = html;
      else frame.src = url;
      document.body.append(frame);
      const deadline = Date.now() + 20000;
      let map;
      while (Date.now() < deadline) {
        map = frame.contentDocument?.getElementById('map');
        if (map && ['ready', 'empty', 'error'].includes(map.dataset.mapState)) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      if (!map || map.dataset.mapState !== expected) throw new Error(label + ': expected ' + expected + ', got ' + map?.dataset.mapState);
      const doc = frame.contentDocument;
      const paths = [...doc.querySelectorAll('#map .speed-track-leg')];
      if (expected === 'ready') {
        if (!paths.length || paths.length > frame.contentWindow.SailingSpeed.maxPaths) throw new Error(label + ': unexpected path count ' + paths.length);
        if (doc.querySelectorAll('.speed-legend').length !== 1) throw new Error(label + ': missing/duplicate legend');
        if (doc.querySelector('.speed-ticks span:last-child').textContent !== '15+') throw new Error(label + ': legend does not end at 15+ kn');
        if (Number(map.dataset.legCount) < 1 || (points && Number(map.dataset.legCount) >= points)) throw new Error(label + ': invalid leg count');
        // Exercise the actual nearest-leg map event handler, not just formatting helpers.
        map.scrollIntoView({ block: 'center' });
        const path = paths.reduce((a, b) => a.getTotalLength() > b.getTotalLength() ? a : b);
        const p = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM());
        map.dispatchEvent(new frame.contentWindow.MouseEvent('mousemove', { bubbles: true, clientX: p.x, clientY: p.y }));
        const tip = doc.querySelector('.speed-tooltip');
        if (!tip || !/kn|Speed unavailable/.test(tip.innerText)) throw new Error(label + ': hover missing');
      }
      const result = { entry: label, state: map.dataset.mapState, legs: Number(map.dataset.legCount || 0), paths: paths.length };
      if (expected === 'ready') {
        const arrows = doc.querySelector('#map .speed-track-arrows');
        if (!arrows) throw new Error(label + ': direction arrow layer missing');
        result.arrows = (arrows.getAttribute('d').match(/z/gi) || []).length;
        result.band = sweepLegend(frame.contentWindow, doc.querySelector('.speed-legend'), map);
        const knownSpeeds = Number(map.dataset.unknownSpeedCount) < Number(map.dataset.legCount);
        if (knownSpeeds !== (result.band !== null)) throw new Error(label + ': legend highlight does not match known speeds');
      }
      results.push(result);
      return { map, paths }; // Assertions on returned detached DOM remain possible.
    } finally {
      frame.remove();
    }
  }
  for (const [date, info] of Object.entries(baseline)) {
    await inspect(date, '/sailing/' + date + '/', null, info.points ? 'ready' : 'empty', info.points);
  }
  let future = template;
  const values = { TITLE: 'Future template smoke test', DESCRIPTION: 'Test only', DATE_ID: '20990101', DATE_ISO: '2099-01-01',
    YEAR: '2099', TIME_ZONE: 'UTC', LOG_DETAILS: '' };
  for (const [key, value] of Object.entries(values)) future = future.replaceAll('{{' + key + '}}', value);
  future = future.replace('data-gpx-src="track.gpx"', 'data-gpx-src="/sailing/20260913/track.gpx"');
  await inspect('future-template', null, future, 'ready', 595);
  function embedded(xml) {
    return future.replace('data-gpx-src="/sailing/20260913/track.gpx"', 'data-gpx-inline="fixture-gpx"')
      .replace('</main>', '<script type="application/gpx+xml" id="fixture-gpx">' + xml + '</script></main>');
  }
  const unknown = await inspect('missing-timestamps', null, embedded(
    '<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg><trkpt lat="48" lon="11"/><trkpt lat="48.01" lon="11.01"/></trkseg></trk></gpx>'
  ), 'ready', 2);
  if (unknown.map.dataset.unknownSpeedCount !== '1' || unknown.paths[0].getAttribute('stroke') !== '#858b95') throw new Error('Unknown speed is not gray');
  await inspect('invalid-xml', null, embedded('<gpx>'), 'error');
  await inspect('empty-gpx', null, embedded('<gpx/>'), 'empty');
  await inspect('failed-download', null, future.replace('/sailing/20260913/track.gpx', '/sailing/tests/does-not-exist.gpx'), 'error');
  if (!results.filter(result => result.state === 'ready').every(result => result.arrows > 0)) throw new Error('A recorded track has no direction arrows');
  // The overview shows colored thumbnails with arrows but no speed legend.
  const thumbnails = [...document.querySelectorAll('.sailing-map.minimap[data-map-state="ready"]')];
  if (!thumbnails.length || !thumbnails.every(map => map.querySelector('.speed-track-arrows'))) throw new Error('Overview thumbnails lack arrows');
  if (document.querySelector('.speed-legend')) throw new Error('Overview should not show a speed legend');
  results.push({ entry: 'overview', state: 'ready', thumbnails: thumbnails.length });
  return { passed: results.length, results };
})();
