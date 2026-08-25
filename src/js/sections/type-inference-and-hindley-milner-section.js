/**
 * Section: Type inference and Hindley–Milner.
 *
 * The measurement is the pair at the centre of the fixture table. `let id =
 * λx. x in pair (id 3) (id true)` infers `Pair Number Boolean`. The same body
 * with `id` lambda-bound — `λid. pair (id 3) (id true)` — is rejected, with
 * "cannot match Number with Boolean". One generalisation step is the entire
 * difference, and it decides whether the program exists.
 *
 * The second is the occurs check. `λx. x x` needs `α = α → β`, which has no
 * finite solution; the checker says so and names the variable rather than
 * looping, which is what a checker without the check would do.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'type-inference-and-hindley-milner';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — generate, unify, generalise',
      caption: 'Inference is three passes that interleave. Walking the term generates ' +
        'equations: every application says "the function type must equal argument-type → ' +
        'something fresh", every conditional says "the guard must equal Boolean and the ' +
        'branches must equal each other". Unification solves the equations, producing a ' +
        'substitution — or failing in one of exactly two ways, a constructor clash or the ' +
        'occurs check. Generalisation happens only at a `let`, and only over the variables the ' +
        'environment does not mention; those are the ones the definition genuinely does not ' +
        'care about. Instantiation reopens them fresh at every use, which is what lets one ' +
        'definition serve two types.',
      definition: [
        'graph TD',
        'A["walk the term"] --> B["invent a fresh type variable at each binder and application"]',
        'B --> C["emit an equation at each application, conditional and use"]',
        'C --> D{"unify the equations"}',
        'D -->|"a variable meets a type"| E["bind it — unless the occurs check fires"]',
        'D -->|"two constructors differ"| F["clash: report both types"]',
        'E --> G{"at a let?"}',
        'G -->|yes| H["generalise: quantify the variables the environment does not mention"]',
        'G -->|no| I["keep it monomorphic"]',
        'H --> J["instantiate fresh at every use"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Nothing in the input has a type annotation, and every type in the output was ' +
        'derived.** That is the whole promise: `λf. λg. λx. f (g x)` is inferred to be ' +
        '`∀α β γ. (α → β) → (γ → α) → γ → β`, and no part of that was written down by a human. ' +
        'The price is that when it fails, the error message is about a constraint rather than ' +
        'about a line.',
      '**Unification solves equations between types by walking both trees together.** A ' +
        'variable meets anything and gets bound to it; two constructors must have the same name ' +
        'and arity, and then their arguments are unified pairwise. There are exactly two ways ' +
        'to fail, and knowing both is enough to read almost every inference error you will ' +
        'ever see.',
      '**The occurs check is the failure that stops the checker from looping.** Unifying `α` ' +
        'with `α → β` would need a type that contains itself, which is not a finite tree. ' +
        '`λx. x x` demands exactly that. A checker without the check builds a cyclic structure ' +
        'and then either hangs or produces a type that prints forever — which is what "my ' +
        'compiler is stuck on this file" usually turns out to be.',
      '**Substitutions compose, and composing them wrong is the classic implementation bug.** ' +
        'Applying `S₂` after `S₁` means applying `S₂` to every value in `S₁` as well as adding ' +
        '`S₂`\'s own bindings. Skip that and a variable bound early stops being updated by ' +
        'later information, so the final type is stale. The demo counts how many equations were ' +
        'solved, and every one of them composed into the result.',
      '**Generalisation happens at `let`, and only there — that is the entire design.** At a ' +
        'let, the variables free in the inferred type but not in the environment are quantified: ' +
        'the definition does not constrain them, so a use site may pick. A lambda-bound name ' +
        'gets no such treatment, because the argument has one type chosen by the caller. The ' +
        'demo shows the same body both ways, and one of them does not type.',
      '**Instantiation is what makes one definition serve two types.** Each use of a ' +
        'generalised name gets fresh variables, so `id 3` and `id true` constrain different ' +
        'variables and never meet. Remove the generalisation and both uses constrain the SAME ' +
        'variable, which is why the lambda-bound version reports "cannot match Number with ' +
        'Boolean".',
      '**Algorithm W returns a principal type: every other valid typing is an instance of it.** ' +
        'That is a strong guarantee and it is why the demo can print one answer rather than a ' +
        'set. `λx. x` is `∀α. α → α`, and `Number → Number` is a specialisation of it, not a ' +
        'competitor. Principality is exactly what makes separate compilation of a library ' +
        'possible without seeing its callers.',
      '**The value restriction exists because generalising a mutable reference is unsound.** In ' +
        'a language with side effects, `let r = ref [] in ...` must not generalise the element ' +
        'type — one write at `Int` and one read at `String` would follow. ML restricts ' +
        'generalisation to syntactic values, which is a small, blunt, entirely necessary rule ' +
        'that appears in every ML descendant.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — infer a type, and watch the equations that produced it',
        markup: root.HmTemplate.render()
      },
      diagram: diagram(),
      insight: '**Inference errors are bad for a structural reason, and knowing the reason ' +
        'makes them readable.** The checker never sees your intent; it sees a stream of ' +
        'equations, and it reports the first one that could not be solved. The location it ' +
        'blames is wherever the traversal happened to reach the contradiction, which is often ' +
        'far from the line you got wrong — a mistyped argument in one function surfaces as a ' +
        'clash inside a caller three modules away, because that is where the two constraints ' +
        'finally met. The practical technique follows directly: add an annotation at the ' +
        'boundary you believe in. That splits the equation set in two, and the error moves to ' +
        'the half that actually contains the mistake. This is why experienced ML and Haskell ' +
        'programmers annotate top-level signatures even though the compiler does not require ' +
        'it — the annotation is not for the compiler, it is for the error message.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.HmTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const analyseFor = root.Helpers.memoise(function (source) {
    return root.HmLab.analyse(source);
  });

  const sweepFor = root.Helpers.memoise(function () { return root.HmLab.sweep(); });

  const contrastFor = root.Helpers.memoise(function () {
    return root.HmLab.polymorphismContrast();
  });

  const unifyFor = root.Helpers.memoise(function (key) {
    const fixture = root.HmLab.UNIFY_FIXTURES[Number(key)] || root.HmLab.UNIFY_FIXTURES[0];

    return Object.assign({ note: fixture.note },
      root.HmLab.unifyPair(fixture.left, fixture.right));
  });

  function update() {
    const values = panel.values();
    const state = analyseFor(values['hmi-term']);

    paintMetrics(state);
    paintUnify(values['hmi-unify']);
    paintLog(state);
    paintEquations(state);
    paintFixtures();
    paintContrast();
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'hmi-scheme': { value: state.ok ? state.scheme : 'no type exists',
        note: state.ok ? 'principal: every valid typing of this term is an instance of it'
          : state.why },
      'hmi-fresh': { value: root.Format.exact(state.freshVariables),
        note: 'each one stands for something not yet known; most get bound and disappear' },
      'hmi-unifications': { value: root.Format.exact(state.unificationCount),
        note: 'each is one equation between two types, solved in order' },
      'hmi-verdict': { value: state.ok ? 'inferred' : (state.kind || 'rejected'),
        note: state.ok ? 'in ' + state.steps + ' rule applications over a term of size ' +
          state.size : (state.blame || state.why) }
    });
  }

  function paintUnify(key) {
    const result = unifyFor(key);

    root.jQuery('#hmi-unify-table tbody').html(result.trace.map(function (row, index) {
      return '<tr><td class="mono">' + (index + 1) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.left) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.right) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('hmi-unify-caption', unifyCaption(result));
  }

  function unifyCaption(result) {
    if (result.ok) {
      return result.note + '. Solved, with ' + result.bindings.length + ' binding' +
        (result.bindings.length === 1 ? '' : 's') + ': ' + result.bindings.join(', ') +
        '. Each row above is one recursive call — the two trees are walked in step, and a ' +
        'variable meeting a type is bound on the spot.';
    }
    return result.note + '. ' + result.why + ' This is one of exactly two ways unification ' +
      'can fail. A ' + (result.kind === 'occurs' ? 'failed occurs check means the equation has ' +
        'no finite solution, and accepting it would build a type that contains itself.'
      : 'constructor clash means two rigid type constructors met and could not be made equal — ' +
        'no substitution can turn one into the other.');
  }

  function paintLog(state) {
    root.jQuery('#hmi-log tbody').html(state.log.map(function (entry, index) {
      return '<tr><td class="mono">' + (index + 1) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(entry.rule) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(entry.text) + '</td></tr>';
    }).join('') || '<tr><td colspan="3">inference stopped before recording a rule</td></tr>');

    root.Helpers.setText('hmi-log-caption',
      'Every line the inference engine wrote, in order. W-Abs invents a variable for the ' +
      'parameter and reports the arrow type it built once the body was done; W-App reports the ' +
      'result of solving the application constraint; W-Let is the one to watch, because it ' +
      'says exactly which variables were quantified and which were not. On a term with no ' +
      'polymorphism the W-Let line reads "nothing to generalise", which is the honest report ' +
      'that the let did nothing special here.');
  }

  function paintEquations(state) {
    root.jQuery('#hmi-equations tbody').html(state.unifications.map(function (row, index) {
      return '<tr><td class="mono">' + (index + 1) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.left) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.right) + '</td></tr>';
    }).join('') || '<tr><td colspan="3">no equations — nothing in this term needed solving</td></tr>');

    root.Helpers.setText('hmi-equations-caption',
      'These are the constraints, in the order the traversal produced them. This ordering is ' +
      'the whole reason inference errors point where they do: the checker reports the first ' +
      'row it cannot solve, and "first" is decided by the walk, not by which line you typed ' +
      'wrong. A term whose mistake is at the top can fail at the bottom, and an annotation ' +
      'placed anywhere in between splits the list and moves the blame.');
  }

  function paintFixtures() {
    const rows = sweepFor('all');
    const agreeing = rows.filter(function (row) { return row.matches; }).length;

    root.jQuery('#hmi-fixtures tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.source) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.ok ? row.scheme
          : row.kind + ': ' + row.why.slice(0, 46)) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.expected) +
        '</td><td>' + (row.matches ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('hmi-fixtures-caption',
      'Twelve terms with the principal type each one should have, written down independently ' +
      'of the implementation — ' + agreeing + ' of ' + rows.length + ' agree. The two ' +
      'rejections are not failures of the algorithm but its two documented limits: the occurs ' +
      'check on self-application, and a lambda-bound name used at two types. Asserting the ' +
      'exact scheme rather than "it typed" is what makes this a test: a checker that inferred ' +
      '`Number → Number` for the identity would pass the weaker version.');
  }

  function paintContrast() {
    const contrast = contrastFor('pair');

    root.jQuery('#hmi-contrast tbody').html(
      row(contrast.letBound, 'the let generalises id to ∀α. α → α, so the two uses ' +
        'instantiate it separately and never meet') +
      row(contrast.lambdaBound, 'a lambda-bound id has one monomorphic type, so both uses ' +
        'constrain the same variable and it must be Number and Boolean at once'));

    root.Helpers.setText('hmi-contrast-caption',
      'The same body, twice. ' + contrast.difference + '. This is the single most consequential ' +
      'design decision in the system: generalising only at let is what keeps inference ' +
      'decidable and principal, and it is exactly what makes the second row impossible. ' +
      'System F, in the next section, accepts that second term — by making you write the ' +
      'quantifier down.');
  }

  function row(state, why) {
    return '<tr><td class="mono">' + root.Helpers.escapeHtml(state.source) +
      '</td><td class="mono">' + root.Helpers.escapeHtml(state.ok ? state.scheme
        : 'rejected — ' + state.why) + '</td><td>' + root.Helpers.escapeHtml(why) + '</td></tr>';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
