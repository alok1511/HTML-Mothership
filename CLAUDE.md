# HTML Mothership: notes for Claude Code

A zero-install, offline, PowerPoint-style editor for HTML dashboards. The user runs it by double-clicking `mothership.html` on a locked-down office laptop (no admin, possibly no Node/Python). Keep it that way.

## Hard rules
- **No build step required to run.** `mothership.html` + `src/` + `vendor/` must work from `file://`. Use classic `<script>` files attached to the global `MS` namespace. No ES modules, no `fetch()` of local files, no CDNs.
- **No network calls** anywhere. New libraries go in `vendor/` (pinned version, licence added to `THIRD_PARTY_NOTICES.md`) and load via `MS.lib(name)` in `src/js/importers.js`.
- **`src/js/runtime.js` is stringified and injected** into the child and every export. Inside `MS.RUNTIME_FN` you can't reference anything outside the function body.
- Every editor mutation goes through `MS.history` (see `src/js/history.js`) so undo/redo keeps working.
- Elements Mothership adds to the child need `data-ms-own`. Untagged elements are stripped on export (they're assumed script-generated).
- `src/js/api.js` (`MS.api`) is the dialog-free layer for every feature; the MCP server (`tools/mcp/mothership-mcp.js`, plain Node, no packages) calls it over the DevTools protocol. New features should get an `MS.api` entry too.
- There are two MCP servers with the same behaviour: `tools/mcp/mothership-mcp.js` (Node) and `tools/mcp/mothership_mcp.py` (Python 3.8+, standard library only). Both read the tool list from `MS.api.describe()`; a new file-handling tool must be added to `LOCAL` in both. `npm test` runs `tests/mcp.test.js` against each.
- Editor UI: use the CSS variables in `mothership.css` (they follow the theme from `src/js/uitheme.js`), `MS.icon(name)` from `src/js/icons.js` for icons (emoji in UI text are swapped automatically), and keep `MS.review.locate` / `buildPrompt` in `src/js/prompt.js` in step with new element kinds.
- Chart libraries: each has an adapter in `runtime.js` (`A.chartjs`, `A.echarts`, `A.plotly`, `A.highcharts`, and the basic `A.d3`). Never vendor Highcharts (not free for commercial use); tests build Highcharts/D3 pages from `node_modules` via `tests/fixtures/pages.js`.
- Checks and reports (summaries UI, number check, Excel tracker, compare versions) are in `src/js/insights.js`.
- The dashboard's own tabs: runtime `rt.pageTabs` / `rt.showPageTab`, editor `MS.pageTabs` in `src/js/pagetabs.js`. When the page has tabs and the tab ribbon is off, inserts go to `MS.pageTabs.insertHost()`.
- Comments (`src/js/review.js`): Comment mode (`MS.mode === 'comment'`), the Comments pane (`#cmt-pane`), area anchors and the fixed pin layer. Keep `R.addElement` / `R.addArea` and the API comment tools working.
- Region and currency (`MS.locale`), "Ready to publish?" (`MS.preflight`) and publishing with lock and seal (`MS.publish`) are in `src/js/publish.js`. Normal exports must never carry `state.publish.seal`.
- After changing `src/`, run `node tools/build.js` so `dist/mothership-standalone.html` and `samples/` stay in sync, then `npm test` (Playwright, from file://).

## Code style
ES5-style JavaScript (`var`, `function`), 2-space indent, small helpers (`MS.h`, `MS.$`, `MS.$$`). User-facing text is plain English. Dashboard numbers default to **US English and US dollars** (`en-US`, `USD`) and follow `state.locale` (Design › Region & currency); use the `cur`/`curshort`/`short` formats rather than hard-coding a currency. The ₹ crore/lakh formats stay available by name.

## Docs
`README.md` (user guide), `docs/ARCHITECTURE.md`, `docs/EXTENDING.md` (plugins, recipes, skills, MS.api/MCP), `docs/TUTORIAL.md`.
