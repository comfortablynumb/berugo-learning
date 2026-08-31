/**
 * Section: DRAM and the memory controller.
 *
 * The data-sheet latency is a row hit. Everything else is the row buffer being
 * in the wrong state, and on a stream of unrelated requests it usually is: a
 * conflict costs precharge plus activate plus column access, which is three
 * times a hit.
 *
 * Two controls change that and they do it in different ways. Interleaving
 * decides which bank an address lands in, so it decides whether consecutive
 * accesses can overlap at all. Scheduling decides which of the queued requests
 * goes next, so it decides how many of them find a row already open. On the
 * interleaved-streams fixture, reordering alone takes the row-hit rate from 0%
 * to 48% and doubles the throughput - and the timeline shows exactly which
 * requests jumped the queue to do it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'dram-and-the-memory-controller';
  const Table = root.DataTable;
  const Dram = root.Memory.Dram;
  const View = root.DramTimelineView;
  const Microbench = root.CacheMicrobench;
  const BANKS = [1, 2, 4, 8, 16];
  const cache = {};
  let panel = null;

  const OUTCOMES = [
    { name: 'row hit', what: 'the row is already open: read the column',
      cycles: 'tCAS = 15' },
    { name: 'row miss', what: 'no row is open: activate it, then read the column',
      cycles: 'tRCD + tCAS = 30' },
    { name: 'row conflict', what: 'a different row is open: close it, activate, then read',
      cycles: 'tRP + tRCD + tCAS = 45' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /* --------------------------------------------------------- the streams */

  function streamFor(name, settings) {
    const line = 64;

    if (name === 'sequential') return Microbench.stream({ bytes: 65536, passes: 1 }).trace;
    if (name === 'random') {
      return Microbench.randomAccess({ bytes: 4194304, count: 512, seed: 9 }).trace;
    }
    if (name === 'bankConflict') {
      const span = settings.banks * settings.rowLines * line;

      return Microbench.strided({ step: span, count: 256, passes: 1 }).trace;
    }
    const out = [];

    for (let at = 0; at < 512; at += 1) {
      out.push({ address: at * line });
      out.push({ address: (1 << 20) + at * line });
    }
    return out;
  }

  function measure(name, settings) {
    const key = name + ' ' + JSON.stringify(settings);

    if (cache[key]) return cache[key];
    const built = Dram.create(settings);
    const full = Object.assign({ rowLines: built.settings.rowLines }, settings);

    Dram.replay(built, streamFor(name, full));
    cache[key] = { dram: built, summary: Dram.summary(built) };
    return cache[key];
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — one bank, one row buffer, three outcomes',
      caption: 'A bank holds exactly one row open at a time in its sense amplifiers, and every '
        + 'access is one of three things depending on what is in there. The data-sheet latency '
        + 'is the first branch; the number a loaded machine actually sees is dominated by the '
        + 'third. That is why the loaded-latency curve matters and the idle figure does not.',
      definition: [
        'flowchart TD',
        '    R["a request for row r in this bank"] --> Q{"what is open?"}',
        '    Q -->|"row r"| H["ROW HIT: read the column - 15 cycles"]',
        '    Q -->|"nothing"| M["ROW MISS: activate r, then read - 30 cycles"]',
        '    Q -->|"some other row"| C["ROW CONFLICT: precharge, activate r, read - 45 cycles"]',
        '    H --> D["data on the shared bus"]',
        '    M --> D',
        '    C --> D',
        '    D --> N["the row stays open for whoever is next"]'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**A bank keeps one row open, and which row decides the cost.** A hit on the open row is '
        + 'a column access. A miss with nothing open is an activate and then a column access. A '
        + 'conflict — a different row open — is a precharge, an activate and a column access, '
        + 'three times the price of a hit. The published latency is the first of those.',
      '**Interleaving decides which bank an address lands in, and it is the whole of '
        + 'bank-level parallelism.** Bank-first puts consecutive lines in different banks, so a '
        + 'sequential walk spreads across them and their activations overlap. Row-first fills a '
        + 'whole row before moving on, so the same walk hammers one bank at a time. Same '
        + 'addresses, same requests, different throughput.',
      '**Reordering is worth more than either on a mixed stream.** Two interleaved sequential '
        + 'streams give a 0% row-hit rate under first-come-first-served, because consecutive '
        + 'requests alternate between two rows in each bank. Let the controller prefer a '
        + 'request that hits the open row and the hit rate goes to 48% and the throughput '
        + 'doubles — without a single hardware change.',
      '**A policy needs something to reorder, which is why the queue depth is a control.** At '
        + 'a depth of one, first-ready-first-come is first-come, because there is never a '
        + 'choice. The deeper the queue the more row hits the controller can find and the '
        + 'further out of order a request can be served, which is the trade the last table '
        + 'measures.',
      '**A stride that maps to one bank cannot be rescued by anything.** The bank-conflict '
        + 'stream sends every request to the same bank at a different row: 99.6% conflicts, a '
        + 'third of the throughput, and neither the policy nor the interleaving control moves '
        + 'it. That is the DRAM version of the cache conflict in 37.2 and it has the same fix — '
        + 'change the stride.'
    ];
  }

  function closing() {
    return [
      '**Refresh is the overhead nobody chose.** Every row has to be read and rewritten every '
        + 'few dozen milliseconds or it forgets, and during a refresh the bank is unavailable. '
        + 'It costs a few per cent of the bandwidth and it is not modelled here, because it '
        + 'would move every number by the same small amount and obscure the ones that differ.',
      '**Latency under load is queueing, and the timeline is where that becomes obvious.** '
        + 'The service figure includes the wait, so it rises with the queue depth even while '
        + 'the throughput improves. Reporting an idle latency for a loaded system is the same '
        + 'error as reporting a bandwidth figure as a latency in 37.1.',
      '**Fairness is the cost of the throughput.** FR-FCFS passes over an older request '
        + 'whenever a younger one hits the open row, so a request in an unlucky bank can wait '
        + 'far longer than its arrival order suggests. The demo reports the worst wait beside '
        + 'the average for exactly that reason — a policy that is fast on average and unbounded '
        + 'in the tail is not one anybody can ship.',
      '**Channels and ranks are the levels above banks, and they multiply the same effect.** '
        + 'More channels means more independent buses rather than more banks on one, so the '
        + 'shared-bus constraint in this model is what a second channel relieves. The '
        + 'arithmetic is the same and the picture is the same shape.'
    ];
  }

  function insight() {
    return '**The number on the memory module is a row hit, and almost nothing you run is a '
      + 'row hit.** DRAM is sold on a latency figure that describes the best case of the three '
      + 'on this page, and a real request stream — several cores, a prefetcher, a couple of '
      + 'streams and some pointer chasing — arrives at the controller as a sequence of requests '
      + 'to unrelated rows in a handful of banks. What the machine experiences is dominated by '
      + 'conflicts and by queueing, which is why the useful characterisation of a memory system '
      + 'is a loaded-latency curve — latency plotted against delivered bandwidth — and not a '
      + 'single number. That curve has a knee, the knee is where queueing starts to dominate, '
      + 'and a system running past it has latencies that bear no relation to the data sheet at '
      + 'all. The general lesson outlives DRAM: any shared resource with a scheduler in front '
      + 'of it has this shape, and quoting its unloaded service time tells you almost nothing '
      + 'about how it behaves when it is busy. A disk, a network link, a connection pool and a '
      + 'thread pool all have a loaded-latency curve, and in every case the question worth '
      + 'asking is not "how fast is it" but "how far up the curve are we, and what happens to '
      + 'the tail there".';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — banks, rows and the order they are served in',
        markup: root.DramTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.DramTemplate.controls,
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const settings = { policy: values['dram-policy'],
      interleave: values['dram-interleave'], banks: Number(values['dram-banks']),
      queue: Number(values['dram-queue']) };

    return { workload: values['dram-workload'], settings: settings,
      run: measure(values['dram-workload'], settings) };
  }

  function update() {
    const view = reading();

    paintMetrics(view);
    paintOutcomes();
    paintTimeline(view);
    paintMatrix(view);
    paintBanks(view);
    paintReorder(view);
  }

  function paintMetrics(view) {
    const found = view.run.summary;

    root.MetricGrid.update({
      'dram-hit': { value: (100 * found.rowHitRate).toFixed(1) + '%',
        note: found.rowHits + ' of ' + found.served + ' requests' },
      'dram-conflict': { value: found.rowConflicts,
        note: (100 * found.rowConflicts / Math.max(1, found.served)).toFixed(1)
          + '% of requests, at three times the cost of a hit' },
      'dram-average': { value: found.average.toFixed(1),
        note: 'from arrival to data, so it includes the queueing' },
      'dram-elapsed': { value: found.elapsed, note: 'wall cycles for the whole stream' },
      'dram-throughput': { value: found.throughput.toFixed(1),
        note: 'lines per thousand cycles of wall time' },
      'dram-worst': { value: found.worstWait,
        note: 'the request this policy left waiting longest' }
    });
  }

  function paintOutcomes() {
    Table.paint('dram-outcomes', OUTCOMES.map(function (row) {
      return [row.name, row.what, row.cycles,
        row.name === 'row hit' ? 'the baseline, and the data-sheet number'
          : (row.name === 'row miss' ? '2x' : '3x')];
    }), 'Three outcomes and a factor of three between the ends. The published latency of a '
      + 'memory part is the first row; what a loaded machine experiences is mostly the third, '
      + 'plus however long the request sat in the controller\'s queue before anybody looked at '
      + 'it. Everything else on this page is about moving requests from the third row to the '
      + 'first.');
  }

  function paintTimeline(view) {
    root.jQuery('#dram-timeline').html(View.markup(view.run.dram, { columns: 48, limit: 240 }));
    root.jQuery('#dram-legend').html(View.legend());
    root.Helpers.setText('dram-timeline-note', timelineNote(view));
  }

  function timelineNote(view) {
    const banks = View.banks(view.run.dram).filter(function (row) {
      return row.requests > 0;
    }).length;

    return 'Banks down, time across, one cell per request, coloured by outcome and labelled '
      + 'with its arrival number. Two things read straight off it. Vertically: '
      + banks + ' of ' + view.settings.banks + ' banks have work, and several busy at once is '
      + 'bank-level parallelism - one busy row and the rest empty is a stream that has '
      + 'serialised itself. Horizontally: under first-come-first-served the numbers run in '
      + 'order along each row, and under FR-FCFS they do not, and the ones that jumped are '
      + 'exactly the ones that found a row already open.';
  }

  function paintMatrix(view) {
    const streams = ['sequential', 'twoStreams', 'bankConflict', 'random'];
    const rows = [];

    streams.forEach(function (stream) {
      ['bankFirst', 'rowFirst'].forEach(function (interleave) {
        const base = Object.assign({}, view.settings, { interleave: interleave });
        const fcfs = measure(stream, Object.assign({}, base, { policy: 'fcfs' })).summary;
        const frfcfs = measure(stream, Object.assign({}, base, { policy: 'frfcfs' })).summary;

        rows.push([stream, interleave,
          (100 * fcfs.rowHitRate).toFixed(1) + '%',
          (100 * frfcfs.rowHitRate).toFixed(1) + '%',
          fcfs.throughput.toFixed(1), frfcfs.throughput.toFixed(1)]);
      });
    });
    Table.paint('dram-matrix', rows, 'The two-streams rows are the ones to read. Under '
      + 'first-come-first-served the row-hit rate is zero, because consecutive requests '
      + 'alternate between two rows in each bank and every one of them is a conflict; letting '
      + 'the controller serve the queued request that hits the open row first takes it to 48% '
      + 'and doubles the throughput. The bank-conflict rows are the opposite: every request is '
      + 'to the same bank, and nothing in this table can help.');
  }

  function paintBanks(view) {
    const base = measure(view.workload, Object.assign({}, view.settings, { banks: 1 }))
      .summary;

    Table.paint('dram-banks-table', BANKS.map(function (banks) {
      const found = measure(view.workload, Object.assign({}, view.settings, { banks: banks }))
        .summary;

      return [banks, (100 * found.rowHitRate).toFixed(1) + '%', found.elapsed,
        found.throughput.toFixed(1),
        (found.throughput / Math.max(base.throughput, 1e-9)).toFixed(2) + 'x'];
    }), 'More banks means more rows open at once and more activations overlapping, so the '
      + 'activate and precharge time hides behind another bank\'s transfer. What does not hide '
      + 'is the data bus, which is shared - so the gain flattens once the banks are keeping the '
      + 'bus busy, and after that a second channel rather than a ninth bank is the thing that '
      + 'helps.');
  }

  function paintReorder(view) {
    Table.paint('dram-reorder', ['fcfs', 'frfcfs'].map(function (policy) {
      const run = measure(view.workload, Object.assign({}, view.settings, { policy: policy }));
      const found = View.reordering(run.dram);

      return [policy === 'fcfs' ? 'FCFS' : 'FR-FCFS', found.moved, found.worst,
        run.summary.worstWait,
        policy === 'fcfs' ? 'nothing is reordered at all'
          : 'the queue depth: a request can only be passed over by requests already queued'];
    }), 'The reordering is bounded by the queue depth, which is what stops FR-FCFS starving '
      + 'anybody indefinitely: a request can only be overtaken by requests that were already '
      + 'in the queue when it arrived. Raise the depth control and both the throughput and the '
      + 'worst wait rise together - the two are the same trade seen from either end, and a '
      + 'real controller adds an age threshold on top to bound it further.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
