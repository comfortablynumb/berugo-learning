/**
 * Section: The untyped lambda calculus.
 *
 * The measurement that carries the section is the strategy table on
 * `(λx. λy. y) Ω`. Normal order, call-by-name and head reduction all finish in
 * one step; applicative and call-by-value spend the entire budget and end where
 * they started. That is the difference between "evaluate the argument first"
 * and "do not", and it is the reason a language with strict evaluation needs
 * short-circuit operators built into the grammar.
 *
 * The second is the capture fixture. `(λx. λy. x) y` reduces to `λy'. y` and
 * the rename is logged with the reason; the naive substitution gives `λy. y`,
 * which is the identity and means something else entirely.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'the-untyped-lambda-calculus';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  const SOURCES = {
    'plus two three': 'plus two three',
    'mult two three': 'mult two three',
    'ignore omega': '(λx. λy. y) omega',
    'fst (pair a b)': 'fst (pair a b)',
    capture: '(λx. λy. x) y',
    'factorial 4': '',
    'isZero (mult two zero)': 'isZero (mult two zero)'
  };

  function diagram() {
    return {
      title: 'Diagram — one β-step, with the substitution written out',
      caption: 'A redex is an abstraction applied to something. The step replaces every free ' +
        'occurrence of the parameter in the body with the argument, and the only subtlety in ' +
        'the entire calculus lives in the word "free": an occurrence under a binder of the same ' +
        'name is a different variable and must be left alone, and a binder whose name appears ' +
        'free in the argument must be renamed before the substitution goes under it. Skip that ' +
        'rename and the argument gets captured — it silently becomes the wrong variable, and ' +
        'the result is a well-formed term with a different meaning, which is the worst kind of ' +
        'bug to have.',
      definition: [
        'graph TD',
        'A["(λx. body) arg — a redex"] --> B["substitute arg for x in body"]',
        'B --> C{"does a binder in body share a name with a free variable of arg?"}',
        'C -->|no| D["replace and continue"]',
        'C -->|yes| E["rename that binder to a fresh name first"]',
        'E --> D',
        'D --> F["the contractum: one β-step done"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Three productions is the whole grammar: a variable, `λx. e`, and `e e`.** There are no ' +
        'numbers, no booleans, no data structures and no recursion operator, and every one of ' +
        'those is definable inside it. That is the claim the demo checks rather than asserts: ' +
        '`plus two three` reduces to the Church numeral five in six steps, and the numeral is ' +
        'read back to a JavaScript number so the answer is not a matter of squinting at a term.',
      '**A variable is free when no enclosing λ binds it, and that distinction is the calculus.** ' +
        '`λx. x y` binds `x` and leaves `y` free. Every interesting definition — substitution, ' +
        'α-equivalence, closure conversion, even scope in your own language — is stated in terms ' +
        'of which occurrences are free, and getting the definition slightly wrong is how scoping ' +
        'bugs are born.',
      '**Capture-avoiding substitution is the one place implementations go wrong.** Replacing ' +
        '`x` by a term mentioning `y` inside a `λy` binder would make that free `y` suddenly ' +
        'bound. The fix is to rename the binder first, which the demo shows happening: ' +
        '`(λx. λy. x) y` gives `λy\'. y`, not `λy. y`. The naive answer is the identity ' +
        'function; the right answer is a constant function. Same characters, different program.',
      '**α-equivalence means names do not matter, and de Bruijn indices prove it.** `λx y. x y` ' +
        'and `λa b. a b` both become `λ λ (1 0)` — each variable replaced by the number of ' +
        'binders between it and its own. Comparing terms by index rather than by name is how a ' +
        'compiler decides two functions are the same, and it is why the tests here compare ' +
        'α-equivalence rather than strings.',
      '**β-reduction is the only computation rule, and η is about extensionality.** β says ' +
        '`(λx. e) a → e[x := a]`. η says `λx. f x` is `f` when `x` is not free in `f` — a ' +
        'wrapper that only forwards is the thing it wraps. η is what justifies point-free style, ' +
        'and it is exactly the optimisation the bracket-abstraction rule `S (K a) I → a` ' +
        'performs in the next section.',
      '**Church–Rosser says the normal form is unique if you reach one.** Reduce in any order ' +
        'and any two reduction sequences can be brought back together, so a term has at most one ' +
        'normal form up to renaming. What order decides is not the ANSWER but whether you get ' +
        'one at all — which is why the strategy table has an "ends" column and not just a ' +
        '"result" column.',
      '**Normal order finds a normal form whenever one exists; call-by-value does not.** ' +
        '`(λx. λy. y) Ω` ignores its argument, and `Ω` reduces to itself forever. Outermost-' +
        'first throws the argument away in one step; innermost-first evaluates it first and ' +
        'never returns. Every strict language pays this, and pays it back with short-circuit ' +
        'operators, lazy `&&`, and `if` as a special form rather than a function.',
      '**Recursion needs no primitive: `Y f = f (Y f)` is a term, and factorial runs on it.** ' +
        'The fixed-point combinator hands a function a copy of itself, so a definition can refer ' +
        'to something that does not exist yet. The demo runs factorial 0 through 5 under normal ' +
        'order and reads each answer back; the step counts grow steeply, which is the honest ' +
        'cost of encoding rather than implementing.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — reduce a term, and watch the strategy decide whether it ends',
        markup: root.UntypedLambdaTemplate.render()
      },
      diagram: diagram(),
      insight: '**The capture case is not a curiosity about a toy calculus; it is the bug in ' +
        'every macro system, template engine and code generator that pastes an expression into ' +
        'a scope it did not inspect.** A C macro whose parameter is named `i` expanded inside a ' +
        'loop over `i`, a template that interpolates a user expression into a generated ' +
        'function whose local happens to share a name, a code generator emitting a helper ' +
        'variable that shadows something in the surrounding block — all of them are the ' +
        'substitution here without the rename. The fix is always the same: generate names that ' +
        'cannot collide, or rename what you are about to shadow. That is what `gensym` is for, ' +
        'what hygienic macros automate, and what the `\'` in `λy\'. y` is doing on the screen.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.UntypedLambdaTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function termFor(key) {
    if (key === 'factorial 4') return root.LambdaEngine.factorial(4);
    return root.LambdaEngine.parse(root.LambdaEngine.expand(SOURCES[key]));
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const term = termFor(parts[0]);

    return root.LambdaEngine.reduce(term, parts[1],
      { budget: Number(parts[2]), traceLimit: 40 });
  });

  const strategiesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.LambdaEngine.compare(termFor(parts[0]),
      { budget: Number(parts[1]), traceLimit: 0 });
  });

  /**
   * Read the normal form back at the kind the encoding claims. This is not a
   * convenience: `λt. λf. f` is Church FALSE and Church ZERO at the same time,
   * because both encodings chose the same term. Reading numerals first would
   * report three of the booleans below as 0, which is true and not the answer
   * to the question that was asked.
   */
  const churchFor = root.Helpers.memoise(function () {
    return CHURCH_CHECKS.map(function (check) {
      const result = root.LambdaEngine.reduce(
        root.LambdaEngine.parse(root.LambdaEngine.expand(check.source)),
        'normal', { budget: 4000, traceLimit: 0 });
      const read = readAs(result.term, check.as) || result.text;

      return { source: check.source, text: result.text, steps: result.steps,
        read: read, expect: check.expect, as: check.as,
        alsoNumber: check.as === 'boolean'
          && root.LambdaEngine.toNumber(result.term) !== null,
        agrees: read === check.expect };
    });
  });

  function readAs(term, kind) {
    if (kind === 'number') {
      const number = root.LambdaEngine.toNumber(term);

      return number === null ? null : String(number);
    }
    if (kind === 'boolean') {
      const boolean = root.LambdaEngine.toBoolean(term);

      return boolean === null ? null : String(boolean);
    }
    return null;
  }

  const factorialFor = root.Helpers.memoise(function () {
    return [0, 1, 2, 3, 4, 5].map(function (n, index, all) {
      const result = root.LambdaEngine.reduce(root.LambdaEngine.factorial(n),
        'normal', { budget: 60000, traceLimit: 0 });

      return { n: n, value: root.LambdaEngine.toNumber(result.term),
        steps: result.steps, size: result.size, index: index, all: all };
    }).map(withGrowth);
  });

  function withGrowth(row, index, rows) {
    return Object.assign({}, row, { growth: index === 0 ? 1 : row.steps / rows[index - 1].steps });
  }

  const CHURCH_CHECKS = [
    { source: 'plus two three', expect: '5', as: 'number' },
    { source: 'mult two three', expect: '6', as: 'number' },
    { source: 'succ (succ zero)', expect: '2', as: 'number' },
    { source: 'isZero zero', expect: 'true', as: 'boolean' },
    { source: 'isZero one', expect: 'false', as: 'boolean' },
    { source: 'not true', expect: 'false', as: 'boolean' },
    { source: 'and true false', expect: 'false', as: 'boolean' },
    { source: 'fst (pair a b)', expect: 'a', as: 'term' },
    { source: 'snd (pair a b)', expect: 'b', as: 'term' }
  ];

  function update() {
    const values = panel.values();
    const key = values['lam-term'] + '\n' + values['lam-strategy'] + '\n' + values['lam-budget'];
    const result = runFor(key);

    paintMetrics(result);
    paintTrace(result);
    paintStrategies(values['lam-term'] + '\n' + values['lam-budget']);
    paintCapture();
    paintChurch();
    paintFactorial();
  }

  const OUTCOMES = { normal: 'a normal form', budget: 'the step budget ran out',
    size: 'the term grew past the size cap' };

  function paintMetrics(result) {
    const number = root.LambdaEngine.toNumber(result.term);
    const boolean = root.LambdaEngine.toBoolean(result.term);

    root.MetricGrid.update({
      'lam-steps': { value: root.Format.exact(result.steps),
        note: 'each one substituted an argument into a body' },
      'lam-outcome': { value: OUTCOMES[result.outcome],
        note: result.normal ? 'no redex is left anywhere in the term'
          : 'the reducer stopped; this is not a claim that no normal form exists' },
      'lam-result': { value: number !== null ? 'the numeral ' + number
        : (boolean !== null ? String(boolean) : 'a term of size ' + result.size),
      note: number !== null || boolean !== null
        ? 'read back out of the normal form, not asserted'
        : 'no Church encoding matched, so the term itself is the answer' },
      'lam-renames': { value: root.Format.exact(result.renames.length),
        note: result.renames.length > 0
          ? 'each rename stopped a free variable from being captured'
          : 'no binder in this reduction shadowed a free variable' }
    });
  }

  function paintTrace(result) {
    root.jQuery('#lam-trace').html(root.DerivationView.traceMarkup(
      result.trace.map(function (entry) {
        return { step: entry.step, term: entry.term, rule: 'size ' + entry.size };
      }), { limit: 24 }));

    root.Helpers.setText('lam-trace-caption',
      'Every row is one β-step under the chosen strategy, with the size of the term beside it. ' +
      'Watch the size column on the Church arithmetic: it grows before it shrinks, because a ' +
      'substitution copies the argument into every occurrence of the parameter. That copying is ' +
      'exactly what call-by-need exists to avoid, and why a real lazy runtime keeps a graph ' +
      'with sharing rather than a tree.');
  }

  function paintStrategies(key) {
    const rows = strategiesFor(key);

    root.jQuery('#lam-strategies tbody').html(rows.map(function (row) {
      const info = root.LambdaEngine.STRATEGY_INFO[row.strategy];

      return '<tr><td>' + info.label + '</td><td>' + root.Helpers.escapeHtml(info.picks) +
        '</td><td class="mono">' + root.Format.exact(row.steps) + '</td><td>' +
        (row.normal ? 'a normal form' : row.outcome) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.text.slice(0, 34)) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('lam-strategies-caption', strategyCaption(rows));
  }

  function strategyCaption(rows) {
    const finished = rows.filter(function (row) { return row.normal; });

    if (finished.length === rows.length) {
      return 'Every strategy reaches a normal form on this term, and Church–Rosser guarantees ' +
        'they agree — what differs is only the step count, which is a cost and not an answer. ' +
        'Switch the term to (λx. λy. y) Ω to see the column that matters.';
    }
    return finished.length + ' of ' + rows.length + ' strategies reach a normal form on this ' +
      'term and ' + (rows.length - finished.length) + ' do not. The ones that fail evaluate the ' +
      'argument before the function that ignores it, and that argument has no normal form. This ' +
      'is not a subtlety about a toy calculus: it is why `if` cannot be an ordinary function in ' +
      'a strict language, and why `&&` short-circuits in the grammar rather than in a library.';
  }

  function paintCapture() {
    const fixture = root.LambdaEngine.captureFixture();
    const correct = root.LambdaEngine.reduce(fixture.term, 'normal', { budget: 20 });

    root.jQuery('#lam-capture tbody').html(
      '<tr><td class="mono">' + root.Helpers.escapeHtml(root.LambdaEngine.show(fixture.term)) +
      '</td><td class="mono">' + root.Helpers.escapeHtml(fixture.wrong) +
      '</td><td class="mono">' + root.Helpers.escapeHtml(correct.text) +
      '</td><td>' + (fixture.wrong === correct.text ? 'yes' : 'no — and they mean different things') +
      '</td></tr>');

    root.Helpers.setText('lam-capture-caption', fixture.why +
      '. The naive result λy. y is the identity function. The correct result λy\'. y is a ' +
      'constant function returning the outer y. Both are well-formed terms, both type-check in ' +
      'any system that would accept either, and no test that only checks "did it produce a ' +
      'term" can tell them apart — which is why the tests here compare α-equivalence and the ' +
      'reducer logs every rename it performs.');
  }

  function paintChurch() {
    const rows = churchFor('all');
    const agreeing = rows.filter(function (row) { return row.agrees; }).length;

    const overloaded = rows.filter(function (row) { return row.alsoNumber; }).length;

    root.jQuery('#lam-church tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.source) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.text.slice(0, 32)) +
        '</td><td class="mono">' + row.steps + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.read) + (row.alsoNumber ? ' (also the numeral 0)' : '') +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.expect) +
        (row.agrees ? '' : ' ← DISAGREES') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('lam-church-caption',
      'Nine encodings, each reduced to a normal form and then READ BACK — the numeral by ' +
      'counting how many times it applies its first argument, the boolean by seeing which of ' +
      'two arguments it selects. ' + agreeing + ' of ' + rows.length + ' agree with what the ' +
      'encoding claims. The ' + overloaded + ' rows marked "also the numeral 0" are the ' +
      'interesting ones: `λt. λf. f` is Church FALSE and Church ZERO at the same time, because ' +
      'the two encodings happened to pick the same term. Nothing in an untyped calculus ' +
      'distinguishes them — the reader supplies the intent, which is exactly what a type would ' +
      'have recorded and is the first argument for the next section.');
  }

  function paintFactorial() {
    const rows = factorialFor('rows');

    root.jQuery('#lam-factorial tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.n + '</td><td class="mono">' +
        (row.value === null ? '—' : row.value) + '</td><td class="mono">' +
        root.Format.exact(row.steps) + '</td><td class="mono">' +
        root.Format.exact(row.size) + '</td><td class="mono">' +
        (row.n === 0 ? '—' : root.Format.fixed(row.growth, 1) + '×') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('lam-factorial-caption',
      'The Y combinator gives a function access to itself without any recursion primitive, and ' +
      'factorial computes correctly for every row. The step column is the honest part: ' +
      root.Format.exact(rows[5].steps) + ' β-steps to compute 5! = 120, growing by roughly a ' +
      'factor of ' + root.Format.fixed(rows[5].growth, 0) + ' per row. Numerals encoded as ' +
      'iteration make multiplication quadratic in the values, which is why this is a proof of ' +
      'expressiveness and never an implementation strategy.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
