/**
 * Section: grammars, derivations and ambiguity.
 *
 * The measurement is a tree count. "This grammar is ambiguous" is a claim
 * anyone can make; enumerating every parse tree for an input and printing both
 * shapes is a demonstration, and it is what makes the fix — a grammar rewritten
 * so the count drops to one — visible as a number rather than as an assertion.
 *
 * The shortest-witness search is the other half. A grammar is ambiguous if ANY
 * string has two trees, so the honest report is the shortest string that does,
 * found by enumerating in length order rather than by looking at the rules and
 * having an opinion.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'grammars-and-ambiguity';
  const GRAMMARS = ['ambiguousSum', 'leftRecursive', 'll1Ready', 'precedenceSum',
    'danglingElse', 'balanced'];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one input, two parse trees',
      caption: 'Both trees below have the leaves `a + a + a` in that order, and both are legal ' +
        'derivations from `E → E + E | a`. That is what ambiguity IS: not that the grammar is ' +
        'unclear, but that it licenses two distinct structures for one string. If `+` were ' +
        'subtraction the two trees would evaluate to different numbers, which is how an ' +
        'ambiguous grammar becomes a wrong answer rather than a style problem. The fix is a ' +
        'rewrite — a grammar with one nonterminal per precedence level can only build the tree ' +
        'on the left.',
      definition: [
        'graph TD',
        '    subgraph left [left-associative reading]',
        '    A[E] --> B[E]',
        '    A --> C["+"]',
        '    A --> D[E: a]',
        '    B --> E[E: a]',
        '    B --> F["+"]',
        '    B --> G[E: a]',
        '    end',
        '    subgraph right [right-associative reading]',
        '    H[E] --> I[E: a]',
        '    H --> J["+"]',
        '    H --> K[E]',
        '    K --> L[E: a]',
        '    K --> M["+"]',
        '    K --> N[E: a]',
        '    end'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A context-free grammar is a set of rewrite rules and nothing more.** Each production ' +
        'says one nonterminal may be replaced by a string of symbols, and the language is every ' +
        'terminal string you can reach from the start symbol. "Context-free" means the ' +
        'replacement never depends on what surrounds the nonterminal — that single restriction ' +
        'is what buys you an efficient parser and what a real language always ends up violating.',
      '**A derivation is a sequence of rewrites; a parse tree is what the sequence built.** The ' +
        'distinction matters because many derivations give the SAME tree. `E → E + E` expanded ' +
        'left-first and right-first produce different step sequences and one structure, so the ' +
        'derivation order is bookkeeping and the tree is the meaning.',
      '**Leftmost and rightmost derivations are the two canonical orders.** A top-down parser ' +
        'produces a leftmost derivation as it goes; a bottom-up parser produces a rightmost one ' +
        'in reverse. The demo shows both for the same tree, and they differ only in which ' +
        'nonterminal gets expanded next.',
      '**Ambiguity is two distinct TREES for one string, not two derivations.** The demo counts ' +
        'trees, which is why switching the derivation order never changes the count. A grammar ' +
        'is ambiguous if any string has two, so the useful report is the shortest string that ' +
        'does.',
      '**Ambiguity is a property of the grammar, not the language.** `a + a + a` is not ' +
        'ambiguous as a string — arithmetic has a settled meaning. The grammar failed to say ' +
        'which meaning, and the fix is a rewrite. A few languages are INHERENTLY ambiguous, ' +
        'meaning no unambiguous grammar exists for them, but those are curiosities and yours is ' +
        'almost certainly not one.',
      '**Precedence and associativity are encoded as grammar shape.** One nonterminal per level, ' +
        'with the tighter-binding level nested inside: `E → E + T`, `T → T * F`, `F → ( E ) | a`. ' +
        'Recursion on the left makes an operator left-associative because the left operand can ' +
        'grow and the right one cannot.',
      '**The dangling else is the ambiguity every language has.** `if a then if b then x else y` ' +
        'can attach the `else` to either `if`, and both parses are legal. Every real language ' +
        'resolves it the same way — bind to the nearest `if` — and almost none of them do it in ' +
        'the grammar; they do it by letting the parser generator prefer shift, which is the ' +
        'right answer arrived at by accident.',
      '**Two different grammars can define the same language.** The demo checks that: the ' +
        'ambiguous sum grammar and the precedence grammar accept exactly the same strings, ' +
        'verified over every string up to a length, while producing different trees. That is the ' +
        'whole reason a rewrite is a legitimate fix — and the whole reason it breaks everything ' +
        'downstream that consumed the old shape.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — enumerate every parse tree for an input',
        markup: root.GrammarsTemplate.render()
      },
      diagram: diagram(),
      insight: '**Ambiguity is a property of the grammar rather than of the language, so the ' +
        'fix is a rewrite — and "the parser generator picked one" is how precedence bugs ship.** ' +
        'A generator handed an ambiguous grammar does not stop; it reports a conflict count, ' +
        'resolves each one by a default rule, and produces a working parser that silently ' +
        'commits to one reading. That parser is correct for every input where the two readings ' +
        'agree, which is most of them, so the bug surfaces later as an expression that evaluates ' +
        'wrongly in one dialect. Treat a conflict count above zero as a compile error in your ' +
        'build, and rewrite until it is zero or you have written down which conflicts you ' +
        'deliberately accepted and why.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.GrammarsTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function grammarFor(name) { return root.ParseLab.fixture(name); }

  function tokensOf(text) {
    return String(text).split(' ').filter(function (part) { return part !== ''; });
  }

  const analysisFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const grammar = grammarFor(parts[0]);
    const tokens = tokensOf(parts[1]);
    const result = root.Earley.parse(grammar, tokens);
    const trees = root.Earley.trees(result, 12);

    return { grammar: grammar, tokens: tokens, result: result, trees: trees,
      derivation: trees.length ? derive(grammar, trees[0], parts[2]) : [] };
  });

  const witnessFor = root.Helpers.memoise(function (name) {
    return shortestAmbiguous(grammarFor(name), 7);
  });

  /**
   * The shortest input with two trees, by length then by enumeration order.
   * Searching rather than asserting is the point: a grammar is ambiguous
   * because a string exists, so the report names the string.
   */
  function shortestAmbiguous(grammar, maxLength) {
    const inputs = root.ParseLab.exhaustive(grammar.terminals, maxLength);

    for (let i = 0; i < inputs.length; i += 1) {
      const count = root.Earley.ambiguity(grammar, inputs[i], 4000);

      if (count > 1) {
        return { tokens: inputs[i], count: count,
          text: inputs[i].join(' ') || 'the empty string' };
      }
    }
    return null;
  }

  /**
   * Replay a tree as a derivation. Leftmost expands the first nonterminal in
   * the sentential form; rightmost the last — and both build the same tree,
   * which is the point of showing them side by side.
   */
  function derive(grammar, tree, order) {
    const steps = [{ form: [grammar.start], rule: 'start' }];
    let form = [{ symbol: grammar.start, tree: tree }];

    for (let guard = 0; guard < 60; guard += 1) {
      const at = pickNonterminal(grammar, form, order);

      if (at === -1) break;
      const node = form[at];
      const children = node.tree.children || [];

      form = form.slice(0, at).concat(children.map(function (child) {
        return { symbol: child.symbol, tree: child };
      })).concat(form.slice(at + 1));
      steps.push({ form: form.map(function (entry) { return entry.symbol; }),
        rule: node.symbol + ' → ' + (children.map(function (child) {
          return child.symbol;
        }).join(' ') || 'ε') });
    }
    return steps;
  }

  function pickNonterminal(grammar, form, order) {
    const indexes = form.map(function (entry, i) {
      return root.Grammar.isNonterminal(grammar, entry.symbol) && entry.tree.children ? i : -1;
    }).filter(function (i) { return i !== -1; });

    if (indexes.length === 0) return -1;
    return order === 'rightmost' ? indexes[indexes.length - 1] : indexes[0];
  }

  function update() {
    const values = panel.values();
    const state = analysisFor(values['gra-grammar'] + '\n' + values['gra-input'] + '\n' +
      values['gra-order']);
    const witness = witnessFor(values['gra-grammar']);

    paintMetrics(state, witness);
    paintRules(state);
    paintForest(state);
    paintDerivation(state, values['gra-order']);
    paintSweep(state);
    paintCompare();
  }

  function paintMetrics(state, witness) {
    root.MetricGrid.update({
      'gra-trees': { value: state.result.accepted ? root.Format.exact(state.trees.length)
        : 'rejected',
      note: state.result.accepted
        ? 'every distinct tree enumerated from the Earley chart, capped at twelve'
        : 'the input is not in the language, so there is nothing to count' },
      'gra-verdict': { value: state.trees.length > 1 ? 'YES' : 'no',
        note: state.trees.length > 1
          ? 'two derivations that differ in structure, not only in order'
          : 'one structure — or none, if the input was rejected' },
      'gra-steps': { value: root.Format.exact(Math.max(0, state.derivation.length - 1)),
        note: 'one production applied per step, ending at the terminal string' },
      'gra-shortest': { value: witness ? witness.text : 'none up to length 7',
        note: witness
          ? root.Format.exact(witness.count) + ' trees — the shortest input with more than one'
          : 'no string up to length 7 has two trees, which is evidence and not a proof' }
    });
  }

  function paintRules(state) {
    root.jQuery('#gra-rules').html(state.grammar.productions.map(function (rule) {
      return root.Helpers.escapeHtml(rule.lhs + ' → ' + (rule.rhs.join(' ') || 'ε'));
    }).join('<br>'));

    root.Helpers.setText('gra-rules-note',
      'The start symbol is ' + state.grammar.start + ', and a symbol is a nonterminal exactly ' +
      'when it has productions of its own — ' + state.grammar.nonterminals.join(', ') + ' here, ' +
      'against terminals ' + state.grammar.terminals.join(', ') + '. That rule is worth stating ' +
      'because it means you never declare the two sets: the grammar text determines them, and a ' +
      'typo in a nonterminal name silently creates a terminal nothing can match.');
  }

  function paintForest(state) {
    if (!state.trees.length) {
      root.jQuery('#gra-forest').html('<p class="mono" style="font-size:.85rem">' +
        'the input is not in this language</p>');
      root.Helpers.setText('gra-forest-note',
        'Earley rejected it, and Earley accepts every context-free grammar — so this is the ' +
        'language talking, not a parser limitation. The failure position is reported in the ' +
        'LL and LR sections, where a rejection has to become an error message.');
      return;
    }
    root.jQuery('#gra-forest').html(state.trees.slice(0, 3).map(function (tree, i) {
      return '<div style="margin-bottom:.5rem"><div class="mono" style="font-size:.8rem">' +
        'tree ' + (i + 1) + ': ' + root.Helpers.escapeHtml(root.Grammar.shape(tree)) + '</div>' +
        root.ParseTreeView.markup({ tree: tree, ariaLabel: 'parse tree ' + (i + 1) }) + '</div>';
    }).join(''));

    root.Helpers.setText('gra-forest-note', state.trees.length > 1
      ? 'Two trees, one string. Compare the shape lines: the leaves read the same left to right ' +
        'and the nesting differs, which is exactly the situation where an evaluator built on the ' +
        'tree gives two answers. ' + (state.trees.length > 3
        ? 'Only the first three of ' + state.trees.length + ' are drawn.' : '')
      : 'One tree, so this grammar is unambiguous on this input. That is not the same as being ' +
        'unambiguous — the metric above searched for the shortest input that has two, and it is ' +
        'the honest statement about the grammar as a whole.');
  }

  function paintDerivation(state, order) {
    root.jQuery('#gra-derivation tbody').html(state.derivation.map(function (step, i) {
      return '<tr><td class="mono">' + i + '</td><td class="mono">' +
        root.Helpers.escapeHtml(step.form.join(' ') || 'ε') + '</td><td class="mono">' +
        root.Helpers.escapeHtml(step.rule) + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">no derivation</td>' +
      '<td class="mono">the input was rejected</td></tr>');

    root.Helpers.setText('gra-derivation-note',
      'This is the ' + order + ' derivation of the FIRST tree. Switching the order changes ' +
      'which nonterminal is expanded next and therefore every intermediate line, and it does ' +
      'not change the tree or the tree count — which is the reason ambiguity is defined on ' +
      'trees. A top-down parser emits the leftmost derivation as it runs; a bottom-up parser ' +
      'emits the rightmost one backwards, which is why an LR trace reads as reductions in ' +
      'reverse.');
  }

  function paintSweep(state) {
    const inputs = root.ParseLab.exhaustive(state.grammar.terminals, 4).slice(0, 200);
    const rows = inputs.map(function (tokens) {
      const result = root.Earley.parse(state.grammar, tokens);
      const trees = result.accepted ? root.Earley.trees(result, 4) : [];

      return { tokens: tokens, trees: trees };
    }).filter(function (row) { return row.trees.length > 0; }).slice(0, 10);

    root.jQuery('#gra-sweep tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' +
        root.Helpers.escapeHtml(row.tokens.join(' ') || 'ε') + '</td><td class="mono">' +
        row.trees.length + '</td><td class="mono" style="font-size:.78rem">' +
        root.Helpers.escapeHtml(row.trees.map(root.Grammar.shape).join('  ·  ')) +
        '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">0</td>' +
      '<td class="mono">no string up to length 4 is in this language</td></tr>');

    root.Helpers.setText('gra-sweep-note',
      'Every string in the language up to length four, with its tree count and the shapes. This ' +
      'is what "the grammar is ambiguous" should always mean in practice: a list of inputs where ' +
      'the count exceeds one. A grammar can look suspicious and be fine, and it can look ' +
      'innocent and be ambiguous three tokens in — the enumeration settles it either way.');
  }

  function paintCompare() {
    root.jQuery('#gra-compare tbody').html(GRAMMARS.map(function (name) {
      const grammar = grammarFor(name);
      const witness = witnessFor(name);

      return '<tr><td>' + root.Helpers.escapeHtml(grammar.label) + '</td><td class="mono">' +
        (witness ? 'yes' : 'no witness up to length 7') + '</td><td class="mono">' +
        (witness ? root.Helpers.escapeHtml(witness.text) : '—') + '</td><td class="mono">' +
        sameAs(name) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('gra-compare-note',
      'The last column is checked rather than asserted: three of these grammars accept exactly ' +
      'the same strings — `a`, `a + a`, `a + a + a` and so on — and only the first of the ' +
      'three is ambiguous. That is the whole argument for rewriting rather than for suppressing ' +
      'conflicts: the rewrite is a different grammar for the SAME language, and the ambiguity ' +
      'goes with the grammar. The precedence grammar is deliberately not in that group, because ' +
      'it also has parentheses and a second operator, which makes it a different language and ' +
      'not a rewrite — a distinction worth keeping sharp.');
  }

  /** Which other fixtures define the same language, checked rather than
   *  assumed — the three sum grammars do, and the precedence grammar does not,
   *  because it also has parentheses and a second operator. */
  const sameAs = root.Helpers.memoise(function (name) {
    const others = GRAMMARS.filter(function (other) { return other !== name; })
      .filter(function (other) {
        return root.Grammar.sameLanguage(grammarFor(name), grammarFor(other), 5).same;
      });

    return others.length ? others.join(', ') : 'nothing else here';
  });

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
