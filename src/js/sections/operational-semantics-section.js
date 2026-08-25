/**
 * Section: Operational semantics.
 *
 * The measurement is the rule-set switch. Reordering the congruence holes so
 * operands evaluate right to left changes the trace of `(1 + 2) * (3 + 4)` and
 * changes nothing else: both orders give 21, because confluence does not care.
 * Letting `if` evaluate both branches changes the answer — `if iszero 0 then
 * 1 + 1 else true + 1` becomes stuck on a branch that was never going to run,
 * and the determinism check finds two applicable rules at that term.
 *
 * Three rule sets, one term, and a difference you can point at.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'operational-semantics';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  const VARIANT_NAMES = ['standard', 'rightToLeft', 'eagerIf'];

  function diagram() {
    return {
      title: 'Diagram — an evaluation context focusing the next redex',
      caption: 'A rule set splits in two. Computation rules say what work happens: ' +
        '`if true then a else b → a` is one, and it needs no context at all. Congruence rules ' +
        'say where the work happens, and writing them one by one — one for the left operand of ' +
        'plus, one for the right, one for the guard of if — is what makes a real language ' +
        'specification unreadable. The evaluation context collapses all of them into one: E is ' +
        'a term with a hole, the hole is where the next step happens, and the shape of E is the ' +
        'entire evaluation order. Change E and you change the order without touching a single ' +
        'computation rule, which is exactly what the rule-set control does.',
      definition: [
        'graph TD',
        'A["E ::= · | E + e | v + E | E * e | v * E | if E then e else e"] --> B["pick E and a redex r so the term is E[r]"]',
        'B --> C["fire the computation rule on r, giving r′"]',
        'C --> D["the whole term becomes E[r′]"]',
        'D --> E{"is the result a value?"}',
        'E -->|yes| F["done"]',
        'E -->|"no, and no E works"| G["stuck — this is what a runtime error is"]',
        'E -->|"no, but some E works"| B'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A small-step semantics is a relation on terms, and every intermediate term is a real ' +
        'term.** `2 + 3 * 4 → 2 + 12 → 14`. That is what makes the trace readable and what makes ' +
        'a debugger possible: at every point there is a program you could print, not an opaque ' +
        'machine state. It is also what lets you say precisely where a program went wrong.',
      '**"Stuck" is the formal definition of a runtime error.** A term that is not a value and ' +
        'has no applicable rule is stuck. `true + 1` is stuck; `if 1 then 2 else 3` is stuck. ' +
        'These are exactly the things a type system is built to rule out, and the soundness ' +
        'theorem in the next section — progress and preservation — says precisely "well-typed ' +
        'terms never get stuck".',
      '**Computation rules and congruence rules do different jobs and should be read ' +
        'differently.** A computation rule is the actual work: `pred 3 → 2`. A congruence rule ' +
        'is bookkeeping: if a subterm steps, the whole term steps. Confusing the two is why ' +
        'inference-rule notation looks harder than it is — most of the rules on the page are ' +
        'saying nothing but "look inside".',
      '**An evaluation context is the congruence rules written once.** `E ::= · | E + e | v + E ' +
        '| if E then e else e` says where the hole may be, and therefore what order things ' +
        'happen in. The demo prints the context beside each step, so `2 + ·` means the step ' +
        'happened in the right operand of an addition that was waiting for it.',
      '**Determinism is a property you check, not one you assume.** The standard rules give at ' +
        'most one applicable rule at every reachable term, which the demo verifies by ' +
        'enumerating all of them rather than by trusting the implementation to pick one. Switch ' +
        'to the eager-if rule set and the count reaches two, with the term that did it named.',
      '**Big-step semantics says `e ⇓ v` in one derivation and cannot tell "stuck" from ' +
        '"diverges".** It is shorter to write and it maps directly onto a recursive interpreter, ' +
        'which is why so many implementations are written that way. What it gives up is the ' +
        'ability to say anything about a program that does not finish — both a crash and an ' +
        'infinite loop show up as "no derivation exists".',
      '**Changing the evaluation order does not change the answer; changing the rules does.** ' +
        'Left-to-right and right-to-left give different traces on `(1 + 2) * (3 + 4)` and the ' +
        'same value, because this language has no side effects and the two orders are ' +
        'confluent. Make `if` evaluate both branches and the value changes, because a branch ' +
        'that was never supposed to run is now able to get stuck.',
      '**An interpreter written from the rules is correct by construction, which is why specs ' +
        'are written this way.** Each rule becomes a case. The demo\'s small-step function is ' +
        'the rule list, in order, and its big-step function is the same rules read as a ' +
        'recursion — and the two are checked against each other on every fixture rather than ' +
        'assumed to agree.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — change the rules and watch the language change',
        markup: root.OperationalTemplate.render()
      },
      diagram: diagram(),
      insight: '**"What does this expression evaluate to" is an argument that ends the moment ' +
        'the semantics are written down, and this is why every language specification worth ' +
        'reading is written as rules while every blog post about the same language is not.** ' +
        'The three rule sets here differ by a handful of characters and produce three different ' +
        'languages: one deterministic and confluent, one deterministic with a different trace ' +
        'and the same answers, and one that is neither. Nobody could settle which behaviour is ' +
        '"right" by discussion, and nobody needs to — the rules say. When you next find a team ' +
        'disagreeing about evaluation order, short-circuiting, or whether a default argument is ' +
        'evaluated at definition or at call, the productive move is not to argue but to find ' +
        'the four lines of the specification that decide it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.OperationalTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const term = root.SmallStep.parse(parts[0]);

    return { small: root.SmallStep.run(term, 200, parts[1]),
      big: root.SmallStep.evaluate(term),
      compare: root.SmallStep.compare(parts[0], parts[1]),
      determinism: root.SmallStep.determinism(parts[0], parts[1]) };
  });

  const sweepFor = root.Helpers.memoise(function () {
    return root.SmallStep.fixtures().map(function (fixture) {
      const cells = VARIANT_NAMES.map(function (variant) {
        const result = root.SmallStep.run(root.SmallStep.parse(fixture.source), 200, variant);

        return { variant: variant, outcome: result.outcome, text: result.text,
          steps: result.steps };
      });
      const worst = VARIANT_NAMES.map(function (variant) {
        return root.SmallStep.determinism(fixture.source, variant);
      }).reduce(function (best, entry) {
        return entry.most > best.most ? entry : best;
      });

      return { source: fixture.source, note: fixture.note, cells: cells, worst: worst,
        differs: cells[0].text !== cells[2].text };
    });
  });

  const stuckFor = root.Helpers.memoise(function () {
    return root.SmallStep.fixtures().filter(function (fixture) {
      return fixture.expect === 'stuck';
    }).map(function (fixture) {
      return Object.assign({ note: fixture.note }, root.SmallStep.compare(fixture.source));
    });
  });

  function update() {
    const values = panel.values();
    const key = values['ops-term'] + '\n' + values['ops-rules'];
    const state = runFor(key);

    paintMetrics(state);
    paintRuleTable(values['ops-rules']);
    paintTrace(state);
    paintDerivation(state);
    paintSweep();
    paintStuck();
  }

  const OUTCOMES = { value: 'a value', stuck: 'stuck', budget: 'the step budget' };

  function paintMetrics(state) {
    root.MetricGrid.update({
      'ops-steps': { value: root.Format.exact(state.small.steps),
        note: 'each one is a single rule firing in a single context' },
      'ops-outcome': { value: OUTCOMES[state.small.outcome],
        note: state.small.outcome === 'stuck'
          ? 'not a value and no rule applies — this is a runtime error, formally'
          : 'the term reduced all the way down' },
      'ops-deterministic': { value: state.determinism.deterministic ? 'yes' : 'NO',
        note: state.determinism.deterministic
          ? 'at most one rule applied at each of ' + state.determinism.visited +
            ' reachable terms'
          : state.determinism.most + ' rules applied at once, at ' + state.determinism.witness },
      'ops-agreement': { value: state.compare.agree ? 'yes' : 'NO',
        note: state.compare.bigOk
          ? 'the derivation is ' + state.compare.bigHeight + ' deep with ' +
            state.compare.bigNodes + ' nodes'
          : 'no derivation exists, which matches the small step getting stuck' }
    });
  }

  function paintRuleTable(variant) {
    const rows = root.SmallStep.ruleTable(variant);

    root.jQuery('#ops-rule-table tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.kind +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.shape) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ops-rule-caption',
      root.SmallStep.VARIANTS[variant].label + ': ' + root.SmallStep.VARIANTS[variant].note +
      '. Eight computation rules and six congruence rules. Only the congruence half changes ' +
      'between the three rule sets — the computation rules are identical in all three, which ' +
      'is what makes it a fair comparison: the difference in behaviour comes entirely from ' +
      'where the hole is allowed to be.');
  }

  function paintTrace(state) {
    root.jQuery('#ops-trace tbody').html(state.small.trace.map(function (entry) {
      return '<tr><td class="mono">' + entry.step + '</td><td class="mono">' +
        root.Helpers.escapeHtml(entry.term) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(entry.rule) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(entry.context) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ops-trace-caption',
      'The context column is the part worth reading twice. `2 + ·` says the step happened in ' +
      'the right operand of an addition whose left operand was already a value; `·` says it ' +
      'happened at the top. The whole evaluation order of the language is in that column, and ' +
      'switching the rule set to right-to-left changes it and nothing else.');
  }

  function paintDerivation(state) {
    root.jQuery('#ops-derivation').html(root.DerivationView.markup(state.big, {
      read: function (node) {
        return { rule: node.rule, ok: node.ok !== false,
          statement: node.term + (node.ok && node.value
            ? ' ⇓ ' + root.SmallStep.show(node.value, 0) : ' ⇓ ?'),
          note: node.ok === false ? node.why : '', children: node.children || [] };
      }, maxDepth: 7 }));

    root.Helpers.setText('ops-derivation-caption',
      'The same term, evaluated in one derivation instead of a sequence of steps. Premises sit ' +
      'above the bar, the conclusion below it, and the rule name at the right. Notice what is ' +
      'missing compared with the trace: there is no intermediate term anywhere. That is the ' +
      'trade — the derivation is shorter and maps straight onto a recursive interpreter, and it ' +
      'can say nothing at all about a program that never finishes.');
  }

  function paintSweep() {
    const rows = sweepFor('all');
    const changed = rows.filter(function (row) { return row.differs; });

    root.jQuery('#ops-sweep tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.source) + '</td>' +
        row.cells.map(function (cell) {
          return '<td class="mono">' + root.Helpers.escapeHtml(cell.text.slice(0, 22)) +
            ' <span style="opacity:.6">(' + cell.steps + ')</span></td>';
        }).join('') + '<td class="mono">' + row.worst.most +
        (row.worst.deterministic ? '' : ' ← non-deterministic') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ops-sweep-caption',
      'Left-to-right and right-to-left agree on every row: same value, sometimes a different ' +
      'trace, never a different answer. That is confluence, and it holds because this language ' +
      'has no side effects — add one mutable cell and the two columns come apart immediately, ' +
      'which is why evaluation order is specified in every real language and left unspecified ' +
      'in a famous few. The eager-if column differs on ' + changed.length + ' of ' + rows.length +
      ' rows, and the last column names the terms where two rules applied at once.');
  }

  function paintStuck() {
    root.jQuery('#ops-stuck tbody').html(stuckFor('all').map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.source) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.smallText) +
        '</td><td>' + (row.bigOk ? 'a value' : 'no derivation') +
        '</td><td>' + root.Helpers.escapeHtml(row.bigWhy || 'no rule applies') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ops-stuck-caption',
      'Every stuck term here is a program that a dynamically typed language would crash on and ' +
      'a statically typed language would refuse to compile. Note the agreement column: where ' +
      'the small step gets stuck, the big step has no derivation — the two definitions disagree ' +
      'about nothing, which is the property worth testing and the property most hand-written ' +
      'interpreters quietly violate at exactly these edge cases.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
