# Changelog

## 3.9.0 — Reliability and self-serve learning

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
