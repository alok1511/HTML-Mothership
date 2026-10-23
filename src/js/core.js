/* Mothership core: namespace, event bus, DOM helpers, dialogs, storage. */
window.MS = window.MS || {};
(function (MS) {
  'use strict';

  /* ---------- event bus ---------- */
  var handlers = {};
  MS.on = function (ev, fn) { (handlers[ev] = handlers[ev] || []).push(fn); return function () { var a = handlers[ev], i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; };
  MS.emit = function (ev, data) { (handlers[ev] || []).slice().forEach(function (fn) { try { fn(data); } catch (e) { console.error(e); } }); };

  /* ---------- dom ---------- */
  MS.$ = function (s, root) { return (root || document).querySelector(s); };
  MS.$$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  MS.h = function (tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    [].concat(kids || []).forEach(function (c) { if (c !== null && c !== undefined && c !== false) e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); });
    return e;
  };
  MS.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  MS.uid = function (p) { return (p || 'x') + Math.random().toString(36).slice(2, 9); };
  MS.debounce = function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; };
  MS.bytes = function (n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; };

  /* ---------- files ---------- */
  MS.readFile = function (file, as) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
      if (as === 'buffer') r.readAsArrayBuffer(file);
      else if (as === 'dataurl') r.readAsDataURL(file);
      else r.readAsText(file);
    });
  };
  MS.pickFiles = function (accept, opts) {
    opts = opts || {};
    return new Promise(function (res) {
      var inp = MS.h('input', { type: 'file', accept: accept || '', style: { display: 'none' } });
      if (opts.multiple) inp.multiple = true;
      if (opts.folder) { inp.webkitdirectory = true; inp.multiple = true; }
      inp.addEventListener('change', function () { res(Array.prototype.slice.call(inp.files || [])); inp.remove(); });
      document.body.appendChild(inp);
      inp.click();
    });
  };
  MS.download = function (name, content, type) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: type || 'text/html;charset=utf-8' });
    var a = MS.h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  MS.ext = function (name) { var m = /\.([^.]+)$/.exec(name || ''); return m ? m[1].toLowerCase() : ''; };

  /* ---------- toast ---------- */
  // MS.toast(msg, kind, ms, {action: {label, run}}): hover keeps it open, ✕ closes it.
  MS.toast = function (msg, kind, ms, opt) {
    var host = MS.$('#toasts'); if (!host) return;
    var old = MS.$$('.toast', host); if (old.length > 3) old.slice(0, old.length - 3).forEach(function (x) { x.remove(); });
    var timer, gone = false;
    var close = function () { if (gone) return; gone = true; clearTimeout(timer); t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); };
    var act = opt && opt.action ? MS.h('button', { 'class': 'toast-act', onclick: function () { close(); opt.action.run(); } }, [opt.action.label]) : null;
    var t = MS.h('div', { 'class': 'toast ' + (kind || ''), role: kind === 'error' ? 'alert' : 'status' }, [MS.icon ? MS.icon({ ok: 'checkCircle', warn: 'warning', error: 'xCircle' }[kind] || 'info') : null, MS.h('div', { 'class': 'grow' }, [msg]), act,
      MS.h('button', { 'class': 'toast-x', title: 'Close', 'aria-label': 'Close', onclick: close }, ['✕'])]);
    host.appendChild(t);
    var life = ms || (kind === 'error' ? 6000 : act ? 6000 : 3200);
    var arm = function () { clearTimeout(timer); timer = setTimeout(close, life); };
    t.addEventListener('mouseenter', function () { clearTimeout(timer); }); t.addEventListener('mouseleave', function () { life = 1500; arm(); });
    arm();
    return { close: close };
  };
  MS.status = function (msg) { var s = MS.$('#status-msg'); if (s) s.textContent = msg; };

  /* ---------- dialogs ---------- */
  // MS.dialog({title, sub, body: Node|string, buttons:[{label, value, primary, danger}], wide, enterSubmits}) -> Promise<value|null>
  // A button whose value function returns false keeps the dialog open; MS.dialogError(msg) explains why.
  MS.dialog = function (o) {
    return new Promise(function (resolve) {
      var back = document.activeElement;
      var wrap = MS.h('div', { 'class': 'dlg-wrap' });
      var body = typeof o.body === 'string' ? MS.h('div', { html: o.body }) : (o.body || MS.h('div'));
      var close = function (v) {
        document.removeEventListener('keydown', key, true);
        wrap.remove();
        try { if (back && back.focus && back.isConnected && !MS.$('.dlg-wrap')) back.focus(); } catch (e) {}
        resolve(v);
      };
      var btns = (o.buttons || [{ label: 'Cancel', value: null }, { label: 'OK', value: true, primary: true }]).map(function (b) {
        return MS.h('button', { 'class': 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : ''), onclick: function () {
          var v = typeof b.value === 'function' ? b.value() : b.value;
          if (v === false) { if (!err.textContent) shake(); return; } // validation failed, keep open
          close(v);
        } }, [b.label]);
      });
      var err = MS.h('div', { 'class': 'dlg-err', role: 'alert', hidden: true });
      var primary = btns.filter(function (b) { return b.classList.contains('primary'); })[0];
      var hint = primary && o.enterSubmits !== false && !btns.some(function (b) { return b.classList.contains('danger') && !b.classList.contains('primary'); }) ? MS.h('span', { 'class': 'dlg-hint' }, [MS.h('kbd', { text: 'Enter' }), ' ' + primary.textContent.trim() + ' · ', MS.h('kbd', { text: 'Esc' }), ' close']) : null;
      var peek = MS.h('button', { 'class': 'icon-btn dlg-peek', title: 'Hold to see the dashboard behind this window', 'aria-label': 'See behind' }, ['👁']);
      var head = MS.h('div', { 'class': 'dlg-head' }, [MS.h('div', { 'class': 'grow' }, [MS.h('strong', { text: o.title || '' }), o.sub ? MS.h('div', { 'class': 'dlg-sub', text: o.sub }) : null]),
        MS.h('button', { 'class': 'icon-btn dlg-x', title: 'Close (Esc)', 'aria-label': 'Close', onclick: function () { close(null); } }, ['✕']), peek]);
      var dlg = MS.h('div', { 'class': 'dlg' + (o.wide ? ' wide' : '') + (o.xwide ? ' xwide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Dialog' }, [
        head, MS.h('div', { 'class': 'dlg-body' }, [err, body]), MS.h('div', { 'class': 'dlg-foot' }, (hint ? [hint] : []).concat(btns))
      ]);
      dlg.__err = err;
      function shake() { dlg.classList.remove('shake'); void dlg.offsetWidth; dlg.classList.add('shake'); }
      function key(e) {
        if (wrap !== MS.$$('.dlg-wrap').pop()) return;
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(null); return; }
        if (e.key === 'Enter' && !/textarea|select|button/i.test(e.target.tagName) && o.enterSubmits !== false && primary) { e.preventDefault(); primary.click(); return; }
        if (e.key === 'Tab') {
          var f = MS.$$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),a[href]', dlg).filter(function (x) { return x.offsetParent !== null; });
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
          else if (!dlg.contains(document.activeElement)) { e.preventDefault(); f[0].focus(); }
        }
      }
      // drag the window by its title bar
      head.addEventListener('mousedown', function (e) {
        if (e.button !== 0 || e.target.closest('button,input,select')) return;
        e.preventDefault();
        var x0 = e.clientX, y0 = e.clientY, m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(dlg.style.transform || ''), dx = m ? +m[1] : 0, dy = m ? +m[2] : 0;
        var mv = function (ev) { dlg.style.transform = 'translate(' + (dx + ev.clientX - x0) + 'px, ' + (dy + ev.clientY - y0) + 'px)'; };
        var up = function () { document.removeEventListener('mousemove', mv, true); document.removeEventListener('mouseup', up, true); };
        document.addEventListener('mousemove', mv, true); document.addEventListener('mouseup', up, true);
      });
      var unpeek = function () { wrap.classList.remove('peek'); document.removeEventListener('mouseup', unpeek, true); };
      peek.addEventListener('mousedown', function (e) { e.preventDefault(); wrap.classList.add('peek'); document.addEventListener('mouseup', unpeek, true); });
      document.addEventListener('keydown', key, true);
      wrap.appendChild(dlg);
      var downOnWrap = false;
      wrap.addEventListener('mousedown', function (e) { downOnWrap = e.target === wrap; });
      wrap.addEventListener('mouseup', function (e) { if (downOnWrap && e.target === wrap) close(null); downOnWrap = false; });
      document.body.appendChild(wrap);
      var f = dlg.querySelector('.dlg-body input:not([type=checkbox]):not([type=color]),.dlg-body select,.dlg-body textarea') || primary;
      if (f) setTimeout(function () { f.focus(); if (f.select && f.tagName === 'INPUT') f.select(); }, 30);
    });
  };
  // Show (or clear, with '') a message at the top of the open dialog.
  MS.dialogError = function (msg) {
    var d = MS.$$('.dlg-wrap .dlg').pop(); if (!d || !d.__err) return msg ? MS.toast(msg, 'warn') : null;
    d.__err.textContent = msg || ''; d.__err.hidden = !msg;
    if (msg) { d.classList.remove('shake'); void d.offsetWidth; d.classList.add('shake'); }
  };
  MS.prompt = function (title, value, label) {
    var inp = MS.h('input', { type: 'text', 'class': 'inp', value: value || '' });
    return MS.dialog({ title: title, body: MS.h('label', { 'class': 'field' }, [label ? MS.h('span', { text: label }) : null, inp]),
      buttons: [{ label: 'Cancel', value: null }, { label: 'OK', primary: true, value: function () { return inp.value; } }] });
  };
  MS.confirm = function (title, msg, okLabel, danger) {
    return MS.dialog({ title: (danger ? '⚠ ' : '') + title, body: MS.h('p', { 'class': 'dlg-msg', text: msg }), buttons: [{ label: 'Cancel', value: false }, { label: okLabel || 'OK', value: true, primary: true, danger: danger }] })
      .then(function (v) { return !!v; });
  };
  // Simple form builder: fields [{key,label,type:'text'|'number'|'select'|'textarea'|'checkbox'|'color', options:[{value,label}], value, hint}]
  MS.form = function (fields, onChange) {
    var root = MS.h('div', { 'class': 'form' }), inputs = {};
    fields.forEach(function (f) {
      var inp;
      if (f.type === 'select') {
        inp = MS.h('select', { 'class': 'inp' }, (f.options || []).map(function (o) { o = typeof o === 'object' ? o : { value: o, label: o }; var op = MS.h('option', { value: o.value, text: o.label }); if (String(f.value) === String(o.value)) op.selected = true; return op; }));
        if (f.multiple) { inp.multiple = true; inp.size = Math.min(8, (f.options || []).length); Array.prototype.forEach.call(inp.options, function (op) { op.selected = (f.value || []).indexOf(op.value) >= 0; }); }
      } else if (f.type === 'textarea') inp = MS.h('textarea', { 'class': 'inp', rows: f.rows || 4, value: f.value || '' });
      else if (f.type === 'checkbox') inp = MS.h('input', { type: 'checkbox', checked: !!f.value });
      else inp = MS.h('input', { type: f.type || 'text', 'class': 'inp', value: f.value == null ? '' : f.value, placeholder: f.placeholder || '', min: f.min, max: f.max, step: f.step });
      inputs[f.key] = inp;
      if (onChange) inp.addEventListener(f.type === 'text' || f.type === 'textarea' ? 'input' : 'change', function () { onChange(f.key, read(f.key), inputs); });
      var lab = f.type === 'checkbox'
        ? MS.h('label', { 'class': 'field check' }, [inp, MS.h('span', { text: f.label })])
        : MS.h('label', { 'class': 'field' }, [MS.h('span', { text: f.label }), inp]);
      if (f.hint) lab.appendChild(MS.h('small', { 'class': 'hint', html: f.hint }));
      if (f.hidden) lab.style.display = 'none';
      root.appendChild(lab);
    });
    function read(k) {
      var i = inputs[k];
      if (i.type === 'checkbox') return i.checked;
      if (i.multiple) return Array.prototype.filter.call(i.options, function (o) { return o.selected; }).map(function (o) { return o.value; });
      if (i.type === 'number') return i.value === '' ? null : Number(i.value);
      return i.value;
    }
    root.values = function () { var o = {}; Object.keys(inputs).forEach(function (k) { o[k] = read(k); }); return o; };
    root.inputs = inputs;
    return root;
  };

  /* ---------- IndexedDB key/value (works from file:// in Chromium & Firefox) ---------- */
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('mothership', 1);
      r.onupgradeneeded = function () { ['kv', 'versions', 'plugins'].forEach(function (s) { if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), s = t.objectStore(store), out = fn(s);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  MS.store = {
    get: function (store, key) { return tx(store, 'readonly', function (s) { return s.get(key); }); },
    set: function (store, key, val) { return tx(store, 'readwrite', function (s) { s.put(val, key); }); },
    del: function (store, key) { return tx(store, 'readwrite', function (s) { s.delete(key); }); },
    all: function (store) {
      return db().then(function (d) {
        return new Promise(function (res, rej) {
          var out = [], t = d.transaction(store, 'readonly'), c = t.objectStore(store).openCursor();
          c.onsuccess = function () { var cur = c.result; if (cur) { out.push({ key: cur.key, value: cur.value }); cur.continue(); } };
          t.oncomplete = function () { res(out); }; t.onerror = function () { rej(t.error); };
        });
      });
    }
  };
  MS.prefs = {
    get: function (k, d) { try { var v = localStorage.getItem('ms.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('ms.' + k, JSON.stringify(v)); } catch (e) {} }
  };
})(window.MS);
