/* Reshape chart: change what any chart made from data shows, after it is in. Chart type, the category / series / value
   columns, the calculation, sort and top N, the rows it uses (filters for this chart only), and which categories and
   series appear, in what order and under what names. Works on charts from Insert › Chart and from chart layouts.
   Charts › Reshape chart, the floating toolbar, or tool chart_edit. Apply is one undo step. */
(function (MS) {
  'use strict';
  var Rs = MS.reshape = {};
  var h = MS.h;
  var OPS = [{ value: 'eq', label: 'is' }, { value: 'ne', label: 'is not' }, { value: 'in', label: 'is one of (comma separated)' }, { value: 'notin', label: 'is none of' }, { value: 'gt', label: '>' }, { value: 'ge', label: '≥' }, { value: 'lt', label: '<' }, { value: 'le', label: '≤' }, { value: 'contains', label: 'contains' }];

  function uniq(rows, col) { var o = []; rows.forEach(function (r) { var v = r[col]; v = v == null || v === '' ? '(blank)' : String(v); if (o.indexOf(v) < 0) o.push(v); }); return o; }

  // A list of names you can tick on or off, rename and move up or down.
  function nameList(names, b, keys) {
    var hide = b[keys.hide] || [], only = b[keys.only], ren = b.rename || {}, ord = b[keys.order] || [];
    var items = names.slice().sort(function (p, q) { var a = ord.indexOf(p), c = ord.indexOf(q); return (a < 0 ? 1e6 : a) - (c < 0 ? 1e6 : c); })
      .map(function (n) { return { name: n, on: hide.indexOf(n) < 0 && (!only || !only.length || only.indexOf(n) >= 0), as: ren[n] || '' }; });
    var moved = !!ord.length, box = h('div', { 'class': 'rs-list' });
    function draw() {
      box.innerHTML = '';
      items.forEach(function (it, i) {
        var cb = h('input', { type: 'checkbox', checked: it.on, 'aria-label': 'Show ' + it.name, onchange: function () { it.on = cb.checked; } });
        var nm = h('input', { 'class': 'inp sm', value: it.as, placeholder: it.name, title: 'Show it as (blank = its own name)', oninput: function () { it.as = nm.value; } });
        var up = h('button', { 'class': 'btn sm', type: 'button', title: 'Move up', disabled: !i, onclick: function () { items.splice(i - 1, 0, items.splice(i, 1)[0]); moved = true; draw(); } }, ['↑']);
        var dn = h('button', { 'class': 'btn sm', type: 'button', title: 'Move down', disabled: i === items.length - 1, onclick: function () { items.splice(i + 1, 0, items.splice(i, 1)[0]); moved = true; draw(); } }, ['↓']);
        box.appendChild(h('div', { 'class': 'rs-row' }, [cb, h('span', { 'class': 'rs-name', text: it.name }), nm, up, dn]));
      });
    }
    draw();
    box.read = function () {
      var off = items.filter(function (x) { return !x.on; }).map(function (x) { return x.name; }), rn = {};
      items.forEach(function (x) { if (x.as && x.as !== x.name) rn[x.name] = x.as; });
      return { hide: off, order: moved ? items.map(function (x) { return x.name; }) : null, rename: rn };
    };
    return box;
  }

  function whereRows(fields, where) {
    var box = h('div', { 'class': 'rs-where' }), rows = (where || []).map(function (w) { return { field: w.field, op: w.op || (Array.isArray(w.value) ? 'in' : 'eq'), value: [].concat(w.value == null ? '' : w.value).join(', ') }; });
    function draw() {
      box.innerHTML = '';
      rows.forEach(function (w, i) {
        var f = h('select', { 'class': 'inp sm', onchange: function () { w.field = f.value; } }, fields.map(function (n) { return h('option', { value: n, text: n, selected: n === w.field }); }));
        var o = h('select', { 'class': 'inp sm', onchange: function () { w.op = o.value; } }, OPS.map(function (x) { return h('option', { value: x.value, text: x.label, selected: x.value === w.op }); }));
        var v = h('input', { 'class': 'inp sm', value: w.value, oninput: function () { w.value = v.value; } });
        box.appendChild(h('div', { 'class': 'rs-row' }, [f, o, v, h('button', { 'class': 'btn sm', type: 'button', title: 'Remove this filter', onclick: function () { rows.splice(i, 1); draw(); } }, ['✕'])]));
      });
      box.appendChild(h('button', { 'class': 'btn sm', type: 'button', onclick: function () { rows.push({ field: fields[0], op: 'eq', value: '' }); draw(); } }, ['+ Add a filter']));
    }
    draw();
    box.read = function () {
      return rows.filter(function (w) { return w.field && String(w.value).trim() !== ''; }).map(function (w) {
        var multi = w.op === 'in' || w.op === 'notin', val = multi ? String(w.value).split(',').map(function (s) { return s.trim(); }).filter(Boolean) : String(w.value).trim();
        return { field: w.field, op: w.op, value: /^(gt|ge|lt|le)$/.test(w.op) ? Number(val) : val };
      });
    };
    return box;
  }

  Rs.dialog = function (key) {
    var rt = MS.rt(); if (!rt) return;
    key = key || MS.charts.selectedKey();
    if (!key) return MS.toast('Select a chart first.', 'warn');
    var cs = rt.state.charts[key] || {}, b = cs.binding;
    if (!b) return MS.toast('This chart is not linked to data yet. Use Chart settings › Data & drill-down to link it, then reshape it here.', 'warn', 7000);
    var ds = b.dataset, all = rt.getRows(ds), fields = rt.fields(ds), names = fields.map(function (f) { return f.name; }), nums = fields.filter(function (f) { return f.numeric; }).map(function (f) { return f.name; });
    var opt = function (list, blank) { return (blank ? [{ value: '', label: blank }] : []).concat(list.map(function (n) { return { value: n, label: n }; })); };
    var type = (cs.native && cs.native.type) || '';
    var f = MS.form([
      { key: 'type', label: 'Chart type', type: 'select', options: MS.compose.TYPES, value: type || 'bar', hidden: !cs.native },
      { key: 'by', label: 'Categories (one bar, point or slice each)', type: 'select', options: opt(names), value: b.levels[0] },
      { key: 'series', label: 'Split by (series)', type: 'select', options: opt(names, '— none —'), value: b.series || '' },
      { key: 'measure', label: 'Value', type: 'select', options: opt(nums, '— count rows —'), value: b.measure || '' },
      { key: 'agg', label: 'Calculate', type: 'select', options: [{ value: 'sum', label: 'Sum' }, { value: 'avg', label: 'Average' }, { value: 'count', label: 'Count' }, { value: 'min', label: 'Smallest' }, { value: 'max', label: 'Largest' }], value: b.agg || 'sum' },
      { key: 'x', label: 'Across (x)', type: 'select', options: opt(nums, '—'), value: b.x || '' },
      { key: 'y', label: 'Up (y)', type: 'select', options: opt(nums, '—'), value: b.y || '' },
      { key: 'size', label: 'Bubble size', type: 'select', options: opt(nums, '—'), value: b.size || '' },
      { key: 'sort', label: 'Sort', type: 'select', options: [{ value: 'desc', label: 'Largest first' }, { value: 'asc', label: 'Smallest first' }, { value: 'source', label: 'As in the data' }, { value: '', label: 'By name' }], value: b.sort || '' },
      { key: 'top', label: 'Top N only (blank = all)', type: 'number', min: 1, value: b.top || '' },
      { key: 'percent', label: 'Show each bar as 100% (stacked charts)', type: 'checkbox', value: !!b.percent }
    ], function () { sync(); });
    function sync() {
      var t = f.inputs.type.value, xy = /^(scatter|bubble)$/.test(t);
      ['x', 'y'].forEach(function (k) { f.inputs[k].closest('label').style.display = xy ? '' : 'none'; });
      f.inputs.size.closest('label').style.display = t === 'bubble' ? '' : 'none';
      f.inputs.measure.closest('label').style.display = xy ? 'none' : '';
      f.inputs.percent.closest('label').style.display = /stack/.test(t) ? '' : 'none';
    }
    sync();
    var rowsUsed = all.filter(function (r) { return rt.whereOk(r, b.where || []); });
    var cats = nameList(uniq(rowsUsed, b.levels[0]), b, { hide: 'hide', only: 'only', order: 'order' });
    var sers = b.series ? nameList(uniq(rowsUsed, b.series), b, { hide: 'seriesHide', only: 'seriesOnly', order: 'seriesOrder' }) : null;
    var wh = whereRows(names, b.where);
    var run = MS.layouts && MS.layouts.runOf(key);
    var body = h('div', { 'class': 'rs' }, [
      h('h4', { 'class': 'rag-head', text: 'What it shows' }), f,
      h('h4', { 'class': 'rag-head', text: 'Rows this chart uses (filters for this chart only)' }), wh,
      h('h4', { 'class': 'rag-head', text: 'Categories: tick to show, type a new name, move to reorder' }), cats,
      sers ? h('h4', { 'class': 'rag-head', text: 'Series' }) : null, sers,
      h('small', { 'class': 'hint', text: 'Changing the categories or split-by column resets the lists on the next open. ' + (run ? 'This chart came from a chart layout: Edit layout redoes the whole layout (titles, highlights, callouts) with other columns.' : '') })
    ].filter(Boolean));
    MS.dialog({ title: 'Reshape chart · ' + MS.charts.nameOf(key), wide: true, enterSubmits: false, body: body,
      buttons: (run ? [{ label: 'Edit layout…', value: 'layout' }] : []).concat([{ label: 'Cancel', value: null }, { label: 'Apply', primary: true, value: 'apply' }]) }).then(function (v) {
      if (v === 'layout') return MS.layouts.editDialog(key);
      if (v !== 'apply') return;
      var fv = f.values(), c = cats.read(), s = sers ? sers.read() : null, sameBy = fv.by === b.levels[0], sameSer = (fv.series || '') === (b.series || '');
      var a = { chart: key, by: fv.by, series: fv.series || null, measure: fv.agg === 'count' ? null : (fv.measure || null), agg: fv.agg, sort: fv.sort, top: fv.top || null, percent: !!fv.percent, where: wh.read(),
        hide: sameBy ? c.hide : null, order: sameBy ? c.order : null, only: null, rename: Object.assign({}, sameBy ? c.rename : {}, s && sameSer ? s.rename : {}),
        series_hide: s && sameSer ? s.hide : null, series_order: s && sameSer ? s.order : null, series_only: null };
      if (cs.native && fv.type !== type) a.type = fv.type;
      if (/^(scatter|bubble)$/.test(fv.type)) { a.x = fv.x || null; a.y = fv.y || null; a.size = fv.type === 'bubble' ? fv.size || null : null; }
      if (!a.where.length) a.where = null;
      if (!Object.keys(a.rename).length) a.rename = null;
      return MS.api.run('chart_edit', a).then(function () { MS.toast('Chart reshaped. Ctrl+Z undoes it.', 'ok'); }, function (e) { MS.toast(e.message, 'error', 8000); });
    });
  };
})(window.MS);
