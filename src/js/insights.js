/* Checks and reports: plain-language chart summaries, number check (KPI vs chart totals),
   review comments as an Excel tracker (and back), and comparing two versions. */
(function (MS) {
  'use strict';
  var h = MS.h;
  function rt() { return MS.rt(); }
  function need() { if (!MS.child) { MS.toast('Open a dashboard first.', 'warn'); return false; } if (!rt()) { MS.toast('Turn off Safe mode (View tab) first.', 'warn'); return false; } return true; }
  function close() { var w = MS.$('.dlg-wrap'); if (w) w.remove(); }
  function copy(text) {
    var done = function () { MS.toast('Copied. Paste it into an email, Word or PowerPoint.', 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    fallback();
    function fallback() { var t = h('textarea', { style: 'position:fixed;left:-9999px' }); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { MS.toast('Select the text and press Ctrl+C.', 'warn'); } t.remove(); }
  }
  var IN = function (x, d) { return Number(x).toLocaleString('en-IN', { maximumFractionDigits: d == null ? 2 : d }); };

  /* ================================================================ chart summaries */
  var S = MS.summaries = {};
  S.list = function () {
    var r = rt(); if (!r) return [];
    return r.charts().map(function (c) {
      var name = MS.charts.nameOf(c.key), cs = r.state.charts[c.key] || {};
      return { key: c.key, name: name, kind: MS.charts.kindName((r.chartInfo(c.key) || {}).type), summary: r.summarize(c.key, name), show: cs.summary ? cs.summary.show || 'aria' : 'off' };
    });
  };
  // show: 'caption' (text under the chart + screen readers), 'aria' (screen readers only), 'off'
  S.set = function (keys, show) {
    MS.history.state(show === 'off' ? 'Remove chart summaries' : 'Chart summaries', function (s) {
      keys.forEach(function (k) {
        var cs = s.charts[k] = s.charts[k] || {};
        if (show === 'off') delete cs.summary; else cs.summary = { show: show, name: MS.charts.nameOf(k) };
      });
    });
  };
  S.text = function () { return S.list().filter(function (x) { return x.summary; }).map(function (x) { return x.name + '\n' + x.summary; }).join('\n\n'); };
  S.dialog = function () {
    if (!need()) return;
    var items = S.list();
    if (!items.length) return MS.toast('No charts found in this dashboard.', 'warn');
    var OPTS = [{ value: 'off', label: 'Not added' }, { value: 'aria', label: 'Screen readers only' }, { value: 'caption', label: 'Caption under the chart' }];
    var rows = items.map(function (x) {
      var sel = h('select', { 'class': 'inp sm', onchange: function () { S.set([x.key], sel.value); } }, OPTS.map(function (o) { var e = h('option', { value: o.value, text: o.label }); if (o.value === x.show) e.selected = true; return e; }));
      return h('div', { 'class': 'sum-row' }, [
        h('div', { 'class': 'sum-head' }, [h('strong', { text: x.name }), h('small', { 'class': 'muted', text: x.kind }), h('span', { 'class': 'grow' }), sel]),
        h('p', { 'class': 'sum-text', text: x.summary || 'Nothing to summarise (no numbers found).' })
      ]);
    });
    var body = h('div', {}, [
      h('p', { 'class': 'hint', text: 'One or two plain sentences per chart, written from the numbers on screen. Use them in emails, as captions, or for colleagues using screen readers. Captions update when filters change and stay in the exported file.' }),
      h('div', { 'class': 'sum-list' }, rows)
    ]);
    MS.dialog({ title: 'Chart summaries', wide: true, body: body, buttons: [
      { label: 'Close', value: null },
      { label: 'Captions on all charts', value: function () { S.set(items.map(function (x) { return x.key; }), 'caption'); MS.toast('Captions added under ' + items.length + ' chart(s). Ctrl+Z undoes.', 'ok'); return null; } },
      { label: 'Copy all', primary: true, value: function () { copy(S.text()); return false; } }
    ] });
  };

  /* ================================================================ number check */
  var N = MS.numcheck = {};
  var STOP = { total: 1, overall: 1, sum: 1, the: 1, and: 1, for: 1, by: 1, of: 1, in: 1, ytd: 1, mtd: 1, qtd: 1, all: 1, value: 1, values: 1, amount: 1, chart: 1, series: 1, vs: 1, per: 1, to: 1, fy: 1, inr: 1, crore: 1, lakh: 1, cr: 1, rs: 1 };
  function tokens(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2 && !STOP[w] && !/^\d+$/.test(w); }).map(function (w) { return w.replace(/(ies)$/, 'y').replace(/s$/, ''); }); }
  function overlap(a, b) { var n = 0; a.forEach(function (w) { if (b.indexOf(w) >= 0) n++; }); return n; }
  // "₹1.25 Cr" -> { v: 12500000, tol: 50000, pct: false }
  N.parse = function (text) {
    var t = String(text || '').replace(/ /g, ' ').trim();
    var m = t.replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*(crores?|cr\b|lakhs?|lacs?|l\b|k\b|mn\b|m\b|bn\b|b\b|%)?/i);
    if (!m) return null;
    var num = parseFloat(m[1]), unit = (m[2] || '').toLowerCase(), dec = (m[1].split('.')[1] || '').length;
    var scale = /^cr/.test(unit) ? 1e7 : /^(lakh|lac|l$)/.test(unit) ? 1e5 : unit === 'k' ? 1e3 : /^(m|mn)$/.test(unit) ? 1e6 : /^(bn|b)$/.test(unit) ? 1e9 : 1;
    return { v: num * scale, tol: 0.5 * Math.pow(10, -dec) * scale, pct: unit === '%', unit: unit, text: t };
  };
  function kpis() {
    var d = MS.child.doc, out = [], seen = [];
    MS.$$('.ms-kpi', d).forEach(function (k) {
      var v = k.querySelector('.ms-kpi-value'), l = k.querySelector('.ms-kpi-label');
      if (v) { out.push({ el: k, valueEl: v, label: l ? l.textContent.trim() : '', shown: v.textContent.trim(), spec: k.getAttribute('data-ms-kpi') && rt().state.kpis[k.getAttribute('data-ms-kpi')] }); seen.push(k); }
    });
    MS.$$('[class*=kpi],[class*=metric],[class*=stat],[class*=tile]', d).forEach(function (k) {
      if (seen.some(function (s) { return s.contains(k) || k.contains(s); }) || k.closest('[data-ms-editor]')) return;
      var vs = MS.$$('[class*=value],[class*=number],[class*=figure],[class*=amount]', k); if (vs.length !== 1) return; // a row of cards, not one card
      var v = vs[0], l = MS.$$('[class*=label],[class*=title],[class*=name],[class*=caption]', k)[0];
      if (!v || !l || v.contains(l) || l.contains(v) || !/\d/.test(v.textContent) || v.textContent.length > 40) return;
      out.push({ el: k, valueEl: v, label: l.textContent.trim(), shown: v.textContent.trim() }); seen.push(k);
    });
    return out.filter(function (k) { return k.el.offsetParent !== null || k.el.closest('section.ms-tab'); });
  }
  function fmtLike(p, v) {
    if (!p) return IN(v);
    var s = p.unit;
    if (/^cr/.test(s)) return '₹' + IN(v / 1e7) + ' Cr';
    if (/^(lakh|lac|l$)/.test(s)) return '₹' + IN(v / 1e5) + ' L';
    if (s === 'k') return IN(v / 1e3, 1) + 'K';
    if (/^(m|mn)$/.test(s)) return IN(v / 1e6) + 'M';
    return (/₹/.test(p.text) ? '₹' : '') + IN(v, 2);
  }
  function big(v) { var a = Math.abs(v); return a >= 1e7 ? IN(v / 1e7) + ' crore' : a >= 1e5 ? IN(v / 1e5) + ' lakh' : IN(v); }
  function seriesOf(r, key) {
    var d = r.chartData(key, true); if (!d) return [];
    return d.series.map(function (s) {
      var vals = s.values.filter(function (v) { return v != null; });
      return { name: s.name, total: vals.reduce(function (a, b) { return a + b; }, 0), avg: vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null, n: vals.length };
    });
  }
  N.run = function () {
    var r = rt(), charts = r.charts().map(function (c) { var b = (r.state.charts[c.key] || {}).binding; return { key: c.key, name: MS.charts.nameOf(c.key), series: seriesOf(r, c.key), binding: b }; }).filter(function (c) { return c.series.length; });
    var filtered = Object.keys(r.filterValues || {}).some(function (ds) { var fv = r.filterValues[ds]; return Object.keys(fv).some(function (k) { return fv[k] !== '' && fv[k] != null; }); });
    var results = [];
    kpis().forEach(function (k) {
      var p = N.parse(k.shown), kt = tokens(k.label + ' ' + (k.spec && k.spec.measure || ''));
      var res = { kind: 'kpi', what: 'KPI “' + (k.label || k.shown) + '”', shown: k.shown, el: k.valueEl || k.el };
      if (!p) { results.push(Object.assign(res, { status: 'skip', note: 'No number to check.' })); return; }
      if (p.pct) { results.push(Object.assign(res, { status: 'skip', note: 'A percentage: it is not a total of a chart.' })); return; }
      if (k.spec && /^(count|distinct|min|max)$/.test(k.spec.agg || '')) { results.push(Object.assign(res, { status: 'skip', note: 'Counts rows (' + k.spec.agg + '), not a chart total.' })); return; }
      var best = null;
      charts.forEach(function (c) {
        c.series.forEach(function (s) {
          var sc = overlap(kt, tokens(c.name + ' ' + s.name));
          if (k.spec && c.binding && c.binding.dataset === k.spec.dataset && c.binding.measure && c.binding.measure === k.spec.measure) sc += 3;
          if (c.series.length > 1 && !overlap(kt, tokens(s.name)) && sc < 3) return; // a grouped chart: only the matching series
          if (sc > 0 && (!best || sc > best.sc)) best = { sc: sc, c: c, s: s };
        });
      });
      if (!best) { results.push(Object.assign(res, { status: 'skip', note: 'No chart shows the same measure (compared by name).' })); return; }
      var avg = /avg|average|mean|per\b/i.test(k.label) || (k.spec && k.spec.agg === 'avg');
      var target = avg ? best.s.avg : best.s.total, diff = p.v - target, tol = Math.max(p.tol, Math.abs(target) * 0.005);
      res.against = 'chart “' + best.c.name + '”' + (best.c.series.length > 1 ? ' › ' + best.s.name : '') + (avg ? ' (average)' : ' (total)');
      res.chart = best.c.key; res.expected = fmtLike(p, target);
      if (Math.abs(diff) <= tol) res.status = 'ok';
      else {
        res.status = 'diff';
        res.note = 'Differs by ' + fmtLike(p, Math.abs(diff)) + (target ? ' (' + IN(Math.abs(diff) / Math.abs(target) * 100, 1) + '%)' : '') + '.' + (filtered && !(k.spec && best.c.binding) ? ' A filter is on: one of them may not follow it.' : '');
      }
      results.push(res);
    });
    // charts that show the same measure should add up to the same total
    var bySeries = {};
    charts.forEach(function (c) { c.series.forEach(function (s) { var n = String(s.name || '').trim().toLowerCase(); if (!n || /^(series \d+|value|data|count|y)$/.test(n) || /target|budget|plan|last year|ly|prior/i.test(n)) return; (bySeries[n] = bySeries[n] || []).push({ c: c, s: s }); }); });
    Object.keys(bySeries).forEach(function (n) {
      var list = bySeries[n]; if (list.length < 2) return;
      var a = list[0];
      list.slice(1).forEach(function (b) {
        var diff = a.s.total - b.s.total, tol = Math.max(Math.abs(a.s.total), 1) * 0.005;
        var res = { kind: 'charts', what: 'chart “' + a.c.name + '”', against: 'chart “' + b.c.name + '” (' + a.s.name + ')', shown: big(a.s.total), expected: big(b.s.total), chart: b.c.key };
        if (Math.abs(diff) <= tol) res.status = 'ok';
        else { res.status = 'diff'; res.note = 'Both show “' + a.s.name + '” but add up differently (' + IN(Math.abs(diff) / Math.max(Math.abs(b.s.total), 1) * 100, 1) + '% apart). One may be filtered, rounded or missing a category.'; }
        results.push(res);
      });
    });
    var rank = { diff: 0, ok: 1, skip: 2 };
    return results.sort(function (x, y) { return rank[x.status] - rank[y.status]; });
  };
  N.dialog = function () {
    if (!need()) return;
    var res = N.run();
    if (!res.length) return MS.toast('No KPI cards or charts with numbers to compare.', 'warn');
    var diffs = res.filter(function (x) { return x.status === 'diff'; }), oks = res.filter(function (x) { return x.status === 'ok'; });
    var ICON = { ok: '✅', diff: '⚠', skip: '–' };
    var table = h('table', { 'class': 'nc-table' }, [h('tr', {}, ['', 'Number', 'Shows', 'Compared with', 'Adds up to', 'Result'].map(function (t) { return h('th', { text: t }); }))].concat(res.map(function (x) {
      return h('tr', { 'class': 'nc-' + x.status }, [h('td', { text: ICON[x.status] }), h('td', { text: x.what }), h('td', { text: x.shown || '' }), h('td', { text: x.against || '' }), h('td', { text: x.expected || '' }), h('td', { text: x.status === 'ok' ? 'Matches' : x.note || '' })]);
    })));
    var head = h('p', { 'class': 'nc-sum', html: diffs.length ? '<b>' + diffs.length + ' number(s) don\'t add up</b> · ' + oks.length + ' match' : '<b>Everything that could be checked matches</b> (' + oks.length + ' check' + (oks.length === 1 ? '' : 's') + ').' });
    MS.dialog({ title: 'Number check', wide: true, body: h('div', {}, [head, h('p', { 'class': 'hint', text: 'Each KPI card is compared with the chart that shows the same measure (matched by name, or by data for calculated cards), and charts showing the same measure are compared with each other. Rounding on the card is allowed for.' }), h('div', { 'class': 'nc-wrap' }, [table])]),
      buttons: [{ label: 'Close', value: null }].concat(diffs.length ? [{ label: 'Add ' + diffs.length + ' as review comments', primary: true, value: 'cmt' }] : []) }).then(function (v) {
      if (v !== 'cmt') return;
      diffs.forEach(function (x) {
        var text = 'Numbers don\'t add up: ' + x.what + ' shows ' + x.shown + ' but ' + x.against + ' adds up to ' + x.expected + '. ' + (x.note || '') + ' Make them consistent or explain the difference.';
        if (x.el) MS.api.run('add_comment', { ref: MS.api.refOf ? MS.api.refOf(x.el) : null, text: text, type: 'bug', priority: 'must' }).catch(function () {});
        else MS.api.run('add_comment', { chart: x.chart, text: text, type: 'bug', priority: 'must' }).catch(function () {});
      });
      MS.toast(diffs.length + ' comment(s) added. ✨ Prompt turns them into instructions.', 'ok');
    });
  };

  /* ================================================================ comments as an Excel tracker */
  var T = MS.tracker = {};
  var STATUS = ['Open', 'In progress', 'Done', 'Won\'t do'];
  T.rows = function () {
    var R = MS.review, list = R.list();
    return list.map(function (c, i) {
      var x = R.resolveComment ? R.resolveComment(c, i + 1) : { loc: c.loc || {}, topics: [] }, l = x.loc || {};
      var chart = l.chart ? l.chart.name : (l.charts && l.charts.length ? l.charts.join(', ') : '');
      return {
        'No.': i + 1, 'Status': c.status || (c.done ? 'Done' : 'Open'), 'Priority': { must: 'Must', should: 'Should', nice: 'Nice to have' }[c.prio] || 'Should',
        'Type': { change: 'Change', bug: 'Bug', question: 'Question', idea: 'Idea' }[c.type] || 'Change',
        'Tab': l.tab || (c.tab && c.tab.title) || '', 'Section': l.section || (l.sections || []).join(', '), 'Chart': chart,
        'Item': l.kpi ? 'KPI card “' + l.kpi.label + '”' : (l.item || (c.target && c.target.what) || (c.kind === 'area' ? 'screen area' : c.kind === 'interaction' ? 'interaction' : '')),
        'Where': R.trail ? R.trail(l) : '', 'Comment': c.text || '',
        'Done when': (x.topics || []).map(function (t) { return t.done; }).join('; '),
        'Owner': c.owner || '', 'Due': c.due || '', 'Notes': c.notes || '',
        'Added': c.created ? new Date(c.created).toLocaleDateString('en-IN') : '', 'ID': c.id
      };
    });
  };
  T.build = function () {
    return MS.lib('xlsx').then(function (X) {
      var rows = T.rows(), wb = X.utils.book_new();
      var ws = X.utils.json_to_sheet(rows.length ? rows : [{ 'No.': '', Status: '', Priority: '', Type: '', Tab: '', Section: '', Chart: '', Item: '', Where: '', Comment: 'No comments yet', 'Done when': '', Owner: '', Due: '', Notes: '', Added: '', ID: '' }]);
      ws['!cols'] = [5, 11, 12, 9, 16, 18, 24, 22, 40, 50, 40, 14, 11, 30, 11, 12].map(function (w) { return { wch: w }; });
      ws['!autofilter'] = { ref: ws['!ref'] };
      X.utils.book_append_sheet(wb, ws, 'Comments');
      var count = function (key) { var m = {}; rows.forEach(function (r) { var k = r[key] || '(none)'; m[k] = m[k] || { open: 0, done: 0 }; if (/done|won/i.test(r.Status)) m[k].done++; else m[k].open++; }); return Object.keys(m).map(function (k) { return [k, m[k].open, m[k].done, m[k].open + m[k].done]; }); };
      var aoa = [['Review tracker: ' + (MS.doc && MS.doc.name || 'dashboard')], ['Made ' + new Date().toLocaleString('en-IN') + '. Edit Status, Priority, Owner, Due and Notes, then load it back with Review › Tracker › Update from tracker. Keep the ID column.'], [],
        ['By tab', 'Open', 'Closed', 'All']].concat(count('Tab')).concat([[], ['By priority', 'Open', 'Closed', 'All']]).concat(count('Priority')).concat([[], ['Status values', STATUS.join(', ')]]);
      var ss = X.utils.aoa_to_sheet(aoa); ss['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      X.utils.book_append_sheet(wb, ss, 'Summary');
      var out = X.write(wb, { type: 'array', bookType: 'xlsx' });
      return { bytes: out, rows: rows.length, name: (MS.doc && MS.doc.name || 'dashboard').replace(/\.html?$/i, '') + ' - review tracker.xlsx' };
    });
  };
  T.exportFile = function () {
    if (!need()) return;
    if (!MS.review.list().length) return MS.toast('There are no comments yet. Add some from the Review tab.', 'warn');
    T.build().then(function (r) {
      MS.download(r.name, new Blob([r.bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      MS.toast('Saved ' + r.name + ' with ' + r.rows + ' comment(s). Opens in Excel.', 'ok', 6000);
    }).catch(function (e) { MS.toast('Could not make the tracker: ' + e.message, 'error'); });
  };
  // Apply an edited tracker: status, priority, owner, due, notes and comment text, matched by ID.
  T.apply = function (buf) {
    return MS.lib('xlsx').then(function (X) {
      var wb = X.read(buf, { type: 'array' }), ws = wb.Sheets.Comments || wb.Sheets[wb.SheetNames[0]];
      var rows = X.utils.sheet_to_json(ws, { defval: '', raw: false });
      var byId = {}; rows.forEach(function (r) { if (r.ID) byId[String(r.ID).trim()] = r; });
      var changed = 0, unknown = rows.filter(function (r) { return !r.ID && String(r.Comment || '').trim(); }).length;
      var PR = { must: 'must', 'should': 'should', 'nice to have': 'nice', nice: 'nice' };
      MS.history.state('Update comments from tracker', function (s) {
        (s.comments || []).forEach(function (c) {
          var r = byId[c.id]; if (!r) return;
          var before = JSON.stringify(c);
          var st = String(r.Status || '').trim();
          var cur = c.status || (c.done ? 'Done' : 'Open');
          if (st && st.toLowerCase() !== cur.toLowerCase()) { var m = STATUS.filter(function (x) { return x.toLowerCase() === st.toLowerCase(); })[0] || st; c.status = m; c.done = /^(done|won't do|closed|resolved)$/i.test(m); }
          var p = PR[String(r.Priority || '').trim().toLowerCase()]; if (p) c.prio = p;
          ['Owner', 'Due', 'Notes'].forEach(function (k) { var v = String(r[k] || '').trim(); if (v) c[k.toLowerCase()] = v; else delete c[k.toLowerCase()]; });
          var t = String(r.Comment || '').trim(); if (t) c.text = t;
          if (JSON.stringify(c) !== before) changed++;
        });
      });
      MS.emit('comments');
      return { updated: changed, notFound: Object.keys(byId).filter(function (id) { return !MS.review.list().some(function (c) { return c.id === id; }); }).length, newRowsIgnored: unknown };
    });
  };
  T.importFile = function () {
    if (!need()) return;
    MS.pickFiles('.xlsx,.xls,.csv').then(function (f) {
      if (!f[0]) return;
      MS.readFile(f[0], 'buffer').then(function (b) { return T.apply(b); }).then(function (r) {
        MS.toast(r.updated + ' comment(s) updated from the tracker.' + (r.notFound ? ' ' + r.notFound + ' row(s) belong to comments that no longer exist.' : '') + (r.newRowsIgnored ? ' ' + r.newRowsIgnored + ' new row(s) without an ID were skipped: add those in Mothership.' : ''), 'ok', 8000);
      }).catch(function (e) { MS.toast('Could not read the tracker: ' + e.message, 'error'); });
    });
  };

  /* ================================================================ compare two versions */
  var V = MS.compare = {};
  var TEXT_SEL = 'h1,h2,h3,h4,h5,h6,p,li,td,th,figcaption,label,button,summary,dt,dd,.ms-kpi-label,.ms-kpi-value,.ms-kpi-note,.ms-title,.ms-sub,.ms-inference';
  function parse(html) { return new DOMParser().parseFromString(html || '', 'text/html'); }
  V.snapshot = function (html, nameOf) {
    var d = parse(html), st = {};
    try { st = JSON.parse((d.getElementById('ms-state') || {}).textContent || '{}'); } catch (e) {}
    var tabs = Array.prototype.map.call(d.querySelectorAll('section.ms-tab'), function (s) { return { id: s.getAttribute('data-ms-tab'), title: s.getAttribute('data-ms-title') || 'Untitled', hidden: s.hasAttribute('data-ms-hidden') }; });
    var texts = [];
    Array.prototype.forEach.call(d.body ? d.body.querySelectorAll(TEXT_SEL) : [], function (e) {
      if (e.closest('script,style,svg,canvas,[data-ms-editor],#ms-filter-pane') || e.querySelector(TEXT_SEL)) return;
      var t = e.textContent.replace(/\s+/g, ' ').trim(); if (!t) return;
      var tab = e.closest('section.ms-tab');
      texts.push({ t: t, tab: tab ? tab.getAttribute('data-ms-title') : '' });
    });
    var chartName = function (key) {
      var n = nameOf && nameOf(key); if (n) return n;
      var e = d.querySelector('[data-ms-id="' + key + '"],[data-ms-chart="' + key + '"],#' + String(key).replace(/^#/, '').replace(/[^\w-]/g, '')), b = e && e.closest('.ms-block'), tt = b && b.querySelector('.ms-title');
      return tt ? tt.textContent.trim() : key;
    };
    return { state: st, tabs: tabs, texts: texts, chartName: chartName };
  };
  // Longest-common-subsequence diff of two string lists -> [{op:'=',a},{op:'-',a},{op:'+',b}]
  function lcs(a, b) {
    var n = a.length, m = b.length;
    if (n * m > 4e6) { var A = {}, Bm = {}; a.forEach(function (x) { A[x] = 1; }); b.forEach(function (x) { Bm[x] = 1; }); return a.filter(function (x) { return !Bm[x]; }).map(function (x) { return { op: '-', a: x }; }).concat(b.filter(function (x) { return !A[x]; }).map(function (x) { return { op: '+', b: x }; })); }
    var dp = new Array(n + 1); for (var i = 0; i <= n; i++) dp[i] = new Uint32Array(m + 1);
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    var out = []; i = 0; j = 0;
    while (i < n && j < m) { if (a[i] === b[j]) { out.push({ op: '=', a: a[i] }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ op: '-', a: a[i++] }); else out.push({ op: '+', b: b[j++] }); }
    while (i < n) out.push({ op: '-', a: a[i++] }); while (j < m) out.push({ op: '+', b: b[j++] });
    return out;
  }
  var SETTING = { tooltip: 'Pop-up text', style: 'Look', binding: 'Data & drill-down', summary: 'Summary', native: 'Chart type and data', drill: 'Drill-down' };
  function short(v) { if (v == null) return '(none)'; var s = typeof v === 'string' ? v : JSON.stringify(v); return s.length > 90 ? s.slice(0, 87) + '…' : s; }
  V.diff = function (A, B) {
    var secs = [], add = function (title, items) { if (items.length) secs.push({ title: title, items: items }); };
    // tabs
    var it = [], aT = {}, bT = {};
    A.tabs.forEach(function (t) { aT[t.id] = t; }); B.tabs.forEach(function (t) { bT[t.id] = t; });
    B.tabs.forEach(function (t) { if (!aT[t.id]) it.push({ op: '+', text: 'Tab “' + t.title + '” added' }); else if (aT[t.id].title !== t.title) it.push({ op: '~', text: 'Tab renamed', before: aT[t.id].title, after: t.title }); else if (aT[t.id].hidden !== t.hidden) it.push({ op: '~', text: 'Tab “' + t.title + '” ' + (t.hidden ? 'hidden' : 'shown again') }); });
    A.tabs.forEach(function (t) { if (!bT[t.id]) it.push({ op: '-', text: 'Tab “' + t.title + '” removed' }); });
    var common = function (L, M) { return L.filter(function (t) { return M[t.id]; }).map(function (t) { return t.id; }).join(); };
    if (!it.length && common(A.tabs, bT) !== common(B.tabs, aT)) it.push({ op: '~', text: 'Tabs reordered', before: A.tabs.map(function (t) { return t.title; }).join(' · '), after: B.tabs.map(function (t) { return t.title; }).join(' · ') });
    if (!A.tabs.length && B.tabs.length) it.unshift({ op: '+', text: 'Turned into a tabbed layout' });
    add('Tabs', it);
    // text
    var d = lcs(A.texts.map(function (x) { return x.t; }), B.texts.map(function (x) { return x.t; })), tx = [];
    for (var i = 0; i < d.length; i++) {
      if (d[i].op === '-' && d[i + 1] && d[i + 1].op === '+') { tx.push({ op: '~', text: 'Text changed', before: d[i].a, after: d[i + 1].b }); i++; }
      else if (d[i].op === '-') tx.push({ op: '-', text: d[i].a });
      else if (d[i].op === '+') tx.push({ op: '+', text: d[i].b });
    }
    add('Text', tx.slice(0, 300));
    // charts
    var ac = A.state.charts || {}, bc = B.state.charts || {}, ch = [];
    Object.keys(bc).forEach(function (k) {
      var nm = B.chartName(k) || A.chartName(k);
      if (!ac[k]) { if (bc[k].native) ch.push({ op: '+', text: 'Chart “' + nm + '” added' }); else ch.push({ op: '~', text: 'Chart “' + nm + '”: settings added (' + Object.keys(bc[k]).map(function (s) { return SETTING[s] || s; }).join(', ') + ')' }); return; }
      Object.keys(SETTING).concat(Object.keys(bc[k]), Object.keys(ac[k])).filter(function (s, j, all) { return all.indexOf(s) === j; }).forEach(function (s) {
        if (JSON.stringify(ac[k][s]) !== JSON.stringify(bc[k][s])) ch.push({ op: '~', text: 'Chart “' + nm + '”: ' + (SETTING[s] || s), before: short(ac[k][s]), after: short(bc[k][s]) });
      });
    });
    Object.keys(ac).forEach(function (k) { if (!bc[k]) ch.push({ op: ac[k].native ? '-' : '~', text: ac[k].native ? 'Chart “' + A.chartName(k) + '” removed' : 'Chart “' + A.chartName(k) + '”: Mothership settings removed' }); });
    add('Charts', ch);
    // data, KPI cards, filters, consistency, theme
    var dt = [], ad = A.state.datasets || {}, bd = B.state.datasets || {};
    var rowsOf = function (x) { return x && x.rows ? x.rows.length : null; };
    Object.keys(bd).forEach(function (n) { if (!ad[n]) dt.push({ op: '+', text: 'Dataset “' + n + '” added' + (rowsOf(bd[n]) != null ? ' (' + IN(rowsOf(bd[n]), 0) + ' rows)' : '') }); else if (JSON.stringify(ad[n]) !== JSON.stringify(bd[n])) dt.push({ op: '~', text: 'Dataset “' + n + '” changed', before: rowsOf(ad[n]) != null ? IN(rowsOf(ad[n]), 0) + ' rows' : '', after: rowsOf(bd[n]) != null ? IN(rowsOf(bd[n]), 0) + ' rows' : '' }); });
    Object.keys(ad).forEach(function (n) { if (!bd[n]) dt.push({ op: '-', text: 'Dataset “' + n + '” removed' }); });
    var ak = A.state.kpis || {}, bk = B.state.kpis || {};
    Object.keys(bk).forEach(function (n) { if (!ak[n]) dt.push({ op: '+', text: 'Calculated KPI card added (' + (bk[n].measure || bk[n].agg) + ')' }); else if (JSON.stringify(ak[n]) !== JSON.stringify(bk[n])) dt.push({ op: '~', text: 'KPI card settings changed (' + (bk[n].measure || bk[n].agg) + ')', before: short(ak[n]), after: short(bk[n]) }); });
    Object.keys(ak).forEach(function (n) { if (!bk[n]) dt.push({ op: '-', text: 'Calculated KPI card removed (' + (ak[n].measure || ak[n].agg) + ')' }); });
    var fl = function (s) { return (s.filters || []).map(function (f) { return f.label || f.field; }).join(', '); };
    if (fl(A.state) !== fl(B.state)) dt.push({ op: '~', text: 'Filter pane', before: fl(A.state) || '(none)', after: fl(B.state) || '(none)' });
    var L1 = A.state.layout || {}, L2 = B.state.layout || {};
    if (JSON.stringify(L1.orders || []) !== JSON.stringify(L2.orders || [])) dt.push({ op: '~', text: 'Category order', before: (L1.orders || []).map(function (o) { return o.join(' › '); }).join('; ') || '(none)', after: (L2.orders || []).map(function (o) { return o.join(' › '); }).join('; ') || '(none)' });
    if (JSON.stringify(L1.colors || {}) !== JSON.stringify(L2.colors || {})) dt.push({ op: '~', text: 'Category colours', before: short(L1.colors), after: short(L2.colors) });
    if (JSON.stringify(A.state.theme || null) !== JSON.stringify(B.state.theme || null)) dt.push({ op: '~', text: 'Brand / theme', before: short(A.state.theme && (A.state.theme.name || A.state.theme.primary)), after: short(B.state.theme && (B.state.theme.name || B.state.theme.primary)) });
    add('Data, KPI cards, filters and design', dt);
    var ca = (A.state.comments || []), cb = (B.state.comments || []);
    var cm = [];
    if (ca.length !== cb.length) cm.push({ op: '~', text: 'Review comments', before: ca.length + '', after: cb.length + '' });
    var doneA = ca.filter(function (c) { return c.done; }).length, doneB = cb.filter(function (c) { return c.done; }).length;
    if (doneA !== doneB) cm.push({ op: '~', text: 'Comments marked done', before: doneA + '', after: doneB + '' });
    add('Review comments', cm);
    var n = 0; secs.forEach(function (s) { n += s.items.length; });
    return { sections: secs, changes: n };
  };
  V.sources = function () {
    return MS.store.all('versions').catch(function () { return []; }).then(function (list) {
      list.sort(function (a, b) { return b.key - a.key; });
      var out = MS.child ? [{ id: 'now', name: 'Now (on screen)', get: function () { return MS.exportHtml(); } }] : [];
      return out.concat(list.map(function (x) { var v = x.value; return { id: String(x.key), name: v.name + ' · ' + new Date(v.created).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), get: function () { return v.html; } }; }));
    });
  };
  V.compare = function (htmlA, htmlB) {
    var nameOf = function (k) { try { return rt() && rt().chart(k) ? MS.charts.nameOf(k) : ''; } catch (e) { return ''; } };
    return V.diff(V.snapshot(htmlA, nameOf), V.snapshot(htmlB, nameOf));
  };
  V.asText = function (r, an, bn) {
    var L = ['Changes from ' + an + ' to ' + bn + ' (' + r.changes + ')', ''];
    r.sections.forEach(function (s) { L.push(s.title.toUpperCase()); s.items.forEach(function (x) { L.push((x.op === '+' ? '+ ' : x.op === '-' ? '− ' : '~ ') + x.text + (x.before != null ? ': ' + x.before + ' → ' + x.after : '')); }); L.push(''); });
    return L.join('\n');
  };
  V.dialog = function () {
    V.sources().then(function (src) {
      var files = {};
      var mk = function (pick) {
        var s = h('select', { 'class': 'inp' }, src.map(function (x, i) { var o = h('option', { value: x.id, text: x.name }); if (i === pick) o.selected = true; return o; }).concat([h('option', { value: 'file', text: 'A file on this laptop…' })]));
        s.addEventListener('change', function () {
          if (s.value !== 'file') return;
          MS.pickFiles('.html,.htm').then(function (f) {
            if (!f[0]) { s.selectedIndex = 0; return; }
            MS.readFile(f[0]).then(function (t) { var id = 'f' + Date.now(); files[id] = { name: f[0].name, html: t }; s.insertBefore(h('option', { value: id, text: f[0].name }), s.lastChild); s.value = id; go(); });
          });
        });
        return s;
      };
      if (src.length < 1) return MS.toast('Open a dashboard or save a version first (Ctrl+S).', 'warn');
      var a = mk(Math.min(1, src.length - 1)), b = mk(0);
      a.addEventListener('change', function () { if (a.value !== 'file') go(); }); b.addEventListener('change', function () { if (b.value !== 'file') go(); });
      var get = function (s) { var x = files[s.value]; if (x) return { name: x.name, html: x.html }; var y = src.filter(function (q) { return q.id === s.value; })[0]; return y ? { name: y.name.split(' · ')[0], html: y.get() } : null; };
      var list = h('div', { 'class': 'cmp-list' }), sbs = h('div', { 'class': 'cmp-sbs' }), last = '';
      var seg = h('div', { 'class': 'seg' }, [h('button', { 'class': 'seg-btn on', text: 'What changed', onclick: function () { show(0); } }), h('button', { 'class': 'seg-btn', text: 'Side by side', onclick: function () { show(1); } })]);
      function show(n) { MS.$$('button', seg).forEach(function (x, i) { x.classList.toggle('on', i === n); }); list.style.display = n ? 'none' : ''; sbs.style.display = n ? '' : 'none'; if (n) frames(); }
      var A0, B0;
      function frames() {
        sbs.innerHTML = '';
        [[A0, 'Before'], [B0, 'After']].forEach(function (p) {
          if (!p[0]) return;
          var f = h('iframe', { sandbox: 'allow-scripts', title: p[1] }); f.srcdoc = p[0].html;
          sbs.appendChild(h('div', { 'class': 'cmp-pane' }, [h('div', { 'class': 'cmp-cap' }, [h('b', { text: p[1] + ': ' }), p[0].name]), h('div', { 'class': 'cmp-frame' }, [f])]));
        });
      }
      function go() {
        A0 = get(a); B0 = get(b); if (!A0 || !B0) return;
        var r = V.compare(A0.html, B0.html);
        last = V.asText(r, A0.name, B0.name);
        list.innerHTML = '';
        if (!r.changes) list.appendChild(h('p', { 'class': 'cmp-none', text: A0.html === B0.html ? 'These are the same.' : 'No visible changes found (only invisible details differ).' }));
        r.sections.forEach(function (s) {
          list.appendChild(h('h4', { text: s.title + ' (' + s.items.length + ')' }));
          s.items.forEach(function (x) {
            list.appendChild(h('div', { 'class': 'cmp-item cmp-' + ({ '+': 'add', '-': 'del', '~': 'chg' })[x.op] }, [h('span', { 'class': 'cmp-op', text: x.op === '~' ? '±' : x.op === '-' ? '−' : '+' }),
              h('div', { 'class': 'grow' }, [h('div', { text: x.text })].concat(x.before != null ? [h('div', { 'class': 'cmp-ba' }, [h('del', { text: x.before || '(empty)' }), h('span', { text: ' → ' }), h('ins', { text: x.after || '(empty)' })])] : []))]));
          });
        });
        if (sbs.style.display !== 'none') frames();
      }
      sbs.style.display = 'none';
      var body = h('div', { 'class': 'cmp' }, [h('div', { 'class': 'cmp-pick' }, [h('label', { 'class': 'field' }, [h('span', { text: 'Before' }), a]), h('span', { 'class': 'cmp-arrow', text: '→' }), h('label', { 'class': 'field' }, [h('span', { text: 'After' }), b]), h('span', { 'class': 'grow' }), seg]), list, sbs]);
      MS.dialog({ title: 'Compare versions', wide: true, body: body, buttons: [{ label: 'Close', value: null }, { label: 'Copy the list', primary: true, value: function () { copy(last); return false; } }] });
      var dl = MS.$('.dlg-wrap .dlg'); if (dl) dl.classList.add('xwide');
      go();
    });
  };
})(window.MS);
