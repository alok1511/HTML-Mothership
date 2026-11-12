/* Chart layouts: ready-made consulting-style charts built from the house rules in the McKinsey-style recipes.
   Pick a layout (ranked bar with one highlight, bridge, CAGR columns, risk heat map, loss run, survey, benchmark…),
   point it at your columns (or try it on sample data) and it inserts a finished chart: action title, unit line,
   one highlight colour, values on the bars, no clutter, source line and the drawn takeaway.
   Insert › Chart layouts; tool chart_layouts. Every insert is one undo step. Works offline. */
(function (MS) {
  'use strict';
  var Ly = MS.layouts = {};
  var h = MS.h;

  // The neutral consulting palette (swap for your firm's with Design › Edit theme; a locked firm template wins).
  var C = Ly.COLOURS = { ink: '#051C2C', highlight: '#2251FF', secondary: '#7F8C99', grey: '#B8BEC6', up: '#2E7D32', down: '#C62828', amber: '#F2A900', text: '#4B5563' };
  var HOUSE = { size: 11, color: C.text, grid: false };

  Ly.GROUPS = [
    { id: 'core', label: 'Core consulting charts' },
    { id: 'analysis', label: 'Data analysis' },
    { id: 'risk', label: 'Risk registers' },
    { id: 'claims', label: 'Claims and loss runs' },
    { id: 'survey', label: 'Surveys' },
    { id: 'benchmark', label: 'Benchmarking' },
    { id: 'page', label: 'Page layouts' }
  ];

  /* ---------------------------------------------------------- small helpers */
  function rt() { var r = MS.rt(); if (!r) throw new Error('Open a dashboard first (or File › New), and turn off Safe mode.'); return r; }
  function low(x) { return String(x == null ? '' : x).trim().toLowerCase(); }
  function num(v) { if (typeof v === 'number') return v; var n = Number(String(v == null ? '' : v).replace(/[,\s%₹$€£]/g, '')); return isNaN(n) ? null : n; }
  function fmt(v, spec) { var r = MS.rt(); return r ? r.fmtNum(v, spec || 'short') : String(v); }
  function round(v, d) { var p = Math.pow(10, d == null ? 1 : d); return Math.round(v * p) / p; }
  // rows → [{label, value, n}] in the order labels first appear, value = sum (or average / count)
  function group(rows, by, measure, agg) {
    var out = [], idx = {};
    rows.forEach(function (r) {
      var k = r[by]; if (k == null || k === '') return; k = String(k);
      var g = idx[k]; if (!g) { g = idx[k] = { label: k, sum: 0, n: 0 }; out.push(g); }
      var v = measure ? num(r[measure]) : 1; if (v == null) return;
      g.sum += v; g.n++;
    });
    out.forEach(function (g) { g.value = agg === 'avg' ? (g.n ? g.sum / g.n : 0) : agg === 'count' ? g.n : g.sum; });
    return out;
  }
  function sorted(list, dir) { return list.slice().sort(function (a, b) { return dir === 'asc' ? a.value - b.value : b.value - a.value; }); }
  function total(list) { return list.reduce(function (t, g) { return t + g.value; }, 0); }
  function median(vals) { var v = vals.slice().sort(function (a, b) { return a - b; }), m = Math.floor(v.length / 2); return v.length ? (v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2) : 0; }
  function look(extra) { return Object.assign({}, HOUSE, extra); }
  function esc(s) { return MS.esc(String(s == null ? '' : s)); }

  /* ---------------------------------------------------------- the layouts
     roles: the columns a layout needs. kind: text (a category) | number. opt: optional.
     sample: rows to try it on. draft(x): a suggested action title and unit line from the data.
     build(x): the tool calls. "$1", "$2" stand for the charts this layout has inserted so far. */
  var L = Ly.LIST = [];
  function add(o) { L.push(o); }

  add({ id: 'ranked-highlight', group: 'core', name: 'Ranked bars, one highlight', question: 'Who is biggest or worst? One bar stands out.', pic: 'rank',
    roles: [{ key: 'cat', label: 'Items (bars)', kind: 'text', hint: /state|region|branch|name|item|category|segment|product|team/ }, { key: 'val', label: 'Value', kind: 'number' }],
    options: [{ key: 'agg', label: 'Calculate', type: 'select', options: [{ value: 'sum', label: 'Sum' }, { value: 'avg', label: 'Average' }], value: 'sum' }, { key: 'pick', label: 'Bar to highlight (blank = the largest)' }, { key: 'note', label: 'Callout on that bar (optional)' }],
    sample: { name: 'Claim settlement time', rows: [['Maharashtra', 9.1], ['Karnataka', 7.4], ['Gujarat', 6.8], ['Tamil Nadu', 6.2], ['Delhi', 5.9], ['Telangana', 5.5], ['West Bengal', 4.8]].map(function (r) { return { State: r[0], Days: r[1] }; }), fields: { cat: 'State', val: 'Days' }, options: { agg: 'avg', note: 'Backlog after the July floods' }, unit: 'Average claim settlement time, days, FY25' },
    draft: function (x) {
      var g = sorted(group(x.rows, x.f.cat, x.f.val, x.o.agg)); if (!g.length) return {};
      var top = g[0], bot = g[g.length - 1], ratio = bot.value ? top.value / bot.value : 0;
      return { title: top.label + ' is the highest at ' + fmt(top.value) + (ratio >= 1.3 ? ', ' + round(ratio) + '× ' + bot.label : ''), sub: x.f.val + (x.o.agg === 'avg' ? ' (average)' : '') + ' by ' + x.f.cat };
    },
    build: function (x) {
      var g = sorted(group(x.rows, x.f.cat, x.f.val, x.o.agg)), pick = x.o.pick || (g[0] && g[0].label);
      var s = [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.cat, measure: x.f.val, agg: x.o.agg || 'sum', type: 'hbar', sort: 'desc', top: 15, title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'none', labels: true, valueAxis: false, highlight: [pick] }) } }];
      if (x.o.note && pick) s.push({ tool: 'annotate', args: { action: 'add', chart: '$1', label: pick, kind: 'callout', text: x.o.note, dx: -220, dy: 50 } });
      return s;
    } });

  add({ id: 'cagr-columns', group: 'core', name: 'Columns with a growth arrow', question: 'How fast is it growing? The arrow works out the CAGR.', pic: 'cagr',
    roles: [{ key: 'period', label: 'Period (years, in order)', kind: 'text', hint: /year|fy|period|month|quarter|date/ }, { key: 'val', label: 'Value', kind: 'number' }],
    sample: { name: 'Gross written premium', rows: [['FY21', 1830], ['FY22', 2110], ['FY23', 2390], ['FY24', 2720], ['FY25', 3100]].map(function (r) { return { Year: r[0], Premium: r[1] }; }), fields: { period: 'Year', val: 'Premium' }, unit: 'Gross written premium, millions, FY21–FY25' },
    draft: function (x) {
      var g = group(x.rows, x.f.period, x.f.val); if (g.length < 2) return {};
      var a = g[0], b = g[g.length - 1], cagr = a.value > 0 && b.value > 0 ? Math.pow(b.value / a.value, 1 / (g.length - 1)) - 1 : null;
      return { title: cagr == null ? x.f.val + ' moved from ' + fmt(a.value) + ' to ' + fmt(b.value) : x.f.val + ' has grown ' + round(cagr * 100) + '% a year since ' + a.label, sub: x.f.val + ', ' + a.label + '–' + b.label };
    },
    build: function (x) {
      var g = group(x.rows, x.f.period, x.f.val);
      var s = [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.period, measure: x.f.val, type: 'bar', sort: 'source', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'none', labels: true, valueAxis: false, highlight: [], restColor: C.ink }) } }];
      if (g.length > 1) s.push({ tool: 'chart_shapes', args: { action: 'add', chart: '$1', kind: 'cagr', a: { label: g[0].label, series: 0 }, b: { label: g[g.length - 1].label, series: 0 }, periods: g.length - 1 } });
      return s;
    } });

  // A bridge from a plain list of steps: the first row is the starting total, the rest are changes (+ / −).
  function bridgeRows(x) {
    var g = group(x.rows, x.f.step, x.f.change), rows = [], run = 0;
    g.forEach(function (s, i) {
      if (i === 0) { run = s.value; rows.push({ Step: s.label, Part: 'Total', Value: round(s.value, 2) }); return; }
      var v = s.value, before = run; run += v;
      rows.push({ Step: s.label, Part: 'Base', Value: round(v >= 0 ? before : run, 2) });
      rows.push({ Step: s.label, Part: v >= 0 ? 'Increase' : 'Decrease', Value: round(Math.abs(v), 2) });
    });
    if (g.length) rows.push({ Step: x.o.end || 'End', Part: 'Total', Value: round(run, 2) });
    return { rows: rows, start: g[0], end: run, steps: g.slice(1) };
  }
  function bridge(id, group_, name, question, sample) {
    add({ id: id, group: group_, name: name, question: question, pic: 'bridge',
      roles: [{ key: 'step', label: 'Steps (first row = starting total)', kind: 'text', hint: /step|driver|item|bridge|label/ }, { key: 'change', label: 'Change (+ / −)', kind: 'number' }],
      options: [{ key: 'end', label: 'Name of the end total', value: sample.end }],
      sample: sample,
      draft: function (x) {
        var b = bridgeRows(x); if (!b.start) return {};
        var big = b.steps.slice().sort(function (p, q) { return Math.abs(q.value) - Math.abs(p.value); })[0], d = b.end - b.start.value;
        return { title: (x.o.end || 'The total') + ' is ' + (d >= 0 ? 'up ' : 'down ') + fmt(Math.abs(d)) + ' on ' + b.start.label + (big ? '; ' + big.label + ' moved it most (' + (big.value >= 0 ? '+' : '−') + fmt(Math.abs(big.value)) + ')' : ''), sub: x.f.change + ', ' + b.start.label + ' to ' + (x.o.end || 'end') };
      },
      build: function (x) {
        var b = bridgeRows(x), name = x.ds + ' · bridge';
        return [{ tool: 'add_dataset', args: { name: name, rows: b.rows }, as: 'ds' },
          { tool: 'insert_chart', args: { dataset: '$ds', by: 'Step', measure: 'Value', series: 'Part', type: 'stacked', sort: 'source', title: x.title } },
          { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, tooltip: '{label}\n{series}: {value:short}', look: look({ legend: 'none', labels: 'inside', valueAxis: false, colors: { Base: 'transparent', Increase: C.up, Decrease: C.down, Total: C.ink } }) } },
          { tool: 'chart_shapes', args: { action: 'add', chart: '$1', kind: 'delta', a: { label: b.start ? b.start.label : '', series: 0 }, b: { label: x.o.end || 'End', series: 0 }, show: 'both' } }];
      } });
  }
  bridge('bridge', 'core', 'Bridge (waterfall)', 'How did we get from A to B?', { name: 'EBITDA bridge', rows: [['FY24 EBITDA', 420], ['Volume', 60], ['Price', 35], ['Mix', -25], ['Input cost', -45]].map(function (r) { return { Step: r[0], Change: r[1] }; }), fields: { step: 'Step', change: 'Change' }, options: { end: 'FY25 EBITDA' }, end: 'FY25 EBITDA', unit: 'EBITDA, millions, FY24 to FY25' });

  add({ id: 'mix-100', group: 'core', name: '100% stacked mix', question: 'How is the mix shifting? Every column adds to 100%.', pic: 'mix',
    roles: [{ key: 'period', label: 'Columns (e.g. years)', kind: 'text', hint: /year|fy|period|month|quarter/ }, { key: 'series', label: 'Parts of the mix', kind: 'text', hint: /channel|segment|type|mix|product|line/ }, { key: 'val', label: 'Value', kind: 'number' }],
    options: [{ key: 'pick', label: 'Part to highlight (blank = the one that grew most)' }],
    sample: { name: 'Channel mix', rows: [['FY23', 'Agency', 620], ['FY23', 'Banca', 290], ['FY23', 'Digital', 160], ['FY24', 'Agency', 640], ['FY24', 'Banca', 330], ['FY24', 'Digital', 230], ['FY25', 'Agency', 650], ['FY25', 'Banca', 360], ['FY25', 'Digital', 320]].map(function (r) { return { Year: r[0], Channel: r[1], Premium: r[2] }; }), fields: { period: 'Year', series: 'Channel', val: 'Premium' }, unit: 'Share of new business premium by channel, %, FY23–FY25' },
    shares: function (x) {
      var per = group(x.rows, x.f.period), parts = group(x.rows, x.f.series), first = per[0] && per[0].label, last = per.length && per[per.length - 1].label;
      var share = function (p, s) { var rows = x.rows.filter(function (r) { return String(r[x.f.period]) === p; }), t = 0, v = 0; rows.forEach(function (r) { var n = num(r[x.f.val]) || 0; t += n; if (String(r[x.f.series]) === s) v += n; }); return t ? v / t * 100 : 0; };
      return parts.map(function (s) { return { label: s.label, a: share(first, s.label), b: share(last, s.label) }; }).concat([]).sort(function (p, q) { return (q.b - q.a) - (p.b - p.a); }).map(function (s) { s.first = first; s.last = last; return s; });
    },
    draft: function (x) {
      var s = this.shares(x), top = x.o.pick ? s.filter(function (p) { return p.label === x.o.pick; })[0] || s[0] : s[0]; if (!top) return {};
      return { title: top.label + ' has gone from ' + round(top.a, 0) + '% to ' + round(top.b, 0) + '% of the mix since ' + top.first, sub: 'Share of ' + x.f.val + ' by ' + x.f.series + ', %' };
    },
    build: function (x) {
      var s = this.shares(x), pick = x.o.pick || (s[0] && s[0].label), others = [C.ink, C.secondary, C.grey, '#D9DDE2', '#8E99A6'], colors = {}, k = 0;
      s.forEach(function (p) { colors[p.label] = p.label === pick ? C.highlight : others[k++ % others.length]; });
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.period, measure: x.f.val, series: x.f.series, type: 'stacked', sort: 'source', percent: true, title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, tooltip: '{label}\n{series}: {value:pct}', look: look({ legend: 'right', labels: 'inside', labelFormat: 'pct', axisFormat: 'pct', max: 100, colors: colors }) } }];
    } });

  add({ id: 'line-target', group: 'core', name: 'Line against a target', question: 'Are we on track? Actual against a dashed target line.', pic: 'line',
    roles: [{ key: 'period', label: 'Period (in order)', kind: 'text', hint: /month|year|fy|period|quarter|date|week/ }, { key: 'actual', label: 'Actual', kind: 'number', hint: /actual|value|score|ratio/ }, { key: 'target', label: 'Target (a column, or type a number below)', kind: 'number', opt: true, hint: /target|plan|budget|goal/ }],
    options: [{ key: 'level', label: 'Target value, if there is no target column', type: 'number' }, { key: 'better', label: 'Better is', type: 'select', options: [{ value: 'high', label: 'Higher' }, { value: 'low', label: 'Lower (cost, loss ratio, delays)' }], value: 'high' }],
    sample: { name: 'Claims settled in 30 days', rows: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map(function (m, i) { return { Month: m, 'Settled in 30 days %': [61, 63, 66, 58, 64, 69, 72][i], Target: 70 }; }), fields: { period: 'Month', actual: 'Settled in 30 days %', target: 'Target' }, unit: 'Claims settled within 30 days, %, FY26 to date' },
    series: function (x) {
      var a = group(x.rows, x.f.period, x.f.actual, 'avg'), t = x.f.target ? group(x.rows, x.f.period, x.f.target, 'avg') : null;
      return a.map(function (g, i) { return { label: g.label, actual: g.value, target: t ? (t[i] ? t[i].value : null) : num(x.o.level) }; });
    },
    draft: function (x) {
      var s = this.series(x), last = s[s.length - 1]; if (!last) return {};
      if (last.target == null) return { title: x.f.actual + ' is ' + fmt(last.actual) + ' in ' + last.label, sub: x.f.actual + ' by ' + x.f.period };
      var good = x.o.better === 'low' ? last.actual <= last.target : last.actual >= last.target;
      return { title: x.f.actual + ' ' + (good ? 'reached' : 'is short of') + ' the ' + fmt(last.target) + ' target in ' + last.label + ' (' + fmt(last.actual) + ')', sub: x.f.actual + ' against target by ' + x.f.period };
    },
    build: function (x) {
      var rows = []; this.series(x).forEach(function (s) { rows.push({ Period: s.label, Series: 'Actual', Value: round(s.actual, 2) }); if (s.target != null) rows.push({ Period: s.label, Series: 'Target', Value: round(s.target, 2) }); });
      return [{ tool: 'add_dataset', args: { name: x.ds + ' · vs target', rows: rows }, as: 'ds' },
        { tool: 'insert_chart', args: { dataset: '$ds', by: 'Period', measure: 'Value', series: 'Series', type: 'line', sort: 'source', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'top', straight: true, colors: { Actual: C.highlight, Target: C.down }, dashed: ['Target'] }) } }];
    } });

  add({ id: 'variance-vs-plan', group: 'analysis', name: 'Variance against plan', question: 'Where are we over or under plan? Green helps, red hurts.', pic: 'variance',
    roles: [{ key: 'item', label: 'Items', kind: 'text', hint: /item|line|cost|branch|region|account|department/ }, { key: 'actual', label: 'Actual (or the variance itself)', kind: 'number', hint: /actual|variance|var/ }, { key: 'plan', label: 'Plan (leave blank if the column above is already the variance)', kind: 'number', opt: true, hint: /plan|budget|target/ }],
    options: [{ key: 'better', label: 'Over plan is', type: 'select', options: [{ value: 'high', label: 'Good (sales, premium)' }, { value: 'low', label: 'Bad (cost, claims)' }], value: 'high' }],
    sample: { name: 'Branch result vs plan', rows: [['Mumbai', 1240, 1100], ['Pune', 640, 700], ['Ahmedabad', 520, 480], ['Bengaluru', 980, 1050], ['Chennai', 610, 590], ['Kolkata', 450, 520]].map(function (r) { return { Branch: r[0], Actual: r[1], Plan: r[2] }; }), fields: { item: 'Branch', actual: 'Actual', plan: 'Plan' }, unit: 'Actual minus plan, millions, FY25' },
    vars: function (x) {
      var a = group(x.rows, x.f.item, x.f.actual), p = x.f.plan ? group(x.rows, x.f.item, x.f.plan) : null;
      return a.map(function (g, i) { return { label: g.label, value: round(g.value - (p && p[i] ? p[i].value : 0), 2) }; });
    },
    draft: function (x) {
      var v = sorted(this.vars(x)), worst = x.o.better === 'low' ? v[0] : v[v.length - 1], best = x.o.better === 'low' ? v[v.length - 1] : v[0];
      if (!worst) return {};
      return { title: worst.label + ' is furthest ' + (x.o.better === 'low' ? 'over' : 'behind') + ' plan (' + (worst.value >= 0 ? '+' : '−') + fmt(Math.abs(worst.value)) + '); ' + best.label + ' leads', sub: x.f.plan ? x.f.actual + ' minus ' + x.f.plan : x.f.actual };
    },
    build: function (x) {
      var signs = x.o.better === 'low' ? { up: C.down, down: C.up } : { up: C.up, down: C.down };
      return [{ tool: 'add_dataset', args: { name: x.ds + ' · variance', rows: this.vars(x).map(function (v) { var o = {}; o[x.f.item] = v.label; o.Variance = v.value; return o; }) }, as: 'ds' },
        { tool: 'insert_chart', args: { dataset: '$ds', by: x.f.item, measure: 'Variance', type: 'hbar', sort: 'desc', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'none', labels: true, valueAxis: false, signs: signs }) } }];
    } });

  add({ id: 'distribution', group: 'analysis', name: 'Distribution with the tail picked out', question: 'How are values spread? Where is the bulk and where is the tail?', pic: 'hist',
    roles: [{ key: 'band', label: 'Bands (in order, smallest first)', kind: 'text', hint: /band|bucket|range|size|bin/ }, { key: 'count', label: 'Count (blank = count the rows)', kind: 'number', opt: true, hint: /count|claims|number|n$/ }],
    options: [{ key: 'pick', label: 'Band to highlight (blank = the last)' }],
    sample: { name: 'Claims by size', rows: [['Under 1 lakh', 1840], ['1–5 lakh', 620], ['5–25 lakh', 140], ['25 lakh+', 22]].map(function (r) { return { Band: r[0], Claims: r[1] }; }), fields: { band: 'Band', count: 'Claims' }, unit: 'Number of claims by incurred band, FY25' },
    draft: function (x) {
      var g = group(x.rows, x.f.band, x.f.count, x.f.count ? 'sum' : 'count'), t = total(g), pick = x.o.pick || (g.length && g[g.length - 1].label), p = g.filter(function (q) { return q.label === pick; })[0];
      return p ? { title: 'Only ' + round(p.value / t * 100) + '% of ' + (x.f.count ? low(x.f.count) : 'rows') + ' are in the ' + pick + ' band', sub: (x.f.count || 'Count') + ' by ' + x.f.band } : {};
    },
    build: function (x) {
      var g = group(x.rows, x.f.band, x.f.count, x.f.count ? 'sum' : 'count'), pick = x.o.pick || (g.length && g[g.length - 1].label);
      var s = [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.band, measure: x.f.count || undefined, agg: x.f.count ? 'sum' : 'count', type: 'bar', sort: 'source', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'none', labels: true, valueAxis: false, highlight: [pick], restColor: C.grey }) } }];
      return s;
    } });

  add({ id: 'house-style', group: 'page', name: 'House style on every chart', question: 'Make the charts already on the page look consulting-grade in one go.', pic: 'style', roles: [],
    options: [{ key: 'legend', label: 'Legend', type: 'select', options: ['right', 'top', 'bottom', 'none'], value: 'right' }, { key: 'font', label: 'Font', value: 'Arial' }],
    draft: function () { return {}; },
    build: function (x) {
      var s = [{ tool: 'add_commentary_all', args: {} }, { tool: 'chart_look_all', args: { look: look({ font: x.o.font || undefined, legend: x.o.legend || 'right' }) } }];
      if (x.source) s.push({ tool: 'chart_source', args: { all: true, text: x.source, as_of: x.asOf || undefined } });
      return s;
    } });

  add({ id: 'exec-summary', group: 'page', name: 'Executive summary page', question: 'One page: headline, three numbers, two charts and the takeaway.', pic: 'page', titleOnPage: true,
    roles: [{ key: 'cat', label: 'Breakdown (e.g. region)', kind: 'text', hint: /region|state|branch|segment|product|line/ }, { key: 'val', label: 'Main measure', kind: 'number' }, { key: 'period', label: 'Period (optional, for a trend)', kind: 'text', opt: true, hint: /year|fy|month|quarter|period/ }],
    options: [{ key: 'takeaway', label: 'So what (the one message)', value: 'Write the one thing the reader should do or remember.' }],
    sample: { name: 'Premium by region', rows: [].concat.apply([], ['FY23', 'FY24', 'FY25'].map(function (y, i) { return [['West', 820], ['South', 640], ['North', 510], ['East', 290]].map(function (r) { return { Year: y, Region: r[0], Premium: Math.round(r[1] * (1 + 0.11 * i) * (r[0] === 'East' ? 1 - 0.06 * i : 1)) }; }); })), fields: { cat: 'Region', val: 'Premium', period: 'Year' }, unit: 'Premium, millions' },
    draft: function (x) {
      var g = sorted(group(x.rows, x.f.cat, x.f.val)), t = total(g);
      return g.length ? { title: g[0].label + ' brings ' + round(g[0].value / t * 100, 0) + '% of ' + x.f.val, sub: x.f.val + ' by ' + x.f.cat + (x.f.period ? ' and ' + x.f.period : '') } : {};
    },
    build: function (x) {
      var g = sorted(group(x.rows, x.f.cat, x.f.val)), s = [
        { tool: 'insert_part', args: { part: 'banner', title: x.title, text: x.sub } },
        { tool: 'insert_kpis', args: { cards: [{ label: 'Total ' + x.f.val, dataset: x.ds, measure: x.f.val, agg: 'sum', format: 'short' }, { label: 'Largest ' + x.f.cat, value: g[0] ? g[0].label : '–', note: g[0] ? fmt(g[0].value) : '' }, { label: x.f.cat + ' count', dataset: x.ds, measure: x.f.cat, agg: 'distinct', format: 'int' }] } },
        { tool: 'insert_chart', args: { dataset: x.ds, by: x.f.cat, measure: x.f.val, type: 'hbar', sort: 'desc', title: g.length > 1 ? g[0].label + ' leads; ' + g[g.length - 1].label + ' is the smallest' : x.f.val + ' by ' + x.f.cat } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.f.val + ' by ' + x.f.cat, look: look({ legend: 'none', labels: true, valueAxis: false, highlight: g[0] ? [g[0].label] : [] }) } }];
      var p = x.f.period ? group(x.rows, x.f.period, x.f.val) : [], a = p[0], b = p[p.length - 1];
      if (x.f.period) s.push({ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.period, measure: x.f.val, type: 'bar', sort: 'source', title: a && b && a !== b && a.value ? x.f.val + ' ' + (b.value >= a.value ? 'grew ' : 'fell ') + round(Math.abs(b.value / a.value - 1) * 100, 0) + '% from ' + a.label + ' to ' + b.label : x.f.val + ' by ' + x.f.period } },
        { tool: 'chart_settings', args: { chart: '$2', subtitle: x.f.val + ' by ' + x.f.period, look: look({ legend: 'none', labels: true, valueAxis: false, highlight: [], restColor: C.ink }) } });
      s.push({ tool: 'insert_part', args: { part: 'callout', text: x.o.takeaway || 'So what: write the one message here.' } });
      return s;
    } });

  /* ---------- risk registers */
  function score(v) { var n = num(v); return n == null ? null : Math.max(1, Math.min(5, Math.round(n))); }
  Ly.heatmapHtml = function (items) {
    var cell = {}; items.forEach(function (r) { if (r.l == null || r.i == null) return; var k = r.l + ':' + r.i; (cell[k] = cell[k] || []).push(r.id); });
    var colour = function (s) { return s >= 15 ? '#F4C7C3' : s >= 8 ? '#FCE8B2' : '#D6EAD8'; };
    var rows = [5, 4, 3, 2, 1].map(function (l) {
      return '<tr><th scope="row">' + l + '</th>' + [1, 2, 3, 4, 5].map(function (i) { return '<td style="background:' + colour(l * i) + ';text-align:center;font-weight:600;font-size:12px;height:44px;min-width:56px">' + esc((cell[l + ':' + i] || []).join(', ')) + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<table class="ms-table ms-heatmap" style="border-collapse:separate;border-spacing:3px;margin:auto"><thead><tr><th>Likelihood ↓ / Impact →</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p style="font-size:11px;color:#4B5563;margin:6px 0 0">Red: score 15 or more · Amber: 8 to 14 · Green: under 8 (score = likelihood × impact). A picture of the register: rebuild it when scores change.</p>';
  };
  var RISKS = [['R1', 'Cyber attack on policy system', 'IT', 4, 5, 3], ['R2', 'Cat event above reinsurance cover', 'Underwriting', 3, 5, 3], ['R3', 'Reserve deficiency on motor TP', 'Actuarial', 4, 4, 3], ['R4', 'Key distributor exits', 'Distribution', 3, 4, 2], ['R5', 'Regulatory change to commissions', 'Compliance', 4, 3, 3], ['R6', 'Claims fraud ring', 'Claims', 3, 3, 2], ['R7', 'Data privacy breach', 'IT', 3, 5, 4], ['R8', 'Staff attrition in claims', 'Operations', 4, 2, 2]];
  var riskRows = RISKS.map(function (r) { return { ID: r[0], Risk: r[1], Category: r[2], Likelihood: r[3], Impact: r[4], Inherent: r[3] * r[4], Residual: r[3] * r[5], Rating: r[3] * r[5] >= 12 ? 'High' : r[3] * r[5] >= 6 ? 'Medium' : 'Low' }; });

  add({ id: 'risk-heatmap', group: 'risk', name: 'Risk heat map (5 × 5)', question: 'Where do our risks sit on likelihood and impact?', pic: 'heat',
    roles: [{ key: 'id', label: 'Risk ID', kind: 'text', hint: /^id$|ref|risk id|code/ }, { key: 'l', label: 'Likelihood (1–5)', kind: 'number', hint: /likel|prob/ }, { key: 'i', label: 'Impact (1–5)', kind: 'number', hint: /impact|sever|conseq/ }],
    sample: { name: 'Risk register', rows: riskRows, fields: { id: 'ID', l: 'Likelihood', i: 'Impact' }, unit: 'Inherent risk, likelihood × impact, Q3 FY26' },
    draft: function (x) {
      var n = x.rows.filter(function (r) { return (score(r[x.f.l]) || 0) * (score(r[x.f.i]) || 0) >= 15; }).length;
      return { title: n + ' of ' + x.rows.length + ' risks sit in the red zone', sub: 'Likelihood × impact, scored 1–5' };
    },
    build: function (x) {
      var items = x.rows.map(function (r) { return { id: r[x.f.id], l: score(r[x.f.l]), i: score(r[x.f.i]) }; });
      return [{ tool: 'insert_text_block', args: { title: x.title, html: Ly.heatmapHtml(items), span: 6 }, as: 'block' }];
    } });

  add({ id: 'risk-register-rag', group: 'risk', name: 'Risk register with RAG', question: 'Which risks stay above appetite after controls?', pic: 'table',
    roles: [{ key: 'score', label: 'Residual score (sorted, highest first)', kind: 'number', hint: /resid|net|score/ }, { key: 'inherent', label: 'Inherent score (bars, optional)', kind: 'number', opt: true, hint: /inher|gross/ }, { key: 'rating', label: 'Rating column (optional)', kind: 'text', opt: true, hint: /rating|rag|status|level/ }],
    options: [{ key: 'green', label: 'Green up to (score)', type: 'number', value: 5 }, { key: 'amber', label: 'Amber up to (score)', type: 'number', value: 11 }, { key: 'top', label: 'Rows to show', type: 'number', value: 15 }],
    sample: { name: 'Risk register', rows: riskRows, fields: { score: 'Residual', inherent: 'Inherent', rating: 'Rating' }, unit: 'Residual score = likelihood × impact after controls' },
    draft: function (x) {
      var amber = num(x.o.amber); if (amber == null) amber = 11;
      var over = x.rows.filter(function (r) { return (num(r[x.f.score]) || 0) > amber; }).length;
      return { title: over + ' risk' + (over === 1 ? '' : 's') + ' remain above appetite after controls', sub: 'Top risks by ' + x.f.score + ' score' };
    },
    build: function (x) {
      var g = num(x.o.green), a = num(x.o.amber); if (g == null) g = 5; if (a == null) a = 11;
      var rules = [{ col: x.f.score, type: 'rag', value: g, value2: a, higher: false }];
      if (x.f.inherent) rules.push({ col: x.f.inherent, type: 'bars', color: C.grey });
      if (x.f.rating) rules.push({ col: x.f.rating, type: 'rule', op: 'eq', value: 'High', color: C.down, bold: true });
      return [{ tool: 'insert_table', args: { dataset: x.ds, title: x.title, sort: x.f.score, desc: true, rows: num(x.o.top) || 15 }, as: 'table' },
        { tool: 'table_rules', args: { table: '$table', action: 'set', rules: rules } }];
    } });

  add({ id: 'risk-by-category', group: 'risk', name: 'Risks by category and rating', question: 'Which categories carry the most high-rated risks?', pic: 'stack',
    roles: [{ key: 'cat', label: 'Category', kind: 'text', hint: /categ|area|type|owner|function/ }, { key: 'rating', label: 'Rating (High / Medium / Low)', kind: 'text', hint: /rating|rag|level|status/ }, { key: 'count', label: 'Count (blank = count the risks)', kind: 'number', opt: true, hint: /count|number/ }],
    sample: { name: 'Risk register', rows: riskRows, fields: { cat: 'Category', rating: 'Rating' }, unit: 'Number of risks by residual rating' },
    draft: function (x) {
      var hi = group(x.rows.filter(function (r) { return low(r[x.f.rating]) === 'high'; }), x.f.cat, x.f.count, x.f.count ? 'sum' : 'count'); hi = sorted(hi);
      return hi.length ? { title: hi[0].label + ' carries the most high-rated risks (' + fmt(hi[0].value, 'int') + ')', sub: 'Risks by ' + x.f.cat + ' and ' + x.f.rating } : { title: 'No high-rated risks', sub: 'Risks by ' + x.f.cat };
    },
    build: function (x) {
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.cat, measure: x.f.count || undefined, agg: x.f.count ? 'sum' : 'count', series: x.f.rating, type: 'hstacked', sort: 'desc', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'bottom', labels: 'inside', labelFormat: 'int', valueAxis: false, colors: { High: C.down, Red: C.down, Medium: C.amber, Amber: C.amber, Low: C.up, Green: C.up } }) } }];
    } });

  add({ id: 'risk-inherent-vs-residual', group: 'risk', name: 'Inherent vs residual', question: 'How much do controls reduce each risk?', pic: 'pair',
    roles: [{ key: 'risk', label: 'Risk', kind: 'text', hint: /^id$|risk|ref/ }, { key: 'a', label: 'Inherent score', kind: 'number', hint: /inher|gross/ }, { key: 'b', label: 'Residual score', kind: 'number', hint: /resid|net/ }],
    sample: { name: 'Risk register', rows: riskRows, fields: { risk: 'ID', a: 'Inherent', b: 'Residual' }, unit: 'Risk score before and after controls (likelihood × impact)' },
    pairs: function (x) { var a = group(x.rows, x.f.risk, x.f.a, 'avg'), b = group(x.rows, x.f.risk, x.f.b, 'avg'); return a.map(function (g, i) { return { label: g.label, a: g.value, b: b[i] ? b[i].value : 0 }; }); },
    draft: function (x) {
      var p = this.pairs(x).sort(function (m, n) { return (m.a - m.b) - (n.a - n.b); }), least = p[0];
      return least ? { title: least.a - least.b <= 0 ? 'Controls cut most risks, but not ' + least.label + ' (' + fmt(least.a, 'int') + ' before and after)' : 'Controls cut every risk; ' + least.label + ' moves least (' + fmt(least.a, 'int') + ' to ' + fmt(least.b, 'int') + ')', sub: x.f.a + ' and ' + x.f.b + ' score by risk' } : {};
    },
    build: function (x) {
      var rows = []; this.pairs(x).forEach(function (p) { rows.push({ Risk: p.label, Stage: 'Inherent', Score: p.a }, { Risk: p.label, Stage: 'Residual', Score: p.b }); });
      return [{ tool: 'add_dataset', args: { name: x.ds + ' · inherent vs residual', rows: rows }, as: 'ds' },
        { tool: 'insert_chart', args: { dataset: '$ds', by: 'Risk', measure: 'Score', series: 'Stage', type: 'bar', sort: 'source', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'top', labels: true, labelFormat: 'int', valueAxis: false, colors: { Inherent: C.grey, Residual: C.highlight } }) } }];
    } });

  /* ---------- claims and loss runs */
  add({ id: 'lossrun-paid-outstanding', group: 'claims', name: 'Loss run: paid and outstanding', question: 'How much of each policy year is still reserve?', pic: 'stack',
    roles: [{ key: 'year', label: 'Policy year', kind: 'text', hint: /year|uw|policy|period/ }, { key: 'paid', label: 'Paid', kind: 'number', hint: /paid/ }, { key: 'os', label: 'Outstanding (reserve)', kind: 'number', hint: /outst|o\/s|reserve|os$/ }],
    sample: { name: 'Loss run', rows: [['2021-22', 41.2, 2.1], ['2022-23', 38.6, 5.4], ['2023-24', 29.8, 12.7], ['2024-25', 14.3, 24.9]].map(function (r) { return { 'Policy year': r[0], Paid: r[1], Outstanding: r[2] }; }), fields: { year: 'Policy year', paid: 'Paid', os: 'Outstanding' }, unit: 'Incurred claims, millions, valued 30 Sep 2026' },
    draft: function (x) {
      var p = group(x.rows, x.f.year, x.f.paid), o = group(x.rows, x.f.year, x.f.os), i = p.length - 1; if (i < 0) return {};
      var share = (p[i].value + o[i].value) ? o[i].value / (p[i].value + o[i].value) * 100 : 0;
      return { title: round(share, 0) + '% of ' + p[i].label + ' incurred is still outstanding', sub: 'Incurred = paid + outstanding, by ' + x.f.year + (x.asOf ? ', valued ' + x.asOf : '') };
    },
    build: function (x) {
      var p = group(x.rows, x.f.year, x.f.paid), o = group(x.rows, x.f.year, x.f.os), rows = [];
      p.forEach(function (g, i) { rows.push({ Year: g.label, Part: 'Paid', Amount: g.value }, { Year: g.label, Part: 'Outstanding', Amount: o[i] ? o[i].value : 0 }); });
      return [{ tool: 'add_dataset', args: { name: x.ds + ' · paid and outstanding', rows: rows }, as: 'ds' },
        { tool: 'insert_chart', args: { dataset: '$ds', by: 'Year', measure: 'Amount', series: 'Part', type: 'stacked', sort: 'source', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'right', labels: 'inside', valueAxis: false, colors: { Paid: C.ink, Outstanding: C.highlight } }) } }];
    } });

  add({ id: 'large-loss-ranking', group: 'claims', name: 'Large-loss ranking', question: 'How concentrated are losses in a few claims?', pic: 'rank',
    roles: [{ key: 'claim', label: 'Claim reference (never claimant names)', kind: 'text', hint: /claim|ref|no|number|id/ }, { key: 'val', label: 'Incurred', kind: 'number', hint: /incur|amount|loss|cost/ }],
    options: [{ key: 'top', label: 'How many to show', type: 'number', value: 10 }, { key: 'threshold', label: 'Large-loss threshold (blank = highlight the top 3)', type: 'number' }],
    sample: { name: 'Large claims', rows: [['CL-1042', 18.4], ['CL-0877', 12.9], ['CL-1310', 9.6], ['CL-0954', 5.1], ['CL-1188', 4.7], ['CL-0712', 4.2], ['CL-1265', 3.8], ['CL-0999', 3.1], ['CL-1101', 2.9], ['CL-0633', 2.6], ['CL-1222', 2.2], ['CL-0805', 1.9]].map(function (r) { return { Claim: r[0], Incurred: r[1] }; }), fields: { claim: 'Claim', val: 'Incurred' }, options: { top: 10, threshold: 9 }, unit: 'Incurred per claim, millions, top 10' },
    draft: function (x) {
      var g = sorted(group(x.rows, x.f.claim, x.f.val)), n = Math.min(3, g.length), t = total(g), top = g.slice(0, n);
      return t ? { title: 'The ' + n + ' largest claims make up ' + round(total(top) / t * 100, 0) + '% of incurred', sub: x.f.val + ' per claim, largest ' + (num(x.o.top) || 10) } : {};
    },
    build: function (x) {
      var g = sorted(group(x.rows, x.f.claim, x.f.val)), th = num(x.o.threshold), big = g.filter(function (q, i) { return th != null ? q.value >= th : i < 3; }).map(function (q) { return q.label; });
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.claim, measure: x.f.val, type: 'hbar', sort: 'desc', top: num(x.o.top) || 10, title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'none', labels: true, valueAxis: false, highlight: big }) } }];
    } });

  add({ id: 'claims-by-cause', group: 'claims', name: 'Claims by cause (Pareto)', question: 'Which causes of loss drive cost?', pic: 'rank',
    roles: [{ key: 'cause', label: 'Cause of loss', kind: 'text', hint: /cause|peril|reason|type/ }, { key: 'val', label: 'Incurred', kind: 'number', hint: /incur|amount|loss|cost|paid/ }],
    sample: { name: 'Claims by cause', rows: [['Flood', 48.2], ['Fire', 31.5], ['Theft', 12.4], ['Machinery breakdown', 9.8], ['Accidental damage', 6.1], ['Storm', 4.3], ['Other', 3.2]].map(function (r) { return { Cause: r[0], Incurred: r[1] }; }), fields: { cause: 'Cause', val: 'Incurred' }, unit: 'Incurred claims by cause of loss, millions, FY25' },
    pareto: function (x) { var g = sorted(group(x.rows, x.f.cause, x.f.val)), t = total(g), run = 0, top = []; g.forEach(function (q) { if (run / t < 0.8) top.push(q.label); run += q.value; }); return { g: g, t: t, top: top }; },
    draft: function (x) {
      var p = this.pareto(x), share = p.t ? total(p.g.filter(function (q) { return p.top.indexOf(q.label) >= 0; })) / p.t * 100 : 0;
      return p.top.length ? { title: p.top.length + ' cause' + (p.top.length === 1 ? '' : 's') + ' (' + p.top.join(', ') + ') drive ' + round(share, 0) + '% of incurred', sub: x.f.val + ' by ' + x.f.cause } : {};
    },
    build: function (x) {
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.cause, measure: x.f.val, type: 'hbar', sort: 'desc', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, tooltip: '{label}\n{value:short} ({pct:pct} of the total)', look: look({ legend: 'none', labels: true, valueAxis: false, highlight: this.pareto(x).top, highlightColor: C.ink }) } }];
    } });

  add({ id: 'frequency-severity', group: 'claims', name: 'Frequency and severity', question: 'Is cost rising because of more claims or bigger claims?', pic: 'twin',
    roles: [{ key: 'year', label: 'Policy year', kind: 'text', hint: /year|period|fy/ }, { key: 'cost', label: 'Incurred', kind: 'number', hint: /incur|cost|amount|loss/ }, { key: 'claims', label: 'Number of claims (blank if one row per claim)', kind: 'number', opt: true, hint: /claims|count|number/ }],
    sample: { name: 'Claims by year', rows: [['2021-22', 412, 3710], ['2022-23', 431, 4100], ['2023-24', 446, 4950], ['2024-25', 452, 5880]].map(function (r) { return { 'Policy year': r[0], Claims: r[1], 'Incurred (lakh)': r[2] }; }), fields: { year: 'Policy year', cost: 'Incurred (lakh)', claims: 'Claims' }, unit: 'Average incurred per claim, lakh' },
    fs: function (x) {
      var c = group(x.rows, x.f.year, x.f.claims, x.f.claims ? 'sum' : 'count'), s = group(x.rows, x.f.year, x.f.cost);
      return c.map(function (g, i) { return { label: g.label, n: g.value, avg: g.value ? (s[i] ? s[i].value : 0) / g.value : 0 }; });
    },
    draft: function (x) {
      var r = this.fs(x), a = r[0], b = r[r.length - 1]; if (!a || r.length < 2) return {};
      var dn = a.n ? (b.n / a.n - 1) * 100 : 0, ds = a.avg ? (b.avg / a.avg - 1) * 100 : 0;
      return { title: 'Cost is rising because claims are ' + (Math.abs(ds) >= Math.abs(dn) ? 'bigger (+' + round(ds, 0) + '% per claim), not more frequent (+' + round(dn, 0) + '%)' : 'more frequent (+' + round(dn, 0) + '%), not bigger (+' + round(ds, 0) + '% per claim)'), sub: 'Number of claims and average ' + x.f.cost + ' per claim, ' + a.label + '–' + b.label };
    },
    build: function (x) {
      var r = this.fs(x), first = r[0] && r[0].label, last = r.length && r[r.length - 1].label;
      var rows = r.map(function (q) { var o = { Year: q.label, Claims: q.n }; o['Average cost'] = round(q.avg, q.avg < 10 ? 3 : 1); return o; });
      var s = [{ tool: 'add_dataset', args: { name: x.ds + ' · frequency and severity', rows: rows }, as: 'ds' },
        { tool: 'insert_chart', args: { dataset: '$ds', by: 'Year', measure: 'Claims', type: 'bar', sort: 'source', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: 'Frequency: number of claims', look: look({ legend: 'none', labels: true, labelFormat: 'int', valueAxis: false, highlight: [], restColor: C.grey }) } },
        { tool: 'insert_chart', args: { dataset: '$ds', by: 'Year', measure: 'Average cost', type: 'bar', sort: 'source', title: 'Severity: average ' + x.f.cost + ' per claim' } },
        { tool: 'chart_settings', args: { chart: '$2', subtitle: x.sub, look: look({ legend: 'none', labels: true, labelFormat: rows.some(function (q) { return q['Average cost'] < 100; }) ? '0.0' : 'short', valueAxis: false, highlight: [], restColor: C.ink }) } }];
      // side by side where the page has a 12-column grid (tabs); on a one-page dashboard they stack
      if (MS.rt().layoutEnabled && MS.rt().layoutEnabled()) s.push({ tool: 'chart_size', args: { chart: '$1', columns: 6 } }, { tool: 'chart_size', args: { chart: '$2', columns: 6 } });
      if (first && last && first !== last) s.push({ tool: 'chart_shapes', args: { action: 'add', chart: '$1', kind: 'delta', a: { label: first, series: 0 }, b: { label: last, series: 0 }, show: 'pct' } },
        { tool: 'chart_shapes', args: { action: 'add', chart: '$2', kind: 'delta', a: { label: first, series: 0 }, b: { label: last, series: 0 }, show: 'pct' } });
      return s;
    } });

  bridge('incurred-bridge', 'claims', 'Incurred claims bridge', 'What moved incurred claims from last year to this year?', { name: 'Incurred bridge', rows: [['FY24 incurred', 49.5], ['More claims', 0.7], ['Larger claims', 6.4], ['Two large losses', 4.1], ['Reserve releases', -1.9]].map(function (r) { return { Step: r[0], Change: r[1] }; }), fields: { step: 'Step', change: 'Change' }, options: { end: 'FY25 incurred' }, end: 'FY25 incurred', unit: 'Incurred claims, millions, FY24 to FY25' });

  add({ id: 'loss-triangle', group: 'claims', name: 'Loss development triangle', question: 'Is the latest year developing heavier than earlier years?', pic: 'table',
    roles: [{ key: 'year', label: 'Policy year', kind: 'text', hint: /year|period/ }],
    sample: { name: 'Incurred triangle', rows: [['2021-22', 22.1, 34.8, 39.6, 41.2], ['2022-23', 24.0, 37.9, 42.8, null], ['2023-24', 27.3, 44.1, null, null], ['2024-25', 31.6, null, null, null]].map(function (r) { return { 'Policy year': r[0], '12m': r[1], '24m': r[2], '36m': r[3], '48m': r[4] }; }), fields: { year: 'Policy year' }, unit: 'Cumulative incurred by months of development, millions' },
    cols: function (x) { return MS.rt().fields(x.ds).filter(function (f) { return f.numeric && f.name !== x.f.year; }).map(function (f) { return f.name; }); },
    draft: function (x) {
      var c = this.cols(x)[0], g = c ? group(x.rows, x.f.year, c) : [], a = g[0], b = g[g.length - 1];
      return a && b && a !== b ? { title: b.label + ' is ' + round((b.value / a.value - 1) * 100, 0) + '% heavier than ' + a.label + ' at ' + c, sub: 'Cumulative incurred by development age. Not an actuarial projection.' } : {};
    },
    build: function (x) {
      var cols = this.cols(x);
      return [{ tool: 'insert_table', args: { dataset: x.ds, title: x.title, columns: [x.f.year].concat(cols) }, as: 'table' },
        { tool: 'table_rules', args: { table: '$table', action: 'set', rules: cols.map(function (c) { return { col: c, type: 'scale', higher: false }; }) } }];
    } });

  /* ---------- surveys */
  add({ id: 'survey-top2box', group: 'survey', name: 'Top-2-box ranking', question: 'Which statements score lowest?', pic: 'rank',
    roles: [{ key: 'stmt', label: 'Statement', kind: 'text', hint: /statement|question|item|attribute/ }, { key: 'val', label: '% agree or strongly agree', kind: 'number', hint: /agree|top|t2b|score|%/ }],
    options: [{ key: 'n', label: 'Number of responses (n)', type: 'number' }],
    sample: { name: 'Employee survey', rows: [['I know what is expected of me', 86], ['My manager supports me', 78], ['I have the tools to do my job', 71], ['I see a future here', 58], ['Decisions are explained well', 44]].map(function (r) { return { Statement: r[0], 'Top 2 box %': r[1] }; }), fields: { stmt: 'Statement', val: 'Top 2 box %' }, options: { n: 412 }, unit: '% agree or strongly agree, n = 412' },
    draft: function (x) {
      var g = sorted(group(x.rows, x.f.stmt, x.f.val, 'avg')), lo = g[g.length - 1]; if (!lo) return {};
      return { title: 'Only ' + round(lo.value, 0) + '% agree that ' + lo.label.charAt(0).toLowerCase() + lo.label.slice(1), sub: '% agree or strongly agree' + (x.o.n ? ', n = ' + x.o.n : '') + (x.o.n && x.o.n < 30 ? ' (indicative only)' : '') };
    },
    build: function (x) {
      var g = sorted(group(x.rows, x.f.stmt, x.f.val, 'avg')), lo = g[g.length - 1];
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.stmt, measure: x.f.val, agg: 'avg', type: 'hbar', sort: 'desc', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'none', labels: true, labelFormat: 'pct', valueAxis: false, max: 100, highlight: lo ? [lo.label] : [], highlightColor: C.down }) } }];
    } });

  var LIKERT = { 'strongly disagree': C.down, disagree: '#E39A9A', neutral: C.grey, 'neither agree nor disagree': C.grey, agree: '#8FA8FF', 'strongly agree': C.highlight };
  add({ id: 'survey-likert', group: 'survey', name: 'Likert scale spread', question: 'How are answers spread across the scale?', pic: 'likert',
    roles: [{ key: 'stmt', label: 'Statement', kind: 'text', hint: /statement|question|item/ }, { key: 'answer', label: 'Answer (Strongly disagree … Strongly agree)', kind: 'text', hint: /answer|response|scale|rating/ }, { key: 'val', label: 'Responses (count or %)', kind: 'number', opt: true, hint: /count|responses|share|%|n$/ }],
    sample: { name: 'Likert answers', rows: [].concat.apply([], [['Decisions are explained well', [14, 22, 20, 30, 14]], ['I have the tools to do my job', [5, 11, 13, 46, 25]], ['My manager supports me', [3, 7, 12, 44, 34]]].map(function (s) { return ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'].map(function (a, i) { return { Statement: s[0], Answer: a, Responses: s[1][i] }; }); })), fields: { stmt: 'Statement', answer: 'Answer', val: 'Responses' }, unit: 'Share of responses, %' },
    draft: function (x) {
      var st = group(x.rows, x.f.stmt), worst = null;
      st.forEach(function (s) { var rows = x.rows.filter(function (r) { return String(r[x.f.stmt]) === s.label; }), t = 0, neg = 0; rows.forEach(function (r) { var v = x.f.val ? num(r[x.f.val]) || 0 : 1; t += v; if (/disagree/i.test(r[x.f.answer])) neg += v; }); var p = t ? neg / t * 100 : 0; if (!worst || p > worst.p) worst = { label: s.label, p: p }; });
      return worst ? { title: round(worst.p, 0) + '% disagree that ' + worst.label.charAt(0).toLowerCase() + worst.label.slice(1), sub: 'Share of responses by answer, %' } : {};
    },
    build: function (x) {
      var colors = {}; group(x.rows, x.f.answer).forEach(function (a) { var c = LIKERT[low(a.label)]; if (c) colors[a.label] = c; });
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.stmt, measure: x.f.val || undefined, agg: x.f.val ? 'sum' : 'count', series: x.f.answer, type: 'hstacked', sort: 'source', percent: true, title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, tooltip: '{label}\n{series}: {value:pct}', look: look({ legend: 'bottom', labels: 'inside', labelFormat: 'pct', axisFormat: 'pct', max: 100, colors: colors }) } }];
    } });

  add({ id: 'survey-nps', group: 'survey', name: 'Net promoter score', question: 'Would they recommend us? NPS and its three groups.', pic: 'kpi',
    roles: [{ key: 'score', label: 'Score (0–10, one row per answer)', kind: 'number', hint: /score|nps|recommend|rating/ }, { key: 'seg', label: 'Segment (optional, for a chart)', kind: 'text', opt: true, hint: /segment|channel|region|branch|product/ }],
    sample: { name: 'NPS answers', rows: (function () { var out = [], segs = { Agency: [10, 9, 9, 8, 7, 10, 6, 9, 8, 10, 4, 9], Online: [10, 10, 9, 9, 8, 9, 10, 7, 9, 10, 8, 9], Bank: [6, 7, 8, 5, 9, 7, 3, 8, 6, 9, 7, 5] }; Object.keys(segs).forEach(function (s) { segs[s].forEach(function (v, i) { out.push({ Respondent: s.charAt(0) + (i + 1), Segment: s, Score: v }); }); }); return out; })(), fields: { score: 'Score', seg: 'Segment' }, unit: 'Net promoter score = % promoters (9–10) minus % detractors (0–6)' },
    split: function (rows, f) { var n = 0, p = 0, d = 0; rows.forEach(function (r) { var v = num(r[f]); if (v == null) return; n++; if (v >= 9) p++; else if (v <= 6) d++; }); return { n: n, p: n ? p / n * 100 : 0, d: n ? d / n * 100 : 0, pass: n ? (n - p - d) / n * 100 : 0 }; },
    draft: function (x) { var s = this.split(x.rows, x.f.score); return { title: 'Net promoter score is ' + round(s.p - s.d, 0) + ' (n = ' + s.n + ')', sub: '% promoters (9–10) minus % detractors (0–6)' }; },
    build: function (x) {
      var s = this.split(x.rows, x.f.score), self = this;
      var steps = [{ tool: 'insert_kpis', args: { cards: [{ label: 'Net promoter score', value: String(round(s.p - s.d, 0)), note: 'n = ' + s.n }, { label: 'Promoters (9–10)', value: round(s.p, 0) + '%' }, { label: 'Passives (7–8)', value: round(s.pass, 0) + '%' }, { label: 'Detractors (0–6)', value: round(s.d, 0) + '%' }] } }];
      if (x.f.seg) {
        var rows = []; group(x.rows, x.f.seg).forEach(function (g) { var q = self.split(x.rows.filter(function (r) { return String(r[x.f.seg]) === g.label; }), x.f.score); rows.push({ Segment: g.label, Group: 'Detractors', Share: round(q.d, 1) }, { Segment: g.label, Group: 'Passives', Share: round(q.pass, 1) }, { Segment: g.label, Group: 'Promoters', Share: round(q.p, 1) }); });
        steps.push({ tool: 'add_dataset', args: { name: x.ds + ' · NPS groups', rows: rows }, as: 'ds' },
          { tool: 'insert_chart', args: { dataset: '$ds', by: 'Segment', measure: 'Share', series: 'Group', type: 'hstacked', sort: 'source', percent: true, title: x.title } },
          { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'bottom', labels: 'inside', labelFormat: 'pct', axisFormat: 'pct', max: 100, colors: { Detractors: C.down, Passives: C.grey, Promoters: C.highlight } }) } });
      }
      return steps;
    } });

  /* ---------- benchmarking */
  add({ id: 'benchmark-ranked-gap', group: 'benchmark', name: 'Client against peers', question: 'How far is the client from the peer median?', pic: 'rank',
    roles: [{ key: 'co', label: 'Company (peers anonymised)', kind: 'text', hint: /company|peer|insurer|name|firm/ }, { key: 'val', label: 'Measure', kind: 'number' }],
    options: [{ key: 'client', label: 'Client (the bar to highlight)' }, { key: 'better', label: 'Better is', type: 'select', options: [{ value: 'high', label: 'Higher' }, { value: 'low', label: 'Lower (loss ratio, cost)' }], value: 'high' }],
    sample: { name: 'Peer loss ratios', rows: [['Peer A', 62], ['Peer B', 66], ['Client', 74], ['Peer C', 68], ['Peer D', 71], ['Peer E', 64], ['Peer F', 79]].map(function (r) { return { Company: r[0], 'Loss ratio %': r[1] }; }), fields: { co: 'Company', val: 'Loss ratio %' }, options: { client: 'Client', better: 'low' }, unit: 'Loss ratio, %, FY25, 7 companies' },
    gap: function (x) {
      var g = group(x.rows, x.f.co, x.f.val, 'avg'), client = x.o.client || (g[0] && g[0].label), me = g.filter(function (q) { return q.label === client; })[0];
      var med = median(g.filter(function (q) { return q !== me; }).map(function (q) { return q.value; }));
      return { client: client, me: me, med: med, n: g.length };
    },
    draft: function (x) {
      var r = this.gap(x); if (!r.me) return {};
      var d = r.me.value - r.med, good = x.o.better === 'low' ? d <= 0 : d >= 0;
      return { title: r.client + ' is ' + fmt(Math.abs(d)) + (good ? ' better' : ' worse') + ' than the peer median (' + fmt(r.med) + ') on ' + x.f.val, sub: x.f.val + ', ' + r.n + ' companies; the median leaves out the client' };
    },
    build: function (x) {
      var r = this.gap(x), s = [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.co, measure: x.f.val, agg: 'avg', type: 'hbar', sort: x.o.better === 'low' ? 'asc' : 'desc', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'none', labels: true, valueAxis: false, highlight: r.client ? [r.client] : [] }) } }];
      if (r.me) s.push({ tool: 'annotate', args: { action: 'add', chart: '$1', label: r.client, kind: 'callout', text: (r.me.value - r.med >= 0 ? '+' : '−') + fmt(Math.abs(r.me.value - r.med)) + ' vs peer median (' + fmt(r.med) + ')', dx: 110, dy: -36 } });
      return s;
    } });

  add({ id: 'benchmark-scorecard', group: 'benchmark', name: 'Benchmark scorecard', question: 'Across many measures, where is the client behind?', pic: 'table',
    roles: [{ key: 'measure', label: 'Measure', kind: 'text', hint: /measure|metric|kpi|item/ }, { key: 'client', label: 'Client', kind: 'number', hint: /client|us|company/ }, { key: 'median', label: 'Peer median', kind: 'number', hint: /median|peer|average|benchmark/ }, { key: 'better', label: 'Better is (column with High / Low, optional)', kind: 'text', opt: true, hint: /better|direction|good/ }],
    sample: { name: 'Benchmark scorecard', rows: [['Loss ratio %', 74, 66, 'Low'], ['Expense ratio %', 31, 29, 'Low'], ['Claims settled in 30 days %', 72, 68, 'High'], ['Renewal rate %', 81, 85, 'High'], ['Digital share of sales %', 24, 19, 'High'], ['Complaints per 10,000 policies', 9, 12, 'Low']].map(function (r) { return { Measure: r[0], Client: r[1], 'Peer median': r[2], Better: r[3] }; }), fields: { measure: 'Measure', client: 'Client', median: 'Peer median', better: 'Better' }, unit: 'Gap = client minus peer median, signed so that positive is better' },
    rows: function (x) {
      return x.rows.map(function (r) {
        var c = num(r[x.f.client]), m = num(r[x.f.median]), lowGood = x.f.better && /^l/i.test(String(r[x.f.better] || '')), gap = c != null && m != null ? round((lowGood ? m - c : c - m), 2) : null;
        var o = {}; o[x.f.measure] = r[x.f.measure]; o.Client = c; o['Peer median'] = m; o['Better is'] = lowGood ? 'Lower' : 'Higher'; o.Gap = gap; return o;
      });
    },
    draft: function (x) { var r = this.rows(x), behind = r.filter(function (q) { return q.Gap != null && q.Gap < 0; }); return { title: 'The client is behind peers on ' + behind.length + ' of ' + r.length + ' measures', sub: 'Gap is signed so that positive is better than the peer median' }; },
    build: function (x) {
      var r = this.rows(x), spread = median(r.map(function (q) { return Math.abs(q['Peer median'] || 0); })) * 0.05;
      return [{ tool: 'add_dataset', args: { name: x.ds + ' · scorecard', rows: r }, as: 'ds' },
        { tool: 'insert_table', args: { dataset: '$ds', title: x.title, sort: 'Gap' }, as: 'table' },
        { tool: 'table_rules', args: { table: '$table', action: 'set', rules: [{ col: 'Gap', type: 'rag', value: 0, value2: -round(spread || 1, 2), higher: true }, { col: 'Client', type: 'bars', color: C.highlight }] } }];
    } });

  /* ==========================================================================================================
     4.1.0: chart forms seen in recent consulting "chart of the week" pieces and the MGI year in charts:
     comparisons (dumbbell, gap pairs, ranges, parity and 2 × 2 scatters, bubbles, net bars, stacked ranking),
     trends (actual and forecast, stacked area, one line in focus, growth multiples, small multiples, percentile curve)
     and composition (pyramid, Marimekko, three-set overlap, dot-matrix stats, heat grid). Sample data is made up. */
  function uniq(rows, col) { var out = []; rows.forEach(function (r) { var v = r[col]; if (v == null || v === '') return; v = String(v); if (out.indexOf(v) < 0) out.push(v); }); return out; }
  function pctile(vals, p) { var v = vals.slice().sort(function (a, b) { return a - b; }); if (!v.length) return 0; var i = (v.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); }
  // sum of val for rows where col = v (and col2 = v2)
  function sumWhere(rows, val, col, v, col2, v2) { var t = 0; rows.forEach(function (r) { if (String(r[col]) === v && (!col2 || String(r[col2]) === v2)) { var n = num(r[val]); if (n != null) t += n; } }); return t; }
  var GREYS = [C.ink, C.secondary, C.grey, '#D9DDE2', '#8E99A6', '#5B6B7A'];
  function partColours(parts, pick) { var o = {}, k = 0; parts.forEach(function (p) { o[p] = p === pick ? C.highlight : GREYS[k++ % GREYS.length]; }); return o; }
  function sgn(v, d) { return (v >= 0 ? '+' : '−') + fmt(Math.abs(round(v, d == null ? 1 : d))); }
  function rec(names, vals) { return names.reduce(function (o, n, i) { o[n] = vals[i]; return o; }, {}); }

  Ly.GROUPS.splice(Ly.GROUPS.length - 1, 0, { id: 'compare', label: 'Comparisons and relationships' }, { id: 'trend', label: 'Trends and forecasts' }, { id: 'composition', label: 'Shares and composition' });

  /* ---------- comparisons */
  add({ id: 'dumbbell', group: 'compare', name: 'Dumbbell: before and after', question: 'What changed for each item between two points?', pic: 'dumbbell',
    roles: [{ key: 'cat', label: 'Items (rows)', kind: 'text', hint: /item|channel|source|state|country|segment|activity|name|category/ }, { key: 'when', label: 'The two points (e.g. years)', kind: 'text', hint: /year|period|wave|time|when|group|fy/ }, { key: 'val', label: 'Value', kind: 'number' }],
    options: [{ key: 'from', label: 'From (blank = the first)' }, { key: 'to', label: 'To (blank = the last)' }],
    sample: { name: 'Customer trust by channel', rows: [['Insurance agent', 52, 49], ['Bank branch', 38, 33], ['Insurer website', 31, 36], ['Comparison site', 22, 27], ['Friends and family', 47, 45], ['Social media', 6, -9], ['Gen AI assistant', -14, -4]].reduce(function (a, r) { a.push({ Channel: r[0], Year: '2024', 'Net trust': r[1] }); a.push({ Channel: r[0], Year: '2026', 'Net trust': r[2] }); return a; }, []), fields: { cat: 'Channel', when: 'Year', val: 'Net trust' }, unit: 'Net trust (% trusting minus % distrusting), 2024 and 2026, made-up survey' },
    ends: function (x) { var w = uniq(x.rows, x.f.when); return { a: x.o.from || w[0], b: x.o.to || w[w.length - 1] }; },
    moves: function (x) { var e = this.ends(x); return uniq(x.rows, x.f.cat).map(function (c) { var a = sumWhere(x.rows, x.f.val, x.f.cat, c, x.f.when, e.a), b = sumWhere(x.rows, x.f.val, x.f.cat, c, x.f.when, e.b); return { label: c, a: a, b: b, d: b - a }; }); },
    draft: function (x) {
      var e = this.ends(x), m = this.moves(x).sort(function (p, q) { return Math.abs(q.d) - Math.abs(p.d); })[0]; if (!m) return {};
      return { title: m.label + ' moved most, from ' + fmt(m.a) + ' to ' + fmt(m.b) + ' between ' + e.a + ' and ' + e.b, sub: x.f.val + ' by ' + x.f.cat + ', ' + e.a + ' and ' + e.b };
    },
    build: function (x) {
      var e = this.ends(x), order = this.moves(x).sort(function (p, q) { return q.b - p.b; }).map(function (m) { return m.label; }), colors = {}; colors[e.a] = C.grey; colors[e.b] = C.highlight;
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.cat, measure: x.f.val, series: x.f.when, type: 'dumbbell', sort: 'source', order: order, series_only: [e.a, e.b], series_order: [e.a, e.b], title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, tooltip: '{label}\n{series}: {value:short}', look: look({ legend: 'top', colors: colors, refs: [{ axis: 'x', value: 0, dash: false, color: '#CBD2DA' }] }) } }];
    } });

  add({ id: 'gap-pairs', group: 'compare', name: 'Paired bars with the gap', question: 'How far apart are two groups on each measure?', pic: 'pair',
    roles: [{ key: 'cat', label: 'Measures (rows)', kind: 'text', hint: /measure|metric|question|item|kpi|statement/ }, { key: 'grp', label: 'The two groups', kind: 'text', hint: /group|segment|cohort|who|type/ }, { key: 'val', label: 'Value', kind: 'number' }],
    options: [{ key: 'unit', label: 'Gap unit', value: 'pts' }],
    sample: { name: 'Claim experience survey', rows: [['Satisfied with insurer', 78, 61], ['Would renew', 82, 70], ['Would recommend', 64, 41], ['Trust the insurer', 71, 58], ['Understand the cover', 55, 49]].reduce(function (a, r) { a.push({ Measure: r[0], Group: 'No claim', Share: r[1] }); a.push({ Measure: r[0], Group: 'Had a claim', Share: r[2] }); return a; }, []), fields: { cat: 'Measure', grp: 'Group', val: 'Share' }, unit: '% of policyholders agreeing, by claim experience in the last year, made-up survey' },
    gaps: function (x) { var g = uniq(x.rows, x.f.grp).slice(0, 2); return { g: g, list: uniq(x.rows, x.f.cat).map(function (c) { var a = sumWhere(x.rows, x.f.val, x.f.cat, c, x.f.grp, g[0]), b = sumWhere(x.rows, x.f.val, x.f.cat, c, x.f.grp, g[1]); return { label: c, a: a, b: b, d: b - a }; }) }; },
    draft: function (x) {
      var r = this.gaps(x), big = r.list.slice().sort(function (p, q) { return Math.abs(q.d) - Math.abs(p.d); })[0]; if (!big) return {};
      return { title: 'The widest gap is on ' + big.label.toLowerCase() + ': ' + fmt(Math.abs(round(big.d))) + ' ' + (x.o.unit || 'pts') + ' between ' + r.g[0] + ' and ' + r.g[1], sub: x.f.val + ' by ' + x.f.grp };
    },
    build: function (x) {
      var r = this.gaps(x), ren = {}, colors = {}, u = x.o.unit || 'pts', order = r.list.slice().sort(function (p, q) { return Math.abs(q.d) - Math.abs(p.d); }).map(function (q) { return q.label; });
      r.list.forEach(function (q) { ren[q.label] = q.label + ' (' + sgn(q.d, 0) + ' ' + u + ')'; });
      colors[r.g[0]] = C.grey; if (r.g[1]) colors[r.g[1]] = C.highlight;
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.cat, measure: x.f.val, series: x.f.grp, type: 'hbar', sort: 'source', order: order, rename: ren, series_only: r.g, title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'top', labels: true, valueAxis: false, colors: colors }) } }];
    } });

  add({ id: 'range-dots', group: 'compare', name: 'Ranges with the median', question: 'How wide is the spread in each group, and where is the middle?', pic: 'range',
    roles: [{ key: 'grp', label: 'Groups', kind: 'text', hint: /group|segment|type|sector|peer|tier|category/ }, { key: 'val', label: 'Value of each member', kind: 'number' }],
    options: [{ key: 'lo', label: 'Low end (percentile)', type: 'number', value: 25 }, { key: 'hi', label: 'High end (percentile)', type: 'number', value: 75 }],
    sample: { name: 'Combined ratio by insurer type', rows: [['Public sector', [118, 112, 109, 121, 115]], ['Large private', [101, 98, 104, 96, 103, 99]], ['Mid-size private', [108, 97, 112, 104, 95, 117]], ['Standalone health', [96, 103, 99, 92, 101]], ['Specialist', [88, 94, 107, 91, 99]]].reduce(function (a, g) { g[1].forEach(function (v, i) { a.push({ Type: g[0], Insurer: g[0] + ' ' + (i + 1), 'Combined ratio': v }); }); return a; }, []), fields: { grp: 'Type', val: 'Combined ratio' }, unit: 'Combined ratio, %, FY25; bar = 25th to 75th percentile, dot = median, made-up insurers' },
    stats: function (x) { var lo = (num(x.o.lo) == null ? 25 : num(x.o.lo)) / 100, hi = (num(x.o.hi) == null ? 75 : num(x.o.hi)) / 100; return uniq(x.rows, x.f.grp).map(function (g) { var v = x.rows.filter(function (r) { return String(r[x.f.grp]) === g; }).map(function (r) { return num(r[x.f.val]); }).filter(function (n) { return n != null; }); return { label: g, lo: pctile(v, lo), mid: pctile(v, 0.5), hi: pctile(v, hi), n: v.length }; }); },
    draft: function (x) { var s = this.stats(x).sort(function (p, q) { return (q.hi - q.lo) - (p.hi - p.lo); }); if (!s.length) return {}; return { title: s[0].label + ' has the widest spread (' + fmt(s[0].lo) + ' to ' + fmt(s[0].hi) + ')', sub: x.f.val + ' by ' + x.f.grp + '; bar = middle half, dot = median' }; },
    build: function (x) {
      var s = this.stats(x), lo = 'P' + (num(x.o.lo) == null ? 25 : num(x.o.lo)), hi = 'P' + (num(x.o.hi) == null ? 75 : num(x.o.hi)), rows = [];
      s.forEach(function (g) { rows.push({ Group: g.label, Stat: lo, Value: round(g.lo, 2) }); rows.push({ Group: g.label, Stat: 'Median', Value: round(g.mid, 2) }); rows.push({ Group: g.label, Stat: hi, Value: round(g.hi, 2) }); });
      return [{ tool: 'add_dataset', args: { name: x.ds + ' · ranges', rows: rows }, as: 'ds' },
        { tool: 'insert_chart', args: { dataset: '$ds', by: 'Group', measure: 'Value', series: 'Stat', type: 'range', sort: 'source', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, tooltip: '{label}\n{series}: {value:short}', look: look({ legend: 'none', colors: { Median: C.highlight } }) } }];
    } });

  function xyRoles(size) { return [{ key: 'name', label: 'Points (one per item)', kind: 'text', hint: /name|item|country|branch|state|line|product|event|company|segment/ }, { key: 'x', label: 'Across (x)', kind: 'number' }, { key: 'y', label: 'Up (y)', kind: 'number' }].concat(size ? [{ key: 'size', label: 'Bubble size', kind: 'number', hint: /size|volume|value|premium|amount|exposure|loss/ }] : []); }
  function points(x) { return uniq(x.rows, x.f.name).map(function (n) { var rs = x.rows.filter(function (r) { return String(r[x.f.name]) === n; }), k = rs.length || 1, s = function (c) { return rs.reduce(function (t, r) { return t + (num(r[c]) || 0); }, 0); }; return { n: n, x: s(x.f.x) / k, y: s(x.f.y) / k, v: x.f.size ? s(x.f.size) : 0 }; }); }

  add({ id: 'parity-scatter', group: 'compare', name: 'Scatter against the 45° line', question: 'Which items grow (or cost) faster on one measure than the other?', pic: 'parity',
    roles: xyRoles(false), options: [{ key: 'above', label: 'Words for points above the line', value: 'above the line' }],
    sample: { name: 'Growth by line of business', rows: [['Motor', 8.2, 9.6], ['Health', 14.5, 12.1], ['Fire', 6.1, 7.8], ['Marine', 4.2, 3.1], ['Crop', 9.8, 13.4], ['Liability', 11.2, 8.5], ['Engineering', 5.5, 6.9], ['Personal accident', 7.4, 5.2]].map(function (r) { return { Line: r[0], 'Premium growth': r[1], 'Claims growth': r[2] }; }), fields: { name: 'Line', x: 'Premium growth', y: 'Claims growth' }, unit: 'Annual growth, %, FY22–FY25; above the line = claims growing faster than premium, made-up data' },
    draft: function (x) { var p = points(x), up = p.filter(function (q) { return q.y > q.x; }); return { title: up.length + ' of ' + p.length + ' ' + x.f.name.toLowerCase() + 's have ' + x.f.y.toLowerCase() + ' running ahead of ' + x.f.x.toLowerCase(), sub: x.f.y + ' against ' + x.f.x + '; the dashed line is where they are equal' }; },
    build: function (x) {
      var p = points(x), colors = {}; p.forEach(function (q) { colors[q.n] = q.y > q.x ? C.highlight : C.secondary; });
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.name, type: 'scatter', x: x.f.x, y: x.f.y, agg: 'avg', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'none', labels: true, grid: true, colors: colors, refs: [{ diag: true, label: x.o.above || 'above the line' }] }) } }];
    } });

  add({ id: 'quadrant-2x2', group: 'compare', name: '2 × 2 matrix', question: 'Which items are high on both measures, and which are low on both?', pic: 'quad',
    roles: xyRoles(false), options: [{ key: 'xcut', label: 'Split across at (blank = median)', type: 'number' }, { key: 'ycut', label: 'Split up at (blank = median)', type: 'number' }, { key: 'tr', label: 'Name of the top-right box', value: 'Stars' }],
    sample: { name: 'Branch growth and profit', rows: [['Pune', 18, 12], ['Nagpur', 6, 9], ['Indore', 22, 4], ['Surat', 14, 15], ['Kochi', 9, 2], ['Jaipur', 16, 11], ['Lucknow', 4, -3], ['Coimbatore', 11, 13], ['Bhopal', 7, 6], ['Vizag', 20, 14]].map(function (r) { return { Branch: r[0], 'Premium growth': r[1], 'Profit margin': r[2] }; }), fields: { name: 'Branch', x: 'Premium growth', y: 'Profit margin' }, options: { tr: 'Grow and earn' }, unit: 'Premium growth and profit margin, %, FY25; lines at the medians, made-up branches' },
    cuts: function (x, p) { var g = function (v) { return v == null || v === '' ? null : num(v); }; return { x: g(x.o.xcut) != null ? g(x.o.xcut) : median(p.map(function (q) { return q.x; })), y: g(x.o.ycut) != null ? g(x.o.ycut) : median(p.map(function (q) { return q.y; })) }; },
    draft: function (x) { var p = points(x), c = this.cuts(x, p), tr = p.filter(function (q) { return q.x > c.x && q.y > c.y; }); return { title: tr.length + ' of ' + p.length + ' are high on both ' + x.f.x.toLowerCase() + ' and ' + x.f.y.toLowerCase() + (tr.length ? ', led by ' + tr.sort(function (a, b) { return b.x + b.y - a.x - a.y; })[0].n : ''), sub: x.f.y + ' against ' + x.f.x + '; lines at ' + (x.o.xcut || x.o.ycut ? 'the chosen cut-offs' : 'the medians') }; },
    build: function (x) {
      var p = points(x), c = this.cuts(x, p), colors = {}; p.forEach(function (q) { colors[q.n] = q.x > c.x && q.y > c.y ? C.highlight : C.secondary; });
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.name, type: 'scatter', x: x.f.x, y: x.f.y, agg: 'avg', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'none', labels: true, grid: true, colors: colors, refs: [{ axis: 'x', value: round(c.x, 2) }, { axis: 'y', value: round(c.y, 2), label: x.o.tr || 'Stars' }] }) } }];
    } });

  add({ id: 'bubble-impact', group: 'compare', name: 'Bubble chart with one in focus', question: 'Which item is big on three measures at once?', pic: 'bubble',
    roles: xyRoles(true), options: [{ key: 'pick', label: 'Bubble to highlight (blank = the largest)' }],
    sample: { name: 'Catastrophe events', rows: [['Coastal cyclone', 9, 11.5, 2400], ['Urban flood', 6, 7.2, 1650], ['Heatwave', 40, 3.1, 520], ['Hailstorm', 2, 1.4, 180], ['Earthquake', 3, 4.6, 940], ['Landslide', 5, 0.9, 120], ['River flood', 21, 8.8, 1320]].map(function (r) { return { Event: r[0], 'Duration (days)': r[1], 'Share of annual claims': r[2], 'Incurred (millions)': r[3] }; }), fields: { name: 'Event', x: 'Duration (days)', y: 'Share of annual claims', size: 'Incurred (millions)' }, unit: 'Event duration, days; share of the year\'s claims, %; bubble = incurred loss, made-up events' },
    draft: function (x) { var p = points(x).sort(function (a, b) { return b.v - a.v; }), f = x.o.pick ? p.filter(function (q) { return q.n === x.o.pick; })[0] || p[0] : p[0]; if (!f) return {}; return { title: f.n + ' is the largest at ' + fmt(f.v) + ' ' + x.f.size.replace(/\s*\(.*\)/, '').toLowerCase(), sub: x.f.y + ' against ' + x.f.x + '; bubble size = ' + x.f.size }; },
    build: function (x) {
      var p = points(x).sort(function (a, b) { return b.v - a.v; }), pick = x.o.pick || (p[0] && p[0].n);
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.name, type: 'bubble', x: x.f.x, y: x.f.y, size: x.f.size, agg: 'sum', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'none', labels: true, grid: true, highlight: [pick] }) } }];
    } });

  add({ id: 'net-diverging', group: 'compare', name: 'Net bars either side of zero', question: 'Which groups are net positive and which net negative?', pic: 'variance',
    roles: [{ key: 'cat', label: 'Groups (bars)', kind: 'text', hint: /group|segment|generation|age|state|country|cohort/ }, { key: 'val', label: 'Net value (+ / −)', kind: 'number', hint: /net|balance|intent|score/ }, { key: 'series', label: 'Split by (optional)', kind: 'text', opt: true, hint: /product|channel|line|type/ }],
    sample: { name: 'Net intent to change cover', rows: [['Gen Z', 'Health', 18], ['Gen Z', 'Motor', 6], ['Gen Z', 'Life', -4], ['Millennials', 'Health', 12], ['Millennials', 'Motor', -3], ['Millennials', 'Life', 5], ['Gen X', 'Health', 4], ['Gen X', 'Motor', -9], ['Gen X', 'Life', -6], ['Boomers', 'Health', -2], ['Boomers', 'Motor', -14], ['Boomers', 'Life', -11]].map(function (r) { return { Generation: r[0], Product: r[1], 'Net intent': r[2] }; }), fields: { cat: 'Generation', val: 'Net intent', series: 'Product' }, unit: 'Net intent to increase cover next year (% more minus % less), made-up survey' },
    draft: function (x) {
      var g = group(x.rows, x.f.cat, x.f.val, x.f.series ? 'avg' : 'sum'), neg = g.filter(function (q) { return q.value < 0; }), low_ = sorted(g, 'asc')[0]; if (!low_) return {};
      return { title: neg.length ? low_.label + ' is the most negative' + (neg.length > 1 ? '; ' + neg.length + ' of ' + g.length + ' are below zero' : '') : 'Every group is net positive; ' + sorted(g)[0].label + ' leads', sub: x.f.val + ' by ' + x.f.cat + (x.f.series ? ' and ' + x.f.series : '') };
    },
    build: function (x) {
      var st = x.f.series ? look({ legend: 'top', labels: true, valueAxis: false, colors: partColours(uniq(x.rows, x.f.series), null) }) : look({ legend: 'none', labels: true, valueAxis: false, signs: { up: C.highlight, down: C.down } });
      st.refs = [{ axis: 'x', value: 0, dash: false, color: '#94A3B8' }];
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.cat, measure: x.f.val, series: x.f.series || undefined, type: 'hbar', sort: x.f.series ? 'source' : 'desc', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: st } }];
    } });

  add({ id: 'stacked-ranked', group: 'compare', name: 'Stacked bars ranked by total', question: 'Who is biggest overall, and what is it made of?', pic: 'hstack',
    roles: [{ key: 'cat', label: 'Items (bars)', kind: 'text', hint: /item|product|category|state|segment|name/ }, { key: 'part', label: 'Parts of each bar', kind: 'text', hint: /type|part|kind|split|channel/ }, { key: 'val', label: 'Value', kind: 'number' }],
    options: [{ key: 'pick', label: 'Part to highlight (blank = the first)' }],
    sample: { name: 'Bought online in the last 3 months', rows: [['Motor renewal', 21, 9], ['Travel', 6, 17], ['Health top-up', 11, 8], ['Two-wheeler', 14, 4], ['Home contents', 3, 7], ['Personal accident', 4, 5], ['Pet', 2, 3]].reduce(function (a, r) { a.push({ Product: r[0], Purchase: 'Repeat', Share: r[1] }); a.push({ Product: r[0], Purchase: 'First time', Share: r[2] }); return a; }, []), fields: { cat: 'Product', part: 'Purchase', val: 'Share' }, unit: '% of online buyers, by product and type of purchase, made-up survey' },
    draft: function (x) { var g = sorted(group(x.rows, x.f.cat, x.f.val)); if (!g.length) return {}; var parts = uniq(x.rows, x.f.part), pick = x.o.pick || parts[0], share = g[0].value ? sumWhere(x.rows, x.f.val, x.f.cat, g[0].label, x.f.part, pick) / g[0].value * 100 : 0; return { title: g[0].label + ' leads at ' + fmt(g[0].value) + '; ' + round(share, 0) + '% of it is ' + String(pick).toLowerCase(), sub: x.f.val + ' by ' + x.f.cat + ', split by ' + x.f.part }; },
    build: function (x) {
      var parts = uniq(x.rows, x.f.part), pick = x.o.pick || parts[0], colors = {}; colors[pick] = C.highlight; parts.filter(function (p) { return p !== pick; }).forEach(function (p, i) { colors[p] = [C.grey, C.secondary, '#D9DDE2'][i % 3]; });
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.cat, measure: x.f.val, series: x.f.part, type: 'hstacked', sort: 'desc', series_order: [pick], title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'top', labels: 'inside', valueAxis: false, colors: colors }) } }];
    } });

  /* ---------- trends */
  add({ id: 'actual-forecast', group: 'trend', name: 'Actuals then forecast', question: 'Where are we heading? History solid, forecast lighter.', pic: 'forecast',
    roles: [{ key: 'period', label: 'Period (in order)', kind: 'text', hint: /year|fy|period|month|quarter|date/ }, { key: 'val', label: 'Value', kind: 'number' }, { key: 'kind', label: 'Actual / forecast column (optional)', kind: 'text', opt: true, hint: /kind|type|status|scenario|actual|forecast|basis/ }],
    options: [{ key: 'first', label: 'First forecast period (if there is no actual / forecast column)' }],
    sample: { name: 'Policies sold online', rows: [['FY21', 4.1], ['FY22', 5.6], ['FY23', 7.4], ['FY24', 9.9], ['FY25', 12.8], ['FY26', 16.5], ['FY27', 20.6], ['FY28', 25.1], ['FY29', 29.8], ['FY30', 34.4]].map(function (r) { return { Year: r[0], Policies: r[1] }; }), fields: { period: 'Year', val: 'Policies' }, options: { first: 'FY26' }, unit: 'Policies sold online, millions; FY26 onwards is a forecast, made-up data' },
    split: function (x) {
      var g = group(x.rows, x.f.period, x.f.val), fc = {}, seen = false;
      if (x.f.kind) uniq(x.rows, x.f.period).forEach(function (p) { var r = x.rows.filter(function (q) { return String(q[x.f.period]) === p; })[0]; fc[p] = /fore|proj|plan|est|budget|target|scen/i.test(String(r[x.f.kind])); });
      else g.forEach(function (p) { if (x.o.first && p.label === String(x.o.first)) seen = true; fc[p.label] = seen; });
      return g.map(function (p) { return { label: p.label, value: p.value, fc: !!fc[p.label] }; });
    },
    draft: function (x) {
      var s = this.split(x), act = s.filter(function (p) { return !p.fc; }), last = s[s.length - 1], base = act[act.length - 1]; if (!last || !base || last === base) return { title: x.f.val + ' reached ' + fmt(last ? last.value : 0), sub: x.f.val };
      var n = s.indexOf(last) - s.indexOf(base), g = base.value > 0 && last.value > 0 ? (Math.pow(last.value / base.value, 1 / n) - 1) * 100 : null;
      return { title: x.f.val + ' is forecast to reach ' + fmt(last.value) + ' by ' + last.label + (g != null ? ', about ' + round(g, 0) + '% a year' : ''), sub: x.f.val + ', ' + s[0].label + '–' + last.label + '; lighter bars are forecast' };
    },
    build: function (x) {
      var s = this.split(x), rows = s.map(function (p) { return { Period: p.label, Basis: p.fc ? 'Forecast' : 'Actual', Value: round(p.value, 2) }; }), act = s.filter(function (p) { return !p.fc; }), base = act[act.length - 1], last = s[s.length - 1];
      var steps = [{ tool: 'add_dataset', args: { name: x.ds + ' · actual and forecast', rows: rows }, as: 'ds' },
        { tool: 'insert_chart', args: { dataset: '$ds', by: 'Period', measure: 'Value', series: 'Basis', type: 'stacked', sort: 'source', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, tooltip: '{label}\n{series}: {value:short}', look: look({ legend: 'top', labels: true, valueAxis: false, colors: { Actual: C.ink, Forecast: '#8FA8FF' } }) } }];
      if (base && last && base !== last) steps.push({ tool: 'chart_shapes', args: { action: 'add', chart: '$1', kind: 'cagr', a: { label: base.label, series: 0 }, b: { label: last.label, series: 1 }, periods: s.indexOf(last) - s.indexOf(base) } });
      return steps;
    } });

  add({ id: 'stacked-area', group: 'trend', name: 'Stacked area over time', question: 'How has the total grown, and which part drove it?', pic: 'area',
    roles: [{ key: 'period', label: 'Period (in order)', kind: 'text', hint: /year|fy|period|month|quarter|date/ }, { key: 'part', label: 'Parts', kind: 'text', hint: /line|segment|source|region|type|product|channel/ }, { key: 'val', label: 'Value', kind: 'number' }],
    options: [{ key: 'pick', label: 'Part to highlight (blank = the one that grew most)' }],
    sample: { name: 'Premium by line', rows: ['FY17', 'FY18', 'FY19', 'FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25'].reduce(function (a, y, i) { [['Motor', 60 + i * 4], ['Health', 32 + i * 9 + (i > 3 ? 8 : 0)], ['Fire and property', 14 + i * 2], ['Other', 18 + i * 2]].forEach(function (p) { a.push({ Year: y, Line: p[0], Premium: p[1] }); }); return a; }, []), fields: { period: 'Year', part: 'Line', val: 'Premium' }, unit: 'Gross written premium by line, billions, FY17–FY25, made-up data' },
    grow: function (x) { var per = uniq(x.rows, x.f.period), a = per[0], b = per[per.length - 1]; return uniq(x.rows, x.f.part).map(function (p) { return { label: p, a: sumWhere(x.rows, x.f.val, x.f.part, p, x.f.period, a), b: sumWhere(x.rows, x.f.val, x.f.part, p, x.f.period, b), first: a, last: b }; }).sort(function (p, q) { return (q.b - q.a) - (p.b - p.a); }); },
    draft: function (x) { var g = this.grow(x); if (!g.length) return {}; var t = g.reduce(function (s, p) { return s + p.b - p.a; }, 0), top = x.o.pick ? g.filter(function (p) { return p.label === x.o.pick; })[0] || g[0] : g[0]; return { title: top.label + ' added ' + fmt(top.b - top.a) + (t > 0 ? ', ' + round((top.b - top.a) / t * 100, 0) + '% of the growth' : '') + ' since ' + top.first, sub: x.f.val + ' by ' + x.f.part + ', ' + top.first + '–' + top.last }; },
    build: function (x) {
      var g = this.grow(x), pick = x.o.pick || (g[0] && g[0].label), parts = uniq(x.rows, x.f.part), order = [pick].concat(parts.filter(function (p) { return p !== pick; }));
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.period, measure: x.f.val, series: x.f.part, type: 'stackedarea', sort: 'source', series_order: order, title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, look: look({ legend: 'right', colors: partColours(parts, pick) }) } }];
    } });

  add({ id: 'line-focus', group: 'trend', name: 'Several lines, one in focus', question: 'How does one series compare with the rest over time?', pic: 'lines',
    roles: [{ key: 'period', label: 'Period (in order)', kind: 'text', hint: /year|fy|period|month|quarter|date/ }, { key: 'line', label: 'Lines', kind: 'text', hint: /segment|region|line|product|group|company|series/ }, { key: 'val', label: 'Value', kind: 'number' }],
    options: [{ key: 'pick', label: 'Line in focus (blank = the latest highest)' }, { key: 'dashed', label: 'Line(s) to dash, comma separated (e.g. a projection)' }],
    sample: { name: 'Loss ratio by segment', rows: ['FY18', 'FY19', 'FY20', 'FY21', 'FY22', 'FY23', 'FY24', 'FY25'].reduce(function (a, y, i) { [['Retail health', [71, 73, 69, 88, 79, 76, 74, 72]], ['Group health', [92, 95, 90, 104, 97, 95, 98, 101]], ['Motor own damage', [66, 64, 58, 62, 67, 69, 70, 71]], ['Commercial', [61, 63, 66, 64, 60, 62, 59, 58]]].forEach(function (p) { a.push({ Year: y, Segment: p[0], 'Loss ratio': p[1][i] }); }); return a; }, []), fields: { period: 'Year', line: 'Segment', val: 'Loss ratio' }, unit: 'Incurred loss ratio, %, FY18–FY25, made-up data' },
    draft: function (x) {
      var per = uniq(x.rows, x.f.period), last = per[per.length - 1], lines = uniq(x.rows, x.f.line).map(function (l) { return { label: l, v: sumWhere(x.rows, x.f.val, x.f.line, l, x.f.period, last) }; }).sort(function (a, b) { return b.v - a.v; });
      var pick = x.o.pick || (lines[0] && lines[0].label), pv = x.rows.filter(function (r) { return String(r[x.f.line]) === pick; }), peak = pv.slice().sort(function (a, b) { return (num(b[x.f.val]) || 0) - (num(a[x.f.val]) || 0); })[0];
      return { title: pick + (peak ? ' peaked at ' + fmt(num(peak[x.f.val])) + ' in ' + peak[x.f.period] : '') + (lines[0] && lines[0].label === pick ? ' and is still the highest' : ''), sub: x.f.val + ' by ' + x.f.line + ', ' + per[0] + '–' + last };
    },
    build: function (x) {
      var per = uniq(x.rows, x.f.period), last = per[per.length - 1], lines = uniq(x.rows, x.f.line), pick = x.o.pick || lines.slice().sort(function (a, b) { return sumWhere(x.rows, x.f.val, x.f.line, b, x.f.period, last) - sumWhere(x.rows, x.f.val, x.f.line, a, x.f.period, last); })[0];
      var dashed = String(x.o.dashed || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.period, measure: x.f.val, series: x.f.line, type: 'line', sort: 'source', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, tooltip: '{label}\n{series}: {value:short}', look: look({ legend: 'right', highlight: [pick], restColor: C.grey, dashed: dashed.length ? dashed : undefined, straight: true }) } }];
    } });

  function multiples(x) { return uniq(x.rows, x.f.item).map(function (i) { var a = sumWhere(x.rows, x.f.before, x.f.item, i), b = sumWhere(x.rows, x.f.after, x.f.item, i); return { label: i, a: a, b: b, m: a ? b / a : null }; }); }
  add({ id: 'growth-multiples', group: 'trend', name: 'Growth multiples (2.5×)', question: 'Which items more than doubled?', pic: 'rank',
    roles: [{ key: 'item', label: 'Items', kind: 'text', hint: /item|area|trend|technology|product|segment|name/ }, { key: 'before', label: 'Before (number)', kind: 'number', hint: /before|start|base|20\d\d|from|prior|last/ }, { key: 'after', label: 'After (number)', kind: 'number', hint: /after|end|now|latest|to|current/ }],
    options: [{ key: 'cut', label: 'Highlight from (multiple)', type: 'number', value: 2 }],
    sample: { name: 'Investment by technology area', rows: [['Agentic AI', 0.6, 7.7], ['Claims automation', 2.1, 5.8], ['Telematics', 1.4, 2.2], ['Cyber analytics', 1.1, 3.4], ['Parametric cover', 0.4, 1.5], ['Core system cloud', 3.2, 4.0], ['Fraud detection', 1.8, 2.5], ['Embedded insurance', 0.9, 2.3]].map(function (r) { return { Area: r[0], FY25: r[1], FY26: r[2] }; }), fields: { item: 'Area', before: 'FY25', after: 'FY26' }, unit: 'Investment FY26 as a multiple of FY25, made-up data' },
    draft: function (x) { var m = multiples(x).filter(function (q) { return q.m != null; }).sort(function (a, b) { return b.m - a.m; }), cut = num(x.o.cut) || 2, over = m.filter(function (q) { return q.m >= cut; }); if (!m.length) return {}; return { title: over.length + ' of ' + m.length + ' at least ' + (cut === 2 ? 'doubled' : 'grew ' + cut + '×') + '; ' + m[0].label + ' grew most at ' + round(m[0].m) + '×', sub: x.f.after + ' as a multiple of ' + x.f.before }; },
    build: function (x) {
      var m = multiples(x).filter(function (q) { return q.m != null; }), cut = num(x.o.cut) || 2;
      return [{ tool: 'add_dataset', args: { name: x.ds + ' · multiples', rows: m.map(function (q) { return { Item: q.label, Multiple: round(q.m, 2), Before: q.a, After: q.b }; }) }, as: 'ds' },
        { tool: 'insert_chart', args: { dataset: '$ds', by: 'Item', measure: 'Multiple', type: 'hbar', sort: 'desc', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, tooltip: '{label}\n{value:0.0}× ({Before:short} to {After:short})', look: look({ legend: 'none', labels: true, labelFormat: '0.0', labelSuffix: '×', valueAxis: false, highlight: m.filter(function (q) { return q.m >= cut; }).map(function (q) { return q.label; }), refs: [{ axis: 'x', value: 1, label: '1× (no growth)' }] }) } }];
    } });

  add({ id: 'small-multiples', group: 'trend', name: 'Small multiples', question: 'The same small chart for each item, side by side.', pic: 'multiples', titleOnPage: true,
    roles: [{ key: 'panel', label: 'One chart for each', kind: 'text', hint: /area|segment|region|product|trend|state|country|line/ }, { key: 'period', label: 'Across (e.g. years)', kind: 'text', hint: /year|fy|period|month|quarter|date/ }, { key: 'val', label: 'Value', kind: 'number' }],
    options: [{ key: 'type', label: 'Chart', type: 'select', options: [{ value: 'bar', label: 'Columns' }, { value: 'line', label: 'Line' }], value: 'bar' }, { key: 'max', label: 'Most charts', type: 'number', value: 6 }, { key: 'cut', label: 'Highlight items that grew at least (multiple)', type: 'number', value: 2 }],
    sample: { name: 'Claims by region', rows: ['North', 'South', 'East', 'West', 'Central', 'North-east'].reduce(function (a, r, k) { [[120, 135, 150, 171], [210, 228, 260, 412], [90, 88, 95, 101], [180, 230, 290, 380], [60, 64, 70, 72], [20, 28, 35, 48]][k].forEach(function (v, i) { a.push({ Region: r, Quarter: 'Q' + (i + 1), Claims: v }); }); return a; }, []), fields: { panel: 'Region', period: 'Quarter', val: 'Claims' }, unit: 'Claims reported per quarter, thousands, FY26, made-up data' },
    panels: function (x) { var per = uniq(x.rows, x.f.period), a = per[0], b = per[per.length - 1], max = num(x.o.max) || 6; return uniq(x.rows, x.f.panel).slice(0, max).map(function (p) { var va = sumWhere(x.rows, x.f.val, x.f.panel, p, x.f.period, a), vb = sumWhere(x.rows, x.f.val, x.f.panel, p, x.f.period, b); return { label: p, m: va ? vb / va : null }; }); },
    draft: function (x) { var p = this.panels(x), cut = num(x.o.cut) || 2, over = p.filter(function (q) { return q.m != null && q.m >= cut; }), per = uniq(x.rows, x.f.period); return { title: over.length ? over.map(function (q) { return q.label; }).slice(0, 3).join(', ') + (over.length > 1 ? ' have' : ' has') + ' grown ' + (cut === 2 ? 'twofold' : cut + '×') + ' or more since ' + per[0] : 'No ' + x.f.panel.toLowerCase() + ' has grown ' + cut + '× since ' + per[0], sub: x.f.val + ' by ' + x.f.period + ', one chart for each ' + x.f.panel.toLowerCase() }; },
    build: function (x) {
      var p = this.panels(x), cut = num(x.o.cut) || 2, span = p.length <= 2 ? 6 : p.length === 4 ? 6 : 4;
      var s = [{ tool: 'insert_text_block', args: { title: x.title, html: '<p style="margin:0;color:#4B5563">' + esc(x.sub) + '</p>', span: 12 }, as: 'block' }];
      p.forEach(function (q) {
        s.push({ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.period, measure: x.f.val, type: x.o.type || 'bar', sort: 'source', where: [{ field: x.f.panel, op: 'eq', value: q.label }], span: span, height: 200, title: q.label + (q.m != null ? ' · ' + round(q.m) + '×' : '') } });
        s.push({ tool: 'chart_settings', args: { chart: '$' + (s.filter(function (t) { return t.tool === 'insert_chart'; }).length), subtitle: '', look: look({ legend: 'none', labels: true, valueAxis: false, highlight: [], restColor: q.m != null && q.m >= cut ? C.highlight : C.secondary }) } });
      });
      return s;
    } });

  add({ id: 'percentile-curve', group: 'trend', name: 'Sorted curve (percentiles)', question: 'How uneven is it? Everyone sorted from lowest to highest.', pic: 'curve',
    roles: [{ key: 'name', label: 'Items', kind: 'text', hint: /name|agent|item|branch|policy|skill|id/ }, { key: 'val', label: 'Value', kind: 'number' }],
    options: [{ key: 'name_top', label: 'Name the top', type: 'number', value: 3 }],
    sample: { name: 'Policies per agent', rows: (function () { var out = [], seed = 7; for (var i = 1; i <= 80; i++) { seed = (seed * 9301 + 49297) % 233280; var r = seed / 233280; out.push({ Agent: 'Agent ' + (i < 10 ? '0' : '') + i, Policies: Math.round(8 + 140 * Math.pow(r, 3.2)) }); } return out; })(), fields: { name: 'Agent', val: 'Policies' }, unit: 'Policies sold per agent, FY25, sorted lowest to highest, made-up agents' },
    curve: function (x) { var v = uniq(x.rows, x.f.name).map(function (n) { return { n: n, v: sumWhere(x.rows, x.f.val, x.f.name, n) }; }).sort(function (a, b) { return a.v - b.v; }), N = v.length; return v.map(function (p, i) { return { n: p.n, v: p.v, p: N > 1 ? Math.round(i / (N - 1) * 100) : 100 }; }); },
    draft: function (x) { var c = this.curve(x), vals = c.map(function (p) { return p.v; }), q3 = pctile(vals, 0.75), md = pctile(vals, 0.5); if (!c.length) return {}; return { title: 'The top quarter sit above ' + fmt(q3) + (md ? ', ' + round(q3 / md) + '× the median of ' + fmt(md) : ''), sub: x.f.val + ' by ' + x.f.name + ', sorted lowest to highest (percentile)' }; },
    build: function (x) {
      var c = this.curve(x), seen = {}, rows = [];
      c.forEach(function (p) { var k = 'P' + p.p; if (seen[k]) { seen[k].Value = Math.max(seen[k].Value, p.v); seen[k].Name = p.n; return; } seen[k] = { Percentile: k, Value: p.v, Name: p.n }; rows.push(seen[k]); });
      var top = rows.slice().sort(function (a, b) { return b.Value - a.Value; }).slice(0, num(x.o.name_top) == null ? 3 : num(x.o.name_top));
      var s = [{ tool: 'add_dataset', args: { name: x.ds + ' · sorted', rows: rows }, as: 'ds' },
        { tool: 'insert_chart', args: { dataset: '$ds', by: 'Percentile', measure: 'Value', type: 'line', sort: 'source', title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, tooltip: '{Name}: {value:short}', look: look({ legend: 'none', colors: { Value: C.highlight }, refs: [{ axis: 'y', value: round(pctile(c.map(function (p) { return p.v; }), 0.5), 2), label: 'median' }] }) } }];
      top.forEach(function (t, i) { s.push({ tool: 'annotate', args: { action: 'add', chart: '$1', label: t.Percentile, kind: 'callout', text: t.Name + ': ' + fmt(t.Value), dx: -150 - i * 10, dy: 24 + i * 34 } }); });
      return s;
    } });

  /* ---------- composition */
  add({ id: 'pyramid', group: 'composition', name: 'Population pyramid', question: 'How do two groups compare across bands, back to back?', pic: 'pyramid',
    roles: [{ key: 'band', label: 'Bands (e.g. age)', kind: 'text', hint: /age|band|bucket|tenure|range|group/ }, { key: 'side', label: 'The two sides', kind: 'text', hint: /gender|sex|side|group|type|segment/ }, { key: 'val', label: 'Value', kind: 'number' }],
    sample: { name: 'Policyholders by age', rows: [['70+', 42, 51], ['60–69', 88, 94], ['50–59', 131, 126], ['40–49', 168, 152], ['30–39', 192, 171], ['18–29', 121, 109]].reduce(function (a, r) { a.push({ Age: r[0], Gender: 'Men', Policyholders: r[1] }); a.push({ Age: r[0], Gender: 'Women', Policyholders: r[2] }); return a; }, []), fields: { band: 'Age', side: 'Gender', val: 'Policyholders' }, unit: 'Health policyholders by age band, thousands, March 2026, made-up data' },
    draft: function (x) { var s = uniq(x.rows, x.f.side).slice(0, 2), g = sorted(group(x.rows, x.f.band, x.f.val)), t = total(g); if (!g.length) return {}; return { title: g[0].label + ' is the largest band, ' + round(g[0].value / (t || 1) * 100, 0) + '% of ' + x.f.val.toLowerCase(), sub: x.f.val + ' by ' + x.f.band + '; ' + s[0] + ' left, ' + (s[1] || '') + ' right' }; },
    build: function (x) {
      var s = uniq(x.rows, x.f.side).slice(0, 2), colors = {}; colors[s[0]] = C.ink; if (s[1]) colors[s[1]] = C.highlight;
      return [{ tool: 'insert_chart', args: { dataset: x.ds, by: x.f.band, measure: x.f.val, series: x.f.side, type: 'pyramid', sort: 'source', series_only: s, series_order: s, title: x.title } },
        { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, tooltip: '{label}\n{series}: {value:short}', look: look({ legend: 'top', labels: 'inside', colors: colors }) } }];
    } });

  Ly.marimekkoHtml = function (cols, parts, pick, colors) {
    var T = cols.reduce(function (t, c) { return t + c.total; }, 0) || 1, W = 900, H = 300, x0 = 0, out = '';
    cols.forEach(function (c) {
      var w = c.total / T * W, y0 = 0;
      parts.forEach(function (p) {
        var v = c.parts[p] || 0, hh = c.total ? v / c.total * H : 0; if (hh <= 0) return;
        out += '<rect x="' + (x0 + 1).toFixed(1) + '" y="' + (y0 + 1).toFixed(1) + '" width="' + Math.max(0, w - 2).toFixed(1) + '" height="' + Math.max(0, hh - 2).toFixed(1) + '" fill="' + colors[p] + '"><title>' + esc(c.label + ' · ' + p + ': ' + fmt(v)) + '</title></rect>';
        if (w > 44 && hh > 16) out += '<text x="' + (x0 + w / 2).toFixed(1) + '" y="' + (y0 + hh / 2 + 4).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#fff">' + Math.round(v / c.total * 100) + '%</text>';
        y0 += hh;
      });
      out += '<text x="' + (x0 + w / 2).toFixed(1) + '" y="' + (H + 16) + '" text-anchor="middle" font-size="11" fill="#374151">' + esc(c.label) + '</text><text x="' + (x0 + w / 2).toFixed(1) + '" y="' + (H + 30) + '" text-anchor="middle" font-size="10" fill="#6B7280">' + Math.round(c.total / T * 100) + '% of total</text>';
      x0 += w;
    });
    var legend = parts.map(function (p) { return '<span style="display:inline-flex;align-items:center;gap:4px;margin-right:12px"><i style="width:10px;height:10px;display:inline-block;background:' + colors[p] + '"></i>' + esc(p) + '</span>'; }).join('');
    return '<div class="ms-mekko"><div style="font-size:11px;color:#374151;margin-bottom:6px">' + legend + '</div><svg viewBox="0 0 ' + W + ' ' + (H + 36) + '" width="100%" style="max-height:380px" role="img" aria-label="Marimekko chart">' + out + '</svg>' +
      '<p style="font-size:11px;color:#4B5563;margin:4px 0 0">Column width = share of the total; height inside a column = share of that column. A picture of the data: rebuild it (Edit layout) when the numbers change.</p></div>';
  };
  add({ id: 'marimekko', group: 'composition', name: 'Marimekko (mekko)', question: 'How big is each market, and who or what wins inside it?', pic: 'mekko',
    roles: [{ key: 'col', label: 'Columns (e.g. markets)', kind: 'text', hint: /market|line|segment|region|cost|category/ }, { key: 'part', label: 'Parts inside each column', kind: 'text', hint: /channel|player|company|type|part|measure/ }, { key: 'val', label: 'Value', kind: 'number' }],
    options: [{ key: 'pick', label: 'Part to highlight (blank = the biggest overall)' }],
    sample: { name: 'Premium by line and channel', rows: [['Motor', [['Agency', 34], ['Dealers', 41], ['Online', 18], ['Banks', 7]]], ['Health', [['Agency', 46], ['Dealers', 0], ['Online', 16], ['Banks', 24]]], ['Commercial', [['Agency', 22], ['Dealers', 0], ['Online', 3], ['Banks', 9]]], ['Other', [['Agency', 9], ['Dealers', 2], ['Online', 6], ['Banks', 5]]]].reduce(function (a, c) { c[1].forEach(function (p) { a.push({ Line: c[0], Channel: p[0], Premium: p[1] }); }); return a; }, []), fields: { col: 'Line', part: 'Channel', val: 'Premium' }, unit: 'Gross written premium by line and channel, billions, FY25, made-up data' },
    cols: function (x) { var parts = uniq(x.rows, x.f.part); return { parts: parts, cols: sorted(group(x.rows, x.f.col, x.f.val)).map(function (c) { var o = {}; parts.forEach(function (p) { o[p] = sumWhere(x.rows, x.f.val, x.f.col, c.label, x.f.part, p); }); return { label: c.label, total: c.value, parts: o }; }) }; },
    draft: function (x) { var m = this.cols(x), T = m.cols.reduce(function (t, c) { return t + c.total; }, 0); if (!m.cols.length) return {}; var c = m.cols[0], best = m.parts.slice().sort(function (a, b) { return (c.parts[b] || 0) - (c.parts[a] || 0); })[0]; return { title: c.label + ' is ' + round(c.total / (T || 1) * 100, 0) + '% of the total, and ' + best + ' wins ' + round((c.parts[best] || 0) / (c.total || 1) * 100, 0) + '% of it', sub: x.f.val + ' by ' + x.f.col + ' and ' + x.f.part }; },
    build: function (x) {
      var m = this.cols(x), tot = {}; m.parts.forEach(function (p) { tot[p] = m.cols.reduce(function (t, c) { return t + (c.parts[p] || 0); }, 0); });
      var pick = x.o.pick || m.parts.slice().sort(function (a, b) { return tot[b] - tot[a]; })[0];
      return [{ tool: 'insert_text_block', args: { title: x.title, html: '<p style="margin:0 0 6px;color:#4B5563;font-size:12px">' + esc(x.sub) + '</p>' + Ly.marimekkoHtml(m.cols, m.parts, pick, partColours(m.parts, pick)), span: 8 }, as: 'block' }];
    } });

  function yes(v) { if (typeof v === 'number') return v > 0; return /^(y|yes|true|1|x|✓)$/i.test(String(v == null ? '' : v).trim()); }
  Ly.vennHtml = function (names, z) {
    var c = [[150, 120, '#2251FF'], [250, 120, '#051C2C'], [200, 205, '#7F8C99']], T = Object.keys(z).reduce(function (t, k) { return t + z[k]; }, 0) || 1;
    var lab = function (k, x_, y_) { return '<text x="' + x_ + '" y="' + y_ + '" text-anchor="middle" font-size="12" font-weight="700" fill="#111827">' + fmt(z[k] || 0) + '</text><text x="' + x_ + '" y="' + (y_ + 13) + '" text-anchor="middle" font-size="10" fill="#374151">' + Math.round((z[k] || 0) / T * 100) + '%</text>'; };
    var svg = c.map(function (q) { return '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="92" fill="' + q[2] + '" fill-opacity="0.14" stroke="' + q[2] + '" stroke-width="1.5"/>'; }).join('') +
      lab('a', 110, 95) + lab('b', 290, 95) + lab('c', 200, 260) + lab('ab', 200, 82) + lab('ac', 145, 185) + lab('bc', 255, 185) + lab('abc', 200, 150) +
      '<text x="70" y="22" font-size="12" font-weight="600" fill="#2251FF">' + esc(names[0]) + '</text><text x="330" y="22" text-anchor="end" font-size="12" font-weight="600" fill="#051C2C">' + esc(names[1]) + '</text><text x="200" y="318" text-anchor="middle" font-size="12" font-weight="600" fill="#4B5563">' + esc(names[2]) + '</text>';
    return '<div class="ms-venn"><svg viewBox="0 0 400 326" width="100%" style="max-width:460px;display:block;margin:auto" role="img" aria-label="Three-set overlap">' + svg + '</svg>' +
      '<p style="font-size:11px;color:#4B5563;margin:4px 0 0">' + fmt(z.none || 0) + ' (' + Math.round((z.none || 0) / T * 100) + '%) is in none of the three. A picture of the data: rebuild it (Edit layout) when the numbers change.</p></div>';
  };
  add({ id: 'overlap-venn', group: 'composition', name: 'Three-way overlap', question: 'How much is exposed to one, two or all three risks?', pic: 'venn',
    roles: [{ key: 'item', label: 'Items', kind: 'text', hint: /item|supplier|product|name|vendor|risk|id/ }, { key: 'a', label: 'First test (yes / no or 1 / 0)', kind: 'text', hint: /critical|first|a$/ }, { key: 'b', label: 'Second test', kind: 'text', hint: /concentr|second|b$/ }, { key: 'c', label: 'Third test', kind: 'text', hint: /hard|distant|third|c$/ }, { key: 'val', label: 'Value (optional; blank counts items)', kind: 'number', opt: true }],
    sample: { name: 'Vendor exposure', rows: [['Core policy system', 'Yes', 'Yes', 'Yes', 42], ['Claims platform', 'Yes', 'Yes', 'No', 31], ['Payment gateway', 'Yes', 'No', 'No', 18], ['Data centre', 'Yes', 'Yes', 'Yes', 26], ['Call centre', 'No', 'Yes', 'No', 14], ['Reinsurance broker', 'Yes', 'No', 'Yes', 22], ['Print and mail', 'No', 'No', 'No', 6], ['Cloud analytics', 'No', 'Yes', 'Yes', 19], ['Survey network', 'No', 'No', 'Yes', 9], ['Security operations', 'Yes', 'No', 'Yes', 12]].map(function (r) { return { Vendor: r[0], Critical: r[1], Concentrated: r[2], 'Hard to replace': r[3], Spend: r[4] }; }), fields: { item: 'Vendor', a: 'Critical', b: 'Concentrated', c: 'Hard to replace', val: 'Spend' }, unit: 'Vendor spend, millions, FY25, by the three tests it meets, made-up vendors' },
    zones: function (x) { var z = { a: 0, b: 0, c: 0, ab: 0, ac: 0, bc: 0, abc: 0, none: 0 }; x.rows.forEach(function (r) { var k = (yes(r[x.f.a]) ? 'a' : '') + (yes(r[x.f.b]) ? 'b' : '') + (yes(r[x.f.c]) ? 'c' : '') || 'none'; z[k] += x.f.val ? (num(r[x.f.val]) || 0) : 1; }); return z; },
    draft: function (x) { var z = this.zones(x), T = Object.keys(z).reduce(function (t, k) { return t + z[k]; }, 0) || 1, any = T - z.none; return { title: round(any / T * 100, 0) + '% ' + (x.f.val ? 'of ' + x.f.val.toLowerCase() : 'of items') + ' meets at least one test; ' + round(z.abc / T * 100, 0) + '% meets all three', sub: (x.f.val || 'Count of ' + x.f.item) + ' by ' + [x.f.a, x.f.b, x.f.c].join(', ') }; },
    build: function (x) { return [{ tool: 'insert_text_block', args: { title: x.title, html: '<p style="margin:0 0 6px;color:#4B5563;font-size:12px">' + esc(x.sub) + '</p>' + Ly.vennHtml([x.f.a, x.f.b, x.f.c], this.zones(x)), span: 6 }, as: 'block' }]; } });

  Ly.dotsHtml = function (items) {
    return '<div class="ms-dotstats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px">' + items.map(function (it, k) {
      var n = Math.max(0, Math.min(100, Math.round(it.v))), dots = '';
      for (var i = 0; i < 100; i++) dots += '<circle cx="' + (6 + (i % 10) * 11) + '" cy="' + (6 + Math.floor(i / 10) * 11) + '" r="4" fill="' + (i < n ? (k === 0 ? C.highlight : C.ink) : '#D9DDE2') + '"/>';
      return '<div style="text-align:left"><div style="font-size:28px;font-weight:700;color:' + (k === 0 ? C.highlight : C.ink) + '">' + n + '%</div><div style="font-size:12px;color:#374151;margin:2px 0 6px;min-height:30px">' + esc(it.label) + '</div><svg viewBox="0 0 112 112" width="112" height="112" role="img" aria-label="' + n + ' of 100">' + dots + '</svg></div>';
    }).join('') + '</div>';
  };
  add({ id: 'dot-matrix-stats', group: 'composition', name: 'Big numbers with 100-dot grids', question: 'A few headline percentages, each out of 100.', pic: 'dots',
    roles: [{ key: 'label', label: 'Statement', kind: 'text', hint: /step|stage|statement|label|measure|item|question/ }, { key: 'val', label: 'Percentage (0–100)', kind: 'number', hint: /pct|percent|share|%/ }],
    options: [{ key: 'max', label: 'Most panels', type: 'number', value: 6 }],
    sample: { name: 'Digital use along the journey', rows: [['used a digital tool to research cover', 74], ['compared quotes online', 58], ['asked an AI assistant a question', 37], ['bought the policy online', 29], ['filed a claim in the app', 22], ['let an AI agent renew for them', 6]].map(function (r) { return { Step: r[0], Share: r[1] }; }), fields: { label: 'Step', val: 'Share' }, unit: '% of policyholders, last 12 months, made-up survey' },
    draft: function (x) { var g = group(x.rows, x.f.label, x.f.val, 'avg'), top = sorted(g)[0], bot = sorted(g, 'asc')[0]; if (!top) return {}; return { title: round(top.value, 0) + '% ' + top.label + (bot && bot !== top ? ', but only ' + round(bot.value, 0) + '% ' + bot.label : ''), sub: x.f.val + ', %' }; },
    build: function (x) { var g = group(x.rows, x.f.label, x.f.val, 'avg').slice(0, num(x.o.max) || 6).map(function (q) { return { label: q.label, v: q.value }; }); return [{ tool: 'insert_text_block', args: { title: x.title, html: '<p style="margin:0 0 10px;color:#4B5563;font-size:12px">' + esc(x.sub) + '</p>' + Ly.dotsHtml(g), span: 12 }, as: 'block' }]; } });

  add({ id: 'heat-grid', group: 'composition', name: 'Heat grid (rows × columns)', question: 'Across many items and measures, where are the hot spots?', pic: 'heat',
    roles: [{ key: 'row', label: 'Rows', kind: 'text', hint: /region|state|country|branch|economy|item|name/ }, { key: 'col', label: 'Columns', kind: 'text', hint: /measure|kpi|element|metric|dimension|factor/ }, { key: 'val', label: 'Value', kind: 'number' }],
    options: [{ key: 'better', label: 'Darker means', type: 'select', options: [{ value: 'high', label: 'Higher (good or important)' }, { value: 'low', label: 'Lower' }], value: 'high' }],
    sample: { name: 'Branch scorecard', rows: [['Mumbai', [82, 71, 64, 90]], ['Delhi', [77, 58, 69, 84]], ['Bengaluru', [88, 79, 72, 93]], ['Chennai', [74, 66, 81, 79]], ['Kolkata', [61, 52, 57, 70]], ['Hyderabad', [85, 74, 68, 88]]].reduce(function (a, r) { ['Customer score', 'Claims speed', 'Renewal rate', 'Digital share'].forEach(function (k, i) { a.push({ Branch: r[0], Measure: k, Score: r[1][i] }); }); return a; }, []), fields: { row: 'Branch', col: 'Measure', val: 'Score' }, unit: 'Score out of 100 by branch and measure, FY25, made-up data' },
    pivot: function (x) { var cols = uniq(x.rows, x.f.col); return { cols: cols, rows: uniq(x.rows, x.f.row).map(function (r) { var o = {}; o[x.f.row] = r; cols.forEach(function (c) { o[c] = round(sumWhere(x.rows, x.f.val, x.f.row, r, x.f.col, c), 2); }); return o; }) }; },
    draft: function (x) { var p = this.pivot(x), lo = null; p.rows.forEach(function (r) { p.cols.forEach(function (c) { if (!lo || (x.o.better === 'low' ? r[c] > lo.v : r[c] < lo.v)) lo = { r: r[x.f.row], c: c, v: r[c] }; }); }); return lo ? { title: lo.r + ' lags most on ' + lo.c.toLowerCase() + ' at ' + fmt(lo.v), sub: x.f.val + ' by ' + x.f.row + ' and ' + x.f.col + '; darker is ' + (x.o.better === 'low' ? 'lower' : 'higher') } : {}; },
    build: function (x) {
      var p = this.pivot(x), hi = x.o.better !== 'low';
      return [{ tool: 'add_dataset', args: { name: x.ds + ' · grid', rows: p.rows }, as: 'ds' },
        { tool: 'insert_table', args: { dataset: '$ds', title: x.title, span: 8 }, as: 'table' },
        { tool: 'table_rules', args: { table: '$table', action: 'set', rules: p.cols.map(function (c) { return { col: c, type: 'scale', low: '#F1F4F8', mid: '', high: '#2251FF', higher: hi }; }) } }];
    } });

  // Reference layouts keep their source bindings so they follow dashboard filters.
  var referenceRoles = [
    { key: 'cat', label: 'Category or period', kind: 'text', hint: /period|year|category|activity|cohort|item|measure/ },
    { key: 'grp', label: 'Series', kind: 'text', hint: /series|scenario|group|technology|source|component|cohort/ },
    { key: 'val', label: 'Value', kind: 'number' }
  ];
  function seriesSample(name, cat, grp, val, rows, unit, options) {
    return { name: name, rows: rows.map(function (row) { return rec([cat, grp, val], row); }),
      fields: { cat: cat, grp: grp, val: val }, unit: unit, options: options };
  }
  function referenceChart(x, type, settings, style) {
    return [{ tool: 'insert_chart', args: Object.assign({ dataset: x.ds, by: x.f.cat, series: x.f.grp, measure: x.f.val,
      type: type, sort: 'source', sparse: true, title: x.title, span: 12 }, settings) },
    { tool: 'chart_settings', args: { chart: '$1', subtitle: x.sub, tooltip: '{label}\n{series}: {value:short}',
      look: look(Object.assign({ legend: 'top' }, style)) } }];
  }
  function referenceSeries(x, min, max) {
    var keys = uniq(x.rows, x.f.grp);
    if (keys.length < min || keys.length > max) throw new Error('This layout needs ' + min + '–' + max + ' series. Check the series column.');
    return keys;
  }
  function observedValues(x) {
    var categories = new Map();
    x.rows.forEach(function (r) {
      var v = r[x.f.val];
      if (v == null || String(v).trim() === '') return;
      v = num(v); if (!Number.isFinite(v)) return;
      var cat = String(r[x.f.cat]), series = String(r[x.f.grp]), group = categories.get(cat);
      if (!group) { group = new Map(); categories.set(cat, group); }
      group.set(series, (group.get(series) || 0) + v);
    });
    return function (category, series) {
      var group = categories.get(category);
      return group && group.has(series) ? group.get(series) : null;
    };
  }

  add({ id: 'comparison-dots', group: 'compare', name: 'Multi-series dot comparison',
    question: 'Where do several comparable series differ across the same measures?', pic: 'multidots',
    roles: referenceRoles,
    sample: seriesSample('Tool adoption by activity', 'Activity', 'Series', 'Share', [
      ['Market research', 'Assistive today', 29], ['Market research', 'Assistive planned', 50], ['Market research', 'Autonomous today', 7], ['Market research', 'Autonomous planned', 39],
      ['List price setting', 'Assistive today', 21], ['List price setting', 'Assistive planned', 43], ['List price setting', 'Autonomous today', 8], ['List price setting', 'Autonomous planned', 34],
      ['Cost tracking', 'Assistive today', 24], ['Cost tracking', 'Assistive planned', 48], ['Cost tracking', 'Autonomous today', 5], ['Cost tracking', 'Autonomous planned', 40]
    ], 'Share of respondents, %, synthetic survey'),
    draft: function (x) {
      var keys = referenceSeries(x, 2, 8), value = observedValues(x);
      var ranks = uniq(x.rows, x.f.cat).map(function (label) {
        var v = keys.map(function (key) { return value(label, key); }).filter(Number.isFinite);
        return { label: label, gap: v.length > 1 ? Math.max.apply(null, v) - Math.min.apply(null, v) : 0 };
      }).sort(function (a, b) { return b.gap - a.gap; });
      return { title: ranks[0] && ranks[0].gap ? ranks[0].label + ' has the widest spread across series' : 'Compare ' + x.f.val + ' across ' + x.f.grp, sub: x.f.val + ' by ' + x.f.cat };
    },
    build: function (x) { return referenceChart(x, 'dot-compare', { series_order: referenceSeries(x, 2, 8) }); }
  });

  add({ id: 'scenario-columns', group: 'trend', name: 'Actual and scenario columns',
    question: 'How far apart are the alternatives, and where do observations end?', pic: 'scenarios',
    roles: referenceRoles,
    options: [{ key: 'actual', label: 'Observed series name', value: 'Actual' }],
    sample: seriesSample('Storage capacity scenarios', 'Period', 'Series', 'Capacity', [
      ['2023', 'Actual', 101], ['2024', 'Actual', 158], ['2025', 'Actual', 220],
      ['2026', 'Slow', 270], ['2026', 'Base', 320], ['2026', 'Fast', 355],
      ['2030', 'Slow', 430], ['2030', 'Base', 560], ['2030', 'Fast', 670]
    ], 'New storage capacity, GWh, 2023–2030, synthetic scenarios'),
    draft: function (x) {
      var keys = referenceSeries(x, 2, 8), categories = uniq(x.rows, x.f.cat), last = categories[categories.length - 1], value = observedValues(x);
      var vals = keys.filter(function (k) { return k !== x.o.actual; }).map(function (k) { return value(last, k); }).filter(Number.isFinite);
      return { title: vals.length > 1 ? last + ' scenarios range from ' + fmt(Math.min.apply(null, vals)) + ' to ' + fmt(Math.max.apply(null, vals)) : x.f.val + ' across observed and projected series', sub: x.f.val + ' by ' + x.f.cat + ' and ' + x.f.grp };
    },
    build: function (x) {
      var keys = referenceSeries(x, 2, 8), colors = {}, actual = x.o.actual;
      if (keys.indexOf(actual) < 0) throw new Error('Set Observed series name to an existing series.');
      keys = [actual].concat(keys.filter(function (key) { return key !== actual; }));
      keys.forEach(function (key, j) { colors[key] = [C.ink, '#568BBD', C.highlight, '#8268B4', '#138180', '#9B631D', '#7C596C', '#546576'][j]; });
      return referenceChart(x, 'bar', { series_order: keys }, { colors: colors });
    }
  });

  add({ id: 'stacked-area-benchmark', group: 'trend', name: 'Stacked area with benchmark line',
    question: 'How does the sum of its components compare with an independent benchmark?', pic: 'area-line',
    roles: referenceRoles,
    options: [{ key: 'benchmark', label: 'Benchmark series name', value: 'Benchmark' }],
    sample: seriesSample('Demand mix against capacity', 'Period', 'Series', 'Volume', [
      ['2022', 'Households', 31], ['2022', 'Industry', 42], ['2022', 'Benchmark', 90],
      ['2023', 'Households', 38], ['2023', 'Industry', 45], ['2023', 'Benchmark', 95],
      ['2024', 'Households', 45], ['2024', 'Industry', 50], ['2024', 'Benchmark', 99],
      ['2025', 'Households', 55], ['2025', 'Industry', 60], ['2025', 'Benchmark', 108]
    ], 'Demand by source and available capacity, units, synthetic data'),
    draft: function (x) {
      var keys = referenceSeries(x, 3, 8), categories = uniq(x.rows, x.f.cat), last = categories[categories.length - 1], value = observedValues(x);
      var benchmark = value(last, x.o.benchmark);
      var parts = keys.filter(function (k) { return k !== x.o.benchmark; }).map(function (k) { return value(last, k); });
      var delta = benchmark == null || !parts.every(Number.isFinite) ? null : parts.reduce(function (a, b) { return a + b; }, 0) - benchmark;
      return { title: delta == null ? 'Compare the stack with its benchmark' : last + ' combined ' + x.f.val.toLowerCase() + (delta === 0 ? ' matches the benchmark' : ' is ' + fmt(Math.abs(delta)) + ' ' + (delta > 0 ? 'above' : 'below') + ' the benchmark'), sub: x.f.val + ' by ' + x.f.cat + ' and ' + x.f.grp + ', shared scale' };
    },
    build: function (x) {
      var keys = referenceSeries(x, 3, 8), line = x.o.benchmark, colors = {};
      if (keys.indexOf(line) < 0) throw new Error('Set Benchmark series name to an existing series with the same units.');
      keys = keys.filter(function (key) { return key !== line; }).concat(line);
      keys.forEach(function (key, j) { colors[key] = key === line ? C.ink : ['#6295C1', '#2251FF', '#3F8C91', '#977AB4', '#B38558', '#546A83', '#638052'][j]; });
      return referenceChart(x, 'area-benchmark', { series_order: keys, overlay: line }, { colors: colors });
    }
  });

  add({ id: 'cohort-bars', group: 'compare', name: 'Signed cohort bars',
    question: 'Which measures and cohorts move in opposite directions around zero?', pic: 'cohorts',
    roles: referenceRoles,
    sample: seriesSample('Purchase intent by cohort', 'Category', 'Cohort', 'Net intent', [
      ['Counter service', 'Early career', 12], ['Counter service', 'Mid career', -8], ['Counter service', 'Retired', -20],
      ['Table service', 'Early career', -6], ['Table service', 'Mid career', -13], ['Table service', 'Retired', -19],
      ['Delivery', 'Early career', 8], ['Delivery', 'Mid career', 2], ['Delivery', 'Retired', -25]
    ], 'Net intent (share increasing minus share decreasing), percentage points, synthetic data'),
    draft: function (x) {
      var keys = referenceSeries(x, 2, 8), value = observedValues(x);
      var mixed = uniq(x.rows, x.f.cat).filter(function (cat) {
        var v = keys.map(function (key) { return value(cat, key); }).filter(Number.isFinite);
        return v.some(function (n) { return n > 0; }) && v.some(function (n) { return n < 0; });
      });
      return { title: mixed.length ? mixed.join(' and ') + ' show opposite directions across cohorts' : 'Compare ' + x.f.val + ' by cohort', sub: x.f.val + ' by ' + x.f.cat + ' and ' + x.f.grp + ', zero as baseline' };
    },
    build: function (x) {
      return referenceChart(x, 'bar', { series_order: referenceSeries(x, 2, 8) },
        { refs: [{ axis: 'y', value: 0, color: C.secondary, dash: false }] });
    }
  });

  add({ id: 'threshold-dot-grid', group: 'composition', name: 'Threshold dot groups',
    question: 'How does the count and composition change as the threshold rises?', pic: 'dots',
    roles: referenceRoles,
    sample: seriesSample('Suppliers clearing service thresholds', 'Threshold', 'Tier', 'Suppliers', [
      ['At least 80%', 'Local', 31], ['At least 80%', 'Regional', 25], ['At least 80%', 'National', 16],
      ['At least 90%', 'Local', 12], ['At least 90%', 'Regional', 13], ['At least 90%', 'National', 11],
      ['At least 95%', 'Local', 2], ['At least 95%', 'Regional', 4], ['At least 95%', 'National', 7],
      ['At least 98%', 'Local', 0], ['At least 98%', 'Regional', 1], ['At least 98%', 'National', 3]
    ], 'Count of suppliers reaching each service threshold, synthetic data'),
    counts: function (x) {
      var keys = referenceSeries(x, 1, 8), cats = uniq(x.rows, x.f.cat), value = observedValues(x);
      if (cats.length > 12) throw new Error('Use up to 12 thresholds.');
      var groups = cats.map(function (category) {
        var counts = keys.map(function (key) { return value(category, key); });
        if (counts.some(function (n) { return n !== null && (!Number.isSafeInteger(n) || n < 0); })) throw new Error('Threshold counts must be non-negative whole numbers.');
        return { category: category, counts: counts, total: counts.reduce(function (a, b) { return a + (b || 0); }, 0) };
      });
      return { keys: keys, groups: groups };
    },
    draft: function (x) {
      var groups = this.counts(x).groups, first = groups[0], last = groups[groups.length - 1];
      return { title: first && last && first !== last ? fmt(first.total) + ' reach ' + first.category.toLowerCase() + ', while ' + fmt(last.total) + ' reach ' + last.category.toLowerCase() : 'Counts at each threshold', sub: x.f.val + ' by ' + x.f.cat + ' and ' + x.f.grp };
    },
    build: function (x) {
      var data = this.counts(x), colours = ['#2251FF', '#051C2C', '#138180', '#9B631D', '#8268B4', '#A13F61', '#546576', '#667740'];
      var unit = Math.max(1, Math.ceil(Math.max.apply(null, data.groups.map(function (g) { return g.total; })) / 240));
      function dot(colour) { return '<span aria-hidden="true" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:' + colour + '"></span>'; }
      var panels = data.groups.map(function (g) {
        var marks = g.counts.map(function (n, i) { return dot(colours[i]).repeat(Math.round((n || 0) / unit)); }).join('');
        var summary = data.keys.map(function (key, i) { return esc(key) + ' ' + (g.counts[i] == null ? '–' : fmt(g.counts[i])); }).join(' · ');
        return '<div style="padding:10px;border-top:2px solid #CBD5E1"><strong style="font-size:20px">' + fmt(g.total) + '</strong><div>' +
          esc(g.category) + '</div><div style="display:grid;grid-template-columns:repeat(16,7px);gap:2px;margin:8px 0" aria-hidden="true">' +
          marks + '</div><p style="font-size:12px;color:#475569;margin:0">' + summary + '</p></div>';
      }).join('');
      var legend = data.keys.map(function (key, i) { return '<span>' + dot(colours[i]) + ' ' + esc(key) + '</span>'; }).join(' · ');
      var html = '<p style="margin:0 0 6px;color:#475569;font-size:12px">' + esc(x.sub) + '</p><p style="margin:0 0 10px;font-size:12px">' +
        legend + ' · Each dot represents ' + (unit === 1 ? '1' : 'about ' + fmt(unit)) +
        '. Counts are shown below each threshold.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px">' + panels + '</div>';
      if (x.source) html += '<p style="font-size:12px;color:#475569">Source ' + esc(x.source) + (x.asOf ? ' · As of ' + esc(x.asOf) : '') + '</p>';
      return [{ tool: 'insert_text_block', args: { title: x.title, html: html, span: 12 }, as: 'block' }];
    }
  });

  /* ---------------------------------------------------------- matching columns, running a layout */
  Ly.get = function (id) { var l = L.filter(function (x) { return x.id === id; })[0]; if (!l) throw new Error('No chart layout "' + id + '". Layouts: ' + L.map(function (x) { return x.id; }).join(', ')); return l; };
  // A best guess at which column plays each role: by name first, then by kind (text / number), each column once.
  Ly.guess = function (lay, ds) {
    var f = rt().fields(ds), used = {}, out = {};
    lay.roles.forEach(function (role) {
      var want = role.kind === 'number', pool = f.filter(function (c) { return !used[c.name] && c.numeric === want; });
      var hit = role.hint && pool.filter(function (c) { return role.hint.test(low(c.name)); })[0];
      if (!hit && !role.opt) hit = pool[0];
      if (hit) { out[role.key] = hit.name; used[hit.name] = true; }
    });
    return out;
  };
  function sampleRows(lay) { return JSON.parse(JSON.stringify(lay.sample.rows)); }
  function context(lay, a, ds) {
    var r = rt(); if (!lay.sample) a = Object.assign({}, a, { sample: false });
    var f = Object.assign({}, a.sample ? lay.sample.fields : {}, ds && !a.sample ? Ly.guess(lay, ds) : {}, a.fields || {}), cols = ds ? r.fields(ds).map(function (c) { return c.name; }) : [];
    lay.roles.forEach(function (role) {
      if (!f[role.key] && !role.opt) throw new Error('Say which column is "' + role.label + '" (fields.' + role.key + '). Columns: ' + cols.join(', '));
      if (f[role.key] && cols.indexOf(f[role.key]) < 0) throw new Error('Dataset "' + ds + '" has no column "' + f[role.key] + '". Columns: ' + cols.join(', '));
    });
    var o = {}; (lay.options || []).forEach(function (op) { if (op.value != null) o[op.key] = op.value; });
    Object.assign(o, (a.sample && lay.sample.options) || {}, a.options || {});
    var x = { ds: ds, f: f, o: o, rows: ds ? r.getRows(ds) : [], source: a.source || '', asOf: a.as_of || '' };
    var d = lay.draft(x) || {};
    x.title = a.title || d.title || lay.name;
    x.sub = a.subtitle != null ? a.subtitle : (a.sample && lay.sample.unit) || d.sub || '';
    return x;
  }
  // The suggested title and unit line, without inserting anything.
  Ly.preview = function (id, a) {
    var lay = Ly.get(id); a = a || {};
    var ds = a.sample || !a.dataset ? null : a.dataset;
    if (ds && !rt().state.datasets[ds]) throw new Error('No dataset "' + ds + '".');
    if (!ds && lay.roles.length) {
      var defaults = {};
      (lay.options || []).forEach(function (op) { if (op.value != null) defaults[op.key] = op.value; });
      var x0 = { ds: lay.sample.name, f: lay.sample.fields, o: Object.assign(defaults, lay.sample.options || {}, a.options || {}), rows: sampleRows(lay) };
      var d0 = lay.draft(x0) || {};
      return { title: d0.title || lay.name, subtitle: lay.sample.unit || d0.sub || '', fields: lay.sample.fields, sample: true };
    }
    var x = context(lay, a, ds);
    return { title: x.title, subtitle: x.sub, fields: x.f, options: x.o };
  };
  function sub(v, refs) {
    if (typeof v === 'string' && /^\$\w+$/.test(v)) return refs[v.slice(1)] !== undefined ? refs[v.slice(1)] : v;
    if (Array.isArray(v)) return v.map(function (q) { return sub(q, refs); });
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = sub(v[k], refs); }); return o; }
    return v;
  }
  // Runs a layout's steps (inside the caller's undo group) and records the run, so "Edit layout" can redo it later.
  function runSteps(lay, a, ds, child) {
    var issues = [], refs = {}, charts = [], units = [], derived = [];
    var x = context(lay, a, lay.roles.length ? ds : null), steps = lay.build(x);
    return steps.reduce(function (p, s, i) {
      return p.then(function () {
        if (MS.child !== child) throw new Error('The dashboard changed while the layout was being inserted.');
        if (s.ifChart && !charts.length) return;
        return MS.api.run(s.tool, sub(s.args, refs)).then(function (res) {
          if (s.tool === 'insert_chart' && res && res.key) { charts.push(res.key); refs[String(charts.length)] = res.key; }
          if (s.as === 'ds') { refs.ds = res && res.name; if (res && res.name) derived.push(res.name); }
          if (s.as === 'table') refs.table = res && res.table;
          if (s.as === 'block') refs.block = res && res.ref;
          if (res && res.ref && s.tool !== 'insert_chart') units.push(res.ref);
        }, function (e) { issues.push('Step ' + (i + 1) + ' (' + s.tool + '): ' + e.message); });
      });
    }, Promise.resolve()).then(function () {
      // the action title goes in through chart_settings so the commentary header and the chart agree
      var p = charts[0] && !lay.titleOnPage ? MS.api.run('chart_settings', { chart: charts[0], title: x.title }).catch(function (e) { issues.push(e.message); }) : Promise.resolve();
      if (x.source && lay.id !== 'house-style') charts.forEach(function (k) { p = p.then(function () { return MS.api.run('chart_source', { chart: k, text: x.source, as_of: x.asOf || undefined }).catch(function (e) { issues.push(e.message); }); }); });
      return p;
    }).then(function () {
      var run = null;
      if (lay.roles.length && (charts.length || units.length)) {
        run = MS.rt().uid('lay');
        var rec = { layout: lay.id, dataset: ds, fields: x.f, options: x.o, title: x.title, subtitle: x.sub, source: x.source || '', as_of: x.asOf || '', charts: charts, refs: units, derived: derived };
        MS.history.state('Chart layout record', function (st) { st.layoutRuns = st.layoutRuns || {}; st.layoutRuns[run] = JSON.parse(JSON.stringify(rec)); });
      }
      return { layout: lay.id, name: lay.name, run: run, charts: charts, units: units, dataset: ds || null, title: x.title, subtitle: x.sub, issues: issues };
    });
  }
  // a: { dataset, sample, fields: {role: column}, options, title, subtitle, source, as_of }  ->  Promise<{ layout, run, charts, dataset, title, issues }>
  Ly.insert = function (id, a) {
    var lay = Ly.get(id), r = rt(); a = a || {};
    if (MS.firm && MS.firm.locked && MS.firm.locked() && MS.firm.blocks('chart layout colours')) return Promise.reject(MS.firm.lockedError());
    var ds = a.dataset, child = MS.child;
    if (lay.roles.length && !ds && !a.sample) return Promise.reject(new Error('Say which dataset to use, or sample: true to try it on sample data.'));
    if (ds && !a.sample && !r.state.datasets[ds]) return Promise.reject(new Error('No dataset "' + ds + '". Datasets: ' + Object.keys(r.state.datasets).join(', ')));
    return MS.history.groupAsync('Insert chart layout ' + lay.name, function () {
      if (a.sample && lay.roles.length) ds = MS.data.addDataset(a.dataset || lay.sample.name, sampleRows(lay), true);
      return runSteps(lay, a, ds, child);
    }).then(function (res) { MS.afterDomChange(); return res; });
  };

  /* ---------------------------------------------------------- editing a layout after it is in: other columns, options, words, or another layout */
  Ly.runs = function () {
    var r = MS.rt(), runs = (r && r.state.layoutRuns) || {};
    return Object.keys(runs).map(function (id) { var x = runs[id]; return { run: id, layout: x.layout, name: (L.filter(function (l) { return l.id === x.layout; })[0] || {}).name || x.layout, dataset: x.dataset, fields: x.fields, options: x.options, title: x.title, charts: x.charts || [], live: (x.charts || []).filter(function (k) { return !!r.chart(k); }).length }; });
  };
  // The run a chart (key or name) or block ref belongs to.
  Ly.runOf = function (which) {
    var r = MS.rt(); if (!r || !which) return null;
    var runs = r.state.layoutRuns || {}; if (runs[which]) return which;
    var key = null; try { key = MS.api.chartKey ? MS.api.chartKey(which) : null; } catch (e) {}
    if (!key && r.state.charts[which]) key = which;
    for (var id in runs) { var x = runs[id]; if ((key && (x.charts || []).indexOf(key) >= 0) || (x.refs || []).indexOf(which) >= 0) return id; }
    return null;
  };
  function unitsOf(x) {
    var r = MS.rt(), out = [];
    (x.charts || []).forEach(function (k) { var c = r.chart(k); var u = c && (MS.blocks.of(c.el) || c.el); if (u && u.isConnected && out.indexOf(u) < 0) out.push(u); });
    (x.refs || []).forEach(function (ref) { var e = null; try { e = MS.api.elOf(ref); } catch (er) {} var u = e && (MS.blocks.of(e) || e); if (u && u.isConnected && out.indexOf(u) < 0) out.push(u); });
    return out.sort(function (p, q) { return p.compareDocumentPosition(q) & 4 ? -1 : 1; });
  }
  // ch: { layout (switch to another), dataset, fields, options, title, subtitle, source, as_of, keep_title }
  Ly.edit = function (which, ch) {
    var r = rt(), id = Ly.runOf(which); ch = ch || {};
    if (!id) return Promise.reject(new Error('That chart was not inserted from a chart layout (or its record is gone). Use chart_edit to reshape it, or insert a layout again.'));
    var old = JSON.parse(JSON.stringify(r.state.layoutRuns[id])), lay = Ly.get(ch.layout || old.layout), switched = lay.id !== old.layout, child = MS.child;
    var ds = ch.dataset || old.dataset;
    if (!r.state.datasets[ds]) return Promise.reject(new Error('No dataset "' + ds + '". Datasets: ' + Object.keys(r.state.datasets).join(', ')));
    var numbersChanged = switched || ch.dataset || ch.fields || ch.options;
    var a = { dataset: ds, fields: switched && !ch.fields ? {} : Object.assign({}, switched ? {} : old.fields, ch.fields || {}), options: Object.assign({}, switched ? {} : old.options, ch.options || {}),
      title: ch.title != null ? ch.title : (ch.keep_title || !numbersChanged ? old.title : undefined), subtitle: ch.subtitle != null ? ch.subtitle : (ch.keep_title || !numbersChanged ? old.subtitle : undefined),
      source: ch.source != null ? ch.source : old.source, as_of: ch.as_of != null ? ch.as_of : old.as_of };
    if (switched && !ch.fields) a.fields = {}; // let the new layout guess its columns
    try { context(lay, a, ds); } catch (e) { return Promise.reject(e); }
    var oldUnits = unitsOf(old), anchor = oldUnits[0] || null;
    return MS.history.groupAsync('Edit chart layout ' + lay.name, function () {
      MS.history.state('Chart layout record', function (st) { (old.derived || []).forEach(function (n) { if (n !== ds) delete st.datasets[n]; }); if (st.layoutRuns) delete st.layoutRuns[id]; });
      return runSteps(lay, a, ds, child).then(function (res) {
        var fresh = unitsOf({ charts: res.charts, refs: res.units });
        if (anchor) fresh.forEach(function (u) { MS.move.to(u, { before: anchor }); });
        oldUnits.forEach(function (u) { if (u.isConnected) MS.blocks.remove(u); });
        if (!anchor) res.issues.push('The old charts were not found on the page, so the new ones were added at the end.');
        res.replaced = old.charts || [];
        return res;
      });
    }).then(function (res) { MS.afterDomChange(); var rr = MS.rt(); if (rr) rr.refresh(); return res; });
  };
  Ly.list = function () {
    return L.map(function (l) { return { id: l.id, group: l.group, name: l.name, question: l.question, columns: l.roles.map(function (r) { return { role: r.key, label: r.label, kind: r.kind, optional: !!r.opt }; }), options: (l.options || []).map(function (o) { return { key: o.key, label: o.label, default: o.value }; }) }; });
  };

  /* ---------------------------------------------------------- thumbnails (drawn, no images) */
  var PIC = {
    rank: '<rect x="8" y="8" width="68" height="7" fill="#2251FF"/><rect x="8" y="19" width="54" height="7" fill="#B8BEC6"/><rect x="8" y="30" width="44" height="7" fill="#B8BEC6"/><rect x="8" y="41" width="33" height="7" fill="#B8BEC6"/><rect x="8" y="52" width="22" height="7" fill="#B8BEC6"/>',
    cagr: '<rect x="10" y="40" width="10" height="20" fill="#051C2C"/><rect x="26" y="35" width="10" height="25" fill="#051C2C"/><rect x="42" y="30" width="10" height="30" fill="#051C2C"/><rect x="58" y="22" width="10" height="38" fill="#051C2C"/><rect x="74" y="14" width="10" height="46" fill="#051C2C"/><path d="M15 32 L79 6" stroke="#2251FF" stroke-width="2" fill="none" marker-end="url(#ah)"/>',
    bridge: '<rect x="6" y="20" width="11" height="40" fill="#051C2C"/><rect x="21" y="12" width="11" height="8" fill="#2E7D32"/><rect x="36" y="7" width="11" height="5" fill="#2E7D32"/><rect x="51" y="7" width="11" height="9" fill="#C62828"/><rect x="66" y="16" width="11" height="6" fill="#C62828"/><rect x="81" y="22" width="11" height="38" fill="#051C2C"/>',
    mix: '<rect x="12" y="8" width="16" height="30" fill="#051C2C"/><rect x="12" y="38" width="16" height="12" fill="#7F8C99"/><rect x="12" y="50" width="16" height="10" fill="#2251FF"/><rect x="40" y="8" width="16" height="26" fill="#051C2C"/><rect x="40" y="34" width="16" height="12" fill="#7F8C99"/><rect x="40" y="46" width="16" height="14" fill="#2251FF"/><rect x="68" y="8" width="16" height="22" fill="#051C2C"/><rect x="68" y="30" width="16" height="12" fill="#7F8C99"/><rect x="68" y="42" width="16" height="18" fill="#2251FF"/>',
    line: '<path d="M6 46 L22 42 L38 36 L54 44 L70 30 L88 22" stroke="#2251FF" stroke-width="2.5" fill="none"/><path d="M6 26 H90" stroke="#C62828" stroke-width="1.5" stroke-dasharray="5 3"/>',
    variance: '<path d="M48 4 V60" stroke="#94A3B8"/><rect x="48" y="8" width="36" height="8" fill="#2E7D32"/><rect x="48" y="20" width="20" height="8" fill="#2E7D32"/><rect x="34" y="32" width="14" height="8" fill="#C62828"/><rect x="18" y="44" width="30" height="8" fill="#C62828"/>',
    hist: '<rect x="8" y="12" width="16" height="48" fill="#B8BEC6"/><rect x="28" y="30" width="16" height="30" fill="#B8BEC6"/><rect x="48" y="44" width="16" height="16" fill="#B8BEC6"/><rect x="68" y="54" width="16" height="6" fill="#2251FF"/>',
    style: '<rect x="8" y="8" width="80" height="6" fill="#051C2C"/><rect x="8" y="18" width="50" height="4" fill="#94A3B8"/><rect x="12" y="40" width="12" height="20" fill="#051C2C"/><rect x="30" y="32" width="12" height="28" fill="#051C2C"/><rect x="48" y="28" width="12" height="32" fill="#2251FF"/><rect x="66" y="36" width="12" height="24" fill="#051C2C"/>',
    page: '<rect x="6" y="4" width="84" height="10" fill="#051C2C"/><rect x="6" y="18" width="26" height="10" fill="#E2E8F0"/><rect x="35" y="18" width="26" height="10" fill="#E2E8F0"/><rect x="64" y="18" width="26" height="10" fill="#E2E8F0"/><rect x="6" y="32" width="40" height="20" fill="#B8BEC6"/><rect x="50" y="32" width="40" height="20" fill="#B8BEC6"/><rect x="6" y="55" width="84" height="5" fill="#2251FF"/>',
    heat: (function () { var s = ''; for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) { var v = (5 - r) * (c + 1); s += '<rect x="' + (20 + c * 14) + '" y="' + (2 + r * 12) + '" width="13" height="11" fill="' + (v >= 15 ? '#F4C7C3' : v >= 8 ? '#FCE8B2' : '#D6EAD8') + '"/>'; } return s; })(),
    table: '<rect x="6" y="6" width="84" height="8" fill="#051C2C"/>' + [0, 1, 2, 3].map(function (i) { return '<rect x="6" y="' + (17 + i * 11) + '" width="54" height="8" fill="#E2E8F0"/><rect x="64" y="' + (17 + i * 11) + '" width="26" height="8" fill="' + ['#F4C7C3', '#FCE8B2', '#D6EAD8', '#D6EAD8'][i] + '"/>'; }).join(''),
    stack: '<rect x="12" y="30" width="14" height="30" fill="#051C2C"/><rect x="12" y="16" width="14" height="14" fill="#2251FF"/><rect x="34" y="34" width="14" height="26" fill="#051C2C"/><rect x="34" y="24" width="14" height="10" fill="#2251FF"/><rect x="56" y="40" width="14" height="20" fill="#051C2C"/><rect x="56" y="22" width="14" height="18" fill="#2251FF"/><rect x="78" y="50" width="14" height="10" fill="#051C2C"/><rect x="78" y="20" width="14" height="30" fill="#2251FF"/>',
    pair: [0, 1, 2, 3].map(function (i) { return '<rect x="' + (10 + i * 21) + '" y="' + (14 + i * 3) + '" width="8" height="' + (46 - i * 3) + '" fill="#B8BEC6"/><rect x="' + (18 + i * 21) + '" y="' + (34 + i * 2) + '" width="8" height="' + (26 - i * 2) + '" fill="#2251FF"/>'; }).join(''),
    twin: '<rect x="6" y="36" width="8" height="24" fill="#B8BEC6"/><rect x="17" y="34" width="8" height="26" fill="#B8BEC6"/><rect x="28" y="33" width="8" height="27" fill="#B8BEC6"/><rect x="39" y="32" width="8" height="28" fill="#B8BEC6"/><rect x="52" y="40" width="8" height="20" fill="#051C2C"/><rect x="63" y="34" width="8" height="26" fill="#051C2C"/><rect x="74" y="26" width="8" height="34" fill="#051C2C"/><rect x="85" y="16" width="8" height="44" fill="#051C2C"/>',
    likert: [0, 1, 2].map(function (i) { var w = [[10, 14, 14, 30, 16], [4, 8, 10, 40, 22], [3, 6, 10, 38, 27]][i], x = 6, s = ''; w.forEach(function (v, k) { s += '<rect x="' + x + '" y="' + (10 + i * 17) + '" width="' + v + '" height="11" fill="' + ['#C62828', '#E39A9A', '#B8BEC6', '#8FA8FF', '#2251FF'][k] + '"/>'; x += v; }); return s; }).join(''),
    dumbbell: [0, 1, 2, 3, 4].map(function (i) { var a = [20, 30, 14, 44, 36][i], b = [62, 50, 70, 54, 22][i], y = 9 + i * 11; return '<path d="M' + a + ' ' + y + ' H' + b + '" stroke="#CBD2DA" stroke-width="2"/><circle cx="' + a + '" cy="' + y + '" r="3.5" fill="#B8BEC6"/><circle cx="' + b + '" cy="' + y + '" r="3.5" fill="#2251FF"/>'; }).join(''),
    range: [0, 1, 2, 3].map(function (i) { var x = 14 + i * 22, lo = [44, 30, 38, 24][i], hi = [20, 12, 26, 8][i], m = [32, 22, 31, 15][i]; return '<rect x="' + (x - 4) + '" y="' + hi + '" width="8" height="' + (lo - hi) + '" fill="#B8BEC6"/><circle cx="' + x + '" cy="' + m + '" r="4" fill="#2251FF"/>'; }).join('') + '<path d="M4 58 H92" stroke="#94A3B8"/>',
    parity: '<path d="M8 58 L88 6" stroke="#7F8C99" stroke-dasharray="4 3"/><circle cx="20" cy="30" r="3.5" fill="#2251FF"/><circle cx="34" cy="22" r="3.5" fill="#2251FF"/><circle cx="52" cy="44" r="3.5" fill="#7F8C99"/><circle cx="66" cy="40" r="3.5" fill="#7F8C99"/><circle cx="78" cy="30" r="3.5" fill="#7F8C99"/><circle cx="46" cy="18" r="3.5" fill="#2251FF"/>',
    quad: '<path d="M48 4 V60 M6 32 H92" stroke="#7F8C99" stroke-dasharray="4 3"/><circle cx="66" cy="14" r="3.5" fill="#2251FF"/><circle cx="78" cy="22" r="3.5" fill="#2251FF"/><circle cx="24" cy="18" r="3.5" fill="#7F8C99"/><circle cx="30" cy="48" r="3.5" fill="#7F8C99"/><circle cx="64" cy="46" r="3.5" fill="#7F8C99"/><circle cx="14" cy="40" r="3.5" fill="#7F8C99"/>',
    bubble: '<circle cx="24" cy="42" r="6" fill="#7F8C99" fill-opacity=".7"/><circle cx="44" cy="30" r="9" fill="#7F8C99" fill-opacity=".7"/><circle cx="70" cy="22" r="15" fill="#2251FF" fill-opacity=".75"/><circle cx="58" cy="50" r="5" fill="#7F8C99" fill-opacity=".7"/><circle cx="16" cy="18" r="4" fill="#7F8C99" fill-opacity=".7"/>',
    hstack: [0, 1, 2, 3, 4].map(function (i) { var a = [40, 30, 26, 18, 10][i], b = [30, 26, 16, 14, 10][i], y = 6 + i * 11; return '<rect x="6" y="' + y + '" width="' + a + '" height="8" fill="#2251FF"/><rect x="' + (6 + a) + '" y="' + y + '" width="' + b + '" height="8" fill="#B8BEC6"/>'; }).join(''),
    forecast: [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { var hh = 8 + i * 6; return '<rect x="' + (6 + i * 11) + '" y="' + (60 - hh) + '" width="8" height="' + hh + '" fill="' + (i < 5 ? '#051C2C' : '#8FA8FF') + '"/>'; }).join(''),
    area: '<path d="M6 60 L6 44 L30 40 L54 34 L78 28 L90 24 L90 60 Z" fill="#B8BEC6"/><path d="M6 44 L30 40 L54 34 L78 28 L90 24 L90 10 L78 14 L54 22 L30 32 L6 38 Z" fill="#2251FF"/><path d="M6 38 L30 32 L54 22 L78 14 L90 10 L90 6 L78 10 L54 18 L30 28 L6 34 Z" fill="#051C2C"/>',
    lines: '<path d="M6 40 L24 36 L42 42 L60 30 L78 32 L90 28" stroke="#B8BEC6" stroke-width="2" fill="none"/><path d="M6 50 L24 46 L42 48 L60 44 L78 40 L90 42" stroke="#B8BEC6" stroke-width="2" fill="none"/><path d="M6 34 L24 30 L42 22 L60 12 L78 16 L90 18" stroke="#2251FF" stroke-width="2.5" fill="none"/>',
    multiples: [0, 1, 2, 3, 4, 5].map(function (k) { var ox = 4 + (k % 3) * 31, oy = 4 + Math.floor(k / 3) * 30, big = k === 1 || k === 3; return [0, 1, 2, 3].map(function (i) { var hh = big ? 5 + i * 6 : 8 + i * 2; return '<rect x="' + (ox + i * 7) + '" y="' + (oy + 26 - hh) + '" width="5" height="' + hh + '" fill="' + (big ? '#2251FF' : '#7F8C99') + '"/>'; }).join(''); }).join(''),
    curve: '<path d="M6 58 C40 56 60 52 72 40 C80 30 86 18 90 4" stroke="#2251FF" stroke-width="2.5" fill="none"/><path d="M6 50 H90" stroke="#7F8C99" stroke-dasharray="4 3"/><circle cx="90" cy="4" r="3" fill="#051C2C"/>',
    pyramid: [0, 1, 2, 3, 4, 5].map(function (i) { var l = [10, 18, 26, 32, 36, 28][i], r = [12, 20, 25, 30, 33, 26][i], y = 4 + i * 10; return '<rect x="' + (47 - l) + '" y="' + y + '" width="' + l + '" height="8" fill="#051C2C"/><rect x="49" y="' + y + '" width="' + r + '" height="8" fill="#2251FF"/>'; }).join(''),
    mekko: '<rect x="4" y="4" width="40" height="24" fill="#2251FF"/><rect x="4" y="29" width="40" height="18" fill="#051C2C"/><rect x="4" y="48" width="40" height="12" fill="#B8BEC6"/><rect x="45" y="4" width="26" height="30" fill="#2251FF"/><rect x="45" y="35" width="26" height="25" fill="#051C2C"/><rect x="72" y="4" width="20" height="14" fill="#2251FF"/><rect x="72" y="19" width="20" height="20" fill="#051C2C"/><rect x="72" y="40" width="20" height="20" fill="#B8BEC6"/>',
    venn: '<circle cx="38" cy="26" r="18" fill="#2251FF" fill-opacity=".2" stroke="#2251FF"/><circle cx="58" cy="26" r="18" fill="#051C2C" fill-opacity=".15" stroke="#051C2C"/><circle cx="48" cy="42" r="18" fill="#7F8C99" fill-opacity=".2" stroke="#7F8C99"/>',
    multidots: '<path d="M8 12H90 M8 30H90 M8 48H90" stroke="#D9DDE2"/><circle cx="24" cy="12" r="4" fill="#051C2C"/><circle cx="40" cy="30" r="4" fill="#051C2C"/><circle cx="32" cy="48" r="4" fill="#051C2C"/><path d="M44 8l4 8h-8z M58 26l4 8h-8z M65 44l4 8h-8z" fill="#2251FF"/><path d="M64 8h8v8h-8z M75 26h8v8h-8z M76 44h8v8h-8z" fill="#7F8C99"/>',
    scenarios: '<path d="M5 58H92" stroke="#7F8C99"/><path d="M10 42h10v16H10z M26 36h10v22H26z M42 30h10v28H42z" fill="#051C2C"/><path d="M60 25h8v33h-8z" fill="#568BBD"/><path d="M69 17h8v41h-8z" fill="#2251FF"/><path d="M78 9h8v49h-8z" fill="#8268B4"/>',
    'area-line': '<path d="M6 59V43L26 44L48 38L68 36L90 28V59Z" fill="#2251FF"/><path d="M6 43L26 44L48 38L68 36L90 28V12L68 18L48 23L26 33L6 36Z" fill="#6295C1"/><path d="M6 24L26 22L48 19L68 14L90 18" stroke="#051C2C" stroke-width="3" fill="none"/>',
    cohorts: '<path d="M6 30H90" stroke="#7F8C99"/><path d="M12 12h9v18h-9z M40 30h9v10h-9z M68 21h9v9h-9z" fill="#2251FF"/><path d="M22 30h9v12h-9z M50 30h9v23h-9z M78 30h9v18h-9z" fill="#7F8C99"/>',
    dots: [0, 1].map(function (k) { var s = '', n = [74, 29][k]; for (var i = 0; i < 100; i++) s += '<circle cx="' + (6 + k * 46 + (i % 10) * 4) + '" cy="' + (16 + Math.floor(i / 10) * 4.4) + '" r="1.4" fill="' + (i < n ? (k ? '#051C2C' : '#2251FF') : '#D9DDE2') + '"/>'; return s; }).join(''),
    kpi: '<rect x="4" y="14" width="27" height="34" rx="3" fill="#E2E8F0"/><rect x="35" y="14" width="27" height="34" rx="3" fill="#E2E8F0"/><rect x="66" y="14" width="27" height="34" rx="3" fill="#E2E8F0"/><rect x="9" y="26" width="17" height="9" fill="#2251FF"/><rect x="40" y="26" width="17" height="9" fill="#051C2C"/><rect x="71" y="26" width="17" height="9" fill="#C62828"/>'
  };
  function thumb(lay) {
    var s = h('span', { 'class': 'lay-pic', 'aria-hidden': 'true' });
    s.innerHTML = '<svg viewBox="0 0 96 64" width="96" height="64"><defs><marker id="ah" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6z" fill="#2251FF"/></marker></defs>' + (PIC[lay.pic] || PIC.rank) + '</svg>';
    return s;
  }

  /* ---------------------------------------------------------- the gallery and the fill-in dialog */
  Ly.gallery = function (only, run) {
    var r = MS.rt(); if (!r) return MS.toast('Open a dashboard (or File › New) and turn off Safe mode to add chart layouts.', 'warn');
    var close = function () { var w = MS.$$('.dlg-wrap').pop(); if (w) w.remove(); };
    var search = h('input', { type: 'search', 'class': 'inp', placeholder: 'Search chart layouts', 'aria-label': 'Search chart layouts' });
    var groups = h('div', { 'class': 'lay-groups' }), references = (window.MS_STUDIO || {}).chartReferences || [], showingRefs = false;
    var allButton = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'true', text: 'Standard layouts', onclick: function () { switchMode(false); } });
    var refButton = h('button', { class: 'btn', type: 'button', 'aria-pressed': 'false', text: 'McKinsey references', onclick: function () { switchMode(true); } });
    function switchMode(show) {
      showingRefs = show;
      allButton.setAttribute('aria-pressed', String(!show));
      refButton.setAttribute('aria-pressed', String(show));
      search.placeholder = show ? 'Search titles or chart forms' : 'Search chart layouts';
      search.value = '';
      draw();
    }
    function draw() {
      var q = low(search.value); groups.innerHTML = '';
      if (showingRefs) {
        var statuses = { existing: 'Existing layout', new: 'New layout', approx: 'Adapted layout', collection: 'Collection' };
        var matches = references.filter(function (ref) {
          return !q || low(ref.title + ' ' + Ly.get(ref.layout).name + ' ' + ref.note).indexOf(q) >= 0;
        });
        if (matches.length) groups.appendChild(h('div', { class: 'lay-grid' }, matches.map(function (ref) {
          var lay = Ly.get(ref.layout);
          return h('button', { class: 'lay-card', 'data-reference': ref.layout, title: ref.note, onclick: function () {
            close(); Ly.reference(ref, run);
          } }, [thumb(lay), h('strong', { text: ref.title }), h('small', { text: statuses[ref.status] + ' · ' + lay.name })]);
        })));
      } else Ly.GROUPS.forEach(function (g) {
        var items = L.filter(function (l) { return l.group === g.id && (!only || only === g.id) && (!q || low(l.name + ' ' + l.question + ' ' + g.label).indexOf(q) >= 0); });
        if (!items.length) return;
        groups.appendChild(h('h4', { 'class': 'lay-head', text: g.label }));
        groups.appendChild(h('div', { 'class': 'lay-grid' }, items.map(function (l) {
          return h('button', { 'class': 'lay-card', 'data-layout': l.id, title: l.question, onclick: function () { close(); Ly.fill(l.id, run); } }, [thumb(l), h('strong', { text: l.name }), h('small', { text: l.question })]);
        })));
      });
      if (!groups.childNodes.length) groups.appendChild(h('p', { 'class': 'muted', text: 'No layout matches. Try another word.' }));
    }
    search.addEventListener('input', draw); draw();
    MS.dialog({ title: run ? 'Switch to another chart layout' : 'Chart layouts', sub: run ? 'Pick the layout to rebuild these charts as. Your data stays; check the columns on the next step.' : 'Consulting-style charts ready to fill: action title, one highlight colour, values on the bars, source line. Pick one, then choose your columns or try it on sample data.', xwide: true,
      body: h('div', { 'class': 'lay-gallery' }, [references.length && !only ? h('div', { class: 'lay-modes' }, [allButton, refButton]) : null, search, groups]), buttons: [{ label: 'Close', value: null }] });
  };

  Ly.reference = function (ref, run) {
    var ids = [ref.layout].concat(ref.companions || []);
    MS.dialog({ title: ref.title, sub: ref.note, wide: true,
      body: h('div', { class: 'lay-reference' }, [
        h('a', { href: ref.url, target: '_blank', rel: 'noopener noreferrer', text: 'View original reference' }),
        h('div', { class: 'lay-grid' }, ids.map(function (id) {
          var lay = Ly.get(id);
          return h('button', { class: 'lay-card', type: 'button', 'data-reference-layout': id, onclick: function () {
            var wrap = MS.$$('.dlg-wrap').pop(); if (wrap) wrap.remove();
            Ly.fill(id, run);
          } }, [thumb(lay), h('strong', { text: lay.name }), h('small', { text: lay.question })]);
        }))
      ]), buttons: [{ label: 'Close', value: null }] });
  };

  // run: the id of an inserted layout to edit (columns, options and words start from what it used; Update replaces it in place)
  Ly.fill = function (id, run) {
    var lay = Ly.get(id), r = MS.rt(); if (!r) return;
    var rec = run && r.state.layoutRuns && r.state.layoutRuns[run], same = rec && rec.layout === id;
    var names = Object.keys(r.state.datasets).filter(function (n) { return !rec || (rec.derived || []).indexOf(n) < 0; });
    var dsField = lay.roles.length ? [{ key: 'ds', label: 'Data', type: 'select', options: (rec ? [] : [{ value: '', label: 'Sample data (try the layout first)' }]).concat(names.map(function (n) { return { value: n, label: n }; })), value: rec ? rec.dataset : names.length && !/·/.test(names[names.length - 1]) ? names[names.length - 1] : '' }] : [];
    var form = h('div');
    var head = h('div', { 'class': 'lay-fill-head' }, [thumb(lay), h('div', {}, [h('strong', { text: lay.name }), h('p', { 'class': 'muted', text: lay.question })])]);
    var topForm = MS.form(dsField, function () { build(); });
    var colForm, optForm, textForm, preview = h('div', { 'class': 'lay-preview muted' });
    function fieldsOpts(ds, kind, opt) {
      var f = ds ? r.fields(ds) : [];
      return (opt ? [{ value: '', label: '— none —' }] : []).concat(f.filter(function (c) { return kind === 'number' ? c.numeric : true; }).map(function (c) { return { value: c.name, label: c.name + (c.numeric ? ' (number)' : '') }; }));
    }
    function current() {
      var ds = topForm.values().ds || '', a = { sample: !ds, dataset: ds || undefined, fields: {}, options: optForm ? optForm.values() : {} };
      if (colForm) { var cv = colForm.values(); lay.roles.forEach(function (role) { if (cv[role.key]) a.fields[role.key] = cv[role.key]; }); }
      Object.keys(a.options).forEach(function (k) { if (a.options[k] === '' || a.options[k] == null) delete a.options[k]; });
      return a;
    }
    function suggest() {
      if (!textForm) return;
      try {
        var p = Ly.preview(id, current());
        if (!textForm.__edited.title) textForm.inputs.title.value = p.title || '';
        if (!textForm.__edited.subtitle) textForm.inputs.subtitle.value = p.subtitle || '';
        preview.textContent = 'Suggested from the data. Edit the title so it says the one thing to take away.';
        MS.dialogError('');
      } catch (e) { preview.textContent = e.message; }
    }
    function build() {
      var ds = topForm.values().ds || '';
      form.innerHTML = '';
      if (lay.roles.length) {
        if (ds) {
          var g = Ly.guess(lay, ds); if (same && ds === rec.dataset) g = Object.assign(g, rec.fields);
          colForm = MS.form(lay.roles.map(function (role) { return { key: role.key, label: role.label, type: 'select', options: fieldsOpts(ds, role.kind, role.opt), value: g[role.key] || '' }; }), suggest);
          form.appendChild(h('h4', { 'class': 'rag-head', text: 'Your columns' })); form.appendChild(colForm);
        } else { colForm = null; form.appendChild(h('p', { 'class': 'hint', text: 'Sample data: a small made-up dataset is added to the dashboard so you can see the layout working. Swap in your own data later with Data › Load data, then insert the layout again.' })); }
      }
      var ops = (lay.options || []).map(function (o) { var c = Object.assign({}, o); if (!ds && lay.sample && lay.sample.options && lay.sample.options[o.key] != null) c.value = lay.sample.options[o.key]; if (same && rec.options && rec.options[o.key] != null) c.value = rec.options[o.key]; return c; });
      optForm = ops.length ? MS.form(ops, suggest) : null;
      if (optForm) { form.appendChild(h('h4', { 'class': 'rag-head', text: 'Options' })); form.appendChild(optForm); }
      textForm = MS.form([{ key: 'title', label: 'Action title (a full sentence with the so-what)' }, { key: 'subtitle', label: 'Unit line (measure, unit, period, scope)' }, { key: 'source', label: 'Source (optional)', placeholder: 'e.g. Policy admin extract' }, { key: 'as_of', label: 'Data as of (optional)', type: 'date' }]);
      textForm.__edited = {};
      ['title', 'subtitle'].forEach(function (k) { textForm.inputs[k].addEventListener('input', function () { textForm.__edited[k] = !!textForm.inputs[k].value; }); });
      if (rec) {
        textForm.inputs.source.value = rec.source || ''; textForm.inputs.as_of.value = rec.as_of || '';
        if (same) { textForm.inputs.title.value = rec.title || ''; textForm.inputs.subtitle.value = rec.subtitle || ''; textForm.__edited = { title: !!rec.title, subtitle: !!rec.subtitle }; }
      }
      if (lay.roles.length || lay.id !== 'house-style') { form.appendChild(h('h4', { 'class': 'rag-head', text: 'Words' })); form.appendChild(textForm); form.appendChild(preview); }
      else { form.appendChild(h('h4', { 'class': 'rag-head', text: 'Source line for every chart' })); form.appendChild(textForm); textForm.inputs.title.closest('label').style.display = textForm.inputs.subtitle.closest('label').style.display = 'none'; }
      suggest();
    }
    build();
    if (rec) form.appendChild(h('p', { 'class': 'hint', text: 'Clear the title to get a new suggestion from the numbers. Update rebuilds the charts in the same place, as one undo step. To change single bars, series or filters on one chart, use Reshape chart instead.' }));
    MS.dialog({ title: (rec ? 'Edit chart layout: ' : 'Chart layout: ') + lay.name, wide: true, body: h('div', { 'class': 'lay-fill' }, [head, topForm, form]),
      buttons: [{ label: rec ? '‹ Switch layout' : '‹ All layouts', value: 'back' }, { label: 'Cancel', value: null }, { label: rec ? 'Update' : 'Insert', primary: true, value: function () {
        var a = current(), t = textForm.values();
        a.title = t.title || undefined; a.subtitle = t.subtitle; a.source = t.source || undefined; a.as_of = t.as_of || undefined;
        try { if (lay.roles.length) Ly.preview(id, a); } catch (e) { MS.dialogError(e.message); return false; }
        return a;
      } }] }).then(function (a) {
      if (a === 'back') return Ly.gallery(null, run);
      if (!a) return;
      if (rec) return Ly.edit(run, { layout: id, dataset: a.dataset, fields: a.fields, options: a.options, title: a.title || undefined, subtitle: a.subtitle, source: a.source || '', as_of: a.as_of || '' }).then(function (res) {
        MS.toast('Updated “' + lay.name + '”. Ctrl+Z puts the old version back.' + (res.issues.length ? ' ' + res.issues[0] : ''), res.issues.length ? 'warn' : 'ok', 7000);
      }, function (e) { MS.toast(e.message, 'error', 8000); });
      return Ly.insert(id, a).then(function (res) {
        MS.toast('Inserted “' + lay.name + '”' + (res.dataset && a.sample ? ' with sample data (dataset “' + res.dataset + '”)' : '') + '. Ctrl+Z removes it in one step.' + (res.issues.length ? ' ' + res.issues[0] : ''), res.issues.length ? 'warn' : 'ok', 7000);
      }, function (e) { MS.toast(e.message, 'error', 8000); });
    });
  };

  // Edit the layout behind a chart (from the floating toolbar, the Charts tab or the palette).
  Ly.editDialog = function (key) {
    var r = MS.rt(); key = key || (MS.charts.selectedKey && MS.charts.selectedKey());
    var run = key && Ly.runOf(key);
    if (!run) { var ref = MS.sel && MS.blocks.of(MS.sel); ref = ref && (ref.getAttribute('data-ms-id') || ref.getAttribute('data-ms-ref')); run = ref && Ly.runOf(ref); }
    if (!run) return MS.toast('Select a chart that came from a chart layout (Insert › Chart layouts). For any other chart, use Reshape chart.', 'warn', 6000);
    Ly.fill(r.state.layoutRuns[run].layout, run);
  };

  /* ---------------------------------------------------------- tool */
  MS.api.add('chart_layouts', { d: 'Consulting-style chart layouts (from the McKinsey-style recipes): ranked bars with one highlight, columns with a CAGR arrow, bridge, 100% mix, line against target, variance against plan, distribution, risk heat map, risk register RAG, risks by category, inherent vs residual, loss run paid/outstanding, large losses, claims by cause, frequency and severity, incurred bridge, loss triangle, survey top-2-box, Likert, NPS, client against peers, benchmark scorecard, executive summary page and house style; plus dumbbell, paired bars with the gap, ranges with the median, scatter against the 45° line, 2 × 2 matrix, bubble, net bars either side of zero, stacked bars ranked by total, actuals then forecast, stacked area, one line in focus, growth multiples, small multiples, sorted percentile curve, population pyramid, Marimekko, three-way overlap, 100-dot stats, heat grid, multi-series dots, scenario columns, area with a benchmark, signed cohort bars, and threshold dot groups. action: list (default) | preview (the suggested action title and unit line, and the columns it would use) | insert | runs (the layouts already on the page) | edit (rebuild an inserted layout in place with other columns, options, words, or another layout: chart = any chart it made, or run). Leave out fields to let Mothership guess them; sample: true tries the layout on made-up data. Inserting and editing are one undo step each.',
    p: { action: ['string', 'list | preview | insert | runs | edit'], layout: ['string', 'Layout id, from list (with edit: switch to this layout)'], chart: ['string', 'edit: a chart the layout inserted (name or key)'], run: ['string', 'edit: the run id from runs or insert'], keep_title: ['boolean', 'edit: keep the old title even though the numbers change'], dataset: ['string', 'Dataset to use (or the name for the sample data)'], sample: ['boolean', 'Use the layout\'s sample data'], fields: ['object', '{role: column}, e.g. {"cat": "State", "val": "Days"} (roles from list)'], options: ['object', 'Layout options, e.g. {"pick": "Maharashtra", "better": "low"}'], title: ['string', 'Action title (default: suggested from the data)'], subtitle: ['string', 'Unit line'], source: ['string', 'Source line under the chart'], as_of: ['string', 'Data as of (YYYY-MM-DD)'] },
    f: function (a) {
      var act = a.action || 'list';
      if (act === 'list') return { layouts: Ly.list(), groups: Ly.GROUPS };
      if (act === 'runs') return { runs: Ly.runs() };
      if (act === 'edit') return Ly.edit(a.run || a.chart, { layout: a.layout, dataset: a.dataset, fields: a.fields, options: a.options, title: a.title, subtitle: a.subtitle, source: a.source, as_of: a.as_of, keep_title: a.keep_title });
      if (!a.layout) throw new Error('Say which layout (layout: an id from action "list").');
      if (act === 'preview') return Ly.preview(a.layout, a);
      if (act === 'insert') return Ly.insert(a.layout, a);
      throw new Error('action is list, preview, insert, runs or edit.');
    } });
})(window.MS);
