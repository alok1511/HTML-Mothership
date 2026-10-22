# Third-party notices

Mothership itself is under the PolyForm Noncommercial License 1.0.0 (see `LICENSE`). That licence does **not** apply to the open-source libraries it bundles in `vendor/` so it works offline: each remains under its own licence, and the full texts are in [`licenses/`](licenses/). `dist/mothership-standalone.html` contains the same libraries, so share this file and `licenses/` with it.

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

**Test-only (not shipped).** `npm install` fetches [Highcharts](https://www.highcharts.com) 11.4.8 and [D3](https://github.com/d3/d3) 7.9.0 (ISC) as development dependencies so `tests/v4.test.js` can build test dashboards with them. Neither is copied into this repository or the zip. Highcharts is free for personal and non-commercial use only; Mothership never needs it, it simply works with the copy already inside a dashboard that uses it.

## Copyright notices and licence texts

| Library | Copyright | Licence text |
|---|---|---|
| marked | Copyright (c) 2018+, MarkedJS; Copyright (c) 2011-2018, Christopher Jeffrey | [`licenses/marked.LICENSE.md`](licenses/marked.LICENSE.md) |
| mammoth.js | Copyright (c) 2013, Michael Williamson | [`licenses/mammoth.LICENSE.txt`](licenses/mammoth.LICENSE.txt) |
| SheetJS Community Edition | Copyright (C) 2012-present SheetJS LLC | [`licenses/sheetjs.LICENSE.txt`](licenses/sheetjs.LICENSE.txt) |
| JSZip | Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso | [`licenses/jszip.LICENSE.md`](licenses/jszip.LICENSE.md) (used under MIT) |
| PDF.js | Copyright 2023 Mozilla Foundation | [`licenses/pdfjs.LICENSE.txt`](licenses/pdfjs.LICENSE.txt) |
| Chart.js | Copyright (c) 2014-2022 Chart.js Contributors | [`licenses/chartjs.LICENSE.md`](licenses/chartjs.LICENSE.md) |
| Apache ECharts | Copyright 2017-2024 The Apache Software Foundation | [`licenses/echarts.LICENSE.txt`](licenses/echarts.LICENSE.txt), [`licenses/echarts.NOTICE.txt`](licenses/echarts.NOTICE.txt), and for the parts of d3 it includes, [`licenses/echarts.LICENSE-d3.txt`](licenses/echarts.LICENSE-d3.txt) |
| Plotly.js | Copyright (c) 2021 Plotly, Inc | [`licenses/plotly.LICENSE.txt`](licenses/plotly.LICENSE.txt) |

The licence files are copied unchanged from each project's repository at the version listed above. Minified builds such as mammoth, SheetJS and Plotly also contain small dependencies of their own under permissive licences; see each project's repository for that list.

**Adding a library:** put the pinned file in `vendor/`, add a row to both tables, and copy its licence file (and any `NOTICE` file) into `licenses/`.

