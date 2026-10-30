/* Draw on charts, the way consultants mark up slides: lines and arrows, boxes and circles to
   highlight, text and callouts, and the two classics pinned to the data: a growth arrow that
   works out the CAGR, and a difference bracket ("+$1.2M (+15%)") between two bars. Kept in the
   state (state.shapes), drawn by the runtime, so exports and PDFs show them. Select a shape to
   drag it, pull its round handles, or restyle it from the bar that appears over it. */
(function (MS) {
  'use strict';
  var h = MS.h;
  var Sh = MS.shapes = { tool: null, selected: null };
  function rt() { return MS.rt(); }
  function cdoc() { return MS.child && MS.child.doc; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  Sh.KINDS = [
    { kind: 'arrow', icon: '➝', label: 'Arrow', title: 'Drag on the chart from where the arrow starts to where it points' },
    { kind: 'line', icon: '―', label: 'Line', title: 'A straight line, e.g. a target or average' },
    { kind: 'darrow', icon: '⟷', label: 'Double arrow', title: 'An arrow with heads at both ends' },
    { kind: 'rect', icon: '▭', label: 'Box', title: 'A box around something to highlight it' },
    { kind: 'ellipse', icon: '◯', label: 'Circle', title: 'A circle around a point or bar' },
    { kind: 'text', icon: '🅣', label: 'Text', title: 'Text anywhere on the chart' },
    { kind: 'callout', icon: '💬', label: 'Callout', title: 'A text box with a line to the spot it is about' },
    { kind: 'cagr', icon: '↗', label: 'Growth arrow (CAGR)', title: 'An arrow over the bars from one period to another, labelled with the compound annual growth rate' },
    { kind: 'delta', icon: '⊓', label: 'Difference', title: 'A bracket between two bars, labelled with the change (+$1.2M, +15%)' }
  ];
  Sh.COLORS = ['#0f172a', '#dc2626', '#ea580c', '#16a34a', '#1d4ed8', '#7c3aed', '#64748b'];
  function themeColor() { var r = rt(), t = r && r.state.theme; return (t && t.colors && t.colors.primary) || '#1d4ed8'; }
  function defColor(kind) { return kind === 'cagr' || kind === 'delta' ? themeColor() : kind === 'rect' || kind === 'ellipse' ? '#dc2626' : '#0f172a'; }
  Sh.kindLabel = function (k) { var x = Sh.KINDS.filter(function (y) { return y.kind === k; })[0]; return x ? x.label : k; };

  /* ---------------------------------------------------------------- the list */
  Sh.list = function (chart) { var r = rt(); return ((r && r.state.shapes) || []).filter(function (x) { return !chart || x.chart === chart; }); };
  Sh.get = function (id) { return Sh.list().filter(function (x) { return x.id === id; })[0] || null; };
  function point(p) {
    if (!p) return null;
    if (p.label != null) return { label: String(p.label), series: +p.series || 0 };
    if (p.fx != null || p.x != null) return { fx: +(p.fx != null ? p.fx : p.x), fy: +(p.fy != null ? p.fy : p.y) };
    return null;
  }
  // s: {chart, kind, a, b, text, color, width, dash, fill, lift, periods, show}
  Sh.add = function (s) {
    var r = rt(); if (!r) throw new Error('Open a dashboard first');
    if (!r.chart(s.chart)) throw new Error('No chart "' + s.chart + '"');
    if (!Sh.KINDS.some(function (k) { return k.kind === s.kind; })) throw new Error('Unknown shape "' + s.kind + '". Use ' + Sh.KINDS.map(function (k) { return k.kind; }).join(', '));
    var x = { id: r.uid('sh'), chart: s.chart, kind: s.kind, a: point(s.a), b: point(s.b) };
    if (!x.a) throw new Error('Say where the shape starts (a).');
    if ((s.kind === 'cagr' || s.kind === 'delta') && (x.a.label == null || !x.b || x.b.label == null)) throw new Error('A growth arrow or difference goes from one data point to another: give a and b as {label, series}.');
    if (!x.b) { if (s.kind === 'text') delete x.b; else x.b = x.a.fx != null ? { fx: Math.min(1, x.a.fx + 0.2), fy: x.a.fy } : null; }
    ['text', 'color', 'width', 'dash', 'fill', 'lift', 'periods', 'show', 'size', 'opacity'].forEach(function (k) { if (s[k] != null && s[k] !== '') x[k] = s[k]; });
    if (!x.color) x.color = defColor(x.kind);
    MS.history.state('Add ' + Sh.kindLabel(x.kind).toLowerCase(), function (st) { st.shapes = (st.shapes || []).concat([x]); });
    return x;
  };
  Sh.update = function (id, patch, label) {
    MS.history.state(label || 'Edit shape', function (st) { (st.shapes || []).forEach(function (x) { if (x.id === id) Object.keys(patch).forEach(function (k) { if (patch[k] === null || patch[k] === undefined) delete x[k]; else x[k] = patch[k]; }); }); });
    Sh.syncBar();
  };
  Sh.remove = function (id) {
    MS.history.state('Delete shape', function (st) { st.shapes = (st.shapes || []).filter(function (x) { return x.id !== id; }); });
    if (Sh.selected === id) Sh.select(null);
  };
  Sh.clear = function (chart) {
    var n = Sh.list(chart).length; if (!n) return 0;
    MS.history.state('Delete shapes', function (st) { st.shapes = (st.shapes || []).filter(function (x) { return chart && x.chart !== chart; }); });
    Sh.select(null); return n;
  };
  Sh.select = function (id) {
    var r = rt(); Sh.selected = id || null;
    if (r) { r.shapeSel = Sh.selected; r.renderAnnots && r.renderAnnots(); }
    MS.emit('shape', Sh.selected);
    Sh.syncBar(); if (MS.move) MS.move.syncBar();
  };

  /* ---------------------------------------------------------------- drawing with the mouse */
  Sh.start = function (kind, key) {
    var r = rt(); if (!r) return MS.toast('Turn off Safe mode to draw on charts.', 'warn');
    if (!r.charts().length) return MS.toast('This dashboard has no charts to draw on.', 'warn');
    if (MS.mode !== 'edit') MS.setMode('edit');
    if (kind === 'cagr' || kind === 'delta') return Sh.pointsDialog(key || MS.charts.selectedKey() || r.charts()[0].key, kind);
    Sh.tool = kind; Sh.toolChart = key || null;
    var d = cdoc(); d.body.classList.add('ms-drawing');
    ensureCss();
    MS.status('Drawing a ' + Sh.kindLabel(kind).toLowerCase() + ': drag on a chart. Esc to stop.');
    MS.toast('Drag on a chart to draw the ' + Sh.kindLabel(kind).toLowerCase() + '. Esc to stop.', '', 3500);
  };
  Sh.stop = function () { Sh.tool = null; var d = cdoc(); if (d && d.body) d.body.classList.remove('ms-drawing'); MS.status(''); };
  function ensureCss() {
    var d = cdoc(); if (d.getElementById('ms-draw-css')) return;
    var st = d.createElement('style'); st.id = 'ms-draw-css'; st.setAttribute('data-ms-editor', '');
    st.textContent = 'body.ms-drawing,body.ms-drawing *{cursor:crosshair!important}';
    d.head.appendChild(st);
  }
  function chartAt(x, y) {
    var r = rt(); if (!r) return null;
    var hit = null;
    r.charts().forEach(function (c) { var b = c.el.getBoundingClientRect(); if (b.width && x >= b.left - 4 && x <= b.right + 4 && y >= b.top - 4 && y <= b.bottom + 4 && (!hit || b.width * b.height < hit.area)) hit = { c: c, b: b, area: b.width * b.height }; });
    return hit;
  }
  function frac(b, x, y) { return { fx: +Math.max(-0.2, Math.min(1.2, (x - b.left) / b.width)).toFixed(4), fy: +Math.max(-0.2, Math.min(1.2, (y - b.top) / b.height)).toFixed(4) }; }
  var drag = null;
  function onDown(e) {
    if (!Sh.tool || e.button !== 0) return;
    var hit = chartAt(e.clientX, e.clientY);
    e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    if (!hit) { MS.toast('Start on a chart.', 'warn', 2000); return; }
    var a = frac(hit.b, e.clientX, e.clientY);
    drag = { c: hit.c, b: hit.b, a: a, x: e.clientX, y: e.clientY, sh: { id: '__draw', chart: hit.c.key, kind: Sh.tool, a: a, b: a, color: defColor(Sh.tool), text: Sh.tool === 'text' ? 'Text' : Sh.tool === 'callout' ? 'Callout' : '' } };
  }
  function onMove(e) {
    if (!drag) return;
    e.preventDefault(); e.stopPropagation();
    drag.sh.b = frac(drag.b, e.clientX, e.clientY);
    if (e.shiftKey && /line|arrow/.test(drag.sh.kind)) { var dx = Math.abs(e.clientX - drag.x), dy = Math.abs(e.clientY - drag.y); if (dx > dy) drag.sh.b.fy = drag.a.fy; else drag.sh.b.fx = drag.a.fx; }
    rt().shapePreview(copy(drag.sh));
  }
  function onUp(e) {
    if (!drag) return;
    e.preventDefault(); e.stopPropagation();
    var d = drag; drag = null; rt().shapePreviewEnd('__draw');
    var small = Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) < 8, kind = d.sh.kind, s = { chart: d.c.key, kind: kind, a: d.a, b: d.sh.b, color: d.sh.color };
    if (small) {
      var w = 140 / d.b.width, hh = 70 / d.b.height;
      s.b = kind === 'rect' || kind === 'ellipse' ? { fx: d.a.fx + w, fy: d.a.fy + hh } : kind === 'callout' ? { fx: d.a.fx + w * 0.6, fy: d.a.fy - hh } : { fx: d.a.fx + w, fy: d.a.fy };
    }
    Sh.stop();
    var swallow = function (ev) { ev.preventDefault(); ev.stopPropagation(); MS.child.doc.removeEventListener('click', swallow, true); };
    MS.child.doc.addEventListener('click', swallow, true); setTimeout(function () { MS.child.doc.removeEventListener('click', swallow, true); }, 300);
    var go = function (text) { if (text != null) s.text = text; var x = Sh.add(s); Sh.select(x.id); };
    if (kind === 'text' || kind === 'callout') MS.prompt(kind === 'text' ? 'Text' : 'Callout text', kind === 'text' ? '' : '').then(function (t) { if (t && t.trim()) go(t.trim()); });
    else go();
  }

  /* ---------------------------------------------------------------- growth arrow and difference */
  Sh.pointsDialog = function (key, kind, existing) {
    var r = rt(); if (!r) return;
    var d = r.chartData(key, true) || { labels: [], series: [] };
    if (d.labels.length < 2) return MS.toast('This chart needs at least two categories (bars or points).', 'warn');
    var x = existing || null, opts = d.labels.map(function (l) { return { value: l, label: l }; });
    var sers = d.series.map(function (s, i) { return { value: String(i), label: s.name }; });
    var fields = [
      { key: 'from', label: 'From', type: 'select', options: opts, value: x ? x.a.label : d.labels[0] },
      { key: 'to', label: 'To', type: 'select', options: opts, value: x ? x.b.label : d.labels[d.labels.length - 1] }
    ];
    if (sers.length > 1) fields.push({ key: 'series', label: 'Series', type: 'select', options: sers, value: x ? String(x.a.series || 0) : '0' });
    if (kind === 'cagr') fields.push({ key: 'periods', label: 'Years between them (blank = count the bars)', value: x && x.periods || '' });
    else fields.push({ key: 'show', label: 'Show', type: 'select', options: [{ value: 'both', label: 'Change and % (+$1.2M (+15%))' }, { value: 'abs', label: 'Change only' }, { value: 'pct', label: '% only' }], value: x && x.show || 'both' });
    fields.push({ key: 'text', label: 'Label (blank = work it out)', value: x && x.text || '', placeholder: kind === 'cagr' ? 'e.g. +12% CAGR' : 'e.g. +$1.2M' });
    fields.push({ key: 'color', label: 'Colour', type: 'color', value: x && x.color || defColor(kind) });
    var f = MS.form(fields, function () { prev(); });
    var note = h('p', { 'class': 'muted small' });
    function vals() {
      var v = f.values(), s = { chart: key, kind: kind, a: { label: v.from, series: +(v.series || 0) }, b: { label: v.to, series: +(v.series || 0) }, color: v.color, text: v.text.trim() || null };
      if (kind === 'cagr' && v.periods) s.periods = +v.periods; if (kind === 'delta') s.show = v.show;
      return s;
    }
    function prev() { var s = vals(); s.text = null; note.textContent = 'Label: ' + r.shapeLabel(key, s) + (kind === 'cagr' ? '. CAGR = (last ÷ first)^(1 ÷ years) − 1.' : ''); }
    prev();
    MS.dialog({ title: (kind === 'cagr' ? '📈 Growth arrow (CAGR)' : '⇅ Difference') + ' on “' + MS.charts.nameOf(key) + '”', sub: 'Pinned to the two bars or points, so it follows them when the data changes. Drag it up or down on the chart; drag its ends to other bars.',
      body: h('div', {}, [f, note]), buttons: (x ? [{ label: 'Delete', danger: true, value: 'delete' }] : []).concat([{ label: 'Cancel', value: null }, { label: x ? 'Save' : 'Add', primary: true, value: function () { var s = vals(); if (s.a.label === s.b.label) { MS.dialogError('Pick two different points.'); return false; } return s; } }]) }).then(function (v) {
      if (v === 'delete') return Sh.remove(x.id);
      if (!v) return;
      if (x) Sh.update(x.id, { a: v.a, b: v.b, color: v.color, text: v.text, periods: v.periods || null, show: v.show || null });
      else { var n = Sh.add(v); Sh.select(n.id); }
    });
  };
  Sh.edit = function (id) {
    var x = Sh.get(id); if (!x) return;
    if (x.kind === 'cagr' || x.kind === 'delta') return Sh.pointsDialog(x.chart, x.kind, x);
    MS.prompt(x.kind === 'text' || x.kind === 'callout' ? 'Text' : 'Label (optional)', x.text || '').then(function (t) { if (t !== null) Sh.update(id, { text: t.trim() || null }, 'Shape text'); });
  };

  /* ---------------------------------------------------------------- menus and the shape bar */
  Sh.menuItems = function (key) {
    var items = Sh.KINDS.map(function (k) { return { icon: k.icon, label: k.label + (k.kind === 'cagr' || k.kind === 'delta' ? '…' : ''), title: k.title, run: function () { Sh.start(k.kind, key); } }; });
    var n = key ? Sh.list(key).length : 0;
    if (n) items = items.concat(['-', { icon: '🗑', label: 'Remove the ' + n + ' shape(s) on this chart', danger: true, run: function () { Sh.clear(key); } }]);
    return items;
  };
  var sbar = null;
  Sh.syncBar = function () {
    var d = cdoc(); if (!d || !MS.move) return;
    if (!sbar || sbar.ownerDocument !== d || !sbar.isConnected) { sbar = d.createElement('div'); sbar.id = 'ms-shapebar'; sbar.className = 'ms-floatbar'; sbar.setAttribute('data-ms-editor', ''); d.body.appendChild(sbar); }
    var x = Sh.selected && Sh.get(Sh.selected), node = x && d.querySelector('.ms-shape[data-shape="' + x.id + '"]');
    if (!x || !node || MS.mode !== 'edit') { sbar.style.display = 'none'; return; }
    MS.move.barCss();
    var B = MS.move.btn; sbar.innerHTML = '';
    var name = d.createElement('span'); name.className = 'ms-mb-name'; name.textContent = Sh.kindLabel(x.kind); sbar.appendChild(name);
    Sh.COLORS.concat([themeColor()]).filter(function (c, i, a) { return a.indexOf(c) === i; }).forEach(function (c) {
      var b = B('', 'Colour ' + c, function () { Sh.update(x.id, { color: c }, 'Shape colour'); }, 'ms-swb' + (String(x.color).toLowerCase() === c.toLowerCase() ? ' on' : ''));
      b.textContent = ''; var sw = d.createElement('span'); sw.className = 'ms-sw'; sw.style.background = c; b.appendChild(sw); sbar.appendChild(b);
    });
    sbar.appendChild(d.createElement('i'));
    if (x.kind !== 'text') {
      [1, 2, 3.5].forEach(function (w) { var b = B('', 'Line ' + w + ' pt', function () { Sh.update(x.id, { width: w }, 'Line width'); }, (+x.width || 2) === w ? 'on' : ''); b.textContent = ''; var ln = d.createElement('span'); ln.style.cssText = 'display:block;width:16px;height:' + w + 'px;background:currentColor;border-radius:2px'; b.appendChild(ln); sbar.appendChild(b); });
      var dashes = [['', 'Solid', '―'], ['dash', 'Dashed', '┄'], ['dot', 'Dotted', '⋯']];
      var db = B('', 'Line style', function (e, bt) { var r = bt.getBoundingClientRect(), fr = MS.$('#stage-frame-host iframe').getBoundingClientRect(), s = MS.view.scale || 1; MS.menuAt(fr.left + r.left * s, fr.top + r.bottom * s + 4, dashes.map(function (q) { return { label: q[2] + '  ' + q[1], run: function () { Sh.update(x.id, { dash: q[0] || null }, 'Line style'); } }; })); });
      db.textContent = (dashes.filter(function (q) { return q[0] === (x.dash || ''); })[0] || dashes[0])[2]; sbar.appendChild(db);
    }
    if (x.kind === 'rect' || x.kind === 'ellipse') sbar.appendChild(B('', 'Fill', function () { Sh.update(x.id, { fill: x.fill ? null : x.color }, 'Shape fill'); }, x.fill ? 'on' : '')).textContent = 'Fill';
    if (x.kind === 'line' || x.kind === 'arrow' || x.kind === 'darrow') {
      var kinds = [['line', '―'], ['arrow', '→'], ['darrow', '↔']];
      kinds.forEach(function (q) { var b = B('', Sh.kindLabel(q[0]), function () { Sh.update(x.id, { kind: q[0] }, 'Arrow heads'); }, x.kind === q[0] ? 'on' : ''); b.textContent = q[1]; sbar.appendChild(b); });
    }
    if (x.kind === 'delta') sbar.appendChild(B('', 'What the label shows', function () { var nx = { both: 'pct', pct: 'abs', abs: 'both' }[x.show || 'both']; Sh.update(x.id, { show: nx }, 'Difference label'); })).textContent = { both: '$ & %', pct: '%', abs: '$' }[x.show || 'both'];
    sbar.appendChild(d.createElement('i'));
    sbar.appendChild(B('pen', x.kind === 'cagr' || x.kind === 'delta' ? 'Points and label…' : 'Text…', function () { Sh.edit(x.id); }));
    sbar.appendChild(B('trash', 'Delete shape (Del)', function () { Sh.remove(x.id); }, 'ms-mb-del'));
    sbar.style.display = 'flex';
    MS.move.placeBar(sbar, node.getBoundingClientRect());
  };

  /* ---------------------------------------------------------------- wiring */
  function onKey(e) {
    var t = e.target, typing = t && t.nodeType === 1 && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    if (typing || MS.$('.dlg-wrap')) return;
    if (e.key === 'Escape' && (Sh.tool || drag)) { e.preventDefault(); e.stopPropagation(); if (drag) { rt().shapePreviewEnd('__draw'); drag = null; } Sh.stop(); return; }
    if (!Sh.selected) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); Sh.select(null); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); Sh.remove(Sh.selected); }
  }
  window.addEventListener('keydown', onKey, true);
  MS.on('child-loaded', function (c) {
    Sh.tool = null; Sh.selected = null; sbar = null; drag = null;
    c.win.addEventListener('keydown', onKey, true);
    c.win.addEventListener('mousedown', onDown, true);
    c.win.addEventListener('mousemove', onMove, true);
    c.win.addEventListener('mouseup', onUp, true);
    c.win.addEventListener('ms:shape-select', function (e) {
      Sh.selected = e.detail.id; var x = Sh.get(e.detail.id), r = rt();
      if (x && r && r.chart(x.chart) && MS.sel !== MS.clipboard.unitOf(r.chart(x.chart).el)) { MS.edit.select(MS.clipboard.unitOf(r.chart(x.chart).el)); }
      MS.emit('shape', Sh.selected); Sh.syncBar(); MS.move && MS.move.syncBar();
    });
    c.win.addEventListener('ms:shape-move', function (e) { var p = e.detail, patch = {}; ['a', 'b', 'lift'].forEach(function (k) { if (p[k] !== undefined) patch[k] = p[k]; }); Sh.update(p.id, patch, 'Move shape'); });
    c.win.addEventListener('ms:shape-edit', function (e) { Sh.edit(e.detail.id); });
    // a click anywhere else lets go of the shape
    c.doc.addEventListener('mousedown', function (e) { if (Sh.selected && !(e.target.closest && e.target.closest('[data-shape],.ms-floatbar'))) Sh.select(null); }, true);
    c.win.addEventListener('ms:refresh', function () { if (Sh.selected) setTimeout(Sh.syncBar, 30); });
  });
  // API (and MCP): shapes drawn on charts
  MS.api.add('chart_shapes', { d: 'Draw on a chart like a consultant in PowerPoint: a growth arrow labelled with the CAGR, a difference bracket (+$1.2M, +15%), arrows, lines, boxes, circles, text and callouts. They stay on the chart and follow its data. action: list (default) | add | update | delete | clear. Points: {label, series} sits on a data point (needed for cagr and delta); {fx, fy} is a spot on the chart from 0 to 1 (left/top = 0).', p: { action: ['string', 'list | add | update | delete | clear'], chart: ['string', 'Chart name or key'], kind: ['string', Sh.KINDS.map(function (k) { return k.kind; }).join(' | ')], a: ['object', 'Start: {label, series} or {fx, fy}'], b: ['object', 'End: {label, series} or {fx, fy}'], text: ['string', 'Text (text, callout; replaces the automatic label of cagr / delta)'], color: ['string', 'Colour'], width: ['number', 'Line width px'], dash: ['string', 'solid | dash | dot'], fill: ['boolean', 'Fill a box or circle'], show: ['string', 'delta label: both | abs | pct'], periods: ['number', 'cagr: number of years (default: categories apart)'], id: ['string', 'Shape id (update / delete)'] },
    f: function (a) {
      var act = a.action || 'list', key = a.chart ? MS.api.chartKey(a.chart) : null, r = rt();
      var view = function (x) { return Object.assign({ label: r.shapeLabel(x.chart, x) || undefined, chartName: MS.charts.nameOf(x.chart) }, x); };
      if (act === 'add') { if (!key) throw new Error('Say which chart.'); return view(Sh.add(Object.assign({}, a, { chart: key }))); }
      if (act === 'update') { if (!Sh.get(a.id)) throw new Error('No shape ' + a.id); var patch = {}; ['a', 'b', 'text', 'color', 'width', 'dash', 'fill', 'show', 'periods', 'lift', 'size', 'opacity'].forEach(function (k) { if (a[k] !== undefined) patch[k] = a[k]; }); Sh.update(a.id, patch); return view(Sh.get(a.id)); }
      if (act === 'delete') { if (!Sh.get(a.id)) throw new Error('No shape ' + a.id); Sh.remove(a.id); return { deleted: a.id }; }
      if (act === 'clear') return { deleted: Sh.clear(key) };
      return Sh.list(key).map(view);
    } });

  MS.on('history', function () { if (Sh.selected && !Sh.get(Sh.selected)) Sh.select(null); else if (Sh.selected) setTimeout(Sh.syncBar, 60); });
  MS.on('mode', function (m) { if (m !== 'edit') { Sh.stop(); if (Sh.selected) Sh.select(null); } });
})(window.MS);
