/**
 * Section: Testing the front end.
 *
 * Four properties, and each one is reported with the thing that gives it
 * meaning: how many failures a deliberately broken implementation produces.
 * A property with no failure count against a known-bad version is a claim
 * about the generator, not about the code.
 *
 * The section also states what each oracle is blind to, because that is the
 * part a test suite never tells you. The round trip cannot see a lowering
 * bug. The differential run cannot see a parse bug, because a program that
 * does not parse never reaches it. Naming the blind spots is how the fifth
 * property gets written instead of assumed.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'testing-a-front-end';
  let panel = null;

  const MUTATION_EFFECTS = {
    delete: 'usually a missing token — the commonest real typo',
    insert: 'an unbalanced bracket or a stray keyword, which tests recovery',
    truncate: 'a file that stops mid-expression, which is what a file being typed looks like',
    swap: 'two adjacent characters transposed, which often still lexes and then fails to parse'
  };

  const ORACLES = [
    { name: 'The round trip', answers: 'do the parser and the printer agree about grouping',
      blind: 'anything after parsing — a resolution, typing or lowering bug passes it' },
    { name: 'Mutation fuzzing', answers: 'is the parser total, and does every span stay inside the file',
      blind: 'whether the tree is RIGHT — it only asks that one exists' },
    { name: 'The reference interpreter',
      answers: 'does the core compute what the surface computed',
      blind: 'programs that do not parse or do not terminate, which never reach it' },
    { name: 'The conformance suite', answers: 'does each feature produce the type the spec states',
      blind: 'any shape nobody wrote down — it missed a let inside a function for the whole build' },
    { name: 'The error suite', answers: 'exactly one diagnostic per mistake, with the right code',
      blind: 'the quality of the message, which no assertion reaches' },
    { name: 'Running every stage twice',
      answers: 'is each stage a pure function of its input',
      blind: 'state shared between two DIFFERENT programs, which needs a third run to see' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one generator, four oracles',
      caption: 'The generator is the grammar read backwards, and it feeds every property. What ' +
        'distinguishes the four is the ORACLE — the thing that decides whether a run passed. ' +
        'The round trip compares a tree against itself after a detour through text. Mutation ' +
        'fuzzing has the weakest oracle of all, "it did not throw and no span left the file", ' +
        'which is why it can be pointed at inputs no other property can use. The differential ' +
        'run compares two executions. The suites compare against expectations written down ' +
        'independently. A property is only as good as its oracle, and the reason there are ' +
        'four is that each is blind to what the others see.',
      definition: [
        'graph TD',
        'G["grammar-driven generator"] --> P1["parse · print · reparse"]',
        'G --> P2["corrupt one character"]',
        'G --> P3["run surface · run core"]',
        'S["the written-down suites"] --> P4["conformance and error programs"]',
        'P1 --> O1{"trees equal ignoring spans?"}',
        'P2 --> O2{"returned a tree, every span inside the file?"}',
        'P3 --> O3{"same value, output, outcome and bindings?"}',
        'P4 --> O4{"the stated type, and exactly one diagnostic?"}',
        'O1 --> R["a failure names the first differing path"]',
        'O2 --> R',
        'O3 --> R',
        'O4 --> R'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A grammar-driven random program generator is the cheapest fuzzer a language will ever ' +
        'get**, because the grammar is already written down and the generator is that grammar ' +
        'read in the other direction. What makes it worth having is not the programs — most of ' +
        'them are dull — but that a property can be pointed at ten thousand of them instead of ' +
        'the fifteen somebody thought of.',
      '**The generator emits WELL-TYPED programs by construction, and that is a deliberate ' +
        'restriction.** A generator that produces syntactically valid nonsense produces ' +
        'programs the checker rejects, and a corpus of rejected programs exercises the error ' +
        'path and nothing else. Typing the generation — one function that only produces ' +
        'Numbers, one that only produces Bools — is what gets the run and lowering properties ' +
        'any coverage at all.',
      '**A property that has never failed is a property you cannot trust.** Every one here is ' +
        'reported beside the number of failures a deliberately broken implementation produces: ' +
        'a printer that ignores precedence on the right, a lowering with its advance in the ' +
        'wrong place. If the broken version passes, the property is measuring the generator.',
      '**Mutation fuzzing has the weakest oracle, and that is its strength.** It asks only that ' +
        'a tree came back and that every span in it lies inside the file. Because it demands ' +
        'so little, it can be pointed at inputs no other property can use — corrupted files, ' +
        'truncated files, files with an unbalanced brace — which is exactly the population an ' +
        'editor deals with all day.',
      '**A lost span is the quiet failure, and it needs its own assertion.** A crash is ' +
        'obvious. A span that points outside the file, or has no end, produces a diagnostic ' +
        'that underlines nothing, and nobody notices until an editor tries to use it. This ' +
        'parser produced ten such nodes per conformance run until an audit went looking for ' +
        'them.',
      '**Differential testing against a reference interpreter is what makes a lowering ' +
        'checkable.** Reading a rewrite establishes nothing; running both programs and ' +
        'comparing every observable establishes it. The comparison must include what the ' +
        'programs leave BEHIND, not just what they return — every conformance program\'s value ' +
        'is `unit`, so a comparison of values alone passes whatever the core computed.',
      '**Golden files pin the shape of every stage, and they are a different kind of test.** A ' +
        'property says something must always hold; a golden file says this exact input ' +
        'produced this exact output last time. The second catches changes the first cannot ' +
        'express — a token count that moved, a tree that gained a node — at the cost of ' +
        'needing a human to approve every legitimate change.',
      '**Purity is asserted by running everything twice.** Each stage is supposed to be a pure ' +
        'function of the one before it, and the way to check that is to run the whole pipeline ' +
        'twice on the same input and compare every artefact. A stage that carried state between ' +
        'runs — a module-level counter for fresh type variables is the classic — differs on the ' +
        'second pass and the check names which stage.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — four properties, their sensitivity, and their blind spots',
        markup: root.TestFrontEndTemplate.render()
      },
      diagram: diagram(),
      insight: '**The round-trip property finds more parser bugs than any hand-written suite, ' +
        'and a random program generator built from the grammar is the cheapest fuzzer a ' +
        'language will ever get — but the thing worth internalising is that every oracle has a ' +
        'blind spot, and the blind spots are where the bugs actually were.** This milestone is ' +
        'the evidence. The round trip passed ten thousand programs while the desugarer lowered ' +
        '`a + b` into a call to the user\'s own `add`, because the round trip never runs ' +
        'anything. The conformance suite passed fifteen programs while the type checker ' +
        'crashed on every function containing a `let`, because no conformance program had one. ' +
        'The differential run passed while the comparison only looked at return values, ' +
        'because every program in the suite returns `unit`. Each of those was caught by adding ' +
        'a property that saw what the existing ones could not — running the core, writing down ' +
        'a shape nobody had, comparing the bindings a program leaves behind. So the useful ' +
        'question after a green suite is not "what else could I assert" but "what is every ' +
        'oracle I have blind to", and the table at the bottom of this section is that question ' +
        'answered in writing, which is the only form in which it gets acted on.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TestFrontEndTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function optionsFrom(values) {
    return { count: Number(values['tf-count']), seed: Number(values['tf-seed']),
      maxDepth: Number(values['tf-depth']), allowLoops: values['tf-loops'] };
  }

  const sweepFor = root.Helpers.memoise(function (key) {
    const options = JSON.parse(key);

    return { sabotage: root.Berugo.Fuzz.sabotage(options),
      fuzz: root.Berugo.Fuzz.fuzzParser(options),
      differential: root.Berugo.Fuzz.differential(
        Object.assign({}, options, { count: Math.min(options.count, 1000) })),
      corpus: root.Berugo.Fuzz.corpus(Object.assign({}, options, { count: 4 })) };
  });

  const goldenFor = root.Helpers.memoise(function () {
    return root.Berugo.Spec.CONFORMANCE.map(function (entry) {
      const out = root.Berugo.Pipeline.run(entry.source);

      return { id: entry.id, tokens: out.artefacts.lex.tokens.length,
        nodes: root.Berugo.Ast.countNodes(out.artefacts.parse.tree),
        bindings: root.Berugo.Resolve.summary(out.artefacts.resolve).bindings,
        types: out.artefacts.typecheck.types.size,
        core: root.Berugo.Ast.countNodes(out.artefacts.desugar.core),
        diagnostics: out.diagnostics.kept.length };
    });
  });

  const purityFor = root.Helpers.memoise(function () {
    return root.Berugo.Spec.CONFORMANCE.map(function (entry) {
      const out = root.Berugo.Pipeline.purity(entry.source);

      return { id: entry.id, stages: out.stages, differing: out.differing, ok: out.ok };
    });
  });

  function update() {
    const values = panel.values();
    const key = JSON.stringify(optionsFrom(values));
    const state = sweepFor(key);

    paintCorpus(state);
    paintMetrics(state);
    paintProperties(state);
    paintMutations(state);
    paintGolden();
    paintPurity();
    paintOracles();
  }

  function paintCorpus(state) {
    root.jQuery('#tf-corpus tbody').html(state.corpus.map(function (source, index) {
      return '<tr><td class="mono">' + index + '</td><td class="mono">' +
        root.Helpers.escapeHtml(source.replace(/\n/g, ' ⏎ ')) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tf-corpus-caption',
      'Four of the corpus, at the current seed and depth. Every one is well typed by ' +
      'construction, and the loops all terminate because their counters are generated rather ' +
      'than chosen — letting the generator write the guard produces programs that hit the step ' +
      'budget, and a suite whose failures are all "did not finish" is testing the budget.');
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'tf-roundtrip': { value: root.Format.exact(state.sabotage.honest.failures.length),
        note: 'over ' + root.Format.exact(state.sabotage.honest.checked) +
          ' programs; the broken printer fails ' + state.sabotage.caught + ' of the same set' },
      'tf-crashes': { value: root.Format.exact(state.fuzz.crashes.length),
        note: root.Format.exact(state.fuzz.withErrors) + ' of ' +
          root.Format.exact(state.fuzz.checked) +
          ' mutants produced diagnostics, and all of them produced a tree' },
      'tf-lost': { value: root.Format.exact(state.fuzz.lostSpans.length),
        note: 'every node in every mutant tree carries a span inside its own source' },
      'tf-differential': { value: root.Format.exact(state.differential.failures.length),
        note: root.Format.exact(state.differential.ran) + ' ran to completion, ' +
          state.differential.budget + ' hit the step budget and were excluded' }
    });
  }

  function paintProperties(state) {
    const rows = [
      ['Round trip', state.sabotage.honest.checked, state.sabotage.honest.failures.length,
        'the parser and the printer agree about grouping',
        state.sabotage.caught + ' with the right-operand power dropped'],
      ['Parser totality', state.fuzz.checked, state.fuzz.crashes.length,
        'a corrupted file still yields a tree',
        'any throw at all — the oracle is that nothing escaped'],
      ['Span containment', state.fuzz.checked, state.fuzz.lostSpans.length,
        'no span points outside its own source',
        'the ten nodes per run this parser produced before spanFrom was fixed'],
      ['Surface against core', state.differential.ran, state.differential.failures.length,
        'the lowering preserves value, output, outcome and bindings',
        'four name captures, a loop off-by-one and a lost short circuit']
    ];

    root.jQuery('#tf-properties tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row[0]) + '</td><td class="mono">' +
        root.Format.exact(row[1]) + '</td><td class="mono">' + root.Format.exact(row[2]) +
        '</td><td>' + root.Helpers.escapeHtml(row[3]) + '</td><td>' +
        root.Helpers.escapeHtml(String(row[4])) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tf-properties-caption',
      'The last column is the one that makes the third column mean anything. Zero failures ' +
      'against a correct implementation is what you expect and tells you nothing on its own; ' +
      'the number of failures a deliberately broken implementation produces is the property\'s ' +
      'sensitivity. The round trip is measured live against a printer with one line changed — ' +
      'currently ' + state.sabotage.caught + ' of ' + state.sabotage.broken.checked +
      '. The bottom row\'s entry is historical rather than live: those six defects were real, ' +
      'they were in this milestone, and every one of them was found by this property.');
  }

  function paintMutations(state) {
    const kinds = state.fuzz.kinds;
    const total = Object.keys(kinds).reduce(function (sum, id) { return sum + kinds[id]; }, 0);

    root.jQuery('#tf-mutations tbody').html(Object.keys(kinds).sort().map(function (id) {
      return '<tr><td class="mono">' + id + '</td><td class="mono">' +
        root.Format.exact(kinds[id]) + '</td><td class="mono">' +
        root.Format.percent(kinds[id] / total, 1) + '</td><td>' +
        root.Helpers.escapeHtml(MUTATION_EFFECTS[id] || '') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tf-mutations-caption',
      'Four corruptions applied uniformly to ' + root.Format.exact(state.fuzz.checked) +
      ' well-formed programs. ' + root.Format.percent(
        state.fuzz.withErrors / state.fuzz.checked, 1) +
      ' of the mutants produce at least one diagnostic — the rest are corruptions that happen ' +
      'to leave a valid program, such as deleting a space or swapping two characters inside a ' +
      'comment. Every single mutant returned a tree. That is the property, and it is what ' +
      'makes an editor possible: a file being typed spends most of its life in this population.');
  }

  function paintGolden() {
    const rows = goldenFor('all');

    root.jQuery('#tf-golden tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.id) + '</td><td class="mono">' +
        row.tokens + '</td><td class="mono">' + row.nodes + '</td><td class="mono">' +
        row.bindings + '</td><td class="mono">' + row.types + '</td><td class="mono">' +
        row.core + '</td><td class="mono">' + row.diagnostics + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tf-golden-caption',
      rows.length + ' programs × five stages, each pinned by a number. This is what a golden ' +
      'file is for: a property cannot express "this program should produce exactly 14 nodes", ' +
      'and a change that turns 14 into 15 is either a bug or an improvement that somebody has ' +
      'to look at. The diagnostics column must be zero on every row — a conformance program ' +
      'that reports anything is not conformant — and that one IS a property rather than a ' +
      'golden value.');
  }

  function paintPurity() {
    const rows = purityFor('all');
    const pure = rows.filter(function (row) { return row.ok; }).length;

    root.jQuery('#tf-purity tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.id) + '</td><td class="mono">' +
        row.stages + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.differing.join(', ') || 'none') + '</td><td>' +
        (row.ok ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tf-purity-caption',
      pure + ' of ' + rows.length + ' programs produce identical artefacts on a second run of ' +
      'every stage. The comparison is by fingerprint rather than by deep equality, and that is ' +
      'not a weakening: the artefacts are cyclic — a binding points at its scope, a scope at ' +
      'its bindings, a reference at the node it came from — so a structural comparison either ' +
      'loops or has to be told which edges to ignore, and a comparison that ignores edges can ' +
      'miss the change it was written to find. A fingerprint is the observable content ' +
      'rendered as text: token kinds and spans, the printed tree, the scope rows, the type of ' +
      'every node.');
  }

  function paintOracles() {
    root.jQuery('#tf-oracles tbody').html(ORACLES.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.name) + '</td><td>' +
        root.Helpers.escapeHtml(row.answers) + '</td><td>' +
        root.Helpers.escapeHtml(row.blind) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tf-oracles-caption',
      'The third column is the useful one and it is the one nobody writes down. Every defect ' +
      'this milestone shipped sat in some oracle\'s blind spot, and each was caught by adding ' +
      'the property that could see it — not by asserting harder with the ones already there. ' +
      'The conformance row is the clearest case: fifteen green programs said nothing about a ' +
      '`let` inside a function, because no program had one, and the type checker crashed on ' +
      'every such program for the whole build. The fix was not a better assertion, it was a ' +
      'sixteenth program.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
