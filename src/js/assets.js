/* Read-only dependency scan and responsive image parsing, shared by import and export checks. */
(function (MS) {
  'use strict';
  var A = MS.assets = {};

  // A srcset URL runs to whitespace, not to the first comma (data URLs contain commas).
  A.srcset = function (value) {
    var text = String(value || ''), out = [], i = 0;
    while (i < text.length) {
      while (i < text.length && /[\s,]/.test(text[i])) i++;
      var start = i;
      while (i < text.length && !/\s/.test(text[i])) i++;
      var url = text.slice(start, i), descriptors = '';
      if (/,$/.test(url)) url = url.replace(/,+$/, '');
      else {
        start = i;
        var depth = 0;
        while (i < text.length && (text[i] !== ',' || depth)) {
          if (text[i] === '(') depth++;
          else if (text[i] === ')' && depth) depth--;
          i++;
        }
        descriptors = text.slice(start, i).trim();
      }
      if (url) out.push({ url: url, descriptor: descriptors });
    }
    return out;
  };
  A.cssURLs = function (css, fn) {
    return String(css || '').replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)|@import\s+(?:"([^"]*)"|'([^']*)')/gi, function (m, a, b, c, d, e) {
      var isImport = d != null || e != null;
      return fn(a || b || c || d || e || '', m, isImport) || m;
    });
  };
  A.scan = function (doc) {
    var refs = { relative: [], external: [], local: [], modules: 0, frames: 0 };
    function note(url) {
      url = String(url || '').trim();
      if (!url || /^(?:#|data:|blob:|about:)/i.test(url)) return;
      var key = /^(?:https?:|\/\/)/i.test(url) ? 'external' : /^file:|^\//i.test(url) ? 'local' : /^[\w+.-]+:/i.test(url) ? 'external' : 'relative';
      if (refs[key].indexOf(url) < 0) refs[key].push(url);
    }
    MS.$$('script[src], img[src], source[src], video[src], audio[src], track[src], iframe[src], embed[src], input[src], video[poster], object[data], link[href], svg image, [srcset], link[imagesrcset], [style], style', doc).forEach(function (el) {
      if (el.closest('[data-ms-editor]')) return;
      var tag = el.tagName.toLowerCase();
      ['src', 'poster', 'data'].forEach(function (key) { note(el.getAttribute(key)); });
      if (tag === 'link' && /(?:stylesheet|icon|preload|modulepreload|manifest|prefetch)/i.test(el.rel || '')) note(el.getAttribute('href'));
      if (tag === 'image') note(el.getAttribute('href') || el.getAttribute('xlink:href'));
      ['srcset', 'imagesrcset'].forEach(function (key) { A.srcset(el.getAttribute(key)).forEach(function (item) { note(item.url); }); });
      if (el.hasAttribute('style')) A.cssURLs(el.getAttribute('style'), note);
      if (tag === 'style') A.cssURLs(el.textContent, note);
    });
    refs.modules = MS.$$('script[type="module"]', doc).length;
    refs.frames = MS.$$('iframe, object, embed', doc).length;
    return refs;
  };
})(window.MS);
