/**
 * Section: Denotational and axiomatic semantics.
 *
 * The measurement is the pair of columns in the sweep. `sumNoBound` and
 * `sumTooWeak` run the same program as `sum` — every concrete execution ends
 * in the postcondition — and their proofs fail, each on a named verification
 * condition with a state that falsifies it. A wrong invariant does not break
 * the program; it breaks the argument, and the checker distinguishes the two.
 *
 * The other measurement is the honest limit: nothing here is an SMT solver.
 * Every condition is checked by enumerating a bounded domain, so a failure is
 * decisive and a success is "valid over this many states" — which is why
 * `divisionNoBound` verifies over [0, 6] and fails the moment the domain can
 * express a negative remainder.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'denotational-and-axiomatic-semantics';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the while rule and the three conditions it generates',
      caption: 'Weakest preconditions are computed backwards and every construct has an ' +
        'answer, except one. `wp` of a loop would be an infinite disjunction — "zero ' +
        'iterations get me there, or one does, or two do" — so the rule refuses to compute it ' +
        'and demands an invariant instead. In exchange it emits three finite obligations: the ' +
        'invariant holds when the loop is first reached, the body preserves it, and the ' +
        'invariant together with a failed test is enough for the postcondition. The middle one ' +
        'catches an invariant that is not actually invariant; the third catches one that is ' +
        'true but too weak to conclude anything. Both failures are common and they mean quite ' +
        'different things.',
      definition: [
        'graph TD',
        'A["{P} while B do C {Q}, with invariant I"] --> B["1. entry: P ⇒ I"]',
        'A --> C["2. preservation: I ∧ B ⇒ wp(C, I)"]',
        'A --> D["3. exit: I ∧ ¬B ⇒ Q"]',
        'B --> E["fails: the invariant was not true to begin with"]',
        'C --> F["fails: the body breaks it — it is not invariant"]',
        'D --> G["fails: it is true but too weak to give you Q"]',
        'E --> H["all three hold: the triple is proved, for partial correctness"]',
        'F --> H',
        'G --> H'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A Hoare triple `{P} c {Q}` is a claim about partial correctness, and the word ' +
        '"partial" is load-bearing.** It says: start anywhere satisfying P, run c, and IF it ' +
        'terminates you land in Q. A program that loops forever satisfies every triple. Total ' +
        'correctness needs a separate argument — a variant, a quantity that decreases and ' +
        'cannot go below zero.',
      '**The weakest precondition turns proving into computing, and it runs backwards.** ' +
        '`wp(c, Q)` is the weakest predicate that guarantees Q afterwards, and the triple holds ' +
        'exactly when `P ⇒ wp(c, Q)`. Assignment is the rule that looks upside down: ' +
        '`wp(x := e, Q)` is Q with e substituted for x, which is right precisely because we are ' +
        'reasoning from the end.',
      '**Sequencing composes and conditionals split, which is where the formula grows.** ' +
        '`wp(c₁; c₂, Q)` is `wp(c₁, wp(c₂, Q))`. `wp(if B then c₁ else c₂, Q)` is ' +
        '`(B ⇒ wp(c₁, Q)) ∧ (¬B ⇒ wp(c₂, Q))` — both branches contribute, so the formula ' +
        'doubles at each nesting level. The demo measures that growth, and it is why real ' +
        'verifiers pass to a solver in single-assignment form instead of building this text.',
      '**The loop invariant is where all the human work goes, and it carries the whole proof.** ' +
        '`wp` cannot compute it, so you state it, and three obligations check that stating it ' +
        'was enough. Everything else in axiomatic semantics is mechanical; this one step is ' +
        'not, and it is the step that requires understanding the loop.',
      '**A wrong invariant fails at a specific condition, and which one tells you what is ' +
        'wrong.** Preservation failing means the body breaks it — the invariant is simply not ' +
        'invariant. Exit failing means it is true throughout and still too weak to give you the ' +
        'postcondition. The demo shows both, with a state that falsifies each and the exact ' +
        'conjunct that is false in that state.',
      '**A failed proof is not a failed program, and conflating the two wastes days.** The ' +
        'sweep runs every program concretely as well as proving it, and two rows have a broken ' +
        'proof with no failing execution anywhere in the domain. Those programs are correct; ' +
        'their invariants are not strong enough to show it. The fix is to strengthen the ' +
        'invariant, not to change the code.',
      '**Denotational semantics answers the same questions with a mathematical object instead ' +
        'of a rule set.** A program denotes a function from states to states, recursion is a ' +
        'least fixed point, and ⊥ is the denotation of non-termination. That is where "a loop ' +
        'is the limit of its finite unrollings" is made precise, and it is the reason ' +
        'non-termination has to be an element of the domain rather than an absence.',
      '**Everything here is bounded, and the section says so at every number it prints.** There ' +
        'is no decision procedure in this page: each condition is checked by enumerating all ' +
        'states in a small integer range. A counterexample is conclusive; a clean run means ' +
        '"no counterexample in this many states". `divisionNoBound` is the demonstration — it ' +
        'passes over the non-negative range and fails as soon as the range can express a ' +
        'negative remainder.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — annotate a program, and watch the conditions be discharged',
        markup: root.HoareTemplate.render()
      },
      diagram: diagram(),
      insight: '**Writing the loop invariant is the same act as understanding the loop, which ' +
        'is why the question "what is true every time round?" is the most productive thing to ' +
        'ask in a code review.** You do not need a verifier to get the benefit. Ask it of a ' +
        'loop and one of three things happens: someone states it immediately and the loop is ' +
        'fine; someone states it and it turns out to be false on the first or last iteration, ' +
        'which is where off-by-one bugs live; or nobody can state it at all, and that loop is ' +
        'where the bug is. The third case is the valuable one. A loop whose invariant nobody ' +
        'can articulate is a loop nobody understands, and the fact that it currently passes its ' +
        'tests is a statement about the tests. Writing the invariant down as a comment costs a ' +
        'line and makes the next person\'s change safe.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.HoareTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function domainOf(values) {
    const low = Number(values['hoa-low']);
    const high = Math.max(low + 2, Number(values['hoa-high']));

    return { low: low, high: high };
  }

  const verifyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.VerifyLab.verify(parts[0], { low: Number(parts[1]), high: Number(parts[2]) });
  });

  const testFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.VerifyLab.test(parts[0], { low: Number(parts[1]), high: Number(parts[2]) });
  });

  const sweepFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const domain = { low: Number(parts[0]), high: Number(parts[1]) };

    return root.VerifyLab.programNames().map(function (name) {
      return { name: name, note: root.VerifyLab.PROGRAMS[name].note,
        verify: root.VerifyLab.verify(name, domain),
        test: root.VerifyLab.test(name, domain) };
    });
  });

  const blowupFor = root.Helpers.memoise(function () {
    return root.VerifyLab.blowupTable(7);
  });

  function update() {
    const values = panel.values();
    const domain = domainOf(values);
    const key = values['hoa-program'] + '\n' + domain.low + '\n' + domain.high;
    const state = verifyFor(key);
    const runs = testFor(key);

    paintMetrics(state, runs, domain);
    paintSource(state);
    paintObligations(state, domain);
    paintRuns(runs);
    paintSweep(domain.low + '\n' + domain.high);
    paintBlowup();
  }

  function paintMetrics(state, runs, domain) {
    root.MetricGrid.update({
      'hoa-proved': { value: state.proved ? 'yes' : 'no',
        note: state.proved
          ? 'no state in [' + domain.low + ', ' + domain.high + '] falsifies any condition'
          : state.failing.join(' and ') + ' failed, with a counterexample below' },
      'hoa-obligations': { value: root.Format.exact(state.obligations.length),
        note: 'total formula size ' + root.Format.exact(state.totalSize) + ' nodes' },
      'hoa-states': { value: root.Format.exact(state.states),
        note: 'every assignment of every variable in the domain, enumerated' },
      'hoa-runs': { value: root.Format.exact(runs.runs),
        note: runs.failures.length === 0
          ? 'every one ended in the postcondition'
          : runs.failures.length + ' ended outside it' }
    });
  }

  function paintSource(state) {
    root.jQuery('#hoa-source').text('{ ' + state.pre + ' }\n' + state.source +
      '\n{ ' + state.post + ' }');

    root.Helpers.setText('hoa-source-caption', state.note +
      '. The precondition and postcondition are the specification; the invariant inside the ' +
      'loop is the proof. Note what the specification does NOT say: nothing about how long it ' +
      'takes, and nothing about termination. A triple is a partial-correctness claim, and a ' +
      'program that never finishes satisfies every one of them.');
  }

  function paintObligations(state, domain) {
    root.jQuery('#hoa-obligations-table tbody').html(state.obligations.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' +
        root.Helpers.escapeHtml(row.reads) + '</td><td>' + (row.valid ? 'yes' : 'NO') +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.counterexampleText) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.blame || '—') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('hoa-obligations-caption',
      'Each row is one formula, checked over every state in [' + domain.low + ', ' +
      domain.high + ']. The last two columns are what makes a failure actionable: a state that ' +
      'falsifies the condition, and the smallest conjunct that is false in it. Without them a ' +
      'failed proof is a wall of symbols; with them you can read off exactly which fact your ' +
      'invariant forgot to carry. Note that the exit condition does not get to use the ' +
      'precondition — the invariant has to carry forward everything the postcondition needs, ' +
      'which is why so many first attempts fail there.');
  }

  function paintRuns(runs) {
    root.jQuery('#hoa-runs-table tbody').html(
      '<tr><td class="mono">' + root.Format.exact(runs.runs) + '</td><td class="mono">' +
      root.Format.exact(runs.runs - runs.failures.length - runs.nonTerminating) +
      '</td><td class="mono">' + root.Format.exact(runs.nonTerminating) +
      '</td><td class="mono">' + (runs.firstFailure
        ? root.Helpers.escapeHtml(runs.firstFailure.start + ' → ' + runs.firstFailure.end)
        : '—') + '</td></tr>');

    root.Helpers.setText('hoa-runs-caption',
      'This row is produced by executing the program, not by reasoning about it: every start ' +
      'state in the domain that satisfies the precondition is run, and the final state is ' +
      'tested against the postcondition. It is deliberately independent of the proof, because ' +
      'that is the only way to notice the two disagreeing — and where they disagree, one of ' +
      'them is wrong and the section has to say which.');
  }

  function paintSweep(key) {
    const rows = sweepFor(key);

    root.jQuery('#hoa-sweep tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' +
        (row.verify.proved ? 'proved' : 'failed') + '</td><td class="mono">' +
        (row.verify.failing.join(', ') || '—') + '</td><td>' +
        (row.test.failures.length === 0 ? row.test.runs + ' runs, all correct'
          : row.test.failures.length + ' runs ended wrong') + '</td><td>' +
        root.Helpers.escapeHtml(verdict(row)) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('hoa-sweep-caption', sweepCaption(rows));
  }

  function verdict(row) {
    const proved = row.verify.proved;
    const runsFine = row.test.failures.length === 0;

    if (proved && runsFine) return 'correct, and shown to be';
    if (!proved && !runsFine) return 'a real bug — the proof failed and so did the program';
    if (!proved && runsFine) return 'a correct program with an invariant too weak to prove it';
    return 'the proof passed and execution did not — one of the two is broken';
  }

  function sweepCaption(rows) {
    const weak = rows.filter(function (row) {
      return !row.verify.proved && row.test.failures.length === 0;
    });
    const broken = rows.filter(function (row) {
      return row.verify.proved && row.test.failures.length > 0;
    });

    return 'Nine programs, each proved and separately executed. ' + weak.length +
      ' of them are correct programs whose proofs fail — the invariant is too weak, the code ' +
      'is fine, and mistaking that for a bug is how an afternoon disappears. ' + broken.length +
      ' rows have a proof that passed while execution failed, which would mean the verifier ' +
      'itself is wrong; that column existing is the point of running both. Note also that ' +
      '`swapNoTemp` and `maxWrong` fail in both columns, which is what a genuine defect looks ' +
      'like here.';
  }

  function paintBlowup() {
    const rows = blowupFor('rows');

    root.jQuery('#hoa-blowup tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.depth + '</td><td class="mono">' +
        root.Format.exact(row.size) + '</td><td class="mono">' +
        (row.depth === 1 ? '—' : root.Format.fixed(row.ratio, 2) + '×') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('hoa-blowup-caption',
      'Each nested conditional roughly doubles the weakest precondition, because both branches ' +
      'contribute an implication and the postcondition is duplicated into each. Seven levels ' +
      'of nesting reach ' + root.Format.exact(rows[rows.length - 1].size) + ' nodes from ' +
      rows[0].size + '. A real program has far more than seven branches, which is why no ' +
      'production verifier builds this formula: they convert to single-assignment form first, ' +
      'so each branch is named once and shared rather than copied, and hand the result to an ' +
      'SMT solver. The blow-up here is what that engineering avoids.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
