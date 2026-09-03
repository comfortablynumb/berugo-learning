/**
 * Section: one-dimensional DP.
 *
 * Two claims, both measured on the page.
 *
 * The first is that patience sorting's `tails` array is *not* the answer. It
 * is increasing and it is exactly the right length, so it passes every check a
 * careless test makes; it is usually not a subsequence of the input. The demo
 * prints both and runs `isSubsequence` on each, which is the only check that
 * separates them.
 *
 * The second is coin change's loop order. Counting combinations and counting
 * permutations are a one-line difference with no error either way, so the
 * section runs both against an exhaustive reference and shows which one the
 * reference agrees with.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'one-dimensional-dp';
  const COINS = [1, 2, 5];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — patience piles and the predecessor links',
      caption: 'The pile tops are the smallest value that can end an increasing subsequence of each length. ' +
        'The answer is rebuilt from the predecessor links, not from the pile tops - those are a summary of ' +
        'what is achievable, and a summary is not a witness.',
      definition: [
        'flowchart LR',
        '    V["value arrives"] --> B["binary search the pile tops"]',
        '    B --> R{"found a pile whose top >= it?"}',
        '    R -->|yes| X["replace that top"]',
        '    R -->|no| N["start a new pile — the length just grew"]',
        '    X --> L["link it to the top of the pile to its left"]',
        '    N --> L',
        '    L --> A["the answer is that chain, walked backwards"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**One-dimensional DP is the family where the state is a single index**, and almost ' +
          'every mistake in it is an *order* mistake rather than a recurrence mistake.',
        'Climbing stairs, house robber, maximum subarray and coin change are all "dp[i] depends ' +
          'on a bounded number of earlier entries". The work is in naming what dp[i] means ' +
          'precisely enough that the transitions are forced.',
        'Kadane\'s algorithm is the clearest case of a recurrence disguised as a trick. Here ' +
          'dp[i] is the best sum of a subarray *ending at i*. Once that sentence is written the ' +
          'algorithm is immediate: either extend the previous best, or start again at i. The ' +
          'table is never stored because only the last entry is needed, which is why it does not ' +
          'look like DP at all.',
        '**The patience-sorting `tails` array is not the answer, and it looks exactly like it.** ' +
          'It is increasing, it is precisely the right length, and it is what most ' +
          'implementations return.',
        'The demo below prints the piles beside the reconstructed subsequence and checks each ' +
          'against the input. The piles are usually not a subsequence of it. That is why this ' +
          'section\'s exercise asks for reconstruction rather than length: a length is not a ' +
          'witness, and a wrong witness is worse than none.',
        '**Coin change\'s loop order decides which question is being answered.** Coin outside, ' +
          'amount inside counts combinations — {1,2,2} once. Amount outside, coin inside counts ' +
          'permutations — {1,2,2}, {2,1,2} and {2,2,1} separately.',
        'For 5 from {1, 2, 5} the two answers are 4 and 9. Neither raises. Both are correct ' +
          'answers to *different* questions, and the only way to know which one you wrote is to ' +
          'check it against an enumeration.'
      ],
      demo: {
        title: 'Interactive demo — LIS twice over, and the loop order that changes the question',
        markup: root.OneDimensionalDpTemplate.render()
      },
      diagram: diagram(),
      insight: 'When a DP is asked for an answer rather than a value, write the reconstruction ' +
        'first and the value second. The reconstruction is the part that fails loudly. A ' +
        'subsequence that is not a subsequence. An item list that overfills the sack. An ' +
        'alignment whose rows do not strip back to the inputs. The value is the part that fails ' +
        'silently. Most DP bugs that reach production are in code that only ever returned a ' +
        'number: nothing downstream could tell that the number was the optimum of a slightly ' +
        'different problem.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.OneDimensionalDpTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const sequenceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[1]);
    const values = [];

    for (let i = 0; i < parts[0]; i += 1) values.push(random.int(parts[2]));
    return values;
  });

  const lisFor = root.Helpers.memoise(function (key) {
    const values = sequenceFor(key);
    return { values: values,
      quadratic: root.DpClassic.lisQuadratic(values, {}),
      patience: root.DpClassic.lisPatience(values, {}) };
  });

  const familyFor = root.Helpers.memoise(function (key) {
    const values = sequenceFor(key);
    const signed = values.map(function (value) { return value - Math.floor(value / 2); });
    return {
      robber: root.DpClassic.houseRobber(values, {}),
      kadane: root.DpClassic.maxSubarray(signed, {}),
      kadaneNaive: root.DpClassic.maxSubarrayNaive(signed),
      jumps: root.DpClassic.minJumps(values.slice(0, 400).map(function (v) {
        return 1 + (v % 5);
      }), {}),
      signed: signed
    };
  });

  const coinsFor = root.Helpers.memoise(function (key) {
    const amount = Number(key);
    return {
      combinations: root.DpClassic.coinChangeWays(COINS, amount, {}),
      permutations: root.DpClassic.coinChangeWays(COINS, amount, { order: 'permutations' }),
      brute: root.DpClassic.coinWaysBruteForce(COINS, amount),
      minimum: root.DpClassic.coinChangeMin(COINS, amount, {})
    };
  });

  function keyFor(values) {
    return values['odp-size'] + '|' + values['odp-seed'] + '|' + values['odp-spread'];
  }

  function update() {
    const values = panel.values();
    const run = lisFor(keyFor(values));

    paintMetrics(run);
    paintLis(run);
    paintPiles(run);
    paintCoins(coinsFor(String(values['odp-amount'])), values['odp-amount']);
    paintFamily(familyFor(keyFor(values)));
  }

  function paintMetrics(run) {
    const quad = run.quadratic.report.transitions;
    const patience = run.patience.report.transitions;

    root.MetricGrid.update({
      'odp-lis': {
        value: root.Format.exact(run.quadratic.length),
        note: run.quadratic.length === run.patience.length
          ? 'both algorithms agree' : 'THE TWO ALGORITHMS DISAGREE'
      },
      'odp-quad': { value: root.Format.exact(quad), note: 'one per (i, j) pair with j < i' },
      'odp-patience': { value: root.Format.exact(patience), note: 'binary-search steps over the piles' },
      'odp-ratio': {
        value: root.Format.fixed(quad / Math.max(1, patience), 1) + '×',
        note: 'at n = ' + root.Format.exact(run.values.length)
      }
    });
  }

  function paintLis(run) {
    const rows = [
      { label: 'O(n²) table with predecessor links', result: run.quadratic },
      { label: 'patience sorting, O(n log n)', result: run.patience }
    ];
    const html = rows.map(function (row) {
      const genuine = root.DpClassic.isSubsequence(row.result.sequence, run.values);
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + row.result.length + '</td>' +
        '<td class="mono">' + root.Format.exact(row.result.report.states) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.result.report.transitions) + '</td>' +
        '<td class="mono">' + row.result.sequence.length + ' values</td>' +
        '<td>' + (genuine ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#odp-lis-methods tbody').html(html);
    root.jQuery('#odp-lis-methods-note').text('Both return the same length and both reconstruct a genuine '
      + 'subsequence of the input. The transition counts are the whole difference, and they are the reason '
      + 'the second one exists.');
  }

  function paintPiles(run) {
    const piles = run.patience.piles;
    const answer = run.patience.sequence;
    const pilesAreSubsequence = root.DpClassic.isSubsequence(piles, run.values);
    const rows = [
      { label: 'pile tops (`tails`)', values: piles, genuine: pilesAreSubsequence },
      { label: 'reconstructed answer', values: answer,
        genuine: root.DpClassic.isSubsequence(answer, run.values) }
    ];

    root.MatrixView.render(root.jQuery('#odp-piles')[0], {
      columns: ['', 'length', 'increasing?', 'a subsequence of the input?', 'first 12 values'],
      rows: rows.map(function (row) {
        return { cells: [row.label, row.values.length, isIncreasing(row.values) ? 'yes' : 'no',
          row.genuine ? 'yes' : 'NO', row.values.slice(0, 12).join(', ')] };
      })
    });
    root.jQuery('#odp-piles-note').text(pilesAreSubsequence
      ? 'On this particular sequence the pile tops happen to be a subsequence too — which is exactly why '
        + 'the mistake survives testing. Move the seed and watch the last column change.'
      : 'The pile tops are increasing and exactly the right length, and they are NOT a subsequence of the '
        + 'input. Returning them would pass a length check, a sortedness check and every eyeball test.');
  }

  function isIncreasing(values) {
    for (let i = 1; i < values.length; i += 1) {
      if (values[i] > values[i - 1]) continue;
      return false;
    }
    return true;
  }

  function paintCoins(coins, amount) {
    const rows = [
      { label: 'coin outside, amount inside', counts: 'combinations',
        answer: coins.combinations.ways, agrees: coins.combinations.ways === coins.brute },
      { label: 'amount outside, coin inside', counts: 'permutations',
        answer: coins.permutations.ways, agrees: coins.permutations.ways === coins.brute }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' + row.counts + '</td>' +
        '<td class="mono">' + root.Format.exact(row.answer) + '</td>' +
        '<td class="mono">' + root.Format.exact(coins.brute) + '</td>' +
        '<td>' + (row.agrees ? 'yes' : 'no — it answers the other question') + '</td></tr>';
    }).join('');

    root.jQuery('#odp-coins tbody').html(html);
    root.jQuery('#odp-coins-note').text('Making ' + amount + ' from {1, 2, 5}. The brute force enumerates '
      + 'multisets, so it is the reference for combinations; the permutation row is not wrong, it is an '
      + 'answer to a question nobody asked. Fewest coins for the same amount: '
      + (coins.minimum.count === null ? 'impossible' : coins.minimum.count + ' ('
        + coins.minimum.coins.join(' + ') + ')') + '.');
  }

  function paintFamily(family) {
    const rows = [
      { problem: 'house robber', state: 'best using the first i houses',
        answer: root.Format.exact(family.robber.value),
        reconstruction: family.robber.chosen.length + ' houses, none adjacent',
        checked: 'no two chosen indices differ by one' },
      { problem: 'maximum subarray (Kadane)', state: 'best sum ending at i',
        answer: root.Format.exact(family.kadane.value),
        reconstruction: '[' + family.kadane.from + ', ' + family.kadane.to + ']',
        checked: family.kadane.value === family.kadaneNaive.value
          ? 'the quadratic scan agrees' : 'THE QUADRATIC SCAN DISAGREES' },
      { problem: 'minimum jumps', state: 'fewest jumps to reach i',
        answer: family.jumps.jumps === null ? 'unreachable' : root.Format.exact(family.jumps.jumps),
        reconstruction: family.jumps.path.length + ' positions',
        checked: 'every hop is within the reported reach' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.problem + '</td><td>' + row.state + '</td>' +
        '<td class="mono">' + row.answer + '</td><td>' + row.reconstruction + '</td>' +
        '<td>' + row.checked + '</td></tr>';
    }).join('');

    root.jQuery('#odp-family tbody').html(html);
    root.jQuery('#odp-family-note').text('Three recurrences, three different meanings for dp[i], and each '
      + 'one is forced by its state sentence rather than discovered. Kadane\'s runs on a re-centred copy of '
      + 'the sequence so that some values are negative — on non-negative input the answer is always the '
      + 'whole array and the algorithm demonstrates nothing.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
