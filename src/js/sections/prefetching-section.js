/**
 * Section: Prefetching.
 *
 * Coverage and accuracy, always together. Coverage alone is the number that
 * gets quoted and it is the one that can be bought by guessing constantly: the
 * stream prefetcher removes 98% of the misses on the strided pattern at 33%
 * accuracy, and the harness reports that as the net loss it is.
 *
 * The confidence counter is the other half. On a random pattern the stride
 * prefetcher issues NOTHING - every pair of addresses defines a delta, and
 * only a delta that has repeated is worth acting on. A design that is right by
 * refusing to guess is unusual enough to be worth showing.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'prefetching';
  const Lab = root.MemoryLab;
  const Table = root.DataTable;
  const Prefetchers = root.Prefetchers;
  const PATTERNS = ['sequential', 'strided', 'random', 'chase'];
  const KINDS = ['nextLine', 'stride', 'stream'];
  let panel = null;
  let chart = null;

  const LIMITS = [
    { name: 'a pointer chase', why: 'the next address is the value the current load returns, '
      + 'so there is nothing to predict from until the miss has already been paid',
      helps: 'change the data structure - an array, a B-tree with fat nodes, anything that '
        + 'knows several addresses at once (36.6)' },
    { name: 'a random access pattern', why: 'a delta exists between every pair of addresses '
      + 'and none of them repeats',
      helps: 'the confidence counter, which stops the prefetcher rather than helping it' },
    { name: 'the very first access', why: 'a prefetcher needs history and there is none yet',
      helps: 'nothing: a compulsory miss stays compulsory, which is what 37.4 said' },
    { name: 'a stride the prefetcher cannot represent',
      why: 'a table indexed by program counter holds one delta per site, so two interleaved '
        + 'strides from one instruction defeat it',
      helps: 'more table entries, or a software prefetch that states the address outright' },
    { name: 'a prefetch that arrives too late',
      why: 'issuing one line ahead means the demand access is already waiting when it lands',
      helps: 'distance: run several lines ahead, which is what a stream prefetcher is for' }
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
      title: 'Diagram — a stride prefetcher deciding whether to act',
      caption: 'The table is indexed by the instruction rather than by the address, because '
        + 'two loops walking one array have two strides and one address stream. The confidence '
        + 'counter is the whole difference between this and a random-address generator: two '
        + 'accesses define a delta, and in a random pattern every pair of accesses also defines '
        + 'one. Only a delta that has repeated is evidence.',
      definition: [
        'flowchart TD',
        '    A["a load at program counter P"] --> T{"is P in the table?"}',
        '    T -->|"no"| N["record the address; issue nothing"]',
        '    T -->|"yes"| D["delta = this address - the last one"]',
        '    D --> S{"same delta as last time?"}',
        '    S -->|"no"| R["reset the confidence to zero; issue nothing"]',
        '    S -->|"yes"| I["raise the confidence"]',
        '    I --> C{"confidence at the threshold?"}',
        '    C -->|"no"| W["still not sure; issue nothing"]',
        '    C -->|"yes"| F["prefetch address + delta, and further ahead if the degree allows"]'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**Two numbers, and almost everyone quotes only the first.** Coverage is the fraction of '
        + 'the misses a prefetcher removed. Accuracy is the fraction of its prefetches anybody '
        + 'ever used. Coverage can be bought by guessing constantly; accuracy is what decides '
        + 'whether the guessing was worth the bandwidth it consumed and the lines it evicted.',
      '**The clearest case is on the strided pattern.** The stream prefetcher removes 98% of '
        + 'the misses there — an excellent coverage figure — at 33% accuracy, issuing 382 '
        + 'prefetches to remove 126 misses and tripling the traffic. The harness calls that a '
        + 'net loss, which is the whole reason it reports both numbers rather than the '
        + 'flattering one.',
      '**Next-line prefetching is free and is exactly wrong on a stride.** On a sequential walk '
        + 'it gets 100% coverage at 100% accuracy for one extra line of traffic. On a walk with '
        + 'a stride of 192 bytes it removes NO misses at all and doubles the traffic, because '
        + 'the line after the one you touched is never the line you want next.',
      '**The confidence counter is a design that is right by refusing.** On a random pattern '
        + 'the stride prefetcher issues nothing whatsoever: every pair of addresses defines a '
        + 'delta and none of them repeats, so the counter never reaches its threshold. Doing '
        + 'nothing is the correct behaviour and it is worth seeing a mechanism achieve it '
        + 'deliberately.',
      '**Timeliness is a third property and distance is the control for it.** A prefetch issued '
        + 'one line ahead arrives while the demand access is already waiting, so it saves part '
        + 'of the latency rather than all of it. Running several lines ahead fixes that and '
        + 'costs accuracy at the end of every stream, which is the trade the distance slider '
        + 'moves.'
    ];
  }

  function closing() {
    return [
      '**A pointer chase cannot be prefetched, and that is not an implementation gap.** The '
        + 'next address is the value the current load returns, so nothing is knowable until the '
        + 'miss has already been paid. Every design on this page fails on it, and 36.6 measured '
        + 'what that costs — which is why the fix is a different data structure rather than a '
        + 'better predictor.',
      '**Pollution is the cost that does not appear in a miss count.** A wrong prefetch '
        + 'occupies a line, and the line it evicted was one somebody wanted. On a small cache '
        + 'an inaccurate prefetcher can raise the demand miss rate, which is the case that '
        + 'looks impossible until you remember the cache has a fixed number of frames.',
      '**Software prefetch instructions exist for the cases the hardware cannot see.** A '
        + 'traversal that knows its next-but-one address — a B-tree descent, a hash probe with '
        + 'the bucket already computed — can say so outright. They are also easy to get wrong: '
        + 'issued too early they are evicted before use, too late they save nothing, and either '
        + 'way they cost an instruction on the hot path.',
      '**A prefetcher shared between threads is shared bandwidth.** Two threads streaming '
        + 'through unrelated memory each get half the outstanding-miss capacity, and an '
        + 'aggressive prefetcher on one can evict the other\'s working set. That is the same '
        + 'sharing argument as 36.7, and it is why prefetcher aggressiveness is sometimes tuned '
        + 'down on many-core parts.'
    ];
  }

  function insight() {
    return '**"Coverage without accuracy is not a win" is the sentence to carry off this page, '
      + 'and it applies to every speculative optimisation anybody ships.** A prefetcher that '
      + 'removes most of the misses sounds unambiguously good until you notice it issued three '
      + 'requests for every one that helped: the bandwidth it consumed was bandwidth the demand '
      + 'misses needed, and the lines it installed evicted lines somebody was about to use. The '
      + 'arithmetic that decides it is the same one as 36.5 — the value is the hit rate times '
      + 'the saving, minus the full cost of every attempt — and the reason it is worth '
      + 'rehearsing here is that the failure is so much easier to hide. A misprediction in a '
      + 'processor shows up as wasted work in a counter; a wrong prefetch shows up as slightly '
      + 'more memory traffic, which nobody is looking at, and slightly worse hit rates '
      + 'elsewhere, which look like somebody else\'s problem. The same shape recurs wherever '
      + 'something is fetched before it is asked for: an eager loader that pulls related '
      + 'records, a CDN that warms caches on a guess, a client that pre-renders the page it '
      + 'thinks you will click. All of them are judged on the hit rate and all of them are paid '
      + 'for by everyone. Ask for the accuracy figure, and if nobody has it, that is itself the '
      + 'answer.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — the guesses, and what they cost',
        markup: root.PrefetchTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.PrefetchTemplate.controls,
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const settings = { degree: Number(values['pfe-degree']),
      distance: Number(values['pfe-distance']),
      confidence: Number(values['pfe-confidence']) };
    const rows = Lab.prefetch(values['pfe-workload'], { prefetcher: settings });

    return { workload: values['pfe-workload'], kind: values['pfe-kind'], settings: settings,
      rows: rows, baseline: rows[0],
      row: rows.filter(function (item) { return item.kind === values['pfe-kind']; })[0] };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintDesigns(view);
    paintMatrix(view);
    paintConfidence(view);
    paintLimits();
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const row = view.row;
    const base = view.baseline;

    root.MetricGrid.update({
      'pfe-coverage': { value: (100 * row.coverage).toFixed(0) + '%',
        note: row.covered + ' of the baseline\'s ' + base.demandMisses + ' misses removed' },
      'pfe-accuracy': { value: (100 * row.accuracy).toFixed(0) + '%',
        note: row.usedPrefetches + ' of ' + row.prefetched + ' prefetches were used' },
      'pfe-issued': { value: row.prefetched, note: 'lines fetched before anybody asked' },
      'pfe-misses': { value: row.demandMisses,
        note: 'against ' + base.demandMisses + ' with no prefetcher at all' },
      'pfe-traffic': { value: row.traffic,
        note: 'against ' + base.traffic + ' - the number a coverage figure hides' },
      'pfe-verdict': { value: row.traffic - base.traffic > row.covered ? 'a net loss'
        : (row.covered > 0 ? 'worth it' : 'no effect'),
        note: Prefetchers.verdict(row, base) }
    });
  }

  function paintDesigns(view) {
    Table.paint('pfe-designs', view.rows.map(function (row) {
      return [row.name, row.demandMisses, row.prefetched,
        (100 * row.accuracy).toFixed(0) + '%', (100 * row.coverage).toFixed(0) + '%',
        row.kind === 'none' ? 'the baseline' : Prefetchers.verdict(row, view.baseline)];
    }), 'Read the coverage and the accuracy columns together and the verdict follows. A row '
      + 'with high coverage and low accuracy has bought its misses with bandwidth, and on a '
      + 'machine where bandwidth is the constraint - which is most of them - that is a trade '
      + 'in the wrong direction.');
  }

  function paintMatrix(view) {
    const best = { sequential: 'next line: free, and exactly right',
      strided: 'stride: it is the only one that finds the delta',
      random: 'none of them; the stride prefetcher is right to refuse',
      chase: 'none of them, and no design can help - change the structure' };

    Table.paint('pfe-matrix', PATTERNS.map(function (pattern) {
      const rows = Lab.prefetch(pattern, { prefetcher: view.settings });
      const base = rows[0];

      return [Lab.label(pattern).split(' — ')[0]].concat(KINDS.map(function (kind) {
        const row = rows.filter(function (item) { return item.kind === kind; })[0];

        return (100 * row.coverage).toFixed(0) + '% cov, '
          + (100 * row.accuracy).toFixed(0) + '% acc, '
          + (row.traffic > base.traffic ? '+' : '') + (row.traffic - base.traffic)
          + ' traffic';
      })).concat([best[pattern]]);
    }), 'Four patterns, three designs, and no design wins everywhere. Next-line is perfect on '
      + 'a sequential walk and useless on a stride; stride is the reverse; stream buys coverage '
      + 'on both and pays for it in traffic. A real machine runs several of these at once and '
      + 'arbitrates between them, which is a more complicated version of exactly this table.');
  }

  function paintConfidence(view) {
    Table.paint('pfe-confidence-table', [1, 2, 3].map(function (confidence) {
      const settings = Object.assign({}, view.settings, { confidence: confidence });
      const random = Lab.prefetch('random', { prefetcher: settings })
        .filter(function (row) { return row.kind === 'stride'; })[0];
      const strided = Lab.prefetch('strided', { prefetcher: settings })
        .filter(function (row) { return row.kind === 'stride'; })[0];

      return [confidence, random.prefetched, (100 * random.accuracy).toFixed(0) + '%',
        strided.prefetched, (100 * strided.coverage).toFixed(0) + '%'];
    }), 'The counter is what turns a delta into evidence. At every threshold the stride '
      + 'prefetcher issues nothing at all on the random pattern - and it is the mechanism '
      + 'rather than a special case, because a delta that never repeats never reaches any '
      + 'threshold. The last two columns are what that caution costs on the pattern it is '
      + 'supposed to catch, which is a handful of prefetches at the start of each run.');
  }

  function paintLimits() {
    Table.paint('pfe-limits', LIMITS.map(function (row) {
      return [row.name, row.why, row.helps];
    }), 'Three of the five rows are answered by changing the program rather than the '
      + 'prefetcher, and that is the honest summary of the technique: it is very good at '
      + 'patterns that were already regular and it cannot manufacture regularity. The first '
      + 'row is the one that matters most, because a pointer chase is what an idiomatic linked '
      + 'structure produces by default.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#pfe-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, { lazyLib: app.lazyLib, height: 260,
      yLabel: 'lines',
      values: PATTERNS.reduce(function (out, pattern) {
        const rows = Lab.prefetch(pattern, { prefetcher: view.settings });
        const row = rows.filter(function (item) { return item.kind === view.kind; })[0];
        const base = rows[0];
        const short = pattern.slice(0, 6);

        out.push({ label: short + ' misses left', value: row.demandMisses, series: 0 });
        out.push({ label: short + ' removed', value: row.covered, series: 1 });
        out.push({ label: short + ' wasted', value: row.prefetched - row.usedPrefetches,
          series: 2 });
        return out;
      }, []) });
    root.Helpers.setText('pfe-chart-note', 'Three bars per pattern for the selected '
      + 'prefetcher: the misses still being paid, the misses it removed, and the prefetches '
      + 'nobody used. A group where the middle bar is tall and the right one short is a '
      + 'prefetcher doing its job; one where the right bar dominates is a prefetcher spending '
      + 'bandwidth to buy a coverage figure. Switch the design and watch which groups change '
      + 'shape.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
