/* Move parts with the mouse, like PowerPoint: press on a chart, KPI card, text or section and
   drag it. A blue bar shows where it will land (hold Ctrl to copy instead); drop it on one of
   the dashboard's tabs to send it there. Esc cancels. Also the small toolbar that floats over
   the selected part (move handle, picture, draw, settings, duplicate, delete, more). */
(function (MS) {
  'use strict';
  var Mv = MS.move = {};
  var THRESH = 6;
  function cdoc() { return MS.child && MS.child.doc; }
  function cwin() { return MS.child && MS.child.win; }
  function Cb() { return MS.clipboard; }

  var SKIP = '#ms-ribbon,#ms-filter-pane,.ms-floatbar,.ms-annot-layer,.ms-annot,.ms-grip,.ms-drag,.ms-rgrip,.ms-pgrip,.ms-size-handle,[data-ms-editor],#ms-story,#ms-story-btn,#ms-badge,#ms-stamp,#ms-watermark,#ms-firm-foot,.ms-cmt-pin,#ms-cmt-layer,input,select,textarea,option,[contenteditable="true"]';
  // Not something to pick up: the page itself, the layout's own boxes and the runtime's layers.
  function fixedPart(el) {
    if (!el || el.nodeType !== 1 || /^(HTML|BODY|HEAD)$/.test(el.tagName)) return true;
    if (el.id === 'ms-app' || el.id === 'ms-main' || el.matches('section.ms-tab')) return true;
    if (Cb() && Cb().isContainer(el)) return true;
    var rt = MS.rt(), pt = rt && rt.pageTabOf && rt.pageTabOf(el);
    if (pt && (pt.btn === el || pt.btn.contains(el))) return true;
    var cs = cwin().getComputedStyle(el);
    return cs.position === 'fixed';
  }
  // What a press picks up. The selected part itself if the press is on it; otherwise the card
  // around what was pressed (a chart's card, a KPI card), else the part.
  Mv.unitAt = function (t) {
    if (!t || t.nodeType !== 1) t = t && t.parentElement;
    if (!t || t.closest(SKIP)) return null;
    var sel = MS.sel && MS.sel.isConnected ? MS.sel : null, u;
    if (sel && (sel === t || sel.contains(t)) && !fixedPart(sel)) u = Cb().unitOf(sel) || sel;
    else {
      u = Cb().unitOf(t);
      var card = u && Cb().cardOf(u, false);
      if (card && !fixedPart(card)) u = card;
    }
    if (!u || fixedPart(u)) return null;
    return u;
  };

  /* ---------------------------------------------------------------- where a drop lands */
  function kids(host, skip) {
    return Array.prototype.filter.call(host.children, function (k) {
      if (k === skip || k.matches(SKIP) || /^(SCRIPT|STYLE|TEMPLATE|LINK|META)$/.test(k.tagName) || /^ms-(state|runtime|early)$/.test(k.id || '')) return false;
      var r = k.getBoundingClientRect(); return r.width > 0 && r.height > 0;
    });
  }
  // Side by side (a row, a grid with columns) or one under another?
  function sideBySide(host, ref, skip) {
    var cs = cwin().getComputedStyle(host);
    if (/flex/.test(cs.display)) return !/column/.test(cs.flexDirection);
    var r = ref.getBoundingClientRect();
    return kids(host, skip).some(function (k) { if (k === ref) return false; var q = k.getBoundingClientRect(); return Math.abs(q.top - r.top) < Math.min(r.height, q.height) / 2 && Math.abs(q.left - r.left) > 4; });
  }
  function nearestKid(host, x, y, skip) {
    var best = null;
    kids(host, skip).forEach(function (k) {
      var r = k.getBoundingClientRect(), dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0, dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0, dist = dx * dx + dy * dy;
      if (!best || dist < best.dist) best = { el: k, dist: dist };
    });
    return best && best.el;
  }
  function placeBy(ref, x, y, node) {
    var host = ref.parentElement; if (!host) return null;
    var r = ref.getBoundingClientRect(), row = sideBySide(host, ref, node);
    var after = row ? x > r.left + r.width / 2 : y > r.top + r.height / 2;
    return { host: host, ref: after ? ref.nextSibling : ref, beside: ref, after: after, row: row };
  }
  // A drop at (x, y) in the dashboard's own coordinates: {host, ref, ...} or {tab} or null.
  Mv.dropAt = function (x, y, node) {
    var d = cdoc(), rt = MS.rt(), t = d.elementFromPoint(x, y);
    if (!t) return null;
    if (t.nodeType !== 1) t = t.parentElement;
    var rtab = t.closest('#ms-ribbon .ms-tabbtn');
    if (rtab) return { ribbonTab: rtab.getAttribute('data-ms-tabbtn'), label: rtab.textContent.trim() };
    var pt = rt && rt.pageTabOf ? rt.pageTabOf(t) : null;
    if (pt && (pt.btn === t || pt.btn.contains(t))) return pt.panel.contains(node) ? null : { pageTab: pt.index, label: pt.title, panel: pt.panel };
    if (node === t || node.contains(t)) return { self: true };
    if (t.closest(SKIP) && !t.closest('#ms-firm-foot')) { var near = t.closest('.ms-annot-layer'); t = near && near.parentElement || t.parentElement; if (!t) return null; }
    // the gap of a layout box (a grid, a row, a tab): next to the nearest thing in it
    var inside = kids(t, node).some(function (k) { var r = k.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });
    if (!inside && kids(t, node).length && (fixedPart(t) || /grid|flex/.test(cwin().getComputedStyle(t).display))) {
      if (t.contains(node) && node.parentElement !== t && !kids(t, node).length) return null;
      var k = nearestKid(t, x, y, node); if (k) return placeBy(k, x, y, node);
    }
    if (!inside && !kids(t, node).length && fixedPart(t)) return { host: t, ref: null, empty: true };
    var u = Mv.unitAt(t);
    if (!u) {
      // a press in the page's own box: the nearest part in it
      var host = fixedPart(t) ? t : t.parentElement, k2 = host && nearestKid(host, x, y, node);
      return k2 ? placeBy(k2, x, y, node) : null;
    }
    if (u === node) return { self: true };
    if (u.contains(node)) { var k3 = nearestKid(u, x, y, node); return k3 && k3 !== node ? placeBy(k3, x, y, node) : null; }
    return placeBy(u, x, y, node);
  };
  // The tab panel's main box, for a drop on a tab button.
  function hostIn(panel) {
    var best = null, w = cwin();
    MS.$$('*', panel).forEach(function (n) {
      if (!/grid|flex/.test(w.getComputedStyle(n).display) || n.closest(SKIP)) return;
      var c = kids(n).filter(function (k) { return MS.clipboard.cardOf(k, false) === null && k.offsetHeight > 40; }).length;
      if (!best || c > best.c) best = { n: n, c: c };
    });
    return best && best.c >= 2 ? best.n : panel;
  }
  Mv.hostIn = hostIn;

  /* ---------------------------------------------------------------- the drop bar and the ghost */
  var UI = null;
  function ui() {
    var d = cdoc();
    if (UI && UI.bar.ownerDocument === d && UI.bar.isConnected) return UI;
    var mk = function (css, cls) { var n = d.createElement('div'); n.setAttribute('data-ms-editor', ''); n.className = cls; n.style.cssText = css; d.body.appendChild(n); return n; };
    UI = {
      bar: mk('position:fixed;z-index:2147483600;pointer-events:none;display:none;background:var(--msx-accent,#4f46e5);border-radius:3px;box-shadow:0 0 0 2px rgba(255,255,255,.9),0 2px 8px rgba(79,70,229,.45)', 'ms-drop-bar'),
      box: mk('position:fixed;z-index:2147483599;pointer-events:none;display:none;border:2px dashed #4f46e5;border-radius:10px;background:rgba(79,70,229,.06)', 'ms-drop-box'),
      ghost: mk('position:fixed;z-index:2147483601;pointer-events:none;display:none;box-sizing:border-box;border:1.5px solid #4f46e5;border-radius:10px;background:rgba(255,255,255,.92);box-shadow:0 12px 32px rgba(15,23,42,.25);font:600 12px/1.35 system-ui,sans-serif;color:#1e1b4b;padding:8px 10px;overflow:hidden;transform:rotate(-1.2deg)', 'ms-drop-ghost'),
      chip: mk('position:fixed;z-index:2147483602;pointer-events:none;display:none;background:#1e1b4b;color:#fff;font:600 11.5px/1 system-ui,sans-serif;padding:6px 9px;border-radius:999px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.25)', 'ms-drop-chip')
    };
    return UI;
  }
  function hideUi() { if (!UI) return; ['bar', 'box', 'ghost', 'chip'].forEach(function (k) { if (UI[k]) UI[k].style.display = 'none'; }); }
  function showDrop(t, x, y, copy) {
    var u = ui(); u.bar.style.display = 'none'; u.box.style.display = 'none';
    var verb = copy ? 'Copy' : 'Move', text = '';
    if (!t || t.self) text = t && t.self ? '' : 'Can\'t drop here';
    else if (t.ribbonTab || t.pageTab != null) {
      var tb = t.ribbonTab ? cdoc().querySelector('#ms-ribbon [data-ms-tabbtn="' + t.ribbonTab + '"]') : MS.rt().pageTabs().tabs[t.pageTab].btn, r0 = tb.getBoundingClientRect();
      Object.assign(u.box.style, { display: 'block', left: (r0.left - 3) + 'px', top: (r0.top - 3) + 'px', width: (r0.width + 6) + 'px', height: (r0.height + 6) + 'px' });
      text = verb + ' to the "' + t.label + '" tab';
    } else if (t.empty) {
      var r1 = t.host.getBoundingClientRect();
      Object.assign(u.box.style, { display: 'block', left: r1.left + 'px', top: r1.top + 'px', width: r1.width + 'px', height: Math.max(40, r1.height) + 'px' });
      text = verb + ' here';
    } else {
      var r = t.beside.getBoundingClientRect(), gap = 0, sib = t.after ? t.beside.nextElementSibling : t.beside.previousElementSibling;
      if (sib && sib.getBoundingClientRect().width) { var q = sib.getBoundingClientRect(); gap = t.row ? (t.after ? q.left - r.right : r.left - q.right) : (t.after ? q.top - r.bottom : r.top - q.bottom); if (gap < 0 || gap > 60) gap = 0; }
      if (t.row) Object.assign(u.bar.style, { display: 'block', width: '4px', height: Math.max(24, r.height) + 'px', top: r.top + 'px', left: ((t.after ? r.right + gap / 2 : r.left - gap / 2) - 2) + 'px' });
      else Object.assign(u.bar.style, { display: 'block', height: '4px', width: Math.max(24, r.width) + 'px', left: r.left + 'px', top: ((t.after ? r.bottom + gap / 2 : r.top - gap / 2) - 2) + 'px' });
      text = verb + (t.row ? (t.after ? ' to the right' : ' to the left') : (t.after ? ' below' : ' above'));
    }
    u.chip.textContent = text; u.chip.style.display = text ? 'block' : 'none';
    u.chip.style.left = (x + 16) + 'px'; u.chip.style.top = (y + 18) + 'px';
    u.ghost.style.left = (x - 14) + 'px'; u.ghost.style.top = (y - 14) + 'px';
  }
  function nameOf(node) {
    var rt = MS.rt(), c = rt && rt.charts().filter(function (x) { return node === x.el || node.contains(x.el); })[0];
    if (c) return MS.charts.nameOf(c.key);
    var hd = node.querySelector && node.querySelector('h1,h2,h3,h4,.ms-title');
    return ((hd && hd.textContent) || node.textContent || node.tagName).replace(/\s+/g, ' ').trim().slice(0, 60);
  }

  /* ---------------------------------------------------------------- the drag */
  var S = null, swallowUntil = 0;
  Mv.active = function () { return !!(S && S.dragging); };
  Mv.swallowClick = function () { return Date.now() < swallowUntil; };
  function onDown(e) {
    if (e.button !== 0 || MS.mode !== 'edit' || MS.editingText || (MS.shapes && MS.shapes.tool) || (MS.review && MS.review.picking) || (MS.painter && MS.painter.painting)) return;
    var t = e.target; if (t.nodeType !== 1) t = t.parentElement;
    if (!t || t.closest(SKIP + ',a[href],button,.ms-tabbtn')) return;
    var node = Mv.unitAt(t); if (!node) return;
    S = { node: node, x: e.clientX, y: e.clientY, dragging: false, handle: false };
  }
  Mv.startFrom = function (node, e) { if (!node || fixedPart(node)) return; S = { node: node, x: e.clientX, y: e.clientY, dragging: false, handle: true }; };
  function begin() {
    var u = ui(), r = S.node.getBoundingClientRect();
    S.dragging = true;
    S.node.classList.add('ms-dragging');
    u.ghost.textContent = nameOf(S.node);
    u.ghost.style.width = Math.max(140, Math.min(260, r.width * 0.5)) + 'px';
    u.ghost.style.height = Math.max(40, Math.min(150, r.height * 0.5)) + 'px';
    u.ghost.style.display = 'block';
    cdoc().documentElement.style.cursor = 'grabbing';
    MS.status('Drop where the blue bar shows. Hold Ctrl to copy. Esc to cancel.');
  }
  function autoScroll(y) {
    var w = cwin(), h = w.innerHeight, edge = 48;
    if (y < edge) w.scrollBy(0, -Math.ceil((edge - y) / 3));
    else if (y > h - edge) w.scrollBy(0, Math.ceil((y - (h - edge)) / 3));
  }
  function onMove(e) {
    if (!S) return;
    if (!S.dragging) { if (Math.abs(e.clientX - S.x) + Math.abs(e.clientY - S.y) < THRESH) return; begin(); }
    e.preventDefault(); e.stopPropagation();
    autoScroll(e.clientY);
    var copy = e.ctrlKey || e.metaKey || e.altKey;
    S.target = Mv.dropAt(e.clientX, e.clientY, S.node); S.copy = copy;
    showDrop(S.target, e.clientX, e.clientY, copy);
  }
  function end(cancel) {
    var s = S; S = null; hideUi();
    var d = cdoc(); if (d) d.documentElement.style.cursor = '';
    if (!s) return;
    if (s.node.classList) s.node.classList.remove('ms-dragging');
    if (!s.dragging) return;
    swallowUntil = Date.now() + 350;
    MS.status('');
    if (cancel || !s.target || s.target.self) return;
    Mv.drop(s.node, s.target, s.copy);
  }
  function onUp(e) { if (!S) return; if (S.dragging) { e.preventDefault(); e.stopPropagation(); } end(false); }
  function onKey(e) { if (e.key === 'Escape' && S && S.dragging) { e.preventDefault(); e.stopPropagation(); end(true); } }

  // Put `node` (or a copy) where a drop says. Undoable as one step.
  Mv.drop = function (node, t, copy) {
    var rt = MS.rt(), out = null, label = copy ? 'Copy' : 'Move';
    if (t.ribbonTab) { MS.blocks.sendToTab(node, t.ribbonTab, copy); return node; }
    var host = t.host, ref = t.ref;
    if (t.pageTab != null) { host = hostIn(t.panel); ref = null; }
    if (!host || node === host || node.contains(host)) return MS.toast('That would put it inside itself.', 'warn');
    var from = node.parentElement;
    MS.history.group(label + ' "' + nameOf(node).slice(0, 40) + '"', function () {
      if (copy) out = Cb().place(Cb().clone(node), { host: host, ref: ref }, 'Copy here');
      else {
        out = Cb().fit(node, host);
        MS.history.move(label, out, function () { host.insertBefore(out, ref && ref.parentNode === host ? ref : null); });
      }
    });
    if (t.pageTab != null && rt) { rt.showPageTab(t.pageTab); MS.toast((copy ? 'Copied' : 'Moved') + ' to the "' + t.label + '" tab.', 'ok'); }
    if (!copy && from && from !== host && from.children.length === 0 && MS.clipboard.cardOf && from.classList && from.classList.contains('ms-visual') === false && /^(DIV)$/.test(from.tagName) && !from.textContent.trim() && !fixedPart(from)) MS.history.move('Remove empty box', from, function () { from.remove(); });
    MS.decorate && MS.decorate();
    MS.afterDomChange(out);
    if (rt) setTimeout(function () { rt.charts().forEach(function (c) { if (out && (out === c.el || out.contains(c.el))) try { c.a.resize(c.inst); } catch (e) {} }); }, 60);
    if (out && MS.mode === 'edit') MS.edit.select(out);
    return out;
  };
  // For the API: move `el` before / after another part, or into a box.
  Mv.to = function (el, where) {
    var t;
    if (where.into) t = { host: where.into, ref: null };
    else { var ref = where.before || where.after; t = { host: ref.parentElement, ref: where.before ? ref : ref.nextSibling }; }
    return Mv.drop(el, t, !!where.copy);
  };

  /* ---------------------------------------------------------------- the floating toolbar */
  var bar = null;
  function barEl() {
    var d = cdoc(); if (!d) return null;
    if (bar && bar.ownerDocument === d && bar.isConnected) return bar;
    bar = d.createElement('div'); bar.id = 'ms-minibar'; bar.className = 'ms-floatbar'; bar.setAttribute('data-ms-editor', '');
    d.body.appendChild(bar);
    return bar;
  }
  var BAR_CSS = '.ms-floatbar{position:absolute;z-index:2147483500;display:none;align-items:center;gap:2px;padding:3px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 6px 20px rgba(15,23,42,.16);font:12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#334155;user-select:none}' +
    '.ms-floatbar button{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;min-width:28px;height:28px;padding:0 7px;border-radius:7px;cursor:pointer;color:#334155;font:600 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif}' +
    '.ms-floatbar button:hover{background:#eef2ff;color:#4338ca}.ms-floatbar button.on{background:#e0e7ff;color:#3730a3}.ms-floatbar button.ms-mb-move{cursor:grab;color:#4f46e5}.ms-floatbar button.ms-mb-del:hover{background:#fef2f2;color:#b91c1c}' +
    '.ms-floatbar svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.ms-floatbar i{width:1px;height:18px;background:#e2e8f0;margin:0 2px}' +
    '.ms-floatbar .ms-sw{width:16px;height:16px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}.ms-floatbar button.ms-swb{min-width:24px;padding:0 4px}.ms-floatbar button.ms-swb.on{box-shadow:0 0 0 2px #4f46e5 inset}' +
    '.ms-floatbar .ms-mb-name{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 6px 0 4px;color:#64748b;font-weight:600}';
  function btn(icon, title, run, cls) {
    var b = cdoc().createElement('button'); b.type = 'button'; b.title = title; if (cls) b.className = cls;
    var ic = MS.icon(icon); if (ic.nodeType === 1) b.appendChild(cdoc().importNode(ic, true)); else b.textContent = icon;
    b.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); });
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); run(e, b); });
    return b;
  }
  Mv.btn = btn;
  Mv.barCss = function () { var d = cdoc(), st = d.getElementById('ms-minibar-css'); if (!st) { st = d.createElement('style'); st.id = 'ms-minibar-css'; st.setAttribute('data-ms-editor', ''); st.textContent = BAR_CSS; d.head.appendChild(st); } };
  // Place a floating bar above (or below) a box given in the dashboard's coordinates.
  // The dashboard is drawn scaled down to fit; the bar is scaled back up so it stays a readable size.
  Mv.placeBar = function (b, r) {
    var w = cwin(), k = Math.min(1.8, Math.max(1, 1 / (MS.view.scale || 1)));
    b.style.transformOrigin = '0 0'; b.style.transform = k > 1.01 ? 'scale(' + k.toFixed(3) + ')' : '';
    var bw = b.offsetWidth * k, bh = b.offsetHeight * k, gap = 8 * k;
    var top = r.top - bh - gap; if (top < 4) top = r.bottom + gap < w.innerHeight - bh ? r.bottom + gap : Math.max(4, r.top + 6);
    var left = Math.max(4, Math.min(r.left, w.innerWidth - bw - 8));
    b.style.left = (left + w.pageXOffset) + 'px'; b.style.top = (top + w.pageYOffset) + 'px';
  };
  Mv.barOn = MS.prefs.get('minibar', true);
  Mv.toggleBar = function (on) { Mv.barOn = on == null ? !Mv.barOn : !!on; MS.prefs.set('minibar', Mv.barOn); Mv.syncBar(); };
  Mv.syncBar = function () {
    var b = barEl(); if (!b) return;
    var el = MS.sel, rt = MS.rt();
    if (!Mv.barOn || !el || !el.isConnected || MS.mode !== 'edit' || MS.editingText || /^(HTML|BODY)$/.test(el.tagName) || (MS.shapes && MS.shapes.selected)) { b.style.display = 'none'; return; }
    Mv.barCss();
    b.innerHTML = '';
    var key = rt ? MS.blocks.chartKey(el) : null, unit = Mv.unitAt(el) || el;
    var mv = btn('grip', 'Drag to move (hold Ctrl to copy)', function () {}, 'ms-mb-move');
    mv.addEventListener('mousedown', function (e) { if (e.button === 0) Mv.startFrom(unit, e); });
    b.appendChild(mv);
    var nm = cdoc().createElement('span'); nm.className = 'ms-mb-name'; nm.textContent = key ? MS.charts.nameOf(key) : nameOf(unit); b.appendChild(nm);
    b.appendChild(cdoc().createElement('i'));
    if (key) {
      b.appendChild(btn('settings', 'Chart settings', function () { MS.charts.settings(key); }));
      if (MS.shapes) b.appendChild(btn('pen', 'Draw on this chart: arrows, growth (CAGR), boxes, callouts', function (e, bt) { var r = bt.getBoundingClientRect(), fr = MS.$('#stage-frame-host iframe').getBoundingClientRect(), s = MS.view.scale || 1; MS.menuAt(fr.left + r.left * s, fr.top + r.bottom * s + 4, MS.shapes.menuItems(key)); }));
    }
    if (MS.picture) b.appendChild(btn('image', 'Copy as picture (paste into PowerPoint, Word, email)', function () { MS.picture.copy(unit); }));
    b.appendChild(btn('copy', 'Duplicate (Ctrl+D)', function () { MS.clipboard.duplicate(el); }));
    b.appendChild(btn('trash', 'Delete', function () { MS.blocks.remove(el); }, 'ms-mb-del'));
    b.appendChild(btn('more', 'More', function (e, bt) { var r = bt.getBoundingClientRect(), fr = MS.$('#stage-frame-host iframe').getBoundingClientRect(), s = MS.view.scale || 1; MS.clipboard.lastMenu = { x: r.left, y: r.bottom }; MS.menuAt(fr.left + r.left * s, fr.top + r.bottom * s + 4, MS.clipboard.menuItems()); }));
    b.style.display = 'flex';
    Mv.placeBar(b, el.getBoundingClientRect());
  };
  var syncSoon = MS.debounce(function () { Mv.syncBar(); }, 40);

  MS.on('child-loaded', function (c) {
    var d = c.doc; bar = null; UI = null; S = null;
    d.addEventListener('mousedown', onDown, true);
    d.addEventListener('mousemove', onMove, true);
    d.addEventListener('mouseup', onUp, true);
    d.addEventListener('keydown', onKey, true);
    c.win.addEventListener('blur', function () { if (S) end(true); });
    c.win.addEventListener('scroll', syncSoon, true);
    c.win.addEventListener('resize', syncSoon);
    c.win.addEventListener('ms:refresh', syncSoon);
  });
  MS.on('selection', syncSoon); MS.on('mode', syncSoon); MS.on('structure', syncSoon); MS.on('history', syncSoon);
})(window.MS);
