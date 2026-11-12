'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
const csv = rows => rows.map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n') + '\r\n';
const records = (fields, rows) => rows.map(row => Object.fromEntries(fields.map((key, i) => [key, row[i]])));
const table = (fields, rows, label) => '<div class="practice-table"><table aria-label="' + esc(label) + '"><thead><tr>' +
  fields.map(field => '<th scope="col">' + esc(field) + '</th>').join('') + '</tr></thead><tbody>' +
  rows.map(row => '<tr>' + row.map(value => '<td>' + esc(value == null ? '' : value) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
const paragraphs = (entries) => entries.map(([heading, body]) =>
  '<h3>' + esc(heading) + '</h3><p>' + esc(body) + '</p>').join('');
const questions = (entries) => entries.map(([question, answer]) =>
  '<details><summary>' + esc(question) + '</summary><p>' + esc(answer) + '</p></details>').join('');
const link = (label, name, rows) => '<a class="practice-download" download="' + esc(name) + '" href="data:text/csv;charset=utf-8,' + encodeURIComponent(csv(rows)) + '">' + esc(label) + '</a>';
const styles = `body{margin:0;background:#f2f6f5;color:#172d32;font-family:system-ui,sans-serif}
.practice-hero{background:var(--practice-ink);color:white;padding:clamp(19px,3vw,36px);border-bottom:4px solid #b9d7cc}
.practice-hero h1{margin:0;font-size:clamp(27px,4vw,52px);letter-spacing:-.045em}.practice-hero p{margin:.4em 0 0}
.practice-content{padding:18px;max-width:1000px;margin:auto}.practice-content h2{margin:0 0 .4em}
.practice-hero .practice-description{max-width:78ch;margin-top:12px;font-size:.92em;color:#edf6f4}
.practice-content details{margin:10px 0;padding:10px;background:white;border-radius:5px}.practice-content summary{cursor:pointer;font-weight:650}
.practice-content li{margin:.8em 0;max-width:78ch}.practice-check{border-left:4px solid var(--practice-ink);padding:.7em 1em;background:white}
.practice-download{display:inline-block;margin:0 .6em .7em 0;color:#113e47;text-underline-offset:3px;font-weight:650}
.practice-table{overflow:auto}.practice-table table{width:100%;border-collapse:collapse;background:white}.practice-table th,.practice-table td{text-align:left;padding:8px;border-bottom:1px solid #d8e4e0}
.practice-kpis{display:flex;gap:8px;flex-wrap:wrap;margin:0;padding:16px}.practice-kpis .kpi{border-left:3px solid var(--practice-ink);background:white;padding:7px 15px;min-width:120px}.practice-kpis strong{display:block;font-size:24px}
.practice-grid{padding:0 16px 16px}.practice-grid .ms-block{min-width:0}
@media(max-width:680px){.practice-grid .ms-block{grid-column:1/-1!important}.practice-content{padding:12px}}
`;

module.exports = function buildPractice(root, bundle) {
  const readCatalog = name => JSON.parse(fs.readFileSync(path.join(root, 'samples/practice', name), 'utf8'));
  const catalog = readCatalog('catalog.json');
  const business = readCatalog('business-catalog.json');
  const context = { MS: {} };
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/js/runtime.js'), 'utf8'), context);
  const runtime = context.MS.RUNTIME_SRC().replace(/<\/script/gi, '<\\/script');
  const library = fs.readFileSync(path.join(root, 'vendor/charts/chart.umd.min.js'), 'utf8').replace(/<\/script/gi, '<\\/script');
  for (const sample of [...catalog, ...business]) {
    const name = sample.id + '-practice.html';
    const dataset = sample.dataset || sample.title.charAt(0) + sample.title.slice(1).toLowerCase();
    const rows = records(sample.fields, sample.rows), related = sample.related || [];
    const sourceName = sample.id + '-2026-10.csv';
    const datasets = { [dataset]: { rows, source: 'file', file: sourceName } };
    const filters = sample.filters || (sample.filter ? [sample.filter] : []);
    const charts = {}, kpis = {};
    const card = ({ measure, label = measure, agg = 'sum' }, i) => {
      const key = 'practice-kpi-' + i;
      kpis[key] = { dataset, measure, agg, format: measure.includes('%') ? 'pct' : 'num' };
      return '<div class="ms-kpi kpi" data-ms-kpi="' + key + '"><span class="ms-kpi-label">' + esc(label) + '</span><strong class="ms-kpi-value">—</strong><span class="ms-kpi-note"></span></div>';
    };
    const blocks = sample.charts.map((chart, i) => {
      const key = 'practice-chart-' + i;
      const title = chart.title || chart.measure + ' by ' + chart.by;
      charts[key] = { title, native: { type: chart.type, legend: !!chart.series },
        binding: { dataset, levels: [chart.by].concat(chart.drill || []), measure: chart.measure, agg: chart.agg || 'sum', series: chart.series, sort: chart.sort || 'source' },
        drill: { mode: 'levels' }, summary: { show: 'caption' }, style: { legend: chart.series ? 'bottom' : 'none', axisFormat: chart.measure.includes('%') ? 'pct' : 'num' } };
      if (sample.dataset) {
        charts[key].source = { text: dataset + ' (synthetic)', asOf: '2026-10-31' };
        const style = charts[key].style;
        const seriesPalette = [sample.color, '#0B6B59', '#84632E', '#6A5385'];
        if (chart.series === 'Rating') style.colors = { High: '#AD3D3D', Medium: '#9A641B', Low: '#0B6B59' };
        else if (chart.series) style.colors = Object.fromEntries([...new Set(rows.map(row => row[chart.series]))]
          .map((label, index) => [label, seriesPalette[index % seriesPalette.length]]));
        else Object.assign(style, { highlight: [], restColor: sample.color });
      }
      return '<article class="ms-block ms-in-grid" style="grid-column:span ' + (sample.charts.length === 1 || sample.charts.length % 2 && i === sample.charts.length - 1 ? 12 : 6) + '">' +
        '<div class="ms-head"><div class="ms-title" role="heading" aria-level="3">' + esc(title) + '</div><div class="ms-sub">' + (sample.dataset ? 'Synthetic practice data' : 'Practice dataset') +
        '</div><div class="ms-inf">' + esc(chart.note || '') + '</div></div>' +
        '<div class="ms-crumbs"></div><div class="ms-visual" style="--ms-h:255px"><div data-ms-chart="' + key + '"></div></div></article>';
    }).join('');
    const relatedTables = related.map(entry => {
      const file = sample.id + '-' + entry.id + '.csv';
      datasets[entry.name] = { rows: records(entry.fields, entry.rows), source: 'file', file };
      return '<h3>' + esc(entry.name) + '</h3>' + link('Download ' + entry.name + ' CSV', file, [entry.fields].concat(entry.rows)) +
        table(entry.fields, entry.rows, entry.name);
    }).join('');
    const state = { datasets, charts, kpis,
      filters: filters.map(field => ({ dataset, field, label: field })),
      layout: { ribbon: { brand: sample.title, position: 'top' }, pane: { visible: filters.length > 0 } } };
    const data = '<div class="practice-content"><h2>Source data</h2><p>All ' + rows.length + ' rows in ' + esc(dataset) + ' before dashboard filters.</p>' +
      link(sample.nextRows ? 'Download October CSV' : 'Download source CSV', sourceName, [sample.fields].concat(sample.rows)) +
      (sample.nextRows ? link('Download November CSV', sample.id + '-2026-11.csv', [sample.fields].concat(sample.nextRows)) : '') +
      (sample.expectation ? link('Download expected numbers CSV', sample.id + '-expected.csv',
        [['What','Category','Series','Value'], ['KPI: ' + sample.expectation,'','',sample.rows.reduce((sum, row) => sum + row[sample.fields.indexOf(sample.expectation)],0)]]) : '') +
      table(sample.fields, sample.rows, dataset) + relatedTables + '</div>';
    const task = '<div class="practice-content"><h2>Practice ' + esc(sample.focus.toLowerCase()) + '</h2><p>Open this dashboard in Mothership to use the editor tools.</p><ol>' +
      sample.steps.map(step => '<li>' + esc(step) + '</li>').join('') + '</ol><p class="practice-check"><strong>Expected result</strong> ' + esc(sample.check) + '</p></div>';
    const overview = '<header class="practice-hero"><h1>' + esc(sample.title) + '</h1><p>' + esc(sample.question) + '</p>' +
      (sample.description ? '<p class="practice-description">' + esc(sample.description) + '</p>' : '') + '</header>' +
      '<div class="practice-kpis">' + (sample.kpis || sample.charts).map(card).join('') + '</div><div class="ms-grid practice-grid">' + blocks + '</div>';
    const tab = (key, title, content) => '<section class="ms-tab' + (key === 'overview' ? ' ms-active' : '') + '" data-ms-tab="' + key +
      '" data-ms-title="' + esc(title) + '" data-ms-kind="original">' + content + '</section>';
    const shell = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(sample.title) + '</title><style>' + styles + '</style><!-- practice-chart-library --></head><body style="--practice-ink:' + esc(sample.color) +
      '"><div id="ms-app"><nav id="ms-ribbon"></nav><div id="ms-body"><main id="ms-main">' + tab('overview','Overview',overview) +
      tab('source','Source data',data) +
      (sample.methodology ? tab('methodology','Methodology','<div class="practice-content"><h2>Methodology</h2>' + paragraphs(sample.methodology) + '</div>') : '') +
      (sample.faq ? tab('faq','FAQ','<div class="practice-content"><h2>FAQ</h2>' + questions(sample.faq) + '</div>') : '') +
      tab('practice','Practice tasks',task) + '</main></div></div>' +
      '<script id="ms-state" type="application/json">' + json(state) + '</script><!-- practice-runtime --></body></html>\n';
    const full = shell.replace('<!-- practice-chart-library -->', () => '<script data-ms-own data-ms-lib="chartjs">' + library + '</script>')
      .replace('<!-- practice-runtime -->', () => '<script id="ms-runtime" data-ms-own>' + runtime + '</script>');
    fs.writeFileSync(path.join(root, 'samples', name), full);
    bundle[sample.id] = { name, html: shell.replace('<!-- practice-runtime -->', ''), chartjs: true };
  }
  const describe = ({ id, title, focus, question }) => ({ id, title, focus, question });
  return { practiceSamples: catalog.map(describe), businessSamples: business.map(describe) };
};
