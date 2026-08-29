/**
 * Section: top-down parsing and LL(1).
 *
 * The measurement is the conflict count, and the reason each conflict exists.
 * "Not LL(1)" is a verdict; "cell E on `a` wants both `E → E + T` and `E → T`,
 * because E is left recursive, and here is the shortest input that reaches the
 * cell" is a diagnosis you can act on. The repair control then applies the
 * transformation and the count drops in front of you — or, for the dangling
 * else, it does not, because the grammar is ambiguous and no rewrite of that
 * kind will help.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'top-down-parsing-and-ll1';
  const REPAIRS = ['none', 'left-recursion', 'left-factor', 'both'];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the predictive parse loop',
      caption: 'A predictive parser holds a stack of symbols it still expects to see. If the top ' +
        'is a terminal it must equal the next input token — match and advance both. If the top ' +
        'is a nonterminal, the table cell for (that nonterminal, the lookahead token) names ' +
        'exactly one production, and its right-hand side replaces the top of the stack. There is ' +
        'no search and no backtracking anywhere in that loop, which is why an LL(1) parser runs ' +
        'in linear time and why a cell holding two productions kills it outright: the loop has ' +
        'no mechanism for trying the other one.',
      definition: [
        'flowchart TD',
        '    A[top of stack] --> B{terminal or nonterminal?}',
        '    B -->|terminal| C{equals the lookahead?}',
        '    C -->|yes| D[pop and advance the input]',
        '    C -->|no| E[syntax error, and the expected token is known]',
        '    B -->|nonterminal| F["table[top][lookahead]"]',
        '    F -->|one production| G[pop, push the right-hand side reversed]',
        '    F -->|empty| E',
        '    F -->|two productions| H["not LL(1): the loop cannot choose"]',
        '    D --> A',
        '    G --> A'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Top-down parsing builds the tree from the root, guessing which production to use before ' +
        'seeing what it produces.** Recursive descent is the hand-written form: one function per ' +
        'nonterminal, and the function body is the right-hand side. It is the most readable ' +
        'parser there is, and its structure is literally the grammar, which is why it is what ' +
        'most production compilers actually use.',
      '**"Predictive" means the guess is decided by lookahead rather than by trying.** With one ' +
        'token of lookahead the parser consults a table indexed by (nonterminal, next token) and ' +
        'gets exactly one production, or an error. No backtracking means linear time and means a ' +
        'syntax error is detected at the first token that cannot continue any valid parse.',
      '**FIRST(α) is the set of terminals that can begin a string derived from α.** It is what ' +
        'the table is made of: a production `A → α` goes in the cells for every terminal in ' +
        'FIRST(α), because seeing that terminal is evidence this production is the right guess.',
      '**FOLLOW(A) is the set of terminals that can appear immediately after A.** It is needed ' +
        'only for nullable right-hand sides: if `A → α` and α can derive nothing, then choosing ' +
        'that production means A contributes nothing, so the deciding token is whatever comes ' +
        'AFTER A. That is the one subtlety in the table construction, and the demo labels each ' +
        'cell with which of the two rules put it there.',
      '**A cell with two productions is a conflict, and there are exactly three causes.** Left ' +
        'recursion, where `A → A α` and `A → β` both start with FIRST(β); a shared prefix, where ' +
        'two alternatives begin with the same symbol; or genuine ambiguity, where no rewrite ' +
        'helps. The demo names which, because the remedy is different for each.',
      '**Left recursion is fatal to top-down parsing, and it is fatal for a concrete reason.** ' +
        'The function for E calls the function for E as its first action, with no input consumed ' +
        'between the calls, so the stack grows without the input shrinking. It is not a subtle ' +
        'limitation; it is an infinite loop.',
      '**LL(k) and LL(*) extend the lookahead, and they do not extend the class much.** More ' +
        'lookahead resolves shared prefixes of bounded length and does nothing for left ' +
        'recursion or ambiguity. ANTLR\'s LL(*) goes further by running a sub-parse to decide, ' +
        'which is powerful and makes the cost of a decision unbounded.',
      '**The error detection point is the parser\'s best feature.** Because there is no ' +
        'backtracking, the parser fails at the exact token where no continuation exists, and the ' +
        'table row says which terminals WOULD have continued. That is a usable error message ' +
        'for free, and it is the reason the error-recovery section can do something intelligent ' +
        'with a top-down parser.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — build the LL(1) table, read every cell back to its cause',
        markup: root.LlTemplate.render()
      },
      diagram: diagram(),
      insight: '**Hand-written recursive descent is what most production compilers use — Clang, ' +
        'Roslyn, Go and V8 all parse this way — because error messages and context-sensitive ' +
        'hacks matter more than grammar purity.** A generated parser gives you a proof that the ' +
        'grammar is unambiguous and an error message that says "unexpected token". A ' +
        'hand-written one gives you neither guarantee and lets you say "missing semicolon after ' +
        'the return value on line 40; did you mean to end the statement?" — and lets you consult ' +
        'the symbol table mid-parse, which every real language needs somewhere. The trade is ' +
        'real and the industry has made it consistently in one direction. Use a generator to ' +
        'VALIDATE your grammar in CI, and write the parser by hand.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LlTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function repaired(grammar, repair) {
    if (repair === 'left-recursion') {
      return root.GrammarTransform.eliminateLeftRecursion(grammar).grammar;
    }
    if (repair === 'left-factor') return root.GrammarTransform.leftFactor(grammar).grammar;
    if (repair === 'both') {
      return root.GrammarTransform.leftFactor(
        root.GrammarTransform.eliminateLeftRecursion(grammar).grammar).grammar;
    }
    return grammar;
  }

  const stateFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const grammar = repaired(root.ParseLab.fixture(parts[0]), parts[1]);
    const built = root.LlParser.table(grammar);
    const analysis = root.Grammar.first(grammar);

    return {
      grammar: grammar, built: built, analysis: analysis,
      follows: root.Grammar.follow(grammar, analysis),
      diagnosis: root.LlParser.diagnose(grammar),
      examples: built.conflicts.map(function (conflict) {
        return root.LlParser.conflictExample(grammar, conflict, 5);
      })
    };
  });

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const state = stateFor(parts[0] + '\n' + parts[1]);
    const tokens = parts[2].split(' ').filter(function (part) { return part !== ''; });

    return root.LlParser.parse(state.grammar, tokens, state.built);
  });

  const repairsFor = root.Helpers.memoise(function (name) {
    return REPAIRS.map(function (repair) {
      const state = stateFor(name + '\n' + repair);

      return { repair: repair, productions: state.grammar.productions.length,
        conflicts: state.built.conflicts.length, isLL1: state.built.isLL1 };
    });
  });

  function update() {
    const values = panel.values();
    const key = values['llp-grammar'] + '\n' + values['llp-fix'];
    const state = stateFor(key);
    const run = runFor(key + '\n' + values['llp-input']);

    paintMetrics(state, run);
    paintSets(state);
    paintTable(state);
    paintTrace(state, run);
    paintConflicts(state);
    paintRepairs(values['llp-grammar']);
  }

  function paintMetrics(state, run) {
    root.MetricGrid.update({
      'llp-isll1': { value: state.built.isLL1 ? 'yes' : 'no',
        note: state.built.isLL1
          ? 'every cell holds at most one production, so the parse loop never has to choose'
          : 'at least one cell holds two, and the loop has no mechanism for trying both' },
      'llp-conflicts': { value: root.Format.exact(state.built.conflicts.length),
        note: root.Format.exact(state.grammar.productions.length) + ' productions across ' +
          root.Format.exact(state.grammar.nonterminals.length) + ' nonterminals' },
      'llp-cause': { value: causeOf(state.diagnosis),
        note: state.diagnosis.remedy },
      'llp-parse': { value: run.accepted ? 'accepted' : 'rejected',
        note: run.accepted
          ? root.Format.exact(run.steps.length) + ' steps, no backtracking anywhere'
          : (run.steps.length
            ? String(run.steps[run.steps.length - 1].action)
            : 'the parse produced no steps') }
    });
  }

  function causeOf(diagnosis) {
    if (diagnosis.isLL1) return 'nothing to fix';
    if (diagnosis.leftRecursive.length) return 'left recursion';
    if (diagnosis.sharedPrefixes.length) return 'a shared prefix';
    return 'ambiguity';
  }

  function paintSets(state) {
    const nullable = root.Grammar.nullable(state.grammar);

    root.jQuery('#llp-sets tbody').html(state.grammar.nonterminals.map(function (name) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(name) + '</td>' +
        '<td class="mono">' + (nullable[name] ? 'yes' : 'no') + '</td>' +
        '<td class="mono">' + setText(state.analysis.sets[name]) + '</td>' +
        '<td class="mono">' + setText(state.follows[name]) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('llp-sets-note',
      'FIRST answers "what can start this", FOLLOW answers "what can come after this", and ' +
      'nullable answers "can this derive nothing". The third column is what puts a production ' +
      'in a cell; the fourth is only consulted when the right-hand side is nullable, and that ' +
      'is the only place FOLLOW is used in the whole construction. Computing all three needs a ' +
      'fixed point, because a nonterminal\'s FIRST set depends on the FIRST sets of the ' +
      'nonterminals it can start with, which may include itself.');
  }

  function setText(set) {
    const keys = Object.keys(set || {}).sort();

    return keys.length ? root.Helpers.escapeHtml(keys.join(' ')) : '∅';
  }

  function paintTable(state) {
    root.jQuery('#llp-table').html(root.ParseTableView.llMarkup(state.built, {
      caption: 'LL(1) table for ' + (state.grammar.label || 'the grammar')
    }));

    root.Helpers.setText('llp-table-note',
      'Hover any filled cell for the rule that put it there — "FIRST of the right-hand side" or ' +
      '"the right-hand side is nullable, so FOLLOW". A highlighted cell holds two productions, ' +
      'which is the definition of not being LL(1). An empty cell is not a defect: it is the ' +
      'parser knowing that this nonterminal cannot begin with this token, and it is exactly ' +
      'where a good error message comes from, because the row names every token that WOULD have ' +
      'worked.');
  }

  function paintTrace(state, run) {
    root.jQuery('#llp-trace tbody').html(run.steps.slice(0, 16).map(function (step, i) {
      return '<tr><td class="mono">' + i + '</td><td class="mono">' +
        root.Helpers.escapeHtml(step.stack.slice().reverse().join(' ')) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(step.lookahead) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(step.action) + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">—</td><td class="mono">—</td>' +
      '<td class="mono">no steps</td></tr>');

    root.Helpers.setText('llp-trace-note',
      'Each expand step replaces the top of the stack with a right-hand side, and the sequence ' +
      'of expands read top to bottom IS the leftmost derivation from the grammars section — ' +
      'which is what "top-down produces a leftmost derivation" means concretely. Notice there ' +
      'is never a step that undoes a previous one. That is the property being bought by ' +
      'insisting on one production per cell, and it is why an LL(1) parser is linear in the ' +
      'input length regardless of the grammar.');
  }

  function paintConflicts(state) {
    root.jQuery('#llp-conflict-table tbody').html(state.built.conflicts.map(
      function (conflict, i) {
        return '<tr><td class="mono">' + root.Helpers.escapeHtml(conflict.nonterminal) +
          ' on ' + root.Helpers.escapeHtml(conflict.terminal) + '</td><td class="mono">' +
          root.Helpers.escapeHtml(rule(conflict.first) + '  |  ' + rule(conflict.second)) +
          '</td><td>' + root.Helpers.escapeHtml(conflict.reason) + '</td><td class="mono">' +
          root.Helpers.escapeHtml(state.examples[i] || 'none up to length 5') + '</td></tr>';
      }).join('') || '<tr><td class="mono">—</td><td class="mono">no conflicts</td>' +
        '<td>this grammar is LL(1) as written</td><td class="mono">—</td></tr>');

    root.Helpers.setText('llp-conflict-note',
      'The last column is the part a generator never gives you: an actual input that reaches ' +
      'the conflicted cell, found by enumerating the language in length order. A conflict with ' +
      'no reachable input is a conflict in a part of the grammar nothing uses, and one with a ' +
      'four-token witness is a bug your users will hit on their first file — and the report ' +
      'above tells the two apart.');
  }

  function rule(production) {
    return production.lhs + ' → ' + (production.rhs.join(' ') || 'ε');
  }

  function paintRepairs(name) {
    root.jQuery('#llp-repairs tbody').html(repairsFor(name).map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.repair) + '</td>' +
        '<td class="mono">' + row.productions + '</td><td class="mono">' + row.conflicts +
        '</td><td class="mono">' + (row.isLL1 ? 'yes' : 'no') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('llp-repairs-note',
      'Read down the conflicts column. For a left-recursive expression grammar the repair works ' +
      'and the count reaches zero, at the cost of extra productions and a changed tree. For the ' +
      'dangling-else grammar it does not: left factoring pulls the shared `if` prefix out and ' +
      'the choice between having an `else` and not having one is still undecidable with one ' +
      'token of lookahead, because the deciding token is arbitrarily far away. That is the ' +
      'difference between a grammar that is awkward and a grammar that is ambiguous, and no ' +
      'amount of transformation crosses it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
