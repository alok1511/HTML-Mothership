# Changelog

## Unreleased

- Added a sample chooser with 23 options and ten guided practice dashboards with source data, worked tasks and expected results.
- Added a local data-to-chart workflow for CSV, TSV, Excel, ODS and JSON with live chart and source previews, calculations, split series and chart-only filters.
- Added 26 searchable McKinsey reference entries, five standard chart layouts and [copyable recipe Markdown](docs/CHART-RECIPE-REFERENCE.md).
- Reduced repeated preview work and chart history copying. Bound averages now exclude blank cells.

## 4.1.0 — 19 more chart layouts, and every chart editable after it is in

### Added

- **19 new chart layouts** from chart forms in recent consulting "chart of the week" pieces and the MGI year in charts, in three new groups. Comparisons: dumbbell (before and after), paired bars with the gap, ranges with the median, scatter against the 45° line, 2 × 2 matrix, bubble with one in focus, net bars either side of zero, stacked bars ranked by total. Trends: actuals then forecast, stacked area, several lines with one in focus, growth multiples (2.5×), small multiples, sorted percentile curve. Composition: population pyramid, Marimekko, three-way overlap, 100-dot stats, heat grid. 43 layouts in all, each with made-up sample data.
- **Edit layout** (Charts › Edit layout, the wand on the floating toolbar, tool `chart_layouts {action: "edit"}`): redo an inserted layout in place with other columns, options, words or data, or switch it to another layout. One undo step. `chart_layouts {action: "runs"}` lists the layouts on the page.
- **Reshape chart** (Charts › Reshape, the filter button on the floating toolbar, tool `chart_edit`): for any chart made from data, change the chart type, the category / series / value columns, the calculation, sort, top N and 100% stacking; filter the rows that chart uses (`where`); show, hide, reorder and rename categories and series (`hide`, `only`, `order`, `rename`, `series_hide`, `series_only`, `series_order`). Drill-down still uses the original names.
- New chart types for `insert_chart` and `chart_edit`: `scatter` and `bubble` (with `x`, `y`, `size` columns), `dumbbell`, `range`, `stackedarea`, `pyramid`. Chart look: reference lines (`refs`: a value on either axis, or the 45° line) and `labelSuffix`; scatter and bubble points can be labelled with their names.
- `insert_chart` takes `where`, `only`, `hide`, `order`, `rename`, `span` and `height`.
- Sample: **Chart layout gallery** (comparisons, trends, composition), built from the new layouts.

### Changed

- Chart settings › Data & drill-down keeps a chart's filters, hidden categories, names and 100% setting when you apply it.

## 4.0.0 — Chart layouts, recipes, report studio and one version number

### Added

- **Chart layouts** (Insert › Chart layouts, Charts › Chart layouts, tool `chart_layouts`): 24 consulting-style charts built from the McKinsey-style recipes, in seven groups (core, data analysis, risk registers, claims and loss runs, surveys, benchmarking, page layouts). Each has sample data to try it, guesses your columns, suggests an action title from the numbers, and inserts as one undo step.
- Chart look for Chart.js charts: values on the data (`labels`), no gridlines (`grid: false`), no value axis (`valueAxis: false`), dashed series (`dashed`), plus/minus colours (`signs`), a fixed axis maximum (`max`). For every chart: its own colours (`colors`) and a highlight (`highlight`, `highlightColor`, `restColor`) that affect only that chart. Invisible pieces (the base of a bridge) no longer show a pop-up.
- `insert_chart`: `percent` (100% stacked) and type `hstacked` (horizontal stacked bars). `insert_table`: `sort`, `desc`, `columns`, `span`, and it returns the table number.
- File › Versions: numbered versions per dashboard (v1, v2…), a Compare button, a filter for this dashboard or all, and automatic safety copies listed and trimmed separately. Tool `versions` (list, restore, delete); `save_version` returns the number.
- Opening a file saved by a newer Mothership shows a warning.
- MCP `status` reports the editor version and warns when the editor and the server versions differ.
- `tools/release.js` builds `dist/HTML-Mothership-v<version>.zip`.

### Changed

- One version number: `package.json` is the source, and `tools/build.js` refuses to build when the editor, the dashboard runtime (it said 1.0.0), the MCP servers, `package-lock.json`, this changelog or the README disagree. The README has a version history that maps the old names (v3.7) to the numbers inside the app (2.8.0).
- Automatic safety copies can no longer push named versions out of File › Versions (named versions keep 100, automatic copies 20).
- Samples: a new Claims and risk review sample built entirely from chart layouts.

