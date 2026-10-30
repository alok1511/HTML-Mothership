#!/usr/bin/env node
/*
 * Drives tools/mcp/mothership-mcp.js over stdio like an MCP client would:
 * list tools, open the three samples (Chart.js, ECharts, Plotly), edit them,
 * set one category order and colours everywhere, take a screenshot, add a
 * comment, save the prompt and export.
 *   node tests/mcp.test.js      (CHROMIUM_PATH as for smoke.test.js)
 */
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'mothership-mcp-'));
let failures = 0;
const check = (name, ok, detail) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + JSON.stringify(detail).slice(0, 400))); if (!ok) failures++; };

const env = Object.assign({}, process.env, { MOTHERSHIP_OUT: OUT });
if (process.env.CHROMIUM_PATH) env.MOTHERSHIP_BROWSER = process.env.CHROMIUM_PATH;
// MOTHERSHIP_MCP=python tests the Python server instead of the Node one
const PY = process.env.MOTHERSHIP_MCP === 'python' || process.argv.indexOf('--python') >= 0;
const srv = PY ? cp.spawn(process.env.PYTHON || 'python3', [path.join(ROOT, 'tools/mcp/mothership_mcp.py')], { env }) : cp.spawn(process.execPath, [path.join(ROOT, 'tools/mcp/mothership-mcp.js')], { env });
console.log('MCP server: ' + (PY ? 'Python' : 'Node'));
let buf = '', id = 0; const pending = {};
srv.stdout.on('data', d => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) { const j = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1); if (pending[j.id]) pending[j.id](j); }
});
srv.stderr.on('data', d => process.stderr.write(d));
const rpc = (method, params) => new Promise(r => { const n = ++id; pending[n] = r; srv.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: n, method, params }) + '\n'); });
const call = async (name, args) => {
  const r = (await rpc('tools/call', { name, arguments: args || {} })).result;
  const text = r.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { error: r.isError ? text : null, json, images: r.content.filter(c => c.type === 'image') };
};

