/* Loading a child into the stage, and exporting it back to a standalone HTML. */
(function (MS) {
  'use strict';

  MS.doc = null;   // { name, source, folder }
  MS.child = null; // { win, doc }
  MS.rt = function () { return MS.child && MS.child.win && MS.child.win.__MS_RT || null; };
  MS.settings = { safe: false, netLock: MS.prefs.get('netLock', false) };

  var REL = /^(?!([a-z][a-z0-9+.-]*:|\/\/|#|\/))/i; // relative URL (no scheme, not protocol-relative, not anchor, not root)

  /* ---------------------------------------------------------- source preparation */
  function nextIdFactory(doc) {
    var max = 0;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-ms-id]'), function (e) {
      var n = parseInt((e.getAttribute('data-ms-id') || '').replace(/^m/, ''), 36); if (n > max) max = n;
    });
    return function () { return 'm' + (++max).toString(36); };
  }
  MS.prepareSource = function (html, opts) {
    opts = opts || {};
    var doc = new DOMParser().parseFromString(html, 'text/html');
    MS.$$('[data-ms-editor]', doc).forEach(function (n) { n.remove(); });
    var next = nextIdFactory(doc);
    MS.$$('*', doc.body).forEach(function (e) { if (!e.hasAttribute('data-ms-id') && !e.hasAttribute('data-ms-own')) e.setAttribute('data-ms-id', next()); });
    MS.nextId = next;

    var st = doc.getElementById('ms-state');
    if (!st) { st = doc.createElement('script'); st.id = 'ms-state'; st.type = 'application/json'; st.textContent = '{}'; }
    st.setAttribute('data-ms-own', '');
    if (opts.state) st.textContent = safeJson(opts.state);
    var oldRt = doc.getElementById('ms-runtime'); if (oldRt) oldRt.remove();
    doc.body.appendChild(st);
    var rs = doc.createElement('script'); rs.id = 'ms-runtime'; rs.setAttribute('data-ms-own', '');
    rs.textContent = MS.RUNTIME_SRC().replace(/<\/script/gi, '<\\/script');
    doc.body.appendChild(rs);
    // first thing in <head>: note script errors from the very start, before the page's own scripts run
    // (the runtime shows viewers a calm message; "Ready to publish?" lists them)
    var early = doc.getElementById('ms-early'); if (early) early.remove();
    early = doc.createElement('script'); early.id = 'ms-early'; early.setAttribute('data-ms-own', '');
    early.textContent = EARLY;
    doc.head.insertBefore(early, doc.head.firstChild);

    if (opts.editor) {
      var head = doc.head;
      var flag = doc.createElement('script'); flag.setAttribute('data-ms-editor', ''); flag.textContent = 'window.__MS_EDITOR=true;window.__MS_EDIT_MODE=true;';
      head.insertBefore(flag, head.firstChild);
      if (MS.settings.netLock) {
        var m = doc.createElement('meta'); m.setAttribute('data-ms-editor', ''); m.httpEquiv = 'Content-Security-Policy';
        m.content = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' data: blob:; style-src 'unsafe-inline' data: blob:; img-src data: blob:; font-src data: blob:; media-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'";
        head.insertBefore(m, head.firstChild);
      }
    }
    return { html: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML, doc: doc };
  };
  // Keep this listener in the exported page as well as the editor.
  function captureErrors() {
    window.__msErrs = window.__msErrs || [];
    function record(kind, message, file, line) {
      if (window.__msErrs.length >= 200) return;
      var item = { kind: kind, message: String(message || 'Script error').slice(0, 500), file: String(file || '').split('/').pop(), line: line || 0 };
      window.__msErrs.push(item);
      window.dispatchEvent(new CustomEvent('ms:load-error', { detail: item }));
    }
    window.addEventListener('error', function (e) {
      if (e.target === window || e.message) return record('script', e.message, e.filename, e.lineno);
      var target = e.target, url = target && (target.currentSrc || target.src || target.href);
      if (url) record('resource', 'Could not load ' + (target.tagName || 'resource').toLowerCase(), url);
    }, true);
    window.addEventListener('unhandledrejection', function (e) {
      var reason = e.reason;
      record('async', 'Async error: ' + (reason && reason.message || String(reason)));
    });
  }
  var EARLY = '(' + captureErrors.toString() + ')();';
  function safeJson(o) { return JSON.stringify(o).replace(/</g, '\\u003c'); }
  MS.safeJson = safeJson;

  /* ---------------------------------------------------------- document transitions */
  var cancelLoad = null;
  MS.confirmLeave = function (opts) {
    opts = opts || {};
    if (!MS.child || !MS.dirty || opts.force) return Promise.resolve(true);
    if (opts.nonInteractive) return Promise.reject(new Error('This dashboard has unsaved changes. Export it first, or pass force to replace it.'));
    var doc = MS.doc, session = doc.session, close = opts.kind === 'close';
    var same = function () { return MS.doc && MS.doc.session === session; };
    return MS.dialog({
      title: (close ? 'Close' : 'Replace') + ' "' + doc.name + '"?',
      body: MS.h('p', { text: 'This dashboard has edits that have not been exported. Export them, or leave without exporting. Mothership will try to keep a recovery copy in File › Versions.' }),
      buttons: [{ label: 'Cancel', value: null }, { label: close ? 'Close without saving' : 'Leave without saving', danger: true, value: 'leave' },
        { label: close ? 'Export, then close' : 'Export, then continue', primary: true, value: 'export' }]
    }).then(function (choice) {
      if (!choice || !same()) return false;
      // Start export in the click's promise chain so the file picker can use its activation.
      var rev = session.revision, backup = MS.versions.checkpoint('Recovery before ' + (close ? 'closing' : 'opening another dashboard'));
      if (choice === 'export') return MS.versions.exportFile(false).then(function (result) {
        return backup.then(function () { return !!(result && result.saved && same() && !MS.dirty); });
      });
      return backup.then(function () { return same() && session.revision === rev; });
    });
  };
  MS.openHtml = function (html, name, opts) {
    opts = opts || {};
    if (!opts.unlocked && MS.publish && MS.publish.isLocked(html)) {
      if (opts.nonInteractive && opts.password == null) return Promise.reject(new Error('This file is locked for editing. Pass its password.'));
      return MS.publish.gate(html, name || 'dashboard.html', opts.password).then(function (ok) {
        if (!ok) { if (opts.password != null) throw new Error('Wrong password: "' + (name || 'this file') + '" is locked for editing.'); return false; }
        return MS.openHtml(html, name, Object.assign({}, opts, { unlocked: true }));
      });
    }
    return (opts.reload ? Promise.resolve(true) : MS.confirmLeave(opts)).then(function (ok) {
      if (!ok) return false;
      var old = MS.doc, keep = !!opts.reload && old, dirty = keep ? MS.dirty : !!opts.dirty;
      var prepared = MS.prepareSource(html, { editor: true, state: opts.state });
      var assets = MS.assets.scan(prepared.doc);
      var doc = MS.doc = { name: name || 'dashboard.html', source: html, folder: !!opts.folder, reloaded: !!keep,
        session: keep ? old.session : { id: 'd-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), revision: 0 },
        assets: assets, importNotes: opts.importNotes || (keep && old.importNotes) || [], prepared: prepared.html };
      if (keep && old.integrity) doc.integrity = old.integrity;
      try { doc.state = JSON.parse(prepared.doc.getElementById('ms-state').textContent || '{}'); } catch (e) { doc.state = {}; }
      MS.edit.select(null);
      MS.child = null;
      MS.history.clear();
      MS.dirty = dirty;
      document.title = doc.name + ' · Mothership';
      MS.$('#doc-name').textContent = doc.name;
      MS.emit('doc-opened', doc);
      if (assets.relative.length && !keep) MS.toast(assets.relative.length + ' file reference(s) remain, for example ' + assets.relative[0] + '. Check File › Import report.', 'warn', 9000);
      return mountFrame(prepared.html, doc, opts.onLoad);
    });
  };

  function mountFrame(html, owner, onLoad) {
    var stage = MS.$('#stage-frame-host');
    if (cancelLoad) cancelLoad();
    stage.innerHTML = '';
    var f = MS.h('iframe', { id: 'child', title: 'Child document' });
    f.setAttribute('sandbox', MS.settings.safe ? 'allow-same-origin' : 'allow-scripts allow-same-origin allow-popups allow-modals allow-downloads allow-forms');
    return new Promise(function (resolve) {
      cancelLoad = function () { cancelLoad = null; resolve(false); };
      f.addEventListener('load', function () {
        if (MS.doc !== owner || !f.isConnected) return resolve(false);
        cancelLoad = null;
        MS.child = { win: f.contentWindow, doc: f.contentDocument, frame: f };
        MS.$('#empty').style.display = 'none';
        MS.emit('child-loaded', MS.child);
        if (onLoad) onLoad();
        MS.status(MS.settings.safe ? 'Safe mode: scripts are off, so charts will not render. Text and style edits still work.' : 'Loaded ' + owner.name);
        resolve(true);
      }, { once: true });
      f.srcdoc = html;
      stage.appendChild(f);
    });
  }
  MS.reload = function (opts) {
    if (!MS.child || !MS.doc) return Promise.resolve(false);
    opts = opts || {};
    var owner = MS.doc, html = MS.exportHtml();
    var checkpoint = MS.dirty && opts.checkpoint ? MS.versions.checkpoint(opts.checkpoint, html) : Promise.resolve();
    return checkpoint.then(function () {
      if (MS.doc !== owner || !MS.child) return false;
      // Re-export if an edit happened while the recovery copy was being stored.
      var current = MS.exportHtml();
      if (opts.before) opts.before();
      return MS.openHtml(current, owner.name, { folder: owner.folder, unlocked: true, reload: true });
    });
  };

  MS.closeDoc = function (opts) {
    if (!MS.doc && !MS.child) return Promise.resolve(true);
    var owner = MS.doc, name = owner ? owner.name : 'the dashboard';
    return MS.confirmLeave(Object.assign({}, opts, { kind: 'close' })).then(function (ok) {
      if (!ok || MS.doc !== owner) return false;
      if (MS.present && MS.present.on && MS.present.stop) MS.present.stop();
      if (MS.mode !== 'edit') MS.setMode('edit');
      MS.edit.select(null);
      if (cancelLoad) cancelLoad();
      MS.$('#stage-frame-host').innerHTML = '';
      MS.child = null; MS.doc = null; MS.sel = null; MS.dirty = false;
      MS.history.clear();
      document.title = 'Mothership';
      var dn = MS.$('#doc-name'); dn.textContent = 'No dashboard open'; dn.classList.remove('dirty');
      MS.$('#empty').style.display = '';
      MS.emit('doc-closed');
      MS.status('Closed ' + name);
      return true;
    });
  };

  MS.openFileObj = function (file) {
    var ext = MS.ext(file.name);
    if (ext === 'html' || ext === 'htm') return MS.readFile(file).then(function (t) { return MS.openHtml(t, file.name); });
    if (ext === 'json') return MS.readFile(file).then(function (t) { MS.loadJsonFile(t, file.name); });
    if (ext === 'js') return MS.readFile(file).then(function (t) { MS.plugins.install(t, file.name); });
    if (ext === 'md' || ext === 'skill' || ext === 'zip' || ext === 'skills') return MS.brand.loadFile(file);
    MS.toast('Use Insert to add ' + file.name + ' as content.', 'warn');
  };

  /* ---------------------------------------------------------- open folder (bundle relative assets) */
  function resolvePath(baseFile, rel) {
    var dir = baseFile.split('/').slice(0, -1).join('/');
    try { return decodeURIComponent(new URL(rel.split('#')[0].split('?')[0], 'http://x/' + (dir ? dir + '/' : '')).pathname.slice(1)); } catch (e) { return null; }
  }
  var TEXT_EXT = /^(json|csv|tsv|txt|geojson|xml|md)$/;
  MS.openFolder = function (files, opts) {
    var map = Object.create(null);
    files.forEach(function (f) { map[f.webkitRelativePath || f.name] = f; });
    var htmls = Object.keys(map).filter(function (p) { return /\.html?$/i.test(p); });
    if (!htmls.length) { if (opts && opts.nonInteractive) throw new Error('No .html file in that folder.'); MS.toast('No .html file in that folder.', 'error'); return Promise.resolve(false); }
    var choose = htmls.length === 1 ? Promise.resolve(htmls[0]) : (function () {
      var sorted = htmls.sort(function (a, b) { return (/index\.html?$/i.test(b) ? 1 : 0) - (/index\.html?$/i.test(a) ? 1 : 0) || a.length - b.length; });
      var form = MS.form([{ key: 'p', label: 'Which page is the dashboard?', type: 'select', options: sorted, value: sorted[0] }]);
      return MS.dialog({ title: 'Choose the child page', body: form, buttons: [{ label: 'Cancel', value: null }, { label: 'Open', primary: true, value: function () { return form.values().p; } }] });
    })();
    return choose.then(function (main) {
      if (!main) return false;
      MS.status('Bundling ' + main + '…');
      return MS.readFile(map[main]).then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var jobs = [], missing = [];
        function file(rel) { var p = resolvePath(main, rel); return p && map[p] ? { p: p, f: map[p] } : null; }
        MS.$$('script[src]', doc).forEach(function (s) {
          var u = s.getAttribute('src'); if (!REL.test(u)) return;
          var r = file(u); if (!r) return missing.push(u);
          jobs.push(MS.readFile(r.f).then(function (t) { s.removeAttribute('src'); s.setAttribute('data-ms-inlined', u); s.textContent = t.replace(/<\/script/gi, '<\\/script'); }));
        });
        MS.$$('link[rel~="stylesheet"][href]', doc).forEach(function (l) {
          var u = l.getAttribute('href'); if (!REL.test(u)) return;
          var r = file(u); if (!r) return missing.push(u);
          jobs.push(MS.readFile(r.f).then(function (css) { return inlineCssUrls(css, r.p, map); }).then(function (css) {
            var st = doc.createElement('style'); st.setAttribute('data-ms-inlined', u); st.textContent = css; l.replaceWith(st);
          }));
        });
        MS.$$('img[src],source[src],video[src],audio[src],video[poster],input[src]', doc).forEach(function (e) {
          ['src', 'poster'].forEach(function (a) {
            var u = e.getAttribute(a); if (!u || !REL.test(u)) return;
            var r = file(u); if (!r) return missing.push(u);
            jobs.push(assetURL(r.f).then(function (d) { e.setAttribute(a, d); }));
          });
        });
        MS.$$('[srcset],[imagesrcset]', doc).forEach(function (e) {
          ['srcset', 'imagesrcset'].forEach(function (attr) {
            if (!e.hasAttribute(attr)) return;
            var candidates = MS.assets.srcset(e.getAttribute(attr));
            jobs.push(Promise.all(candidates.map(function (c) {
              if (!REL.test(c.url)) return c;
              var r = file(c.url); if (!r) { missing.push(c.url); return c; }
              return assetURL(r.f).then(function (url) { return { url: url, descriptor: c.descriptor }; });
            })).then(function (items) {
              e.setAttribute(attr, items.map(function (c) { return c.url + (c.descriptor ? ' ' + c.descriptor : ''); }).join(', '));
            }));
          });
        });
        MS.$$('[style]', doc).forEach(function (e) { jobs.push(inlineCssUrls(e.getAttribute('style'), main, map).then(function (c) { e.setAttribute('style', c); })); });
        MS.$$('style', doc).forEach(function (s) { jobs.push(inlineCssUrls(s.textContent, main, map).then(function (c) { s.textContent = c; })); });
        // data files that the page may fetch() at runtime: serve them from a tiny virtual file system
        var vfs = {}, total = 0;
        Object.keys(map).forEach(function (p) {
          if (!TEXT_EXT.test(MS.ext(p)) || map[p].size > 8e6 || total > 25e6) return;
          total += map[p].size;
          jobs.push(MS.readFile(map[p]).then(function (t) { vfs[p] = t; }));
        });
        return Promise.all(jobs).then(function () {
          if (Object.keys(vfs).length) {
            var s = doc.createElement('script'); s.id = 'ms-vfs'; s.setAttribute('data-ms-own', '');
            s.textContent = vfsShim(vfs, main);
            doc.head.insertBefore(s, doc.head.firstChild);
          }
          if (missing.length) MS.toast('Could not find: ' + missing.slice(0, 3).join(', ') + (missing.length > 3 ? '…' : ''), 'warn', 8000);
          return MS.openHtml('<!DOCTYPE html>\n' + doc.documentElement.outerHTML, main.split('/').pop(), Object.assign({}, opts, { folder: true, importNotes: missing.filter(function (u, i) { return missing.indexOf(u) === i; }) })).then(function (ok) {
            if (ok) MS.toast('Bundled ' + jobs.length + ' file(s) into the dashboard.', 'ok');
            return ok;
          });
        });
      });
    });
  };
  function assetURL(file) {
    var types = { svg: 'image/svg+xml', png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', mp4: 'video/mp4', mp3: 'audio/mpeg' };
    return MS.readFile(file, 'dataurl').then(function (url) {
      var type = types[MS.ext(file.name)]; return type ? url.replace(/^data:application\/octet-stream;/i, 'data:' + type + ';') : url;
    });
  }
  function inlineCssUrls(css, cssPath, map) {
    var jobs = [];
    MS.assets.cssURLs(css, function (u, m, isImport) {
      if (isImport || !REL.test(u)) return;
      var p = resolvePath(cssPath, u);
      if (p && map[p] && MS.ext(p) !== 'css') jobs.push(assetURL(map[p]).then(function (d) { return [m, 'url("' + d + (u.indexOf('#') >= 0 ? u.slice(u.indexOf('#')) : '') + '")']; }));
    });
    return Promise.all(jobs).then(function (pairs) { pairs.forEach(function (x) { css = css.split(x[0]).join(x[1]); }); return css; });
  }
  function vfsShim(files, main) {
    var dir = main.split('/').slice(0, -1).join('/');
    return '(function(){var F=' + safeJson(files) + ',D=' + JSON.stringify(dir) + ';' +
      'function k(u){try{u=String(u&&u.url||u);var p=decodeURIComponent(new URL(u.split("#")[0].split("?")[0],"http://x/"+(D?D+"/":"")).pathname.slice(1));return F[p]!=null?p:null}catch(e){return null}}' +
      'var of=window.fetch;window.fetch=function(u,o){var p=k(u);if(p){var t=/\\.json$|\\.geojson$/i.test(p)?"application/json":"text/plain";return Promise.resolve(new Response(F[p],{status:200,headers:{"Content-Type":t}}))}return of?of.apply(this,arguments):Promise.reject(new Error("offline"))};' +
      'var oo=XMLHttpRequest.prototype.open,os=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.open=function(m,u){this.__msp=k(u);return oo.apply(this,arguments)};' +
      'XMLHttpRequest.prototype.send=function(){var p=this.__msp;if(!p)return os.apply(this,arguments);var x=this;Object.defineProperty(x,"readyState",{value:4});Object.defineProperty(x,"status",{value:200});Object.defineProperty(x,"responseText",{value:F[p]});Object.defineProperty(x,"response",{value:x.responseType==="json"?JSON.parse(F[p]):F[p]});setTimeout(function(){x.dispatchEvent(new Event("readystatechange"));x.dispatchEvent(new ProgressEvent("load"));x.dispatchEvent(new ProgressEvent("loadend"))},0)};' +
      '})();';
  }

  /* ---------------------------------------------------------- JSON files: dataset, theme, recipe, state */
  MS.loadJsonFile = function (text, name) {
    var j;
    try { j = JSON.parse(text); } catch (e) { return MS.toast(name + ' is not valid JSON: ' + e.message, 'error'); }
    var t = j && j.$type;
    if (t === 'mothership/theme' || (j && (j.colors || j.palette) && (j.fonts || j.colors))) return MS.brand.apply(MS.brand.normalize(j, name));
    if (t === 'mothership/recipe' || (j && Array.isArray(j.steps))) return MS.plugins.runRecipe(j, name);
    if (t === 'mothership/plugin') return MS.plugins.installManifest(j, name);
    if (Array.isArray(j) || (j && typeof j === 'object')) return MS.data.addDatasetFromJson(j, name);
  };

  /* ---------------------------------------------------------- export */
  MS.exportHtml = function (opts) {
    opts = opts || {};
    if (!MS.child) throw new Error('Nothing is open');
    var rt = MS.rt();
    var state = rt ? rt.getState() : JSON.parse(JSON.stringify(MS.doc.state || {}));
    if (opts.dropComments) delete state.comments;
    if (MS.audit && MS.child) state.changeLog = MS.audit.list();
    // only a published copy carries the seal (publish.js fills it in); working copies never do
    if (opts.publish) state.publish = opts.publish;
    else if (state.publish) delete state.publish.seal;
    var root = MS.child.doc.documentElement.cloneNode(true);
    MS.$$('[data-ms-editor]', root).forEach(function (n) { n.remove(); });
    // These style elements can be added during a later runtime refresh. The
    // exported runtime recreates them from its state; omitting them also keeps
    // an unchanged file stable across those refreshes.
    MS.$$('head #ms-base-css, head #ms-theme-css, head #ms-tip-css, head #ms-consult-css', root).forEach(function (n) { n.remove(); });
    MS.$$('.ms-sel,.ms-hover,.ms-editing,.ms-drop,.ms-dragging,.ms-flash,.ms-cmt-hover', root).forEach(function (n) { n.classList.remove('ms-sel', 'ms-hover', 'ms-editing', 'ms-drop', 'ms-dragging', 'ms-flash', 'ms-cmt-hover'); if (!n.className) n.removeAttribute('class'); });
    MS.$$('[contenteditable]', root).forEach(function (n) { n.removeAttribute('contenteditable'); n.removeAttribute('spellcheck'); });
    MS.$$('[_echarts_instance_]', root).forEach(function (n) { n.removeAttribute('_echarts_instance_'); n.innerHTML = ''; });
    var body = root.querySelector('body');
    body.classList.remove('ms-edit-mode');
    if (body.getAttribute('class') === '') body.removeAttribute('class');
    // strip everything the page's scripts (or our runtime) generated; they are rebuilt on load
    (function walk(n) {
      Array.prototype.slice.call(n.children).forEach(function (c) {
        if (!c.hasAttribute('data-ms-id') && !c.hasAttribute('data-ms-own')) { c.remove(); return; }
        walk(c);
      });
    })(body);
    // Scripts run in document order. Tabs move content around, so a chart canvas can now sit
    // after the script that draws it: move the page's body scripts to the end (order preserved).
    MS.$$('script', body).forEach(function (s) {
      if (/^ms-(state|runtime|vfs)$/.test(s.id) || /json|template|text\/(x-|ms-)/i.test(s.type || '')) return;
      body.appendChild(s);
    });
    var st = root.querySelector('#ms-state'); st.textContent = safeJson(state);
    var rs = root.querySelector('#ms-runtime'); rs.textContent = MS.RUNTIME_SRC().replace(/<\/script/gi, '<\\/script');
    body.appendChild(st); body.appendChild(rs);
    MS.$$('.ms-tab.ms-active', root).forEach(function (n) { n.classList.remove('ms-active'); });
    var meta = root.querySelector('meta[name="generator"]');
    if (!meta) { meta = MS.child.doc.createElement('meta'); meta.name = 'generator'; root.querySelector('head').appendChild(meta); }
    meta.content = 'HTML Mothership ' + MS.VERSION;
    return '<!DOCTYPE html>\n' + root.outerHTML;
  };
  MS.exportName = function (suffix) {
    var n = (MS.doc && MS.doc.name || 'dashboard.html').replace(/\.html?$/i, '');
    return n + (suffix || '') + '.html';
  };
})(window.MS);
