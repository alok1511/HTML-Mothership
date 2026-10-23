#!/usr/bin/env node
/*
 * Checks for v3.4: cut / copy / paste anywhere (one-page dashboards, the dashboard's own tabs, inside a
 * card, between dashboards, from Excel and other apps), the right-click menu, resizing any chart,
 * legends, one chart's own data, dialogs and messages, templates, one-click data refresh, table colour
 * rules, the accessibility check and speaker notes from comments.
 *   node tests/v7.test.js      (CHROMIUM_PATH as for smoke.test.js)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const pages = require('./fixtures/pages');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + JSON.stringify(detail).slice(0, 700))); if (!ok) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const b64 = s => Buffer.from(s, 'utf8').toString('base64');

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const sales = fs.readFileSync(path.join(ROOT, 'samples', 'sales-dashboard.html'), 'utf8');

  for (const target of (process.env.V7_ONLY ? [process.env.V7_ONLY] : ['mothership.html', 'dist/mothership-standalone.html'])) {
    console.log('Editor: ' + target);
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, target));
    const open = async (html, name) => { await page.evaluate(([h, n]) => { MS.dirty = false; return MS.openHtml(h, n); }, [html, name]); await wait(1800); };
    const frame = () => page.frames().find(f => f !== page.mainFrame());

    /* ---------------- paste on a one-page dashboard, with the keyboard */
    await open(sales, 'sales.html');
    const before = await page.evaluate(() => ({ cards: MS.child.doc.querySelectorAll('.card').length, blocks: MS.child.doc.querySelectorAll('.ms-block').length, layout: MS.rt().layoutEnabled() }));
    await frame().locator('#regionChart').click(); await wait(150);
    await page.keyboard.press('Control+c'); await wait(200);
    await frame().locator('.card h2', { hasText: 'Sales mix by category' }).click(); await wait(150);
    await page.keyboard.press('Control+v'); await wait(900);
    const one = await page.evaluate(() => {
      const d = MS.child.doc, mix = Array.from(d.querySelectorAll('.card')).filter(c => /Sales mix/.test(c.textContent))[0];
      const next = mix.nextElementSibling;
      return { cards: d.querySelectorAll('.card').length, blocks: d.querySelectorAll('.ms-block').length, copyAfterMix: !!(next && next.querySelector('[data-ms-copyof]') && next.querySelector('canvas')),
        copyText: next && next.querySelector('h2') && next.querySelector('h2').textContent, nextOwned: next && next.hasAttribute('data-ms-own'), uniqueIds: new Set(Array.from(d.querySelectorAll('[id]')).map(x => x.id)).size === d.querySelectorAll('[id]').length };
    });
    check('one-page: Ctrl+C / Ctrl+V works without the tab ribbon', !before.layout && one.cards === before.cards + 1, { before, one });
    check('one-page: the copy lands right after the selected card, with a live chart', one.copyAfterMix && one.copyText === 'Sales by region' && one.nextOwned, one);
    check('one-page: copying leaves the original alone (no wrapper added)', one.blocks === before.blocks && one.uniqueIds, one);
    const cut = await page.evaluate(async () => {
      const d = MS.child.doc, cards = () => Array.from(d.querySelectorAll('.card')).map(c => c.querySelector('h2').textContent);
      const trend = Array.from(d.querySelectorAll('.card')).filter(c => /Monthly sales/.test(c.textContent))[0];
      const start = cards();
      MS.edit.select(trend); MS.clipboard.copy(true);
      const gone = !trend.isConnected;
      const all = d.querySelectorAll('.card'); MS.edit.select(all[all.length - 1]); await MS.clipboard.paste(); await new Promise(r => setTimeout(r, 300));
      const after = cards();
      MS.history.undo(); MS.history.undo(); await new Promise(r => setTimeout(r, 300));
      return { start, gone, after, undone: cards() };
    });
    check('cut: the part leaves at once and pastes where chosen', cut.gone && cut.after[cut.after.length - 1] === 'Monthly sales trend' && cut.after.filter(x => x === 'Monthly sales trend').length === 1, cut);
    check('cut: undo puts it back', cut.undone.join() === cut.start.join(), cut);
    const dup = await page.evaluate(() => { const d = MS.child.doc, c = d.querySelector('.card p, .card h2'); MS.edit.select(c); const n = MS.cmd.dup(); return { blocks: d.querySelectorAll('.ms-block').length }; });
    check('duplicate: no wrapper around the original either', dup.blocks === 0, dup);

    /* ---------------- the dashboard's own tabs, paste inside, right-click */
    await open(pages.owntabs(), 'owntabs.html');
    const own = await page.evaluate(async () => {
      const d = MS.child.doc, rt = MS.rt();
      const regionCard = d.getElementById('region').closest('.card');
      MS.edit.select(regionCard); MS.clipboard.copy(false);
      MS.pageTabs.show(1); MS.edit.select(null);
      await MS.clipboard.paste(); await new Promise(r => setTimeout(r, 600));
      const claims = d.getElementById('claims');
      const landed = claims.lastElementChild;
      // paste inside a card
      const note = d.querySelector('#notes .card');
      MS.edit.select(note); await MS.clipboard.paste({ inside: true }); await new Promise(r => setTimeout(r, 400));
      return { inClaims: !!(landed && landed.querySelector('[data-ms-copyof] canvas')), lastTitle: landed && landed.querySelector('h3') && landed.querySelector('h3').textContent,
        inside: !!(note.querySelector('.card [data-ms-copyof]')), keys: Object.keys(rt.state.charts).length };
    });
    check('own tabs: no selection pastes at the end of the tab on screen', own.inClaims && own.lastTitle === 'Premium by region', own);
    check('own tabs: "Paste inside" puts it inside the selected card', own.inside, own);
    await page.evaluate(() => MS.pageTabs.show(0)); await wait(200);
    await frame().locator('#mix').click({ button: 'right' }); await wait(250);
    const menu = await page.evaluate(() => { const m = document.querySelector('.popmenu'); const r = m ? Array.from(m.querySelectorAll('button')).map(b => b.textContent.trim()) : []; return r; });
    check('right-click: a menu with cut, copy, paste, chart data, legend and size', ['Cut', 'Copy', 'Duplicate', 'Chart data…', 'Legend', 'Size…', 'Delete'].every(x => menu.some(m => m.indexOf(x) === 0)), menu);
    await page.hover('.popmenu button:has-text("Legend")'); await wait(150);
    const sub = await page.evaluate(() => document.querySelectorAll('.popmenu').length);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await wait(100);
    check('right-click: Legend opens a sub-menu; Esc closes', sub === 2 && !(await page.evaluate(() => !!document.querySelector('.popmenu'))), sub);

    /* ---------------- between dashboards, and from other apps */
    const snapOk = await page.evaluate(() => { MS.edit.select(MS.child.doc.getElementById('trend').closest('.card')); MS.clipboard.copy(false); return !!localStorage.getItem('ms.clipSnap'); });
    await open(pages.w3tabs(), 'w3tabs.html');
    const cross = await page.evaluate(async () => {
      MS.edit.select(MS.child.doc.querySelector('#Summary p'));
      await MS.clipboard.paste(); await new Promise(r => setTimeout(r, 900));
      const rt = MS.rt(), c = rt.charts()[0], ds = Object.keys(rt.state.datasets);
      return { charts: rt.charts().length, labels: c && c.inst.data.labels.join(','), values: c && c.inst.data.datasets[0].data.join(','), ds, lib: !!MS.child.doc.querySelector('script[data-ms-lib="chartjs"]'), inSummary: !!MS.child.doc.querySelector('#Summary canvas') };
    });
    check('between dashboards: the chart is rebuilt from its numbers (with Chart.js added)', snapOk && cross.charts === 1 && cross.labels === 'Q1,Q2,Q3,Q4' && cross.values === '1.5,1.9,1.7,2' && cross.lib && cross.inSummary, cross);
    const ext = await page.evaluate(async () => {
      const fire = (data, files) => { const dt = new DataTransfer(); Object.keys(data).forEach(k => dt.setData(k, data[k])); (files || []).forEach(f => dt.items.add(f)); const e = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); MS.child.doc.body.dispatchEvent(e); };
      MS.edit.select(MS.child.doc.querySelector('#Summary h3'));
      fire({ 'text/plain': 'Line\tPremium\nMotor\t5.1\nHealth\t3.6' }); await new Promise(r => setTimeout(r, 300));
      const t = MS.child.doc.querySelector('#Summary table.ms-table');
      MS.edit.select(MS.child.doc.querySelector('#Summary h3'));
      fire({ 'text/html': '<table><tr><th>A</th><th>B</th></tr><tr><td>x</td><td>1</td></tr></table>' }); await new Promise(r => setTimeout(r, 300));
      const png = await (await fetch('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')).blob();
      MS.edit.select(MS.child.doc.querySelector('#Summary h3'));
      fire({}, [new File([png], 'shot.png', { type: 'image/png' })]); await new Promise(r => setTimeout(r, 400));
      return { tsv: t ? t.querySelectorAll('tr').length + '/' + t.querySelector('th').textContent + '/' + t.querySelector('td.num').textContent : null, tables: MS.child.doc.querySelectorAll('#Summary table').length, img: !!MS.child.doc.querySelector('#Summary img[src^="data:image/png"]') };
    });
    check('from Excel: a copied range pastes as a table (numbers right-aligned)', ext.tsv === '3/Line/5.1', ext);
    check('from other apps: an HTML table and a picture paste too', ext.tables === 2 && ext.img, ext);

    /* ---------------- tab ribbon still works */
    const rib = await page.evaluate(async () => {
      await MS.api.run('layout', { action: 'enable' }).catch(() => MS.rt().enableLayout('Overview'));
      MS.rt().refresh(); await new Promise(r => setTimeout(r, 300));
      const rt = MS.rt(), id = MS.tabs.add('Copies', 'grid', '');
      MS.edit.select(MS.child.doc.querySelector('#Summary canvas').closest('[data-ms-chart]') || MS.child.doc.querySelector('#Summary canvas'));
      MS.clipboard.copy(false); MS.edit.select(rt.tabEl(id)); await MS.clipboard.paste(); await new Promise(r => setTimeout(r, 500));
      return { grid: rt.tabEl(id).querySelectorAll('.ms-grid > .ms-block').length };
    });
    check('tab ribbon: pasting into a chart tab makes a grid block', rib.grid === 1, rib);

    /* ---------------- resize, legends, one chart's data */
    await open(pages.tablepage(), 'table.html');
    const sz = await page.evaluate(async () => {
      const r1 = await MS.api.run('chart_size', { chart: 'Premium by region', columns: 2, height: 360 });
      await new Promise(r => setTimeout(r, 300));
      const cv = MS.child.doc.getElementById('prem'), card = MS.child.doc.getElementById('c1');
      return { r1, h: Math.round(cv.getBoundingClientRect().height), span: card.style.gridColumn, fill: !!cv.closest('[data-ms-fill]') };
    });
    check('resize: width in columns of the page\'s own grid and height in px', sz.span === 'span 2' && Math.abs(sz.h - 360) < 6 && sz.fill && sz.r1.of === 3, sz);
    await page.evaluate(() => MS.edit.select(MS.child.doc.getElementById('prem'))); await wait(200);
    const hd = await frame().evaluate(() => { const hh = document.querySelector('.ms-size-handle'); const r = hh && hh.getBoundingClientRect(); return r && hh.style.display !== 'none' ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; });
    const geo = await page.evaluate(() => { const r = MS.child.frame.getBoundingClientRect(); return { x: r.left, y: r.top, s: r.width / MS.child.frame.offsetWidth }; });
    if (hd) { const sx = geo.x + hd.x * geo.s, sy = geo.y + hd.y * geo.s; await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx, sy - 40, { steps: 3 }); await page.mouse.move(sx, sy - 100 * geo.s, { steps: 3 }); await page.mouse.up(); await wait(250); }
    const drag = await page.evaluate(() => ({ h: Math.round(MS.child.doc.getElementById('prem').getBoundingClientRect().height), undo: MS.history.canUndo() }));
    check('resize: the round handle on a selected chart drags its size', hd && drag.h < 300 && drag.h > 200, { hd, drag });
    const kept = await page.evaluate(async () => { const html = MS.exportHtml(); await MS.openHtml(html, 'again.html'); await new Promise(r => setTimeout(r, 1800)); return Math.round(MS.child.doc.getElementById('prem').getBoundingClientRect().height); });
    check('resize: the new size is kept in the exported file', Math.abs(kept - drag.h) < 6, { kept, was: drag.h });
    const lg = await page.evaluate(async () => {
      const k = MS.rt().charts()[0].key, o = () => MS.rt().chart(k).inst.options.plugins.legend;
      await MS.api.run('chart_legend', { chart: k, position: 'left' }); await new Promise(r => setTimeout(r, 200));
      const a = o().display + '/' + o().position;
      await MS.api.run('chart_legend', { chart: k, position: 'none' }); await new Promise(r => setTimeout(r, 200));
      const b = o().display;
      MS.history.undo(); await new Promise(r => setTimeout(r, 200));
      return { a, b, undo: o().position };
    });
    check('legend: move it (left) and hide it, undoable', lg.a === 'true/left' && lg.b === false && lg.undo === 'left', lg);
    await open(pages.owntabs(), 'owntabs.html');
    const pl = await page.evaluate(async () => {
      const box = MS.child.doc.getElementById('mixLegend');
      const k = MS.rt().chartOf(MS.child.doc.getElementById('mix')).key;
      const found = MS.chartKit.pageLegend(k) === box;
      MS.chartKit.setLegend(k, 'right'); await new Promise(r => setTimeout(r, 200));
      const one = box.style.display === 'none' && MS.rt().chart(k).inst.options.plugins.legend.display === true;
      MS.chartKit.setLegend(k, ''); await new Promise(r => setTimeout(r, 200));
      return { found, one, back: box.style.display === '' };
    });
    check('legend: one legend at a time (the page\'s own legend steps aside, and comes back)', pl.found && pl.one && pl.back, pl);
    const cd = await page.evaluate(async () => {
      const csv = 'Region,2024,2025,2026\nNorth,1,2,3\nSouth,4,5,6\nCentral,7,8,9\n';
      const r = await MS.api.run('set_chart_data', { chart: 'Premium by region', file: { name: 'regions.csv', b64: btoa(csv) } });
      await new Promise(x => setTimeout(x, 300));
      const c = MS.rt().chart(MS.rt().chartOf(MS.child.doc.getElementById('region')).key).inst;
      const now = c.data.labels.join(',') + ' | ' + c.data.datasets.map(d => d.label + ':' + d.data.join('-')).join(' ');
      const exported = MS.exportHtml().indexOf('regions.csv') > 0;
      await MS.api.run('set_chart_data', { chart: 'Premium by region', reset: true }); await new Promise(x => setTimeout(x, 300));
      return { r, now, exported, back: c.data.labels.join(','), ds: Object.keys(MS.rt().state.datasets).length };
    });
    check('chart data: a CSV gives one chart new labels and series, kept in the order of the file', cd.now === 'North,South,Central | 2024:1-4-7 2025:2-5-8 2026:3-6-9' && cd.exported, cd);
    check('chart data: back to the page\'s own numbers (and its dataset goes)', cd.back === 'North,South,East,West' && cd.ds === 0, cd);
    await page.evaluate(() => { MS.edit.select(MS.child.doc.getElementById('trend')); MS.chartKit.dataDialog(); }); await wait(250);
    const grid = await page.evaluate(() => ({ rows: document.querySelectorAll('.dgrid tr').length, first: document.querySelector('.dgrid input.cell.num') && document.querySelector('.dgrid input.cell.num').value }));
    await page.evaluate(() => { const inp = document.querySelector('.dgrid input.cell'); const dt = new DataTransfer(); dt.setData('text/plain', 'Quarter\tClaims\tTarget\nQ1\t10\t9\nQ2\t12\t11\n'); inp.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
    await wait(100);
    const pasted = await page.evaluate(() => document.querySelectorAll('.dgrid tr').length);
    await page.click('.dlg-foot .btn.primary'); await wait(350);
    const after = await page.evaluate(() => { const c = MS.rt().chartOf(MS.child.doc.getElementById('trend')).inst; return c.data.labels.join(',') + '|' + c.data.datasets.length; });
    check('chart data: the grid shows the numbers; an Excel range pasted into it replaces them', grid.rows === 6 && grid.first === '1.5' && pasted === 4 && after === 'Q1,Q2|2', { grid, pasted, after });

    /* ---------------- dialogs and messages */
    const dl = await page.evaluate(async () => {
      let v;
      const p = MS.dialog({ title: 'Test', sub: 'A line under the title', body: MS.h('input', { 'class': 'inp' }), buttons: [{ label: 'Cancel', value: null }, { label: 'OK', primary: true, value: () => { MS.dialogError('Fill this in'); return false; } }] }).then(x => { v = x; });
      await new Promise(r => setTimeout(r, 60));
      document.querySelector('.dlg-foot .btn.primary').click();
      const err = document.querySelector('.dlg-err').textContent, still = !!document.querySelector('.dlg-wrap');
      const sub = document.querySelector('.dlg-sub').textContent, hint = !!document.querySelector('.dlg-hint');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await p;
      const t = MS.toast('Deleted.', 'ok', 5000, { action: { label: 'Undo', run: () => { window.__undone = true; } } });
      const act = document.querySelector('.toast:last-child .toast-act'); act.click();
      return { err, still, sub, hint, closed: !document.querySelector('.dlg-wrap') && v === null, undone: !!window.__undone, x: !!document.querySelector('.toast-x') };
    });
    check('dialogs: a message inside the dialog instead of closing it; sub-line; key hint; Esc', dl.err === 'Fill this in' && dl.still && dl.sub && dl.hint && dl.closed, dl);
    check('messages: an Undo button and a close button', dl.undone && dl.x, dl);
    await page.evaluate(() => { MS.dialog({ title: 'Move me', body: 'x' }); }); await wait(80);
    const hb = await page.locator('.dlg-head strong').boundingBox();
    await page.mouse.move(hb.x + 5, hb.y + 5); await page.mouse.down(); await page.mouse.move(hb.x + 125, hb.y + 65, { steps: 4 }); await page.mouse.up();
    const moved = await page.evaluate(() => document.querySelector('.dlg').style.transform);
    await page.keyboard.press('Escape');
    check('dialogs: drag the title bar to move the window', /translate\(120px, 60px\)/.test(moved), moved);

    /* ---------------- templates */
    const tp = await page.evaluate(async () => {
      MS.edit.select(MS.child.doc.getElementById('trend').closest('.card'));
      await MS.api.run('templates', { action: 'save', name: 'Trend card' });
      const list = (await MS.api.run('templates', {})).map(t => t.name);
      await MS.api.run('templates', { action: 'save', name: 'Claims tab', what: 'tab' });
      return { list };
    });
    await open(pages.tablepage(), 'table.html');
    const tpi = await page.evaluate(async () => {
      MS.edit.select(MS.child.doc.getElementById('c2'));
      await MS.api.run('templates', { action: 'insert', name: 'Trend card' }); await new Promise(r => setTimeout(r, 700));
      const rt = MS.rt(), afterC2 = MS.child.doc.getElementById('c2').nextElementSibling;
      const starter = await MS.api.run('templates', { action: 'insert', name: 'KPI row and two charts' }); await new Promise(r => setTimeout(r, 900));
      return { charts: rt.charts().length, after: !!(afterC2 && afterC2.querySelector('canvas')) && /Claims trend/.test(afterC2.textContent), starter: !!starter.inserted };
    });
    check('templates: save a card and see it in the gallery with the starters', tp.list.indexOf('Trend card') >= 0 && tp.list.indexOf('KPI row and two charts') >= 0, tp);
    check('templates: insert it in another dashboard (chart rebuilt), and a starter', tpi.after && tpi.starter && tpi.charts === 4, tpi);
    await open(pages.owntabs(), 'owntabs.html');
    const tt = await page.evaluate(async () => { await MS.api.run('templates', { action: 'insert', name: 'Claims tab' }); await new Promise(r => setTimeout(r, 900)); const t = MS.pageTabs.active(); return { title: t.title, tabs: MS.pageTabs.list().length, charts: t.panel.querySelectorAll('canvas').length }; });
    check('templates: a tab template becomes a new tab of the dashboard\'s own kind', tt.title === 'Claims tab' && tt.tabs === 4 && tt.charts === 2, tt);
    await page.evaluate(() => { MS.templates.gallery(); }); await wait(300);
    const gal = await page.evaluate(() => document.querySelectorAll('.tpl-card').length);
    await page.keyboard.press('Escape');
    check('templates: the gallery shows every template', gal >= 5, gal);

    /* ---------------- one-click refresh */
    const rf = await page.evaluate(async () => {
      const csv1 = 'Line,Claims\nMotor,3.2\nHealth,2.1\nFire,1.1\nMarine,0.7\n', csv2 = 'Line,Claims\nMotor,4\nHealth,3\nFire,2\nMarine,1\nCyber,0.5\n';
      const f = (n, s) => ({ name: n, b64: btoa(s) });
      await MS.api.run('add_dataset', { name: 'Claims by line', file: f('claims-2026-09.csv', csv1) });
      MS.history.state('file', s => { s.datasets['Claims by line'].file = 'claims-2026-09.csv'; });
      await MS.api.run('link_chart_data', { chart: 'Claims by line', levels: ['Line'], measure: 'Claims' }).catch(() => null);
      MS.history.state('link', s => { s.charts[MS.rt().chartOf(MS.child.doc.getElementById('lines')).key] = { binding: { dataset: 'Claims by line', levels: ['Line'], measure: 'Claims', agg: 'sum', sort: 'source' } }; });
      await new Promise(r => setTimeout(r, 200));
      const dry = await MS.api.run('refresh_data', { files: [f('claims-2026-10.csv', csv2)], apply: false });
      const res = await MS.api.run('refresh_data', { files: [f('claims-2026-10.csv', csv2)] });
      await new Promise(r => setTimeout(r, 300));
      const c = MS.rt().chartOf(MS.child.doc.getElementById('lines')).inst;
      return { dry, res, labels: c.data.labels.join(','), file: MS.rt().state.datasets['Claims by line'].file };
    });
    check('refresh: this month\'s file is matched by name (dates ignored) and the chart follows', rf.dry.length === 1 && rf.res.refreshed[0].rows === 5 && rf.res.refreshed[0].was === 4 && rf.labels === 'Motor,Health,Fire,Marine,Cyber' && rf.file === 'claims-2026-10.csv', rf);

    /* ---------------- table colour rules */
    await open(pages.tablepage(), 'table.html');
    const tr = await page.evaluate(async () => {
      const r = await MS.api.run('table_rules', { table: 0, action: 'add', rule: { col: 'Loss ratio', type: 'rag', value: '55', value2: '65', higher: false } });
      await MS.api.run('table_rules', { table: 0, action: 'add', rule: { col: 'Premium', type: 'bars' } });
      const bg = Array.from(MS.child.doc.querySelectorAll('#perf tr')).slice(1).map(tr => getComputedStyle(tr.cells[2]).backgroundColor);
      const bars = MS.child.doc.querySelector('#perf tr:nth-child(5) td:nth-child(2)').style.backgroundImage;
      const html = MS.exportHtml();
      return { r, bg, bars, html };
    });
    check('table rules: red / amber / green by thresholds (lower is better)', tr.bg.join('|') === 'rgb(198, 239, 206)|rgb(255, 199, 206)|rgb(255, 235, 156)|rgb(198, 239, 206)', tr.bg);
    check('table rules: data bars', /linear-gradient/.test(tr.bars) && /100%/.test(tr.bars), tr.bars);
    const tr2 = await page.evaluate(async html => {
      await MS.openHtml(html, 'again.html'); await new Promise(r => setTimeout(r, 1500));
      const bg = getComputedStyle(MS.child.doc.querySelector('#perf tr:nth-child(3) td:nth-child(3)')).backgroundColor;
      await MS.api.run('table_rules', { table: 0, action: 'clear' });
      return { bg, cleared: MS.child.doc.querySelectorAll('#perf [data-ms-cf]').length, plain: getComputedStyle(MS.child.doc.querySelector('#perf tr:nth-child(3) td:nth-child(3)')).backgroundColor };
    }, tr.html);
    check('table rules: kept in the export, and cleared without a trace', tr2.bg === 'rgb(255, 199, 206)' && tr2.cleared === 0 && tr2.plain === 'rgba(0, 0, 0, 0)', tr2);
    await page.evaluate(() => { MS.edit.select(MS.child.doc.querySelector('#perf td')); MS.tables.rulesDialog(); }); await wait(250);
    const rd = await page.evaluate(() => ({ cols: Array.from(document.querySelectorAll('.rule-form select')[0].options).map(o => o.value).join(','), green: document.querySelector('.rule-form input').value }));
    await page.click('.rule-form .btn'); await wait(100); await page.click('.dlg-foot .btn.primary'); await wait(200);
    const rd2 = await page.evaluate(() => MS.rt().state.tableRules[MS.rt().tableKey(MS.child.doc.getElementById('perf'))]);
    check('table rules: the dialog suggests thresholds from the numbers and saves the rule', rd.cols === 'Region,Premium,Loss ratio' && rd2 && rd2.length === 1 && rd2[0].type === 'rag', { rd, rd2 });

    /* ---------------- accessibility */
    const ax = await page.evaluate(async () => {
      // a second place with the same pale colours: one finding, and the fix must reach both
      MS.child.doc.body.insertAdjacentHTML('beforeend', '<p class="pale" id="pale2">Figures are unaudited.</p>');
      const list = await MS.api.run('accessibility_check', {});
      const kinds = list.map(x => x.kind).sort().join(',');
      const fixed = await MS.api.run('accessibility_check', { fix: true });
      const img = MS.child.doc.querySelector('#c3 img');
      await MS.api.run('set_alt_text', { ref: '#c3 img', text: 'Company logo' });
      const last = await MS.api.run('accessibility_check', {});
      return { kinds, fixed: fixed.map(x => x.kind).sort().join(','), lang: MS.child.doc.documentElement.lang, title: MS.child.doc.title, pale: getComputedStyle(MS.child.doc.querySelector('.pale')).color, pale2: getComputedStyle(MS.child.doc.getElementById('pale2')).color, alt: img.alt, left: last.length, th: MS.child.doc.querySelectorAll('#perf th').length };
    });
    check('accessibility: finds missing alt text, pale text, a table without headings, no language or title', ['alt', 'contrast', 'lang', 'th', 'title'].every(k => ax.kinds.indexOf(k) >= 0), ax.kinds);
    check('accessibility: one-click fixes (language, title, readable colour, table headings) and alt text', ax.fixed === 'alt' && ax.lang && ax.title === 'Regional review' && ax.pale !== 'rgb(201, 204, 211)' && ax.pale2 !== 'rgb(201, 204, 211)' && ax.th === 3 && ax.alt === 'Company logo' && ax.left === 0, ax);

    /* ---------------- speaker notes from comments */
    await open(pages.owntabs(), 'owntabs.html');
    const nt = await page.evaluate(async () => {
      await MS.api.run('add_comment', { ref: '.kpi', text: 'Explain the loss ratio jump' }).catch(e => e.message);
      const c = MS.rt().state.comments[0]; MS.review.resolve(c.id);
      await MS.api.run('presenter_notes', { tab: 'Claims', text: 'Start with the trend.' });
      const r = await MS.api.run('presenter_notes', {});
      const all = await MS.api.run('presenter_notes', { from_comments: 'off', tab: 'Overview' });
      return { r, all, tab: c.tab };
    });
    const ov = nt.r.tabs.filter(t => t.tab === 'Overview')[0] || {}, cl = nt.r.tabs.filter(t => t.tab === 'Claims')[0] || {};
    check('notes: resolved comments become talking points for their tab', /Talking points/.test(ov.notes) && /loss ratio jump/.test(ov.notes) && nt.r.fromComments === 'resolved', nt);
    check('notes: the dashboard\'s own tabs keep speaker notes; comments can be switched off', cl.notes === 'Start with the trend.' && nt.all.tabs[0].notes === '', nt);

    check('editor: no script errors', errors.length === 0, errors);
    await ctx.close();
  }
  await browser.close();
  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('All v7 checks passed');
})().catch(e => { console.error(e); process.exit(1); });
