/**
 * Section: derandomisation.
 *
 * The demo puts one number beside a distribution and the whole section follows
 * from the comparison: the random assignment's mean cut is |E|/2 almost
 * exactly, and roughly half of the individual draws fall BELOW it. "At least
 * half the edges in expectation" therefore describes an algorithm that fails
 * its own bound about half the time, which is what an expectation is and is
 * not what anybody wants to ship.
 *
 * Two constructions fix it and they fix different things. Conditional
 * expectations produce one assignment that provably meets the bound and
 * happens to be a greedy algorithm. The pairwise-independent family produces a
 * sample space of 2^ceil(log2(n+1)) assignments whose AVERAGE is exactly the
 * bound - the demo measures 18.5000 against a bound of 18.5 - so enumerating
 * 32 of them in place of 65 536 must find one at least as good.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'derandomisation';
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
      title: 'Diagram — the conditional-expectation walk, one vertex at a time',
      caption: 'At every point the algorithm holds a partial assignment and the conditional ' +
        'expectation of the cut given it: edges already cut, plus half of every edge with an ' +
        'undecided endpoint. Deciding the next vertex splits that expectation into two branches ' +
        'whose average is the current value — so at least one branch is at least as large, and ' +
        'taking it means the expectation never falls. When the last vertex is decided there is ' +
        'nothing left to average over, so the expectation IS the cut, and it is at least where ' +
        'it started at |E|/2. Every step is computable in linear time, so the proof is the ' +
        'algorithm.',
      definition: [
        'flowchart TD',
        '    A["E[cut] = |E| / 2<br/>nothing decided"] --> B{"vertex 1"}',
        '    B -- "side 0" --> C["E[cut | v1 = 0]"]',
        '    B -- "side 1" --> D["E[cut | v1 = 1]"]',
        '    C -.- E["their average is |E|/2<br/>so one is at least that"]',
        '    D -.- E',
        '    D --> F{"vertex 2"}',
        '    F -- "side 0" --> G["..."]',
        '    F -- "side 1" --> H["..."]',
        '    H --> I["all decided:<br/>expectation = the actual cut<br/>>= |E| / 2"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**"In expectation" is a statement about an average, and about half of your runs will be ' +
        'below it.** A random assignment cuts |E|/2 edges in expectation.',
      'The demo draws hundreds of them and finds close to half falling short, with the worst at a ' +
        'small fraction of the bound.',
      'That is not a defect of the analysis. It is what an expectation means, and it is why an ' +
        'existence proof is not yet an algorithm.',
      '**The method of conditional expectations converts one into the other mechanically.** Keep ' +
        'the conditional expectation of the objective given the decisions made so far.',
      'Deciding the next variable splits it into two branches whose average is the current value, ' +
        'so one branch is at least as good. Take it.',
      'When every variable is decided the expectation equals the answer, and the answer is at least ' +
        'where the walk started.',
      '**The resulting code is a greedy algorithm whose proof is the expectation argument.** For ' +
        'MAX-CUT the rule collapses to "put each vertex on the side opposite the majority of its ' +
        'already-placed neighbours".',
      'Anyone would have guessed that. But guessing it gives no bound, and deriving it gives |E|/2 ' +
        'on every input.',
      'The derivation is what makes it an algorithm rather than a heuristic.',
      '**The other route asks how much independence the analysis actually used.** The MAX-CUT ' +
        'expectation only needs each EDGE’s two endpoints to be independent, never three vertices ' +
        'at once.',
      'A family in which any two coordinates are independent therefore has the same average.',
      'One exists with only 2^⌈log₂(n+1)⌉ members: the parities of every non-empty subset of ' +
        '⌈log₂(n+1)⌉ random bits.',
      '**Enumerating that family is a deterministic algorithm.** Its average is exactly |E|/2, so ' +
        'its best member is at least that.',
      'The demo enumerates 32 assignments in place of 65 536 and reports both the best and the ' +
        'average. The average lands on the bound to four decimal places, which is the pairwise ' +
        'independence being observed rather than asserted.',
      '**The family is provably not three-wise independent, and the demo measures where it ' +
        'breaks.** Coordinates whose index sets XOR to zero always have even parity, so those ' +
        'triples hit only four of the eight patterns.',
      'Pairwise deviation is exactly zero, and triple deviation is 0.125.',
      'Knowing which triples fail is the same as knowing which analyses the family may be ' +
        'substituted into.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — a distribution, a deterministic run, and a sample space of 32',
        markup: root.DerandomisationTemplate.render()
      },
      diagram: diagram(),
      insight: '**The probabilistic method proves things exist. These two constructions go and ' +
        'get them, and both are short enough to use.** The practical reading is a question to ask ' +
        'of any randomised algorithm you are about to ship: *how much independence does the ' +
        'analysis actually use?* If the answer is "pairwise", the randomness can be replaced by ' +
        'a logarithmic seed and then by nothing at all. If it is "the conditional expectation is ' +
        'computable", the coins can be walked out one at a time. Both moves also make the ' +
        'algorithm **reproducible**, which in production is usually worth more than the ' +
        'guarantee. An incident you cannot re-run is an incident you cannot debug.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DerandomisationTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.ApproxLab.derandomStudy({ n: Number(parts[0]), density: Number(parts[1]),
      trials: Number(parts[2]), seed: 3 });
  });

  const satFor = root.Helpers.memoise(function () {
    const formula = root.Derandomize.randomFormula({ rng: root.Random.seeded(9), variables: 14,
      clauses: 40, width: 3 });
    const cuts = [];
    for (let t = 0; t < 500; t += 1) {
      cuts.push(root.Derandomize.randomAssignmentSat(formula, root.Random.seeded(t * 41 + 1)).satisfied);
    }
    return { formula: formula, cuts: cuts,
      conditional: root.Derandomize.conditionalExpectationSat(formula),
      expected: root.Derandomize.expectedSatisfied(formula),
      exact: root.ApproxLab.exactMaxSat(formula),
      spread: root.ApproxLab.spreadOf(cuts),
      below: cuts.filter(function (v) { return v < root.Derandomize.expectedSatisfied(formula); }).length };
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(values['drz-n'] + '|' + values['drz-density'] + '|' +
      values['drz-trials']);
    const sat = satFor('');

    paintMetrics(study);
    paintChart(app, study);
    paintCompare(study);
    paintWalk(study);
    paintProfile(study);
    paintSat(sat);
  }

  function paintMetrics(study) {
    root.MetricGrid.update({
      'drz-random': { value: root.Format.fixed(study.randomSpread.mean, 2),
        note: root.Format.exact(study.belowBound) + ' of ' + root.Format.exact(study.trials) +
          ' draws fell below |E|/2 = ' + root.Format.fixed(study.bound, 1) },
      'drz-deterministic': { value: root.Format.exact(study.conditional.cut),
        note: 'guaranteed to be at least |E|/2, on every input, with no coins at all' },
      'drz-space': { value: root.Format.exact(study.small.cut),
        note: 'from ' + root.Format.exact(study.small.points) + ' assignments instead of ' +
          root.Format.exact(study.small.fullSpace) },
      'drz-exact': { value: root.Format.exact(study.exact.cut),
        note: 'from ' + root.Format.exact(study.exact.assignments) + ' enumerated assignments' }
    });
  }

  function paintChart(app, study) {
    const host = root.jQuery('#drz-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    const min = Math.floor(study.randomSpread.min);
    const max = Math.ceil(study.randomSpread.max);
    const width = Math.max(1, Math.ceil((max - min) / 14));
    const buckets = [];
    for (let start = min; start <= max; start += width) buckets.push({ from: start, count: 0 });
    const cuts = study.randomSpread;

    rebuildCounts(study, buckets, min, width);
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 240,
      xLabel: 'cut size (bar marked ● contains the deterministic answer)', yLabel: 'random draws',
      values: buckets.map(function (bucket) {
        const holds = study.conditional.cut >= bucket.from &&
          study.conditional.cut < bucket.from + width;
        return { label: bucket.from + (holds ? ' ●' : ''), value: bucket.count };
      })
    });

    root.Helpers.setText('drz-chart-note',
      'The histogram is ' + root.Format.exact(study.trials) + ' independent random assignments; ' +
      'its mean is ' + root.Format.fixed(cuts.mean, 2) + ' against a predicted |E|/2 of ' +
      root.Format.fixed(study.bound, 1) + ', which is the expectation argument working exactly. ' +
      'The marked bar is where the conditional-expectation walk lands — ' +
      root.Format.exact(study.conditional.cut) + ', on the right-hand side of the distribution ' +
      'and reached deterministically. Everything to the left of |E|/2 is a run that failed the ' +
      'bound, and there are ' + root.Format.exact(study.belowBound) + ' of them.');
  }

  function rebuildCounts(study, buckets, min, width) {
    const cuts = [];
    for (let t = 0; t < study.trials; t += 1) {
      cuts.push(root.Derandomize.randomCut(study.graph, root.Random.seeded(t * 41 + 1)).cut);
    }
    cuts.forEach(function (cut) {
      const index = Math.min(buckets.length - 1, Math.floor((cut - min) / width));
      buckets[Math.max(0, index)].count += 1;
    });
  }

  function paintCompare(study) {
    const rows = [
      { method: 'one random assignment (mean of ' + root.Format.exact(study.trials) + ')',
        cut: root.Format.fixed(study.randomSpread.mean, 2),
        bits: root.Format.exact(study.graph.n), examined: '1',
        guarantee: '|E|/2 in expectation — ' + root.Format.exact(study.belowBound) + ' draws missed it' },
      { method: 'the best of ' + root.Format.exact(study.trials) + ' random assignments',
        cut: root.Format.exact(study.bestRandom),
        bits: root.Format.exact(study.graph.n * study.trials), examined: root.Format.exact(study.trials),
        guarantee: 'still only in expectation — the best of k draws has no floor' },
      { method: 'conditional expectations', cut: root.Format.exact(study.conditional.cut),
        bits: '0', examined: root.Format.exact(study.graph.n),
        guarantee: 'at least |E|/2, on every input' },
      { method: 'the pairwise-independent family, enumerated',
        cut: root.Format.exact(study.small.cut), bits: root.Format.exact(study.small.bits),
        examined: root.Format.exact(study.small.points),
        guarantee: 'at least |E|/2 — the family’s average IS |E|/2' },
      { method: 'exact maximum cut', cut: root.Format.exact(study.exact.cut), bits: '0',
        examined: root.Format.exact(study.exact.assignments),
        guarantee: 'optimal, at exponential cost' }
    ];
    root.jQuery('#drz-compare tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.method + '</td><td class="mono">' + row.cut + '</td><td class="mono">' +
        root.Format.percent(Number(String(row.cut).replace(/,/g, '')) / study.exact.cut, 1) +
        '</td><td class="mono">' + row.bits + '</td><td class="mono">' + row.examined +
        '</td><td>' + row.guarantee + '</td></tr>';
    }).join(''));

    root.Helpers.setText('drz-compare-note',
      'The second row is the one to argue with. Taking the best of many random draws does beat ' +
      'the deterministic walk here — ' + root.Format.exact(study.bestRandom) + ' against ' +
      root.Format.exact(study.conditional.cut) + ' — and it still has no guarantee: the best of ' +
      'k draws is a random variable with no floor, and reporting it is reporting a maximum over ' +
      'an experiment you happened to run. The fourth row is the interesting one. It examines ' +
      root.Format.exact(study.small.points) + ' assignments rather than ' +
      root.Format.exact(study.small.fullSpace) + ', is completely deterministic, and its ' +
      'guarantee is as strong as the third row’s — because pairwise independence is all the ' +
      'expectation argument ever used.');
  }

  function paintWalk(study) {
    const shown = study.conditional.trace.slice(0, 12);
    root.jQuery('#drz-walk tbody').html(shown.map(function (step) {
      return '<tr><td class="mono">' + step.vertex + '</td><td class="mono">' +
        root.Format.exact(step.ifZero) + '</td><td class="mono">' +
        root.Format.exact(step.ifOne) + '</td><td class="mono">' + step.chose +
        '</td><td class="mono">' + root.Format.fixed(step.expectation, 2) + '</td></tr>';
    }).join(''));

    const last = study.conditional.trace[study.conditional.trace.length - 1];
    root.Helpers.setText('drz-walk-note',
      'The two middle columns are the edges to already-placed neighbours that each choice would ' +
      'cut, and the rule is to take the larger — which is exactly "go opposite the majority of ' +
      'your placed neighbours". The right-hand column is the conditional expectation after the ' +
      'decision, and it never decreases: it starts at |E|/2 = ' +
      root.Format.fixed(study.conditional.startingExpectation, 1) + ' and ends at ' +
      root.Format.fixed(last.expectation, 2) + ', which is the cut itself because nothing is ' +
      'left undecided. Vertex 0 is the giveaway that this is a proof rather than a heuristic: ' +
      'both branches are 0, the choice is arbitrary, and the expectation is unchanged — the ' +
      'argument only ever needs "at least as good", never "better".');
  }

  function paintProfile(study) {
    const rows = [
      { property: 'any single coordinate is uniform',
        deviation: root.Format.fixed(0, 4),
        verdict: 'exact — every coordinate is a parity of at least one uniform bit' },
      { property: 'any two coordinates are independent',
        deviation: root.Format.fixed(study.profile.pairwiseWorst, 4),
        verdict: 'exact, over all pairs of the first ' +
          root.Format.exact(study.profile.coordinates) + ' coordinates' },
      { property: 'any three coordinates are independent',
        deviation: root.Format.fixed(study.profile.tripleWorst, 4),
        verdict: study.profile.tripleAt
          ? 'FAILS at (' + study.profile.tripleAt.join(', ') + ') — their parities always sum to 0'
          : 'holds' }
    ];
    root.jQuery('#drz-profile tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.property + '</td><td class="mono">' + row.deviation +
        '</td><td>' + row.verdict + '</td></tr>';
    }).join(''));

    root.Helpers.setText('drz-profile-note',
      'The family is {parity of the seed bits in S : S a non-empty subset}, so coordinate i and ' +
      'coordinate j are parities over different subsets and their joint distribution is uniform ' +
      'on all four patterns — measured deviation exactly ' +
      root.Format.fixed(study.profile.pairwiseWorst, 4) + '. Three coordinates whose index sets ' +
      'XOR to zero are not independent, because the third parity is determined by the other two, ' +
      'and the measured deviation is ' + root.Format.fixed(study.profile.tripleWorst, 3) + '. ' +
      'That is not a flaw: it is the price of a sample space of ' +
      root.Format.exact(study.small.points) + ' rather than ' +
      root.Format.exact(study.small.fullSpace) + ', and it is only a problem for an analysis ' +
      'that needs a triple.');
  }

  function paintSat(sat) {
    const rows = [
      { method: 'random assignment, mean of 500', value: root.Format.fixed(sat.spread.mean, 2),
        against: root.Format.exact(sat.below) + ' of 500 fell below the expectation',
        guarantee: 'Σ(1 − 2⁻ᵏ) in expectation' },
      { method: 'random assignment, worst of 500', value: root.Format.exact(sat.spread.min),
        against: root.Format.percent(sat.spread.min / sat.exact.satisfied, 1) + ' of the optimum',
        guarantee: 'none — this is a draw, not a bound' },
      { method: 'conditional expectations', value: root.Format.exact(sat.conditional.satisfied),
        against: 'the expectation is ' + root.Format.fixed(sat.expected, 2),
        guarantee: 'at least the expectation, on every input' },
      { method: 'the exact optimum', value: root.Format.exact(sat.exact.satisfied),
        against: 'from ' + root.Format.exact(sat.exact.assignments) + ' assignments',
        guarantee: 'optimal' }
    ];
    root.jQuery('#drz-sat tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.method + '</td><td class="mono">' + row.value + '</td><td>' +
        row.against + '</td><td>' + row.guarantee + '</td></tr>';
    }).join(''));

    root.Helpers.setText('drz-sat-note',
      'The identical argument, on a different objective. For MAX-SAT the conditional expectation ' +
      'of a partial assignment is the number of clauses already satisfied plus 1 − 2^−u for each ' +
      'surviving clause with u undecided literals, and taking the larger branch at each variable ' +
      'guarantees at least Σ(1 − 2⁻ᵏ) = ' + root.Format.fixed(sat.expected, 2) + ' — which for ' +
      'clauses of width 3 is 7/8 of them. The walk reaches ' +
      root.Format.exact(sat.conditional.satisfied) + ' against an exact optimum of ' +
      root.Format.exact(sat.exact.satisfied) + '. Håstad’s theorem says no polynomial algorithm ' +
      'beats 7/8 unless P = NP, so this three-line derandomised greedy is, up to the constant, ' +
      'the best MAX-3SAT algorithm there will ever be.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
