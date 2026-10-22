# Extending Mothership

Three extension points, from safest to most powerful:

| | File | Runs code? | Use for |
|---|---|---|---|
| **Brand skill** | `SKILL.md`, `.skill`, `theme.json` | No | Colours, chart palette, fonts, logo |
| **Recipe** | `.json` with `"$type": "mothership/recipe"` | No | Repeatable edits: tabs, tooltips, commentary, filters |
| **Plugin** | `.js` / `.plugin` (zip) / `.json` with `"$type": "mothership/plugin"` and `code` | **Yes** | New buttons and behaviour |

## JSON file detection

| Shape | Treated as |
|---|---|
| `"$type": "mothership/theme"`, or has `colors`/`palette` with `fonts`/`colors` | Theme |
| `"$type": "mothership/recipe"`, or has `steps: []` | Recipe |
| `"$type": "mothership/plugin"` | Plugin manifest (`{ name, code }`) |
| an array of objects, or an object whose properties are arrays of objects | Dataset(s) |

## Theme JSON

```json
{
  "$type": "mothership/theme",
  "name": "Acme",
  "colors": { "primary": "#0B3D91", "secondary": "#F2A900", "accent": "#00A19A", "background": "#F7F8FA",
              "surface": "#FFFFFF", "text": "#1A1F36", "muted": "#5B6475", "border": "#E1E4EA",
              "ribbonBg": "#0B3D91", "ribbonText": "#FFFFFF", "paneBg": "#F1F3F7" },
  "palette": ["#0B3D91", "#F2A900", "#00A19A", "#E4572E"],
  "fonts": { "heading": "Montserrat, sans-serif", "body": "\"Open Sans\", sans-serif" },
  "fontFiles": [{ "family": "Montserrat", "weight": 700, "data": "data:font/woff2;base64,..." }],
  "logo": "data:image/png;base64,...",
  "applyToPage": true, "force": false, "forceFonts": false, "chartsFollowTheme": true,
  "map": [{ "from": "#13315c", "to": "#0B3D91", "role": "primary" }],
  "css": "/* extra CSS */"
}
```

`map` swaps the dashboard's own colours for brand colours (in its style sheets, CSS variables and inline styles). Leave it out and Mothership works it out from what each colour is used for (`MS.brand.plan(theme)`); `[]` keeps the dashboard's colours. `forceFonts` puts the brand fonts on every element except icons and code.

## Recipe steps

| `do` | Fields |
|---|---|
| `layout` | `ribbon: {position, height, brand}`, `pane: {position, visible, title, width}` |
| `theme` | `theme: {…theme JSON…}` |
| `addTab` | `title`, and `markdown` or `html` (content tab), or `kind: "grid"` |
| `renameTab` / `deleteTab` / `hideTab` | `from`+`to` / `title` / `title` |
| `wrapCharts` | adds commentary headers to every chart |
| `tooltip` | `charts: "*" \| match`, `template` |
| `chart` | `match`, any of `tooltip`, `binding`, `drill`, `commentary: {title, sub, inf}` |
| `moveChart` / `copyChart` | `match`, `toTab` (title) |
| `dataset` | `name` + `expr` (a global in the page, e.g. `"salesData"`) or `rows` |
| `filter` | `dataset`, `field`, `label` |
| `replaceText` | `find`, `replace` |
| `css` | `css` |

`match` is `"*"`, `{ "title": "part of title" }`, `{ "index": 0 }` or `{ "key": "m1a" }`.

## Plugin API

```js
Mothership.registerPlugin({
  id: 'my-plugin',                 // optional, defaults from name
  name: 'My plugin',
  description: 'What it does',
  buttons: [{ icon: '⚡', label: 'Do it', title: 'Tooltip', run: function (api) { /* … */ } }],
  onLoad: function (api) {},         // once, when installed or when Mothership starts
  onChildLoaded: function (api) {}   // every time a dashboard opens
});
```

`api`:

