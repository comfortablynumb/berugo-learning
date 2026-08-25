/**
 * Section: Combinatory logic and compilation.
 *
 * The measurement is the size table. `λa b c d. a b c d` is eleven nodes as a
 * lambda term, one hundred and seven after the plain four-case algorithm, and
 * one after Schönfinkel's two optimisations — a ratio of 107. That is the
 * blow-up combinator compilation is famous for, and the two rewrite rules that
 * remove it, both as numbers rather than as folklore.
 *
 * The check that keeps it honest is the agreement table: every fixture is
 * applied to the same arguments as a lambda term and as a combinator term, and
 * the two normal forms are compared by α-equivalence.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'combinatory-logic-and-compilation';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  const ARGUMENTS = { nothing: [], 'one argument': ['p'],
    'two arguments': ['p', 'q'], 'three arguments': ['p', 'q', 'r'] };

  function diagram() {
    return {
      title: 'Diagram — bracket abstraction eliminating one variable',
      caption: 'Four cases, and each one is forced by what the result has to do when it is ' +
        'finally applied. If the body IS the variable, the answer is the identity. If the body ' +
        'never mentions the variable, the answer must ignore its argument, which is K. If the ' +
        'body is an application, both halves may need the variable, so S hands the argument to ' +
        'both and applies the results. A nested lambda is handled from the inside out, because ' +
        'the inner binder has to be gone before the outer one can be. The two optimisations at ' +
        'the bottom are what keep the output from exploding.',
      definition: [
        'graph TD',
        'A["eliminate x from a term"] --> B{"what is the term?"}',
        'B -->|"x itself"| C["I"]',
        'B -->|"x does not occur"| D["K e"]',
        'B -->|"an application a b"| E["S (eliminate x from a) (eliminate x from b)"]',
        'B -->|"a nested λ"| F["eliminate the inner binder first, then x"]',
        'E --> G{"optimise?"}',
        'G -->|"S (K a) (K b)"| H["K (a b)"]',
        'G -->|"S (K a) I"| I["a — this is η"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A combinator is a closed term: no free variables, so nothing to capture.** S, K and I ' +
        'are three of them, and every lambda term is equal to some combination of just those ' +
        'three. That is a strong claim and the demo checks it by compiling terms and comparing ' +
        'normal forms, not by asserting it.',
      '**Bracket abstraction is the compiler, and it has four cases.** `λx. x` becomes I. ' +
        '`λx. e` where e never mentions x becomes `K e`. `λx. (a b)` becomes ' +
        '`S (λx. a) (λx. b)` — hand the argument to both halves. A nested lambda is eliminated ' +
        'from the inside out. The algorithm terminates because every case makes the body ' +
        'strictly smaller or removes a binder.',
      '**S is the interesting one, because it is the only rule that duplicates.** `S x y z` ' +
        'becomes `x z (y z)`: the argument z appears twice on the right. That duplication is ' +
        'exactly why the naive translation blows up, and it is also why graph reduction — ' +
        'sharing one node between both occurrences rather than copying — was the engineering ' +
        'answer in the combinator machines of the 1980s.',
      '**Schönfinkel\'s two optimisations are the whole difference between usable and absurd.** ' +
        '`S (K a) (K b) → K (a b)` says: if neither half needs the argument, do not thread it ' +
        'through either. `S (K a) I → a` says: if the left half ignores it and the right half ' +
        'is the argument itself, the result is just the left half — which is η-reduction, ' +
        'arriving here as an optimisation rather than as a philosophical point.',
      '**Graph reduction is the execution model, and it is mechanical in a way β-reduction is ' +
        'not.** The spine is the chain of applications down the left. Walk to the head, count ' +
        'the arguments, and if the head is a combinator with that arity, fire its rule. There is ' +
        'no substitution, no renaming, no free-variable computation — which is precisely why it ' +
        'was attractive to build in hardware.',
      '**BCKW is the same idea with the roles separated.** B composes, C swaps two arguments, ' +
        'K discards and W duplicates. Curry\'s point was that these four correspond exactly to ' +
        'the structural rules of logic — exchange, weakening and contraction — which is the ' +
        'thread this milestone picks up again in the section on ownership.',
      '**Point-free style is bracket abstraction done by hand, and it has the same cost.** ' +
        'Removing the named arguments from a definition produces something shorter to read only ' +
        'when the composition happens to be simple; the demo\'s size table is what happens when ' +
        'it is not. A four-argument function compiles to 107 nodes without the optimisations, ' +
        'and no reader would prefer it.',
      '**The practical descendant is closure conversion, not point-free style.** A compiler ' +
        'turning a nested function into a top-level one plus a captured environment is doing ' +
        'this job: eliminating a variable that is not in scope at the definition site by ' +
        'passing it explicitly. The size blow-up here is the same blow-up a compiler manages ' +
        'with an environment record instead of duplicated S nodes.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — compile a term to combinators, then run it',
        markup: root.CombinatorsTemplate.render()
      },
      diagram: diagram(),
      insight: '**Combinators are the proof that variables are syntactic sugar, and the size ' +
        'table is the proof that sugar is worth having.** The translation is total and ' +
        'mechanical: every binding construct in every language you use could in principle be ' +
        'compiled away into a fixed set of closed operators. What stops anyone from doing it is ' +
        'in the last column of the blow-up table — the plain algorithm turns eleven nodes into ' +
        'one hundred and seven, and the optimised one only rescues the cases where a pattern ' +
        'happens to match. Real compilers make the same trade in the other direction: they keep ' +
        'names, and pay for them with an environment record and a scope analysis. Knowing that ' +
        'both are available, and what each costs, is what lets you read a closure-conversion ' +
        'pass and recognise what it is doing.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.CombinatorsTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const compileFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const term = root.LambdaEngine.parse(parts[0]);
    const compiled = root.Combinators.compileWithSteps(term, parts[1] === 'on');

    return { term: term, compiled: compiled, lambdaSize: root.LambdaEngine.size(term) };
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const state = compileFor(parts[0] + '\n' + parts[1]);
    const args = ARGUMENTS[parts[2]].map(root.LambdaEngine.parse);
    const applied = args.reduce(function (acc, arg) {
      return root.LambdaEngine.apply(acc, arg);
    }, state.compiled.term);
    const lambdaApplied = args.reduce(function (acc, arg) {
      return root.LambdaEngine.apply(acc, arg);
    }, state.term);

    return { combinator: root.Combinators.reduce(applied, 4000),
      lambda: root.LambdaEngine.reduce(lambdaApplied, 'normal',
        { budget: 4000, traceLimit: 0 }) };
  });

  const agreementFor = root.Helpers.memoise(function () {
    return root.Combinators.fixtures().map(function (source) {
      return root.Combinators.agrees(source, ['p', 'q', 'r'], 4000);
    });
  });

  const blowupFor = root.Helpers.memoise(function () {
    return root.Combinators.sizeComparison(root.Combinators.fixtures()
      .concat(['λa b c d. a b c d']));
  });

  function update() {
    const values = panel.values();
    const key = values['cmb-term'] + '\n' + values['cmb-optimise'];
    const state = compileFor(key);
    const run = runFor(key + '\n' + values['cmb-args']);

    paintMetrics(state, run);
    paintOutput(state);
    paintSteps(state);
    paintTrace(run, values['cmb-args']);
    paintAgreement();
    paintBlowup();
    paintRules();
  }

  function paintMetrics(state, run) {
    const same = root.LambdaEngine.alphaEqual(run.combinator.term, run.lambda.term);

    root.MetricGrid.update({
      'cmb-size': { value: root.Format.exact(state.compiled.size) + ' nodes',
        note: 'from ' + root.Format.exact(state.lambdaSize) +
          ' in the lambda term, with ' + state.compiled.combinators + ' combinators' },
      'cmb-blowup': { value: root.Format.fixed(state.compiled.size / state.lambdaSize, 2) + '×',
        note: state.compiled.size <= state.lambdaSize
          ? 'the compiled term is no larger — the optimisations collapsed it'
          : 'each S distributes the argument into both halves of an application' },
      'cmb-steps': { value: root.Format.exact(run.combinator.steps),
        note: 'against ' + root.Format.exact(run.lambda.steps) +
          ' β-steps for the same reduction in the lambda calculus' },
      'cmb-agree': { value: same ? 'yes' : 'NO',
        note: same ? 'the two normal forms are α-equivalent, compared as terms'
          : 'the compilation changed the meaning — this is a bug' }
    });
  }

  function paintOutput(state) {
    root.jQuery('#cmb-output').html(
      '<div>λ-term &nbsp; ' + root.Helpers.escapeHtml(root.LambdaEngine.show(state.term)) +
      '</div><div style="margin-top:.4rem">combinators &nbsp; ' +
      root.Helpers.escapeHtml(state.compiled.text) + '</div>');

    root.Helpers.setText('cmb-output-caption',
      'There is not a single variable in the second line. Every name in the source has been ' +
      'replaced by the plumbing that moves arguments to where they were used — which is the ' +
      'claim that binding is sugar, made concrete on this term rather than argued in general.');
  }

  function paintSteps(state) {
    root.jQuery('#cmb-steps-table tbody').html(state.compiled.steps.map(function (step, index) {
      return '<tr><td class="mono">' + (index + 1) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(step.rule) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(step.result.slice(0, 60)) + '</td></tr>';
    }).join('') || '<tr><td colspan="3">no steps — the term has no binders to eliminate</td></tr>');

    root.Helpers.setText('cmb-steps-caption',
      'Read the rule column downwards and the algorithm is fully visible: each row is one of ' +
      'the four cases, applied to one subterm. Switch the optimisations off and the S rows ' +
      'multiply — that is the whole story of why the plain algorithm is exponential in the ' +
      'nesting depth of the abstractions.');
  }

  function paintTrace(run, args) {
    root.jQuery('#cmb-trace').html(args === 'nothing'
      ? '<p class="note">Nothing to reduce: choose some arguments to apply the compiled ' +
        'term to.</p>'
      : root.DerivationView.traceMarkup(run.combinator.trace.map(function (entry) {
        return { step: entry.step, term: entry.term, rule: 'size ' + entry.size };
      }), { limit: 20 }));

    root.Helpers.setText('cmb-trace-caption',
      'Graph reduction walks to the head of the spine, counts the arguments sitting to its ' +
      'right, and fires the rule if there are enough. No substitution happens and no name is ' +
      'ever renamed — the capture problem that dominates the previous section simply does not ' +
      'exist here, because there is nothing to capture. That is what buying away variables buys.');
  }

  function paintAgreement() {
    const rows = agreementFor('all');
    const agreeing = rows.filter(function (row) { return row.agree; }).length;

    root.jQuery('#cmb-agreement tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.source) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.compiled.slice(0, 26)) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.lambdaResult.slice(0, 22)) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.combinatorResult.slice(0, 22)) +
        '</td><td>' + (row.agree ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('cmb-agreement-caption',
      'Each fixture is applied to the same three arguments twice — once as the original lambda ' +
      'term reduced under normal order, once as the compiled combinator term reduced by graph ' +
      'reduction — and the two normal forms are compared by α-equivalence rather than by ' +
      'string. All ' + agreeing + ' of ' + rows.length + ' agree. Comparing strings would pass ' +
      'here too and would quietly fail the moment a binder needed renaming, which is exactly ' +
      'the kind of test that stops being a test.');
  }

  function paintBlowup() {
    const rows = blowupFor('rows');
    const worst = rows.slice().sort(function (a, b) { return b.ratio - a.ratio; })[0];

    root.jQuery('#cmb-blowup-table tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.source) +
        '</td><td class="mono">' + row.original + '</td><td class="mono">' + row.naive +
        '</td><td class="mono">' + row.optimised + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 1) + '×</td></tr>';
    }).join(''));

    root.Helpers.setText('cmb-blowup-caption',
      'The worst row here is ' + root.Helpers.escapeHtml(worst.source) + ': ' + worst.original +
      ' nodes as a lambda term, ' + root.Format.exact(worst.naive) + ' after the plain ' +
      'four-case algorithm, and ' + worst.optimised + ' with the two optimisations — a factor ' +
      'of ' + root.Format.fixed(worst.ratio, 0) + '. The plain algorithm distributes an S over ' +
      'every application inside every abstraction, and nested abstractions multiply, so the ' +
      'growth is exponential in the nesting depth. Two rewrite rules remove almost all of it.');
  }

  function paintRules() {
    root.jQuery('#cmb-rules tbody').html(Object.keys(root.Combinators.COMBINATORS)
      .map(function (name) {
        const entry = root.Combinators.COMBINATORS[name];

        return '<tr><td class="mono">' + name + '</td><td class="mono">' + entry.arity +
          '</td><td class="mono">' + root.Helpers.escapeHtml(entry.rule) + '</td><td>' +
          root.Helpers.escapeHtml(entry.reads) + '</td></tr>';
      }).join(''));

    root.Helpers.setText('cmb-rules-caption',
      'S and K alone are enough — I is `S K K`, and the demo would work without it. B, C and W ' +
      'are the BCKW basis: compose, swap, and duplicate. Curry noticed that K and W are exactly ' +
      'the structural rules of logic, weakening and contraction; drop them and you get the ' +
      'linear calculus that the ownership section is built on. The same three letters keep ' +
      'showing up because they are the same three ideas.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
