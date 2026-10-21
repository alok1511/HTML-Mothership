#!/usr/bin/env node
/*
 * End-to-end smoke test (developer tool, not needed to use Mothership).
 *   npm install         (installs Playwright)
 *   npm test
 * Set CHROMIUM_PATH to use an existing Chromium/Chrome instead of Playwright's download.
 * Opens mothership.html from file:// (exactly how it is used on a locked-down laptop),
 * edits each sample dashboard, exports it, and checks the export works without Mothership.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'mothership.html');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mothership-'));
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + JSON.stringify(detail))); if (!ok) failures++; };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  await page.goto(URL);
  for (const sample of ['sales', 'ops', 'risk']) {
    console.log('Sample: ' + sample);
    await page.evaluate(id => MS.samples.open(id), sample);
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => {
      const rt = MS.rt(), out = {};
      out.charts = rt.charts().length;
      const ds = rt.discoverDatasets()[0];
      out.dataset = ds && ds.expr;
      MS.tabs.ensureLayout();
      MS.blocks.wrapAll();
      out.blocks = MS.child.doc.querySelectorAll('.ms-block').length;
      const rows = rt.discoverDatasets()[0];
      const numeric = rows.fields.find(f => typeof (0, MS.child.win.eval)(rows.expr)[0][f] === 'number');
      MS.history.state('bind', s => {
        s.datasets.d = { expr: rows.expr };
        s.charts[rt.charts()[0].key] = { tooltip: '{label}: {value:inr}', binding: { dataset: 'd', levels: [rows.fields[0], rows.fields[1]], measure: numeric, agg: 'sum' } };
        s.filters = [{ dataset: 'd', field: rows.fields[0] }];
      });
      MS.brand.apply(MS.brand.normalize({ name: 'Test', colors: { primary: '#0b3d91' }, palette: ['#0b3d91', '#f2a900', '#00a19a'] }));
      const tab = MS.tabs.add('Copies', 'grid');
      MS.blocks.sendToTab(MS.child.doc.querySelectorAll('.ms-block')[1], tab, true);
      MS.tabs.add('FAQ', 'content', '<h1>FAQ</h1><p>Hello</p>');
      out.tabs = rt.tabs().length;
      const n = rt.tabs().length; MS.history.undo(); out.undo = rt.tabs().length === n - 1; MS.history.redo();
      out.html = MS.exportHtml();
      return out;
    });
    check('charts detected', r.charts > 0, r.charts);
    check('dataset discovered', !!r.dataset, r.dataset);
    check('every chart wrapped with commentary', r.blocks === r.charts, r);
    check('tabs added', r.tabs === 3, r.tabs);
    check('undo/redo', r.undo, r.undo);
    const file = path.join(TMP, sample + '.html');
    fs.writeFileSync(file, r.html);
    const p2 = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    const expErrors = []; p2.on('pageerror', e => expErrors.push(e.message));
    await p2.goto('file://' + file);
    await p2.waitForTimeout(2500);
    const e = await p2.evaluate(() => {
      const rt = window.__MS_RT;
      const out = { tabs: rt.tabs().map(t => t.title), charts: rt.charts().length, filters: document.querySelectorAll('#ms-filter-pane select').length, junk: document.querySelectorAll('[data-ms-editor],.ms-sel,.ms-grip,[contenteditable]').length };
      const c = rt.charts()[0], first = rt.chartInfo(c.key).labels[0];
      rt.drill[c.key] = [{ field: rt.state.charts[c.key].binding.levels[0], value: String(first) }]; rt.refresh();
      out.drilled = rt.chartInfo(c.key).labels.length > 0 && document.querySelector('.ms-crumbs').textContent.indexOf(String(first)) >= 0;
      rt.showTab(rt.tabs()[1].id);
      return out;
    });
    await p2.waitForTimeout(800);
    const copies = await p2.evaluate(() => window.__MS_RT.charts().length);
    check('export: tabs', e.tabs.join() === 'Dashboard,Copies,FAQ', e.tabs);
    check('export: charts render', e.charts === r.charts, e);
    check('export: copied chart renders on its tab', copies === r.charts + 1, copies);
    check('export: filter pane', e.filters === 1, e.filters);
    check('export: drill-down', e.drilled, e);
    check('export: no editor leftovers', e.junk === 0, e.junk);
    check('export: no script errors', expErrors.length === 0, expErrors);
    await p2.close();
  }
  check('editor: no script errors', errors.length === 0, errors);
  await browser.close();
  console.log(failures ? failures + ' check(s) failed' : 'All checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
