/**
 * Section: Anatomy of a modern core.
 *
 * The milestone's closing method: charge every issue slot of every cycle to
 * exactly one of four categories, and let the largest one say which half of
 * the machine to look at. The accounting is the load-bearing part - a cycle
 * offers `width` slots and every one of them is charged, so the four shares sum
 * to 100% by construction and the test suite asserts it on every program.
 *
 * The "apply a change and watch the category move" half is built from the
 * matched fixture pairs, because each pair IS a code change with everything
 * else held constant. Turning `chase` into `stride` is a data-structure
 * change, and it moves retiring from 4.9% to 23.7% and the cycle count from
 * 678 to 174.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'anatomy-of-a-modern-core';
  const Lab = root.OooLab;
  const Table = root.DataTable;
  const Topdown = root.Topdown;
  const SMALL = { sets: 8, ways: 1, lineBytes: 32 };
  /** The three matched pairs. Their labels come from `OooLab.shortName`, which
   *  is written out rather than truncated - slicing the names collides
   *  `hiddenAlias` with `hiddenDisjoint`, and a band scale with a duplicate
   *  key silently stacks two bars and loses four of the twenty-four. */
  const CHARTED = ['chain', 'independent', 'stride', 'chase', 'hiddenAlias',
    'hiddenDisjoint'];
  let panel = null;
  let chart = null;

  const FIXES = [
    { before: 'chase', after: 'stride',
      change: 'walk an array instead of a linked list — the addresses become predictable',
      moved: 'back-end bound, and retiring nearly five times up' },
    { before: 'chain', after: 'independent',
      change: 'break the dependence chain: accumulate into four registers, not one',
      moved: 'the cycle count halves; the code, not the machine, was the limit' },
    { before: 'hiddenAlias', after: 'hiddenDisjoint',
      change: 'stop the store and the load landing on the same address',
      moved: 'bad speculation, from 27.0% to 15.7%' },
    { before: 'alias', after: 'disjoint',
      change: 'read a different address from the one just written',
      moved: 'front-end to back-end — a different bottleneck, and a slower program' }
  ];

  /**
   * Order-of-magnitude figures for a large contemporary core, from the vendor
   * optimisation manuals and Agner Fog's microarchitecture document. They are
   * given as ranges on purpose: the exact numbers differ by generation and by
   * vendor, and the point of the table is the ratio to this simulator rather
   * than any particular value.
   */
  const DIMENSIONS = [
    { name: 'decode / rename width', here: '4 instructions',
      real: '4 to 8 micro-operations',
      why: 'a x86 instruction becomes several micro-operations, so the widths are not comparable directly' },
    { name: 'reorder buffer', here: '32 entries', real: 'several hundred',
      why: 'to keep running past a memory access that takes two hundred cycles (36.6)' },
    { name: 'physical integer registers', here: '64', real: 'a couple of hundred',
      why: 'renaming can only run as deep as the file allows (36.2)' },
    { name: 'issue queue', here: '32 entries', real: 'a hundred or more, often split per port',
      why: 'wakeup and select cost grows with it, so it is split rather than enlarged' },
    { name: 'execution ports', here: '4', real: '8 to 12',
      why: 'more kinds of unit — vector, multiply, divide, several address generators' },
    { name: 'load/store queue', here: '16 entries, shared',
      real: 'around a hundred loads and rather fewer stores',
      why: 'memory-level parallelism needs many loads in flight at once' },
    { name: 'L1 data cache', here: '4 KiB, one level', real: '32 to 48 KiB, and three levels',
      why: 'M37 is the milestone that builds the hierarchy this one only borrows from' },
    { name: 'branch mispredict penalty', here: 'the refetch, a few cycles',
      real: 'fifteen to twenty cycles',
      why: 'a deeper front end has more to refill, which is M35.8\'s depth trade' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function optionsFor(view) {
    return Object.assign({ width: view.width }, view.small ? SMALL : {});
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — the top-down tree, and the question at each branch',
      caption: 'Every issue slot in every cycle goes down exactly one path. Was it used? If '
        + 'yes, did the instruction using it survive to commit? If it was empty, was the back '
        + 'end able to accept work? Three questions, four leaves, and the shares sum to 100% '
        + 'because nothing can take two paths. That is why the method works as a decision '
        + 'procedure rather than as a list of counters: you are not comparing numbers from '
        + 'different denominators.',
      definition: [
        'flowchart TD',
        '    S["every issue slot: width x cycles"] --> Q1{"was the slot used?"}',
        '    Q1 -->|"yes"| Q2{"did that instruction commit?"}',
        '    Q1 -->|"no"| Q3{"could the back end have taken it?"}',
        '    Q2 -->|"yes"| R["RETIRING<br/>useful work"]',
        '    Q2 -->|"no"| B["BAD SPECULATION<br/>squashed, plus the recovery"]',
        '    Q3 -->|"yes"| F["FRONT-END BOUND<br/>fetch, decode, layout"]',
        '    Q3 -->|"no"| K["BACK-END BOUND<br/>window, registers, memory"]',
        '    R --> A["make the program ask for less"]',
        '    B --> C["change the data or the branch structure"]',
        '    F --> D["code layout, branch density, instruction footprint"]',
        '    K --> E["memory access pattern, dependence chains, window pressure"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Four numbers tell you which half of the machine to look at, before you read a line '
        + 'of assembly.** Every issue slot the machine had — width times cycles — is charged '
        + 'to exactly one of retiring, bad speculation, front-end bound and back-end bound. '
        + 'The largest non-retiring category is where the time went, and each of the four '
        + 'implies a completely different next action.',
      '**The accounting has to be exact, and here it is exact by construction.** A cycle '
        + 'offers `width` slots; the ones that were used are split by whether the instruction '
        + 'survived to commit, and the empty ones go to whichever stall category the cycle was '
        + 'in. Nothing is left over and nothing is counted twice, so the four shares sum to '
        + '100.0% on every program in the demo, and a test asserts it.',
      '**Retiring is the good category and a high number is not always good news.** A program '
        + 'that is 80% retiring is not going to be fixed by the processor: it is doing the '
        + 'work it was asked to do, and the only remaining move is to ask for less. That is a '
        + 'useful thing to learn early, because it is the case where further microarchitectural '
        + 'investigation is guaranteed to be wasted.',
      '**Bad speculation is where branchy, data-dependent code lands.** `factorial` spends '
        + '51.2% of its slots there and `arrayMax` 47.1%, because both have branches whose '
        + 'direction depends on the data. The fix is never "predict better" — it is to change '
        + 'the data, sort the input, or remove the branch, which is exactly the M35.9 result '
        + 'about sorted arrays.',
      '**Back-end bound is usually memory, and the drill-down says which structure.** `chase` '
        + 'on a small cache spends 72.1% of its slots back-end bound with "the reorder buffer '
        + 'is full" as the single largest reason — the buffer is full of loads waiting on '
        + 'misses that cannot overlap. That is 36.6\'s result arriving through a different '
        + 'instrument, which is the point of having two.',
      '**Front-end bound is the category that needs care on a short program.** These fixtures '
        + 'are small enough that the whole program fits in the window, so the front end runs '
        + 'out of program rather than out of bandwidth. The drill-down says so in words rather '
        + 'than letting "front-end bound" imply a decoder problem that does not exist, and '
        + 'real traces do not have this shape.',
      '**The method is a decision procedure, which is what makes it different from a counter '
        + 'dump.** Two hundred hardware counters with different denominators cannot be '
        + 'compared; four shares of the same denominator can. That is the whole contribution '
        + 'of Yasin\'s paper, and it is why every serious profiler now has a top-down mode.',
      '**Apply the change and the category moves, which is how you know the diagnosis was '
        + 'right.** Turning `chase` into `stride` — the same traversal over an array instead '
        + 'of a list — takes retiring from 4.9% to 23.7% and the cycle count from 678 to 174. '
        + 'If the suggested change does not move the category it was aimed at, the diagnosis '
        + 'was wrong and no amount of further tuning in that direction will help.',
      '**This simulator is one to two orders of magnitude smaller than a real core in every '
        + 'dimension, and the shapes are the same.** Thirty-two reorder-buffer entries against '
        + 'several hundred, four ports against ten, four kilobytes of cache against forty-eight. '
        + 'The dimensions table sets them side by side. What transfers is not the numbers but '
        + 'every curve in this milestone: the width plateau, the memory-parallelism gap, the '
        + 'speculation bill and the four categories.'
    ];
  }

  function insight() {
    return '**Top-down analysis is worth more than any individual fact in this milestone, '
      + 'because it converts an open-ended question into a decision with four answers.** '
      + '"Why is this slow" has no method behind it, and the usual response is to guess from '
      + 'experience, change something, and measure again — which works, slowly, and works '
      + 'badly on code nobody in the room wrote. The top-down question is different: of the '
      + 'issue slots this machine had, what fraction did useful work, what fraction was '
      + 'thrown away, what fraction went unfilled because work did not arrive, and what '
      + 'fraction went unfilled because the machine would not take it? Those four cover '
      + 'everything, they sum to one, and each of them points somewhere specific. It is the '
      + 'same move that makes a good incident review different from a bad one, and the same '
      + 'move behind Amdahl\'s law and behind a flame graph: partition the total into '
      + 'exhaustive, non-overlapping parts before arguing about any one of them. The '
      + 'processor version is the most refined instance of it because the hardware counts the '
      + 'slots for you, but the discipline is portable and costs nothing: whenever you are '
      + 'about to optimise something, first write down where 100% of it goes. Most of the '
      + 'time the answer changes what you were going to do next.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — four numbers, and the change each one implies',
        markup: root.TopdownTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.TopdownTemplate.controls(),
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const view = { name: values['tdn-program'], small: Boolean(values['tdn-cache']),
      width: Number(values['tdn-width']) };

    view.options = optionsFor(view);
    view.found = Lab.topdown(view.name, view.options);
    view.summary = Lab.summary(view.name, view.options);
    return view;
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintCategories(view);
    paintDrill(view);
    paintFixes(view);
    paintAll(view);
    paintDimensions();
    paintChart(app, view);
  }

  function share(view, key) {
    return (100 * view.found.shares[key]).toFixed(1) + '%';
  }

  function paintMetrics(view) {
    const found = view.found;
    const total = Object.keys(found.shares).reduce(function (sum, key) {
      return sum + found.shares[key];
    }, 0);

    root.MetricGrid.update({
      'tdn-retiring': { value: share(view, 'retiring'),
        note: 'of ' + found.slots + ' slots — ' + found.width + ' per cycle x ' +
          found.cycles + ' cycles' },
      'tdn-badspec': { value: share(view, 'badSpeculation'),
        note: view.summary.squashed + ' instructions squashed in total' },
      'tdn-frontend': { value: share(view, 'frontEnd'),
        note: 'the back end was ready and nothing arrived' },
      'tdn-backend': { value: share(view, 'backEnd'),
        note: 'work was ready and the back end refused it' },
      'tdn-total': { value: (100 * total).toFixed(1) + '%',
        note: found.reconciles ? found.counted + ' of ' + found.slots + ' slots charged'
          : 'THE CATEGORIES DO NOT RECONCILE' },
      'tdn-verdict': { value: found.dominant.name,
        note: found.dominant.then }
    });
  }

  function paintCategories(view) {
    Table.paint('tdn-categories', view.found.rows.map(function (row) {
      return [row.name, row.slots, (100 * row.share).toFixed(1) + '%', row.about, row.then];
    }), Topdown.verdict(view.found) + ' The four rows sum to ' + view.found.counted
      + ' slots against ' + view.found.slots + ' available, which is '
      + (view.found.reconciles ? 'exact — nothing is left over and nothing is counted twice.'
        : 'NOT exact, which would mean the classifier has a hole in it.'));
  }

  function paintDrill(view) {
    const rows = [];

    view.found.rows.forEach(function (category) {
      category.detail.forEach(function (row) {
        rows.push([category.name, row.reason, row.slots,
          (100 * row.slots / Math.max(1, category.slots)).toFixed(1) + '%']);
      });
    });
    Table.paint('tdn-drill', rows.length ? rows
      : [['retiring', 'every slot did useful work', view.found.rows[0].slots, '100.0%']],
      'The category says which half of the machine; the reason says which structure. '
      + '"The reorder buffer is full" and "no free physical register" are both back-end '
      + 'bound and they call for different changes — one is a window problem and the other a '
      + 'renaming-depth problem. A breakdown that stopped at four numbers would be a start; '
      + 'this is the part that ends the argument.');
  }

  function paintFixes(view) {
    Table.paint('tdn-fixes', FIXES.map(function (fix) {
      const before = Lab.topdown(fix.before, view.options);
      const after = Lab.topdown(fix.after, view.options);

      return [fix.before, fix.after, fix.change,
        Lab.summary(fix.before, view.options).cycles + ' → ' +
          Lab.summary(fix.after, view.options).cycles,
        (100 * before.shares.retiring).toFixed(1) + '% → ' +
          (100 * after.shares.retiring).toFixed(1) + '%',
        fix.moved];
    }), 'Each row is a real code change with everything else held constant — the same '
      + 'machine, the same settings, and in the first two rows the same instruction count. '
      + 'The test of a diagnosis is that the suggested change moves the category it was aimed '
      + 'at. If it does not, the diagnosis was wrong, and more tuning in that direction is '
      + 'time spent confirming a mistake.');
  }

  function paintAll(view) {
    Table.paint('tdn-all', Lab.names().map(function (name) {
      const found = Lab.topdown(name, view.options);
      const summary = Lab.summary(name, view.options);
      const percent = function (key) {
        return (100 * found.shares[key]).toFixed(1) + '%';
      };

      return [name, summary.cycles, summary.ipc.toFixed(3), percent('retiring'),
        percent('badSpeculation'), percent('frontEnd'), percent('backEnd'),
        found.dominant.name];
    }), 'Twelve programs on one machine, and the verdict differs on almost every row. That '
      + 'is the argument for the method: the same hardware is front-end bound, back-end bound '
      + 'and bad-speculation bound depending only on what it is running, so a statement like '
      + '"this processor is memory bound" is not a statement about the processor at all.');
  }

  function paintDimensions() {
    Table.paint('tdn-dimensions', DIMENSIONS.map(function (row) {
      return [row.name, row.here, row.real, row.why];
    }), 'The right-hand column is deliberately a range rather than a figure: the exact '
      + 'numbers differ by generation and by vendor, and the point of the table is the ratio '
      + 'rather than the value. Everything here is one to two orders of magnitude smaller '
      + 'than a large contemporary core, and every curve in this milestone has the same shape '
      + 'anyway — which is the useful claim, because it is the shapes that transfer.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#tdn-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    /* Six programs rather than all twelve: four bars each is twenty-four, and a
       band scale with forty-eight categories renders a row of overlapping
       labels that says nothing. The six are the three matched pairs the rest
       of the milestone measures. */
    const keys = [{ key: 'retiring', short: 'ret' },
      { key: 'badSpeculation', short: 'spec' }, { key: 'frontEnd', short: 'front' },
      { key: 'backEnd', short: 'back' }];

    chart = root.ErrorBandView.bars(host, { lazyLib: app.lazyLib, height: 280,
      yLabel: 'share of issue slots',
      values: CHARTED.reduce(function (out, name) {
        const found = Lab.topdown(name, view.options);

        keys.forEach(function (row, index) {
          out.push({ label: Lab.shortName(name) + ' ' + row.short,
            value: found.shares[row.key], series: index });
        });
        return out;
      }, []) });
    root.Helpers.setText('tdn-chart-note', 'Four bars per program — retiring, bad '
      + 'speculation, front-end bound, back-end bound — and every group sums to 1.0 because '
      + 'that is what the classifier guarantees. The three matched pairs are shown rather '
      + 'than all twelve programs, so the comparison to make is within a pair: `chain` '
      + 'against `independent`, and `chase` against `stride`, are the same work with one '
      + 'structural property changed, and the bars move accordingly. The first bar in each '
      + 'group is the only one anybody wants to be large.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
