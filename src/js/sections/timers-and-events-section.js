/**
 * Section: Priority queues in systems — timers, schedulers and event simulation.
 *
 * Two demos, one point. The timer benchmark shows why kernels file timeouts in
 * a wheel rather than a heap: a bucket index is arithmetic, so the wheel does
 * no comparisons at all where the heap does millions. The M/M/1 simulation is
 * the other use of a priority queue — as a clock — and it checks itself
 * against the closed form and against Little's law from M02.5.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'timers-and-events';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /** The shell config: orientation, demo, diagram and the insight. */
  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A priority queue is load-bearing in three places in a real system: the timer subsystem, the ' +
          'run queue of a scheduler, and the clock of any discrete-event simulation. Only one of ' +
          'those three actually uses a heap.',
        'Timers do not, and the reason is that a heap answers a harder question than a timeout needs. ' +
          'A timing wheel quantises time into ticks and files each timer in the bucket for the tick ' +
          'it is due, so adding is an array index, cancelling is a flag, and expiry is "walk one ' +
          'bucket". No comparisons at all. What it gives up is precision below one tick, which is ' +
          'exactly what a timeout can afford.',
        'A discrete-event simulation is the case where the heap is right, because there is nothing to ' +
          'quantise: the clock jumps to the timestamp of the next event, whatever it is. The M/M/1 ' +
          'simulation below is driven by one, and it reproduces the closed-form queue length and ' +
          'waiting time — and Little\'s law from M02.5 — to within a percent.'
      ],
      demo: { title: 'Interactive demo — timers, and a queue simulated', markup: root.TimersAndEventsTemplate.render() },
      diagram: {
        title: 'Diagram — a hierarchical timing wheel',
        caption: 'The outer wheels cascade into the inner one as it wraps. Linux uses five levels.',
        definition: [
          'flowchart TB',
          '    T["tick"] --> W0["wheel 0: 256 slots<br/>ticks 0…255"]',
          '    W0 -->|"wraps every 256 ticks"| W1["wheel 1: 256 slots<br/>ticks 256…65 535"]',
          '    W1 -->|"wraps every 65 536"| W2["wheel 2<br/>and so on"]',
          '    W1 -.->|"cascade: refile into<br/>wheel 0"| W0',
          '    W2 -.->|"cascade"| W1'
        ].join('\n')
      },
      insight: 'O(1) add and cancel with O(1) amortised expiry is why timing wheels beat heaps for ' +
        'timers; the trade is bounded precision, which is exactly what a timeout can afford. The ' +
        'deeper point is that "which data structure" is the wrong question until you have asked what ' +
        'precision the caller actually needs — a heap answers a harder question than a timeout asks, ' +
        'and charges for it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TimersAndEventsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function timerRuns(values) {
    const structures = [
      {
        label: 'wheel, 1 × 4096 slots',
        make: function () { return root.TimerWheel.create({ slots: 4096, levels: 1 }); },
        add: 'O(1) / O(1)'
      },
      {
        label: 'wheel, 2 × 64 slots',
        make: function () { return root.TimerWheel.create({ slots: 64, levels: 2 }); },
        add: 'O(1) / O(1)'
      },
      {
        label: 'binary heap',
        make: function () { return root.TimerWheel.heapBacked(function () { return root.BinaryHeap.create({}); }); },
        add: 'O(log n) / O(1) lazy'
      }
    ];

    return structures.map(function (structure) {
      const timer = structure.make();
      const rng = root.Random.seeded(values['te-seed']);
      const cancelRng = root.Random.seeded(values['te-seed'] + 500);

      timer.resetStats();
      for (let i = 0; i < values['te-timers']; i += 1) timer.add(1 + rng.int(values['te-horizon']), 'x' + i);

      const toCancel = Math.floor(values['te-timers'] * (values['te-cancel'] / 100));
      for (let i = 0; i < toCancel; i += 1) timer.cancel('x' + cancelRng.int(values['te-timers']));

      let fired = 0;
      for (let t = 0; t < values['te-horizon']; t += 1) fired += timer.tick().length;

      return Object.assign({}, structure, { fired: fired, stats: timer.stats() });
    });
  }

  function update(app) {
    const values = panel.values();
    const rows = timerRuns(values);
    const wheel = rows[1];
    const heap = rows[2];

    const sim = root.EventSim.mm1({
      rng: root.Random.seeded(values['te-seed'] + 7),
      lambda: values['te-rho'],
      mu: 1,
      horizon: 200000,
      queue: root.BinaryHeap.create({})
    });
    const little = sim.meanInSystem / (sim.arrivalRate * sim.meanTimeInSystem);

    root.MetricGrid.update({
      'te-wheel-cost': { value: '0', note: 'a bucket index is arithmetic; nothing is compared' },
      'te-heap-cost': {
        value: root.Format.count(heap.stats.comparisons || 0),
        note: 'for the identical timer workload'
      },
      'te-touches': {
        value: root.Format.fixed(wheel.stats.entryTouches / values['te-horizon'], 2) + ' / ' +
          root.Format.fixed(heap.stats.entryTouches / values['te-horizon'], 2),
        note: 'entries examined per tick'
      },
      'te-little': {
        value: root.Format.fixed(little, 4),
        note: 'L ÷ (λ·W) — the law says exactly 1, whatever the distributions'
      }
    });

    paintTimers(rows, values);
    paintMm1(sim, values);
    paintTradeoff();
    void app;
  }

  function paintTimers(rows, values) {
    const markup = rows.map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.comparisons || 0) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.entryTouches) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.stats.entryTouches / values['te-horizon'], 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.cascadedEntries || 0) + '</td>' +
        '<td class="mono">' + row.add + '</td></tr>';
    }).join('');

    root.jQuery('#te-timers-table tbody').html(markup);
    root.jQuery('#te-timers-note').text('All three fire the same ' + root.Format.exact(rows[0].fired) +
      ' timers in the same ticks. The heap does its work in comparisons; the wheels do theirs in ' +
      'array indexing, and the hierarchical one trades a cascade for a shorter bucket walk. The ' +
      'cancelled share matters: a wheel drops a cancelled timer for free the next time its bucket is ' +
      'walked, while a heap carries it until it surfaces.');
  }

  function paintMm1(sim, values) {
    const rows = [
      {
        what: 'L — mean number in system', simulated: sim.meanInSystem,
        closed: sim.predictedInSystem
      },
      {
        what: 'W — mean time in system', simulated: sim.meanTimeInSystem,
        closed: sim.predictedTimeInSystem
      },
      {
        what: 'λ — arrival rate', simulated: sim.arrivalRate,
        closed: values['te-rho']
      }
    ].map(function (row) {
      const error = row.closed ? Math.abs(row.simulated - row.closed) / row.closed : 0;
      return '<tr><td class="mono">' + row.what + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.simulated, 3) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.closed, 3) + '</td>' +
        '<td class="mono">' + root.Format.percent(error, 1) + '</td></tr>';
    }).join('');

    root.jQuery('#te-mm1 tbody').html(rows);
    root.jQuery('#te-mm1-note').text(root.Format.exact(sim.served) + ' customers served over ' +
      root.Format.exact(sim.events) + ' events at ρ = ' + values['te-rho'] + '. The closed forms are ' +
      'ρ/(1 − ρ) and 1/(μ − λ) — the same 1/(1 − ρ) wall M02.5 measured from the other direction.');
  }

  function paintTradeoff() {
    const rows = [
      {
        name: 'binary heap', add: 'O(log n)', cancel: 'O(log n), or lazy', expiry: 'O(log n) per timer',
        precision: 'exact', where: 'event simulation, where time cannot be quantised'
      },
      {
        name: 'simple wheel', add: 'O(1)', cancel: 'O(1)', expiry: 'O(1) amortised',
        precision: 'one tick', where: 'a fixed, short timeout range'
      },
      {
        name: 'hierarchical wheel', add: 'O(1)', cancel: 'O(1)', expiry: 'O(1) amortised + cascades',
        precision: 'one tick', where: 'Linux kernel timers, five levels of 64 or 256 slots'
      },
      {
        name: 'sorted list', add: 'O(n)', cancel: 'O(1)', expiry: 'O(1)',
        precision: 'exact', where: 'when there are only a handful of timers'
      }
    ].map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td>' +
        '<td class="mono">' + row.add + '</td>' +
        '<td class="mono">' + row.cancel + '</td>' +
        '<td class="mono">' + row.expiry + '</td>' +
        '<td class="mono">' + row.precision + '</td>' +
        '<td class="note">' + row.where + '</td></tr>';
    }).join('');

    root.jQuery('#te-tradeoff tbody').html(rows);
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
