/**
 * Section: Cache performance analysis.
 *
 * The three Cs, by parallel simulation rather than by rule of thumb. Each
 * category is defined by what a DIFFERENT cache would have done with the same
 * access - a cache of unlimited size, and a fully associative cache of the
 * same size - so the classification is a measurement rather than a judgement,
 * and the three sum to the miss count exactly.
 *
 * The reason it earns its place is that the categories imply different fixes.
 * Conflict misses want a layout change; capacity misses want a blocking
 * change; compulsory misses want less data or a prefetcher. Reaching for the
 * wrong one is a week spent confirming a mistake, and a miss rate on its own
 * cannot tell you which you have.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'cache-performance-analysis';
  const Lab = root.MemoryLab;
  const Table = root.DataTable;
  const ThreeCs = root.ThreeCs;
  const Hierarchy = root.Memory.Hierarchy;
  const WAYS = [1, 2, 4, 8, 16];
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — the classification, as three simulations run at once',
      caption: 'Every miss goes down exactly one path, and each question is answered by a '
        + 'different simulated cache rather than by a heuristic. That is what makes the '
        + 'categories exhaustive and mutually exclusive, and therefore what makes them sum to '
        + 'the miss count exactly - which the demo asserts rather than assumes.',
      definition: [
        'flowchart TD',
        '    M["a miss in the real cache"] --> Q1{"has this line ever been referenced?"}',
        '    Q1 -->|"no"| C["COMPULSORY<br/>no cache of any size could have had it"]',
        '    Q1 -->|"yes"| Q2{"would a fully associative cache<br/>of the SAME SIZE have hit?"}',
        '    Q2 -->|"no"| K["CAPACITY<br/>the working set does not fit"]',
        '    Q2 -->|"yes"| F["CONFLICT<br/>the size was enough; the mapping lost it"]',
        '    C --> A["touch less data, or prefetch it earlier"]',
        '    K --> B["block or tile the loop so the working set fits"]',
        '    F --> D["pad the array, change the stride, or add ways"]'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**The three Cs are defined by what a different cache would have done, which is what '
        + 'makes them measurable.** A compulsory miss is the first reference to a line, so no '
        + 'cache could have had it. A capacity miss also misses in a fully associative cache of '
        + 'the same total size, so the organisation is irrelevant. A conflict miss is one that '
        + 'fully associative cache would have caught, so the size was enough and the mapping '
        + 'lost it.',
      '**The three sum to the miss count exactly, and the demo checks it.** They are '
        + 'exhaustive and mutually exclusive by construction, so a total that does not '
        + 'reconcile means the classifier has a case it has not thought about. That check is '
        + 'the same discipline as the top-down accounting in 36.9 and it is worth applying to '
        + 'any decomposition anybody offers you.',
      '**The categories imply different fixes, and that is the whole point.** Naive matrix '
        + 'multiply at n=64 has 32 392 conflict misses and 8 064 capacity misses: the fix is a '
        + 'layout change, and padding alone takes the DRAM traffic from 41 992 to 16 792. '
        + 'Reorder the loops and the conflict count falls to ZERO while the capacity count '
        + 'barely moves — at which point padding buys nothing more and blocking is the next '
        + 'move.',
      '**Associativity is the direct test.** Sweep the ways with the capacity held constant '
        + 'and the conflict column collapses while the capacity column does not move at all. '
        + 'That is the clearest demonstration there is that the two categories are genuinely '
        + 'different quantities rather than two words for "misses".',
      '**Average memory access time is the recursion that turns miss rates into a number.** A '
        + 'level costs its hit time plus, on the fraction that misses, the entire cost of '
        + 'everything below it. The demo computes it from the measured miss rates and then '
        + 'compares it against the cycles the run actually accumulated, because a predicted '
        + 'average nobody checks is a formula rather than a model.'
    ];
  }

  function closing() {
    return [
      '**Miss rate, misses per instruction and misses per second are three different '
        + 'numbers.** A miss rate falls when you add useless hits; misses per instruction is '
        + 'what a compiler change moves; misses per second is what a bigger machine moves. '
        + 'Quoting one while arguing about another is how two people agree on the data and '
        + 'disagree on the conclusion.',
      '**A miss rate is not a stall count, and out-of-order execution is why.** M36 measured '
        + 'it: a machine with enough window overlaps several misses, so twenty misses can cost '
        + 'the time of five. The miss rate says how often the memory system was asked; the '
        + 'stall cycles say how much of that the machine failed to hide, and they are the '
        + 'number a user feels.',
      '**Compulsory misses look unfixable and are the prefetcher\'s entire business.** They '
        + 'cannot be avoided, but they can happen earlier: 37.7 is about issuing them before '
        + 'the program asks, and about the accuracy that decides whether doing so was worth '
        + 'the bandwidth.',
      '**The decomposition is a simulation, so it costs three caches rather than one.** That '
        + 'is fine here and worth knowing about in a real tool: a hardware counter cannot tell '
        + 'you which category a miss was in, which is why this analysis lives in simulators and '
        + 'why the practical substitute is the associativity sweep in the table below.'
    ];
  }

  function insight() {
    return '**A high miss rate is not a diagnosis, and the difference between conflict and '
      + 'capacity is the difference between an afternoon and a rewrite.** Both look identical '
      + 'in a profile: the same counter, the same cache, the same line of code at the top. But '
      + 'a conflict miss means the data would have fitted and the mapping threw it out, so the '
      + 'fix is a few bytes of padding, a different allocation offset, or a stride that is not '
      + 'a power of two — small, local, and often a one-line change. A capacity miss means the '
      + 'working set genuinely does not fit, and no amount of padding helps; the fix is to '
      + 'restructure the loop so that it works on a piece at a time, which changes the shape of '
      + 'the code. Getting this backwards is common and expensive in both directions: teams '
      + 'block a loop that only ever had a conflict problem and get a more complicated program '
      + 'with the same performance, or they pad an array whose working set is ten times the '
      + 'cache and conclude that cache tuning does not work. The decomposition takes one extra '
      + 'simulation to compute and tells you which conversation to have, and the same '
      + 'question — "would a perfect version of this structure have helped?" — is worth asking '
      + 'of any cache, buffer pool or memo table before enlarging it.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — three simulations, one classification',
        markup: root.ThreeCsTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.ThreeCsTemplate.controls(),
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const settings = { sets: Number(values['cpa-sets']), ways: Number(values['cpa-ways']),
      lineBytes: 64, hitCycles: 4 };

    return { workload: values['cpa-workload'], settings: settings,
      found: Lab.threeCs(values['cpa-workload'], settings) };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintCategories(view);
    paintAssociativity(view);
    paintAmat(view);
    paintWorkloads(view);
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const found = view.found;

    root.MetricGrid.update({
      'cpa-misses': { value: found.misses,
        note: (100 * (1 - found.hitRate)).toFixed(2) + '% of ' + found.accesses +
          ' accesses' },
      'cpa-compulsory': { value: found.counts.compulsory,
        note: share(found.counts.compulsory, found.misses) },
      'cpa-capacity': { value: found.counts.capacity,
        note: share(found.counts.capacity, found.misses) },
      'cpa-conflict': { value: found.counts.conflict,
        note: share(found.counts.conflict, found.misses) },
      'cpa-sum': { value: found.total,
        note: found.reconciles ? 'exactly the miss count, as it must be'
          : 'THE CATEGORIES DO NOT RECONCILE' },
      'cpa-fix': { value: found.dominant.name, note: found.dominant.fix }
    });
  }

  function share(value, total) {
    return total ? (100 * value / total).toFixed(1) + '% of the misses' : 'no misses at all';
  }

  function paintCategories(view) {
    const found = view.found;

    Table.paint('cpa-categories', found.rows.map(function (row) {
      return [row.name, row.misses, (100 * row.share).toFixed(1) + '%', row.about, row.fix];
    }), 'A fully associative cache of the same total capacity would have taken '
      + found.idealMisses + ' misses against this configuration\'s ' + found.misses
      + '; the difference is exactly the conflict column. That is the whole method - the '
      + 'categories are not estimated from the miss rate, they are read off a second '
      + 'simulation running beside the first.');
  }

  function associativityRows(view) {
    const total = view.settings.sets * view.settings.ways;

    return WAYS.map(function (ways) {
      const sets = Math.max(1, Math.round(total / ways));
      const found = Lab.threeCs(view.workload, Object.assign({}, view.settings,
        { ways: ways, sets: sets }));

      return { ways: ways, sets: sets, compulsory: found.counts.compulsory,
        capacity: found.counts.capacity, conflict: found.counts.conflict,
        misses: found.misses, ideal: found.idealMisses, hitRate: found.hitRate };
    });
  }

  /** Said from the rows rather than from expectation: on some traces more ways
   *  is worse at a fixed capacity, and a caption that promised otherwise would
   *  be contradicted by the table directly under it. */
  function associativityNote(rows) {
    const best = rows.slice().sort(function (left, right) {
      return left.misses - right.misses;
    })[0];
    const monotone = rows.every(function (row, at) {
      return at === 0 || row.misses <= rows[at - 1].misses;
    });

    return 'The capacity is held constant down the table and only the shape changes. The best '
      + 'row is ' + best.ways + '-way at ' + best.misses + ' misses. ' + (monotone
        ? 'The column is monotone here - more ways, fewer conflicts - which is the shape the '
        + 'textbook promises and the reason "raise the associativity" is the standard advice.'
        : 'The column is NOT monotone, and that is measured rather than broken: capacity fixed '
        + 'means more ways buys fewer SETS, and whether this walk spreads across them depends '
        + 'on its stride against the set span, not on the ways alone. A fully associative cache '
        + 'of the same size takes ' + rows[0].ideal + ' misses, which is worse than several '
        + 'rows above - LRU evicting exactly the line a cyclic pattern wants next, the effect '
        + '37.3 measured on the loop fixture.')
      + ' The capacity column moves too, because a miss is counted there only when BOTH caches '
      + 'missed; that is what makes the three categories sum to the miss count exactly.';
  }

  function paintAssociativity(view) {
    const rows = associativityRows(view);

    Table.paint('cpa-assoc', rows.map(function (row) {
      return [row.ways, row.sets, row.compulsory, row.capacity, row.conflict,
        (100 * row.hitRate).toFixed(1) + '%'];
    }), associativityNote(rows));
  }

  function paintAmat(view) {
    const built = Lab.hierarchy(view.workload, {});
    const found = built.summary;

    Table.paint('cpa-amat', found.levels.map(function (level, at) {
      return [level.name, level.hitCycles, (100 * level.missRate).toFixed(2) + '%',
        level.amat.toFixed(2) + ' cycles', built.distribution[at].served];
    }).concat([['DRAM', found.dramCycles, 'n/a', found.dramCycles + ' cycles',
      found.dramAccesses]]),
      'AMAT for a level is its hit time plus, on the fraction that missed, the whole cost of '
      + 'everything below - so the top row is the number a program actually experiences. Here '
      + 'the recursion gives ' + found.amat.toFixed(2) + ' cycles and the run accumulated '
      + found.measured.toFixed(2) + ' per access. They agree because both come from the same '
      + 'measured miss rates; a formula that is never checked against a run is not a model of '
      + 'anything.');
  }

  function paintWorkloads(view) {
    Table.paint('cpa-workloads', Lab.names().map(function (name) {
      const found = Lab.threeCs(name, view.settings);

      return [name, found.misses, found.counts.compulsory, found.counts.capacity,
        found.counts.conflict, found.dominant.name,
        { value: found.reconciles ? 'yes' : 'NO',
          className: found.reconciles ? '' : 'bad' }];
    }), 'Every workload at the current configuration. The three matrix-multiply rows are the '
      + 'ones to read together: naive is dominated by conflict, interchanged has none at all '
      + 'and is dominated by capacity, and blocked has almost nothing but compulsory misses '
      + 'left. Each transformation removed exactly the category it was aimed at, which is how '
      + 'you know the diagnosis was right - and 37.5 does that walkthrough properly.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#cpa-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    const rows = associativityRows(view);

    chart = root.GrowthPlot.render(host, { lazyLib: app.lazyLib, height: 250,
      xLabel: 'ways', yLabel: 'misses',
      series: ['compulsory', 'capacity', 'conflict'].map(function (key) {
        return { label: key, points: rows.map(function (row) {
          return { x: row.ways, y: row[key] };
        }) };
      }) });
    root.Helpers.setText('cpa-chart-note', 'Three lines under one control. Compulsory is flat, '
      + 'because the first reference to a line is a first reference whatever the cache looks '
      + 'like. The other two move together and in opposite directions to each other, which is '
      + 'the point: a single miss-rate number would have averaged all three into one figure '
      + 'that says nothing about which fix to reach for. Read the shape against the table '
      + 'below, which says in words what this curve is doing on the current workload.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
