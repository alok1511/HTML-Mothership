/* One filtered slice drives figures, charts, inferences, decisions and CSV. */
(function () {
  'use strict';
  const m = window.MSReportModel;
  const $ = id => document.getElementById(id);
  const text = (id, value) => { $(id).textContent = value; };
  const el = (tag, value) => { const e = document.createElement(tag); if (value !== undefined) e.textContent = value; return e; };
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
  const fmt = value => Number.isFinite(value) ? number.format(value) : '—';
  const rate = value => Number.isFinite(value) ? number.format(value) + '%' : '—';
  const pp = value => number.format(Math.abs(value)) + ' pp';
  const label = { period: m.period, region: 'State', segment: m.segment, group: m.group, base: m.base, outcome: m.outcome, units: m.unit };
  const dims = { period: m.periods, region: m.regions, segment: m.segments, group: m.groups };
  const demoRows = m.rows;
  const filters = ['period', ...(m.geography ? ['region'] : []), 'segment', 'group'];
  const charts = new Map(), pageSize = 18;
  let filtered = [], analysed = [], explorerPage = 0, sortBy = 'period', sortDirection = 1, sortedCache = null;
  const color = m.color;
  const pale = m.wash;
  const ns = 'http://www.w3.org/2000/svg';

  const empty = () => ({ base: 0, outcome: 0, units: 0, n: 0, rate: null });
  function accumulate(total, row) {
    total.base += row.base; total.outcome += row.outcome; total.units += row.units; total.n++;
  }
  function finish(total) { total.rate = total.base ? total.outcome / total.base * 100 : null; return total; }
  function aggregate(rows) {
    const total = empty();
    for (const row of rows) accumulate(total, row);
    return finish(total);
  }
  function addTo(map, name, row) {
    if (!map.has(name)) map.set(name, empty());
    accumulate(map.get(name), row);
  }
  function grouped(rows, field) {
    const buckets = new Map();
    for (const row of rows) addTo(buckets, row[field], row);
    return dims[field].filter(name => buckets.has(name)).map(name => ({ name, ...finish(buckets.get(name)) }));
  }
  function crossed(rows, first, second) {
    const groups = new Map();
    for (const row of rows) {
      if (!groups.has(row[first])) groups.set(row[first], new Map());
      addTo(groups.get(row[first]), row[second], row);
    }
    return groups;
  }
  function showGroups(rows, field, limit) {
    const groups = grouped(rows, field);
    if (groups.length <= limit) return groups;
    const show = new Set(groups.slice().sort((a, b) => b.base - a.base).slice(0, limit).map(g => g.name));
    return groups.filter(g => show.has(g.name));
  }
  function latest(rows, field) {
    const value = dims[field].findLast(v => rows.some(r => r[field] === v));
    return rows.filter(r => r[field] === value);
  }
  function sameBasis(rows, includePeriods = false) {
    if (m.latestGroup) rows = latest(rows, 'group');
    if (m.latestPeriod && !includePeriods) rows = latest(rows, 'period');
    return rows;
  }
  function pick(name, values) {
    const select = $('filter-' + name);
    select.replaceChildren(new Option('All', ''), ...values.map(v => new Option(v, v)));
  }
  function activeScope() {
    return filters.flatMap(field => {
      const v = $('filter-' + field).value;
      return v ? [label[field] + ' ' + v] : [];
    }).join(' / ') || 'All filters';
  }
  function initTabs() {
    const nav = document.querySelector('.report-tabs');
    function buttons() { return [...nav.querySelectorAll('[role=tab]')]; }
    function show(btn) {
      buttons().forEach(b => {
        const active = b === btn;
        b.setAttribute('aria-selected', String(active)); b.tabIndex = active ? 0 : -1;
        const p = $(b.getAttribute('aria-controls')); if (p) p.hidden = !active;
      });
      requestAnimationFrame(() => charts.forEach(chart => { if (!chart.canvas.closest('[hidden]')) chart.resize(); }));
    }
    nav.addEventListener('click', e => { const btn = e.target.closest('[role=tab]'); if (btn) show(btn); });
    document.querySelectorAll('[data-report-jump]').forEach(link => link.addEventListener('click', () => {
      const button = $(link.dataset.reportJump);
      if (button) { button.click(); button.focus(); }
    }));
    nav.addEventListener('keydown', e => {
      const all = buttons(), i = all.indexOf(e.target);
      if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const to = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length;
      all[to].focus(); show(all[to]);
    });
    // Exported dashboards may retain an active tab in their markup.
    const selected = buttons().find(b => b.getAttribute('aria-selected') === 'true');
    if (selected) show(selected);
  }
  function paint(id, type, labels, datasets, custom = {}) {
    const canvas = $(id);
    const title = $(canvas.getAttribute('aria-labelledby'))?.textContent;
    if (title) canvas.setAttribute('aria-label', title);
    const current = charts.get(id);
    if (current) { current.data.labels = labels; current.data.datasets.forEach((d, i) => Object.assign(d, datasets[i])); current.update('none'); return; }
    charts.set(id, new Chart(canvas, { type, data: { labels, datasets }, options: {
      animation: false, responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'nearest' },
      plugins: { legend: { display: false }, ...custom.plugins },
      scales: { x: { ticks: { color: '#43566a' }, grid: { display: false }, ...custom.x },
        y: { ticks: { color: '#43566a' }, grid: { color: '#e6ecf2' }, ...custom.y } },
      indexAxis: custom.indexAxis || 'x'
    } }));
  }
  function matrix(rows) {
    const [rowField, colField] = m.matrix || [m.driver, m.driver === 'segment' ? 'group' : 'segment'];
    const rr = showGroups(rows, rowField, 14), cc = showGroups(rows, colField, 12);
    const groups = crossed(rows, rowField, colField);
    const cells = rr.map(r => cc.map(c => finish(groups.get(r.name)?.get(c.name) || empty())));
    const values = cells.flat().filter(x => x.n);
    const high = Math.max(...values.map(x => x.rate)), low = Math.min(...values.map(x => x.rate));
    const table = el('table'), head = el('thead'), tr = el('tr');
    table.setAttribute('aria-label', m.rate + ' matrix');
    tr.appendChild(el('th', label[rowField]));
    cc.forEach(c => { const h = el('th', c.name); h.scope = 'col'; tr.appendChild(h); }); head.appendChild(tr);
    const body = el('tbody');
    let maxCell;
    rr.forEach((r, i) => {
      const row = el('tr'), h = el('th', r.name); h.scope = 'row'; row.appendChild(h);
      cells[i].forEach((c, j) => {
        const td = el('td', rate(c.rate));
        if (c.n) {
          const weight = high === low ? 22 : 12 + 22 * (c.rate - low) / (high - low);
          td.style.background = 'color-mix(in srgb, ' + color + ' ' + weight + '%, white)';
          if (!maxCell || (m.goodHigh ? c.rate < maxCell.value : c.rate > maxCell.value)) maxCell = { row: r.name, col: cc[j].name, value: c.rate };
        }
        row.appendChild(td);
      });
      body.appendChild(row);
    });
    table.append(head, body);
    $('report-matrix').replaceChildren(values.length ? table : el('p', 'No records in this slice.'));
    text('matrix-title', m.rate + ' by ' + label[rowField].toLowerCase() + ' and ' + label[colField].toLowerCase());
    text('matrix-inference', maxCell ? maxCell.row + ' / ' + maxCell.col + ' is the least favourable cell at ' + rate(maxCell.value) + '. The view has ' + values.length + ' populated cells, showing up to 14 rows and 12 columns by exposure.' : 'Choose a filter combination with records.');
  }
  function reportValues() {
    const overall = aggregate(analysed), rank = grouped(analysed, m.driver).sort((a, b) => b.base - a.base);
    const lead = rank[0], worst = rank.slice().sort((a, b) => m.goodHigh ? a.rate - b.rate : b.rate - a.rate)[0];
    const benchmark = overall.rate, requested = Number($('shock').value) * (m.goodHigh && !m.adverse ? 1 : -1);
    const counterfactual = lead ? (m.bounded ? Math.max(0, Math.min(100, lead.rate + requested)) : lead.rate + requested) : null;
    const applied = lead ? counterfactual - lead.rate : 0;
    const change = lead ? lead.base * applied / 100 : 0;
    return { overall, rank, lead, worst, benchmark, requested, counterfactual, applied, change };
  }
  function updateStory(v) {
    const { overall, lead, worst, benchmark, requested, counterfactual, applied, change } = v;
    const noData = 'No matching records. Change the filters to compare results.';
    text('base-value', fmt(overall.n ? overall.base : null));
    text('outcome-value', fmt(overall.n ? overall.outcome : null));
    text('unit-value', fmt(overall.n ? overall.units : null));
    text('rate-value', rate(overall.rate));
    if ($('brief-status')) {
      const difference = overall.rate === null ? null : overall.rate - m.target;
      text('brief-status', difference === null ? 'Choose a slice with records.' :
        rate(overall.rate) + ' closed on time, ' + (difference === 0 ? 'meeting' : pp(difference) + (difference < 0 ? ' below' : ' above')) + ' the ' + m.target + '% service target.');
      text('brief-priority', worst ? 'Investigate ' + worst.name + ' first at ' + rate(worst.rate) + ' on-time recovery. Compare team and asset mix before moving capacity.' :
        'Select a populated slice to compare locations.');
    }
    const share = lead ? rate(lead.base / overall.base * 100) : '—';
    text('insight-first', lead ? lead.name + ' represents ' + share + ' of ' + m.base.toLowerCase() + ' (' + fmt(lead.base) + ') and records ' + fmt(lead.outcome) + ' in ' + m.outcome.toLowerCase() + '.' : noData);
    text('so-first', lead ? 'Start the review with ' + lead.name + '. It accounts for ' + share + ' of the selected exposure, so a change there carries the most weight.' : 'Broaden the slice before prioritising a segment.');
    text('insight-second', worst ? worst.name + ' records ' + rate(worst.rate) + ' versus ' + rate(benchmark) + ' across the slice, a gap of ' + pp(worst.rate - benchmark) + '.' : noData);
    text('so-second', worst ? 'Investigate ' + worst.name + ' at ' + rate(worst.rate) + '. ' + m.action : 'Select a slice with comparable groups before drawing a conclusion.');
    const after = overall.outcome + change;
    text('insight-third', lead ? 'Moving ' + lead.name + ' from ' + rate(lead.rate) + ' to ' + rate(counterfactual) + ' changes ' + m.outcome.toLowerCase() + ' by ' + fmt(change) + ', to ' + fmt(after) + '.' : noData);
    text('so-third', lead ? 'Use ' + fmt(Math.abs(change)) + ' as the size of this what-if. Recheck the assumption for ' + lead.name + ' before treating it as an operational target.' : 'Choose a populated slice to size the scenario.');
    text('shock-value', (requested < 0 ? '−' : '+') + pp(requested));
    text('scenario-assumption', m.scenario + '. Exposure and every other group stay fixed.');
    text('scenario-inference', lead ? lead.name + ' shifts the total by ' + fmt(change) + ' after a ' + pp(applied) + ' rate change. Scenario total is ' + fmt(after) + '.' : noData);
    const bridge = lead ? [[0, overall.outcome], [overall.outcome, after], [0, after]] : [];
    paint('scenario-chart', 'bar', ['Observed', 'Scenario change', 'Scenario total'],
      [{ label: m.outcome, data: bridge, backgroundColor: [color, change < 0 ? '#a45b42' : '#5e8e76', '#294a6a'] }],
      { y: { ticks: { callback: x => fmt(Number(x)) } },
        plugins: { tooltip: { callbacks: { label: c => c.dataIndex === 1 ? 'Change ' + fmt(c.raw[1] - c.raw[0]) : fmt(c.raw[1]) } } } });
  }
  function drawCharts(v) {
    const trend = grouped(sameBasis(filtered, true), 'period');
    const first = trend[0], last = trend.at(-1);
    const delta = first && last ? last.rate - first.rate : 0;
    const worst = trend.reduce((low, row) => !low || (m.goodHigh ? row.rate < low.rate : row.rate > low.rate) ? row : low, null);
    text('trend-inference', !last ? 'No periods to compare.' : trend.length === 1 ? last.name + ' records ' + rate(last.rate) + '. Select more periods for a trend.' :
      m.rate + ' moves from ' + rate(first.rate) + ' in ' + first.name + ' to ' + rate(last.rate) + ' in ' + last.name + ' (' + (delta < 0 ? '−' : '+') + pp(delta) + '). ' +
      'The weakest month is ' + worst.name + ' at ' + rate(worst.rate) + '.');
    const series = [{ label: m.rate, data: trend.map(x => x.rate), borderColor: color, backgroundColor: pale, fill: true, tension: .15, pointRadius: 3.5 }];
    if (m.target) series.push({ label: 'Service target', data: trend.map(() => m.target), borderColor: '#75814e', borderDash: [5, 4], borderWidth: 2, pointRadius: 0, fill: false });
    paint('trend-chart', 'line', trend.map(x => x.name), series,
      { y: { ticks: { callback: x => x + '%' } }, plugins: { legend: { display: !!m.target, labels: { usePointStyle: true } }, tooltip: { callbacks: { label: c => c.dataset.label + ' ' + rate(c.raw) } } } });
    text('ranking-inference', v.lead ? v.lead.name + ' leads by ' + m.base.toLowerCase() + ' at ' + fmt(v.lead.base) + '. Its rate is ' + rate(v.lead.rate) + '.' : 'No groups in this slice.');
    paint('ranking-chart', 'bar', v.rank.map(x => x.name), [{ label: m.base, data: v.rank.map(x => x.base), backgroundColor: color, borderRadius: 4 }],
      { indexAxis: 'y', x: { ticks: { callback: x => fmt(Number(x)) } }, plugins: { tooltip: { callbacks: { label: c => fmt(c.raw) } } } });
    const other = m.driver === 'segment' ? 'period' : 'segment';
    const pairs = crossed(analysed, m.driver, other);
    const points = [...pairs].flatMap(([a, groups]) => [...groups].map(([b, total]) => ({
      x: total.base, y: finish(total).rate, name: a + ' / ' + b
    }))).sort((a, b) => b.x - a.x).slice(0, 60);
    const largest = points[0];
    text('scatter-inference', largest ? largest.name + ' has the most exposure among the plotted pairs (up to 60 by exposure). Its exposure is ' + fmt(largest.x) + ', at a rate of ' + rate(largest.y) + '.' : 'No group pairs in this slice.');
    paint('scatter-chart', 'scatter', [], [{ label: 'Group pair', data: points, backgroundColor: color + 'b5', pointRadius: 6 }],
      { x: { title: { display: true, text: m.base } }, y: { title: { display: true, text: m.rate + ' (%)' }, ticks: { callback: x => x + '%' } },
        plugins: { tooltip: { callbacks: { label: c => c.raw.name + ' · ' + fmt(c.raw.x) + ' · ' + rate(c.raw.y) } } } });
    matrix(m.matrix ? filtered : analysed);
  }
  function sortedRows() {
    if (sortedCache) return sortedCache;
    sortedCache = filtered.slice().sort((a, b) => {
      if (sortBy === 'period') return sortDirection * (dims.period.indexOf(a.period) - dims.period.indexOf(b.period));
      if (typeof a[sortBy] === 'number') return sortDirection * (a[sortBy] - b[sortBy]);
      return sortDirection * a[sortBy].localeCompare(b[sortBy]);
    });
    return sortedCache;
  }
  const columns = [...filters, 'base', 'outcome', 'units'];
  function drawExplorer() {
    const rows = sortedRows(), start = explorerPage * pageSize, page = rows.slice(start, start + pageSize);
    const head = el('tr');
    columns.forEach(k => {
      const th = el('th'), button = el('button', label[k]); th.scope = 'col'; button.type = 'button';
      if (sortBy === k) th.setAttribute('aria-sort', sortDirection === 1 ? 'ascending' : 'descending');
      button.onclick = () => { sortDirection = sortBy === k ? -sortDirection : 1; sortBy = k; explorerPage = 0; sortedCache = null; drawExplorer(); $('explorer-head').querySelectorAll('button')[columns.indexOf(k)].focus(); };
      th.appendChild(button); head.appendChild(th);
    });
    $('explorer-head').replaceChildren(head);
    $('explorer-rows').replaceChildren(...page.map(r => {
      const tr = el('tr'); columns.forEach(k => tr.appendChild(el('td', filters.includes(k) ? r[k] : fmt(r[k])))); return tr;
    }));
    text('page-info', rows.length ? (start + 1) + '–' + (start + page.length) + ' of ' + rows.length : 'No records');
    text('explorer-summary', rows.length + ' filtered records. CSV contains the entire slice in the current sort order.');
    $('previous-rows').disabled = explorerPage === 0;
    $('next-rows').disabled = start + pageSize >= rows.length;
    $('download-csv').disabled = !rows.length;
  }
  function downloadCsv() {
    const quote = value => {
      const text = typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : String(value);
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const lines = [columns.map(k => quote(label[k])).join(','),
      ...sortedRows().map(row => columns.map(k => quote(row[k])).join(','))];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const a = el('a'); a.href = url; a.download = document.body.dataset.report + '-filtered.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  let mapState, defaultMap, mapError = '';
  function mapElement(tag, attrs) {
    const item = document.createElementNS(ns, tag);
    Object.entries(attrs || {}).forEach(([k, v]) => item.setAttribute(k, v));
    return item;
  }
  const geographyKey = s => String(s ?? '').normalize('NFKC').trim().toLowerCase();
  const stateCode = { 'in-gj': 'Gujarat', 'in-ka': 'Karnataka', 'in-mh': 'Maharashtra', 'in-rj': 'Rajasthan', 'in-tn': 'Tamil Nadu', 'in-tg': 'Telangana', 'in-ts': 'Telangana' };
  function stateName(value) {
    const key = geographyKey(value);
    const canonical = geographyKey(stateCode[key] || key);
    return dims.region.find(r => {
      const candidate = geographyKey(r);
      return candidate === key || geographyKey(stateCode[candidate] || candidate) === canonical;
    });
  }
  function drawMap() {
    const container = $('report-map');
    const { layer, field, source } = mapState;
    const values = grouped(analysed, 'region');
    const matched = new Set(layer.features.map(f => stateName(f.properties[field])).filter(Boolean));
    const withValues = values.filter(s => matched.has(s.name));
    const byRegion = new Map(withValues.map(s => [s.name, s]));
    const unmatched = values.filter(s => !matched.has(s.name)).map(s => s.name);
    const min = Math.min(...withValues.map(s => s.rate)), max = Math.max(...withValues.map(s => s.rate));
    const fill = s => s ? 'color-mix(in srgb,' + color + ' ' + (min === max ? 67 : 28 + (s.rate - min) / (max - min) * 66) + '%, white)' : '#dce5ee';
    let west = 180, east = -180, south = 90, north = -90;
    layer.features.forEach(f => f.geometry.coordinates.forEach(p => p.forEach(r => r.forEach(([x, y]) => {
      west = Math.min(west, x); east = Math.max(east, x); south = Math.min(south, y); north = Math.max(north, y);
    }))));
    const xScale = Math.cos((south + north) / 2 * Math.PI / 180);
    const scale = Math.min(680 / (Math.max(.01, east - west) * xScale), 355 / Math.max(.01, north - south));
    const center = (west + east) / 2;
    const svg = mapElement('svg', { viewBox: '0 0 720 390', role: 'group', 'aria-label': 'State map for ' + m.rate });
    const lastRegion = document.activeElement?.getAttribute('data-map-region');
    const selected = $('filter-region').value;
    for (const f of layer.features) {
      const raw = f.properties[field], region = stateName(raw), stat = byRegion.get(region);
      const d = f.geometry.coordinates.flat().map(r => r.map(([x, y], i) =>
        (i ? 'L' : 'M') + (360 + (x - center) * xScale * scale).toFixed(1) + ' ' + (17 + (north - y) * scale).toFixed(1)).join('') + 'Z').join('');
      const item = mapElement('path', { d, fill: fill(stat), 'fill-rule': 'evenodd', stroke: selected && selected === region ? '#11243a' : '#fff', 'stroke-width': selected && selected === region ? 2 : 1 });
      const title = mapElement('title');
      title.textContent = (region || raw || 'Unnamed boundary') + (stat ? ' · ' + rate(stat.rate) : ' · No data in this slice');
      item.appendChild(title);
      if (region) {
        item.setAttribute('role', 'button'); item.setAttribute('tabindex', '0'); item.setAttribute('aria-label', 'Filter to ' + region);
        item.setAttribute('aria-pressed', String(selected === region)); item.setAttribute('data-map-region', region);
        const choose = () => { $('filter-region').value = selected === region ? '' : region; explorerPage = 0; render(); };
        item.addEventListener('click', choose);
        item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
      }
      svg.appendChild(item);
    }
    container.replaceChildren(svg);
    if (lastRegion) [...svg.querySelectorAll('[data-map-region]')].find(p => p.getAttribute('data-map-region') === lastRegion)?.focus();
    const ordered = withValues.slice().sort((a, b) => b.rate - a.rate);
    $('map-legend').replaceChildren(...ordered.map(s => {
      const li = el('li'), name = el('span'), swatch = el('i'); swatch.className = 'map-swatch'; swatch.style.background = fill(s);
      name.append(swatch, document.createTextNode(s.name)); li.append(name, el('strong', rate(s.rate))); return li;
    }));
    text('boundary-status', mapError || source + ' · ' + withValues.length + ' of ' + values.length + ' selected states matched' +
      (unmatched.length ? ' · Unmatched: ' + unmatched.join(', ') : '') + '.');
    const high = ordered[0];
    text('map-inference', high ? high.name + ' has the highest mapped rate at ' + rate(high.rate) + '. This covers ' + ordered.length + ' states with data in the selected slice.' : 'The selected slice has no matched geography. Check filters and the join field.');
  }
  function loadMapState(next, notify) {
    const script = $('report-geometry'), before = script.textContent;
    mapState = next; mapError = '';
    const fields = [...new Set(next.layer.features.flatMap(f => Object.keys(f.properties)))].sort();
    $('boundary-field').replaceChildren(...fields.map(f => new Option(f, f)));
    $('boundary-field').value = next.field;
    const after = JSON.stringify(next).replace(/</g, '\\u003c');
    script.textContent = after;
    if (notify && before !== after) window.dispatchEvent(new CustomEvent('ms:report-boundaries', { detail: { before, after } }));
    drawMap();
  }
  function initMap() {
    defaultMap = { layer: MSReportGeo.valid(JSON.parse($('report-default-geometry').textContent)), field: 'name', source: 'Natural Earth sample layer' };
    const saved = $('report-geometry').textContent.trim();
    loadMapState(saved ? JSON.parse(saved) : defaultMap, false);
    window.MSReportMap = { restore: saved => loadMapState(JSON.parse(saved), false) };
    $('load-boundaries').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      $('load-boundaries').disabled = true;
      try {
        const layer = await MSReportGeo.load(file);
        const keys = [...new Set(layer.features.flatMap(f => Object.keys(f.properties)))];
        const score = k => layer.features.filter(f => stateName(f.properties[k])).length;
        const scored = keys.map(k => ({ k, score: score(k) }));
        const field = scored.sort((a, b) => b.score - a.score || (a.k === 'name' ? -1 : b.k === 'name' ? 1 : 0))[0]?.k;
        if (!field) throw new Error('The boundary layer has no attributes to join.');
        loadMapState({ layer, field, source: file.name }, true);
      } catch (error) { mapError = error.message + ' The current map was kept.'; drawMap(); }
      finally { $('load-boundaries').disabled = false; e.target.value = ''; }
    });
    $('boundary-field').addEventListener('change', e => loadMapState({ ...mapState, field: e.target.value }, true));
    $('reset-boundaries').onclick = () => loadMapState(defaultMap, true);
  }

  function loadReportData(payload, notify) {
    const script = $('report-dataset'), before = script.textContent;
    m.rows = payload ? payload.rows : demoRows;
    filters.forEach(k => {
      const values = [...new Set(m.rows.map(r => r[k]))];
      if (k === 'period' && values.every(v => /^\d{4}-\d{2}$/.test(v))) values.sort();
      if (k === 'group' && m.latestGroup && values.every(v => /^Week \d+$/i.test(v))) values.sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
      dims[k] = values;
      pick(k, values);
    });
    explorerPage = 0;
    const name = payload ? payload.source : 'Sample dataset';
    text('report-data-label', payload ? 'Local CSV data' : 'Illustrative data');
    text('report-data-period', dims.period[0] + ' to ' + dims.period.at(-1));
    text('report-data-status', name + ' · ' + m.rows.length + ' loaded records. Download a filtered CSV to see the expected columns.');
    text('report-footer-data', payload ? 'User-supplied local data' : 'Fictional demonstration figures');
    text('method-origin', payload ? 'The active dataset came from a local CSV named ' + name + '. Verify its source, dates and units before sharing.' :
      'All business figures are synthetic, generated for this layout. Use the Data explorer to reconcile totals to the contributing records.');
    const after = payload ? JSON.stringify(payload).replace(/</g, '\\u003c') : '';
    script.textContent = after;
    if (notify && before !== after) window.dispatchEvent(new CustomEvent('ms:report-data', { detail: { before, after } }));
    render();
  }
  function initData() {
    filters.forEach(k => $('filter-' + k).addEventListener('change', () => { explorerPage = 0; render(); }));
    window.MSReportData = { restore: saved => loadReportData(saved ? JSON.parse(saved) : null, false) };
    $('load-report-data').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      e.target.disabled = true;
      try {
        if (file.size > 6 * 1024 * 1024) throw new Error('Use a CSV up to 6 MB.');
        loadReportData({ source: file.name, rows: MSReportCsv.parse(await file.text(), columns, label, m.bounded) }, true);
      } catch (error) { text('report-data-status', error.message + ' The current data was kept.'); }
      finally { e.target.disabled = false; e.target.value = ''; }
    });
    $('restore-report-data').onclick = () => loadReportData(null, true);
    window.MSReportData.restore($('report-dataset').textContent.trim());
  }

  function render() {
    sortedCache = null;
    filtered = m.rows.filter(row => filters.every(k => !$('filter-' + k).value || row[k] === $('filter-' + k).value));
    analysed = sameBasis(filtered);
    text('report-scope', activeScope() + ' · ' + filtered.length + ' records');
    const basis = analysed[0];
    text('overview-basis', m.latestPeriod ? 'Headline uses the latest selected snapshot' + (basis ? ' · ' + basis.period : '') + '.' :
      m.latestGroup ? 'Headline uses the latest selected tenure' + (basis ? ' · ' + basis.group : '') + '.' : 'Headline uses all records matching the filters.');
    const v = reportValues();
    updateStory(v); drawCharts(v); drawExplorer();
    if (mapState) drawMap();
  }
  function boot() {
    for (const k of ['period', 'segment', 'group', 'base', 'outcome', 'units']) text((k === 'units' ? 'unit' : k) + '-label', label[k]);
    text('rate-label', m.rate);
    text('trend-title', m.rate + ' by ' + m.period.toLowerCase());
    text('ranking-title', m.base + ' by ' + label[m.driver].toLowerCase());
    text('scatter-title', m.base + ' versus ' + m.rate.toLowerCase());
    text('method-source', 'One observation per ' + filters.map(k => label[k].toLowerCase()).join(', ') + ' in the sample data.');
    text('method-measures', m.method);
    text('method-basis', m.interpretation);
    text('method-scenario', m.scenario + '. Multiply that group’s exposure by the assumed percentage-point change. Keep exposure and every other group fixed. Bounded rates stay between 0% and 100%.');
    text('domain-question', m.faq[0]); text('domain-answer', m.faq[1]);
    text('faq-scenario', 'The scenario changes one rate for the largest group in the selected slice. Use the slider in Drivers & scenarios to see how the result moves.');
    if (!m.geography) for (const id of ['region-filter', 'method-geo', 'faq-geo']) $(id).hidden = true;
    else { text('map-title', m.rate + ' by state'); }
    $('reset-filters').onclick = () => { filters.forEach(k => { $('filter-' + k).value = ''; }); explorerPage = 0; render(); };
    $('shock').value = m.shock; $('shock').oninput = () => updateStory(reportValues());
    $('previous-rows').onclick = () => { explorerPage--; drawExplorer(); };
    $('next-rows').onclick = () => { explorerPage++; drawExplorer(); };
    $('download-csv').onclick = downloadCsv;
    initTabs(); initData();
    if (m.geography) initMap();
  }
  boot();
})();
