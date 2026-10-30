#!/usr/bin/env node
/*
 * Checks for v3.7: the top bar (document chip with Close, the Edit / Comment / Interact switch
 * with its marker, Alt+1/2/3, the coloured frame and banner on the stage), closing a dashboard
 * (asks first when there are changes, File › Close, close_dashboard), the live test runner
 * (progress card, pointer, Stop, results ring, rerun failed, run history, timings) and the
 * prompt built from failed tests, plus the welcome screen.
 *   node tests/v10.test.js      (CHROMIUM_PATH as for smoke.test.js; V10_ONLY=mothership.html for one editor)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + JSON.stringify(detail).slice(0, 700))); if (!ok) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const SALES = fs.readFileSync(path.join(ROOT, 'samples/sales-dashboard.html'), 'utf8');

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const target of (process.env.V10_ONLY ? [process.env.V10_ONLY] : ['mothership.html', 'dist/mothership-standalone.html'])) {
    console.log('Editor: ' + target);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, target));
    const open = async (html, name) => { await page.evaluate(([h, n]) => { MS.dirty = false; return MS.openHtml(h, n); }, [html, name]); await wait(2000); };

    /* ---------------- welcome screen and an empty top bar */
    const w = await page.evaluate(() => ({
      chip: MS.$('#doc-chip').classList.contains('open'), x: getComputedStyle(MS.$('#btn-close')).display,
      off: getComputedStyle(MS.$('#mode-switch')).pointerEvents, feats: MS.$$('.feature-strip .feat').length, h1: MS.$('.welcome h1').textContent
    }));
    check('welcome: hero, feature strip; mode switch is off with nothing open', w.feats === 4 && /boardroom/.test(w.h1) && w.off === 'none' && !w.chip && w.x === 'none', w);

    /* ---------------- the mode switch */
    await open(SALES, 'sales.html');
    const m0 = await page.evaluate(() => ({ chip: MS.$('#doc-chip').classList.contains('open'), name: MS.$('#doc-name').textContent, sw: MS.$('#mode-switch').getAttribute('data-mode'), frame: MS.$('#mode-frame').classList.contains('on'), st: MS.$('#status-mode').textContent, g: MS.$('#mode-switch .glider').getBoundingClientRect().width }));
    check('top bar: the document chip shows the name and a Close button', m0.chip && m0.name === 'sales.html', m0);
    check('mode switch: Edit is marked, no frame on the stage, status bar says Edit mode', m0.sw === 'edit' && !m0.frame && /Edit mode/.test(m0.st) && m0.g > 30, m0);
    await page.click('#stage', { position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.press('Alt+2'); await wait(450);
    const m1 = await page.evaluate(() => {
      const on = MS.$('#mode-switch .seg-btn.on'), g = MS.$('#mode-switch .glider').getBoundingClientRect(), b = on.getBoundingClientRect();
      return { mode: MS.mode, on: on.getAttribute('data-mode'), pressed: on.getAttribute('aria-pressed'), glide: Math.abs(g.left - b.left) < 3 && Math.abs(g.width - b.width) < 3, frame: MS.$('#mode-frame').classList.contains('on'), fm: MS.$('#mode-frame').getAttribute('data-mode'), banner: (MS.$('.mf-banner') || {}).textContent || '', st: MS.$('#status-mode').textContent };
    });
    check('Alt+2: Comment mode, the marker slides under it', m1.mode === 'comment' && m1.on === 'comment' && m1.pressed === 'true' && m1.glide, m1);
    check('Comment mode: coloured frame and banner on the stage, status bar follows', m1.frame && m1.fm === 'comment' && /Comment mode/.test(m1.banner) && /Back to Edit/.test(m1.banner) && /Comment mode/.test(m1.st), m1);
    await page.keyboard.press('Alt+3'); await wait(300);
    const m2 = await page.evaluate(() => ({ mode: MS.mode, fm: MS.$('#mode-frame').getAttribute('data-mode'), editFlag: MS.child.win.__MS_EDIT_MODE }));
    check('Alt+3: Interact mode (the dashboard gets the clicks)', m2.mode === 'interact' && m2.fm === 'interact' && m2.editFlag === false, m2);
    await page.click('.mf-back'); await wait(300);
    const m3 = await page.evaluate(() => ({ mode: MS.mode, frame: MS.$('#mode-frame').classList.contains('on') }));
    check('"Back to Edit" on the banner returns to Edit and the frame goes', m3.mode === 'edit' && !m3.frame, m3);
    await page.click('[data-mode="interact"]'); await wait(200);
    await page.keyboard.press('Alt+1'); await wait(200);
    check('Alt+1 and the buttons switch modes too', await page.evaluate(() => MS.mode) === 'edit');

    /* ---------------- closing a dashboard */
    await page.evaluate(() => MS.emit('changed', 'test change'));
    await wait(100);
    const dirty = await page.evaluate(() => MS.$('#doc-chip').classList.contains('dirty'));
    await page.click('#btn-close'); await wait(300);
    const ask = await page.evaluate(() => { const d = MS.$('.dlg'); return d ? { title: d.querySelector('.dlg-head strong').textContent, btns: [...d.querySelectorAll('.dlg-foot .btn')].map(b => b.textContent.trim()) } : null; });
    check('Close with unexported changes asks first (Cancel / Close without saving / Export, then close)', dirty && ask && /Close "sales\.html"/.test(ask.title) && ask.btns.join('|') === 'Cancel|Close without saving|Export, then close', { dirty, ask });
    await page.click('.dlg-foot .btn >> text=Cancel'); await wait(200);
    check('Cancel keeps it open', await page.evaluate(() => !!MS.child && MS.doc.name === 'sales.html'));
    await page.click('#btn-close'); await wait(250);
    await page.click('.dlg-foot .btn >> text=Close without saving'); await wait(400);
    const c1 = await page.evaluate(() => ({ child: !!MS.child, doc: MS.doc, empty: MS.$('#empty').style.display, frame: MS.$('#stage-frame-host').children.length, name: MS.$('#doc-name').textContent, chip: MS.$('#doc-chip').classList.contains('open'), undo: MS.history.canUndo ? MS.history.canUndo() : null, dirty: MS.dirty, title: document.title, outline: MS.$('#outline').textContent }));
    check('Close without saving: back to the start screen, nothing left open', !c1.child && !c1.doc && c1.empty === '' && c1.frame === 0 && c1.name === 'No dashboard open' && !c1.chip && !c1.dirty && c1.title === 'Mothership' && /Open a dashboard/.test(c1.outline), c1);
    const api0 = await page.evaluate(() => MS.api.run('close_dashboard', {}));
    check('close_dashboard with nothing open says so', api0.closed === false && /Nothing/.test(api0.note), api0);
    await open(SALES, 'sales.html');
    const fileClose = await page.evaluate(() => { const g = MS.RIBBON[0].groups[0].items.map(i => i.label); MS.cmd.close(); return { g, child: !!MS.child }; });
    await wait(300);
    check('File › Close closes a dashboard with no changes straight away', fileClose.g.includes('Close') && await page.evaluate(() => !MS.child && !MS.$('.dlg')), fileClose);
    await open(SALES, 'sales.html');
    const api1 = await page.evaluate(async () => { MS.emit('changed', 'x'); const a = await MS.api.run('close_dashboard', {}); const b = await MS.api.run('close_dashboard', { force: true }); return { a, b, child: !!MS.child }; });
    check('close_dashboard keeps unexported work unless forced', api1.a.closed === false && api1.a.unsavedChanges && api1.b.closed === true && !api1.child, api1);

    /* ---------------- the live test runner */
    await open(SALES, 'sales.html');
    await page.evaluate(() => { MS.qa.draft(); MS.qa.add({ title: 'Broken on purpose', scenario: 'Smoke', priority: 'High', steps: [{ do: 'click', target: 'chart=Sales by region', point: 'North' }, { do: 'expect_text', target: 'kpi=Total sales', value: '$999 trillion' }], expected: 'It fails' }); });
    const ids = await page.evaluate(() => MS.qa.cases().filter(c => c.auto && c.type !== 'Responsive' && c.type !== 'Accessibility').map(c => c.id));
    await page.evaluate(() => MS.qa.dialog()); await wait(300);
    await page.evaluate(ids => { MS.qa.live.pace = 'normal'; MS.qa.live.start(ids); }, ids);
    await wait(250);
    const r0 = await page.evaluate(() => ({ dlg: !!MS.$('.qa'), card: !!MS.$('#qa-runner.running'), running: !!MS.qa.running }));
    check('Run: the Testing window closes and the runner card appears', !r0.dlg && r0.card && r0.running, r0);
    // watch the pointer and the step text while it runs
    let seen = { pointer: false, step: '', bar: 0, dots: 0, hl: false };
    for (let i = 0; i < 40 && !(seen.pointer && seen.step); i++) {
      await wait(120);
      const s = await page.evaluate(() => { const c = MS.$('#qa-cursor'), hl = MS.$('#qa-hl'); return { pointer: !!(c && c.classList.contains('on')), hl: !!(hl && hl.classList.contains('on')), step: (MS.$('.qr-steptxt') || {}).textContent || '', bar: parseFloat((MS.$('.qr-bar i') || { style: {} }).style.width) || 0, dots: MS.$$('.qr-dot').length }; });
      seen = { pointer: seen.pointer || s.pointer, hl: seen.hl || s.hl, step: seen.step || s.step, bar: Math.max(seen.bar, s.bar), dots: s.dots || seen.dots };
    }
    check('runner: a pointer and an outline show what is being clicked or checked', seen.pointer && seen.hl, seen);
    check('runner: shows the step in words, a progress bar and a dot per case', seen.step.length > 5 && seen.bar > 0 && seen.dots === ids.length, seen);
    await page.waitForFunction(() => !MS.qa.running, null, { timeout: 120000 });
    await wait(400);
    const r1 = await page.evaluate(() => ({ done: !!MS.$('#qa-runner:not(.running)'), fail: MS.$('#qa-runner').classList.contains('has-fail'), title: MS.$('.qr-title').textContent, btns: MS.$$('#qa-runner .qr-foot .btn').map(b => b.textContent.trim()), ring: !!MS.$('#qa-runner .qa-ring'), runs: MS.qa.runs().length, last: MS.qa.runs().slice(-1)[0], ms: MS.qa.get('TC-001').ms, failed: MS.qa.failed().map(c => c.title) }));
    check('runner: at the end, the results ring and "N of M failed"', r1.done && r1.fail && r1.ring && /1 of \d+ failed/.test(r1.title), r1);
    check('runner: See results, Prompt from failures, Rerun failed', ['See results', 'Prompt from failures', 'Rerun failed'].every(l => r1.btns.some(b => b.indexOf(l) >= 0)), r1.btns);
    check('runs are kept in the plan (history) with times per case', r1.runs === 1 && r1.last.fail === 1 && r1.last.ran === ids.length && r1.ms >= 0 && typeof r1.ms === 'number', r1);
    check('only the broken case failed', r1.failed.length === 1 && r1.failed[0] === 'Broken on purpose', r1.failed);
    // a picture of what the failed case was looking at
    const ev = await page.evaluate(() => { const id = MS.qa.failed().filter(c => c.title === 'Broken on purpose')[0].id; return { id, pic: /^data:image\/png/.test(MS.qa.live.evid[id] || '') }; });
    check('a failed case keeps a picture of the part it was checking', ev.pic, ev);
    // rerun failed
    await page.evaluate(() => MS.qa.live.pace = 'fast');
    await page.click('#qa-runner .btn >> text=Rerun failed');
    await page.waitForFunction(() => !MS.qa.running && MS.qa.runs().length === 2, null, { timeout: 60000 });
    const r2 = await page.evaluate(() => ({ last: MS.qa.runs().slice(-1)[0], dots: MS.$$('.qr-dot').length }));
    check('Rerun failed runs only the failures', r2.last.ran === 1 && r2.last.fail === 1 && r2.dots === 1, r2);
    // Stop
    await page.evaluate(() => { MS.qa.live.pace = 'slow'; MS.qa.live.start(MS.qa.cases().filter(c => c.auto).map(c => c.id)); });
    await wait(700);
    await page.click('#qa-runner .qr-stop');
    await page.waitForFunction(() => !MS.qa.running, null, { timeout: 30000 });
    const r3 = await page.evaluate(() => ({ title: MS.$('.qr-title').textContent, last: MS.qa.runs().slice(-1)[0] }));
    check('Stop ends the run after the current step', /Stopped after/.test(r3.title) && r3.last.stopped && r3.last.ran < r3.last.total, r3);
    await page.evaluate(() => MS.qa.live.pace = 'fast');

    /* ---------------- results window */
    await page.evaluate(() => { MS.qa.live.close(); MS.qa.dialog(); }); await wait(300);
    const d0 = await page.evaluate(() => ({ ring: !!MS.$('.qa-sum .qa-ring'), chips: MS.$$('.qa-sum .qa-chip').map(c => c.textContent), trend: MS.$$('.qa-tbar').length, rows: MS.$$('.qa-row').length, shot: !!MS.$('.qa-shot img'), ms: MS.$$('.qa-ms').length }));
    check('results: ring, status chips, pass-rate history, times, failure picture', d0.ring && d0.chips.some(c => /Fail/.test(c)) && d0.trend === 3 && d0.ms > 0 && d0.shot, d0);
    await page.evaluate(() => [...MS.$$('.qa-sum .qa-chip')].find(c => /Fail/.test(c.textContent)).click()); await wait(150);
    const d1 = await page.evaluate(() => ({ rows: MS.$$('.qa-row').length, on: MS.$$('.qa-chip.on').map(c => c.textContent) }));
    check('click a status chip to show only those cases', d1.rows === 1 && /Fail/.test(d1.on[0]), d1);
    await page.evaluate(() => [...MS.$$('.qa-sum .qa-chip')].find(c => /Fail/.test(c.textContent)).click()); await wait(150);
    check('click it again to show all', await page.evaluate(() => MS.$$('.qa-row').length) === d0.rows);

    /* ---------------- prompt from failures */
    await page.click('.qa-tools .qa-fix'); await wait(300);
    const p0 = await page.evaluate(() => ({ title: MS.$$('.dlg-head strong').pop().textContent, text: MS.$$('.prompt-out').pop().value }));
    check('Prompt from failures: a dialog with the prompt', /Prompt from failed tests/.test(p0.title) && /## Your task/.test(p0.text), p0.title);
    check('the prompt lists the failed case, its failed step and what happened', /### TC-\d+: Broken on purpose/.test(p0.text) && /✗ FAILED: Expected contains “\$999 trillion”, got/.test(p0.text) && /test_run \{"ids"/.test(p0.text) && /Verdict/.test(p0.text), p0.text.slice(0, 600));
    const p1 = await page.evaluate(() => { const d = MS.$$('.dlg').pop(), sel = d.querySelectorAll('select'); sel[0].value = 'chat'; sel[0].dispatchEvent(new Event('change')); sel[1].value = 'retest'; sel[1].dispatchEvent(new Event('change')); return MS.$$('.prompt-out').pop().value; });
    check('without MCP / find the cause only: different instructions', !/test_run/.test(p1) && /quoting the exact lines/.test(p1) && /how a person can confirm/i.test(p1), p1.slice(0, 600));
    const apiP = await page.evaluate(() => MS.api.run('test_document', { format: 'failures' }));
    check('API test_document format "failures"', /Broken on purpose/.test(apiP.text) && apiP.failed.length === 1 && /fix the failures/.test(apiP.name), { name: apiP.name, failed: apiP.failed });
    await page.evaluate(() => MS.$$('.dlg-x').forEach(x => x.click()));

    /* ---------------- ribbon */
    const rib = await page.evaluate(() => MS.RIBBON.filter(t => t.tab === 'Testing')[0].groups.reduce((a, g) => a.concat(g.items.map(i => i.label)), []));
    check('Testing tab: Run all, Rerun failed, Fix failures', ['Run all', 'Rerun failed', 'Fix failures'].every(l => rib.includes(l)), rib);

    check('no script errors in the editor', errors.length === 0, errors);
    await ctx.close();
  }
  await browser.close();
  console.log(failures ? '\n' + failures + ' check(s) failed' : '\nAll v3.7 checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
