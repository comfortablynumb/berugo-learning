/**
 * Section: Finalisation and weak references.
 *
 * The production failure is run rather than described: a loop opens a file
 * handle per iteration and drops the object holding it, the handle is
 * released by a finaliser, the finaliser runs only when a collection happens,
 * and a collection happens only when memory runs low — which it does not,
 * because the objects are sixteen bytes. The process dies of file descriptors
 * at iteration 17 with a heap that is 6 per cent full.
 *
 * The cache half is the same lesson from the other end. Twelve entries keyed
 * on objects, half the keys dropped: with strong entries nothing is
 * reclaimed, because the map is reachable and the map reaches the keys. One
 * word — the strength of one reference — is the difference between a cache
 * and the commonest leak in managed languages.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'weak-references';
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
      title: 'Diagram — the four reference strengths and what each one keeps alive',
      caption: 'A strength is an instruction to the tracer about whether to follow this edge. '
        + 'Strong edges are followed, so they keep the referent. Weak edges are not, so the '
        + 'referent dies and the slot is cleared. Soft is a policy rather than an invariant — '
        + 'followed until the heap is under pressure — which is why soft references are '
        + 'unreliable for correctness and fine for a cache. Phantom is what you use when you '
        + 'want to be told the object has gone without being able to bring it back.',
      definition: [
        'graph LR',
        'R["root"] -->|"strong — always followed"| A["object A: lives"]',
        'R -->|"soft — followed unless memory is tight"| B["object B: lives, usually"]',
        'R -->|"weak — never followed"| C["object C: dies, slot cleared"]',
        'R -->|"phantom — never followed, no access"| D["object D: dies, you are told"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A reference strength is one instruction to the tracer: follow this edge, or do not.** '
        + 'Everything about weak maps, caches, listeners and cleanup actions follows from that '
        + 'single bit. A weak reference is a reference the collector pretends is not there when '
        + 'it decides what is reachable.',
      '**Which is exactly what makes a cache a cache rather than a leak.** A map keyed on '
        + 'objects, with strong entries, keeps every key it has ever been given — because the '
        + 'map is reachable and the map reaches the keys. The demo shows twelve entries where '
        + 'half the keys have been dropped and nothing at all is reclaimed.',
      '**Soft is a policy, not an invariant, and that is a real difference.** A soft reference '
        + 'is cleared when the runtime decides memory is tight, on a schedule you do not '
        + 'control and cannot test. It is fine for "recompute this if it is gone" and wrong for '
        + 'anything whose absence changes behaviour.',
      '**A finaliser runs at an unspecified time, in an unspecified order, on a thread you did '
        + 'not choose.** None of those three is a detail. Unspecified time means the resource is '
        + 'held for an unbounded interval. Unspecified order means an object cannot rely on '
        + 'anything it references still being valid. An unspecified thread means the finaliser '
        + 'is concurrent code whether or not it was written as such.',
      '**And it can resurrect the object, which is why finalisable objects cost two '
        + 'collections.** If a finaliser stores `this` somewhere reachable, the object is alive '
        + 'again after being declared dead. So a runtime must find it in one cycle, run the '
        + 'finaliser, and only confirm it dead in a later one. The demo shows both cycles and '
        + 'the object surviving.',
      '**An object awaiting finalisation keeps everything it references alive too.** That is '
        + 'the rule that turns one forgotten finaliser into a retained subgraph rather than a '
        + 'retained object, and it has to be that way: a finaliser that ran against objects the '
        + 'collector had already freed would be reading freed memory in a managed runtime.',
      '**The finaliser runs at most once, so a resurrected object is never cleaned up at '
        + 'all.** That is worse than a leak — the resource is held and the code that would '
        + 'release it will not be called again. Resurrection is not a feature to use carefully; '
        + 'it is a defect the specification has to define behaviour for.',
      '**The general rule is that the collector manages memory and nothing else.** It has no '
        + 'idea that file descriptors are scarce, that a lock is held, or that a socket is '
        + 'costing money. Its only trigger is memory pressure, so a program that runs out of '
        + 'something else while the heap is comfortable will simply never be rescued. Explicit '
        + 'release — `try`-with-resources, RAII, a `defer`, a `using` block — is not a fallback '
        + 'for when finalisers are slow. It is the mechanism, and finalisers are the fallback.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — a handle limit, a cache and a resurrection',
        markup: root.WeakTemplate.render() },
      diagram: diagram(),
      insight: '**The classic production failure is exhausting a non-memory resource while the '
        + 'heap is nearly empty, so the collector never runs — GC does not manage sockets, '
        + 'handles or locks, and the runtime cannot know they are scarce.** The demo is the '
        + 'whole argument: the loop dies at iteration 17 having triggered zero collections, '
        + 'because sixteen-byte objects do not fill a four-kilobyte heap and nothing else in '
        + 'the system is watching. Every part of that is realistic. The object was small, so '
        + 'memory pressure never arrived. The resource was scarce, so it ran out first. And the '
        + 'release code existed and was correct — it was simply never called. This is why '
        + '"the finaliser will close it" is one of the most expensive sentences in managed '
        + 'languages, and why every language that once encouraged them has spent years walking '
        + 'it back: Java deprecated `finalize`, .NET wrote a whole `IDisposable` pattern around '
        + 'not needing it, Python\'s `__del__` is documented with warnings. The replacement is '
        + 'always the same shape — make the release explicit and lexically scoped, so it happens '
        + 'at a point in the program rather than at a point in the collector. And when you '
        + 'genuinely need to know that an object has gone, use the mechanism that tells you '
        + 'without letting you bring it back: a phantom reference or a cleanup action, '
        + 'registered on something that is not the object itself. The moment your cleanup can '
        + 'reach the thing it is cleaning up, you have written a resurrection bug and the '
        + 'runtime will only call you once.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.WeakTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function makeHeap() {
    return root.HeapSim.makeHeap({});
  }

  const handlesFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return [false, true].map(function (close) {
      return root.GcWeak.handleScenario({ close: close, limit: parts[0],
        iterations: 64, objectBytes: 16, heapLimit: 4096 });
    });
  });

  const cacheFor = root.Helpers.memoise(function (pressure) {
    return root.GcWeak.STRENGTHS.map(function (strength) {
      return { strength: strength,
        out: root.GcWeak.cacheScenario(makeHeap, strength.id,
          { entries: 12, keep: 0.5, pressure: pressure === 'high' }) };
    });
  });

  const finalFor = root.Helpers.memoise(function (mode) {
    return root.GcWeak.resurrectionScenario(makeHeap, { resurrect: mode === 'resurrect' });
  });

  function update() {
    const values = panel.values();
    const runs = handlesFor(JSON.stringify([values['wkr-limit']]));
    const chosen = values['wkr-close'] === 'explicit' ? runs[1] : runs[0];
    const cache = cacheFor(values['wkr-pressure']);
    const finals = finalFor(values['wkr-resurrect']);

    paintChart(chosen, values['wkr-limit']);
    paintMetrics(chosen, cache, finals);
    paintStrengths(cache);
    paintHandles(runs, values['wkr-close']);
    paintFinal(finals);
    paintAdvice();
  }

  function paintChart(run, limit) {
    if (chart && chart.destroy) chart.destroy();
    chart = root.GrowthPlot.render(document.getElementById('wkr-chart'), {
      series: [
        { label: 'handles open', color: root.Palette.series(0),
          points: run.rows.map(function (row) { return { x: row.at, y: row.open }; }) },
        { label: 'kilobytes held', color: root.Palette.series(1),
          points: run.rows.map(function (row) {
            return { x: row.at, y: row.bytes / 1024 };
          }) }
      ],
      xLabel: 'iteration', yLabel: 'open handles / KB held',
      markers: [{ x: 1, label: 'limit ' + limit, labelY: 12 }],
      legendHost: document.getElementById('wkr-legend'),
      summary: function () { return 'Handles held against memory held, per iteration.'; }
    });
    root.Helpers.setText('wkr-chart-caption', chartCaption(run, limit));
  }

  function chartCaption(run, limit) {
    if (!run.exhausted) {
      return 'With the handle released explicitly, the open count never leaves zero and the '
        + 'limit of ' + limit + ' is never approached. ' + run.opened + ' handles were opened '
        + 'and ' + run.released + ' released, with ' + run.collections + ' collections — the '
        + 'collector was not involved at all, which is exactly the point.';
    }
    return 'The two lines are the whole failure. Handles climb one per iteration and hit the '
      + 'limit of ' + limit + ' at iteration ' + run.failedAt + '. Memory over the same span '
      + 'reaches ' + (run.bytes / 1024).toFixed(2) + ' KB of a 4 KB budget, so no collection is '
      + 'ever triggered — ' + run.collections + ' of them — and the finalisers that would have '
      + 'released the handles are never run. The heap is fine. The process is dead.';
  }

  function paintMetrics(run, cache, finals) {
    const weak = cache.find(function (row) { return row.strength.id === 'weak'; });
    const cycles = finals.rows.findIndex(function (row) { return row.reclaimed > 0; }) + 1;

    root.MetricGrid.update({
      'wkr-failed': { value: run.exhausted ? run.failedAt : 'never',
        note: run.exhausted ? 'with ' + (run.bytes / 1024).toFixed(2) + ' KB of heap in use'
          : 'the handle is released at the end of the block' },
      'wkr-collections': { value: run.collections,
        note: 'memory pressure is the only thing that starts one' },
      'wkr-cleared': { value: weak.out.cleared + ' of ' + (weak.out.entries / 2),
        note: 'weak entries whose key became unreachable' },
      'wkr-cycles': { value: cycles || 'never freed',
        note: finals.resurrect ? 'the finaliser resurrected it, so it is never freed'
          : 'queued in one cycle, freed in the next' }
    });
  }

  function paintStrengths(cache) {
    root.jQuery('#wkr-strengths tbody').html(cache.map(function (entry) {
      return '<tr><td class="mono">' + entry.strength.name + '</td><td>' +
        entry.strength.keeps + '</td><td>' + entry.strength.clearedWhen +
        '</td><td class="mono">' + entry.out.cleared + '</td><td class="mono">' +
        entry.out.reclaimed + '</td><td class="mono">' + entry.out.bytes + '</td></tr>';
    }).join(''));

    root.Helpers.setText('wkr-strengths-caption', strengthsCaption(cache));
  }

  function strengthsCaption(cache) {
    const strong = cache[0];
    const weak = cache.find(function (row) { return row.strength.id === 'weak'; });
    const soft = cache.find(function (row) { return row.strength.id === 'soft'; });

    return 'The same cache, the same twelve entries, the same six keys dropped. Strong entries '
      + 'reclaim ' + strong.out.reclaimed + ' objects and hold ' + strong.out.bytes + ' bytes; '
      + 'weak entries reclaim ' + weak.out.reclaimed + ' and hold ' + weak.out.bytes + '. The '
      + 'strong version is not a cache with a bug in it — it is a map that works exactly as '
      + 'specified and retains every key it has ever seen, which is the commonest leak in '
      + 'managed languages. The soft row currently clears ' + soft.out.cleared + '; move the '
      + 'pressure control and watch it change, which is precisely why soft references cannot be '
      + 'relied on for correctness.';
  }

  function paintHandles(runs, chosen) {
    const rows = [{ name: 'by the finaliser', run: runs[0], key: 'finaliser' },
      { name: 'explicitly, at the end of the block', run: runs[1], key: 'explicit' }];

    root.jQuery('#wkr-handles tbody').html(rows.map(function (entry) {
      return '<tr' + (entry.key === chosen ? ' class="row-current"' : '') +
        '><td class="mono">' + entry.name + '</td><td class="mono">' + entry.run.rows.length +
        '</td><td class="mono">' + entry.run.opened + '</td><td class="mono">' +
        entry.run.peakHandles + '</td><td class="mono">' + entry.run.collections +
        '</td><td class="mono">' + (entry.run.exhausted ? entry.run.failedAt : 'never') +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('wkr-handles-caption',
      'Identical loops, identical allocations, identical memory. The only difference is where '
      + 'the release happens: at a point in the program, or at a point in the collector. One of '
      + 'them runs to completion and the other stops at iteration ' + runs[0].failedAt +
      '. This is the entire case for `try`-with-resources, RAII, `defer` and `using` over '
      + 'finalisers, and it is not about speed.');
  }

  function paintFinal(finals) {
    root.jQuery('#wkr-final tbody').html(finals.rows.map(function (row) {
      return '<tr><td class="mono">' + row.cycle + '</td><td class="mono">' + row.finalised +
        '</td><td class="mono">' + row.resurrected + '</td><td class="mono">' + row.reclaimed +
        '</td><td class="mono">' + row.live + '</td><td class="mono">' + row.queued +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('wkr-final-caption', finalCaption(finals));
  }

  function finalCaption(finals) {
    if (!finals.resurrect) {
      return 'Cycle 1 notices the object is unreachable and queues it — nothing is freed, '
        + 'because the finaliser has not run and might resurrect it. Cycle 2 runs the '
        + 'finaliser, confirms the object is still unreachable, and frees it along with the '
        + 'object it referenced. Two collections for one object, and everything it points at '
        + 'stays alive for both of them.';
    }
    return 'The finaliser stored `this` somewhere reachable, so the object is alive again — ' +
      finals.live + ' objects remain after three cycles and none of them will ever be freed. '
      + 'The finaliser ran ' + finals.finalised + ' time and will not run again: a resurrected '
      + 'object is marked finalised for good, so if it becomes unreachable later its cleanup '
      + 'is simply skipped. That is worse than a leak — the resource is held and the code that '
      + 'releases it has been permanently disqualified from running.';
  }

  const ADVICE = [
    { name: 'try-with-resources / RAII / defer / using',
      when: 'at the end of the block, deterministically',
      order: 'reverse of acquisition, guaranteed', resurrect: 'no',
      use: 'every scarce resource: handles, sockets, locks, transactions' },
    { name: 'reference counting destructor',
      when: 'at the store that drops the last reference',
      order: 'inner objects first, as counts cascade', resurrect: 'no',
      use: 'the same, in languages that have it — and it still leaks cycles' },
    { name: 'cleanup action / phantom reference',
      when: 'after the object is unreachable, at an unspecified time',
      order: 'none', resurrect: 'no — the action cannot reach the object',
      use: 'a safety net that logs a leak somebody else caused' },
    { name: 'finaliser',
      when: 'at an unspecified time, possibly never',
      order: 'none', resurrect: 'yes, and then it never runs again',
      use: 'nothing new; every language that had them is walking them back' }
  ];

  function paintAdvice() {
    root.jQuery('#wkr-advice tbody').html(ADVICE.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.when + '</td><td>' +
        row.order + '</td><td class="mono">' + row.resurrect + '</td><td>' + row.use +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('wkr-advice-caption',
      'The third row is the one people skip past, and it is the right answer to the question '
      + 'finalisers were invented for. A cleanup action is registered against the object but '
      + 'cannot reach it, so it can be run safely after the object is gone and there is nothing '
      + 'to resurrect. It is still asynchronous and still unordered — it is a safety net that '
      + 'reports a leak, not a mechanism that prevents one. The first row is the mechanism.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
