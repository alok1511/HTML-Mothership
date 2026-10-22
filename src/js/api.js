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
  A.open_html = { d: 'Open a dashboard from its HTML source.', p: { html: ['string', 'The HTML', true], name: ['string', 'File name to show, e.g. sales.html'] },
    f: function (a) { MS.openHtml(a.html, a.name || 'dashboard.html'); return settle(1800).then(function () { return A.outline.f({}); }); } };
  A.open_folder_files = { d: 'Open a dashboard together with its scripts, styles, images and data (files as base64). The MCP open_folder tool fills this in for you.', p: { files: ['array', '[{path, name, b64}] with paths relative to the folder', true] },
    f: function (a) { MS.openFolder(a.files.map(fileOf)); return settle(2500).then(function () { return A.outline.f({}); }); } };
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
        comments: (r.state.comments || []).length, zoom: { scale: MS.view.scale, drawnAt: MS.view.renderWidth }
      };
    } };
  A.export_html = { d: 'The edited dashboard as one standalone HTML file (returns the HTML; the MCP tool saves it to a path).', p: { drop_comments: ['boolean', 'Leave review comments out'] },
    f: function (a) { var h = MS.exportHtml({ dropComments: !!a.drop_comments }); MS.dirty = false; MS.emit('saved'); return { html: h, bytes: h.length, name: MS.exportName() }; } };
  A.save_version = { d: 'Keep a named version in the browser (restore from File › Versions).', p: { name: ['string', 'Version name'] }, f: function (a) { return MS.versions.save(a.name || 'Saved by assistant', true).then(function () { return { ok: true }; }); } };
  A.undo = { d: 'Undo the last change.', p: {}, f: function () { MS.history.undo(); return { ok: true, canUndo: MS.history.canUndo() }; } };
  A.redo = { d: 'Redo.', p: {}, f: function () { MS.history.redo(); return { ok: true, canRedo: MS.history.canRedo() }; } };
  A.set_mode = { d: 'Edit or interact mode.', p: { mode: ['string', 'edit | interact', true] }, f: function (a) { MS.setMode(a.mode === 'interact' ? 'interact' : 'edit'); return done(); } };
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
  A.duplicate = { d: 'Duplicate an element or chart block.', p: { ref: ['string', 'Element ref or selector', true] }, f: function (a) { var el = elOf(a.ref); MS.blocks.duplicate(MS.blocks.of(el) || el); return done(); } };
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
  A.kpi_status = { d: 'Give a calculated KPI card red / amber / green status colours. Thresholds are raw data values (before ₹ crore formatting); between them is amber. better="" removes the colours.', p: { ref: ['string', 'KPI card ref (or its row: the first card is used)', true], better: ['string', 'high (higher is better) | low | "" to remove', true], good: ['number', 'Green at or beyond this'], bad: ['number', 'Red at or beyond this'] },
    f: function (a) {
      var el = elOf(a.ref), card = el.closest('[data-ms-kpi]') || el.querySelector('[data-ms-kpi]'); if (!card) throw new Error('That is not a calculated KPI card. Insert KPI cards from a dataset first.');
      var id = card.getAttribute('data-ms-kpi');
      MS.history.state('KPI status colours', function (s) { if (!s.kpis[id]) return; if (a.better) s.kpis[id].status = { better: a.better, good: a.good, bad: a.bad }; else delete s.kpis[id].status; });
      return settle(150).then(function () { return { ref: refOf(card), status: card.getAttribute('data-ms-status') || null, value: (card.querySelector('.ms-kpi-value') || {}).textContent }; });
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
      tooltip: ['string', 'Pop-up template, e.g. "{label}\\n{value:cr}" ("" = chart default). Placeholders {label} {series} {value} {pct} {total} {count} {<column>}; formats :inr :cr :lakh :k :m :pct :int'],
      look: ['object', '{font, size, color, legend: top|bottom|left|right|none, axisFormat: inr|cr|lakh|int|k|m|pct, tipBg, tipColor, tipBorder, tipSize, tipRadius} (null = reset)'],
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
  A.apply_theme = { d: 'Apply brand colours and fonts: a theme object, or the text of a brand SKILL.md.', p: { theme: ['object', '{name, colors:{primary, secondary, accent, background, surface, text, muted, border, ribbonBg, ribbonText}, fonts:{heading, body}, palette:[...], logo}'], markdown: ['string', 'Brand guidelines Markdown'], file: ['object', '{name, b64}: brand JSON, SKILL.md, .skill/.zip or a font file (the MCP load_brand tool fills this in)'] },
    f: function (a) {
      if (a.file) return Promise.resolve(MS.brand.loadFile(fileOf(a.file))).then(function () { var th = rt().state.theme; return th ? { theme: th.name, colors: th.colors } : { ok: true }; });
      var t = a.markdown ? MS.brand.parseMarkdown(a.markdown, 'brand') : MS.brand.normalize(a.theme || {}, 'api'); MS.brand.apply(t); return { theme: rt().state.theme.name, colors: rt().state.theme.colors }; } };
  A.brand_check = { d: 'Run the brand check (off-brand colours, contrast, charts without commentary) and return the findings.', p: {},
    f: function () { MS.brand.check(); var dlg = document.querySelector('.dlg'); var txt = dlg ? dlg.querySelector('.dlg-body').innerText : ''; if (dlg) dlg.closest('.dlg-wrap').remove(); return { report: txt }; } };

  /* ---------------------------------------------------------- review */
  A.add_comment = { d: 'Add a review comment on an element, an area, or an interaction.', p: { text: ['string', 'The comment', true], ref: ['string', 'Element ref/selector (element comment)'], chart: ['string', 'Or a chart name'], area: ['object', '{x, y, w, h} in page px (area comment)'], steps: ['array', 'What was done (interaction comment)'], type: ['string', 'change | bug | question | idea'], priority: ['string', 'must | should | nice'] },
    f: function (a) {
      var r = rt(), c = { id: r.uid('m'), created: new Date().toISOString(), text: a.text, type: a.type || 'change', prio: a.priority || 'should' };
      var t = r.layoutEnabled() ? r.tabs().filter(function (x) { return x.id === r.activeTab; })[0] : null;
      if (a.ref || a.chart) {
        var el = a.chart ? (MS.blocks.of(r.chart(chartKey(a.chart)).el) || r.chart(chartKey(a.chart)).el) : elOf(a.ref), d = MS.review.describe(el), sec = el.closest('section.ms-tab');
        c.kind = 'element'; c.tab = sec ? { id: sec.getAttribute('data-ms-tab'), title: sec.getAttribute('data-ms-title') } : null;
        c.target = { what: d.what, ref: '[data-ms-' + (el.getAttribute('data-ms-id') ? 'id' : 'ref') + '="' + refOf(el) + '"]', css: '', chart: d.chart };
        c.target.css = MS.review.cssPath(el); c.loc = MS.review.locate(el); c.target.section = c.loc.section;
      } else if (a.area) { c.kind = 'area'; c.tab = t ? { id: t.id, title: t.title } : null; c.area = { x: a.area.x, y: a.area.y, w: a.area.w, h: a.area.h, vw: MS.child.win.innerWidth, vh: MS.child.win.innerHeight, tab: t && t.id }; c.inside = []; }
      else { c.kind = 'interaction'; c.tab = t ? { id: t.id, title: t.title } : null; c.steps = a.steps || MS.review.log().slice(-4).map(function (x) { return x.text; }); c.state = {}; }
      MS.history.state('Add comment', function (s) { s.comments.push(c); }); MS.emit('comments');
      return { id: c.id, number: r.state.comments.length };
    } };
  A.list_comments = { d: 'All review comments.', p: {}, f: function () { return MS.review.list().map(function (c, i) { return { number: i + 1, id: c.id, kind: c.kind, text: c.text, type: c.type, priority: c.prio, done: !!c.done, on: c.target ? c.target.what : c.inside || c.steps, where: c.loc ? MS.review.trail(c.loc) : (c.tab && c.tab.title), tab: c.tab && c.tab.title }; }); } };
  A.update_comment = { d: 'Edit, close or delete a comment.', p: { id: ['string', 'Comment id', true], text: ['string', 'New text'], done: ['boolean', 'Mark done / re-open'], delete: ['boolean', 'Delete it'] },
    f: function (a) { MS.history.state('Comment', function (s) { if (a.delete) { s.comments = s.comments.filter(function (c) { return c.id !== a.id; }); return; } s.comments.forEach(function (c) { if (c.id !== a.id) return; if (a.text != null) c.text = a.text; if (a.done != null) c.done = a.done; }); }); MS.emit('comments'); return done(); } };
  A.comments_prompt = { d: 'Turn the review comments into one prompt for an AI assistant. Each comment is located by tab › section › card/chart › item.', p: { goal: ['string', 'apply (default) | polish | review | explain'], assistant: ['string', 'chat (default) | agent | mcp: who will carry it out'], scope: ['string', 'all (default) | tab | must'], tab: ['string', 'Tab title when scope is tab'], ids: ['array', 'Only these comment ids'], group: ['string', 'where | priority | order'], detail: ['string', 'full | brief'], output: ['string', 'file (complete updated HTML) | changes | plan | tickets'], include_done: ['boolean', 'Include closed comments'], extra: ['string', 'Extra instruction'], embed_html: ['boolean', 'Paste the dashboard source into the prompt'] },
    f: function (a) { return { prompt: MS.review.buildPrompt({ goal: a.goal, assistant: a.assistant, scope: a.scope, tab: a.tab, ids: a.ids, group: a.group, detail: a.detail, output: a.output, structure: true, includeDone: !!a.include_done, extra: a.extra, embed: a.embed_html ? MS.exportHtml({ dropComments: true }) : '', fileName: MS.exportName() }) }; } };

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

  MS.api = {};
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
