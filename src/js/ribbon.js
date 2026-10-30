/* Mothership's own PowerPoint-style ribbon, and keyboard shortcuts. */
(function (MS) {
  'use strict';
  var h = MS.h;
  function need(fn) { return function () { if (!MS.child) return MS.toast('Open a dashboard first.', 'warn'); return fn.apply(this, arguments); }; }
  function needRt(fn) { return need(function () { if (!MS.rt()) return MS.toast('This needs the dashboard\'s scripts. Turn off Safe mode (View tab).', 'warn'); return fn.apply(this, arguments); }); }
  function sel(fn) { return need(function () { if (!MS.sel) return MS.toast('Select something in the dashboard first.', 'warn'); return fn(MS.sel); }); }

  MS.cmd = {
    open: function () { MS.pickFiles('.html,.htm,.json,.js,.plugin,.md,.skill,.skills,.zip').then(function (f) { if (f[0]) MS.openFileObj(f[0]); }); },
    openFolder: function () { MS.pickFiles('', { folder: true }).then(function (fs) { if (fs.length) MS.openFolder(fs); }); },
    export: need(function () { MS.versions.exportFile(false); }),
    exportAs: need(function () { MS.versions.exportFile(true); }),
    saveVersion: need(MS.versions.savePrompt),
    versions: MS.versions.list,
    theme: function () { MS.ui.dialog(); }, palette: function () { MS.palette(); }, darkMode: function () { MS.ui.toggleDark(); },
    tour: function () { MS.help.tour(); }, tutorial: function () { MS.help.tutorial(); }, guide: function () { MS.help.guide(); }, newDoc: function () { MS.compose.newDoc(); },
    print: need(function () { MS.child.win.focus(); MS.child.win.print(); }),
    reload: need(function () { MS.reload(); }),
    close: function () { if (!MS.doc) return MS.toast('No dashboard is open.', 'warn'); MS.closeDoc(); },
    undo: function () { MS.history.undo(); }, redo: function () { MS.history.redo(); },
    copy: sel(function () { MS.clipboard.copy(false); }), cut: sel(function () { MS.clipboard.copy(true); }), paste: needRt(function () { MS.clipboard.paste(); }),
    pasteInside: needRt(function () { MS.clipboard.paste({ inside: true }); }),
    del: sel(function (el) { MS.blocks.remove(el); }),
    dup: sel(function (el) { MS.clipboard.duplicate(el); }),
    find: need(MS.edit.findReplace),
    present: needRt(function () { MS.present.start(false); }),
    presenter: needRt(function () { MS.present.start(true); }),
    safe: function () { MS.settings.safe = !MS.settings.safe; MS.toast(MS.settings.safe ? 'Safe mode on: dashboard scripts are blocked. Use it to inspect files you don\'t trust.' : 'Safe mode off.', 'ok'); if (MS.doc) MS.openHtml(MS.doc.source, MS.doc.name, { folder: MS.doc.folder, state: MS.doc.state, unlocked: true }); MS.ribbon.render(); },
    netLock: function () { MS.settings.netLock = !MS.settings.netLock; MS.prefs.set('netLock', MS.settings.netLock); MS.toast(MS.settings.netLock ? 'Network lock on: the dashboard can\'t load or send anything over the internet while editing. Online-only libraries (CDN) will not load.' : 'Network lock off.', 'ok', 7000); if (MS.child) MS.reload(); MS.ribbon.render(); }
  };

  MS.RIBBON = [
    { tab: 'File', groups: [
      { name: 'Open', items: [
        { icon: '✨', label: 'New', title: 'Start a new dashboard from scratch', run: function () { MS.compose.newDoc(); } },
        { icon: '📂', label: 'Open', title: 'Open a dashboard (.html), a Mothership export, a brand skill, a recipe (.json) or a plugin (Ctrl+O)', run: MS.cmd.open },
        { icon: '🗂', label: 'Open folder', title: 'Open a dashboard together with its scripts, styles, images and data files. Everything is bundled into one file.', run: MS.cmd.openFolder },
        { icon: '🧪', label: 'Samples', title: 'Open a sample dashboard', run: function (e) { MS.menu(e.currentTarget, MS.samples.menu()); } },
        { icon: '✕', label: 'Close', title: 'Close this dashboard and go back to the start screen. Asks first if there are changes you have not exported.', run: MS.cmd.close }] },
      { name: 'Save', items: [
        { icon: '⬇', label: 'Export HTML', title: 'Save the edited dashboard as one standalone .html file on this laptop (Ctrl+E)', run: MS.cmd.export },
        { icon: '📝', label: 'Save as…', title: 'Choose a new file name and location', run: MS.cmd.exportAs },
        { icon: '🕘', label: 'Save version', title: 'Keep a named version in this browser (Ctrl+S)', run: MS.cmd.saveVersion },
        { icon: '📚', label: 'Versions', title: 'Restore, download or delete versions', run: MS.cmd.versions },
        { icon: '⚖', label: 'Compare', title: 'What changed between two versions (or a file): tabs, text, charts, data. Side by side too.', run: function () { MS.compare.dialog(); } }] },
      { name: 'Publish', items: [
        { icon: '🛡', label: 'Ready to publish?', title: 'Check before sharing: script errors, empty charts, numbers that don\'t add up, open comments, internet files, size', run: need(function () { MS.preflight.dialog(); }) },
        { icon: '🚀', label: 'Publish', title: 'Save a view-only copy with a version number, date and release note. Optionally lock editing with a password; Mothership warns if it is changed afterwards.', run: needRt(function () { MS.publish.dialog(); }) }] },
      { name: 'Output', items: [
        { icon: '🖨', label: 'PDF', title: 'Client-ready PDF: one page per tab, with your firm header and footer. Choose "Save as PDF" in the print window.', run: needRt(function () { MS.deliver.print(); }) },
        { icon: '📊', label: 'PowerPoint', title: 'One slide per tab (or per story step) with editable titles. Charts and tables come as pictures.', run: needRt(function (e) { MS.deliver.menu(e.currentTarget); }) },
        { icon: '↻', label: 'Reload', title: 'Re-run the dashboard as it will look when exported', run: MS.cmd.reload }] }
    ] },
    { tab: 'Home', groups: [
      { name: 'History', items: [{ icon: '↶', label: 'Undo', title: 'Ctrl+Z', run: MS.cmd.undo, id: 'undo' }, { icon: '↷', label: 'Redo', title: 'Ctrl+Y', run: MS.cmd.redo, id: 'redo' }] },
      { name: 'Clipboard', items: [{ icon: '✂', label: 'Cut', title: 'Ctrl+X', run: MS.cmd.cut }, { icon: '⧉', label: 'Copy', title: 'Ctrl+C', run: MS.cmd.copy }, { icon: '📋', label: 'Paste', title: 'Paste after the selected part, or at the end of the page or tab (Ctrl+V). Pictures, Excel ranges and tables from other apps paste too.', run: MS.cmd.paste }, { icon: '📥', label: 'Paste inside', title: 'Paste inside the selected section, card or tab (Ctrl+Shift+V)', run: MS.cmd.pasteInside }, { icon: '⧉', label: 'Duplicate', title: 'Ctrl+D', run: MS.cmd.dup }, { icon: '🗑', label: 'Delete', title: 'Delete', run: MS.cmd.del }] },
      { name: 'Font', items: [{ type: 'font' }] },
      { name: 'Paragraph', items: [
        { icon: '⟸', label: 'Left', run: need(function () { MS.edit.format('justify', 'left'); }) },
        { icon: '≡', label: 'Centre', run: need(function () { MS.edit.format('justify', 'center'); }) },
        { icon: '⟹', label: 'Right', run: need(function () { MS.edit.format('justify', 'right'); }) }] },
      { name: 'Editing', items: [{ icon: '🔎', label: 'Replace', title: 'Find & replace text everywhere (Ctrl+F)', run: MS.cmd.find }, { icon: '⌫', label: 'Clear format', title: 'Remove formatting from the selection', run: need(function () { MS.edit.format('removeFormat'); }) }] }
    ] },
    { tab: 'Insert', groups: [
      { name: 'Tabs', items: [
        { icon: '▦', label: 'Chart tab', title: 'A new tab with a grid for charts', run: needRt(function () { MS.tabs.addPrompt('grid'); }) },
        { icon: '📄', label: 'Tab from file', title: 'How-to, FAQ, Methodology… from Markdown, Word, Excel, PowerPoint, PDF or images', run: needRt(MS.insert.fileTab) },
        { icon: '✍', label: 'Text tab', title: 'A blank text tab you can type in', run: needRt(function () { MS.tabs.addPrompt('content'); }) },
        { icon: '⤵', label: 'Into this tab', title: 'Add or replace the content of the current tab from a file', run: needRt(MS.insert.intoCurrent) }] },
      { name: 'Blocks', items: [
        { icon: '🅣', label: 'Text box', title: 'A block with a title and text', run: needRt(MS.insert.text) },
        { icon: '🖼', label: 'Image', title: 'Insert image(s) as blocks', run: needRt(MS.insert.image) },
        { icon: '📎', label: 'From file', title: 'Insert a document, table or slides as a block in the current tab', run: needRt(MS.insert.fileBlock) },
        { icon: '▤', label: 'Table', title: 'A table snapshot from a dataset', run: needRt(MS.insert.table) }] },
      { name: 'Page', items: [
        { icon: '🟦', label: 'Header', title: MS.compose.PARTS.banner.title, run: need(function () { MS.compose.part('banner'); }) },
        { icon: '▭', label: 'Section', title: MS.compose.PARTS.section.title, run: need(function () { MS.compose.part('section'); }) },
        { icon: '◫', label: 'Columns', title: 'Two or three columns of text side by side', run: need(function (e) { MS.menu(e.currentTarget, [{ label: '2 columns', run: function () { MS.compose.part('cols2'); } }, { label: '3 columns', run: function () { MS.compose.part('cols3'); } }]); }) },
        { icon: 'H', label: 'Heading', title: 'A heading', run: need(function () { MS.compose.part('heading'); }) },
        { icon: '¶', label: 'Paragraph', title: 'A paragraph of text', run: need(function () { MS.compose.part('para'); }) },
        { icon: '💡', label: 'Callout', title: MS.compose.PARTS.callout.title, run: need(function () { MS.compose.part('callout'); }) },
        { icon: '⋯', label: 'More', title: 'Divider, spacer, button link', run: need(function (e) { MS.menu(e.currentTarget, [{ label: '― Divider line', run: function () { MS.compose.part('divider'); } }, { label: '↕ Spacer', run: function () { MS.compose.part('spacer'); } }, { label: '🔗 Button link…', run: MS.compose.button }]); }) },
        { icon: '▁', label: 'Footer', title: 'A footer under every tab: source, owner, date, confidentiality', run: need(MS.compose.footer) }] },
      { name: 'Templates', items: [
        { icon: '⭐', label: 'Templates', title: 'Insert a saved chart, card, section or whole tab (yours or a starter), or save the selection for reuse in any dashboard', run: needRt(function () { MS.templates.gallery(); }) }] },
      { name: 'From data', items: [
        { icon: '📊', label: 'Chart', title: 'A new chart from a dataset. It follows the filter pane and can drill down.', run: needRt(MS.compose.chart) },
        { icon: '🔢', label: 'KPI cards', title: 'A row of headline numbers. With a dataset they follow the filter pane.', run: need(MS.compose.kpis) }] }
    ] },
    { tab: 'Layout', groups: [
      { name: 'Tabs', items: [
        { icon: '＋', label: 'Add tab', title: 'Add a tab. If your dashboard already has its own tabs, the new tab joins them.', run: needRt(MS.tabs.addPrompt) },
        { icon: '🗂', label: 'Tab ribbon', title: 'Mothership tab ribbon: split a one-page dashboard into tabs with a ribbon (or back to one page). Not needed if your dashboard already has its own tabs.', run: needRt(MS.tabs.toggleLayout) }] },
      { name: 'Dashboard ribbon', items: [
        { icon: '⬒', label: 'Top', title: 'Ribbon across the top', run: needRt(function () { MS.tabs.ensureLayout() && MS.history.state('Ribbon on top', function (s) { s.layout.ribbon.position = 'top'; s.layout.ribbon.height = 46; }); }) },
        { icon: '◧', label: 'Left', title: 'Ribbon down the left side', run: needRt(function () { MS.tabs.ensureLayout() && MS.history.state('Ribbon on left', function (s) { s.layout.ribbon.position = 'left'; s.layout.ribbon.height = 200; }); }) },
        { icon: '↕', label: 'Size', title: 'Set the ribbon height (or width when on the left). You can also drag its edge.', run: needRt(function () {
          var L = MS.rt().state.layout.ribbon;
          MS.prompt('Ribbon ' + (L.position === 'left' ? 'width' : 'height') + ' (px)', String(L.height)).then(function (v) { if (v && +v > 20) MS.history.state('Ribbon size', function (s) { s.layout.ribbon.height = +v; }); });
        }) },
        { icon: '🏷', label: 'Title', title: 'Text shown at the start of the ribbon (e.g. the dashboard name)', run: needRt(function () {
          MS.prompt('Ribbon title', MS.rt().state.layout.ribbon.brand || '').then(function (v) { if (v !== null) MS.history.state('Ribbon title', function (s) { s.layout.ribbon.brand = v; }); });
        }) }] },
      { name: 'Charts', items: [
        { icon: '✎', label: 'Commentary', title: 'Give every chart a title, subtitle and inference above the visual', run: needRt(MS.blocks.wrapAll) }] },
      { name: 'Filters', items: [
        { icon: '⚲', label: 'Filter pane', title: 'Design the filter pane', run: needRt(MS.data.filters) },
        { icon: '◫', label: 'Show / hide', title: 'Show or hide the filter pane', run: needRt(function () { MS.history.state('Toggle filter pane', function (s) { s.layout.pane.visible = !s.layout.pane.visible; }); }) }] }
    ] },
    { tab: 'Design', groups: [
      { name: 'Brand', items: [
        { icon: '🎨', label: 'Load brand', title: 'Load brand guidelines from a skill file (SKILL.md, .skill/.zip, or theme .json)', run: needRt(function () { MS.pickFiles('.md,.markdown,.skill,.skills,.zip,.json,.txt').then(function (f) { if (f[0]) MS.brand.loadFile(f[0]); }); }) },
        { icon: '🖌', label: 'Edit theme', title: 'Colours, chart palette, fonts, logo', run: needRt(MS.brand.edit) },
        { icon: '📚', label: 'Library', title: 'Brands you have used before', run: needRt(MS.brand.library) },
        { icon: '🔤', label: 'Fonts', title: 'Upload brand font files (.woff2/.woff/.ttf/.otf). They are embedded, so they work offline.', run: needRt(function () { MS.pickFiles('.woff,.woff2,.ttf,.otf', { multiple: true }).then(function (fs) { if (fs.length) MS.brand.addFontFiles(fs); }); }) }] },
      { name: 'Numbers', items: [
        { icon: '🌍', label: 'Region & currency', title: 'Country, currency and number style (US $ by default) for pop-ups, axes, KPI cards and summaries', run: needRt(function () { MS.locale.dialog(); }) }] },
      { name: 'Check', items: [
        { icon: '✅', label: 'Brand check', title: 'Find off-brand colours and fonts, low contrast, and charts missing commentary', run: need(MS.brand.check) }] }
    ] },
    { tab: 'Charts', groups: [
      { name: 'Selected chart', items: [
        { icon: '⚙', label: 'Settings', title: 'Commentary, size, tooltip, data & drill-down for the selected chart', run: needRt(function () { MS.charts.settings(); }) },
        { icon: '💬', label: 'Tooltip', title: 'What the hover pop-up shows', run: needRt(function () { MS.charts.settings(null, 'Tooltip'); }) },
        { icon: '⤓', label: 'Drill-down', title: 'Bind to data and choose what double-click does', run: needRt(function () { MS.charts.settings(null, 'Data & drill-down'); }) },
        { icon: '🎨', label: 'Look', title: 'Fonts, text colour, legend and hover pop-up style for the selected chart', run: needRt(function () { MS.charts.settings(null, 'Look'); }) },
        { icon: '✎', label: 'Commentary', title: 'Add a title / subtitle / inference header', run: sel(function (el) { MS.edit.select(MS.blocks.wrap(el, true)); }) }] },
      { name: 'Data, legend, size', items: [
        { icon: '⛁', label: 'Chart data', title: 'Give the selected chart its own numbers: upload CSV or Excel, paste from Excel, or type them', run: needRt(function () { MS.chartKit.dataDialog(); }) },
        { icon: '🔑', label: 'Legend', title: 'Show the legend at the top, bottom, left or right, or hide it', run: needRt(function (e) { var k = MS.charts.requireKey(); if (k) MS.menu(e.currentTarget, MS.chartKit.legendItems(k)); }) },
        { icon: '⤢', label: 'Size', title: 'Width and height of the selected chart. Or drag the round handle at its corner.', run: sel(function (el) { MS.chartKit.sizeDialog(el); }) }] },
      { name: 'Consistency', items: [
        { icon: '🖌', label: 'Format painter', title: 'Copy the selected chart\'s look, category colours and order onto other charts', run: needRt(function () { MS.painter.copy(); }) },
        { icon: '⇅', label: 'Category order', title: 'One order (e.g. North, South, East, West) on every chart that shows those categories', run: needRt(function () { MS.order.dialog(MS.charts.selectedKey()); }) },
        { icon: '🎨', label: 'Category colours', title: 'Give each category or series one colour on every chart', run: needRt(MS.catColors.dialog) }] },
      { name: 'Share', items: [
        { icon: '🖼', label: 'Copy picture', title: 'Copy the selected chart (with its title, notes and shapes) as a picture to paste into PowerPoint, Word, Outlook or Teams (Ctrl+Shift+C)', run: sel(function (el) { MS.picture.copy(el); }) },
        { icon: '⬇', label: 'Save picture', title: 'Save the selected chart as a PNG', run: sel(function (el) { MS.picture.save(el); }) },
        { icon: '⬇', label: 'Chart data', title: 'Save the numbers in the selected chart as CSV (opens in Excel)', run: needRt(function () { MS.chartOut.data(); }) },
        { icon: '📰', label: 'Summaries', title: 'A plain-English summary of every chart: for emails, captions and screen readers', run: needRt(function () { MS.summaries.dialog(); }) }] },
      { name: 'All charts', items: [
        { icon: '💬', label: 'Tooltips', title: 'Set one tooltip format for every chart', run: needRt(MS.charts.tooltipAll) },
        { icon: '🎨', label: 'Look', title: 'One font, legend and pop-up style for every chart', run: needRt(function () {
          var st = null, ed = MS.charts.styleEditor(null, function (v) { st = v; });
          MS.dialog({ title: 'Same look for every chart', body: ed, buttons: [{ label: 'Cancel', value: null }, { label: 'Apply to all', primary: true, value: 'ok' }] }).then(function (v) { if (v) MS.charts.styleAll(st); });
        }) },
        { icon: '✎', label: 'Commentary', title: 'Add commentary headers to every chart', run: needRt(MS.blocks.wrapAll) }] }
    ] },
    { tab: 'Consulting', groups: [
      { name: 'Firm', items: [
        { icon: '🏢', label: 'Firm template', title: 'Your firm\'s logo, fonts, palette and disclaimer, locked so dashboards stay on brand. Share it as a .firm.json file.', run: needRt(function () { MS.firm.dialog(); }), toggle: function () { return MS.firm.locked(); } },
        { icon: '🔒', label: 'Confidential', title: 'Mark as "Client confidential": a watermark on every page and a label in the footer', run: needRt(function () { MS.confidential.toggle(); }), toggle: function () { var c = MS.confidential.get(); return !!(c && c.on); } },
        { icon: '🕶', label: 'Remove names', title: 'Take client and people names out of the text, charts, data and comments (or save a cleaned copy)', run: need(function () { MS.confidential.scrubDialog(); }) }] },
      { name: 'Draw on chart', items: [
        { icon: '↗', label: 'Growth (CAGR)', title: 'An arrow over the bars from one period to another, labelled with the compound annual growth rate', run: needRt(function () { MS.shapes.start('cagr'); }) },
        { icon: '⊓', label: 'Difference', title: 'A bracket between two bars, labelled with the change, e.g. +$1.2M (+15%)', run: needRt(function () { MS.shapes.start('delta'); }) },
        { icon: '➝', label: 'Arrow', title: 'Drag on a chart to draw an arrow (hold Shift for straight)', run: needRt(function () { MS.shapes.start('arrow'); }) },
        { icon: '▭', label: 'Box', title: 'Drag on a chart to put a box around something', run: needRt(function () { MS.shapes.start('rect'); }) },
        { icon: '◯', label: 'Circle', title: 'Drag on a chart to circle a point or bar', run: needRt(function () { MS.shapes.start('ellipse'); }) },
        { icon: '💬', label: 'Callout', title: 'A text box with a line to the spot it is about', run: needRt(function () { MS.shapes.start('callout'); }) },
        { icon: '⋯', label: 'More', title: 'Line, double arrow, text', run: needRt(function (e) { MS.menu(e.currentTarget, MS.shapes.menuItems(MS.charts.selectedKey())); }) }] },
      { name: 'Notes', items: [
        { icon: '📌', label: 'Annotate', title: 'Pin a callout, arrow or "so what" box to a point on the selected chart (or right-click the point)', run: needRt(function () { var k = MS.charts.requireKey(); if (k) MS.annotate.manage(k); }) },
        { icon: '🧾', label: 'Source', title: 'Source and "data as of" date shown under the selected chart', run: needRt(function () { var k = MS.charts.requireKey(); if (k) MS.sources.dialog(k); }) },
        { icon: '📑', label: 'Footnotes', title: 'A "Notes and sources" block listing every chart\'s source and your disclaimer', run: needRt(function () { MS.sources.insertFootnotes(); }) }] },
      { name: 'Story', items: [
        { icon: '🎬', label: 'Storyline', title: 'Step through charts like slides, each with a headline. The exported file gets a "Play the story" button.', run: needRt(function () { MS.story.dialog(); }) },
        { icon: '▶', label: 'Play', title: 'Play the storyline full screen', run: needRt(function () { if (MS.story.steps().length) MS.story.play(0, true); else MS.story.dialog(); }) }] },
      { name: 'Quality', items: [
        { icon: '🏷', label: 'Stage', title: 'Draft, In review or Client-ready: a stamp on the dashboard (none on client-ready). Warns about open comments first.', run: needRt(function (e) { MS.menu(e.currentTarget, MS.stage.menuItems()); }) },
        { icon: '👁', label: 'Colour-blind', title: 'Check that chart colours can be told apart by colour-blind readers, and preview the dashboard as they see it', run: needRt(function () { MS.a11y.cvdDialog(); }) },
        { icon: '🧮', label: 'Number check', title: 'Do the KPI cards match the chart totals?', run: function () { MS.numcheck.dialog(); } },
        { icon: '🕘', label: 'Change log', title: 'Who changed what and when, saved inside the file', run: need(function () { MS.audit.dialog(); }) }] },
      { name: 'Deliver', items: [
        { icon: '🖨', label: 'PDF', title: 'Client-ready PDF: one page per tab, with your firm header and footer', run: needRt(function () { MS.deliver.print(); }) },
        { icon: '📊', label: 'PowerPoint', title: 'One slide per tab (or per story step) with editable titles', run: needRt(function (e) { MS.deliver.menu(e.currentTarget); }) },
        { icon: '🖼', label: 'Copy picture', title: 'Copy the selected chart or part as a picture (Ctrl+Shift+C)', run: sel(function (el) { MS.picture.copy(el); }) }] }
    ] },
    { tab: 'Data', groups: [
      { name: 'Datasets', items: [
        { icon: '🔍', label: 'Find data', title: 'Find tables of data inside the dashboard\'s scripts', run: needRt(MS.data.discover) },
        { icon: '⛁', label: 'Load data', title: 'Load JSON, CSV or Excel as a dataset', run: needRt(MS.data.loadFile) },
        { icon: '↻', label: 'Refresh', title: 'Re-read this month\'s CSV / Excel files for every dataset in one go, then export. Mothership remembers the files where the browser allows it.', run: needRt(MS.data.refreshAll) },
        { icon: '☰', label: 'Manage', title: 'View, download, refresh or remove datasets', run: needRt(MS.data.manage) }] },
      { name: 'Tables', items: [
        { icon: '🎨', label: 'Colour rules', title: 'Colour a table\'s cells by value: red / amber / green, colour scale, data bars, top N (select a table first)', run: needRt(function () { MS.tables.rulesDialog(); }) }] },
      { name: 'Drill-down', items: [
        { icon: '⤓', label: 'Drill-down data', title: 'Load an Excel, CSV or Markdown file with the detail behind your charts. It is embedded and linked, so double-click works offline.', run: needRt(MS.drillData.load) },
        { icon: '📝', label: 'Template', title: 'Save a CSV template for the selected chart to fill in with deeper levels', run: needRt(function () { MS.chartOut.template(); }) }] },
      { name: 'Filters', items: [{ icon: '⚲', label: 'Filter pane', title: 'Design the filter pane', run: needRt(MS.data.filters) }] }
    ] },
    { tab: 'View', groups: [
      { name: 'Present', items: [
        { icon: '▶', label: 'Present', title: 'Full screen, tab by tab (F5)', run: MS.cmd.present },
        { icon: '🗒', label: 'Presenter view', title: 'Present with a separate window for notes, timer and next tab', run: MS.cmd.presenter }] },
      { name: 'Zoom', items: [
        { icon: '⤢', label: 'Fit', title: 'Fit the whole width of the dashboard in the window', run: function () { MS.view.setZoom('fit'); } },
        { icon: '1:1', label: '100%', title: 'Actual size', run: function () { MS.view.setZoom(1); } },
        { icon: '＋', label: 'Zoom in', title: 'Ctrl + mouse wheel also zooms', run: function () { MS.view.step(1); } },
        { icon: '－', label: 'Zoom out', run: function () { MS.view.step(-1); } }] },
      { name: 'Draw at', items: [
        { icon: '🖥', label: 'Auto', title: 'Draw at a desktop width (1280 px or more) and scale to fit, so the layout never gets squashed', run: function () { MS.view.setWidth('auto'); }, toggle: function () { return MS.view.width === 'auto'; } },
        { icon: '💻', label: 'Laptop', title: '1366 px wide', run: function () { MS.view.setWidth(1366); }, toggle: function () { return MS.view.width === 1366; } },
        { icon: '📱', label: 'Tablet', title: '820 px wide', run: function () { MS.view.setWidth(820); }, toggle: function () { return MS.view.width === 820; } },
        { icon: '📱', label: 'Phone', title: '390 px wide', run: function () { MS.view.setWidth(390); }, toggle: function () { return MS.view.width === 390; } },
        { icon: '⋯', label: 'Other', title: 'Full HD, 1440 px or the panel width', run: function (e) { MS.view.menu(e.currentTarget); } }] },
      { name: 'Panels', items: [
        { icon: '◧', label: 'Outline', run: function () { document.body.classList.toggle('no-left'); } },
        { icon: '◨', label: 'Inspector', run: function () { document.body.classList.toggle('no-right'); } },
        { icon: '⠿', label: 'Toolbar', title: 'The small toolbar that floats above what you select (move, draw, picture, duplicate, delete)', run: function () { MS.move.toggleBar(); MS.ribbon.render(); }, toggle: function () { return MS.move.barOn; } }] },
      { name: 'Mothership', items: [
        { icon: '🎨', label: 'Theme', title: 'Mothership\'s own look: light or dark, accent colour, spacing and text size', run: MS.cmd.theme },
        { icon: '🌙', label: 'Dark mode', title: 'Switch Mothership between light and dark', run: function () { MS.cmd.darkMode(); MS.ribbon.render(); }, toggle: function () { return MS.ui.isDark(); } },
        { icon: '🔍', label: 'Search', title: 'Find any command, chart, tab or help topic (Ctrl+K)', run: MS.cmd.palette }] },
      { name: 'Safety', items: [
        { icon: '🛡', label: 'Safe mode', title: 'Open the dashboard with its scripts blocked (for files you don\'t trust)', run: MS.cmd.safe, toggle: function () { return MS.settings.safe; } },
        { icon: '🔒', label: 'Network lock', title: 'Block all internet access from the dashboard while editing', run: MS.cmd.netLock, toggle: function () { return MS.settings.netLock; } }] }
    ] },
    { tab: 'Review', groups: [
      { name: 'Comment', items: [
        { icon: '💬', label: 'New comment', title: 'Comment mode: click anything to comment on it, or drag a box around an area. Tabs still switch. Esc to stop.', run: function () { MS.review.start('element'); } },
        { icon: '⚡', label: 'What I did', title: 'Comment on what you just did: a filter, a drill-down, a pop-up. Use Interact mode first.', run: function () { MS.review.start('interaction'); } }] },
      { name: 'Comments', items: [
        { icon: '🗨', label: 'Comments pane', title: 'Every comment in one list, like PowerPoint: go to it, reply, resolve', run: function () { MS.review.showPane(!MS.review.paneOn); }, toggle: function () { return !!MS.review.paneOn; } },
        { icon: '📌', label: 'Pins', title: 'Show or hide the numbered comment pins on the dashboard', run: function () { MS.review.togglePins(); }, toggle: function () { return MS.review.showPins; } },
        { icon: '🗑', label: 'Clear all', title: 'Delete all comments (Ctrl+Z to undo)', run: function () { MS.review.clear(); } }] },
      { name: 'Tracker', items: [
        { icon: '📗', label: 'Excel tracker', title: 'Save every comment as an Excel sheet with tab, chart, status, owner and due date, for review meetings', run: function () { MS.tracker.exportFile(); } },
        { icon: '⬆', label: 'Update from tracker', title: 'Load the edited Excel tracker back: status, priority, owner, due date and notes', run: function () { MS.tracker.importFile(); } }] },
      { name: 'Check', items: [
        { icon: '🧮', label: 'Number check', title: 'Do the KPI cards match the chart totals? Do charts of the same measure add up alike?', run: function () { MS.numcheck.dialog(); } },
        { icon: '♿', label: 'Accessibility', title: 'Alt text for pictures, readable text colours, table headings, keyboard access. Most fixes are one click.', run: need(function () { MS.a11y.dialog(); }) }] },
      { name: 'Present', items: [
        { icon: '🗒', label: 'Notes from comments', title: 'Use comments as speaker notes in Presenter view: none, resolved ones (talking points), or all', run: needRt(function (e) { MS.present.notesMenu(e.currentTarget); }) }] },
      { name: 'AI prompt', items: [
        { icon: '✨', label: 'Make prompt', title: 'Turn every comment into one prompt you can paste into an AI assistant', run: function () { MS.review.prompt(); } }] }
    ] },
    { tab: 'Testing', groups: [
      { name: 'Plan', items: [
        { icon: '☑', label: 'Test cases', title: 'Plan, run and record tests of this dashboard: scenarios, steps, expected results and status', run: needRt(function () { MS.qa.dialog(); }) },
        { icon: '✨', label: 'Draft tests', title: 'Mothership writes test cases from the dashboard. Quick: about one per part. Full: every point, every drop-down choice, every drill-down, button, check box, table and tab at every width.', run: needRt(function (e) { MS.menu(e.currentTarget, MS.qa.deep.draftMenu()); }) },
        { icon: '🔢', label: 'Numbers', title: 'Lock in today\'s numbers, or import the figures from your source report, so "right numbers" tests run automatically', run: needRt(function (e) { MS.menu(e.currentTarget, MS.qa.deep.numbersMenu()); }) },
        { icon: '🎯', label: 'Coverage', title: 'Every part of the dashboard and the test cases that touch it', run: needRt(function () { MS.qa.deep.coverageDialog(); }) }] },
      { name: 'Run', items: [
        { icon: '▷', label: 'Run all', title: 'Run every test case while you watch: a pointer shows each click and hover, and a progress card shows the case, the step and the results so far. Steps to check by eye are marked "Needs a person".', run: needRt(function () { MS.qa.live.start(); }) },
        { icon: '↻', label: 'Rerun failed', title: 'Run only the cases that failed last time', run: needRt(function () { var f = MS.qa.failed(); if (!f.length) return MS.toast('No failed test cases.', 'ok'); MS.qa.live.start(f.map(function (x) { return x.id; })); }) },
        { icon: '🐞', label: 'Script errors', title: 'Script and console errors since the dashboard opened', run: needRt(function () { var e = MS.qa.drv.errors(false), all = e.scriptErrors.concat(e.consoleErrors); MS.toast(all.length ? all.length + ' error(s): ' + all.slice(0, 3).join(' · ') : 'No script errors since the dashboard opened.', all.length ? 'warn' : 'ok', 8000); }) }] },
      { name: 'Export', items: [
        { icon: '📝', label: 'Test document', title: 'A complete test document: purpose, scope, approach, test cases with steps and expected results, results, defect log, sign-off', run: needRt(function (e) { MS.menu(e.currentTarget, MS.qa.exportItems().slice(0, 4)); }) },
        { icon: '🤖', label: 'AI tester', title: 'Copy a prompt that has another AI test the dashboard, with or without the MCP server', run: needRt(function (e) { MS.menu(e.currentTarget, MS.qa.exportItems().slice(5, 7)); }) },
        { icon: '✨', label: 'Fix failures', title: 'A prompt built from the failed tests, for an AI assistant: find the cause, fix the dashboard or the test, and test again', run: needRt(function () { MS.qa.live.promptDialog(); }) },
        { icon: '🔌', label: 'Connect AI', title: 'Let an AI assistant drive the dashboard like Playwright (click, hover, type, check, screenshot) through the Mothership MCP server', run: function () { MS.help.guide('mcp'); } }] }
    ] },
    { tab: 'Plugins', groups: function () {
      var gs = [{ name: 'Manage', items: [
        { icon: '🧩', label: 'Load plugin', title: 'Install a plugin (.js or .plugin)', run: function () { MS.pickFiles('.js,.plugin,.zip,.json').then(function (f) { if (f[0]) MS.plugins.loadFile(f[0]); }); } },
        { icon: '📜', label: 'Run recipe', title: 'Run a recipe (.json) of edits: tabs, theme, tooltips, filters…', run: needRt(function () { MS.pickFiles('.json').then(function (f) { if (f[0]) MS.readFile(f[0]).then(function (t) { MS.plugins.runRecipe(JSON.parse(t), f[0].name); }); }); }) },
        { icon: '☰', label: 'Installed', run: MS.plugins.manage }] }];
      MS.plugins.registered.forEach(function (p) {
        if (p.buttons && p.buttons.length) gs.push({ name: p.name, items: p.buttons.map(function (b) { return { icon: b.icon || '⚡', label: b.label, title: b.title || p.description, run: function () { try { b.run(window.Mothership.api()); } catch (e) { MS.toast(p.name + ': ' + e.message, 'error'); } } }; }) });
      });
      return gs;
    } },
    { tab: 'Help', groups: [
      { name: 'Learn', items: [
        { icon: '🧭', label: 'Quick tour', title: 'A 2-minute tour of the screen', run: function () { MS.help.tour(); } },
        { icon: '🎓', label: 'Tutorial', title: 'Hands-on lessons with a sample dashboard. Each step shows you where to click.', run: function () { MS.help.tutorial(); } },
        { icon: '📖', label: 'User guide', title: 'How to do everything, searchable', run: function () { MS.help.guide(); } }] },
      { name: 'Reference', items: [
        { icon: '⌨', label: 'Shortcuts', run: function () { MS.help.guide('shortcuts'); } },
        { icon: '❓', label: 'Problems?', title: 'Fixes for common problems', run: function () { MS.help.guide('troubleshooting'); } },
        { icon: 'ℹ', label: 'About', run: function () { MS.help.about(); } }] }
    ] }
  ];

  var R = MS.ribbon = { active: MS.prefs.get('ribbonTab', 'Home') };
  R.render = function () {
    var tabsEl = MS.$('#ribbon-tabs'), body = MS.$('#ribbon-body');
    tabsEl.innerHTML = ''; body.innerHTML = '';
    MS.RIBBON.forEach(function (t) {
      tabsEl.appendChild(h('button', { 'class': 'rtab' + (t.tab === R.active ? ' on' : ''), onclick: function () { R.active = t.tab; MS.prefs.set('ribbonTab', t.tab); R.render(); } }, [t.tab]));
    });
    var tab = MS.RIBBON.filter(function (t) { return t.tab === R.active; })[0] || MS.RIBBON[1];
    var groups = typeof tab.groups === 'function' ? tab.groups() : tab.groups;
    groups.forEach(function (g) {
      var items = h('div', { 'class': 'rgroup-items' });
      g.items.forEach(function (it) {
        if (it.type === 'font') return items.appendChild(fontControls());
        var b = h('button', { 'class': 'rbtn' + (it.toggle && it.toggle() ? ' on' : ''), title: it.title || it.label, 'data-id': it.id || '' }, [h('span', { 'class': 'ri' }, [MS.icon.has(it.icon) ? MS.icon(it.icon, 'solo') : it.icon]), h('span', { 'class': 'rl', text: it.label })]);
        b.addEventListener('click', function (e) { it.run(e); });
        items.appendChild(b);
      });
      body.appendChild(h('div', { 'class': 'rgroup' }, [items, h('div', { 'class': 'rgroup-name', text: g.name })]));
    });
    R.sync();
  };
  function fontControls() {
    var fam = h('select', { 'class': 'inp sm', title: 'Font', id: 'rb-font' }, MS.fonts.list().map(function (f) { return h('option', { value: f, text: f }); }));
    // with a chart selected, the font box styles the chart's own text (axes, legend, pop-up)
    var chartSel = function () { return MS.sel && MS.mode === 'edit' && !MS.editingText && MS.charts.selectedKey(); };
    fam.addEventListener('change', need(function () { var k = chartSel(); if (k) return MS.charts.setStyle(k, { font: fam.value }, 'Chart font'); MS.edit.format('fontName', /\s/.test(fam.value) ? '"' + fam.value + '"' : fam.value); }));
    var size = h('input', { 'class': 'inp sm', type: 'number', min: 6, max: 200, title: 'Font size (px)', id: 'rb-size', style: { width: '58px' } });
    size.addEventListener('change', need(function () { var k = chartSel(); if (k) return MS.charts.setStyle(k, { size: +size.value }, 'Chart text size'); if (MS.sel) MS.edit.style(MS.sel, { fontSize: size.value + 'px' }, 'Font size'); }));
    var color = h('input', { type: 'color', title: 'Text colour', id: 'rb-color' });
    color.addEventListener('change', need(function () { var k = chartSel(); if (k) return MS.charts.setStyle(k, { color: color.value }, 'Chart text colour'); MS.edit.format('foreColor', color.value); }));
    var hi = h('input', { type: 'color', title: 'Highlight / fill', value: '#fff59d' });
    hi.addEventListener('change', need(function () { MS.edit.format('hiliteColor', hi.value); }));
    var mk = function (lbl, cmd, title, style) { var b = h('button', { 'class': 'fbtn', title: title, style: style }, [lbl]); b.addEventListener('mousedown', function (e) { e.preventDefault(); }); b.addEventListener('click', need(function () { MS.edit.format(cmd); })); return b; };
    return h('div', { 'class': 'fontctl' }, [h('div', { 'class': 'row gap' }, [fam, size]), h('div', { 'class': 'row gap' }, [
      mk('B', 'bold', 'Bold (Ctrl+B)', { fontWeight: '700' }), mk('I', 'italic', 'Italic (Ctrl+I)', { fontStyle: 'italic' }), mk('U', 'underline', 'Underline (Ctrl+U)', { textDecoration: 'underline' }),
      h('label', { 'class': 'colorbtn', title: 'Text colour' }, ['A', color]), h('label', { 'class': 'colorbtn hi', title: 'Highlight' }, ['▮', hi])])]);
  }
  R.sync = function () {
    var u = MS.$('[data-id="undo"]'), r = MS.$('[data-id="redo"]');
    if (u) u.disabled = !MS.history.canUndo();
    if (r) r.disabled = !MS.history.canRedo();
    var el = MS.sel, f = MS.$('#rb-font'), s = MS.$('#rb-size'), c = MS.$('#rb-color');
    if (el && MS.child && f) {
      var cs = MS.child.win.getComputedStyle(el), fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
      if (!Array.prototype.some.call(f.options, function (o) { return o.value === fam; })) f.insertBefore(h('option', { value: fam, text: fam }), f.firstChild);
      f.value = fam; s.value = Math.round(parseFloat(cs.fontSize));
      var rgb = MS.brand.hexToRgb(cs.color); if (rgb) c.value = MS.brand.toHex(rgb);
    }
  };
  MS.on('selection', R.sync); MS.on('changed', R.sync); MS.on('history', R.sync);
  MS.on('plugins', function () { if (R.active === 'Plugins') R.render(); });
  MS.on('theme', R.render); MS.on('fonts', R.render);

  /* ---------------------------------------------------------- keyboard */
  MS.handleKey = function (e, fromChild) {
    if (e.key === 'Escape' && MS.review.picking) { e.preventDefault(); return MS.review.cancel(); }
    if (MS.present.key(e)) return;
    var t = e.target, typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    var mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (MS.$('.dlg-wrap') && !fromChild) return;
    if (mod && (k === 'k' || (k === 'p' && e.shiftKey))) { e.preventDefault(); return MS.palette(); }
    if (mod && k === 's') { e.preventDefault(); return MS.cmd.saveVersion(); }
    if (mod && k === 'e') { e.preventDefault(); return e.shiftKey ? MS.cmd.exportAs() : MS.cmd.export(); }
    if (mod && k === 'o') { e.preventDefault(); return MS.cmd.open(); }
    if (e.key === 'F5') { e.preventDefault(); return MS.cmd.present(); }
    if (typing) return;
    if (e.altKey && !mod && /^Digit[123]$/.test(e.code || '')) { e.preventDefault(); return MS.appbar.cycle(+e.code.slice(5) - 1); }
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); return MS.history.undo(); }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); return MS.history.redo(); }
    if (mod && k === 'f') { e.preventDefault(); return MS.cmd.find(); }
    if (!MS.child || MS.mode !== 'edit') return;
    // the browser's own copy / cut / paste events do the work (they carry pictures and Excel ranges); see clipboard.js
    if (mod && k === 'c' && e.shiftKey) { e.preventDefault(); if (MS.sel) MS.picture.copy(MS.sel); return; }
    if (mod && (k === 'c' || k === 'x') && !e.shiftKey) { if (MS.sel) MS.clipboard.key(k, false); return; }
    if (mod && k === 'v') { MS.clipboard.key('v', e.shiftKey); return; }
    if (mod && k === 'd') { e.preventDefault(); return MS.cmd.dup(); }
    if (mod && (k === 'b' || k === 'i' || k === 'u')) { e.preventDefault(); return MS.edit.format({ b: 'bold', i: 'italic', u: 'underline' }[k]); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && MS.sel) { e.preventDefault(); return MS.cmd.del(); }
    if (e.key === 'Escape') return MS.edit.select(null);
    if (e.altKey && e.key === 'ArrowUp' && MS.sel && MS.sel.parentElement && !/^(BODY|HTML)$/.test(MS.sel.parentElement.tagName)) { e.preventDefault(); return MS.edit.select(MS.sel.parentElement); }
    if (e.key === 'Enter' && MS.sel && MS.edit.textEditable(MS.sel)) { e.preventDefault(); return MS.edit.startText(MS.sel); }
    if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && MS.rt()) { e.preventDefault(); MS.rt().step(e.key === 'ArrowRight' ? 1 : -1); MS.emit('structure'); }
  };
})(window.MS);
