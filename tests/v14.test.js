#!/usr/bin/env node
/* Recipes (one undo step, the "api" step, results returned when finished) and the inference ladder. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const editors = process.env.V14_ONLY ? [process.env.V14_ONLY] : ['mothership.html', 'dist/mothership-standalone.html'];
const recipeFiles = fs.readdirSync(path.join(root, 'recipes')).filter(f => f.endsWith('.json'));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    for (const editor of editors) {
      console.log(editor);
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.join(root, editor)).href);
      await page.waitForFunction(() => window.MS && MS.api && MS.api.run);
      const api = (name, args) => page.evaluate(([n, a]) => MS.api.run(n, a).then(x => JSON.parse(JSON.stringify(x === undefined ? null : x))), [name, args || {}]);
      const fresh = async () => { await api('new_dashboard', { title: 'Recipe test', tabs: false, force: true }); await page.waitForFunction(() => MS.rt() && MS.child); };
      const charts = () => page.evaluate(() => MS.rt().charts().map(c => MS.charts.nameOf(c.key)));

      /* --- a recipe finishes before run_recipe answers, and is one undo step --- */
      await fresh();
      const bridge = JSON.parse(fs.readFileSync(path.join(root, 'recipes/example-bridge.json'), 'utf8'));
      const before = await page.evaluate(() => MS.history.labels().length);
      const ran = await api('run_recipe', { recipe: bridge });
      assert.deepEqual(ran, { ok: true, steps: bridge.steps.length, problems: [] });
      // No waiting here: the chart, its colours and its shape must already be there.
      const state = await page.evaluate(() => {
        const r = MS.rt(), c = r.charts()[0], d = r.chartData(c.key, true);
        return { names: r.charts().map(x => MS.charts.nameOf(x.key)), labels: d.labels, series: d.series.map(s => s.name),
          colors: r.state.layout.colors, shapes: (r.state.shapes || []).length, labelsNow: MS.history.labels() };
      });
      assert.equal(state.names.length, 1);
      assert.match(state.names[0], /^EBITDA rose 25/);
      assert.deepEqual(state.labels, ['FY24 EBITDA', 'Volume', 'Price', 'Mix', 'Input cost', 'FY25 EBITDA'], 'sort "source" keeps the order of the rows');
      assert.equal(state.colors.Base, 'transparent');
      assert.equal(state.shapes, 1);
      assert.equal(state.labelsNow.length, before + 1, 'the whole recipe is one undo step');
      assert.equal(state.labelsNow[state.labelsNow.length - 1], 'Recipe: ' + bridge.name);
      await api('undo');
      await page.waitForFunction(() => MS.rt().charts().length === 0);
      assert.equal(await page.evaluate(() => Object.keys(MS.rt().state.datasets).length), 0, 'undo removes the dataset too');
      await api('redo');
      await page.waitForFunction(() => MS.rt().charts().length === 1);
      console.log('  ✓ run_recipe answers when the recipe has finished, and the recipe is one undo step');

      /* --- problems come back to the caller; unsafe tools are refused --- */
      const bad = await api('run_recipe', { recipe: { name: 'Bad', steps: [
        { do: 'api', tool: 'call', args: { path: 'tabs.add', args: ['X'] } },
        { do: 'api', tool: 'new_dashboard', args: { force: true } },
        { do: 'api', tool: 'no_such_tool' },
        { do: 'api', tool: 'chart_legend', args: { chart: 'No chart called this', position: 'none' } },
        { do: 'nonsense' },
        { do: 'api', tool: 'chart_legend', each: '*', args: { position: 'bottom' } }] } });
      assert.equal(bad.ok, false);
      assert.equal(bad.problems.length, 5);
      assert.match(bad.problems[0], /Step 1 failed: the tool "call" cannot be used in a recipe/);
      assert.match(bad.problems[1], /Step 2 failed: the tool "new_dashboard" cannot be used in a recipe/);
      assert.match(bad.problems[2], /Step 3 failed: unknown tool "no_such_tool"/);
      assert.match(bad.problems[3], /^Step 4 failed: /);
      assert.match(bad.problems[4], /Step 5: unknown action "nonsense"/);
      assert.deepEqual(await charts(), state.names, 'the dashboard was not replaced');
      assert.equal(await page.evaluate(() => { const r = MS.rt(); return (r.state.charts[r.charts()[0].key].style || {}).legend; }), 'bottom', '"each" runs the tool for every matching chart');
      console.log('  ✓ Step problems are returned, blocked tools are refused, and "each" runs a tool per chart');

      /* --- replace_text is undoable --- */
      const replaced = await api('replace_text', { find: 'EBITDA rose 25', replace: 'Profit rose 25' });
      assert.equal(replaced.ok, true);
      assert.match((await charts())[0], /^Profit rose 25/);
      await api('undo');
      assert.match((await charts())[0], /^EBITDA rose 25/);
      console.log('  ✓ Replace text can be undone');

      /* --- every recipe shipped in recipes/ runs clean --- */
      for (const file of recipeFiles) {
        await fresh();
        if (file === 'consulting-house-style.json') await api('run_recipe', { recipe: JSON.parse(fs.readFileSync(path.join(root, 'recipes/example-growth-cagr.json'), 'utf8')) });
        const result = await api('run_recipe', { recipe: JSON.parse(fs.readFileSync(path.join(root, 'recipes', file), 'utf8')) });
        assert.deepEqual(result.problems, [], file);
        assert.equal(result.ok, true, file);
        if (/^example-/.test(file)) assert.equal((await charts()).filter(n => /^tmp-/.test(n)).length, 0, file + ' leaves no temporary title');
      }
      console.log('  ✓ ' + recipeFiles.length + ' recipe files run without problems');
      assert.match((await page.evaluate(() => MS.api.describe().find(t => t.name === 'insert_chart').inputSchema.properties.sort.description)), /source/);

      /* --- inference ladder --- */
      await fresh();
      await api('run_recipe', { recipe: JSON.parse(fs.readFileSync(path.join(root, 'recipes/example-growth-cagr.json'), 'utf8')) });
      const growth = await api('chart_inferences', { chart: 'Premium has grown' });
      assert.equal(growth.kind, 'trend');
      assert.match(growth.first.join(' '), /Rose from .*1,820.* in FY21 to .*3,080.* in FY25 \(\+69%\)/);
      assert.match(growth.first.join(' '), /\+14% a period on average/);
      assert.match(growth.second.join(' '), /The direction never changed across 4 periods/);
      assert.match(growth.third.join(' '), /If the average pace holds, the next period would be about .*3,51\d.*doubles in about 5 periods/);
      assert.match(growth.checks[0], /not a forecast and not a cause/);

      await api('run_recipe', { recipe: JSON.parse(fs.readFileSync(path.join(root, 'recipes/example-ranked-highlight.json'), 'utf8')) });
      const rank = await api('chart_inferences', { chart: 'Maharashtra takes 9 days' });
      assert.equal(rank.kind, 'ranking');
      assert.match(rank.first[0], /^Maharashtra is highest at 9\.1 \(20% of the total\); West Bengal is lowest at 4\.8\./);
      assert.match(rank.second.join(' '), /Maharashtra is 1\.5 times the typical item \(median 6\.1\)/);
      assert.match(rank.second.join(' '), /The top 3 make up 51% of the total; 6 items of 7 cover 80%\. The total is spread out\./);
      assert.match(rank.third.join(' '), /A 10% change in Maharashtra alone moves the total by 2% \(0\.91\)/);

      await api('run_recipe', { recipe: JSON.parse(fs.readFileSync(path.join(root, 'recipes/example-loss-run.json'), 'utf8')) });
      const mix = await api('chart_inferences', { chart: 'Two-thirds of 2024-25' });
      assert.equal(mix.kind, 'mix over time');
      assert.match(mix.first[0], /The total fell from \$548 in 2021-22 to \$421 in 2024-25 \(−23%\)\. Outstanding is the largest part at 67%\./);
      assert.match(mix.second.join(' '), /Paid moved −\$371, more than the whole change of −\$127; Outstanding offset part of it \(\+\$244\)/);
      assert.match(mix.second.join(' '), /Outstanding went from 6\.6% to 67% of the total/);
      const all = await api('chart_inferences');
      assert.equal(all.charts.length, 3);
      assert(all.charts.every(c => c.first.length && c.checks.length));

      await page.evaluate(() => MS.infer.dialog());
      const dialog = page.getByRole('dialog', { name: 'Inference ladder' });
      await dialog.waitFor();
      await dialog.locator('.inf-line', { hasText: 'doubles in about 5 periods' }).getByRole('button', { name: 'Use' }).click();
      assert.match(await page.frameLocator('#child').locator('.ms-block', { hasText: 'Premium has grown' }).locator('.ms-inf').innerText(), /doubles in about 5 periods/);
      console.log('  ✓ The inference ladder gives first, second and third order lines, and Use sets the chart’s inference');

      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
