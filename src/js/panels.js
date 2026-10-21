/* Left panel (outline: tabs, charts, datasets) and right panel (inspector). */
(function (MS) {
  'use strict';
  var h = MS.h;

  /* small popup menu */
  MS.menu = function (anchor, items) {
    var old = MS.$('.popmenu'); if (old) old.remove();
    var r = anchor.getBoundingClientRect();
    var m = h('div', { 'class': 'popmenu', style: { left: Math.min(r.left, window.innerWidth - 230) + 'px', top: (r.bottom + 4) + 'px' } }, items.filter(Boolean).map(function (it) {
      if (it === '-') return h('hr');
      return h('button', { 'class': it.danger ? 'danger' : '', onclick: function () { m.remove(); it.run(); } }, [it.label]);
    }));
    document.body.appendChild(m);
    setTimeout(function () { document.addEventListener('mousedown', function off(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } }); }, 0);
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
    host.appendChild(tabsSec);

    /* charts */
    var charts = rt.charts();
    var cSec = h('section', { 'class': 'ol-sec' }, [h('div', { 'class': 'ol-head' }, [h('span', { text: 'Charts (' + charts.length + ')' }),
      charts.length ? h('button', { 'class': 'icon-btn', title: 'Add title / subtitle / inference to every chart', onclick: MS.blocks.wrapAll }, ['✎']) : null])]);
    if (!charts.length) cSec.appendChild(h('p', { 'class': 'muted pad-sm', text: 'No Chart.js, ECharts or Plotly charts found. Other visuals can still be selected, moved and resized by clicking them.' }));
    var tabsById = {}; if (rt.layoutEnabled()) rt.tabs().forEach(function (t) { tabsById[t.id] = t.title; });
    charts.forEach(function (c) {
      var b = c.el.closest('.ms-block'), info = rt.chartInfo(c.key) || {};
      var title = (b && b.querySelector('.ms-title').textContent.trim()) || info.title || MS.blocks.guessTitle(c.el) || (info.type + ' chart');
      var sec = c.el.closest('section.ms-tab');
      var cs = rt.state.charts[c.key] || {};
      var row = h('div', { 'class': 'ol-row' + (MS.sel && (MS.sel === b || MS.sel.contains(c.el)) ? ' active' : '') }, [
        h('span', { 'class': 'badge ' + c.lib, text: c.lib === 'chartjs' ? 'CJS' : c.lib === 'echarts' ? 'EC' : 'PL' }),
        h('span', { 'class': 'grow name', text: title }),
        cs.binding ? h('span', { title: 'Bound to data: drill-down and filters on', text: '⛁' }) : null,
        cs.tooltip ? h('span', { title: 'Custom tooltip', text: '💬' }) : null,
        sec ? h('small', { 'class': 'muted', text: tabsById[sec.getAttribute('data-ms-tab')] || '' }) : null
      ]);
      row.addEventListener('click', function () { MS.edit.reveal(b || MS.edit.chartUnit(c.el)); });
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
  };
  ['structure', 'child-loaded', 'tab-shown', 'theme', 'changed'].forEach(function (ev) { MS.on(ev, MS.debounce(O.render, 60)); });

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
        h('p', { 'class': 'muted', text: MS.mode === 'edit' ? 'Click anything in the dashboard to select it. Double-click text to type. Double-click a chart for its settings.' : 'Interact mode: the dashboard works as normal (filters, tooltips, drill-down). Switch back to Edit (top right) to make changes.' }),
        h('h4', { text: 'Shortcuts' }),
        h('table', { 'class': 'keys' }, [['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+C, X, V', 'Copy / cut / paste blocks'], ['Ctrl+D', 'Duplicate'], ['Delete', 'Delete selection'], ['Ctrl+S', 'Save a version'], ['Ctrl+E', 'Export HTML'], ['Ctrl+F', 'Find & replace'], ['Alt+↑', 'Select parent'], ['F5', 'Present'], ['Esc', 'Deselect']].map(function (r) { return h('tr', {}, [h('td', {}, [h('kbd', { text: r[0] })]), h('td', { text: r[1] })]); }))
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

    /* block size */
    if (block) {
      var vis = block.querySelector(':scope > .ms-visual');
      var span = parseInt((block.style.gridColumn || 'span 6').replace(/\D+/g, ''), 10) || 6;
      var inGrid = block.parentElement.classList.contains('ms-grid');
      var spanIn = h('input', { type: 'range', min: 1, max: 12, value: span });
      var spanLbl = h('span', { text: span + '/12' });
      spanIn.addEventListener('input', function () { spanLbl.textContent = spanIn.value + '/12'; block.style.gridColumn = 'span ' + spanIn.value; });
      spanIn.addEventListener('change', function () { block.style.gridColumn = 'span ' + span; MS.blocks.resize(block, +spanIn.value, null); });
      var hIn = h('input', { type: 'number', 'class': 'inp', min: 60, step: 10, value: parseInt(vis && vis.style.getPropertyValue('--ms-h'), 10) || (vis ? Math.round(vis.getBoundingClientRect().height) : 300) });
      hIn.addEventListener('change', function () { MS.blocks.resize(block, null, +hIn.value); if (block.classList.contains('ms-inline') && vis && !vis.style.height) MS.history.attrs('Height', vis, ['style'], function (x) { x.style.height = 'var(--ms-h)'; }); });
      host.appendChild(group('Size', [
        inGrid ? h('label', { 'class': 'field' }, [h('span', {}, ['Width ', spanLbl]), spanIn]) : null,
        h('label', { 'class': 'field' }, [h('span', { text: 'Height of the visual (px)' }), hIn]),
        h('small', { 'class': 'hint', text: 'Tip: drag the corner handle of the block.' })]));
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
    host.appendChild(group('Text', [
      h('label', { 'class': 'field' }, [h('span', { text: 'Font' }), fSel]),
      h('div', { 'class': 'row gap' }, [h('label', { 'class': 'field grow' }, [h('span', { text: 'Size (px)' }), size]), h('label', { 'class': 'field grow' }, [h('span', { text: 'Weight' }), weight])]),
      h('div', { 'class': 'row gap' }, [h('label', { 'class': 'field grow' }, [h('span', { text: 'Colour' }), col]), h('label', { 'class': 'field grow' }, [h('span', { text: 'Background' }), bgc])]),
      h('label', { 'class': 'field' }, [h('span', { text: 'Align' }), align])
    ]));

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
  function group(title, kids) { return h('details', { 'class': 'ins-group', open: true }, [h('summary', { text: title })].concat(kids)); }
  function colorField(value, onChange, allowClear) {
    var theme = MS.rt() && MS.rt().state.theme;
    var c = h('input', { type: 'color', value: value });
    c.addEventListener('change', function () { onChange(c.value); });
    var sw = theme ? h('div', { 'class': 'swatches mini' }, [].concat(Object.keys(theme.colors).map(function (k) { return theme.colors[k]; }), theme.palette).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(0, 10).map(function (v) { return h('i', { style: { background: v }, title: v, onclick: function () { onChange(v); } }); })) : null;
    return h('div', { 'class': 'colorfield' }, [c, allowClear ? h('button', { 'class': 'icon-btn', title: 'No background', onclick: function () { onChange(''); } }, ['⌀']) : null, sw]);
  }
  MS.on('selection', Ins.render);
  MS.on('child-loaded', Ins.render);
  MS.on('mode', Ins.render);
  MS.on('changed', MS.debounce(function () { if (!MS.editingText) Ins.render(); }, 80));
})(window.MS);
