/* Template gallery: save a chart, a card, a section or a whole tab and reuse it in any dashboard.
   A template is the same snapshot that cross-dashboard paste uses (HTML plus each chart's numbers),
   kept in this browser and shareable as a .json file. A few starters are built in. */
(function (MS) {
  'use strict';
  var Tp = MS.templates = {}, h = MS.h, KEY = 'templates';
  function load() { return MS.store.get('kv', KEY).then(function (v) { return Array.isArray(v) ? v : []; }, function () { return []; }); }
  function save(list) { return MS.store.set('kv', KEY, list); }
  function uid() { return 'tp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  /* ---------- starters (no data of anyone's: sample numbers to type over) */
  function chartSnap(title, type, labels, series, html) { return { title: title, type: type, labels: labels, series: series, h: 0 }; }
  var Q = ['Q1', 'Q2', 'Q3', 'Q4'];
  Tp.STARTERS = [
    { id: 'starter-kpis', name: 'KPI row and two charts', kind: 'part', starter: true, about: 'Three KPI cards, a column chart and a doughnut, side by side.',
      snap: { v: 1, html: '<div class="ms-tpl-exec" style="display:grid;grid-template-columns:repeat(12,1fr);gap:16px;margin:12px 0">' +
        ['Revenue|$12.4M|+8% vs last year', 'Margin|31%|+2 pts', 'Customers|4,210|+310 this quarter'].map(function (k) { var p = k.split('|'); return '<div style="grid-column:span 4;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px"><div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em">' + p[0] + '</div><div style="font-size:28px;font-weight:700;margin:4px 0">' + p[1] + '</div><div style="font-size:12px;color:#059669">' + p[2] + '</div></div>'; }).join('') +
        '<div style="grid-column:span 8;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px"><div style="font-weight:600;margin-bottom:8px">Revenue by quarter</div><div data-clipchart="0" style="width:100%;height:260px"></div></div>' +
        '<div style="grid-column:span 4;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px"><div style="font-weight:600;margin-bottom:8px">Mix by product</div><div data-clipchart="1" style="width:100%;height:260px"></div></div></div>',
        charts: [chartSnap('Revenue by quarter', 'bar', Q, [{ name: 'This year', values: [2.8, 3.1, 3.0, 3.5] }, { name: 'Last year', values: [2.5, 2.9, 2.7, 3.2] }]), chartSnap('Mix by product', 'doughnut', ['Core', 'Add-ons', 'Services'], [{ name: 'Share', values: [58, 27, 15] }])] } },
    { id: 'starter-chart', name: 'Chart with commentary', kind: 'part', starter: true, about: 'A chart card with a title, a one-line subtitle and a "so what" line.',
      snap: { v: 1, html: '<div class="ms-tpl-card" style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:12px 0"><div style="font-weight:700;font-size:16px">What the chart shows</div><div style="color:#64748b;font-size:13px;margin:2px 0 10px">Units, period and source</div><div data-clipchart="0" style="width:100%;height:280px"></div><div style="border-left:3px solid #6366f1;padding:6px 10px;margin-top:10px;background:#f8fafc;font-size:13px"><b>So what:</b> the one thing the reader should take away.</div></div>',
        charts: [chartSnap('Trend', 'line', ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], [{ name: 'Actual', values: [120, 132, 128, 141, 150, 158] }, { name: 'Target', values: [125, 128, 131, 134, 137, 140] }])] } },
    { id: 'starter-notes', name: 'Notes and definitions', kind: 'part', starter: true, about: 'Two columns: what the numbers mean, and where they come from.',
      snap: { v: 1, html: '<div class="ms-tpl-notes" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0"><div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px"><h3 style="margin:0 0 6px;font-size:15px">Definitions</h3><ul style="margin:0;padding-left:18px;line-height:1.7"><li><b>Revenue</b>: invoiced sales, net of returns.</li><li><b>Margin</b>: gross profit ÷ revenue.</li></ul></div><div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px"><h3 style="margin:0 0 6px;font-size:15px">Source and refresh</h3><p style="margin:0;line-height:1.6">Finance system extract, refreshed every Monday. Owner: name, email.</p></div></div>', charts: [] } }
  ];

  Tp.list = function () { return load().then(function (mine) { return mine.concat(Tp.STARTERS); }); };
  // Save the selected part (what = 'selection') or the tab on screen (what = 'tab').
  Tp.save = function (name, what, el) {
    var rt = MS.rt(); if (!rt) return Promise.reject(new Error('Open a dashboard first.'));
    var node, kind = 'part', tabTitle = null;
    if (what === 'tab') {
      if (rt.layoutEnabled()) { var sec = rt.tabEl(rt.activeTab); node = sec.getAttribute('data-ms-kind') === 'content' ? (sec.querySelector('.ms-doc') || sec) : (sec.querySelector(':scope > .ms-grid') || sec); tabTitle = sec.getAttribute('data-ms-title'); }
      else if (MS.pageTabs.has()) { var pt = MS.pageTabs.active(); node = pt.panel; tabTitle = pt.title; }
      else node = MS.child.doc.body.querySelector('main') || MS.child.doc.body;
      kind = 'tab';
    } else node = MS.clipboard.unitOf(el || MS.sel);
    if (!node) return Promise.reject(new Error('Select a chart, card or section first.'));
    var snap = MS.clipboard.snapshot(node, uid());
    if (kind === 'tab') { var w = MS.child.doc.createElement('div'); w.innerHTML = snap.html; var root = w.firstElementChild; snap.html = root ? root.innerHTML : snap.html; snap.grid = !!(root && root.classList.contains('ms-grid')); }
    snap.doc = '';
    var t = { id: uid(), name: name || tabTitle || 'Template', kind: kind, created: new Date().toISOString(), src: MS.doc && MS.doc.name, charts: snap.charts.length, snap: snap };
    if (JSON.stringify(t).length > 4e6) return Promise.reject(new Error('That part is too large to keep as a template (pictures inside it?).'));
    return load().then(function (list) { list.unshift(t); return save(list).then(function () { return t; }); });
  };
  Tp.remove = function (id) { return load().then(function (list) { return save(list.filter(function (t) { return t.id !== id; })); }); };
  // Put a template in the dashboard: a part goes after the selection (or inside a selected section);
  // a tab template becomes a new tab.
  Tp.insert = function (t, opts) {
    opts = opts || {};
    var rt = MS.rt(); if (!rt) return Promise.reject(new Error('Open a dashboard first.'));
    var snap = JSON.parse(JSON.stringify(t.snap)); snap.src = 'template “' + t.name + '”'; snap.doc = snap.doc || '';
    if (t.kind === 'tab' && opts.asTab !== false && (rt.layoutEnabled() || MS.pageTabs.has())) {
      var id = MS.tabs.add(opts.title || t.name, snap.grid ? 'grid' : 'content', '');
      if (!id) return Promise.reject(new Error('Could not add a tab.'));
      MS.edit.select(String(id).indexOf('page:') === 0 ? MS.pageTabs.active().panel : MS.rt().tabEl(id));
      return MS.clipboard.pasteSnapshot(snap, true, true).then(function (n) { MS.edit.select(null); return n; });
    }
    return MS.clipboard.pasteSnapshot(snap, !!opts.inside, true);
  };

  Tp.saveSelection = function () {
    if (!MS.sel) return MS.toast('Select a chart, card or section first.', 'warn');
    MS.prompt('⭐ Save as template', '', 'Template name').then(function (v) {
      if (v === null) return;
      Tp.save(v || 'My template', 'selection').then(function (t) { MS.toast('Saved “' + t.name + '”. Insert it in any dashboard from Insert › Templates.', 'ok', 6000); }, function (e) { MS.toast(e.message, 'error'); });
    });
  };
  Tp.saveTab = function () {
    MS.prompt('⭐ Save this tab as a template', '', 'Template name').then(function (v) {
      if (v === null) return;
      Tp.save(v, 'tab').then(function (t) { MS.toast('Saved the tab as “' + t.name + '”.', 'ok', 5000); }, function (e) { MS.toast(e.message, 'error'); });
    });
  };
  Tp.gallery = function () {
    if (!MS.child) return MS.toast('Open a dashboard first.', 'warn');
    var grid = h('div', { 'class': 'tpl-grid' }), close;
    function draw() {
      Tp.list().then(function (all) {
        grid.innerHTML = '';
        all.forEach(function (t) {
          grid.appendChild(h('div', { 'class': 'tpl-card' }, [
            h('div', { 'class': 'tpl-top' }, [h('span', { 'class': 'tag', text: t.starter ? 'Starter' : t.kind === 'tab' ? 'Tab' : 'Part' }), t.charts || (t.snap.charts || []).length ? h('span', { 'class': 'muted small', text: (t.charts || t.snap.charts.length) + ' chart(s)' }) : null]),
            h('strong', { text: t.name }),
            h('div', { 'class': 'muted small', text: t.about || ('From ' + (t.src || 'a dashboard') + ' · ' + new Date(t.created).toLocaleDateString()) }),
            h('div', { 'class': 'row gap tpl-acts' }, [
              h('button', { 'class': 'btn sm primary', onclick: function () { close(); Tp.insert(t).then(function () { MS.toast('Inserted “' + t.name + '”. Double-click text to change it; right-click a chart › Chart data to type its numbers.', 'ok', 7000); }, function (e) { MS.toast(e.message, 'error'); }); } }, [t.kind === 'tab' ? 'Add as tab' : 'Insert']),
              t.starter ? null : h('button', { 'class': 'btn sm', title: 'Save as a .json file to share', onclick: function () { MS.download(t.name.replace(/[^\w\- ]+/g, '') + '.mstemplate.json', JSON.stringify({ mothershipTemplate: 1, templates: [t] }), 'application/json'); } }, ['⬇']),
              t.starter ? null : h('button', { 'class': 'btn sm danger', title: 'Delete this template', onclick: function () { Tp.remove(t.id).then(draw); } }, ['🗑'])])
          ]));
        });
      });
    }
    var importBtn = h('button', { 'class': 'btn', onclick: function () {
      MS.pickFiles('.json').then(function (fs) { if (!fs[0]) return; MS.readFile(fs[0]).then(function (txt) { return Tp.importJson(JSON.parse(txt)); }).then(function (n) { MS.toast(n + ' template(s) added.', 'ok'); draw(); }, function (e) { MS.dialogError('Not a template file: ' + e.message); }); });
    } }, ['⬆ Import…']);
    draw();
    var p = MS.dialog({ title: '⭐ Templates', sub: 'Reuse a chart, a card, a section or a whole tab in any dashboard. Charts come with their numbers; change them with Chart data.', xwide: true, enterSubmits: false,
      body: h('div', {}, [h('div', { 'class': 'row gap' }, [
        h('button', { 'class': 'btn', disabled: !MS.sel, title: MS.sel ? '' : 'Select a chart, card or section first', onclick: function () { close(); Tp.saveSelection(); } }, ['⭐ Save the selection…']),
        h('button', { 'class': 'btn', onclick: function () { close(); Tp.saveTab(); } }, ['⭐ Save this tab…']), importBtn]), grid]),
      buttons: [{ label: 'Close', value: null }] });
    close = function () { var w = MS.$$('.dlg-wrap').pop(); if (w) { var b = w.querySelector('.dlg-foot .btn'); if (b) b.click(); } };
    return p;
  };
  Tp.importJson = function (j) {
    var add = (j && j.templates || []).filter(function (t) { return t && t.snap && typeof t.snap.html === 'string'; }).map(function (t) { t = JSON.parse(JSON.stringify(t)); t.id = uid(); delete t.starter; return t; });
    if (!add.length) return Promise.reject(new Error('no templates in it'));
    return load().then(function (list) { return save(add.concat(list)).then(function () { return add.length; }); });
  };
})(window.MS);
