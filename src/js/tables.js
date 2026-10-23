/* Colour rules for tables (conditional formatting, as in Excel): red / amber / green thresholds,
   colour scales, data bars, top / bottom N and "if the value is…" rules. The rules live in the
   dashboard's state and the runtime applies them, so they follow filters and work in the export. */
(function (MS) {
  'use strict';
  var T = MS.tables = {}, h = MS.h;
  function rt() { return MS.rt(); }

  T.TYPES = [
    { value: 'rag', label: 'Red / amber / green by thresholds' },
    { value: 'scale', label: 'Colour scale (low to high)' },
    { value: 'bars', label: 'Data bars' },
    { value: 'rule', label: 'Highlight cells if…' },
    { value: 'top', label: 'Highlight the top N' },
    { value: 'bottom', label: 'Highlight the bottom N' }
  ];
  var OPS = [['gt', 'is greater than'], ['ge', 'is at least'], ['lt', 'is less than'], ['le', 'is at most'], ['between', 'is between'], ['eq', 'equals'], ['ne', 'is not'], ['contains', 'contains text'], ['blank', 'is blank']];
  T.describe = function (r) {
    var c = '“' + r.col + '”';
    switch (r.type) {
      case 'rag': return c + ': green ' + (r.higher === false ? '≤ ' : '≥ ') + r.value + ', amber ' + (r.higher === false ? '≤ ' : '≥ ') + (r.value2 || r.value) + ', else red';
      case 'scale': return c + ': colour scale, ' + (r.higher === false ? 'low is good' : 'high is good');
      case 'bars': return c + ': data bars';
      case 'top': return c + ': top ' + (r.n || 3);
      case 'bottom': return c + ': bottom ' + (r.n || 3);
      default: return c + ' ' + ((OPS.filter(function (o) { return o[0] === r.op; })[0] || OPS[0])[1]) + (r.op === 'blank' ? '' : ' ' + r.value + (r.op === 'between' ? ' and ' + r.value2 : ''));
    }
  };
  T.rulesOf = function (table) { var r = rt(); return ((r.state.tableRules || {})[r.tableKey(table)] || []).slice(); };
  T.setRules = function (table, rules, label) {
    var r = rt(), key = r.tableKey(table);
    MS.history.state(label || 'Table colour rules', function (s) { s.tableRules = s.tableRules || {}; if (rules && rules.length) s.tableRules[key] = JSON.parse(JSON.stringify(rules)); else delete s.tableRules[key]; });
    r.applyTableRules();
  };
  T.addRule = function (table, rule) { var rules = T.rulesOf(table); rules.push(rule); T.setRules(table, rules, 'Add table colour rule'); return rules; };
  // A good first rule for a column: R/A/G around its average, or a colour scale.
  T.suggest = function (table, col) {
    var r = rt(), cols = r.tableColumns(table), ci = cols.indexOf(col), vals = [];
    Array.prototype.forEach.call(table.rows, function (row, i) { if (!i) return; var c = row.cells[ci]; var v = c ? r.cellNumber(c.textContent) : null; if (v !== null) vals.push(v); });
    if (!vals.length) return { col: col, type: 'rule', op: 'contains', value: '', color: '#ffeb9c' };
    vals.sort(function (a, b) { return a - b; });
    var q = function (p) { return vals[Math.min(vals.length - 1, Math.floor(p * vals.length))]; };
    var round = function (v) { var m = Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.abs(v) || 1)) - 1)); return Math.round(v / m) * m; };
    return { col: col, type: 'rag', value: String(round(q(0.66))), value2: String(round(q(0.33))), higher: !/loss|cost|claim|expense|delay|backlog|ratio|days|error|churn/i.test(col) };
  };

  T.rulesDialog = function (table) {
    var r = rt(); if (!r) return MS.toast('Turn off Safe mode to add colour rules.', 'warn');
    table = table || (MS.sel && MS.sel.closest && MS.sel.closest('table'));
    if (!table) return MS.toast('Select a table (click a cell) first.', 'warn');
    var cols = r.tableColumns(table), rules = T.rulesOf(table), before = JSON.stringify(rules);
    var list = h('div', { 'class': 'list rule-list' }), form = h('div', { 'class': 'rule-form' });
    var preview = function () { var key = r.tableKey(table); r.state.tableRules[key] = rules; if (!rules.length) delete r.state.tableRules[key]; r.applyTableRules(); };
    function draw() {
      list.innerHTML = '';
      if (!rules.length) list.appendChild(h('p', { 'class': 'muted', text: 'No rules yet. Add one below; the table shows it straight away.' }));
      rules.forEach(function (x, i) {
        list.appendChild(h('div', { 'class': 'list-row' }, [h('span', { 'class': 'rule-sw', style: { background: x.type === 'rag' ? 'linear-gradient(90deg,#c6efce 33%,#ffeb9c 33% 66%,#ffc7ce 66%)' : x.type === 'scale' ? 'linear-gradient(90deg,#f8696b,#ffeb84,#63be7b)' : x.type === 'bars' ? 'linear-gradient(90deg,' + (x.color || '#9ec5fe') + ' 60%,transparent 60%)' : (x.color || '#ffeb9c') } }),
          h('span', { 'class': 'grow', text: T.describe(x) }),
          h('button', { 'class': 'icon-btn', title: 'Move up', disabled: !i, onclick: function () { rules.splice(i - 1, 0, rules.splice(i, 1)[0]); draw(); preview(); } }, ['↑']),
          h('button', { 'class': 'icon-btn', title: 'Remove this rule', onclick: function () { rules.splice(i, 1); draw(); preview(); } }, ['🗑'])]));
      });
    }
    var f = MS.form([
      { key: 'col', label: 'Column', type: 'select', options: cols.map(function (c) { return { value: c, label: c || '(no heading)' }; }), value: cols[1] || cols[0] },
      { key: 'type', label: 'Rule', type: 'select', options: T.TYPES, value: 'rag' },
      { key: 'op', label: 'When the value', type: 'select', options: OPS.map(function (o) { return { value: o[0], label: o[1] }; }) },
      { key: 'value', label: 'Value', value: '' },
      { key: 'value2', label: 'And', value: '' },
      { key: 'n', label: 'How many', type: 'number', value: 3, min: 1 },
      { key: 'higher', label: 'Higher is better', type: 'checkbox', value: true },
      { key: 'color', label: 'Fill colour', type: 'color', value: '#ffeb9c' },
      { key: 'bold', label: 'Bold text', type: 'checkbox' }
    ], function (k) { if (k === 'col' || k === 'type') { fill(k === 'col'); } shape(); });
    function lab(k) { return f.inputs[k].closest('label'); }
    function shape() {
      var t = f.inputs.type.value, op = f.inputs.op.value;
      var show = { op: t === 'rule', value: t === 'rule' && op !== 'blank' || t === 'rag', value2: t === 'rule' && op === 'between' || t === 'rag', n: t === 'top' || t === 'bottom', higher: t === 'rag' || t === 'scale', color: t === 'rule' || t === 'bars' || t === 'top' || t === 'bottom', bold: t === 'rule' || t === 'top' || t === 'bottom' };
      Object.keys(show).forEach(function (k) { lab(k).style.display = show[k] ? '' : 'none'; });
      lab('value').querySelector('span').textContent = t === 'rag' ? 'Green when at least' : 'Value';
      lab('value2').querySelector('span').textContent = t === 'rag' ? 'Amber when at least' : 'And';
      if (t === 'rag') { lab('value').querySelector('span').textContent = f.inputs.higher.checked ? 'Green when at least' : 'Green when at most'; lab('value2').querySelector('span').textContent = f.inputs.higher.checked ? 'Amber when at least' : 'Amber when at most'; }
    }
    f.inputs.higher.addEventListener('change', shape);
    function fill(colChanged) {
      if (f.inputs.type.value !== 'rag' && !colChanged) return;
      var s = T.suggest(table, f.inputs.col.value);
      if (s.type === 'rag') { f.inputs.value.value = s.value; f.inputs.value2.value = s.value2; f.inputs.higher.checked = s.higher; }
    }
    fill(true); shape();
    form.appendChild(f);
    form.appendChild(h('div', { 'class': 'row gap' }, [h('button', { 'class': 'btn', type: 'button', onclick: function () {
      var v = f.values(), rule = { col: v.col, type: v.type };
      if (v.type === 'rule') { rule.op = v.op; rule.value = v.value; if (v.op === 'between') rule.value2 = v.value2; rule.color = v.color; if (v.bold) rule.bold = true; if ((rule.op !== 'blank' && rule.op !== 'contains') && rt().cellNumber(v.value) === null && !/eq|ne/.test(rule.op)) return MS.dialogError('Type a number in Value, for example 25 or 1.5M.'); }
      if (v.type === 'rag') { if (rt().cellNumber(v.value) === null) return MS.dialogError('Type the green threshold as a number, for example 80.'); rule.value = v.value; rule.value2 = v.value2 || v.value; rule.higher = v.higher; }
      if (v.type === 'scale') rule.higher = v.higher;
      if (v.type === 'bars') rule.color = v.color;
      if (v.type === 'top' || v.type === 'bottom') { rule.n = v.n || 3; rule.color = v.color; if (v.bold) rule.bold = true; }
      MS.dialogError(''); rules.push(rule); draw(); preview();
    } }, ['＋ Add rule'])]));
    draw();
    MS.dialog({ title: '🎨 Table colour rules', sub: 'Colours follow the numbers: they update with filters and stay in the exported file.', wide: true, enterSubmits: false,
      body: h('div', { 'class': 'two-col' }, [h('div', {}, [h('div', { 'class': 'muted small', text: 'Rules (applied top to bottom)' }), list]), form]),
      buttons: [{ label: 'Clear all', danger: true, value: 'clear' }, { label: 'Cancel', value: null }, { label: 'Save rules', primary: true, value: 'save' }] }).then(function (v) {
      var key = r.tableKey(table);
      // put back what was there, then record the change once (so Undo works)
      var orig = JSON.parse(before); if (orig.length) r.state.tableRules[key] = orig; else delete r.state.tableRules[key];
      if (v === 'save' && JSON.stringify(rules) !== before) T.setRules(table, rules);
      else if (v === 'clear') T.setRules(table, [], 'Clear table colour rules');
      else r.applyTableRules();
    });
  };
})(window.MS);
