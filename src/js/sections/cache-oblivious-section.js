/**
 * Section: cache-oblivious algorithms.
 *
 * The claim is easy to state and easy to get wrong in a demo: an algorithm
 * given neither the cache size nor the line size matches one that was tuned
 * for both. The way to show it is to RETUNE the reference at every cache size
 * and watch which column moves. The demo does exactly that — the best tile
 * changes from 8 to 16 to 32 and back to 4 as the cache grows, and the
 * recursive version, which has no tile at all, stays within a third of it
 * throughout.
 *
 * The van Emde Boas half carries the sharper result. The same tree, the same
 * comparisons per search, three different layouts, and the miss count differs
 * by a factor of two — because a layout is not a detail, it is the only thing
 * a cache can see.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'cache-oblivious';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — recursive subdivision, which is blocking at every scale at once',
      caption: 'A tiled algorithm picks one block size and gets good locality at that scale and ' +
        'no other. A recursive one halves the problem repeatedly, so it produces subproblems at ' +
        'every scale — and whatever the cache size is, SOME level of that recursion has ' +
        'subproblems that just fit. Every level below it is then entirely inside the cache and ' +
        'free, and the levels above are amortised over the work beneath them. Nothing in the ' +
        'algorithm mentions B or M; the blocking is a consequence of the recursion rather than a ' +
        'parameter of it. The assumption this needs is the tall cache — M = Ω(B²) — and a cache ' +
        'that is wide and shallow breaks the bounds rather than degrading them.',
      definition: [
        'flowchart TD',
        '    A["n × n"] --> B["n/2 × n/2"]',
        '    A --> C["n/2 × n/2"]',
        '    A --> D["n/2 × n/2"]',
        '    A --> E["n/2 × n/2"]',
        '    B --> F["n/4 × n/4"]',
        '    B --> G["…"]',
        '    F -.- H["at SOME level the subproblem<br/>fits in whatever cache is present"]',
        '    H --> I["every level below is free"]',
        '    H --> J["and no level mentioned M or B"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A cache-aware algorithm is handed B and M and blocks its work to fit; a cache-oblivious ' +
        'one is handed neither and gets asymptotically the same miss count.** The mechanism is ' +
        'recursion: halve the problem until it is small, and at some level of that recursion the ' +
        'subproblem fits in whatever cache is actually present.',
      '**The comparison only means something if the tuned version is retuned.** A recursive ' +
        'algorithm against a tile that was chosen for one cache and then used on four is not a ' +
        'comparison, it is a rigged one. The demo picks the best tile at every cache size ' +
        'separately, and the tile it picks changes — which is the whole reason the oblivious ' +
        'version is worth having.',
      '**Transpose is the simplest case and the row-major loop is the failure.** Reading one ' +
        'matrix along rows while writing the other along columns means one side misses on every ' +
        'element. Splitting the larger dimension and recursing makes both sides local, with no ' +
        'parameter and no knowledge of the cache.',
      '**Matrix multiplication is where the numbers are dramatic.** The textbook triple loop ' +
        'misses on nearly every access once the matrices exceed the cache; blocking brings it to ' +
        'O(n³/(B·√M)); recursive subdivision reaches the same bound. The demo measures the ' +
        'unblocked loop at tens of times the tuned version at a small cache and at parity when ' +
        'everything fits.',
      '**The van Emde Boas layout reaches the B-tree bound without knowing B.** Lay a binary ' +
        'tree out by splitting its HEIGHT in half — the top subtree contiguous, then each bottom ' +
        'subtree contiguous, recursively — and a root-to-leaf search touches O(log_B n) blocks ' +
        'instead of O(log₂ n − log₂ B).',
      '**The comparison count does not change; only where the nodes sit does.** The demo reports ' +
        'comparisons per search alongside misses per search, and the first column is identical ' +
        'in all three layouts. Everything in the miss column is layout, which is the cleanest ' +
        'possible statement of what a cache can and cannot see.',
      '**The tall-cache assumption is load-bearing and is worth stating.** The bounds need ' +
        'M = Ω(B²) — a cache that can hold at least B blocks. Real caches satisfy it ' +
        'comfortably, and a machine with a very wide line and a very small cache would break ' +
        'these results rather than degrade them gently.',
      '**Cache-oblivious is not always the right choice, and the demo shows the cost.** The ' +
        'recursive versions carry a constant-factor penalty against a well-tuned tile — a third ' +
        'or so here — plus real call overhead the miss counter does not see. What they buy is ' +
        'behaviour on machines nobody measured, across cache levels simultaneously, with no ' +
        'tuning to go stale.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — retuning the tile at every cache size, and three tree layouts',
        markup: root.CacheObliviousTemplate.render()
      },
      diagram: diagram(),
      insight: '**Recursive subdivision is the cheapest way to get decent locality on hardware ' +
        'you cannot measure.** A library shipped to unknown machines has no tile size to pick, ' +
        'and a tile tuned for L2 is wrong for L1 and wrong again for the page cache — while a ' +
        'recursive algorithm is simultaneously correct for all three, because it produces ' +
        'subproblems at every scale at once. The engineering caveat is the base case: recursing ' +
        'to single elements pays call overhead that no miss counter shows, so cut over to a ' +
        'straight loop at a size that fits in registers and let the recursion handle everything ' +
        'above it. That one decision is the difference between the idea and a usable ' +
        'implementation.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.CacheObliviousTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const multiplyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.DamLab.multiplyStudy({ n: Number(parts[0]), cutoff: Number(parts[1]) });
  });

  const layoutFor = root.Helpers.memoise(function (key) {
    const height = Number(key);
    const heights = [];
    for (let h = 10; h <= Math.max(18, height); h += 2) heights.push(h);
    return root.DamLab.layoutStudy({ heights: heights });
  });

  function update(app) {
    const values = panel.values();
    const multiply = multiplyFor(values['cob-size'] + '|' + values['cob-cutoff']);
    const layout = layoutFor(values['cob-height']);

    paintMetrics(multiply, layout, Number(values['cob-height']));
    paintChart(app, multiply);
    paintMultiply(multiply);
    paintTiles(multiply);
    paintLayout(layout, Number(values['cob-height']));
  }

  function paintMetrics(multiply, layout, height) {
    const tiles = multiply.rows.map(function (row) { return row.bestTile; });
    const worstPenalty = Math.max.apply(null, multiply.rows.map(function (row) {
      return row.obliviousPenalty;
    }));
    const worstNaive = Math.max.apply(null, multiply.rows.map(function (row) {
      return row.naivePenalty;
    }));
    const row = layout.rows.filter(function (entry) { return entry.height === height; })[0] ||
      layout.rows[layout.rows.length - 1];

    root.MetricGrid.update({
      'cob-tuned': { value: tiles.join(' → '),
        note: 'the best tile is different at ' +
          root.Format.exact(new Set(tiles).size) + ' of the ' +
          root.Format.exact(tiles.length) + ' cache sizes' },
      'cob-penalty': { value: root.Format.fixed(worstPenalty, 3) + '×',
        note: 'the recursive version has no tile and is never told the cache size' },
      'cob-naive': { value: root.Format.fixed(worstNaive, 1) + '×',
        note: 'the unblocked triple loop, at the cache size where it is worst' },
      'cob-veb': { value: root.Format.fixed(row.veb, 2) + ' vs ' +
        root.Format.fixed(row.sortedArray, 2),
        note: 'at height ' + root.Format.exact(row.height) + ', on identical comparison counts' }
    });
  }

  function paintChart(app, multiply) {
    const host = root.jQuery('#cob-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, logX: true, logY: true, yMin: 1,
      xLabel: 'cache size in kilobytes (log scale)', yLabel: 'misses (log scale)',
      series: [
        { label: 'unblocked triple loop', points: multiply.rows.map(function (row) {
          return { x: row.kilobytes, y: row.naive };
        }) },
        { label: 'tiled, retuned at every size', points: multiply.rows.map(function (row) {
          return { x: row.kilobytes, y: row.bestTiled };
        }) },
        { label: 'recursive, no parameter', points: multiply.rows.map(function (row) {
          return { x: row.kilobytes, y: row.recursive };
        }) }
      ]
    });

    const small = multiply.rows[0];
    const large = multiply.rows[multiply.rows.length - 1];
    root.Helpers.setText('cob-chart-note',
      'Three implementations of the same ' + root.Format.exact(multiply.n) + ' × ' +
      root.Format.exact(multiply.n) + ' product, over caches from ' +
      root.Format.exact(small.kilobytes) + 'KB to ' + root.Format.exact(large.kilobytes) + 'KB. ' +
      'The middle line is retuned at every point — its tile is ' +
      root.Format.exact(small.bestTile) + ' at the smallest cache and ' +
      root.Format.exact(large.bestTile) + ' at the largest — so it is the best a cache-aware ' +
      'implementation could do if somebody measured each machine. The bottom line has no tile ' +
      'and was never told anything, and it tracks the middle one within ' +
      root.Format.fixed(Math.max.apply(null, multiply.rows.map(function (row) {
        return row.obliviousPenalty;
      })), 2) + '×. The top line is what happens when nobody blocks at all.');
  }

  function paintMultiply(multiply) {
    root.jQuery('#cob-multiply tbody').html(multiply.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.kilobytes) + 'KB</td>' +
        '<td class="mono">' + root.Format.exact(row.naive) + '</td><td class="mono">' +
        root.Format.exact(row.bestTile) + '</td><td class="mono">' +
        root.Format.exact(row.bestTiled) + '</td><td class="mono">' +
        root.Format.exact(row.recursive) + '</td><td class="mono">' +
        root.Format.fixed(row.obliviousPenalty, 3) + '×</td><td class="mono">' +
        root.Format.fixed(row.naivePenalty, 2) + '×</td></tr>';
    }).join(''));

    const changed = new Set(multiply.rows.map(function (row) { return row.bestTile; })).size;
    root.Helpers.setText('cob-multiply-note',
      'The third column is the point of the table: the best tile changes ' +
      root.Format.exact(changed) + ' times across four cache sizes, so a tuned implementation is ' +
      'tuned for ONE of these rows and wrong for the others. The recursive column is a single ' +
      'implementation across all four, within ' +
      root.Format.fixed(Math.max.apply(null, multiply.rows.map(function (r) {
        return r.obliviousPenalty;
      })), 2) + '× of the retuned reference everywhere. Note also what happens on the last row: ' +
      'once everything fits in cache the unblocked loop is as good as anything, which is worth ' +
      'remembering before blocking a computation that was never going to miss.');
  }

  function paintTiles(multiply) {
    root.jQuery('#cob-tiles tbody').html(multiply.rows.map(function (row) {
      const cells = multiply.tiles.map(function (tile) {
        const entry = row.tiled.filter(function (item) { return item.tile === tile; })[0];
        const best = entry && entry.tile === row.bestTile;
        return '<td class="mono">' + (entry ? root.Format.exact(entry.misses) : '—') +
          (best ? ' ●' : '') + '</td>';
      }).join('');
      return '<tr><td class="mono">' + root.Format.exact(row.kilobytes) + 'KB</td>' + cells +
        '<td class="mono">' + root.Format.exact(row.recursive) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('cob-tiles-note',
      'Every tile size at every cache size, with the winner marked. Read a row across and the ' +
      'penalty for the wrong tile is visible; read a column down and the same tile goes from ' +
      'best to worst as the cache changes. That is the failure mode of cache-aware tuning stated ' +
      'as a table: the parameter is correct for the machine it was measured on and it does not ' +
      'travel, and nothing in the code says so.');
  }

  function paintLayout(layout, height) {
    root.jQuery('#cob-layout tbody').html(layout.rows.map(function (row) {
      const mark = row.height === height ? ' ●' : '';
      return '<tr><td class="mono">' + root.Format.exact(row.height) + mark +
        '</td><td class="mono">' + root.Format.exact(row.nodes) + '</td><td class="mono">' +
        root.Format.fixed(row.comparisons, 1) + '</td><td class="mono">' +
        root.Format.fixed(row.levelOrder, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.sortedArray, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.veb, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.predicted, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.saving, 2) + '×</td></tr>';
    }).join(''));

    const small = layout.rows[0];
    const large = layout.rows[layout.rows.length - 1];
    root.Helpers.setText('cob-layout-note',
      'The comparison column is the tree height in every row and is identical across the three ' +
      'layouts — the same search, the same decisions, the same work. Everything after it is ' +
      'where the nodes sit. At height ' + root.Format.exact(small.height) + ' the tree is ' +
      root.Format.exact(small.nodes) + ' nodes and fits in the cache, so all three layouts are ' +
      'the same and the vEB order is actually slightly worse — its top subtree is contiguous but ' +
      'its bottom ones are scattered, and with nothing to gain that costs a little. At height ' +
      root.Format.exact(large.height) + ' the tree is ' + root.Format.exact(large.nodes) +
      ' nodes, a sorted array costs ' + root.Format.fixed(large.sortedArray, 2) +
      ' misses per search and the vEB layout costs ' + root.Format.fixed(large.veb, 2) +
      ' — close to log_B n = ' + root.Format.fixed(large.predicted, 2) + ', which is the B-tree ' +
      'bound reached by a binary tree that was never told what a block is.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
