# muehe.org — published static site

This repository is the deployed GitHub Pages site. `origin/main` publishes to https://muehe.org/.
The old Hugo/Jekyll source is not present here; do not run Hugo over this tree or regenerate it from `legacy/blog-old`.

## Sailing maps: one shared default

- All old and new maps use `sailing/maps.js`, `sailing/maps.css`, and `sailing/speed-track.js` with Leaflet **1.9.4**.
- Speed coloring, the 0–12+ knot legend, and detailed hover/tap readouts are the default. Never add per-page map JavaScript, a `data-speed` opt-in, old CoffeeScript, or polyline-decorator code.
- Start new entries from `sailing/templates/entry.html`, and index cards from `sailing/templates/card.html`. See `sailing/README.md`.
- Keep original GPX data and track segment boundaries intact. Never fabricate missing speed/timestamps; unknown speeds are gray. Do not publish shore/road/home data when extracting a sailing track.
- Set an explicit IANA time zone for each detail map. Existing regions: Europe/Berlin, America/Los_Angeles, Pacific/Honolulu. Unknown regions default to UTC, not Berlin.
- The main sailing index contains all entries. Legacy pagination URLs redirect there.

## Checks before committing/publishing

```sh
node --test sailing/tests/*.test.cjs
uv run --no-project python -m unittest discover -s sailing/tests -p 'test_*.py'
```

Also check the overview, an affected detail map, and hover/tap in a browser. The HTML contract tests scan **every dated sailing entry**, including future ones; do not bypass them to introduce another renderer.

Commit and push changes. A push to `main` deploys; verify the GitHub Pages Actions run and the live page. The legacy Pages builds API can report a stale commit even after a successful deployment.
