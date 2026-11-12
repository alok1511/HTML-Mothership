#!/usr/bin/env node
/* 4.0.0: chart layouts (every layout on its sample data, column guessing, the gallery), the per-chart consulting look,
   one version number everywhere, numbered versions per dashboard, and the Claims and risk review sample. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const editors = process.env.V17_ONLY ? [process.env.V17_ONLY] : ['mothership.html', 'dist/mothership-standalone.html'];
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const ok = msg => console.log('  ✓ ' + msg);

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    /* --- one version number --- */
    for (const [file, re] of [['src/js/app.js', /VERSION = '([^']+)'/], ['src/js/runtime.js', /__MS_RT = \{ version: '([^']+)'/], ['tools/mcp/mothership-mcp.js', /VERSION = '([^']+)'/],
      ['tools/mcp/mothership_mcp.py', /VERSION = '([^']+)'/], ['CHANGELOG.md', /^## (\d+\.\d+\.\d+)/m], ['README.md', /Version (\d+\.\d+\.\d+)/]]) {
      assert.equal((re.exec(fs.readFileSync(path.join(root, file), 'utf8')) || [])[1], version, file + ' says the release is ' + version);
    }
    ok('package.json, editor, runtime, both MCP servers, changelog and README all say ' + version);

    for (const editor of editors) {
      console.log(editor);
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.join(root, editor)).href);
      await page.waitForFunction(() => window.MS && MS.api && MS.api.run && MS.layouts);
      const api = (name, args) => page.evaluate(([n, a]) => MS.api.run(n, a).then(x => JSON.parse(JSON.stringify(x === undefined ? null : x))), [name, args || {}]);
      const fresh = async (tabs) => { await api('new_dashboard', { title: 'Layout test', tabs: !!tabs, force: true }); await page.waitForFunction(() => MS.rt() && MS.child); };

      /* --- every layout inserts on its sample data, as one undo step --- */
      const list = (await api('chart_layouts', {})).layouts;
      assert.ok(list.length >= 24, 'at least 24 layouts');
      const expectCharts = { 'frequency-severity': 2, 'exec-summary': 2, 'risk-heatmap': 0, 'risk-register-rag': 0, 'loss-triangle': 0, 'benchmark-scorecard': 0, 'house-style': 0, 'small-multiples': 6, marimekko: 0, 'overlap-venn': 0, 'dot-matrix-stats': 0, 'heat-grid': 0 };
      for (const l of list) {
        await fresh();
        if (l.id === 'house-style') await api('chart_layouts', { action: 'insert', layout: 'ranked-highlight', sample: true });
        const before = await page.evaluate(() => MS.history.labels().length);
        const r = await api('chart_layouts', { action: 'insert', layout: l.id, sample: true, source: 'Test source', as_of: '2026-09-30' });
        assert.deepEqual(r.issues, [], l.id + ' inserts without problems');
        assert.equal(r.charts.length, l.id in expectCharts ? expectCharts[l.id] : 1, l.id + ' chart count');
        assert.ok(r.title && r.title.length > 8, l.id + ' has an action title');
        const after = await page.evaluate(() => ({ n: MS.history.labels().length, last: MS.history.labels().slice(-1)[0], charts: MS.rt().charts().length, sources: Object.keys(MS.rt().state.sources || {}).length }));
        assert.equal(after.n, before + 1, l.id + ' is one undo step');
        assert.equal(after.last, 'Insert chart layout ' + l.name);
        if (r.charts.length) {
          const t = await page.evaluate(k => MS.charts.nameOf(k), r.charts[0]);
          if (l.id !== 'exec-summary' && l.id !== 'small-multiples') assert.equal(t, r.title, l.id + ': the chart carries the action title');
        }
        await api('undo');
        if (l.id === 'house-style') continue;
        assert.equal(await page.evaluate(() => MS.rt().charts().length + Object.keys(MS.rt().state.datasets).length), 0, l.id + ': one undo removes the charts and the sample data');
      }
      ok(list.length + ' layouts insert on sample data with an action title, as one undo step, and undo cleanly');

      /* --- the look: highlight and colours belong to one chart; labels, signs, 100% stacked, dashed target --- */
      await fresh();
      await api('chart_layouts', { action: 'insert', layout: 'ranked-highlight', sample: true });
      await api('chart_layouts', { action: 'insert', layout: 'ranked-highlight', sample: true, options: { pick: 'Delhi' } });
      await api('chart_layouts', { action: 'insert', layout: 'variance-vs-plan', sample: true });
      await api('chart_layouts', { action: 'insert', layout: 'mix-100', sample: true });
      await api('chart_layouts', { action: 'insert', layout: 'line-target', sample: true });
      await page.waitForTimeout(1500);
      const look = await page.evaluate(() => {
        const r = MS.rt(), cs = r.charts(), bg = (c, k) => c.inst.data.datasets[k || 0].backgroundColor;
        const at = (c, label) => { const i = c.inst.data.labels.indexOf(label), b = bg(c); return Array.isArray(b) ? b[i] : b; };
        const mix = cs[3].inst.data;
        return {
          first: { mah: at(cs[0], 'Maharashtra'), del: at(cs[0], 'Delhi') }, second: { mah: at(cs[1], 'Maharashtra'), del: at(cs[1], 'Delhi') },
          shared: Object.keys(r.state.layout.colors || {}).length,
          variance: cs[2].inst.data.labels.map((l, i) => [cs[2].inst.data.datasets[0].data[i], bg(cs[2])[i]]),
          mixTotals: mix.labels.map((_, j) => Math.round(mix.datasets.reduce((t, d) => t + d.data[j], 0))),
          dashed: cs[4].inst.data.datasets.map(d => [d.label, !!d.borderDash]),
          labelsPlugin: !!window.MS.child.win.Chart.__msLabels, grid: cs[0].inst.options.scales.x.grid.display
        };
      });
      assert.deepEqual(look.first, { mah: '#2251FF', del: '#B8BEC6' });
      assert.deepEqual(look.second, { mah: '#B8BEC6', del: '#2251FF' }, 'a highlight on one chart does not change another');
      assert.equal(look.shared, 0, 'layouts do not touch the shared category colours');
      assert.ok(look.variance.every(([v, c]) => c === (v < 0 ? '#C62828' : '#2E7D32')), 'variance bars are green above plan and red below');
      assert.deepEqual(look.mixTotals, [100, 100, 100], '100% stacked columns add to 100');
      assert.deepEqual(look.dashed, [['Actual', false], ['Target', true]]);
      assert.ok(look.labelsPlugin, 'values are drawn on the bars');
      assert.equal(look.grid, false, 'no gridlines');
      ok('highlight and colours stay on their own chart; plus/minus colours, 100% stacked, dashed target, labels, no gridlines');

      /* --- your own data: columns guessed by name, title worked out from the numbers --- */
      await fresh();
      await api('add_dataset', { name: 'Peers', rows: [{ Insurer: 'Peer A', 'Loss ratio': 61 }, { Insurer: 'Us', 'Loss ratio': 72 }, { Insurer: 'Peer B', 'Loss ratio': 66 }, { Insurer: 'Peer C', 'Loss ratio': 70 }] });
      const pv = await api('chart_layouts', { action: 'preview', layout: 'benchmark-ranked-gap', dataset: 'Peers', options: { client: 'Us', better: 'low' } });
      assert.deepEqual(pv.fields, { co: 'Insurer', val: 'Loss ratio' });
      assert.match(pv.title, /^Us is 6 worse than the peer median \(66\)/);
      const ins = await api('chart_layouts', { action: 'insert', layout: 'benchmark-ranked-gap', dataset: 'Peers', options: { client: 'Us', better: 'low' } });
      assert.deepEqual(ins.issues, []);
      assert.equal(await page.evaluate(() => Object.keys(MS.rt().state.datasets).length), 1, 'no sample data added');
      await assert.rejects(api('chart_layouts', { action: 'insert', layout: 'bridge', dataset: 'Peers', fields: { step: 'Nope', change: 'Loss ratio' } }), /no column "Nope"/);
      await assert.rejects(api('chart_layouts', { action: 'insert', layout: 'bridge' }), /Say which dataset/);
      ok('guesses columns by name, writes the title from the numbers, and explains wrong columns');

      /* --- the gallery and the fill-in window --- */
      await fresh();
      await page.evaluate(() => MS.layouts.gallery());
      await page.waitForSelector('.lay-card');
      const cards = await page.locator('.lay-card').count();
      await page.fill('.lay-gallery input[type=search]', 'outstanding');
      assert.equal(await page.locator('.lay-card').count(), 1, 'search narrows the gallery');
      await page.click('.lay-card[data-layout="lossrun-paid-outstanding"]');
      await page.waitForSelector('.lay-fill');
      const suggested = await page.inputValue('.lay-fill input.inp >> nth=0');
      assert.match(suggested, /% of 2024-25 incurred is still outstanding/);
      await page.click('.dlg-foot .btn.primary');
      await page.waitForFunction(() => MS.rt().charts().length === 1);
      assert.equal(cards, list.length);
      ok('Insert › Chart layouts: gallery, search, suggested title, insert');

      /* --- numbered versions per dashboard; automatic copies never push out named ones --- */
      await fresh();
      await page.evaluate(() => MS.store.all('versions').then(l => Promise.all(l.map(x => MS.store.del('versions', x.key)))));
      const v1 = await api('save_version', { name: 'Draft' }), v2 = await api('save_version', { name: 'For review' });
      assert.equal(v2.number, v1.number + 1);
      await page.evaluate(() => { MS.versions.KEEP_AUTO = 2; });
      for (let i = 0; i < 4; i++) await page.evaluate(n => MS.versions.checkpoint('Safety ' + n), i);
      const vs = await api('versions', {});
      assert.deepEqual(vs.versions.filter(v => v.kind === 'named').map(v => v.version), ['v2', 'v1'], 'named versions survive');
      assert.equal(vs.versions.filter(v => v.kind === 'auto').length, 2, 'automatic copies are trimmed to their own limit');
      assert.ok(vs.versions.every(v => v.doc === 'Layout test.html' || v.doc === vs.dashboard));
      await page.evaluate(() => MS.versions.list());
      await page.waitForSelector('.ver-list .list-row');
      assert.equal(await page.locator('.ver-list .list-row').count(), 2, 'the Versions window hides automatic copies until asked');
      assert.deepEqual(await page.locator('.ver-num').allTextContents(), ['v2', 'v1']);
      await page.keyboard.press('Escape');
      const cmp = await api('compare_versions', { before: 'v1' });
      assert.ok(cmp && cmp.changes !== undefined, 'compare_versions takes a version number');
      await api('chart_layouts', { action: 'insert', layout: 'cagr-columns', sample: true });
      await assert.rejects(api('versions', { action: 'restore', number: 1 }), /unexported edits|unsaved changes/);
      const rs = await api('versions', { action: 'restore', number: 1, force: true });
      assert.equal(rs.restored, 'v1');
      ok('versions are numbered per dashboard, automatic copies are kept apart, restore needs force over unexported edits');

      /* --- files from a newer Mothership; the editor version in outline and exports --- */
      const newer = '<!DOCTYPE html><html><head><meta name="generator" content="HTML Mothership 99.0.0"><title>x</title></head><body><h1>Hi</h1></body></html>';
      await page.evaluate(() => { window.__toasts = []; const t = MS.toast; MS.toast = function (m) { window.__toasts.push(m); return t.apply(this, arguments); }; });
      await api('open_html', { html: newer, name: 'newer.html', force: true });
      assert.ok((await page.evaluate(() => window.__toasts)).some(m => /saved with Mothership 99\.0\.0, which is newer than this copy/.test(m)));
      assert.equal((await api('outline')).editorVersion, version);
      assert.match(await page.evaluate(() => MS.exportHtml()), new RegExp('content="HTML Mothership ' + version.replace(/\./g, '\\.') + '"'));
      assert.equal(await page.evaluate(() => MS.compareVersions('4.10.0', '4.9.1')), 1);
      ok('warns about files from a newer Mothership; outline and exports carry ' + version);

      /* --- the Claims and risk review sample --- */
      await page.evaluate(() => MS.samples.open('layouts', { force: true, nonInteractive: true }));
      await page.waitForFunction(() => MS.rt() && MS.rt().charts().length >= 15, null, { timeout: 20000 });
      const sample = await api('outline');
      assert.ok(sample.tabs.map(t => t.title).join('|').startsWith('Summary|Claims|Risk register|Customers and peers|Performance'));
      ok('the Claims and risk review sample opens with ' + sample.charts.length + ' charts');

      assert.deepEqual(errors, [], 'no page errors');
      await page.close();
    }
  } finally { await browser.close(); }
  console.log('All 4.0.0 checks passed');
})().catch(e => { console.error(e); process.exit(1); });
