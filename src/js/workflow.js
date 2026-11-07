/* A short route through the existing editor tools, with a read-only import report. */
(function (MS) {
  'use strict';
  var h = MS.h, W = MS.workflow = {};
  function runtime() { return !!(MS.child && MS.rt()); }
  W.importReport = function () {
    if (!MS.child) throw new Error('Open a dashboard first.');
    var r = MS.rt(), d = MS.child.doc, assets = MS.assets.scan(d);
    var charts = r ? r.charts().map(function (c) {
      return { name: MS.charts.nameOf(c.key), library: c.lib, support: c.lib === 'd3' ? 'Appearance and review only' : 'Chart editing available' };
    }) : [];
    var unknown = MS.$$('canvas,svg', d).filter(function (e) {
      if (e.closest('[data-ms-editor],button,[role=img][aria-hidden=true]')) return false;
      if (!e.getBoundingClientRect().width) return false;
      return !r || !r.chartOf(e);
    }).filter(function (e) { return e.tagName.toLowerCase() === 'canvas'; }).length;
    return { name: MS.doc.name, folder: MS.doc.folder, safe: !r, charts: charts, unrecognisedCanvases: unknown, assets: assets, missing: MS.doc.importNotes || [] };
  };
  W.importDialog = function () {
    if (!MS.child) return MS.toast('Open a dashboard first, then choose File › Import report.', 'warn');
    var a = W.importReport(), refs = a.assets;
    function urls(title, list, hint) {
      return list.length ? h('section', { 'class': 'report-section' }, [h('h3', { text: title + ' (' + list.length + ')' }), h('p', { text: hint }),
        h('ul', {}, list.slice(0, 20).map(function (u) { return h('li', {}, [h('code', { text: u })]); })),
        list.length > 20 ? h('p', { text: 'And ' + (list.length - 20) + ' more. Save the report for the full list.' }) : null]) : null;
    }
    var body = h('div', { 'class': 'guide-prose' }, [
      h('p', { text: 'Opened ' + (a.folder ? 'with its folder' : 'as a single file') + '. This report shows what Mothership recognised and which files are still linked.' }),
      a.safe ? h('p', { 'class': 'guide-note', text: 'Safe mode is on. Chart scripts did not run. Turn it off only if you trust this dashboard.' }) : null,
      h('section', { 'class': 'report-section' }, [h('h3', { text: a.charts.length + ' recognised chart(s)' }),
        a.charts.length ? h('ul', {}, a.charts.map(function (c) { return h('li', {}, [h('strong', { text: c.name }), ' · ' + c.library + ' · ' + c.support]); })) :
          h('p', { text: a.safe ? 'Chart support has not been checked.' : 'No supported live charts found. Text and layout may still be editable. If you expected charts, check the dependencies below.' }),
        a.unrecognisedCanvases ? h('p', { text: a.unrecognisedCanvases + ' drawing area(s) have no recognised chart adapter.' }) : null]),
      urls('Relative files', refs.relative, 'Reopen with File › Open folder and include the files. CSS imports and module imports may need to be bundled in the source.'),
      urls('Remote dependencies', refs.external, 'Replace these with local copies if the dashboard must work offline.'),
      urls('Machine-specific paths', refs.local, 'These paths may not exist on another laptop. Use files relative to the dashboard folder.'),
      urls('Files not found during bundling', a.missing, 'Restore these files in the folder or correct the paths in the original dashboard.'),
      refs.modules || refs.frames ? h('p', { 'class': 'guide-note', text: 'Modules or embedded pages detected. Their scripts or data may not travel with the export.' }) : null,
      h('p', { 'class': 'muted', text: 'A scan cannot guarantee export compatibility. Scripts can request data later or rebuild content. Try the main interactions in a standalone export before sharing.' })
    ]);
    return MS.dialog({ title: 'Import report: ' + a.name, wide: true, body: body, enterSubmits: false,
      buttons: [{ label: 'Close', value: null }, { label: 'Save report', value: 'save' }, { label: 'Read the import guide', value: 'help' }] }).then(function (v) {
        if (v === 'save') MS.download(MS.exportName('-import-report').replace(/\.html$/, '.json'), JSON.stringify(a, null, 2), 'application/json');
        if (v === 'help') MS.help.guide('import');
      });
  };

  var STEPS = [
    { key: 'import', title: 'Import', summary: 'Choose the right starting file.', check: 'I opened the right dashboard and checked any missing files.',
      text: 'Use Open for a single HTML file. Use Open folder if it comes with scripts, styles, images or data. If you’re learning, work in a fresh copy of the sales sample.',
      guide: 'import', actions: [['Open dashboard', function () { return MS.cmd.open(); }], ['Open folder', function () { return MS.cmd.openFolder(); }], ['Import report', W.importDialog, 'doc'], ['Open practice copy', function () { return MS.help.practice(); }]] },
    { key: 'edit', title: 'Edit', summary: 'Make the story clear.', check: 'I checked the key headings, charts, number units and source dates.',
      text: 'Use Edit to select and change content. Add a headline and one takeaway per important chart. Add How-to, FAQ or Methodology tabs where the reader needs context.',
      guide: 'text', actions: [['Show editing tools', function () { MS.setMode('edit'); MS.help.pointAt('Home'); }, 'doc'], ['Refresh data', function () { return MS.data.refreshAll(); }, 'runtime']] },
    { key: 'review', title: 'Review', summary: 'Resolve issues before sign-off.', check: 'I reviewed the changes and resolved or documented every must-fix comment.',
      text: 'Use Comment to mark a spot and explain what needs to change. Keep one request per comment. Use Interact to reproduce issues with filters or drill-downs.',
      guide: 'review', actions: [['Open Comments', function () { MS.$('#btn-cmts').click(); }, 'runtime'], ['Show review tools', function () { MS.help.pointAt('Review'); }, 'doc']] },
    { key: 'check', title: 'Check', summary: 'Verify behaviour and numbers.', check: 'I ran the necessary checks, compared key numbers with the source, and checked the exported copy offline.',
      text: 'Run tests after drafting them. Compare important numbers with the source report. Try the exported file as a viewer, including filters, tabs and pop-ups. Read what was not checked.',
      guide: 'testing', actions: [['Open test plan', function () { return MS.qa.dialog(); }, 'runtime'], ['Ready to publish?', function () { return MS.preflight.dialog(); }, 'doc']] },
    { key: 'share', title: 'Export', summary: 'Share the checked version.', check: 'I opened the exact file I will send and checked that it contains the intended data and notes.',
      text: 'Keep a working HTML copy. Choose Publish for a versioned viewer copy, or export PDF/PowerPoint for a static handout. Review comments and hidden data before sending.',
      guide: 'publish', actions: [['Export HTML', function () { return MS.versions.exportFile(false); }, 'doc'], ['Publish…', function () { return MS.publish.dialog(); }, 'runtime'],
        ['Save validation record', function () { return MS.preflight.record().then(function (r) { MS.download(r.name, r.markdown, 'text/markdown'); }); }, 'doc']] }
  ];
  W.open = function (step) {
    var session = MS.doc && MS.doc.session, done = session ? session.workflow || (session.workflow = {}) : {};
    var rev = function () { return MS.qa.revision() || (session && session.id + ':' + session.revision); };
    function complete(s) { return !!done[s.key] && (s.key !== 'check' && s.key !== 'share' || done[s.key] === rev()); }
    var current = Math.max(0, STEPS.findIndex(function (s) { return step ? s.key === step : !complete(s); }));
    var nav = h('div', { 'class': 'workflow-nav', role: 'group', 'aria-label': 'Workflow steps' });
    var body = h('section', { 'class': 'workflow-body guide-prose' }), wrap;
    var layout = h('div', { 'class': 'workflow-layout' }, [nav, body]);
    function leave(fn) {
      if (wrap) wrap.querySelector('.dlg-x').click();
      try { Promise.resolve(fn()).catch(function (e) { MS.toast(e.message, 'error'); }); } catch (e) { MS.toast(e.message, 'error'); }
    }
    function draw() {
      var s = STEPS[current];
      nav.innerHTML = ''; body.innerHTML = '';
      STEPS.forEach(function (x, i) {
        nav.appendChild(h('button', { 'class': 'workflow-step' + (i === current ? ' on' : ''), 'aria-current': i === current ? 'step' : 'false', onclick: function () { current = i; draw(); nav.children[i].focus(); } },
          [h('span', { 'class': 'workflow-num', text: complete(x) ? '✓' : String(i + 1) }), h('span', {}, [h('b', { text: x.title }), h('small', { text: x.summary })])]));
      });
      body.appendChild(h('h2', { text: s.title }));
      body.appendChild(h('p', { text: s.text }));
      if (!MS.child && current) body.appendChild(h('p', { 'class': 'guide-note', text: 'Open a dashboard or practice copy before using these commands.' }));
      body.appendChild(h('div', { 'class': 'workflow-actions' }, s.actions.map(function (a, i) {
        return h('button', { 'class': 'btn' + (!i ? ' primary' : ''), disabled: a[2] === 'doc' && !MS.child || a[2] === 'runtime' && !runtime(), onclick: function () { leave(a[1]); } }, [a[0]]);
      }).concat([h('button', { 'class': 'btn', onclick: function () { leave(function () { MS.help.guide(s.guide); }); } }, ['Read the guide'])])));
      var cb = h('input', { type: 'checkbox', checked: complete(s), disabled: !session, onchange: function () {
        if (cb.checked) done[s.key] = rev(); else delete done[s.key]; draw(); body.querySelector('input[type=checkbox]').focus();
      } });
      body.appendChild(h('label', { 'class': 'workflow-check' }, [cb, h('span', { text: s.check })]));
      if (current < STEPS.length - 1) body.appendChild(h('button', { 'class': 'btn sm', onclick: function () { current++; draw(); nav.children[current].focus(); } }, ['Next step']));
    }
    var p = MS.dialog({ title: 'Dashboard workflow', sub: session ? 'A checklist for ' + MS.doc.name + '. Check off the work you have actually done.' : 'Choose a starting point, or follow the five steps in order.', wide: true,
      enterSubmits: false, body: layout, buttons: [{ label: 'Close', value: null }] });
    wrap = MS.$$('.dlg-wrap').pop(); draw();
    return p;
  };
  MS.api.add('import_report', { d: 'Report chart compatibility and linked assets in the open dashboard. A scan, not an offline test.', p: {}, f: W.importReport });
})(window.MS);
