/* Region and currency, the "Ready to publish?" check, and publishing a view-only, versioned file
   (optional password lock for Mothership editing, and a tamper check when it is reopened). */
(function (MS) {
  'use strict';
  var h = MS.h;
  function rt() { return MS.rt(); }

  /* ================================================================ region and currency */
  var COUNTRIES = [
    ['US', 'United States', 'en-US', 'USD'], ['IN', 'India', 'en-IN', 'INR'], ['GB', 'United Kingdom', 'en-GB', 'GBP'], ['CA', 'Canada', 'en-CA', 'CAD'],
    ['AU', 'Australia', 'en-AU', 'AUD'], ['NZ', 'New Zealand', 'en-NZ', 'NZD'], ['IE', 'Ireland', 'en-IE', 'EUR'], ['DE', 'Germany', 'de-DE', 'EUR'],
    ['FR', 'France', 'fr-FR', 'EUR'], ['ES', 'Spain', 'es-ES', 'EUR'], ['IT', 'Italy', 'it-IT', 'EUR'], ['NL', 'Netherlands', 'nl-NL', 'EUR'],
    ['BE', 'Belgium', 'nl-BE', 'EUR'], ['PT', 'Portugal', 'pt-PT', 'EUR'], ['AT', 'Austria', 'de-AT', 'EUR'], ['CH', 'Switzerland', 'de-CH', 'CHF'],
    ['SE', 'Sweden', 'sv-SE', 'SEK'], ['NO', 'Norway', 'nb-NO', 'NOK'], ['DK', 'Denmark', 'da-DK', 'DKK'], ['FI', 'Finland', 'fi-FI', 'EUR'],
    ['PL', 'Poland', 'pl-PL', 'PLN'], ['CZ', 'Czechia', 'cs-CZ', 'CZK'], ['TR', 'Türkiye', 'tr-TR', 'TRY'], ['AE', 'United Arab Emirates', 'en-AE', 'AED'],
    ['SA', 'Saudi Arabia', 'en-SA', 'SAR'], ['QA', 'Qatar', 'en-QA', 'QAR'], ['IL', 'Israel', 'en-IL', 'ILS'], ['EG', 'Egypt', 'en-EG', 'EGP'],
    ['ZA', 'South Africa', 'en-ZA', 'ZAR'], ['NG', 'Nigeria', 'en-NG', 'NGN'], ['KE', 'Kenya', 'en-KE', 'KES'], ['SG', 'Singapore', 'en-SG', 'SGD'],
    ['HK', 'Hong Kong', 'en-HK', 'HKD'], ['MY', 'Malaysia', 'en-MY', 'MYR'], ['ID', 'Indonesia', 'id-ID', 'IDR'], ['TH', 'Thailand', 'th-TH', 'THB'],
    ['PH', 'Philippines', 'en-PH', 'PHP'], ['VN', 'Vietnam', 'vi-VN', 'VND'], ['JP', 'Japan', 'ja-JP', 'JPY'], ['KR', 'South Korea', 'ko-KR', 'KRW'],
    ['CN', 'China', 'zh-CN', 'CNY'], ['TW', 'Taiwan', 'zh-TW', 'TWD'], ['PK', 'Pakistan', 'en-PK', 'PKR'], ['BD', 'Bangladesh', 'en-BD', 'BDT'],
    ['LK', 'Sri Lanka', 'en-LK', 'LKR'], ['NP', 'Nepal', 'en-NP', 'NPR'], ['BR', 'Brazil', 'pt-BR', 'BRL'], ['MX', 'Mexico', 'es-MX', 'MXN'],
    ['AR', 'Argentina', 'es-AR', 'ARS'], ['CL', 'Chile', 'es-CL', 'CLP'], ['CO', 'Colombia', 'es-CO', 'COP'], ['PE', 'Peru', 'es-PE', 'PEN']
  ];
  var Lc = MS.locale = { COUNTRIES: COUNTRIES, DEFAULT: { country: 'US', locale: 'en-US', currency: 'USD', units: 'intl' } };
  Lc.get = function () { var r = rt(), s = r && r.state.locale; return Object.assign({}, Lc.DEFAULT, s || {}); };
  Lc.currencies = function () {
    var list = [];
    try { list = Intl.supportedValuesOf('currency'); } catch (e) {}
    if (!list.length) list = COUNTRIES.map(function (c) { return c[3]; }).filter(function (c, i, a) { return a.indexOf(c) === i; }).sort();
    var dn = null; try { dn = new Intl.DisplayNames(['en'], { type: 'currency' }); } catch (e) {}
    return list.map(function (c) { return { value: c, label: c + (dn ? ' · ' + dn.of(c) : '') }; });
  };
  Lc.sample = function (o) {
    var r = rt(); if (!r) return '';
    var keep = r.state.locale; r.state.locale = o;
    try { return [r.fmtNum(1234567.89, 'cur'), r.fmtNum(98765432, 'curshort'), r.fmtNum(1234567.891, 'num'), r.fmtNum(12.5, 'pct')].join('  ·  '); } finally { if (keep === undefined) delete r.state.locale; else r.state.locale = keep; }
  };
  // set({country}) fills locale and currency from the country; currency/locale/units can be given too
  Lc.set = function (o) {
    var c = o.country && COUNTRIES.filter(function (x) { return x[0] === String(o.country).toUpperCase() || x[1].toLowerCase() === String(o.country).toLowerCase(); })[0];
    var cur = Lc.get(), next = { country: c ? c[0] : (o.country || cur.country), locale: o.locale || (c ? c[2] : cur.locale), currency: String(o.currency || (c ? c[3] : cur.currency)).toUpperCase() };
    next.units = o.units || (next.currency === 'INR' || /-IN$/.test(next.locale) ? 'indian' : 'intl');
    try { new Intl.NumberFormat(next.locale, { style: 'currency', currency: next.currency }); } catch (e) { throw new Error('Unknown currency or region: ' + next.currency + ' / ' + next.locale); }
    MS.history.state('Region and currency', function (s) { s.locale = next; });
    MS.emit('locale', next);
    return next;
  };
  Lc.describe = function (o) {
    o = o || Lc.get();
    var c = COUNTRIES.filter(function (x) { return x[0] === o.country; })[0], dn = null;
    try { dn = new Intl.DisplayNames(['en'], { type: 'currency' }).of(o.currency); } catch (e) {}
    return (c ? c[1] : o.locale) + ', ' + (dn || o.currency) + (o.units === 'indian' ? ' (lakh and crore)' : '');
  };
  Lc.dialog = function () {
    if (!rt()) return MS.toast('Open a dashboard first.', 'warn');
    var cur = Lc.get();
    var f = MS.form([
      { key: 'country', label: 'Country or region (number style)', type: 'select', options: COUNTRIES.map(function (c) { return { value: c[0], label: c[1] }; }), value: cur.country },
      { key: 'currency', label: 'Currency', type: 'select', options: Lc.currencies(), value: cur.currency },
      { key: 'units', label: 'Big numbers', type: 'select', options: [{ value: 'intl', label: 'Thousand, million, billion (K, M, B)' }, { value: 'indian', label: 'Lakh and crore (L, Cr)' }], value: cur.units || 'intl' }
    ]);
    var prev = h('div', { 'class': 'loc-prev' });
    var draw = function () { var c = COUNTRIES.filter(function (x) { return x[0] === f.inputs.country.value; })[0]; prev.textContent = 'Looks like: ' + Lc.sample({ country: f.inputs.country.value, locale: c ? c[2] : 'en-US', currency: f.inputs.currency.value, units: f.inputs.units.value }); };
    f.inputs.country.addEventListener('change', function () { var c = COUNTRIES.filter(function (x) { return x[0] === f.inputs.country.value; })[0]; if (c) { f.inputs.currency.value = c[3]; f.inputs.units.value = c[3] === 'INR' ? 'indian' : 'intl'; } draw(); });
    f.inputs.currency.addEventListener('change', draw); f.inputs.units.addEventListener('change', draw);
    draw();
    MS.dialog({ title: 'Region and currency', body: h('div', {}, [f, prev, h('p', { 'class': 'hint', html: 'Used wherever Mothership writes numbers: pop-ups and axes set to <b>Currency</b> or <b>Short</b>, KPI cards, chart summaries and the number check. Numbers the dashboard\'s own script writes are not changed. Formats you chose by name (₹ crore, $) stay as they are.' })]),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Apply', primary: true, value: function () { return f.values(); } }] }).then(function (v) {
      if (!v) return;
      var c = COUNTRIES.filter(function (x) { return x[0] === v.country; })[0];
      try { var n = Lc.set({ country: v.country, locale: c && c[2], currency: v.currency, units: v.units }); MS.toast('Numbers now follow ' + Lc.describe(n) + '.', 'ok'); } catch (e) { MS.toast(e.message, 'error'); }
    });
  };
  // one line for AI prompts: which number style to use
  Lc.rule = function () {
    var o = Lc.get(), r = rt(), ex = r ? r.fmtNum(12345678, 'cur') + ' or ' + r.fmtNum(12345678, 'curshort') : '';
    return 'Use ' + Lc.describe(o) + ' number formats unless a comment says otherwise' + (ex ? ' (e.g. ' + ex + ')' : '') + (o.units === 'indian' ? ', DD-MM-YYYY dates and the April–March financial year.' : ', with dates written the ' + (o.country === 'US' ? 'US way (MM/DD/YYYY)' : 'local way') + '.') + ' Keep amounts the dashboard already labels in another currency as they are.';
  };
  // A dashboard that clearly shows another currency (but has no setting yet) gets a nudge, not a silent change.
  MS.on('child-loaded', function () {
    setTimeout(function () {
      var r = rt(); if (!r || r.state.locale || !MS.child) return;
      var t = (MS.child.doc.body && MS.child.doc.body.textContent || '').slice(0, 200000);
      var hits = { INR: (t.match(/₹|\bcrores?\b|\blakhs?\b|\bRs\.?\s?\d/gi) || []).length, EUR: (t.match(/€/g) || []).length, GBP: (t.match(/£/g) || []).length };
      var best = Object.keys(hits).sort(function (a, b) { return hits[b] - hits[a]; })[0];
      if (hits[best] >= 3) MS.status('This dashboard shows ' + { INR: '₹ (India)', EUR: '€', GBP: '£' }[best] + ' amounts. Mothership writes numbers in US $ until you change Design › Region & currency.');
    }, 1500);
  });

  /* ================================================================ crypto helpers */
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function sha256(text) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('This browser can\'t do the security check.'));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(hex);
  }
  function pbkdf2(password, salt, iter) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
      .then(function (k) { return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: iter, hash: 'SHA-256' }, k, 256); }).then(hex);
  }
  var ZERO = new Array(65).join('0');
  function stateOf(html) {
    var m = /<script[^>]*id="ms-state"[^>]*>([\s\S]*?)<\/script>/i.exec(html || '');
    if (!m) return null;
    try { return JSON.parse(m[1].replace(/<\\\/script/gi, '</script')); } catch (e) { try { return JSON.parse(new DOMParser().parseFromString('<x>' + m[1] + '</x>', 'text/html').body.textContent); } catch (e2) { return null; } }
  }

  /* ================================================================ ready to publish? */
  var Pf = MS.preflight = {};
  // script errors since the page started (recorded by the #ms-early script that opening adds to <head>)
  function childErrors() {
    var list = []; try { list = (MS.child && MS.child.win.__msErrs) || []; } catch (e) {}
    return list.map(function (e) { return e.message + (e.file ? ' (' + e.file + (e.line ? ':' + e.line : '') + ')' : ''); });
  }
  Pf.errors = childErrors;
  Pf.run = function () {
    var r = rt(), d = MS.child.doc, out = [];
    var add = function (status, title, detail, fix) { out.push({ status: status, title: title, detail: detail || '', fix: fix || '' }); };
    // script errors
    var errs = childErrors();
    if (errs.length) add('fail', 'The dashboard had script errors', errs.slice(0, 3).join('; '), 'Reload (File › Reload). If it repeats, part of the page will not work for viewers.');
    else add('pass', 'No script errors');
    // charts that drew nothing
    var charts = r ? r.charts() : [], empty = charts.filter(function (c) { var x = r.chartData(c.key, true); return !x || !x.labels.length || !x.series.some(function (s) { return s.values.some(function (v) { return v != null; }); }); });
    var bare = MS.$$('canvas', d).filter(function (cv) { return !charts.some(function (c) { return c.el === cv || c.el.contains(cv); }) && !cv.closest('[data-ms-editor]') && cv.width > 50; });
    if (empty.length || bare.length) add('warn', (empty.length + bare.length) + ' chart(s) show no numbers', empty.map(function (c) { return MS.charts.nameOf(c.key); }).concat(bare.length ? [bare.length + ' blank drawing area(s)'] : []).join(', '), 'Check the data, or open the folder so the chart\'s files are bundled.');
    else add('pass', charts.length + ' chart(s) drew their numbers');
    var unnamed = charts.filter(function (c) { return /^Chart \d+$/.test(MS.charts.nameOf(c.key)); });
    if (unnamed.length) add('warn', unnamed.length + ' chart(s) have no title', 'Viewers and summaries call them “' + MS.charts.nameOf(unnamed[0].key) + '”.', 'Double-click the chart › Commentary & size › Title.');
    // numbers
    try {
      var nc = MS.numcheck.run(), diffs = nc.filter(function (x) { return x.status === 'diff'; });
      if (diffs.length) add('warn', diffs.length + ' number(s) don\'t add up', diffs.slice(0, 2).map(function (x) { return x.what + ' ' + x.shown + ' vs ' + x.against + ' ' + x.expected; }).join('; '), 'Review › Number check.');
      else add('pass', 'KPI cards match their charts', nc.filter(function (x) { return x.status === 'ok'; }).length + ' check(s)');
    } catch (e) {}
    // comments
    var cm = MS.review ? MS.review.list() : [], must = cm.filter(function (c) { return !c.done && c.prio === 'must'; }), open = cm.filter(function (c) { return !c.done; });
    if (must.length) add('fail', must.length + ' must-fix comment(s) still open', must.slice(0, 2).map(function (c) { return '“' + c.text.slice(0, 60) + '”'; }).join('; '), 'Fix them, or mark them done in the Review tab.');
    else if (open.length) add('warn', open.length + ' review comment(s) still open', 'None are must-fix.', 'Publishing leaves comments out of the file.');
    else add('pass', 'No open review comments');
    // internet
    var html = MS.exportHtml({ dropComments: true });
    var net = [], re = /<(?:script|link|img|iframe|source)\b[^>]*?(?:src|href)\s*=\s*["'](https?:)?\/\/([^\/"']+)/gi, m;
    while ((m = re.exec(html))) if (net.indexOf(m[2]) < 0) net.push(m[2]);
    if (net.length) add('warn', 'Needs the internet for ' + net.length + ' file(s)', net.slice(0, 4).join(', '), 'On a locked-down laptop these may not load. Use File › Open folder with local copies.');
    else add('pass', 'Works offline (no internet files)');
    // size
    var mb = html.length / 1048576;
    if (mb > 20) add('warn', 'Large file: ' + mb.toFixed(1) + ' MB', 'Email often stops at 10–25 MB.', 'Share through OneDrive, SharePoint or Teams, or remove unused datasets (Data › Manage).');
    else add('pass', 'File size ' + (mb < 1 ? Math.round(html.length / 1024) + ' KB' : mb.toFixed(1) + ' MB'));
    // number style and titles
    add('info', 'Numbers follow ' + MS.locale.describe(), '', 'Design › Region & currency to change.');
    if (!(d.title || '').trim()) add('warn', 'The page has no title', 'Browser tabs will show the file name.', 'Add a header (Insert › Header) or set the file name.');
    var P = r && r.state.publish;
    add('info', P && P.version ? 'Last published: version ' + P.version + ' on ' + new Date(P.at).toLocaleDateString() : 'Not published before');
    return out;
  };
  var ICON = { pass: '✅', warn: '⚠', fail: '✕', info: 'ℹ' };
  function checklist(items) {
    return h('div', { 'class': 'pf-list' }, items.map(function (x) {
      return h('div', { 'class': 'pf-item pf-' + x.status }, [h('span', { 'class': 'pf-ic', text: ICON[x.status] }), h('div', { 'class': 'grow' }, [h('div', { 'class': 'pf-title', text: x.title })].concat(x.detail ? [h('div', { 'class': 'pf-detail', text: x.detail })] : []).concat(x.fix && x.status !== 'pass' ? [h('div', { 'class': 'pf-fix', text: x.fix })] : []))]);
    }));
  }
  Pf.dialog = function () {
    if (!MS.child) return MS.toast('Open a dashboard first.', 'warn');
    var items = Pf.run(), bad = items.filter(function (x) { return x.status === 'fail'; }).length, warn = items.filter(function (x) { return x.status === 'warn'; }).length;
    MS.dialog({ title: 'Ready to publish?', wide: true, body: h('div', {}, [h('p', { 'class': 'pf-sum', html: bad ? '<b>' + bad + ' thing(s) to fix</b> before sharing' + (warn ? ', and ' + warn + ' to look at.' : '.') : warn ? '<b>Nearly ready.</b> ' + warn + ' thing(s) to look at.' : '<b>Ready to publish.</b>' }), checklist(items)]),
      buttons: [{ label: 'Close', value: null }, { label: 'Publish…', primary: !bad, value: 'pub' }] }).then(function (v) { if (v === 'pub') Pub.dialog(true); });
  };

  /* ================================================================ publish */
  var Pub = MS.publish = {};
  function nextVersion(v) { if (!v) return '1.0'; var p = String(v).split('.'); var last = parseInt(p[p.length - 1], 10); if (isNaN(last)) return v + '.1'; p[p.length - 1] = String(last + 1); return p.join('.'); }
  // o: { version, note, asOf, by, password, badge, keepComments }  ->  Promise<{ html, name, publish }>
  Pub.build = function (o) {
    var r = rt(); if (!r) return Promise.reject(new Error('Open a dashboard first (and turn off Safe mode).'));
    var prev = r.state.publish || {}, at = new Date().toISOString();
    var P = { version: o.version || nextVersion(prev.version), at: at, by: o.by || '', note: o.note || '', asOf: o.asOf || '', badge: o.badge !== false,
      log: (prev.log || []).concat([{ version: o.version || nextVersion(prev.version), at: at, by: o.by || '', note: o.note || '' }]).slice(-50), seal: ZERO };
    var lock = o.password ? (function () { var salt = hex(crypto.getRandomValues(new Uint8Array(16))), iter = 150000; return pbkdf2(o.password, salt, iter).then(function (k) { return { salt: salt, iter: iter, key: k }; }); })() : Promise.resolve(o.keepLock && prev.lock ? prev.lock : null);
    return lock.then(function (L) {
      if (L) P.lock = L;
      // keep the record in the editor too, so the next publish counts on from here
      MS.history.state('Publish version ' + P.version, function (s) { var c = JSON.parse(JSON.stringify(P)); delete c.seal; s.publish = c; });
      var html = MS.exportHtml({ dropComments: !o.keepComments, publish: P });
      return sha256(html).then(function (sum) {
        html = html.replace(ZERO, sum);
        return { html: html, name: MS.exportName(' v' + P.version), publish: P, sha256: sum };
      });
    });
  };
  Pub.dialog = function (checked) {
    if (!rt()) return MS.toast('Open a dashboard first (and turn off Safe mode).', 'warn');
    var prev = rt().state.publish || {};
    var f = MS.form([
      { key: 'version', label: 'Version', value: nextVersion(prev.version) },
      { key: 'by', label: 'Published by', value: prev.by || MS.prefs.get('publishBy', '') },
      { key: 'asOf', label: 'Data as of', type: 'date', value: prev.asOf || '' },
      { key: 'note', label: 'What changed (release note)', type: 'textarea', rows: 3, value: '' },
      { key: 'badge', label: 'Show the version, date and notes in a small corner badge', type: 'checkbox', value: prev.badge !== false },
      { key: 'keepComments', label: 'Keep review comments in the file', type: 'checkbox', value: false },
      { key: 'lock', label: 'Lock editing in Mothership with a password', type: 'checkbox', value: !!prev.lock },
      { key: 'password', label: 'Password (leave blank to keep the current one)', type: 'password', value: '' },
      { key: 'password2', label: 'Password again', type: 'password', value: '' }
    ]);
    var pw = [f.inputs.password, f.inputs.password2].map(function (i) { return i.closest('.field') || i.parentNode; });
    var sync = function () { pw.forEach(function (p) { p.style.display = f.inputs.lock.checked ? '' : 'none'; }); };
    f.inputs.lock.addEventListener('change', sync); sync();
    var warn = h('div', { 'class': 'pub-note' }, [h('b', { text: 'About the lock. ' }), 'It stops people changing the dashboard in Mothership without the password, and Mothership warns if the file was changed some other way. It is a deterrent, not a vault: an HTML file can always be opened in Notepad, and anything shown on screen can be copied. Keep confidential numbers out of files you send outside the team, and use SharePoint or Teams permissions to control who can open it.']);
    var pre = checked ? null : Pf.run().filter(function (x) { return x.status === 'fail' || x.status === 'warn'; });
    var body = h('div', {}, [pre && pre.length ? h('div', { 'class': 'pub-pre' }, [h('b', { text: pre.length + ' thing(s) from the publish check: ' }), pre.map(function (x) { return x.title; }).join(' · '), ' ', h('a', { href: '#', text: 'See all', onclick: function (e) { e.preventDefault(); MS.$('.dlg-wrap').remove(); Pf.dialog(); } })]) : null, f, warn]);
    MS.dialog({ title: 'Publish a view-only copy', wide: true, body: body, buttons: [{ label: 'Cancel', value: null }, { label: 'Publish', primary: true, value: function () {
      var v = f.values();
      if (!String(v.version || '').trim()) { MS.toast('Give it a version, e.g. 1.0.', 'warn'); return false; }
      if (v.lock && (v.password || v.password2 || !prev.lock)) {
        if (!v.password || v.password.length < 6) { MS.toast('Use a password of at least 6 characters.', 'warn'); return false; }
        if (v.password !== v.password2) { MS.toast('The two passwords are different.', 'warn'); return false; }
      }
      return v;
    } }] }).then(function (v) {
      if (!v) return;
      MS.prefs.set('publishBy', v.by || '');
      Pub.build({ version: v.version.trim(), by: v.by, note: v.note, asOf: v.asOf, badge: v.badge, keepComments: v.keepComments, password: v.lock ? v.password : '', keepLock: v.lock && !v.password }).then(function (r) {
        MS.download(r.name, r.html);
        MS.toast('Published ' + r.name + (r.publish.lock ? ' (locked for editing)' : '') + '. Share this file; keep editing your working copy.', 'ok', 7000);
      }).catch(function (e) { MS.toast('Could not publish: ' + e.message, 'error'); });
    });
  };

  /* ================================================================ opening a published file */
  // Called by MS.openHtml before anything is shown. Resolves true when it may open.
  // Only a published copy (it carries a seal) is locked; the working copy keeps the lock details for the next publish.
  Pub.isLocked = function (html) { var st = /"lock":\{/.test(html || '') && stateOf(html), P = st && st.publish; return !!(P && P.lock && P.seal); };
  Pub.gate = function (html, name, password) {
    var st = stateOf(html), L = st && st.publish && st.publish.seal && st.publish.lock;
    if (!L) return Promise.resolve(true);
    var tryPw = function (pw) { return pbkdf2(pw || '', L.salt, L.iter || 150000).then(function (k) { return k === L.key; }); };
    if (password != null) return tryPw(password);
    return new Promise(function (resolve) {
      var ask = function (again) {
        var f = MS.form([{ key: 'pw', label: 'Password', type: 'password', value: '' }]);
        MS.dialog({ title: 'Locked for editing', body: h('div', {}, [h('p', { text: '“' + name + '” (version ' + (st.publish.version || '?') + (st.publish.by ? ', published by ' + st.publish.by : '') + ') is locked for editing. ' + (again ? 'That password didn\'t match. ' : '') + 'Viewers don\'t need a password: double-click the file to open it in a browser.' }), f]),
          buttons: [{ label: 'Cancel', value: null }, { label: 'Unlock', primary: true, value: function () { return f.values().pw || false; } }] }).then(function (pw) {
          if (!pw) return resolve(false);
          tryPw(pw).then(function (ok) { if (ok) resolve(true); else ask(true); });
        });
      };
      ask(false);
    });
  };
  // Tamper check: the published file carries a SHA-256 of itself.
  Pub.verify = function (html) {
    var st = stateOf(html), P = st && st.publish;
    if (!P || !P.seal || P.seal === ZERO) return Promise.resolve(null);
    return sha256(html.replace(P.seal, ZERO)).then(function (sum) { return { ok: sum === P.seal, version: P.version, by: P.by, at: P.at }; });
  };
  MS.on('doc-opened', function (doc) {
    if (!doc || !doc.source) return;
    Pub.verify(doc.source).then(function (v) {
      if (!v) return;
      MS.doc.integrity = v;
      if (v.ok) MS.status('Published version ' + v.version + (v.by ? ' by ' + v.by : '') + ': unchanged since it was published.');
      else MS.toast('This file says it is published version ' + v.version + (v.by ? ' by ' + v.by : '') + ', but it was changed outside Mothership afterwards. Check it before sharing it on.', 'warn', 12000);
    }).catch(function () {});
  });
  Pub.stateOf = stateOf;
})(window.MS);
