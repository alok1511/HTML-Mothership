#!/usr/bin/env node
/*
 * Checks for the v3 features: Mothership's own theme, line icons, Ctrl+K search,
 * the prompt builder (names tab, section and chart; adapts to scope and assistant),
 * KPI status colours, and the MCP / FAQ help.
 *   node tests/v3.test.js      (CHROMIUM_PATH as for smoke.test.js)
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + JSON.stringify(detail).slice(0, 600))); if (!ok) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const target of ['mothership.html', 'dist/mothership-standalone.html']) {
    console.log('Editor: ' + target);
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, target));

    /* theme */
    const th = await page.evaluate(() => {
      const root = document.documentElement, css = () => getComputedStyle(root);
      const before = css().getPropertyValue('--accent').trim();
      MS.ui.set({ mode: 'dark', accent: 'teal' });
      const dark = { mode: root.getAttribute('data-ms-mode'), bg: getComputedStyle(document.body).backgroundColor, accent: css().getPropertyValue('--accent').trim() };
      MS.ui.toggleDark();
      const light = root.getAttribute('data-ms-mode');
      MS.ui.set(MS.ui.DEFAULT || { mode: 'light', accent: 'indigo' });
      return { before, dark, light, saved: !!MS.prefs.get('ui') };
    });
    check('theme: dark mode and accent apply', th.dark.mode === 'dark' && th.dark.accent && th.dark.accent !== th.before, th);
    check('theme: dark mode toggles back', th.light === 'light', th);
    check('theme: saved in this browser', th.saved, th);

    const dlg = await page.evaluate(() => { MS.ui.dialog(); const n = document.querySelectorAll('.th-card').length; document.querySelector('.dlg-wrap').remove(); return n; });
    check('theme: dialog offers ready-made looks', dlg >= 6, dlg);

    /* icons */
    const ic = await page.evaluate(() => ({ ribbon: document.querySelectorAll('#ribbon svg.ic').length, has: MS.icon.has('sparkles') }));
    check('icons: ribbon uses line icons', ic.ribbon > 10 && ic.has, ic);

    await page.evaluate(() => MS.samples.open('sales'));
    await wait(2500);

    /* Ctrl+K search */
    await page.keyboard.press('Control+k');
    await wait(150);
    const firstChart = await page.evaluate(() => MS.charts.nameOf(MS.rt().charts()[0].key));
    await page.keyboard.type(firstChart.slice(0, 10));
    await wait(150);
    const pal = await page.evaluate(() => ({ open: !!document.querySelector('.cmdk-list'), items: Array.from(document.querySelectorAll('.cmdk-item')).map(e => e.textContent).slice(0, 6) }));
    check('search: Ctrl+K opens and finds a chart', pal.open && pal.items.some(t => t.indexOf(firstChart.slice(0, 10)) >= 0), { firstChart, pal });
    await page.keyboard.press('Escape');

    /* KPI status colours */
    const kpi = await page.evaluate(async () => {
      const rt = MS.rt();
      MS.history.state('ds', s => { s.datasets.sales = { expr: 'salesData' }; });
      const num = rt.fields('sales').find(f => f.numeric).name;
      const r = await MS.api.run('insert_kpis', { cards: [{ label: 'Total', dataset: 'sales', measure: num, agg: 'sum', format: 'cr' }] });
      const total = rt.aggregate(rt.filteredRows('sales'), num, 'sum');
      const ref = r.cards[0];
      const g = await MS.api.run('kpi_status', { ref, better: 'high', good: total - 1, bad: total - 2 });
      const b = await MS.api.run('kpi_status', { ref, better: 'high', good: total * 3, bad: total * 2 });
      const a = await MS.api.run('kpi_status', { ref, better: 'high', good: total * 2, bad: total / 2 });
      const off = await MS.api.run('kpi_status', { ref, better: '' });
      const st = x => (x.result || x).status;
      return { g: st(g), b: st(b), a: st(a), off: st(off), raw: g };
    });
    check('KPI status: green, red and amber', kpi.g === 'good' && kpi.b === 'bad' && kpi.a === 'warn', kpi);
    check('KPI status: can be removed', kpi.off === null, kpi);

    /* prompt builder */
    const pr = await page.evaluate(async () => {
      const rt = MS.rt();
      const h = rt.charts()[0].el, chart = MS.charts.nameOf(rt.charts()[0].key);
      await MS.api.run('add_comment', { chart, text: 'Use the same region order on every chart', priority: 'must' });
      await MS.api.run('add_comment', { ref: 'h1', text: 'Shorter title please', priority: 'nice' });
      const all = MS.review.buildPrompt({ assistant: 'chat', goal: 'apply', output: 'file' });
      const mcp = MS.review.buildPrompt({ assistant: 'mcp', scope: 'must' });
      const plan = MS.review.buildPrompt({ assistant: 'chat', output: 'plan', goal: 'review' });
      const loc = MS.review.locate(h);
      return { chart, all, mcp, plan, trail: MS.review.trail(loc), n: MS.review.list().length };
    });
    check('prompt: comments stored with a location', pr.n >= 2 && pr.trail.indexOf(pr.chart) >= 0, { trail: pr.trail, chart: pr.chart, n: pr.n });
    check('prompt: names the chart and numbers each comment', pr.all.indexOf(pr.chart) >= 0 && pr.all.indexOf('#### 1.') >= 0 && pr.all.indexOf('#### 2.') >= 0, pr.all.slice(0, 600));
    check('prompt: says what "done" looks like', /Done when/.test(pr.all), pr.all.slice(0, 600));
    check('prompt: "must" scope leaves out nice-to-haves', pr.mcp.indexOf('Shorter title please') < 0 && pr.mcp.indexOf('Use the same region order') >= 0, pr.mcp.slice(0, 600));
    check('prompt: MCP version names the tools', /open_file/.test(pr.mcp) && /export_html/.test(pr.mcp), pr.mcp.slice(-600));
    check('prompt: changes with the output asked for', pr.plan !== pr.all && pr.plan.length > 200, pr.plan.slice(0, 300));

    const pb = await page.evaluate(() => { MS.review.prompt(); const ok = !!document.querySelector('.pb-out, .prompt-out'); const v = (document.querySelector('.prompt-out') || {}).value || ''; document.querySelector('.dlg-wrap').remove(); return { ok, len: v.length }; });
    check('prompt: builder dialog shows a live preview', pb.ok && pb.len > 200, pb);

    /* help */
    const hp = await page.evaluate(() => {
      const out = {};
      ['mcp', 'faq', 'theme'].forEach(id => { MS.help.guide(id); const b = document.querySelector('.guide-body'); out[id] = b ? b.textContent : ''; document.querySelector('.dlg-wrap').remove(); });
      return out;
    });
    check('help: MCP section covers Python', /mothership_mcp\.py/.test(hp.mcp) && /Claude Desktop/.test(hp.mcp), hp.mcp.slice(0, 300));
    check('help: FAQ answers office questions', /RemoteDebuggingAllowed/.test(hp.faq) && /Python/.test(hp.faq), hp.faq.slice(0, 300));
    check('help: theme section explains Ctrl+K', /Ctrl/.test(hp.theme) && /K/.test(hp.theme), hp.theme.slice(0, 300));

    check('editor: no script errors', errors.length === 0, errors);
    await page.close();
  }
  await browser.close();
  console.log(failures ? failures + ' check(s) failed' : 'All v3 checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
