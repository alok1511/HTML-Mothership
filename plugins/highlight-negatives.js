/*
 * Example Mothership plugin.
 * Install: Plugins › Load plugin › choose this file. It is remembered for next time.
 *
 * A plugin calls Mothership.registerPlugin({...}). The `api` object it receives gives access to:
 *   api.child()      -> { win, doc, rt }   the open dashboard (window, document, Mothership runtime)
 *   api.selection()  -> the selected element
 *   api.state(label, fn)  change runtime state (theme, charts, filters) with undo
 *   api.history      undo/redo helpers (push, attrs, move, group)
 *   api.toast, api.dialog, api.form, api.prompt, api.confirm, api.h (DOM helper)
 *   api.tabs, api.blocks, api.insert, api.charts, api.data, api.brand, api.edit
 *   api.exportHtml() -> the standalone HTML string
 */
Mothership.registerPlugin({
  id: 'highlight-negatives',
  name: 'Number tools',
  description: 'Small helpers for numbers in tables and KPI cards',
  buttons: [
    {
      icon: '➖',
      label: 'Negatives red',
      title: 'Colour every negative number (e.g. -12.5 or (1,200)) red',
      run: function (api) {
        var c = api.child(); if (!c) return api.toast('Open a dashboard first.');
        var re = /^\s*(-|−|\()\s*[₹$]?\s*[\d,.]+\s*(%|cr|l|k|m)?\)?\s*$/i, n = 0;
        api.history.group('Highlight negatives', function () {
          c.doc.querySelectorAll('td, th, span, div, p').forEach(function (el) {
            if (el.children.length || !re.test(el.textContent)) return;
            api.edit.style(el, { color: '#dc2626' }, 'Negative red');
            n++;
          });
        });
        api.toast(n + ' negative number(s) highlighted. Ctrl+Z undoes.', 'ok');
      }
    },
    {
      icon: '🕒',
      label: 'Stamp date',
      title: 'Add an "As of <date>" line under the first heading',
      run: function (api) {
        var c = api.child(); if (!c) return;
        var h = c.doc.querySelector('h1, h2'); if (!h) return api.toast('No heading found.');
        var p = c.doc.createElement('p');
        p.setAttribute('data-ms-own', '');
        p.style.cssText = 'margin:4px 0 0;font-size:12px;opacity:.75';
        p.textContent = 'As of ' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
        api.history.move('Add date stamp', p, function () { h.parentNode.insertBefore(p, h.nextSibling); });
      }
    }
  ],
  onChildLoaded: function (api) { /* runs every time a dashboard opens */ }
});
