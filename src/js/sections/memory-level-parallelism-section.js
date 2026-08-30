/**
 * Section: Memory-level parallelism.
 *
 * The headline result of the milestone, and the one most likely to change how
 * somebody writes code: an array walk and a pointer chase over the SAME cache
 * lines, with the SAME number of misses, differ by nearly four times in
 * cycles. The miss count — the number everybody profiles — is identical. What
 * differs is whether the misses can overlap.
 *
 * Two controls make that concrete rather than assertable. The miss status
 * registers cap how many misses may be outstanding, and sweeping them moves
 * `stride` from 648 cycles to 128 while leaving `chase` at 678 in every
 * setting. The reorder buffer does the same from the other direction: overlap
 * needs somewhere to put the instructions that are running ahead.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'memory-level-parallelism';
  const Lab = root.OooLab;
  const Table = root.DataTable;
  const View = root.OooView;
  const SMALL = { sets: 8, ways: 1, lineBytes: 32 };
  const MSHRS = [1, 2, 4, 8, 16];
  const SIZES = [8, 16, 32, 64, 128];
  let panel = null;
  let chart = null;

  const RULES = [
    { rule: 'a store never writes memory before it commits',
      why: 'a speculative store could not be taken back — memory has no free list',
      cost: 'every store occupies a queue entry from execute to commit',
      where: '36.3, where the exception fixtures depend on it' },
    { rule: 'a load takes its value from an older store to the same address',
      why: 'that store has not written memory yet, so memory holds the stale value',
      cost: 'an associative search of the store queue on every load',
      where: 'the forwarding table below: `alias` never touches the cache at all' },
    { rule: 'a load may pass a store whose address is unknown',
      why: 'waiting for every older store serialises the whole loop',
      cost: 'a squash when the guess is wrong, and a predictor to remember',
      where: '36.5, on the hiddenAlias and hiddenDisjoint pair' },
    { rule: 'a miss occupies a miss status register until it returns',
      why: 'the cache has to remember which line it asked for and who is waiting',
      cost: 'when they are all in use, the next miss cannot even start',
      where: 'the MSHR sweep on this page' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function optionsFor(view, extra) {
    return Object.assign({ width: 4, mshrs: view.mshrs, capacity: view.window,
      physical: 192, queueSize: 128 }, view.cache === 'small' ? SMALL : {}, extra || {});
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — four misses in flight, and the register each one needs',
      caption: 'A non-blocking cache does not stop when it misses: it records the line it is '
        + 'waiting for in a miss status holding register and carries on serving other '
        + 'accesses. The number of those registers is the hard limit on how many misses can '
        + 'overlap, which turns "how much memory parallelism does this program have" from a '
        + 'property of the code into a property of the machine — and only for code that has '
        + 'any. A pointer chase cannot use a second register, because it does not know the '
        + 'second address until the first miss has returned.',
      definition: [
        'flowchart LR',
        '    L1["load A: miss"] --> M1["MSHR 0: line 0x40"]',
        '    L2["load B: miss"] --> M2["MSHR 1: line 0x60"]',
        '    L3["load C: miss"] --> M3["MSHR 2: line 0x80"]',
        '    L4["load D: miss"] --> M4["MSHR 3: line 0xa0"]',
        '    L5["load E: miss"] --> F{"all four in use"}',
        '    F -->|"cannot start"| STALL["wait for one to return"]',
        '    M1 --> MEM["memory: all four in flight at once"]',
        '    M2 --> MEM',
        '    M3 --> MEM',
        '    M4 --> MEM',
        '    MEM -->|"one latency, not four"| DONE["four lines back"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Two traversals over the same cache lines, the same number of misses, and nearly '
        + 'four times the cycles.** `stride` walks a buffer one cache line at a time with the '
        + 'address computed from a counter; `chase` walks the same lines in a shuffled order '
        + 'with each address loaded from the previous line. On a 256-byte cache both miss '
        + 'exactly 32 times. `stride` takes 174 cycles and `chase` takes 678.',
      '**The difference is memory-level parallelism, and it is measurable.** The demo reports '
        + 'the average number of misses in flight during the cycles when any were: 3.86 for '
        + '`stride` and 1.00 for `chase`. The array\'s misses overlap and the list\'s cannot, '
        + 'because the address of the next node is the value the previous load returned.',
      '**A non-blocking cache is what makes overlap possible.** A blocking cache stops the '
        + 'machine on a miss; a non-blocking one records the outstanding line in a miss status '
        + 'holding register and keeps serving. The number of those registers is a hard cap: '
        + 'sweeping them from 1 to 8 takes `stride` from 648 cycles to 128, and leaves `chase` '
        + 'at 678 in every single setting.',
      '**Overlap also needs a window, which is the other half of the same story.** The second '
        + 'miss can only start if the instruction that causes it has been dispatched, and that '
        + 'needs a free reorder-buffer entry. `stride` runs 378 cycles with 8 entries and 174 '
        + 'with 32. That is the real reason reorder buffers grew past 500 entries: not '
        + 'instruction-level parallelism, but running far enough ahead to find the next miss.',
      '**The miss count is the number everybody profiles and it is the wrong one here.** Both '
        + 'traversals miss 32 times. A cache-miss counter, a miss rate, a "cache-unfriendly '
        + 'code" verdict — none of them can tell these two programs apart, and they differ by '
        + '3.9x. The unit that separates them is misses-in-flight, and it needs a different '
        + 'counter.',
      '**This is why an array beats a linked list, and it is not the reason usually given.** '
        + 'The usual explanation is locality, and locality is real — but with the miss counts '
        + 'held equal the array is still four times faster. Prefetching amplifies the gap '
        + 'further, because a strided pattern is predictable and a chase is not, but the gap '
        + 'exists before any prefetcher is involved.',
      '**A store never writes memory before it commits, so a load has to look in the '
        + 'queue.** Store-to-load forwarding hands a younger load the value from an older '
        + 'store\'s queue entry, and such a load never reaches the cache at all: `alias` '
        + 'forwards 8 of its loads and makes zero cache accesses in the whole run. A store '
        + 'immediately followed by a load of the same address is very nearly free.',
      '**The ordering rules are four, and each one is a trade rather than a law.** They are '
        + 'in the table below with what each one costs and where in this milestone it gets '
        + 'measured. Three of the four exist to allow something to go earlier than it safely '
        + 'could, and each of those needs a way to notice and undo.',
      '**Prefetching is M37\'s subject and it interacts with all of this.** A hardware '
        + 'prefetcher watching `stride` sees a constant delta and issues the loads before the '
        + 'program asks; watching `chase` it sees a sequence of unrelated addresses and can do '
        + 'nothing at all. The same property that gives the array its memory-level parallelism '
        + 'is the one that makes it predictable, which is why the two effects compound.'
    ];
  }

  function insight() {
    return '**The difference between an array and a linked list on a modern machine is '
      + 'overwhelmingly memory-level parallelism, and almost nobody says so.** The standard '
      + 'explanation is locality: the array is contiguous, so a cache line holds several '
      + 'elements and one miss serves many accesses. That is true and it is not what this '
      + 'page measures — the two fixtures here touch exactly the same cache lines and miss '
      + 'exactly the same number of times, and the array is still nearly four times faster. '
      + 'The reason is that a machine can have four, or ten, or twenty of the array\'s misses '
      + 'outstanding at once, because it knows every address in advance; a pointer chase '
      + 'cannot have two, because the address of the next node is the value the previous load '
      + 'returned, and no amount of window, width or bandwidth changes that. This is why the '
      + '"cache-friendly data structures" advice keeps being right for reasons its usual '
      + 'justification does not cover, and it is why a B-tree with fat nodes beats a balanced '
      + 'binary tree by far more than the node-count arithmetic in M04 predicted. Once you '
      + 'know to look for it, the question about any data structure stops being "does it fit '
      + 'in cache" and becomes "when it misses, does it know where the next miss will be" — '
      + 'and that question has a different answer, and a different fix.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — the same misses, overlapped or not',
        markup: root.MlpTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.MlpTemplate.controls,
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const view = { name: values['mlp-program'], cache: values['mlp-cache'],
      mshrs: Number(values['mlp-mshrs']), window: Number(values['mlp-window']) };

    view.options = optionsFor(view);
    view.run = Lab.run(view.name, view.options);
    view.found = Lab.summary(view.name, view.options);
    return view;
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintPair(view);
    paintMshrs(view);
    paintWindow(view);
    paintRules();
    paintForwarding();
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const found = view.found;
    const measured = View.mlp(view.run.core);

    root.MetricGrid.update({
      'mlp-cycles': { value: found.cycles, note: found.retired + ' instructions retired' },
      'mlp-misses': { value: found.cache.misses,
        note: (100 * found.cache.hitRate).toFixed(1) + '% hit rate over ' +
          found.cache.accesses + ' accesses' },
      'mlp-value': { value: measured.average.toFixed(2),
        note: 'averaged over the ' + measured.cycles + ' cycles when a miss was outstanding' },
      'mlp-peak': { value: measured.peak,
        note: 'against ' + view.mshrs + ' miss registers available' },
      'mlp-stalls': { value: found.lsq.mshrStalls,
        note: found.lsq.mshrStalls ? 'the registers were the limit, not the program'
          : 'no miss was ever refused a register' },
      'mlp-forwarded': { value: found.lsq.forwarded,
        note: 'taken from an older store still sitting in the queue' }
    });
  }

  function paintPair(view) {
    const rows = ['stride', 'chase'].map(function (name) {
      const options = optionsFor(view);
      const found = Lab.summary(name, options);
      const measured = View.mlp(Lab.run(name, options).core);

      return { name: name, cycles: found.cycles, misses: found.cache.misses,
        mlp: measured.average, peak: measured.peak };
    });
    const ratio = rows[1].cycles / Math.max(rows[0].cycles, 1);

    Table.paint('mlp-pair', rows.map(function (row, at) {
      return [row.name, row.cycles, row.misses, row.mlp.toFixed(2), row.peak,
        at === 0 ? (1 / ratio).toFixed(2) + 'x' : ratio.toFixed(2) + 'x'];
    }), 'The miss counts are ' + (rows[0].misses === rows[1].misses ? 'identical'
      : rows[0].misses + ' and ' + rows[1].misses) + ' and the cycle counts differ by '
      + ratio.toFixed(2) + 'x. Every cache-miss counter in existence would report these two '
      + 'programs as equally cache-hostile. The column that separates them is the fourth one, '
      + 'and it is not a counter most profilers expose.');
  }

  function paintMshrs(view) {
    Table.paint('mlp-mshr', MSHRS.map(function (count) {
      const cells = ['stride', 'chase'].map(function (name) {
        const options = optionsFor(view, { mshrs: count });

        return { cycles: Lab.summary(name, options).cycles,
          mlp: View.mlp(Lab.run(name, options).core).average };
      });

      return [count, cells[0].cycles, cells[0].mlp.toFixed(2), cells[1].cycles,
        cells[1].mlp.toFixed(2)];
    }), 'One control, two completely different answers. `stride` goes from 648 cycles at one '
      + 'miss register to 128 at eight, and its measured parallelism rises from 1.00 to 5.41 '
      + '— the hardware was the limit and removing it worked. `chase` is 678 cycles at every '
      + 'setting with a parallelism of exactly 1.00, because the program has no second '
      + 'address to fetch. Buying miss registers for a pointer-chasing workload is buying '
      + 'nothing.');
  }

  function paintWindow(view) {
    Table.paint('mlp-window-table', SIZES.map(function (size) {
      const cells = ['stride', 'chase'].map(function (name) {
        return Lab.summary(name, optionsFor(view, { capacity: size })).cycles;
      });

      return [size, cells[0], cells[1],
        size >= 32 ? 'the miss registers' : 'the window — it cannot run far enough ahead'];
    }), 'Miss registers are useless without somewhere to put the instructions that are '
      + 'running ahead to find the next miss. At 8 reorder-buffer entries `stride` cannot '
      + 'reach past its own loop, and takes 378 cycles with four registers idle. This is the '
      + 'real argument for a large window, and it is a memory argument rather than an '
      + 'instruction-level one — which is why window sizes kept growing long after issue '
      + 'widths stopped.');
  }

  function paintRules() {
    Table.paint('mlp-rules', RULES.map(function (row) {
      return [row.rule, row.why, row.cost, row.where];
    }), 'The first rule is a correctness requirement and the other three are trades. Each of '
      + 'the trades lets something happen earlier than it provably could, and each therefore '
      + 'needs a way to detect a mistake and undo it — which is the same three-part shape as '
      + 'every other kind of speculation in 36.5.');
  }

  function paintForwarding() {
    Table.paint('mlp-forward', ['alias', 'disjoint', 'hiddenAlias', 'stride'].map(function (name) {
      const found = Lab.summary(name, { width: 4 });

      return [name, found.lsq.loads, found.lsq.forwarded, found.cache.accesses,
        found.cycles];
    }), '`alias` stores and then loads the same address every iteration, and forwards every '
      + 'one of those loads out of the store queue — its run makes zero cache accesses in '
      + 'total. That is why a store immediately followed by a load of the same address is '
      + 'nearly free, and why the compiler pattern of spilling a value and reloading it a few '
      + 'instructions later costs far less than the two memory operations suggest.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#mlp-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, { lazyLib: app.lazyLib, height: 260,
      xLabel: 'cycle', yLabel: 'misses outstanding',
      series: ['stride', 'chase'].map(function (name) {
        return { label: name, points: View.outstanding(Lab.run(name, optionsFor(view)).core)
          .map(function (row) { return { x: row.cycle, y: row.inFlight }; }) };
      }) });
    root.Helpers.setText('mlp-chart-note', 'The whole section in one picture. `stride` sits '
      + 'at the miss-register limit for most of its run — four lines being fetched at once, '
      + 'one memory latency covering all four. `chase` is a flat line at one: a miss, a wait, '
      + 'the address it returns, the next miss. Same lines, same misses, and one of them is '
      + 'paying the latency 32 times while the other pays it eight.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
