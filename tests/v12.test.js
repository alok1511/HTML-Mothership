#!/usr/bin/env node
/* Reliability and self-serve flows. Runs from disk against both distributed editors. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const fixtures = require('./fixtures/pages');
const root = path.resolve(__dirname, '..');
const simple = '<!doctype html><html lang="en"><title>Safe transition</title><body><h1 id="heading">Original</h1><p>Report content.</p></body></html>';
const sample = fs.readFileSync(path.join(root, 'samples/sales-dashboard.html'), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mothership-reliability-'));
const note = label => console.log('  ✓ ' + label);

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    for (const target of process.env.V12_ONLY ? [process.env.V12_ONLY] : ['mothership.html', 'dist/mothership-standalone.html']) {
      console.log('Editor: ' + target);
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await ctx.route('https://example.invalid/**', route => route.abort());
      await page.goto(pathToFileURL(path.join(root, target)).href);
      const open = (html = simple, name = 'safe.html') => page.evaluate(([h, n]) => MS.openHtml(h, n, { force: true }), [html, name]);

      await page.getByRole('button', { name: 'Start here', exact: true }).click();
      await page.getByRole('dialog', { name: 'Dashboard workflow' }).getByRole('button', { name: 'Open practice copy' }).click();
      await page.locator('.coach-text').waitFor();
      assert.match(await page.locator('.coach-text').innerText(), /Double-click.*Sales Performance/);
      await page.getByRole('button', { name: 'Check step', exact: true }).click();
      assert.match(await page.locator('.coach-status').innerText(), /not found/);
      await page.evaluate(() => { const el = MS.child.doc.querySelector('h1'); MS.edit.commitText(el, el.innerHTML, 'Sales performance | Review copy'); });
      await page.getByRole('button', { name: 'Check step', exact: true }).click();
      assert.match(await page.locator('.coach-text').innerText(), /Undo/);
      await page.getByRole('button', { name: 'Close lessons' }).click();
      await page.evaluate(() => MS.help.guide('testing'));
      await page.getByRole('searchbox', { name: 'Search the guide' }).fill('non-numeric measure');
      assert.match(await page.locator('.guide-body').innerText(), /refresh/i);
      await page.keyboard.press('Escape');
      note('start page opens a separate practice copy, checks an edit and searches the guide');

      await open();
      const safe = await page.evaluate(async () => {
        const commit = text => { const e = MS.child.doc.querySelector('h1'); MS.edit.commitText(e, e.innerHTML, text); };
        commit('First edit'); MS.locale.set({ country: 'IN' });
        await MS.cmd.safe();
        const entered = !MS.rt() && MS.dirty && MS.child.doc.querySelector('h1').textContent === 'First edit';
        commit('Edited while safe');
        await MS.cmd.safe();
        const restored = MS.child.doc.querySelector('h1').textContent === 'Edited while safe' && MS.dirty && MS.locale.get().currency === 'INR';
        const checkpoints = (await MS.store.all('versions')).filter(v => /Safe mode/.test(v.value.name)).length;
        return { entered, restored, checkpoints };
      });
      assert.deepEqual(safe, { entered: true, restored: true, checkpoints: 2 });
      note('Safe mode preserves active text, edits made with scripts off, locale, dirty state and checkpoints');

      const replace = () => page.evaluate(() => MS.openFileObj(new File(['<h1>Other dashboard</h1>'], 'other.html')));
      let attempt = replace();
      await page.getByRole('dialog', { name: /Replace "safe.html"/ }).getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(await attempt, false);
      assert.equal(await page.evaluate(() => MS.child.doc.querySelector('h1').textContent), 'Edited while safe');
      const refused = await page.evaluate(() => MS.api.run('new_dashboard', {}).then(() => '', e => e.message));
      assert.match(refused, /unsaved changes/);
      attempt = replace();
      await page.getByRole('button', { name: 'Leave without saving', exact: true }).click();
      assert.equal(await attempt, true);
      assert.equal(await page.evaluate(async () => (await MS.store.all('versions')).some(v => /Recovery before opening/.test(v.value.name) && v.value.html.includes('Edited while safe'))), true);
      note('replacement and automation protect an unsaved document and checkpoint it on explicit leave');

      await open();
      await page.evaluate(() => {
        const e = MS.child.doc.querySelector('h1');
        MS.edit.commitText(e, e.innerHTML, 'Save me');
        window.showSaveFilePicker = () => Promise.reject(new DOMException('Cancelled', 'AbortError'));
      });
      const close = page.evaluate(() => MS.closeDoc());
      await page.getByRole('button', { name: 'Export, then close', exact: true }).click();
      assert.equal(await close, false);
      const saved = await page.evaluate(async () => {
        window.showSaveFilePicker = () => Promise.resolve({ name: 'working.html', createWritable: async () => ({ write: async () => {}, close: async () => {} }) });
        const result = await MS.versions.exportFile(true);
        return { saved: result.saved, open: !!MS.child, dirty: MS.dirty };
      });
      assert.deepEqual(saved, { saved: true, open: true, dirty: false });
      note('cancelled Export, then close cannot close a later successful save');

      const asset = await page.evaluate(async () => {
        const svg = color => '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="' + color + '"/></svg>';
        const main = '<title>Folder test</title><h1>Folder</h1><img id="image" src="a.svg" srcset="b.svg 2x"><div id="count"></div><script>var n=0,x=new XMLHttpRequest();x.open("GET","data.json");x.onload=function(){document.getElementById("count").textContent=++n};x.send();</script>';
        await MS.openFolder([new File([main], 'index.html'), new File([svg('red')], 'a.svg'), new File([svg('blue')], 'b.svg'), new File(['{"x":1}'], 'data.json')], { force: true });
        return MS.exportHtml();
      });
      const file = path.join(tmp, 'standalone.html'); fs.writeFileSync(file, asset);
      const viewer = await ctx.newPage(); await viewer.goto(pathToFileURL(file).href);
      await viewer.waitForFunction(() => document.querySelector('#count').textContent !== '');
      assert.deepEqual(await viewer.evaluate(() => {
        const e = document.querySelector('#image');
        return [document.querySelector('#count').textContent, e.currentSrc.startsWith('data:image/svg+xml'), e.naturalWidth > 0];
      }), ['1', true, true]);
      await viewer.close();
      note('folder export bundles high-density images and fires one XHR load handler from a separate directory');

      await open('<title>Async fixture</title><style>body{background-image:url("https://example.invalid/bg.png")}</style><h1>Async</h1><script>setTimeout(()=>Promise.reject(new Error("deliberate async failure")),100)</script>', 'async.html');
      await page.waitForFunction(() => MS.preflight.errors().some(x => x.includes('deliberate async failure')));
      const validation = await page.evaluate(async () => {
        const report = await MS.preflight.record();
        const refs = MS.workflow.importReport().assets.external;
        return { report, refs, html: MS.exportHtml() };
      });
      assert(validation.refs.includes('https://example.invalid/bg.png'));
      assert(validation.report.checks.some(x => x.status === 'fail' && /async failure/.test(x.detail)));
      assert(validation.report.checks.some(x => x.status === 'warn' && /bg.png/.test(x.detail)));
      assert(!validation.report.offline && /^[0-9a-f]{64}$/.test(validation.report.sha256));
      fs.writeFileSync(file, validation.html);
      const badViewer = await ctx.newPage(); await badViewer.goto(pathToFileURL(file).href);
      await badViewer.getByRole('alert').filter({ hasText: /deliberate async failure/ }).waitFor();
      await badViewer.close();
      note('async errors reach validation and the standalone warning; CSS links do not count as an offline pass');

      await open(simple, 'offline.html');
      const offline = page.evaluate(() => MS.preflight.offlineDialog());
      const offlineDl = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download the copy to test' }).click();
      const checkedCopy = await offlineDl;
      await checkedCopy.saveAs(file);
      const offlineCtx = await browser.newContext({ offline: true });
      const offlinePage = await offlineCtx.newPage();
      await offlinePage.goto(pathToFileURL(file).href);
      assert.equal(await offlinePage.locator('h1').innerText(), 'Original');
      await offlineCtx.close();
      await page.getByRole('checkbox', { name: /I opened this downloaded copy offline/ }).check();
      await page.getByRole('button', { name: 'Record offline pass', exact: true }).click();
      assert.equal(await offline, true);
      const scoped = await page.evaluate(async () => {
        const a = await MS.preflight.record();
        const el = MS.child.doc.querySelector('h1');
        MS.edit.commitText(el, el.innerHTML, 'Different file');
        const b = await MS.preflight.record();
        return [a.offline && a.offline.digest === a.sha256, b.offline, a.sha256 !== b.sha256];
      });
      assert.deepEqual(scoped, [true, null, true]);
      note('offline confirmation is linked to the tested bytes and drops out after an edit');

      await open(fixtures.w3tabs(), 'tabs.html');
      const notes = await page.evaluate(async () => {
        MS.rt().state.pageNotes.Summary = 'Legacy talking point';
        MS.pageTabs.rename('Summary', 'Executive summary');
        const named = MS.pageTabs.getNotes('Executive summary');
        MS.history.undo();
        const undone = MS.pageTabs.getNotes('Summary');
        MS.history.redo();
        const exported = MS.exportHtml();
        await MS.openHtml(exported, 'reopen.html', { force: true });
        return [named, undone, MS.pageTabs.getNotes('Executive summary')];
      });
      assert.deepEqual(notes, ['Legacy talking point', 'Legacy talking point', 'Legacy talking point']);
      note('legacy notes migrate and survive rename, undo and reopening the export');

      await open('<title>Control cap</title><h1>Control</h1><label>Region<select id="pick">' + Array.from({ length: 27 }, (_, i) => '<option value="' + i + '">Region ' + i + '</option>').join('') + '</select></label><p id="read">0</p><script>document.querySelector("#pick").onchange=function(){if(this.value==="26")throw Error("should be outside cap");document.querySelector("#read").textContent=this.value}</script>', 'control.html');
      const checks = await page.evaluate(async () => {
        const c = MS.qa.add({ title: 'Check region choices', steps: [{ do: 'try_options', target: 'css=#pick' }] });
        const before = MS.qa.deep.coverage();
        const run = await MS.qa.runCase(c.id);
        const after = MS.qa.deep.coverage(), e = MS.child.doc.querySelector('h1');
        MS.edit.commitText(e, e.innerHTML, 'Revised');
        return { before, run, after, stale: MS.qa.summary().byStatus.Stale };
      });
      assert.equal(checks.before.executed, 0);
      assert.equal(checks.before.planned, 0);
      assert.equal(checks.run.status, 'Partial');
      assert.deepEqual(checks.run.steps[0].detail, { checked: 25, total: 26, partial: true });
      assert.equal(checks.after.executed, 1);
      assert.equal(checks.after.passing, 0);
      assert.equal(checks.stale, 1);
      note('a capped dropdown records actual execution as partial and results become stale after edits');

      await open(sample, 'sales.html');
      await page.waitForFunction(() => MS.rt().charts().length === 4);
      const source = await page.evaluate(async () => {
        const row = MS.qa.deep.rows().find(x => x.Ref);
        const imported = MS.qa.deep.importRows([row], 'finance-oct.csv');
        MS.qa.draft();
        const cases = MS.qa.cases().filter(c => c.steps.some(s => s.do === 'expect_baseline'));
        const result = await MS.qa.runCase(cases[0].id);
        return { imported, values: MS.qa.deep.rows().length, cases: cases.length, result, report: (await MS.preflight.record()).expectationSource };
      });
      assert.equal(source.imported.matched, 1);
      assert.equal(source.values, 1);
      assert.equal(source.cases, 1);
      assert.equal(source.result.status, 'Pass');
      assert.match(source.result.steps.at(-1).note, /1 supplied value.*unspecified values were not checked/);
      assert.match(source.report, /finance-oct.csv/);
      note('one imported number creates one actual expectation with its source');

      const data = await page.evaluate(async () => {
        const name = MS.data.addDataset('Practice', [{ Region: 'North', NetSales: 110, Date: '2026-10-01' }, { Region: 'West', NetSales: 120, Date: '2026-10-01' }], true);
        MS.history.state('Use required fields', s => { s.filters.push({ dataset: name, field: 'Region' }); s.kpis.practice = { dataset: name, measure: 'NetSales', agg: 'sum' }; });
        const bad = MS.data.previewRefresh(name, [{ Region: 'East' }]);
        const denied = await Promise.resolve().then(() => MS.data.applyRefresh([bad])).then(() => '', e => e.message);
        const good = MS.data.previewRefresh(name, [{ Region: 'East', NetSales: 310, Date: '2026-11-01' }]);
        await MS.data.applyRefresh([good]);
        const fresh = MS.rt().getRows(name).length, period = MS.rt().state.datasets[name].period;
        MS.history.undo();
        const back = MS.rt().getRows(name).length;
        return { denied, fresh, period, back, totals: good.totals, saved: (await MS.store.all('versions')).some(x => x.value.name === 'Before refreshing data') };
      });
      assert.match(data.denied, /Required column.*NetSales/);
      assert.deepEqual(data.totals, [{ field: 'NetSales', before: 230, after: 310, blanks: 0 }]);
      assert.deepEqual([data.fresh, data.period, data.back, data.saved], [1, '2026-11-01', 2, true]);
      note('refresh blocks missing measures, previews totals and period, and rolls back in one undo');

      const largeDashboard = '<title>Large test plan</title><h1>Large test plan</h1>' +
        Array.from({ length: 180 }, (_, i) => '<div class="kpi"><span class="label">Measure ' + i +
          '</span><strong>' + (i + 1) + '</strong></div><select id="filter-' + i +
          '"><option>All</option><option>North</option></select>').join('');
      await open(largeDashboard, 'large-test-plan.html');
      const cancel = await page.evaluate(async () => {
        MS.qa.add({ title: 'Keep my existing test', steps: [{ do: 'manual', value: 'Check the source' }] });
        const task = new Promise(resolve => setTimeout(() => {
          const cancel = MS.$('.qa-draft-progress button');
          resolve(!!cancel);
          if (cancel) cancel.click();
        }, 0));
        await MS.qa.draftInUI({ depth: 'full', replace: true });
        return { handledInput: await task, titles: MS.qa.cases().map(c => c.title) };
      });
      assert.deepEqual(cancel, { handledInput: true, titles: ['Keep my existing test'] });
      await page.evaluate(() => MS.qa.dialog());
      await page.getByRole('button', { name: /^Draft/ }).click();
      await page.getByRole('menuitem', { name: 'Full draft (bounded)' }).click();
      await page.waitForFunction(() => MS.qa.cases().length > 350 && !MS.$('.qa-draft-progress'));
      const firstCase = await page.locator('.qa-row .qa-id').first().innerText();
      assert.equal(await page.locator('.qa-row').count(), 60);
      await page.getByRole('button', { name: 'Next', exact: true }).click();
      assert.notEqual(await page.locator('.qa-row .qa-id').first().innerText(), firstCase);
      await page.getByPlaceholder('Find a test…').fill('Measure 179');
      assert.equal(await page.locator('.qa-row').count(), 1);
      const afterDraft = await page.evaluate(async () => {
        const n = MS.qa.cases().length;
        MS.history.undo();
        const afterUndo = MS.qa.cases().map(c => c.title);
        MS.history.redo();
        const afterRedo = MS.qa.cases().length;
        const same = await MS.qa.draftAsync({ depth: 'full' });
        return { n, afterUndo, afterRedo, same };
      });
      assert.deepEqual(afterDraft.afterUndo, ['Keep my existing test']);
      assert.equal(afterDraft.afterRedo, afterDraft.n);
      assert.equal(afterDraft.same, 0);
      const resolution = await page.evaluate(() => {
        const driver = MS.qa.drv, find = driver.find, calls = new Map();
        driver.find = (target, options) => {
          calls.set(target, (calls.get(target) || 0) + 1);
          return find(target, options);
        };
        try {
          return { parts: MS.qa.deep.coverage().parts, mostLookups: Math.max(...calls.values()) };
        } finally { driver.find = find; }
      });
      assert.deepEqual(resolution, { parts: 360, mostLookups: 1 });
      note('large drafts yield to cancellation, paginate and undo, and coverage resolves each target once');

      assert.deepEqual(errors.filter(x => !/deliberate async failure/.test(x)), []);
      await ctx.close();
    }
  } finally {
    await browser.close(); fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('All reliability and self-serve checks passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
