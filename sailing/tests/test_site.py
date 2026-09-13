"""Contract tests for every historical AND future dated sailing entry (stdlib only)."""
from hashlib import sha256
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unittest
from zoneinfo import ZoneInfo
import xml.etree.ElementTree as ET

SAILING = Path(__file__).resolve().parents[1]
SITE = SAILING.parent
BASELINES = json.loads((SAILING / 'tests/track-baselines.json').read_text())
ENTRIES = sorted(p for p in SAILING.glob('*/index.html') if re.fullmatch(r'\d{8}', p.parent.name))


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.elements = []
        self.scripts = []
        self.script = None
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.elements.append((tag, attrs))
        if tag == 'script':
            self.script = {'attrs': attrs, 'text': ''}
            self.scripts.append(self.script)

    def handle_data(self, data):
        if self.script is not None:
            self.script['text'] += data

    def handle_endtag(self, tag):
        if tag == 'script':
            self.script = None

    @property
    def dependencies(self):
        return [s['attrs']['src'] for s in self.scripts if 'src' in s['attrs']]

    @property
    def maps(self):
        return [a for tag, a in self.elements if tag == 'div' and 'sailing-map' in a.get('class', '').split()]

    def source(self, file):
        mapping = self.maps[0]
        if 'data-gpx-inline' in mapping:
            return next(s['text'] for s in self.scripts if s['attrs'].get('id') == mapping['data-gpx-inline'])
        return (file.parent / mapping['data-gpx-src']).read_text()


class SiteTests(unittest.TestCase):
    def test_all_dated_pages_and_overview_use_only_the_shared_renderer(self):
        template = Page((SAILING / 'templates/entry.html').read_text())
        self.assertEqual(len(template.dependencies), 3)
        for file in [*ENTRIES, SAILING / 'index.html']:
            with self.subTest(file=file.relative_to(SITE)):
                text = file.read_text()
                page = Page(text)
                self.assertEqual(page.dependencies, template.dependencies)
                for script in page.scripts:
                    if 'src' in script['attrs']:
                        self.assertIn('defer', script['attrs'])
                    else:
                        self.assertEqual(script['attrs'].get('type'), 'application/gpx+xml', 'No per-page executable scripts')
                self.assertNotIn('data-speed=', text)
                self.assertNotRegex(text, r'\{\{[A-Z_]+\}\}')
                styles = [a.get('href') for tag, a in page.elements if tag == 'link']
                self.assertEqual(styles.count('/sailing/maps.css?v=1'), 1)
                self.assertTrue(any('leaflet@1.9.4/dist/leaflet.css' in (s or '') for s in styles))

    def test_each_detail_map_has_one_source_and_explicit_valid_timezone(self):
        self.assertTrue(ENTRIES)
        for file in ENTRIES:
            with self.subTest(entry=file.parent.name):
                page = Page(file.read_text())
                self.assertEqual(len(page.maps), 1)
                mapping = page.maps[0]
                self.assertEqual(sum(key in mapping for key in ['data-gpx-src', 'data-gpx-inline']), 1)
                ZoneInfo(mapping['data-time-zone'])
                source = page.source(file)
                if source.strip():
                    xml = ET.fromstring(source)
                    self.assertEqual(xml.tag.rsplit('}', 1)[-1], 'gpx')

    def test_original_tracks_are_preserved_including_empty_logs(self):
        entries = {file.parent.name: file for file in ENTRIES}
        self.assertTrue(BASELINES.keys() <= entries.keys(), 'Never remove historical entries during a renderer change')
        total = recorded = 0
        for name, expected in BASELINES.items():
            with self.subTest(entry=name):
                file = entries[name]
                page = Page(file.read_text())
                source = page.source(file)
                self.assertEqual(sha256(source.encode()).hexdigest(), expected['gpx_sha256'])
                self.assertEqual(page.maps[0]['data-time-zone'], expected['time_zone'])
                root = ET.fromstring(source) if source.strip() else None
                points = [e for e in root.iter() if e.tag.rsplit('}', 1)[-1] == 'trkpt'] if root is not None else []
                self.assertEqual(len(points), expected['points'])
                total += len(points)
                recorded += bool(points)
        self.assertEqual(total, 27422)
        self.assertEqual(recorded, 24)

    def test_overview_links_all_entries_and_resolves_all_track_sources(self):
        page = Page((SAILING / 'index.html').read_text())
        links = {a.get('href') for tag, a in page.elements if tag == 'a'}
        self.assertTrue(any('data-sailing-legend' in attrs for _, attrs in page.elements))
        for file in ENTRIES:
            self.assertIn(f'/sailing/{file.parent.name}/', links)
        ids = {a.get('id') for _, a in page.elements}
        for script in page.scripts:
            attrs = script['attrs']
            if 'gpx-data' not in attrs.get('class', '').split():
                continue
            self.assertIn('map-' + attrs['data-filename'], ids)
            if 'data-src' in attrs:
                self.assertTrue((SITE / attrs['data-src'].lstrip('/')).is_file())
        for mapping in page.maps:
            if 'data-gpx-src' in mapping:
                self.assertTrue((SITE / mapping['data-gpx-src'].lstrip('/')).is_file())

    def test_future_templates_have_no_opt_in_or_per_page_js(self):
        replacements = {'TITLE': 'Future sailing', 'DESCRIPTION': 'Reviewed sailing track', 'DATE_ID': '20990101',
                        'DATE_ISO': '2099-01-01', 'LOG_DETAILS': '', 'TIME_ZONE': 'UTC', 'YEAR': '2099'}
        for name in ['entry.html', 'card.html']:
            text = (SAILING / 'templates' / name).read_text()
            for key, value in replacements.items():
                text = text.replace('{{' + key + '}}', value)
            self.assertNotIn('{{', text)
            page = Page(text)
            self.assertEqual(len(page.maps), 1)
            self.assertIn('data-gpx-src', page.maps[0])
            self.assertNotIn('data-speed', text)
            self.assertTrue(all('src' in s['attrs'] for s in page.scripts))

    def test_old_pagination_redirects_to_the_all_tracks_overview(self):
        for file in SAILING.glob('page/*/index.html'):
            text = file.read_text()
            self.assertIn('content="0; url=/sailing/"', text)
            self.assertNotIn('localhost', text)
            self.assertNotIn('<gpx', text)


if __name__ == '__main__':
    unittest.main()
