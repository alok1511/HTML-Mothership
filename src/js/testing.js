/* Testing: write test scenarios and cases for the dashboard (or let Mothership draft them),
   run the automatic steps, record results, and export a complete test document (Markdown,
   HTML, Excel, JSON) or a prompt for another AI to do the testing.

   The driver (MS.qa.drv) works the dashboard the way Playwright does: find a part by its text,
   name or selector, scroll it into view, check it can be clicked, then send real mouse and
   keyboard events. The MCP servers expose it as ui_* tools, so an AI assistant can test the
   dashboard step by step. Tests are kept in the dashboard's state (state.tests). */
(function (MS) {
  'use strict';
  var h = MS.h;
  var Q = MS.qa = {};
  function rt() { return MS.rt(); }
  function cdoc() { if (!MS.child) throw new Error('Open a dashboard first.'); return MS.child.doc; }
  function cwin() { return MS.child.win; }
  function low(x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim().toLowerCase(); }
  function norm(x) { return String(x == null ? '' : x).replace(/\s+/g, ' ').trim(); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frame() { return new Promise(function (r) { cwin().requestAnimationFrame(function () { r(); }); }); }
  function refOf(el) { return MS.api.refOf(el); }

  /* ================================================================ the driver */
  var D = Q.drv = {};
  var OWN = '[data-ms-editor],.ms-floatbar,.ms-annot-layer,#ms-stamp,#ms-watermark,#ms-badge,.ms-hovertip,.ms-grip,.ms-drag,.ms-size-handle,script,style,noscript,template';
  function visible(el) {
    if (!el || el.nodeType !== 1 || !el.isConnected) return false;
    var r = el.getBoundingClientRect(); if (!r.width || !r.height) return false;
    var cs = cwin().getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0;
  }
  D.visible = visible;
  function describe(el) {
    if (!el) return 'nothing';
    var c = rt() && rt().chartOf && rt().chartOf(el); if (c && (c.el === el || c.el.contains(el))) return 'chart “' + MS.charts.nameOf(c.key) + '”';
    var t = norm(el.getAttribute('aria-label') || el.textContent).slice(0, 50);
    return '<' + el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '>' + (t ? ' “' + t + '”' : '');
  }
  function all(sel) { return MS.$$(sel, cdoc()).filter(function (e) { return !e.closest(OWN); }); }
  // Elements whose own text matches, the most specific first (fewest characters).
  function byText(txt, sel) {
    var q = low(txt), exact = [], part = [];
    all(sel || 'body *').forEach(function (e) {
      if (/^(HTML|BODY|SCRIPT|STYLE)$/.test(e.tagName)) return;
      var t = low(e.getAttribute('aria-label') || e.innerText || e.textContent); if (!t) return;
      if (t === q) exact.push(e); else if (t.indexOf(q) >= 0) part.push(e);
    });
    var size = function (e) { return (e.textContent || '').length; };
    var pick = function (list) { list.sort(function (a, b) { return size(a) - size(b); }); return list; };
    var out = pick(exact).concat(pick(part));
    var vis = out.filter(visible); return vis.length ? vis.concat(out.filter(function (e) { return !visible(e); })) : out;
  }
  function chartEl(name) { var k = MS.api.chartKey(name), c = rt().chart(k); return c ? c.el : null; }
  function tabBtn(name) {
    var r = rt(), q = low(name), g = r.pageTabs && r.pageTabs();
    if (g) { var t = g.tabs.filter(function (x) { return low(x.title) === q; })[0] || g.tabs.filter(function (x) { return low(x.title).indexOf(q) >= 0; })[0]; if (t) return t.btn; }
    if (r.layoutEnabled()) { var b = MS.$$('#ms-ribbon .ms-tabbtn', cdoc()).filter(function (x) { return low(x.textContent) === q || low(x.textContent).indexOf(q) >= 0; })[0]; if (b) return b; }
    return null;
  }
  function kpiEl(name) {
    var q = low(name), hit = Q.kpis().filter(function (k) { return low(k.label) === q; })[0] || Q.kpis().filter(function (k) { return low(k.label).indexOf(q) >= 0; })[0];
    return hit ? hit.el : null;
  }
  function filterEl(name) {
    var q = low(name);
    return all('#ms-filter-pane select, select, input').filter(function (s) {
      var lab = s.closest('label'), t = low((lab && lab.textContent) || s.getAttribute('aria-label') || s.name || s.id || s.getAttribute('data-field'));
      return t.indexOf(q) >= 0 || low(s.getAttribute('data-field')) === q;
    })[0] || null;
  }
  // A target: "text=…", "chart=…", "tab=…", "kpi=…", "button=…", "filter=…", "ref=…", "css=…",
  // a ref from ui_snapshot, or a CSS selector (anything else is looked up as text).
  D.find = function (target, opts) {
    opts = opts || {};
    if (target && target.nodeType === 1) return target;
    var t = String(target == null ? '' : target).trim(); if (!t) throw new Error('Say what to act on (a ref, text=…, chart=…, tab=…, kpi=…, button=…, filter=… or a CSS selector).');
    var m = /^(text|chart|tab|kpi|button|link|filter|ref|css|label)\s*[=:]\s*([\s\S]+)$/i.exec(t), kind = m ? m[1].toLowerCase() : '', v = m ? m[2].trim() : t, el = null;
    if (kind === 'chart') el = chartEl(v);
    else if (kind === 'tab') el = tabBtn(v);
    else if (kind === 'kpi') el = kpiEl(v);
    else if (kind === 'filter') el = filterEl(v);
    else if (kind === 'button' || kind === 'link') el = byText(v, kind === 'link' ? 'a' : 'button,[role=button],a,input[type=button],input[type=submit],summary')[0];
    else if (kind === 'text' || kind === 'label') el = byText(v)[0];
    else {
      var d = cdoc();
      if (kind === 'ref' || /^[\w-]+$/.test(v)) el = d.querySelector('[data-ms-ref="' + v + '"],[data-ms-id="' + v + '"]');
      if (!el && kind !== 'ref') { try { el = d.querySelector(v); } catch (e) {} }
      if (!el && !kind) el = byText(v)[0];
    }
    if (!el && !opts.quiet) throw new Error('Nothing matches "' + t + '". Use ui_snapshot to see the parts and their refs.');
    if (el) D._lastEl = el;
    return el;
  };
  D.findAll = function (target) {
    var t = String(target || '').trim(), m = /^(text|css)\s*[=:]\s*([\s\S]+)$/i.exec(t);
    if (m && m[1].toLowerCase() === 'text') return byText(m[2]);
    try { return all(m ? m[2] : t); } catch (e) { return byText(t); }
  };

  // Interact mode: the dashboard gets the clicks (Edit mode would select things instead).
  D.interact = function () { if (MS.mode !== 'interact') MS.setMode('interact'); };
  function center(el, at) {
    var r = el.getBoundingClientRect();
    return at ? { x: r.left + at.x, y: r.top + at.y } : { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 200) };
  }
  // Where a chart's data point is, in the dashboard's coordinates.
  D.chartPoint = function (el, label, series) {
    var r = rt(), c = r.chartOf(el) || r.charts().filter(function (x) { return el.contains(x.el); })[0]; if (!c) throw new Error('That is not a chart.');
    var d = r.chartData(c.key, true) || { labels: [] }, i = typeof label === 'number' ? label : d.labels.map(low).indexOf(low(label));
    if (i < 0) throw new Error('The chart has no “' + label + '”. It shows: ' + d.labels.slice(0, 20).join(', '));
    var p = inner(c, i, series || 0) || (c.a.point ? c.a.point(c.inst, i, series || 0) : null); if (!p) throw new Error('Could not find that point on the chart.');
    var b = c.el.getBoundingClientRect(); return { x: b.left + p.x, y: b.top + p.y, el: c.el, chart: c };
  };
  // The middle of a bar or slice (the adapters give its top, for notes), so a hover lands on it.
  function inner(c, i, s) {
    try {
      if (c.lib === 'chartjs') { var e = c.inst.getDatasetMeta(s).data[i]; if (e && /bar/i.test(e.constructor.id || (e.constructor && e.constructor.name) || '') && e.getCenterPoint) { var q = e.getCenterPoint(true); return { x: q.x, y: q.y }; } }
      if (c.lib === 'highcharts') { var hp = c.inst.series[s].points[i]; if (hp && hp.shapeArgs && hp.shapeArgs.height != null && !c.inst.inverted && hp.series.type !== 'pie') return { x: c.inst.plotLeft + hp.shapeArgs.x + hp.shapeArgs.width / 2, y: c.inst.plotTop + hp.shapeArgs.y + hp.shapeArgs.height / 2 }; }
      if (c.lib === 'echarts') { var l = c.inst.getModel().getSeriesByIndex(s).getData().getItemLayout(i); if (l && l.width != null && l.height != null) return { x: l.x + l.width / 2, y: l.y + l.height / 2 }; }
      if (c.lib === 'plotly') { var cd = c.inst.calcdata[s], p = cd[i], tr = cd[0].trace, fl = c.inst._fullLayout; if (p && tr.type === 'bar') { var xa = fl[(tr.xaxis || 'x').replace('x', 'xaxis')], ya = fl[(tr.yaxis || 'y').replace('y', 'yaxis')], hz = tr.orientation === 'h', mid = (p.b || 0) + p.s / 2; return { x: xa._offset + xa.c2p(hz ? mid : p.p), y: ya._offset + ya.c2p(hz ? p.p : mid) }; } }
      if (c.lib === 'd3') { var m = c.a.marks(c.el)[i]; if (m) { var r = m.getBoundingClientRect(), b = c.el.getBoundingClientRect(); return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 }; } }
    } catch (e) {}
    return null;
  }
  // Move the mouse off what it was last over, so old pop-ups close.
  function leave() {
    var t = D._over; D._over = null; if (!t || !t.isConnected) return;
    var b = t.getBoundingClientRect();
    ['pointerout', 'pointerleave', 'mouseout', 'mouseleave'].forEach(function (k) { fire(t, k, b.left - 5, b.top - 5); });
  }
  function ready(el, force) {
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    return frame().then(frame).then(function () {
      if (!visible(el)) throw new Error(describe(el) + ' is not visible (is it on another tab?)');
      if (!force && (el.disabled || el.getAttribute('aria-disabled') === 'true')) throw new Error(describe(el) + ' is disabled.');
    });
  }
  function fire(target, type, x, y, extra) {
    var w = cwin(), isP = /^pointer/.test(type), C = isP && w.PointerEvent ? w.PointerEvent : w.MouseEvent;
    var o = Object.assign({ bubbles: !/enter|leave/.test(type), cancelable: true, composed: true, view: w, clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: /down|move/.test(type) && extra && extra.held ? 1 : (/down/.test(type) ? 1 : 0), detail: extra && extra.detail || 1 }, isP ? { pointerId: 1, pointerType: 'mouse', isPrimary: true } : {});
    return target.dispatchEvent(new C(type, o));
  }
  // While the Testing runner is on screen, a pointer moves to each part before it is used, so you can follow along.
  function show(el, p, verb) { return Q.live && Q.live.show ? Q.live.show(el, p, verb) : Promise.resolve(); }
  D.show = show;
  function hitAt(el, p, force) {
    var hit = cdoc().elementFromPoint(p.x, p.y);
    if (!force && hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
      var lab = hit.closest && hit.closest('label'); if (!(lab && lab.contains(el))) throw new Error(describe(el) + ' is covered by ' + describe(hit) + '. Close what is on top first (or pass force).');
    }
    return hit && (el.contains(hit) || hit === el) ? hit : el;
  }
  D.hover = function (target, o) {
    o = o || {}; D.interact();
    var el = D.find(target), pt = null;
    return ready(el, true).then(function () {
      pt = o.point != null ? D.chartPoint(el, o.point, o.series) : center(el);
      return show(el, pt, 'Hover');
    }).then(function () {
      var t = hitAt(el, pt, true);
      if (D._over !== t) leave(); D._over = t;
      ['pointerover', 'pointerenter', 'mouseover', 'mouseenter', 'pointermove', 'mousemove'].forEach(function (k) { fire(t, k, pt.x, pt.y); });
      return wait(o.wait || 180);
    }).then(function () { return { hovered: describe(el), at: { x: Math.round(pt.x), y: Math.round(pt.y) }, tooltip: D.tooltip(el) }; });
  };
  D.click = function (target, o) {
    o = o || {}; D.interact();
    var el = D.find(target), pt = null, before = D.state();
    return ready(el, o.force).then(function () {
      pt = o.point != null ? D.chartPoint(el, o.point, o.series) : center(el);
      return show(el, pt, o.double ? 'Double-click' : 'Click');
    }).then(function () {
      var t = hitAt(el, pt, o.force || o.point != null);
      if (D._over !== t) leave(); D._over = t;
      ['pointerover', 'mouseover', 'pointermove', 'mousemove'].forEach(function (k) { fire(t, k, pt.x, pt.y); });
      var n = o.double ? 2 : 1;
      for (var i = 1; i <= n; i++) {
        fire(t, 'pointerdown', pt.x, pt.y); fire(t, 'mousedown', pt.x, pt.y, { detail: i });
        if (t.focus && i === 1) try { t.focus({ preventScroll: true }); } catch (e) {}
        fire(t, 'pointerup', pt.x, pt.y); fire(t, 'mouseup', pt.x, pt.y, { detail: i });
        if (!fire(t, 'click', pt.x, pt.y, { detail: i })) { /* the page handled it */ }
        else if (i === 1 && typeof t.click === 'function' && /^(A|BUTTON|INPUT|SUMMARY|LABEL)$/.test(t.tagName) && !o.point) { /* native default action already ran with the event */ }
      }
      if (o.double) fire(t, 'dblclick', pt.x, pt.y, { detail: 2 });
      return wait(o.wait || 250);
    }).then(function () { return { clicked: describe(el), changed: D.changes(before) }; });
  };
  D.type = function (target, text, o) {
    o = o || {}; D.interact();
    var el = D.find(target);
    return ready(el, false).then(function () { return show(el, center(el), 'Type'); }).then(function () {
      if (!/^(INPUT|TEXTAREA)$/.test(el.tagName) && !el.isContentEditable) throw new Error(describe(el) + ' is not a text box.');
      el.focus();
      var w = cwin(), set = function (v) {
        if (el.isContentEditable) el.textContent = v;
        else { var proto = el.tagName === 'TEXTAREA' ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype, d = Object.getOwnPropertyDescriptor(proto, 'value'); d.set.call(el, v); }
      };
      var base = o.clear === false ? (el.value || el.textContent || '') : '';
      String(text).split('').forEach(function (ch, i) {
        el.dispatchEvent(new w.KeyboardEvent('keydown', { key: ch, bubbles: true }));
        set(base + String(text).slice(0, i + 1));
        el.dispatchEvent(new w.InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
        el.dispatchEvent(new w.KeyboardEvent('keyup', { key: ch, bubbles: true }));
      });
      el.dispatchEvent(new w.Event('change', { bubbles: true }));
      if (o.enter) D.press('Enter', el);
      return wait(150);
    }).then(function () { return { typed: String(text), into: describe(el), value: el.value != null ? el.value : el.textContent }; });
  };
  D.select = function (target, value) {
    D.interact();
    var el = D.find(target);
    if (el.tagName !== 'SELECT') { var inner = el.querySelector && el.querySelector('select'); if (inner) el = inner; else throw new Error(describe(el) + ' is not a drop-down list.'); }
    return ready(el, false).then(function () { return show(el, center(el), 'Pick'); }).then(function () {
      var opts = Array.prototype.slice.call(el.options), q = low(value);
      var o = opts.filter(function (x) { return low(x.value) === q || low(x.textContent) === q; })[0] || opts.filter(function (x) { return low(x.textContent).indexOf(q) >= 0; })[0];
      if (!o) throw new Error('“' + value + '” is not in the list. Options: ' + opts.map(function (x) { return norm(x.textContent); }).join(', '));
      el.value = o.value;
      el.dispatchEvent(new (cwin().Event)('input', { bubbles: true }));
      el.dispatchEvent(new (cwin().Event)('change', { bubbles: true }));
      return wait(300).then(function () { return { selected: norm(o.textContent), in: describe(el) }; });
    });
  };
  D.press = function (key, target) {
    var w = cwin(), el = target ? D.find(target) : (cdoc().activeElement || cdoc().body);
    var o = { key: key, code: key.length === 1 ? 'Key' + key.toUpperCase() : key, bubbles: true, cancelable: true };
    el.dispatchEvent(new w.KeyboardEvent('keydown', o)); el.dispatchEvent(new w.KeyboardEvent('keyup', o));
    if (key === 'Enter' && el.form && typeof el.form.requestSubmit === 'function') try { el.form.requestSubmit(); } catch (e) {}
    return wait(120).then(function () { return { pressed: key, on: describe(el) }; });
  };
  D.scroll = function (target, y) {
    if (target) { var el = D.find(target); el.scrollIntoView({ block: 'center' }); }
    else cwin().scrollTo(0, y || 0);
    return wait(120).then(function () { return { scrollY: Math.round(cwin().pageYOffset) }; });
  };
  D.showTab = function (name) {
    var r = rt(), g = r.pageTabs && r.pageTabs(), q = low(name);
    var t = g && (g.tabs.filter(function (x) { return low(x.title) === q; })[0] || g.tabs.filter(function (x) { return low(x.title).indexOf(q) >= 0; })[0]);
    if (t) { r.showPageTab(t.index); MS.emit('structure'); return wait(400).then(function () { return { tab: t.title }; }); }
    if (r.layoutEnabled()) { var tb = r.tabs().filter(function (x) { return low(x.title) === q || low(x.title).indexOf(q) >= 0; })[0]; if (tb) { r.showTab(tb.id); MS.emit('structure'); return wait(400).then(function () { return { tab: tb.title }; }); } }
    return Promise.reject(new Error('No tab called "' + name + '". Tabs: ' + Q.tabs().map(function (x) { return x.title; }).join(', ')));
  };
  // Wait for text or a part to appear (or go away).
  D.waitFor = function (o) {
    var until = Date.now() + Math.min(30000, o.timeout || 5000);
    function ok() {
      if (o.text) { var hit = byText(o.text).filter(visible).length > 0; return o.gone ? !hit : hit; }
      if (o.target) { var el = D.find(o.target, { quiet: true }), v = !!(el && visible(el)); return o.gone ? !v : v; }
      return true;
    }
    return new Promise(function (res, rej) {
      (function tick() {
        if (ok()) return res({ ok: true, waited: (o.timeout || 5000) - (until - Date.now()) });
        if (Date.now() > until) return rej(new Error('Timed out waiting for ' + (o.text ? '“' + o.text + '”' : o.target) + (o.gone ? ' to go away' : '')));
        setTimeout(tick, 100);
      })();
    });
  };
  D.read = function (target) {
    var el = D.find(target), r = el.getBoundingClientRect(), w = cwin(), cs = w.getComputedStyle(el);
    var out = { tag: el.tagName.toLowerCase(), ref: refOf(el), text: norm(el.innerText || el.textContent).slice(0, 2000), visible: visible(el), enabled: !el.disabled, box: { x: Math.round(r.left), y: Math.round(r.top + w.pageYOffset), width: Math.round(r.width), height: Math.round(r.height) }, style: { color: cs.color, background: cs.backgroundColor, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontFamily: cs.fontFamily.split(',')[0] } };
    if ('value' in el && el.tagName !== 'BUTTON' && el.tagName !== 'LI') out.value = el.value;
    if (el.tagName === 'SELECT') out.options = Array.prototype.map.call(el.options, function (o) { return norm(o.textContent); });
    if (el.tagName === 'A') out.href = el.getAttribute('href');
    var c = rt() && (rt().chartOf(el) || rt().charts().filter(function (x) { return el.contains(x.el); })[0]); if (c) out.chart = Q.chartState(c.key);
    return out;
  };
  // What a hover pop-up shows right now (chart pop-ups and Mothership's own pop-ups).
  D.tooltip = function (near) {
    var r = rt(), d = cdoc(), out = [], own = near && r ? (r.chartOf(near) || r.charts().filter(function (x) { return near.contains(x.el); })[0]) : null;
    if (r) r.charts().forEach(function (c) {
      try {
        if (c.lib === 'chartjs' && c.inst.tooltip && c.inst.tooltip.opacity > 0 && c.inst.tooltip.getActiveElements && c.inst.tooltip.getActiveElements().length) {
          var tt = c.inst.tooltip; out.push({ chart: MS.charts.nameOf(c.key), text: norm([].concat(tt.title || [], (tt.body || []).map(function (b) { return (b.before || []).concat(b.lines || [], b.after || []).join(' '); }), tt.footer || []).join(' · ')) });
        } else if (c.lib === 'echarts') {
          var tip = c.inst.getDom().querySelector('div[style*="z-index: 9999999"]');
          if (tip && tip.style.display !== 'none' && tip.style.visibility !== 'hidden' && !(tip.style.opacity !== '' && +tip.style.opacity === 0) && norm(tip.textContent)) out.push({ chart: MS.charts.nameOf(c.key), text: norm(tip.innerText || tip.textContent) });
        } else if (c.lib === 'plotly') {
          var hv = c.el.querySelector('.hoverlayer'); if (hv && norm(hv.textContent)) out.push({ chart: MS.charts.nameOf(c.key), text: norm(hv.textContent) });
        } else if (c.lib === 'highcharts') {
          var ht = c.el.querySelector('.highcharts-tooltip'); if (ht && ht.getAttribute('visibility') !== 'hidden' && norm(ht.textContent)) out.push({ chart: MS.charts.nameOf(c.key), text: norm(ht.textContent) });
        }
      } catch (e) {}
    });
    var hv2 = d.querySelector('.ms-hovertip'); if (hv2 && visible(hv2) && norm(hv2.textContent)) out.push({ chart: null, text: norm(hv2.textContent) });
    MS.$$('[role=tooltip]', d).forEach(function (t) { if (visible(t) && norm(t.textContent)) out.push({ chart: null, text: norm(t.textContent) }); });
    if (own) { var nm = MS.charts.nameOf(own.key), mine = out.filter(function (x) { return x.chart === nm || x.chart === null; }); out = mine; }
    return out.length ? out : null;
  };
  // A fingerprint of what is on screen, to tell what a click changed.
  D.state = function () {
    var r = rt();
    return { tab: Q.tabs().filter(function (t) { return t.active; }).map(function (t) { return t.title; })[0] || null, charts: r ? r.charts().map(function (c) { var d = r.chartData(c.key, true) || {}; return c.key + ':' + (d.labels || []).join('|') + ':' + (d.series || []).map(function (s) { return s.values.join(','); }).join(';'); }) : [], kpis: Q.kpis().map(function (k) { return k.value; }), dialogs: all('[role=dialog],dialog[open],.modal.show,.ms-modal-wrap').filter(visible).length, scroll: Math.round(cwin().pageYOffset) };
  };
  D.changes = function (b) {
    var a = D.state(), out = [];
    if (a.tab !== b.tab) out.push('tab: ' + b.tab + ' → ' + a.tab);
    var ch = a.charts.filter(function (x, i) { return x !== b.charts[i]; }).length; if (ch) out.push(ch + ' chart(s) changed');
    var kp = a.kpis.filter(function (x, i) { return x !== b.kpis[i]; }).length; if (kp) out.push(kp + ' KPI value(s) changed');
    if (a.dialogs !== b.dialogs) out.push(a.dialogs > b.dialogs ? 'a pop-up window opened' : 'a pop-up window closed');
    return out.length ? out : ['nothing visible changed'];
  };
  // Script errors and console errors since the dashboard opened.
  D.errors = function (clear) {
    var w = cwin(), out = { scriptErrors: (w.__msErrs || []).map(function (e) { return e && e.message ? e.message + (e.file ? ' (' + e.file + (e.line ? ':' + e.line : '') + ')' : '') : String(e); }), consoleErrors: (w.__msConsole || []).slice() };
    if (clear) { if (w.__msErrs) w.__msErrs.length = 0; if (w.__msConsole) w.__msConsole.length = 0; }
    return out;
  };
  D.width = function (px) {
    MS.view.setWidth(px === 'auto' || !px ? 'auto' : +px, true);
    return wait(700).then(function () { var de = cdoc().documentElement; return { width: MS.view.renderWidth, overflow: Math.max(0, de.scrollWidth - de.clientWidth) }; });
  };
  // A part's box in the editor window (for real mouse input and screenshots from the MCP server).
  D.locate = function (target, o) {
    o = o || {};
    var el = D.find(target); el.scrollIntoView({ block: 'center' });
    var f = MS.$('#stage-frame-host iframe').getBoundingClientRect(), s = MS.view.scale || 1;
    var r = el.getBoundingClientRect(), p = o.point != null ? D.chartPoint(el, o.point, o.series) : null;
    if (o.interact) { D.interact(); D._mark = { el: el, before: D.state() }; }
    var x0 = Math.max(f.left, f.left + r.left * s), y0 = Math.max(f.top, f.top + r.top * s);
    var x1 = Math.min(f.right, innerWidth, f.left + r.right * s), y1 = Math.min(f.bottom, innerHeight, f.top + r.bottom * s);
    return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0), cx: f.left + (p ? p.x : r.left + r.width / 2) * s, cy: f.top + (p ? p.y : r.top + Math.min(r.height / 2, 200)) * s, scale: s, what: describe(el) };
  };
  MS.on('child-loaded', function (c) {
    try {
      var w = c.win; w.__msConsole = [];
      var ce = w.console.error; w.console.error = function () { try { if (w.__msConsole.length < 50) w.__msConsole.push(Array.prototype.map.call(arguments, function (x) { return x && x.message ? x.message : String(x); }).join(' ').slice(0, 300)); } catch (e) {} return ce.apply(this, arguments); };
      w.addEventListener('unhandledrejection', function (e) { if (w.__msConsole.length < 50) w.__msConsole.push('Unhandled: ' + String(e.reason && e.reason.message || e.reason).slice(0, 300)); });
    } catch (e) {}
  });

  /* ================================================================ what the dashboard has */
  Q.tabs = function () {
    var r = rt(); if (!r) return [];
    var g = r.pageTabs && r.pageTabs();
    if (g && g.tabs.length > 1) return g.tabs.map(function (t) { return { title: t.title, active: !!t.active, el: t.btn, panel: t.panel }; });
    if (r.layoutEnabled()) return r.tabs().filter(function (t) { return !t.hidden; }).map(function (t) { return { title: t.title, active: t.id === r.activeTab, el: MS.$('#ms-ribbon [data-ms-tabbtn="' + t.id + '"]', cdoc()), panel: r.tabEl(t.id) }; });
    return [];
  };
  function tabOfEl(el) { var t = Q.tabs().filter(function (x) { return x.panel && x.panel.contains(el); })[0]; return t ? t.title : null; }
  Q.kpis = function () {
    var d = cdoc(), out = [], seen = [];
    var cands = MS.$$('[data-ms-kpi],.ms-kpi,[class*="kpi"],[class*="metric"],[class*="stat-card"],[class*="scorecard"]', d).filter(function (e) { return !e.closest(OWN) && !/kpis|kpi-row|kpi-grid|metrics/.test(e.className || '') && /\d/.test(e.textContent || '') && (e.textContent || '').length < 160 && e.querySelectorAll('canvas,svg,table').length === 0; });
    cands.forEach(function (e) {
      if (seen.some(function (s) { return s.contains(e) || e.contains(s) && s !== e; })) { if (seen.some(function (s) { return e.contains(s); })) { seen = seen.filter(function (s) { return !e.contains(s); }); } else return; }
      seen.push(e);
    });
    seen.forEach(function (e) {
      var v = e.querySelector('.ms-kpi-value,[class*="value"],[class*="number"],[class*="figure"],strong,b,h2,h3') || null;
      var val = v ? norm(v.textContent) : (norm(e.innerText).match(/[-+]?[₹$€£¥]?\s?\(?[\d][\d,.]*\)?\s?(%|Cr|cr|L|K|M|B|bn|mn|k|m)?/) || [''])[0];
      var lab = norm((e.querySelector('.ms-kpi-label,[class*="label"],[class*="title"],small,span') || {}).textContent || norm(e.innerText).replace(val, '')).slice(0, 60);
      out.push({ label: lab || 'KPI', value: val, el: e, bound: e.hasAttribute('data-ms-kpi') ? e.getAttribute('data-ms-kpi') : null });
    });
    return out;
  };
  Q.chartState = function (key) {
    var r = rt(), c = r.chart(key); if (!c) return null;
    var d = r.chartData(key, true) || { labels: [], series: [] }, info = r.chartInfo(key) || {}, b = c.el.getBoundingClientRect();
    var drawn = b.width > 20 && b.height > 20 && d.labels.length > 0 && d.series.some(function (s) { return s.values.some(function (v) { return v != null; }); });
    return { name: MS.charts.nameOf(key), key: key, kind: MS.charts.kindName ? MS.charts.kindName(info.type) : info.type, library: c.lib, visible: visible(c.el), drawn: drawn, tab: tabOfEl(c.el), labels: d.labels.slice(0, 60), series: d.series.map(function (s) { return { name: s.name, values: s.values.slice(0, 60), total: s.values.reduce(function (a, v) { return a + (+v || 0); }, 0) }; }), drillLevel: (r.drill && r.drill[key] || []).length, hasDrill: !!((r.state.charts[key] || {}).drill), source: (r.state.charts[key] || {}).source || null };
  };
  // A Playwright-style snapshot: the parts a tester can act on, each with a ref.
  Q.snapshot = function (o) {
    o = o || {}; var r = rt(), d = cdoc(), vis = function (e) { return o.all || visible(e); };
    var out = { title: d.title, mode: MS.mode, width: MS.view.renderWidth, tabs: Q.tabs().map(function (t) { return { title: t.title, active: t.active, ref: t.el ? refOf(t.el) : null }; }) };
    out.headings = all('h1,h2,h3').filter(vis).slice(0, 40).map(function (e) { return { level: +e.tagName[1], text: norm(e.textContent).slice(0, 100), ref: refOf(e) }; });
    out.kpis = Q.kpis().filter(function (k) { return vis(k.el); }).map(function (k) { return { label: k.label, value: k.value, ref: refOf(k.el), linkedToData: !!k.bound }; });
    out.charts = r ? r.charts().filter(function (c) { return vis(c.el); }).map(function (c) { var s = Q.chartState(c.key); return { name: s.name, kind: s.kind, ref: refOf(c.el), drawn: s.drawn, tab: s.tab, labels: s.labels.slice(0, 12), series: s.series.map(function (x) { return x.name; }), points: s.labels.length, drillDown: s.hasDrill }; }) : [];
    var tabEls = Q.tabs().map(function (t) { return t.el; });
    out.controls = all('button,a[href],[role=button],select,input,textarea,summary').filter(function (e) { return vis(e) && tabEls.indexOf(e) < 0 && !e.closest('#ms-ribbon'); }).slice(0, 80).map(function (e) {
      var kind = e.tagName === 'SELECT' ? 'dropdown' : e.tagName === 'A' ? 'link' : e.tagName === 'INPUT' ? (e.type === 'checkbox' || e.type === 'radio' ? e.type : 'textbox') : e.tagName === 'TEXTAREA' ? 'textbox' : 'button';
      var lab = e.closest('label'), name = norm(e.getAttribute('aria-label') || (kind === 'dropdown' || kind === 'textbox' ? (lab && norm(lab.textContent).replace(norm(e.textContent), '')) || e.getAttribute('placeholder') || e.name || e.id : e.innerText || e.value || e.title));
      var x = { kind: kind, name: name.slice(0, 80), ref: refOf(e) };
      if (kind === 'dropdown') { x.value = norm((e.options[e.selectedIndex] || {}).textContent); x.options = Array.prototype.map.call(e.options, function (q) { return norm(q.textContent); }).slice(0, 30); }
      else if (kind === 'textbox') x.value = e.value;
      else if (kind === 'checkbox' || kind === 'radio') x.checked = e.checked;
      if (e.disabled) x.disabled = true;
      if (kind === 'link') x.href = e.getAttribute('href');
      return x;
    });
    out.tables = all('table').filter(vis).slice(0, 20).map(function (t) { var hd = MS.$$('th', t).map(function (x) { return norm(x.textContent); }); return { ref: refOf(t), columns: hd.length ? hd : MS.$$('tr:first-child td', t).map(function (x) { return norm(x.textContent); }), rows: t.querySelectorAll('tbody tr').length || t.rows.length, headings: hd.length > 0 }; });
    var er = D.errors(); out.errors = er.scriptErrors.length + er.consoleErrors.length;
    return out;
  };

  /* ================================================================ checks */
  // check: {visible, hidden, text (contains), equals, matches, count, min, max, value, enabled, chart_drawn, tooltip}
  Q.expect = function (target, check) {
    check = check || {};
    var res = function (pass, actual, expected) { return { pass: !!pass, actual: actual, expected: expected }; };
    if (check.count != null || check.min != null || check.max != null) {
      var n = D.findAll(target).filter(visible).length;
      if (check.count != null) return res(n === +check.count, n + ' found', check.count + ' expected');
      return res((check.min == null || n >= +check.min) && (check.max == null || n <= +check.max), n + ' found', (check.min != null ? 'at least ' + check.min : '') + (check.max != null ? ' at most ' + check.max : ''));
    }
    var el = D.find(target, { quiet: true });
    if (check.hidden) return res(!el || !visible(el), el ? (visible(el) ? 'visible' : 'hidden') : 'not there', 'hidden');
    if (!el) return res(false, 'not found', target);
    if (check.visible) return res(visible(el), visible(el) ? 'visible' : 'hidden', 'visible');
    var txt = norm(el.innerText || el.textContent);
    if (check.text != null) return res(low(txt).indexOf(low(check.text)) >= 0, txt.slice(0, 200), 'contains “' + check.text + '”');
    if (check.equals != null) return res(low(txt) === low(check.equals), txt.slice(0, 200), '“' + check.equals + '”');
    if (check.matches != null) { var re; try { re = new RegExp(check.matches, 'i'); } catch (e) { throw new Error('Not a valid pattern: ' + check.matches); } return res(re.test(txt), txt.slice(0, 200), 'matches /' + check.matches + '/'); }
    if (check.value != null) return res(low(el.value) === low(check.value) || (el.tagName === 'SELECT' && low((el.options[el.selectedIndex] || {}).textContent) === low(check.value)), el.value, check.value);
    if (check.enabled != null) return res(!el.disabled === !!check.enabled, el.disabled ? 'disabled' : 'enabled', check.enabled ? 'enabled' : 'disabled');
    if (check.chart_drawn) { var c = rt().chartOf(el) || rt().charts().filter(function (x) { return el.contains(x.el); })[0]; var s = c && Q.chartState(c.key); return res(s && s.drawn, s ? (s.drawn ? 'drawn with ' + s.labels.length + ' categories' : 'empty or not drawn') : 'not a chart', 'drawn with data'); }
    return res(visible(el), visible(el) ? 'visible' : 'hidden', 'visible');
  };

  /* ================================================================ the test plan */
  Q.TYPES = ['Smoke', 'Navigation', 'Data', 'Interaction', 'Visual', 'Responsive', 'Accessibility', 'Export', 'Content'];
  Q.PRIORITIES = ['High', 'Medium', 'Low'];
  Q.STATUSES = ['Not run', 'Pass', 'Fail', 'Blocked', 'Skipped', 'Needs a person'];
  // Steps: {do, target, value, point}. "do" is one of these.
  Q.ACTIONS = {
    open_tab: 'Open a tab (target: tab name)', click: 'Click (target)', double_click: 'Double-click (target; point: a chart category)', hover: 'Hover (target; point: a chart category)',
    type: 'Type text (target, value)', select: 'Pick from a drop-down (target, value)', press: 'Press a key (value)', wait: 'Wait (value: ms)', set_width: 'Draw the page at a width (value: px or auto)',
    expect_visible: 'Check it is visible (target)', expect_hidden: 'Check it is hidden (target)', expect_text: 'Check its text contains (target, value)', expect_count: 'Check how many match (target, value: n or >=n)',
    expect_chart_drawn: 'Check a chart drew with data (target)', expect_tooltip: 'Check the hover pop-up (target chart, point; value: text it contains)', expect_changed: 'Check the last action changed something (value: what, e.g. "chart")',
    expect_no_errors: 'Check there are no script errors', expect_no_overflow: 'Check nothing spills off the side of the page', expect_numbers: 'Check KPI cards agree with chart totals',
    expect_a11y: 'Check the accessibility scan (value: most findings allowed)', screenshot: 'Take a picture (target, optional)', manual: 'A person (or AI) checks this by eye (value: what to check)'
  };
  function plan() { var r = rt(); return (r && r.state.tests) || { title: '', cases: [] }; }
  Q.plan = plan;
  Q.cases = function () { return plan().cases || []; };
  Q.get = function (id) { return Q.cases().filter(function (c) { return c.id === id; })[0] || null; };
  function edit(label, fn) { MS.history.state(label, function (s) { s.tests = s.tests || { title: '', cases: [] }; s.tests.cases = s.tests.cases || []; fn(s.tests); }); MS.emit('tests'); }
  function nextId(list) { var n = 0; list.forEach(function (c) { var m = /(\d+)$/.exec(c.id || ''); if (m) n = Math.max(n, +m[1]); }); return 'TC-' + String(n + 1).padStart(3, '0'); }
  function clean(c) {
    var x = { id: c.id, scenario: norm(c.scenario || 'General'), title: norm(c.title || 'Untitled test'), type: Q.TYPES.indexOf(c.type) >= 0 ? c.type : 'Interaction', priority: Q.PRIORITIES.indexOf(c.priority) >= 0 ? c.priority : 'Medium', pre: c.pre || '', steps: (c.steps || []).map(function (s) { var y = { do: s.do || s.action || 'manual' }; ['target', 'value', 'point'].forEach(function (k) { if (s[k] != null && s[k] !== '') y[k] = s[k]; }); return y; }), expected: c.expected || '', status: Q.STATUSES.indexOf(c.status) >= 0 ? c.status : 'Not run' };
    ['actual', 'notes', 'by', 'at', 'area', 'ms'].forEach(function (k) { if (c[k]) x[k] = c[k]; });
    x.auto = x.steps.length > 0 && x.steps.every(function (s) { return s.do !== 'manual'; });
    return x;
  }
  Q.add = function (c) { var out; edit('Add test case', function (T) { out = clean(Object.assign({}, c, { id: c.id && !T.cases.some(function (x) { return x.id === c.id; }) ? c.id : nextId(T.cases) })); T.cases.push(out); }); return out; };
  Q.update = function (id, patch, label) {
    var out = null;
    edit(label || 'Edit test case', function (T) { T.cases = T.cases.map(function (c) { if (c.id !== id) return c; out = clean(Object.assign({}, c, patch, { id: id })); return out; }); });
    if (!out) throw new Error('No test case ' + id);
    return out;
  };
  Q.remove = function (id) { edit('Delete test case', function (T) { T.cases = T.cases.filter(function (c) { return c.id !== id; }); }); };
  Q.clear = function () { MS.history.state('Delete all test cases', function (s) { delete s.tests; }); MS.emit('tests'); };
  Q.record = function (id, o) {
    var c = Q.get(id); if (!c) throw new Error('No test case ' + id + '. Cases: ' + Q.cases().map(function (x) { return x.id; }).join(', '));
    var st = o.status ? (Q.STATUSES.filter(function (s) { return low(s) === low(o.status); })[0] || (low(o.status) === 'passed' ? 'Pass' : low(o.status) === 'failed' ? 'Fail' : null)) : c.status;
    if (!st) throw new Error('Status must be one of: ' + Q.STATUSES.join(', '));
    return Q.update(id, { status: st, actual: o.actual != null ? o.actual : c.actual, notes: o.notes != null ? o.notes : c.notes, by: o.by || c.by || '', at: new Date().toISOString() }, 'Test result ' + id);
  };

  /* ---------------------------------------------------------------- drafting test cases */
  // One step per line: "do | target | value" (point: "chart=Sales @ North").
  Q.stepText = function (s) { return [s.do, s.target ? s.target + (s.point != null ? ' @ ' + s.point : '') : (s.point != null ? '@ ' + s.point : ''), s.value != null ? s.value : ''].join(' | ').replace(/( \| )+$/, ''); };
  Q.parseSteps = function (txt) {
    return String(txt || '').split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var p = l.split('|').map(function (x) { return x.trim(); }), s = { do: (p[0] || 'manual').toLowerCase().replace(/\s+/g, '_') };
      if (!Q.ACTIONS[s.do]) return { do: 'manual', value: l };
      if (p[1]) { var m = /^(.*?)\s*@\s*(.+)$/.exec(p[1]); if (m) { if (m[1]) s.target = m[1]; s.point = m[2]; } else s.target = p[1]; }
      if (p.length > 2) s.value = p.slice(2).join(' | ');
      return s;
    });
  };
  Q.generate = function (o) {
    o = o || {}; var r = rt(); if (!r) throw new Error('Turn off Safe mode to draft tests.');
    var out = [], tabs = Q.tabs(), first = tabs.filter(function (t) { return t.active; })[0];
    var add = function (scenario, type, priority, title, steps, expected, pre) { var c = { scenario: scenario, type: type, priority: priority, title: title, steps: steps, expected: expected, pre: pre || '' }; out.push(c); return c; };
    var openFirst = first ? [{ do: 'open_tab', target: first.title }] : [];
    add('Opens cleanly', 'Smoke', 'High', 'The dashboard opens without script errors', [{ do: 'expect_no_errors' }], 'No script errors or console errors.');
    var charts = r.charts();
    var vis1 = charts.filter(function (c) { return visible(c.el); });
    if (vis1.length) add('Opens cleanly', 'Smoke', 'High', 'Every chart on the first screen draws with data', openFirst.concat(vis1.map(function (c) { return { do: 'expect_chart_drawn', target: 'chart=' + MS.charts.nameOf(c.key) }; })), 'Each chart shows bars, lines or slices with numbers; none is blank.');
    tabs.forEach(function (t) {
      var inTab = charts.filter(function (c) { return t.panel && t.panel.contains(c.el); });
      add('Navigation', 'Navigation', 'High', 'Open the “' + t.title + '” tab', [{ do: 'open_tab', target: t.title }, { do: 'expect_visible', target: 'tab=' + t.title }].concat(inTab.map(function (c) { return { do: 'expect_chart_drawn', target: 'chart=' + MS.charts.nameOf(c.key) }; })).concat([{ do: 'expect_no_errors' }]), 'The tab opens, its charts draw, and nothing errors.');
    });
    charts.forEach(function (c) {
      var nm = MS.charts.nameOf(c.key), t = tabOfEl(c.el), go = t ? [{ do: 'open_tab', target: t }] : [], d = r.chartData(c.key, true) || { labels: [] }, cs = r.state.charts[c.key] || {};
      var area = (t ? t + ' › ' : '') + nm;
      add('Charts', 'Data', 'High', '“' + nm + '” shows the right numbers', go.concat([{ do: 'expect_chart_drawn', target: 'chart=' + nm }, { do: 'manual', value: 'Compare each value (' + d.labels.slice(0, 6).join(', ') + (d.labels.length > 6 ? '…' : '') + ') with the source report' }]), 'Every value matches the source; the units and currency are right.').area = area;
      var canPoint = false; try { canPoint = !!(d.labels.length && D.chartPoint(c.el, 0)); } catch (e) {}
      if (d.labels.length) add('Charts', 'Interaction', 'Medium', 'Hovering “' + nm + '” shows a pop-up with the value', go.concat(canPoint ? [{ do: 'hover', target: 'chart=' + nm, point: d.labels[0] }, { do: 'expect_tooltip', target: 'chart=' + nm, point: d.labels[0], value: d.labels[0] }] : [{ do: 'manual', value: 'Hover “' + d.labels[0] + '” on the chart: a pop-up shows its name and value' }]), 'A pop-up names “' + d.labels[0] + '” and shows its value, formatted (e.g. $1.2M).').area = area;
      if (cs.drill || (cs.binding && cs.binding.levels && cs.binding.levels.length > 1)) add('Charts', 'Interaction', 'Medium', 'Double-clicking “' + nm + '” drills down', go.concat([{ do: 'double_click', target: 'chart=' + nm, point: d.labels[0] }, { do: 'expect_changed', value: 'chart' }, { do: 'manual', value: 'The next level (or the records) for ' + d.labels[0] + ' shows, with a way back' }]), 'The chart shows the detail behind “' + d.labels[0] + '”.').area = area;
      add('Content', 'Content', 'Low', '“' + nm + '” has a clear title, axis labels and a source', go.concat([{ do: 'screenshot', target: 'chart=' + nm }, { do: 'manual', value: 'Title says what the chart shows; axes and legend are readable; the source and date are given' + (cs.source ? '' : ' (no source is set in Mothership)') }]), 'Title, axes, legend and source are present and readable.').area = area;
    });
    var kp = Q.kpis();
    kp.forEach(function (k) {
      var t = tabOfEl(k.el), go = t ? [{ do: 'open_tab', target: t }] : [];
      add('KPI cards', 'Data', 'High', 'KPI “' + k.label + '” shows the right value', go.concat([{ do: 'expect_text', target: 'kpi=' + k.label, value: k.value }, { do: 'manual', value: 'Check ' + k.value + ' against the source for the same period and filters' }]), '“' + k.label + '” shows ' + k.value + ', the same as the source.').area = (t ? t + ' › ' : '') + 'KPI ' + k.label;
    });
    if (kp.length && charts.length) add('KPI cards', 'Data', 'High', 'KPI cards agree with the chart totals', [{ do: 'expect_numbers' }], 'Each KPI equals the total of the charts that show the same measure.');
    (r.state.filters || []).forEach(function (f) {
      var vals = Array.from(new Set(r.getRows(f.dataset).map(function (x) { return x[f.field]; }).filter(function (v) { return v != null && v !== ''; }).map(String))).slice(0, 2);
      if (!vals.length) return;
      add('Filters', 'Interaction', 'High', 'Filtering by “' + (f.label || f.field) + '” updates the dashboard', [{ do: 'select', target: 'filter=' + (f.label || f.field), value: vals[0] }, { do: 'expect_changed', value: 'chart' }, { do: 'manual', value: 'Charts and KPI cards now show only ' + vals[0] }, { do: 'select', target: 'filter=' + (f.label || f.field), value: 'All' }], 'Charts and KPI cards change to ' + vals[0] + ' only, and go back with “All”.');
    });
    var ctl = Q.snapshot({ all: true }).controls.filter(function (x) { return x.kind === 'button' && x.name; }).slice(0, 12);
    ctl.forEach(function (b) { add('Buttons and links', 'Interaction', 'Medium', 'The “' + b.name + '” button works', [{ do: 'click', target: 'button=' + b.name }, { do: 'expect_no_errors' }, { do: 'manual', value: 'It does what its label says' }], 'Clicking it does what it says, with no errors.'); });
    var links = Q.snapshot({ all: true }).controls.filter(function (x) { return x.kind === 'link'; }).slice(0, 10);
    links.forEach(function (l) { add('Buttons and links', 'Content', 'Low', 'The “' + (l.name || l.href) + '” link goes to the right place', [{ do: 'manual', value: 'The link (' + l.href + ') opens the right page or section; it does not need the internet if the dashboard is meant to work offline' }], 'The link works.'); });
    var tbls = all('table').slice(0, 8);
    tbls.forEach(function (t, i) { var nm = norm((t.caption && t.caption.textContent) || (t.previousElementSibling && t.previousElementSibling.textContent) || 'Table ' + (i + 1)).slice(0, 40); add('Tables', 'Data', 'Medium', 'Table “' + nm + '” has headings and the right rows', (t.id ? [{ do: 'expect_visible', target: 'css=#' + t.id }] : []).concat([{ do: 'manual', value: 'Headings are clear; row totals and the grand total add up; numbers are aligned and formatted alike' }]), 'Headings, rows and totals are right.'); });
    add('Accessibility', 'Accessibility', 'Medium', 'The accessibility scan finds nothing serious', [{ do: 'expect_a11y', value: 0 }], 'Pictures have alt text, text is readable against its background, tables have headings.');
    [1366, 820, 390].forEach(function (w) { add('Screen sizes', 'Responsive', w === 390 ? 'Low' : 'Medium', 'Readable at ' + w + ' px wide (' + (w === 1366 ? 'laptop' : w === 820 ? 'tablet' : 'phone') + ')', [{ do: 'set_width', value: w }, { do: 'expect_no_overflow' }, { do: 'screenshot' }, { do: 'manual', value: 'Nothing overlaps or is cut off; charts resize' }, { do: 'set_width', value: 'auto' }], 'The page fits the width; nothing overlaps or is cut off.'); });
    add('Export', 'Export', 'Low', 'The exported file opens offline and looks the same', [{ do: 'manual', value: 'File › Export HTML, open the file with the network off: charts, tabs, filters and pop-ups all work' }], 'The exported file works offline and matches the editor.');
    add('Export', 'Export', 'Low', 'PDF and PowerPoint have one page per tab', [{ do: 'manual', value: 'Consulting › PDF and PowerPoint: one page or slide per tab, nothing cut off, firm footer present' }], 'One page or slide per tab, readable.');
    add('Edge cases', 'Data', 'Medium', 'Numbers and labels are formatted the same way everywhere', [{ do: 'manual', value: 'Currency, units (K / M / Cr), decimals and dates use one style across KPI cards, axes and pop-ups' }], 'One consistent number and date style.');
    add('Edge cases', 'Data', 'Medium', 'Zero, missing and very large values are handled', [{ do: 'manual', value: 'Where data can be zero, blank or very large: charts still draw, labels do not overlap, nothing shows NaN or undefined' }], 'No NaN, undefined, blank charts or overlapping labels.');
    if (MS.story && MS.story.steps().length) add('Storyline', 'Interaction', 'Low', 'The storyline plays through all ' + MS.story.steps().length + ' steps', [{ do: 'manual', value: 'Consulting › Play: each step lights up its part and shows its headline; arrow keys move through it' }], 'Every step shows the right part and headline.');
    return out;
  };
  Q.draft = function (o) {
    o = o || {};
    var cases = Q.generate(o), n = 0;
    edit(o.replace ? 'Draft test cases (replace)' : 'Draft test cases', function (T) {
      if (o.replace) T.cases = [];
      if (!T.title) T.title = (MS.doc ? MS.doc.name.replace(/\.html?$/i, '') : 'Dashboard') + ' test plan';
      cases.forEach(function (c) { if (!o.replace && T.cases.some(function (x) { return low(x.title) === low(c.title); })) return; c.id = nextId(T.cases); T.cases.push(clean(c)); n++; });
    });
    return n;
  };

  /* ---------------------------------------------------------------- running */
  var shots = {};
  function lastChange() { return Q._last || []; }
  function runStep(s, log) {
    var t = s.target, v = s.value;
    var pass = function (msg) { log.push({ step: Q.stepText(s), ok: true, note: msg || '' }); };
    var fail = function (msg) { log.push({ step: Q.stepText(s), ok: false, note: msg }); throw Object.assign(new Error(msg), { stepFail: true }); };
    switch (s.do) {
      case 'open_tab': return D.showTab(t || v).then(function (x) { pass('on “' + x.tab + '”'); });
      case 'click': case 'double_click': var b0 = D.state(); return D.click(t, { point: s.point, double: s.do === 'double_click' }).then(function (x) { Q._last = D.changes(b0); pass(x.changed.join('; ')); });
      case 'hover': return D.hover(t, { point: s.point }).then(function (x) { pass(x.tooltip ? 'pop-up: ' + x.tooltip.map(function (q) { return q.text; }).join(' / ') : 'no pop-up'); });
      case 'type': return D.type(t, v || '').then(function () { pass(); });
      case 'select': var b1 = D.state(); return D.select(t, v).then(function (x) { Q._last = D.changes(b1); pass('picked ' + x.selected + '; ' + Q._last.join('; ')); });
      case 'press': return D.press(v, t).then(function () { pass(); });
      case 'wait': return wait(Math.min(10000, +v || 500)).then(function () { pass(); });
      case 'set_width': return D.width(v).then(function (x) { pass('drawn at ' + x.width + ' px'); });
      case 'expect_visible': case 'expect_hidden': case 'expect_text': case 'expect_count': case 'expect_chart_drawn':
        var chk = s.do === 'expect_visible' ? { visible: true } : s.do === 'expect_hidden' ? { hidden: true } : s.do === 'expect_text' ? { text: v } : s.do === 'expect_chart_drawn' ? { chart_drawn: true } : (/^>=\s*\d+$/.test(String(v)) ? { min: +String(v).replace(/\D/g, '') } : { count: +v });
        var e = Q.expect(t, chk); return Promise.resolve(e.pass ? pass(e.actual) : fail('Expected ' + e.expected + ', got ' + e.actual));
      case 'expect_tooltip':
        return D.hover(t, { point: s.point }).then(function (x) { var txt = (x.tooltip || []).map(function (q) { return q.text; }).join(' / '); if (!txt) return fail('No pop-up appeared'); if (v && low(txt).indexOf(low(v)) < 0) return fail('The pop-up says “' + txt + '”, not “' + v + '”'); pass('pop-up: ' + txt); });
      case 'expect_changed': var ch = lastChange(); var what = low(v); var ok = ch.length && ch[0] !== 'nothing visible changed' && (!what || ch.some(function (q) { return low(q).indexOf(what) >= 0; })); return Promise.resolve(ok ? pass(ch.join('; ')) : fail('Expected a change' + (v ? ' to a ' + v : '') + ', but ' + (ch.join('; ') || 'nothing changed')));
      case 'expect_no_errors': var er = D.errors(); var n = er.scriptErrors.length + er.consoleErrors.length; return Promise.resolve(n ? fail(n + ' error(s): ' + er.scriptErrors.concat(er.consoleErrors).slice(0, 3).join(' | ')) : pass('none'));
      case 'expect_no_overflow': var de = cdoc().documentElement, over = de.scrollWidth - de.clientWidth; return Promise.resolve(over > 4 ? fail('The page is ' + over + ' px wider than the screen (a sideways scroll bar)') : pass('fits'));
      case 'expect_numbers': var res = MS.numcheck ? MS.numcheck.run() : [], diff = res.filter(function (q) { return q.status === 'diff'; }); return Promise.resolve(diff.length ? fail(diff.map(function (q) { return q.what + ' shows ' + q.shown + ' but ' + q.against + ' adds up to ' + q.expected; }).join('; ')) : pass(res.length ? res.length + ' compared, all agree' : 'nothing to compare'));
      case 'expect_a11y': var f = MS.a11y ? MS.a11y.check().filter(function (q) { return q.kind !== 'cvd'; }) : [], max = +v || 0; return Promise.resolve(f.length > max ? fail(f.length + ' finding(s): ' + f.slice(0, 3).map(function (q) { return q.msg; }).join(' | ')) : pass(f.length + ' finding(s)'));
      case 'screenshot': return Promise.resolve(pass('taken by the MCP server (ui_screenshot) when an AI runs the test'));
      default: log.push({ step: Q.stepText(s), ok: null, note: 'for a person to check' }); return Promise.resolve();
    }
  }
  Q.runCase = function (id) {
    var c = Q.get(id); if (!c) return Promise.reject(new Error('No test case ' + id));
    var log = [], chain = Promise.resolve(), was = MS.mode, width = MS.view.width, t0 = Date.now();
    D.errors(false); D._lastEl = null;
    c.steps.forEach(function (s, i) {
      chain = chain.then(function () {
        if (Q.stopping) throw Object.assign(new Error('Stopped'), { stopped: true });
        MS.emit('qa-step', { id: id, index: i, total: c.steps.length, text: stepWords(s), step: s });
        return runStep(s, log);
      });
    });
    return chain.then(function () {
      var manual = log.some(function (x) { return x.ok === null; });
      return { status: manual ? 'Needs a person' : 'Pass', log: log };
    }, function (e) {
      if (e.stopped) return { stopped: true, log: log };
      if (!e.stepFail) log.push({ step: '(error)', ok: false, note: e.message });
      return { status: 'Fail', log: log, error: e.message };
    }).then(function (res) {
      if (MS.view.width !== width) MS.view.setWidth(width, true);
      if (was !== MS.mode && was !== 'interact') MS.setMode(was);
      if (res.stopped) return { id: id, title: c.title, status: 'Stopped', steps: res.log };
      var ms = Date.now() - t0, failed = res.status === 'Fail' ? D._lastEl : null;
      var actual = res.log.map(function (x) { return (x.ok === false ? '✗ ' : x.ok ? '✓ ' : '• ') + x.step + (x.note ? ' → ' + x.note : ''); }).join('\n');
      Q.update(id, { status: res.status, actual: actual, at: new Date().toISOString(), by: 'Mothership', ms: ms }, 'Test run ' + id);
      var out = { id: id, title: c.title, status: res.status, ms: ms, steps: res.log };
      if (failed && Q.live && Q.live.evidence) return Q.live.evidence(id, failed).then(function () { return out; }, function () { return out; });
      return out;
    });
  };
  // Run cases one after another. o.onProgress is told about each case; Q.stop() ends the run after the current step.
  Q.running = null;
  Q.stop = function () { if (Q.running) { Q.stopping = true; MS.emit('qa-run', { phase: 'stopping' }); } };
  Q.run = function (ids, o) {
    o = o || {};
    if (Q.running) return Promise.reject(new Error('Tests are already running.'));
    var list = (ids && ids.length ? ids : Q.cases().map(function (c) { return c.id; })).filter(function (id) { return Q.get(id); });
    var out = [], chain = Promise.resolve(), t0 = Date.now();
    Q.stopping = false; Q.running = { ids: list, total: list.length, started: t0, results: out };
    MS.emit('qa-run', { phase: 'start', ids: list, total: list.length });
    list.forEach(function (id, i) {
      chain = chain.then(function () {
        if (Q.stopping) return;
        MS.emit('qa-run', { phase: 'case', id: id, index: i, total: list.length, title: Q.get(id).title });
        return Q.runCase(id).then(function (r) {
          if (r.status !== 'Stopped') out.push(r);
          MS.status('Testing… ' + out.length + ' of ' + list.length);
          MS.emit('qa-run', { phase: 'result', result: r, index: i, total: list.length });
        });
      });
    });
    var end = function (err) {
      var stopped = Q.stopping; Q.running = null; Q.stopping = false; MS.status('');
      var rec = { at: new Date().toISOString(), ms: Date.now() - t0, total: list.length, ran: out.length, stopped: !!stopped };
      ['Pass', 'Fail', 'Needs a person'].forEach(function (k) { rec[k === 'Needs a person' ? 'person' : k.toLowerCase()] = out.filter(function (r) { return r.status === k; }).length; });
      if (out.length) edit('Test run', function (T) { T.runs = (T.runs || []).concat([rec]).slice(-20); });
      MS.emit('qa-run', { phase: 'end', results: out, run: rec, error: err ? err.message : null });
      return rec;
    };
    return chain.then(function () { end(); return out; }, function (e) { end(e); throw e; });
  };
  Q.runs = function () { return plan().runs || []; };
  Q.failed = function () { return Q.cases().filter(function (c) { return c.status === 'Fail'; }); };
  Q.summary = function () {
    var cs = Q.cases(), by = {}; Q.STATUSES.forEach(function (s) { by[s] = 0; }); cs.forEach(function (c) { by[c.status] = (by[c.status] || 0) + 1; });
    var last = Q.runs().slice(-1)[0] || null;
    return { total: cs.length, automatic: cs.filter(function (c) { return c.auto; }).length, byStatus: by, lastRun: last };
  };

  /* ---------------------------------------------------------------- the test document */
  function md(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\n/g, '<br>'); }
  function docInfo() {
    var r = rt(), o = MS.api.outline ? MS.api.outline() : {};
    return { name: MS.doc ? MS.doc.name : 'dashboard.html', title: (MS.child && MS.child.doc.title) || '', tabs: Q.tabs().map(function (t) { return t.title; }), charts: r ? r.charts().map(function (c) { var s = Q.chartState(c.key); return s; }) : [], kpis: Q.kpis().map(function (k) { return { label: k.label, value: k.value }; }), filters: (r && r.state.filters || []).map(function (f) { return f.label || f.field; }), datasets: o.datasets || [], locale: r ? r.locale() : null };
  }
  var TOOLS = [
    ['ui_snapshot', 'See the parts of the dashboard you can act on (tabs, KPI cards, charts, buttons, drop-downs, tables), each with a ref.'],
    ['ui_tab', 'Open a tab by name.'],
    ['ui_click', 'Click a part: target = a ref, text=…, button=…, tab=…, chart=… (with point = a category to click that bar or point), kpi=…, filter=… or a CSS selector. double: true to double-click.'],
    ['ui_hover', 'Hover a part (a chart point with point = category). Returns what the pop-up says.'],
    ['ui_select', 'Pick a value in a drop-down (filters).'], ['ui_type', 'Type into a text box.'], ['ui_press', 'Press a key.'],
    ['ui_read', 'Read a part: text, value, visibility, colours, and for a chart its labels, series and totals.'],
    ['ui_expect', 'Check a part: visible, hidden, text (contains), equals, matches, count, value, enabled, chart_drawn. Returns pass, actual, expected.'],
    ['ui_wait', 'Wait for text or a part to appear or go away.'], ['ui_width', 'Draw the page at a width (1366 laptop, 820 tablet, 390 phone, auto).'],
    ['ui_errors', 'Script and console errors since the dashboard opened.'], ['ui_screenshot', 'A picture of the dashboard or one part (shown to you; saved if you give a path).'],
    ['test_plan', 'The test cases (get), or add / update / remove one.'], ['test_run', 'Run the automatic steps of some or all cases and record the results.'],
    ['test_record', 'Record your result for a case: status (Pass, Fail, Blocked, Skipped), what actually happened, notes.'], ['save_test_document', 'Save the test document with the results (Markdown, HTML, Excel or JSON).']
  ];
  Q.document = function (o) {
    o = o || {};
    var P = plan(), cs = Q.cases(), I = docInfo(), S = Q.summary(), today = new Date().toISOString().slice(0, 10);
    var scen = []; cs.forEach(function (c) { if (scen.indexOf(c.scenario) < 0) scen.push(c.scenario); });
    var L = [];
    L.push('# ' + (P.title || I.name.replace(/\.html?$/i, '') + ' test plan'));
    L.push('', '| | |', '|---|---|', '| Dashboard | ' + md(I.name) + (I.title ? ' (“' + md(I.title) + '”)' : '') + ' |', '| Date | ' + today + ' |', '| Test cases | ' + S.total + ' (' + S.automatic + ' fully automatic) |', '| Results | ' + Q.STATUSES.map(function (s) { return s + ': ' + (S.byStatus[s] || 0); }).join(' · ') + ' |', '| Prepared with | HTML Mothership ' + (MS.VERSION || '') + ' |');
    L.push('', '## 1. Purpose and scope', '', 'Check that the dashboard shows the right numbers, works when used (tabs, pop-ups, filters, drill-down, buttons), reads well on different screens, and exports correctly. In scope: everything a viewer sees and does in the dashboard file. Out of scope: the systems that produce the source data, and the network (the file works offline).');
    L.push('', '## 2. What is being tested', '');
    if (I.tabs.length) L.push('- **Tabs (' + I.tabs.length + '):** ' + I.tabs.join(', '));
    L.push('- **Charts (' + I.charts.length + '):** ' + (I.charts.map(function (c) { return c.name + ' (' + (c.kind || c.library) + (c.tab ? ', ' + c.tab : '') + ', ' + c.labels.length + ' categories)'; }).join('; ') || 'none'));
    if (I.kpis.length) L.push('- **KPI cards (' + I.kpis.length + '):** ' + I.kpis.map(function (k) { return k.label + ' = ' + k.value; }).join('; '));
    if (I.filters.length) L.push('- **Filters:** ' + I.filters.join(', '));
    if (I.datasets.length) L.push('- **Data:** ' + I.datasets.map(function (d) { return d.name + ' (' + d.rows + ' rows)'; }).join(', '));
    if (I.locale) L.push('- **Number style:** ' + I.locale.locale + ', ' + I.locale.currency);
    L.push('', '## 3. Approach', '', '- **Environment:** a desktop browser (Chrome or Edge), the dashboard opened from disk (file://), network off for the offline checks.', '- **Kinds of test:** ' + Q.TYPES.join(', ') + '.', '- **Automatic steps** are run by Mothership (Testing › Run) or by an AI assistant through the Mothership MCP server. **Manual steps** (“check by eye”) need a person or an AI looking at screenshots.', '- **Entry:** the dashboard opens. **Exit:** every High case passes; any failure is logged as a defect with steps to reproduce.', '- **Severity of defects:** Critical (wrong numbers, page does not open) · Major (a feature does not work) · Minor (looks wrong, typo) · Trivial (cosmetic).');
    L.push('', '## 4. Test cases', '');
    L.push('| ID | Scenario | Test | Type | Priority | Status |', '|---|---|---|---|---|---|');
    cs.forEach(function (c) { L.push('| ' + c.id + ' | ' + md(c.scenario) + ' | ' + md(c.title) + ' | ' + c.type + ' | ' + c.priority + ' | ' + c.status + ' |'); });
    L.push('', '## 5. Steps and expected results');
    scen.forEach(function (sc) {
      L.push('', '### ' + sc);
      cs.filter(function (c) { return c.scenario === sc; }).forEach(function (c) {
        L.push('', '#### ' + c.id + ': ' + c.title, '', '*' + c.type + ' · ' + c.priority + ' priority · ' + (c.auto ? 'automatic' : 'needs a person for some steps') + (c.area ? ' · ' + c.area : '') + '*');
        if (c.pre) L.push('', '**Before you start:** ' + c.pre);
        L.push('');
        c.steps.forEach(function (s, i) { L.push((i + 1) + '. ' + stepWords(s) + '  `' + Q.stepText(s) + '`'); });
        L.push('', '**Expected:** ' + (c.expected || '—'));
        L.push('', '**Result:** ' + c.status + (c.at ? ' (' + c.at.slice(0, 16).replace('T', ' ') + (c.by ? ', ' + c.by : '') + ')' : ''));
        if (c.actual) L.push('', '```', c.actual, '```');
        if (c.notes) L.push('', '**Notes:** ' + c.notes);
      });
    });
    L.push('', '## 6. Traceability', '', '| Area | Cases |', '|---|---|');
    var areas = {}; cs.forEach(function (c) { var a = c.area || c.scenario; (areas[a] = areas[a] || []).push(c.id); });
    Object.keys(areas).forEach(function (a) { L.push('| ' + md(a) + ' | ' + areas[a].join(', ') + ' |'); });
    L.push('', '## 7. Running these tests with an AI assistant (MCP)', '', 'Connect the assistant to the Mothership MCP server (Help › Connect an AI assistant), open this dashboard with `open_file`, then use these tools. Every step above has a tool call:', '');
    TOOLS.forEach(function (t) { L.push('- `' + t[0] + '`: ' + t[1]); });
    L.push('', '| Step | Tool call |', '|---|---|',
      '| open_tab \\| Claims | `ui_tab {"name": "Claims"}` |', '| click \\| button=Export | `ui_click {"target": "button=Export"}` |', '| hover \\| chart=Sales @ North | `ui_hover {"target": "chart=Sales", "point": "North"}` |',
      '| select \\| filter=Region \\| West | `ui_select {"target": "filter=Region", "value": "West"}` |', '| expect_text \\| kpi=Revenue \\| $1.2M | `ui_expect {"target": "kpi=Revenue", "text": "$1.2M"}` |', '| expect_chart_drawn \\| chart=Sales | `ui_expect {"target": "chart=Sales", "chart_drawn": true}` |',
      '| expect_no_errors | `ui_errors {}` (pass when both lists are empty) |', '| set_width \\| 390 | `ui_width {"width": 390}` |', '| manual \\| … | `ui_screenshot` then judge it; record with `test_record` |');
    L.push('', '## 8. Defect log', '', '| # | Test case | Severity | What happened | Steps to reproduce | Expected | Screenshot |', '|---|---|---|---|---|---|---|');
    var fails = cs.filter(function (c) { return c.status === 'Fail'; });
    if (fails.length) fails.forEach(function (c, i) { L.push('| ' + (i + 1) + ' | ' + c.id + ' | ' + (c.priority === 'High' ? 'Major' : 'Minor') + ' | ' + md((c.actual || '').split('\n').filter(function (x) { return /^✗/.test(x); }).join(' ') || c.notes || '') + ' | ' + md(c.steps.map(stepWords).join('; ')) + ' | ' + md(c.expected) + ' | |'); });
    else L.push('| | | | | | | |');
    L.push('', '## 9. Sign-off', '', '| Role | Name | Date | Decision |', '|---|---|---|---|', '| Tester | | | |', '| Dashboard owner | | | Approve / Fix first |');
    return L.join('\n') + '\n';
  };
  function stepWords(s) {
    var t = s.target ? String(s.target).replace(/^(\w+)=/, function (m, k) { return { chart: 'chart ', tab: 'tab ', kpi: 'KPI ', button: 'button ', filter: 'filter ', text: '', css: '', ref: '' }[k] || ''; }) : '';
    switch (s.do) {
      case 'open_tab': return 'Open the “' + (s.target || s.value) + '” tab.';
      case 'click': return 'Click ' + (s.point != null ? '“' + s.point + '” on ' : '') + t + '.';
      case 'double_click': return 'Double-click ' + (s.point != null ? '“' + s.point + '” on ' : '') + t + '.';
      case 'hover': return 'Hover over ' + (s.point != null ? '“' + s.point + '” on ' : '') + t + '.';
      case 'type': return 'Type “' + s.value + '” into ' + t + '.';
      case 'select': return 'In ' + t + ', pick “' + s.value + '”.';
      case 'press': return 'Press ' + s.value + '.';
      case 'wait': return 'Wait ' + s.value + ' ms.';
      case 'set_width': return s.value === 'auto' ? 'Go back to the normal width.' : 'Draw the page ' + s.value + ' px wide.';
      case 'expect_visible': return 'Check ' + t + ' is visible.';
      case 'expect_hidden': return 'Check ' + t + ' is hidden.';
      case 'expect_text': return 'Check ' + t + ' shows “' + s.value + '”.';
      case 'expect_count': return 'Check there are ' + s.value + ' of ' + t + '.';
      case 'expect_chart_drawn': return 'Check ' + t + ' draws with data.';
      case 'expect_tooltip': return 'Hover “' + s.point + '” on ' + t + ': the pop-up mentions “' + s.value + '”.';
      case 'expect_changed': return 'Check the ' + (s.value || 'page') + ' changed.';
      case 'expect_no_errors': return 'Check there are no script errors.';
      case 'expect_no_overflow': return 'Check nothing spills off the side.';
      case 'expect_numbers': return 'Check the KPI cards agree with the chart totals.';
      case 'expect_a11y': return 'Run the accessibility check: at most ' + (s.value || 0) + ' findings.';
      case 'screenshot': return 'Take a screenshot' + (t ? ' of ' + t : '') + '.';
      default: return 'Check by eye: ' + (s.value || '') + '.';
    }
  }
  Q.stepWords = stepWords;
  Q.json = function () { return { $type: 'mothership/tests', v: 1, dashboard: MS.doc ? MS.doc.name : '', at: new Date().toISOString(), title: plan().title || '', summary: Q.summary(), actions: Q.ACTIONS, cases: Q.cases() }; };
  Q.html = function () {
    var md2 = Q.document();
    return MS.lib('marked').then(function (marked) {
      var body = (marked.parse || marked)(md2);
      return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' + MS.esc(plan().title || 'Test plan') + '</title><style>body{font:14px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;max-width:1100px;margin:32px auto;padding:0 24px}h1{font-size:26px}h2{margin-top:32px;border-bottom:2px solid #4f46e5;padding-bottom:4px}h3{margin-top:24px;color:#3730a3}h4{margin:20px 0 4px}table{border-collapse:collapse;width:100%;margin:8px 0;font-size:13px}th,td{border:1px solid #e2e8f0;padding:5px 8px;text-align:left;vertical-align:top}th{background:#f1f5f9}code{background:#f1f5f9;border-radius:4px;padding:1px 5px;font-size:12px}pre{background:#0f172a;color:#e2e8f0;padding:10px 12px;border-radius:8px;white-space:pre-wrap;font-size:12px}@media print{h2{break-before:auto}pre{background:#f8fafc;color:#0f172a;border:1px solid #e2e8f0}}</style></head><body>' + body + '</body></html>';
    });
  };
  Q.xlsx = function () {
    return MS.lib('xlsx').then(function (X) {
      var rows = Q.cases().map(function (c) { return { ID: c.id, Scenario: c.scenario, 'Test case': c.title, Type: c.type, Priority: c.priority, 'Before you start': c.pre || '', Steps: c.steps.map(function (s, i) { return (i + 1) + '. ' + stepWords(s); }).join('\n'), 'Expected result': c.expected, Status: c.status, 'Actual result': c.actual || '', Notes: c.notes || '', 'Tested by': c.by || '', Date: (c.at || '').slice(0, 10), Automatic: c.auto ? 'Yes' : 'No' }; });
      var wb = X.utils.book_new(), ws = X.utils.json_to_sheet(rows.length ? rows : [{ ID: '', 'Test case': 'No test cases yet' }]);
      ws['!cols'] = [8, 16, 40, 12, 9, 24, 60, 40, 12, 50, 30, 14, 11, 10].map(function (w) { return { wch: w }; });
      X.utils.book_append_sheet(wb, ws, 'Test cases');
      var S = Q.summary(), sum = [{ Item: 'Dashboard', Value: MS.doc ? MS.doc.name : '' }, { Item: 'Test cases', Value: S.total }, { Item: 'Automatic', Value: S.automatic }].concat(Q.STATUSES.map(function (s) { return { Item: s, Value: S.byStatus[s] || 0 }; }));
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(sum), 'Summary');
      var steps = Object.keys(Q.ACTIONS).map(function (k) { return { Step: k, Meaning: Q.ACTIONS[k] }; });
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(steps), 'Step words');
      return X.write(wb, { type: 'array', bookType: 'xlsx' });
    });
  };
  // A prompt for another AI to test the dashboard (with or without the MCP server).
  Q.prompt = function (o) {
    o = o || {};
    var mcp = o.mcp !== false;
    var head = ['You are a meticulous QA tester for a business dashboard (an HTML file). Test it against the test plan below and report results.', '',
      mcp ? 'You are connected to the Mothership MCP server, which has the dashboard open. Work like Playwright: call ui_snapshot to see the parts and their refs, act with ui_tab / ui_click / ui_hover / ui_select / ui_type / ui_press, check with ui_expect / ui_read / ui_errors, and take ui_screenshot for anything you must judge by eye (and for every failure). Run the automatic cases first with test_run, then do the "check by eye" steps yourself. Record every result with test_record {id, status, actual, notes}: status is Pass, Fail, Blocked or Skipped. Do not edit the dashboard. Finish with save_test_document {format: "markdown"}.'
        : 'You cannot click the dashboard yourself, so for each test case give the person running it precise steps and what to look for, and then a table they can fill in with the result.',
      '', 'Rules: report what you actually saw, not what you expect; give each failure a severity (Critical: wrong numbers or does not open · Major: a feature does not work · Minor: looks wrong · Trivial: cosmetic) and steps to reproduce; suggest new test cases if you spot risks the plan misses (add them with test_plan action add).', '', '---', ''];
    return head.join('\n') + Q.document();
  };

  // A prompt built from what failed, to hand to an AI: find the cause, fix it (or the test), test again.
  // o.mcp: the AI has the Mothership MCP tools · o.goal: 'fix' (default) | 'retest' · o.person: include "Needs a person" cases
  Q.failPrompt = function (o) {
    o = o || {};
    var mcp = o.mcp !== false, goal = o.goal === 'retest' ? 'retest' : 'fix';
    var I = docInfo(), fails = Q.failed(), people = o.person === false ? [] : Q.cases().filter(function (c) { return c.status === 'Needs a person'; });
    var last = Q.runs().slice(-1)[0], S = Q.summary();
    var L = [];
    if (!fails.length && !people.length) return 'Every test case of ' + I.name + ' passed' + (S.byStatus['Not run'] ? ' (' + S.byStatus['Not run'] + ' not run yet)' : '') + '. Nothing to fix.\n';
    L.push('You are a senior front-end developer and QA engineer. A business dashboard (one HTML file, "' + I.name + '") was tested with HTML Mothership' + (last ? ' on ' + last.at.slice(0, 16).replace('T', ' ') : '') + '. ' + fails.length + ' test case' + (fails.length === 1 ? '' : 's') + ' failed' + (people.length ? ' and ' + people.length + ' need a person to check by eye' : '') + '. Details are below.', '');
    L.push('## Your task', '');
    if (mcp) {
      L.push('You are connected to the Mothership MCP server, which has the dashboard open.', '');
      L.push('1. For each failed case, run it again with `test_run {"ids": ["<id>"]}` to see if it still fails.');
      L.push('2. Investigate on screen: `ui_snapshot` to see the parts and refs, `ui_read` / `ui_expect` to check values, `ui_hover` for pop-ups, `ui_errors` for script errors, and `ui_screenshot` to look at it.');
      L.push('3. Decide which it is: **a bug in the dashboard**, **a wrong or out-of-date test** (e.g. it looks for text that was renamed), or **cannot reproduce**.');
      if (goal === 'fix') L.push('4. Fix it. A dashboard bug: change the dashboard with the Mothership tools (`set_text`, `set_style`, `chart_settings`, `set_chart_data`, `replace_text`, …; `outline` and `get_element` show what is there), never by hand-editing the file. A wrong test: correct it with `test_plan {"action": "update", "id": …, "case": …}` and say why.', '5. Run the case again until it passes, then record the result with `test_record` (status, what actually happened, and in notes: cause and fix).');
      else L.push('4. Do not change the dashboard. Record what you found with `test_record` (status, what actually happened, and in notes: the likely cause, severity and steps to reproduce).');
      if (people.length) L.push((goal === 'fix' ? '6' : '5') + '. For the "needs a person" cases, look with `ui_screenshot`, judge them, and record Pass or Fail with `test_record`.');
      L.push('', 'Finish with `save_test_document {"format": "markdown"}` and a short report.');
    } else {
      L.push('You cannot run the dashboard yourself. The dashboard file is attached (or pasted below the test details). For each failed case:', '');
      L.push('1. Find the most likely cause in the HTML, CSS or JavaScript, quoting the exact lines.', '2. Say whether it is **a bug in the dashboard** or **a wrong or out-of-date test**.');
      L.push(goal === 'fix' ? '3. Give the exact change: the code before and after, small and safe. Do not rewrite unrelated parts.' : '3. Describe how a person can confirm it, step by step, and what they should see.');
      if (people.length) L.push('4. For the "needs a person" cases, give a short checklist a person can follow, with what good looks like.');
    }
    L.push('', 'Report as a table: | Case | Verdict (dashboard bug / test is wrong / cannot reproduce) | Cause | ' + (goal === 'fix' ? 'Fix' : 'How to confirm') + ' | Severity (Critical, Major, Minor, Trivial) | Result after retest |', 'Report only what you actually checked. If something cannot be done, say so plainly.', '');
    L.push('## The dashboard', '', '- File: ' + I.name + (I.title ? ' (“' + I.title + '”)' : ''));
    if (I.tabs.length) L.push('- Tabs: ' + I.tabs.join(', '));
    if (I.charts.length) L.push('- Charts: ' + I.charts.map(function (c) { return c.name + (c.tab ? ' (' + c.tab + ')' : ''); }).join(', '));
    if (I.kpis.length) L.push('- KPI cards: ' + I.kpis.map(function (k) { return k.label + ' = ' + k.value; }).join('; '));
    if (I.filters.length) L.push('- Filters: ' + I.filters.join(', '));
    L.push('- Results: ' + Q.STATUSES.filter(function (s) { return S.byStatus[s]; }).map(function (s) { return s + ' ' + S.byStatus[s]; }).join(' · '));
    function caseBlock(c, failed) {
      L.push('', '### ' + c.id + ': ' + c.title, '', '*' + c.scenario + ' · ' + c.type + ' · ' + c.priority + ' priority' + (c.area ? ' · ' + c.area : '') + '*', '');
      if (c.pre) L.push('Before you start: ' + c.pre, '');
      var lines = (c.actual || '').split('\n'), byStep = {};
      lines.forEach(function (l) { var m = /^([✓✗•]) (.*?)(?: → (.*))?$/.exec(l); if (m) byStep[m[2]] = { mark: m[1], note: m[3] || '' }; });
      L.push('Steps:');
      c.steps.forEach(function (st, i) {
        var r = byStep[Q.stepText(st)], tail = '';
        if (r) tail = r.mark === '✗' ? '  **✗ FAILED: ' + r.note + '**' : r.mark === '✓' ? '  ✓' + (r.note ? ' (' + r.note + ')' : '') : '  • ' + (r.note || 'check by eye');
        else if (failed && lines.some(function (l) { return /^✗/.test(l); })) tail = '  (not reached)';
        L.push((i + 1) + '. ' + stepWords(st) + '  `' + Q.stepText(st) + '`' + tail);
      });
      var err = lines.filter(function (l) { return /^✗ \(error\)/.test(l); });
      if (err.length) L.push('', 'Error: ' + err.join(' ').replace(/^✗ \(error\) → /, ''));
      L.push('', 'Expected: ' + (c.expected || '—'));
      if (c.notes) L.push('', 'Notes: ' + c.notes);
    }
    if (fails.length) { L.push('', '## Failed (' + fails.length + ')'); fails.sort(function (a, b) { return Q.PRIORITIES.indexOf(a.priority) - Q.PRIORITIES.indexOf(b.priority); }).forEach(function (c) { caseBlock(c, true); }); }
    if (people.length) { L.push('', '## Needs a person (' + people.length + ')'); people.forEach(function (c) { caseBlock(c, false); }); }
    if (mcp) L.push('', '## Tools', '', TOOLS.map(function (t) { return '- `' + t[0] + '`: ' + t[1]; }).join('\n'));
    return L.join('\n') + '\n';
  };

  /* ================================================================ the Testing window */
  var STATUS_CLS = { 'Pass': 'ok', 'Fail': 'bad', 'Blocked': 'warn', 'Skipped': '', 'Needs a person': 'info', 'Not run': '' };
  Q.dialog = function (o) {
    o = o || {};
    if (!rt()) return MS.toast('Turn off Safe mode to plan tests.', 'warn');
    var body = h('div', { 'class': 'qa' }), list = h('div', { 'class': 'qa-list' }), stats = h('div', { 'class': 'qa-stats' });
    var filt = { text: '', status: o.status || '' }, live = Q.live;
    var search = h('input', { 'class': 'inp', placeholder: 'Find a test…' }); search.addEventListener('input', function () { filt.text = low(search.value); draw(); });
    // The run log: failed steps shown, the rest folded away.
    function logOf(c) {
      var lines = c.actual.split('\n'), bad = lines.filter(function (l) { return /^✗/.test(l); });
      var when = c.at ? ' · ' + c.at.slice(0, 16).replace('T', ' ') + (c.by ? ' by ' + c.by : '') : '';
      var pic = live && live.evid[c.id];
      return h('div', {}, bad.map(function (l) { return h('div', { 'class': 'qa-bad', text: l.replace(/^✗\s*/, '') }); }).concat([
        pic && c.status === 'Fail' ? h('button', { 'class': 'qa-shot', title: 'What the failed step was looking at. Click to copy the picture.', onclick: function () { copyPic(pic); } }, [h('img', { src: pic, alt: 'Picture of the part that failed' })]) : null,
        h('details', { 'class': 'qa-log' }, [h('summary', { text: 'Run log: ' + lines.length + ' step' + (lines.length === 1 ? '' : 's') + when }), h('pre', { 'class': 'qa-actual', text: c.actual })])]));
    }
    function copyPic(url) {
      var bin = atob(url.split(',')[1]), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      var blob = new Blob([u], { type: 'image/png' });
      Promise.resolve().then(function () { return navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]); })
        .then(function () { MS.toast('Picture copied.', 'ok'); }, function () { MS.download('test-failure.png', url); });
    }
    function setFilter(s) { filt.status = filt.status === s ? '' : s; draw(); }
    function head() {
      var S = Q.summary(), by = S.byStatus, ran = S.total - (by['Not run'] || 0);
      var lr = S.lastRun, tr = live && live.trend();
      var chips = h('div', { 'class': 'qa-chips' }, Q.STATUSES.filter(function (s) { return by[s]; }).map(function (s) {
        return h('button', { 'class': 'qa-chip ' + (STATUS_CLS[s] || '') + (filt.status === s ? ' on' : ''), title: filt.status === s ? 'Show all' : 'Show only "' + s + '"', onclick: function () { setFilter(s); } }, [h('i', { 'class': 'qa-sw', style: 'background:' + (live ? live.COLORS[s] : '') }), s + ' ', h('b', { text: String(by[s]) })]);
      }));
      return h('div', { 'class': 'qa-sum' }, [
        live ? live.ring(by, 76, [h('b', { text: ran ? Math.round((by.Pass || 0) / ran * 100) + '%' : '–' }), h('small', { text: ran ? 'passed' : 'not run' })]) : null,
        h('div', { 'class': 'grow' }, [
          h('div', { 'class': 'qa-total' }, [h('b', { text: S.total + ' test case' + (S.total === 1 ? '' : 's') }), ' · ' + S.automatic + ' automatic' + (lr ? ' · last run ' + lr.at.slice(0, 16).replace('T', ' ') + ', ' + live.secs(lr.ms) : '')]),
          chips]),
        tr ? h('div', { 'class': 'qa-trend-box' }, [tr, h('small', { 'class': 'muted', text: 'Pass rate by run' })]) : null]);
    }
    function draw() {
      var S = Q.summary(); stats.innerHTML = '';
      if (S.total) stats.appendChild(head());
      var fails = S.byStatus.Fail || 0, people = S.byStatus['Needs a person'] || 0;
      fixBtns.forEach(function (b) { b.style.display = fails || people ? '' : 'none'; });
      rerun.style.display = fails ? '' : 'none';
      list.innerHTML = '';
      var cs = Q.cases().filter(function (c) { return (!filt.status || c.status === filt.status) && (!filt.text || low(c.id + ' ' + c.title + ' ' + c.scenario + ' ' + c.type).indexOf(filt.text) >= 0); });
      if (!Q.cases().length) { list.appendChild(h('div', { 'class': 'qa-empty' }, [h('div', { 'class': 'qa-empty-ic' }, ['☑']), h('b', { text: 'No test cases yet.' }), h('p', { 'class': 'muted', text: 'Let Mothership draft a full set from this dashboard (tabs, charts, KPI cards, filters, buttons, screen sizes, accessibility, export), then edit them, or add your own.' }), h('button', { 'class': 'btn primary', onclick: function () { var n = Q.draft(); MS.toast(n + ' test cases drafted.', 'ok'); draw(); } }, ['✨ Draft test cases'])])); return; }
      if (!cs.length) { list.appendChild(h('div', { 'class': 'qa-empty' }, [h('p', { 'class': 'muted', text: 'No test case matches.' }), h('button', { 'class': 'btn sm', onclick: function () { filt.status = ''; filt.text = ''; search.value = ''; draw(); } }, ['Show all'])])); return; }
      var groups = []; cs.forEach(function (c) { if (groups.indexOf(c.scenario) < 0) groups.push(c.scenario); });
      groups.forEach(function (g) {
        var inG = cs.filter(function (c) { return c.scenario === g; }), gp = inG.filter(function (c) { return c.status === 'Pass'; }).length, gf = inG.filter(function (c) { return c.status === 'Fail'; }).length;
        list.appendChild(h('div', { 'class': 'qa-group' }, [h('span', { text: g }), h('span', { 'class': 'qa-gcount' + (gf ? ' bad' : gp === inG.length ? ' ok' : ''), text: gp + '/' + inG.length })]));
        inG.forEach(function (c) {
          var st = h('select', { 'class': 'inp sm qa-st ' + (STATUS_CLS[c.status] || ''), title: 'Result' }, Q.STATUSES.map(function (s) { return h('option', { value: s, text: s, selected: s === c.status }); }));
          st.addEventListener('change', function () { Q.record(c.id, { status: st.value, by: 'Me' }); draw(); });
          var row = h('div', { 'class': 'qa-row st-' + (STATUS_CLS[c.status] || 'none') + (c.status === 'Fail' ? ' fail' : '') }, [
            h('span', { 'class': 'qa-id', text: c.id }),
            h('div', { 'class': 'grow' }, [h('div', { 'class': 'qa-title', text: c.title }), h('div', { 'class': 'qa-meta' }, [h('span', { text: c.type }), h('span', { 'class': 'qa-pri ' + low(c.priority), text: c.priority }), h('span', { text: c.steps.length + ' step' + (c.steps.length === 1 ? '' : 's') + (c.auto ? ' · automatic' : ' · some by eye') }), c.ms ? h('span', { 'class': 'qa-ms', title: 'How long the last run took', text: live ? live.secs(c.ms) : c.ms + ' ms' }) : null]),
              c.actual ? logOf(c) : null]),
            st,
            h('button', { 'class': 'icon-btn qa-play', title: 'Run this case (you can watch it)', onclick: function () { if (live) live.start([c.id]); } }, ['▶']),
            h('button', { 'class': 'icon-btn', title: 'Edit', onclick: function () { Q.editDialog(c).then(draw); } }, ['✎']),
            h('button', { 'class': 'icon-btn', title: 'Delete', onclick: function () { Q.remove(c.id); draw(); } }, ['🗑'])]);
          list.appendChild(row);
        });
      });
    }
    var fixBtns = [h('button', { 'class': 'btn sm qa-fix', title: 'A prompt for an AI assistant, built from the failed cases: find the cause, fix it, test again', onclick: function () { if (live) live.promptDialog(); } }, ['✨ Prompt from failures'])];
    var rerun = h('button', { 'class': 'btn sm', title: 'Run only the cases that failed', onclick: function () { if (live) live.start(Q.failed().map(function (x) { return x.id; })); } }, ['↻ Rerun failed']);
    var tools = h('div', { 'class': 'row gap wrap qa-tools' }, [search, h('span', { 'class': 'grow' }),
      h('button', { 'class': 'btn sm', onclick: function () { var n = Q.draft(); MS.toast(n ? n + ' new test case(s) drafted.' : 'Every drafted case is already in the plan.', n ? 'ok' : ''); draw(); } }, ['✨ Draft']),
      h('button', { 'class': 'btn sm', onclick: function () { Q.editDialog(null).then(draw); } }, ['＋ Add case']),
      fixBtns[0], rerun,
      h('button', { 'class': 'btn sm', onclick: function (e) { MS.menu(e.currentTarget, Q.exportItems()); } }, ['⬇ Export']),
      h('button', { 'class': 'btn sm primary', title: 'Run every case. The window closes so you can watch the steps on the dashboard.', onclick: function () { if (live) live.start(); } }, ['▶ Run all'])]);
    body.appendChild(tools); body.appendChild(stats); body.appendChild(list);
    draw();
    var off = MS.on('tests', function () { if (body.isConnected) draw(); });
    MS.dialog({ title: '☑ Test cases', sub: 'Plan, run and record tests of this dashboard. Automatic steps run here while you watch; “check by eye” steps need a person, or an AI through the MCP server. Export a full test document, or a prompt built from what failed.', wide: true, enterSubmits: false, body: body, buttons: [{ label: 'Close', primary: true, value: null }] }).then(function () { if (typeof off === 'function') off(); });
  };
  Q.exportItems = function () {
    var base = (MS.doc ? MS.doc.name.replace(/\.html?$/i, '') : 'dashboard') + ' - test plan';
    return [
      { icon: '📝', label: 'Test document (Markdown)', run: function () { MS.download(base + '.md', Q.document(), 'text/markdown;charset=utf-8'); } },
      { icon: '📄', label: 'Test document (HTML, prints to PDF)', run: function () { Q.html().then(function (x) { MS.download(base + '.html', x); }); } },
      { icon: '📗', label: 'Test cases (Excel)', run: function () { Q.xlsx().then(function (b) { MS.download(base + '.xlsx', new Blob([b], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); }); } },
      { icon: '⬇', label: 'Test cases (JSON)', run: function () { MS.download(base + '.json', JSON.stringify(Q.json(), null, 2), 'application/json'); } },
      '-',
      { icon: '🤖', label: 'Copy a prompt for an AI tester (with MCP)', run: function () { MS.copyText(Q.prompt({ mcp: true })).then(function () { MS.toast('Copied. Paste it into an AI assistant that is connected to the Mothership MCP server.', 'ok', 6000); }); } },
      { icon: '✨', label: 'Copy a prompt for an AI tester (no MCP)', run: function () { MS.copyText(Q.prompt({ mcp: false })).then(function () { MS.toast('Copied. Paste it into any AI assistant; it will give you step-by-step instructions.', 'ok', 6000); }); } },
      { icon: '🐞', label: 'Prompt from failed tests…', run: function () { if (Q.live) Q.live.promptDialog(); } }
    ];
  };
  Q.editDialog = function (c) {
    var isNew = !c; c = c || { scenario: 'General', type: 'Interaction', priority: 'Medium', steps: [], expected: '' };
    var f = MS.form([
      { key: 'title', label: 'Test case', value: c.title || '', placeholder: 'e.g. Filtering by Region updates every chart' },
      { key: 'scenario', label: 'Scenario', value: c.scenario || 'General' },
      { key: 'type', label: 'Type', type: 'select', options: Q.TYPES.map(function (x) { return { value: x, label: x }; }), value: c.type },
      { key: 'priority', label: 'Priority', type: 'select', options: Q.PRIORITIES.map(function (x) { return { value: x, label: x }; }), value: c.priority },
      { key: 'pre', label: 'Before you start (optional)', value: c.pre || '' },
      { key: 'steps', label: 'Steps: one per line, “step | target | value”', type: 'textarea', rows: 7, value: (c.steps || []).map(Q.stepText).join('\n') },
      { key: 'expected', label: 'Expected result', type: 'textarea', rows: 2, value: c.expected || '' },
      { key: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: c.notes || '' }
    ]);
    var help = h('details', { 'class': 'qa-help' }, [h('summary', { text: 'Step words' }), h('div', { 'class': 'small muted' }, Object.keys(Q.ACTIONS).map(function (k) { return h('div', {}, [h('code', { text: k }), ' ' + Q.ACTIONS[k]]); }).concat([h('p', { text: 'Targets: text=…, button=…, tab=…, chart=… (add “@ North” to point at a bar), kpi=…, filter=…, a ref from the snapshot, or a CSS selector. Anything else is a "manual" step for a person.' })]))]);
    return MS.dialog({ title: isNew ? '＋ New test case' : '✎ ' + c.id, wide: true, enterSubmits: false, body: h('div', {}, [f, help]),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Save', primary: true, value: function () { var v = f.values(); if (!v.title.trim()) { MS.dialogError('Give the test case a name.'); return false; } return v; } }] }).then(function (v) {
      if (!v) return;
      var x = { title: v.title, scenario: v.scenario, type: v.type, priority: v.priority, pre: v.pre, steps: Q.parseSteps(v.steps), expected: v.expected, notes: v.notes };
      if (isNew) Q.add(x); else Q.update(c.id, x);
    });
  };

  /* ================================================================ API (and the MCP tools) */
  var api = MS.api.add;
  api('ui_snapshot', { d: 'Testing: see the dashboard like a tester. Tabs, headings, KPI cards, charts (categories, series), buttons, links, drop-downs, text boxes and tables on screen, each with a ref to use as a target. all: true includes parts on other tabs. Switches to Interact mode.', p: { all: ['boolean', 'Include parts that are not on screen'] },
    f: function (a) { D.interact(); return Q.snapshot({ all: !!a.all }); } });
  api('ui_tab', { d: 'Testing: open one of the dashboard\'s tabs by name.', p: { name: ['string', 'Tab name', true] }, f: function (a) { D.interact(); return D.showTab(a.name); } });
  var TGT = ['string', 'What to act on: a ref from ui_snapshot, text=…, button=…, link=…, tab=…, chart=…, kpi=…, filter=…, or a CSS selector', true];
  api('ui_click', { d: 'Testing: click a part as a viewer would (scrolls to it, checks it is visible, enabled and not covered, then sends real mouse events). For a chart, point = a category clicks that bar or point. Returns what changed on screen.', p: { target: TGT, point: ['string', 'A chart category to click (e.g. "North")'], series: ['number', 'Which series (0 = first)'], double: ['boolean', 'Double-click (e.g. drill-down)'], force: ['boolean', 'Click even if something covers it'] },
    f: function (a) { return D.click(a.target, { point: a.point, series: a.series, double: !!a.double, force: !!a.force }); } });
  api('ui_hover', { d: 'Testing: hover over a part (for a chart, point = a category). Returns what the pop-up shows.', p: { target: TGT, point: ['string', 'A chart category'], series: ['number', 'Which series'] }, f: function (a) { return D.hover(a.target, { point: a.point, series: a.series }); } });
  api('ui_type', { d: 'Testing: type into a text box (replaces what is there unless clear is false).', p: { target: TGT, text: ['string', 'What to type', true], clear: ['boolean', 'Replace the current text (default true)'], enter: ['boolean', 'Press Enter afterwards'] }, f: function (a) { return D.type(a.target, a.text, { clear: a.clear, enter: a.enter }); } });
  api('ui_select', { d: 'Testing: pick a value in a drop-down (e.g. a filter). Returns what changed.', p: { target: TGT, value: ['string', 'Option text or value', true] }, f: function (a) { var b = D.state(); return D.select(a.target, a.value).then(function (x) { x.changed = D.changes(b); return x; }); } });
  api('ui_press', { d: 'Testing: press a key (Enter, Escape, ArrowRight, Tab, a letter…), on a part or on what has the focus.', p: { key: ['string', 'Key name', true], target: ['string', 'Optional part to press it on'] }, f: function (a) { return D.press(a.key, a.target); } });
  api('ui_scroll', { d: 'Testing: scroll a part into view, or the page to a position.', p: { target: ['string', 'Part to scroll to'], y: ['number', 'Or a position in px from the top'] }, f: function (a) { return D.scroll(a.target, a.y); } });
  api('ui_wait', { d: 'Testing: wait until text or a part appears (or, with gone, disappears).', p: { text: ['string', 'Text to wait for'], target: ['string', 'Or a part'], gone: ['boolean', 'Wait for it to go away'], timeout: ['number', 'ms (default 5000)'] }, f: function (a) { return D.waitFor(a); } });
  api('ui_read', { d: 'Testing: read a part: its text, value, options, link, whether it is visible and enabled, size, colours and font; for a chart its categories, series, values and totals.', p: { target: TGT }, f: function (a) { return D.read(a.target); } });
  api('ui_expect', { d: 'Testing: check a part. Give one check: visible, hidden, text (contains), equals, matches (pattern), count / min / max (how many match), value, enabled, chart_drawn. Returns {pass, actual, expected}.', p: { target: TGT, visible: ['boolean', ''], hidden: ['boolean', ''], text: ['string', 'Contains this text'], equals: ['string', 'Exactly this text'], matches: ['string', 'A pattern'], count: ['number', 'Exactly this many'], min: ['number', 'At least'], max: ['number', 'At most'], value: ['string', 'Input or drop-down value'], enabled: ['boolean', ''], chart_drawn: ['boolean', 'The chart drew with data'] },
    f: function (a) { var c = {}; ['visible', 'hidden', 'text', 'equals', 'matches', 'count', 'min', 'max', 'value', 'enabled', 'chart_drawn'].forEach(function (k) { if (a[k] != null) c[k] = a[k]; }); return Q.expect(a.target, c); } });
  api('ui_errors', { d: 'Testing: script errors and console errors since the dashboard opened (clear: true to start counting again).', p: { clear: ['boolean', 'Clear the lists after reading'] }, f: function (a) { return D.errors(!!a.clear); } });
  api('ui_width', { d: 'Testing: draw the dashboard at a width in px (1366 laptop, 820 tablet, 390 phone) or "auto". Returns how far the page spills off the side (0 = fits).', p: { width: ['string', 'px or auto', true] }, f: function (a) { return D.width(a.width); } });
  api('ui_locate', { d: 'Testing: where a part is in the editor window (for real mouse input and screenshots).', p: { target: TGT, point: ['string', 'A chart category'], series: ['number', ''], interact: ['boolean', 'Switch to Interact mode and remember the screen, for ui_after'] }, f: function (a) { return D.locate(a.target, { point: a.point, series: a.series, interact: !!a.interact }); } });
  api('ui_after', { d: 'Testing: after real mouse input (the MCP ui_mouse tool), what changed since ui_locate and what pop-up shows.', p: {}, f: function () { var m = D._mark || {}; return { changed: m.before ? D.changes(m.before) : [], tooltip: D.tooltip(m.el) }; } });
  api('test_plan', { d: 'Testing: the test plan. action: get (default) | draft (Mothership writes test cases from the dashboard; replace: true starts over) | add | update | remove | clear. A case: {title, scenario, type (' + Q.TYPES.join(', ') + '), priority (High, Medium, Low), pre, steps: [{do, target, value, point}], expected}. Step "do" words: ' + Object.keys(Q.ACTIONS).join(', ') + '.', p: { action: ['string', 'get | draft | add | update | remove | clear'], case: ['object', 'For add / update'], id: ['string', 'For update / remove'], replace: ['boolean', 'For draft: replace the existing cases'] },
    f: function (a) {
      var act = a.action || 'get';
      if (act === 'draft') { var n = Q.draft({ replace: !!a.replace }); return { added: n, summary: Q.summary(), cases: Q.cases() }; }
      if (act === 'add') return Q.add(a['case'] || {});
      if (act === 'update') return Q.update(a.id, a['case'] || {});
      if (act === 'remove') { Q.remove(a.id); return { removed: a.id }; }
      if (act === 'clear') { Q.clear(); return { cleared: true }; }
      return { title: plan().title || '', summary: Q.summary(), actions: Q.ACTIONS, cases: Q.cases() };
    } });
  api('test_run', { d: 'Testing: run test cases (all, or the ids given). Automatic steps run; “manual” steps are left for you and the case is marked "Needs a person". Records each result in the plan.', p: { ids: ['array', 'Test case ids (default: all)'] }, f: function (a) { return Q.run(a.ids).then(function (res) { return { summary: Q.summary(), results: res }; }); } });
  api('test_record', { d: 'Testing: record the result of a test case: status (Pass, Fail, Blocked, Skipped, Needs a person, Not run), what actually happened, notes, who tested.', p: { id: ['string', 'Test case id', true], status: ['string', 'Pass | Fail | Blocked | Skipped', true], actual: ['string', 'What actually happened'], notes: ['string', 'Notes, defect details, severity'], by: ['string', 'Tester'] }, f: function (a) { return Q.record(a.id, a); } });
  api('test_document', { d: 'Testing: the full test document (purpose, scope, what is tested, approach, test cases with steps and expected results, results, traceability, MCP how-to, defect log, sign-off). format: markdown (default) | html | json | xlsx (base64) | prompt (a prompt for an AI tester) | failures (a prompt built from the failed cases: find the cause, fix, test again).', p: { format: ['string', 'markdown | html | json | xlsx | prompt | failures'], mcp: ['boolean', 'For prompt / failures: the AI has the MCP tools (default true)'], goal: ['string', 'For failures: fix (default) or retest (find the cause only)'], person: ['boolean', 'For failures: include the "needs a person" cases (default true)'] },
    f: function (a) {
      var f = a.format || 'markdown', base = (MS.doc ? MS.doc.name.replace(/\.html?$/i, '') : 'dashboard') + ' - test plan';
      if (f === 'html') return Q.html().then(function (x) { return { name: base + '.html', text: x }; });
      if (f === 'json') return { name: base + '.json', text: JSON.stringify(Q.json(), null, 2) };
      if (f === 'prompt') return { name: base + ' - AI tester prompt.md', text: Q.prompt({ mcp: a.mcp !== false }) };
      if (f === 'failures') return { name: base + ' - fix the failures prompt.md', text: Q.failPrompt({ mcp: a.mcp !== false, goal: a.goal, person: a.person }), failed: Q.failed().map(function (c) { return c.id; }) };
      if (f === 'xlsx') return Q.xlsx().then(function (b) { var s = '', u = new Uint8Array(b); for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return { name: base + '.xlsx', b64: btoa(s) }; });
      return { name: base + '.md', text: Q.document() };
    } });
})(window.MS);
