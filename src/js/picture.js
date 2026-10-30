/* A picture of a chart or any part (with its title, notes and shapes): copy it to the clipboard
   to paste into PowerPoint, Word, Outlook or Teams, or save it as a PNG. Drawn by the browser
   itself, offline; if that fails, the chart's own image is used. */
(function (MS) {
  'use strict';
  var Pc = MS.picture = {};
  function rt() { return MS.rt(); }
  // What to picture: the chart's card for a chart, else the part itself.
  Pc.target = function (el) {
    el = el || MS.sel; if (!el) return null;
    if (typeof el === 'string') { var r = rt(), c = r && r.chart(el); return c ? MS.clipboard.unitOf(c.el) : null; }
    return MS.clipboard ? (MS.clipboard.unitOf(el) || el) : el;
  };
  function nameOf(node) {
    var r = rt(), c = r && r.charts().filter(function (x) { return node === x.el || node.contains(x.el); })[0];
    var t = c ? MS.charts.nameOf(c.key) : ((node.querySelector && node.querySelector('h1,h2,h3,h4')) || node).textContent;
    return String(t || 'picture').replace(/\s+/g, ' ').trim().slice(0, 60).replace(/[^\w\- ]+/g, '').trim() || 'picture';
  }
  // Keep the notes and shapes where they sit on the chart.
  function fixLayers(node, clone) {
    var org = MS.$$('.ms-annot-layer', node), cl = MS.$$('.ms-annot-layer', clone), nr = node.getBoundingClientRect(), moved = false;
    org.forEach(function (L, i) {
      var c = cl[i]; if (!c) return;
      var op = L.offsetParent;
      if (op && node.contains(op) && op !== node) return;
      var r = L.getBoundingClientRect();
      c.style.left = (r.left - nr.left) + 'px'; c.style.top = (r.top - nr.top) + 'px'; moved = true;
    });
    if (moved) { clone.style.position = 'relative'; }
  }
  // → Promise of {blob, dataUrl, width, height}
  Pc.make = function (el, opts) {
    opts = opts || {};
    var node = Pc.target(el); if (!node) return Promise.reject(new Error('Select a chart or a part of the dashboard first.'));
    var r = rt(), w = Math.ceil(node.getBoundingClientRect().width) + 16;
    var clone = MS.deliver.staticClone(node); fixLayers(node, clone);
    clone.style.margin = '0';
    return MS.deliver.picture(clone.outerHTML, Math.max(120, w), opts.scale || 2).then(function (p) {
      if (p) return p;
      var c = r && r.charts().filter(function (x) { return node === x.el || node.contains(x.el); })[0];
      if (!c) throw new Error('The browser could not draw this part as a picture.');
      return r.chartImage(c.key).then(function (src) { return { src: src }; });
    }).then(function (p) {
      return fetch(p.src).then(function (x) { return x.blob(); }).then(function (b) { return { blob: b, dataUrl: p.src, width: p.w, height: p.h, name: nameOf(node) }; });
    });
  };
  Pc.copy = function (el) {
    var t = MS.toast('Making the picture…', '', 8000);
    return Pc.make(el).then(function (p) {
      t.close();
      // the clipboard of whichever window has the focus (the dashboard's, after a right-click in it)
      var win = !document.hasFocus() && MS.child && MS.child.win.document.hasFocus() ? MS.child.win : window;
      var cb = win.navigator.clipboard, Item = win.ClipboardItem;
      if (!cb || !cb.write || !Item) throw Object.assign(new Error('no clipboard'), { pic: p });
      return cb.write([new Item({ 'image/png': p.blob })]).then(function () {
        MS.toast('Copied as a picture. Paste it into PowerPoint, Word, Outlook or Teams (Ctrl+V).', 'ok', 4500, { action: { label: 'Save PNG', run: function () { MS.download(p.name + '.png', p.blob); } } });
        return p;
      }, function (e) { throw Object.assign(e, { pic: p }); });
    }).catch(function (e) {
      t.close();
      if (e.pic) { MS.download(e.pic.name + '.png', e.pic.blob); MS.toast('This browser would not put pictures on the clipboard, so the picture is saved as a PNG instead.', 'warn', 6000); return e.pic; }
      MS.toast(e.message, 'error');
    });
  };
  Pc.save = function (el) {
    return Pc.make(el).then(function (p) { MS.download(p.name + '.png', p.blob); MS.toast('Saved "' + p.name + '.png".', 'ok'); return p; }, function (e) { MS.toast(e.message, 'error'); });
  };
  MS.api.add('chart_picture', { d: 'A picture (PNG) of a chart card or any part, with its title, notes and shapes, as PowerPoint gets it from "Copy as picture". Returns a data URL; the MCP chart_image / ui_screenshot tools save files.', p: { chart: ['string', 'Chart name or key'], ref: ['string', 'Or an element ref / selector'], scale: ['number', 'Sharpness, 1 to 3 (default 2)'] },
    f: function (a) { var el = a.ref ? MS.api.elOf(a.ref) : MS.rt().chart(MS.api.chartKey(a.chart)).el; return Pc.make(el, { scale: Math.max(1, Math.min(3, +a.scale || 2)) }).then(function (p) { return { name: p.name, width: p.width, height: p.height, dataUrl: p.dataUrl }; }); } });
})(window.MS);
