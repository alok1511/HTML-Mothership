#!/usr/bin/env node
/*
 * Checks for: Highcharts and D3 charts, plain-language chart summaries, the number check,
 * the Excel comment tracker (out and back in), and comparing versions.
 *   node tests/v4.test.js      (CHROMIUM_PATH as for smoke.test.js; needs `npm install` for highcharts and d3)
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');
const pages = require('./fixtures/pages');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mothership-v4-'));
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + JSON.stringify(detail).slice(0, 700))); if (!ok) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const target of ['mothership.html', 'dist/mothership-standalone.html']) {
    console.log('Editor: ' + target);
    const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, target));

    /* Highcharts */
    const hc = await page.evaluate(async html => {
      await MS.api.run('open_html', { html, name: 'claims.html' });
      const rt = MS.rt(), cs = rt.charts(), k = cs[0].key, name = MS.charts.nameOf(k);
      const out = { libs: cs.map(c => c.lib), names: cs.map(c => MS.charts.nameOf(c.key)), labels: rt.chartInfo(k).labels };
      await MS.api.run('category_order', { order: ['North', 'South', 'East', 'West'] });
      await MS.api.run('category_colors', { colors: { North: '#c00000' } });
      await MS.api.run('chart_settings', { chart: name, tooltip: '{label}: {value:cr}', look: { font: 'Georgia', legend: 'top', axisFormat: 'cr' } });
      await new Promise(r => setTimeout(r, 300));
      const ch = rt.chart(k).inst;
      out.ordered = rt.chartInfo(k).labels;
      out.color = rt.chartColors(k).North;
      out.font = ch.options.chart.style.fontFamily;
      out.legend = ch.options.legend.verticalAlign;
      ch.tooltip.refresh(ch.series[0].points[0]);
      out.tip = Array.from(ch.renderTo.querySelectorAll('.highcharts-tooltip')).map(e => e.textContent).join('');
      out.axis = Array.from(ch.container.querySelectorAll('.highcharts-yaxis-labels text')).map(t => t.textContent).slice(-1)[0];
      out.img = (await rt.chartImage(k)).slice(0, 22);
      out.summary = rt.summarize(cs[1].key, MS.charts.nameOf(cs[1].key));
      out.html = MS.exportHtml();
      return out;
    }, pages.highcharts());
    check('Highcharts: charts found and named by their titles', hc.libs.join() === 'highcharts,highcharts' && hc.names.join() === 'Claims paid by region,Claims by line of business', hc);
    check('Highcharts: one category order applies', hc.ordered.join() === 'North,South,East,West', hc.ordered);
    check('Highcharts: category colour applies', /c00000/i.test(hc.color || ''), hc.color);
    check('Highcharts: look (font, legend, ₹ crore axis)', hc.font === 'Georgia' && hc.legend === 'top' && /Cr/.test(hc.axis || ''), { font: hc.font, legend: hc.legend, axis: hc.axis });
    check('Highcharts: pop-up text', /North: ₹3\.1 Cr/.test(hc.tip), hc.tip);
    check('Highcharts: chart as image', hc.img === 'data:image/png;base64,', hc.img);
    check('Highcharts: pie summary', /Motor is the largest share/.test(hc.summary) && /50%/.test(hc.summary), hc.summary);
    const exFile = path.join(TMP, 'claims-edited.html');
    fs.writeFileSync(exFile, hc.html);
    const p2 = await browser.newPage();
    const exErr = []; p2.on('pageerror', e => exErr.push(e.message));
    await p2.goto('file://' + exFile); await wait(1500);
    const ex = await p2.evaluate(() => { const rt = window.__MS_RT, c = rt.charts()[0]; return { lib: c.lib, labels: rt.chartInfo(c.key).labels, color: rt.chartColors(c.key).North }; });
    check('Highcharts: order and colour kept in the export', ex.lib === 'highcharts' && ex.labels.join() === 'North,South,East,West' && /c00000/i.test(ex.color || ''), ex);
    check('Highcharts: export has no script errors', exErr.length === 0, exErr);
    await p2.close();

    /* D3 */
    const d3 = await page.evaluate(async html => {
      MS.dirty = false;
      await MS.api.run('open_html', { html, name: 'premium.html' });
      const rt = MS.rt(), cs = rt.charts(), k = cs[0] && cs[0].key;
      if (!k) return { libs: [] };
      const name = MS.charts.nameOf(k);
      await MS.api.run('category_colors', { colors: { North: '#c00000' } });
      await MS.api.run('chart_settings', { chart: name, tooltip: '{label}: {value:cr}' });
      await new Promise(r => setTimeout(r, 200));
      const north = Array.from(cs[0].el.querySelectorAll('rect.bar')).find(r => r.__data__.region === 'North');
      return { libs: cs.map(c => c.lib), name, data: rt.chartData(k), color: getComputedStyle(north).fill, tip: north.getAttribute('data-ms-tip'), summary: rt.summarize(k, name), img: (await rt.chartImage(k)).slice(0, 22) };
    }, pages.d3());
    check('D3: SVG chart found and named', d3.libs.join() === 'd3' && d3.name === 'Premium by region', d3);
    check('D3: its numbers are read from the marks', d3.data && d3.data.labels.join() === 'West,North,South,East' && d3.data.series[0].name === 'Premium' && d3.data.series[0].values[0] === 52000000, d3.data);
    check('D3: category colour and pop-up', /192, 0, 0/.test(d3.color || '') && d3.tip === 'North: ₹3.8 Cr', { color: d3.color, tip: d3.tip });
    check('D3: summary and image', /West is highest at ₹5\.2 Cr/.test(d3.summary || '') && d3.img === 'data:image/png;base64,', { s: d3.summary, img: d3.img });

    /* summaries, number check, tracker, compare on the sales sample */
    await page.evaluate(() => { MS.dirty = false; MS.samples.open('sales'); });
    await wait(2500);
    const s = await page.evaluate(async () => {
      const out = {};
      const sums = await MS.api.run('chart_summaries', { show: 'caption' });
      out.sums = sums.map(x => x.summary);
      out.caps = MS.$$('.ms-summary', MS.child.doc).length;
      out.aria = MS.rt().charts()[0].el.getAttribute('aria-label') || '';
      out.html = MS.exportHtml();
      out.check = await MS.api.run('number_check', {});
      // break a KPI: it should now be flagged
      const v = MS.$$('.kpi', MS.child.doc).find(k => /Profit/.test(k.textContent));
      const val = v && Array.from(v.querySelectorAll('*')).find(e => /₹/.test(e.textContent) && !e.children.length);
      if (val) val.textContent = '₹18.4 Cr';
      out.broken = await MS.api.run('number_check', { add_comments: true });
      out.comments = MS.review.list().length;
      return out;
    });
    check('summaries: one per chart, in Indian formats', s.sums.length === 4 && s.sums.every(x => x && /₹[\d.]+ Cr/.test(x)), s.sums);
    check('summaries: captions under charts and for screen readers', s.caps === 4 && /highest/.test(s.aria), { caps: s.caps, aria: s.aria });
    check('number check: KPI cards match the charts', s.check.filter(x => x.status === 'ok' && /KPI/.test(x.item)).length === 2 && !s.check.some(x => x.status === 'diff'), s.check);
    check('number check: a wrong KPI is flagged and becomes a comment', s.broken[0].status === 'diff' && /Profit/.test(s.broken[0].item) && s.comments >= 1, s.broken[0]);
    const capFile = path.join(TMP, 'sales-captions.html'); fs.writeFileSync(capFile, s.html);
    const p3 = await browser.newPage(); await p3.goto('file://' + capFile); await wait(1500);
    const caps = await p3.evaluate(() => Array.from(document.querySelectorAll('.ms-summary')).map(e => e.textContent));
    check('summaries: captions rebuilt in the exported file', caps.length === 4 && /highest/.test(caps[0]), caps);
    await p3.close();

    const tr = await page.evaluate(async () => {
      await MS.api.run('add_comment', { ref: 'h1', text: 'Shorter title', priority: 'nice' });
      const rows = MS.tracker.rows();
      const built = await MS.tracker.build();
      const X = await MS.lib('xlsx');
      const wb = X.read(built.bytes, { type: 'array' }), ws = wb.Sheets.Comments;
      const data = X.utils.sheet_to_json(ws, { defval: '' });
      data.forEach(r => { if (r.Comment === 'Shorter title') { r.Status = 'Done'; r.Owner = 'Priya'; r.Due = '30-Oct-2026'; r.Priority = 'Must'; } });
      const wb2 = X.utils.book_new(); X.utils.book_append_sheet(wb2, X.utils.json_to_sheet(data), 'Comments');
      const res = await MS.tracker.apply(X.write(wb2, { type: 'array', bookType: 'xlsx' }));
      const c = MS.review.list().find(x => x.text === 'Shorter title');
      return { sheets: wb.SheetNames, cols: Object.keys(data[0] || {}), first: rows[0], res, c: { done: c.done, status: c.status, owner: c.owner, due: c.due, prio: c.prio } };
    });
    check('tracker: Excel file with Comments and Summary sheets', tr.sheets.join() === 'Comments,Summary' && ['Status', 'Tab', 'Chart', 'Where', 'Comment', 'Done when', 'Owner', 'Due', 'ID'].every(k => tr.cols.indexOf(k) >= 0), tr);
    check('tracker: rows say where each comment is', !!tr.first.Where && !!tr.first.Comment, tr.first);
    check('tracker: edits come back (status, owner, due, priority)', tr.res.updated === 1 && tr.c.done === true && tr.c.status === 'Done' && tr.c.owner === 'Priya' && tr.c.due === '30-Oct-2026' && tr.c.prio === 'must', tr);

    const cmp = await page.evaluate(async () => {
      await MS.versions.save('Before', true);
      const before = MS.exportHtml();
      await MS.api.run('set_text', { ref: 'h1', text: 'Sales review FY25' });
      await MS.api.run('category_order', { order: ['North', 'South', 'East', 'West'] });
      const r = await MS.api.run('compare_versions', { before_html: before });
      const same = await MS.api.run('compare_versions', { before_html: MS.exportHtml() });
      MS.compare.dialog(); await new Promise(r => setTimeout(r, 600));
      const items = MS.$$('.cmp-item').length;
      MS.$$('.dlg .seg-btn')[1].click(); await new Promise(r => setTimeout(r, 300));
      const frames = MS.$$('.cmp-frame iframe').length;
      MS.$('.dlg-wrap').remove();
      return { r, same: same.changes, items, frames };
    });
    const flat = JSON.stringify(cmp.r);
    check('compare: finds the text and order changes', /Sales review FY25/.test(flat) && /Category order/.test(flat), cmp.r);
    check('compare: no changes against itself', cmp.same === 0, cmp.same);
    check('compare: dialog lists changes and shows both side by side', cmp.items >= 1 && cmp.frames === 2, cmp);

    const ui = await page.evaluate(() => {
      const out = {};
      MS.summaries.dialog(); out.sum = MS.$$('.sum-row').length; MS.$('.dlg-wrap').remove();
      MS.numcheck.dialog(); out.nc = MS.$$('.nc-table tr').length; MS.$('.dlg-wrap').remove();
      return out;
    });
    check('dialogs: summaries and number check open', ui.sum === 4 && ui.nc > 2, ui);

    check('editor: no script errors', errors.length === 0, errors);
    await page.close();
  }
  await browser.close();
  console.log(failures ? failures + ' check(s) failed' : 'All v4 checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
