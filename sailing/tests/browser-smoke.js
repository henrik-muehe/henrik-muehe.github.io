// Run in agent-browser eval --stdin after opening this site's sailing overview.
// Exercises every real entry and new-template/unknown-speed/error fixtures in isolated frames.
(async function () {
  const baseline = await (await fetch('/sailing/tests/track-baselines.json')).json();
  const template = await (await fetch('/sailing/templates/entry.html')).text();
  const results = [];
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
        if (!paths.length || paths.length > 50) throw new Error(label + ': unexpected path count ' + paths.length);
        if (doc.querySelectorAll('.speed-legend').length !== 1) throw new Error(label + ': missing/duplicate legend');
        if (Number(map.dataset.legCount) < 1 || (points && Number(map.dataset.legCount) >= points)) throw new Error(label + ': invalid leg count');
        // Exercise the actual nearest-leg map event handler, not just formatting helpers.
        map.scrollIntoView({ block: 'center' });
        const path = paths.reduce((a, b) => a.getTotalLength() > b.getTotalLength() ? a : b);
        const p = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM());
        map.dispatchEvent(new frame.contentWindow.MouseEvent('mousemove', { bubbles: true, clientX: p.x, clientY: p.y }));
        const tip = doc.querySelector('.speed-tooltip');
        if (!tip || !/kn|Speed unavailable/.test(tip.innerText)) throw new Error(label + ': hover missing');
      }
      results.push({ entry: label, state: map.dataset.mapState, legs: Number(map.dataset.legCount || 0), paths: paths.length });
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
  return { passed: results.length, results };
})();
