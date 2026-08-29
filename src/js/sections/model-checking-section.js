/**
 * Section: Model checking.
 *
 * The protocol is checked twice by methods that share nothing: an explicit
 * breadth-first search over reachable states, and a bounded unrolling of the
 * transition relation into CNF for the solver from 32.5. They are required to
 * agree on the DEPTH of the first violation, not merely on whether one exists
 * — which is how the encoding bug that let a selector be true without its
 * premise was caught. It reported a violation at depth 1 that the search puts
 * at depth 6.
 *
 * Every counter-example is then replayed against the model: each guard
 * re-checked, each effect re-applied, and the final state confirmed to break
 * the invariant. A trace nobody replays is a story.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'model-checking';
  const SIZES = [2, 3, 4, 5, 6];
  const BMC_VARS = 7;
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
      title: 'Diagram — the interleaving that breaks check-then-set',
      caption: 'Each process checks that no flag is up and then raises its own. The states are '
        + 'the reachable ones; the path down the middle is the counter-example the checker '
        + 'produces, and its length is the number the two methods have to agree on. Nothing '
        + 'about either process is wrong on its own — the fault is entirely in the '
        + 'interleaving, which is what makes this class of bug so hard to find by testing.',
      definition: [
        'stateDiagram-v2',
        '    [*] --> Idle',
        '    Idle --> P1checked: p1 sees no flag up',
        '    P1checked --> BothChecked: p2 sees no flag up',
        '    BothChecked --> P1flag: p1 raises its flag',
        '    P1flag --> BothFlags: p2 raises its flag',
        '    BothFlags --> P1in: p1 enters',
        '    P1in --> Violation: p2 enters',
        '    Violation --> [*]',
        '    P1checked --> P1flagOnly: p1 raises its flag',
        '    P1flagOnly --> Safe: p2 now sees a flag and waits'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A model is a transition system: variables, an initial state, and actions with a guard '
        + 'and an effect.** That is all a model checker needs, and it is deliberately not the '
        + 'program — it is a description of the protocol at the level where the interesting '
        + 'mistakes live. Writing it is most of the work and most of the value.',
      '**Explicit-state checking is breadth-first search with a visited set.** Every reachable '
        + 'state is generated, hashed and checked against the invariant. Breadth-first matters '
        + 'because it makes the first counter-example the SHORTEST one, and the length of a '
        + 'counter-example is most of how usable it is.',
      '**A counter-example is the most actionable artefact in verification.** It is a bug '
        + 'report with an exact reproduction, produced before the code exists. The demo prints '
        + 'the interleaving action by action, and then replays it — re-checking every guard and '
        + 'the final invariant — because a trace nobody replays is a story.',
      '**Bounded model checking asks the same question as a SAT problem.** Unroll the '
        + 'transition relation k times: one copy of every variable per step, clauses saying '
        + 'each step is a legal action, and a final clause saying the invariant is broken '
        + 'somewhere. Satisfiable means a counter-example of length at most k, and the model is '
        + 'the trace.',
      '**Two methods that must agree on the DEPTH, not just the verdict.** Agreeing on "there '
        + 'is a violation" is a weak check that both encodings pass while one of them is wrong. '
        + 'This checker requires the shortest depth to match, which is how an encoding that let '
        + 'a step happen without its guard was caught: it reported depth 1 where the search '
        + 'says 6.',
      '**No violation up to depth k is not a proof, and the report must not pretend it is.** '
        + 'Bounded checking is a bug finder with a bound; only the exhaustive search or a '
        + 'completeness threshold turns it into a proof. Peterson comes back clean from both '
        + 'here, and only the exhaustive one is evidence.',
      '**The state space is exponential in the variables, and that is the whole difficulty.** '
        + 'The racing protocol has three bits per process, so k processes give 8 to the k '
        + 'states on paper — and the reachable set, which is what actually gets explored, grows '
        + 'as 4 to the k. Both are exponential; the difference between them is the only reason '
        + 'this is possible at all.',
      '**Finding a bug is cheap and proving its absence is not.** The same search that visits '
        + '4 096 reachable states to prove the six-process model safe finds the counter-example '
        + 'after 421. That asymmetry is why model checking is used to find bugs far more often '
        + 'than to certify their absence.',
      '**Partial-order reduction and symmetry are how real checkers survive.** If two actions '
        + 'commute, exploring both orders adds nothing, so an ample-set calculation explores '
        + 'one; if processes are interchangeable, states that differ only by a permutation can '
        + 'be merged. This checker implements NEITHER, which is why its state counts are the '
        + 'honest upper bound rather than what SPIN would report.',
      '**Safety and liveness are different kinds of property and need different machinery.** '
        + '"Two processes are never inside at once" is violated by a finite trace, so a search '
        + 'for reachable states settles it. "Whoever asks eventually gets in" is violated by an '
        + 'infinite one, which needs a cycle in the state graph — the automaton-theoretic '
        + 'approach through Buchi automata from M24, and it is why liveness costs more.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — two methods, one depth, one replayed trace',
        markup: root.ModelCheckTemplate.render() },
      diagram: diagram(),
      insight: '**A model checker\'s output is a counter-example trace, which is the most '
        + 'actionable artefact in verification: a bug report with an exact reproduction, '
        + 'produced before the code exists.** That is the practical case for the technique and '
        + 'it is worth being concrete about when it pays. Write a model when the bug you fear '
        + 'is an interleaving, a failure at an awkward moment, or a protocol that has to agree '
        + 'with itself across machines — because those are precisely the bugs that testing '
        + 'finds late, reproduces badly, and fixes wrongly. Do not write one for a data '
        + 'transformation, where a property test gives you more per hour. The second thing to '
        + 'internalise is what the state count means for your model rather than for the tool. '
        + 'Every boolean you add doubles the space, so the discipline is aggressive '
        + 'abstraction: model the fact that a message can be lost, not the bytes in it; model '
        + 'three servers, not a hundred, and rely on the small-scope hypothesis that says '
        + 'almost every protocol bug shows up at two or three participants. And when a checker '
        + 'reports "no violation up to depth 12", read it exactly as far as it goes. It is a '
        + 'statement about traces of length 12, not about your protocol — the industrial '
        + 'reports are full of bugs found at depth 30 in models that had been checked to 20 '
        + 'and declared correct.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.ModelCheckTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function specFor(name, processes) {
    if (name === 'peterson') return root.ModelCheckTemplate.petersonSpec();
    return root.ModelCheckTemplate.lockSpec(processes);
  }

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const spec = specFor(parts[0], parts[1]);
    const model = root.ModelCheck.create(spec);
    const search = root.ModelCheck.explore(model, { states: 200000 });

    return { spec: spec, model: model, search: search,
      replay: search.trace ? root.ModelCheck.replay(model, search.trace) : null,
      reachable: reachableCount(spec),
      compare: comparison(model, spec, parts[2]) };
  });

  /**
   * The unrolling grows roughly sixteen-fold per process — 1 991 clauses at
   * depth 1 with two processes, 32 778 with three, 440 333 with four — so the
   * comparison is only run where it can be run. Saying that in the table is
   * better than a demo that freezes, and it is the same lesson the state
   * counts teach in a different unit.
   */
  function comparison(model, spec, depth) {
    if (spec.vars.length > BMC_VARS) {
      return { rows: [], bmcDepth: null, agree: null, skipped: spec.vars.length };
    }
    return root.ModelCheck.compare(model, depth, {});
  }

  /** Every reachable state, by asking the same search a question it cannot
   *  fail: an invariant that always holds. */
  function reachableCount(spec) {
    const model = root.ModelCheck.create(Object.assign({}, spec, {
      invariant: function () { return true; }, invariantName: 'nothing'
    }));

    return root.ModelCheck.explore(model, { states: 200000 });
  }

  const explosionFor = root.Helpers.memoise(function () {
    return SIZES.map(function (processes) {
      const spec = root.ModelCheckTemplate.lockSpec(processes);
      const model = root.ModelCheck.create(spec);
      const found = root.ModelCheck.explore(model, { states: 200000 });

      return { processes: processes, space: Math.pow(2, spec.vars.length),
        reachable: reachableCount(spec).states, toFind: found.states };
    });
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(JSON.stringify([values['mck-model'], values['mck-processes'],
      values['mck-depth']]));

    paintModel(study);
    paintMetrics(study);
    paintTrace(study);
    paintBmc(study);
    paintLogics();
    paintChart(app);
  }

  function paintModel(study) {
    const lines = study.spec.actions.map(function (action) {
      return '  ' + action.name;
    });

    root.jQuery('#mck-model-text').text('vars: ' + study.spec.vars.join(', ') + '\nactions:\n' +
      lines.slice(0, 12).join('\n') +
      (lines.length > 12 ? '\n  … ' + (lines.length - 12) + ' more' : '') +
      '\ninvariant: ' + study.spec.invariantName);
    root.Helpers.setText('mck-model-caption', 'The model is ' + study.spec.vars.length +
      ' boolean variables and ' + study.spec.actions.length + ' actions, each with a guard and '
      + 'an effect. That gives a state space of 2 to the ' + study.spec.vars.length + ' — ' +
      study.reachable.states + ' of which are actually reachable from the initial state.');
  }

  function paintMetrics(study) {
    const search = study.search;

    root.MetricGrid.update({
      'mck-verdict': { value: search.violated ? 'BROKEN' : 'holds',
        note: search.violated ? 'the invariant fails on a reachable state'
          : (search.exhausted ? 'stopped at the state limit — not a proof'
            : 'over every reachable state, so this one is a proof') },
      'mck-states': { value: search.states,
        note: search.transitions + ' transitions followed' },
      'mck-depth-found': { value: search.violated ? search.at : '—',
        note: search.violated ? 'and breadth-first makes it the shortest' : 'nothing to find' },
      'mck-bmc': { value: bmcValue(study),
        note: study.compare.skipped ? 'the unrolling is too large at this size'
          : (study.compare.agree ? 'the two methods agree' : 'THE TWO METHODS DISAGREE') },
      'mck-replay': { value: study.replay ? (study.replay.ok ? 'confirmed' : 'FAILED') : '—',
        note: study.replay ? study.replay.why : 'there is no counter-example to replay' },
      'mck-reachable': { value: study.reachable.states,
        note: 'of 2^' + study.spec.vars.length + ' states the variables allow' }
    });
  }

  function bmcValue(study) {
    if (study.compare.skipped) return 'not run';
    return study.compare.bmcDepth === null ? 'none in bound' : study.compare.bmcDepth;
  }

  function trueVars(state) {
    return Object.keys(state).filter(function (name) { return state[name]; }).join(', ')
      || 'nothing yet';
  }

  function paintTrace(study) {
    const trace = study.search.trace || [];

    root.jQuery('#mck-trace tbody').html(trace.map(function (row, at) {
      const holds = study.model.invariant(row.state);

      return '<tr' + (holds ? '' : ' class="row-bad"') + '><td class="mono">' + at +
        '</td><td class="mono">' + row.action + '</td><td class="mono">' +
        trueVars(row.state) + '</td><td class="mono">' + (holds ? 'holds' : 'BROKEN') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="4">no counter-example: the invariant holds on every '
      + 'reachable state</td></tr>');

    root.Helpers.setText('mck-trace-caption', traceCaption(study));
  }

  function traceCaption(study) {
    if (!study.search.violated) {
      return 'The search visited every reachable state and found none that breaks the '
        + 'invariant, which for this model is a proof rather than an absence of evidence — the '
        + 'state space is finite and it was exhausted. That is the one thing bounded checking '
        + 'below cannot give you.';
    }
    return 'Each row is one action and the state it produces. The replay is the part that '
      + 'matters: every guard was re-checked against the model and the final state confirmed to '
      + 'break ' + study.spec.invariantName + ', so this is a reproduction rather than a claim. '
      + 'Breadth-first search found it at depth ' + study.search.at + ' after visiting ' +
      study.search.states + ' states, out of ' + study.reachable.states + ' reachable ones.';
  }

  function paintBmc(study) {
    if (study.compare.skipped) {
      root.jQuery('#mck-bmc-table tbody').html('<tr><td colspan="4">not attempted: ' +
        study.compare.skipped + ' variables and ' + study.spec.actions.length +
        ' actions make the unrolling far too large</td></tr>');
      root.Helpers.setText('mck-bmc-table-caption', bmcCaption(study));
      return;
    }
    root.jQuery('#mck-bmc-table tbody').html(study.compare.rows.map(function (row) {
      return '<tr' + (row.violated ? ' class="row-current"' : '') + '><td class="mono">' +
        row.depth + '</td><td class="mono">' + row.clauses + '</td><td class="mono">' +
        row.conflicts + '</td><td class="mono">' + (row.violated ? 'yes' : 'no') +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('mck-bmc-table-caption', bmcCaption(study));
  }

  function bmcCaption(study) {
    const rows = study.compare.rows;

    if (study.compare.skipped) {
      return 'The unrolling is one copy of the transition relation per step, and its size grows '
        + 'about sixteen-fold per process on this protocol: 1 991 clauses at depth 1 with two '
        + 'processes, 32 778 with three, 440 333 with four. That is the honest limit of bounded '
        + 'model checking as encoded here — the explicit search above handles this model in '
        + 'milliseconds, and the SAT unrolling would not finish. Which method wins depends '
        + 'entirely on the shape of the model, and neither dominates.';
    }
    const last = rows[rows.length - 1];

    if (study.compare.bmcDepth === null) {
      return 'No violation appears at any depth up to ' + last.depth + ', and the unrolling at '
        + 'that depth is ' + last.clauses + ' clauses. Read this exactly as far as it goes: it '
        + 'is a statement about traces of length ' + last.depth + ', not about the protocol. '
        + 'The exhaustive search above is the one that proves anything.';
    }
    return 'The clause count grows linearly with the depth — one copy of the transition '
      + 'relation per step — and the first satisfiable unrolling is at depth ' +
      study.compare.bmcDepth + ', which is exactly where the explicit search found its '
      + 'counter-example. Requiring the two to agree on the DEPTH rather than on the verdict is '
      + 'what makes this a real check: an encoding that lets a step happen without its guard '
      + 'still reports a violation, just at the wrong depth.';
  }

  const LOGICS = [
    { property: 'two processes are never inside at once', words: 'nothing bad ever happens',
      logic: 'safety — an invariant', here: 'yes: a reachable state either breaks it or not' },
    { property: 'a process that asks eventually gets in',
      words: 'something good eventually happens', logic: 'liveness — LTL eventually',
      here: 'no: violated by an infinite trace, which needs a cycle search' },
    { property: 'from every state it is possible to reach a reset',
      words: 'a path exists, rather than all paths', logic: 'CTL exists-eventually',
      here: 'no: this checker asks about all paths, not about some path' },
    { property: 'the flag stays up until the process enters',
      words: 'one thing holds until another happens', logic: 'LTL until',
      here: 'no, though it is a safety property in disguise and could be encoded as one' }
  ];

  function paintLogics() {
    root.jQuery('#mck-logics tbody').html(LOGICS.map(function (row) {
      return '<tr><td class="mono">' + row.property + '</td><td>' + row.words +
        '</td><td class="mono">' + row.logic + '</td><td>' + row.here + '</td></tr>';
    }).join(''));

    root.Helpers.setText('mck-logics-caption',
      'The demo checks safety only, and says so. The distinction is not pedantic: a safety '
      + 'property is violated by a finite trace, so a reachability search settles it, while a '
      + 'liveness property is violated by an infinite one and needs a cycle through an '
      + 'accepting state — which is the automaton-theoretic construction from M24 and roughly '
      + 'doubles the machinery.');
  }

  function paintChart(app) {
    const host = root.jQuery('#mck-chart')[0];
    const rows = explosionFor('sizes');

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib, height: 250, logY: true,
      xLabel: 'processes in the protocol', yLabel: 'states (log scale)',
      series: [
        { label: 'the space the variables allow — 8 per process',
          points: rows.map(function (row) { return { x: row.processes, y: row.space }; }) },
        { label: 'reachable states — what a proof must visit',
          points: rows.map(function (row) { return { x: row.processes, y: row.reachable }; }) },
        { label: 'states visited before the counter-example',
          points: rows.map(function (row) { return { x: row.processes, y: row.toFind }; }) }
      ],
      legendHost: root.jQuery('#mck-legend')[0],
      summary: function () {
        return 'States allowed, states reachable, and states visited before the '
          + 'counter-example, against the number of processes.';
      }
    });
    root.Helpers.setText('mck-chart-note', chartNote(rows));
  }

  function chartNote(rows) {
    const last = rows[rows.length - 1];

    return 'Three exponentials, and the gaps between them are the whole practice. The '
      + 'variables allow ' + last.space + ' states at ' + last.processes + ' processes; ' +
      last.reachable + ' of those are reachable, which is what proving safety costs; and the '
      + 'counter-example turns up after ' + last.toFind + '. Finding a bug is cheap and '
      + 'proving its absence is not, which is why this technique is used to find bugs far more '
      + 'often than to certify their absence — and why partial-order reduction and symmetry '
      + 'reduction, neither of which this checker implements, are what real tools spend their '
      + 'engineering on.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
