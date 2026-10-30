/* For client work: the firm template (logo, fonts, palette and disclaimer, locked), the
   Draft / In review / Client-ready stamp, the "Client confidential" mark and removing client
   names, the change log kept inside the file, and the colour-blind check of chart colours. */
(function (MS) {
  'use strict';
  var h = MS.h;
  function rt() { return MS.rt(); }
  function need() { if (!rt()) { MS.toast('Open a dashboard first (Safe mode off).', 'warn'); return false; } return true; }
  function copy(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }

  /* ================================================================ firm template */
  var Fm = MS.firm = { applying: false };
  Fm.current = function () { var r = rt(); return r && r.state.firm || null; };
  Fm.locked = function () { var f = Fm.current(); return !!(f && f.locked); };
  // Brand and colour commands call this: true (with a message) while the firm template is locked.
  Fm.blocks = function (what) {
    if (Fm.applying || !Fm.locked()) return false;
    MS.toast('The brand is locked to the "' + Fm.current().name + '" firm template, so ' + (what || 'colours and fonts') + ' can\'t change. Consulting › Firm template › Unlock.', 'warn', 6500);
    return true;
  };
  // The style fields the template owns: colours and font families (size, weight and layout stay free).
  Fm.BRAND_KEY = /colou?r$|^background|^font(Family)?$|^tip(Bg|Border)$/i;
  // For the shared style setters: blocks (with the message) when a locked brand field would change.
  // With `before`, only fields whose value differs count, so re-saving a whole look is fine.
  Fm.blocksStyle = function (next, before, what) {
    if (Fm.applying || !Fm.locked() || !next) return false;
    var str = function (v) { return v == null ? '' : String(v); };
    var keys = Object.keys(next).concat(before ? Object.keys(before) : []);
    var hit = keys.some(function (k) { return Fm.BRAND_KEY.test(k) && (!before || str(next[k]) !== str(before[k])); });
    return hit ? Fm.blocks(what) : false;
  };
  // Run fn with the lock lifted, for fixes that move the page toward the brand.
  Fm.allow = function (fn) { var was = Fm.applying; Fm.applying = true; try { return fn(); } finally { Fm.applying = was; } };
  Fm.lockedError = function () { return new Error('The brand is locked to the "' + Fm.current().name + '" firm template. Unlock it first (firm_template action "unlock").'); };
  // A template from what the dashboard has now: its theme (colours, fonts, chart palette, logo) and the footer text.
  Fm.fromDashboard = function (o) {
    o = o || {};
    var r = rt(), th = copy(r && r.state.theme) || null, cur = Fm.current() || {};
    if (th) { delete th.map; delete th.fontFiles; }
    return { $type: 'mothership/firm', v: 1, name: o.name || cur.name || (th && th.name) || 'Firm template', footer: o.footer != null ? o.footer : (cur.footer || ''), logo: o.logo || cur.logo || (th && th.logo) || '', theme: th, locked: o.locked !== false };
  };
  Fm.saved = function () { return MS.store.get('kv', 'firm').then(function (v) { return Array.isArray(v) ? v : []; }, function () { return []; }); };
  Fm.remember = function (t) {
    return Fm.saved().then(function (list) {
      list = list.filter(function (x) { return x.name !== t.name; }); list.unshift(copy(t));
      return MS.store.set('kv', 'firm', list.slice(0, 12));
    });
  };
  Fm.forget = function (name) { return Fm.saved().then(function (list) { return MS.store.set('kv', 'firm', list.filter(function (x) { return x.name !== name; })); }); };
  Fm.isTemplate = function (j) { return !!(j && (j.$type === 'mothership/firm' || j.kind === 'mothership-firm')); };
  // Snap the dashboard to a template: brand colours and fonts, chart palette, logo and footer; locked unless told otherwise.
  Fm.apply = function (t, opts) {
    if (!need()) return false;
    opts = opts || {};
    var lock = opts.lock != null ? !!opts.lock : t.locked !== false;
    Fm.applying = true;
    try {
      MS.history.group('Apply firm template "' + t.name + '"', function () {
        if (t.theme) {
          var th = MS.brand.normalize(Object.assign({ name: t.name }, copy(t.theme)), t.name);
          if (t.logo && !th.logo) th.logo = t.logo;
          MS.brand.apply(th);
        }
        MS.history.state('Firm template', function (s) {
          s.firm = { name: t.name, footer: t.footer || '', logo: t.logo || '', locked: lock, at: new Date().toISOString() };
          if (t.pw) s.firm.pw = copy(t.pw);
          if (t.theme) s.firm.palette = (s.theme && s.theme.palette || []).slice();
        });
      });
    } finally { Fm.applying = false; }
    Fm.remember(Object.assign({}, t, { $type: 'mothership/firm' }));
    MS.emit('firm'); if (MS.ribbon) MS.ribbon.render();
    MS.toast('Firm template "' + t.name + '" applied' + (lock ? ' and locked' : '') + '.', 'ok');
    return true;
  };
  Fm.setFooter = function (text) { if (!need()) return; MS.history.state('Firm footer', function (s) { s.firm = s.firm || { name: 'Firm' }; s.firm.footer = String(text || ''); }); };
  Fm.lock = function (on, password) {
    if (!need()) return Promise.resolve(false);
    var f = Fm.current();
    if (!f) { MS.toast('Apply a firm template first (Consulting › Firm template).', 'warn'); return Promise.resolve(false); }
    if (on) {
      var mk = password ? MS.publish.pbkdf2(password, 'firm:' + f.name, 100000).then(function (key) { return { salt: 'firm:' + f.name, iter: 100000, key: key }; }) : Promise.resolve(null);
      return mk.then(function (pw) { MS.history.state('Lock the brand', function (s) { s.firm.locked = true; if (pw) s.firm.pw = pw; }); MS.emit('firm'); return true; });
    }
    var check = f.pw ? MS.publish.pbkdf2(String(password || ''), f.pw.salt, f.pw.iter).then(function (k) { return k === f.pw.key; }) : Promise.resolve(true);
    return check.then(function (ok) {
      if (!ok) return false;
      MS.history.state('Unlock the brand', function (s) { s.firm.locked = false; delete s.firm.pw; });
      MS.emit('firm'); return true;
    });
  };
  Fm.remove = function () { if (!need()) return; MS.history.state('Remove firm template', function (s) { delete s.firm; }); MS.emit('firm'); };
  Fm.exportFile = function (t) { t = t || Fm.fromDashboard(); MS.download((t.name || 'firm').replace(/[^\w.-]+/g, '-') + '.firm.json', JSON.stringify(t, null, 2), 'application/json'); };
  Fm.importFile = function () {
    MS.pickFiles('.json').then(function (fs) {
      if (!fs || !fs[0]) return;
      MS.readFile(fs[0]).then(function (txt) {
        var j; try { j = JSON.parse(txt); } catch (e) { return MS.toast(fs[0].name + ' is not a firm template.', 'error'); }
        if (!Fm.isTemplate(j)) { if (j && (j.colors || j.palette)) j = { $type: 'mothership/firm', name: j.name || fs[0].name.replace(/\.json$/i, ''), theme: j, locked: true }; else return MS.toast(fs[0].name + ' is not a firm template.', 'error'); }
        Fm.apply(j);
      });
    });
  };
  // The dialog: pick a saved template, or make one from this dashboard, and lock or unlock it.
  Fm.dialog = function () {
    if (!need()) return;
    var f = Fm.current();
    Fm.saved().then(function (list) {
      var body = h('div', {});
      if (f) body.appendChild(h('div', { 'class': 'firm-now' }, [
        f.logo ? h('img', { src: f.logo, alt: '' }) : null,
        h('div', { 'class': 'grow' }, [h('strong', { text: f.name }), h('div', { 'class': 'muted small', text: f.locked ? '🔒 Locked: brand colours, fonts and chart colours can\'t be changed here.' : 'Unlocked: people can change colours and fonts.' })]),
        h('button', { 'class': 'btn sm', onclick: function () {
          if (f.locked) {
            (f.pw ? MS.prompt('Unlock the brand', '', 'The password set when it was locked') : Promise.resolve('')).then(function (pw) {
              if (pw === null) return;
              Fm.lock(false, pw).then(function (ok) { if (!ok) MS.toast('Wrong password.', 'error'); else { MS.toast('Brand unlocked.', 'ok'); close(); } });
            });
          } else Fm.lock(true).then(function () { MS.toast('Brand locked.', 'ok'); close(); });
        } }, [f.locked ? '🔓 Unlock' : '🔒 Lock'])]));
      var form = MS.form([
        { key: 'name', label: 'Template name', value: (f && f.name) || (rt().state.theme && rt().state.theme.name) || 'Our firm' },
        { key: 'footer', label: 'Disclaimer / footer on every page', type: 'textarea', rows: 2, value: (f && f.footer) || 'Prepared for the client’s internal use only. Not to be relied on by any third party.' },
        { key: 'lock', label: 'Lock the brand (colours, fonts and chart palette)', type: 'checkbox', value: f ? f.locked : true },
        { key: 'pw', label: 'Unlock password (optional)', type: 'password', placeholder: 'Leave empty for none' }
      ]);
      var logo = (f && f.logo) || (rt().state.theme && rt().state.theme.logo) || '';
      var logoImg = h('img', { 'class': 'firm-logo', src: logo || '', alt: '', hidden: !logo });
      var logoBtn = h('button', { 'class': 'btn sm', type: 'button', onclick: function () {
        MS.pickFiles('image/*').then(function (fs) { if (fs && fs[0]) MS.readFile(fs[0], 'dataurl').then(function (d) { return MS.importers && MS.importers.shrink ? MS.importers.shrink(d) : d; }).then(function (d) { logo = d; logoImg.src = d; logoImg.hidden = false; }); });
      } }, ['Choose logo…']);
      body.appendChild(h('div', { 'class': 'muted small', text: 'Uses the colours, fonts and chart palette this dashboard has now (Design › Load brand or Edit theme first).' }));
      body.appendChild(form);
      body.appendChild(h('div', { 'class': 'row gap' }, [h('span', { 'class': 'muted small', text: 'Logo' }), logoImg, logoBtn]));
      if (list.length) {
        body.appendChild(h('div', { 'class': 'muted small', style: { marginTop: '10px' }, text: 'Saved firm templates (one click snaps this dashboard to it)' }));
        body.appendChild(h('div', { 'class': 'list' }, list.map(function (t) {
          return h('div', { 'class': 'list-row' }, [t.logo ? h('img', { src: t.logo, alt: '', style: { height: '18px' } }) : h('span', { text: '🏢' }),
            h('span', { 'class': 'grow', text: t.name + (t.locked !== false ? ' 🔒' : '') }),
            h('span', { 'class': 'swatches mini' }, ((t.theme && t.theme.palette) || []).slice(0, 6).map(function (c) { return h('i', { style: { background: c } }); })),
            h('button', { 'class': 'btn sm primary', onclick: function () { Fm.apply(t); close(); } }, ['Apply']),
            h('button', { 'class': 'icon-btn', title: 'Save as a file to share with colleagues', onclick: function () { Fm.exportFile(t); } }, ['⬇']),
            h('button', { 'class': 'icon-btn', title: 'Forget', onclick: function (e) { Fm.forget(t.name); e.currentTarget.closest('.list-row').remove(); } }, ['🗑'])]);
        })));
      }
      var close = function () { var x = MS.$$('.dlg-wrap').pop(); if (x) x.querySelector('.dlg-x').click(); };
      MS.dialog({ title: '🏢 Firm template', sub: 'Logo, fonts, palette and disclaimer that every dashboard snaps to. Share it as a .firm.json file.', wide: true,
        body: body, buttons: [{ label: 'Open a template file…', value: 'import' }, { label: 'Remove', danger: true, value: 'remove' }, { label: 'Cancel', value: null }, { label: f ? 'Save and apply' : 'Make template from this dashboard', primary: true, value: function () { var v = form.values(); if (!v.name.trim()) { MS.dialogError('Give the template a name.'); return false; } return v; } }] }).then(function (v) {
        if (v === 'import') return Fm.importFile();
        if (v === 'remove') return Fm.remove();
        if (!v || typeof v !== 'object') return;
        var t = Fm.fromDashboard({ name: v.name.trim(), footer: v.footer, logo: logo, locked: v.lock });
        var go = v.pw && v.lock ? MS.publish.pbkdf2(v.pw, 'firm:' + t.name, 100000).then(function (key) { t.pw = { salt: 'firm:' + t.name, iter: 100000, key: key }; }) : Promise.resolve();
        go.then(function () { Fm.apply(t, { lock: v.lock }); });
      });
    });
  };
  // A dashboard without a firm template offers the last one used.
  MS.on('child-loaded', function () {
    setTimeout(function () {
      if (!rt() || Fm.current() || MS.prefs.get('firmOffer', true) === false) return;
      Fm.saved().then(function (list) {
        if (!list.length || !rt() || Fm.current()) return;
        MS.toast('Snap this dashboard to your firm template "' + list[0].name + '"?', '', 9000, { action: { label: 'Apply', run: function () { Fm.apply(list[0]); } } });
      });
    }, 1200);
  });

  /* ================================================================ stage stamp */
  var Sg = MS.stage = { LIST: [{ value: '', label: 'No stamp' }, { value: 'draft', label: 'Draft' }, { value: 'review', label: 'In review' }, { value: 'client', label: 'Client-ready' }] };
  Sg.get = function () { var r = rt(); return (r && r.state.stage) || ''; };
  Sg.label = function (v) { return (Sg.LIST.filter(function (x) { return x.value === (v == null ? Sg.get() : v); })[0] || Sg.LIST[0]).label; };
  // What stands in the way of "Client-ready": open comments, must-fix comments, charts without a source.
  Sg.blockers = function () {
    var r = rt(); if (!r) return [];
    var cs = (r.state.comments || []).filter(function (c) { return !c.done; }), out = [];
    var must = cs.filter(function (c) { return c.prio === 'must'; }).length;
    if (must) out.push(must + ' must-fix comment(s) still open');
    if (cs.length - must) out.push((cs.length - must) + ' other open comment(s)');
    var nosrc = MS.sources ? MS.sources.missing().length : 0;
    if (nosrc) out.push(nosrc + ' chart(s) without a source');
    return out;
  };
  Sg.set = function (v) {
    if (!need()) return;
    MS.history.state('Stage: ' + Sg.label(v), function (s) { if (v) s.stage = v; else delete s.stage; });
    MS.emit('stage'); if (MS.ribbon) MS.ribbon.render();
  };
  Sg.choose = function (v) {
    if (v !== 'client') return Sg.set(v);
    var b = Sg.blockers();
    if (!b.length) return Sg.set(v);
    MS.confirm('Mark as client-ready?', 'Still to sort out: ' + b.join('; ') + '. Mark it client-ready anyway?', 'Mark client-ready').then(function (ok) { if (ok) Sg.set(v); });
  };
  Sg.menuItems = function () { var cur = Sg.get(); return Sg.LIST.map(function (x) { return { label: (cur === x.value ? '● ' : '') + x.label, run: function () { Sg.choose(x.value); } }; }); };

  /* ================================================================ client confidential, and taking client names out */
  var Cf = MS.confidential = {};
  Cf.get = function () { var r = rt(); return r && r.state.confidential || null; };
  Cf.set = function (on, label, watermark) {
    if (!need()) return;
    MS.history.state(on ? 'Mark client confidential' : 'Remove confidential mark', function (s) {
      if (on) s.confidential = { on: true, label: label || 'Client confidential', watermark: watermark !== false };
      else delete s.confidential;
    });
    MS.emit('confidential'); if (MS.ribbon) MS.ribbon.render();
  };
  Cf.toggle = function () { var c = Cf.get(); Cf.set(!(c && c.on)); };
  function reEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function rx(from) { return new RegExp('(?<![A-Za-z0-9])' + reEsc(from) + '(?![A-Za-z0-9])', 'gi'); }
  function variants(from) { var v = [from], e = MS.esc(from); if (e !== from) v.push(e); var j = JSON.stringify(from).slice(1, -1); if (j !== from) v.push(j); return v; }
  // Replace names everywhere in a whole file: text, settings, data, comments and the page's own scripts (pictures are skipped).
  Cf.scrubHtml = function (html, pairs) {
    var keep = [];
    var out = html.replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, function (m) { keep.push(m); return '\u0000MSKEEP' + (keep.length - 1) + '\u0000'; });
    var counts = pairs.filter(function (p) { return p && String(p.from || '').trim(); }).map(function (p) {
      var n = 0, to = String(p.to == null ? '' : p.to);
      variants(String(p.from).trim()).forEach(function (f) { out = out.replace(rx(f), function () { n++; return f === MS.esc(p.from) ? MS.esc(to) : to; }); });
      return { from: String(p.from).trim(), to: to, n: n };
    });
    out = out.replace(/\u0000MSKEEP(\d+)\u0000/g, function (_, i) { return keep[+i]; });
    var left = counts.reduce(function (a, c) { var m = out.match(new RegExp(reEsc(c.from), 'gi')); return a + (m ? m.length : 0); }, 0);
    return { html: out, counts: counts, left: left };
  };
  Cf.count = function (pairs) { var html = MS.exportHtml(); return Cf.scrubHtml(html, pairs).counts; };
  // where: 'copy' gives back a scrubbed copy (this dashboard stays as it is); 'here' scrubs the open dashboard.
  Cf.scrub = function (pairs, where) {
    if (!MS.child) throw new Error('Nothing is open');
    var html = MS.exportHtml(), res = Cf.scrubHtml(html, pairs);
    if (where !== 'here') return Promise.resolve(res);
    var save = MS.versions && MS.versions.save ? Promise.resolve(MS.versions.save('Before client names were removed', true)).catch(function () {}) : Promise.resolve();
    return save.then(function () {
      return MS.openHtml(res.html, MS.doc.name, { folder: MS.doc.folder, unlocked: true }).then(function () { MS.audit.note('Removed client names (' + res.counts.map(function (c) { return c.n + '× → ' + (c.to || 'blank'); }).join(', ') + ')'); return res; });
    });
  };
  Cf.scrubDialog = function () {
    if (!MS.child) return MS.toast('Open a dashboard first.', 'warn');
    var rows = h('div', { 'class': 'scrub-rows' }), saved = MS.prefs.get('scrubNames', []) || [];
    function addRow(from, to) {
      var a = h('input', { 'class': 'inp', placeholder: 'Client or person name', value: from || '' }), b = h('input', { 'class': 'inp', placeholder: 'Replace with', value: to == null ? 'Client' : to });
      var n = h('span', { 'class': 'tag', text: '' });
      var row = h('div', { 'class': 'row gap scrub-row' }, [a, h('span', { text: '→' }), b, n, h('button', { 'class': 'icon-btn', title: 'Remove', onclick: function () { row.remove(); recount(); } }, ['✕'])]);
      a.addEventListener('input', recount);
      rows.appendChild(row);
    }
    function pairs() { return MS.$$('.scrub-row', rows).map(function (r) { var i = r.querySelectorAll('input'); return { from: i[0].value.trim(), to: i[1].value }; }).filter(function (p) { return p.from; }); }
    var recount = MS.debounce(function () {
      var ps = pairs(), html = MS.exportHtml(), c = Cf.scrubHtml(html, ps).counts;
      MS.$$('.scrub-row', rows).forEach(function (r) { var f = r.querySelector('input').value.trim(), x = c.filter(function (k) { return k.from === f; })[0]; var t = r.querySelector('.tag'); t.textContent = x ? x.n + ' found' : ''; t.className = 'tag' + (x && x.n ? ' warn' : ''); });
    }, 250);
    (saved.length ? saved : [{ from: '', to: 'Client' }]).forEach(function (p) { addRow(p.from, p.to); });
    recount();
    var where = MS.form([{ key: 'where', label: 'Then', type: 'select', options: [{ value: 'copy', label: 'Save a cleaned copy (this dashboard stays as it is)' }, { value: 'here', label: 'Clean this dashboard (a version is saved first)' }], value: 'copy' }]);
    MS.dialog({ title: '🕶 Remove client names', sub: 'Replaces each name in the text, chart labels, data, comments and settings. Pictures are not changed.', wide: true,
      body: h('div', {}, [rows, h('button', { 'class': 'btn sm', type: 'button', onclick: function () { addRow('', 'Client'); } }, ['＋ Add a name']), where]),
      buttons: [{ label: 'Cancel', value: null }, { label: 'Remove names', primary: true, value: function () { var p = pairs(); if (!p.length) { MS.dialogError('Type at least one name to remove.'); return false; } return { pairs: p, where: where.values().where }; } }] }).then(function (v) {
      if (!v) return;
      MS.prefs.set('scrubNames', v.pairs);
      Cf.scrub(v.pairs, v.where).then(function (res) {
        var total = res.counts.reduce(function (a, c) { return a + c.n; }, 0);
        if (v.where !== 'here') MS.download(MS.exportName('-cleaned'), res.html, 'text/html');
        MS.toast('Removed ' + total + ' mention(s)' + (res.left ? ', but ' + res.left + ' remain inside words or pictures: check them.' : '.') + (v.where === 'here' ? ' File › Versions has the copy from before.' : ' The cleaned copy is downloading.'), res.left ? 'warn' : 'ok', 8000);
      });
    });
  };

  /* ================================================================ change log, kept inside the file */
  var Au = MS.audit = { log: [] };
  Au.list = function () { return Au.log.slice(); };
  Au.note = function (what) {
    if (!MS.doc) return;
    var who = MS.prefs.get('author', '') || '', now = new Date(), last = Au.log[Au.log.length - 1];
    if (last && last.what === what && last.by === who && now - Date.parse(last.at) < 60000) { last.n = (last.n || 1) + 1; last.at = now.toISOString(); return; }
    Au.log.push({ at: now.toISOString(), by: who, what: String(what) });
    if (Au.log.length > 1000) Au.log.splice(0, Au.log.length - 1000);
  };
  MS.on('doc-opened', function () { var s = MS.doc && MS.doc.state; Au.log = s && Array.isArray(s.changeLog) ? s.changeLog.slice() : []; });
  MS.on('changed', function (label) { if (label) Au.note(label); });
  Au.csv = function () {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return ['When,Who,What,Times'].concat(Au.log.map(function (x) { return [x.at, x.by, x.what, x.n || 1].map(q).join(','); })).join('\n');
  };
  Au.dialog = function () {
    var fmt = function (t) { try { return new Date(t).toLocaleString(MS.locale ? MS.locale.get().locale : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return t; } };
    var q = h('input', { 'class': 'inp', placeholder: 'Filter: a word or a name' }), list = h('div', { 'class': 'audit-list' });
    function draw() {
      var k = q.value.trim().toLowerCase(), rows = Au.log.slice().reverse().filter(function (x) { return !k || (x.what + ' ' + x.by).toLowerCase().indexOf(k) >= 0; });
      list.innerHTML = '';
      if (!rows.length) list.appendChild(h('p', { 'class': 'muted', text: Au.log.length ? 'Nothing matches.' : 'No changes yet. Every change you make is listed here and saved inside the file.' }));
      rows.slice(0, 400).forEach(function (x) { list.appendChild(h('div', { 'class': 'audit-row' }, [h('span', { 'class': 'muted small', text: fmt(x.at) }), h('span', { 'class': 'audit-who', text: x.by || '—' }), h('span', { 'class': 'grow', text: x.what + (x.n > 1 ? ' (×' + x.n + ')' : '') })])); });
    }
    q.addEventListener('input', draw); draw();
    MS.dialog({ title: '🕘 Change log', sub: 'Who changed what, saved inside the dashboard file. Set your name in Comments › ⋯ › Change my name.', wide: true, body: h('div', {}, [q, list]),
      buttons: [{ label: 'Download CSV', value: 'csv' }, { label: 'Close', primary: true, value: null }] }).then(function (v) { if (v === 'csv') MS.download(MS.exportName('-changes').replace(/\.html$/, '.csv'), Au.csv(), 'text/csv'); });
  };

  /* ================================================================ colour-blind check */
  var Cv = MS.cvd = {};
  // Machado et al. (2009), full severity, in linear RGB
  var M = {
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]]
  };
  Cv.NAMES = { protan: 'red-blind (protanopia)', deutan: 'green-blind (deuteranopia)', tritan: 'blue-blind (tritanopia)' };
  Cv.SAFE = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000'];
  function rgb(c) {
    c = String(c || '').trim();
    var m = /^#([0-9a-f]{3,8})$/i.exec(c);
    if (m) { var x = m[1]; if (x.length <= 4) x = x.split('').map(function (k) { return k + k; }).join(''); return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16)]; }
    m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i.exec(c);
    if (m) return [+m[1], +m[2], +m[3]];
    return null;
  }
  function lin(v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function unlin(v) { v = Math.max(0, Math.min(1, v)); return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); }
  Cv.simulate = function (c, kind) {
    var p = rgb(c); if (!p) return null;
    var l = p.map(lin), m = M[kind];
    return m.map(function (row) { return unlin(row[0] * l[0] + row[1] * l[1] + row[2] * l[2]); });
  };
  function lab(p) {
    var r = lin(p[0]), g = lin(p[1]), b = lin(p[2]);
    var x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    var f = function (t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; };
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  Cv.distance = function (a, b) { var A = lab(a), B = lab(b); return Math.sqrt(Math.pow(A[0] - B[0], 2) + Math.pow(A[1] - B[1], 2) + Math.pow(A[2] - B[2], 2)); };
  // Pairs of colours in one chart that look alike to colour-blind readers (but not to others).
  Cv.check = function (limit) {
    var r = rt(); if (!r) return [];
    limit = limit || 11;
    var out = [];
    r.charts().forEach(function (c) {
      var cols = r.chartColors(c.key), names = Object.keys(cols).slice(0, 12), info = r.chartInfo(c.key) || {};
      for (var i = 0; i < names.length; i++) for (var j = i + 1; j < names.length; j++) {
        var a = rgb(cols[names[i]]), b = rgb(cols[names[j]]); if (!a || !b) continue;
        if (Cv.distance(a, b) < limit) continue; // alike for everyone: not a colour-blind problem
        Object.keys(M).forEach(function (k) {
          var d = Cv.distance(Cv.simulate(cols[names[i]], k), Cv.simulate(cols[names[j]], k));
          if (d < limit) out.push({ chart: c.key, title: info.title || c.key, a: names[i], b: names[j], colors: [cols[names[i]], cols[names[j]]], kind: k, who: Cv.NAMES[k], distance: Math.round(d * 10) / 10 });
        });
      }
    });
    // one line per pair (the worst kind)
    var seen = {};
    return out.sort(function (x, y) { return x.distance - y.distance; }).filter(function (x) { var k = x.chart + '|' + x.a + '|' + x.b; if (seen[k]) return false; seen[k] = 1; return true; });
  };
  // Use a palette that colour-blind readers can tell apart (Okabe and Ito).
  Cv.fix = function () {
    if (!need() || Fm.blocks('the chart palette')) return false;
    MS.history.state('Colour-blind safe palette', function (s) {
      s.theme = s.theme || MS.brand.normalize({ name: 'Custom' }, 'cvd');
      s.theme.palette = Cv.SAFE.slice(); s.theme.chartsFollowTheme = true;
      var L = s.layout.colors || {}, names = Object.keys(L);
      names.forEach(function (n, i) { L[n] = Cv.SAFE[i % Cv.SAFE.length]; });
    });
    return true;
  };
  // See the dashboard as a colour-blind reader would (editor only; nothing is saved).
  Cv.preview = function (kind) {
    var d = MS.child && MS.child.doc; if (!d) return;
    var old = d.getElementById('ms-cvd'); if (old) old.remove();
    var oldF = d.getElementById('ms-cvd-css'); if (oldF) oldF.remove();
    Cv.previewing = kind || null;
    if (!kind) { MS.emit('cvd'); return; }
    var m = M[kind], mat = m.map(function (r) { return r.join(' ') + ' 0 0'; }).join(' ') + ' 0 0 0 1 0';
    var wrap = d.createElement('div'); wrap.id = 'ms-cvd'; wrap.setAttribute('data-ms-editor', ''); wrap.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    wrap.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><filter id="ms-cvd-f" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="' + mat + '"/></filter></svg>';
    d.body.appendChild(wrap);
    var st = d.createElement('style'); st.id = 'ms-cvd-css'; st.setAttribute('data-ms-editor', ''); st.textContent = 'html{filter:url(#ms-cvd-f)!important}';
    d.head.appendChild(st);
    MS.emit('cvd');
  };
  MS.on('child-loaded', function () { Cv.previewing = null; });
})(window.MS);
