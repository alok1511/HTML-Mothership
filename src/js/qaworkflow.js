/* Stable test targets, reusable plans and changed-section checks. */
(function (MS) {
  'use strict';
  var Q = MS.qa, D = Q.drv, W = Q.workflow = {}, h = MS.h;
  var key = function (x) { return String(x || '').trim().replace(/\s+/g, ' ').toLowerCase(); };
  var doc = function () { return MS.child.doc; };
  var rt = function () { return MS.rt(); };
  var sha = function (x) { return MS.publish.sha256(JSON.stringify(x)); };
  var identityAttributes = ['id', 'data-ms-tabbtn', 'data-ms-id', 'data-ms-ref'];

  Q.block = function (message) { return Object.assign(new Error(message), { blocked: true }); };
  function identityGuard(el) {
    var label = el.tagName === 'BUTTON' || el.getAttribute('role') === 'tab' ? key(el.textContent) : '';
    return [el.tagName, el.getAttribute('type'), el.getAttribute('name'), el.getAttribute('aria-controls'), label];
  }
  function identityData(el, label) {
    if (el.hasAttribute('data-ms-filter-dataset')) return ['filter', el.getAttribute('data-ms-filter-dataset'), el.getAttribute('data-field'), label];
    for (var attr of identityAttributes) {
      var value = el.getAttribute(attr);
      if (value && doc().querySelectorAll('[' + attr + '="' + CSS.escape(value) + '"]').length === 1) return attr === 'data-ms-id' || attr === 'data-ms-ref' ? [attr, value, identityGuard(el), label] : [attr, value, label];
    }
    // Existing authored nodes have persistent ids. A script-generated node may
    // not survive export, so resolving the generated ref later can be blocked.
    var ref = MS.uid('qa');
    el.setAttribute('data-ms-ref', ref);
    return ['data-ms-ref', ref, identityGuard(el), label];
  }
  Q.identity = function (el, label) { return 'qa=' + encodeURIComponent(JSON.stringify(identityData(el, label || el.tagName.toLowerCase()))); };
  function decode(value) {
    try { var a = JSON.parse(decodeURIComponent(value)); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  Q.targetLabel = function (target) {
    if (!/^qa=/i.test(String(target))) return target;
    var a = decode(String(target).slice(3));
    return a.length ? a[a.length - 1] : 'invalid test target';
  };
  Q.resolveIdentity = function (value, opts) {
    var a = decode(value), attr = a[0], val = a[1], matches = [];
    if (attr === 'filter' && typeof val === 'string' && typeof a[2] === 'string') {
      matches = MS.$$('#ms-filter-pane select[data-ms-filter-dataset="' + CSS.escape(val) + '"][data-field="' + CSS.escape(a[2]) + '"]', doc());
    } else if (identityAttributes.includes(attr) && typeof val === 'string' && val) {
      matches = MS.$$('[' + attr + '="' + CSS.escape(val) + '"]', doc());
    }
    if (matches.length > 1 && !opts.quiet) throw Q.block('“' + Q.targetLabel('qa=' + value) + '” has more than one copy of its identifier. Draft again or choose an individual item.');
    if (matches.length !== 1) return null;
    if ((attr === 'data-ms-id' || attr === 'data-ms-ref') && a.length === 4 &&
        JSON.stringify(a[2]) !== JSON.stringify(identityGuard(matches[0]))) return null;
    return matches[0];
  };
  Q.showTarget = async function (el) {
    if (!MS.child || !el || !el.isConnected || el.ownerDocument !== doc()) return MS.toast('That item is no longer on the dashboard.', 'warn');
    var t = Q.tabFor(el);
    if (t && !t.active) await D.showTab(Q.identity(t.el, t.title));
    if (el.isConnected) MS.edit.reveal(el, true);
  };
  Q.namedTargets = function (items, label, element, kind, tabs, exact) {
    var names = new Map(), counts = new Map(), seen = new Map();
    items.forEach(function (x) { var n = label(x); names.set(x, n); counts.set(key(n), (counts.get(key(n)) || 0) + 1); });
    return new Map(items.map(function (x) {
      var name = names.get(x), duplicate = counts.get(key(name)) > 1, el = element(x), token = key(name);
      seen.set(token, (seen.get(token) || 0) + 1);
      if (duplicate) {
        var t = Q.tabFor(el, tabs);
        name += ' (' + (t && t.el !== el ? t.title + ', ' : '') + 'item ' + seen.get(token) + ')';
      }
      return [x, { name: name, get target() {
        return duplicate || exact ? Q.identity(el, name) : kind ? kind + '=' + name : name;
      } }];
    }));
  };
  Q.openSteps = function (el, tabs, tabTargets) {
    var t = Q.tabFor(el, tabs), found = t && tabTargets.get(t);
    return found ? [{ do: 'open_tab', target: found.target }] : [];
  };

  /* Changed sections. Hash authored DOM separately from chart values and datasets.
     Shared page code and unknown data consumers invalidate the whole dashboard. */
  function model() {
    var tabs = Q.tabs();
    var sections = tabs.length ? tabs.map(function (t) {
      var root = t.panel || t.el;
      return { id: root.getAttribute('data-ms-tab') || root.id || root.getAttribute('data-ms-id') || Q.identity(root, t.title), title: t.title, root: root, tab: t };
    }) : [{ id: '$page', title: 'Dashboard', root: doc().body }];
    return { tabs: tabs, sections: sections };
  }
  function sectionFor(el, m) {
    var t = Q.tabFor(el, m.tabs);
    return m.sections.find(function (s) { return s.tab ? s.tab === t : s.root.contains(el); });
  }
  var excluded = '#ms-ribbon,#ms-filter-pane,#ms-cmt-layer,.ms-floatbar,.ms-grip,.ms-drag,.ms-size-handle,.ms-hovertip,.ms-annot-layer,.ms-modal-wrap,[data-ms-editor],script,style,canvas,svg';
  function* contents(root, omit) {
    var tokens = [], stack = [root];
    while (stack.length) {
      var n = stack.pop();
      yield;
      if (!n) { tokens.push(null); continue; }
      if (n.nodeType === 3) {
        var text = n.textContent.replace(/\s+/g, ' ').trim();
        if (text) tokens.push(text);
        continue;
      }
      if (n.nodeType !== 1 || (n !== root && (omit.has(n) || n.matches(excluded) ||
          !n.hasAttribute('data-ms-id') && !n.hasAttribute('data-ms-own')))) continue;
      var attrs = Array.from(n.attributes).filter(function (a) {
        return !a.name.startsWith('data-ms-') && !/^(style|class|hidden|aria-selected|aria-expanded|aria-hidden|tabindex|contenteditable|spellcheck)$/.test(a.name);
      }).map(function (a) { return [a.name, a.value]; }).sort();
      var classes = Array.from(n.classList).filter(function (c) { return !/^(ms-|active$|is-active$|selected$|current$|show$|open$|on$)/.test(c); }).sort();
      var style = Array.from(n.style).filter(function (p) { return n !== root || p !== 'display'; }).sort().map(function (p) { return [p, n.style.getPropertyValue(p), n.style.getPropertyPriority(p)]; });
      tokens.push([n.tagName, attrs, classes, style]);
      stack.push(null);
      for (var i = n.childNodes.length - 1; i >= 0; i--) stack.push(n.childNodes[i]);
    }
    return tokens;
  }
  function* snapshotSteps() {
    var m = model(), r = rt(), state = r.state, jobs = [], out = { v: 1, sections: Object.create(null), datasets: Object.create(null) };
    var charts = r.charts(), bySection = new Map(), byDataset = new Map(), global = [];
    function add(map, k, val) { if (!map.has(k)) map.set(k, []); map.get(k).push(val); }
    for (var c of charts) {
      yield;
      var cs = state.charts[c.key] || {}, d = r.chartData(c.key, false, c);
      var scope = sectionFor(c.el, m), record = [c.key, MS.charts.nameOf(c.key, c, charts), cs, d];
      if (scope) add(bySection, scope.id, record); else global.push(record);
      if (scope && cs.binding && cs.binding.dataset) add(byDataset, cs.binding.dataset, scope.id);
    }
    for (var k of Q.kpis()) {
      yield;
      var bound = k.bound && state.kpis[k.bound], area = sectionFor(k.el, m);
      if (area && bound && bound.dataset) add(byDataset, bound.dataset, area.id);
    }
    var noOmissions = new Set(), root = doc().body;
    var omit = new Set(m.tabs.flatMap(function (t) { return [t.panel, t.el]; }));
    var shared = m.tabs.length ? yield* contents(root, omit) : [];
    var code = MS.$$('script,style,link[rel="stylesheet"]', doc()).filter(function (e) {
      return !/^ms-(state|runtime|base-css|theme-css|tip-css|consult-css)$/.test(e.id) && !e.hasAttribute('data-ms-editor');
    }).map(function (e) { return [e.getAttribute('src') || e.getAttribute('href'), e.textContent]; });
    jobs.push(sha([shared, code, global, state.theme, state.layout, state.filters, state.locale]).then(function (sum) { out.shared = sum; }));
    for (let s of m.sections) {
      var tokens = yield* contents(s.root, noOmissions);
      jobs.push(sha([s.title, tokens, bySection.get(s.id) || []]).then(function (sum) { out.sections[s.id] = { title: s.title, hash: sum }; }));
    }
    for (let name of Object.keys(state.datasets || {})) {
      yield;
      let data = state.datasets[name];
      let scopes = (state.filters || []).some(function (f) { return f.dataset === name; }) ? [] : Array.from(new Set(byDataset.get(name) || []));
      var rows = data.rows || [], chunks = [];
      for (var i = 0; i < rows.length; i += 500) {
        yield;
        chunks.push(sha(rows.slice(i, i + 500)));
      }
      jobs.push(Promise.all(chunks).then(function (parts) { return sha([parts, data.period]); })
        .then(function (sum) { out.datasets[name] = { hash: sum, sections: scopes }; }));
    }
    return Promise.all(jobs).then(function () { return out; });
  }
  W.snapshot = async function () {
    var child = MS.child, revision = Q.revision();
    function check() {
      if (!child || MS.child !== child || Q.revision() !== revision) throw new Error('The dashboard changed while comparing sections. Try again.');
    }
    var out = await Q.batches(snapshotSteps(), check);
    check();
    return out;
  };
  W.changes = async function () {
    var previous = Q.plan().changeBaseline, current = await W.snapshot();
    var changed = new Set(), datasets = [], removed = [];
    var first = !previous || previous.v !== current.v;
    var shared = !first && previous.shared !== current.shared;
    Object.keys(current.sections).forEach(function (id) {
      if (first || !Object.hasOwn(previous.sections, id) || current.sections[id].hash !== previous.sections[id].hash) changed.add(id);
    });
    if (!first) {
      Object.keys(previous.sections).forEach(function (id) { if (!Object.hasOwn(current.sections, id)) removed.push(previous.sections[id].title); });
      new Set(Object.keys(previous.datasets).concat(Object.keys(current.datasets))).forEach(function (name) {
        var was = Object.hasOwn(previous.datasets, name) && previous.datasets[name], now = current.datasets[name];
        if (was && now && was.hash === now.hash) return;
        datasets.push(name);
        var affected = (was ? was.sections : []).concat(now ? now.sections : []);
        if (!affected.length || was && !was.sections.length || now && !now.sections.length) shared = true;
        affected.forEach(function (id) { if (current.sections[id]) changed.add(id); });
      });
    }
    if (shared || removed.length) Object.keys(current.sections).forEach(function (id) { changed.add(id); });
    return { first: first, changed: changed, datasets: datasets, removed: removed, shared: shared, current: current };
  };
  W.scope = function (ids) {
    var m = model(), cache = new Map();
    return function (c) {
      var areas = new Set();
      c.steps.forEach(function (s) {
        if (!s.target && s.do !== 'open_tab') return;
        var target = s.target || s.value;
        if (!target) return;
        if (s.do === 'open_tab' && !/^(tab|qa)=/i.test(target)) target = 'tab=' + target;
        if (!cache.has(target)) {
          var el;
          try { el = D.find(target, { strict: true, track: false }); } catch (e) {}
          cache.set(target, el && sectionFor(el, m));
        }
        if (cache.get(target)) areas.add(cache.get(target).id);
      });
      // Shared smoke guards are cheap. Wider multi-tab cases retain their original scope.
      return !ids.size ? false : !areas.size ? c.steps.some(function (s) { return s.do === 'expect_no_errors' || s.do === 'expect_numbers'; }) :
        Array.from(areas).every(function (id) { return ids.has(id); });
    };
  };
  W.scopedCases = function (ids) {
    var child = MS.child, revision = Q.revision(), accepts = W.scope(ids);
    function* select() {
      var out = [];
      for (var c of Q.cases()) { yield; if (accepts(c)) out.push(c); }
      return out;
    }
    return Q.batches(select(), function () {
      if (MS.child !== child || Q.revision() !== revision) throw new Error('The dashboard changed. Compare sections again.');
    });
  };
  W.changeDialog = async function () {
    try {
      if (Q.running) throw new Error('Wait for the current run before comparing sections.');
      var d = await W.changes(), cases = await W.scopedCases(d.changed);
      var changed = Array.from(d.changed).map(function (id) { return d.current.sections[id].title; });
      var body = h('div', {}, [
        h('p', { text: d.first ? 'No comparison baseline yet. Save one now or complete Run all to establish it.' :
          changed.length ? changed.length + ' changed section(s) and ' + cases.length + ' eligible case(s).' : 'No sections changed since the comparison baseline.' }),
        changed.length ? h('ul', {}, changed.map(function (t) { return h('li', { text: t }); })) : null,
        d.datasets.length ? h('p', { text: 'Changed data · ' + d.datasets.join(', ') }) : null,
        d.removed.length ? h('p', { text: 'Removed sections · ' + d.removed.join(', ') }) : null,
        d.shared ? h('p', { text: 'Shared code, controls or data changed, so all sections are included.' }) : null,
        h('p', { 'class': 'muted', text: 'A scoped run includes shared smoke guards. Use Run all for checks that span changed and unchanged tabs. Save a new comparison baseline after reviewing your results.' })
      ]);
      var child = MS.child, rev = Q.revision();
      var action = await MS.dialog({ title: 'Changed sections', wide: true, enterSubmits: false, body: body, buttons: [
        { label: 'Close', value: null }, { label: 'Set comparison baseline', value: 'baseline' },
        { label: 'Draft changed', value: 'draft', disabled: !changed.length || d.first },
        { label: 'Run changed', value: 'run', primary: true, disabled: !cases.length || !changed.length || d.first }
      ] });
      if (!action) return;
      if (child !== MS.child || rev !== Q.revision() || Q.running) throw new Error('The dashboard changed or a run started. Reopen Changed sections.');
      if (action === 'baseline') {
        Q.editPlan('Set test comparison baseline', function (t) { t.changeBaseline = d.current; });
        MS.toast('Comparison baseline saved.', 'ok');
      }
      if (action === 'draft') return Q.draftInUI({ depth: 'full', sections: d.changed });
      if (action === 'run') return Q.live.start(cases.map(function (c) { return c.id; }), { scope: 'changed' });
    } catch (e) { MS.toast(e.message, 'warn'); }
  };

  var SMOKE_CASES = 12, SMOKE_MS = 20000;
  var smokeSteps = new Set(['open_tab', 'expect_visible', 'expect_hidden', 'expect_chart_drawn', 'expect_no_errors', 'expect_no_overflow', 'expect_text', 'expect_numbers', 'expect_baseline']);
  W.smokeCases = async function () {
    function eligible(c) {
      return c.priority === 'High' && c.auto && c.steps.length <= 12 && c.steps.every(function (s) { return smokeSteps.has(s.do); });
    }
    var cases = Q.cases().filter(eligible);
    if (!cases.length) { await Q.draftAsync(); cases = Q.cases().filter(eligible); }
    return cases.slice(0, SMOKE_CASES).map(function (c) { return c.id; });
  };
  W.runSmoke = async function (live) {
    var ids = await W.smokeCases();
    if (!ids.length) return [];
    return (live ? Q.live.start : Q.run)(ids, { scope: 'smoke', budgetMs: SMOKE_MS });
  };
  W.smokeInUI = function () { return W.runSmoke(true).catch(function (e) { MS.toast(e.message, 'warn'); }); };

  /* Reusable definitions. Files contain no case results or expected-numbers baseline. */
  function definition(c) {
    if (!c || typeof c !== 'object') throw new Error('Each case in the pack must be an object.');
    var out = {};
    ['title', 'scenario', 'type', 'priority', 'pre', 'expected', 'area'].forEach(function (k) {
      if (typeof c[k] === 'string') out[k] = c[k].slice(0, 20000);
    });
    if (!out.title || !Array.isArray(c.steps) || c.steps.length > 2000) throw new Error('Every case needs a title and a valid list of steps.');
    out.steps = c.steps.map(function (s) {
      if (!s || !(Q.ACTIONS[s.do] || Q.STEPS[s.do])) throw new Error('“' + out.title + '” contains an unknown test step.');
      var step = { do: s.do };
      ['target', 'value', 'point'].forEach(function (k) {
        if (typeof s[k] === 'string') step[k] = s[k].slice(0, 20000);
        if (typeof s[k] === 'number' && Number.isFinite(s[k])) step[k] = s[k];
      });
      return step;
    });
    return out;
  }
  W.pack = function () {
    if (!Q.cases().length) throw new Error('Draft or add a test case first.');
    return { $type: 'mothership/test-pack', v: 1, title: Q.plan().title || 'Dashboard test pack', cases: Q.cases().map(definition) };
  };
  W.loadPack = function (pack) {
    if (Q.running) throw new Error('Wait for the current test run before loading a pack.');
    if (!pack || pack.$type !== 'mothership/test-pack' || pack.v !== 1 || !Array.isArray(pack.cases) || pack.cases.length > 10000) throw new Error('Choose a Mothership test pack JSON file.');
    var defs = pack.cases.map(definition), title = typeof pack.title === 'string' ? pack.title.slice(0, 200) : 'Imported test pack';
    return { added: Q.addPack(defs, title), total: defs.length };
  };
  var fileName = function (suffix) { return MS.exportName().replace(/\.html?$/i, '') + ' - ' + suffix + '.json'; };
  function pickJSON(load) {
    return MS.pickFiles('.json').then(async function (files) {
      if (files[0]) return load(JSON.parse(await MS.readFile(files[0])));
    }).catch(function (e) { MS.toast(e.message, 'warn', 7000); });
  }
  W.packMenu = function () {
    return [
      { label: 'Save test pack', disabled: !Q.cases().length, run: function () { MS.download(fileName('test pack'), JSON.stringify(W.pack(), null, 2), 'application/json'); } },
      { label: 'Load test pack', run: function () {
        var child = MS.child;
        return pickJSON(function (p) {
          if (child !== MS.child) throw new Error('The dashboard changed. Choose the pack again.');
          var r = W.loadPack(p);
          MS.toast(r.added + ' case(s) added from the pack. Open Coverage to review any targets that need attention.', 'ok', 7000);
        });
      } }
    ];
  };

  /* A job is a local export of the current revision. The runner returns outcomes
     only. Verify the dashboard revision and test definitions before applying them. */
  function definitionsFor(ids) {
    var cases = new Map(Q.cases().map(function (c) { return [c.id, c]; }));
    return ids.map(function (id) {
      var c = cases.get(id);
      if (!c) throw new Error('Test case ' + id + ' is missing from the current plan.');
      return [id, definition(c)];
    });
  }
  function snapshotHash(snapshot) {
    return sha([snapshot.shared, Object.keys(snapshot.sections).sort().map(function (id) { return [id, snapshot.sections[id]]; }),
      Object.keys(snapshot.datasets).sort().map(function (id) { return [id, snapshot.datasets[id]]; })]);
  }
  W.makeJob = async function (scope) {
    var child = MS.child;
    var ids = scope === 'smoke' ? await W.smokeCases() : Q.cases().map(function (c) { return c.id; });
    if (!ids.length) throw new Error('Draft or add test cases first.');
    if (MS.child !== child || Q.running) throw new Error('The dashboard changed or a test run is in progress.');
    var revision = Q.revision(), definitions = definitionsFor(ids), baseline = await W.snapshot();
    if (MS.child !== child || Q.revision() !== revision) throw new Error('The dashboard changed. Export the job again.');
    var dashboard = MS.doc.name, html = MS.exportHtml({ dropComments: true });
    var hashes = await Promise.all([MS.publish.sha256(html), sha(definitions), snapshotHash(baseline)]);
    if (MS.child !== child || Q.revision() !== revision) throw new Error('The dashboard changed. Export the job again.');
    return { $type: 'mothership/isolated-job', v: 1, id: MS.uid('run'), dashboard: dashboard, revision: revision,
      definitionsHash: hashes[1], snapshotHash: hashes[2], scope: scope, ids: ids, payloadHash: hashes[0], html: html };
  };
  function validRunStep(s) {
    return s && typeof s.step === 'string' && s.step.length <= 20000 && [true, false, null].includes(s.ok) &&
      (s.note == null || typeof s.note === 'string' && s.note.length <= 40000) &&
      (s.index == null || Number.isInteger(s.index) && s.index >= 0);
  }
  W.loadRun = async function (data) {
    if (Q.running) throw new Error('Wait for the current run before importing results.');
    var allowed = new Set(['Pass', 'Fail', 'Blocked', 'Partial', 'Needs a person']);
    if (!data || data.$type !== 'mothership/isolated-results' || data.v !== 1 || typeof data.id !== 'string' ||
        !['all', 'smoke'].includes(data.scope) || !Array.isArray(data.ids) || !Array.isArray(data.results) ||
        data.ids.length > 10000 || typeof data.stopped !== 'boolean') throw new Error('Choose a Mothership isolated results JSON file.');
    var ids = new Set(data.ids), seen = new Set(), definitions = definitionsFor(data.ids), child = MS.child;
    if (Q.runs().some(function (r) { return r.jobId === data.id; })) throw new Error('These results have already been imported.');
    if (Q.revision() !== data.revision || await sha(definitions) !== data.definitionsHash) throw new Error('These results belong to a different dashboard revision or test plan.');
    data.results.forEach(function (r) {
      if (!r || !ids.has(r.id) || seen.has(r.id) || !allowed.has(r.status) || !Number.isFinite(r.ms) ||
          !Array.isArray(r.steps) || r.steps.length > 2000 || !r.steps.every(validRunStep)) throw new Error('An isolated result is missing or invalid.');
      seen.add(r.id);
    });
    var baseline = await W.snapshot();
    if (await snapshotHash(baseline) !== data.snapshotHash) throw new Error('The dashboard content or data changed since this isolated job was exported.');
    if (MS.child !== child || Q.revision() !== data.revision || await sha(definitionsFor(data.ids)) !== data.definitionsHash ||
        Q.runs().some(function (r) { return r.jobId === data.id; })) throw new Error('The dashboard or test plan changed. Import the results again.');
    var record = Q.runRecord(data.results, ids.size, Date.now() - (Number.isFinite(data.ms) ? Math.max(0, data.ms) : 0),
      { scope: data.scope, stopped: data.stopped || data.results.length !== ids.size, reason: data.stopped ? 'Isolated run stopped or reached its time limit' : '' });
    record.jobId = data.id;
    Q.externalRun({ scope: data.scope, baseline: baseline }, data.results, record);
    return { imported: data.results.length, stopped: record.stopped };
  };
  W.isolatedDialog = function () {
    var child = MS.child;
    return MS.dialog({ title: 'Run in a separate browser', enterSubmits: false, wide: true,
      body: h('div', {}, [
        h('p', { text: 'Export a local job, run it from the Mothership repository, then bring the results back here. The runner uses a separate browser process and stops at its time limit.' }),
        h('p', { text: 'One-time setup in the repository folder' }),
        h('pre', { text: 'npm ci\nnpx playwright install chromium\nnpm run build' }),
        h('p', { text: 'Run the downloaded job and then choose Import results' }),
        h('pre', { text: 'npm run test:isolated -- "/path/to/dashboard - isolated job.json"' }),
        h('p', { 'class': 'muted', text: 'The job contains a copy of the dashboard and its data. Keep it local. The runner is offline and defaults to a two-minute limit.' })
      ]),
      buttons: [{ label: 'Close', value: null }, { label: 'Import results', value: 'import' }, { label: 'Export smoke job', value: 'smoke' },
        { label: 'Export full job', value: 'all', primary: true, disabled: !Q.cases().length }]
    }).then(function (action) {
      if (!action || child !== MS.child) return;
      if (action === 'import') return pickJSON(async function (data) {
        if (child !== MS.child) throw new Error('The dashboard changed. Choose the results again.');
        var result = await W.loadRun(data);
        MS.toast(result.imported + ' result(s) imported.' + (result.stopped ? ' Some cases were left unrun.' : ''), result.stopped ? 'warn' : 'ok');
      });
      return W.makeJob(action).then(function (job) {
        MS.download(fileName('isolated job'), JSON.stringify(job), 'application/json');
      }, function (e) { MS.toast(e.message, 'warn'); });
    });
  };
  MS.api.add('test_pack', { d: 'Save or load reusable test definitions without old run evidence.',
    p: { action: ['string', 'save | load'], pack: ['object', 'Saved pack for load'] },
    f: function (a) { return a.action === 'load' ? W.loadPack(a.pack) : W.pack(); } });
  MS.api.add('test_changes', { d: 'Show changed sections and datasets, or save the current comparison baseline.',
    p: { action: ['string', 'get | baseline'] },
    f: async function (a) {
      if (a.action === 'baseline') {
        var snapshot = await W.snapshot();
        Q.editPlan('Set test comparison baseline', function (t) { t.changeBaseline = snapshot; });
        return { saved: true };
      }
      var change = await W.changes();
      return { needsBaseline: change.first, changed: Array.from(change.changed).map(function (id) { return change.current.sections[id].title; }),
        datasets: change.datasets, removed: change.removed, shared: change.shared };
    } });
})(window.MS);
