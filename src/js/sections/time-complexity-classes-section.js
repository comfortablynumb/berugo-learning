/**
 * Section: time complexity classes.
 *
 * The measurement is the separation between what is PROVED and what is
 * believed. Eight of the fifteen problems in the atlas have an unconditional
 * bound; the other seven rest on "unless P = NP" or on nothing at all. That
 * column is the section, because almost every complexity claim anyone makes in
 * a design review is quietly in the second group and stated as though it were
 * in the first.
 *
 * The cost table is the other half: the wall-clock consequence of each growth
 * rate at a size and a machine speed you can move, so "exponential" stops being
 * a word and becomes a number of years.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'time-complexity-classes';
  const SECONDS_PER_YEAR = 31557600;
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the time-class tower, with the proved separations marked',
      caption: 'Every solid arrow is a containment nobody doubts and nobody has proved strict. ' +
        'The two dashed ones are different: P ⊊ EXPTIME and L ⊊ PSPACE are PROVED, ' +
        'unconditionally, by the hierarchy theorems. That is close to the complete list of ' +
        'unconditional separations between these classes, which is a startling situation for a ' +
        'field fifty years old — we know P ≠ EXPTIME and we cannot show P ≠ NP, even though NP ' +
        'sits between them. Any claim that a problem "needs" exponential time is, unless it ' +
        'names a hierarchy theorem or a query bound, a statement about the best known algorithm.',
      definition: [
        'graph BT',
        '    L --> NL',
        '    NL --> P',
        '    P --> NP',
        '    NP --> PSPACE',
        '    PSPACE --> EXPTIME',
        '    EXPTIME --> EXPSPACE',
        '    P -.->|"PROVED strict (time hierarchy)"| EXPTIME',
        '    L -.->|"PROVED strict (space hierarchy)"| PSPACE'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**TIME(f) is the class of languages a deterministic machine decides within f(n) steps, ' +
        'and NTIME(f) the same for a nondeterministic one.** P is the union of TIME(n^k) over ' +
        'all k, NP the union of NTIME(n^k). Everything else in the section is built from those ' +
        'two definitions, and the definitions are about MACHINES rather than about problems.',
      '**NP is a class of problems with short CERTIFICATES, and that reading is the useful one.** ' +
        'A language is in NP exactly when a yes instance has a proof that a polynomial-time ' +
        'verifier can check. Guessing and verifying are the same definition seen from two sides, ' +
        'and the certificate view is what makes NP-completeness reductions constructible.',
      '**The time hierarchy theorem proves that more time buys more, unconditionally.** If f ' +
        'grows sufficiently faster than g, then TIME(g) is strictly inside TIME(f). The proof is ' +
        'diagonalisation again: build a machine that simulates each g-time machine and does the ' +
        'opposite, which needs a little more than g time to do. That "little more" is the ' +
        'logarithmic factor in the theorem\'s statement.',
      '**P ⊊ EXPTIME follows immediately, and P versus NP does not.** The hierarchy theorem ' +
        'separates classes defined by different time bounds on the same MACHINE MODEL. P and NP ' +
        'are different models at the same bound, and diagonalisation does not distinguish them ' +
        '— that is the relativisation barrier, and it is why fifty years of effort has not ' +
        'closed the gap.',
      '**The polynomial-time Church–Turing thesis is the second thesis, and it has exceptions.** ' +
        'It claims every physically realisable model is polynomially related to a Turing ' +
        'machine. Quantum computing is the one candidate counterexample anybody takes seriously, ' +
        'which is what makes BQP interesting rather than merely fast.',
      '**P is a proxy for "tractable" and it is a bad one that nothing better has replaced.** ' +
        'An n^100 algorithm is in P and useless; a 2^(n/1000) algorithm is not in P and fine for ' +
        'every input you will see. What P actually buys is CLOSURE — polynomials compose, so a ' +
        'polynomial algorithm calling a polynomial subroutine is polynomial, and that robustness ' +
        'is why the class survived.',
      '**"This problem is exponential" is almost always a claim about the best known ' +
        'algorithm.** No superpolynomial lower bound is proved for SAT, or for travelling ' +
        'salesman, or for any NP-complete problem. The atlas separates the two columns on ' +
        'purpose, because collapsing them is the commonest way a complexity claim becomes false.',
      '**Galactic algorithms are the other direction of the same confusion.** The best known ' +
        'matrix multiplication exponent is about 2.371, and every algorithm achieving anything ' +
        'below 2.8 has constants that make it slower than the schoolbook method on any matrix ' +
        'that fits in a data centre. An asymptotic result is a statement about a limit, and the ' +
        'limit may be past the end of the universe.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the atlas, and what each growth rate costs in wall clock',
        markup: root.TimeClassTemplate.render()
      },
      diagram: diagram(),
      insight: '**The hierarchy theorems are among the few unconditional separations we have; ' +
        'everything else in complexity is "unless P = NP", and being precise about which is ' +
        'which is what makes a complexity claim credible.** In a design review this cashes out ' +
        'as a habit: when someone says a problem is intractable, ask which of four things they ' +
        'mean. A proved lower bound in a stated model — sorting by comparisons, Grover\'s query ' +
        'bound, PARITY in constant depth — is a fact you can build on. NP-completeness is a ' +
        'statement that a polynomial algorithm would settle a famous open problem, which is ' +
        'excellent evidence and is not a proof. "The best known algorithm is exponential" is a ' +
        'fact about the literature. And "it feels hard" is not any of those. The first two are ' +
        'load-bearing; the second two are reasons to look harder, not to stop.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TimeClassTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const GROWTHS = [
    { name: 'log n', of: function (n) { return Math.log2(n); } },
    { name: 'n', of: function (n) { return n; } },
    { name: 'n log n', of: function (n) { return n * Math.log2(n); } },
    { name: 'n²', of: function (n) { return n * n; } },
    { name: 'n³', of: function (n) { return n * n * n; } },
    { name: 'n¹⁰', of: function (n) { return Math.pow(n, 10); } },
    { name: '2ⁿ', of: function (n) { return Math.pow(2, n); } },
    { name: 'n!', of: function (n) { return factorial(n); } }
  ];

  function factorial(n) {
    let out = 1;

    for (let i = 2; i <= n; i += 1) {
      out *= i;
      if (!isFinite(out)) return Infinity;
    }
    return out;
  }

  const costsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const n = Number(parts[0]);
    const rate = Math.pow(10, Number(parts[1]));

    return GROWTHS.map(function (growth) {
      const operations = growth.of(n);
      const seconds = operations / rate;

      return { name: growth.name, operations: operations, seconds: seconds,
        wall: describe(seconds), feasible: seconds < SECONDS_PER_YEAR };
    });
  });

  function describe(seconds) {
    if (!isFinite(seconds)) return 'beyond any representable time';
    if (seconds < 1e-6) return 'under a microsecond';
    if (seconds < 1) return root.Format.fixed(seconds * 1000, 2) + ' ms';
    if (seconds < 60) return root.Format.fixed(seconds, 1) + ' s';
    if (seconds < 3600) return root.Format.fixed(seconds / 60, 1) + ' minutes';
    if (seconds < 86400) return root.Format.fixed(seconds / 3600, 1) + ' hours';
    if (seconds < SECONDS_PER_YEAR) return root.Format.fixed(seconds / 86400, 1) + ' days';
    const years = seconds / SECONDS_PER_YEAR;

    if (years < 1e6) return root.Format.fixed(years, 1) + ' years';
    return root.Format.exponential(years, 2) + ' years';
  }

  /** The largest n for which 2^n finishes inside a year at this rate — the
   *  number that makes "exponential" concrete. */
  function feasibleExponent(rate) {
    return Math.floor(Math.log2(rate * SECONDS_PER_YEAR));
  }

  /**
   * The padding argument, made concrete. A language decidable in n² steps
   * becomes, when every instance is padded to length n², decidable in linear
   * time in the PADDED length — and a machine restricted to linear time on the
   * unpadded instances cannot decide it. That is the shape of the hierarchy
   * theorems, stripped of the simulation bookkeeping.
   */
  const paddingRows = root.Helpers.memoise(function () {
    return [4, 6, 8, 10, 12].map(function (n) {
      const padded = n * n;
      const allowed = padded;
      const needed = n * n;

      return { n: n, padded: padded, allowed: allowed, needed: needed,
        separates: allowed >= needed && padded > n };
    });
  });

  function update() {
    const values = panel.values();
    const costs = costsFor(values['tim-n'] + '\n' + values['tim-rate']);

    paintMetrics(values, costs);
    paintCosts(costs, values);
    paintAtlas(values['tim-filter']);
    paintTower();
    paintPadding();
    paintClaims();
  }

  function rowsFor(filter) {
    if (filter === 'unconditional') return root.ComplexityAtlas.unconditional();
    if (filter === 'all') return root.ComplexityAtlas.all();
    return root.ComplexityAtlas.byClass(filter);
  }

  function paintMetrics(values, costs) {
    const rows = rowsFor(values['tim-filter']);
    const all = root.ComplexityAtlas.all();

    root.MetricGrid.update({
      'tim-shown': { value: root.Format.exact(rows.length) + ' of ' +
        root.Format.exact(all.length),
      note: 'the atlas separates class, best algorithm, best lower bound and what is open' },
      'tim-proved': { value: root.Format.exact(root.ComplexityAtlas.unconditional().length),
        note: 'entries whose bound is proved outright rather than resting on P versus NP' },
      'tim-open': { value: root.Format.exact(all.filter(function (row) {
        return row.open.indexOf('nothing') !== 0;
      }).length),
      note: 'entries with a genuine open question about their complexity' },
      'tim-feasible': { value: 'n = ' +
        root.Format.exact(feasibleExponent(Math.pow(10, Number(values['tim-rate'])))),
      note: 'the largest input for which 2ⁿ operations finish within a year at ' +
        '10^' + values['tim-rate'] + ' operations per second' }
    });
  }

  function paintCosts(costs, values) {
    root.jQuery('#tim-costs tbody').html(costs.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td class="mono">' +
        (isFinite(row.operations)
          ? (row.operations > 1e12 ? root.Format.exponential(row.operations, 2)
            : root.Format.exact(Math.round(row.operations)))
          : 'overflow') +
        '</td><td class="mono">' + row.wall + '</td><td class="mono">' +
        (row.feasible ? 'fine' : 'no') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tim-costs-note',
      'At n = ' + values['tim-n'] + ' and 10^' + values['tim-rate'] + ' operations per second. ' +
      'Two rows are worth pausing on. `n¹⁰` is in P and, at any size you would call large, ' +
      'unusable — which is why P is a proxy for tractability rather than a definition of it. ' +
      'And `2ⁿ` crosses from fine to hopeless within a handful of steps of n, which is the ' +
      'real content of "exponential": not that it is slow, but that the boundary between ' +
      'trivial and impossible is a few units wide and moving the hardware barely shifts it.');
  }

  function paintAtlas(filter) {
    const rows = rowsFor(filter);

    root.jQuery('#tim-atlas tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.problem) + '</td>' +
        '<td class="mono">' + root.Helpers.escapeHtml(row.classes.join(', ')) + '</td>' +
        '<td>' + root.Helpers.escapeHtml(row.best) + '</td><td>' +
        root.Helpers.escapeHtml(row.lower) + (row.unconditional ? ' ✔' : '') +
        '</td><td>' + root.Helpers.escapeHtml(row.open) + '</td></tr>';
    }).join('') || '<tr><td class="mono">—</td><td class="mono">none</td>' +
      '<td>no entries match this filter</td><td>—</td><td>—</td></tr>');

    root.Helpers.setText('tim-atlas-note',
      'Third column against fourth: the best algorithm we have, and the best limit we can ' +
      'prove. For SAT they are exponential and NOTHING — no superpolynomial lower bound is ' +
      'known — and the gap between those two entries is where P versus NP lives. A tick marks ' +
      'a bound that is unconditional, and there are eight of them in fifteen problems, most in ' +
      'restricted models: sorting by comparisons, PARITY in constant depth, Grover\'s query ' +
      'count. Outside those models the honest answer is almost always "we do not know".');
  }

  function paintTower() {
    root.jQuery('#tim-tower tbody').html(root.ComplexityAtlas.TOWER.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.name) +
        (row.contains === '—' ? '' : ' ⊆ ' + root.Helpers.escapeHtml(row.contains)) +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.strict) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tim-tower-note',
      'Six containments, none of them known to be strict, and three separations that are. Read ' +
      'that together and the situation is odd: we know P ≠ EXPTIME, and NP sits between them, ' +
      'and we cannot say which side of the gap it is on. At least one of the six containments ' +
      'MUST be strict, because the chain from P to EXPTIME is — so somewhere in that tower there ' +
      'is a strict inclusion nobody can point to.');
  }

  function paintPadding() {
    root.jQuery('#tim-padding tbody').html(paddingRows('rows').map(function (row) {
      return '<tr><td class="mono">' + row.n + '</td><td class="mono">' + row.padded +
        '</td><td class="mono">' + row.allowed + '</td><td class="mono">' + row.needed +
        '</td><td class="mono">' + (row.separates ? 'yes' : 'no') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tim-padding-note',
      'Padding is the trick that turns a hierarchy theorem into a statement about specific ' +
      'classes. Take a language decidable in n² steps and pad every instance out to length n². ' +
      'The padded language is now decidable in LINEAR time in its own length — the padding did ' +
      'the growing — while a machine given only linear time on the unpadded instances cannot ' +
      'decide it. The separation was there all along; padding moves it to where the class ' +
      'definitions can see it, and the same manoeuvre is how P ≠ EXPTIME implies separations ' +
      'further up the tower.');
  }

  function paintClaims() {
    const rows = [
      { said: '"SAT is exponential."',
        truth: 'The best known algorithm is exponential in the worst case.',
        rests: 'the literature — no superpolynomial lower bound is proved' },
      { said: '"NP-complete means intractable."',
        truth: 'It means a polynomial algorithm would give one for every NP problem.',
        rests: 'P ≠ NP, which is believed and unproved' },
      { said: '"Sorting is n log n."',
        truth: 'Comparison sorting is; radix sort is linear for integers.',
        rests: 'a PROVED bound, inside the comparison model only' },
      { said: '"This is O(n) so it is fast."',
        truth: 'It is O(n) in some cost model, with a constant nobody stated.',
        rests: 'the unit-cost RAM, usually unstated' },
      { said: '"Matrix multiplication is n^2.37."',
        truth: 'An algorithm with that exponent exists and nobody runs it.',
        rests: 'an asymptotic result whose crossover is astronomically large' },
      { said: '"Quantum computers will break all encryption."',
        truth: 'Shor breaks RSA and ECC; Grover halves symmetric key strength.',
        rests: 'BQP containing factoring, and NOT containing NP as far as anyone knows' },
      { said: '"We proved it needs exponential time."',
        truth: 'Almost certainly a proof in a restricted model, or a hardness result.',
        rests: 'which model — and the model is the load-bearing part of the claim' }
    ];

    root.jQuery('#tim-claims tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.said) + '</td><td>' +
        root.Helpers.escapeHtml(row.truth) + '</td><td>' +
        root.Helpers.escapeHtml(row.rests) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('tim-claims-note',
      'The third column is the one to ask for. Every row in the first column is something a ' +
      'competent engineer says, and every one of them is true under a qualification that is ' +
      'usually left out. The qualification is not pedantry: "proved in the comparison model" ' +
      'and "believed unless P = NP" support completely different decisions. The first closes a ' +
      'line of investigation and the second says look harder, and treating them alike is how ' +
      'teams stop looking for an algorithm that exists.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