| member | |
|---|---|
| `child()` | `{ win, doc, rt }` for the open dashboard, or `null` |
| `selection()` / `select(el)` | current selection |
| `state(label, fn)` | mutate runtime state with undo, e.g. `api.state('x', s => s.layout.ribbon.brand = 'Hi')` |
| `history` | `push({label, undo, redo}, alreadyDone)`, `attrs`, `move`, `group`, `undo`, `redo` |
| `edit` | `style(el, {prop: value}, label)`, `startText(el)`, `format(cmd, value)`, `findReplace()` |
| `tabs` | `add(title, kind, html)`, `rename(id)`, `remove(id)`, `move(id, index)`, `toggleHidden(id)` |
| `blocks` | `create({title, sub, inf, html, node, span, height})`, `wrap(el)`, `wrapAll()`, `sendToTab(el, tabId, copy)`, `duplicate(el)`, `remove(el)`, `resize(block, span, height)` |
| `insert` | `block(el)`, `text()`, `image()`, `table()` |
| `charts` | `settings(key)`, `tooltipAll()` |
| `data` | `addDataset(name, rows)`, `discover()`, `filters()` |
| `brand` | `apply(theme)`, `normalize(json)`, `parseMarkdown(md)`, `check()` |
| `toast, dialog, form, prompt, confirm, h, esc, sanitize, download, pickFiles, readFile, lib(name)` | UI and file helpers. `lib('xlsx' \| 'marked' \| 'mammoth' \| 'jszip' \| 'pdf')` lazy-loads a bundled library. |
| `exportHtml()` | current export as a string |
| `on(event, fn)` | events: `child-loaded`, `selection`, `changed`, `structure`, `theme`, `tab-shown`, `saved` |
| `run(tool, args)` | any `MS.api` tool (below), e.g. `api.run('category_order', { order: ['North','South','East','West'] })`. Returns a Promise. |

Nodes you create inside the child must carry `data-ms-own` (or be created via `blocks.create`), otherwise the export treats them as script-generated and strips them.

## Runtime API inside the child (and in exported files)

`window.__MS_RT`: `tabs()`, `showTab(id)`, `step(±1)`, `charts()`, `chartInfo(key)`, `setChart(key, patch)`, `getRows(name)`, `filteredRows(name)`, `filterValues`, `drill`, `refresh()`, `fmt(template, ctx)`. Events on `window`: `ms:tab` (`detail: {id, title}`), `ms:refresh`.

## MS.api and the MCP server

`src/js/api.js` exposes every editor feature as a function that takes one JSON object, returns JSON (or a Promise of it) and never opens a dialog. It is what the MCP server (`tools/mcp/mothership-mcp.js`) calls, and plugins can use it through `api.run`.

```js
MS.api.run('chart_settings', { chart: 'Sales by region', inference: 'South leads.', look: { axisFormat: 'cr', legend: 'bottom' } });
MS.api.describe();   // [{ name, description, inputSchema }] for every tool (JSON Schema)
```

Charts are named by their plain title (`"Sales by region"`), by key, or by part of the title. Elements are named by the `ref` that `find` returns, or by any CSS selector. All changes go through `MS.history`, so `undo` works.

**Adding a tool.** Add an entry to `A` in `api.js`:

```js
A.my_tool = { d: 'What it does, in plain English.', p: { chart: ['string', 'Chart name', true], size: ['number', 'Text size'] },
  f: function (a) { var key = chartKey(a.chart); /* … via MS.history … */ return { ok: true }; } };
```

It appears in `MS.api`, in the MCP tool list and in `api.run` automatically. Keep descriptions short and non-technical; the assistant reads them to choose tools.

**How the server works.** It is plain Node with no packages. It starts Edge or Chrome (hidden) with `--remote-debugging-port`, opens `mothership.html`, and for each tool call runs `MS.api.run(name, args)` in the page via the DevTools protocol (`Runtime.evaluate`), using a small built-in WebSocket client. File tools (`open_file`, `open_folder`, `load_data`, `drill_data_file`, `load_brand`, `insert_file`) read the file in Node and pass it in as base64. `export_html`, `save_prompt` and `screenshot` write to disk in Node. Messages are newline-delimited JSON-RPC on stdin/stdout; logs go to stderr.

