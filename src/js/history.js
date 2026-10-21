/* Undo / redo. Every edit goes through MS.history.push({label, undo, redo}). */
(function (MS) {
  'use strict';
  var undo = [], redo = [], LIMIT = 200;
  MS.history = {
    push: function (op, alreadyDone) {
      if (!alreadyDone) op.redo();
      undo.push(op); if (undo.length > LIMIT) undo.shift();
      redo = [];
      MS.emit('changed', op.label);
    },
    undo: function () {
      var op = undo.pop(); if (!op) return MS.toast('Nothing to undo');
      try { op.undo(); } catch (e) { console.error(e); MS.toast('Undo failed: ' + e.message, 'error'); }
      redo.push(op); MS.emit('changed', 'Undo ' + op.label); MS.status('Undid: ' + op.label);
    },
    redo: function () {
      var op = redo.pop(); if (!op) return MS.toast('Nothing to redo');
      try { op.redo(); } catch (e) { console.error(e); MS.toast('Redo failed: ' + e.message, 'error'); }
      undo.push(op); MS.emit('changed', 'Redo ' + op.label); MS.status('Redid: ' + op.label);
    },
    clear: function () { undo = []; redo = []; MS.emit('history'); },
    canUndo: function () { return undo.length > 0; },
    canRedo: function () { return redo.length > 0; },
    labels: function () { return undo.map(function (o) { return o.label; }); },

    /* Helpers for common kinds of change. */
    // Change runtime state (theme, charts, filters...). fn mutates rt.state.
    state: function (label, fn) {
      var rt = MS.rt(); if (!rt) return;
      var before = JSON.stringify(rt.state);
      fn(rt.state, rt);
      var after = JSON.stringify(rt.state);
      if (before === after) { rt.refresh(true); return; }
      rt.refresh(true);
      MS.history.push({ label: label,
        undo: function () { MS.rt().setState(JSON.parse(before)); MS.emit('structure'); },
        redo: function () { MS.rt().setState(JSON.parse(after)); MS.emit('structure'); } }, true);
    },
    // Change attributes / inline style of an element (snapshots the given attributes).
    attrs: function (label, el, names, fn) {
      var snap = function () { var o = {}; names.forEach(function (n) { o[n] = el.getAttribute(n); }); return o; };
      var put = function (o) { names.forEach(function (n) { if (o[n] === null) el.removeAttribute(n); else el.setAttribute(n, o[n]); }); MS.afterDomChange(el); };
      var before = snap(); fn(el); var after = snap();
      if (JSON.stringify(before) === JSON.stringify(after)) return;
      MS.afterDomChange(el);
      MS.history.push({ label: label, undo: function () { put(before); }, redo: function () { put(after); } }, true);
    },
    // Move/insert/remove a node. fn performs the change; we record the position before and after.
    move: function (label, node, fn) {
      var pos = function () { return { p: node.parentNode, n: node.nextSibling }; };
      var put = function (o) { if (o.p) o.p.insertBefore(node, o.n && o.n.parentNode === o.p ? o.n : null); else if (node.parentNode) node.parentNode.removeChild(node); MS.afterDomChange(node); };
      var before = pos(); fn(); var after = pos();
      MS.afterDomChange(node);
      MS.history.push({ label: label, undo: function () { put(before); }, redo: function () { put(after); } }, true);
    },
    // Group several operations (recorded inside fn) into one undo step.
    group: function (label, fn) {
      var start = undo.length;
      fn();
      var ops = undo.splice(start);
      if (!ops.length) return;
      MS.history.push({ label: label,
        undo: function () { ops.slice().reverse().forEach(function (o) { o.undo(); }); },
        redo: function () { ops.forEach(function (o) { o.redo(); }); } }, true);
    }
  };
  // Called after any DOM change so the runtime can resize/re-apply and panels refresh.
  MS.afterDomChange = MS.debounce(function () {
    var rt = MS.rt(); if (rt) rt.refresh();
    MS.emit('structure');
  }, 30);
})(window.MS);
