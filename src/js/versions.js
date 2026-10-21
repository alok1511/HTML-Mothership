/* Export to the laptop, named versions and autosave (stored in this browser's IndexedDB). */
(function (MS) {
  'use strict';
  var V = MS.versions = {};
  var handle = null; // File System Access handle from the last "Export", so later saves can overwrite it

  V.exportFile = function (saveAs) {
    if (!MS.child) return MS.toast('Nothing to export yet.', 'warn');
    var html;
    try { html = MS.exportHtml(); } catch (e) { return MS.toast('Export failed: ' + e.message, 'error'); }
    var name = MS.exportName();
    if (window.showSaveFilePicker && (saveAs || !handle)) {
      return window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'HTML page', accept: { 'text/html': ['.html', '.htm'] } }] })
        .then(function (h) { handle = h; return write(h, html); })
        .catch(function (e) { if (e && e.name === 'AbortError') return; MS.download(name, html); done(name, html); });
    }
    if (handle) return write(handle, html).catch(function () { MS.download(name, html); done(name, html); });
    MS.download(name, html); done(name, html);
  };
  function write(h, html) {
    return h.createWritable().then(function (w) { return w.write(html).then(function () { return w.close(); }); }).then(function () { done(h.name, html); });
  }
  function done(name, html) {
    MS.dirty = false; MS.emit('saved');
    MS.toast('Saved ' + name + ' (' + MS.bytes(html.length) + '). Open it in any browser. It also reopens in Mothership for more editing.', 'ok', 6000);
  }

  V.save = function (name, silent) {
    if (!MS.child) return Promise.resolve();
    var html = MS.exportHtml();
    var rec = { id: Date.now(), name: name || ('Version ' + new Date().toLocaleString('en-IN')), doc: MS.doc.name, created: Date.now(), html: html, size: html.length };
    return MS.store.set('versions', rec.id, rec).then(function () {
      if (!silent) MS.toast('Saved version "' + rec.name + '". See File › Versions.', 'ok');
      return prune();
    }).catch(function (e) { MS.toast('Could not save version: ' + e.message + '. Use Export instead.', 'error'); });
  };
  V.savePrompt = function () {
    if (!MS.child) return;
    MS.prompt('Save a version', 'Version ' + new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), 'Name').then(function (n) { if (n) V.save(n); });
  };
  function prune() {
    return MS.store.all('versions').then(function (list) {
      list.sort(function (a, b) { return b.key - a.key; });
      list.slice(60).forEach(function (x) { MS.store.del('versions', x.key); });
    });
  }
  V.list = function () {
    MS.store.all('versions').then(function (list) {
      list.sort(function (a, b) { return b.key - a.key; });
      var body = list.length ? MS.h('div', { 'class': 'list' }, list.map(function (x) {
        var v = x.value;
        return MS.h('div', { 'class': 'list-row' }, [
          MS.h('div', { 'class': 'grow' }, [MS.h('strong', { text: v.name }), MS.h('br'), MS.h('small', { 'class': 'muted', text: v.doc + ' · ' + new Date(v.created).toLocaleString('en-IN') + ' · ' + MS.bytes(v.size) })]),
          MS.h('button', { 'class': 'btn sm', onclick: function () { close(); if (MS.dirty) V.save('Auto-saved before restoring', true); MS.openHtml(v.html, v.doc); MS.toast('Restored "' + v.name + '".', 'ok'); } }, ['Restore']),
          MS.h('button', { 'class': 'btn sm', onclick: function () { MS.download(v.doc.replace(/\.html?$/i, '') + ' - ' + v.name.replace(/[\\/:*?"<>|]+/g, '-') + '.html', v.html); } }, ['Download']),
          MS.h('button', { 'class': 'btn sm danger', onclick: function (e) { MS.store.del('versions', x.key); e.target.closest('.list-row').remove(); } }, ['Delete'])
        ]);
      })) : MS.h('p', { text: 'No versions yet. Press Ctrl+S to save one.' });
      var close = function () { var w = MS.$('.dlg-wrap'); if (w) w.remove(); };
      MS.dialog({ title: 'Versions (kept in this browser on this laptop)', wide: true, body: MS.h('div', {}, [body, MS.h('p', { 'class': 'muted', text: 'Versions live in this browser only. Export (Ctrl+E) to keep a file you can share or back up.' })]), buttons: [{ label: 'Close', primary: true, value: null }] });
    });
  };

  /* autosave for crash recovery */
  var autosave = MS.debounce(function () {
    if (!MS.child) return;
    try { MS.store.set('kv', 'autosave', { doc: MS.doc.name, html: MS.exportHtml(), time: Date.now() }).catch(function () {}); } catch (e) {}
  }, 8000);
  MS.on('changed', function () { MS.dirty = true; autosave(); });
  MS.on('saved', function () { MS.store.del('kv', 'autosave').catch(function () {}); });
  V.offerRecovery = function () {
    MS.store.get('kv', 'autosave').then(function (a) {
      if (!a || !a.html) return;
      var bar = MS.h('div', { 'class': 'recover' }, [
        MS.h('span', { text: 'Unsaved work found: ' + a.doc + ' (' + new Date(a.time).toLocaleString('en-IN') + ').' }),
        MS.h('button', { 'class': 'btn sm primary', onclick: function () { bar.remove(); MS.openHtml(a.html, a.doc); MS.dirty = true; } }, ['Recover']),
        MS.h('button', { 'class': 'btn sm', onclick: function () { bar.remove(); MS.store.del('kv', 'autosave'); } }, ['Discard'])
      ]);
      MS.$('#empty').appendChild(bar);
    }).catch(function () {});
  };
  window.addEventListener('beforeunload', function (e) { if (MS.dirty) { e.preventDefault(); e.returnValue = ''; } });
})(window.MS);