`tests/mcp.test.js` drives the server exactly as an MCP client does.

**Python.** `tools/mcp/mothership_mcp.py` is the same server in Python 3.8+ using only the standard library (its own WebSocket client, a reader thread for DevTools replies). It reads `MS.api.describe()` for the tool list, so a new `MS.api` entry appears in both servers. Only the file tools (`LOCAL` in each server) are written twice. `node tests/mcp.test.js --python` runs the same checks against it. `tools/mcp/python_client.py` (`MothershipClient`) is a small stdio client for scripts.

## v3 building blocks

**Comment locations and prompts** (`src/js/prompt.js`, extends `MS.review`):

```js
var loc = MS.review.locate(el);     // { tab, section, card, chart: {name, kind, labels, series}, kpi: {label, index, of}, position, filters }
MS.review.trail(loc);               // 'Tab “Overview” › Section “Regional view” › Chart “Sales by region” (bar chart)'
MS.review.buildPrompt({ scope: 'all|tab|must|ids', tab: 'Overview', ids: [...], goal: 'apply|polish|review|explain',
  assistant: 'chat|agent|mcp', output: 'file|changes|plan|tickets', group: 'where|priority|order', detail: 'full|brief' });
```

`MS.api.run('comments_prompt', {...})` takes the same options. Comments made before v3 are located again when the prompt is built; a comment whose element has gone is flagged in the prompt.

**Icons** (`src/js/icons.js`): `MS.icon('sparkles', 'solo')` returns an inline SVG. Emoji in editor UI text (`✨`, `🎨`, `📍`…) are swapped for icons automatically, so plugins can keep using emoji labels. Add an icon by adding its path to `P` and, optionally, its emoji to `E`.

**Editor theme** (`src/js/uitheme.js`): `MS.ui.set({ mode: 'dark', accent: 'teal', density: 'compact' })`, `MS.ui.toggleDark()`, `MS.ui.get()`. Colours are CSS variables on `:root` (`--accent`, `--bg`, `--panel`, `--text`…), so plugin UI that uses them follows the theme.

**Search** (`src/js/palette.js`): `MS.palette('sales')` opens Ctrl+K with a query. It lists ribbon items, so a plugin's ribbon buttons are searchable without extra work.

**KPI status** (runtime): `kpis[id].status = { better: 'high'|'low', good: n, bad: n }` sets `data-ms-status="good|warn|bad"` on the card on every refresh; `MS.api.run('kpi_status', { ref, better, good, bad })` sets it.

## v3.1 building blocks

**Chart adapters.** An adapter in `src/js/runtime.js` (`A.<lib>`) needs `list`, `info`, `setTooltip`, `setCatColors`, `setPalette`, `setData`, `setStyle`, `onDbl`, `image`, `clone`, `fill`, `resize`. Two optional methods keep library-specific code out of the shared functions: `data(inst, now)` returns `{labels, series:[{name, values}]}` (the original numbers, or what is drawn now when `now` is true) and `colors(inst, labels)` returns `{category: colour}`. `basic: true` marks an adapter that can't redraw from new data (the D3 one): the Data & drill-down pane then explains that instead. `rt.svgImage(svg)` turns any chart SVG into a PNG.

**Summaries.** `rt.summarize(key, name)` (runtime, so captions work in exports) writes the sentences from `rt.chartData(key, true)`. `charts[key].summary = { show: 'caption' | 'aria', name }` turns on the caption (`p.ms-summary`, rebuilt on every refresh) and the `aria-label`. Editor side: `MS.summaries.list()`, `.set(keys, show)`, `.text()`.

