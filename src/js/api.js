/* MS.api: every Mothership feature as a plain function that takes one JSON object and
   returns JSON (or a Promise of it), with no dialogs. Used by the MCP server
   (tools/mcp/mothership-mcp.js), by plugins, and by anyone scripting Mothership.
   Each entry: { d: description, p: { param: [type, description, required?] }, f: function (args) }. */
(function (MS) {
  'use strict';
  var A = {};
  function rt() { var r = MS.rt(); if (!r) throw new Error(MS.child ? 'The dashboard\'s scripts are off (Safe mode).' : 'No dashboard is open. Use open_file or new_dashboard first.'); return r; }
  function low(x) { return String(x == null ? '' : x).trim().toLowerCase(); }
  function doc() { if (!MS.child) throw new Error('No dashboard is open.'); return MS.child.doc; }
  function chartKey(c) {
    var r = rt(), cs = r.charts();
    if (c == null || c === '') { var k = MS.charts.selectedKey(); if (k) return k; throw new Error('Say which chart (its name or key).'); }
    var hit = cs.filter(function (x) { return x.key === c; })[0] || cs.filter(function (x) { return low(MS.charts.nameOf(x.key)) === low(c); })[0] || cs.filter(function (x) { return low(MS.charts.nameOf(x.key)).indexOf(low(c)) >= 0; })[0];
    if (!hit && typeof c === 'number') hit = cs[c];
    if (!hit) throw new Error('No chart called "' + c + '". Charts: ' + cs.map(function (x) { return MS.charts.nameOf(x.key); }).join(', '));
    return hit.key;
  }
  function tabOf(t) {
    var r = rt(); if (!r.layoutEnabled()) throw new Error('Tabs are off. Call layout first.');
    var tabs = r.tabs(), hit = tabs.filter(function (x) { return x.id === t || low(x.title) === low(t); })[0];
    if (!hit && typeof t === 'number') hit = tabs[t];
    if (!hit) throw new Error('No tab "' + t + '". Tabs: ' + tabs.map(function (x) { return x.title; }).join(', '));
    return hit;
  }
  // an element: a ref returned by find(), a [data-ms-…] selector, or any CSS selector
  function elOf(ref) {
    var d = doc(), el = null;
    if (!ref) { if (MS.sel) return MS.sel; throw new Error('Say which element (a ref from find, or a CSS selector).'); }
    if (/^[\w-]+$/.test(ref)) el = d.querySelector('[data-ms-ref="' + ref + '"],[data-ms-id="' + ref + '"]');
    if (!el) try { el = d.querySelector(ref); } catch (e) {}
    if (!el) throw new Error('No element matches "' + ref + '".');
    return el;
  }
  function refOf(el) {
    if (el.getAttribute('data-ms-id')) return el.getAttribute('data-ms-id');
    var r = el.getAttribute('data-ms-ref'); if (!r) { r = rt().uid('r'); el.setAttribute('data-ms-ref', r); } return r;
  }
  function done(x) { return x === undefined ? { ok: true } : x; }
  function settle(ms) { return new Promise(function (res) { setTimeout(res, ms || 120); }); }
  function fileOf(o) {
    var bin = atob(o.b64 || ''), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    var f = new File([u], o.name || 'file', { type: o.type || '' });
    if (o.path) try { Object.defineProperty(f, 'webkitRelativePath', { value: o.path }); } catch (e) {}
    return f;
  }
  function chartSummary(c) {
    var r = rt(), info = r.chartInfo(c.key) || {}, cs = r.state.charts[c.key] || {}, sec = c.el.closest('section.ms-tab');
    return { key: c.key, name: MS.charts.nameOf(c.key), kind: MS.charts.kindName(info.type), tab: sec ? sec.getAttribute('data-ms-title') : null, labels: (info.labels || []).slice(0, 30), series: info.series, linkedData: cs.binding || null, tooltip: cs.tooltip || null, look: cs.style || null, hasCommentary: !!c.el.closest('.ms-block') };
  }

  /* ---------------------------------------------------------- documents */
  A.open_html = { d: 'Open a dashboard from its HTML source. A published file locked for editing needs its password.', p: { html: ['string', 'The HTML', true], name: ['string', 'File name to show, e.g. sales.html'], password: ['string', 'Password, for a published file locked for editing'] },
    f: function (a) {
      if (MS.publish.isLocked(a.html) && a.password == null) throw new Error('This file is locked for editing. Pass its password.');
      return MS.openHtml(a.html, a.name || 'dashboard.html', { password: a.password == null ? undefined : a.password }).then(function () { return settle(1800); }).then(function () { var o = A.outline.f({}); return MS.doc && MS.doc.integrity ? Object.assign(o, { published: MS.doc.integrity }) : o; });
    } };
  A.open_folder_files = { d: 'Open a dashboard together with its scripts, styles, images and data (files as base64). The MCP open_folder tool fills this in for you.', p: { files: ['array', '[{path, name, b64}] with paths relative to the folder', true], password: ['string', 'Password, for a published file locked for editing'] },
    f: function (a) { return Promise.resolve(MS.openFolder(a.files.map(fileOf), { password: a.password })).then(function (ok) { if (ok === false) throw new Error('Not opened: the dashboard is locked for editing.'); return settle(2500); }).then(function () { return A.outline.f({}); }); } };
  A.new_dashboard = { d: 'Start a new dashboard from scratch.', p: { title: ['string', 'Dashboard name'], tabs: ['boolean', 'Start with Overview, How to use, FAQs and Methodology tabs (default true)'] },
    f: function (a) {
      MS.dirty = false; MS.compose.newDoc();
      var dlg = document.querySelector('.dlg'); var inp = dlg.querySelectorAll('input,select');
      inp[0].value = a.title || 'New dashboard'; inp[1].value = a.tabs === false ? 'blank' : 'tabs';
      dlg.querySelector('.btn.primary').click();
      return settle(1500).then(function () { return A.outline.f({}); });
    } };
  A.outline = { d: 'Everything about the open dashboard: tabs, charts (names, kinds, categories, settings), datasets and their columns, KPI cards, filters, comments, theme, layout.', p: {},
    f: function () {
      if (!MS.child) return { open: false };
      var r = MS.rt(); if (!r) return { open: true, name: MS.doc.name, safeMode: true };
      return {
        open: true, name: MS.doc.name, mode: MS.mode, unsavedChanges: !!MS.dirty, tabbed: r.layoutEnabled(), activeTab: r.layoutEnabled() ? (r.tabs().filter(function (t) { return t.id === r.activeTab; })[0] || {}).title : null,
        tabs: r.layoutEnabled() ? r.tabs().map(function (t) { return { id: t.id, title: t.title, kind: t.kind, hidden: t.hidden, notes: t.notes || '' }; }) : [],
        charts: r.charts().map(chartSummary),
        datasets: Object.keys(r.state.datasets).map(function (n) { return { name: n, rows: r.getRows(n).length, columns: r.fields(n), embedded: !!r.state.datasets[n].rows }; }),
        kpis: r.state.kpis, filters: r.state.filters, filterPane: r.state.layout.pane, ribbon: r.state.layout.ribbon,
        categoryOrders: r.state.layout.orders, categoryColors: r.state.layout.colors, popupStyle: r.state.layout.tip,
        theme: r.state.theme ? { name: r.state.theme.name, colors: r.state.theme.colors, fonts: r.state.theme.fonts, palette: r.state.theme.palette } : null,
        pageTabs: !r.layoutEnabled() && MS.pageTabs.has() ? MS.pageTabs.list().map(function (t) { return { index: t.index, title: t.title, active: t.active }; }) : [],
        comments: (r.state.comments || []).length, zoom: { scale: MS.view.scale, drawnAt: MS.view.renderWidth }
      };
    } };
  A.export_html = { d: 'The edited dashboard as one standalone HTML file (returns the HTML; the MCP tool saves it to a path).', p: { drop_comments: ['boolean', 'Leave review comments out'] },
    f: function (a) { var h = MS.exportHtml({ dropComments: !!a.drop_comments }); MS.dirty = false; MS.emit('saved'); return { html: h, bytes: h.length, name: MS.exportName() }; } };
  A.save_version = { d: 'Keep a named version in the browser (restore from File › Versions).', p: { name: ['string', 'Version name'] }, f: function (a) { return MS.versions.save(a.name || 'Saved by assistant', true).then(function () { return { ok: true }; }); } };
  A.undo = { d: 'Undo the last change.', p: {}, f: function () { MS.history.undo(); return { ok: true, canUndo: MS.history.canUndo() }; } };
  A.redo = { d: 'Redo.', p: {}, f: function () { MS.history.redo(); return { ok: true, canRedo: MS.history.canRedo() }; } };
  A.set_mode = { d: 'Edit, comment or interact mode.', p: { mode: ['string', 'edit | comment | interact', true] }, f: function (a) { MS.setMode(/^(interact|comment)$/.test(a.mode) ? a.mode : 'edit'); return done(); } };
  A.zoom = { d: 'Zoom the view and the width the dashboard is drawn at.', p: { zoom: ['string', '"fit" or a number like 1.25'], width: ['string', '"auto", "panel", or pixels like 1366'] },
    f: function (a) { if (a.width != null) MS.view.setWidth(a.width === 'auto' || a.width === 'panel' ? a.width : +a.width); if (a.zoom != null) MS.view.setZoom(a.zoom === 'fit' ? 'fit' : +a.zoom); return { scale: MS.view.scale, drawnAt: MS.view.renderWidth }; } };

  /* ---------------------------------------------------------- elements */
  A.find = { d: 'Find elements by visible text and/or CSS selector. Returns refs to use with other tools.', p: { text: ['string', 'Text to look for (case-insensitive)'], selector: ['string', 'CSS selector'], limit: ['number', 'Max results (default 20)'] },
    f: function (a) {
      var d = doc(), out = [], q = low(a.text), lim = a.limit || 20;
      var cand = a.selector ? MS.$$(a.selector, d) : MS.$$('body *', d).filter(function (n) { return !/^(SCRIPT|STYLE|LINK|META)$/.test(n.tagName) && !n.closest('[data-ms-editor]'); });
      for (var i = 0; i < cand.length && out.length < lim; i++) {
        var n = cand[i];
        if (q) { var own = Array.prototype.some.call(n.childNodes, function (c) { return c.nodeType === 3 && low(c.textContent).indexOf(q) >= 0; }); if (!own && low(n.getAttribute('aria-label') || n.getAttribute('title')).indexOf(q) < 0) continue; }
        var sec = n.closest('section.ms-tab');
        out.push({ ref: refOf(n), what: MS.review.describe(n).what, tab: sec ? sec.getAttribute('data-ms-title') : null, tag: n.tagName.toLowerCase(), visible: n.offsetParent !== null });
      }
      return out;
    } };
  A.select = { d: 'Select an element (as if clicked in Edit mode) and scroll to it.', p: { ref: ['string', 'Element ref or selector', true] }, f: function (a) { var el = elOf(a.ref); MS.setMode('edit'); MS.edit.reveal(el, true); return { what: MS.review.describe(el).what }; } };
  A.get_element = { d: 'Text, HTML and computed style of an element.', p: { ref: ['string', 'Element ref or selector', true] },
    f: function (a) { var el = elOf(a.ref), cs = MS.child.win.getComputedStyle(el); return { what: MS.review.describe(el).what, text: el.textContent.trim().slice(0, 2000), html: el.innerHTML.slice(0, 4000), style: { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, color: cs.color, background: cs.backgroundColor, width: cs.width, height: cs.height }, tip: el.getAttribute('data-ms-tip') }; } };
  A.set_text = { d: 'Change the text (or HTML) of an element. Undoable; survives the page\'s own scripts.', p: { ref: ['string', 'Element ref or selector', true], text: ['string', 'Plain text'], html: ['string', 'HTML instead of text'] },
    f: function (a) { var el = elOf(a.ref), before = el.innerHTML, after = a.html != null ? MS.sanitize(a.html) : MS.esc(a.text || ''); MS.edit.commitText(el, before, after); return done(); } };
  A.set_style = { d: 'Set CSS on an element, e.g. {"fontSize":"18px","color":"#0b3d91","fontFamily":"Georgia"}. Empty string removes a property.', p: { ref: ['string', 'Element ref or selector', true], css: ['object', 'CSS properties (camelCase or --custom)', true] },
    f: function (a) { MS.edit.style(elOf(a.ref), a.css, 'Style'); return done(); } };
  A.set_popup = { d: 'Give any element a hover pop-up note (empty text removes it).', p: { ref: ['string', 'Element ref or selector', true], text: ['string', 'Pop-up text', true] },
    f: function (a) { var el = elOf(a.ref), v = String(a.text || '').trim(); MS.history.attrs('Hover pop-up', el, ['data-ms-tip'], function (x) { if (v) x.setAttribute('data-ms-tip', v); else x.removeAttribute('data-ms-tip'); }); return done(); } };
  A.popup_style = { d: 'One style for every hover pop-up on the page.', p: { bg: ['string', 'Background colour'], color: ['string', 'Text colour'], border: ['string', 'Border colour'], size: ['number', 'Text size px'], radius: ['number', 'Corner radius px'], width: ['number', 'Max width px'], charts_too: ['boolean', 'Also apply to chart pop-ups'] },
    f: function (a) {
      var r = rt();
      MS.history.state('Pop-up style', function (s) { ['bg', 'color', 'border', 'size', 'radius', 'width'].forEach(function (k) { if (a[k] != null) s.layout.tip[k] = a[k]; }); });
      if (a.charts_too) MS.history.state('Chart pop-ups', function (s) { r.charts().forEach(function (c) { var cs = s.charts[c.key] = s.charts[c.key] || {}; cs.style = Object.assign({}, cs.style, MS.charts.cleanStyle({ tipBg: a.bg, tipColor: a.color, tipBorder: a.border, tipSize: a.size, tipRadius: a.radius })); }); });
      return done();
    } };
  A.delete = { d: 'Delete an element or block (undoable).', p: { ref: ['string', 'Element ref or selector', true] }, f: function (a) { MS.blocks.remove(elOf(a.ref)); return done(); } };
  A.duplicate = { d: 'Duplicate an element or chart block.', p: { ref: ['string', 'Element ref or selector', true] }, f: function (a) { var el = elOf(a.ref); var n = MS.clipboard.duplicate(el); return { ref: n ? refOf(n) : null }; } };
  A.move_element = { d: 'Move an element before/after another one (e.g. reorder sections or cards).', p: { ref: ['string', 'Element to move', true], before: ['string', 'Put it before this element'], after: ['string', 'Put it after this element'] },
    f: function (a) { var el = elOf(a.ref), t = elOf(a.before || a.after); MS.history.move('Move', el, function () { t.parentNode.insertBefore(el, a.before ? t : t.nextSibling); }); return done(); } };
  A.replace_text = { d: 'Find and replace text everywhere in the dashboard.', p: { find: ['string', 'Text to find', true], replace: ['string', 'Replacement', true] },
    f: function (a) { return MS.plugins.runRecipe({ steps: [{ do: 'replaceText', find: a.find, replace: a.replace }] }, 'api'); } };

  /* ---------------------------------------------------------- building */
  A.insert_part = { d: 'Insert a page part after the element `after` (or at the end of the current tab): banner (page header), section, heading, para, cols2, cols3, callout, divider, spacer, footer.', p: { part: ['string', 'banner | section | heading | para | cols2 | cols3 | callout | divider | spacer | footer', true], after: ['string', 'Element ref to insert after'], title: ['string', 'Main text (heading/title)'], text: ['string', 'Secondary text (subtitle/paragraph)'] },
    f: function (a) {
      if (a.after) MS.edit.select(elOf(a.after)); else MS.edit.select(null);
      var n;
      if (a.part === 'footer') { MS.compose.footer(); n = doc().querySelector('.ms-page-footer'); }
      else { if (!MS.compose.PARTS[a.part]) throw new Error('Unknown part ' + a.part); n = MS.compose.part(a.part); }
      var big = n.querySelector('h1,h2,h3') || (/^H\d$/.test(n.tagName) ? n : null), small = n.querySelector('p') || (n.tagName === 'P' ? n : null);
      if (a.title && big) big.textContent = a.title;
      if (a.text && small) small.textContent = a.text;
      return { ref: refOf(n) };
    } };
  A.insert_text_block = { d: 'Insert a card with a title and HTML/Markdown content in the current tab (or into a section via `into`).', p: { title: ['string', 'Card title'], html: ['string', 'HTML content'], markdown: ['string', 'Markdown content (instead of html)'], into: ['string', 'Section ref to put it in'], span: ['number', 'Width in 12ths (default 6)'] },
    f: function (a) {
      var go = function (html) { if (a.into) MS.edit.select(elOf(a.into)); else MS.edit.select(null); var b = MS.insert.block(MS.blocks.create({ title: a.title || '', content: true, html: MS.sanitize(html || ''), span: a.span || 6 })); return { ref: refOf(b) }; };
      return a.markdown ? MS.lib('marked').then(function (m) { return go(m.parse(a.markdown)); }) : go(a.html);
    } };
  A.insert_button = { d: 'Insert a button link.', p: { label: ['string', 'Button text', true], url: ['string', 'Link'] },
    f: function (a) { var n = MS.compose.make('<p class="ms-para"><a class="ms-btn" target="_blank" rel="noopener"></a></p>'); n.firstChild.textContent = a.label; if (a.url) n.firstChild.setAttribute('href', a.url); MS.compose.place(n, 'Insert button'); return { ref: refOf(n) }; } };
  A.insert_kpis = { d: 'Insert a row of KPI cards. With a dataset each card calculates (and follows filters); without, values are typed.', p: { cards: ['array', '[{label, dataset, measure, agg: sum|avg|count|distinct|min|max, format: inr|cr|lakh|int|k|m|pct|pct100|usd, note, value}]', true], after: ['string', 'Element ref to insert after'] },
    f: function (a) {
      var r = rt(), row = MS.compose.make('<div class="ms-kpis"></div>'), specs = {};
      a.cards.forEach(function (c) {
        var card = MS.compose.make('<div class="ms-kpi"><div class="ms-kpi-label"></div><div class="ms-kpi-value"></div><div class="ms-kpi-note"></div></div>');
        card.querySelector('.ms-kpi-label').textContent = c.label || ''; card.querySelector('.ms-kpi-value').textContent = c.value || '…'; card.querySelector('.ms-kpi-note').textContent = c.note || '';
        if (c.dataset) { var id = r.uid('k'); card.setAttribute('data-ms-kpi', id); specs[id] = { dataset: c.dataset, measure: c.measure, agg: c.agg || 'sum', format: c.format || '' }; }
        row.appendChild(card);
      });
      if (a.after) MS.edit.select(elOf(a.after)); else MS.edit.select(null);
      MS.history.group('Insert KPI cards', function () { if (Object.keys(specs).length) MS.history.state('KPI settings', function (s) { Object.keys(specs).forEach(function (k) { s.kpis[k] = specs[k]; }); }); MS.compose.place(row, 'Insert KPI cards'); });
      return settle(150).then(function () { return { ref: refOf(row), cards: MS.$$('.ms-kpi', row).map(refOf), values: MS.$$('.ms-kpi-value', row).map(function (v) { return v.textContent; }) }; });
    } };
  A.kpi_status = { d: 'Give a calculated KPI card red / amber / green status colours. Thresholds are raw data values (before currency or K/M formatting); between them is amber. better="" removes the colours.', p: { ref: ['string', 'KPI card ref (or its row: the first card is used)', true], better: ['string', 'high (higher is better) | low | "" to remove', true], good: ['number', 'Green at or beyond this'], bad: ['number', 'Red at or beyond this'] },
    f: function (a) {
      var el = elOf(a.ref), card = el.closest('[data-ms-kpi]') || el.querySelector('[data-ms-kpi]'); if (!card) throw new Error('That is not a calculated KPI card. Insert KPI cards from a dataset first.');
      var id = card.getAttribute('data-ms-kpi');
      MS.history.state('KPI status colours', function (s) { if (!s.kpis[id]) return; if (a.better) s.kpis[id].status = { better: a.better, good: a.good, bad: a.bad }; else delete s.kpis[id].status; });
      return settle(150).then(function () { return { ref: refOf(card), status: card.getAttribute('data-ms-status') || null, value: (card.querySelector('.ms-kpi-value') || {}).textContent }; });
    } };
  A.chart_summaries = { d: 'Plain-language summaries of the charts ("West is highest at ₹4.2 Cr (38%)…"), written from the numbers on screen. Optionally add them as captions under the charts or for screen readers.', p: { chart: ['string', 'One chart (default: all)'], show: ['string', 'caption | aria (screen readers only) | off; leave out to just read them'] },
    f: function (a) {
      var keys = a.chart ? [chartKey(a.chart)] : rt().charts().map(function (c) { return c.key; });
      if (a.show) MS.summaries.set(keys, a.show);
      return settle(200).then(function () { return MS.summaries.list().filter(function (x) { return keys.indexOf(x.key) >= 0; }).map(function (x) { return { chart: x.name, kind: x.kind, summary: x.summary, shown: x.show }; }); });
    } };
  A.get_locale = { d: 'The region and currency Mothership uses to write numbers (US dollars unless changed), with examples.', p: {},
    f: function () { var o = MS.locale.get(); return Object.assign({}, o, { describe: MS.locale.describe(o), example: MS.locale.sample(o) }); } };
  A.set_locale = { d: 'Set the country, currency and number style for pop-ups, axes, KPI cards and summaries that use the currency or short formats. Give a country (US, India, Germany…) and optionally a different currency.', p: { country: ['string', 'Country name or 2-letter code, e.g. US, IN, GB, DE'], currency: ['string', '3-letter currency code, e.g. USD, INR, EUR (default: the country\'s)'], locale: ['string', 'Number style, e.g. en-US, en-IN, de-DE (default: the country\'s)'], units: ['string', 'intl (K, M, B) | indian (lakh, crore)'] },
    f: function (a) { var o = MS.locale.set(a); return settle(400).then(function () { return Object.assign({}, o, { describe: MS.locale.describe(o), example: MS.locale.sample(o) }); }); } };
  A.publish_check = { d: 'Ready to publish? Checks script errors, charts with no numbers, untitled charts, KPI totals, open comments, internet files, size and title. fail = fix first, warn = look at it.', p: {},
    f: function () { var items = MS.preflight.run(); return { ready: !items.some(function (x) { return x.status === 'fail'; }), items: items }; } };
  A.publish = { d: 'Make a view-only published copy: version number, date, release note and corner badge; optionally locked for editing with a password; sealed so Mothership warns if it is changed later. Returns the HTML (the MCP publish_html tool saves it).', p: { version: ['string', 'e.g. 1.0 (default: next after the last publish)'], note: ['string', 'What changed'], by: ['string', 'Published by'], as_of: ['string', 'Data as of (YYYY-MM-DD)'], password: ['string', 'Lock editing in Mothership with this password (6+ characters). Without one, an earlier lock is kept'], unlock: ['boolean', 'Remove an earlier lock'], badge: ['boolean', 'Show the version badge (default true)'], keep_comments: ['boolean', 'Keep review comments in the file'] },
    f: function (a) {
      if (a.password && String(a.password).length < 6) throw new Error('Use a password of at least 6 characters.');
      return MS.publish.build({ version: a.version, note: a.note, by: a.by, asOf: a.as_of, password: a.password, keepLock: !a.unlock, badge: a.badge, keepComments: !!a.keep_comments }).then(function (r) {
        return { html: r.html, name: r.name, bytes: r.html.length, version: r.publish.version, locked: !!r.publish.lock, sha256: r.sha256 };
      });
    } };
  A.number_check = { d: 'Check that KPI cards match the totals of the charts that show the same measure, and that charts of the same measure add up alike. Returns differences first.', p: { add_comments: ['boolean', 'Add a review comment for each difference'] },
    f: function (a) {
      var res = MS.numcheck.run();
      if (a.add_comments) res.filter(function (x) { return x.status === 'diff'; }).forEach(function (x) { A.add_comment.f({ ref: x.el ? refOf(x.el) : null, chart: x.el ? null : x.chart, text: 'Numbers don\'t add up: ' + x.what + ' shows ' + x.shown + ' but ' + x.against + ' adds up to ' + x.expected + '. ' + (x.note || ''), type: 'bug', priority: 'must' }); });
      return res.map(function (x) { return { status: x.status, item: x.what, shows: x.shown, against: x.against || null, addsUpTo: x.expected || null, note: x.note || null }; });
    } };
  A.comments_tracker = { d: 'All review comments as an Excel tracker (tab, section, chart, comment, done-when, status, owner, due). Returns the .xlsx as base64; the save_tracker tool writes it to disk.', p: {},
    f: function () { return MS.tracker.build().then(function (r) { var b = '', u = new Uint8Array(r.bytes); for (var i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return { name: r.name, rows: r.rows, b64: btoa(b) }; }); } };
  A.apply_tracker = { d: 'Update comments from an edited tracker (.xlsx): status, priority, owner, due, notes and wording, matched by the ID column.', p: { file: ['object', '{name, b64}', true] },
    f: function (a) { return MS.readFile(fileOf(a.file), 'buffer').then(function (b) { return MS.tracker.apply(b); }); } };
  A.compare_versions = { d: 'What changed between two versions: tabs, text, chart settings, data, KPI cards, filters, colours and comments. Compares saved versions by name, the dashboard now ("now"), or HTML you pass.', p: { before: ['string', 'Saved version name, or "now"'], after: ['string', 'Saved version name, or "now" (default)'], before_html: ['string', 'Or the HTML of the earlier file'], after_html: ['string', 'Or the HTML of the later file'] },
    f: function (a) {
      return MS.compare.sources().then(function (src) {
        var pick = function (n, html) { if (html) return html; n = n || 'now'; var x = src.filter(function (s) { return s.id === n || (n === 'now' && s.id === 'now') || s.name.split(' · ')[0].toLowerCase() === String(n).toLowerCase(); })[0]; if (!x) throw new Error('No version called "' + n + '". Versions: ' + src.map(function (s) { return s.name.split(' · ')[0]; }).join(', ')); return x.get(); };
        if (!a.before && !a.before_html) throw new Error('Say what to compare from: before (a version name) or before_html.');
        var r = MS.compare.compare(pick(a.before, a.before_html), pick(a.after, a.after_html));
        return { changes: r.changes, sections: r.sections };
      });
    } };
  A.insert_chart = { d: 'Insert a new chart made from a dataset (Chart.js is embedded so it works offline). It follows filters and drills down.', p: { dataset: ['string', 'Dataset name', true], by: ['string', 'Category column', true], measure: ['string', 'Value column (omit for agg=count)'], agg: ['string', 'sum | avg | count | min | max'], type: ['string', 'bar | hbar | stacked | line | area | pie | doughnut'], series: ['string', 'Split-by column'], sort: ['string', 'desc | asc | "" (by label)'], top: ['number', 'Top N'], title: ['string', 'Title'], levels: ['array', 'Extra drill levels after `by`'], into: ['string', 'Section ref to put it in'] },
    f: function (a) {
      if (a.into) MS.edit.select(elOf(a.into)); else MS.edit.select(null);
      return MS.compose.ensureChartLib().then(function () {
        var before = rt().charts().map(function (c) { return c.key; });
        MS.compose.addChart({ title: a.title || ((a.agg === 'count' || !a.measure ? 'Count' : a.measure.charAt(0).toUpperCase() + a.measure.slice(1)) + ' by ' + a.by), ds: a.dataset, type: a.type || 'bar', by: a.by, measure: a.measure, agg: a.agg || 'sum', series: a.series, sort: a.sort == null ? 'desc' : a.sort, top: a.top });
        return settle(300).then(function () {
          var r = rt(), c = r.charts().filter(function (x) { return before.indexOf(x.key) < 0; })[0];
          if (c && a.levels && a.levels.length) MS.history.state('Drill levels', function (s) { s.charts[c.key].binding.levels = [a.by].concat(a.levels); });
          return c ? chartSummary(c) : { ok: true };
        });
      });
    } };
  A.insert_table = { d: 'Insert a table snapshot of a dataset.', p: { dataset: ['string', 'Dataset', true], rows: ['number', 'Max rows (default 50)'], title: ['string', 'Title'] },
    f: function (a) {
      var r = rt(), rows = r.filteredRows(a.dataset).slice(0, a.rows || 50), cols = rows[0] ? Object.keys(rows[0]) : [];
      var html = '<table class="ms-table"><thead><tr>' + cols.map(function (c) { return '<th>' + MS.esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (x) { return '<tr>' + cols.map(function (c) { var v = x[c]; return '<td' + (typeof v === 'number' ? ' class="num"' : '') + '>' + MS.esc(typeof v === 'number' ? r.fmtNum(v) : v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
      var b = MS.insert.block(MS.blocks.create({ title: a.title || a.dataset, content: true, html: html, span: 12 })); return { ref: refOf(b) };
    } };
  A.insert_content_file = { d: 'Turn a document (Markdown, Word, Excel, PowerPoint, PDF, image) into a new tab or a block. The MCP insert_file tool fills in the file for you.', p: { file: ['object', '{name, b64}', true], as: ['string', 'tab | block (default tab)'], title: ['string', 'Tab title'] },
    f: function (a) {
      return MS.importers.convert(fileOf(a.file), {}).then(function (res) {
        if (a.as === 'block') { var b = MS.insert.block(MS.blocks.create({ title: a.title || res.title, content: true, html: res.html, span: 12 })); return { ref: refOf(b) }; }
        var id = MS.tabs.add(a.title || res.title, 'content', res.html);
        (res.datasets || []).forEach(function (d) { MS.data.addDataset(d.name, d.rows, true); });
        return { tab: id, datasets: (res.datasets || []).map(function (d) { return d.name; }) };
      });
    } };
  A.resize_block = { d: 'Resize a chart/content block: width in 12ths of the row, height in px.', p: { ref: ['string', 'Block ref, or a chart name via `chart`'], chart: ['string', 'Chart name'], span: ['number', '1-12'], height: ['number', 'px'] },
    f: function (a) { var el = a.chart ? rt().chart(chartKey(a.chart)).el : elOf(a.ref), b = MS.blocks.of(el) || MS.blocks.wrap(el, false); MS.blocks.resize(b, a.span || null, a.height || null); return done(); } };

  /* ---------------------------------------------------------- tabs and layout */
  A.layout = { d: 'Turn tabs on (or off), and set the dashboard ribbon (position, height, title).', p: { tabs: ['boolean', 'true = tabbed layout (default), false = one page'], position: ['string', 'top | left'], size: ['number', 'Ribbon height (or width when left)'], title: ['string', 'Text at the start of the ribbon'] },
    f: function (a) {
      var r = rt();
      if (a.tabs === false) { if (r.layoutEnabled()) { r.disableLayout(); MS.history.clear(); MS.emit('structure'); } return done(); }
      MS.tabs.ensureLayout();
      if (a.position || a.size || a.title != null) MS.history.state('Ribbon', function (s) { var R = s.layout.ribbon; if (a.position) { R.position = a.position; R.height = a.position === 'left' ? 200 : 46; } if (a.size) R.height = a.size; if (a.title != null) R.brand = a.title; });
      return { tabs: r.tabs().map(function (t) { return t.title; }) };
    } };
  A.page_tabs = { d: 'The dashboard\'s own tabs (tab buttons already in the page, not the Mothership tab ribbon): list, show, add, rename, move or delete them. Undoable.', p: { action: ['string', 'list (default) | show | add | rename | move | delete', true], tab: ['string', 'Tab title or 0-based index'], title: ['string', 'Title for add / new title for rename'], html: ['string', 'Content HTML for add'], markdown: ['string', 'Content as Markdown for add'], index: ['number', 'New position for move; for add, put it after this index'] },
    f: function (a) {
      var P = MS.pageTabs, act = a.action || 'list', which = a.tab != null && /^\d+$/.test(String(a.tab)) ? +a.tab : a.tab;
      if (!P.has()) throw new Error('This dashboard has no tabs of its own. Use add_tab (Mothership tab ribbon) instead.');
      if (act !== 'list' && act !== 'add' && !P.find(which)) throw new Error('No tab called ' + a.tab);
      if (act === 'show') P.show(which);
      else if (act === 'add') return (a.markdown ? MS.lib('marked').then(function (m) { return m.parse(a.markdown); }) : Promise.resolve(a.html)).then(function (h) {
        P.add(a.title || 'New tab', h ? MS.sanitize(h) : null, a.index);
        return settle(300).then(function () { return { tabs: P.list().map(function (t) { return { index: t.index, title: t.title, active: t.active }; }) }; });
      });
      else if (act === 'rename') P.rename(which, a.title);
      else if (act === 'move') P.move(which, a.index);
      else if (act === 'delete') P.remove(which, true);
      return settle(300).then(function () { return { tabs: P.list().map(function (t) { return { index: t.index, title: t.title, active: t.active }; }) }; });
    } };
  A.add_tab = { d: 'Add a tab: grid (for charts), or content (text/HTML/Markdown, e.g. How-to, FAQ, Methodology).', p: { title: ['string', 'Tab title', true], kind: ['string', 'grid | content'], html: ['string', 'Content HTML'], markdown: ['string', 'Content as Markdown'], index: ['number', 'Position'] },
    f: function (a) {
      var go = function (html) { var id = MS.tabs.add(a.title, a.kind || (html ? 'content' : 'grid'), html ? MS.sanitize(html) : ''); if (a.index != null) MS.tabs.move(id, a.index); return { tab: id }; };
      return a.markdown ? MS.lib('marked').then(function (m) { return go(m.parse(a.markdown)); }) : go(a.html);
    } };
  A.rename_tab = { d: 'Rename a tab.', p: { tab: ['string', 'Tab title or id', true], title: ['string', 'New title', true] }, f: function (a) { var t = tabOf(a.tab); MS.history.attrs('Rename tab', t.el, ['data-ms-title'], function (x) { x.setAttribute('data-ms-title', a.title); }); return done(); } };
  A.delete_tab = { d: 'Delete a tab and its content (undoable).', p: { tab: ['string', 'Tab title or id', true] }, f: function (a) { var t = tabOf(a.tab); MS.history.move('Delete tab', t.el, function () { t.el.remove(); }); return done(); } };
  A.move_tab = { d: 'Move a tab to a new position (0 = first).', p: { tab: ['string', 'Tab title or id', true], index: ['number', 'New position', true] }, f: function (a) { MS.tabs.move(tabOf(a.tab).id, a.index); return { tabs: rt().tabs().map(function (t) { return t.title; }) }; } };
  A.show_tab = { d: 'Switch to a tab.', p: { tab: ['string', 'Tab title or id', true] }, f: function (a) { rt().showTab(tabOf(a.tab).id); MS.emit('structure'); return done(); } };
  A.hide_tab = { d: 'Hide or show a tab (hidden tabs stay in the file).', p: { tab: ['string', 'Tab title or id', true], hidden: ['boolean', 'true to hide (default)'] },
    f: function (a) { var t = tabOf(a.tab), want = a.hidden !== false; if (t.hidden !== want) MS.tabs.toggleHidden(t.id); return done(); } };
  A.tab_notes = { d: 'Speaker notes for a tab (Presenter view only).', p: { tab: ['string', 'Tab title or id', true], notes: ['string', 'Notes', true] },
    f: function (a) { var t = tabOf(a.tab); MS.history.attrs('Tab notes', t.el, ['data-ms-notes'], function (x) { if (a.notes) x.setAttribute('data-ms-notes', a.notes); else x.removeAttribute('data-ms-notes'); }); return done(); } };
  A.duplicate_tab = { d: 'Duplicate a tab.', p: { tab: ['string', 'Tab title or id', true] }, f: function (a) { MS.tabs.duplicate(tabOf(a.tab).id); return done(); } };
  A.move_chart = { d: 'Move or copy a chart (or any element) to another tab.', p: { chart: ['string', 'Chart name'], ref: ['string', 'Or an element ref'], tab: ['string', 'Target tab', true], copy: ['boolean', 'Copy instead of move'] },
    f: function (a) { var el = a.chart ? rt().chart(chartKey(a.chart)).el : elOf(a.ref); MS.blocks.sendToTab(MS.blocks.of(el) || el, tabOf(a.tab).id, !!a.copy); return done(); } };

  /* ---------------------------------------------------------- charts */
  A.chart_settings = { d: 'Change a chart: commentary (title/subtitle/inference), pop-up text template, look (fonts, legend, pop-up colours, axis number format), linked data and drill-down.', p: {
      chart: ['string', 'Chart name or key', true], title: ['string', 'Title above the chart'], subtitle: ['string', 'Subtitle'], inference: ['string', 'The "so what" line'],
      tooltip: ['string', 'Pop-up template, e.g. "{label}\\n{value:cr}" ("" = chart default). Placeholders {label} {series} {value} {pct} {total} {count} {<column>}; formats :cur :curshort :short (follow set_locale) :inr :cr :lakh :k :m :pct :int'],
      look: ['object', '{font, size, color, legend: top|bottom|left|right|none, axisFormat: cur|curshort|short|inr|cr|lakh|int|k|m|pct, tipBg, tipColor, tipBorder, tipSize, tipRadius} (null = reset)'],
      data: ['object', '{dataset, levels:[col,...], measure, agg, series, sort, top} (null = unlink)'], double_click: ['string', 'levels | details | crossfilter | none'], columns: ['array', 'Columns in the records view'] },
    f: function (a) {
      var r = rt(), key = chartKey(a.chart), c = r.chart(key);
      MS.history.group('Chart settings', function () {
        MS.history.state('Chart', function (s) {
          var cs = s.charts[key] = s.charts[key] || {};
          if (a.tooltip !== undefined) { if (a.tooltip) cs.tooltip = a.tooltip; else delete cs.tooltip; }
          if (a.look !== undefined) { var st = a.look && MS.charts.cleanStyle(a.look); if (st) cs.style = st; else delete cs.style; }
          if (a.data !== undefined) { if (a.data) { cs.binding = a.data; cs.drill = cs.drill || { mode: 'levels' }; } else { delete cs.binding; delete cs.drill; } }
          if (a.double_click || a.columns) { cs.drill = cs.drill || {}; if (a.double_click) cs.drill.mode = a.double_click; if (a.columns) cs.drill.columns = a.columns; }
        });
        if (a.title != null || a.subtitle != null || a.inference != null) {
          var b = MS.blocks.of(c.el) || MS.blocks.wrap(c.el, true);
          [['.ms-title', a.title], ['.ms-sub', a.subtitle], ['.ms-inf', a.inference]].forEach(function (p) {
            if (p[1] == null) return; var n = b.querySelector(p[0]), bf = n.innerHTML, af = MS.esc(p[1]); n.innerHTML = af;
            MS.history.push({ label: 'Commentary', undo: function () { n.innerHTML = bf; }, redo: function () { n.innerHTML = af; } }, true);
          });
        }
      });
      r.drill[key] = [];
      return settle(200).then(function () { return chartSummary(r.chart(key) || c); });
    } };
  A.chart_look_all = { d: 'One look (fonts, legend, pop-up colours, axis format) for every chart.', p: { look: ['object', 'Same fields as chart_settings.look', true] }, f: function (a) { MS.charts.styleAll(a.look); return done(); } };
  A.tooltip_all = { d: 'One pop-up template for every chart ("" restores each chart\'s own).', p: { template: ['string', 'Template', true] },
    f: function (a) { var r = rt(); MS.history.state('Tooltip on all charts', function (s) { r.charts().forEach(function (c) { s.charts[c.key] = s.charts[c.key] || {}; if (a.template) s.charts[c.key].tooltip = a.template; else delete s.charts[c.key].tooltip; }); }); return done(); } };
  A.add_commentary_all = { d: 'Give every chart a title / subtitle / inference header.', p: {}, f: function () { MS.blocks.wrapAll(); return done(); } };
  A.chart_data = { d: 'The numbers a chart shows: categories and series values.', p: { chart: ['string', 'Chart name or key', true] }, f: function (a) { var r = rt(), k = chartKey(a.chart); return { name: MS.charts.nameOf(k), original: r.chartData(k), now: r.chart(k).a.info(r.chart(k).inst) }; } };
  A.chart_image = { d: 'A PNG image of a chart (data URL).', p: { chart: ['string', 'Chart name or key', true] }, f: function (a) { return rt().chartImage(chartKey(a.chart)).then(function (u) { return { dataUrl: u }; }); } };
  A.find_chart_data = { d: 'Look inside the dashboard for the table a chart was made from (matches the chart\'s labels to columns).', p: { chart: ['string', 'Chart name or key', true] }, f: function (a) { return rt().matchData(chartKey(a.chart)).map(function (m) { return { name: m.name, column: m.field, match: Math.round(m.score * 100) + '%', rows: m.rows, alreadyAdded: m.added }; }); } };
  A.link_chart_data = { d: 'Link a chart to the data behind it (found automatically, or the chart\'s own numbers) so drill-down, filters and rich pop-ups work.', p: { chart: ['string', 'Chart name or key', true], levels: ['array', 'Drill path (default: the matched column, then a finer one)'], measure: ['string', 'Value column'], use_chart_numbers: ['boolean', 'Use the numbers drawn in the chart instead'] },
    f: function (a) {
      var r = rt(), key = chartKey(a.chart), name, field, measure = a.measure;
      if (a.use_chart_numbers) { name = MS.data.addDataset(MS.charts.nameOf(key) + ' (chart numbers)', r.rowsFromChart(key), true); field = 'Category'; measure = measure || 'Value'; }
      else {
        var m = r.matchData(key)[0]; if (!m) throw new Error('No matching table found. Try use_chart_numbers, or add_dataset first.');
        name = m.name; field = m.field;
        if (!m.added) { var nm = m.name, i = 2; while (r.state.datasets[nm]) nm = m.name + ' (' + (i++) + ')'; name = nm; MS.history.state('Add dataset ' + nm, function (s) { s.datasets[nm] = JSON.parse(JSON.stringify(m.def)); }); }
        measure = measure || (r.fields(name).filter(function (f) { return f.numeric; })[0] || {}).name;
      }
      var levels = a.levels || [field];
      if (!a.levels && !a.use_chart_numbers) { var rows = r.getRows(name).slice(0, 5000), cnt = function (f) { var s = new Set(); rows.forEach(function (x) { s.add(x[f]); }); return s.size; }, base = cnt(field), nx = null; r.fields(name).forEach(function (f) { if (f.numeric || f.name === field) return; var n = cnt(f.name); if (n > base && n <= 500 && (!nx || n < nx.n)) nx = { name: f.name, n: n }; }); if (nx) levels.push(nx.name); }
      MS.history.state('Link data', function (s) { var cs = s.charts[key] = s.charts[key] || {}; cs.binding = { dataset: name, levels: levels, measure: measure, agg: measure ? 'sum' : 'count', series: r.fields(name).some(function (f) { return f.name === 'Series'; }) && a.use_chart_numbers ? 'Series' : undefined }; cs.drill = { mode: 'levels' }; });
      return settle(200).then(function () { return chartSummary(r.chart(key)); });
    } };
  A.drill = { d: 'Drill a chart down into a category (as a viewer double-clicking it), or reset it.', p: { chart: ['string', 'Chart name or key', true], into: ['string', 'Category to drill into (omit to go back to the top)'] },
    f: function (a) {
      var r = rt(), key = chartKey(a.chart), b = (r.state.charts[key] || {}).binding; if (!b) throw new Error('Link the chart to data first (link_chart_data).');
      var path = r.drill[key] = r.drill[key] || [];
      if (a.into == null) path.length = 0; else path.push({ field: b.levels[path.length], value: String(a.into) });
      r.refresh(); return { path: path, now: r.chart(key).a.info(r.chart(key).inst).labels };
    } };
  A.category_order = { d: 'One category order for every chart that shows those categories (e.g. ["North","South","East","West"]), or copy one chart\'s order with from_chart. Empty order removes it.', p: { order: ['array', 'Categories in order'], from_chart: ['string', 'Use this chart\'s current order'] },
    f: function (a) { if (a.from_chart) MS.order.fromChart(chartKey(a.from_chart)); else if (a.order && a.order.length) MS.order.set(a.order.map(String)); else MS.order.remove([]); return { orders: rt().state.layout.orders }; } };
  A.category_colors = { d: 'Give categories or series one colour on every chart, e.g. {"North":"#1f77b4","South":"#ff7f0e"}. "" removes one.', p: { colors: ['object', 'name → colour', true], replace: ['boolean', 'Replace all existing ones'] },
    f: function (a) { MS.catColors.set(a.colors, 'Category colours', !!a.replace); return { colors: rt().state.layout.colors }; } };
  A.format_painter = { d: 'Copy one chart\'s look, category colours, order and/or pop-up text onto other charts.', p: { from: ['string', 'Source chart', true], to: ['string', '"same" (charts with the same categories, default), "all", or a chart name'], look: ['boolean', 'Fonts/legend/pop-up style (default true)'], colors: ['boolean', 'Category colours (default true)'], order: ['boolean', 'Category order'], tooltip: ['boolean', 'Pop-up text template'] },
    f: function (a) {
      var r = rt(), k = chartKey(a.from), cs = r.state.charts[k] || {}, info = r.chartInfo(k) || {};
      MS.painter.copied = { from: k, name: MS.charts.nameOf(k), style: cs.style || null, tooltip: cs.tooltip || null, colors: r.chartColors(k), order: (info.labels || []).map(String) };
      var keys = !a.to || a.to === 'same' ? MS.painter.targets('same') : a.to === 'all' ? MS.painter.targets('all') : [chartKey(a.to)];
      MS.painter.apply(keys, { look: a.look !== false, colors: a.colors !== false, order: !!a.order, tooltip: !!a.tooltip });
      return { painted: keys.map(function (x) { return MS.charts.nameOf(x); }) };
    } };

  /* ---------------------------------------------------------- data and filters */
  A.discover_datasets = { d: 'Find tables of data inside the dashboard\'s scripts (not added yet).', p: {}, f: function () { return rt().discoverDatasets().map(function (f) { return { expr: f.expr, scriptId: f.scriptId, sub: f.sub, rows: f.rows, columns: f.fields }; }); } };
  A.add_dataset = { d: 'Add a dataset: a file (CSV/Excel/JSON), rows (embedded), or expr (a variable in the page, e.g. "salesData"), or a page JSON script id.', p: { name: ['string', 'Name', true], rows: ['array', 'Array of row objects'], expr: ['string', 'Page variable / expression'], scriptId: ['string', 'id of a <script type="application/json">'], file: ['object', '{name, b64}: a CSV, Excel or JSON file (the MCP load_data tool fills this in)'] },
    f: function (a) {
      if (a.file) return MS.drillData.read(fileOf(a.file)).then(function (ts) { return ts.map(function (t, i) { var n = MS.data.addDataset(ts.length === 1 && a.name ? a.name : (a.name ? a.name + ' · ' : '') + t.name, t.rows, true); return { name: n, rows: t.rows.length }; }); });
      if (a.rows) return { name: MS.data.addDataset(a.name, a.rows, true) };
      MS.history.state('Add dataset ' + a.name, function (s) { s.datasets[a.name] = a.expr ? { expr: a.expr, source: 'page' } : { scriptId: a.scriptId, source: 'page' }; });
      MS.emit('structure'); return { name: a.name, rows: rt().getRows(a.name).length };
    } };
  A.refresh_dataset = { d: 'Replace an embedded dataset\'s rows (e.g. this month\'s data). Charts, KPI cards and filters keep their settings.', p: { name: ['string', 'Dataset', true], rows: ['array', 'New rows', true] },
    f: function (a) { MS.history.state('Refresh ' + a.name, function (s) { s.datasets[a.name] = { rows: a.rows, source: 'file', refreshed: new Date().toISOString() }; }); return { rows: a.rows.length }; } };
  A.remove_dataset = { d: 'Remove a dataset (and its filters).', p: { name: ['string', 'Dataset', true] }, f: function (a) { MS.history.state('Remove dataset', function (s) { delete s.datasets[a.name]; s.filters = s.filters.filter(function (f) { return f.dataset !== a.name; }); }); return done(); } };
  A.dataset_rows = { d: 'Rows of a dataset (after the filter pane), for checking numbers.', p: { name: ['string', 'Dataset', true], limit: ['number', 'Max rows (default 50)'], filtered: ['boolean', 'Apply the current filters (default true)'] },
    f: function (a) { var r = rt(), rows = a.filtered === false ? r.getRows(a.name) : r.filteredRows(a.name); return { total: rows.length, rows: rows.slice(0, a.limit || 50) }; } };
  A.drill_data = { d: 'Embed drill-down detail and link it to charts automatically. Give tables ({name, rows}) or Markdown with | tables | under headings that name the chart.', p: { tables: ['array', '[{name, rows}]'], markdown: ['string', 'Markdown text with tables'], file: ['object', '{name, b64}: a Markdown, Excel, CSV or JSON file (the MCP drill_data_file tool fills this in)'], link: ['boolean', 'Link to matching charts (default true)'] },
    f: function (a) {
      var get = a.file ? MS.drillData.read(fileOf(a.file)) : a.markdown ? MS.lib('marked').then(function (m) { return MS.drillData.fromMarkdown(m, a.markdown, 'Drill data'); }) : Promise.resolve(a.tables || []);
      return get.then(function (tables) {
        var out = [];
        MS.history.group('Drill-down data', function () {
          tables.forEach(function (t) {
            var name = MS.data.addDataset(t.name, t.rows, true), p = MS.drillData.plan(t);
            if (a.link !== false && p && p.key) {
              MS.history.state('Link drill-down', function (s) { var cs = s.charts[p.key] = s.charts[p.key] || {}; cs.binding = { dataset: name, levels: p.levels, measure: p.measure, agg: p.measure ? 'sum' : 'count' }; cs.drill = { mode: 'levels' }; });
              out.push({ dataset: name, chart: MS.charts.nameOf(p.key), levels: p.levels, measure: p.measure });
            } else out.push({ dataset: name, chart: null });
          });
        });
        return out;
      });
    } };
  A.filter_pane = { d: 'Design the filter pane: which fields, labels, position (left/top), visibility and title.', p: { filters: ['array', '[{dataset, field, label}] (replaces the list)'], position: ['string', 'left | top'], visible: ['boolean', 'Show it'], title: ['string', 'Pane title'], width: ['number', 'px'] },
    f: function (a) { MS.history.state('Filter pane', function (s) { if (a.filters) s.filters = a.filters.map(function (f) { return { dataset: f.dataset, field: f.field, label: f.label || f.field }; }); var P = s.layout.pane; ['position', 'visible', 'title', 'width'].forEach(function (k) { if (a[k] != null) P[k] = a[k]; }); }); return { filters: rt().state.filters }; } };
  A.set_filter = { d: 'Set a filter value as a viewer would (empty value clears it).', p: { dataset: ['string', 'Dataset', true], field: ['string', 'Field', true], value: ['string', 'Value'] },
    f: function (a) { var r = rt(), fv = r.filterValues[a.dataset] = r.filterValues[a.dataset] || {}; if (a.value) fv[a.field] = a.value; else delete fv[a.field]; r.refresh(); return { filters: r.filterValues }; } };

  /* ---------------------------------------------------------- brand */
  A.apply_theme = { d: 'Apply brand colours and fonts: a theme object, or the text of a brand SKILL.md. The dashboard\'s own colours are matched to brand roles (returned as swapped); pass theme.map: [] to keep them.', p: { theme: ['object', '{name, colors:{primary, secondary, accent, background, surface, text, muted, border, ribbonBg, ribbonText}, fonts:{heading, body}, palette:[...], logo}'], markdown: ['string', 'Brand guidelines Markdown'], file: ['object', '{name, b64}: brand JSON, SKILL.md, .skill/.zip or a font file (the MCP load_brand tool fills this in)'] },
    f: function (a) {
      if (a.file) return Promise.resolve(MS.brand.loadFile(fileOf(a.file), true)).then(function () { var th = rt().state.theme; return th ? { theme: th.name, colors: th.colors, swapped: (th.map || []).map(function (m) { return m.from + ' → ' + m.to + ' (' + m.role + ')'; }) } : { ok: true }; });
      var t = a.markdown ? MS.brand.parseMarkdown(a.markdown, 'brand') : MS.brand.normalize(a.theme || {}, 'api'); MS.brand.apply(t); var th = rt().state.theme; return { theme: th.name, colors: th.colors, swapped: (th.map || []).map(function (m) { return m.from + ' → ' + m.to + ' (' + m.role + ')'; }) }; } };
  A.brand_check = { d: 'Run the brand check (off-brand colours, contrast, charts without commentary) and return the findings.', p: {},
    f: function () { MS.brand.check(); var dlg = document.querySelector('.dlg'); var txt = dlg ? dlg.querySelector('.dlg-body').innerText : ''; if (dlg) dlg.closest('.dlg-wrap').remove(); return { report: txt }; } };

  /* ---------------------------------------------------------- review */
  A.add_comment = { d: 'Add a review comment on an element, an area, or an interaction.', p: { text: ['string', 'The comment', true], ref: ['string', 'Element ref/selector (element comment)'], chart: ['string', 'Or a chart name'], area: ['object', '{x, y, w, h} in page px (area comment)'], steps: ['array', 'What was done (interaction comment)'], type: ['string', 'change | bug | question | idea'], priority: ['string', 'must | should | nice'], by: ['string', 'Author name'], to: ['string', 'Assign to (initials or name); an @mention in the text also assigns'] },
    f: function (a) {
      var r = rt(), c = { id: r.uid('m'), created: new Date().toISOString(), text: a.text, type: a.type || 'change', prio: a.priority || 'should' };
      var men = MS.review.mentions(a.text); if (men.length) c.mentions = men; if (a.to || men.length) c.to = String(a.to || men[0]).replace(/^@/, '');
      var t = r.layoutEnabled() ? r.tabs().filter(function (x) { return x.id === r.activeTab; })[0] : null;
      if (!t && MS.pageTabs.has()) { var pa = MS.pageTabs.active(); if (pa) t = { id: 'page:' + pa.index, title: pa.title }; }
      c.by = a.by || ''; c.replies = [];
      if (a.ref || a.chart) {
        var el = a.chart ? (MS.blocks.of(r.chart(chartKey(a.chart)).el) || r.chart(chartKey(a.chart)).el) : elOf(a.ref), d = MS.review.describe(el), sec = el.closest('section.ms-tab');
        c.kind = 'element'; c.tab = MS.review.tabOf(el) || (sec ? { id: sec.getAttribute('data-ms-tab'), title: sec.getAttribute('data-ms-title') } : null);
        c.target = { what: d.what, ref: '[data-ms-' + (el.getAttribute('data-ms-id') ? 'id' : 'ref') + '="' + refOf(el) + '"]', css: '', chart: d.chart };
        c.target.css = MS.review.cssPath(el); c.loc = MS.review.locate(el); c.target.section = c.loc.section;
      } else if (a.area) { c.kind = 'area'; c.tab = t ? { id: t.id, title: t.title } : null; c.area = { x: a.area.x, y: a.area.y, w: a.area.w, h: a.area.h, vw: MS.child.win.innerWidth, vh: MS.child.win.innerHeight, tab: t && t.id }; c.inside = []; }
      else { c.kind = 'interaction'; c.tab = t ? { id: t.id, title: t.title } : null; c.steps = a.steps || MS.review.log().slice(-4).map(function (x) { return x.text; }); c.state = {}; }
      MS.history.state('Add comment', function (s) { s.comments.push(c); }); MS.emit('comments');
      return { id: c.id, number: r.state.comments.length };
    } };
  A.list_comments = { d: 'All review comments.', p: {}, f: function () { return MS.review.list().map(function (c, i) { return { number: i + 1, id: c.id, kind: c.kind, text: c.text, type: c.type, priority: c.prio, done: !!c.done, by: c.by || '', to: c.to || '', mentions: c.mentions || [], on: c.target ? c.target.what : c.inside || c.steps, where: c.loc ? MS.review.trail(c.loc) : (c.tab && c.tab.title), tab: c.tab && c.tab.title, replies: (c.replies || []).map(function (y) { return { by: y.by || '', text: y.text, at: y.at }; }) }; }); } };
  A.update_comment = { d: 'Edit, resolve (done), reply to or delete a comment.', p: { id: ['string', 'Comment id', true], text: ['string', 'New text'], done: ['boolean', 'Resolve / re-open'], reply: ['string', 'Add a reply'], by: ['string', 'Reply author'], to: ['string', 'Assign to (initials or name; "" unassigns)'], delete: ['boolean', 'Delete it'] },
    f: function (a) { MS.history.state('Comment', function (s) { if (a.delete) { s.comments = s.comments.filter(function (c) { return c.id !== a.id; }); return; } s.comments.forEach(function (c) { if (c.id !== a.id) return; if (a.text != null) c.text = a.text; if (a.done != null) c.done = a.done; if (a.to != null) { if (a.to) c.to = String(a.to).replace(/^@/, ''); else delete c.to; } if (a.reply) (c.replies = c.replies || []).push({ id: rt().uid('y'), text: a.reply, by: a.by || '', at: new Date().toISOString() }); }); }); MS.emit('comments'); return done(); } };
  A.comments_prompt = { d: 'Turn the review comments into one prompt for an AI assistant. Each comment is located by tab › section › card/chart › item.', p: { goal: ['string', 'apply (default) | polish | review | explain'], assistant: ['string', 'chat (default) | agent | mcp: who will carry it out'], scope: ['string', 'all (default) | tab | must'], tab: ['string', 'Tab title when scope is tab'], ids: ['array', 'Only these comment ids'], group: ['string', 'where | priority | order'], detail: ['string', 'full | brief'], output: ['string', 'file (complete updated HTML) | changes | plan | tickets'], include_done: ['boolean', 'Include closed comments'], extra: ['string', 'Extra instruction'], embed_html: ['boolean', 'Paste the dashboard source into the prompt'] },
    f: function (a) { return { prompt: MS.review.buildPrompt({ goal: a.goal, assistant: a.assistant, scope: a.scope, tab: a.tab, ids: a.ids, group: a.group, detail: a.detail, output: a.output, structure: true, includeDone: !!a.include_done, extra: a.extra, embed: a.embed_html ? MS.exportHtml({ dropComments: true }) : '', fileName: MS.exportName() }) }; } };

  /* ---------------------------------------------------------- client work: firm template, stage, confidential, change log */
  A.firm_template = { d: 'The firm template: logo, fonts, palette and disclaimer footer that the dashboard snaps to, locked so colours and fonts stay on brand. action: get (default) | apply | save_current | lock | unlock | footer | remove.', p: { action: ['string', 'get | apply | save_current | lock | unlock | footer | remove'], template: ['object', 'For apply: {name, footer, logo, theme:{colors, fonts, palette}, locked}'], name: ['string', 'Template name (save_current)'], footer: ['string', 'Disclaimer footer text'], lock: ['boolean', 'Lock after applying (default true)'], password: ['string', 'Unlock password (lock / unlock)'] },
    f: function (a) {
      var act = a.action || 'get', F = MS.firm;
      if (act === 'apply') { F.apply(a.template || {}, { lock: a.lock }); return F.current(); }
      if (act === 'save_current') { var t = F.fromDashboard({ name: a.name, footer: a.footer, locked: a.lock !== false }); F.apply(t, { lock: a.lock !== false }); return { template: t }; }
      if (act === 'lock' || act === 'unlock') return F.lock(act === 'lock', a.password).then(function (ok) { if (!ok) throw new Error('Wrong password.'); return F.current(); });
      if (act === 'footer') { F.setFooter(a.footer); return F.current(); }
      if (act === 'remove') { F.remove(); return done(); }
      var c = F.current(); return c ? { name: c.name, footer: c.footer, locked: !!c.locked, password: !!c.pw, logo: !!c.logo } : null;
    } };
  A.stage = { d: 'The review stage stamp: draft, review (In review) or client (Client-ready, no stamp). Without stage it reports the current one and what still blocks client-ready.', p: { stage: ['string', 'draft | review | client | "" (no stamp)'] },
    f: function (a) { if (a.stage != null) MS.stage.set(a.stage); return { stage: MS.stage.get(), label: MS.stage.label(), blockers: MS.stage.blockers() }; } };
  A.confidential = { d: 'Mark the dashboard "Client confidential": a watermark on every page and a label in the footer.', p: { on: ['boolean', 'On (default true) or off'], label: ['string', 'Text (default "Client confidential")'], watermark: ['boolean', 'Show the watermark (default true)'] },
    f: function (a) { MS.confidential.set(a.on !== false, a.label, a.watermark); return MS.confidential.get() || { on: false }; } };
  A.scrub_names = { d: 'Take client or people names out of everything: text, chart labels, data, comments, settings and the page\'s scripts. where: copy (default: returns a cleaned copy as html, the open dashboard is unchanged) or here (cleans the open dashboard; a version is saved first). Returns how many were replaced and how many remain (inside words or pictures).', p: { names: ['array', '[{from, to}] e.g. [{from: "Acme Insurance", to: "Client"}]', true], where: ['string', 'copy | here'] },
    f: function (a) { return MS.confidential.scrub(a.names || [], a.where).then(function (r) { var o = { replaced: r.counts, left: r.left }; if (a.where !== 'here') o.html = r.html; return o; }); } };
  A.change_log = { d: 'The change log saved inside the file: who changed what and when (newest first).', p: { limit: ['number', 'How many (default 50)'], note: ['string', 'Add an entry'] },
    f: function (a) { if (a.note) MS.audit.note(a.note); return MS.audit.list().reverse().slice(0, a.limit || 50); } };
  A.colour_blind_check = { d: 'Chart colours that red-, green- or blue-blind readers can\'t tell apart. fix: switch to a colour-blind safe palette (Okabe–Ito).', p: { fix: ['boolean', 'Apply the safe palette'] },
    f: function (a) { var before = MS.cvd.check(); if (a.fix) MS.cvd.fix(); return { problems: before.map(function (p) { return { chart: p.title, a: p.a, b: p.b, colors: p.colors, who: p.who }; }), fixed: !!a.fix, left: a.fix ? MS.cvd.check().length : before.length }; } };

  /* ---------------------------------------------------------- notes on charts, sources, story, PDF and PowerPoint */
  A.annotate = { d: 'Callouts, arrows and "so what" boxes pinned to a data point of a chart; they follow the point. action: list (default) | add | update | delete.', p: { action: ['string', 'list | add | update | delete'], chart: ['string', 'Chart name or key'], label: ['string', 'The category (x label) to pin to'], series: ['number', 'Series number from 0 (default 0)'], text: ['string', 'The note'], kind: ['string', 'callout | arrow | sowhat'], title: ['string', 'Heading of a "so what" box'], color: ['string', 'Colour'], dx: ['number', 'Offset of the note from the point, px'], dy: ['number', 'Offset, px'], id: ['string', 'Annotation id (update / delete)'] },
    f: function (a) {
      var act = a.action || 'list';
      if (act === 'add') { var key = chartKey(a.chart); var x = MS.annotate.add({ chart: key, label: a.label, series: a.series || 0, text: a.text, kind: a.kind, title: a.title, color: a.color, dx: a.dx, dy: a.dy }); return x; }
      if (act === 'update') { var p = {}; ['text', 'kind', 'title', 'color', 'dx', 'dy', 'label', 'series'].forEach(function (k) { if (a[k] !== undefined) p[k] = a[k]; }); MS.annotate.update(a.id, p); return MS.annotate.get(a.id); }
      if (act === 'delete') { MS.annotate.remove(a.id); return done(); }
      return MS.annotate.list(a.chart ? chartKey(a.chart) : null);
    } };
  A.chart_source = { d: 'The source and "data as of" date shown under a chart (data hygiene). Without text/as_of it reports the sources and which charts have none.', p: { chart: ['string', 'Chart name or key'], text: ['string', 'Source, e.g. "Policy admin extract"'], as_of: ['string', 'Data as of (YYYY-MM-DD)'], note: ['string', 'A short note'], all: ['boolean', 'Use it for every chart without a source'], clear: ['boolean', 'Remove the source'] },
    f: function (a) {
      var r = rt();
      if (a.all && !a.chart) { var n = MS.sources.setAll({ text: a.text || '', asOf: a.as_of || '' }); return { charts: n }; }
      if (a.chart != null && (a.text != null || a.as_of != null || a.note != null || a.clear)) { var k = chartKey(a.chart); MS.sources.set(k, a.clear ? null : { text: a.text, asOf: a.as_of, note: a.note }); if (a.all) MS.sources.setAll({ text: a.text || '', asOf: a.as_of || '' }); return { chart: MS.charts.nameOf(k), shows: r.sourceText(MS.sources.get(k)) }; }
      return { charts: r.charts().map(function (c) { return { chart: MS.charts.nameOf(c.key), source: MS.sources.get(c.key) }; }), missing: MS.sources.missing().map(function (k) { return MS.charts.nameOf(k); }) };
    } };
  A.insert_footnotes = { d: 'Insert (or refresh) a "Notes and sources" block: every chart\'s source and date, extra notes, and the firm disclaimer.', p: { notes: ['array', 'Extra notes, one per line'], after: ['string', 'Element ref to insert after'] },
    f: function (a) { if (a.after) MS.edit.select(elOf(a.after)); var n = MS.sources.insertFootnotes(a.notes); return { ref: n ? refOf(n) : null }; } };
  A.story = { d: 'The storyline: steps that light up one part each with a headline, played like slides (also in the exported file). action: get (default) | add | update | delete | move | title | draft (one step per chart) | clear | play | stop.', p: { action: ['string', 'get | add | update | delete | move | title | draft | clear | play | stop'], ref: ['string', 'Element ref to show (add)'], chart: ['string', 'Or a chart name (add)'], headline: ['string', 'The takeaway'], text: ['string', 'A line of detail'], index: ['number', 'Step number from 0'], to: ['number', 'New position (move)'], title: ['string', 'Story title'] },
    f: function (a) {
      var S = MS.story, act = a.action || 'get';
      if (act === 'add') { var el = a.ref ? elOf(a.ref) : (a.chart ? rt().chart(chartKey(a.chart)).el : MS.sel); S.add(el, a.headline, a.text, a.index); }
      else if (act === 'update') { var p = {}; if (a.headline != null) p.headline = a.headline; if (a.text != null) p.text = a.text; if (a.ref) p.ref = S.refOf(elOf(a.ref)); S.update(a.index || 0, p); }
      else if (act === 'delete') S.remove(a.index || 0);
      else if (act === 'move') S.move(a.index || 0, a.to || 0);
      else if (act === 'title') S.setTitle(a.title);
      else if (act === 'draft') S.draft();
      else if (act === 'clear') S.clear();
      else if (act === 'play') { S.play(a.index || 0); return settle(500).then(function () { return { playing: rt().story.i }; }); }
      else if (act === 'stop') S.stop();
      var st = S.get(); return { title: st.title || '', steps: (st.steps || []).map(function (s, i) { return { index: i, headline: s.headline, text: s.text || '', found: !!rt().findRef(s.ref) }; }) };
    } };
  A.print_layout = { d: 'A print layout with one page per tab (or per story step), with the firm header and footer, fitted to A4 landscape. Returns html; the MCP save_pdf tool turns it into a PDF.', p: { from: ['string', 'tabs (default) | story'] },
    f: function (a) { return MS.deliver.build({ from: a.from }).then(function (b) { return { pages: b.shots.map(function (s) { return s.title; }), html: b.html }; }); } };
  A.export_pptx = { d: 'A PowerPoint (.pptx): one slide per tab (or per story step) with an editable title and the page as a picture. Returns base64; the MCP save_pptx tool writes it to disk.', p: { from: ['string', 'tabs (default) | story'] },
    f: function (a) { return MS.deliver.pptx({ from: a.from }).then(function (r) { var b = '', u = r.bytes; for (var i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return { slides: r.slides, name: MS.exportName(a.from === 'story' ? '-story' : '').replace(/\.html$/, '.pptx'), b64: btoa(b) }; }); } };

  /* ---------------------------------------------------------- automation */
  A.run_recipe = { d: 'Run a Mothership recipe (a list of steps: layout, theme, addTab, renameTab, deleteTab, hideTab, wrapCharts, tooltip, chart, moveChart, copyChart, dataset, filter, replaceText, css). See docs/EXTENDING.md.', p: { recipe: ['object', '{steps:[{do:..., ...}]}', true] },
    f: function (a) { return Promise.resolve(MS.plugins.runRecipe(a.recipe, 'api')).then(function (x) { return x || done(); }); } };
  A.call = { d: 'Call any Mothership function by path with positional arguments, e.g. path "tabs.add", args ["FAQ","content","<h1>FAQ</h1>"]. Gives access to every feature, including ones without their own tool.', p: { path: ['string', 'e.g. "blocks.wrapAll", "order.set", "rt.refresh"', true], args: ['array', 'Arguments'] },
    f: function (a) {
      var parts = a.path.split('.'), base = parts[0] === 'rt' ? rt() : MS, i = parts[0] === 'rt' ? 1 : 0, ctx = base;
      for (; i < parts.length - 1; i++) { ctx = ctx[parts[i]]; if (!ctx) throw new Error('No such path ' + a.path); }
      var fn = ctx[parts[parts.length - 1]]; if (typeof fn !== 'function') throw new Error(a.path + ' is not a function');
      return Promise.resolve(fn.apply(ctx, a.args || [])).then(function (x) { try { return x === undefined ? { ok: true } : JSON.parse(JSON.stringify(x)); } catch (e) { return { ok: true, note: 'Result is not JSON' }; } });
    } };

  /* ---------- v3.4: clipboard, chart size / legend / data, table colour rules, templates, refresh, accessibility, notes */
  function anyEl(x) { try { return elOf(x); } catch (e) { var k = chartKey(x), c = rt().chart(k); return MS.clipboard.unitOf(c.el); } }
  A.copy = { d: 'Copy (or cut) a part of the dashboard: a chart, card, section, text or table. Paste it with paste, here or in another dashboard.', p: { ref: ['string', 'Element ref, CSS selector or chart name (default: the selection)'], cut: ['boolean', 'Cut instead of copy'] },
    f: function (a) { var el = a.ref ? anyEl(a.ref) : MS.sel; MS.edit.select(el); var c = MS.clipboard.copy(!!a.cut); if (!c) throw new Error('Nothing to copy.'); return { copied: (el.textContent || '').trim().slice(0, 80), cut: !!a.cut }; } };
  A.paste = { d: 'Paste what was copied: after an element, or inside a section / card / tab (inside: true). Without "after" it goes after the selection, or at the end of the tab or page on screen. Also pastes outside content: html (e.g. a table) or text (tab-separated becomes a table).', p: { after: ['string', 'Element ref, selector or chart name to paste after (or inside, with inside: true)'], inside: ['boolean', 'Put it inside the element instead of after it'], html: ['string', 'Outside HTML to paste instead of the clipboard'], text: ['string', 'Outside text to paste (tab-separated lines become a table)'] },
    f: function (a) {
      if (a.after) MS.edit.select(anyEl(a.after));
      var p;
      if (a.html || a.text) { var dt = new DataTransfer(); if (a.html) dt.setData('text/html', a.html); if (a.text) dt.setData('text/plain', a.text); p = MS.clipboard.pasteExternal(dt, !!a.inside); }
      else p = MS.clipboard.paste({ inside: !!a.inside });
      return Promise.resolve(p).then(function (n) { return settle(250).then(function () { if (!n) throw new Error('Nothing was pasted.'); return { pasted: true, ref: refOf(n), where: n.parentNode && (n.parentNode.className || n.parentNode.tagName.toLowerCase()) }; }); });
    } };
  A.chart_size = { d: 'Resize a chart (or any card, block or picture): width as columns of its grid, or a percentage, and height in pixels.', p: { chart: ['string', 'Chart name or key, or an element ref', true], columns: ['number', 'Columns to span in its grid (12-column grid for Mothership blocks)'], width_percent: ['number', 'Width as % of the row, when it is not in a grid'], height: ['number', 'Height in px'] },
    f: function (a) { var el = anyEl(a.chart); MS.chartKit.setSize(el, { span: a.columns, pct: a.width_percent, height: a.height, px: a.width_px }); return settle(150).then(function () { var o = MS.chartKit.sizing(el); return { columns: o.span || null, of: o.cols || null, widthPercent: o.pct || null, height: o.height }; }); } };
  A.chart_legend = { d: 'Show a chart\'s legend at the top, bottom, left or right, hide it (none), or put it back as the dashboard had it (default). The page\'s own hand-made legend is hidden while the chart shows its own.', p: { chart: ['string', 'Chart name or key', true], position: ['string', 'top | bottom | left | right | none | default', true] },
    f: function (a) { var k = chartKey(a.chart), pos = a.position === 'default' ? '' : a.position; if (['', 'top', 'bottom', 'left', 'right', 'none'].indexOf(pos) < 0) throw new Error('position: top, bottom, left, right, none or default'); MS.chartKit.setLegend(k, pos); return settle(150).then(function () { return MS.chartKit.legendOf(k); }); } };
  A.set_chart_data = { d: 'Replace the numbers of one chart (read them with chart_data). Give labels + series, or rows (a wide table: first column labels, one column per series; or Category/Series/Value), or file (CSV/Excel; the MCP chart_data_file tool fills it in). reset: back to the page\'s own numbers.', p: { chart: ['string', 'Chart name or key', true], labels: ['array', 'Category labels'], series: ['array', '[{name, values:[…]}]'], rows: ['array', 'Row objects'], file: ['object', '{name, b64}'], reset: ['boolean', 'Use the page\'s own numbers again'] },
    f: function (a) {
      var k = chartKey(a.chart), K = MS.chartKit;
      if (a.reset) { K.resetData(k); return settle(200).then(function () { return K.current(k); }); }
      var go = function (t, from) { var r = K.applyData(k, t, from); return settle(250).then(function () { var c = K.current(k); r.now = { labels: c.labels.slice(0, 50), series: c.series.map(function (s) { return { name: s.name, values: s.values.slice(0, 50) }; }) }; return r; }); };
      if (a.file) return MS.drillData.read(fileOf(a.file)).then(function (ts) { var t = ts.filter(function (x) { return x.rows && x.rows.length; })[0]; return go(t ? K.tableFromRows(t.rows) : null, a.file.name); });
      if (a.rows) return go(K.tableFromRows(a.rows));
      if (a.labels && a.series) return go({ labels: a.labels.map(String), series: a.series.map(function (s) { return { name: String(s.name || 'Series'), values: (s.values || []).map(K.num) }; }) });
      return K.current(k);
    } };
  function tableOf(x) {
    var r = rt(), ts = r.tables();
    if (x == null || x === '') { var t = MS.sel && MS.sel.closest && MS.sel.closest('table'); if (t) return t; if (ts.length === 1) return ts[0]; throw new Error('Say which table: its number (0 = first), a ref or a selector. Tables: ' + ts.length); }
    if (typeof x === 'number' || /^\d+$/.test(x)) { if (!ts[+x]) throw new Error('There are ' + ts.length + ' tables.'); return ts[+x]; }
    var el = elOf(x); return el.tagName === 'TABLE' ? el : el.closest('table') || el.querySelector('table');
  }
  A.table_rules = { d: 'Colour a table\'s cells by value (conditional formatting). Rules: {col, type: rag (value = green threshold, value2 = amber, higher: true/false) | scale (higher) | bars (color) | rule (op: gt|ge|lt|le|between|eq|ne|contains|blank, value, value2, color, bold) | top | bottom (n, color)}.', p: { table: ['string', 'Table number (0 = first), ref or selector'], action: ['string', 'list (default) | add | set | clear'], rule: ['object', 'One rule, for add'], rules: ['array', 'All rules, for set'] },
    f: function (a) {
      var t = tableOf(a.table), T = MS.tables, r = rt();
      if (a.action === 'add') T.addRule(t, a.rule || {});
      else if (a.action === 'set') T.setRules(t, a.rules || []);
      else if (a.action === 'clear') T.setRules(t, [], 'Clear table colour rules');
      return { table: r.tables().indexOf(t), columns: r.tableColumns(t), rules: T.rulesOf(t).map(function (x) { return Object.assign({ text: T.describe(x) }, x); }), coloured: t.querySelectorAll('[data-ms-cf]').length };
    } };
  A.templates = { d: 'Template gallery: list templates (yours and starters), save the selection or the tab on screen, insert one (a tab template becomes a new tab), or delete one.', p: { action: ['string', 'list (default) | save | insert | delete'], name: ['string', 'Template name (save / insert / delete)'], what: ['string', 'save: selection (default) | tab'], ref: ['string', 'save: element ref, selector or chart name'], after: ['string', 'insert: element to insert after'], inside: ['boolean', 'insert: inside that element'] },
    f: function (a) {
      var T = MS.templates, find = function (list) { var t = list.filter(function (x) { return x.id === a.name || low(x.name) === low(a.name); })[0]; if (!t) throw new Error('No template "' + a.name + '". Templates: ' + list.map(function (x) { return x.name; }).join(', ')); return t; };
      var row = function (t) { return { name: t.name, kind: t.kind, starter: !!t.starter, charts: (t.snap.charts || []).length, from: t.src || null, created: t.created || null }; };
      if (a.action === 'save') return T.save(a.name, a.what === 'tab' ? 'tab' : 'selection', a.ref ? anyEl(a.ref) : null).then(row);
      if (a.action === 'insert') return T.list().then(function (l) { var t = find(l); if (a.after) MS.edit.select(anyEl(a.after)); return T.insert(t, { inside: a.inside }); }).then(function (n) { return settle(300).then(function () { return { inserted: true, ref: n ? refOf(n) : null }; }); });
      if (a.action === 'delete') return T.list().then(function (l) { var t = find(l); if (t.starter) throw new Error('Starters can\'t be deleted.'); return T.remove(t.id); }).then(function () { return done(); });
      return T.list().then(function (l) { return l.map(row); });
    } };
  A.refresh_data = { d: 'Refresh every embedded dataset from new files in one go (e.g. this month\'s CSV / Excel). Files are matched to datasets by file name, then sheet or dataset name. Charts, KPI cards and filters keep their settings.', p: { files: ['array', '[{name, b64}] (the MCP refresh_data_files tool fills this in)', true], apply: ['boolean', 'Apply the matches (default true); false only lists them'] },
    f: function (a) {
      var files = (a.files || []).map(fileOf);
      return Promise.all(files.map(function (f) { return MS.drillData.read(f).then(function (ts) { return ts.filter(function (t) { return t.rows && t.rows.length; }).map(function (t) { return { file: f.name, name: t.name, rows: t.rows }; }); }); }))
        .then(function (all) {
          var m = MS.data.matchRefresh([].concat.apply([], all));
          if (a.apply === false) return m.map(function (x) { return { dataset: x.dataset, file: x.file, rows: x.after, was: x.before, missingColumns: x.missing }; });
          return { refreshed: MS.data.applyRefresh(m), unmatched: files.map(function (f) { return f.name; }).filter(function (n) { return !m.some(function (x) { return x.file === n; }); }) };
        });
    } };
  A.accessibility_check = { d: 'Accessibility check: pictures without alt text, hard-to-read text colours, tables without headings, tab buttons that need a mouse, unnamed buttons, page language and title. fix: true applies the automatic fixes (all but alt text).', p: { fix: ['boolean', 'Apply the automatic fixes'] },
    f: function (a) {
      var list = MS.a11y.check();
      if (a.fix) { var fx = list.filter(function (f) { return f.fix && f.fix !== 'alt'; }); MS.history.group('Accessibility fixes', function () { fx.forEach(MS.a11y.fix); }); list = MS.a11y.check(); }
      return list.map(function (f) { return { kind: f.kind, problem: f.msg, ref: f.el && f.el.getAttribute && f.el !== MS.child.doc.documentElement ? refOf(f.el) : null, autoFix: !!(f.fix && f.fix !== 'alt') }; });
    } };
  A.set_alt_text = { d: 'Set the alt text of a picture (read by screen readers), or mark it decorative.', p: { ref: ['string', 'Picture ref or selector', true], text: ['string', 'What the picture shows'], decorative: ['boolean', 'Screen readers skip it'] },
    f: function (a) { var el = elOf(a.ref); if (el.tagName !== 'IMG') el = el.querySelector('img'); if (!el) throw new Error('That is not a picture.'); MS.a11y.setAlt(el, a.text, !!a.decorative); return { alt: el.getAttribute('alt') }; } };
  A.presenter_notes = { d: 'Speaker notes for Presenter view: read or set a tab\'s notes, and choose whether comments show as notes (off | resolved | all).', p: { tab: ['string', 'Tab name (the dashboard\'s own tabs or the tab ribbon)'], text: ['string', 'New notes for that tab'], from_comments: ['string', 'off | resolved | all'] },
    f: function (a) {
      var r = rt();
      if (a.from_comments) MS.present.setCommentMode(a.from_comments);
      var tabs = r.layoutEnabled() ? r.tabs() : MS.pageTabs.list().map(function (t, j) { return { id: 'page:' + j, title: t.title, page: true, notes: (r.state.pageNotes || {})[t.title] || '' }; });
      if (a.tab != null && a.text != null) {
        var t = tabs.filter(function (x) { return low(x.title) === low(a.tab); })[0]; if (!t) throw new Error('No tab "' + a.tab + '".');
        if (t.page) MS.pageTabs.notes(t.title, a.text); else MS.history.attrs('Tab notes', t.el, ['data-ms-notes'], function (x) { if (a.text) x.setAttribute('data-ms-notes', a.text); else x.removeAttribute('data-ms-notes'); });
        tabs = r.layoutEnabled() ? r.tabs() : tabs.map(function (x) { x.notes = (r.state.pageNotes || {})[x.title] || ''; return x; });
      }
      return { fromComments: MS.present.commentMode(), tabs: tabs.filter(function (x) { return a.tab == null || low(x.title) === low(a.tab); }).map(function (x) { return { tab: x.title, notes: MS.present.notesFor(x) }; }) };
    } };

  MS.api = {};
  MS.api.refOf = refOf;
  Object.keys(A).forEach(function (k) { MS.api[k] = function (args) { return A[k].f(args || {}); }; });
  // tool descriptions with JSON Schemas, for MCP and docs
  MS.api.describe = function () {
    return Object.keys(A).map(function (k) {
      var props = {}, req = [];
      Object.keys(A[k].p).forEach(function (n) { var p = A[k].p[n]; props[n] = { type: p[0], description: p[1] }; if (p[0] === 'array') props[n].items = {}; if (p[2]) req.push(n); });
      return { name: k, description: A[k].d, inputSchema: { type: 'object', properties: props, required: req } };
    });
  };
  MS.api.run = function (name, args) {
    if (!A[name]) return Promise.reject(new Error('Unknown tool ' + name));
    try { return Promise.resolve(A[name].f(args || {})); } catch (e) { return Promise.reject(e); }
  };
})(window.MS);
