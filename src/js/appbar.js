/* The top bar: the open dashboard's name and Close button, and the Edit / Comment / Interact switch
   with its sliding marker, the coloured frame round the stage and the banner that says what the mode does. */
(function (MS) {
  'use strict';
  var h = MS.h, AB = MS.appbar = {};

  AB.MODES = {
    edit: { label: 'Edit', key: 'Alt+1', icon: '✎', hint: 'Click to select. Double-click to type. Drag to move.' },
    comment: { label: 'Comment', key: 'Alt+2', icon: '💬', hint: 'Click anything, or drag a box, to leave a review note. Tabs still switch.' },
    interact: { label: 'Interact', key: 'Alt+3', icon: '☝', hint: 'Use the dashboard as a viewer would: filters, tooltips, drill-down. Nothing is changed.' }
  };
  AB.ORDER = ['edit', 'comment', 'interact'];

  /* sliding marker under the active mode button */
  AB.glide = function () {
    var sw = MS.$('#mode-switch'); if (!sw) return;
    var on = sw.querySelector('.seg-btn.on'), g = sw.querySelector('.glider');
    sw.setAttribute('data-mode', MS.mode);
    if (!on || !g || !on.offsetWidth) return;
    g.style.width = on.offsetWidth + 'px';
    g.style.transform = 'translateX(' + (on.offsetLeft - 3) + 'px)';
  };

  /* coloured frame and banner over the stage for Comment and Interact */
  var quietT;
  function frame() { return MS.$('#mode-frame'); }
  AB.place = function () {
    var f = frame(), st = MS.$('#stage'); if (!f || !st) return;
    var r = st.getBoundingClientRect();
    f.style.left = r.left + 'px'; f.style.top = r.top + 'px'; f.style.width = r.width + 'px'; f.style.height = r.height + 'px';
  };
  AB.banner = function () {
    var f = frame(); if (!f) return;
    var m = MS.mode, info = AB.MODES[m] || AB.MODES.edit, show = !!MS.child && m !== 'edit' && !document.body.classList.contains('presenting');
    f.setAttribute('data-mode', m);
    f.classList.toggle('on', show);
    document.body.setAttribute('data-ms-ui-mode', MS.child ? m : 'none');
    f.innerHTML = ''; f.classList.remove('quiet'); clearTimeout(quietT);
    if (!show) return;
    quietT = setTimeout(function () { f.classList.add('quiet'); }, 4500);
    f.appendChild(h('div', { 'class': 'mf-banner', role: 'status' }, [
      h('span', { 'class': 'mf-ic' }, [MS.icon(info.icon)]),
      h('span', { 'class': 'mf-txt' }, [h('b', { text: info.label + ' mode. ' }), info.hint]),
      h('button', { 'class': 'mf-back', title: 'Back to Edit (Alt+1)', onclick: function () { MS.setMode('edit'); } }, ['✎ Back to Edit', h('kbd', { text: 'Alt 1' })])
    ]));
    AB.place();
  };

  /* name, unsaved dot and Close */
  AB.doc = function () {
    var chip = MS.$('#doc-chip'); if (!chip) return;
    chip.classList.toggle('open', !!MS.doc);
    chip.classList.toggle('dirty', !!(MS.doc && MS.dirty));
    var dn = MS.$('#doc-name');
    if (dn) dn.title = MS.doc ? MS.doc.name + (MS.dirty ? ' (changes not exported yet)' : ' (no unexported changes)') : 'Open document';
  };

  AB.cycle = function (n) {
    var i = typeof n === 'number' ? n : (AB.ORDER.indexOf(MS.mode) + 1) % AB.ORDER.length;
    if (!MS.child) return MS.toast('Open a dashboard first.', 'warn');
    MS.setMode(AB.ORDER[i]);
  };

  /* the mode in the status bar */
  AB.statusMode = function () {
    var el = MS.$('#status-mode'); if (!el) return;
    var info = AB.MODES[MS.mode] || AB.MODES.edit;
    el.hidden = !MS.child; el.setAttribute('data-mode', MS.mode); el.innerHTML = '';
    el.appendChild(h('i', { 'class': 'st-dot' })); el.appendChild(document.createTextNode(info.label + ' mode'));
    el.title = info.hint + ' Switch with ' + AB.ORDER.map(function (k) { return AB.MODES[k].key + ' ' + AB.MODES[k].label; }).join(', ') + '.';
  };

  /* welcome screen: the latest saved version of each dashboard, to pick up where you left off */
  AB.recent = function () {
    var box = MS.$('#recent'); if (!box || !MS.store) return;
    MS.store.all('versions').then(function (list) {
      list.sort(function (a, b) { return b.key - a.key; });
      var seen = {}, rows = [];
      list.forEach(function (x) { var v = x.value; if (!v || seen[v.doc] || rows.length >= 4) return; seen[v.doc] = 1; rows.push(v); });
      box.innerHTML = ''; box.hidden = !rows.length; if (!rows.length) return;
      box.appendChild(h('div', { 'class': 'recent-head' }, [h('span', { text: 'Pick up where you left off' }), h('button', { 'class': 'linklike', onclick: function () { MS.versions.list(); } }, ['All versions'])]));
      box.appendChild(h('div', { 'class': 'recent-grid' }, rows.map(function (v) {
        return h('button', { 'class': 'recent-card', title: 'Open the version "' + v.name + '" of ' + v.doc, onclick: function () { MS.openHtml(v.html, v.doc); MS.toast('Opened "' + v.name + '".', 'ok'); } }, [
          h('span', { 'class': 'recent-ic' }, ['📄']),
          h('span', { 'class': 'recent-txt' }, [h('b', { text: v.doc }), h('small', { text: v.name + ' · ' + new Date(v.created).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) })])]);
      })));
    }).catch(function () { box.hidden = true; });
  };

  function sync() { AB.glide(); AB.banner(); AB.statusMode(); }
  AB.boot = function () {
    var x = MS.$('#btn-close');
    if (x) x.addEventListener('click', function () { MS.closeDoc(); });
    // give each mode button a little shortcut badge inside its tooltip text, and keep the marker in place
    MS.$$('#mode-switch .seg-btn').forEach(function (b) { b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false'); });
    MS.on('mode', function () {
      MS.$$('#mode-switch .seg-btn').forEach(function (b) { b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false'); });
      sync();
    });
    MS.on('doc-opened', function () { AB.doc(); setTimeout(sync, 0); });
    MS.on('child-loaded', sync);
    MS.on('doc-closed', function () { AB.doc(); sync(); AB.recent(); });
    MS.on('changed', AB.doc); MS.on('saved', function () { setTimeout(AB.doc, 0); });
    window.addEventListener('resize', MS.debounce(function () { AB.glide(); AB.place(); }, 40));
    if (window.ResizeObserver) new ResizeObserver(MS.debounce(AB.place, 20)).observe(MS.$('#stage'));
    // fonts and icons change button widths after first paint
    setTimeout(sync, 60); setTimeout(AB.glide, 400);
    AB.doc(); sync(); AB.recent();
  };

  MS.api.add('close_dashboard', { d: 'Close the open dashboard and go back to the start screen. If it has changes that are not exported, it stays open unless force is true.', p: { force: ['boolean', 'Close even if there are unexported changes'] },
    f: function (a) {
      if (!MS.doc) return { closed: false, note: 'Nothing is open.' };
      if (MS.dirty && !a.force) return { closed: false, unsavedChanges: true, note: 'There are unexported changes. Call export_html first, or pass force: true to drop them.' };
      return MS.closeDoc({ force: true }).then(function (ok) { return { closed: !!ok }; });
    } });
})(window.MS);
