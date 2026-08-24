/**
 * Section: approximation-schemes.
 *
 * The demo makes two claims that the ε table proves against itself.
 *
 * The first is the good news: at ε = 0.5 the knapsack FPTAS promises half the
 * optimum and delivers 99.6% of it, from a table 25.6 times smaller than the
 * exact one. The guarantee is enormously loose, which is the normal situation
 * and the reason approximation schemes are practical rather than theoretical.
 *
 * The second is the caveat nobody states: the scaling divisor K = ε·P_max/n
 * falls below 1 once ε gets small enough, and at that point the "approximate"
 * table is LARGER than the exact one. At n = 20 with profits near 1 000 the
 * crossing is at ε = 0.01, where the scheme costs 514 000 cells against the
 * exact DP's 258 640 and returns exactly the same answer. An FPTAS is only a
 * saving in the range where its own scaling actually scales.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'approximation-schemes';
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
      title: 'Diagram — profit scaling, and where the error is paid',
      caption: 'The exact dynamic program indexed by profit runs in O(n·P), which is polynomial ' +
        'in the VALUES rather than in their encoding length — that is what "pseudo-polynomial" ' +
        'means and why it does not contradict NP-hardness. Dividing every profit by K and ' +
        'flooring shrinks the table by a factor of K and loses less than K per item, so at most ' +
        'nK in total. Choosing K = ε·P_max/n makes that loss at most ε·P_max, and since the ' +
        'optimum is at least P_max, the loss is at most ε·OPT. The error and the saving are the ' +
        'same number read two ways.',
      definition: [
        'flowchart TD',
        '    A["exact DP indexed by PROFIT<br/>O(n * P) cells"] --> B["divide every profit by K<br/>and round DOWN"]',
        '    B --> C["table shrinks to O(n^2 / epsilon)"]',
        '    B --> D["each item loses < K"]',
        '    D --> E["total loss < n*K = epsilon * P_max"]',
        '    E --> F["OPT >= P_max, so loss <= epsilon * OPT"]',
        '    C --> G["answer >= (1 - epsilon) * OPT"]',
        '    F --> G',
        '    B -.-> H["scale WEIGHTS instead<br/>and feasibility breaks"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**A scheme takes the accuracy as an input rather than fixing it.** A PTAS runs in time ' +
          'polynomial in n for each fixed ε, which permits n^(1/ε) — so halving the error can ' +
          'square the runtime and the dial is nearly unusable in practice. An FPTAS is polynomial ' +
          'in n AND in 1/ε, so the cost grows linearly in the accuracy you ask for. That ' +
          'difference is the whole content of the section.',
        '**Knapsack’s FPTAS is one idea: scale the profits and round down.** The exact DP indexed ' +
          'by profit costs O(n·P), which is polynomial in the numbers but not in their encoding, ' +
          'so it is pseudo-polynomial rather than a contradiction of NP-hardness. Dividing each ' +
          'profit by K = ε·P_max/n loses under K per item and shrinks the table by a factor of K, ' +
          'and the two are the same number seen from opposite sides.',
        '**Scale profits, never weights.** Rounding profits changes only the objective, so any ' +
          'solution stays feasible. Rounding weights changes FEASIBILITY: the demo runs that ' +
          'variant and shows a solution that exceeds the capacity, which is not a worse answer ' +
          'but a wrong one. Which quantity a relaxation is allowed to perturb is always the first ' +
          'question about a scheme.',
        '**The guarantee is a floor and the measured quality is far above it.** At ε = 0.5 the ' +
          'theorem promises half the optimum and the demo delivers over 99%. That is normal, and ' +
          'it is why an FPTAS is worth using at loose ε rather than tight: the cost is linear in ' +
          '1/ε and the quality saturates almost immediately.',
        '**The scaling stops saving before ε gets small.** K = ε·P_max/n drops below 1 once ε is ' +
          'under n/P_max, and dividing by a number below one makes the table BIGGER. The demo ' +
          'shows the crossing: at that ε the scheme costs about twice the exact DP and returns ' +
          'the identical answer. Nobody writes this down and everybody who implements one finds it.',
        '**Some problems admit no scheme at all, and the PCP theorem is why.** MAX-3SAT cannot be ' +
          'approximated beyond 7/8 unless P = NP, and set cover cannot beat (1 − o(1))·ln n. ' +
          'APX-hardness means there is a constant below which approximation is as hard as exact ' +
          'solution — so a PTAS for such a problem would collapse P and NP, and the search for ' +
          'one is not merely unpromising but provably futile.'
      ],
      demo: {
        title: 'Interactive demo — the ε dial, the table it shrinks, and the point it stops',
        markup: root.ApproximationSchemesTemplate.render()
      },
      diagram: diagram(),
      insight: '**An FPTAS is the best outcome an NP-hard problem can have, and it is rarer than ' +
        'the textbooks make it feel.** Knapsack has one because its DP is pseudo-polynomial and ' +
        'the objective is a sum that tolerates rounding; most NP-hard problems have neither ' +
        'property. The engineering habit worth keeping is the one the demo forces: **ask for the ' +
        'loosest ε you can live with and measure what you actually get, because the guarantee is ' +
        'a worst case and the measured quality is usually two orders of magnitude better.** And ' +
        'when the table size stops falling as ε shrinks, the scheme has run out of room — at that ' +
        'point you are paying approximation overhead for an exact answer, and you should just run ' +
        'the exact algorithm and say so.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ApproximationSchemesTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.ApproxLab.knapsackStudy({ count: Number(parts[0]),
      correlated: parts[1] === 'correlated', seed: 5 });
  });

  const compareFor = root.Helpers.memoise(function (key) {
    return root.ApproxLab.schemeComparison({ count: Math.min(Number(key), 20), seed: 5 });
  });

  function rowFor(study, epsilon) {
    for (let i = 0; i < study.rows.length; i += 1) {
      if (Math.abs(study.rows[i].epsilon - epsilon) < 1e-9) return study.rows[i];
    }
    return study.rows[0];
  }

  function update(app) {
    const values = panel.values();
    const study = studyFor(values['sch-count'] + '|' + values['sch-family']);
    const chosen = rowFor(study, Number(values['sch-epsilon']));
    const compare = compareFor(values['sch-count']);

    paintMetrics(study, chosen);
    paintChart(app, study);
    paintSweep(study, chosen);
    paintCompare(compare);
    paintBroken(study);
    paintClasses();
  }

  function paintMetrics(study, chosen) {
    root.MetricGrid.update({
      'sch-ratio': { value: root.Format.percent(chosen.ratio, 3),
        note: root.Format.exact(chosen.value) + ' against an exact optimum of ' +
          root.Format.exact(study.exact.value) },
      'sch-guarantee': { value: root.Format.percent(chosen.guarantee, 1),
        note: chosen.meetsGuarantee ? 'met, with ' +
          root.Format.percent(chosen.ratio - chosen.guarantee, 1) + ' to spare' : 'NOT MET' },
      'sch-cells': { value: root.Format.exact(chosen.cells),
        note: 'the exact DP uses ' + root.Format.exact(study.exact.cells) + ' — ' +
          (chosen.cheaperThanExact
            ? root.Format.fixed(study.exact.cells / chosen.cells, 1) + '× smaller'
            : 'so this ε is LARGER than exact') },
      'sch-scale': { value: root.Format.fixed(chosen.scale, 3),
        note: chosen.scale >= 1 ? 'profits divide down, so the table shrinks'
          : 'below 1 — dividing by it makes the table grow' }
    });
  }

  function paintChart(app, study) {
    const host = root.jQuery('#sch-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 260, logX: true, logY: true,
      xLabel: 'ε (logarithmic)', yLabel: 'table cells',
      series: [
        { label: 'FPTAS table cells', points: study.rows.map(function (row) {
          return { x: row.epsilon, y: row.cells };
        }) },
        { label: 'the exact DP, for comparison', dashed: true,
          points: study.rows.map(function (row) {
            return { x: row.epsilon, y: study.exact.cells };
          }) }
      ],
      legendHost: root.jQuery('#sch-legend')[0]
    });

    root.Helpers.setText('sch-chart-note',
      'Both axes are logarithmic and the cell count is a straight line of slope −1 in ε, which ' +
      'is the "fully" in fully polynomial-time approximation scheme: the cost is linear in 1/ε ' +
      'rather than exponential in it. The interesting feature is where the solid line crosses ' +
      'the dashed one. To the right of that point the scheme is a saving; to the left it is ' +
      'overhead attached to an exact answer.');
  }

  function paintSweep(study, chosen) {
    root.jQuery('#sch-sweep tbody').html(study.rows.map(function (row) {
      return '<tr' + (row.epsilon === chosen.epsilon ? ' class="matrix-row-lit"' : '') +
        '><td class="mono">' + row.epsilon + '</td><td class="mono">' +
        root.Format.fixed(row.scale, 3) + '</td><td class="mono">' +
        root.Format.exact(row.value) + '</td><td class="mono">' +
        root.Format.percent(row.ratio, 4) + '</td><td class="mono">' +
        root.Format.percent(row.guarantee, 1) + '</td><td class="mono">' +
        root.Format.exact(row.cells) + '</td><td>' +
        (row.cheaperThanExact ? 'yes' : 'no — larger than the exact table') + '</td></tr>';
    }).join(''));

    const loose = study.rows[0];
    const tight = study.rows[study.rows.length - 1];
    root.Helpers.setText('sch-sweep-note',
      'Read the third and fourth columns against the fifth. At ε = ' + loose.epsilon +
      ' the theorem obliges the scheme to return ' + root.Format.percent(loose.guarantee, 0) +
      ' of the optimum and it returns ' + root.Format.percent(loose.ratio, 2) + ' — the ' +
      'guarantee is loose by a factor that makes the tight settings almost pointless. Then read ' +
      'the last two columns down. The table shrinks from ' +
      root.Format.exact(study.exact.cells) + ' to ' + root.Format.exact(loose.cells) + ' at ' +
      'ε = ' + loose.epsilon + ', and at ε = ' + tight.epsilon + ' it has grown to ' +
      root.Format.exact(tight.cells) + ' — larger than exact, because K has fallen to ' +
      root.Format.fixed(tight.scale, 3) + ' and dividing by a number below one multiplies. The ' +
      'scheme is a saving over a range, not everywhere, and the range is ε > n/P_max.');
  }

  function paintCompare(compare) {
    root.jQuery('#sch-compare tbody').html(compare.map(function (row) {
      return '<tr><td class="mono">' + row.k + '</td><td class="mono">' +
        root.Format.percent(row.guarantee, 1) + '</td><td class="mono">' +
        root.Format.percent(row.ptasRatio, 2) + '</td><td class="mono">' +
        root.Format.exact(row.subsets) + '</td><td class="mono">' +
        root.Format.percent(row.fptasRatio, 2) + '</td><td class="mono">' +
        root.Format.exact(row.fptasCells) + '</td></tr>';
    }).join(''));

    const last = compare[compare.length - 1];
    root.Helpers.setText('sch-compare-note',
      'The PTAS enumerates every subset of size at most k and fills the rest greedily, giving ' +
      '1 − 1/(k+1) for O(n^(k+1)) work. The subset column is the problem: ' +
      root.Format.exact(last.subsets) + ' at k = ' + last.k + ' on this instance, and it grows ' +
      'as n^k — at forty items and k = 4 it is over a hundred thousand, and at k = 6 it is ' +
      'hopeless. The FPTAS reaches the same guarantee, at the ε that matches it, in ' +
      root.Format.exact(last.fptasCells) + ' cells, and its cost grows as n²/ε rather than ' +
      'n^(1/ε). That is what the word "fully" is doing in the name.');
  }

  function paintBroken(study) {
    const rows = [
      { name: 'the FPTAS, scaling profits', value: study.rows[0].value,
        weight: root.Format.exact(study.broken.capacity) + ' capacity, within it',
        verdict: 'feasible, and inside its guarantee' },
      { name: 'the same scaling applied to WEIGHTS', value: study.broken.value,
        weight: root.Format.exact(study.broken.weight) + ' against ' +
          root.Format.exact(study.broken.capacity),
        verdict: study.broken.feasible ? 'feasible' : 'INFEASIBLE — over by ' +
          root.Format.exact(study.broken.overflow) },
      { name: 'density greedy alone', value: study.trap.densityOnly,
        weight: 'on the trap instance', verdict: root.Format.percent(study.trap.densityRatio, 1) +
          ' of the optimum — no bound at all' },
      { name: 'density greedy, or the best single item', value: study.trap.greedy,
        weight: 'on the same instance, via "' + study.trap.via + '"',
        verdict: 'a 1/2-approximation, and here it is exact' }
    ];
    root.jQuery('#sch-broken tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + root.Format.exact(row.value) +
        '</td><td class="mono">' + row.weight + '</td><td>' + row.verdict + '</td></tr>';
    }).join(''));

    root.Helpers.setText('sch-broken-note',
      'The second row is the mistake the construction exists to avoid. Scaling weights looks ' +
      'symmetric with scaling profits and is not: a rounded-down weight lets the chosen set ' +
      'exceed the real capacity, and the result is over by ' +
      root.Format.exact(study.broken.overflow) + ' — a higher value than the true optimum, and ' +
      'not a solution. The bottom pair is the other half of the lesson: density greedy takes ' +
      root.Format.percent(study.trap.densityRatio, 0) + ' of the optimum on the two-item trap, ' +
      'and adding "or the single best item, whichever is larger" turns an unbounded heuristic ' +
      'into a 1/2-approximation for one line of code.');
  }

  function paintClasses() {
    const rows = [
      { problem: 'knapsack', best: 'FPTAS — (1 − ε) for any ε', barrier: 'nothing; this is optimal',
        klass: 'FPTAS' },
      { problem: 'Euclidean TSP', best: 'PTAS (Arora, Mitchell)',
        barrier: 'no FPTAS unless P = NP', klass: 'PTAS' },
      { problem: 'metric TSP', best: '3/2 (Christofides)',
        barrier: 'no better than 123/122 unless P = NP', klass: 'APX' },
      { problem: 'vertex cover', best: '2', barrier: 'no better than 1.36; and no 2 − δ under the unique games conjecture',
        klass: 'APX' },
      { problem: 'MAX-3SAT', best: '7/8', barrier: '7/8 + δ is NP-hard — Håstad, from the PCP theorem',
        klass: 'APX' },
      { problem: 'set cover', best: 'ln n', barrier: '(1 − o(1))·ln n is NP-hard — Feige',
        klass: 'not APX' },
      { problem: 'general TSP', best: 'no constant factor',
        barrier: 'any constant factor implies P = NP', klass: 'not APX' }
    ];
    root.jQuery('#sch-classes tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.problem + '</td><td>' + row.best + '</td><td>' + row.barrier +
        '</td><td class="mono">' + row.klass + '</td></tr>';
    }).join(''));

    root.Helpers.setText('sch-classes-note',
      'This table is quoted from the literature rather than measured — the hardness results are ' +
      'theorems about every algorithm, and no demo can produce one. It is here because it is the ' +
      'part of the subject that changes what you do: a problem in the bottom two rows will not ' +
      'yield to a cleverer approximation, so the effort goes into the model, the instance sizes ' +
      'or an exact solver instead. The PCP theorem is what made the middle rows possible at all: ' +
      'it recasts NP as the class of problems whose proofs can be checked by reading three random ' +
      'bits, and a good enough approximation would let you read those bits and decide the ' +
      'original problem. The last row is worth remembering on its own — the general travelling ' +
      'salesman problem has no constant-factor approximation, and everything in 19.6 needed the ' +
      'triangle inequality for exactly that reason.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
