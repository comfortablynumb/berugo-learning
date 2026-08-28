/**
 * Section: Reference counting.
 *
 * Two measurements, and each one contradicts half of the folklore.
 *
 * The counting traffic is charged to the collector rather than to the
 * program, because those increments exist only because of it — which turns
 * "reference counting has no pause" into "reference counting has the worst
 * throughput in the set". And the chain fixture turns the other half over:
 * dropping the head of a list of n nodes frees all n at one store, so the
 * worst single mutator step is n rather than the flat two everybody quotes.
 *
 * The cycle is stepped rather than described. Watching count(a) go to 2 as
 * the cycle closes, and back to 1 rather than 0 when the root is dropped, is
 * the whole of the argument for why every production reference-counting
 * runtime also contains a tracer.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'reference-counting';
  const MODES = ['refcount', 'refcount-cycles', 'mark-sweep'];
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
      title: 'Diagram — a cycle unreachable from the roots with non-zero counts',
      caption: 'Nothing can reach a or b: the only reference from outside has been dropped. '
        + 'Both counts are 1, because each of them is holding the other, so neither will ever '
        + 'reach zero and neither will ever be freed. No local rule can see this — the '
        + 'information that decides it is a property of the whole graph, which is exactly what '
        + 'a reference count is designed not to need.',
      definition: [
        'graph LR',
        'R["root"] -.->|"dropped"| A',
        'A["a — count 1"] --> B["b — count 1"]',
        'B --> A',
        'R --> O["outside — count 1"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**One rule: every pointer store increments the new target and decrements the old one, '
        + 'and a count reaching zero frees the object immediately.** That is the whole design. '
        + 'Everything reference counting is famous for, good and bad, is a consequence of those '
        + 'two clauses and nothing else.',
      '**Immediate reclamation is the reason to want it.** The memory comes back at the '
        + 'instruction that made the object dead, so a destructor runs at a predictable moment '
        + 'and a file handle closes when the object holding it goes out of scope. That is why '
        + 'C++\'s `shared_ptr`, Swift and CPython all use it: they are buying determinism, not '
        + 'speed.',
      '**The cost is on every pointer write, and it is charged to the program.** The demo '
        + 'counts the adjustments and bills them to the collector, because they exist only '
        + 'because of it. Done that way the "no pause" collector has the worst throughput in '
        + 'the milestone, and both statements are true at once.',
      '**"No pause" is false in one specific case, and it is a common one.** Dropping the head '
        + 'of a linked list takes its count to zero, which frees it, which decrements its '
        + 'child, which frees it. A chain of two thousand nodes is freed at one store. The '
        + 'work is spread evenly over every write until it very much is not.',
      '**It cannot collect a cycle, and no amount of care fixes that.** Two objects holding '
        + 'each other keep each other above zero forever. This is not an implementation gap: a '
        + 'count is local information and reachability is global, so the answer is genuinely '
        + 'not in the count.',
      '**Trial deletion is the standard repair, and it is a tracer wearing a hat.** Take a '
        + 'candidate, walk the subgraph it reaches, subtract the references that come from '
        + 'inside that subgraph, and see whether anything is left over. A remaining count means '
        + 'somebody outside still points in and the whole group is live. Nothing left means the '
        + 'group is a cycle nobody can reach.',
      '**Only a decrement to a non-zero value can make a cycle garbage, which is what keeps '
        + 'the candidate set small.** An increment cannot, and a decrement to zero already '
        + 'freed the object. That single observation is what makes cycle collection affordable '
        + 'rather than a full trace, and it is why the trigger in the demo is a candidate count '
        + 'rather than a heap size — a counting runtime never notices the memory is gone, so '
        + 'waiting for the heap to fill waits for a signal that may never arrive.',
      '**Atomic counts are what make it expensive under threads.** Two threads sharing an '
        + 'object must adjust its count atomically, and an atomic increment on a contended '
        + 'cache line costs orders of magnitude more than the arithmetic. This is why deferred '
        + 'counting, ownership transfer and elision exist: every one of them is an optimisation '
        + 'for not doing the count at all.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — counts, cascades and the cycle',
        markup: root.RefcountTemplate.render() },
      diagram: diagram(),
      insight: '**Reference counting\'s real cost is the write barrier on every pointer store, '
        + 'which is why it loses on throughput and wins on pause time — and the cycle it cannot '
        + 'see is why every production system that uses it also contains a tracer.** The two '
        + 'halves are worth holding together because each is usually stated without the other. '
        + 'People who like counting quote the zero maximum pause and do not mention that the '
        + 'work did not disappear, it moved into the mutator, where the demo charges it and the '
        + 'throughput column collapses. People who dislike counting quote the cycle leak and do '
        + 'not mention that CPython, Swift and every `shared_ptr` in production ship with it '
        + 'anyway, because predictable destruction is worth more to those programs than '
        + 'throughput is. And both camps are usually wrong about the pause: dropping the head '
        + 'of a long list frees the whole list at one store, so the worst single write in the '
        + 'demo is the chain length rather than the flat two. What you actually get from '
        + 'reference counting is a cost that is smooth almost everywhere, spiky exactly where '
        + 'your data structures are deep, and a leak wherever your object graph has a back '
        + 'pointer — which is to say, wherever you have a parent link, an observer list or a '
        + 'doubly linked list. Reaching for a weak reference at those three places is not a '
        + 'micro-optimisation; it is the difference between the collector working and not.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.RefcountTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const traceFor = root.Helpers.memoise(function (rate) {
    return root.HeapSim.synthetic({ count: 1500, seed: 5, retained: 64,
      survival: 0.15, cycles: rate / 100 });
  });

  const runsFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const trace = traceFor(parts[0]);

    return MODES.map(function (mode) {
      return root.GcLab.replay(trace, { mode: mode, capacity: 8192,
        candidates: parts[1] });
    });
  });

  const cycleFor = root.Helpers.memoise(function () {
    const scenario = root.GcRefcount.cycleScenario(function () {
      return root.HeapSim.makeHeap({});
    });

    return { scenario: scenario, groups: groupsOf(scenario) };
  });

  /**
   * The trial itself, reported per group rather than as a verdict. The
   * internal count and the external one are different numbers and the whole
   * decision is the comparison between them, so both are columns.
   */
  function groupsOf(scenario) {
    return Array.from(scenario.state.candidates).map(function (id) {
      const group = root.GcRefcount.subgraph(scenario.heap, id);
      const internal = internalCount(scenario.heap, group);

      return { id: id, members: Array.from(group),
        internal: internal,
        external: root.GcRefcount.externallyReferenced(scenario.heap, group) };
    });
  }

  function internalCount(heap, group) {
    let total = 0;

    group.forEach(function (id) {
      heap.cells.get(id).refs.forEach(function (child) {
        if (group.has(child)) total += 1;
      });
    });
    return total;
  }

  const cascadeFor = root.Helpers.memoise(function (length) {
    return [1, 10, 100, Number(length)].filter(function (value, at, all) {
      return all.indexOf(value) === at;
    }).sort(function (a, b) { return a - b; }).map(function (size) {
      return root.GcRefcount.cascade(function () { return root.HeapSim.makeHeap({}); }, size);
    });
  });

  function update() {
    const values = panel.values();
    const runs = runsFor(JSON.stringify([values['rfc-cycles'], values['rfc-threshold']]));
    const cycle = cycleFor('one');
    const cascades = cascadeFor(values['rfc-chain']);

    paintChart(runs);
    paintMetrics(runs, cascades);
    paintWalk(cycle);
    paintTrial(cycle);
    paintCascade(cascades);
    paintCompare(runs);
  }

  function paintChart(runs) {
    if (chart && chart.destroy) chart.destroy();
    chart = root.GrowthPlot.render(document.getElementById('rfc-chart'), {
      series: runs.map(function (run, index) {
        return { label: run.mode.name, color: root.Palette.series(index),
          points: root.GcLab.occupancy(run, 140).map(function (row) {
            return { x: row.at, y: row.bytes };
          }) };
      }),
      xLabel: 'allocation', yLabel: 'bytes held',
      legendHost: document.getElementById('rfc-legend'),
      summary: function () { return 'Heap occupancy for counting, counting with cycle collection, and tracing.'; }
    });
    root.Helpers.setText('rfc-chart-caption', chartCaption(runs));
  }

  function chartCaption(runs) {
    return 'The plain counting line climbs and never fully comes back down: every cycle the '
      + 'workload makes is memory it can no longer see, ' + runs[0].uncollected + ' objects by '
      + 'the end. Adding cycle collection brings that to ' + runs[1].uncollected + ' at the '
      + 'cost of ' + runs[1].collections + ' pauses it did not have. The tracing line is the '
      + 'sawtooth: it never leaks and it never frees anything promptly either.';
  }

  function paintMetrics(runs, cascades) {
    const counting = runs[0];
    const stores = counting.mutatorWork - counting.programWork;
    const biggest = cascades[cascades.length - 1];

    root.MetricGrid.update({
      'rfc-traffic': { value: (stores / counting.programWork).toFixed(2),
        note: stores + ' adjustments over ' + counting.programWork + ' program steps' },
      'rfc-immediate': { value: counting.immediate,
        note: 'reclaimed with no collection and no pause' },
      'rfc-leaked': { value: counting.uncollected,
        note: counting.uncollectedBytes + ' bytes the counter can never reach' },
      'rfc-worst': { value: biggest.reclaimed,
        note: 'freed at one store, from a chain of ' + biggest.length }
    });
  }

  function paintWalk(cycle) {
    root.jQuery('#rfc-walk tbody').html(cycle.scenario.rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.step) + '</td>' +
        row.counts.map(function (count) {
          return '<td class="mono">' + (count === null ? '—' : count) + '</td>';
        }).join('') + '<td class="mono">' + row.live + '</td><td class="mono">' +
        row.unreachable + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rfc-walk-caption', walkCaption(cycle));
  }

  function walkCaption(cycle) {
    const last = cycle.scenario.rows[cycle.scenario.rows.length - 1];

    return 'Read the last row. The root has been dropped, so nothing outside can reach a or b, '
      + 'and the oracle agrees — ' + last.unreachable + ' objects are unreachable. Both counts '
      + 'are still ' + last.counts[0] + ', because each of them is being held by the other. No '
      + 'further decrement will ever happen to either, so neither will ever be freed. The '
      + 'unreachable column in the earlier rows counts objects that exist but have not been '
      + 'linked in yet, which is why it starts at two.';
  }

  function paintTrial(cycle) {
    const rows = cycle.groups;

    root.jQuery('#rfc-trial tbody').html(rows.map(function (group) {
      return '<tr><td class="mono">from #' + group.id + '</td><td class="mono">' +
        group.members.join(', ') + '</td><td class="mono">' + group.internal +
        '</td><td class="mono">' + (group.external ? 'yes' : 'no') + '</td><td class="mono">' +
        (group.external ? 'live — leave it alone' : 'a cycle nobody can reach — reclaim') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="5">no candidates: nothing has lost a reference without '
      + 'reaching zero</td></tr>');

    root.Helpers.setText('rfc-trial-caption',
      'A candidate is an object whose count went DOWN without reaching zero, and nothing else '
      + 'needs examining — an increment cannot make a cycle garbage and a decrement to zero has '
      + 'already freed the object. The trial subtracts the references originating inside the '
      + 'group from each member\'s count; if every member ends at zero, nothing outside points '
      + 'in and the whole group goes. That walk is a trace over a subgraph, which is the honest '
      + 'way to describe every production reference-counting system: it contains a tracer.');
  }

  function paintCascade(cascades) {
    root.jQuery('#rfc-cascade tbody').html(cascades.map(function (row) {
      return '<tr><td class="mono">' + row.length + '</td><td class="mono">' + row.reclaimed +
        '</td><td class="mono">' + row.decrements + '</td><td class="mono">' + row.remaining +
        '</td></tr>';
    }).join(''));

    const biggest = cascades[cascades.length - 1];

    root.Helpers.setText('rfc-cascade-caption',
      'One store — dropping the only reference to the head — frees ' + biggest.reclaimed +
      ' objects and performs ' + biggest.decrements + ' decrements before the program\'s next '
      + 'instruction runs. "Reference counting has no pause" means "it has no COLLECTION", '
      + 'which is a different claim. The pause is still there; it has moved into a specific '
      + 'store, and which store depends on the shape of your data rather than on the size of '
      + 'your heap. That is arguably worse, because it is not on any dashboard.');
  }

  function paintCompare(runs) {
    root.jQuery('#rfc-compare tbody').html(runs.map(function (run) {
      return '<tr><td class="mono">' + run.mode.name + '</td><td class="mono">' +
        run.collections + '</td><td class="mono">' + run.distribution.max +
        '</td><td class="mono">' + run.worstStep + '</td><td class="mono">' +
        run.throughput.toFixed(3) + '</td><td class="mono">' + run.uncollected +
        '</td><td class="mono">' + (run.correct ? 'yes' : 'NO — ' + run.wrong.length) +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('rfc-compare-caption', compareCaption(runs));
  }

  function compareCaption(runs) {
    const counting = runs[0];
    const tracing = runs[2];

    return 'Counting posts a maximum collection pause of ' + counting.distribution.max +
      ' against tracing\'s ' + tracing.distribution.max + ', and a throughput of ' +
      counting.throughput.toFixed(3) + ' against ' + tracing.throughput.toFixed(3) + '. Both '
      + 'columns are the same fact seen twice: the work counting does not do in a burst it does '
      + 'on every store instead. The last column is the one that is not a trade-off — every '
      + 'design here freed no reachable object, checked against the oracle at every collection.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
