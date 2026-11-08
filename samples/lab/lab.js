/* Two small, deterministic local fixtures for hands-on practice. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const close = document.body.dataset.lab === 'close';
  const input = $('lab-region'), defect = $('lab-defect'), nav = document.querySelector('.lab-nav nav');
  const regions = ['North', 'West', 'South'];
  const months = { october: '2026-10', november: '2026-11' };
  function rows(period, amounts) {
    return regions.flatMap((Region, i) => ['Retail', 'Business'].map((Segment, j) => ({
      Region, Segment, Period: period, Amount: amounts[i * 2 + j]
    })));
  }
  const october = rows(months.october, [110, 140, 120, 155, 100, 125]);
  const november = rows(months.november, [140, 160, 155, 190, 120, 150]);
  window.labData = october;
  const amount = n => (close ? '₹' : '') + n.toLocaleString('en-IN') + (close ? ' lakh' : '');
  const set = (id, value) => { $(id).textContent = value; };
  let sort = 0;
  const chartOptions = { responsive: true, maintainAspectRatio: false, animation: false,
    scales: { y: { beginAtZero: true, suggestedMax: 275 } }, plugins: { legend: { display: false } } };
  const chart = (id, color) => new Chart($(id), { type: 'bar', data: { labels: [], datasets: [{ label: 'Amount', data: [], backgroundColor: color }] }, options: chartOptions });
  const summaryChart = chart('lab-summary-chart', '#396c81'), detailChart = chart('lab-detail-chart', '#7d5377');
  function sum(records) { return records.reduce((n, r) => n + r.Amount, 0); }
  function group(records, field) {
    return [...new Set(records.map(row => row[field]))].map(name => [name, sum(records.filter(row => row[field] === name))]);
  }
  function visibleRows() { return october.filter(row => !input.value || row.Region === input.value); }
  function drawTable(records) {
    if (sort) records = records.slice().sort((a, b) => sort * (a.Amount - b.Amount));
    $('lab-sort').parentElement.setAttribute('aria-sort', sort === 1 ? 'ascending' : sort === -1 ? 'descending' : 'none');
    $('lab-rows').replaceChildren(...records.map(row => {
      const tr = document.createElement('tr');
      for (const value of Object.values(row)) {
        const td = document.createElement('td'); td.textContent = value; tr.appendChild(td);
      }
      return tr;
    }));
  }
  function render() {
    const selected = visibleRows(), total = sum(selected), reported = total + (defect.checked ? 250 : 0);
    set('lab-total', amount(reported)); set('lab-source-total', amount(total)); set('lab-count', selected.length);
    set('lab-state', reported === total ? 'The reported KPI reconciles to the visible source records.' : 'Deliberate defect active. Compare the reported KPI with the source.');
    set('lab-detail-scope', (input.value || 'All regions') + ' · October source slice');
    for (const [item, data] of [[summaryChart, group(selected, 'Region')], [detailChart, group(selected, 'Segment')]]) {
      item.data.labels = data.map(([label]) => label);
      item.data.datasets[0].data = data.map(([, value]) => value);
      item.update('none');
    }
    const leader = group(selected, 'Region').sort((a, b) => b[1] - a[1])[0];
    const segment = group(selected, 'Segment').sort((a, b) => b[1] - a[1])[0];
    set('lab-summary-inference', leader[0] + ' has the highest amount in view at ' + amount(leader[1]) + '.');
    set('lab-detail-inference', segment[0] + ' leads the segment mix at ' + amount(segment[1]) + '.');
    drawTable(selected);
  }
  function selectTab(next) {
    for (const b of nav.querySelectorAll('[role=tab]')) {
      const selected = b === next, panel = $(b.getAttribute('aria-controls'));
      b.setAttribute('aria-selected', String(selected)); b.tabIndex = selected ? 0 : -1;
      if (panel) panel.hidden = !selected;
    }
    requestAnimationFrame(() => {
      if (!$('lab-summary').hidden) summaryChart.resize();
      if (!$('lab-detail').hidden) detailChart.resize();
    });
  }
  function download(file, content) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: 'text/csv' }));
    a.download = file; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function ledgerCsv(data) { return 'Region,Segment,Period,Amount\n' + data.map(row => Object.values(row).join(',')).join('\n') + '\n'; }
  function csvButton(label, file, content) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.addEventListener('click', () => download(file, content));
    $('lab-downloads').appendChild(button);
  }
  nav.addEventListener('click', event => { const b = event.target.closest('[role=tab]'); if (b) selectTab(b); });
  nav.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...nav.querySelectorAll('[role=tab]')], index = tabs.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + tabs.length + (event.key === 'ArrowRight' ? 1 : -1)) % tabs.length];
    next.focus(); selectTab(next);
  });
  input.addEventListener('change', render);
  defect.addEventListener('change', render);
  $('lab-reset').addEventListener('click', () => { input.value = ''; defect.checked = false; sort = 0; render(); });
  $('lab-sort').addEventListener('click', () => { sort = sort === 1 ? -1 : 1; drawTable(visibleRows()); });
  if (close) {
    $('defect-control').hidden = true;
    csvButton('Download October CSV', 'monthly-close-2026-10.csv', ledgerCsv(october));
    csvButton('Download November CSV', 'monthly-close-2026-11.csv', ledgerCsv(november));
  } else {
    csvButton('Download expected numbers CSV', 'release-rehearsal-expected.csv', 'What,Category,Series,Value\nKPI: Reported total,,,750\n');
  }
  selectTab(nav.querySelector('[aria-selected=true]') || $('lab-tab-summary'));
  render();
})();
