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

1. **Open** a dashboard: File › Open, drag a file onto the window, or try File › Samples.
2. If its charts don't show, use **File › Open folder** and pick the folder with its .js/.css/.json files. Mothership bundles them into one file.
3. Or start from scratch with **File › New**.
4. When done, **Export HTML** (top right). You get one .html file that opens in any browser and reopens here for more edits.

**Edit** mode (top right) is for changing things. **Interact** mode is for using the dashboard like your audience will.

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
- **Data & drill-down**: see the next section.

With a chart selected, the font box on the Home tab and the **Chart look** section of the right panel also style the chart. **Use on every chart** copies the look to all charts.

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

Use the 💬 buttons at the top (or the Review tab) to leave comments:

- **📍 Element**: click a part of the dashboard. In Edit mode, the selected element is used.
- **▭ Area**: drag a box over the screen. Mothership notes the charts and text inside it.
- **⚡ Interaction**: comment on something you just did in Interact mode. Mothership remembers your recent steps (tabs, filters, drill-downs, pop-ups) and the current view.

Every comment records exactly **where** it is: tab › section › card or chart › item, plus the data point you clicked and where it sits on the page. Numbered pins mark each one; click a pin to edit, close or delete it.

### ✨ Prompt builder

Press **✨ Prompt**. Pick, and the prompt rewrites itself as you go:

1. **Which comments**: all open ones, only this tab, only must-fix, or pick by hand. A single comment also has **✨ Prompt for this one**.
2. **What you want**: make the changes, polish for leadership, check the numbers first, or just a plan and questions.
3. **Who will do it**: a **chat assistant** (you attach the file), a **coding agent** that has the file open, or an assistant connected to **Mothership over MCP**, which then uses Mothership’s own tools.
4. **Answer as**: the whole updated file, only the changes, a plan, or a task list for a developer.

Each comment in the prompt has its location, how to find it in the code, what the chart currently shows, and a **Done when** line so the assistant knows what success looks like. Copy it, save it as .md, or export the file to attach.

## Presenting

▶ **Present** (`F5`) shows the dashboard full screen, one tab at a time. `→` / `←` change tabs, `L` laser pointer, `B` blank screen, `Esc` ends. View › Presenter view opens a second window with notes, a timer and the next tab.

## Saving, versions and export

- **Export HTML** (`Ctrl`+`E`) saves one standalone file. In Chrome/Edge later exports overwrite the same file.
- **Save version** (`Ctrl`+`S`) keeps a named copy in this browser. **Versions** restores one. Mothership also autosaves.
- Print / PDF prints each tab on its own page.

## Plugins, recipes and brand skills

Plugins (.js) add buttons to the Plugins tab. Recipes (.json) replay a list of edits (tabs, theme, tooltips, filters) on any dashboard, which is handy for a monthly refresh. See docs/EXTENDING.md in the Mothership folder.

## Summaries, number check, tracker and compare

### 📰 Chart summaries

**Charts › Summaries** writes one or two plain sentences per chart from the numbers on screen, e.g. *“West is highest at ₹4.2 Cr (38%); East is lowest at ₹1.2 Cr.”* Trends say what rose or fell and by how much. For each chart choose **Caption under the chart**, **Screen readers only** or nothing. Captions follow the filters and stay in the exported file. **Copy all** gives you the lot for an email.

### 🧮 Number check

**Review › Number check** compares each KPI card with the chart that shows the same measure (by name, or by data for cards that calculate), and charts of the same measure with each other. Rounding on the card (₹16.2 Cr) is allowed for. Differences can be turned into review comments in one click. Percentages and row counts are not added up.

### 📗 Excel tracker

**Review › Excel tracker** saves every comment as a spreadsheet: number, status, priority, tab, section, chart, where exactly, the comment, what “done” means, owner, due date and notes, plus a summary sheet by tab and priority. Use it in the review meeting, then **Update from tracker** loads status, priority, owner, due date, notes and wording back. Keep the ID column.

### ⚖ Compare versions

**File › Compare** shows what changed between two saved versions, the dashboard now, or a file on this laptop: tabs added, renamed or removed, text changes (old crossed out, new in green), chart settings, data, KPI cards, filters, colours and comments. **Side by side** shows both dashboards next to each other. **Copy the list** for your change note.

