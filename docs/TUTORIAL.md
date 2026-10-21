# Mothership tutorial

The same lessons as **Help › Tutorial** inside Mothership, where each step points at the right button and ticks itself off when you do it. Open a sample first (**File › Samples › Sales**).

## Lesson 1: Getting around

1. Open the sample sales dashboard.
2. Click any heading in the dashboard to select it. The Format panel on the right fills in.
3. Double-click the heading and type a new title. Press Enter or click away when done.
4. Undo it with Ctrl+Z (or Home › Undo), then redo with Ctrl+Y.
5. Zoom: press + in the bottom-right corner, then ⤢ Fit.

## Lesson 2: Tabs and pages

1. Turn the dashboard into tabs: Layout › Tabbed layout.
2. Add a text tab for a How-to page: Insert › Text tab.
3. Add a page header to it: Insert › Header. Double-click its text to edit.
4. Add a footer that shows under every tab: Insert › Footer.
5. Drag a tab in the left panel to reorder it, or rename it with a double-click.

## Lesson 3: Charts that explain themselves

1. Give every chart a title, subtitle and inference: Layout › Commentary.
2. Double-click a chart, open the Look tab, and pick a font and a "Dark pop-up". Press Apply.
3. Double-click a chart again, open Tooltip, choose "₹ crore" and Apply. Hover over the chart in Interact mode to see it.

## Lesson 4: Drill-down and filters

1. Double-click the "Sales by region" chart, open "Data & drill-down" and press "Use this data". Then Apply.
2. Add a filter pane: Layout › Filter pane, tick one or two fields, Save.
3. Switch to Interact (top right) and double-click a bar to drill down. Use the breadcrumb above the chart to go back.

## Lesson 5: Build from scratch

1. Add a row of KPI cards: Insert › KPI cards. Pick a dataset so the numbers follow the filters.
2. Add a new chart from data: Insert › Chart.
3. Add a section with its own title: Insert › Section. Select its title, then insert a chart into it.
4. Click any text and give it a hover pop-up in the right panel (Hover pop-up).

## Lesson 6: Review and AI prompt

1. Press 📍 Element at the top, click something, and write a comment.
2. Press ▭ Area and drag a box around part of the screen. Write a comment.
3. Switch to Interact, use a filter or drill down, then press ⚡ Interaction and describe what should change.
4. Press ✨ Prompt and copy the result into your AI assistant, with the exported file attached.

## Lesson 7: Brand and share

1. Design › Edit theme: change the primary colour and fonts. (Or Load brand to use a SKILL.md brand file.)
2. Present it: press ▶ Present (or F5). Arrow keys change tabs, Esc ends.
3. Export HTML to save the finished file on this laptop.

---

# Guide

The searchable version is under **Help › Guide**.

## Getting started

Mothership opens an HTML dashboard and lets you edit it like a PowerPoint deck. Everything runs in this browser tab. Nothing is uploaded and nothing is installed.

- **Open** a dashboard: File › Open, drag a file onto the window, or try File › Samples.
- If its charts don't show, use **File › Open folder** and pick the folder with its .js/.css/.json files. Mothership bundles them into one file.
- Or start from scratch with **File › New**.
- When done, **Export HTML** (top right). You get one .html file that opens in any browser and reopens here for more edits.**Edit** mode (top right) is for changing things. **Interact** mode is for using the dashboard like your audience will.

## Zoom and fitting the screen

Dashboards are designed for wide screens, so Mothership draws them at desktop width (1280 px or more) and shrinks them to fit the middle panel. The layout stays exactly as your audience sees it.

- Zoom with the − / + buttons in the bottom-right corner, or `Ctrl` + mouse wheel over the dashboard.
- **⤢ Fit** fits the whole width again.
- View › Draw at changes the width the page is drawn at: Laptop 1366, Tablet 820, Phone 390, or Full HD from Other.
- Hide the side panels from View › Panels for more room.

## Text, fonts and colours (any element)

- Click anything to select it. `Alt`+`↑` selects the parent.
- Double-click text to type. `Enter` or clicking away finishes.
- The **Home** tab and the **Format panel** (right) change font, size, colour, background, bold/italic, alignment, line height, letter spacing and case.
- The **Box** section sets width, height, padding, margin, corners and border.
- **Find & replace** (`Ctrl`+`F`) changes wording everywhere.
- Text drawn by the dashboard's own script is tagged *script-made*. Mothership re-applies your edit after the script runs.

## Hover pop-ups on anything

Select any element and type a note under **Hover pop-up** in the right panel, e.g. a definition or the data source. It appears when someone hovers over it (in Interact mode, when presenting and in the exported file).

**Pop-up style…** sets one look for all of them: background, text colour, border, size, corners. Tick "Use the same look for chart pop-ups" to match the charts.

## Charts: commentary, look and pop-ups

Double-click a chart (or select it and use the Charts tab). Chart settings has four tabs:

- **Commentary & size**: title, subtitle and inference (the "so what"), width and height.
- **Look**: font, text size and colour for axes and legend, legend position, and the hover pop-up's background, text, border, size and corners. Changes show on the chart straight away.
- **Tooltip**: what the pop-up says. Use placeholders like {label}, {value:cr}, {pct:pct}. Presets cover ₹ crore, ₹ lakh and share of total.
- **Data & drill-down**: see the next section.With a chart selected, the font box on the Home tab and the **Chart look** section of the right panel also style the chart. **Use on every chart** copies the look to all charts.

