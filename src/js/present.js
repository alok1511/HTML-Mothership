/* Presenter mode: full screen, tab-by-tab like slides, laser pointer, and a
   separate presenter window with notes, timer and the next tab. */
(function (MS) {
  'use strict';
  var Pr = MS.present = { on: false };
  var prevMode, hud, laser, pw, t0, timer;

  Pr.start = function (withPresenterView) {
    var rt = MS.rt(); if (!rt) return MS.toast('Open a dashboard first.', 'warn');
    if (!rt.layoutEnabled()) MS.toast('Tip: turn on tabbed layout so you can step through tabs like slides.', 'warn');
    Pr.on = true; prevMode = MS.mode;
    var first = rt.tabs().filter(function (t) { return !t.hidden; })[0];
    if (first) rt.showTab(first.id);
    MS.setMode('interact');
    document.body.classList.add('presenting');
    if (MS.view) MS.view.layout();
    var stage = MS.$('#stage');
    if (stage.requestFullscreen) stage.requestFullscreen().catch(function () {});
    hud = MS.h('div', { 'class': 'hud' }); stage.appendChild(hud);
    laser = MS.child.doc.createElement('div'); laser.className = 'ms-laser'; laser.setAttribute('data-ms-editor', '');
    laser.style.cssText = 'position:fixed;width:14px;height:14px;border-radius:50%;background:rgba(239,68,68,.85);box-shadow:0 0 12px 4px rgba(239,68,68,.5);pointer-events:none;z-index:999999;display:none;transform:translate(-50%,-50%)';
    MS.child.doc.body.appendChild(laser);
    MS.child.doc.addEventListener('mousemove', moveLaser);
    t0 = Date.now(); timer = setInterval(update, 1000);
    MS.on('tab-shown', update);
    update();
    if (withPresenterView) Pr.openPresenterView();
    MS.toast('Presenting. → / ← or PgDn / PgUp to change tab · L laser · B blank screen · Esc to exit', '', 5000);
  };
  Pr.stop = function () {
    if (!Pr.on) return;
    Pr.on = false;
    document.body.classList.remove('presenting', 'blank');
    if (MS.view) setTimeout(MS.view.layout, 50);
    if (document.fullscreenElement) document.exitFullscreen().catch(function () {});
    if (hud) hud.remove();
    if (laser) laser.remove();
    if (MS.child) MS.child.doc.removeEventListener('mousemove', moveLaser);
    clearInterval(timer);
    if (pw && !pw.closed) pw.close();
    MS.setMode(prevMode || 'edit');
  };
  function moveLaser(e) { if (laser) { laser.style.left = e.clientX + 'px'; laser.style.top = e.clientY + 'px'; } }
  Pr.key = function (e) {
    if (!Pr.on) return false;
    var rt = MS.rt();
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ': rt.step(1); break;
      case 'ArrowLeft': case 'PageUp': rt.step(-1); break;
      case 'Home': rt.showTab(rt.tabs().filter(function (t) { return !t.hidden; })[0].id); break;
      case 'Escape': Pr.stop(); break;
      case 'l': case 'L': laser.style.display = laser.style.display === 'none' ? 'block' : 'none'; break;
      case 'b': case 'B': document.body.classList.toggle('blank'); break;
      default: return false;
    }
    e.preventDefault(); update();
    return true;
  };
  function info() {
    var rt = MS.rt(), vis = rt.tabs().filter(function (t) { return !t.hidden; });
    var i = vis.findIndex(function (t) { return t.id === rt.activeTab; });
    return { i: i, n: vis.length, cur: vis[i], next: vis[i + 1] };
  }
  function clock() { var s = Math.floor((Date.now() - t0) / 1000); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function update() {
    if (!Pr.on) return;
    var x = info();
    if (hud) hud.textContent = (x.cur ? (x.i + 1) + ' / ' + x.n + ' · ' + x.cur.title : '') + ' · ' + clock();
    if (pw && !pw.closed) {
      var d = pw.document;
      d.getElementById('cur').textContent = x.cur ? x.cur.title : '';
      d.getElementById('pos').textContent = (x.i + 1) + ' / ' + x.n;
      d.getElementById('next').textContent = x.next ? 'Next: ' + x.next.title : 'Last tab';
      d.getElementById('notes').textContent = (x.cur && x.cur.notes) || 'No notes for this tab. Add them from the tab menu in the left panel (Notes…).';
      d.getElementById('time').textContent = clock();
    }
  }
  Pr.openPresenterView = function () {
    pw = window.open('', 'ms-presenter', 'width=760,height=560');
    if (!pw) return MS.toast('Pop-up blocked. Allow pop-ups for this page to use Presenter view.', 'warn');
    pw.document.write('<!doctype html><title>Presenter view</title><style>body{font:16px/1.5 system-ui,Segoe UI,sans-serif;margin:0;background:#0f172a;color:#e2e8f0;display:flex;flex-direction:column;height:100vh}header{display:flex;gap:16px;align-items:baseline;padding:16px 20px;border-bottom:1px solid #334155}#cur{font-size:24px;font-weight:700}#pos,#next{color:#94a3b8}#time{margin-left:auto;font:600 28px ui-monospace,monospace;color:#facc15}#notes{flex:1;padding:20px;font-size:20px;white-space:pre-wrap;overflow:auto}footer{display:flex;gap:10px;padding:12px 20px;border-top:1px solid #334155}button{font:inherit;padding:8px 18px;border-radius:8px;border:1px solid #475569;background:#1e293b;color:#e2e8f0;cursor:pointer}</style>' +
      '<header><span id="cur"></span><span id="pos"></span><span id="time"></span></header><div id="notes"></div><footer><button id="prev">◀ Previous</button><button id="nxt">Next ▶</button><span id="next" style="align-self:center"></span></footer>');
    pw.document.close();
    pw.document.getElementById('prev').onclick = function () { MS.rt().step(-1); update(); };
    pw.document.getElementById('nxt').onclick = function () { MS.rt().step(1); update(); };
    pw.document.addEventListener('keydown', function (e) { Pr.key(e); });
    update();
  };
  document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement && Pr.on && !(pw && !pw.closed)) Pr.stop(); });
})(window.MS);
