#!/usr/bin/env node
/*
 * Mothership MCP server (stdio). Lets an AI assistant (Claude Desktop, Claude Code,
 * or any MCP client) drive Mothership: open dashboards, restyle, add tabs, KPI cards
 * and charts, set category order and colours, load drill-down data, add review
 * comments, take screenshots and save the edited HTML.
 *
 * Zero dependencies: plain Node (16+). It starts Edge or Chrome with the DevTools
 * protocol, opens mothership.html and calls MS.api inside the page, so every
 * feature works exactly as it does when you click.
 *
 *   node tools/mcp/mothership-mcp.js
 *
 * Settings (environment variables, all optional):
 *   MOTHERSHIP_BROWSER   path to msedge.exe / chrome.exe (found automatically otherwise)
 *   MOTHERSHIP_HEADLESS  0 = show the browser window so you can watch (default 1 = hidden)
 *   MOTHERSHIP_ATTACH    a DevTools port (e.g. 9222) of a browser you started yourself
 *                        with --remote-debugging-port=9222; edits then happen in your window
 *   MOTHERSHIP_HTML      which editor file to open (default: mothership.html next to tools/)
 *   MOTHERSHIP_OUT       folder for saved files when no path is given (default: current folder)
 */
'use strict';
var fs = require('fs');
var path = require('path');
var os = require('os');
var net = require('net');
var http = require('http');
var crypto = require('crypto');
var cp = require('child_process');

var VERSION = '2.3.0';
var ROOT = path.resolve(__dirname, '..', '..');
var EDITOR = path.resolve(process.env.MOTHERSHIP_HTML || path.join(ROOT, 'mothership.html'));
var OUT = path.resolve(process.env.MOTHERSHIP_OUT || process.cwd());
var HEADLESS = process.env.MOTHERSHIP_HEADLESS !== '0';

