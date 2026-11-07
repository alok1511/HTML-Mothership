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
  var actions = new Set(['layout', 'theme', 'addTab', 'ensureTab', 'renameTab', 'deleteTab', 'hideTab', 'wrapCharts',
    'tooltip', 'chart', 'moveChart', 'copyChart', 'dataset', 'filter', 'replaceText', 'css']);
  var required = { addTab: ['title'], ensureTab: ['title'], renameTab: ['from', 'to'], deleteTab: ['title'], hideTab: ['title'],
    tooltip: ['template'], moveChart: ['toTab'], copyChart: ['toTab'], dataset: ['name'], filter: ['dataset', 'field'], replaceText: ['find'], css: ['css'] };
  P.checkRecipe = function (recipe) {
    if (!recipe || (recipe.$type && recipe.$type !== 'mothership/recipe') || !Array.isArray(recipe.steps) || !recipe.steps.length || recipe.steps.length > 500) {
      throw new Error('A recipe needs 1 to 500 steps and type mothership/recipe.');
    }
    recipe.steps.forEach(function (s, i) {
      if (!s || !actions.has(s.do)) throw new Error('Step ' + (i + 1) + ' uses an unknown recipe action.');
      (required[s.do] || []).forEach(function (field) {
        if (typeof s[field] !== 'string' || (!['template', 'css'].includes(field) && !s[field].trim())) throw new Error('Step ' + (i + 1) + ' needs ' + field + '.');
      });
      ['ribbon', 'pane', 'theme', 'style', 'binding', 'drill', 'commentary'].forEach(function (key) {
        if (s[key] != null && (typeof s[key] !== 'object' || Array.isArray(s[key]))) throw new Error('Step ' + (i + 1) + ' needs an object for ' + key + '.');
      });
    });
    return recipe;
  };
  function low(v) { return String(v || '').trim().toLowerCase(); }
  function hasFields(rt, dataset, fields) {
    if (!Object.hasOwn(rt.state.datasets, dataset)) return false;
    var names = new Set(rt.fields(dataset).map(function (f) { return f.name; }));
    return fields.filter(Boolean).every(function (f) { return names.has(f); });
  }
  P.runRecipe = async function (recipe, name) {
    var rt = MS.rt(), child = MS.child;
    var label = recipe && recipe.name || name || 'Untitled recipe';
    function rejected(message) {
      MS.toast(message, 'warn', 8000);
      return { name: label, applied: 0, issues: [message], rejected: true };
    }
    if (!rt) return rejected('Open a dashboard with scripts enabled, then apply the recipe.');
    try { P.checkRecipe(recipe); } catch (e) { return rejected(e.message); }
    var steps = recipe.steps, markdown;
    if (steps.some(function (s) { return s.markdown; })) {
      try { markdown = await MS.lib('marked'); } catch (e) { return rejected('Could not open the Markdown reader: ' + e.message); }
    }
    if (MS.child !== child || MS.rt() !== rt) return rejected('The dashboard changed. Apply the recipe again.');
    var issues = [], applied = 0;
    function chartsMatching(m) {
      var cs = rt.charts();
      if (!m || m === '*') return cs;
      if (m.titleExact) {
        var matches = cs.filter(function (c) {
          return low(MS.charts.nameOf(c.key, c, cs)) === low(m.titleExact) &&
            (!m.library || c.lib === m.library) && (!m.tab || low(MS.qa.tabOf(c.el)) === low(m.tab));
        });
        if (matches.length !== 1) throw new Error('“' + m.titleExact + '” ' + (matches.length ? 'is ambiguous' : 'was not found') + '. Use an exact title and tab that identify one chart.');
        return matches;
      }
      return cs.filter(function (c, i) {
        if (m.key && c.key === m.key) return true;
        if (m.index != null && i === m.index) return true;
        return m.title && low(MS.charts.nameOf(c.key, c, cs)).includes(low(m.title));
      });
    }
    function tabByTitle(title) {
      var tabs = rt.layoutEnabled() ? rt.tabs() : MS.pageTabs.list();
      var found = tabs.filter(function (t) { return low(t.title) === low(title); });
      if (found.length > 1) throw new Error('More than one tab is called “' + title + '”.');
      return found[0];
    }
    function nativeTab(title) {
      var t = tabByTitle(title);
      if (!t) throw new Error('No tab called “' + title + '”.');
      if (!rt.layoutEnabled()) throw new Error('This action requires a Mothership tab. Use the layout tools for existing page tabs.');
      return t;
    }
    function replaceText(s) {
      var w = child.win, walker = child.doc.createTreeWalker(child.doc.body, w.NodeFilter.SHOW_TEXT), n, changes = [];
      while ((n = walker.nextNode())) {
        if (!n.parentElement.closest('script,style,[data-ms-editor]') && n.nodeValue.includes(s.find)) {
          changes.push({ node: n, before: n.nodeValue, after: n.nodeValue.split(s.find).join(s.replace == null ? '' : String(s.replace)) });
        }
      }
      if (changes.length) MS.history.push({ label: 'Recipe text',
        undo: function () { changes.forEach(function (c) { c.node.nodeValue = c.before; }); },
        redo: function () { changes.forEach(function (c) { c.node.nodeValue = c.after; }); } });
    }
    function setCommentary(c, commentary) {
      var block = MS.blocks.of(c.el) || MS.blocks.wrap(c.el, true);
      ['title', 'sub', 'inf'].forEach(function (k) {
        var target = block && block.querySelector('.ms-' + k);
        if (!target || commentary[k] == null || target.textContent === String(commentary[k])) return;
        var previous = target.innerHTML, next = String(commentary[k]);
        MS.history.push({ label: 'Recipe commentary',
          undo: function () { target.innerHTML = previous; }, redo: function () { target.textContent = next; } });
      });
    }
    function apply(s) {
      switch (s.do) {
        case 'layout':
          if (s.preservePageTabs && !rt.layoutEnabled() && MS.pageTabs.has()) throw new Error('The target uses its own tabs. Its layout was preserved.');
          MS.tabs.ensureLayout();
          MS.history.state('Recipe layout', function (st) { if (s.ribbon) Object.assign(st.layout.ribbon, s.ribbon); if (s.pane) Object.assign(st.layout.pane, s.pane); });
          return;
        case 'theme': MS.brand.apply(MS.brand.normalize(s.theme || s, name)); return;
        case 'addTab': case 'ensureTab': {
          if (s.do === 'ensureTab' && tabByTitle(s.title)) return;
          var html = s.markdown ? markdown.parse(s.markdown) : s.html || '';
          var kind = html ? 'content' : s.kind || 'grid';
          if (MS.tabs.add(s.title, kind, MS.sanitize(html)) == null) throw new Error('Could not add “' + s.title + '”.');
          if (s.hidden && rt.layoutEnabled() && rt.tabs().length > 1) {
            var added = nativeTab(s.title);
            if (!added.hidden) MS.tabs.toggleHidden(added.id);
          }
          return;
        }
        case 'renameTab': {
          var t = nativeTab(s.from);
          MS.history.attrs('Rename tab', t.el, ['data-ms-title'], function (x) { x.setAttribute('data-ms-title', s.to); });
          return;
        }
        case 'deleteTab': {
          var t = nativeTab(s.title);
          if (rt.tabs().length < 2) throw new Error('The dashboard needs at least one tab.');
          MS.history.move('Delete tab', t.el, function () { t.el.remove(); });
          return;
        }
        case 'hideTab': {
          var t = nativeTab(s.title);
          if (!t.hidden && rt.tabs().filter(function (x) { return !x.hidden; }).length > 1) MS.tabs.toggleHidden(t.id);
          return;
        }
        case 'wrapCharts': MS.blocks.wrapAll(); return;
        case 'tooltip': case 'chart': {
          var charts = chartsMatching(s.do === 'tooltip' ? s.charts || '*' : s.match);
          if (!charts.length) throw new Error('No chart matched this step.');
          var binding = s.binding;
          if (binding && !hasFields(rt, binding.dataset, (binding.levels || []).concat([binding.measure, binding.series]))) {
            throw new Error('The target dashboard does not have the required binding dataset and fields.');
          }
          var props = s.do === 'tooltip' ? { tooltip: s.template } : Object.fromEntries(['tooltip', 'style', 'binding', 'drill'].filter(function (k) { return s[k] !== undefined; }).map(function (k) { return [k, s[k]]; }));
          if (Object.keys(props).length) MS.history.state('Recipe chart', function (st) {
            charts.forEach(function (c) {
              var chart = st.charts[c.key] = st.charts[c.key] || {};
              Object.keys(props).forEach(function (key) { chart[key] = props[key] == null ? props[key] : JSON.parse(JSON.stringify(props[key])); });
            });
          });
          if (s.commentary) charts.forEach(function (c) { setCommentary(c, s.commentary); });
          return;
        }
        case 'moveChart': case 'copyChart': {
          var t = nativeTab(s.toTab), charts = chartsMatching(s.match);
          if (!charts.length) throw new Error('No chart matched this step.');
          charts.forEach(function (c) { MS.blocks.sendToTab(MS.blocks.of(c.el) || c.el, t.id, s.do === 'copyChart'); });
          return;
        }
        case 'dataset':
          if (s.rows) MS.data.addDataset(s.name, s.rows, true);
          else MS.history.state('Recipe dataset', function (st) { st.datasets[s.name] = { expr: s.expr, source: 'page' }; });
          return;
        case 'filter':
          if (!hasFields(rt, s.dataset, [s.field])) throw new Error('Dataset “' + s.dataset + '” does not contain “' + s.field + '”.');
          MS.history.state('Recipe filter', function (st) {
            var f = st.filters.find(function (f) { return f.dataset === s.dataset && f.field === s.field; });
            if (f) f.label = s.label || s.field;
            else st.filters.push({ dataset: s.dataset, field: s.field, label: s.label || s.field });
          });
          return;
        case 'replaceText': replaceText(s); return;
        case 'css':
          MS.history.state('Recipe CSS', function (st) { st.theme = st.theme || MS.brand.normalize({ name: 'Custom' }); st.theme.css = (st.theme.css || '') + '\n' + s.css; });
      }
    }
    MS.history.group('Apply recipe ' + label, function () {
      steps.forEach(function (s, i) {
        try { apply(s); applied++; } catch (e) { issues.push('Step ' + (i + 1) + ' · ' + e.message); }
      });
    });
    MS.afterDomChange();
    MS.toast('Recipe “' + label + '” · ' + applied + ' of ' + steps.length + ' steps completed.' +
      (issues.length ? ' ' + issues.slice(0, 2).join(' ') + (issues.length > 2 ? ' More details in the workshop.' : '') : ''), issues.length ? 'warn' : 'ok', 8000);
    return { name: label, applied: applied, issues: issues, rejected: false };
  };
})(window.MS);
