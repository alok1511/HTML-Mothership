/* Brand guidelines: load from a skill file (SKILL.md / .skill zip / theme JSON),
   edit the theme, and check the dashboard against it. */
(function (MS) {
  'use strict';
  var Br = MS.brand = {};

  /* ---------------------------------------------------------- colour utils */
  function hexToRgb(h) {
    h = String(h).trim();
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(h);
    if (m) { var x = m[1]; if (x.length === 3) x = x.replace(/./g, '$&$&'); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; }
    m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?/i.exec(h);
    if (m) { if (m[4] !== undefined && parseFloat(m[4]) === 0) return null; return [+m[1], +m[2], +m[3]]; }
    return null;
  }
  function toHex(rgb) { return '#' + rgb.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''); }
  function dist(a, b) { var r = (a[0] + b[0]) / 2, dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2]; return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db) / 3; }
  function lum(rgb) { var c = rgb.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  Br.hexToRgb = hexToRgb; Br.toHex = toHex; Br.contrast = contrast;

  /* ---------------------------------------------------------- parsing */
  var ROLE_WORDS = [
    ['primary', /\b(primary|brand colou?r|main colou?r|core colou?r|hero)\b/i],
    ['secondary', /\bsecondary\b/i],
    ['accent', /\b(accent|highlight|call.to.action|cta)\b/i],
    ['background', /\b(background|page bg|canvas|backdrop)\b/i],
    ['surface', /\b(surface|card|panel|tile)\b/i],
    ['text', /\b(text|body copy|foreground|ink|font colou?r)\b/i],
    ['muted', /\b(muted|subtle|caption|grey|gray|neutral|secondary text)\b/i],
    ['border', /\b(border|divider|rule|stroke|gridline)\b/i],
    ['ribbonBg', /\b(nav(igation)?|header|ribbon|top ?bar)\b.*\b(bg|background|fill)\b/i]
  ];
  var COLOR_RE = /#(?:[0-9a-f]{6}|[0-9a-f]{3})\b|rgba?\([^)]+\)/ig;

  Br.parseMarkdown = function (md, name) {
    var t = { name: name || 'Brand', colors: {}, palette: [], fonts: {}, source: name };
    var fm = /^---\s*\n([\s\S]*?)\n---/.exec(md);
    if (fm) { var n = /^name:\s*(.+)$/m.exec(fm[1]); if (n) t.name = n[1].trim().replace(/^["']|["']$/g, ''); }
    // 1. an explicit JSON block wins
    var jre = /```(?:json|mothership-theme)\s*\n([\s\S]*?)```/g, m;
    while ((m = jre.exec(md))) {
      try { var j = JSON.parse(m[1]); if (j.colors || j.palette || j.fonts) return Br.normalize(Object.assign({ name: t.name }, j), name); } catch (e) {}
    }
    // 2. CSS custom properties
    var cssVars = md.match(/--[\w-]+\s*:\s*(#[0-9a-f]{3,6}|rgba?\([^)]+\))/ig) || [];
    cssVars.forEach(function (line) { assign(t, line.split(':')[0], line.split(':').slice(1).join(':').trim()); });
    // 3. labelled colours, line by line
    var lines = md.split(/\n/);
    lines.forEach(function (line) {
      var colors = line.match(COLOR_RE);
      if (!colors) return;
      var label = line.replace(COLOR_RE, ' ').replace(/[*_`|>#-]/g, ' ');
      if (/\b(chart|palette|data.?vi[sz]|series|categorical)\b/i.test(label) && colors.length > 1) { colors.forEach(function (c) { t.palette.push(norm(c)); }); return; }
      if (colors.length === 1) assign(t, label, colors[0]);
      else if (/\|/.test(line)) { // table row: | Primary | #123456 | ...
        assign(t, label, colors[0]);
      }
    });
    // 4. fonts
    lines.forEach(function (line) {
      if (!/font|typeface|typography|type ?face|heading|body/i.test(line)) return;
      var clean = line.replace(/[*_`>#]/g, '').replace(/^\s*[-•]\s*/, '');
      var mm = /:\s*["']?([A-Z][\w' -]{1,40}?)["']?\s*(?:[,;(|]|\s-\s|$)/.exec(clean);
      if (!mm || /^(none|n\/a|the|use|for|bold|regular|light)$/i.test(mm[1].trim())) return;
      var fam = mm[1].trim();
      if (/#|\d{2,}px/.test(fam)) return;
      var stack = quote(fam) + (/serif/i.test(fam) && !/sans/i.test(fam) ? ', Georgia, serif' : ', "Segoe UI", Arial, sans-serif');
      if (/head|title|display|headline|h1/i.test(clean.split(':')[0])) t.fonts.heading = t.fonts.heading || stack;
      else if (/body|text|paragraph|copy|ui|primary font|base/i.test(clean.split(':')[0])) t.fonts.body = t.fonts.body || stack;
      else if (/font|typeface/i.test(clean.split(':')[0])) { t.fonts.body = t.fonts.body || stack; t.fonts.heading = t.fonts.heading || stack; }
    });
    // palette fallback: every non-neutral colour mentioned, in order
    if (!t.palette.length) {
      var all = (md.match(COLOR_RE) || []).map(norm);
      var neutral = [t.colors.background, t.colors.text, t.colors.muted, t.colors.border, t.colors.surface].filter(Boolean);
      all.forEach(function (c) {
        var rgb = hexToRgb(c); if (!rgb) return;
        var l = lum(rgb), sat = Math.max.apply(null, rgb) - Math.min.apply(null, rgb);
        if (neutral.indexOf(c) >= 0 || l > 0.85 || l < 0.02 || sat < 25) return;
        if (t.palette.indexOf(c) < 0) t.palette.push(c);
      });
    }
    if (!t.colors.primary && t.palette[0]) t.colors.primary = t.palette[0];
    return Br.normalize(t, name);
  };
  function quote(f) { return /\s/.test(f) ? '"' + f + '"' : f; }
  function norm(c) { var rgb = hexToRgb(c); return rgb ? toHex(rgb) : c; }
  function assign(t, label, color) {
    for (var i = 0; i < ROLE_WORDS.length; i++) {
      if (ROLE_WORDS[i][1].test(label) && !t.colors[ROLE_WORDS[i][0]]) { t.colors[ROLE_WORDS[i][0]] = norm(color); return; }
    }
  }

  Br.normalize = function (j, source) {
    var t = {
      name: j.name || 'Brand', source: source || j.source || '',
      colors: Object.assign({}, j.colors || {}),
      palette: (j.palette || (j.chart && j.chart.palette) || []).map(norm),
      fonts: Object.assign({}, j.fonts || {}),
      fontFiles: j.fontFiles || [],
      logo: j.logo || null,
      applyToPage: j.applyToPage !== false,
      force: !!j.force,
      chartsFollowTheme: j.chartsFollowTheme !== false,
      forceFonts: !!j.forceFonts,
      css: j.css || ''
    };
    if (j.map) t.map = j.map;
    if (j.sources) t.sources = j.sources;
    Object.keys(t.colors).forEach(function (k) { t.colors[k] = norm(t.colors[k]); });
    if (!t.palette.length) t.palette = [t.colors.primary, t.colors.secondary, t.colors.accent].filter(Boolean);
    return t;
  };

  // direct: apply at once (assistant / API); otherwise show what will change first
  Br.loadFile = function (file, direct) {
    var ext = MS.ext(file.name), go = direct ? Br.apply : Br.preview;
    if (ext === 'json') return MS.readFile(file).then(function (s) { return go(Br.normalize(JSON.parse(s), file.name)); });
    if (ext === 'md' || ext === 'markdown' || ext === 'txt') return MS.readFile(file).then(function (s) { return go(Br.parseMarkdown(s, file.name)); });
    if (ext === 'skill' || ext === 'zip' || ext === 'skills') return MS.readFile(file, 'buffer').then(function (buf) { return Br.fromZip(buf, file.name); }).then(go);
    if (/^(woff2?|ttf|otf)$/.test(ext)) return Br.addFontFiles([file]);
    MS.toast('Unsupported brand file: ' + file.name, 'error');
  };
  Br.fromZip = function (buf, name) {
    return MS.lib('jszip').then(function (J) { return J.loadAsync(buf); }).then(function (zip) {
      var files = Object.keys(zip.files).filter(function (p) { return !zip.files[p].dir && p.indexOf('__MACOSX') < 0; });
      files.sort();
      var texts = files.filter(function (p) { return /\.(md|markdown|txt|css|scss|json)$/i.test(p) && !/package(-lock)?\.json$/i.test(p); });
      texts.sort(function (a, b) { var sa = /(^|\/)SKILL\.md$/i.test(a) ? 0 : /\.md$/i.test(a) ? 1 : 2, sb = /(^|\/)SKILL\.md$/i.test(b) ? 0 : /\.md$/i.test(b) ? 1 : 2; return sa - sb || (a < b ? -1 : 1); });
      var json = files.filter(function (p) { return /(theme|brand|tokens?)[^/]*\.json$/i.test(p); })[0];
      var fonts = files.filter(function (p) { return /\.(woff2?|ttf|otf)$/i.test(p); });
      var logo = files.filter(function (p) { return /(^|\/)logo[^/]*\.(png|svg|jpe?g|webp)$/i.test(p); })[0];
      return Promise.all([
        Promise.all(texts.map(function (p) { return zip.file(p).async('string').then(function (s) { return { p: p, s: s }; }); })).then(function (all) {
          var j = null;
          if (json) { try { var js = JSON.parse(all.filter(function (x) { return x.p === json; })[0].s); if (js.colors || js.palette || js.fonts) j = Br.normalize(js, name); } catch (e) {} }
          if (j) return j;
          // one document: the skill first, then the other guides and style sheets (CSS variables count as colour roles)
          var md = all.map(function (x) { return /\.(css|scss)$/i.test(x.p) ? '```css\n' + x.s + '\n```' : /\.json$/i.test(x.p) ? '' : x.s; }).join('\n\n');
          var t = Br.parseMarkdown(md, name);
          t.sources = all.map(function (x) { return x.p; });
          return t;
        }),
        Promise.all(fonts.map(function (p) { return zip.file(p).async('base64').then(function (b) { return fontEntry(p, b); }); })),
        logo ? zip.file(logo).async('base64').then(function (b) { return 'data:' + mime(logo) + ';base64,' + b; }) : null
      ]).then(function (r) {
        var t = r[0];
        t.fontFiles = t.fontFiles.concat(r[1]);
        if (r[2]) t.logo = r[2];
        if (r[1].length && !t.fonts.body) t.fonts.body = quote(r[1][0].family) + ', "Segoe UI", Arial, sans-serif';
        return t;
      });
    });
  };
  function mime(p) { var e = MS.ext(p); return { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' }[e] || 'application/octet-stream'; }
  function fontEntry(path, b64) {
    var base = path.split('/').pop().replace(/\.[^.]+$/, '');
    var weight = /black|heavy/i.test(base) ? 900 : /extrabold/i.test(base) ? 800 : /semibold|demi/i.test(base) ? 600 : /bold/i.test(base) ? 700 : /medium/i.test(base) ? 500 : /extralight|thin/i.test(base) ? 200 : /light/i.test(base) ? 300 : 400;
    var family = base.replace(/[-_ ]?(regular|bold|semibold|demibold|medium|light|extralight|thin|black|heavy|extrabold|italic|oblique|variable|vf|\[.*\])+$/ig, '').replace(/[-_]/g, ' ').trim() || base;
    return { family: family, weight: weight, style: /italic|oblique/i.test(base) ? 'italic' : 'normal', data: 'data:' + mime(path) + ';base64,' + b64 };
  }
  Br.addFontFiles = function (files) {
    return Promise.all(files.map(function (f) { return MS.readFile(f, 'dataurl').then(function (d) { return fontEntry(f.name, d.split(',')[1]); }); })).then(function (entries) {
      MS.history.state('Add brand fonts', function (s) {
        s.theme = s.theme || Br.normalize({ name: 'Custom' });
        s.theme.fontFiles = (s.theme.fontFiles || []).concat(entries);
      });
      MS.toast('Added font(s): ' + entries.map(function (e) { return e.family; }).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(', ') + '. Choose them in Design › Edit theme or Home › Font.', 'ok', 6000);
      MS.emit('fonts');
    });
  };

  Br.apply = function (theme) {
    if (!MS.rt()) { MS.toast('Open a dashboard first (scripts must be on).', 'warn'); return; }
    if (theme.map === undefined && theme.applyToPage !== false) { var plan = Br.plan(theme); theme.map = plan.map; if (plan.fontsElsewhere && theme.forceFonts === false) theme.forceFonts = true; }
    MS.history.state('Apply brand "' + theme.name + '"', function (s) { s.theme = theme; });
    Br.remember(theme);
    var c = Object.keys(theme.colors).length, p = theme.palette.length, f = Object.keys(theme.fonts).length;
    MS.toast('Brand "' + theme.name + '" applied: ' + c + ' colour roles, ' + p + ' chart colours, ' + f + ' font(s). Review it in Design › Edit theme.', 'ok', 6000);
    MS.emit('theme');
  };
  Br.remember = function (theme) {
    MS.store.get('kv', 'brands').then(function (list) {
      list = (list || []).filter(function (b) { return b.name !== theme.name; });
      list.unshift(theme); MS.store.set('kv', 'brands', list.slice(0, 12));
    }).catch(function () {});
  };
  Br.library = function () {
    return MS.store.get('kv', 'brands').then(function (list) {
      list = list || [];
      if (!list.length) return MS.toast('No saved brands yet. Load a skill file first.');
      var body = MS.h('div', { 'class': 'list' }, list.map(function (b, i) {
        return MS.h('div', { 'class': 'list-row' }, [
          MS.h('div', { 'class': 'swatches' }, b.palette.slice(0, 8).map(function (c) { return MS.h('i', { style: { background: c } }); })),
          MS.h('strong', { text: b.name }),
          MS.h('button', { 'class': 'btn sm', onclick: function () { Br.apply(b); MS.$('.dlg-wrap').remove(); } }, ['Apply'])
        ]);
      }));
      MS.dialog({ title: 'Brand library (saved in this browser)', body: body, buttons: [{ label: 'Close', value: null }] });
    });
  };

  /* ---------------------------------------------------------- what the dashboard uses now, and how the brand maps onto it */
  // Every colour the page's own CSS and inline styles use, with how much it is used for text, fills and borders.
  Br.pageColors = function () {
    var c = MS.child, rt = MS.rt(); if (!c || !rt) return { colors: [], fontsElsewhere: false };
    var d = c.doc, w = c.win, acc = {}, fontsElsewhere = false;
    var KIND = { color: 'text', 'background-color': 'fill', 'background-image': 'fill', fill: 'fill', 'border-top-color': 'border', 'border-right-color': 'border', 'border-bottom-color': 'border', 'border-left-color': 'border', 'outline-color': 'border', stroke: 'border' };
    var STATUS = /(^|[\s._#-])(up|down|pos|neg|positive|negative|good|bad|success|danger|error|warn|warning|alert|ok|risk|red|green|amber|gain|loss|delta|trend)([\s._#:-]|$)/i;
    function add(v, kind, n, sel) {
      String(v).replace(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\)/ig, function (x) {
        var hx = rt.colHex(x); if (!hx || /rgba?\([^)]*[,/]\s*0(\.0+)?\s*\)$/.test(x)) return x;
        var a = acc[hx] = acc[hx] || { hex: hx, text: 0, fill: 0, border: 0, n: 0, status: 0, where: [] };
        a[kind] += n; a.n += n;
        if (sel && STATUS.test(sel)) a.status += n;
        if (sel && a.where.length < 4 && a.where.indexOf(sel) < 0) a.where.push(sel);
        return x;
      });
    }
    rt.eachRule(function (r) {
      var sel = r.selectorText || '', clean = sel.replace(/::?(before|after|hover|focus|focus-within|focus-visible|active|visited|placeholder|first-line|first-letter|selection|marker|-webkit-[\w-]+)(\([^)]*\))?/g, '');
      var n = 0; try { n = Math.min(40, d.querySelectorAll(clean || '*').length); } catch (e) { n = 0; }
      if (!n && /:root|^html|^body/.test(sel)) n = 1;
      if (!n) n = 0.25; // states like :hover still count a little
      for (var j = 0; j < r.style.length; j++) {
        var p = r.style[j], v = r.style.getPropertyValue(p);
        if (p === 'font-family' && !/^(html|body|:root|\*)$/i.test(sel.trim())) fontsElsewhere = true;
        if (p.indexOf('--') === 0) { if (/#[0-9a-f]{3,6}\b|rgba?\(/i.test(v)) add(v, /text|ink|fg|font/i.test(p) ? 'text' : /border|line|rule|grid/i.test(p) ? 'border' : 'fill', 3, p); continue; }
        if (KIND[p]) add(v, KIND[p], n, sel);
      }
    });
    MS.$$('[style]', d).forEach(function (e) {
      if (e.closest('[data-ms-editor],#ms-ribbon,#ms-filter-pane') || e.tagName === 'CANVAS') return;
      var saved = {}; try { saved = JSON.parse(e.getAttribute('data-ms-colmap') || '{}'); } catch (x) {}
      for (var j = 0; j < e.style.length; j++) { var p = e.style[j]; if (KIND[p]) add(saved[p] ? saved[p].from : e.style.getPropertyValue(p), KIND[p], 1, e.className && typeof e.className === 'string' ? '.' + e.className.split(/\s+/)[0] : e.tagName.toLowerCase()); }
    });
    var bodyBg = rt.colHex(w.getComputedStyle(d.body).backgroundColor) || rt.colHex(w.getComputedStyle(d.documentElement).backgroundColor) || '#ffffff';
    if (acc[bodyBg]) acc[bodyBg].page = true;
    var list = Object.keys(acc).map(function (k) { return acc[k]; }).filter(function (a) { return a.n >= 0.5 || a.page; });
    list.sort(function (a, b) { return b.n - a.n || (a.hex < b.hex ? -1 : 1); });
    return { colors: list, bodyBg: bodyBg, fontsElsewhere: fontsElsewhere };
  };
  function sat(rgb) { return Math.max.apply(null, rgb) - Math.min.apply(null, rgb); }
  function kindOf(a) { return a.fill >= a.text && a.fill >= a.border ? 'fill' : a.text >= a.border ? 'text' : 'border'; }
  function usesOf(a) { return ['text', 'fill', 'border'].filter(function (k) { return a[k] >= 0.5; }).map(function (k) { return { text: 'text', fill: 'backgrounds', border: 'borders' }[k]; }).join(', '); }
  // A plan that is the same for the same page and the same brand: page colour → brand role.
  Br.plan = function (theme) {
    var pc = Br.pageColors(), c = theme.colors || {}, map = [];
    var targets = [['primary', c.primary], ['secondary', c.secondary], ['accent', c.accent]].filter(function (x) { return x[1]; });
    (theme.palette || []).forEach(function (p, i) { if (!targets.some(function (t) { return t[1] === p; })) targets.push(['chart colour ' + (i + 1), p]); });
    var families = [];
    pc.colors.forEach(function (a) {
      var rgb = hexToRgb(a.hex), l = lum(rgb), chroma = sat(rgb) >= 40 && l > 0.01 && l < 0.92;
      var e = { from: a.hex, uses: usesOf(a), where: a.where.slice(0, 3), n: Math.round(a.n), on: true };
      if (chroma) {
        if (a.status > a.n / 2) { e.role = 'status colour (kept)'; e.to = a.hex; e.on = false; map.push(e); return; }
        // shades of one colour go to the same brand colour
        var fam = families.filter(function (f) { return dist(hexToRgb(f.hex), rgb) < 32; })[0];
        if (!fam) { fam = { hex: a.hex, t: targets[families.length] }; families.push(fam); }
        if (!fam.t) { e.role = 'no brand colour left'; e.to = a.hex; e.on = false; } else { e.role = fam.t[0]; e.to = fam.t[1]; }
        map.push(e); return;
      }
      var k = kindOf(a), role = null;
      if (a.hex === pc.bodyBg || (a.page)) role = 'background';
      else if (l > 0.8) role = k === 'border' ? 'border' : k === 'text' ? null : 'surface';
      else if (l < 0.12) role = k === 'fill' ? (c.ribbonBg ? 'ribbonBg' : null) : 'text';
      else role = k === 'border' ? 'border' : k === 'text' ? 'muted' : null;
      if (role && c[role] && c[role].toLowerCase() !== a.hex) { e.role = role; e.to = c[role]; map.push(e); }
    });
    return { map: map.filter(function (x) { return x.to && x.to.toLowerCase() !== x.from; }).concat(map.filter(function (x) { return !x.on && x.to === x.from; })), fontsElsewhere: pc.fontsElsewhere, colors: pc.colors };
  };

  // Show what the brand will change on this dashboard, live, before applying it.
  Br.preview = function (theme) {
    var rt = MS.rt(); if (!rt) { MS.toast('Open a dashboard first (scripts must be on).', 'warn'); return; }
    var plan = Br.plan(theme), t = JSON.parse(JSON.stringify(theme)), start = JSON.stringify(rt.state);
    t.map = plan.map; if (theme.forceFonts === undefined || !theme.forceFonts) t.forceFonts = plan.fontsElsewhere && !!(t.fonts.body || t.fonts.heading);
    var h = MS.h, ROLES = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted', 'border', 'ribbonBg'].filter(function (r) { return t.colors[r]; });
    var options = ROLES.map(function (r) { return { v: t.colors[r], l: r + ' ' + t.colors[r] }; }).concat((t.palette || []).map(function (p, i) { return { v: p, l: 'chart colour ' + (i + 1) + ' ' + p }; })).filter(function (o, i, a) { return a.map(function (x) { return x.v; }).indexOf(o.v) === i; });
    var live = MS.debounce(function () { rt.state.theme = JSON.parse(JSON.stringify(t)); rt.refresh(true); }, 80);
    var rows = t.map.map(function (m) {
      var cb = h('input', { type: 'checkbox', checked: m.on !== false });
      var to = h('select', { 'class': 'inp' }, (m.on === false && m.to === m.from ? [{ v: m.from, l: 'keep ' + m.from }] : []).concat(options).map(function (o) { return h('option', { value: o.v, text: o.l, selected: o.v === m.to }); }));
      var toSw = h('i', { 'class': 'sw', style: { background: m.to } });
      cb.addEventListener('change', function () { m.on = cb.checked; live(); });
      to.addEventListener('change', function () { m.to = to.value; m.on = true; cb.checked = true; toSw.style.background = to.value; live(); });
      return h('label', { 'class': 'map-row' }, [cb, h('i', { 'class': 'sw', style: { background: m.from }, title: m.from }), h('span', { 'class': 'arrow', text: '→' }), toSw, to,
        h('small', { 'class': 'muted grow', text: (m.uses || '') + (m.where && m.where.length ? ' · ' + m.where.join(', ') : '') + (m.role && /kept|left/.test(m.role) ? ' · ' + m.role : '') })]);
    });
    var opt = function (label, key, hint) { var cb = h('input', { type: 'checkbox', checked: !!t[key] }); cb.addEventListener('change', function () { t[key] = cb.checked; live(); }); return h('label', { 'class': 'opt-check', title: hint || '' }, [cb, ' ' + label]); };
    var fonts = [t.fonts.heading && 'Headings: ' + t.fonts.heading.split(',')[0].replace(/"/g, ''), t.fonts.body && 'Text: ' + t.fonts.body.split(',')[0].replace(/"/g, '')].filter(Boolean).join(' · ');
    var body = h('div', { 'class': 'brand-preview' }, [
      h('div', { 'class': 'row gap' }, [h('div', { 'class': 'swatches big' }, ROLES.map(function (r) { return h('i', { style: { background: t.colors[r] }, title: r + ' ' + t.colors[r] }); }).concat((t.palette || []).map(function (p) { return h('i', { style: { background: p }, title: p }); }))),
        h('small', { 'class': 'muted', text: fonts || 'No fonts in this brand' })]),
      t.sources && t.sources.length ? h('small', { 'class': 'muted', text: 'Read from: ' + t.sources.join(', ') }) : null,
      h('h4', { text: 'Colours on this dashboard (' + rows.length + ')' }),
      h('p', { 'class': 'muted small', text: 'Each colour the dashboard uses is matched to a brand colour by what it is used for: the main colour and its shades → primary, light backgrounds → background / card, dark text → text, lines → border. The same brand and dashboard always give the same result. Untick anything you want to keep; the dashboard behind updates as you go.' }),
      rows.length ? h('div', { 'class': 'map-list' }, rows) : h('p', { 'class': 'muted', text: 'Nothing to swap: the dashboard\'s colours already match, or it has none of its own.' }),
      h('h4', { text: 'Also' }),
      opt('Recolour the charts with the brand palette', 'chartsFollowTheme'),
      opt('Use the brand fonts everywhere (overrides fonts the dashboard sets on its own parts)', 'forceFonts', 'Icons and code keep their fonts'),
      opt('Apply page background, text colour and fonts', 'applyToPage')
    ]);
    live();
    return MS.dialog({ title: 'Apply brand “' + t.name + '”', wide: true, enterSubmits: false, body: body, buttons: [{ label: 'Cancel', value: null }, { label: 'Apply brand', primary: true, value: 'ok' }] }).then(function (v) {
      rt.setState(JSON.parse(start)); rt.refresh(true);
      if (v !== 'ok') return false;
      t.map = t.map.filter(function (m) { return m.on !== false && m.to !== m.from; }).map(function (m) { return { from: m.from, to: m.to, role: m.role }; });
      Br.apply(t); return true;
    });
  };

  /* ---------------------------------------------------------- theme editor */
  Br.edit = function () {
    var rt = MS.rt(); if (!rt) return MS.toast('Open a dashboard first.', 'warn');
    var t = rt.state.theme ? JSON.parse(JSON.stringify(rt.state.theme)) : Br.normalize({ name: 'Custom', colors: { primary: '#2563eb' } });
    var roles = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'muted', 'border', 'ribbonBg', 'ribbonText', 'paneBg'];
    var labels = { ribbonBg: 'Ribbon background', ribbonText: 'Ribbon text', paneBg: 'Filter pane background' };
    var grid = MS.h('div', { 'class': 'color-grid' });
    roles.forEach(function (r) {
      var on = MS.h('input', { type: 'checkbox', checked: !!t.colors[r], title: 'Use this colour' });
      var c = MS.h('input', { type: 'color', value: t.colors[r] || '#888888' });
      c.addEventListener('input', function () { on.checked = true; live(); });
      on.addEventListener('change', live);
      c.dataset.role = r; on.dataset.role = r;
      grid.appendChild(MS.h('label', { 'class': 'color-field' }, [on, c, MS.h('span', { text: labels[r] || r.charAt(0).toUpperCase() + r.slice(1) })]));
    });
    var fontsList = MS.fonts.list(t);
    var f = MS.form([
      { key: 'name', label: 'Theme name', value: t.name },
      { key: 'palette', label: 'Chart palette (comma-separated, in order)', value: t.palette.join(', '), hint: 'Charts use these colours in this order.' },
      { key: 'heading', label: 'Heading font', value: t.fonts.heading || '', type: 'text', placeholder: '"Inter", sans-serif' },
      { key: 'body', label: 'Body font', value: t.fonts.body || '', type: 'text', placeholder: '"Inter", sans-serif', hint: 'Available: ' + fontsList.slice(0, 12).map(MS.esc).join(', ') },
      { key: 'applyToPage', label: 'Apply colours & fonts to the page', type: 'checkbox', value: t.applyToPage },
      { key: 'force', label: 'Force brand fonts/colours on every element (overrides the dashboard\'s own CSS)', type: 'checkbox', value: t.force },
      { key: 'chartsFollowTheme', label: 'Recolour charts with the palette', type: 'checkbox', value: t.chartsFollowTheme },
      { key: 'css', label: 'Extra CSS (advanced)', type: 'textarea', value: t.css, rows: 3 }
    ], function () { live(); });
    var sw = MS.h('div', { 'class': 'swatches big' });
    var logoBtn = MS.h('button', { 'class': 'btn sm', onclick: function () {
      MS.pickFiles('image/*').then(function (fs) { if (fs[0]) MS.readFile(fs[0], 'dataurl').then(function (d) { t.logo = d; live(); MS.toast('Logo set. It appears in the dashboard ribbon.', 'ok'); }); });
    } }, ['Set logo…']);
    var noLogo = MS.h('button', { 'class': 'btn sm', onclick: function () { t.logo = null; live(); } }, ['Remove logo']);
    var fontBtn = MS.h('button', { 'class': 'btn sm', onclick: function () { MS.pickFiles('.woff,.woff2,.ttf,.otf', { multiple: true }).then(function (fs) { if (fs.length) Br.addFontFiles(fs); }); } }, ['Upload font files…']);
    var body = MS.h('div', { 'class': 'theme-editor' }, [MS.h('h4', { text: 'Colour roles' }), grid, MS.h('h4', { text: 'Chart palette preview' }), sw, f, MS.h('div', { 'class': 'row gap' }, [logoBtn, noLogo, fontBtn])]);
    var start = JSON.stringify(rt.state);
    function collect() {
      var v = f.values();
      t.name = v.name || 'Custom';
      t.palette = v.palette.split(/[,\s]+/).map(function (x) { return x.trim(); }).filter(function (x) { return hexToRgb(x); }).map(norm);
      t.fonts = {}; if (v.heading) t.fonts.heading = v.heading; if (v.body) t.fonts.body = v.body;
      t.applyToPage = v.applyToPage; t.force = v.force; t.chartsFollowTheme = v.chartsFollowTheme; t.css = v.css;
      t.colors = {};
      MS.$$('input[type=color]', grid).forEach(function (c) { var on = grid.querySelector('input[type=checkbox][data-role="' + c.dataset.role + '"]'); if (on.checked) t.colors[c.dataset.role] = c.value; });
      return t;
    }
    var live = MS.debounce(function () {
      collect();
      sw.innerHTML = ''; t.palette.forEach(function (c) { sw.appendChild(MS.h('i', { style: { background: c }, title: c })); });
      var s = MS.rt().state; s.theme = JSON.parse(JSON.stringify(t)); MS.rt().refresh(true);
    }, 120);
    live();
    MS.dialog({ title: 'Edit theme', body: body, wide: true, enterSubmits: false, buttons: [
      { label: 'Remove theme', value: 'remove', danger: true }, { label: 'Export theme JSON', value: 'export' }, { label: 'Cancel', value: null }, { label: 'Apply', primary: true, value: 'apply' }] }).then(function (v) {
      var r = MS.rt(); var end;
      if (v === 'apply' || v === 'export') { collect(); r.state.theme = JSON.parse(JSON.stringify(t)); }
      if (v === 'remove') delete r.state.theme;
      if (!v) { r.setState(JSON.parse(start)); return; }
      end = JSON.stringify(r.state);
      r.refresh(true);
      if (end !== start) MS.history.push({ label: v === 'remove' ? 'Remove theme' : 'Edit theme', undo: function () { MS.rt().setState(JSON.parse(start)); }, redo: function () { MS.rt().setState(JSON.parse(end)); } }, true);
      if (v === 'export') MS.download((t.name || 'theme').replace(/\W+/g, '-').toLowerCase() + '.theme.json', JSON.stringify(Object.assign({ $type: 'mothership/theme' }, t), null, 2), 'application/json');
      if (v !== 'remove') Br.remember(t);
      MS.emit('theme');
    });
  };

  /* ---------------------------------------------------------- brand check */
  Br.check = function () {
    var rt = MS.rt(), c = MS.child; if (!c) return;
    var w = c.win, d = c.doc, T = rt && rt.state.theme;
    var issues = [];
    var brandCols = [];
    if (T) { Object.keys(T.colors).forEach(function (k) { var x = hexToRgb(T.colors[k]); if (x) brandCols.push(x); }); T.palette.forEach(function (p) { var x = hexToRgb(p); if (x) brandCols.push(x); }); }
    brandCols.push([255, 255, 255], [0, 0, 0]);
    var brandFonts = T ? [T.fonts.heading, T.fonts.body].filter(Boolean).map(function (f) { return f.split(',')[0].replace(/["']/g, '').trim().toLowerCase(); }) : [];
    function bgOf(el) {
      for (var n = el; n && n.nodeType === 1; n = n.parentElement) { var b = hexToRgb(w.getComputedStyle(n).backgroundColor); if (b) return b; }
      return [255, 255, 255];
    }
    var seen = 0;
    MS.$$('body *', d).forEach(function (el) {
      if (seen > 3000 || el.closest('[data-ms-editor],script,style,svg,.ms-modal-wrap,#ms-ribbon')) return;
      if (!el.offsetParent && el.tagName !== 'BODY') return;
      var own = Array.prototype.some.call(el.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim().length > 1; });
      if (!own) return;
      seen++;
      var cs = w.getComputedStyle(el), col = hexToRgb(cs.color), bg = bgOf(el);
      var label = el.textContent.trim().slice(0, 50);
      if (col) {
        var ratio = contrast(col, bg), large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && Number(cs.fontWeight) >= 700);
        if (ratio < (large ? 3 : 4.5)) issues.push({ kind: 'Contrast', el: el, msg: 'Contrast ' + ratio.toFixed(2) + ':1 (needs ' + (large ? '3' : '4.5') + ':1)', text: label });
        if (T && brandCols.length > 2) {
          var best = brandCols.reduce(function (a, b) { return dist(col, b) < dist(col, a) ? b : a; });
          if (dist(col, best) > 30) issues.push({ kind: 'Off-brand colour', el: el, msg: toHex(col) + ' → nearest brand ' + toHex(best), text: label, fix: { color: toHex(best) } });
        }
      }
      if (brandFonts.length) {
        var fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase();
        if (brandFonts.indexOf(fam) < 0) issues.push({ kind: 'Off-brand font', el: el, msg: cs.fontFamily.split(',')[0], text: label, fix: { fontFamily: /^H[1-6]$/.test(el.tagName) ? (T.fonts.heading || T.fonts.body) : (T.fonts.body || T.fonts.heading) } });
      }
    });
    if (rt) rt.charts().forEach(function (ch) {
      var b = ch.el.closest('.ms-block');
      var name = (rt.chartInfo(ch.key) || {}).title || ch.key;
      if (!b) return issues.push({ kind: 'Commentary', el: ch.el, msg: 'Chart has no title/subtitle/inference header', text: name, wrap: true });
      if (!b.querySelector('.ms-title').textContent.trim()) issues.push({ kind: 'Commentary', el: b, msg: 'Missing title', text: name });
      if (!b.querySelector('.ms-inf').textContent.trim()) issues.push({ kind: 'Commentary', el: b, msg: 'Missing inference', text: b.querySelector('.ms-title').textContent || name });
    });
    if (!T) issues.unshift({ kind: 'Info', msg: 'No brand loaded, so only contrast and commentary were checked. Load one from Design › Load brand.' });
    var counts = {};
    issues.forEach(function (i) { counts[i.kind] = (counts[i.kind] || 0) + 1; });
    var fixable = issues.filter(function (i) { return i.fix; });
    var list = MS.h('div', { 'class': 'list issues' }, issues.slice(0, 400).map(function (i) {
      return MS.h('div', { 'class': 'list-row' }, [
        MS.h('span', { 'class': 'tag ' + i.kind.replace(/\W/g, '').toLowerCase(), text: i.kind }),
        MS.h('div', { 'class': 'grow' }, [MS.h('div', { text: i.msg }), i.text ? MS.h('small', { 'class': 'muted', text: '“' + i.text + '”' }) : null]),
        i.el ? MS.h('button', { 'class': 'btn sm', onclick: function () { MS.edit.reveal(i.el); } }, ['Show']) : null,
        i.fix ? MS.h('button', { 'class': 'btn sm', onclick: function (e) { MS.edit.style(i.el, i.fix, 'Brand fix'); e.target.disabled = true; e.target.textContent = 'Fixed'; } }, ['Fix']) : null,
        i.wrap ? MS.h('button', { 'class': 'btn sm', onclick: function (e) { MS.blocks.wrap(i.el, true); e.target.disabled = true; } }, ['Add']) : null
      ]);
    }));
    var summary = MS.h('p', { text: issues.length ? Object.keys(counts).map(function (k) { return counts[k] + ' ' + k.toLowerCase(); }).join(' · ') : 'No issues found. The dashboard follows the brand.' });
    MS.dialog({ title: 'Brand & quality check', wide: true, body: MS.h('div', {}, [summary, list]), buttons: [
      { label: 'Fix all ' + fixable.length + ' colour/font issues', value: 'fix' }, { label: 'Close', primary: true, value: null }] }).then(function (v) {
      if (v !== 'fix') return;
      MS.history.group('Fix brand issues', function () { fixable.forEach(function (i) { MS.edit.style(i.el, i.fix, 'Brand fix'); }); });
      MS.toast('Fixed ' + fixable.length + ' issue(s). Undo with Ctrl+Z.', 'ok');
    });
  };

  /* ---------------------------------------------------------- font list for pickers */
  MS.fonts = {
    system: ['Arial', 'Calibri', 'Cambria', 'Candara', 'Consolas', 'Georgia', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'system-ui', 'sans-serif', 'serif', 'monospace'],
    list: function (t) {
      t = t || (MS.rt() && MS.rt().state.theme);
      var out = [];
      if (t) { (t.fontFiles || []).forEach(function (f) { out.push(f.family); }); [t.fonts.heading, t.fonts.body].forEach(function (f) { if (f) out.push(f.split(',')[0].replace(/["']/g, '').trim()); }); }
      return out.concat(MS.fonts.system).filter(function (v, i, a) { return a.indexOf(v) === i; });
    }
  };
})(window.MS);
