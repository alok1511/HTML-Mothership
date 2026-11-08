/* Offline data replacement for the five report layouts. */
(function () {
  'use strict';
  function records(csv) {
    const output = [];
    let row = [], field = '', quoted = false, closed = false;
    function pushField() { row.push(field); field = ''; closed = false; }
    function pushRow() {
      pushField();
      if (row.some(x => x.trim())) output.push(row);
      row = [];
      if (output.length > 20001) throw new Error('Use no more than 20,000 data rows.');
    }
    csv = csv.replace(/^\uFEFF/, '');
    for (let i = 0; i < csv.length; i++) {
      const c = csv[i];
      if (quoted) {
        if (c === '"' && csv[i + 1] === '"') { field += '"'; i++; }
        else if (c === '"') { quoted = false; closed = true; }
        else field += c;
      } else if (c === ',') pushField();
      else if (c === '\n' || c === '\r') { if (c === '\r' && csv[i + 1] === '\n') i++; pushRow(); }
      else if (c === '"' && !field && !closed) quoted = true;
      else if (closed || c === '"') throw new Error('A CSV field contains an unexpected quote or delimiter.');
      else field += c;
    }
    if (quoted) throw new Error('A quoted CSV field is unfinished.');
    pushRow();
    return output;
  }
  // Accept headers from older exported reports without changing any values.
  function token(s) { return String(s).trim().toLowerCase().replace(/\s*\(inr lakh\)$/, '').replace(/\s+/g, ' '); }
  function parse(csv, columns, labels, bounded) {
    const lines = records(csv), header = (lines.shift() || []).map(token);
    if (!lines.length) throw new Error('Include a header and at least one row. Start from a downloaded report CSV.');
    const indexes = columns.map(k => {
      const hits = header.flatMap((h, i) => h === token(k) || h === token(labels[k]) ? [i] : []);
      if (hits.length !== 1) throw new Error('The CSV must include one “' + labels[k] + '” column.');
      return hits[0];
    });
    const numberFields = new Set(['base', 'outcome', 'units']);
    const rows = lines.map((line, index) => {
      const row = {};
      columns.forEach((k, i) => {
        const raw = (line[indexes[i]] || '').trim();
        if (!raw) throw new Error('Row ' + (index + 2) + ' is missing “' + labels[k] + '”.');
        if (raw.length > 120) throw new Error('Row ' + (index + 2) + ' has a field longer than 120 characters.');
        if (!numberFields.has(k)) row[k] = raw;
        else {
          const value = Number(raw);
          if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw) || !Number.isFinite(value) || Math.abs(value) > 1e12) {
            throw new Error('Row ' + (index + 2) + ' needs a plain number in “' + labels[k] + '”.');
          }
          row[k] = value;
        }
      });
      if (row.base <= 0 || row.units < 0 || (bounded && (row.outcome < 0 || row.outcome > row.base))) {
        throw new Error('Row ' + (index + 2) + ' has an invalid exposure, outcome or unit count. Check Methodology for the required measures.');
      }
      return row;
    });
    const dimensions = columns.filter(k => !numberFields.has(k));
    if (dimensions.some(k => new Set(rows.map(r => r[k])).size > (k === 'region' ? 80 : 48))) {
      throw new Error('Use at most 80 regions and 48 values per other dimension. Group granular rows before loading.');
    }
    return rows;
  }
  window.MSReportCsv = { parse };
})();
