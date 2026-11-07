/* Recipe library, capture and conversion, and offline report gallery. */
(function (MS) {
  'use strict';
  var R = MS.recipeStudio = {}, h = MS.h;
  var catalog = window.MS_STUDIO || { reports: [], recipes: [] };
  var slug = function (name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-$/, '') || 'dashboard-recipe';
  };
  var copy = function (x) { return JSON.parse(JSON.stringify(x)); };
  var text = function (value) { return String(value || '').trim().replace(/\s+/g, ' '); };
  function subset(object, keys) {
    return Object.fromEntries(keys.filter(function (k) { return object && object[k] !== undefined; }).map(function (k) { return [k, copy(object[k])]; }));
  }
  function cleanTabText(el) {
    var node = el.cloneNode(true);
    MS.$$('script,style,iframe,object,svg,canvas,table,[data-ms-editor]', node).forEach(function (n) { n.remove(); });
    return node.textContent.trim().slice(0, 5000);
  }
  function chartCommentary(c) {
    var b = MS.blocks.of(c.el), out = {};
    if (!b) return out;
    ['title', 'sub', 'inf'].forEach(function (k) { var e = b.querySelector('.ms-' + k); if (e && text(e.textContent)) out[k] = e.textContent.trim().slice(0, 2000); });
    return out;
  }

  R.capture = function (opts) {
    opts = opts || {};
    var r = MS.rt();
    if (!r) throw new Error('Open a dashboard with scripts enabled to capture a recipe.');
    var steps = [], notes = [], native = r.layoutEnabled();
    if (opts.tabs !== false) {
      if (native) steps.push({ do: 'layout', preservePageTabs: true,
        ribbon: subset(r.state.layout.ribbon, ['position', 'height', 'width', 'style', 'align']),
        pane: subset(r.state.layout.pane, ['position', 'visible', 'width']) });
      var tabs = native ? r.tabs() : MS.pageTabs.list();
      tabs.forEach(function (t, i) {
        if (native && i === 0 && t.title === 'Dashboard') return;
        var s = { do: 'ensureTab', title: t.title, kind: t.kind === 'grid' ? 'grid' : 'content' };
        if (t.hidden) s.hidden = true;
        var content = t.el || t.panel;
        if (opts.helpText && content && /^(how.to|faq|methodology|help|user guide)\b/i.test(t.title)) {
          var body = cleanTabText(content);
          if (body) s.html = '<p>' + MS.esc(body).replace(/\r?\n/g, '<br>') + '</p>';
        }
        steps.push(s);
      });
    }
    if (opts.theme !== false) {
      var theme = r.state.theme;
      if (!theme) {
        var w = MS.child.win, doc = MS.child.doc, style = w.getComputedStyle(doc.body);
        var fill = style.backgroundColor;
        if (fill === 'transparent' || fill === 'rgba(0, 0, 0, 0)') fill = w.getComputedStyle(doc.documentElement).backgroundColor;
        var colors = { background: fill === 'transparent' || fill === 'rgba(0, 0, 0, 0)' ? '#ffffff' : r.colHex(fill), text: r.colHex(style.color) };
        var accent = r.colHex(style.getPropertyValue('--report-accent').trim());
        if (accent) colors.primary = accent;
        theme = { name: 'Captured page theme', colors: colors, palette: accent ? [accent] : [], fonts: { body: style.fontFamily } };
      }
      steps.push({ do: 'theme', theme: subset(theme,
        ['name', 'colors', 'palette', 'fonts', 'applyToPage', 'force', 'chartsFollowTheme', 'forceFonts']) });
    }
    if (opts.bindings) (r.state.filters || []).forEach(function (f) {
      steps.push({ do: 'filter', dataset: f.dataset, field: f.field, label: f.label || f.field });
    });
    if (opts.charts !== false) {
      var charts = r.charts();
      var entries = charts.map(function (c) { return { chart: c, match: {
        titleExact: MS.charts.nameOf(c.key, c, charts),
        library: c.lib,
        tab: MS.qa.tabOf(c.el) || undefined
      } }; });
      var counts = new Map();
      function selector(m) { return [m.titleExact, m.library, m.tab || ''].join('\n').toLowerCase(); }
      entries.forEach(function (e) { var id = selector(e.match); counts.set(id, (counts.get(id) || 0) + 1); });
      entries.forEach(function (e) {
        var c = e.chart, props = subset(r.state.charts[c.key], ['tooltip']);
        var style = subset((r.state.charts[c.key] || {}).style, ['font', 'size', 'color', 'legend', 'axisFormat', 'tipBg', 'tipColor', 'tipBorder', 'tipSize', 'tipRadius']);
        if (Object.keys(style).length) props.style = style;
        if (opts.bindings) Object.assign(props, subset(r.state.charts[c.key], ['binding', 'drill']));
        if (opts.commentary) {
          var commentary = chartCommentary(c);
          if (Object.keys(commentary).length) props.commentary = commentary;
        }
        if (!Object.keys(props).length) return;
        if (counts.get(selector(e.match)) > 1) { notes.push('Skipped ambiguous chart “' + e.match.titleExact + '”. Give it a distinct title before capture.'); return; }
        steps.push(Object.assign({ do: 'chart', match: e.match }, props));
      });
    }
    if (!steps.length) throw new Error('No reusable settings were found. Choose more capture options or start with a library recipe.');
    var name = text(opts.name) || (MS.doc.name.replace(/\.html?$/i, '') + ' setup');
    return { $type: 'mothership/recipe', name: name, description: 'Captured dashboard setup. Review the titles, settings and target matches before applying.',
      steps: steps, ...(notes.length ? { captureNotes: Array.from(new Set(notes)) } : {}) };
  };

  R.captureDialog = async function () {
    if (!MS.rt()) { MS.toast('Open a dashboard first to capture its setup.', 'warn'); return null; }
    var child = MS.child;
    var form = MS.form([
      { key: 'name', label: 'Recipe name', value: MS.doc.name.replace(/\.html?$/i, '') + ' setup' },
      { key: 'tabs', label: 'Tab titles and layout settings', type: 'checkbox', value: true },
      { key: 'theme', label: 'Brand colours, chart palette and font names', type: 'checkbox', value: true },
      { key: 'charts', label: 'Chart styles and tooltip formats', type: 'checkbox', value: true },
      { key: 'bindings', label: 'Dataset names, filter fields and chart bindings', type: 'checkbox', value: false },
      { key: 'commentary', label: 'Include authored chart commentary', type: 'checkbox', value: false },
      { key: 'helpText', label: 'Include plain text from help, FAQ and methodology tabs', type: 'checkbox', value: false }
    ]);
    return MS.dialog({ title: 'Capture dashboard setup', wide: true, body: h('div', {}, [
      h('p', { text: 'Capture reusable settings as an editable recipe. Dataset rows, test results, comments, embedded assets and dashboard scripts stay out. Review the recipe before sharing it.' }), form]),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Capture recipe', primary: true, value: function () {
        try {
          if (child !== MS.child) throw new Error('The dashboard changed. Start a new capture.');
          return R.capture(form.values());
        } catch (e) { MS.dialogError(e.message); return false; }
      } }] });
  };

  function recipeJson(recipe) { return JSON.stringify(MS.plugins.checkRecipe(recipe), null, 2) + '\n'; }
  R.pluginSource = function (recipe) {
    var json = recipeJson(recipe), hash = 0;
    for (var i = 0; i < json.length; i++) hash = (Math.imul(31, hash) + json.charCodeAt(i)) >>> 0;
    return '/* Mothership recipe button. The recipe runs only when the button is clicked. */\n' +
      'Mothership.registerPlugin({\n  id: ' + JSON.stringify(slug(recipe.name) + '-' + hash.toString(36)) + ',\n' +
      '  name: ' + JSON.stringify(recipe.name || 'Dashboard recipe') + ',\n' +
      '  buttons: [{ label: ' + JSON.stringify('Apply recipe') + ', icon: "📜", run: function (api) {\n' +
      '    var recipe = ' + json.trimEnd().replace(/\n/g, '\n    ') + ';\n' +
      '    return api.run("run_recipe", { recipe: recipe }).catch(function (error) { api.toast(error.message, "error"); });\n' +
      '  } }]\n});\n';
  };
  R.skill = async function (recipe) {
    var json = recipeJson(recipe), key = slug(recipe.name);
    var Zip = await MS.lib('jszip'), zip = new Zip();
    var lines = [
      '---', 'name: ' + key, 'description: Apply and verify this saved Mothership dashboard recipe when asked to reuse its report setup.', '---', '',
      '# Apply the Mothership recipe', '',
      'Read [the saved recipe](references/recipe.json) and confirm the open dashboard is the one the user wants changed.',
      'Check the recipe’s chart titles, tab names, and dataset fields against the target dashboard. Keep existing content where an ensureTab step finds a matching tab.',
      'With Mothership connected, use its run_recipe tool with the JSON object. Without a connection, provide references/recipe.json and direct the user to Plugins › Run recipe.',
      'Inspect the returned issues and identify any skipped or unmatched steps. Verify the resulting layout, chart commentary, and filter behaviour against the user’s request.',
      'Export the dashboard only when the user asks for a file. Treat existing dashboard data and any copied commentary as private unless the user authorises sharing.', ''
    ];
    zip.file(key + '/SKILL.md', lines.join('\n'));
    zip.file(key + '/references/recipe.json', json);
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  };

  function editStep(step) {
    var fields = [];
    if (step.do === 'addTab' || step.do === 'ensureTab') {
      fields.push({ key: 'title', label: 'Tab title', value: step.title });
      if (!step.html) fields.push({ key: 'markdown', label: 'Tab content (Markdown)', type: 'textarea', rows: 7, value: step.markdown || '' });
    }
    if (step.do === 'tooltip') fields.push({ key: 'template', label: 'Tooltip text', type: 'textarea', rows: 4, value: step.template });
    if (step.do === 'filter') fields.push({ key: 'dataset', label: 'Dataset name', value: step.dataset },
      { key: 'field', label: 'Field', value: step.field }, { key: 'label', label: 'Filter label', value: step.label || '' });
    if (!fields.length) return null;
    var form = MS.form(fields);
    return MS.dialog({ title: 'Edit recipe step', body: form, buttons: [
      { label: 'Cancel', value: null }, { label: 'Save step', primary: true, value: function () {
        var next = Object.assign({}, step, form.values());
        try { MS.plugins.checkRecipe({ steps: [next] }); return next; }
        catch (e) { MS.dialogError(e.message); return false; }
      } }
    ] });
  }
  function libraryRecipe(entry) {
    var out = copy(entry);
    delete out.file;
    return out;
  }
  R.open = function (initial) {
    var starter = catalog.recipes.find(function (r) { return r.file === 'executive-review.json'; }) || catalog.recipes[0];
    var selected = initial || (starter && libraryRecipe(starter));
    var body = h('div', { 'class': 'recipe-workshop' });
    var box = h('textarea', { 'class': 'inp recipe-json', rows: 18, spellcheck: 'false', 'aria-label': 'Recipe JSON' });
    var status = h('p', { 'class': 'recipe-status', role: 'status' });
    var details = h('details', { 'class': 'recipe-details' });
    var description = h('p', { 'class': 'muted' });
    var library = h('div', { 'class': 'recipe-library', role: 'group', 'aria-label': 'In-house recipes' });
    var chosen = null;
    function inspect() {
      var r = JSON.parse(box.value);
      return MS.plugins.checkRecipe(r);
    }
    function refresh() {
      details.replaceChildren();
      try {
        var r = inspect();
        description.textContent = r.description || 'Edit the recipe, review its steps, then apply or export it.';
        status.textContent = r.steps.length + ' valid step(s).';
        status.classList.remove('invalid');
        var list = h('ol', { 'class': 'recipe-steps' }, r.steps.map(function (s, i) {
          var target = s.title || s.toTab || s.name || s.field || (s.match && (s.match.titleExact || s.match.title));
          var line = h('li', {}, [h('span', { text: s.do + (target ? ' · ' + target : '') })]);
          if (['addTab', 'ensureTab', 'tooltip', 'filter'].includes(s.do)) line.appendChild(h('button', {
            'class': 'btn sm', 'aria-label': 'Edit step ' + (i + 1), onclick: async function () {
              var next = await editStep(s);
              if (next) { var current = inspect(); current.steps[i] = next; choose(current); details.open = true; }
            } }, ['Edit']));
          return line;
        }));
        details.append(h('summary', { text: 'Preview recipe steps' }), list);
        if (r.captureNotes) details.append(h('ul', {}, r.captureNotes.map(function (n) { return h('li', { text: String(n) }); })));
      } catch (e) {
        status.textContent = e.message;
        status.classList.add('invalid');
        details.append(h('summary', { text: 'Preview recipe steps' }));
      }
    }
    function choose(r, button) {
      box.value = JSON.stringify(r, null, 2) + '\n';
      if (chosen) chosen.setAttribute('aria-pressed', 'false');
      chosen = button || null;
      if (chosen) chosen.setAttribute('aria-pressed', 'true');
      refresh();
    }
    function action(label, run, opts) {
      opts = opts || {};
      var button = h('button', { 'class': 'btn sm' + (opts.primary ? ' primary' : ''), disabled: opts.disabled, onclick: async function () {
        button.disabled = true;
        try { await run(); } catch (e) { status.textContent = e.message; status.classList.add('invalid'); }
        finally { button.disabled = false; }
      } }, [label]);
      return button;
    }
    library.appendChild(h('h3', { text: 'In-house recipes' }));
    catalog.recipes.forEach(function (entry) {
      var b = h('button', { 'class': 'recipe-choice', 'aria-pressed': 'false', onclick: function () { choose(libraryRecipe(entry), b); } },
        [h('strong', { text: entry.name }), h('small', { text: entry.description })]);
      library.appendChild(b);
      if (!initial && selected && selected.name === entry.name) { chosen = b; b.setAttribute('aria-pressed', 'true'); }
    });
    var tools = h('div', { 'class': 'row gap wrap' }, [
      action('Load recipe JSON', async function () {
        var files = await MS.pickFiles('.json');
        if (!files[0]) return;
        choose(MS.plugins.checkRecipe(JSON.parse(await MS.readFile(files[0]))));
      }),
      action('Capture dashboard setup', async function () { var r = await R.captureDialog(); if (r) choose(r); }, { disabled: !MS.rt() })
    ]);
    var outputs = h('div', { 'class': 'row gap wrap recipe-actions' }, [
      action('Apply recipe', async function () {
        var r = inspect(), result = await MS.plugins.runRecipe(r);
        status.textContent = result.applied + ' of ' + r.steps.length + ' steps completed.' + (result.issues.length ? ' ' + result.issues.join(' ') : '');
        status.classList.toggle('invalid', !!result.issues.length);
      }, { primary: true, disabled: !MS.rt() }),
      action('Download recipe', function () { var r = inspect(); MS.download(slug(r.name) + '.json', recipeJson(r), 'application/json'); }),
      action('Export skill ZIP', async function () { var r = inspect(); MS.download(slug(r.name) + '-skill.zip', await R.skill(r)); }),
      action('Export plugin JS', function () { var r = inspect(); MS.download(slug(r.name) + '-plugin.js', R.pluginSource(r), 'text/javascript'); })
    ]);
    body.append(library, h('div', { 'class': 'recipe-editor' }, [
      h('h3', { text: 'Review and edit' }), tools, description, box, status, details, outputs,
      h('p', { 'class': 'muted', text: 'The skill contains the recipe and instructions for an assistant. The plugin adds an Apply recipe button after installation.' })
    ]));
    box.addEventListener('input', MS.debounce(refresh, 120));
    box.value = selected ? JSON.stringify(selected, null, 2) + '\n' : '';
    refresh();
    return MS.dialog({ title: 'Recipe workshop', sub: 'Start from a recipe or capture the setup of the open dashboard.', xwide: true, enterSubmits: false, body: body,
      buttons: [{ label: 'Close', value: null, primary: true }] });
  };

  R.gallery = function () {
    var body = h('div', { 'class': 'report-gallery' });
    catalog.reports.forEach(function (r, i) {
      var illustration = h('div', { 'class': 'gallery-figure', 'aria-hidden': 'true', style: { '--gallery-ink': r.color, '--gallery-wash': r.wash } },
        [h('i'), h('i'), h('i'), h('i'), h('i')]);
      body.appendChild(h('article', { 'class': 'gallery-row' }, [illustration,
        h('div', { 'class': 'grow' }, [h('span', { 'class': 'gallery-audience', text: r.audience + (r.map ? ' · Map included' : '') }),
          h('h3', { text: r.title }), h('p', { text: r.question }), h('small', { text: r.visual })]),
        h('button', { 'class': 'btn' + (i === 0 ? ' primary' : ''), 'aria-label': 'Open ' + r.title, onclick: function (e) {
          e.currentTarget.closest('.dlg').querySelector('.dlg-x').click();
          Promise.resolve(MS.samples.open(r.id)).then(function (opened) { if (opened) MS.setMode('interact'); })
            .catch(function (error) { MS.toast(error.message, 'error'); });
        } }, ['Open report'])]));
    });
    return MS.dialog({ title: 'Sample report layouts', sub: 'Five editable, offline reports with synthetic data, shared filters, and a guided analysis from results to decisions.',
      xwide: true, body: body, buttons: [{ label: 'Close', primary: true, value: null }] });
  };

  // The sample reports keep their local datasets and boundaries in exported HTML.
  MS.on('child-loaded', function (child) {
    [['ms:report-boundaries', 'MSReportMap', 'report-geometry', 'Change report map boundaries'],
      ['ms:report-data', 'MSReportData', 'report-dataset', 'Change report data']].forEach(function (spec) {
      child.win.addEventListener(spec[0], function (e) {
        var d = e.detail, report = child.win[spec[1]];
        if (MS.child !== child || !report || !d || typeof d.before !== 'string' || typeof d.after !== 'string') return;
        var payload = child.doc.getElementById(spec[2]);
        if (!payload || payload.textContent !== d.after) return;
        MS.history.push({ label: spec[3], undo: function () { report.restore(d.before); }, redo: function () { report.restore(d.after); } }, true);
      });
    });
  });
  MS.api.add('capture_recipe', { d: 'Capture reusable settings from the current dashboard as a recipe. Omits dataset rows, source code, comments, results and assets.',
    p: { name: ['string', 'Recipe name'], commentary: ['boolean', 'Include authored chart commentary'], helpText: ['boolean', 'Include plain text from reader help tabs'],
      bindings: ['boolean', 'Include dataset names and field bindings without rows'] }, f: R.capture });
})(window.MS);
