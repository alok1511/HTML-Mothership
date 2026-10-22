#!/usr/bin/env node
/*
 * Checks for v3.5 (client work): the firm template and its lock, the review stage stamp, "Client
 * confidential", removing client names, the change log in the file, the colour-blind check, chart
 * annotations pinned to points, sources and footnotes, the storyline, assigning comments with
 * @mentions, the print layout (PDF) and the PowerPoint export.
 *   node tests/v8.test.js      (CHROMIUM_PATH as for smoke.test.js; V8_ONLY=mothership.html for one editor)
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const pages = require('./fixtures/pages');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + JSON.stringify(detail).slice(0, 700))); if (!ok) failures++; };
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const target of (process.env.V8_ONLY ? [process.env.V8_ONLY] : ['mothership.html', 'dist/mothership-standalone.html'])) {
    console.log('Editor: ' + target);
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 820 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('file://' + path.join(ROOT, target));
    const open = async (html, name) => { await page.evaluate(([h, n]) => { MS.dirty = false; return MS.openHtml(h, n); }, [html, name]); await wait(1800); };
    // an exported file on its own, as a client would open it
    const viewer = async html => { const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); await p.setContent(html); await wait(1500); p.errs = errs; return p; };

    /* ---------------- firm template: snap, lock, password */
    await open(pages.owntabs(), 'acme-portfolio.html');
    const fm = await page.evaluate(async () => {
      await MS.api.run('firm_template', { action: 'apply', template: { name: 'Contoso Advisory', footer: 'Prepared for Acme Insurance. Not for third parties.', theme: { colors: { primary: '#7c3aed' }, palette: ['#7c3aed', '#0ea5e9', '#f59e0b'], fonts: { body: 'Georgia' } } }, lock: true });
      await new Promise(r => setTimeout(r, 300));
      const d = MS.child.doc, foot = d.getElementById('ms-firm-foot'), rt = MS.rt();
      const themeBefore = rt.state.theme.name;
      MS.brand.apply(MS.brand.normalize({ name: 'Rogue', colors: { primary: '#ff0000' } }, 'x'));
      const blocked = rt.state.theme.name === themeBefore;
      await MS.firm.lock(true, 'secret1');
      const wrong = await MS.firm.lock(false, 'nope');
      const stillLocked = MS.firm.locked();
      const right = await MS.firm.lock(false, 'secret1');
      MS.brand.apply(MS.brand.normalize({ name: 'Allowed', colors: { primary: '#0f766e' } }, 'x'));
      const allowed = rt.state.theme.name === 'Allowed';
      MS.history.undo(); await MS.firm.lock(true);
      return { foot: foot && foot.textContent, last: d.body.lastElementChild === foot || !foot.nextElementSibling || /^ms-/.test(foot.nextElementSibling.id || '') || foot.nextElementSibling.tagName === 'SCRIPT', palette: rt.state.theme.palette, blocked, wrong, stillLocked, right, allowed, locked: MS.firm.locked() };
    });
    check('firm: the template sets brand colours, palette and a footer with the disclaimer', /Contoso Advisory/.test(fm.foot) && /Not for third parties/.test(fm.foot) && fm.palette[0] === '#7c3aed', fm);
    check('firm: locked, the brand can\'t be changed; the password unlocks it', fm.blocked && fm.wrong === false && fm.stillLocked && fm.right === true && fm.allowed && fm.locked, fm);

    /* ---------------- stage, confidential, change log */
    const sg = await page.evaluate(async () => {
      await MS.api.run('add_comment', { ref: '.kpi', text: 'Check the loss ratio @AK' });
      const r1 = await MS.api.run('stage', { stage: 'review' });
      const stamp = MS.child.doc.getElementById('ms-stamp');
      const s1 = stamp && stamp.textContent;
      await MS.api.run('confidential', { on: true });
      const wm = !!MS.child.doc.getElementById('ms-watermark'), conf = MS.child.doc.querySelector('#ms-firm-foot .ms-ff-conf');
      const log = await MS.api.run('change_log', {});
      return { s1, blockers: r1.blockers, wm, conf: conf && conf.textContent, log: log.map(x => x.what) };
    });
    check('stage: "In review" stamp; open comments block client-ready', sg.s1 === 'In review' && sg.blockers.some(b => /open comment/.test(b)), sg);
    check('confidential: a watermark and a label in the footer', sg.wm && sg.conf === 'Client confidential', sg);
    check('change log: every change is listed with what it was', ['Apply firm template "Contoso Advisory"', 'Stage: In review', 'Mark client confidential'].every(w => sg.log.indexOf(w) >= 0), sg.log);

    /* ---------------- assigning comments */
    const as = await page.evaluate(async () => {
      MS.prefs.set('author', 'Alok Kumar');
      const list = await MS.api.run('list_comments', {});
      const c = list[0];
      const me = MS.review.forMe(MS.rt().state.comments[0]);
      await MS.api.run('update_comment', { id: c.id, to: 'PS' });
      const cc = MS.rt().state.comments[0], other = cc.to === 'PS' && MS.review.forMe(cc, 'Priya Shah') && !MS.review.forMe(cc, 'Zed Quinn');
      MS.review.reply(c.id, 'Over to you @Alok');
      const back = MS.review.forMe(MS.rt().state.comments[0]);
      MS.review.showPane(true); MS.review.filter = 'mine'; MS.review.renderPane();
      const shown = document.querySelectorAll('#cmt-pane .cmt-card').length, chip = !!document.querySelector('#cmt-pane .tag.who');
      MS.review.filter = 'open'; MS.review.showPane(false);
      return { to: c.to, mentions: c.mentions, me, other, back, shown, chip };
    });
    check('review: an @mention assigns the comment; "For me" finds it by initials or first name', as.to === 'AK' && as.me && as.other && as.back && as.shown === 1 && as.chip, as);

    /* ---------------- annotations pinned to a point */
    const an = await page.evaluate(async () => {
      const x = await MS.api.run('annotate', { action: 'add', chart: 'Premium by region', label: 'West', series: 1, text: 'West leads growth', kind: 'callout' });
      await new Promise(r => setTimeout(r, 900));
      const d = MS.child.doc, box = d.querySelector('.ms-annot[data-id="' + x.id + '"]'), dot = d.querySelector('.ms-annot-layer circle');
      const cv = d.getElementById('region'), ch = MS.child.win.Chart.getChart(cv), el = ch.getDatasetMeta(1).data[3];
      const r = cv.getBoundingClientRect(), dr = dot.getBoundingClientRect();
      const off = Math.hypot(dr.left + dr.width / 2 - (r.left + el.x), dr.top + dr.height / 2 - (r.top + el.y));
      MS.child.win.dispatchEvent(new MS.child.win.CustomEvent('ms:annot-move', { detail: { id: x.id, dx: 10, dy: -80 } }));
      await new Promise(r2 => setTimeout(r2, 300));
      const moved = MS.annotate.get(x.id);
      await MS.api.run('annotate', { action: 'add', chart: 'Premium mix', label: 'Health', text: 'Fastest growing line', kind: 'sowhat' });
      await MS.api.run('annotate', { action: 'add', chart: 'Premium by region', label: 'North', text: 'Flat', kind: 'arrow' });
      await new Promise(r2 => setTimeout(r2, 700));
      return { text: box && box.textContent, off: Math.round(off), dx: moved.dx, dy: moved.dy, sowhat: !!d.querySelector('.ms-annot-sowhat b'), arrow: !!d.querySelector('.ms-annot-layer polygon'), n: d.querySelectorAll('.ms-annot').length };
    });
    check('annotations: a callout sits on its data point (the "West, 2025" bar)', an.text === 'West leads growth' && an.off <= 3, an);
    check('annotations: dragged notes keep their place; arrows and "so what" boxes too', an.dx === 10 && an.dy === -80 && an.sowhat && an.arrow && an.n === 3, an);

    /* ---------------- sources and footnotes */
    const so = await page.evaluate(async () => {
      await MS.api.run('chart_source', { chart: 'Premium by region', text: 'Policy admin extract', as_of: '2025-09-30', all: true });
      await new Promise(r => setTimeout(r, 300));
      const d = MS.child.doc, line = d.querySelector('.ms-source[data-for]');
      const rep = await MS.api.run('chart_source', {});
      MS.edit.select(null);
      const fn = await MS.api.run('insert_footnotes', { notes: ['Figures in US$ millions.'] });
      const block = d.querySelector('.ms-footnotes');
      return { line: line && line.textContent, missing: rep.missing, n: d.querySelectorAll('.ms-source').length, block: block && block.textContent, owned: block && block.hasAttribute('data-ms-own') };
    });
    check('sources: "Source: … · As of …" under the chart; one entry sets every chart', /^Source: Policy admin extract · As of (30 Sep 2025|Sep 30, 2025)$/.test(so.line) && so.missing.length === 0 && so.n >= 2, so);
    check('footnotes: a block lists each chart\'s source, extra notes and the disclaimer', /Notes and sources/.test(so.block) && /Premium by region\. Source: Policy admin extract/.test(so.block) && /US\$ millions/.test(so.block) && /Not for third parties/.test(so.block) && so.owned, so);

    /* ---------------- storyline */
    const st = await page.evaluate(async () => {
      const dr = await MS.api.run('story', { action: 'draft' });
      await MS.api.run('story', { action: 'update', index: 0, headline: 'Motor is still the biggest line' });
      await MS.api.run('story', { action: 'title', title: 'FY25 review' });
      MS.story.play(0);
      await new Promise(r => setTimeout(r, 900));
      const d = MS.child.doc, ui = d.getElementById('ms-story'), spot = d.getElementById('ms-story-spot');
      const h0 = ui && ui.querySelector('h2').textContent, n0 = ui && ui.querySelector('.ms-st-n').textContent;
      const sr = spot.getBoundingClientRect(), mix = d.getElementById('mix').getBoundingClientRect();
      const lit = sr.left <= mix.left && sr.right >= mix.right && sr.top <= mix.top && sr.bottom >= mix.bottom;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await new Promise(r => setTimeout(r, 300));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); await new Promise(r => setTimeout(r, 500));
      const tab = MS.pageTabs.active().title, i2 = MS.rt().story.i;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await new Promise(r => setTimeout(r, 200));
      return { steps: dr.steps.length, h0, n0, lit, tab, i2, closed: !d.getElementById('ms-story') && !d.getElementById('ms-story-spot') };
    });
    check('story: a draft step per chart; playing lights up the part and shows its headline', st.steps === 4 && st.h0 === 'Motor is still the biggest line' && /FY25 review · Step 1 of 4/.test(st.n0) && st.lit, st);
    check('story: arrow keys step through, switching tabs; Esc ends it', st.i2 === 2 && st.tab === 'Claims' && st.closed, st);

    /* ---------------- colour-blind check */
    const cb = await page.evaluate(async () => {
      MS.firm.lock(false);
      MS.history.state('colours', s => { s.layout.colors = { Health: '#59a14f', Motor: '#e15759' }; });
      await new Promise(r => setTimeout(r, 300));
      const r1 = await MS.api.run('colour_blind_check', {});
      const hit = r1.problems.some(p => /Motor|Health/.test(p.a + p.b) && /green-blind/.test(p.who));
      const r2 = await MS.api.run('colour_blind_check', { fix: true });
      const ax = MS.a11y.check().filter(f => f.kind === 'cvd').length;
      MS.cvd.preview('deutan'); const on = !!MS.child.doc.getElementById('ms-cvd-css'); MS.cvd.preview(null);
      return { hit, left: r2.left, pal: MS.rt().state.theme.palette[0], ax, on, off: !MS.child.doc.getElementById('ms-cvd-css') };
    });
    check('colour-blind: red/green that clash for green-blind readers are found; the safe palette fixes them', cb.hit && cb.left === 0 && cb.pal === '#0072B2' && cb.ax === 0, cb);
    check('colour-blind: preview as a green-blind reader, then back', cb.on && cb.off, cb);

    /* ---------------- the exported file keeps it all */
    const html = await page.evaluate(() => MS.exportHtml());
    const v = await viewer(html);
    await v.evaluate(() => window.__MS_RT.showPageTab(0)); await wait(900);
    const ex = await v.evaluate(() => ({ foot: !!document.getElementById('ms-firm-foot'), wm: !!document.getElementById('ms-watermark'), stamp: (document.getElementById('ms-stamp') || {}).textContent, btn: (document.getElementById('ms-story-btn') || {}).textContent, annots: document.querySelectorAll('.ms-annot').length, src: document.querySelectorAll('.ms-source').length, log: (window.__MS_RT.state.changeLog || []).length, fn: !!document.querySelector('.ms-footnotes') }));
    await v.evaluate(() => document.getElementById('ms-story-btn').click()); await wait(400);
    const played = await v.evaluate(() => !!document.getElementById('ms-story'));
    check('export: footer, watermark, stamp, annotations, sources, footnotes and the change log are in the file', ex.foot && ex.wm && ex.stamp === 'In review' && ex.annots >= 2 && ex.src >= 2 && ex.log > 5 && ex.fn, ex);
    check('export: a "Play the story" button plays it without Mothership', /FY25 review \(4\)/.test(ex.btn) && played && v.errs.length === 0, { ex, played, errs: v.errs });
    await v.close();
    await open(html, 'acme-portfolio.html');
    const re = await page.evaluate(() => ({ log: MS.audit.list().length, firm: MS.firm.current() && MS.firm.current().name }));
    check('reopen: the change log and the firm template come back', re.log > 5 && re.firm === 'Contoso Advisory', re);

    /* ---------------- removing client names */
    const sc = await page.evaluate(async () => {
      const r = await MS.api.run('scrub_names', { names: [{ from: 'Acme Insurance', to: 'the client' }, { from: 'Health', to: 'Line B' }] });
      const still = (MS.exportHtml().match(/Health/g) || []).length;
      return { replaced: r.replaced, left: r.left, inCopy: (r.html.match(/Health|Acme Insurance/g) || []).length, still, html: r.html };
    });
    check('names: a cleaned copy has none of the names (text, chart labels, data, footer); this dashboard is unchanged', sc.replaced[0].n >= 1 && sc.replaced[1].n >= 3 && sc.left === 0 && sc.inCopy === 0 && sc.still > 0, { r: sc.replaced, left: sc.left, inCopy: sc.inCopy, still: sc.still });
    const v2 = await viewer(sc.html);
    const lab = await v2.evaluate(() => Chart.getChart(document.getElementById('mix')).data.labels.join(','));
    check('names: the cleaned copy\'s charts show the new name', lab === 'Motor,Line B,Fire,Marine', lab);
    await v2.close();
    const here = await page.evaluate(async () => { await MS.api.run('scrub_names', { names: [{ from: 'Health', to: 'Line B' }], where: 'here' }); await new Promise(r => setTimeout(r, 1500)); return { left: (MS.exportHtml().match(/Health/g) || []).length, versions: (await MS.store.all('versions')).filter(x => /Before client names/.test(x.value.name)).length }; });
    check('names: cleaning this dashboard saves a version first', here.left === 0 && here.versions >= 1, here);

    /* ---------------- PDF: print layout, one page per tab */
    const pl = await page.evaluate(async () => { const r = await MS.api.run('print_layout', {}); return r; });
    const pp = await ctx.newPage(); await pp.setContent(pl.html); await wait(600);
    const pinfo = await pp.evaluate(() => ({ pages: document.querySelectorAll('.mp-page').length, imgs: document.querySelectorAll('.mp-body img').length, canv: document.querySelectorAll('.mp-body canvas').length, head: document.querySelector('.mp-head h1').textContent, foot: document.querySelector('.mp-foot').textContent }));
    const pdf = await pp.pdf({ preferCSSPageSize: true, printBackground: true });
    const pdfPages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    await pp.close();
    check('PDF: one page per tab, charts as pictures, firm footer and page numbers', pl.pages.join('|') === 'Overview|Claims|Notes' && pinfo.pages === 3 && pinfo.imgs >= 4 && pinfo.canv === 0 && /Page 1 of 3/.test(pinfo.foot) && /CLIENT CONFIDENTIAL|Client confidential/i.test(pinfo.foot), pinfo);
    check('PDF: printing makes exactly 3 pages (each tab fitted to one A4 landscape page)', pdfPages === 3, pdfPages);

    /* ---------------- PowerPoint */
    const px = await page.evaluate(async () => { const r = await MS.api.run('export_pptx', {}); const s = await MS.api.run('export_pptx', { from: 'story' }); return { r, s: s.slides }; });
    const file = path.join(os.tmpdir(), 'ms-v8-' + Date.now() + '.pptx');
    fs.writeFileSync(file, Buffer.from(px.r.b64, 'base64'));
    let deck = null;
    try {
      deck = JSON.parse(execFileSync('python3', ['-c', 'import sys,json\nfrom pptx import Presentation\np=Presentation(sys.argv[1])\nprint(json.dumps([{"title":[s.text_frame.text for s in sl.shapes if s.has_text_frame][0],"pics":sum(1 for s in sl.shapes if s.shape_type==13)} for sl in p.slides]))', file]).toString());
    } catch (e) { deck = { error: String(e.message).slice(0, 300) }; }
    check('PowerPoint: one slide per tab with an editable title and the page as a picture (opens in python-pptx)', Array.isArray(deck) && deck.map(s => s.title).join('|') === 'Overview|Claims|Notes' && deck.every(s => s.pics >= 1), deck);
    check('PowerPoint: one slide per story step too', px.s === 4, px.s);
    fs.unlinkSync(file);

    check('editor: no script errors', errors.length === 0, errors);
    await ctx.close();
  }
  await browser.close();
  if (failures) { console.log(failures + ' check(s) failed'); process.exit(1); }
  console.log('All v8 checks passed');
})().catch(e => { console.error(e); process.exit(1); });
