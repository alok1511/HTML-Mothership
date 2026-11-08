#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const JSZip = require('../vendor/jszip.min.js');
const root = path.resolve(__dirname, '..');
const layouts = require('../samples/report/catalog.json');

async function shapeZip() {
  const name = 'test-boundary';
  const rings = [[70, 15], [74, 15]].map(([x, y]) => [[x, y], [x, y + 2], [x + 2, y + 2], [x + 2, y], [x, y]]);
  const recordLength = 128;
  const shp = Buffer.alloc(100 + rings.length * (8 + recordLength));
  shp.writeInt32BE(9994, 0); shp.writeInt32BE(shp.length / 2, 24); shp.writeInt32LE(1000, 28); shp.writeInt32LE(5, 32);
  rings.forEach((ring, i) => {
    const pos = 100 + i * (8 + recordLength), start = pos + 8;
    shp.writeInt32BE(i + 1, pos); shp.writeInt32BE(recordLength / 2, pos + 4); shp.writeInt32LE(5, start);
    shp.writeInt32LE(1, start + 36); shp.writeInt32LE(5, start + 40);
    ring.forEach(([x, y], j) => { shp.writeDoubleLE(x, start + 48 + j * 16); shp.writeDoubleLE(y, start + 56 + j * 16); });
  });
  const dbf = Buffer.alloc(65 + 33 * rings.length, 0);
  dbf[0] = 3; dbf.writeUInt32LE(rings.length, 4); dbf.writeUInt16LE(65, 8); dbf.writeUInt16LE(33, 10);
  dbf.write('iso_code', 32); dbf[43] = 67; dbf[48] = 32; dbf[64] = 13;
  ['IN-MH', 'IN-KA'].forEach((value, i) => { const pos = 65 + i * 33; dbf.fill(32, pos, pos + 33); dbf.write(value, pos + 1); });
  const zip = new JSZip();
  zip.file(name + '.shp', shp); zip.file(name + '.dbf', dbf);
  zip.file(name + '.prj', 'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],UNIT["degree",0.0174532925199433]]');
  return zip.generateAsync({ type: 'nodebuffer' });
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, offline: true, acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, 'dist/mothership-standalone.html')).href);
    const button = name => page.getByRole('button', { name, exact: true });
    const frame = page.frameLocator('#child');
    await button('Browse report layouts').click();
    const gallery = page.getByRole('dialog', { name: 'Sample report layouts' });
    assert.equal(await gallery.getByRole('region', { name: 'Report layouts' }).locator('.gallery-row').count(), 5);
    await gallery.getByRole('button', { name: 'Open ' + layouts[0].title, exact: true }).click();
    await page.waitForFunction(() => MS.mode === 'interact');
    const read = () => frame.locator('body').evaluate(body => {
      const doc = body.ownerDocument, win = doc.defaultView, model = win.MSReportModel;
      const byId = id => doc.getElementById(id);
      const ids = ['trend', 'ranking', 'scatter', 'matrix', 'scenario', ...(model.geography ? ['map'] : [])];
      return { base: byId('base-value').textContent, rate: byId('rate-value').textContent,
        insights: ['first', 'second', 'third'].map(k => [byId('insight-' + k).textContent, byId('so-' + k).textContent]),
        inferences: ids.map(k => byId(k + '-inference').textContent), chartCounts: [...Object.values(win.Chart.instances)].map(c => c.data.datasets[0].data.length),
        tabs: [...doc.querySelectorAll('[role=tab]')].map(t => t.textContent), scope: byId('report-scope').textContent };
    });
    for (const [index, model] of layouts.entries()) {
      if (index) await page.evaluate(async id => { await MS.samples.open(id, { force: true }); MS.setMode('interact'); }, model.id);
      await frame.locator('#base-value').waitFor();
      const before = await read();
      assert(before.tabs.includes('Key insights') && before.tabs.includes('Data explorer') && before.tabs.includes('Methodology') && before.tabs.includes('FAQ'));
      assert.equal(before.tabs.includes('Map'), model.map);
      assert(before.inferences.every(Boolean));
      const expected = await frame.locator('body').evaluate(body => {
        const m = body.ownerDocument.defaultView.MSReportModel;
        let rows = m.rows.filter(r => r.segment === m.segments[0] && (!m.geography || r.region === 'Maharashtra'));
        const count = rows.length;
        if (m.latestPeriod) rows = rows.filter(r => r.period === m.periods.at(-1));
        if (m.latestGroup) rows = rows.filter(r => r.group === m.groups.at(-1));
        const base = rows.reduce((s, r) => s + r.base, 0), value = rows.reduce((s, r) => s + r.outcome, 0) / base * 100;
        return { segment: m.segments[0], count, base, value, money: !!m.money };
      });
      await frame.locator('#filter-segment').selectOption(expected.segment);
      if (model.map) await frame.locator('#filter-region').selectOption('Maharashtra');
      const after = await read();
      const format = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
      assert.equal(after.base, expected.money ? '₹' + format.format(expected.base) + ' lakh' : format.format(expected.base));
      assert.equal(after.rate, format.format(expected.value) + '%');
      assert(after.scope.endsWith(expected.count + ' records'));
      assert(after.chartCounts.every(n => n > 0));
      after.inferences.forEach((x, i) => assert.notEqual(x, before.inferences[i], model.id + ' inference ' + i));
      after.insights.forEach((x, i) => x.forEach((line, j) => assert.notEqual(line, before.insights[i][j], model.id + ' insight ' + i + ':' + j)));
      await frame.getByRole('tab', { name: 'Drivers & scenarios' }).click();
      const scenario = await frame.locator('#scenario-inference').innerText();
      await frame.locator('#shock').evaluate(e => { e.value = 9; e.dispatchEvent(new Event('input', { bubbles: true })); });
      assert.notEqual(await frame.locator('#scenario-inference').innerText(), scenario);
      await frame.getByRole('tab', { name: 'Data explorer' }).click();
      const [csv] = await Promise.all([page.waitForEvent('download'), frame.getByRole('button', { name: 'Download filtered CSV' }).click()]);
      assert.equal(fs.readFileSync(await csv.path(), 'utf8').trim().split(/\r?\n/).length, expected.count + 1);
    }
    console.log('  ✓ All offline layouts reconcile their filters, inferences, decisions, scenarios and CSV');

    await page.evaluate(async () => { await MS.samples.open('sales-margin', { force: true }); MS.setMode('interact'); });
    await frame.getByRole('tab', { name: 'Data explorer' }).click();
    const csvData = 'period,region,segment,group,base,outcome,units\n2026-10,Maharashtra,Direct,Core,100,40,50\n2026-11,Karnataka,Digital,Core,200,50,80';
    await frame.locator('#load-report-data').setInputFiles({ name: 'team-report.csv', mimeType: 'text/csv', buffer: Buffer.from(csvData) });
    await frame.getByText(/team-report\.csv.*2 loaded records/).waitFor();
    assert.equal(await frame.locator('#base-value').textContent(), '₹300 lakh');
    assert.equal(await frame.locator('#rate-value').textContent(), '30%');
    await frame.locator('#filter-period').selectOption('2026-10');
    assert.equal(await frame.locator('#rate-value').textContent(), '40%');
    await frame.locator('#load-report-data').setInputFiles({ name: 'invalid.csv', mimeType: 'text/csv', buffer: Buffer.from('wrong\nvalue') });
    await frame.getByText(/The current data was kept/).waitFor();
    assert.equal(await frame.locator('#rate-value').textContent(), '40%');
    const importedHtml = await page.evaluate(() => MS.exportHtml());
    await page.evaluate(() => MS.history.undo());
    await frame.getByText(/Sample dataset.*324 loaded records/).waitFor();
    await page.evaluate(html => MS.openHtml(html, 'with-custom-data.html', { force: true }), importedHtml);
    await frame.getByRole('tab', { name: 'Data explorer' }).click();
    await frame.getByText(/team-report\.csv.*2 loaded records/).waitFor();
    assert.equal(await frame.locator('#base-value').textContent(), '₹300 lakh');
    console.log('  ✓ Local CSV data is validated, undoable, and kept in the exported report');

    await page.evaluate(async () => { await MS.samples.open('sales-margin', { force: true }); MS.setMode('interact'); });
    await frame.getByRole('tab', { name: 'Map' }).click();
    await frame.locator('#boundary-field').selectOption('iso_code');
    assert.match(await frame.locator('#boundary-status').innerText(), /6 of 6/);
    await frame.getByRole('button', { name: 'Filter to Maharashtra' }).click();
    assert.equal(await frame.locator('#filter-region').inputValue(), 'Maharashtra');
    await frame.getByRole('button', { name: 'Reset filters' }).click();
    await frame.locator('#load-boundaries').setInputFiles({ name: 'demo-wgs84.zip', mimeType: 'application/zip', buffer: await shapeZip() });
    await frame.getByText(/demo-wgs84\.zip.*2 of 6/).waitFor();
    assert.equal(await frame.locator('#boundary-field').inputValue(), 'iso_code');
    assert.equal(await page.evaluate(() => MS.dirty), true);
    const exported = await page.evaluate(() => MS.exportHtml());
    await page.evaluate(() => MS.history.undo());
    await frame.getByText(/Natural Earth sample layer.*6 of 6/).waitFor();
    await page.evaluate(html => MS.openHtml(html, 'with-custom-map.html', { force: true }), exported);
    await frame.getByRole('tab', { name: 'Map' }).click();
    await frame.getByText(/demo-wgs84\.zip.*2 of 6/).waitFor();
    console.log('  ✓ WGS84 shapefile import joins ISO codes, supports map clicks and survives undo and export');

    const reportRecipe = await page.evaluate(async () => {
      const recipe = await MS.api.run('capture_recipe', { name: 'Sales review', helpText: true });
      const before = MS.pageTabs.list().map(t => t.title);
      const result = await MS.api.run('run_recipe', { recipe });
      return { recipe, before, after: MS.pageTabs.list().map(t => t.title), issues: result.issues };
    });
    assert.equal(reportRecipe.before.length, 7);
    assert.deepEqual(reportRecipe.after, reportRecipe.before);
    assert.deepEqual(reportRecipe.issues, []);
    assert(reportRecipe.recipe.steps.some(s => s.title === 'FAQ' && s.html?.includes('What changes when I filter the report?')));
    console.log('  ✓ Report capture includes opted-in help text and reuses the report’s existing tabs');

    const starter = require('../recipes/executive-review.json');
    const withBrief = await page.evaluate(async recipe => {
      const result = await MS.api.run('run_recipe', { recipe });
      return { result, html: await MS.exportHtml() };
    }, starter);
    assert.deepEqual(withBrief.result.issues, []);
    await page.evaluate(() => MS.history.undo());
    assert.equal(await frame.getByRole('tab', { name: 'Executive brief' }).count(), 0);
    assert.equal(await frame.locator('#trend-title.ms-title').count(), 0);
    await page.evaluate(() => MS.history.redo());
    assert.equal(await frame.locator('#trend-title.ms-title').count(), 1);
    await page.evaluate(html => MS.openHtml(html, 'with-executive-brief.html', { force: true }), withBrief.html);
    await frame.getByRole('tab', { name: 'Executive brief' }).click();
    await frame.getByRole('heading', { name: 'Decision required' }).waitFor();
    await frame.getByRole('tab', { name: 'Overview' }).click();
    await frame.locator('#trend-chart').waitFor({ state: 'visible' });
    const heading = frame.locator('#trend-title');
    assert.match(await heading.textContent(), /Gross margin by/);
    console.log('  ✓ Applying an in-house recipe keeps the report’s charts and new tab working after export');

    const setup = await page.evaluate(async () => {
      await MS.samples.open('sales', { force: true });
      const chart = MS.rt().charts()[0];
      MS.history.state('Recipe capture test', s => {
        s.charts[chart.key] = { tooltip: '{label} / {value}', style: { legend: 'bottom' } };
        s.datasets.secret = { rows: [{ Password: 'private test value' }] };
      });
      const r = await MS.api.run('capture_recipe', { name: 'Portable setup' });
      return { r, hasPrivate: JSON.stringify(r).includes('private test value'), hasAssets: JSON.stringify(r).includes('fontFiles') };
    });
    assert(setup.r.steps.some(x => x.do === 'chart' && x.match.titleExact && x.style.legend === 'bottom'));
    assert.equal(setup.hasPrivate || setup.hasAssets, false);
    await page.evaluate(() => { MS.recipeStudio.open(); });
    const workshop = page.getByRole('dialog', { name: 'Recipe workshop' });
    assert.equal(await workshop.locator('.recipe-choice').count(), 6);
    await workshop.getByRole('button', { name: 'Executive review pack' }).click();
    await workshop.getByRole('button', { name: 'Edit step 2', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit recipe step' });
    await edit.getByText('Tab title', { exact: true }).locator('..').locator('input').fill('Board brief');
    await edit.getByRole('button', { name: 'Save step' }).click();
    assert.match(await workshop.locator('.recipe-steps').innerText(), /Board brief/);
    await workshop.getByRole('button', { name: 'Apply recipe' }).click();
    await workshop.getByText(/steps completed/).waitFor();
    const countTabs = () => page.evaluate(() => MS.rt().tabs().filter(t => t.title === 'Board brief').length);
    assert.equal(await countTabs(), 1);
    await workshop.getByRole('button', { name: 'Apply recipe' }).click();
    await workshop.getByText(/steps completed/).waitFor();
    assert.equal(await countTabs(), 1);
    const [skill] = await Promise.all([page.waitForEvent('download'), workshop.getByRole('button', { name: 'Export skill ZIP' }).click()]);
    const skillZip = await JSZip.loadAsync(fs.readFileSync(await skill.path()));
    assert(await skillZip.file('executive-review-pack/SKILL.md').async('string').then(s => s.includes('name: executive-review-pack')));
    assert.match(await skillZip.file('executive-review-pack/references/recipe.json').async('string'), /Board brief/);
    const [plugin] = await Promise.all([page.waitForEvent('download'), workshop.getByRole('button', { name: 'Export plugin JS' }).click()]);
    const pluginSource = fs.readFileSync(await plugin.path(), 'utf8');
    assert.match(pluginSource, /Mothership\.registerPlugin/);
    await workshop.locator('.dlg-x').click();
    await page.evaluate(async () => { await MS.samples.open('sales', { force: true }); });
    await page.evaluate(source => { MS.plugins.install(source, 'board-plugin.js'); }, pluginSource);
    await button('Install & run').click();
    assert.equal(await countTabs(), 0);
    await button('Plugins').click();
    await button('Apply recipe').click();
    await page.waitForFunction(() => MS.rt().tabs().some(t => t.title === 'Board brief'));
    assert.equal(await countTabs(), 1);
    assert.deepEqual(errors, []);
    console.log('  ✓ Workshop tweaks, capture, repeat application, skill ZIP and installed plugin button work');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
