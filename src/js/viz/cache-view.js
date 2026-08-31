/**
 * CacheView - the set/way grid, which is the picture that makes the address
 * decomposition stop being arithmetic.
 *
 * A cache is a table: one row per set, one column per way, and a tag in each
 * cell. An address picks the row; the tag comparison picks the column, or
 * finds nothing and misses. Drawing it that way makes the conflict cliff
 * visible rather than explicable - a stride aligned to the set count fills one
 * row and leaves every other row empty, and the picture shows a cache that is
 * one set wide.
 *
 * It is markup rather than a chart because the data is a grid of short labels
 * with no continuous axis, and because a table stays readable at sixty-four
 * rows where a chart of sixty-four categories does not. The same reasoning as
 * `viz/pipeline-view.js`, and it reuses that file's scroll and cell styles.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CacheView = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const HEAT = ['cache-heat-0', 'cache-heat-1', 'cache-heat-2', 'cache-heat-3',
    'cache-heat-4'];

  function escape(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /** One row per set, with the resident lines in way order. */
  function grid(cache, resident) {
    const rows = [];

    for (let set = 0; set < cache.settings.sets; set += 1) rows.push([]);
    resident.forEach(function (line) { rows[line.set].push(line); });
    return rows;
  }

  /**
   * How busy each set is, as a class rather than a colour literal. A heat map
   * over sets is the fastest way to see that a program is using one row of a
   * sixty-four-row table.
   */
  function heatClass(used, ways) {
    if (!used) return 'cache-heat-0';
    const share = used / Math.max(1, ways);

    return HEAT[Math.min(HEAT.length - 1, 1 + Math.floor(share * (HEAT.length - 1)))];
  }

  function markup(cache, options) {
    const settings = options || {};
    const resident = settings.resident || [];
    const rows = grid(cache, resident);
    const limit = Math.min(rows.length, settings.sets || 32);
    const highlight = settings.highlight === undefined ? null : settings.highlight;

    return '<div class="pipe-scroll"><table class="pipe-table cache-grid"><thead>' +
      header(cache) + '</thead><tbody>' +
      body(cache, rows, { limit: limit, highlight: highlight }) +
      '</tbody></table></div>' +
      (rows.length > limit
        ? '<p class="note">showing the first ' + limit + ' of ' + rows.length + ' sets.</p>'
        : '');
  }

  function header(cache) {
    const cells = ['<th class="pipe-label">set</th>'];

    for (let way = 0; way < cache.settings.ways; way += 1) {
      cells.push('<th>way ' + way + '</th>');
    }
    cells.push('<th>use</th>');
    return '<tr>' + cells.join('') + '</tr>';
  }

  function body(cache, rows, view) {
    const out = [];

    for (let set = 0; set < view.limit; set += 1) {
      out.push('<tr>' + setRow(cache, rows[set], set, view.highlight) + '</tr>');
    }
    return out.join('');
  }

  function setRow(cache, lines, set, highlight) {
    const cells = ['<th class="pipe-label' + (set === highlight ? ' cache-picked' : '') +
      '">' + set + '</th>'];

    for (let way = 0; way < cache.settings.ways; way += 1) {
      cells.push(cell(lines[way]));
    }
    cells.push('<td class="' + heatClass(lines.length, cache.settings.ways) + '">' +
      lines.length + '/' + cache.settings.ways + '</td>');
    return cells.join('');
  }

  function cell(line) {
    if (!line) return '<td class="pipe-gap"></td>';
    return '<td class="' + (line.dirty ? 'cache-dirty' : 'cache-clean') +
      '" title="line ' + line.line + (line.dirty ? ', dirty' : ', clean') + '">' +
      escape(line.tag) + '</td>';
  }

  /**
   * The address split, as the three numbers it is.
   *
   * Printed as a row rather than described, because the whole difficulty of
   * cache organisation is that the index comes from the MIDDLE and no amount
   * of prose fixes that as well as seeing the three fields side by side.
   */
  function decomposition(cache, parts, address) {
    return [
      { field: 'address', value: '0x' + (address >>> 0).toString(16),
        about: 'the byte the program asked for' },
      { field: 'tag', value: parts.tag,
        about: 'what distinguishes this line from the others in its set' },
      { field: 'index', value: parts.index,
        about: 'which of the ' + cache.settings.sets + ' sets it must live in' },
      { field: 'offset', value: parts.offset,
        about: 'which of the ' + cache.settings.lineBytes + ' bytes within the line' }
    ];
  }

  function legend() {
    return '<span class="pipe-key"><span class="pipe-swatch cache-clean"></span>clean</span>' +
      '<span class="pipe-key"><span class="pipe-swatch cache-dirty"></span>dirty</span>' +
      '<span class="pipe-key"><span class="pipe-swatch cache-heat-0"></span>empty set</span>' +
      '<span class="pipe-key"><span class="pipe-swatch cache-heat-4"></span>full set</span>';
  }

  /** How many sets are in use at all, which is the number that says whether a
   *  stride has collapsed the cache into one row. */
  function spread(cache, resident) {
    const used = new Set();

    resident.forEach(function (line) { used.add(line.set); });
    return { used: used.size, sets: cache.settings.sets,
      share: cache.settings.sets ? used.size / cache.settings.sets : 0,
      lines: resident.length,
      capacityUsed: cache.settings.sets * cache.settings.ways
        ? resident.length / (cache.settings.sets * cache.settings.ways) : 0 };
  }

  return { markup: markup, grid: grid, decomposition: decomposition, legend: legend,
    spread: spread, heatClass: heatClass, HEAT: HEAT };
}));
