#!/usr/bin/env node
/*
 * Checks for: region and currency (US $ by default, any country or currency on request),
 * "Ready to publish?", publishing a view-only copy (version badge, release notes, password lock,
 * tamper seal) and the calm message a published file shows when part of it fails.
 *   node tests/v5.test.js      (CHROMIUM_PATH as for smoke.test.js)
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mothership-v5-'));
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + JSON.stringify(detail).slice(0, 700))); if (!ok) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const target of ['mothership.html', 'dist/mothership-standalone.html']) {
    console.log('Editor: ' + target);
    const page = await browser.newPage({ viewport: { width: 1366, height: 820 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, target));
    await page.evaluate(() => MS.samples.open('sales'));
    await wait(2500);

    /* region and currency */
    const loc = await page.evaluate(async () => {
      const rt = MS.rt(), f = () => [rt.fmtNum(1234567, 'cur'), rt.fmtNum(1234567, 'curshort'), rt.fmtNum(1234567.5, 'num'), rt.fmtNum(3.25, 'cur')];
      const out = { def: await MS.api.run('get_locale', {}), us: f(), nudge: document.querySelector('#status-msg').textContent };
      out.india = await MS.api.run('set_locale', { country: 'India' }); out.inr = f();
      out.de = await MS.api.run('set_locale', { country: 'Germany' }); out.eur = f();
      out.gbpInUs = await MS.api.run('set_locale', { country: 'US', currency: 'GBP' }); out.gbp = f();
      out.rule = MS.locale.rule();
      out.bad = await MS.api.run('set_locale', { currency: 'XYZ1' }).then(() => 'no error', e => e.message);
      MS.history.undo(); MS.history.undo(); MS.history.undo();
      out.undone = MS.locale.get().currency;
      out.countries = MS.locale.COUNTRIES.length; out.currencies = MS.locale.currencies().length;
      return out;
    });
    check('region: US dollars by default', loc.def.currency === 'USD' && loc.def.locale === 'en-US' && loc.us[0] === '$1,234,567' && loc.us[1] === '$1.23M' && loc.us[2] === '1,234,567.5' && loc.us[3] === '$3.25', loc);
    check('region: a ₹ dashboard gets a nudge, not a silent change', /₹/.test(loc.nudge) && /Region/.test(loc.nudge), loc.nudge);
    check('region: India uses ₹ with lakh and crore', loc.india.units === 'indian' && loc.inr[0] === '₹12,34,567' && loc.inr[1] === '₹12.35 L', loc.inr);
    check('region: Germany uses € and its own separators', loc.de.currency === 'EUR' && /€/.test(loc.eur[0]) && /1\.234\.567/.test(loc.eur[0]), loc.eur);
    check('region: any currency with any country', loc.gbp[0] === '£1,234,567', loc.gbp);
    check('region: AI prompts follow it', /British Pound|GBP/.test(loc.rule), loc.rule);
    check('region: unknown currency is refused', /Unknown currency|Invalid/i.test(loc.bad), loc.bad);
    check('region: undoable', loc.undone === 'USD', loc.undone);
    check('region: many countries and currencies to pick from', loc.countries >= 50 && loc.currencies >= 50, { c: loc.countries, cur: loc.currencies });

    const pr = await page.evaluate(() => {
      const P = t => { const r = MS.numcheck.parse(t); return r && r.v; }, rt = MS.rt(), k = rt.charts()[0].key;
      const out = { us: [P('$1,234.50'), P('1.234,5 €'), P('₹12,34,567'), P('₹16.2 Cr'), P('$1.2 million')] };
      out.euroTitle = rt.summarize(k, 'Revenue (€)'); out.rupeeTitle = rt.summarize(k, 'Sales (₹)'); out.plain = rt.summarize(k, 'Sales by region');
      MS.locale.set({ country: 'Germany' });
      out.de = [P('$1,234.50'), P('1.234,5 €'), P('1.234')];
      MS.history.undo();
      return out;
    });
    check('number check: reads 1,234.50 and 1.234,5 whatever the region', pr.us.join() === '1234.5,1234.5,1234567,162000000,1200000' && pr.de.join() === '1234.5,1234.5,1234', pr);
    check('summaries: a chart that names its currency keeps it', /€/.test(pr.euroTitle) && !/\$/.test(pr.euroTitle) && /₹[\d.]+ Cr/.test(pr.rupeeTitle) && /\$/.test(pr.plain), pr);

    const dlg = await page.evaluate(() => {
      MS.locale.dialog();
      const w = document.querySelector('.dlg-wrap'), sel = w.querySelector('select');
      sel.value = 'IN'; sel.dispatchEvent(new Event('change'));
      const prev = w.querySelector('.loc-prev').textContent; w.remove();
      const labels = MS.RIBBON.filter(t => Array.isArray(t.groups)).flatMap(t => t.groups.flatMap(g => (g.items || []).map(i => i.label)));
      return { prev, labels };
    });
    check('region: dialog previews the choice', /₹/.test(dlg.prev), dlg.prev);

    /* ready to publish? */
    const pf = await page.evaluate(async () => {
      await MS.api.run('add_comment', { ref: 'h1', text: 'Must fix this title', priority: 'must' });
      const r = await MS.api.run('publish_check', {});
      MS.preflight.dialog(); const n = document.querySelectorAll('.pf-item').length; document.querySelector('.dlg-wrap').remove();
      return { ready: r.ready, titles: r.items.map(x => x.status + ': ' + x.title), n };
    });
    check('publish check: lists what to look at', pf.titles.length >= 7 && pf.n === pf.titles.length, pf.titles);
    check('publish check: open must-fix comment blocks it', pf.ready === false && pf.titles.some(t => /^fail: 1 must-fix/.test(t)), pf.titles);
    check('publish check: offline sample passes the internet check', pf.titles.some(t => /^pass: Works offline/.test(t)), pf.titles);

    /* publish */
    const pub = await page.evaluate(async () => {
      MS.review.list().forEach(c => { c.done = true; });
      const a = await MS.api.run('publish', { version: '1.0', note: 'First release', by: 'Alok', as_of: '2026-09-30', password: 'secret12' });
      const st = MS.publish.stateOf(a.html);
      const out = { a: Object.assign({}, a, { html: undefined }), st: st.publish, comments: !!st.comments, html: a.html };
      out.verify = await MS.publish.verify(a.html);
      out.tamper = await MS.publish.verify(a.html.replace('Sales', 'Sa1es'));
      const work = MS.exportHtml();
      out.workLocked = MS.publish.isLocked(work); out.workSeal = MS.publish.stateOf(work).publish.seal || null; out.workLock = !!MS.publish.stateOf(work).publish.lock;
      const b = await MS.api.run('publish', { note: 'Second' });
      out.next = b.version; out.nextLocked = b.locked; out.log = MS.publish.stateOf(b.html).publish.log.length;
      const c = await MS.api.run('publish', { unlock: true }); out.unlocked = !c.locked;
      out.short = await MS.api.run('publish', { password: 'abc' }).then(() => 'no error', e => e.message);
      return out;
    });
    check('publish: version, date, note and person recorded', pub.a.version === '1.0' && pub.st.note === 'First release' && pub.st.by === 'Alok' && pub.st.asOf === '2026-09-30' && /^\d{4}-/.test(pub.st.at), pub.st);
    check('publish: comments left out', pub.comments === false, pub.comments);
    check('publish: sealed with SHA-256', /^[0-9a-f]{64}$/.test(pub.a.sha256) && pub.st.seal === pub.a.sha256 && pub.verify && pub.verify.ok === true, { a: pub.a, v: pub.verify });
    check('publish: a change outside Mothership is detected', pub.tamper && pub.tamper.ok === false, pub.tamper);
    check('publish: locked with a salted key, never the password', pub.a.locked && pub.st.lock && pub.st.lock.key.length === 64 && pub.html.indexOf('secret12') < 0, pub.st.lock);
    check('publish: the working copy is not sealed or locked', !pub.workLocked && !pub.workSeal && pub.workLock, pub);
    check('publish: next version counts on and keeps the lock', pub.next === '1.1' && pub.nextLocked && pub.log === 2 && pub.unlocked, pub);
    check('publish: short password refused', /6 characters/.test(pub.short), pub.short);

    /* opening a locked file */
    const op = await page.evaluate(async html => {
      const out = {};
      out.none = await MS.api.run('open_html', { html, name: 'p.html' }).then(() => 'opened', e => e.message);
      out.wrong = await MS.api.run('open_html', { html, name: 'p.html', password: 'nope' }).then(() => 'opened', e => e.message);
      const ok = await MS.api.run('open_html', { html, name: 'p.html', password: 'secret12' });
      await new Promise(r => setTimeout(r, 300));
      out.ok = !!ok.charts; out.published = ok.published || MS.doc.integrity;
      out.badgeInEditor = !!MS.child.doc.getElementById('ms-badge');
      MS.openHtml(html, 'p.html');
      await new Promise(r => setTimeout(r, 200));
      const w = document.querySelector('.dlg-wrap'); out.dialog = w ? w.textContent : '';
      if (w) w.querySelector('button').click();
      return out;
    }, pub.html);
    check('lock: no password, no editing', /locked/i.test(op.none), op.none);
    check('lock: wrong password refused', /Wrong password/.test(op.wrong), op.wrong);
    check('lock: right password opens it', op.ok, op);
    check('lock: opening checks the seal', op.published && op.published.ok === true && op.published.version === '1.0', op.published);
    check('lock: asks for the password in the editor', /Locked for editing/.test(op.dialog) && /version 1\.0/.test(op.dialog), op.dialog.slice(0, 300));
    check('editor: no version badge while editing', op.badgeInEditor === false, op.badgeInEditor);

    /* errors while the page first loads are caught too */
    const early = await page.evaluate(async html => {
      const bad = html.replace('<body', '<body data-x="1"').replace(/(<body[^>]*>)/, '$1<script>throw new Error("early boom");</script>');
      await MS.api.run('open_html', { html: bad, name: 'bad.html', password: 'secret12' });
      await new Promise(r => setTimeout(r, 400));
      const t = await MS.api.run('publish_check', {});
      const b64 = btoa(unescape(encodeURIComponent(html)));
      const folder = await MS.api.run('open_folder_files', { files: [{ path: 'pub/p.html', name: 'p.html', b64 }], password: 'nope' }).then(() => 'opened', e => e.message);
      return { item: t.items.find(x => /script errors/.test(x.title)), folder };
    }, pub.html);
    check('publish check: catches errors while the page loads', early.item && early.item.status === 'fail' && /early boom/.test(early.item.detail), early.item);
    check('lock: a locked file in a folder needs the right password', /Wrong password/.test(early.folder), early.folder);

    /* the published file in a browser */
    if (target === 'mothership.html') {
      const broken = pub.html.replace(/(<body[^>]*>)/, '$1<script>throw new Error("boom");</script>');
      const file = path.join(TMP, 'published.html'); fs.writeFileSync(file, broken);
      const v = await browser.newPage();
      await v.goto('file://' + file); await wait(1800);
      const view = await v.evaluate(() => {
        const b = document.getElementById('ms-badge'), e = document.getElementById('ms-errbar');
        b && b.click();
        return { badge: b ? b.textContent : '', open: b && b.classList.contains('open'), err: e ? e.textContent : '', charts: document.querySelectorAll('canvas').length, editable: document.querySelectorAll('[contenteditable]').length };
      });
      check('viewer: badge shows version, published and data dates', /Version 1\.0/.test(view.badge) && /Published/.test(view.badge) && /Data as of/.test(view.badge) && /First release/.test(view.badge) && view.open, view);
      check('viewer: charts draw, nothing is editable', view.charts >= 3 && view.editable === 0, view);
      check('viewer: a failing part shows a calm message', /didn.t load/.test(view.err) && /boom/.test(view.err), view.err);
      await v.close();
    }

    /* help */
    const hp = await page.evaluate(() => {
      const out = {};
      ['region', 'publish', 'faq'].forEach(id => { MS.help.guide(id); const b = document.querySelector('.guide-body'); out[id] = b ? b.textContent : ''; document.querySelector('.dlg-wrap').remove(); });
      return out;
    });
    check('help: region and currency explained', /US dollar/i.test(hp.region) && /Region & currency/.test(hp.region), hp.region.slice(0, 300));
    check('help: publishing is honest about the lock', /deterrent/i.test(hp.publish) && /SharePoint/.test(hp.publish), hp.publish.slice(0, 300));
    check('help: FAQ covers locking', /lock/i.test(hp.faq) && /password/i.test(hp.faq), hp.faq.slice(0, 200));

    check('ribbon: Region & currency, Ready to publish? and Publish', ['Region & currency', 'Ready to publish?', 'Publish'].every(l => dlg.labels.some(t => String(t || '').trim() === l)), dlg.labels.filter(t => /Publish|Region/.test(t || '')));
    check('editor: no script errors', errors.filter(m => !/early boom/.test(m)).length === 0, errors);
    await page.close();
  }
  await browser.close();
  console.log(failures ? failures + ' check(s) failed' : 'All v5 checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