**Number check** (`src/js/insights.js`): `MS.numcheck.run()` → `[{status: 'ok'|'diff'|'skip', what, shown, against, expected, note}]`. `MS.numcheck.parse('₹16.2 Cr')` → `{v: 162000000, tol: 500000}`.

**Region and currency** (`src/js/publish.js`): `MS.locale.get()`, `.set({country, currency, locale, units})` (one undo step, emits `locale`), `.describe()`, `.rule()` (the line AI prompts use), `.sample(o)`. In templates use `{value:cur}`, `{value:curshort}` or `{value:short}` to follow it.

**Publishing:** `MS.preflight.run()` → `[{status: 'pass'|'warn'|'fail'|'info', title, detail, fix}]`. `MS.publish.build({version, note, by, asOf, password, keepLock, badge, keepComments})` → `Promise<{html, name, publish, sha256}>`; `MS.publish.verify(html)` → `{ok, version, by, at}` or `null`; `MS.publish.isLocked(html)`. API/MCP: `get_locale`, `set_locale`, `publish_check`, `publish` (MCP `publish_html` saves it), `open_html`/`open_file` with `password`.

**Tracker:** `MS.tracker.rows()`, `.build()` (→ xlsx bytes, via SheetJS), `.apply(arrayBuffer)` (matches the ID column).

**Compare:** `MS.compare.compare(htmlA, htmlB)` → `{changes, sections:[{title, items:[{op: '+'|'-'|'~', text, before, after}]}]}`. It reads `#ms-state`, the tabs and the visible text of each file; text uses a longest-common-subsequence diff.

## v3.3 building blocks

**The dashboard's own tabs** (`src/js/pagetabs.js`, runtime `rt.pageTabs`). The runtime finds tab buttons (`[role=tab]`, `[data-tab]`, `[data-target]`, `[aria-controls]`, `.tab`/`.tab-btn`/`.nav-link`…) and links each to its panel by `aria-controls`, `data-tab`/`data-target`, `href="#id"` or a quoted id in `onclick`, else by order among same-sized sibling groups. It learns the "active" class from the buttons and panels. `rt.pageTabs(fresh)` → `{tabs:[{index, title, btn, panel, active, via}], btnActive, panelActive}`, `rt.showPageTab(i)` (clicks the button, then forces the classes if the page didn't), `rt.pageTabOf(node)`. A `ms:pagetab` event fires on every switch. Editor: `MS.pageTabs.list()`, `.show(which)`, `.add(title, html, after)`, `.rename(which, title)`, `.move(which, to)`, `.remove(which, true)`, `.insertHost()`; `which` is an index or a title. All undoable. API/MCP: `page_tabs`.

**Comments** (`src/js/review.js`). `MS.setMode('comment')` turns on Comment mode. `MS.review.addElement(el)` / `.addArea({left, top, w, h})` (client px) open the composer in the Comments pane (`R.compose(c, contextLines, extraEl, beforeSave)`). An area is stored with `area.anchor = {ref, dx, dy}`: the nearest element holding the whole box, and the offset from the top-left of its content (`rect - scrollTop` when it scrolls itself). `MS.review.placeOf(c)` → `{box, clip}` in screen px or `null` when out of sight; pins are drawn in a fixed layer and redrawn on any scroll. Comments carry `by` and `replies:[{id, text, by, at}]`; `R.reply(id, text)`, `R.resolve(id)`, `R.remove(id)`, `R.select(id, go)`, `R.showPane(on)`.

**Legends.** `rt.legendItems(chart)` → `[{name, item, sw}]`: the page's own HTML legend next to a chart (an element whose text is a category or series name, with a small coloured swatch). After category colours or the palette change, the runtime paints the swatches to match (the old colour is kept in `data-ms-legend-orig`). `rt.legendOf(node)` → `{key, name}`; `MS.edit.style` on a swatch sets the category colour instead. `MS.catColors.pick(name, key)` is the colour dialog a Chart.js legend click opens.

