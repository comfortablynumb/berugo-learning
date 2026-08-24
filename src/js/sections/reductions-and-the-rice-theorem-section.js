/**
 * Section: reductions and the Rice theorem.
 *
 * The measurement is the classification: ten properties, four of them
 * undecidable by Rice and six decidable, and the six are decidable for two
 * quite different reasons that get conflated. "Does it contain a division
 * operator" is decidable because it is SYNTACTIC; "does it compute some
 * function" is decidable because it is TRIVIAL. Neither escape has anything to
 * do with cleverness, and knowing which one your check is using is the whole
 * skill.
 *
 * The reduction builder is the other half: it prints the transformed program,
 * so the reduction is a compiler you can read rather than an arrow in a
 * diagram.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'reductions-and-the-rice-theorem';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a mapping reduction, and the contradiction it produces',
      caption: 'A reduction from halting to some problem P is a program TRANSFORMATION: it ' +
        'takes any program and produces a new one that has property P exactly when the original ' +
        'halts. That equivalence is the whole content, and it is checkable by reading the ' +
        'transformed source. The contradiction then follows in one step: if a decider for P ' +
        'existed, composing it with the transformation would decide halting, and no such thing ' +
        'exists. Note the direction — halting reduces TO P, which makes P at least as hard. ' +
        'Getting it backwards is the commonest error in the subject and produces a proof of ' +
        'nothing.',
      definition: [
        'flowchart LR',
        '    A["a program p"] --> B["transform: build p′ with property P iff p halts"]',
        '    B --> C{"a decider for P"}',
        '    C -->|says yes| D["p halts"]',
        '    C -->|says no| E["p does not halt"]',
        '    D --> F["so we decided halting"]',
        '    E --> F',
        '    F --> G["contradiction: no decider for P exists"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A mapping reduction is a program transformation, and that is the useful way to hold ' +
        'it.** To show problem P is undecidable, write a function that turns any program into ' +
        'another one having property P exactly when the original halts. The demo prints the ' +
        'transformed source, because the equivalence is something you check by reading it.',
      '**The direction matters and is easy to invert.** Reducing halting TO P shows P is at ' +
        'least as hard as halting, which is what you want. Reducing P to halting shows nothing ' +
        'about P — everything reduces to halting. If your argument would still work with the ' +
        'arrows swapped, it is not an argument.',
      '**Rice\'s theorem generalises every one of those reductions at once.** EVERY non-trivial ' +
        'semantic property of programs is undecidable. Non-trivial means some program has it ' +
        'and some does not; semantic means it depends on the function computed rather than on ' +
        'the text. That is a devastating scope, and it is proved by exactly the reduction the ' +
        'demo builds.',
      '**The syntactic escape hatch is the reason any tool works at all.** "Does the source ' +
        'contain a division operator" is decidable, because grep decides it. Rice says nothing ' +
        'about how a program is WRITTEN, and every linter, formatter and type checker lives in ' +
        'that gap — which is why they answer questions about syntax and approximate everything ' +
        'else.',
      '**The trivial escape is real and almost never useful.** "Does this program compute some ' +
        'function" is decidable because the answer is always yes. Rice requires the property to ' +
        'separate at least two programs, and a property that separates none is decided by a ' +
        'constant.',
      '**A bound is the third escape, and it is the one engineering uses.** "Does it halt within ' +
        '10 000 steps" is not a semantic property of the computed function — it is a property ' +
        'of a bounded execution, and it is decided by running it. Every timeout is that.',
      '**Every static analyser is unsound or incomplete, and it chose which.** A SOUND analyser ' +
        'never misses a real problem and therefore reports some false ones; a COMPLETE one never ' +
        'reports a false problem and therefore misses some real ones. Rice says you cannot have ' +
        'both, so a tool that claims both is measuring something syntactic and calling it ' +
        'semantic.',
      '**Knowing which one your tool chose is the difference between trusting a green build and ' +
        'understanding it.** A type checker is sound and rejects programs that would have run ' +
        'fine. A linter is incomplete and stays quiet about real bugs. Both are correct designs ' +
        'and they mean opposite things when they say nothing.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — build a reduction, and read the transformed program',
        markup: root.RiceTemplate.render()
      },
      diagram: diagram(),
      insight: '**Rice\'s theorem is why every static analyser is either unsound or incomplete, ' +
        'and knowing which one your tool chose is the difference between trusting a green build ' +
        'and understanding it.** The practical form is a question to ask of any analysis in your ' +
        'pipeline: when it says nothing, what have you learned? For a sound analysis — a type ' +
        'checker, a borrow checker, a proved-safe subset — silence is a guarantee, paid for with ' +
        'rejected programs that would have been fine. For an incomplete one — most linters, most ' +
        'security scanners, every heuristic — silence means only that this tool did not find ' +
        'anything, which is compatible with the code being catastrophically wrong. Teams get ' +
        'into trouble by treating the second kind as though it were the first, and no amount of ' +
        'improving the tool changes the category it is in.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RiceTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const reductionFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.Undecidability.reduce(Number(parts[0]), parts[1]);
  });

  const classified = root.Helpers.memoise(function () {
    return root.Undecidability.classify();
  });

  function update() {
    const values = panel.values();
    const reduction = reductionFor(values['ric-target'] + '\n' + values['ric-source']);

    paintMetrics(reduction);
    paintTransformed(reduction);
    paintArgument(reduction);
    paintProperties(values['ric-filter']);
    paintReductions();
    paintAnalysers();
  }

  function paintMetrics(reduction) {
    const rows = classified('rows');
    const undecidable = rows.filter(function (row) { return !row.decidable; });
    const semantic = rows.filter(function (row) { return row.semantic; });
    const syntactic = rows.filter(function (row) { return !row.semantic; });

    root.MetricGrid.update({
      'ric-verdict': { value: 'undecidable',
        note: 'a decider for it would decide halting, via the transformation beside this' },
      'ric-undecidable': { value: root.Format.exact(undecidable.length) + ' of ' +
        root.Format.exact(rows.length),
      note: 'every one of them non-trivial and semantic, which is exactly Rice’s condition' },
      'ric-semantic': { value: root.Format.exact(semantic.length),
        note: root.Format.exact(semantic.filter(function (row) { return row.trivial; }).length) +
          ' of those are trivial, and only those are decidable' },
      'ric-escape': { value: root.Format.exact(syntactic.length) + ' syntactic',
        note: 'decidable because they depend on the text rather than on the computed function' }
    });
  }

  function paintTransformed(reduction) {
    root.jQuery('#ric-transformed').text(reduction.transformed);

    root.Helpers.setText('ric-transformed-note',
      'Read the transformed program and check the equivalence yourself: the added line is ' +
      'reached exactly when the code above it finishes. That is all a reduction is — no ' +
      'notation, no arrow, just a source-to-source transformation whose output has the target ' +
      'property under exactly the condition you care about. Every undecidability proof in a ' +
      'compilers course is one of these, dressed up.');
  }

  function paintArgument(reduction) {
    root.jQuery('#ric-argument').html(
      '<div>target: ' + root.Helpers.escapeHtml(reduction.target) + '</div>' +
      '<div style="margin-top:.4rem">equivalence: ' +
      root.Helpers.escapeHtml(reduction.equivalence) + '</div>' +
      '<div style="margin-top:.4rem">consequence: ' +
      root.Helpers.escapeHtml(reduction.consequence) + '</div>');

    root.Helpers.setText('ric-argument-note',
      'The three lines are the whole proof. The equivalence is checkable by reading the ' +
      'transformed source above; the consequence follows because a decider for the target, ' +
      'composed with the transformation, would answer the halting question — and the previous ' +
      'section showed nothing can. Notice that none of this examines the target problem\'s ' +
      'difficulty directly. That is what makes reduction the technique: you prove hardness by ' +
      'borrowing it.');
  }

  function paintProperties(filter) {
    const rows = classified('rows').filter(function (row) {
      if (filter === 'undecidable') return !row.decidable;
      if (filter === 'decidable') return row.decidable;
      return true;
    });

    root.jQuery('#ric-properties tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.name) + '</td><td class="mono">' +
        (row.semantic ? 'yes' : 'no') + '</td><td class="mono">' +
        (row.trivial ? 'yes' : 'no') + '</td><td class="mono">' +
        (row.decidable ? 'yes' : 'NO') + '</td><td>' +
        root.Helpers.escapeHtml(row.note) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ric-properties-note',
      'The two middle columns decide the fourth, mechanically: undecidable exactly when ' +
      'semantic AND non-trivial. What is worth sitting with is how ordinary the undecidable ' +
      'rows look. "Does it ever divide by zero" is a question anybody would put in a ticket, ' +
      'and it has no algorithm — not a slow one, none. The decidable rows are decidable for two ' +
      'unrelated reasons, and the difference matters: a syntactic check is a real tool, and a ' +
      'trivial one is a constant.');
  }

  function paintReductions() {
    root.jQuery('#ric-reductions tbody').html(root.Undecidability.REDUCTIONS
      .map(function (entry) {
        return '<tr><td class="mono">' + root.Helpers.escapeHtml(entry.target) + '</td><td>' +
          root.Helpers.escapeHtml(entry.equivalence) + '</td><td>' +
          root.Helpers.escapeHtml(entry.consequence) + '</td></tr>';
      }).join(''));

    root.Helpers.setText('ric-reductions-note',
      'Five reductions, five consequences, and every consequence is something a working ' +
      'engineer has been asked for. Exact dead-code detection, exact dead-store elimination, ' +
      'verified optimisation, a termination checker: all requested, all impossible, and all ' +
      'approximated in practice by tools that are honest about approximating. The last row is ' +
      'the one worth remembering — totality is strictly harder than halting, being neither ' +
      'recognisable nor co-recognisable, which is why "does this always terminate" has no ' +
      'partial answer at all.');
  }

  function paintAnalysers() {
    const rows = [
      { tool: 'A type checker', gives: 'completeness — it rejects some correct programs',
        reports: 'a definite yes or no, and the no is sometimes wrong about the program',
        cost: 'you rewrite code the checker cannot see is fine' },
      { tool: 'A borrow checker', gives: 'completeness, aggressively',
        reports: 'sound memory safety within its rules',
        cost: 'the same, and it is the deliberate trade Rust made' },
      { tool: 'A linter', gives: 'soundness — it misses real problems',
        reports: 'findings, with silence meaning only that it found none',
        cost: 'a clean run proves nothing, and teams routinely read it as proof' },
      { tool: 'A test suite', gives: 'soundness — it checks the inputs you wrote',
        reports: 'a pass on the cases exercised',
        cost: 'coverage is a proxy for the thing you cannot measure' },
      { tool: 'An abstract interpreter', gives: 'completeness, by over-approximating states',
        reports: 'sound warnings, with false positives from the approximation',
        cost: 'alarm fatigue, which is why the tuning matters more than the engine' },
      { tool: 'A model checker', gives: 'scale — it explores a bounded state space',
        reports: 'sound results within the bound, and nothing outside it',
        cost: 'the bound is the specification, exactly as in bounded halting' },
      { tool: 'A fuzzer', gives: 'soundness — it samples',
        reports: 'crashes it found, never their absence',
        cost: 'time, and the knowledge that not finding one means very little' }
    ];

    root.jQuery('#ric-analysers tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.tool + '</td><td>' + row.gives + '</td><td>' +
        row.reports + '</td><td>' + row.cost + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ric-analysers-note',
      'Read the second column down the table and notice that every entry is a deliberate ' +
      'sacrifice, not a defect. Rice guarantees each tool gives up one of the two, so the ' +
      'question is never "is this tool correct" but "which half did it keep, and does my use of ' +
      'it depend on the other half". The pairing that causes real damage is a linter or a ' +
      'fuzzer read as though it were a type checker: silence from the first three rows is a ' +
      'guarantee, and silence from the last four is an absence of evidence.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
