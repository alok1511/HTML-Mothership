// Test dashboards for chart libraries Mothership can't ship (Highcharts is not free for
// commercial use) or doesn't bundle (D3). The libraries come from node_modules (devDependencies).
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const lib = p => fs.readFileSync(path.join(ROOT, 'node_modules', p), 'utf8').replace(/<\/script/gi, '<\\/script');

exports.highcharts = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Claims dashboard</title>
<script>${lib('highcharts/highcharts.js')}</script></head><body>
<h1>Claims dashboard</h1>
<h2>Claims by region</h2><div id="claimsRegion" style="height:320px"></div>
<h2>Claims by line</h2><div id="claimsLine" style="height:320px"></div>
<script>
Highcharts.chart('claimsRegion', { chart: { type: 'column' }, title: { text: 'Claims paid by region' },
  xAxis: { categories: ['West', 'North', 'South', 'East'] }, yAxis: { title: { text: '₹' } },
  series: [{ name: 'Claims paid', data: [42000000, 31000000, 25000000, 12000000] }] });
Highcharts.chart('claimsLine', { chart: { type: 'pie' }, title: { text: 'Claims by line of business' },
  series: [{ name: 'Claims', data: [{ name: 'Motor', y: 55000000 }, { name: 'Health', y: 35000000 }, { name: 'Fire', y: 20000000 }] }] });
</script></body></html>`;

exports.d3 = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Premium dashboard</title>
<script>${lib('d3/dist/d3.min.js')}</script></head><body>
<h1>Premium dashboard</h1>
<h2>Premium by region</h2><div id="premium"></div>
<script>
var data = [{ region: 'West', premium: 52000000 }, { region: 'North', premium: 38000000 }, { region: 'South', premium: 30000000 }, { region: 'East', premium: 15000000 }];
var svg = d3.select('#premium').append('svg').attr('width', 520).attr('height', 260).attr('aria-label', 'Premium by region');
var x = d3.scaleBand().domain(data.map(d => d.region)).range([40, 500]).padding(0.2), y = d3.scaleLinear().domain([0, 60000000]).range([230, 10]);
svg.append('g').attr('class', 'axis').attr('transform', 'translate(0,230)').call(d3.axisBottom(x));
svg.selectAll('rect.bar').data(data).enter().append('rect').attr('class', 'bar').attr('x', d => x(d.region)).attr('y', d => y(d.premium)).attr('width', x.bandwidth()).attr('height', d => 230 - y(d.premium)).attr('fill', '#4e79a7');
</script></body></html>`;
