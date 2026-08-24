/**
 * Section: Pratt parsing and expression precedence.
 *
 * The measurement is the tree shape, printed as a fully parenthesised string,
 * against an expected parenthesisation. Precedence claims are exactly the kind
 * that sound right and are wrong, so every case in the table has a written
 * expectation and a match column — and the binding-power controls let a learner
 * break one deliberately and watch the shape change while the input does not.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'pratt-parsing-and-precedence';
  const CASES = [
    { text: 'a + b * c', expected: '(a + (b * c))' },
    { text: 'a * b + c', expected: '((a * b) + c)' },
    { text: 'a + b + c', expected: '((a + b) + c)' },
    { text: 'a ^ b ^ c', expected: '(a ^ (b ^ c))' },
    { text: 'a + b * c ^ d', expected: '(a + (b * (c ^ d)))' },
    { text: '- a + b', expected: '((- a) + b)' },
    { text: 'a ++ + b', expected: '((a ++) + b)' },
    { text: 'a ? b : c ? d : e', expected: '(a ? b : (c ? d : e))' },
    { text: '( a + b ) * c', expected: '((a + b) * c)' },
    { text: 'a && b || c', expected: '((a && b) || c)' }
  ];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — binding powers driving the parse of a + b * c ^ d',
      caption: 'The parser reads `a`, then loops while the next operator binds tighter than the ' +
        'limit it was called with. At the top level the limit is 0, so `+` (power 50) continues; ' +
        'parsing its right operand recurses with a limit of 50, so `*` (power 60) continues but ' +
        'a second `+` would not; inside that, the limit is 60 and `^` (power 80) continues. Each ' +
        'nesting is one comparison, and the tree that comes out is exactly the parenthesisation ' +
        'the powers describe. Associativity is the one asymmetry: a LEFT-associative operator ' +
        'recurses with its own power, so an equal operator to the right stops the loop and ' +
        'closes the node; a RIGHT-associative one recurses with one less, so the equal operator ' +
        'continues and nests.',
      definition: [
        'graph TD',
        '    A["expression(limit 0)<br/>reads a"] -->|+ has power 50 > 0| B["+ node"]',
        '    B --> C["expression(limit 50)<br/>reads b"]',
        '    C -->|* has power 60 > 50| D["* node"]',
        '    D --> E["expression(limit 60)<br/>reads c"]',
        '    E -->|^ has power 80 > 60| F["^ node"]',
        '    F --> G["expression(limit 79)<br/>reads d"]',
        '    G -->|nothing left| H["(a + (b * (c ^ d)))"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Pratt parsing puts precedence in a table instead of in the grammar\'s shape.** A ' +
        'classical expression grammar encodes each precedence level as a nonterminal — `E → E + ' +
        'T`, `T → T * F`, `F → …` — so adding an operator means adding a level and rewriting the ' +
        'rules around it. A Pratt parser gives each token a binding power and adding an operator ' +
        'is one table row.',
      '**Every token has up to two meanings, and which one applies depends on position.** The ' +
        'NULL denotation is what a token means with nothing to its left: a literal, a variable, ' +
        'a prefix operator, an opening parenthesis. The LEFT denotation is what it means with an ' +
        'expression already to its left: an infix operator, a postfix operator, a call, an ' +
        'index. `-` has both, which is why unary and binary minus need no special case.',
      '**The whole algorithm is one loop with one comparison.** Parse a prefix, then while the ' +
        'next token binds tighter than the limit you were called with, consume it and let it ' +
        'absorb what is on its left. Recursion happens when an infix operator parses its right ' +
        'operand, and the limit it passes down is what encodes precedence.',
      '**Associativity is the `- 1`, and nothing else.** A left-associative operator recurses ' +
        'with a limit equal to its own power, so an equal-power operator on the right fails the ' +
        'strictly-greater test and the loop closes the node — giving `(a + b) + c`. A ' +
        'right-associative one recurses with one less, so the equal operator continues and ' +
        'nests, giving `a ^ (b ^ c)`. The demo\'s associativity control changes exactly that one ' +
        'value.',
      '**Prefix operators are handled by the null denotation and get a power too.** `- a + b` ' +
        'must parse as `(- a) + b` and not `- (a + b)`, which happens because unary minus ' +
        'recurses with a HIGH limit — high enough that `+` stops the inner loop immediately.',
      '**Postfix and mixfix operators fall out of the same machinery.** A postfix operator is a ' +
        'left denotation that consumes nothing to its right. A ternary is a left denotation that ' +
        'parses an expression, expects a token, and parses another. Function calls and array ' +
        'indexing are left denotations for `(` and `[`, which is why they naturally bind tighter ' +
        'than any arithmetic.',
      '**The table is data, so the operator set can change at runtime.** Languages with ' +
        'user-defined operators — Haskell, Swift, Scala — need exactly this: the parser reads a ' +
        'fixity declaration and inserts a row. A grammar-shaped precedence encoding cannot do ' +
        'that without regenerating the parser.',
      '**This is what real hand-written parsers do.** Clang, Roslyn, Go, V8, rustc and almost ' +
        'every serious language implementation parses expressions with precedence climbing or ' +
        'Pratt, and statements with plain recursive descent. It is not a curiosity; it is the ' +
        'mainstream technique, and it is short enough to fit on one screen.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — edit a binding power and watch the tree change',
        markup: root.PrattTemplate.render()
      },
      diagram: diagram(),
      insight: '**Pratt parsing gives you precedence as data rather than as grammar structure, ' +
        'which is why adding an operator to a real language parser is a one-line table change.** ' +
        'The consequence goes further than convenience: because the table is a value, the rest ' +
        'of the toolchain can read it. A formatter can decide where parentheses are redundant, a ' +
        'linter can warn about mixing operators whose relative precedence people get wrong, a ' +
        'macro system can accept a fixity declaration, and a pretty-printer can round-trip the ' +
        'tree without hard-coding a second copy of the precedence rules. Every one of those is a ' +
        'separate, drift-prone table when precedence lives in the shape of the grammar.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PrattTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  /** The standard table with the three controls applied. Rebuilding it per
   *  change is the point — the table is data, so editing it is editing a
   *  value rather than regenerating a parser. */
  function tableFor(plus, times, caret) {
    const spec = root.Pratt.standard();

    spec.infix['+'] = { power: Number(plus), right: false };
    spec.infix['-'] = { power: Number(plus), right: false };
    spec.infix['*'] = { power: Number(times), right: false };
    spec.infix['/'] = { power: Number(times), right: false };
    spec.infix['^'] = { power: 80, right: caret === 'right' };
    return spec;
  }

  const parseFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const spec = tableFor(parts[1], parts[2], parts[3]);

    return { spec: spec, result: root.Pratt.parse(spec, root.Pratt.tokenise(parts[0])) };
  });

  const casesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const spec = tableFor(parts[0], parts[1], parts[2]);

    return CASES.map(function (test) {
      const result = root.Pratt.parse(spec, root.Pratt.tokenise(test.text));

      return { text: test.text, got: result.text, expected: test.expected,
        match: result.text === test.expected && result.complete };
    });
  });

  function update() {
    const values = panel.values();
    const powers = values['prt-plus'] + '\n' + values['prt-times'] + '\n' + values['prt-caret'];
    const state = parseFor(values['prt-input'] + '\n' + powers);
    const cases = casesFor(powers);
    const baseline = parseFor(values['prt-input'] + '\n50\n60\nright');

    paintMetrics(state, baseline);
    paintTree(state);
    paintTable(state);
    paintCases(cases);
    paintGrammar();
    paintDenotations();
  }

  function paintMetrics(state, baseline) {
    root.MetricGrid.update({
      'prt-tree': { value: state.result.text || 'nothing parsed',
        note: state.result.complete
          ? 'every token consumed'
          : 'stopped after ' + state.result.consumed + ' tokens — the rest is unparsed' },
      'prt-depth': { value: root.Format.exact(root.Pratt.depth(state.result.tree)),
        note: 'each level is one operator that bound tighter than the one above it' },
      'prt-calls': { value: root.Format.exact(state.result.steps),
        note: 'one call per sub-expression; there is no backtracking anywhere in the loop' },
      'prt-changed': { value: state.result.text === baseline.result.text ? 'no' : 'YES',
        note: state.result.text === baseline.result.text
          ? 'the edited table gives the same tree as the C-like default for this input'
          : 'the default table gives ' + baseline.result.text }
    });
  }

  function paintTree(state) {
    root.jQuery('#prt-tree-view').html(state.result.tree
      ? root.ParseTreeView.markup({ tree: asTree(state.result.tree),
        ariaLabel: 'the expression tree' })
      : '<p class="mono" style="font-size:.85rem">nothing parsed</p>');

    root.Helpers.setText('prt-tree-caption',
      'Drag the binding power of `+` above the power of `*` and the tree for `a + b * c` ' +
      'restructures itself — same input, same parser, one number changed. That is the entire ' +
      'claim of this section made operational: precedence is not a property of the parser or ' +
      'of the grammar\'s shape, it is a number in a table, and the tree is a function of that ' +
      'number.');
  }

  /** The Pratt node shape rendered through the shared parse-tree view, so the
   *  picture matches every other tree in this milestone. */
  function asTree(node) {
    if (!node) return null;
    if (node.kind === 'atom') return root.Grammar.node(node.op, null);
    return root.Grammar.node(node.op, node.children.map(asTree));
  }

  function paintTable(state) {
    root.jQuery('#prt-table tbody').html(root.Pratt.tableRows(state.spec)
      .map(function (row) {
        return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.token) +
          '</td><td class="mono">' + row.position + '</td><td class="mono">' + row.power +
          '</td><td class="mono">' + row.associativity + '</td></tr>';
      }).join(''));

    root.Helpers.setText('prt-table-note',
      'Read the power column top to bottom and you have the language\'s precedence, in the order ' +
      'a reference manual would print it. The absolute numbers mean nothing — only the ordering ' +
      'matters — which is why the conventional gaps of ten exist: they leave room to insert an ' +
      'operator between two existing levels without renumbering. A token can appear twice with ' +
      'different positions, which is how `-` is both unary and binary and `!` is both logical ' +
      'negation and factorial without a special case anywhere in the parser.');
  }

  function paintCases(cases) {
    const failures = cases.filter(function (row) { return !row.match; }).length;

    root.jQuery('#prt-cases tbody').html(cases.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.text) + '</td>' +
        '<td class="mono">' + root.Helpers.escapeHtml(String(row.got)) + '</td>' +
        '<td class="mono">' + root.Helpers.escapeHtml(row.expected) + '</td>' +
        '<td class="mono">' + (row.match ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('prt-cases-note', failures === 0
      ? 'All ten expected parenthesisations match. These are assertions rather than ' +
        'illustrations: the expected column is written down, the got column is measured, and ' +
        'the same comparison runs in the test suite. Precedence is exactly the kind of thing ' +
        'that is obvious until it is wrong, so it gets asserted rather than eyeballed.'
      : root.Format.exact(failures) + ' of the ten cases no longer match, which is what the ' +
        'edited table did. That is the intended experiment: the expected column encodes the ' +
        'C-like conventions, and moving a binding power breaks exactly the cases that depend ' +
        'on the ordering you changed. Which ones broke tells you what that number controls.');
  }

  function paintGrammar() {
    const rows = [
      { level: 'lowest', rule: 'E → E "||" A | A', entry: "infix ||, power 10, left",
        adding: 'add a nonterminal and rewrite two rules | add one table row' },
      { level: '', rule: 'A → A "&&" C | C', entry: 'infix &&, power 20, left',
        adding: 'same | same' },
      { level: '', rule: 'C → C "==" R | R', entry: 'infix ==, power 30, left',
        adding: 'same | same' },
      { level: '', rule: 'R → R "+" T | T', entry: 'infix +, power 50, left',
        adding: 'same | same' },
      { level: '', rule: 'T → T "*" P | P', entry: 'infix *, power 60, left',
        adding: 'same | same' },
      { level: 'highest', rule: 'P → F "^" P | F', entry: 'infix ^, power 80, RIGHT',
        adding: 'note the rule shape flips to encode right associativity | one boolean' }
    ];

    root.jQuery('#prt-grammar tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.level + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.rule) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.entry) + '</td><td>' +
        root.Helpers.escapeHtml(row.adding) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('prt-grammar-note',
      'Six precedence levels, six nonterminals, and a parse of `a` that walks through all six ' +
      'of them to reach the literal — which is why grammar-encoded precedence is slow as well ' +
      'as awkward: every atom pays one function call per level. The last row is the ' +
      'associativity encoding: in the grammar, right associativity is expressed by recursing on ' +
      'the RIGHT of the operator and dropping to the next level on the left, so changing an ' +
      'operator\'s associativity means rewriting its rule. In the table it is a boolean.');
  }

  function paintDenotations() {
    const rows = [
      { position: 'Prefix', called: 'null denotation — nothing to its left yet',
        sees: 'nothing', example: '- a, ! flag, ~ mask, ( to open a group' },
      { position: 'Atom', called: 'null denotation', sees: 'nothing',
        example: 'a, 42, "text" — it returns itself and consumes one token' },
      { position: 'Infix', called: 'left denotation — an expression is already parsed',
        sees: 'the left operand', example: 'a + b, a * b, a ^ b' },
      { position: 'Postfix', called: 'left denotation, consuming nothing to the right',
        sees: 'the left operand', example: 'a ++, n !' },
      { position: 'Ternary', called: 'left denotation spanning two tokens',
        sees: 'the condition', example: 'a ? b : c' },
      { position: 'Call and index', called: 'left denotation for ( and [',
        sees: 'the callee or the array',
        example: 'f(x), a[i] — highest power, so they bind tighter than any operator' }
    ];

    root.jQuery('#prt-denotations tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.position + '</td><td>' + row.called + '</td><td>' +
        row.sees + '</td><td class="mono">' + root.Helpers.escapeHtml(row.example) +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('prt-denotations-note',
      'The last row is the one that surprises people the first time. A function call is not a ' +
      'special form in a Pratt parser — it is the token `(` in the left-denotation position, ' +
      'with a very high binding power, parsing a comma-separated list until `)`. The same token ' +
      'in the null-denotation position is a grouping parenthesis. That is why `f(x) + 1` and ' +
      '`(x) + 1` both work with no lookahead and no ambiguity: the parser already knows whether ' +
      'something is to the left of the bracket, and that is the only distinction needed.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
