# Mothership user guide

Read this in the repository or open **Help › User guide** in Mothership. The same chapters are bundled inside the standalone editor. Use **Help › Start here** for a checklist and **Help › Tutorial** for practice.

<!-- guide:start -->
## Your first dashboard

**In ten minutes:** open a practice copy, change a heading, add a reader note, run a check, and save a file someone else can open.

1. Double-click **dist/mothership-standalone.html**. You can copy this editor file by itself. If you downloaded and unzipped the entire repository, **mothership.html** also works while its neighbouring folders stay in place.
2. On the welcome screen choose **Start here › Open practice copy**. The sample is already included; no login or download is needed. For a walkthrough on paper, follow **Help › Tutorial** or the lesson handout in the repository.
3. At the top, select **Edit**. Double-click the large heading, change it to **Sales performance | Review copy**, then click outside it to commit. **Home › Undo** and **Redo** let you compare.
4. Select **Interact**. Hover over a bar. A small pop-up shows a value. Interact is how you check the dashboard from a viewer's perspective.
5. Choose **File › Ready to publish?**. Read the findings. This is a scan; it does not run your test plan or certify the numbers.
6. Choose **Export HTML**. Save a new name in a folder you can find. Open the result in a separate browser tab. The dashboard should open on its own with no editor ribbon. Open that same HTML file *inside* Mothership to edit it again.

**Know which file is which.** The editor is the tool you open to make changes. Your export is the dashboard you send. Send the dashboard export, unless you also want the recipient to have the editor.

| I want to… | Start here |
|---|---|
| Update last month's dashboard | Data › Manage › Refresh from file |
| Fix a chart label or pop-up | Double-click the chart in Edit |
| Collect sign-off feedback | Comment mode, then Review |
| Check that a file travels offline | File › Ready to publish? › Offline check |
| Save an editable working copy | File › Export HTML |
| Share a dated viewer copy | File › Publish |

<!-- guide:import -->
## Open, import and check compatibility

**Choose Open** for a single HTML file whose charts, styles and data are already inside it. **Choose Open folder** when a dashboard arrived with files beside it, such as `app.js`, `theme.css`, images or `data.json`. Unzip downloads first. Select the dashboard folder, then pick the starting HTML page if asked. **New** creates an empty dashboard or starts you with help and methodology tabs.

Use **File › Import report** before investing time in edits. Read it in this order:

1. **Recognised charts.** Chart.js, ECharts, Plotly and Highcharts have fuller editing support. D3/SVG has more limited appearance and review support. An unrecognised chart may still display, but its data and settings may be unavailable.
2. **Files not found or still linked.** Fix missing files or reopen the right folder. A file on your own laptop or a remote image may fail for someone else. Embedded pages and browser modules need extra testing.
3. **Export behaviour.** A static HTML page with chart libraries is a better fit than an application that rebuilds its entire page. Edits to script-generated parts can be overwritten by the original code.

**Example:** a folder contains `report.html`, `report.css`, `charts.js` and `sales.json`. Open the folder, choose `report.html`, and check that both the charts and totals load. Export to a different folder and reopen without the source folder. If it still needs another file, inspect the import report and test the exported file offline.

**Trust the source first.** Turn on **View › Safe mode** *before* opening unfamiliar HTML. Scripts stay off; you can inspect text and style, but charts may not draw. Normal mode runs the dashboard's own JavaScript with access to the editor; use it for files you trust. **Network lock** limits common requests during editing, and may make charts blank when they rely on remote libraries. It is not a general security boundary and does not make the exported file offline.

A missing-file scan can see markup and CSS references, including responsive images. It cannot predict every request a script might make when someone uses a filter or opens a tab. Browser modules, nested stylesheets, API calls and embedded pages may require changes in the source.

<!-- guide:text -->
## Edit text, styles and layout

| Mode | Use it for | What a click does |
|---|---|---|
| Edit | Change text, formatting and layout | Selects a part; double-click text to type |
| Comment | Leave feedback without editing | Pins a note; drag a box to mark an area |
| Interact | Test what viewers experience | Uses the dashboard's own tabs, buttons and filters |

