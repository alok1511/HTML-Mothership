/* Local map imports for polygon boundaries. Shapefile XY layout follows Esri's
   technical description. Projected files must be converted to WGS84 first. */
(function () {
  'use strict';
  const maxFile = 8 * 1024 * 1024, maxLayer = 18 * 1024 * 1024, maxPoints = 150000;
  const maxFeatures = 2500;
  const byteView = bytes => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readText = (bytes, a, b, decoder) => decoder.decode(bytes.slice(a, b)).replace(/\0.*$/, '').trim();
  function valid(collection) {
    if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) throw new Error('Choose a GeoJSON FeatureCollection of polygon boundaries.');
    if (collection.crs && !/4326|crs84/i.test(JSON.stringify(collection.crs))) throw new Error('Convert the layer to WGS84 longitude and latitude first.');
    if (!collection.features.length || collection.features.length > maxFeatures) throw new Error('Use a layer with 1 to ' + maxFeatures + ' features.');
    let points = 0;
    const features = collection.features.map(feature => {
      const g = feature?.geometry;
      if (!g || !Array.isArray(g.coordinates) || !['Polygon', 'MultiPolygon'].includes(g.type)) throw new Error('Use a Polygon or MultiPolygon boundary layer.');
      const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
      if (!polygons.length) throw new Error('A polygon is empty.');
      const clean = polygons.map(poly => {
        if (!Array.isArray(poly) || !poly.length) throw new Error('A polygon has no rings.');
        return poly.map(ring => {
          if (!Array.isArray(ring) || ring.length < 4 || (points += ring.length) > maxPoints) throw new Error('A ring is invalid or the layer is too detailed. Simplify the layer and try again.');
          const coordinates = ring.map(p => {
            if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90) throw new Error('Coordinates must be WGS84 longitude and latitude.');
            return [p[0], p[1]];
          });
          if (coordinates[0][0] !== coordinates.at(-1)[0] || coordinates[0][1] !== coordinates.at(-1)[1]) throw new Error('A polygon ring is open.');
          return coordinates;
        });
      });
      const properties = Object.fromEntries(Object.entries(feature.properties || {}).filter(([, v]) => typeof v === 'string' || typeof v === 'number'));
      return { type: 'Feature', properties, geometry: { type: 'MultiPolygon', coordinates: clean } };
    });
    return { type: 'FeatureCollection', features };
  }
  function signedArea(ring) {
    return ring.reduce((s, p, i) => i ? s + ring[i - 1][0] * p[1] - p[0] * ring[i - 1][1] : s, 0) / 2;
  }
  function contains(ring, point) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x, y] = ring[i], [u, v] = ring[j];
      if ((y > point[1]) !== (v > point[1]) && point[0] < (u - x) * (point[1] - y) / (v - y) + x) inside = !inside;
    }
    return inside;
  }
  function polygons(rings) {
    const shells = [], holes = [];
    for (const ring of rings) {
      const area = signedArea(ring);
      if (area < 0) shells.push({ area: -area, rings: [ring] });
      else if (area > 0) holes.push(ring);
    }
    for (const hole of holes) {
      const shell = shells.filter(s => contains(s.rings[0], hole[0])).sort((a, b) => a.area - b.area)[0];
      if (!shell) throw new Error('A shapefile polygon has an invalid ring orientation or uncontained hole.');
      shell.rings.push(hole);
    }
    return shells.map(s => s.rings);
  }
  function parseShp(bytes) {
    const v = byteView(bytes), result = [];
    if (v.byteLength < 100 || v.getInt32(0) !== 9994 || ![5, 15, 25].includes(v.getInt32(32, true))) throw new Error('The .shp file must contain polygons.');
    const end = v.getInt32(24) * 2;
    if (end !== v.byteLength) throw new Error('The .shp file length is invalid.');
    let points = 0;
    for (let pos = 100; pos < end;) {
      if (pos + 12 > end || result.length >= maxFeatures) throw new Error('The .shp file is truncated or contains too many records.');
      const start = pos + 8, next = start + v.getInt32(pos + 4) * 2;
      if (next < start + 4 || next > end) throw new Error('A shapefile record has an invalid length.');
      const type = v.getInt32(start, true);
      pos = next;
      if (type === 0) { result.push(null); continue; }
      if (![5, 15, 25].includes(type) || next < start + 44) throw new Error('Expected polygon geometry in each shapefile record.');
      const partCount = v.getInt32(start + 36, true), count = v.getInt32(start + 40, true);
      const index = start + 44, coords = index + partCount * 4;
      if (partCount < 1 || count < 4 || (points += count) > maxPoints || coords + 16 * count > next) throw new Error('A polygon record is invalid or the layer is too detailed.');
      const rings = [];
      let previous = 0;
      for (let part = 0; part < partCount; part++) {
        const first = v.getInt32(index + part * 4, true);
        const last = part + 1 < partCount ? v.getInt32(index + (part + 1) * 4, true) : count;
        if (first !== previous || last - first < 4 || last > count) throw new Error('A shapefile ring is invalid.');
        const ring = [];
        for (let i = first; i < last; i++) ring.push([v.getFloat64(coords + i * 16, true), v.getFloat64(coords + i * 16 + 8, true)]);
        rings.push(ring); previous = last;
      }
      result.push({ type: 'MultiPolygon', coordinates: polygons(rings) });
    }
    return result;
  }
  function parseDbf(bytes, encoding) {
    const v = byteView(bytes), decoder = new TextDecoder(encoding);
    if (v.byteLength < 33) throw new Error('The shapefile .dbf attribute table is truncated.');
    const count = v.getUint32(4, true), header = v.getUint16(8, true), length = v.getUint16(10, true);
    if (count > maxFeatures || header < 33 || length < 2 || header + count * length > v.byteLength) throw new Error('The shapefile attribute table has an invalid size.');
    const fields = [];
    let offset = 1;
    for (let pos = 32; pos < header && v.getUint8(pos) !== 13; pos += 32) {
      if (pos + 32 > header) throw new Error('Invalid .dbf field header.');
      const size = v.getUint8(pos + 16);
      fields.push([readText(bytes, pos, pos + 11, decoder), offset, size]);
      offset += size;
    }
    if (!fields.length || offset > length) throw new Error('No usable fields in the .dbf table.');
    return Array.from({ length: count }, (_, i) => {
      const pos = header + i * length;
      if (v.getUint8(pos) === 42) return null;
      return Object.fromEntries(fields.map(([name, start, size]) => [name, readText(bytes, pos + start, pos + start + size, decoder)]));
    });
  }
  async function load(file) {
    if (file.size > maxFile) throw new Error('Boundary file is too large. Use an 8 MB or smaller regional layer.');
    if (!/\.zip$/i.test(file.name)) return valid(JSON.parse(await file.text()));
    if (!window.JSZip) throw new Error('The local ZIP reader is unavailable.');
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entries = Object.values(zip.files).filter(x => !x.dir && !x.name.startsWith('__MACOSX/'));
    const layers = entries.filter(x => /\.shp$/i.test(x.name));
    if (layers.length !== 1) throw new Error('The ZIP should contain one polygon shapefile layer.');
    const prefix = layers[0].name.slice(0, -4).toLowerCase();
    const part = ext => entries.find(x => x.name.toLowerCase() === prefix + ext);
    const dbf = part('.dbf'), prj = part('.prj'), cpg = part('.cpg');
    if (!dbf || !prj) throw new Error('Include matching .shp, .dbf and .prj files in the ZIP.');
    const requested = [layers[0], dbf, prj, cpg].filter(Boolean);
    if (requested.reduce((n, x) => n + (x._data?.uncompressedSize || 0), 0) > maxLayer) throw new Error('The uncompressed layer is too large. Simplify it first.');
    const [shp, table, projection, code] = await Promise.all([layers[0].async('uint8array'), dbf.async('uint8array'), prj.async('string'), cpg?.async('string')]);
    if (/PROJCS|PROJCRS/i.test(projection) || !/WGS[ _-]*(?:19)?84|EPSG["\s,]+4326/i.test(projection)) throw new Error('The .prj must describe geographic WGS84. Reproject to EPSG:4326 first.');
    const encoding = /^(?:ansi\s*)?1252$/i.test(code?.trim() || '') ? 'windows-1252' : 'utf-8';
    const shapes = parseShp(shp), attrs = parseDbf(table, encoding);
    if (shapes.length !== attrs.length) throw new Error('The .shp and .dbf have different record counts.');
    return valid({ type: 'FeatureCollection', features: shapes.flatMap((geometry, i) => geometry && attrs[i] ? [{ geometry, properties: attrs[i] }] : []) });
  }
  window.MSReportGeo = { load, valid };
})();
