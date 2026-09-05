/**
 * Section: beyond NP.
 *
 * The demo changes nothing but the quantifier prefix. The clauses are fixed,
 * the variables are fixed, and putting a ∀ in front of some of them turns a
 * satisfiable formula into a false sentence — which is the shortest possible
 * demonstration that PSPACE is a different question rather than a bigger one.
 *
 * The two games are the other half. ∀x ∃y (x ↔ y) is true at every size and
 * ∃y ∀x (x ↔ y) is false at every size, with identical clauses; the only
 * difference is who moves first. A YES answer to the first has no short
 * certificate — the witness is a STRATEGY, a function from the opponent's
 * moves to yours — and that is the practical content of the class jump.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'beyond-np';
  let panel = null;
  let chart = null;

  const CLASSES = [
    { name: 'P', question: 'can a machine decide it in polynomial time?',
      complete: 'circuit value, linear programming', certificate: 'none needed — recompute it' },
    { name: 'NP', question: 'does SOME certificate make a polynomial verifier accept?',
      complete: 'SAT, clique, 3-colouring', certificate: 'the certificate, one line' },
    { name: 'co-NP', question: 'do ALL certificates make it reject?',
      complete: 'tautology, UNSAT', certificate: 'a resolution proof — possibly exponential' },
    { name: 'Σ₂ᴾ', question: 'does some x exist such that for all y, something holds?',
      complete: 'minimum equivalent DNF, ∃∀-QBF',
      certificate: 'x, plus a co-NP proof that no y breaks it' },
    { name: 'PH', question: 'the tower of alternations, Σₖ and Πₖ for every k',
      complete: 'none known — a complete problem would collapse it',
      certificate: 'k alternating quantifier blocks' },
    { name: 'PSPACE', question: 'can a machine decide it in polynomial SPACE, any time?',
      complete: 'QBF, generalised geography, most two-player games',
      certificate: 'a strategy — exponentially large in general' },
    { name: '#P', question: 'HOW MANY certificates are there?',
      complete: 'counting satisfying assignments, the permanent',
      certificate: 'none — the answer is a number, not a witness' },
    { name: 'EXPTIME', question: 'can a machine decide it in exponential time?',
      complete: 'generalised chess, generalised go',
      certificate: 'provably not polynomial — this class is known to be strictly larger than P' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the containment tower, and the one strict inclusion anybody has proved',
      caption: 'Every containment drawn here is known; almost none of them is known to be ' +
        'strict. P ⊆ NP ⊆ PH ⊆ PSPACE ⊆ EXPTIME, and the only place the chain is known to ' +
        'separate is at the ends: the time hierarchy theorem gives P ≠ EXPTIME. So at least one ' +
        'of the inclusions in between is strict and nobody knows which. #P sits to the side ' +
        'because it is a class of counting problems rather than decision problems; Toda’s ' +
        'theorem places the whole polynomial hierarchy inside P with one call to a #P oracle, ' +
        'which is the formal version of "counting is harder than deciding".',
      definition: [
        'flowchart TD',
        '    P["P — solvable in polynomial time"]',
        '    NP["NP — YES checkable"]',
        '    CONP["co-NP — NO checkable"]',
        '    S2["Σ₂ᴾ — ∃ then ∀"]',
        '    PH["PH — the whole alternation tower"]',
        '    PS["PSPACE — QBF, games"]',
        '    EXP["EXPTIME — provably bigger than P"]',
        '    SP["#P — counting the certificates"]',
        '    P --> NP',
        '    P --> CONP',
        '    NP --> S2',
        '    CONP --> S2',
        '    S2 --> PH',
        '    PH --> PS',
        '    PS --> EXP',
        '    PS -.- SP',
        '    P -. "strict, by the time<br/>hierarchy theorem" .-> EXP'
      ].join('\n')
    };
  }

  function orientationQbf() {
    return [
      '**A quantified Boolean formula is the same clauses with a quantifier in front of every ' +
        'variable.** The question is whether the sentence is true. ∃ marks the variables you ' +
        'choose and ∀ the ones an adversary chooses, in the order the prefix names.',
      'With every quantifier existential it is exactly SAT.',
      'With ∀ anywhere it is a different problem, and the demo shows the answer changing while ' +
        'the clauses do not.',
      '**QBF is the canonical PSPACE-complete problem, and the reason is that it is a game.** The ' +
        'existential player picks the ∃ variables and the universal player picks the ∀ ones, ' +
        'alternating.',
      'The existential player wins when the clauses end up satisfied.',
      'Deciding who wins a game is the shape of PSPACE-completeness, and generalised chess, go and ' +
        'geography are all in this family for the same reason.',
      '**The certificate is what changed, and it is the whole practical difference.** A ' +
        'satisfiable SAT instance has a certificate one line long.',
      'A true QBF sentence with k universal variables has, in general, no certificate shorter ' +
        'than a STRATEGY. That is a function from the opponent’s moves to yours, and it takes 2ᵏ ' +
        'entries to write down.',
      '"Easy to check" stops being available, and that is why the class is different rather than ' +
        'merely larger.',
      '**Expanding the quantifiers away is correct and does not help.** Conjoining a copy of the ' +
        'matrix for every assignment of the universal variables produces one ordinary CNF with the ' +
        'same answer, and the demo builds it.',
      'It doubles in size per ∀ variable. Twenty universals is a million copies.',
      'That is the honest reason "just call a SAT solver" is not a strategy for QBF, and why QBF ' +
        'solvers are their own field.'
    ];
  }

  function orientationHierarchy() {
    return [
      '**Σ₂ is one alternation and it is the shape of an enormous number of real problems.** ' +
        '"Find the smallest configuration that no adversary can break" is ∃ config ∀ attack.',
      'So is "find the shortest program equivalent to this one", and "find a schedule robust to ' +
        'every failure in this set".',
      'These are qualitatively harder than plain optimisation, not just bigger, and recognising ' +
        'the ∀ is what tells you so.',
      '**The polynomial hierarchy is that pattern repeated.** Σₖ is k alternating blocks starting ' +
        'with ∃, and Πₖ starts with ∀.',
      'Each level is believed strictly larger than the last, and if any two adjacent levels are ' +
        'equal the whole hierarchy collapses to that point.',
      'P = NP would collapse it entirely, which is one more reason to doubt it.',
      '**#P is counting rather than deciding, and it is harder in a way that is easy to miss.** ' +
        'Counting satisfying assignments is #P-complete even for problems whose DECISION version ' +
        'is in P.',
      'Counting perfect matchings in a bipartite graph is #P-complete, while FINDING one is ' +
        'polynomial.',
      'Any time a requirement says "how many" rather than "is there", check whether the counting ' +
        'version has jumped class.',
      '**EXPTIME is the one place the tower is known to separate.** The time hierarchy theorem ' +
        'proves P ≠ EXPTIME, so at least one containment between them is strict, and nobody knows ' +
        'which.',
      'That single proved separation is the whole of what is settled about this diagram.',
      'It is worth remembering the next time a containment picture is presented as established ' +
        'fact.'
    ];
  }

  function orientation() {
    return orientationQbf().concat(orientationHierarchy());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — one matrix, five prefixes, and two games',
        markup: root.BeyondNpTemplate.render()
      },
      diagram: diagram(),
      insight: '**Look for the ∀ in the requirement.** "Pick a configuration" is an optimisation ' +
        'problem, and there is a large toolbox for it. "Pick a configuration that survives every ' +
        'input in this set" has an adversary inside it, and no amount of solver tuning turns the ' +
        'second into the first. It is a level up the hierarchy, and the practical consequences ' +
        'are immediate. There is no short certificate to log, and no incremental warm start ' +
        'between related queries. The solver’s progress cannot be reported either, because "how ' +
        'much of the adversary space is left" is not a number it holds. The engineering move is ' +
        'almost always to bound the adversary explicitly: enumerate the failure set, fix a threat ' +
        'model, cap the horizon. That converts a ∀ into a finite conjunction and puts the problem ' +
        'back in NP where the tools live.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BeyondNpTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NpLab.qbfStudy({ variables: Number(parts[0]), clauses: Number(parts[1]),
      seed: Number(parts[2]), pairs: Number(parts[3]) });
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(values['bnp-variables'] + '|' + values['bnp-clauses'] + '|' +
      values['bnp-seed'] + '|' + values['bnp-pairs']);

    paintMetrics(study);
    paintChart(app, study);
    paintPrefixes(study);
    paintGames(study);
    paintClasses();
  }

  function paintMetrics(study) {
    const plain = study.rows[0];
    const alternating = study.rows[study.rows.length - 1];

    root.MetricGrid.update({
      'bnp-sat': { value: plain.value ? 'TRUE' : 'FALSE',
        note: root.Format.exact(study.clauses) + ' clauses over ' +
          root.Format.exact(study.variables) + ' variables, all existential' },
      'bnp-alternating': { value: alternating.value ? 'TRUE' : 'FALSE',
        note: 'prefix ' + alternating.pattern + ', ' +
          root.Format.exact(alternating.alternations) + ' alternations, ' +
          root.Format.exact(alternating.universals) + ' universal variables' },
      'bnp-expansion': { value: root.Format.exact(alternating.expansionClauses),
        note: root.Format.exact(alternating.expansionCopies) + ' copies of the matrix, one per ' +
          'assignment of the ∀ variables' },
      'bnp-strategy': { value: '2^' + alternating.universals + ' = ' +
        root.Format.exact(Math.pow(2, alternating.universals)) + ' entries',
        note: 'a strategy, not an assignment — this is what leaves NP behind' }
    });
  }

  function paintChart(app, study) {
    const host = root.jQuery('#bnp-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    const points = study.rows.map(function (row, index) {
      return { row: row, index: index };
    });
    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, logY: true, yMin: 1,
      xLabel: 'universal variables in the prefix', yLabel: 'count (log scale)',
      series: [
        { label: 'clauses after expanding every ∀', points: points.map(function (entry) {
          return { x: entry.row.universals, y: Math.max(1, entry.row.expansionClauses) };
        }).sort(function (a, b) { return a.x - b.x; }) },
        { label: 'nodes the recursive evaluator visited', points: points.map(function (entry) {
          return { x: entry.row.universals, y: entry.row.nodes };
        }).sort(function (a, b) { return a.x - b.x; }) },
        { label: 'truth-table entries the oracle built', dashed: true,
          points: points.map(function (entry) {
            return { x: entry.row.universals, y: entry.row.oracleEntries };
          }).sort(function (a, b) { return a.x - b.x; }) }
      ]
    });

    root.Helpers.setText('bnp-chart-note',
      'Expansion is the honest cost of "just turn it into SAT": one copy of the matrix per ' +
      'assignment of the universal variables, so the clause count doubles with every ∀ added to ' +
      'the prefix. The evaluator does better because it prunes — a branch whose partial ' +
      'assignment already falsifies a clause ends there — but it is still walking a tree whose ' +
      'depth is the number of variables. The dashed line is the oracle, which builds the whole ' +
      '2ⁿ truth table and folds the prefix inward; it is the reference the evaluator is checked ' +
      'against on every row, and it shares no code with it.');
  }

  function paintPrefixes(study) {
    root.jQuery('#bnp-prefixes tbody').html(study.rows.map(function (row) {
      return '<tr><td class="mono">' + row.pattern + '</td><td class="mono">' +
        root.Format.exact(row.alternations) + '</td><td class="mono">' +
        root.Format.exact(row.universals) + '</td><td class="mono">' +
        (row.value ? 'TRUE' : 'FALSE') + '</td><td class="mono">' +
        (row.agrees ? 'yes' : 'NO — BUG') + '</td><td class="mono">' +
        root.Format.exact(row.nodes) + '</td><td class="mono">' +
        (row.asSat ? 'SAT' : 'UNSAT') + '</td><td class="mono">' +
        root.Format.exact(row.expansionClauses) + '</td></tr>';
    }).join(''));

    const flipped = study.rows.filter(function (row) {
      return row.asSat && !row.value;
    });
    root.Helpers.setText('bnp-prefixes-note',
      'Every row has the same clauses and the same variables. The seventh column is what a SAT ' +
      'solver says about them, and it does not change; the fourth is what the QUANTIFIED ' +
      'sentence says, and it does. ' + root.Format.exact(flipped.length) + ' of ' +
      root.Format.exact(study.rows.length) + ' prefixes turn a satisfiable formula into a false ' +
      'sentence. That is the point of the section in one table: SAT asks whether some assignment ' +
      'works, and QBF asks whether you can still win when somebody else picks half of it. The ' +
      'fifth column is the recursive evaluator agreeing with a truth-table oracle that folds the ' +
      'prefix from the inside out — two implementations sharing nothing, on every row.');
  }

  function paintGames(study) {
    root.jQuery('#bnp-games tbody').html(study.games.map(function (row) {
      return '<tr><td class="mono">' + row.pairs + '</td><td class="mono">' + row.order +
        '</td><td class="mono">' + (row.value ? 'TRUE' : 'FALSE') + '</td><td class="mono">' +
        root.Format.exact(row.nodes) + '</td><td>' +
        (row.value
          ? 'a function of the opponent’s ' + row.pairs + ' moves — ' +
            root.Format.exact(row.strategySize) + ' entries'
          : 'none exists')
        + '</td><td>' + row.reason + '</td></tr>';
    }).join(''));

    const biggest = study.games[study.games.length - 2];
    root.Helpers.setText('bnp-games-note',
      '∀x ∃y (x ↔ y) says "whatever you play, I can match it", and it is true at every size. ' +
      '∃y ∀x (x ↔ y) says "I can pick an answer now that matches whatever you play later", and ' +
      'it is false at every size. The clauses are byte-for-byte identical in both rows of each ' +
      'pair; only the prefix order differs. Notice what a YES certificate would have to be for ' +
      'the true one at ' + biggest.pairs + ' rounds: not an assignment but ' +
      root.Format.exact(biggest.strategySize) + ' of them, one per thing the opponent might do. ' +
      'A SAT solver reads both of these as satisfiable, because it never sees the prefix.');
  }

  function paintClasses() {
    root.jQuery('#bnp-classes tbody').html(CLASSES.map(function (entry) {
      return '<tr><td class="mono">' + entry.name + '</td><td>' + entry.question + '</td><td>' +
        entry.complete + '</td><td>' + entry.certificate + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bnp-classes-note',
      'The right-hand column is the one to read down. NP has a short certificate; co-NP does ' +
      'not, as far as anyone knows; Σ₂ has one only relative to a co-NP oracle; PSPACE has a ' +
      'strategy rather than a witness; #P has no certificate at all because its answer is a ' +
      'count. Every practical consequence in this section — what you can log, what you can ' +
      'audit, what you can warm-start, what you can report progress on — follows from that ' +
      'column rather than from the running times.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
