# Third-party notices

Mothership bundles these open-source libraries in `vendor/` so it works offline. Each remains under its own licence.

| Library | Version | Licence | Used for |
|---|---|---|---|
| [marked](https://github.com/markedjs/marked) | 12.0.2 | MIT | Markdown → HTML |
| [mammoth.js](https://github.com/mwilliamson/mammoth.js) | 1.8.0 | BSD-2-Clause | Word (.docx) → HTML |
| [SheetJS Community Edition (xlsx)](https://github.com/SheetJS/sheetjs) | 0.18.5 | Apache-2.0 | Excel / CSV |
| [JSZip](https://github.com/Stuk/jszip) | 3.10.1 | MIT (dual MIT / GPL-3.0) | .pptx, .skill and plugin zips |
| [PDF.js](https://github.com/mozilla/pdf.js) (pdfjs-dist, legacy build) | 3.11.174 | Apache-2.0 | PDF import |
| [Chart.js](https://github.com/chartjs/Chart.js) | 4.4.1 | MIT | Sample dashboard only |
| [Apache ECharts](https://github.com/apache/echarts) | 5.5.0 | Apache-2.0 | Sample dashboard only |
| [Plotly.js (basic dist)](https://github.com/plotly/plotly.js) | 2.30.0 | MIT | Sample dashboard only |

The chart libraries are used only by the files in `samples/`. Mothership itself works with whatever chart library the child dashboard already includes.
