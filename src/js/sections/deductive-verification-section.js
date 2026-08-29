/**
 * Section: Deductive verification.
 *
 * Three stages, and the demo shows all three: an annotated programme, the
 * verification conditions weakest-precondition reasoning turns it into, and
 * what the solver from 32.6 does with each one.
 *
 * Two failures are deliberately kept apart, because collapsing them is what
 * makes a verifier untrustworthy. A condition the solver refutes with a state
 * the programme can really be in is a bug. A condition it refutes only with a
 * fractional state — and whose roundings all satisfy the goal — is the
 * arithmetic being weaker than the programme, and reporting that as a bug
 * would send an engineer to fix code that is correct.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'deductive-verification';
  const ORDER = ['midpoint', 'midpointFixed', 'counting', 'countingWeak', 'max'];
  let panel = null;
  let chart = null;
  let programs = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — from an annotated programme to a proof or a counter-example',
      caption: 'Each arrow throws something away. Weakest-precondition reasoning throws away '
        + 'the programme and keeps a logical claim; the loop cut throws away everything about '
        + 'the loop except its invariant, which is why the invariant has to be written down; '
        + 'and the solver throws away the distinction between integers and rationals, which is '
        + 'why one of its counter-examples may not be a state at all.',
      definition: [
        'flowchart LR',
        'A["annotated programme<br/>preconditions, postconditions, loop invariants"] --> B["weakest precondition<br/>substitute assignments backwards"]',
        'B --> C["verification conditions<br/>assumptions imply a goal — no programme left"]',
        'C --> D["SMT solver<br/>is assumptions AND not-goal satisfiable?"]',
        'D -->|"unsatisfiable"| P["discharged — a proof"]',
        'D -->|"satisfiable"| M["a model: the state where it fails"]',
        'M --> R{"is that state<br/>reachable and integral?"}',
        'R -->|"yes"| BUG["a bug in the programme"]',
        'R -->|"no"| W["a bug in the annotation,<br/>or arithmetic weaker than the programme"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A Hoare triple is the whole framework: if this holds before, and the statement runs, '
        + 'that holds after.** Everything else is machinery for computing one of the three '
        + 'parts from the other two. The interesting direction is backwards — given what must '
        + 'hold afterwards, what must hold before — because that computation is mechanical.',
      '**The weakest precondition of an assignment is substitution.** To make `x <= 10` true '
        + 'after `x = y + 1`, you need `y + 1 <= 10` before it. No search, no solver, no '
        + 'cleverness: rewrite the goal. A whole straight-line block is that substitution '
        + 'applied backwards, statement by statement.',
      '**A verification condition has no programme left in it.** It is "these assumptions imply '
        + 'this goal", and that is the object the solver sees. That separation is why one '
        + 'verifier can serve many languages, and why a failed condition names logic rather '
        + 'than lines — the effort in a usable tool goes into mapping it back.',
      '**Discharging is refuting the negation.** Hand the solver the assumptions together with '
        + 'the NEGATION of the goal: unsatisfiable means the goal follows, and satisfiable '
        + 'comes with a model. That asymmetry is the whole reason to use a solver rather than a '
        + 'checker — a failure arrives with the state in which the programme is wrong.',
      '**A loop is cut at its invariant, and the cut forgets everything else.** Three '
        + 'conditions come out: the invariant holds on entry, the body preserves it, and the '
        + 'invariant with the negated test gives what comes after. Nothing else about the loop '
        + 'survives — which is why leaving the invariant out does not weaken the proof, it '
        + 'removes it.',
      '**The demo shows that removal directly.** The counting loop proves `i >= 0` afterwards '
        + 'in three conditions with the invariant written down, and fails without it with a '
        + 'counter-example at i = -1 — a state the programme cannot reach, produced because the '
        + 'cut threw away the precondition that said so.',
      '**Nothing here infers an invariant, and that is the honest position.** Inference is a '
        + 'research area; the abstract interpretation in 32.2 is one approach to it. A verifier '
        + 'that quietly weakened an invariant it could not prove would be proving a different '
        + 'programme, and the annotation burden is the real reason this technique is used on '
        + 'code where correctness is worth days rather than minutes.',
      '**The frame problem is the other half of the burden.** A specification has to say what a '
        + 'procedure does NOT change, or nothing downstream can be relied on; separation logic '
        + 'exists to make that statement local rather than global, which is what let it scale '
        + 'to heap-manipulating code.',
      '**The solver decides the rationals, so a counter-example may not be a state.** The '
        + 'counting loop\'s preservation condition is refuted at n = 0.5, and no rounding of '
        + 'that refutes it — over the integers `i < n` really does imply `i + 1 <= n`. The demo '
        + 'reports the two cases separately, because "your invariant is wrong" and "my '
        + 'arithmetic is weaker than your programme" are different messages.',
      '**The technique pays exactly where everybody already believes the code is correct.** '
        + 'The binary-search overflow was found by verification decades after the algorithm was '
        + 'considered settled, and the demo reproduces it: the obvious midpoint fails its '
        + 'condition with an integer state, and the rearranged one discharges.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — conditions in, proofs and counter-examples out',
        markup: root.VerifyTemplate.render() },
      diagram: diagram(),
      insight: '**The binary-search overflow was found by verification decades after the '
        + 'algorithm was considered settled, and that is the whole case for the technique: it '
        + 'pays on code everybody believes is correct.** Where it does not pay is equally '
        + 'clear, and worth saying plainly. The annotation burden is real — the counting loop '
        + 'in this demo needs an invariant a human must write, and a realistic function needs '
        + 'several, plus frame conditions saying what it leaves alone. That cost is worth '
        + 'paying for a bounded, sharp-edged, widely-used piece of code: an index calculation, '
        + 'a permission check, a lock-free queue, a serialiser. It is not worth paying for '
        + 'business logic that changes every sprint, and pretending otherwise is how '
        + 'verification efforts die. The second thing to take away is how to read a failure. A '
        + 'verifier that cannot discharge a condition has told you one of three things and you '
        + 'have to work out which: the code is wrong, the annotation is wrong or too weak, or '
        + 'the solver is not strong enough for the arithmetic involved. This demo separates the '
        + 'last one out by rounding the counter-example and re-checking, because the failure '
        + 'mode that wastes the most time is an engineer changing correct code to satisfy a '
        + 'tool whose real complaint was about the rationals. And the third: the proofs are '
        + 'only as good as the specification. A programme that verifies against a postcondition '
        + 'nobody read is a programme with a proof of the wrong thing, which is why the '
        + 'specification section closes this milestone.'
    };
  }

  function render(app) {
    programs = root.VerifyTemplate.build(root.VerifyVc);
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.VerifyTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (name) {
    const program = programs[name];
    const generated = root.VerifyVc.generate(program);
    const rows = generated.vcs.map(function (vc) {
      return { vc: vc, out: root.VerifyVc.discharge(vc) };
    });

    return { name: name, program: program, paths: generated.paths, rows: rows,
      discharged: rows.filter(function (row) { return row.out.discharged; }).length,
      integer: rows.filter(function (row) { return row.out.witness; }).length,
      rational: rows.filter(function (row) { return row.out.rationalOnly; }).length };
  });

  const summaryFor = root.Helpers.memoise(function () {
    return ORDER.map(function (name) {
      const study = studyFor(name);

      return { name: name, total: study.rows.length, discharged: study.discharged };
    });
  });

  function update(app) {
    const study = studyFor(panel.values()['dvf-program']);

    paintSource(study);
    paintMetrics(study);
    paintConditions(study);
    paintDetail(study);
    paintPipeline();
    paintChart(app);
  }

  function paintSource(study) {
    root.jQuery('#dvf-source').text(study.program.source);
    root.Helpers.setText('dvf-source-caption', 'This programme is ' + study.program.about +
      '. Weakest-precondition reasoning turns it into ' + study.rows.length +
      ' verification condition' + (study.rows.length === 1 ? '' : 's') + ' over ' +
      study.paths + ' path' + (study.paths === 1 ? '' : 's') + ', each one a claim with no '
      + 'programme left in it.');
  }

  function paintMetrics(study) {
    const failed = study.rows.length - study.discharged;

    root.MetricGrid.update({
      'dvf-vcs': { value: study.rows.length, note: 'one per assertion, plus three per loop' },
      'dvf-discharged': { value: study.discharged,
        note: study.discharged === study.rows.length ? 'the programme meets its specification'
          : 'the rest come with a state that breaks them' },
      'dvf-failed': { value: failed,
        note: failed ? 'each with a model of the assumptions that falsifies the goal'
          : 'nothing left undischarged' },
      'dvf-integer': { value: study.integer,
        note: study.integer ? 'a real bug: rounding the model still refutes the goal'
          : 'no failure survived rounding to integers' },
      'dvf-rational': { value: study.rational,
        note: study.rational ? 'the arithmetic is weaker than the programme, not the reverse'
          : 'no fractional-only refutations here' },
      'dvf-paths': { value: study.paths, note: 'branches multiply; a loop is cut once' }
    });
  }

  function verdictOf(row) {
    if (row.out.discharged) return 'proved';
    if (row.out.witness) return 'FAILS';
    return 'undecided over the integers';
  }

  function paintConditions(study) {
    root.jQuery('#dvf-vc-table tbody').html(study.rows.map(function (row) {
      const verdict = verdictOf(row);

      return '<tr' + (verdict === 'FAILS' ? ' class="row-bad"' : '') + '><td class="mono">' +
        row.vc.kind + '</td><td class="mono">' + row.out.goal + '</td><td class="mono">' +
        verdict + '</td><td>' + evidenceOf(row) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dvf-vc-table-caption', conditionsCaption(study));
  }

  function evidenceOf(row) {
    if (row.out.discharged) return root.Helpers.escapeHtml(row.out.why);
    if (row.out.witness) return 'an integer state: ' + showModel(row.out.witness);
    return 'only ' + showModel(row.out.model) + ', which is not a state a programme can be in';
  }

  function showModel(model) {
    return Object.keys(model || {}).map(function (name) {
      return name + ' = ' + round(model[name]);
    }).join(', ') || 'no variables';
  }

  function round(value) {
    return Number.isInteger(value) ? value : Number(value.toFixed(4));
  }

  function conditionsCaption(study) {
    if (study.integer) {
      return study.integer + ' condition' + (study.integer === 1 ? '' : 's') + ' here fail' +
        (study.integer === 1 ? 's' : '') + ' with a state the programme can really reach, which '
        + 'is a bug rather than a limitation. This is the binary-search overflow: the '
        + 'precondition allows lo and hi anywhere in the range, and their sum leaves it.';
    }
    if (study.rational) {
      return study.rational + ' condition is refuted only by a fractional state, and no '
        + 'rounding of that state refutes it. Over the integers `i < n` really does imply `i + '
        + '1 <= n`; over the rationals it does not, and n = 0.5 is the witness. That is the '
        + 'arithmetic being weaker than the programme, and calling it a bug would send somebody '
        + 'to change correct code.';
    }
    return 'Every condition is discharged, which means the solver proved that the assumptions '
      + 'together with the negation of each goal are contradictory. That is a proof about every '
      + 'execution, not a test over some of them — and it is exactly as strong as the '
      + 'annotations it started from.';
  }

  function paintDetail(study) {
    const chosen = study.rows.filter(function (row) { return !row.out.discharged; })[0]
      || study.rows[0];
    const model = chosen.out.witness || chosen.out.model || {};
    const rows = chosen.vc.assumptions.map(function (row) {
      return detailRow('may be assumed', root.VerifyVc.showCondition(row),
        root.VerifyVc.holdsAt(row, model));
    });

    rows.push(detailRow('must follow', root.VerifyVc.showCondition(chosen.vc.goal),
      root.VerifyVc.holdsAt(chosen.vc.goal, model)));
    root.jQuery('#dvf-detail tbody').html(rows.join(''));
    root.Helpers.setText('dvf-detail-caption', detailCaption(chosen));
  }

  function detailRow(role, statement, holds) {
    return '<tr><td class="mono">' + role + '</td><td class="mono">' + statement +
      '</td><td class="mono">' + (holds ? 'yes' : 'no') + '</td></tr>';
  }

  function detailCaption(chosen) {
    if (chosen.out.discharged) {
      return 'This condition is discharged, so the third column is about the empty model and '
        + 'says little. The shape is what matters: a list of things that may be assumed and one '
        + 'thing that must follow, with no programme anywhere in it.';
    }
    return 'The third column is the counter-example, checked statement by statement: every '
      + 'assumption holds in it and the goal does not, which is precisely what "this condition '
      + 'is not valid" means. Reading it top to bottom is how you find out whether the fault is '
      + 'in the code, in the annotation, or in the arithmetic.';
  }

  const PIPELINE = [
    { stage: 'annotation', into: 'a programme and what a human believes about it',
      out: 'preconditions, postconditions and loop invariants',
      fails: 'an invariant too weak to prove the postcondition, or a specification nobody read' },
    { stage: 'weakest preconditions', into: 'the annotated programme',
      out: 'one logical claim per assertion, plus three per loop',
      fails: 'silently, if the loop cut keeps something it should have forgotten' },
    { stage: 'discharge', into: 'assumptions and the negation of a goal',
      out: 'unsatisfiable — a proof — or a model of the failure',
      fails: 'a theory weaker than the programme: a fractional counter-example to an integer claim' },
    { stage: 'reporting', into: 'the solver\'s answer',
      out: 'a proved condition, a bug, or a question about the annotation',
      fails: 'by conflating those three, which is how engineers learn to ignore a verifier' }
  ];

  function paintPipeline() {
    root.jQuery('#dvf-pipeline tbody').html(PIPELINE.map(function (row) {
      return '<tr><td class="mono">' + row.stage + '</td><td>' + row.into + '</td><td>' +
        root.Helpers.escapeHtml(row.out) + '</td><td>' +
        root.Helpers.escapeHtml(row.fails) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dvf-pipeline-caption',
      'The last row is the one that decides whether a verifier gets used. A tool that reports '
      + '"could not prove" for all three reasons trains its users to ignore it, because two of '
      + 'the three are not their fault and only one is worth acting on.');
  }

  function paintChart(app) {
    const host = root.jQuery('#dvf-chart')[0];
    const rows = summaryFor('all');

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 240,
      xLabel: 'programme', yLabel: 'verification conditions',
      values: rows.reduce(function (out, row, index) {
        out.push({ label: row.name + ' · all', value: row.total, series: 0 });
        out.push({ label: row.name + ' · proved', value: row.discharged, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('dvf-chart-note', chartNote(rows));
  }

  function chartNote(rows) {
    const by = {};

    rows.forEach(function (row) { by[row.name] = row; });
    return 'Two bars per programme: the conditions generated and the ones proved. The counting '
      + 'loop generates ' + by.counting.total + ' where the same loop without an invariant '
      + 'generates ' + by.countingWeak.total + ' — fewer conditions and no proof, which is the '
      + 'shape of the annotation burden: writing an invariant makes the verifier ask you MORE '
      + 'questions, and answering them is what a proof is. The midpoint pair is the other '
      + 'lesson: one condition each, and the only difference between them is where the '
      + 'parentheses go.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
