/**
 * Section: SAT and the NP-complete zoo.
 *
 * The demo puts six clause families of the same size in one table and the
 * whole section is in the node column. A Horn formula of 42 variables is
 * decided by propagation alone and DPLL branches zero times; a random 3-SAT
 * formula of 42 variables branches; the pigeonhole formula of 42 variables
 * branches 1 439 times, which is exactly 2·6! − 1 and is the counter-example
 * to "SAT solvers are fast now".
 *
 * The polynomial islands are the practically important half. A great deal of
 * real configuration and dependency logic is Horn, and stays Horn until
 * somebody adds one "either X or Y" — after which it is general SAT and the
 * resolver's behaviour changes class rather than degree.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'sat-zoo';
  let panel = null;
  let chart = null;

  const ISLANDS = [
    { fragment: '2-SAT', restriction: 'at most two literals per clause',
      algorithm: 'build the implication graph, take strongly connected components; unsatisfiable exactly when some x and ¬x share one. Linear.' },
    { fragment: 'Horn-SAT', restriction: 'at most one POSITIVE literal per clause',
      algorithm: 'unit propagation to a fixed point, producing the minimal model. Linear in the formula.' },
    { fragment: 'dual-Horn', restriction: 'at most one negative literal per clause',
      algorithm: 'the same argument with the polarities swapped; the maximal model rather than the minimal one.' },
    { fragment: 'XOR-SAT', restriction: 'parity constraints instead of disjunctions',
      algorithm: 'Gaussian elimination over GF(2). Cubic, and it is not a special case of anything above.' },
    { fragment: 'affine / bounded-width', restriction: 'Schaefer’s dichotomy: these six families and no others',
      algorithm: 'Schaefer’s theorem says every Boolean constraint language is either in P or NP-complete — there is nothing in between.' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — Karp’s chain outward from Cook–Levin, with the polynomial islands marked',
      caption: 'Cook and Levin showed independently that every problem in NP reduces to SAT, by ' +
        'encoding the run of a verifier as a formula: variables for the tape contents at each ' +
        'step, clauses saying each step follows the transition table. That single result makes ' +
        'SAT complete for NP, and every arrow after it is one gadget construction. The chain ' +
        'matters because it means a new hardness proof is one reduction from any node on it, ' +
        'not a proof from first principles. The three shaded nodes are fragments of SAT with ' +
        'polynomial algorithms — they are not on the chain because nothing NP-complete reduces ' +
        'to them, and they are the ones you meet at work.',
      definition: [
        'flowchart LR',
        '    NP["every problem in NP"] -->|"Cook–Levin: encode<br/>the computation"| SAT["SAT"]',
        '    SAT -->|"chain wide clauses"| S3["3-SAT"]',
        '    S3 -->|"triangle per clause"| IS["independent set"]',
        '    IS -->|"complement the graph"| CL["clique"]',
        '    IS -->|"complement the set"| VC["vertex cover"]',
        '    VC -->|"a set per vertex"| SC["set cover"]',
        '    S3 -->|"palette + OR gadgets"| COL["3-colouring"]',
        '    S3 -->|"digits per variable"| SS["subset sum"]',
        '    SS -->|"two forcing numbers"| PT["partition"]',
        '    S3 -->|"choice + join gadgets"| HAM["Hamiltonian cycle"]',
        '    I2["2-SAT — linear"]:::island',
        '    IH["Horn-SAT — linear"]:::island',
        '    IX["XOR-SAT — cubic"]:::island',
        '    SAT -.-> I2',
        '    SAT -.-> IH',
        '    SAT -.-> IX',
        '    classDef island fill:#0f766e,stroke:#0f766e,color:#ffffff'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Cook and Levin proved that every problem in NP reduces to SAT, and the idea is one ' +
        'sentence: encode the run of the verifier as a formula.** Variables say what is on the ' +
        'tape at each step; clauses say each step follows the transition table and the last ' +
        'step accepts. The formula is satisfiable exactly when some certificate makes the ' +
        'verifier accept. That is the whole construction, and it is why SAT rather than some ' +
        'other problem sits at the root.',
      '**3-CNF is not a weaker problem than CNF.** Any clause can be chained into 3-clauses ' +
        'linked by fresh variables, preserving satisfiability and growing the formula ' +
        'linearly. So 3-SAT is NP-complete too, and it is the convenient root for gadget ' +
        'constructions because a clause of exactly three literals becomes a triangle, a ' +
        'three-way choice, or three digits — a fixed small shape.',
      '**Karp’s chain is twenty-one problems and each link is one gadget.** Independent set, ' +
        'clique and vertex cover are the same problem read three ways; set cover generalises ' +
        'the third; subset sum and partition are the arithmetic branch; 3-colouring and ' +
        'Hamiltonian cycle are the graph branch. A new hardness proof is one link from any of ' +
        'them, which is why the chain is worth carrying in your head.',
      '**The polynomial islands matter far more day to day than the hardness result.** ' +
        '2-SAT is linear by strongly connected components; Horn-SAT is linear by unit ' +
        'propagation; XOR-SAT is cubic by Gaussian elimination. A great deal of real ' +
        'configuration logic lands inside one of them without anybody noticing, and that is ' +
        'why package resolvers over pure requirements are fast.',
      '**"A requires B and C" is the Horn clause (¬A ∨ B) ∧ (¬A ∨ C).** At most one positive ' +
        'literal per clause is exactly the shape of a requirement, so a dependency graph is ' +
        'Horn by construction and unit propagation decides it in one pass over the formula, ' +
        'producing the MINIMAL model — the smallest set of packages that satisfies the ' +
        'requirements, which is also the answer you wanted.',
      '**One "either X or Y" changes the complexity class.** A virtual package with two ' +
        'providers is the clause (¬A ∨ X ∨ Y), which has two positive literals and is not ' +
        'Horn. Add conflicts, which are Horn on their own, and the combination is general SAT. ' +
        'That is the honest explanation for why some resolvers are instantaneous and others ' +
        'occasionally hang: the two are not the same algorithm on different inputs, they are ' +
        'different problems.',
      '**The pigeonhole formula is the standing counter-example to "modern solvers are fast".** ' +
        'PHP(n) says n + 1 pigeons fit in n holes; it is unsatisfiable, a human sees why ' +
        'immediately, and every resolution-based solver — which is every CDCL solver — needs ' +
        'exponentially many steps to say so, because Haken proved resolution has no ' +
        'polynomial proof of it. The demo measures the node count and it is exactly 2·h! − 1.',
      '**Schaefer’s dichotomy says there is no middle.** Every Boolean constraint satisfaction ' +
        'language is either in P — one of six families, the islands above — or NP-complete. ' +
        'Nothing sits between. That is unusual and useful: for a Boolean constraint problem, ' +
        '"probably somewhere in between" is not an available answer, so it is worth checking ' +
        'which of the six your constraints fall into before assuming the worst.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — six clause families, the chain, and the islands',
        markup: root.SatZooTemplate.render()
      },
      diagram: diagram(),
      insight: '**Before assuming your constraint problem is hard, check whether it is Horn.** ' +
        'The test is one line — does every clause have at most one positive literal? — and when ' +
        'it passes, the answer comes from propagation in time linear in the formula, with the ' +
        'minimal model as a bonus. When it fails, the clause that broke it is usually a single ' +
        'disjunction someone added for a good reason, and knowing WHICH clause is what makes the ' +
        'conversation about it possible: "this one alternative dependency is why resolution can ' +
        'now take exponential time" is an engineering trade-off, and "the resolver is slow ' +
        'sometimes" is not.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SatZooTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const familiesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NpLab.islandStudy({ variables: Number(parts[0]), holes: Number(parts[1]),
      seed: Number(parts[2]) });
  });

  const phpFor = root.Helpers.memoise(function () {
    return root.NpLab.pigeonholeSweep({ from: 3, to: 8 });
  });

  function update(app) {
    const values = panel.values();
    const families = familiesFor(values['saz-variables'] + '|' + values['saz-holes'] + '|' +
      values['saz-seed']);
    const php = phpFor('');

    paintMetrics(families, values['saz-holes']);
    paintChart(app, php);
    paintFamilies(families);
    paintPhp(php);
    paintChain();
    paintIslands();
  }

  function rowFor(families, needle) {
    return families.rows.filter(function (row) {
      return row.label.indexOf(needle) !== -1;
    })[0];
  }

  function paintMetrics(families, holes) {
    const horn = families.rows[0];
    const critical = rowFor(families, '4.27');
    const php = rowFor(families, 'pigeonhole');
    const factorial = factorialOf(Number(holes));

    root.MetricGrid.update({
      'saz-horn': { value: root.Format.exact(horn.linearSteps),
        note: root.Format.exact(horn.clauses) + ' clauses decided with ' +
          root.Format.exact(horn.nodes) + ' search node — propagation alone' },
      'saz-random': { value: root.Format.exact(critical.nodes),
        note: root.Format.exact(critical.clauses) + ' clauses at the critical ratio, ' +
          root.Format.exact(critical.conflicts) + ' conflicts' },
      'saz-php': { value: root.Format.exact(php.nodes),
        note: '2 × ' + holes + '! − 1 = ' + root.Format.exact(2 * factorial - 1) +
          ', from only ' + root.Format.exact(php.clauses) + ' clauses' },
      'saz-islands': { value: '3 in the demo, 6 in Schaefer',
        note: '2-SAT, Horn-SAT and XOR-SAT all have real polynomial algorithms' }
    });
  }

  function factorialOf(n) {
    let value = 1;

    for (let i = 2; i <= n; i += 1) value *= i;
    return value;
  }

  function paintChart(app, php) {
    const host = root.jQuery('#saz-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, logY: true, yMin: 1,
      xLabel: 'holes', yLabel: 'count (log scale)',
      series: [
        { label: 'clauses in the formula', points: php.rows.map(function (row) {
          return { x: row.holes, y: row.clauses };
        }) },
        { label: 'DPLL search nodes', points: php.rows.map(function (row) {
          return { x: row.holes, y: row.nodes };
        }) },
        { label: '2 · h! − 1', dashed: true, points: php.rows.map(function (row) {
          return { x: row.holes, y: 2 * factorialOf(row.holes) - 1 };
        }) }
      ]
    });

    const last = php.rows[php.rows.length - 1];
    root.Helpers.setText('saz-chart-note',
      'The formula grows quadratically — ' + root.Format.exact(php.rows[0].clauses) + ' clauses ' +
      'at ' + php.rows[0].holes + ' holes and ' + root.Format.exact(last.clauses) + ' at ' +
      last.holes + ' — and the search does not. The dashed line is 2·h! − 1 and the measured ' +
      'node count lies exactly on it at every size, which is worth pausing over: the solver is ' +
      'not merely slow here, it is enumerating the assignments of pigeons to holes one ' +
      'permutation at a time, because resolution has no shorter proof to find. The instance a ' +
      'human refutes in one sentence costs ' + root.Format.exact(last.nodes) + ' search nodes.');
  }

  function paintFamilies(families) {
    root.jQuery('#saz-families tbody').html(families.rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' + (row.horn ? 'yes' : 'no') +
        '</td><td class="mono">' + root.Format.exact(row.variables) + '</td><td class="mono">' +
        root.Format.exact(row.clauses) + '</td><td class="mono">' +
        (row.linearSteps === null ? '—' : root.Format.exact(row.linearSteps)) +
        '</td><td class="mono">' + root.Format.exact(row.nodes) + '</td><td class="mono">' +
        root.Format.exact(row.conflicts) + '</td><td class="mono">' +
        (row.exhausted ? 'unknown — budget' : (row.satisfiable ? 'SAT' : 'UNSAT')) + '</td></tr>';
    }).join(''));

    const horn = families.rows[0];
    const php = rowFor(families, 'pigeonhole');
    root.Helpers.setText('saz-families-note',
      'Six formulas of comparable size and a node column that spans three orders of magnitude. ' +
      'The two Horn rows never branch at all — ' + root.Format.exact(horn.nodes) + ' node — ' +
      'because propagation reaches a fixed point that is either a model or a contradiction, and ' +
      'the fifth column is that propagation counted in clause visits. The random rows branch a ' +
      'little and the pigeonhole row branches ' + root.Format.exact(php.nodes) + ' times on ' +
      root.Format.exact(php.clauses) + ' clauses. Size is not what separates them: structure is.');
  }

  function paintPhp(php) {
    root.jQuery('#saz-sweep tbody').html(php.rows.map(function (row) {
      const predicted = 2 * factorialOf(row.holes) - 1;
      return '<tr><td class="mono">' + row.holes + '</td><td class="mono">' + row.pigeons +
        '</td><td class="mono">' + root.Format.exact(row.variables) + '</td><td class="mono">' +
        root.Format.exact(row.clauses) + '</td><td class="mono">' +
        root.Format.exact(row.nodes) + '</td><td class="mono">' +
        root.Format.exact(row.conflicts) + '</td><td class="mono">' +
        root.Format.fixed(row.nodes / predicted, 4) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('saz-sweep-note',
      'The last column is the measured node count divided by 2·h! − 1, and it is 1.0000 in ' +
      'every row. The conflict column is h! exactly. This is not a coincidence of the ' +
      'implementation: DPLL with the first-unassigned variable order assigns pigeons to holes in ' +
      'order and backtracks over every permutation, and Haken’s theorem says no resolution-based ' +
      'solver — clause learning included — can do asymptotically better. When somebody says ' +
      'modern solvers handle millions of variables, this eight-hole instance with ' +
      root.Format.exact(php.rows[php.rows.length - 1].clauses) + ' clauses is the reply.');
  }

  function paintChain() {
    const chain = root.NpLab.reductionChain();
    const labelOf = function (id) {
      const node = chain.nodes.filter(function (item) { return item.id === id; })[0];
      return node ? node.label : id;
    };

    root.jQuery('#saz-chain tbody').html(chain.edges.map(function (edge) {
      return '<tr><td>' + labelOf(edge.from) + '</td><td>' + labelOf(edge.to) + '</td><td>' +
        edge.via + '</td></tr>';
    }).join(''));

    root.Helpers.setText('saz-chain-note',
      'Nine links, and every one of the first five is implemented in this milestone and ' +
      'round-tripped in section 20.2 — the arrows are runnable rather than cited. Read the ' +
      'direction carefully: the arrow points from the problem being reduced FROM to the problem ' +
      'reduced TO, so it means "this one is at least as hard as that one" and it also means ' +
      '"you can solve the left by calling a solver for the right".');
  }

  function paintIslands() {
    root.jQuery('#saz-island-table tbody').html(ISLANDS.map(function (island) {
      return '<tr><td class="mono">' + island.fragment + '</td><td>' + island.restriction +
        '</td><td>' + island.algorithm + '</td></tr>';
    }).join(''));

    root.Helpers.setText('saz-island-note',
      'None of these is a heuristic or a special case that "usually" works — each is a genuine ' +
      'polynomial algorithm for a syntactically checkable fragment. Checking membership costs a ' +
      'pass over the clauses, so the check is free relative to solving, and it is worth doing ' +
      'before reaching for a solver: an instance inside one of these fragments has an algorithm ' +
      'with a guarantee, and one outside them does not.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
