/**
 * Section: SAT solving.
 *
 * Two things are shown that a solver normally keeps to itself. The first is
 * the implication graph at a chosen conflict, drawn from a snapshot taken
 * before the solver backjumps, with the literals of the learned clause marked
 * — the cut, as an object rather than a description. The second is the
 * evidence: a SAT answer's model is re-checked clause by clause and an UNSAT
 * answer's DRAT proof is replayed by a checker with no search in it.
 *
 * The comparison against M20's plain DPLL is deliberately run on four
 * families, because "clause learning is why solvers are fast" is only true on
 * two of them. On planted satisfiable instances the simpler search wins, and
 * on the pigeonhole family both are exponential and the learning solver does
 * far more work per decision.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'sat-solving';
  const SCALE = [10, 20, 30, 40, 50, 60, 70];
  const SHOWCASE = { pigeonhole: 5, random: 70, planted: 80, horn: 40 };
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
      title: 'Diagram — the CDCL loop, and where the clause comes from',
      caption: 'Everything to the left of the conflict is DPLL and was understood in 1962. '
        + 'The three boxes on the right are what changed in the 1990s: analyse the implication '
        + 'graph, derive a clause the search should never have violated, and jump back to the '
        + 'level where that clause becomes useful. Each conflict permanently removes a region '
        + 'of the search space, which is why a modern solver gets faster on a hard instance '
        + 'rather than slower.',
      definition: [
        'flowchart LR',
        'D["decide a variable<br/>VSIDS picks the one in recent conflicts"] --> P["propagate<br/>two watched literals per clause"]',
        'P -->|"no conflict, nothing left"| S["satisfiable — emit the model"]',
        'P -->|"no conflict, variables left"| D',
        'P -->|"conflict"| A["analyse the implication graph<br/>cut at the first unique implication point"]',
        'A --> L["learn the clause<br/>and log it to the proof"]',
        'L --> B["backjump to the level<br/>the clause becomes unit at"]',
        'B --> P',
        'A -->|"conflict at level 0"| U["unsatisfiable — emit the proof"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Everything is CNF: a conjunction of clauses, each a disjunction of literals.** The '
        + 'formula is satisfied when every clause has at least one true literal. That single '
        + 'shape is why the algorithm is short — a clause with one unassigned literal and all '
        + 'others false FORCES that literal, and that rule does most of the work.',
      '**Unit propagation is the engine, and two-watched literals are why it is cheap.** A '
        + 'clause can only become unit when one of two watched literals is falsified, so an '
        + 'assignment only visits the clauses that might have changed state rather than every '
        + 'clause containing the variable. The demo counts clause visits, because that count '
        + 'is what the technique exists to keep down.',
      '**A conflict is a clause with every literal false, and it is an opportunity.** The '
        + 'assignments that forced it form an implication graph: decisions at the roots, '
        + 'propagated literals with an edge from each literal of the clause that forced them. '
        + 'The demo draws that graph for the conflict you choose.',
      '**Conflict analysis cuts the graph and reads a new clause off the cut.** Take the '
        + 'literals on the far side of the cut, negate them, and you have a clause that is '
        + 'implied by the formula and that this assignment violates — so the search will never '
        + 'make this combination of decisions again. That clause is the whole difference '
        + 'between backtracking and learning.',
      '**The first unique implication point is the cut everyone uses.** Walk back from the '
        + 'conflict until exactly one literal from the current decision level remains: that '
        + 'literal is the point every path from the decision passes through. Cutting there '
        + 'gives a short clause with exactly one literal at the conflict level, which is what '
        + 'makes the backjump well defined.'
    ];
  }

  function moreOrientation() {
    return [
      '**Backjumping is non-chronological: throw away every level the learned clause does not '
        + 'mention.** A solver that undid one decision at a time would re-derive the same '
        + 'conflict from a different direction. Jumping to the second-highest level in the '
        + 'learned clause lands exactly where that clause becomes unit and forces something '
        + 'new.',
      '**VSIDS makes the solver follow the conflicts.** Every variable in a conflict has its '
        + 'activity bumped and the bump grows over time, so recent conflicts dominate. The '
        + 'effect is that the search concentrates on the part of the formula that is actually '
        + 'hard — and it is why the same solver is fast on an industrial instance with a '
        + 'million variables and hopeless on a crafted one with thirty.',
      '**Restarts throw away the search tree and keep everything learned.** With phase saving '
        + 'the solver goes straight back to the region it was exploring, so a restart costs the '
        + 'decisions and not the work, and it escapes a bad early decision that would otherwise '
        + 'dominate the whole run.',
      '**A SAT answer means nothing without its model, and an UNSAT answer means nothing '
        + 'without a proof.** "I searched and found nothing" is exactly what a solver with a '
        + 'bug in its conflict analysis reports. Every unsatisfiable answer here emits a DRAT '
        + 'proof — each learned clause in order — and a checker with no search in it replays '
        + 'the derivation of the empty clause.',
      '**Clause learning is not universally a win, and the demo measures where it is not.** On '
        + 'the pigeonhole family there is no short resolution proof, so both solvers are '
        + 'exponential and the learning one does far more work per decision; on a planted '
        + 'satisfiable instance the simpler search finds an assignment with fewer nodes. It '
        + 'wins, hugely, on structured and threshold instances — which happen to be what real '
        + 'problems encode to.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation().concat(moreOrientation()),
      demo: { title: 'Interactive demo — a conflict, its graph, and the clause it produces',
        markup: root.SatTemplate.render() },
      diagram: diagram(),
      insight: '**Clause learning is the single most important algorithmic idea in this '
        + 'milestone, and knowing its failure mode is what makes it usable.** The practical '
        + 'shape is this: encode your problem, hand it to a solver, and if it answers in '
        + 'seconds you are done for good — the answer comes with a model you can check or a '
        + 'proof you can replay, and neither requires you to trust the solver. If it does not '
        + 'answer, the question is almost never "get a faster solver": it is whether your '
        + 'encoding has a short resolution proof at all. The pigeonhole family in the demo is '
        + 'the standing counter-example, and its shape recurs constantly in practice — any '
        + 'encoding whose unsatisfiability comes from a counting argument ("these n + 1 things '
        + 'cannot fit in these n slots") is one, and every CDCL solver in the world is '
        + 'exponential on it. The fix is to change the encoding so the counting is explicit: '
        + 'cardinality constraints with a totaliser or sequential encoding, or a solver with '
        + 'native support for them, or a different tool entirely. The second practical point '
        + 'is about trust. A SAT solver is a hundred thousand lines of highly optimised C++ '
        + 'with a history of bugs, and it is used in places where a wrong answer is a '
        + 'miscompilation or a false verification. That is survivable only because both '
        + 'answers are independently checkable, and the checkers are small enough to be '
        + 'verified themselves — which is why every serious competition requires a proof and '
        + 'why you should ask for one from any tool that embeds a solver.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.SatTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ instances */

  function clampSize(family, size) {
    const spec = root.SatTemplate.FAMILIES[family];

    return Math.min(spec.max, Math.max(spec.min, size));
  }

  function instanceOf(family, size) {
    const generators = root.InstanceGenerators;

    if (family === 'pigeonhole') return generators.pigeonhole(size).formula;
    if (family === 'planted') {
      return generators.plantedKSat({ variables: size, seed: 11 }).formula;
    }
    if (family === 'horn') return generators.hornInstance({ variables: size, seed: 3 }).formula;
    return generators.randomKSat({ variables: size, k: 3, seed: 7,
      clauses: Math.round(size * 4.26) });
  }

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const size = clampSize(parts[0], parts[1]);
    const formula = instanceOf(parts[0], size);
    const solved = root.Berugo.Sat.solve(formula, {});

    return { family: parts[0], size: size, formula: formula, solved: solved,
      dpll: root.SatBasics.dpll(formula, {}),
      evidence: evidenceFor(formula, solved),
      snapshot: root.Berugo.Sat.firstConflict(formula, { at: parts[2] }) };
  });

  function evidenceFor(formula, solved) {
    if (solved.verdict === 'sat') {
      const out = root.Berugo.SatCheck.checkModel(formula, solved.model);

      return { kind: 'model', ok: out.ok, count: out.checked || 0,
        why: out.ok ? 'every clause has a satisfied literal under the model' : out.why };
    }
    if (solved.verdict !== 'unsat') return { kind: 'none', ok: false, count: 0, why: solved.verdict };
    const proof = root.Berugo.SatCheck.checkProof(formula, solved.proof);

    return { kind: 'proof', ok: proof.ok, count: proof.checked || 0, why: proof.why };
  }

  /** All four families at one representative size, for the comparison table. */
  const familiesFor = root.Helpers.memoise(function () {
    return Object.keys(SHOWCASE).map(function (family) {
      const formula = instanceOf(family, SHOWCASE[family]);
      const solved = root.Berugo.Sat.solve(formula, {});
      const dpll = root.SatBasics.dpll(formula, {});

      return { family: family, size: SHOWCASE[family], verdict: solved.verdict,
        decisions: solved.decisions, nodes: dpll.stats.nodes,
        conflicts: solved.conflicts, visits: solved.clauseVisits };
    });
  });

  /** Random 3-SAT at the threshold, both solvers, for the chart. */
  const scalingFor = root.Helpers.memoise(function () {
    return SCALE.map(function (n) {
      const formula = instanceOf('random', n);

      return { n: n, decisions: Math.max(1, root.Berugo.Sat.solve(formula, {}).decisions),
        nodes: root.SatBasics.dpll(formula, {}).stats.nodes };
    });
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(JSON.stringify([values['sat-family'], values['sat-size'],
      values['sat-conflict']]));

    paintFormula(study);
    paintMetrics(study);
    paintGraph(app, study);
    paintTrail(study);
    paintFamilies(study);
    paintParts();
    paintChart(app);
  }

  function paintFormula(study) {
    const clauses = study.formula.clauses;
    const shown = clauses.slice(0, 10).map(function (row) {
      return row.join(' ') + ' 0';
    }).join('\n');

    root.jQuery('#sat-formula').text('p cnf ' + study.formula.variables + ' ' +
      clauses.length + '\n' + shown + (clauses.length > 10
      ? '\n… ' + (clauses.length - 10) + ' more clauses' : ''));
    root.Helpers.setText('sat-formula-caption', 'This family is ' +
      root.SatTemplate.FAMILIES[study.family].about + '. At size ' + study.size + ' it has ' +
      study.formula.variables + ' variables and ' + clauses.length + ' clauses. The listing is '
      + 'DIMACS: one clause per line, a negative integer for a negated variable.');
  }

  function paintMetrics(study) {
    const solved = study.solved;

    root.MetricGrid.update({
      'sat-verdict': { value: solved.verdict.toUpperCase(),
        note: study.evidence.kind === 'proof' ? 'with a DRAT proof attached'
          : 'with a model attached' },
      'sat-decisions': { value: solved.decisions,
        note: solved.decisions ? 'every one of them a guess that could be wrong'
          : 'propagation alone decided this instance' },
      'sat-conflicts': { value: solved.conflicts + ' · ' + solved.learned,
        note: solved.restarts + ' restarts along the way' },
      'sat-props': { value: solved.propagations, note: 'forced by clauses that became unit' },
      'sat-visits': { value: solved.clauseVisits,
        note: 'clauses actually looked at, learned ones included' },
      'sat-evidence': { value: study.evidence.ok ? study.evidence.count : 'FAILED',
        note: study.evidence.kind === 'proof' ? 'proof steps replayed by the checker'
          : 'clauses re-checked against the model' }
    });
  }

  /* ------------------------------------------------- the implication graph */

  function paintGraph(app, study) {
    const host = root.jQuery('#sat-graph')[0];

    if (!host) return;
    if (!study.snapshot.found) {
      root.jQuery(host).empty();
      root.Helpers.setText('sat-graph-note', 'No such conflict on this instance: ' +
        study.snapshot.why + '. Horn formulas reach no conflict at all, which is the point of '
        + 'the family.');
      return;
    }
    app.mermaid.render(host, root.ImplicationGraph.definition(study.snapshot));
    root.Helpers.setText('sat-graph-note', graphNote(study.snapshot));
  }

  function graphNote(snapshot) {
    return 'Conflict ' + snapshot.at + ', at decision level ' + snapshot.level + '. Every arrow '
      + 'is "this assignment helped force that one"; the rounded nodes are the literals the cut '
      + 'keeps, and negating them gives the learned clause ' + root.ImplicationGraph.showClause(snapshot.learned) +
      '. That clause is implied by the formula, so adding it loses nothing — and the current '
      + 'assignment violates it, so the search can never repeat this combination. The solver '
      + 'then jumps back to level ' + snapshot.backjump + ', discarding ' +
      (snapshot.level - snapshot.backjump) + ' level' +
      (snapshot.level - snapshot.backjump === 1 ? '' : 's') + ' at once rather than undoing one '
      + 'decision at a time.';
  }

  function paintTrail(study) {
    const snapshot = study.snapshot;
    const rows = snapshot.found ? snapshot.trail : [];

    root.jQuery('#sat-trail tbody').html(rows.slice(0, 18).map(function (row) {
      return '<tr><td class="mono">x' + Math.abs(row.literal) + ' = ' +
        (row.literal > 0 ? 'true' : 'false') + '</td><td class="mono">' + row.level +
        '</td><td class="mono">' + (row.decision ? 'decision' : 'propagated') +
        '</td><td class="mono">' + (row.reason ? root.ImplicationGraph.showClause(row.reason) : '—') +
        '</td></tr>';
    }).join('') || '<tr><td colspan="4">this instance reaches no such conflict</td></tr>');

    root.Helpers.setText('sat-trail-caption', snapshot.found
      ? 'The trail is the assignment in the order it was made, and it is the implication graph '
        + 'in list form: a decision has no reason, and every propagated literal names the clause '
        + 'that forced it. The conflict is the clause ' + root.ImplicationGraph.showClause(snapshot.conflict) +
        ', every literal of which is false here.'
      : 'No conflict was reached. On a Horn formula that is structural rather than lucky: unit '
        + 'propagation alone decides the fragment, which is why the decision count is 0.');
  }

  const SHOWS = {
    pigeonhole: 'no short resolution proof exists, so BOTH are exponential',
    random: 'the threshold, where learning wins by an order of magnitude',
    planted: 'a solution to find rather than an absence to prove — the simpler search wins',
    horn: 'a polynomial fragment: propagation decides it with no search'
  };

  function paintFamilies(study) {
    root.jQuery('#sat-families tbody').html(familiesFor('all').map(function (row) {
      return '<tr' + (row.family === study.family ? ' class="row-current"' : '') +
        '><td class="mono">' + row.family + ' (' + row.size + ')</td><td class="mono">' +
        row.verdict + '</td><td class="mono">' + row.decisions + '</td><td class="mono">' +
        row.nodes + '</td><td class="mono">' +
        (row.decisions ? (row.nodes / Math.max(1, row.decisions)).toFixed(1) + '×' : 'no search') +
        '</td><td>' + SHOWS[row.family] + '</td></tr>';
    }).join(''));

    root.Helpers.setText('sat-families-caption', familiesCaption());
  }

  function familiesCaption() {
    const rows = familiesFor('all');
    const byName = {};

    rows.forEach(function (row) { byName[row.family] = row; });
    return 'Both columns count the same thing — the number of branches the search had to guess '
      + '— so the ratio is like for like. Learning wins by ' +
      (byName.random.nodes / byName.random.decisions).toFixed(0) + '× at the threshold and '
      + 'LOSES on the planted instance, where DPLL finds a satisfying assignment in ' +
      byName.planted.nodes + ' nodes against ' + byName.planted.decisions + ' decisions. The '
      + 'pigeonhole row is the one to remember: ' + byName.pigeonhole.decisions + ' decisions '
      + 'against ' + byName.pigeonhole.nodes + ' nodes is a constant-factor win on a problem '
      + 'where both are exponential, and the learning solver paid ' +
      byName.pigeonhole.visits + ' clause visits for it.';
  }

  const PARTS = [
    { name: 'unit propagation', does: 'forces every literal a clause leaves no choice about',
      cost: 'most of the run time, which is why the watch scheme exists',
      without: 'nothing at all works; this is the algorithm' },
    { name: 'two watched literals',
      does: 'only visits a clause when one of two literals is falsified',
      cost: 'the clause list is not kept in any useful order for anything else',
      without: 'propagation is proportional to every clause holding the variable' },
    { name: 'clause learning (1UIP)',
      does: 'derives a clause from the conflict that the search may never violate again',
      cost: 'a growing database, and more clauses to visit per assignment',
      without: 'the same conflict is rediscovered from every direction' },
    { name: 'non-chronological backjumping',
      does: 'discards every level the learned clause does not mention',
      cost: 'nothing; it falls out of the learned clause',
      without: 'undoing one decision at a time re-derives the conflict immediately' },
    { name: 'VSIDS and phase saving',
      does: 'decides on the variables in recent conflicts, in the polarity they last had',
      cost: 'an activity score per variable and a decay per conflict',
      without: 'the search wanders away from the hard part of the formula' }
  ];

  function paintParts() {
    root.jQuery('#sat-parts tbody').html(PARTS.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.does + '</td><td>' +
        root.Helpers.escapeHtml(row.cost) + '</td><td>' +
        root.Helpers.escapeHtml(row.without) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('sat-parts-caption',
      'The first two are DPLL with an engineering trick and were understood decades before the '
      + 'others. The third is the one that changed what a solver could do, and the last two are '
      + 'what make it work in practice — a solver with learning and a random decision order is '
      + 'not competitive.');
  }

  function paintChart(app) {
    const host = root.jQuery('#sat-chart')[0];
    const rows = scalingFor('scale');

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib, height: 250, logY: true,
      xLabel: 'variables (clauses at 4.26 per variable)', yLabel: 'search tree size (log)',
      series: [
        { label: 'CDCL decisions — with clause learning',
          points: rows.map(function (row) { return { x: row.n, y: row.decisions }; }) },
        { label: 'DPLL nodes — the same search without learning',
          points: rows.map(function (row) { return { x: row.n, y: row.nodes }; }) }
      ],
      legendHost: root.jQuery('#sat-legend')[0],
      summary: function () {
        return 'Search tree size against instance size, for CDCL and for plain DPLL, on a '
          + 'log scale.';
      }
    });
    root.Helpers.setText('sat-chart-note', chartNote(rows));
  }

  function chartNote(rows) {
    const last = rows[rows.length - 1];

    return 'Random 3-SAT at the satisfiability threshold, one seed, ' + rows[0].n + ' to ' +
      last.n + ' variables. Both curves are exponential — this is the hardest ratio there is — '
      + 'and the gap between them is what clause learning buys: at ' + last.n + ' variables the '
      + 'learning solver guesses ' + last.decisions + ' times where the plain search visits ' +
      last.nodes + ' nodes, a factor of ' + (last.nodes / last.decisions).toFixed(0) + '. The '
      + 'curve is not smooth and should not be: each point is one instance, and at this ratio '
      + 'neighbouring instances differ in difficulty by more than the trend does.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
