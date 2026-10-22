# Architecture

## Constraints that shaped the design

| Constraint | Consequence |
|---|---|
| Locked-down office laptop: no installs, maybe no Node/Python, no admin | Pure static HTML/JS that opens by double-click from `file://` |
| `file://` blocks ES modules and `fetch()` of local files | Classic `<script>` tags with one global namespace `MS`. Libraries lazy-load by `<script src>` (allowed on file://). Samples ship as `samples/samples.js`. |
| Must work offline, nothing may leave the laptop | Every library vendored. Files read with `FileReader`. No network code. |
| Exported dashboards must keep working without Mothership | A self-contained **runtime** is embedded in every export |

## The two halves

```
┌──────────────────────── mothership.html (editor) ─────────────────────────┐
│ ribbon.js  panels.js  app.js        UI                                    │
│ childedit.js  data.js  brand.js     editing commands (all go via history) │
│ compose.js  arrange.js  review.js   build, order/colours/painter, comments│
│ help.js                             tour, tutorial, guide                 │
│ api.js                              MS.api: every feature as JSON (MCP)   │
│ importers.js  plugins.js            files in, extensions                  │
│ loader.js  versions.js              open / export / versions              │
│ history.js  core.js                 undo-redo, helpers                    │
│                                                                           │
│   ┌──────────── <iframe srcdoc> = child document ─────────────────────┐   │
│   │ child's own HTML/CSS/JS (charts)                                   │   │
│   │ <script id="ms-state" type="application/json">  ← settings        │   │
│   │ <script id="ms-runtime">  ← runtime.js source, window.__MS_RT      │   │
│   └────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

* `runtime.js` defines `MS.RUNTIME_FN`. It is **never executed in the editor window**. Its source text (`Function.prototype.toString`) is injected into the child and into exports. It therefore can't reference anything outside its own body.
* The editor talks to the child via `MS.rt()` (= `childWindow.__MS_RT`) and edits the child DOM directly (`MS.child.doc`).

## Static vs generated nodes, the core trick

On open, `MS.prepareSource` parses the HTML (no scripts run) and stamps **every element in `<body>`** with `data-ms-id`. Elements Mothership creates (tabs, blocks, headers, imported content) get `data-ms-own`.

Anything without either attribute was created **at runtime** by the page's scripts or by the Mothership runtime (chart canvases inside ECharts/Plotly containers, filter drop-downs, breadcrumbs, editor grips). `MS.exportHtml` removes those subtrees, because the page rebuilds them on load. That is why exports stay live and don't contain doubled charts or dead screenshots.

Corollaries:
* Text edited on a static element persists in the DOM **and** is stored in `state.textOverrides[id]`, which the runtime re-applies after the page's scripts run. This beats scripts that write KPI values on load.
* Edits on generated elements are warned about in the UI.
* Body `<script>`s are moved to the end of `<body>` on export (order preserved). Tabs move content into later `<section>`s, and an inline script that runs during parsing must still find its canvas.

## State (`#ms-state`)

```jsonc
{
  "v": 1,
  "theme":   { "name", "colors": {primary,…}, "palette": [], "fonts": {heading, body}, "fontFiles": [{family,data}], "logo", "applyToPage", "force", "chartsFollowTheme", "css" },
  "layout":  { "ribbon": { "height", "position": "top|left", "brand" }, "pane": { "width", "visible", "position": "left|top", "title" } },
  "charts":  { "<chartKey>": { "tooltip": "{label}: {value:cr}", "binding": { "dataset", "levels": [], "measure", "agg", "series", "sort", "top" }, "drill": { "mode": "levels|details|crossfilter|none", "columns": [] } } },
  "datasets":{ "<name>": { "expr": "salesData" } | { "scriptId", "sub" } | { "rows": [...] } },
  "filters": [ { "dataset", "field", "label" } ],
  "textOverrides": { "<data-ms-id>": "<html>" }
}
```

Tabs, blocks and commentary live in the **DOM** (`section.ms-tab[data-ms-title][data-ms-kind]`, `.ms-block > .ms-head/.ms-crumbs/.ms-visual`), not in state, so they serialise naturally.

`chartKey` = the chart element's `data-ms-id`. For copies it is the `data-ms-id` of the `[data-ms-copyof]` holder, and the runtime clones the source chart into the holder when it first becomes visible.

## Chart adapters

`rt.adapters.{chartjs,echarts,plotly}` each implement:

| method | purpose |
|---|---|
| `list()` | find live instances in the document |
| `info(inst)` | type, title, labels, series names |
| `snapshot(inst)` | keep the original data/colours/tooltip so "reset" and unbind can restore them |
| `setTooltip(inst, fn)` | `fn(ctx) → string` with ctx `{label, series, value, pct, total, index}`; `null` restores |
| `setPalette(inst, colors)` | recolour; `null` restores |
| `setData(inst, labels, series)` | used by data binding (drill/filter); `null` restores |
| `onDbl(el, inst, cb)` | double-click → `cb({label, index, series})` (Plotly: two clicks within 450 ms) |
| `clone(inst, target)` | live copy into another container |
| `fill(inst)`, `resize(inst)` | fit to the block |

Adding a library = adding one object with these methods.

## Undo/redo

Every mutation goes through `MS.history`:
* `state(label, fn)`: snapshot JSON before/after and restore via `rt.setState`
* `attrs(label, el, ['style'], fn)`: attribute snapshots
* `move(label, node, fn)`: node position before/after (insert, move, delete)
* `group(label, fn)`: several ops as one step
* custom `{label, undo, redo}` for text edits

DOM snapshots (innerHTML) are deliberately avoided for containers holding charts, because re-parsing would destroy live chart instances.

## Security boundaries

* The child iframe uses `sandbox="allow-scripts allow-same-origin …"`. That is needed for live editing and is **not** isolation. Safe mode drops `allow-scripts`.
* Network lock injects a strict CSP `<meta>` (editor only, removed on export).
* Imported documents go through `MS.sanitize`.
* Plugins run via `new Function` after an explicit confirmation showing their source.

## v2 additions

**Fit and zoom.** The iframe is given a virtual width (`MS.view.renderWidth`, at least 1280 px, or the panel width if wider) and scaled with `transform: scale()` (`transform-origin: 0 0`). The dashboard lays out exactly as on a desktop. Mouse events inside the iframe keep the iframe's own coordinates, so selection and drag need no correction.

**New state** (all in `#ms-state`, so exports keep it):

| Key | Holds |
|---|---|
| `layout.orders` | Arrays of category names. `applyOrder` reorders any chart whose labels overlap one of them (unbound charts via the adapter's `setData`). |
| `layout.colors` | Category → colour. Applied per chart through the adapter's `setCatColors`. |
| `layout.tip` | Style of hover pop-ups on elements (`[data-ms-tip]`). |
| `charts[key].style` | Chart look (fonts, legend, axis number format, pop-up colours), applied with the adapter's `setStyle`. |
| `charts[key].native` | A chart built in Mothership (`{type}`); rendered with Chart.js, which is embedded into the child as `data-ms-own data-ms-lib`. |
| `kpis` | KPI cards bound to datasets (`aggregate` + Indian formats), recomputed on every filter change. |
| `comments` | Review comments (element ref / area / interaction log + snapshot), shown as pins in the editor only. |

**Order in `applyChart`:** binding or restore → shared order → palette and category colours → tooltip → look. ECharts resets options on `setOption`, so the look is re-applied after.

**Finding a chart's data.** `rt.matchData(key)` compares the chart's labels with the distinct values of every column of every dataset (added, or discovered in the page's scripts). A column holding at least half the labels is a match; the best one is offered with the next-finer column as the second drill level.

**MS.api and MCP.** `api.js` wraps features as dialog-free JSON functions; `tools/mcp/mothership-mcp.js` starts Edge/Chrome over the DevTools protocol and calls them. See `docs/EXTENDING.md`.

## v3 additions

**Editor look.** `mothership.css` is built on CSS variables with light, dark and high-contrast sets (`:root[data-ms-mode]`), plus `data-ms-bar` and `data-ms-density`. `uitheme.js` sets the accent family (`--accent`, `--accent-hover`, `--accent-weak`, `--accent-line`, `--accent-ink`) and the top-bar colours from the chosen preset, saves them in `localStorage` (`ms.ui`) and redraws the favicon. None of this touches the child.

**Icons.** `icons.js` holds about 60 stroke icons as path data. A `MutationObserver` on the editor (not the iframe, inputs, code or the prompt preview) replaces mapped emoji in text nodes with `<svg class="ic">`, so every existing label, dialog and plugin gets icons without changes. Hover tips replace native `title` tooltips.

**Where a comment is.** `prompt.js` walks up from the element: the tab (`rt.tabs()`), the section (`.ms-section h2`, else the nearest heading above that is not inside a card), the card (common card class names), the chart (`rt.charts()` contains the element, or is the nearest chart in the same card), and KPI position (`i of n` in its row). Areas use the elements found inside the box. The trail is stored on the comment (`c.loc`) and rebuilt when the prompt is made, so renamed charts and moved elements are reported correctly.

**Prompt.** `buildPrompt` writes: role and how to work (by assistant), an "At a glance" table, the dashboard (file, libraries, tab/section/chart map, datasets), comments grouped by tab with *Where / On screen / Find it / The chart shows / Current settings / Comment / Done when*, rules adapted to the comment types, and what to send back (by assistant and output). "Done when" and tool hints come from simple keyword topics (colour, order, chart type, pop-up, drill, numbers, wording, filters, layout).

**Python MCP server.** Same protocol, tools and env settings as the Node server. Requests are handled one at a time; a reader thread matches DevTools replies to waiting calls.

## v3.1 additions

**Highcharts** is a full adapter: it reads `Highcharts.charts`, keeps the original categories, series and tooltip formatter in `__msOrig`, and changes the chart with `chart.update`, `series.setData` and `axis.setCategories`. Mothership never ships Highcharts; it uses the copy inside the dashboard.

**D3 and other SVG charts** are found by their marks: shapes inside an `<svg>` that carry a bound datum (`__data__`, which D3 sets). The first text field of a datum is its label and the first number its value (`d3.pie()` data is unwrapped). Pop-ups use Mothership's own hover tips (`data-ms-tip`), colours are inline `fill`, and the look sets fonts on the SVG's text. There is no `setData`, so order, binding and drill-down are skipped for them.

**Summaries** live in the runtime so captions follow filters and survive export; they are generated elements (no `data-ms-own`) and rebuilt on load.

**Region and currency** (`state.locale = {country, locale, currency, units: 'intl'|'indian'}`, default en-US / USD). The runtime's `locale()` reads it; `fmtNum` specs `cur`, `cur2`, `short`, `curshort` and `num` follow it, as do `k`/`m`/`pct`/`int` and the default. `inr`/`cr`/`lakh`/`usd` stay fixed. Editor side: `MS.locale` in `publish.js`.

**Publishing** (`publish.js`). `MS.publish.build()` writes `state.publish = {version, at, by, note, asOf, badge, log[], lock?, seal}` through `MS.exportHtml({publish})`, with `seal` as 64 zeros, hashes the whole file (SHA-256, Web Crypto) and puts the hash in place of the zeros. `verify()` swaps it back and re-hashes. Normal exports delete `seal`, so the working copy keeps the lock details (for the next publish) but is never locked. `MS.openHtml` calls `MS.publish.gate()` first when the file has both `lock` and `seal`; the lock is `{salt, iter: 150000, key}` from PBKDF2-SHA-256. The runtime draws the corner badge (`#ms-badge`) and the failure bar (`#ms-errbar`) only outside the editor.

**Checks and reports** (`insights.js`) are editor-only and read what is on screen: `rt.chartData(key, true)` for charts, the KPI cards' text for KPIs.

## v3.3 additions

**Page tabs** are the dashboard's own, so Mothership never wraps or rebuilds them: it finds them in the runtime (`rt.pageTabs`), switches them by clicking their button (the page's own script does the work) and only forces the active classes when nothing changed. New tabs are clones of an existing button and an empty panel with the same classes, stamped with `data-ms-id` so they export, and their link (`data-tab`, `aria-controls`, `href`, `onclick` literal) is rewritten to the new panel id. The runtime also handles clicks on tabs the page's script doesn't know about, so added tabs work in the exported file. Every change is a `MS.history` move or attrs step.

**Comment mode** is a third editor mode next to Edit and Interact. Capture-phase listeners in the child turn a click into an element comment and a drag (more than 8 px) into an area comment, and let page tabs, the tab ribbon and breadcrumbs through. Pins live in `#ms-cmt-layer` (`position: fixed`, `data-ms-editor`, never exported) and are recomputed from their anchors on scroll (capture phase, so inner scroll bars count), resize, tab change and any edit. Older comments without an anchor keep page coordinates.

**Colour sync.** Chart.js 4 does not redraw new dataset colours after `update('none')`, so colour changes use a full update with animation turned off for that one call. HTML legends are found per chart (`rt.legendItems`) and repainted after colours apply.

**Brand mapping** runs in the runtime, so exported files keep it: `theme.map` is turned into override rules with the same selectors (and `@media` wrappers) as the page's own rules that use those colours, placed after them, plus inline style swaps. Removing the theme removes the rules and puts inline colours back.
