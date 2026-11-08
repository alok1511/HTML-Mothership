# Mothership practice lessons

Open Help › Tutorial in the editor, or follow the steps below. Start in the separate sales practice copy; you do not need your own dashboard.

For more detail see [the user guide](USER-GUIDE.md). Some steps can be checked automatically; others ask you to confirm what you saw.

## 1. Make your first edit (5 min)

Change a title, compare it with the original, then practise switching modes.

1. Select Edit. Double-click the large Sales Performance heading. Type Sales performance | Review copy and click outside it.
   **Check:** The heading changes and the document chip shows unsaved edits.
2. Choose Home › Undo and look at the heading. Choose Redo to bring your edit back.
   **Check:** Undo restores the original title. Redo restores your new title.
3. Choose Interact, then hover a bar on Sales by region.
   **Check:** A pop-up appears without selecting the chart. Switch back to Edit before continuing.

## 2. Build a reader guide (7 min)

Give someone who has never seen the dashboard a clear place to start.

1. Choose Layout › Tab ribbon on the one-page sample. Then choose Insert › Text tab and name it How to use.
   **Check:** The outline shows the dashboard and How to use tabs.
2. Add a short instruction on the new tab. Explain where to start, how to hover a chart and how to return to the overview.
   **Check:** You can open the new tab in Interact and follow its instructions.
3. Add a Methodology tab. Say that these are sample sales figures, note the time period, and define net sales.
   **Check:** A reader can tell where the figures come from, what they mean and when they apply.

## 3. Explain one chart (6 min)

Make one chart answer a question without your narration.

1. In Edit, double-click Sales by region. In Commentary & size add the period and a one-line takeaway. Apply.
   **Check:** The chart has a title, units or period, and a takeaway you can verify.
2. In the Tooltip settings choose a rupee or crore format for the sample rupee values. Apply and hover in Interact.
   **Check:** The tooltip names the region and shows a sensible amount. Compare one bar with the original.
3. Check the legend, colours and chart size. Try Fit, then draw at a phone width from View.
   **Check:** You can still read the title and know what the chart measures. Note anything that needs a wider layout.

## 4. Link data, filter and drill down (9 min)

Learn the difference between a displayed total and the rows behind it.

1. Open Sales by region › Data & drill-down. Use the suggested data, choose region then state, and apply a Sum of sales.
   **Check:** The chart now has a dataset and the two drill levels.
2. Choose Layout › Filter pane and add a field from the same dataset, such as channel.
   **Check:** A labelled filter appears. The bound chart should respond to that field.
3. Switch to Interact. Pick one filter choice, double-click a region, and use the breadcrumb and Reset to return.
   **Check:** The chart first changes scope, then breaks the selected region down by state. Check that you can return to the starting view.

## 5. Make the layout consistent (6 min)

Apply a readable, repeatable design and use the right units.

1. Choose Design › Region & currency. Set India, INR and lakh/crore.
   **Check:** The preview shows ₹ and Indian units. The original source values are unchanged.
2. Choose Design › Edit theme. Set a primary colour and a body font. Apply.
   **Check:** The theme is applied. Read the smallest text and check status colours are still meaningful.
3. Run the brand and accessibility checks. Fix one clear issue, such as a missing title or an unreadable colour.
   **Check:** The chosen issue is gone when you run the check again.

## 6. Review with someone else in mind (7 min)

Write feedback that a teammate can act on without asking you to explain it.

1. Choose Comment. Click a chart, write one specific requested change and add it.
   **Check:** The note appears in Comments and clicking it takes you back to the chart.
2. Add a reply with the expected result. Mark the note resolved only after checking the result.
   **Check:** The note has a clear decision trail. Open and resolved filters show the right items.
3. Open Prompt to preview how the comment turns into instructions. Keep the practice content local.
   **Check:** The prompt names the part, describes the change and lists a check you could perform.

## 7. Preview a monthly refresh (9 min)

Replace a small practice dataset without losing a chart’s settings.

1. Download the practice October CSV. Use Data › Load data to add it. Open Data › Manage and find the new dataset.
   **Check:** The practice dataset has three rows and is embedded.