## Drill-down and data

Open Chart settings › **Data & drill-down**. Mothership looks inside the dashboard for the table the chart was made from (it matches the chart's labels to the columns). Press **Use this data**.

- **Show by / Drill to**: the levels, e.g. Region › State › City.
- **Double-click does**: drill to the next level, show the underlying records, filter every chart, or nothing.
- No table found? **Use the numbers drawn in this chart** gives you sorting, top N and rich pop-ups, or load a CSV/Excel/JSON file from the Data tab.
- The breadcrumb above a drilled chart takes viewers back up.

## Filter pane

Layout › **Filter pane**: choose the fields to filter by, the order, and whether the pane sits on the left or across the top. Every chart, KPI card and table linked to that dataset follows it. Drag its right edge to resize it.

## Building pages from scratch

The **Insert** tab has page parts. They go after whatever you have selected, or at the end of the current tab.

- **Header**: a coloured title banner. **Section**: a titled area with its own grid; select its title, then insert charts or KPI cards into it.
- **Columns**, **Heading**, **Paragraph**, **Callout**, and from More: divider, spacer, button link.
- **Footer**: source, owner, date and confidentiality, shown under every tab.
- **Chart**: a new bar, line, area, pie or doughnut chart from a dataset. It follows filters and can drill down.
- **KPI cards**: headline numbers. Linked to a dataset they recalculate with the filters; double-click a number to change what it shows.
- **Text tab**, **Chart tab**, **Tab from file**: new tabs, including How-to, FAQ and Methodology pages from Word, PowerPoint, Excel, PDF, Markdown or images.

## Tabs and moving charts

- Layout › **Tabbed layout** turns the page into tabs with a ribbon across the top (or down the left).
- Drag tabs in the left panel to reorder; use ⋯ to rename, hide, duplicate, add speaker notes or delete.
- Move a chart to another tab: drag its ⠿ handle onto the tab name in the dashboard's ribbon (hold `Ctrl` to copy), or use **Send to tab** in the right panel.
- Resize a chart block with its corner handle.

## Brand and theme

Design › **Load brand** reads colours, fonts and a logo from a brand skill file (SKILL.md, .skill or .zip) or a theme .json. **Edit theme** changes them by hand. **Brand check** finds off-brand colours, low contrast and charts without commentary.

## Comments and AI prompts

Use the 💬 buttons at the top (or the Review tab):

- **📍 Element**: click a part of the dashboard and write a comment. In Edit mode, the selected element is used.
- **▭ Area**: drag a box over the screen. Mothership records what is inside it.
- **⚡ Interaction**: comment on something you just did in Interact mode. Mothership remembers your recent steps (tabs, filters, drill-downs, pop-ups) and the current view; tick the steps that matter.Numbered pins mark each comment. Click a pin to edit, mark done or delete. **✨ Prompt** turns the comments into one clear set of instructions for any AI assistant (Claude, ChatGPT, Gemini, Copilot or your company tool). Attach the exported dashboard, or paste the file into the prompt when it is small. When exporting, you can leave the comments out of the file.

## Presenting

▶ **Present** (`F5`) shows the dashboard full screen, one tab at a time. `→` / `←` change tabs, `L` laser pointer, `B` blank screen, `Esc` ends. View › Presenter view opens a second window with notes, a timer and the next tab.

## Saving, versions and export

- **Export HTML** (`Ctrl`+`E`) saves one standalone file. In Chrome/Edge later exports overwrite the same file.
- **Save version** (`Ctrl`+`S`) keeps a named copy in this browser. **Versions** restores one. Mothership also autosaves.
- Print / PDF prints each tab on its own page.

## Plugins, recipes and brand skills

Plugins (.js) add buttons to the Plugins tab. Recipes (.json) replay a list of edits (tabs, theme, tooltips, filters) on any dashboard, which is handy for a monthly refresh. See docs/EXTENDING.md in the Mothership folder.

## Keyboard shortcuts

`Ctrl+Z / Ctrl+Y`Undo / redo`Ctrl+C, X, V`Copy, cut, paste blocks`Ctrl+D`Duplicate`Delete`Delete the selection`Enter`Edit the selected text`Esc`Deselect / cancel commenting`Alt+↑`Select the parent`Alt+→ / Alt+←`Next / previous tab`Ctrl+F`Find & replace`Ctrl+S`Save a version`Ctrl+E`Export HTML`Ctrl+Shift+E`Save as…`Ctrl+O`Open`Ctrl+wheel`Zoom the dashboard`F5`Present

## Problems and fixes

Charts are blankThe dashboard loads its libraries or data from separate files or the internet. Use File › Open folder. If it needs the internet, turn off View › Network lock."Use this data" doesn't appearThe data isn't in the page (it may be fetched from a server). Use "the numbers drawn in this chart", or load a CSV/Excel export from the Data tab.My text change came back after reloadThat text is written by the page's script. Mothership re-applies your edit after the script runs; if the script writes it later, edit it in the source data instead.Copy prompt didn't workSome browsers block copying from local files. Click in the prompt box, press Ctrl+A then Ctrl+C, or use Save as .md.Versions/autosave are offThe browser blocks storage for local files (some Firefox or locked-down setups). Export still works.The page looks squashedView › Draw at › Auto, then ⤢ Fit.