### From the work merged since 3.9.0

- Recipes: a new `api` step runs most Mothership tools (shapes, colours, legends, sources, sizes) from a recipe file, with `each` to repeat a tool for every matching chart. `run_recipe` waits for those steps and still applies the recipe as one undo step.
- Charts › Inferences: an inference ladder for every chart (what it shows, what is driving it, what follows if it holds), with the checks to make before stating a cause. Tool: `chart_inferences`.
- The inference ladder reads periods oldest first however the chart is sorted, and does not read a trend when the order in time cannot be settled. A recipe with more than 200 changes is still one undo step.
- New recipe files in `recipes/consulting/`: a consulting house style and worked examples (bridge, ranked bars with a highlight, growth with a CAGR arrow, loss run, survey). `insert_chart` documents `sort: "source"`.

- Use plain numbers across sample dashboards, starter recipes, and tutorials. Use USD in examples that explicitly demonstrate currency formatting.

- Guide recipe creation with plain-language steps, hover and keyboard help, add, reorder and remove controls, and a read-only target check.
- Draft recipes with GPT-5.6 Terra or Claude Sonnet 5 in an approved work assistant. Paste drafts for review and check targets through the local MCP server when connected.
- Add a finished Monsoon Readiness showcase, a Release Rehearsal lab with a deliberate KPI defect, and a Monthly Close lab with two practice files. Update the searchable help, glossary, troubleshooting and lessons.

- Add five detailed report layouts with shared filters, key inferences, decision callouts, advanced comparisons, scenario bridges and an editable local CSV workflow.
- Add interactive maps to the three geographic layouts. Support WGS84 polygon GeoJSON and shapefile ZIPs, with name and ISO state code joins for the sample states.
- Add the Recipe workshop with six in-house starters, editable steps, dashboard setup capture and exports as JSON, a skill ZIP or a button plugin.

- Give same-named charts, tabs and controls distinct draft targets. Block ambiguous legacy targets and explain skipped checks in Coverage, with a link to the affected item.
- Run a bounded set of critical smoke checks, save completed results together without redrawing the dashboard, and run heavy jobs in a separate local browser with a hard timeout.
- Save and load reusable test packs. Compare sections and datasets to a baseline, then draft or run checks for the changed sections.

- Draft test cases in short batches with a cancel control. Cancelling keeps the existing plan.
- Avoid reloading dashboard visuals when saving a draft. Calculate coverage from one index of test targets and show long plans 60 cases at a time.

## 3.9.0 — Studio redesign, reliability and self-serve learning

### Changed

- Redesigned the welcome screen around opening a file, trying the sales sample and finding self-serve learning.
- Introduced the Studio theme with a new visual style for the ribbon, mode controls, buttons, panels and dialogs. Existing theme choices remain available.
- On smaller screens, open Outline or Inspector over the dashboard from the bottom bar. The ribbon tabs and tools scroll horizontally.

### Fixed

- Preserve edits and unsaved status across Safe mode and Network lock changes. Keep a recovery checkpoint before reloading unsaved work.
- Protect edits when opening another dashboard, opening a folder, starting a new dashboard, choosing a sample or restoring a version. Automation asks callers to export or explicitly opt into replacement.
- Close only after the corresponding export succeeds. Cancelling the file picker or comments prompt cannot close a later export.
- Separate planned, executed and passing test coverage. Label capped runs partial and show prior results as stale after dashboard changes.
- Check only the numbers supplied by an imported source. Keep snapshots separate from source expectations; require reimport for older mixed-provenance baselines.
- Capture asynchronous script failures and resource-load errors. Separate detected dependencies from an actual offline check.
- Dispatch folder data-load events once and bundle responsive image sources.
- Keep speaker notes with their tabs across rename, undo and export. Use Command-drag on Mac and Ctrl-drag on Windows/Linux for chart copying.

### Added

- A guided **Import → Edit → Review → Check → Export** workflow.
- A searchable, offline user guide and 11 hands-on lessons with a separate practice dashboard and downloadable data.
- An import report covering recognised chart libraries, linked resources and compatibility limitations.
- Data refresh previews with changed and required fields, row counts, period, before/after totals and rollback.
- A downloadable validation record with revision, working file hash, test results, source expectations, open comments and recorded offline verification.

### Development

- One version number across the editor, package, downloadable build and MCP servers.
- Locked development dependencies, documented PowerPoint test prerequisites, regression and portability checks, and CI verification for generated files.

Older version highlights are in the [README](README.md).
