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

  /* Versions: each dashboard has its own numbered history (v1, v2, …) kept in this browser.
     Named versions are the ones you save (Ctrl+S, File › Versions, save_version); automatic ones are the safety copies
     Mothership keeps before risky steps (refreshing data, removing names, closing with unsaved work). Automatic copies
     are trimmed first, so they can never push out a version you named. */
  var lastId = 0;
  V.KEEP_NAMED = 100; V.KEEP_AUTO = 20;
  function docName() { return MS.doc && MS.doc.name || 'dashboard.html'; }
  function all() { return MS.store.all('versions').then(function (list) { return list.sort(function (a, b) { return b.key - a.key; }); }); }
  function snapshot(name, html, kind) {
    if (!MS.child) return Promise.resolve(false);
    try {
      html = html || MS.exportHtml();
      var now = Date.now(), id = lastId = Math.max(now, lastId + 1), doc = docName();
      return all().catch(function () { return []; }).then(function (list) {
        var top = 0; list.forEach(function (x) { if (x.value.doc === doc && x.value.number > top) top = x.value.number; });
        if (!top) top = list.filter(function (x) { return x.value.doc === doc; }).length;
        var rec = { id: id, number: top + 1, kind: kind || 'named', name: name || ('Version ' + new Date(now).toLocaleString()), doc: doc, created: now, html: html, size: html.length, editor: MS.VERSION };
        return MS.store.set('versions', id, rec).then(function () { return prune().catch(function () {}); }).then(function () { return rec; });
      });
    } catch (e) { return Promise.reject(e); }
  }
  V.checkpoint = function (name, html) {
    return snapshot(name, html, 'auto').catch(function (e) { MS.toast('Could not keep a browser recovery copy: ' + e.message + '. Export HTML for a backup.', 'warn', 8000); return false; });
  };
  // Silent saves are the safety copies other features keep before a risky step.
  V.save = function (name, silent, kind) {
    return snapshot(name, null, kind || (silent ? 'auto' : 'named')).then(function (rec) {
      if (rec && !silent) MS.toast('Saved v' + rec.number + ' “' + rec.name + '”. See File › Versions.', 'ok');
      return rec;
    }).catch(function (e) { MS.toast('Could not save version: ' + e.message + '. Use Export instead.', 'error'); return false; });
  };
  V.savePrompt = function () {
    if (!MS.child) return;
    MS.prompt('Save a version', 'Version ' + new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }), 'Name').then(function (n) { if (n) V.save(n); });
  };
  function prune() {
    return all().then(function (list) {
      var auto = list.filter(function (x) { return x.value.kind === 'auto'; }), named = list.filter(function (x) { return x.value.kind !== 'auto'; });
      auto.slice(V.KEEP_AUTO).concat(named.slice(V.KEEP_NAMED)).forEach(function (x) { MS.store.del('versions', x.key); });
    });
  }
  // [{id, number, name, kind, doc, created, size, editor}], newest first. doc: one dashboard's name, or every dashboard.
  V.records = function (doc) {
    return all().then(function (list) {
      return list.map(function (x) { var v = x.value; return { id: x.key, number: v.number || null, name: v.name, kind: v.kind || 'named', doc: v.doc, created: v.created, size: v.size, editor: v.editor || null }; })
        .filter(function (v) { return !doc || v.doc === doc; });
    });
  };
  V.get = function (id) { return MS.store.get('versions', +id); };
  V.restore = function (id, opts) {
    return V.get(id).then(function (v) {
      if (!v) throw new Error('No version ' + id + '.');
      return MS.openHtml(v.html, v.doc, Object.assign({ dirty: true }, opts || {})).then(function (ok) {
        if (ok && !(opts && opts.nonInteractive)) MS.toast('Restored ' + (v.number ? 'v' + v.number + ' ' : '') + '“' + v.name + '”. Export to keep it as a file.', 'ok');
        return ok ? v : null;
      });
    });
  };
  V.forget = function (id) { return MS.store.del('versions', +id); };
  V.list = function () {
    var mine = MS.doc ? docName() : null, scope = mine ? 'mine' : 'all', autos = false;
    var close = function () { var w = MS.$('.dlg-wrap'); if (w) w.remove(); };
    var holder = MS.h('div', { 'class': 'ver-list' });
    var seg = MS.h('div', { 'class': 'seg' }, [
      MS.h('button', { 'class': 'seg-btn', text: 'This dashboard', disabled: !mine, onclick: function () { scope = 'mine'; draw(); } }),
      MS.h('button', { 'class': 'seg-btn', text: 'All dashboards', onclick: function () { scope = 'all'; draw(); } })]);
    var autoBox = MS.h('input', { type: 'checkbox', onchange: function () { autos = autoBox.checked; draw(); } });
    var autoText = MS.h('span', { text: ' Show automatic safety copies' });
    function row(v) {
      var when = new Date(v.created).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
      var label = (v.number ? 'v' + v.number + ' ' : '') + '“' + v.name + '”';
      return MS.h('div', { 'class': 'list-row' + (v.kind === 'auto' ? ' ver-auto' : ''), 'data-version': v.id }, [
        MS.h('span', { 'class': 'ver-num', text: v.number ? 'v' + v.number : '–', title: v.kind === 'auto' ? 'Automatic safety copy' : 'Saved by you' }),
        MS.h('div', { 'class': 'grow' }, [MS.h('strong', { text: v.name }), MS.h('br'), MS.h('small', { 'class': 'muted', text: (scope === 'all' ? v.doc + ' · ' : '') + when + ' · ' + MS.bytes(v.size) + (v.kind === 'auto' ? ' · automatic' : '') + (v.editor ? ' · Mothership ' + v.editor : '') })]),
        MS.h('button', { 'class': 'btn sm', title: 'Open this version in place of what is on screen (unsaved work is kept as a safety copy first)', onclick: function () { close(); V.restore(v.id); } }, ['Restore']),
        MS.h('button', { 'class': 'btn sm', title: 'What changed between this version and the dashboard on screen', disabled: !MS.child, onclick: function () { close(); MS.compare.dialog(v.id); } }, ['Compare']),
        MS.h('button', { 'class': 'btn sm', title: 'Save this version as an HTML file', onclick: function () { V.get(v.id).then(function (x) { MS.download(x.doc.replace(/\.html?$/i, '') + (x.number ? ' v' + x.number : '') + ' - ' + x.name.replace(/[\\/:*?"<>|]+/g, '-') + '.html', x.html); }); } }, ['Download']),
        MS.h('button', { 'class': 'btn sm danger', onclick: function (e) {
          var r = e.target.closest('.list-row');
          MS.confirm('Delete this version?', label + ' will be removed from this browser. This cannot be undone.', 'Delete', true).then(function (ok) { if (ok) V.forget(v.id).then(function () { r.parentNode.removeChild(r); }); });
        } }, ['Delete'])
      ]);
    }
    function draw() {
      MS.$$('button', seg).forEach(function (b, i) { b.classList.toggle('on', (i === 0) === (scope === 'mine')); });
      V.records(scope === 'mine' ? mine : null).then(function (list) {
        var hidden = list.filter(function (v) { return v.kind === 'auto'; }).length;
        var shown = autos ? list : list.filter(function (v) { return v.kind !== 'auto'; });
        holder.innerHTML = '';
        holder.appendChild(shown.length ? MS.h('div', { 'class': 'list' }, shown.map(row)) : MS.h('p', { text: list.length ? 'Only automatic safety copies so far. Tick the box below to see them.' : 'No versions yet. Press Ctrl+S to save one.' }));
        autoText.textContent = ' Show automatic safety copies (' + hidden + ')';
      });
    }
    var body = MS.h('div', {}, [seg, holder, MS.h('label', { 'class': 'field check' }, [autoBox, autoText]),
      MS.h('p', { 'class': 'muted', text: 'Versions live in this browser on this laptop: v1, v2, … for each dashboard. Mothership also keeps automatic safety copies before risky steps; the oldest are removed first, so they never push out a version you named. Export (Ctrl+E) to keep a file you can share or back up.' })]);
    MS.dialog({ title: 'Versions', wide: true, body: body, buttons: [{ label: 'Save a version now', value: 'save', disabled: !MS.child }, { label: 'Close', primary: true, value: null }] }).then(function (v) { if (v === 'save') V.savePrompt(); });
    draw();
  };

  MS.api.add('versions', { d: 'The saved versions of dashboards in this browser (File › Versions): each dashboard has its own numbered history v1, v2, …. action: list (default; the open dashboard, or all: true) | restore (id or number; replaces what is on screen, needs force when it has unexported edits) | delete (id). Automatic safety copies are listed with kind "auto"; save one with save_version.',
    p: { action: ['string', 'list | restore | delete'], id: ['number', 'Version id (from list)'], number: ['number', 'Version number of the open dashboard, e.g. 3 for v3'], all: ['boolean', 'list: every dashboard, not just the open one'], force: ['boolean', 'restore: replace unexported edits on screen'] },
    f: function (a) {
      var act = a.action || 'list', doc = MS.doc ? docName() : null;
      var find = function () {
        if (a.id != null) return Promise.resolve(+a.id);
        if (a.number == null) throw new Error('Say which version: id, or number (for the open dashboard).');
        return V.records(doc).then(function (list) { var v = list.filter(function (x) { return x.number === +a.number; })[0]; if (!v) throw new Error('No v' + a.number + ' for ' + (doc || 'this dashboard') + '.'); return v.id; });
      };
      if (act === 'list') return V.records(a.all ? null : doc).then(function (list) { return { dashboard: a.all ? null : doc, versions: list.map(function (v) { return Object.assign({ version: v.number ? 'v' + v.number : null, when: new Date(v.created).toISOString() }, v); }) }; });
      if (act === 'restore') return find().then(function (id) { return V.restore(id, { nonInteractive: true, force: !!a.force }); }).then(function (v) { if (!v) throw new Error('Not restored. The dashboard on screen has unexported edits: export it first, or pass force: true.'); return { restored: v.number ? 'v' + v.number : v.name, name: v.name, doc: v.doc }; });
      if (act === 'delete') return find().then(function (id) { return V.forget(id).then(function () { return { deleted: id }; }); });
      throw new Error('action is list, restore or delete.');
    } });

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
      MS.$('.welcome').prepend(bar);
    }).catch(function () {});
  };
  window.addEventListener('beforeunload', function (e) { if (MS.dirty) { e.preventDefault(); e.returnValue = ''; } });
})(window.MS);
