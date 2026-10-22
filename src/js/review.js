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
    var t = el.tagName.toLowerCase(), txt = clip(el.textContent, 70);
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
  function recording() { return MS.mode !== 'edit' || (MS.present && MS.present.on); }
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
    } catch (e) {}
    return '';
  }
  function pointLabel(c, e) {
    try {
      if (c.lib === 'chartjs') { var p = c.inst.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false)[0]; if (p) return String(c.inst.data.labels[p.index]); }
      if (c.lib === 'plotly' && c.el._hoverdata && c.el._hoverdata[0]) { var q = c.el._hoverdata[0]; return String(q.label != null ? q.label : q.x); }
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

  /* ---------------------------------------------------------- picking an element or an area in the dashboard */
  var PICK_CSS = '.ms-cmt-hover{outline:2px solid #f59e0b!important;outline-offset:2px;cursor:crosshair!important}' +
    'body.ms-cmt-picking,body.ms-cmt-picking *{cursor:crosshair!important}' +
    '#ms-cmt-layer{position:absolute;left:0;top:0;width:0;height:0;z-index:99990}' +
    '.ms-cmt-pin{position:absolute;min-width:22px;height:22px;padding:0 5px;box-sizing:border-box;border-radius:11px 11px 11px 2px;background:#f59e0b;color:#111;font:700 12px/22px system-ui,sans-serif;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer;transform:translate(-4px,-18px)}' +
    '.ms-cmt-pin.done{background:#9ca3af}' +
    '.ms-cmt-area{position:absolute;border:2px dashed #f59e0b;background:rgba(245,158,11,.08);border-radius:4px;pointer-events:none}' +
    '.ms-cmt-area.done{border-color:#9ca3af;background:none}' +
    '.ms-cmt-area .ms-cmt-pin{pointer-events:auto;left:-2px;top:-2px}' +
    '#ms-cmt-shield{position:fixed;inset:0;z-index:99999;cursor:crosshair;background:rgba(15,23,42,.06)}' +
    '#ms-cmt-rect{position:fixed;border:2px dashed #f59e0b;background:rgba(245,158,11,.12);pointer-events:none}';
  function ensureCss() {
    var d = cdoc(); if (!d || d.getElementById('ms-cmt-css')) return;
    var st = d.createElement('style'); st.id = 'ms-cmt-css'; st.setAttribute('data-ms-editor', ''); st.textContent = PICK_CSS; d.head.appendChild(st);
  }
  R.cancel = function () {
    var d = cdoc(); R.picking = null;
    if (!d) return;
    d.body.classList.remove('ms-cmt-picking');
    MS.$$('.ms-cmt-hover', d).forEach(function (n) { n.classList.remove('ms-cmt-hover'); });
    ['ms-cmt-shield', 'ms-cmt-rect'].forEach(function (id) { var n = d.getElementById(id); if (n) n.remove(); });
    MS.$$('.cmt-tool').forEach(function (b) { b.classList.remove('on'); });
  };
  function pickTarget(t) {
    if (!t || t.nodeType !== 1 || /^(HTML|BODY)$/.test(t.tagName) || t.closest('#ms-cmt-layer')) return null;
    var p = MS.edit.pick(t) || t;
    if (p.id === 'ms-app' || p.id === 'ms-main' || p.id === 'ms-body' || p.classList.contains('ms-tab')) return null;
    return p;
  }
  R.start = function (kind) {
    if (!MS.child) return MS.toast('Open a dashboard first.', 'warn');
    if (!rt()) return MS.toast('Comments need the dashboard\'s scripts. Turn off Safe mode (View tab).', 'warn');
    R.cancel();
    if (kind === 'interaction') return R.addInteraction();
    ensureCss();
    R.picking = kind;
    MS.$$('.cmt-tool[data-kind="' + kind + '"]').forEach(function (b) { b.classList.add('on'); });
    var d = cdoc();
    if (kind === 'element') {
      d.body.classList.add('ms-cmt-picking');
      if (MS.mode === 'edit' && MS.sel) { var s = MS.sel; R.cancel(); return R.addElement(s); }
      MS.toast('Click the part of the dashboard you want to comment on. Esc to cancel.', '', 4000);
    } else {
      var shield = d.createElement('div'); shield.id = 'ms-cmt-shield'; shield.setAttribute('data-ms-editor', ''); d.body.appendChild(shield);
      MS.toast('Drag a box around the area you want to comment on. Esc to cancel.', '', 4000);
    }
  };
  function attachPicker(c) {
    var d = c.doc, w = c.win, hov = null, start = null, rect = null;
    w.addEventListener('mouseover', function (e) {
      if (R.picking !== 'element') return;
      if (hov) hov.classList.remove('ms-cmt-hover');
      hov = pickTarget(e.target); if (hov) hov.classList.add('ms-cmt-hover');
    }, true);
    w.addEventListener('click', function (e) {
      if (R.picking !== 'element') return;
      e.preventDefault(); e.stopImmediatePropagation();
      var t = pickTarget(e.target); R.cancel(); if (t) R.addElement(t, e);
    }, true);
    ['mousedown', 'mouseup', 'dblclick'].forEach(function (ev) { w.addEventListener(ev, function (e) { if (R.picking === 'element') { e.preventDefault(); e.stopImmediatePropagation(); } }, true); });
    w.addEventListener('mousedown', function (e) {
      if (R.picking !== 'area' || e.target.id !== 'ms-cmt-shield') return;
      e.preventDefault(); e.stopImmediatePropagation();
      start = { x: e.clientX, y: e.clientY };
      rect = d.createElement('div'); rect.id = 'ms-cmt-rect'; rect.setAttribute('data-ms-editor', ''); d.body.appendChild(rect);
    }, true);
    w.addEventListener('mousemove', function (e) {
      if (!start || !rect) return;
      rect.style.left = Math.min(start.x, e.clientX) + 'px'; rect.style.top = Math.min(start.y, e.clientY) + 'px';
      rect.style.width = Math.abs(e.clientX - start.x) + 'px'; rect.style.height = Math.abs(e.clientY - start.y) + 'px';
    }, true);
    w.addEventListener('mouseup', function (e) {
      if (!start) return;
      var r = { left: Math.min(start.x, e.clientX), top: Math.min(start.y, e.clientY), w: Math.abs(e.clientX - start.x), h: Math.abs(e.clientY - start.y) };
      start = null; R.cancel();
      if (r.w < 8 || r.h < 8) return MS.toast('That box was too small. Try again and drag a bigger box.', 'warn');
      R.addArea(r);
    }, true);
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && R.picking) { e.stopPropagation(); R.cancel(); } }, true);
    w.addEventListener('scroll', MS.debounce(R.renderPins, 50));
    w.addEventListener('resize', MS.debounce(R.renderPins, 80));
  }

  /* ---------------------------------------------------------- the comment dialog */
  function editor(c, extra) {
    var f = MS.form([
      { key: 'text', label: 'Your comment', type: 'textarea', rows: 4, value: c.text || '', placeholder: 'e.g. Show values in ₹ crore, and add last year for comparison.' },
      { key: 'type', label: 'Type', type: 'select', options: TYPES, value: c.type || 'change' },
      { key: 'prio', label: 'Priority', type: 'select', options: PRIOS, value: c.prio || 'should' }
    ]);
    f.inputs.text.placeholder = 'e.g. Show values in ₹ crore, and add last year for comparison.';
    var labels = f.querySelectorAll(':scope > label');
    f.appendChild(h('div', { 'class': 'row gap' }, [labels[1], labels[2]]));
    return { el: h('div', { 'class': 'cmt-ed' }, [extra, f]), f: f };
  }
  function ask(title, c, extra, isNew) {
    var ed = editor(c, extra);
    var btns = [{ label: 'Cancel', value: null }];
    if (!isNew) btns.unshift({ label: 'Delete', danger: true, value: 'delete' }, { label: c.done ? 'Re-open' : 'Mark done', value: 'done' }, { label: '✨ Prompt for this one', value: 'prompt' });
    btns.push({ label: isNew ? 'Add comment' : 'Save', primary: true, value: function () { var v = ed.f.values(); if (!v.text.trim()) { ed.f.inputs.text.focus(); MS.toast('Type a comment first.', 'warn'); return false; } return v; } });
    return MS.dialog({ title: title, body: ed.el, enterSubmits: false, buttons: btns });
  }
  function save(c, label) {
    MS.history.state(label || 'Comment', function (s) {
      s.comments = s.comments || [];
      var i = s.comments.map(function (x) { return x.id; }).indexOf(c.id);
      if (i >= 0) s.comments[i] = JSON.parse(JSON.stringify(c)); else s.comments.push(JSON.parse(JSON.stringify(c)));
    });
    MS.emit('comments');
  }
  function base(kind) { var t = tabOf(null); return { id: rt().uid('m'), kind: kind, created: new Date().toISOString(), tab: t, type: 'change', prio: 'should' }; }
  function ctxBox(lines) { return h('div', { 'class': 'cmt-ctx' }, lines.filter(Boolean).map(function (l) { return h('div', { html: l }); })); }

  R.addElement = function (el, e) {
    var d = R.describe(el), c = base('element'), t = tabOf(el);
    c.tab = t; c.target = { what: d.what, ref: refOf(el), css: cssPath(el), section: sectionOf(el), chart: d.chart, html: clip(el.outerHTML, 300) };
    if (R.locate) c.loc = R.locate(el);
    if (d.chart && e) { var cc = rt().chart(d.chart.key); var pl = cc && pointLabel(cc, e); if (pl) c.target.point = pl; }
    var ctx = ctxBox(['<b>On:</b> ' + MS.esc(d.what) + (c.target.point ? ' at “' + MS.esc(c.target.point) + '”' : ''), '<b>Where:</b> ' + MS.esc(c.loc ? R.trail(c.loc) : [t && 'Tab “' + t.title + '”', c.target.section].filter(Boolean).join(' › ') || 'the page')]);
    ask('Comment on this element', c, ctx, true).then(function (v) { if (!v || typeof v !== 'object') return; Object.assign(c, v); save(c, 'Add comment'); MS.toast('Comment ' + list().length + ' added.', 'ok'); });
  };
  R.addArea = function (r) {
    var w = MS.child.win, d = cdoc(), c = base('area');
    c.area = { x: Math.round(r.left + w.scrollX), y: Math.round(r.top + w.scrollY), w: Math.round(r.w), h: Math.round(r.h), vw: w.innerWidth, vh: w.innerHeight, tab: c.tab && c.tab.id };
    // what is inside the box
    var inside = [], seen = [];
    var within = function (b) { var ix = Math.max(0, Math.min(b.right, r.left + r.w) - Math.max(b.left, r.left)), iy = Math.max(0, Math.min(b.bottom, r.top + r.h) - Math.max(b.top, r.top)); return b.width * b.height > 0 && ix * iy / (b.width * b.height) > 0.6; };
    (rt().charts() || []).forEach(function (ch) { if (ch.el.offsetParent !== null && within(ch.el.getBoundingClientRect())) { inside.push(R.describe(ch.el).what); seen.push(ch.el); } });
    MS.$$('h1,h2,h3,h4,.ms-title,.ms-kpi,p,li,button,table,img,select,label,.ms-callout', d).forEach(function (n) {
      if (inside.length >= 12 || n.offsetParent === null || n.closest('[data-ms-editor]') || seen.some(function (s) { return s.contains(n) || n.contains(s); })) return;
      if (within(n.getBoundingClientRect())) { inside.push(R.describe(n).what); seen.push(n); }
    });
    c.inside = inside;
    if (R.locateArea) c.loc = R.locateArea(r, seen);
    var ctx = ctxBox(['<b>Area:</b> ' + c.area.w + ' × ' + c.area.h + ' px' + (c.tab ? ' on the “' + MS.esc(c.tab.title) + '” tab' : ''),
      inside.length ? '<b>Inside it:</b><br>' + inside.slice(0, 8).map(function (x) { return '· ' + MS.esc(x); }).join('<br>') : '<i>Nothing recognisable inside the box (maybe empty space).</i>']);
    ask('Comment on this area', c, ctx, true).then(function (v) { if (!v || typeof v !== 'object') return; Object.assign(c, v); save(c, 'Add comment'); MS.toast('Comment ' + list().length + ' added.', 'ok'); });
  };
  R.addInteraction = function () {
    var steps = log.slice(-10), snap = snapshot(), c = base('interaction');
    var checks = steps.map(function (s, i) { return { s: s, cb: h('input', { type: 'checkbox', checked: i >= steps.length - 4 }) }; });
    var ago = function (t) { var x = Math.round((Date.now() - t) / 1000); return x < 60 ? x + 's ago' : Math.round(x / 60) + ' min ago'; };
    var stepsBox = checks.length ? h('div', { 'class': 'list' }, checks.map(function (k) { return h('label', { 'class': 'list-row' }, [k.cb, h('span', { 'class': 'grow', text: k.s.text }), h('small', { 'class': 'muted', text: ago(k.s.t) })]); }))
      : h('p', { 'class': 'muted', text: 'Nothing recorded yet. Switch to Interact mode (top right), use the dashboard (tabs, filters, hovering, double-clicking), then come back here.' });
    var stateLines = [snap.tab ? '<b>Tab:</b> ' + MS.esc(snap.tab) : '', snap.filters ? '<b>Filters:</b> ' + MS.esc(snap.filters.join(', ')) : '', snap.drill ? '<b>Drill-down:</b> ' + MS.esc(snap.drill.join('; ')) : '',
      snap.hover ? '<b>Last pop-up:</b> ' + MS.esc(snap.hover.name) + (snap.hover.tip ? ' showed “' + MS.esc(snap.hover.tip) + '”' : '') : ''];
    var extra = h('div', {}, [h('h4', { text: 'What you did (tick the steps that matter)' }), stepsBox, h('h4', { text: 'Where things are now' }), ctxBox(stateLines.some(Boolean) ? stateLines : ['<i>Default view: no filters or drill-down.</i>'])]);
    ask('Comment on an interaction', c, extra, true).then(function (v) {
      if (!v || typeof v !== 'object') return;
      Object.assign(c, v);
      c.steps = checks.filter(function (k) { return k.cb.checked; }).map(function (k) { return k.s.text; });
      c.state = { tab: snap.tab, filters: snap.filters, drill: snap.drill, popup: snap.hover ? { chart: snap.hover.name, at: snap.hover.label, text: snap.hover.tip } : undefined };
      save(c, 'Add comment'); MS.toast('Comment ' + list().length + ' added.', 'ok');
    });
  };
  R.edit = function (id) {
    var c = list().filter(function (x) { return x.id === id; })[0]; if (!c) return;
    c = JSON.parse(JSON.stringify(c));
    var n = list().map(function (x) { return x.id; }).indexOf(id) + 1;
    var ctx = ctxBox([KIND_ICON[c.kind] + ' <b>' + (c.kind === 'element' ? MS.esc(c.target.what) : c.kind === 'area' ? 'Area with ' + (c.inside || []).length + ' item(s)' : 'Interaction: ' + MS.esc((c.steps || []).slice(-1)[0] || 'current view')) + '</b>', c.tab ? 'Tab: ' + MS.esc(c.tab.title) : '']);
    ask('Comment ' + n, c, ctx, false).then(function (v) {
      if (!v) return;
      if (v === 'delete') { MS.history.state('Delete comment', function (s) { s.comments = s.comments.filter(function (x) { return x.id !== id; }); }); return MS.emit('comments'); }
      if (v === 'done') { c.done = !c.done; return save(c, c.done ? 'Comment done' : 'Comment re-opened'); }
      if (v === 'prompt') return R.prompt({ ids: [id] });
      Object.assign(c, v); save(c, 'Edit comment');
    });
  };
  R.goTo = function (id) {
    var c = list().filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var r = rt();
    if (c.kind === 'element') { var el = findRef(c.target.ref); if (el) return MS.edit.reveal(el, true); return MS.toast('That element is no longer in the dashboard.', 'warn'); }
    if (c.kind === 'area') {
      if (c.area.tab && r.layoutEnabled()) r.showTab(c.area.tab);
      setTimeout(function () { MS.child.win.scrollTo({ top: Math.max(0, c.area.y - 80), behavior: 'smooth' }); R.renderPins(); }, 60);
      return;
    }
    if (c.tab && r.layoutEnabled()) r.showTab(c.tab.id);
  };
  R.clear = function () {
    if (!list().length) return;
    MS.confirm('Delete all ' + list().length + ' comments?', 'You can undo this with Ctrl+Z.', 'Delete all', true).then(function (ok) {
      if (ok) { MS.history.state('Delete all comments', function (s) { s.comments = []; }); MS.emit('comments'); }
    });
  };
  R.togglePins = function () { R.showPins = !R.showPins; MS.prefs.set('showPins', R.showPins); R.renderPins(); MS.ribbon.render(); };

  /* ---------------------------------------------------------- pins in the dashboard */
  R.renderPins = function () {
    var d = cdoc(), r = rt(); if (!d || !d.body) return;
    var layer = d.getElementById('ms-cmt-layer');
    if (!layer) { ensureCss(); layer = d.createElement('div'); layer.id = 'ms-cmt-layer'; layer.setAttribute('data-ms-editor', ''); d.body.appendChild(layer); }
    layer.innerHTML = '';
    if (!R.showPins || !r) return;
    var w = MS.child.win;
    list().forEach(function (c, i) {
      var pin = d.createElement('div'); pin.className = 'ms-cmt-pin' + (c.done ? ' done' : ''); pin.textContent = i + 1; pin.title = clip(c.text, 140);
      pin.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); R.edit(c.id); });
      pin.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      if (c.kind === 'element') {
        var el = findRef(c.target.ref); if (!el || el.offsetParent === null) return;
        var b = el.getBoundingClientRect();
        pin.style.left = Math.round(b.right + w.scrollX - 12) + 'px'; pin.style.top = Math.round(b.top + w.scrollY + 4) + 'px';
        layer.appendChild(pin);
      } else if (c.kind === 'area') {
        if (c.area.tab && r.layoutEnabled() && c.area.tab !== r.activeTab) return;
        var box = d.createElement('div'); box.className = 'ms-cmt-area' + (c.done ? ' done' : '');
        box.style.left = c.area.x + 'px'; box.style.top = c.area.y + 'px'; box.style.width = c.area.w + 'px'; box.style.height = c.area.h + 'px';
        box.appendChild(pin); layer.appendChild(box);
      }
    });
  };
  var pinsSoon = MS.debounce(function () { R.renderPins(); }, 120);
  ['comments', 'changed', 'structure', 'tab-shown', 'history'].forEach(function (ev) { MS.on(ev, pinsSoon); });
  MS.on('comments', function () { R.syncBar(); });
  MS.on('history', function () { R.syncBar(); });
  MS.on('child-loaded', function (c) {
    log = []; lastHover = null; R.picking = null;
    attachPicker(c); attachLog(c);
    c.win.addEventListener('ms:refresh', pinsSoon);
    setTimeout(function () { R.renderPins(); R.syncBar(); }, 300);
  });
  MS.on('mode', function (m) { if (m === 'interact') note('Switched to Interact mode'); });

  /* ---------------------------------------------------------- comment buttons in the top bar */
  R.syncBar = function () {
    var n = list().filter(function (c) { return !c.done; }).length, b = MS.$('#cmt-count');
    if (b) { b.textContent = n ? String(n) : ''; b.style.display = n ? '' : 'none'; }
  };
  R.bar = function () {
    var host = MS.$('#cmt-bar'); if (!host) return;
    var tool = function (kind, icon, label, title) { return h('button', { 'class': 'seg-btn cmt-tool', 'data-kind': kind, title: title, onclick: function () { R.start(kind); } }, [icon + ' ', h('span', { 'class': 'lbl', text: label })]); };
    host.appendChild(h('span', { 'class': 'cmt-label', text: '💬' }));
    host.appendChild(h('div', { 'class': 'seg', role: 'group', 'aria-label': 'Comment' }, [
      tool('element', '📍', 'Element', 'Comment on one part of the dashboard: click it'),
      tool('area', '▭', 'Area', 'Comment on an area of the screen: drag a box'),
      tool('interaction', '⚡', 'Interaction', 'Comment on what you just did: a filter, a drill-down, a pop-up…')]));
    host.appendChild(h('button', { 'class': 'btn', id: 'btn-prompt', title: 'Turn all comments into one prompt for an AI assistant', onclick: function () { R.prompt(); } }, ['✨ Prompt ', h('span', { 'class': 'count', id: 'cmt-count' })]));
    R.syncBar();
  };

  /* ---------------------------------------------------------- outline section */
  R.outlineSection = function () {
    var cs = list();
    var sec = h('section', { 'class': 'ol-sec' }, [h('div', { 'class': 'ol-head' }, [h('span', { text: 'Comments (' + cs.length + ')' }),
      h('button', { 'class': 'icon-btn', title: 'Comment on an element', onclick: function () { R.start('element'); } }, ['📍']),
      cs.length ? h('button', { 'class': 'icon-btn', title: 'Make a prompt from the comments', onclick: function () { R.prompt(); } }, ['✨']) : null])]);
    if (!cs.length) sec.appendChild(h('p', { 'class': 'muted pad-sm', text: 'Use 💬 at the top to comment on an element, an area or an interaction. Then press ✨ Prompt to turn them into instructions for an AI assistant.' }));
    cs.forEach(function (c, i) {
      var row = h('div', { 'class': 'ol-row' + (c.done ? ' hidden' : ''), title: c.text }, [
        h('span', { 'class': 'cmt-n', text: String(i + 1) }), h('span', { 'class': 'kind', text: KIND_ICON[c.kind] }),
        h('span', { 'class': 'grow name', text: clip(c.text, 60) }),
        c.prio === 'must' ? h('span', { 'class': 'tag warn', text: 'must' }) : null]);
      row.addEventListener('click', function () { R.goTo(c.id); });
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
    var tabs = r && r.layoutEnabled() ? r.tabs().filter(function (t) { return !t.hidden; }).map(function (t) { return t.title; }) : [];
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
        charts.forEach(function (c) { var info = r.chartInfo(c.key) || {}, sec = c.el.closest('section.ms-tab'), lib = { chartjs: 'Chart.js', echarts: 'ECharts', plotly: 'Plotly' }[c.lib];
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
    L.push('5. Formats follow India: ₹, lakh and crore (e.g. ₹1,23,45,678 or ₹1.23 Cr), DD-MM-YYYY dates, and the April–March financial year, unless a comment says otherwise.');
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
