/* Storyline: step through chosen charts and sections like slides, each with a headline (the
   "so what"). The steps are kept in the state; the runtime plays them, in the editor and in the
   exported file (a "Play the story" button). */
(function (MS) {
  'use strict';
  var h = MS.h;
  var St = MS.story = {};
  function rt() { return MS.rt(); }
  St.get = function () { var r = rt(); return (r && r.state.story) || { title: '', steps: [] }; };
  St.steps = function () { return St.get().steps || []; };
  // What a step points at: the part's id (its whole card for a chart), else the chart key.
  St.refOf = function (el) {
    var r = rt(), u = MS.clipboard ? MS.clipboard.unitOf(el) : el, c = r && r.chartOf(u);
    var id = u.getAttribute('data-ms-id') || (u.id ? u.id : null);
    var ref = id ? { id: id } : {};
    if (c) ref.chart = c.key;
    return ref;
  };
  function titleOf(el) {
    var r = rt(), c = r && r.chartOf(el);
    var t = c ? ((r.chartInfo(c.key) || {}).title || (MS.blocks.guessTitle && MS.blocks.guessTitle(el))) : '';
    if (!t) { var hd = el.querySelector && el.querySelector('h1,h2,h3,h4'); t = hd ? hd.textContent.trim() : (el.textContent || '').trim().slice(0, 60); }
    return t || 'This part';
  }
  function edit(label, fn) { MS.history.state(label, function (s) { s.story = s.story || { title: '', steps: [] }; s.story.steps = s.story.steps || []; fn(s.story); }); MS.emit('story'); }
  St.add = function (el, headline, text, at) {
    if (!rt()) throw new Error('Open a dashboard first');
    el = el || MS.sel; if (!el) throw new Error('Select a chart or a section first');
    var step = { ref: St.refOf(el), headline: headline || titleOf(el), text: text || '' };
    edit('Add story step', function (S) { if (at == null || at >= S.steps.length) S.steps.push(step); else S.steps.splice(Math.max(0, at), 0, step); });
    return step;
  };
  St.update = function (i, patch) { edit('Edit story step', function (S) { if (S.steps[i]) Object.keys(patch).forEach(function (k) { S.steps[i][k] = patch[k]; }); }); };
  St.remove = function (i) { edit('Delete story step', function (S) { S.steps.splice(i, 1); }); };
  St.move = function (i, to) { edit('Move story step', function (S) { if (!S.steps[i]) return; var x = S.steps.splice(i, 1)[0]; S.steps.splice(Math.max(0, Math.min(S.steps.length, to)), 0, x); }); };
  St.setTitle = function (t) { edit('Story title', function (S) { S.title = String(t || ''); }); };
  St.clear = function () { MS.history.state('Delete the story', function (s) { delete s.story; }); MS.emit('story'); };
  // A first draft: one step per chart, in page order, headed by its title and its summary.
  St.draft = function () {
    var r = rt(); if (!r) return 0;
    var cs = r.charts().filter(function (c) { return c.el.isConnected; }), n = 0;
    edit('Draft a story', function (S) {
      S.title = S.title || (MS.doc && MS.doc.name.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ')) || 'Story';
      cs.forEach(function (c) {
        var u = MS.clipboard ? MS.clipboard.unitOf(c.el) : c.el, ref = St.refOf(u);
        if (S.steps.some(function (x) { return x.ref && (x.ref.id && x.ref.id === ref.id || x.ref.chart === c.key); })) return;
        var sum = ''; try { sum = r.summarize(c.key) || ''; } catch (e) {}
        S.steps.push({ ref: ref, headline: titleOf(u), text: sum }); n++;
      });
    });
    return n;
  };
  var keyFwd = null;
  St.play = function (i, full) {
    var r = rt(); if (!r) return MS.toast('Turn off Safe mode to play the story.', 'warn');
    if (!St.steps().length) return MS.toast('The story has no steps yet. Select a chart, then Present › Story › Add the selected part.', 'warn');
    if (full) { var stage = MS.$('#stage'); if (stage && stage.requestFullscreen) stage.requestFullscreen().catch(function () {}); }
    if (!keyFwd) {
      keyFwd = function (e) { if (r.story.i >= 0 && !(e.target.closest && e.target.closest('.dlg-wrap,input,textarea,select'))) r.story.key(e); };
      document.addEventListener('keydown', keyFwd, true);
      MS.child.win.addEventListener('ms:story', function off(e) {
        if (e.detail && e.detail.index >= 0) return;
        document.removeEventListener('keydown', keyFwd, true); keyFwd = null; MS.child.win.removeEventListener('ms:story', off);
        if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
      });
    }
    r.story.play(i || 0);
    return true;
  };
  St.stop = function () { var r = rt(); if (r) r.story.stop(); };

  St.dialog = function () {
    var r = rt(); if (!r) return MS.toast('Turn off Safe mode first.', 'warn');
    var body = h('div', { 'class': 'story-ed' }), list = h('div', { 'class': 'list story-list' });
    var title = h('input', { 'class': 'inp', value: St.get().title || '', placeholder: 'Story title, e.g. Q3 claims: what changed' });
    title.addEventListener('change', function () { St.setTitle(title.value); });
    function draw() {
      list.innerHTML = '';
      var steps = St.steps();
      if (!steps.length) list.appendChild(h('p', { 'class': 'muted', text: 'No steps yet. Select a chart or section on the dashboard and press "Add the selected part", or let Mothership draft one step per chart.' }));
      steps.forEach(function (s, i) {
        var hl = h('input', { 'class': 'inp', value: s.headline || '', placeholder: 'Headline: the one thing to take away' });
        var tx = h('textarea', { 'class': 'inp', rows: 2, value: s.text || '', placeholder: 'Optional: one or two lines of detail' });
        hl.addEventListener('change', function () { St.update(i, { headline: hl.value }); });
        tx.addEventListener('change', function () { St.update(i, { text: tx.value }); });
        var found = !!r.findRef(s.ref);
        list.appendChild(h('div', { 'class': 'story-step' + (found ? '' : ' lost') }, [
          h('span', { 'class': 'cmt-n', text: String(i + 1) }),
          h('div', { 'class': 'grow' }, [hl, tx, found ? null : h('div', { 'class': 'small warn-text', text: 'The part this step points at is gone. Delete the step or select a part and use "Point here".' })]),
          h('div', { 'class': 'col gap-xs' }, [
            h('button', { 'class': 'icon-btn', title: 'Play from here', onclick: function () { closeTop(); St.play(i); } }, ['▶']),
            h('button', { 'class': 'icon-btn', title: 'Point this step at the selected part', disabled: !MS.sel, onclick: function () { if (MS.sel) { St.update(i, { ref: St.refOf(MS.sel) }); draw(); } } }, ['⌖']),
            h('button', { 'class': 'icon-btn', title: 'Move up', disabled: !i, onclick: function () { St.move(i, i - 1); draw(); } }, ['↑']),
            h('button', { 'class': 'icon-btn', title: 'Move down', disabled: i === steps.length - 1, onclick: function () { St.move(i, i + 1); draw(); } }, ['↓']),
            h('button', { 'class': 'icon-btn', title: 'Delete step', onclick: function () { St.remove(i); draw(); } }, ['🗑'])])]));
      });
    }
    draw();
    body.appendChild(h('label', { 'class': 'field' }, [h('span', { text: 'Title' }), title]));
    body.appendChild(list);
    body.appendChild(h('div', { 'class': 'row gap' }, [
      h('button', { 'class': 'btn sm', disabled: !MS.sel, title: MS.sel ? '' : 'Select a chart or section on the dashboard first', onclick: function () { if (!MS.sel) return; St.add(MS.sel); draw(); } }, ['＋ Add the selected part']),
      h('button', { 'class': 'btn sm', onclick: function () { var n = St.draft(); MS.toast(n ? n + ' step(s) added, one per chart. Rewrite each headline as the takeaway.' : 'Every chart already has a step.', n ? 'ok' : ''); draw(); } }, ['✨ Draft one step per chart'])]));
    MS.dialog({ title: '🎬 Storyline', sub: 'Step through the dashboard like slides: each step lights up one part and shows its headline. The exported file gets a "Play the story" button.', wide: true, enterSubmits: false, body: body,
      buttons: [{ label: 'Delete story', danger: true, value: 'clear' }, { label: 'Close', value: null }, { label: '▶ Play', primary: true, value: 'play' }] }).then(function (v) {
      if (v === 'clear') return MS.confirm('Delete the story?', 'All ' + St.steps().length + ' steps go (Ctrl+Z brings them back).', 'Delete', true).then(function (ok) { if (ok) St.clear(); });
      if (title.value !== (St.get().title || '')) St.setTitle(title.value);
      if (v === 'play') St.play(0, true);
    });
  };
  function closeTop() { var x = MS.$$('.dlg-wrap').pop(); if (x) x.querySelector('.dlg-x').click(); }
})(window.MS);
