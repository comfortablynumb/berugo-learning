/**
 * Section: caching and page-replacement policies.
 *
 * The demo is a bake-off with a ceiling. Belady's optimal offline policy is
 * computed on the same trace as everything else, so "58.7% of requests hit" is
 * a number with a meaning — it is 80.9% of what was available. Without the
 * ceiling a hit rate is a property of the trace as much as of the policy, and
 * comparing two hit rates measured on two traces is comparing nothing.
 *
 * The failure the whole section is arranged around is the scan. One pass over
 * data larger than the cache walks the working set out of it under LRU, FIFO
 * and CLOCK alike, and every policy invented since is an answer to that. The
 * loop trace is the sharper version: a cycle just larger than the cache takes
 * every recency policy to ZERO hits while Belady gets most of them, which is
 * LRU's k-competitiveness attained exactly.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'page-replacement';
  let panel = null;
  let chart = null;

  const TRUSTS = {
    fifo: 'arrival order, and nothing else',
    lru: 'recency — k-competitive, and that bound is attained by a loop',
    lfu: 'frequency, which survives a scan and not a change of favourites',
    clock: 'recency, approximated with one bit per entry and a moving hand',
    arc: 'both, with two ghost lists deciding which half is being starved',
    'two-queue': 'a second sighting: newcomers wait in a FIFO before the main cache',
    'w-tinylfu': 'an approximate frequency count, with admission by contest'
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — ARC’s four lists, and the evidence that moves the boundary',
      caption: 'T1 holds items seen once and T2 items seen at least twice; together they are the ' +
        'cache. B1 and B2 are GHOST lists — keys recently evicted from T1 and T2, with no data ' +
        'attached — and they are the whole mechanism. A hit in B1 says "an item I had seen once ' +
        'came back after I evicted it", which is evidence that the recency half is too small, so ' +
        'the target p moves towards T1. A hit in B2 says the opposite. Nothing is tuned and no ' +
        'workload is assumed: the adaptation is driven by the mistakes the cache has just made, ' +
        'and the same code performs like LRU on a recency workload and like LFU on a frequency ' +
        'one.',
      definition: [
        'stateDiagram-v2',
        '    [*] --> T1: first sighting',
        '    T1 --> T2: seen again',
        '    T2 --> T2: seen again',
        '    T1 --> B1: evicted (ghost, key only)',
        '    T2 --> B2: evicted (ghost, key only)',
        '    B1 --> T2: hit in a ghost — p<br/>grows, recency was<br/>starved',
        '    B2 --> T2: hit in a ghost — p<br/>shrinks, frequency was<br/>starved',
        '    B1 --> [*]: forgotten',
        '    B2 --> [*]: forgotten'
      ].join('\n')
    };
  }

  function orientationCeiling() {
    return [
      '**Belady’s rule is optimal and needs the future, so it exists as a ceiling rather than as ' +
        'an algorithm.** Evict the resident item whose next use is furthest away.',
      'Every hit rate in the demo is reported next to it, because a hit rate on its own is a ' +
        'property of the trace as much as of the policy.',
      'The same LRU cache reads 46% on one trace and 0% on another, and only the ceiling says ' +
        'which of those is a failure.',
      '**LRU is k-competitive against Belady, and no deterministic policy does better.** With a ' +
        'cache of k entries, LRU can miss at most k times where the optimum misses once.',
      'That bound is not conservative. A loop just larger than the cache attains it, and the demo ' +
        'shows LRU, FIFO and CLOCK all at exactly ZERO hits on it while Belady gets most of them.',
      '**LRU is not scan resistant, and that single failure is the reason every later policy ' +
        'exists.** One pass over data larger than the cache touches each item once, and each touch ' +
        'evicts something from the working set.',
      'So the scan destroys the cache while gaining nothing from it.',
      'The demo measures how much of each policy’s Zipf hit rate survives when a sweep is added.',
      '**LFU survives the scan and fails differently.** Counting rather than timing makes one-hit ' +
        'wonders unevictable in the wrong direction.',
      'An item hot last week keeps its count forever and cannot be displaced by something hot ' +
        'today.',
      'The fix is decay, which means halving the counts periodically. Without it LFU is a cache ' +
        'that remembers everything and forgets nothing.'
    ];
  }

  function orientationPolicies() {
    return [
      '**CLOCK is LRU’s approximation and exists because of what hardware can do.** One reference ' +
        'bit per page, and a hand that sweeps, clearing bits and taking the first slot already ' +
        'clear.',
      'Setting a bit is something a memory-management unit does for free, and splicing a linked ' +
        'list on every access is not. That is why operating systems use CLOCK and application ' +
        'caches use LRU.',
      '**ARC adapts with no dial by keeping ghosts.** It keeps two lists for the cache, one of ' +
        'items seen once and one of items seen twice, plus two lists of keys recently evicted from ' +
        'each.',
      'A hit in a ghost list is evidence about which half is being starved, so ARC moves a target ' +
        'boundary towards it.',
      'On the Zipf trace the demo counts thousands of those adjustments. On the mixed trace it ' +
        'counts NONE.',
      'A target of zero is the adaptation rather than the absence of one. The scanned keys never ' +
        'come back, so recency is worth nothing, and ARC has been told so.',
      '**2Q reaches most of the same benefit with much less machinery.** It is a small FIFO for ' +
        'newcomers, a ghost queue of what fell out of it, and a main LRU that admits only on a ' +
        'second sighting.',
      'A scan fills the small queue, its keys expire unseen, and the main cache is never touched.',
      '**W-TinyLFU admits by frequency, and it is the strongest policy in the table.** A candidate ' +
        'evicted from a small window must beat the main cache’s next victim on an approximate ' +
        'frequency count before it is admitted, with a tie going to the incumbent.',
      'A scan’s one-hit wonders lose every contest they enter.',
      'On the loop trace, where every recency policy scores zero, that tie-break alone takes it to ' +
        '81% against Belady’s 82%.'
    ];
  }

  function orientation() {
    return orientationCeiling().concat(orientationPolicies());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — seven policies, four traces, and Belady drawn as the ceiling',
        markup: root.PageReplacementTemplate.render()
      },
      diagram: diagram(),
      insight: '**Before tuning a cache, measure its hit rate against Belady on your own trace, ' +
        'and then look at what a scan does to it.** The ceiling tells you whether there is ' +
        'anything left to win. A policy at 99% of the optimum cannot be improved by a better ' +
        'policy, only by a bigger cache, and the working-set curve says how much bigger is worth ' +
        'buying. The scan column tells you the other half. Almost every production cache ' +
        'incident that reads as "the cache stopped working at 3 a.m." is a batch job sweeping a ' +
        'table through an LRU. The fix is not more memory. It is admission control, which costs ' +
        'a frequency sketch and a comparison.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PageReplacementTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const compareFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.CacheLab.compare({ kind: parts[0], capacity: Number(parts[1]),
      length: Number(parts[2]) });
  });

  const curveFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.CacheLab.workingSetCurve({ kind: parts[0], length: Number(parts[1]) });
  });

  const resistFor = root.Helpers.memoise(function (key) {
    return root.CacheLab.scanResistance({ capacity: Number(key) });
  });

  const arcFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.CacheLab.adaptationTrace({ kind: parts[0], capacity: Number(parts[1]),
      length: Number(parts[2]) });
  });

  function update(app) {
    const values = panel.values();
    const key = values['pgr-trace'] + '|' + values['pgr-capacity'] + '|' + values['pgr-length'];
    const compare = compareFor(key);

    paintMetrics(compare, resistFor(values['pgr-capacity']));
    paintChart(app, curveFor(values['pgr-trace'] + '|' + values['pgr-length']));
    paintTable(compare);
    paintResistance(resistFor(values['pgr-capacity']));
    paintArc(arcFor(key));
  }

  function bestOf(compare) {
    return compare.rows.reduce(function (winner, row) {
      return row.hitRate > winner.hitRate ? row : winner;
    }, compare.rows[0]);
  }

  function rowFor(compare, name) {
    return compare.rows.filter(function (row) { return row.name === name; })[0];
  }

  function paintMetrics(compare, resist) {
    const best = bestOf(compare);
    const lru = rowFor(compare, 'lru');
    const lruResist = resist.rows.filter(function (row) { return row.name === 'lru'; })[0];

    root.MetricGrid.update({
      'pgr-best': { value: root.Format.percent(best.hitRate, 1),
        note: best.name + ', on a trace of ' + root.Format.exact(compare.length) +
          ' requests over ' + root.Format.exact(compare.distinct) + ' distinct keys' },
      'pgr-optimum': { value: root.Format.percent(compare.optimum.hitRate, 1),
        note: 'Belady, which needs the whole trace in advance and is therefore unshippable' },
      'pgr-lru': { value: root.Format.percent(lru.hitRate, 1),
        note: root.Format.percent(lru.ofOptimum, 1) + ' of the ceiling' },
      'pgr-scan': { value: root.Format.percent(lruResist.retained, 0),
        note: 'LRU keeps this much of its Zipf hit rate once a sweep is added' }
    });
  }

  function paintChart(app, curve) {
    const host = root.jQuery('#pgr-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 260, logX: true,
      xLabel: 'cache entries (log scale)', yLabel: 'hit rate',
      series: curve.series.map(function (entry) {
        return { label: entry.name, dashed: entry.name === 'belady',
          points: entry.points.map(function (point) {
            return { x: point.capacity, y: point.hitRate };
          }) };
      })
    });

    const belady = curve.series.filter(function (entry) { return entry.name === 'belady'; })[0];
    const lru = curve.series.filter(function (entry) { return entry.name === 'lru'; })[0];
    const first = curve.sizes[0];
    const last = curve.sizes[curve.sizes.length - 1];
    root.Helpers.setText('pgr-chart-note',
      'The dashed line is Belady and nothing can be above it. On this trace, over ' +
      root.Format.exact(curve.distinct) + ' distinct keys, the optimum goes from ' +
      root.Format.percent(belady.points[0].hitRate, 1) + ' at ' + root.Format.exact(first) +
      ' entries to ' + root.Format.percent(belady.points[belady.points.length - 1].hitRate, 1) +
      ' at ' + root.Format.exact(last) + '. LRU goes from ' +
      root.Format.percent(lru.points[0].hitRate, 1) + ' to ' +
      root.Format.percent(lru.points[lru.points.length - 1].hitRate, 1) + '. The gap between the ' +
      'curves is what a better POLICY could win; the slope of the ceiling is what more MEMORY ' +
      'could win, and they are different purchases. A capacity decision made from a single hit ' +
      'rate at a single size is a decision made from one point on this plot.');
  }

  function paintTable(compare) {
    const rows = compare.rows.slice().sort(function (a, b) { return b.hitRate - a.hitRate; });

    root.jQuery('#pgr-table tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td class="mono">' +
        root.Format.percent(row.hitRate, 1) + '</td><td class="mono">' +
        root.Format.percent(row.ofOptimum, 1) + '</td><td class="mono">' +
        root.Format.exact(row.hits) + '</td><td class="mono">' +
        root.Format.exact(row.misses) + '</td><td class="mono">' +
        root.Format.exact(row.evictions) + '</td><td>' + (TRUSTS[row.name] || '') + '</td></tr>';
    }).join('') + '<tr><td class="mono">belady (offline)</td><td class="mono">' +
      root.Format.percent(compare.optimum.hitRate, 1) + '</td><td class="mono">100.0%</td>' +
      '<td class="mono">' + root.Format.exact(compare.optimum.hits) + '</td><td class="mono">' +
      root.Format.exact(compare.optimum.misses) + '</td><td class="mono">' +
      root.Format.exact(compare.optimum.evictions) + '</td><td>the future</td></tr>');

    const worst = rows[rows.length - 1];
    const best = rows[0];
    root.Helpers.setText('pgr-table-note',
      'The third column is the one to read. On this trace the best policy reaches ' +
      root.Format.percent(best.ofOptimum, 1) + ' of what was available and the worst reaches ' +
      root.Format.percent(worst.ofOptimum, 1) + ', and the difference between them is a policy ' +
      'decision worth ' + root.Format.percent(best.hitRate - worst.hitRate, 1) + ' of all ' +
      'requests. Switch the trace control to "loop" for the case that separates them ' +
      'completely: a cycle just larger than the cache takes every recency policy to zero hits, ' +
      'because each item is evicted exactly one step before it is needed again — which is LRU’s ' +
      'k-competitiveness attained rather than approached.');
  }

  function paintResistance(resist) {
    const rows = resist.rows.slice().sort(function (a, b) { return b.retained - a.retained; });

    root.jQuery('#pgr-resist tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td class="mono">' +
        root.Format.percent(row.zipf, 1) + '</td><td class="mono">' +
        root.Format.percent(row.scan, 1) + '</td><td class="mono">' +
        root.Format.percent(row.retained, 0) + '</td><td class="mono">' +
        (row.retained > 0.55 ? 'yes' : 'no') + '</td></tr>';
    }).join(''));

    const recency = rows.filter(function (row) {
      return ['lru', 'fifo', 'clock'].indexOf(row.name) !== -1;
    });
    const resistant = rows.filter(function (row) { return row.retained > 0.55; });
    root.Helpers.setText('pgr-resist-note',
      'Two traces with the same hot set, one of them interrupted by sweeps through cold data. ' +
      'The three recency policies retain ' + recency.map(function (row) {
        return root.Format.percent(row.retained, 0);
      }).join(', ') + ' of their hit rate; ' + root.Format.exact(resistant.length) +
      ' policies retain more than half. The mechanism is the same in every one of them and it is ' +
      'ADMISSION rather than eviction: something has to decide that a key seen once is not worth ' +
      'the space, and recency cannot express that because a key seen once is maximally recent. ' +
      'The scan optimum is ' + root.Format.percent(resist.scanOptimum, 1) + ', so even Belady ' +
      'loses ground here — a sweep genuinely costs, and the question is only how much.');
  }

  function paintArc(study) {
    const shown = study.points.filter(function (point, index) {
      return index % Math.max(1, Math.floor(study.points.length / 10)) === 0;
    }).slice(0, 11);

    root.jQuery('#pgr-arc tbody').html(shown.map(function (point) {
      return '<tr><td class="mono">' + root.Format.exact(point.at) + '</td><td class="mono">' +
        root.Format.fixed(point.p, 1) + '</td><td class="mono">' +
        root.Format.exact(point.t1) + '</td><td class="mono">' +
        root.Format.exact(point.t2) + '</td><td class="mono">' +
        root.Format.percent(point.hitRate, 1) + '</td></tr>';
    }).join(''));

    const final = study.final;
    root.Helpers.setText('pgr-arc-note', arcNote(study, final));
  }

  /** p = 0 with no adaptations is a RESULT, not a stuck dial: on a trace whose
   *  cold keys never return, a ghost hit never happens and recency is
   *  correctly valued at nothing. Reporting it as "it did not adapt" would be
   *  the opposite of what the measurement says. */
  function arcNote(study, final) {
    const seen = root.Format.exact(study.points[study.points.length - 1].at);

    if (final.adaptations === 0) {
      return 'p is the target size of the recency half, out of a cache of ' +
        root.Format.exact(study.capacity) + ', and on this trace it never moves from zero. That ' +
        'is not a stuck dial — it is the answer. The cold keys in this trace are swept once and ' +
        'never requested again, so a key evicted from the recency list never turns up in a ghost ' +
        'list, ARC is never told that recency was starved, and recency is correctly valued at ' +
        'nothing. After ' + seen + ' requests the cache holds ' + root.Format.exact(final.t1) +
        ' items in the recency list and ' + root.Format.exact(final.t2) + ' in the frequency ' +
        'list, and it reaches ' + root.Format.percent(final.hitRate, 1) + '. Switch the trace ' +
        'control to Zipf, where evicted keys do come back, and the same code adapts thousands of ' +
        'times.';
    }
    return 'p is the target size of the recency half, out of a cache of ' +
      root.Format.exact(study.capacity) + '. It starts at zero — ARC assumes nothing — and moves ' +
      'only when a key turns up in a ghost list, which is the cache being told about a mistake ' +
      'it has already made. After ' + seen + ' requests it has settled at ' +
      root.Format.fixed(final.p, 1) + ' with ' + root.Format.exact(final.t1) +
      ' items in the recency list and ' + root.Format.exact(final.t2) + ' in the frequency list, ' +
      'having adjusted ' + root.Format.exact(final.adaptations) + ' times. Nothing was ' +
      'configured. That is the whole claim of an adaptive policy, and the column to watch is the ' +
      'second one rather than the hit rate.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
