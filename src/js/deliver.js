/* Client-ready output: a print layout with one page per tab (Print / Save as PDF from the
   browser, nothing to install) and a PowerPoint file with one slide per tab or per story step.
   Charts are copied as pictures; titles stay editable text in PowerPoint. */
(function (MS) {
  'use strict';
  var h = MS.h;
  var Dv = MS.deliver = { WIDTH: 1280 };
  function rt() { return MS.rt(); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) { return MS.esc(s); }
  function today() { return new Date().toLocaleDateString(MS.locale ? MS.locale.get().locale : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }

  // The pages: the dashboard's own tabs, else the tab ribbon's tabs, else the whole page.
  Dv.pages = function () {
    var r = rt(), d = MS.child.doc;
    var g = r && r.pageTabs && r.pageTabs();
    if (g && g.tabs.length > 1) return g.tabs.map(function (t) { return { title: t.title, show: function () { r.showPageTab(t.index); }, root: function () { return t.panel; } }; });
    if (r && r.layoutEnabled()) return r.tabs().filter(function (t) { return !t.hidden; }).map(function (t) { return { title: t.title, show: function () { r.showTab(t.id); }, root: function () { return r.tabEl(t.id); } }; });
    return [{ title: d.title || (MS.doc ? MS.doc.name.replace(/\.html?$/i, '') : 'Dashboard'), show: function () {}, root: function () { return d.body; } }];
  };
  // The story steps as pages (one part each, the headline as the title).
  Dv.storyPages = function () {
    var r = rt(); if (!r) return [];
    return (MS.story ? MS.story.steps() : []).map(function (s) {
      return { title: s.headline || '', text: s.text || '', show: function () { var n = r.findRef(s.ref); if (n) { var pt = r.pageTabOf(n); if (pt && !pt.active) r.showPageTab(pt.index); var sec = n.closest('#ms-main > section.ms-tab'); if (sec) r.showTab(sec.getAttribute('data-ms-tab')); } }, root: function () { return r.findRef(s.ref); } };
    });
  };
  // A copy of a part that needs no scripts: canvases become pictures, editor bits go.
  function staticClone(root) {
    var d = MS.child.doc;
    var cvs = Array.prototype.slice.call(root.querySelectorAll('canvas')); if (root.tagName === 'CANVAS') cvs.unshift(root);
    var n = root.cloneNode(true), ccs = Array.prototype.slice.call(n.querySelectorAll('canvas')); if (n.tagName === 'CANVAS') ccs.unshift(n);
    ccs.forEach(function (c, i) {
      var o = cvs[i]; if (!o) return;
      var img = d.createElement('img'), b = o.getBoundingClientRect();
      try { img.src = o.toDataURL('image/png'); } catch (e) { return; }
      img.alt = o.getAttribute('aria-label') || '';
      img.style.cssText = 'display:block;width:' + Math.round(b.width) + 'px;height:' + Math.round(b.height) + 'px;max-width:100%';
      if (c === n) n = img; else c.parentNode.replaceChild(img, c);
    });
    MS.$$('script,noscript,[data-ms-editor],.ms-grip,.ms-drag,.ms-rgrip,.ms-pgrip,.ms-size-handle,#ms-ribbon,#ms-stamp,#ms-watermark,#ms-story,#ms-story-spot,#ms-story-btn,#ms-badge,#ms-errbar,#ms-firm-foot,#ms-cmt-layer,.ms-cmt-pin,.ms-laser', n).forEach(function (x) { x.remove(); });
    MS.$$('.ms-sel,.ms-hover,.ms-flash', n).concat([n]).forEach(function (x) { if (x.classList) x.classList.remove('ms-sel', 'ms-hover', 'ms-flash'); });
    MS.$$('[contenteditable]', n).forEach(function (x) { x.removeAttribute('contenteditable'); });
    if (n.tagName === 'BODY') { var div = d.createElement('div'); while (n.firstChild) div.appendChild(n.firstChild); n = div; }
    n.style.display = 'block';
    return n;
  }
  Dv.staticClone = staticClone;
  function pageStyles() {
    return MS.$$('style', MS.child.doc).filter(function (x) { return !x.hasAttribute('data-ms-editor'); }).map(function (x) { return x.textContent; }).join('\n');
  }
  function linkStyles() { return MS.$$('link[rel~="stylesheet"]', MS.child.doc.head).map(function (x) { return x.outerHTML; }).join('\n'); }
  // Show each page in turn, let its charts draw, and take a static copy.
  Dv.capture = function (pages) {
    var r = rt(), g = r && r.pageTabs && r.pageTabs(), was = { pt: g ? (g.tabs.filter(function (t) { return t.active; })[0] || {}).index : null, tab: r && r.activeTab };
    var out = [], chain = Promise.resolve();
    pages.forEach(function (p) {
      chain = chain.then(function () { p.show(); return wait(500); }).then(function () { if (r) { r.refresh(); if (r.renderAnnots) r.renderAnnots(); } return wait(250); }).then(function () {
        var root = p.root(); if (!root) return;
        out.push({ title: p.title, text: p.text || '', html: staticClone(root).outerHTML });
      });
    });
    return chain.then(function () {
      if (r && was.pt != null && g) r.showPageTab(was.pt);
      if (r && was.tab && r.layoutEnabled()) r.showTab(was.tab);
      return out;
    });
  };
  // Header and footer text: the firm, the stage, the date, confidential.
  function frame() {
    var r = rt(), st = r ? r.state : {}, f = st.firm || {}, c = st.confidential;
    var stage = MS.stage ? MS.stage.get() : '';
    return { firm: f.name || '', logo: f.logo || (st.theme && st.theme.logo) || '', footer: f.footer || '', conf: c && c.on ? (c.label || 'Client confidential') : '', stage: stage === 'draft' ? 'Draft' : stage === 'review' ? 'In review' : '', doc: (MS.child.doc.title || (MS.doc && MS.doc.name || '').replace(/\.html?$/i, '')), date: today() };
  }
  var PRINT_CSS = [
    '@page{size:A4 landscape;margin:9mm}',
    'html,body{margin:0!important;padding:0!important;background:#fff}',
    '.mp-page{width:1280px;box-sizing:border-box;break-after:page;page-break-after:always;position:relative;overflow:hidden;background:var(--ms-bg,#fff);padding:4px 6px}',
    '.mp-page:last-child{break-after:auto;page-break-after:auto}',
    '.mp-head{display:flex;align-items:flex-end;gap:16px;border-bottom:2px solid var(--ms-primary,#4f46e5);padding:0 2px 8px;margin-bottom:12px;font-family:var(--ms-font-heading,system-ui,sans-serif)}',
    '.mp-head h1{margin:0;font-size:24px;line-height:1.2;color:var(--ms-text,#0f172a)}.mp-sub{color:#64748b;font-size:12.5px;margin-top:2px}.mp-head img{height:30px;width:auto;margin-left:auto}',
    '.mp-tag{margin-left:auto;font:700 11px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:#d97706;border-radius:4px;padding:3px 8px}.mp-tag.draft{background:#64748b}',
    '.mp-text{font-size:14px;color:#334155;margin:-4px 0 10px}',
    '.mp-body>*{display:block!important}.mp-body .ms-tab{display:block!important}',
    '.mp-foot{display:flex;gap:16px;justify-content:space-between;border-top:1px solid #e2e8f0;margin-top:12px;padding-top:6px;font:11px/1.4 system-ui,sans-serif;color:#64748b}',
    '.mp-conf{color:#b91c1c;font-weight:700;text-transform:uppercase;letter-spacing:.05em}',
    '@media print{.mp-page{zoom:var(--k,1)}}',
    '@media screen{body{background:#e2e8f0!important}.mp-page{margin:18px auto;box-shadow:0 2px 14px rgba(0,0,0,.15);background:#fff}.mp-bar{position:sticky;top:0;z-index:5;background:#0f172a;color:#fff;font:14px system-ui,sans-serif;padding:10px 16px;display:flex;gap:12px;align-items:center}.mp-bar button{font:inherit;border:0;border-radius:6px;padding:6px 14px;background:#fff;color:#0f172a;cursor:pointer}}',
    '@media print{.mp-bar{display:none}}'
  ].join('\n');
  // fit each page on one sheet: A4 landscape inside the margins is about 1054 x 725 css px (kept a little smaller)
  var FIT_JS = 'function msFit(){var W=1030,H=690;Array.prototype.forEach.call(document.querySelectorAll(".mp-page"),function(p){var k=Math.min(W/p.offsetWidth,H/p.scrollHeight,1);p.style.setProperty("--k",k.toFixed(4));});}window.addEventListener("load",function(){setTimeout(msFit,50);});window.addEventListener("beforeprint",msFit);';
  Dv.printHtml = function (shots) {
    var F = frame(), n = shots.length, b = MS.child.doc.body;
    var pages = shots.map(function (s, i) {
      var tag = F.stage ? '<span class="mp-tag' + (F.stage === 'Draft' ? ' draft' : '') + '">' + esc(F.stage) + '</span>' : '';
      return '<section class="mp-page"><div class="mp-head"><div><h1>' + esc(s.title) + '</h1><div class="mp-sub">' + esc([F.doc !== s.title ? F.doc : '', F.date].filter(Boolean).join(' · ')) + '</div></div>' + tag + (F.logo ? '<img src="' + esc(F.logo) + '" alt="">' : '') + '</div>' +
        (s.text ? '<p class="mp-text">' + esc(s.text) + '</p>' : '') +
        '<div class="mp-body">' + s.html + '</div>' +
        '<div class="mp-foot"><span>' + esc([F.firm, F.footer].filter(Boolean).join(' · ')) + '</span>' + (F.conf ? '<span class="mp-conf">' + esc(F.conf) + '</span>' : '') + '<span>Page ' + (i + 1) + ' of ' + n + '</span></div></section>';
    }).join('\n');
    return '<!DOCTYPE html>\n<html lang="' + esc(MS.child.doc.documentElement.lang || 'en') + '"><head><meta charset="utf-8"><title>' + esc(F.doc || 'Dashboard') + ' (print)</title>' + linkStyles() +
      '<style>' + pageStyles().replace(/<\/style/gi, '<\\/style') + '</style><style>' + PRINT_CSS + '</style><script>' + FIT_JS + '<\/script></head><body class="' + esc(b.className || '') + '">' +
      '<div class="mp-bar"><b>Print layout</b><span>' + n + ' page(s), one per ' + (shots.isStory ? 'story step' : 'tab') + '. Choose "Save as PDF" as the printer for a PDF.</span><button onclick="window.print()">Print / Save as PDF</button></div>' + pages + '</body></html>';
  };
  // opts.from: 'tabs' (default) | 'story'
  Dv.build = function (opts) {
    opts = opts || {};
    if (!MS.child) return Promise.reject(new Error('Nothing is open'));
    var pages = opts.from === 'story' ? Dv.storyPages() : Dv.pages();
    if (!pages.length) return Promise.reject(new Error(opts.from === 'story' ? 'The story has no steps yet.' : 'Nothing to print.'));
    return Dv.capture(pages).then(function (shots) { shots.isStory = opts.from === 'story'; return { shots: shots, html: Dv.printHtml(shots) }; });
  };
  // Print from the browser (a hidden frame), so "Save as PDF" makes the PDF.
  Dv.print = function (opts) {
    var t = MS.toast('Preparing the print layout…', '', 20000);
    return Dv.build(opts).then(function (b) {
      t.close();
      var f = h('iframe', { title: 'Print layout', style: { position: 'fixed', left: '-20000px', top: '0', width: Dv.WIDTH + 'px', height: '900px', border: '0' } });
      f.srcdoc = b.html;
      document.body.appendChild(f);
      f.onload = function () {
        setTimeout(function () {
          try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { MS.download(MS.exportName('-print'), b.html); MS.toast('Your browser blocked printing from here, so the print layout is downloading: open it and press Print.', 'warn', 9000); }
          setTimeout(function () { f.remove(); }, 60000);
        }, 400);
      };
      MS.audit && MS.audit.note('Printed / saved as PDF (' + b.shots.length + ' pages)');
      return b;
    }).catch(function (e) { t.close(); MS.toast(e.message, 'error'); throw e; });
  };
  Dv.downloadPrint = function (opts) {
    return Dv.build(opts).then(function (b) { MS.download(MS.exportName('-print'), b.html); MS.toast('Print layout saved: open it in the browser and press Print (choose "Save as PDF").', 'ok', 7000); return b; });
  };

  /* ---------------------------------------------------------------- PowerPoint */
  // A picture of a part, drawn by the browser itself (an SVG holding the HTML). Falls back to null.
  Dv.picture = function (html, width, scale) {
    width = width || Dv.WIDTH;
    var host = h('iframe', { style: { position: 'fixed', left: '-20000px', top: '0', width: width + 'px', height: '900px', border: '0' } });
    var css = pageStyles();
    host.srcdoc = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' + css.replace(/<\/style/gi, '<\\/style') + '</style><style>html,body{margin:0;background:#fff}#mp{width:' + width + 'px;padding:8px;box-sizing:border-box}#mp>*{display:block!important}</style></head><body class="' + esc(MS.child.doc.body.className || '') + '"><div id="mp">' + html + '</div></body></html>';
    document.body.appendChild(host);
    return new Promise(function (res) { host.onload = function () { setTimeout(res, 150); }; }).then(function () {
      var d = host.contentDocument, node = d.getElementById('mp'), H = Math.max(40, Math.ceil(node.scrollHeight));
      var xml = new XMLSerializer().serializeToString(node);
      var style = css.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      var bcs = MS.child.win.getComputedStyle(MS.child.doc.body), base = 'font-family:' + esc(bcs.fontFamily) + ';color:' + bcs.color + ';font-size:' + bcs.fontSize + ';line-height:' + bcs.lineHeight + ';';
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + H + '"><foreignObject x="0" y="0" width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" class="' + esc(MS.child.doc.body.className || '') + '" style="' + base + 'width:' + width + 'px;background:#fff;margin:0"><style>' + style + '\n#mp{width:' + width + 'px;padding:8px;box-sizing:border-box}#mp&gt;*{display:block!important}</style>' + xml + '</div></foreignObject></svg>';
      return new Promise(function (res) {
        var img = new Image();
        img.onload = function () {
          var s = scale || 1.5, c = document.createElement('canvas'); c.width = Math.round(width * s); c.height = Math.round(H * s);
          var x = c.getContext('2d'); x.scale(s, s); x.fillStyle = '#fff'; x.fillRect(0, 0, width, H); x.drawImage(img, 0, 0);
          try { res({ src: c.toDataURL('image/png'), w: width, h: H }); } catch (e) { res(null); }
        };
        img.onerror = function () { res(null); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
    }).then(function (p) { host.remove(); return p; }, function () { host.remove(); return null; });
  };
  function x(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  var NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  var HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  var GRP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
  var SW = 12192000, SH = 6858000, EMU = 9525;
  function hex6(c, d) { var m = /^#?([0-9a-f]{6})$/i.exec(String(c || '').trim()); return m ? m[1].toUpperCase() : d; }
  function textBox(id, name, xx, y, w, hh, text, o) {
    o = o || {};
    return '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="' + x(name) + '"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="' + xx + '" y="' + y + '"/><a:ext cx="' + w + '" cy="' + hh + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>' +
      '<p:txBody><a:bodyPr wrap="square" lIns="0" rIns="0" tIns="0" bIns="0" anchor="' + (o.anchor || 't') + '"><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p>' + (o.align ? '<a:pPr algn="' + o.align + '"/>' : '') +
      '<a:r><a:rPr lang="en-US" sz="' + (o.size || 1200) + '"' + (o.bold ? ' b="1"' : '') + ' dirty="0"><a:solidFill><a:srgbClr val="' + (o.color || '334155') + '"/></a:solidFill>' + (o.font ? '<a:latin typeface="' + x(o.font) + '"/>' : '') + '</a:rPr><a:t>' + x(text) + '</a:t></a:r></a:p></p:txBody></p:sp>';
  }
  function pic(id, rid, xx, y, w, hh, name) {
    return '<p:pic><p:nvPicPr><p:cNvPr id="' + id + '" name="' + x(name || 'Picture') + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="' + xx + '" y="' + y + '"/><a:ext cx="' + w + '" cy="' + hh + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
  }
  function fit(w, hh, bw, bh) { var k = Math.min(bw / w, bh / hh); return { w: Math.round(w * k), h: Math.round(hh * k) }; }
  function b64(dataUrl) { return dataUrl.slice(dataUrl.indexOf(',') + 1); }
  // slides: [{title, text, images:[{src, w, h}]}] → a .pptx (Uint8Array)
  Dv.pptxFrom = function (slides) {
    var F = frame(), r = rt(), th = r && r.state.theme || {}, col = th.colors || {}, fonts = th.fonts || {};
    var primary = hex6(col.primary, '4F46E5'), textC = hex6(col.text, '0F172A'), head = fonts.heading || fonts.body || '', body = fonts.body || '';
    return MS.lib('jszip').then(function (JSZip) {
      var z = new JSZip(), media = 0;
      var ct = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>', '<Default Extension="xml" ContentType="application/xml"/>', '<Default Extension="png" ContentType="image/png"/>',
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
        '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
        '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'];
      var presRels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>', '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>'];
      var ids = [];
      slides.forEach(function (s, i) {
        var n = i + 1, rels = ['<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'];
        var M = 457200, top = 1005840 + (s.text ? 420000 : 0), foot = 330000, bw = SW - 2 * M, bh = SH - top - foot - 120000;
        var sp = [textBox(2, 'Title', M, 260000, bw, 640000, s.title || ' ', { size: 2600, bold: true, color: textC, font: head, anchor: 'b' })];
        sp.push('<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="3" name="Rule"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="' + M + '" y="935000"/><a:ext cx="' + bw + '" cy="0"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="22225"><a:solidFill><a:srgbClr val="' + primary + '"/></a:solidFill></a:ln></p:spPr></p:cxnSp>');
        if (s.text) sp.push(textBox(4, 'Text', M, 990000, bw, 380000, s.text, { size: 1400, color: '334155', font: body }));
        var imgs = s.images || [], cols = imgs.length > 1 ? Math.min(3, Math.ceil(Math.sqrt(imgs.length))) : 1, rows = Math.ceil(imgs.length / cols) || 1, gap = 120000;
        var cw = Math.floor((bw - gap * (cols - 1)) / cols), chh = Math.floor((bh - gap * (rows - 1)) / rows);
        imgs.forEach(function (im, k) {
          media++; var rid = 'rId' + (k + 2), file = 'image' + media + '.png';
          z.file('ppt/media/' + file, b64(im.src), { base64: true });
          rels.push('<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/' + file + '"/>');
          var f = fit(im.w * EMU, im.h * EMU, cw, chh), cx = M + (k % cols) * (cw + gap) + Math.round((cw - f.w) / 2), cy = top + Math.floor(k / cols) * (chh + gap);
          sp.push(pic(10 + k, rid, cx, cy, f.w, f.h, im.name || ('Picture ' + (k + 1))));
        });
        var ft = [F.firm, F.footer].filter(Boolean).join(' · ');
        if (ft) sp.push(textBox(5, 'Footer', M, SH - foot, Math.round(bw * 0.7), 240000, ft, { size: 900, color: '64748B', font: body }));
        sp.push(textBox(6, 'Page', M + Math.round(bw * 0.7), SH - foot, Math.round(bw * 0.3), 240000, (F.conf ? F.conf.toUpperCase() + '   ' : '') + n + ' / ' + slides.length, { size: 900, color: F.conf ? 'B91C1C' : '64748B', bold: !!F.conf, align: 'r', font: body }));
        z.file('ppt/slides/slide' + n + '.xml', HEAD + '<p:sld ' + NS + '><p:cSld><p:spTree>' + GRP + sp.join('') + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>');
        z.file('ppt/slides/_rels/slide' + n + '.xml.rels', HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels.join('') + '</Relationships>');
        ct.push('<Override PartName="/ppt/slides/slide' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>');
        presRels.push('<Relationship Id="rId' + (n + 2) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide' + n + '.xml"/>');
        ids.push('<p:sldId id="' + (255 + n) + '" r:id="rId' + (n + 2) + '"/>');
      });
      z.file('[Content_Types].xml', HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' + ct.join('') + '</Types>');
      z.file('_rels/.rels', HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');
      z.file('docProps/core.xml', HEAD + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + x(F.doc) + '</dc:title><dc:creator>' + x(MS.prefs.get('author', '') || 'HTML Mothership') + '</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</dcterms:created></cp:coreProperties>');
      z.file('docProps/app.xml', HEAD + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>HTML Mothership</Application><Slides>' + slides.length + '</Slides></Properties>');
      z.file('ppt/presentation.xml', HEAD + '<p:presentation ' + NS + ' saveSubsetFonts="1"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>' + ids.join('') + '</p:sldIdLst><p:sldSz cx="' + SW + '" cy="' + SH + '"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>');
      z.file('ppt/_rels/presentation.xml.rels', HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + presRels.join('') + '</Relationships>');
      z.file('ppt/slideMasters/slideMaster1.xml', HEAD + '<p:sldMaster ' + NS + '><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>' + GRP + '</p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>');
      z.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>');
      z.file('ppt/slideLayouts/slideLayout1.xml', HEAD + '<p:sldLayout ' + NS + ' preserve="1"><p:cSld name="Blank"><p:spTree>' + GRP + '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>');
      z.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>');
      var pal = ((th.palette || []).concat(['4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47'])).map(function (c) { return hex6(c, null); }).filter(Boolean);
      var sc = function (n, v) { return '<a:' + n + '><a:srgbClr val="' + v + '"/></a:' + n + '>'; };
      var fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>', ln = '<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>';
      z.file('ppt/theme/theme1.xml', HEAD + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="' + x(F.firm || 'Mothership') + '"><a:themeElements><a:clrScheme name="Brand">' +
        sc('dk1', textC) + sc('lt1', 'FFFFFF') + sc('dk2', '1E293B') + sc('lt2', 'F1F5F9') + [0, 1, 2, 3, 4, 5].map(function (i) { return sc('accent' + (i + 1), i === 0 ? primary : pal[i] || pal[0]); }).join('') + sc('hlink', primary) + sc('folHlink', '7C3AED') +
        '</a:clrScheme><a:fontScheme name="Brand"><a:majorFont><a:latin typeface="' + x(head || 'Calibri') + '"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="' + x(body || 'Calibri') + '"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
        '<a:fmtScheme name="Office"><a:fillStyleLst>' + fill + fill + fill + '</a:fillStyleLst><a:lnStyleLst>' + ln + ln + ln + '</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>' + fill + fill + fill + '</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>');
      return z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    });
  };
  // opts.from: 'tabs' | 'story'. Each page becomes a picture; if the browser can't draw the page, its charts are used instead.
  Dv.pptx = function (opts) {
    opts = opts || {};
    if (!MS.child) return Promise.reject(new Error('Nothing is open'));
    var pages = opts.from === 'story' ? Dv.storyPages() : Dv.pages();
    if (!pages.length) return Promise.reject(new Error(opts.from === 'story' ? 'The story has no steps yet.' : 'Nothing to export.'));
    var r = rt(), slides = [], chain = Promise.resolve();
    pages.forEach(function (p) {
      chain = chain.then(function () { p.show(); return wait(500); }).then(function () { if (r) { r.refresh(); if (r.renderAnnots) r.renderAnnots(); } return wait(250); }).then(function () {
        var root = p.root(); if (!root) return;
        var charts = r ? r.charts().filter(function (c) { return root.contains(c.el) && c.el.getBoundingClientRect().width; }) : [];
        return Dv.picture(staticClone(root).outerHTML).then(function (img) {
          if (img) return [img];
          return Promise.all(charts.map(function (c) { var b = c.el.getBoundingClientRect(); return r.chartImage(c.key).then(function (src) { return { src: src, w: b.width, h: b.height, name: (r.chartInfo(c.key) || {}).title || c.key }; }, function () { return null; }); }))
            .then(function (a) { return a.filter(Boolean); });
        }).then(function (imgs) { slides.push({ title: p.title, text: p.text || '', images: imgs }); });
      });
    });
    return chain.then(function () { return Dv.pptxFrom(slides); }).then(function (bytes) { return { bytes: bytes, slides: slides.length }; });
  };
  Dv.downloadPptx = function (opts) {
    var t = MS.toast('Making the PowerPoint…', '', 30000);
    return Dv.pptx(opts).then(function (res) {
      t.close();
      MS.download(MS.exportName(opts && opts.from === 'story' ? '-story' : '').replace(/\.html$/, '.pptx'), new Blob([res.bytes], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
      MS.audit && MS.audit.note('Exported PowerPoint (' + res.slides + ' slides)');
      MS.toast('PowerPoint ready: ' + res.slides + ' slide(s). Titles are editable; each tab is a picture.', 'ok', 7000);
      return res;
    }).catch(function (e) { t.close(); MS.toast(e.message, 'error'); throw e; });
  };
  Dv.menu = function (anchor) {
    var hasStory = MS.story && MS.story.steps().length;
    MS.menu(anchor, [
      { icon: '🖨', label: 'Print / Save as PDF (one page per tab)', run: function () { Dv.print(); } },
      { icon: '📊', label: 'PowerPoint (one slide per tab)', run: function () { Dv.downloadPptx(); } },
      hasStory ? { icon: '🎬', label: 'PowerPoint from the story (one slide per step)', run: function () { Dv.downloadPptx({ from: 'story' }); } } : null,
      hasStory ? { icon: '🖨', label: 'PDF from the story', run: function () { Dv.print({ from: 'story' }); } } : null,
      '-',
      { icon: '⬇', label: 'Download the print layout (.html)', run: function () { Dv.downloadPrint(); } }
    ].filter(Boolean));
  };
})(window.MS);
