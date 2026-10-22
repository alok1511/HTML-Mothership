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

// A dashboard the way many are built: its own tab buttons, an inner scrolling area, cards with
// Chart.js charts and hand-made HTML legends. Used to test page tabs, comments and colours.
const vend = p => fs.readFileSync(path.join(ROOT, 'vendor', p), 'utf8').replace(/<\/script/gi, '<\\/script');
exports.owntabs = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Insurance portfolio dashboard</title>
<script>${vend('charts/chart.umd.min.js')}</script>
<style>
body{margin:0;font-family:Arial,sans-serif;background:#eef2f7;color:#1f2937;overflow:hidden}
.topbar{background:#0b2545;color:#fff;padding:14px 24px;height:34px;display:flex;align-items:center;gap:16px}
.topbar h1{font-size:20px;margin:0}
.tabs{display:flex;gap:4px;background:#13315c;padding:0 24px}
.tab-btn{background:none;border:0;color:#cbd5e1;padding:12px 16px;cursor:pointer;font-size:14px;border-bottom:3px solid transparent}
.tab-btn.active{color:#fff;border-bottom-color:#f4a261}
.content{height:calc(100vh - 107px);overflow-y:auto;padding:20px 24px;box-sizing:border-box}
.tab-panel{display:none}.tab-panel.active{display:block}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.card{background:#fff;border:1px solid #dbe2ea;border-radius:10px;padding:16px;margin-bottom:16px}
.card h3{margin:0 0 10px;font-size:15px;color:#13315c}
.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px}
.kpi{background:#fff;border:1px solid #dbe2ea;border-radius:10px;padding:14px}
.kpi .label{font-size:12px;color:#64748b;text-transform:uppercase}.kpi .value{font-size:26px;font-weight:700;color:#13315c}
.legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:13px}
.legend-item{display:flex;align-items:center;gap:6px}.swatch{width:12px;height:12px;border-radius:3px;display:inline-block}
.note{color:#64748b;font-size:13px;line-height:1.6}
a{color:#2a9d8f}
</style></head><body>
<header class="topbar"><h1>Insurance portfolio dashboard</h1><span>FY 2025</span></header>
<nav class="tabs"><button class="tab-btn active" data-tab="overview">Overview</button><button class="tab-btn" data-tab="claims">Claims</button><button class="tab-btn" data-tab="notes">Notes</button></nav>
<div class="content">
 <section id="overview" class="tab-panel active">
  <div class="kpis"><div class="kpi"><div class="label">Gross premium</div><div class="value">$12.4M</div></div><div class="kpi"><div class="label">Claims paid</div><div class="value">$7.1M</div></div><div class="kpi"><div class="label">Loss ratio</div><div class="value">57%</div></div></div>
  <div class="grid">
   <div class="card"><h3>Premium mix</h3><div style="height:240px"><canvas id="mix"></canvas></div>
    <div class="legend" id="mixLegend"><span class="legend-item"><span class="swatch" style="background:#264653"></span>Motor</span><span class="legend-item"><span class="swatch" style="background:#2a9d8f"></span>Health</span><span class="legend-item"><span class="swatch" style="background:#e9c46a"></span>Fire</span><span class="legend-item"><span class="swatch" style="background:#e76f51"></span>Marine</span></div></div>
   <div class="card"><h3>Premium by region</h3><div style="height:240px"><canvas id="region"></canvas></div></div>
  </div>
  <div class="card"><h3>Commentary</h3><p class="note">Motor remains the largest line. Health grew fastest. ${'Regional detail follows in the Claims tab. '.repeat(6)}</p></div>
  <div class="card" style="height:500px"><h3>Pipeline</h3><p class="note">A tall card so the page scrolls inside its content area.</p></div>
 </section>
 <section id="claims" class="tab-panel">
  <div class="card"><h3>Claims trend</h3><div style="height:260px"><canvas id="trend"></canvas></div></div>
  <div class="card"><h3>Claims by line</h3><div style="height:240px"><canvas id="lines"></canvas></div>
   <div class="legend"><span class="legend-item"><span class="swatch" style="background:#264653"></span>Motor</span><span class="legend-item"><span class="swatch" style="background:#2a9d8f"></span>Health</span><span class="legend-item"><span class="swatch" style="background:#e9c46a"></span>Fire</span><span class="legend-item"><span class="swatch" style="background:#e76f51"></span>Marine</span></div></div>
 </section>
 <section id="notes" class="tab-panel"><div class="card"><h3>How to read this dashboard</h3><p class="note">Figures are in US dollars. Loss ratio = claims paid / earned premium.</p></div></section>
</div>
<script>
document.querySelectorAll('.tab-btn').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.tab-btn').forEach(function (x) { x.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function (x) { x.classList.remove('active'); });
    b.classList.add('active'); document.getElementById(b.dataset.tab).classList.add('active');
  });
});
var C = ['#264653', '#2a9d8f', '#e9c46a', '#e76f51'], L = ['Motor', 'Health', 'Fire', 'Marine'];
new Chart(document.getElementById('mix'), { type: 'doughnut', data: { labels: L, datasets: [{ label: 'Premium', data: [5.1, 3.6, 2.2, 1.5], backgroundColor: C }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } } } });
new Chart(document.getElementById('region'), { type: 'bar', data: { labels: ['North', 'South', 'East', 'West'], datasets: [{ label: '2024', data: [2.1, 2.8, 1.9, 3.2], backgroundColor: '#94a3b8' }, { label: '2025', data: [2.6, 3.1, 2.2, 3.9], backgroundColor: '#13315c' }] }, options: { maintainAspectRatio: false } });
new Chart(document.getElementById('trend'), { type: 'line', data: { labels: ['Q1', 'Q2', 'Q3', 'Q4'], datasets: [{ label: 'Claims paid', data: [1.5, 1.9, 1.7, 2.0], borderColor: '#e76f51' }] }, options: { maintainAspectRatio: false } });
new Chart(document.getElementById('lines'), { type: 'bar', data: { labels: L, datasets: [{ label: 'Claims', data: [3.2, 2.1, 1.1, 0.7], backgroundColor: C }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } } } });
</script></body></html>`;

// The classic "w3schools" tabs: onclick="openTab(event, 'x')" and display:none panels.
exports.w3tabs = () => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ops dashboard</title>
<style>.tab{overflow:hidden;background:#f1f1f1}.tab button{float:left;border:none;padding:12px 16px;cursor:pointer}.tab button.active{background:#ccc}.tabcontent{display:none;padding:12px}</style></head><body>
<h1>Ops dashboard</h1>
<div class="tab"><button class="tablinks active" onclick="openTab(event, 'Summary')">Summary</button><button class="tablinks" onclick="openTab(event, 'Detail')">Detail</button></div>
<div id="Summary" class="tabcontent" style="display:block"><h3>Summary</h3><p>All systems normal.</p></div>
<div id="Detail" class="tabcontent"><h3>Detail</h3><p>Ticket backlog: 42.</p></div>
<script>
function openTab(evt, name) {
  var i, c = document.getElementsByClassName('tabcontent'), l = document.getElementsByClassName('tablinks');
  for (i = 0; i < c.length; i++) c[i].style.display = 'none';
  for (i = 0; i < l.length; i++) l[i].className = l[i].className.replace(' active', '');
  document.getElementById(name).style.display = 'block'; evt.currentTarget.className += ' active';
}
</script></body></html>`;
