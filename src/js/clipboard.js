/* Cut, copy and paste anywhere in the dashboard: after the selected part, inside a section, card
   or tab (Ctrl+Shift+V), into one-page dashboards and the dashboard's own tabs. Charts are copied as
   live copies; between dashboards they are rebuilt from their numbers. Pictures, Excel ranges,
   tables and text from other apps paste too. Also the right-click menu in Edit mode. */
(function (MS) {
  'use strict';
  var Cb = MS.clipboard = {};
  var SNAP_KEY = 'ms.clipSnap';
  var MARK = /<!--ms-clip:([\w-]+)-->/;
  var CONTAINER = '.ms-grid,.ms-doc,.ms-section,section.ms-tab,.ms-visual';
  var TYPES = { bar: 'bar', column: 'bar', horizontalBar: 'hbar', line: 'line', spline: 'line', area: 'area', areaspline: 'area', pie: 'pie', doughnut: 'doughnut', donut: 'doughnut', scatter: 'line' };

  function cdoc() { return MS.child && MS.child.doc; }
  function B() { return MS.blocks; }
  function docKey() { return MS.doc ? (MS.doc.name || '') + '|' + (MS.doc.openedAt || '') : ''; }
  MS.on('child-loaded', function () { if (MS.doc && !MS.doc.openedAt) MS.doc.openedAt = Date.now(); clearCutMark(); });
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  // kept on export (a chart copy's holder is kept by its data-ms-id instead)
  function own(n) { [n].concat(MS.$$('*', n)).forEach(function (x) { if (!x.hasAttribute('data-ms-copyof')) x.setAttribute('data-ms-own', ''); }); return n; }

  /* ---------------------------------------------------------- what is selected / where to paste */
  // The part a copy or paste works on: a chart's card or block, not a single bar or a word inside it.
  function unitOf(el) {
    if (!el || el.nodeType !== 1) return null;
    var rt = MS.rt();
    if (el.closest('.ms-head') || el.closest('.ms-crumbs')) return B().of(el) || el;
    if (B().of(el) && B().of(el).querySelector(':scope > .ms-visual') && B().of(el).querySelector(':scope > .ms-visual').contains(el) && !el.closest('.ms-content-block')) return B().of(el);
    var c = rt && rt.chartOf(el);
    if (c && (el === c.el || c.el.contains(el) || el.tagName === 'CANVAS')) return B().of(el) || el.closest('[data-ms-copyof]') || MS.edit.chartUnit(c.el);
    // inline text and table cells: use the nearest block-level part
    var w = MS.child.win;
    while (el.parentElement && !/^(BODY|MAIN)$/.test(el.parentElement.tagName) &&
      (/^(TD|TH|TR|THEAD|TBODY|TFOOT|LI|DT|DD|OPTION)$/.test(el.tagName) || /^inline/.test(w.getComputedStyle(el).display) && !/^(IMG|SVG|CANVAS|BUTTON)$/i.test(el.tagName))) el = el.parentElement;
    return el;
  }
  Cb.unitOf = function (el) { var u = unitOf(el); return u && (cardOf(u, true) || u); };
  // A card: a box with a border, background or shadow that holds one chart (with its heading and
  // legend) or a little text. Copying a chart copies its card, so the title comes along.
  function cardLike(n, w) {
    if (!n || n.nodeType !== 1 || /^(BODY|HTML|MAIN|SECTION|TABLE|TR|TD|TH|UL|OL|NAV|HEADER|FOOTER)$/.test(n.tagName) || isContainer(n) || n.id === 'ms-app' || n.id === 'ms-main') return false;
    var cs = w.getComputedStyle(n);
    return parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0 || cs.boxShadow !== 'none' || parseFloat(cs.borderTopLeftRadius) > 2 || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
  }
  function cardOf(u, chartOnly) {
    var rt = MS.rt(), w = MS.child.win; if (!u || !rt) return null;
    if (u.classList.contains('ms-block')) return null;
    var mine = rt.charts().filter(function (c) { return u === c.el || u.contains(c.el); }).map(function (c) { return c.el; });
    if (chartOnly === true && !mine.length) return null;
    for (var n = u.parentElement, i = 0; n && i < 3; n = n.parentElement, i++) {
      if (/^(BODY|HTML|MAIN)$/.test(n.tagName) || isContainer(n)) return null;
      var others = rt.charts().filter(function (c) { return n.contains(c.el) && mine.indexOf(c.el) < 0; }).length;
      if (others && chartOnly !== 'target') return null;
      if (cardLike(n, w)) return (n.textContent || '').length - (u.textContent || '').length < 600 ? n : null;
    }
    return null;
  }
  Cb.cardOf = cardOf;
  function isContainer(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.matches(CONTAINER)) return true;
    var rt = MS.rt(), pt = rt && rt.pageTabOf && rt.pageTabOf(el);
    return !!(pt && pt.panel === el);
  }
  Cb.isContainer = isContainer;
  // The element new things go into when pasting inside `el`.
  function innerHost(el) {
    var rt = MS.rt();
    if (el.matches('section.ms-tab')) return el.getAttribute('data-ms-kind') === 'content' ? (el.querySelector('.ms-doc') || el) : B().ensureGrid(el);
    if (el.matches('.ms-section')) return B().ensureGrid(el);
    if (el.matches('.ms-block')) return el.querySelector(':scope > .ms-visual') || el;
    var pt = rt && rt.pageTabOf && rt.pageTabOf(el);
    if (pt && pt.btn === el) return pt.panel;
    return el;
  }
  // {host, ref}: where a paste lands. With a selection: right after it (or inside it when it is a
  // section, grid, tab or "inside" is asked). Without: the end of the tab or page on screen.
  Cb.target = function (inside) {
    var d = cdoc(), sel = MS.sel && MS.sel.isConnected && MS.sel.ownerDocument === d ? MS.sel : null;
    var rt = MS.rt(), pt = sel && rt && rt.pageTabOf && rt.pageTabOf(sel);
    if (sel && pt && pt.btn === sel) return { host: pt.panel, ref: null };
    if (sel && /^(BODY|HTML)$/.test(sel.tagName)) sel = null;
    if (sel && (inside || isContainer(sel))) return { host: innerHost(sel), ref: null };
    if (sel) {
      var u = unitOf(sel), big = MS.clip && MS.clip.node && (MS.clip.node.classList.contains('ms-block') || cardLike(MS.clip.node, MS.child.win) || MS.clip.node.querySelector && MS.clip.node.querySelector('canvas,svg,[data-ms-copyof],[data-ms-chart]'));
      if (big && u) { var cu = cardOf(u, 'target'); if (cu) u = cu; }
      if (u && u.parentNode && !/^(HTML)$/.test(u.parentNode.tagName)) return { host: u.parentNode, ref: u.nextSibling, after: u };
    }
    var host = MS.compose.container();
    return { host: host, ref: host === d.body ? d.getElementById('ms-state') : null };
  };

  /* ---------------------------------------------------------- cloning */
  // A copy of `el` that is safe to put anywhere: charts become live copies (or new charts with the
  // same settings), ids are made unique, editor handles are dropped, everything is kept on export.
  // opts.dry: don't add chart settings to the dashboard (used for the cross-dashboard snapshot).
  Cb.clone = function (el, opts) {
    opts = opts || {};
    var rt = MS.rt(), d = cdoc(), charts = rt ? rt.charts().filter(function (c) { return el === c.el || el.contains(c.el); }) : [];
    var marks = [];
    charts.forEach(function (c, i) {
      var u = c.el.closest('[data-ms-chart]') || c.el.closest('[data-ms-copyof]') || c.el;
      if (!el.contains(u) && u !== el) u = c.el;
      if (u.hasAttribute('data-ms-cliptmp')) return;
      u.setAttribute('data-ms-cliptmp', String(i));
      marks.push({ u: u, c: c, h: Math.round(u.getBoundingClientRect().height) });
    });
    var n = el.cloneNode(true);
    marks.forEach(function (m) { m.u.removeAttribute('data-ms-cliptmp'); });
    MS.$$('.ms-grip,.ms-drag,.ms-rgrip,.ms-pgrip,[data-ms-editor],#ms-cmt-layer,.ms-cmt-pin,.ms-size-handle,.ms-source,.ms-summary,.ms-annot-layer', n).forEach(function (x) { x.remove(); });
    MS.$$('.ms-crumbs', n).forEach(function (x) { x.innerHTML = ''; x.style.display = 'none'; });
    var fix = function (x) {
      if (x.classList) { x.classList.remove('ms-sel', 'ms-hover', 'ms-flash', 'ms-editing', 'ms-cut', 'ms-dragging', 'ms-drop-before', 'ms-drop-after', 'ms-drop-end'); if (!x.getAttribute('class')) x.removeAttribute('class'); }
      x.removeAttribute('data-ms-ref'); x.removeAttribute('contenteditable');
      if (x.id) { var base = x.id.replace(/-copy\d*$/, '') + '-copy', k = '', i = 1; while (d.getElementById(base + k)) k = String(++i); x.id = base + k; }
    };
    fix(n); MS.$$('*', n).forEach(fix);
    // charts: a fresh holder with the same settings
    var byNo = {}; charts.forEach(function (c, i) { byNo[i] = marks.filter(function (m) { return m.c === c; })[0]; });
    var cl = MS.$$('[data-ms-cliptmp]', n); if (n.hasAttribute('data-ms-cliptmp')) cl.unshift(n);
    var out = n;
    cl.forEach(function (t) {
      var m = byNo[Number(t.getAttribute('data-ms-cliptmp'))];
      t.removeAttribute('data-ms-cliptmp');
      if (!m) return;
      var src = m.c, cs = rt.state.charts[src.key], holder = d.createElement('div'), key;
      var nat = m.u.hasAttribute('data-ms-chart');
      if (nat) { key = rt.uid('c'); holder.setAttribute('data-ms-chart', key); holder.setAttribute('data-ms-own', ''); }
      else { key = MS.nextId(); holder.setAttribute('data-ms-id', key); holder.setAttribute('data-ms-copyof', m.u.getAttribute('data-ms-copyof') || src.key); }
      var inVis = m.u.parentElement && m.u.parentElement.classList.contains('ms-visual');
      holder.style.cssText = 'width:100%;height:' + (inVis || nat ? '100%' : (m.h || 260) + 'px');
      holder.setAttribute('data-ms-clipsrc', src.key);
      if (cs && !opts.dry) { var copy = JSON.parse(JSON.stringify(cs)); MS.history.state('Copy chart settings', function (s) { s.charts[key] = copy; }); }
      if (t === n) out = holder; else t.parentNode.replaceChild(holder, t);
    });
    if (!opts.dry) { MS.$$('[data-ms-clipsrc]', out).forEach(function (x) { x.removeAttribute('data-ms-clipsrc'); }); if (out.removeAttribute) out.removeAttribute('data-ms-clipsrc'); }
    MS.$$('[data-ms-id]', out).forEach(function (x) { if (!x.hasAttribute('data-ms-copyof')) x.removeAttribute('data-ms-id'); });
    if (out.hasAttribute('data-ms-id') && !out.hasAttribute('data-ms-copyof')) out.removeAttribute('data-ms-id');
    own(out);
    return out;
  };

  // Make a node fit where it lands: a grid needs blocks, anywhere else a block sits in the flow.
  Cb.fit = function (node, host) {
    var rt = MS.rt(), grid = host && host.classList && host.classList.contains('ms-grid');
    if (node.classList && node.classList.contains('ms-block')) {
      if (grid) node.classList.remove('ms-inline');
      else if (!host.classList.contains('ms-doc') || !node.classList.contains('ms-content-block')) {
        if (!node.classList.contains('ms-inline') && !(host.closest && host.closest('.ms-grid'))) {
          node.classList.add('ms-inline');
          var v = node.querySelector(':scope > .ms-visual');
          if (v && !node.classList.contains('ms-content-block')) { if (!v.style.getPropertyValue('--ms-h')) v.style.setProperty('--ms-h', '300px'); v.style.height = 'var(--ms-h)'; }
        }
      }
      return node;
    }
    if (!grid) return node;
    var isChart = !!(rt && (node.hasAttribute('data-ms-copyof') || node.hasAttribute('data-ms-chart') || node.querySelector('[data-ms-copyof],[data-ms-chart],canvas,svg')));
    var b = B().create({ content: !isChart, span: 6 });
    MS.$$('.ms-head > div', b).forEach(function (x) { x.textContent = ''; });
    var vis = b.querySelector('.ms-visual');
    var hh = parseFloat(node.style && node.style.height);
    if (isChart && hh > 60) { vis.style.setProperty('--ms-h', Math.round(hh) + 'px'); node.style.height = '100%'; }
    vis.appendChild(node);
    return b;
  };

  /* ---------------------------------------------------------- copy / cut */
  function clearCutMark() { var d = cdoc(); if (d) MS.$$('.ms-cut', d).forEach(function (x) { x.classList.remove('ms-cut'); }); }
  Cb.copy = function (cut, ev) {
    if (!MS.child) return MS.toast('Open a dashboard first.', 'warn');
    var el = MS.sel && Cb.unitOf(MS.sel);
    if (!el || !el.isConnected) return MS.toast('Select a chart, card or text first, then copy.', 'warn');
    if (/^(BODY|HTML)$/.test(el.tagName) || el.id === 'ms-app' || el.id === 'ms-main') return MS.toast('That holds the whole page. Select a part of it to copy.', 'warn');
    var id = newId(), snap = Cb.snapshot(el, id);
    MS.clip = { id: id, node: el, cut: !!cut, doc: docKey(), at: Date.now() };
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(snap)); } catch (e) { try { localStorage.removeItem(SNAP_KEY); } catch (x) {} }
    var html = '<!--ms-clip:' + id + '-->' + snap.html, text = snap.text || '';
    if (ev && ev.clipboardData) { ev.preventDefault(); ev.clipboardData.setData('text/html', html); ev.clipboardData.setData('text/plain', text); }
    else writeSystem(html, text);
    if (cut) {
      var p = el.parentNode, nx = el.nextSibling;
      MS.edit.select(null);
      MS.history.push({ label: 'Cut', undo: function () { p.insertBefore(el, nx && nx.parentNode === p ? nx : null); MS.afterDomChange(el); }, redo: function () { if (el.parentNode) el.parentNode.removeChild(el); MS.afterDomChange(); } });
      MS.toast('Cut. Select where it should go and press Ctrl+V (Ctrl+Shift+V to put it inside a section or card).', 'ok', 5000);
    } else MS.toast('Copied. Select where it should go and press Ctrl+V, here or in another dashboard.', 'ok', 4000);
    MS.emit('clipboard', MS.clip);
    return MS.clip;
  };
  function writeSystem(html, text) {
    try {
      if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]).catch(function () {});
      else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(function () {});
    } catch (e) {}
  }

  // What another dashboard needs to paste this: the HTML and each chart's numbers.
  Cb.snapshot = function (el, id) {
    var rt = MS.rt(), charts = [], host = cdoc().createElement('div');
    host.appendChild(Cb.clone(el, { dry: true }));
    MS.$$('[data-ms-clipsrc]', host).forEach(function (hd, i) {
      var k = hd.getAttribute('data-ms-clipsrc'), d = rt.chartData(k, true), info = rt.chartInfo(k) || {};
      charts.push({ key: k, title: MS.charts.nameOf(k) || info.title || 'Chart', type: TYPES[info.type] || 'bar', labels: d ? d.labels : [], series: d ? d.series : [], look: rt.state.charts[k] ? rt.state.charts[k].style || null : null, h: Math.round(parseFloat(hd.style.height) || 0) });
      var ph = cdoc().createElement('div'); ph.setAttribute('data-clipchart', String(i)); ph.style.cssText = hd.style.cssText;
      hd.parentNode.replaceChild(ph, hd);
    });
    var srcCharts = charts;
    var text = (el.innerText || el.textContent || '').trim();
    if (srcCharts.length && !text) text = charts.map(function (c) { return c.title; }).join('\n');
    return { v: 1, id: id, doc: docKey(), src: MS.doc && MS.doc.name, at: Date.now(), html: host.innerHTML, text: text.slice(0, 20000), charts: charts };
  };

  /* ---------------------------------------------------------- paste */
  // opts: {inside, data: DataTransfer (from a paste event)}
  Cb.paste = function (opts) {
    opts = opts || {};
    if (!MS.child) return Promise.resolve(MS.toast('Open a dashboard first.', 'warn'));
    if (!MS.rt()) return Promise.resolve(MS.toast('Turn off Safe mode (View tab) to paste charts and blocks.', 'warn'));
    var dt = opts.data, html = dt ? dt.getData('text/html') : '', m = html && MARK.exec(html);
    var snap = readSnap();
    // ours, from this dashboard (and the thing still exists)
    if ((!dt || m) && MS.clip && (!m || m[1] === MS.clip.id) && MS.clip.doc === docKey() && (MS.clip.cut || MS.clip.node.isConnected)) return Promise.resolve(pasteInternal(opts.inside));
    // ours, from another dashboard (or after a reload)
    if (snap && (m ? m[1] === snap.id : !dt || !hasExternal(dt))) return pasteSnapshot(snap, opts.inside);
    if (dt && hasExternal(dt)) return Cb.pasteExternal(dt, opts.inside);
    MS.toast('Nothing to paste yet. Select a chart, card or text and press Ctrl+C first.', 'warn');
    return Promise.resolve(null);
  };
  function readSnap() { try { return JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); } catch (e) { return null; } }
  function hasExternal(dt) { return !!(dt && (dt.files && dt.files.length || dt.getData('text/html') || dt.getData('text/plain'))); }

  function place(node, t, label) {
    if (t.host.nodeType !== 1) return null;
    var n = Cb.fit(node, t.host);
    MS.history.move(label || 'Paste', n, function () { t.host.insertBefore(n, t.ref && t.ref.parentNode === t.host ? t.ref : null); });
    MS.decorate();
    MS.afterDomChange(n);
    setTimeout(function () { if (n.isConnected) { MS.edit.reveal(n, true); } }, 80);
    return n;
  }
  Cb.place = place;

  function pasteInternal(inside) {
    var c = MS.clip, t = Cb.target(inside), node;
    if (c.cut && !c.node.isConnected) {
      if (c.node.contains(t.host)) return MS.toast('That would put it inside itself.', 'warn');
      node = c.node; c.cut = false; clearCutMark();
    } else {
      if (c.node.contains(t.host) && c.node !== t.host && !inside) t = { host: c.node.parentNode, ref: c.node.nextSibling };
      node = Cb.clone(c.node);
    }
    var out;
    MS.history.group('Paste', function () { out = place(node, t); });
    return out;
  }

  // Rebuild a copy from another dashboard: its HTML, and each chart as a new chart made from its numbers.
  Cb.pasteSnapshot = function (snap, inside, quiet) { return pasteSnapshot(snap, inside, quiet); };
  function pasteSnapshot(snap, inside, quiet) {
    var rt = MS.rt(), d = cdoc(), t = Cb.target(inside);
    var wrap = d.createElement('div'); wrap.innerHTML = MS.sanitize ? MS.sanitize(snap.html) : snap.html;
    var node = wrap.firstElementChild || wrap;
    var phs = MS.$$('[data-clipchart]', wrap);
    var same = snap.doc === docKey();
    var needLib = phs.some(function (p) { var ch = snap.charts[Number(p.getAttribute('data-clipchart'))]; return !(same && ch && ch.key && rt.chart(ch.key)); });
    return (needLib ? MS.compose.ensureChartLib() : Promise.resolve()).then(function () {
      var out;
      MS.history.group('Paste from ' + (snap.src || 'another dashboard'), function () {
        phs.forEach(function (p) {
          var ch = snap.charts[Number(p.getAttribute('data-clipchart'))] || {}, holder = d.createElement('div'), key;
          if (same && ch.key && rt.chart(ch.key)) { key = MS.nextId(); holder.setAttribute('data-ms-id', key); holder.setAttribute('data-ms-copyof', ch.key); }
          else {
            key = rt.uid('c'); holder.setAttribute('data-ms-chart', key); holder.setAttribute('data-ms-own', '');
            var ds = MS.data.addDataset((ch.title || 'Chart') + ' (pasted)', rowsOf(ch), true);
            var multi = (ch.series || []).length > 1;
            var spec = { native: { type: ch.type || 'bar', legend: multi }, binding: { dataset: ds, levels: ['Category'], measure: 'Value', agg: 'sum', series: multi ? 'Series' : undefined, sort: 'source' }, drill: { mode: 'levels' }, title: ch.title };
            if (ch.look) spec.style = ch.look;
            MS.history.state('Pasted chart', function (s) { s.charts[key] = spec; });
          }
          holder.style.cssText = p.style.cssText || 'width:100%;height:100%';
          if (!/height/.test(holder.style.cssText) || holder.style.height === '100%') { if (!p.closest('.ms-visual')) holder.style.height = (ch.h || 280) + 'px'; }
          p.parentNode.replaceChild(holder, p);
        });
        // each top-level part goes in on its own, in order (so a tab's cards land in its grid)
        Array.prototype.slice.call(wrap.children).forEach(function (part) {
          own(part);
          var n = place(part, t, 'Paste');
          if (n) { out = out || n; t = { host: n.parentNode, ref: n.nextSibling }; }
        });
      });
      if (!same && !quiet) MS.toast('Pasted from ' + (snap.src || 'another dashboard') + (phs.length ? '. Charts were rebuilt from their numbers and now live in this dashboard.' : '.'), 'ok', 6000);
      return out;
    }).catch(function (e) { MS.toast('Could not paste: ' + e.message, 'error', 7000); });
  }
  function rowsOf(ch) {
    var rows = [];
    (ch.labels || []).forEach(function (l, j) {
      if ((ch.series || []).length === 1) rows.push({ Category: l, Value: ch.series[0].values[j] });
      else (ch.series || []).forEach(function (s) { rows.push({ Category: l, Series: s.name, Value: s.values[j] }); });
    });
    return rows;
  }

  /* ---------------------------------------------------------- paste from other apps */
  Cb.pasteExternal = function (dt, inside) {
    var d = cdoc(), t = Cb.target(inside);
    var files = Array.prototype.slice.call(dt.files || []).filter(function (f) { return /^image\//.test(f.type); });
    if (files.length) {
      return Promise.all(files.map(function (f) { return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res({ name: f.name, url: r.result }); }; r.readAsDataURL(f); }); })).then(function (imgs) {
        var out;
        MS.history.group('Paste picture', function () {
          imgs.forEach(function (im) {
            var fig = d.createElement('figure'); fig.className = 'ms-figure'; fig.style.cssText = 'margin:0 0 12px';
            var img = d.createElement('img'); img.src = im.url; img.style.cssText = 'max-width:100%;height:auto;display:block;border-radius:6px';
            fig.appendChild(img); own(fig);
            out = place(fig, t, 'Paste picture');
            t = { host: out.parentNode, ref: out.nextSibling };
          });
        });
        MS.toast('Picture pasted. Add a short description for screen readers in the Format panel (Alt text).', 'ok', 6000);
        return out;
      });
    }
    var html = dt.getData('text/html'), text = dt.getData('text/plain'), node = null;
    if (html && /<table[\s>]/i.test(html)) {
      var w = d.createElement('div'); w.innerHTML = MS.sanitize ? MS.sanitize(html) : html;
      var tb = w.querySelector('table');
      if (tb) node = tidyTable(tb);
    }
    if (!node && text && /\t/.test(text) && text.trim().split(/\r?\n/).length > 1) node = tsvTable(text);
    if (!node && html && !/^\s*$/.test(html.replace(/<[^>]+>/g, ''))) {
      var w2 = d.createElement('div'); w2.className = 'ms-pasted'; w2.innerHTML = MS.sanitize ? MS.sanitize(html) : html;
      MS.$$('style,meta,link,title,script', w2).forEach(function (x) { x.remove(); });
      node = w2.children.length === 1 ? w2.firstElementChild : w2;
    }
    if (!node && text) {
      node = d.createElement('div'); node.className = 'ms-pasted';
      text.trim().split(/\r?\n\s*\r?\n/).forEach(function (para) { var p = d.createElement('p'); p.textContent = para.trim(); node.appendChild(p); });
      if (node.children.length === 1) node = node.firstElementChild;
    }
    if (!node) return Promise.resolve(null);
    own(node);
    var out;
    MS.history.group('Paste', function () { out = place(node, t); });
    return Promise.resolve(out);
  };
  function tidyTable(tb) {
    var d = cdoc(), n = d.createElement('table'); n.className = 'ms-table';
    var rows = MS.$$('tr', tb);
    rows.forEach(function (tr, i) {
      var r = d.createElement('tr');
      MS.$$('td,th', tr).forEach(function (c) { var x = d.createElement(i === 0 && (c.tagName === 'TH' || rows.length > 1) ? 'th' : 'td'); x.textContent = c.textContent.replace(/\s+/g, ' ').trim(); if (c.colSpan > 1) x.colSpan = c.colSpan; if (x.tagName === 'TD' && /^[-+(]?[\d$₹€£.,%\s)]+$/.test(x.textContent) && /\d/.test(x.textContent)) x.className = 'num'; r.appendChild(x); });
      if (i === 0) { var th = d.createElement('thead'); th.appendChild(r); n.appendChild(th); }
      else { var tbd = n.querySelector('tbody') || n.appendChild(d.createElement('tbody')); tbd.appendChild(r); }
    });
    return n;
  }
  function tsvTable(text) {
    var d = cdoc(), w = d.createElement('table'), lines = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n');
    w.innerHTML = lines.map(function (l, i) { return '<tr>' + l.split('\t').map(function (c) { return (i ? '<td>' : '<th>') + MS.esc(c) + (i ? '</td>' : '</th>'); }).join('') + '</tr>'; }).join('');
    return tidyTable(w);
  }

  /* ---------------------------------------------------------- duplicate */
  Cb.duplicate = function (el) {
    var u = Cb.unitOf(el); if (!u || !u.parentNode || /^(BODY|HTML)$/.test(u.tagName)) return MS.toast('Select a chart, card or text to duplicate.', 'warn');
    var out;
    MS.history.group('Duplicate', function () { out = place(Cb.clone(u), { host: u.parentNode, ref: u.nextSibling }, 'Duplicate'); });
    return out;
  };

  /* ---------------------------------------------------------- keyboard and clipboard events */
  var pending = null;
  function typingIn(t) { return t && t.nodeType === 1 && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable); }
  function textSelected(win) { try { var s = win.getSelection(); return s && !s.isCollapsed && String(s).trim(); } catch (e) { return false; } }
  // Called from the key handler for Ctrl+C / X / V: let the browser fire its clipboard event (which
  // carries pictures and Excel ranges); if it doesn't come, do it ourselves.
  Cb.key = function (k, shift) {
    pending = { k: k, shift: shift };
    setTimeout(function () { if (!pending) return; var p = pending; pending = null; if (p.k === 'v') Cb.paste({ inside: p.shift }); else Cb.copy(p.k === 'x'); }, 60);
  };
  function onCopy(e, cut) {
    if (!MS.child || MS.mode !== 'edit' || !MS.sel || typingIn(e.target) || MS.$('.dlg-wrap')) return;
    if (e.target.ownerDocument === document && textSelected(window)) return;
    pending = null;
    Cb.copy(cut, e);
  }
  function onPaste(e) {
    if (!MS.child || MS.mode !== 'edit' || typingIn(e.target) || MS.$('.dlg-wrap')) return;
    var shift = pending && pending.shift; pending = null;
    e.preventDefault();
    Cb.paste({ data: e.clipboardData, inside: shift });
  }
  function hook(d) {
    d.addEventListener('copy', function (e) { onCopy(e, false); }, true);
    d.addEventListener('cut', function (e) { onCopy(e, true); }, true);
    d.addEventListener('paste', onPaste, true);
  }
  hook(document);
  MS.on('child-loaded', function (c) { hook(c.doc); c.doc.addEventListener('contextmenu', onMenu, true); });

  /* ---------------------------------------------------------- right-click menu (Edit mode) */
  function onMenu(e) {
    if (MS.mode !== 'edit' || e.shiftKey) return;
    var t = e.target; if (t.closest && t.closest('[contenteditable="true"]')) return;
    e.preventDefault(); e.stopPropagation();
    var p = MS.edit.pick(t);
    if (p && (!MS.sel || !MS.sel.contains(p) && MS.sel !== p)) MS.edit.select(p);
    Cb.lastMenu = { x: e.clientX, y: e.clientY };
    var fr = MS.child.frame.getBoundingClientRect(), s = fr.width / (MS.child.frame.offsetWidth || fr.width);
    MS.menuAt(fr.left + e.clientX * s, fr.top + e.clientY * s, Cb.menuItems());
  }
  Cb.menuItems = function () {
    var el = MS.sel, rt = MS.rt(), key = el && rt ? MS.blocks.chartKey(el) : null, has = !!(MS.clip || readSnap());
    var items = [
      { icon: '✂', label: 'Cut', key: 'Ctrl+X', disabled: !el, run: function () { Cb.copy(true); } },
      { icon: '⧉', label: 'Copy', key: 'Ctrl+C', disabled: !el, run: function () { Cb.copy(false); } },
      { icon: '📋', label: el ? 'Paste after this' : 'Paste', key: 'Ctrl+V', disabled: !has, run: function () { Cb.paste(); } },
      el && (isContainer(el) || el.children.length) ? { icon: '⤵', label: 'Paste inside', key: 'Ctrl+Shift+V', disabled: !has, run: function () { Cb.paste({ inside: true }); } } : null,
      { icon: '⧉', label: 'Duplicate', key: 'Ctrl+D', disabled: !el, run: function () { Cb.duplicate(el); } },
      '-'
    ];
    if (key) items = items.concat([
      { icon: '⚙', label: 'Chart settings…', run: function () { MS.charts.settings(key); } },
      { icon: '⛁', label: 'Chart data…', run: function () { MS.chartKit.dataDialog(key); } },
      { icon: '🔑', label: 'Legend', sub: MS.chartKit.legendItems(key) },
      { icon: '📌', label: 'Annotate this point…', run: function () { MS.annotate.dialog(key, Cb.lastMenu); } },
      { icon: '🧾', label: 'Source and date…', run: function () { MS.sources.dialog(key); } },
      { icon: '⤢', label: 'Size…', run: function () { MS.chartKit.sizeDialog(el); } },
      '-'
    ]);
    else if (el) items = items.concat([{ icon: '⤢', label: 'Size…', run: function () { MS.chartKit.sizeDialog(el); } }]);
    if (el && el.tagName === 'TABLE' || el && el.closest && el.closest('table')) items.push({ icon: '🎨', label: 'Table colour rules…', run: function () { MS.tables.rulesDialog(el.closest('table')); } });
    if (el && el.tagName === 'IMG') items.push({ icon: '💬', label: 'Alt text…', run: function () { MS.a11y.altDialog(el); } });
    if (el) items = items.concat([
      { icon: '⭐', label: 'Save as template…', run: function () { MS.templates.saveSelection(); } },
      { icon: '⬆️', label: 'Select parent', key: 'Alt+↑', disabled: !el.parentElement || /^(BODY|HTML)$/.test(el.parentElement.tagName), run: function () { MS.edit.select(el.parentElement); } },
      { icon: '💬', label: 'Comment on this', run: function () { MS.review.addElement ? MS.review.addElement(el) : MS.setMode('comment'); } },
      { icon: '🎬', label: 'Add to the story', run: function () { MS.story.add(el); MS.toast('Added as step ' + MS.story.steps().length + ' of the story (Review › Storyline).', 'ok'); } },
      '-',
      { icon: '🗑', label: 'Delete', key: 'Del', danger: true, run: function () { MS.blocks.remove(el); } }
    ]);
    else items.push({ icon: '⭐', label: 'Insert a template…', run: function () { MS.templates.gallery(); } });
    return items;
  };
})(window.MS);
