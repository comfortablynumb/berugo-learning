/**
 * HeapMapView — the heap as a picture, coloured by whatever question is being
 * asked of it.
 *
 * One renderer with four colourings rather than four renderers, because they
 * are the same picture: every object in the heap, in address order, one tile
 * each, sized by its bytes. What changes is the legend.
 *
 * - **mark** — the tri-colour state during a trace, which is the only way to
 *   watch marking happen rather than read about it;
 * - **age** — young against promoted, which is what a generational collector
 *   is deciding about;
 * - **region** — the partition an evacuating collector chooses within;
 * - **live** — reachable against garbage, taken from the liveness oracle
 *   rather than from any collector, so the picture can disagree with the
 *   collector and that disagreement is the bug.
 *
 * Drawn as HTML tiles rather than canvas: these heaps are hundreds of objects,
 * not millions, and a tile the learner can hover and read the id off is worth
 * more here than a pixel that scales to a million. The fragmentation strip is
 * the exception the section 31.3 needs — free space drawn to scale beside the
 * live objects, because "70 per cent free in sixteen-byte pieces" is a
 * sentence nobody believes until they see the pieces.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.HeapMapView = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const MAX_TILES = 600;

  const SCHEMES = {
    mark: { title: 'mark state',
      legend: [{ label: 'white — not reached', hue: 'gray' },
        { label: 'grey — reached, not scanned', hue: 'amber' },
        { label: 'black — scanned', hue: 'indigo' }],
      of: function (cell) {
        if (cell.colour === 'black') return 'indigo';
        return cell.colour === 'grey' ? 'amber' : 'gray';
      } },
    age: { title: 'age',
      legend: [{ label: 'new this cycle', hue: 'teal' },
        { label: 'survived once', hue: 'blue' },
        { label: 'promoted', hue: 'purple' }],
      of: function (cell) {
        if (cell.age >= 2) return 'purple';
        return cell.age >= 1 ? 'blue' : 'teal';
      } },
    region: { title: 'region',
      legend: [], of: function (cell) { return null; } },
    live: { title: 'reachability, from the oracle',
      legend: [{ label: 'reachable', hue: 'green' },
        { label: 'unreachable — garbage', hue: 'red' }],
      of: function (cell, options) {
        return options.live && options.live.has(cell.id) ? 'green' : 'red';
      } }
  };

  function schemeOf(name) {
    return SCHEMES[name] || SCHEMES.live;
  }

  function colourFor(hue) {
    return scope && scope.Palette ? scope.Palette.hue(hue) : hue;
  }

  function softFor(hue) {
    return scope && scope.Palette ? scope.Palette.soft(hue) : hue;
  }

  /* ----------------------------------------------------------- the tiles */

  /**
   * The heap map. Objects are laid out in id order, which is allocation
   * order, which is the order a bump allocator puts them in memory — so
   * adjacency on this picture is adjacency in the heap, and that is what
   * makes the region and card-table pictures mean anything.
   */
  function map(cells, options) {
    const settings = options || {};
    const rows = Array.from(cells).sort(function (a, b) { return a.id - b.id; });
    const shown = rows.slice(0, settings.limit || MAX_TILES);
    const scheme = schemeOf(settings.scheme);

    return '<div class="heap-map">' + shown.map(function (cell) {
      return tile(cell, scheme, settings);
    }).join('') + '</div>' + legend(scheme, rows, settings)
      + note(rows.length, shown.length);
  }

  function tile(cell, scheme, settings) {
    const hue = settings.scheme === 'region'
      ? regionHue(cell) : scheme.of(cell, settings);
    const marked = settings.highlight && settings.highlight.indexOf(cell.id) !== -1;

    return '<span class="heap-tile' + (marked ? ' heap-tile-marked' : '')
      + '" style="background:' + colourFor(hue) + '" title="#' + cell.id + ' · '
      + cell.size + ' bytes · age ' + (cell.age || 0) + ' · ' + (cell.colour || 'white')
      + '"></span>';
  }

  function regionHue(cell) {
    const hues = ['blue', 'orange', 'green', 'purple', 'teal', 'pink', 'amber', 'indigo'];

    return hues[(cell.region === undefined ? 0 : cell.region) % hues.length];
  }

  function legend(scheme, rows, settings) {
    const entries = settings.scheme === 'region'
      ? regionLegend(rows) : scheme.legend;

    if (!entries.length) return '';
    return '<p class="heap-legend">' + entries.map(function (entry) {
      return '<span class="heap-key"><span class="heap-swatch" style="background:'
        + colourFor(entry.hue) + '"></span>' + entry.label + '</span>';
    }).join(' ') + '</p>';
  }

  function regionLegend(rows) {
    const seen = [];

    rows.forEach(function (cell) {
      const region = cell.region === undefined ? 0 : cell.region;

      if (seen.indexOf(region) === -1) seen.push(region);
    });
    return seen.slice(0, 8).sort(function (a, b) { return a - b; })
      .map(function (region) {
        return { label: 'region ' + region, hue: regionHue({ region: region }) };
      });
  }

  function note(total, shown) {
    if (total <= shown) return '<p class="note">' + total + ' objects, all drawn.</p>';
    return '<p class="note">' + shown + ' of ' + total + ' objects drawn — the map is '
      + 'capped so a tile stays large enough to point at. The metrics above are over '
      + 'all ' + total + '.</p>';
  }

  /* ---------------------------------------------------- the free-space strip
   *
   * Fragmentation is a claim about the SHAPE of free space, not its size, and
   * the number that matters is the largest single hole. A strip drawn to
   * scale is the only way that reads: the same free byte count in one run and
   * in forty pieces look nothing alike.
   */
  function fragmentation(runs, options) {
    const settings = options || {};
    const total = runs.reduce(function (sum, run) { return sum + run.size; }, 0) || 1;

    return '<div class="heap-strip">' + runs.map(function (run) {
      const width = Math.max(0.15, (run.size / total) * 100);

      return '<span class="heap-run" style="width:' + width.toFixed(3) + '%;background:'
        + (run.free ? softFor('gray') : colourFor('blue')) + '" title="'
        + (run.free ? 'free ' : 'live ') + run.size + ' bytes"></span>';
    }).join('') + '</div>' + (settings.caption
      ? '<p class="note">' + settings.caption + '</p>' : '');
  }

  /**
   * Lay a heap out at its addresses and report the runs. Free runs come from
   * the gaps a sweep leaves; a compaction produces exactly one.
   */
  function runsOf(cells, capacity) {
    const rows = Array.from(cells).sort(function (a, b) {
      return addressOf(a) - addressOf(b);
    });
    const runs = [];
    let at = 0;

    rows.forEach(function (cell) {
      const start = addressOf(cell);

      if (start > at) runs.push({ free: true, size: start - at });
      runs.push({ free: false, size: cell.size, id: cell.id });
      at = start + cell.size;
    });
    if (capacity > at) runs.push({ free: true, size: capacity - at });
    return runs;
  }

  function addressOf(cell) {
    return cell.address === undefined ? cell.id * 16 : cell.address;
  }

  /** The largest hole, which is what an allocation request actually meets. */
  function largestHole(runs) {
    return runs.reduce(function (most, run) {
      return run.free ? Math.max(most, run.size) : most;
    }, 0);
  }

  function freeBytes(runs) {
    return runs.reduce(function (sum, run) { return sum + (run.free ? run.size : 0); }, 0);
  }

  return { SCHEMES: SCHEMES, map: map, fragmentation: fragmentation,
    runsOf: runsOf, largestHole: largestHole, freeBytes: freeBytes,
    schemeOf: schemeOf };
}));
