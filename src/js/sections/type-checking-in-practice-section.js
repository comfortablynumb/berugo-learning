/**
 * Section: Type checking and inference.
 *
 * The measurement that carries the section is the annotation table. The same
 * mistake is checked twice — once with an annotation and once without — and
 * the code and the blamed span both move. Without the annotation the checker
 * blames wherever the traversal happened to reach the contradiction; with it,
 * the annotation is the thing that imposed the expectation, so the message
 * points at the value that failed to meet it.
 *
 * The second is the constraint list. It is printed in the order the walk
 * produced it, because that ordering is the entire reason inference errors
 * point where they do: the checker reports the first equation it cannot solve,
 * and "first" is decided by the traversal, not by which line is wrong.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'type-checking-in-practice';
  let panel = null;

  const ANNOTATION_PAIRS = [
    { about: 'a Bool assigned to something used as a Number',
      without: 'let n = true;\nlet total = n + 1;',
      with_: 'let n: Number = true;\nlet total = n + 1;' },
    { about: 'a function whose argument is wrong',
      without: 'fn double(x) { return x * 2; }\nlet r = double(true);',
      with_: 'fn double(x: Number) { return x * 2; }\nlet r = double(true);' },
    { about: 'a record field of the wrong type',
      without: 'let p = { x: true };\nlet s = p.x + 1;',
      with_: 'let p: { x: Number } = { x: true };\nlet s = p.x + 1;' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — check mode and infer mode, and what switches between them',
      caption: 'Bidirectional checking is two modes and a rule for moving between them. In ' +
        'INFER mode the checker works out a type from the term and hands it upward; in CHECK ' +
        'mode it is given an expected type and pushes it inward. An annotation is the switch ' +
        'from infer to check, and that is what annotations are for — not to help the ' +
        'algorithm, which can usually manage without them, but to give the error message ' +
        'somewhere to point. The two dashed edges are the ones that produce diagnostics, and ' +
        'they produce different ones: a failed check blames the value against the thing that ' +
        'required it, while a failed unification in infer mode blames wherever the traversal ' +
        'happened to reach the contradiction.',
      definition: [
        'graph TD',
        'S["a node to type"] --> Q{"is there an expected type?"}',
        'Q -->|"no"| I["INFER — derive a type from the term"]',
        'Q -->|"yes, from an annotation or a parameter"| C["CHECK — push the type inward"]',
        'I --> U["unify what the sub-terms produced"]',
        'C --> U',
        'U --> OK["record the type in the table"]',
        'U -.->|"constructor clash"| E1["blame both spans"]',
        'U -.->|"occurs check"| E2["no finite type exists"]',
        'OK --> G{"at a let?"}',
        'G -->|yes| GEN["generalise: quantify what the environment does not mention"]',
        'G -->|no| MONO["keep it monomorphic"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The type table is a compiler artefact, not a scratchpad.** A type per node, keyed by ' +
        'node, kept after checking finishes. That is what lets hover answer instantly, what ' +
        'the optimiser will read in M29 to know an addition is on numbers, and what makes the ' +
        '"every expression and its type" table above possible at all. A checker that returns ' +
        'only a verdict throws away the thing it spent its whole run computing.',
      '**Bidirectional means two modes, and knowing which one you are in is most of the ' +
        'design.** Infer derives a type from a term; check is handed an expected type and ' +
        'pushes it inward. An annotation switches infer into check — and the point of an ' +
        'annotation is not that the algorithm needs it, but that it gives the error message ' +
        'somewhere to point.',
      '**A mismatch must carry BOTH spans, and this is the difference between a message ' +
        'someone can act on and one they cannot.** "Cannot unify Number with Bool" names ' +
        'neither end. Every mismatch here records the expression\'s span and the span of ' +
        'whatever imposed the expectation, and the demo shows them together — which is exactly ' +
        'what a language server needs to draw a squiggle and a related-information marker.',
      '**The constraint order decides where the blame lands.** The checker reports the first ' +
        'equation it cannot solve, and "first" is a fact about the traversal, not about which ' +
        'line is wrong. A mistake at the top of a function can surface as a clash inside a ' +
        'caller three definitions away, because that is where the two constraints finally met.',
      '**Generalisation happens at `let` and only there, which is what keeps inference ' +
        'decidable.** At a let, the variables free in the inferred type but not in the ' +
        'environment are quantified — the definition does not constrain them, so each use may ' +
        'pick. A parameter gets no such treatment, because its type is chosen by the caller. ' +
        'That single rule is why `id` can be used at Number, Bool and String in one file.',
      '**Instantiation is what makes one definition serve several types.** Each use of a ' +
        'generalised name gets fresh variables, so `id(1)` and `id(true)` constrain different ' +
        'variables and never meet. Remove the generalisation and both uses constrain the SAME ' +
        'variable, and the second one fails.',
      '**Records are structural, so the field set is part of the type.** `{ x: Number }` and ' +
        '`{ x: Number, y: Number }` are different types, and asking for a field that is not ' +
        'there is a mismatch the checker can name precisely — it knows which fields the record ' +
        'does have, so the message can say so instead of just refusing.',
      '**Exhaustiveness is a type-checker question, not a runtime one.** A match that does not ' +
        'cover every constructor of its subject\'s type is rejected here, with the missing ' +
        'constructor named. Deferring that to run time means the failure arrives as a crash in ' +
        'production on the one input nobody tested, which is the entire argument for sum types ' +
        'over enums plus a default case.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the type table, the constraints, and both ends of a mismatch',
        markup: root.TypeCheckTemplate.render()
      },
      diagram: diagram(),
      insight: '**The type error a user sees is a UX artefact, not a theorem — and keeping ' +
        'both spans plus the constraint that connected them is the difference between "cannot ' +
        'unify a with b" and a message someone can act on.** The theorem is that the program ' +
        'has no typing. Everything else about the message is a choice: which of the two ' +
        'conflicting positions to underline, whether to mention the other, whether to name the ' +
        'rule that imposed the expectation, and how much of the substitution to print. A ' +
        'checker that throws at the first unification failure has discarded all of it and has ' +
        'nothing left but the two types. The practical technique that follows is the one ' +
        'experienced ML and Haskell programmers use without articulating: when an inference ' +
        'error points somewhere baffling, add an annotation at a boundary you believe in. That ' +
        'splits the constraint set in two, and the error moves into the half that actually ' +
        'contains the mistake. The annotation table above measures exactly that — the same ' +
        'mistake, with and without, and the blamed span moving from wherever the walk collided ' +
        'to the value that failed the annotation.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TypeCheckTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const checkFor = root.Helpers.memoise(function (source) {
    const parsed = root.Berugo.Parser.parse(source);
    const typed = root.Berugo.Typecheck.typecheck(parsed.tree);

    return { source: source, tree: parsed.tree, typed: typed, rows: typeRows(parsed.tree, typed) };
  });

  function typeRows(tree, typed) {
    return root.Berugo.Ast.collect(tree, function (node) {
      return typed.types.has(node);
    }).map(function (node) {
      return { kind: node.kind, span: node.span, type: typed.typeOf(node) };
    });
  }

  const annotationFor = root.Helpers.memoise(function () {
    const rows = [];

    ANNOTATION_PAIRS.forEach(function (pair) {
      rows.push(annotationRow(pair.about + ', unannotated', pair.without));
      rows.push(annotationRow(pair.about + ', annotated', pair.with_));
    });
    return rows;
  });

  function annotationRow(label, source) {
    const typed = root.Berugo.Typecheck.typecheck(root.Berugo.Parser.parse(source).tree);
    const first = typed.errors[0];

    if (!first) return { label: label, code: 'none', span: '—', text: 'this program type-checks' };
    return { label: label, code: first.code,
      span: first.span.start + '–' + first.span.end,
      text: source.slice(first.span.start, first.span.end) };
  }

  const suiteFor = root.Helpers.memoise(function () {
    return root.Berugo.Spec.CONFORMANCE.map(function (entry) {
      const typed = root.Berugo.Typecheck.typecheck(
        root.Berugo.Parser.parse(entry.source).tree);

      return { id: entry.id, inferred: typed.last, expected: entry.expect,
        agrees: typed.last === entry.expect, constraints: typed.constraints.length };
    });
  });

  function update() {
    const values = panel.values();
    const source = root.TypeCheckTemplate.SAMPLES[values['tc-sample']];
    const state = checkFor(source);

    paintSource(state);
    paintMetrics(state);
    paintInline(state);
    paintConstraints(state, values['tc-only-errors']);
    paintErrors(state);
    paintAnnotations();
    paintSuite();
  }

  function paintSource(state) {
    const first = state.typed.errors[0];
    const spans = first ? [first.span].concat(first.related ? [first.related] : []) : [];

    root.AstView.render(document.getElementById('tc-source'),
      root.AstView.multiMarkup(state.source, spans));

    root.Helpers.setText('tc-source-caption', first
      ? 'Two ranges are marked: the expression whose type is wrong, and whatever imposed the ' +
        'expectation on it. A message naming only the first tells you where the checker gave ' +
        'up; a message naming only the second tells you what was wanted and not what was ' +
        'found. Both is what makes it actionable.'
      : 'This program type-checks, so nothing is marked. Every expression in it still has an ' +
        'entry in the type table — the table is built whether or not anything went wrong, ' +
        'which is what makes hover work on a correct file.');
  }

  function paintMetrics(state) {
    const typed = state.typed;

    root.MetricGrid.update({
      'tc-final': { value: typed.last,
        note: 'the type of the last binding, derived with no annotation unless the program has one' },
      'tc-vars': { value: root.Format.exact(typed.variables),
        note: 'each one stands for something not yet known; most get bound and disappear' },
      'tc-constraints': { value: root.Format.exact(typed.constraints.length),
        note: typed.constraints.filter(function (c) { return !c.ok; }).length +
          ' of them could not be solved' },
      'tc-errors': { value: root.Format.exact(typed.errors.length),
        note: typed.errors.length ? typed.errors[0].code + ' is the first one reported'
          : 'nothing in this program contradicts anything else' }
    });
  }

  function paintInline(state) {
    root.jQuery('#tc-inline tbody').html(state.rows.slice(0, 40).map(function (row) {
      return '<tr><td class="mono">' +
        root.Helpers.escapeHtml(shorten(state.source.slice(row.span.start, row.span.end))) +
        '</td><td class="mono">' + row.kind + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.type) + '</td><td class="mono">' + row.span.start + '–' +
        row.span.end + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tc-inline-caption', state.rows.length + ' entries in the type table, ' +
      'one per expression node. This is what "the type table is a compiler artefact" means ' +
      'concretely: the checker did not compute one answer, it computed one per node and kept ' +
      'them all. Hover reads this table; so will the optimiser, when it wants to know whether ' +
      'an addition is on numbers before it folds it.');
  }

  function shorten(text) {
    const flat = String(text).replace(/\s+/g, ' ');

    return flat.length > 44 ? flat.slice(0, 41) + '…' : flat;
  }

  function paintConstraints(state, onlyErrors) {
    const all = state.typed.constraints;
    const rows = onlyErrors ? all.filter(function (row) { return !row.ok; }) : all;

    root.jQuery('#tc-constraint-table tbody').html(rows.slice(0, 40).map(function (row, index) {
      return '<tr><td class="mono">' + (all.indexOf(row) + 1) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.actual) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.expected) + '</td><td>' + (row.ok ? 'yes' : 'NO') +
        '</td><td class="mono">' + row.span.start + '–' + row.span.end + '</td></tr>';
    }).join('') || '<tr><td colspan="5">no constraints matched this filter</td></tr>');

    root.Helpers.setText('tc-constraint-table-caption',
      all.length + ' constraints, ' + all.filter(function (row) { return !row.ok; }).length +
      ' of them unsolvable. The ORDER is the teaching: these are produced by walking the tree, ' +
      'and the checker reports the first row it cannot solve. That is why an inference error ' +
      'can point a long way from the mistake — the two constraints that contradict each other ' +
      'may be emitted at opposite ends of the walk, and the blame lands wherever they finally ' +
      'met. An annotation splits this list in two and moves the blame into the half that ' +
      'contains the mistake.');
  }

  function paintErrors(state) {
    root.jQuery('#tc-error-table tbody').html(state.typed.errors.map(function (entry) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(entry.code) + '</td><td>' +
        root.Helpers.escapeHtml(entry.message) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(shorten(state.source.slice(entry.span.start, entry.span.end))) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(relatedText(state, entry)) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(entry.expected || '—') +
        '</td><td class="mono">' + root.Helpers.escapeHtml(entry.actual || '—') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="6">this program type-checks</td></tr>');

    root.Helpers.setText('tc-error-table-caption',
      'Six columns because a usable type error has six parts: what rule failed, what it means ' +
      'in words, the expression at fault, the thing that required something of it, and the two ' +
      'types. Drop the fourth column and the message becomes "Bool is not Number", which is ' +
      'true of a great many programs and helps with none of them.');
  }

  function relatedText(state, entry) {
    if (!entry.related) return '—';
    return shorten(state.source.slice(entry.related.start, entry.related.end));
  }

  function paintAnnotations() {
    const rows = annotationFor('all');

    root.jQuery('#tc-annotation-table tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.label) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.code) + '</td><td class="mono">' + row.span +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.text) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tc-annotation-table-caption', annotationCaption(rows));
  }

  /**
   * Both counts are computed rather than asserted, because they differ: the
   * function pair keeps its code AND its underlined text, and reporting "all
   * three moved" would be the convenient half of the truth.
   */
  function annotationCaption(rows) {
    const pairs = rows.length / 2;
    const changedCode = countPairs(rows, function (before, after) {
      return before.code !== after.code;
    });
    const changedText = countPairs(rows, function (before, after) {
      return before.text !== after.text;
    });

    return pairs + ' mistakes, each checked twice. ' + changedCode + ' of the ' + pairs +
      ' change their diagnostic code when the annotation is added and ' + changedText +
      ' change what is underlined. Unannotated, the checker blames where the contradiction ' +
      'surfaced — often the USE, lines below the mistake. Annotated, the annotation is what ' +
      'imposed the expectation, so the blame lands on the value that failed to meet it: ' +
      '`true` rather than `n`, and `{ x: true }` rather than `p.x`. The function pair is the ' +
      'honest exception — annotating the parameter does not move the blame, because the call ' +
      'was already the place the two types met, and an annotation only helps when it sits ' +
      'between the mistake and the collision. That is the rule worth taking away, and it is ' +
      'why top-level signatures are written in languages that do not require them.';
  }

  function countPairs(rows, predicate) {
    let count = 0;

    for (let i = 1; i < rows.length; i += 2) {
      if (predicate(rows[i - 1], rows[i])) count += 1;
    }
    return count;
  }

  function paintSuite() {
    const rows = suiteFor('all');
    const agreeing = rows.filter(function (row) { return row.agrees; }).length;

    root.jQuery('#tc-suite-table tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.id) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.inferred) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.expected) + '</td><td>' + (row.agrees ? 'yes' : 'NO') +
        '</td><td class="mono">' + row.constraints + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tc-suite-table-caption',
      agreeing + ' of ' + rows.length + ' conformance programs infer exactly the type the ' +
      'spec says they should. Asserting the exact type rather than "it checked" is what makes ' +
      'this a test: a checker that inferred `Number` for everything would pass the weaker ' +
      'version on most of these rows. The constraint counts are worth reading beside the ' +
      'types — `local-let` costs more than twice `arithmetic` for a program only twice the ' +
      'size, because every binding inside a function adds an equation the top level does not.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
