/* Consistency across charts: one category order (A, B, C, D) everywhere, shared category colours,
   a format painter, drill-down data from a file, chart images and chart data downloads. */
(function (MS) {
  'use strict';
  var h = MS.h;
  function rt() { return MS.rt(); }
  function low(x) { return String(x == null ? '' : x).trim().toLowerCase(); }
  function keyOrSel(key) { return key || MS.charts.requireKey(); }

  /* ================================================================ category order */
  var O = MS.order = {};
  // charts grouped by the categories they show (case-insensitive)
  O.groups = function () {
    var r = rt(), g = {};
    r.charts().forEach(function (c) {
      var d = r.chartData(c.key); if (!d || d.labels.length < 2 || d.labels.length > 60) return;
      var sig = d.labels.map(low).slice().sort().join('\u0001');
      (g[sig] = g[sig] || { labels: d.labels, charts: [] }).charts.push(c.key);
    });
    return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.charts.length - a.charts.length; });
  };
  O.current = function (labels) { var idx = rt().orderLabels(labels); return idx ? idx.map(function (j) { return labels[j]; }) : labels.slice(); };
  // Save an order; it replaces any saved order that shares categories with it.
  O.set = function (order, label) {
    var lo = order.map(low);
    MS.history.state(label || 'Category order', function (s) {
      s.layout.orders = (s.layout.orders || []).filter(function (o) { return !o.some(function (x) { return lo.indexOf(low(x)) >= 0; }); });
      if (order.length > 1) s.layout.orders.push(order.slice());
    });
  };
  O.remove = function (labels) { O.set([], 'Remove category order'); var lo = labels.map(low); MS.history.state('Remove category order', function (s) { s.layout.orders = s.layout.orders.filter(function (o) { return !o.some(function (x) { return lo.indexOf(low(x)) >= 0; }); }); }); };
  O.fromChart = function (key) {
    key = keyOrSel(key); if (!key) return;
    var info = rt().chartInfo(key), labels = (info.labels || []).map(String);
    if (labels.length < 2) return MS.toast('This chart has fewer than two categories.', 'warn');
    O.set(labels, 'Use this order everywhere');
    var n = O.groups().filter(function (g) { return g.labels.some(function (l) { return labels.map(low).indexOf(low(l)) >= 0; }); }).reduce(function (a, g) { return a + g.charts.length; }, 0);
    MS.toast('Order ' + labels.slice(0, 5).join(', ') + (labels.length > 5 ? '…' : '') + ' now applies to ' + n + ' chart(s).', 'ok', 6000);
  };
  O.dialog = function (presetKey) {
    var r = rt(); if (!r) return;
    var groups = O.groups();
    if (!groups.length) return MS.toast('No charts with categories found.', 'warn');
    var start = 0;
    if (presetKey) groups.forEach(function (g, i) { if (g.charts.indexOf(presetKey) >= 0) start = i; });
    var pick = h('select', { 'class': 'inp' }, groups.map(function (g, i) {
      return h('option', { value: i, text: g.labels.slice(0, 4).join(', ') + (g.labels.length > 4 ? '… (' + g.labels.length + ')' : '') + '  ·  ' + g.charts.length + ' chart(s)' });
    }));
    pick.value = String(start);
    var used = h('small', { 'class': 'hint' }), listEl = h('ol', { 'class': 'order-list' }), items = [];
    function draw() {
      listEl.innerHTML = '';
      items.forEach(function (l, i) {
        var mv = function (d) { var j = i + d; if (j < 0 || j >= items.length) return; items.splice(j, 0, items.splice(i, 1)[0]); draw(); };
        var li = h('li', { draggable: 'true' }, [h('span', { 'class': 'grip', text: '⠿' }), h('span', { 'class': 'grow', text: l }),
          h('button', { 'class': 'icon-btn', type: 'button', title: 'Move up', onclick: function () { mv(-1); } }, ['▲']),
          h('button', { 'class': 'icon-btn', type: 'button', title: 'Move down', onclick: function () { mv(1); } }, ['▼'])]);
        li.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', String(i)); });
        li.addEventListener('dragover', function (e) { e.preventDefault(); });
        li.addEventListener('drop', function (e) { e.preventDefault(); var from = +e.dataTransfer.getData('text/plain'); items.splice(i, 0, items.splice(from, 1)[0]); draw(); });
        listEl.appendChild(li);
      });
    }
    function load() {
      var g = groups[+pick.value];
      items = O.current(g.labels);
      used.textContent = 'Used by: ' + g.charts.map(function (k) { return MS.charts.nameOf(k); }).join(', ') + '. The order also applies to any chart that shows at least two of these categories.';
      draw();
    }
    pick.addEventListener('change', load); load();
    var body = h('div', {}, [h('label', { 'class': 'field' }, [h('span', { text: 'Categories' }), pick]), used, listEl,
      h('div', { 'class': 'row gap' }, [
        h('button', { 'class': 'btn sm', type: 'button', onclick: function () { items.sort(function (a, b) { return String(a).localeCompare(String(b), 'en-IN', { numeric: true }); }); draw(); } }, ['A → Z']),
        h('button', { 'class': 'btn sm', type: 'button', onclick: function () { items.reverse(); draw(); } }, ['Reverse'])]),
      h('small', { 'class': 'hint', text: 'Drag or use ▲ ▼. Charts with an explicit sort (largest first, etc.) keep their sort.' })]);
    MS.dialog({ title: 'Same category order on every chart', body: body, enterSubmits: false, buttons: [{ label: 'Remove this order', value: 'remove', danger: true }, { label: 'Cancel', value: null }, { label: 'Apply to all charts', primary: true, value: 'apply' }] }).then(function (v) {
      if (v === 'apply') { O.set(items); MS.toast('Category order applied.', 'ok'); }
      if (v === 'remove') { O.remove(items); MS.toast('Charts are back to their own order.', 'ok'); }
    });
  };

  /* ================================================================ category colours */
  var Co = MS.catColors = {};
  Co.set = function (map, label, replace) {
    MS.history.state(label || 'Category colours', function (s) {
      var m = replace ? {} : Object.assign({}, s.layout.colors);
      Object.keys(map).forEach(function (k) { if (map[k]) m[k] = map[k]; else delete m[k]; });
      s.layout.colors = m;
    });
  };
  Co.dialog = function () {
    var r = rt(); if (!r) return;
    var names = [], seen = {}, now = {};
    r.charts().forEach(function (c) {
      var info = r.chartInfo(c.key) || {}, cols = r.chartColors(c.key);
      (info.labels || []).concat(info.series || []).forEach(function (l) { l = String(l); if (!l || seen[low(l)]) return; seen[low(l)] = 1; names.push(l); now[l] = cols[l]; });
    });
    names = names.slice(0, 120);
    var map = r.state.layout.colors || {}, rows = [];
    var grid = h('div', { 'class': 'cat-grid' }, names.map(function (n) {
      var set = r.lookColor(n), c = h('input', { type: 'color', value: toHex(set || now[n] || '#999999') });
      var on = h('input', { type: 'checkbox', checked: !!set, title: 'Use this colour on every chart' });
      c.addEventListener('input', function () { on.checked = true; });
      rows.push({ n: n, c: c, on: on });
      return h('label', { 'class': 'cat-row' }, [on, c, h('span', { text: n })]);
    }));
    MS.dialog({ title: 'Category colours (every chart)', wide: true, enterSubmits: false, body: h('div', {}, [h('p', { 'class': 'muted', text: 'Tick a category or series and pick its colour. Every chart that shows it uses that colour, so "North" is the same blue everywhere.' }), grid]),
      buttons: [{ label: 'Clear all', value: 'clear', danger: true }, { label: 'Cancel', value: null }, { label: 'Apply', primary: true, value: 'ok' }] }).then(function (v) {
      if (v === 'clear') return Co.set({}, 'Clear category colours', true);
      if (!v) return;
      var m = {}; rows.forEach(function (x) { m[x.n] = x.on.checked ? x.c.value : ''; });
      Object.keys(map).forEach(function (k) { if (!(k in m)) m[k] = map[k]; });
      Co.set(m, 'Category colours', true);
    });
  };
  function toHex(c) { var rgb = MS.brand.hexToRgb(c); return rgb ? MS.brand.toHex(rgb) : '#999999'; }

  /* ================================================================ format painter */
  var P = MS.painter = { copied: null, painting: false };
  P.copy = function (key) {
    key = keyOrSel(key); if (!key) return;
    var r = rt(), cs = r.state.charts[key] || {}, info = r.chartInfo(key) || {};
    P.copied = { from: key, name: MS.charts.nameOf(key), style: cs.style ? JSON.parse(JSON.stringify(cs.style)) : null, tooltip: cs.tooltip || null, colors: r.chartColors(key), order: (info.labels || []).map(String) };
    P.paste();
  };
  P.targets = function (mode) {
    var r = rt(), src = P.copied, lo = src.order.map(low);
    return r.charts().filter(function (c) {
      if (c.key === src.from) return false;
      if (mode === 'all') return true;
      var info = r.chartInfo(c.key) || {}, L = (info.labels || []).map(low);
      return L.filter(function (x) { return lo.indexOf(x) >= 0; }).length >= Math.min(2, L.length);
    }).map(function (c) { return c.key; });
  };
  P.apply = function (keys, what) {
    var src = P.copied; if (!src) return;
    MS.history.group('Format painter', function () {
      if (what.look || what.tooltip) MS.history.state('Paste look', function (s) {
        keys.forEach(function (k) { var cs = s.charts[k] = s.charts[k] || {}; if (what.look) { if (src.style) cs.style = JSON.parse(JSON.stringify(src.style)); else delete cs.style; } if (what.tooltip) { if (src.tooltip) cs.tooltip = src.tooltip; else delete cs.tooltip; } });
      });
      if (what.colors && Object.keys(src.colors).length) Co.set(src.colors, 'Paste colours');
      if (what.order && src.order.length > 1) MS.order.set(src.order, 'Paste order');
    });
  };
  P.paste = function () {
    var src = P.copied; if (!src) return MS.toast('Copy a chart\'s look first.', 'warn');
    var same = P.targets('same'), all = P.targets('all');
    var f = MS.form([
      { key: 'look', label: 'Fonts, legend and pop-up style', type: 'checkbox', value: !!src.style },
      { key: 'colors', label: 'Colours of its categories (' + Object.keys(src.colors).slice(0, 4).join(', ') + (Object.keys(src.colors).length > 4 ? '…' : '') + ')', type: 'checkbox', value: Object.keys(src.colors).length > 0 },
      { key: 'order', label: 'Order of its categories', type: 'checkbox', value: false },
      { key: 'tooltip', label: 'Pop-up text template', type: 'checkbox', value: false },
      { key: 'to', label: 'Paste onto', type: 'select', value: 'same', options: [{ value: 'same', label: 'Charts with the same categories (' + same.length + ')' }, { value: 'all', label: 'Every chart (' + all.length + ')' }, { value: 'click', label: 'Let me click the charts, one by one' }] }
    ]);
    MS.dialog({ title: '🖌 Format painter: copy from “' + src.name + '”', body: h('div', {}, [f, h('small', { 'class': 'hint', text: 'Colours and order are shared: every chart that shows the same categories picks them up, now and later.' })]),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Paste', primary: true, value: function () { return f.values(); } }] }).then(function (v) {
      if (!v) return;
      if (v.to === 'click') { P.what = v; P.painting = true; document.body.classList.add('painting'); return MS.toast('🖌 Click the charts to paint. Press Esc when done.', '', 6000); }
      var keys = v.to === 'all' ? all : same;
      P.apply(keys, v);
      MS.toast('Painted ' + (keys.length || 'shared colours/order onto') + (keys.length ? ' chart(s).' : ' charts.'), 'ok');
    });
  };
  P.stop = function () { P.painting = false; document.body.classList.remove('painting'); };
  MS.on('child-loaded', function (c) {
    P.stop();
    c.win.addEventListener('click', function (e) {
      if (!P.painting) return;
      var r = rt(), ch = r && r.chartOf(e.target); if (!ch) return;
      e.preventDefault(); e.stopImmediatePropagation();
      P.apply([ch.key], P.what);
      MS.toast('Painted “' + MS.charts.nameOf(ch.key) + '”. Click another, or Esc to stop.', 'ok', 2500);
    }, true);
    c.doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && P.painting) P.stop(); }, true);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && P.painting) P.stop(); }, true);

  /* ================================================================ chart image + data */
  var X = MS.chartOut = {};
  X.image = function (key) {
    key = keyOrSel(key); if (!key) return;
    rt().chartImage(key).then(function (url) {
      return fetch(url).then(function (r) { return r.blob(); }).then(function (b) { MS.download(MS.charts.nameOf(key).replace(/[^\w\- ]+/g, '').trim() + '.png', b); MS.toast('Chart saved as an image. Paste it into PowerPoint, Word or an email.', 'ok'); });
    }).catch(function (e) { MS.toast('Could not make an image: ' + e.message, 'error'); });
  };
  function csv(rows) {
    if (!rows.length) return '';
    var cols = Object.keys(rows[0]), q = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '﻿' + [cols.map(q).join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return q(r[c]); }).join(','); })).join('\r\n');
  }
  X.csv = csv;
  X.data = function (key) {
    key = keyOrSel(key); if (!key) return;
    var r = rt(), d = r.chartData(key), info = r.chartInfo(key);
    var labels = info.labels || [], c = r.chart(key);
    // what is drawn now (after drill-down / filters), one column per series
    var cur = c.a.info(c.inst), now = r.chartData(key);
    var rows = (cur.labels || labels).map(function (l, j) { var o = { Category: l }; (now.series || []).forEach(function (s) { o[s.name] = s.values[j]; }); return o; });
    if (c.inst.__msBound) { rows = []; var gm = r.groups[key] || {}; Object.keys(gm).forEach(function (l) { var g = gm[l]; var o = { Category: l, Value: g.value, Records: g.count }; rows.push(o); }); }
    MS.download(MS.charts.nameOf(key).replace(/[^\w\- ]+/g, '').trim() + '.csv', csv(rows), 'text/csv;charset=utf-8');
    MS.toast('Chart data saved as CSV (opens in Excel).', 'ok');
    return d;
  };
  // A CSV the user fills in with the deeper levels behind each bar, then loads back.
  X.template = function (key) {
    key = keyOrSel(key); if (!key) return;
    var d = rt().chartData(key), rows = [];
    d.labels.forEach(function (l, j) { rows.push({ Category: l, 'Level 2': '', 'Level 3': '', Value: d.series[0] ? d.series[0].values[j] : '' }); });
    MS.download(MS.charts.nameOf(key).replace(/[^\w\- ]+/g, '').trim() + ' - drill-down template.csv', csv(rows), 'text/csv;charset=utf-8');
    MS.toast('Template saved. Rename the columns (e.g. Region, State, City), add one row per lowest-level item, then use Data › Drill-down data to load it.', 'ok', 9000);
  };

  /* ================================================================ drill-down data from a file */
  var Dd = MS.drillData = {};
  // -> Promise<[{name, rows}]>
  Dd.read = function (file) {
    var ext = MS.ext(file.name), base = file.name.replace(/\.[^.]+$/, '');
    if (ext === 'json') return MS.readFile(file).then(function (t) { var j = JSON.parse(t); return Array.isArray(j) ? [{ name: base, rows: j }] : Object.keys(j).filter(function (k) { return Array.isArray(j[k]); }).map(function (k) { return { name: k, rows: j[k] }; }); });
    if (ext === 'md' || ext === 'markdown' || ext === 'txt') return Promise.all([MS.lib('marked'), MS.readFile(file)]).then(function (r) { return Dd.fromMarkdown(r[0], r[1], base); });
    return MS.importers.convert(file).then(function (res) { return (res.datasets || []).map(function (d) { return { name: d.name.indexOf(' – ') > 0 ? d.name.split(' – ').pop() : d.name, rows: d.rows }; }); });
  };
  // Every Markdown table becomes a table; the heading above it names it (and the chart it is for).
  Dd.fromMarkdown = function (marked, text, base) {
    var toks = marked.lexer(text), heading = base, out = [];
    var cell = function (c) { var t = typeof c === 'object' ? c.text : c; t = String(t == null ? '' : t).replace(/\*\*|__|`/g, '').trim(); var n = Number(t.replace(/[₹,\s]/g, '').replace(/(cr|crore|l|lakh)$/i, '')); return t !== '' && !isNaN(n) && /^[-₹\d.,\s]+$/.test(t) ? n : t; };
    toks.forEach(function (t) {
      if (t.type === 'heading') heading = t.text;
      if (t.type === 'table') {
        var head = t.header.map(function (x) { return String(typeof x === 'object' ? x.text : x).trim(); });
        out.push({ name: heading, rows: t.rows.map(function (r) { var o = {}; head.forEach(function (k, i) { o[k] = cell(r[i]); }); return o; }) });
      }
    });
    return out;
  };
  // Which chart a table belongs to, and its drill path.
  Dd.plan = function (table) {
    var r = rt(), rows = table.rows; if (!rows.length) return null;
    var cols = Object.keys(rows[0]);
    var isNum = function (c) { var n = 0, k = 0; rows.slice(0, 200).forEach(function (x) { if (x[c] === '' || x[c] == null) return; k++; if (typeof x[c] === 'number' || !isNaN(Number(x[c]))) n++; }); return k > 0 && n / k > 0.9; };
    var cats = cols.filter(function (c) { return !isNum(c); }), nums = cols.filter(isNum);
    var best = null;
    r.charts().forEach(function (c) {
      var name = low(MS.charts.nameOf(c.key)), tn = low(table.name), d = r.chartData(c.key); if (!d) return;
      var want = d.labels.map(low);
      cats.forEach(function (f, fi) {
        var vals = new Set(rows.map(function (x) { return low(x[f]); }));
        var hit = want.filter(function (w) { return vals.has(w); }).length / (want.length || 1);
        var score = hit + (name && tn && (name === tn || name.indexOf(tn) >= 0 || tn.indexOf(name) >= 0) ? 1 : 0);
        if (hit > 0.3 && (!best || score > best.score)) best = { key: c.key, field: f, fi: fi, score: score };
      });
    });
    return { cats: cats, nums: nums, key: best && best.key, levels: best ? cats.slice(best.fi) : cats, measure: nums[nums.length - 1] };
  };
  Dd.load = function () {
    MS.pickFiles('.xlsx,.xls,.csv,.tsv,.md,.markdown,.json', { multiple: true }).then(function (fs) {
      if (!fs.length) return;
      MS.busy(true);
      Promise.all(fs.map(Dd.read)).then(function (all) {
        MS.busy(false);
        var tables = [].concat.apply([], all).filter(function (t) { return t.rows && t.rows.length; });
        if (!tables.length) return MS.toast('No tables found. Excel/CSV need a header row; Markdown needs | pipe | tables |.', 'warn', 7000);
        Dd.review(tables);
      }).catch(function (e) { MS.busy(false); MS.toast('Could not read the file: ' + e.message, 'error'); });
    });
  };
  Dd.review = function (tables) {
    var r = rt(), charts = r.charts();
    var rows = tables.map(function (t) {
      var p = Dd.plan(t) || { cats: [], nums: [], levels: [] };
      var chartSel = h('select', { 'class': 'inp' }, [h('option', { value: '', text: '— just add it as data —' })].concat(charts.map(function (c) { var o = h('option', { value: c.key, text: MS.charts.nameOf(c.key) }); if (c.key === p.key) o.selected = true; return o; })));
      var lv = h('input', { 'class': 'inp', value: p.levels.join(' › '), title: 'Drill path, top level first. Separate with ›' });
      var ms = h('select', { 'class': 'inp' }, p.nums.map(function (n) { var o = h('option', { value: n, text: n }); if (n === p.measure) o.selected = true; return o; }).concat([h('option', { value: '', text: 'Count rows' })]));
      return { t: t, chart: chartSel, levels: lv, measure: ms, el: h('div', { 'class': 'dd-row' }, [h('strong', { text: t.name + ' · ' + t.rows.length + ' rows' }), h('div', { 'class': 'row gap' }, [h('label', { 'class': 'field grow' }, [h('span', { text: 'For chart' }), chartSel]), h('label', { 'class': 'field' }, [h('span', { text: 'Value' }), ms])]), h('label', { 'class': 'field' }, [h('span', { text: 'Drill path (double-click goes down this list)' }), lv])]) };
    });
    MS.dialog({ title: 'Drill-down data', wide: true, enterSubmits: false, body: h('div', {}, [h('p', { 'class': 'muted', text: 'The data is embedded in the dashboard, so double-click drill-down works offline and in the exported file.' })].concat(rows.map(function (x) { return x.el; }))),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Embed and link', primary: true, value: 'ok' }] }).then(function (v) {
      if (!v) return;
      var linked = 0;
      MS.history.group('Drill-down data', function () {
        rows.forEach(function (x) {
          var name = MS.data.addDataset(x.t.name, x.t.rows, true); if (!name || !x.chart.value) return;
          var levels = x.levels.value.split(/\s*[›>,]\s*/).filter(Boolean);
          MS.history.state('Link drill-down', function (s) {
            var cs = s.charts[x.chart.value] = s.charts[x.chart.value] || {};
            cs.binding = { dataset: name, levels: levels, measure: x.measure.value || undefined, agg: x.measure.value ? 'sum' : 'count' };
            cs.drill = { mode: 'levels' };
          });
          linked++;
        });
      });
      MS.toast(tables.length + ' table(s) embedded' + (linked ? ', ' + linked + ' chart(s) linked. Switch to Interact and double-click a bar to drill down.' : '.'), 'ok', 8000);
    });
  };
})(window.MS);
