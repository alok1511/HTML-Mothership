/* Convert uploaded files (Markdown, Word, Excel/CSV, PowerPoint, PDF, images,
   text, HTML) into safe HTML for content tabs and blocks. All offline. */
(function (MS) {
  'use strict';
  var I = MS.importers = {};

  /* lazy-load vendored libraries (or their inlined copies in the single-file build) */
  var LIBS = { marked: 'vendor/marked.min.js', mammoth: 'vendor/mammoth.browser.min.js', xlsx: 'vendor/xlsx.full.min.js', jszip: 'vendor/jszip.min.js', pdf: 'vendor/pdf.min.js', pdfworker: 'vendor/pdf.worker.min.js' };
  var GLOBAL = { marked: 'marked', mammoth: 'mammoth', xlsx: 'XLSX', jszip: 'JSZip', pdf: 'pdfjsLib', pdfworker: 'pdfjsWorker' };
  var loading = {};
  MS.lib = function (name) {
    if (window[GLOBAL[name]]) return Promise.resolve(window[GLOBAL[name]]);
    if (loading[name]) return loading[name];
    loading[name] = new Promise(function (res, rej) {
      var inl = document.querySelector('script[type="text/ms-lib"][data-lib="' + name + '"]');
      var s = document.createElement('script');
      if (inl) { s.textContent = inl.textContent; document.head.appendChild(s); return window[GLOBAL[name]] ? res(window[GLOBAL[name]]) : rej(new Error('Could not start ' + name)); }
      s.src = LIBS[name];
      s.onload = function () { res(window[GLOBAL[name]]); };
      s.onerror = function () { rej(new Error('Missing library ' + LIBS[name] + '. Keep the vendor folder next to mothership.html.')); };
      document.head.appendChild(s);
    });
    return loading[name];
  };

  I.kind = function (name) {
    var e = MS.ext(name);
    if (/^(md|markdown)$/.test(e)) return 'markdown';
    if (/^(docx)$/.test(e)) return 'word';
    if (/^(xlsx|xlsm|xls|ods|csv|tsv)$/.test(e)) return 'sheet';
    if (/^(pptx)$/.test(e)) return 'slides';
    if (e === 'pdf') return 'pdf';
    if (/^(png|jpe?g|gif|webp|svg|bmp)$/.test(e)) return 'image';
    if (/^(html?|htm)$/.test(e)) return 'html';
    if (/^(txt|log|json)$/.test(e)) return 'text';
    if (/^(doc|ppt)$/.test(e)) return 'legacy';
    return null;
  };
  I.accept = '.md,.markdown,.docx,.xlsx,.xlsm,.xls,.ods,.csv,.tsv,.pptx,.pdf,.png,.jpg,.jpeg,.gif,.webp,.svg,.txt,.html,.htm';

  // -> Promise<{ html, title, datasets?: [{name, rows}] }>
  I.convert = function (file, opts) {
    opts = opts || {};
    var k = I.kind(file.name), title = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    var done = function (html, extra) { return Object.assign({ html: MS.sanitize(html), title: title }, extra || {}); };
    switch (k) {
      case 'markdown': return Promise.all([MS.lib('marked'), MS.readFile(file)]).then(function (r) {
        var md = r[1].replace(/^---\s*\n[\s\S]*?\n---\s*\n/, '');
        var html = r[0].parse(md, { gfm: true, breaks: false });
        return done(opts.faq ? I.faqify(html) : html);
      });
      case 'word': return Promise.all([MS.lib('mammoth'), MS.readFile(file, 'buffer')]).then(function (r) {
        return r[0].convertToHtml({ arrayBuffer: r[1] }).then(function (res) { var h = res.value; return done(opts.faq ? I.faqify(h) : h); });
      });
      case 'sheet': return Promise.all([MS.lib('xlsx'), MS.readFile(file, 'buffer')]).then(function (r) { return I.sheet(r[0], r[1], file.name, title); });
      case 'slides': return Promise.all([MS.lib('jszip'), MS.readFile(file, 'buffer')]).then(function (r) { return I.pptx(r[0], r[1]).then(function (h) { return done(h); }); });
      case 'pdf': return MS.readFile(file, 'buffer').then(function (b) { return I.pdf(b, opts.pdfMode).then(function (h) { return done(h); }); });
      case 'image': return MS.readFile(file, 'dataurl').then(function (d) { return I.shrink(d); }).then(function (d) { return done('<figure><img src="' + d + '" alt="' + MS.esc(title) + '"><figcaption>' + MS.esc(title) + '</figcaption></figure>'); });
      case 'html': return MS.readFile(file).then(function (t) { var d = new DOMParser().parseFromString(t, 'text/html'); return done(d.body.innerHTML); });
      case 'text': return MS.readFile(file).then(function (t) { return done('<pre>' + MS.esc(t) + '</pre>'); });
      case 'legacy': return Promise.reject(new Error(file.name + ': old .doc/.ppt formats can\'t be read in the browser. Save as .docx/.pptx (or PDF) and try again.'));
      default: return Promise.reject(new Error('Unsupported file type: ' + file.name));
    }
  };

  // Turn "## Question" + following content into collapsible <details> (for FAQs).
  I.faqify = function (html) {
    var d = new DOMParser().parseFromString('<body>' + html, 'text/html'), out = d.createElement('div');
    var nodes = Array.prototype.slice.call(d.body.childNodes), cur = null, level = null;
    nodes.forEach(function (n) { if (n.nodeType === 1 && /^H[2-4]$/.test(n.tagName)) { var l = +n.tagName[1]; if (level === null || l < level) level = l; } });
    nodes.forEach(function (n) {
      if (n.nodeType === 1 && n.tagName === 'H' + level) {
        cur = d.createElement('details'); var s = d.createElement('summary'); s.innerHTML = n.innerHTML; cur.appendChild(s); out.appendChild(cur);
      } else if (cur) cur.appendChild(n); else out.appendChild(n);
    });
    return out.innerHTML;
  };

  I.sheet = function (XLSX, buf, name, title) {
    var wb = XLSX.read(buf, { type: 'array', cellDates: true });
    var html = '', datasets = [];
    wb.SheetNames.forEach(function (sn) {
      var ws = wb.Sheets[sn];
      var aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
      if (!aoa.length) return;
      var rows = XLSX.utils.sheet_to_json(ws, { raw: true, defval: null });
      rows = rows.map(function (r) { var o = {}; Object.keys(r).forEach(function (k) { var v = r[k]; o[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v; }); return o; });
      if (rows.length) datasets.push({ name: (wb.SheetNames.length > 1 ? title + ' – ' + sn : title), rows: rows });
      var lim = 2000;
      html += (wb.SheetNames.length > 1 ? '<h2>' + MS.esc(sn) + '</h2>' : '') + '<div class="ms-table-wrap"><table class="ms-table"><thead><tr>' +
        aoa[0].map(function (h) { return '<th>' + MS.esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        aoa.slice(1, lim + 1).map(function (r) { return '<tr>' + aoa[0].map(function (_, i) { var v = r[i]; var num = typeof v === 'number'; return '<td' + (num ? ' class="num"' : '') + '>' + MS.esc(v instanceof Date ? v.toISOString().slice(0, 10) : num ? v.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : (v == null ? '' : v)) + '</td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody></table></div>' + (aoa.length > lim + 1 ? '<p class="ms-muted">Showing the first ' + lim + ' of ' + (aoa.length - 1) + ' rows.</p>' : '');
    });
    return { html: MS.sanitize(html), title: title, datasets: datasets };
  };

  // PowerPoint: text, bullet levels, tables and pictures per slide, plus speaker notes.
  I.pptx = function (JSZip, buf) {
    return JSZip.loadAsync(buf).then(function (zip) {
      var slides = Object.keys(zip.files).filter(function (p) { return /^ppt\/slides\/slide\d+\.xml$/.test(p); })
        .sort(function (a, b) { return parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10); });
      return Promise.all(slides.map(function (p, idx) {
        var relp = p.replace('slides/', 'slides/_rels/') + '.rels';
        return Promise.all([zip.file(p).async('string'), zip.file(relp) ? zip.file(relp).async('string') : '']).then(function (r) {
          var x = new DOMParser().parseFromString(r[0], 'application/xml');
          var rels = {}, notes = null;
          if (r[1]) Array.prototype.forEach.call(new DOMParser().parseFromString(r[1], 'application/xml').getElementsByTagName('Relationship'), function (n) {
            rels[n.getAttribute('Id')] = n.getAttribute('Target');
            if (/notesSlide/.test(n.getAttribute('Type'))) notes = n.getAttribute('Target');
          });
          var parts = [], title = '', imgJobs = [];
          var spTree = x.getElementsByTagNameNS('*', 'spTree')[0];
          var shapes = spTree ? Array.prototype.slice.call(spTree.children) : [];
          shapes.forEach(function walk(sh) {
            var tag = sh.localName;
            if (tag === 'grpSp') { Array.prototype.forEach.call(sh.children, walk); return; }
            if (tag === 'sp') {
              var ph = sh.getElementsByTagNameNS('*', 'ph')[0], type = ph && ph.getAttribute('type');
              var paras = Array.prototype.map.call(sh.getElementsByTagNameNS('*', 'p'), function (pp) {
                var t = Array.prototype.map.call(pp.getElementsByTagNameNS('*', 't'), function (n) { return n.textContent; }).join('');
                var ppr = pp.getElementsByTagNameNS('*', 'pPr')[0];
                return { t: t, lvl: ppr ? +(ppr.getAttribute('lvl') || 0) : 0, bullet: !(ppr && ppr.getElementsByTagNameNS('*', 'buNone').length) };
              }).filter(function (q) { return q.t.trim(); });
              if (!paras.length) return;
              if (type === 'title' || type === 'ctrTitle') { title = paras.map(function (q) { return q.t; }).join(' '); return; }
              if (paras.length === 1 || type === 'subTitle') { parts.push(paras.map(function (q) { return '<p>' + MS.esc(q.t) + '</p>'; }).join('')); return; }
              parts.push('<ul>' + paras.map(function (q) { return '<li style="margin-left:' + (q.lvl * 18) + 'px">' + MS.esc(q.t) + '</li>'; }).join('') + '</ul>');
            } else if (tag === 'graphicFrame') {
              var tbl = sh.getElementsByTagNameNS('*', 'tbl')[0];
              if (tbl) parts.push('<table class="ms-table">' + Array.prototype.map.call(tbl.getElementsByTagNameNS('*', 'tr'), function (tr, ri) {
                return '<tr>' + Array.prototype.map.call(tr.getElementsByTagNameNS('*', 'tc'), function (tc) {
                  var t = Array.prototype.map.call(tc.getElementsByTagNameNS('*', 't'), function (n) { return n.textContent; }).join(' ');
                  return ri ? '<td>' + MS.esc(t) + '</td>' : '<th>' + MS.esc(t) + '</th>';
                }).join('') + '</tr>';
              }).join('') + '</table>');
              else if (sh.getElementsByTagNameNS('*', 'chart').length) parts.push('<p class="ms-muted">[Chart on the original slide. Add it as an image if you need it.]</p>');
            } else if (tag === 'pic') {
              var blip = sh.getElementsByTagNameNS('*', 'blip')[0], rid = blip && (blip.getAttribute('r:embed') || blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'));
              var target = rid && rels[rid];
              if (target) {
                var path = ('ppt/slides/' + target).split('/').reduce(function (a, seg) { if (seg === '..') a.pop(); else a.push(seg); return a; }, []).join('/');
                var ph2 = '@@IMG' + imgJobs.length + '@@';
                parts.push(ph2);
                imgJobs.push(zip.file(path) ? zip.file(path).async('base64').then(function (b) {
                  var e = MS.ext(path), mt = e === 'svg' ? 'image/svg+xml' : e === 'png' ? 'image/png' : e === 'gif' ? 'image/gif' : /emf|wmf/.test(e) ? null : 'image/jpeg';
                  return mt ? I.shrink('data:' + mt + ';base64,' + b).then(function (d) { return '<img src="' + d + '" alt="">'; }) : '';
                }) : Promise.resolve(''));
              }
            }
          });
          var notesJob = notes && zip.file(('ppt/slides/' + notes).replace(/slides\/\.\.\//, '')) ?
            zip.file(('ppt/slides/' + notes).replace(/slides\/\.\.\//, '')).async('string').then(function (s) {
              var nx = new DOMParser().parseFromString(s, 'application/xml');
              var body = Array.prototype.filter.call(nx.getElementsByTagNameNS('*', 'sp'), function (sp) { var ph = sp.getElementsByTagNameNS('*', 'ph')[0]; return ph && ph.getAttribute('type') === 'body'; })[0];
              return body ? Array.prototype.map.call(body.getElementsByTagNameNS('*', 't'), function (n) { return n.textContent; }).join(' ') : '';
            }) : Promise.resolve('');
          return Promise.all([Promise.all(imgJobs), notesJob]).then(function (rr) {
            var html = parts.join('\n');
            rr[0].forEach(function (img, i) { html = html.replace('@@IMG' + i + '@@', img); });
            return '<section class="ms-slide"><h2>' + (title ? MS.esc(title) : 'Slide ' + (idx + 1)) + '</h2>' + html +
              (rr[1] ? '<details><summary>Speaker notes</summary><p>' + MS.esc(rr[1]) + '</p></details>' : '') + '</section>';
          });
        });
      })).then(function (s) { return s.join('\n'); });
    });
  };

  // PDF: render pages as images (faithful) or extract text (searchable, lighter).
  I.pdf = function (buf, mode) {
    return MS.lib('pdfworker').catch(function () {}).then(function () { return MS.lib('pdf'); }).then(function (pdfjs) {
      pdfjs.GlobalWorkerOptions.workerSrc = LIBS.pdfworker;
      return pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise.then(function (pdf) {
        var jobs = [];
        for (var i = 1; i <= Math.min(pdf.numPages, 200); i++) jobs.push(i);
        return jobs.reduce(function (p, n) {
          return p.then(function (acc) {
            return pdf.getPage(n).then(function (page) {
              if (mode === 'text') return page.getTextContent().then(function (tc) {
                var lines = [], last = null, line = [];
                tc.items.forEach(function (it) { var y = Math.round(it.transform[5]); if (last !== null && Math.abs(y - last) > 2) { lines.push(line.join('')); line = []; } line.push(it.str); last = y; });
                lines.push(line.join(''));
                return acc + '<h3>Page ' + n + '</h3>' + lines.filter(function (l) { return l.trim(); }).map(function (l) { return '<p>' + MS.esc(l) + '</p>'; }).join('');
              });
              var vp = page.getViewport({ scale: 1.6 });
              var cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
              return page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise.then(function () {
                return acc + '<img class="ms-page" alt="Page ' + n + '" src="' + cv.toDataURL('image/jpeg', 0.82) + '">';
              });
            });
          });
        }, Promise.resolve('')).then(function (h) { return pdf.numPages > 200 ? h + '<p class="ms-muted">Only the first 200 pages were imported.</p>' : h; });
      });
    });
  };

  // Downscale very large images to keep exported files small.
  I.shrink = function (dataUrl, max) {
    max = max || 1800;
    if (/^data:image\/(svg|gif)/.test(dataUrl)) return Promise.resolve(dataUrl);
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        if (img.width <= max && img.height <= max) return res(dataUrl);
        var s = max / Math.max(img.width, img.height), cv = document.createElement('canvas');
        cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        res(cv.toDataURL(/png/.test(dataUrl.slice(0, 20)) ? 'image/png' : 'image/jpeg', 0.85));
      };
      img.onerror = function () { res(dataUrl); };
      img.src = dataUrl;
    });
  };

  /* ---------------------------------------------------------- insert flows */
  function askOptions(files, extra) {
    var kinds = files.map(function (f) { return I.kind(f.name); });
    var fields = (extra || []).slice();
    if (kinds.some(function (k) { return k === 'markdown' || k === 'word'; })) fields.push({ key: 'faq', label: 'Turn headings into collapsible questions (good for FAQs)', type: 'checkbox' });
    if (kinds.indexOf('pdf') >= 0) fields.push({ key: 'pdfMode', label: 'PDF import', type: 'select', options: [{ value: 'image', label: 'Pages as images (looks exactly like the PDF)' }, { value: 'text', label: 'Extract text (smaller, searchable, editable)' }], value: 'image' });
    if (kinds.indexOf('sheet') >= 0) fields.push({ key: 'asData', label: 'Also make spreadsheet sheets available as data (for filters & drill-downs)', type: 'checkbox', value: true });
    if (!fields.length) return Promise.resolve({});
    var f = MS.form(fields);
    return MS.dialog({ title: 'Import ' + files.length + ' file(s)', body: f, buttons: [{ label: 'Cancel', value: null }, { label: 'Import', primary: true, value: function () { return f.values(); } }] });
  }
  function convertAll(files, opts) {
    MS.status('Converting ' + files.length + ' file(s)…');
    MS.busy(true);
    return Promise.all(files.map(function (f) { return I.convert(f, opts).catch(function (e) { MS.toast(e.message, 'error', 8000); return null; }); }))
      .then(function (r) {
        MS.busy(false);
        r = r.filter(Boolean);
        if (opts.asData) r.forEach(function (x) { (x.datasets || []).forEach(function (d) { MS.data.addDataset(d.name, d.rows, true); }); });
        return r;
      }, function (e) { MS.busy(false); throw e; });
  }

  // New content tab(s), one per file, or merged into one tab.
  I.newTabs = function (files) {
    if (!files || !files.length) return;
    var rt = MS.rt(); if (!rt) return MS.toast('Open a dashboard first.', 'warn');
    var extra = [{ key: 'title', label: 'Tab title', value: files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') : 'Resources' }];
    if (files.length > 1) extra.push({ key: 'merge', label: 'Put all files in one tab', type: 'checkbox', value: false });
    askOptions(files, extra).then(function (o) {
      if (!o) return;
      convertAll(files, o).then(function (res) {
        if (!res.length) return;
        var groups = o.merge || res.length === 1 ? [{ title: o.title, html: res.map(function (r) { return res.length > 1 ? '<h1>' + MS.esc(r.title) + '</h1>' + r.html : r.html; }).join('\n') }] : res;
        MS.history.group('Add content tab', function () { groups.forEach(function (g) { MS.tabs.add(g.title, 'content', g.html); }); });
        MS.toast('Added ' + groups.length + ' tab(s).', 'ok');
      });
    });
  };
  // Replace or append the content of an existing tab.
  I.intoTab = function (tabId, files) {
    var rt = MS.rt(), sec = rt && rt.tabEl(tabId);
    if (!sec || !files.length) return;
    askOptions(files, [{ key: 'how', label: 'How', type: 'select', options: [{ value: 'append', label: 'Add to the end of the tab' }, { value: 'replace', label: 'Replace the tab\'s content' }], value: 'append' }]).then(function (o) {
      if (!o) return;
      convertAll(files, o).then(function (res) {
        if (!res.length) return;
        var html = res.map(function (r) { return r.html; }).join('\n');
        var host = sec.querySelector('.ms-doc') || sec.querySelector('.ms-grid') || sec;
        var before = host.innerHTML;
        var after;
        if (host.classList.contains('ms-grid')) {
          var b = MS.blocks.create({ title: res[0].title, content: true, html: html, span: 12 });
          return MS.history.move('Add content', b, function () { if (o.how === 'replace') { host.innerHTML = ''; } host.appendChild(b); });
        }
        host.innerHTML = o.how === 'replace' ? html : before + html;
        rt.tagTree(host); after = host.innerHTML;
        MS.history.push({ label: 'Update tab content', undo: function () { host.innerHTML = before; MS.afterDomChange(); }, redo: function () { host.innerHTML = after; MS.afterDomChange(); } }, true);
        MS.afterDomChange();
      });
    });
  };
  // A content block (image, document, table...) in the current tab.
  I.asBlock = function (files) {
    var rt = MS.rt(); if (!rt) return;
    askOptions(files, []).then(function (o) {
      if (!o) return;
      convertAll(files, o).then(function (res) {
        MS.history.group('Insert content', function () { res.forEach(function (r) { MS.insert.block(MS.blocks.create({ title: r.title, content: true, html: r.html, span: 6 })); }); });
      });
    });
  };
})(window.MS);
