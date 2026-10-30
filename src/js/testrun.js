/* Testing, live: the runner card that shows a test run as it happens (progress, the case and step
   being run, results so far, Stop), a pointer that moves to each part before it is used, pictures
   of what failed, the results ring, and the prompt built from failed tests for an AI. */
(function (MS) {
  'use strict';
  var h = MS.h, Q = MS.qa, L = Q.live = {};
  var PACE = { fast: 0, normal: 420, slow: 1000 };
  L.pace = MS.prefs.get('qaPace', 'normal');
  L.watching = false;
  L.evid = {};
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function secs(ms) { ms = ms || 0; return ms < 1000 ? ms + ' ms' : ms < 60000 ? (ms / 1000).toFixed(1) + ' s' : Math.floor(ms / 60000) + ' min ' + Math.round(ms % 60000 / 1000) + ' s'; }
  function clock(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  L.secs = secs;

  /* ---------------------------------------------------------------- the pointer and the highlight */
  function toEditor(x, y) {
    var f = MS.child && MS.child.frame; if (!f) return null;
    var r = f.getBoundingClientRect(), s = MS.view.scale || 1;
    return { x: r.left + x * s, y: r.top + y * s, s: s };
  }
  function layer(id, cls) {
    var el = document.getElementById(id);
    if (!el) { el = h('div', { id: id, 'class': cls, 'aria-hidden': 'true' }); document.body.appendChild(el); }
    return el;
  }
  var fadeT;
  L.show = function (el, pt, verb) {
    var p = pt && toEditor(pt.x, pt.y); if (!p) return Promise.resolve();
    var cur = layer('qa-cursor', 'qa-cursor'), hl = layer('qa-hl', 'qa-hl');
    if (!cur.firstChild) cur.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2.5l15 9.2-6.6 1.4 3.7 7.3-2.7 1.3-3.6-7.4L4 19z" fill="#111827" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg><span class="qa-ripple"></span>';
    cur.classList.add('on'); cur.classList.remove('press');
    cur.style.transitionDuration = L.watching ? Math.max(80, (Q.deep && Q.deep.burst ? 90 : PACE[L.pace]) * 0.7) + 'ms' : '0ms';
    cur.style.transform = 'translate(' + Math.round(p.x - 3) + 'px,' + Math.round(p.y - 2) + 'px)';
    L.mark(el, verb);
    clearTimeout(fadeT);
    fadeT = setTimeout(function () { cur.classList.remove('on'); hl.classList.remove('on'); }, 1800);
    // a step that hovers every point moves quickly, or a chart would take minutes
    var pause = L.watching ? (Q.deep && Q.deep.burst ? Math.min(PACE[L.pace], 90) : PACE[L.pace]) : 0;
    return wait(pause).then(function () { cur.classList.add('press'); return wait(L.watching && pause ? 120 : 0); });
  };
  // Outline a part of the dashboard with a label, in the editor (nothing is added to the dashboard).
  L.mark = function (el, label, kind) {
    var hl = layer('qa-hl', 'qa-hl');
    if (!el || !el.getBoundingClientRect || !MS.child) return;
    var r = el.getBoundingClientRect(), a = toEditor(r.left, r.top); if (!a) return;
    hl.className = 'qa-hl on' + (kind ? ' ' + kind : '');
    hl.style.left = (a.x - 3) + 'px'; hl.style.top = (a.y - 3) + 'px';
    hl.style.width = (r.width * a.s + 6) + 'px'; hl.style.height = (r.height * a.s + 6) + 'px';
    hl.setAttribute('data-label', label || '');
    clearTimeout(fadeT);
    fadeT = setTimeout(function () { hl.classList.remove('on'); var c = document.getElementById('qa-cursor'); if (c) c.classList.remove('on'); }, 1800);
  };
  L.hide = function () { ['qa-cursor', 'qa-hl'].forEach(function (id) { var e = document.getElementById(id); if (e) e.classList.remove('on'); }); };
  // Checks outline what they look at too.
  MS.on('qa-step', function (e) {
    var s = e.step || {}; if (!/^expect_/.test(s.do) || !s.target || !MS.child) return;
    var el = null; try { el = Q.drv.find(s.target, { quiet: true }); } catch (x) {}
    if (el && Q.drv.visible(el)) L.mark(el, 'Check', 'check');
  });

  // A picture of the part a failed case was looking at, kept until the dashboard is closed.
  L.evidence = function (id, el) {
    if (!L.watching || !MS.picture || !el || !el.isConnected) return Promise.resolve();
    return Promise.race([MS.picture.make(el, { scale: 1 }), wait(4000).then(function () { return null; })]).then(function (p) { if (p && p.dataUrl) L.evid[id] = p.dataUrl; });
  };
  MS.on('doc-opened', function () { L.evid = {}; }); MS.on('doc-closed', function () { L.evid = {}; L.close(); });

  /* ---------------------------------------------------------------- the results ring */
  var COLORS = { Pass: 'var(--ok)', Fail: 'var(--danger)', 'Needs a person': 'var(--accent)', Blocked: 'var(--warn)', Skipped: 'var(--faint)', 'Not run': 'var(--line-strong)' };
  L.COLORS = COLORS;
  L.ring = function (by, size, center) {
    size = size || 84;
    var NS = 'http://www.w3.org/2000/svg', r = 15.9155, total = 0, off = 25;
    Object.keys(by).forEach(function (k) { total += by[k] || 0; });
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 42 42'); svg.setAttribute('width', size); svg.setAttribute('height', size); svg.setAttribute('class', 'qa-ring');
    var bg = document.createElementNS(NS, 'circle'); bg.setAttribute('cx', 21); bg.setAttribute('cy', 21); bg.setAttribute('r', r); bg.setAttribute('class', 'qa-ring-bg'); svg.appendChild(bg);
    Q.STATUSES.forEach(function (k) {
      var n = by[k] || 0; if (!n || !total) return;
      var pct = n / total * 100, c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', 21); c.setAttribute('cy', 21); c.setAttribute('r', r); c.setAttribute('fill', 'none');
      c.setAttribute('stroke-dasharray', Math.max(0, pct - (pct < 100 ? 0.8 : 0)) + ' ' + (100 - pct + (pct < 100 ? 0.8 : 0)));
      c.setAttribute('stroke-dashoffset', off); c.setAttribute('class', 'qa-ring-seg'); c.style.stroke = COLORS[k];
      var t = document.createElementNS(NS, 'title'); t.textContent = k + ': ' + n; c.appendChild(t);
      svg.appendChild(c); off -= pct;
    });
    var wrap = h('div', { 'class': 'qa-ring-wrap', style: 'width:' + size + 'px;height:' + size + 'px' }, [svg]);
    if (center) wrap.appendChild(h('div', { 'class': 'qa-ring-c' }, center));
    return wrap;
  };
  // Pass rate of the last runs, as small bars.
  L.trend = function () {
    var runs = Q.runs().slice(-12); if (runs.length < 1) return null;
    return h('div', { 'class': 'qa-trend', title: 'Last ' + runs.length + ' run' + (runs.length === 1 ? '' : 's') + ' (pass rate)' }, runs.map(function (r) {
      var done = (r.pass || 0) + (r.fail || 0) + (r.person || 0), pct = done ? Math.round((r.pass || 0) / done * 100) : 0;
      return h('span', { 'class': 'qa-tbar' + (r.fail ? ' bad' : ''), style: 'height:' + Math.max(8, pct) + '%', title: r.at.slice(0, 16).replace('T', ' ') + ': ' + (r.pass || 0) + ' passed, ' + (r.fail || 0) + ' failed, ' + (r.person || 0) + ' for a person · ' + secs(r.ms) });
    }));
  };

  /* ---------------------------------------------------------------- the runner card */
  var card = null, tick = null, st = null;
  function place() {
    if (!card) return;
    var s = MS.$('#stage'); if (!s) return;
    var r = s.getBoundingClientRect();
    card.style.right = Math.max(12, window.innerWidth - r.right + 18) + 'px';
    card.style.bottom = Math.max(12, window.innerHeight - r.bottom + 18) + 'px';
  }
  window.addEventListener('resize', MS.debounce(place, 50));
  L.close = function () {
    clearInterval(tick); tick = null; L.watching = false; L.hide();
    if (card) { var c = card; card = null; c.classList.add('bye'); setTimeout(function () { c.remove(); }, 220); }
  };
  function paceSeg() {
    return h('div', { 'class': 'seg small qr-pace', title: 'How fast the steps run, so you can follow them' }, ['fast', 'normal', 'slow'].map(function (k) {
      return h('button', { 'class': 'seg-btn' + (L.pace === k ? ' on' : ''), onclick: function (e) { L.pace = k; MS.prefs.set('qaPace', k); MS.$$('.seg-btn', e.currentTarget.parentNode).forEach(function (b) { b.classList.toggle('on', b === e.currentTarget); }); } }, [k.charAt(0).toUpperCase() + k.slice(1)]);
    }));
  }
  function build(ids) {
    if (card) card.remove();
    st = { ids: ids, res: {}, idx: -1, started: Date.now(), step: null, id: null };
    card = h('div', { id: 'qa-runner', 'class': 'qa-runner running', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(card); place(); draw();
    clearInterval(tick); tick = setInterval(function () { var t = card && card.querySelector('.qr-time'); if (t && st && card.classList.contains('running')) t.textContent = clock(Date.now() - st.started); }, 500);
  }
  function counts() {
    var c = { Pass: 0, Fail: 0, 'Needs a person': 0 };
    Object.keys(st.res).forEach(function (k) { var s = st.res[k].status; if (c[s] != null) c[s]++; });
    return c;
  }
  function dots() {
    return h('div', { 'class': 'qr-dots' }, st.ids.map(function (id, i) {
      var r = st.res[id], cls = r ? ({ Pass: 'ok', Fail: 'bad', 'Needs a person': 'info' }[r.status] || 'skip') : (i === st.idx && card.classList.contains('running') ? 'now' : '');
      var c = Q.get(id);
      return h('span', { 'class': 'qr-dot ' + cls, title: id + (c ? ': ' + c.title : '') + (r ? ' · ' + r.status + (r.ms ? ' · ' + secs(r.ms) : '') : '') });
    }));
  }
  function draw() {
    if (!card || !st) return;
    var running = card.classList.contains('running'), n = st.ids.length, done = Object.keys(st.res).length, c = counts(), pct = n ? Math.round(done / n * 100) : 0;
    card.innerHTML = '';
    if (running) {
      var cur = Q.get(st.id) || {};
      card.appendChild(h('div', { 'class': 'qr-head' }, [
        h('div', { 'class': 'qr-orb' }, [h('span', { 'class': 'qr-spin' }), h('b', { text: pct + '%' })]),
        h('div', { 'class': 'grow qr-what' }, [h('div', { 'class': 'qr-title' }, [card.classList.contains('stopping') ? 'Stopping after this step…' : 'Testing ' + (done + 1 > n ? n : done + 1) + ' of ' + n]),
          h('div', { 'class': 'qr-sub', text: st.id ? st.id + ' · ' + (cur.title || '') : 'Getting ready…' })]),
        h('span', { 'class': 'qr-time', text: clock(Date.now() - st.started) })]));
      card.appendChild(h('div', { 'class': 'qr-bar' }, [h('i', { style: 'width:' + Math.max(3, pct) + '%' })]));
      card.appendChild(h('div', { 'class': 'qr-step' }, st.step ? [h('span', { 'class': 'qr-stepn', text: (st.step.index + 1) + '/' + st.step.total }), h('span', { 'class': 'qr-steptxt no-icons', text: st.step.text })] : [h('span', { 'class': 'muted', text: 'Starting…' })]));
      card.appendChild(dots());
      card.appendChild(h('div', { 'class': 'qr-foot' }, [
        h('span', { 'class': 'qr-count ok', title: 'Passed' }, ['✓ ' + c.Pass]), h('span', { 'class': 'qr-count bad', title: 'Failed' }, ['✗ ' + c.Fail]), h('span', { 'class': 'qr-count info', title: 'Need a person' }, ['👁 ' + c['Needs a person']]),
        h('span', { 'class': 'grow' }), paceSeg(),
        h('button', { 'class': 'btn sm danger qr-stop', title: 'Stop after the current step', onclick: function () { card.classList.add('stopping'); Q.stop(); draw(); } }, ['■ Stop'])]));
      return;
    }
    // finished
    var S = Q.summary(), f = c.Fail, ran = done, person = c['Needs a person'], allOk = !f && ran;
    var title = st.stopped ? 'Stopped after ' + ran + ' of ' + n : !ran ? 'Nothing ran' : f ? f + ' of ' + ran + ' failed' : person ? ran - person + ' passed, ' + person + ' for a person' : 'All ' + ran + ' passed';
    card.classList.toggle('has-fail', !!f); card.classList.toggle('all-ok', !!allOk);
    card.appendChild(h('div', { 'class': 'qr-head' }, [
      L.ring(c, 58, [h('b', { text: ran ? Math.round(c.Pass / ran * 100) + '%' : '–' })]),
      h('div', { 'class': 'grow qr-what' }, [h('div', { 'class': 'qr-title', text: title }), h('div', { 'class': 'qr-sub', text: 'Done in ' + secs(st.ms) + ' · plan: ' + S.byStatus.Pass + ' pass, ' + S.byStatus.Fail + ' fail, ' + S.byStatus['Not run'] + ' not run' })]),
      h('button', { 'class': 'icon-btn', title: 'Close', 'aria-label': 'Close', onclick: L.close }, ['✕'])]));
    card.appendChild(dots());
    var acts = [h('button', { 'class': 'btn sm', onclick: function () { L.close(); Q.dialog({ status: f ? 'Fail' : '' }); } }, ['☑ See results'])];
    if (f || person) acts.push(h('button', { 'class': 'btn sm primary', onclick: function () { L.promptDialog(); } }, ['✨ Prompt from failures']));
    if (f) acts.push(h('button', { 'class': 'btn sm', title: 'Run only the cases that failed', onclick: function () { L.start(Q.failed().map(function (x) { return x.id; })); } }, ['↻ Rerun failed']));
    card.appendChild(h('div', { 'class': 'qr-foot end' }, acts));
    if (allOk && !person && !st.stopped) card.appendChild(h('div', { 'class': 'qr-confetti', 'aria-hidden': 'true' }, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) { return h('i', { style: '--i:' + i }); })));
  }
  MS.on('qa-run', function (e) {
    if (!card || !st) return;
    if (e.phase === 'case') { st.idx = e.index; st.id = e.id; st.step = null; draw(); }
    else if (e.phase === 'result') { if (e.result.status !== 'Stopped') st.res[e.result.id] = e.result; draw(); }
    else if (e.phase === 'end') { st.ms = e.run.ms; st.stopped = e.run.stopped; card.classList.remove('running', 'stopping'); L.watching = false; clearInterval(tick); setTimeout(L.hide, 900); draw(); }
  });
  MS.on('qa-step', function (e) {
    if (!card || !st || !card.classList.contains('running')) return;
    st.step = e; var t = card.querySelector('.qr-step');
    if (t) { t.innerHTML = ''; t.appendChild(h('span', { 'class': 'qr-stepn', text: (e.index + 1) + '/' + e.total })); t.appendChild(h('span', { 'class': 'qr-steptxt no-icons', text: e.text })); }
  });

  // Run cases where you can watch them: closes the Testing window and shows the runner card.
  L.start = function (ids) {
    if (!MS.child || !MS.rt()) return MS.toast('Open a dashboard first.', 'warn');
    if (Q.running) return MS.toast('Tests are already running.', 'warn');
    var list = (ids && ids.length ? ids : Q.cases().map(function (c) { return c.id; })).filter(function (id) { return Q.get(id); });
    if (!list.length) return MS.toast('There are no test cases to run. Testing › Test cases › Draft makes a set for you.', 'warn', 6000);
    var open = MS.$('.qa'); if (open) { var x = open.closest('.dlg') && open.closest('.dlg').querySelector('.dlg-x'); if (x) x.click(); }
    L.watching = true; build(list);
    return Q.run(list).then(function (res) { return res; }, function (er) { MS.toast(er.message, 'error'); L.close(); });
  };

  /* ---------------------------------------------------------------- prompt from failures */
  L.promptDialog = function () {
    if (!MS.child) return MS.toast('Open a dashboard first.', 'warn');
    var fails = Q.failed().length, people = Q.cases().filter(function (c) { return c.status === 'Needs a person'; }).length;
    if (!fails && !people) return MS.toast(Q.cases().length ? 'Nothing failed. Run the tests first if you have not yet.' : 'No test cases yet. Testing › Test cases › Draft makes a set for you.', 'ok', 6000);
    var src = ''; try { src = MS.exportHtml({ dropComments: true }); } catch (e) {}
    var f = MS.form([
      { key: 'mcp', label: 'The AI assistant', type: 'select', value: MS.prefs.get('qaPromptMcp', 'mcp'), options: [{ value: 'mcp', label: 'is connected to Mothership (MCP): it re-runs and checks the tests itself' }, { value: 'chat', label: 'is an ordinary chat: it reads the file and tells me what to change' }] },
      { key: 'goal', label: 'Ask it to', type: 'select', value: MS.prefs.get('qaPromptGoal', 'fix'), options: [{ value: 'fix', label: 'Find the cause and fix it (dashboard or test), then test again' }, { value: 'retest', label: 'Find the cause only; do not change anything' }] },
      { key: 'person', label: 'Include the ' + people + ' case' + (people === 1 ? '' : 's') + ' that need a person to check by eye', type: 'checkbox', value: true },
      { key: 'embed', label: 'Paste the dashboard file into the prompt (' + MS.bytes(src.length) + '; for an ordinary chat only)', type: 'checkbox', value: false }
    ]);
    var out = h('textarea', { 'class': 'inp mono prompt-out', rows: 15, readonly: true }), meta = h('small', { 'class': 'hint' });
    var head = h('div', { 'class': 'qa-fp-head' }, [L.ring(Q.summary().byStatus, 46), h('div', {}, [h('b', { text: fails + ' failed' + (people ? ', ' + people + ' need a person' : '') }), h('div', { 'class': 'muted small', text: 'The prompt lists each one with its steps, the step that failed and what happened, plus what the AI should do and how to report back.' })])]);
    var build = function () {
      var v = f.values(); MS.prefs.set('qaPromptMcp', v.mcp); MS.prefs.set('qaPromptGoal', v.goal);
      f.inputs.embed.closest('label').style.display = v.mcp === 'mcp' ? 'none' : '';
      var txt = Q.failPrompt({ mcp: v.mcp === 'mcp', goal: v.goal, person: v.person });
      if (v.mcp !== 'mcp' && v.embed && src) txt += '\n## The dashboard file (' + MS.exportName() + ')\n\n```html\n' + src + '\n```\n';
      out.value = txt;
      meta.textContent = txt.length.toLocaleString('en-US') + ' characters (about ' + Math.round(txt.length / 4).toLocaleString('en-US') + ' tokens).' + (v.mcp === 'mcp' ? ' Paste it into an assistant that has the Mothership MCP server (Help › Connect an AI assistant).' : v.embed ? '' : ' Attach ' + MS.exportName() + ' when you paste it.');
    };
    Object.keys(f.inputs).forEach(function (k) { f.inputs[k].addEventListener('change', build); });
    build();
    var base = (MS.doc ? MS.doc.name.replace(/\.html?$/i, '') : 'dashboard') + ' - fix the failures prompt.md';
    var body = h('div', { 'class': 'prompt-dlg' }, [head, f, h('div', { 'class': 'row gap' }, [
      h('button', { 'class': 'btn primary', type: 'button', onclick: function () { MS.copyText(out.value).then(function () { MS.toast('Prompt copied. Paste it into your AI assistant.', 'ok', 5000); }); } }, ['📋 Copy prompt']),
      h('button', { 'class': 'btn', type: 'button', onclick: function () { MS.download(base, out.value, 'text/markdown;charset=utf-8'); } }, ['⬇ Save as .md'])]), out, meta]);
    return MS.dialog({ title: '✨ Prompt from failed tests', sub: 'Give this to an AI assistant to find out why tests failed and fix them.', wide: true, enterSubmits: false, body: body, buttons: [{ label: 'Close', primary: true, value: null }] });
  };
})(window.MS);
