/* Tabs, inserting blocks, chart settings (tooltips, data binding, drill-down),
   datasets and the filter pane. */
(function (MS) {
  'use strict';

  /* ================================================================ TABS */
  var T = MS.tabs = {};
  function placeOp(label, node) {
    var p = node.parentNode, n = node.nextSibling;
    MS.history.push({ label: label,
      undo: function () { node.remove(); MS.afterDomChange(); },
      redo: function () { p.insertBefore(node, n && n.parentNode === p ? n : null); MS.afterDomChange(); } }, true);
  }
  T.ensureLayout = function () {
    var rt = MS.rt(); if (!rt) { MS.toast('Open a dashboard first (with scripts on).', 'warn'); return false; }
    if (rt.layoutEnabled()) return true;
    rt.enableLayout('Dashboard');
    MS.history.push({ label: 'Turn on tabbed layout', undo: function () { MS.rt().disableLayout(); MS.emit('structure'); }, redo: function () { MS.rt().enableLayout('Dashboard'); MS.emit('structure'); } }, true);
    MS.decorate(); MS.emit('structure');
    return true;
  };
  T.toggleLayout = function () {
    var rt = MS.rt(); if (!rt) return;
    if (!rt.layoutEnabled()) return T.ensureLayout() && MS.toast('Tabbed layout on. Your original page is the "Dashboard" tab. Add tabs from the left panel or the Insert menu.', 'ok', 6000);
    var others = rt.tabs().length - 1;
    MS.confirm('Turn off tabbed layout?', 'The content of all ' + (others + 1) + ' tabs will be placed one after another on a single page. A version is saved first, so you can go back from File › Versions.', 'Turn off').then(function (ok) {
      if (!ok) return;
      var html = MS.rt().tabs().map(function (t) { return t.title; });
      MS.versions.save('Before turning off tabs', true).then(function () {
        MS.rt().disableLayout();
        MS.history.clear();
        MS.emit('structure');
      });
      MS.toast('Layout off (' + html.length + ' tabs merged).');
    });
  };
  T.add = function (title, kind, html) {
    if (!T.ensureLayout()) return null;
    var rt = MS.rt();
    var id = rt.addTab(title, kind || 'grid', html || '');
    placeOp('Add tab "' + title + '"', rt.tabEl(id));
    rt.showTab(id); MS.decorate(); MS.emit('structure');
    return id;
  };
  T.addPrompt = function (kind) {
    MS.prompt(kind === 'content' ? 'New text tab' : 'New chart tab', kind === 'content' ? 'Notes' : 'New tab', 'Tab title').then(function (t) {
      if (!t) return;
      var id = T.add(t, kind, kind === 'content' ? '<h1>' + MS.esc(t) + '</h1><p>Double-click to write here, or use Insert › Into this tab to load a file.</p>' : '');
      if (kind === 'grid' && id) MS.toast('Empty tab added. Copy a chart (Ctrl+C) and paste it here (Ctrl+V), or drag a chart onto the tab name in the ribbon.', 'ok', 7000);
    });
  };
  T.rename = function (id) {
    var rt = MS.rt(), s = rt && rt.tabEl(id); if (!s) return;
    MS.prompt('Rename tab', s.getAttribute('data-ms-title')).then(function (v) {
      if (!v) return;
      MS.history.attrs('Rename tab', s, ['data-ms-title'], function (x) { x.setAttribute('data-ms-title', v); });
    });
  };
  T.remove = function (id) {
    var rt = MS.rt(), s = rt && rt.tabEl(id); if (!s) return;
    if (rt.tabs().length < 2) return MS.toast('A dashboard needs at least one tab.', 'warn');
    var copies = MS.$$('[data-ms-copyof]', MS.child.doc).filter(function (c) { var src = rt.chart(c.getAttribute('data-ms-copyof')); return src && s.contains(src.el) && !s.contains(c); });
    var msg = 'This removes the tab and everything on it. You can undo with Ctrl+Z.' + (copies.length ? ' Note: ' + copies.length + ' chart copy(ies) on other tabs are drawn from charts on this tab, so the tab will be hidden instead of deleted.' : '');
    MS.confirm('Delete "' + s.getAttribute('data-ms-title') + '"?', msg, copies.length ? 'Hide tab' : 'Delete', true).then(function (ok) {
      if (!ok) return;
      if (copies.length) return MS.history.attrs('Hide tab', s, ['data-ms-hidden'], function (x) { x.setAttribute('data-ms-hidden', ''); });
      MS.history.move('Delete tab', s, function () { s.remove(); });
    });
  };
  T.move = function (id, toIndex) {
    var rt = MS.rt(), s = rt.tabEl(id), tabs = rt.tabs().filter(function (t) { return t.id !== id; });
    var ref = tabs[toIndex] ? tabs[toIndex].el : null;
    MS.history.move('Reorder tabs', s, function () { s.parentNode.insertBefore(s, ref); });
  };
  T.toggleHidden = function (id) {
    var s = MS.rt().tabEl(id);
    MS.history.attrs(s.hasAttribute('data-ms-hidden') ? 'Show tab' : 'Hide tab', s, ['data-ms-hidden'], function (x) { if (x.hasAttribute('data-ms-hidden')) x.removeAttribute('data-ms-hidden'); else x.setAttribute('data-ms-hidden', ''); });
  };
  T.notes = function (id) {
    var s = MS.rt().tabEl(id);
    var f = MS.form([{ key: 'n', label: 'Speaker notes (shown in Presenter view, never in the exported dashboard)', type: 'textarea', rows: 8, value: s.getAttribute('data-ms-notes') || '' }]);
    MS.dialog({ title: 'Notes for "' + s.getAttribute('data-ms-title') + '"', body: f, enterSubmits: false, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', primary: true, value: function () { return f.values().n; } }] }).then(function (v) {
      if (v === null) return;
      MS.history.attrs('Tab notes', s, ['data-ms-notes'], function (x) { if (v) x.setAttribute('data-ms-notes', v); else x.removeAttribute('data-ms-notes'); });
    });
  };
  T.duplicate = function (id) {
    var rt = MS.rt(), s = rt.tabEl(id), kind = s.getAttribute('data-ms-kind');
    if (kind === 'original') return MS.toast('The original dashboard tab can\'t be duplicated as a whole. Copy individual charts instead.', 'warn');
    MS.history.group('Duplicate tab', function () {
      var nid = T.add(s.getAttribute('data-ms-title') + ' (copy)', kind, kind === 'content' ? s.querySelector('.ms-doc').innerHTML : '');
      if (kind === 'grid') {
        var g = MS.blocks.ensureGrid(rt.tabEl(nid));
        MS.$$('.ms-grid > .ms-block', s).forEach(function (b) { var nb = MS.blocks.duplicate(b, true); MS.history.move('Copy block', nb, function () { g.appendChild(nb); }); });
      }
    });
  };

  /* ================================================================ INSERT */
  var Ins = MS.insert = {};
  Ins.block = function (b) {
    var rt = MS.rt(), sel = MS.sel && MS.blocks.of(MS.sel);
    var host;
    if (sel) host = sel.parentNode;
    else if (rt && rt.layoutEnabled()) {
      var sec = rt.tabEl(rt.activeTab);
      host = sec.getAttribute('data-ms-kind') === 'content' ? sec.querySelector('.ms-doc') : MS.blocks.ensureGrid(sec);
    } else { host = MS.child.doc.body; b.classList.add('ms-inline'); }
    MS.history.move('Insert', b, function () { if (sel) host.insertBefore(b, sel.nextSibling); else if (host === MS.child.doc.body) host.insertBefore(b, MS.child.doc.getElementById('ms-state')); else host.appendChild(b); });
    MS.decorate();
    setTimeout(function () { MS.edit.reveal(b); }, 50);
    return b;
  };
  Ins.text = function () {
    if (!MS.child) return;
    Ins.block(MS.blocks.create({ title: 'Heading', sub: '', inf: '', content: true, html: '<p>Double-click to edit this text.</p>', span: 6 }));
  };
  Ins.image = function () {
    MS.pickFiles('image/*', { multiple: true }).then(function (fs) { if (fs.length) MS.importers.asBlock(fs); });
  };
  Ins.fileBlock = function () { MS.pickFiles(MS.importers.accept, { multiple: true }).then(function (fs) { if (fs.length) MS.importers.asBlock(fs); }); };
  Ins.fileTab = function () { MS.pickFiles(MS.importers.accept, { multiple: true }).then(function (fs) { if (fs.length) MS.importers.newTabs(fs); }); };
  Ins.intoCurrent = function () {
    var rt = MS.rt(); if (!rt || !rt.layoutEnabled()) return MS.toast('Turn on tabbed layout first.', 'warn');
    MS.pickFiles(MS.importers.accept, { multiple: true }).then(function (fs) { if (fs.length) MS.importers.intoTab(rt.activeTab, fs); });
  };
  Ins.table = function () {
    var rt = MS.rt(), names = Object.keys(rt.state.datasets);
    if (!names.length) return MS.toast('No datasets yet. Use Data › Find data or Load data file.', 'warn');
    var f = MS.form([{ key: 'ds', label: 'Dataset', type: 'select', options: names }, { key: 'n', label: 'Rows to show', type: 'number', value: 50 }]);
    MS.dialog({ title: 'Insert a table snapshot', body: f, buttons: [{ label: 'Cancel', value: null }, { label: 'Insert', primary: true, value: function () { return f.values(); } }] }).then(function (v) {
      if (!v) return;
      var rows = rt.filteredRows(v.ds).slice(0, v.n || 50), cols = rows[0] ? Object.keys(rows[0]) : [];
      var html = '<table class="ms-table"><thead><tr>' + cols.map(function (c) { return '<th>' + MS.esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (r) { return '<tr>' + cols.map(function (c) { var x = r[c]; return '<td' + (typeof x === 'number' ? ' class="num"' : '') + '>' + MS.esc(typeof x === 'number' ? rt.fmtNum(x) : x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
      Ins.block(MS.blocks.create({ title: v.ds, sub: 'Snapshot of ' + rows.length + ' rows', content: true, html: html, span: 12 }));
    });
  };

  /* ================================================================ DATASETS */
  var Dt = MS.data = {};
  Dt.addDataset = function (name, rows, silent) {
    var rt = MS.rt(); if (!rt) return MS.toast('Open a dashboard first.', 'warn');
    if (!Array.isArray(rows) || !rows.length) return MS.toast(name + ': no rows found.', 'warn');
    var base = name, i = 2; while (rt.state.datasets[name]) name = base + ' (' + (i++) + ')';
    var size = JSON.stringify(rows).length;
    MS.history.state('Add dataset ' + name, function (s) { s.datasets[name] = { rows: rows, source: 'file' }; });
    if (!silent || size > 3e6) MS.toast('Dataset "' + name + '" added: ' + rows.length + ' rows (' + MS.bytes(size) + ' embedded in the export).', size > 3e6 ? 'warn' : 'ok', 6000);
    MS.emit('structure');
    return name;
  };
  Dt.addDatasetFromJson = function (j, file) {
    var name = file.replace(/\.json$/i, '');
    if (Array.isArray(j)) return Dt.addDataset(name, j);
    var n = 0;
    Object.keys(j).forEach(function (k) { if (Array.isArray(j[k]) && j[k][0] && typeof j[k][0] === 'object') { Dt.addDataset(name + '.' + k, j[k], true); n++; } });
    MS.toast(n ? 'Added ' + n + ' dataset(s) from ' + file : file + ' has no table-like arrays.', n ? 'ok' : 'warn');
  };
  Dt.loadFile = function () {
    MS.pickFiles('.json,.csv,.tsv,.xlsx,.xls,.xlsm,.ods', { multiple: true }).then(function (fs) {
      fs.forEach(function (f) {
        if (MS.ext(f.name) === 'json') MS.readFile(f).then(function (t) { try { Dt.addDatasetFromJson(JSON.parse(t), f.name); } catch (e) { MS.toast(f.name + ': ' + e.message, 'error'); } });
        else MS.lib('xlsx').then(function (X) { return MS.readFile(f, 'buffer').then(function (b) { MS.importers.sheet(X, b, f.name, f.name.replace(/\.[^.]+$/, '')).datasets.forEach(function (d) { Dt.addDataset(d.name, d.rows); }); }); }).catch(function (e) { MS.toast(e.message, 'error'); });
      });
    });
  };
  Dt.discover = function () {
    var rt = MS.rt(); if (!rt) return MS.toast('Scripts must be on to find data.', 'warn');
    var found = rt.discoverDatasets();
    var known = JSON.stringify(rt.state.datasets);
    found = found.filter(function (f) { return known.indexOf(JSON.stringify(f.expr || f.scriptId)) < 0 || f.sub; });
    if (!found.length) return MS.toast('No table-like data found in the page\'s scripts. You can load a JSON/CSV/Excel file instead (Data › Load data file).', 'warn', 7000);
    var checks = found.map(function (f) {
      var label = (f.expr || ('#' + f.scriptId + (f.sub ? '.' + f.sub : '')));
      var cb = MS.h('input', { type: 'checkbox', checked: true });
      var nm = MS.h('input', { 'class': 'inp', value: label.replace(/^window\./, '') });
      return { f: f, cb: cb, nm: nm, row: MS.h('div', { 'class': 'list-row' }, [cb, MS.h('div', { 'class': 'grow' }, [MS.h('code', { text: label }), MS.h('small', { 'class': 'muted', text: ' ' + f.rows + ' rows · ' + f.fields.slice(0, 8).join(', ') + (f.fields.length > 8 ? '…' : '') })]), nm]) };
    });
    MS.dialog({ title: 'Data found inside the dashboard', wide: true, body: MS.h('div', {}, [MS.h('p', { text: 'These stay linked to the page\'s own data (nothing is copied), so they refresh whenever the dashboard\'s data does.' }), MS.h('div', { 'class': 'list' }, checks.map(function (c) { return c.row; }))]),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Add selected', primary: true, value: true }] }).then(function (ok) {
      if (!ok) return;
      MS.history.state('Add datasets', function (s) {
        checks.forEach(function (c) { if (!c.cb.checked) return; var d = c.f.expr ? { expr: c.f.expr, source: 'page' } : { scriptId: c.f.scriptId, sub: c.f.sub, source: 'page' }; s.datasets[c.nm.value || c.f.expr] = d; });
      });
      MS.emit('structure');
      MS.toast('Datasets added. Now bind a chart to one: select a chart, then Charts › Data & drill-down.', 'ok', 7000);
    });
  };
  Dt.manage = function () {
    var rt = MS.rt(); if (!rt) return;
    var names = Object.keys(rt.state.datasets);
    var body = MS.h('div', {}, [
      MS.h('div', { 'class': 'row gap' }, [MS.h('button', { 'class': 'btn', onclick: function () { close(); Dt.discover(); } }, ['Find data in dashboard']), MS.h('button', { 'class': 'btn', onclick: function () { close(); Dt.loadFile(); } }, ['Load data file…'])]),
      names.length ? MS.h('div', { 'class': 'list' }, names.map(function (n) {
        var d = rt.state.datasets[n], rows = rt.getRows(n);
        return MS.h('div', { 'class': 'list-row' }, [
          MS.h('div', { 'class': 'grow' }, [MS.h('strong', { text: n }), MS.h('small', { 'class': 'muted', text: ' · ' + rows.length + ' rows · ' + (d.rows ? 'embedded' : 'linked to page') })]),
          MS.h('button', { 'class': 'btn sm', onclick: function () { rt.showDetails(n, rows); } }, ['View']),
          MS.h('button', { 'class': 'btn sm', onclick: function () { MS.download(n.replace(/\W+/g, '_') + '.json', JSON.stringify(rows, null, 1), 'application/json'); } }, ['Download']),
          MS.h('button', { 'class': 'btn sm danger', onclick: function (e) { MS.history.state('Remove dataset', function (s) { delete s.datasets[n]; s.filters = s.filters.filter(function (f) { return f.dataset !== n; }); }); e.target.closest('.list-row').remove(); MS.emit('structure'); } }, ['Remove'])
        ]);
      })) : MS.h('p', { 'class': 'muted', text: 'No datasets yet.' })
    ]);
    var close = function () { var w = MS.$('.dlg-wrap'); if (w) w.remove(); };
    MS.dialog({ title: 'Datasets', wide: true, body: body, buttons: [{ label: 'Close', primary: true, value: null }] });
  };

  /* ================================================================ FILTER PANE */
  Dt.filters = function () {
    var rt = MS.rt(); if (!rt) return;
    var names = Object.keys(rt.state.datasets);
    if (!names.length) return MS.toast('Add a dataset first (Data › Find data or Load data file).', 'warn');
    var work = JSON.parse(JSON.stringify(rt.state.filters));
    var L = rt.state.layout.pane;
    var list = MS.h('div', { 'class': 'list' });
    function draw() {
      list.innerHTML = '';
      if (!work.length) list.appendChild(MS.h('p', { 'class': 'muted', text: 'No filters yet.' }));
      work.forEach(function (f, i) {
        var lab = MS.h('input', { 'class': 'inp', value: f.label || f.field, oninput: function () { f.label = lab.value; } });
        list.appendChild(MS.h('div', { 'class': 'list-row' }, [
          MS.h('span', { 'class': 'grow', text: f.dataset + ' › ' + f.field }), lab,
          MS.h('button', { 'class': 'btn sm', title: 'Up', onclick: function () { if (i) { work.splice(i - 1, 0, work.splice(i, 1)[0]); draw(); } } }, ['↑']),
          MS.h('button', { 'class': 'btn sm danger', onclick: function () { work.splice(i, 1); draw(); } }, ['✕'])
        ]));
      });
    }
    draw();
    var add = MS.form([{ key: 'ds', label: 'Dataset', type: 'select', options: names }, { key: 'field', label: 'Field', type: 'select', options: rt.fields(names[0]).map(function (f) { return f.name; }) }], function (k, v, inputs) {
      if (k === 'ds') { inputs.field.innerHTML = ''; rt.fields(v).forEach(function (f) { inputs.field.appendChild(MS.h('option', { value: f.name, text: f.name })); }); }
    });
    var opts = MS.form([
      { key: 'title', label: 'Pane title', value: L.title || 'Filters' },
      { key: 'position', label: 'Position', type: 'select', options: [{ value: 'left', label: 'Left side' }, { value: 'top', label: 'Top bar' }], value: L.position || 'left' },
      { key: 'visible', label: 'Show the filter pane', type: 'checkbox', value: L.visible !== false }
    ]);
    var body = MS.h('div', {}, [MS.h('h4', { text: 'Filters' }), list, MS.h('div', { 'class': 'row gap end' }, [add, MS.h('button', { 'class': 'btn', onclick: function () { var v = add.values(); work.push({ dataset: v.ds, field: v.field, label: v.field }); draw(); } }, ['+ Add filter'])]), MS.h('h4', { text: 'Pane' }), opts,
      MS.h('p', { 'class': 'muted', text: 'Filters apply to every chart bound to the same dataset (Charts › Data & drill-down).' })]);
    MS.dialog({ title: 'Design the filter pane', wide: true, body: body, buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', primary: true, value: true }] }).then(function (ok) {
      if (!ok) return;
      var o = opts.values();
      MS.history.state('Edit filter pane', function (s) { s.filters = work; s.layout.pane.title = o.title; s.layout.pane.position = o.position; s.layout.pane.visible = o.visible; });
      MS.decorate();
    });
  };

  /* ================================================================ CHART SETTINGS */
  var C = MS.charts = {};
  C.selectedKey = function () {
    var rt = MS.rt(); if (!rt || !MS.sel) return null;
    var c = rt.chartOf(MS.sel.classList.contains('ms-block') ? (MS.sel.querySelector('.ms-visual') || MS.sel) : MS.sel);
    return c ? c.key : null;
  };
  C.requireKey = function () { var k = C.selectedKey(); if (!k) MS.toast('Select a chart first (click it in the dashboard, or in the Charts list on the left).', 'warn'); return k; };

  var PRESETS = [
    ['', '(chart default)'],
    ['{label}: {value}', 'Label: value'],
    ['{series}\n{label}: {value:inr}', 'Series + ₹ value'],
    ['{label}\n{value:cr}', '₹ crore'],
    ['{label}\n{value:lakh}', '₹ lakh'],
    ['{label}: {value} ({pct:pct} of total)', 'Value + share %'],
    ['{label}\nValue: {value:inr}\nRecords: {count}', 'Value + record count (bound charts)']
  ];

  C.settings = function (key) {
    var rt = MS.rt(); key = key || C.requireKey(); if (!rt || !key) return;
    var c = rt.chart(key), info = rt.chartInfo(key) || {};
    var cs = JSON.parse(JSON.stringify(rt.state.charts[key] || {}));
    var b = cs.binding || {};
    var block = c && c.el.closest('.ms-block');
    var dsNames = Object.keys(rt.state.datasets);

    /* -- tooltip pane -- */
    var tplIn = MS.h('textarea', { 'class': 'inp mono', rows: 3, value: cs.tooltip || '' });
    var preset = MS.h('select', { 'class': 'inp', onchange: function () { tplIn.value = preset.value; prev(); } }, PRESETS.map(function (p) { return MS.h('option', { value: p[0], text: p[1] }); }));
    var vars = ['label', 'series', 'value', 'pct', 'total', 'index'].concat(b.dataset ? ['count'].concat(rt.fields(b.dataset).filter(function (f) { return f.numeric; }).map(function (f) { return f.name; })) : []);
    var chips = MS.h('div', { 'class': 'chips' }, vars.map(function (v) { return MS.h('button', { 'class': 'chip', type: 'button', onclick: function () { insertAt(tplIn, '{' + v + '}'); prev(); } }, ['{' + v + '}']); }));
    var preview = MS.h('div', { 'class': 'tip-preview' });
    function prev() {
      var t = tplIn.value;
      if (!t) { preview.textContent = '(the chart\'s own tooltip)'; return; }
      var ctx = { label: (info.labels || [])[0] || 'Maharashtra', series: (info.series || [])[0] || 'Sales', value: 12345678.9, pct: 23.4, total: 52763000, index: 0, count: 128 };
      preview.textContent = rt.fmt(t, ctx);
    }
    tplIn.addEventListener('input', prev); prev();
    var tipPane = MS.h('div', {}, [
      MS.h('label', { 'class': 'field' }, [MS.h('span', { text: 'Start from' }), preset]),
      MS.h('label', { 'class': 'field' }, [MS.h('span', { text: 'Tooltip template (new line = new line in the tooltip)' }), tplIn]), chips,
      MS.h('small', { 'class': 'hint', html: 'Formats: <code>{value:inr}</code> ₹1,23,456 · <code>{value:cr}</code> ₹1.23 Cr · <code>{value:lakh}</code> · <code>{value:k}</code> · <code>{value:pct}</code> · <code>{value:0.0}</code> · <code>{value:usd}</code>' }),
      MS.h('div', { 'class': 'field' }, [MS.h('span', { text: 'Preview' }), preview])
    ]);

    /* -- data & drill pane -- */
    var dsSel = MS.h('select', { 'class': 'inp' }, [MS.h('option', { value: '', text: '— not bound (use the chart\'s own data) —' })].concat(dsNames.map(function (n) { var o = MS.h('option', { value: n, text: n }); if (n === b.dataset) o.selected = true; return o; })));
    var dynamic = MS.h('div');
    var levelsWrap = MS.h('div', { 'class': 'levels' });
    var levels = (b.levels || []).slice();
    var measureSel, aggSel, seriesSel, sortSel, topIn, modeSel, colsSel;
    function fieldOpts(numericOnly, blank) {
      var fs = dsSel.value ? rt.fields(dsSel.value) : [];
      return (blank ? [{ value: '', label: blank }] : []).concat(fs.filter(function (f) { return !numericOnly || f.numeric; }).map(function (f) { return { value: f.name, label: f.name + (f.numeric ? ' (number)' : '') }; }));
    }
    function drawData() {
      dynamic.innerHTML = '';
      if (!dsSel.value) { dynamic.appendChild(MS.h('p', { 'class': 'muted', html: dsNames.length ? 'Bind the chart to a dataset to enable <b>drill-down</b>, <b>filters</b> and rich tooltips.' : 'No datasets yet. Close this and use <b>Data › Find data in dashboard</b> or <b>Load data file</b>.' })); return; }
      var fs = rt.fields(dsSel.value);
      if (!levels.length) { var cat = fs.filter(function (f) { return !f.numeric; })[0]; if (cat) levels.push(cat.name); }
      levelsWrap.innerHTML = '';
      levels.forEach(function (lv, i) {
        var s = MS.h('select', { 'class': 'inp', onchange: function () { levels[i] = s.value; } }, fieldOpts(false).map(function (o) { var op = MS.h('option', { value: o.value, text: o.label }); if (o.value === lv) op.selected = true; return op; }));
        levelsWrap.appendChild(MS.h('div', { 'class': 'row gap' }, [MS.h('span', { 'class': 'lvl', text: i === 0 ? 'Show by' : 'Drill to' }), s,
          i ? MS.h('button', { 'class': 'btn sm', type: 'button', onclick: function () { levels.splice(i, 1); drawData(); } }, ['✕']) : null]));
      });
      levelsWrap.appendChild(MS.h('button', { 'class': 'btn sm', type: 'button', onclick: function () { var f = fs.filter(function (x) { return !x.numeric && levels.indexOf(x.name) < 0; })[0]; levels.push(f ? f.name : fs[0].name); drawData(); } }, ['+ Add drill level']));
      var f = MS.form([
        { key: 'measure', label: 'Value (measure)', type: 'select', options: fieldOpts(true), value: b.measure || (fs.filter(function (x) { return x.numeric; })[0] || {}).name },
        { key: 'agg', label: 'Aggregate', type: 'select', options: [{ value: 'sum', label: 'Sum' }, { value: 'avg', label: 'Average' }, { value: 'count', label: 'Count rows' }, { value: 'min', label: 'Minimum' }, { value: 'max', label: 'Maximum' }], value: b.agg || 'sum' },
        { key: 'series', label: 'Split into series by (optional)', type: 'select', options: fieldOpts(false, '— none —'), value: b.series || '' },
        { key: 'sort', label: 'Sort', type: 'select', options: [{ value: '', label: 'By label' }, { value: 'desc', label: 'Largest first' }, { value: 'asc', label: 'Smallest first' }], value: b.sort || '' },
        { key: 'top', label: 'Show top N only (blank = all)', type: 'number', value: b.top || '' },
        { key: 'mode', label: 'Double-click does', type: 'select', value: (cs.drill && cs.drill.mode) || 'levels', options: [
          { value: 'levels', label: 'Drill down to the next level, then show the records' },
          { value: 'details', label: 'Show the underlying records' },
          { value: 'crossfilter', label: 'Filter every chart on this dataset by the clicked value' },
          { value: 'none', label: 'Nothing' }] },
        { key: 'cols', label: 'Columns in the records view (none selected = all)', type: 'select', multiple: true, options: fieldOpts(false), value: (cs.drill && cs.drill.columns) || [] }
      ]);
      measureSel = f.inputs.measure; aggSel = f.inputs.agg; seriesSel = f.inputs.series; sortSel = f.inputs.sort; topIn = f.inputs.top; modeSel = f.inputs.mode; colsSel = f;
      dynamic.appendChild(MS.h('h4', { text: 'Levels (drill path)' }));
      dynamic.appendChild(levelsWrap);
      dynamic.appendChild(f);
    }
    dsSel.addEventListener('change', function () { levels = []; drawData(); });
    drawData();
    var dataPane = MS.h('div', {}, [MS.h('label', { 'class': 'field' }, [MS.h('span', { text: 'Dataset' }), dsSel]), dynamic]);

    /* -- layout & commentary pane -- */
    var head = block && block.querySelector('.ms-head');
    var guessed = !block ? (info.title || MS.blocks.guessTitle(c.el) || '') : '';
    var lay = MS.form([
      { key: 'title', label: 'Title', value: head ? head.querySelector('.ms-title').textContent : guessed },
      { key: 'sub', label: 'Subtitle', value: head ? head.querySelector('.ms-sub').textContent : '' },
      { key: 'inf', label: 'Inference (the "so what")', type: 'textarea', rows: 3, value: head ? head.querySelector('.ms-inf').textContent : '' },
      { key: 'span', label: 'Width (columns out of 12)', type: 'number', min: 1, max: 12, value: block ? (parseInt((block.style.gridColumn || 'span 6').replace(/\D+/g, ''), 10) || 6) : 6, hidden: !block || block.classList.contains('ms-inline') },
      { key: 'height', label: 'Chart height (px)', type: 'number', min: 80, value: block ? (parseInt(block.querySelector('.ms-visual').style.getPropertyValue('--ms-h'), 10) || Math.round(block.querySelector('.ms-visual').getBoundingClientRect().height) || 300) : '', hidden: !block }
    ]);
    var layPane = block ? lay : MS.h('div', {}, [lay, MS.h('small', { 'class': 'hint', text: 'A header with these three lines will be added above the chart.' })]);
    var origLay = JSON.stringify(lay.values());

    var tabs = [['Commentary & size', layPane], ['Tooltip', tipPane], ['Data & drill-down', dataPane]];
    var nav = MS.h('div', { 'class': 'seg' }), panes = MS.h('div');
    tabs.forEach(function (t, i) {
      var p = MS.h('div', { 'class': 'seg-pane' + (i ? '' : ' on') }, [t[1]]);
      panes.appendChild(p);
      nav.appendChild(MS.h('button', { 'class': 'seg-btn' + (i ? '' : ' on'), type: 'button', onclick: function (e) { MS.$$('.seg-btn', nav).forEach(function (x) { x.classList.remove('on'); }); MS.$$('.seg-pane', panes).forEach(function (x) { x.classList.remove('on'); }); e.target.classList.add('on'); p.classList.add('on'); } }, [t[0]]));
    });
    var closeDlg = function () { var w = MS.$('.dlg-wrap'); if (w) w.remove(); };
    var title = 'Chart settings · ' + ((head && head.querySelector('.ms-title').textContent) || info.title || guessed || key) + ' (' + (info.lib || '?') + ' ' + (info.type || '') + ')';
    MS.dialog({ title: title, wide: true, enterSubmits: false, body: MS.h('div', {}, [nav, panes]), buttons: [
      { label: 'Reset chart', value: 'reset', danger: true }, { label: 'Cancel', value: null }, { label: 'Apply', primary: true, value: 'apply' }] }).then(function (v) {
      if (!v) return;
      if (v === 'reset') { rt.drill[key] = []; return MS.history.state('Reset chart', function (s) { delete s.charts[key]; }); }
      MS.history.group('Chart settings', function () {
        var next = JSON.parse(JSON.stringify(rt.state.charts[key] || {}));
        if (tplIn.value.trim()) next.tooltip = tplIn.value; else delete next.tooltip;
        if (dsSel.value && measureSel) {
          var bv = colsSel.values();
          next.binding = { dataset: dsSel.value, levels: levels.filter(Boolean), measure: bv.measure, agg: bv.agg, series: bv.series || undefined, sort: bv.sort || undefined, top: bv.top || undefined };
          next.drill = { mode: bv.mode, columns: bv.cols && bv.cols.length ? bv.cols : undefined };
          next.title = block ? lay.values().title : info.title;
        } else { delete next.binding; delete next.drill; }
        rt.drill[key] = [];
        MS.history.state('Chart data & tooltip', function (s) { s.charts[key] = JSON.parse(JSON.stringify(next)); });
        var lv0 = lay.values();
        if (!block && JSON.stringify(lv0) !== origLay && (lv0.title || lv0.sub || lv0.inf)) { block = MS.blocks.wrap(c.el, true); head = block.querySelector('.ms-head'); }
        if (block) {
          var lv = lv0;
          [['.ms-title', lv.title], ['.ms-sub', lv.sub], ['.ms-inf', lv.inf]].forEach(function (p) {
            var n = head.querySelector(p[0]); if (n.textContent !== p[1]) { var bf = n.innerHTML; var af = MS.esc(p[1]); n.innerHTML = af; MS.history.push({ label: 'Commentary', undo: function () { n.innerHTML = bf; }, redo: function () { n.innerHTML = af; } }, true); }
          });
          if (!block.classList.contains('ms-inline') || lv.height) MS.blocks.resize(block, block.classList.contains('ms-inline') ? null : lv.span, lv.height);
          if (block.classList.contains('ms-inline') && lv.height) MS.history.attrs('Height', block.querySelector('.ms-visual'), ['style'], function (x) { x.style.height = 'var(--ms-h)'; });
        }
      });
      MS.toast('Chart updated.' + (dsSel.value ? ' Switch to Interact mode (top right) and double-click a bar to try the drill-down.' : ''), 'ok', 6000);
    });
  };
  function insertAt(ta, text) { var s = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd || s); ta.focus(); ta.selectionStart = ta.selectionEnd = s + text.length; }

  C.tooltipAll = function () {
    var rt = MS.rt(); if (!rt) return;
    var ta = MS.h('textarea', { 'class': 'inp mono', rows: 3, value: '{label}: {value:inr}' });
    MS.dialog({ title: 'Same tooltip for every chart', body: MS.h('div', {}, [MS.h('label', { 'class': 'field' }, [MS.h('span', { text: 'Template (blank = restore each chart\'s own tooltip)' }), ta]), MS.h('small', { 'class': 'hint', html: 'Placeholders: {label} {series} {value} {pct} {total}. Formats: :inr :cr :lakh :k :pct :0.0' })]), enterSubmits: false,
      buttons: [{ label: 'Cancel', value: null }, { label: 'Apply to all', primary: true, value: function () { return ta.value; } }] }).then(function (v) {
      if (v === null) return;
      MS.history.state('Tooltip on all charts', function (s) { rt.charts().forEach(function (c) { s.charts[c.key] = s.charts[c.key] || {}; if (v) s.charts[c.key].tooltip = v; else delete s.charts[c.key].tooltip; }); });
    });
  };
})(window.MS);
