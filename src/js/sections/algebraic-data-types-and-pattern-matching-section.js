/**
 * Section: Algebraic data types and pattern matching.
 *
 * The measurement is the witness. When a match is incomplete the checker does
 * not say "some case is missing" — it constructs a value no clause matches.
 * `nil | cons(true, _)` over a list of booleans is missing `cons(false, nil)`,
 * and that value is built by the same usefulness algorithm that answered the
 * question, not guessed afterwards.
 *
 * The second is the heuristic table. Which column to test first has no effect
 * on meaning and a large effect on size: the four-clause three-column matrix
 * compiles to thirteen nodes leftmost-first and nine under either of the two
 * informed heuristics.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'algebraic-data-types-and-pattern-matching';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  const MATCHES = [
    { types: ['Bool', 'Bool'], rows: ['true; true', 'true; false', 'false; _'] },
    { types: ['Bool', 'Bool'], rows: ['true; true', 'false; _'] },
    { types: ['Colour'], rows: ['red', 'green'] },
    { types: ['Colour'], rows: ['red', 'green', 'blue'] },
    { types: ['Colour'], rows: ['red', '_', 'blue'] },
    { types: ['List'], rows: ['nil', 'cons(true, _)'] },
    { types: ['List'], rows: ['nil', 'cons(_, _)'] },
    { types: ['Option', 'Bool'], rows: ['none; _', 'some(true); true', 'some(_); _'] },
    { types: ['Tree'], rows: ['leaf', 'node(leaf, _, leaf)', 'node(_, _, _)', 'leaf'] },
    { types: ['Bool', 'Bool', 'Bool'],
      rows: ['_; false; true', 'false; true; _', '_; _; false', '_; _; _'] }
  ];

  function diagram() {
    return {
      title: 'Diagram — compiling a nested match into a decision tree',
      caption: 'A match is not a chain of tests repeated per clause. The compiler picks one ' +
        'column, switches on the constructors that appear in it, and recurses into each branch ' +
        'with a smaller matrix — so every constructor is examined at most once on any path, ' +
        'which is what makes matching linear rather than quadratic in the number of clauses. ' +
        'The rows that do not test the chosen column go into a default branch, which is why a ' +
        'wildcard costs nothing and a clause that tests every column costs the most. The ' +
        'column choice is free to make and expensive to make badly.',
      definition: [
        'graph TD',
        'A["matrix of clauses × columns"] --> B{"choose a column"}',
        'B --> C["switch on the head constructors in that column"]',
        'C --> D["branch per constructor: specialise the matrix, unfold the sub-patterns"]',
        'C --> E["default branch: only the rows with a wildcard there"]',
        'D --> F{"a row of all wildcards on top?"}',
        'E --> F',
        'F -->|yes| G["leaf: that clause runs"]',
        'F -->|"no rows left"| H["fail: no clause matches — this is the missing case"]',
        'F -->|otherwise| B'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Sums and products are the algebra, and the names are not decorative.** A product is ' +
        '"both", and its number of values is the product of its parts. A sum is "one of", and ' +
        'its count is the sum. `Option Bool` has 1 + 2 = 3 values; `Pair Bool Bool` has ' +
        '2 × 2 = 4. Counting values this way is the fastest way to see whether a type models ' +
        'what you meant.',
      '**A recursive type is a fixed point, and the μ operator is the notation.** ' +
        '`List a = μX. 1 + a × X` says a list is either empty or an element and another list. ' +
        'Iso-recursive treatment makes the fold and unfold explicit constructors; ' +
        'equi-recursive treatment makes them silent. Almost every language you use is ' +
        'iso-recursive, which is why you write `Cons` and not just a pair.',
      '**Pattern-match compilation produces a decision tree, and column order decides its ' +
        'size.** Every path tests each constructor once. The choice of which column to switch ' +
        'on first is semantically free and the demo measures four ways of making it — the ' +
        'informed ones cut the tree substantially on a matrix with wildcards scattered through ' +
        'it.',
      '**Exhaustiveness and redundancy are the same question asked twice.** Maranget\'s ' +
        'usefulness relation asks: is there a value matching this pattern vector that no row ' +
        'above matches? Exhaustiveness is "the all-wildcards vector is NOT useful against the ' +
        'whole matrix". Redundancy is "row i is not useful against rows above it". One ' +
        'algorithm, two questions.',
      '**The counterexample falls out of the algorithm rather than being reconstructed.** When ' +
        'the wildcard vector is useful, the recursion that proved it built the missing ' +
        'constructor at each level. That is why the demo can print `cons(false, nil)` and not ' +
        'merely "the cons case is incomplete" — and it is the difference between a warning you ' +
        'act on and one you suppress.',
      '**Exhaustiveness needs a closed set of constructors, which is why open types always need ' +
        'a default.** A sum type has finitely many constructors declared in one place, so ' +
        '"did you cover them all" is decidable. A string, an integer or an open class hierarchy ' +
        'has no such list, so every match over one is incomplete by construction. That is the ' +
        'real argument for sealed types.',
      '**Option versus null is a type-level argument, not a style preference.** `Option T` is a ' +
        'different type from `T`, so the compiler forces the empty case to be handled before ' +
        'the value can be used. A nullable `T` is the same type, so nothing forces anything. ' +
        'The exhaustiveness checker is what turns that distinction into an error message.',
      '**Exhaustiveness is the feature that makes adding a variant safe, and that is its real ' +
        'value.** Add a constructor to a sum type in a language that checks matches and every ' +
        'incomplete match becomes a compile error — a work list. Add one in a language that ' +
        'does not, and every incomplete match becomes a silent runtime hole, scattered across ' +
        'the codebase and found by users.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — check a match, and compile it four ways',
        markup: root.PatternTemplate.render()
      },
      diagram: diagram(),
      insight: '**The reason to reach for a sum type is not elegance; it is that adding a case ' +
        'later becomes a compiler-generated work list instead of a hunt.** Every codebase ' +
        'eventually grows a new payment method, a new event kind, a new state. In a language ' +
        'with sealed sums and exhaustiveness checking, adding it produces a list of every place ' +
        'that must be updated, and the build stays red until they are. In a language without ' +
        'it — a string tag, an enum with a `default:` arm, a class hierarchy anyone can extend ' +
        '— the same change compiles cleanly and leaves silent holes wherever someone wrote a ' +
        'fallback. The practical corollary is that a `default` branch is not neutral: it turns ' +
        'the checker off for that match. Write it only where the type really is open, and ' +
        'never as a convenience over a type you control.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PatternTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const analyseFor = root.Helpers.memoise(function (key) {
    const spec = MATCHES[Number(key)];
    const matrix = spec.rows.map(root.PatternCompile.parseRow);

    return { spec: spec, matrix: matrix,
      exhaustive: root.PatternCompile.exhaustive(matrix, spec.types),
      redundant: root.PatternCompile.redundant(matrix, spec.types),
      heuristics: root.PatternCompile.heuristicTable(matrix, spec.types) };
  });

  const sweepFor = root.Helpers.memoise(function () {
    return MATCHES.map(function (spec, index) {
      const state = analyseFor(String(index));

      return { rows: spec.rows, types: spec.types,
        exhaustive: state.exhaustive.exhaustive, witness: state.exhaustive.witness,
        dead: state.redundant.filter(function (row) { return !row.reachable; })
          .map(function (row) { return row.index; }) };
    });
  });

  function update() {
    const values = panel.values();
    const state = analyseFor(values['adt-match']);
    const chosen = state.heuristics.filter(function (row) {
      return row.name === values['adt-heuristic'];
    })[0] || state.heuristics[0];

    paintMetrics(state, chosen);
    paintClauses(state);
    paintTree(state, chosen);
    paintHeuristics(state, values['adt-heuristic']);
    paintSweep();
    paintTypes();
  }

  function paintMetrics(state, chosen) {
    const dead = state.redundant.filter(function (row) { return !row.reachable; });

    root.MetricGrid.update({
      'adt-exhaustive': { value: state.exhaustive.exhaustive ? 'yes' : 'no',
        note: state.exhaustive.exhaustive
          ? 'every value of the type is matched by some clause'
          : 'at least one value falls through every clause' },
      'adt-witness': { value: state.exhaustive.witness || '—',
        note: state.exhaustive.witness
          ? 'built by the same recursion that proved the match incomplete'
          : 'there is none, which is what exhaustive means' },
      'adt-dead': { value: root.Format.exact(dead.length),
        note: dead.length > 0
          ? 'clause ' + dead.map(function (row) { return row.index; }).join(', ') +
            ' can never run'
          : 'every clause is reachable by at least one value' },
      'adt-size': { value: root.Format.exact(chosen.size),
        note: chosen.tests + ' tests, depth ' + chosen.depth + ', ' + chosen.label }
    });
  }

  function paintClauses(state) {
    root.jQuery('#adt-clauses tbody').html(state.redundant.map(function (row) {
      return '<tr><td class="mono">' + row.index + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.row) + '</td><td>' + (row.reachable ? 'yes' : 'NO') +
        '</td><td>' + root.Helpers.escapeHtml(row.why) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('adt-clauses-caption',
      'A clause is reachable when some value matches it and matches none of the clauses above ' +
      'it. That is exactly the usefulness question, asked with the rows above as the matrix — ' +
      'which is why the same code answers both questions and why a compiler that reports one ' +
      'can always report the other. An unreachable clause is almost always a typo in an ' +
      'earlier pattern rather than a deliberate fallthrough.');
  }

  function paintTree(state, chosen) {
    root.jQuery('#adt-tree').html(root.DerivationView.treeMarkup(chosen.tree,
      { columns: state.spec.types.map(function (type, index) {
        return 'column ' + index + ' (' + type + ')';
      }) }));

    root.Helpers.setText('adt-tree-caption',
      'Each "test" node switches on one column; the labels under it are the constructors, and ' +
      '"otherwise" is the default branch holding the rows that had a wildcard there. A leaf ' +
      'names the clause that runs. Count the tests down any single path and you have the ' +
      'number of constructor checks that value costs at run time — never more than one per ' +
      'column per level, which is the property the tree exists to guarantee.');
  }

  function paintHeuristics(state, selected) {
    const best = state.heuristics.slice().sort(function (a, b) { return a.size - b.size; })[0];

    root.jQuery('#adt-heuristics tbody').html(state.heuristics.map(function (row) {
      return '<tr' + (row.name === selected ? ' style="font-weight:600"' : '') +
        '><td>' + root.Helpers.escapeHtml(row.label) + '</td><td class="mono">' + row.size +
        (row.size === best.size ? ' ← smallest' : '') + '</td><td class="mono">' + row.tests +
        '</td><td class="mono">' + row.depth + '</td><td class="mono">' + row.clauses +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('adt-heuristics-caption',
      'All four trees decide exactly the same thing — the last column confirms the same ' +
      'clauses are reachable in each — and they differ in size by up to a factor of ' +
      root.Format.fixed(state.heuristics[0].size / Math.max(1, best.size), 1) + ' on this ' +
      'matrix. That is why real compilers implement a heuristic rather than testing columns ' +
      'left to right: the choice is semantically free, so it is pure code size and pure branch ' +
      'count, and on a large match statement the difference is the difference between an ' +
      'inlined jump table and a page of tests.');
  }

  function paintSweep() {
    const rows = sweepFor('all');
    const incomplete = rows.filter(function (row) { return !row.exhaustive; });

    root.jQuery('#adt-sweep tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.rows.join('   ·   ')) +
        '</td><td>' + (row.exhaustive ? 'yes' : 'no') + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.witness || '—') + '</td><td class="mono">' +
        (row.dead.length ? row.dead.join(', ') : '—') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('adt-sweep-caption',
      incomplete.length + ' of ' + rows.length + ' matches are incomplete, and every one of ' +
      'them names a concrete value rather than a missing case. `cons(false, nil)` is a value ' +
      'you could type into a test; "the cons case is incomplete" is not. The witnesses are ' +
      'also verified independently in the test suite by checking that they really match no ' +
      'clause — a checker that produced plausible-looking witnesses that happened to be ' +
      'matched would be worse than one that produced none.');
  }

  function paintTypes() {
    root.jQuery('#adt-types tbody').html(Object.keys(root.PatternCompile.TYPES)
      .map(function (name) {
        const entries = root.PatternCompile.constructorsOf(name);

        return '<tr><td class="mono">' + name + '</td><td class="mono">' +
          entries.map(function (entry) { return entry.name; }).join(', ') +
          '</td><td class="mono">' + entries.map(function (entry) {
            return entry.arity;
          }).join(', ') + '</td><td class="mono">' +
          root.Format.exact(root.PatternCompile.valueCount(name, 2)) + '</td></tr>';
      }).join(''));

    root.Helpers.setText('adt-types-caption',
      'The last column counts values built from at most two nested constructors. A finite type ' +
      'saturates immediately — Colour has three values and always will. A recursive one does ' +
      'not: Tree has 19 at depth two and 723 at depth three. That growth is precisely why ' +
      'exhaustiveness cannot be answered by enumerating values, and why the usefulness ' +
      'algorithm works on patterns instead — patterns are finite even when the type is not.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
