/* Boot: wire up the shell, drag & drop, samples, preview size, mode switch. */
(function (MS) {
  'use strict';
  MS.VERSION = '2.8.0';
  var h = MS.h;

  MS.busy = function (on) { document.body.classList.toggle('busy', !!on); };

  /* ---------------------------------------------------------- fit to space + zoom
     The dashboard is drawn at a real desktop width (so its layout doesn't squash in a
     narrow panel), then scaled down to fit. Zoom in to look closer; the stage scrolls. */
  var V = MS.view = { width: MS.prefs.get('renderWidth', 'auto'), zoom: MS.prefs.get('zoom', 'fit'), scale: 1 };
  var AUTO_MIN = 1280, ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
  V.layout = function () {
    var host = MS.$('#stage-frame-host'), stage = MS.$('#stage'), f = host && host.querySelector('iframe');
    if (!f) return;
    // scrollIntoView inside the dashboard also scrolls this clipped box, which hides the top of the page: undo that
    if (!host._msPinned) { host._msPinned = true; host.addEventListener('scroll', function () { if (host.scrollTop || host.scrollLeft) { host.scrollTop = 0; host.scrollLeft = 0; } }); }
    var presenting = document.body.classList.contains('presenting'), pad = presenting ? 0 : 24;
    var availW = Math.max(200, stage.clientWidth - pad), availH = Math.max(200, stage.clientHeight - pad);
    var w = V.width === 'auto' ? (availW >= AUTO_MIN || presenting ? null : AUTO_MIN) : V.width === 'panel' ? null : +V.width;
    var z = V.zoom === 'fit' || presenting ? (w ? Math.min(1, availW / w) : 1) : +V.zoom;
    var vw = w || Math.round(availW / z), vh = Math.round(availH / z);
    f.style.width = vw + 'px'; f.style.height = vh + 'px';
    f.style.transform = z === 1 ? '' : 'scale(' + z + ')';
    host.style.width = Math.round(vw * z) + 'px'; host.style.height = Math.round(vh * z) + 'px';
    host.classList.toggle('framed', !presenting);
    V.scale = z; V.renderWidth = vw;
    var lbl = MS.$('#zoom-pct'); if (lbl) { lbl.textContent = Math.round(z * 100) + '%'; lbl.title = 'Drawn at ' + vw + ' px wide' + (V.zoom === 'fit' ? ', scaled to fit' : '') + '. Click for zoom options.'; }
    MS.$$('#zoom-fit').forEach(function (b) { b.classList.toggle('on', V.zoom === 'fit'); });
  };
  V.setWidth = function (px, quiet) { V.width = px || 'auto'; MS.prefs.set('renderWidth', V.width); V.layout(); if (MS.ribbon) MS.ribbon.render(); if (!quiet) MS.toast(V.width === 'auto' ? 'Width: automatic (drawn at ' + AUTO_MIN + ' px or more, scaled to fit)' : V.width === 'panel' ? 'Width: same as the panel (no scaling)' : 'Drawn at ' + V.width + ' px wide', 'ok', 2500); };
  V.setZoom = function (z) { V.zoom = z === 'fit' ? 'fit' : Math.max(0.25, Math.min(3, +z)); MS.prefs.set('zoom', V.zoom); V.layout(); };
  V.step = function (dir) {
    var cur = V.scale, next = dir > 0 ? ZOOMS.filter(function (x) { return x > cur + 0.001; })[0] : ZOOMS.filter(function (x) { return x < cur - 0.001; }).pop();
    if (next) V.setZoom(next);
  };
  V.menu = function (anchor) {
    MS.menu(anchor, [{ label: 'Fit to window', run: function () { V.setZoom('fit'); } }].concat(['-'], ZOOMS.filter(function (z) { return z >= 0.5; }).map(function (z) { return { label: Math.round(z * 100) + '%', run: function () { V.setZoom(z); } }; }), ['-',
      { label: 'Draw at: automatic', run: function () { V.setWidth('auto'); } },
      { label: 'Draw at: panel width', run: function () { V.setWidth('panel'); } },
      { label: 'Draw at: 1920 px (full HD)', run: function () { V.setWidth(1920); } },
      { label: 'Draw at: 1440 px', run: function () { V.setWidth(1440); } },
      { label: 'Draw at: 1366 px (laptop)', run: function () { V.setWidth(1366); } },
      { label: 'Draw at: 820 px (tablet)', run: function () { V.setWidth(820); } },
      { label: 'Draw at: 390 px (phone)', run: function () { V.setWidth(390); } }]));
  };
  MS.stageWidth = function (px) { V.setWidth(px); }; // older plugins
  function wheelZoom(e) { if (!(e.ctrlKey || e.metaKey) || !MS.child) return; e.preventDefault(); V.step(e.deltaY < 0 ? 1 : -1); }
  MS.on('child-loaded', function (c) { V.layout(); c.win.addEventListener('wheel', wheelZoom, { passive: false }); });

  /* samples are bundled into samples/samples.js by tools/build.js so they open from file:// */
  MS.samples = {
    list: [
      { id: 'sales', label: 'Sales dashboard (Chart.js, with data for drill-down)' },
      { id: 'ops', label: 'Operations dashboard (ECharts)' },
      { id: 'risk', label: 'Risk dashboard (Plotly)' }
    ],
    menu: function () { return MS.samples.list.map(function (s) { return { label: s.label, run: function () { MS.samples.open(s.id); } }; }); },
    open: function (id) {
      var go = function () {
        var s = window.MS_SAMPLES && window.MS_SAMPLES[id];
        if (!s) return MS.toast('Sample not found. Run "node tools/build.js" or keep the samples folder next to mothership.html.', 'error');
        MS.openHtml(s.html, s.name);
      };
      if (window.MS_SAMPLES) return go();
      MS.busy(true);
      var sc = document.createElement('script'); sc.src = 'samples/samples.js';
      sc.onload = function () { MS.busy(false); go(); };
      sc.onerror = function () { MS.busy(false); MS.toast('Could not load samples/samples.js.', 'error'); };
      document.head.appendChild(sc);
    }
  };

  function routeDrop(files) {
    if (!files.length) return;
    var f = files[0], ext = MS.ext(f.name);
    if (/^(html?|htm)$/.test(ext) && files.length === 1) return MS.openFileObj(f);
    if (/^(skill|skills)$/.test(ext)) return MS.brand.loadFile(f);
    if (ext === 'json') return MS.openFileObj(f);
    if (/^(js|plugin)$/.test(ext)) return MS.plugins.loadFile(f);
    if (/^(woff2?|ttf|otf)$/.test(ext)) return MS.brand.addFontFiles(files);
    if (!MS.child) return MS.toast('Open a dashboard first, then drop files to add them.', 'warn');
    if (ext === 'md' || ext === 'zip') {
      return MS.dialog({ title: 'What is ' + f.name + '?', body: h('p', { text: 'Use it as brand guidelines (colours & fonts), or add it as content?' }),
        buttons: [{ label: 'Brand guidelines', value: 'brand' }, { label: 'New tab', value: 'tab', primary: true }, { label: 'Block in this tab', value: 'block' }] }).then(function (v) {
        if (v === 'brand') MS.brand.loadFile(f); else if (v === 'tab') MS.importers.newTabs(files); else if (v === 'block') MS.importers.asBlock(files);
      });
    }
    if (MS.importers.kind(f.name)) {
      return MS.dialog({ title: 'Add ' + (files.length > 1 ? files.length + ' files' : f.name), body: h('p', { text: 'Add as a new tab, or as a block in the current tab?' }),
        buttons: [{ label: 'Cancel', value: null }, { label: 'Block in this tab', value: 'block' }, { label: 'New tab', value: 'tab', primary: true }] }).then(function (v) {
        if (v === 'tab') MS.importers.newTabs(files); else if (v === 'block') MS.importers.asBlock(files);
      });
    }
    MS.toast('Mothership doesn\'t know what to do with ' + f.name, 'warn');
  }

  function boot() {
    MS.ribbon.render();
    MS.review.bar();
    MS.outline.render();
    MS.inspector.render();
    MS.plugins.boot();
    MS.versions.offerRecovery();
    document.addEventListener('keydown', function (e) { MS.handleKey(e, false); });
    MS.$$('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { MS.setMode(b.getAttribute('data-mode')); }); });
    MS.$('#btn-export').addEventListener('click', MS.cmd.export);
    MS.$('#btn-present').addEventListener('click', MS.cmd.present);
    MS.$('#btn-cmdk').addEventListener('click', function () { MS.palette(); });
    MS.$('#btn-theme').addEventListener('click', function () { MS.ui.dialog(); });
    MS.appbar.boot();
    MS.$$('[data-act]').forEach(function (b) { b.addEventListener('click', function () { var a = b.getAttribute('data-act'); if (a === 'sample') MS.samples.open('sales'); else MS.cmd[a](); }); });
    // drag & drop files anywhere
    var dz = MS.$('#dropzone'), depth = 0;
    window.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) { depth++; dz.classList.add('on'); } });
    window.addEventListener('dragleave', function () { if (--depth <= 0) { depth = 0; dz.classList.remove('on'); } });
    window.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0) e.preventDefault(); });
    window.addEventListener('drop', function (e) { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); depth = 0; dz.classList.remove('on'); routeDrop(Array.prototype.slice.call(e.dataTransfer.files)); });
    MS.on('changed', function (label) { MS.status(label ? 'Done: ' + label : ''); MS.$('#doc-name').classList.add('dirty'); });
    MS.on('saved', function () { MS.$('#doc-name').classList.remove('dirty'); });
    MS.on('doc-opened', function () { MS.$('#doc-name').classList.remove('dirty'); });
    // zoom controls in the status bar, Ctrl + mouse wheel over the dashboard, and refit when panels change size
    var zc = MS.$('#zoomctl');
    zc.appendChild(h('button', { 'class': 'zbtn', title: 'Zoom out (Ctrl + wheel)', onclick: function () { V.step(-1); } }, ['−']));
    zc.appendChild(h('button', { 'class': 'zbtn pct', id: 'zoom-pct', onclick: function (e) { V.menu(e.currentTarget); } }, ['100%']));
    zc.appendChild(h('button', { 'class': 'zbtn', title: 'Zoom in (Ctrl + wheel)', onclick: function () { V.step(1); } }, ['+']));
    zc.appendChild(h('button', { 'class': 'zbtn', id: 'zoom-fit', title: 'Fit the dashboard to the window', onclick: function () { V.setZoom('fit'); } }, ['⤢ Fit']));
    MS.$('#stage').addEventListener('wheel', wheelZoom, { passive: false });
    if (window.ResizeObserver) new ResizeObserver(MS.debounce(V.layout, 30)).observe(MS.$('#stage'));
    window.addEventListener('resize', MS.debounce(V.layout, 60));
    if (location.protocol === 'file:' && !window.indexedDB) MS.toast('This browser blocks storage for local files, so versions and autosave are off. Export still works.', 'warn', 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.MS);
