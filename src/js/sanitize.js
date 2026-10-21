/* HTML sanitizer for imported content (markdown, Word, PowerPoint...). Removes
   scripts, event handlers, javascript: URLs, iframes and forms. */
(function (MS) {
  'use strict';
  var DROP = /^(script|iframe|object|embed|form|input|button|textarea|select|link|meta|base|frame|frameset|applet|noscript|template)$/i;
  var URL_ATTR = /^(href|src|xlink:href|action|formaction|poster|background)$/i;
  MS.sanitize = function (html) {
    var doc = new DOMParser().parseFromString('<!doctype html><body>' + html, 'text/html');
    (function walk(n) {
      Array.prototype.slice.call(n.children).forEach(function (c) {
        if (DROP.test(c.tagName)) { c.remove(); return; }
        Array.prototype.slice.call(c.attributes).forEach(function (a) {
          var name = a.name.toLowerCase(), v = (a.value || '').trim().toLowerCase();
          if (name.indexOf('on') === 0 || name === 'srcdoc' || name.indexOf('data-ms-') === 0) c.removeAttribute(a.name);
          else if (URL_ATTR.test(name) && (v.indexOf('javascript:') === 0 || v.indexOf('vbscript:') === 0 || (v.indexOf('data:') === 0 && v.indexOf('data:image/') !== 0))) c.removeAttribute(a.name);
          else if (name === 'style' && /expression\(|javascript:|url\(\s*['"]?\s*javascript/i.test(a.value)) c.removeAttribute(a.name);
        });
        if (c.tagName === 'A') { c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener noreferrer'); }
        walk(c);
      });
    })(doc.body);
    return doc.body.innerHTML;
  };
})(window.MS);