The **left outline** lists tabs and charts. The **right Format panel** changes with the selection. On a smaller screen, use **Outline** or **Inspector** at the bottom to open a panel over the canvas. Press the same button or **Esc** from inside the panel to close it. Open **Comments** at the top to jump straight to review notes. If you selected a word or an icon instead of the whole card, use the selection path or **Alt+↑** to select its parent. Double-click a heading, edit it, then click away to commit. Use **Home › Replace** when you need the same wording changed throughout the dashboard; check that your search is specific enough.

**Make a chart card easier to read.** Select its heading. Set the font, size and colour on the right. Select the card to change its background or border. Drag a corner to resize it. Drag the card to move it; hold **Command** on Mac or **Ctrl** on Windows/Linux to copy. Use **Home › Duplicate** if you prefer a button. A blue marker shows where it will land. Press **Esc** to cancel a drag.

**If it looks too small:** select **Fit** at the bottom right for an overview, then zoom in when editing. Use **View** to draw at a phone or tablet width when checking layout. Zoom changes the editor's view, not the exported dashboard's design.

**If a text edit comes back:** check whether the dashboard's script writes that text when a filter changes. If it does, change the dataset or the dashboard source instead of repeatedly editing the number on screen.

<!-- guide:tabs -->
## Tabs, How-to pages, FAQs and methodology

Your existing tabs show under **Your tabs** when Mothership recognises them. Use **Layout › Add tab** or the left-panel add button to add one. Double-click the tab name to rename it. Drag the tab name in the outline to change its order. If the original page has no tabs, use **Layout › Tab ribbon**. Turning off that ribbon combines its tabs; save a version before doing this.

**Add a reader guide:** choose **Insert › Tab from file**, select a Word, PowerPoint, Excel, PDF, Markdown or image file, and inspect the result. Convert headings into collapsible questions when offered. For sensitive documents, import only the content the audience should see.

| Page | What to include | Example |
|---|---|---|
| How to use | Where to start, filters, what changes and how to reset | “Open Overview. Pick a Region. The two sales charts change; the target stays fixed. Use Reset to return to all regions.” |
| FAQ | Short answers to real reader questions | “Why are totals different? The regional view excludes cancelled orders; Finance reports them separately.” |
| Methodology | Source, period, metric definition, exclusions and known limits | “Net sales = invoiced value less returns. Excludes GST. Source: Finance export, 31 October.” |

A good help page tells readers **what they should see** after each action. Mention which charts do *not* follow a filter. For example: “Drill from Region to State by double-clicking a bar. Select the first breadcrumb to return.”

**File imports are conversions.** Word usually becomes editable text and images. PowerPoint import keeps useful content, not its original layout or live charts. Import a PDF as images if you need its original appearance; the text in an image is not editable. Check wide tables, logos and fonts after importing.

**Speaker notes:** use the tab's **⋯ › Speaker notes**. Notes follow the tab through rename and reorder. Presenter view shows them; working HTML retains them, so review or remove private notes before sharing.

<!-- guide:charts -->
## Chart settings, chart commentary and units

Double-click a chart in **Edit**. Use **Commentary & size** for the title, subtitle, takeaway and dimensions; **Look** for axes, legend and fonts; **Tooltip** for what appears on hover; **Data & drill-down** for its data and double-click action.

A useful commentary block answers three questions:

- **What?** “Net sales by region”.
- **In what units and period?** “₹ crore, October 2026, excluding returns”.
- **Why should I care?** “West accounts for 42% of the month's sales; check whether this is a one-off order.”

Use **Design › Region & currency** before applying global formatting. New dashboards default to US English and US dollars. Choose India, INR and lakh/crore where appropriate. This changes display conventions. It does **not** convert amounts between currencies or change figures the original dashboard formats itself. Check axes, tooltips and totals together.

Use **Charts › Category order** or **Category colours** when the same labels appear in multiple charts. Set “North” once to keep its colour consistent, but review charts that use colour to show status. Apply **Format painter** only to charts that should share the same look and formats.

**Worked example:** choose a tooltip like **{label}: {value:cr}** when the underlying number is in rupees. A raw value of ₹12,500,000 is ₹1.25 crore. If the raw data already stores **1.25** as crore, do not apply a second conversion; use the raw number and label the unit. Verify one value against the source.

<!-- guide:drill -->
## Data, filters and drill-down

A dataset is a table: one row per sale, claim or other record, and one column per field. **Data › Load data** embeds a file. **Data › Find data** looks for tables already inside the dashboard. **Data › Manage** shows the datasets and row counts.

