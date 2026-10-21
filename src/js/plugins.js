/* Plugins (.js / .plugin) and recipes (.json). Plugins run with full access to
   Mothership, so only install files you trust; recipes are declarative and safe. */
(function (MS) {
  'use strict';
  var P = MS.plugins = { registered: [] };

  function api() {
    return {
      version: MS.VERSION,
      child: function () { return MS.child ? { win: MS.child.win, doc: MS.child.doc, rt: MS.rt() } : null; },
      selection: function () { return MS.sel; },
      select: function (el) { MS.edit.select(el); },
      state: function (label, fn) { MS.history.state(label, fn); },
      history: MS.history, toast: MS.toast, dialog: MS.dialog, form: MS.form, prompt: MS.prompt, confirm: MS.confirm,
      h: MS.h, esc: MS.esc, sanitize: MS.sanitize, lib: MS.lib, download: MS.download, pickFiles: MS.pickFiles, readFile: MS.readFile,
      tabs: MS.tabs, blocks: MS.blocks, insert: MS.insert, charts: MS.charts, data: MS.data, brand: MS.brand, edit: MS.edit,
      exportHtml: MS.exportHtml, on: MS.on, run: function (tool, args) { return MS.api.run(tool, args); },
      registerPlugin: P.register
    };
  }
  window.Mothership = { registerPlugin: function (def) { return P.register(def); }, api: api };

  P.register = function (def) {
    if (!def || !def.name) throw new Error('A plugin needs a name');
    def.id = def.id || def.name.toLowerCase().replace(/\W+/g, '-');
    P.registered = P.registered.filter(function (p) { return p.id !== def.id; });
    P.registered.push(def);
    try { if (def.onLoad) def.onLoad(api()); } catch (e) { MS.toast('Plugin ' + def.name + ' failed to start: ' + e.message, 'error'); }
    MS.emit('plugins');
    return def;
  };
  MS.on('child-loaded', function () { P.registered.forEach(function (p) { try { if (p.onChildLoaded) p.onChildLoaded(api()); } catch (e) { console.error(e); } }); });

  function run(code, name) {
    try { new Function('Mothership', 'api', code + '\n//# sourceURL=plugin:' + name)(window.Mothership, api()); return true; }
    catch (e) { MS.toast('Plugin ' + name + ' error: ' + e.message, 'error', 8000); console.error(e); return false; }
  }

  P.install = function (code, name) {
    var pre = MS.h('pre', { 'class': 'code-preview', text: code.slice(0, 1500) + (code.length > 1500 ? '\n…' : '') });
    MS.dialog({ title: 'Install plugin "' + name + '"?', wide: true, body: MS.h('div', {}, [
      MS.h('p', { 'class': 'warn-box', text: 'Plugins are code. They can read and change anything in Mothership and in the open dashboard. Only install plugins from people you trust. Here is the start of the code:' }), pre]),
      buttons: [{ label: 'Cancel', value: false }, { label: 'Install & run', primary: true, value: true }] }).then(function (ok) {
      if (!ok) return;
      if (run(code, name)) {
        MS.store.set('plugins', name, { name: name, code: code, enabled: true, added: Date.now() }).catch(function () {});
        MS.toast('Plugin installed. Its buttons are on the Plugins tab, and it will load automatically next time.', 'ok', 6000);
      }
    });
  };
  P.installManifest = function (j, name) { if (j.code) P.install(j.code, j.name || name); else MS.toast('Plugin manifest has no "code".', 'error'); };
  P.loadFile = function (file) {
    var ext = MS.ext(file.name);
    if (ext === 'json') return MS.readFile(file).then(function (t) { MS.loadJsonFile(t, file.name); });
    return MS.readFile(file, 'buffer').then(function (buf) {
      var u8 = new Uint8Array(buf);
      if (u8[0] === 0x50 && u8[1] === 0x4b) { // zip: look for plugin.js / main.js / any .js
        return MS.lib('jszip').then(function (Z) { return Z.loadAsync(buf); }).then(function (zip) {
          var js = Object.keys(zip.files).filter(function (p) { return /\.js$/i.test(p); }).sort(function (a, b) { return (/(plugin|main|index)\.js$/i.test(b) ? 1 : 0) - (/(plugin|main|index)\.js$/i.test(a) ? 1 : 0); })[0];
          if (!js) throw new Error('No .js file in ' + file.name);
          return zip.file(js).async('string').then(function (c) { P.install(c, file.name); });
        });
      }
      P.install(new TextDecoder().decode(u8), file.name);
    }).catch(function (e) { MS.toast(e.message, 'error'); });
  };
  P.boot = function () {
    MS.store.all('plugins').then(function (list) { list.forEach(function (x) { if (x.value.enabled) run(x.value.code, x.value.name); }); }).catch(function () {});
  };
  P.manage = function () {
    MS.store.all('plugins').then(function (list) {
      var body = list.length ? MS.h('div', { 'class': 'list' }, list.map(function (x) {
        var v = x.value;
        var cb = MS.h('input', { type: 'checkbox', checked: v.enabled, onchange: function () { v.enabled = cb.checked; MS.store.set('plugins', x.key, v); MS.toast('Takes effect next time Mothership opens.'); } });
        return MS.h('div', { 'class': 'list-row' }, [cb, MS.h('strong', { 'class': 'grow', text: v.name }), MS.h('small', { 'class': 'muted', text: new Date(v.added).toLocaleDateString('en-IN') }),
          MS.h('button', { 'class': 'btn sm danger', onclick: function (e) { MS.store.del('plugins', x.key); e.target.closest('.list-row').remove(); } }, ['Remove'])]);
      })) : MS.h('p', { text: 'No plugins installed. Use Plugins › Load plugin to add a .js or .plugin file. See plugins/ in the repo for examples.' });
      MS.dialog({ title: 'Plugins', body: body, buttons: [{ label: 'Close', primary: true, value: null }] });
    });
  };

  /* ---------------------------------------------------------- recipes */
  // {"$type":"mothership/recipe","name":"...","steps":[{"do":"addTab",...}, ...]}
  P.runRecipe = function (j, name) {
    var rt = MS.rt(); if (!rt) return MS.toast('Open a dashboard first, then run the recipe.', 'warn');
    var steps = j.steps || [];
    var log = [];
    var chain = Promise.resolve();
    function chartsMatching(m) {
      var cs = rt.charts();
      if (!m || m === '*') return cs;
      return cs.filter(function (c, i) {
        if (m.key && c.key === m.key) return true;
        if (m.index != null && i === m.index) return true;
        var info = rt.chartInfo(c.key) || {}, b = c.el.closest('.ms-block'), t = (b && b.querySelector('.ms-title').textContent) || info.title || '';
        return m.title && t.toLowerCase().indexOf(String(m.title).toLowerCase()) >= 0;
      });
    }
    function tabByTitle(t) { return rt.tabs().filter(function (x) { return x.title.toLowerCase() === String(t).toLowerCase(); })[0]; }
    steps.forEach(function (s, i) {
      chain = chain.then(function () {
        switch (s.do) {
          case 'layout':
            MS.tabs.ensureLayout();
            MS.history.state('Recipe layout', function (st) { if (s.ribbon) Object.assign(st.layout.ribbon, s.ribbon); if (s.pane) Object.assign(st.layout.pane, s.pane); });
            break;
          case 'theme': MS.brand.apply(MS.brand.normalize(s.theme || s, name)); break;
          case 'addTab':
            if (s.markdown) return MS.lib('marked').then(function (m) { MS.tabs.add(s.title || 'Tab', 'content', MS.sanitize(m.parse(s.markdown))); });
            MS.tabs.add(s.title || 'Tab', s.kind || (s.html ? 'content' : 'grid'), s.html ? MS.sanitize(s.html) : '');
            break;
          case 'renameTab': { var t = tabByTitle(s.from); if (t) MS.history.attrs('Rename', t.el, ['data-ms-title'], function (x) { x.setAttribute('data-ms-title', s.to); }); else log.push('No tab "' + s.from + '"'); break; }
          case 'deleteTab': { var d = tabByTitle(s.title); if (d) MS.history.move('Delete tab', d.el, function () { d.el.remove(); }); break; }
          case 'hideTab': { var hd = tabByTitle(s.title); if (hd) MS.history.attrs('Hide', hd.el, ['data-ms-hidden'], function (x) { x.setAttribute('data-ms-hidden', ''); }); break; }
          case 'wrapCharts': MS.blocks.wrapAll(); break;
          case 'tooltip': MS.history.state('Recipe tooltip', function (st) { chartsMatching(s.charts || '*').forEach(function (c) { st.charts[c.key] = st.charts[c.key] || {}; st.charts[c.key].tooltip = s.template; }); }); break;
          case 'chart':
            MS.history.state('Recipe chart', function (st) { chartsMatching(s.match).forEach(function (c) { var x = st.charts[c.key] = st.charts[c.key] || {}; ['tooltip', 'binding', 'drill'].forEach(function (k) { if (s[k] !== undefined) x[k] = s[k]; }); }); });
            if (s.commentary) chartsMatching(s.match).forEach(function (c) {
              var b = MS.blocks.wrap(c.el, true);
              ['title', 'sub', 'inf'].forEach(function (k) { if (s.commentary[k] != null) b.querySelector('.ms-' + k).textContent = s.commentary[k]; });
            });
            break;
          case 'moveChart': case 'copyChart': {
            var tb = tabByTitle(s.toTab); if (!tb) { log.push('No tab "' + s.toTab + '"'); break; }
            chartsMatching(s.match).forEach(function (c) { MS.blocks.sendToTab(c.el.closest('.ms-block') || c.el, tb.id, s.do === 'copyChart'); });
            break;
          }
          case 'dataset': if (s.rows) MS.data.addDataset(s.name, s.rows, true); else MS.history.state('Recipe dataset', function (st) { st.datasets[s.name] = { expr: s.expr, source: 'page' }; }); break;
          case 'filter': MS.history.state('Recipe filter', function (st) { st.filters.push({ dataset: s.dataset, field: s.field, label: s.label || s.field }); }); break;
          case 'replaceText': {
            var w = MS.child.win, walker = MS.child.doc.createTreeWalker(MS.child.doc.body, w.NodeFilter.SHOW_TEXT), n;
            while ((n = walker.nextNode())) if (n.nodeValue.indexOf(s.find) >= 0 && !/SCRIPT|STYLE/.test(n.parentNode.tagName)) n.nodeValue = n.nodeValue.split(s.find).join(s.replace);
            break;
          }
          case 'css': MS.history.state('Recipe CSS', function (st) { st.theme = st.theme || MS.brand.normalize({ name: 'Custom' }); st.theme.css = (st.theme.css || '') + '\n' + s.css; }); break;
          default: log.push('Step ' + (i + 1) + ': unknown action "' + s.do + '"');
        }
      }).catch(function (e) { log.push('Step ' + (i + 1) + ' failed: ' + e.message); });
    });
    chain.then(function () {
      MS.afterDomChange();
      MS.toast('Recipe "' + (j.name || name) + '" ran ' + steps.length + ' step(s)' + (log.length ? ', with ' + log.length + ' problem(s): ' + log.join('; ') : '.'), log.length ? 'warn' : 'ok', 8000);
    });
  };
})(window.MS);
