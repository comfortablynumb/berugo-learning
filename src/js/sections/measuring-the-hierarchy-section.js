/**
 * Section: Measuring the hierarchy.
 *
 * The closing section, and the one that turns the milestone into a skill. Fifty
 * lines of code and no documentation recovers a machine's cache capacities, its
 * associativity and its line size from timing alone - and the demo does it
 * against a simulator whose configuration is known, so the method can be
 * checked rather than trusted.
 *
 * The pattern control is the point. Every confounder in this subject is a way
 * of accidentally measuring something else: a chase laid out in address order
 * measures the prefetcher, a sequential walk measures bandwidth, and a first
 * pass measures compulsory misses. Each is a switch here, and each one visibly
 * breaks the discovery.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'measuring-the-hierarchy';
  const Table = root.DataTable;
  const Hierarchy = root.Memory.Hierarchy;
  const Cache = root.Memory.Cache;
  const Microbench = root.CacheMicrobench;
  const SIZES = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288,
    1048576, 2097152, 4194304, 8388608, 16777216];
  const STRIDES = [8, 16, 32, 64, 128, 256];
  const cache = {};
  let panel = null;
  let chart = null;

  const METHOD = [
    { step: 'walk a working set of a chosen size, repeatedly',
      measures: 'the average cost of an access at that size',
      avoids: 'the first pass, whose misses are compulsory at every size and lift the whole '
        + 'curve' },
    { step: 'make the order unpredictable',
      measures: 'latency: one access outstanding at a time',
      avoids: 'the prefetcher, which follows an ordered chase happily and turns the '
        + 'measurement into a bandwidth figure' },
    { step: 'sweep the size and look for steps',
      measures: 'the capacity of each level: the size below each step',
      avoids: 'reading the size ABOVE the step, which reports every cache as twice its size' },
    { step: 'build a set of addresses one set-span apart',
      measures: 'associativity: the largest such set that still all hits',
      avoids: 'a stride that reaches several sets, which measures capacity instead' },
    { step: 'sweep the stride within a line',
      measures: 'the line size: the stride at which every access starts missing',
      avoids: 'a working set small enough to fit, where nothing misses at any stride' }
  ];

  const BLIND = [
    { spot: 'the replacement policy',
      why: 'every policy gives the same answer on a sequential or a random walk; the '
        + 'differences only appear on patterns designed to expose them (37.3)',
      instead: 'a cyclic reference pattern one line larger than the associativity, which '
        + 'separates LRU from the rest' },
    { spot: 'inclusion',
      why: 'an inclusive and a non-inclusive hierarchy have the same latency curve; what '
        + 'differs is what an eviction below does to the level above',
      instead: 'vendor documentation, or a test that measures the effective capacity of L1 '
        + 'plus L2 together' },
    { spot: 'the prefetcher itself',
      why: 'the method is built to defeat it, so a successful measurement says nothing about '
        + 'how good it is',
      instead: 'the comparison in 37.7: run the same trace ordered and shuffled and read the '
        + 'gap' },
    { spot: 'anything shared with another core',
      why: 'a last-level cache shared with a busy neighbour measures the neighbour as well',
      instead: 'run it on a quiet machine, and report the conditions with the result' },
    { spot: 'the TLB, unless you look for it',
      why: 'a large working set exceeds the translation reach and the cache capacity at '
        + 'similar sizes, so one step can be either',
      instead: 'repeat with huge pages: a step that moves is translation, one that stays is '
        + 'cache (37.6)' }
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
      title: 'Diagram — the discovery method and the confounders it has to avoid',
      caption: 'Every box on the right is a way of accidentally measuring something else, and '
        + 'each one has a switch in the demo. That is the honest structure of a microbenchmark: '
        + 'the code is short and most of the work is in the things it must not do. A result '
        + 'reported without saying which of these were controlled for is not a measurement of '
        + 'the machine.',
      definition: [
        'flowchart TD',
        '    A["choose a working-set size"] --> B["walk it several times"]',
        '    B --> C["discard the first pass"]',
        '    C --> D["average the rest"]',
        '    D --> E{"more sizes?"}',
        '    E -->|"yes"| A',
        '    E -->|"no"| F["find the steps: the size BELOW each is a capacity"]',
        '    B -.->|"ordered access"| P["the prefetcher answers instead"]',
        '    B -.->|"several accesses in flight"| W["bandwidth answers instead"]',
        '    C -.->|"first pass included"| K["compulsory misses lift every point"]',
        '    F -.->|"size above the step"| X["every cache reported at twice its size"]'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**An unfamiliar machine will tell you its cache hierarchy if you time it properly.** '
        + 'Walk a working set of each size in a shuffled pointer chase, average the cost per '
        + 'access, and look for the steps: the size below each step is a capacity. The demo '
        + 'recovers 32 KiB, 512 KiB and 8 MiB exactly, having been told none of them.',
      '**Associativity comes out of a conflict set.** Every address `base + k x sets x '
        + 'lineBytes` maps to the same set whatever `k` is, so touch `k` of them in a loop and '
        + 'they all hit until `k` exceeds the number of ways. The largest `k` that still hits '
        + 'is the associativity — the demo recovers 8 — and the method needs no knowledge of '
        + 'the machine beyond the ability to time an access.',
      '**Line size comes out of a stride sweep.** Sweep the stride from a few bytes upwards '
        + 'over a working set too large to fit: while the stride is smaller than a line, '
        + 'several accesses share a fetch and the miss count is low; once it reaches the line '
        + 'size every access misses and the count stops rising. That knee is the line size.',
      '**Almost all the difficulty is in what the benchmark must NOT do.** Order the chase and '
        + 'the prefetcher answers instead. Use a sequential walk and bandwidth answers instead. '
        + 'Include the first pass and compulsory misses lift every point on the curve. Each of '
        + 'those is a control in the demo, and each one visibly destroys the result.',
      '**Read the size below the step, not above it.** The largest working set that still fits '
        + 'is the capacity; the first one that does not is the first that overflowed. Getting '
        + 'that off by one reports every cache as twice its real size, and it is the only '
        + 'subtle part of an otherwise mechanical method.'
    ];
  }

  function closing() {
    return [
      '**Hardware performance counters are the other route and they have their own '
        + 'pitfalls.** They count events rather than time, they are sampled, and the event a '
        + 'counter is named for is frequently not quite the event it counts — a "cache miss" '
        + 'counter may or may not include prefetches, speculative accesses or page-table '
        + 'walks. A timing measurement you designed is often more trustworthy than a counter '
        + 'you did not.',
      '**Report the configuration with the result, always.** A latency figure without the '
        + 'access pattern, the working set and the machine state is not reproducible and '
        + 'therefore not a measurement. That is the same discipline as the seeds and run counts '
        + 'everywhere else in this platform.',
      '**The roofline model is where this ends up.** Plot achievable performance against '
        + 'arithmetic intensity and you get a ceiling made of two lines: memory bandwidth on '
        + 'the left, compute on the right. Which side of the knee a kernel sits on decides '
        + 'whether to optimise the arithmetic or the data movement, and M40 and M58 build it '
        + 'properly.',
      '**The same primitive is a side channel, and it is worth noticing that twice.** Timing '
        + 'an access to learn whether a line is resident is exactly what 36.8 did to recover a '
        + 'secret. The method is the same; only the intent differs — which is why "the machine '
        + 'leaks its state through timing" is a statement about hardware rather than about '
        + 'attackers.'
    ];
  }

  function insight() {
    return '**Being able to derive an unknown machine\'s memory hierarchy from timing in about '
      + 'fifty lines is a genuinely useful skill, and the reason is not that the numbers are '
      + 'hard to look up.** They are usually documented. What the exercise gives you is the '
      + 'habit of designing a measurement that isolates one variable, and the specific '
      + 'knowledge of what ruins it — because every confounder on this page has an analogue in '
      + 'every benchmark anybody writes. A warm-up pass you forgot to discard is a compulsory '
      + 'miss lifting the curve. An access pattern the system can predict is a prefetcher '
      + 'answering a question you did not ask. Several requests in flight when you meant to '
      + 'measure one is a bandwidth figure wearing a latency label. A neighbour on the same '
      + 'shared resource is somebody else\'s workload in your numbers. Those four mistakes '
      + 'account for a very large fraction of the benchmark results that turn out to be wrong, '
      + 'in this subject and in every other, and the way to stop making them is to have once '
      + 'built a measurement where each of them visibly destroyed the answer. That is what the '
      + 'pattern control on this page is for: not to show you the right curve, but to let you '
      + 'watch the wrong ones.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — recover the machine, then break the method',
        markup: root.HierarchyMeasureTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.HierarchyMeasureTemplate.controls,
      onChange: function () { update(app); } });
    update(app);
  }

  /**
   * The curve, for one setting of the two controls that can break it.
   *
   * The measurement itself lives in `algorithms/cache-microbench.js` so that
   * this page and 37.1 cannot drift apart, and so that the machine it models -
   * a prefetcher that follows what it can predict, and miss registers that
   * overlap what does not depend on anything - is written down once. Both
   * mistakes need that machine to exist: with no prefetcher and no overlap,
   * all three patterns produce the identical curve and the control is
   * decoration.
   */
  function curveFor(view) {
    const key = view.pattern + ' ' + view.warm;

    if (!cache[key]) {
      cache[key] = Microbench.ladder({ sizes: SIZES, pattern: view.pattern,
        warm: view.warm, passes: 4, seed: 2 });
    }
    return cache[key];
  }

  function reading() {
    const values = panel.values();
    const view = { pattern: values['msr-pattern'], warm: Boolean(values['msr-warm']),
      threshold: Number(values['msr-threshold']), ways: Number(values['msr-ways']) };

    view.curve = curveFor(view);
    view.steps = Microbench.steps(view.curve, view.threshold);
    return view;
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintMethod();
    paintSteps(view);
    paintAssociativity(view);
    paintLineSize();
    paintBlind();
    paintChart(app, view);
  }

  function truth() {
    return Hierarchy.PRESET.map(function (level) {
      return level.sets * level.ways * level.lineBytes;
    });
  }

  function bytes(value) {
    if (value >= 1048576) return (value / 1048576) + ' MiB';
    return (value / 1024) + ' KiB';
  }

  function discoverAssociativity(ways) {
    const levels = [Object.assign({}, Hierarchy.PRESET[0], { ways: ways,
      sets: Math.max(1, Math.round(32768 / (ways * 64))) })];

    return Microbench.discoverAssociativity({ hierarchy: { levels: levels },
      stride: levels[0].sets * 64, limit: 32 });
  }

  function discoverLineSize() {
    const rows = strideRows();
    let found = 64;

    rows.forEach(function (row, at) {
      if (at === 0) return;
      if (rows[at - 1].misses > 0 && row.misses / rows[at - 1].misses < 1.5) return;
      found = row.stride;
    });
    return found;
  }

  function paintMetrics(view) {
    const wanted = truth();
    const found = view.steps.map(function (step) { return step.capacity; });
    const exact = wanted.every(function (value) { return found.indexOf(value) !== -1; })
      && found.length === wanted.length;
    const assoc = discoverAssociativity(view.ways);

    root.MetricGrid.update({
      'msr-found': { value: found.length ? found.map(bytes).join(', ') : 'none',
        note: 'read off the curve, at a step threshold of ' + view.threshold.toFixed(2) },
      'msr-truth': { value: wanted.map(bytes).join(', '), note: 'what the simulator has' },
      'msr-match': { value: exact ? 'yes' : 'no',
        note: exact ? 'every level recovered from timing alone'
          : 'this pattern or threshold hides at least one step' },
      'msr-assoc': { value: assoc.associativity,
        note: assoc.failedAt ? 'and ' + assoc.failedAt + ' lines started missing'
          : 'no set size missed within the limit' },
      'msr-assoc-truth': { value: view.ways,
        note: assoc.associativity === view.ways ? 'recovered exactly'
          : 'the conflict set did not isolate a single set' },
      'msr-line': { value: discoverLineSize() + ' B',
        note: 'the stride at which every access starts missing' }
    });
  }

  function paintMethod() {
    Table.paint('msr-method', METHOD.map(function (row) {
      return [row.step, row.measures, row.avoids];
    }), 'The third column is the whole difficulty. The measurement itself is a loop and an '
      + 'average; everything that makes it correct is a thing it has to avoid doing, and every '
      + 'one of them is a switch in the control panel so you can watch the result break.');
  }

  function paintSteps(view) {
    const wanted = truth();

    if (!view.steps.length) {
      Table.paint('msr-steps', [['none', '—', '—', '—',
        'the curve has no step this threshold can see']], stepNote(view));
      return;
    }
    Table.paint('msr-steps', view.steps.map(function (step) {
      const match = wanted.indexOf(step.capacity) !== -1;

      return [bytes(step.capacity), step.from.toFixed(1), step.to.toFixed(1),
        step.ratio.toFixed(2) + 'x',
        { value: match ? 'yes, exactly' : 'no level of this size exists',
          className: match ? 'good' : 'bad' }];
    }), stepNote(view));
  }

  function stepNote(view) {
    if (view.pattern === 'stream') {
      return 'A sequential walk overlaps its accesses, so the average cost per access barely '
        + 'rises however far the working set exceeds a level - and the steps the method looks '
        + 'for are simply not there. This is the same code measuring bandwidth, and it is the '
        + 'most common way a memory result is reported wrongly by an order of magnitude.';
    }
    if (view.pattern === 'ordered') {
      return 'A chase whose addresses happen to be in order is a sequential walk in disguise, '
        + 'and a prefetcher follows it happily. The shuffle is not decoration - it is the only '
        + 'thing making the next address unpredictable, and without it the measurement is of '
        + 'the prefetcher rather than of the hierarchy.';
    }
    if (!view.warm) {
      return 'Without discarding the first pass, its compulsory misses are averaged into every '
        + 'point - and they are compulsory at every working-set size, so they lift the whole '
        + 'curve and flatten the very steps the method exists to find.';
    }
    return 'Every step lands on a configured capacity, and the method was told none of them. '
      + 'The size BELOW the step is the answer, because that is the largest working set that '
      + 'still fitted; reading the size above reports every cache as twice its real size.';
  }

  function paintAssociativity(view) {
    const sets = Math.max(1, Math.round(32768 / (view.ways * 64)));
    const rows = [];
    let first = null;

    for (let lines = 1; lines <= view.ways + 2; lines += 1) {
      const levels = [Object.assign({}, Hierarchy.PRESET[0], { ways: view.ways, sets: sets })];
      const hierarchy = Hierarchy.create({ levels: levels });
      let missed = 0;

      for (let pass = 0; pass < 4; pass += 1) {
        for (let at = 0; at < lines; at += 1) {
          const found = Hierarchy.access(hierarchy, { address: at * sets * 64 });

          if (pass > 0 && found.level > 0) missed += 1;
        }
      }
      if (missed && first === null) first = lines;
      rows.push([lines, missed === 0 ? 'yes' : 'no, ' + missed + ' missed',
        missed === 0 ? 'still fits in one set'
          : (lines === first
            ? 'more lines than the set has ways: the answer is ' + (lines - 1)
            : 'already past the ways; the answer was settled at ' + (first - 1))]);
    }
    Table.paint('msr-assoc-table', rows, 'Every address here is `k x ' + sets + ' x 64` bytes '
      + 'apart, so every one of them maps to set zero whatever `k` is - which is the '
      + 'conflict-set construction, and it is the same arithmetic that made the cliff in 37.2. '
      + 'Touch `k` of them repeatedly and they all hit until `k` exceeds the ways. The largest '
      + '`k` that still hits is the associativity, and nothing about the machine had to be '
      + 'known to find it.');
  }

  function strideRows() {
    return STRIDES.map(function (stride) {
      const built = Cache.create({ sets: 64, ways: 8, lineBytes: 64, hitCycles: 4 });
      const span = 262144;

      for (let at = 0; at < span / stride; at += 1) Cache.access(built, { address: at * stride });
      const found = Cache.summary(built);

      return { stride: stride, misses: found.misses, per: 64 / stride };
    });
  }

  function paintLineSize() {
    const rows = strideRows();

    Table.paint('msr-line-table', rows.map(function (row) {
      return [row.stride + ' B', row.misses,
        row.per >= 1 ? row.per.toFixed(0) : 'less than one',
        row.stride < 64 ? 'several accesses share a fetch'
          : 'every access is its own line: the stride has reached the line size'];
    }), 'A working set far too large to fit, walked at each stride. While the stride is smaller '
      + 'than a line, several accesses share one fetch and the miss count is a fraction of the '
      + 'access count; once the stride reaches the line size every access misses and the miss '
      + 'count stops rising with it. That knee is the line size, and it is 64 bytes here - '
      + 'which is what the simulator was configured with.');
  }

  function paintBlind() {
    Table.paint('msr-blind', BLIND.map(function (row) {
      return [row.spot, row.why, row.instead];
    }), 'A method that recovers four numbers exactly is easy to over-trust. These five are the '
      + 'things it cannot see, and the last one is the trap worth remembering: the translation '
      + 'reach and a cache capacity can be similar sizes, so a step in the curve can be either. '
      + 'Repeating the sweep with huge pages separates them in one experiment, because a step '
      + 'that moves was translation and one that stays was cache.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#msr-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, { lazyLib: app.lazyLib, height: 260, logX: true,
      xLabel: 'working set (bytes)', yLabel: 'cycles per access',
      series: [{ label: view.pattern, points: view.curve.map(function (row) {
        return { x: row.bytes, y: row.cycles };
      }) }],
      markers: truth().map(function (capacity, at) {
        return { x: capacity, label: Hierarchy.PRESET[at].name, anchor: 'start' };
      }) });
    root.Helpers.setText('msr-chart-note', stepNote(view) + ' The markers are the configured '
      + 'capacities, drawn so the recovered steps can be checked against them by eye rather '
      + 'than only in the table.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
