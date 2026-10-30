#!/usr/bin/env node
/*
 * Checks for v3.8: full-coverage testing. Quick and full drafts, the coverage report, expected
 * numbers (lock in, Excel / CSV import, rows, Excel download), and the deep steps: every point's
 * pop-up, every drop-down choice, check boxes, buttons, table totals and sorting, every tab at
 * three widths, and each case only answering for the errors raised while it ran.
 *   node tests/v11.test.js      (CHROMIUM_PATH as for smoke.test.js; V11_ONLY=mothership.html for one editor)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const pages = require('./fixtures/pages');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + JSON.stringify(detail).slice(0, 900))); if (!ok) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const SALES = fs.readFileSync(path.join(ROOT, 'samples/sales-dashboard.html'), 'utf8');

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const target of (process.env.V11_ONLY ? [process.env.V11_ONLY] : ['mothership.html', 'dist/mothership-standalone.html'])) {
    console.log('Editor: ' + target);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, target));
    const open = async (html, name) => { await page.evaluate(([h, n]) => { MS.dirty = false; return MS.openHtml(h, n); }, [html, name]); await wait(2000); };

    /* ---------------- quick vs full draft on a dashboard with its own controls */
    await open(pages.interactive(), 'interactive.html');
    const d = await page.evaluate(() => {
      const quick = MS.qa.draft(), c0 = MS.qa.deep.coverage();
      const full = MS.qa.draft({ depth: 'full' }), c1 = MS.qa.deep.coverage();
      return { quick, full, p0: c0.percent, un0: c0.untested, p1: c1.percent, un1: c1.untested, parts: c1.rows.map(r => r.kind + ':' + r.name), titles: MS.qa.cases().map(c => c.title) };
    });
    check('quick draft leaves parts untested and says so', d.quick > 5 && d.p0 < 60 && d.un0.some(u => /Region/.test(u)) && d.un0.some(u => /Show target/.test(u)), d);
    check('full draft adds cases and covers every part', d.full >= 5 && d.p1 === 100 && d.un1.length === 0, d);
    check('coverage finds the drop-down, check box, button, table, chart and KPI card', ['Drop-down:Region', 'Check box:Show target', 'Button:Reset', 'Table:Table 1'].every(x => d.parts.includes(x)) && d.parts.some(x => /^Chart:/.test(x)) && d.parts.some(x => /^KPI card:/.test(x)), d.parts);
    check('full draft titles: every point, every choice, totals, every width', ['Every point on', 'Every choice in', 'totals add up', 'fits at 390'].every(t => d.titles.some(x => x.indexOf(t) >= 0)), d.titles);
    const again = await page.evaluate(() => MS.qa.draft({ depth: 'full' }));
    check('a second full draft adds nothing new', again === 0, again);

    /* ---------------- run: each deliberate fault is caught, nothing else */
    const run = await page.evaluate(async () => {
      await MS.qa.run(MS.qa.cases().filter(c => c.auto).map(c => c.id));
      const by = t => MS.qa.cases().filter(c => c.title.indexOf(t) >= 0)[0] || {};
      return {
        points: by('Every point on'), options: by('Every choice in'), table: by('totals add up'), target: by('Show target'),
        phone: by('fits at 390'), laptop: by('fits at 1366'),
        failed: MS.qa.failed().map(c => c.title)
      };
    });
    check('every point: the wrong pop-up for East is caught', run.points.status === 'Fail' && /East: expected 20, the pop-up says .*40/.test(run.points.actual) && /1 of 4 points wrong/.test(run.points.actual), run.points);
    check('every choice: the broken choice is caught (script error, nothing changed), the others pass', run.options.status === 'Fail' && /1 of 3 choices/.test(run.options.actual) && /“Broken”: 1 script error/.test(run.options.actual) && /nothing changed/.test(run.options.actual), run.options);
    check('table: the wrong total is caught', run.table.status === 'Fail' && /total shows 110, the rows add up to 100/.test(run.table.actual), run.table);
    check('a later case is not blamed for an earlier case\'s error', run.target.status === 'Pass' && run.laptop.status === 'Pass', { target: run.target, laptop: run.laptop });
    check('phone width: the sideways scroll is caught', run.phone.status === 'Fail' && /wider than the screen/.test(run.phone.actual), run.phone);
    check('nothing else failed', run.failed.every(t => /Every point|Every choice|totals add up|fits at 390|accessibility/.test(t)), run.failed);
    const restored = await page.evaluate(() => ({ region: MS.child.doc.getElementById('region').value, errs: MS.qa.drv.errors().scriptErrors.length }));
    check('the drop-down is set back to its first choice afterwards', restored.region === 'all', restored);

    /* ---------------- sorting, on its own */
    const sort = await page.evaluate(async () => {
      const c = MS.qa.add({ title: 'Sorting works', type: 'Interaction', steps: [{ do: 'expect_sort', target: 'css=#t' }] });
      const r = await MS.qa.runCase(c.id); return { status: r.status, note: r.steps.map(s => s.note).join(' ') };
    });
    check('expect_sort: clicking the heading reorders the rows', sort.status === 'Pass', sort);

    /* ---------------- the dialog: chips, draft menu, coverage dialog */
    await page.evaluate(() => MS.qa.dialog()); await wait(400);
    const ui = await page.evaluate(() => ({ chips: MS.$$('.qa-cov-chip').map(c => c.textContent.trim()), draft: [...MS.$$('.qa-tools button')].some(b => /Draft/.test(b.textContent)) }));
    check('test dialog: coverage and numbers chips', ui.chips.some(c => /100% covered/.test(c)) && ui.chips.some(c => /Numbers not locked in/.test(c)) && ui.draft, ui);
    await page.evaluate(() => MS.$$('.qa-cov-chip')[0].click()); await wait(400);
    const cd = await page.evaluate(() => ({ title: MS.$$('.dlg-head strong').pop().textContent, rows: MS.$$('.qa-cov-row').length, tags: MS.$$('.qa-cov-row .qa-cov-tag').map(t => t.textContent) }));
    check('coverage dialog: one row per part, each tagged', /Test coverage/.test(cd.title) && cd.rows === d.parts.length && cd.tags.every(t => t === 'fully'), cd);
    await page.evaluate(() => MS.$$('.dlg-x').forEach(x => x.click())); await wait(200);
    const dm = await page.evaluate(() => MS.qa.deep.draftMenu().filter(Boolean).map(i => i.label));
    check('Draft menu: Quick draft, Full draft, Expected numbers, Coverage report', ['Quick draft', 'Full draft: test everything', 'Expected numbers', 'Coverage report'].every(l => dm.includes(l)), dm);
    const md = await page.evaluate(() => MS.qa.document());
    check('the test document has a Coverage section', /### Coverage/.test(md) && /\| Drop-down \| Region \| fully \|/.test(md), md.slice(md.indexOf('### Coverage'), md.indexOf('### Coverage') + 500));

    /* ---------------- expected numbers on a sample dashboard */
    await open(SALES, 'sales.html');
    const nb = await page.evaluate(async () => {
      MS.qa.draft();
      const lock = await MS.api.run('test_baseline', { action: 'lock' });
      const numCases = MS.qa.cases().filter(c => c.steps.some(s => s.do === 'expect_baseline'));
      const r = await MS.qa.run(numCases.map(c => c.id));
      return { lock, n: numCases.length, kinds: numCases.map(c => c.steps[0].target), res: r.map(x => x.status) };
    });
    check('lock in today\'s numbers: number cases for each chart and KPI card', nb.lock.charts >= 3 && nb.lock.kpis >= 3 && nb.lock.added === nb.n && nb.kinds.some(k => /^kpi=/.test(k)) && nb.kinds.some(k => /^chart=/.test(k)), nb);
    check('the number cases pass straight after locking in', nb.res.length === nb.n && nb.res.every(s => s === 'Pass'), nb.res);

    const imp = await page.evaluate(async () => {
      const rows = await MS.api.run('test_baseline', { action: 'rows' });
      const kpi = rows.filter(r => /^KPI: /.test(r.What))[0], pt = rows.filter(r => !/^KPI: /.test(r.What))[0];
      const res = await MS.api.run('test_baseline', { action: 'import', rows: [
        { What: kpi.What, Value: '$1' },
        { What: pt.What, Category: pt.Category, Series: pt.Series, Value: pt.Value * 2 },
        { What: 'No such chart', Category: 'x', Value: 1 }] });
      const kc = MS.qa.cases().filter(c => c.steps.some(s => s.do === 'expect_baseline' && s.target === 'kpi=' + kpi.What.slice(5)))[0];
      const cc = MS.qa.cases().filter(c => c.steps.some(s => s.do === 'expect_baseline' && s.target === 'chart=' + pt.What))[0];
      const a = await MS.qa.runCase(kc.id), b = await MS.qa.runCase(cc.id);
      return { rows: rows.length, res, kpi: kpi.What, a: a.status, an: a.steps.map(s => s.note).join(' '), b: b.status, bn: b.steps.map(s => s.note).join(' '), from: (await MS.api.run('test_baseline', {})).from };
    });
    check('rows: one per chart value and KPI card', imp.rows > 10, imp.rows);
    check('import: matched rows and the ones not found', imp.res.matched === 2 && imp.res.notFound.length === 1 && /No such chart/.test(imp.res.notFound[0]) && imp.from === 'file', imp.res);
    check('a KPI card that does not match the source file fails, and says so', imp.a === 'Fail' && /expected \$1 \(from your source file\)/.test(imp.an), imp);
    check('a chart value that does not match fails, naming the point', imp.b === 'Fail' && /expected/.test(imp.bn), imp);

    const csv = await page.evaluate(async () => {
      const b = MS.qa.deep.baseline(), k = b.kpis[0];
      const text = 'What,Category,Series,Value\n"KPI: ' + k.label + '",,,"' + k.value.replace(/"/g, '""') + '"\n';
      const res = await MS.qa.deep.importFile(new File([text], 'expected.csv', { type: 'text/csv' }));
      const bytes = await MS.qa.deep.xlsx(), XL = await MS.lib('xlsx');
      const wb = XL.read(new Uint8Array(bytes), { type: 'array' }), first = XL.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      const res2 = await MS.qa.deep.importFile(new File([bytes], 'expected.xlsx'));
      return { res, sheets: wb.SheetNames, head: Object.keys(first[0] || {}), n: first.length, res2 };
    });
    check('CSV import', csv.res.matched === 1 && csv.res.notFound.length === 0, csv.res);
    check('Excel download: Expected numbers and How to use sheets', csv.sheets.join('|') === 'Expected numbers|How to use' && ['What', 'Category', 'Series', 'Value'].every(k => csv.head.includes(k)) && csv.n > 10, csv);
    check('the downloaded Excel imports back cleanly', csv.res2.matched === csv.n && csv.res2.notFound.length === 0, csv.res2);

    const undo = await page.evaluate(() => { MS.qa.deep.clearBaseline(); const gone = !MS.qa.deep.baseline(); MS.history.undo(); return { gone, back: !!MS.qa.deep.baseline() }; });
    check('remove the expected numbers, and undo brings them back', undo.gone && undo.back, undo);

    /* ---------------- API and ribbon */
    const api = await page.evaluate(async () => {
      const cov = await MS.api.run('test_coverage', {});
      const dr = await MS.api.run('test_plan', { action: 'draft', depth: 'full' });
      const cov2 = await MS.api.run('test_coverage', {});
      const tools = MS.api.describe().map(t => t.name);
      return { cov: [cov.percent, cov.parts], dr, cov2: cov2.percent, tools };
    });
    check('API: test_coverage, and test_plan draft with depth full raises it', api.cov[1] > 5 && api.dr.added > 0 && api.dr.coverage && api.cov2 >= api.cov[0] && api.cov2 === api.dr.coverage.percent, api);
    check('API: test_baseline and test_coverage are listed', ['test_baseline', 'test_coverage'].every(t => api.tools.includes(t)), api.tools.filter(t => /^test_/.test(t)));
    const rib = await page.evaluate(() => MS.RIBBON.filter(t => t.tab === 'Testing')[0].groups.reduce((a, g) => a.concat(g.items.map(i => i.label)), []));
    check('Testing tab: Draft tests, Numbers, Coverage', ['Draft tests', 'Numbers', 'Coverage'].every(l => rib.includes(l)), rib);

    const own = errors.filter(e => !/No data for Broken/.test(e)); // the fixture's broken choice throws on purpose
    check('no script errors in the editor', own.length === 0, own);
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? '\n' + failures + ' check(s) failed' : '\nAll v3.8 checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
