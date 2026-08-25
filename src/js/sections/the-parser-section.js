/**
 * Section: The parser.
 *
 * The claim is totality, and the default sample is chosen to test it: two
 * malformed statements and one good one. A tree comes back, it contains error
 * nodes exactly where the input is broken, and the good statement is parsed
 * normally. Nothing throws. That is what makes an editor possible.
 *
 * The second measurement is the grouping table, which prints each expression
 * back with the minimum parentheses. `1 + 2 * 3 < 10 && !flag || done` prints
 * as itself, which is only true because the printer reads the same precedence
 * table the parser does — the disagreement that would show up here is exactly
 * the one 28.4's round-trip property is built to catch at scale.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'the-parser';
  let panel = null;

  /**
   * Three of these carry brackets the tree does not need, so the printer drops
   * them. Without those rows the table shows nine expressions printing back
   * unchanged, which demonstrates that the printer is faithful and says
   * nothing about whether it is MINIMAL — and minimality is the property that
   * makes it a consumer of the precedence table rather than a transcriber.
   */
  const GROUPING = [
    '1 + 2 * 3', '1 + (2 * 3)', '1 - 2 - 3', '1 - (2 - 3)', '((1)) + 2',
    '1 + 2 < 4 && x', '!a || b && c', '-a * b', 'f(x)(y)', 'a.b[0].c', 'a == b == c'
  ];

  const BINDS = {
    '||': 'loosest of all — everything else groups tighter',
    '&&': 'tighter than ||, looser than any comparison',
    '==': 'left to right, so a == b == c is (a == b) == c',
    '!=': 'the same power as ==',
    '<': 'tighter than equality, looser than arithmetic',
    '<=': 'the same power as <', '>': 'the same power as <', '>=': 'the same power as <',
    '+': 'left to right', '-': 'left to right, which is why 1 - 2 - 3 is (1 - 2) - 3',
    '*': 'tighter than + and -', '/': 'the same power as *', '%': 'the same power as *'
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the AST node families',
      caption: 'Two families and a hard line between them. A statement is executed for its ' +
        'effect and has no value; an expression has a value and no effect. Berugo blurs the ' +
        'line deliberately in one place — a block\'s last entry may be an expression without ' +
        'a semicolon, and then it is the block\'s value — which is what lets `if` be an ' +
        'expression and what the printer has to know about, because printing that tail with a ' +
        'semicolon would turn a block producing a number into one producing unit. The `error` ' +
        'node is in the expression family on purpose: it appears wherever an expression was ' +
        'required and could not be read, so everything downstream sees a tree of the shape it ' +
        'expects and only has to handle one unusual kind.',
      definition: [
        'graph TD',
        'N["node — every one carries a span"] --> I["items"]',
        'N --> S["statements"]',
        'N --> E["expressions"]',
        'I --> ID["letDecl · fnDecl · importDecl"]',
        'S --> SS["exprStmt · assign · whileStmt · forStmt"]',
        'S --> SC["returnStmt · breakStmt · continueStmt"]',
        'E --> EL["num · str · bool · name · unit"]',
        'E --> EO["unary · binary · call · field · index"]',
        'E --> EC["array · record · lambda"]',
        'E --> EX["ifExpr · matchExpr · block"]',
        'E --> ER["error — carries the span of what could not be read"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The parser is TOTAL: it always returns a tree.** Where the input is malformed the ' +
        'tree contains an `error` node carrying the span of what went wrong, and nothing ' +
        'throws. That single property is what makes an editor possible — a file being typed ' +
        'is malformed most of the time, and a parser that gives up at the first problem cannot ' +
        'colour it, fold it, or complete inside it.',
      '**Recursive descent for statements, Pratt for expressions, and the split is not ' +
        'arbitrary.** Statements are keyword-led: seeing `while` tells you exactly which ' +
        'function to call, and a function per statement form reads like the grammar. ' +
        'Expressions are not keyword-led, they are precedence-led, and a precedence table is ' +
        'data — encoding it as a cascade of `parseAdditive` calling `parseMultiplicative` ' +
        'turns a table into control flow you have to rewrite to add an operator.',
      '**Every node carries a span, and this is the whole basis of everything downstream.** ' +
        'Diagnostics underline with it, go-to-definition jumps with it, rename edits with it, ' +
        'and the desugarer copies it forward so a message about generated code still points at ' +
        'something a human typed. Spans are not overhead; they are the only channel through ' +
        'which the compiler can talk about a place.',
      '**Two binding powers per operator, not one, and the difference encodes associativity.** ' +
        '`+` has left power 9 and right power 10. When the Pratt loop asks "may I take this ' +
        'operator", it compares against the minimum, and making the right power one higher is ' +
        'what stops `1 - 2 - 3` from grouping as `1 - (2 - 3)`. A right-associative operator ' +
        'sets them the other way round; that is the entire mechanism.',
      '**Parse first, then validate what the grammar cannot say.** The grammar cannot express ' +
        '"the left side of an assignment must be a name, a field or an index" without ' +
        'duplicating the whole expression grammar. So the parser reads any expression and then ' +
        'checks the shape, which produces a message about assignment rather than a syntax ' +
        'error about an unexpected `=`. Nearly every real grammar has three or four of these.',
      '**Recovery is a design decision with a visible consequence.** When an expression cannot ' +
        'be read, this parser emits an error node and resynchronises at the next statement ' +
        'boundary — the semicolon. That is why one broken statement costs one diagnostic and ' +
        'the statements after it still parse. Resynchronising at the wrong token is how a ' +
        'compiler produces forty errors for one missing brace.',
      '**The precedence table lives in `ast.js`, not in the parser, and the printer reads the ' +
        'same one.** That is deliberate: a printer with its own idea of precedence emits ' +
        'brackets the parser does not need or omits ones it does, and either way the ' +
        'round-trip property fails. Sharing the table makes a disagreement impossible rather ' +
        'than merely unlikely, which is what makes 28.4\'s property test measure something ' +
        'real.',
      '**A block\'s last entry may be an expression, and then it is the block\'s value.** That ' +
        'is what makes `if` an expression, and it is the one place where the statement and ' +
        'expression families meet. It also means the parser has to decide, at the end of a ' +
        'block, whether it just read a statement or a value — one lookahead at the semicolon, ' +
        'and a mistake there silently changes what a function returns.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — a tree that always exists, and the table that shapes it',
        markup: root.ParserTemplate.render()
      },
      diagram: diagram(),
      insight: '**Spans on every node are not overhead — they are the entire basis of every ' +
        'diagnostic, refactoring and code action the language will ever support.** It is easy ' +
        'to believe otherwise while writing the parser, because at that moment the only ' +
        'consumer is the type checker and the type checker could manage with line numbers. ' +
        'The cost shows up later and all at once: without spans there is no underline, so ' +
        'diagnostics point at lines; without spans on the *right* nodes there is no ' +
        'go-to-definition, because a definition is a range and not a line; without spans ' +
        'preserved through desugaring, a message about a lowered `for` loop points at ' +
        'generated code. Each of those is individually survivable and together they are the ' +
        'difference between a compiler and a language. The tell that a parser has this wrong ' +
        'is a span that is missing an end — it looks fine in the tree, it underlines nothing, ' +
        'and nobody notices until an editor tries to use it. This parser produced ten such ' +
        'nodes per conformance run until an audit went looking, and every one of them came ' +
        'from a helper that read `end.end` on something that carried its end inside `span`.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ParserTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const parseFor = root.Helpers.memoise(function (source) {
    const parsed = root.Berugo.Parser.parse(source);

    return Object.assign({ rows: treeRows(parsed.tree),
      depth: root.Berugo.Ast.depth(parsed.tree),
      errorNodes: root.Berugo.Ast.collect(parsed.tree, function (node) {
        return node.kind === 'error';
      }) }, parsed);
  });

  const groupingFor = root.Helpers.memoise(function () {
    return GROUPING.map(function (text) {
      const parsed = root.Berugo.Parser.parse('let v = ' + text + ';');
      const value = parsed.tree.items[0].value;

      return { written: text, printed: root.Berugo.Ast.print(value),
        nodes: root.Berugo.Ast.countNodes(value) };
    });
  });

  function treeRows(tree) {
    return root.AstView.rows(tree, {
      childrenOf: function (node) { return root.Berugo.Ast.childrenOf(node); },
      label: function (node) { return node.kind; },
      detail: describeNode
    });
  }

  function describeNode(node) {
    if (node.name !== undefined) return node.name;
    if (node.op !== undefined) return node.op;
    if (node.value !== undefined) return JSON.stringify(node.value);
    if (node.why !== undefined) return node.why;
    return '';
  }

  function update() {
    const values = panel.values();
    const source = root.ParserTemplate.SAMPLES[values['pr-sample']];
    const parsed = parseFor(source);
    const index = Math.min(Number(values['pr-node']), parsed.rows.length - 1);

    panel.disable('pr-node', parsed.rows.length <= 1);
    paintMetrics(parsed, index);
    paintSource(source, parsed.rows[index]);
    paintTree(parsed, index);
    paintProblems(source, parsed);
    paintPrecedence();
    paintGrouping();
  }

  function paintMetrics(parsed, index) {
    const row = parsed.rows[index];
    const problems = parsed.errors.length;

    root.MetricGrid.update({
      'pr-nodes': { value: root.Format.exact(root.Berugo.Ast.countNodes(parsed.tree)),
        note: problems ? 'built from input the parser could not fully read — and it is still a tree'
          : 'every one carrying a span' },
      'pr-errors': { value: parsed.errorNodes.length + ' / ' + problems,
        note: problems ? 'error nodes in the tree, and problems reported — nothing threw'
          : 'this sample parses cleanly' },
      'pr-depth': { value: root.Format.exact(parsed.depth),
        note: 'the deepest chain of nested nodes, which is how far the recursion went' },
      'pr-selected': { value: row ? row.label : '—',
        note: row ? 'characters ' + row.span.start + ' to ' + row.span.end +
          (row.detail ? ' — ' + row.detail : '') : 'nothing selected' }
    });
  }

  function paintSource(source, row) {
    root.AstView.render(document.getElementById('pr-source'),
      root.AstView.sourceMarkup(source, row ? row.span : null));

    root.Helpers.setText('pr-source-caption',
      'The highlight is the selected node\'s span, and it is the same pair of offsets the ' +
      'diagnostics, the renamer and the desugarer all use. Sliding the selector walks the tree ' +
      'in source order, so the highlight only ever grows and shrinks — a span that jumped ' +
      'around would mean a node had inherited the wrong one.');
  }

  function paintTree(parsed, index) {
    root.AstView.render(document.getElementById('pr-tree'),
      root.AstView.treeMarkup(parsed.rows, { selected: index }));

    root.Helpers.setText('pr-tree-caption', parsed.rows.length + ' rows, indented by depth. ' +
      (parsed.errorNodes.length
        ? 'The ' + parsed.errorNodes.length + ' error node' +
          (parsed.errorNodes.length === 1 ? '' : 's') + ' sit exactly where the input broke, ' +
          'and everything around them is an ordinary tree — which is the property that lets ' +
          'the resolver and the checker run on a file that does not compile.'
        : 'No error nodes: this sample parses cleanly, so the tree is exactly what the grammar ' +
          'describes.'));
  }

  function paintProblems(source, parsed) {
    root.jQuery('#pr-problems tbody').html(parsed.errors.map(function (entry) {
      const at = root.Berugo.Lexer.position(source, entry.span.start);
      const covered = parsed.errorNodes.some(function (node) {
        return node.span.start <= entry.span.start && node.span.end >= entry.span.start;
      });

      return '<tr><td class="mono">' + root.Helpers.escapeHtml(entry.code) +
        '</td><td class="mono">' + at.line + ':' + at.column + '</td><td>' +
        root.Helpers.escapeHtml(entry.message) + '</td><td>' +
        (covered ? 'an error node in the tree' : 'a token inserted and parsing continued') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="4">this sample parses cleanly — switch to the ' +
      'malformed source to watch recovery</td></tr>');

    root.Helpers.setText('pr-problems-caption',
      'Two kinds of recovery, and the last column says which happened. Where an expression ' +
      'was required and none could be read, an error node goes into the tree and carries the ' +
      'span; where a specific token was required, the parser reports it missing and carries ' +
      'on as if it were there. The second is why a missing semicolon costs one message rather ' +
      'than derailing the rest of the file — and getting the resynchronisation point wrong is ' +
      'exactly how a compiler produces forty errors for one missing brace.');
  }

  function paintPrecedence() {
    const table = root.Berugo.Ast.PRECEDENCE;
    const ops = Object.keys(table).sort(function (a, b) {
      return table[a].left - table[b].left;
    });

    root.jQuery('#pr-precedence tbody').html(ops.map(function (op) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(op) + '</td><td class="mono">' +
        table[op].left + '</td><td class="mono">' + table[op].right +
        '</td><td>left</td><td>' + root.Helpers.escapeHtml(BINDS[op] || '') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pr-precedence-caption',
      ops.length + ' binary operators over ' +
      (new Set(ops.map(function (op) { return table[op].left; }))).size +
      ' distinct precedence levels, plus unary at ' + root.Berugo.Ast.UNARY_POWER +
      ' and postfix — call, field and index — at ' + root.Berugo.Ast.POSTFIX_POWER +
      '. Every right power is exactly one more than its left power, which is what makes all ' +
      'of them left-associative. A right-associative operator such as exponentiation would ' +
      'set the right power one LOWER, and that one-line change is the whole of associativity ' +
      'in a Pratt parser.');
  }

  function paintGrouping() {
    const rows = groupingFor('all');
    const unchanged = rows.filter(function (row) { return row.written === row.printed; }).length;

    root.jQuery('#pr-grouping tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.written) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.printed) +
        '</td><td class="mono">' + row.nodes + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pr-grouping-caption',
      'Each row is parsed and then printed back with the fewest parentheses the parser needs, ' +
      'so the middle column is the tree made readable. ' + unchanged + ' of ' + rows.length +
      ' print back exactly as written; the other ' + (rows.length - unchanged) +
      ' had brackets the tree does not need and lost them. That pair is the point. ' +
      '`1 - (2 - 3)` keeps its brackets because removing them would change the tree, while ' +
      '`1 + (2 * 3)` loses them because `*` already binds tighter — and a printer that could ' +
      'only manage the first would be faithful without being minimal. This is the same ' +
      'machinery 28.4 turns into a property over ten thousand generated programs.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
