/* Testing, full coverage: test every part of the dashboard, not a sample.
   - Every bar and point is hovered and its pop-up must show its own value.
   - Every choice of every drop-down (the dashboard's own and the filter pane) is picked; each must
     change something, raise no errors and keep the KPI cards in step with the charts.
   - Every drill-down, check box, button and tab (at laptop, tablet and phone width); table totals and sorting.
   - Locked-in numbers (state.tests.baseline), from today's dashboard or from an Excel / CSV of the
     source figures, so "shows the right numbers" is checked automatically.
   - A coverage report: every part found and the test cases that touch it. */
(function (MS) {
  'use strict';
  var h = MS.h, Q = MS.qa, D = Q.drv, X = Q.deep = {};
  function rt() { return MS.rt(); }
  function cdoc() { return MS.child.doc; }
  function low(x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function norm(x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim(); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  var CAP = { points: 60, series: 6, options: 25, drill: 20, buttons: 60, checks: 30, tables: 20 };
  X.CAP = CAP;

  /* ---------------------------------------------------------------- numbers */
  var NUM = /[-+]?[₹$€£¥]?\s?\(?\d[\d,]*(?:\.\d+)?\)?\s?(?:%|crore|cr|lakh|lakhs|l|bn|mn|k|m|b)?(?![a-z])/gi;
  function numbersIn(text) {
    var out = [], m; NUM.lastIndex = 0;
    while ((m = NUM.exec(String(text || '')))) { var p = MS.numcheck && MS.numcheck.parse(m[0]); if (p && isFinite(p.v)) out.push(p); }
    return out;
  }
  // Does a number shown on screen (with its own rounding) stand for this value?
  function same(p, v, rel) {
    if (v == null || !isFinite(+v)) return false;
    v = +v; var tol = Math.max(p.tol || 0, Math.abs(v) * (rel || 0.005), 1e-9);
    return Math.abs(p.v - v) <= tol || (p.pct && Math.abs(p.v - v * 100) <= Math.max(p.tol || 0, Math.abs(v * 100) * 0.005));
  }
  X.numbersIn = numbersIn; X.same = same;

  /* ---------------------------------------------------------------- locked-in numbers */
  function plan() { return Q.plan(); }
  function edit(label, fn) { Q.editPlan(label, fn); }
  X.legacyBaseline = function () { var b = plan().baseline; return !!(b && b.from === 'file' && b.schema !== 2); };
  X.baseline = function () { return X.legacyBaseline() ? null : plan().baseline || null; };
  // Today's numbers: every chart's categories and values, and every KPI card.
  X.capture = function () {
    var r = rt(), charts = {};
    r.charts().forEach(function (c) {
      var d = r.chartData(c.key, true); if (!d || !d.labels || !d.labels.length) return;
      charts[c.key] = { name: MS.charts.nameOf(c.key), labels: d.labels.map(String), series: d.series.map(function (s) { return { name: s.name, values: s.values.map(function (v) { return v == null || !isFinite(+v) ? null : +v; }) }; }) };
    });
    return { schema: 2, at: new Date().toISOString(), from: 'dashboard', charts: charts, kpis: Q.kpis().map(function (k) { return { label: k.label, value: k.value, ref: MS.api.refOf(k.el) }; }) };
  };
  X.lock = function () {
    var b = X.capture();
    edit('Lock in the numbers', function (T) { T.baseline = b; });
    return { charts: Object.keys(b.charts).length, kpis: b.kpis.length, at: b.at };
  };
  X.clearBaseline = function () { edit('Remove the locked-in numbers', function (T) { delete T.baseline; }); };
  // Rows for Excel: What | Category | Series | Value (KPI cards have no category).
  X.rows = function (b) {
    b = b || X.baseline() || X.capture(); var rows = [];
    Object.keys(b.charts).forEach(function (k) {
      var c = b.charts[k];
      c.series.forEach(function (s) { c.labels.forEach(function (l, i) { if (s.values[i] != null) rows.push({ What: c.name, Category: l, Series: c.series.length > 1 ? s.name : '', Value: s.values[i], Ref: k }); }); });
    });
    b.kpis.forEach(function (k) { rows.push({ What: 'KPI: ' + k.label, Category: '', Series: '', Value: k.value, Ref: k.ref || '' }); });
    return rows;
  };
  // A source baseline is sparse. Dashboard values describe the available targets, never the expected values.
  X.importRows = function (rows, source) {
    var now = X.capture(), b = { schema: 2, at: now.at, from: 'file', source: source || 'Imported rows', charts: {}, kpis: [] };
    var matched = Object.create(null), miss = [];
    function unmatched(what, why) { miss.push(what + (why ? ': ' + why : '')); }
    (rows || []).forEach(function (row) {
      var g = {}; Object.keys(row).forEach(function (k) { g[low(k)] = row[k]; });
      var what = norm(g.what || g.chart || g.kpi || g.item || ''), val = g.value != null ? g.value : g.expected;
      if (!what || val == null || val === '') return;
      var km = /^kpi\s*[:\-]\s*(.+)$/i.exec(what);
      var keys = Object.keys(now.charts).filter(function (k) { return low(k) === low(g.ref || what) || (!g.ref && low(now.charts[k].name) === low(what)); });
      if (km || (!keys.length && !g.category && !g.ref)) {
        var lab = low(km ? km[1] : what), ks = now.kpis.filter(function (x) { return g.ref ? low(x.ref) === low(g.ref) : low(x.label) === lab; });
        if (ks.length !== 1) return unmatched(what, ks.length ? 'ambiguous KPI name' : 'not found');
        var kid = 'kpi:' + (ks[0].ref || lab);
        if (matched[kid]) return unmatched(what, 'duplicate expectation');
        matched[kid] = true; b.kpis.push({ label: ks[0].label, ref: ks[0].ref, value: String(val) }); return;
      }
      if (keys.length !== 1) return unmatched(what, keys.length ? 'ambiguous chart name; use the Ref from the template' : 'not found');
      var key = keys[0], c = now.charts[key], label = low(g.category), i = c.labels.map(low).indexOf(label);
      var names = c.series.map(function (x) { return low(x.name); }), si = g.series ? names.indexOf(low(g.series)) : c.series.length === 1 ? 0 : -1;
      if (i < 0 || si < 0 || c.labels.map(low).lastIndexOf(label) !== i || (g.series && names.lastIndexOf(low(g.series)) !== si)) return unmatched(what + ' › ' + g.category, 'category or series missing or ambiguous');
      var num = typeof val === 'number' ? val : (MS.numcheck.parse(String(val)) || {}).v;
      if (num == null || !isFinite(num)) return unmatched(what + ' › ' + g.category, 'not a number');
      var id = key + ':' + si + ':' + i;
      if (matched[id]) return unmatched(what + ' › ' + g.category, 'duplicate expectation');
      matched[id] = true;
      if (!b.charts[key]) b.charts[key] = { name: c.name, labels: c.labels, series: c.series.map(function (se) { return { name: se.name, values: c.labels.map(function () { return null; }) }; }) };
      b.charts[key].series[si].values[i] = num;
    });
    var n = Object.keys(matched).length;
    if (n) edit('Import the expected numbers', function (T) { T.baseline = b; });
    return { matched: n, notFound: miss, source: b.source };
  };
  X.importFile = function (file) {
    var isCsv = /\.csv$/i.test(file.name);
    return (isCsv ? MS.readFile(file).then(function (t) { return csvRows(t); }) : MS.lib('xlsx').then(function (XL) {
      return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { try { var wb = XL.read(new Uint8Array(fr.result), { type: 'array' }); res(XL.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })); } catch (e) { rej(e); } }; fr.onerror = rej; fr.readAsArrayBuffer(file); });
    })).then(function (rows) { return X.importRows(rows, file.name); });
  };
  function csvRows(t) {
    var lines = String(t).replace(/\r/g, '').split('\n').filter(function (l) { return l.trim(); });
    var split = function (l) { var out = [], cur = '', q = false; for (var i = 0; i < l.length; i++) { var ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
    var head = split(lines.shift() || '');
    return lines.map(function (l) { var c = split(l), o = {}; head.forEach(function (k, i) { o[k.trim()] = (c[i] || '').trim(); }); return o; });
  }
  X.xlsx = function () {
    return MS.lib('xlsx').then(function (XL) {
      var wb = XL.utils.book_new(), b = X.baseline(), rows = X.rows();
      if (b && b.from === 'file') {
        var map = Object.create(null);
        function key(r) { return JSON.stringify([r.Ref || r.What, r.Category, r.Series]); }
        rows.forEach(function (r) { map[key(r)] = r.Value; });
        rows = X.rows(X.capture()).map(function (r) { r.Value = map[key(r)] == null ? '' : map[key(r)]; return r; });
      }
      var ws = XL.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 34 }, { wch: 24 }, { wch: 18 }, { wch: 16 }, { wch: 12 }];
      XL.utils.book_append_sheet(wb, ws, 'Expected numbers');
      XL.utils.book_append_sheet(wb, XL.utils.json_to_sheet([{ How: 'Change the Value column to the figures from your source report, keep What / Category / Series / Ref as they are, save, then Testing › Numbers › Import expected numbers.' }, { How: 'KPI cards are the rows that start with "KPI:". Their Value is the text the card should show, e.g. $1.2M or 16.1%.' }]), 'How to use');
      return XL.write(wb, { type: 'array', bookType: 'xlsx' });
    });
  };

  /* ---------------------------------------------------------------- step runners */
  function chartOf(target) { var el = D.find(target), r = rt(), c = r.chartOf(el) || r.charts().filter(function (x) { return el.contains(x.el); })[0]; if (!c) throw new Error(D.describe(el) + ' is not a chart.'); return c; }
  function list(a, n) { return a.slice(0, n).join('; ') + (a.length > n ? '; and ' + (a.length - n) + ' more' : ''); }

  // Hover every point; the pop-up must name it and show its value.
  Q.STEPS.expect_points = function (s, pass, fail) {
    var c = chartOf(s.target), r = rt(), d = r.chartData(c.key, true) || { labels: [], series: [] }, name = MS.charts.nameOf(c.key);
    var pie = /pie|doughnut|donut/i.test((r.chartInfo(c.key) || {}).type || '');
    var jobs = [], bad = [], ok = 0;
    d.series.slice(0, CAP.series).forEach(function (se, si) { d.labels.slice(0, CAP.points).forEach(function (l, i) { if (se.values[i] != null) jobs.push({ si: si, i: i, label: String(l), v: +se.values[i], series: se.name }); }); });
    if (!jobs.length) return fail('“' + name + '” has no points to hover.');
    var totalPoints = d.series.reduce(function (n, se) { return n + se.values.filter(function (v) { return v != null; }).length; }, 0);
    var total = pie ? d.series[0].values.reduce(function (a, v) { return a + (+v || 0); }, 0) : 0;
    var chain = Promise.resolve(); X.burst = true;
    jobs.forEach(function (j) {
      chain = chain.then(function () {
        Q.checkRun();
        return D.hover(c.el, { point: j.i, series: j.si, wait: 140 }).then(function (x) {
          var txt = (x.tooltip || []).map(function (q) { return q.text; }).join(' / ');
          var where = j.label + (d.series.length > 1 ? ' (' + j.series + ')' : '');
          if (!txt) { bad.push(where + ': no pop-up'); return; }
          var nums = numbersIn(txt), hit = nums.some(function (p) { return same(p, j.v) || (pie && total && same(p, j.v / total * 100, 0.02)); });
          if (low(txt).indexOf(low(j.label)) < 0 && !(d.labels.length === 1)) bad.push(where + ': the pop-up does not name it (“' + txt.slice(0, 80) + '”)');
          else if (!hit) bad.push(where + ': expected ' + fmt(j.v) + ', the pop-up says “' + txt.slice(0, 80) + '”');
          else ok++;
        }, function (e) { bad.push(j.label + ': ' + e.message); });
      });
    });
    return chain.then(function () { X.burst = false; return bad.length ? fail(bad.length + ' of ' + jobs.length + ' points wrong: ' + list(bad, 6)) : pass(ok + ' of ' + totalPoints + ' points checked; checked values match', { checked: ok, total: totalPoints, partial: ok < totalPoints }); }, function (e) { X.burst = false; throw e; });
  };
  function fmt(v) { return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : String(Math.round(v * 1000) / 1000); }

  // Double-click every category: the chart drills down (or opens the records) and comes back.
  Q.STEPS.expect_drill_all = function (s, pass, fail) {
    var c = chartOf(s.target), r = rt(), name = MS.charts.nameOf(c.key), d = r.chartData(c.key, true) || { labels: [] };
    var labels = d.labels.slice(0, CAP.drill).map(String), bad = [], ok = 0, chain = Promise.resolve(); X.burst = true;
    labels.forEach(function (l, i) {
      chain = chain.then(function () {
        Q.checkRun();
        var before = D.state(), depth = (r.drill[c.key] || []).length;
        return D.click(c.el, { point: i, double: true, wait: 300 }).then(function () {
          var deeper = (r.drill[c.key] || []).length > depth, modal = cdoc().querySelector('.ms-modal-wrap'), ch = D.changes(before);
          if (!deeper && !modal && ch[0] === 'nothing visible changed') bad.push(l + ': nothing happened');
          else ok++;
          if (modal) modal.remove();
          if (deeper) { r.drill[c.key].length = depth; r.refresh(); }
          return wait(150);
        }, function (e) { bad.push(l + ': ' + e.message); });
      });
    });
    return chain.then(function () { X.burst = false; return bad.length ? fail(bad.length + ' of ' + labels.length + ' did not drill: ' + list(bad, 6)) : pass(ok + ' of ' + d.labels.length + ' categories checked; checked drill-downs work', { checked: ok, total: d.labels.length, partial: ok < d.labels.length }); }, function (e) { X.burst = false; throw e; });
  };

  function optionsOf(el) { return Array.prototype.slice.call(el.options || []).filter(function (o) { return !o.disabled && !(o.parentNode.tagName === 'OPTGROUP' && o.parentNode.disabled) && o.value !== el.value; }); }

  // Pick alternatives to the current choice in a drop-down: each must change something, raise no errors, and keep KPI cards and charts in step.
  Q.STEPS.try_options = function (s, pass, fail) {
    var el = D.find(s.target); if (el.tagName !== 'SELECT') el = el.querySelector && el.querySelector('select') || el;
    if (el.tagName !== 'SELECT') return fail(D.describe(el) + ' is not a drop-down list.');
    var orig = el.value, alternatives = optionsOf(el), opts = alternatives.slice(0, CAP.options);
    var bad = [], ok = 0, chain = Promise.resolve(), errs0 = count();
    function count() { var e = D.errors(); return e.scriptErrors.length + e.consoleErrors.length; }
    opts.forEach(function (o) {
      chain = chain.then(function () {
        Q.checkRun();
        var before = D.state(), e0 = count();
        return D.select(s.target, o.value).then(function () {
          var ch = D.changes(before), e1 = count(), txt = norm(o.textContent), why = [];
          if (e1 > e0) why.push((e1 - e0) + ' script error(s): ' + D.errors().scriptErrors.concat(D.errors().consoleErrors).slice(-1)[0]);
          if (ch[0] === 'nothing visible changed') why.push('nothing changed');
          if (MS.numcheck) { var diff = MS.numcheck.run().filter(function (q) { return q.status === 'diff'; }); if (diff.length) why.push(diff.map(function (q) { return q.what + ' shows ' + q.shown + ' but ' + q.against + ' adds up to ' + q.expected; }).join('; ')); }
          if (why.length) bad.push('“' + txt + '”: ' + why.join(', ')); else ok++;
        }, function (e) { bad.push('“' + norm(o.textContent) + '”: ' + e.message); });
      });
    });
    return chain.finally(function () {
      if (MS.child && MS.child.doc === el.ownerDocument) return Promise.resolve().then(function () { return D.select(s.target, orig); }).catch(function () {});
    }).then(function () {
      var n = opts.length;
      if (!n) return fail('The list has only one choice.');
      return bad.length ? fail(bad.length + ' of ' + n + ' choices have problems: ' + list(bad, 5)) : pass(ok + ' of ' + alternatives.length + ' alternatives checked' + (count() > errs0 ? '' : ', no errors observed'), { checked: ok, total: alternatives.length, partial: ok < alternatives.length });
    });
  };

  // Table totals: a "Total" row equals the sum of the rows above it, column by column.
  Q.STEPS.expect_table_totals = function (s, pass, fail) {
    var t = D.find(s.target); if (t.tagName !== 'TABLE') t = t.querySelector('table') || t;
    var rows = Array.prototype.slice.call(t.tBodies.length ? t.tBodies[0].rows : t.rows).concat(t.tFoot ? Array.prototype.slice.call(t.tFoot.rows) : []);
    var totals = rows.filter(function (r) { return /^(grand\s+)?total\b/i.test(norm(r.cells[0] && r.cells[0].textContent)); });
    var widths = rows.map(function (r) { return r.cells.length; }), w0 = Math.max.apply(null, widths.concat([0]));
    var ragged = rows.filter(function (r) { return r.cells.length < w0 && !r.querySelector('[colspan]'); }).length;
    if (!totals.length) return ragged ? fail(ragged + ' row(s) have fewer cells than the others') : pass('No total row to verify; ' + rows.length + ' rows have cells.', { partial: true });
    var tot = totals[totals.length - 1], body = rows.slice(0, rows.indexOf(tot)).filter(function (r) { return totals.indexOf(r) < 0; }), bad = [], n = 0;
    for (var ci = 1; ci < tot.cells.length; ci++) {
      var tp = numbersIn(tot.cells[ci].textContent)[0]; if (!tp) continue;
      var vals = body.map(function (r) { return r.cells[ci] && numbersIn(r.cells[ci].textContent)[0]; }).filter(Boolean); if (!vals.length || tp.pct) continue;
      var sum = vals.reduce(function (a, p) { return a + p.v; }, 0), tol = Math.max(tp.tol || 0, Math.abs(sum) * 0.005) + vals.reduce(function (a, p) { return a + (p.tol || 0); }, 0);
      n++; if (Math.abs(sum - tp.v) > tol) bad.push(norm((t.tHead && t.tHead.rows[0] && t.tHead.rows[0].cells[ci] || {}).textContent || 'column ' + (ci + 1)) + ': total shows ' + norm(tot.cells[ci].textContent) + ', the rows add up to ' + fmt(sum));
    }
    return bad.length ? fail(list(bad, 5)) : pass(n ? n + ' total(s) add up' : 'no number columns to add');
  };
  // Sorting: clicking a column heading reorders the rows.
  Q.STEPS.expect_sort = function (s, pass, fail) {
    var t = D.find(s.target); if (t.tagName !== 'TABLE') t = t.querySelector('table') || t;
    var ths = Array.prototype.slice.call(t.querySelectorAll('thead th, tr:first-child th'));
    var w = MS.child.win, th = ths.filter(function (x) { return x.hasAttribute('aria-sort') || x.onclick || x.querySelector('button') || w.getComputedStyle(x).cursor === 'pointer'; })[0];
    if (!th) return pass('no headings can be clicked to sort');
    var col = Array.prototype.indexOf.call(th.parentNode.cells, th);
    var order = function () { return Array.prototype.map.call(t.tBodies[0] ? t.tBodies[0].rows : [], function (r) { return norm(r.cells[col] && r.cells[col].textContent); }).join('|'); };
    var before = order();
    return D.click(th.querySelector('button') || th, { force: true }).then(function () {
      return order() !== before ? pass('clicking “' + norm(th.textContent) + '” reorders the rows') : D.click(th.querySelector('button') || th, { force: true }).then(function () { return order() !== before ? pass('clicking “' + norm(th.textContent) + '” reorders the rows') : fail('Clicking “' + norm(th.textContent) + '” did not change the order'); });
    });
  };
  // Today's numbers against the locked-in (or imported) ones.
  Q.STEPS.expect_baseline = function (s, pass, fail) {
    var b = X.baseline(); if (!b) return pass('No trusted expectation. Lock in a snapshot or reimport a source file.', { partial: true });
    var r = rt(), t = String(s.target || ''), el = D.find(t);
    var k = Q.kpis().find(function (item) { return item.el === el; });
    if (k) {
      var ref = MS.api.refOf(k.el), expected = b.kpis.filter(function (item) { return item.ref ? item.ref === ref : low(item.label) === low(k.label); });
      var want = expected.length === 1 ? expected[0] : null;
      if (!want) return pass('No unambiguous expected value was supplied for KPI “' + k.label + '”.', { partial: true });
      var a = numbersIn(k.value)[0], e = numbersIn(want.value)[0];
      var okK = low(k.value) === low(want.value) || (a && e && Math.abs(a.v - e.v) <= Math.max(a.tol, e.tol, Math.abs(e.v) * 0.005));
      return okK ? pass('shows ' + k.value + ', as expected') : fail('Shows ' + k.value + '; expected ' + want.value + (b.from === 'file' ? ' (from your source file)' : ' (locked in ' + b.at.slice(0, 10) + ')'));
    }
    var c = chartOf(t), want2 = b.charts[c.key]; if (!want2) return pass('No expected values were supplied for this chart.', { partial: true });
    var d = r.chartData(c.key, true) || { labels: [], series: [] }, bad = [], n = 0;
    want2.labels.forEach(function (l, i) {
      var j = d.labels.map(String).indexOf(l);
      want2.series.forEach(function (ws, si) {
        var ev = ws.values[i]; if (ev == null) return; n++;
        var cs = d.series.filter(function (x) { return x.name === ws.name; })[0];
        if (j < 0) { bad.push(l + ' is missing'); return; }
        var av = cs && cs.values[j];
        if (av == null || !isFinite(+av) || Math.abs(+av - ev) > Math.max(Math.abs(ev) * 0.005, 1e-9)) bad.push(l + (want2.series.length > 1 ? ' (' + ws.name + ')' : '') + ': ' + (av == null ? 'no value' : fmt(+av)) + ', expected ' + fmt(ev));
      });
    });
    if (b.from !== 'file') d.labels.forEach(function (l) { if (want2.labels.indexOf(String(l)) < 0) bad.push(l + ' is new (not in the expected numbers)'); });
    return bad.length ? fail(bad.length + ' value(s) differ: ' + list(bad, 6)) : pass(n + ' supplied value(s) match' + (b.from === 'file' ? ' your source file; unspecified values were not checked' : ' the snapshot from ' + b.at.slice(0, 10)), { checked: n, from: b.from, source: b.source || null });
  };

  Object.assign(Q.ACTIONS, {
    expect_points: 'Hover every point of a chart; each pop-up must name it and show its value (target chart)',
    expect_drill_all: 'Double-click every category of a chart; each must drill down or show its records (target chart)',
    try_options: 'Pick every choice in a drop-down; each must change something, raise no errors and keep KPI cards and charts in step (target)',
    expect_table_totals: 'A table\'s Total row equals the sum of its rows (target table)',
    expect_sort: 'Clicking a column heading reorders the table (target table)',
    expect_baseline: 'The numbers match the locked-in or imported ones (target chart or kpi)'
  });
  Object.assign(Q.STEP_WORDS, {
    expect_points: function (s, t) { return 'Hover every point on ' + t + ': each pop-up names it and shows its value.'; },
    expect_drill_all: function (s, t) { return 'Double-click every category on ' + t + ': each drills down (or shows its records) and comes back.'; },
    try_options: function (s, t) { return 'Pick every choice in ' + t + ': each changes the dashboard, with no errors, and KPI cards still agree with the charts.'; },
    expect_table_totals: function (s, t) { return 'Check the Total row of ' + t + ' equals the sum of the rows.'; },
    expect_sort: function (s, t) { return 'Click a column heading of ' + t + ': the rows reorder.'; },
    expect_baseline: function (s, t) { return 'Check ' + t + ' matches the expected numbers.'; }
  });

  /* ---------------------------------------------------------------- full test cases */
  function nameOf(e) {
    var lab = e.closest('label'), t = norm(e.getAttribute('aria-label') || (lab && norm(lab.textContent).replace(norm(e.textContent), '')) || e.getAttribute('data-field') || e.name || e.id || e.innerText || e.value || '');
    return t.slice(0, 50) || D.describe(e);
  }
  function buttonName(e) { return norm(e.innerText || e.value || e.getAttribute('aria-label')).slice(0, 50); }
  function tableName(t, i) { return norm((t.caption && t.caption.textContent) || (t.previousElementSibling && t.previousElementSibling.textContent) || 'Table ' + (i + 1)).slice(0, 40); }
  function* partSteps(ctx) {
    var r = rt(), own = function (e) { return !e.closest('#ms-ribbon') && !e.closest('[data-ms-editor]'); };
    var tabs = ctx ? ctx.tabs : Q.tabs(), tabEls = new Set(tabs.map(function (t) { return t.el; }));
    var buttons = [], buttonNames = new Map();
    for (var e of D.all('button,[role=button],input[type=button],input[type=submit]')) {
      yield;
      if (!own(e) || tabEls.has(e) || e.closest('.ms-crumbs,table')) continue;
      var name = buttonName(e);
      if (name) { buttons.push(e); buttonNames.set(e, name); }
    }
    yield;
    return {
      tabs: tabs,
      charts: ctx ? ctx.charts : r.charts(),
      kpis: ctx ? ctx.kpis : Q.kpis(),
      selects: D.all('select').filter(own),
      checks: D.all('input[type=checkbox],input[type=radio]').filter(own),
      buttons: buttons,
      buttonNames: buttonNames,
      links: D.all('a[href]').filter(own),
      tables: D.all('table').filter(function (t) { return own(t) && !t.closest('.ms-modal-wrap'); })
    };
  }
  X.parts = function () { return Q.drain(partSteps()); };
  X.draftSteps = function* (o, ctx) {
    var out = [], r = ctx.runtime, tabs = ctx.tabs;
    var add = function (scenario, type, priority, title, steps, expected, area) { var c = { scenario: scenario, type: type, priority: priority, title: title, steps: steps, expected: expected }; if (area) c.area = area; out.push(c); return c; };
    var b = X.baseline();
    // Locked-in numbers make "the right numbers" automatic, at any depth.
    if (b) {
      var refs = new Set(b.kpis.filter(function (k) { return k.ref; }).map(function (k) { return k.ref; }));
      var labels = new Set(b.kpis.filter(function (k) { return !k.ref; }).map(function (k) { return low(k.label); }));
      for (var c of ctx.charts) {
        yield;
        if (!b.charts[c.key]) continue;
        var item = ctx.chartTargets.get(c), nm = item.name; add('Numbers', 'Data', 'High', '“' + nm + '” matches the expected numbers', Q.openSteps(c.el, tabs, ctx.tabTargets).concat([{ do: 'expect_baseline', target: item.target }]), 'Supplied values match the ' + (b.from === 'file' ? 'source file' : 'snapshot') + '. Unspecified values are not checked.', nm);
      }
      for (var k of ctx.kpis) {
        yield;
        if (!refs.has(MS.api.refOf(k.el)) && !labels.has(low(k.label))) continue;
        var item = ctx.kpiTargets.get(k);
        add('Numbers', 'Data', 'High', 'KPI “' + item.name + '” matches the expected value', Q.openSteps(k.el, tabs, ctx.tabTargets).concat([{ do: 'expect_baseline', target: item.target }]), 'Shows the ' + (b.from === 'file' ? 'source' : 'locked-in') + ' value.', 'KPI ' + k.label);
      }
    }
    if (o.depth !== 'full') return out;
    for (var c of ctx.charts) {
      yield;
      var item = ctx.chartTargets.get(c), nm = item.name, d = ctx.data(c), cs = r.state.charts[c.key] || {}, go = Q.openSteps(c.el, tabs, ctx.tabTargets);
      if (!d.labels.length) continue;
      if (D.canPoint(c)) add('Every point', 'Data', 'High', 'Every point on “' + nm + '” shows its value', go.concat([{ do: 'expect_points', target: item.target }]), 'All ' + Math.min(d.labels.length, CAP.points) + ' categories' + (d.series.length > 1 ? ' × ' + Math.min(d.series.length, CAP.series) + ' series' : '') + ' show a pop-up with their own name and value.', nm);
      if (cs.drill || (cs.binding && cs.binding.levels && cs.binding.levels.length)) add('Every point', 'Interaction', 'Medium', 'Every category of “' + nm + '” drills down', go.concat([{ do: 'expect_drill_all', target: item.target }]), 'Double-clicking any category shows its detail, and the chart comes back.', nm);
    }
    var P = yield* partSteps(ctx);
    var selects = Q.namedTargets(P.selects, nameOf, function (e) { return e; }, '', tabs, true);
    var checks = Q.namedTargets(P.checks, nameOf, function (e) { return e; }, '', tabs, true);
    var buttons = Q.namedTargets(P.buttons, function (e) { return P.buttonNames.get(e); }, function (e) { return e; }, '', tabs, true);
    var tables = Q.namedTargets(P.tables.map(function (e, i) { return { el: e, name: tableName(e, i) }; }), function (t) { return t.name; }, function (t) { return t.el; }, '', tabs, true);
    for (var e of P.selects) {
      yield;
      if (e.disabled || optionsOf(e).length === 0) continue;
      var item = selects.get(e), nm = item.name;
      add('Every choice', 'Interaction', 'High', 'Every choice in “' + nm + '” works', Q.openSteps(e, tabs, ctx.tabTargets).concat([{ do: 'try_options', target: item.target }, { do: 'expect_no_errors' }]), 'Each of the ' + Math.min(e.options.length, CAP.options) + ' choices changes the dashboard, with no errors, and KPI cards still agree with the charts.', 'Drop-down ' + nm);
    }
    for (var e of P.checks.slice(0, CAP.checks)) {
      yield;
      if (e.disabled) continue;
      var item = checks.get(e), nm = item.name, t = item.target;
      add('Every choice', 'Interaction', 'Medium', (e.type === 'radio' ? 'Choosing' : 'Ticking') + ' “' + nm + '” works', Q.openSteps(e, tabs, ctx.tabTargets).concat([{ do: 'click', target: t }, { do: 'expect_changed' }, { do: 'expect_no_errors' }].concat(e.type === 'checkbox' ? [{ do: 'click', target: t }] : [])), 'The dashboard changes, with no errors.', (e.type === 'radio' ? 'Option ' : 'Check box ') + nm);
    }
    for (var e of P.buttons.slice(0, CAP.buttons)) {
      yield;
      if (e.disabled) continue;
      var item = buttons.get(e), nm = item.name, target = item.target;
      add('Every button', 'Interaction', 'Medium', 'The “' + nm + '” button works', Q.openSteps(e, tabs, ctx.tabTargets).concat([{ do: 'click', target: target }, { do: 'expect_no_errors' }, { do: 'expect_changed' }]), 'Clicking it changes something on screen, with no errors.', 'Button ' + nm);
    }
    for (var [table, item] of Array.from(tables).slice(0, CAP.tables)) {
      yield;
      var t = table.el, nm = item.name, tg = item.target;
      add('Tables', 'Data', 'Medium', 'Table “' + nm + '”: totals add up and sorting works', Q.openSteps(t, tabs, ctx.tabTargets).concat([{ do: 'expect_table_totals', target: tg }, { do: 'expect_sort', target: tg }]), 'The Total row equals the sum of the rows; clicking a heading sorts.', 'Table ' + nm);
    }
    [1366, 820, 390].forEach(function (w) {
      var steps = [{ do: 'set_width', value: w }];
      if (tabs.length) tabs.forEach(function (t) { steps.push({ do: 'open_tab', target: ctx.tabTargets.get(t).target }, { do: 'expect_no_overflow' }); }); else steps.push({ do: 'expect_no_overflow' });
      steps.push({ do: 'expect_no_errors' }, { do: 'set_width', value: 'auto' });
      add('Every screen', 'Responsive', w === 390 ? 'Low' : 'Medium', (tabs.length ? 'Every tab fits' : 'The page fits') + ' at ' + w + ' px (' + (w === 1366 ? 'laptop' : w === 820 ? 'tablet' : 'phone') + ')', steps, 'No sideways scroll bar on any tab, and no errors.');
    });
    return out;
  };

  /* ---------------------------------------------------------------- coverage */
  X.coverageSteps = function* () {
    var r = rt(), P = yield* partSteps(), cs = Q.cases(), rows = [], rev = Q.revision();
    var targets = new Map(), byElement = new Map(), issues = new Map();
    P.chartNames = new Map();
    for (var chart of P.charts) { yield; P.chartNames.set(chart, MS.charts.nameOf(chart.key, chart, P.charts)); }
    for (var c of cs) {
      var status = Q.statusOf(c, rev), results = new Map();
      (c.stepResults || []).forEach(function (step) { if (!results.has(step.index)) results.set(step.index, step); });
      for (var [i, s] of c.steps.entries()) {
        yield;
        var target = s.target || (s.do === 'open_tab' ? s.value : null);
        if (!target || ['manual', 'expect_hidden', 'expect_count'].includes(s.do)) continue;
        if (s.do === 'open_tab' && !/^(tab|qa)=/i.test(target)) target = 'tab=' + target;
        if (!targets.has(target)) {
          var el = null, problem = null;
          try { el = D.find(target, { strict: true, parts: P, track: false }); } catch (e) { problem = e.message; }
          targets.set(target, { element: el, problem: problem });
        }
        var resolved = targets.get(target);
        if (resolved.element) {
          if (!byElement.has(resolved.element)) byElement.set(resolved.element, []);
          byElement.get(resolved.element).push({ id: c.id, action: s.do, result: results.get(i), status: status });
        } else if (resolved.problem && !issues.has(target)) {
          issues.set(target, { caseId: c.id, title: c.title, target: Q.targetLabel(target), reason: resolved.problem });
        }
      }
    }
    function row(kind, name, element, actions, limit) {
      var cases = new Set(), planned = false, executed = false, passing = false, stale = false, blocked = false, result = null;
      (byElement.get(element) || []).forEach(function (entry) {
        cases.add(entry.id);
        var thorough = actions.includes(entry.action), step = entry.result;
        if (thorough && !limit) planned = true;
        if (entry.status === 'Stale') stale = true;
        if (step && entry.status !== 'Stale') {
          if (step.detail && step.detail.blocked) { blocked = true; return; }
          executed = true;
          if (step.detail && step.detail.total != null) result = step.detail.checked + ' of ' + step.detail.total + ' checked';
          if (thorough && !limit && entry.status === 'Pass' && step.ok && !(step.detail && step.detail.partial)) passing = true;
        }
      });
      var item = { kind: kind, name: name, cases: Array.from(cases), full: planned, executed: executed, passing: passing, stale: stale, blocked: blocked,
        limit: limit || '', result: result, reason: limit || (planned ? '' : cases.size ? 'Only a representative or manual check is planned.' : 'No case targets this item. Draft tests or add a case.') };
      Object.defineProperty(item, 'element', { value: element });
      rows.push(item);
    }
    var tabNames = Q.namedTargets(P.tabs, function (t) { return t.title; }, function (t) { return t.el; }, '', P.tabs);
    var chartNames = Q.namedTargets(P.charts, function (c) { return P.chartNames.get(c); }, function (c) { return c.el; }, 'chart', P.tabs);
    var kpiNames = Q.namedTargets(P.kpis, function (k) { return k.label; }, function (k) { return k.el; }, 'kpi', P.tabs);
    var selectNames = Q.namedTargets(P.selects, nameOf, function (e) { return e; }, '', P.tabs);
    var checkNames = Q.namedTargets(P.checks, nameOf, function (e) { return e; }, '', P.tabs);
    var buttonNames = Q.namedTargets(P.buttons, function (e) { return P.buttonNames.get(e); }, function (e) { return e; }, '', P.tabs);
    for (var t of P.tabs) { yield; row('Tab', tabNames.get(t).name, t.el, ['open_tab']); }
    for (var c of P.charts) {
      yield;
      var d = r.chartData(c.key, true, c), limit = '';
      if (!d || !d.labels.length) limit = 'No categories available to check.';
      else if (!D.canPoint(c)) limit = 'This chart exposes no automatic tooltip target. Check it by eye.';
      else if (d.labels.length > CAP.points || d.series.length > CAP.series) limit = 'Tooltip limit: ' + CAP.points + ' categories × ' + CAP.series + ' series';
      row('Chart', chartNames.get(c).name, c.el, ['expect_points'], limit);
    }
    for (var k of P.kpis) { yield; row('KPI card', kpiNames.get(k).name, k.el, ['expect_baseline', 'expect_text']); }
    for (var e of P.selects) {
      yield;
      var n = optionsOf(e).length;
      row('Drop-down', selectNames.get(e).name, e, ['try_options'], e.disabled ? 'This control is disabled.' :
        !n ? 'No other enabled choice.' : n > CAP.options ? 'At most ' + CAP.options + ' of ' + n + ' alternatives' : '');
    }
    for (var [i, e] of P.checks.entries()) {
      yield;
      row(e.type === 'radio' ? 'Option' : 'Check box', checkNames.get(e).name, e, ['click'],
        e.disabled ? 'This control is disabled.' : i >= CAP.checks && !byElement.has(e) ? 'Draft limit: first ' + CAP.checks + ' options.' : '');
    }
    for (var [i, e] of P.buttons.entries()) {
      yield;
      row('Button', buttonNames.get(e).name, e, ['click'],
        e.disabled ? 'This control is disabled.' : i >= CAP.buttons && !byElement.has(e) ? 'Draft limit: first ' + CAP.buttons + ' buttons.' : '');
    }
    for (var [i, t] of P.tables.entries()) {
      yield;
      row('Table', tableName(t, i), t, ['expect_table_totals'],
        i >= CAP.tables && !byElement.has(t) ? 'Draft limit: first ' + CAP.tables + ' tables.' : '');
    }
    var chartElements = new Set(P.charts.map(function (c) { return c.el; }));
    for (var canvas of D.all('canvas')) {
      yield;
      if (!chartElements.has(canvas) && !rt().chartOf(canvas)) row('Canvas', canvas.id || 'Unnamed canvas', canvas, [], 'No supported chart adapter recognised this canvas.');
    }
    var full = rows.filter(function (x) { return x.full; }).length, touched = rows.filter(function (x) { return x.cases.length; }).length;
    var ran = rows.filter(function (x) { return x.executed; }).length, passed = rows.filter(function (x) { return x.passing; }).length;
    function pct(n) { return rows.length ? Math.floor(n / rows.length * 100) : 0; }
    return { parts: rows.length, covered: full, touched: touched, percent: pct(full), planned: full, executed: ran, passing: passed, executedPercent: pct(ran), passingPercent: pct(passed), revision: rev, numbersLocked: !!X.baseline(),
      untested: rows.filter(function (x) { return !x.cases.length; }).map(function (x) { return x.kind + ': ' + x.name; }),
      issues: Array.from(issues.values()), partly: rows.filter(function (x) { return x.cases.length && !x.full; }).map(function (x) { return x.kind + ': ' + x.name; }), rows: rows };
  };
  X.coverage = function () { return Q.drain(X.coverageSteps()); };
  X.coverageAsync = async function () {
    var child = MS.child, session = MS.doc && MS.doc.session, revision = session && session.revision;
    function check() {
      if (child !== MS.child || !session || session.revision !== revision) throw Object.assign(new Error('The dashboard or test plan changed. Open coverage again.'), { name: 'AbortError' });
    }
    var coverage = await Q.batches(X.coverageSteps(), check);
    check();
    return coverage;
  };
  function planStatus(x) { return x.full ? 'Planned' : x.cases.length ? 'Partial plan' : 'No case'; }
  function runStatus(x) { return x.passing ? 'Passed' : x.executed ? (x.result || 'Ran; full pass not shown') : x.stale ? 'Stale; rerun' : x.blocked ? 'Blocked' : 'Not run'; }
  X.baselineText = function () {
    var b = X.baseline();
    if (X.legacyBaseline()) return 'Older import: source values cannot be distinguished from dashboard values. Reimport the original source file.';
    if (!b) return 'No expected numbers supplied. Independent verification has not been set up.';
    return (b.from === 'file' ? 'Source: ' + (b.source || 'imported file') + '. ' : 'Dashboard snapshot (regression check). ') + X.rows(b).length + ' expected value(s). Values not supplied are unverified.';
  };
  X.coverageMd = function (head) {
    var C = X.coverage(), L = [head || '## Coverage', '', C.planned + ' of ' + C.parts + ' parts have a complete plan for the checks below; ' + C.executed + ' ran and ' + C.passing + ' passed on this revision. ' + X.baselineText(), '', '| Part | Name | Plan | Run | Test cases |', '|---|---|---|---|---|'];
    C.rows.forEach(function (x) { L.push('| ' + x.kind + ' | ' + String(x.name).replace(/\|/g, '\\|') + ' | ' + planStatus(x) + (x.limit ? ' (' + x.limit + ')' : '') + ' | ' + runStatus(x) + ' | ' + x.cases.join(', ') + ' |'); });
    if (C.issues.length) {
      L.push('', 'Unresolved test targets', '');
      C.issues.forEach(function (x) { L.push('- ' + x.caseId + ' · ' + x.title + ' · ' + x.reason); });
    }
    return L.join('\n') + '\n';
  };
  X.coverageDialog = async function () {
    if (!MS.child || !rt()) return MS.toast('Open a dashboard with scripts enabled first.', 'warn');
    var C;
    try { C = await X.coverageAsync(); } catch (e) { return MS.toast(e.message, 'warn'); }
    var tbl = h('div', { 'class': 'qa-cov' }, C.rows.map(function (x) {
      return h('div', { 'class': 'qa-cov-row' + (x.passing ? ' full' : x.cases.length ? ' part' : ' none') },
        [h('span', { 'class': 'qa-cov-kind', text: x.kind }), h('div', { 'class': 'grow' }, [h('strong', { text: x.name }), h('div', { 'class': 'muted small', text: planStatus(x) + (x.reason ? ' · ' + x.reason : '') })]),
          h('span', { 'class': 'qa-cov-tag', text: runStatus(x) }), h('span', { 'class': 'qa-cov-ids', text: x.cases.slice(0, 6).join(', ') }),
          h('button', { 'class': 'btn sm', 'aria-label': 'Show ' + x.name, onclick: function (e) {
            e.currentTarget.closest('.dlg').querySelector('.dlg-x').click();
            Q.showTarget(x.element).catch(function (err) { MS.toast(err.message, 'warn'); });
          } }, ['Show item'])]);
    }));
    var head = h('div', { 'class': 'guide-metrics' }, [['Planned', C.planned], ['Ran', C.executed], ['Passed', C.passing]].map(function (a) {
      return h('div', {}, [h('strong', { text: a[1] + ' / ' + C.parts }), h('span', { text: a[0] })]);
    }));
    return MS.dialog({ title: '🎯 Test coverage', sub: 'A plan is a list of checks. Only current run results count as executed or passed.', wide: true, enterSubmits: false,
      body: h('div', {}, [head, h('p', { 'class': 'muted small', text: X.baselineText() }),
        C.issues.length ? h('details', { open: true, 'class': 'qa-target-issues' }, [
          h('summary', { text: C.issues.length + ' test target(s) need attention' }),
          h('ul', {}, C.issues.slice(0, 20).map(function (x) { return h('li', { text: x.caseId + ' · ' + x.title + ' · ' + x.reason }); })),
          C.issues.length > 20 ? h('p', { 'class': 'muted', text: 'First 20 shown. The coverage API and test document contain the full list.' }) : null
        ]) : null, tbl,
        h('p', { 'class': 'muted small', text: 'Coverage is limited to the listed parts and check types. Some interactions, links, other filter states and visual details need a person.' })]),
      buttons: [{ label: 'Close', value: null }, { label: 'Draft deeper tests', primary: C.percent < 100, value: 'full' }] }).then(function (v) {
        if (v === 'full') return Q.draftInUI({ depth: 'full' });
      });
  };

  /* ---------------------------------------------------------------- menus */
  X.numbersMenu = function () {
    var b = X.baseline(), base = (MS.doc ? MS.doc.name.replace(/\.html?$/i, '') : 'dashboard') + ' - expected numbers.xlsx';
    return [
      { icon: '🔒', label: b ? 'Lock in today\'s numbers again' : 'Lock in today\'s numbers', title: 'Keep every chart value and KPI card as they are now. Later runs check the numbers have not changed.', run: function () { var x = X.lock(); MS.toast('Locked in ' + x.charts + ' chart(s) and ' + x.kpis + ' KPI card(s).', 'ok', 6000); return Q.draftInUI(); } },
      { icon: '📗', label: 'Download the numbers as Excel', title: 'Fill in the figures from your source report, then import them', run: function () { X.xlsx().then(function (bf) { MS.download(base, new Blob([bf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); }); } },
      { icon: '📥', label: 'Import expected numbers (Excel or CSV)…', title: 'Columns: What (chart or "KPI: name"), Category, Series, Value', run: function () { MS.pickFiles('.xlsx,.xls,.csv').then(function (f) { if (!f[0]) return; X.importFile(f[0]).then(function (res) { MS.toast(res.matched + ' expected number(s) imported' + (res.notFound.length ? '; not found: ' + res.notFound.slice(0, 3).join(', ') + (res.notFound.length > 3 ? '…' : '') : '') + '.', res.notFound.length ? 'warn' : 'ok', 8000); if (res.matched) return Q.draftInUI(); }, function (e) { MS.toast('Could not read the file: ' + e.message, 'error'); }); }); } },
      b ? { icon: '🗑', label: 'Remove the expected numbers', run: function () { X.clearBaseline(); MS.toast('Expected numbers removed.', 'ok'); } } : null
    ].filter(Boolean);
  };
  X.draftMenu = function () {
    return [
      { icon: '✨', label: 'Quick draft', title: 'Representative tests for charts, filters and other parts', run: function () { return Q.draftInUI(); } },
      { icon: '🎯', label: 'Full draft (bounded)', title: 'Deeper checks for charts, controls, tables and layouts; limits and untested parts appear in Coverage', run: function () { return Q.draftInUI({ depth: 'full' }); } },
      '-',
      { icon: '🔢', label: 'Expected numbers', run: function (e) { MS.menu(e && e.currentTarget || MS.$('.qa-tools'), X.numbersMenu()); } },
      { icon: '◔', label: 'Coverage report', run: X.coverageDialog }
    ];
  };

  /* ---------------------------------------------------------------- API (and the MCP tools) */
  MS.api.add('test_baseline', { d: 'Testing: the expected numbers that "right numbers" tests check against. action: get (default) | lock (keep today\'s chart values and KPI cards) | import (rows: [{what: chart name or "KPI: name", category, series, value}], e.g. from the source report) | clear | rows (the numbers as rows, to fill in).', p: { action: ['string', 'get | lock | import | clear | rows'], rows: ['array', 'For import: [{what, category, series, value}]'] },
    f: async function (a) {
      var act = a.action || 'get';
      if (act === 'lock') { var x = X.lock(); x.added = await Q.draftAsync(); return x; }
      if (act === 'import') { var res = X.importRows(a.rows || []); res.added = res.matched ? await Q.draftAsync() : 0; return res; }
      if (act === 'clear') { X.clearBaseline(); return { cleared: true }; }
      if (act === 'rows') return X.rows();
      return X.baseline() || { none: true, note: X.baselineText() };
    } });
  MS.api.add('test_coverage', { d: 'Testing: every part of the dashboard (tabs, charts, KPI cards, drop-downs, check boxes, buttons, tables) and the test cases that touch it, with the percentage covered and what is untested.', p: {}, f: function () { return X.coverageAsync(); } });
})(window.MS);
