/* Boot: wire up the shell, drag & drop, samples, preview size, mode switch. */
(function (MS) {
  'use strict';
  MS.VERSION = '1.0.0';
  var h = MS.h;

  MS.busy = function (on) { document.body.classList.toggle('busy', !!on); };

  MS.stageWidth = function (px) {
    var host = MS.$('#stage-frame-host');
    host.style.width = px ? px + 'px' : '';
    host.classList.toggle('device', !!px);
    setTimeout(function () { var rt = MS.rt(); if (rt) rt.charts().forEach(function (c) { c.a.resize(c.inst); }); }, 80);
  };

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
    MS.outline.render();
    MS.inspector.render();
    MS.plugins.boot();
    MS.versions.offerRecovery();
    document.addEventListener('keydown', function (e) { MS.handleKey(e, false); });
    MS.$$('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { MS.setMode(b.getAttribute('data-mode')); }); });
    MS.$('#btn-export').addEventListener('click', MS.cmd.export);
    MS.$('#btn-present').addEventListener('click', MS.cmd.present);
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
    if (location.protocol === 'file:' && !window.indexedDB) MS.toast('This browser blocks storage for local files, so versions and autosave are off. Export still works.', 'warn', 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.MS);
