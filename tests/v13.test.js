#!/usr/bin/env node
/* Target identity, scoped reuse and local process isolation. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const run = promisify(execFile);
const root = path.resolve(__dirname, '..');
const editor = 'dist/mothership-standalone.html';
const library = fs.readFileSync(path.join(root, 'vendor/charts/chart.umd.min.js'), 'utf8');
const twoTabs = `<!doctype html><title>Regional report</title>
<nav><button role="tab" aria-controls="west" onclick="show('west')">West</button><button role="tab" aria-controls="east" onclick="show('east')">East</button></nav>
<section id="west" role="tabpanel"><h2 id="west-title">Western region</h2><button id="west-button">Refresh</button>
  <div class="kpi"><span class="label">Sales</span><strong>10</strong></div><canvas id="west-chart" width="400" height="160"></canvas></section>
<section id="east" role="tabpanel"><h2>Eastern region</h2><button id="east-button">Refresh</button><button id="disabled-button" disabled>Locked</button>
  <div class="kpi"><span class="label">Sales</span><strong>20</strong></div><canvas id="east-chart" width="400" height="160"></canvas></section>
<script>${library}</script><script>
  function show(which) {
    for (const name of ['west','east']) document.getElementById(name).style.display = name === which ? '' : 'none';
  }
  for (const name of ['west','east']) new Chart(document.getElementById(name + '-chart'), { type: 'bar',
    data: { labels: ['Jan'], datasets: [{ label: 'Amount', data: [name === 'west' ? 10 : 20] }] },
    options: { responsive: false, animation: false, plugins: { title: { display: true, text: 'Revenue' } } } });
  show('west');
</script>`;
const simple = '<!doctype html><title>Isolated fixture</title><h1>Test report</h1><button id="freeze" onclick="while (true) {}">Freeze</button>';

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mothership-qa-workflow-'));
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, editor)).href);
    const open = (html, name) => page.evaluate(([source, file]) => MS.openHtml(source, file, { force: true }), [html, name]);

    await open(twoTabs, 'regional.html');
    const identities = await page.evaluate(async () => {
      const q = MS.qa, n = q.draft({ depth: 'full' });
      const chartChecks = q.cases().filter(c => /shows the right numbers/.test(c.title)).map(c =>
        q.drv.find(c.steps.find(s => s.do === 'expect_chart_drawn').target).id);
      const buttonChecks = q.cases().filter(c => /Refresh.*button works/.test(c.title)).map(c =>
        q.drv.find(c.steps.find(s => s.do === 'click').target).id);
      const kpis = q.cases().filter(c => /KPI.*shows the right value/.test(c.title));
      const legacy = q.add({ title: 'Ambiguous by design', steps: [{ do: 'expect_chart_drawn', target: 'chart=Revenue' }] });
      const blocked = await q.runCase(legacy.id);
      const coverage = q.deep.coverage();
      const exported = MS.exportHtml();
      return { n, chartChecks, buttonChecks, kpis: kpis.map(c => c.steps.find(s => s.do === 'expect_text').target),
        blocked, issues: coverage.issues, disabled: coverage.rows.find(r => r.name === 'Locked'), exported };
    });
    assert.deepEqual(identities.chartChecks, ['west-chart', 'east-chart']);
    assert.deepEqual(identities.buttonChecks, ['west-button', 'east-button']);
    assert.equal(new Set(identities.kpis).size, 2);
    assert.equal(identities.blocked.status, 'Blocked');
    assert.match(identities.issues[0].reason, /matches 2 items/);
    assert.match(identities.disabled.reason, /disabled/i);
    await open(identities.exported, 'regional-export.html');
    assert.equal(await page.evaluate(() => MS.qa.drv.find(MS.qa.cases().find(c => /shows the right numbers/.test(c.title)).steps.find(s => s.do === 'expect_chart_drawn').target).id), 'west-chart');
    console.log('  ✓ Duplicate charts and controls get separate targets, and old ambiguous cases are blocked');

    await page.evaluate(() => { MS.qa.deep.coverageDialog(); });
    await page.getByRole('dialog', { name: 'Test coverage' }).waitFor();
    await page.getByRole('button', { name: 'Show Locked' }).click();
    await page.getByRole('dialog', { name: 'Test coverage' }).waitFor({ state: 'hidden' });
    await page.waitForFunction(() => MS.qa.tabs().some(t => t.title === 'East' && t.active));
    console.log('  ✓ Coverage can open the tab that contains a skipped control');

    const packs = await page.evaluate(async () => {
      const q = MS.qa, pack = await MS.api.run('test_pack', { action: 'save' });
      q.clear();
      const first = await MS.api.run('test_pack', { action: 'load', pack });
      const again = await MS.api.run('test_pack', { action: 'load', pack });
      const clean = q.cases().every(c => c.status === 'Not run' && !c.actual && !c.stepResults);
      return { first, again, clean, total: pack.cases.length };
    });
    assert.equal(packs.first.added, packs.total);
    assert.equal(packs.again.added, 0);
    assert.equal(packs.clean, true);

    const changes = await page.evaluate(async () => {
      const q = MS.qa;
      q.clear();
      const west = q.add({ title: 'West only', priority: 'High', steps: [{ do: 'open_tab', target: 'West' }, { do: 'expect_visible', target: 'css=#west' }] });
      const east = q.add({ title: 'East only', priority: 'High', steps: [{ do: 'open_tab', target: 'East' }, { do: 'expect_visible', target: 'css=#east' }] });
      await MS.api.run('test_changes', { action: 'baseline' });
      const before = await MS.api.run('test_changes', {});
      const el = MS.child.doc.querySelector('#west-title');
      MS.edit.commitText(el, el.innerHTML, 'Revised western report');
      const after = await MS.api.run('test_changes', {});
      const drafted = await MS.api.run('test_plan', { action: 'draft', scope: 'changed' });
      const run = await MS.api.run('test_run', { scope: 'changed' });
      const name = MS.data.addDataset('Monthly ledger', [{ Amount: 10 }], true);
      await MS.api.run('test_changes', { action: 'baseline' });
      MS.history.state('Refresh shared data', s => { s.datasets[name].rows = [{ Amount: 12 }]; });
      const shared = await MS.api.run('test_changes', {});
      return { before, after, shared, west: west.id, east: east.id, drafted: drafted.cases.slice(2), ran: run.results.map(r => r.id) };
    });
    assert.deepEqual(changes.before.changed, []);
    assert.deepEqual(changes.after.changed, ['West']);
    assert(changes.drafted.length > 0 && changes.drafted.every(c => !c.steps.some(s => s.do === 'open_tab' && s.target === 'East')));
    assert(changes.ran.includes(changes.west) && !changes.ran.includes(changes.east));
    assert.equal(changes.shared.shared, true);
    assert.deepEqual(new Set(changes.shared.changed), new Set(['West', 'East']));
    console.log('  ✓ Test packs round-trip without old results, and changes select the right sections');

    const monthly = await page.evaluate(async () => {
      const ds = MS.data.addDataset('West ledger', [{ Month: 'Jan', Amount: 10 }], true);
      const chart = MS.rt().charts().find(c => c.el.id === 'west-chart');
      MS.history.state('Bind West chart', s => {
        const c = s.charts[chart.key] = s.charts[chart.key] || {};
        c.binding = { dataset: ds, levels: ['Month'], measure: 'Amount', agg: 'sum' };
      });
      await MS.api.run('test_changes', { action: 'baseline' });
      return { html: MS.exportHtml(), ds };
    });
    await open(monthly.html, 'monthly-report.html');
    const persisted = await page.evaluate(async ds => {
      const unchanged = await MS.api.run('test_changes', {});
      MS.history.state('Refresh West ledger', s => { s.datasets[ds].rows = [{ Month: 'Jan', Amount: 42 }]; });
      const changed = await MS.api.run('test_changes', {});
      return { unchanged, changed };
    }, monthly.ds);
    assert.deepEqual(persisted.unchanged.changed, []);
    assert.deepEqual(persisted.changed.changed, ['West']);
    assert.deepEqual(persisted.changed.datasets, [monthly.ds]);
    console.log('  ✓ The saved comparison survives export and scopes a dataset refresh to its bound tab');

    await open(simple, 'isolation.html');
    const smoke = await page.evaluate(async () => {
      const q = MS.qa, runtime = MS.rt(), original = runtime.refresh;
      for (let i = 0; i < 15; i++) q.add({ title: 'Critical check ' + i, priority: 'High', steps: [{ do: 'expect_no_errors' }] });
      q.add({ title: 'Expensive case', priority: 'High', steps: [{ do: 'wait', value: 10000 }] });
      let refreshes = 0;
      runtime.refresh = function (...args) { if (args[0] === true) refreshes++; return original.apply(this, args); };
      const before = MS.history.labels().length, r = await MS.api.run('test_run', { scope: 'smoke' });
      const history = MS.history.labels().length - before;
      runtime.refresh = original;
      return { outcomes: r.results, history, refreshes };
    });
    assert.equal(smoke.outcomes.length, 12);
    assert(smoke.outcomes.every(x => x.status === 'Pass'));
    assert.equal(smoke.history, 1);
    assert.equal(smoke.refreshes, 0);
    console.log('  ✓ Smoke runs only critical checks and save the batch without a dashboard redraw');

    async function runJob(job, name, timeout) {
      const input = path.join(tmp, name + '.json'), output = path.join(tmp, name + '-results.json');
      fs.writeFileSync(input, JSON.stringify(job));
      let exitCode = 0;
      try {
        await run(process.execPath, [path.join(root, 'tools/run-dashboard-tests.js'), input, '--timeout', String(timeout), '--out', output], { timeout: 20000 });
      } catch (e) {
        if (e.code !== 2) throw e;
        exitCode = e.code;
      }
      return { exitCode, result: JSON.parse(fs.readFileSync(output, 'utf8')) };
    }

    const job = await page.evaluate(() => MS.qa.workflow.makeJob('smoke'));
    const completed = await runJob(job, 'complete', 12);
    assert.equal(completed.exitCode, 0);
    assert.equal(completed.result.results.length, 12);
    const imported = await page.evaluate(async result => {
      const q = MS.qa, first = await q.workflow.loadRun(result);
      const repeated = await q.workflow.loadRun(result).then(() => '', e => e.message);
      const el = MS.child.doc.querySelector('h1');
      MS.edit.commitText(el, el.innerHTML, 'Changed after job');
      const stale = await q.workflow.loadRun({ ...result, id: 'other-job' }).then(() => '', e => e.message);
      return { first, repeated, stale };
    }, completed.result);
    assert.deepEqual(imported.first, { imported: 12, stopped: false });
    assert.match(imported.repeated, /already been imported/);
    assert.match(imported.stale, /different dashboard revision/);

    const blockedJob = await page.evaluate(async () => {
      const q = MS.qa; q.clear();
      q.add({ title: 'Before the hang', steps: [{ do: 'expect_no_errors' }] });
      q.add({ title: 'Deliberately unresponsive page', steps: [{ do: 'click', target: 'css=#freeze' }] });
      return q.workflow.makeJob('all');
    });
    const interrupted = await runJob(blockedJob, 'interrupted', 3);
    assert.equal(interrupted.exitCode, 2);
    assert.equal(interrupted.result.stopped, true);
    assert(interrupted.result.results.every(x => x.title === 'Before the hang'));
    assert.equal(await page.frameLocator('#child').locator('h1').innerText(), 'Changed after job');
    assert.deepEqual(errors, []);
    console.log('  ✓ Isolated runs import only matching results and enforce a hard timeout without hanging the editor');
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
