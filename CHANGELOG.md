# Changelog

## Unreleased

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