## Chart libraries

| Library | What works |
|---|---|
| Chart.js, ECharts, Plotly | Everything: look, pop-ups, colours, order, data, drill-down, images, summaries. |
| Highcharts | Everything as above. Mothership uses the Highcharts already inside your dashboard (it is not free for commercial use, so Mothership doesn't include it). |
| D3 and other SVG charts | Names, pop-ups, colours, look (fonts), summaries, number check, image and comments. The page's own script draws them, so Mothership can't redraw them from other data or drill down: rebuild with **Insert › Chart** for that. |

Charts drawn as plain images can't be read; ask for the data behind them.

## Mothership theme and search

Make Mothership itself easier on the eyes. Your dashboard is not affected.

- **🎨** in the top bar, View › **Theme**, or the welcome screen: 8 ready-made looks (Classic, Daylight, Ocean, Forest, Saffron, Midnight, Slate dark, High contrast).
- Pick light, dark, “Match Windows” or high contrast; any accent colour (or **Match brand** after loading a brand); a coloured or plain top bar; comfortable or compact spacing; text size; ribbon labels or icons only.
- View › **Dark mode** switches in one click. Settings are saved in this browser.

### 🔍 Search everything

Press `Ctrl`+`K` (or the search box in the top bar) and type: any ribbon command, a chart name (to jump to it or open its settings), a tab, a dataset, a comment, or a help topic. ↑ ↓ and Enter.

## Region and currency

Mothership writes numbers in **US dollars, US style** ($1,234,567 and $1.23M) unless you choose otherwise. Change it in **Design › Region & currency**: pick a country (52 to choose from) and it fills in the currency and number style; then change the currency on its own if you need to (any currency, e.g. a UK dashboard in US $). **Big numbers** chooses K, M, B or lakh and crore. The preview shows what you will get.

| Choice | 1234567 as currency | short |
|---|---|---|
| United States | $1,234,567 | $1.23M |
| India | ₹12,34,567 | ₹12.35 L |
| Germany | 1.234.567 € | 1,23 Mio. € |
| United Kingdom | £1,234,567 | £1.23M |

### Where it applies

- Pop-ups and axes set to **Currency**, **Currency short** or **Short** (`{value:cur}`, `{value:curshort}`, `{value:short}`).
- KPI cards, chart summaries, the number check and the AI prompt rules.
- The setting is saved inside the dashboard, so viewers see the same thing. It is one undo step.

Formats you chose by name (₹ crore, ₹ lakh, US$) stay as they are, and numbers the dashboard's own script writes are not changed. If a dashboard clearly shows ₹, € or £, Mothership tells you in the status bar but doesn't switch on its own.

## Publishing and locking

Your working copy is for editing; a **published copy** is what you share.

### 🛡 File › Ready to publish?

A checklist before you share: script errors, charts with no numbers, untitled charts, KPI cards that don't match their charts, open must-fix comments, files that need the internet, file size and page title. Red means fix first; amber means take a look.

### 🚀 File › Publish

- **Version and release note**: 1.0, 1.1… counts on by itself. Each publish adds to the release log.
- **Corner badge**: “Version 1.1 · Published 22 Oct 2026 · Data as of 30 Sep 2026”. Click it for the release notes. It is hidden when printing.
- **Comments left out** unless you tick Keep.
- **Tamper check**: the file carries a fingerprint of itself (SHA-256). If someone changes it in Notepad or another tool and it is opened in Mothership again, you get a warning.
- **Lock editing with a password**: Mothership asks for it before opening the file for editing. Viewers never need it. The password is not stored, only a salted key (PBKDF2).
- If part of a published dashboard fails to load, viewers see a calm one-line message instead of a broken page.

### What the lock can and can't do

It is a **deterrent, not a vault**. An HTML file is text: anyone can open it in Notepad, and anything on screen can be copied or photographed. The lock stops casual edits in Mothership and the seal tells you if the file was changed. For real control use **SharePoint, OneDrive or Teams permissions** (view-only links, no download), your company's sensitivity labels, or a PDF. Keep confidential numbers out of files that leave the team.

## Use with AI assistants (MCP)

**MCP** (Model Context Protocol) lets an AI assistant use Mothership for you: “open sales.html, put the regions in North, South, East, West order on every chart, make Retail green, add a FAQ tab and save it”. The assistant calls Mothership’s tools; nothing goes to the internet from Mothership.

```
AI assistant ──▶ MCP server ──▶ Edge/Chrome ──▶ Mothership
(any client)    (Python/Node)   (hidden)        (MS.api)
```

### 1. Pick the server that your laptop allows

| You have | Run |
|---|---|
| Python 3.8+ (no pip needed) | `python tools/mcp/mothership_mcp.py` |
| Node.js 16+ (no npm install needed) | `node tools/mcp/mothership-mcp.js` |

Both need Edge or Chrome and offer the same ~75 tools. You don’t start them yourself: your AI assistant starts them.

### 2. Connect your assistant

**Claude Desktop**  
Settings › Developer › Edit config, then add (change the path):

```
{
  "mcpServers": {
    "mothership": {
      "command": "python",
      "args": ["C:\\Users\\you\\HTML-Mothership\\tools\\mcp\\mothership_mcp.py"],
      "env": { "MOTHERSHIP_OUT": "C:\\Users\\you\\Dashboards" }
    }
  }
}
```

Restart Claude Desktop. Use `"command": "node"` and `mothership-mcp.js` for the Node server.

**Claude Code**  
`claude mcp add mothership -- python tools/mcp/mothership_mcp.py` (the repo’s `.mcp.json` does this for the Node server).

**Your own Python script or agent**  
`tools/mcp/python_client.py` has a ready **MothershipClient** with nothing to install:

```
from python_client import MothershipClient
with MothershipClient() as ms:
    ms.call("open_file", path="sales.html")
    ms.call("category_order", order=["North", "South", "East", "West"])
    ms.call("category_colors", colors={"Retail": "#16a34a"})
    print(ms.call("export_html")["saved"])
```

With the official SDK (`pip install mcp`): `StdioServerParameters(command="python", args=["tools/mcp/mothership_mcp.py"])`. Any MCP-capable framework works the same way.

**Any other MCP client**  
Command `python` (or `node`), argument: the server file. Transport: stdio.

### 3. Ask in plain English

- “Open C:\Dashboards\claims.html and tell me what is on each tab.”
- “Use one order for regions on every chart: North, South, East, West. Make South green everywhere.”
- “Add a Methodology tab from methodology.docx and a footer saying Source: Finance, FY 2024-25.”
- “Take a screenshot of the Overview tab and check the numbers are in ₹ crore.”
- “Apply my review comments” (paste a prompt from ✨ Prompt with “Mothership MCP” chosen).

### Settings (optional “env”)

| `MOTHERSHIP_HEADLESS=0` | Show the browser window so you can watch the edits. |
|---|---|
| `MOTHERSHIP_ATTACH=9222` | Work in *your* window: start Edge with `msedge --remote-debugging-port=9222`, open mothership.html, then connect. |
| `MOTHERSHIP_OUT` | Folder for exports, prompts and screenshots. |
| `MOTHERSHIP_BROWSER` | Full path to msedge.exe or chrome.exe if it isn’t found. |
| `MOTHERSHIP_HTML` | Use dist/mothership-standalone.html instead. |

Exports never overwrite your original: they are saved as `<name>-edited.html`. Every change can be undone (“undo the last three changes”).

## FAQ

**Does Mothership send my data anywhere?**  
No. It runs in this browser from a local file. The MCP server only talks to a browser on this laptop (127.0.0.1). What your AI assistant does with the replies is governed by that assistant and your company’s policy.

**Do I need the internet or admin rights?**  
No for Mothership. No for the MCP server either: it is one file that runs with the Python or Node already on the laptop.

**My laptop has Python but not Node (or the reverse).**  
Use the matching server: `tools/mcp/mothership_mcp.py` for Python, `tools/mcp/mothership-mcp.js` for Node. They have the same tools.

**Neither Python nor Node is allowed.**  
Everything except MCP still works. Use ✨ Prompt to copy instructions into your approved AI assistant and attach the exported file.

**The server says it can’t find Edge or Chrome.**  
Set `MOTHERSHIP_BROWSER` to the full path, e.g. `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.

**It says DevTools refused the connection, or the browser closes at once.**  
Your IT policy may block remote debugging in Edge/Chrome (the “RemoteDebuggingAllowed” policy). Try the other browser, or ask IT. Without it, MCP can’t drive Mothership; prompts still work.

**How do I see what the assistant is doing?**  
Set `MOTHERSHIP_HEADLESS=0` to show the window, or ask it for a *screenshot*. To edit in your own window, use `MOTHERSHIP_ATTACH` (see the MCP section).

**Where are files saved? Can it overwrite my dashboard?**  
In `MOTHERSHIP_OUT` (or the folder the assistant was started in) unless the assistant gives a path. The default export name is `<name>-edited.html`, so the original is kept.

**Which AI assistants work?**  
Any MCP client: Claude Desktop, Claude Code, and many agent tools and IDEs. For chat tools without MCP, use ✨ Prompt and attach the file.

**Can the assistant see my comments?**  
Yes: *list_comments* and *comments_prompt* give it every comment with its tab, section and chart. Choose “Mothership MCP” in the prompt builder for instructions written for it.

**Can I change how Mothership looks?**  
Yes: 🎨 in the top bar (light, dark, accent colour, spacing, text size). Your dashboard’s own look is set from the Design tab.

**How do I find a command quickly?**  
`Ctrl`+`K` and type what you want.

**Does it work with Highcharts or D3?**  
Yes. Highcharts works fully. D3 (and similar SVG) charts get names, pop-ups, colours, fonts, summaries, the number check and comments, but not new data or drill-down. See Chart libraries.

**How do I check the numbers before sending?**  
Review › Number check. It flags KPI cards that don’t match their chart and charts of the same measure that add up differently.

**Can I track comments in Excel?**  
Yes: Review › Excel tracker, then Update from tracker to bring status, owner and due dates back.

**Can I change the currency from US $?**  
Yes: Design › Region & currency. Pick any country and any currency; it is saved in the dashboard.

**Can I lock the dashboard so no one else edits it?**  
Partly. File › Publish can lock editing in Mothership with a password, and Mothership warns if the file was changed elsewhere. But no HTML file can be truly locked: it can always be opened in Notepad. Use SharePoint or Teams view-only permissions for real control. See Publishing and locking.

**Will a KPI card turn red automatically?**  
Yes, if you set thresholds: double-click the KPI value › Status colours. It recalculates whenever filters change.

## Keyboard shortcuts

| `Ctrl+K` | Search commands, charts, tabs and help |
|---|---|
| `Ctrl+Z / Ctrl+Y` | Undo / redo |
| `Ctrl+C, X, V` | Copy, cut, paste blocks |
| `Ctrl+D` | Duplicate |
| `Delete` | Delete the selection |
| `Enter` | Edit the selected text |
| `Esc` | Deselect / cancel commenting |
| `Alt+↑` | Select the parent |
| `Alt+→ / Alt+←` | Next / previous tab |
| `Ctrl+F` | Find & replace |
| `Ctrl+S` | Save a version |
| `Ctrl+E` | Export HTML |
| `Ctrl+Shift+E` | Save as… |
| `Ctrl+O` | Open |
| `Ctrl+wheel` | Zoom the dashboard |
| `F5` | Present |

## Problems and fixes

**Charts are blank**  
The dashboard loads its libraries or data from separate files or the internet. Use File › Open folder. If it needs the internet, turn off View › Network lock.

**"Use this data" doesn't appear**  
The data isn't in the page (it may be fetched from a server). Use "the numbers drawn in this chart", or load a CSV/Excel export from the Data tab.

**My text change came back after reload**  
That text is written by the page's script. Mothership re-applies your edit after the script runs; if the script writes it later, edit it in the source data instead.

**Copy prompt didn't work**  
Some browsers block copying from local files. Click in the prompt box, press Ctrl+A then Ctrl+C, or use Save as .md.

**Versions/autosave are off**  
The browser blocks storage for local files (some Firefox or locked-down setups). Export still works.

**The page looks squashed**  
View › Draw at › Auto, then ⤢ Fit.


