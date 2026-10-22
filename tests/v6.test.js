#!/usr/bin/env node
/*
 * Checks for v3.3 usability: the dashboard's own tabs (switch in Edit mode, add / rename / reorder /
 * delete, undo), Comment mode with the Comments pane (anchored areas that follow an inner scroll
 * bar, replies, resolve), legend and chart colours kept in step, and brand skills that read the same
 * way on every dashboard with a preview of what changes.
 *   node tests/v6.test.js      (CHROMIUM_PATH as for smoke.test.js)
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const pages = require('./fixtures/pages');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + JSON.stringify(detail).slice(0, 700))); if (!ok) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const JSZip = require(path.join(ROOT, 'vendor', 'jszip.min.js'));
  const z = new JSZip();
  z.file('acme/SKILL.md', '---\nname: Acme Insurance\n---\n# Acme brand\n\n## Typography\n- Heading font: Georgia\n- Body font: Verdana\n');
  z.file('acme/references/colors.md', '| Role | Hex |\n|---|---|\n| Primary | #7a1f5c |\n| Secondary | #d9822b |\n| Accent | #1b998b |\n| Background | #faf7f2 |\n| Surface / card | #ffffff |\n| Text | #2b2b2b |\n| Muted | #77706a |\n| Border | #e6ded3 |\n\nChart palette: #7a1f5c, #d9822b, #1b998b, #c2a83e\n');
  const zipB64 = (await z.generateAsync({ type: 'nodebuffer' })).toString('base64');

  for (const target of ['mothership.html', 'dist/mothership-standalone.html']) {
    console.log('Editor: ' + target);
    const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, target));
    const open = async (html, name) => { await page.evaluate(([h, n]) => { MS.dirty = false; return MS.openHtml(h, n); }, [html, name]); await wait(1800); };
    const frame = () => page.frames().find(f => f !== page.mainFrame());

    /* ---------------- the dashboard's own tabs */
    await open(pages.owntabs(), 'owntabs.html');
    const tabs = () => page.evaluate(() => MS.pageTabs.list().map(t => (t.active ? '*' : '') + t.title).join(','));
    check('own tabs: found with their names', await tabs() === '*Overview,Claims,Notes', await tabs());
    check('own tabs: listed in the left panel', await page.evaluate(() => /Your tabs \(3\)/.test(document.querySelector('#outline').textContent)), '');
    await frame().locator('.tab-btn').nth(1).click(); await wait(300);
    check('own tabs: a click switches tabs in Edit mode', await tabs() === 'Overview,*Claims,Notes', await tabs());
    const pt = await page.evaluate(async () => {
      const out = {};
      MS.pageTabs.add('Losses', '<h2>Losses</h2><p>Large losses this year.</p>'); await new Promise(r => setTimeout(r, 300));
      out.add = MS.pageTabs.list().map(t => (t.active ? '*' : '') + t.title).join(',');
      out.panel = !!MS.child.doc.querySelector('[data-tab="losses"], #losses') && /Large losses/.test(MS.pageTabs.active().panel.textContent);
      MS.pageTabs.rename('Losses', 'Large losses'); MS.pageTabs.move('Large losses', 0);
      out.moved = MS.pageTabs.list().map(t => t.title).join(',');
      MS.history.undo(); MS.history.undo();
      out.undone = MS.pageTabs.list().map(t => t.title).join(',');
      out.api = (await MS.api.run('page_tabs', { action: 'rename', tab: 'Notes', title: 'Read me' })).tabs.map(t => t.title).join(',');
      await MS.api.run('page_tabs', { action: 'delete', tab: 'Losses' });
      out.after = MS.pageTabs.list().map(t => t.title).join(',');
      out.outline = (await MS.api.run('outline', {})).pageTabs.map(t => t.title).join(',');
      out.html = MS.exportHtml();
      return out;
    });
    check('own tabs: add puts a new tab and panel in the page, and shows it', pt.add === 'Overview,Claims,Notes,*Losses' && pt.panel, pt);
    check('own tabs: rename and reorder, both undoable', pt.moved === 'Large losses,Overview,Claims,Notes' && pt.undone === 'Overview,Claims,Notes,Losses', pt);
    check('own tabs: page_tabs tool and outline', pt.api === 'Overview,Claims,Read me,Losses' && pt.after === 'Overview,Claims,Read me' && pt.outline === pt.after, pt);
    check('own tabs: export keeps the renamed tab', pt.html.indexOf('Read me') > 0, '');
    const w3 = await (async () => { await open(pages.w3tabs(), 'w3tabs.html'); return page.evaluate(() => { MS.pageTabs.show(1); const a = MS.pageTabs.list().map(t => (t.active ? '*' : '') + t.title).join(','); MS.pageTabs.add('Notes'); return a + ' / ' + MS.pageTabs.list().map(t => (t.active ? '*' : '') + t.title).join(',') + ' / ' + (MS.pageTabs.active().btn.getAttribute('onclick') || ''); }); })();
    check('own tabs: onclick="openTab(…)" style tabs too', /^Summary,\*Detail \/ Summary,Detail,\*Notes \/ openTab\(event, ?'notes'\)/.test(w3), w3);

    /* ---------------- Comment mode and the Comments pane */
    await open(pages.owntabs(), 'owntabs.html');
    await page.click('[data-mode="comment"]'); await wait(200);
    await frame().locator('.kpi').first().click(); await wait(200);
    check('comments: a click opens the composer in the Comments pane (no pop-up)', await page.evaluate(() => !!MS.review.draft && !document.querySelector('#cmt-pane').hidden && !document.querySelector('.dlg-wrap')), '');
    await page.fill('#cmt-pane .cmt-draft textarea', 'The label is unclear'); await page.keyboard.press('Control+Enter'); await wait(200);
    const geo = await page.evaluate(() => { const r = MS.child.frame.getBoundingClientRect(); return { x: r.left, y: r.top, s: r.width / MS.child.frame.offsetWidth }; });
    const card = await frame().evaluate(() => { const r = document.querySelectorAll('.card')[1].getBoundingClientRect(); return { x: r.left, y: r.top }; });
    const sx = geo.x + (card.x + 10) * geo.s, sy = geo.y + (card.y + 10) * geo.s;
    await page.mouse.move(sx, sy); await page.mouse.down(); await page.mouse.move(sx + 60, sy + 40, { steps: 4 }); await page.mouse.move(sx + 140, sy + 90, { steps: 4 }); await page.mouse.up(); await wait(200);
    const draft = await page.evaluate(() => MS.review.draft && MS.review.draft.c.area);
    check('comments: dragging makes an area anchored to the content under it', !!(draft && draft.anchor && draft.anchor.ref !== 'html'), draft);
    await page.fill('#cmt-pane .cmt-draft textarea', 'Needs a source line'); await page.click('#cmt-pane .cmt-draft .btn.primary'); await wait(250);
    const areaTop = () => frame().evaluate(() => { const a = document.querySelector('#ms-cmt-layer .ms-cmt-area'); return a ? Math.round(parseFloat(a.style.top)) : null; });
    const t0 = await areaTop();
    await frame().evaluate(() => { document.querySelector('.content').scrollTop = 120; }); await wait(150);
    const t1 = await areaTop();
    check('comments: the area box moves with the inner scroll bar', t0 != null && t1 === t0 - 120, { t0, t1 });
    await frame().evaluate(() => { document.querySelector('.content').scrollTop = 0; });
    await frame().locator('.tab-btn').nth(1).click(); await wait(300);
    const away = await page.evaluate(() => ({ tab: MS.pageTabs.active().title, pins: MS.child.doc.querySelectorAll('#ms-cmt-layer > *').length, n: MS.review.list().length }));
    check('comments: tabs still switch in Comment mode, and other tabs\' pins hide', away.tab === 'Claims' && away.pins === 0 && away.n === 2, away);
    await page.click('#cmt-pane .cmt-card[data-id] .cmt-text >> nth=1'); await wait(400);
    check('comments: clicking a card goes back to its tab', await page.evaluate(() => MS.pageTabs.active().title) === 'Overview', '');
    await page.fill('#cmt-pane .cmt-card.cur .cmt-replybox textarea', 'Will add it'); await page.click('#cmt-pane .cmt-card.cur .cmt-replybox .btn'); await wait(150);
    await page.click('#cmt-pane .cmt-card.cur .cmt-acts .btn.primary'); await wait(150);
    const cm = await page.evaluate(async () => ({ list: MS.review.list().map(c => [c.kind, c.done || false, (c.replies || []).length, c.tab && c.tab.title]), prompt: MS.review.buildPrompt({ includeDone: true }), api: await MS.api.run('list_comments', {}), html: MS.exportHtml() }));
    check('comments: reply and resolve', JSON.stringify(cm.list) === JSON.stringify([['element', false, 0, 'Overview'], ['area', true, 1, 'Overview']]), cm.list);
    check('comments: replies reach the prompt and the API', cm.prompt.indexOf('Will add it') > 0 && cm.api[1].replies.length === 1, '');
    check('comments: no pins or comment styles in the export', cm.html.indexOf('id="ms-cmt-layer"') < 0 && cm.html.indexOf('id="ms-cmt-css"') < 0 && cm.html.indexOf('class="ms-cmt-pin') < 0, '');
    await page.keyboard.press('Escape');
    await page.evaluate(() => MS.setMode('edit'));

    /* ---------------- legend and chart colours */
    const lg = await page.evaluate(async () => {
      const rt = MS.rt(), mix = rt.charts().filter(c => c.el.id === 'mix')[0], sw = () => Array.from(MS.child.doc.querySelectorAll('#mixLegend .swatch')).map(s => getComputedStyle(s).backgroundColor).join(',');
      const out = { items: rt.legendItems(mix).map(i => i.name).join(','), before: sw() };
      MS.catColors.set({ Motor: '#ff0000' }); await new Promise(r => setTimeout(r, 300));
      out.chartToLegend = sw();
      MS.history.undo(); await new Promise(r => setTimeout(r, 300));
      out.undone = sw();
      MS.edit.style(MS.child.doc.querySelectorAll('#mixLegend .swatch')[1], { backgroundColor: '#00ff00' }); await new Promise(r => setTimeout(r, 300));
      out.legendToChart = rt.chartColors(mix.key).Health;
      const reg = MS.child.win.Chart.getChart(MS.child.doc.getElementById('region'));
      MS.catColors.set({ 2025: '#0000ff' }); await new Promise(r => setTimeout(r, 300));
      out.bars = reg.getDatasetMeta(1).data[0].options.backgroundColor;
      return out;
    });
    check('legend: the page\'s own legend is linked to its chart', lg.items === 'Motor,Health,Fire,Marine', lg);
    check('legend: a chart colour change recolours the legend, undo puts it back', /^rgb\(255, 0, 0\)/.test(lg.chartToLegend) && lg.undone === lg.before, lg);
    check('legend: recolouring a legend swatch recolours the chart', /^#00ff00$/i.test(lg.legendToChart), lg);
    check('legend: Chart.js bars are redrawn in the new colour', /^#0000ff$/i.test(lg.bars), lg);

    /* ---------------- brand skill: same reading everywhere, preview first */
    const read = async () => page.evaluate(z => { const bin = atob(z), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return MS.brand.fromZip(u.buffer, 'acme.zip').then(t => { window.__brand = t; return JSON.stringify({ c: t.colors, f: t.fonts, p: t.palette, n: t.name }); }); }, zipB64);
    const b1 = await read();
    const plan1 = await page.evaluate(() => MS.brand.plan(window.__brand).map.filter(m => m.on !== false).map(m => m.from + '>' + m.role).join(' '));
    const plan1b = await page.evaluate(() => MS.brand.plan(window.__brand).map.filter(m => m.on !== false).map(m => m.from + '>' + m.role).join(' '));
    await page.evaluate(() => { window.__pv = MS.brand.preview(window.__brand); }); await wait(500);
    const pv = await page.evaluate(() => ({ rows: document.querySelectorAll('.dlg .map-row').length, header: getComputedStyle(MS.child.doc.querySelector('.topbar, header, .header') || MS.child.doc.body).backgroundColor }));
    await page.click('.dlg .btn.primary'); await wait(500);
    const ap = await page.evaluate(() => ({ map: (MS.rt().state.theme.map || []).length, css: MS.child.doc.getElementById('ms-theme-css').textContent }));
    await page.evaluate(() => MS.history.undo()); await wait(300);
    const undone = await page.evaluate(() => ({ theme: !!MS.rt().state.theme, inline: MS.child.doc.querySelectorAll('[data-ms-colmap]').length }));
    await open(pages.w3tabs(), 'w3tabs.html');
    const b2 = await read();
    check('brand: the same zip reads the same on two different dashboards', b1 === b2 && /Acme Insurance/.test(b1) && /7a1f5c/.test(b1) && /Georgia/.test(b1), [b1, b2]);
    check('brand: the colour plan is the same every time', plan1 && plan1 === plan1b && /primary/.test(plan1), plan1);
    check('brand: a preview lists what changes before applying', pv.rows >= 4, pv);
    check('brand: applying swaps the dashboard\'s own colours', ap.map >= 4 && /#7a1f5c/i.test(ap.css), ap.map);
    check('brand: undo takes it all back', !undone.theme && undone.inline === 0, undone);
    const api = await page.evaluate(async z => (await MS.api.run('apply_theme', { file: { name: 'acme.zip', b64: z } })), zipB64);
    check('brand: the assistant tool applies without a dialog and reports the swaps', api.theme === 'Acme Insurance' && Array.isArray(api.swapped) && !(await page.evaluate(() => !!document.querySelector('.dlg-wrap'))), api);

    check('editor: no script errors', errors.length === 0, errors);
    await page.close();
  }
  await browser.close();
  console.log(failures ? failures + ' check(s) failed' : 'All v6 checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
