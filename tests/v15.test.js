#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const playwright = require('playwright');
const engine = process.env.MOTHERSHIP_TEST_BROWSER || 'chromium';
const file = pathToFileURL(path.resolve(__dirname, '../dist/mothership-standalone.html')).href;

(async () => {
  const browser = await playwright[engine].launch(engine === 'chromium' && process.env.CHROMIUM_PATH ?
    { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await browser.newPage({ offline: true, acceptDownloads: true, viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(file);
    const byButton = (area, name) => area.getByRole('button', { name, exact: true });
    const dlg = name => page.getByRole('dialog', { name, exact: true });
    const frame = page.frameLocator('#child');
    async function openSample(title) {
      const dirty = await page.evaluate(() => MS.dirty);
      await page.evaluate(() => { MS.recipeStudio.gallery(); });
      await byButton(dlg('Sample report layouts'), 'Open ' + title).click();
      if (dirty) await byButton(page, 'Leave without saving').click();
      await frame.getByRole('heading', { name: title, exact: true }).waitFor();
      await page.waitForFunction(() => MS.mode === 'interact');
    }
    await openSample('Monsoon Readiness Review');
    const first = await frame.locator('#brief-status').textContent();
    await frame.locator('#filter-region').selectOption('Maharashtra');
    assert.notEqual(await frame.locator('#brief-status').textContent(), first);
    await byButton(frame, 'Compare states').click();
    await frame.locator('#report-map').waitFor();
    assert.match(await frame.locator('#map-inference').textContent(), /Maharashtra/);
    console.log('  ✓ Finished dashboard responds to filters and links the decision desk to the map');

    await openSample('Release Rehearsal Lab');
    assert.equal(await frame.locator('#lab-total').textContent(), '750');
    await frame.getByRole('checkbox', { name: 'Introduce an incorrect KPI' }).check();
    assert.equal(await frame.locator('#lab-total').textContent(), '1,000');
    assert.equal(await frame.locator('#lab-source-total').textContent(), '750');
    await frame.getByRole('tab', { name: 'Source data' }).click();
    const [expected] = await Promise.all([page.waitForEvent('download'), byButton(frame, 'Download expected numbers CSV').click()]);
    const baseline = await page.evaluate(async csv => MS.qa.deep.importFile(new File([csv], 'release-expected.csv')),
      fs.readFileSync(await expected.path(), 'utf8'));
    assert.equal(baseline.matched, 1);
    const numberCase = await page.evaluate(async () => {
      const draft = await MS.api.run('test_plan', { action: 'draft' });
      return draft.cases.find(c => /KPI “Reported total” matches/.test(c.title))?.id;
    });
    assert(numberCase);
    const runNumberCase = () => page.evaluate(async id => (await MS.api.run('test_run', { ids: [id] })).results[0].status, numberCase);
    assert.equal(await runNumberCase(), 'Fail');
    await frame.getByRole('tab', { name: 'Source data' }).click();
    await byButton(frame, 'Amount').click();
    assert.equal(await frame.locator('#lab-rows tr').first().locator('td').last().textContent(), '100');
    await frame.getByRole('tab', { name: 'Summary' }).click();
    await byButton(frame, 'Reset filters').click();
    assert.equal(await frame.locator('#lab-total').textContent(), '750');
    assert.equal(await runNumberCase(), 'Pass');

    const targets = await page.evaluate(async () => {
      const recipe = { name: 'Preview sample', steps: [
        { do: 'ensureTab', title: 'Summary' }, { do: 'ensureTab', title: 'Board brief' },
        { do: 'chart', match: { titleExact: 'Regional performance' }, tooltip: '{value}' },
        { do: 'chart', match: { titleExact: 'Regional performance', tab: 'Detail' }, tooltip: '{value}' },
        { do: 'filter', dataset: 'missing', field: 'Region' }
      ] };
      const before = JSON.stringify(MS.rt().state);
      const targets = await MS.api.run('preview_recipe', { recipe });
      return { targets, context: await MS.api.run('recipe_context', {}), unchanged: before === JSON.stringify(MS.rt().state) };
    });
    assert.deepEqual(targets.targets.steps.map(s => s.status), ['keep', 'ready', 'review', 'ready', 'review']);
    assert.equal(targets.context.charts.filter(c => c.titleExact === 'Regional performance').length, 2);
    assert.equal(targets.unchanged, true);
    assert.deepEqual(targets.context.datasets, []);
    console.log('  ✓ Rehearsal detects the wrong KPI, passes after correction, and distinguishes duplicate chart targets');

    await page.evaluate(() => { MS.recipeStudio.open(); });
    const workshop = dlg('Recipe workshop');
    const help = byButton(workshop, 'Help with editing steps');
    await help.hover();
    await workshop.getByRole('tooltip').waitFor();
    await page.keyboard.press('Escape');
    assert(await workshop.isVisible());
    await help.blur();
    await help.focus();
    await workshop.getByRole('tooltip').waitFor();
    await page.keyboard.press('Escape');
    await byButton(workshop, 'New recipe').click();
    await workshop.getByRole('textbox', { name: 'Recipe name', exact: true }).fill('Guided practice');
    await byButton(workshop, 'Add step').click();
    await byButton(dlg('Add a recipe step'), 'Continue').click();
    const step = dlg('Add a tab if it’s missing');
    await step.getByRole('textbox', { name: 'Tab title' }).fill('Board brief');
    await byButton(step, 'Save step').click();
    await byButton(workshop, 'Add step').click();
    await dlg('Add a recipe step').locator('select').selectOption('wrapCharts');
    await byButton(dlg('Add a recipe step'), 'Continue').click();
    await byButton(workshop, 'Move step 2 up').click();
    assert.match(await workshop.locator('.recipe-steps li').first().textContent(), /Add chart commentary/);
    await byButton(workshop, 'Remove step 1').click();
    await byButton(workshop, 'Check targets').click();
    await workshop.getByText('No edits applied.', { exact: false }).waitFor();
    assert.equal(await frame.getByRole('tab', { name: 'Board brief' }).count(), 0);
    await byButton(workshop, 'Apply recipe').click();
    await frame.getByRole('tab', { name: 'Board brief' }).waitFor();
    await page.evaluate(() => MS.history.undo());
    assert.equal(await frame.getByRole('tab', { name: 'Board brief' }).count(), 0);
    console.log('  ✓ Guided workshop supports mouse and keyboard help, adding, ordering, checking, applying and undo');

    await byButton(workshop, 'Draft with AI').click();
    const assistant = dlg('Draft a recipe with your work model');
    await assistant.getByRole('textbox', { name: 'What should the recipe do?' }).fill('Add a reader brief.');
    const prompt = assistant.getByRole('textbox', { name: 'Recipe drafting prompt' });
    await page.waitForFunction(() => document.querySelector('[aria-label="Recipe drafting prompt"]').value.includes('gpt-5.6-terra'));
    assert(!/Regional performance/.test(await prompt.inputValue()));
    await assistant.locator('select').selectOption('sonnet');
    await assistant.getByRole('checkbox', { name: 'Include tab and chart names from the open dashboard' }).check();
    assert.match(await prompt.inputValue(), /claude-sonnet-5/);
    assert.match(await prompt.inputValue(), /Regional performance/);
    assert.match(await prompt.inputValue(), /preview_recipe/);
    await assistant.getByText('Connect Mothership tools to your work assistant').click();
    assert.match(await assistant.locator('pre').innerText(), /claude mcp add --transport stdio/);
    await assistant.locator('.dlg-x').click();
    await byButton(workshop, 'Paste recipe').click();
    const paste = dlg('Paste a recipe');
    await paste.getByRole('textbox', { name: 'Pasted recipe' }).fill('{"steps":[{"do":"unsupported"}]}');
    await byButton(paste, 'Load for review').click();
    await paste.getByRole('alert').getByText(/unknown recipe action/).waitFor();
    const json = JSON.stringify({ $type: 'mothership/recipe', name: 'From assistant', steps: [{ do: 'ensureTab', title: 'Reader brief' }] });
    await paste.getByRole('textbox', { name: 'Pasted recipe' }).fill('```json\n' + json + '\n```');
    await byButton(paste, 'Load for review').click();
    await workshop.getByText('Reader brief', { exact: true }).waitFor();
    assert.equal(await frame.getByRole('tab', { name: 'Reader brief' }).count(), 0);
    await workshop.locator('.dlg-x').click();
    console.log('  ✓ Terra and Sonnet prompts stay local, support opt-in target names and import drafts for review');

    await openSample('Monthly Close Lab');
    await frame.getByRole('tab', { name: 'Source data' }).click();
    const contents = [];
    for (const month of ['October', 'November']) {
      const [download] = await Promise.all([page.waitForEvent('download'), byButton(frame, 'Download ' + month + ' CSV').click()]);
      contents.push({ name: download.suggestedFilename(), csv: fs.readFileSync(await download.path(), 'utf8') });
    }
    const totals = await page.evaluate(async files => {
      const dataset = 'monthly-close';
      const parse = file => file.csv.trim().split('\n').slice(1).map(row => {
        const [Region, Segment, Period, Amount] = row.split(',');
        return { Region, Segment, Period, Amount: Number(Amount) };
      });
      const chart = MS.rt().charts().find(c => c.el.id === 'lab-summary-chart');
      await MS.api.run('add_dataset', { name: dataset, rows: parse(files[0]) });
      await MS.api.run('chart_settings', { chart: chart.key, data: { dataset, levels: ['Region', 'Segment'], measure: 'Amount', agg: 'sum' } });
      const sum = () => chart.inst.data.datasets[0].data.reduce((n, v) => n + v, 0);
      const before = sum();
      await MS.api.run('refresh_dataset', { name: dataset, rows: parse(files[1]), period: '2026-11' });
      return [before, sum()];
    }, contents);
    assert.deepEqual(totals, [750, 915]);
    assert.equal(await frame.locator('#lab-source-total').textContent(), '750');
    console.log('  ✓ Monthly close practice files refresh the bound chart from 750 to 915');

    await page.evaluate(() => { MS.help.guide('glossary'); });
    await dlg('📖 Mothership user guide').getByRole('heading', { name: 'Glossary' }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
