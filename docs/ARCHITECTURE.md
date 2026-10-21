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
