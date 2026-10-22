/* Review comments: pin a comment on an element, a screen area, or something you just did
   (an interaction), then turn all of them into one ready-to-paste prompt for an AI assistant. */
(function (MS) {
  'use strict';
  var h = MS.h;
  var R = MS.review = { picking: null, showPins: MS.prefs.get('showPins', true) };
  var TYPES = [{ value: 'change', label: 'Change request' }, { value: 'bug', label: 'Something is wrong' }, { value: 'question', label: 'Question' }, { value: 'idea', label: 'Idea / nice to have' }];
  var PRIOS = [{ value: 'must', label: 'Must fix' }, { value: 'should', label: 'Should fix' }, { value: 'nice', label: 'Nice to have' }];
  var KIND_ICON = { element: '📍', area: '▭', interaction: '⚡' };

  function rt() { return MS.rt(); }
  function list() { var r = rt(); return (r && r.state.comments) || []; }
  R.list = list;
  function cdoc() { return MS.child && MS.child.doc; }
  function clip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  /* ---------------------------------------------------------- describing things in plain English */
  function tabOf(el) {
    var r = rt(), sec = el && el.closest && el.closest('section.ms-tab');
    // the dashboard's own tabs are the more specific answer
    if (MS.pageTabs) {
      var pt = el ? MS.pageTabs.of(el) : (!r || !r.layoutEnabled() ? MS.pageTabs.active() : null);
      if (pt) return { id: 'page:' + pt.index, title: pt.title, page: true };
    }
    if (sec) return { id: sec.getAttribute('data-ms-tab'), title: sec.getAttribute('data-ms-title') };
    if (r && r.layoutEnabled()) { var t = r.tabs().filter(function (x) { return x.id === r.activeTab; })[0]; if (t && !(el && el.closest && el.closest('.ms-page-footer'))) return { id: t.id, title: t.title }; }
    return null;
  }
  function sectionOf(el) {
    var s = el.closest && el.closest('.ms-section'); if (s) { var hh = s.querySelector('h2'); if (hh) return clip(hh.textContent, 60); }
    var b = el.closest && el.closest('.ms-block'); if (b && b !== el) { var t = b.querySelector('.ms-title'); if (t && t.textContent.trim()) return clip(t.textContent, 60); }
    return '';
  }
  R.describe = function (el) {
    var r = rt(), c = r && r.chartOf(el.classList && el.classList.contains('ms-block') ? (el.querySelector('.ms-visual') || el) : el);
    if (c && (el.contains(c.el) || c.el.contains(el) || el === c.el)) { var info = r.chartInfo(c.key) || {}; return { what: 'chart “' + MS.charts.nameOf(c.key) + '” (' + MS.charts.kindName(info.type).toLowerCase() + ')', chart: { key: c.key, name: MS.charts.nameOf(c.key), kind: MS.charts.kindName(info.type), lib: c.lib, labels: (info.labels || []).slice(0, 12), series: info.series } }; }
    var kpi = el.closest('.ms-kpi'); if (kpi) return { what: 'KPI card “' + clip(kpi.querySelector('.ms-kpi-label') && kpi.querySelector('.ms-kpi-label').textContent, 40) + '” (shows ' + clip(kpi.querySelector('.ms-kpi-value') && kpi.querySelector('.ms-kpi-value').textContent, 20) + ')' };
    if (el.closest('.ms-page-footer')) return { what: 'page footer “' + clip(el.textContent, 60) + '”' };
    if (el.closest('#ms-filter-pane')) return { what: 'filter pane' + (el.tagName === 'SELECT' || el.closest('.ms-filter') ? ' › filter “' + clip((el.closest('.ms-filter') || el).querySelector('span') && (el.closest('.ms-filter') || el).querySelector('span').textContent, 30) + '”' : '') };
    if (el.closest('#ms-ribbon')) return { what: 'tab bar (ribbon)' + (el.closest('.ms-tabbtn') ? ' › tab “' + clip(el.textContent, 30) + '”' : '') };
    var t = el.tagName.toLowerCase(), txt = clip(el.innerText || el.textContent, 70);
    var names = { h1: 'main heading', h2: 'heading', h3: 'heading', h4: 'heading', p: 'paragraph', button: 'button', a: 'link', img: 'image', table: 'table', select: 'drop-down', input: 'input box', li: 'list item', ul: 'list', ol: 'list', header: 'header', footer: 'footer', nav: 'navigation bar', svg: 'graphic' };
    if (el.classList.contains('ms-block')) return { what: 'block “' + clip(el.querySelector('.ms-title') && el.querySelector('.ms-title').textContent, 50) + '”' };
    if (el.classList.contains('ms-title')) return { what: 'chart/block title “' + txt + '”' };
    if (el.classList.contains('ms-sub')) return { what: 'subtitle “' + txt + '”' };
    if (el.classList.contains('ms-inf')) return { what: 'inference line “' + txt + '”' };
    if (el.classList.contains('ms-banner')) return { what: 'page header “' + txt + '”' };
    if (t === 'img') return { what: 'image' + (el.alt ? ' “' + clip(el.alt, 40) + '”' : '') };
    if (t === 'table') return { what: 'table (' + el.rows.length + ' rows)' + (txt ? ' starting “' + clip(txt, 40) + '”' : '') };
    var cn = typeof el.className === 'string' ? el.className : '', hint = /label|caption/i.test(cn) ? 'label' : /value|amount|number|figure|metric/i.test(cn) ? 'value' : /title|head/i.test(cn) ? 'title' : /legend/i.test(cn) ? 'legend' : /note|foot|source/i.test(cn) ? 'note' : /kpi|card|tile|stat/i.test(cn) ? 'card' : /chart|plot|graph/i.test(cn) ? 'chart area' : /badge|tag|pill|chip/i.test(cn) ? 'badge' : '';
    return { what: (names[t] || hint || (t === 'span' ? 'text' : 'box')) + (txt ? ' “' + txt + '”' : '') };
  };
  // A CSS selector a developer (or an AI) can use to find the element in the file.
  function cssPath(el) {
    if (el.id && !/^ms-/.test(el.id)) return '#' + el.id;
    var parts = [], n = el;
    while (n && n.nodeType === 1 && !/^(BODY|HTML)$/.test(n.tagName) && parts.length < 6) {
      if (n.id && !/^ms-/.test(n.id)) { parts.unshift('#' + n.id); break; }
      var cls = Array.prototype.filter.call(n.classList, function (c) { return !/^ms-(sel|hover|editing|flash|cmt|active|in-grid)/.test(c); }).slice(0, 2);
      var p = n.tagName.toLowerCase() + (cls.length ? '.' + cls.join('.') : '');
      var sib = n.parentElement ? Array.prototype.filter.call(n.parentElement.children, function (x) { return x.tagName === n.tagName; }) : [];
      if (sib.length > 1) p += ':nth-of-type(' + (sib.indexOf(n) + 1) + ')';
      parts.unshift(p); n = n.parentElement;
    }
    return parts.join(' > ');
  }
  function refOf(el) {
    var id = el.getAttribute('data-ms-id');
    if (id) return '[data-ms-id="' + id + '"]';
    var ref = el.getAttribute('data-ms-ref');
    if (!ref) { ref = rt() ? rt().uid('r') : String(Date.now()); el.setAttribute('data-ms-ref', ref); }
    return '[data-ms-ref="' + ref + '"]';
  }
  function findRef(sel) { var d = cdoc(); try { return sel && d ? d.querySelector(sel) : null; } catch (e) { return null; } }
  R.findRef = findRef; R.cssPath = cssPath; R.tabOf = tabOf; R.clip = clip;

  /* ---------------------------------------------------------- interaction log (Interact mode and presenting) */
  var log = [], lastHover = null, hoverT = 0;
  function note(text) {
    var last = log[log.length - 1];
    if (last && last.text === text && Date.now() - last.t < 4000) return;
    log.push({ text: text, t: Date.now() });
    if (log.length > 40) log.shift();
  }
  R.log = function () { return log.slice(); };
  function recording() { return MS.mode === 'interact' || (MS.present && MS.present.on); }
  function labelFor(el) {
    var l = el.closest('label'); if (l) { var sp = l.querySelector('span'); return clip((sp || l).textContent, 40); }
    if (el.id) { var lb = cdoc().querySelector('label[for="' + el.id + '"]'); if (lb) return clip(lb.textContent, 40); }
    return el.getAttribute('aria-label') || el.name || el.id || 'a control';
  }
  function tipText(c) {
    try {
      if (c.lib === 'chartjs') { var tt = c.inst.tooltip; if (tt && tt.opacity && tt.body) return clip([].concat(tt.title || []).join(' ') + ' ' + tt.body.map(function (b) { return b.lines.join(' '); }).join(' · '), 160); }
      if (c.lib === 'echarts') { var dv = Array.prototype.filter.call(c.el.querySelectorAll('div'), function (d) { return /z-index:\s*9999999/.test(d.getAttribute('style') || '') && d.style.display !== 'none' && d.style.opacity !== '0'; })[0]; if (dv) return clip(dv.textContent, 160); }
      if (c.lib === 'plotly') { var hl = c.el.querySelector('.hoverlayer'); if (hl && hl.textContent.trim()) return clip(hl.textContent, 160); }
      if (c.lib === 'highcharts') { var ht = MS.$$('.highcharts-tooltip', c.el).map(function (x) { return x.textContent.trim(); }).filter(Boolean).join(' '); if (ht && c.inst.tooltip && !c.inst.tooltip.isHidden) return clip(ht, 160); }
      if (c.lib === 'd3') { var tp = cdoc().querySelector('.ms-hovertip'); if (tp && tp.style.display !== 'none' && tp.textContent) return clip(tp.textContent, 160); }
    } catch (e) {}
    return '';
  }
  function pointLabel(c, e) {
    try {
      if (c.lib === 'chartjs') { var p = c.inst.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false)[0]; if (p) return String(c.inst.data.labels[p.index]); }
      if (c.lib === 'plotly' && c.el._hoverdata && c.el._hoverdata[0]) { var q = c.el._hoverdata[0]; return String(q.label != null ? q.label : q.x); }
      if (c.lib === 'highcharts' && c.inst.hoverPoint) { var hp = c.inst.hoverPoint; return String(hp.name != null ? hp.name : hp.category); }
      if (c.lib === 'd3' && e && e.target && e.target.__data__) { var ms = c.a.marks(c.el), j = ms.indexOf(e.target); if (j >= 0) return c.a.labelOf(e.target.__data__, j); }
    } catch (x) {}
    return '';
  }
  function attachLog(c) {
    var d = c.doc, w = c.win;
    d.addEventListener('click', function (e) {
      if (!recording() || R.picking) return;
      var t = e.target, r = rt();
      var tab = t.closest && t.closest('#ms-ribbon .ms-tabbtn'); if (tab) return note('Opened the “' + clip(tab.textContent, 40) + '” tab');
      if (t.closest('.ms-crumb')) return note('Clicked “' + clip(t.textContent, 30) + '” in a chart\'s breadcrumb to go back up');
      if (t.closest('.ms-pane-reset')) return note('Reset all filters');
      var c2 = r && r.chartOf(t);
      if (c2 && (c2.el === t || c2.el.contains(t))) { var pl = pointLabel(c2, e); return note('Clicked ' + (pl ? '“' + pl + '” on ' : '') + 'chart “' + MS.charts.nameOf(c2.key) + '”'); }
      var b = t.closest('button,a,[role="button"],[role="tab"],summary');
      if (b) note('Clicked ' + (b.tagName === 'A' ? 'link' : 'button') + ' “' + clip(b.textContent || b.getAttribute('aria-label'), 40) + '”');
    }, true);
    d.addEventListener('change', function (e) {
      if (!recording()) return;
      var t = e.target; if (!/^(SELECT|INPUT|TEXTAREA)$/.test(t.tagName)) return;
      var v = t.tagName === 'SELECT' ? (t.selectedOptions[0] ? t.selectedOptions[0].textContent : t.value) : t.type === 'checkbox' ? (t.checked ? 'ticked' : 'unticked') : t.value;
      note((t.closest('#ms-filter-pane') ? 'Set filter “' : 'Changed “') + labelFor(t) + '” to “' + clip(v, 40) + '”');
    }, true);
    d.addEventListener('dblclick', function (e) {
      if (!recording()) return;
      var r = rt(), c2 = r && r.chartOf(e.target); if (!c2) return;
      var before = JSON.stringify(r.drill[c2.key] || []), pl = pointLabel(c2, e);
      setTimeout(function () {
        var path = r.drill[c2.key] || [], name = MS.charts.nameOf(c2.key), modal = d.querySelector('.ms-modal-wrap');
        if (JSON.stringify(path) !== before && path.length) note('Double-clicked “' + path[path.length - 1].value + '” on “' + name + '” and it drilled down (now showing ' + path.map(function (p) { return p.field + ' = ' + p.value; }).join(' › ') + ')');
        else if (modal) note('Double-clicked ' + (pl ? '“' + pl + '” on ' : '') + '“' + name + '” and it opened the records table');
        else note('Double-clicked ' + (pl ? '“' + pl + '” on ' : '') + '“' + name + '” (nothing happened)');
      }, 120);
    }, true);
    d.addEventListener('mousemove', function (e) {
      if (!recording() || Date.now() - hoverT < 250) return;
      hoverT = Date.now();
      var r = rt(), c2 = r && r.chartOf(e.target);
      if (!c2 || !(c2.el === e.target || c2.el.contains(e.target))) return;
      setTimeout(function () {
        var tip = tipText(c2), pl = pointLabel(c2, e);
        lastHover = { key: c2.key, name: MS.charts.nameOf(c2.key), label: pl, tip: tip, t: Date.now() };
        note('Hovered over “' + lastHover.name + '”' + (pl ? ' at “' + pl + '”' : ''));
      }, 60);
    }, true);
    w.addEventListener('ms:tab', function (e) { if (recording()) note('Opened the “' + e.detail.title + '” tab'); });
  }
  function snapshot() {
    var r = rt(), out = {};
    if (!r) return out;
    var t = tabOf(null); if (t) out.tab = t.title;
    var f = [];
    Object.keys(r.filterValues || {}).forEach(function (ds) { var fv = r.filterValues[ds]; Object.keys(fv).forEach(function (k) { if (fv[k] !== '' && fv[k] != null) f.push(k + ' = ' + fv[k]); }); });
    // the page's own filter controls
    MS.$$('select', cdoc()).forEach(function (s) { if (s.closest('#ms-filter-pane') || s.offsetParent === null || s.selectedIndex <= 0) return; f.push(labelFor(s) + ' = ' + (s.selectedOptions[0] ? s.selectedOptions[0].textContent : s.value)); });
    if (f.length) out.filters = f;
    var dr = [];
    Object.keys(r.drill || {}).forEach(function (k) { var p = r.drill[k]; if (p && p.length && r.chart(k)) dr.push('“' + MS.charts.nameOf(k) + '”: ' + p.map(function (x) { return x.field + ' = ' + x.value; }).join(' › ')); });
    if (dr.length) out.drill = dr;
    if (lastHover && Date.now() - lastHover.t < 120000) out.hover = lastHover;
    return out;
  }

  /* ---------------------------------------------------------- Comment mode: click to comment on a thing, drag to comment on an area */
  var PICK_CSS = 'body.ms-comment-mode,body.ms-comment-mode *{cursor:crosshair!important}' +
    'body.ms-comment-mode .ms-cmt-pass,body.ms-comment-mode .ms-cmt-pass *{cursor:pointer!important}' +
    '.ms-cmt-hover{outline:2px solid #f59e0b!important;outline-offset:2px}' +
    '#ms-cmt-layer{position:fixed;left:0;top:0;width:0;height:0;z-index:99990;pointer-events:none}' +
    '#ms-cmt-layer>*{position:fixed;box-sizing:border-box}' +
    '.ms-cmt-pin{min-width:22px;height:22px;padding:0 5px;border-radius:11px 11px 11px 2px;background:#f59e0b;color:#111;font:700 12px/22px system-ui,sans-serif;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer!important;pointer-events:auto;transform:translate(-4px,-18px)}' +
    '.ms-cmt-pin.done{background:#9ca3af}' +
    '.ms-cmt-pin.cur{background:#2563eb;color:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.35),0 2px 6px rgba(0,0,0,.3)}' +
    '.ms-cmt-area{border:2px dashed #f59e0b;background:rgba(245,158,11,.08);border-radius:4px}' +
    '.ms-cmt-area.done{border-color:#9ca3af;background:none}' +
    '.ms-cmt-area.cur,.ms-cmt-box.cur{border:2px solid #2563eb;background:rgba(37,99,235,.08);border-radius:4px}' +
    '.ms-cmt-area.pending,.ms-cmt-box.pending{border:2px dashed #2563eb;background:rgba(37,99,235,.10);border-radius:4px}' +
    '#ms-cmt-rect{position:fixed;border:2px dashed #2563eb;background:rgba(37,99,235,.10);pointer-events:none;z-index:99999}';
  function ensureCss() {
    var d = cdoc(); if (!d || d.getElementById('ms-cmt-css')) return;
    var st = d.createElement('style'); st.id = 'ms-cmt-css'; st.setAttribute('data-ms-editor', ''); st.textContent = PICK_CSS; d.head.appendChild(st);
  }
  function commenting() { return MS.mode === 'comment' && !(MS.present && MS.present.on); }
  R.cancel = function () {
    var d = cdoc(); R.picking = null;
    if (!d) return;
    MS.$$('.ms-cmt-hover', d).forEach(function (n) { n.classList.remove('ms-cmt-hover'); });
    var n = d.getElementById('ms-cmt-rect'); if (n) n.remove();
  };
  function pickTarget(t) {
    if (!t || t.nodeType !== 1 || /^(HTML|BODY)$/.test(t.tagName) || t.closest('#ms-cmt-layer')) return null;
    var p = MS.edit.pick(t) || t;
    if (p.id === 'ms-app' || p.id === 'ms-main' || p.id === 'ms-body' || p.classList.contains('ms-tab')) return null;
    return p;
  }
  // things that keep working in Comment mode: the dashboard's tabs, the tab ribbon, breadcrumbs, pop-up tables and the pins themselves
  function passThrough(t) {
    if (!t || t.nodeType !== 1) return false;
    if (t.closest('#ms-cmt-layer,#ms-ribbon .ms-tabbtn,.ms-crumbs button,.ms-modal-wrap,.ms-pane-reset')) return true;
    var r = rt(), pt = r && r.pageTabOf ? r.pageTabOf(t) : null;
    return !!(pt && (pt.btn === t || pt.btn.contains(t)));
  }
  R.start = function (kind) {
    if (!MS.child) return MS.toast('Open a dashboard first.', 'warn');
    if (!rt()) return MS.toast('Comments need the dashboard\'s scripts. Turn off Safe mode (View tab).', 'warn');
    R.cancel();
    if (kind === 'interaction') return R.addInteraction();
    if (kind === 'element' && MS.mode === 'edit' && MS.sel) return R.addElement(MS.sel);
    MS.setMode('comment');
    MS.toast(kind === 'area' ? 'Drag a box around the area you want to comment on.' : 'Click the part you want to comment on, or drag a box around an area.', '', 4000);
  };
  function attachPicker(c) {
    var d = c.doc, w = c.win, hov = null, start = null, rect = null, eat = false;
    var unhover = function () { if (hov) hov.classList.remove('ms-cmt-hover'); hov = null; };
    w.addEventListener('mouseover', function (e) {
      if (!commenting() || start) return;
      unhover();
      if (passThrough(e.target)) return;
      hov = pickTarget(e.target); if (hov) hov.classList.add('ms-cmt-hover');
    }, true);
    w.addEventListener('mousedown', function (e) {
      if (!commenting() || e.button !== 0 || passThrough(e.target)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      start = { x: e.clientX, y: e.clientY, t: e.target };
    }, true);
    w.addEventListener('mousemove', function (e) {
      if (!start) return;
      if (!rect && Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) < 8) return;
      if (!rect) { unhover(); ensureCss(); rect = d.createElement('div'); rect.id = 'ms-cmt-rect'; rect.setAttribute('data-ms-editor', ''); d.body.appendChild(rect); }
      rect.style.left = Math.min(start.x, e.clientX) + 'px'; rect.style.top = Math.min(start.y, e.clientY) + 'px';
      rect.style.width = Math.abs(e.clientX - start.x) + 'px'; rect.style.height = Math.abs(e.clientY - start.y) + 'px';
    }, true);
    w.addEventListener('mouseup', function (e) {
      if (!start) return;
      var s = start; start = null;
      if (!rect) return;
      e.preventDefault(); e.stopImmediatePropagation(); eat = true; setTimeout(function () { eat = false; }, 0);
      var r = { left: Math.min(s.x, e.clientX), top: Math.min(s.y, e.clientY), w: Math.abs(e.clientX - s.x), h: Math.abs(e.clientY - s.y) };
      rect.remove(); rect = null;
      if (r.w < 12 || r.h < 12) return MS.toast('That box was too small. Drag a bigger box, or just click an item.', 'warn');
      R.addArea(r);
    }, true);
    w.addEventListener('click', function (e) {
      if (!commenting() || passThrough(e.target)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (eat) return;
      var t = pickTarget(e.target); unhover(); if (t) R.addElement(t, e);
    }, true);
    w.addEventListener('dblclick', function (e) { if (commenting() && !passThrough(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
    d.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !commenting()) return;
      e.stopPropagation();
      if (R.draft) R.discard(); else MS.setMode('edit');
    }, true);
    // pins follow the content however it scrolls: the window, or a panel with its own scroll bar
    d.addEventListener('scroll', pinsNow, true);
    w.addEventListener('resize', pinsNow);
  }

  /* ---------------------------------------------------------- anchoring an area to the content under it */
  function isScroller(n) {
    if (!n || n.nodeType !== 1 || n === cdoc().documentElement || n === cdoc().body) return false;
    var cs = MS.child.win.getComputedStyle(n);
    return /(auto|scroll|overlay)/.test(cs.overflowY + ' ' + cs.overflowX) && (n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1);
  }
  // where (0,0) of an element's content is on screen now
  function originOf(n) {
    var b = n.getBoundingClientRect(), sc = isScroller(n);
    return { x: b.left - (sc ? n.scrollLeft : 0), y: b.top - (sc ? n.scrollTop : 0) };
  }
  function shown(n) { return n === cdoc().documentElement || (n.isConnected && n.getClientRects().length > 0); }
  // the visible window onto an element: the screen, cut down by every scrolling or clipping box around it
  function clipOf(n, self) {
    var w = MS.child.win, c = { l: 0, t: 0, r: w.innerWidth, b: w.innerHeight };
    for (var p = self ? n : n.parentElement; p && p.nodeType === 1 && p !== cdoc().body && p !== cdoc().documentElement; p = p.parentElement) {
      var cs = w.getComputedStyle(p);
      if (!/(auto|scroll|hidden|clip|overlay)/.test(cs.overflowX + ' ' + cs.overflowY)) continue;
      var b = p.getBoundingClientRect();
      c = { l: Math.max(c.l, b.left), t: Math.max(c.t, b.top), r: Math.min(c.r, b.right), b: Math.min(c.b, b.bottom) };
    }
    return c;
  }
  function anchorFor(r) {
    var d = cdoc(), layer = d.getElementById('ms-cmt-layer'), x2 = r.left + r.w, y2 = r.top + r.h;
    if (layer) layer.style.display = 'none';
    var pts = [[r.left + 3, r.top + 3], [x2 - 3, r.top + 3], [r.left + 3, y2 - 3], [x2 - 3, y2 - 3], [r.left + r.w / 2, r.top + r.h / 2]];
    var els = pts.map(function (p) { return d.elementFromPoint(p[0], p[1]); }).filter(Boolean);
    if (layer) layer.style.display = '';
    var a = els[0] || d.documentElement;
    els.forEach(function (e) { while (a && !a.contains(e)) a = a.parentElement; });
    if (!a || a === d.body || a.closest('[data-ms-editor]')) a = d.documentElement;
    var o = originOf(a);
    return { el: a, ref: a === d.documentElement ? 'html' : refOf(a), dx: Math.round(r.left - o.x), dy: Math.round(r.top - o.y) };
  }
  function onTab(c) {
    var t = c.tab, r = rt(); if (!t || !t.id) return true;
    if (String(t.id).indexOf('page:') === 0) { var a = MS.pageTabs.active(); return !a || a.title === t.title; }
    return !r.layoutEnabled() || t.id === r.activeTab;
  }
  // where a comment is on screen now: {box:{l,t,w,h}, clip} or null when it is out of sight
  R.placeOf = function (c) {
    var w = MS.child.win, el, b, clip;
    if (c.kind === 'element' && c.target) {
      el = findRef(c.target.ref); if (!el || !shown(el)) return null;
      var rr = el.getBoundingClientRect(); b = { l: rr.left, t: rr.top, w: rr.width, h: rr.height }; clip = clipOf(el);
    } else if (c.kind === 'area' && c.area) {
      var an = c.area.anchor;
      if (an) {
        el = findRef(an.ref); if (!el || !shown(el)) return null;
        if (el === cdoc().documentElement && !onTab(c)) return null;
        var o = originOf(el); b = { l: o.x + an.dx, t: o.y + an.dy, w: c.area.w, h: c.area.h }; clip = clipOf(el, true);
      } else {
        if (!onTab(c)) return null;
        b = { l: c.area.x - w.scrollX, t: c.area.y - w.scrollY, w: c.area.w, h: c.area.h }; clip = clipOf(cdoc().body);
      }
    } else return null;
    if (b.l + b.w < clip.l || b.l > clip.r || b.t + b.h < clip.t || b.t > clip.b) return null;
    return { box: b, clip: clip };
  };

  /* ---------------------------------------------------------- pins in the dashboard (a fixed layer, redrawn as you scroll) */
  R.renderPins = function () {
    var d = cdoc(), r = rt(); if (!d || !d.body) return;
    ensureCss();
    var layer = d.getElementById('ms-cmt-layer');
    if (!layer) { layer = d.createElement('div'); layer.id = 'ms-cmt-layer'; layer.setAttribute('data-ms-editor', ''); d.body.appendChild(layer); }
    layer.innerHTML = '';
    if (!r) return;
    var draw = function (c, label, cls, withBox) {
      var p = R.placeOf(c); if (!p) return;
      var b = p.box, k = p.clip;
      if (withBox) {
        var box = d.createElement('div'); box.className = cls;
        box.style.left = b.l + 'px'; box.style.top = b.t + 'px'; box.style.width = b.w + 'px'; box.style.height = b.h + 'px';
        var it = Math.max(0, k.t - b.t), ir = Math.max(0, b.l + b.w - k.r), ib = Math.max(0, b.t + b.h - k.b), il = Math.max(0, k.l - b.l);
        if (it || ir || ib || il) box.style.clipPath = 'inset(' + it + 'px ' + ir + 'px ' + ib + 'px ' + il + 'px)';
        layer.appendChild(box);
      }
      if (label == null) return;
      var px = c.kind === 'element' ? Math.min(b.l + b.w, k.r) - 12 : Math.max(b.l, k.l) + 2, py = Math.max(b.t, k.t) + (c.kind === 'element' ? 4 : 2);
      if (py > k.b - 4 || px < k.l - 4 || px > k.r) return;
      var pin = d.createElement('div'); pin.className = 'ms-cmt-pin' + (c.done ? ' done' : '') + (c.id === R.current ? ' cur' : '');
      pin.textContent = label; pin.title = clip(c.text, 140) + (c.replies && c.replies.length ? ' (' + c.replies.length + ' repl' + (c.replies.length === 1 ? 'y' : 'ies') + ')' : '');
      pin.style.left = px + 'px'; pin.style.top = py + 'px';
      pin.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); R.select(c.id, false); });
      pin.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      layer.appendChild(pin);
    };
    if (R.showPins) list().forEach(function (c, i) {
      if (c.done && R.filter === 'open' && c.id !== R.current) return;
      var cur = c.id === R.current;
      draw(c, String(i + 1), c.kind === 'area' ? 'ms-cmt-area' + (c.done ? ' done' : '') + (cur ? ' cur' : '') : 'ms-cmt-box' + (cur ? ' cur' : ''), c.kind === 'area' || cur);
    });
    if (R.draft) draw(R.draft.c, null, c0kind(R.draft.c) + ' pending', true);
  };
  function c0kind(c) { return c.kind === 'area' ? 'ms-cmt-area' : 'ms-cmt-box'; }
  var raf = 0;
  function pinsNow() { if (raf) return; raf = (MS.child.win.requestAnimationFrame || setTimeout)(function () { raf = 0; R.renderPins(); }); }
  R.togglePins = function () { R.showPins = !R.showPins; MS.prefs.set('showPins', R.showPins); R.renderPins(); MS.ribbon.render(); };

  /* ---------------------------------------------------------- making a comment (the composer lives in the Comments pane) */
  function save(c, label) {
    MS.history.state(label || 'Comment', function (s) {
      s.comments = s.comments || [];
      var i = s.comments.map(function (x) { return x.id; }).indexOf(c.id);
      if (i >= 0) s.comments[i] = JSON.parse(JSON.stringify(c)); else s.comments.push(JSON.parse(JSON.stringify(c)));
    });
    MS.emit('comments');
  }
  function patch(id, label, fn) {
    MS.history.state(label, function (s) { (s.comments || []).forEach(function (c) { if (c.id === id) fn(c); }); });
    MS.emit('comments');
  }
  function author() { return MS.prefs.get('author', '') || ''; }
  // @mentions in a comment ("@AK", "@Priya") and the initials of a name, for assigning comments
  R.mentions = function (text) { var out = [], m, re = /(^|[\s(,])@([A-Za-z][\w.-]{0,30})/g; while ((m = re.exec(String(text || '')))) if (out.indexOf(m[2]) < 0) out.push(m[2].replace(/[.-]+$/, '')); return out; };
  R.initials = function (name) { var p = String(name || '').trim().split(/\s+/).filter(Boolean); return p.length > 1 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (p[0] || '').slice(0, 2).toUpperCase(); };
  // is this comment for me? (assigned to my name, first name or initials, or mentions them)
  R.forMe = function (c, me) {
    me = me == null ? author() : me; if (!me) return false;
    var keys = [me, me.split(/\s+/)[0], R.initials(me)].map(function (x) { return String(x).toLowerCase(); });
    var who = [c.to].concat(c.mentions || []).concat((c.replies || []).reduce(function (a, y) { return a.concat(R.mentions(y.text)); }, [])).filter(Boolean).map(function (x) { return String(x).toLowerCase(); });
    return who.some(function (w) { return keys.indexOf(w) >= 0; });
  };
  R.assign = function (id, who) { patch(id, who ? 'Assign comment to ' + who : 'Unassign comment', function (x) { if (who) x.to = String(who).trim(); else delete x.to; }); };
  function base(kind) { var t = tabOf(null); return { id: rt().uid('m'), kind: kind, created: new Date().toISOString(), by: author(), tab: t, type: 'change', prio: 'should', replies: [] }; }
  function ctxBox(lines) { return h('div', { 'class': 'cmt-ctx' }, lines.filter(Boolean).map(function (l) { return h('div', { html: l }); })); }
  R.compose = function (c, ctx, extra, done) {
    R.draft = { c: c, ctx: ctx, extra: extra, done: done };
    R.showPane(true); R.renderPane(); R.renderPins();
    setTimeout(function () { var t = MS.$('#cmt-pane .cmt-draft textarea'); if (t) t.focus(); }, 30);
  };
  R.discard = function () { R.draft = null; R.renderPane(); R.renderPins(); };

  R.addElement = function (el, e) {
    var d = R.describe(el), c = base('element'), t = tabOf(el);
    c.tab = t; c.target = { what: d.what, ref: refOf(el), css: cssPath(el), section: sectionOf(el), chart: d.chart, html: clip(el.outerHTML, 300) };
    if (R.locate) c.loc = R.locate(el);
    if (d.chart && e) { var cc = rt().chart(d.chart.key); var pl = cc && pointLabel(cc, e); if (pl) c.target.point = pl; }
    R.compose(c, ['<b>On:</b> ' + MS.esc(d.what) + (c.target.point ? ' at “' + MS.esc(c.target.point) + '”' : ''), '<b>Where:</b> ' + MS.esc(c.loc ? R.trail(c.loc) : [t && 'Tab “' + t.title + '”', c.target.section].filter(Boolean).join(' › ') || 'the page')]);
  };
  R.addArea = function (r) {
    var w = MS.child.win, d = cdoc(), c = base('area');
    var an = anchorFor(r);
    c.area = { x: Math.round(r.left + w.scrollX), y: Math.round(r.top + w.scrollY), w: Math.round(r.w), h: Math.round(r.h), vw: w.innerWidth, vh: w.innerHeight, tab: c.tab && c.tab.id, anchor: { ref: an.ref, dx: an.dx, dy: an.dy } };
    var inside = [], seen = [];
    var within = function (b) { var ix = Math.max(0, Math.min(b.right, r.left + r.w) - Math.max(b.left, r.left)), iy = Math.max(0, Math.min(b.bottom, r.top + r.h) - Math.max(b.top, r.top)); return b.width * b.height > 0 && ix * iy / (b.width * b.height) > 0.6; };
    (rt().charts() || []).forEach(function (ch) { if (ch.el.offsetParent !== null && within(ch.el.getBoundingClientRect())) { inside.push(R.describe(ch.el).what); seen.push(ch.el); } });
    MS.$$('h1,h2,h3,h4,.ms-title,.ms-kpi,p,li,button,table,img,select,label,.ms-callout', d).forEach(function (n) {
      if (inside.length >= 12 || n.offsetParent === null || n.closest('[data-ms-editor]') || seen.some(function (s) { return s.contains(n) || n.contains(s); })) return;
      if (within(n.getBoundingClientRect())) { inside.push(R.describe(n).what); seen.push(n); }
    });
    c.inside = inside;
    var at = an.el !== d.documentElement ? tabOf(an.el) : null; if (at) { c.tab = at; c.area.tab = at.id; }
    if (R.locateArea) c.loc = R.locateArea(r, seen);
    R.compose(c, ['<b>Area:</b> ' + c.area.w + ' × ' + c.area.h + ' px' + (c.tab ? ' on the “' + MS.esc(c.tab.title) + '” tab' : ''),
      inside.length ? '<b>Inside it:</b> ' + inside.slice(0, 6).map(function (x) { return MS.esc(x); }).join('; ') : '<i>Nothing recognisable inside the box (maybe empty space).</i>']);
  };
  R.addInteraction = function () {
    if (!MS.child || !rt()) return MS.toast('Open a dashboard first.', 'warn');
    var steps = log.slice(-10), snap = snapshot(), c = base('interaction');
    var checks = steps.map(function (s, i) { return { s: s, cb: h('input', { type: 'checkbox', checked: i >= steps.length - 4 }) }; });
    var stepsBox = checks.length ? h('div', { 'class': 'list' }, checks.map(function (k) { return h('label', { 'class': 'list-row' }, [k.cb, h('span', { 'class': 'grow', text: k.s.text }), h('small', { 'class': 'muted', text: ago(k.s.t) })]); }))
      : h('p', { 'class': 'muted small', text: 'Nothing recorded yet. Switch to Interact mode (top), use the dashboard (tabs, filters, hovering, double-clicking), then come back here.' });
    var stateLines = [snap.tab ? '<b>Tab:</b> ' + MS.esc(snap.tab) : '', snap.filters ? '<b>Filters:</b> ' + MS.esc(snap.filters.join(', ')) : '', snap.drill ? '<b>Drill-down:</b> ' + MS.esc(snap.drill.join('; ')) : '',
      snap.hover ? '<b>Last pop-up:</b> ' + MS.esc(snap.hover.name) + (snap.hover.tip ? ' showed “' + MS.esc(snap.hover.tip) + '”' : '') : ''];
    var extra = h('div', {}, [h('div', { 'class': 'small strong', text: 'What you did (tick the steps that matter)' }), stepsBox]);
    R.compose(c, stateLines.some(Boolean) ? stateLines : ['<i>Default view: no filters or drill-down.</i>'], extra, function (c) {
      c.steps = checks.filter(function (k) { return k.cb.checked; }).map(function (k) { return k.s.text; });
      c.state = { tab: snap.tab, filters: snap.filters, drill: snap.drill, popup: snap.hover ? { chart: snap.hover.name, at: snap.hover.label, text: snap.hover.tip } : undefined };
    });
  };
  function byId(id) { return list().filter(function (x) { return x.id === id; })[0]; }
  R.edit = function (id) { if (!byId(id)) return; R.editing = id; R.select(id, true); };
  R.goTo = function (id) {
    var c = byId(id); if (!c) return;
    var r = rt(), t = c.tab;
    if (t && t.id) {
      if (String(t.id).indexOf('page:') === 0) { if (!onTab(c)) MS.pageTabs.show(t.title); }
      else if (r.layoutEnabled() && r.activeTab !== t.id) r.showTab(t.id);
    }
    setTimeout(function () {
      var el = c.kind === 'element' ? findRef(c.target.ref) : c.kind === 'area' && c.area.anchor ? findRef(c.area.anchor.ref) : null;
      if (c.kind === 'element') { if (!el) return MS.toast('That item is no longer in the dashboard.', 'warn'); MS.edit.reveal(el, false); }
      else if (c.kind === 'area') {
        if (el && el !== cdoc().documentElement) {
          MS.edit.reveal(el, false);
          // bring the box itself into view inside whatever scrolls
          setTimeout(function () { var p = R.placeOf(c); if (!p) { var s = el; while (s && !isScroller(s)) s = s.parentElement; var y = originOf(el).y + c.area.anchor.dy; if (s) s.scrollTop += y - s.getBoundingClientRect().top - 60; else MS.child.win.scrollBy(0, y - 80); } R.renderPins(); }, 80);
        } else if (el) MS.child.win.scrollTo({ top: Math.max(0, c.area.anchor.dy - 80) });
        else MS.child.win.scrollTo({ top: Math.max(0, c.area.y - 80), behavior: 'smooth' });
      }
      R.renderPins();
    }, 60);
  };
  // pick a comment: highlight its pin, show its card, and (from the pane) go to it in the dashboard
  R.select = function (id, go) {
    R.current = id; R.showPane(true); R.renderPane(); R.renderPins();
    if (go) R.goTo(id);
    setTimeout(function () { var card = MS.$('#cmt-pane .cmt-card.cur'); if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest' }); }, 20);
  };
  R.resolve = function (id) { var c = byId(id); if (c) patch(id, c.done ? 'Re-open comment' : 'Resolve comment', function (x) { x.done = !x.done; x.doneAt = x.done ? new Date().toISOString() : undefined; }); };
  R.remove = function (id) { MS.history.state('Delete comment', function (s) { s.comments = s.comments.filter(function (x) { return x.id !== id; }); }); if (R.current === id) R.current = null; MS.emit('comments'); };
  R.reply = function (id, text) { if (!String(text || '').trim()) return; patch(id, 'Reply to comment', function (x) { (x.replies = x.replies || []).push({ id: rt().uid('y'), text: String(text).trim(), by: author(), at: new Date().toISOString() }); var m = R.mentions(text); if (m.length) { x.mentions = (x.mentions || []).concat(m.filter(function (k) { return (x.mentions || []).indexOf(k) < 0; })); if (!x.to) x.to = m[0]; } }); };
  R.clear = function () {
    if (!list().length) return;
    MS.confirm('Delete all ' + list().length + ' comments?', 'You can undo this with Ctrl+Z.', 'Delete all', true).then(function (ok) {
      if (ok) { MS.history.state('Delete all comments', function (s) { s.comments = []; }); R.current = null; MS.emit('comments'); }
    });
  };

  /* ---------------------------------------------------------- the Comments pane (right side, like PowerPoint) */
  function ago(t) {
    var x = Math.round((Date.now() - (typeof t === 'number' ? t : Date.parse(t))) / 1000);
    if (!(x >= 0)) return '';
    return x < 45 ? 'just now' : x < 3600 ? Math.round(x / 60) + ' min ago' : x < 86400 ? Math.round(x / 3600) + ' h ago' : new Date(Date.now() - x * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  R.filter = MS.prefs.get('cmtFilter', 'open');
  R.showPane = function (on) {
    var host = MS.$('#cmt-pane'), ins = MS.$('#inspector'); if (!host || !ins) return;
    if (on && document.body.classList.contains('no-right')) document.body.classList.remove('no-right');
    host.hidden = !on; ins.hidden = !!on; R.paneOn = !!on;
    MS.$$('#right-tabs button').forEach(function (b) { b.classList.toggle('on', (b.getAttribute('data-pane') === 'comments') === !!on); });
    if (on) R.renderPane();
  };
  function where(c) { return c.loc && R.trail ? R.trail(c.loc) : c.tab ? 'Tab “' + c.tab.title + '”' : ''; }
  function what(c) { return c.kind === 'element' ? (c.target.point ? c.target.what + ' at “' + c.target.point + '”' : c.target.what) : c.kind === 'area' ? 'Area' + (c.inside && c.inside.length ? ' with ' + clip(c.inside.slice(0, 2).join(', '), 60) : '') : 'Interaction: ' + ((c.steps || []).slice(-1)[0] || 'current view'); }
  function composer(c, isNew, ctx, extra, onSave, onCancel) {
    var ta = h('textarea', { 'class': 'inp', rows: 3, placeholder: isNew ? 'Type your comment… (Ctrl+Enter to add)' : 'Comment' });
    ta.value = c.text || '';
    var ty = h('select', { 'class': 'inp' }, TYPES.map(function (o) { return h('option', { value: o.value, text: o.label, selected: o.value === (c.type || 'change') }); }));
    var pr = h('select', { 'class': 'inp' }, PRIOS.map(function (o) { return h('option', { value: o.value, text: o.label, selected: o.value === (c.prio || 'should') }); }));
    var nm = isNew ? h('input', { 'class': 'inp', placeholder: 'Your name (optional)', value: author() }) : null;
    var to = h('input', { 'class': 'inp cmt-to', placeholder: 'Assign to (initials), or @mention in the text', value: c.to || '', title: 'Who should act on it, e.g. AK. An @mention in the text assigns it too.' });
    var go = function () {
      if (!ta.value.trim()) { ta.focus(); return MS.toast('Type a comment first.', 'warn'); }
      if (nm) { MS.prefs.set('author', nm.value.trim()); c.by = nm.value.trim(); }
      c.text = ta.value.trim(); c.type = ty.value; c.prio = pr.value;
      c.mentions = R.mentions(c.text); if (!c.mentions.length) delete c.mentions;
      c.to = to.value.trim().replace(/^@/, '') || (c.mentions && c.mentions[0]) || ''; if (!c.to) delete c.to;
      onSave(c);
    };
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); go(); } if (e.key === 'Escape') { e.preventDefault(); onCancel(); } });
    return h('div', { 'class': 'cmt-draft' }, [ctx ? ctxBox(ctx) : null, extra || null, ta,
      h('div', { 'class': 'row gap' }, [ty, pr]), to, nm,
      h('div', { 'class': 'row gap' }, [h('span', { 'class': 'grow' }), h('button', { 'class': 'btn sm', onclick: onCancel }, ['Cancel']), h('button', { 'class': 'btn sm primary', onclick: go }, [isNew ? 'Add comment' : 'Save'])])]);
  }
  function card(c, n) {
    var cur = c.id === R.current, editing = R.editing === c.id;
    var el = h('div', { 'class': 'cmt-card' + (cur ? ' cur' : '') + (c.done ? ' done' : ''), 'data-id': c.id });
    el.appendChild(h('div', { 'class': 'cmt-top' }, [h('span', { 'class': 'cmt-n' + (c.done ? ' done' : ''), text: String(n) }), h('span', { 'class': 'kind', text: KIND_ICON[c.kind] || '' }),
      h('span', { 'class': 'grow cmt-what', text: clip(what(c), 70), title: where(c) }),
      c.to ? h('span', { 'class': 'tag who', text: '@' + c.to, title: 'Assigned to ' + c.to }) : null,
      c.prio === 'must' && !c.done ? h('span', { 'class': 'tag warn', text: 'must' }) : null, c.done ? h('span', { 'class': 'tag ok', text: '✓ resolved' }) : null]));
    if (editing) el.appendChild(composer(JSON.parse(JSON.stringify(c)), false, null, null, function (v) { R.editing = null; patch(c.id, 'Edit comment', function (x) { x.text = v.text; x.type = v.type; x.prio = v.prio; if (v.to) x.to = v.to; else delete x.to; if (v.mentions) x.mentions = v.mentions; else delete x.mentions; }); }, function () { R.editing = null; R.renderPane(); }));
    else el.appendChild(h('div', { 'class': 'cmt-text', text: c.text }));
    el.appendChild(h('div', { 'class': 'cmt-meta muted small', text: [c.by || 'Reviewer', ago(c.created), (TYPES.filter(function (t) { return t.value === c.type; })[0] || {}).label].filter(Boolean).join(' · ') }));
    (c.replies || []).forEach(function (rp) {
      el.appendChild(h('div', { 'class': 'cmt-reply' }, [h('div', { 'class': 'cmt-meta muted small', text: (rp.by || 'Reviewer') + ' · ' + ago(rp.at) }), h('div', { 'class': 'cmt-text', text: rp.text })]));
    });
    if (cur && !editing) {
      var rta = h('textarea', { 'class': 'inp', rows: 1, placeholder: 'Reply… (Ctrl+Enter)' });
      var send = function () { var v = rta.value; rta.value = ''; R.reply(c.id, v); };
      rta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
      rta.addEventListener('click', function (e) { e.stopPropagation(); });
      el.appendChild(h('div', { 'class': 'cmt-replybox row gap' }, [rta, h('button', { 'class': 'btn sm', onclick: function (e) { e.stopPropagation(); send(); } }, ['Reply'])]));
      el.appendChild(h('div', { 'class': 'cmt-acts' }, [
        h('button', { 'class': 'btn sm' + (c.done ? '' : ' primary'), onclick: function (e) { e.stopPropagation(); R.resolve(c.id); } }, [c.done ? '↺ Re-open' : '✓ Resolve']),
        h('button', { 'class': 'btn sm', onclick: function (e) { e.stopPropagation(); R.edit(c.id); } }, ['✎ Edit']),
        h('button', { 'class': 'btn sm', title: 'A prompt for an AI assistant from this comment only', onclick: function (e) { e.stopPropagation(); R.prompt({ ids: [c.id] }); } }, ['✨']),
        h('button', { 'class': 'btn sm danger', title: 'Delete (Ctrl+Z to undo)', onclick: function (e) { e.stopPropagation(); R.remove(c.id); } }, ['🗑'])]));
    }
    el.addEventListener('click', function (e) { if (e.target.closest('textarea,select,input,button')) return; R.select(c.id, true); });
    return el;
  }
  R.renderPane = function () {
    var host = MS.$('#cmt-pane'); if (!host || host.hidden) return;
    var keep = host.scrollTop; host.innerHTML = '';
    var cs = list(), open = cs.filter(function (c) { return !c.done; }).length;
    host.appendChild(h('div', { 'class': 'cmt-head' }, [h('strong', { 'class': 'grow', text: 'Comments' }),
      h('button', { 'class': 'icon-btn', title: 'Comment on what you just did in Interact mode (filters, drill-down, pop-ups)', onclick: function () { R.addInteraction(); } }, ['⚡']),
      h('button', { 'class': 'icon-btn', title: 'Turn the comments into a prompt for an AI assistant', onclick: function () { R.prompt(); } }, ['✨']),
      h('button', { 'class': 'icon-btn', title: 'More', onclick: function (e) { MS.menu(e.currentTarget, [
        { label: (R.showPins ? 'Hide' : 'Show') + ' pins on the dashboard', run: R.togglePins },
        { label: 'Excel tracker…', run: function () { MS.tracker.exportFile(); } },
        { label: 'Update from tracker…', run: function () { MS.tracker.importFile(); } },
        { label: 'Change my name…', run: function () { MS.prompt('Your name on comments and replies', author()).then(function (v) { if (v !== null) { MS.prefs.set('author', v.trim()); R.renderPane(); } }); } },
        '-', { label: 'Delete all comments', danger: true, run: R.clear }]); } }, ['⋯'])]));
    if (!MS.child) { host.appendChild(h('p', { 'class': 'muted pad-sm', text: 'Open a dashboard to comment on it.' })); return; }
    host.appendChild(commenting()
      ? h('div', { 'class': 'cmt-hint on' }, [h('b', { text: 'Commenting. ' }), 'Click anything to comment on it, or drag a box around an area. Tabs still switch. ', h('button', { 'class': 'linklike', onclick: function () { MS.setMode('edit'); } }, ['Stop (Esc)'])])
      : h('div', { 'class': 'cmt-hint' }, [h('button', { 'class': 'btn sm primary', onclick: function () { MS.setMode('comment'); } }, ['💬 New comment']), h('span', { 'class': 'muted small', text: ' Then click a part of the dashboard or drag a box.' })]));
    if (R.draft) {
      var dr = R.draft;
      host.appendChild(h('div', { 'class': 'cmt-card new' }, [h('div', { 'class': 'cmt-top' }, [h('span', { 'class': 'cmt-n', text: String(cs.length + 1) }), h('strong', { text: 'New comment' })]),
        composer(dr.c, true, dr.ctx, dr.extra, function (c) { if (dr.done) dr.done(c); R.draft = null; R.current = c.id; save(c, 'Add comment'); MS.toast('Comment ' + list().length + ' added.', 'ok'); }, R.discard)]));
    }
    var mine = cs.filter(function (c) { return !c.done && R.forMe(c); }).length;
    var chips = [['open', 'Open (' + open + ')'], ['mine', 'For me' + (mine ? ' (' + mine + ')' : '')], ['all', 'All (' + cs.length + ')'], ['must', 'Must fix'], ['done', 'Resolved']];
    host.appendChild(h('div', { 'class': 'seg small cmt-filter' }, chips.map(function (x) {
      return h('button', { 'class': 'seg-btn' + (R.filter === x[0] ? ' on' : ''), onclick: function () { R.filter = x[0]; MS.prefs.set('cmtFilter', x[0]); R.renderPane(); R.renderPins(); } }, [x[1]]);
    })));
    var show = cs.filter(function (c) { return R.filter === 'all' || (R.filter === 'open' && !c.done) || (R.filter === 'done' && c.done) || (R.filter === 'must' && c.prio === 'must' && !c.done) || (R.filter === 'mine' && !c.done && R.forMe(c)) || c.id === R.current; });
    if (!cs.length) host.appendChild(h('p', { 'class': 'muted pad-sm small', text: 'No comments yet. Press 💬 Comment at the top (or here), then click anything on the dashboard, or drag a box around an area. Every comment gets a numbered pin that stays on the content as you scroll.' }));
    else if (!show.length) host.appendChild(h('p', { 'class': 'muted pad-sm small', text: R.filter === 'open' ? 'Everything is resolved. 🎉' : R.filter === 'mine' && !author() ? 'Set your name (⋯ › Change my name) to see the comments assigned to you or that @mention you.' : 'Nothing here.' }));
    var groups = [], byTab = {};
    show.forEach(function (c) { var k = c.tab ? c.tab.title : 'Whole page'; if (!byTab[k]) { byTab[k] = []; groups.push(k); } byTab[k].push(c); });
    groups.forEach(function (g) {
      if (groups.length > 1 || g !== 'Whole page') host.appendChild(h('div', { 'class': 'cmt-group', text: g }));
      byTab[g].forEach(function (c) { host.appendChild(card(c, cs.indexOf(c) + 1)); });
    });
    host.scrollTop = keep;
  };
  var paneSoon = MS.debounce(function () { R.renderPane(); }, 60);
  var pinsSoon = MS.debounce(function () { R.renderPins(); }, 120);
  ['comments', 'changed', 'structure', 'tab-shown', 'history'].forEach(function (ev) { MS.on(ev, pinsSoon); });
  ['comments', 'history', 'child-loaded'].forEach(function (ev) { MS.on(ev, paneSoon); });
  MS.on('comments', function () { R.syncBar(); });
  MS.on('history', function () { R.syncBar(); });
  MS.on('child-loaded', function (c) {
    log = []; lastHover = null; R.picking = null; R.draft = null; R.current = null; R.editing = null;
    attachPicker(c); attachLog(c);
    c.win.addEventListener('ms:refresh', pinsSoon);
    if (MS.mode === 'comment') c.doc.body.classList.add('ms-comment-mode');
    setTimeout(function () { ensureCss(); markPass(); R.renderPins(); R.syncBar(); }, 300);
  });
  // the dashboard's own tab buttons keep a pointer cursor in Comment mode
  function markPass() { var g = MS.pageTabs && MS.pageTabs.group(); if (g) g.tabs.forEach(function (t) { t.btn.classList.add('ms-cmt-pass'); }); }
  MS.on('structure', function () { if (MS.child && rt()) markPass(); });
  MS.on('mode', function (m) {
    if (m === 'interact') note('Switched to Interact mode');
    var d = cdoc(); if (d && d.body) { d.body.classList.toggle('ms-comment-mode', m === 'comment'); if (m === 'comment') { ensureCss(); markPass(); } }
    if (m !== 'comment') R.cancel();
    if (m === 'comment') R.showPane(true); else R.renderPane();
  });
  // selecting something in Edit mode brings the Format pane back
  MS.on('selection', function (el) { if (el && MS.mode === 'edit' && R.paneOn) R.showPane(false); });

  /* ---------------------------------------------------------- top bar: open the pane, make a prompt */
  R.syncBar = function () {
    var n = list().filter(function (c) { return !c.done; }).length;
    MS.$$('#cmt-count, #rtab-count').forEach(function (b) { b.textContent = n ? String(n) : ''; b.style.display = n ? '' : 'none'; });
  };
  R.bar = function () {
    var host = MS.$('#cmt-bar'); if (!host) return;
    host.appendChild(h('button', { 'class': 'btn', id: 'btn-cmts', title: 'Show all comments (like PowerPoint\'s Comments pane)', onclick: function () { R.showPane(!R.paneOn); } }, ['🗨 Comments ', h('span', { 'class': 'count', id: 'cmt-count' })]));
    host.appendChild(h('button', { 'class': 'btn', id: 'btn-prompt', title: 'Turn all comments into one prompt for an AI assistant', onclick: function () { R.prompt(); } }, ['✨ Prompt']));
    var rt0 = MS.$('#right-tabs');
    if (rt0 && !rt0.firstChild) {
      rt0.appendChild(h('button', { 'data-pane': 'format', 'class': 'on', onclick: function () { R.showPane(false); } }, ['Format']));
      rt0.appendChild(h('button', { 'data-pane': 'comments', onclick: function () { R.showPane(true); } }, ['Comments ', h('span', { 'class': 'count', id: 'rtab-count' })]));
    }
    R.syncBar();
  };

  /* ---------------------------------------------------------- outline section */
  R.outlineSection = function () {
    var cs = list();
    var sec = h('section', { 'class': 'ol-sec' }, [h('div', { 'class': 'ol-head' }, [h('span', { text: 'Comments (' + cs.length + ')' }),
      h('button', { 'class': 'icon-btn', title: 'New comment: click or drag on the dashboard', onclick: function () { MS.setMode('comment'); } }, ['💬']),
      cs.length ? h('button', { 'class': 'icon-btn', title: 'Make a prompt from the comments', onclick: function () { R.prompt(); } }, ['✨']) : null])]);
    if (!cs.length) sec.appendChild(h('p', { 'class': 'muted pad-sm', text: 'Press 💬 Comment at the top, then click anything or drag a box. ✨ Prompt turns comments into instructions for an AI assistant.' }));
    cs.forEach(function (c, i) {
      var row = h('div', { 'class': 'ol-row' + (c.done ? ' hidden' : '') + (c.id === R.current ? ' active' : ''), title: c.text }, [
        h('span', { 'class': 'cmt-n', text: String(i + 1) }), h('span', { 'class': 'kind', text: KIND_ICON[c.kind] }),
        h('span', { 'class': 'grow name', text: clip(c.text, 60) }),
        c.replies && c.replies.length ? h('span', { 'class': 'tag', text: '↩ ' + c.replies.length }) : null,
        c.prio === 'must' ? h('span', { 'class': 'tag warn', text: 'must' }) : null]);
      row.addEventListener('click', function () { R.select(c.id, true); });
      row.addEventListener('dblclick', function () { R.edit(c.id); });
      sec.appendChild(row);
    });
    return sec;
  };

  /* ---------------------------------------------------------- the prompt */
  function bytesOf(s) { return MS.bytes(new Blob([s]).size); }
  R.buildPrompt = function (o) {
    var r = rt(), cs = list().filter(function (c) { return o.includeDone || !c.done; });
    var file = o.fileName || MS.exportName(), L = [];
    var tabs = r && r.layoutEnabled() ? r.tabs().filter(function (t) { return !t.hidden; }).map(function (t) { return t.title; }) : MS.pageTabs.list().map(function (t) { return t.title; });
    L.push('# Update an HTML dashboard from review comments', '');
    L.push('You are an expert front-end developer and data-visualisation designer. I reviewed an HTML dashboard and left ' + cs.length + ' numbered comment' + (cs.length === 1 ? '' : 's') + '. Please make the changes they ask for.', '');
    L.push('## The dashboard', '');
    L.push('- File: `' + file + '`' + (o.embed ? ' (full source at the end of this prompt)' : ' (I will attach it, or paste it after this prompt)') + '.');
    L.push('- It is a single, self-contained HTML file that must keep working offline when opened by double-clicking (file://). No server, no build step, no CDN links.');
    if (tabs.length) L.push('- Tabs: ' + tabs.map(function (t) { return '“' + t + '”'; }).join(', ') + '.');
    if (o.structure && r) {
      var charts = r.charts();
      if (charts.length) {
        L.push('- Charts (' + charts.length + '):');
        charts.forEach(function (c) { var info = r.chartInfo(c.key) || {}, sec = c.el.closest('section.ms-tab'), lib = { chartjs: 'Chart.js', echarts: 'ECharts', plotly: 'Plotly', highcharts: 'Highcharts', d3: 'D3 (SVG)' }[c.lib];
          L.push('  - “' + MS.charts.nameOf(c.key) + '”: ' + MS.charts.kindName(info.type).toLowerCase() + ' drawn with ' + lib + (sec ? ', on the “' + sec.getAttribute('data-ms-title') + '” tab' : '') + (c.el.id ? ', element `#' + c.el.id + '`' : '') + '.'); });
      }
      var ds = Object.keys(r.state.datasets);
      if (ds.length) { L.push('- Data tables:'); ds.forEach(function (n) { var f = r.fields(n); L.push('  - `' + n + '` (' + r.getRows(n).length + ' rows): ' + f.map(function (x) { return x.name + (x.numeric ? ' (number)' : ''); }).join(', ') + '.'); }); }
    }
    L.push('');
    L.push('## Rules', '');
    L.push('1. Change only what the comments ask for. Keep everything else exactly as it is: layout, data, wording and behaviour.');
    L.push('2. Do not invent data. If a comment needs data the file does not have, say so and leave a clearly marked placeholder.');
    L.push('3. The file was saved by an editor called Mothership. Keep every `data-ms-*` attribute, the `<script id="ms-state" type="application/json">` block and the `<script id="ms-runtime">` block. If a change needs a setting stored in `ms-state` (tooltips, chart look, drill-down), you may edit that JSON carefully.');
    L.push('4. Each comment says where it is: a description, a selector you can search for (`[data-ms-id="…"]` or `[data-ms-ref="…"]`), and a fallback CSS path.');
    L.push('5. ' + MS.locale.rule());
    L.push('6. Keep it accessible: readable contrast, text at least 12px, and charts that still make sense without colour.');
    if (o.extra) L.push('7. ' + o.extra.trim());
    L.push('');
    L.push('## Comments', '');
    var prio = { must: 'Must fix', should: 'Should fix', nice: 'Nice to have' }, type = { change: 'Change request', bug: 'Something is wrong', question: 'Question', idea: 'Idea' };
    cs.forEach(function (c) {
      var n = list().indexOf(c) + 1;
      L.push('### ' + n + '. ' + clip(c.text.split('\n')[0], 80));
      L.push('- **Type / priority:** ' + (type[c.type] || 'Change request') + ' · ' + (prio[c.prio] || 'Should fix') + (c.done ? ' · (marked done)' : ''));
      if (c.tab) L.push('- **Tab:** “' + c.tab.title + '”');
      if (c.kind === 'element') {
        L.push('- **On:** ' + c.target.what + (c.target.point ? ', at the data point “' + c.target.point + '”' : '') + (c.target.section ? ', inside “' + c.target.section + '”' : ''));
        L.push('- **Find it:** `' + c.target.ref + '` (or `' + c.target.css + '`)');
        if (c.target.chart && c.target.chart.labels && c.target.chart.labels.length) L.push('- **Chart shows:** ' + c.target.chart.labels.slice(0, 8).join(', ') + (c.target.chart.labels.length > 8 ? '…' : '') + (c.target.chart.series && c.target.chart.series.filter(Boolean).length ? ' · series: ' + c.target.chart.series.filter(Boolean).join(', ') : ''));
      } else if (c.kind === 'area') {
        L.push('- **On:** a ' + c.area.w + '×' + c.area.h + ' px area of the screen (' + c.area.x + ', ' + c.area.y + ' from the top-left of the page, window ' + c.area.vw + '×' + c.area.vh + ')');
        if (c.inside && c.inside.length) L.push('- **The area contains:** ' + c.inside.join('; '));
      } else {
        if (c.steps && c.steps.length) { L.push('- **What I did:**'); c.steps.forEach(function (s, i) { L.push('  ' + (i + 1) + '. ' + s); }); }
        var st = c.state || {};
        if (st.filters) L.push('- **Filters at the time:** ' + st.filters.join(', '));
        if (st.drill) L.push('- **Drill-down at the time:** ' + st.drill.join('; '));
        if (st.popup) L.push('- **Pop-up I saw:** on “' + st.popup.chart + '”' + (st.popup.at ? ' at “' + st.popup.at + '”' : '') + (st.popup.text ? ': “' + st.popup.text + '”' : ''));
      }
      L.push('- **Comment:**');
      c.text.split('\n').forEach(function (line) { L.push('  > ' + line); });
      L.push('');
    });
    L.push('## What to send back', '');
    if (o.output === 'changes') L.push('For each comment, in order: the comment number, what you changed and why, then the exact code to change (the old snippet and the new snippet, with enough surrounding lines to find it). Do not send the whole file.');
    else if (o.output === 'plan') L.push('First, a short plan: for each comment, what you will change, plus any questions or assumptions. Wait for my go-ahead before writing code.');
    else L.push('1. A short table: comment number → what you changed (or why you could not).', '2. The complete updated HTML file in a single code block, ready to save as `' + file.replace(/\.html?$/i, '') + '-v2.html`. Do not shorten it or leave “rest unchanged” notes: I will save it as is.');
    L.push('', 'Answer any “Question” comments in plain English before the code. If something is unclear, make the most sensible choice and say what you assumed.');
    if (o.embed) L.push('', '## Dashboard source', '', '```html', o.embed, '```');
    return L.join('\n');
  };
  R.prompt = function () {
    if (!MS.child) return MS.toast('Open a dashboard first.', 'warn');
    if (!list().length) return MS.toast('No comments yet. Use 💬 Element, Area or Interaction at the top first.', 'warn', 6000);
    MS.emit('prompt-opened');
    var src = ''; try { src = MS.exportHtml({ dropComments: true }); } catch (e) {}
    var big = src.length > 400000;
    var f = MS.form([
      { key: 'output', label: 'Ask for', type: 'select', value: MS.prefs.get('promptOutput', 'file'), options: [{ value: 'file', label: 'The complete updated HTML file' }, { value: 'changes', label: 'Only the changes (old → new snippets)' }, { value: 'plan', label: 'A plan first, code after I approve' }] },
      { key: 'structure', label: 'Describe the dashboard (tabs, charts, data columns)', type: 'checkbox', value: true },
      { key: 'includeDone', label: 'Include comments marked done', type: 'checkbox', value: false },
      { key: 'embed', label: 'Paste the dashboard file into the prompt (' + bytesOf(src) + (big ? ', too big for most chats: attach the file instead' : '') + ')', type: 'checkbox', value: false },
      { key: 'extra', label: 'Anything else the assistant should know (optional)', type: 'textarea', rows: 2, value: MS.prefs.get('promptExtra', '') }
    ]);
    var out = h('textarea', { 'class': 'inp mono prompt-out', rows: 16, readonly: true });
    var meta = h('small', { 'class': 'hint' });
    var build = function () {
      var v = f.values(); MS.prefs.set('promptOutput', v.output); MS.prefs.set('promptExtra', v.extra);
      out.value = R.buildPrompt({ output: v.output, structure: v.structure, includeDone: v.includeDone, extra: v.extra, embed: v.embed ? src : '', fileName: MS.exportName() });
      meta.textContent = out.value.length.toLocaleString('en-IN') + ' characters (about ' + Math.round(out.value.length / 4).toLocaleString('en-IN') + ' tokens). Works with any capable AI assistant: Claude, ChatGPT, Gemini, Copilot, or your company\'s approved tool.';
    };
    Object.keys(f.inputs).forEach(function (k) { f.inputs[k].addEventListener(k === 'extra' ? 'input' : 'change', build); });
    build();
    var copy = function () {
      out.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.value).then(function () { MS.toast('Prompt copied. Paste it into your AI assistant' + (f.values().embed ? '.' : ' and attach ' + MS.exportName() + '.'), 'ok', 6000); }, function () { if (!ok) MS.toast('Copy was blocked. Select the text and press Ctrl+C.', 'warn'); });
      else if (ok) MS.toast('Prompt copied.', 'ok');
    };
    var body = h('div', { 'class': 'prompt-dlg' }, [f, h('div', { 'class': 'row gap' }, [
      h('button', { 'class': 'btn primary', type: 'button', onclick: copy }, ['📋 Copy prompt']),
      h('button', { 'class': 'btn', type: 'button', onclick: function () { MS.download(MS.exportName().replace(/\.html?$/i, '') + '-review-prompt.md', out.value, 'text/markdown'); } }, ['⬇ Save as .md']),
      h('button', { 'class': 'btn', type: 'button', title: 'Save the dashboard file to attach with the prompt (comments are left out of it)', onclick: function () { MS.versions.exportFile(false, { dropComments: true }); } }, ['⬇ Export the dashboard to attach'])]), out, meta]);
    MS.dialog({ title: 'Prompt from ' + list().length + ' comment(s)', wide: true, enterSubmits: false, body: body, buttons: [{ label: 'Close', value: null }] });
  };
})(window.MS);
