#!/usr/bin/env node
/* Guided samples, file-to-chart UI, reference gallery and reusable reference layouts. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium, firefox } = require('playwright');
const XLSX = require('../vendor/xlsx.full.min.js');

const root = path.resolve(__dirname, '..');
const practices = require('../samples/practice/catalog.json');
const references = require('../docs/chart-references.json');
const editors = process.env.V19_ONLY ? [process.env.V19_ONLY] : ['mothership.html', 'dist/mothership-standalone.html'];
const csv = { name: 'shipments.csv', mimeType: 'text/csv', buffer: Buffer.from('Warehouse,Depot,Units,Code\nEast,North,5,001\nEast,North,,002\nEast,South,15,003\nWest,North,3,004\n') };
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Team: 'Platform', Issues: 8 }]), 'January');
XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Team: 'Platform', Issues: 11 }]), 'February');
const excel = { name: 'Quality.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })) };
const json = { name: 'forecast.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ alternate: [{ Week: 'W1', Volume: 17 }] })) };
const chartIds = ['comparison-dots', 'scenario-columns', 'stacked-area-benchmark', 'cohort-bars'];
const log = (message) => console.log('  ✓ ' + message);

(async () => {
  const browser = process.env.V19_FIREFOX ? await firefox.launch() :
    await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    for (const editor of editors) {
      console.log(editor);
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, offline: true });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(pathToFileURL(path.join(root, editor)).href);
      const api = (name, args = {}) => page.evaluate(([n, a]) => MS.api.run(n, a).then((v) => v === undefined ? null : JSON.parse(JSON.stringify(v))), [name, args]);
      const button = (label) => page.getByRole('button', { name: label, exact: true });
      const fresh = async () => {
        await api('new_dashboard', { title: 'Chart builder test', tabs: false, force: true });
        await page.waitForFunction(() => MS.rt() && MS.child);
      };
      const chartData = (key) => page.evaluate((k) => {
        const rt = MS.rt(), inst = rt.chart(k || rt.charts()[0].key).inst;
        return { type: inst.options.msType, labels: inst.data.labels, sets: inst.data.datasets.map((d) => ({
          label: d.label, data: d.data, stack: d.stack, fill: d.fill, point: d.pointStyle, line: d.showLine
        })) };
      }, key || null);
      await button('Choose a sample').click();
      const pick = page.getByLabel('Sample dashboard', { exact: true });
      assert.equal(await pick.locator('option').count(), 23);
      assert.equal(await pick.locator('optgroup[label="Guided practice"] option').count(), 10);
      await pick.selectOption(practices[0].id);
      await button('Open sample').click();
      await page.waitForFunction(() => MS.rt() && MS.rt().charts().length >= 2);
      const readSummary = () => page.evaluate(() => MS.child.doc.querySelector('.ms-summary').textContent);
      const unfiltered = await readSummary();
      await page.evaluate(() => {
        const select = MS.child.doc.querySelector('select[data-field="Queue"]');
        select.value = 'Platform';
        select.dispatchEvent(new MS.child.win.Event('change'));
      });
      assert.match(await readSummary(), /Platform shows 73/);
      assert.notEqual(await readSummary(), unfiltered);
      for (const [index, entry] of practices.entries()) {
        if (index > 0) await page.evaluate((id) => MS.samples.open(id, { force: true }), entry.id);
        await page.waitForFunction((title) => MS.child?.doc.title === title && MS.rt()?.charts().length > 0, entry.title);
        const data = await page.evaluate(() => {
          const rt = MS.rt(), d = MS.child.doc;
          return { tabs: Array.from(d.querySelectorAll('section[data-ms-tab]')).map((node) => node.getAttribute('data-ms-tab')),
            charts: rt.charts().every((c) => c.inst.data.datasets.some((series) => series.data.length > 0)),
            rows: Object.values(rt.state.datasets)[0].rows.length, tasks: d.querySelector('[data-ms-tab="practice"]').textContent };
        });
        assert.deepEqual(data.tabs, ['overview', 'source', 'practice'], entry.title);
        assert.ok(data.charts && data.rows > 0 && data.tasks.includes('Expected result'), entry.title);
      }
      log('23 chooser entries and ten offline practice dashboards with live charts, data and exercises');

      await page.reload();
      if (process.env.V19_FIREFOX) {
        // Playwright Firefox cancels the intercepted native picker before setFiles can populate it.
        await page.evaluate((files) => {
          const original = HTMLInputElement.prototype.click;
          HTMLInputElement.prototype.click = function () {
            if (this.type !== 'file') return original.call(this);
            HTMLInputElement.prototype.click = original;
            const selection = new DataTransfer();
            files.forEach(({ name, mimeType, bytes }) => selection.items.add(new File([Uint8Array.from(bytes)], name, { type: mimeType })));
            this.files = selection.files;
            this.dispatchEvent(new Event('change', { bubbles: true }));
          };
        }, [csv, excel, json].map(({ name, mimeType, buffer }) => ({ name, mimeType, bytes: [...buffer] })));
        await button('Build from data').click();
      } else {
        const chooser = page.waitForEvent('filechooser');
        await button('Build from data').click();
        await (await chooser).setFiles([csv, excel, json]);
      }
      await page.locator('.bi-status').getByText(/matching rows/).waitFor();
      const builder = page.locator('.bi-builder');
      const field = (label) => builder.getByLabel(label, { exact: true });
      const imported = await page.evaluate(() => Object.entries(MS.rt().state.datasets).map(([name, d]) => [name, d.rows[0]]));
      assert.equal(imported.length, 4);
      assert.equal(imported[0][1].Code, '001');
      assert.deepEqual(imported.slice(1).map((r) => Object.values(r[1]).at(-1)), [8, 11, 17]);
      await field('Category').selectOption('Warehouse');
      await field('Value').selectOption('Units');
      await field('Calculation').selectOption('avg');
      await builder.getByText('Sort, limit and filter', { exact: true }).click();
      await field('Filter this chart by').selectOption('Depot');
      await field('Equals').fill('North');
      await page.locator('.bi-status').getByText(/3 matching rows/).waitFor();
      await field('Unit and scope (optional)').fill('Shipments, units, October');
      await field('Key inference (optional)').fill('Compare the depots before shifting capacity.');
      await field('Show a summary that follows filters').check();
      await button('Insert chart').click();
      await page.waitForFunction(() => MS.rt().charts().length === 1);
      const built = await chartData();
      assert.deepEqual(built.labels, ['East', 'West']);
      assert.deepEqual(built.sets[0].data, [5, 3], 'blank values are excluded from the average');
      assert.equal(await page.evaluate(() => MS.child.doc.querySelector('.ms-inf').textContent), 'Compare the depots before shifting capacity.');
      assert.match(await readSummary(), /East is highest at 5, and West is lowest at 3/);
      await api('undo');
      await page.waitForFunction(() => MS.rt().charts().length === 0);
      assert.equal(await page.evaluate(() => Object.keys(MS.rt().state.datasets).length), 4);
      await api('redo');
      await page.waitForFunction(() => MS.rt().charts().length === 1);
      assert.deepEqual(await chartData(), built);
      log('CSV, XLSX and JSON import, data preview, filter, average and chart-only undo/redo');

      await fresh();
      const { layouts } = await api('chart_layouts');
      assert.equal(references.length, 26);
      for (const ref of references) {
        for (const id of [ref.layout, ...ref.companions]) assert.ok(layouts.some((layout) => layout.id === id), ref.title + ' uses ' + id);
      }
      await page.evaluate(() => MS.layouts.gallery());
      await button('McKinsey references').click();
      assert.equal(await page.locator('[data-reference]').count(), 26);
      await page.getByLabel('Search chart layouts', { exact: true }).fill('B2B pricing');
      await page.locator('[data-reference="comparison-dots"]').click();
      await page.locator('[data-reference-layout="comparison-dots"]').click();
      await page.getByRole('dialog').getByRole('button', { name: 'Insert', exact: true }).click();
      await page.waitForFunction(() => MS.rt().charts().length === 1);
      const dots = await chartData();
      assert.equal(dots.type, 'dot-compare');
      assert.equal(new Set(dots.sets.map((d) => d.point)).size, 4);
      assert.ok(dots.sets.every((d) => d.line === false));
      const keyed = {};
      for (const layout of chartIds.slice(1)) {
        const made = await api('chart_layouts', { action: 'insert', layout, sample: true });
        assert.deepEqual(made.issues, [], layout);
        assert.equal(made.charts.length, 1, layout);
        keyed[layout] = made.charts[0];
      }
      const scenario = await chartData(keyed['scenario-columns']);
      assert.deepEqual(scenario.sets[0].data, [101, 158, 220, null, null]);
      assert.deepEqual(scenario.sets[1].data, [null, null, null, 270, 430]);
      const area = await chartData(keyed['stacked-area-benchmark']);
      assert.equal(area.type, 'area-benchmark');
      assert.deepEqual(area.sets.map((d) => [d.label, d.stack, d.fill]), [
        ['Households', 'components', 'stack'], ['Industry', 'components', 'stack'], ['Benchmark', 'benchmark', false]
      ]);
      assert.ok((await chartData(keyed['cohort-bars'])).sets.some((d) => d.data.some((n) => n < 0)));
      const edited = await api('chart_layouts', { action: 'edit', chart: keyed['cohort-bars'], title: 'Cohorts diverge around zero' });
      assert.deepEqual(edited.issues, []);
      assert.equal(edited.title, 'Cohorts diverge around zero');
      const threshold = await api('chart_layouts', { action: 'insert', layout: 'threshold-dot-grid', sample: true });
      assert.deepEqual(threshold.issues, []);
      assert.equal(threshold.units.length, 1);
      const thresholdText = await page.evaluate(() => MS.child.doc.body.textContent);
      assert.match(thresholdText, /Each dot represents 1/);
      assert.match(thresholdText, /Local 31/);
      const file = await api('export_html');
      await page.evaluate(({ html, name }) => MS.openHtml(html, name, { force: true }), file);
      await page.waitForFunction(() => MS.rt()?.charts().length === 4);
      assert.deepEqual(await chartData(keyed['stacked-area-benchmark']), area, 'benchmark chart retains the stack and line after offline export and reopen');
      const recipeDoc = fs.readFileSync(path.join(root, 'docs/CHART-RECIPE-REFERENCE.md'), 'utf8');
      for (const match of recipeDoc.matchAll(/```json\n([\s\S]+?)\n```/g)) {
        const recipe = JSON.parse(match[1]);
        const result = await api('preview_recipe', { recipe });
        assert.ok(result.steps.length > 0);
        if (recipe.steps.some((s) => s.args?.dataset === 'Capacity outlook')) {
          await api('new_dashboard', { title: 'Forecast', force: true });
          await api('add_dataset', { name: 'Capacity outlook', rows: [
            { Period: '2025', Scenario: 'Observed', 'New capacity': 12 },
            { Period: '2030', Scenario: 'Base', 'New capacity': 16 },
            { Period: '2030', Scenario: 'High', 'New capacity': 20 }
          ] });
        }
        const ran = await api('run_recipe', { recipe });
        assert.deepEqual(ran.issues, [], recipe.name);
      }
      assert.deepEqual(errors, []);
      log('26 searchable chart references, five new layouts, layout edits, export and executable recipe Markdown');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
