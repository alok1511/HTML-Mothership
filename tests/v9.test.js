#!/usr/bin/env node
/*
 * Checks for v3.6: moving charts and KPI cards with the mouse (drop marker, copy with Ctrl,
 * undo), the floating toolbar, shapes drawn on charts (growth arrow with CAGR, difference
 * bracket, arrows, boxes, callouts) and that they survive export, copying a chart as a picture,
 * the Consulting and Testing tabs, and the testing module (draft, run, record, test document,
 * Excel, AI prompt, ui_* tools).
 *   node tests/v9.test.js      (CHROMIUM_PATH as for smoke.test.js; V9_ONLY=mothership.html for one editor)
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
const SALES = fs.readFileSync(path.join(ROOT, 'samples/sales-dashboard.html'), 'utf8');

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const target of (process.env.V9_ONLY ? [process.env.V9_ONLY] : ['mothership.html', 'dist/mothership-standalone.html'])) {
    console.log('Editor: ' + target);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, target));
    const open = async (html, name) => { await page.evaluate(([h, n]) => { MS.dirty = false; return MS.openHtml(h, n); }, [html, name]); await wait(2000); };
    const canvases = () => page.evaluate(() => [...MS.child.doc.querySelectorAll('canvas')].map(c => c.id).join(','));
    // a point in the dashboard, in the editor window's coordinates
    const at = async (sel, dx, dy) => page.evaluate(([s, dx, dy]) => {
      const e = MS.child.doc.querySelector(s), r = e.getBoundingClientRect(), f = MS.$('#stage-frame-host iframe').getBoundingClientRect(), k = MS.view.scale;
      return { x: f.left + (r.left + (dx == null ? r.width / 2 : dx)) * k, y: f.top + (r.top + (dy == null ? r.height / 2 : dy)) * k };
    }, [sel, dx, dy]);

    /* ---------------- drag a chart with the mouse, like PowerPoint */
    await open(SALES, 'sales.html');
    const before = await canvases();
    const a = await at('#regionChart'), b = await at('#channelChart');
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(a.x + 20, a.y + 10, { steps: 3 });
    await page.mouse.move(b.x + 80, b.y, { steps: 12 });
    await wait(150);
    const mid = await page.evaluate(() => { const d = MS.child.doc, on = s => { const e = d.querySelector(s); return !!(e && e.style.display !== 'none' && e.getBoundingClientRect().width); }; return { dragging: !!MS.move.active(), bar: on('.ms-drop-bar') || on('.ms-drop-box'), ghost: on('.ms-drop-ghost') }; });
    check('drag: shows where the chart will land while dragging', mid.dragging && mid.bar && mid.ghost, mid);
    await page.mouse.up(); await wait(600);
    const after = await canvases();
    check('drag: the chart moves to where it is dropped', after !== before && after.split(',').pop() === 'regionChart', { before, after });
    await page.evaluate(() => MS.history.undo()); await wait(400);
    check('drag: one undo puts it back', await canvases() === before, await canvases());
    // Ctrl held: copy
    await page.keyboard.down('Control');
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(a.x + 20, a.y + 10, { steps: 3 });
    await page.mouse.move(b.x + 80, b.y, { steps: 12 });
    await page.mouse.up(); await page.keyboard.up('Control'); await wait(900);
    const copied = await page.evaluate(() => ({ canvases: MS.child.doc.querySelectorAll('canvas').length, charts: MS.rt().charts().length }));
    check('drag with Ctrl: copies the chart (a working chart)', copied.canvases === 5 && copied.charts === 5, copied);
    await page.evaluate(() => MS.history.undo()); await wait(400);
    // Esc cancels
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(b.x + 80, b.y, { steps: 10 });
    await page.keyboard.press('Escape');
    await page.mouse.up(); await wait(300);
    check('drag: Esc cancels', await canvases() === before && !(await page.evaluate(() => MS.move.active())), await canvases());
    // a KPI card
    const kpis = () => page.evaluate(() => [...MS.child.doc.querySelectorAll('.kpi .label')].map(x => x.textContent.trim()).join(','));
    await page.evaluate(() => { MS.edit.select(null); MS.child.win.scrollTo(0, 0); }); await wait(150);
    const k0 = await kpis();
    const ka = await at('.kpi:nth-child(1)', 20, 20), kb = await at('.kpi:nth-child(3)');
    await page.mouse.move(ka.x, ka.y); await page.mouse.down();
    await page.mouse.move(ka.x + 15, ka.y, { steps: 3 });
    await page.mouse.move(kb.x + 40, kb.y, { steps: 10 });
    await page.mouse.up(); await wait(500);
    const k1 = await kpis();
    check('drag: a KPI card moves along its row', k1 !== k0 && k1.split(',').length === k0.split(',').length && k1.indexOf(k0.split(',')[0]) > 0, { k0, k1 });
    await page.evaluate(() => MS.history.undo()); await wait(300);
    // the API does the same
    const api = await page.evaluate(async () => {
      await MS.api.run('move_element', { ref: 'Profit by channel', before: 'Sales by region' });
      const o1 = [...MS.child.doc.querySelectorAll('canvas')].map(c => c.id)[0];
      MS.history.undo();
      return { o1, back: [...MS.child.doc.querySelectorAll('canvas')].map(c => c.id)[0] };
    });
    check('move_element: by chart name, and undo', api.o1 === 'channelChart' && api.back === 'regionChart', api);

    /* ---------------- floating toolbar */
    await page.evaluate(() => { const c = MS.rt().charts()[0]; MS.edit.select(MS.clipboard.unitOf(c.el)); }); await wait(300);
    const mb = await page.evaluate(() => { const b = MS.child.doc.getElementById('ms-minibar'); return b && { shown: b.style.display !== 'none' && b.offsetWidth > 0, name: (b.querySelector('.ms-mb-name') || {}).textContent, buttons: b.querySelectorAll('button').length, editor: b.hasAttribute('data-ms-editor') }; });
    check('floating toolbar: shows over a selected chart with its name and tools', mb && mb.shown && mb.name === 'Sales by region' && mb.buttons >= 6 && mb.editor, mb);

    /* ---------------- shapes on charts */
    const sh = await page.evaluate(async () => {
      const k = MS.rt().charts()[0].key, t = MS.rt().charts()[1].key;
      const g = await MS.api.run('chart_shapes', { action: 'add', chart: 'Sales by region', kind: 'cagr', a: { label: 'North' }, b: { label: 'South' }, periods: 2 });
      const d = await MS.api.run('chart_shapes', { action: 'add', chart: 'Sales by region', kind: 'delta', a: { label: 'South' }, b: { label: 'East' } });
      MS.shapes.add({ chart: t, kind: 'callout', a: { fx: 0.6, fy: 0.8 }, b: { fx: 0.4, fy: 0.5 }, text: 'Festive dip' });
      MS.shapes.add({ chart: t, kind: 'rect', a: { fx: 0.5, fy: 0.5 }, b: { fx: 0.7, fy: 0.9 } });
      await new Promise(r => setTimeout(r, 300));
      const doc = MS.child.doc;
      return { g: g.label, d: d.label, svg: doc.querySelectorAll('.ms-shape-svg').length, txt: [...doc.querySelectorAll('.ms-shape-txt')].map(x => x.textContent.trim()), n: MS.shapes.list().length };
    });
    const vals = [233047977, 294919722, 317867577, 159471868];
    const cagr = Math.pow(vals[2] / vals[0], 1 / 2) - 1;
    check('shapes: the growth arrow is labelled with the right CAGR', sh.g && sh.g.indexOf((cagr * 100).toFixed(1)) >= 0 && /CAGR/.test(sh.g), { label: sh.g, expected: (cagr * 100).toFixed(1) });
    check('shapes: the difference bracket shows the change and the %', sh.d && /[-−]/.test(sh.d) && /%/.test(sh.d) && sh.d.indexOf(((1 - vals[3] / vals[2]) * 100).toFixed(1)) >= 0, sh.d);
    check('shapes: drawn on the charts (lines and text)', sh.n === 4 && sh.svg >= 2 && sh.txt.some(t => /Festive dip/.test(t)), sh);
    // draw with the mouse: arrow tool
    await page.evaluate(() => MS.shapes.start('arrow', MS.rt().charts()[0].key)); await wait(100);
    const p1 = await at('#regionChart', 60, 60), p2 = await at('#regionChart', 200, 120);
    await page.mouse.move(p1.x, p1.y); await page.mouse.down(); await page.mouse.move(p2.x, p2.y, { steps: 8 }); await page.mouse.up(); await wait(300);
    const drawn = await page.evaluate(() => { const l = MS.shapes.list(); const s = l[l.length - 1]; return { n: l.length, kind: s.kind, a: s.a, b: s.b, tool: MS.shapes.tool }; });
    check('shapes: drag on the chart draws an arrow where the mouse went', drawn.n === 5 && drawn.kind === 'arrow' && drawn.a.fx < drawn.b.fx && drawn.a.fy < drawn.b.fy, drawn);
    const ex = await page.evaluate(() => MS.exportHtml());
    const vp = await ctx.newPage(); const verr = []; vp.on('pageerror', e => verr.push(e.message));
    await vp.setContent(ex); await wait(1500);
    const vshapes = await vp.evaluate(() => ({ svg: document.querySelectorAll('.ms-shape-svg').length, txt: [...document.querySelectorAll('.ms-shape-txt')].map(x => x.textContent.trim()).join(' | ') }));
    check('shapes: stay on the charts in the exported file', vshapes.svg >= 2 && /CAGR/.test(vshapes.txt) && /Festive dip/.test(vshapes.txt) && !verr.length, { vshapes, verr });
    await vp.close();
    await page.evaluate(() => MS.history.undo());
    check('shapes: undo removes the last one', await page.evaluate(() => MS.shapes.list().length) === 4, await page.evaluate(() => MS.shapes.list().length));

    /* ---------------- copy as picture */
    const pic = await page.evaluate(async () => {
      const p = await MS.api.run('chart_picture', { chart: 'Sales by region' });
      await MS.picture.copy(MS.rt().charts()[1].key);
      let types = []; try { types = (await navigator.clipboard.read()).map(i => i.types.join(',')); } catch (e) { types = ['read failed: ' + e.message]; }
      return { name: p.name, w: p.width, png: /^data:image\/png/.test(p.dataUrl), size: p.dataUrl.length, types };
    });
    check('picture: a PNG of the chart card with its title and shapes', pic.png && pic.w > 300 && pic.size > 20000 && pic.name === 'Sales by region', pic);
    check('picture: Copy as picture puts a PNG on the clipboard', pic.types.some(t => /image\/png/.test(t)), pic.types);
    const menu = await page.evaluate(() => MS.clipboard.menuItems().filter(x => x && x.label).map(x => x.label));
    check('picture: in the right-click menu', menu.some(l => /Copy as picture/.test(l)) && menu.some(l => /Save as picture/.test(l)), menu);

    /* ---------------- ribbon: Consulting and Testing tabs */
    const rib = await page.evaluate(() => { const tabs = [...document.querySelectorAll('.rtab')].map(t => t.textContent.trim()); const out = { tabs }; [...document.querySelectorAll('.rtab')].find(t => t.textContent.trim() === 'Consulting').click(); out.consult = [...document.querySelectorAll('.rbtn .rl')].map(x => x.textContent.trim()); [...document.querySelectorAll('.rtab')].find(t => t.textContent.trim() === 'Testing').click(); out.testing = [...document.querySelectorAll('.rbtn .rl')].map(x => x.textContent.trim()); return out; });
    check('ribbon: a Consulting tab with firm, drawing, notes, story, quality and delivery tools', rib.tabs.includes('Consulting') && ['Firm template', 'Growth (CAGR)', 'Difference', 'Callout', 'Annotate', 'Storyline', 'Colour-blind', 'PowerPoint', 'Copy picture'].every(l => rib.consult.includes(l)), rib.consult);
    check('ribbon: a Testing tab', rib.tabs.includes('Testing') && ['Test cases', 'Draft tests', 'Run all', 'Test document', 'AI tester'].every(l => rib.testing.includes(l)), rib.testing);

    /* ---------------- the testing module */
    await page.evaluate(() => MS.shapes.clear());
    const qa = await page.evaluate(async () => {
      const n = MS.qa.draft();
      const cases = MS.qa.cases();
      const res = await MS.qa.run(['TC-001', 'TC-002', 'TC-004']);
      MS.qa.record('TC-003', { status: 'Fail', actual: 'North shows 233M; finance says 235M', notes: 'Major', by: 'Tester' });
      const doc = MS.qa.document();
      const xl = await MS.qa.xlsx();
      return { n, scen: [...new Set(cases.map(c => c.scenario))], res: res.map(r => r.id + ':' + r.status), doc, xl: xl.byteLength, json: MS.qa.json().cases.length, prompt: MS.qa.prompt({ mcp: true }), steps: MS.qa.parseSteps('click | chart=Sales @ North\nexpect_text | kpi=Revenue | $1.2M\nlook at the colours') };
    });
    check('testing: drafts cases from the dashboard (charts, KPI cards, screen sizes, accessibility, export)', qa.n >= 20 && ['Opens cleanly', 'Charts', 'KPI cards', 'Screen sizes', 'Accessibility', 'Export'].every(s => qa.scen.includes(s)), qa.scen);
    check('testing: runs automatic cases (errors, charts drawn, pop-up on hover)', qa.res.join() === 'TC-001:Pass,TC-002:Pass,TC-004:Pass', qa.res);
    check('testing: the document has every section, the results and the defect log', ['## 1. Purpose and scope', '## 3. Approach', '## 4. Test cases', '## 5. Steps and expected results', '## 6. Traceability', '## 7. Running these tests with an AI assistant', '## 8. Defect log', '## 9. Sign-off'].every(h => qa.doc.includes(h)) && /finance says 235M/.test(qa.doc) && /\| 1 \| TC-003 \|/.test(qa.doc), qa.doc.slice(0, 300));
    check('testing: Excel workbook and JSON', qa.xl > 5000 && qa.json === qa.n, { xl: qa.xl, json: qa.json });
    check('testing: a prompt for an AI tester with the MCP steps', /ui_snapshot/.test(qa.prompt) && /test_record/.test(qa.prompt) && /## 4\. Test cases/.test(qa.prompt), qa.prompt.slice(0, 300));
    check('testing: steps written as "step | target @ point | value"', qa.steps[0].do === 'click' && qa.steps[0].target === 'chart=Sales' && qa.steps[0].point === 'North' && qa.steps[1].value === '$1.2M' && qa.steps[2].do === 'manual', qa.steps);
    const ui = await page.evaluate(async () => {
      const out = {};
      out.snap = await MS.api.run('ui_snapshot', {});
      out.hover = await MS.api.run('ui_hover', { target: 'chart=Monthly sales trend', point: 'Sep' });
      out.expect = await MS.api.run('ui_expect', { target: 'kpi=Margin', text: '16.1%' });
      out.bad = await MS.api.run('ui_expect', { target: 'kpi=Margin', text: '99%' });
      out.read = await MS.api.run('ui_read', { target: 'chart=Profit by channel' });
      out.miss = await MS.api.run('ui_click', { target: 'button=Nope' }).then(() => 'no error', e => e.message);
      out.errs = await MS.api.run('ui_errors', {});
      MS.child.doc.querySelector('#channelChart').scrollIntoView(); await new Promise(r => setTimeout(r, 100));
      out.hostScroll = MS.$('#stage-frame-host').scrollTop;
      return out;
    });
    check('ui_snapshot: tabs, KPI cards and charts with refs', ui.snap.kpis.length === 4 && ui.snap.charts.length === 4 && ui.snap.charts[0].labels.length === 4, ui.snap);
    check('ui_hover: a line chart point shows its pop-up', ui.hover.tooltip && /Sep/.test(ui.hover.tooltip[0].text), ui.hover);
    check('ui_expect: passes and fails with what it saw', ui.expect.pass === true && ui.bad.pass === false && /16\.1%/.test(ui.bad.actual), [ui.expect, ui.bad]);
    check('ui_read: a chart gives its series and totals', ui.read.chart && ui.read.chart.series[0].total > 0 && ui.read.chart.labels.join() === 'Online,Retail', ui.read.chart);
    check('ui_click: a target that is not there is a clear error', /No|not|find/i.test(ui.miss), ui.miss);
    check('the stage stays put when the dashboard scrolls a part into view', ui.hostScroll === 0, ui.hostScroll);
    check('ui_errors: none on the sample', ui.errs.scriptErrors.length === 0 && ui.errs.consoleErrors.length === 0, ui.errs);
    // tabs and filters
    await open(pages.owntabs(), 'tabs.html');
    const tq = await page.evaluate(async () => {
      const t = await MS.api.run('ui_tab', { name: 'Claims' });
      const vis = await MS.api.run('ui_expect', { target: 'chart=Claims trend', chart_drawn: true });
      const n = MS.qa.draft({ replace: true });
      const nav = MS.qa.cases().filter(c => c.scenario === 'Navigation').map(c => c.id);
      const res = await MS.qa.run(nav);
      return { t, vis, n, res: res.map(r => r.status) };
    });
    check('ui_tab: opens the dashboard\'s own tab; its chart is drawn', tq.t.tab === 'Claims' && tq.vis.pass, tq);
    check('testing: one navigation case per tab, all pass', tq.res.length === 3 && tq.res.every(s => s === 'Pass'), tq.res);

    check('no script errors in the editor', errors.length === 0, errors);
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? '\n' + failures + ' check(s) failed' : '\nAll v3.6 checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
