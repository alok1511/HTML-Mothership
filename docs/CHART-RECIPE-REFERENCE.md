# Mothership chart recipes and reference audit

Open **Charts › Chart layouts › McKinsey references**. Search for an exhibit, choose one of its layouts, then use **Sample data** to practice or select your own dataset and match its columns. The examples use synthetic values. They use Mothership’s chart styling and can be exported offline.

The audit covers 26 requested links. Fifteen use layouts available in v4.1, six use one of five newly added layouts, three use adaptations, and two are collections. The recommendations below map chart forms and analytical intent to Mothership. Exhibit text, images and data remain with the publisher.

## Reference audit

| Reference | Coverage | Layout IDs | Data and interpretation |
| --- | --- | --- | --- |
| [Autonomous mobility gains ground](https://www.mckinsey.com/featured-insights/charts/autonomous-mobility-gains-ground) | Adapted | `scenario-columns`, `actual-forecast` | Use historical deployments and explicitly labeled adoption scenarios. The requested exhibit was unavailable. The publisher’s related shared-mobility research supports this as a suggested form. |
| [From prompt to purchase](https://www.mckinsey.com/featured-insights/charts/from-prompt-to-purchase) | Already supported | `stacked-ranked` | Use one row per category and purchase-frequency group. Rank by total and keep the repeat and one-time shares on the same denominator. |
| [When electricity costs outpace growth](https://www.mckinsey.com/featured-insights/charts/when-electricity-costs-outpace-growth) | Already supported | `parity-scatter` | Plot comparable annual growth rates on both axes. Use equal scales, label the parity line, and explain what either side means. |
| [Where tech investment could surge](https://www.mckinsey.com/featured-insights/charts/where-tech-investment-could-surge) | New standard layout | `scenario-columns`, `growth-multiples` | Distinguish prior actual, observed half-year and extrapolated full-year. Compare full-year values for the multiple. Never add the observed half-year to the full-year forecast. |
| [Beauty’s elusive billion](https://www.mckinsey.com/featured-insights/charts/beautys-elusive-billion) | New standard layout | `threshold-dot-grid`, `ranked-highlight`, `stacked-ranked` | Count each category above each threshold. Dot units are consistent across panels. The thresholds overlap, so read each panel independently. |
| [Energy’s latest chokepoint](https://www.mckinsey.com/featured-insights/charts/energys-latest-chokepoint) | Already supported | `bubble-impact`, `mix-100` | Use duration on X, peak impact on Y and average disruption for size. Add a separate 100% mix chart for composition. Keep the units and basis visible. |
| [AI job losses fall short of forecasts](https://www.mckinsey.com/featured-insights/charts/ai-job-losses-fall-short-of-forecasts) | Already supported | `mix-100` | Keep expected and reported outcomes in separate bars. Retain unchanged and uncertain responses and show the survey wave and denominator. |
| [Caution crops into farmers’ spending](https://www.mckinsey.com/featured-insights/charts/caution-crops-into-farmers-spending) | Adapted | `dumbbell`, `gap-pairs` | Bind country, survey wave and net spending intent. Use the zero reference and report point changes. The published page confirms the comparisons. Exact exhibit geometry was unavailable. |
| [Affordability strains Americans’ aspirations](https://www.mckinsey.com/featured-insights/charts/affordability-strains-americans-aspirations) | Already supported | `ranked-highlight` | Use separate rankings for overall barriers and cost categories among the subset reporting cost strain. State each denominator next to its chart. |
| [Household wealth watch](https://www.mckinsey.com/featured-insights/charts/household-wealth-watch) | Already supported | `stacked-area` | Use consistently valued regional components, one shared unit and period definitions. Distinguish changes in asset prices from net investment in a separate bridge. |
| [From likes to buys](https://www.mckinsey.com/featured-insights/charts/from-likes-to-buys) | Already supported | `parity-scatter` | Plot net trust for each source for two cohorts on equal axes. Keep negative scores and state the sample sizes and net-trust formula. |
| [Transparency and trust for AI in nursing](https://www.mckinsey.com/featured-insights/charts/transparency-and-trust-for-ai-in-nursing) | Already supported | `ranked-highlight` | Rank survey responses. Show the sample and state that multi-select answers may sum to more than 100%. |
| [Human skills in the age of automation](https://www.mckinsey.com/featured-insights/charts/human-skills-in-the-age-of-automation) | Adapted | `percentile-curve`, `comparison-dots` | Build the ranked curve across all skills and annotate selected percentile points. A separate dot comparison can show named skills. The standard curve supports callouts, while the original overlays a larger marked subset. |
| [Stars, stripes, and supply chains](https://www.mckinsey.com/featured-insights/charts/stars-stripes-and-supply-chains) | Already supported | `overlap-venn` | Use one row per product with three flags and an exposure measure. Test that all eight combinations reconcile to the total. Circle area is schematic. |
| [America powered to compete](https://www.mckinsey.com/featured-insights/charts/america-powered-to-compete) | New standard layout | `stacked-area-benchmark`, `stacked-area` | Stack consumption components and overlay domestic production on the same axis. Use the gap to describe where production exceeds or falls short of consumption. |
| [Manufacturing chart collection](https://www.mckinsey.com/featured-insights/charts#/tag/manufacturing) | Collection | `range-dots`, `scenario-columns`, `stacked-ranked` | Start with supplier performance ranges, capacity scenarios or ranked output mix. The link is an index of changing exhibits. |
| [The AI advantage in B2B pricing](https://www.mckinsey.com/featured-insights/charts/the-ai-advantage-in-b2b-pricing) | New standard layout | `comparison-dots` | Use one row per activity and technology-horizon pair. Use a shape and color for each pair, and keep survey expectations visually distinct from current use. |
| [Trauma’s toll on the workforce](https://www.mckinsey.com/featured-insights/charts/traumas-toll-on-the-workforce) | Already supported | `gap-pairs` | Pair the same survey measures for two cohorts and label percentage-point differences. Keep sample sizes and describe results as associations. |
| [The aerospace supplier split](https://www.mckinsey.com/featured-insights/charts/the-aerospace-supplier-split) | Already supported | `range-dots`, `small-multiples` | Use one row per supplier per period and choose the lower and upper percentile. Repeat the layout for each period with comparable axis bounds. |
| [AI agents raise cybersecurity stakes](https://www.mckinsey.com/featured-insights/charts/ai-agents-raise-cybersecurity-stakes) | Already supported | `mix-100`, `stacked-ranked` | Compare budget composition across domains and years. Use 100% bars for share and ranked stacks for absolute spend. Label projected amounts. |
| [Scaling smart roads](https://www.mckinsey.com/featured-insights/charts/scaling-smart-roads) | Already supported | `mix-100`, `stacked-ranked` | Use one category per technology and a series per adoption stage. Keep stage order consistent and verify that each technology’s responses reconcile. |
| [Batteries back the grid](https://www.mckinsey.com/featured-insights/charts/batteries-back-the-grid) | New standard layout | `scenario-columns`, `actual-forecast` | Use observed installation and separate scenario series. Sort periods and keep each scenario's assumption and endpoint explicit. |
| [AI to browse but not to buy](https://www.mckinsey.com/featured-insights/charts/ai-to-browse-but-not-to-buy) | Already supported | `dot-matrix-stats` | Make separate groups of 100-dot cards for shopping uses and trust. Label the survey question and respondents for each. |
| [When populations age](https://www.mckinsey.com/featured-insights/charts/when-populations-age) | Already supported | `pyramid` | Use one pyramid per country or income group and period. Keep age bins and axis scale consistent across panels. State whether the values are counts or shares. |
| [Cutting back on quick bites](https://www.mckinsey.com/featured-insights/charts/cutting-back-on-quick-bites) | New standard layout | `cohort-bars` | Use signed net intent, zero baseline and separate views by generation or income. Use identical scales and show sample size where available. |
| [McKinsey Global Institute: 2025 in charts](https://www.mckinsey.com/mgi/our-research/mckinsey-global-institute-2025-in-charts) | Collection | `small-multiples`, `stacked-ranked`, `bridge`, `growth-multiples`, `comparison-dots`, `bubble-impact`, `quadrant-2x2`, `benchmark-scorecard`, `marimekko`, `line-focus` | A collection of exhibits on productivity, trade, technology, climate and demographics. See the Markdown audit for how to reproduce the main forms and where to use a substitute. |

The related autonomous-mobility article informs the suggested scenario layout. The original exhibit’s exact geometry remains unverified. [From science fiction to reality: The next phase of shared autonomous mobility](https://www.mckinsey.com/industries/automotive-and-assembly/our-insights/from-science-fiction-to-reality-the-next-phase-of-shared-autonomous-mobility)

The full beauty research describes the original equal-count cells and category colors. [Billion-dollar beauty: The odds of scaling a breakout brand](https://www.mckinsey.com/industries/consumer-packaged-goods/our-insights/billion-dollar-beauty-the-odds-of-scaling-a-breakout-brand)

### MGI 2025 in Charts

| Exhibit or section | Mothership layout | How to adapt it |
| --- | --- | --- |
| Productivity concentrated among standout firms | `ranked-highlight`, `stacked-ranked` | Show signed contributions separately where they offset. Add the share of firms behind the highlighted result. |
| Sources of household wealth creation | `bridge` | Start with opening wealth, add the components and label closing wealth. Check that the components reconcile. |
| ESG indicators over time | `small-multiples`, `growth-multiples` | Use a panel per indicator and disclose units. An indexed baseline makes growth comparable. |
| Indonesia’s path to high-income status | `line-focus`, `comparison-dots`, `stacked-ranked` | Use a trend with country comparators and a second chart for the components of each growth scenario. |
| The geometry of global trade | `small-multiples` | Put distance, geopolitical distance and concentration in separate panels. Mark the common comparison period. |
| Import rearrangement difficulty | `bubble-impact` | Plot the rearrangement ratio, use an ordered sector index on Y and put the sector name in the tooltip or caption. This approximates a categorical bubble grid. |
| People, agents and robots | `quadrant-2x2`, `marimekko` | Use a matrix to explain the categories and an area-based chart for shares. Label the human-capability subset separately. |
| Largest companies then and now | `benchmark-scorecard` | Use side-by-side ranked tables or two ranked charts. State market-cap dates and units. |
| Low-emissions technology deployment | `comparison-dots` | Put both observations and the required pace on a common scale. Highlight domains furthest below target. |
| Climate adaptation costs | `marimekko` | Use width for each hazard’s total cost and height for intervention mix. Reconcile each hazard and overall total. |
| Working-age population waves | `line-focus` | Keep cohort lines on a shared percentage scale and label the boundary between observation and projection. |
| Work experience and pay | `bridge`, `small-multiples` | Use one bridge for the overall gap and consistent panels for the component evidence. Use USD only when the source calls for currency. |

[McKinsey Global Institute: 2025 in charts](https://www.mckinsey.com/mgi/our-research/mckinsey-global-institute-2025-in-charts)

## Copy into Mothership

1. Open a practice copy or your dashboard. In **Plugins › Recipe workshop**, choose **Paste recipe**.
2. Copy a JSON block below. Pick **Check targets**, then **Apply** after reviewing the steps. Undo reverses the recipe as one action.
3. Use **Edit layout** to change the data and regenerate a suggested headline. Use **Reshape** for the chart’s categories, series, order and filters.
4. Save the tested recipe for your team. Use **Export skill** to give an assistant a repeatable workflow or **Export plugin** to add a button that runs the recipe in Mothership.

### Try on sample data

```json
{
  "$type": "mothership/recipe",
  "name": "Capacity scenario brief",
  "description": "Create an editable scenario chart on synthetic data and add an interpretation tab.",
  "steps": [
    {
      "do": "api",
      "tool": "chart_layouts",
      "args": {
        "action": "insert",
        "layout": "scenario-columns",
        "sample": true,
        "source": "Synthetic storage-capacity scenario exercise"
      }
    },
    {
      "do": "ensureTab",
      "title": "Scenario notes",
      "markdown": "# Scenario notes\n\n**Key inference.** Compare the spread at the final projected date.\n\n**So what.** Identify the capacity decision that changes between the low and high paths. Check lead time before changing commitments.\n\n**Methodology.** Historical values are observations. Future values are separate assumptions. Compare the same unit and time horizon."
    }
  ]
}
```

### Bind to your own data

Load a dataset named **Capacity outlook** with **Period**, **Scenario**, and numeric **New capacity** columns. Put the historical rows in a series named **Observed** and give each future scenario its own series. Use one row per period and scenario. Select **Overview** before applying. To reuse the recipe elsewhere, change the dataset, column, scenario and tab names to match.

```json
{
  "$type": "mothership/recipe",
  "name": "Capacity forecast review",
  "description": "Build a scenario chart from the Capacity outlook dataset.",
  "steps": [
    {
      "do": "api",
      "tool": "chart_layouts",
      "args": {
        "action": "insert",
        "layout": "scenario-columns",
        "dataset": "Capacity outlook",
        "fields": {
          "cat": "Period",
          "grp": "Scenario",
          "val": "New capacity"
        },
        "options": {
          "actual": "Observed"
        },
        "subtitle": "New capacity, GWh, by year and scenario",
        "source": "Planning team forecast",
        "title": "Capacity forecast review"
      }
    },
    {
      "do": "api",
      "tool": "chart_settings",
      "each": {
        "titleExact": "Capacity forecast review",
        "tab": "Overview"
      },
      "args": {
        "inference": "Compare the spread at the decision horizon before committing capacity."
      }
    }
  ]
}
```

### New layout field reference

| Layout ID | Columns | Options and checks |
| --- | --- | --- |
| `comparison-dots` | `cat` activity or measure, `grp` series, `val` value | Two to eight series in comparable units. Dot shapes and colors identify the series. Missing pairs remain blank. |
| `scenario-columns` | `cat` period or theme, `grp` scenario, `val` value | Set `actual` to the observed series name. Order the source rows by period. Missing pairs remain blank. |
| `stacked-area-benchmark` | `cat` period, `grp` component or benchmark, `val` value | Set `benchmark` to the line series name. Use additive components and the same units for the line and stack. |
| `cohort-bars` | `cat` measure, `grp` cohort, `val` signed value | Use a common zero baseline. Keep missing values blank and state the survey denominator. |
| `threshold-dot-grid` | `cat` threshold, `grp` category, `val` non-negative whole count | Use ascending thresholds and exact counts. Change data through Edit layout to regenerate the dot groups. |

Use **Chart layouts** to see the required fields for the older layouts. If you use the local Mothership tools, call `chart_layouts` with `action: "list"` for field IDs and `action: "preview"` to see the suggested headline on your data.

## Turn an existing chart into a decision aid

1. Select the chart and open **Charts › Reshape**. Choose the type, binding, calculation and category order. Hide series or add a chart-only filter if it focuses the comparison. A chart imported with only plotted values can still be styled. To regroup records, attach a dataset in **Charts › Settings** or rebuild the chart from the original data.
2. In **Charts › Settings**, use the headline to say what changed, the subtitle to name the metric and scope, and **Key inference** to explain the consequence or next decision. Example headline: “Demand exceeded capacity in two regions.” Example inference: “Check the backlog and capacity lead times before shifting inventory.”
3. Use one highlight for the evidence. Use a common scale for comparable panels, display a zero line for signed values, and add an annotation for a meaningful threshold. Record the data source and date in **Consulting › Source**.
4. Test the default view and an individual filter selection. The bound chart updates with the data. Handwritten headlines and inference lines stay as authored, so use wording that holds across the intended selections or add a caption from **Charts › Summaries** for a filter-aware readout of the evidence. Inspect the exported HTML at desktop and phone widths.

### Prompt to draft a new recipe

> Draft one valid Mothership recipe JSON object. Use these layout IDs, chart titles and dataset columns exactly as supplied. State the analytical question, choose one chart form, and give the reader a defensible headline, unit line and key inference. Use `chart_layouts` for insert or edit and `chart_settings` for commentary and visual emphasis. State how to verify the denominator, units, filter behavior, missing values and exported appearance. Put assumptions and evidence requirements in a Methodology or Notes tab.
