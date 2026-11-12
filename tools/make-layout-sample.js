#!/usr/bin/env node
/*
 * Development only (needs Node.js and the dev dependency Playwright; users never run this).
 *   node tools/make-layout-sample.js && node tools/build.js
 * Rebuilds samples/src/claims-risk-review.html: a dashboard made entirely from Insert › Chart layouts on their
 * sample data, by driving the real editor. Run it again after changing src/js/layouts.js.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'samples/src/claims-risk-review.html');
const SOURCE = 'Illustrative sample data';
const AS_OF = '2026-09-30';

const tabs = [
  ['Summary', [['exec-summary', { options: { takeaway: 'So what: West and South bring nearly two thirds of premium, and East is the only region that shrank. Decide whether to fix or exit East before the FY26 plan. The other tabs show why claims cost is rising (bigger claims, not more of them) and which risks stay above appetite.' } }]]],
  ['Claims', [['frequency-severity'], ['lossrun-paid-outstanding'], ['claims-by-cause'], ['large-loss-ranking'], ['incurred-bridge'], ['loss-triangle']]],
  ['Risk register', [['risk-heatmap'], ['risk-inherent-vs-residual'], ['risk-by-category'], ['risk-register-rag']]],
  ['Customers and peers', [['survey-nps'], ['survey-top2box'], ['benchmark-ranked-gap'], ['benchmark-scorecard']]],
  ['Performance', [['cagr-columns'], ['mix-100'], ['line-target'], ['variance-vs-plan'], ['ranked-highlight'], ['distribution']]]
];

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root, 'mothership.html')).href);
  await page.waitForFunction(() => window.MS && MS.api && MS.api.run);
  const api = (n, a) => page.evaluate(([n, a]) => MS.api.run(n, a).then(x => JSON.parse(JSON.stringify(x === undefined ? null : x))), [n, a || {}]);
  await api('new_dashboard', { title: 'Claims and risk review', tabs: true, force: true });
  await page.waitForFunction(() => MS.rt() && MS.child);
  const first = (await api('outline')).tabs.map(t => t.title);
  for (const [i, [tab, items]] of tabs.entries()) {
    await api('add_tab', { title: tab, kind: 'grid', index: i });
    if (i === 0 && first.length) await api('delete_tab', { tab: first[0] });
    await api('show_tab', { tab });
    for (const [id, extra] of items) {
      const r = await api('chart_layouts', Object.assign({ action: 'insert', layout: id, sample: true, source: SOURCE, as_of: AS_OF }, extra || {}));
      if (r.issues.length) throw new Error(id + ': ' + r.issues.join('; '));
      console.log('  ' + tab.padEnd(20) + id.padEnd(28) + r.title);
    }
  }
  await api('show_tab', { tab: 'Summary' });
  await page.waitForTimeout(800);
  const html = await page.evaluate(() => { MS.dirty = false; return MS.exportHtml(); });
  if (errors.length) throw new Error(errors.join('\n'));
  fs.writeFileSync(out, html);
  console.log('sample   ' + path.relative(root, out) + ' ' + (html.length / 1024).toFixed(0) + ' KB');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
