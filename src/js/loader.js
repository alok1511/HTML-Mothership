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
  var EARLY = 'window.__msErrs=window.__msErrs||[];window.addEventListener("error",function(e){if(window.__msErrs.length<200)window.__msErrs.push({message:String(e.message||"Script error"),file:String(e.filename||"").split("/").pop(),line:e.lineno||0});});';
  function safeJson(o) { return JSON.stringify(o).replace(/</g, '\\u003c'); }
  MS.safeJson = safeJson;

  function relativeRefs(doc) {
    var out = [];
    MS.$$('script[src],link[rel~="stylesheet"][href],img[src],source[src],video[src],audio[src]', doc).forEach(function (e) {
      var u = e.getAttribute('src') || e.getAttribute('href');
      if (u && REL.test(u) && u.indexOf('data:') !== 0) out.push(u);
    });
    return out;
  }

  /* ---------------------------------------------------------- open */
  MS.openHtml = function (html, name, opts) {
    opts = opts || {};
    // a published file locked for editing asks for its password first (see publish.js)
    if (!opts.unlocked && MS.publish && MS.publish.isLocked(html)) {
      return MS.publish.gate(html, name || 'dashboard.html', opts.password).then(function (ok) {
        if (!ok) { if (opts.password != null) throw new Error('Wrong password: "' + (name || 'this file') + '" is locked for editing.'); return false; }
        return MS.openHtml(html, name, Object.assign({}, opts, { unlocked: true }));
      });
    }
    MS.doc = { name: name || 'dashboard.html', source: html, folder: !!opts.folder, reloaded: !!opts.reload };
    var probe = new DOMParser().parseFromString(html, 'text/html');
    var rel = opts.folder ? [] : relativeRefs(probe);
    var prepared = MS.prepareSource(html, { editor: true, state: opts.state });
    MS.doc.prepared = prepared.html;
    // keep the state for safe mode (no runtime runs there)
    try { MS.doc.state = JSON.parse(prepared.doc.getElementById('ms-state').textContent || '{}'); } catch (e) { MS.doc.state = {}; }
    mountFrame(prepared.html);
    MS.history.clear();
    MS.dirty = false;
    document.title = MS.doc.name + ' · Mothership';
    MS.$('#doc-name').textContent = MS.doc.name;
    if (rel.length) MS.toast(rel.length + ' linked file(s) (e.g. ' + rel[0] + ') can\'t load from a single file. Use "Open folder" so Mothership can bundle them.', 'warn', 9000);
    MS.emit('doc-opened', MS.doc);
    return Promise.resolve(true);
  };

  function mountFrame(html) {
    var stage = MS.$('#stage-frame-host');
    stage.innerHTML = '';
    var f = MS.h('iframe', { id: 'child', title: 'Child document' });
    f.setAttribute('sandbox', MS.settings.safe ? 'allow-same-origin' : 'allow-scripts allow-same-origin allow-popups allow-modals allow-downloads allow-forms');
    f.addEventListener('load', function () {
      MS.child = { win: f.contentWindow, doc: f.contentDocument, frame: f };
      MS.$('#empty').style.display = 'none';
      MS.emit('child-loaded', MS.child);
      MS.status(MS.settings.safe ? 'Safe mode: scripts are off, so charts will not render. Text and style edits still work.' : 'Loaded ' + MS.doc.name);
    });
    stage.appendChild(f);
    f.srcdoc = html;
  }
  MS.reload = function (keepState) {
    if (!MS.doc) return;
    var html = MS.exportHtml({ keepEditor: false });
    MS.openHtml(html, MS.doc.name, { folder: MS.doc.folder, unlocked: true, reload: true });
  };

  /* ---------------------------------------------------------- close */
  // Close the open dashboard and go back to the start screen. Unsaved changes: export, discard or cancel.
  MS.closeDoc = function (opts) {
    opts = opts || {};
    if (!MS.doc && !MS.child) return Promise.resolve(true);
    var name = MS.doc ? MS.doc.name : 'the dashboard';
    var ask = MS.dirty && !opts.force ? MS.dialog({ title: 'Close "' + name + '"?', body: MS.h('p', { 'class': 'dlg-msg', text: 'It has changes that are not exported yet. Export them to a file first, or close without saving (the last autosave stays in File › Versions until you discard it).' }),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Close without saving', danger: true, value: 'discard' }, { label: 'Export, then close', primary: true, value: 'save' }] }) : Promise.resolve('discard');
    return ask.then(function (v) {
      if (!v) return false;
      if (v === 'save') {
        var off = MS.on('saved', function () { off(); MS.closeDoc({ force: true }); });
        MS.versions.exportFile(false);
        return false;
      }
      if (MS.present && MS.present.on && MS.present.stop) try { MS.present.stop(); } catch (e) {}
      if (MS.mode !== 'edit') MS.setMode('edit');
      MS.edit.select(null);
      var host = MS.$('#stage-frame-host'); host.innerHTML = '';
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
    if (ext === 'html' || ext === 'htm') return MS.readFile(file).then(function (t) { MS.openHtml(t, file.name); });
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
    var map = {};
    files.forEach(function (f) { map[f.webkitRelativePath || f.name] = f; });
    var htmls = Object.keys(map).filter(function (p) { return /\.html?$/i.test(p); });
    if (!htmls.length) return MS.toast('No .html file in that folder.', 'error');
    var choose = htmls.length === 1 ? Promise.resolve(htmls[0]) : (function () {
      var sorted = htmls.sort(function (a, b) { return (/index\.html?$/i.test(b) ? 1 : 0) - (/index\.html?$/i.test(a) ? 1 : 0) || a.length - b.length; });
      var form = MS.form([{ key: 'p', label: 'Which page is the dashboard?', type: 'select', options: sorted, value: sorted[0] }]);
      return MS.dialog({ title: 'Choose the child page', body: form, buttons: [{ label: 'Cancel', value: null }, { label: 'Open', primary: true, value: function () { return form.values().p; } }] });
    })();
    return choose.then(function (main) {
      if (!main) return;
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
            jobs.push(MS.readFile(r.f, 'dataurl').then(function (d) { e.setAttribute(a, d); }));
          });
        });
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
          return MS.openHtml('<!DOCTYPE html>\n' + doc.documentElement.outerHTML, main.split('/').pop(), { folder: true, password: opts && opts.password }).then(function (ok) {
            if (ok) MS.toast('Bundled ' + jobs.length + ' file(s) into the dashboard.', 'ok');
            return ok;
          });
        });
      });
    });
  };
  function inlineCssUrls(css, cssPath, map) {
    var jobs = [];
    css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (m, q, u) {
      if (!REL.test(u) || u.indexOf('data:') === 0) return m;
      var p = resolvePath(cssPath, u);
      if (p && map[p]) jobs.push(MS.readFile(map[p], 'dataurl').then(function (d) { return [m, 'url("' + d + '")']; }));
      return m;
    });
    return Promise.all(jobs).then(function (pairs) { pairs.forEach(function (x) { css = css.split(x[0]).join(x[1]); }); return css; });
  }
  function vfsShim(files, main) {
    var dir = main.split('/').slice(0, -1).join('/');
    return '(function(){var F=' + safeJson(files) + ',D=' + JSON.stringify(dir) + ';' +
      'function k(u){try{u=String(u&&u.url||u);var p=decodeURIComponent(new URL(u.split("#")[0].split("?")[0],"http://x/"+(D?D+"/":"")).pathname.slice(1));return F[p]!=null?p:null}catch(e){return null}}' +
      'var of=window.fetch;window.fetch=function(u,o){var p=k(u);if(p){var t=/\\.json$|\\.geojson$/i.test(p)?"application/json":"text/plain";return Promise.resolve(new Response(F[p],{status:200,headers:{"Content-Type":t}}))}return of?of.apply(this,arguments):Promise.reject(new Error("offline"))};' +
      'var oo=XMLHttpRequest.prototype.open,os=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.open=function(m,u){this.__msp=k(u);return oo.apply(this,arguments)};' +
      'XMLHttpRequest.prototype.send=function(){var p=this.__msp;if(!p)return os.apply(this,arguments);var x=this;Object.defineProperty(x,"readyState",{value:4});Object.defineProperty(x,"status",{value:200});Object.defineProperty(x,"responseText",{value:F[p]});Object.defineProperty(x,"response",{value:x.responseType==="json"?JSON.parse(F[p]):F[p]});setTimeout(function(){x.onreadystatechange&&x.onreadystatechange();x.onload&&x.onload();x.dispatchEvent(new Event("load"))},0)};' +
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
    MS.$$('.ms-sel,.ms-hover,.ms-editing,.ms-drop,.ms-dragging,.ms-flash,.ms-cmt-hover', root).forEach(function (n) { n.classList.remove('ms-sel', 'ms-hover', 'ms-editing', 'ms-drop', 'ms-dragging', 'ms-flash', 'ms-cmt-hover'); if (!n.className) n.removeAttribute('class'); });
    MS.$$('[contenteditable]', root).forEach(function (n) { n.removeAttribute('contenteditable'); n.removeAttribute('spellcheck'); });
    MS.$$('[_echarts_instance_]', root).forEach(function (n) { n.removeAttribute('_echarts_instance_'); n.innerHTML = ''; });
    var body = root.querySelector('body');
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
