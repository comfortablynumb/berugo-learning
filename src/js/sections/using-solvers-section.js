/**
 * Section: using solvers instead of algorithms.
 *
 * The problem is "assign tasks to slots so that no two conflicting tasks share
 * one", which is graph colouring wearing a scheduling hat, and it is asked
 * with one slot fewer than the conflict graph needs — so the answer is NO and
 * the solver has to prove it.
 *
 * Two effects are measured and they are of completely different sizes. The
 * at-most-one encoding changes the CLAUSE count by three orders of magnitude
 * at scale, and on this DPLL it changes the node count not at all — because
 * the solver branches on the first unassigned variable and the auxiliary
 * variables sit after every decision variable. That limitation is stated
 * rather than hidden. Symmetry breaking changes the node count by a factor of
 * a thousand for six unit clauses, and it is the largest single win available
 * anywhere in this milestone.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'using-solvers';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — model, encode, solve, decode, validate',
      caption: 'The solver is the box you do not write. Everything else is, and the two boxes ' +
        'that decide whether the pipeline works are the first and the last. Encoding is where ' +
        'the engineering effort goes: which at-most-one form, whether to break symmetry, which ' +
        'constraints to state redundantly because they propagate well. Validation is where the ' +
        'defects are caught: a decoded answer checked against the ORIGINAL requirements, by code ' +
        'that shares nothing with the encoder. The dashed return is the part people forget — an ' +
        'UNSAT answer needs a reason, and a solver’s reason is either a proof file or nothing, ' +
        'so an infeasibility diagnosis has to be built rather than read off.',
      definition: [
        'flowchart LR',
        '    R["requirements"] --> M["model:<br/>variables and constraints"]',
        '    M --> E["encode:<br/>at-most-one form,<br/>symmetry breaking"]',
        '    E --> S["solver<br/>(the part you do not write)"]',
        '    S -- "SAT" --> D["decode:<br/>assignment → schedule"]',
        '    D --> V["validate against<br/>the ORIGINAL requirements"]',
        '    V -- "passes" --> OUT["ship it"]',
        '    V -- "fails" --> E',
        '    S -- "UNSAT" --> W["which requirement?<br/>the solver does not say"]',
        '    W -.-> M',
        '    S -- "budget exhausted" --> X["not a proof of anything"]'
      ].join('\n')
    };
  }

  function orientationModelling() {
    return [
      '**For most NP-hard problems that turn up at work the correct move is to encode the problem ' +
        'and call a solver.** Decades of engineering have gone into CDCL SAT solvers, MIP solvers ' +
        'and CP solvers, and none of it is going into your hand-written search.',
      'The work moves from writing an algorithm to writing a MODEL, and a good model beats a ' +
        'clever hand-written search almost every time.',
      '**"At most one of these is true" is the workhorse constraint and there are three ways to ' +
        'write it.** Pairwise is one clause per pair, with no new variables and n(n−1)/2 clauses.',
      'That is fine at n = 5 and half a million clauses at n = 1 000.',
      'Commander splits into groups with a fresh variable per group and recurses. Sequential is a ' +
        'chain of carry variables meaning "one of the first i is true", at 3n clauses.',
      'The demo prices all three exactly.',
      '**The clause count is arithmetic and the solve time is not.** At two thousand literals ' +
        'pairwise is 1 999 000 clauses and sequential is 5 996, which is a factor of 333.',
      'That is the number that decides whether the model fits in memory at all.',
      'Whether it also solves faster depends on the solver, and on this one it does not, which the ' +
        'demo shows rather than glosses.'
    ];
  }

  function orientationSolving() {
    return [
      '**The solver bundled here is DPLL, not CDCL, and that changes what the encoding column can ' +
        'show.** It branches on the first unassigned variable, so the auxiliary variables an ' +
        'encoding introduces sit after every decision variable and never change the shape of the ' +
        'search.',
      'The node counts come out identical across all three encodings, and that is a fact about ' +
        'this solver.',
      'With clause learning the propagation strength of the sequential encoding does show up, and ' +
        'the honest report is the one that says which of the two you are looking at.',
      '**Symmetry breaking is the largest win in this section and it costs six unit clauses.** A ' +
        'proper assignment stays proper when the slots are permuted.',
      'So a solver that has refuted "task 0 goes in slot 1" will refute "task 0 goes in slot 2" ' +
        'again from scratch, c! times over.',
      'Fixing the slots of one mutually conflicting group rules out nothing and deletes that ' +
        'entire factor. The demo measures 1 439 nodes falling to 1.',
      '**The node counts on the unsatisfiable side are exactly 2·c! − 1.** Three slots cost 11 ' +
        'nodes, four cost 47, five cost 239 and six cost 1 439.',
      'The solver is enumerating assignments of the conflicting group to slots, one permutation at ' +
        'a time. Seeing the factorial in the measurement is what makes symmetry breaking obvious ' +
        'rather than clever.',
      '**Redundant constraints can help, which is counter-intuitive.** A constraint implied by the ' +
        'others adds no solutions and can still cut search dramatically, because propagation is ' +
        'not logically complete.',
      'The solver only derives what unit propagation reaches, and a redundant clause can put a ' +
        'consequence within reach that was several inferences away.',
      'Stating "the total headcount equals the total demand" alongside the per-shift constraints ' +
        'is the standard example.',
      '**Read what the solver actually returned.** SAT with a model is a certificate you can check ' +
        'in milliseconds, so check it.',
      'UNSAT is a claim about every assignment, and the only evidence is a proof file.',
      '"Budget exhausted" is neither, and treating it as UNSAT is the mistake that turns a slow ' +
        'model into a wrong answer.'
    ];
  }

  function orientation() {
    return orientationModelling().concat(orientationSolving());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — six models of one schedule, and what each encoding costs',
        markup: root.UsingSolversTemplate.render()
      },
      diagram: diagram(),
      insight: '**Spend your effort on the model and the validation, and treat the solver as a ' +
        'library.** The two highest-leverage moves are both cheap. Break the symmetry your ' +
        'problem obviously has, and validate the decoded answer against the original ' +
        'requirements with code the encoder did not write. The first is worth three orders of ' +
        'magnitude here for six unit clauses. The second is the only defence against a model ' +
        'that quietly answers a different question. Everything else — which at-most-one form, ' +
        'which solver, which parameters — is worth measuring on your own instances, and is worth ' +
        'much less than those two.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.UsingSolversTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const modelsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.SolverLab.encodingStudy({ n: Number(parts[0]), clique: Number(parts[1]),
      colours: Number(parts[2]), groupSize: Number(parts[3]) });
  });

  const scalingFor = root.Helpers.memoise(function (key) {
    return root.SolverLab.atMostOneScaling({ groupSize: Number(key) });
  });

  const sweepFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.SolverLab.colourSweep({ n: Number(parts[0]), clique: Number(parts[1]),
      from: 3, to: Number(parts[1]) + 1 });
  });

  function update(app) {
    const values = panel.values();
    const models = modelsFor(values['slv-n'] + '|' + values['slv-clique'] + '|' +
      values['slv-slots'] + '|' + values['slv-group']);

    paintMetrics(models);
    paintChart(app, scalingFor(values['slv-group']));
    paintModels(models);
    paintScaling(scalingFor(values['slv-group']));
    paintSweep(sweepFor(values['slv-n'] + '|' + values['slv-clique']));
  }

  function paintMetrics(models) {
    const clauses = models.rows.map(function (row) { return row.clauses; });

    root.MetricGrid.update({
      'slv-answer': { value: models.rows[0].satisfiable ? 'a schedule exists' : 'no schedule exists',
        note: models.agreed
          ? 'all six models agree, and so does a hand-written search'
          : 'THE MODELS DISAGREE — one of the encodings is wrong' },
      'slv-clauses': { value: root.Format.exact(Math.min.apply(null, clauses)) + ' – ' +
        root.Format.exact(Math.max.apply(null, clauses)),
        note: 'the same constraints, written three ways, with and without symmetry breaking' },
      'slv-symmetry': { value: root.Format.fixed(models.symmetryGain.factor, 1) + '×',
        note: root.Format.exact(models.symmetryGain.without) + ' nodes falling to ' +
          root.Format.exact(models.symmetryGain.with) },
      'slv-direct': { value: root.Format.exact(models.direct.steps),
        note: 'steps for a backtracking colourer with no encoding at all' }
    });
  }

  function paintChart(app, scaling) {
    const host = root.jQuery('#slv-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    const seriesFor = function (name) {
      return { label: name, points: scaling.rows.map(function (row) {
        const entry = row.encodings.filter(function (item) { return item.encoding === name; })[0];
        return { x: row.n, y: Math.max(1, entry.clauses) };
      }) };
    };
    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, logX: true, logY: true, yMin: 1,
      xLabel: 'literals in the group (log scale)', yLabel: 'clauses (log scale)',
      series: [seriesFor('pairwise'), seriesFor('commander'), seriesFor('sequential')]
    });

    const last = scaling.rows[scaling.rows.length - 1];
    const pairwise = last.encodings[0];
    const sequential = last.encodings[2];
    root.Helpers.setText('slv-chart-note',
      'Three correct ways to say "at most one of these is true", priced exactly with no solving ' +
      'involved. Pairwise is n(n−1)/2 and has slope 2 on a log-log plot; commander and ' +
      'sequential are linear and have slope 1. At ' + root.Format.exact(last.n) + ' literals ' +
      'that is ' + root.Format.exact(pairwise.clauses) + ' clauses against ' +
      root.Format.exact(sequential.clauses) + ', a factor of ' +
      root.Format.fixed(pairwise.clauses / sequential.clauses, 0) + '. This is the plot that ' +
      'decides whether a model fits in memory, and it is arithmetic rather than opinion — which ' +
      'is exactly why it is worth checking before anything is tuned.');
  }

  function paintModels(models) {
    root.jQuery('#slv-models tbody').html(models.rows.map(function (row) {
      return '<tr><td class="mono">' + row.encoding + '</td><td class="mono">' +
        (row.symmetryBreaking ? 'on (' + root.Format.exact(row.symmetryClauses) + ' unit clauses)'
          : 'off') + '</td><td class="mono">' + root.Format.exact(row.variables) +
        '</td><td class="mono">' + root.Format.exact(row.auxiliary) + '</td><td class="mono">' +
        root.Format.exact(row.clauses) + '</td><td class="mono">' +
        (row.exhausted ? 'unknown' : (row.satisfiable ? 'YES' : 'NO')) + '</td><td class="mono">' +
        root.Format.exact(row.nodes) + '</td><td class="mono">' +
        root.Format.exact(row.propagations) + '</td><td class="mono">' +
        (row.agreesWithDirect ? 'yes' : 'NO — BUG') + '</td></tr>';
    }).join(''));

    const plain = models.rows.filter(function (row) { return !row.symmetryBreaking; });
    const broken = models.rows.filter(function (row) { return row.symmetryBreaking; });
    const distinctNodes = new Set(plain.map(function (row) { return row.nodes; }));
    root.Helpers.setText('slv-models-note',
      'Six models, one question, and the last column says every one of them answers it the same ' +
      'way as a hand-written backtracking colourer — which is the check that makes the rest of ' +
      'the table meaningful rather than fast. Now read the clause column against the node ' +
      'column. The clause counts differ; the node counts of the three plain rows are ' +
      (distinctNodes.size === 1 ? 'IDENTICAL' : 'different') + '. That is this solver: DPLL ' +
      'branching on the first unassigned variable, with every auxiliary variable numbered after ' +
      'every decision variable, so an encoding cannot change the order it explores. The ' +
      'propagation column does move, which is the encoding difference that a clause-learning ' +
      'solver converts into time. The symmetry rows are a different order of effect entirely: ' +
      root.Format.exact(broken[0].symmetryClauses) +
      ' unit clauses take ' + root.Format.exact(models.symmetryGain.without) + ' nodes to ' +
      root.Format.exact(models.symmetryGain.with) + '.');
  }

  function paintScaling(scaling) {
    root.jQuery('#slv-scaling tbody').html(scaling.rows.map(function (row) {
      const pairwise = row.encodings[0];
      const commander = row.encodings[1];
      const sequential = row.encodings[2];
      return '<tr><td class="mono">' + root.Format.exact(row.n) + '</td><td class="mono">' +
        root.Format.exact(pairwise.clauses) + '</td><td class="mono">' +
        root.Format.exact(commander.clauses) + '</td><td class="mono">' +
        root.Format.exact(commander.auxiliary) + '</td><td class="mono">' +
        root.Format.exact(sequential.clauses) + '</td><td class="mono">' +
        root.Format.exact(sequential.auxiliary) + '</td><td class="mono">' +
        root.Format.fixed(pairwise.clauses / Math.max(1, sequential.clauses), 1) + '×</td></tr>';
    }).join(''));

    const small = scaling.rows[0];
    const large = scaling.rows[scaling.rows.length - 1];
    root.Helpers.setText('slv-scaling-note',
      'At ' + root.Format.exact(small.n) + ' literals pairwise is the smallest encoding — ' +
      root.Format.exact(small.encodings[0].clauses) + ' clauses against ' +
      root.Format.exact(small.encodings[2].clauses) + ' — and it introduces no variables, which ' +
      'is why it is the right default for the three-way and four-way constraints that make up ' +
      'most of a real model. At ' + root.Format.exact(large.n) + ' it is ' +
      root.Format.fixed(large.encodings[0].clauses / large.encodings[2].clauses, 0) +
      ' times larger. The crossover is around twenty literals, and knowing where it is means ' +
      'never having to argue about it: use pairwise for small groups and a counter for large ' +
      'ones, in the same model.');
  }

  function paintSweep(sweep) {
    const byColour = new Map();

    sweep.rows.forEach(function (row) {
      if (!byColour.has(row.colours)) byColour.set(row.colours, {});
      byColour.get(row.colours)[row.symmetryBreaking ? 'broken' : 'plain'] = row;
    });
    root.jQuery('#slv-sweep tbody').html(Array.from(byColour.entries()).map(function (entry) {
      const colours = entry[0];
      const plain = entry[1].plain;
      const broken = entry[1].broken;
      return '<tr><td class="mono">' + colours + '</td><td class="mono">' +
        (plain.satisfiable ? 'YES' : 'NO') + '</td><td class="mono">' +
        root.Format.exact(plain.nodes) + '</td><td class="mono">' +
        root.Format.exact(broken.nodes) + '</td><td class="mono">' +
        root.Format.fixed(plain.nodes / Math.max(1, broken.nodes), 1) + '×</td><td class="mono">' +
        root.Format.exact(2 * factorialOf(colours) - 1) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('slv-sweep-note',
      'The conflict group has ' + root.Format.exact(sweep.clique) + ' mutually conflicting ' +
      'tasks, so anything below ' + root.Format.exact(sweep.clique) + ' slots is a NO. The last ' +
      'two columns are the same number on every NO row: the solver is enumerating assignments of ' +
      'the conflicting group to slots, one permutation at a time, and 2·c! − 1 is exactly what ' +
      'that costs. Fixing those tasks to slots 1, 2, 3, … rules out no solution, because they ' +
      'need distinct slots anyway — and it takes the whole factorial out of the search. Above ' +
      'the boundary the answer is YES and the effect is small, because a search that finds an ' +
      'answer never had to explore the symmetric copies.');
  }

  function factorialOf(n) {
    let value = 1;

    for (let i = 2; i <= n; i += 1) value *= i;
    return value;
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
