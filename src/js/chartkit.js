/* Chart tools people reach for most: resize any chart (drag the corner handle or type a size),
   give one chart its own data (upload CSV / Excel, paste from Excel or type the numbers), and add,
   move or remove its legend. */
(function (MS) {
  'use strict';
  var K = MS.chartKit = {};
  var h = MS.h;
  function rt() { return MS.rt(); }
  function cdoc() { return MS.child && MS.child.doc; }

  /* ================================================================ SIZE */
  // How a selected part is sized: which element takes the height, and which one the width
  // (a column span when it sits in a grid, a percentage otherwise).
  K.sizing = function (el) {
    var r = rt(), w = MS.child.win, u = MS.clipboard.unitOf(el) || el;
    var block = u.classList.contains('ms-block') ? u : null, c = r ? r.chartOf(block ? (block.querySelector('.ms-visual') || block) : u) : null;
    if (c && !block && !(u === c.el || u.contains(c.el) || c.el.contains(u))) c = null;
    var o = { unit: u, block: block, chart: c };
    if (block && !block.classList.contains('ms-content-block')) { o.hbox = block.querySelector(':scope > .ms-visual'); o.hmode = 'var'; }
    else if (c) {
      var bx = c.el.closest('[data-ms-copyof],[data-ms-chart]') || (c.el.tagName === 'CANVAS' ? c.el.parentElement : c.el);
      o.hbox = bx; o.hmode = 'height';
      o.wrapCanvas = c.el.tagName === 'CANVAS' && bx === c.el.parentElement && Array.prototype.some.call(bx.children, function (k) { return k !== c.el && !k.hasAttribute('data-ms-editor') && !k.classList.contains('ms-grip') && !k.classList.contains('ms-drag'); });
    } else if (u.tagName === 'IMG') { o.hbox = u; o.hmode = 'img'; }
    else { o.hbox = u; o.hmode = 'min'; }
    o.height = Math.round(o.hbox.getBoundingClientRect().height);
    // width: the nearest of this part or its parents (up to 3) that sits in a grid
    var cell = block || u, n = cell;
    o.cell = cell; o.mode = 'pct';
    for (var i = 0; i < 4 && n && n.parentElement && !/^(BODY|HTML)$/.test(n.parentElement.tagName); i++, n = n.parentElement) {
      if (/grid/.test(w.getComputedStyle(n.parentElement).display)) { o.cell = n; o.mode = 'span'; break; }
      if (n.parentElement.children.length > 1 && i > 0) break;
    }
    if (o.mode === 'span') {
      var g = o.cell.parentElement, cols = g.classList.contains('ms-grid') ? 12 : w.getComputedStyle(g).gridTemplateColumns.split(/\s+(?![^(]*\))/).filter(Boolean).length;
      o.cols = Math.max(1, cols);
      var m = /span\s+(\d+)/.exec(o.cell.style.gridColumn || w.getComputedStyle(o.cell).gridColumnStart + ' ' + w.getComputedStyle(o.cell).gridColumnEnd);
      o.span = m ? Math.min(o.cols, +m[1]) : (g.classList.contains('ms-grid') ? 6 : 1);
    } else {
      var pw = o.cell.parentElement ? o.cell.parentElement.getBoundingClientRect().width : 0;
      o.pct = pw ? Math.round(o.cell.getBoundingClientRect().width / pw * 100) : 100;
      if (o.hmode === 'img') o.px = Math.round(u.getBoundingClientRect().width);
    }
    return o;
  };

  function attrsOf(el) { return el ? { style: el.getAttribute('style'), fill: el.getAttribute('data-ms-fill') } : null; }
  function putAttrs(el, a) { if (!el || !a) return; if (a.style == null) el.removeAttribute('style'); else el.setAttribute('style', a.style); if (a.fill == null) el.removeAttribute('data-ms-fill'); else el.setAttribute('data-ms-fill', a.fill); }
  function redraw(o) {
    var r = rt(); if (!r) return;
    r.charts().forEach(function (c) {
      if (!(o.cell.contains(c.el) || o.hbox.contains(c.el))) return;
      if (o.hbox.hasAttribute('data-ms-fill') && !c.inst.__msFill) { c.inst.__msFill = true; try { c.a.fill(c.inst); } catch (e) {} }
      try { c.a.resize(c.inst); } catch (e) {}
    });
  }
  // A canvas that shares its box with a legend or text gets a box of its own, so its height can change.
  function boxCanvas(o) {
    if (!o.wrapCanvas) return;
    var cv = o.chart.el, wr = cdoc().createElement('div');
    wr.setAttribute('data-ms-own', ''); wr.style.cssText = 'position:relative;width:100%;height:' + Math.round(cv.getBoundingClientRect().height) + 'px';
    MS.history.move('Chart box', wr, function () { cv.parentNode.insertBefore(wr, cv); });
    MS.history.move('Chart box', cv, function () { wr.appendChild(cv); });
    o.hbox = wr; o.wrapCanvas = false;
  }
  // v: {span, pct, px, height}
  K.setSize = function (el, v) {
    var o = K.sizing(el);
    if (MS.edit.isGenerated(o.unit)) MS.toast('This part is drawn by the dashboard\'s script, so its size may reset when the page reloads.', 'warn', 6000);
    MS.history.group('Resize', function () {
      boxCanvas(o);
      if (v.height) MS.history.attrs('Height', o.hbox, ['style', 'data-ms-fill'], function (x) {
        if (o.hmode === 'var') { x.style.setProperty('--ms-h', v.height + 'px'); if (o.block.classList.contains('ms-inline')) x.style.height = 'var(--ms-h)'; }
        else if (o.hmode === 'height') { x.style.height = v.height + 'px'; x.setAttribute('data-ms-fill', ''); }
        else if (o.hmode === 'img') { x.style.height = 'auto'; }
        else x.style.minHeight = v.height + 'px';
      });
      if (v.span && o.mode === 'span') MS.history.attrs('Width', o.cell, ['style'], function (x) { x.style.gridColumn = 'span ' + Math.max(1, Math.min(o.cols, v.span)); });
      if (o.hmode === 'img' && v.px) MS.history.attrs('Width', o.unit, ['style'], function (x) { x.style.width = v.px + 'px'; x.style.maxWidth = '100%'; x.style.height = 'auto'; });
      else if (v.pct && o.mode === 'pct') MS.history.attrs('Width', o.cell, ['style'], function (x) { x.style.width = v.pct >= 100 ? '' : v.pct + '%'; if (!x.getAttribute('style')) x.removeAttribute('style'); });
    });
    redraw(K.sizing(el));
    MS.afterDomChange(o.unit);
    MS.emit('selection', MS.sel);
  };

  var HEIGHTS = [['S', 220], ['M', 300], ['L', 420], ['XL', 560]];
  // The Size fields, used in the Format panel and in the Size dialog. onApply(v) is called on change.
  K.sizeFields = function (el, onApply) {
    var o = K.sizing(el), wrap = h('div', { 'class': 'size-ed' }), widthIn, heightIn;
    if (o.mode === 'span') {
      var opts = []; for (var i = 1; i <= o.cols; i++) opts.push(h('option', { value: i, text: o.cols === 12 ? i + ' of 12' + ({ 3: ' (quarter)', 4: ' (third)', 6: ' (half)', 8: ' (two thirds)', 12: ' (full width)' }[i] || '') : i + ' of ' + o.cols + ' column' + (o.cols > 1 ? 's' : '') + (i === o.cols && o.cols > 1 ? ' (full row)' : '') }));
      widthIn = h('select', { 'class': 'inp' }, opts); widthIn.value = String(o.span);
    } else if (o.hmode === 'img') widthIn = h('input', { 'class': 'inp', type: 'number', min: 20, step: 10, value: o.px });
    else { widthIn = h('select', { 'class': 'inp' }, [25, 33, 50, 66, 75, 100].map(function (p) { return h('option', { value: p, text: p === 100 ? 'Full width' : p + '%' }); })); widthIn.value = String([25, 33, 50, 66, 75, 100].reduce(function (b, p) { return Math.abs(p - o.pct) < Math.abs(b - o.pct) ? p : b; }, 100)); }
    heightIn = h('input', { 'class': 'inp', type: 'number', min: 60, step: 10, value: o.height, disabled: o.hmode === 'img' });
    var fire = function (extra) { var v = { height: +heightIn.value || null }; if (o.mode === 'span') v.span = +widthIn.value; else if (o.hmode === 'img') v.px = +widthIn.value; else v.pct = +widthIn.value; onApply(Object.assign(v, extra || {})); };
    widthIn.addEventListener('change', function () { fire(); }); heightIn.addEventListener('change', function () { fire(); });
    wrap.appendChild(h('div', { 'class': 'row gap' }, [
      h('label', { 'class': 'field grow' }, [h('span', { text: o.hmode === 'img' ? 'Width (px)' : 'Width' }), widthIn]),
      h('label', { 'class': 'field', style: { width: '96px' } }, [h('span', { text: o.hmode === 'min' ? 'Min height' : 'Height (px)' }), heightIn])]));
    if (o.hmode !== 'img') wrap.appendChild(h('div', { 'class': 'chips' }, HEIGHTS.map(function (p) {
      return h('button', { 'class': 'chip' + (Math.abs(o.height - p[1]) < 12 ? ' on' : ''), type: 'button', title: p[1] + ' px high', onclick: function () { heightIn.value = p[1]; fire(); } }, [p[0]]);
    }).concat(o.mode === 'span' ? [h('button', { 'class': 'chip', type: 'button', title: 'Use the whole row', onclick: function () { widthIn.value = String(o.cols); fire(); } }, ['Full width'])] : [])));
    wrap.values = function () { var v = { height: +heightIn.value || null }; if (o.mode === 'span') v.span = +widthIn.value; else if (o.hmode === 'img') v.px = +widthIn.value; else v.pct = +widthIn.value; return v; };
    return wrap;
  };
  K.sizeDialog = function (el) {
    el = el || MS.sel; if (!el) return MS.toast('Select a chart or a card first.', 'warn');
    var f = K.sizeFields(el, function () {});
    MS.dialog({ title: '⤢ Size', sub: 'Or drag the round handle at the bottom-right corner of a selected chart.', body: f, buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', primary: true, value: function () { return f.values(); } }] }).then(function (v) { if (v) K.setSize(el, v); });
  };

  /* ---------- the drag handle on a selected chart or picture (blocks have their own grip) */
  var handle = null;
  function handleTarget() {
    var el = MS.sel; if (!el || MS.mode !== 'edit' || !el.isConnected || !rt()) return null;
    if (el.classList.contains('ms-block') || MS.blocks.of(el)) return null;
    if (el.tagName === 'IMG') return el;
    var c = rt().chartOf(el); return c && (el === c.el || el.contains(c.el) || c.el.contains(el)) ? el : null;
  }
  function placeHandle() {
    var d = cdoc(); if (!d) return;
    var t = handleTarget();
    if (!t) { if (handle) handle.style.display = 'none'; return; }
    if (!handle || handle.ownerDocument !== d || !handle.isConnected) {
      handle = d.createElement('div'); handle.className = 'ms-size-handle'; handle.setAttribute('data-ms-editor', '');
      handle.title = 'Drag to resize (width snaps to the columns)';
      handle.style.cssText = 'position:fixed;width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid #6366f1;box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:nwse-resize;z-index:2147483000;display:none;transform:translate(-50%,-50%)';
      d.body.appendChild(handle);
      handle.addEventListener('mousedown', startDrag, true);
    }
    var o = K.sizing(t), r = (o.hmode === 'img' ? o.unit : o.hbox).getBoundingClientRect(), cr = o.cell.getBoundingClientRect();
    handle.style.left = Math.round(o.hmode === 'img' ? r.right : Math.min(cr.right, Math.max(r.right, cr.right))) + 'px';
    handle.style.top = Math.round(r.bottom) + 'px';
    handle.style.display = r.width ? 'block' : 'none';
  }
  K.placeHandle = placeHandle;
  function startDrag(e) {
    e.preventDefault(); e.stopPropagation();
    var d = cdoc(), w = MS.child.win, t = handleTarget(); if (!t) return;
    var o = K.sizing(t);
    MS.history.group('Resize', function () { boxCanvas(o); });
    var before = { h: attrsOf(o.hbox), c: attrsOf(o.cell), u: attrsOf(o.unit) };
    var g = o.cell.parentElement, gr = g.getBoundingClientRect(), gap = parseFloat(w.getComputedStyle(g).columnGap) || 0, colW = o.mode === 'span' ? (gr.width - (o.cols - 1) * gap) / o.cols : 0;
    var mv = function (ev) {
      var hr = o.hbox.getBoundingClientRect(), cr = o.cell.getBoundingClientRect(), msg;
      if (o.hmode === 'img') { o.unit.style.width = Math.max(20, Math.round(ev.clientX - hr.left)) + 'px'; o.unit.style.height = 'auto'; o.unit.style.maxWidth = '100%'; msg = 'Width: ' + o.unit.style.width; }
      else {
        var hh = Math.max(80, Math.round(ev.clientY - hr.top));
        if (o.hmode === 'var') o.hbox.style.setProperty('--ms-h', hh + 'px'); else if (o.hmode === 'height') { o.hbox.style.height = hh + 'px'; o.hbox.setAttribute('data-ms-fill', ''); } else o.hbox.style.minHeight = hh + 'px';
        if (o.mode === 'span') { var sp = Math.max(1, Math.min(o.cols, Math.round((ev.clientX - cr.left + gap) / (colW + gap)))); o.cell.style.gridColumn = 'span ' + sp; msg = 'Width: ' + sp + ' of ' + o.cols + ' · Height: ' + hh + ' px'; }
        else { var pw = o.cell.parentElement.getBoundingClientRect().width, pc = Math.max(15, Math.min(100, Math.round((ev.clientX - cr.left) / pw * 100))); o.cell.style.width = pc >= 98 ? '' : pc + '%'; msg = 'Width: ' + pc + '% · Height: ' + hh + ' px'; }
      }
      redraw(o); placeHandle();
      MS.status(msg);
    };
    var up = function () {
      d.removeEventListener('mousemove', mv, true); d.removeEventListener('mouseup', up, true);
      var after = { h: attrsOf(o.hbox), c: attrsOf(o.cell), u: attrsOf(o.unit) };
      var put = function (x) { putAttrs(o.hbox, x.h); if (o.cell !== o.hbox) putAttrs(o.cell, x.c); if (o.unit !== o.hbox && o.unit !== o.cell) putAttrs(o.unit, x.u); redraw(o); MS.afterDomChange(o.unit); setTimeout(placeHandle, 50); };
      MS.history.push({ label: 'Resize', undo: function () { put(before); }, redo: function () { put(after); } }, true);
      MS.afterDomChange(o.unit); MS.emit('selection', MS.sel);
    };
    d.addEventListener('mousemove', mv, true); d.addEventListener('mouseup', up, true);
  }
  MS.on('selection', function () { setTimeout(placeHandle, 0); });
  MS.on('mode', placeHandle); MS.on('changed', function () { setTimeout(placeHandle, 60); }); MS.on('history', function () { setTimeout(placeHandle, 60); });
  MS.on('child-loaded', function (c) {
    handle = null;
    c.doc.addEventListener('scroll', placeHandle, true);
    c.win.addEventListener('resize', placeHandle);
  });

  /* ================================================================ LEGEND */
  // The page's own HTML legend for a chart (the box that holds its legend items), if it has one.
  K.pageLegend = function (key) {
    var r = rt(), c = r && r.chart(key); if (!c || !r.legendItems) return null;
    var its = r.legendItems(c); if (its.length < 2) return null;
    var box = its[0].item;
    while (box && !its.every(function (it) { return box.contains(it.item); })) box = box.parentElement;
    return box && !box.contains(c.el) ? box : null;
  };
  K.legendOf = function (key) {
    var r = rt(), cs = r && r.state.charts[key] || {}, pl = K.pageLegend(key);
    return { chart: (cs.style && cs.style.legend) || '', page: pl ? (pl.style.display === 'none' ? 'hidden' : 'shown') : null };
  };
  // pos: top | bottom | left | right | none | '' (as the dashboard had it). One legend at a time:
  // showing the chart's own legend hides the page's hand-made one, and "as designed" brings it back.
  K.setLegend = function (key, pos) {
    var r = rt(), c = r && r.chart(key); if (!c) return;
    if (!c.a.setStyle || c.a.basic) return MS.toast('This chart is drawn by the page\'s own script, so its legend can\'t be moved here. You can select the legend and delete or restyle it.', 'warn', 7000);
    var pl = K.pageLegend(key);
    MS.history.group('Legend', function () {
      MS.charts.setStyle(key, { legend: pos || '' }, 'Legend');
      if (pl) MS.history.attrs('Page legend', pl, ['style'], function (x) { x.style.display = pos === '' ? '' : 'none'; if (!x.getAttribute('style')) x.removeAttribute('style'); });
    });
    MS.toast({ top: 'Legend at the top.', bottom: 'Legend at the bottom.', left: 'Legend on the left.', right: 'Legend on the right.', none: 'Legend hidden.', '': 'Legend as the dashboard had it.' }[pos || ''], 'ok', 2500);
    MS.emit('selection', MS.sel);
  };
  K.legendItems = function (key) {
    var cur = K.legendOf(key).chart;
    var it = function (pos, label, icon) { return { label: label, icon: icon, on: cur === pos, run: function () { K.setLegend(key, pos); } }; };
    return [it('top', 'Show at the top', '⬒'), it('bottom', 'Show at the bottom', '▁'), it('left', 'Show on the left', '◧'), it('right', 'Show on the right', '◨'), '-', it('none', 'Hide the legend', '👁'), it('', 'As the dashboard had it', '↻')];
  };
  // A small segmented control for the Format panel.
  K.legendControl = function (key) {
    var cur = K.legendOf(key).chart, sel = h('select', { 'class': 'inp' }, [['', 'As designed'], ['top', 'Top'], ['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['none', 'Hidden']].map(function (p) { return h('option', { value: p[0], text: p[1] }); }));
    sel.value = cur; sel.addEventListener('change', function () { K.setLegend(key, sel.value); });
    return sel;
  };

  /* ================================================================ ONE CHART'S DATA */
  function num(v) { if (typeof v === 'number') return v; var s = String(v == null ? '' : v).replace(/[$₹€£,\s%]/g, '').replace(/^\((.*)\)$/, '-$1'); if (s === '' || s === '-') return null; var n = Number(s); return isNaN(n) ? null : n; }
  K.num = num;
  // Rows from a file or a pasted range → {labels, series:[{name, values}]}. Works with a wide table
  // (Category | 2024 | 2025) and a long one (Category | Series | Value).
  K.tableFromRows = function (rows) {
    if (!rows || !rows.length) return null;
    var cols = Object.keys(rows[0]), isNum = {};
    cols.forEach(function (c) { var n = 0, t = 0; rows.slice(0, 200).forEach(function (r) { if (r[c] === '' || r[c] == null) return; t++; if (num(r[c]) !== null) n++; }); isNum[c] = t > 0 && n / t >= 0.8; });
    var text = cols.filter(function (c) { return !isNum[c]; }), nums = cols.filter(function (c) { return isNum[c]; });
    if (!nums.length) return null;
    var lab = text[0] || cols[0]; if (lab === nums[0]) nums = nums.slice(1);
    var labels = [], series;
    if (text.length >= 2 && nums.length === 1) {
      var sc = text[1], names = [], map = {};
      rows.forEach(function (r) { var l = String(r[lab]), s = String(r[sc]); if (labels.indexOf(l) < 0) labels.push(l); if (names.indexOf(s) < 0) names.push(s); map[l + '\u0001' + s] = (map[l + '\u0001' + s] || 0) + (num(r[nums[0]]) || 0); });
      series = names.map(function (s) { return { name: s, values: labels.map(function (l) { var v = map[l + '\u0001' + s]; return v == null ? null : v; }) }; });
    } else {
      rows.forEach(function (r) { labels.push(String(r[lab] == null ? '' : r[lab])); });
      series = nums.map(function (c) { return { name: c, values: rows.map(function (r) { return num(r[c]); }) }; });
    }
    return { labelName: lab, labels: labels, series: series };
  };
  K.rowsOf = function (t) {
    var rows = [];
    t.labels.forEach(function (l, j) { t.series.forEach(function (s) { rows.push({ Category: l, Series: s.name, Value: s.values[j] == null ? null : s.values[j] }); }); });
    return rows;
  };
  K.current = function (key) {
    var r = rt(), d = r.chartData(key, true);
    return d ? { labels: d.labels.slice(), series: d.series.map(function (s) { return { name: s.name, values: s.values.slice() }; }) } : { labels: [], series: [] };
  };
  // Give one chart its own numbers. t = {labels, series}. They are embedded as a dataset the chart is linked to.
  K.applyData = function (key, t, from) {
    var r = rt(), c = r.chart(key); if (!c) throw new Error('Chart not found.');
    if (c.a.basic) throw new Error('This chart is drawn by the page\'s own script (D3 or similar), so it can\'t be redrawn from new numbers. Rebuild it with Insert › Chart from the same data.');
    if (!t || !t.labels.length || !t.series.length) throw new Error('No numbers found. The first column needs the labels and the other columns the numbers.');
    var cs = r.state.charts[key] || {}, old = cs.binding && cs.binding.dataset, mine = old && r.state.datasets[old] && r.state.datasets[old].chart === key;
    var name = mine ? old : null, rows = K.rowsOf(t);
    MS.history.group('Chart data', function () {
      if (!name) { var base = MS.charts.nameOf(key) + ' data', nm = base, i = 2; while (r.state.datasets[nm]) nm = base + ' (' + (i++) + ')'; name = nm; }
      MS.history.state('Chart data', function (s) {
        s.datasets[name] = { rows: rows, source: 'file', file: from || undefined, chart: key, refreshed: new Date().toISOString() };
        var x = s.charts[key] = s.charts[key] || {};
        x.binding = { dataset: name, levels: ['Category'], measure: 'Value', agg: 'sum', series: 'Series', sort: 'source' };
        x.drill = x.drill || { mode: 'levels' };
      });
    });
    r.drill[key] = [];
    MS.emit('structure');
    return { dataset: name, labels: t.labels.length, series: t.series.map(function (s) { return s.name; }) };
  };
  // Back to the numbers the page's own script draws.
  K.resetData = function (key) {
    var r = rt(), cs = r.state.charts[key] || {}, ds = cs.binding && cs.binding.dataset, mine = ds && r.state.datasets[ds] && r.state.datasets[ds].chart === key;
    MS.history.state('Chart data', function (s) { var x = s.charts[key]; if (x) { delete x.binding; delete x.drill; } if (mine) delete s.datasets[ds]; });
    r.drill[key] = [];
    setTimeout(function () { var c = rt().chart(key), O = c && c.inst.__msOrig; if (c && O && c.lib === 'chartjs') { c.inst.data.labels = O.labels.slice(); c.inst.data.datasets.forEach(function (d, i) { if (O.datasets[i]) d.data = O.datasets[i].data.slice(); }); c.inst.update(); } }, 30);
    MS.emit('structure');
  };
  K.csv = function (t, labelName) {
    var q = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [[labelName || 'Category'].concat(t.series.map(function (s) { return s.name; })).map(q).join(',')].concat(t.labels.map(function (l, j) { return [l].concat(t.series.map(function (s) { return s.values[j]; })).map(q).join(','); })).join('\r\n') + '\r\n';
  };
  K.downloadCsv = function (key) { var t = K.current(key); MS.download(MS.charts.nameOf(key).replace(/[^\w\- ]+/g, '').trim() + ' data.csv', '﻿' + K.csv(t), 'text/csv;charset=utf-8'); };

  // The data editor: a small grid to type or paste numbers into, with upload and download.
  K.dataDialog = function (key) {
    key = key || MS.charts.requireKey(); if (!key) return;
    var r = rt(), c = r.chart(key); if (!c) return;
    if (c.a.basic) return MS.toast('This chart is drawn by the page\'s own script (D3 or similar), so it can\'t take new numbers. Rebuild it with Insert › Chart from the same data.', 'warn', 8000);
    var t = K.current(key), from = null, gridHost = h('div', { 'class': 'dgrid-wrap' }), info = h('div', { 'class': 'muted small' });
    var cs = r.state.charts[key] || {}, linked = cs.binding && cs.binding.dataset;
    function render() {
      gridHost.innerHTML = '';
      var tb = h('table', { 'class': 'dgrid' });
      var head = h('tr', {}, [h('th', { 'class': 'rh' }), h('th', {}, [h('input', { 'class': 'cell head', value: t.labelName || 'Category', 'aria-label': 'Label column name', oninput: function (e) { t.labelName = e.target.value; } })])].concat(t.series.map(function (s, k) {
        return h('th', {}, [h('div', { 'class': 'row' }, [h('input', { 'class': 'cell head', value: s.name, 'aria-label': 'Series name', oninput: function (e) { s.name = e.target.value; } }), h('button', { 'class': 'icon-btn xs', type: 'button', title: 'Remove this series', onclick: function () { t.series.splice(k, 1); render(); } }, ['✕'])])]);
      })).concat([h('th', {}, [h('button', { 'class': 'btn sm ghost', type: 'button', title: 'Add a series (a new column of numbers)', onclick: function () { t.series.push({ name: 'Series ' + (t.series.length + 1), values: t.labels.map(function () { return null; }) }); render(); } }, ['＋ Series'])])]));
      tb.appendChild(head);
      t.labels.forEach(function (l, j) {
        tb.appendChild(h('tr', {}, [h('td', { 'class': 'rh' }, [h('button', { 'class': 'icon-btn xs', type: 'button', title: 'Remove this row', onclick: function () { t.labels.splice(j, 1); t.series.forEach(function (s) { s.values.splice(j, 1); }); render(); } }, ['✕'])]),
          h('td', {}, [h('input', { 'class': 'cell', value: l, 'aria-label': 'Label', oninput: function (e) { t.labels[j] = e.target.value; } })])].concat(t.series.map(function (s) {
          return h('td', {}, [h('input', { 'class': 'cell num', value: s.values[j] == null ? '' : s.values[j], inputmode: 'decimal', 'aria-label': s.name, oninput: function (e) { s.values[j] = num(e.target.value); } })]);
        })).concat([h('td')])));
      });
      tb.appendChild(h('tr', {}, [h('td'), h('td', { colspan: t.series.length + 2 }, [h('button', { 'class': 'btn sm ghost', type: 'button', onclick: function () { t.labels.push(''); t.series.forEach(function (s) { s.values.push(null); }); render(); var ins = MS.$$('input.cell', gridHost); setTimeout(function () { var x = MS.$$('tr', tb); var last = x[x.length - 2]; var i0 = last && last.querySelector('input'); if (i0) i0.focus(); }, 0); } }, ['＋ Row'])])]));
      gridHost.appendChild(tb);
      info.textContent = t.labels.length + ' categories × ' + t.series.length + ' series' + (from ? ' · from ' + from : '');
    }
    // paste a range from Excel into any cell: fills the grid from there
    gridHost.addEventListener('paste', function (e) {
      var txt = e.clipboardData && e.clipboardData.getData('text/plain'); if (!txt || !/[\t\n]/.test(txt.trim())) return;
      e.preventDefault();
      var lines = txt.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(function (l) { return l.split('\t'); });
      var hasHead = lines.length > 1 && lines[0].slice(1).some(function (x) { return num(x) === null && x.trim(); });
      if (hasHead || e.target.closest('tr') === gridHost.querySelector('tr')) {
        var rows = lines.slice(1).map(function (l) { var o = {}; lines[0].forEach(function (k, i) { o[k || 'Category'] = l[i]; }); return o; });
        var nt = K.tableFromRows(rows); if (nt) { t = nt; from = 'pasted range'; render(); }
      } else {
        lines.forEach(function (l) { t.labels.push(l[0]); t.series.forEach(function (s, k) { s.values.push(num(l[k + 1])); }); });
        render();
      }
    });
    render();
    var upload = function () {
      MS.pickFiles('.csv,.tsv,.xlsx,.xls,.xlsm,.ods,.json,.md').then(function (fs) {
        if (!fs[0]) return;
        MS.drillData.read(fs[0]).then(function (tables) {
          var tt = tables.filter(function (x) { return x.rows && x.rows.length; });
          var nt = tt.length ? K.tableFromRows(tt[0].rows) : null;
          if (!nt) return MS.dialogError('No numbers found in ' + fs[0].name + '. Put the labels in the first column and the numbers in the next columns, with a header row.');
          t = nt; from = fs[0].name + (tt.length > 1 ? ' (sheet "' + tt[0].name + '")' : ''); render();
          MS.dialogError('');
        }).catch(function (e) { MS.dialogError('Could not read the file: ' + e.message); });
      });
    };
    var body = h('div', { 'class': 'chart-data' }, [
      h('div', { 'class': 'row gap wrap' }, [
        h('button', { 'class': 'btn', type: 'button', onclick: upload }, ['⬆ Upload CSV or Excel…']),
        h('button', { 'class': 'btn', type: 'button', onclick: function () { MS.download(MS.charts.nameOf(key).replace(/[^\w\- ]+/g, '').trim() + ' data.csv', '﻿' + K.csv(t, t.labelName), 'text/csv;charset=utf-8'); } }, ['⬇ Download as CSV']),
        h('span', { 'class': 'grow' }), info]),
      gridHost,
      h('small', { 'class': 'hint', html: 'Type over the numbers, or copy a range in Excel and paste it into a cell (<kbd>Ctrl+V</kbd>). The file needs the labels in the first column and one column per series. The numbers are kept inside the dashboard, so the exported file works offline.' })
    ]);
    var btns = [{ label: 'Cancel', value: null }, { label: 'Use these numbers', primary: true, value: function () { return 'apply'; } }];
    if (linked) btns.unshift({ label: 'Use the page\'s own numbers', danger: true, value: 'reset' });
    MS.dialog({ title: '⛁ Data for “' + MS.charts.nameOf(key) + '”', sub: 'These numbers draw this chart only. Filters and drill-down keep working.', wide: true, enterSubmits: false, body: body, buttons: btns }).then(function (v) {
      if (v === 'reset') { K.resetData(key); return MS.toast('The chart is back on the page\'s own numbers.', 'ok'); }
      if (v !== 'apply') return;
      t.labels = t.labels.map(function (l) { return String(l == null ? '' : l).trim(); });
      var keep = t.labels.map(function (l, j) { return l !== '' || t.series.some(function (s) { return s.values[j] != null; }); });
      t.labels = t.labels.filter(function (_, j) { return keep[j]; }); t.series.forEach(function (s) { s.values = s.values.filter(function (_, j) { return keep[j]; }); });
      try { var res = K.applyData(key, t, from); MS.toast('Chart updated: ' + res.labels + ' categories, ' + res.series.length + ' series.', 'ok', 5000, { action: { label: 'Undo', run: function () { MS.history.undo(); } } }); }
      catch (e) { MS.toast(e.message, 'error', 8000); }
    });
  };
})(window.MS);
