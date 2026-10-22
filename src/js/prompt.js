/* The prompt builder: turns review comments into instructions for an AI assistant.
   It says exactly where each comment is (tab › section › card › chart › data point),
   and changes its wording to match what you pick: which comments, the goal, the kind of
   assistant (chat, coding agent, or one connected to Mothership over MCP), and the answer format. */
(function (MS) {
  'use strict';
  var h = MS.h, R = MS.review;
  function rt() { return MS.rt(); }
  function clip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function q(s) { return '“' + s + '”'; }
  var LIB = { chartjs: 'Chart.js', echarts: 'ECharts', plotly: 'Plotly', highcharts: 'Highcharts', d3: 'D3 (SVG)' };

  /* ---------------------------------------------------------- where is this element? */
  var CARDISH = /(^|[-_ ])(card|panel|tile|widget|box|kpi|metric|chart-?wrap|chart-?box|chart-?container|ms-block)([-_ ]|$)/i;
  function visible(n) { return n && n.offsetParent !== null; }
  function headingIn(box, not) {
    var hs = box.querySelectorAll('h1,h2,h3,h4,h5,.ms-title,[class*="title"]');
    for (var i = 0; i < hs.length; i++) {
      var x = hs[i]; if (x === not || x.contains(not) || !x.textContent.trim() || x.closest('svg')) continue;
      if (x.closest('.ms-kpis') && !box.classList.contains('ms-kpi')) continue;
      return clip(x.textContent, 70);
    }
    return '';
  }
  function cardOf(el) {
    var b = el.closest('.ms-block'); if (b) return b;
    for (var n = el, i = 0; n && n.nodeType === 1 && i < 7; n = n.parentElement, i++) {
      if (/^(BODY|HTML|MAIN|SECTION)$/.test(n.tagName) && !CARDISH.test(n.className || '')) continue;
      if (CARDISH.test(typeof n.className === 'string' ? n.className : '') && n !== el) return n;
    }
    return null;
  }
  function sectionOf(el) {
    var s = el.closest('.ms-section');
    if (s) { var hh = s.querySelector('h2'); if (hh && hh.textContent.trim()) return clip(hh.textContent, 60); }
    var scope = el.closest('section.ms-tab') || el.ownerDocument.body, best = null;
    Array.prototype.forEach.call(scope.querySelectorAll('h2,[class*="section-title"],[class*="section-head"]'), function (hd) {
      if (hd === el || hd.contains(el) || el.contains(hd) || !visible(hd)) return;
      if (!(hd.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
      if (cardOf(hd)) return;               // a card's own title, not a section heading
      best = hd;
    });
    return best ? clip(best.textContent, 60) : '';
  }
  function positionOf(el) {
    try {
      var d = el.ownerDocument, w = d.defaultView, b = el.getBoundingClientRect();
      var W = Math.max(d.documentElement.scrollWidth, 1), H = Math.max(d.documentElement.scrollHeight, 1);
      var cx = (b.left + w.scrollX + b.width / 2) / W, cy = (b.top + w.scrollY + b.height / 2) / H;
      if (b.width > W * 0.8) return cy < 0.2 ? 'full width, at the top' : cy > 0.8 ? 'full width, at the bottom' : 'full width';
      return (cy < 0.33 ? 'upper' : cy > 0.66 ? 'lower' : 'middle') + ' ' + (cx < 0.36 ? 'left' : cx > 0.64 ? 'right' : 'centre') + ' of the page';
    } catch (e) { return ''; }
  }
  function chartNear(el) {
    var r = rt(); if (!r) return null;
    var c = r.chartOf(el);
    if (!c) { var inside = r.charts().filter(function (x) { return el.contains(x.el); }); if (inside.length === 1) c = inside[0]; }
    if (!c) return null;
    var info = r.chartInfo(c.key) || {};
    return { key: c.key, name: MS.charts.nameOf(c.key), kind: MS.charts.kindName(info.type).toLowerCase(), lib: LIB[c.lib] || c.lib, id: c.el.id || (c.el.querySelector('canvas[id],div[id]') || {}).id || '', labels: (info.labels || []).slice(0, 12), series: (info.series || []).filter(Boolean) };
  }
  R.locate = function (el) {
    if (!el || !el.closest) return {};
    var t = R.tabOf(el), card = cardOf(el), chart = chartNear(el), kpi = el.closest('.ms-kpi');
    var loc = { tab: t ? t.title : '', section: sectionOf(el), card: card ? headingIn(card, el) : '', chart: chart, item: R.describe(el).what, position: positionOf(el) };
    if (kpi) { var ks = MS.$$('.ms-kpi', kpi.parentElement); loc.kpi = { label: clip((kpi.querySelector('.ms-kpi-label') || {}).textContent, 40), index: ks.indexOf(kpi) + 1, of: ks.length }; }
    else if (card && /kpi|metric|stat|tile|score/i.test(card.className || '') && !chart) {
      var cls = String(card.className).split(/\s+/)[0], sibs = cls ? MS.$$(':scope > .' + cls, card.parentElement) : [card];
      var lab = card.querySelector('[class*="label"],[class*="title"],[class*="name"],h3,h4,h5,small') || card.firstElementChild;
      loc.kpi = { label: clip(lab ? lab.textContent : card.textContent, 40), index: sibs.indexOf(card) + 1, of: sibs.length }; loc.card = '';
    }
    if (el.closest('.ms-page-footer')) loc.footer = true;
    if (el.closest('#ms-filter-pane')) loc.filters = true;
    return loc;
  };
  R.locateArea = function (r, seen) {
    var tabs = {}, secs = [], charts = [];
    (seen || []).forEach(function (n) {
      var l = R.locate(n); if (l.tab) tabs[l.tab] = 1;
      if (l.section && secs.indexOf(l.section) < 0) secs.push(l.section);
      if (l.chart && charts.indexOf(l.chart.name) < 0) charts.push(l.chart.name);
    });
    var t = R.tabOf(null);
    return { tab: Object.keys(tabs)[0] || (t ? t.title : ''), sections: secs, charts: charts };
  };
  R.trail = function (loc) {
    var p = [];
    if (loc.tab) p.push('Tab ' + q(loc.tab));
    if (loc.footer) p.push('page footer');
    else if (loc.filters) p.push('filter pane');
    if (loc.section) p.push('Section ' + q(loc.section));
    if (loc.sections && loc.sections.length) p.push('Section' + (loc.sections.length > 1 ? 's ' : ' ') + loc.sections.map(q).join(', '));
    if (loc.card && !(loc.chart && loc.card === loc.chart.name)) p.push('Card ' + q(loc.card));
    if (loc.chart) p.push('Chart ' + q(loc.chart.name) + ' (' + loc.chart.kind + ')');
    if (loc.kpi) p.push('KPI card ' + q(loc.kpi.label) + ' (' + loc.kpi.index + ' of ' + loc.kpi.of + ')');
    return p.join(' › ') || 'the page';
  };

  /* ---------------------------------------------------------- one comment, fully resolved */
  var PRIO = { must: 'Must fix', should: 'Should fix', nice: 'Nice to have' }, PRANK = { must: 0, should: 1, nice: 2 };
  var TYPE = { change: 'Change', bug: 'Bug', question: 'Question', idea: 'Idea' };
  // what kind of change the words suggest, so the assistant (or Mothership) knows where to look
  var TOPICS = [
    { re: /colou?r|palette|green|red|blue|amber|brand|theme|dark|light/i, id: 'colour', tool: 'category_colors / chart_settings.look / set_style', ui: 'Charts › Category colours, or the Format panel', done: 'the new colours show everywhere this item appears, with readable contrast' },
    { re: /font|bold|italic|size|bigger|smaller|text size|typeface/i, id: 'type', tool: 'set_style / chart_settings.look', ui: 'Home › Font, or Charts › Look', done: 'the text uses the requested font/size and still fits without overlapping' },
    { re: /order|sort|rank|first|last|sequence|arrange/i, id: 'order', tool: 'category_order', ui: 'Charts › Category order', done: 'the categories appear in the requested order on every chart that shows them' },
    { re: /tool ?tip|pop-?up|hover/i, id: 'tooltip', tool: 'chart_settings.tooltip / tooltip_all / set_popup', ui: 'Charts › Tooltip', done: 'hovering shows the requested text in Indian number formats' },
    { re: /drill|double.?click|break ?down|deeper|detail/i, id: 'drill', tool: 'link_chart_data / chart_settings.data / drill_data_file', ui: 'Charts › Drill-down', done: 'double-clicking goes to the requested level and the breadcrumb leads back up' },
    { re: /₹|crore|lakh|\bcr\b|format|decimal|percent|%|comma|million|units?/i, id: 'number', tool: 'chart_settings.look.axisFormat / chart_settings.tooltip', ui: 'Charts › Look › Axis numbers', done: 'numbers read in the requested format (e.g. ₹1.23 Cr) on axes, labels and pop-ups' },
    { re: /title|subtitle|heading|label|wording|rename|typo|spelling|text|say|insight|inference|so what/i, id: 'words', tool: 'set_text / chart_settings.title / replace_text', ui: 'double-click the text', done: 'the new wording appears exactly where the comment points' },
    { re: /filter|slicer|drop-?down|select/i, id: 'filter', tool: 'filter_pane / set_filter', ui: 'Layout › Filter pane', done: 'every chart and KPI card follows the filter' },
    { re: /legend|axis|grid ?line|scale|bar|line chart|pie|donut|doughnut|stack|chart type|switch to/i, id: 'chart', tool: 'chart_settings', ui: 'double-click the chart', done: 'the chart shows the requested form and the numbers are unchanged' },
    { re: /space|gap|padding|align|layout|move|wider|narrower|height|width|squash|crowd|white ?space/i, id: 'layout', tool: 'resize_block / move_element / set_style', ui: 'drag the block, or the Format panel › Box', done: 'the layout looks balanced at 1280 px and on a laptop (1366 px)' },
    { re: /tab|page|section|footer|header|new chart|add (a|an)|kpi/i, id: 'structure', tool: 'add_tab / insert_part / insert_chart / insert_kpis', ui: 'Insert tab', done: 'the new part exists in the right place and works offline' }
  ];
  function topicsOf(text) { return TOPICS.filter(function (t) { return t.re.test(text || ''); }).slice(0, 3); }

  function resolve(c, n) {
    var loc = c.loc ? JSON.parse(JSON.stringify(c.loc)) : null, el = null;
    if (c.kind === 'element' && c.target) {
      el = R.findRef(c.target.ref);
      if (el) loc = R.locate(el);   // fresh: titles may have changed since the comment was made
      if (!loc) loc = { tab: c.tab && c.tab.title, section: c.target.section, chart: c.target.chart ? { name: c.target.chart.name, kind: String(c.target.chart.kind || '').toLowerCase(), lib: LIB[c.target.chart.lib] || '', labels: c.target.chart.labels, series: c.target.chart.series } : null, item: c.target.what };
      if (!loc.item) loc.item = c.target.what;
    } else if (c.kind === 'area') {
      loc = loc || { tab: c.tab && c.tab.title, sections: [], charts: [] };
    } else {
      loc = loc || { tab: (c.state && c.state.tab) || (c.tab && c.tab.title) || '' };
      var named = [];
      (c.steps || []).concat(c.state && c.state.popup ? ['“' + c.state.popup.chart + '”'] : []).forEach(function (s) { var m = String(s).match(/“([^”]+)”/g) || []; m.forEach(function (x) { x = x.slice(1, -1); if (MS.charts && rt() && rt().charts().some(function (ch) { return MS.charts.nameOf(ch.key) === x; }) && named.indexOf(x) < 0) named.push(x); }); });
      loc.charts = named;
    }
    return { c: c, n: n, loc: loc || {}, alive: c.kind !== 'element' || !!el, topics: topicsOf(c.text) };
  }
  R.resolveComment = resolve;


  /* ---------------------------------------------------------- the map of the dashboard */
  function mapOf(r, only) {
    var L = [], tabs = r.layoutEnabled() ? r.tabs() : [{ id: null, title: '' }];
    tabs.forEach(function (t) {
      if (only && t.title && only.indexOf(t.title) < 0) return;
      var root = t.id ? MS.child.doc.querySelector('section.ms-tab[data-ms-tab="' + t.id + '"]') : MS.child.doc.body;
      if (!root) return;
      var lines = [];
      var secs = {};
      r.charts().forEach(function (c) {
        if (!root.contains(c.el)) return;
        var l = R.locate(c.el), key = l.section || '';
        (secs[key] = secs[key] || []).push('chart ' + q(l.chart ? l.chart.name : MS.charts.nameOf(c.key)) + ' (' + (l.chart ? l.chart.kind + ', ' + l.chart.lib + (l.chart.id ? ', `#' + l.chart.id + '`' : '') : '') + ')');
      });
      MS.$$('.ms-kpis', root).forEach(function (k) {
        var l = R.locate(k), labels = MS.$$('.ms-kpi-label', k).map(function (x) { return clip(x.textContent, 24); });
        (secs[l.section || ''] = secs[l.section || ''] || []).push('KPI cards: ' + labels.join(', '));
      });
      Object.keys(secs).forEach(function (s) { lines.push((s ? '  - Section ' + q(s) + ': ' : '  - ') + secs[s].join('; ')); });
      if (!lines.length) lines.push('  - (text only)');
      L.push(t.title ? '- Tab ' + q(t.title) + (t.hidden ? ' (hidden)' : '') + ':' : '- The page:');
      L = L.concat(lines);
    });
    return L;
  }

  /* ---------------------------------------------------------- options */
  var GOALS = [
    { id: 'apply', label: 'Make the changes', hint: 'Do what the comments ask' },
    { id: 'polish', label: 'Polish for leadership', hint: 'Changes plus a clean, executive look' },
    { id: 'review', label: 'Check the numbers', hint: 'Find errors before changing' },
    { id: 'explain', label: 'Plan and questions', hint: 'No code yet' }
  ];
  var ASSISTANTS = [
    { id: 'chat', label: 'Chat assistant', hint: 'Claude, ChatGPT, Copilot, Gemini…' },
    { id: 'agent', label: 'Coding agent', hint: 'Has the file open (Claude Code, Cursor…)' },
    { id: 'mcp', label: 'Mothership MCP', hint: 'Assistant drives Mothership tools' }
  ];
  var OUTPUTS = [
    { id: 'file', label: 'Whole updated file' }, { id: 'changes', label: 'Only the changes' }, { id: 'plan', label: 'Plan first' }, { id: 'tickets', label: 'Task list for a developer' }
  ];

  R.buildPrompt = function (o) {
    o = o || {};
    var r = rt(), all = R.list(), file = o.fileName || MS.exportName(), path = o.filePath || file;
    var assistant = o.assistant || 'chat', goal = o.goal || 'apply', output = o.output || (assistant === 'mcp' ? 'changes' : 'file');
    if (o.goal === 'explain') output = 'plan';
    var picked = all.map(function (c, i) { return resolve(c, i + 1); }).filter(function (x) {
      if (!o.includeDone && x.c.done && !(o.ids && o.ids.indexOf(x.c.id) >= 0)) return false;
      if (o.ids && o.ids.length) return o.ids.indexOf(x.c.id) >= 0;
      if (o.scope === 'tab') return x.loc.tab === o.tab;
      if (o.scope === 'must') return x.c.prio === 'must';
      return true;
    });
    var single = picked.length === 1, kinds = {}, types = {};
    picked.forEach(function (x) { kinds[x.c.kind] = 1; types[x.c.type || 'change'] = 1; });
    var L = [], tabsIn = [];
    picked.forEach(function (x) { if (x.loc.tab && tabsIn.indexOf(x.loc.tab) < 0) tabsIn.push(x.loc.tab); });

    /* opening: role + task, shaped by the goal and the assistant */
    var what = single ? 'one review comment' : picked.length + ' review comments';
    var title = { apply: 'Apply ' + what, polish: 'Apply ' + what + ' and polish the dashboard', review: 'Check the numbers, then apply ' + what, explain: 'Plan how to handle ' + what }[goal];
    L.push('# ' + title + ' on ' + q(file), '');
    var role = goal === 'review' ? 'You are a meticulous financial analyst and front-end developer.' : goal === 'polish' ? 'You are a senior data-visualisation designer who builds board-level dashboards, and a careful front-end developer.' : 'You are an expert front-end developer and data-visualisation designer.';
    var how = assistant === 'mcp' ? 'You are connected to the Mothership MCP server, which edits the dashboard for you. Use its tools; do not hand-write HTML unless no tool can do the job.'
      : assistant === 'agent' ? 'You have the file `' + path + '` open in my project. Edit it in place.'
      : 'I will attach `' + file + '` (or paste it below).';
    L.push(role + ' ' + how + ' I reviewed the dashboard in Mothership and left the comment' + (single ? '' : 's') + ' below. Each one says exactly where it is: tab › section › card or chart › item.', '');
    if (goal === 'polish') L.push('Besides the comments, make the whole dashboard look executive-ready: one font family, consistent title sizes, aligned cards, generous but even spacing, at most 6 colours, and a one-line “so what” under each chart title. Keep every number and label truthful.', '');
    if (goal === 'review') L.push('Before changing anything, check each number the comments touch: totals add up, percentages match their base, units (₹, lakh, crore) are labelled and consistent, and chart values match the data in the file. List what you found, then make the changes.', '');

    /* summary table */
    if (!single) {
      L.push('## At a glance', '', '| # | Where | Request | Priority |', '|---|---|---|---|');
      picked.slice().sort(o.group === 'priority' ? function (a, b) { return (PRANK[a.c.prio] || 1) - (PRANK[b.c.prio] || 1) || a.n - b.n; } : function (a, b) { return a.n - b.n; }).forEach(function (x) {
        L.push('| ' + x.n + ' | ' + where(x, true).replace(/\|/g, '/') + ' | ' + clip(x.c.text, 70).replace(/\|/g, '/') + ' | ' + (PRIO[x.c.prio] || 'Should fix') + ' |');
      });
      L.push('');
    }

    /* the dashboard */
    if (o.structure !== false && r) {
      L.push('## The dashboard', '');
      L.push('- File: `' + path + '`. One self-contained HTML file that must keep working offline by double-clicking it (file://): no server, no build step, no CDN links.');
      var libs = {}; r.charts().forEach(function (c) { libs[LIB[c.lib] || c.lib] = 1; });
      if (Object.keys(libs).length) L.push('- Charts are drawn with ' + Object.keys(libs).join(' and ') + ' (already embedded in the file).');
      var map = mapOf(r, o.mapAll ? null : (tabsIn.length && r.layoutEnabled() ? tabsIn : null));
      if (map.length) { L.push('- Layout' + (tabsIn.length && r.layoutEnabled() && !o.mapAll ? ' of the tabs these comments are on' : '') + ':'); map.forEach(function (l) { L.push('  ' + l); }); }
      var ds = Object.keys(r.state.datasets);
      if (ds.length && (o.detail !== 'brief' || goal === 'review')) { L.push('- Data in the file:'); ds.forEach(function (n) { var f = r.fields(n); L.push('  - `' + n + '` (' + r.getRows(n).length.toLocaleString('en-IN') + ' rows): ' + f.map(function (x) { return x.name + (x.numeric ? ' (number)' : ''); }).join(', ')); }); }
      L.push('');
    }

    /* comments, grouped */
    L.push(single ? '## The comment' : '## Comments', '');
    var groups = [];
    if (o.group === 'priority') ['must', 'should', 'nice'].forEach(function (p) { var g = picked.filter(function (x) { return (x.c.prio || 'should') === p; }); if (g.length) groups.push({ head: PRIO[p], items: g }); });
    else if (o.group === 'order' || single) groups.push({ head: '', items: picked });
    else {
      var byTab = {}, order = [];
      picked.forEach(function (x) { var k = x.loc.tab || ''; if (!byTab[k]) { byTab[k] = []; order.push(k); } byTab[k].push(x); });
      order.forEach(function (k) { groups.push({ head: k ? 'Tab ' + q(k) : (r && r.layoutEnabled() ? 'Across tabs' : ''), items: byTab[k] }); });
    }
    groups.forEach(function (g) {
      if (g.head && groups.length > 1) L.push('### ' + g.head, '');
      g.items.forEach(function (x) { L = L.concat(commentBlock(x, o, assistant)); });
    });

    /* rules */
    L.push('## Rules', '');
    var rules = [
      'Change only what the comments ask for' + (goal === 'polish' ? ' plus the polish described above' : '') + '. Keep everything else as it is: data, wording, behaviour, and the tabs and charts that no comment mentions.',
      'Never invent numbers. If a comment needs data the file does not have, say so and leave a clearly marked placeholder.',
      assistant === 'mcp' ? 'Each comment names its tab, section and chart exactly as Mothership shows them. Pass those names to the tools (e.g. `chart: "Sales by region"`).'
        : 'Find each item by its location and the selector given (`[data-ms-id]` / `[data-ms-ref]`), then the fallback CSS path. Keep every `data-ms-*` attribute and the `<script id="ms-state">` and `<script id="ms-runtime">` blocks: Mothership needs them to reopen the file. Settings such as chart look, pop-up text and drill-down live in the `ms-state` JSON under `charts["<key>"]`; you may edit that JSON carefully.',
      'Use Indian formats unless a comment says otherwise: ₹, lakh and crore (₹1,23,45,678 or ₹1.23 Cr), DD-MM-YYYY dates, April–March financial year.',
      'Keep it readable and accessible: text at least 12 px, good contrast, and charts that still make sense without colour.'
    ];
    if (kinds.interaction) rules.push('For interaction comments, follow the steps to reproduce the behaviour first, then fix it so the expected behaviour happens.');
    if (types.question) rules.push('Answer every Question comment in plain English before any code.');
    if (o.extra) rules.push(o.extra.trim());
    rules.forEach(function (x, i) { L.push((i + 1) + '. ' + x); });
    L.push('');

    /* what to send back */
    L.push('## What to send back', '');
    if (assistant === 'mcp') {
      L.push('1. Call `open_file` with `' + path + '` (skip if it is already open), then `outline` to confirm the tab and chart names.');
      L.push('2. Work through the comments in order. Prefer these tools: `chart_settings`, `category_order`, `category_colors`, `format_painter`, `set_text`, `set_style`, `set_popup`, `insert_part`, `add_tab`. Use `find` to get element refs. Use `undo` if a step goes wrong.');
      L.push('3. After each comment, call `screenshot` to check the result, then `update_comment` with `done: true`.');
      L.push('4. Finish with `export_html` (it saves `' + file.replace(/\.html?$/i, '') + '-edited.html` and never overwrites the original), and give me a short table: comment number → what you did.');
    } else if (output === 'plan' || goal === 'explain') {
      L.push('A plan only, no code yet. For each comment: what you will change, where (tab › section › item), and any question or assumption. Then list risks (anything that could break filters, drill-down or offline use). Wait for my go-ahead.');
    } else if (output === 'tickets') {
      L.push('A task list I can hand to a developer. One task per comment: a short title, where (tab › section › item), what to change, how to test it, and a size (S / M / L). No code.');
    } else if (output === 'changes' || assistant === 'agent') {
      L.push((assistant === 'agent' ? 'Make the edits directly in `' + path + '`. Then reply with ' : 'Reply with ') + 'a table: comment number → what you changed (or why not).' + (assistant === 'agent' ? ' Do not paste the whole file back.' : ' Then, for each change, the exact old snippet and the new snippet with enough surrounding lines to find it. Do not send the whole file.'));
    } else {
      L.push('1. A short table: comment number → what you changed (or why you could not).');
      L.push('2. The complete updated HTML file in one code block, ready to save as `' + file.replace(/\.html?$/i, '') + '-v2.html`. Do not shorten it or write “rest unchanged”: I will save it exactly as you send it.');
    }
    L.push('', 'If something is unclear, make the most sensible choice and say what you assumed.');
    if (o.embed && assistant !== 'mcp' && assistant !== 'agent') L.push('', '## Dashboard source', '', '```html', o.embed, '```');
    return L.join('\n');
  };
  R.buildPrompt.GOALS = GOALS; R.buildPrompt.ASSISTANTS = ASSISTANTS; R.buildPrompt.OUTPUTS = OUTPUTS;

  function where(x, short) {
    var l = x.loc, c = x.c;
    if (c.kind === 'element') return R.trail(l) + (short ? '' : '') + (l.chart && c.target && c.target.point ? ' › ' + q(c.target.point) : '') + (!l.chart && !l.kpi && l.item && !short ? ' › ' + l.item : '') + (!l.chart && !l.kpi && short ? ' › ' + clip(l.item, 40) : '');
    if (c.kind === 'area') return R.trail(l) + (l.charts && l.charts.length ? ' › area around ' + l.charts.map(q).join(', ') : ' › an area of the screen');
    return R.trail({ tab: l.tab }) + ' › while using ' + (l.charts && l.charts.length ? l.charts.map(q).join(', ') : 'the dashboard');
  }

  function commentBlock(x, o, assistant) {
    var c = x.c, l = x.loc, L = [], brief = o.detail === 'brief';
    L.push('#### ' + x.n + '. ' + clip(c.text.split('\n')[0], 90));
    L.push('- **' + (TYPE[c.type] || 'Change') + ' · ' + (c.type === 'question' ? 'Needs an answer' : PRIO[c.prio] || 'Should fix') + '**' + (c.done ? ' · (marked done)' : '') + (!x.alive ? ' · ⚠ the element has since been removed or renamed; use the description' : ''));
    L.push('- **Where:** ' + where(x));
    if (c.kind === 'element') {
      var t = c.target || {};
      if (!l.chart || l.item.indexOf('chart') !== 0) L.push('- **Item:** ' + l.item + (t.point ? ', at the data point ' + q(t.point) : ''));
      if (l.position && !brief) L.push('- **On screen:** ' + l.position);
      if (assistant !== 'mcp') L.push('- **Find it:** `' + t.ref + '`' + (t.css ? ' (fallback `' + t.css + '`)' : '') + (l.chart && l.chart.id ? '; the chart is drawn on `#' + l.chart.id + '` with ' + l.chart.lib : ''));
      if (l.chart && !brief) {
        var lab = (l.chart.labels || []);
        if (lab.length) L.push('- **The chart shows:** ' + lab.slice(0, 10).join(', ') + (lab.length > 10 ? '…' : '') + (l.chart.series && l.chart.series.length ? ' (series: ' + l.chart.series.join(', ') + ')' : ''));
        var cs = rt() && l.chart.key && rt().state.charts[l.chart.key];
        if (cs && (cs.tooltip || cs.style || cs.binding)) L.push('- **Current settings:** ' + [cs.tooltip ? 'pop-up ' + q(cs.tooltip.replace(/\n/g, ' / ')) : '', cs.binding ? 'linked to `' + cs.binding.dataset + '` by ' + (cs.binding.levels || []).join(' › ') : '', cs.style ? 'custom look' : ''].filter(Boolean).join('; '));
      }
    } else if (c.kind === 'area') {
      L.push('- **Area:** ' + c.area.w + ' × ' + c.area.h + ' px, ' + c.area.x + ' px from the left and ' + c.area.y + ' px from the top of the page (window ' + c.area.vw + ' × ' + c.area.vh + ')');
      if (c.inside && c.inside.length) L.push('- **Inside it:** ' + c.inside.slice(0, brief ? 4 : 10).join('; '));
    } else {
      if (c.steps && c.steps.length) { L.push('- **Steps to reproduce:**'); c.steps.forEach(function (s, i) { L.push('  ' + (i + 1) + '. ' + s); }); }
      var st = c.state || {};
      if (st.filters) L.push('- **Filters at the time:** ' + st.filters.join(', '));
      if (st.drill) L.push('- **Drill-down at the time:** ' + st.drill.join('; '));
      if (st.popup) L.push('- **Pop-up seen:** on ' + q(st.popup.chart) + (st.popup.at ? ' at ' + q(st.popup.at) : '') + (st.popup.text ? ': ' + q(st.popup.text) : ''));
    }
    L.push('- **Comment:**');
    c.text.split('\n').forEach(function (line) { L.push('  > ' + line); });
    if (!brief && c.type !== 'question') {
      var done = x.topics.map(function (t) { return t.done; });
      if (c.type === 'bug') done.unshift('the steps above no longer show the problem');
      L.push('- **Done when:** ' + (done.length ? done.join('; ') : 'the change is visible exactly where the comment points, and nothing else moved') + '.');
      if (x.topics.length && assistant === 'mcp') L.push('- **Likely tools:** ' + x.topics.map(function (t) { return t.tool; }).join('; '));
      else if (x.topics.length && o.mothershipTips) L.push('- **Tip:** Mothership can also do this without code: ' + x.topics[0].ui + '.');
    }
    L.push('');
    return L;
  }

  /* ---------------------------------------------------------- the builder dialog */
  function bytesOf(s) { return MS.bytes(new Blob([s]).size); }
  R.prompt = function (preset) {
    if (!MS.child) return MS.toast('Open a dashboard first.', 'warn');
    if (!R.list().length) return MS.toast('No comments yet. Use 💬 Element, Area or Interaction at the top first.', 'warn', 6000);
    MS.emit('prompt-opened');
    var src = ''; try { src = MS.exportHtml({ dropComments: true }); } catch (e) {}
    var r = rt(), saved = MS.prefs.get('promptOpts', {}) || {};
    var o = { scope: 'all', goal: saved.goal || 'apply', assistant: saved.assistant || 'chat', output: saved.output || 'file', group: saved.group || 'where', detail: saved.detail || 'full', structure: saved.structure !== false, includeDone: false, embed: false, extra: saved.extra || '', mothershipTips: !!saved.mothershipTips, ids: null };
    if (preset && preset.ids) { o.scope = 'selected'; o.ids = preset.ids.slice(); }
    var curTab = r && r.layoutEnabled() ? (r.tabs().filter(function (t) { return t.id === r.activeTab; })[0] || {}).title : '';
    var resolved = R.list().map(function (c, i) { return resolve(c, i + 1); });
    var picks = {}; resolved.forEach(function (x) { picks[x.c.id] = o.ids ? o.ids.indexOf(x.c.id) >= 0 : !x.c.done; });

    var side = h('div', { 'class': 'pb-side' }), out = h('textarea', { 'class': 'inp prompt-out', spellcheck: 'false', readonly: true }), stats = h('div', { 'class': 'pb-stats' });
    function opts(list, key, cols) {
      return h('div', { 'class': 'pb-opts' }, list.map(function (it) {
        return h('button', { 'class': 'pb-opt' + (o[key] === it.id ? ' on' : ''), type: 'button', style: cols ? { flexBasis: cols } : null, onclick: function () { o[key] = it.id; if (key === 'assistant' && it.id === 'mcp') o.output = 'changes'; if (key === 'goal' && it.id === 'explain') o.output = 'plan'; render(); } }, [h('b', { text: it.label }), it.hint ? h('small', { text: it.hint }) : null]);
      }));
    }
    function render() {
      side.innerHTML = '';
      // which comments
      var scopes = [{ id: 'all', label: 'All open', hint: resolved.filter(function (x) { return !x.c.done; }).length + ' comments' }];
      if (curTab) scopes.push({ id: 'tab', label: 'This tab', hint: q(curTab) });
      scopes.push({ id: 'must', label: 'Must-fix only', hint: resolved.filter(function (x) { return x.c.prio === 'must' && !x.c.done; }).length + ' comments' }, { id: 'selected', label: 'Pick…', hint: 'Choose below' });
      side.appendChild(h('div', {}, [h('h4', { text: '1 · Which comments' }), opts(scopes, 'scope', '45%')]));
      if (o.scope === 'selected') {
        var lst = h('div', { 'class': 'pb-list' });
        resolved.forEach(function (x) {
          var cb = h('input', { type: 'checkbox', checked: !!picks[x.c.id], onchange: function () { picks[x.c.id] = cb.checked; build(); } });
          lst.appendChild(h('label', { 'class': 'pb-item' }, [cb, h('span', {}, [h('b', { text: '#' + x.n + ' ' }), clip(x.c.text, 70), h('span', { 'class': 'where', text: where(x, true) })])]));
        });
        side.appendChild(lst);
      }
      side.appendChild(h('div', {}, [h('h4', { text: '2 · What you want' }), opts(GOALS, 'goal', '45%')]));
      side.appendChild(h('div', {}, [h('h4', { text: '3 · Who will do it' }), opts(ASSISTANTS, 'assistant', '30%')]));
      if (o.assistant === 'chat' && o.goal !== 'explain') side.appendChild(h('div', {}, [h('h4', { text: '4 · Answer as' }), opts(OUTPUTS, 'output', '45%')]));
      var more = h('div', {}, [h('h4', { text: 'Fine-tune' })]);
      var seg = function (key, list) { return h('div', { 'class': 'seg small' }, list.map(function (p) { return h('button', { 'class': 'seg-btn' + (o[key] === p[0] ? ' on' : ''), type: 'button', onclick: function () { o[key] = p[0]; render(); } }, [p[1]]); })); };
      more.appendChild(h('div', { 'class': 'field' }, [h('span', { text: 'Group comments by' }), seg('group', [['where', 'Tab'], ['priority', 'Priority'], ['order', 'Number']])]));
      more.appendChild(h('div', { 'class': 'field' }, [h('span', { text: 'Detail' }), seg('detail', [['full', 'Full'], ['brief', 'Short']])]));
      var chk = function (key, label, dis) { var cb = h('input', { type: 'checkbox', checked: !!o[key], disabled: !!dis, onchange: function () { o[key] = cb.checked; build(); } }); return h('label', { 'class': 'field check' }, [cb, h('span', { text: label })]); };
      more.appendChild(chk('structure', 'Describe the dashboard (tabs, sections, charts, data)'));
      more.appendChild(chk('mothershipTips', 'Add “Mothership can do this” tips'));
      more.appendChild(chk('includeDone', 'Include comments marked done'));
      more.appendChild(chk('embed', 'Paste the dashboard file into the prompt (' + bytesOf(src) + ')', o.assistant !== 'chat'));
      var ex = h('textarea', { 'class': 'inp', rows: 2, placeholder: 'Anything else, e.g. “Audience is the CFO” or “Keep it under 3 colours”', value: o.extra, oninput: function () { o.extra = ex.value; build(); } });
      more.appendChild(h('label', { 'class': 'field' }, [h('span', { text: 'Extra instruction' }), ex]));
      side.appendChild(more);
      build();
    }
    function build() {
      var ids = o.scope === 'selected' ? Object.keys(picks).filter(function (k) { return picks[k]; }) : null;
      MS.prefs.set('promptOpts', { goal: o.goal, assistant: o.assistant, output: o.output, group: o.group, detail: o.detail, structure: o.structure, extra: o.extra, mothershipTips: o.mothershipTips });
      var p = R.buildPrompt({ scope: o.scope, tab: curTab, ids: ids, goal: o.goal, assistant: o.assistant, output: o.output, group: o.group, detail: o.detail, structure: o.structure, includeDone: o.includeDone, extra: o.extra, mothershipTips: o.mothershipTips, embed: o.embed && o.assistant === 'chat' ? src : '', fileName: MS.exportName() });
      out.value = p;
      var n = (p.match(/^#### \d+\./gm) || []).length, lost = resolved.filter(function (x) { return !x.alive; }).length;
      stats.innerHTML = '';
      [n + ' comment' + (n === 1 ? '' : 's'), p.length.toLocaleString('en-IN') + ' characters', '≈ ' + Math.round(p.length / 4).toLocaleString('en-IN') + ' tokens'].forEach(function (t) { stats.appendChild(h('span', { 'class': 'tag', text: t })); });
      if (lost) stats.appendChild(h('span', { 'class': 'tag warn', text: lost + ' pointing at removed items' }));
      if (o.embed && src.length > 400000) stats.appendChild(h('span', { 'class': 'tag warn', text: 'File is large: attach it instead of pasting' }));
      if (!n) stats.appendChild(h('span', { 'class': 'tag warn', text: 'No comments match: change step 1' }));
    }
    var copy = function () {
      out.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      var msg = o.assistant === 'chat' && !o.embed ? 'Prompt copied. Paste it into your AI assistant and attach ' + MS.exportName() + '.' : 'Prompt copied.';
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(out.value).then(function () { MS.toast(msg, 'ok', 6000); }, function () { if (!ok) MS.toast('Copy was blocked. Select the text and press Ctrl+C.', 'warn'); else MS.toast(msg, 'ok', 6000); });
      else MS.toast(ok ? msg : 'Copy was blocked. Select the text and press Ctrl+C.', ok ? 'ok' : 'warn');
    };
    var main = h('div', { 'class': 'pb-main' }, [
      h('div', { 'class': 'row gap' }, [h('strong', { 'class': 'grow', text: 'Prompt preview' }),
        h('button', { 'class': 'btn primary', type: 'button', onclick: copy }, ['📋 Copy']),
        h('button', { 'class': 'btn', type: 'button', onclick: function () { MS.download(MS.exportName().replace(/\.html?$/i, '') + '-review-prompt.md', out.value, 'text/markdown'); } }, ['⬇ Save .md']),
        h('button', { 'class': 'btn', type: 'button', title: 'Save the dashboard file to attach with the prompt (comments are left out of it)', onclick: function () { MS.versions.exportFile(false, { dropComments: true }); } }, ['📎 Export file to attach'])]),
      stats, out,
      h('small', { 'class': 'hint', text: 'Works with any capable AI assistant: Claude, ChatGPT, Gemini, Copilot or your company\'s approved tool. Nothing is sent anywhere by Mothership.' })]);
    render();
    MS.dialog({ title: '✨ Prompt builder', wide: true, enterSubmits: false, body: h('div', { 'class': 'pb prompt-dlg' }, [side, main]), buttons: [{ label: 'Close', value: null }] });
    var d = MS.$('.dlg-wrap:last-child .dlg'); if (d) d.classList.add('xwide');
    setTimeout(function () { side.scrollTop = 0; var cb = main.querySelector('.btn.primary'); if (cb) cb.focus(); }, 60);
  };
})(window.MS);
