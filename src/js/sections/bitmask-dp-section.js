/**
 * Section: bitmask DP.
 *
 * Two identities carry this family and both are measured here rather than
 * quoted: submask enumeration totals 3ⁿ over all masks (not 4ⁿ), and sum over
 * subsets computes the same aggregate in n·2ⁿ (not 3ⁿ). The demo runs both and
 * asserts they agree, because the second is only worth having if it is exact.
 *
 * The memory wall gets a table rather than a sentence. "It does not scale past
 * about 25" is unfalsifiable; 6.7 GB for the (mask, last) table at n = 25 is
 * the same statement with the argument attached, and it sits beside the
 * factorial the table replaces so both ends of the trade are visible.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'bitmask-dp';
  const SUBMASK_SIZES = [4, 6, 8, 10, 12];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one Held-Karp transition',
      caption: 'The state is "which cities are visited" plus "which one am I standing on". Adding a city ' +
        'sets one bit and moves the marker; the set of visited cities is what makes the two paths that ' +
        'arrive with the same set and the same endpoint interchangeable, which is the whole saving.',
      definition: [
        'flowchart LR',
        '    A["(mask, last)"] -->|"cost + d(last, next)"| B["(mask | 1&lt;&lt;next, next)"]',
        '    B --> C{"mask is full?"}',
        '    C -->|yes| D["close the tour: + d(next, start)"]',
        '    C -->|no| A',
        '    A --> E["two routes with the same set and endpoint are the same state"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A bitmask DP puts a *set* in the state by writing it as an integer. Held-Karp\'s state is ' +
          '(visited set, current city), which is 2ⁿ·n cells against (n − 1)! permutations — at n = 12 that ' +
          'is 49 152 cells against 39 916 800 tours. The saving comes from a single observation: two routes ' +
          'that have visited the same cities and end at the same city are interchangeable for everything ' +
          'that follows, so only the cheaper one needs keeping.',
        '**Submask enumeration totals 3ⁿ, and that identity is why the technique is feasible at all.** ' +
          'The idiom `for (sub = mask; sub; sub = (sub - 1) & mask)` walks every subset of one mask; summed ' +
          'over all masks it counts each (submask, mask) pair once, which is three choices per bit — in ' +
          'neither, in the submask, or in the mask only. The obvious upper bound is 4ⁿ, and at n = 12 the ' +
          'difference between 3ⁿ and 4ⁿ is 531 441 against 16 777 216. The demo counts the steps.',
        '**Sum over subsets does the same job in n·2ⁿ.** Relaxing one bit at a time instead of walking ' +
          'every submask gives the identical table at 1 024 operations where the submask loop needs 6 561 ' +
          'at n = 8 — and the loop order is the algorithm. The bit loop must be *outside*; swapping the ' +
          'loops gives a partly relaxed table that is entirely plausible and wrong.',
        '**The wall is real and it is memory, not time.** At n = 25 the (mask, last) table is 838 million ' +
          'cells and 6.7 GB at eight bytes each. No amount of cleverness inside the transition changes ' +
          'that, which is why the practical answer past twenty-something cities is a different algorithm ' +
          'entirely — branch and bound, or an approximation — rather than a faster bitmask DP.'
      ],
      demo: {
        title: 'Interactive demo — Held-Karp, the two identities, and the wall',
        markup: root.BitmaskDpTemplate.render()
      },
      diagram: diagram(),
      insight: 'The moment a state contains a set, write down 2ⁿ times the rest of the state and multiply ' +
        'by eight bytes before writing any code. That number decides whether the approach exists, and it ' +
        'takes ten seconds. If it is over a gigabyte the answer is not "optimise the inner loop" — the ' +
        'inner loop is not the problem — it is a different algorithm. The corollary is that bitmask DP is ' +
        'the right tool in a narrow band: too small and brute force is simpler, too large and nothing fits.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BitmaskDpTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const tspFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[1]);
    const points = [];

    for (let i = 0; i < parts[0]; i += 1) points.push({ x: random.int(100), y: random.int(100) });
    const matrix = points.map(function (a) {
      return points.map(function (b) { return Math.hypot(a.x - b.x, a.y - b.y); });
    });
    return { matrix: matrix, run: root.DpBitmask.travellingSalesman(matrix, {}),
      brute: parts[0] <= 10 ? root.DpBitmask.tspBruteForce(matrix) : null };
  });

  const sosFor = root.Helpers.memoise(function (key) {
    const bits = Number(key);
    const random = root.Random.seeded(3);
    const values = [];

    for (let i = 0; i < (1 << bits); i += 1) values.push(random.int(100));
    const fast = root.DpBitmask.sumOverSubsets(values, bits, {});
    const slow = root.DpBitmask.sumOverSubsetsBySubmask(values, bits, {});
    return { bits: bits, fast: fast, slow: slow,
      agree: fast.values.every(function (value, i) { return value === slow.values[i]; }) };
  });

  const familyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[1]);
    const cost = [];

    for (let i = 0; i < 8; i += 1) {
      const row = [];

      for (let j = 0; j < 8; j += 1) row.push(random.int(50));
      cost.push(row);
    }
    return { cost: cost, assignment: root.DpBitmask.assignment(cost, {}),
      assignmentBrute: root.DpBitmask.assignmentBruteForce(cost) };
  });

  const tilingFor = root.Helpers.memoise(function (key) {
    return root.DpBitmask.dominoTilings(2, Number(key), {});
  });

  function keyFor(values) {
    return values['bmk-cities'] + '|' + values['bmk-seed'];
  }

  function update() {
    const values = panel.values();
    const tsp = tspFor(keyFor(values));

    paintMetrics(tsp, values['bmk-cities']);
    paintMemory(values['bmk-cities']);
    paintSubmask();
    paintSos(sosFor(String(values['bmk-bits'])));
    paintFamily(familyFor(keyFor(values)), tilingFor(String(values['bmk-board'])),
      values['bmk-board']);
  }

  function paintMetrics(tsp, n) {
    const memory = root.DpBitmask.memoryFor(n);
    const wall = root.DpBitmask.memoryFor(25);

    root.MetricGrid.update({
      'bmk-tour': {
        value: root.Format.fixed(tsp.run.length, 3),
        note: tsp.brute === null ? 'too many permutations to enumerate at this size'
          : (Math.abs(tsp.brute - tsp.run.length) < 1e-9 ? 'every permutation enumerated, and it agrees'
            : 'EXHAUSTIVE ENUMERATION DISAGREES')
      },
      'bmk-cells': { value: root.Format.exact(memory.cells), note: '2^' + n + ' × ' + n },
      'bmk-perms': { value: root.Format.exact(memory.permutations),
        note: '(' + n + ' − 1)! tours the table replaces' },
      'bmk-wall': { value: root.Format.bytes(wall.bytes),
        note: '838 860 800 cells — no inner loop fixes this' }
    });
  }

  function paintMemory(current) {
    const sizes = [10, 15, 20, 22, 25, 30];
    const html = sizes.map(function (n) {
      const memory = root.DpBitmask.memoryFor(n);
      const feasible = memory.bytes < 5e8;
      return '<tr' + (n === current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + n + '</td>' +
        '<td class="mono">' + root.Format.exact(memory.cells) + '</td>' +
        '<td class="mono">' + root.Format.bytes(memory.bytes) + '</td>' +
        '<td class="mono">' + root.Format.exact(memory.permutations) + '</td>' +
        '<td>' + (feasible ? 'yes' : 'no') + '</td></tr>';
    }).join('');

    root.jQuery('#bmk-memory tbody').html(html);
    root.jQuery('#bmk-memory-note').text('The permutation column is the reason to build the table and the '
      + 'bytes column is the reason you cannot always. Both grow without limit; the point is that they '
      + 'cross a practical threshold at completely different sizes, and past n ≈ 22 neither approach is '
      + 'available and the honest answer is a different algorithm.');
  }

  function paintSubmask() {
    const html = SUBMASK_SIZES.map(function (n) {
      const count = root.DpBitmask.submaskCount(n);
      return '<tr><td class="mono">' + n + '</td>' +
        '<td class="mono">' + root.Format.exact(count.steps) + '</td>' +
        '<td class="mono">' + root.Format.exact(count.predicted) + '</td>' +
        '<td>' + (count.steps === count.predicted ? 'yes' : 'NO') + '</td>' +
        '<td class="mono">' + root.Format.exact(count.naive) + '</td></tr>';
    }).join('');

    root.jQuery('#bmk-submask tbody').html(html);
    root.jQuery('#bmk-submask-note').text('The identity is exact at every size, not asymptotic. The last '
      + 'column is the bound people reach for when they see a loop over masks inside a loop over masks — '
      + 'and at n = 12 it overstates the work by a factor of 32.');
  }

  function paintSos(sos) {
    const rows = [
      { label: 'sum over subsets (relax one bit at a time)', operations: sos.fast.report.transitions,
        complexity: 'n · 2^n' },
      { label: 'walk every submask', operations: sos.slow.report.submaskSteps, complexity: '3^n' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.operations) + '</td>' +
        '<td class="mono">' + row.complexity + '</td>' +
        '<td>' + (sos.agree ? 'yes — identical tables' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#bmk-sos tbody').html(html);
    root.jQuery('#bmk-sos-note').text('At ' + sos.bits + ' bits the two agree on all '
      + root.Format.exact(1 << sos.bits) + ' entries. The bit loop has to be outside the mask loop: after '
      + 'round b every entry has absorbed the submasks differing only in bits 0…b, and swapping the loops '
      + 'produces a partly relaxed table that looks completely ordinary.');
  }

  function paintFamily(family, tiling, columns) {
    const rows = [
      { problem: 'assignment (n workers, n jobs)', state: 'set of jobs already filled',
        answer: root.Format.exact(family.assignment.cost),
        checked: family.assignment.cost === family.assignmentBrute
          ? 'every assignment enumerated, and it agrees' : 'EXHAUSTIVE ENUMERATION DISAGREES' },
      { problem: 'domino tilings of a 2 × ' + columns + ' board',
        state: 'the frontier of filled cells',
        answer: root.Format.exact(tiling.tilings),
        checked: 'a 2 × k board has Fibonacci(k + 1) tilings' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.problem + '</td><td>' + row.state + '</td>' +
        '<td class="mono">' + row.answer + '</td><td>' + row.checked + '</td></tr>';
    }).join('');

    root.jQuery('#bmk-family tbody').html(html);
    root.jQuery('#bmk-family-note').text('The assignment state does not need the worker index: it is '
      + '`popcount(mask)`, because workers are filled in order. Spotting that takes the state space from '
      + 'n·2^n to 2^n, and it is the kind of observation that decides whether a bitmask DP fits in memory. '
      + 'The tiling board is kept two rows deep because the state is 2^rows — a 2 × 12 board is four '
      + 'states and a 12 × 2 board is 4 096.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
