/**
 * Section: The hierarchy and the numbers.
 *
 * The ladder is measured rather than tabulated. A pointer chase over a growing
 * working set produces a curve with a step wherever a level ran out, and the
 * demo reads the configured capacities back off that curve - 32 KiB, 512 KiB
 * and 8 MiB, exactly - without being told them.
 *
 * The control that matters most is the pattern. A sequential walk over the
 * same bytes produces almost no steps at all, because the accesses overlap and
 * the measurement becomes a bandwidth figure wearing a latency label. That is
 * the most common way this measurement is got wrong, so it is a switch rather
 * than a warning.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'memory-hierarchy-numbers';
  const Lab = root.MemoryLab;
  const Table = root.DataTable;
  const Hierarchy = root.Memory.Hierarchy;
  const Microbench = root.CacheMicrobench;
  let panel = null;
  let chart = null;

  const SIZES = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144, 524288,
    1048576, 2097152, 4194304, 8388608, 16777216];

  const RATIOS = [
    { level: 'L1 hit', here: '4 cycles', real: '4 to 5 cycles',
      means: 'free, more or less: the compiler assumes it and so should you' },
    { level: 'L2 hit', here: '18 cycles', real: '12 to 20 cycles',
      means: 'a few times an L1 hit, and out-of-order execution can usually hide it' },
    { level: 'L3 hit', here: '63 cycles', real: '40 to 70 cycles',
      means: 'shared with other cores, so a noisy neighbour shows up here first' },
    { level: 'DRAM', here: '313 cycles', real: '200 to 400 cycles',
      means: 'about eighty L1 hits; any change that avoids one of these beats any change that '
        + 'saves instructions' },
    { level: 'an SSD read', here: 'not modelled', real: 'a hundred thousand cycles or so',
      means: 'three more orders of magnitude, which is why the page fault is the event that '
        + 'dominates a profile when it happens at all' }
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
      title: 'Diagram — the hierarchy, with what each level costs',
      caption: 'Each level is a bet that the next access is one the level above has seen '
        + 'recently, or sits beside something it has. The capacities rise by roughly sixteen '
        + 'times per level and the latencies by three or four, which is the trade that makes '
        + 'the whole arrangement pay. The numbers here are the ones the demo recovers from '
        + 'timing alone, and the ratios rather than the absolute figures are what has stayed '
        + 'true for twenty years.',
      definition: [
        'flowchart LR',
        '    CPU["core"] --> L1["L1d: 32 KiB<br/>4 cycles"]',
        '    L1 -->|"miss"| L2["L2: 512 KiB<br/>18 cycles"]',
        '    L2 -->|"miss"| L3["L3: 8 MiB<br/>63 cycles"]',
        '    L3 -->|"miss"| DRAM["DRAM: gigabytes<br/>313 cycles"]',
        '    DRAM -->|"page fault"| SSD["storage: hundreds of thousands of cycles"]'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**The hierarchy exists because of a ratio, not a technology.** Fast storage is expensive '
        + 'per bit and slow storage is cheap, and the gap between a processor cycle and a memory '
        + 'access grew by two orders of magnitude while nobody was looking. Every level is a bet '
        + 'that the next access is one the level above has seen recently — temporal locality — '
        + 'or sits next to something it has, which is spatial locality. Those two properties are '
        + 'the entire reason any of this works.',
      '**The demo does not tell you the numbers; it finds them.** Walk a growing working set in '
        + 'a shuffled pointer chase and time the accesses. The curve is flat while the set fits '
        + 'in a level and steps up when it does not, so the size at which each step happens is '
        + 'that level\'s capacity. Here it recovers 32 KiB, 512 KiB and 8 MiB from the timing '
        + 'alone — exactly the configured capacities.',
      '**A pointer chase measures latency and a sequential walk does not.** In a chase every '
        + 'address is the value the previous load returned, so exactly one access is outstanding '
        + 'and the time is the full round trip. In a sequential walk the addresses are known in '
        + 'advance and the machine overlaps as many as it has resources for. Switch the pattern '
        + 'control and the staircase flattens to one cycle per access — *below* the four-cycle '
        + 'L1 hit, which is impossible for a latency and is exactly how to recognise a '
        + 'bandwidth figure wearing a latency label.',
      '**The shuffle is not decoration, and the middle setting of the control proves it.** A '
        + 'chase laid out in address order is a dependent chain still — nothing overlaps — and '
        + 'the curve goes flat anyway, at the L1 hit time, because the prefetcher can predict '
        + 'every address and fetches it before the demand arrives. The reading is a confident '
        + '"everything fits in L1" at every working-set size. Randomising the order is the only '
        + 'thing separating a measurement of the hierarchy from a measurement of the '
        + 'prefetcher.',
      '**Discard the first pass.** Its misses are compulsory at every working-set size, so '
        + 'including them lifts every point on the curve and blurs the steps the method exists '
        + 'to find. That single line is the difference between a discovery routine that works '
        + 'and one that reports every cache as larger than it is.'
    ];
  }

  function closing() {
    return [
      '**The ratios are what transfer, and they are stable.** L1 is a handful of cycles, L2 a '
        + 'few times that, L3 a few times that again, and DRAM about eighty L1 hits. Those '
        + 'proportions have barely moved in twenty years even as every absolute number changed, '
        + 'which is why they are worth memorising and the nanosecond figures are not.',
      '**Any change that moves you down a level beats almost any other optimisation.** A '
        + 'transformation that halves the instruction count and adds a DRAM access is a loss; '
        + 'one that adds instructions and keeps the working set in L2 is usually a win. That is '
        + 'the whole reason 37.5 is about layout rather than about arithmetic.',
      '**The curve is also the first thing to run on an unfamiliar machine.** Fifty lines of '
        + 'code and no documentation gets you the cache sizes, and 37.10 extends it to the line '
        + 'size and the associativity. It is a good debugging skill, and — as 36.8 showed — the '
        + 'same primitive as a timing side channel.',
      '**What this model leaves out is said rather than hidden.** There is no translation cost '
        + 'until 37.6 and the DRAM is a fixed latency until 37.8, and each makes the real curve '
        + 'messier in a specific way. The one thing that could not be left out is the '
        + 'prefetcher: two of the three patterns are broken measurements only because something '
        + 'is there to be fooled, so the timing harness runs a stride prefetcher and a bounded '
        + 'number of outstanding accesses. What that costs in bandwidth, and whether it is '
        + 'worth paying, is 37.7.'
    ];
  }

  function insight() {
    return '**The single most useful thing to carry away from this page is that the levels are '
      + 'separated by multiplicative factors, not additive ones, and that decides which '
      + 'optimisations are worth doing.** A DRAM access costs about eighty L1 hits on this '
      + 'model and something similar on real hardware. That means a change which removes one '
      + 'trip to memory is worth more than a change which removes eighty instructions, and it '
      + 'means the usual instinct — count the operations — is calibrated to the wrong quantity. '
      + 'It also explains why so many performance results look mysterious: two implementations '
      + 'with identical operation counts can differ by a factor of five because one of them '
      + 'lands in a different level, and nothing in the source code says so. The habit that '
      + 'follows is worth more than the numbers themselves. Before optimising anything that '
      + 'touches data, ask how big the working set is and which level it fits in; if the answer '
      + 'is "it does not fit", the profitable change is almost always to make it fit rather '
      + 'than to make the code shorter. The rest of this milestone is that question asked in '
      + 'more and more specific ways.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — the ladder, and reading the sizes off it',
        markup: root.LadderTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.LadderTemplate.controls,
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();

    return { pattern: values['lad-pattern'], passes: Number(values['lad-passes']),
      warm: Boolean(values['lad-warm']) };
  }

  function update(app) {
    const view = reading();

    view.curve = measure(view);
    view.steps = Microbench.steps(view.curve);
    paintMetrics(view);
    paintLevels();
    paintCurve(view);
    paintSteps(view);
    paintRatios();
    paintChart(app, view);
  }

  /**
   * The ladder, memoised on the three controls.
   *
   * The measurement is `Microbench.ladder` rather than a loop here, because
   * 37.10 asks the same question of the same machine and two copies of a
   * timing harness are two chances to quote different numbers. It models a
   * prefetcher and a bounded number of outstanding accesses, which is what
   * makes the pattern control mean anything: without them all three walks
   * touch the same bytes in the same cache and produce the identical curve.
   */
  function measure(view) {
    const key = view.pattern + ' ' + view.passes + ' ' + view.warm;

    if (measure.cache && measure.cache.key === key) return measure.cache.rows;
    measure.cache = { key: key, rows: Lab.ladder({ sizes: SIZES, pattern: view.pattern,
      passes: view.passes, warm: view.warm, seed: 2 }) };
    return measure.cache.rows;
  }

  function levels() {
    return Hierarchy.PRESET.map(function (level) {
      return { name: level.name, capacity: level.sets * level.ways * level.lineBytes,
        cycles: level.hitCycles, sets: level.sets, ways: level.ways };
    });
  }

  function paintMetrics(view) {
    const preset = levels();
    const found = view.steps.map(function (step) { return step.capacity; });
    const wanted = preset.map(function (level) { return level.capacity; });
    const exact = wanted.every(function (bytes) { return found.indexOf(bytes) !== -1; });

    root.MetricGrid.update({
      'lad-l1': { value: preset[0].cycles, note: 'the unit the rest of the ladder is in' },
      'lad-l2': { value: preset[1].cycles,
        note: (preset[1].cycles / preset[0].cycles).toFixed(1) + 'x an L1 hit' },
      'lad-l3': { value: preset[2].cycles,
        note: (preset[2].cycles / preset[0].cycles).toFixed(1) + 'x an L1 hit' },
      'lad-dram': { value: Hierarchy.DRAM_CYCLES,
        note: (Hierarchy.DRAM_CYCLES / preset[0].cycles).toFixed(0) + 'x an L1 hit' },
      'lad-found': { value: found.length,
        note: found.length ? found.map(bytes).join(', ') : 'the curve has no steps at all' },
      'lad-exact': { value: exact ? 'exact' : (found.length ? 'partial' : 'nothing found'),
        note: exact ? 'every configured capacity was recovered from the timing'
          : 'this pattern hides the steps, which is the point of the control' }
    });
  }

  function bytes(value) {
    if (value >= 1048576) return (value / 1048576) + ' MiB';
    return (value / 1024) + ' KiB';
  }

  function paintLevels() {
    const preset = levels();

    Table.paint('lad-levels', preset.map(function (level) {
      return [level.name, bytes(level.capacity), level.cycles,
        (level.cycles / preset[0].cycles).toFixed(1) + 'x',
        level.sets + ' sets x ' + level.ways + ' ways x 64 B'];
    }).concat([['DRAM', 'all of it', Hierarchy.DRAM_CYCLES,
      (Hierarchy.DRAM_CYCLES / preset[0].cycles).toFixed(0) + 'x', 'banks and rows (37.8)']]),
      'Capacities rise by about sixteen times per level and latencies by three or four, which '
      + 'is the trade that makes the arrangement pay: each level is small enough to be fast and '
      + 'large enough to catch most of what the level above missed. The demo is not told any of '
      + 'these numbers - it recovers the three capacities from the shape of the timing curve.');
  }

  function paintCurve(view) {
    const rows = view.curve;

    Table.paint('lad-curve', rows.map(function (row, at) {
      const before = at ? rows[at - 1].cycles : row.cycles;

      return [bytes(row.bytes), row.cycles.toFixed(1),
        at === 0 ? 'the baseline' : (row.cycles / Math.max(before, 1e-9)).toFixed(2) + 'x',
        servedBy(row.cycles)];
    }), 'Flat while the working set fits, and a step up when it does not. The last column is '
      + 'read off the cycle count rather than from the model, which is the whole method: a '
      + 'number near the L1 hit time means the set fits in L1, and nobody had to be told where '
      + 'the boundary was.');
  }

  function servedBy(cycles) {
    const preset = levels();

    if (cycles < preset[1].cycles) return 'L1';
    if (cycles < preset[2].cycles) return 'L2';
    if (cycles < Hierarchy.DRAM_CYCLES * 0.6) return 'L3';
    return 'DRAM';
  }

  /** An empty table reads as a broken one, so a curve with no steps says so in
   *  a row rather than leaving the body blank. The three configured capacities
   *  are named beside it, because "found nothing" only means something against
   *  what was there to be found. */
  function paintSteps(view) {
    const preset = levels();

    if (!view.steps.length) {
      Table.paint('lad-steps', [['none', '—', '—', '—',
        { value: 'all three missed: ' + preset.map(function (level) {
          return bytes(level.capacity);
        }).join(', '), className: 'bad' }]], stepCaption(view));
      return;
    }
    Table.paint('lad-steps', view.steps.map(function (step) {
      const match = preset.filter(function (level) {
        return level.capacity === step.capacity;
      })[0];

      return [bytes(step.capacity), step.from.toFixed(1), step.to.toFixed(1),
        step.ratio.toFixed(2) + 'x',
        { value: match ? match.name + ', exactly' : 'no level of this size',
          className: match ? 'good' : 'bad' }];
    }), stepCaption(view));
  }

  function stepCaption(view) {
    if (!view.steps.length && view.pattern === 'ordered') {
      return 'No steps at all, and the curve sits at the L1 hit time however large the working '
        + 'set gets - which reads as "everything fits in L1" and is a confident wrong answer. '
        + 'The addresses are in order, so the prefetcher predicts every one of them and the '
        + 'demand accesses hit a line that is already there. The shuffle is not decoration: it '
        + 'is the only thing making the next address unpredictable.';
    }
    if (!view.steps.length) {
      return 'No steps at all, which is the failure this control exists to show. A sequential '
        + 'walk overlaps its accesses, so the average time per access stays low however large '
        + 'the working set gets - and here it settles BELOW the four-cycle L1 hit, which is '
        + 'impossible for a latency and is the tell. The number is a bandwidth figure and the '
        + 'method needs a latency one. Switch back to the chase and the steps reappear.';
    }
    return 'The size BELOW each step is the capacity, because that is the largest working set '
      + 'that still fitted. Getting that off by one is how a discovery routine reports every '
      + 'cache as twice its real size, and it is the only subtle part of the method.';
  }

  function paintRatios() {
    Table.paint('lad-ratios', RATIOS.map(function (row) {
      return [row.level, row.here, row.real, row.means];
    }), 'The middle column is a range on purpose. The absolute figures move every generation '
      + 'and the ratios do not, so the ratios are what to carry: a DRAM access is worth about '
      + 'eighty L1 hits, and that has been roughly true for twenty years. Any design decision '
      + 'that changes which level a workload lands in dominates every other optimisation on '
      + 'this page.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#lad-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, { lazyLib: app.lazyLib, height: 260,
      logX: true, xLabel: 'working set (bytes)', yLabel: 'cycles per access',
      series: [{ label: view.pattern === 'stream' ? 'sequential' : 'pointer chase',
        points: view.curve.map(function (row) {
          return { x: row.bytes, y: row.cycles };
        }) }],
      markers: levels().map(function (level) {
        return { x: level.capacity, label: level.name, anchor: 'start' };
      }) });
    root.Helpers.setText('lad-chart-note', chartNote(view));
  }

  function chartNote(view) {
    if (view.pattern === 'ordered') {
      return 'The same dependent chain over exactly the same bytes, laid out in address order, '
        + 'and the staircase is gone. Nothing overlaps - each access still waits for the one '
        + 'before - but the prefetcher can see where this is going and fetches ahead, so every '
        + 'demand access finds its line already resident. An ordered chase is not a chase, and '
        + 'the flat line at the L1 hit time is what a measurement of the prefetcher looks '
        + 'like.';
    }
    if (view.pattern === 'stream') {
      return 'A sequential walk over exactly the same bytes, and the staircase is gone twice '
        + 'over: the prefetcher covers it AND the accesses no longer depend on one another, so '
        + 'the machine overlaps as many as it has miss registers for. The result settles at '
        + 'one cycle per access - below the four-cycle L1 hit, which no latency can be. That '
        + 'is the most common way a memory measurement is reported wrongly by an order of '
        + 'magnitude, and the impossible number is how to catch it.';
    }
    return 'Each flat stretch is a level holding the whole working set, and each step is that '
      + 'level running out. The markers are the configured capacities, and the steps land on '
      + 'them - which is the claim: the sizes were recovered from timing rather than read from '
      + 'the configuration. The logarithmic size axis is what makes the steps evenly spaced, '
      + 'because the capacities themselves rise geometrically.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
