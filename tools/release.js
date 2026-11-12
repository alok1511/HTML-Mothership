#!/usr/bin/env node
/*
 * Optional (needs Node.js, NOT needed to use Mothership).
 *   node tools/build.js && node tools/release.js
 * Makes dist/HTML-Mothership-v<version>.zip: everything a user needs, named after the one version number in
 * package.json. Uses the JSZip copy in vendor/, so it needs no packages and no internet.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const JSZip = require('../vendor/jszip.min.js');

const root = path.resolve(__dirname, '..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const top = 'HTML-Mothership-v' + version;
// What goes in: the editor and its folders, the single-file build, docs, samples, recipes, MCP servers, licences.
const include = ['mothership.html', 'dist/mothership-standalone.html', 'src', 'vendor', 'samples', 'recipes', 'plugins', 'skills', 'docs', 'tools/mcp',
  'README.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'licenses', '.mcp.json'];
const skip = /(^|\/)(node_modules|\.git|__pycache__)(\/|$)|\.pyc$/;

const zip = new JSZip();
let files = 0, bytes = 0;
function add(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full) || skip.test(rel)) return;
  const st = fs.statSync(full);
  if (st.isDirectory()) { fs.readdirSync(full).sort().forEach(f => add(rel + '/' + f)); return; }
  const data = fs.readFileSync(full);
  zip.file(top + '/' + rel, data, { date: new Date(st.mtime) });
  files++; bytes += data.length;
}
include.forEach(add);
const built = fs.readFileSync(path.join(root, 'dist/mothership-standalone.html'), 'utf8');
if (built.indexOf("MS.VERSION = '" + version + "'") < 0) throw new Error('dist/mothership-standalone.html is not ' + version + '. Run node tools/build.js first.');

zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } }).then(buf => {
  const out = path.join(root, 'dist', top + '.zip');
  fs.writeFileSync(out, buf);
  console.log('release  ' + path.relative(root, out) + ' · ' + files + ' files · ' + (buf.length / 1048576).toFixed(1) + ' MB (from ' + (bytes / 1048576).toFixed(1) + ' MB)');
});
