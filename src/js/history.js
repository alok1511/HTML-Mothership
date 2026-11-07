/* Undo / redo. Every edit goes through MS.history.push({label, undo, redo}). */
(function (MS) {
  'use strict';
  var undo = [], redo = [], LIMIT = 200;
  function validationState() { var rt = MS.rt && MS.rt(); return rt ? rt.state : MS.doc && MS.doc.state; }
  function revision() { var s = validationState(); return s && s.validationRevision; }
  function changed(op, label, before) {
    var s = validationState();
    if (s) {
      if (op.validationNeutral) {
        if (before) s.validationRevision = before;
      } else if (MS.doc && MS.doc.session) {
        s.validationRevision = MS.doc.session.id + ':' + (MS.doc.session.revision + 1);
      }
    }
    MS.emit('changed', label);
  }
  MS.history = {
    push: function (op, alreadyDone) {
      var before = revision();
      if (!alreadyDone) op.redo();
      undo.push(op); if (undo.length > LIMIT) undo.shift();
      redo = [];
      changed(op, op.label, before);
    },
    undo: function () {
      var op = undo.pop(); if (!op) return MS.toast('Nothing to undo');
      var before = revision();
      try { op.undo(); } catch (e) { console.error(e); MS.toast('Undo failed: ' + e.message, 'error'); }
      redo.push(op); changed(op, 'Undo ' + op.label, before); MS.status('Undid: ' + op.label);
    },
    redo: function () {
      var op = redo.pop(); if (!op) return MS.toast('Nothing to redo');
      var before = revision();
      try { op.redo(); } catch (e) { console.error(e); MS.toast('Redo failed: ' + e.message, 'error'); }
      undo.push(op); changed(op, 'Redo ' + op.label, before); MS.status('Redid: ' + op.label);
    },
    mark: function (label) { changed({}, label, revision()); },
    clear: function () { undo = []; redo = []; MS.emit('history'); },
    canUndo: function () { return undo.length > 0; },
    canRedo: function () { return redo.length > 0; },
    labels: function () { return undo.map(function (o) { return o.label; }); },

    /* Helpers for common kinds of change. */
    // Change runtime state (theme, charts, filters...). fn mutates rt.state.
    state: function (label, fn, opts) {
      var rt = MS.rt(); if (!rt) return;
      var before = JSON.stringify(rt.state);
      fn(rt.state, rt);
      var after = JSON.stringify(rt.state);
      if (before === after) { rt.refresh(true); return; }
      rt.refresh(true);
      MS.history.push({ label: label, validationNeutral: opts && opts.validationNeutral,
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
      MS.history.push({ label: label, validationNeutral: ops.every(function (o) { return o.validationNeutral; }),
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
