/**
 * Section: Simultaneous multithreading.
 *
 * Two real out-of-order cores are run in lockstep here, sharing the structures
 * a real SMT design shares: one array of execution ports, one cache, and one
 * budget for the reorder buffer and issue queue. The front end serves one
 * thread per cycle and which one is the fetch policy.
 *
 * Everything is measured over a fixed window of cycles rather than to
 * completion, because starvation is invisible in a completion time - a starved
 * thread still finishes eventually, once the thread starving it has stopped.
 * Over 200 cycles with strict priority and no guard, thread 1 retires zero
 * instructions, and that is the number the acceptance test asserts on.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'simultaneous-multithreading';
  const Lab = root.OooLab;
  const Table = root.DataTable;
  const Smt = root.Ooo.Smt;
  const Core = root.OooCore;
  const SMALL = { sets: 8, ways: 1, lineBytes: 32 };
  const PAIRS = [['chase', 'chase'], ['chain', 'chain'], ['chain', 'independent'],
    ['independent', 'independent'], ['chase', 'chain'], ['stride', 'chain'],
    ['factorial', 'chain']];
  const cache = {};
  let panel = null;
  let chart = null;

  const STRUCTURES = [
    { name: 'execution ports', here: 'one array, held by both schedulers',
      real: 'shared — the units are the expensive part',
      why: 'a cycle in which one thread takes the memory port is one the other cannot' },
    { name: 'the L1 cache', here: 'one cache object, both threads index it',
      real: 'shared, and this is where most of SMT\'s gain comes from',
      why: 'two threads on the same data warm it for each other — and can read each other (36.8)' },
    { name: 'reorder buffer and issue queue', here: 'one budget, split or first-come',
      real: 'usually partitioned, precisely because of the failure below',
      why: 'a stalled thread holding the whole window stops the other dispatching at all' },
    { name: 'the front end', here: 'one thread fetches per cycle, chosen by the policy',
      real: 'the same, and the policy is a published design decision',
      why: 'it is the resource a starved thread is actually being denied' },
    { name: 'architectural registers and PC', here: 'one full core each',
      real: 'duplicated — this is what makes it a thread rather than a process',
      why: 'the duplication is small, which is why SMT is cheap to add' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  /* -------------------------------------------------------- the machinery */

  function key(spec) {
    return JSON.stringify(spec);
  }

  /** One SMT run, cached: the section sweeps policies and pairs, so the same
   *  configuration is asked for many times per repaint. */
  function runPair(spec) {
    const found = key(spec);

    if (cache[found]) return cache[found];
    const machine = Smt.create({ width: 4, cache: SMALL, policy: spec.policy,
      partition: spec.partition, guard: spec.guard,
      threads: [{ name: spec.left, source: Lab.get(spec.left).source },
        { name: spec.right, source: Lab.get(spec.right).source }] });

    Smt.run(machine, { cycles: spec.cycles });
    cache[found] = Smt.summary(machine);
    return cache[found];
  }

  /** The same program on the core alone, with the same small cache, which is
   *  the only fair baseline for a slowdown figure. */
  function alone(name) {
    return Lab.summary(name, Object.assign({ width: 4 }, SMALL));
  }

  function against(spec) {
    const shared = runPair(Object.assign({}, spec, { cycles: 60000 }));
    const solo = [alone(spec.left), alone(spec.right)];
    const sequential = solo[0].cycles + solo[1].cycles;

    return { shared: shared, solo: solo, sequential: sequential,
      speedup: shared.cycles ? sequential / shared.cycles : 0,
      slowdowns: shared.threads.map(function (thread, at) {
        return (thread.finishedAt || shared.cycles) / Math.max(1, solo[at].cycles);
      }) };
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — what two threads share and what they do not',
      caption: 'The duplicated part is small: a program counter, an architectural register '
        + 'mapping, and the bookkeeping to keep two commit streams apart. Everything '
        + 'expensive is shared. That ratio is why SMT is cheap to add — a few per cent of '
        + 'core area for a throughput gain that can approach 1.6x — and it is also exactly '
        + 'why it is a security problem, because sharing a structure means observing it.',
      definition: [
        'flowchart TD',
        '    T0["thread 0: PC, architectural map"] --> FE{"fetch arbiter<br/>one thread per cycle"}',
        '    T1["thread 1: PC, architectural map"] --> FE',
        '    FE --> RN["rename: one physical file per thread here"]',
        '    RN --> WIN["reorder buffer + issue queue<br/>ONE budget: shared or partitioned"]',
        '    WIN --> PORTS["execution ports: one set, shared"]',
        '    PORTS --> L1["L1 cache: one, shared"]',
        '    L1 --> MEM["memory"]',
        '    WIN --> C0["commit, thread 0"]',
        '    WIN --> C1["commit, thread 1"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**SMT exists because one thread cannot keep a wide core busy, and 36.1 said why.** A '
        + 'dependence chain leaves most issue slots empty in most cycles and no amount of '
        + 'width fills them. A second thread\'s instructions are independent of the first\'s '
        + 'by construction, so they fit in exactly the holes the first one leaves.',
      '**The gain is real and it is a throughput gain only.** Two copies of `chain` run '
        + 'together in 48 cycles against 76 sequentially — 1.58x — while each thread '
        + 'individually is 1.03x and 1.26x slower than it was alone. Throughput up, '
        + 'single-thread latency down. That is the trade in one line and it never changes.',
      '**On a core that was already busy, SMT buys nothing and costs plenty.** Two copies of '
        + '`independent` take 42 cycles together and 42 sequentially — a speed-up of exactly '
        + '1.00 — while each thread runs 1.62x and 2.00x slower than alone. The two integer '
        + 'ports were already saturated by one thread, so the second one is queueing rather '
        + 'than filling holes.',
      '**That is the whole of the "should we turn SMT off" argument, and it is not '
        + 'folklore.** A latency-critical service cares about the slowdown column; a batch '
        + 'analytics job cares about the throughput column. Databases and low-latency trading '
        + 'systems routinely disable it, and they are right for their workload for exactly the '
        + 'reason the `independent + independent` row shows.',
      '**The sharing that helps most is the cache, and it can make a thread FASTER.** Two '
        + 'copies of `chase` over the same data take 385 cycles together against 1356 '
        + 'sequentially — a 3.52x speed-up, with each thread finishing in roughly half the '
        + 'time it took alone. One thread\'s misses fill the cache for the other. That is not '
        + 'a modelling artefact; it is why SMT and thread-per-request servers on shared data '
        + 'get on so well.',
      '**Fetch bandwidth is the resource a thread actually gets starved of.** One thread is '
        + 'served per cycle. Under strict priority thread 0 always wins, and over a 200-cycle '
        + 'window thread 1 retires exactly zero instructions — not slowly, not eventually, '
        + 'zero. The starvation guard is one counter: a thread that has gone N cycles without '
        + 'a slot takes the next one whatever the policy says.',
      '**ICOUNT is the policy that shipped, and its reasoning is worth borrowing.** Serve the '
        + 'thread with the fewest instructions already in flight, because a thread with many '
        + 'is either making progress or stuck, and either way it does not need more. That is a '
        + 'scheduling heuristic with no notion of priority or fairness in it, and it produces '
        + 'both.',
      '**Partitioning the window protects against a different failure from the guard, and '
        + 'you need both.** With a loose guard, thread 0 holds the whole shared buffer while '
        + 'it waits on cache misses, so thread 1 gets its fetch slot and still cannot dispatch '
        + 'a single instruction: 20 retired instead of 33. Give each thread a fixed half and '
        + 'it recovers completely, at a small cost to thread 0. Every shipping SMT design '
        + 'partitions something for this reason.',
      '**Everything shared is also something observable, which is the next section.** Two '
        + 'threads on one core share a cache, and a cache\'s state depends on what was '
        + 'accessed. The performance argument for sharing and the security argument against '
        + 'it are statements about the same fact, and no amount of software isolation changes '
        + 'it.'
    ];
  }

  function insight() {
    return '**SMT is the clearest example in this curriculum of an optimisation whose '
      + 'correct setting is a property of the workload rather than of the hardware, and of '
      + 'why a single benchmark number cannot decide it.** The measurements on this page put '
      + 'two threads on one core and get answers ranging from a 3.5x speed-up to none at all, '
      + 'with per-thread slowdowns from 0.55x (faster than alone, because the other thread '
      + 'warmed the cache) to 2.00x. Nothing about the hardware changed between those runs; '
      + 'only what the threads were doing. A throughput-oriented service — a batch job, a '
      + 'web tier where the p50 is what matters — wants it on. A latency-critical one — a '
      + 'database serving a tail-latency SLA, a trading path, a real-time audio thread — '
      + 'wants it off, and the reason is not that SMT is slow but that it makes each '
      + 'individual thread slower by design. This is the same trade as pipelining in M35.1 '
      + 'and batching in every queueing system: throughput bought by making each unit of '
      + 'work take longer. What makes SMT worth singling out is that it is a switch in the '
      + 'BIOS, so somebody has to decide, and the decision gets made on folklore far more '
      + 'often than on a measurement of the two columns that actually matter.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — sharing a core, fairly or otherwise',
        markup: root.MultithreadingTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.MultithreadingTemplate.controls(),
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const spec = { left: values['smx-thread0'], right: values['smx-thread1'],
      policy: values['smx-policy'], partition: values['smx-partition'],
      guard: Number(values['smx-guard']), cycles: Number(values['smx-cycles']) };

    return { spec: spec, found: runPair(spec) };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintThreads(view);
    paintPolicies(view);
    paintPairs();
    paintStructures();
    paintChart(app);
  }

  function paintMetrics(view) {
    const found = view.found;
    const starved = found.threads.filter(function (row) { return row.retired === 0; });
    const longest = found.threads.reduce(function (most, row) {
      return Math.max(most, row.longestStarve);
    }, 0);

    root.MetricGrid.update({
      'smx-throughput': { value: found.throughput.toFixed(3),
        note: found.retired + ' instructions over ' + found.cycles + ' cycles' },
      'smx-t0': { value: found.threads[0].retired,
        note: view.spec.left + ', ' + found.threads[0].grants + ' fetch slots won' },
      'smx-t1': { value: found.threads[1].retired,
        note: view.spec.right + ', ' + found.threads[1].grants + ' fetch slots won' },
      'smx-starve': { value: longest,
        note: 'the longest either thread went without the front end' },
      'smx-forced': { value: found.guardForced,
        note: view.spec.guard ? 'the guard overruled the policy this often'
          : 'no guard is set, so the policy is never overruled' },
      'smx-verdict': { value: starved.length ? 'NO' : 'yes',
        note: starved.length ? starved[0].name + ' retired nothing at all'
          : 'both threads retired instructions in this window' }
    });
  }

  function paintThreads(view) {
    Table.paint('smx-threads', view.found.threads.map(function (row) {
      return [row.name, { value: row.retired, className: row.retired ? '' : 'bad' },
        row.ipc.toFixed(3), row.grants, row.longestStarve, row.window];
    }), 'Measured over a fixed ' + view.spec.cycles + ' cycles rather than to completion, '
      + 'because a starved thread still finishes eventually — once the thread starving it has '
      + 'stopped. Completion time hides the failure entirely, which is why a fairness bug in '
      + 'a scheduler is so often found in production rather than in a benchmark.');
  }

  function paintPolicies(view) {
    const rows = [];

    Object.keys(Smt.POLICIES).forEach(function (policy) {
      ['shared', 'partitioned'].forEach(function (partition) {
        [0, view.spec.guard || 8].forEach(function (guard) {
          const found = runPair({ left: view.spec.left, right: view.spec.right,
            policy: policy, partition: partition, guard: guard,
            cycles: view.spec.cycles });

          rows.push([Smt.POLICIES[policy].name, partition, guard || 'none',
            found.threads[0].retired,
            { value: found.threads[1].retired,
              className: found.threads[1].retired ? '' : 'bad' },
            found.throughput.toFixed(3),
            found.starved ? 'YES' : 'no']);
        });
      });
    });
    Table.paint('smx-policies', rows, 'Two independent failures and two independent fixes. '
      + 'Strict priority with no guard starves thread 1 of fetch slots outright — it retires '
      + 'nothing. A loose guard fixes that and leaves the second failure: thread 0 holds the '
      + 'whole shared window while it waits on memory, so thread 1 gets its slot and still '
      + 'cannot dispatch. Partitioning fixes that one. Neither fix covers the other, which is '
      + 'why real designs do both.');
  }

  function paintPairs() {
    Table.paint('smx-pairs', PAIRS.map(function (pair) {
      const found = against({ left: pair[0], right: pair[1], policy: 'icount',
        partition: 'shared', guard: 0 });

      return [pair[0] + ' + ' + pair[1], found.sequential, found.shared.cycles,
        found.speedup.toFixed(2) + 'x', found.slowdowns[0].toFixed(2) + 'x',
        found.slowdowns[1].toFixed(2) + 'x'];
    }), 'Read the last three columns together, because they are the decision. `chase + '
      + 'chase` is 3.52x faster in total and each thread finishes sooner than it did alone — '
      + 'they share a cache and warm it for each other. `independent + independent` is 1.00x '
      + 'in total and each thread is up to twice as slow — the ports were already busy. Same '
      + 'hardware, opposite answers, and nothing but the workload changed.');
  }

  function paintStructures() {
    Table.paint('smx-structures', STRUCTURES.map(function (row) {
      return [row.name, row.here, row.real, row.why];
    }), 'The duplicated row is the last one and it is the cheap one: a program counter and '
      + 'an architectural register mapping. Everything expensive is shared, which is exactly '
      + 'why SMT costs a few per cent of core area, and exactly why the next section is about '
      + 'reading one thread\'s secrets from another thread\'s timing.');
  }

  function paintChart(app) {
    const host = root.jQuery('#smx-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, { lazyLib: app.lazyLib, height: 260,
      yLabel: 'ratio against running the two alone',
      values: PAIRS.reduce(function (out, pair) {
        const found = against({ left: pair[0], right: pair[1], policy: 'icount',
          partition: 'shared', guard: 0 });
        const label = Lab.shortName(pair[0]) + '+' + Lab.shortName(pair[1]);

        out.push({ label: label + ' gain', value: found.speedup, series: 0 });
        out.push({ label: label + ' cost', value: found.slowdowns[1], series: 1 });
        return out;
      }, []) });
    root.Helpers.setText('smx-chart-note', 'Two bars per pair — the throughput gain, then '
      + 'what the second thread paid for it. A pair where the first bar is tall and the second is '
      + 'near 1.0 is a workload SMT was made for; a pair where they are both near 2.0 is one '
      + 'where the second thread got exactly half a core and called it multithreading. The '
      + 'only way to know which you have is to measure both, on your own workload.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
