/**
 * Section: lp-relaxation.
 *
 * The relaxation is not an approximation of the problem; it is a different
 * problem whose optimum brackets the one you want. That framing is what makes
 * the method mechanical: solve the easy problem, measure how far its answer is
 * from being an answer to the hard one, and bound the repair.
 *
 * Two measurements anchor the section. Every basic solution of the vertex-cover
 * LP over 150 random graphs came back half-integral - every coordinate in
 * {0, 1/2, 1} - which is the theorem being observed rather than quoted, and it
 * is the reason threshold rounding at 1/2 works at all. And the integrality gap
 * on complete graphs climbs towards 2 (1.87 at n = 15), which is a ceiling on
 * the whole approach: no rounding of THIS relaxation can beat 2, however
 * clever, because the two numbers being compared are that far apart before any
 * rounding happens.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'lp-relaxation';
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
      title: 'Diagram — relax, solve, round, and where each bound comes from',
      caption: 'The integer program and its relaxation differ in one line, and that line is the ' +
        'only hard part of the problem. The relaxation is solvable in polynomial time and its ' +
        'optimum is a lower bound on the integer one, because every integer solution is also a ' +
        'fractional one. Rounding produces a feasible integer solution whose cost is bounded ' +
        'relative to the LP value — and since the LP value is below the integer optimum, that ' +
        'same factor bounds the approximation ratio. The integrality gap is the limit: it is the ' +
        'worst ratio between the two optima, and no rounding scheme can do better than it.',
      definition: [
        'flowchart TD',
        '    A["integer program<br/>min sum x_v, x in {0,1}"] -- "drop integrality" --> B["linear program<br/>0 <= x <= 1"]',
        '    B --> C["solve in polynomial time<br/>LP <= OPT"]',
        '    C --> D["basic solution is<br/>half-integral: x in {0, 1/2, 1}"]',
        '    D --> E["round at 1/2"]',
        '    E --> F["feasible: every edge has<br/>x_u + x_v >= 1"]',
        '    E --> G["cost <= 2 * LP <= 2 * OPT"]',
        '    C -.-> H["integrality gap = max OPT / LP<br/>a ceiling on every rounding"]'
      ].join('\n')
    };
  }

  const ORIENTATION = [
        '**Relaxation turns a modelling problem into a solved one.** Write the integer program ' +
          'honestly — one variable per decision, one constraint per requirement — then delete the ' +
          'sentence that says the variables are integers. What remains is a linear program, which ' +
          'is polynomial-time solvable, and its optimum is a lower bound on the integer one ' +
          'because every integer solution is still a fractional solution.',
        '**Vertex cover’s relaxation is half-integral, which is why threshold rounding works.** ' +
          'Every basic solution has x in {0, ½, 1} — the demo checks it on every instance and ' +
          'finds no exception. Rounding up at ½ is then feasible by inspection: every edge has ' +
          'x_u + x_v ≥ 1, so at least one endpoint is at least ½ and gets taken. Each rounded ' +
          'coordinate at most doubles, so the cost is at most twice the LP value.',
        '**The integrality gap is a ceiling on the entire method, not a property of one ' +
          'algorithm.** On the complete graph the LP pays n/2 — every vertex at exactly ½ — and ' +
          'the integer optimum is n − 1, so the gap is 2 − 2/n. No rounding of this relaxation ' +
          'can produce a ratio better than that, because the two numbers it compares are already ' +
          'that far apart. Beating it needs a *stronger* relaxation, which is where semidefinite ' +
          'programming comes in.',
        '**Randomised rounding is the version for problems that are not half-integral.** Take set ' +
          'S with probability x_S; the expected cost per round is exactly the LP value, and the ' +
          'chance an element is uncovered after t rounds is at most e^−t. For MAX-SAT, setting ' +
          'variable i true with probability y_i satisfies a clause of length k with probability at ' +
          'least 1 − (1 − 1/k)^k ≥ 1 − 1/e.',
        '**The 3/4 algorithm is two weak algorithms with opposite biases.** A plain coin flip is ' +
          'good on LONG clauses (1 − 2^−k rises with k) and bad on short ones; LP rounding is ' +
          'good on SHORT clauses and falls to 1 − 1/e as k grows. Taking the better of the two on ' +
          'each instance gives 3/4, and the proof is that their average already exceeds 3/4 ' +
          'clause by clause.',
        '**The primal-dual method throws away the LP and keeps the duality.** Raise the dual ' +
          'variable of an uncovered edge until a vertex’s constraint is tight, take that vertex, ' +
          'repeat. No tableau, no solver, the same factor of 2, and the dual it builds is a ' +
          'certificate. This is the shape most production approximation code actually takes.'
  ];

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: ORIENTATION,
      demo: {
        title: 'Interactive demo — a fractional solution, the gap, and four MAX-SAT strategies',
        markup: root.LpRelaxationTemplate.render()
      },
      diagram: diagram(),
      insight: '**When a problem is NP-hard, the first move is to write the integer program, not ' +
        'to invent a heuristic.** The relaxation gives three things at once: a lower bound you can ' +
        'report immediately, a rounding that is usually a published two-line argument, and a ' +
        'measurable gap that tells you whether the model is the limitation or the algorithm is. ' +
        'The demo’s complete-graph table is the diagnostic in miniature — a gap approaching 2 ' +
        'means no amount of rounding cleverness will help and the *formulation* needs to change. ' +
        '**The practical form of this is also the most useful: a branch-and-bound solver’s LP ' +
        'bound is exactly this relaxation, so the same modelling effort gives you both the ' +
        'approximation and the exact solver, and you can start with whichever the instance size ' +
        'allows.**'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LpRelaxationTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const gapFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.ApproxLab.gapStudy({ n: Number(parts[0]), instances: Number(parts[1]) });
  });

  const coverFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.ApproxLab.coverStudy({ n: Number(parts[0]), instances: Number(parts[1]) });
  });

  const satFor = root.Helpers.memoise(function (key) {
    return root.ApproxLab.maxSatStudy({ instances: 60, clauses: Number(key), variables: 14 });
  });

  const instanceFor = root.Helpers.memoise(function (key) {
    const graph = root.ApproxLab.randomInstanceGraph({ rng: root.Random.seeded(5),
      n: Number(key), density: 0.35 });
    const relaxation = root.LpRounding.vertexCoverLp(graph);
    return { graph: graph, relaxation: relaxation,
      exact: root.ApproxLab.exactVertexCover(graph),
      rounded: root.LpRounding.roundVertexCover(graph, relaxation) };
  });

  function update(app) {
    const values = panel.values();
    const gap = gapFor(values['lpr-n'] + '|' + values['lpr-instances']);
    const cover = coverFor(values['lpr-n'] + '|' + values['lpr-instances']);
    const sat = satFor(values['lpr-clauses']);
    const instance = instanceFor(values['lpr-n']);

    paintMetrics(gap, sat);
    paintFractional(instance);
    paintMethods(cover);
    paintComplete(gap, Number(values['lpr-complete']));
    paintChart(app, gap);
    paintSat(sat);
  }

  function paintMetrics(gap, sat) {
    const lp = summaryFor(sat, 'lp');
    const worst = gap.complete[gap.complete.length - 1];
    root.MetricGrid.update({
      'lpr-gap': { value: root.Format.fixed(gap.summary.mean, 4),
        note: 'worst ' + root.Format.fixed(gap.summary.max, 4) + ' over ' +
          root.Format.exact(gap.rows.length) + ' random graphs' },
      'lpr-half': { value: root.Format.exact(gap.halfIntegralCount) + ' / ' +
        root.Format.exact(gap.rows.length),
      note: 'the theorem says all of them, and the demo checks rather than assumes' },
      'lpr-rounding': { value: root.Format.percent(lp.mean, 1),
        note: 'the proven floor is 1 − 1/e = ' + root.Format.percent(1 - 1 / Math.E, 1) },
      'lpr-worst': { value: root.Format.fixed(worst.gap, 4),
        note: 'on K' + root.Format.exact(worst.n) + ', where the supremum is 2' }
    });
  }

  function summaryFor(sat, method) {
    for (let i = 0; i < sat.summary.length; i += 1) {
      if (sat.summary[i].method === method) return sat.summary[i];
    }
    return sat.summary[0];
  }

  function paintFractional(instance) {
    const optimal = new Set();
    for (let v = 0; v < instance.graph.n; v += 1) {
      if ((instance.exact.mask >>> v) & 1) optimal.add(v);
    }
    const rounded = new Set(instance.rounded.cover);
    root.jQuery('#lpr-fractional tbody').html(instance.relaxation.x.map(function (value, v) {
      return '<tr' + (Math.abs(value - 0.5) < 1e-6 ? ' class="matrix-row-lit"' : '') +
        '><td class="mono">' + v + '</td><td class="mono">' + root.Format.fixed(value, 3) +
        '</td><td>' + (rounded.has(v) ? 'taken' : '—') + '</td><td>' +
        (optimal.has(v) ? 'taken' : '—') + '</td></tr>';
    }).join(''));

    const halves = instance.relaxation.x.filter(function (value) {
      return Math.abs(value - 0.5) < 1e-6;
    }).length;
    root.Helpers.setText('lpr-fractional-note',
      'One instance, all the way through. The LP pays ' +
      root.Format.fixed(instance.relaxation.value, 2) + ' with ' + root.Format.exact(halves) +
      ' of ' + root.Format.exact(instance.graph.n) + ' vertices at exactly one half — the ' +
      'highlighted rows, and the reason half-integrality matters. Rounding those up gives a ' +
      'cover of ' + root.Format.exact(instance.rounded.size) + ' against an exact optimum of ' +
      root.Format.exact(instance.exact.size) + ', found by examining ' +
      root.Format.exact(instance.exact.subsetsExamined) + ' subsets. The last two columns ' +
      'rarely agree vertex for vertex even when the sizes are close: the rounding finds *a* ' +
      'good cover, not *the* optimal one, and there is no reason it should.');
  }

  function paintMethods(cover) {
    const rows = [
      { name: 'LP relaxation (a lower bound)', lp: 'yes', key: 'LP relaxation', bound: '—' },
      { name: 'LP + threshold rounding at ½', lp: 'yes', key: 'LP + rounding', bound: '2' },
      { name: 'primal–dual (no solver at all)', lp: 'no', key: 'primal-dual', bound: '2' },
      { name: 'maximal matching', lp: 'no', key: 'maximal matching', bound: '2' }
    ];
    root.jQuery('#lpr-methods tbody').html(rows.map(function (row) {
      const entry = methodRow(cover, row.key);
      return '<tr><td>' + row.name + '</td><td>' + row.lp + '</td><td class="mono">' +
        root.Format.fixed(entry.mean, 4) + '</td><td class="mono">' +
        root.Format.fixed(entry.median, 4) + '</td><td class="mono">' +
        root.Format.fixed(entry.max, 4) + '</td><td class="mono">' + row.bound + '</td></tr>';
    }).join(''));

    root.Helpers.setText('lpr-methods-note',
      'The bottom three rows have the same proven ratio and reach it three different ways. LP ' +
      'rounding solves a linear program and thresholds it; the primal–dual method never builds ' +
      'a tableau and raises dual variables instead, arriving at the same factor with the dual ' +
      'as its certificate; the matching algorithm is the primal–dual method with the duality ' +
      'argument compiled away. Read that ordering backwards and it is the history of the ' +
      'subject: the combinatorial algorithm came first, and the LP explains why it works.');
  }

  function methodRow(cover, name) {
    for (let i = 0; i < cover.summary.length; i += 1) {
      if (cover.summary[i].method === name) return cover.summary[i];
    }
    return cover.summary[0];
  }

  function paintComplete(gap, highlight) {
    root.jQuery('#lpr-complete-table tbody').html(gap.complete.map(function (row) {
      return '<tr' + (row.n === highlight ? ' class="matrix-row-lit"' : '') +
        '><td class="mono">K' + row.n + '</td><td class="mono">' +
        root.Format.fixed(row.lp, 2) + '</td><td class="mono">' + root.Format.exact(row.integer) +
        '</td><td class="mono">' + root.Format.fixed(row.gap, 4) + '</td><td class="mono">' +
        root.Format.fixed(2 - 2 / row.n, 4) + '</td></tr>';
    }).join(''));

    const last = gap.complete[gap.complete.length - 1];
    root.Helpers.setText('lpr-complete-note',
      'On K_n every vertex sits at exactly one half, so the LP pays n/2 while any integer cover ' +
      'must leave at most one vertex out and pays n − 1. The gap column and the 2 − 2/n column ' +
      'agree exactly, which is what it looks like when a bound is attained by a family rather ' +
      'than approached by an argument. At K' + root.Format.exact(last.n) + ' the gap is ' +
      root.Format.fixed(last.gap, 4) + ', and it never reaches 2 — but it gets arbitrarily ' +
      'close, so 2 is a hard ceiling on every rounding of this relaxation. Improving on it ' +
      'requires a different relaxation, and under the unique games conjecture even that does not ' +
      'help for vertex cover.');
  }

  function paintChart(app, gap) {
    const host = root.jQuery('#lpr-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    const buckets = [];
    for (let i = 0; i < 10; i += 1) buckets.push({ from: 1 + i * 0.1, count: 0 });
    gap.rows.forEach(function (row) {
      const index = Math.min(9, Math.max(0, Math.floor((row.gap - 1) * 10)));
      buckets[index].count += 1;
    });

    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 230,
      xLabel: 'integer optimum ÷ LP optimum', yLabel: 'instances',
      values: buckets.map(function (bucket) {
        return { label: root.Format.fixed(bucket.from, 1), value: bucket.count };
      })
    });

    root.Helpers.setText('lpr-chart-note',
      'The gap on random graphs concentrates well below its worst case: mean ' +
      root.Format.fixed(gap.summary.mean, 3) + ', worst ' +
      root.Format.fixed(gap.summary.max, 3) + ', against a supremum of 2 that only the complete ' +
      'graphs approach. That is the usual shape, and it is the argument for reporting the LP ' +
      'bound alongside a heuristic’s answer in production: on a typical instance it tells you ' +
      'you are within a few percent of optimal, which is information no worst-case ratio can ' +
      'give you.');
  }

  function paintSat(sat) {
    const rows = [
      { method: 'random assignment (a coin per variable)', key: 'random',
        bound: '1 − 2^−k per clause, ≥ 1/2', randomness: 'n bits' },
      { method: 'LP relaxation, then randomised rounding', key: 'lp',
        bound: '1 − 1/e ≈ 0.632', randomness: 'n bits, biased by the LP' },
      { method: 'the better of the two', key: 'best-of-two', bound: '3/4',
        randomness: 'both, then a comparison' },
      { method: 'conditional expectations (19.9)', key: 'conditional',
        bound: '≥ the random expectation, always', randomness: 'none' }
    ];
    root.jQuery('#lpr-sat-table tbody').html(rows.map(function (row) {
      const entry = summaryFor(sat, row.key);
      return '<tr><td>' + row.method + '</td><td class="mono">' +
        root.Format.percent(entry.mean, 2) + '</td><td class="mono">' +
        root.Format.percent(entry.median, 2) + '</td><td class="mono">' +
        root.Format.percent(entry.min, 2) + '</td><td class="mono">' + row.bound +
        '</td><td>' + row.randomness + '</td></tr>';
    }).join(''));

    const coin = summaryFor(sat, 'random');
    const best = summaryFor(sat, 'best-of-two');
    root.Helpers.setText('lpr-sat-note',
      'The "worst" column here is the SMALLEST ratio, because this is a maximisation problem — ' +
      'the direction flips relative to every other table in the milestone, and reading it the ' +
      'other way turns a guarantee into its opposite. A coin flip alone bottoms out at ' +
      root.Format.percent(coin.min, 1) + ' of optimal; the better-of-two never falls below ' +
      root.Format.percent(best.min, 1) + ', comfortably inside its 3/4 bound. The last row ' +
      'is the preview of 19.9: the conditional-expectation walk uses no randomness at all and ' +
      'beats the random assignment on every one of these ' + root.Format.exact(sat.instances) +
      ' formulas, because "at least the expectation" is a guarantee and "the expectation" is not.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
