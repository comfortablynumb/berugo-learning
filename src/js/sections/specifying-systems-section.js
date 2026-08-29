/**
 * Section: Specifying and verifying systems.
 *
 * The specification is data — named variables, actions written as "when these
 * hold, set those", invariants written as implications — and everything else
 * follows from that. It prints as a table somebody will read, it compiles to
 * the checker from 32.7, and the counter-example comes back naming actions
 * rather than bit patterns.
 *
 * The two pairs are the argument. Two-phase commit with the coordinator
 * allowed to fail produces the blocking scenario in four steps; with no
 * failure modelled it is spotless, which is the commonest way a model lies.
 * A retry with no idempotence key applies the request twice in five steps; the
 * same protocol with a key does not. Neither finding is subtle, and both are
 * findings a room full of engineers can have before any code exists.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'specifying-systems';
  const ORDER = ['twoPhase', 'twoPhaseSafe', 'retry', 'retryKeyed'];
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
      title: 'Diagram — the specification, the model, the implementation, and what connects them',
      caption: 'Three artefacts and two obligations. The model checker discharges the left one '
        + 'mechanically and completely; the right one — that the implementation refines the '
        + 'specification — is the hard obligation, and in industry it is usually discharged by '
        + 'review, by conformance testing, or by nothing at all. Knowing which of the two you '
        + 'have is the difference between a proof and a comfortable feeling.',
      definition: [
        'flowchart LR',
        'S["the specification<br/>what the system must do"] --> M["the model<br/>variables, actions, invariants"]',
        'M --> C["the model checker<br/>every reachable state"]',
        'C -->|"a counter-example"| B["a design bug, before any code"]',
        'C -->|"nothing"| P["the model satisfies the invariants"]',
        'M -.->|"refinement obligation:<br/>every implementation behaviour<br/>is a model behaviour"| I["the implementation"]',
        'I -.->|"discharged by review,<br/>conformance tests, or nothing"| P'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A specification is worth writing before the code because writing it is where the '
        + 'ambiguities die.** Every industrial report agrees on this and it is the least '
        + 'intuitive finding in the field: the model checker mostly confirms what the act of '
        + 'writing the specification already revealed. Deciding what the variables are forces '
        + 'the questions nobody asked.',
      '**A specification here is data, not code.** Named boolean variables, an initial '
        + 'assignment, actions written as "when these conditions hold, set these variables", '
        + 'and invariants written as "whenever this holds, that must too". Nothing in it is a '
        + 'function, which is what lets it be printed, diffed and reviewed by somebody who will '
        + 'never run it.',
      '**Writing an invariant as an implication is a small decision that matters.** "Whenever '
        + 'the coordinator has committed, both participants had voted" is checkable at every '
        + 'state and reads like a sentence an engineer would say. A bare predicate over the '
        + 'whole state is neither.',
      '**Model what can go wrong, or the model will be spotless and useless.** Two-phase commit '
        + 'with no failure modelled satisfies every invariant over 10 reachable states. Add one '
        + 'action — the coordinator may fail after collecting votes — and the blocking scenario '
        + 'appears in four steps. The difference between the two runs is one action, and it is '
        + 'the whole value of the exercise.',
      '**The counter-example is in the specification\'s vocabulary, and that is not '
        + 'cosmetic.** "prepare, v1, down, stuck1" as a sequence of named actions is a design '
        + 'discussion; the same trace as bit patterns is a puzzle. A specification language '
        + 'earns its keep at exactly this point.',
      '**Small scope is a defensible engineering position rather than a compromise.** These '
        + 'models have two participants and boolean variables, and they find the bug the '
        + 'protocol is famous for. The small-scope hypothesis — almost every protocol bug '
        + 'appears at two or three participants — is why modelling three servers rather than a '
        + 'hundred is the right call.',
      '**Refinement is the obligation nobody discharges mechanically.** Even a proved model '
        + 'says nothing about the code unless every behaviour of the implementation is a '
        + 'behaviour of the model. In industry that gap is closed by review, by conformance '
        + 'testing against the spec, or not at all — and being honest about which is the '
        + 'difference between a proof and a feeling.',
      '**Property-based testing is the executable end of the same idea.** A property is a '
        + 'specification with a generator attached: it says what must hold rather than what one '
        + 'example produces, and it runs against the real implementation, which is exactly what '
        + 'the model cannot do.',
      '**The retry pair is the specification most engineers actually need.** A message can be '
        + 'lost, the client retries, and the server applies the request twice — five steps to '
        + 'the violation. Add one action, remembering the key, and the invariant holds. That '
        + 'is idempotence stated as a property rather than as advice.',
      '**The cost is small and the value is uneven, so pick the target deliberately.** These '
        + 'models are a few dozen lines and check in milliseconds. That is worth it for a '
        + 'protocol whose failures are expensive and hard to reproduce, and it is not worth it '
        + 'for code whose bugs a test would have caught this afternoon.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — four specifications, two of which are wrong',
        markup: root.SpecTemplate.render() },
      diagram: diagram(),
      insight: '**The industrial reports agree on the same finding: the value is in the '
        + 'SPECIFICATION, which forces the ambiguities out, and the model checker mostly '
        + 'confirms what writing the spec already revealed.** That is worth taking seriously '
        + 'because it changes what you would do with an afternoon. The advice is not "learn '
        + 'TLA+ and verify your system"; it is "write down, as data, what your protocol\'s '
        + 'variables are, what actions change them, and what must never be true — and notice '
        + 'how many questions you cannot answer while doing it". Those questions are the '
        + 'finding. The checker is what turns a suspicion into a four-step trace you can put in '
        + 'a design document. The second point is about what to model, and it is where most '
        + 'first attempts go wrong: a model with no failures in it will be clean, and its '
        + 'cleanliness means nothing. Model the crash, the lost message, the duplicate '
        + 'delivery, the slow node — those are the behaviours your tests do not produce and '
        + 'your users will. The third is the limit. A checked model is a statement about the '
        + 'model, and the refinement obligation between it and your code is discharged by '
        + 'review or by conformance testing or by nothing at all. Amazon\'s teams were explicit '
        + 'about this: the models found real bugs in designs that had passed review, and nobody '
        + 'claimed the implementations were therefore correct.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.SpecTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (name) {
    const spec = root.SpecTemplate.SPECS[name].build(root.SpecDsl);

    return { name: name, spec: spec, about: root.SpecTemplate.SPECS[name].about,
      check: root.SpecDsl.check(spec, {}),
      states: root.SpecDsl.states(spec, {}) };
  });

  const summaryFor = root.Helpers.memoise(function () {
    return ORDER.map(function (name) {
      const study = studyFor(name);

      return { name: name, reachable: study.states.reachable, total: study.states.total,
        edges: study.states.edges.length, violated: study.check.violated,
        at: study.check.at };
    });
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(values['spy-spec']);

    paintSpec(study);
    paintMetrics(study);
    paintActions(study);
    paintTrace(study);
    paintStates(study, values['spy-view']);
    paintIndustry();
    paintChart(app);
  }

  function paintSpec(study) {
    const spec = study.spec;
    const lines = ['vars: ' + spec.vars.join(', '),
      'init: everything false',
      'invariants:'].concat(spec.invariants.map(function (row) {
      return '  ' + row.name + ': when ' + row.when.join(' and ') + ' require ' +
        row.require.join(' and ');
    }));

    root.jQuery('#spy-spec-text').text(lines.join('\n'));
    root.Helpers.setText('spy-spec-caption', 'This specification is ' + study.about +
      '. It is ' + spec.vars.length + ' boolean variables and ' + spec.actions.length +
      ' actions, which allows ' + study.states.total + ' states on paper and reaches ' +
      study.states.reachable + '. Nothing in it is a function, so all of it prints.');
  }

  function paintMetrics(study) {
    const check = study.check;

    root.MetricGrid.update({
      'spy-vars': { value: study.spec.vars.length + ' · ' + study.spec.actions.length,
        note: 'variables and actions' },
      'spy-reachable': { value: study.states.reachable,
        note: 'of ' + study.states.total + ' the variables allow' },
      'spy-edges': { value: study.states.edges.length,
        note: 'enabled actions across the reachable states' },
      'spy-verdict': { value: check.violated ? 'BROKEN' : 'hold',
        note: check.violated ? check.broken.name : 'every reachable state satisfies all of them' },
      'spy-depth': { value: check.violated ? check.at : '—',
        note: check.violated ? 'and breadth-first makes it the shortest' : 'nothing to find' },
      'spy-replay': { value: check.replay ? (check.replay.ok ? 'confirmed' : 'FAILED') : '—',
        note: check.replay ? 'every guard re-checked against the spec'
          : 'no counter-example to replay' }
    });
  }

  function paintActions(study) {
    root.jQuery('#spy-actions tbody').html(study.spec.actions.map(function (action) {
      const shown = root.SpecDsl.showAction(action);

      return '<tr><td class="mono">' + shown.name + '</td><td class="mono">' +
        root.Helpers.escapeHtml(shown.when) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(shown.then) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('spy-actions-caption',
      'This table IS the specification — the checker reads the same strings. That is the '
      + 'property worth arguing for: a spec that prints as a table gets reviewed by people who '
      + 'would never run a checker, and the industrial reports say the review is where most of '
      + 'the value comes from.');
  }

  function paintTrace(study) {
    const trace = study.check.trace || [];

    root.jQuery('#spy-trace tbody').html(trace.map(function (row, at) {
      const last = at === trace.length - 1;

      return '<tr' + (last ? ' class="row-bad"' : '') + '><td class="mono">' + row.step +
        '</td><td class="mono">' + row.action + '</td><td class="mono">' +
        (row.changed.join(', ') || '—') + '</td><td class="mono">' +
        (row.holding.join(', ') || 'nothing') + '</td><td class="mono">' +
        (last ? 'BROKEN' : 'holds') + '</td></tr>';
    }).join('') || '<tr><td colspan="5">every reachable state satisfies every invariant, so '
      + 'there is no counter-example</td></tr>');

    root.Helpers.setText('spy-trace-caption', traceCaption(study));
  }

  function traceCaption(study) {
    if (!study.check.violated) {
      return 'Nothing to show, and that is worth being careful about: this specification is '
        + 'clean because of what it does NOT model. Switch to the variant with a failure in it '
        + 'and the same protocol breaks in four steps.';
    }
    return 'The invariant broken here is "' + study.check.broken.name + '", and the trace is in '
      + 'the specification\'s own words rather than in bit patterns. Every guard was re-checked '
      + 'against the spec on the way back, so this is a reproduction rather than a claim — and '
      + 'it is short enough to put in a design document, which is what makes it useful before '
      + 'any code exists.';
  }

  function paintStates(study, view) {
    const rows = study.states.rows.filter(function (row) {
      return view === 'all' || !row.ok;
    });

    root.jQuery('#spy-states tbody').html(rows.slice(0, 14).map(function (row) {
      return '<tr' + (row.ok ? '' : ' class="row-bad"') + '><td class="mono">' + row.key +
        '</td><td class="mono">' + holdingOf(study.spec, row.state) + '</td><td class="mono">' +
        (row.ok ? 'hold' : 'BROKEN') + '</td></tr>';
    }).join('') || '<tr><td colspan="3">no state in this view</td></tr>');

    root.Helpers.setText('spy-states-caption', statesCaption(study, rows));
  }

  function holdingOf(spec, state) {
    return spec.vars.filter(function (name) { return state[name]; }).join(', ') || 'nothing';
  }

  function statesCaption(study, rows) {
    return 'The specification allows ' + study.states.total + ' states on paper and ' +
      study.states.reachable + ' are reachable, of which ' +
      study.states.rows.filter(function (row) { return !row.ok; }).length +
      ' break an invariant. The gap between the two counts is what makes an exhaustive check '
      + 'affordable here, and the reason a real modelling language with integers and sets '
      + 'cannot be checked this way' + (rows.length > 14 ? ' — only the first 14 rows are '
      + 'shown' : '') + '.';
  }

  const INDUSTRY = [
    { system: 'Amazon S3 and DynamoDB', what: 'replication, fault tolerance and the '
      + 'consistency protocols, in TLA+',
    found: 'bugs needing traces of 35 steps that had passed design review and testing',
    cost: 'weeks per specification, and engineers who had not used formal methods before' },
    { system: 'CompCert', what: 'a C compiler, verified in Coq end to end',
      found: 'nothing in the verified middle end, while Csmith found bugs in every other compiler',
      cost: 'years, and a compiler that is slower than the alternatives' },
    { system: 'seL4', what: 'a microkernel, with a proof of functional correctness',
      found: 'over a hundred defects during the proof, most in design rather than code',
      cost: 'roughly twenty person-years for ten thousand lines' },
    { system: 'Azure Cosmos DB and the Paxos family', what: 'the consistency levels and the '
      + 'consensus protocols themselves',
    found: 'ambiguities in published protocols, before any of them reached an implementation',
    cost: 'far less than the outage a wrong consensus protocol produces' }
  ];

  function paintIndustry() {
    root.jQuery('#spy-industry tbody').html(INDUSTRY.map(function (row) {
      return '<tr><td class="mono">' + row.system + '</td><td>' + row.what + '</td><td>' +
        root.Helpers.escapeHtml(row.found) + '</td><td>' +
        root.Helpers.escapeHtml(row.cost) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('spy-industry-caption',
      'The third column is the one to read carefully. In every case the findings were in the '
      + 'DESIGN, found by writing the specification, and in every case the authors were careful '
      + 'not to claim the implementation was therefore correct. That is the honest position, '
      + 'and it is still an enormous return on a few weeks of work.');
  }

  function paintChart(app) {
    const host = root.jQuery('#spy-chart')[0];
    const rows = summaryFor('all');

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 240,
      yLabel: 'states and transitions',
      values: rows.reduce(function (out, row) {
        out.push({ label: row.name + ' · states', value: row.reachable, series: 0 });
        out.push({ label: row.name + ' · edges', value: row.edges, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('spy-chart-note', chartNote(rows));
  }

  function chartNote(rows) {
    const by = {};

    rows.forEach(function (row) { by[row.name] = row; });
    return 'Modelling the coordinator failure takes two-phase commit from ' +
      by.twoPhaseSafe.reachable + ' reachable states to ' + by.twoPhase.reachable + ', and '
      + 'from clean to broken in ' + by.twoPhase.at + ' steps. The retry pair is the same '
      + 'lesson in a smaller space: ' + by.retry.reachable + ' states either way, and the only '
      + 'difference is which action the server takes when it sees a request it has already '
      + 'applied — one applies it twice, the other ignores it. Every one of these checks runs '
      + 'in milliseconds, which is the point: the expensive part of specification is the '
      + 'thinking, not the checking.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
