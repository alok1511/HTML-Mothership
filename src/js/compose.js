/* Building from scratch: a blank dashboard, page sections, banners, footers,
   columns, callouts, KPI cards and new charts made from a dataset. */
(function (MS) {
  'use strict';
  var Cp = MS.compose = {};

  function today() { return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }

  // Turn an HTML string into owned (export-kept) nodes inside the child.
  function make(html) {
    var d = MS.child.doc, w = d.createElement('div');
    w.innerHTML = html.trim();
    var n = w.firstElementChild;
    n.setAttribute('data-ms-own', '');
    MS.$$('*', n).forEach(function (x) { if (!x.hasAttribute('data-ms-id')) x.setAttribute('data-ms-own', ''); });
    return n;
  }
  Cp.make = make;

  // Where new page parts go: the current tab (or the page), after the selected part.
  function container() {
    var rt = MS.rt(), d = MS.child.doc;
    if (rt && rt.layoutEnabled()) {
      var sec = rt.tabEl(rt.activeTab);
      if (sec.getAttribute('data-ms-kind') === 'content') return sec.querySelector('.ms-doc') || sec;
      if (sec.getAttribute('data-ms-kind') === 'grid') return MS.blocks.ensureGrid(sec);
      return sec;
    }
    return d.body;
  }
  function place(node, label, where) {
    var d = MS.child.doc, host = container(), ref = null;
    var sel = MS.sel && MS.sel.isConnected && host.contains(MS.sel) && MS.sel !== host ? MS.sel : null;
    if (where === 'top') ref = host.firstElementChild;
    else if (sel) {
      // insert after the selected element's top-level part (inside a section's grid if that's where it is)
      var a = sel;
      while (a.parentElement && a.parentElement !== host && !a.parentElement.classList.contains('ms-grid')) a = a.parentElement;
      host = a.parentElement; ref = a.nextSibling;
    } else if (host === d.body) ref = d.getElementById('ms-state');
    if (host.classList.contains('ms-grid')) node.classList.add('ms-in-grid');
    MS.history.move(label, node, function () { host.insertBefore(node, ref && ref.parentNode === host ? ref : null); });
    MS.decorate();
    setTimeout(function () { MS.edit.reveal(node); }, 60);
    return node;
  }
  Cp.place = place;
  function need() { if (!MS.child) { MS.toast('Open a dashboard, or start one with File › New.', 'warn'); return false; } return true; }

  /* ---------------------------------------------------------- page parts */
  Cp.PARTS = {
    banner: { label: 'Page header', icon: '🟦', title: 'A coloured header with a title and subtitle at the top of this tab/page', where: 'top',
      html: function () { return '<header class="ms-banner"><h1>Dashboard title</h1><p>What this page answers · Updated ' + today() + '</p></header>'; } },
    section: { label: 'Section', icon: '▭', title: 'A titled section with its own grid. Select it, then insert charts, KPI cards or text into it.',
      html: function () { return '<section class="ms-section"><div class="ms-section-head"><h2>Section title</h2><p>One line on what this section shows.</p></div><div class="ms-grid"></div></section>'; } },
    heading: { label: 'Heading', icon: 'H', title: 'A heading', html: function () { return '<h2 class="ms-heading">Heading</h2>'; } },
    para: { label: 'Paragraph', icon: '¶', title: 'A paragraph of text', html: function () { return '<p class="ms-para">Double-click to write. Use the Home tab for fonts and colours.</p>'; } },
    cols2: { label: '2 columns', icon: '◫', title: 'Two columns of text side by side',
      html: function () { return '<div class="ms-cols" style="--cols:2">' + [1, 2].map(function (i) { return '<div class="ms-col"><h3>Column ' + i + '</h3><p>Double-click to edit.</p></div>'; }).join('') + '</div>'; } },
    cols3: { label: '3 columns', icon: '▥', title: 'Three columns of text side by side',
      html: function () { return '<div class="ms-cols" style="--cols:3">' + [1, 2, 3].map(function (i) { return '<div class="ms-col"><h3>Column ' + i + '</h3><p>Double-click to edit.</p></div>'; }).join('') + '</div>'; } },
    callout: { label: 'Callout', icon: '💡', title: 'A highlighted note, e.g. a key insight or a caveat',
      html: function () { return '<div class="ms-callout"><span class="ms-callout-icon">💡</span><p>Key insight: double-click to edit.</p></div>'; } },
    divider: { label: 'Divider', icon: '―', title: 'A horizontal line', html: function () { return '<hr class="ms-divider">'; } },
    spacer: { label: 'Spacer', icon: '↕', title: 'Empty space (resize with the Box height in the right panel)', html: function () { return '<div class="ms-spacer"></div>'; } }
  };
  Cp.part = function (id) {
    if (!need()) return;
    var p = Cp.PARTS[id];
    return place(make(p.html()), 'Insert ' + p.label.toLowerCase(), p.where);
  };

  Cp.button = function () {
    if (!need()) return;
    var f = MS.form([{ key: 'label', label: 'Button text', value: 'Open the full report' }, { key: 'url', label: 'Link (web address or file)', placeholder: 'https://…' }]);
    MS.dialog({ title: 'Insert a button link', body: f, buttons: [{ label: 'Cancel', value: null }, { label: 'Insert', primary: true, value: function () { return f.values(); } }] }).then(function (v) {
      if (!v || !v.label) return;
      var a = make('<p class="ms-para"><a class="ms-btn" target="_blank" rel="noopener"></a></p>');
      a.firstChild.textContent = v.label;
      if (v.url) a.firstChild.setAttribute('href', v.url);
      place(a, 'Insert button');
    });
  };

  // The footer sits under every tab (or at the end of a one-page dashboard).
  Cp.footer = function () {
    if (!need()) return;
    var d = MS.child.doc;
    var ex = d.querySelector('.ms-page-footer');
    if (ex) { MS.edit.reveal(ex); return MS.toast('This dashboard already has a footer. Double-click its text to edit it.', 'warn'); }
    var f = make('<footer class="ms-page-footer"><p>Source: internal data · Prepared by the analytics team</p><p>Confidential · Updated ' + today() + '</p></footer>');
    var app = d.getElementById('ms-app');
    var ref = app ? app.nextSibling : d.getElementById('ms-state');
    MS.history.move('Insert footer', f, function () { d.body.insertBefore(f, ref && ref.parentNode === d.body ? ref : null); });
    setTimeout(function () { MS.edit.reveal(f); }, 60);
    MS.toast('Footer added. It shows under every tab. Double-click to edit the text.', 'ok');
  };

  /* ---------------------------------------------------------- KPI cards */
  var AGGS = [{ value: 'sum', label: 'Sum' }, { value: 'avg', label: 'Average' }, { value: 'count', label: 'Count rows' }, { value: 'distinct', label: 'Count distinct' }, { value: 'min', label: 'Minimum' }, { value: 'max', label: 'Maximum' }];
  var FORMATS = [{ value: '', label: 'Number (1,23,456.78)' }, { value: 'inr', label: '₹ (₹1,23,457)' }, { value: 'cr', label: '₹ crore' }, { value: 'lakh', label: '₹ lakh' }, { value: 'int', label: 'Whole number' }, { value: 'k', label: 'Thousands (K)' }, { value: 'm', label: 'Millions (M)' }, { value: 'pct', label: 'Percent (value already ×100)' }, { value: 'pct100', label: 'Percent (0–1 value)' }, { value: 'usd', label: 'US$' }];
  function kpiCard(id, label, value, note) {
    var c = make('<div class="ms-kpi"><div class="ms-kpi-label"></div><div class="ms-kpi-value"></div><div class="ms-kpi-note"></div></div>');
    if (id) c.setAttribute('data-ms-kpi', id);
    c.querySelector('.ms-kpi-label').textContent = label;
    c.querySelector('.ms-kpi-value').textContent = value;
    c.querySelector('.ms-kpi-note').textContent = note || '';
    return c;
  }
  Cp.kpis = function () {
    if (!need()) return;
    var rt = MS.rt(), names = rt ? Object.keys(rt.state.datasets) : [];
    var f = MS.form([
      { key: 'ds', label: 'Dataset (cards follow the filter pane)', type: 'select', options: [{ value: '', label: '— none: type the numbers yourself —' }].concat(names.map(function (n) { return { value: n, label: n }; })), value: names[0] || '' },
      { key: 'n', label: 'Number of cards', type: 'number', min: 1, max: 8, value: 4 }
    ]);
    MS.dialog({ title: 'Insert KPI cards', body: MS.h('div', {}, [f, MS.h('small', { 'class': 'hint', text: 'With a dataset, each card starts on one number column. Double-click a card\'s number later to change what it shows.' })]),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Insert', primary: true, value: function () { return f.values(); } }] }).then(function (v) {
      if (!v) return;
      var n = Math.max(1, Math.min(8, v.n || 4)), row = make('<div class="ms-kpis"></div>'), specs = {};
      var nums = v.ds ? rt.fields(v.ds).filter(function (x) { return x.numeric; }) : [];
      for (var i = 0; i < n; i++) {
        if (v.ds) {
          var fld = nums[i % (nums.length || 1)], id = rt.uid('k');
          specs[id] = fld ? { dataset: v.ds, measure: fld.name, agg: 'sum', format: '' } : { dataset: v.ds, agg: 'count', format: 'int' };
          row.appendChild(kpiCard(id, fld ? 'Total ' + fld.name : 'Records', '…', v.ds));
        } else row.appendChild(kpiCard(null, 'KPI ' + (i + 1), '₹0 Cr', 'vs last month'));
      }
      MS.history.group('Insert KPI cards', function () {
        if (v.ds) MS.history.state('KPI settings', function (s) { Object.keys(specs).forEach(function (k) { s.kpis[k] = specs[k]; }); });
        place(row, 'Insert KPI cards');
      });
    });
  };
  Cp.kpiSettings = function (card) {
    var rt = MS.rt(); if (!rt) return;
    var names = Object.keys(rt.state.datasets);
    if (!names.length) return MS.toast('These cards are typed by hand. Double-click the label or number to edit it. Load a dataset (Data tab) to make cards that calculate.', 'warn', 7000);
    var id = card.getAttribute('data-ms-kpi'), k = (id && rt.state.kpis[id]) || { dataset: names[0], agg: 'sum' };
    var fieldsOf = function (ds) { return rt.fields(ds).map(function (x) { return { value: x.name, label: x.name + (x.numeric ? ' (number)' : '') }; }); };
    var f = MS.form([
      { key: 'label', label: 'Label', value: card.querySelector('.ms-kpi-label').textContent },
      { key: 'dataset', label: 'Dataset', type: 'select', options: names, value: k.dataset },
      { key: 'measure', label: 'Column', type: 'select', options: fieldsOf(k.dataset), value: k.measure || '' },
      { key: 'agg', label: 'Calculate', type: 'select', options: AGGS, value: k.agg || 'sum' },
      { key: 'format', label: 'Show as', type: 'select', options: FORMATS, value: k.format || '' },
      { key: 'note', label: 'Small note under the number', value: card.querySelector('.ms-kpi-note').textContent }
    ]);
    f.inputs.dataset.addEventListener('change', function () { f.inputs.measure.innerHTML = ''; fieldsOf(f.inputs.dataset.value).forEach(function (o) { f.inputs.measure.appendChild(MS.h('option', { value: o.value, text: o.label })); }); });
    MS.dialog({ title: 'KPI card', body: f, buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', primary: true, value: function () { return f.values(); } }] }).then(function (v) {
      if (!v) return;
      MS.history.group('KPI card', function () {
        var nid = id || rt.uid('k');
        if (!id) MS.history.attrs('KPI card', card, ['data-ms-kpi'], function (x) { x.setAttribute('data-ms-kpi', nid); });
        [['.ms-kpi-label', v.label], ['.ms-kpi-note', v.note]].forEach(function (p) {
          var n = card.querySelector(p[0]), b = n.textContent; if (b === p[1]) return;
          n.textContent = p[1]; MS.history.push({ label: 'KPI text', undo: function () { n.textContent = b; }, redo: function () { n.textContent = p[1]; } }, true);
        });
        MS.history.state('KPI settings', function (s) { s.kpis[nid] = { dataset: v.dataset, measure: v.measure, agg: v.agg, format: v.format }; });
      });
    });
  };

  /* ---------------------------------------------------------- new chart from a dataset (Chart.js) */
  // Chart.js is put into the dashboard itself, so exports keep working offline.
  Cp.ensureChartLib = function () {
    var w = MS.child.win;
    if (w.Chart && w.Chart.register) return Promise.resolve(w.Chart);
    if (w.Chart) return Promise.reject(new Error('This dashboard has an old Chart.js (version ' + (w.Chart.version || '2') + '). New charts need version 3 or later.'));
    return MS.libSource('chartjs').then(function (src) {
      var d = MS.child.doc, s = d.createElement('script');
      s.setAttribute('data-ms-own', ''); s.setAttribute('data-ms-lib', 'chartjs');
      s.textContent = src;
      d.head.appendChild(s);
      if (!w.Chart) throw new Error('Chart.js did not start inside the dashboard.');
      return w.Chart;
    });
  };
  var TYPES = [{ value: 'bar', label: 'Column (vertical bars)' }, { value: 'hbar', label: 'Bar (horizontal)' }, { value: 'stacked', label: 'Stacked columns (needs "split by")' }, { value: 'line', label: 'Line' }, { value: 'area', label: 'Area' }, { value: 'pie', label: 'Pie' }, { value: 'doughnut', label: 'Doughnut' }];
  Cp.chart = function () {
    if (!need()) return;
    var rt = MS.rt(); if (!rt) return MS.toast('Turn off Safe mode (View tab) to add charts.', 'warn');
    var names = Object.keys(rt.state.datasets);
    if (!names.length) return MS.dialog({ title: 'A chart needs data', body: MS.h('p', { html: 'Load a CSV, Excel or JSON file first (<b>Data › Load data</b>), or let Mothership find the tables inside this dashboard (<b>Data › Find data</b>).' }),
      buttons: [{ label: 'Close', value: null }, { label: 'Find data', value: 'find' }, { label: 'Load data file', primary: true, value: 'load' }] }).then(function (v) { if (v === 'load') MS.data.loadFile(); if (v === 'find') MS.data.discover(); });
    var opts = function (ds, numeric, blank) { return (blank ? [{ value: '', label: blank }] : []).concat(rt.fields(ds).filter(function (x) { return numeric == null || !!x.numeric === numeric; }).map(function (x) { return { value: x.name, label: x.name }; })); };
    var ds0 = names[0];
    var f = MS.form([
      { key: 'title', label: 'Title', value: 'New chart' },
      { key: 'ds', label: 'Dataset', type: 'select', options: names, value: ds0 },
      { key: 'type', label: 'Chart type', type: 'select', options: TYPES, value: 'bar' },
      { key: 'by', label: 'Show by (categories)', type: 'select', options: opts(ds0, false) },
      { key: 'measure', label: 'Value', type: 'select', options: opts(ds0, true) },
      { key: 'agg', label: 'Calculate', type: 'select', options: AGGS.filter(function (a) { return a.value !== 'distinct'; }), value: 'sum' },
      { key: 'series', label: 'Split by (optional, gives several series)', type: 'select', options: opts(ds0, false, '— none —') },
      { key: 'sort', label: 'Sort', type: 'select', options: [{ value: 'desc', label: 'Largest first' }, { value: '', label: 'By label' }, { value: 'asc', label: 'Smallest first' }] },
      { key: 'top', label: 'Top N only (blank = all)', type: 'number', min: 1 }
    ]);
    f.inputs.ds.addEventListener('change', function () {
      var ds = f.inputs.ds.value;
      [['by', false], ['measure', true], ['series', false, '— none —']].forEach(function (p) { var s = f.inputs[p[0]]; s.innerHTML = ''; opts(ds, p[1], p[2]).forEach(function (o) { s.appendChild(MS.h('option', { value: o.value, text: o.label })); }); });
    });
    MS.dialog({ title: 'New chart from data', body: MS.h('div', {}, [f, MS.h('small', { 'class': 'hint', text: 'The chart follows the filter pane and supports drill-down. Add more drill levels later in Chart settings › Data & drill-down.' })]),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Insert chart', primary: true, value: function () { return f.values(); } }] }).then(function (v) {
      if (!v) return;
      Cp.ensureChartLib().then(function () { Cp.addChart(v); }).catch(function (e) { MS.toast(e.message, 'error', 8000); });
    });
  };
  Cp.addChart = function (v) {
    var rt = MS.rt(), key = rt.uid('c');
    var b = MS.blocks.create({ title: v.title || '', sub: v.ds, span: /pie|doughnut/.test(v.type) ? 4 : 6, height: 300 });
    var holder = make('<div></div>'); holder.setAttribute('data-ms-chart', key);
    b.querySelector('.ms-visual').appendChild(holder);
    var spec = { native: { type: v.type }, binding: { dataset: v.ds, levels: [v.by].filter(Boolean), measure: v.agg === 'count' ? undefined : v.measure, agg: v.agg, series: v.series || undefined, sort: v.sort || undefined, top: v.top || undefined }, drill: { mode: 'levels' }, title: v.title };
    MS.history.group('Insert chart', function () {
      MS.history.state('New chart', function (s) { s.charts[key] = JSON.parse(JSON.stringify(spec)); });
      var sec = MS.sel && MS.sel.closest && MS.sel.closest('.ms-section');
      if (sec && !MS.blocks.of(MS.sel)) MS.history.move('Insert chart', b, function () { sec.querySelector(':scope > .ms-grid').appendChild(b); });
      else MS.insert.block(b);
      if (b.classList.contains('ms-inline')) b.querySelector('.ms-visual').style.height = 'var(--ms-h)';
    });
    MS.decorate();
    setTimeout(function () { var r = MS.rt(); if (r) r.refresh(); MS.emit('structure'); MS.edit.reveal(b); }, 60);
  };

  /* ---------------------------------------------------------- new dashboard */
  function blankHtml(title) {
    return '<!DOCTYPE html>\n<html lang="en-IN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + MS.esc(title) + '</title>\n' +
      '<style>\nbody{margin:0;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;color:#1f2937;background:#f6f7fb}\n.page{padding:20px 24px;max-width:1400px;margin:0 auto}\n</style>\n</head>\n<body>\n<main class="page">\n' +
      '<header class="ms-banner"><h1>' + MS.esc(title) + '</h1><p>What this dashboard answers · Updated ' + today() + '</p></header>\n' +
      '<p>Start building from the <b>Insert</b> tab: sections, KPI cards, charts from your data, columns, callouts and a footer.</p>\n</main>\n</body>\n</html>\n';
  }
  var STARTER = {
    how: '<h1>How to use this dashboard</h1><ol><li>Use the tabs at the top to move between pages.</li><li>Use the filter pane to narrow the data. Every chart and KPI card follows it.</li><li>Hover over a chart to see exact values. Double-click a bar or slice to drill down.</li><li>Use the breadcrumb above a chart to go back up.</li></ol>',
    faq: '<h1>FAQs</h1><details><summary>Where does the data come from?</summary><p>Describe the source system and the refresh date.</p></details><details><summary>How often is it updated?</summary><p>For example, every Monday by 10 am.</p></details><details><summary>Whom do I contact?</summary><p>Name and email of the owner.</p></details>',
    method: '<h1>Methodology</h1><h2>Definitions</h2><p>Define each KPI and how it is calculated.</p><h2>Data cleaning</h2><p>Note exclusions, adjustments and known gaps.</p><h2>Formats</h2><p>Amounts are in ₹ (lakh / crore). Dates follow the Indian financial year (April–March).</p>'
  };
  Cp.newDoc = function () {
    var f = MS.form([
      { key: 'title', label: 'Dashboard name', value: 'New dashboard' },
      { key: 'kind', label: 'Start with', type: 'select', value: 'tabs', options: [{ value: 'tabs', label: 'Tabs: Overview, How to use, FAQs, Methodology' }, { value: 'blank', label: 'One blank page' }] }
    ]);
    var go = function () {
      MS.dialog({ title: 'New dashboard', body: f, buttons: [{ label: 'Cancel', value: null }, { label: 'Create', primary: true, value: function () { return f.values(); } }] }).then(function (v) {
        if (!v) return;
        var title = v.title || 'New dashboard';
        if (v.kind === 'tabs') {
          var off = MS.on('child-loaded', function () {
            off && off();
            setTimeout(function () {
              var rt = MS.rt(); if (!rt) return;
              rt.enableLayout('Overview');
              rt.addTab('How to use', 'content', STARTER.how);
              rt.addTab('FAQs', 'content', STARTER.faq);
              rt.addTab('Methodology', 'content', STARTER.method);
              rt.state.layout.ribbon.brand = title;
              rt.refresh(); rt.showTab(rt.tabs()[0].id);
              MS.decorate(); MS.history.clear(); MS.emit('structure');
            }, 40);
          });
        }
        MS.openHtml(blankHtml(title), title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '.html');
        MS.toast('New dashboard ready. Use the Insert tab to add sections, KPI cards, charts and a footer.', 'ok', 7000);
      });
    };
    if (MS.child && MS.dirty) MS.confirm('Start a new dashboard?', 'Unsaved changes to ' + MS.doc.name + ' are kept in Versions (autosave), but export first if you need the file.', 'Start new').then(function (ok) { if (ok) go(); });
    else go();
  };
})(window.MS);
