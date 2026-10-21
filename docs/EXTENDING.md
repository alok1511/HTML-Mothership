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
  "applyToPage": true, "force": false, "chartsFollowTheme": true,
  "css": "/* extra CSS */"
}
```

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
