/* Left panel (outline: tabs, charts, datasets) and right panel (inspector). */
(function (MS) {
  'use strict';
  var h = MS.h;

  /* small popup menu */
  // A pop-up menu under `anchor`, or at a point (MS.menuAt). Items: {label, icon, key, run, danger, disabled, sub:[items]} or '-'.
  MS.menu = function (anchor, items) {
    var r = anchor.getBoundingClientRect();
    return MS.menuAt(r.left, r.bottom + 4, items, r);
  };
  MS.menuAt = function (x, y, items, avoid) {
    MS.$$('.popmenu').forEach(function (o) { o.remove(); });
    var closeAll = function () { MS.$$('.popmenu').forEach(function (o) { o.remove(); }); document.removeEventListener('mousedown', off, true); document.removeEventListener('keydown', key, true); window.removeEventListener('blur', closeAll); };
    function build(list, px, py, level) {
      var m = h('div', { 'class': 'popmenu' + (level ? ' sub' : ''), role: 'menu' });
      list.filter(Boolean).forEach(function (it) {
        if (it === '-') { if (m.lastChild && m.lastChild.tagName !== 'HR') m.appendChild(h('hr')); return; }
        var b = h('button', { 'class': (it.danger ? 'danger' : '') + (it.on ? ' on' : ''), role: 'menuitem', disabled: !!it.disabled, title: it.title || '' }, [
          h('span', { 'class': 'mi-ic' }, [it.icon && MS.icon.has(it.icon) ? MS.icon(it.icon) : (it.icon || '')]),
          h('span', { 'class': 'mi-label', text: it.label }),
          it.key ? h('kbd', { 'class': 'mi-key', text: it.key }) : null,
          it.sub ? h('span', { 'class': 'mi-more', text: '›' }) : null]);
        if (it.sub) {
          var open = function () { MS.$$('.popmenu.sub').forEach(function (o) { if (o.__level > level) o.remove(); }); var br = b.getBoundingClientRect(); var sm = build(it.sub, br.right + 2, br.top - 5, level + 1); sm.__level = level + 1; };
          b.addEventListener('mouseenter', open); b.addEventListener('click', open);
        } else {
          b.addEventListener('mouseenter', function () { MS.$$('.popmenu.sub').forEach(function (o) { if (o.__level > level) o.remove(); }); });
          b.addEventListener('click', function () { closeAll(); if (it.run) it.run(); });
        }
        m.appendChild(b);
      });
      if (m.lastChild && m.lastChild.tagName === 'HR') m.lastChild.remove();
      document.body.appendChild(m);
      var w = m.offsetWidth, hh = m.offsetHeight;
      var left = px + w > window.innerWidth - 8 ? (level ? px - w - 4 - (avoid ? 0 : 0) : window.innerWidth - w - 8) : px;
      if (level && px + w > window.innerWidth - 8) left = Math.max(8, px - w * 2 - 6);
      var top = py + hh > window.innerHeight - 8 ? Math.max(8, (avoid && !level ? avoid.top - hh - 4 : window.innerHeight - hh - 8)) : py;
      m.style.left = Math.max(8, left) + 'px'; m.style.top = top + 'px';
      return m;
    }
    var root = build(items, x, y, 0); root.__level = 0;
    root.tabIndex = -1; try { root.focus({ preventScroll: true }); } catch (e) {}
    var btns = function () { var subs = MS.$$('.popmenu'), m = subs[subs.length - 1]; return MS.$$('button:not([disabled])', m); };
    function off(e) { if (!e.target.closest || !e.target.closest('.popmenu')) closeAll(); }
    function key(e) {
      var list = btns(), i = list.indexOf(document.activeElement);
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && i < 0) { e.preventDefault(); e.stopPropagation(); var f0 = e.key === 'ArrowDown' ? list[0] : list[list.length - 1]; if (f0) f0.focus(); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); var subs = MS.$$('.popmenu.sub'); if (subs.length) subs[subs.length - 1].remove(); else closeAll(); return; }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); var n = list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]; if (n) n.focus(); return; }
      if (e.key === 'ArrowRight' && document.activeElement && document.activeElement.querySelector('.mi-more')) { e.preventDefault(); document.activeElement.click(); var l2 = btns(); if (l2[0]) l2[0].focus(); return; }
      if (e.key === 'ArrowLeft') { var sb = MS.$$('.popmenu.sub'); if (sb.length) { e.preventDefault(); sb[sb.length - 1].remove(); } }
    }
    setTimeout(function () { document.addEventListener('mousedown', off, true); document.addEventListener('keydown', key, true); window.addEventListener('blur', closeAll); }, 0);
    return root;
  };

  /* ============================================================ OUTLINE */
  var O = MS.outline = {};
  O.render = function () {
    var host = MS.$('#outline'); if (!host) return;
    host.innerHTML = '';
    var rt = MS.rt();
    if (!MS.child) { host.appendChild(h('p', { 'class': 'muted pad', text: 'Open a dashboard to see its tabs, charts and data here.' })); return; }
    if (!rt) { host.appendChild(h('p', { 'class': 'muted pad', text: 'Safe mode: the dashboard\'s scripts are off. You can edit text and styles. Turn safe mode off (View tab) for charts, tabs and data.' })); return; }

    /* tabs */
    var tabsSec = h('section', { 'class': 'ol-sec' }, [h('div', { 'class': 'ol-head' }, [h('span', { text: 'Tabs' }),
      h('button', { 'class': 'icon-btn', title: 'New chart tab', onclick: function () { MS.tabs.addPrompt('grid'); } }, ['＋']),
      h('button', { 'class': 'icon-btn', title: 'New tab from a file (Markdown, Word, Excel, PowerPoint, PDF, image)', onclick: MS.insert.fileTab }, ['📄'])])]);
    if (!rt.layoutEnabled()) {
      tabsSec.appendChild(h('div', { 'class': 'callout' }, [h('p', { text: 'This dashboard is one page. Turn on tabs to add How-to, FAQ and Methodology tabs and to move charts between tabs.' }),
        h('button', { 'class': 'btn primary sm', onclick: MS.tabs.toggleLayout }, ['Turn on tabbed layout'])]));
    } else {
      var list = h('div', { 'class': 'ol-list' });
      rt.tabs().forEach(function (t, i) {
        var row = h('div', { 'class': 'ol-row tab' + (t.id === rt.activeTab ? ' active' : '') + (t.hidden ? ' hidden' : ''), draggable: 'true', title: 'Drag to reorder. Double-click to rename.' }, [
          h('span', { 'class': 'grip', text: '⠿' }),
          h('span', { 'class': 'kind', text: t.kind === 'content' ? '📄' : t.kind === 'grid' ? '▦' : '◧', title: t.kind === 'content' ? 'Text tab' : t.kind === 'grid' ? 'Chart grid tab' : 'Original dashboard' }),
          h('span', { 'class': 'grow name', text: t.title }),
          t.notes ? h('span', { 'class': 'muted', title: 'Has speaker notes', text: '🗒' }) : null,
          h('button', { 'class': 'icon-btn', title: t.hidden ? 'Show tab' : 'Hide tab', onclick: function (e) { e.stopPropagation(); MS.tabs.toggleHidden(t.id); } }, [t.hidden ? '◌' : '◉']),
          h('button', { 'class': 'icon-btn', title: 'More', onclick: function (e) { e.stopPropagation(); MS.menu(e.target, [
            { label: 'Rename…', run: function () { MS.tabs.rename(t.id); } },
            { label: 'Speaker notes…', run: function () { MS.tabs.notes(t.id); } },
            { label: 'Load file into this tab…', run: function () { MS.pickFiles(MS.importers.accept, { multiple: true }).then(function (fs) { if (fs.length) MS.importers.intoTab(t.id, fs); }); } },
            { label: 'Duplicate', run: function () { MS.tabs.duplicate(t.id); } },
            { label: 'Move up', run: function () { if (i) MS.tabs.move(t.id, i - 1); } },
            { label: 'Move down', run: function () { MS.tabs.move(t.id, i + 1); } },
            '-',
            { label: 'Delete tab', danger: true, run: function () { MS.tabs.remove(t.id); } }]); } }, ['⋯'])
        ]);
        row.addEventListener('click', function () { rt.showTab(t.id); O.render(); });
        row.addEventListener('dblclick', function () { MS.tabs.rename(t.id); });
        row.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/ms-tab', t.id); row.classList.add('dragging'); });
        row.addEventListener('dragend', function () { row.classList.remove('dragging'); });
        row.addEventListener('dragover', function (e) { if (e.dataTransfer.types.indexOf('text/ms-tab') >= 0) { e.preventDefault(); row.classList.add('drop'); } });
        row.addEventListener('dragleave', function () { row.classList.remove('drop'); });
        row.addEventListener('drop', function (e) { e.preventDefault(); row.classList.remove('drop'); var id = e.dataTransfer.getData('text/ms-tab'); if (id && id !== t.id) MS.tabs.move(id, rt.tabs().filter(function (x) { return x.id !== id; }).findIndex(function (x) { return x.id === t.id; })); });
        list.appendChild(row);
      });
      tabsSec.appendChild(list);
      tabsSec.appendChild(h('div', { 'class': 'row gap pad-sm' }, [
        h('button', { 'class': 'btn sm', onclick: function () { MS.tabs.addPrompt('grid'); } }, ['+ Chart tab']),
        h('button', { 'class': 'btn sm', onclick: function () { MS.tabs.addPrompt('content'); } }, ['+ Text tab']),
        h('button', { 'class': 'btn sm', onclick: MS.insert.fileTab }, ['+ From file'])]));
    }
    // the dashboard's own tabs come first; Mothership's tab ribbon is only offered for one-page dashboards
    var pts = MS.pageTabs.outlineSection();
    if (pts) {
      host.appendChild(pts);
      if (!rt.layoutEnabled()) tabsSec = null;
    }
    if (tabsSec) host.appendChild(tabsSec);

    /* charts */
    var charts = rt.charts();
    var cSec = h('section', { 'class': 'ol-sec' }, [h('div', { 'class': 'ol-head' }, [h('span', { text: 'Charts (' + charts.length + ')' }),
      charts.length ? h('button', { 'class': 'icon-btn', title: 'Add title / subtitle / inference to every chart', onclick: MS.blocks.wrapAll }, ['✎']) : null])]);
    if (!charts.length) cSec.appendChild(h('p', { 'class': 'muted pad-sm', text: 'No charts found. Pictures, tables and other visuals can still be selected, moved and resized by clicking them.' }));
    var tabsById = {}; if (rt.layoutEnabled()) rt.tabs().forEach(function (t) { tabsById[t.id] = t.title; });
    var ptOf = function (el) { var t = MS.pageTabs.of(el); return t ? t.title : ''; };
    charts.forEach(function (c) {
      var b = c.el.closest('.ms-block'), info = rt.chartInfo(c.key) || {};
      var title = MS.charts.nameOf(c.key);
      var sec = c.el.closest('section.ms-tab');
      var cs = rt.state.charts[c.key] || {};
      var row = h('div', { 'class': 'ol-row' + (MS.sel && (MS.sel === b || MS.sel.contains(c.el)) ? ' active' : ''), title: MS.charts.kindName(info.type) + ' · click to go to it, double-click for settings' }, [
        h('span', { 'class': 'kind', text: MS.charts.kindIcon(info.type) }),
        h('span', { 'class': 'grow name', text: title }),
        cs.binding ? h('span', { title: 'Linked to data: drill-down and filters work', text: '⛁' }) : null,
        cs.tooltip || cs.style ? h('span', { title: 'Custom pop-up or look', text: '💬' }) : null,
        sec ? h('small', { 'class': 'muted', text: tabsById[sec.getAttribute('data-ms-tab')] || '' }) : ptOf(c.el) ? h('small', { 'class': 'muted', text: ptOf(c.el) }) : null
      ]);
      row.addEventListener('click', function () { MS.edit.reveal(b || MS.edit.chartUnit(c.el), true); });
      row.addEventListener('dblclick', function () { MS.charts.settings(c.key); });
      cSec.appendChild(row);
    });
    host.appendChild(cSec);

    /* datasets */
    var ds = Object.keys(rt.state.datasets);
    var dSec = h('section', { 'class': 'ol-sec' }, [h('div', { 'class': 'ol-head' }, [h('span', { text: 'Data (' + ds.length + ')' }),
      h('button', { 'class': 'icon-btn', title: 'Find data inside the dashboard', onclick: MS.data.discover }, ['🔍']),
      h('button', { 'class': 'icon-btn', title: 'Load a data file', onclick: MS.data.loadFile }, ['＋'])])]);
    ds.forEach(function (n) {
      var row = h('div', { 'class': 'ol-row' }, [h('span', { text: '⛁' }), h('span', { 'class': 'grow name', text: n }), h('small', { 'class': 'muted', text: rt.getRows(n).length + ' rows' })]);
      row.addEventListener('click', MS.data.manage);
      dSec.appendChild(row);
    });
    if (ds.length) dSec.appendChild(h('button', { 'class': 'btn sm', style: { margin: '6px 10px' }, onclick: MS.data.filters }, ['Design filter pane…']));
    host.appendChild(dSec);
    host.appendChild(MS.review.outlineSection());
  };
  ['structure', 'child-loaded', 'tab-shown', 'theme', 'changed', 'comments', 'doc-closed'].forEach(function (ev) { MS.on(ev, MS.debounce(O.render, 60)); });

  /* ============================================================ INSPECTOR */
  var Ins = MS.inspector = {};
  function toHex(c) { var rgb = MS.brand.hexToRgb(c); return rgb ? MS.brand.toHex(rgb) : '#000000'; }
  Ins.render = function () {
    var host = MS.$('#inspector'); if (!host) return;
    host.innerHTML = '';
    var el = MS.sel;
    if (!MS.child) return host.appendChild(h('div', { 'class': 'pad muted' }, [h('p', { text: 'Nothing open yet.' })]));
    if (!el || !el.isConnected) {
      return host.appendChild(h('div', { 'class': 'pad' }, [
        h('h3', { text: MS.doc.name }),
        h('p', { 'class': 'muted', text: MS.mode === 'edit' ? 'Click anything in the dashboard to select it. Double-click text to type. Double-click a chart for its settings.' : MS.mode === 'comment' ? 'Comment mode: click anything to comment on it, or drag a box around an area. The Comments tab (above) lists every comment.' : 'Interact mode: the dashboard works as normal (filters, tooltips, drill-down). Switch back to Edit (top centre, or Alt+1) to make changes.' }),
        h('h4', { text: 'Shortcuts' }),
        h('table', { 'class': 'keys' }, [['Ctrl+K', 'Search everything'], ['Alt+1 / 2 / 3', 'Edit / Comment / Interact mode'], ['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+C, X, V', 'Copy / cut / paste anything, also between dashboards'], ['Ctrl+Shift+V', 'Paste inside the selected section, card or tab'], ['Right-click', 'Menu for the part under the mouse'], ['Ctrl+D', 'Duplicate'], ['Delete', 'Delete selection'], ['Ctrl+S', 'Save a version'], ['Ctrl+E', 'Export HTML'], ['Ctrl+F', 'Find & replace'], ['Alt+↑', 'Select parent'], ['F5', 'Present'], ['Esc', 'Deselect']].map(function (r) { return h('tr', {}, [h('td', {}, [h('kbd', { text: r[0] })]), h('td', { text: r[1] })]); }))
      ]));
    }
    var w = MS.child.win, cs = w.getComputedStyle(el), rt = MS.rt();
    var block = el.classList.contains('ms-block') ? el : null;
    var chartKey = MS.blocks.chartKey(el);

    /* path */
    var path = [], n = el;
    while (n && n.tagName && !/^(HTML|BODY)$/.test(n.tagName) && path.length < 6) { path.unshift(n); n = n.parentElement; }
    host.appendChild(h('div', { 'class': 'crumbs' }, path.map(function (p, i) {
      return h('button', { 'class': 'crumb' + (p === el ? ' cur' : ''), title: describe(p, true), onclick: function () { MS.edit.select(p); } }, [describe(p)]);
    })));
    var title = block ? 'Block' + (chartKey ? ' with chart' : '') : chartKey ? 'Chart' : describe(el, true);
    host.appendChild(h('div', { 'class': 'ins-title' }, [h('strong', { text: title }), MS.edit.isGenerated(el) ? h('span', { 'class': 'tag warn', title: 'Created by the dashboard\'s own script. Changes may be redrawn on reload.', text: 'script-made' }) : null]));

    /* actions */
    var acts = h('div', { 'class': 'ins-actions' }, [
      MS.edit.textEditable(el) ? h('button', { 'class': 'btn sm', onclick: function () { MS.edit.startText(el); } }, ['✎ Edit text']) : null,
      chartKey ? h('button', { 'class': 'btn sm primary', onclick: function () { MS.charts.settings(chartKey); } }, ['⚙ Chart settings']) : null,
      (chartKey || el.tagName === 'IMG' || el.tagName === 'svg' || el.tagName === 'TABLE') && !block ? h('button', { 'class': 'btn sm', onclick: function () { MS.edit.select(MS.blocks.wrap(el, true)); } }, ['＋ Commentary']) : null,
      h('button', { 'class': 'btn sm', title: 'Alt+↑', onclick: function () { if (el.parentElement && !/^(BODY|HTML)$/.test(el.parentElement.tagName)) MS.edit.select(el.parentElement); } }, ['↑ Parent']),
      h('button', { 'class': 'btn sm', onclick: function () { MS.blocks.duplicate(block || el); } }, ['⧉ Duplicate']),
      h('button', { 'class': 'btn sm danger', onclick: function () { MS.blocks.remove(el); } }, ['🗑 Delete'])
    ]);
    host.appendChild(acts);

    /* send to tab */
    if (rt && rt.layoutEnabled() && (block || chartKey || el.tagName === 'IMG' || el.tagName === 'TABLE')) {
      var tabs = rt.tabs();
      var mv = h('select', { 'class': 'inp' }, [h('option', { value: '', text: 'Choose tab…' })].concat(tabs.map(function (t) { return h('option', { value: t.id, text: t.title }); })));
      host.appendChild(group('Send to tab', [h('div', { 'class': 'row gap' }, [mv,
        h('button', { 'class': 'btn sm', onclick: function () { if (mv.value) MS.blocks.sendToTab(el, mv.value, false); } }, ['Move']),
        h('button', { 'class': 'btn sm', onclick: function () { if (mv.value) MS.blocks.sendToTab(el, mv.value, true); } }, ['Copy'])]),
        h('small', { 'class': 'hint', text: 'Or drag the ⠿ handle onto a tab name in the dashboard ribbon (hold Ctrl to copy).' })]));
    }

    /* size: any chart, block, picture or card (drag the round handle, or type it here) */
    if (block || chartKey || el.tagName === 'IMG' || !/^inline/.test(cs.display) && !/^(TD|TH|TR|LI|OPTION)$/.test(el.tagName)) {
      var sz = MS.chartKit.sizeFields(el, function (v) { MS.chartKit.setSize(el, v); });
      host.appendChild(group('Size', [sz, h('small', { 'class': 'hint', text: block ? 'Or drag the corner handle of the block.' : chartKey || el.tagName === 'IMG' ? 'Or drag the round handle at the bottom-right corner.' : 'Width follows the columns of the grid it sits in.' })], !(block || chartKey || el.tagName === 'IMG')));
    }

    /* chart data and legend */
    if (chartKey && rt) {
      var bound = (rt.state.charts[chartKey] || {}).binding;
      host.appendChild(group('Data & legend', [
        h('div', { 'class': 'row gap' }, [h('button', { 'class': 'btn sm', title: 'Upload a CSV or Excel file, paste from Excel, or type the numbers for this chart', onclick: function () { MS.chartKit.dataDialog(chartKey); } }, ['⛁ Chart data…']),
          h('button', { 'class': 'btn sm', title: 'The numbers as a CSV file (also a template to fill in)', onclick: function () { MS.chartKit.downloadCsv(chartKey); } }, ['⬇ CSV'])]),
        bound ? h('small', { 'class': 'hint', text: 'Drawn from “' + bound.dataset + '”.' }) : null,
        h('label', { 'class': 'field' }, [h('span', { text: 'Legend' }), MS.chartKit.legendControl(chartKey)])]));
    }
    if (el.tagName === 'IMG') host.appendChild(group('Alt text', [MS.a11y.altField(el)]));
    if (el.tagName === 'TABLE' || el.closest('table')) host.appendChild(group('Table', [h('div', { 'class': 'row gap' }, [h('button', { 'class': 'btn sm', onclick: function () { MS.tables.rulesDialog(el.closest('table')); } }, ['🎨 Colour rules…'])]), h('small', { 'class': 'hint', text: 'Colour cells by their value: red / amber / green, colour scales or data bars.' })]));

    /* chart look */
    if (chartKey && rt) {
      var look = MS.charts.styleEditor((rt.state.charts[chartKey] || {}).style, function (v) { MS.charts.setStyle(chartKey, v, 'Chart look', true); }, true);
      host.appendChild(group('Chart look', [look, h('div', { 'class': 'row gap' }, [
        h('button', { 'class': 'btn sm', onclick: function () { MS.charts.styleAll(look.values()); } }, ['Use on every chart']),
        h('button', { 'class': 'btn sm', onclick: function () { MS.charts.settings(chartKey, 'Tooltip'); } }, ['Pop-up text…'])]),
        h('div', { 'class': 'row gap' }, [
        h('button', { 'class': 'btn sm', title: 'Copy this chart\'s look, colours and order to other charts', onclick: function () { MS.painter.copy(chartKey); } }, ['🖌 Painter']),
        h('button', { 'class': 'btn sm', title: 'Use this chart\'s category order on every chart', onclick: function () { MS.order.fromChart(chartKey); } }, ['⇅ Order everywhere']),
        h('button', { 'class': 'btn sm', onclick: function () { MS.chartOut.image(chartKey); } }, ['🖼 Image'])])]));
    }

    /* colours of the chart's categories / series: the chart and the dashboard's own legend change together */
    if (chartKey && rt) {
      var cinfo = rt.chartInfo(chartKey) || {}, ccols = rt.chartColors(chartKey), cnames = Object.keys(ccols).slice(0, 16);
      if (cnames.length) host.appendChild(group('Colours', [h('div', { 'class': 'cat-list' }, cnames.map(function (n) {
        return h('label', { 'class': 'cat-row' }, [colorField(toHex(rt.lookColor(n) || ccols[n]), function (v) { var m = {}; m[n] = v; MS.catColors.set(m, 'Colour of “' + n + '”'); }), h('span', { 'class': 'grow', text: n }),
          rt.lookColor(n) ? h('button', { 'class': 'icon-btn', title: 'Back to the chart\'s own colour', onclick: function () { var m = {}; m[n] = ''; MS.catColors.set(m, 'Reset colour of “' + n + '”'); } }, ['↺']) : null]);
      })), h('small', { 'class': 'hint', text: 'Changes this chart, its legend (also a legend written in the page), and every other chart that shows the same name.' })]));
    }
    var leg = rt && !chartKey && rt.legendOf ? rt.legendOf(el) : null;
    if (leg) {
      var lc = rt.chartColors(leg.key)[leg.name];
      host.appendChild(group('Legend colour', [h('label', { 'class': 'cat-row' }, [colorField(toHex(rt.lookColor(leg.name) || lc || '#999999'), function (v) { var m = {}; m[leg.name] = v; MS.catColors.set(m, 'Colour of “' + leg.name + '”'); }), h('span', { 'class': 'grow', text: leg.name })]),
        h('small', { 'class': 'hint', text: 'This is the legend of “' + MS.charts.nameOf(leg.key) + '”. Changing the colour here changes the chart too.' })]));
    }

    /* text */
    var fonts = MS.fonts.list();
    var fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    if (fonts.indexOf(fam) < 0) fonts.unshift(fam);
    var fSel = h('select', { 'class': 'inp' }, fonts.map(function (f) { var o = h('option', { value: f, text: f }); if (f === fam) o.selected = true; return o; }));
    fSel.addEventListener('change', function () { MS.edit.style(el, { fontFamily: /\s/.test(fSel.value) ? '"' + fSel.value + '"' : fSel.value }, 'Font'); });
    var size = h('input', { type: 'number', 'class': 'inp', value: Math.round(parseFloat(cs.fontSize)), min: 6, max: 200 });
    size.addEventListener('change', function () { MS.edit.style(el, { fontSize: size.value + 'px' }, 'Font size'); });
    var weight = h('select', { 'class': 'inp' }, ['300', '400', '500', '600', '700', '800'].map(function (v) { var o = h('option', { value: v, text: { 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold' }[v] }); if (String(cs.fontWeight) === v) o.selected = true; return o; }));
    weight.addEventListener('change', function () { MS.edit.style(el, { fontWeight: weight.value }, 'Weight'); });
    var col = colorField(toHex(cs.color), function (v) { MS.edit.style(el, { color: v }, 'Text colour'); });
    var bgc = colorField(MS.brand.hexToRgb(cs.backgroundColor) ? toHex(cs.backgroundColor) : '#ffffff', function (v) { MS.edit.style(el, { backgroundColor: v }, 'Background'); }, true);
    var align = h('div', { 'class': 'seg small' }, ['left', 'center', 'right', 'justify'].map(function (a) {
      return h('button', { 'class': 'seg-btn' + (cs.textAlign === a || (a === 'left' && cs.textAlign === 'start') ? ' on' : ''), title: a, onclick: function () { MS.edit.style(el, { textAlign: a }, 'Align'); } }, [{ left: '⟸', center: '≡', right: '⟹', justify: '☰' }[a]]);
    }));
    var lh = h('input', { type: 'number', 'class': 'inp', step: 0.1, min: 0.8, max: 3, placeholder: 'auto', value: el.style.lineHeight || '' });
    lh.addEventListener('change', function () { MS.edit.style(el, { lineHeight: lh.value }, 'Line height'); });
    var ls = h('input', { type: 'number', 'class': 'inp', step: 0.5, min: -2, max: 20, placeholder: '0', value: parseFloat(el.style.letterSpacing) || '' });
    ls.addEventListener('change', function () { MS.edit.style(el, { letterSpacing: ls.value === '' ? '' : ls.value + 'px' }, 'Letter spacing'); });
    var tcase = h('select', { 'class': 'inp' }, [['', 'As typed'], ['uppercase', 'UPPERCASE'], ['lowercase', 'lowercase'], ['capitalize', 'Title Case']].map(function (o) { var op = h('option', { value: o[0], text: o[1] }); if ((el.style.textTransform || '') === o[0]) op.selected = true; return op; }));
    tcase.addEventListener('change', function () { MS.edit.style(el, { textTransform: tcase.value }, 'Text case'); });
    var deco = h('div', { 'class': 'seg small' }, [['B', 'bold', { fontWeight: '700' }], ['I', 'italic', { fontStyle: 'italic' }], ['U', 'underline', { textDecoration: 'underline' }]].map(function (o) {
      return h('button', { 'class': 'seg-btn', title: o[1], style: o[2], onclick: function () { MS.edit.select(el); MS.edit.format(o[1]); } }, [o[0]]);
    }));
    host.appendChild(group('Text', [
      h('label', { 'class': 'field' }, [h('span', { text: 'Font' }), fSel]),
      h('div', { 'class': 'row gap' }, [h('label', { 'class': 'field grow' }, [h('span', { text: 'Size (px)' }), size]), h('label', { 'class': 'field grow' }, [h('span', { text: 'Weight' }), weight])]),
      h('div', { 'class': 'row gap' }, [h('label', { 'class': 'field grow' }, [h('span', { text: 'Colour' }), col]), h('label', { 'class': 'field grow' }, [h('span', { text: 'Background' }), bgc])]),
      h('div', { 'class': 'row gap' }, [h('label', { 'class': 'field' }, [h('span', { text: 'Align' }), align]), h('label', { 'class': 'field' }, [h('span', { text: 'Style' }), deco])]),
      h('div', { 'class': 'row gap' }, [h('label', { 'class': 'field grow' }, [h('span', { text: 'Line height' }), lh]), h('label', { 'class': 'field grow' }, [h('span', { text: 'Spacing (px)' }), ls]), h('label', { 'class': 'field grow' }, [h('span', { text: 'Case' }), tcase])])
    ]));

    /* hover pop-up for any element */
    var tipTxt = h('textarea', { 'class': 'inp', rows: 2, placeholder: 'e.g. Revenue is net of GST. Source: SAP, refreshed every Monday.', value: el.getAttribute('data-ms-tip') || '' });
    tipTxt.addEventListener('change', function () {
      var v = tipTxt.value.trim();
      MS.history.attrs(v ? 'Hover pop-up' : 'Remove hover pop-up', el, ['data-ms-tip'], function (x) { if (v) x.setAttribute('data-ms-tip', v); else x.removeAttribute('data-ms-tip'); });
    });
    host.appendChild(group('Hover pop-up', [
      h('label', { 'class': 'field' }, [h('span', { text: chartKey ? 'Note shown when hovering over this block (chart pop-ups are under Chart look)' : 'Text shown when someone hovers over this element' }), tipTxt]),
      h('div', { 'class': 'row gap' }, [h('button', { 'class': 'btn sm', onclick: Ins.tipStyle }, ['Pop-up style…']), h('small', { 'class': 'hint', text: 'Shows in Interact mode, presenting and the exported file.' })])
    ], !el.hasAttribute('data-ms-tip')));

    /* box */
    var boxFields = [['width', 'Width'], ['height', 'Height'], ['padding', 'Padding'], ['margin', 'Margin'], ['borderRadius', 'Corner radius'], ['border', 'Border']];
    host.appendChild(group('Box', [h('div', { 'class': 'box-grid' }, boxFields.map(function (bf) {
      var inp = h('input', { 'class': 'inp', value: el.style[bf[0]] || '', placeholder: bf[0] === 'border' ? '1px solid #ddd' : (bf[0] === 'width' || bf[0] === 'height' ? Math.round(el.getBoundingClientRect()[bf[0]]) + 'px' : cs[bf[0]]) });
      inp.addEventListener('change', function () { var v = inp.value.trim(); if (/^\d+(\.\d+)?$/.test(v)) v += 'px'; MS.edit.style(el, (function () { var o = {}; o[bf[0]] = v; return o; })(), bf[1]); if (chartKey) setTimeout(function () { rt.charts().forEach(function (c) { if (el.contains(c.el)) c.a.resize(c.inst); }); }, 50); });
      return h('label', { 'class': 'field' }, [h('span', { text: bf[1] }), inp]);
    })),
    h('div', { 'class': 'row gap' }, [
      h('button', { 'class': 'btn sm', onclick: function () { MS.edit.style(el, { display: cs.display === 'none' ? '' : 'none' }, 'Hide'); } }, [cs.display === 'none' ? 'Show' : 'Hide element']),
      h('button', { 'class': 'btn sm', onclick: function () { var p = el.previousElementSibling; if (p) MS.history.move('Move up', el, function () { el.parentNode.insertBefore(el, p); }); } }, ['Move ↑']),
      h('button', { 'class': 'btn sm', onclick: function () { var nx = el.nextElementSibling; if (nx) MS.history.move('Move down', el, function () { el.parentNode.insertBefore(el, nx.nextSibling); }); } }, ['Move ↓']),
      h('button', { 'class': 'btn sm', onclick: function () { MS.history.attrs('Clear styles', el, ['style'], function (x) { x.removeAttribute('style'); }); } }, ['Clear styles'])])
    ]));
  };
  function describe(el, long) {
    var s = el.tagName.toLowerCase();
    if (el.classList.contains('ms-block')) return 'block';
    if (el.id && !/^ms-/.test(el.id)) s += '#' + el.id;
    else if (el.classList.length) { var c = Array.prototype.filter.call(el.classList, function (x) { return !/^ms-(sel|hover|editing)/.test(x); })[0]; if (c) s += '.' + c; }
    if (long) { var t = (el.textContent || '').trim().slice(0, 30); if (t) s += ' “' + t + (el.textContent.trim().length > 30 ? '…' : '') + '”'; }
    return s;
  }
  function group(title, kids, closed) {
    var key = 'insp-' + title, open = MS.prefs.get(key, closed ? 'closed' : 'open') !== 'closed';
    var d = h('details', { 'class': 'ins-group', open: open }, [h('summary', { text: title })].concat(kids));
    d.addEventListener('toggle', function () { MS.prefs.set(key, d.open ? 'open' : 'closed'); });
    return d;
  }
  // one style for every hover pop-up on the page (and optionally the charts' pop-ups too)
  Ins.tipStyle = function () {
    var rt = MS.rt(); if (!rt) return;
    var t = rt.state.layout.tip || {};
    var f = MS.form([
      { key: 'bg', label: 'Background', type: 'color', value: t.bg || '#111827' },
      { key: 'color', label: 'Text colour', type: 'color', value: t.color || '#f9fafb' },
      { key: 'border', label: 'Border colour', type: 'color', value: t.border || '#111827' },
      { key: 'size', label: 'Text size (px)', type: 'number', min: 9, max: 24, value: t.size || 13 },
      { key: 'radius', label: 'Corner radius (px)', type: 'number', min: 0, max: 20, value: t.radius != null ? t.radius : 6 },
      { key: 'width', label: 'Maximum width (px)', type: 'number', min: 120, max: 600, value: t.width || 280 },
      { key: 'charts', label: 'Use the same look for chart pop-ups', type: 'checkbox', value: false }
    ]);
    MS.dialog({ title: 'Hover pop-up style', body: f, buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', primary: true, value: function () { return f.values(); } }] }).then(function (v) {
      if (!v) return;
      MS.history.group('Pop-up style', function () {
        MS.history.state('Pop-up style', function (s) { s.layout.tip = { bg: v.bg, color: v.color, border: v.border, size: v.size, radius: v.radius, width: v.width }; });
        if (v.charts) MS.history.state('Chart pop-ups', function (s) { rt.charts().forEach(function (c) { var cs = s.charts[c.key] = s.charts[c.key] || {}; cs.style = Object.assign({}, cs.style, { tipBg: v.bg, tipColor: v.color, tipBorder: v.border, tipSize: v.size, tipRadius: v.radius }); }); });
      });
    });
  };
  function colorField(value, onChange, allowClear) {
    var theme = MS.rt() && MS.rt().state.theme;
    var c = h('input', { type: 'color', value: value });
    c.addEventListener('change', function () { onChange(c.value); });
    if (MS.firm && MS.firm.locked()) { c.hidden = true; c.title = 'Brand colours only: the firm template is locked'; }
    var sw = theme ? h('div', { 'class': 'swatches mini' }, [].concat(Object.keys(theme.colors).map(function (k) { return theme.colors[k]; }), theme.palette).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 10).map(function (v) { return h('i', { style: { background: v }, title: v, onclick: function () { onChange(v); } }); })) : null;
    return h('div', { 'class': 'colorfield' }, [c, allowClear ? h('button', { 'class': 'icon-btn', title: 'No background', onclick: function () { onChange(''); } }, ['⌀']) : null, sw]);
  }
  MS.on('selection', Ins.render);
  MS.on('child-loaded', Ins.render);
  MS.on('doc-closed', Ins.render);
  MS.on('mode', Ins.render);
  MS.on('changed', MS.debounce(function () { if (!MS.editingText) Ins.render(); }, 80));
})(window.MS);
