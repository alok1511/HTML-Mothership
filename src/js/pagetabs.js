/* The dashboard's own tabs: many dashboards already have tab buttons that show one panel at a
   time. The runtime finds them (rt.pageTabs); this adds, renames, reorders and removes them in the
   page itself, so the exported file keeps the page's own design. */
(function (MS) {
  'use strict';
  var PT = MS.pageTabs = {};
  function rt() { return MS.rt(); }

  // { tabs: [{index, title, btn, panel, active, via}], btnActive, panelActive } or null
  PT.group = function (fresh) { var r = rt(); return r && r.pageTabs ? r.pageTabs(fresh) : null; };
  PT.has = function () { var g = PT.group(); return !!(g && g.tabs.length > 1); };
  PT.list = function () {
    var g = PT.group(true); if (!g) return [];
    return g.tabs.map(function (t) { return { index: t.index, title: t.title, active: t.active }; });
  };
  PT.active = function () { var g = PT.group(); return g ? g.tabs.filter(function (t) { return t.active; })[0] || null : null; };
  PT.find = function (which) {
    var g = PT.group(true); if (!g) return null;
    if (typeof which === 'number') return g.tabs[which] || null;
    var w = String(which || '').trim().toLowerCase();
    return g.tabs.filter(function (t) { return t.title.toLowerCase() === w; })[0] || null;
  };
  PT.show = function (which) {
    var t = PT.find(which); if (!t) return false;
    rt().showPageTab(t.index);
    MS.emit('structure');
    return true;
  };
  // the page tab an element sits in (for comments, prompts and "reveal")
  PT.of = function (el) { var r = rt(); var t = r && r.pageTabOf ? r.pageTabOf(el) : null; return t && t.panel.contains(el) ? t : null; };

  function stamp(root) {
    [root].concat(Array.prototype.slice.call(root.querySelectorAll('*'))).forEach(function (n) {
      n.removeAttribute('data-ms-own'); n.setAttribute('data-ms-id', MS.nextId());
    });
  }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'tab'; }
  function freeId(base) { var d = MS.child.doc, id = base, i = 2; while (d.getElementById(id)) id = base + '-' + (i++); return id; }
  function setText(btn, title) {
    var nodes = [], walk = function (n) { Array.prototype.forEach.call(n.childNodes, function (c) { if (c.nodeType === 3 && c.textContent.trim()) nodes.push(c); else if (c.nodeType === 1) walk(c); }); };
    walk(btn);
    if (!nodes.length) { btn.appendChild(btn.ownerDocument.createTextNode(title)); return; }
    // the last piece of text is the name (an icon or count before it stays)
    nodes[nodes.length - 1].textContent = nodes[nodes.length - 1].textContent.replace(/\S[\s\S]*\S|\S/, title);
  }
  // record a change to an element's inner HTML as one undo step
  function htmlOp(label, el, fn) {
    var before = el.innerHTML; fn(); var after = el.innerHTML;
    if (before === after) return;
    MS.history.push({ label: label, undo: function () { el.innerHTML = before; MS.afterDomChange(el); }, redo: function () { el.innerHTML = after; MS.afterDomChange(el); } }, true);
    MS.afterDomChange(el);
  }

  // Add a tab after the last one (or after `after`), shaped exactly like the page's own tabs.
  PT.add = function (title, html, after) {
    var g = PT.group(true); if (!g) { MS.toast('This dashboard has no tabs of its own.', 'warn'); return null; }
    title = String(title || 'New tab').trim();
    var src = after != null ? (PT.find(after) || g.tabs[g.tabs.length - 1]) : g.tabs[g.tabs.length - 1];
    var model = g.tabs.filter(function (t) { return !t.active; })[0] || src;
    var id = freeId(slug(title));
    var nb = model.btn.cloneNode(true), np = model.panel.cloneNode(false);
    if (g.btnActive) nb.classList.remove(g.btnActive);
    if (g.panelActive) np.classList.remove(g.panelActive);
    ['ms-sel', 'ms-hover', 'ms-flash'].forEach(function (c) { nb.classList.remove(c); np.classList.remove(c); });
    nb.removeAttribute('id'); np.removeAttribute('id');
    setText(nb, title);
    // point the new button at the new panel the same way the page's buttons do
    var oldTarget = model.panel.id;
    ['aria-controls', 'data-tab', 'data-target', 'data-tab-target', 'data-bs-target'].forEach(function (a) {
      var v = nb.getAttribute(a); if (v == null) return;
      nb.setAttribute(a, /^#/.test(v) ? '#' + id : id);
    });
    var href = nb.getAttribute('href'); if (href && href.indexOf('#') >= 0) nb.setAttribute('href', '#' + id);
    var oc = nb.getAttribute('onclick');
    if (oc && oldTarget) nb.setAttribute('onclick', oc.split("'" + oldTarget + "'").join("'" + id + "'").split('"' + oldTarget + '"').join('"' + id + '"'));
    ['data-panel', 'data-tab-panel', 'data-tab-content', 'data-tabpanel'].forEach(function (a) { if (np.hasAttribute(a)) np.setAttribute(a, id); });
    if (model.panel.id || model.via !== 'order') np.id = id;
    if (model.btn.id) nb.id = freeId(id + '-tab');
    if (np.hasAttribute('aria-labelledby') && nb.id) np.setAttribute('aria-labelledby', nb.id);
    if (np.style.display === 'block' || np.style.display === '') np.style.display = 'none';
    np.innerHTML = html != null ? html : '<h2>' + MS.esc(title) + '</h2><p>New tab. Double-click this text to write, or use Insert to add a chart, KPI cards or text here.</p>';
    stamp(nb); stamp(np);
    var lastBtn = src.btn, lastPanel = src.panel;
    MS.history.group('Add tab "' + title + '"', function () {
      MS.history.move('Add tab button', nb, function () { lastBtn.parentNode.insertBefore(nb, lastBtn.nextSibling); });
      MS.history.move('Add tab panel', np, function () { lastPanel.parentNode.insertBefore(np, lastPanel.nextSibling); });
    });
    var t = PT.find(title) || PT.group(true).tabs.filter(function (x) { return x.btn === nb; })[0];
    if (t) rt().showPageTab(t.index);
    MS.emit('structure');
    return t ? t.index : null;
  };
  PT.addPrompt = function () {
    MS.prompt('Add a tab to your dashboard', 'New tab', 'Tab name').then(function (v) { if (v) PT.add(v); });
  };
  PT.rename = function (which, title) {
    var t = PT.find(which); if (!t) return false;
    if (title == null) return MS.prompt('Rename tab', t.title).then(function (v) { if (v) PT.rename(t.index, v); });
    htmlOp('Rename tab', t.btn, function () { setText(t.btn, String(title).trim()); });
    MS.emit('structure');
    return true;
  };
  // move tab `which` so that it ends up at position `to`
  PT.move = function (which, to) {
    var g = PT.group(true), t = PT.find(which); if (!t) return false;
    var rest = g.tabs.filter(function (x) { return x !== t; }), ref = rest[to];
    to = Math.max(0, Math.min(rest.length, to));
    MS.history.group('Reorder tabs', function () {
      MS.history.move('Move tab button', t.btn, function () { if (ref) ref.btn.parentNode.insertBefore(t.btn, ref.btn); else { var last = rest[rest.length - 1].btn; last.parentNode.insertBefore(t.btn, last.nextSibling); } });
      MS.history.move('Move tab panel', t.panel, function () { if (ref) ref.panel.parentNode.insertBefore(t.panel, ref.panel); else { var last = rest[rest.length - 1].panel; last.parentNode.insertBefore(t.panel, last.nextSibling); } });
    });
    MS.emit('structure');
    return true;
  };
  PT.remove = function (which, confirmed) {
    var g = PT.group(true), t = PT.find(which); if (!t) return Promise.resolve(false);
    if (g.tabs.length < 2) { MS.toast('A dashboard needs at least one tab.', 'warn'); return Promise.resolve(false); }
    var go = function () {
      var wasActive = t.active, other = g.tabs.filter(function (x) { return x !== t; })[0];
      MS.history.group('Delete tab "' + t.title + '"', function () {
        MS.history.move('Remove tab button', t.btn, function () { t.btn.remove(); });
        MS.history.move('Remove tab panel', t.panel, function () { t.panel.remove(); });
      });
      if (wasActive && other) rt().showPageTab(PT.group(true).tabs.indexOf(PT.group().tabs.filter(function (x) { return x.btn === other.btn; })[0]));
      MS.emit('structure');
      return true;
    };
    if (confirmed) return Promise.resolve(go());
    return MS.confirm('Delete the "' + t.title + '" tab?', 'Its button and everything on it are removed. You can undo with Ctrl+Z.', 'Delete', true).then(function (ok) { return ok ? go() : false; });
  };
  // where "Insert" puts new things when the page has its own tabs: the panel on screen
  // Speaker notes for one of the dashboard's own tabs (kept in the state by tab name; never shown in the export).
  PT.notes = function (which, text) {
    var t = PT.find(which), rt = MS.rt(); if (!t || !rt) return;
    var put = function (v) { MS.history.state('Tab notes', function (s) { if (v) s.pageNotes[t.title] = v; else delete s.pageNotes[t.title]; }); };
    if (text != null) return put(text);
    var f = MS.form([{ key: 'n', label: 'Speaker notes (shown in Presenter view, never in the exported dashboard)', type: 'textarea', rows: 8, value: (rt.state.pageNotes || {})[t.title] || '' }]);
    MS.dialog({ title: '🗒 Notes for “' + t.title + '”', body: f, enterSubmits: false, buttons: [{ label: 'Cancel', value: null }, { label: 'Save', primary: true, value: function () { return f.values().n; } }] }).then(function (v) { if (v !== null) put(v); });
  };
  PT.insertHost = function () { var t = PT.active(); return t ? t.panel : null; };

  /* ---------------------------------------------------------- left panel section */
  PT.outlineSection = function () {
    var h = MS.h, g = PT.group(true);
    if (!g) return null;
    var sec = h('section', { 'class': 'ol-sec' }, [h('div', { 'class': 'ol-head' }, [h('span', { text: 'Your tabs (' + g.tabs.length + ')' }),
      h('button', { 'class': 'icon-btn', title: 'Add a tab to your dashboard', onclick: PT.addPrompt }, ['＋'])])]);
    sec.appendChild(h('p', { 'class': 'muted pad-sm small', text: 'Your dashboard\'s own tabs. Click to switch (in Edit mode too). Double-click to rename, drag to reorder.' }));
    var list = h('div', { 'class': 'ol-list' });
    g.tabs.forEach(function (t, i) {
      var row = h('div', { 'class': 'ol-row tab' + (t.active ? ' active' : ''), draggable: 'true', title: 'Click to show. Double-click to rename. Drag to reorder.' }, [
        h('span', { 'class': 'grip', text: '⠿' }),
        h('span', { 'class': 'grow name', text: t.title }),
        h('button', { 'class': 'icon-btn', title: 'More', onclick: function (e) { e.stopPropagation(); MS.menu(e.currentTarget, [
          { label: 'Rename…', run: function () { PT.rename(i); } },
          { label: 'Add a tab after this one…', run: function () { MS.prompt('Add a tab', 'New tab', 'Tab name').then(function (v) { if (v) PT.add(v, null, i); }); } },
          { label: 'Load a file into a new tab…', run: function () { MS.pickFiles(MS.importers.accept, { multiple: true }).then(function (fs) { if (fs.length) MS.importers.newTabs(fs); }); } },
          { label: 'Speaker notes…', run: function () { PT.notes(i); } },
          i > 0 ? { label: 'Move left / up', run: function () { PT.move(i, i - 1); } } : null,
          i < g.tabs.length - 1 ? { label: 'Move right / down', run: function () { PT.move(i, i + 1); } } : null,
          '-',
          { label: 'Delete tab', danger: true, run: function () { PT.remove(i); } }]); } }, ['⋯'])]);
      row.addEventListener('click', function () { PT.show(i); });
      row.addEventListener('dblclick', function () { PT.rename(i); });
      row.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/ms-ptab', String(i)); row.classList.add('dragging'); });
      row.addEventListener('dragend', function () { row.classList.remove('dragging'); });
      row.addEventListener('dragover', function (e) { if (e.dataTransfer.types.indexOf('text/ms-ptab') >= 0) { e.preventDefault(); row.classList.add('drop'); } });
      row.addEventListener('dragleave', function () { row.classList.remove('drop'); });
      row.addEventListener('drop', function (e) { e.preventDefault(); row.classList.remove('drop'); var from = +e.dataTransfer.getData('text/ms-ptab'); if (from !== i) PT.move(from, i); });
      list.appendChild(row);
    });
    sec.appendChild(list);
    sec.appendChild(h('div', { 'class': 'row gap pad-sm' }, [
      h('button', { 'class': 'btn sm', onclick: PT.addPrompt }, ['+ Add tab']),
      h('button', { 'class': 'btn sm', onclick: MS.insert.fileTab }, ['+ From file'])]));
    return sec;
  };
  MS.on('child-loaded', function (c) {
    c.win.addEventListener('ms:pagetab', function (e) { MS.emit('tab-shown', e.detail); MS.emit('structure'); });
  });
})(window.MS);
