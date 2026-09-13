# Sailing log maps

All maps use the same renderer. Changes to `maps.js`, `maps.css`, or `speed-track.js` apply to every historical entry, new entry, and overview thumbnail.

## Add a new sailing entry

1. Create `sailing/YYYYMMDD/` and copy `templates/entry.html` to its `index.html`.
2. Put the reviewed sailing-only GPX at `sailing/YYYYMMDD/track.gpx`. Keep timestamps and recording-segment boundaries. Do not include travel home or other private locations.
3. Replace every `{{PLACEHOLDER}}` in the copied template. HTML-escape text/attribute values. `LOG_DETAILS` is optional trusted HTML for known boat/crew/conditions; omit unknown facts. Set `TIME_ZONE` to the location's IANA zone (for example `Europe/Berlin`, `America/Los_Angeles`, or `Pacific/Honolulu`; use `UTC` if unknown).
4. Copy/fill `templates/card.html` and prepend it to the `flex flex-wrap` card container in `sailing/index.html`. Its GPX URL points to the same downloadable file; do not duplicate GPS data into new index cards.
5. Add the entry to `sailing/index.xml`, the root `index.xml`, and `sitemap.xml`. Preserve existing entries.
6. Run the checks from `AGENTS.md`, inspect the map and hover/tap locally, then commit and push to publish.

No JavaScript needs to be copied or customized. The shared assets are already in the entry template and the overview.

## Map markup

Detailed map (speed colors, legend, start/finish markers, and hover/tap enabled automatically):

```html
<div id="map" class="sailing-map"
     data-gpx-src="track.gpx"
     data-time-zone="Europe/Berlin"></div>
```

Thumbnail (same colors, lazy-loaded, noninteractive):

```html
<div class="sailing-map minimap"
     data-gpx-src="/sailing/YYYYMMDD/track.gpx"></div>
```

Historical detail pages may instead use `data-gpx-inline="gpx-source"` to reference an existing `<script type="application/gpx+xml" id="gpx-source">`. Historical overview `.gpx-data` cards are also supported automatically. Neither format needs a speed-color opt-in.

If there is no recording, use an empty embedded GPX source and omit the download link. The map shows “No track available.” Invalid XML and failed downloads show an explicit error instead of a blank map.

## Meaning of the colors

- One fixed scale on all maps: blue at 0 knots through green/yellow to red at 12+ knots.
- Speed is WGS84 distance divided by elapsed time between successive GPS fixes, not a live instrument/through-water measurement.
- Missing or non-increasing timestamps produce gray legs and “Speed unavailable”. Separate GPX segments and invalid positions are never bridged.
- The displayed colors are rounded to 0.25 knots so long historical tracks need at most 50 SVG paths. Geometry and hover speeds retain full precision.
- Readouts use the entry's explicit time zone (UTC by default) and include the recorded date for multi-day logs. Original timestamps are not rewritten, even if an old device had the wrong date.

## Browser smoke test

With a local HTTP preview running and `agent-browser` open on its sailing overview:

```sh
agent-browser --session sailing-check open http://127.0.0.1:8766/sailing/
agent-browser --session sailing-check eval --stdin < sailing/tests/browser-smoke.js
agent-browser --session sailing-check close
```

This checks every migrated entry, actual hover handling, the future entry template, missing timestamps, empty GPX, malformed XML, and failed downloads. Also scroll the overview to check lazy-loading and inspect a narrow/mobile viewport.

## Maintenance

`maps.js` discovers map elements and handles GPX loading, lazy thumbnails, legends, and empty/error states. `speed-track.js` handles distances, speeds, colors, and nearest-leg hover selection. `maps.css` styles every map and legend. Do not reintroduce per-page renderers.

When changing asset URLs/cache versions, update all entries and the template together. Site contract tests enforce identical dependencies, the shared renderer, and preservation of the migrated original GPX data (`tests/track-baselines.json`). Legitimate track corrections require deliberate updates to the corresponding baseline.