2. Download the November CSV. In Data › Manage use Refresh from file next to the practice dataset. Pick November.
   **Check:** The preview shows three → four rows, October → November, and NetSales totals of 300 → 410. No data changes yet.
3. Apply the preview. Check the rows under Manage, then choose Undo.
   **Check:** After applying there are four rows. Undo restores three rows. A browser recovery version is available if storage works.

## 8. Draft, run and read test coverage (8 min)

Learn what planned, ran, passed and stale mean.

1. Choose Testing › Draft tests › Quick draft. Open Coverage before running anything.
   **Check:** The plan has cases, while executed and passed checks are still zero on a fresh practice copy.
2. Open the test plan and run it. Review one result and anything that needs a person.
   **Check:** The result says what ran and what was observed. A failed or partial result is not a pass.
3. Edit the heading again and reopen Coverage.
   **Check:** Results for the earlier revision are stale. Run the relevant checks again when your edits are ready.

## 9. Verify numbers against a source (8 min)

Compare independent expectations and avoid certifying values you did not supply.

1. Choose Testing › Numbers › Download the numbers as Excel. Inspect the columns.
   **Check:** Each row identifies a chart point or KPI. The values already in the workbook are a starting template, not independent evidence.
2. For practice only, change one chart value and clear the other Value cells. Import it as expected numbers.
   **Check:** The import matches one value. The other values remain unverified. In real work, use the number from your independent source.
3. Run the case for that chart and read the mismatch. Correct the practice workbook or remove the practice expectation.
   **Check:** The result names the value it checked and the mismatch. Nothing claims that other figures matched the source.

## 10. Prepare a handout and a presentation (6 min)

Check what a reader sees and what stays in the working file.

1. Add a speaker note from the tab’s menu. Rename the tab and open Presenter view.
   **Check:** The note stays with the renamed tab. Use Esc to exit.
2. Use Consulting › PDF or PowerPoint on the practice file. Open the output.
   **Check:** Tabs become pages or slides; chart pictures are legible at normal size. Review the footer and no missing content.

## 11. Export and check a standalone copy (8 min)

Save, reopen and verify the exact file you would share.

1. Choose File › Ready to publish? and read the findings. Under Offline check, download the test copy.
   **Check:** The file opens without the editor. Disconnect and visit its tabs, filters and chart pop-ups before recording a pass.
2. Export HTML with a new filename. Open that export in a browser and check it shows just the dashboard.
   **Check:** The file opens without the editor. It can also reopen in Mothership for editing.
3. Save the validation record. For a viewer release, set a version and as-of date under Publish and check that separate file.
   **Check:** The record identifies a working revision and what was checked. The published copy has the intended data, comments and release details.

## 12. Build and apply a recipe (7 min)

Turn a repeatable report edit into a recipe you can use next month.

1. Open Plugins › Recipe workshop and choose Executive review pack. Hover or focus the question-mark help beside Make it yours.
   **Check:** The list describes the edits in plain language and the pop-up explains how to change their order.
2. Edit the Executive brief step and change its Tab title to Board brief. Save the step. Choose Check targets.
   **Check:** Board brief is listed as a new tab. No dashboard edits have been applied yet.
3. Choose Apply recipe, close the workshop, and open Board brief.
   **Check:** The brief has a decision question and a headline prompt. Applying the same recipe again keeps the matching tab.
4. Open the workshop again. Use Capture dashboard setup to create a recipe from the edited dashboard. Check the steps, then use Download recipe to save it.
   **Check:** The downloaded JSON can be loaded into another workshop. You can also choose Export skill ZIP or Export plugin JS.
5. Optionally choose Draft with AI. Pick Terra or Sonnet, describe one repeatable edit and preview the prompt. If you use a work assistant, paste the returned recipe back for review.
   **Check:** The prompt names your chosen model. Check targets lets you review an imported draft before applying it.

The monthly refresh lesson’s CSV downloads are available inside the tutorial. For offline practice without the editor tutorial, use [October](practice/sales-practice-2026-10.csv) and [November](practice/sales-practice-2026-11.csv).
