/* Inference ladder: what a chart says (first order), what is driving it (second order) and what
   follows if it holds (third order). Everything is arithmetic on the numbers the chart shows now;
   nothing here knows the cause, so each ladder ends with the checks to make before stating one. */
(function (MS) {
  'use strict';
  var h = MS.h;
  var I = MS.infer = {};
  var PERIOD = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|^(q[1-4]|h[12])\b|^(fy|cy|py|uy|ay)\s?'?\d{2}|^\d{4}([-\/]\d{1,4})?([-\/]\d{1,2})?$|^w(ee)?k\s?\d+|^\d{1,2}[-\/]\d{2,4}$/i;
  function rt() { return MS.rt(); }
  function sum(a) { return a.reduce(function (s, v) { return s + (v || 0); }, 0); }
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function pct(x, digits) { var d = digits == null ? (Math.abs(x) < 10 ? 1 : 0) : digits; return (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace(/\.0$/, '') + '%'; }
  function signed(x, f) { return (x > 0 ? '+' : x < 0 ? '−' : '') + f(Math.abs(x)); }
  function times(x) { return (Math.round(x * 10) / 10) + ' times'; }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function ordered(type, labels) {
    if (/line|area/.test(type)) return true;
    return labels.length >= 3 && labels.filter(function (l) { return PERIOD.test(String(l).trim()); }).length >= labels.length * 0.6;
  }
  /* The order of the periods in time. A chart can be sorted by value or newest first, so the order on
     screen is not proof. Returns the label positions oldest first; null when the labels are periods but
     their order in time cannot be settled (so no trend is read); 'shown' when they cannot be read at all. */
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function year(t) { var m = /(?:^|[^\d])(\d{4}|\d{2})(?![\d])/.exec(t); if (!m) return null; var y = +m[1]; return y < 100 ? 2000 + y : y; }
  function periodKey(label) {
    var t = String(label).trim().toLowerCase(), m, y;
    if ((m = /^(\d{4})\s*[-\/ ]?\s*q([1-4])\b/.exec(t))) return { v: +m[1] + (m[2] - 1) / 4 };
    if ((m = /^(\d{4})\s*[-\/ ]?\s*h([12])\b/.exec(t))) return { v: +m[1] + (m[2] - 1) / 2 };
    if ((m = /^(\d{4})(?:[-\/](\d{1,4}))?(?:[-\/](\d{1,2}))?$/.exec(t))) return { v: +m[1] + (m[2] && +m[2] >= 1 && +m[2] <= 12 ? (m[2] - 1) / 12 + (m[3] ? m[3] / 400 : 0) : 0) };
    if ((m = /^(\d{1,2})[-\/](\d{2,4})$/.exec(t)) && +m[1] >= 1 && +m[1] <= 12) return { v: (+m[2] < 100 ? 2000 + +m[2] : +m[2]) + (m[1] - 1) / 12 };
    if ((m = /^(?:fy|cy|py|uy|ay)\s?'?(\d{2,4})/.exec(t))) return { v: +m[1] < 100 ? 2000 + +m[1] : +m[1] };
    if ((m = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b(.*)$/.exec(t))) { y = year(m[2]); var mi = MONTHS.indexOf(m[1]); return y == null ? { c: mi, of: 12 } : { v: y + mi / 12 }; }
    if ((m = /^q([1-4])\b(.*)$/.exec(t))) { y = year(m[2]); return y == null ? { c: m[1] - 1, of: 4 } : { v: y + (m[1] - 1) / 4 }; }
    if ((m = /^h([12])\b(.*)$/.exec(t))) { y = year(m[2]); return y == null ? { c: m[1] - 1, of: 2 } : { v: y + (m[1] - 1) / 2 }; }
    if ((m = /^w(?:ee)?k?\s?(\d+)$/.exec(t))) return { v: +m[1], w: 1 };
    return null;
  }
  function chrono(labels) {
    var k = labels.map(periodKey), idx = labels.map(function (l, i) { return i; });
    if (k.some(function (x) { return !x; })) return 'shown';
    if (k.every(function (x) { return x.v != null; })) {
      if (k.some(function (x) { return x.w; }) && !k.every(function (x) { return x.w; })) return null;
      return idx.sort(function (a, b) { return k[a].v - k[b].v || a - b; });
    }
    // Months or quarters with no year: a run such as Apr to Mar is in order; anything else cannot be placed.
    if (!k.every(function (x) { return x.c != null && x.of === k[0].of; })) return null;
    var run = function (a) { var wraps = 0, i; for (i = 1; i < a.length; i++) { if (a[i] === a[i - 1]) return false; if (a[i] < a[i - 1]) wraps++; } return wraps === 0 || (wraps === 1 && a[a.length - 1] < a[0]); };
    var c = k.map(function (x) { return x.c; });
    if (run(c)) return idx;
    if (run(c.slice().reverse())) return idx.reverse();
    return null;
  }
  // Other charts that show the same categories, or are drawn from the same data: where to look for the reason.
  function related(key, labels) {
    var r = rt(), mine = (r.state.charts[key] || {}).binding, low = labels.map(function (l) { return String(l).toLowerCase(); });
    return r.charts().filter(function (c) { return c.key !== key; }).map(function (c) {
      var d = r.chartData(c.key, true), b = (r.state.charts[c.key] || {}).binding;
      var shared = d ? d.labels.filter(function (l) { return low.indexOf(String(l).toLowerCase()) >= 0; }).length : 0;
      var same = !!(mine && b && mine.dataset && mine.dataset === b.dataset);
      return shared >= 2 || same ? { name: MS.charts.nameOf(c.key), why: shared >= 2 ? 'shows the same categories' : 'is drawn from the same data' } : null;
    }).filter(Boolean).slice(0, 3);
  }
  function drillHint(key) {
    var b = (rt().state.charts[key] || {}).binding, lv = (b && b.levels) || [];
    return lv.length > 1 ? 'Drill down by ' + lv.slice(1).join(', then ') : '';
  }

  /* One series across categories: a ranking. */
  function ranking(out, pts, f) {
    var by = pts.slice().sort(function (a, b) { return b.v - a.v; }), n = by.length, T = sum(by.map(function (p) { return p.v; }));
    var top = by[0], last = by[n - 1], med = median(by.map(function (p) { return p.v; }));
    var positive = by.every(function (p) { return p.v >= 0; }) && T > 0;
    out.first.push(top.l + ' is highest at ' + f(top.v) + (positive ? ' (' + pct(top.v / T * 100) + ' of the total)' : '') + '; ' + last.l + ' is lowest at ' + f(last.v) + '.');
    if (n >= 3 && med > 0 && top.v / med >= 1.3) out.second.push(top.l + ' is ' + times(top.v / med) + ' the typical item (median ' + f(med) + '), so it stands apart from the rest rather than leading a close pack.');
    else if (n >= 3 && med > 0) out.second.push('The items are bunched: the highest is only ' + times(top.v / med) + ' the median (' + f(med) + '), so no single item explains the total.');
    if (positive && n >= 4) {
      var run = 0, k = 0; while (k < n && run < T * 0.8) run += by[k++].v;
      var k3 = Math.min(3, n - 1), s3 = sum(by.slice(0, k3).map(function (p) { return p.v; }));
      out.second.push('The top ' + k3 + ' make up ' + pct(s3 / T * 100) + ' of the total; ' + plural(k, 'item') + ' of ' + n + ' cover 80%.' + (k <= Math.ceil(n / 3) ? ' The total is concentrated.' : ' The total is spread out.'));
    }
    if (positive) {
      out.third.push('A 10% change in ' + top.l + ' alone moves the total by ' + pct(top.v / T * 10) + ' (' + f(top.v * 0.1) + ').');
      if (n >= 3 && top.v > med) out.third.push('If ' + top.l + ' were at the median, the total would change by ' + f(top.v - med) + ' (' + pct((top.v - med) / T * 100) + '). That is the size of the question, whichever direction is good.');
    }
    if (n >= 5 && positive) {
      var tail = by.slice(Math.ceil(n / 2)), ts = sum(tail.map(function (p) { return p.v; }));
      out.third.push('The bottom ' + tail.length + ' together are ' + pct(ts / T * 100) + ' of the total, so effort spent there has a ceiling of that size.');
    }
  }

  /* One series over time: a trend. */
  function trend(out, pts, f) {
    var a = pts[0], z = pts[pts.length - 1], n = pts.length, ch = z.v - a.v;
    out.first.push((ch > 0 ? 'Rose' : ch < 0 ? 'Fell' : 'Flat') + ' from ' + f(a.v) + ' in ' + a.l + ' to ' + f(z.v) + ' in ' + z.l + (a.v && ch ? ' (' + signed(ch / Math.abs(a.v) * 100, pct) + ')' : '') + '.');
    var steps = []; for (var i = 1; i < n; i++) steps.push({ l: pts[i].l, d: pts[i].v - pts[i - 1].v, r: pts[i - 1].v ? (pts[i].v - pts[i - 1].v) / Math.abs(pts[i - 1].v) * 100 : null });
    var cagr = n >= 3 && a.v > 0 && z.v > 0 ? (Math.pow(z.v / a.v, 1 / (n - 1)) - 1) * 100 : null;
    if (cagr != null) out.first.push('That is ' + signed(cagr, pct) + ' a period on average (compound).');
    if (steps.length >= 2) {
      var lastStep = steps[steps.length - 1], earlier = steps.slice(0, -1).filter(function (s) { return s.r != null; });
      if (lastStep.r != null && earlier.length) {
        var avg = sum(earlier.map(function (s) { return s.r; })) / earlier.length, gap = lastStep.r - avg;
        out.second.push(Math.abs(gap) < 1 ? 'The pace is steady: the latest period changed ' + signed(lastStep.r, pct) + ', in line with ' + signed(avg, pct) + ' before.'
          : 'The pace is ' + (gap > 0 ? 'picking up' : 'slowing') + ': ' + signed(lastStep.r, pct) + ' in the latest period (' + lastStep.l + ') against an average of ' + signed(avg, pct) + ' before.');
      }
      var big = steps.reduce(function (x, y) { return Math.abs(y.d) > Math.abs(x.d) ? y : x; });
      if (ch && Math.abs(big.d) >= Math.abs(ch) * 0.5 && steps.length >= 3) out.second.push('One period carries the story: ' + big.l + ' moved ' + signed(big.d, f) + ', which is ' + pct(Math.abs(big.d / ch) * 100) + ' of the whole change. Look at what happened then.');
      var ups = steps.filter(function (s) { return s.d > 0; }).length, downs = steps.filter(function (s) { return s.d < 0; }).length;
      if (ups && downs) out.second.push('It is not a straight line: up in ' + plural(ups, 'period') + ', down in ' + downs + '.');
      else if (steps.length >= 3) out.second.push('The direction never changed across ' + plural(steps.length, 'period') + '.');
      if (cagr != null && Math.abs(cagr) >= 0.5) {
        var next = z.v * (1 + cagr / 100);
        var line = 'If the average pace holds, the next period would be about ' + f(next);
        if (cagr > 0) line += ', and the figure doubles in about ' + plural(Math.max(1, Math.round(Math.log(2) / Math.log(1 + cagr / 100))), 'period');
        else line += ', and the figure halves in about ' + plural(Math.max(1, Math.round(Math.log(0.5) / Math.log(1 + cagr / 100))), 'period');
        out.third.push(line + '.');
        if (lastStep.r != null && Math.abs(lastStep.r - cagr) >= 2) {
          var alt = z.v * (1 + lastStep.r / 100);
          out.third.push('If the latest pace holds instead, the next period would be about ' + f(alt) + ', a difference of ' + f(Math.abs(alt - next)) + '. Which pace is the real one is the question to settle.');
        }
      }
    }
    if (a.v !== 0 && Math.abs(a.v) < Math.max.apply(null, pts.map(function (p) { return Math.abs(p.v); })) * 0.1) out.checks.push('The starting figure is small, so percentage growth looks large (a base effect). Quote the change in amount as well.');
    out.checks.push('Is the latest period complete, or part-way through?');
  }

  /* Several series over time: totals, mix and what drove the change. */
  function mix(out, L, S, f) {
    var n = L.length, col = function (j) { return sum(S.map(function (s) { return s.values[j] || 0; })); };
    var T0 = col(0), T1 = col(n - 1), dT = T1 - T0;
    var end = S.map(function (s) { return { name: s.name, a: s.values[0] || 0, z: s.values[n - 1] || 0 }; });
    end.forEach(function (e) { e.d = e.z - e.a; e.sa = T0 ? e.a / T0 * 100 : 0; e.sz = T1 ? e.z / T1 * 100 : 0; e.shift = e.sz - e.sa; });
    var lead = end.slice().sort(function (x, y) { return y.z - x.z; })[0];
    var flat = Math.abs(T0) > 0 && Math.abs(dT / T0) < 0.005;
    out.first.push('The total ' + (flat ? 'is unchanged at ' + f(T1) : (dT > 0 ? 'rose' : 'fell') + ' from ' + f(T0) + ' in ' + L[0] + ' to ' + f(T1) + ' in ' + L[n - 1] + (T0 ? ' (' + signed(dT / Math.abs(T0) * 100, pct) + ')' : '')) + '. ' + lead.name + ' is the largest part at ' + pct(lead.sz) + '.');
    if (!flat && dT) {
      var drivers = end.slice().sort(function (x, y) { return Math.abs(y.d) - Math.abs(x.d); });
      var same = drivers.filter(function (e) { return e.d * dT > 0; }), against = drivers.filter(function (e) { return e.d * dT < 0; });
      if (same.length && Math.abs(same[0].d) > Math.abs(dT) && against.length) out.second.push(same[0].name + ' moved ' + signed(same[0].d, f) + ', more than the whole change of ' + signed(dT, f) + '; ' + against[0].name + ' offset part of it (' + signed(against[0].d, f) + '). Two opposite moves sit behind one net figure.');
      else if (same.length) out.second.push(same[0].name + ' accounts for ' + pct(same[0].d / dT * 100) + ' of the change (' + signed(same[0].d, f) + ')' + (against.length ? ', while ' + against[0].name + ' moved the other way (' + signed(against[0].d, f) + ').' : '.'));
      if (same.length && Math.abs(T0) > 0) out.third.push('Without the change in ' + same[0].name + ', the total would have moved ' + signed((dT - same[0].d) / Math.abs(T0) * 100, pct) + ' instead of ' + signed(dT / Math.abs(T0) * 100, pct) + '. The headline rests on one part.');
    }
    var gain = end.slice().sort(function (x, y) { return y.shift - x.shift; })[0], loss = end.slice().sort(function (x, y) { return x.shift - y.shift; })[0];
    if (gain.shift >= 1 && loss.shift <= -1) {
      out.second.push('The mix is shifting: ' + gain.name + ' went from ' + pct(gain.sa) + ' to ' + pct(gain.sz) + ' of the total (' + signed(gain.shift, function (x) { return (Math.round(x * 10) / 10) + ' points'; }) + '), ' + loss.name + ' from ' + pct(loss.sa) + ' to ' + pct(loss.sz) + '.');
      if (gain !== lead && gain.sz < lead.sz && n >= 2) {
        var pace = (gain.shift - lead.shift) / (n - 1);
        if (pace > 0) out.third.push('At this pace ' + gain.name + ' overtakes ' + lead.name + ' in about ' + plural(Math.ceil((lead.sz - gain.sz) / pace), 'more period') + '.');
      }
    } else out.second.push('The mix is stable: no part moved by more than a point of share.');
    out.third.push(lead.name + ' is ' + pct(lead.sz) + ' of the total, so a 10% change in it moves the total by ' + pct(lead.sz / 10) + '.');
    out.checks.push('A share can rise because the others shrank. Read the amounts as well as the percentages.');
    out.checks.push('Is the latest period complete, or part-way through?');
  }

  /* Several series across categories: which category is built differently. */
  function composition(out, L, S, f) {
    var tot = L.map(function (l, j) { return { l: l, v: sum(S.map(function (s) { return s.values[j] || 0; })) }; });
    var T = sum(tot.map(function (t) { return t.v; })), big = tot.slice().sort(function (a, b) { return b.v - a.v; })[0];
    var st = S.map(function (s) { return { name: s.name, v: sum(s.values) }; }).sort(function (a, b) { return b.v - a.v; });
    out.first.push(big.l + ' is the largest at ' + f(big.v) + (T > 0 ? ' (' + pct(big.v / T * 100) + ' of the total)' : '') + '. Across all of them, ' + st[0].name + ' is the largest part' + (T > 0 ? ' at ' + pct(st[0].v / T * 100) : '') + '.');
    if (T > 0) {
      var odd = null;
      S.forEach(function (s) {
        var avg = sum(s.values) / T * 100;
        L.forEach(function (l, j) { if (tot[j].v > 0) { var sh = (s.values[j] || 0) / tot[j].v * 100, d = sh - avg; if (!odd || Math.abs(d) > Math.abs(odd.d)) odd = { l: l, s: s.name, sh: sh, avg: avg, d: d }; } });
      });
      if (odd && Math.abs(odd.d) >= 5) {
        out.second.push(odd.l + ' is built differently: ' + odd.s + ' is ' + pct(odd.sh) + ' of it, against ' + pct(odd.avg) + ' overall.');
        out.third.push('If ' + odd.l + ' had the overall mix, its ' + odd.s + ' would be ' + f(tot[L.indexOf(odd.l)].v * odd.avg / 100) + ' rather than ' + f(tot[L.indexOf(odd.l)].v * odd.sh / 100) + '. Ask whether that difference is by design.');
      } else out.second.push('Every category has much the same make-up, so size, not mix, is what separates them.');
      out.third.push('A 10% change in ' + big.l + ' moves the total by ' + pct(big.v / T * 10) + '.');
    }
  }

  I.facts = function (key) {
    var r = rt(), c = r && r.chart(key); if (!c) return null;
    var d = r.chartData(key, true), info = c.a.info(c.inst) || {}, name = MS.charts.nameOf(key);
    var out = { chart: name, key: key, kind: '', first: [], second: [], third: [], checks: [], look: [] };
    if (!d || !d.labels.length || !d.series.length) return out;
    var S = d.series.filter(function (s) { return s.values.some(function (v) { return v != null && !isNaN(v); }) && !/^(base|spacer|invisible)$/i.test(String(s.name).trim()); });
    if (!S.length) return out;
    var cs = r.state.charts[key] || {}, type = String(info.type || '');
    var f = r.sumFmt ? r.sumFmt(cs.style, [name, info.title, S.map(function (s) { return s.name; }).join(' ')].join(' ')) : function (v) { return String(Math.round(v * 100) / 100); };
    var time = ordered(type, d.labels) && !/pie|doughnut|funnel/.test(type);
    if (time) {
      var ord = chrono(d.labels), byValue = /^(desc|asc)$/.test(String((cs.binding || {}).sort || ''));
      if (ord === null || (ord === 'shown' && byValue)) time = false;
      else if (ord !== 'shown') {
        d = { labels: ord.map(function (j) { return d.labels[j]; }), series: d.series };
        S = S.map(function (s) { return { name: s.name, values: ord.map(function (j) { return s.values[j]; }) }; });
      } else out.checks.push('The periods are read in the order the chart shows them. Check that it runs oldest to newest.');
    }
    if (S.length === 1 || /pie|doughnut|funnel/.test(type)) {
      var pts = d.labels.map(function (l, j) { return { l: String(l), v: S[0].values[j] }; }).filter(function (p) { return p.v != null && !isNaN(p.v); });
      if (pts.length < 2) return out;
      out.kind = time ? 'trend' : 'ranking';
      (time ? trend : ranking)(out, pts, f);
    } else {
      out.kind = time ? 'mix over time' : 'composition';
      (time ? mix : composition)(out, d.labels.map(String), S, f);
    }
    related(key, d.labels).forEach(function (x) { out.look.push('“' + x.name + '” ' + x.why + '.'); });
    var dh = drillHint(key); if (dh) out.look.push(dh + '.');
    out.checks.unshift('These lines are arithmetic on the numbers shown, not a forecast and not a cause. State a cause only after checking it.');
    out.checks.push('Are the definitions and the scope the same across everything compared?');
    out.checks.push('Is one unusual item (a large claim, a one-off, a missing month) doing the work?');
    return out;
  };
  I.all = function () { var r = rt(); return r ? r.charts().map(function (c) { return I.facts(c.key); }).filter(function (x) { return x && x.first.length; }) : []; };
  I.text = function (list) {
    return (list || I.all()).map(function (x) {
      var part = function (title, a) { return a.length ? title + '\n' + a.map(function (t) { return '- ' + t; }).join('\n') + '\n' : ''; };
      return x.chart + ' (' + x.kind + ')\n' + part('What it shows', x.first) + part('What is driving it', x.second) + part('What follows if it holds', x.third) + part('Where to look next', x.look) + part('Check before you say why', x.checks);
    }).join('\n');
  };
  I.use = function (key, text) { return MS.api.chart_settings({ chart: key, inference: text }); };

  I.dialog = function () {
    if (!rt()) return MS.toast('Open a dashboard first.', 'warn');
    var items = I.all();
    if (!items.length) return MS.toast('No charts with numbers found in this dashboard.', 'warn');
    var level = function (x, title, hint, list) {
      if (!list.length) return null;
      return h('div', { 'class': 'inf-level' }, [h('div', { 'class': 'inf-level-head' }, [h('b', { text: title }), h('small', { 'class': 'muted', text: hint })])].concat(list.map(function (t) {
        return h('div', { 'class': 'inf-line' }, [h('span', { 'class': 'grow', text: t }),
          h('button', { 'class': 'btn sm', title: 'Use this sentence as the chart’s inference line', onclick: function () { I.use(x.key, t); MS.toast('Set as the inference of “' + x.chart + '”. Ctrl+Z undoes.', 'ok'); } }, ['Use'])]);
      })));
    };
    var notes = function (title, list) { return list.length ? h('div', { 'class': 'inf-notes' }, [h('b', { text: title })].concat(list.map(function (t) { return h('div', { 'class': 'muted', text: '• ' + t }); }))) : null; };
    var body = h('div', {}, [
      h('p', { 'class': 'hint', text: 'Three steps for each chart: what it shows, what is driving it, and what follows if that holds. All of it is worked out from the numbers on screen, so it shows where to look; it does not prove why. Press Use to make a sentence the chart’s inference line.' }),
      h('div', { 'class': 'sum-list' }, items.map(function (x) {
        return h('div', { 'class': 'sum-row' }, [
          h('div', { 'class': 'sum-head' }, [h('strong', { text: x.chart }), h('small', { 'class': 'muted', text: x.kind })]),
          level(x, '1 · What it shows', 'first order', x.first), level(x, '2 · What is driving it', 'second order', x.second), level(x, '3 · What follows if it holds', 'third order', x.third),
          notes('Where to look next', x.look), notes('Check before you say why', x.checks)
        ]);
      }))
    ]);
    MS.dialog({ title: 'Inference ladder', wide: true, body: body, buttons: [
      { label: 'Close', value: null },
      { label: 'Copy all', primary: true, value: function () { var t = I.text(items); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { MS.toast('Copied.', 'ok'); }, function () { MS.download('inferences.txt', t, 'text/plain'); }); else MS.download('inferences.txt', t, 'text/plain'); return false; } }
    ] });
  };

  MS.api.add('chart_inferences', { d: 'The inference ladder for a chart (or every chart): first order (what it shows), second order (what is driving it: concentration, pace, mix shift, which part accounts for the change) and third order (what follows if it holds: sensitivity, run-rate, time to overtake), with the checks to make before stating a cause and where to look next. Worked out from the numbers on screen; not a forecast. Put a chosen sentence on the chart with chart_settings.inference.',
    p: { chart: ['string', 'Chart name or key (omit for every chart)'] },
    f: function (a) { if (!rt()) throw new Error('Open a dashboard first.'); if (a.chart) return I.facts(MS.api.chartKey(a.chart)); return { charts: I.all() }; } });
})(window.MS);