**Brand mapping.** `MS.brand.pageColors()` → `{colors:[{hex, text, fill, border, n, status, where}], bodyBg, fontsElsewhere}`; `MS.brand.plan(theme)` → `{map, fontsElsewhere}`; `MS.brand.preview(theme)` shows the dialog; `MS.brand.loadFile(file, direct)`. Runtime: `rt.eachRule(fn(rule, media))` walks the page's own style sheets; `theme.map` becomes override rules in `#ms-theme-css` plus inline swaps remembered in `data-ms-colmap`.

## v3.4 building blocks

**Clipboard** (`src/js/clipboard.js`, `MS.clipboard`). `MS.clip = {id, node, cut, doc, at}` is the part in hand; a snapshot also goes to `localStorage['ms.clipSnap']` (`{v, id, doc, html, text, charts:[{key, title, type, labels, series, look, h}]}`) so another Mothership window can paste it. In the snapshot each chart is a `<div data-clipchart="i">` placeholder (not `data-ms-*`, which the sanitizer strips) and is rebuilt as a native chart from its numbers. `Cb.unitOf(el)` (a chart's whole card), `Cb.target(inside)`, `Cb.clone(el)` (new ids, `data-ms-copyof` for live charts in the same dashboard), `Cb.fit(node, host)`, `Cb.copy(cut)`, `Cb.paste({inside, data})`, `Cb.pasteSnapshot(snap, inside)`, `Cb.pasteExternal(data)` (image, HTML table, tab-separated text, paragraphs), `Cb.duplicate(el)`. API/MCP: `copy`, `paste {after, inside, html, text}`.

**Chart kit** (`src/js/chartkit.js`, `MS.chartKit`). `sizing(el)` and `setSize(el, {span, pct, px, height})` (grid span or width %, height through the box, `--h`, `min-height` or the image); `[data-ms-fill]` makes Chart.js fill its box. `setLegend(key, pos)` with `''` / `top` / `bottom` / `left` / `right` / `hidden`; `applyData(key, table)` stores a dataset `"<name> data"` with `chart: key` and binds the chart with sort `source`; `resetData(key)`, `csv(key)`, `dataDialog(key)`. API/MCP: `chart_size`, `chart_legend`, `set_chart_data`; MCP file tool `chart_data_file {chart, path}`.

**Table colour rules** (`src/js/tables.js`, runtime `rt.applyTableRules`). `state.tableRules[rt.tableKey(table)] = [{col, type: rag|scale|bars|top|bottom|rule, op, value, value2, n, higher, color, bold}]`. The runtime keeps each coloured cell's original style in `data-ms-cf`. API/MCP: `table_rules`.

**Templates** (`src/js/templates.js`). Saved in IndexedDB (`kv`, key `templates`) as clipboard snapshots, with `what: 'part' | 'tab'`. `MS.templates.list()`, `.save(name, what, el)`, `.insert(t)`, `.remove(id)`. API/MCP: `templates`.

**Refresh** (`data.js`). `MS.data.matchRefresh(tables)` matches files to datasets by base name (dates ignored), then sheet or dataset name; `refreshFrom(files)` shows the review; `refreshAll()` reuses saved file handles (`kv` `handles:<doc>`) where the browser supports them. API/MCP: `refresh_data`; MCP file tool `refresh_data_files {paths, apply}`.

**Accessibility** (`src/js/a11y.js`). `MS.a11y.check()` → `[{id, kind: lang|title|alt|th|name|keys|contrast, text, fix}]`; `MS.a11y.fix(f)`, `setAlt(el, text)`. API/MCP: `accessibility_check`, `set_alt_text`.

**Presenter notes.** `state.pageNotes[tabTitle]`, `state.layout.commentNotes` (`off` / `resolved` / `all`). `MS.present.notesFor(tab)`; `MS.pageTabs.notes(which, text)`. API/MCP: `presenter_notes`.

**UI kit.** `MS.dialog({title, sub, body, buttons, wide, xwide})` (draggable, focus trap, peek button, `MS.dialogError(msg)` for inline errors); `MS.menuAt(x, y, items)` with `{label, icon, key, sub, on, disabled}`; `MS.toast(msg, kind, ms, {action:{label, on}})` → `{close}`.

## v3.5 building blocks (client work)

**Firm template** (`src/js/consult.js`, `MS.firm`). `state.firm = {name, footer, logo, locked, pw?:{salt, iter, key}, palette}`; the theme itself stays in `state.theme`. A template file is `{$type: 'mothership/firm', name, footer, logo, theme, locked}` (saved in IndexedDB `kv` `firm` and as `.firm.json`). `MS.firm.apply(t, {lock})`, `.lock(on, password)`, `.blocks(what)` (true and a message while locked: `MS.brand.apply`, `.edit`, `.addFontFiles`, `MS.catColors` and the free colour picker call it). The runtime draws `#ms-firm-foot` at the end of `<body>`. API/MCP: `firm_template`.

**Stage, confidential, names, change log.** `state.stage` (`draft` | `review` | `client`) → runtime `#ms-stamp`; `MS.stage.blockers()`. `state.confidential = {on, label, watermark}` → `#ms-watermark` (SVG background) and a footer label. `MS.confidential.scrubHtml(html, [{from, to}])` replaces whole words (and their HTML / JSON escaped forms) everywhere except `data:` URLs, and counts what is left. `MS.audit` keeps `{at, by, what, n}` from every history label; `MS.exportHtml` writes it to `state.changeLog`. API/MCP: `stage`, `confidential`, `scrub_names` (MCP file tool `scrubbed_copy`), `change_log`.

**Colour-blind check** (`MS.cvd`). Machado (2009) matrices for protanopia, deuteranopia and tritanopia; pairs of a chart's colours closer than ΔE 11 when simulated (but not normally) are reported. `MS.cvd.fix()` sets the Okabe–Ito palette; `MS.cvd.preview(kind)` adds an editor-only SVG filter. Also a finding kind `cvd` in `MS.a11y.check()`. API/MCP: `colour_blind_check`.

**Annotations and sources** (`src/js/annotate.js`). `state.annotations = [{id, chart, label, series, kind: callout|arrow|sowhat, text, title, color, dx, dy, fx, fy}]`. Adapters have `point(inst, index, series)` → px from the chart's top-left (Chart.js, ECharts, Highcharts, D3; others fall back to `fx/fy`); the runtime draws `.ms-annot-layer` next to the chart and redraws on refresh, resize and tab switches. In the editor, dragging fires `ms:annot-move` and double-click `ms:annot-edit`. `state.charts[key].source = {text, asOf, note}` → `.ms-source` under the chart; `MS.sources.insertFootnotes()`. API/MCP: `annotate`, `chart_source`, `insert_footnotes`.

**Storyline** (`src/js/story.js`, runtime `rt.story`). `state.story = {title, steps:[{ref:{id, chart}, headline, text}]}`. `rt.story.play(i)`, `.next()`, `.prev()`, `.stop()`; `rt.findRef(ref)`. Exports get `#ms-story-btn`. API/MCP: `story`.

**PDF and PowerPoint** (`src/js/deliver.js`, `MS.deliver`). `pages()` (own tabs, tab ribbon or the whole page) or `storyPages()`; `capture()` shows each in turn and takes a static copy (canvases become `<img>`). `printHtml()` builds the print layout (A4 landscape, `zoom` fitted per page by `msFit()`); `print()` prints it from a hidden frame. `pptx()` draws each page as a picture through an SVG `foreignObject` (falling back to the chart images) and `pptxFrom(slides)` writes the `.pptx` with JSZip. API/MCP: `print_layout`, `export_pptx`; file tools `save_pdf` (DevTools `Page.printToPDF`, or the print layout if the browser can't) and `save_pptx`.

**Comments.** `c.to` (assignee) and `c.mentions`; `MS.review.mentions(text)`, `.initials(name)`, `.forMe(c, name)`, `.assign(id, who)`.
