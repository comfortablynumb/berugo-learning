/**
 * Section: Dynamic analysis.
 *
 * Two race detectors over seven traces, and neither of them is the judge.
 * `machines/race-oracle.js` takes the per-thread program order out of the
 * trace and enumerates every schedule the synchronisation allows, so "this
 * race can happen" is decided by running all of them rather than inferred —
 * which is what makes the false-positive column a measurement instead of an
 * opinion.
 *
 * The result is worth stating plainly because it is the reason vector clocks
 * won: happens-before finds all three real races and reports nothing else,
 * plain lockset adds four false positives, and Eraser's state machine removes
 * three of those four. The one it cannot remove is the one no lockset
 * algorithm can see — a location handed to another thread by a fork.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'dynamic-analysis';
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
      title: 'Diagram — why a fork orders two accesses that share no lock',
      caption: 'The lockset algorithm asks "is one lock held at every access", and the answer '
        + 'here is no. Happens-before asks "could these two have run at the same time", and the '
        + 'fork says no — the write is before the fork, the read is after it, and no schedule '
        + 'puts them together. Two different questions about the same trace, and only one of '
        + 'them is about races.',
      definition: [
        'flowchart LR',
        'W["main writes config"] --> F["main forks worker"]',
        'F --> R["worker reads config"]',
        'F -.->|"the fork is a happens-before edge:<br/>everything before it is before<br/>everything the new thread does"| R',
        'W -.->|"no lock is held at either access,<br/>so the lockset is empty"| L["lockset: a race"]',
        'R -.->|"ordered by the fork,<br/>so no schedule runs them together"| H["happens-before: no race"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Dynamic analysis observes an execution, so everything it says is about that '
        + 'execution — unless it is careful.** A race detector that only reported the '
        + 'interleaving it saw would find almost nothing, because the interleaving that '
        + 'happened is usually the correct one. The whole technique is reasoning about the '
        + 'schedules that did NOT happen from the trace of the one that did.',
      '**Instrumentation is where the cost lives, and there are three places to put it.** '
        + 'Source instrumentation is portable and misses libraries; IR or bytecode '
        + 'instrumentation sees everything the compiler sees and is what sanitisers use; '
        + 'run-time instrumentation through a virtual machine or a debugger sees the real thing '
        + 'and costs the most. The overhead decides whether a tool runs in CI or once a year.',
      '**A happens-before race detector is vector clocks and nothing else.** Each thread '
        + 'carries a clock; a release stores its clock on the lock and a matching acquire joins '
        + 'it; fork and join copy clocks between threads. Two accesses race when one does not '
        + 'precede the other in that partial order and at least one is a write.',
      '**The lockset algorithm asks a different question, and that is the whole story.** For '
        + 'each location it intersects the set of locks held at every access; an empty '
        + 'intersection means no single lock protects it. That is cheap and it is not a '
        + 'question about ordering, which is why it reports locations that a fork or a join has '
        + 'made perfectly safe.',
      '**Eraser\'s state machine is the difference between the algorithm as described and as '
        + 'published.** A location is exclusive to the thread that first touches it, becomes '
        + 'shared when another thread reads it, and only shared-modified when another thread '
        + 'writes it — and only that last state reports. Switching it on in the demo removes '
        + 'three of the four false positives.'
    ];
  }

  function moreOrientation() {
    return [
      '**The fourth is the one no lockset can remove.** A location written under a lock and '
        + 'then handed to a new thread that writes it reaches shared-modified with an empty '
        + 'lockset. Nothing in the algorithm looks at the fork, so nothing in it can see that '
        + 'the two writes cannot overlap.',
      '**The oracle here enumerates schedules rather than trusting either detector.** It takes '
        + 'the per-thread program order out of the trace and explores every interleaving the '
        + 'locks, forks and joins allow, calling two conflicting accesses a race when some '
        + 'schedule runs them with nothing in between. That is expensive and exhaustive, which '
        + 'is exactly the trade a fixture set is for.',
      '**A detector only sees the code that ran, which is the limitation nothing fixes.** '
        + 'Happens-before reports no false positives here and it also reports nothing at all '
        + 'about a branch the run did not take. That is the standing gap between dynamic '
        + 'analysis and the static analyses earlier in this milestone, and it is why they are '
        + 'complementary rather than competing.',
      '**Coverage is the other dynamic measurement, and the criteria are not '
        + 'interchangeable.** Statement coverage is satisfied by running every line once; '
        + 'branch coverage requires both outcomes of every decision; path coverage requires '
        + 'every combination and is exponential; MC/DC requires each condition to '
        + 'independently affect the outcome and is what avionics standards demand.',
      '**Memory-error detection is the same idea with different bookkeeping.** Shadow memory '
        + 'records the state of every byte, redzones surround each allocation so an overflow '
        + 'lands somewhere marked, and a quarantine delays reuse so a use-after-free is caught '
        + 'rather than silently working. The costs are a constant factor of memory and a '
        + 'constant factor of time, and both are worth paying in a test build.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation().concat(moreOrientation()),
      demo: { title: 'Interactive demo — two detectors judged by every schedule',
        markup: root.DynamicTemplate.render() },
      diagram: diagram(),
      insight: '**A race detector only ever sees the interleaving that happened, which is why '
        + 'it must reason about happens-before rather than about what actually overlapped.** '
        + 'That is the idea worth taking away, and it has a direct practical consequence: a '
        + 'happens-before detector finds races in runs where nothing went wrong, which means '
        + 'you can enable it on your existing test suite and get real findings without writing '
        + 'a single stress test. It is the highest-value dynamic tool for concurrent code for '
        + 'exactly that reason. The second consequence is about how to read reports from the '
        + 'lockset family, which is what many older and cheaper tools use. Their false '
        + 'positives are not random: they cluster on initialisation before publication, on '
        + 'read-only data, and on ownership handed between threads — so a report on a field '
        + 'that is written once during construction and never again is almost certainly noise, '
        + 'and a report on a counter updated in two places is almost certainly not. The third '
        + 'is the limit both share. Neither can say anything about a line that did not run, and '
        + 'a race in a branch your tests never take is invisible to every dynamic tool ever '
        + 'built — which is the argument for pairing them with the static analyses earlier in '
        + 'this milestone rather than choosing between them.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.DynamicTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function locationsOf(rows) {
    return root.RaceOracle.unique(rows.map(function (row) { return row.location; }));
  }

  function measure(name, states) {
    const fixture = root.DynamicTemplate.TRACES[name];
    const hb = root.RaceDetect.happensBefore(fixture.trace);
    const ls = root.RaceDetect.lockset(fixture.trace, { states: states });
    const truth = root.RaceOracle.races(fixture.trace, {});
    const real = truth.locations;

    return { name: name, fixture: fixture, truth: truth, hb: hb, ls: ls, real: real,
      hbAt: locationsOf(hb.races), lsAt: locationsOf(ls.reports),
      hbFalse: difference(locationsOf(hb.races), real),
      lsFalse: difference(locationsOf(ls.reports), real),
      hbMissed: difference(real, locationsOf(hb.races)),
      lsMissed: difference(real, locationsOf(ls.reports)) };
  }

  function difference(list, other) {
    return list.filter(function (name) { return other.indexOf(name) === -1; });
  }

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return measure(parts[0], parts[1]);
  });

  const allFor = root.Helpers.memoise(function (states) {
    return Object.keys(root.DynamicTemplate.TRACES).map(function (name) {
      return measure(name, states);
    });
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(JSON.stringify([values['dya-trace'], values['dya-lockset']]));

    paintTrace(study);
    paintMetrics(study);
    paintVerdicts(study, values['dya-lockset']);
    paintEvents(study);
    paintCoverage();
    paintOverhead();
    paintChart(app, values['dya-lockset']);
  }

  function paintTrace(study) {
    const lines = study.fixture.trace.map(function (event, at) {
      return at + '  ' + event.thread + ' ' + event.op + ' ' + event.target;
    });

    root.jQuery('#dya-trace-text').text(lines.join('\n'));
    root.Helpers.setText('dya-trace-caption', 'This trace is ' + study.fixture.about +
      '. The oracle takes the per-thread order out of it and explores every schedule the '
      + 'synchronisation allows — ' + study.truth.states + ' states, ' +
      (study.truth.exhausted ? 'exhaustively' : 'and it ran out of budget, so the verdict is '
        + 'not a proof') + '.');
  }

  function paintMetrics(study) {
    root.MetricGrid.update({
      'dya-real': { value: study.real.length,
        note: study.real.length ? 'on ' + study.real.join(', ') : 'no schedule races here' },
      'dya-schedules': { value: study.truth.states,
        note: study.truth.exhausted ? 'every reachable schedule state' : 'BUDGET EXHAUSTED' },
      'dya-hb': { value: study.hb.races.length,
        note: study.hbAt.length ? 'on ' + study.hbAt.join(', ') : 'nothing reported' },
      'dya-lockset-reports': { value: study.ls.reports.length,
        note: study.lsAt.length ? 'on ' + study.lsAt.join(', ') : 'nothing reported' },
      'dya-false': { value: study.hbFalse.length + study.lsFalse.length,
        note: study.lsFalse.length ? 'the lockset reports ' + study.lsFalse.join(', ') +
          ', which no schedule produces' : 'neither detector reported the impossible' },
      'dya-missed': { value: study.hbMissed.length + study.lsMissed.length,
        note: study.hbMissed.length + study.lsMissed.length
          ? 'A REAL RACE WENT UNREPORTED' : 'every real race was reported by both' }
    });
  }

  function paintVerdicts(study, states) {
    root.jQuery('#dya-verdicts tbody').html(allFor(states).map(function (row) {
      return '<tr' + (row.name === study.name ? ' class="row-current"' : '') +
        '><td class="mono">' + row.name + '</td><td class="mono">' +
        (row.real.join(', ') || 'nothing') + '</td><td class="mono">' +
        (row.hbAt.join(', ') || 'nothing') + '</td><td class="mono">' +
        (row.lsAt.join(', ') || 'nothing') + '</td><td>' + differenceNote(row) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dya-verdicts-caption', verdictsCaption(states));
  }

  function differenceNote(row) {
    if (row.hbMissed.length || row.lsMissed.length) return 'a real race went unreported';
    if (row.lsFalse.length) {
      return 'the lockset reports ' + row.lsFalse.join(', ') + ' — no schedule produces it';
    }
    if (row.hbFalse.length) return 'happens-before reports the impossible, which is a bug';
    return 'both agree with every schedule';
  }

  function verdictsCaption(states) {
    const rows = allFor(states);
    const real = rows.reduce(function (sum, row) { return sum + row.real.length; }, 0);
    const lsFalse = rows.reduce(function (sum, row) { return sum + row.lsFalse.length; }, 0);
    const hbFalse = rows.reduce(function (sum, row) { return sum + row.hbFalse.length; }, 0);

    return 'Across all seven traces there are ' + real + ' locations that really can race, and '
      + 'happens-before reports exactly those with ' + hbFalse + ' false positives. The '
      + 'lockset — ' + (states === 'eraser' ? 'with Eraser\'s state machine' : 'in its plain '
      + 'form') + ' — reports ' + lsFalse + '. Switch the control to compare: the state machine '
      + 'removes the ones caused by initialisation before publication and by read-only sharing, '
      + 'and cannot remove the one caused by a fork, because no lockset algorithm looks at '
      + 'ordering at all.';
  }

  function paintEvents(study) {
    const racing = {};

    study.hb.races.forEach(function (row) {
      racing[row.firstAt] = true;
      racing[row.secondAt] = true;
    });
    root.jQuery('#dya-events tbody').html(study.fixture.trace.map(function (event, at) {
      return '<tr' + (racing[at] ? ' class="row-bad"' : '') + '><td class="mono">' + at +
        '</td><td class="mono">' + event.thread + '</td><td class="mono">' + event.op +
        '</td><td class="mono">' + event.target + '</td><td>' + eventNote(event, racing[at]) +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('dya-events-caption', eventsCaption(study));
  }

  const EVENT_NOTES = {
    acquire: 'the thread\'s clock joins the lock\'s, and the lockset gains a lock',
    release: 'the lock takes a copy of the thread\'s clock, and the thread\'s clock ticks',
    fork: 'the new thread inherits everything that happened before this point',
    join: 'the waiting thread inherits everything the finished one did'
  };

  function eventNote(event, racing) {
    if (EVENT_NOTES[event.op]) return EVENT_NOTES[event.op];
    if (racing) return 'part of a reported race: unordered against a conflicting access';
    return 'compared against the last write and every unordered read of this location';
  }

  function eventsCaption(study) {
    if (!study.hb.races.length) {
      return 'Nothing is highlighted because happens-before orders every conflicting pair in '
        + 'this trace. The synchronisation doing that ordering is in the acquire, release, fork '
        + 'and join rows — remove any one of them and the verdict changes.';
    }
    return 'The highlighted rows are the two accesses happens-before could not order. Note what '
      + 'it took: the detector compared each access against the last write and every unordered '
      + 'read of that location, which is one vector-clock comparison per pair rather than a '
      + 'search over schedules.';
  }

  const COVERAGE = [
    { name: 'statement', needs: 'every line executed at least once',
      misses: 'a branch that was never taken in the other direction',
      cost: 'one bit per line, and it is what most tools report' },
    { name: 'branch', needs: 'both outcomes of every decision',
      misses: 'the combination of two decisions that only breaks together',
      cost: 'one bit per edge; the standard target for serious suites' },
    { name: 'path', needs: 'every combination of decisions along a route',
      misses: 'nothing, and it is exponential — this is what 32.4 bounds',
      cost: 'up to 2 to the branches; unreachable for real functions' },
    { name: 'MC/DC', needs: 'each condition shown to independently change the outcome',
      misses: 'far less than branch coverage, at a fraction of path coverage\'s cost',
      cost: 'about one test per condition; required by DO-178C for avionics' }
  ];

  function paintCoverage() {
    root.jQuery('#dya-coverage tbody').html(COVERAGE.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.needs + '</td><td>' +
        root.Helpers.escapeHtml(row.misses) + '</td><td>' +
        root.Helpers.escapeHtml(row.cost) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dya-coverage-caption',
      'A coverage figure is a statement about the criterion it was measured against, and the '
      + 'gap between the first two rows is where most of the confusion lives: 100 per cent '
      + 'statement coverage on a function with three ifs can miss half its behaviour. The last '
      + 'row is the interesting one — MC/DC exists precisely because branch coverage is too '
      + 'weak and path coverage is unaffordable.');
  }

  const OVERHEAD = [
    { name: 'source instrumentation', sees: 'everything in the code you compiled',
      cost: 'small, and it is in the binary you ship unless you strip it',
      blind: 'libraries, generated code, and anything from another language' },
    { name: 'IR or bytecode instrumentation', sees: 'everything the compiler sees, uniformly',
      cost: '2 to 20 times, which is what sanitisers and race detectors cost',
      blind: 'hand-written assembly and the kernel' },
    { name: 'binary rewriting', sees: 'shipped code with no rebuild',
      cost: '10 to 100 times, and the analysis has to recover structure first',
      blind: 'the types and names that made the report readable' },
    { name: 'sampling profilers', sees: 'where time goes, statistically',
      cost: 'one to five per cent, which is why it runs in production',
      blind: 'anything that happens between samples, including every race' }
  ];

  function paintOverhead() {
    root.jQuery('#dya-overhead tbody').html(OVERHEAD.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.sees + '</td><td>' +
        root.Helpers.escapeHtml(row.cost) + '</td><td>' +
        root.Helpers.escapeHtml(row.blind) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dya-overhead-caption',
      'The overhead column decides where a tool can run, and that decides what it finds. A '
      + 'race detector at ten times slowdown runs on a test suite and finds what the tests '
      + 'exercise; a sampling profiler at two per cent runs in production and finds what users '
      + 'do. Neither can be moved into the other\'s place by tuning.');
  }

  function paintChart(app, states) {
    const host = root.jQuery('#dya-chart')[0];
    const rows = allFor(states);

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 240,
      yLabel: 'locations, over all seven traces',
      /* No x-axis title: the bar labels already name the detector, and a title
         under five two-line labels collides with them. A zero-height bar is
         still labelled, which is the point of keeping it. */
      values: [
        { label: 'really race', value: total(rows, 'real'), series: 0 },
        { label: 'HB found', value: total(rows, 'hbAt'), series: 1 },
        { label: 'HB false', value: total(rows, 'hbFalse'), series: 2 },
        { label: 'lockset found', value: total(rows, 'lsAt'), series: 1 },
        { label: 'lockset false', value: total(rows, 'lsFalse'), series: 2 }
      ]
    });
    root.Helpers.setText('dya-chart-note', chartNote(rows, states));
  }

  function total(rows, field) {
    return rows.reduce(function (sum, row) { return sum + row[field].length; }, 0);
  }

  function chartNote(rows, states) {
    return 'Both detectors find every one of the ' + total(rows, 'real') + ' real races — that '
      + 'is the column nobody may lose — and they differ entirely in what else they report. '
      + 'Happens-before adds ' + total(rows, 'hbFalse') + '; the lockset ' +
      (states === 'eraser' ? 'with Eraser\'s state machine' : 'in its plain form') + ' adds ' +
      total(rows, 'lsFalse') + '. The ratio is why vector clocks won, and the remaining '
      + 'lockset false positive is instructive rather than embarrassing: it is a location a '
      + 'fork made safe, and the algorithm has no way to know about forks.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
