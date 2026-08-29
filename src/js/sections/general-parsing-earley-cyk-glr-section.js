/**
 * Section: general parsing — Earley, CYK and GLR.
 *
 * Two measurements carry this section. The first is agreement: three parsers
 * with completely different mechanisms give the same verdict on every input,
 * including the nullable grammar that breaks naive Earley implementations and
 * the left-recursive one that a top-down parser cannot touch at all.
 *
 * The second is the point of a shared packed parse forest. As the input grows
 * the forest grows quadratically and the number of distinct trees grows like
 * the Catalan numbers — twenty-one tokens give eighty-seven forest nodes and
 * sixteen thousand seven hundred and ninety-six trees. That gap is why general
 * parsers hand you a forest rather than a list.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'general-parsing-earley-cyk-glr';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one Earley chart column and the three operations that fill it',
      caption: 'Earley keeps one column per input position, holding items of the form ' +
        '"production, dot, ORIGIN" — the origin being the column where this attempt started. ' +
        'Three operations fill a column and nothing else does. PREDICT: a dot before a ' +
        'nonterminal adds that nonterminal\'s productions with the dot at the start and the ' +
        'origin set to here. SCAN: a dot before a terminal that matches the input copies the ' +
        'item forward into the next column with the dot advanced. COMPLETE: an item whose dot ' +
        'has reached the end goes back to its ORIGIN column and advances every item there that ' +
        'was waiting for this nonterminal. That is the whole algorithm, and the origin field is ' +
        'what makes it work — it is how a completion knows where to return to.',
      definition: [
        'graph TD',
        '    A["column 2, item: E → E + • E, origin 0"] -->|predict| B["E → • E + E, origin 2"]',
        '    A -->|predict| C["E → • a, origin 2"]',
        '    C -->|scan a| D["column 3: E → a •, origin 2"]',
        '    D -->|"complete, return to<br/>origin 2"| E["column 3: E → E + E •, origin 0"]',
        '    E -->|"complete, return to<br/>origin 0"| F["the start symbol spans the whole input"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A general parser accepts every context-free grammar as data, with no build step and no ' +
        'conflict report.** That is a different product from a parser generator: you hand it a ' +
        'grammar at runtime and it parses. Anything that must treat grammars as input — a ' +
        'linter for many languages, a natural-language tool, a syntax-definition format — ends ' +
        'up here for that reason alone.',
      '**CYK is the simple one: dynamic programming over spans, in O(n³).** Convert the grammar ' +
        'to Chomsky normal form so every rule is `A → B C` or `A → a`, then fill a triangular ' +
        'table where cell (i, j) holds every nonterminal deriving the substring from i to j. It ' +
        'is four lines of loops and it is cubic on everything, including grammars a linear ' +
        'parser would handle.',
      '**Earley is the practical one, and its cost adapts to the grammar.** Cubic in the worst ' +
        'case, quadratic on unambiguous grammars, and linear on the grammars an LR parser ' +
        'handles — so you pay for generality only where you use it. No normal form is needed and ' +
        'the tree keeps the shape of the grammar you wrote.',
      '**Left recursion is free in Earley and ε-rules are the part implementations get wrong.** ' +
        'A nullable nonterminal can be completed in the same column it was predicted in, so a ' +
        'prediction made after the completion never learns about it. The fix (Aycock and ' +
        'Horspool) is to advance the predicting item immediately when the predicted nonterminal ' +
        'is nullable. The demo\'s `S → A A A A` with `A → a | ε` is the standard witness, and a ' +
        'naive implementation rejects the empty string on it.',
      '**GLR is an LR parser that forks instead of failing.** A conflicted cell offers two ' +
        'actions and GLR takes both, with a graph-structured stack so the branches share their ' +
        'common prefix and merge back when they reach the same state at the same position. On ' +
        'the deterministic parts of a grammar it runs at LR speed, because there are no forks.',
      '**A shared packed parse forest is one node per (symbol, span), with alternative ' +
        'derivations packed into it.** That is what keeps an exponential number of trees in a ' +
        'polynomial amount of memory. The demo\'s growth table shows the two curves diverging: ' +
        'the forest grows quadratically and the tree count grows like the Catalan numbers.',
      '**Unfolding the forest is where the exponential is waiting.** Asking a general parser for ' +
        '"the parse tree" of an ambiguous input is a category error; asking for the forest and ' +
        'then filtering it — by a precedence rule, by a type check, by which reading names a ' +
        'declared symbol — is the technique real GLR front ends use.',
      '**Generality has a real cost and the right question is where you pay it.** A hand-written ' +
        'recursive-descent parser for a fixed language will beat all three of these and cannot ' +
        'be handed a grammar. These parsers exist for the cases where the grammar is input, ' +
        'where the ambiguity is genuine, or where the language is not quite deterministic and ' +
        'you would rather not find out which parts by trial.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — fill an Earley chart, then read the forest it built',
        markup: root.GeneralTemplate.render()
      },
      diagram: diagram(),
      insight: '**Earley handles left recursion, ambiguity and ε-rules with no grammar ' +
        'massaging, which is why it keeps reappearing in tools that must accept a grammar as ' +
        'data rather than as a build step.** Every transformation in the transformations section ' +
        'exists to make a grammar fit a parser; Earley needs none of them, so the grammar in the ' +
        'file is the grammar that runs and an error message can quote the rule the author wrote. ' +
        'That is worth a constant factor in a tool where grammars change often or come from ' +
        'users — a syntax-definition language, a teaching tool, a linter that ships new rules ' +
        'weekly. It is not worth it in a compiler for one fixed language, where the grammar is ' +
        'compiled once and the parser runs a billion times.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.GeneralTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function tokensOf(text) {
    return String(text).split(' ').filter(function (part) { return part !== ''; });
  }

  const stateFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const grammar = root.ParseLab.fixture(parts[0]);
    const tokens = tokensOf(parts[1]);
    const earley = root.Earley.parse(grammar, tokens);
    const glr = root.Glr.parse(grammar, tokens);

    return {
      grammar: grammar, tokens: tokens, earley: earley, glr: glr,
      cyk: root.Cyk.parse(grammar, tokens),
      trees: root.Earley.trees(earley, 30),
      glrTrees: root.Glr.trees(glr, 30),
      items: earley.columns.reduce(function (total, column) {
        return total + column.length;
      }, 0)
    };
  });

  /** The forest against the tree count as the input grows — the measurement
   *  that makes "shared packed" mean something. */
  const growthFor = root.Helpers.memoise(function (name) {
    const grammar = root.ParseLab.fixture(name);

    return [3, 5, 7, 9, 11].map(function (operands) {
      const tokens = sumOf(grammar, operands);
      const glr = root.Glr.parse(grammar, tokens);

      return { operands: operands, tokens: tokens.length, nodes: glr.nodes,
        ambiguous: glr.ambiguous,
        trees: root.Earley.ambiguity(grammar, tokens, 40000) };
    });
  });

  /** `a + a + …` for the sum grammars, and the shortest legal repeat for the
   *  others, so the growth table means something for every fixture. */
  function sumOf(grammar, operands) {
    if (grammar.terminals.indexOf('+') === -1) {
      const unit = shortestWord(grammar);

      return repeat(unit, operands);
    }
    const out = ['a'];

    for (let i = 1; i < operands; i += 1) { out.push('+'); out.push('a'); }
    return out;
  }

  function shortestWord(grammar) {
    const words = root.Grammar.language(grammar, 4).words
      .filter(function (word) { return word.length > 0; });

    return words.length ? words[0].split('') : ['a'];
  }

  function repeat(unit, times) {
    let out = [];

    for (let i = 0; i < times; i += 1) out = out.concat(unit);
    return out;
  }

  function update() {
    const values = panel.values();
    const state = stateFor(values['ear-grammar'] + '\n' + values['ear-input']);
    const column = Math.min(Number(values['ear-column']), state.earley.columns.length - 1);

    paintMetrics(state);
    paintAgreement(state);
    paintChart(state, column);
    paintForest(state);
    paintGrowth(values['ear-grammar']);
    paintCosts();
  }

  function paintMetrics(state) {
    const agree = state.earley.accepted === state.cyk.accepted
      && state.earley.accepted === state.glr.accepted;

    root.MetricGrid.update({
      'ear-accept': { value: state.earley.accepted ? 'yes' : 'no',
        note: agree ? 'Earley, CYK and GLR all agree'
          : 'DISAGREEMENT — Earley ' + state.earley.accepted + ', CYK ' + state.cyk.accepted +
            ', GLR ' + state.glr.accepted },
      'ear-trees': { value: root.Format.exact(state.trees.length) +
        (state.trees.length >= 30 ? '+' : ''),
      note: state.trees.length === state.glrTrees.length
        ? 'Earley and GLR unfold the same number of trees'
        : 'Earley ' + state.trees.length + ', GLR ' + state.glrTrees.length + ' — a bug' },
      'ear-forest': { value: root.Format.exact(state.glr.nodes),
        note: root.Format.exact(state.glr.ambiguous) +
          ' of them hold more than one derivation' },
      'ear-work': { value: root.Format.exact(state.items),
        note: 'items across ' + root.Format.exact(state.earley.columns.length) +
          ' columns, against ' + root.Format.exact(state.cyk.cells) + ' CYK cells' }
    });
  }

  function paintAgreement(state) {
    const rows = [
      { parser: 'Earley', verdict: state.earley.accepted,
        work: root.Format.exact(state.items) + ' chart items',
        made: root.Format.exact(state.earley.columns.length) + ' columns with origin links' },
      { parser: 'CYK', verdict: state.cyk.accepted,
        work: root.Format.exact(state.cyk.cells) + ' table cells',
        made: 'a CNF grammar of ' + root.Format.exact(state.cyk.cnf.productions.length) +
          ' rules, converted internally' },
      { parser: 'GLR', verdict: state.glr.accepted,
        work: root.Format.exact(state.glr.steps) + ' reductions, ' +
          root.Format.exact(state.glr.forks) + ' forks',
        made: root.Format.exact(state.glr.nodes) + ' forest nodes over ' +
          root.Format.exact(state.glr.states) + ' LR states' }
    ];

    root.jQuery('#ear-agree tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.parser + '</td><td class="mono">' +
        (row.verdict ? 'accepts' : 'rejects') + '</td><td class="mono">' + row.work +
        '</td><td>' + row.made + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ear-agree-note',
      'Three mechanisms with nothing in common — a chart of dotted items, a triangular table ' +
      'over a normalised grammar, and an LR automaton with a graph-structured stack — reaching ' +
      'the same verdict. That agreement is the test: they are run against each other over every ' +
      'string up to length four on every fixture, and a disagreement fails the build with the ' +
      'input named. The work column is where they differ, and it is the reason to prefer one: ' +
      'CYK pays cubically no matter what the grammar looks like, and Earley and GLR both do ' +
      'less on the parts of the grammar that are deterministic.');
  }

  function paintChart(state, column) {
    const rows = root.Earley.chartRows(state.earley, column);

    root.jQuery('#ear-chart tbody').html(rows.slice(0, 16).map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.rule) +
        (row.complete ? '  (complete)' : '') + '</td><td class="mono">' + row.origin +
        '</td><td class="mono">' + row.operation + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">—</td>' +
      '<td class="mono">this column is empty, which means the parse died here</td></tr>');

    root.Helpers.setText('ear-chart-note',
      'Column ' + column + ' of ' + (state.earley.columns.length - 1) + '. The origin column is ' +
      'the one to read: an item with origin 0 in column 3 means "something that started at the ' +
      'beginning of the input and has consumed three tokens". A COMPLETE item with origin 0 in ' +
      'the last column, for the start symbol, IS acceptance — the whole algorithm is arranged so ' +
      'that acceptance is a lookup rather than a separate check. The operation column says which ' +
      'of the three rules put the item there.');
  }

  function paintForest(state) {
    const rows = root.Glr.forestRows(state.glr);

    root.jQuery('#ear-forest-view').html(root.ParseTreeView.forestMarkup({
      forest: rows.map(function (row) {
        const parts = row.span.split('–');

        return { symbol: row.symbol, from: Number(parts[0]), to: Number(parts[1]),
          derivations: row.derivations, children: [] };
      }),
      tokens: Math.max(1, state.tokens.length),
      ariaLabel: 'the shared packed parse forest'
    }));

    root.jQuery('#ear-packings tbody').html(rows.slice(0, 10).map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.symbol) + ' ' + row.span +
        '</td><td class="mono">' + row.derivations + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.packings.join('  ·  ') || 'a terminal') + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">0</td>' +
      '<td class="mono">nothing parsed</td></tr>');

    root.Helpers.setText('ear-forest-note-2',
      'Every box is one (symbol, span) pair, placed by its span so the picture reads left to ' +
      'right like the input, and the highlighted ones hold more than one derivation. That is ' +
      'the sharing: two parses that agree about a sub-phrase point at the SAME node rather than ' +
      'each owning a copy, so the memory is proportional to the distinct sub-phrases and not to ' +
      'the number of parses. The table lists which productions were packed into each node.');
  }

  function paintGrowth(name) {
    root.jQuery('#ear-growth tbody').html(growthFor(name).map(function (row) {
      return '<tr><td class="mono">' + row.operands + '</td><td class="mono">' + row.tokens +
        '</td><td class="mono">' + row.nodes + '</td><td class="mono">' +
        root.Format.exact(row.trees) + (row.trees >= 40000 ? '+' : '') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ear-growth-note',
      'The two right-hand columns are the whole argument for a forest. The node count grows ' +
      'quadratically — it is bounded by the number of (symbol, span) pairs, which is the number ' +
      'of nonterminals times n²/2. The tree count for the ambiguous sum grammar is the Catalan ' +
      'sequence, so it passes sixteen thousand while the forest is still under a hundred nodes. ' +
      'A parser that returned a list of trees would exhaust memory on an expression a person ' +
      'could type; one that returns the forest hands you all of them in a kilobyte, and you ' +
      'unfold only the parts you need.');
  }

  function paintCosts() {
    const rows = [
      { parser: 'CYK', worst: 'O(n³) always, plus the CNF conversion',
        unambiguous: 'still O(n³) — the cost does not adapt',
        accepts: 'every context-free grammar, after conversion to CNF' },
      { parser: 'Earley', worst: 'O(n³), and O(n²) on unambiguous grammars',
        unambiguous: 'linear on the grammars an LR parser handles',
        accepts: 'every context-free grammar, as written' },
      { parser: 'GLR', worst: 'O(n^(k+1)) for a grammar with rules of length k',
        unambiguous: 'linear — with no conflicts there are no forks',
        accepts: 'every context-free grammar, via an LR table with conflicts' },
      { parser: 'GLL', worst: 'O(n³), a top-down counterpart to GLR',
        unambiguous: 'linear, and it keeps recursive descent\'s readability',
        accepts: 'every context-free grammar, left recursion included' },
      { parser: 'LALR', worst: 'linear',
        unambiguous: 'linear, and it refuses the grammar if the table conflicts',
        accepts: 'most deterministic context-free grammars' },
      { parser: 'Recursive descent', worst: 'linear if you write it that way',
        unambiguous: 'linear, and unbounded if you added backtracking',
        accepts: 'whatever you hand-coded — no class guarantee at all' }
    ];

    root.jQuery('#ear-costs tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.parser + '</td><td>' + row.worst + '</td><td>' +
        row.unambiguous + '</td><td>' + row.accepts + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ear-costs-note',
      'The middle column is the one that decides real projects. Earley and GLR both degrade to ' +
      'linear on the deterministic parts of a grammar, which means the cost of generality is ' +
      'paid only where the ambiguity is — a language that is LR everywhere except in three ' +
      'constructs costs almost nothing extra. CYK does not have that property and that is why, ' +
      'despite being the easiest of the three to implement, it is almost never what ships. The ' +
      'last row is the reminder that a hand-written parser has no class guarantee whatsoever: ' +
      'it accepts exactly what the code accepts, which is why the grammar file that documents ' +
      'it drifts.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