**Make a chart that drills from region to state:**

1. Load rows with columns like **Region**, **State** and **NetSales**.
2. In the chart's **Data & drill-down** settings, choose that dataset. Group first by Region, then State. Choose NetSales as the measure and **Sum** as the calculation.
3. Set the double-click action to drill down. In **Interact**, double-click a Region bar. The chart should change to that region's states. Click the breadcrumb to return.
4. Add a Region filter via **Layout › Filter pane**, and test at least two choices and Reset. A chart follows the filter only when it is linked to the relevant dataset.

Choose **Count** for the number of rows, **Sum** for total amounts and **Average** for a mean. Counting orders and summing their value answer different questions. A table already aggregated to “North = 100” cannot reveal states unless you supply lower-level data. For access to individual records, use the appropriate drill-down details action and review what data will be shared.

**If a chart does not change:** check its dataset, field names, chart library and mode. A fixed target or original chart may be unrelated to the filter. Check blank values and whether the chosen filter combination has any rows before assuming the chart is broken.

<!-- guide:refresh -->
## Update a recurring dashboard

Use a repeatable loop: **save working copy → preview data → apply → check → export a new version**. Give monthly files a consistent name and keep the headers and sheet names stable.

1. Export the current working dashboard or save a named version. Open **Data › Manage** and confirm which dataset is embedded and which source it came from. A dataset linked to a page script must be updated in that source.
2. Choose **Refresh from file** next to the dataset, or **Data › Refresh** to match a batch. For a workbook with several sheets, choose the right sheet. If several files match, choose explicitly instead of assuming the latest one was used.
3. Read the preview. Compare row counts, added/removed columns, reporting dates and totals. Column totals are simple sums of the full file and may differ from filtered or average-based KPI cards. Check any blanks. Enter the period when it cannot be inferred.
4. Fix a **missing required column** or **non-numeric measure** in the source, then preview again. If only unused columns disappeared, confirm they are genuinely unused before selecting the dataset.
5. Apply the refresh. Check an affected chart and KPI, try filters, and compare one total to Finance's source. Rerun tests; results from the previous dashboard revision are stale.
6. Use **Home › Undo** immediately if the replacement was wrong, or **File › Versions** to restore the recovery copy. Export under a new month/version when ready.

**Example:** October has 1,250 rows and ₹2.4 crore net sales; November's file has 1,119 rows and ₹1.9 crore. Neither change is automatically wrong. Check the period, excluded regions and returns, then compare the ₹1.9 crore with the independent report.

<!-- guide:build -->
## Build a dashboard from scratch

Choose **File › New** and a starter with Overview, How to use, FAQs and Methodology. The Overview is where a reader should learn the decision, the headline numbers and the evidence. Use **Insert › Header**, **Section** and **Footer** for structure; use **Insert › KPI cards** and **Chart** after loading a dataset.

**Build one page first:**

1. Add a heading such as **October sales: West led growth**.
2. Add two or three KPI cards: net sales, order count and average order value. Label units and period. Link cards to data when they need to respond to filters.
3. Add a bar chart by region and a trend by month. Give each a one-line takeaway and source date.
4. Place a filter where the reader will find it. Test Reset and a narrow filter that returns no rows.
5. Add a How-to tab, data definitions and an owner or contact for questions. Preview at desktop and phone widths.

Keep one story per tab. Use a table for exact values, a bar for comparison and a line for trends. A template speeds up placement; verify its labels, data and examples before sending. For recurring report design, save a chart card or section as a template and use a brand or firm template for shared colours and fonts.

<!-- guide:review -->
## Review, comments and sign-off

Choose **Comment** and click an element, or drag a box around the area. Describe the issue and the result you expect. Click a comment in the **Comments** pane to revisit it. Use **Reply** for the discussion, **Resolve** when checked and **Must fix** for blockers.

**Weak comment:** “Fix this chart.”

**Useful comment:** “On Overview › Sales by region, the West bar shows ₹1.2 Cr after selecting November. Finance's November total is ₹1.4 Cr. Check the date filter and the exclusion of credit notes. Done when West shows ₹1.4 Cr and the tooltip says November.”

