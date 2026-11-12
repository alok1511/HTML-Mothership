/* Building from scratch: a blank dashboard, page sections, banners, footers,
   columns, callouts, KPI cards and new charts made from a dataset. */
(function (MS) {
  'use strict';
  var Cp = MS.compose = {};

  function today() { return new Date().toLocaleDateString(MS.locale ? MS.locale.get().locale : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }

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
    // the dashboard's own tabs: the tab on screen
    var ph = MS.pageTabs && MS.pageTabs.insertHost(); if (ph) return ph;
    return d.body;
  }
  Cp.container = container;
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
  var FORMATS = [{ value: '', label: 'Number (region style)' }, { value: 'cur', label: 'Currency (region, e.g. $1,234)' }, { value: 'curshort', label: 'Currency short ($1.2M)' }, { value: 'short', label: 'Short (1.2M)' }, { value: 'int', label: 'Whole number' }, { value: 'k', label: 'Thousands (K)' }, { value: 'm', label: 'Millions (M)' }, { value: 'pct', label: 'Percent (value already ×100)' }, { value: 'pct100', label: 'Percent (0–1 value)' }, { value: 'usd', label: 'US$' }];
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
        } else row.appendChild(kpiCard(null, 'KPI ' + (i + 1), '0', 'vs last month'));
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
      { key: 'format', label: 'Show as', type: 'select', options: FORMATS.some(function (f) { return f.value === (k.format || ''); }) ? FORMATS : FORMATS.concat([{ value: k.format, label: 'Saved format (' + k.format + ')' }]), value: k.format || '' },
      { key: 'note', label: 'Small note under the number', value: card.querySelector('.ms-kpi-note').textContent }
    ]);
    var st = k.status || {};
    var rag = MS.form([
      { key: 'better', label: 'Which is better?', type: 'select', options: [{ value: '', label: 'No status colour' }, { value: 'high', label: 'Higher is better (sales, profit)' }, { value: 'low', label: 'Lower is better (cost, claims, delays)' }], value: k.status ? (st.better || 'high') : '' },
      { key: 'good', label: 'Green (good) at or beyond', type: 'number', value: st.good != null ? st.good : '' },
      { key: 'bad', label: 'Red (bad) at or beyond', type: 'number', value: st.bad != null ? st.bad : '' }
    ]);
    var body = MS.h('div', {}, [f, MS.h('h4', { 'class': 'rag-head', text: 'Status colours (red / amber / green)' }), rag,
      MS.h('small', { 'class': 'hint', text: 'Use the raw numbers from the data, before currency or K/M formatting. In between is amber. The colour updates whenever filters change.' })]);
    f.inputs.dataset.addEventListener('change', function () { f.inputs.measure.innerHTML = ''; fieldsOf(f.inputs.dataset.value).forEach(function (o) { f.inputs.measure.appendChild(MS.h('option', { value: o.value, text: o.label })); }); });
    MS.dialog({ title: 'KPI card', body: body, buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', primary: true, value: function () { var o = f.values(); o.rag = rag.values(); return o; } }] }).then(function (v) {
      if (!v) return;
      MS.history.group('KPI card', function () {
        var nid = id || rt.uid('k');
        if (!id) MS.history.attrs('KPI card', card, ['data-ms-kpi'], function (x) { x.setAttribute('data-ms-kpi', nid); });
        [['.ms-kpi-label', v.label], ['.ms-kpi-note', v.note]].forEach(function (p) {
          var n = card.querySelector(p[0]), b = n.textContent; if (b === p[1]) return;
          n.textContent = p[1]; MS.history.push({ label: 'KPI text', undo: function () { n.textContent = b; }, redo: function () { n.textContent = p[1]; } }, true);
        });
        MS.history.state('KPI settings', function (s) { s.kpis[nid] = { dataset: v.dataset, measure: v.measure, agg: v.agg, format: v.format }; var r = v.rag; if (r.better) s.kpis[nid].status = { better: r.better, good: r.good, bad: r.bad }; });
      });
    });
  };

  /* ---------------------------------------------------------- new chart from a dataset (Chart.js) */
  // Chart.js is put into the dashboard itself, so exports keep working offline.
  Cp.ensureChartLib = function () {
    var child = MS.child, w = child.win;
    if (w.Chart && w.Chart.register) return Promise.resolve(w.Chart);
    if (w.Chart) return Promise.reject(new Error('This dashboard has an old Chart.js (version ' + (w.Chart.version || '2') + '). New charts need version 3 or later.'));
    return MS.libSource('chartjs').then(function (src) {
      if (MS.child !== child) throw new Error('The open dashboard changed.');
      if (w.Chart && w.Chart.register) return w.Chart;
      var d = child.doc, s = d.createElement('script');
      s.setAttribute('data-ms-own', ''); s.setAttribute('data-ms-lib', 'chartjs');
      s.textContent = src;
      d.head.appendChild(s);
      if (!w.Chart) throw new Error('Chart.js did not start inside the dashboard.');
      return w.Chart;
    });
  };
  var TYPES = [{ value: 'bar', label: 'Column (vertical bars)' }, { value: 'hbar', label: 'Bar (horizontal)' }, { value: 'stacked', label: 'Stacked columns (needs "split by")' }, { value: 'hstacked', label: 'Stacked bars, horizontal (needs "split by")' }, { value: 'line', label: 'Line' }, { value: 'area', label: 'Area' }, { value: 'pie', label: 'Pie' }, { value: 'doughnut', label: 'Doughnut' }, { value: 'stackedarea', label: 'Stacked area (needs "split by")' }, { value: 'dumbbell', label: 'Dumbbell: two values per row joined by a line (needs "split by")' }, { value: 'range', label: 'Range: low to high bar with the middle as a dot (split by low / mid / high)' }, { value: 'pyramid', label: 'Pyramid: two groups back to back (split by the two groups)' }, { value: 'dot-compare', label: 'Dot comparison (split by series)' }, { value: 'area-benchmark', label: 'Area with benchmark (layout only)', layoutOnly: true }, { value: 'scatter', label: 'Scatter (x and y columns)' }, { value: 'bubble', label: 'Bubble (x, y and size columns)' }];
  Cp.TYPES = TYPES;
  // Binding keys beyond the basics, kept by every editor that rewrites a binding.
  Cp.EXTRA = ['x', 'y', 'size', 'where', 'only', 'hide', 'order', 'rename', 'seriesOnly', 'seriesHide', 'seriesOrder', 'percent', 'sparse', 'overlay'];
  Cp.chart = async function (preferredDataset) {
    if (!need()) return;
    var rt = MS.rt(), child = MS.child;
    if (!rt) return MS.toast('Turn off Safe mode in View to add charts.', 'warn');
    var names = Object.keys(rt.state.datasets);
    if (!names.length) {
      var loaded = await MS.data.loadFile();
      return loaded.length ? Cp.chart(loaded[0]) : false;
    }
    var h = MS.h, cache = new Map(), first = names.includes(preferredDataset) ? preferredDataset : names[0];
    var limits = { categories: 120, series: 16, preview: 24 };
    var chart, previewKind, chartLib, timer, closed = false, suggested = '';
    var labels = ['By name', 'Largest first', 'Smallest first', 'Source order'];
    var order = ['', 'desc', 'asc', 'source'].map(function (value, i) { return { value: value, label: labels[i] }; });
    var form = MS.form([
      { key: 'ds', label: 'Dataset', type: 'select', options: names, value: first },
      { key: 'type', label: 'Chart type', type: 'select', options: TYPES.filter(function (type) { return !type.layoutOnly; }) },
      { key: 'by', label: 'Category', type: 'select' },
      { key: 'agg', label: 'Calculation', type: 'select', options: AGGS.filter(function (x) { return x.value !== 'distinct'; }) },
      { key: 'measure', label: 'Value', type: 'select' },
      { key: 'x', label: 'X axis', type: 'select' },
      { key: 'y', label: 'Y axis', type: 'select' },
      { key: 'size', label: 'Bubble size', type: 'select' },
      { key: 'series', label: 'Split by', type: 'select' },
      { key: 'title', label: 'Chart title', type: 'text' },
      { key: 'subtitle', label: 'Unit and scope (optional)', type: 'text', placeholder: 'e.g. Shipments, units, October' },
      { key: 'inference', label: 'Key inference (optional)', type: 'text', placeholder: 'What should the reader take away?' },
      { key: 'caption', label: 'Show a summary that follows filters', type: 'checkbox' },
      { key: 'sort', label: 'Sort categories', type: 'select', options: order },
      { key: 'top', label: 'Category limit', type: 'number', min: 1, max: limits.categories, value: 24 },
      { key: 'filter', label: 'Filter this chart by', type: 'select' },
      { key: 'filterValue', label: 'Equals', type: 'text' },
      { key: 'percent', label: 'Show each stack as 100%', type: 'checkbox' }
    ]);
    var i = form.inputs, control = {};
    Object.keys(i).forEach(function (key) {
      control[key] = i[key].closest('label');
      i[key].setAttribute('aria-label', control[key].querySelector('span').textContent);
    });
    control.inference.classList.add('bi-wide');
    control.caption.classList.add('bi-wide');
    var advanced = h('details', { 'class': 'bi-advanced' }, [h('summary', { text: 'Sort, limit and filter' })]);
    ['sort', 'top', 'filter', 'filterValue', 'percent'].forEach(function (k) { advanced.appendChild(control[k]); });
    form.appendChild(advanced);
    var status = h('p', { 'class': 'bi-status', role: 'status' });
    var canvas = h('canvas', { role: 'img', 'aria-label': 'Chart preview' });
    var surface = h('div', { 'class': 'bi-canvas' }, [canvas]);
    var legend = h('ul', { 'class': 'bi-legend', 'aria-label': 'Chart preview legend', hidden: true });
    var data = h('div', { 'class': 'bi-table' });
    var source = h('details', {}, [h('summary', { text: 'Source rows' }), data]);
    var preview = h('section', { 'class': 'bi-preview', 'aria-label': 'Chart preview area' },
      [h('h3', { text: 'Preview' }), status, surface, legend, source]);
    function fields(name) {
      if (!cache.has(name)) cache.set(name, { fields: rt.fields(name), rows: rt.getRows(name) });
      return cache.get(name);
    }
    function fill(key, values, fallback, blank) {
      var field = i[key], selected = field.value;
      field.replaceChildren(...(blank ? [new Option(blank, '')] : []), ...values.map(function (v) { return new Option(v, v); }));
      if (values.includes(selected)) field.value = selected;
      else field.value = fallback == null ? '' : fallback;
    }
    function sourceTable(entry) {
      var columns = entry.fields.slice(0, 12).map(function (f) { return f.name; });
      var table = h('table', { 'aria-label': 'First eight source rows' }, [
        h('thead', {}, [h('tr', {}, columns.map(function (n) { return h('th', { scope: 'col', text: n }); }))]),
        h('tbody', {}, entry.rows.slice(0, 8).map(function (row) {
          return h('tr', {}, columns.map(function (n) { return h('td', { text: row[n] == null ? '' : String(row[n]) }); }));
        }))
      ]);
      data.replaceChildren(h('p', { 'class': 'muted', text: 'First ' + Math.min(8, entry.rows.length) + ' rows · ' + columns.length + ' of ' + entry.fields.length + ' columns' }), table);
    }
    function setDataset() {
      var entry = fields(i.ds.value), all = entry.fields.map(function (f) { return f.name; });
      var nums = entry.fields.filter(function (f) { return f.numeric; }).map(function (f) { return f.name; });
      var category = entry.fields.find(function (f) { return !f.numeric; });
      fill('by', all, category ? category.name : all[0]);
      fill('measure', nums, nums[0]);
      fill('x', nums, nums[0]); fill('y', nums, nums[1] || nums[0]); fill('size', nums, nums[2] || nums[0]);
      fill('series', all, '', 'No split'); fill('filter', all, '', 'No chart filter'); i.filterValue.value = '';
      if (!nums.length) i.agg.value = 'count';
      else if (rt.XY_TYPES[i.type.value] || i.agg.value === 'count') i.agg.value = 'sum';
      sourceTable(entry);
    }
    function sync() {
      var xy = !!rt.XY_TYPES[i.type.value], stacked = /stacked/.test(i.type.value);
      ['x', 'y'].forEach(function (k) { control[k].hidden = !xy; });
      control.size.hidden = i.type.value !== 'bubble';
      control.measure.hidden = xy || i.agg.value === 'count';
      control.percent.hidden = !stacked;
      control.caption.hidden = xy;
      control.filterValue.hidden = !i.filter.value;
      Array.from(i.agg.options).forEach(function (option) { option.disabled = xy && option.value !== 'sum' && option.value !== 'avg'; });
      if (i.agg.selectedOptions[0] && i.agg.selectedOptions[0].disabled) i.agg.value = 'sum';
      var next = (xy ? i.y.value + ' vs ' + i.x.value : (i.agg.value === 'count' ? 'Record count' : i.measure.value)) + ' by ' + i.by.value;
      if (!i.title.value || i.title.value === suggested) i.title.value = next;
      suggested = next;
    }
    function values() {
      var v = form.values(), xy = !!rt.XY_TYPES[v.type], stacked = /stacked/.test(v.type);
      var required = { stacked: 2, hstacked: 2, stackedarea: 2, dumbbell: 2, range: 3, pyramid: 2, 'dot-compare': 2 }[v.type];
      if (!v.by) throw new Error('Choose a category column.');
      if (xy && (!v.x || !v.y || v.type === 'bubble' && !v.size)) throw new Error('Choose numeric columns for both axes and the bubble size when needed.');
      if (!xy && v.agg !== 'count' && !v.measure) throw new Error('Choose a numeric value or select Count rows.');
      if (!Number.isInteger(v.top) || v.top < 1 || v.top > limits.categories) throw new Error('Choose a category limit from 1 to ' + limits.categories + '.');
      if (required && !v.series) throw new Error('Choose a split-by column for this chart type.');
      if (v.filter && !v.filterValue.trim()) throw new Error('Enter a value for the chart filter.');
      v.title = v.title.trim() || suggested;
      v.percent = stacked && v.percent;
      v.legend = !!v.series;
      v.sparse = true;
      v.caption = v.caption && !xy;
      v.where = v.filter ? [{ field: v.filter, op: 'eq', value: v.filterValue.trim() }] : [];
      if (!xy) { v.x = ''; v.y = ''; }
      if (v.type !== 'bubble') v.size = '';
      return v;
    }
    function calculate(v, top) {
      return rt.previewBinding({ dataset: v.ds, levels: [v.by], measure: v.measure, agg: v.agg, series: v.series,
        sort: v.sort, top: top, where: v.where, x: v.x, y: v.y, size: v.size, percent: v.percent, sparse: v.sparse }, v.type, limits.series);
    }
    function check(v, result) {
      if (!result.labels.length || !result.series.some(function (s) { return s.values.some(function (n) { return n !== null; }); })) throw new Error('No values match these settings.');
      if ((v.percent || /^(pie|doughnut)$/.test(v.type)) && result.series.some(function (s) { return s.values.some(function (n) { return n < 0; }); })) throw new Error('Use a bar or line chart for negative values.');
      if (result.seriesCount > limits.series) throw new Error('The split has ' + result.seriesCount + ' series. Choose a different split or filter the chart to ' + limits.series + ' series or fewer.');
      if (/^(dumbbell|pyramid|range)$/.test(v.type) && result.seriesCount !== (v.type === 'range' ? 3 : 2)) {
        throw new Error('This chart type needs exactly ' + (v.type === 'range' ? 'three' : 'two') + ' series.');
      }
    }
    function draw() {
      if (closed || child !== MS.child || !chartLib) return;
      try {
        var v = values(), result = calculate(v, Math.min(v.top, limits.preview));
        check(v, result);
        surface.hidden = false;
        if (!chart || previewKind !== v.type) {
          if (chart) chart.destroy();
          var config = rt.nativeConfig({ type: v.type });
          config.options.animation = false;
          config.options.plugins.legend.display = false;
          chart = new chartLib(canvas, config);
          previewKind = v.type;
        }
        rt.paintPreview(chart, result);
        var radial = /^(pie|doughnut)$/.test(v.type), datasets = chart.data.datasets;
        var items = radial ? result.labels.map(function (label, j) {
          return { label: label, backgroundColor: datasets[0].backgroundColor[j] };
        }) : v.legend ? datasets.filter(function (d) { return !d.msLink; }) : [];
        legend.hidden = !items.length;
        legend.replaceChildren(...items.map(function (item) {
          return h('li', {}, [h('span', { 'aria-hidden': 'true', style: { backgroundColor: item.borderColor || item.backgroundColor } }), item.label]);
        }));
        status.textContent = result.labels.length + ' of ' + result.categories.toLocaleString('en-US') +
          ' categories in preview · ' + result.rows.toLocaleString('en-US') + ' matching rows';
      } catch (error) {
        if (chart) { chart.destroy(); chart = null; }
        surface.hidden = true;
        legend.hidden = true;
        status.textContent = error.message;
      }
    }
    function queue() { clearTimeout(timer); timer = setTimeout(draw, 90); }
    form.addEventListener('change', function (event) {
      if (event.target === i.ds) setDataset();
      sync(); queue();
    });
    i.filterValue.addEventListener('input', queue);
    setDataset(); sync();
    status.textContent = 'Loading chart preview…';
    var dialog = MS.dialog({ title: 'Build chart', xwide: true, enterSubmits: false,
      body: h('div', { 'class': 'bi-builder' }, [form, preview]),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Insert chart', primary: true, value: function () {
        try {
          var v = values();
          check(v, calculate(v, Math.min(v.top, limits.preview)));
          return v;
        } catch (error) { MS.dialogError(error.message); return false; }
      } }] });
    MS.lib('chartjs').then(function (lib) { chartLib = lib; draw(); }).catch(function (error) { status.textContent = error.message; });
    var selected = await dialog;
    closed = true; clearTimeout(timer);
    if (chart) chart.destroy();
    if (!selected || MS.child !== child) return false;
    try {
      await Cp.ensureChartLib();
      if (MS.child !== child) return false;
      Cp.addChart(selected);
      return true;
    } catch (error) { MS.toast(error.message, 'error', 8000); return false; }
  };
  Cp.fromData = async function () {
    var child = MS.child, doc = MS.doc;
    if (MS.settings.safe) return MS.toast('Turn off Safe mode in View to build charts from data.', 'warn');
    var tables = await MS.data.pickDatasets();
    if (!tables.length || child !== MS.child || doc !== MS.doc) return false;
    if (!child && !(await Cp.createDoc(tables[0].file.replace(/\.[^.]+$/, ''), true))) return false;
    var names = MS.data.addTables(tables);
    return names.length ? Cp.chart(names[0]) : false;
  };
  Cp.addChart = function (v) {
    var rt = MS.rt(), key = rt.uid('c');
    var b = MS.blocks.create({ title: v.title || '', sub: v.subtitle || v.ds, inf: v.inference, span: v.span || (/pie|doughnut/.test(v.type) ? 4 : 6), height: v.height || 300 });
    var holder = make('<div></div>'); holder.setAttribute('data-ms-chart', key);
    b.querySelector('.ms-visual').appendChild(holder);
    var spec = { native: { type: v.type, legend: v.legend || undefined }, binding: { dataset: v.ds, levels: [v.by].filter(Boolean), measure: v.agg === 'count' ? undefined : v.measure, agg: v.agg, series: v.series || undefined, sort: v.sort || undefined, top: v.top || undefined, percent: v.percent || undefined }, drill: { mode: 'levels' }, title: v.title };
    if (v.caption) spec.summary = { show: 'caption' };
    Cp.EXTRA.forEach(function (k) { if (v[k] != null && v[k] !== '' && !(Array.isArray(v[k]) && !v[k].length)) spec.binding[k] = v[k]; });
    MS.history.group('Insert chart', function () {
      MS.history.push({ label: 'Chart settings',
        undo: function () { delete MS.rt().state.charts[key]; },
        redo: function () { MS.rt().state.charts[key] = JSON.parse(JSON.stringify(spec)); } });
      var sec = MS.sel && MS.sel.closest && MS.sel.closest('.ms-section');
      if (sec && !MS.blocks.of(MS.sel)) MS.history.move('Insert chart', b, function () { sec.querySelector(':scope > .ms-grid').appendChild(b); });
      else MS.insert.block(b);
      if (b.classList.contains('ms-inline')) b.querySelector('.ms-visual').style.height = 'var(--ms-h)';
    });
    MS.decorate();
    if (b.isConnected) { MS.afterDomChange(); MS.edit.reveal(b); }
  };

  /* ---------------------------------------------------------- new dashboard */
  function blankHtml(title) {
    return '<!DOCTYPE html>\n<html lang="' + (MS.locale ? MS.locale.get().locale : 'en-US') + '">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + MS.esc(title) + '</title>\n' +
      '<style>\nbody{margin:0;font-family:"Segoe UI",system-ui,-apple-system,sans-serif;color:#1f2937;background:#f6f7fb}\n.page{padding:20px 24px;max-width:1400px;margin:0 auto}\n</style>\n</head>\n<body>\n<main class="page">\n' +
      '<header class="ms-banner"><h1>' + MS.esc(title) + '</h1><p>What this dashboard answers · Updated ' + today() + '</p></header>\n' +
      '<p>Start building from the <b>Insert</b> tab: sections, KPI cards, charts from your data, columns, callouts and a footer.</p>\n</main>\n</body>\n</html>\n';
  }
  var STARTER = {
    how: '<h1>How to use this dashboard</h1><p><b>Before sharing:</b> replace the examples below with the exact tabs, filters and charts in your report.</p>' +
      '<h2>Start with the overview</h2><p>State who this dashboard is for, what period it covers, and what decision it supports.</p>' +
      '<h2>Explore the numbers</h2><ol><li>Open the Overview tab. Read the headline and the key numbers.</li><li>If a filter is available, choose a region or period. Say which charts and cards should change.</li><li>Hover over a bar or line to see the value and units.</li><li>If the chart supports drill-down, double-click a point to see the next level. Use the breadcrumb to go back.</li><li>Use Reset to return to the starting view.</li></ol>' +
      '<h2>If something looks different</h2><p>Check the selected period, filters and reporting units. See Methodology for definitions and the data date.</p>',
    faq: '<h1>Frequently asked questions</h1><p>Replace these prompts with short, specific answers for your audience.</p>' +
      '<details><summary>Where do the numbers come from?</summary><p>Name the source system or report, its owner and the reporting period.</p></details>' +
      '<details><summary>When was the data last updated?</summary><p>Give the data-as-of date and the refresh schedule. Distinguish the release date from the data date.</p></details>' +
      '<details><summary>Why does this total differ from another report?</summary><p>Explain differences in filters, exclusions, period, rounding or units. Point to the exact definition in Methodology.</p></details>' +
      '<details><summary>Why is a chart empty?</summary><p>Explain whether the chosen filters have no records, data is missing, or the chart needs a separate source.</p></details>' +
      '<details><summary>Who can help?</summary><p>Give the team or owner to contact. Ask readers to include the tab, filter choices and the number they saw.</p></details>',
    method: '<h1>Methodology</h1><h2>Scope and period</h2><p>State the population, reporting period, refresh cadence and data-as-of date.</p>' +
      '<h2>Source and owner</h2><p>Name the originating system or report and the responsible team. List any manual inputs.</p>' +
      '<h2>Definitions</h2><p>Define each KPI, its formula, units, rounding and whether it follows filters. Example: net sales = invoiced value less returns, excluding tax.</p>' +
      '<h2>Cleaning and exclusions</h2><p>Describe how blanks, duplicates and exceptions are handled. Note any coverage gaps and why comparisons may differ.</p>' +
      '<h2>Verification</h2><p>Record the independent report used for key totals and what was checked. State anything not verified.</p>'
  };
  Cp.createDoc = function (title, tabs, opts) {
    title = String(title || 'New dashboard');
    opts = Object.assign({}, opts, { dirty: true, onLoad: function () {
      var rt = MS.rt();
      if (tabs && rt) {
        rt.enableLayout('Overview');
        rt.addTab('How to use', 'content', STARTER.how);
        rt.addTab('FAQs', 'content', STARTER.faq);
        rt.addTab('Methodology', 'content', STARTER.method);
        rt.state.layout.ribbon.brand = title;
        rt.refresh(); rt.showTab(rt.tabs()[0].id);
        MS.decorate(); MS.history.clear(); MS.emit('structure');
      }
      MS.toast('New dashboard ready. Use Insert to add content, or Help › Start here for a walkthrough.', 'ok', 7000);
    } });
    return MS.openHtml(blankHtml(title), (title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'dashboard') + '.html', opts);
  };
  Cp.newDoc = function () {
    var f = MS.form([
      { key: 'title', label: 'Dashboard name', value: 'New dashboard' },
      { key: 'kind', label: 'Start with', type: 'select', value: 'tabs', options: [{ value: 'tabs', label: 'Tabs: Overview, How to use, FAQs, Methodology' }, { value: 'blank', label: 'One blank page' }] }
    ]);
    return MS.dialog({ title: 'New dashboard', body: f, buttons: [{ label: 'Cancel', value: null }, { label: 'Create', primary: true, value: function () { return f.values(); } }] }).then(function (v) {
      return v ? Cp.createDoc(v.title, v.kind === 'tabs') : false;
    });
  };
})(window.MS);