(async () => {
  const init = (await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } })).result;
  check('initialize', init.serverInfo.name === 'mothership' && init.capabilities.tools, init);
  const tools = (await rpc('tools/list', {})).result.tools;
  const names = tools.map(t => t.name);
  check('lists every feature as a tool', tools.length > 60 && ['open_file', 'screenshot', 'chart_settings', 'category_order', 'format_painter', 'drill_data_file', 'add_comment', 'export_html'].every(n => names.includes(n)), names);
  check('tool schemas are valid', tools.every(t => t.description && t.inputSchema && t.inputSchema.type === 'object'), tools.filter(t => !t.inputSchema));

  const st = await call('status');
  check('status: browser connected', st.json && st.json.connected, st);

  for (const [file, lib] of [['sales-dashboard.html', 'Chart.js'], ['ops-dashboard.html', 'ECharts'], ['risk-dashboard.html', 'Plotly']]) {
    console.log('Sample: ' + file + ' (' + lib + ')');
    const o = await call('open_file', { path: path.join(ROOT, 'samples', file) });
    check('open_file', o.json && o.json.open && o.json.charts.length > 1, o.error || o.json);
    if (!o.json || !o.json.charts) continue;
    const first = o.json.charts[0];
    const order = first.labels.slice().reverse();
    const ord = await call('category_order', { order });
    const colors = {}; colors[order[0]] = '#c00000';
    const col = await call('category_colors', { colors });
    const after = await call('call', { path: 'rt.chartInfo', args: [first.key] });
    check('one category order applied', !ord.error && after.json && JSON.stringify(after.json.labels) === JSON.stringify(order), { ord, after: after.json && after.json.labels });
    const cc = await call('call', { path: 'rt.chartColors', args: [first.key] });
    check('category colour applied', !col.error && cc.json && String(cc.json[order[0]]).toLowerCase() === '#c00000', cc.json);
    const look = await call('chart_settings', { chart: first.name, title: 'Checked by MCP', look: { font: 'Georgia', size: 13, legend: 'bottom' } });
    check('chart_settings by plain name', look.json && look.json.name === 'Checked by MCP' && look.json.look && look.json.look.font === 'Georgia', look.error || look.json);
    const shot = await call('screenshot', {});
    check('screenshot returns an image', shot.images.length === 1 && shot.images[0].data.length > 5000, shot.error);
  }

  const f = await call('find', { selector: 'h1', limit: 1 });
  const t = f.json && f.json[0] && await call('set_text', { ref: f.json[0].ref, text: 'Risk review' });
  check('find + set_text', t && !t.error, f.error || (t && t.error));
  const cmt = await call('add_comment', { text: 'Use a stacked bar here', chart: 'Exposure by rating' });
  check('add_comment', cmt.json && cmt.json.id, cmt.error);
  const pr = await call('save_prompt', {});
  check('save_prompt writes Markdown', pr.json && fs.existsSync(pr.json.saved) && /Use a stacked bar here/.test(fs.readFileSync(pr.json.saved, 'utf8')), pr.error || pr.json);
  const md = path.join(OUT, 'drill.md');
  fs.writeFileSync(md, '# Exposure by rating\n\n| rating | sector | exposure |\n|---|---|---|\n| AAA | Financials | 1,200 |\n| AA | Energy | 800 |\n| A | Industrials | 450 |\n');
  const dd = await call('drill_data_file', { path: md });
  check('drill_data_file embeds Markdown tables', dd.json && dd.json[0] && dd.json[0].dataset, dd.error || dd.json);
  const ex = await call('export_html', {});
  const html = ex.json && fs.existsSync(ex.json.saved) ? fs.readFileSync(ex.json.saved, 'utf8') : '';
  check('export_html saves a standalone file', /Risk review/.test(html) && /ms-runtime/.test(html) && /-edited\.html$/.test(ex.json.saved), ex.error || ex.json);
  const sums = await call('chart_summaries', {});
  check('chart_summaries reads every chart', sums.json && sums.json.length > 1 && sums.json.every(x => x.summary), sums.error || sums.json);
  const nc = await call('number_check', {});
  check('number_check returns results', Array.isArray(nc.json), nc.error || nc.json);
  const tr = await call('save_tracker', {});
  const xlsx = tr.json && fs.existsSync(tr.json.saved) ? fs.readFileSync(tr.json.saved) : Buffer.alloc(0);
  check('save_tracker writes an Excel file', xlsx.slice(0, 2).toString() === 'PK' && tr.json.comments >= 1, tr.error || tr.json);
  const lt = tr.json ? await call('load_tracker', { path: tr.json.saved }) : { error: 'no tracker' };
  check('load_tracker reads it back', lt.json && lt.json.updated === 0 && lt.json.notFound === 0, lt.error || lt.json);
  const cf = ex.json ? await call('compare_file', { path: ex.json.saved }) : { error: 'no export' };
  check('compare_file: an export matches what is open', cf.json && cf.json.changes === 0, cf.error || cf.json);
  const loc = await call('get_locale', {});
  check('get_locale: US dollars by default', loc.json && loc.json.currency === 'USD', loc.error || loc.json);
  const sl = await call('set_locale', { country: 'India' });
  check('set_locale: India gives lakh and crore', sl.json && sl.json.currency === 'INR' && /₹/.test(sl.json.example), sl.error || sl.json);
  const pc = await call('publish_check', {});
  check('publish_check returns a checklist', pc.json && Array.isArray(pc.json.items) && pc.json.items.length >= 6, pc.error || pc.json);
  const pb = await call('publish_html', { version: '2.0', note: 'From MCP', password: 'secret12' });
  const pubHtml = pb.json && fs.existsSync(pb.json.saved) ? fs.readFileSync(pb.json.saved, 'utf8') : '';
  check('publish_html saves a sealed, locked copy', pb.json && pb.json.version === '2.0' && pb.json.locked && pubHtml.indexOf(pb.json.sha256) > 0 && /v2\.0\.html$/.test(pb.json.saved), pb.error || pb.json);
  const lockedOpen = pb.json ? await call('open_file', { path: pb.json.saved }) : { error: 'x' };
  check('open_file: a locked file needs its password', !!lockedOpen.error && /locked/i.test(lockedOpen.error), lockedOpen);
  const unlocked = pb.json ? await call('open_file', { path: pb.json.saved, password: 'secret12' }) : { error: 'x' };
  check('open_file: the right password opens it, seal intact', unlocked.json && unlocked.json.published && unlocked.json.published.ok === true, unlocked.error || (unlocked.json && unlocked.json.published));
  const pdf = await call('save_pdf', {});
  const pdfOk = pdf.json && fs.existsSync(pdf.json.saved) && fs.readFileSync(pdf.json.saved).slice(0, 4).toString() === '%PDF';
  check('save_pdf writes a PDF, one page per tab', pdfOk && pdf.json.pages.length >= 1, pdf.error || pdf.json);
  const ppt = await call('save_pptx', {});
  check('save_pptx writes a PowerPoint', ppt.json && fs.existsSync(ppt.json.saved) && fs.readFileSync(ppt.json.saved).slice(0, 2).toString() === 'PK' && ppt.json.slides >= 1, ppt.error || ppt.json);
  const scr = await call('scrubbed_copy', { names: [{ from: 'Risk review', to: 'Client review' }] });
  const scrHtml = scr.json && fs.existsSync(scr.json.saved) ? fs.readFileSync(scr.json.saved, 'utf8') : '';
  check('scrubbed_copy saves a copy without the names', scr.json && scr.json.replaced[0].n >= 1 && !/Risk review/.test(scrHtml) && /Client review/.test(scrHtml), scr.error || scr.json);
  // testing: open the sales sample and drive it like Playwright
  await call('open_file', { path: path.join(ROOT, 'samples', 'sales-dashboard.html') });
  const snap = await call('ui_snapshot', {});
  check('ui_snapshot lists charts and KPI cards with refs', snap.json && snap.json.charts.length === 4 && snap.json.kpis.length === 4 && snap.json.charts.every(c => c.ref), snap.error || snap.json);
  const hv = await call('ui_hover', { target: 'chart=Sales by region', point: 'West' });
  check('ui_hover on a bar shows its pop-up', hv.json && hv.json.tooltip && /West/.test(hv.json.tooltip[0].text), hv.error || hv.json);
  const mh = await call('ui_mouse', { target: 'chart=Sales by region', point: 'South', action: 'hover' });
  check('ui_mouse: real mouse hover shows the pop-up', mh.json && mh.json.tooltip && /South/.test(mh.json.tooltip[0].text), mh.error || mh.json);
  const ue = await call('ui_expect', { target: 'kpi=Total sales', text: '100.53' });
  check('ui_expect checks a KPI card', ue.json && ue.json.pass === true, ue.error || ue.json);
  const us = await call('ui_screenshot', { target: 'chart=Monthly sales trend' });
  check('ui_screenshot of one chart', us.images.length === 1 && us.images[0].data.length > 3000, us.error);
  const dr = await call('test_plan', { action: 'draft' });
  check('test_plan drafts test cases', dr.json && dr.json.added >= 15, dr.error || (dr.json && dr.json.added));
  const run = await call('test_run', { ids: ['TC-001', 'TC-002', 'TC-004'] });
  check('test_run runs automatic cases', run.json && run.json.results.length === 3 && run.json.results.every(r => r.status === 'Pass'), run.error || (run.json && run.json.results.map(r => r.id + ' ' + r.status)));
  const rec = await call('test_record', { id: 'TC-003', status: 'Pass', actual: 'All four regions match the finance report', by: 'MCP test' });
  check('test_record records a result', rec.json && rec.json.status === 'Pass', rec.error || rec.json);
  const sd = await call('save_test_document', {});
  const sdText = sd.json && fs.existsSync(sd.json.saved) ? fs.readFileSync(sd.json.saved, 'utf8') : '';
  check('save_test_document writes the test plan', /## 4\. Test cases/.test(sdText) && /All four regions match/.test(sdText) && /## 9\. Sign-off/.test(sdText), sd.error || sd.json);
  const sx = await call('save_test_document', { format: 'xlsx' });
  check('save_test_document writes Excel', sx.json && fs.readFileSync(sx.json.saved).slice(0, 2).toString() === 'PK', sx.error || sx.json);

  const bad = await call('no_such_tool', {});
  check('unknown tool is an error, not a crash', !!bad.error, bad);

  srv.stdin.end();
  console.log(failures ? '\n' + failures + ' check(s) failed' : '\nAll MCP checks passed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
