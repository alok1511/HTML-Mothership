/* Help: a quick tour of the screen, hands-on tutorial lessons, and a searchable user guide. */
(function (MS) {
  'use strict';
  var h = MS.h;
  var H = MS.help = {};

  /* ---------------------------------------------------------- spotlight helpers */
  function clearSpot() { MS.$$('.spot, .spot-card').forEach(function (n) { n.remove(); }); MS.$$('.pulse').forEach(function (n) { n.classList.remove('pulse'); }); }
  function spot(target) {
    MS.$$('.spot').forEach(function (n) { n.remove(); });
    if (!target) return null;
    var r = target.getBoundingClientRect();
    var s = h('div', { 'class': 'spot', style: { left: (r.left - 6) + 'px', top: (r.top - 6) + 'px', width: (r.width + 12) + 'px', height: (r.height + 12) + 'px' } });
    document.body.appendChild(s);
    return r;
  }
  // Switch the ribbon to a tab and make one of its buttons pulse.
  H.pointAt = function (tab, label) {
    if (tab && MS.ribbon.active !== tab) { MS.ribbon.active = tab; MS.prefs.set('ribbonTab', tab); MS.ribbon.render(); }
    MS.$$('.pulse').forEach(function (n) { n.classList.remove('pulse'); });
    var b = label ? MS.$$('#ribbon-body .rbtn').filter(function (x) { return (x.querySelector('.rl') || {}).textContent === label; })[0] : MS.$$('#ribbon-tabs .rtab').filter(function (x) { return x.textContent === tab; })[0];
    if (b) { b.classList.add('pulse'); setTimeout(function () { b.classList.remove('pulse'); }, 4000); }
    return b;
  };

  /* ---------------------------------------------------------- quick tour */
  var TOUR = [
    { sel: '#ribbon-tabs', title: 'The ribbon', text: 'Works like PowerPoint. <b>Insert</b> adds tabs, sections, KPI cards, charts and footers. <b>Design</b> loads your brand. <b>Charts</b> sets pop-ups and drill-down. <b>Review</b> collects comments. <b>Help</b> has the tutorial.' },
    { sel: '#appbar .seg.mode', title: 'Edit or Interact', text: '<b>Edit</b>: click anything to select it, double-click text to type. <b>Interact</b>: use the dashboard like your audience will (filters, pop-ups, drill-down).' },
    { sel: '#cmt-bar', title: 'Comments → AI prompt', text: 'Pin comments on an <b>element</b>, a screen <b>area</b>, or an <b>interaction</b> you just did. <b>✨ Prompt</b> turns them all into one set of instructions for an AI assistant.' },
    { sel: '#left', title: 'Outline', text: 'Every tab, chart, dataset and comment. Click a chart to jump to it. Drag tabs to reorder them.' },
    { sel: '#stage', title: 'Your dashboard', text: 'This is the real page, drawn at desktop width and scaled to fit. Double-click a chart for its settings: commentary, look, pop-up and drill-down.' },
    { sel: '#right', title: 'Format panel', text: 'Shows options for whatever you selected: font, size, colour, spacing, box, hover pop-up and (for charts) the chart\'s look.' },
    { sel: '#zoomctl', title: 'Zoom', text: 'Zoom in for detail or press Fit. <b>Ctrl + mouse wheel</b> over the dashboard also zooms.' },
    { sel: '#btn-export', title: 'Export', text: 'Saves one .html file on this laptop. Anyone can open it in a browser, and it reopens here for more editing.' }
  ];
  H.tour = function (i) {
    i = i || 0; clearSpot();
    var st = TOUR[i]; if (!st) { MS.prefs.set('toured', true); return; }
    var t = MS.$(st.sel), r = spot(t) || { left: innerWidth / 2 - 160, top: 120, width: 0, height: 0, bottom: 120, right: innerWidth / 2 };
    var card = h('div', { 'class': 'spot-card' }, [
      h('div', { 'class': 'muted', text: (i + 1) + ' of ' + TOUR.length }), h('h3', { text: st.title }), h('p', { html: st.text }),
      h('div', { 'class': 'row gap' }, [h('button', { 'class': 'btn sm', onclick: function () { clearSpot(); MS.prefs.set('toured', true); } }, ['Skip']), h('span', { 'class': 'grow' }),
        i ? h('button', { 'class': 'btn sm', onclick: function () { H.tour(i - 1); } }, ['Back']) : null,
        h('button', { 'class': 'btn sm primary', onclick: function () { if (i === TOUR.length - 1) { clearSpot(); MS.prefs.set('toured', true); MS.toast('Tour done. Try Help › Tutorial for hands-on lessons.', 'ok', 5000); } else H.tour(i + 1); } }, [i === TOUR.length - 1 ? 'Finish' : 'Next'])])]);
    document.body.appendChild(card);
    var cw = 320, ch = card.offsetHeight, x = r.left, y = r.bottom + 14;
    if (y + ch > innerHeight - 10) y = Math.max(10, r.top - ch - 14);
    if (r.height > innerHeight * 0.5) { y = Math.min(innerHeight - ch - 20, r.top + 40); x = r.right + 14 > innerWidth - cw ? r.left + 40 : r.right + 14; }
    card.style.left = Math.max(10, Math.min(x, innerWidth - cw - 10)) + 'px'; card.style.top = y + 'px';
  };

  /* ---------------------------------------------------------- tutorial (hands-on, checks your progress) */
  var did = {};
  MS.on('changed', function (label) { if (label) did[label] = true; });
  MS.on('saved', function () { did.saved = true; });
  MS.on('prompt-opened', function () { did.prompt = true; });
  MS.on('mode', function (m) { if (m === 'interact') did.interact = true; });
  function rt() { return MS.rt(); }
  function anyChart(fn) { var r = rt(); return !!r && Object.keys(r.state.charts).some(function (k) { return fn(r.state.charts[k], k); }); }
  function inDoc(sel) { return !!(MS.child && MS.child.doc.querySelector(sel)); }
  var LESSONS = [
    { title: 'Getting around', steps: [
      { text: 'Open the sample sales dashboard.', point: ['File', 'Samples'], check: function () { return MS.doc && /sales/i.test(MS.doc.name); }, doIt: function () { MS.samples.open('sales'); } },
      { text: 'Click any heading in the dashboard to select it. The Format panel on the right fills in.', check: function () { return !!MS.sel; } },
      { text: 'Double-click the heading and type a new title. Press Enter or click away when done.', check: function () { return did['Edit text']; } },
      { text: 'Undo it with Ctrl+Z (or Home › Undo), then redo with Ctrl+Y.', point: ['Home', 'Undo'], check: function () { return MS.history.canRedo() || did.redone; } },
      { text: 'Zoom: press + in the bottom-right corner, then ⤢ Fit.', check: function () { return MS.view.zoom === 'fit' && did.zoomed; } }] },
    { title: 'Tabs and pages', steps: [
      { text: 'Turn the dashboard into tabs: Layout › Tabbed layout.', point: ['Layout', 'Tabbed layout'], check: function () { return rt() && rt().layoutEnabled(); }, doIt: function () { MS.tabs.ensureLayout(); } },
      { text: 'Add a text tab for a How-to page: Insert › Text tab.', point: ['Insert', 'Text tab'], check: function () { return rt() && rt().tabs().length >= 2; } },
      { text: 'Add a page header to it: Insert › Header. Double-click its text to edit.', point: ['Insert', 'Header'], check: function () { return inDoc('.ms-banner'); } },
      { text: 'Add a footer that shows under every tab: Insert › Footer.', point: ['Insert', 'Footer'], check: function () { return inDoc('.ms-page-footer'); } },
      { text: 'Drag a tab in the left panel to reorder it, or rename it with a double-click.', check: function () { return did['Reorder tabs'] || did['Rename tab']; } }] },
    { title: 'Charts that explain themselves', steps: [
      { text: 'Give every chart a title, subtitle and inference: Layout › Commentary.', point: ['Layout', 'Commentary'], check: function () { return inDoc('.ms-block .ms-visual canvas, .ms-block [_echarts_instance_], .ms-block .js-plotly-plot'); } },
      { text: 'Double-click a chart, open the Look tab, and pick a font and a "Dark pop-up". Press Apply.', check: function () { return anyChart(function (c) { return c.style; }); } },
      { text: 'Double-click a chart again, open Tooltip, choose "₹ crore" and Apply. Hover over the chart in Interact mode to see it.', check: function () { return anyChart(function (c) { return c.tooltip; }); } }] },
    { title: 'Drill-down and filters', steps: [
      { text: 'Double-click the "Revenue by state" chart, open "Data & drill-down" and press "Use this data". Then Apply.', check: function () { return anyChart(function (c) { return c.binding; }); } },
      { text: 'Add a filter pane: Layout › Filter pane, tick one or two fields, Save.', point: ['Layout', 'Filter pane'], check: function () { return rt() && rt().state.filters.length > 0; } },
      { text: 'Switch to Interact (top right) and double-click a bar to drill down. Use the breadcrumb above the chart to go back.', check: function () { var r = rt(); return !!r && Object.keys(r.drill).some(function (k) { return r.drill[k].length; }); } }] },
    { title: 'Build from scratch', steps: [
      { text: 'Add a row of KPI cards: Insert › KPI cards. Pick a dataset so the numbers follow the filters.', point: ['Insert', 'KPI cards'], check: function () { return inDoc('.ms-kpi'); } },
      { text: 'Add a new chart from data: Insert › Chart.', point: ['Insert', 'Chart'], check: function () { return inDoc('[data-ms-chart]'); } },
      { text: 'Add a section with its own title: Insert › Section. Select its title, then insert a chart into it.', point: ['Insert', 'Section'], check: function () { return inDoc('.ms-section'); } },
      { text: 'Click any text and give it a hover pop-up in the right panel (Hover pop-up).', check: function () { return inDoc('[data-ms-tip]'); } }] },
    { title: 'Review and AI prompt', steps: [
      { text: 'Press 📍 Element at the top, click something, and write a comment.', check: function () { return MS.review.list().some(function (c) { return c.kind === 'element'; }); } },
      { text: 'Press ▭ Area and drag a box around part of the screen. Write a comment.', check: function () { return MS.review.list().some(function (c) { return c.kind === 'area'; }); } },
      { text: 'Switch to Interact, use a filter or drill down, then press ⚡ Interaction and describe what should change.', check: function () { return MS.review.list().some(function (c) { return c.kind === 'interaction'; }); } },
      { text: 'Press ✨ Prompt and copy the result into your AI assistant, with the exported file attached.', check: function () { return did.prompt; } }] },
    { title: 'Brand and share', steps: [
      { text: 'Design › Edit theme: change the primary colour and fonts. (Or Load brand to use a SKILL.md brand file.)', point: ['Design', 'Edit theme'], check: function () { return rt() && !!rt().state.theme; } },
      { text: 'Present it: press ▶ Present (or F5). Arrow keys change tabs, Esc ends.', check: function () { return did.presented; } },
      { text: 'Export HTML to save the finished file on this laptop.', point: ['File', 'Export HTML'], check: function () { return did.saved; } }] }
  ];
  H.LESSONS = LESSONS;
  var tut = null, poll = null;
  H.tutorial = function (lesson) {
    if (tut) tut.remove();
    var L = MS.prefs.get('tutDone', {});
    var panel = tut = h('div', { 'class': 'coach' });
    function close() { clearInterval(poll); panel.remove(); tut = null; clearSpot(); }
    function menu() {
      clearInterval(poll); panel.innerHTML = '';
      panel.appendChild(h('div', { 'class': 'coach-head' }, [h('strong', { text: '🎓 Tutorial' }), h('button', { 'class': 'icon-btn', title: 'Close', onclick: close }, ['✕'])]));
      panel.appendChild(h('p', { 'class': 'muted', text: 'Short hands-on lessons. Each step ticks itself when you do it. Use the sample dashboard, so nothing of yours changes.' }));
      LESSONS.forEach(function (ls, i) {
        panel.appendChild(h('button', { 'class': 'coach-lesson', onclick: function () { run(i, 0); } }, [h('span', { text: (L[i] ? '✓ ' : (i + 1) + '. ') + ls.title }), h('small', { 'class': 'muted', text: ls.steps.length + ' steps' })]));
      });
    }
    function run(i, k) {
      clearInterval(poll); clearSpot();
      var ls = LESSONS[i], st = ls.steps[k];
      if (!st) { L[i] = true; MS.prefs.set('tutDone', L); MS.toast('Lesson done: ' + ls.title, 'ok'); return LESSONS[i + 1] ? run(i + 1, 0) : menu(); }
      if (!MS.child && i > 0 && k === 0) MS.samples.open('sales');
      panel.innerHTML = '';
      var status = h('div', { 'class': 'coach-status', text: 'Waiting for you…' });
      panel.appendChild(h('div', { 'class': 'coach-head' }, [h('button', { 'class': 'icon-btn', title: 'All lessons', onclick: menu }, ['☰']), h('strong', { 'class': 'grow', text: ls.title }), h('small', { 'class': 'muted', text: (k + 1) + ' / ' + ls.steps.length }), h('button', { 'class': 'icon-btn', title: 'Close', onclick: close }, ['✕'])]));
      panel.appendChild(h('div', { 'class': 'coach-bar' }, [h('i', { style: { width: Math.round(k / ls.steps.length * 100) + '%' } })]));
      panel.appendChild(h('p', { 'class': 'coach-text', text: st.text }));
      panel.appendChild(status);
      panel.appendChild(h('div', { 'class': 'row gap' }, [
        st.point ? h('button', { 'class': 'btn sm', onclick: function () { H.pointAt(st.point[0], st.point[1]); } }, ['👀 Show me']) : null,
        st.doIt ? h('button', { 'class': 'btn sm', onclick: function () { st.doIt(); } }, ['Do it for me']) : null,
        h('span', { 'class': 'grow' }),
        h('button', { 'class': 'btn sm', onclick: function () { run(i, k + 1); } }, ['Skip'])]));
      if (st.point) H.pointAt(st.point[0], st.point[1]);
      var done = false;
      poll = setInterval(function () {
        var ok = false; try { ok = st.check(); } catch (e) {}
        if (ok && !done) { done = true; status.textContent = '✓ Done!'; status.classList.add('ok'); setTimeout(function () { if (tut === panel) run(i, k + 1); }, 900); }
      }, 600);
    }
    document.body.appendChild(panel);
    if (lesson != null) run(lesson, 0); else menu();
  };
  MS.on('history', function () { if (MS.history.canRedo()) did.redone = true; });
  var z0 = null; setInterval(function () { if (MS.view && MS.view.zoom !== 'fit' && MS.view.zoom !== z0) { did.zoomed = true; } z0 = MS.view && MS.view.zoom; }, 800);
  setInterval(function () { if (MS.present && MS.present.on) did.presented = true; }, 800);

  /* ---------------------------------------------------------- user guide */
  var K = function (k) { return '<kbd>' + k + '</kbd>'; };
  var GUIDE = [
    { id: 'start', title: 'Getting started', html: '<p>Mothership opens an HTML dashboard and lets you edit it like a PowerPoint deck. Everything runs in this browser tab. Nothing is uploaded and nothing is installed.</p><ol><li><b>Open</b> a dashboard: File › Open, drag a file onto the window, or try File › Samples.</li><li>If its charts don\'t show, use <b>File › Open folder</b> and pick the folder with its .js/.css/.json files. Mothership bundles them into one file.</li><li>Or start from scratch with <b>File › New</b>.</li><li>When done, <b>Export HTML</b> (top right). You get one .html file that opens in any browser and reopens here for more edits.</li></ol><p><b>Edit</b> mode (top right) is for changing things. <b>Interact</b> mode is for using the dashboard like your audience will.</p>' },
    { id: 'zoom', title: 'Zoom and fitting the screen', html: '<p>Dashboards are designed for wide screens, so Mothership draws them at desktop width (1280 px or more) and shrinks them to fit the middle panel. The layout stays exactly as your audience sees it.</p><ul><li>Zoom with the − / + buttons in the bottom-right corner, or ' + K('Ctrl') + ' + mouse wheel over the dashboard.</li><li><b>⤢ Fit</b> fits the whole width again.</li><li>View › Draw at changes the width the page is drawn at: Laptop 1366, Tablet 820, Phone 390, or Full HD from Other.</li><li>Hide the side panels from View › Panels for more room.</li></ul>' },
    { id: 'text', title: 'Text, fonts and colours (any element)', html: '<ul><li>Click anything to select it. ' + K('Alt') + '+' + K('↑') + ' selects the parent.</li><li>Double-click text to type. ' + K('Enter') + ' or clicking away finishes.</li><li>The <b>Home</b> tab and the <b>Format panel</b> (right) change font, size, colour, background, bold/italic, alignment, line height, letter spacing and case.</li><li>The <b>Box</b> section sets width, height, padding, margin, corners and border.</li><li><b>Find &amp; replace</b> (' + K('Ctrl') + '+' + K('F') + ') changes wording everywhere.</li><li>Text drawn by the dashboard\'s own script is tagged <i>script-made</i>. Mothership re-applies your edit after the script runs.</li></ul>' },
    { id: 'popups', title: 'Hover pop-ups on anything', html: '<p>Select any element and type a note under <b>Hover pop-up</b> in the right panel, e.g. a definition or the data source. It appears when someone hovers over it (in Interact mode, when presenting and in the exported file).</p><p><b>Pop-up style…</b> sets one look for all of them: background, text colour, border, size, corners. Tick "Use the same look for chart pop-ups" to match the charts.</p>' },
    { id: 'charts', title: 'Charts: commentary, look and pop-ups', html: '<p>Double-click a chart (or select it and use the Charts tab). Chart settings has four tabs:</p><ul><li><b>Commentary &amp; size</b>: title, subtitle and inference (the "so what"), width and height.</li><li><b>Look</b>: font, text size and colour for axes and legend, legend position, and the hover pop-up\'s background, text, border, size and corners. Changes show on the chart straight away.</li><li><b>Tooltip</b>: what the pop-up says. Use placeholders like {label}, {value:cr}, {pct:pct}. Presets cover ₹ crore, ₹ lakh and share of total.</li><li><b>Data &amp; drill-down</b>: see the next section.</li></ul><p>With a chart selected, the font box on the Home tab and the <b>Chart look</b> section of the right panel also style the chart. <b>Use on every chart</b> copies the look to all charts.</p>' },
    { id: 'drill', title: 'Drill-down and data', html: '<p>Open Chart settings › <b>Data &amp; drill-down</b>. Mothership looks inside the dashboard for the table the chart was made from (it matches the chart\'s labels to the columns). Press <b>Use this data</b>.</p><ul><li><b>Show by / Drill to</b>: the levels, e.g. Region › State › City.</li><li><b>Double-click does</b>: drill to the next level, show the underlying records, filter every chart, or nothing.</li><li>No table found? <b>Use the numbers drawn in this chart</b> gives you sorting, top N and rich pop-ups, or load a CSV/Excel/JSON file from the Data tab.</li><li>The breadcrumb above a drilled chart takes viewers back up.</li></ul>' },
    { id: 'filters', title: 'Filter pane', html: '<p>Layout › <b>Filter pane</b>: choose the fields to filter by, the order, and whether the pane sits on the left or across the top. Every chart, KPI card and table linked to that dataset follows it. Drag its right edge to resize it.</p>' },
    { id: 'build', title: 'Building pages from scratch', html: '<p>The <b>Insert</b> tab has page parts. They go after whatever you have selected, or at the end of the current tab.</p><ul><li><b>Header</b>: a coloured title banner. <b>Section</b>: a titled area with its own grid; select its title, then insert charts or KPI cards into it.</li><li><b>Columns</b>, <b>Heading</b>, <b>Paragraph</b>, <b>Callout</b>, and from More: divider, spacer, button link.</li><li><b>Footer</b>: source, owner, date and confidentiality, shown under every tab.</li><li><b>Chart</b>: a new bar, line, area, pie or doughnut chart from a dataset. It follows filters and can drill down.</li><li><b>KPI cards</b>: headline numbers. Linked to a dataset they recalculate with the filters; double-click a number to change what it shows.</li><li><b>Text tab</b>, <b>Chart tab</b>, <b>Tab from file</b>: new tabs, including How-to, FAQ and Methodology pages from Word, PowerPoint, Excel, PDF, Markdown or images.</li></ul>' },
    { id: 'tabs', title: 'Tabs and moving charts', html: '<ul><li>Layout › <b>Tabbed layout</b> turns the page into tabs with a ribbon across the top (or down the left).</li><li>Drag tabs in the left panel to reorder; use ⋯ to rename, hide, duplicate, add speaker notes or delete.</li><li>Move a chart to another tab: drag its ⠿ handle onto the tab name in the dashboard\'s ribbon (hold ' + K('Ctrl') + ' to copy), or use <b>Send to tab</b> in the right panel.</li><li>Resize a chart block with its corner handle.</li></ul>' },
    { id: 'brand', title: 'Brand and theme', html: '<p>Design › <b>Load brand</b> reads colours, fonts and a logo from a brand skill file (SKILL.md, .skill or .zip) or a theme .json. <b>Edit theme</b> changes them by hand. <b>Brand check</b> finds off-brand colours, low contrast and charts without commentary.</p>' },
    { id: 'review', title: 'Comments and AI prompts', html: '<p>Use the 💬 buttons at the top (or the Review tab):</p><ul><li><b>📍 Element</b>: click a part of the dashboard and write a comment. In Edit mode, the selected element is used.</li><li><b>▭ Area</b>: drag a box over the screen. Mothership records what is inside it.</li><li><b>⚡ Interaction</b>: comment on something you just did in Interact mode. Mothership remembers your recent steps (tabs, filters, drill-downs, pop-ups) and the current view; tick the steps that matter.</li></ul><p>Numbered pins mark each comment. Click a pin to edit, mark done or delete. <b>✨ Prompt</b> turns the comments into one clear set of instructions for any AI assistant (Claude, ChatGPT, Gemini, Copilot or your company tool). Attach the exported dashboard, or paste the file into the prompt when it is small. When exporting, you can leave the comments out of the file.</p>' },
    { id: 'present', title: 'Presenting', html: '<p>▶ <b>Present</b> (' + K('F5') + ') shows the dashboard full screen, one tab at a time. ' + K('→') + ' / ' + K('←') + ' change tabs, ' + K('L') + ' laser pointer, ' + K('B') + ' blank screen, ' + K('Esc') + ' ends. View › Presenter view opens a second window with notes, a timer and the next tab.</p>' },
    { id: 'save', title: 'Saving, versions and export', html: '<ul><li><b>Export HTML</b> (' + K('Ctrl') + '+' + K('E') + ') saves one standalone file. In Chrome/Edge later exports overwrite the same file.</li><li><b>Save version</b> (' + K('Ctrl') + '+' + K('S') + ') keeps a named copy in this browser. <b>Versions</b> restores one. Mothership also autosaves.</li><li>Print / PDF prints each tab on its own page.</li></ul>' },
    { id: 'extend', title: 'Plugins, recipes and brand skills', html: '<p>Plugins (.js) add buttons to the Plugins tab. Recipes (.json) replay a list of edits (tabs, theme, tooltips, filters) on any dashboard, which is handy for a monthly refresh. See docs/EXTENDING.md in the Mothership folder.</p>' },
    { id: 'shortcuts', title: 'Keyboard shortcuts', html: '<table class="keys">' + [['Ctrl+Z / Ctrl+Y', 'Undo / redo'], ['Ctrl+C, X, V', 'Copy, cut, paste blocks'], ['Ctrl+D', 'Duplicate'], ['Delete', 'Delete the selection'], ['Enter', 'Edit the selected text'], ['Esc', 'Deselect / cancel commenting'], ['Alt+↑', 'Select the parent'], ['Alt+→ / Alt+←', 'Next / previous tab'], ['Ctrl+F', 'Find & replace'], ['Ctrl+S', 'Save a version'], ['Ctrl+E', 'Export HTML'], ['Ctrl+Shift+E', 'Save as…'], ['Ctrl+O', 'Open'], ['Ctrl+wheel', 'Zoom the dashboard'], ['F5', 'Present']].map(function (r) { return '<tr><td><kbd>' + r[0] + '</kbd></td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>' },
    { id: 'troubleshooting', title: 'Problems and fixes', html: '<dl><dt>Charts are blank</dt><dd>The dashboard loads its libraries or data from separate files or the internet. Use File › Open folder. If it needs the internet, turn off View › Network lock.</dd><dt>"Use this data" doesn\'t appear</dt><dd>The data isn\'t in the page (it may be fetched from a server). Use "the numbers drawn in this chart", or load a CSV/Excel export from the Data tab.</dd><dt>My text change came back after reload</dt><dd>That text is written by the page\'s script. Mothership re-applies your edit after the script runs; if the script writes it later, edit it in the source data instead.</dd><dt>Copy prompt didn\'t work</dt><dd>Some browsers block copying from local files. Click in the prompt box, press Ctrl+A then Ctrl+C, or use Save as .md.</dd><dt>Versions/autosave are off</dt><dd>The browser blocks storage for local files (some Firefox or locked-down setups). Export still works.</dd><dt>The page looks squashed</dt><dd>View › Draw at › Auto, then ⤢ Fit.</dd></dl>' }
  ];
  H.GUIDE = GUIDE;
  H.guide = function (id) {
    var search = h('input', { 'class': 'inp', type: 'search', placeholder: 'Search the guide…' });
    var toc = h('div', { 'class': 'guide-toc' }), content = h('div', { 'class': 'guide-body' });
    function show(sec, q) {
      MS.$$('button', toc).forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-id') === sec.id); });
      content.innerHTML = '<h2>' + sec.title + '</h2>' + sec.html;
      if (q) MS.$$('p,li,dd,td', content).forEach(function (n) { if (n.textContent.toLowerCase().indexOf(q) >= 0) n.classList.add('hit'); });
      content.scrollTop = 0;
    }
    function draw() {
      var q = search.value.trim().toLowerCase();
      var hits = GUIDE.filter(function (s) { return !q || (s.title + ' ' + s.html.replace(/<[^>]+>/g, ' ')).toLowerCase().indexOf(q) >= 0; });
      toc.innerHTML = '';
      hits.forEach(function (s) { toc.appendChild(h('button', { 'data-id': s.id, onclick: function () { show(s, q); } }, [s.title])); });
      if (hits.length) show(hits.filter(function (s) { return s.id === id; })[0] || hits[0], q); else content.innerHTML = '<p class="muted">Nothing found. Try a simpler word, e.g. "font", "drill" or "export".</p>';
      id = null;
    }
    search.addEventListener('input', draw);
    MS.dialog({ title: '📖 Mothership user guide', wide: true, enterSubmits: false, body: h('div', { 'class': 'guide' }, [h('div', { 'class': 'guide-side' }, [search, toc]), content]),
      buttons: [{ label: '🎓 Start the tutorial', value: 'tut' }, { label: 'Close', primary: true, value: null }] }).then(function (v) { if (v === 'tut') H.tutorial(); });
    draw();
  };
  H.about = function () {
    MS.dialog({ title: 'About Mothership', body: h('div', {}, [
      h('p', { html: '<b>HTML Mothership ' + MS.VERSION + '</b>: a PowerPoint-style editor for HTML dashboards.' }),
      h('p', { text: 'It runs entirely in this browser, offline, with nothing to install. Your files never leave this laptop.' }),
      h('p', { 'class': 'muted', text: 'Bundled open-source libraries (Chart.js, ECharts, Plotly, SheetJS, Mammoth, PDF.js, JSZip, Marked) are listed with their licences in THIRD_PARTY_NOTICES.md.' })]),
      buttons: [{ label: 'Close', primary: true, value: null }] });
  };
  // first visit: offer the tour (once)
  setTimeout(function () {
    if (MS.prefs.get('toured', false) || MS.child) return;
    MS.toast('New here? Help › Quick tour shows you around in 2 minutes.', '', 7000);
  }, 1500);
})(window.MS);
