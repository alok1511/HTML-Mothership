/* Export to the laptop, named versions and autosave (stored in this browser's IndexedDB). */
(function (MS) {
  'use strict';
  var V = MS.versions = {};
  var handle = null; // File System Access handle from the last "Export", so later saves can overwrite it

  function same(session) { return MS.doc && MS.doc.session === session; }
  V.markSaved = function (session, revision) {
    if (!same(session) || session.revision !== revision) return false;
    MS.dirty = false; MS.emit('saved', session);
    return true;
  };
  V.exportFile = function (saveAs, opts) {
    if (!MS.child) { MS.toast('Nothing to export yet.', 'warn'); return Promise.resolve({ saved: false }); }
    var session = MS.doc.session, revision = session.revision;
    var n = MS.review ? MS.review.list().length : 0;
    if (n && !opts) {
      return MS.dialog({ title: 'Keep the review comments?', body: MS.h('p', { text: 'This dashboard has ' + n + ' review comment(s). They are invisible to viewers, but anyone who opens the file in Mothership can read them. Leave them out if you are sharing the file outside your team.' }),
        buttons: [{ label: 'Cancel', value: null }, { label: 'Keep comments', value: 'keep' }, { label: 'Leave comments out', primary: true, value: 'drop' }] }).then(function (v) {
        return v && same(session) ? V.exportFile(saveAs, { dropComments: v === 'drop' }) : { saved: false, cancelled: true };
      });
    }
    var html, name = MS.exportName();
    function fail(e) { MS.toast('Could not export: ' + e.message + '. Your edits are still open.', 'error', 8000); return { saved: false, error: e.message }; }
    function done(file, downloaded) {
      V.markSaved(session, revision);
      MS.toast((downloaded ? 'Download started: ' : 'Saved ') + file + ' (' + MS.bytes(html.length) + '). Open the file to check it before sharing.', 'ok', 6000);
      return { saved: true, name: file, downloaded: !!downloaded };
    }
    function download() { try { MS.download(name, html); return done(name, true); } catch (e) { return fail(e); } }
    function write(h) {
      if (!same(session)) return Promise.resolve({ saved: false, cancelled: true });
      return Promise.resolve().then(function () { return h.createWritable(); }).then(function (w) {
        return w.write(html).then(function () { return w.close(); });
      }).then(function () { if (same(session)) handle = h; return done(h.name, false); }, fail);
    }
    try { html = MS.exportHtml(opts); } catch (e) { return Promise.resolve(fail(e)); }
    if (window.showSaveFilePicker && (saveAs || !handle)) {
      return Promise.resolve().then(function () {
        return window.showSaveFilePicker({ suggestedName: name, types: [{ description: 'HTML page', accept: { 'text/html': ['.html', '.htm'] } }] });
      }).then(write, function (e) {
        if (e && e.name === 'AbortError') return { saved: false, cancelled: true };
        if (e && /^(SecurityError|NotAllowedError)$/.test(e.name)) return download();
        return fail(e);
      });
    }
    if (handle && !saveAs) return write(handle);
    return Promise.resolve(download());
  };

  var lastId = 0;
  function snapshot(name, html) {
    if (!MS.child) return Promise.resolve(false);
    try {
      html = html || MS.exportHtml();
      var now = Date.now(), id = lastId = Math.max(now, lastId + 1);
      var rec = { id: id, name: name || ('Version ' + new Date(now).toLocaleString()), doc: MS.doc.name, created: now, html: html, size: html.length };
      return MS.store.set('versions', id, rec).then(function () { return prune().catch(function () {}); }).then(function () { return rec; });
    } catch (e) { return Promise.reject(e); }
  }
  V.checkpoint = function (name, html) {
    return snapshot(name, html).catch(function (e) { MS.toast('Could not keep a browser recovery copy: ' + e.message + '. Export HTML for a backup.', 'warn', 8000); return false; });
  };
  V.save = function (name, silent) {
    return snapshot(name).then(function (rec) {
      if (rec && !silent) MS.toast('Saved version "' + rec.name + '". See File › Versions.', 'ok');
      return rec;
    }).catch(function (e) { MS.toast('Could not save version: ' + e.message + '. Use Export instead.', 'error'); return false; });
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
          MS.h('button', { 'class': 'btn sm', onclick: function () { close(); MS.openHtml(v.html, v.doc, { dirty: true }).then(function (ok) { if (ok) MS.toast('Restored "' + v.name + '".', 'ok'); }); } }, ['Restore']),
          MS.h('button', { 'class': 'btn sm', onclick: function () { MS.download(v.doc.replace(/\.html?$/i, '') + ' - ' + v.name.replace(/[\\/:*?"<>|]+/g, '-') + '.html', v.html); } }, ['Download']),
          MS.h('button', { 'class': 'btn sm danger', onclick: function (e) { MS.store.del('versions', x.key); e.target.closest('.list-row').remove(); } }, ['Delete'])
        ]);
      })) : MS.h('p', { text: 'No versions yet. Press Ctrl+S to save one.' });
      var close = function () { var w = MS.$('.dlg-wrap'); if (w) w.remove(); };
      MS.dialog({ title: 'Versions (kept in this browser on this laptop)', wide: true, body: MS.h('div', {}, [body, MS.h('p', { 'class': 'muted', text: 'Versions live in this browser only. Export (Ctrl+E) to keep a file you can share or back up.' })]), buttons: [{ label: 'Close', primary: true, value: null }] });
    });
  };

  /* autosave for crash recovery */
  var autosave = MS.debounce(function (session) {
    if (!MS.child || !MS.dirty || !same(session)) return;
    try { MS.store.set('kv', 'autosave', { doc: MS.doc.name, html: MS.exportHtml(), time: Date.now(), session: session.id }).catch(function () {}); } catch (e) {}
  }, 8000);
  MS.on('changed', function () { if (!MS.doc) return; MS.dirty = true; MS.doc.session.revision++; autosave(MS.doc.session); });
  MS.on('doc-opened', function (d) { if (!d.reloaded) handle = null; if (MS.dirty) autosave(d.session); });
  MS.on('saved', function (session) {
    MS.store.get('kv', 'autosave').then(function (a) {
      if (a && session && a.session === session.id && same(session) && !MS.dirty) return MS.store.del('kv', 'autosave');
    }).catch(function () {});
  });
  MS.on('doc-closed', function () { handle = null; V.offerRecovery(); });
  V.offerRecovery = function () {
    MS.store.get('kv', 'autosave').then(function (a) {
      var old = MS.$('#empty .recover'); if (old) old.remove();
      if (!a || !a.html || MS.doc) return;
      var bar = MS.h('div', { 'class': 'recover' }, [
        MS.h('span', { text: 'Unsaved work found: ' + a.doc + ' (' + new Date(a.time).toLocaleString('en-IN') + ').' }),
        MS.h('button', { 'class': 'btn sm primary', onclick: function () { MS.openHtml(a.html, a.doc, { dirty: true }).then(function (ok) { if (ok) bar.remove(); }); } }, ['Recover']),
        MS.h('button', { 'class': 'btn sm', onclick: function () { bar.remove(); MS.store.del('kv', 'autosave'); } }, ['Discard'])
      ]);
      MS.$('#empty').appendChild(bar);
    }).catch(function () {});
  };
  window.addEventListener('beforeunload', function (e) { if (MS.dirty) { e.preventDefault(); e.returnValue = ''; } });
})(window.MS);
