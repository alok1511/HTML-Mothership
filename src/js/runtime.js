/*
 * Mothership runtime.
 *
 * This function is NEVER called in the Mothership window. Its source text is
 * injected into the child document (inside the editor) and into every exported
 * HTML file, so the exported dashboard keeps its tabs, filters, tooltips and
 * drill-downs without Mothership. It must therefore be fully self-contained:
 * no references to anything outside its own body.
 *
 * State lives in <script id="ms-state" type="application/json">.
 * Everything the runtime creates is "generated" (no data-ms-id / data-ms-own
 * attribute) and is stripped on export, then rebuilt on load.
 */
window.MS = window.MS || {};
MS.RUNTIME_FN = function MothershipRuntime() {
  'use strict';
  if (window.__MS_RT) return;
  var EDITOR = !!window.__MS_EDITOR;
  var rt = (window.__MS_RT = { version: '1.0.0' });
  var D = document;

  /* ------------------------------------------------------------ state */
  function readState() {
    var s = D.getElementById('ms-state');
    try { return s ? JSON.parse(s.textContent || '{}') : {}; } catch (e) { return {}; }
  }
  function normalize(s) {
    s = s || {};
    s.v = 1;
    s.charts = s.charts || {};
    s.datasets = s.datasets || {};
    s.filters = s.filters || [];
    s.textOverrides = s.textOverrides || {};
    s.kpis = s.kpis || {};
    s.comments = s.comments || [];
    s.tableRules = s.tableRules || {}; // colour rules per table: {tableKey: [{col, type, ...}]}
    s.pageNotes = s.pageNotes || {};   // speaker notes for the dashboard's own tabs, by tab title
    s.annotations = s.annotations || []; // notes pinned to chart points: [{id, chart, label, series, kind, text, dx, dy, fx, fy, color}]
    s.shapes = s.shapes || []; // drawn on charts: [{id, chart, kind, a:{fx,fy}|{label,series}, b, text, color, width, dash, fill, head, lift, show}]
    s.layout = s.layout || {};
    var L = s.layout;
    L.ribbon = L.ribbon || {};
    L.ribbon.height = L.ribbon.height || 46;
    L.ribbon.position = L.ribbon.position || 'top';
    L.pane = L.pane || {};
    L.pane.width = L.pane.width || 230;
    if (L.pane.visible === undefined) L.pane.visible = true;
    L.tip = L.tip || {};
    L.orders = L.orders || [];  // category orders, e.g. [['North','South','East','West']]
    L.colors = L.colors || {};  // colour per category or series name, shared by every chart
    return s;
  }
  rt.state = normalize(readState());
  rt.setState = function (obj) { rt.state = normalize(JSON.parse(JSON.stringify(obj))); rt.refresh(true); };
  rt.getState = function () { return JSON.parse(JSON.stringify(rt.state)); };
  rt.filterValues = {}; // { dataset: { field: value } }  (runtime only)
  rt.drill = {};        // { chartKey: [ {field, value} ] }  (runtime only)
  rt.groups = {};       // { chartKey: { label: groupStats } }

  /* ------------------------------------------------------------ utils */
  function el(tag, attrs, kids) {
    var e = D.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? D.createTextNode(c) : c); });
    return e;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function deepClone(o, seen) {
    // clone plain objects/arrays, keep functions and class instances by reference
    if (o === null || typeof o !== 'object') return o;
    seen = seen || new Map();
    if (seen.has(o)) return seen.get(o);
    if (Array.isArray(o)) { var a = []; seen.set(o, a); o.forEach(function (v) { a.push(deepClone(v, seen)); }); return a; }
    var proto = Object.getPrototypeOf(o);
    if (proto !== Object.prototype && proto !== null) return o;
    var r = {}; seen.set(o, r);
    Object.keys(o).forEach(function (k) { r[k] = deepClone(o[k], seen); });
    return r;
  }
  rt.deepClone = deepClone;

  function fmtNum(v, spec) {
    if (v === null || v === undefined || v === '') return '';
    var n = Number(v);
    if (isNaN(n)) return String(v);
    var IN = function (x, d) { return x.toLocaleString('en-IN', { maximumFractionDigits: d == null ? 2 : d, minimumFractionDigits: 0 }); };
    var L = locale(), LN = function (x, d) { return nf(x, { maximumFractionDigits: d == null ? 2 : d, minimumFractionDigits: 0 }); };
    switch (spec) {
      case 'cur': return nf(n, { style: 'currency', currency: L.currency, maximumFractionDigits: Math.abs(n) < 10 ? 2 : 0, minimumFractionDigits: 0 });
      case 'cur2': return nf(n, { style: 'currency', currency: L.currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'short': return shortNum(n, false);
      case 'curshort': return shortNum(n, true);
      case 'num': return LN(n, 2);
      case 'inr': return '₹' + IN(n, 0);
      case 'inr2': return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'cr': return '₹' + IN(n / 1e7, 2) + ' Cr';
      case 'lakh': case 'l': return '₹' + IN(n / 1e5, 2) + ' L';
      case 'k': return LN(n / 1e3, 1) + 'K';
      case 'm': case 'mn': return LN(n / 1e6, 2) + 'M';
      case 'bn': return LN(n / 1e9, 2) + 'B';
      case 'pct': return LN(n, 1) + '%';
      case 'pct100': return LN(n * 100, 1) + '%';
      case 'int': return LN(n, 0);
      case 'usd': return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
      case 'raw': return String(n);
      default:
        if (spec && /^0(\.0+)?$/.test(spec)) { var d = spec.indexOf('.') < 0 ? 0 : spec.length - 2; return nf(n, { minimumFractionDigits: d, maximumFractionDigits: d }); }
        return LN(n, 2);
    }
  }
  /* Region and currency: state.locale = { country, locale: 'en-US', currency: 'USD', units: 'intl' | 'indian' }.
     US English and the US dollar unless the dashboard says otherwise. */
  function locale() {
    var x = (rt.state && rt.state.locale) || {}, lc = x.locale || 'en-US', cur = (x.currency || 'USD').toUpperCase();
    return { country: x.country || (lc.split('-')[1] || 'US'), locale: lc, currency: cur, indian: x.units ? x.units === 'indian' : (/-IN$/.test(lc) || cur === 'INR') };
  }
  rt.locale = locale;
  var NF = {};
  function nf(x, o) {
    var L = locale(), k = L.locale + JSON.stringify(o);
    try { if (!NF[k]) NF[k] = new Intl.NumberFormat(L.locale, o); return NF[k].format(x); }
    catch (e) { try { return new Intl.NumberFormat('en-US', o).format(x); } catch (e2) { return String(x); } }
  }
  function curSymbol(code) {
    var L = locale(); code = code || L.currency;
    try { var p = new Intl.NumberFormat(L.locale, { style: 'currency', currency: code }).formatToParts(1).filter(function (q) { return q.type === 'currency'; })[0]; return p ? p.value : code; } catch (e) { return code; }
  }
  rt.curSymbol = curSymbol;
  // 1.2M / $1.2M (or 1.2 Cr / ₹1.2 Cr with Indian units)
  // code: a currency the chart itself names (₹, €…), which wins over the region's
  function shortNum(n, money, code) {
    var L = locale(), a = Math.abs(n), d2 = { maximumFractionDigits: 2, minimumFractionDigits: 0 };
    if (code ? code === 'INR' : L.indian) {
      var u = a >= 1e7 ? [1e7, ' Cr'] : a >= 1e5 ? [1e5, ' L'] : a >= 1e3 ? [1e3, 'K'] : [1, ''];
      return (money ? curSymbol(code) : '') + nf(n / u[0], d2) + u[1];
    }
    var o = a >= 1e3 ? { notation: 'compact', compactDisplay: 'short', maximumSignificantDigits: 3 } : { maximumFractionDigits: a < 10 ? 2 : 0 };
    if (money) { o.style = 'currency'; o.currency = code || L.currency; }
    return nf(n, o);
  }
  function fmt(tpl, ctx) {
    return String(tpl).replace(/\{([\w.$ -]+?)(?::([\w.]+))?\}/g, function (m, k, spec) {
      var v = ctx[k];
      if (v === undefined) return '';
      if (typeof v === 'number' || spec) return fmtNum(v, spec);
      return String(v);
    });
  }
  rt.fmt = fmt;
  rt.fmtNum = fmtNum;

  /* ------------------------------------------------------------ chart adapters */
  function sum(arr) { var s = 0; (arr || []).forEach(function (v) { var n = Number(v && typeof v === 'object' ? (v.y != null ? v.y : v.value) : v); if (!isNaN(n)) s += n; }); return s; }

  function put(o, k, v) { if (v === undefined) delete o[k]; else o[k] = v; }
  function fontOf(st, size) { var f = {}; if (st.font) f.family = st.font; if (size) f.size = +size; return f; }

  var A = {};
  // Chart.js 4 keeps the old colours on screen after update('none'); a full update with animation off redraws them at once
  function cjsStill(i) { var o = i.options, a = o ? o.animation : undefined; if (o) o.animation = false; i.update(); if (o) o.animation = a; }
  A.chartjs = {
    list: function () {
      var C = window.Chart;
      if (!C || !C.instances) return [];
      return Object.keys(C.instances).map(function (k) { var i = C.instances[k]; return { el: i.canvas, inst: i }; }).filter(function (x) { return x.el && x.el.isConnected; });
    },
    info: function (i) {
      var p = (i.config.options && i.config.options.plugins) || {};
      return {
        type: i.config.type,
        title: (p.title && p.title.display !== false && p.title.text) ? [].concat(p.title.text).join(' ') : '',
        labels: (i.data.labels || []).slice(0, 200),
        series: i.data.datasets.map(function (d) { return d.label || ''; })
      };
    },
    snapshot: function (i) {
      if (i.__msOrig) return;
      var ro = i.config.options || {}, tt = ro.plugins && ro.plugins.tooltip && ro.plugins.tooltip.callbacks;
      i.__msOrig = {
        labels: deepClone(i.data.labels),
        datasets: i.data.datasets.map(function (d) { return { data: deepClone(d.data), label: d.label, backgroundColor: d.backgroundColor, borderColor: d.borderColor }; }),
        label: tt ? tt.label : undefined
      };
    },
    setTooltip: function (i, fn) {
      this.snapshot(i);
      var o = i.config.options = i.config.options || {}; o.plugins = o.plugins || {};
      var t = o.plugins.tooltip = o.plugins.tooltip || {};
      t.callbacks = t.callbacks || {};
      if (!fn) { t.callbacks.label = i.__msOrig.label; i.update('none'); return; }
      t.callbacks.label = function (ctx) {
        var v = ctx.parsed;
        if (v && typeof v === 'object') v = o.indexAxis === 'y' ? v.x : (v.y != null ? v.y : (v.r != null ? v.r : v.x));
        return fn({ label: ctx.label, series: ctx.dataset.label, value: v, index: ctx.dataIndex, total: sum(ctx.dataset.data) }).split('\n');
      };
      i.update('none');
    },
    setCatColors: function (i, map) {
      var labels = i.data.labels || [], radial = /pie|doughnut|polarArea/.test(i.config.type), many = i.data.datasets.length > 1 && !radial;
      i.data.datasets.forEach(function (d) {
        var line = (d.type || i.config.type) === 'line' || (d.type || i.config.type) === 'radar';
        if (many) { var c = map[d.label]; if (c) { d.borderColor = c; d.backgroundColor = line ? c + '33' : c; } return; }
        if (line) return;
        var base = d.backgroundColor;
        d.backgroundColor = labels.map(function (l, j) { return map[l] || (Array.isArray(base) ? base[j % base.length] : base); });
        if (!radial) d.borderColor = d.backgroundColor;
      });
      cjsStill(i);
    },
    image: function (i) {
      var cv = i.canvas, out = document.createElement('canvas'); out.width = cv.width; out.height = cv.height;
      var x = out.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, out.width, out.height); x.drawImage(cv, 0, 0);
      return Promise.resolve(out.toDataURL('image/png'));
    },
    setPalette: function (i, colors) {
      this.snapshot(i);
      var radial = /pie|doughnut|polarArea/.test(i.config.type);
      i.data.datasets.forEach(function (d, k) {
        if (!colors) { var o = i.__msOrig.datasets[k] || {}; d.backgroundColor = o.backgroundColor; d.borderColor = o.borderColor; return; }
        if (radial) { d.backgroundColor = (i.data.labels || []).map(function (_, j) { return colors[j % colors.length]; }); d.borderColor = '#fff'; }
        else {
          var c = colors[k % colors.length];
          var line = (d.type || i.config.type) === 'line' || (d.type || i.config.type) === 'radar';
          d.borderColor = c; d.backgroundColor = line ? c + '33' : c;
        }
      });
      cjsStill(i);
    },
    setData: function (i, labels, series) {
      this.snapshot(i);
      if (!labels) { // restore
        i.data.labels = deepClone(i.__msOrig.labels);
        i.__msOrig.datasets.forEach(function (o, k) { if (i.data.datasets[k]) { i.data.datasets[k].data = deepClone(o.data); i.data.datasets[k].label = o.label; } });
        i.data.datasets.length = i.__msOrig.datasets.length;
        i.update(); return;
      }
      i.data.labels = labels;
      series.forEach(function (s, k) {
        var d = i.data.datasets[k];
        if (!d) { d = Object.assign({}, i.data.datasets[0]); i.data.datasets.push(d); }
        d.data = s.values; d.label = s.name;
      });
      i.data.datasets.length = series.length;
      i.update();
    },
    setStyle: function (i, st) {
      var o = i.config.options = i.config.options || {}; o.plugins = o.plugins || {};
      var TK = ['backgroundColor', 'titleColor', 'bodyColor', 'footerColor', 'borderColor', 'borderWidth', 'titleFont', 'bodyFont', 'cornerRadius'];
      if (!i.__msStyleOrig) { var t0 = o.plugins.tooltip || {}, tk = {}; TK.forEach(function (k) { tk[k] = deepClone(t0[k]); }); i.__msStyleOrig = { scales: deepClone(o.scales), legend: deepClone(o.plugins.legend), title: deepClone(o.plugins.title), tip: tk }; }
      var O = i.__msStyleOrig;
      put(o, 'scales', deepClone(O.scales)); put(o.plugins, 'legend', deepClone(O.legend)); put(o.plugins, 'title', deepClone(O.title));
      var t = o.plugins.tooltip = o.plugins.tooltip || {};
      TK.forEach(function (k) { put(t, k, deepClone(O.tip[k])); });
      if (st) {
        var f = fontOf(st, st.size), hasF = !!(st.font || st.size);
        var tint = function (x) { if (!x) return; if (hasF) x.font = Object.assign({}, typeof x.font === 'object' ? x.font : {}, f); if (st.color) x.color = st.color; };
        if (!/^(pie|doughnut)$/.test(i.config.type) && (hasF || st.color || st.axisFormat)) {
          o.scales = o.scales || {};
          Object.keys(i.scales || {}).forEach(function (id) {
            var sc = o.scales[id] = o.scales[id] || {};
            tint(sc.ticks = sc.ticks || {});
            if (st.axisFormat && id !== 'r' && i.scales[id].type !== 'category') sc.ticks.callback = function (v) { return fmtNum(v, st.axisFormat); };
            if (sc.title) tint(sc.title);
            if (id === 'r') tint(sc.pointLabels = sc.pointLabels || {});
          });
        }
        var lg = o.plugins.legend = o.plugins.legend || {};
        tint(lg.labels = lg.labels || {});
        if (st.legend === 'none') lg.display = false; else if (st.legend) { lg.display = true; lg.position = st.legend; }
        var ti = o.plugins.title;
        if (ti) { if (st.font) ti.font = Object.assign({}, typeof ti.font === 'object' ? ti.font : {}, { family: st.font }); if (st.color) ti.color = st.color; }
        if (st.tipBg) t.backgroundColor = st.tipBg;
        if (st.tipColor) t.titleColor = t.bodyColor = t.footerColor = st.tipColor;
        if (st.tipBorder) { t.borderColor = st.tipBorder; t.borderWidth = 1; }
        if (st.tipSize || st.font) { t.bodyFont = fontOf(st, st.tipSize); t.titleFont = Object.assign(fontOf(st, st.tipSize), { weight: 'bold' }); }
        if (st.tipRadius !== undefined && st.tipRadius !== '') t.cornerRadius = +st.tipRadius;
      }
      cjsStill(i);
    },
    onDbl: function (elm, i, cb) {
      elm.addEventListener('dblclick', function (e) {
        var pts = i.getElementsAtEventForMode(e, 'nearest', { intersect: true }, true);
        if (pts.length) cb({ label: i.data.labels[pts[0].index], index: pts[0].index, series: pts[0].datasetIndex });
      });
    },
    clone: function (i, target) {
      var cv = el('canvas');
      target.appendChild(cv);
      var opts = deepClone(i.config.options || {});
      opts.maintainAspectRatio = false; opts.responsive = true;
      return new window.Chart(cv, { type: i.config.type, data: deepClone(i.data), options: opts, plugins: i.config.plugins });
    },
    fill: function (i) { var o = i.config.options = i.config.options || {}; o.maintainAspectRatio = false; o.responsive = true; i.update('none'); },
    resize: function (i) { try { i.resize(); } catch (e) {} }
  };

  A.echarts = {
    list: function () {
      var E = window.echarts;
      if (!E) return [];
      return Array.prototype.map.call(D.querySelectorAll('[_echarts_instance_]'), function (e) { return { el: e, inst: E.getInstanceByDom(e) }; })
        .filter(function (x) { return x.inst && !x.inst.isDisposed(); });
    },
    cat: function (o) {
      var x = o.xAxis && o.xAxis[0], y = o.yAxis && o.yAxis[0];
      if (x && (x.type === 'category' || (x.data && !y.data))) return 'xAxis';
      if (y && (y.type === 'category' || y.data)) return 'yAxis';
      return null;
    },
    info: function (i) {
      var o = i.getOption(), ax = this.cat(o), s0 = (o.series || [])[0] || {};
      var labels = ax ? (o[ax][0].data || []) : (s0.data || []).map(function (d) { return d && d.name; });
      return { type: s0.type, title: (o.title && o.title[0] && o.title[0].text) || '', labels: labels.slice(0, 200), series: (o.series || []).map(function (s) { return s.name || ''; }) };
    },
    snapshot: function (i) {
      if (i.__msOrig) return;
      var o = i.getOption();
      i.__msOrig = { series: deepClone(o.series), xAxis: deepClone(o.xAxis), yAxis: deepClone(o.yAxis), color: deepClone(o.color), tooltip: deepClone(o.tooltip) };
    },
    setTooltip: function (i, fn) {
      this.snapshot(i);
      if (!fn) { i.setOption({ tooltip: i.__msOrig.tooltip }); return; }
      i.setOption({ tooltip: { formatter: function (p) {
        var arr = Array.isArray(p) ? p : [p];
        return arr.map(function (q) {
          var v = Array.isArray(q.value) ? q.value[q.value.length - 1] : (q.value && typeof q.value === 'object' ? q.value.value : q.value);
          return esc(fn({ label: q.name, series: q.seriesName, value: v, pct: q.percent, index: q.dataIndex })).replace(/\n/g, '<br>');
        }).join('<br>');
      } } });
    },
    setCatColors: function (i, map) {
      var o = i.getOption(), ax = this.cat(o), ss = o.series || [];
      var labels = ax ? (o[ax][0].data || []).map(function (x) { return x && typeof x === 'object' ? x.value : x; }) : null;
      var many = ss.length > 1 && !/pie|funnel/.test((ss[0] || {}).type);
      var ns = ss.map(function (sr) {
        if (many) { var c = map[sr.name]; return c ? { itemStyle: { color: c }, lineStyle: { color: c } } : {}; }
        return { data: (sr.data || []).map(function (d, j) {
          var name = labels ? labels[j] : d && d.name, c = map[name];
          var item = d && typeof d === 'object' && !Array.isArray(d) ? Object.assign({}, d) : { value: d };
          if (c) item.itemStyle = Object.assign({}, item.itemStyle, { color: c });
          return item;
        }) };
      });
      i.setOption({ series: ns });
    },
    image: function (i) { return Promise.resolve(i.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })); },
    setPalette: function (i, colors) { this.snapshot(i); i.setOption({ color: colors || i.__msOrig.color }); },
    setData: function (i, labels, series) {
      this.snapshot(i);
      var O = i.__msOrig;
      if (!labels) { i.setOption({ series: deepClone(O.series), xAxis: deepClone(O.xAxis), yAxis: deepClone(O.yAxis) }, { replaceMerge: ['series'] }); return; }
      var o = i.getOption(), ax = this.cat(o);
      var base = O.series[0] || { type: 'bar' };
      var radial = /pie|funnel/.test(base.type);
      var ns = series.map(function (s, k) {
        var b = Object.assign({}, O.series[k] || base);
        b.name = s.name; delete b.id;
        b.data = radial ? labels.map(function (l, j) { return { name: l, value: s.values[j] }; }) : s.values.slice();
        return b;
      });
      var patch = { series: ns };
      if (ax) { var a = deepClone(o[ax]); a[0].data = labels; patch[ax] = a; }
      i.setOption(patch, { replaceMerge: ['series'] });
    },
    setStyle: function (i, st) {
      var o = i.getOption();
      if (!i.__msStyleOrig) {
        var ax = function (a) { var l = deepClone(a.axisLabel) || {}; if (l.formatter === undefined) l.formatter = null; return { axisLabel: l, nameTextStyle: deepClone(a.nameTextStyle) || {} }; };
        i.__msStyleOrig = {
          textStyle: deepClone(o.textStyle) || {},
          xAxis: (o.xAxis || []).map(ax), yAxis: (o.yAxis || []).map(ax),
          legend: (o.legend || []).map(function (l) { return { show: l.show, orient: l.orient || 'horizontal', top: l.top == null ? 'auto' : l.top, bottom: l.bottom == null ? 'auto' : l.bottom, left: l.left == null ? 'auto' : l.left, right: l.right == null ? 'auto' : l.right, textStyle: deepClone(l.textStyle) || {} }; }),
          title: (o.title || []).map(function (t) { return { textStyle: deepClone(t.textStyle) || {} }; }),
          tooltip: (o.tooltip || []).map(function (t) { return { backgroundColor: t.backgroundColor, borderColor: t.borderColor, borderWidth: t.borderWidth, borderRadius: t.borderRadius, textStyle: deepClone(t.textStyle) || {} }; })
        };
      }
      var p = deepClone(i.__msStyleOrig);
      if (st) {
        var txt = function (x) { if (st.font) x.fontFamily = st.font; if (st.size) x.fontSize = +st.size; if (st.color) x.color = st.color; };
        if (st.font) p.textStyle.fontFamily = st.font;
        p.xAxis.concat(p.yAxis).forEach(function (a) { txt(a.axisLabel); txt(a.nameTextStyle); });
        p.legend.forEach(function (l) {
          txt(l.textStyle);
          if (st.legend === 'none') l.show = false;
          else if (st.legend) {
            l.show = true; l.orient = st.legend === 'left' || st.legend === 'right' ? 'vertical' : 'horizontal';
            l.top = st.legend === 'top' ? 0 : st.legend === 'bottom' ? 'auto' : 'middle'; l.bottom = st.legend === 'bottom' ? 0 : 'auto';
            l.left = st.legend === 'left' ? 0 : st.legend === 'right' ? 'auto' : 'center'; l.right = st.legend === 'right' ? 0 : 'auto';
          }
        });
        p.title.forEach(function (t) { if (st.font) t.textStyle.fontFamily = st.font; if (st.color) t.textStyle.color = st.color; });
        if (st.axisFormat) ['xAxis', 'yAxis'].forEach(function (ax) { (o[ax] || []).forEach(function (a, k) { if (a.type === 'value' && p[ax][k]) p[ax][k].axisLabel.formatter = function (v) { return fmtNum(v, st.axisFormat); }; }); });
        p.tooltip.forEach(function (t) {
          if (st.tipBg) t.backgroundColor = st.tipBg;
          if (st.tipBorder) { t.borderColor = st.tipBorder; t.borderWidth = 1; }
          if (st.tipRadius !== undefined && st.tipRadius !== '') t.borderRadius = +st.tipRadius;
          if (st.tipColor) t.textStyle.color = st.tipColor;
          if (st.tipSize) t.textStyle.fontSize = +st.tipSize;
          if (st.font) t.textStyle.fontFamily = st.font;
        });
      }
      i.setOption(p);
    },
    onDbl: function (elm, i, cb) { i.on('dblclick', function (p) { cb({ label: p.name, index: p.dataIndex, series: p.seriesIndex }); }); },
    clone: function (i, target) {
      var n = window.echarts.init(target);
      n.setOption(i.getOption());
      return n;
    },
    fill: function () {},
    resize: function (i) { try { i.resize(); } catch (e) {} }
  };

  A.plotly = {
    list: function () {
      if (!window.Plotly) return [];
      return Array.prototype.map.call(D.querySelectorAll('.js-plotly-plot'), function (e) { return { el: e, inst: e }; }).filter(function (x) { return x.el.data; });
    },
    lv: function (t) { return t.type === 'pie' ? { l: t.labels || [], v: t.values || [] } : (t.orientation === 'h' ? { l: t.y || [], v: t.x || [] } : { l: t.x || [], v: t.y || [] }); },
    info: function (e) {
      var t = e.data[0] || {}, tt = e.layout && e.layout.title;
      return { type: t.type || 'scatter', title: (tt && (tt.text || (typeof tt === 'string' ? tt : ''))) || '', labels: [].slice.call(this.lv(t).l, 0, 200), series: e.data.map(function (d) { return d.name || ''; }) };
    },
    snapshot: function (e) { if (!e.__msOrig) e.__msOrig = JSON.parse(JSON.stringify(e.data)); },
    setTooltip: function (e, fn) {
      this.snapshot(e);
      var self = this;
      e.data.forEach(function (t, k) {
        if (!fn) { var o = e.__msOrig[k] || {}; window.Plotly.restyle(e, { hovertext: [o.hovertext], hovertemplate: [o.hovertemplate] }, [k]); return; }
        var lv = self.lv(t), tot = sum(lv.v);
        var txt = [].map.call(lv.l, function (l, j) { return esc(fn({ label: l, series: t.name, value: lv.v[j], index: j, total: tot })).replace(/\n/g, '<br>'); });
        window.Plotly.restyle(e, { hovertext: [txt], hovertemplate: ['%{hovertext}<extra></extra>'] }, [k]);
      });
    },
    setCatColors: function (e, map) {
      var self = this, many = e.data.length > 1 && (e.data[0] || {}).type !== 'pie';
      e.data.forEach(function (t, k) {
        if (many) { var c = map[t.name]; if (c) window.Plotly.restyle(e, { 'marker.color': c, 'line.color': c }, [k]); return; }
        var full = (e._fullData || [])[k] || {}, fm = full.marker || {};
        var base = t.type === 'pie' ? (fm.colors || []) : fm.color;
        var cols = [].map.call(self.lv(t).l, function (l, j) { return map[l] || (Array.isArray(base) ? base[j % (base.length || 1)] : base); });
        if (t.type === 'pie') window.Plotly.restyle(e, { 'marker.colors': [cols] }, [k]); else window.Plotly.restyle(e, { 'marker.color': [cols] }, [k]);
      });
    },
    image: function (e) { return window.Plotly.toImage(e, { format: 'png', scale: 2 }); },
    setPalette: function (e, colors) {
      this.snapshot(e);
      e.data.forEach(function (t, k) {
        if (!colors) { var o = e.__msOrig[k] || {}; window.Plotly.restyle(e, { marker: [o.marker || {}], line: [o.line || {}] }, [k]); return; }
        if (t.type === 'pie') window.Plotly.restyle(e, { 'marker.colors': [colors] }, [k]);
        else window.Plotly.restyle(e, { 'marker.color': colors[k % colors.length], 'line.color': colors[k % colors.length] }, [k]);
      });
    },
    setData: function (e, labels, series) {
      this.snapshot(e);
      if (!labels) { window.Plotly.react(e, JSON.parse(JSON.stringify(e.__msOrig)), e.layout); return; }
      var base = e.__msOrig;
      var nd = series.map(function (s, k) {
        var t = JSON.parse(JSON.stringify(base[k] || base[0]));
        var cur = e.data[k] || e.data[0];
        if (cur && cur.marker) t.marker = JSON.parse(JSON.stringify(cur.marker)); // keep the current (themed) colours
        t.name = s.name; delete t.hovertext; delete t.text;
        if (t.type === 'pie') { t.labels = labels; t.values = s.values; }
        else if (t.orientation === 'h') { t.y = labels; t.x = s.values; }
        else { t.x = labels; t.y = s.values; }
        return t;
      });
      window.Plotly.react(e, nd, e.layout);
    },
    setStyle: function (e, st) {
      var L = e.layout || {};
      var cp = function (v) { return v === undefined ? null : JSON.parse(JSON.stringify(v)); };
      if (!e.__msStyleOrig) e.__msStyleOrig = { font: cp(L.font), hoverlabel: cp(L.hoverlabel), showlegend: cp(L.showlegend), legend: cp(L.legend) };
      var O = e.__msStyleOrig, u = { font: cp(O.font), hoverlabel: cp(O.hoverlabel), showlegend: cp(O.showlegend), legend: cp(O.legend) };
      if (st) {
        if (st.font || st.size || st.color) { u.font = u.font || {}; if (st.font) u.font.family = st.font; if (st.size) u.font.size = +st.size; if (st.color) u.font.color = st.color; }
        if (st.tipBg || st.tipColor || st.tipBorder || st.tipSize || st.font) {
          var hl = u.hoverlabel = u.hoverlabel || {}; hl.font = hl.font || {};
          if (st.tipBg) hl.bgcolor = st.tipBg; if (st.tipBorder) hl.bordercolor = st.tipBorder;
          if (st.tipColor) hl.font.color = st.tipColor; if (st.tipSize) hl.font.size = +st.tipSize; if (st.font) hl.font.family = st.font;
        }
        if (st.legend === 'none') u.showlegend = false;
        else if (st.legend) {
          u.showlegend = true;
          u.legend = Object.assign(u.legend || {}, { top: { orientation: 'h', x: 0, xanchor: 'left', y: 1.12, yanchor: 'bottom' }, bottom: { orientation: 'h', x: 0, xanchor: 'left', y: -0.18, yanchor: 'top' }, right: { orientation: 'v', x: 1.02, xanchor: 'left', y: 1, yanchor: 'top' }, left: { orientation: 'v', x: -0.15, xanchor: 'right', y: 1, yanchor: 'top' } }[st.legend]);
        }
      }
      window.Plotly.relayout(e, u);
    },
    onDbl: function (e, i, cb) {
      var last = null;
      e.on('plotly_click', function (d) {
        var p = d.points && d.points[0]; if (!p) return;
        var label = p.label != null ? p.label : (p.data.orientation === 'h' ? p.y : p.x);
        var now = Date.now();
        if (last && now - last.t < 450 && last.label === label) { last = null; cb({ label: label, index: p.pointNumber, series: p.curveNumber }); }
        else last = { t: now, label: label };
      });
    },
    clone: function (e, target) {
      window.Plotly.newPlot(target, JSON.parse(JSON.stringify(e.data)), JSON.parse(JSON.stringify(e.layout || {})), { responsive: true });
      return target;
    },
    fill: function (e) { window.Plotly.relayout(e, { autosize: true }); },
    resize: function (e) { try { window.Plotly.Plots.resize(e); } catch (x) {} }
  };
  // An <svg> drawn onto a white canvas, as a PNG (Highcharts and D3 charts).
  function svgImage(svg, scale) {
    return new Promise(function (res, rej) {
      var r = svg.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
      var c = svg.cloneNode(true); c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); c.setAttribute('width', w); c.setAttribute('height', h);
      if (!c.getAttribute('viewBox') && !svg.getAttribute('viewBox')) c.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      var cs = getComputedStyle(svg); c.style.fontFamily = cs.fontFamily; c.style.fontSize = cs.fontSize;
      var img = new Image(), s = scale || 2;
      img.onload = function () {
        var out = document.createElement('canvas'); out.width = w * s; out.height = h * s;
        var x = out.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, out.width, out.height); x.drawImage(img, 0, 0, out.width, out.height);
        res(out.toDataURL('image/png'));
      };
      img.onerror = function () { rej(new Error('The chart could not be drawn as an image.')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(c));
    });
  }
  rt.svgImage = svgImage;

  A.highcharts = {
    list: function () {
      var H = window.Highcharts;
      if (!H || !H.charts) return [];
      return H.charts.filter(function (c) { return c && c.renderTo && c.renderTo.isConnected; }).map(function (c) { return { el: c.renderTo, inst: c }; });
    },
    pie: function (c) { var s = c.series[0]; return !!s && /pie|funnel|pyramid|variablepie/.test(s.type); },
    labelsOf: function (c) {
      var ax = c.xAxis && c.xAxis[0], s = c.series[0];
      if (!this.pie(c) && ax && ax.categories && ax.categories.length) return ax.categories.slice();
      return s ? (s.options.data || []).map(function (d, j) { var p = s.points && s.points[j]; return String(p && p.name != null ? p.name : (d && d.name != null ? d.name : (Array.isArray(d) && typeof d[0] === 'string' ? d[0] : (p && p.category != null ? p.category : j + 1)))); }) : [];
    },
    info: function (c) {
      var o = c.options || {}, t = o.title && o.title.text;
      return { type: (o.chart && o.chart.type) || (c.series[0] && c.series[0].type) || 'line', title: t || '', labels: this.labelsOf(c).slice(0, 200), series: c.series.map(function (s) { return s.name || ''; }) };
    },
    data: function (c, now) {
      var O = !now && c.__msOrig, labels = O ? O.labels : this.labelsOf(c);
      var src = O ? O.series : c.series.map(function (s) { return { name: s.name, data: s.options.data || [] }; });
      return { labels: labels, series: src.map(function (s, k) { return { name: s.name || ('Series ' + (k + 1)), values: (s.data || []).map(function (d) { return num(Array.isArray(d) ? d[d.length - 1] : d); }) }; }) };
    },
    colors: function (c, labels) {
      var out = {};
      if (c.series.length > 1 && !this.pie(c)) c.series.forEach(function (s) { if (s.name && typeof s.color === 'string') out[s.name] = s.color; });
      else if (c.series[0]) (c.series[0].points || []).forEach(function (p, j) { if (typeof p.color === 'string') out[labels[j]] = p.color; });
      return out;
    },
    snapshot: function (c) {
      if (c.__msOrig) return;
      var tt = c.options.tooltip || {};
      c.__msOrig = { labels: this.labelsOf(c), series: c.series.map(function (s) { return { name: s.name, data: deepClone(s.options.data || []), color: s.options.color, colors: deepClone(s.options.colors) }; }), formatter: tt.formatter, useHTML: tt.useHTML, colors: deepClone(c.options.colors) };
    },
    setTooltip: function (c, fn) {
      this.snapshot(c);
      var O = c.__msOrig;
      if (!fn) { c.update({ tooltip: { formatter: O.formatter || function () { return this.defaultFormatter.call(this, this.series.chart.tooltip); }, useHTML: !!O.useHTML } }, true, false, false); return; }
      c.update({ tooltip: { useHTML: true, formatter: function () {
        var p = this.point || {}, s = this.series || p.series || {};
        var vals = (s.points || []).map(function (q) { return q.y; });
        var label = p.name != null ? p.name : (this.key != null ? this.key : p.category);
        return esc(fn({ label: label, series: s.name, value: this.y, index: p.index, total: this.total != null && !/pie/.test(s.type) ? this.total : sum(vals) })).replace(/\n/g, '<br>');
      } } }, true, false, false);
    },
    setCatColors: function (c, map) {
      var labels = this.labelsOf(c);
      if (c.series.length > 1 && !this.pie(c)) c.series.forEach(function (s) { var col = map[s.name]; if (col) s.update({ color: col }, false); });
      else if (c.series[0]) (c.series[0].points || []).forEach(function (p, j) { var col = map[labels[j]]; if (col) p.update({ color: col }, false, false); });
      c.redraw(false);
    },
    image: function (c) { return svgImage(c.container.querySelector('svg')); },
    setPalette: function (c, colors) {
      this.snapshot(c);
      var O = c.__msOrig, pie = this.pie(c);
      c.update({ colors: colors || O.colors || window.Highcharts.getOptions().colors }, false);
      c.series.forEach(function (s, k) {
        var o = O.series[k] || {};
        if (pie) { s.update({ colors: colors || o.colors || undefined }, false); (s.points || []).forEach(function (p, j) { var pal = colors || o.colors || window.Highcharts.getOptions().colors; p.update({ color: pal[j % pal.length] }, false, false); }); }
        else s.update({ color: colors ? colors[k % colors.length] : (o.color || (O.colors || window.Highcharts.getOptions().colors)[k % 10]) }, false);
      });
      c.redraw(false);
    },
    setData: function (c, labels, series) {
      this.snapshot(c);
      var O = c.__msOrig, pie = this.pie(c), ax = c.xAxis && c.xAxis[0];
      if (!labels) {
        if (ax && !pie && O.labels.length) ax.setCategories(O.labels.slice(), false);
        O.series.forEach(function (o, k) { var s = c.series[k]; if (s) { s.setData(deepClone(o.data), false); s.update({ name: o.name }, false); } });
        while (c.series.length > O.series.length) c.series[c.series.length - 1].remove(false);
        c.redraw(); return;
      }
      if (ax && !pie) ax.setCategories(labels.slice(), false);
      series.forEach(function (sr, k) {
        var data = pie ? labels.map(function (l, j) { return { name: l, y: sr.values[j] }; }) : sr.values.slice();
        var s = c.series[k];
        if (s) { s.setData(data, false); if (sr.name) s.update({ name: sr.name }, false); }
        else c.addSeries({ name: sr.name, data: data, type: c.series[0] && c.series[0].type }, false);
      });
      while (c.series.length > series.length) c.series[c.series.length - 1].remove(false);
      c.redraw();
    },
    setStyle: function (c, st) {
      var o = c.options;
      var grab = function (x) { return x ? deepClone(x) : {}; };
      if (!c.__msStyleOrig) {
        var tt = o.tooltip || {};
        c.__msStyleOrig = { style: grab(o.chart && o.chart.style), title: grab(o.title && o.title.style), legend: { enabled: o.legend ? o.legend.enabled !== false : true, align: (o.legend || {}).align || 'center', verticalAlign: (o.legend || {}).verticalAlign || 'bottom', layout: (o.legend || {}).layout || 'horizontal', itemStyle: grab((o.legend || {}).itemStyle) },
          tip: { backgroundColor: tt.backgroundColor, borderColor: tt.borderColor, borderRadius: tt.borderRadius, style: grab(tt.style) },
          x: (c.xAxis || []).map(function (a) { return { labels: { style: grab(a.options.labels && a.options.labels.style), formatter: a.options.labels && a.options.labels.formatter } }; }),
          y: (c.yAxis || []).map(function (a) { return { labels: { style: grab(a.options.labels && a.options.labels.style), formatter: a.options.labels && a.options.labels.formatter } }; }) };
      }
      var B = deepClone(c.__msStyleOrig), u = { chart: { style: B.style }, title: { style: B.title }, legend: B.legend, tooltip: B.tip };
      var axes = function (list, isY) { return list.map(function (a) { a = deepClone(a); if (!a.labels.formatter) a.labels.formatter = function () { return this.axis.defaultLabelFormatter.call(this); }; if (st) { if (st.size) a.labels.style.fontSize = st.size + 'px'; if (st.color) a.labels.style.color = st.color; if (isY && st.axisFormat) a.labels.formatter = function () { return fmtNum(this.value, st.axisFormat); }; } return a; }); };
      if (st) {
        if (st.font) u.chart.style.fontFamily = st.font;
        if (st.color) { u.title.style.color = st.color; u.legend.itemStyle.color = st.color; }
        if (st.size) u.legend.itemStyle.fontSize = st.size + 'px';
        if (st.legend === 'none') u.legend.enabled = false;
        else if (st.legend) {
          u.legend.enabled = true;
          var side = st.legend === 'left' || st.legend === 'right';
          u.legend.layout = side ? 'vertical' : 'horizontal'; u.legend.align = side ? st.legend : 'center'; u.legend.verticalAlign = side ? 'middle' : st.legend;
        }
        if (st.tipBg) u.tooltip.backgroundColor = st.tipBg;
        if (st.tipBorder) u.tooltip.borderColor = st.tipBorder;
        if (st.tipColor) u.tooltip.style.color = st.tipColor;
        if (st.tipSize) u.tooltip.style.fontSize = st.tipSize + 'px';
        if (st.tipRadius !== undefined && st.tipRadius !== '') u.tooltip.borderRadius = +st.tipRadius;
      }
      if (B.x.length) u.xAxis = axes(B.x, false);
      if (B.y.length) u.yAxis = axes(B.y, true);
      c.update(u, true, false, false);
    },
    onDbl: function (elm, c, cb) {
      elm.addEventListener('dblclick', function () {
        var p = c.hoverPoint; if (!p) return;
        cb({ label: p.name != null ? p.name : p.category, index: p.index, series: p.series.index });
      });
    },
    clone: function (c, target) { var H = window.Highcharts; return H.chart(target, H.merge(c.userOptions, { chart: { renderTo: target } })); },
    fill: function (c) { try { c.update({ chart: { height: null } }, false); c.reflow(); } catch (e) {} },
    resize: function (c) { try { c.reflow(); } catch (e) {} }
  };

  /* D3 (or any script) drawing an SVG whose marks carry their data. Basic support:
     names, pop-ups, colours, look, summaries, image and comments; the data itself is the page's own. */
  A.d3 = {
    basic: true,
    marks: function (svg) {
      return Array.prototype.filter.call(svg.querySelectorAll('rect,path,circle,ellipse,polygon'), function (m) {
        var d = m.__data__; if (d == null || typeof d !== 'object') return false;
        if (m.closest('.domain,.tick,[class*=axis],[class*=legend]')) return false;
        return A.d3.valueOf(d) != null;
      });
    },
    pick: function (d, want) { // first string (label) / number (value) field of a datum
      if (d && d.data && typeof d.data === 'object' && d.startAngle != null) d = d.data; // d3.pie()
      if (Array.isArray(d)) return want === 'str' ? (typeof d[0] === 'string' ? d[0] : null) : (typeof d[1] === 'number' ? d[1] : null);
      var pref = want === 'str' ? ['label', 'name', 'category', 'key', 'region', 'x'] : ['value', 'y', 'amount', 'total', 'count', 'v'];
      for (var i = 0; i < pref.length; i++) { var v = d[pref[i]]; if (want === 'str' ? (typeof v === 'string' || v instanceof Date) : (typeof v === 'number' && isFinite(v))) return v instanceof Date ? v.toLocaleDateString('en-IN') : v; }
      for (var k in d) { var x = d[k]; if (want === 'str' ? typeof x === 'string' : (typeof x === 'number' && isFinite(x) && !/^(index|id|x0|x1|y0|y1|startAngle|endAngle|padAngle)$/.test(k))) return x; }
      return null;
    },
    labelOf: function (d, j) { var l = this.pick(d, 'str'); return l == null ? String(j + 1) : String(l); },
    valueOf: function (d) { return this.pick(d, 'num'); },
    list: function () {
      if (!window.d3) return [];
      var out = [];
      Array.prototype.forEach.call(D.querySelectorAll('svg'), function (svg) {
        if (svg.closest('.highcharts-container,.js-plotly-plot,[_echarts_instance_],[data-ms-editor]') || (svg.parentNode && svg.parentNode.closest && svg.parentNode.closest('svg'))) return;
        var r = svg.getBoundingClientRect();
        if ((r.width && r.width < 120) || (r.height && r.height < 80)) return;
        if (A.d3.marks(svg).length >= 2) out.push({ el: svg, inst: svg });
      });
      return out;
    },
    kind: function (svg, marks) {
      var m = marks[0], d = m.__data__;
      if (d && d.startAngle != null) return 'pie';
      if (m.tagName === 'circle' || m.tagName === 'ellipse') return 'scatter';
      if (m.tagName === 'rect') { var b0 = m.getBBox(); return b0.width > b0.height * 1.5 && marks.length > 1 && Math.abs(marks[0].getBBox().x - marks[1].getBBox().x) < 1 ? 'hbar' : 'bar'; }
      return 'line';
    },
    titleOf: function (svg) {
      var t = svg.querySelector('title'), a = svg.getAttribute('aria-label');
      if (a) return a;
      if (t && t.parentNode === svg) return t.textContent;
      var big = Array.prototype.filter.call(svg.querySelectorAll('text'), function (x) { return /title/i.test(x.getAttribute('class') || ''); })[0];
      return big ? big.textContent : '';
    },
    info: function (svg) {
      var ms = this.marks(svg), self = this;
      return { type: this.kind(svg, ms), title: this.titleOf(svg), labels: ms.map(function (m, j) { return self.labelOf(m.__data__, j); }).slice(0, 200), series: [''] };
    },
    data: function (svg) {
      var ms = this.marks(svg), self = this;
      var d0 = ms[0] && ms[0].__data__, v0 = d0 && this.valueOf(d0), src = d0 && d0.startAngle != null ? d0.data : d0, nm = 'Value';
      if (src && typeof src === 'object' && !Array.isArray(src)) Object.keys(src).some(function (k) { if (src[k] === v0) { nm = k.charAt(0).toUpperCase() + k.slice(1); return true; } return false; });
      return { labels: ms.map(function (m, j) { return self.labelOf(m.__data__, j); }), series: [{ name: nm, values: ms.map(function (m) { return self.valueOf(m.__data__); }) }] };
    },
    colors: function (svg, labels) {
      var out = {};
      this.marks(svg).forEach(function (m, j) { var f = getComputedStyle(m).fill; if (f && f !== 'none') out[labels[j]] = f; });
      return out;
    },
    snapshot: function () {},
    setTooltip: function (svg, fn) {
      var ms = this.marks(svg), self = this, vals = ms.map(function (m) { return self.valueOf(m.__data__); }), tot = sum(vals);
      ms.forEach(function (m, j) {
        if (!fn) { m.removeAttribute('data-ms-tip'); return; }
        m.setAttribute('data-ms-tip', fn({ label: self.labelOf(m.__data__, j), series: '', value: vals[j], index: j, total: tot }));
      });
    },
    paint: function (svg, colorOf) {
      this.marks(svg).forEach(function (m, j) {
        var c = colorOf(m, j);
        var line = m.tagName === 'path' && getComputedStyle(m).fill === 'none';
        if (c) { if (line) m.style.stroke = c; else m.style.fill = c; } else { m.style.fill = ''; m.style.stroke = ''; }
      });
    },
    setCatColors: function (svg, map) { var self = this; this.paint(svg, function (m, j) { return map[self.labelOf(m.__data__, j)] || m.style.fill || m.style.stroke || null; }); },
    setPalette: function (svg, colors) { var pie = this.kind(svg, this.marks(svg)) === 'pie'; this.paint(svg, function (m, j) { return colors ? colors[pie ? j % colors.length : 0] : null; }); },
    setData: function () {},
    setStyle: function (svg, st) {
      Array.prototype.forEach.call(svg.querySelectorAll('text'), function (t) {
        t.style.fontFamily = st && st.font || ''; t.style.fontSize = st && st.size ? st.size + 'px' : ''; t.style.fill = st && st.color || '';
      });
    },
    onDbl: function (svg, i, cb) {
      var self = this;
      svg.addEventListener('dblclick', function (e) {
        var ms = self.marks(svg), j = ms.indexOf(e.target);
        if (j >= 0) cb({ label: self.labelOf(ms[j].__data__, j), index: j, series: 0 });
      });
    },
    image: function (svg) { return svgImage(svg); },
    clone: function (svg, target) { var c = svg.cloneNode(true); c.style.maxWidth = '100%'; target.appendChild(c); return c; },
    fill: function () {},
    resize: function () {}
  };
  rt.adapters = A;
  // Where a data point is drawn, in px from the chart's own top-left (for annotations). null when unknown.
  A.chartjs.point = function (i, idx, s) {
    var m = i.getDatasetMeta(s || 0), e = m && m.data && m.data[idx]; if (!e) return null;
    var p = /pie|doughnut|polarArea/.test(i.config.type) && e.tooltipPosition ? e.tooltipPosition(true) : (e.getProps ? e.getProps(['x', 'y'], true) : e);
    return p && isFinite(p.x) && isFinite(p.y) ? { x: p.x, y: p.y } : null;
  };
  A.echarts.point = function (i, idx, s) {
    try {
      var se = i.getModel().getSeriesByIndex(s || 0), dt = se.getData(), l = dt.getItemLayout(idx);
      if (!l) { var pts = dt.getLayout && dt.getLayout('points'); if (pts && pts.length > idx * 2 + 1) return { x: pts[idx * 2], y: pts[idx * 2 + 1] }; }
      if (!l) { try { var px = i.convertToPixel({ seriesIndex: s || 0 }, [idx, dt.get(dt.mapDimension('y') || 'y', idx)]); if (px && isFinite(px[0]) && isFinite(px[1])) return { x: px[0], y: px[1] }; } catch (e) {} return null; }
      if (Array.isArray(l)) return { x: l[0], y: l[1] };
      if (l.cx != null) { var a = (l.startAngle + l.endAngle) / 2, r = ((l.r0 || 0) + l.r) / 2; return { x: l.cx + Math.cos(a) * r, y: l.cy + Math.sin(a) * r }; }
      return { x: l.x + l.width / 2, y: Math.min(l.y, l.y + l.height) };
    } catch (e) { return null; }
  };
  A.plotly.point = function (gd, idx, s) {
    try {
      var cd = gd.calcdata && gd.calcdata[s || 0], p = cd && cd[idx], tr = cd && cd[0].trace, fl = gd._fullLayout; if (!p || !tr || tr.type === 'pie') return null;
      var xa = fl[(tr.xaxis || 'x').replace('x', 'xaxis')], ya = fl[(tr.yaxis || 'y').replace('y', 'yaxis')];
      var bar = tr.type === 'bar', h = bar && tr.orientation === 'h';
      var cx = bar ? (h ? p.s + (p.b || 0) : p.p) : p.x, cy = bar ? (h ? p.p : p.s + (p.b || 0)) : p.y;
      var x = xa._offset + xa.c2p(cx), y = ya._offset + ya.c2p(cy);
      return isFinite(x) && isFinite(y) ? { x: x, y: y } : null;
    } catch (e) { return null; }
  };
  A.highcharts.point = function (c, idx, s) {
    var se = c.series && c.series[s || 0], p = se && se.points && se.points[idx];
    if (!p || p.plotX == null || c.inverted || se.type === 'pie') return null;
    return { x: c.plotLeft + p.plotX, y: c.plotTop + p.plotY };
  };
  A.d3.point = function (svg, idx) {
    var m = A.d3.marks(svg)[idx]; if (!m) return null;
    var r = m.getBoundingClientRect(), b = svg.getBoundingClientRect();
    return { x: r.left - b.left + r.width / 2, y: r.top - b.top };
  };

  /* ------------------------------------------------------------ chart registry */
  function keyOf(elm, lib, idx) {
    var nat = elm.closest('[data-ms-chart]');
    if (nat) return nat.getAttribute('data-ms-chart');
    var copy = elm.closest('[data-ms-copyof]');
    if (copy) return copy.getAttribute('data-ms-id');
    return elm.getAttribute('data-ms-id') || (elm.id ? '#' + elm.id : lib + '@' + idx);
  }
  rt.charts = function () {
    var out = [];
    Object.keys(A).forEach(function (lib) {
      A[lib].list().forEach(function (c, idx) {
        out.push({ key: keyOf(c.el, lib, idx), lib: lib, el: c.el, inst: c.inst, a: A[lib] });
      });
    });
    return out;
  };
  rt.chart = function (key) { return rt.charts().filter(function (c) { return c.key === key; })[0] || null; };
  rt.chartOf = function (node) {
    var cs = rt.charts();
    for (var i = 0; i < cs.length; i++) if (cs[i].el === node || cs[i].el.contains(node) || node.contains(cs[i].el)) return cs[i];
    return null;
  };
  rt.chartInfo = function (key) {
    var c = rt.chart(key); if (!c) return null;
    var inf = c.a.info(c.inst); inf.key = key; inf.lib = c.lib; return inf;
  };
  // The numbers a chart was drawn with (before any binding), as labels + series.
  function num(v) { var n = Number(v && typeof v === 'object' ? (v.y != null ? v.y : v.value != null ? (Array.isArray(v.value) ? v.value[v.value.length - 1] : v.value) : v.x) : v); return isNaN(n) ? null : n; }
  rt.chartData = function (key, now) {
    var c = rt.chart(key); if (!c) return null;
    var i = c.inst, labels = [], series = [];
    if (c.a.data) { var dd = c.a.data(i, now); labels = dd.labels; series = dd.series; }
    else if (c.lib === 'chartjs') {
      var O = !now && i.__msOrig;
      labels = (O ? O.labels : i.data.labels) || [];
      series = (O ? O.datasets : i.data.datasets).map(function (d, k) { return { name: d.label || ('Series ' + (k + 1)), values: (d.data || []).map(num) }; });
    } else if (c.lib === 'echarts') {
      var o = (!now && i.__msOrig) || i.getOption(), ax = A.echarts.cat(o), ss = o.series || [];
      labels = ax ? (o[ax][0].data || []).map(function (x) { return x && typeof x === 'object' ? x.value : x; }) : ((ss[0] || {}).data || []).map(function (d) { return d && d.name; });
      series = ss.map(function (x, k) { return { name: x.name || ('Series ' + (k + 1)), values: (x.data || []).map(num) }; });
    } else {
      var tr = (!now && i.__msOrig) || i.data;
      labels = [].slice.call(A.plotly.lv(tr[0] || {}).l);
      series = tr.map(function (t, k) { return { name: t.name || ('Series ' + (k + 1)), values: [].map.call(A.plotly.lv(t).v, num) }; });
    }
    return { labels: labels.map(String), series: series };
  };
  // Rows made from the chart's own numbers (long format when there are several series).
  rt.rowsFromChart = function (key) {
    var d = rt.chartData(key); if (!d || !d.labels.length) return [];
    var rows = [];
    d.labels.forEach(function (l, j) {
      if (d.series.length === 1) rows.push({ Category: l, Value: d.series[0].values[j] });
      else d.series.forEach(function (s) { rows.push({ Category: l, Series: s.name, Value: s.values[j] }); });
    });
    return rows;
  };
  // Find tables in the page whose columns contain this chart's labels: the data behind the chart.
  rt.matchData = function (key) {
    var d = rt.chartData(key); if (!d || !d.labels.length) return [];
    var want = d.labels.slice(0, 60).map(function (x) { return x.trim().toLowerCase(); });
    var cands = Object.keys(rt.state.datasets).map(function (n) { return { name: n, def: rt.state.datasets[n], added: true }; });
    var known = JSON.stringify(rt.state.datasets);
    rt.discoverDatasets().forEach(function (f) {
      if (known.indexOf(JSON.stringify(f.expr || f.scriptId)) >= 0 && !f.sub) return;
      cands.push({ name: (f.expr || f.scriptId + (f.sub ? '.' + f.sub : '')).replace(/^window\./, ''), def: f.expr ? { expr: f.expr, source: 'page' } : { scriptId: f.scriptId, sub: f.sub, source: 'page' }, added: false });
    });
    var out = [];
    cands.forEach(function (cd) {
      var rows = rt.rowsOf(cd.def); if (!rows.length) return;
      var sample = rows.length > 5000 ? rows.slice(0, 5000) : rows, best = null;
      Object.keys(rows[0]).forEach(function (f) {
        var vals = new Set(); sample.forEach(function (r) { if (r[f] != null) vals.add(String(r[f]).trim().toLowerCase()); });
        if (vals.size > 2000 && vals.size === sample.length) return; // an id column
        var hit = want.filter(function (w) { return vals.has(w); }).length;
        if (hit && (!best || hit > best.hit)) best = { field: f, hit: hit };
      });
      if (best && best.hit / want.length >= 0.5) out.push({ name: cd.name, def: cd.def, added: cd.added, field: best.field, score: best.hit / want.length, rows: rows.length });
    });
    return out.sort(function (a, b) { return b.score - a.score || b.rows - a.rows; });
  };
  rt.chartImage = function (key) { var c = rt.chart(key); return c ? c.a.image(c.inst) : Promise.reject(new Error('No such chart')); };
  // The colour each category / series is drawn in now (for the format painter).
  rt.chartColors = function (key) {
    var c = rt.chart(key); if (!c) return {};
    var info = c.a.info(c.inst), out = {}, labels = info.labels || [], series = info.series || [];
    try {
      if (c.a.colors) out = c.a.colors(c.inst, labels);
      else if (c.lib === 'chartjs') {
        var ds = c.inst.data.datasets, radial = /pie|doughnut|polarArea/.test(c.inst.config.type);
        if (ds.length > 1 && !radial) ds.forEach(function (d) { var b = d.borderColor || d.backgroundColor; if (d.label && typeof b === 'string') out[d.label] = b; });
        else { var bg = ds[0] && ds[0].backgroundColor; labels.forEach(function (l, j) { var v = Array.isArray(bg) ? bg[j % bg.length] : bg; if (typeof v === 'string') out[l] = v; }); }
      } else if (c.lib === 'echarts') {
        var o = c.inst.getOption(), pal = o.color || [], ss = o.series || [];
        if (ss.length > 1 && !/pie|funnel/.test(ss[0].type)) ss.forEach(function (sr, k) { out[sr.name] = (sr.itemStyle && sr.itemStyle.color) || pal[k % pal.length]; });
        else (ss[0].data || []).forEach(function (d, j) { var col = d && d.itemStyle && d.itemStyle.color; out[labels[j]] = typeof col === 'string' ? col : (/pie|funnel/.test(ss[0].type) ? pal[j % pal.length] : (ss[0].itemStyle && ss[0].itemStyle.color) || pal[0]); });
      } else {
        var fd = c.inst._fullData || [];
        if (fd.length > 1 && fd[0].type !== 'pie') fd.forEach(function (t) { if (t.name && t.marker && typeof t.marker.color === 'string') out[t.name] = t.marker.color; });
        else { var m = fd[0] && fd[0].marker || {}, arr = fd[0] && fd[0].type === 'pie' ? m.colors : m.color; labels.forEach(function (l, j) { var v = Array.isArray(arr) ? arr[j % arr.length] : arr; if (typeof v === 'string') out[l] = v; }); }
      }
    } catch (e) {}
    Object.keys(out).forEach(function (k) { if (!out[k] || typeof out[k] !== 'string') delete out[k]; });
    return out;
  };
  /* ------------------------------------------------------------ plain-language chart summaries */
  var MONTHS = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|^(q[1-4]|h[12])\b|^(fy|cy)\s?'?\d{2}|^\d{4}([-\/]\d{1,2})?([-\/]\d{1,2})?$|^w(ee)?k\s?\d+/i;
  function words(n) { return n === 1 ? '' : 's'; }
  function sumFmt(st, hint) {
    var f = st && st.axisFormat;
    if (f) return function (v) { return fmtNum(v, f); };
    var money = /[₹$€£¥]|rs\.?\b|inr|usd|eur|gbp|revenue|sales|cost|premium|profit|amount|spend|income|price|budget|turnover|gwp|expense|paid|sum insured|margin\b|loss(?!\s*ratio)|value\b/i.test(hint);
    var pct = /%|percent|ratio|rate|share|margin %/i.test(hint);
    // a chart that names its currency keeps it, whatever the region setting
    var m = /₹|\brs\.?\s|\binr\b|crore|lakh|€|\beur\b|£|\bgbp\b|¥|\bjpy\b|\$|\busd\b/i.exec(hint || ''), code = null;
    if (m) { var t = m[0].toLowerCase(); code = /₹|rs|inr|crore|lakh/.test(t) ? 'INR' : /€|eur/.test(t) ? 'EUR' : /£|gbp/.test(t) ? 'GBP' : /¥|jpy/.test(t) ? 'JPY' : 'USD'; if (code === locale().currency) code = null; }
    return function (v) {
      if (v == null) return '–';
      var a = Math.abs(v);
      if (pct && a <= 100) return fmtNum(v, 'pct');
      if (code) return a >= 1e4 ? shortNum(v, true, code) : nf(v, { style: 'currency', currency: code, maximumFractionDigits: a < 10 ? 2 : 0, minimumFractionDigits: 0 });
      if (a >= 1e4) return fmtNum(v, money ? 'curshort' : 'short');
      return money ? fmtNum(v, 'cur') : fmtNum(v, a < 10 ? 'num' : 'int');
    };
  }
  function pctOf(v, t) { return t ? Math.round(v / t * 100) + '%' : ''; }
  rt.summarize = function (key, name) {
    var c = rt.chart(key); if (!c) return '';
    var d = rt.chartData(key, true), info = c.a.info(c.inst) || {};
    if (!d || !d.labels.length || !d.series.length) return '';
    var type = String(info.type || ''), cs = rt.state.charts[key] || {};
    var f = sumFmt(cs.style, [name, info.title, d.series.map(function (s) { return s.name; }).join(' ')].join(' '));
    var L = d.labels, n = L.length, S = d.series.filter(function (s) { return s.values.some(function (v) { return v != null; }); });
    if (!S.length) return '';
    var lead = name ? name + ': ' : '';
    var trend = /line|area/.test(type) || (n >= 4 && L.filter(function (l) { return MONTHS.test(String(l).trim()); }).length >= n * 0.6);
    var pts = function (s) { return L.map(function (l, j) { return { l: l, v: s.values[j] }; }).filter(function (p) { return p.v != null; }); };
    var tot = function (s) { return s.values.reduce(function (a, v) { return a + (v || 0); }, 0); };
    var out = [];
    if (S.length === 1 || /pie|doughnut|funnel/.test(type)) {
      var s = S[0], p = pts(s), T = tot(s);
      if (!p.length) return '';
      var hi = p.reduce(function (a, b) { return b.v > a.v ? b : a; }), lo = p.reduce(function (a, b) { return b.v < a.v ? b : a; });
      if (trend && p.length >= 2) {
        var a0 = p[0], z = p[p.length - 1], ch = a0.v ? (z.v - a0.v) / Math.abs(a0.v) * 100 : null;
        out.push(lead + (z.v > a0.v ? 'Rose' : z.v < a0.v ? 'Fell' : 'Flat') + ' from ' + f(a0.v) + ' in ' + a0.l + ' to ' + f(z.v) + ' in ' + z.l + (ch != null && z.v !== a0.v ? ' (' + (ch > 0 ? '+' : '') + Math.round(ch) + '%)' : '') + '.');
        out.push('Highest ' + f(hi.v) + ' in ' + hi.l + '; lowest ' + f(lo.v) + ' in ' + lo.l + '.');
      } else if (/pie|doughnut|funnel/.test(type)) {
        var by = p.slice().sort(function (a, b) { return b.v - a.v; });
        out.push(lead + by[0].l + ' is the largest share at ' + f(by[0].v) + ' (' + pctOf(by[0].v, T) + ')' + (by[1] ? ', followed by ' + by[1].l + ' (' + pctOf(by[1].v, T) + ')' : '') + '.');
        if (by.length > 2) out.push('The smallest is ' + by[by.length - 1].l + ' (' + pctOf(by[by.length - 1].v, T) + '). Total ' + f(T) + '.');
      } else {
        var srt = p.slice().sort(function (a, b) { return b.v - a.v; }), top = srt.slice(0, Math.min(3, srt.length - 1));
        out.push(lead + p.length + ' item' + words(p.length) + ', total ' + f(T) + '. ' + hi.l + ' is highest at ' + f(hi.v) + (T > 0 ? ' (' + pctOf(hi.v, T) + ')' : '') + '; ' + lo.l + ' is lowest at ' + f(lo.v) + '.');
        if (p.length >= 5 && T > 0) out.push('The top ' + top.length + ' make up ' + pctOf(top.reduce(function (a, b) { return a + b.v; }, 0), T) + ' of the total.');
      }
    } else {
      var tots = S.map(function (s) { return { s: s.name, t: tot(s) }; }).sort(function (a, b) { return b.t - a.t; });
      if (trend) {
        out.push(lead + S.length + ' series from ' + L[0] + ' to ' + L[n - 1] + '.');
        S.slice(0, 4).forEach(function (s) { var p = pts(s); if (p.length < 2) return; var a0 = p[0].v, z = p[p.length - 1].v; out.push(s.name + ' ' + (z > a0 ? 'rose' : z < a0 ? 'fell' : 'was flat') + ' from ' + f(a0) + ' to ' + f(z) + '.'); });
      } else {
        out.push(lead + S.length + ' series across ' + n + ' categor' + (n === 1 ? 'y' : 'ies') + '. ' + tots.slice(0, 3).map(function (x) { return x.s + ' totals ' + f(x.t); }).join(', ') + '.');
        var best = S[0], bp = pts(best);
        if (bp.length) { var bh = bp.reduce(function (a, b) { return b.v > a.v ? b : a; }); out.push(best.name + ' is highest in ' + bh.l + ' (' + f(bh.v) + ').'); }
      }
    }
    var fl = []; Object.keys(rt.filterValues || {}).forEach(function (ds) { var fv = rt.filterValues[ds]; Object.keys(fv).forEach(function (k) { if (fv[k] !== '' && fv[k] != null) fl.push(k + ' = ' + fv[k]); }); });
    if (fl.length && cs.binding) out.push('Filtered to ' + fl.join(', ') + '.');
    return out.join(' ');
  };
  function renderSummary(c) {
    var cs = rt.state.charts[c.key] || {}, sm = cs.summary, host = c.el.closest('.ms-visual') || (c.el.tagName === 'CANVAS' && c.el.parentNode !== D.body ? c.el.parentNode : c.el);
    var cap = host.parentNode && host.parentNode.querySelector(':scope > .ms-summary[data-for="' + c.key.replace(/"/g, '') + '"]');
    if (!sm) { if (cap) cap.remove(); if (c.el.__msAria) { c.el.removeAttribute('aria-label'); c.el.removeAttribute('role'); c.el.__msAria = false; } return; }
    var text = rt.summarize(c.key, sm.name);
    if (!text) return;
    if (c.el.tagName !== 'CANVAS' || !c.el.getAttribute('aria-label') || c.el.__msAria) { c.el.setAttribute('role', 'img'); c.el.setAttribute('aria-label', text); c.el.__msAria = true; }
    if (sm.show === 'caption') {
      if (!cap) { cap = el('p', { 'class': 'ms-summary', 'data-for': c.key }); host.parentNode.insertBefore(cap, host.nextSibling); }
      if (cap.textContent !== text) cap.textContent = text;
    } else if (cap) cap.remove();
  }
  rt.renderSummary = renderSummary;
  rt.setChart = function (key, patch) {
    var cs = rt.state.charts[key] = rt.state.charts[key] || {};
    Object.keys(patch).forEach(function (k) { if (patch[k] === null) delete cs[k]; else cs[k] = patch[k]; });
    applyChart(rt.chart(key), true);
  };

  /* ------------------------------------------------------------ datasets */
  function resolveExpr(expr) {
    try { return (0, eval)(expr); } catch (e) { return undefined; }
  }
  function isRows(v) {
    return Array.isArray(v) && v.length > 1 && v[0] && typeof v[0] === 'object' && !Array.isArray(v[0]) &&
      Object.getPrototypeOf(v[0]) === Object.prototype && Object.keys(v[0]).length >= 2;
  }
  rt.getRows = function (name) { return rt.rowsOf(rt.state.datasets[name]); };
  rt.rowsOf = function (d) {
    if (!d) return [];
    if (d.rows) return d.rows;
    if (d.expr) { var v = resolveExpr(d.expr); return isRows(v) ? v : []; }
    if (d.scriptId) {
      try { var j = JSON.parse(D.getElementById(d.scriptId).textContent); return d.sub ? j[d.sub] : j; } catch (e) { return []; }
    }
    return [];
  };
  rt.fields = function (name) {
    var rows = rt.getRows(name).slice(0, 200), f = {};
    rows.forEach(function (r) { Object.keys(r).forEach(function (k) {
      f[k] = f[k] || { name: k, num: 0, n: 0 };
      var v = r[k]; if (v === null || v === '' || v === undefined) return;
      f[k].n++; if (typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')) f[k].num++;
    }); });
    return Object.keys(f).map(function (k) { return { name: k, numeric: f[k].n > 0 && f[k].num / f[k].n > 0.9 }; });
  };
  rt.discoverDatasets = function () {
    var found = [], seen = new Set();
    function add(expr, v, kind) {
      if (seen.has(v)) return; seen.add(v);
      found.push({ expr: expr, rows: v.length, fields: Object.keys(v[0]), kind: kind });
    }
    var names = new Set();
    Object.keys(window).forEach(function (k) { names.add(k); });
    Array.prototype.forEach.call(D.querySelectorAll('script:not([src])'), function (s) {
      var re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g, m;
      while ((m = re.exec(s.textContent))) names.add(m[1]);
    });
    names.forEach(function (n) {
      if (/^(__MS|webkit|on|chrome|MS$)/.test(n)) return;
      var v; try { v = resolveExpr(n); } catch (e) { return; }
      if (!v || typeof v !== 'object' || v === window || v.nodeType) return;
      if (isRows(v)) return add(n, v, 'global');
      if (Object.getPrototypeOf(v) === Object.prototype) {
        Object.keys(v).slice(0, 50).forEach(function (k) { if (isRows(v[k])) add(n + '.' + k, v[k], 'global'); });
      }
    });
    Array.prototype.forEach.call(D.querySelectorAll('script[type="application/json"]'), function (s) {
      if (!s.id || s.id === 'ms-state') return;
      try {
        var j = JSON.parse(s.textContent);
        if (isRows(j)) found.push({ scriptId: s.id, rows: j.length, fields: Object.keys(j[0]), kind: 'json' });
        else if (j && typeof j === 'object') Object.keys(j).forEach(function (k) { if (isRows(j[k])) found.push({ scriptId: s.id, sub: k, rows: j[k].length, fields: Object.keys(j[k][0]), kind: 'json' }); });
      } catch (e) {}
    });
    return found;
  };

  /* ------------------------------------------------------------ binding / drill / filters */
  function filteredRows(dsName, extra) {
    var fv = rt.filterValues[dsName] || {};
    var rows = rt.getRows(dsName);
    var conds = Object.keys(fv).filter(function (f) { return fv[f] !== '' && fv[f] != null; }).map(function (f) { return [f, String(fv[f])]; });
    (extra || []).forEach(function (p) { conds.push([p.field, String(p.value)]); });
    if (!conds.length) return rows;
    return rows.filter(function (r) { for (var i = 0; i < conds.length; i++) if (String(r[conds[i][0]]) !== conds[i][1]) return false; return true; });
  }
  rt.filteredRows = filteredRows;

  function groupBy(rows, dim, measure, agg, seriesDim) {
    var groups = new Map(), seriesKeys = new Set();
    rows.forEach(function (r) {
      var k = r[dim]; k = (k === null || k === undefined || k === '') ? '(blank)' : String(k);
      var g = groups.get(k);
      if (!g) { g = { label: k, count: 0, sums: {}, by: {} }; groups.set(k, g); }
      g.count++;
      Object.keys(r).forEach(function (f) { var n = Number(r[f]); if (typeof r[f] !== 'boolean' && r[f] !== '' && !isNaN(n)) g.sums[f] = (g.sums[f] || 0) + n; });
      var sk = seriesDim ? String(r[seriesDim]) : '_';
      seriesKeys.add(sk);
      var b = g.by[sk] = g.by[sk] || { n: 0, s: 0, min: Infinity, max: -Infinity };
      var v = Number(r[measure]);
      b.n++; if (!isNaN(v)) { b.s += v; b.min = Math.min(b.min, v); b.max = Math.max(b.max, v); }
    });
    function val(b) {
      if (!b) return 0;
      switch (agg) { case 'count': return b.n; case 'avg': return b.n ? b.s / b.n : 0; case 'min': return b.min; case 'max': return b.max; default: return b.s; }
    }
    var list = Array.from(groups.values());
    list.forEach(function (g) { g.value = 0; Object.keys(g.by).forEach(function (k) { g.value += val(g.by[k]); }); });
    return { list: list, series: Array.from(seriesKeys), val: val };
  }

  function renderBound(c) {
    var cs = rt.state.charts[c.key], b = cs && cs.binding;
    if (!b || !b.dataset || !b.levels || !b.levels.length) return;
    var path = rt.drill[c.key] = rt.drill[c.key] || [];
    if (path.length >= b.levels.length) path.length = b.levels.length - 1;
    var dim = b.levels[path.length];
    var rows = filteredRows(b.dataset, path);
    var G = groupBy(rows, dim, b.measure, b.agg || 'sum', b.series);
    var list = G.list;
    if (b.sort === 'desc') list.sort(function (x, y) { return y.value - x.value; });
    else if (b.sort === 'asc') list.sort(function (x, y) { return x.value - y.value; });
    else if (b.sort === 'source') { /* keep the order of the rows */ }
    else list.sort(function (x, y) { return x.label < y.label ? -1 : x.label > y.label ? 1 : 0; });
    if (!b.sort) { var oi = orderLabels(list.map(function (g) { return g.label; })); if (oi) list = oi.map(function (j) { return list[j]; }); }
    if (b.top) list = list.slice(0, b.top);
    var labels = list.map(function (g) { return g.label; });
    var series = G.series.map(function (s) {
      return { name: s === '_' ? (b.agg === 'count' || !b.measure ? 'Count' : b.measure + (b.agg && b.agg !== 'sum' ? ' (' + b.agg + ')' : '')) : s, values: list.map(function (g) { var v = G.val(g.by[s]); return isFinite(v) ? Math.round(v * 100) / 100 : 0; }) };
    });
    var gm = {}; list.forEach(function (g) { gm[g.label] = g; });
    rt.groups[c.key] = gm;
    c.a.setData(c.inst, labels, series);
    renderCrumbs(c, b, path);
  }

  function crumbHost(c) {
    var block = c.el.closest('.ms-block');
    if (block) { var h = block.querySelector('.ms-crumbs'); if (h) return h; }
    var unit = c.el.closest('[data-ms-copyof]') || c.el;
    var prev = unit.previousElementSibling;
    if (prev && prev.classList.contains('ms-crumbs') && !prev.hasAttribute('data-ms-own')) return prev;
    var n = el('div', { 'class': 'ms-crumbs' });
    unit.parentNode.insertBefore(n, unit);
    return n;
  }
  function renderCrumbs(c, b, path) {
    var h = crumbHost(c);
    h.innerHTML = '';
    if (b.levels.length < 2 && !path.length) { h.style.display = 'none'; return; }
    h.style.display = '';
    var parts = [{ t: 'All ' + b.levels[0], d: 0 }].concat(path.map(function (p, i) { return { t: p.value, d: i + 1 }; }));
    parts.forEach(function (p, i) {
      if (i) h.appendChild(el('span', { 'class': 'ms-crumb-sep', text: '›' }));
      var last = i === parts.length - 1;
      h.appendChild(el(last ? 'span' : 'button', { 'class': last ? 'ms-crumb-cur' : 'ms-crumb', text: p.t, onclick: last ? null : function () { path.length = p.d; renderBound(c); } }));
    });
    if (path.length < b.levels.length - 1) h.appendChild(el('span', { 'class': 'ms-crumb-hint', text: 'Double-click to drill into ' + b.levels[path.length + 1] }));
  }

  function onChartDbl(c, hit) {
    if (EDITOR && window.__MS_EDIT_MODE) return; // editor uses dblclick for editing
    var cs = rt.state.charts[c.key] || {}, b = cs.binding;
    var mode = (cs.drill && cs.drill.mode) || (b ? (b.levels.length > 1 ? 'levels' : 'details') : 'none');
    if (!b || mode === 'none') return;
    var path = rt.drill[c.key] = rt.drill[c.key] || [];
    var dim = b.levels[path.length];
    if (mode === 'crossfilter') {
      var fv = rt.filterValues[b.dataset] = rt.filterValues[b.dataset] || {};
      fv[dim] = fv[dim] === String(hit.label) ? '' : String(hit.label);
      rt.refresh(); return;
    }
    if (mode === 'levels' && path.length < b.levels.length - 1) {
      path.push({ field: dim, value: String(hit.label) });
      renderBound(c);
      return;
    }
    var rows = filteredRows(b.dataset, path.concat([{ field: dim, value: String(hit.label) }]));
    showDetails((cs.title || 'Details') + ' — ' + hit.label, rows, cs.drill && cs.drill.columns);
  }

  function showDetails(title, rows, cols) {
    var old = D.querySelector('.ms-modal-wrap'); if (old) old.remove();
    cols = (cols && cols.length) ? cols : (rows[0] ? Object.keys(rows[0]) : []);
    var t = '<table class="ms-table"><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.slice(0, 1000).map(function (r) { return '<tr>' + cols.map(function (c) { var v = r[c]; return '<td' + (typeof v === 'number' ? ' class="num"' : '') + '>' + esc(typeof v === 'number' ? fmtNum(v) : v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    var wrap = el('div', { 'class': 'ms-modal-wrap', onclick: function (e) { if (e.target === wrap) wrap.remove(); } }, [
      el('div', { 'class': 'ms-modal' }, [
        el('div', { 'class': 'ms-modal-head' }, [el('strong', { text: title }), el('span', { 'class': 'ms-muted', text: rows.length + ' rows' + (rows.length > 1000 ? ' (first 1000 shown)' : '') }), el('button', { text: '✕', onclick: function () { wrap.remove(); } })]),
        el('div', { 'class': 'ms-modal-body', html: t })
      ])
    ]);
    D.body.appendChild(wrap);
  }
  rt.showDetails = showDetails;

  function renderFilters() {
    var pane = D.getElementById('ms-filter-pane');
    var F = rt.state.filters, L = rt.state.layout;
    if (!F.length) { if (pane) pane.style.display = 'none'; return; }
    if (!pane) {
      pane = el('aside', { id: 'ms-filter-pane', 'data-ms-own': '' });
      var body = D.getElementById('ms-body');
      if (body) body.insertBefore(pane, body.firstChild); else D.body.insertBefore(pane, D.body.firstChild);
    }
    pane.style.display = L.pane.visible ? '' : 'none';
    var top = L.pane.position === 'top', main = D.getElementById('ms-main'), mbody = D.getElementById('ms-body');
    pane.classList.toggle('ms-pane-top', top);
    if (main && top && pane.parentNode !== main) main.insertBefore(pane, main.firstChild);
    if (main && !top && pane.parentNode !== mbody) mbody.insertBefore(pane, main);
    pane.innerHTML = '';
    pane.appendChild(el('div', { 'class': 'ms-pane-head' }, [el('strong', { text: L.pane.title || 'Filters' }),
      el('button', { 'class': 'ms-pane-reset', text: 'Reset', onclick: function () { rt.filterValues = {}; rt.refresh(); } })]));
    F.forEach(function (f) {
      var fv = rt.filterValues[f.dataset] = rt.filterValues[f.dataset] || {};
      var others = {}; Object.keys(fv).forEach(function (k) { if (k !== f.field) others[k] = fv[k]; });
      var saved = rt.filterValues[f.dataset]; rt.filterValues[f.dataset] = others;
      var rows = filteredRows(f.dataset); rt.filterValues[f.dataset] = saved;
      var vals = Array.from(new Set(rows.map(function (r) { return r[f.field]; }).filter(function (v) { return v !== undefined && v !== null && v !== ''; }).map(String)));
      vals.sort(function (a, b) { var x = Number(a), y = Number(b); return (!isNaN(x) && !isNaN(y)) ? x - y : a.localeCompare(b); });
      var sel = el('select', { 'data-field': f.field, onchange: function () { fv[f.field] = sel.value; rt.drill = {}; rt.refresh(); } },
        [el('option', { value: '', text: 'All' })].concat(vals.map(function (v) { var o = el('option', { value: v, text: v }); if (fv[f.field] === v) o.selected = true; return o; })));
      pane.appendChild(el('label', { 'class': 'ms-filter' }, [el('span', { text: f.label || f.field }), sel]));
    });
  }

  /* ------------------------------------------------------------ apply */
  function applyChart(c, force) {
    if (!c) return;
    var cs = rt.state.charts[c.key];
    var T = rt.state.theme;
    var pal = T && T.chartsFollowTheme !== false && T.palette && T.palette.length ? T.palette : null;
    var reset = false;
    try {
      if (cs && cs.binding) renderBound(c);
      else if (c.inst.__msBound) { reset = true; c.a.setData(c.inst, null); var h = c.el.closest('.ms-block'); h = h && h.querySelector('.ms-crumbs'); if (h) h.innerHTML = ''; }
      c.inst.__msBound = !!(cs && cs.binding);
      var reordered = !c.inst.__msBound && applyOrder(c);
      if (reordered) reset = true;
      if (!pal && c.inst.__msNative) pal = NATIVE_PAL;
      var cat = catMapFor(c), ck = (pal ? String(pal) : '') + '|' + (cat ? JSON.stringify(cat) : '') + '|' + (c.inst.__msOrderKey || '');
      if (force || ck !== (c.inst.__msColKey || '|') || (c.inst.__msBound && (c.lib === 'chartjs' || cat))) {
        if (pal || c.inst.__msPal || cat || c.inst.__msCat) c.a.setPalette(c.inst, pal);
        c.inst.__msPal = pal ? String(pal) : null;
        if (cat) c.a.setCatColors(c.inst, cat);
        c.inst.__msCat = !!cat; c.inst.__msColKey = ck;
        syncLegend(c, !!(pal || cat));
      }
      var tpl = cs && cs.tooltip;
      if (tpl || c.inst.__msTip) {
        c.a.setTooltip(c.inst, tpl ? function (ctx) {
          var g = (rt.groups[c.key] || {})[ctx.label];
          if (g) { Object.keys(g.sums).forEach(function (k) { if (ctx[k] === undefined) ctx[k] = g.sums[k]; }); ctx.count = g.count; }
          if (ctx.pct === undefined && ctx.total) ctx.pct = ctx.value / ctx.total * 100;
          return fmt(tpl, ctx);
        } : null);
        if (!tpl && c.inst.__msTip) reset = true;
        c.inst.__msTip = !!tpl;
      }
      var st = cs && cs.style, sk = st ? JSON.stringify(st) : '';
      if (c.a.setStyle && (force || sk !== (c.inst.__msStyleKey || '') || (sk && reset && c.lib === 'echarts'))) {
        if (sk || c.inst.__msStyleKey) c.a.setStyle(c.inst, st || null);
        c.inst.__msStyleKey = sk;
      }
      if (!c.el.__msDbl) { c.el.__msDbl = true; c.a.onDbl(c.el, c.inst, function (hit) { onChartDbl(rt.chart(c.key) || c, hit); }); }
      if ((c.el.closest('.ms-block:not(.ms-inline) .ms-visual') || c.el.closest('[data-ms-fill]')) && !c.inst.__msFill) { c.inst.__msFill = true; c.a.fill(c.inst); }
      renderSummary(c);
    } catch (e) { console.warn('[Mothership] chart apply failed', c.key, e); }
  }



  /* ------------------------------------------------------------ shared category order + colours */
  function low(x) { return String(x == null ? '' : x).trim().toLowerCase(); }
  function lookColor(name) {
    var m = rt.state.layout.colors, k = low(name);
    if (!m || !k) return null;
    if (m[name]) return m[name];
    for (var key in m) if (low(key) === k) return m[key];
    return null;
  }
  rt.lookColor = lookColor;
  // The labels in the shared order (if an order covers at least two of them), the rest after in their own order.
  function orderLabels(labels) {
    var orders = rt.state.layout.orders || [], L = labels.map(low);
    for (var i = 0; i < orders.length; i++) {
      var o = orders[i].map(low), hits = L.filter(function (x) { return o.indexOf(x) >= 0; });
      if (hits.length < 2) continue;
      var idx = labels.map(function (_, j) { return j; });
      idx.sort(function (a, b) {
        var pa = o.indexOf(L[a]), pb = o.indexOf(L[b]);
        if (pa < 0 && pb < 0) return a - b;
        if (pa < 0) return 1; if (pb < 0) return -1;
        return pa - pb;
      });
      return idx;
    }
    return null;
  }
  rt.orderLabels = orderLabels;
  function applyOrder(c) {
    var d = rt.chartData(c.key);
    var idx = d && d.labels.length > 1 ? orderLabels(d.labels) : null;
    var same = !idx || idx.every(function (v, j) { return v === j; });
    var key = same ? '' : JSON.stringify(idx);
    if (key === (c.inst.__msOrderKey || '')) return false;
    if (same) c.a.setData(c.inst, null);
    else c.a.setData(c.inst, idx.map(function (j) { return d.labels[j]; }), d.series.map(function (sr) { return { name: sr.name, values: idx.map(function (j) { return sr.values[j]; }) }; }));
    c.inst.__msOrderKey = key;
    return true;
  }
  function catMapFor(c) {
    var m = rt.state.layout.colors; if (!m || !Object.keys(m).length) return null;
    var info = c.a.info(c.inst), out = {}, n = 0;
    (info.labels || []).concat(info.series || []).forEach(function (l) { var col = lookColor(l); if (col) { out[l] = col; n++; } });
    return n ? out : null;
  }

  /* ------------------------------------------------------------ the page's own HTML legends follow the chart colours */
  // A legend item is a small element whose text is a category or series name, with a little coloured swatch in it or next to it.
  function swatchOf(p, skip) {
    var ks = p.querySelectorAll('*');
    for (var i = 0; i < ks.length && i < 6; i++) {
      var k = ks[i]; if (k === skip || k.contains(skip) || (k.textContent || '').trim()) continue;
      var r = k.getBoundingClientRect(), st = getComputedStyle(k), w = r.width || parseFloat(st.width), hh = r.height || parseFloat(st.height);
      if (!(w > 0) || w > 30 || hh > 30) continue;
      var bg = st.backgroundColor;
      if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return k;
    }
    return null;
  }
  rt.legendItems = function (c) {
    if (!c || !c.inst) return [];
    var info = c.a.info(c.inst), names = (info.labels || []).concat(info.series || []).map(String), L = names.map(low);
    if (!names.length) return [];
    var host = c.el.parentElement;
    for (var up = 0; up < 4 && host && host !== D.body; up++, host = host.parentElement) {
      var found = [], seen = [];
      Array.prototype.forEach.call(host.querySelectorAll('li,span,div,label,td,p'), function (n) {
        if (c.el.contains(n) || n.childElementCount > 3 || n.closest('[data-ms-editor],.ms-crumbs,.ms-summary')) return;
        var i = L.indexOf(low(n.textContent)); if (i < 0) return;
        var sw = swatchOf(n) || (n.parentElement && n.parentElement !== host && n.parentElement.childElementCount <= 3 ? swatchOf(n.parentElement, n) : null);
        if (!sw || seen.indexOf(sw) >= 0) return;
        seen.push(sw); found.push({ name: names[i], item: sw.parentElement.contains(n) ? sw.parentElement : n, sw: sw });
      });
      // another chart in the same box means the legend could belong to either: stop
      if (up > 0 && rt.charts().some(function (o) { return o.el !== c.el && host.contains(o.el); })) return [];
      if (found.length >= Math.min(2, names.length)) return found;
    }
    return [];
  };
  function syncLegend(c, on) {
    var items = rt.legendItems(c); if (!items.length) return;
    var cols = on ? rt.chartColors(c.key) : {};
    items.forEach(function (it) {
      var sw = it.sw, col = cols[it.name];
      if (on && col) {
        if (!sw.hasAttribute('data-ms-legend-orig')) sw.setAttribute('data-ms-legend-orig', sw.style.background || '');
        sw.style.background = col;
      } else if (sw.hasAttribute('data-ms-legend-orig')) { sw.style.background = sw.getAttribute('data-ms-legend-orig'); sw.removeAttribute('data-ms-legend-orig'); }
    });
  }
  // the chart and category an HTML legend item belongs to
  rt.legendOf = function (node) {
    var cs = rt.charts();
    for (var i = 0; i < cs.length; i++) {
      var its = rt.legendItems(cs[i]);
      for (var j = 0; j < its.length; j++) if (its[j].sw === node || its[j].item === node || its[j].item.contains(node)) return { key: cs[i].key, name: its[j].name };
    }
    return null;
  };

  /* ------------------------------------------------------------ charts built in Mothership (Chart.js + a dataset) */
  var NATIVE_PAL = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
  function nativeConfig(spec) {
    var t = spec.type || 'bar', type = { hbar: 'bar', stacked: 'bar', area: 'line' }[t] || t;
    var o = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: /pie|doughnut/.test(t) || !!spec.legend, position: 'bottom' } } };
    if (t === 'hbar') o.indexAxis = 'y';
    if (t === 'stacked') o.scales = { x: { stacked: true }, y: { stacked: true } };
    return { type: type, data: { labels: [], datasets: [{ label: '', data: [], fill: t === 'area', tension: t === 'line' || t === 'area' ? 0.3 : 0 }] }, options: o };
  }
  function renderNative() {
    if (!window.Chart) return;
    Array.prototype.forEach.call(D.querySelectorAll('[data-ms-chart]'), function (h) {
      var cv = h.querySelector('canvas');
      if (cv && window.Chart.getChart && window.Chart.getChart(cv)) return;
      var cs = rt.state.charts[h.getAttribute('data-ms-chart')];
      if (!cs || !cs.native) return;
      h.innerHTML = '';
      cv = el('canvas'); h.appendChild(cv);
      try { var i = new window.Chart(cv, nativeConfig(cs.native)); i.__msNative = true; } catch (e) { console.warn('[Mothership] chart failed', e); }
    });
  }
  rt.nativeConfig = nativeConfig;

  /* ------------------------------------------------------------ table colour rules (conditional formatting) */
  function allTables() { return Array.prototype.slice.call(D.querySelectorAll('table')).filter(function (t) { return !t.closest('[data-ms-editor],#ms-cmt-layer,.ms-modal-wrap,.ms-details'); }); }
  rt.tables = allTables;
  rt.tableKey = function (t) { return t.getAttribute('data-ms-id') || 'table@' + allTables().indexOf(t); };
  rt.tableByKey = function (k) { if (/^table@\d+$/.test(k)) return allTables()[+k.slice(6)] || null; return D.querySelector('table[data-ms-id="' + k + '"]'); };
  function headRow(t) { if (t.tHead && t.tHead.rows[0]) return t.tHead.rows[0]; var r0 = t.rows[0]; return r0 && r0.querySelector('th') && !r0.querySelector('td') ? r0 : null; }
  rt.tableColumns = function (t) { var hr = headRow(t) || t.rows[0]; return hr ? Array.prototype.map.call(hr.cells, function (c) { return (c.textContent || '').trim(); }) : []; };
  function bodyRows(t) { var hr = headRow(t); return Array.prototype.filter.call(t.rows, function (r) { return r !== hr && !(t.tHead && t.tHead.contains(r)) && !(t.tFoot && t.tFoot.contains(r)); }); }
  rt.cellNumber = function (txt) {
    var s = String(txt == null ? '' : txt).replace(/[\s,$₹€£%]/g, '').replace(/^\((.*)\)$/, '-$1'), m = /^([-+]?\d*\.?\d+(?:e[-+]?\d+)?)(cr|crore|l|lakh|lac|k|m|mn|b|bn)?$/i.exec(s);
    if (!m) return null;
    var u = (m[2] || '').toLowerCase();
    return parseFloat(m[1]) * ({ cr: 1e7, crore: 1e7, l: 1e5, lakh: 1e5, lac: 1e5, k: 1e3, m: 1e6, mn: 1e6, b: 1e9, bn: 1e9 }[u] || 1);
  };
  function hexRgb(x) { var m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(x || '').trim()); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255]; }
  function mixHex(a, b, f) { var x = hexRgb(a), y = hexRgb(b); return 'rgb(' + x.map(function (v, i) { return Math.round(v + (y[i] - v) * f); }).join(',') + ')'; }
  var RAG = { green: { background: '#c6efce', color: '#006100' }, amber: { background: '#ffeb9c', color: '#9c5700' }, red: { background: '#ffc7ce', color: '#9c0006' } };
  function test(op, v, txt, a, b) {
    var n = rt.cellNumber(a), m = rt.cellNumber(b);
    switch (op) {
      case 'gt': return v !== null && n !== null && v > n;
      case 'ge': return v !== null && n !== null && v >= n;
      case 'lt': return v !== null && n !== null && v < n;
      case 'le': return v !== null && n !== null && v <= n;
      case 'between': return v !== null && n !== null && m !== null && v >= Math.min(n, m) && v <= Math.max(n, m);
      case 'eq': return n !== null && v !== null ? v === n : txt.toLowerCase() === String(a || '').trim().toLowerCase();
      case 'ne': return n !== null && v !== null ? v !== n : txt.toLowerCase() !== String(a || '').trim().toLowerCase();
      case 'contains': return txt.toLowerCase().indexOf(String(a || '').toLowerCase()) >= 0;
      case 'blank': return !txt;
    }
    return false;
  }
  // Each rule colours the cells of one column: {col, type: rule|scale|bars|rag|top|bottom, op, value, value2, color, text, bold, low, mid, high, higher, n}
  rt.ruleStyle = function (rule, v, txt, ctx) {
    switch (rule.type) {
      case 'scale': {
        if (v === null || ctx.hi === ctx.lo && ctx.nums.length < 2) return null;
        var f = ctx.hi === ctx.lo ? 0.5 : (v - ctx.lo) / (ctx.hi - ctx.lo); if (rule.higher === false) f = 1 - f;
        var lo = rule.low || '#f8696b', mid = rule.mid || '#ffeb84', hi = rule.high || '#63be7b';
        return { background: rule.mid === '' ? mixHex(lo, hi, f) : (f < 0.5 ? mixHex(lo, mid, f * 2) : mixHex(mid, hi, (f - 0.5) * 2)) };
      }
      case 'bars': {
        if (v === null) return null;
        var top = Math.max(Math.abs(ctx.hi), Math.abs(ctx.lo)) || 1, p = Math.round(Math.abs(v) / top * 100), c = v < 0 ? (rule.neg || '#f8a5a5') : (rule.color || '#9ec5fe');
        return { backgroundImage: 'linear-gradient(90deg,' + c + ' ' + p + '%,transparent ' + p + '%)' };
      }
      case 'rag': {
        if (v === null) return null;
        var g = rt.cellNumber(rule.value), a = rt.cellNumber(rule.value2); if (g === null) return null; if (a === null) a = g;
        var up = rule.higher !== false;
        return RAG[up ? (v >= g ? 'green' : v >= a ? 'amber' : 'red') : (v <= g ? 'green' : v <= a ? 'amber' : 'red')];
      }
      case 'top': case 'bottom': {
        if (v === null) return null;
        var srt = ctx.nums.slice().sort(function (x, y) { return rule.type === 'top' ? y - x : x - y; }), cut = srt[Math.min(srt.length, Math.max(1, +rule.n || 3)) - 1];
        return (rule.type === 'top' ? v >= cut : v <= cut) ? { background: rule.color || '#c6efce', color: rule.text || '', fontWeight: rule.bold ? '700' : '' } : null;
      }
      default:
        return test(rule.op || 'gt', v, txt, rule.value, rule.value2) ? { background: rule.color || '#ffeb9c', color: rule.text || '', fontWeight: rule.bold ? '700' : '' } : null;
    }
  };
  function applyTableRules() {
    // undo the last pass, so a rule that was changed or removed leaves no colour behind
    Array.prototype.forEach.call(D.querySelectorAll('[data-ms-cf]'), function (c) { var o = c.getAttribute('data-ms-cf'); if (o) c.setAttribute('style', o); else c.removeAttribute('style'); c.removeAttribute('data-ms-cf'); });
    var R = rt.state.tableRules || {};
    Object.keys(R).forEach(function (k) {
      var t = rt.tableByKey(k); if (!t) return;
      var cols = rt.tableColumns(t), rows = bodyRows(t);
      (R[k] || []).forEach(function (rule) {
        var ci = typeof rule.col === 'number' ? rule.col : cols.indexOf(rule.col); if (ci < 0) return;
        var cells = rows.map(function (r) { return r.cells[ci]; }).filter(Boolean);
        var txts = cells.map(function (c) { return (c.textContent || '').trim(); }), vals = txts.map(rt.cellNumber), nums = vals.filter(function (v) { return v !== null; });
        var ctx = { nums: nums, lo: nums.length ? Math.min.apply(null, nums) : 0, hi: nums.length ? Math.max.apply(null, nums) : 0 };
        cells.forEach(function (c, i) {
          var st = rt.ruleStyle(rule, vals[i], txts[i], ctx); if (!st) return;
          if (!c.hasAttribute('data-ms-cf')) c.setAttribute('data-ms-cf', c.getAttribute('style') || '');
          Object.keys(st).forEach(function (p) { if (st[p]) c.style[p] = st[p]; });
        });
      });
    });
  }
  rt.applyTableRules = applyTableRules;

  // The dashboard's own tab buttons work from the keyboard (Tab to reach, Enter or Space to open).
  function tabKeys() {
    var g = rt.pageTabs && rt.pageTabs(); if (!g) return;
    g.tabs.forEach(function (t) {
      var b = t.btn; if (b.__msKeys || /^(BUTTON|A|INPUT)$/.test(b.tagName)) return;
      b.__msKeys = true;
      if (!b.hasAttribute('tabindex')) b.setAttribute('tabindex', '0');
      if (!b.hasAttribute('role')) b.setAttribute('role', 'tab');
      b.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } });
    });
  }

  /* ------------------------------------------------------------ KPI cards (follow the filter pane) */
  function aggregate(rows, measure, agg) {
    if (agg === 'count') return rows.length;
    if (agg === 'distinct') { var seen = {}; rows.forEach(function (r) { seen[r[measure]] = 1; }); return Object.keys(seen).length; }
    var vals = rows.map(function (r) { return Number(r[measure]); }).filter(function (v) { return !isNaN(v); });
    if (!vals.length) return null;
    if (agg === 'avg') return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
    if (agg === 'min') return Math.min.apply(null, vals);
    if (agg === 'max') return Math.max.apply(null, vals);
    return vals.reduce(function (a, b) { return a + b; }, 0);
  }
  rt.aggregate = aggregate;
  function renderKpis() {
    Array.prototype.forEach.call(D.querySelectorAll('[data-ms-kpi]'), function (h) {
      var k = rt.state.kpis[h.getAttribute('data-ms-kpi')], v = h.querySelector('.ms-kpi-value');
      if (!k || !v || !k.dataset || !rt.state.datasets[k.dataset]) return;
      var val = aggregate(filteredRows(k.dataset), k.measure, k.agg || 'sum');
      var txt = val == null ? '–' : fmtNum(val, k.format || (k.agg === 'count' || k.agg === 'distinct' ? 'int' : ''));
      if (v.textContent !== txt) v.textContent = txt;
      var st = kpiStatus(val, k.status);
      if (st) { if (h.getAttribute('data-ms-status') !== st) h.setAttribute('data-ms-status', st); } else if (h.hasAttribute('data-ms-status')) h.removeAttribute('data-ms-status');
    });
  }
  // red / amber / green: s = {better: 'high'|'low', good: n, bad: n}
  function kpiStatus(val, s) {
    if (!s || val == null) return '';
    var g = s.good === '' || s.good == null ? NaN : Number(s.good), b = s.bad === '' || s.bad == null ? NaN : Number(s.bad);
    if (isNaN(g) && isNaN(b)) return '';
    var hi = s.better !== 'low';
    if (!isNaN(g) && (hi ? val >= g : val <= g)) return 'good';
    if (!isNaN(b) && (hi ? val <= b : val >= b)) return 'bad';
    return isNaN(g) ? 'good' : isNaN(b) ? 'bad' : 'warn';
  }
  rt.kpiStatus = kpiStatus;

  /* ------------------------------------------------------------ hover pop-ups on any element ([data-ms-tip]) */
  var tipEl = null;
  function tipCss() {
    var t = rt.state.layout.tip || {};
    return '.ms-hovertip{position:fixed;z-index:99998;pointer-events:none;max-width:' + (t.width || 280) + 'px;padding:8px 10px;white-space:pre-line;line-height:1.4;box-shadow:0 6px 20px rgba(0,0,0,.18);' +
      'background:' + (t.bg || '#111827') + ';color:' + (t.color || '#f9fafb') + ';border:1px solid ' + (t.border || 'transparent') + ';border-radius:' + (t.radius != null ? t.radius : 6) + 'px;font-size:' + (t.size || 13) + 'px;' + (t.font ? 'font-family:' + t.font + ';' : '') + '}' +
      '[data-ms-tip]{cursor:help}';
  }
  function bindTips() {
    if (D.__msTips) return; D.__msTips = true;
    D.addEventListener('mouseover', function (e) {
      var t = e.target && e.target.closest && e.target.closest('[data-ms-tip]');
      if (!t || (EDITOR && window.__MS_EDIT_MODE)) { if (tipEl) tipEl.style.display = 'none'; return; }
      if (!tipEl || !tipEl.isConnected) { tipEl = el('div', { 'class': 'ms-hovertip', 'data-ms-editor': '' }); D.body.appendChild(tipEl); }
      tipEl.textContent = t.getAttribute('data-ms-tip');
      tipEl.style.display = 'block';
    });
    D.addEventListener('mousemove', function (e) {
      if (!tipEl || tipEl.style.display === 'none') return;
      var w = tipEl.offsetWidth, hh = tipEl.offsetHeight, x = e.clientX + 14, y = e.clientY + 16;
      if (x + w > innerWidth - 8) x = e.clientX - w - 10;
      if (y + hh > innerHeight - 8) y = e.clientY - hh - 10;
      tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    });
  }

  function cloneCopies() {
    Array.prototype.forEach.call(D.querySelectorAll('[data-ms-copyof]'), function (t) {
      var all = rt.charts();
      if (all.some(function (c) { return c.el === t || t.contains(c.el); })) return;
      var src = all.filter(function (c) { return c.key === t.getAttribute('data-ms-copyof'); })[0];
      if (!src) return;
      if (t.offsetParent === null) { t.__msPending = true; return; } // clone when visible (needs a size)
      try { src.a.clone(src.inst, t); } catch (e) { console.warn('[Mothership] clone failed', e); }
    });
  }

  function applyText() {
    var o = rt.state.textOverrides;
    Object.keys(o).forEach(function (k) {
      var n = D.querySelector('[data-ms-id="' + k + '"]');
      if (n && n.innerHTML !== o[k]) n.innerHTML = o[k];
    });
  }

  /* ------------------------------------------------------------ theme + base css */
  var BASE_CSS = [
    ':root{--ms-primary:#2563eb;--ms-surface:#ffffff;--ms-border:#e2e8f0;--ms-muted:#64748b;--ms-ribbon-bg:#0f172a;--ms-ribbon-fg:#e2e8f0;--ms-ribbon-active:#ffffff;--ms-pane-bg:#f8fafc}',
    '#ms-app{display:flex;flex-direction:column;min-height:100vh}',
    '#ms-ribbon{display:flex;align-items:stretch;gap:2px;padding:0 12px;height:var(--ms-ribbon-h,46px);background:var(--ms-ribbon-bg);color:var(--ms-ribbon-fg);position:sticky;top:0;z-index:40;overflow-x:auto;flex:none}',
    '#ms-ribbon .ms-brand{display:flex;align-items:center;font-weight:700;margin-right:16px;white-space:nowrap;gap:8px}',
    '#ms-ribbon .ms-brand img{max-height:calc(var(--ms-ribbon-h,46px) - 14px)}',
    '#ms-ribbon .ms-tabbtn{all:unset;cursor:pointer;padding:0 16px;display:flex;align-items:center;white-space:nowrap;border-bottom:3px solid transparent;opacity:.8;font:inherit;font-size:14px}',
    '#ms-ribbon .ms-tabbtn:hover{opacity:1}',
    '#ms-ribbon .ms-tabbtn.ms-active{opacity:1;color:var(--ms-ribbon-active);border-bottom-color:var(--ms-primary);font-weight:600}',
    '#ms-ribbon .ms-tabbtn.ms-drop{background:rgba(255,255,255,.15)}',
    '#ms-app.ms-rib-left{flex-direction:row}',
    '#ms-app.ms-rib-left #ms-ribbon{flex-direction:column;height:auto;width:var(--ms-ribbon-h,190px);padding:12px 0;position:sticky;top:0;align-self:flex-start;min-height:100vh}',
    '#ms-app.ms-rib-left #ms-ribbon .ms-tabbtn{padding:10px 16px;border-bottom:0;border-left:3px solid transparent}',
    '#ms-app.ms-rib-left #ms-ribbon .ms-tabbtn.ms-active{border-left-color:var(--ms-primary)}',
    '#ms-app.ms-rib-left #ms-ribbon .ms-brand{margin:0 16px 12px}',
    '#ms-body{display:flex;flex:1;min-height:0;min-width:0}',
    '#ms-filter-pane{flex:none;width:var(--ms-pane-w,230px);background:var(--ms-pane-bg);border-right:1px solid var(--ms-border);padding:14px;box-sizing:border-box;font-size:13px;position:sticky;top:var(--ms-ribbon-h,46px);align-self:flex-start;max-height:calc(100vh - var(--ms-ribbon-h,46px));overflow:auto;min-height:calc(100vh - var(--ms-ribbon-h,46px))}',
    '#ms-app.ms-rib-left #ms-filter-pane{top:0;max-height:100vh;min-height:100vh}',
    '#ms-filter-pane.ms-pane-top{position:static;min-height:0;max-height:none}',
    '#ms-filter-pane.ms-pane-top{width:auto;display:flex;flex-wrap:wrap;gap:4px 16px;align-items:flex-end;border-right:0;border-bottom:1px solid var(--ms-border)}',
    '#ms-filter-pane.ms-pane-top .ms-pane-head{width:100%;margin-bottom:4px}',
    '#ms-filter-pane.ms-pane-top .ms-filter{margin-bottom:0}',
    'body>#ms-filter-pane{width:auto;display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;border-right:0;border-bottom:1px solid var(--ms-border);position:static;min-height:0;max-height:none}',
    'body>#ms-filter-pane .ms-pane-head{width:100%}',
    '.ms-pane-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}',
    '.ms-pane-reset{font-size:12px;background:none;border:1px solid var(--ms-border);border-radius:6px;padding:2px 8px;cursor:pointer}',
    '.ms-filter{display:flex;flex-direction:column;gap:4px;margin-bottom:12px;min-width:150px}',
    '.ms-filter span{color:var(--ms-muted);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.03em}',
    '.ms-filter select{padding:6px 8px;border:1px solid var(--ms-border);border-radius:6px;background:var(--ms-surface);font:inherit}',
    '#ms-main{flex:1;min-width:0}',
    '.ms-tab{display:none}',
    '.ms-tab.ms-active{display:block}',
    '.ms-tab[data-ms-kind="grid"],.ms-tab[data-ms-kind="content"]{padding:20px}',
    '.ms-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px;align-items:start}',
    '.ms-block{grid-column:span 6;background:var(--ms-surface);border:1px solid var(--ms-border);border-radius:10px;padding:14px 16px;position:relative;display:flex;flex-direction:column;min-width:0;box-sizing:border-box}',
    '.ms-block.ms-inline{display:block;margin:0;border:0;padding:0;background:none;border-radius:0}',
    '.ms-head{margin-bottom:8px}',
    '.ms-title{font-size:16px;font-weight:600;margin:0;line-height:1.3;font-family:var(--ms-font-heading,inherit)}',
    '.ms-sub{margin:2px 0 0;color:var(--ms-muted);font-size:13px;line-height:1.4}',
    '.ms-inf{margin:8px 0 0;padding:8px 10px;border-left:3px solid var(--ms-primary);background:color-mix(in srgb,var(--ms-primary) 7%,transparent);font-size:13px;border-radius:0 6px 6px 0}',
    '.ms-inf:empty,.ms-sub:empty{display:none}',
    '.ms-visual{position:relative;height:var(--ms-h,300px);min-height:80px}',
    '.ms-inline .ms-visual{height:auto}',
    '.ms-block:not(.ms-inline)>.ms-visual>*{width:100%!important;height:100%!important;max-width:100%;box-sizing:border-box}',
    '.ms-inline>.ms-visual>*{max-width:100%}',
    '.ms-content-block .ms-visual{height:auto;overflow:auto}',
    '.ms-block.ms-content-block>.ms-visual>*{height:auto!important}',
    '.ms-doc{max-width:900px;margin:0 auto;line-height:1.65;font-size:15px}',
    '.ms-doc img{max-width:100%;height:auto}',
    '.ms-doc table,.ms-table{border-collapse:collapse;width:100%;font-size:13px;margin:12px 0}',
    '.ms-doc th,.ms-doc td,.ms-table th,.ms-table td{border:1px solid var(--ms-border);padding:6px 8px;text-align:left;vertical-align:top}',
    '.ms-doc th,.ms-table th{background:var(--ms-pane-bg);position:sticky;top:0}',
    '.ms-table td.num{text-align:right;font-variant-numeric:tabular-nums}',
    '.ms-doc details{border:1px solid var(--ms-border);border-radius:8px;padding:10px 14px;margin:8px 0;background:var(--ms-surface)}',
    '.ms-doc summary{cursor:pointer;font-weight:600}',
    '.ms-doc .ms-slide{border:1px solid var(--ms-border);border-radius:10px;padding:16px 20px;margin:16px 0;background:var(--ms-surface)}',
    '.ms-doc .ms-page{display:block;margin:12px auto;box-shadow:0 1px 4px rgba(0,0,0,.15);max-width:100%}',
    '.ms-crumbs{display:flex;flex-wrap:wrap;gap:4px;align-items:center;font-size:12px;margin:0 0 6px}',
    '.ms-crumbs:empty{display:none}',
    '.ms-crumb{all:unset;cursor:pointer;color:var(--ms-primary);text-decoration:underline}',
    '.ms-crumb-cur{font-weight:600}',
    '.ms-crumb-sep{color:var(--ms-muted)}',
    '.ms-crumb-hint{color:var(--ms-muted);margin-left:8px;font-style:italic}',
    '.ms-section{margin:24px 0;padding:0}',
    '.ms-section-head{margin:0 0 12px}',
    '.ms-section-head h2{margin:0;font-size:20px;font-family:var(--ms-font-heading,inherit)}',
    '.ms-section-head p{margin:4px 0 0;color:var(--ms-muted)}',
    '.ms-section>.ms-grid{min-height:40px}',
    '.ms-banner{padding:28px 24px;border-radius:12px;margin:0 0 20px;background:linear-gradient(135deg,var(--ms-primary),color-mix(in srgb,var(--ms-primary) 55%,#000));color:#fff}',
    '.ms-banner h1{margin:0;font-size:26px;font-family:var(--ms-font-heading,inherit)}',
    '.ms-banner p{margin:6px 0 0;opacity:.9}',
    '.ms-page-footer{padding:14px 24px;border-top:1px solid var(--ms-border);color:var(--ms-muted);font-size:12px;display:flex;flex-wrap:wrap;gap:6px 24px;justify-content:space-between;background:var(--ms-surface)}',
    '.ms-page-footer p{margin:0}',
    '.ms-cols{display:grid;grid-template-columns:repeat(var(--cols,2),minmax(0,1fr));gap:16px;margin:16px 0}',
    '.ms-col{padding:4px 0}',
    '.ms-col h3{margin:0 0 6px;font-size:16px}',
    '.ms-col p{margin:0;line-height:1.55}',
    '.ms-callout{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:8px;margin:12px 0;background:color-mix(in srgb,var(--ms-primary) 8%,transparent);border-left:4px solid var(--ms-primary)}',
    '.ms-callout-icon{font-size:18px;line-height:1.3}',
    '.ms-callout p{margin:0}',
    '.ms-divider{border:0;border-top:1px solid var(--ms-border);margin:20px 0}',
    '.ms-spacer{height:32px}',
    '.ms-btn{display:inline-block;padding:8px 16px;border-radius:8px;background:var(--ms-primary);color:#fff!important;text-decoration:none;font-weight:600}',
    '.ms-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:12px 0 16px}',
    '.ms-kpis.ms-in-grid{grid-column:1/-1}',
    '.ms-section.ms-in-grid,.ms-cols.ms-in-grid,.ms-callout.ms-in-grid,.ms-divider.ms-in-grid,.ms-banner.ms-in-grid,.ms-spacer.ms-in-grid,.ms-heading.ms-in-grid,.ms-para.ms-in-grid{grid-column:1/-1}',
    '.ms-kpi{background:var(--ms-surface);border:1px solid var(--ms-border);border-radius:10px;padding:14px 16px;border-top:3px solid var(--ms-primary)}',
    '.ms-kpi-label{font-size:12px;color:var(--ms-muted);text-transform:uppercase;letter-spacing:.04em;font-weight:600}',
    '.ms-kpi-value{font-size:26px;font-weight:700;margin:4px 0 2px;font-variant-numeric:tabular-nums}',
    '.ms-kpi-note{font-size:12px;color:var(--ms-muted)}',
    '.ms-summary{font-size:12.5px;line-height:1.45;color:var(--ms-muted);margin:6px 2px 0}',
    '#ms-badge{position:fixed;right:10px;bottom:10px;z-index:9990;background:rgba(255,255,255,.94);color:#334155;border:1px solid #e2e8f0;border-radius:8px;padding:5px 9px;font:12px/1.4 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.08);cursor:pointer;max-width:360px}',
    '#ms-badge .ms-badge-log{display:none;margin-top:6px;border-top:1px solid #e2e8f0;padding-top:6px;max-height:220px;overflow:auto}#ms-badge.open .ms-badge-log{display:block}#ms-badge .ms-badge-log>div{margin-bottom:6px}',
    '#ms-errbar{position:fixed;left:50%;transform:translateX(-50%);top:10px;z-index:9991;background:#fffbeb;color:#78350f;border:1px solid #fcd34d;border-radius:8px;padding:8px 12px;font:13px/1.4 system-ui,sans-serif;display:flex;gap:10px;align-items:center;max-width:90vw;box-shadow:0 4px 14px rgba(0,0,0,.1)}#ms-errbar button{border:0;background:none;cursor:pointer;color:inherit;font-size:14px}',
    '@media print{#ms-badge,#ms-errbar{display:none}}',
    '.ms-kpi[data-ms-status=good]{border-top-color:#1a7f37}.ms-kpi[data-ms-status=warn]{border-top-color:#d4a106}.ms-kpi[data-ms-status=bad]{border-top-color:#c62828}',
    '.ms-kpi[data-ms-status] .ms-kpi-value::before{content:"";display:inline-block;width:.42em;height:.42em;border-radius:50%;margin-right:.3em;vertical-align:.18em}',
    '.ms-kpi[data-ms-status=good] .ms-kpi-value::before{background:#1a7f37}.ms-kpi[data-ms-status=warn] .ms-kpi-value::before{background:#d4a106}.ms-kpi[data-ms-status=bad] .ms-kpi-value::before{background:#c62828}',
    '.ms-kpi[data-ms-status=bad] .ms-kpi-value{color:#c62828}',
    '[data-ms-chart]{position:relative;width:100%;height:100%}',
    '.ms-modal-wrap{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px}',
    '.ms-modal{background:var(--ms-surface);color:inherit;border-radius:12px;max-width:min(1100px,96vw);max-height:86vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3);min-width:320px}',
    '.ms-modal-head{display:flex;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--ms-border)}',
    '.ms-modal-head button{margin-left:auto;border:0;background:none;font-size:16px;cursor:pointer}',
    '.ms-modal-body{overflow:auto;padding:0 16px 16px}',
    '.ms-muted{color:var(--ms-muted);font-size:12px}',
    '@media print{#ms-ribbon,#ms-filter-pane{display:none!important}.ms-tab{display:block!important;page-break-after:always}}',
    '@media (max-width:720px){.ms-block{grid-column:1/-1!important}#ms-body{flex-direction:column}#ms-filter-pane{width:auto;border-right:0;border-bottom:1px solid var(--ms-border)}}'
  ].join('\n');

  function themeCss() {
    var T = rt.state.theme, L = rt.state.layout, out = [];
    out.push(':root{--ms-ribbon-h:' + L.ribbon.height + 'px;--ms-pane-w:' + L.pane.width + 'px}');
    if (!T) return out.join('\n');
    var c = T.colors || {}, f = T.fonts || {}, v = [];
    var map = { primary: '--ms-primary', surface: '--ms-surface', border: '--ms-border', muted: '--ms-muted', background: '--ms-bg', text: '--ms-text',
      ribbonBg: '--ms-ribbon-bg', ribbonText: '--ms-ribbon-fg', ribbonActive: '--ms-ribbon-active', paneBg: '--ms-pane-bg', secondary: '--ms-secondary', accent: '--ms-accent' };
    Object.keys(map).forEach(function (k) { if (c[k]) v.push(map[k] + ':' + c[k]); });
    if (!c.ribbonBg && c.primary) v.push('--ms-ribbon-bg:' + c.primary);
    if (!c.ribbonText && c.primary) v.push('--ms-ribbon-fg:rgba(255,255,255,.85)');
    if (f.heading) v.push('--ms-font-heading:' + f.heading);
    if (f.body) v.push('--ms-font-body:' + f.body);
    (T.palette || []).forEach(function (p, i) { v.push('--ms-c' + (i + 1) + ':' + p); });
    out.push(':root{' + v.join(';') + '}');
    (T.fontFiles || []).forEach(function (ff) { out.push('@font-face{font-family:"' + ff.family + '";src:url(' + ff.data + ');font-weight:' + (ff.weight || 'normal') + ';font-style:' + (ff.style || 'normal') + '}'); });
    if (T.applyToPage !== false) {
      var b = [];
      if (f.body) b.push('font-family:' + f.body);
      if (c.text) b.push('color:' + c.text);
      if (c.background) b.push('background:' + c.background);
      if (b.length) out.push('body{' + b.join(';') + '}');
      if (f.heading) out.push('h1,h2,h3,h4,h5,h6,.ms-title{font-family:' + f.heading + '}');
      if (c.primary) out.push('a{color:' + c.primary + '}');
    }
    if (T.force) {
      if (f.body) out.push('body *:not(svg):not(svg *):not(code):not(pre){font-family:' + f.body + '!important}');
      if (f.heading) out.push('h1,h2,h3,h4,h5,h6,.ms-title{font-family:' + f.heading + '!important}');
      if (c.text) out.push('body *:not(svg *):not(#ms-ribbon *):not(.ms-tabbtn){color:' + c.text + '}');
    }
    if (T.forceFonts && (f.body || f.heading)) {
      var keep = ':not(svg):not(svg *):not(code):not(pre):not(i):not([class*="icon"]):not([class*="fa-"]):not(.material-icons):not(.material-symbols-outlined)';
      if (f.body) out.push('body *' + keep + '{font-family:' + f.body + '!important}');
      if (f.heading) out.push('h1,h2,h3,h4,h5,h6,.ms-title{font-family:' + f.heading + '!important}');
    }
    if (T.map && T.map.length) out.push(mapCss(T.map));
    if (T.css) out.push(T.css);
    return out.join('\n');
  }

  /* ------------------------------------------------------------ brand colour mapping: the page's own colours → brand colours */
  var MAP_PROPS = ['color', 'background-color', 'background-image', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'outline-color', 'fill', 'stroke', 'box-shadow', 'text-decoration-color', 'caret-color', 'column-rule-color'];
  function colHex(v) {
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v).trim());
    if (m) { var x = m[1].toLowerCase(); return '#' + (x.length === 3 ? x.replace(/./g, '$&$&') : x); }
    m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+)(%)?)?\s*\)$/i.exec(String(v).trim());
    if (!m) return null;
    return '#' + [m[1], m[2], m[3]].map(function (n) { return ('0' + Math.round(+n).toString(16)).slice(-2); }).join('');
  }
  function colMap(list) { var m = {}; (list || []).forEach(function (x) { if (x && x.on !== false && x.from && x.to) m[String(x.from).toLowerCase()] = x.to; }); return m; }
  function swapCols(text, m) {
    return String(text).replace(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\)/ig, function (x) {
      var hx = colHex(x), to = hx && m[hx]; if (!to) return x;
      var a = /^rgba?\(\s*[\d.]+[ ,]+[\d.]+[ ,]+[\d.]+\s*[,/]\s*([\d.]+%?)\s*\)$/i.exec(x), al = a ? a[1] : null;
      if (al && al !== '1') { var t = colHex(to); if (t) return 'rgba(' + parseInt(t.slice(1, 3), 16) + ',' + parseInt(t.slice(3, 5), 16) + ',' + parseInt(t.slice(5, 7), 16) + ',' + (/%$/.test(al) ? parseFloat(al) / 100 : al) + ')'; }
      return to;
    });
  }
  rt.colHex = colHex;
  function ownSheet(sh) { var n = sh.ownerNode; return !!(n && ((n.id && /^ms-/.test(n.id)) || (n.hasAttribute && (n.hasAttribute('data-ms-editor') || n.hasAttribute('data-ms-own'))))); }
  // every style rule in the page's own style sheets: fn(rule, media)
  rt.eachRule = function (fn) {
    function walk(rs, media) {
      for (var i = 0; i < rs.length; i++) {
        var r = rs[i];
        if (r.type === 1) fn(r, media);
        else if (r.type === 4 && r.cssRules) walk(r.cssRules, r.media.mediaText);
        else if (r.type === 12 && r.cssRules) walk(r.cssRules, media);
      }
    }
    Array.prototype.forEach.call(D.styleSheets, function (sh) { if (ownSheet(sh)) return; var rs; try { rs = sh.cssRules; } catch (e) { return; } if (rs) walk(rs, ''); });
  };
  var mapCache = { k: '', css: '' };
  function mapCss(list) {
    var m = colMap(list), key = JSON.stringify(m) + '|' + D.styleSheets.length;
    if (key === mapCache.k) return mapCache.css;
    var out = [];
    if (Object.keys(m).length) rt.eachRule(function (r, media) {
      var decl = [];
      for (var j = 0; j < r.style.length; j++) {
        var p = r.style[j]; if (MAP_PROPS.indexOf(p) < 0 && p.indexOf('--') !== 0) continue;
        var v = r.style.getPropertyValue(p), nv = swapCols(v, m);
        if (nv !== v) decl.push(p + ':' + nv + (r.style.getPropertyPriority(p) ? ' !important' : ''));
      }
      if (decl.length) out.push((media ? '@media ' + media + '{' : '') + r.selectorText + '{' + decl.join(';') + '}' + (media ? '}' : ''));
    });
    mapCache = { k: key, css: out.join('\n') };
    return mapCache.css;
  }
  // colours written straight on elements (style="…"): swapped in place, and put back when the mapping goes
  function mapInline() {
    var T = rt.state.theme, m = colMap(T && T.map), on = Object.keys(m).length > 0;
    if (!on && !D.querySelector('[data-ms-colmap]')) return;
    Array.prototype.forEach.call(D.querySelectorAll(on ? '[style],[data-ms-colmap]' : '[data-ms-colmap]'), function (e) {
      if (e.closest('[data-ms-editor],#ms-ribbon,#ms-filter-pane') || /^(CANVAS)$/.test(e.tagName)) return;
      var saved = {}; try { saved = JSON.parse(e.getAttribute('data-ms-colmap') || '{}'); } catch (x) {}
      Object.keys(saved).forEach(function (p) { if (e.style.getPropertyValue(p) === saved[p].to) e.style.setProperty(p, saved[p].from); });
      var now = {}, props = [];
      if (on) for (var j = 0; j < e.style.length; j++) props.push(e.style[j]);
      props.forEach(function (p) {
        if (MAP_PROPS.indexOf(p) < 0 && p.indexOf('--') !== 0) return;
        var v = e.style.getPropertyValue(p), nv = swapCols(v, m);
        if (nv !== v) { e.style.setProperty(p, nv); now[p] = { from: v, to: e.style.getPropertyValue(p) }; }
      });
      if (Object.keys(now).length) e.setAttribute('data-ms-colmap', JSON.stringify(now)); else if (e.hasAttribute('data-ms-colmap')) e.removeAttribute('data-ms-colmap');
    });
  }
  function ensureStyle(id, css) {
    var s = D.getElementById(id);
    if (!s) { s = el('style', { id: id }); (D.head || D.documentElement).appendChild(s); }
    if (s.textContent !== css) s.textContent = css;
  }

  /* ------------------------------------------------------------ layout (tabs + ribbon) */
  rt.layoutEnabled = function () { return !!D.getElementById('ms-app'); };
  rt.tabs = function () {
    return Array.prototype.map.call(D.querySelectorAll('#ms-main > section.ms-tab'), function (s) {
      return { id: s.getAttribute('data-ms-tab'), title: s.getAttribute('data-ms-title') || 'Untitled', kind: s.getAttribute('data-ms-kind') || 'original', hidden: s.hasAttribute('data-ms-hidden'), notes: s.getAttribute('data-ms-notes') || '', el: s };
    });
  };
  function own(e) { e.setAttribute('data-ms-own', ''); return e; }
  function uid(p) { return (p || 'x') + Math.random().toString(36).slice(2, 9); }
  rt.uid = uid;

  rt.enableLayout = function (firstTitle) {
    if (rt.layoutEnabled()) return false;
    var app = own(el('div', { id: 'ms-app' }));
    var rib = own(el('nav', { id: 'ms-ribbon' }));
    var body = own(el('div', { id: 'ms-body' }));
    var main = own(el('main', { id: 'ms-main' }));
    var first = own(el('section', { 'class': 'ms-tab', 'data-ms-tab': uid('t'), 'data-ms-title': firstTitle || 'Dashboard', 'data-ms-kind': 'original' }));
    Array.prototype.slice.call(D.body.childNodes).forEach(function (n) {
      if (n.nodeType === 1 && (n.id === 'ms-state' || n.id === 'ms-runtime' || n.hasAttribute('data-ms-editor') || n.classList.contains('ms-modal-wrap') || n.classList.contains('ms-page-footer'))) return;
      if (n.nodeType === 1 && n.id === 'ms-filter-pane') { body.appendChild(n); return; }
      first.appendChild(n);
    });
    main.appendChild(first);
    body.appendChild(main);
    app.appendChild(rib); app.appendChild(body);
    D.body.insertBefore(app, D.body.firstChild);
    var pane = D.getElementById('ms-filter-pane'); if (pane) body.insertBefore(pane, main);
    rt.refresh();
    return true;
  };
  rt.disableLayout = function () {
    var app = D.getElementById('ms-app'); if (!app) return false;
    var frag = D.createDocumentFragment();
    rt.tabs().forEach(function (t) { while (t.el.firstChild) frag.appendChild(t.el.firstChild); });
    var pane = D.getElementById('ms-filter-pane');
    D.body.insertBefore(frag, app);
    if (pane) D.body.insertBefore(pane, D.body.firstChild);
    app.remove();
    rt.refresh();
    return true;
  };
  rt.addTab = function (title, kind, html, at) {
    var main = D.getElementById('ms-main'); if (!main) { rt.enableLayout(); main = D.getElementById('ms-main'); }
    kind = kind || 'grid';
    var s = own(el('section', { 'class': 'ms-tab', 'data-ms-tab': uid('t'), 'data-ms-title': title || 'New tab', 'data-ms-kind': kind }));
    if (kind === 'grid') s.appendChild(own(el('div', { 'class': 'ms-grid' })));
    if (kind === 'content') { var d = own(el('div', { 'class': 'ms-doc' })); if (html) { d.innerHTML = html; tagTree(d); } s.appendChild(d); }
    var tabs = rt.tabs();
    if (at != null && tabs[at]) main.insertBefore(s, tabs[at].el); else main.appendChild(s);
    rt.renderRibbon();
    return s.getAttribute('data-ms-tab');
  };
  function tagTree(root) { Array.prototype.forEach.call(root.querySelectorAll('*'), function (n) { if (!n.hasAttribute('data-ms-id')) n.setAttribute('data-ms-own', ''); }); }
  rt.tagTree = tagTree;
  rt.tabEl = function (id) { return D.querySelector('#ms-main > section.ms-tab[data-ms-tab="' + id + '"]'); };
  rt.activeTab = null;
  rt.showTab = function (id) {
    var tabs = rt.tabs(); if (!tabs.length) return;
    var t = tabs.filter(function (x) { return x.id === id; })[0] || tabs.filter(function (x) { return !x.hidden; })[0] || tabs[0];
    tabs.forEach(function (x) { x.el.classList.toggle('ms-active', x === t); });
    rt.activeTab = t.id;
    Array.prototype.forEach.call(D.querySelectorAll('#ms-ribbon .ms-tabbtn'), function (b) { b.classList.toggle('ms-active', b.getAttribute('data-ms-tabbtn') === t.id); });
    if (!EDITOR) { try { history.replaceState(null, '', '#tab=' + encodeURIComponent(t.title)); } catch (e) {} }
    requestAnimationFrame(function () {
      cloneCopies();
      rt.charts().forEach(function (c) { if (t.el.contains(c.el)) { c.a.resize(c.inst); applyChart(c); } });
    });
    try { window.dispatchEvent(new CustomEvent('ms:tab', { detail: { id: t.id, title: t.title } })); } catch (e) {}
  };
  rt.step = function (dir) {
    if (!rt.layoutEnabled()) {
      // no tab ribbon: step through the page's own tabs
      var g = rt.pageTabs(); if (!g) return -1;
      var cur = 0; g.tabs.forEach(function (t, k) { if (t.active) cur = k; });
      var nx = Math.max(0, Math.min(g.tabs.length - 1, cur + dir));
      rt.showPageTab(nx); return nx;
    }
    var vis = rt.tabs().filter(function (x) { return !x.hidden; });
    var i = vis.findIndex(function (x) { return x.id === rt.activeTab; });
    var n = vis[Math.max(0, Math.min(vis.length - 1, i + dir))];
    if (n) rt.showTab(n.id);
    return n ? vis.indexOf(n) : -1;
  };
  rt.renderRibbon = function () {
    var rib = D.getElementById('ms-ribbon'); if (!rib) return;
    var L = rt.state.layout, app = D.getElementById('ms-app');
    app.classList.toggle('ms-rib-left', L.ribbon.position === 'left');
    rib.innerHTML = '';
    if (L.ribbon.brand || (rt.state.theme && rt.state.theme.logo)) {
      var br = el('div', { 'class': 'ms-brand' });
      if (rt.state.theme && rt.state.theme.logo) br.appendChild(el('img', { src: rt.state.theme.logo, alt: '' }));
      if (L.ribbon.brand) br.appendChild(el('span', { text: L.ribbon.brand }));
      rib.appendChild(br);
    }
    rt.tabs().forEach(function (t) {
      if (t.hidden && !EDITOR) return;
      var b = el('button', { 'class': 'ms-tabbtn' + (t.id === rt.activeTab ? ' ms-active' : ''), 'data-ms-tabbtn': t.id, type: 'button', text: t.title + (t.hidden ? ' (hidden)' : '') });
      if (t.hidden) b.style.opacity = '.45';
      b.addEventListener('click', function () { rt.showTab(t.id); });
      rib.appendChild(b);
    });
  };

  /* ------------------------------------------------------------ the page's own tabs */
  /* Many dashboards already have tabs (buttons that show one panel at a time). Mothership finds
     them so it can switch, add, rename and reorder them. Tabs the page's script doesn't know about
     (added in Mothership) are switched by the same rules the page uses, learnt from its own tabs. */
  var PT_BTN = '[role="tab"],[data-tab],[data-target],[data-tab-target],[data-bs-target],[aria-controls],.tab,.tab-btn,.tab-button,.tablinks,.tablink,.nav-link,.tabs>button,.tabs>a,.tab-bar>*,.tabbar>*,.tab-nav>*,.tabs-nav>*';
  var PT_PANEL = '[role="tabpanel"],.tab-panel,.tab-pane,.tabcontent,.tab-content>*,.tabpanel,.tab-page,.tab-section';
  var PT_ATTRS = ['aria-controls', 'data-tab', 'data-target', 'data-tab-target', 'data-bs-target', 'href'];
  var PT_ACTIVE = ['active', 'is-active', 'selected', 'current', 'show', 'open', 'on'];
  function ptSkip(n) { return n.closest('#ms-ribbon,#ms-filter-pane,[data-ms-editor],.ms-modal-wrap,#ms-cmt-layer'); }
  function cssEsc(v) { try { return CSS.escape(v); } catch (e) { return String(v).replace(/["\\]/g, '\\$&'); } }
  function ptTarget(b) {
    var tries = [];
    PT_ATTRS.forEach(function (a) {
      var v = b.getAttribute(a); if (!v) return;
      if (a === 'href') { if (v.indexOf('#') < 0) return; v = v.slice(v.indexOf('#')); }
      var raw = v.replace(/^#/, ''); if (!raw) return;
      tries.push({ id: raw, via: a, raw: v });
      ['tab-' + raw, raw + '-tab', raw + '-panel', 'panel-' + raw, raw + 'Tab', raw + 'Panel'].forEach(function (x) { tries.push({ id: x, via: a, raw: v }); });
      tries.push({ sel: '[data-panel="' + cssEsc(raw) + '"],[data-tab-panel="' + cssEsc(raw) + '"],[data-tab-content="' + cssEsc(raw) + '"],[data-tabpanel="' + cssEsc(raw) + '"]', via: a, raw: v });
    });
    var oc = b.getAttribute('onclick') || '';
    (oc.match(/(['"])([^'"]+)\1/g) || []).forEach(function (q) { tries.push({ id: q.slice(1, -1), via: 'onclick', raw: q.slice(1, -1) }); });
    for (var i = 0; i < tries.length; i++) {
      var t = tries[i], e = null;
      try { e = t.id ? D.getElementById(t.id) : D.querySelector(t.sel); } catch (x) {}
      if (e && e !== b && !e.contains(b) && !b.contains(e) && !ptSkip(e) && !/^(SCRIPT|STYLE|TEMPLATE|HEAD)$/.test(e.tagName)) return { el: e, via: t.via, raw: t.raw };
    }
    return null;
  }
  function ptShown(e) { if (!e || e.hidden) return false; var cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden'; }
  function ptTitle(b) { return (b.textContent || b.getAttribute('aria-label') || b.title || '').replace(/\s+/g, ' ').trim(); }
  function ptGroup(btns) {
    var tabs = btns.map(function (b) { var t = ptTarget(b); return { btn: b, panel: t && t.el, via: t ? t.via : '', raw: t ? t.raw : '' }; });
    var panels = tabs.map(function (t) { return t.panel; });
    var distinct = panels.every(function (p, i) { return p && panels.indexOf(p) === i; });
    if (!distinct) {
      // no links between buttons and panels: match them by order when the counts agree
      var hosts = [], lists = [];
      Array.prototype.forEach.call(D.querySelectorAll(PT_PANEL), function (p) {
        if (ptSkip(p) || btns.some(function (b) { return p.contains(b) || b.contains(p); })) return;
        var k = hosts.indexOf(p.parentNode); if (k < 0) { hosts.push(p.parentNode); lists.push([]); k = hosts.length - 1; }
        lists[k].push(p);
      });
      var list = lists.filter(function (l) { return l.length === btns.length; })[0];
      if (!list) return null;
      tabs.forEach(function (t, i) { t.panel = list[i]; t.via = 'order'; t.raw = ''; });
    }
    tabs.forEach(function (t, i) { t.index = i; t.title = ptTitle(t.btn) || ('Tab ' + (i + 1)); t.active = ptShown(t.panel); });
    var g = { tabs: tabs, btnActive: '', panelActive: '' };
    // learn how the page marks the active tab
    var on = tabs.filter(function (t) { return t.active; })[0];
    if (on) {
      var only = function (list, el) { return Array.prototype.filter.call(el.classList, function (c) { return list.every(function (x) { return x === el || !x.classList.contains(c); }); }); };
      var bc = only(tabs.map(function (t) { return t.btn; }), on.btn), pc = only(tabs.map(function (t) { return t.panel; }), on.panel);
      g.btnActive = bc.filter(function (c) { return PT_ACTIVE.indexOf(c) >= 0; })[0] || bc.filter(function (c) { return !/^ms-/.test(c); })[0] || '';
      g.panelActive = pc.filter(function (c) { return PT_ACTIVE.indexOf(c) >= 0; })[0] || pc.filter(function (c) { return !/^ms-/.test(c); })[0] || '';
    }
    return g;
  }
  var ptCache = null;
  rt.pageTabs = function (fresh) {
    if (ptCache && !fresh && ptCache.tabs.every(function (t) { return t.btn.isConnected && t.panel.isConnected; }) && ptCache.n === D.querySelectorAll(PT_BTN).length) {
      ptCache.tabs.forEach(function (t) { t.active = ptShown(t.panel); t.title = ptTitle(t.btn) || t.title; });
      return ptCache;
    }
    var all = Array.prototype.filter.call(D.querySelectorAll(PT_BTN), function (b) { return !ptSkip(b) && !/^(SECTION|MAIN|BODY|NAV|HEADER|UL|OL|FORM|TABLE)$/.test(b.tagName); });
    var parents = [];
    all.forEach(function (b) { if (parents.indexOf(b.parentNode) < 0) parents.push(b.parentNode); });
    var best = null;
    parents.forEach(function (p) {
      var btns = all.filter(function (b) { return b.parentNode === p; });
      if (btns.length < 2) return;
      var g = ptGroup(btns);
      if (g && (!best || g.tabs.length > best.tabs.length)) best = g;
    });
    if (best) best.n = D.querySelectorAll(PT_BTN).length;
    ptCache = best;
    return best;
  };
  rt.pageTabOf = function (node) {
    var g = rt.pageTabs(); if (!g || !node) return null;
    return g.tabs.filter(function (t) { return t.btn === node || t.btn.contains(node) || t.panel === node || t.panel.contains(node); })[0] || null;
  };
  function ptApply(g, t) {
    g.tabs.forEach(function (x) {
      var on = x === t;
      if (g.btnActive) x.btn.classList.toggle(g.btnActive, on);
      if (x.btn.hasAttribute('aria-selected')) x.btn.setAttribute('aria-selected', on ? 'true' : 'false');
      if (g.panelActive) x.panel.classList.toggle(g.panelActive, on);
      if (x.panel.hasAttribute('hidden') || !on && x.panel.hidden) x.panel.hidden = !on;
      if (!on) { if (ptShown(x.panel)) x.panel.style.display = 'none'; }
      else { if (x.panel.style.display === 'none') x.panel.style.display = ''; if (!ptShown(x.panel)) x.panel.style.display = 'block'; }
    });
  }
  rt.ptClicking = false;
  function ptAfter(t) {
    requestAnimationFrame(function () {
      cloneCopies();
      rt.charts().forEach(function (c) { if (t.panel.contains(c.el)) { c.a.resize(c.inst); applyChart(c); } });
    });
    try { window.dispatchEvent(new CustomEvent('ms:pagetab', { detail: { index: t.index, title: t.title } })); } catch (e) {}
  }
  rt.showPageTab = function (i) {
    var g = rt.pageTabs(); if (!g) return false;
    var t = typeof i === 'number' ? g.tabs[i] : g.tabs.filter(function (x) { return x.title === i; })[0];
    if (!t) return false;
    rt.ptClicking = true;
    try { t.btn.click(); } catch (e) {}
    rt.ptClicking = false;
    // the page's own script handles its own tabs; tabs it doesn't know get the same treatment
    if (!ptShown(t.panel) || g.tabs.some(function (x) { return x !== t && ptShown(x.panel) && !x.panel.contains(t.panel); })) ptApply(g, t);
    ptAfter(t);
    return true;
  };
  D.addEventListener('click', function (e) {
    if (rt.ptClicking || (EDITOR && window.__MS_EDIT_MODE)) return;
    var g = rt.pageTabs(), t = g && e.target.closest && g.tabs.filter(function (x) { return x.btn === e.target || x.btn.contains(e.target); })[0];
    if (!t) return;
    setTimeout(function () {
      if (!ptShown(t.panel) || g.tabs.some(function (x) { return x !== t && ptShown(x.panel) && !x.panel.contains(t.panel); })) ptApply(g, t);
      ptAfter(t);
    }, 0);
  });

  /* ------------------------------------------------------------ for client work: firm footer, stage stamp, watermark, chart sources,
     annotations pinned to data points and the storyline player. All drawn from the state, so exports keep them. */
  var CONSULT_CSS = [
    '#ms-firm-foot{display:flex;align-items:center;gap:8px 14px;flex-wrap:wrap;padding:10px 24px;margin-top:16px;border-top:1px solid var(--ms-border,#e2e8f0);font:11.5px/1.45 var(--ms-font-body,system-ui,sans-serif);color:var(--ms-muted,#64748b);background:var(--ms-surface,#fff)}',
    '#ms-firm-foot img{height:22px;width:auto}#ms-firm-foot .ms-ff-name{font-weight:600;color:var(--ms-text,#0f172a)}#ms-firm-foot .ms-ff-text{flex:1;min-width:200px}#ms-firm-foot .ms-ff-conf{font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#b91c1c}',
    '#ms-stamp{position:fixed;top:18px;right:-46px;z-index:9989;transform:rotate(45deg);width:190px;text-align:center;padding:4px 0;font:700 11px/1.4 system-ui,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2);pointer-events:none}',
    '#ms-stamp[data-stage=draft]{background:#64748b}#ms-stamp[data-stage=review]{background:#d97706}',
    '#ms-watermark{position:fixed;inset:0;z-index:9988;pointer-events:none;background-repeat:repeat}',
    '.ms-source{font-size:11.5px;line-height:1.4;color:var(--ms-muted,#64748b);margin:6px 2px 0}',
    '.ms-footnotes{font-size:12px;line-height:1.5;color:var(--ms-muted,#64748b);border-top:1px solid var(--ms-border,#e2e8f0);margin:18px 0 8px;padding-top:8px}.ms-footnotes.ms-in-grid{grid-column:1/-1}.ms-footnotes h4{margin:0 0 4px;font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--ms-text,#0f172a)}.ms-footnotes ol{margin:0;padding-left:20px}',
    '.ms-annot-layer{position:absolute;pointer-events:none;z-index:6}.ms-annot-svg{position:absolute;left:0;top:0;overflow:visible}',
    '.ms-annot{position:absolute;pointer-events:auto;width:max-content;max-width:220px;padding:4px 8px;border:1.5px solid;border-radius:6px;background:rgba(255,255,255,.96);color:#0f172a;font:600 12px/1.35 var(--ms-font-body,system-ui,sans-serif);box-shadow:0 2px 8px rgba(0,0,0,.12);white-space:normal;cursor:default}',
    '.ms-annot-arrow{background:transparent;border-color:transparent!important;box-shadow:none;padding:0 2px;font-weight:700}',
    '.ms-annot-sowhat{background:#fffbeb;font-weight:500;max-width:260px;border-left-width:5px}.ms-annot-sowhat b{font-weight:700}',
    '#ms-story-spot{position:fixed;z-index:99990;border-radius:10px;box-shadow:0 0 0 200vmax rgba(15,23,42,.58);outline:3px solid var(--ms-primary,#4f46e5);outline-offset:4px;pointer-events:none;transition:all .35s ease}',
    '#ms-story{position:fixed;left:50%;transform:translateX(-50%);z-index:99992;width:min(760px,92vw);background:#fff;color:#0f172a;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.35);padding:14px 18px 12px;font:14px/1.5 var(--ms-font-body,system-ui,sans-serif)}',
    '#ms-story.top{top:16px}#ms-story.bottom{bottom:16px}',
    '#ms-story .ms-st-n{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ms-primary,#4f46e5)}',
    '#ms-story h2{margin:2px 0 4px;font:700 20px/1.3 var(--ms-font-heading,inherit)}#ms-story p{margin:0;color:#334155}',
    '#ms-story .ms-st-foot{display:flex;align-items:center;gap:8px;margin-top:10px}#ms-story .ms-st-dots{flex:1;display:flex;gap:4px}#ms-story .ms-st-dots i{width:18px;height:4px;border-radius:2px;background:#cbd5e1}#ms-story .ms-st-dots i.on{background:var(--ms-primary,#4f46e5)}',
    '#ms-story button{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:5px 12px;font:inherit;cursor:pointer;color:inherit}#ms-story button.pri{background:var(--ms-primary,#4f46e5);border-color:transparent;color:#fff}#ms-story button:disabled{opacity:.4;cursor:default}',
    '#ms-story-btn{position:fixed;left:12px;bottom:12px;z-index:9990;border:0;border-radius:999px;padding:8px 14px;background:var(--ms-primary,#4f46e5);color:#fff;font:600 13px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.2);cursor:pointer}',
    '.ms-shape-svg{position:absolute;left:0;top:0;overflow:visible}',
    '.ms-shape-txt{position:absolute;box-sizing:border-box;font:600 12.5px/1.35 var(--ms-font-body,system-ui,sans-serif);color:#0f172a;white-space:pre-wrap;overflow-wrap:anywhere}',
    '.ms-shape-txt.ms-sh-callout{background:#fff;border:1.5px solid;border-radius:6px;padding:5px 9px;box-shadow:0 2px 8px rgba(0,0,0,.12);width:max-content;max-width:240px}',
    '.ms-shape-txt.ms-sh-pill{width:max-content;max-width:200px;padding:3px 10px;border-radius:999px;color:#fff;font-weight:700;font-size:12px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.18)}',
    '.ms-shape-txt.ms-sh-text{padding:2px 4px}',
    'body.ms-edit-mode .ms-shape-hit{pointer-events:stroke;cursor:move}body.ms-edit-mode .ms-shape-fill{pointer-events:visiblePainted;cursor:move}body.ms-edit-mode .ms-shape-txt{pointer-events:auto;cursor:move}',
    'body.ms-edit-mode .ms-shape-handle{pointer-events:all;cursor:grab}.ms-shape-handle{fill:#fff;stroke:#4f46e5;stroke-width:2}',
    '.ms-shape.ms-shape-on .ms-shape-outline{stroke:#4f46e5;stroke-width:1;stroke-dasharray:4 3;fill:none}',
    '@media print{#ms-story,#ms-story-spot,#ms-story-btn{display:none!important}#ms-stamp{position:absolute}.ms-shape-handle,.ms-shape-outline{display:none}}'
  ].join('\n');
  function onlyRuntime(n) { return /^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(n.tagName) || n.hasAttribute('data-ms-editor') || /^ms-(badge|errbar|stamp|watermark|story|story-spot|story-btn|state|runtime|vfs)$/.test(n.id || ''); }
  function lastReal(host) { var n = host.lastElementChild; while (n && onlyRuntime(n)) n = n.previousElementSibling; return n; }
  function renderFirm() {
    ensureStyle('ms-consult-css', CONSULT_CSS);
    var F = rt.state.firm, C = rt.state.confidential, foot = D.getElementById('ms-firm-foot');
    var logo = F && (F.logo || (rt.state.theme && rt.state.theme.logo));
    if (!(F && (F.footer || logo || F.name)) && !(C && C.on)) { if (foot) foot.remove(); }
    else {
      if (!foot) foot = el('footer', { id: 'ms-firm-foot' });
      var key = JSON.stringify([logo ? logo.length + logo.slice(-20) : 0, F && F.name, F && F.footer, C && C.on ? (C.label || 'Client confidential') : '']);
      if (foot.__k !== key) {
        foot.__k = key; foot.innerHTML = '';
        if (logo) foot.appendChild(el('img', { src: logo, alt: (F && F.name) || 'Logo' }));
        if (F && F.name) foot.appendChild(el('span', { 'class': 'ms-ff-name', text: F.name }));
        foot.appendChild(el('span', { 'class': 'ms-ff-text', text: (F && F.footer) || '' }));
        if (C && C.on) foot.appendChild(el('span', { 'class': 'ms-ff-conf', text: C.label || 'Client confidential' }));
      }
      if (foot.parentNode !== D.body || lastReal(D.body) !== foot) D.body.appendChild(foot);
    }
    var stg = rt.state.stage, sp = D.getElementById('ms-stamp');
    if (stg === 'draft' || stg === 'review') {
      if (!sp) { sp = el('div', { id: 'ms-stamp', 'aria-hidden': 'true' }); D.body.appendChild(sp); }
      sp.setAttribute('data-stage', stg); sp.textContent = stg === 'draft' ? 'Draft' : 'In review';
    } else if (sp) sp.remove();
    var wm = D.getElementById('ms-watermark');
    if (C && C.on && C.watermark !== false) {
      if (!wm) { wm = el('div', { id: 'ms-watermark', 'aria-hidden': 'true' }); D.body.appendChild(wm); }
      var t = String(C.label || 'Client confidential').toUpperCase().replace(/[<>&"']/g, '');
      var svg = "<svg xmlns='http://www.w3.org/2000/svg' width='440' height='260'><text x='220' y='130' text-anchor='middle' transform='rotate(-28 220 130)' font-family='Arial,sans-serif' font-size='22' font-weight='700' fill='rgba(185,28,28,0.10)'>" + t + '</text></svg>';
      var bg = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
      if (wm.__bg !== bg) { wm.__bg = bg; wm.style.backgroundImage = bg; }
    } else if (wm) wm.remove();
  }
  rt.sourceText = function (src) {
    if (!src) return '';
    return [src.text ? 'Source: ' + src.text : '', src.asOf ? 'As of ' + fmtDate(src.asOf) : '', src.note || ''].filter(Boolean).join(' · ');
  };
  function chartHost(c) { return c.el.closest('.ms-visual') || (c.el.tagName === 'CANVAS' && c.el.parentNode !== D.body ? c.el.parentNode : c.el); }
  function renderSource(c) {
    var src = (rt.state.charts[c.key] || {}).source, host = chartHost(c), par = host.parentNode; if (!par) return;
    var k = c.key.replace(/"/g, ''), line = par.querySelector(':scope > .ms-source[data-for="' + k + '"]'), txt = rt.sourceText(src);
    if (!txt) { if (line) line.remove(); return; }
    if (!line) { line = el('p', { 'class': 'ms-source', 'data-for': c.key }); var after = par.querySelector(':scope > .ms-summary[data-for="' + k + '"]') || host; par.insertBefore(line, after.nextSibling); }
    if (line.textContent !== txt) line.textContent = txt;
  }

  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(t, at) { var n = D.createElementNS(SVGNS, t); for (var k in at) n.setAttribute(k, at[k]); return n; }
  // Where an annotation points, in px from the chart's top-left: its data point, else where it was placed.
  rt.annotPoint = function (c, a, labels) {
    var p = null, r = c.el.getBoundingClientRect();
    if (a.label != null && c.a.point) {
      labels = labels || ((rt.chartData(c.key, true) || {}).labels || []);
      var i = labels.indexOf(String(a.label));
      if (i >= 0) p = c.a.point(c.inst, i, a.series || 0);
    }
    if (!p && a.fx != null) p = { x: a.fx * r.width, y: a.fy * r.height };
    return p;
  };
  // The data point nearest a spot on the screen (client px), for pinning a new annotation.
  rt.nearestPoint = function (key, cx, cy) {
    var c = rt.chart(key); if (!c) return null;
    var r = c.el.getBoundingClientRect(), x = cx - r.left, y = cy - r.top, best = null;
    var d = rt.chartData(key, true) || { labels: [], series: [] };
    if (c.a.point) d.labels.forEach(function (l, i) {
      for (var s = 0; s < Math.max(1, d.series.length); s++) {
        var p = c.a.point(c.inst, i, s); if (!p) continue;
        var dist = Math.pow(p.x - x, 2) + Math.pow(p.y - y, 2);
        if (!best || dist < best.dist) best = { label: l, series: s, x: p.x, y: p.y, dist: dist, value: d.series[s] ? d.series[s].values[i] : null, name: d.series[s] ? d.series[s].name : '' };
      }
    });
    var out = { fx: r.width ? +(x / r.width).toFixed(4) : 0.5, fy: r.height ? +(y / r.height).toFixed(4) : 0.5 };
    if (best && Math.sqrt(best.dist) < 140) { out.label = best.label; out.series = best.series; out.value = best.value; out.name = best.name; }
    return out;
  };
  function annLine(svg, x1, y1, x2, y2, col, arrow) {
    var ang = Math.atan2(y2 - y1, x2 - x1), back = arrow ? 8 : 3;
    svg.appendChild(svgEl('line', { x1: x1, y1: y1, x2: x2 - Math.cos(ang) * back, y2: y2 - Math.sin(ang) * back, stroke: col, 'stroke-width': arrow ? 2.2 : 1.5 }));
    if (arrow) {
      var s = 11, a1 = ang + Math.PI - 0.42, a2 = ang + Math.PI + 0.42;
      svg.appendChild(svgEl('polygon', { points: x2 + ',' + y2 + ' ' + (x2 + Math.cos(a1) * s) + ',' + (y2 + Math.sin(a1) * s) + ' ' + (x2 + Math.cos(a2) * s) + ',' + (y2 + Math.sin(a2) * s), fill: col }));
    }
  }
  function annDrag(bx, a) {
    if (!EDITOR) return;
    bx.style.cursor = 'move'; bx.title = 'Drag to move · double-click to edit';
    bx.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return; e.preventDefault(); e.stopPropagation();
      var sx = e.clientX, sy = e.clientY, moved = false;
      function mv(ev) { moved = true; bx.style.transform = 'translate(' + (ev.clientX - sx) + 'px,' + (ev.clientY - sy) + 'px)'; }
      function up(ev) {
        D.removeEventListener('mousemove', mv, true); D.removeEventListener('mouseup', up, true);
        if (!moved) return;
        var dx = (a.dx != null ? a.dx : 36) + ev.clientX - sx, dy = (a.dy != null ? a.dy : -48) + ev.clientY - sy;
        window.dispatchEvent(new CustomEvent('ms:annot-move', { detail: { id: a.id, dx: Math.round(dx), dy: Math.round(dy) } }));
      }
      D.addEventListener('mousemove', mv, true); D.addEventListener('mouseup', up, true);
    });
    bx.addEventListener('dblclick', function (e) { e.preventDefault(); e.stopPropagation(); window.dispatchEvent(new CustomEvent('ms:annot-edit', { detail: { id: a.id } })); });
  }
  function drawAnnots(c, as, shs) {
    as = as || []; shs = shs || [];
    var par = c.el.parentNode; if (!par) return;
    var k = c.key.replace(/"/g, ''), L = par.querySelector(':scope > .ms-annot-layer[data-for="' + k + '"]');
    if (!L) { L = el('div', { 'class': 'ms-annot-layer', 'data-for': c.key }); par.appendChild(L); }
    var r = c.el.getBoundingClientRect();
    L.innerHTML = '';
    if (!r.width || !r.height) { L.style.display = 'none'; return; }
    L.style.display = '';
    var op = L.offsetParent, left, top;
    if (!op || (op === D.body && getComputedStyle(D.body).position === 'static')) { left = r.left + window.pageXOffset; top = r.top + window.pageYOffset; }
    else { var o = op.getBoundingClientRect(); left = r.left - o.left - op.clientLeft + op.scrollLeft; top = r.top - o.top - op.clientTop + op.scrollTop; }
    L.style.left = left + 'px'; L.style.top = top + 'px'; L.style.width = r.width + 'px'; L.style.height = r.height + 'px';
    var svg = svgEl('svg', { 'class': 'ms-annot-svg', width: r.width, height: r.height }); L.appendChild(svg);
    var labels = (rt.chartData(c.key, true) || {}).labels || [];
    as.forEach(function (a) {
      var p = rt.annotPoint(c, a, labels); if (!p) return;
      var col = a.color || '#b91c1c', kind = a.kind || 'callout', dx = a.dx != null ? a.dx : 36, dy = a.dy != null ? a.dy : -48;
      var bx = el('div', { 'class': 'ms-annot ms-annot-' + kind, 'data-id': a.id, role: 'note' });
      if (kind === 'sowhat') bx.appendChild(el('b', { text: (a.title || 'So what') + ': ' }));
      bx.appendChild(D.createTextNode(a.text || ''));
      bx.style.borderColor = col;
      if (kind === 'arrow') bx.style.color = col;
      L.appendChild(bx);
      var bw = bx.offsetWidth, bh = bx.offsetHeight;
      // not placed by hand: keep it inside the chart (to the left of the point near the right edge, below it near the top)
      if (a.dx == null && p.x + dx + bw > r.width) dx = -bw - 24;
      if (a.dy == null && p.y + dy < 0) dy = 24;
      bx.style.left = (p.x + dx) + 'px'; bx.style.top = (p.y + dy) + 'px';
      var sx = Math.max(p.x + dx, Math.min(p.x, p.x + dx + bw)), sy = Math.max(p.y + dy, Math.min(p.y, p.y + dy + bh));
      if (Math.abs(sx - p.x) + Math.abs(sy - p.y) > 6) annLine(svg, sx, sy, p.x, p.y, col, kind === 'arrow');
      if (kind !== 'arrow') { svg.appendChild(svgEl('circle', { cx: p.x, cy: p.y, r: 5, fill: '#fff', stroke: col, 'stroke-width': 2.5 })); }
      annDrag(bx, a);
    });
    if (shs.length) drawShapes(c, shs, L, r);
  }

  /* shapes drawn on a chart: lines, arrows, boxes, circles, text, callouts, and the consulting
     classics, a growth (CAGR) arrow and a difference bracket, both pinned to data points */
  rt.shapeSel = null;
  var shLive = {};
  function shapePt(c, p, labels) {
    if (!p) return null;
    if (p.label != null && c.a.point) {
      var i = labels.indexOf(String(p.label));
      if (i >= 0) { var q = c.a.point(c.inst, i, p.series || 0); if (q) return { x: q.x, y: q.y, i: i }; }
    }
    var r = c.el.getBoundingClientRect();
    return p.fx != null ? { x: p.fx * r.width, y: p.fy * r.height } : null;
  }
  function valueAt(c, p) {
    if (!p || p.label == null) return null;
    var d = rt.chartData(c.key, true) || { labels: [], series: [] }, i = d.labels.indexOf(String(p.label)), s = d.series[p.series || 0];
    return i >= 0 && s ? { v: s.values[i], i: i } : null;
  }
  function sign(n, txt) { return (n > 0 ? '+' : n < 0 ? '−' : '') + txt.replace(/^-|^−/, ''); }
  // The label a growth arrow or difference bracket shows (unless the text was typed).
  rt.shapeLabel = function (key, sh) {
    var c = rt.chart(key); if (!c) return sh.text || '';
    if (sh.text) return sh.text;
    var A1 = valueAt(c, sh.a), B1 = valueAt(c, sh.b);
    if (!A1 || !B1 || A1.v == null || B1.v == null) return sh.kind === 'cagr' ? 'CAGR' : 'Change';
    var spec = ((rt.state.charts[key] || {}).style || {}).axisFormat || 'short';
    if (sh.kind === 'cagr') {
      var n = sh.periods || Math.abs(B1.i - A1.i) || 1;
      if (A1.v <= 0 || B1.v <= 0) return 'CAGR n/a';
      var g = Math.pow(B1.v / A1.v, 1 / n) - 1;
      return sign(g, fmtNum(Math.abs(g) * 100, '0.0') + '%') + ' CAGR';
    }
    var dv = B1.v - A1.v, pct = A1.v ? dv / Math.abs(A1.v) * 100 : null, show = sh.show || 'both';
    var abs = sign(dv, fmtNum(Math.abs(dv), spec)), rel = pct == null ? '' : sign(pct, fmtNum(Math.abs(pct), '0.0') + '%');
    return show === 'pct' ? rel || abs : show === 'abs' ? abs : abs + (rel ? ' (' + rel + ')' : '');
  };
  function head(svg, x1, y1, x2, y2, col, w) {
    var ang = Math.atan2(y2 - y1, x2 - x1), s = 7 + w * 2, a1 = ang + Math.PI - 0.45, a2 = ang + Math.PI + 0.45;
    svg.appendChild(svgEl('polygon', { points: x2 + ',' + y2 + ' ' + (x2 + Math.cos(a1) * s) + ',' + (y2 + Math.sin(a1) * s) + ' ' + (x2 + Math.cos(a2) * s) + ',' + (y2 + Math.sin(a2) * s), fill: col }));
    return s * 0.8;
  }
  function trim(x1, y1, x2, y2, by) { var ang = Math.atan2(y2 - y1, x2 - x1); return { x: x2 - Math.cos(ang) * by, y: y2 - Math.sin(ang) * by }; }
  function dashOf(sh) { return sh.dash === 'dash' ? '7 5' : sh.dash === 'dot' ? '1.5 4' : ''; }
  function txtBox(L, cls, sh, txt, x, y, col, center) {
    var t = el('div', { 'class': 'ms-shape-txt ' + cls, 'data-shape': sh.id });
    t.textContent = txt;
    if (cls === 'ms-sh-pill') t.style.background = col;
    else if (cls === 'ms-sh-callout') t.style.borderColor = col;
    else t.style.color = sh.textColor || col;
    if (sh.size) t.style.fontSize = sh.size + 'px';
    L.appendChild(t);
    var w = t.offsetWidth, hh = t.offsetHeight;
    t.style.left = (center ? x - w / 2 : x) + 'px'; t.style.top = (center ? y - hh / 2 : y) + 'px';
    return { w: w, h: hh, el: t };
  }
  function drawShapes(c, shs, L, r) {
    var svg = svgEl('svg', { 'class': 'ms-shape-svg', width: r.width, height: r.height }); L.appendChild(svg);
    var labels = (rt.chartData(c.key, true) || {}).labels || [];
    shs.forEach(function (sh0) {
      var sh = shLive[sh0.id] || sh0, kind = sh.kind || 'arrow', col = sh.color || '#0f172a', w = +sh.width || 2;
      var a = shapePt(c, sh.a, labels), b = shapePt(c, sh.b, labels); if (!a) return;
      if (!b) b = { x: a.x + 80, y: a.y };
      var g = svgEl('g', { 'class': 'ms-shape' + (rt.shapeSel === sh.id ? ' ms-shape-on' : ''), 'data-shape': sh.id }); svg.appendChild(g);
      var dash = dashOf(sh), st = { stroke: col, 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }; if (dash) st['stroke-dasharray'] = dash;
      var hit = function (d) { var x = svgEl('path', { d: d, stroke: 'transparent', 'stroke-width': 14, fill: 'none', 'class': 'ms-shape-hit', 'data-shape': sh.id }); g.appendChild(x); };
      var handles = [{ k: 'a', x: a.x, y: a.y }, { k: 'b', x: b.x, y: b.y }];
      if (kind === 'line' || kind === 'arrow' || kind === 'darrow') {
        var e1 = { x: a.x, y: a.y }, e2 = { x: b.x, y: b.y };
        if (kind !== 'line') { var hb = head(g, a.x, a.y, b.x, b.y, col, w); e2 = trim(a.x, a.y, b.x, b.y, hb); }
        if (kind === 'darrow') { var ha = head(g, b.x, b.y, a.x, a.y, col, w); e1 = trim(b.x, b.y, a.x, a.y, ha); }
        g.insertBefore(svgEl('line', Object.assign({ x1: e1.x, y1: e1.y, x2: e2.x, y2: e2.y }, st)), g.firstChild);
        hit('M' + a.x + ' ' + a.y + 'L' + b.x + ' ' + b.y);
        if (sh.text) txtBox(L, 'ms-sh-text', sh, sh.text, (a.x + b.x) / 2, (a.y + b.y) / 2 - 12, col, true);
      } else if (kind === 'rect' || kind === 'ellipse') {
        var x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), W = Math.abs(b.x - a.x), H = Math.abs(b.y - a.y);
        var fill = sh.fill ? sh.fill : 'none', att = Object.assign({}, st, { fill: fill, 'fill-opacity': sh.fill ? (sh.opacity != null ? sh.opacity : 0.14) : 0, 'class': 'ms-shape-fill', 'data-shape': sh.id });
        g.appendChild(kind === 'rect' ? svgEl('rect', Object.assign({ x: x, y: y, width: W, height: H, rx: sh.round != null ? sh.round : 6 }, att)) : svgEl('ellipse', Object.assign({ cx: x + W / 2, cy: y + H / 2, rx: W / 2, ry: H / 2 }, att)));
        if (!sh.fill) hit(kind === 'rect' ? 'M' + x + ' ' + y + 'h' + W + 'v' + H + 'h' + (-W) + 'z' : 'M' + x + ' ' + (y + H / 2) + 'a' + W / 2 + ' ' + H / 2 + ' 0 1 0 ' + W + ' 0a' + W / 2 + ' ' + H / 2 + ' 0 1 0 ' + (-W) + ' 0');
        if (sh.text) txtBox(L, 'ms-sh-text', sh, sh.text, x + W / 2, y - 12, col, true);
      } else if (kind === 'text') {
        var tb = txtBox(L, 'ms-sh-text', sh, sh.text || 'Text', a.x, a.y, col, false);
        if (sh.width2) tb.el.style.width = sh.width2 + 'px';
        handles = [{ k: 'a', x: a.x, y: a.y }];
      } else if (kind === 'callout') {
        var cb = txtBox(L, 'ms-sh-callout', sh, sh.text || 'Callout', b.x, b.y, col, true);
        var sx = Math.max(b.x - cb.w / 2, Math.min(a.x, b.x + cb.w / 2)), sy = Math.max(b.y - cb.h / 2, Math.min(a.y, b.y + cb.h / 2));
        if (Math.abs(sx - a.x) + Math.abs(sy - a.y) > 6) { var tt = trim(sx, sy, a.x, a.y, 4); g.appendChild(svgEl('line', Object.assign({ x1: sx, y1: sy, x2: tt.x, y2: tt.y }, st))); hit('M' + sx + ' ' + sy + 'L' + a.x + ' ' + a.y); }
        g.appendChild(svgEl('circle', { cx: a.x, cy: a.y, r: 4, fill: '#fff', stroke: col, 'stroke-width': 2 }));
      } else if (kind === 'cagr' || kind === 'delta') {
        var lift = sh.lift != null ? +sh.lift : 26, txt = rt.shapeLabel(c.key, sh);
        if (kind === 'cagr') {
          var p1 = { x: a.x, y: a.y - lift }, p2 = { x: b.x, y: b.y - lift };
          // clear the bars in between: raise the arrow until it passes above each of them
          if (a.i != null && b.i != null && c.a.point) {
            var up = 0, lo = Math.min(a.i, b.i), hi = Math.max(a.i, b.i);
            for (var k = lo + 1; k < hi; k++) {
              var q = c.a.point(c.inst, k, sh.a.series || 0); if (!q || p2.x === p1.x) continue;
              var yl = p1.y + (p2.y - p1.y) * (q.x - p1.x) / (p2.x - p1.x), need = yl - (q.y - lift * 0.8);
              if (need > up) up = need;
            }
            p1.y -= up; p2.y -= up;
          }
          var hb2 = head(g, p1.x, p1.y, p2.x, p2.y, col, w), q2 = trim(p1.x, p1.y, p2.x, p2.y, hb2);
          g.insertBefore(svgEl('line', Object.assign({ x1: p1.x, y1: p1.y, x2: q2.x, y2: q2.y }, st)), g.firstChild);
          hit('M' + p1.x + ' ' + p1.y + 'L' + p2.x + ' ' + p2.y);
          txtBox(L, 'ms-sh-pill', sh, txt, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 - 2, col, true);
          handles = [{ k: 'a', x: p1.x, y: p1.y }, { k: 'b', x: p2.x, y: p2.y }];
        } else {
          var top = Math.min(a.y, b.y) - lift, gap = 6;
          var d = 'M' + a.x + ' ' + (a.y - gap) + 'V' + top + 'H' + b.x + 'V' + (b.y - gap - 7 - w * 2);
          g.appendChild(svgEl('path', Object.assign({ d: d }, st)));
          head(g, b.x, top, b.x, b.y - gap, col, w);
          hit(d);
          txtBox(L, 'ms-sh-pill', sh, txt, (a.x + b.x) / 2, top, col, true);
          handles = [{ k: 'a', x: a.x, y: a.y - gap }, { k: 'b', x: b.x, y: b.y - gap }];
        }
      }
      if (EDITOR && rt.shapeSel === sh.id) handles.forEach(function (hd) { g.appendChild(svgEl('circle', { cx: hd.x, cy: hd.y, r: 5.5, 'class': 'ms-shape-handle', 'data-shape': sh.id, 'data-end': hd.k })); });
    });
  }
  // Editor: select, move and reshape shapes with the mouse (the editor records the change).
  function chartOfLayer(n) { var L = n.closest('.ms-annot-layer'); return L && rt.chart(L.getAttribute('data-for')); }
  if (EDITOR) D.addEventListener('mousedown', function (e) {
    if (e.button !== 0 || !window.__MS_EDIT_MODE) return;
    var t = e.target, id = t.getAttribute && t.getAttribute('data-shape'); if (!id) { var tx = t.closest && t.closest('.ms-shape-txt'); id = tx && tx.getAttribute('data-shape'); }
    if (!id) return;
    var c = chartOfLayer(t); if (!c) return;
    var sh = (rt.state.shapes || []).filter(function (x) { return x.id === id; })[0]; if (!sh) return;
    e.preventDefault(); e.stopPropagation();
    if (rt.shapeSel !== id) { rt.shapeSel = id; renderAnnots(); window.dispatchEvent(new CustomEvent('ms:shape-select', { detail: { id: id } })); }
    var end = t.getAttribute('data-end'), r = c.el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, moved = false;
    var labels = (rt.chartData(c.key, true) || {}).labels || [];
    var pa = shapePt(c, sh.a, labels), pb = shapePt(c, sh.b, labels) || (pa && { x: pa.x + 80, y: pa.y });
    var pinned = sh.kind === 'cagr' || sh.kind === 'delta';
    function frac(p) { return { fx: +(p.x / r.width).toFixed(4), fy: +(p.y / r.height).toFixed(4) }; }
    function mv(ev) {
      var dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return; moved = true;
      var n = JSON.parse(JSON.stringify(sh));
      if (pinned) {
        if (end) { var np = rt.nearestPoint(c.key, ev.clientX, ev.clientY); if (np && np.label != null) n[end] = { label: np.label, series: np.series }; }
        else n.lift = Math.max(-200, Math.round((sh.lift != null ? +sh.lift : 26) - dy));
      } else if (end) n[end] = frac({ x: (end === 'a' ? pa : pb).x + dx, y: (end === 'a' ? pa : pb).y + dy });
      else { n.a = frac({ x: pa.x + dx, y: pa.y + dy }); n.b = frac({ x: pb.x + dx, y: pb.y + dy }); }
      shLive[id] = n; renderAnnots();
    }
    function up() {
      D.removeEventListener('mousemove', mv, true); D.removeEventListener('mouseup', up, true);
      var n = shLive[id]; delete shLive[id];
      if (moved && n) window.dispatchEvent(new CustomEvent('ms:shape-move', { detail: { id: id, a: n.a, b: n.b, lift: n.lift } }));
      else renderAnnots();
    }
    D.addEventListener('mousemove', mv, true); D.addEventListener('mouseup', up, true);
  }, true);
  if (EDITOR) D.addEventListener('dblclick', function (e) {
    var t = e.target, n = t.closest && (t.closest('[data-shape]')); if (!n || !window.__MS_EDIT_MODE) return;
    e.preventDefault(); e.stopPropagation();
    window.dispatchEvent(new CustomEvent('ms:shape-edit', { detail: { id: n.getAttribute('data-shape') } }));
  }, true);
  rt.shapePreview = function (sh) { if (sh) shLive[sh.id] = sh; renderAnnots(); };
  rt.shapePreviewEnd = function (id) { delete shLive[id]; renderAnnots(); };

  function renderAnnots() {
    var by = {}, sb = {};
    (rt.state.annotations || []).forEach(function (a) { (by[a.chart] = by[a.chart] || []).push(a); });
    (rt.state.shapes || []).forEach(function (x) { (sb[x.chart] = sb[x.chart] || []).push(x); });
    Object.keys(shLive).forEach(function (id) { var x = shLive[id]; if (!(rt.state.shapes || []).some(function (y) { return y.id === id; })) (sb[x.chart] = sb[x.chart] || []).push(x); });
    var cs = rt.charts(), live = {};
    cs.forEach(function (c) { if (by[c.key] || sb[c.key]) { live[c.key] = 1; try { drawAnnots(c, by[c.key], sb[c.key]); } catch (e) { console.warn('[Mothership] annotations', e); } } });
    Array.prototype.forEach.call(D.querySelectorAll('.ms-annot-layer'), function (L) { if (!live[L.getAttribute('data-for')]) L.remove(); });
  }
  rt.renderAnnots = renderAnnots;
  var annSoon = function () { clearTimeout(annSoon.t); annSoon.t = setTimeout(renderAnnots, 160); };
  window.addEventListener('resize', annSoon);
  window.addEventListener('ms:pagetab', function () { setTimeout(renderAnnots, 120); setTimeout(renderAnnots, 700); });

  /* the storyline: step through chosen parts with a headline each, like slides */
  var ST = rt.story = { i: -1 };
  function steps() { var S = rt.state.story; return S && S.steps ? S.steps : []; }
  function cssq(s) { return String(s).replace(/["\\]/g, '\\$&'); }
  rt.findRef = function (ref) {
    if (!ref) return null;
    var n = ref.id ? (D.querySelector('[data-ms-id="' + cssq(ref.id) + '"]') || D.getElementById(ref.id)) : null;
    if (!n && ref.chart) { var c = rt.chart(ref.chart); n = c ? chartHost(c) : null; }
    return n;
  };
  function reveal(node) {
    var sec = node.closest && node.closest('#ms-main > section.ms-tab');
    if (sec && rt.showTab && !sec.classList.contains('ms-active')) rt.showTab(sec.getAttribute('data-ms-tab'));
    var pt = rt.pageTabOf && rt.pageTabOf(node);
    if (pt && !pt.active) rt.showPageTab(pt.index);
  }
  function place() {
    var spot = D.getElementById('ms-story-spot'), ui = D.getElementById('ms-story'); if (!spot || ST.i < 0) return;
    var node = rt.findRef((steps()[ST.i] || {}).ref), r = node && node.getBoundingClientRect();
    if (!r || !r.width) { spot.style.left = '50%'; spot.style.top = '50%'; spot.style.width = '0px'; spot.style.height = '0px'; return; }
    spot.style.left = (r.left - 6) + 'px'; spot.style.top = (r.top - 6) + 'px'; spot.style.width = (r.width + 12) + 'px'; spot.style.height = (r.height + 12) + 'px';
    var low = r.top + r.height / 2 < innerHeight / 2;
    ui.className = low ? 'bottom' : 'top';
  }
  function storyKey(e) {
    if (ST.i < 0) return;
    var k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); ST.next(); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); ST.prev(); }
    else if (k === 'Escape') { e.preventDefault(); ST.stop(); }
  }
  ST.key = storyKey;
  ST.play = function (i) {
    var all = steps(); if (!all.length) return false;
    i = Math.max(0, Math.min(all.length - 1, i || 0));
    var s = all[i], ui = D.getElementById('ms-story'), spot = D.getElementById('ms-story-spot');
    ensureStyle('ms-consult-css', CONSULT_CSS);
    if (!ui) {
      spot = el('div', { id: 'ms-story-spot', 'aria-hidden': 'true' }); D.body.appendChild(spot);
      ui = el('div', { id: 'ms-story', role: 'dialog', 'aria-label': 'Story', 'aria-live': 'polite' }); D.body.appendChild(ui);
      D.addEventListener('keydown', storyKey, true);
      window.addEventListener('scroll', place, true); window.addEventListener('resize', place);
    }
    ST.i = i;
    var node = rt.findRef(s.ref);
    if (node) { reveal(node); try { node.scrollIntoView({ block: 'center' }); } catch (e) { node.scrollIntoView(); } }
    ui.innerHTML = '';
    ui.appendChild(el('div', { 'class': 'ms-st-n', text: ((rt.state.story && rt.state.story.title) ? rt.state.story.title + ' · ' : '') + 'Step ' + (i + 1) + ' of ' + all.length }));
    ui.appendChild(el('h2', { text: s.headline || '' }));
    if (s.text) ui.appendChild(el('p', { text: s.text }));
    var dots = el('div', { 'class': 'ms-st-dots' }, all.map(function (_, j) { return el('i', { 'class': j === i ? 'on' : '' }); }));
    var prev = el('button', { text: '\u2039 Back', onclick: function () { ST.prev(); } }); if (!i) prev.disabled = true;
    ui.appendChild(el('div', { 'class': 'ms-st-foot' }, [dots, prev, el('button', { 'class': 'pri', text: i === all.length - 1 ? 'Finish' : 'Next \u203a', onclick: function () { ST.next(); } }), el('button', { text: '\u2715', title: 'Close (Esc)', 'aria-label': 'Close', onclick: function () { ST.stop(); } })]));
    var b = D.getElementById('ms-story-btn'); if (b) b.style.display = 'none';
    place(); setTimeout(place, 80); setTimeout(place, 420);
    try { window.dispatchEvent(new CustomEvent('ms:story', { detail: { index: i, total: all.length } })); } catch (e) {}
    return true;
  };
  ST.next = function () { if (ST.i >= steps().length - 1) ST.stop(); else ST.play(ST.i + 1); };
  ST.prev = function () { if (ST.i > 0) ST.play(ST.i - 1); };
  ST.stop = function () {
    ST.i = -1;
    ['ms-story', 'ms-story-spot'].forEach(function (id) { var n = D.getElementById(id); if (n) n.remove(); });
    D.removeEventListener('keydown', storyKey, true); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place);
    var b = D.getElementById('ms-story-btn'); if (b) b.style.display = '';
    try { window.dispatchEvent(new CustomEvent('ms:story', { detail: { index: -1 } })); } catch (e) {}
  };
  function renderStoryBtn() {
    var b = D.getElementById('ms-story-btn'), n = steps().length;
    if (EDITOR || !n) { if (b) b.remove(); return; }
    if (!b) { b = el('button', { id: 'ms-story-btn', type: 'button', onclick: function () { ST.play(0); } }); D.body.appendChild(b); }
    b.textContent = '\u25b6 ' + ((rt.state.story && rt.state.story.title) || 'Play the story') + ' (' + n + ')';
  }

  /* ------------------------------------------------------------ refresh */
  /* ------------------------------------------------------------ published files: version stamp, and a calm message if something fails */
  function fmtDate(d) { try { return new Date(d).toLocaleDateString(locale().locale, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return String(d || ''); } }
  function renderBadge() {
    var P = rt.state.publish, b = D.getElementById('ms-badge');
    if (EDITOR || !P || !P.version || P.badge === false) { if (b) b.remove(); return; }
    if (!b) {
      b = el('div', { id: 'ms-badge', role: 'note' });
      b.addEventListener('click', function () { b.classList.toggle('open'); });
      D.body.appendChild(b);
    }
    var bits = ['Version ' + P.version, 'Published ' + fmtDate(P.at)].concat(P.asOf ? ['Data as of ' + fmtDate(P.asOf)] : []);
    b.innerHTML = '';
    b.appendChild(el('div', { 'class': 'ms-badge-line', text: bits.join(' · ') }));
    var log = el('div', { 'class': 'ms-badge-log' }, (P.log || []).slice().reverse().slice(0, 8).map(function (x) {
      return el('div', {}, [el('b', { text: 'Version ' + x.version }), ' · ' + fmtDate(x.at) + (x.by ? ' · ' + x.by : ''), x.note ? el('div', { text: x.note }) : null]);
    }));
    b.appendChild(log);
    b.title = 'Click for release notes';
  }
  var errShown = false;
  function showErr(msg) {
    if (errShown || !D.body) return; errShown = true;
    var bar = el('div', { id: 'ms-errbar', role: 'alert' }, [el('span', { text: 'Part of this dashboard didn\u2019t load' + (msg ? ' (' + String(msg).slice(0, 80) + ')' : '') + '. The rest works. If it persists, ask the owner for a fresh copy.' }),
      el('button', { text: '\u2715', title: 'Hide', onclick: function () { bar.remove(); } })]);
    D.body.appendChild(bar);
  }
  if (!EDITOR) {
    // errors before the runtime loaded were noted by the #ms-early script in <head>
    if (window.__msErrs && window.__msErrs.length) showErr(window.__msErrs[0].message);
    window.addEventListener('error', function (e) { showErr(e && e.message); });
  }

  rt.refresh = function (force) {
    ensureStyle('ms-base-css', BASE_CSS);
    ensureStyle('ms-theme-css', themeCss());
    try { mapInline(); } catch (e) {}
    if (rt.layoutEnabled()) {
      rt.renderRibbon();
      var tabs = rt.tabs();
      if (!rt.activeTab || !tabs.some(function (t) { return t.id === rt.activeTab; })) {
        var want = null;
        var m = /#tab=([^&]+)/.exec(location.hash || '');
        if (m) { var title = decodeURIComponent(m[1]); want = tabs.filter(function (t) { return t.title === title; })[0]; }
        rt.showTab(want ? want.id : null);
      } else rt.showTab(rt.activeTab);
    }
    renderFilters();
    applyText();
    renderNative();
    renderKpis();
    ensureStyle('ms-tip-css', tipCss());
    renderBadge();
    try { renderFirm(); renderStoryBtn(); } catch (e) { console.warn('[Mothership] firm', e); }
    bindTips();
    cloneCopies();
    rt.charts().forEach(function (c) { applyChart(c, force); });
    rt.charts().forEach(function (c) { try { renderSource(c); } catch (e) {} });
    try { applyTableRules(); } catch (e) { console.warn('[Mothership] table rules', e); }
    if ((rt.state.annotations || []).length || (rt.state.shapes || []).length || D.querySelector('.ms-annot-layer')) { renderAnnots(); setTimeout(renderAnnots, 650); }
    try { tabKeys(); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('ms:refresh')); } catch (e) {}
  };

  /* ------------------------------------------------------------ boot */
  function boot() {
    rt.refresh();
    // charts are often created after load or after a fetch: re-apply a few times.
    [250, 800, 2000, 4000].forEach(function (t) { setTimeout(function () { rt.refresh(); }, t); });
    if (!EDITOR) D.addEventListener('keydown', function (e) {
      if ((!rt.layoutEnabled() && !rt.pageTabs()) || /input|select|textarea/i.test(e.target.tagName) || e.target.isContentEditable) return;
      if (e.altKey && e.key === 'ArrowRight') rt.step(1);
      if (e.altKey && e.key === 'ArrowLeft') rt.step(-1);
    });
  }
  ensureStyle('ms-base-css', BASE_CSS);
  ensureStyle('ms-theme-css', themeCss());
  if (rt.layoutEnabled()) rt.renderRibbon();
  if (D.readyState === 'complete') setTimeout(boot, 0);
  else window.addEventListener('load', function () { setTimeout(boot, 30); });
};
MS.RUNTIME_SRC = function () { return '(' + MS.RUNTIME_FN.toString() + ')();'; };