If the fault happens after interacting, reproduce it in **Interact**, then use **Review › What I did** to capture what led to it. Save the **Excel tracker** for a meeting; reimport the edited tracker to update tracked comments. Use **File › Compare** to review a saved version against the current dashboard before resolving the feedback.

**AI assistance is optional.** **Review › Make prompt** turns selected comments into a brief. The top bar also has a **Prompt** shortcut on wider screens. Review it before copying. Share only data your organisation allows with that assistant. When it returns changes, compare versions and rerun checks. The editor does not send the prompt itself.

<!-- guide:testing -->
## Test interactions and verify numbers

**Drafting makes a plan. Running creates evidence.** Open **Testing › Draft tests**. Choose Quick draft for representative cases or **Full draft (bounded)** for more detailed checks. Run the plan and watch what it does. Review the failed steps and manually check any case that needs a person.

| Label | Meaning |
|---|---|
| Planned | A test case targets this part. It may not have run. |
| Ran | A relevant step executed on this revision. It may have failed or checked only some choices. |
| Passed | A complete check for the listed part ran and passed. It does not prove every possible behaviour. |
| Partial | A limit or missing expectation means some values or interactions were not verified. |
| Stale | The dashboard or its data changed after the recorded result. Run the check again. |

**Example:** a filter offers 27 choices. The deeper test can sample up to 25 alternatives to the starting choice. Read the actual checked count, then exercise omitted choices manually or add targeted cases. Check combinations of filters separately. A few passing tests are useful evidence; they do not certify the dashboard.

**Verify numbers against a source:**

