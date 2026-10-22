#!/usr/bin/env node
/*
 * Checks for the v2 features: fit + zoom, chart look, hover pop-ups on any element,
 * building from scratch (parts, KPI cards, new charts), finding a chart's data,
 * plain-English chart names, review comments + prompt, and help.
 *   node tests/v2.test.js      (CHROMIUM_PATH as for smoke.test.js)
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mothership-v2-'));
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + JSON.stringify(detail))); if (!ok) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const target of ['mothership.html', 'dist/mothership-standalone.html']) {
    console.log('Editor: ' + target);
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, target));
    await page.evaluate(() => MS.samples.open('sales'));
    await wait(2500);

    /* fit + zoom */
    const z = await page.evaluate(() => {
      MS.view.setWidth('auto'); MS.view.setZoom('fit');
      const f = document.querySelector('#stage iframe');
      const out = { fitW: parseInt(f.style.width, 10), fitScale: MS.view.scale, innerW: MS.child.win.innerWidth };
      MS.view.setZoom(1.5); out.zoomed = MS.view.scale; out.scroll = document.querySelector('#stage').scrollWidth > document.querySelector('#stage').clientWidth;
      MS.view.setZoom('fit');
      return out;
    });
    check('zoom: drawn at desktop width and scaled to fit', z.fitW >= 1280 && z.fitScale < 1 && z.innerW >= 1280, z);
    check('zoom: 150% scrolls the stage', z.zoomed === 1.5 && z.scroll, z);

    /* plain-English chart names + finding the data behind a chart */
    const n = await page.evaluate(() => {
      const rt = MS.rt();
      const names = rt.charts().map(c => MS.charts.nameOf(c.key));
      const key = rt.charts()[0].key, m = rt.matchData(key);
      const outline = Array.from(document.querySelectorAll('#outline .ol-row .name')).map(e => e.textContent);
      return { names, match: m[0] && { name: m[0].name, field: m[0].field, score: m[0].score }, own: rt.rowsFromChart(key).length, outline };
    });
    check('chart names are plain English', n.names.every(x => x && !/chartjs|echarts|plotly|canvas|@\d/i.test(x)), n.names);
    check('finds the data behind a chart', n.match && n.match.score >= 0.9, n.match);
    check('chart numbers can be used as data', n.own > 0, n.own);

    /* chart look, applied live */
    const look = await page.evaluate(() => {
      const rt = MS.rt(), c = rt.charts()[0];
      MS.charts.setStyle(c.key, { font: 'Georgia', size: 15, tipBg: '#ffffff', tipColor: '#111111', legend: 'bottom' }, 'look');
      const o = rt.chart(c.key).inst.config.options;
      const out = { tip: o.plugins.tooltip.backgroundColor, legend: o.plugins.legend.position, tickFont: o.scales && Object.keys(o.scales).map(k => o.scales[k].ticks && o.scales[k].ticks.font && o.scales[k].ticks.font.family) };
      MS.history.undo();
      const o2 = rt.chart(c.key).inst.config.options;
      out.undone = o2.plugins.tooltip.backgroundColor !== '#ffffff';
      MS.history.redo();
      return out;
    });
    check('chart look: pop-up, legend and fonts', look.tip === '#ffffff' && look.legend === 'bottom' && (look.tickFont || []).indexOf('Georgia') >= 0, look);
    check('chart look: undo restores the original', look.undone, look);

    /* build from scratch: parts, KPI cards, new chart, footer, hover pop-up */
    const b = await page.evaluate(() => {
      const rt = MS.rt();
      MS.tabs.ensureLayout();
      MS.edit.select(null);
      ['banner', 'section', 'cols2', 'callout', 'divider'].forEach(p => MS.compose.part(p));
      MS.compose.footer();
      MS.history.state('ds', s => { s.datasets.sales = { expr: 'salesData' }; });
      const fields = rt.fields('sales');
      const num = fields.find(f => f.numeric).name, cat = fields.find(f => !f.numeric).name;
      MS.history.state('kpi', s => { s.kpis.k1 = { dataset: 'sales', measure: num, agg: 'sum', format: 'cr' }; });
      const row = MS.compose.make('<div class="ms-kpis"><div class="ms-kpi" data-ms-kpi="k1"><div class="ms-kpi-label">Total</div><div class="ms-kpi-value">…</div><div class="ms-kpi-note"></div></div></div>');
      MS.compose.place(row, 'kpi');
      const h = MS.child.doc.querySelector('.ms-banner h1');
      MS.history.attrs('tip', h, ['data-ms-tip'], x => x.setAttribute('data-ms-tip', 'Hello from a pop-up'));
      return { num, cat, parts: ['.ms-banner', '.ms-section', '.ms-cols', '.ms-callout', '.ms-divider', '.ms-page-footer'].map(s => !!MS.child.doc.querySelector(s)) };
    });
    check('build: header, section, columns, callout, divider, footer', b.parts.every(Boolean), b.parts);
    await page.evaluate(() => MS.compose.ensureChartLib().then(() => MS.compose.addChart({ title: 'Sales by region', ds: 'sales', type: 'bar', by: 'region', measure: 'revenue', agg: 'sum', sort: 'desc' })));
    await wait(800);
    const nc = await page.evaluate(() => {
      const rt = MS.rt(), h = MS.child.doc.querySelector('[data-ms-chart]'), c = h && rt.chart(h.getAttribute('data-ms-chart'));
      rt.refresh();
      return { exists: !!c, labels: c ? rt.chartInfo(c.key).labels.length : 0, name: c ? MS.charts.nameOf(c.key) : '', kpi: MS.child.doc.querySelector('[data-ms-kpi] .ms-kpi-value').textContent };
    });
    check('build: new chart from data draws', nc.exists && nc.labels > 0, nc);
    check('build: new chart is named by its title', nc.name === 'Sales by region', nc.name);
    check('build: KPI card calculates', /₹.*Cr/.test(nc.kpi), nc.kpi);

    /* consistency: one category order, shared colours, format painter, drill-down data, image */
    const cons = await page.evaluate(async () => {
      const rt = MS.rt(), c = rt.charts()[0], d = rt.chartData(c.key);
      const want = d.labels.slice().reverse();
      MS.order.set(want, 'order');
      const after = rt.chartInfo(c.key).labels.map(String);
      const col = {}; col[d.labels[0]] = '#ff0000';
      MS.catColors.set(col, 'colours');
      const colors = rt.chartColors(c.key);
      MS.history.undo(); MS.history.undo();
      const restored = rt.chartInfo(c.key).labels.map(String);
      MS.painter.copied = { from: c.key, name: 'x', style: { font: 'Verdana' }, tooltip: null, colors: {}, order: d.labels };
      MS.painter.apply(rt.charts().slice(1).map(x => x.key), { look: true });
      const painted = rt.charts().slice(1).every(x => (rt.state.charts[x.key] || {}).style && rt.state.charts[x.key].style.font === 'Verdana');
      const marked = await MS.lib('marked');
      const tables = MS.drillData.fromMarkdown(marked, '## Revenue by state\n\n| State | City | Revenue |\n|---|---|---|\n| ' + d.labels[0] + ' | Alpha | ₹1,200 |\n| ' + d.labels[0] + ' | Beta | 300 |\n| ' + d.labels[1] + ' | Gamma | 50 |', 'x');
      const plan = MS.drillData.plan(tables[0]);
      const img = await rt.chartImage(c.key);
      return { reordered: JSON.stringify(after) === JSON.stringify(want), red: colors[d.labels[0]], restored: JSON.stringify(restored) === JSON.stringify(d.labels), painted, rows: tables[0].rows, plan, img: img.slice(0, 22) };
    });
    check('order: every chart follows one category order', cons.reordered, cons);
    check('colours: a category keeps its colour', /#ff0000/i.test(cons.red || ''), cons.red);
    check('order + colours: undo restores', cons.restored, cons);
    check('format painter: look pasted onto other charts', cons.painted, cons);
    check('drill-down data: Markdown table read', cons.rows.length === 3 && cons.rows[0].Revenue === 1200, cons.rows);
    check('drill-down data: linked to the right chart and path', cons.plan.key && cons.plan.levels.join() === 'State,City' && cons.plan.measure === 'Revenue', cons.plan);
    check('chart as image', cons.img === 'data:image/png;base64,', cons.img);

    /* review comments */
    const rv = await page.evaluate(() => {
      const d = MS.child.doc, rt = MS.rt();
      const el = d.querySelector('.ms-banner h1');
      MS.history.state('c', s => {
        s.comments.push({ id: 'm1', kind: 'element', text: 'Make the title shorter', type: 'change', prio: 'must', tab: { id: rt.activeTab, title: 'Dashboard' }, target: { what: MS.review.describe(el).what, ref: '[data-ms-own]', css: 'header.ms-banner > h1' } });
        s.comments.push({ id: 'm2', kind: 'area', text: 'Too much white space here', type: 'change', prio: 'should', area: { x: 10, y: 10, w: 200, h: 120, vw: 1280, vh: 800 }, inside: ['heading “Sales”'] });
        s.comments.push({ id: 'm3', kind: 'interaction', text: 'Drill should go to city', type: 'bug', prio: 'should', steps: ['Double-clicked “West” on “Revenue by state”'], state: { filters: ['region = West'] } });
      });
      MS.emit('comments');
      const p = MS.review.buildPrompt({ output: 'file', structure: true });
      return { n: MS.review.list().length, pins: d.querySelectorAll('.ms-cmt-pin').length, prompt: p, exported: MS.exportHtml({ dropComments: true }), kept: MS.exportHtml() };
    });
    await wait(300);
    const pins = await page.evaluate(() => MS.child.doc.querySelectorAll('.ms-cmt-pin').length);
    check('review: comments stored', rv.n === 3, rv.n);
    check('review: pins drawn', pins >= 1, pins);
    check('review: prompt has every comment and the rules', ['#### 1.', '#### 2.', '#### 3.', 'Make the title shorter', 'Drill should go to city', 'data-ms-', '₹'].every(s => rv.prompt.indexOf(s) >= 0), rv.prompt.slice(0, 400));
    check('review: export can leave comments out', rv.exported.indexOf('Make the title shorter') < 0 && rv.kept.indexOf('Make the title shorter') >= 0, '');
    check('review: no pins in the export', rv.kept.indexOf('ms-cmt-pin') < 0, '');

    /* help */
    const hp = await page.evaluate(() => {
      MS.help.guide('drill'); const g = !!document.querySelector('.guide-body h2'); document.querySelector('.dlg-wrap').remove();
      MS.help.tutorial(); const t = document.querySelectorAll('.coach-lesson').length; document.querySelector('.coach').remove();
      MS.help.tour(0); const s = !!document.querySelector('.spot-card'); MS.$$('.spot,.spot-card').forEach(n => n.remove());
      return { g, t, s, ribbon: MS.RIBBON.map(t => t.tab) };
    });
    check('help: guide, tutorial and tour open', hp.g && hp.t >= 5 && hp.s, hp);
    check('ribbon: Review and Help tabs', hp.ribbon.indexOf('Review') >= 0 && hp.ribbon.indexOf('Help') >= 0, hp.ribbon);

    /* the export works on its own */
    const file = path.join(TMP, 'v2-' + path.basename(target));
    fs.writeFileSync(file, rv.kept);
    const p2 = await browser.newPage({ viewport: { width: 1366, height: 800 } });
    const expErrors = []; p2.on('pageerror', e => expErrors.push(e.message));
    await p2.goto('file://' + file);
    await wait(2500);
    const ex = await p2.evaluate(() => {
      const rt = window.__MS_RT, h = document.querySelector('[data-ms-chart]');
      const c = h && rt.chart(h.getAttribute('data-ms-chart'));
      const t = document.querySelector('.ms-banner h1');
      t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 50, clientY: 50 }));
      const tip = document.querySelector('.ms-hovertip');
      return { chart: !!c && rt.chartInfo(c.key).labels.length > 0, kpi: document.querySelector('[data-ms-kpi] .ms-kpi-value').textContent, footer: !!document.querySelector('.ms-page-footer'), tip: tip && tip.textContent, pins: document.querySelectorAll('.ms-cmt-pin,#ms-cmt-layer').length };
    });
    check('export: new chart renders', ex.chart, ex);
    check('export: KPI card and footer', /₹/.test(ex.kpi) && ex.footer, ex);
    check('export: hover pop-up works', ex.tip === 'Hello from a pop-up', ex);
    check('export: no comment pins', ex.pins === 0, ex);
    check('export: no script errors', expErrors.length === 0, expErrors);
    await p2.close();

    /* new dashboard from scratch */
    await page.evaluate(() => { MS.dirty = false; MS.compose.newDoc(); document.querySelector('.dlg .btn.primary').click(); });
    await wait(1500);
    const nd = await page.evaluate(() => ({ tabs: MS.rt().tabs().map(t => t.title), banner: !!MS.child.doc.querySelector('.ms-banner') }));
    check('new dashboard: tabs and header', nd.tabs.join() === 'Overview,How to use,FAQs,Methodology' && nd.banner, nd);

    check('editor: no script errors', errors.length === 0, errors);
    await page.close();
  }
  await browser.close();
  console.log(failures ? failures + ' check(s) failed' : 'All v2 checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
