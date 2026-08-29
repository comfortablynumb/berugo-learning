/**
 * Section: AST infrastructure.
 *
 * The measurement is a pair, and the pair is the point. The real printer
 * round-trips every generated program; a printer with one line changed — the
 * binding power dropped on the right operand — fails on a few per cent of the
 * same corpus. Reporting only the first number would be reporting that the
 * generator never produced anything hard. Reporting both says the property has
 * teeth and how sharp they are.
 *
 * The second measurement is stability under reformatting: the same tree
 * printed at three indent widths reparses to the same tree every time. That is
 * what "the formatter cannot change the program" means, stated as a check
 * rather than an intention.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'ast-infrastructure';
  let panel = null;

  const SAMPLE = 'fn total(xs) {\n  let sum = 0;\n  for x in xs { sum = sum + x * 2; }\n  return sum;\n}';

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — parse, print, reparse, and the invariant in the middle',
      caption: 'The round trip is a loop with an assertion across it. Text goes in, a tree ' +
        'comes out, the tree is printed back to text, and that text is parsed again. The two ' +
        'trees must be equal ignoring spans — ignoring, because the second parse assigns ' +
        'offsets into a different string and comparing those would fail on formatting alone. ' +
        'What the invariant catches is any disagreement between the parser and the printer ' +
        'about grouping, and the reason it catches it reliably is that both read one ' +
        'precedence table. The dashed edge is the one that does not have to hold: the printed ' +
        'text need not equal the original text, because the original had the author\'s ' +
        'whitespace in it.',
      definition: [
        'graph LR',
        'T1["source text"] --> P1["parse"]',
        'P1 --> A1["tree A"]',
        'A1 --> PR["print — minimum parentheses"]',
        'PR --> T2["printed text"]',
        'T2 --> P2["parse again"]',
        'P2 --> A2["tree B"]',
        'A1 -.->|"must be equal ignoring<br/>spans"| A2',
        'T1 -.->|"need NOT be equal"| T2'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The round-trip property is the cheapest parser test there is, and it finds more than ' +
        'any hand-written suite.** Parse, print, reparse, compare. It needs no expected ' +
        'output, so it can be run over generated programs by the thousand, and every failure ' +
        'is a genuine disagreement between two components that are supposed to agree.',
      '**It compares trees ignoring spans, and that is not a weakening.** The second parse ' +
        'assigns offsets into a different string — the printed one — so comparing spans would ' +
        'fail on formatting alone and the property would be untestable. What must survive is ' +
        'the structure: same kinds, same names, same nesting, same operators.',
      '**A minimal-parentheses printer is a precedence-table consumer, so a bug here proves a ' +
        'disagreement.** The rule is one line: a child needs brackets when its own binding ' +
        'power is lower than the power required at the position it sits in. Because the ' +
        'printer reads `ast.js`\'s table and so does the parser, the two cannot drift — and ' +
        'that is exactly what makes a failure informative rather than mysterious.',
      '**A property that has never failed is one you cannot trust.** So the demo runs a second ' +
        'printer with one line changed: the binding power required of the right operand is ' +
        'dropped to zero. That makes `1 - (2 - 3)` print as `1 - 2 - 3`, a different program. ' +
        'The failure rate of the broken printer is the property\'s sensitivity, and a suite ' +
        'that reports zero against it is measuring the generator rather than the printer.',
      '**Visitors carry the traversal so the callers do not.** `visit` walks with enter and ' +
        'exit hooks and an early exit; `collect` gathers nodes matching a predicate; `nodeAt` ' +
        'finds the innermost node containing an offset, which is the editor\'s only question. ' +
        'Every one of them is defined by one table — which children each node kind has — so ' +
        'adding a node kind means adding one line rather than auditing nine walkers.',
      '**Rewriting is immutable here, and that is a real trade.** Each lowering builds a new ' +
        'node rather than mutating in place, so an earlier tree stays valid and can be shown ' +
        'beside the later one. The cost is allocation; the benefit is that "the tree before" ' +
        'and "the tree after" both exist at once, which is what every stage-comparison view in ' +
        'this milestone depends on.',
      '**A formatter must not change the program, and that is a checkable claim.** The same ' +
        'tree printed at two spaces, four spaces and a tab produces three different strings, ' +
        'and all three must reparse to the same tree. The check costs three parses and it is ' +
        'the difference between a formatter you can run on commit and one you run and then ' +
        'read the diff of.',
      '**AST or CST is a decision about who the consumer is.** A concrete syntax tree keeps ' +
        'every token including the parentheses; an abstract one keeps the structure and lets ' +
        'the printer re-derive the brackets. Berugo keeps an AST plus trivia on the tokens, ' +
        'which is enough to format and not enough to reproduce the author\'s exact spacing — ' +
        'a deliberate limit, and the reason the round trip compares trees and not text.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the round trip, and what a broken printer costs',
        markup: root.AstInfraTemplate.render()
      },
      diagram: diagram(),
      insight: '**A minimal-parentheses printer is the parser\'s precedence table read ' +
        'backwards, so a bug in it proves the two disagree — and that is a much more valuable ' +
        'failure than a printing bug.** The temptation, when the printer is written second, is ' +
        'to give it its own idea of when brackets are needed, usually as a small set of ' +
        'special cases discovered by trying things. It works on every example anyone tries, ' +
        'because the examples people try are the ones they can hold in their head. What it ' +
        'cannot do is fail informatively: when the round trip breaks, you learn that one of ' +
        'two independent implementations of precedence is wrong, and you have to work out ' +
        'which. Sharing the table converts that class of bug into a class that cannot exist, ' +
        'and converts the round-trip property from a test of the printer into a test of the ' +
        'parser — which is where the interesting bugs are. The measurement that makes this ' +
        'concrete is the sabotage column: break the shared table\'s use in one place and a few ' +
        'per cent of generated programs stop round-tripping immediately.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.AstInfraTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const sweepFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');

    return root.Berugo.Fuzz.sabotage({ count: Number(parts[0]), seed: 1,
      maxDepth: Number(parts[1]) });
  });

  const differenceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const broken = root.Berugo.Fuzz.roundTripSweep({ count: Number(parts[0]), seed: 1,
      maxDepth: Number(parts[1]), printer: root.Berugo.Fuzz.brokenPrinter });

    return broken.failures.slice(0, 6);
  });

  const formatFor = root.Helpers.memoise(function () {
    const base = root.Berugo.Parser.parse(SAMPLE).tree;

    return ['  ', '    ', '\t'].map(function (indent) {
      const printed = root.Berugo.Ast.print(base, { indent: indent });
      const again = root.Berugo.Parser.parse(printed).tree;

      return { indent: indent, characters: printed.length,
        lines: printed.split('\n').length,
        same: root.Berugo.Ast.equalIgnoringSpans(base, again) };
    });
  });

  const visitFor = root.Helpers.memoise(function () {
    const tree = root.Berugo.Parser.parse(SAMPLE).tree;

    return [
      { query: 'How many nodes?', answer: String(root.Berugo.Ast.countNodes(tree)),
        touched: root.Berugo.Ast.countNodes(tree), how: 'visit with no hooks' },
      { query: 'How deep?', answer: String(root.Berugo.Ast.depth(tree)),
        touched: root.Berugo.Ast.countNodes(tree), how: 'one recursive max over children' },
      { query: 'Every name used', answer: nameList(tree),
        touched: root.Berugo.Ast.countNodes(tree),
        how: 'collect with a predicate on the node kind' },
      { query: 'What is at offset 40?', answer: nodeAtLabel(tree, 40),
        touched: root.Berugo.Ast.depth(tree),
        how: 'nodeAt — descends only into the child that contains the offset' }
    ];
  });

  function nameList(tree) {
    return root.Berugo.Ast.collect(tree, function (node) {
      return node.kind === 'name';
    }).map(function (node) { return node.name; }).join(', ');
  }

  function nodeAtLabel(tree, offset) {
    const found = root.Berugo.Ast.nodeAt(tree, offset);

    if (!found) return 'nothing';
    return found.kind + (found.name ? ' ' + found.name : '') +
      ' at ' + found.span.start + '–' + found.span.end;
  }

  function update() {
    const values = panel.values();
    const key = values['ai-programs'] + '\n' + values['ai-depth'];
    const sweep = sweepFor(key);

    paintExample(values['ai-indent']);
    paintMetrics(sweep);
    paintSabotage(sweep, values['ai-printer']);
    paintDifference(key);
    paintVisit();
    paintFormat();
  }

  function paintExample(indent) {
    const parsed = root.Berugo.Parser.parse(SAMPLE);
    const printed = root.Berugo.Ast.print(parsed.tree, { indent: indent });
    const again = root.Berugo.Parser.parse(printed);
    const same = root.Berugo.Ast.equalIgnoringSpans(parsed.tree, again.tree);
    const rows = [['Written', SAMPLE], ['Printed', printed],
      ['Trees equal ignoring spans', same ? 'yes' : 'NO']];

    root.jQuery('#ai-example tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row[0]) +
        '</td><td class="mono" style="white-space:pre-wrap">' +
        root.Helpers.escapeHtml(row[1]) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ai-example-caption',
      'The `for` loop and the multiplication come back exactly as written, and the printed ' +
      'form is ' + printed.length + ' characters against ' + SAMPLE.length + ' — the ' +
      'difference is entirely the author\'s spacing, which is the part an AST does not keep. ' +
      'What must survive is the tree, and it does.');
  }

  function paintMetrics(sweep) {
    root.MetricGrid.update({
      'ai-checked': { value: root.Format.exact(sweep.honest.checked),
        note: 'each generated from the grammar, then parsed, printed and parsed again' },
      'ai-failures': { value: root.Format.exact(sweep.honest.failures.length),
        note: sweep.honest.failures.length === 0
          ? 'the parser and the printer agree on every one'
          : 'each one is a genuine disagreement about grouping' },
      'ai-caught': { value: sweep.caught + ' (' + root.Format.percent(sweep.rate, 1) + ')',
        note: 'the same corpus through a printer with one line changed — this is what the ' +
          'property is worth' },
      'ai-stable': { value: formatFor('all').filter(function (row) {
        return row.same;
      }).length + ' of 3', note: 'two spaces, four spaces and a tab, all reparsing to one tree' }
    });
  }

  function paintSabotage(sweep, which) {
    const rows = [];

    if (which !== 'broken') rows.push(sabotageRow('the real printer', sweep.honest));
    if (which !== 'honest') {
      rows.push(sabotageRow('one line changed — no brackets on the right', sweep.broken));
    }

    root.jQuery('#ai-sabotage tbody').html(rows.join(''));
    root.Helpers.setText('ai-sabotage-caption', sabotageCaption(sweep));
  }

  function sabotageRow(label, result) {
    return '<tr><td>' + root.Helpers.escapeHtml(label) + '</td><td class="mono">' +
      result.checked + '</td><td class="mono">' + result.passed + '</td><td class="mono">' +
      result.failures.length + '</td><td>' +
      (result.failures.length === 0 ? 'the invariant holds'
        : 'the invariant fails on ' +
          root.Format.percent(result.failures.length / result.checked, 1) +
          ' of them') + '</td></tr>';
  }

  function sabotageCaption(sweep) {
    return 'Two printers, one corpus. The real one round-trips everything; the broken one — ' +
      'which drops the binding power required of the right operand, a single line — loses ' +
      sweep.caught + ' of ' + sweep.broken.checked + '. Both numbers are needed. Without the ' +
      'second, a clean sweep could mean the parser and printer agree or it could mean the ' +
      'generator never produced an expression where grouping matters, and there is no way to ' +
      'tell them apart. The rate is not near 100% because most generated expressions do not ' +
      'need brackets on the right at all — a corpus where every program failed would mean the ' +
      'sabotage was too coarse to locate anything.';
  }

  function paintDifference(key) {
    const rows = differenceFor(key);

    root.jQuery('#ai-difference tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(shorten(row.source)) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(shorten(row.printed || '')) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(describeDifference(row)) +
        '</td></tr>';
    }).join('') || '<tr><td colspan="3">no failures at this size — raise the program count ' +
      'or the depth to find one</td></tr>');

    root.Helpers.setText('ai-difference-caption',
      'Each row is a program the broken printer changed. The last column is where the two ' +
      'trees first differ, reported as a path rather than a diff, because "these two trees ' +
      'are not equal" is useless and "at root/items/0/value/right the left tree has a binary ' +
      '- and the right has a num" is actionable. Every one of these is a right operand that ' +
      'needed brackets and lost them — which is exactly the one line that was changed, ' +
      'recovered from the failures rather than assumed.');
  }

  function describeDifference(row) {
    if (!row.difference) return row.why;
    return row.difference.path + ': ' + row.difference.left + ' vs ' + row.difference.right;
  }

  function shorten(text) {
    const flat = text.replace(/\s+/g, ' ');

    return flat.length > 72 ? flat.slice(0, 69) + '…' : flat;
  }

  function paintVisit() {
    root.jQuery('#ai-visit tbody').html(visitFor('all').map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.query) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.answer) + '</td><td class="mono">' + row.touched +
        '</td><td>' + root.Helpers.escapeHtml(row.how) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ai-visit-caption',
      'The last row is the one that matters for an editor. Three of these queries touch every ' +
      'node; `nodeAt` touches only the depth, because it descends into the single child whose ' +
      'span contains the offset. That is the difference between an editor that answers hover ' +
      'instantly on a large file and one that walks the whole tree per keystroke — and it is ' +
      'available only because every node carries a span the walk can test.');
  }

  function paintFormat() {
    const rows = formatFor('all');
    const labels = { '  ': 'two spaces', '    ': 'four spaces', '\t': 'a tab' };

    root.jQuery('#ai-format tbody').html(rows.map(function (row) {
      return '<tr><td>' + labels[row.indent] + '</td><td class="mono">' + row.characters +
        '</td><td class="mono">' + row.lines + '</td><td>' + (row.same ? 'yes' : 'NO') +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('ai-format-caption',
      'Three formattings of one tree: ' + rows.map(function (row) {
        return row.characters;
      }).join(', ') + ' characters, all ' + rows[0].lines + ' lines, and all three reparse to ' +
      'the same tree. This is the property a formatter has to have and the one that is never ' +
      'tested, because the obvious test — "does the output look right" — is a human reading ' +
      'the diff. Comparing trees costs one extra parse per formatting and turns "the ' +
      'formatter is probably safe" into a build step.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
