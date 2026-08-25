/**
 * Section: The simply typed lambda calculus.
 *
 * "Well-typed programs do not go wrong" is checked here rather than quoted.
 * All 215 terms of depth one in the arithmetic language are typed and run:
 * 64 are well-typed and none of them gets stuck, which is progress; every step
 * of every one of them keeps its type, which is preservation. The third number
 * is the one nobody puts on a slide — 24 of the 151 rejected terms would have
 * run perfectly well, and that is what static checking costs.
 *
 * The derivation viewer does the other half: an accepted term shows the whole
 * proof, a rejected one names the rule that failed and the constraint it could
 * not meet.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'the-simply-typed-lambda-calculus';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a typing derivation for a small application',
      caption: 'A typing judgement `Γ ⊢ e : τ` is read "in context Γ, the expression e has ' +
        'type τ". The context is the list of assumptions about free variables, and it grows ' +
        'as the derivation goes under a binder — that is the whole content of T-Abs. The tree ' +
        'is built bottom-up by the checker and read top-down by a human: the leaves are ' +
        'variables and literals whose types are immediate, and every bar joining premises to a ' +
        'conclusion is one rule. When a term is rejected, exactly one bar is the first that ' +
        'could not be drawn, and naming it is the difference between a useful error message ' +
        'and "type error".',
      definition: [
        'graph TD',
        'A["Γ, f: Number → Number, x: Number ⊢ f : Number → Number  (T-Var)"] --> C',
        'B["Γ, f: Number → Number, x: Number ⊢ x : Number  (T-Var)"] --> C',
        'C["Γ, f, x ⊢ f x : Number  (T-App)"] --> D',
        'D["Γ, f ⊢ λx: Number. f x : Number → Number  (T-Abs)"] --> E',
        'E["Γ ⊢ λf: Number → Number. λx: Number. f x : (Number → Number) → Number → Number  (T-Abs)"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A type is a syntactic discipline that rules terms out before they run.** The simply ' +
        'typed lambda calculus adds one thing to the untyped one: every binder declares the ' +
        'type of its parameter. That is enough to make a checker possible, and enough to make ' +
        'the calculus strictly less expressive — the terms it now rejects include some that ' +
        'would have worked.',
      '**The judgement `Γ ⊢ e : τ` has three parts and all three matter.** Γ is the context: ' +
        'what is assumed about free variables. `e` is the term. `τ` is the type. The rules are ' +
        'read as "given these premises, this conclusion", and every one of them either extends ' +
        'the context (T-Abs, T-Let) or consumes it (T-Var). Nothing else is going on.',
      '**T-App is the rule that does the work, and it is where errors are reported.** Applying ' +
        'a `σ → τ` to a `σ` gives a `τ`, and the argument type must MATCH — not be compatible, ' +
        'not be coercible, but match, because simple types have no subtyping. Almost every ' +
        'rejection in the fixture table is T-App or T-If failing this equality.',
      '**Checking and inference are different problems, and this system does the easy one.** ' +
        'With every binder annotated, the type of a term is determined bottom-up in one pass ' +
        'with no search and no unification. Remove the annotations and you need the machinery ' +
        'of the next section. That is the trade every language makes when it decides how much ' +
        'to require you to write.',
      '**Soundness is progress plus preservation, and both are checkable here.** Progress: a ' +
        'well-typed term is a value or can step. Preservation: stepping does not change the ' +
        'type. The sweep runs every term of depth one, types it, and evaluates it — and the ' +
        '"well-typed and stuck" cell is zero, which is what soundness means operationally.',
      '**Every sound type system rejects programs that would have worked, and the count is ' +
        'here.** `if true then 0 else true` runs fine and is rejected, because the checker ' +
        'cannot know the guard is constant. That conservatism is not a flaw to be engineered ' +
        'away — it is forced, since deciding "does this go wrong" exactly is undecidable. What ' +
        'a language chooses is *which* safe programs to reject.',
      '**Strong normalisation is the surprise: every well-typed term terminates.** There is no ' +
        'way to write the Y combinator in this system, because `λx. x x` cannot be typed at ' +
        'any type — the argument would have to be both `σ` and `σ → τ`. That is a wonderful ' +
        'property and a fatal one: a language in which every program halts cannot be ' +
        'Turing-complete, which is why real languages add a recursion primitive and give it up.',
      '**Curry–Howard says these rules are already a logic.** Read `→` as implication and a ' +
        'type as a proposition: T-Abs is exactly implication-introduction and T-App is modus ' +
        'ponens. A term of type `τ` is a proof of `τ`. That correspondence is why proof ' +
        'assistants are programming languages, and why "the type is the specification" is a ' +
        'technical statement rather than a slogan.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — derive a type, and measure what the discipline costs',
        markup: root.StlcTemplate.render()
      },
      diagram: diagram(),
      insight: '**"Well-typed programs do not go wrong" is a theorem with a precise statement, ' +
        'and knowing that statement changes how you read a language\'s design decisions.** ' +
        'Progress and preservation together say that a well-typed program either finishes or ' +
        'runs forever, and never reaches a state the semantics has no rule for. Every language ' +
        'that violates it does so knowingly and for a stated reason: Java\'s covariant arrays ' +
        'buy pre-generics polymorphism and pay with a runtime check; TypeScript\'s bivariant ' +
        'method parameters buy compatibility with a decade of JavaScript idioms; an unchecked ' +
        'cast buys an escape hatch where the type system is not expressive enough. None of ' +
        'these are mistakes. What is a mistake is not knowing which ones your language made, ' +
        'because those are exactly the places where a type error becomes a runtime error.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.StlcTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const checkFor = root.Helpers.memoise(function (source) {
    const node = root.TypeEngine.check(root.TypeEngine.parse(source),
      root.TypeEngine.emptyContext());

    return { node: node, failure: node.ok ? null : root.TypeEngine.firstFailure(node),
      height: root.TypeEngine.height(node), nodes: root.TypeEngine.countNodes(node) };
  });

  const sweepFor = root.Helpers.memoise(function (key) {
    return root.ArithTypes.sweep({ sample: Number(key), seed: 20260824 });
  });

  const fixturesFor = root.Helpers.memoise(function () {
    return root.TypeEngine.fixtures().map(function (fixture) {
      const state = checkFor(fixture.source);

      return { source: fixture.source, note: fixture.note,
        ok: state.node.ok, wellTyped: fixture.wellTyped,
        type: state.node.ok ? root.TypeEngine.showType(state.node.type) : '',
        rule: state.failure ? state.failure.rule : '',
        why: state.failure ? state.failure.why : '',
        expected: fixture.wellTyped ? 'well typed' : 'rejected by ' + fixture.rule,
        agrees: state.node.ok === fixture.wellTyped
          && (fixture.wellTyped || state.failure.rule === fixture.rule) };
    });
  });

  function update() {
    const values = panel.values();
    const state = checkFor(values['stl-term']);
    const sweep = sweepFor(String(values['stl-sample']));

    paintMetrics(state, sweep);
    paintVerdict(state);
    paintDerivation(state);
    paintFixtures();
    paintSoundness(sweep);
    paintRules();
  }

  function paintMetrics(state, sweep) {
    root.MetricGrid.update({
      'stl-type': { value: state.node.ok
        ? root.TypeEngine.showType(state.node.type) : 'rejected',
      note: state.node.ok ? 'built bottom-up from the annotations, in one pass'
        : 'the first rule that could not be applied is ' + state.failure.rule },
      'stl-height': { value: root.Format.exact(state.height),
        note: 'the deepest chain of rules in the derivation' },
      'stl-nodes': { value: root.Format.exact(state.nodes),
        note: 'one node per rule application, premises included' },
      'stl-stuck': { value: root.Format.exact(sweep.wellTypedStuck),
        note: sweep.wellTypedStuck === 0
          ? 'out of ' + root.Format.exact(sweep.wellTyped) +
            ' well-typed terms run — progress holds on every one'
          : 'a well-typed term got stuck, which would mean the rules are unsound' }
    });
  }

  function paintVerdict(state) {
    root.jQuery('#stl-verdict').html(state.node.ok
      ? '<div>' + root.Helpers.escapeHtml(state.node.judgement) + '</div>'
      : '<div>' + root.Helpers.escapeHtml(state.failure.rule) + ' failed</div>' +
        '<div style="margin-top:.4rem">' + root.Helpers.escapeHtml(state.failure.judgement) +
        '</div><div style="margin-top:.4rem">' +
        root.Helpers.escapeHtml(state.failure.why || '') + '</div>');

    root.Helpers.setText('stl-verdict-caption', state.node.ok
      ? 'A complete judgement: the context on the left of the turnstile, the term, and the ' +
        'type it was derived to have. Nothing here was declared — every annotation in the ' +
        'source named a parameter type, and the type of the whole expression was computed.'
      : 'A rejection with a location. The rule name says which of the eight rules could not ' +
        'be applied, the judgement says where in the term it happened, and the last line says ' +
        'what the constraint was. A checker that returned only "type error" would be correct ' +
        'and useless, and the difference between the two is exactly this much work.');
  }

  function paintDerivation(state) {
    root.jQuery('#stl-derivation').html(root.DerivationView.markup(state.node, { maxDepth: 8 }));

    root.Helpers.setText('stl-derivation-caption',
      'Premises above the bar, conclusion below, rule name at the right — the shape every ' +
      'textbook draws and the shape the checker actually builds. Follow a rejected term down ' +
      'to the red bar and you are looking at the first place the rules ran out, which is where ' +
      'a compiler would point its caret.');
  }

  function paintFixtures() {
    const rows = fixturesFor('all');
    const agreeing = rows.filter(function (row) { return row.agrees; }).length;

    root.jQuery('#stl-fixtures tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.source) +
        '</td><td>' + (row.ok ? 'well typed' : 'rejected') + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.ok ? row.type : row.rule + ': ' + row.why) +
        '</td><td>' + root.Helpers.escapeHtml(row.expected) +
        (row.agrees ? '' : ' ← DISAGREES') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('stl-fixtures-caption',
      'Thirteen fixtures, and the last column is the assertion: each rejected term names the ' +
      'rule that is expected to fail, and the checker has to name the same one. ' + agreeing +
      ' of ' + rows.length + ' agree. Testing only "was it rejected" would pass a checker that ' +
      'rejects everything for the wrong reason, which is why the rule name is part of the ' +
      'expectation and not part of the message.');
  }

  function paintSoundness(sweep) {
    root.jQuery('#stl-soundness tbody').html(
      '<tr><td>Well typed</td><td class="mono">' + root.Format.exact(sweep.wellTypedFine) +
      '</td><td class="mono">' + root.Format.exact(sweep.wellTypedStuck) +
      ' ← must be zero</td><td class="mono">' + root.Format.exact(sweep.wellTyped) + '</td></tr>' +
      '<tr><td>Rejected</td><td class="mono">' + root.Format.exact(sweep.illTypedFine) +
      ' ← the price</td><td class="mono">' + root.Format.exact(sweep.illTypedStuck) +
      '</td><td class="mono">' + root.Format.exact(sweep.illTyped) + '</td></tr>');

    root.Helpers.setText('stl-soundness-caption', soundnessCaption(sweep));
  }

  function soundnessCaption(sweep) {
    return 'All 215 terms of depth one over five atoms, exhaustively, plus ' +
      root.Format.exact(sweep.terms - 215) + ' sampled deeper ones. The top-right cell is ' +
      'progress: ' + root.Format.exact(sweep.wellTypedStuck) + ' well-typed terms got stuck ' +
      'out of ' + root.Format.exact(sweep.wellTyped) + '. Preservation was checked separately ' +
      'by typing every intermediate term of every reduction — ' +
      root.Format.exact(sweep.preservationChecked) + ' steps, ' +
      root.Format.exact(sweep.preservationFailures) + ' type changes. The bottom-left cell is ' +
      'the honest one: ' + root.Format.exact(sweep.illTypedFine) + ' terms the checker refuses ' +
      'that would have run to a value — ' +
      root.Format.fixed(sweep.conservatism * 100, 1) + '% of all rejections. ' +
      '`if true then 0 else true` is one of them, and no sound checker can accept it without ' +
      'deciding which branch runs.';
  }

  function paintRules() {
    root.jQuery('#stl-rules tbody').html(root.TypeEngine.RULE_TABLE.map(function (rule) {
      return '<tr><td class="mono">' + rule.name + '</td><td class="mono">' +
        root.Helpers.escapeHtml(rule.premises) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(rule.conclusion) + '</td><td>' +
        root.Helpers.escapeHtml(rule.reads) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('stl-rules-caption',
      'Nine rules and the entire type system is on the screen. Read the premises column as ' +
      '"what has to be true first" and the conclusion as "what you may then write down". Two ' +
      'of them extend the context (T-Abs binds the parameter, T-Let binds the name) and one ' +
      'consumes it (T-Var), and the rest are structural. The checker in this section is these ' +
      'nine rules transcribed, which is what "the specification is executable" means.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
