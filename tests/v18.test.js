#!/usr/bin/env node
/* 4.1.0: the 19 new chart layouts, the new chart types (scatter, bubble, dumbbell, range, stacked area, pyramid,
   reference lines), Reshape chart (chart_edit: type, columns, per-chart filters, categories and series), Edit layout
   (rebuild in place, switch layout, one undo step) and the Chart layout gallery sample. */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const editors = process.env.V18_ONLY ? [process.env.V18_ONLY] : ['mothership.html', 'dist/mothership-standalone.html'];
const ok = msg => console.log('  ✓ ' + msg);
const NEW = ['dumbbell', 'gap-pairs', 'range-dots', 'parity-scatter', 'quadrant-2x2', 'bubble-impact', 'net-diverging', 'stacked-ranked', 'actual-forecast', 'stacked-area', 'line-focus', 'growth-multiples', 'small-multiples', 'percentile-curve', 'pyramid', 'marimekko', 'overlap-venn', 'dot-matrix-stats', 'heat-grid'];

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    for (const editor of editors) {
      console.log(editor);
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.join(root, editor)).href);
      await page.waitForFunction(() => window.MS && MS.api && MS.api.run && MS.layouts && MS.reshape);
      const api = (name, args) => page.evaluate(([n, a]) => MS.api.run(n, a).then(x => JSON.parse(JSON.stringify(x === undefined ? null : x))), [name, args || {}]);
      const fresh = async () => { await api('new_dashboard', { title: 'Reshape test', tabs: false, force: true }); await page.waitForFunction(() => MS.rt() && MS.child); };
      const press = sel => page.evaluate(q => { const n = document.querySelector(q); if (!n) throw new Error('no ' + q); n.click(); }, sel);
      const chartInfo = key => page.evaluate(k => { const c = MS.rt().chart(k); return { kind: c.inst.config.options.msType, labels: c.inst.data.labels.slice(), ds: c.inst.data.datasets.map(d => ({ label: d.label, link: !!d.msLink, data: JSON.parse(JSON.stringify(d.data)), bg: d.backgroundColor })) }; }, key);

      /* --- the new layouts are listed in their groups and each has an action title worked out from the numbers --- */
      const list = (await api('chart_layouts', {})).layouts;
      assert.equal(list.length, 43, '43 layouts');
      assert.deepEqual(NEW.filter(id => !list.some(l => l.id === id)), [], 'every new layout is listed');
      const groups = (await api('chart_layouts', {})).groups.map(g => g.id);
      assert.deepEqual(groups.slice(-4), ['compare', 'trend', 'composition', 'page']);
      const titles = {};
      for (const id of NEW) titles[id] = (await api('chart_layouts', { action: 'preview', layout: id })).title;
      assert.match(titles['dumbbell'], /^Social media moved most, from 6 to -9 between 2024 and 2026/);
      assert.match(titles['quadrant-2x2'], /^4 of 10 are high on both/);
      assert.match(titles['growth-multiples'], /^5 of 8 at least doubled; Agentic AI grew most at 12\.8×/);
      assert.match(titles['actual-forecast'], /forecast to reach 34(\.4)? by FY30, about 22% a year/);
      assert.match(titles['overlap-venn'], /^97% of spend meets at least one test; 34% meets all three/);
      ok('19 new layouts in three new groups, each with a suggested action title');

      /* --- the new chart types draw what they should --- */
      await fresh();
      const dumb = await api('chart_layouts', { action: 'insert', layout: 'dumbbell', sample: true });
      const range = await api('chart_layouts', { action: 'insert', layout: 'range-dots', sample: true });
      const pyr = await api('chart_layouts', { action: 'insert', layout: 'pyramid', sample: true });
      const bub = await api('chart_layouts', { action: 'insert', layout: 'bubble-impact', sample: true });
      const par = await api('chart_layouts', { action: 'insert', layout: 'parity-scatter', sample: true });
      const area = await api('chart_layouts', { action: 'insert', layout: 'stacked-area', sample: true });
      await page.waitForTimeout(600);
      const d = await chartInfo(dumb.charts[0]);
      assert.equal(d.kind, 'dumbbell');
      assert.deepEqual(d.ds.map(x => [x.label, x.link]), [['', true], ['2024', false], ['2026', false]], 'a connector bar plus one dot series per end');
      assert.deepEqual(d.ds[0].data[d.labels.indexOf('Social media')], [-9, 6], 'the connector runs from the lower to the higher value');
      assert.equal(d.ds[2].bg, '#2251FF', 'the later end is the highlight colour');
      const rg = await chartInfo(range.charts[0]);
      assert.equal(rg.kind, 'range');
      assert.deepEqual(rg.ds.map(x => x.label), ['', 'Median'], 'range bar plus the median dot');
      const py = await chartInfo(pyr.charts[0]);
      assert.ok(py.ds[0].data.every(v => v < 0) && py.ds[1].data.every(v => v > 0), 'the first side of the pyramid is drawn to the left');
      const bb = await chartInfo(bub.charts[0]);
      assert.equal(bb.kind, 'bubble');
      const big = bb.ds[0].data.find(p => p.n === 'Coastal cyclone');
      assert.ok(big && big.r === 28 && big.v === 2400, 'the largest bubble gets the largest radius');
      assert.ok(bb.ds[0].bg[bb.ds[0].data.indexOf(big)].startsWith('#2251FF'), 'the focus bubble is highlighted');
      const ps = await page.evaluate(k => { const c = MS.rt().chart(k); return { refs: c.inst.__msLook && c.inst.__msLook.refs, plugin: !!MS.child.win.Chart.registry.plugins.get('msRefs') }; }, par.charts[0]);
      assert.deepEqual(ps.refs, [{ diag: true, label: 'above the line' }]);
      assert.ok(ps.plugin, 'reference lines are drawn by their own plugin');
      const ar = await chartInfo(area.charts[0]);
      assert.deepEqual(ar.ds.map(x => x.label)[0], 'Health', 'the part that grew most is first');
      assert.equal(await page.evaluate(k => MS.rt().chart(k).inst.config.options.scales.y.stacked, area.charts[0]), true);
      ok('dumbbell, range, pyramid, bubble, scatter with a 45° line and stacked area draw correctly');

      /* --- Reshape (chart_edit): filters, categories, series, names, type; one undo step each --- */
      await fresh();
      await api('add_dataset', { name: 'Sales', rows: [
        { Region: 'North', Year: '2025', Product: 'Motor', Sales: 10 }, { Region: 'North', Year: '2026', Product: 'Motor', Sales: 14 }, { Region: 'North', Year: '2026', Product: 'Health', Sales: 6 },
        { Region: 'South', Year: '2025', Product: 'Motor', Sales: 20 }, { Region: 'South', Year: '2026', Product: 'Health', Sales: 25 },
        { Region: 'East', Year: '2025', Product: 'Motor', Sales: 7 }, { Region: 'East', Year: '2026', Product: 'Motor', Sales: 5 },
        { Region: 'West', Year: '2025', Product: 'Health', Sales: 12 }, { Region: 'West', Year: '2026', Product: 'Health', Sales: 16 }] });
      const c = await api('insert_chart', { dataset: 'Sales', by: 'Region', measure: 'Sales', type: 'bar', title: 'Sales by region' });
      const h0 = await page.evaluate(() => MS.history.labels().length);
      let e = await api('chart_edit', { chart: c.key, where: [{ field: 'Year', value: '2026' }] });
      assert.deepEqual(e.labels, ['South', 'North', 'West', 'East']);
      assert.deepEqual((await chartInfo(c.key)).ds[0].data, [25, 20, 16, 5], 'where filters the rows of this chart only');
      e = await api('chart_edit', { chart: c.key, hide: ['East'], order: ['West'], rename: { North: 'N' } });
      assert.deepEqual(e.labels, ['West', 'South', 'N']);
      e = await api('chart_edit', { chart: c.key, series: 'Product', type: 'stacked', series_order: ['Health'], rename: { North: 'N', Motor: 'Motor cover' } });
      const st = await chartInfo(c.key);
      assert.equal(st.kind, 'stacked', 'the chart type changes');
      assert.deepEqual(st.ds.map(x => x.label), ['Health', 'Motor cover'], 'series are reordered and renamed');
      e = await api('chart_edit', { chart: c.key, series_hide: ['Health'] });
      assert.deepEqual((await chartInfo(c.key)).ds.map(x => x.label), ['Motor cover']);
      assert.equal(await page.evaluate(() => MS.history.labels().length), h0 + 4, 'each reshape is one undo step');
      await api('undo'); await page.waitForTimeout(250);
      assert.deepEqual((await chartInfo(c.key)).ds.map(x => x.label), ['Health', 'Motor cover'], 'undo brings the hidden series back');
      const drill = await page.evaluate(k => { const r = MS.rt(); r.state.charts[k].drill = { mode: 'crossfilter' }; return r.renamed[k]; }, c.key);
      assert.deepEqual(drill, { N: 'North' }, 'renamed categories map back to the data for drill-down');
      await assert.rejects(api('chart_edit', { chart: c.key, type: 'scatter' }), /needs x and y/);
      e = await api('chart_edit', { chart: c.key, type: 'scatter', x: 'Sales', y: 'Sales', series: null, where: null, hide: null, order: null });
      assert.equal((await chartInfo(c.key)).kind, 'scatter');
      ok('chart_edit filters rows, hides, orders and renames categories and series, changes type, one undo step each');

      /* --- Chart settings keeps the reshape settings --- */
      await fresh();
      await api('add_dataset', { name: 'S2', rows: [{ R: 'A', V: 1 }, { R: 'B', V: 2 }, { R: 'C', V: 3 }] });
      const c2 = await api('insert_chart', { dataset: 'S2', by: 'R', measure: 'V', title: 'Keep me' });
      await api('chart_edit', { chart: c2.key, hide: ['B'], rename: { A: 'Alpha' } });
      await page.evaluate(k => { MS.edit.select(MS.rt().chart(k).el); MS.charts.settings(k, 'Data & drill-down'); }, c2.key);
      await page.waitForSelector('.dlg-foot .btn.primary');
      await press('.dlg-foot .btn.primary');
      await page.waitForTimeout(400);
      const kept = await page.evaluate(k => MS.rt().state.charts[k].binding, c2.key);
      assert.deepEqual([kept.hide, kept.rename], [['B'], { A: 'Alpha' }], 'Chart settings › Apply keeps hidden categories and names');
      ok('Chart settings keeps a chart\'s filters, hidden categories and names');

      /* --- the Reshape window --- */
      await page.evaluate(k => { MS.edit.select(MS.rt().chart(k).el); }, c2.key);
      await page.evaluate(() => MS.reshape.dialog());
      await page.waitForSelector('.rs-list .rs-row');
      assert.equal(await page.locator('.rs-list .rs-row').count(), 3, 'every category is listed, hidden ones too');
      assert.equal(await page.locator('.rs-list .rs-row input[type=checkbox]').nth(1).isChecked(), false, 'hidden categories are unticked');
      await page.evaluate(() => document.querySelectorAll('.rs-list .rs-row input[type=checkbox]')[1].click());
      await page.evaluate(() => document.querySelectorAll('.rs-list .rs-row')[2].querySelector('button[title="Move up"]').click());
      await press('.rs-where > button');
      await page.locator('.rs-where .rs-row select').nth(1).selectOption('ne');
      await page.locator('.rs-where .rs-row input').fill('A');
      await press('.dlg-foot .btn.primary');
      await page.waitForTimeout(400);
      const b2 = await page.evaluate(k => MS.rt().state.charts[k].binding, c2.key);
      assert.deepEqual([b2.hide, b2.order, b2.where], [undefined, ['A', 'C', 'B'], [{ field: 'R', op: 'ne', value: 'A' }]]);
      assert.deepEqual((await chartInfo(c2.key)).labels, ['C', 'B']);
      ok('Charts › Reshape: tick, reorder and filter in the window');

      /* --- Edit layout: rebuild in place, switch layout, one undo step; works from the window too --- */
      await fresh();
      const a1 = await api('chart_layouts', { action: 'insert', layout: 'ranked-highlight', sample: true });
      const a2 = await api('chart_layouts', { action: 'insert', layout: 'bridge', sample: true });
      const a3 = await api('chart_layouts', { action: 'insert', layout: 'cagr-columns', sample: true });
      const order = () => page.evaluate(() => Array.from(MS.child.doc.querySelectorAll('[data-ms-chart]')).map(h => MS.charts.nameOf(h.getAttribute('data-ms-chart'))));
      const before = await order();
      const runs = (await api('chart_layouts', { action: 'runs' })).runs;
      assert.deepEqual(runs.map(r => r.layout), ['ranked-highlight', 'bridge', 'cagr-columns']);
      const h1 = await page.evaluate(() => MS.history.labels().length);
      const ed = await api('chart_layouts', { action: 'edit', chart: a2.charts[0], layout: 'ranked-highlight', fields: { cat: 'Step', val: 'Change' }, options: { pick: 'Price' } });
      assert.deepEqual(ed.issues, []);
      const mid = await order();
      assert.equal(mid.length, 3);
      assert.equal(mid[0], before[0]); assert.equal(mid[2], before[2]);
      assert.equal(mid[1], ed.title, 'the new chart takes the old one\'s place');
      assert.equal(await page.evaluate(() => MS.history.labels().length), h1 + 1, 'editing a layout is one undo step');
      assert.ok(!(await page.evaluate(() => Object.keys(MS.rt().state.datasets))).some(n => /· bridge/.test(n)), 'the old working dataset is removed');
      const hl = await page.evaluate(k => MS.rt().state.charts[k].style.highlight, ed.charts[0]);
      assert.deepEqual(hl, ['Price']);
      await api('undo'); await page.waitForTimeout(300);
      assert.deepEqual(await order(), before, 'undo puts the bridge back where it was');
      const re = await api('chart_layouts', { action: 'edit', chart: a1.charts[0], options: { pick: 'Delhi' }, keep_title: true });
      assert.equal(re.title, a1.title, 'keep_title keeps the old title');
      await assert.rejects(api('chart_layouts', { action: 'edit', chart: 'Nope' }), /not inserted from a chart layout/);
      // the window: Edit layout opens with the layout's columns and words, Update rebuilds it
      await page.evaluate(k => { MS.edit.select(MS.rt().chart(k).el); }, a3.charts[0]);
      await page.evaluate(() => MS.layouts.editDialog());
      await page.waitForSelector('.lay-fill');
      assert.equal(await page.locator('.dlg-foot .btn.primary').textContent(), 'Update');
      assert.equal(await page.inputValue('.lay-fill input.inp >> nth=0'), a3.title, 'the window starts from the old title');
      await page.locator('.lay-fill input.inp').first().fill('Premium keeps compounding');
      await press('.dlg-foot .btn.primary');
      await page.waitForFunction(() => MS.history.labels().slice(-1)[0] === 'Edit chart layout Columns with a growth arrow');
      assert.ok((await order()).includes('Premium keeps compounding'));
      ok('Edit layout rebuilds a layout in place, switches layouts, keeps or recomputes the title, undoes in one step');

      /* --- HTML layouts can be edited too; small multiples use a filter per chart --- */
      await fresh();
      const mk = await api('chart_layouts', { action: 'insert', layout: 'marimekko', sample: true });
      assert.equal(mk.units.length, 1);
      const mk2 = await api('chart_layouts', { action: 'edit', run: mk.run, options: { pick: 'Online' } });
      assert.equal(await page.evaluate(() => MS.child.doc.querySelectorAll('.ms-mekko').length), 1, 'the old picture is replaced, not duplicated');
      assert.ok(mk2.run && mk2.run !== mk.run);
      const sm = await api('chart_layouts', { action: 'insert', layout: 'small-multiples', sample: true });
      const wh = await page.evaluate(ks => ks.map(k => MS.rt().state.charts[k].binding.where[0].value), sm.charts);
      assert.deepEqual(wh, ['North', 'South', 'East', 'West', 'Central', 'North-east']);
      ok('picture layouts (Marimekko) are rebuilt in place; small multiples filter each chart');

      /* --- exports draw the new types; the gallery sample opens --- */
      await fresh();
      for (const id of ['dumbbell', 'pyramid', 'bubble-impact', 'range-dots']) await api('chart_layouts', { action: 'insert', layout: id, sample: true });
      const html = await page.evaluate(() => MS.exportHtml());
      assert.ok(/layoutRuns/.test(html), 'the export keeps the layout records');
      const view = await browser.newPage({ viewport: { width: 1300, height: 900 } });
      const verr = []; view.on('pageerror', x => verr.push(x.message));
      await view.setContent(html);
      await view.waitForTimeout(1200);
      const kinds = await view.evaluate(() => Object.values(window.Chart.instances).map(i => i.config.options.msType).sort());
      assert.deepEqual(kinds, ['bubble', 'dumbbell', 'pyramid', 'range']);
      assert.deepEqual(verr, []);
      await view.close();
      await page.evaluate(() => MS.samples.open('gallery', { force: true, nonInteractive: true }));
      await page.waitForFunction(() => MS.rt() && MS.rt().charts().length >= 15, null, { timeout: 20000 });
      const g = await api('outline');
      assert.ok(g.tabs.map(t => t.title).join('|').startsWith('Comparisons|Trends|Composition'));
      ok('exported dashboards draw the new chart types; the Chart layout gallery sample opens with ' + g.charts.length + ' charts');

      assert.deepEqual(errors, [], 'no page errors');
      await page.close();
    }
  } finally { await browser.close(); }
  console.log('All 4.1.0 checks passed');
})().catch(e => { console.error(e); process.exit(1); });
