/**
 * Section: Optimising software for the cache.
 *
 * One matrix multiplication, four versions, and every step attributable. The
 * arithmetic is identical throughout - the same 786 432 accesses in every row
 * of the table - so the difference in trips to memory is the layout and
 * nothing else.
 *
 * The three-Cs column is what makes it a method rather than a sequence of
 * tricks. Naive is conflict-dominated, so padding helps; interchanged has no
 * conflicts left at all, so padding stops helping and blocking starts; blocked
 * has almost nothing but compulsory misses, so there is nothing left to do
 * without touching less data. Each fix removes exactly the category it was
 * aimed at, and when it stops doing so that is the signal to stop.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'cache-friendly-software';
  const Table = root.DataTable;
  const Matrix = root.MatrixBlocking;
  const Hierarchy = root.Memory.Hierarchy;
  const ThreeCs = root.ThreeCs;
  const L1 = { name: 'L1d', sets: 64, ways: 8, lineBytes: 64, hitCycles: 4 };
  const CONFIG = { levels: [L1], dramCycles: 200 };
  const CAPACITY = 64 * 8 * 64;
  const TILES = [4, 8, 12, 16, 24, 32, 40, 48];
  const PADS = [0, 1, 2, 4, 8];
  const cache = {};
  let panel = null;
  let chart = null;

  const CATALOGUE = [
    { name: 'loop interchange', fixes: 'a stride-N inner loop walking a column',
      costs: 'nothing at all: the same arithmetic in a different order',
      here: 'naive to interchanged, and it removes every conflict miss' },
    { name: 'blocking or tiling', fixes: 'a working set larger than the cache',
      costs: 'a more complicated loop nest and a tile size to choose',
      here: 'interchanged to blocked, and it removes two thirds of the capacity misses' },
    { name: 'padding', fixes: 'rows that all map to the same sets',
      costs: 'a little memory, and a stride that is no longer a nice number',
      here: 'the padding table: 2.5x on the naive version, and slightly negative once blocked' },
    { name: 'structure of arrays', fixes: 'fetching fields nobody read',
      costs: 'code that reads less naturally, and worse locality if you use all the fields',
      here: 'M02 measured it; the line-size table in 37.2 is the same effect' },
    { name: 'hot and cold splitting', fixes: 'a rarely-read field sharing a line with a hot one',
      costs: 'an indirection to reach the cold half',
      here: 'not modelled: it is the same idea as structure-of-arrays at field granularity' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — which blocks are resident during one tile of the product',
      caption: 'The blocked version computes one tile of C from one tile-row of A and one '
        + 'tile-column of B, so three tiles have to be resident at once - which is where the '
        + 'sizing rule comes from. Every element of those tiles is then used tile-many times '
        + 'before any of them is evicted, which is the reuse the naive version threw away by '
        + 'walking the whole of B for every element of C.',
      definition: [
        'flowchart LR',
        '    A["A: one tile-row<br/>t x t resident"] --> P["multiply-accumulate"]',
        '    B["B: one tile-column<br/>t x t resident"] --> P',
        '    P --> C["C: one tile<br/>t x t resident, written"]',
        '    C --> N["next jj: a new B tile, the same A tile"]',
        '    N --> S{"3 x t x t x elementBytes<br/>fits in the cache?"}',
        '    S -->|"yes"| R["every element reused t times from cache"]',
        '    S -->|"no"| M["the tiles evict each other and it is the naive version again"]'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**The arithmetic never changes on this page.** Every version does the same 786 432 '
        + 'accesses in the same multiply-accumulate; only the order and the layout move. That '
        + 'is what makes the trips to memory attributable — a comparison where the instruction '
        + 'count also changed proves nothing about the cache.',
      '**Loop interchange is free and it is worth 4.4x here.** The naive i, j, k nest walks a '
        + 'COLUMN of B in its inner loop, so consecutive accesses are a whole row apart and '
        + 'each one is a different line. Swap the last two loops and the inner loop walks a '
        + 'ROW: one line now serves eight accesses. Nothing about the algorithm changed and the '
        + 'trips to memory fall from 41 992 to 9 551.',
      '**Blocking is worth another 3.1x, and it is a different fix for a different problem.** '
        + 'After interchange the conflict misses are gone and the remaining ones are capacity: '
        + 'B is re-read from memory on every pass because it does not fit. Cutting the '
        + 'multiplication into tiles that do fit takes it to 3 072 — 13.7x better than naive '
        + 'overall.',
      '**The tile size can be calculated before it is measured.** Three tiles have to be '
        + 'resident at once, so `3 t^2 x elementBytes <= capacity`, which gives 36 for a 32 KiB '
        + 'cache and 8-byte elements. The measured optimum on this grid is 40 at 2 998 trips '
        + 'against 3 292 for the calculated 36 — so the arithmetic lands within about ten per '
        + 'cent in one line, which is why this is one of the few optimisations worth doing by '
        + 'hand first.',
      '**A tile that divides the matrix does better than one that does not, and that is the '
        + 'residual.** 32 gives 3 042 and 36 gives 3 292 on a 64-wide matrix, because an '
        + 'uneven final tile has a different shape and worse reuse. The calculation gets the '
        + 'neighbourhood; the sweep gets the last ten per cent.'
    ];
  }

  function closing() {
    return [
      '**Padding is the fix for conflicts and it does nothing once they are gone.** One extra '
        + 'element per row takes the naive version from 41 992 to 16 792 trips — 2.5x for a '
        + 'few hundred bytes. Applied to the blocked version it makes things very slightly '
        + 'worse, because there were no conflict misses left to remove. That is the '
        + 'decomposition from 37.4 being used as a decision procedure rather than as a '
        + 'description.',
      '**A power-of-two dimension is the classic trap.** At n=64 the row stride is 512 bytes, '
        + 'which is exactly eight lines, so a column of B lands in only two of the sixty-four '
        + 'sets. At n=48 the stride is 384 bytes and the same column spreads over eight sets — '
        + 'and the naive version stops being slow. Change the size control and watch the '
        + 'headline gain collapse, because it was never about the algorithm.',
      '**Everything here transfers to any nested loop over a large structure.** Interchange, '
        + 'block, pad: the same three moves apply to an image convolution, a join over two '
        + 'tables, and a graph traversal over an adjacency matrix. What does not transfer is '
        + 'the specific numbers, which is why the demo is a control panel rather than a table '
        + 'of results.',
      '**None of this is worth doing before the decomposition says which one applies.** The '
        + 'blocked version of a program whose problem was conflict misses is a more complicated '
        + 'program with the same performance, and padding a version that has no conflicts left '
        + 'is measurably worse rather than neutral — 3,072 trips become 3,144, because the '
        + 'padding is still data. That is the whole argument for measuring first.'
    ];
  }

  function insight() {
    return '**The analytical tile-size rule is worth more than the number it produces, because '
      + 'it is one of the very few performance calculations that beats measurement on the '
      + 'first try.** Three tiles have to be resident, so three t-squared elements have to fit, '
      + 'so t is the square root of a third of the capacity. That takes about ten seconds, '
      + 'needs no profiler, and lands within about ten per cent of the empirical optimum here '
      + '— which is close enough that the remaining sweep is a refinement rather than a search. '
      + 'Almost every other cache optimisation is the other way round: you cannot reason about '
      + 'conflict misses without knowing the allocator\'s alignment, you cannot predict the '
      + 'prefetcher, and the honest method is to measure. The reason tiling is different is '
      + 'that it depends on a capacity rather than on a mapping, and capacities are documented '
      + 'while mappings are emergent. That distinction is worth carrying: when a performance '
      + 'question turns on how much fits, arithmetic will usually answer it; when it turns on '
      + 'where things land, only measurement will. The same split explains why database people '
      + 'can size a buffer pool on paper and cannot predict an index\'s cache behaviour, and '
      + 'why "how many of these fit in memory" is nearly always a productive question while '
      + '"which of these will collide" nearly never is.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — four versions, and the category each one removes',
        markup: root.BlockingTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.BlockingTemplate.controls,
      onChange: function () { update(app); } });
    update(app);
  }

  /** One version, replayed through a single-level hierarchy. Cached because
   *  the tile and padding sweeps ask for many of them per repaint. */
  function measure(kind, options) {
    const key = kind + ' ' + JSON.stringify(options);

    if (cache[key]) return cache[key];
    const built = Matrix[kind](options);
    const hierarchy = Hierarchy.create(CONFIG);

    Hierarchy.replay(hierarchy, built.trace);
    cache[key] = { name: built.name, trace: built.trace,
      summary: Hierarchy.summary(hierarchy) };
    return cache[key];
  }

  function reading() {
    const values = panel.values();
    const n = Number(values['cfs-n']);
    const tile = Number(values['cfs-tile']);
    const pad = Number(values['cfs-pad']);

    return { n: n, tile: tile, pad: pad,
      versions: [
        measure('naive', { n: n, pad: pad }),
        measure('interchanged', { n: n, pad: pad }),
        measure('blocked', { n: n, tile: tile, pad: pad })
      ] };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintVersions(view);
    paintThreeCs(view);
    paintTiles(view);
    paintPads(view);
    paintCatalogue();
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const naive = view.versions[0].summary.dramAccesses;
    const best = view.versions.slice().sort(function (left, right) {
      return left.summary.dramAccesses - right.summary.dramAccesses;
    })[0];
    const sweep = tileSweep(view).slice().sort(function (left, right) {
      return left.dram - right.dram;
    })[0];

    root.MetricGrid.update({
      'cfs-naive': { value: naive, note: 'the i, j, k loop nest at n=' + view.n },
      'cfs-best': { value: best.summary.dramAccesses, note: best.name },
      'cfs-gain': { value: (naive / Math.max(1, best.summary.dramAccesses)).toFixed(2) + 'x',
        note: 'identical arithmetic, different layout' },
      'cfs-tile-analytic': { value: Matrix.tileFor(CAPACITY, 8),
        note: '3 tiles of t x t x 8 bytes in ' + (CAPACITY / 1024) + ' KiB' },
      'cfs-tile-best': { value: sweep.tile,
        note: sweep.dram + ' trips, against ' + tileDram(view, Matrix.tileFor(CAPACITY, 8)) +
          ' at the calculated size' },
      'cfs-cycles': { value: view.versions[2].summary.measured.toFixed(2),
        note: 'blocked at tile ' + view.tile + ', padding ' + view.pad }
    });
  }

  function paintVersions(view) {
    const naive = view.versions[0].summary.dramAccesses;
    const changes = ['the inner loop walks a column of B: every access a new line',
      'the inner loop walks a row of B: one line serves eight accesses',
      'tiles sized to fit, so B is re-read from cache rather than from memory'];

    Table.paint('cfs-versions', view.versions.map(function (row, at) {
      return [row.name, row.summary.dramAccesses,
        at === 0 ? 'the baseline'
          : (naive / Math.max(1, row.summary.dramAccesses)).toFixed(2) + 'x fewer',
        row.summary.measured.toFixed(2), changes[at]];
    }), 'Every row does exactly ' + view.versions[0].summary.accesses + ' accesses - the same '
      + 'arithmetic in a different order. The only thing that changed is which lines were '
      + 'resident when each access happened, and it is worth '
      + (naive / Math.max(1, view.versions[2].summary.dramAccesses)).toFixed(1)
      + 'x on the trips to memory.');
  }

  function paintThreeCs(view) {
    const next = ['conflict misses dominate: pad the rows or change the stride',
      'no conflicts left; the working set does not fit, so block it',
      'almost nothing but compulsory misses: the only move left is to touch less data'];

    Table.paint('cfs-three', view.versions.map(function (row, at) {
      const found = ThreeCs.classify(row.trace, L1);

      return [row.name, found.counts.compulsory, found.counts.capacity,
        found.counts.conflict, found.dominant.name, next[at]];
    }), 'Read down the conflict column: it starts as the dominant category, goes to zero after '
      + 'the loop interchange, and stays there. Read down the capacity column: it survives the '
      + 'interchange untouched and only falls when the loop is blocked. Each fix removed the '
      + 'category it was aimed at, which is how you know the diagnosis was right rather than '
      + 'the change merely helpful.');
  }

  function tileSweep(view) {
    return TILES.map(function (tile) {
      return { tile: tile, dram: tileDram(view, tile) };
    });
  }

  function tileDram(view, tile) {
    return measure('blocked', { n: view.n, tile: tile, pad: view.pad })
      .summary.dramAccesses;
  }

  function paintTiles(view) {
    const rows = tileSweep(view);
    const best = rows.slice().sort(function (left, right) {
      return left.dram - right.dram;
    })[0];

    Table.paint('cfs-tiles', rows.map(function (row) {
      return [row.tile, (3 * row.tile * row.tile * 8) + ' B',
        row.dram, (row.dram / best.dram).toFixed(2) + 'x',
        view.n % row.tile === 0 ? 'yes' : 'no, so the last tile is a different shape'];
    }), 'The second column is the sizing rule: three tiles of t by t elements at eight bytes '
      + 'each, against a ' + (CAPACITY / 1024) + ' KiB cache. The rule picks '
      + Matrix.tileFor(CAPACITY, 8) + ' and the sweep picks ' + best.tile + ' - close enough '
      + 'that the calculation is worth doing first, and not so close that the sweep is '
      + 'pointless. The last column is the residual: a tile that divides the matrix has no '
      + 'ragged edge and does measurably better.');
  }

  function paintPads(view) {
    const base = measure('naive', { n: view.n, pad: 0 }).summary.dramAccesses;

    Table.paint('cfs-pads', PADS.map(function (pad) {
      const found = measure('naive', { n: view.n, pad: pad });
      const three = ThreeCs.classify(found.trace, L1);

      return [pad + ' elements', ((view.n + pad) * 8) + ' B', found.summary.dramAccesses,
        pad === 0 ? 'the baseline'
          : (base / Math.max(1, found.summary.dramAccesses)).toFixed(2) + 'x fewer',
        three.counts.conflict];
    }), 'Padding changes the row stride so that consecutive rows stop landing in the same '
      + 'sets, and the conflict column in the last position is what actually moves. On a '
      + 'power-of-two matrix a single extra element is worth 2.5x for a few hundred bytes of '
      + 'memory; on a size that was never a power of two it does almost nothing, because there '
      + 'were no conflicts to break. Change the size control and both columns change '
      + 'character.');
  }

  function paintCatalogue() {
    Table.paint('cfs-catalogue', CATALOGUE.map(function (row) {
      return [row.name, row.fixes, row.costs, row.here];
    }), 'Five transformations, and the second column is the one to match against the three-Cs '
      + 'verdict. Applying the wrong one is not neutral: blocking a program whose problem was '
      + 'conflicts leaves a more complicated program at the same speed, and padding a program '
      + 'whose working set is ten times the cache changes nothing at all.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#cfs-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, { lazyLib: app.lazyLib, height: 250,
      yLabel: 'trips to memory',
      values: view.versions.map(function (row, at) {
        return { label: ['naive', 'interchanged', 'blocked'][at],
          value: row.summary.dramAccesses, series: at };
      }).concat([{ label: 'naive, padded',
        value: measure('naive', { n: view.n, pad: 1 }).summary.dramAccesses, series: 3 }]) });
    root.Helpers.setText('cfs-chart-note', 'Four bars, identical arithmetic. The gap between '
      + 'the first two is loop order; between the second and third is blocking; the fourth is '
      + 'the naive version with one element of padding, which recovers most of what the '
      + 'interchange gives for a change that touches the allocation rather than the loop. Two '
      + 'different fixes for the same measured problem, and the decomposition above is what '
      + 'says they address it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
