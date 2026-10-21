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
    switch (spec) {
      case 'inr': return '₹' + IN(n, 0);
      case 'inr2': return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'cr': return '₹' + IN(n / 1e7, 2) + ' Cr';
      case 'lakh': case 'l': return '₹' + IN(n / 1e5, 2) + ' L';
      case 'k': return IN(n / 1e3, 1) + 'K';
      case 'm': case 'mn': return IN(n / 1e6, 2) + 'M';
      case 'bn': return IN(n / 1e9, 2) + 'B';
      case 'pct': return IN(n, 1) + '%';
      case 'pct100': return IN(n * 100, 1) + '%';
      case 'int': return IN(n, 0);
      case 'usd': return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
      case 'raw': return String(n);
      default:
        if (spec && /^0(\.0+)?$/.test(spec)) { var d = spec.indexOf('.') < 0 ? 0 : spec.length - 2; return n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }); }
        return IN(n, 2);
    }
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
      i.update('none');
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
      i.update('none');
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
      i.update('none');
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
  rt.adapters = A;

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
  rt.chartData = function (key) {
    var c = rt.chart(key); if (!c) return null;
    var i = c.inst, labels = [], series = [];
    if (c.lib === 'chartjs') {
      var O = i.__msOrig;
      labels = (O ? O.labels : i.data.labels) || [];
      series = (O ? O.datasets : i.data.datasets).map(function (d, k) { return { name: d.label || ('Series ' + (k + 1)), values: (d.data || []).map(num) }; });
    } else if (c.lib === 'echarts') {
      var o = i.__msOrig || i.getOption(), ax = A.echarts.cat(o), ss = o.series || [];
      labels = ax ? (o[ax][0].data || []).map(function (x) { return x && typeof x === 'object' ? x.value : x; }) : ((ss[0] || {}).data || []).map(function (d) { return d && d.name; });
      series = ss.map(function (x, k) { return { name: x.name || ('Series ' + (k + 1)), values: (x.data || []).map(num) }; });
    } else {
      var tr = i.__msOrig || i.data;
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
      if (c.lib === 'chartjs') {
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
      if (c.el.closest('.ms-block:not(.ms-inline) .ms-visual') && !c.inst.__msFill) { c.inst.__msFill = true; c.a.fill(c.inst); }
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
    });
  }

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
    if (T.css) out.push(T.css);
    return out.join('\n');
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

  /* ------------------------------------------------------------ refresh */
  rt.refresh = function (force) {
    ensureStyle('ms-base-css', BASE_CSS);
    ensureStyle('ms-theme-css', themeCss());
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
    bindTips();
    cloneCopies();
    rt.charts().forEach(function (c) { applyChart(c, force); });
    try { window.dispatchEvent(new CustomEvent('ms:refresh')); } catch (e) {}
  };

  /* ------------------------------------------------------------ boot */
  function boot() {
    rt.refresh();
    // charts are often created after load or after a fetch: re-apply a few times.
    [250, 800, 2000, 4000].forEach(function (t) { setTimeout(function () { rt.refresh(); }, t); });
    if (!EDITOR) D.addEventListener('keydown', function (e) {
      if (!rt.layoutEnabled() || /input|select|textarea/i.test(e.target.tagName) || e.target.isContentEditable) return;
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
