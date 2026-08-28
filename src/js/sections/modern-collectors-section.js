/**
 * Section: Modern collector designs.
 *
 * The comparison table is the milestone, and the discipline it enforces is
 * that no design gets to be "the best". Every column has a different winner,
 * and the only column with no trade-off in it — whether the collector freed
 * a reachable object — is checked at every collection rather than at the end.
 *
 * The region half is a scheduling problem in disguise. "Garbage first" ranks
 * regions by reclaimed bytes per byte copied and takes them while a pause
 * budget lasts, which is greedy knapsack. On a real heap it lands within a
 * tenth of a per cent of the exact optimum, because most regions are wholly
 * dead — so a hand-built region set is shipped alongside, where the greedy
 * choice returns 73 per cent of what was available.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'modern-collectors';
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
      title: 'Diagram — a region heap with per-region remembered sets and a collection set',
      caption: 'The heap is divided into fixed-size regions and each one carries a record of '
        + 'the references pointing INTO it from elsewhere. That is what makes a subset of the '
        + 'heap collectable on its own: evacuating a region means copying its survivors out and '
        + 'fixing the pointers, and the per-region record is how those pointers are found '
        + 'without scanning everything. The collection set is then chosen to fit a pause '
        + 'budget, which turns the pause from a consequence into a target.',
      definition: [
        'graph TD',
        'H["region heap"] --> R0["region 0 — mostly garbage"]',
        'H --> R1["region 1 — mostly live"]',
        'H --> R2["region 2 — wholly garbage"]',
        'RS0["remembered set for region 0"] --> R0',
        'RS2["remembered set for region 2"] --> R2',
        'CS["collection set, chosen to fit the pause budget"] --> R0',
        'CS --> R2'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A region heap is the generational idea generalised: instead of two ages, many '
        + 'independently collectable pieces.** Any subset can be collected on its own, so the '
        + 'collector chooses how much work to do rather than discovering it. That single change '
        + 'is what turns a pause from a consequence of the heap size into a budget.',
      '**The price is a remembered set per region rather than one per generation.** Evacuating '
        + 'a region means finding every pointer into it, and the only alternative to a record '
        + 'is scanning the whole heap. Those records are real memory — several per cent of the '
        + 'heap in a production G1 — and they are the reason a region heap is not free.',
      '**"Garbage first" is literally a scheduling heuristic, and reading it that way makes '
        + 'the tuning flags legible.** Rank regions by garbage reclaimed per byte copied, take '
        + 'them in order while the budget lasts. A wholly dead region costs nothing to evacuate '
        + 'and returns everything, so it always sorts first — which is why a region collector '
        + 'reclaims dead regions almost for free.',
      '**It is a greedy approximation to a knapsack, and it is worth knowing when it loses.** '
        + 'On the real heap here it lands within a tenth of a per cent of the exact optimum, '
        + 'because most regions are wholly dead. On a constructed set where the highest-ratio '
        + 'region is large enough to block two better ones together, it returns 73 per cent. '
        + 'Both numbers are true and the first is why the heuristic ships.',
      '**Shenandoah and ZGC evacuate CONCURRENTLY, which needs a read barrier rather than a '
        + 'write barrier.** If an object can move while the program is running, then every read '
        + 'of a reference has to be able to discover that it moved. Reads outnumber writes '
        + 'heavily, so this is a much bigger throughput commitment than anything in 31.5.',
      '**Coloured pointers put the collector\'s metadata in the unused bits of the address '
        + 'itself.** A 64-bit machine does not use all 64 bits for addresses, so ZGC stores mark '
        + 'and remap state in the spare ones and can then answer "has this moved" from the '
        + 'pointer without touching the object. It is a hardware-shaped trick and it does not '
        + 'transfer to a 32-bit target.',
      '**Go\'s collector is concurrent mark-sweep and deliberately does not move objects.** '
        + 'That gives very short pauses and no compaction, so Go leans on its size-class '
        + 'allocator to keep fragmentation manageable and on escape analysis to keep the '
        + 'allocation rate down. It is a coherent set of choices, and each one follows from not '
        + 'moving.',
      '**Reading a published design is a matter of asking four questions.** How is the heap '
        + 'partitioned, does it move objects, what runs concurrently with the program, and what '
        + 'pause is left. Every collector in the last table answers those four differently, and '
        + 'the answers predict the behaviour you will see far better than the benchmark numbers '
        + 'in the announcement.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — eight designs, one trace, one oracle',
        markup: root.ModernTemplate.render() },
      diagram: diagram(),
      insight: '**"Garbage first" is literally a scheduling heuristic — collect the regions '
        + 'with the most garbage per unit of copying work — and reading it that way makes the '
        + 'tuning flags legible.** `MaxGCPauseMillis` is not a wish; it is the budget the '
        + 'selection loop stops at, so raising it lets the collector take more regions per '
        + 'pause and therefore fall behind less often. `G1HeapRegionSize` changes the '
        + 'granularity of the choice, which is why it matters most when your objects are large '
        + 'relative to a region. And the region count is the resolution of the whole heuristic: '
        + 'too few and every choice is coarse, too many and the remembered sets cost more than '
        + 'they save. None of that is guesswork once you have seen the selection run. The '
        + 'broader habit this section is arguing for is to read a collector\'s published design '
        + 'as a set of answers to four questions — how the heap is partitioned, whether objects '
        + 'move, what runs concurrently, and what pause is left — and then predict its '
        + 'behaviour rather than believing its benchmark. A design that does not move objects '
        + 'has fragmentation you will meet eventually. A design that evacuates concurrently is '
        + 'paying a read barrier you will see in throughput. A design with a pause target is '
        + 'telling you it will miss it under load, because a budget is only a budget while '
        + 'there is enough of it. The table in this section says all four things about eight '
        + 'designs at once, and the reason it has ten columns is that any smaller table would '
        + 'have let one of them look best.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.ModernTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const traceFor = root.Helpers.memoise(function () {
    return root.HeapSim.synthetic({ count: 1500, seed: 5, survival: 0.2, retained: 64,
      cycles: 0.06 });
  });

  const compareFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return root.GcLab.compare(traceFor('one'), { capacity: parts[0],
      nursery: Math.max(256, Math.round(parts[0] / 5)), budget: parts[1],
      policy: parts[2], candidates: 32 });
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return root.GcLab.replay(traceFor('one'), { mode: parts[3], capacity: parts[0],
      nursery: Math.max(256, Math.round(parts[0] / 5)), budget: parts[1], policy: parts[2] });
  });

  const censusFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const heap = root.HeapSim.build(traceFor('one'), undefined, { capacity: 65536 });
    const state = root.GcRegions.create({ regionBytes: 512, budget: parts[0],
      policy: parts[1] });

    root.GcRegions.partition(heap, state);
    const live = root.HeapSim.reachable(heap, heap.roots);
    const rows = root.GcRegions.census(heap, live);

    return { heap: heap, rows: rows,
      chosen: root.GcRegions.select(rows, parts[0], parts[1]) };
  });

  const gapFor = root.Helpers.memoise(function (budget) {
    const real = censusFor(JSON.stringify([budget, 'garbage-first'])).rows;
    const hard = root.GcRegions.adversarial();

    return root.GcRegions.POLICIES.reduce(function (into, policy) {
      into.push(gapRow('this heap', real, budget, policy.id));
      into.push(gapRow('a set built to defeat it', hard, 100, policy.id));
      return into;
    }, []);
  });

  function gapRow(name, rows, budget, policy) {
    const picked = root.GcRegions.select(rows, budget, policy);
    const gap = root.GcRegions.gap(rows, budget, policy);

    return { heap: name, policy: policy, regions: picked.regions.length,
      copied: picked.copied, reclaimed: gap.reclaimed, optimal: gap.optimal,
      ratio: gap.ratio };
  }

  function update() {
    const values = panel.values();
    const key = JSON.stringify([values['mdc-capacity'], values['mdc-budget'],
      values['mdc-policy']]);
    const rows = compareFor(key);
    const run = runFor(JSON.stringify([values['mdc-capacity'], values['mdc-budget'],
      values['mdc-policy'], values['mdc-mode']]));
    const census = censusFor(JSON.stringify([values['mdc-budget'], values['mdc-policy']]));

    paintChart(run);
    paintMetrics(rows);
    paintCompare(rows);
    paintMap(census);
    paintRegions(census);
    paintGap(gapFor(values['mdc-budget']));
    paintDesigns();
  }

  function paintChart(run) {
    if (chart && chart.chart) chart.chart.destroy();
    chart = root.ErrorBandView.bars(document.getElementById('mdc-chart'), {
      values: run.distribution.buckets.map(function (bucket) {
        return { label: bucket.from + '–' + bucket.to, value: bucket.count };
      }),
      xLabel: 'pause length (objects touched)', yLabel: 'collections',
      summary: function () { return 'Pause histogram for ' + run.mode.name + '.'; }
    });
    root.Helpers.setText('mdc-chart-caption', chartCaption(run));
  }

  function chartCaption(run) {
    const d = run.distribution;

    return run.mode.name + ': ' + d.count + ' collections, p50 ' + d.p50 + ', p99 ' + d.p99 +
      ', max ' + d.max + ', mean ' + d.mean.toFixed(1) + '. Look at where the mean falls in '
      + 'this histogram. For a design with two kinds of collection it lands between the two '
      + 'modes and describes no pause that ever happened — which is why every column of the '
      + 'table below is a percentile and none of them is an average.';
  }

  function paintMetrics(rows) {
    const fastest = best(rows, function (row) { return -row.p99; });
    const busiest = best(rows, function (row) { return row.throughput; });
    const smallest = best(rows, function (row) { return -row.peak; });

    root.MetricGrid.update({
      'mdc-latency': { value: fastest.p99, note: fastest.name },
      'mdc-throughput': { value: busiest.throughput.toFixed(3), note: busiest.name },
      'mdc-footprint': { value: smallest.peak, note: smallest.name },
      'mdc-correct': { value: rows.filter(function (row) { return row.correct; }).length +
        ' of ' + rows.length,
      note: 'checked against the liveness oracle at every collection' }
    });
  }

  function best(rows, score) {
    return rows.reduce(function (top, row) { return score(row) > score(top) ? row : top; });
  }

  function paintCompare(rows) {
    root.jQuery('#mdc-compare tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td class="mono">' + row.collections +
        '</td><td class="mono">' + row.p50 + '</td><td class="mono">' + row.p90 +
        '</td><td class="mono">' + row.p99 + '</td><td class="mono">' + row.max +
        '</td><td class="mono">' + row.throughput.toFixed(3) + '</td><td class="mono">' +
        row.peak + '</td><td class="mono">' + row.uncollected + '</td><td class="mono">' +
        (row.correct ? 'no' : row.wrong + ' — BROKEN') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mdc-compare-caption', compareCaption(rows));
  }

  function compareCaption(rows) {
    const fastest = best(rows, function (row) { return -row.p99; });
    const busiest = best(rows, function (row) { return row.throughput; });
    const smallest = best(rows, function (row) { return -row.peak; });
    const names = [fastest.name, busiest.name, smallest.name];
    const distinct = names.filter(function (name, at) { return names.indexOf(name) === at; });

    return 'Best p99 is ' + fastest.name + ', best throughput is ' + busiest.name +
      ', smallest peak is ' + smallest.name + ' — ' + distinct.length + ' different designs '
      + 'across three columns. Change the heap size at the top and the winners move again. '
      + 'That is the point of running eight of them over one trace rather than quoting eight '
      + 'papers: the ranking is a property of the workload and the budget, and there is no '
      + 'ordering of these rows that survives changing either.';
  }

  function paintMap(census) {
    root.jQuery('#mdc-map').html(root.HeapMapView.map(census.heap.cells.values(),
      { scheme: 'region', limit: 400 }));

    root.Helpers.setText('mdc-map-caption',
      'Objects are laid into regions in allocation order, which is what a bump allocator over '
      + 'a region list produces — so region membership is an accident of WHEN an object was '
      + 'born. That accident is what makes the design work: a region filled during one phase of '
      + 'the program tends to die during the next, so regions age coherently and whole ones '
      + 'become collectable at once.');
  }

  /**
   * Four wholly dead regions and the ten best MIXED ones, rather than the
   * top fourteen by ratio. Ranked purely by ratio the table is fourteen
   * identical rows saying "all garbage", which is true, is the reason the
   * heuristic works, and shows nothing about how it chooses.
   */
  function paintRegions(census) {
    const chosen = new Set(census.chosen.regions);
    const byRatio = function (a, b) {
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      return b.garbage - a.garbage;
    };
    const empty = census.rows.filter(function (row) { return row.live === 0; })
      .sort(byRatio).slice(0, 4);
    const mixed = census.rows.filter(function (row) { return row.live > 0; })
      .sort(byRatio).slice(0, 10);
    const ranked = empty.concat(mixed);

    root.jQuery('#mdc-regions tbody').html(ranked.map(function (row) {
      return '<tr' + (chosen.has(row.region) ? ' class="row-current"' : '') +
        '><td class="mono">' + row.region + '</td><td class="mono">' + row.objects +
        '</td><td class="mono">' + row.live + '</td><td class="mono">' + row.garbage +
        '</td><td class="mono">' + ratioText(row) + '</td><td class="mono">' +
        (chosen.has(row.region) ? 'yes' : 'no') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mdc-regions-caption', regionsCaption(census));
  }

  function ratioText(row) {
    return row.live ? row.ratio.toFixed(2) : 'all garbage — free';
  }

  function regionsCaption(census) {
    const empty = census.rows.filter(function (row) { return row.live === 0; }).length;

    return census.rows.length + ' regions, of which ' + empty + ' hold nothing live at all — '
      + 'four of those are shown, then the ten best regions that actually contain something. '
      + 'Those cost zero bytes of copying and return everything, so they sort first under any '
      + 'ranking and are taken before the budget is touched. That is the single biggest reason '
      + 'the greedy heuristic performs so well on real heaps — and the reason a comparison '
      + 'against the optimum has to be run on a set where those regions do not exist, which is '
      + 'the second half of the next table. The highlighted rows are the collection set at the '
      + 'current budget of ' + census.chosen.spent + ' bytes copied.';
  }

  function paintGap(rows) {
    root.jQuery('#mdc-gap tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.heap + '</td><td class="mono">' + row.policy +
        '</td><td class="mono">' + row.regions + '</td><td class="mono">' + row.copied +
        '</td><td class="mono">' + row.reclaimed + '</td><td class="mono">' + row.optimal +
        '</td><td class="mono">' + (row.ratio * 100).toFixed(1) + '%</td></tr>';
    }).join(''));

    root.Helpers.setText('mdc-gap-caption', gapCaption(rows));
  }

  function gapCaption(rows) {
    const real = rows.find(function (row) {
      return row.heap === 'this heap' && row.policy === 'garbage-first';
    });
    const hard = rows.find(function (row) {
      return row.heap !== 'this heap' && row.policy === 'garbage-first';
    });

    return 'On the real heap, garbage-first returns ' + (real.ratio * 100).toFixed(1) +
      ' per cent of what an exact knapsack would — which says the heuristic is fine and '
      + 'demonstrates nothing about the heuristic, because most of its choices were free. The '
      + 'constructed set is the shape where it loses: one region with the best ratio and a live '
      + 'set large enough that taking it excludes two regions that together return more, so the '
      + 'greedy choice gets ' + hard.reclaimed + ' of an available ' + hard.optimal + ' — ' +
      (hard.ratio * 100).toFixed(1) + ' per cent. Both optima are computed by dynamic '
      + 'programming rather than assumed, which is what makes the ratios mean anything.';
  }

  const DESIGNS = [
    { name: 'stop-the-world mark-sweep', part: 'one heap',
      moves: 'no', concurrent: 'nothing', pause: 'the whole heap, every time' },
    { name: 'generational (HotSpot Parallel, V8 Orinoco)', part: 'two or three ages',
      moves: 'the young generation', concurrent: 'the scavenge is parallel, not concurrent',
      pause: 'the nursery usually, the full heap eventually' },
    { name: 'G1', part: 'fixed-size regions with per-region remembered sets',
      moves: 'yes, by evacuation', concurrent: 'marking',
      pause: 'the evacuation, bounded by a budget it can miss' },
    { name: 'Shenandoah / ZGC', part: 'regions',
      moves: 'yes, while the program runs',
      concurrent: 'marking AND evacuation, via a read barrier',
      pause: 'root scanning, roughly independent of heap size' },
    { name: 'Go', part: 'size classes, one heap',
      moves: 'no', concurrent: 'marking, with an assist from allocating goroutines',
      pause: 'two short stop-the-world phases per cycle' },
    { name: 'CPython', part: 'one heap plus generational candidate lists',
      moves: 'no', concurrent: 'nothing',
      pause: 'none for counting; the cycle collector for the rest' }
  ];

  function paintDesigns() {
    root.jQuery('#mdc-designs tbody').html(DESIGNS.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.part + '</td><td>' +
        row.moves + '</td><td>' + row.concurrent + '</td><td>' + row.pause + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mdc-designs-caption',
      'Four questions, six collectors, and every one of the mechanisms in these columns has '
      + 'been built and measured in this milestone. The last column is the one to read first: '
      + 'every design here still has a pause, and the interesting differences are about what '
      + 'the remaining pause is proportional to. G1\'s is proportional to the collection set, '
      + 'which is a choice. ZGC\'s is proportional to the root set, which is roughly constant. '
      + 'Go\'s is two short phases per cycle. A collector advertised as "pauseless" always '
      + 'means one of these.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
