/* Notes on charts: callouts, arrows and "so what" boxes pinned to a data point (they follow the
   point when the data or the size changes), the source and "as of" date under each chart, and a
   footnotes block that gathers them. All kept in the state, so exported files show them too. */
(function (MS) {
  'use strict';
  var h = MS.h;
  function rt() { return MS.rt(); }

  /* ================================================================ annotations */
  var An = MS.annotate = {};
  An.KINDS = [{ value: 'callout', label: 'Callout (label with a line)' }, { value: 'arrow', label: 'Arrow pointing at the value' }, { value: 'sowhat', label: '"So what" box' }];
  An.list = function (chart) { var r = rt(); return ((r && r.state.annotations) || []).filter(function (a) { return !chart || a.chart === chart; }); };
  An.get = function (id) { return An.list().filter(function (a) { return a.id === id; })[0] || null; };
  // a: {chart, label, series, fx, fy, kind, text, title, color, dx, dy}
  An.add = function (a) {
    var r = rt(); if (!r) throw new Error('Open a dashboard first');
    if (!r.chart(a.chart)) throw new Error('No chart "' + a.chart + '"');
    var x = { id: r.uid('n'), chart: a.chart, kind: a.kind || 'callout', text: String(a.text || '') };
    ['label', 'series', 'fx', 'fy', 'title', 'color', 'dx', 'dy'].forEach(function (k) { if (a[k] != null && a[k] !== '') x[k] = a[k]; });
    if (x.label != null) x.label = String(x.label);
    if (x.label == null && x.fx == null) { x.fx = 0.5; x.fy = 0.3; }
    MS.history.state('Add annotation', function (s) { s.annotations = (s.annotations || []).concat([x]); });
    return x;
  };
  An.update = function (id, patch, label) {
    MS.history.state(label || 'Edit annotation', function (s) { (s.annotations || []).forEach(function (a) { if (a.id === id) Object.keys(patch).forEach(function (k) { if (patch[k] === null) delete a[k]; else a[k] = patch[k]; }); }); });
  };
  An.remove = function (id) { MS.history.state('Delete annotation', function (s) { s.annotations = (s.annotations || []).filter(function (a) { return a.id !== id; }); }); };
  // Pin a note where the user right-clicked (child coordinates): the nearest data point, else that spot.
  An.dialog = function (key, at, existing) {
    var r = rt(); if (!r) return MS.toast('Turn off Safe mode to annotate charts.', 'warn');
    var a = existing || null, near = null;
    if (!a) {
      var c = r.chart(key); if (!c) return MS.toast('Select a chart first.', 'warn');
      var b = c.el.getBoundingClientRect();
      near = at ? r.nearestPoint(key, at.x, at.y) : null;
      if (!near) { var d = r.chartData(key, true) || { labels: [] }, mid = Math.floor((d.labels.length - 1) / 2); near = r.nearestPoint(key, b.left + b.width / 2, b.top + b.height / 3) || { fx: 0.5, fy: 0.3 }; if (near.label == null && d.labels.length) { near.label = d.labels[mid]; near.series = 0; } }
    }
    var pin = a || near;
    var onWhat = pin.label != null ? '“' + pin.label + '”' + (pin.name ? ' · ' + pin.name : '') + (pin.value != null ? ' = ' + (r.fmtNum ? r.fmtNum(pin.value) : pin.value) : '') : 'this spot on the chart';
    var f = MS.form([
      { key: 'kind', label: 'Kind', type: 'select', options: An.KINDS, value: a ? a.kind : 'callout' },
      { key: 'text', label: 'Text', type: 'textarea', rows: 2, value: a ? a.text : '', placeholder: 'e.g. Claims spike after the July floods' },
      { key: 'title', label: 'Box heading', value: a && a.title || 'So what' },
      { key: 'color', label: 'Colour', type: 'color', value: a && a.color || '#b91c1c' }
    ], function () { shape(); });
    function shape() { f.inputs.title.closest('label').style.display = f.inputs.kind.value === 'sowhat' ? '' : 'none'; }
    shape();
    MS.dialog({ title: a ? '✎ Edit annotation' : '📌 Annotate the chart', sub: 'Pinned to ' + onWhat + '. It moves with the point when the data or size changes. Drag it on the chart to place it.',
      body: f, buttons: (a ? [{ label: 'Delete', danger: true, value: 'delete' }] : []).concat([{ label: 'Cancel', value: null }, { label: a ? 'Save' : 'Add', primary: true, value: function () { var v = f.values(); if (!v.text.trim()) { MS.dialogError('Type the text of the note.'); return false; } return v; } }]) }).then(function (v) {
      if (v === 'delete') return An.remove(a.id);
      if (!v) return;
      var p = { kind: v.kind, text: v.text.trim(), color: v.color, title: v.kind === 'sowhat' && v.title && v.title !== 'So what' ? v.title : null };
      if (a) An.update(a.id, p);
      else { p.chart = key; p.label = near.label; p.series = near.series; p.fx = near.fx; p.fy = near.fy; An.add(p); }
    });
  };
  An.manage = function (key) {
    var list = An.list(key);
    if (!list.length) return An.dialog(key);
    MS.dialog({ title: '📌 Annotations on this chart', wide: true, body: h('div', { 'class': 'list' }, list.map(function (a) {
      return h('div', { 'class': 'list-row' }, [h('span', { 'class': 'rule-sw', style: { background: a.color || '#b91c1c' } }), h('span', { 'class': 'grow', text: (a.label != null ? a.label + ': ' : '') + a.text }),
        h('button', { 'class': 'btn sm', onclick: function () { closeTop(); An.dialog(key, null, a); } }, ['Edit']),
        h('button', { 'class': 'icon-btn', title: 'Delete', onclick: function (e) { An.remove(a.id); e.currentTarget.closest('.list-row').remove(); } }, ['🗑'])]);
    })), buttons: [{ label: '＋ Add another', value: 'add' }, { label: 'Close', primary: true, value: null }] }).then(function (v) { if (v === 'add') An.dialog(key); });
  };
  function closeTop() { var x = MS.$$('.dlg-wrap').pop(); if (x) x.querySelector('.dlg-x').click(); }
  MS.on('child-loaded', function (c) {
    c.win.addEventListener('ms:annot-move', function (e) { var d = e.detail || {}; if (An.get(d.id)) An.update(d.id, { dx: d.dx, dy: d.dy }, 'Move annotation'); });
    c.win.addEventListener('ms:annot-edit', function (e) { var a = An.get((e.detail || {}).id); if (a) An.dialog(a.chart, null, a); });
  });

  /* ================================================================ source and "as of" date under each chart */
  var So = MS.sources = {};
  So.get = function (key) { var r = rt(), cs = r && r.state.charts[key]; return cs && cs.source || null; };
  So.set = function (key, src) {
    var clean = src && (src.text || src.asOf || src.note) ? { text: String(src.text || '').trim(), asOf: src.asOf || '', note: String(src.note || '').trim() } : null;
    if (clean) Object.keys(clean).forEach(function (k) { if (!clean[k]) delete clean[k]; });
    MS.history.state(clean ? 'Chart source' : 'Remove chart source', function (s) { var cs = s.charts[key] = s.charts[key] || {}; if (clean) cs.source = clean; else delete cs.source; });
  };
  // the same source on every chart that has none yet (e.g. one extract feeds the whole dashboard)
  So.setAll = function (src, overwrite) {
    var r = rt(); if (!r) return 0; var n = 0;
    MS.history.state('Sources for all charts', function (s) { r.charts().forEach(function (c) { var cs = s.charts[c.key] = s.charts[c.key] || {}; if (cs.source && !overwrite) return; cs.source = JSON.parse(JSON.stringify(src)); n++; }); });
    return n;
  };
  So.missing = function () { var r = rt(); if (!r) return []; return r.charts().filter(function (c) { var s = So.get(c.key); return !(s && (s.text || s.asOf)); }).map(function (c) { return c.key; }); };
  So.dialog = function (key) {
    var r = rt(); if (!r) return MS.toast('Turn off Safe mode first.', 'warn');
    var s = So.get(key) || {}, last = MS.prefs.get('lastSource', {}) || {};
    var f = MS.form([
      { key: 'text', label: 'Source', value: s.text || last.text || '', placeholder: 'e.g. Policy admin system extract; client finance team' },
      { key: 'asOf', label: 'Data as of', type: 'date', value: s.asOf || last.asOf || '' },
      { key: 'note', label: 'Note (optional)', value: s.note || '', placeholder: 'e.g. Excludes reinsurance; FY = Apr–Mar' },
      { key: 'all', label: 'Also use this on every chart that has no source yet', type: 'checkbox' }
    ]);
    MS.dialog({ title: '🧾 Source and date', sub: 'Shown in small type under the chart, and in the footnotes block.', body: f,
      buttons: (So.get(key) ? [{ label: 'Remove', danger: true, value: 'remove' }] : []).concat([{ label: 'Cancel', value: null }, { label: 'Save', primary: true, value: function () { return f.values(); } }]) }).then(function (v) {
      if (v === 'remove') return So.set(key, null);
      if (!v) return;
      MS.prefs.set('lastSource', { text: v.text, asOf: v.asOf });
      MS.history.group('Chart source', function () { So.set(key, v); if (v.all) So.setAll({ text: v.text, asOf: v.asOf }); });
    });
  };
  // A "Notes and sources" block: one line per chart with a source, then the firm disclaimer.
  So.footnotesHtml = function (extra) {
    var r = rt(), items = [];
    if (r) r.charts().forEach(function (c) {
      var s = So.get(c.key); if (!s) return;
      var t = (r.chartInfo(c.key) || {}).title || (MS.blocks && MS.blocks.guessTitle ? MS.blocks.guessTitle(c.el) : '') || c.key;
      items.push('<li><b>' + MS.esc(t) + '.</b> ' + MS.esc(r.sourceText(s)) + '</li>');
    });
    (extra || []).forEach(function (x) { items.push('<li>' + MS.esc(x) + '</li>'); });
    var firm = MS.firm && MS.firm.current();
    if (firm && firm.footer) items.push('<li>' + MS.esc(firm.footer) + '</li>');
    if (!items.length) items.push('<li>Source: [add the source of the data]. Figures may not add up because of rounding.</li>');
    return '<div class="ms-footnotes"><h4>Notes and sources</h4><ol>' + items.join('') + '</ol></div>';
  };
  So.insertFootnotes = function (extra) {
    if (!MS.child) return MS.toast('Open a dashboard first.', 'warn');
    var old = MS.child.doc.querySelector('.ms-footnotes[data-ms-own]');
    var n = MS.compose.make(So.footnotesHtml(extra));
    if (old && old.isConnected) {
      MS.history.group('Update footnotes', function () { var p = old.parentNode, nx = old.nextSibling; MS.history.move('Update footnotes', n, function () { p.insertBefore(n, nx); }); MS.history.move('Update footnotes', old, function () { old.remove(); }); });
      MS.edit.reveal(n); return n;
    }
    if (!MS.sel) { var host = MS.compose.container(), last = host.lastElementChild; while (last && (/^(SCRIPT|STYLE)$/.test(last.tagName) || last.id === 'ms-firm-foot' || !last.offsetParent && last.tagName !== 'SECTION')) last = last.previousElementSibling; if (last) MS.edit.select(last); }
    return MS.compose.place(n, 'Insert footnotes');
  };
})(window.MS);
