#!/usr/bin/env node
/* Optional: serve the folder on http://localhost:8080 (only if your browser blocks file:// features).
   Mothership normally works by just double-clicking mothership.html. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), port = Number(process.argv[2]) || 8080;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/markdown' };
http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\.\.+/g, ''));
  const f = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'mothership.html') : p;
  if (!f.startsWith(root) || !fs.existsSync(f)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': (types[path.extname(f)] || 'application/octet-stream') + '; charset=utf-8' });
  fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('Mothership on http://localhost:' + port + '/ (local only, Ctrl+C to stop)'));
