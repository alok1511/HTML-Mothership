/* Direct editing inside the child: selection, text editing, styles, blocks,
   drag & drop, resizing grips. Cut / copy / paste is in clipboard.js. */
(function (MS) {
  'use strict';
  MS.sel = null;
  MS.mode = 'edit'; // 'edit' | 'interact'
  var E = MS.edit = {};

  var EDITOR_CSS = [
    'body.ms-edit-mode .ms-hover{outline:1px dashed #6366f1!important;outline-offset:1px;cursor:default}',
    '.ms-sel{outline:2px solid #6366f1!important;outline-offset:2px}',
    '.ms-editing{outline:2px solid #f59e0b!important;outline-offset:2px;cursor:text!important}',
    '.ms-grip{display:none;position:absolute;right:2px;bottom:2px;width:14px;height:14px;cursor:nwse-resize;z-index:5;background:linear-gradient(135deg,transparent 50%,#6366f1 50%);border-radius:0 0 8px 0;opacity:.7}',
    '.ms-drag{display:none;position:absolute;left:4px;top:4px;width:18px;height:18px;cursor:grab;z-index:5;color:#6366f1;font:14px/18px sans-serif;text-align:center;border-radius:4px;background:rgba(99,102,241,.1);user-select:none}',
    'body.ms-edit-mode .ms-block:hover>.ms-grip,body.ms-edit-mode .ms-block.ms-sel>.ms-grip,body.ms-edit-mode .ms-block:hover>.ms-drag,body.ms-edit-mode .ms-block.ms-sel>.ms-drag{display:block}',
    '.ms-block.ms-drop-before{box-shadow:-4px 0 0 #6366f1}',
    '.ms-block.ms-drop-after{box-shadow:4px 0 0 #6366f1}',
    '.ms-grid.ms-drop-end{outline:2px dashed #6366f1;outline-offset:4px}',
    '.ms-dragging{opacity:.4}',
    '@keyframes ms-flash{0%,60%{box-shadow:0 0 0 4px rgba(99,102,241,.55)}100%{box-shadow:0 0 0 4px rgba(99,102,241,0)}}',
    '.ms-flash{animation:ms-flash 1.5s ease-out;border-radius:6px}',
    '#ms-ribbon .ms-rgrip{position:absolute;left:0;right:0;bottom:-3px;height:6px;cursor:ns-resize}',
    'body.ms-edit-mode #ms-ribbon{position:sticky}',
    '.ms-pgrip{position:absolute;top:0;bottom:0;right:0;width:6px;cursor:ew-resize}',
    '.ms-pane-top .ms-pgrip{display:none}',
    'body.ms-edit-mode .ms-inf:empty,body.ms-edit-mode .ms-sub:empty{display:block;min-height:1em}',
    'body.ms-edit-mode .ms-inf:empty::before{content:"Add an inference (double-click)";color:#94a3b8;font-style:italic}',
    'body.ms-edit-mode .ms-sub:empty::before{content:"Add a subtitle (double-click)";color:#94a3b8;font-style:italic}',
    'body.ms-edit-mode .ms-title:empty::before{content:"Add a title (double-click)";color:#94a3b8;font-style:italic}',
    'body.ms-edit-mode .ms-grid:empty{min-height:160px;border:2px dashed #cbd5e1;border-radius:10px}',
    'body.ms-edit-mode .ms-section>.ms-grid:empty::before{content:"Empty section. Select the section title, then use Insert to add a chart, KPI cards or a text box here."}',
    'body.ms-edit-mode .ms-spacer{outline:1px dashed #cbd5e1}',
    'body.ms-edit-mode .ms-grid:empty::before{content:"Empty tab. Paste a chart (Ctrl+V), drag a chart onto this tab in the ribbon, or use Insert.";display:block;padding:60px 20px;text-align:center;color:#94a3b8;grid-column:1/-1}'
  ].join('\n');

  var TEXT_TAGS = /^(H[1-6]|P|SPAN|LI|TD|TH|LABEL|A|BUTTON|STRONG|EM|B|I|U|SMALL|FIGCAPTION|CAPTION|DT|DD|BLOCKQUOTE|SUMMARY|DIV|TEXT|TSPAN|TITLE|LEGEND|OPTION)$/i;

  function cdoc() { return MS.child && MS.child.doc; }
  E.isGenerated = function (el) {
    for (var n = el; n && n.nodeType === 1 && n.tagName !== 'BODY'; n = n.parentNode) {
      if (n.hasAttribute('data-ms-id') || n.hasAttribute('data-ms-own')) return n !== el && !el.hasAttribute('data-ms-id') && !el.hasAttribute('data-ms-own');
      return true;
    }
    return false;
  };
  function textEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (/^(CANVAS|SVG|IMG|VIDEO|IFRAME|SCRIPT|STYLE|SELECT|INPUT|TEXTAREA|HTML|BODY|SECTION|MAIN|NAV)$/i.test(el.tagName)) return false;
    if (el.querySelector('canvas,svg,iframe,video,img,select,input,.ms-block,[_echarts_instance_],.js-plotly-plot')) return false;
    if (el.querySelectorAll('*').length > 40) return false;
    var hasText = Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); });
    return hasText || TEXT_TAGS.test(el.tagName) || el.classList.contains('ms-title') || el.classList.contains('ms-sub') || el.classList.contains('ms-inf');
  }
  E.textEditable = textEditable;

  /* ------------------------------------------------------------ attach */
  MS.on('child-loaded', function (c) {
    var d = c.doc;
    MS.sel = null;
    var st = d.createElement('style'); st.setAttribute('data-ms-editor', ''); st.textContent = EDITOR_CSS;
    (d.head || d.documentElement).appendChild(st);
    MS.setMode(MS.mode);
    d.addEventListener('mouseover', onOver, true);
    d.addEventListener('mouseout', onOut, true);
    d.addEventListener('click', onClick, true);
    d.addEventListener('dblclick', onDbl, true);
    d.addEventListener('keydown', function (e) { if (!d.activeElement || !d.activeElement.isContentEditable) MS.handleKey(e, true); else if (e.key === 'Escape') { e.preventDefault(); d.activeElement.blur(); } }, true);
    d.addEventListener('dragstart', onDragStart, true);
    d.addEventListener('dragover', onDragOver, true);
    d.addEventListener('dragleave', onDragLeave, true);
    d.addEventListener('drop', onDrop, true);
    d.addEventListener('dragend', clearDrop, true);
    d.addEventListener('mousedown', onGripDown, true);
    c.win.addEventListener('ms:refresh', decorate);
    c.win.addEventListener('ms:tab', function (e) { MS.emit('tab-shown', e.detail); });
    decorate();
    MS.emit('selection', null);
  });

  MS.setMode = function (m) {
    MS.mode = m;
    var c = MS.child; if (!c) return;
    c.win.__MS_EDIT_MODE = m === 'edit';
    c.doc.body && c.doc.body.classList.toggle('ms-edit-mode', m === 'edit');
    if (m !== 'edit') E.select(null);
    MS.$$('[data-mode]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === m); });
    MS.emit('mode', m);
  };

  // Add generated (export-stripped) grips & handles to blocks / ribbon / pane.
  function decorate() {
    var d = cdoc(); if (!d) return;
    MS.$$('.ms-block', d).forEach(function (b) {
      if (!b.querySelector(':scope > .ms-grip')) b.appendChild(d.createElement('div')).className = 'ms-grip';
      if (!b.querySelector(':scope > .ms-drag')) { var h = d.createElement('div'); h.className = 'ms-drag'; h.textContent = '⠿'; h.title = 'Drag to move (hold Ctrl to copy). Drop on a ribbon tab to send it there.'; h.draggable = true; b.appendChild(h); }
    });
    var rib = d.getElementById('ms-ribbon');
    if (rib && !rib.querySelector('.ms-rgrip')) { var g = d.createElement('div'); g.className = 'ms-rgrip'; g.title = 'Drag to resize the ribbon'; rib.appendChild(g); }
    var pane = d.getElementById('ms-filter-pane');
    if (pane && !pane.querySelector('.ms-pgrip')) { var p = d.createElement('div'); p.className = 'ms-pgrip'; p.title = 'Drag to resize the filter pane'; pane.appendChild(p); }
    MS.$$('#ms-ribbon .ms-tabbtn', d).forEach(function (b) { b.setAttribute('data-ms-drop', 'tab'); });
  }
  MS.decorate = decorate;

  /* ------------------------------------------------------------ hover / select */
  var hoverEl = null;
  function onOver(e) {
    if (MS.mode !== 'edit') return;
    if (hoverEl) hoverEl.classList.remove('ms-hover');
    hoverEl = pick(e.target);
    if (hoverEl) hoverEl.classList.add('ms-hover');
  }
  function onOut() { if (hoverEl) { hoverEl.classList.remove('ms-hover'); hoverEl = null; } }

  // choose the most useful element for a click target
  function pick(t) {
    if (!t || t.nodeType !== 1) t = t && t.parentElement;
    if (!t || /^(HTML|BODY)$/.test(t.tagName)) return null;
    if (t.closest('.ms-grip,.ms-drag,.ms-rgrip,.ms-pgrip')) return null;
    var rt = MS.rt();
    if (t.closest('.ms-head') || t.closest('.ms-crumbs')) return t.closest('.ms-title,.ms-sub,.ms-inf') || t;
    var block = t.closest('.ms-block');
    if (block && block.querySelector('.ms-visual') && block.querySelector('.ms-visual').contains(t) && !t.closest('.ms-content-block .ms-visual *')) return block;
    if (rt) { var c = rt.chartOf(t); if (c && (c.el === t || c.el.contains(t) || t.tagName === 'CANVAS')) return block || chartUnit(c.el); }
    if (t.closest('svg') && !/^(text|tspan)$/i.test(t.tagName)) return t.closest('svg');
    return t;
  }
  E.pick = pick;

  function onClick(e) {
    if (MS.mode !== 'edit') return;
    var t = e.target, r = MS.rt();
    if (t.closest && t.closest('[contenteditable="true"]')) return;
    if (t.closest && t.closest('.ms-annot,#ms-story,#ms-story-btn')) return;
    if (r && r.ptClicking) return;
    // the dashboard's own tabs switch in Edit mode too (and get selected, so they can be renamed or styled)
    var pt = r && r.pageTabOf && t.nodeType === 1 ? r.pageTabOf(t) : null;
    if (pt && (pt.btn === t || pt.btn.contains(t))) { e.preventDefault(); e.stopPropagation(); r.showPageTab(pt.index); E.select(pt.btn); MS.emit('structure'); return; }
    if (t.closest && (t.closest('#ms-ribbon .ms-tabbtn') || t.closest('#ms-filter-pane select') || t.closest('.ms-crumbs button') || t.closest('.ms-modal-wrap') || t.closest('.ms-pane-reset'))) {
      if (t.closest('#ms-ribbon .ms-tabbtn')) setTimeout(function () { MS.emit('structure'); }, 0);
      return;
    }
    e.preventDefault(); e.stopPropagation();
    E.select(pick(t));
    // a click on a Chart.js legend entry: change that colour (chart and legend together)
    var ch = r && t.tagName === 'CANVAS' ? r.chartOf(t) : null, lg = ch && ch.lib === 'chartjs' && ch.inst.legend;
    if (lg && lg.legendHitBoxes && lg.options && lg.options.display !== false) {
      var bx = t.getBoundingClientRect(), x = e.clientX - bx.left, y = e.clientY - bx.top;
      lg.legendHitBoxes.forEach(function (hb, i) { var it = lg.legendItems[i]; if (it && x >= hb.left && x <= hb.left + hb.width && y >= hb.top && y <= hb.top + hb.height) MS.catColors.pick(it.text, ch.key); });
    }
  }
  function onDbl(e) {
    if (MS.mode !== 'edit') return;
    var t = e.target;
    if (t.closest && t.closest('[contenteditable="true"]')) return;
    if (t.closest && t.closest('.ms-annot,#ms-story')) return;
    e.preventDefault(); e.stopPropagation();
    if (t.closest && t.closest('#ms-ribbon .ms-tabbtn')) { var id = t.closest('.ms-tabbtn').getAttribute('data-ms-tabbtn'); return MS.tabs.rename(id); }
    var ptb = MS.rt() && t.nodeType === 1 && MS.rt().pageTabOf ? MS.rt().pageTabOf(t) : null;
    if (ptb && (ptb.btn === t || ptb.btn.contains(t))) return MS.pageTabs.rename(ptb.index);
    var kp = t.closest && t.closest('.ms-kpi');
    if (kp && t.closest('.ms-kpi-value')) { E.select(kp); return kp.hasAttribute('data-ms-kpi') ? MS.compose.kpiSettings(kp) : E.startText(t.closest('.ms-kpi-value')); }
    var p = pick(t);
    var rt = MS.rt(), c = p && rt && rt.chartOf(p);
    if (c && !(p.closest('.ms-head'))) { E.select(p); return MS.charts.settings(c.key); }
    var target = textEditable(t) ? t : (textEditable(p) ? p : null);
    if (target && /^(text|tspan)$/i.test(target.tagName)) return E.editSvgText(target);
    if (target) E.startText(target);
  }

  E.select = function (el) {
    var d = cdoc();
    if (MS.sel && MS.sel.classList) MS.sel.classList.remove('ms-sel');
    MS.sel = el || null;
    if (el) el.classList.add('ms-sel');
    MS.emit('selection', el);
  };
  E.reveal = function (el, flash) {
    var rt = MS.rt();
    var sec = el.closest && el.closest('section.ms-tab');
    if (sec && rt && !sec.classList.contains('ms-active')) { rt.showTab(sec.getAttribute('data-ms-tab')); MS.emit('structure'); }
    var pt = MS.pageTabs && MS.pageTabs.of(el);
    if (pt && !pt.active) { rt.showPageTab(pt.index); MS.emit('structure'); }
    setTimeout(function () {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (flash) { el.classList.remove('ms-flash'); void el.offsetWidth; el.classList.add('ms-flash'); setTimeout(function () { el.classList.remove('ms-flash'); }, 1600); }
    }, 60);
    if (MS.mode === 'edit') E.select(el);
  };

  function chartUnit(el) {
    // walk up while the parent only wraps this element (a chart's own container)
    var u = el;
    var kids = function (p) { return Array.prototype.filter.call(p.children, function (k) { return !k.classList.contains('ms-crumbs') && !k.classList.contains('ms-source') && !k.classList.contains('ms-summary') && !k.classList.contains('ms-annot-layer') && !k.hasAttribute('data-ms-editor') && !k.classList.contains('ms-grip') && !k.classList.contains('ms-drag'); }).length; };
    while (u.parentElement && !/^(BODY|SECTION|MAIN)$/.test(u.parentElement.tagName) && kids(u.parentElement) === 1 &&
      !u.parentElement.classList.contains('ms-visual') && !u.parentElement.classList.contains('ms-grid') && u.parentElement.id !== 'ms-main') u = u.parentElement;
    return u;
  }
  E.chartUnit = chartUnit;

  /* ------------------------------------------------------------ text editing */
  E.startText = function (el) {
    if (E.isGenerated(el)) MS.toast('This text is written by the dashboard\'s own script, so it may be rewritten when the page reloads.', 'warn', 6000);
    var before = el.innerHTML;
    el.contentEditable = 'true'; el.spellcheck = true;
    el.classList.add('ms-editing');
    E.select(el);
    el.focus();
    try { var r = cdoc().createRange(); r.selectNodeContents(el); var s = MS.child.win.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
    MS.editingText = el;
    MS.emit('text-editing', el);
    var single = /^(H[1-6]|BUTTON|LABEL|A|SPAN|TH|TD|OPTION)$/.test(el.tagName) || el.classList.contains('ms-title');
    function key(e) { if (e.key === 'Enter' && single && !e.shiftKey) { e.preventDefault(); el.blur(); } }
    function done() {
      el.removeEventListener('blur', done); el.removeEventListener('keydown', key);
      el.removeAttribute('contenteditable'); el.removeAttribute('spellcheck'); el.classList.remove('ms-editing');
      MS.editingText = null;
      var after = el.innerHTML;
      if (after === before) return MS.emit('text-editing', null);
      E.commitText(el, before, after);
      MS.emit('text-editing', null);
    }
    el.addEventListener('blur', done); el.addEventListener('keydown', key);
  };
  E.commitText = function (el, before, after) {
    var rt = MS.rt();
    if (rt) rt.tagTree(el);
    var id = el.getAttribute('data-ms-id');
    var ovBefore = rt && id ? rt.state.textOverrides[id] : undefined;
    function put(html, ov) {
      el.innerHTML = html;
      if (rt && id) { if (ov === undefined) delete rt.state.textOverrides[id]; else rt.state.textOverrides[id] = ov; }
      MS.afterDomChange(el);
    }
    // static text could be rewritten by the page's scripts on load: store an override that the runtime re-applies
    var ovAfter = id && !el.closest('[data-ms-own]') ? after : ovBefore;
    put(after, ovAfter);
    MS.history.push({ label: 'Edit text', undo: function () { put(before, ovBefore); }, redo: function () { put(after, ovAfter); } }, true);
  };
  E.editSvgText = function (t) {
    MS.prompt('Edit chart text', t.textContent).then(function (v) {
      if (v === null) return;
      var b = t.textContent;
      var put = function (x) { t.textContent = x; };
      put(v);
      MS.history.push({ label: 'Edit chart text', undo: function () { put(b); }, redo: function () { put(v); } }, true);
      if (E.isGenerated(t)) MS.toast('This text is drawn by the chart script. It will revert when the page reloads. Use Chart settings to change titles and labels permanently.', 'warn', 7000);
    });
  };

  // Formatting: if text is being edited and there's a selection, use execCommand; otherwise style the element.
  E.format = function (cmd, value) {
    var d = cdoc(); if (!d) return;
    if (MS.editingText) { d.execCommand('styleWithCSS', false, true); d.execCommand(cmd, false, value); return; }
    if (!MS.sel) return MS.toast('Select something in the dashboard first.');
    var map = { bold: ['fontWeight', '700', 'normal'], italic: ['fontStyle', 'italic', 'normal'], underline: ['textDecoration', 'underline', 'none'] };
    if (map[cmd]) {
      var cs = MS.child.win.getComputedStyle(MS.sel);
      var on = cmd === 'bold' ? Number(cs.fontWeight) >= 600 : cs[map[cmd][0]].indexOf(map[cmd][1]) >= 0;
      var o = {}; o[map[cmd][0]] = on ? map[cmd][2] : map[cmd][1];
      return E.style(MS.sel, o, cmd);
    }
    if (cmd === 'foreColor') return E.style(MS.sel, { color: value }, 'Text colour');
    if (cmd === 'hiliteColor') return E.style(MS.sel, { backgroundColor: value }, 'Highlight');
    if (cmd === 'fontName') return E.style(MS.sel, { fontFamily: value }, 'Font');
    if (cmd === 'justify') return E.style(MS.sel, { textAlign: value }, 'Align');
    if (cmd === 'removeFormat') return MS.history.attrs('Clear formatting', MS.sel, ['style'], function (el) { el.removeAttribute('style'); });
  };
  E.style = function (el, props, label) {
    if (!el) return;
    // a legend swatch written in the page: recolour the chart instead, and the swatch follows
    var bgv = props.backgroundColor || props.background, lg = bgv && MS.rt() && MS.rt().legendOf ? MS.rt().legendOf(el) : null;
    if (lg) { var m = {}; m[lg.name] = bgv; return MS.catColors.set(m, 'Colour of “' + lg.name + '”'); }
    if (MS.firm && MS.firm.blocksStyle(props, null, 'text colours and fonts')) return false;
    if (E.isGenerated(el)) MS.toast('This element is drawn by the dashboard\'s script, so style changes may not survive a reload.', 'warn', 5000);
    MS.history.attrs(label || 'Style', el, ['style'], function (x) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (k.indexOf('--') === 0) { if (v === '' || v == null) x.style.removeProperty(k); else x.style.setProperty(k, v); }
        else x.style[k] = v == null ? '' : v;
      });
      if (!x.getAttribute('style')) x.removeAttribute('style');
    });
  };

  /* ------------------------------------------------------------ blocks */
  var B = MS.blocks = {};
  function newEl(tag, cls, text) {
    var d = cdoc(), e = d.createElement(tag);
    if (cls) e.className = cls;
    e.setAttribute('data-ms-own', '');
    if (text) e.textContent = text;
    return e;
  }
  B.create = function (o) {
    o = o || {};
    var b = newEl('div', 'ms-block' + (o.inline ? ' ms-inline' : '') + (o.content ? ' ms-content-block' : ''));
    // plain divs (not header/h3/p) so the dashboard's own CSS for those tags doesn't leak in
    var head = newEl('div', 'ms-head');
    var t = head.appendChild(newEl('div', 'ms-title', o.title || ''));
    t.setAttribute('role', 'heading'); t.setAttribute('aria-level', '3');
    head.appendChild(newEl('div', 'ms-sub', o.sub || ''));
    head.appendChild(newEl('div', 'ms-inf', o.inf || ''));
    b.appendChild(head);
    b.appendChild(newEl('div', 'ms-crumbs'));
    var vis = newEl('div', 'ms-visual');
    if (o.node) vis.appendChild(o.node);
    if (o.html) { vis.innerHTML = o.html; MS.rt() && MS.rt().tagTree(vis); }
    b.appendChild(vis);
    if (o.span) b.style.gridColumn = 'span ' + o.span;
    if (o.height) vis.style.setProperty('--ms-h', o.height + 'px');
    return b;
  };
  B.of = function (el) { return el && el.closest && el.closest('.ms-block'); };
  B.chartKey = function (el) { var rt = MS.rt(), c = rt && el && rt.chartOf(el.classList.contains('ms-block') ? el.querySelector('.ms-visual') || el : el); return c ? c.key : null; };

  // Wrap a chart (or any element) with a title / subtitle / inference header.
  B.wrap = function (el, inline) {
    if (!el) return null;
    var existing = B.of(el); if (existing) return existing;
    var rt = MS.rt(), c = rt && rt.chartOf(el), unit = c ? chartUnit(c.el) : el;
    var info = c ? rt.chartInfo(c.key) : null;
    var heading = headingFor(unit);
    var title = (heading && heading.textContent.trim()) || (info && info.title) || guessTitle(unit) || '';
    var b = B.create({ title: title, inline: inline !== false, content: !c });
    var size = unit.getBoundingClientRect();
    MS.history.group('Add commentary', function () {
      // the card's own heading becomes the block title (no duplicate titles)
      if (heading) MS.history.move('Absorb heading', heading, function () { heading.remove(); });
      MS.history.move('Insert block', b, function () { unit.parentNode.insertBefore(b, unit); });
      MS.history.move('Move into block', unit, function () { b.querySelector('.ms-visual').appendChild(unit); });
    });
    if (c && size.height > 40 && inline === false) b.querySelector('.ms-visual').style.setProperty('--ms-h', Math.round(size.height) + 'px');
    return b;
  };
  // the element before `unit`, skipping drill-down breadcrumbs the runtime put there
  function prevOf(unit) { var p = unit.previousElementSibling; while (p && p.classList.contains('ms-crumbs')) p = p.previousElementSibling; return p; }
  function headingFor(unit) {
    var p = prevOf(unit);
    if (p && (/^H[1-6]$/.test(p.tagName) || /(^|[-_\s])(title|heading|header)([-_\s]|$)/i.test(p.className)) && !p.querySelector('canvas,svg,img,table') && p.textContent.trim().length < 140 && !p.closest('.ms-block')) return p;
    return null;
  }
  function guessTitle(unit) {
    var p = prevOf(unit);
    if (p && /^H[1-6]$/.test(p.tagName) && p.textContent.length < 120) return p.textContent.trim();
    var par = unit.parentElement, h = par && par.querySelector('h1,h2,h3,h4,h5,h6');
    if (h && h.textContent.length < 120 && !h.closest('.ms-block')) return h.textContent.trim();
    return '';
  }
  B.guessTitle = function (el) { var rt = MS.rt(), c = rt && rt.chartOf(el); return guessTitle(c ? chartUnit(c.el) : el); };
  B.wrapAll = function () {
    var rt = MS.rt(); if (!rt) return;
    var n = 0;
    MS.history.group('Add commentary to all charts', function () {
      rt.charts().forEach(function (c) { if (!B.of(c.el) && !c.el.closest('[data-ms-copyof]')) { B.wrap(c.el, true); n++; } });
    });
    MS.toast(n ? 'Added title, subtitle and inference slots to ' + n + ' chart(s). Double-click them to type.' : 'Every chart already has commentary.', 'ok');
  };

  function ensureGrid(section) {
    var g = section.querySelector(':scope > .ms-grid');
    if (!g) { g = newEl('div', 'ms-grid'); MS.history.move('Add grid', g, function () { section.appendChild(g); }); }
    return g;
  }
  B.ensureGrid = ensureGrid;

  // Move (or copy) a block/chart/element to another tab.
  B.sendToTab = function (el, tabId, copy) {
    var rt = MS.rt(); if (!rt) return;
    var sec = rt.tabEl(tabId); if (!sec) return;
    var block = B.of(el) || el;
    var kind = sec.getAttribute('data-ms-kind');
    var host = kind === 'content' ? (sec.querySelector('.ms-doc') || sec) : ensureGrid(sec);
    MS.history.group((copy ? 'Copy' : 'Move') + ' to ' + sec.getAttribute('data-ms-title'), function () {
      var node, from = (B.of(block) || block).parentNode;
      if (copy) node = MS.clipboard.fit(B.duplicate(block, true), host);
      else {
        node = block.classList.contains('ms-block') ? block : B.wrap(block, false);
        if (node.classList.contains('ms-inline')) MS.history.attrs('Grid block', node, ['class'], function (x) { x.classList.remove('ms-inline'); });
      }
      MS.history.move('Place block', node, function () { host.appendChild(node); });
      if (!copy) removeIfEmpty(from);
    });
    MS.toast((copy ? 'Copied' : 'Moved') + ' to "' + sec.getAttribute('data-ms-title') + '".', 'ok');
    MS.afterDomChange();
  };

  // After moving a chart out of its card, remove the card if nothing is left in it.
  B.removeIfEmpty = function (n) { removeIfEmpty(n); };
  function removeIfEmpty(n) {
    while (n && n.nodeType === 1 && !/^(BODY|MAIN|SECTION)$/.test(n.tagName) && !n.classList.contains('ms-grid') && !n.classList.contains('ms-visual') && !n.id.match(/^ms-/) &&
      !n.children.length && !n.textContent.trim()) {
      var p = n.parentNode, el = n;
      MS.history.move('Remove empty card', el, function () { el.remove(); });
      n = p;
    }
  }

  // Copy a block, chart or any part (see clipboard.js): charts become live copies, nothing is changed in the original.
  B.duplicate = function (el, detached) {
    if (!detached) return MS.clipboard.duplicate(el);
    return MS.clipboard.clone(MS.clipboard.unitOf(el) || el);
  };

  B.remove = function (el) {
    if (!el || !el.parentNode) return;
    if (/^(BODY|HTML)$/.test(el.tagName) || el.id === 'ms-app' || el.id === 'ms-main') return MS.toast('That element holds the whole page and can\'t be deleted.', 'warn');
    var key = B.chartKey(el), rt = MS.rt();
    if (key && rt && cdoc().querySelector('[data-ms-copyof="' + key + '"]')) MS.toast('Other tabs hold copies of this chart. They need it to draw, so it is hidden rather than deleted.', 'warn', 7000);
    if (key && rt && cdoc().querySelector('[data-ms-copyof="' + key + '"]')) return E.style(el, { display: 'none' }, 'Hide');
    E.select(null);
    MS.history.move('Delete', el, function () { el.parentNode.removeChild(el); });
  };

  B.resize = function (block, span, height) {
    var vis = block.querySelector(':scope > .ms-visual');
    MS.history.group('Resize', function () {
      if (span != null) MS.history.attrs('Width', block, ['style'], function (x) { x.style.gridColumn = 'span ' + span; });
      if (height != null && vis) MS.history.attrs('Height', vis, ['style'], function (x) { x.style.setProperty('--ms-h', height + 'px'); });
    });
  };

  /* ------------------------------------------------------------ drag & drop */
  var dragNode = null;
  function onDragStart(e) {
    var h = e.target.closest && e.target.closest('.ms-drag');
    if (!h || MS.mode !== 'edit') return;
    dragNode = h.parentElement;
    dragNode.classList.add('ms-dragging');
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', 'ms-block');
    try { e.dataTransfer.setDragImage(dragNode, 20, 20); } catch (x) {}
  }
  function clearDrop() {
    var d = cdoc(); if (!d) return;
    MS.$$('.ms-drop-before,.ms-drop-after,.ms-drop-end,.ms-drop', d).forEach(function (n) { n.classList.remove('ms-drop-before', 'ms-drop-after', 'ms-drop-end', 'ms-drop'); });
    if (dragNode && dragNode.classList) dragNode.classList.remove('ms-dragging');
  }
  function dropTarget(e) {
    var t = e.target.closest ? e.target : e.target.parentElement;
    var tab = t.closest('#ms-ribbon .ms-tabbtn'); if (tab) return { tab: tab };
    var b = t.closest('.ms-block'); if (b && b !== dragNode && !dragNode.contains(b)) { var r = b.getBoundingClientRect(); return { block: b, after: e.clientX > r.left + r.width / 2 }; }
    var g = t.closest('.ms-grid'); if (g) return { grid: g };
    return null;
  }
  function onDragOver(e) {
    if (!dragNode) return;
    var d = dropTarget(e); clearDrop(); dragNode.classList.add('ms-dragging');
    if (!d) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = (e.ctrlKey || e.metaKey || e.altKey) ? 'copy' : 'move';
    if (d.tab) d.tab.classList.add('ms-drop');
    else if (d.block) d.block.classList.add(d.after ? 'ms-drop-after' : 'ms-drop-before');
    else d.grid.classList.add('ms-drop-end');
  }
  function onDragLeave() {}
  function onDrop(e) {
    if (!dragNode) return;
    var d = dropTarget(e), node = dragNode, copy = e.ctrlKey || e.metaKey || e.altKey;
    clearDrop(); dragNode = null;
    if (!d) return;
    e.preventDefault();
    if (d.tab) return B.sendToTab(node, d.tab.getAttribute('data-ms-tabbtn'), copy);
    MS.history.group(copy ? 'Copy block' : 'Move block', function () {
      var n = copy ? MS.clipboard.fit(B.duplicate(node, true), d.grid || d.block.parentNode) : node;
      if (node.classList.contains('ms-inline') && (d.grid || (d.block && d.block.parentElement.classList.contains('ms-grid')))) MS.history.attrs('Grid block', n, ['class'], function (x) { x.classList.remove('ms-inline'); });
      MS.history.move('Place', n, function () {
        if (d.block) d.block.parentNode.insertBefore(n, d.after ? d.block.nextSibling : d.block);
        else d.grid.appendChild(n);
      });
    });
  }

  /* ------------------------------------------------------------ grips (resize block / ribbon / pane) */
  function onGripDown(e) {
    var t = e.target;
    if (!t.classList || MS.mode !== 'edit') return;
    var d = cdoc(), w = MS.child.win, rt = MS.rt();
    if (t.classList.contains('ms-grip')) {
      e.preventDefault(); e.stopPropagation();
      var block = t.parentElement, vis = block.querySelector(':scope > .ms-visual'), grid = block.parentElement;
      var inGrid = grid.classList.contains('ms-grid');
      var before = { b: block.getAttribute('style'), v: vis && vis.getAttribute('style') };
      var gr = grid.getBoundingClientRect(), gap = parseFloat(w.getComputedStyle(grid).columnGap) || 16;
      var colW = (gr.width - 11 * gap) / 12;
      var mv = function (ev) {
        var br = block.getBoundingClientRect();
        if (inGrid) { var span = Math.max(1, Math.min(12, Math.round((ev.clientX - br.left + gap) / (colW + gap)))); block.style.gridColumn = 'span ' + span; }
        else block.style.width = Math.max(120, ev.clientX - br.left) + 'px';
        if (vis) { var vr = vis.getBoundingClientRect(); vis.style.setProperty('--ms-h', Math.max(80, Math.round(ev.clientY - vr.top)) + 'px'); if (!vis.style.height && block.classList.contains('ms-inline')) vis.style.height = 'var(--ms-h)'; }
        rt && rt.charts().forEach(function (c) { if (block.contains(c.el)) c.a.resize(c.inst); });
        MS.status('Width: ' + (inGrid ? block.style.gridColumn.replace('span ', '') + '/12 columns' : block.style.width) + ' · Height: ' + (vis ? vis.style.getPropertyValue('--ms-h') : ''));
      };
      var up = function () {
        d.removeEventListener('mousemove', mv, true); d.removeEventListener('mouseup', up, true);
        var after = { b: block.getAttribute('style'), v: vis && vis.getAttribute('style') };
        var put = function (o) { setAttr(block, 'style', o.b); if (vis) setAttr(vis, 'style', o.v); MS.afterDomChange(block); };
        MS.history.push({ label: 'Resize block', undo: function () { put(before); }, redo: function () { put(after); } }, true);
        MS.afterDomChange(block);
      };
      d.addEventListener('mousemove', mv, true); d.addEventListener('mouseup', up, true);
    } else if (t.classList.contains('ms-rgrip') || t.classList.contains('ms-pgrip')) {
      e.preventDefault(); e.stopPropagation();
      var rib = t.classList.contains('ms-rgrip'), L = rt.state.layout;
      var start = JSON.stringify(rt.state), host = t.parentElement;
      var mv2 = function (ev) {
        var r = host.getBoundingClientRect();
        if (rib) { if (L.ribbon.position === 'left') L.ribbon.height = Math.max(120, Math.round(ev.clientX - r.left)); else L.ribbon.height = Math.max(28, Math.min(160, Math.round(ev.clientY - r.top))); }
        else L.pane.width = Math.max(140, Math.min(600, Math.round(ev.clientX - r.left)));
        d.documentElement.style.setProperty(rib ? '--ms-ribbon-h' : '--ms-pane-w', (rib ? L.ribbon.height : L.pane.width) + 'px');
      };
      var up2 = function () {
        d.removeEventListener('mousemove', mv2, true); d.removeEventListener('mouseup', up2, true);
        d.documentElement.style.removeProperty('--ms-ribbon-h'); d.documentElement.style.removeProperty('--ms-pane-w');
        var end = JSON.stringify(rt.state);
        rt.refresh(true);
        MS.history.push({ label: rib ? 'Resize ribbon' : 'Resize filter pane', undo: function () { MS.rt().setState(JSON.parse(start)); }, redo: function () { MS.rt().setState(JSON.parse(end)); } }, true);
        MS.rt().charts().forEach(function (c) { c.a.resize(c.inst); });
      };
      d.addEventListener('mousemove', mv2, true); d.addEventListener('mouseup', up2, true);
    }
  }
  function setAttr(el, a, v) { if (v == null) el.removeAttribute(a); else el.setAttribute(a, v); }

  /* ------------------------------------------------------------ find & replace */
  E.findReplace = function () {
    var f = MS.form([{ key: 'find', label: 'Find', value: '' }, { key: 'repl', label: 'Replace with', value: '' }, { key: 'case', label: 'Match case', type: 'checkbox' }]);
    MS.dialog({ title: 'Find & replace text', body: f, buttons: [{ label: 'Cancel', value: null }, { label: 'Replace all', primary: true, value: function () { return f.values(); } }] }).then(function (v) {
      if (!v || !v.find) return;
      var d = cdoc(), w = MS.child.win, n = 0, changed = [];
      var walker = d.createTreeWalker(d.body, w.NodeFilter.SHOW_TEXT, null);
      var re = new RegExp(v.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), v['case'] ? 'g' : 'gi');
      var node;
      while ((node = walker.nextNode())) {
        var p = node.parentElement;
        if (!p || /^(SCRIPT|STYLE)$/.test(p.tagName) || p.closest('[data-ms-editor]')) continue;
        if (re.test(node.nodeValue)) { re.lastIndex = 0; changed.push([node, node.nodeValue]); n += (node.nodeValue.match(re) || []).length; }
        re.lastIndex = 0;
      }
      changed.forEach(function (c) { c.push(c[1].replace(re, v.repl)); c[0].nodeValue = c[2]; });
      if (changed.length) MS.history.push({ label: 'Replace "' + v.find + '"',
        undo: function () { changed.forEach(function (c) { c[0].nodeValue = c[1]; }); },
        redo: function () { changed.forEach(function (c) { c[0].nodeValue = c[2]; }); } }, true);
      MS.toast(n + ' replacement(s).', n ? 'ok' : '');
    });
  };
})(window.MS);
