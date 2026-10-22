/* Command search (Ctrl+K): every ribbon command, chart, tab, dataset, help topic and theme in one box. */
(function (MS) {
  'use strict';
  var h = MS.h;
  var anchor = function () { return document.getElementById('btn-cmdk') || document.body; };

  function sources() {
    var out = [];
    (MS.RIBBON || []).forEach(function (t) {
      (typeof t.groups === 'function' ? t.groups() : t.groups || []).forEach(function (g) {
        (g.items || []).forEach(function (it) {
          if (!it.label || !it.run) return;
          out.push({ sec: 'Commands', icon: it.icon, label: it.label, hint: it.title || '', where: t.tab + ' › ' + g.name,
            words: [t.tab, g.name, it.label, it.title].join(' '), run: function () { it.run({ currentTarget: anchor(), preventDefault: function () {} }); } });
        });
      });
    });
    var r = MS.rt && MS.rt();
    if (r) {
      r.charts().forEach(function (c) {
        var name = MS.charts.nameOf(c.key), info = r.chartInfo(c.key) || {};
        out.push({ sec: 'Charts', icon: MS.charts.kindIcon ? MS.charts.kindIcon(info.type) : '📊', label: name, hint: MS.charts.kindName(info.type), where: 'Go to chart', words: 'chart ' + name, run: function () { MS.edit.reveal(c.el, true); } });
        out.push({ sec: 'Charts', icon: '⚙', label: name + ': settings', hint: 'Commentary, look, pop-up, data & drill-down', where: 'Chart settings', words: 'settings ' + name, run: function () { MS.charts.settings(c.key); } });
      });
      if (r.layoutEnabled()) r.tabs().forEach(function (t) {
        out.push({ sec: 'Tabs', icon: '🗂', label: t.title, hint: t.hidden ? 'Hidden tab' : '', where: 'Show tab', words: 'tab ' + t.title, run: function () { r.showTab(t.id); MS.emit('structure'); } });
      });
      Object.keys(r.state.datasets).forEach(function (n) {
        out.push({ sec: 'Data', icon: '⛁', label: n, hint: r.getRows(n).length + ' rows', where: 'Datasets', words: 'data dataset ' + n, run: function () { MS.data.manage(); } });
      });
      (r.state.comments || []).forEach(function (c, i) {
        out.push({ sec: 'Comments', icon: '📍', label: '#' + (i + 1) + ' ' + String(c.text || '').slice(0, 60), hint: c.where || '', where: 'Go to comment', words: 'comment ' + c.text + ' ' + (c.where || ''), run: function () { MS.review.goTo(c.id); } });
      });
    }
    (MS.help && MS.help.GUIDE || []).forEach(function (g) {
      out.push({ sec: 'Help', icon: '📖', label: g.title, hint: 'User guide', where: 'Help', words: 'help guide ' + g.title + ' ' + String(g.html).replace(/<[^>]+>/g, ' ').slice(0, 400), run: function () { MS.help.guide(g.id); } });
    });
    out.push({ sec: 'Mothership', icon: '🎨', label: 'Mothership theme…', hint: 'Light, dark, accent colour, spacing, text size', where: 'Look', words: 'theme dark light colour color accent appearance', run: function () { MS.ui.dialog(); } });
    out.push({ sec: 'Mothership', icon: MS.ui.isDark() ? '☀' : '🌙', label: MS.ui.isDark() ? 'Switch to light mode' : 'Switch to dark mode', hint: '', where: 'Look', words: 'dark light mode night', run: function () { MS.ui.toggleDark(); } });
    MS.ui.PRESETS.forEach(function (p) { out.push({ sec: 'Mothership', icon: '🎨', label: 'Theme: ' + p.name, hint: '', where: 'Look', words: 'theme ' + p.name, run: function () { MS.ui.set(p.s); } }); });
    out.push({ sec: 'Mothership', icon: '⌨', label: 'Keyboard shortcuts', hint: '', where: 'Help', words: 'keys shortcuts keyboard', run: function () { MS.help.guide('shortcuts'); } });
    return out;
  }

  // simple fuzzy score: whole words first, then in-order characters
  function score(item, q) {
    if (!q) return item.sec === 'Commands' ? 1 : 0.5;
    var lab = item.label.toLowerCase(), words = String(item.words || '').toLowerCase(), terms = q.split(/\s+/).filter(Boolean), s = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i], k = lab.indexOf(t);
      if (k === 0) s += 10; else if (k > 0) s += /\s/.test(lab.charAt(k - 1)) ? 8 : 5;
      else if (words.indexOf(t) >= 0) s += 2;
      else { var j = 0, ok = true; for (var c = 0; c < t.length; c++) { j = lab.indexOf(t.charAt(c), j); if (j < 0) { ok = false; break; } j++; } if (!ok) return 0; s += 1; }
    }
    return s + (item.sec === 'Commands' ? 0.5 : 0);
  }
  function mark(label, q) {
    var t = (q || '').split(/\s+/).filter(Boolean)[0]; var span = h('span');
    var k = t ? label.toLowerCase().indexOf(t) : -1;
    if (k < 0) { span.textContent = label; return span; }
    span.appendChild(document.createTextNode(label.slice(0, k)));
    span.appendChild(h('mark', { text: label.slice(k, k + t.length) }));
    span.appendChild(document.createTextNode(label.slice(k + t.length)));
    return span;
  }

  var open = null;
  MS.palette = function (initial) {
    if (open) return open.focus();
    var all = sources(), cur = 0, shown = [];
    var input = h('input', { type: 'text', placeholder: 'Type a command, chart, tab or question…', value: initial || '', 'aria-label': 'Search' });
    var list = h('div', { 'class': 'cmdk-list', role: 'listbox' });
    var box = h('div', { 'class': 'cmdk', role: 'dialog' }, [
      h('div', { 'class': 'cmdk-in' }, [MS.icon('search'), input, h('kbd', { text: 'Esc' })]), list,
      h('div', { 'class': 'cmdk-foot' }, [h('span', { text: '↑ ↓ to move' }), h('span', { text: 'Enter to run' }), h('span', { 'class': 'grow' }), h('span', { text: all.length + ' items' })])
    ]);
    var wrap = h('div', { 'class': 'cmdk-wrap' }, [box]);
    function close() { wrap.remove(); open = null; document.removeEventListener('keydown', key, true); }
    function run(it) { close(); setTimeout(function () { try { it.run(); } catch (e) { MS.toast(e.message, 'error'); } }, 10); }
    function render() {
      var q = input.value.trim().toLowerCase();
      shown = all.map(function (it) { return { it: it, s: score(it, q) }; }).filter(function (x) { return x.s > 0; })
        .sort(function (a, b) { return b.s - a.s; }).slice(0, q ? 40 : 24).map(function (x) { return x.it; });
      var rank = {}; shown.forEach(function (it) { if (!(it.sec in rank)) rank[it.sec] = Object.keys(rank).length; });
      shown = shown.map(function (it, i) { return { it: it, i: i }; }).sort(function (a, b) { return rank[a.it.sec] - rank[b.it.sec] || a.i - b.i; }).map(function (x) { return x.it; });
      cur = Math.min(cur, Math.max(0, shown.length - 1));
      list.innerHTML = '';
      if (!shown.length) { list.appendChild(h('div', { 'class': 'cmdk-empty', text: 'Nothing matches. Try Help › User guide.' })); return; }
      var sec = null;
      shown.forEach(function (it, i) {
        if (it.sec !== sec) { sec = it.sec; list.appendChild(h('div', { 'class': 'cmdk-sec', text: sec })); }
        var row = h('div', { 'class': 'cmdk-item' + (i === cur ? ' on' : ''), role: 'option', onclick: function () { run(it); }, onmousemove: function () { if (cur !== i) { cur = i; paint(); } } }, [
          MS.icon(MS.icon.has(it.icon) ? it.icon : 'sparkles'),
          h('div', { 'class': 'grow' }, [mark(it.label, q), it.hint ? h('small', { text: it.hint.length > 110 ? it.hint.slice(0, 108) + '…' : it.hint }) : null]),
          h('span', { 'class': 'cmdk-where', text: it.where })
        ]);
        row.__i = i; list.appendChild(row);
      });
    }
    function paint() {
      MS.$$('.cmdk-item', list).forEach(function (r) { r.classList.toggle('on', r.__i === cur); if (r.__i === cur) r.scrollIntoView({ block: 'nearest' }); });
    }
    function key(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); cur = Math.min(shown.length - 1, cur + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cur = Math.max(0, cur - 1); paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (shown[cur]) run(shown[cur]); }
    }
    input.addEventListener('input', function () { cur = 0; render(); });
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(wrap); render(); input.focus();
    open = input;
  };
  MS.palette.items = sources;
})(window.MS);
