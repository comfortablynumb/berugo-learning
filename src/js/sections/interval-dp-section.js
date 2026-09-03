/**
 * Section: interval DP.
 *
 * Two subjects, and both are about *order*.
 *
 * The evaluation order is by increasing interval length, and the page shows
 * the sweep as data - which lengths are settled at each pass and which lengths
 * they read. That is what makes "the nested i, j loop reads cells that are not
 * there yet" concrete rather than a caution.
 *
 * Knuth's optimisation narrows the split search, and the whole reason the
 * section exists is what happens when its precondition fails: the narrowed
 * range can exclude the optimum, so the run is *faster and wrong*. The table
 * runs both a weight set that satisfies the quadrangle inequality and one that
 * does not, and the second row shows the optimisation refusing rather than
 * answering.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'interval-dp';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — an interval split at k',
      caption: 'Every interval DP asks the same question: where does [i, j] break? Both pieces are strictly ' +
        'shorter, which is why the evaluation order is by length - and why the natural nested loop over i ' +
        'and j reads cells that have not been computed.',
      definition: [
        'flowchart TD',
        '    IJ["best[i][j]"] --> K{"try every split k in [i, j)"}',
        '    K --> L["best[i][k] — strictly shorter"]',
        '    K --> R["best[k+1][j] — strictly shorter"]',
        '    L --> C["combine, plus the cost of joining them"]',
        '    R --> C',
        '    C --> M["keep the best k, or the parenthesisation is lost"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**An interval DP\'s state is a contiguous range, and its recurrence asks where that ' +
          'range breaks.** Matrix-chain multiplication, optimal binary search trees, palindrome ' +
          'partitioning and burst balloons are all that shape.',
        '`best[i][j]` depends on strictly shorter intervals, so the evaluation order must be **by ' +
          'increasing length**. The natural nested loop over i and j is not that order: it reads ' +
          'cells that are still zero, and produces a plausible number.',
        'Burst balloons is worth the detour because its *state* is the thing people get wrong, ' +
          'rather than its order. "Which balloon do I burst first" has no optimal substructure — ' +
          'bursting changes who is adjacent to whom, so the two sides are not independent.',
        '"Which do I burst **last** in this interval" does have it. At that moment its neighbours ' +
          'are exactly the interval\'s endpoints, and the two sides never interact. Same problem, ' +
          'one word different, and one of them is a DP.',
        '**Knuth\'s optimisation is a narrowing, and a narrowing with a false precondition is a ' +
          'fast wrong answer.** If the cost satisfies the quadrangle inequality, the best split ' +
          'for [i, j] lies between the best splits for [i, j−1] and [i+1, j]. The k loop can then ' +
          'be restricted to that band, and the whole DP drops from O(n³) to O(n²).',
        'If it does not satisfy the inequality, the band can exclude the true optimum — and ' +
          'nothing raises. The demo tests the inequality against the actual weights, and the ' +
          'optimised solver refuses to run when it fails.',
        'The check is worth a paragraph of its own, because it is where a subtlety lives. The ' +
          'interval weight is a difference of prefix sums, so on nine two-decimal probabilities ' +
          'the inequality is violated by about 1.1 × 10⁻¹⁶ — pure floating-point noise.',
        'An exact `<=` therefore rejects the textbook instance the optimisation was written for. ' +
          'The tolerance is not a fudge. It is part of the check being correct.'
      ],
      demo: {
        title: 'Interactive demo — the diagonal sweep, and a precondition that is tested',
        markup: root.IntervalDpTemplate.render()
      },
      diagram: diagram(),
      insight: 'Every DP optimisation in the literature is a narrowing of a search, and every ' +
        'one has a precondition. Convexity, a monotone argmin, the quadrangle inequality: all ' +
        'the same kind of promise. All of them are cheap to test on the actual cost function, at ' +
        'the size your tests run at. Do that once, in a unit test, comparing the optimised answer ' +
        'against the unoptimised one. The alternative is shipping something that is measurably ' +
        'faster and occasionally wrong. That is the worst outcome available: it will pass review, ' +
        'pass benchmarking, and fail in a way nobody traces back to the optimisation.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.IntervalDpTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const chainFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[1]);
    const dimensions = [];

    for (let i = 0; i <= parts[0]; i += 1) dimensions.push(5 + random.int(45));
    const run = root.DpInterval.matrixChain(dimensions, {});
    return { dimensions: dimensions, run: run,
      brute: parts[0] <= 11 ? root.DpInterval.matrixChainBruteForce(dimensions) : null };
  });

  /* Two weight sets: one the inequality holds for, one it does not, so the
     refusal is visible beside a successful run rather than described. */
  const bstFor = root.Helpers.memoise(function (key) {
    const n = Number(key);
    const random = root.Random.seeded(11);
    const good = [];

    for (let i = 0; i < n; i += 1) good.push((1 + random.int(20)) / 100);
    const bad = good.slice();
    bad[Math.floor(n / 2)] = -bad[Math.floor(n / 2)];
    return [
      { label: 'non-negative probabilities', weights: good },
      { label: 'one negative weight', weights: bad }
    ].map(function (entry) {
      return { label: entry.label, weights: entry.weights,
        check: root.DpInterval.checkQuadrangle(entry.weights),
        plain: root.DpInterval.optimalBst(entry.weights, {}),
        knuth: root.DpInterval.knuthOptimalBst(entry.weights, {}) };
    });
  });

  const familyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[1]);
    const letters = 'aabbc';
    let text = '';

    for (let i = 0; i < 14; i += 1) text += letters[random.int(letters.length)];
    const balloons = [];

    for (let i = 0; i < 8; i += 1) balloons.push(1 + random.int(9));
    return { text: text, palindrome: root.DpInterval.palindromePartition(text, {}),
      balloons: balloons, burst: root.DpInterval.burstBalloons(balloons, {}),
      burstBrute: root.DpInterval.burstBruteForce(balloons) };
  });

  function keyFor(values) {
    return values['ivl-chain'] + '|' + values['ivl-seed'];
  }

  function update() {
    const values = panel.values();
    const chain = chainFor(keyFor(values));
    const bst = bstFor(String(values['ivl-keys']));

    paintMetrics(chain, bst[0]);
    paintTable(chain, values['ivl-length']);
    paintOrder(chain);
    paintKnuth(bst);
    paintFamily(familyFor(keyFor(values)));
  }

  function paintMetrics(chain, good) {
    const saving = good.knuth.refused ? null
      : good.plain.report.splitTests / Math.max(1, good.knuth.report.splitTests);

    root.MetricGrid.update({
      'ivl-cost': {
        value: root.Format.exact(chain.run.cost),
        note: chain.brute === null ? 'too long to enumerate every parenthesisation'
          : (chain.brute === chain.run.cost ? 'every parenthesisation enumerated, and it agrees'
            : 'EXHAUSTIVE ENUMERATION DISAGREES')
      },
      'ivl-splits': { value: root.Format.exact(chain.run.report.splitTests),
        note: 'over ' + root.Format.exact(chain.run.report.states) + ' intervals' },
      'ivl-knuth': { value: good.knuth.refused ? '—' : root.Format.exact(good.knuth.report.splitTests),
        note: good.knuth.refused ? 'refused: the quadrangle inequality does not hold'
          : 'the same optimum, from a narrowed k range' },
      'ivl-saving': { value: saving === null ? '—' : root.Format.fixed(saving, 1) + '×',
        note: saving === null ? 'nothing to compare' : 'on the optimal-BST instance' }
    });
  }

  function paintTable(chain, throughLength) {
    const n = chain.dimensions.length - 1;
    const settled = root.DpTableView.intervalSettled(n, Math.min(throughLength, n));

    root.jQuery('#ivl-table').html(root.DpTableView.markup({
      table: chain.run.table,
      corner: 'i \\ j',
      settled: settled,
      depends: n >= 2 ? [{ row: 0, column: Math.min(throughLength, n) - 1 }] : []
    }));
    root.jQuery('#ivl-table-note').text('Grey cells are settled after sweeping through interval length '
      + Math.min(throughLength, n) + '. The lower triangle is not empty — it is not part of the problem, '
      + 'because an interval [i, j] with j < i does not exist. Filling it with zeros and reading it back is '
      + 'exactly the bug the length-ordered sweep prevents.');
  }

  function paintOrder(chain) {
    const n = chain.dimensions.length - 1;
    const order = root.DpInterval.evaluationOrder(n);
    const byLength = {};

    order.forEach(function (cell) { byLength[cell.length] = (byLength[cell.length] || 0) + 1; });
    let running = 0;
    const html = Object.keys(byLength).map(Number).sort(function (a, b) { return a - b; })
      .map(function (length) {
        running += byLength[length];
        return '<tr><td class="mono">' + length + '</td>' +
          '<td class="mono">' + byLength[length] + '</td>' +
          '<td class="mono">1 … ' + (length - 1) + '</td>' +
          '<td class="mono">' + running + '</td></tr>';
      }).join('');

    root.jQuery('#ivl-order tbody').html(html);
    root.jQuery('#ivl-order-note').text('Each pass depends only on strictly shorter intervals, which is '
      + 'the whole justification for the order. A nested loop over i and j visits [0, n−1] long before it '
      + 'visits [1, 2], so it reads two cells that are still at their initial value — and returns a number.');
  }

  function paintKnuth(rows) {
    const html = rows.map(function (row) {
      const holds = row.check.holds;
      return '<tr><td>' + row.label + '</td>' +
        '<td>' + (holds ? 'holds' : 'fails at (' + row.check.witness.a + ', ' + row.check.witness.b +
          ', ' + row.check.witness.c + ', ' + row.check.witness.d + ')') + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.plain.cost, 4) + '</td>' +
        '<td class="mono">' + (row.knuth.refused ? 'refused'
          : root.Format.fixed(row.knuth.cost, 4)) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.plain.report.splitTests) + '</td>' +
        '<td class="mono">' + (row.knuth.refused ? '—'
          : root.Format.exact(row.knuth.report.splitTests)) + '</td></tr>';
    }).join('');

    root.jQuery('#ivl-knuth-table tbody').html(html);
    root.jQuery('#ivl-knuth-table-note').text('The first row is the case the optimisation was written for: same '
      + 'cost, far fewer split tests. The second differs by one sign, and the checker returns the exact '
      + 'four indices where the inequality breaks rather than a boolean — because "it does not hold" is not '
      + 'actionable and "it fails at these four indices" is.');
  }

  function paintFamily(family) {
    const rows = [
      { problem: 'palindrome partitioning', state: 'fewest cuts making every piece a palindrome',
        answer: family.palindrome.cuts + ' cuts: ' + family.palindrome.pieces.join(' | '),
        checked: 'every piece re-read forwards and backwards' },
      { problem: 'burst balloons', state: 'which balloon is burst LAST in [i, j]',
        answer: root.Format.exact(family.burst.coins) + ' coins',
        checked: family.burst.coins === family.burstBrute
          ? 'every burst order enumerated, and it agrees' : 'EXHAUSTIVE ENUMERATION DISAGREES' },
      { problem: 'matrix chain', state: 'where the product [i, j] is split',
        answer: 'see the metric above',
        checked: 'every parenthesisation, for short chains' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.problem + '</td><td>' + row.state + '</td>' +
        '<td class="mono">' + row.answer + '</td><td>' + row.checked + '</td></tr>';
    }).join('');

    root.jQuery('#ivl-family tbody').html(html);
    root.jQuery('#ivl-family-note').text('The text is "' + family.text + '" and the balloons are ['
      + family.balloons.join(', ') + ']. Three problems, one evaluation order, and three different '
      + 'sentences for what the state means — which is the part that has to be got right first.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
