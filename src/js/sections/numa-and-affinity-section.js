/**
 * Section: NUMA and affinity.
 *
 * One rule and one mistake. The rule is "allocate where you will use it"; the
 * mistake is a large buffer initialised in one thread and then divided between
 * workers, which puts every page on one node and leaves every worker but one
 * remote for the whole run. A parallel-for over a freshly allocated array does
 * that by default, and the resulting slowdown reads as a scaling problem
 * rather than an allocation one.
 *
 * Migration is included because the heuristic has to pass two tests rather
 * than one: move a page that is persistently used from elsewhere, and REFUSE
 * to move one that two nodes are sharing. A rule that only passes the first
 * thrashes on the second and pays the migration cost forever.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'numa-and-affinity';
  const Table = root.DataTable;
  const Numa = root.Memory.Numa;
  const REMOTES = [90, 110, 140, 170, 200, 240];
  const cache = {};
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function measure(settings, workload) {
    const key = JSON.stringify(settings) + ' ' + JSON.stringify(workload);

    if (cache[key]) return cache[key];
    const built = Numa.create(settings);
    let summary;

    if (workload.kind === 'handoff') summary = Numa.handoff(built, workload);
    else if (workload.kind === 'alternating') summary = Numa.alternating(built, workload);
    else summary = Numa.parallelFor(built, workload);
    cache[key] = { numa: built, summary: summary };
    return cache[key];
  }

  /* ------------------------------------------------------------- the frame */

  function diagram() {
    return {
      title: 'Diagram — two nodes, and the page that ended up on the wrong one',
      caption: 'Memory is attached to a node and reaching another node\'s memory costs more. '
        + 'Under first touch a page lands on the node of the thread that writes it first, which '
        + 'is correct exactly when the first writer is also the eventual reader. The '
        + 'initialisation loop at the top of a parallel program is the case where it is not, '
        + 'and every arrow crossing the middle of this diagram is a page that could have been '
        + 'local.',
      definition: [
        'flowchart LR',
        '    subgraph n0["node 0"]',
        '        C0["cores"] --> M0["memory: 80 cycles"]',
        '    end',
        '    subgraph n1["node 1"]',
        '        C1["cores"] --> M1["memory: 80 cycles"]',
        '    end',
        '    C1 -->|"140 cycles"| M0',
        '    C0 -->|"140 cycles"| M1',
        '    I["the initialising thread runs on node 0"] --> M0',
        '    W["every worker chunk was allocated there"] --> M0'
      ].join('\n')
    };
  }

  function orientation() {
    return opening().concat(closing());
  }

  function opening() {
    return [
      '**Memory is attached to a node, and reaching another node\'s memory costs more.** On '
        + 'this model 80 cycles local and 140 remote — a factor of 1.75, which is a '
        + 'representative ratio for a two-socket machine and gets worse across four. Inside a '
        + 'single package the same effect now appears between chiplets, so this is no longer '
        + 'only a multi-socket concern.',
      '**First touch is the default policy and it is where the trouble comes from.** A page is '
        + 'placed on the node of the thread that first writes it, not the one that later reads '
        + 'it a million times. That is exactly right when the two are the same thread and '
        + 'exactly wrong for the initialisation loop at the top of a parallel program.',
      '**The classic mistake has a shape worth recognising.** Allocate a large buffer, fill it '
        + 'in one thread, then hand chunks to workers: every page is on the initialising '
        + 'thread\'s node, so locality is 50% on two nodes and the average access goes from 80 '
        + 'cycles to 110. Move the initialisation into the workers and locality is 100%. The '
        + 'only difference is which thread touched each page first.',
      '**A parallel-for over a freshly allocated array does this by default.** That is the '
        + 'reason the mistake is so common: nobody wrote the misallocation, the language wrote '
        + 'it, and the symptom is a program that does not scale rather than one that is slow.',
      '**Interleaving is the answer when you cannot arrange locality.** Round-robin placement '
        + 'gives everybody the same mediocre latency and nobody a catastrophic one, and it uses '
        + 'the aggregate bandwidth of every node rather than one. It is the right default for a '
        + 'shared structure that every thread touches and the wrong one for a partitioned '
        + 'workload that could have been local.'
    ];
  }

  function closing() {
    return [
      '**Migration has to pass two tests and the second is the hard one.** Moving a page to '
        + 'the node that keeps asking for it takes locality from 0% to 80% on a handed-off '
        + 'buffer. Refusing to move one that two nodes are alternating on is the other half: '
        + 'the demo\'s alternating pattern produces zero migrations, because the run counter '
        + 'resets whenever the accessing node changes.',
      '**A rule that only passes the first test thrashes.** Without the reset, two nodes '
        + 'sharing a page would move it back and forth on every access, paying the migration '
        + 'cost every time and never getting a local access at all. That is a worse outcome '
        + 'than never migrating, which is why "when not to act" is the harder half of an '
        + 'adaptive policy.',
      '**Affinity is the other half of the rule and it belongs to the scheduler.** Pinning a '
        + 'thread to a node is what makes "where you will use it" a stable answer; without it '
        + 'the operating system can move the thread and turn every local access into a remote '
        + 'one without touching a single page. M41 is where the scheduling side of this lives.',
      '**Diagnosing it is easier than it sounds.** A workload that scales sub-linearly with '
        + 'threads, has a good cache hit rate, and improves when run under an interleaving '
        + 'policy is a NUMA problem almost by definition — and that last experiment takes one '
        + 'command and no code change.'
    ];
  }

  function insight() {
    return '**"Allocate where you will use it" is the entire rule, and the reason it is so '
      + 'often broken is that nobody writes the allocation.** The initialisation loop at the '
      + 'top of a parallel program looks like setup rather than like a placement decision, and '
      + 'in a language with a parallel-for it is frequently not written at all — the runtime '
      + 'allocates, the main thread zeroes, and every page is on one node before any worker '
      + 'starts. What makes this worth more than a tuning tip is the shape of the symptom: the '
      + 'program is correct, the cache hit rate is fine, the profile shows time spread evenly '
      + 'across the workers, and the only visible problem is that going from one thread to '
      + 'eight gives you three. That is indistinguishable from a lock-contention problem or a '
      + 'memory-bandwidth ceiling from the outside, and the three have completely different '
      + 'fixes. The cheap discriminator is to re-run under an interleaved allocation policy: '
      + 'if a policy that makes everybody slightly worse makes the program faster, the problem '
      + 'was that some threads were much worse than others, and that is placement. The general '
      + 'habit is worth keeping wherever work is partitioned across anything with a locality '
      + 'structure — sockets, racks, availability zones, shards — because the same mistake '
      + 'appears every time: the thing that creates the data is not the thing that uses it, '
      + 'and nobody told the placement layer.';
  }

  function config() {
    return { sectionId: SECTION_ID, orientation: orientation(),
      demo: { title: 'Interactive demo — the parallel-for that allocates everything in one place',
        markup: root.NumaTemplate.render() },
      diagram: diagram(), insight: insight() };
  }

  /* ------------------------------------------------------------- plumbing */

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({ controls: root.NumaTemplate.controls,
      onChange: function () { update(app); } });
    update(app);
  }

  function reading() {
    const values = panel.values();
    const settings = { nodes: Number(values['numa-nodes']),
      policy: values['numa-policy'], remoteCycles: Number(values['numa-remote']),
      migrate: Boolean(values['numa-migrate']) };
    const workload = { workers: Number(values['numa-nodes']), pages: 64, passes: 4,
      initialiser: values['numa-initialiser'] === 'one' ? 0 : null };

    return { settings: settings, workload: workload,
      run: measure(settings, workload) };
  }

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintMatrix(view);
    paintMistake(view);
    paintPolicies(view);
    paintMigration(view);
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const found = view.run.summary;
    const steady = found.steady || found;
    const spread = Object.keys(found.spread).map(function (node) {
      return node + ': ' + found.spread[node];
    }).join(', ');

    root.MetricGrid.update({
      'numa-locality': { value: (100 * steady.locality).toFixed(1) + '%',
        note: steady.local + ' of ' + steady.accesses + ' accesses were local' },
      'numa-average': { value: steady.average.toFixed(1),
        note: 'local is ' + found.localCycles + ', remote is ' + found.remoteCycles },
      'numa-penalty': { value: (steady.average / found.localCycles).toFixed(2) + 'x',
        note: steady.locality === 1 ? 'nothing: every access is local'
          : 'what the placement is costing, per access' },
      'numa-spread': { value: spread, note: 'where first touch put the pages' },
      'numa-migrations': { value: found.migrations,
        note: view.settings.migrate ? 'moved to the node that kept asking'
          : 'migration is off' },
      'numa-verdict': { value: steady.locality === 1 ? 'followed' : 'broken',
        note: steady.locality === 1 ? 'the workers touched their own chunks first'
          : 'one thread touched everything, so one node owns everything' }
    });
  }

  function paintMatrix(view) {
    const rows = Numa.matrix(view.run.numa);

    Table.paint('numa-matrix', rows.map(function (row) {
      const cells = row.costs.map(function (cost) { return cost + ' cycles'; });

      while (cells.length < 4) cells.push('—');
      return [row.node].concat(cells);
    }), 'The diagonal is local and everything else is not, which is the whole of the topology '
      + 'as far as a program is concerned. On a real machine this is what `numactl --hardware` '
      + 'prints, and it is the first thing to look at before deciding whether a scaling problem '
      + 'is about placement: a machine whose off-diagonal entries are close to its diagonal has '
      + 'no NUMA problem to find.');
  }

  function paintMistake(view) {
    Table.paint('numa-mistake', [
      ['one thread initialises all of it', 0],
      ['each worker touches its own chunk', null]
    ].map(function (row) {
      const found = measure(view.settings,
        Object.assign({}, view.workload, { initialiser: row[1] })).summary;
      const steady = found.steady;
      const spread = Object.keys(found.spread).map(function (node) {
        return node + ':' + found.spread[node];
      }).join(' ');

      return [row[0], (100 * steady.locality).toFixed(1) + '%', steady.average.toFixed(1),
        (steady.average / found.localCycles).toFixed(2) + 'x', spread];
    }), 'The same loop, the same pages, the same number of accesses. The only difference is '
      + 'which thread wrote each page first, and it decides where every one of them lives for '
      + 'the rest of the run. The initialisation pass is excluded from these figures on '
      + 'purpose: it is local by construction under first touch whoever does it, and counting '
      + 'it flatters the bad row.');
  }

  function paintPolicies(view) {
    const uses = { firstTouch: 'a partitioned workload where each thread owns its data - and '
      + 'a trap for anything else',
      interleave: 'a shared structure every thread touches, where aggregate bandwidth beats '
        + 'anyone\'s latency' };

    Table.paint('numa-policies', ['firstTouch', 'interleave'].map(function (policy) {
      const found = measure(Object.assign({}, view.settings, { policy: policy }),
        view.workload).summary;

      return [Numa.POLICIES[policy].name, (100 * found.steady.locality).toFixed(1) + '%',
        found.steady.average.toFixed(1), uses[policy]];
    }).concat([[Numa.POLICIES.localAlloc.name, '100.0%',
      String(view.run.summary.localCycles) + '.0',
      'what you get by arranging the first touch correctly, which is the point of the page']]),
      'The third row is not a policy the operating system offers; it is what the first row '
      + 'gives you once the program touches its pages from the thread that will use them. That '
      + 'is why the rule is a program change rather than a configuration one - the policy was '
      + 'never the problem.');
  }

  function paintMigration(view) {
    const patterns = [
      { kind: 'handoff', label: 'handed off: node 0 allocates, node 1 uses',
        right: 'move it - the user is stable' },
      { kind: 'alternating', label: 'shared: two nodes alternate on every page',
        right: 'leave it - moving it helps nobody and costs every time' }
    ];

    Table.paint('numa-migrate-table', patterns.map(function (pattern) {
      const off = measure(Object.assign({}, view.settings, { migrate: false }),
        { kind: pattern.kind, pages: 16, rounds: 40 }).summary;
      const on = measure(Object.assign({}, view.settings, { migrate: true }),
        { kind: pattern.kind, pages: 16, rounds: 40 }).summary;
      const localityOf = function (found) {
        const steady = found.steady || found;

        return (100 * steady.locality).toFixed(1) + '%';
      };

      return [pattern.label, localityOf(off), localityOf(on), on.migrations, pattern.right];
    }), 'Two patterns, and a heuristic has to get both right. The first is what migration is '
      + 'for: locality goes from nothing to most, for one move per page. The second is the trap '
      + 'and the demo produces zero migrations on it, because the run counter resets whenever '
      + 'the accessing node changes - without that reset the pages would shuttle back and forth '
      + 'forever, paying the move on every access and never landing anywhere useful.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#numa-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, { lazyLib: app.lazyLib, height: 250,
      xLabel: 'remote latency (cycles)', yLabel: 'average access (cycles)',
      series: [
        { label: 'one thread initialises', points: REMOTES.map(function (remote) {
          return { x: remote, y: measure(Object.assign({}, view.settings,
            { remoteCycles: remote }),
          Object.assign({}, view.workload, { initialiser: 0 })).summary.steady.average };
        }) },
        { label: 'each worker touches its own', points: REMOTES.map(function (remote) {
          return { x: remote, y: measure(Object.assign({}, view.settings,
            { remoteCycles: remote }),
          Object.assign({}, view.workload, { initialiser: null })).summary.steady.average };
        }) }
      ] });
    root.Helpers.setText('numa-chart-note', 'One line rises with the remote penalty and the '
      + 'other is flat, because a program whose pages are all local does not care what a '
      + 'remote access costs. That is the shape of the whole subject: the fix is not to make '
      + 'remote accesses cheaper, it is to stop making them. The gap at the right-hand end is '
      + 'what the mistake costs on a machine with a wide topology - and topologies have been '
      + 'getting wider, not narrower.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
