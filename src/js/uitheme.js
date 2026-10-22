/* Mothership's own look: light/dark, accent colour, density, text size and app bar style.
   Only the editor changes; the dashboard keeps its own design. Saved per browser. */
(function (MS) {
  'use strict';
  var h = MS.h;
  var ACCENTS = [
    { id: 'indigo', name: 'Indigo', c: '#4f46e5' }, { id: 'royal', name: 'Royal blue', c: '#2563eb' },
    { id: 'ocean', name: 'Ocean', c: '#0e7490' }, { id: 'teal', name: 'Teal', c: '#0d9488' },
    { id: 'emerald', name: 'Emerald', c: '#059669' }, { id: 'saffron', name: 'Saffron', c: '#d97706' },
    { id: 'ruby', name: 'Ruby', c: '#e11d48' }, { id: 'plum', name: 'Plum', c: '#9333ea' },
    { id: 'graphite', name: 'Graphite', c: '#475569' }
  ];
  var PRESETS = [
    { id: 'classic', name: 'Classic', s: { mode: 'light', accent: 'indigo', bar: 'deep' } },
    { id: 'daylight', name: 'Daylight', s: { mode: 'light', accent: 'royal', bar: 'plain' } },
    { id: 'ocean', name: 'Ocean', s: { mode: 'light', accent: 'ocean', bar: 'deep' } },
    { id: 'forest', name: 'Forest', s: { mode: 'light', accent: 'emerald', bar: 'deep' } },
    { id: 'saffron', name: 'Saffron', s: { mode: 'light', accent: 'saffron', bar: 'plain' } },
    { id: 'midnight', name: 'Midnight', s: { mode: 'dark', accent: 'indigo', bar: 'deep' } },
    { id: 'slate', name: 'Slate dark', s: { mode: 'dark', accent: 'teal', bar: 'plain' } },
    { id: 'contrast', name: 'High contrast', s: { mode: 'contrast', accent: 'royal', bar: 'plain' } }
  ];
  var DEFAULT = { mode: 'light', accent: 'indigo', bar: 'deep', density: 'comfortable', size: 13, labels: true };

  function hex(c) { c = String(c || '').trim(); if (/^#[0-9a-f]{3}$/i.test(c)) c = '#' + c.slice(1).split('').map(function (x) { return x + x; }).join(''); return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : null; }
  function rgb(c) { c = hex(c) || '#4f46e5'; return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function toHex(a) { return '#' + a.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return toHex([0, 1, 2].map(function (i) { return x[i] + (y[i] - x[i]) * t; })); }
  function lum(c) { var x = rgb(c).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]; }

  var U = MS.ui = { ACCENTS: ACCENTS, PRESETS: PRESETS, DEFAULT: DEFAULT };
  U.get = function () { var s = MS.prefs.get('ui', null) || {}; var o = {}; Object.keys(DEFAULT).forEach(function (k) { o[k] = s[k] != null ? s[k] : DEFAULT[k]; }); return o; };
  U.accentColor = function (s) {
    if (s.accent === 'brand') { var r = MS.rt && MS.rt(), t = r && r.state.theme; return hex(t && t.colors && t.colors.primary) || '#4f46e5'; }
    var a = ACCENTS.filter(function (x) { return x.id === s.accent; })[0]; return a ? a.c : (hex(s.accent) || '#4f46e5');
  };
  U.isDark = function (s) { s = s || U.get(); return s.mode === 'dark' || (s.mode === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); };
  U.apply = function (s) {
    s = s || U.get();
    var root = document.documentElement, dark = U.isDark(s), contrast = s.mode === 'contrast';
    var a = U.accentColor(s);
    if (dark && lum(a) < 0.08) a = mix(a, '#ffffff', 0.35);      // keep dark accents readable on dark panels
    if (contrast) a = lum(a) > 0.2 ? mix(a, '#000000', 0.45) : a;
    var panel = dark ? '#171a26' : '#ffffff';
    var vars = {
      '--accent': a, '--accent-hover': mix(a, dark ? '#ffffff' : '#000000', 0.12),
      '--accent-weak': mix(a, panel, dark ? 0.82 : 0.9), '--accent-line': mix(a, panel, dark ? 0.6 : 0.7),
      '--accent-ink': lum(a) > 0.45 ? '#111827' : '#ffffff',
      '--bar-bg': s.bar === 'deep' ? (dark ? '#0d0f18' : mix(a, '#0b1020', 0.72)) : (dark ? '#121521' : '#ffffff'),
      '--bar-text': s.bar === 'deep' || dark ? '#eef0fb' : '#1f2333',
      '--bar-muted': s.bar === 'deep' || dark ? mix(a, '#ffffff', 0.7) : '#6b7185',
      '--ui-size': (+s.size || 13) + 'px'
    };
    Object.keys(vars).forEach(function (k) { root.style.setProperty(k, vars[k]); });
    root.setAttribute('data-ms-mode', contrast ? 'contrast' : dark ? 'dark' : 'light');
    root.setAttribute('data-ms-bar', s.bar === 'deep' ? 'deep' : 'plain');
    root.setAttribute('data-ms-density', s.density === 'compact' ? 'compact' : 'comfortable');
    root.classList.toggle('no-rlabels', s.labels === false);
    var fav = document.querySelector('link[rel=icon]');
    if (fav) fav.href = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="' + a + '"/><path d="M16 5l11 11-11 11L5 16z" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/><path d="M16 11l5 5-5 5-5-5z" fill="#fff"/></svg>');
    MS.emit && MS.emit('ui-theme', s);
    return s;
  };
  U.set = function (patch) { var s = U.get(); Object.keys(patch).forEach(function (k) { s[k] = patch[k]; }); MS.prefs.set('ui', s); return U.apply(s); };
  U.toggleDark = function () { var s = U.get(); return U.set({ mode: U.isDark(s) ? 'light' : 'dark' }); };

  function same(a, b) { return a.mode === b.mode && a.accent === b.accent && a.bar === b.bar; }
  function card(p, cur, pick) {
    var a = U.accentColor(p.s), dark = p.s.mode === 'dark', c = p.s.mode === 'contrast';
    var bar = p.s.bar === 'deep' ? (dark ? '#0d0f18' : mix(a, '#0b1020', 0.72)) : (dark ? '#121521' : '#ffffff');
    var bg = c ? '#ffffff' : dark ? '#0f121b' : '#eef0f6', pn = dark ? '#171a26' : '#ffffff', ln = c ? '#000' : dark ? '#2a2f42' : '#e3e5ec';
    var mini = h('div', { 'class': 'th-mini', style: 'background:' + bg + ';border-color:' + ln }, [
      h('i', { 'class': 'th-bar', style: 'background:' + bar + ';border-bottom:1px solid ' + ln }),
      h('i', { 'class': 'th-rib', style: 'background:' + pn + ';border-bottom:1px solid ' + ln }, [h('b', { style: 'background:' + a })]),
      h('i', { 'class': 'th-side', style: 'background:' + pn + ';border-right:1px solid ' + ln }),
      h('i', { 'class': 'th-page', style: 'background:#fff;border:1px solid ' + ln }),
      h('i', { 'class': 'th-btn', style: 'background:' + a })
    ]);
    return h('button', { 'class': 'th-card' + (same(p.s, cur) ? ' on' : ''), type: 'button', onclick: function () { pick(p.s); } }, [mini, h('span', { text: p.name })]);
  }

  U.dialog = function () {
    var before = U.get(), s = U.get(), body = h('div', { 'class': 'th-dlg' });
    function render() {
      body.innerHTML = '';
      body.appendChild(h('p', { 'class': 'muted', text: 'Changes Mothership itself, not your dashboard. Saved in this browser.' }));
      var grid = h('div', { 'class': 'th-grid' });
      PRESETS.forEach(function (p) { grid.appendChild(card(p, s, function (v) { s.mode = v.mode; s.accent = v.accent; s.bar = v.bar; U.apply(s); render(); })); });
      body.appendChild(grid);
      var modes = h('div', { 'class': 'seg' }, [['light', '☀ Light'], ['dark', '🌙 Dark'], ['auto', 'Match Windows'], ['contrast', 'High contrast']].map(function (m) {
        return h('button', { 'class': 'seg-btn' + (s.mode === m[0] ? ' on' : ''), type: 'button', onclick: function () { s.mode = m[0]; U.apply(s); render(); } }, [m[1]]);
      }));
      var acc = h('div', { 'class': 'th-accents' }, ACCENTS.map(function (x) {
        return h('button', { 'class': 'th-dot' + (s.accent === x.id ? ' on' : ''), type: 'button', title: x.name, style: 'background:' + x.c, onclick: function () { s.accent = x.id; U.apply(s); render(); } });
      }));
      var custom = h('input', { type: 'color', value: hex(s.accent) || U.accentColor(s), title: 'Any colour', oninput: function () { s.accent = custom.value; U.apply(s); } });
      custom.addEventListener('change', render);
      acc.appendChild(h('label', { 'class': 'th-custom', title: 'Pick any colour' }, [custom, h('span', { text: 'Custom' })]));
      var brandOn = MS.rt && MS.rt() && MS.rt().state.theme;
      acc.appendChild(h('button', { 'class': 'btn sm' + (s.accent === 'brand' ? ' primary' : ''), type: 'button', disabled: !brandOn, title: brandOn ? 'Use the loaded brand\'s primary colour' : 'Load a brand first (Design › Load brand)', onclick: function () { s.accent = 'brand'; U.apply(s); render(); } }, ['Match brand']));
      function seg(opts, key) {
        return h('div', { 'class': 'seg small' }, opts.map(function (o) { return h('button', { 'class': 'seg-btn' + (String(s[key]) === String(o[0]) ? ' on' : ''), type: 'button', onclick: function () { s[key] = o[0]; U.apply(s); render(); } }, [o[1]]); }));
      }
      var rows = [
        ['Mode', modes], ['Accent colour', acc],
        ['Top bar', seg([['deep', 'Coloured'], ['plain', 'Plain']], 'bar')],
        ['Spacing', seg([['comfortable', 'Comfortable'], ['compact', 'Compact']], 'density')],
        ['Text size', seg([[12, 'Small'], [13, 'Normal'], [14, 'Large'], [15, 'Larger']], 'size')],
        ['Ribbon labels', seg([[true, 'Show'], [false, 'Icons only']], 'labels')]
      ];
      var tbl = h('div', { 'class': 'th-rows' });
      rows.forEach(function (r) { tbl.appendChild(h('div', { 'class': 'th-row' }, [h('span', { text: r[0] }), r[1]])); });
      body.appendChild(tbl);
    }
    render();
    return MS.dialog({ title: '🎨 Mothership theme', wide: true, body: body, buttons: [
      { label: 'Reset', value: 'reset' }, { label: 'Cancel', value: null }, { label: 'Keep this look', primary: true, value: 'ok' }] }).then(function (v) {
      if (v === 'ok') { MS.prefs.set('ui', s); U.apply(s); MS.toast('Theme saved for this browser.', 'ok'); }
      else if (v === 'reset') { MS.prefs.set('ui', DEFAULT); U.apply(DEFAULT); }
      else U.apply(before);
    });
  };

  U.apply();
  if (window.matchMedia) try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (U.get().mode === 'auto') U.apply(); }); } catch (e) {}
  if (MS.on) MS.on('theme', function () { if (U.get().accent === 'brand') U.apply(); });
})(window.MS);
