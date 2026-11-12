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
    if (!ds && lay.roles.length) { var x0 = { ds: lay.sample.name, f: lay.sample.fields, o: Object.assign({}, lay.sample.options), rows: sampleRows(lay) }; var d0 = lay.draft(x0) || {}; return { title: d0.title || lay.name, subtitle: lay.sample.unit || d0.sub || '', fields: lay.sample.fields, sample: true }; }
    var x = context(lay, a, ds);
    return { title: x.title, subtitle: x.sub, fields: x.f, options: x.o };
  };
  function sub(v, refs) {
    if (typeof v === 'string' && /^\$\w+$/.test(v)) return refs[v.slice(1)] !== undefined ? refs[v.slice(1)] : v;
    if (Array.isArray(v)) return v.map(function (q) { return sub(q, refs); });
    if (v && typeof v === 'object') { var o = {}; Object.keys(v).forEach(function (k) { o[k] = sub(v[k], refs); }); return o; }
    return v;
  }
  // a: { dataset, sample, fields: {role: column}, options, title, subtitle, source, as_of }  ->  Promise<{ layout, charts, dataset, title, issues }>
  Ly.insert = function (id, a) {
    var lay = Ly.get(id), r = rt(); a = a || {};
    if (MS.firm && MS.firm.locked && MS.firm.locked() && MS.firm.blocks('chart layout colours')) return Promise.reject(MS.firm.lockedError());
    var ds = a.dataset, child = MS.child, issues = [], refs = {}, charts = [];
    if (lay.roles.length && !ds && !a.sample) return Promise.reject(new Error('Say which dataset to use, or sample: true to try it on sample data.'));
    if (ds && !a.sample && !r.state.datasets[ds]) return Promise.reject(new Error('No dataset "' + ds + '". Datasets: ' + Object.keys(r.state.datasets).join(', ')));
    var label = 'Insert chart layout ' + lay.name;
    return MS.history.groupAsync(label, function () {
      if (a.sample && lay.roles.length) ds = MS.data.addDataset(a.dataset || lay.sample.name, sampleRows(lay), true);
      var x = context(lay, a, lay.roles.length ? ds : null), steps = lay.build(x);
      return steps.reduce(function (p, s, i) {
        return p.then(function () {
          if (MS.child !== child) throw new Error('The dashboard changed while the layout was being inserted.');
          if (s.ifChart && !charts.length) return;
          return MS.api.run(s.tool, sub(s.args, refs)).then(function (res) {
            if (s.tool === 'insert_chart' && res && res.key) { charts.push(res.key); refs[String(charts.length)] = res.key; }
            if (s.as === 'ds') refs.ds = res && res.name;
            if (s.as === 'table') refs.table = res && res.table;
            if (s.as === 'block') refs.block = res && res.ref;
          }, function (e) { issues.push('Step ' + (i + 1) + ' (' + s.tool + '): ' + e.message); });
        });
      }, Promise.resolve()).then(function () {
        // the action title goes in through chart_settings so the commentary header and the chart agree
        var p = charts[0] && !lay.titleOnPage ? MS.api.run('chart_settings', { chart: charts[0], title: x.title }).catch(function (e) { issues.push(e.message); }) : Promise.resolve();
        if (x.source && lay.id !== 'house-style') charts.forEach(function (k) { p = p.then(function () { return MS.api.run('chart_source', { chart: k, text: x.source, as_of: x.asOf || undefined }).catch(function (e) { issues.push(e.message); }); }); });
        return p;
      }).then(function () { return { layout: lay.id, name: lay.name, charts: charts, dataset: ds || null, title: x.title, subtitle: x.sub, issues: issues }; });
    }).then(function (res) {
      MS.afterDomChange();
      return res;
    });
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
    kpi: '<rect x="4" y="14" width="27" height="34" rx="3" fill="#E2E8F0"/><rect x="35" y="14" width="27" height="34" rx="3" fill="#E2E8F0"/><rect x="66" y="14" width="27" height="34" rx="3" fill="#E2E8F0"/><rect x="9" y="26" width="17" height="9" fill="#2251FF"/><rect x="40" y="26" width="17" height="9" fill="#051C2C"/><rect x="71" y="26" width="17" height="9" fill="#C62828"/>'
  };
  function thumb(lay) {
    var s = h('span', { 'class': 'lay-pic', 'aria-hidden': 'true' });
    s.innerHTML = '<svg viewBox="0 0 96 64" width="96" height="64"><defs><marker id="ah" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6z" fill="#2251FF"/></marker></defs>' + (PIC[lay.pic] || PIC.rank) + '</svg>';
    return s;
  }

  /* ---------------------------------------------------------- the gallery and the fill-in dialog */
  Ly.gallery = function (only) {
    var r = MS.rt(); if (!r) return MS.toast('Open a dashboard (or File › New) and turn off Safe mode to add chart layouts.', 'warn');
    var close = function () { var w = MS.$$('.dlg-wrap').pop(); if (w) w.remove(); };
    var search = h('input', { type: 'search', 'class': 'inp', placeholder: 'Search: bridge, loss run, survey, peers…', 'aria-label': 'Search chart layouts' });
    var groups = h('div', { 'class': 'lay-groups' });
    function draw() {
      var q = low(search.value); groups.innerHTML = '';
      Ly.GROUPS.forEach(function (g) {
        var items = L.filter(function (l) { return l.group === g.id && (!only || only === g.id) && (!q || low(l.name + ' ' + l.question + ' ' + g.label).indexOf(q) >= 0); });
        if (!items.length) return;
        groups.appendChild(h('h4', { 'class': 'lay-head', text: g.label }));
        groups.appendChild(h('div', { 'class': 'lay-grid' }, items.map(function (l) {
          return h('button', { 'class': 'lay-card', 'data-layout': l.id, title: l.question, onclick: function () { close(); Ly.fill(l.id); } }, [thumb(l), h('strong', { text: l.name }), h('small', { text: l.question })]);
        })));
      });
      if (!groups.childNodes.length) groups.appendChild(h('p', { 'class': 'muted', text: 'No layout matches. Try another word.' }));
    }
    search.addEventListener('input', draw); draw();
    MS.dialog({ title: 'Chart layouts', sub: 'Consulting-style charts ready to fill: action title, one highlight colour, values on the bars, source line. Pick one, then choose your columns or try it on sample data.', xwide: true,
      body: h('div', { 'class': 'lay-gallery' }, [search, groups]), buttons: [{ label: 'Close', value: null }] });
  };

  Ly.fill = function (id) {
    var lay = Ly.get(id), r = MS.rt(); if (!r) return;
    var names = Object.keys(r.state.datasets);
    var dsField = lay.roles.length ? [{ key: 'ds', label: 'Data', type: 'select', options: [{ value: '', label: 'Sample data (try the layout first)' }].concat(names.map(function (n) { return { value: n, label: n }; })), value: names.length && !/·/.test(names[names.length - 1]) ? names[names.length - 1] : '' }] : [];
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
          var g = Ly.guess(lay, ds);
          colForm = MS.form(lay.roles.map(function (role) { return { key: role.key, label: role.label, type: 'select', options: fieldsOpts(ds, role.kind, role.opt), value: g[role.key] || '' }; }), suggest);
          form.appendChild(h('h4', { 'class': 'rag-head', text: 'Your columns' })); form.appendChild(colForm);
        } else { colForm = null; form.appendChild(h('p', { 'class': 'hint', text: 'Sample data: a small made-up dataset is added to the dashboard so you can see the layout working. Swap in your own data later with Data › Load data, then insert the layout again.' })); }
      }
      var ops = (lay.options || []).map(function (o) { var c = Object.assign({}, o); if (!ds && lay.sample && lay.sample.options && lay.sample.options[o.key] != null) c.value = lay.sample.options[o.key]; return c; });
      optForm = ops.length ? MS.form(ops, suggest) : null;
      if (optForm) { form.appendChild(h('h4', { 'class': 'rag-head', text: 'Options' })); form.appendChild(optForm); }
      textForm = MS.form([{ key: 'title', label: 'Action title (a full sentence with the so-what)' }, { key: 'subtitle', label: 'Unit line (measure, unit, period, scope)' }, { key: 'source', label: 'Source (optional)', placeholder: 'e.g. Policy admin extract' }, { key: 'as_of', label: 'Data as of (optional)', type: 'date' }]);
      textForm.__edited = {};
      ['title', 'subtitle'].forEach(function (k) { textForm.inputs[k].addEventListener('input', function () { textForm.__edited[k] = true; }); });
      if (lay.roles.length || lay.id !== 'house-style') { form.appendChild(h('h4', { 'class': 'rag-head', text: 'Words' })); form.appendChild(textForm); form.appendChild(preview); }
      else { form.appendChild(h('h4', { 'class': 'rag-head', text: 'Source line for every chart' })); form.appendChild(textForm); textForm.inputs.title.closest('label').style.display = textForm.inputs.subtitle.closest('label').style.display = 'none'; }
      suggest();
    }
    build();
    MS.dialog({ title: 'Chart layout: ' + lay.name, wide: true, body: h('div', { 'class': 'lay-fill' }, [head, topForm, form]),
      buttons: [{ label: '‹ All layouts', value: 'back' }, { label: 'Cancel', value: null }, { label: 'Insert', primary: true, value: function () {
        var a = current(), t = textForm.values();
        a.title = t.title || undefined; a.subtitle = t.subtitle; a.source = t.source || undefined; a.as_of = t.as_of || undefined;
        try { if (lay.roles.length) Ly.preview(id, a); } catch (e) { MS.dialogError(e.message); return false; }
        return a;
      } }] }).then(function (a) {
      if (a === 'back') return Ly.gallery();
      if (!a) return;
      return Ly.insert(id, a).then(function (res) {
        MS.toast('Inserted “' + lay.name + '”' + (res.dataset && a.sample ? ' with sample data (dataset “' + res.dataset + '”)' : '') + '. Ctrl+Z removes it in one step.' + (res.issues.length ? ' ' + res.issues[0] : ''), res.issues.length ? 'warn' : 'ok', 7000);
      }, function (e) { MS.toast(e.message, 'error', 8000); });
    });
  };

  /* ---------------------------------------------------------- tool */
  MS.api.add('chart_layouts', { d: 'Consulting-style chart layouts (from the McKinsey-style recipes): ranked bars with one highlight, columns with a CAGR arrow, bridge, 100% mix, line against target, variance against plan, distribution, risk heat map, risk register RAG, risks by category, inherent vs residual, loss run paid/outstanding, large losses, claims by cause, frequency and severity, incurred bridge, loss triangle, survey top-2-box, Likert, NPS, client against peers, benchmark scorecard, executive summary page and house style. action: list (default) | preview (the suggested action title and unit line, and the columns it would use) | insert. Leave out fields to let Mothership guess them; sample: true tries the layout on made-up data. Inserting is one undo step.',
    p: { action: ['string', 'list | preview | insert'], layout: ['string', 'Layout id, from list'], dataset: ['string', 'Dataset to use (or the name for the sample data)'], sample: ['boolean', 'Use the layout\'s sample data'], fields: ['object', '{role: column}, e.g. {"cat": "State", "val": "Days"} (roles from list)'], options: ['object', 'Layout options, e.g. {"pick": "Maharashtra", "better": "low"}'], title: ['string', 'Action title (default: suggested from the data)'], subtitle: ['string', 'Unit line'], source: ['string', 'Source line under the chart'], as_of: ['string', 'Data as of (YYYY-MM-DD)'] },
    f: function (a) {
      var act = a.action || 'list';
      if (act === 'list') return { layouts: Ly.list(), groups: Ly.GROUPS };
      if (!a.layout) throw new Error('Say which layout (layout: an id from action "list").');
      if (act === 'preview') return Ly.preview(a.layout, a);
      if (act === 'insert') return Ly.insert(a.layout, a);
      throw new Error('action is list, preview or insert.');
    } });
})(window.MS);
