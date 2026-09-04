/**
 * Section: heuristics and metaheuristics.
 *
 * The demo is a tournament and the whole section is the two columns nobody
 * publishes: evaluations OFFERED and evaluations USED. Eight methods get the
 * same budget on the same instance from the same seed, and the harness reports
 * whether they really did — because an unequal budget is the one defect that
 * makes a metaheuristic comparison meaningless and it is invisible in the
 * results table where it happens.
 *
 * The result that surprises people is that plain 2-opt reaches the best tour
 * in the table using a small fraction of the budget and then stops, because it
 * has no escape mechanism and does not need one on this instance. Everything
 * more sophisticated spends the whole budget to reach the same place or worse.
 * That is not an argument against metaheuristics; it is an argument for
 * including the trivial baseline, which is the control most comparisons omit.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'metaheuristics';
  let panel = null;
  let chart = null;

  const ESCAPES = {
    'nearest-neighbour': 'nothing — it is a construction, not a search',
    'two-opt': 'nothing; it stops at the first tour with no improving reversal',
    'or-opt': 'nothing; a different neighbourhood, the same dead end',
    annealing: 'accepts a worsening move with probability e^(−Δ/T), and cools',
    tabu: 'takes the best move even when it is worse, and forbids reversing it',
    genetic: 'recombination — a child can land in a basin neither parent was in',
    'ant-colony': 'the memory is in the edges, so a new tour is built rather than edited',
    grasp: 'restarts from a fresh randomised construction and improves that'
  };

  const LABELS = {
    'nearest-neighbour': 'nearest neighbour', 'two-opt': '2-opt', 'or-opt': 'or-opt',
    annealing: 'simulated annealing', tabu: 'tabu search', genetic: 'genetic algorithm',
    'ant-colony': 'ant colony', grasp: 'GRASP'
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a search landscape, and what each method does when it stops improving',
      caption: 'The x-axis is the space of tours and the y-axis is tour length; a move connects ' +
        'neighbouring points. Hill climbing walks downhill and stops in the first basin it ' +
        'reaches — which may be excellent or terrible, and it has no way to tell. Every ' +
        'metaheuristic in this section is one answer to "what now": annealing goes uphill with ' +
        'decreasing probability, tabu goes uphill deliberately and forbids coming straight back, ' +
        'a genetic algorithm crosses two solutions in the hope of landing in a third basin, ant ' +
        'colony rebuilds from edge statistics instead of editing, and GRASP simply starts again ' +
        'somewhere else. The plateau matters as much as the basin: a region where every ' +
        'neighbour is equal gives a hill climber no gradient at all, and tabu memory is the only ' +
        'mechanism here that crosses one systematically.',
      definition: [
        'flowchart TD',
        '    S["current solution"] --> Q{"any improving move?"}',
        '    Q -- yes --> T["take it"] --> Q',
        '    Q -- no --> L["local optimum or plateau"]',
        '    L --> A["2-opt / or-opt:<br/>stop"]',
        '    L --> B["annealing:<br/>go uphill with probability e^(−Δ/T)"]',
        '    L --> C["tabu:<br/>take the least bad move,<br/>forbid its reverse for t iterations"]',
        '    L --> D["genetic:<br/>recombine two solutions"]',
        '    L --> E["ant colony:<br/>rebuild from pheromone on edges"]',
        '    L --> F["GRASP:<br/>restart from a new randomised construction"]',
        '    B --> Q',
        '    C --> Q',
        '    D --> Q',
        '    E --> Q',
        '    F --> Q'
      ].join('\n')
    };
  }

  function orientationBudget() {
    return [
      '**A heuristic is a method with no guarantee, and that is a precise statement rather than ' +
        'an apology.** An approximation algorithm comes with a proved ratio. A heuristic comes ' +
        'with measurements.',
      'The consequence is that a heuristic can only be evaluated empirically, which makes the ' +
        'experimental design the whole of its credibility.',
      'The experimental design is what this section is about.',
      '**The only honest comparison fixes the evaluation budget.** Every method here gets the same ' +
        'number of objective evaluations on the same instance from the same seed, and the harness ' +
        'reports whether it really did.',
      'Comparing by "best result found" compares how long each author was willing to wait. That is ' +
        'how most published metaheuristic comparisons are done, and why most of them mean nothing.',
      '**Constructive heuristics build one answer and local search improves one.** Nearest ' +
        'neighbour is a single pass and lands 22.27% above the best tour anything in the demo ' +
        'finds.',
      '2-opt reverses a segment when doing so shortens the tour, and or-opt lifts a run of one to ' +
        'three cities and reinserts it elsewhere.',
      'Each candidate move costs one delta of four table lookups. Charging a full tour costing ' +
        'instead would make local search look n times more expensive than it is, which is the ' +
        'commonest way a budgeted comparison is rigged without anybody intending it.'
    ];
  }

  function orientationMethods() {
    return [
      '**Every metaheuristic in the list is one answer to "what do I do at a local optimum".** ' +
        'That is the only axis on which they differ.',
      'Annealing accepts a worsening move with probability e^(−Δ/T) and cools. Tabu takes the best ' +
        'available move even when it is worse, and forbids reversing it.',
      'A genetic algorithm recombines, ant colony keeps statistics on edges rather than on ' +
        'solutions, and GRASP restarts. Reading them that way makes the zoo a list of four ideas ' +
        'rather than forty.',
      '**A cooling schedule has to be derived from the budget, and this is where annealing is ' +
        'usually got wrong.** A rate tuned for a million evaluations is a random walk when it is ' +
        'given a thousand.',
      'The temperature never falls far enough to settle, and the method returns its starting tour. ' +
        'That was measured here before the schedule was made budget-aware, and annealing came back ' +
        'with exactly the nearest-neighbour tour it started from.',
      'At temperature zero the acceptance test becomes Δ < 0 and annealing IS hill climbing, which ' +
        'the demo offers as a setting rather than as a footnote.',
      '**Order crossover exists because the obvious crossover produces invalid tours.** Cutting two ' +
        'permutations at a point and swapping halves gives a child that visits some cities twice ' +
        'and others never.',
      'Order crossover copies a slice from one parent and fills the rest in the other parent’s ' +
        'order, skipping what is already present.',
      'Encoding and repair are where a genetic algorithm’s real cost lives, and they are the part ' +
        'the metaphor does not mention.',
      '**GRASP is the control the whole tournament needs.** It is "restart a randomised greedy ' +
        'construction and run local search on it", with no memory and no population.',
      'Any method that cannot beat it is not paying for its own sophistication, and on the demo’s ' +
        'instances several do not.',
      '**Best-so-far against evaluations is the plot, not the final number.** It answers the ' +
        'question a production system actually asks: how good is the answer if I stop now.',
      'It is also the plot that shows local search reaching its ceiling early while the population ' +
        'methods are still climbing. A table of final tour lengths hides both facts.'
    ];
  }

  function orientation() {
    return orientationBudget().concat(orientationMethods());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the tournament, the budget sweep, and the cooling schedule',
        markup: root.MetaheuristicsTemplate.render()
      },
      diagram: diagram(),
      insight: '**Put the trivial baseline in the comparison and give everything the same ' +
        'budget, and most of the metaheuristic literature stops being persuasive.** On these ' +
        'instances 2-opt from a nearest-neighbour start reaches the best tour in the table using ' +
        'a few per cent of the budget, and then stops. The sophisticated methods spend the ' +
        'whole budget arriving at the same place. That is not an argument against annealing or ' +
        'tabu search. On rugged landscapes with many deep basins they win, and the budget sweep ' +
        'shows the ranking changing. It is an argument for the control. Before adopting a method ' +
        'with six tuning parameters, run "greedy plus local search, restarted" under the same ' +
        'budget on your own instances. That is the number the six parameters have to beat, and it ' +
        'is an afternoon’s work to produce.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MetaheuristicsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const tournamentFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.HeuristicLab.tournament({ cities: Number(parts[0]), budget: Number(parts[1]),
      seed: Number(parts[2]) });
  });

  const budgetsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.HeuristicLab.budgetSweep({ cities: Number(parts[0]), seed: Number(parts[1]) });
  });

  const coolingFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.HeuristicLab.coolingSweep({ cities: Number(parts[0]), seed: Number(parts[1]),
      budget: Number(parts[2]) });
  });

  const exactFor = root.Helpers.memoise(function () {
    return root.HeuristicLab.exactComparison({ seed: 7 });
  });

  function update(app) {
    const values = panel.values();
    const cities = values['mth-cities'];
    const budget = values['mth-budget'];
    const seed = values['mth-seed'];
    const run = tournamentFor(cities + '|' + budget + '|' + seed);

    paintMetrics(run);
    paintChart(app, run);
    paintTable(run);
    paintBudgets(budgetsFor(cities + '|' + seed));
    paintCooling(coolingFor(cities + '|' + seed + '|' + budget));
    paintExact(exactFor(''));
  }

  function winnerOf(run) {
    return run.runs.reduce(function (best, entry) {
      if (entry.cost < best.cost - 1e-9) return entry;
      if (entry.cost < best.cost + 1e-9 && entry.spent < best.spent) return entry;
      return best;
    }, run.runs[0]);
  }

  function paintMetrics(run) {
    const winner = winnerOf(run);

    root.MetricGrid.update({
      'mth-best': { value: root.Format.fixed(run.best, 2),
        note: LABELS[winner.name] + ' reached it, on ' +
          root.Format.exact(run.problem.n) + ' cities' },
      'mth-spent': { value: root.Format.exact(run.budget),
        note: run.fair ? 'every method was offered exactly this many — the harness checks it'
          : 'THE BUDGETS DIFFER — this comparison is void' },
      'mth-cheap': { value: root.Format.exact(winner.spent),
        note: root.Format.percent(winner.spent / run.budget, 1) + ' of the budget on offer' },
      'mth-bound': { value: root.Format.fixed(run.lowerBound, 2),
        note: 'the minimum spanning tree; Christofides gives ' +
          root.Format.fixed(run.christofides, 2) }
    });
  }

  function paintChart(app, run) {
    const host = root.jQuery('#mth-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 270, logX: true,
      yMin: Math.floor(run.lowerBound * 0.98),
      xLabel: 'evaluations spent (log scale)', yLabel: 'best tour so far',
      series: run.runs.map(function (entry) {
        return { label: LABELS[entry.name], points: entry.curve.map(function (point) {
          return { x: Math.max(1, point.spent), y: point.best };
        }) };
      })
    });

    const winner = winnerOf(run);
    root.Helpers.setText('mth-chart-note',
      'Each curve is one method’s best-so-far against the evaluations it had spent when it found ' +
      'it, so a curve that ends early is a method that converged and stopped rather than one ' +
      'that was cut off. ' + LABELS[winner.name] + ' reaches ' + root.Format.fixed(run.best, 2) +
      ' after ' + root.Format.exact(winner.spent) + ' evaluations of a budget of ' +
      root.Format.exact(run.budget) + '. This is the plot to look at rather than the final ' +
      'numbers: it answers "how good is the answer if I stop now", which is the question a ' +
      'production system asks, and it shows the local-search methods hitting their ceiling long ' +
      'before the population methods stop climbing.');
  }

  function paintTable(run) {
    root.jQuery('#mth-table tbody').html(run.runs.map(function (entry) {
      return '<tr><td>' + LABELS[entry.name] + '</td><td class="mono">' +
        root.Format.fixed(entry.cost, 2) + '</td><td class="mono">' +
        root.Format.percent(entry.cost / run.best - 1, 2) + '</td><td class="mono">' +
        root.Format.exact(entry.offered) + '</td><td class="mono">' +
        root.Format.exact(entry.spent) + (entry.converged ? ' (converged)' : '') +
        '</td><td class="mono">' + root.Format.duration(entry.millis) + '</td><td class="mono">' +
        (entry.valid ? 'yes' : 'NO — BUG') + '</td><td>' + ESCAPES[entry.name] + '</td></tr>';
    }).join(''));

    const converged = run.runs.filter(function (entry) { return entry.converged; });
    root.Helpers.setText('mth-table-note',
      'The fourth and fifth columns are the ones that make this a comparison rather than an ' +
      'anecdote. Every method was OFFERED ' + root.Format.exact(run.budget) + ' evaluations; ' +
      root.Format.exact(converged.length) + ' of them used fewer, because local search ' +
      'terminates when no improving move exists and cannot spend the rest. That is a real ' +
      'property and not a disadvantage — it is the difference between a method that finishes and ' +
      'one that has to be stopped. The wall-clock column disagrees with the evaluation column on ' +
      'purpose: an ant colony evaluation builds a whole tour and a 2-opt evaluation is four ' +
      'lookups, so equal budgets are not equal seconds, and a comparison that fixes seconds ' +
      'instead measures the implementations.');
  }

  function paintBudgets(sweep) {
    const order = ['nearest-neighbour', 'two-opt', 'annealing', 'tabu', 'genetic', 'ant-colony',
      'grasp'];

    root.jQuery('#mth-budgets tbody').html(sweep.rows.map(function (row) {
      const byName = new Map(row.costs.map(function (entry) { return [entry.name, entry]; }));
      const winner = row.costs.reduce(function (best, entry) {
        return entry.cost < best.cost ? entry : best;
      }, row.costs[0]);
      return '<tr><td class="mono">' + root.Format.exact(row.budget) + '</td><td>' +
        LABELS[winner.name] + '</td><td class="mono">' + root.Format.fixed(row.best, 2) +
        '</td>' + order.map(function (name) {
          const entry = byName.get(name);
          return '<td class="mono">' + (entry ? root.Format.fixed(entry.cost, 1) : '—') + '</td>';
        }).join('') + '</tr>';
    }).join(''));

    const first = sweep.rows[0];
    const last = sweep.rows[sweep.rows.length - 1];
    const firstWinner = first.costs.reduce(function (best, entry) {
      return entry.cost < best.cost ? entry : best;
    }, first.costs[0]);
    const lastWinner = last.costs.reduce(function (best, entry) {
      return entry.cost < best.cost ? entry : best;
    }, last.costs[0]);

    root.Helpers.setText('mth-budgets-note',
      'The same instance and the same seeds at four budgets. At ' +
      root.Format.exact(first.budget) + ' evaluations the winner is ' + LABELS[firstWinner.name] +
      ' at ' + root.Format.fixed(first.best, 2) + '; at ' + root.Format.exact(last.budget) +
      ' it is ' + LABELS[lastWinner.name] + ' at ' + root.Format.fixed(last.best, 2) + '. Read ' +
      'the columns downwards rather than across: the methods that converge do not move at all ' +
      'once they have converged, and the ones that keep sampling continue to improve. A paper ' +
      'quoting any single row of this table would be telling the truth and would not be ' +
      'informative, which is the whole reason the budget has to be a stated part of the claim.');
  }

  function paintCooling(sweep) {
    root.jQuery('#mth-cooling tbody').html(sweep.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.fixed(row.temperature, 2) +
        (row.hillClimbing ? ' (hill climbing)' : '') + '</td><td class="mono">' +
        root.Format.fixed(row.cost, 2) + '</td><td class="mono">' +
        root.Format.exact(row.accepted) + '</td><td class="mono">' +
        root.Format.exact(row.worseAccepted) + '</td></tr>';
    }).join(''));

    const zero = sweep.rows[0];
    const best = sweep.rows.reduce(function (winner, row) {
      return row.cost < winner.cost ? row : winner;
    }, sweep.rows[0]);
    root.Helpers.setText('mth-cooling-note',
      'The starting temperature as a multiple of the mean edge length, which is ' +
      root.Format.fixed(sweep.base, 2) + ' on this instance. At zero the acceptance test is ' +
      'Δ < 0 and annealing IS hill climbing: ' + root.Format.exact(zero.worseAccepted) +
      ' worsening moves accepted, and a tour of ' + root.Format.fixed(zero.cost, 2) + '. The ' +
      'best row here is not the hottest or the coldest — it is ' +
      root.Format.fixed(best.temperature, 2) + ' — and the column is not monotone, which is ' +
      'worth leaving visible: tuning a proposal distribution is a search rather than a ' +
      'direction, and a tidy monotone sweep would hide that.');
  }

  function paintExact(study) {
    root.jQuery('#mth-exact tbody').html(study.rows.map(function (row) {
      return '<tr><td>' + LABELS[row.name] + '</td><td class="mono">' +
        root.Format.fixed(row.cost, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 4) + '</td><td class="mono">' +
        (row.optimal ? 'yes' : 'no') + '</td></tr>';
    }).join(''));

    const optimal = study.rows.filter(function (row) { return row.optimal; });
    root.Helpers.setText('mth-exact-note',
      'Fifteen cities, small enough for Held–Karp, so this column is a ratio against the true ' +
      'OPTIMUM of ' + root.Format.fixed(study.optimum, 2) + ' rather than against the best any ' +
      'of these methods happened to find. ' + root.Format.exact(optimal.length) + ' of ' +
      root.Format.exact(study.rows.length) + ' reach it inside ' +
      root.Format.exact(study.budget) + ' evaluations. The distinction matters more than it ' +
      'looks: quoting a ratio against a best-known value and calling it an optimality gap is how ' +
      'published ratios end up below one, and it is why every claim on the larger instance above ' +
      'is phrased as "above the best found" instead.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