1. Go to **Testing › Numbers › Download the numbers as Excel**. The template lists the chart, category, series and stable reference where available.
2. Replace values with numbers from an independent source (for example, Finance's monthly workbook). Clear values you cannot verify. Keep the identifiers unchanged.
3. Import the workbook or a CSV. Read the matched count and any ambiguous or unmatched rows. Imported expectations cover only the supplied values.
4. Run the number cases. Follow up mismatches. Record the independent source and period. A **dashboard snapshot** is useful to detect changes later; it does not verify that the original values were correct.

**Review › Number check** compares some visible totals to each other. This catches consistency issues but cannot establish the source's correctness. **File › Ready to publish? › Save validation record** captures the revision, current results, source expectations, open comments and offline status. Recheck after a data refresh or a new export.

<!-- guide:save -->
## Save, recover and keep versions

| Command | What it creates | When to use it |
|---|---|---|
| Export HTML | A file on disk that can reopen for editing | At milestones and before leaving the editor |
| Save as… | An export with a new path or a download | New month, client or version |
| Save version | A named browser snapshot | Before a large change, or to compare revisions |
| Publish | A separate viewer copy with release details | The file you want people to use |
| Autosave and recovery | Recent work in the same browser profile | After an interruption |

Opening, creating or closing a different dashboard with unsaved edits asks what to do. Choose **Export, then continue** to save and replace, or **Cancel** to stay. **Leave without saving** tries to keep a browser recovery version; when browser storage is disabled there may be no recovery copy. Download an HTML file if the work matters.

Safe mode and Network lock reload the dashboard from the current edits. They keep changes and the unsaved flag; undo history is cleared when the frame reloads. Mothership tries to keep a recovery version for unsaved work before changing these modes. Look in **File › Versions** if you need the previous state.

**Find your export:** Chrome or Edge may offer a file picker. If the browser uses downloads instead, look in Downloads or its download history. After a first save, exporting again may overwrite that same chosen file. Use **Save as…** for a new path. Open the resulting file and verify it before closing the editor.

Browser snapshots are local to this browser profile and can be deleted by office policy or clearing browser data. Keep dated HTML exports for durable backups. On the start screen, **Recover** can restore a recent autosave if one is available.

<!-- guide:publish -->
## Publish, check offline and deliver

| Deliverable | Choose | What to check |
|---|---|---|
| Editable working dashboard | Export HTML | Reopen in Mothership and confirm edits are retained |
| Viewer dashboard with a version and data date | Publish | Badge, release note, comments, hidden data and interactions |
| Static handout | PDF | Page count, chart legibility and footer |
| Slide deck for a meeting | PowerPoint | Each slide in the actual PowerPoint app; titles are editable, charts are pictures |

**Before you send:**

1. Use **File › Ready to publish?**. Investigate script or resource errors, empty charts, inconsistencies and must-fix comments. “No linked resources detected” is a scan result, not an offline pass.
2. Under **Offline check**, download the test copy and disconnect from the internet. Open that file in a fresh tab. Visit each tab, hover important charts, try filters and Reset, check one source value and look for missing images. Record the pass only after checking. If you publish or edit a different file, test that exact file separately.
3. Use **Publish** for a release version such as **1.2**, an **as-of date** and a note such as **November data and revised definitions**. Publishing can omit review comments. Inspect embedded data, speaker notes, hidden tabs and any client names yourself.
4. Open the file you will send and save a **validation record** when required. A review record identifies the working export by hash. It does not automatically apply to a different Publish, PDF or PowerPoint file.

The optional edit password is a **deterrent** inside Mothership. It is not encryption or access control. The HTML still contains its data. Use approved sharing controls such as SharePoint or other organisation-managed permissions when the content must stay private.

**Presenting:** use **Present** to step through tabs. In Presenter view you can see the next tab and your notes. Arrow keys move, **L** toggles the laser, **B** blanks the screen, and **Esc** exits. Test popup permissions and full-screen display on the meeting laptop in advance.

<!-- guide:troubleshooting -->
## Troubleshoot by symptom

| Symptom | First check | What to do |
|---|---|---|
| No charts, but text is visible | Safe mode or missing chart script | For a trusted file, check View › Safe mode and File › Import report; reopen its folder if assets are missing |
| Works in the editor, blank after export | Missing resources or script-generated content | Try the exported file offline and read the browser/load error; confirm the source assets are bundled |
| Filter appears but chart does not change | The chart's binding | In Data & drill-down, check that the chart uses the filtered dataset and field |
| A number jumps by 100,000 or 10,000,000 | Units already scaled | Confirm raw units and choose an unscaled format if the dataset already stores lakh/crore |
| Dataset refresh is blocked | Required column renamed or measure has text | Restore the exact header and fix the values in the new file, then preview again |
| A test didn't execute | Wrong tab, unavailable target, manual step or cap | Read the result and target. Open the correct tab, update the target and rerun or check manually |
| Tests show Stale | An edit happened after the last run | Run the relevant tests again against the new revision |
| Lost a change | Wrong working file or browser profile | Look in File › Versions, Recover, or Downloads; reopen the last exported HTML |
| PDF chart is hard to read | Large tab fitted to one page | Shorten the tab or use the storyline to put one chart on each slide |
| Copy or export is blocked | Browser permission or local-file restrictions | Try Save as or a download, or use an approved Chrome/Edge browser |

**When asking for help:** include the editor version (Help › About), browser and operating system, exact command, what you expected and what happened. Include a small non-confidential sample or a screenshot of the error and the Import report. Do not share client data in a public issue.

<!-- guide:faq -->
## Common questions

**Do I need Node, Python or admin rights?** No to edit dashboards. Open the standalone editor in your browser. Node or Python is optional if you want to connect an AI assistant through MCP. An office policy named **RemoteDebuggingAllowed** can prevent that connection; use the in-app Prompt option if so.

**Can someone read the exported file without the editor?** Yes, if its resources are bundled and its browser features are supported. Test it in a fresh tab and offline if necessary. They only need Mothership if they want to edit the file with the same tools.

**Does Mothership upload my file?** The editor itself processes files locally. The dashboard's own scripts, linked resources, installed plugins and any assistant you use can have their own network behaviour. Inspect the import report and follow your data-sharing policy.

**Does a password lock protect confidential data?** No. It deters editing inside Mothership. People who receive the HTML may still be able to read the data it contains. Use approved access control and minimise data before sharing.

**Why are some chart features missing?** Chart capabilities depend on the library and whether the original page exposes the live chart or data. Import report explains what was recognised. A screenshot or embedded website cannot be drilled down like a live chart.

**Can I use the tool without shortcuts?** Yes. Use the ribbon, the mode buttons, the outline and the Format panel. Search the guide from Help. Use **Help › Start here** for the step-by-step workflow.

**Can a browser version snapshot replace backup?** No. It lives in one browser profile. Export dated HTML files to a folder you can recover later.

**Can I work with a teammate?** Exchange a working copy, use versioned filenames and the comment tracker, and agree who edits the master file. There is no live co-editing or automatic merging of separate copies.