function log() { process.stderr.write('[mothership-mcp] ' + Array.prototype.join.call(arguments, ' ') + '\n'); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* ------------------------------------------------------------------ WebSocket (client side, RFC 6455) */
function WS(url) {
  var u = new URL(url), self = this;
  this.handlers = {}; this.buf = Buffer.alloc(0); this.frags = []; this.open = false;
  this.ready = new Promise(function (resolve, reject) {
    var key = crypto.randomBytes(16).toString('base64');
    var sock = self.sock = net.connect(+u.port || 80, u.hostname);
    var head = Buffer.alloc(0), upgraded = false;
    sock.on('connect', function () {
      sock.write('GET ' + u.pathname + u.search + ' HTTP/1.1\r\nHost: ' + u.host + '\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        'Sec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
    });
    sock.on('data', function (d) {
      if (upgraded) return self._data(d);
      head = Buffer.concat([head, d]);
      var end = head.indexOf('\r\n\r\n'); if (end < 0) return;
      if (!/^HTTP\/1\.1 101/.test(head.slice(0, end).toString())) return reject(new Error('DevTools refused the connection: ' + head.slice(0, end).toString().split('\r\n')[0]));
      upgraded = true; self.open = true; resolve();
      if (head.length > end + 4) self._data(head.slice(end + 4));
    });
    sock.on('error', function (e) { if (!upgraded) reject(e); self._emit('close', e); });
    sock.on('close', function () { self.open = false; self._emit('close'); });
  });
}
WS.prototype.on = function (ev, fn) { this.handlers[ev] = fn; };
WS.prototype._emit = function (ev, x) { if (this.handlers[ev]) this.handlers[ev](x); };
WS.prototype._frame = function (op, payload) {
  var len = payload.length, hdr;
  if (len < 126) { hdr = Buffer.alloc(2); hdr[1] = 0x80 | len; }
  else if (len < 65536) { hdr = Buffer.alloc(4); hdr[1] = 0x80 | 126; hdr.writeUInt16BE(len, 2); }
  else { hdr = Buffer.alloc(10); hdr[1] = 0x80 | 127; hdr.writeUInt32BE(Math.floor(len / 4294967296), 2); hdr.writeUInt32BE(len >>> 0, 6); }
  hdr[0] = 0x80 | op;
  var mask = crypto.randomBytes(4), body = Buffer.alloc(len);
  for (var i = 0; i < len; i++) body[i] = payload[i] ^ mask[i & 3];
  this.sock.write(Buffer.concat([hdr, mask, body]));
};
WS.prototype.send = function (text) { this._frame(1, Buffer.from(text, 'utf8')); };
WS.prototype._data = function (d) {
  this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
  for (;;) {
    var b = this.buf; if (b.length < 2) return;
    var fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80, len = b[1] & 0x7f, off = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
    else if (len === 127) { if (b.length < 10) return; len = b.readUInt32BE(2) * 4294967296 + b.readUInt32BE(6); off = 10; }
    var mk = null; if (masked) { if (b.length < off + 4) return; mk = b.slice(off, off + 4); off += 4; }
    if (b.length < off + len) return;
    var p = b.slice(off, off + len); this.buf = b.slice(off + len);
    if (mk) { p = Buffer.from(p); for (var i = 0; i < p.length; i++) p[i] ^= mk[i & 3]; }
    if (op === 9) { this._frame(10, p); continue; }
    if (op === 8) { this.sock.end(); continue; }
    if (op === 1 || op === 2 || op === 0) {
      this.frags.push(p);
      if (fin) { var msg = Buffer.concat(this.frags).toString('utf8'); this.frags = []; this._emit('message', msg); }
    }
  }
};

/* ------------------------------------------------------------------ DevTools protocol */
function getJson(port, p) {
  return new Promise(function (resolve, reject) {
    http.get({ host: '127.0.0.1', port: port, path: p }, function (res) {
      var s = ''; res.on('data', function (c) { s += c; }); res.on('end', function () { try { resolve(JSON.parse(s)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

var B = { ws: null, id: 0, pending: {}, session: null, proc: null, profile: null, exe: null, mode: null, starting: null, error: null };

function cdp(method, params, session) {
  return new Promise(function (resolve, reject) {
    if (!B.ws || !B.ws.open) return reject(new Error('The browser is not connected.'));
    var id = ++B.id; B.pending[id] = { resolve: resolve, reject: reject, method: method };
    var msg = { id: id, method: method, params: params || {} };
    var sid = session === null ? null : (session || B.session); if (sid) msg.sessionId = sid;
    B.ws.send(JSON.stringify(msg));
  });
}

function findBrowser() {
  var c = [process.env.MOTHERSHIP_BROWSER, process.env.CHROMIUM_PATH];
  var pf = process.env.ProgramFiles || 'C:\\Program Files', pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', la = process.env.LOCALAPPDATA || '';
  if (process.platform === 'win32') c.push(
    path.join(pf86, 'Microsoft\\Edge\\Application\\msedge.exe'), path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
    path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'), path.join(pf86, 'Google\\Chrome\\Application\\chrome.exe'),
    la && path.join(la, 'Google\\Chrome\\Application\\chrome.exe'), la && path.join(la, 'Microsoft\\Edge\\Application\\msedge.exe'));
  else if (process.platform === 'darwin') c.push(
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), '/Applications/Chromium.app/Contents/MacOS/Chromium');
  else c.push('/usr/bin/microsoft-edge', '/usr/bin/microsoft-edge-stable', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium', '/opt/pw-browsers/chromium');
  for (var i = 0; i < c.length; i++) { try { if (c[i] && fs.statSync(c[i]).isFile()) return c[i]; } catch (e) {} }
  return null;
}

function connect(wsUrl) {
  var ws = new WS(wsUrl);
  ws.on('message', function (m) {
    var j; try { j = JSON.parse(m); } catch (e) { return; }
    if (j.id && B.pending[j.id]) {
      var p = B.pending[j.id]; delete B.pending[j.id];
      if (j.error) p.reject(new Error(p.method + ': ' + j.error.message)); else p.resolve(j.result);
    } else if (j.method === 'Page.javascriptDialogOpening') {
      // never let an alert/confirm in the page block the assistant
      cdp('Page.handleJavaScriptDialog', { accept: true }, j.sessionId).catch(function () {});
    } else if (j.method === 'Target.detachedFromTarget' && j.params.sessionId === B.session) {
      B.session = null;
    }
  });
  ws.on('close', function () {
    Object.keys(B.pending).forEach(function (id) { B.pending[id].reject(new Error('The browser closed.')); });
    B.pending = {}; B.ws = null; B.session = null;
  });
  return ws.ready.then(function () { B.ws = ws; });
}

function launch() {
  var exe = B.exe = findBrowser();
  if (!exe) throw new Error('Could not find Microsoft Edge or Google Chrome. Set MOTHERSHIP_BROWSER to the full path of msedge.exe or chrome.exe.');
  B.profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mothership-mcp-'));
  var args = ['--remote-debugging-port=0', '--user-data-dir=' + B.profile, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--allow-file-access-from-files', '--window-size=1440,900'];
  if (HEADLESS) args.push('--headless=new', '--hide-scrollbars');
  if (process.platform === 'linux' && process.getuid && process.getuid() === 0) args.push('--no-sandbox');
  args.push('about:blank');
  B.proc = cp.spawn(exe, args, { stdio: 'ignore', detached: false });
  B.proc.on('exit', function () { B.proc = null; });
  var file = path.join(B.profile, 'DevToolsActivePort'), t0 = Date.now();
  return (function wait() {
    var txt = null; try { txt = fs.readFileSync(file, 'utf8'); } catch (e) {}
    if (txt && txt.split('\n').length >= 2) { var l = txt.split('\n'); return connect('ws://127.0.0.1:' + l[0].trim() + l[1].trim()); }
    if (!B.proc) throw new Error('The browser closed straight away (' + exe + ').');
    if (Date.now() - t0 > 30000) throw new Error('The browser did not start within 30 seconds (' + exe + ').');
    return sleep(150).then(wait);
  })();
}

function attach(port) {
  return getJson(port, '/json/version').then(function (v) { return connect(v.webSocketDebuggerUrl); });
}

function editorUrl() { return 'file://' + (process.platform === 'win32' ? '/' : '') + EDITOR.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/').replace(/^\/([A-Za-z])%3A/, '/$1:'); }

function openEditor() {
  return cdp('Target.getTargets', {}, null).then(function (r) {
    var base = path.basename(EDITOR).toLowerCase();
    var hit = r.targetInfos.filter(function (t) { return t.type === 'page' && decodeURIComponent(t.url).toLowerCase().indexOf(base) >= 0; })[0];
    if (hit) return hit.targetId;
    var blank = B.mode === 'launched' && r.targetInfos.filter(function (t) { return t.type === 'page'; })[0];
    if (blank) return cdp('Target.attachToTarget', { targetId: blank.targetId, flatten: true }, null).then(function (a) {
      return cdp('Page.navigate', { url: editorUrl() }, a.sessionId).then(function () { return cdp('Target.detachFromTarget', { sessionId: a.sessionId }, null); }).then(function () { return blank.targetId; });
    });
    return cdp('Target.createTarget', { url: editorUrl() }, null).then(function (t) { return t.targetId; });
  }).then(function (targetId) {
    return cdp('Target.attachToTarget', { targetId: targetId, flatten: true }, null);
  }).then(function (a) {
    B.session = a.sessionId;
    return cdp('Page.enable').then(function () { return cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }).catch(function () {}); });
  }).then(function () {
    var t0 = Date.now();
    return (function ready() {
      return evaluate('typeof MS !== "undefined" && !!MS.api && !!MS.view').then(function (ok) {
        if (ok) return;
        if (Date.now() - t0 > 30000) throw new Error('Mothership did not load from ' + EDITOR);
        return sleep(200).then(ready);
      });
    })();
  });
}

function ensure() {
  if (B.ws && B.ws.open && B.session) return Promise.resolve();
  if (B.starting) return B.starting;
  var port = process.env.MOTHERSHIP_ATTACH;
  B.starting = Promise.resolve().then(function () {
    if (B.ws && B.ws.open) return;
    if (port) { B.mode = 'attached'; return attach(+port); }
    if (!fs.existsSync(EDITOR)) throw new Error('Mothership editor not found at ' + EDITOR + '. Set MOTHERSHIP_HTML.');
    B.mode = 'launched'; return launch();
  }).then(openEditor).then(function () {
    B.error = null; B.starting = null;
    log('ready (' + B.mode + (B.exe ? ', ' + B.exe : '') + ')');
  }, function (e) { B.error = e.message; B.starting = null; throw e; });
  return B.starting;
}

function evaluate(expr) {
  return cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }).then(function (r) {
    if (r.exceptionDetails) {
      var ex = r.exceptionDetails.exception;
      throw new Error(((ex && (ex.description || ex.value)) || r.exceptionDetails.text || 'Error').split('\n')[0].replace(/^Error: /, ''));
    }
    return r.result.value;
  });
}

function api(name, args) {
  return ensure().then(function () {
    return evaluate('(async function () { var v = await MS.api.run(' + JSON.stringify(name) + ', ' + JSON.stringify(args || {}) + '); return JSON.stringify(v === undefined ? { ok: true } : v); })()');
  }).then(function (s) { return s == null ? { ok: true } : JSON.parse(s); });
}

function shutdown() {
  if (B.proc) try { B.proc.kill(); } catch (e) {}
  if (B.profile) try { fs.rmSync(B.profile, { recursive: true, force: true }); } catch (e) {}
}

/* ------------------------------------------------------------------ files */
function resolvePath(p) { if (!p) throw new Error('Give a file path.'); p = p.replace(/^~(?=$|[\/\\])/, os.homedir()); return path.resolve(p); }
function b64file(p, rel) { var full = resolvePath(p); return { name: path.basename(full), path: rel || path.basename(full), b64: fs.readFileSync(full).toString('base64') }; }
function outPath(p, fallback) {
  var full = p ? resolvePath(p) : path.join(OUT, fallback);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  return full;
}
var SKIP_DIRS = { '.git': 1, node_modules: 1, '.venv': 1, __pycache__: 1 };
function walk(dir, base, out, limits) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
    if (out.length >= limits.files) return;
    var full = path.join(dir, d.name), rel = base ? base + '/' + d.name : d.name;
    if (d.isDirectory()) { if (!SKIP_DIRS[d.name] && d.name.charAt(0) !== '.') walk(full, rel, out, limits); return; }
    var size = fs.statSync(full).size; limits.bytes -= size; if (limits.bytes < 0) throw new Error('That folder is over 150 MB. Point open_folder at the dashboard\'s own folder.');
    out.push({ full: full, rel: rel });
  });
  return out;
}
// the files a page refers to (scripts, styles, images), and what its CSS refers to
function referenced(htmlPath) {
  var dir = path.dirname(htmlPath), seen = {}, out = [];
  function add(from, ref) {
    ref = ref.split(/[?#]/)[0]; if (!ref || /^(https?:|data:|blob:|mailto:|#|\/\/|javascript:)/i.test(ref)) return;
    try { ref = decodeURIComponent(ref); } catch (e) {}
    var full = path.resolve(path.dirname(from), ref); if (seen[full] || !fs.existsSync(full) || !fs.statSync(full).isFile()) return;
    seen[full] = 1; out.push(full);
    if (/\.css$/i.test(full)) scan(full, fs.readFileSync(full, 'utf8'), /url\(\s*['"]?([^'")]+)['"]?\s*\)/g);
  }
  function scan(from, text, re) { var m; while ((m = re.exec(text))) add(from, m[1]); }
  var html = fs.readFileSync(htmlPath, 'utf8');
  scan(htmlPath, html, /(?:src|href)\s*=\s*["']([^"']+)["']/gi);
  scan(htmlPath, html, /url\(\s*['"]?([^'")]+)['"]?\s*\)/g);
  return out.filter(function (f) { return path.relative(dir, f).indexOf('..') !== 0; });
}
function openFiles(main, others, password) {
  var dir = path.dirname(main), top = path.basename(dir) || 'dashboard';
  var files = [{ full: main }].concat(others.map(function (f) { return { full: f }; })).map(function (f) {
    return { name: path.basename(f.full), path: top + '/' + path.relative(dir, f.full).replace(/\\/g, '/'), b64: fs.readFileSync(f.full).toString('base64') };
  });
  return api('open_folder_files', { files: files, password: password });
}

/* ------------------------------------------------------------------ tools that need the file system */
var LOCAL = {
  status: { description: 'Is Mothership running? Which browser, which editor file, and what is open.', props: {},
    run: function () {
      var s = { editor: EDITOR, browser: B.exe || (process.env.MOTHERSHIP_ATTACH ? 'attached on port ' + process.env.MOTHERSHIP_ATTACH : findBrowser()), mode: B.mode, connected: !!(B.ws && B.ws.open && B.session), headless: HEADLESS && B.mode !== 'attached', saveFolder: OUT, lastError: B.error };
      return ensure().then(function () { return api('outline', {}); }).then(function (o) { s.dashboard = o.open ? { name: o.name, charts: o.charts.length, tabs: o.tabs.length, unsavedChanges: o.unsavedChanges } : null; return s; }, function (e) { s.lastError = e.message; return s; });
    } },
  open_file: { description: 'Open a dashboard HTML file from disk. Local scripts, styles, images and fonts it refers to are bundled in, so it works offline. A published file locked for editing needs its password.', props: { path: ['string', 'Path to the .html file', true], password: ['string', 'Password, for a published file locked for editing'] },
    run: function (a) {
      var full = resolvePath(a.path); if (!/\.html?$/i.test(full)) throw new Error('Give an .html file. For a folder use open_folder.');
      var refs = referenced(full);
      if (!refs.length) return api('open_html', { html: fs.readFileSync(full, 'utf8'), name: path.basename(full), password: a.password });
      return openFiles(full, refs, a.password);
    } },
  open_folder: { description: 'Open a dashboard folder (its HTML with scripts, styles, data and images).', props: { path: ['string', 'Folder path', true], main: ['string', 'Which .html file is the dashboard (default: index.html or the only one)'] },
    run: function (a) {
      var dir = resolvePath(a.path), all = walk(dir, '', [], { files: 4000, bytes: 150e6 });
      var htmls = all.filter(function (f) { return /\.html?$/i.test(f.rel); });
      var main = a.main ? htmls.filter(function (f) { return f.rel === a.main || path.basename(f.rel) === a.main; })[0]
        : (htmls.length === 1 ? htmls[0] : htmls.filter(function (f) { return /^index\.html?$/i.test(f.rel); })[0]);
      if (!main) throw new Error(htmls.length ? 'Say which page is the dashboard with main. Pages: ' + htmls.map(function (f) { return f.rel; }).join(', ') : 'No .html file in ' + dir);
      return openFiles(main.full, all.filter(function (f) { return !/\.html?$/i.test(f.rel); }).map(function (f) { return f.full; }));
    } },
  export_html: { description: 'Save the edited dashboard as one standalone HTML file (opens anywhere, offline).', props: { path: ['string', 'Where to save (default: <name>-edited.html in the save folder)'], drop_comments: ['boolean', 'Leave review comments out of the file'] },
    run: function (a) {
      return api('export_html', { drop_comments: !!a.drop_comments }).then(function (r) {
        var file = outPath(a.path, String(r.name || 'dashboard.html').replace(/(-edited)?\.html?$/i, '') + '-edited.html'); fs.writeFileSync(file, r.html, 'utf8');
        return { saved: file, size: Math.round(r.bytes / 1024) + ' KB' };
      });
    } },
  screenshot: { description: 'See the dashboard: a picture of the editor, of just the dashboard, or of one chart.', props: { what: ['string', '"dashboard" (default), "editor" (whole window) or a chart name'], path: ['string', 'Also save the PNG here'] },
    run: function (a) {
      var what = a.what || 'dashboard', get;
      if (what === 'editor') get = cdp('Page.captureScreenshot', { format: 'png' }).then(function (r) { return r.data; });
      else if (what === 'dashboard') get = evaluate('(function(){var r=document.querySelector("#stage iframe")||document.querySelector("#stage");var b=r.getBoundingClientRect();return {x:Math.max(0,b.left),y:Math.max(0,b.top),width:Math.min(b.width,innerWidth),height:Math.min(b.height,innerHeight),scale:1};})()')
        .then(function (clip) { return cdp('Page.captureScreenshot', { format: 'png', clip: clip }); }).then(function (r) { return r.data; });
      else get = api('chart_image', { chart: what }).then(function (r) { return String(r.dataUrl).replace(/^data:image\/\w+;base64,/, ''); });
      return get.then(function (data) {
        var saved = null; if (a.path) { saved = outPath(a.path); fs.writeFileSync(saved, Buffer.from(data, 'base64')); }
        return { __content: [{ type: 'image', data: data, mimeType: 'image/png' }, { type: 'text', text: saved ? 'Saved to ' + saved : 'Screenshot of ' + what }] };
      });
    } },
  insert_file: { description: 'Turn a document on disk (Markdown, Word, Excel, PowerPoint, PDF, image) into a new tab or a block.', props: { path: ['string', 'File path', true], as: ['string', 'tab (default) | block'], title: ['string', 'Tab or block title'] },
    run: function (a) { return api('insert_content_file', { file: b64file(a.path), as: a.as, title: a.title }); } },
  load_data: { description: 'Load a CSV, Excel or JSON file as dataset(s), embedded in the dashboard. Each Excel sheet becomes a dataset.', props: { path: ['string', 'File path', true], name: ['string', 'Dataset name (default: file/sheet name)'] },
    run: function (a) { return api('add_dataset', { name: a.name, file: b64file(a.path) }); } },
  drill_data_file: { description: 'Embed drill-down (double-click) detail from a Markdown, Excel, CSV or JSON file and link each table to its chart automatically. In Markdown, put each | table | under a heading naming the chart.', props: { path: ['string', 'File path', true], link: ['boolean', 'Link to matching charts (default true)'] },
    run: function (a) { return api('drill_data', { file: b64file(a.path), link: a.link }); } },
  load_brand: { description: 'Apply a brand from a file: brand JSON, a brand SKILL.md, a .skill/.zip package, or a font file.', props: { path: ['string', 'File path', true] },
    run: function (a) { return api('apply_theme', { file: b64file(a.path) }); } },
  save_prompt: { description: 'Turn review comments into an AI prompt (each located by tab › section › chart) and save it as a Markdown file.', props: { path: ['string', 'Where to save (default: <name>-review-prompt.md)'], goal: ['string', 'apply | polish | review | explain'], assistant: ['string', 'chat | agent | mcp'], scope: ['string', 'all | tab | must'], output: ['string', 'file (complete updated HTML, default) | changes | plan | tickets'], include_done: ['boolean', 'Include closed comments'], extra: ['string', 'Extra instruction'], embed_html: ['boolean', 'Paste the dashboard source into the prompt'] },
    run: function (a) {
      var args = { goal: a.goal, assistant: a.assistant, scope: a.scope, tab: a.tab, output: a.output, include_done: a.include_done, extra: a.extra, embed_html: a.embed_html };
      return Promise.all([api('comments_prompt', args), api('outline', {})]).then(function (r) {
        var file = outPath(a.path, String(r[1].name || 'dashboard').replace(/\.html?$/i, '') + '-review-prompt.md');
        fs.writeFileSync(file, r[0].prompt, 'utf8'); return { saved: file, comments: r[1].comments, characters: r[0].prompt.length };
      });
    } },
  save_tracker: { description: 'Save every review comment as an Excel tracker (.xlsx) with tab, section, chart, comment, done-when, status, owner and due date.', props: { path: ['string', 'Where to save (default: <name> - review tracker.xlsx)'] },
    run: function (a) {
      return api('comments_tracker', {}).then(function (r) { var file = outPath(a.path, r.name); fs.writeFileSync(file, Buffer.from(r.b64, 'base64')); return { saved: file, comments: r.rows }; });
    } },
  load_tracker: { description: 'Update comments from an edited Excel tracker: status, priority, owner, due date, notes and wording (matched by the ID column).', props: { path: ['string', 'The .xlsx file', true] },
    run: function (a) { return api('apply_tracker', { file: b64file(a.path) }); } },
  compare_file: { description: 'What changed between a dashboard file on disk and what is open now (or a second file): tabs, text, chart settings, data, KPI cards, filters, colours, comments.', props: { path: ['string', 'The earlier .html file', true], after: ['string', 'A later .html file (default: the dashboard open now)'] },
    run: function (a) { return api('compare_versions', { before_html: fs.readFileSync(resolvePath(a.path), 'utf8'), after_html: a.after ? fs.readFileSync(resolvePath(a.after), 'utf8') : undefined, after: a.after ? undefined : 'now' }); } },
  publish_html: { description: 'Publish a view-only copy to disk: version number, date, release note and corner badge; optionally locked for editing with a password, and sealed so Mothership warns if it is changed later. Run publish_check first.', props: { path: ['string', 'Where to save (default: <name> v<version>.html)'], version: ['string', 'e.g. 1.0 (default: next after the last publish)'], note: ['string', 'What changed'], by: ['string', 'Published by'], as_of: ['string', 'Data as of (YYYY-MM-DD)'], password: ['string', 'Lock editing with this password (6+ characters). Without one, an earlier lock is kept'], unlock: ['boolean', 'Remove an earlier lock'], badge: ['boolean', 'Show the version badge (default true)'], keep_comments: ['boolean', 'Keep review comments in the file'] },
    run: function (a) {
      var args = {}; ['version', 'note', 'by', 'as_of', 'password', 'unlock', 'badge', 'keep_comments'].forEach(function (k) { if (a[k] !== undefined) args[k] = a[k]; });
      return api('publish', args).then(function (r) { var file = outPath(a.path, r.name); fs.writeFileSync(file, r.html, 'utf8'); return { saved: file, version: r.version, locked: r.locked, sha256: r.sha256, size: Math.round(r.bytes / 1024) + ' KB' }; });
    } },
  chart_image: { description: 'A PNG of one chart (shown to you, optionally saved).', props: { chart: ['string', 'Chart name or key', true], path: ['string', 'Also save it here'] },
    run: function (a) { return LOCAL.screenshot.run({ what: a.chart, path: a.path }); } }
};
// in-page tools that the file-system versions above replace
var HIDDEN = { open_folder_files: 1, insert_content_file: 1, comments_tracker: 1, apply_tracker: 1, publish: 1 };

function schemaOf(props) {
  var p = {}, req = [];
  Object.keys(props).forEach(function (k) { p[k] = { type: props[k][0], description: props[k][1] }; if (props[k][2]) req.push(k); });
  return { type: 'object', properties: p, required: req };
}
function localTools() { return Object.keys(LOCAL).map(function (k) { return { name: k, description: LOCAL[k].description, inputSchema: schemaOf(LOCAL[k].props) }; }); }

var pageTools = null;
function listTools() {
  if (pageTools) return Promise.resolve(merge(pageTools));
  return ensure().then(function () { return evaluate('JSON.stringify(MS.api.describe())'); }).then(function (s) {
    pageTools = JSON.parse(s); return merge(pageTools);
  }, function (e) {
    log('could not start the browser yet: ' + e.message);
    return localTools(); // status explains what is wrong
  });
}
function merge(pt) {
  var local = localTools(), names = {}; local.forEach(function (t) { names[t.name] = 1; });
  return local.concat(pt.filter(function (t) { return !names[t.name] && !HIDDEN[t.name]; }));
}

function callTool(name, args) {
  var run = LOCAL[name] ? Promise.resolve().then(function () { return LOCAL[name].run(args || {}); }) : api(name, args);
  return run.then(function (r) {
    if (r && r.__content) return { content: r.__content };
    var text = JSON.stringify(r, null, 1); if (text.length > 200000) text = text.slice(0, 200000) + '\n…(cut)';
    return { content: [{ type: 'text', text: text }] };
  }, function (e) {
    return { content: [{ type: 'text', text: 'Error: ' + (e && e.message || e) }], isError: true };
  });
}

/* ------------------------------------------------------------------ MCP over stdio (newline-delimited JSON-RPC) */
var INSTRUCTIONS = 'Mothership edits HTML dashboards like PowerPoint edits slides. Start with open_file (or new_dashboard), then outline to see the tabs, charts, datasets and comments. ' +
  'Refer to charts by their plain names from outline. Elements: use find to get refs, then set_text / set_style / set_popup. Every change is undoable (undo). ' +
  'Use screenshot to look at the result and export_html to save. Numbers follow the region set with set_locale (US $ by default).';

function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: id, result: result }) + '\n'); }
function fail(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: id, error: { code: code, message: message } }) + '\n'); }

function handle(msg) {
  var id = msg.id, has = id !== undefined && id !== null;
  switch (msg.method) {
    case 'initialize':
      return reply(id, { protocolVersion: (msg.params && msg.params.protocolVersion) || '2025-06-18', capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'mothership', version: VERSION }, instructions: INSTRUCTIONS });
    case 'ping': return reply(id, {});
    case 'tools/list': return listTools().then(function (t) { reply(id, { tools: t }); });
    case 'tools/call': return callTool(msg.params.name, msg.params.arguments).then(function (r) { reply(id, r); });
    case 'resources/list': return reply(id, { resources: [] });
    case 'prompts/list': return reply(id, { prompts: [] });
    default: if (has) fail(id, -32601, 'Method not found: ' + msg.method);
  }
}

var inbuf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', function (d) {
  inbuf += d; var i;
  while ((i = inbuf.indexOf('\n')) >= 0) {
    var line = inbuf.slice(0, i).trim(); inbuf = inbuf.slice(i + 1);
    if (!line) continue;
    var msg; try { msg = JSON.parse(line); } catch (e) { fail(null, -32700, 'Parse error'); continue; }
    Promise.resolve().then(function () { return handle(msg); }).catch(function (e) { if (msg.id != null) fail(msg.id, -32603, e.message); });
  }
});
process.stdin.on('end', function () { shutdown(); process.exit(0); });
process.on('SIGINT', function () { shutdown(); process.exit(0); });
process.on('SIGTERM', function () { shutdown(); process.exit(0); });
process.on('exit', shutdown);
