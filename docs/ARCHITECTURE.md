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
