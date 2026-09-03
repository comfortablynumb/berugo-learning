/**
 * Section: 2-SAT and implication graphs.
 *
 * The section exists to make one boundary concrete. Two-literal clauses become
 * implications, implications become a graph, and strongly connected components
 * answer the question in linear time. Three-literal clauses cannot become
 * implications at all - `not a` implies `b or c`, and a disjunction is not a
 * vertex - so the last panel measures what happens when you try anyway: drop a
 * literal, solve the result, and count how often the answer is wrong. At
 * twenty clauses over ten variables it is wrong on 46 of 100 instances, always
 * in the same direction.
 *
 * The scheduling instance is tuned so the default is satisfiable and one more
 * conflict makes it not, because the interesting thing about 2-SAT is not that
 * it can be solved but that the solver hands back a *reason*.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'two-sat';
  const RELAX_STEPS = [10, 15, 20, 25, 30, 40];
  let panel = null;
  let view = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (view) view(); });
  }

  function diagram() {
    return {
      title: 'Diagram — one clause, two implications',
      caption: 'The clause (a OR b) says that if a is false then b must be true, and equally that if ' +
        'b is false then a must be true. Both arcs go in, always. Adding only the first leaves a ' +
        'graph whose components no longer correspond to the formula, and the solver then reports ' +
        'satisfiable on formulas that are not.',
      definition: [
        'flowchart LR',
        '    NA["¬a"] -->|"clause (a ∨ b)"| B["b"]',
        '    NB["¬b"] -->|"the contrapositive of<br/>the same clause"| A["a"]',
        '    A --> S["if a and ¬a land in one component,<br/>the formula is unsatisfiable"]',
        '    B --> S'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A clause of two literals `(a OR b)` is an implication in both directions.** If `a` is false ' +
        'then `b` must hold, and if `b` is false then `a` must hold.',
      'Put a vertex in for every literal — `x` and `not x` are two different vertices — and an arc ' +
        'for each implication. The whole formula becomes a directed graph.',
      'Both arcs go in, always. The contrapositive is not optional, and a solver that adds only one ' +
        'reports satisfiable on formulas that are not.',
      '**The answer is a strongly connected component question.** If `x` and `not x` are in the same ' +
        'component then each implies the other, so `x` implies `not x` implies `x`, and the formula ' +
        'is unsatisfiable.',
      'If they are in different components for every variable, a satisfying assignment can be read ' +
        'off directly. Set `x` true exactly when its component comes *later* in the reverse ' +
        'topological order that Tarjan already produces.',
      'No search, no backtracking, one linear pass.',
      '**The modelling idioms are the useful part.** "At most one of these" is a pairwise clause per ' +
        'pair, which is quadratic in the group and why big groups need a different encoding.',
      '"Force this literal" is the clause `(l OR l)`. "If a then b" is `(not a OR b)`. Two-slot ' +
        'scheduling, interval selection with two placements each, and 2-colouring are all this ' +
        'shape, and the instance panel below builds several of them.',
      '**Then the wall.** A three-literal clause has no faithful implication encoding, because the ' +
        'consequent would have to be a disjunction rather than a literal.',
      'The only thing the machinery can do with one is throw a literal away, which makes the ' +
        'constraint strictly stronger. So "satisfiable" stays trustworthy and "unsatisfiable" stops ' +
        'being.',
      'The last panel measures exactly how often that lies, and the answer is: constantly.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the implication graph, the read-out, and the three-literal wall',
        markup: root.TwoSatTemplate.render()
      },
      diagram: diagram(),
      insight: '2-SAT is polynomial and 3-SAT is NP-complete, and this is the cleanest place in the ' +
        'whole curriculum to see *where* the difficulty enters. It is not the clause count or the ' +
        'variable count. It is that two literals make an implication and three do not. When you meet ' +
        'a constraint problem in practice, the question worth asking first is whether every ' +
        'constraint is binary. If it is, there is a linear-time exact answer with a certificate. If ' +
        'it is not, you are in solver territory and should reach for one rather than writing a ' +
        'search.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TwoSatTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const instanceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.SatLab.build({ model: parts[0], variables: Number(parts[1]),
      clauses: Number(parts[2]), seed: Number(parts[3]) });
  });

  const stateFor = root.Helpers.memoise(function (key) {
    return root.SatLab.solveRun(instanceFor(key));
  });

  const thresholdFor = root.Helpers.memoise(function () {
    return root.SatLab.thresholdSweep({ variables: 40, trials: 60 });
  });

  const relaxFor = root.Helpers.memoise(function () {
    return RELAX_STEPS.map(function (clauses) {
      return { clauses: clauses,
        run: root.SatLab.relaxationRun({ variables: 10, trials: 100, clauses: clauses }) };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const key = values['tsat-model'] + '|' + values['tsat-vars'] + '|' + values['tsat-clauses'] +
      '|' + values['tsat-seed'];
    const instance = instanceFor(key);
    const state = stateFor(key);

    paintMetrics(state);
    paintMap(instance, state);
    paintClauses(instance);
    paintAssign(instance, state);
    paintThreshold(thresholdFor('fixed'), app);
    paintRelax(relaxFor('fixed'), Number(values['tsat-relax']));
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'tsat-answer': { value: state.run.satisfiable ? 'yes' : 'no',
        note: state.run.satisfiable
          ? root.Format.exact(state.run.report.forcedTrue) + ' variables true, ' +
            root.Format.exact(state.run.report.forcedFalse) + ' false'
          : root.Format.plural(state.run.contradictions.length, 'variable') +
            ' share a component with their own negation' },
      'tsat-components': { value: root.Format.exact(state.run.report.components),
        note: root.Format.exact(state.run.report.implications) + ' implications from ' +
          root.Format.plural(state.run.report.clauses, 'clause') },
      'tsat-oracle': { value: state.agrees === null ? 'not run' : (state.agrees ? 'yes' : 'NO'),
        note: state.agrees === null ? 'above the exhaustive-search limit'
          : 'all ' + root.Format.exact(Math.pow(2, state.run.report.variables)) +
            ' assignments checked' },
      'tsat-violated': { value: root.Format.exact(state.violated.length),
        note: state.run.satisfiable
          ? (state.violated.length === 0 ? 'the assignment satisfies every clause'
            : 'the answer says satisfiable and the assignment is not')
          : 'no assignment was produced, so there is nothing to break' }
    });
  }

  function paintMap(instance, state) {
    view = function () { drawMap(instance, state); };
    view();
  }

  function drawMap(instance, state) {
    const host = root.jQuery('#tsat-map')[0];

    if (!host) return;
    const width = host.clientWidth || 620;
    const height = 340;
    const groups = groupsOf(state.run.component, 2 * instance.variables);
    const bad = new Set(badLiterals(instance, state));

    root.GraphView.draw({ host: host, graph: state.run.graph,
      positions: root.GraphView.groupedLayout(groups, 2 * instance.variables, width, height),
      width: width, height: height,
      labels: literalLabels(instance),
      nodeClass: function (v) { return bad.has(v) ? 'cut' : 'settled'; } });
    root.jQuery('#tsat-map-note').text('One vertex per literal, so ' +
      root.Format.exact(instance.variables) + ' variables make ' +
      root.Format.exact(2 * instance.variables) + ' vertices, grouped here by strongly connected ' +
      'component. ' + (state.run.satisfiable
      ? 'No variable shares a component with its own negation, so a satisfying assignment exists and ' +
        'is read straight off the component order.'
      : 'The highlighted vertices are the ' +
        root.Format.plural(state.run.contradictions.length, 'variable') +
        ' whose two literals landed in the same component. Each of those is a proof: x implies not x ' +
        'implies x, and no assignment survives it.'));
  }

  function groupsOf(component, count) {
    const groups = [];

    for (let v = 0; v < count; v += 1) {
      const id = component[v];

      while (groups.length <= id) groups.push([]);
      groups[id].push(v);
    }
    return groups.filter(function (members) { return members.length > 0; });
  }

  function badLiterals(instance, state) {
    const out = [];

    state.run.contradictions.forEach(function (v) { out.push(2 * v, 2 * v + 1); });
    return out;
  }

  function literalLabels(instance) {
    const out = [];

    for (let v = 0; v < instance.variables; v += 1) {
      out.push('x' + v, '¬x' + v);
    }
    return out;
  }

  function paintClauses(instance) {
    const rows = root.SatLab.implicationRows(instance).slice(0, 14).map(function (entry) {
      return { cells: ['#' + entry.id, entry.clause, entry.first, entry.second] };
    });

    root.MatrixView.render(root.jQuery('#tsat-implications')[0], {
      columns: ['Clause', 'As written', 'First implication', 'The contrapositive'], rows: rows
    });
    root.jQuery('#tsat-implications-note').text((rows.length === instance.clauses.length
      ? 'All ' + root.Format.plural(rows.length, 'clause')
      : 'The first ' + root.Format.exact(rows.length) + ' of ' +
        root.Format.plural(instance.clauses.length, 'clause')) +
      ', each expanded into the two arcs it ' +
      'contributes. Notice that the two columns are the same fact written twice — that is what makes ' +
      'the implication graph *skew-symmetric*, and it is the property the whole method rests on: the ' +
      'graph with every arc reversed and every literal negated is the same graph, so a path from x ' +
      'to not-x guarantees a path from x back again through the mirror.');
  }

  function paintAssign(instance, state) {
    const rows = root.SatLab.assignmentTable(instance, state).map(function (entry) {
      return { cells: [entry.name,
        root.Format.exact(entry.positiveComponent), root.Format.exact(entry.negativeComponent),
        entry.contradictory ? 'SAME — contradiction'
          : (entry.positiveComponent < entry.negativeComponent ? 'positive is later' : 'negative is later'),
        entry.value === null ? '—' : (entry.value ? 'true' : 'false')] };
    });

    root.MatrixView.render(root.jQuery('#tsat-assign')[0], {
      columns: ['Variable', 'Component of x', 'Component of ¬x', 'Which comes later', 'Value'],
      rows: rows
    });
    root.jQuery('#tsat-assign-note').text(state.run.satisfiable
      ? 'Tarjan numbers components in reverse topological order, so a lower index is later in the ' +
        'order. Setting x true exactly when its component index is below that of not-x therefore ' +
        'never points an implication from true to false, and the result satisfies every clause — ' +
        'checked separately above, which is the difference between "the graph says yes" and "here ' +
        'is the answer". No search and no backtracking happens anywhere in this.'
      : 'Nothing to read out: the "which comes later" column names the variables whose two literals ' +
        'are in one component, and each of those is an unconditional contradiction. This is what a ' +
        '2-SAT solver hands back that a general SAT solver mostly cannot — not "no", but which ' +
        'variable made it no.');
  }

  function paintThreshold(rows, app) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.fixed(row.ratio, 1) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.clauses) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.satisfiable) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.trials) + '</td>' +
        '<td class="mono">' + root.Format.fixed(100 * row.rate, 1) + '%</td></tr>';
    }).join('');

    root.jQuery('#tsat-threshold tbody').html(html);
    drawThresholdChart(rows, app);
    root.jQuery('#tsat-threshold-note').text('Forty variables, sixty random instances per row. The ' +
      'satisfiable rate falls from ' + root.Format.fixed(100 * rows[0].rate, 1) + '% at ' +
      root.Format.fixed(rows[0].ratio, 1) + ' clauses per variable to ' +
      root.Format.fixed(100 * rows[rows.length - 1].rate, 1) + '% at ' +
      root.Format.fixed(rows[rows.length - 1].ratio, 1) + '. The threshold for random 2-SAT is ' +
      'known exactly — it is at a ratio of 1, and the transition sharpens into a step as the ' +
      'variable count grows. The practical lesson is about benchmarks: "we tested the solver on ' +
      'random instances" is a statement about which side of this ratio the generator sat on, and ' +
      'instances well away from the threshold are easy for reasons that have nothing to do with the ' +
      'solver.');
  }

  function drawThresholdChart(rows, app) {
    const host = root.jQuery('#tsat-chart')[0];

    if (!host) return;
    root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib,
      height: 220,
      series: [{ label: 'satisfiable rate', points: rows.map(function (row) {
        return { x: row.ratio, y: 100 * row.rate }; }) }],
      xLabel: 'clauses per variable',
      yLabel: 'satisfiable (%)',
      legendHost: root.jQuery('#tsat-legend')[0],
      summary: function () {
        return 'The fraction of random 2-SAT instances that are satisfiable, against clause density.';
      }
    });
  }

  function paintRelax(rows, selected) {
    const html = rows.map(function (entry) {
      const run = entry.run;
      const mark = entry.clauses === selected ? ' ←' : '';

      return '<tr><td class="mono">' + root.Format.exact(entry.clauses) + mark + '</td>' +
        '<td class="mono">' + root.Format.exact(run.trials) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.bothSat) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.bothUnsat) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.wrongUnsat) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.falseSat) + '</td></tr>';
    }).join('');
    const chosen = rows.filter(function (entry) { return entry.clauses === selected; })[0] || rows[0];

    root.jQuery('#tsat-wall tbody').html(html);
    root.jQuery('#tsat-wall-note').text('Ten variables, a hundred random three-literal formulas per ' +
      'row, and the only thing an implication graph can do with a three-literal clause: drop a ' +
      'literal. That makes the constraint strictly stronger, so the last column is 0 in every row ' +
      'and always will be — the relaxation never says yes when the truth is no. The fifth column is ' +
      'the damage: at ' + root.Format.exact(chosen.clauses) + ' clauses it says "unsatisfiable" on ' +
      root.Format.exact(chosen.run.wrongUnsat) + ' of ' + root.Format.exact(chosen.run.trials) +
      ' formulas that are perfectly satisfiable. There is no encoding trick that fixes this; if ' +
      'there were, P would equal NP. That is the whole boundary, and it is one literal wide.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
