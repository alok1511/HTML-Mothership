/* Accessibility check: pictures without alt text, text that is hard to read against its background,
   tables without headings, tabs that can't be reached with the keyboard, buttons and links with no
   name, and the page language. Each finding can be shown, and most can be fixed in one click. */
(function (MS) {
  'use strict';
  var A = MS.a11y = {}, h = MS.h;
  function cdoc() { return MS.child && MS.child.doc; }
  function skip(el) { return !!el.closest('[data-ms-editor],#ms-cmt-layer,.ms-modal-wrap,#ms-ribbon,.ms-crumbs,script,style,noscript,template'); }
  function visible(el) { var r = el.getBoundingClientRect(); return (r.width > 0 && r.height > 0) || el.closest('section.ms-tab,[hidden]') || (MS.pageTabs && MS.pageTabs.of(el)); }

  /* ---------- colour contrast (WCAG 2.1) */
  function rgba(s) { var m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; var p = m[1].split(',').map(function (x) { return parseFloat(x); }); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
  function lum(c) { var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
  A.ratio = function (a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // The colour behind an element: the first ancestor with a solid background (pictures behind text are not judged).
  function bgOf(el, w) {
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var cs = w.getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none' && !/gradient/.test(cs.backgroundImage)) return null;
      var c = rgba(cs.backgroundColor); if (c && c.a > 0.85) return c;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  A.check = function () {
    var d = cdoc(), w = MS.child.win, out = [], rt = MS.rt();
    if (!d) return out;
    var add = function (kind, el, msg, fix) { out.push({ kind: kind, el: el, msg: msg, fix: fix || null, ref: el && el.getAttribute ? (el.getAttribute('data-ms-id') || null) : null }); };
    if (!d.documentElement.getAttribute('lang')) add('lang', d.documentElement, 'The page has no language set, so screen readers may read it with the wrong voice.', 'lang');
    if (!(d.title || '').trim()) add('title', d.documentElement, 'The page has no title (shown in the browser tab and read first by screen readers).', 'title');
    MS.$$('img', d).forEach(function (im) {
      if (skip(im)) return;
      if (!im.hasAttribute('alt')) add('alt', im, 'A picture has no alt text' + (im.getAttribute('src') && !/^data:/.test(im.getAttribute('src')) ? ' (' + im.getAttribute('src').split('/').pop().slice(0, 40) + ')' : '') + '.', 'alt');
    });
    MS.$$('table', d).forEach(function (t) { if (skip(t)) return; if (!t.querySelector('th') && t.rows.length > 1) add('th', t, 'A table has no heading cells, so its columns are not announced.', 'th'); });
    MS.$$('button,a[href],[role=button]', d).forEach(function (b) {
      if (skip(b) || !visible(b)) return;
      var name = (b.textContent || '').trim() || b.getAttribute('aria-label') || b.getAttribute('title') || (b.querySelector('img[alt]') || {}).alt;
      if (!name) add('name', b, 'A ' + (b.tagName === 'A' ? 'link' : 'button') + ' has no text or label.', null);
    });
    var g = rt && rt.pageTabs && rt.pageTabs();
    if (g) g.tabs.forEach(function (t) { var b = t.btn; if (!/^(BUTTON|A|INPUT)$/.test(b.tagName) && !b.hasAttribute('tabindex')) add('keys', b, 'The tab “' + t.title + '” can only be opened with a mouse. (The exported file adds keyboard access automatically.)', null); });
    // text contrast: leaf text elements only, one finding per colour pair
    var seen = {}, n = 0;
    var walker = d.createTreeWalker(d.body, w.NodeFilter.SHOW_TEXT, null), tn;
    while ((tn = walker.nextNode()) && n < 4000) {
      n++;
      var el = tn.parentElement; if (!el || !tn.nodeValue.trim() || skip(el) || el.closest('svg')) continue;
      var r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      var cs = w.getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      var fg = rgba(cs.color), bg = bgOf(el, w); if (!fg || !bg) continue;
      var size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || bold && size >= 18.66, need = large ? 3 : 4.5;
      var ratio = A.ratio(fg, bg);
      if (ratio >= need) continue;
      var k = cs.color + '|' + bg.r + ',' + bg.g + ',' + bg.b + '|' + need;
      if (seen[k]) { if (seen[k].els.indexOf(el) < 0) { seen[k].els.push(el); seen[k].count++; } continue; }
      var f = { kind: 'contrast', el: el, els: [el], msg: 'Text is hard to read: contrast ' + ratio.toFixed(1) + ':1, needs ' + need + ':1 (“' + tn.nodeValue.trim().slice(0, 40) + '”).', fix: 'contrast', count: 1, ratio: ratio, need: need, bg: bg };
      seen[k] = f; out.push(f);
    }
    out.forEach(function (f) { if (f.count > 1) f.msg += ' Same colours in ' + (f.count - 1) + ' more place(s).'; });
    // chart colours that colour-blind readers can't tell apart
    if (MS.cvd && MS.rt()) MS.cvd.check().forEach(function (p) { var c = MS.rt().chart(p.chart); out.push({ kind: 'cvd', el: c ? c.el : null, msg: '“' + p.title + '”: ' + p.a + ' and ' + p.b + ' look alike to ' + p.who + ' readers.', fix: 'cvd', pair: p }); });
    return out;
  };

  // The darker (or lighter) version of the text colour that passes on that background.
  function fixColor(f, el) {
    var w = MS.child.win, c = rgba(w.getComputedStyle(el || f.el).color), dark = lum(f.bg) > 0.4, k;
    for (k = 0; k <= 20; k++) {
      var t = k / 20, x = { r: Math.round(c.r + ((dark ? 0 : 255) - c.r) * t), g: Math.round(c.g + ((dark ? 0 : 255) - c.g) * t), b: Math.round(c.b + ((dark ? 0 : 255) - c.b) * t) };
      if (A.ratio(x, f.bg) >= f.need + 0.1) return '#' + [x.r, x.g, x.b].map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
    }
    return dark ? '#000000' : '#ffffff';
  }
  A.fix = function (f) {
    var d = cdoc();
    switch (f.fix) {
      case 'lang': return MS.history.attrs('Page language', d.documentElement, ['lang'], function (x) { x.setAttribute('lang', MS.locale ? MS.locale.get().locale : 'en'); });
      case 'title': var t = (d.querySelector('h1') || {}).textContent || (MS.doc && MS.doc.name.replace(/\.html?$/i, '')) || 'Dashboard'; var old = d.title; d.title = t.trim(); return MS.history.push({ label: 'Page title', undo: function () { d.title = old; }, redo: function () { d.title = t.trim(); } }, true);
      case 'alt': return A.altDialog(f.el);
      case 'th': return MS.history.group('Table headings', function () {
        var row = f.el.rows[0]; Array.prototype.slice.call(row.cells).forEach(function (c) {
          var th = d.createElement('th'); th.innerHTML = c.innerHTML; Array.prototype.forEach.call(c.attributes, function (a) { th.setAttribute(a.name, a.value); });
          if (!th.hasAttribute('data-ms-id')) th.setAttribute('data-ms-own', '');
          MS.history.move('Heading cell', th, function () { row.insertBefore(th, c); }); MS.history.move('Heading cell', c, function () { c.remove(); });
        });
      });
      case 'contrast':
        // every place the finding counted, not just the first (the colours are worked out before any change)
        var els = (f.els || [f.el]).filter(function (x) { return x.isConnected; }), cols = els.map(function (x) { return fixColor(f, x); });
        return MS.history.group('Readable text colour', function () { els.forEach(function (x, i) { MS.edit.style(x, { color: cols[i] }, 'Readable text colour'); }); });
      case 'cvd': return MS.cvd.fix();
    }
  };

  /* ---------- alt text */
  A.setAlt = function (img, text, decorative) {
    MS.history.attrs('Alt text', img, ['alt', 'role'], function (x) { x.setAttribute('alt', decorative ? '' : String(text || '').trim()); if (decorative) x.setAttribute('role', 'presentation'); else x.removeAttribute('role'); });
  };
  A.altField = function (img) {
    var ta = h('textarea', { 'class': 'inp', rows: 2, placeholder: 'What the picture shows, in a sentence', value: img.getAttribute('alt') || '' });
    var dec = h('input', { type: 'checkbox', checked: img.getAttribute('alt') === '' && img.getAttribute('role') === 'presentation' });
    var save = function () { A.setAlt(img, ta.value, dec.checked); };
    ta.addEventListener('change', save); dec.addEventListener('change', function () { ta.disabled = dec.checked; save(); });
    ta.disabled = dec.checked;
    return h('div', {}, [ta, h('label', { 'class': 'field check' }, [dec, h('span', { text: 'Decorative (screen readers skip it)' })]),
      !img.hasAttribute('alt') ? h('small', { 'class': 'hint warn', text: 'No alt text yet: screen readers will read the file name.' }) : null]);
  };
  A.altDialog = function (img) {
    var ta = h('textarea', { 'class': 'inp', rows: 3, value: img.getAttribute('alt') || '', placeholder: 'e.g. Map of claims by state: Maharashtra and Gujarat are highest' });
    var prev = h('img', { src: img.getAttribute('src'), style: { maxWidth: '100%', maxHeight: '180px', borderRadius: '8px', display: 'block', margin: '0 auto 10px', border: '1px solid var(--line)' } });
    return MS.dialog({ title: '💬 Alt text', sub: 'A short description read aloud by screen readers, and shown if the picture can\'t load.', body: h('div', {}, [prev, h('label', { 'class': 'field' }, [h('span', { text: 'Describe the picture' }), ta])]),
      buttons: [{ label: 'Decorative', value: 'dec' }, { label: 'Cancel', value: null }, { label: 'Save', primary: true, value: function () { if (!ta.value.trim()) { MS.dialogError('Type a description, or choose Decorative if the picture adds nothing.'); return false; } return 'ok'; } }] }).then(function (v) {
      if (v === 'ok') A.setAlt(img, ta.value, false); else if (v === 'dec') A.setAlt(img, '', true);
      return v;
    });
  };

  /* ---------- colour-blind readers: which chart colours clash, and a preview */
  A.cvdDialog = function () {
    if (!MS.rt()) return MS.toast('Turn off Safe mode first.', 'warn');
    var body = h('div');
    function draw() {
      var list = MS.cvd.check(); body.innerHTML = '';
      body.appendChild(h('div', { 'class': 'row gap wrap' }, [h('span', { 'class': 'muted small', text: 'See it as:' })].concat([['', 'Normal'], ['deutan', 'Green-blind'], ['protan', 'Red-blind'], ['tritan', 'Blue-blind']].map(function (k) {
        return h('button', { 'class': 'btn sm' + ((MS.cvd.previewing || '') === k[0] ? ' primary' : ''), onclick: function () { MS.cvd.preview(k[0]); draw(); } }, [k[1]]);
      }))));
      if (!list.length) body.appendChild(h('div', { 'class': 'empty-ok' }, [h('strong', { text: '✅ Every chart\'s colours can be told apart.' }), h('p', { 'class': 'muted', text: 'Checked for red-, green- and blue-blind readers (about 1 in 12 men).' })]));
      else {
        body.appendChild(h('p', { 'class': 'muted', text: list.length + ' pair(s) of colours look alike to some readers. A colour-blind safe palette (Okabe–Ito) fixes all of them.' }));
        body.appendChild(h('div', { 'class': 'list' }, list.map(function (p) {
          return h('div', { 'class': 'list-row' }, [h('span', { 'class': 'swatches mini' }, p.colors.map(function (c) { return h('i', { style: { background: c } }); })), h('span', { 'class': 'grow', text: '“' + p.title + '”: ' + p.a + ' and ' + p.b + ' (' + p.who + ')' })]);
        })));
      }
    }
    draw();
    MS.dialog({ title: '👁 Colour-blind check', sub: 'Chart colours should differ in lightness as well as hue. The preview changes only your view; nothing is saved.', wide: true, enterSubmits: false, body: body,
      buttons: [{ label: 'Close', value: null }, { label: 'Use a colour-blind safe palette', primary: true, value: 'fix' }] }).then(function (v) {
      MS.cvd.preview(null);
      if (v === 'fix' && MS.cvd.fix()) MS.toast('Charts now use the colour-blind safe palette (Ctrl+Z to undo).', 'ok');
    });
  };

  /* ---------- the report */
  var LABEL = { cvd: 'Chart colours (colour-blind readers)', alt: 'Pictures', contrast: 'Text contrast', th: 'Tables', name: 'Buttons and links', keys: 'Keyboard', lang: 'Page', title: 'Page' };
  A.dialog = function () {
    if (!MS.child) return MS.toast('Open a dashboard first.', 'warn');
    var body = h('div'), close;
    function draw() {
      var list = A.check(); body.innerHTML = '';
      if (!list.length) { body.appendChild(h('div', { 'class': 'empty-ok' }, [h('strong', { text: '✅ No problems found.' }), h('p', { 'class': 'muted', text: 'Pictures have alt text, text is readable, tables have headings, and the page has a language and a title.' })])); return; }
      var fixable = list.filter(function (f) { return f.fix && f.fix !== 'alt'; });
      body.appendChild(h('div', { 'class': 'row gap' }, [h('span', { 'class': 'grow muted', text: list.length + ' thing(s) to look at.' }),
        fixable.length ? h('button', { 'class': 'btn sm primary', onclick: function () { MS.history.group('Accessibility fixes', function () { fixable.forEach(A.fix); }); setTimeout(draw, 120); } }, ['Fix ' + fixable.length + ' automatically']) : null]));
      var groups = {};
      list.forEach(function (f) { (groups[LABEL[f.kind]] = groups[LABEL[f.kind]] || []).push(f); });
      Object.keys(groups).forEach(function (gname) {
        body.appendChild(h('div', { 'class': 'ol-head', text: gname + ' (' + groups[gname].length + ')' }));
        body.appendChild(h('div', { 'class': 'list' }, groups[gname].map(function (f) {
          return h('div', { 'class': 'list-row' }, [h('span', { 'class': 'grow', text: f.msg }),
            f.el && f.el !== cdoc().documentElement ? h('button', { 'class': 'btn sm', onclick: function () { close(); MS.edit.reveal(f.el, true); } }, ['Show']) : null,
            f.fix ? h('button', { 'class': 'btn sm', onclick: function () { var r = A.fix(f); if (r && r.then) r.then(function () { setTimeout(draw, 80); }); else setTimeout(draw, 120); } }, [f.fix === 'alt' ? 'Add alt text…' : 'Fix']) : null]);
        })));
      });
    }
    draw();
    MS.dialog({ title: '♿ Accessibility check', sub: 'So everyone can read the dashboard, including with a screen reader or the keyboard.', wide: true, enterSubmits: false, body: body, buttons: [{ label: 'Close', value: null }] });
    close = function () { var w = MS.$$('.dlg-wrap').pop(); if (w) w.querySelector('.dlg-foot .btn').click(); };
  };
})(window.MS);
