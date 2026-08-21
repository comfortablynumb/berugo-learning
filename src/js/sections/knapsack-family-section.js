/**
 * Section: the knapsack family.
 *
 * Two things this page refuses to say without measuring.
 *
 * "Space reduction is free" - it is not. The one-row version returns the same
 * value and cannot reconstruct, and the table on the page reports the chosen
 * set as *verified* or not, using `DpKnapsack.verify`, so the difference is a
 * column rather than a warning.
 *
 * "The knapsack DP is polynomial" - it is polynomial in the capacity's
 * *value*. The bits table shows the cell count multiplying by ten each time the
 * capacity gains a decimal digit while the input grows by about 3.3 bits,
 * which is what "weakly NP-hard" means with the phrase removed.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'knapsack-family';
  const TABLE_ITEMS = 10;
  const TABLE_CAPACITY = 24;
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the two incoming edges to a 0/1 knapsack cell',
      caption: 'Every cell is the better of "do not take item i" - the cell directly above - and "take it" ' +
        '- the cell one row up and `weight(i)` columns left, plus its value. Two edges, which is why the ' +
        'complexity is items x capacity and not something larger.',
      definition: [
        'flowchart RL',
        '    C["best[i][c]"] --> S["best[i-1][c] — skip item i"]',
        '    C --> T["best[i-1][c - w_i] + v_i — take item i"]',
        '    S --> M["whichever is larger"]',
        '    T --> M',
        '    M --> K["and remember WHICH, or the traceback has nothing to walk"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'The 0/1 knapsack state is (items considered, capacity remaining) and each cell has two incoming ' +
          'edges, so the cost is items × capacity. That product is the whole analysis, and it is available ' +
          'before writing anything - which is the habit 12.1 argues for, applied.',
        '**Collapsing the table to one row keeps the value and destroys the answer.** Iterating the capacity ' +
          'downwards means each item is read from the previous row and used once; iterating upwards means it ' +
          'is read from the row being written and used unboundedly - one character between 0/1 and unbounded ' +
          'knapsack. Either way the reconstruction has nowhere to walk, and a solver that keeps its traceback ' +
          'code returns an item list that does not add up to its own answer. The demo verifies the chosen ' +
          'set rather than trusting it.',
        '**Bounded knapsack is where the expansion strategy shows up as two orders of magnitude.** Expanding ' +
          '40 copies of an item into 40 separate rows is correct and wasteful; binary splitting bundles ' +
          '1, 2, 4, … copies so any count from 0 to 40 is a subset of six bundles; the monotonic-deque ' +
          'version removes the dependence on the copy count entirely. All three return the same value, and ' +
          'the transitions column is the reason to prefer the third.',
        '**Pseudo-polynomial is a statement about which input you measure.** O(n·C) is linear in the ' +
          'capacity written as a number and exponential in the capacity written as *digits*, which is how ' +
          'inputs are actually sized. Add one decimal digit to the capacity and the table gets ten times ' +
          'bigger while the input file gets three characters longer. That is the sense in which knapsack ' +
          'is hard, and it is why a capacity of 10^9 is not a large number but is an impossible table.'
      ],
      demo: {
        title: 'Interactive demo — the table, the space trade, and the capacity in bits',
        markup: root.KnapsackFamilyTemplate.render()
      },
      diagram: diagram(),
      insight: 'Whenever a DP is space-reduced, decide *first* whether the caller needs the answer or only ' +
        'its value, and write that decision down next to the code. Reduced tables are the single most common ' +
        'place where a correct optimum ships beside a reconstruction that quietly stopped being valid, ' +
        'because the value keeps agreeing with the tests and the item list is only ever eyeballed. If the ' +
        'answer is needed and the memory is not affordable, the technique is Hirschberg\'s - divide the ' +
        'problem at the midpoint and recompute - not a traceback over a table that no longer exists.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.KnapsackFamilyTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const instanceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[2]);
    const items = [];

    for (let i = 0; i < parts[0]; i += 1) {
      items.push({ id: i, value: 10 + random.int(90), weight: 2 + random.int(18) });
    }
    return { items: items, capacity: parts[1] };
  });

  const runFor = root.Helpers.memoise(function (key) {
    const instance = instanceFor(key);
    const full = root.DpKnapsack.knapsack01(instance.items, instance.capacity, {});
    const rolling = root.DpKnapsack.knapsack01Rolling(instance.items, instance.capacity, {});
    return { instance: instance, full: full, rolling: rolling,
      brute: root.DpKnapsack.bruteForce(instance.items, instance.capacity),
      subset: root.DpKnapsack.subsetSum(instance.items.map(function (item) { return item.weight; }),
        Math.floor(instance.capacity / 2), {}),
      partition: root.DpKnapsack.equalPartition(
        instance.items.map(function (item) { return item.weight; }), {}) };
  });

  const boundedFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = instanceFor(parts.slice(1).join('|'));
    const copies = Number(parts[0]);
    const items = instance.items.slice(0, 6).map(function (item) {
      return { value: item.value, weight: item.weight, count: copies };
    });
    return {
      naive: root.DpKnapsack.boundedNaive(items, instance.capacity, {}),
      binary: root.DpKnapsack.boundedBinary(items, instance.capacity, {}),
      queue: root.DpKnapsack.boundedQueue(items, instance.capacity, {})
    };
  });

  /* The drawn table is pinned small on purpose: a 400-column knapsack table
     is unreadable, and the point of drawing it at all is the two incoming
     edges, which are visible at ten items. */
  const smallFor = root.Helpers.memoise(function (key) {
    const instance = instanceFor(key);
    const items = instance.items.slice(0, TABLE_ITEMS).map(function (item) {
      return { value: item.value, weight: 1 + (item.weight % 8) };
    });
    return { items: items, run: root.DpKnapsack.knapsack01(items, TABLE_CAPACITY, {}) };
  });

  function keyFor(values) {
    return values['knp-items'] + '|' + values['knp-capacity'] + '|' + values['knp-seed'];
  }

  function update() {
    const values = panel.values();
    const run = runFor(keyFor(values));

    paintMetrics(run);
    paintTable(smallFor(keyFor(values)));
    paintSpace(run);
    paintBounded(boundedFor(values['knp-copies'] + '|' + keyFor(values)));
    paintBits(run);
    paintSubset(run);
  }

  function paintMetrics(run) {
    const bits = root.DpKnapsack.bitCost(run.instance.items.length, run.instance.capacity);

    root.MetricGrid.update({
      'knp-value': {
        value: root.Format.exact(run.full.value),
        note: run.full.value === run.brute.value ? 'exhaustive enumeration agrees'
          : 'EXHAUSTIVE ENUMERATION DISAGREES'
      },
      'knp-cells': { value: root.Format.exact(run.full.report.cells),
        note: (run.instance.items.length + 1) + ' × ' + (run.instance.capacity + 1) },
      'knp-row': { value: root.Format.exact(run.rolling.report.cells),
        note: root.Format.fixed(run.full.report.cells / run.rolling.report.cells, 1) + '× less memory' },
      'knp-bits': { value: String(bits.bits),
        note: 'the capacity is ' + String(run.instance.capacity).length + ' digits long' }
    });
  }

  function paintTable(small) {
    const table = small.run.table;
    const path = tracebackCells(small.items, small.run.chosen, TABLE_CAPACITY);
    const active = { row: small.items.length, column: TABLE_CAPACITY };
    const depends = root.DpTableView.knapsackDepends(active.row, active.column,
      small.items[small.items.length - 1].weight);

    root.jQuery('#knp-table').html(root.DpTableView.markup({
      table: table,
      corner: 'i \\ c',
      rowLabels: ['—'].concat(small.items.map(function (item, i) {
        return 'i' + i + ' (w' + item.weight + ' v' + item.value + ')';
      })),
      path: path, depends: depends, active: [active]
    }));
    root.jQuery('#knp-table-note').text('Ten items and a capacity of ' + TABLE_CAPACITY + ', pinned small '
      + 'so the structure is visible. Green is the traceback: the cells the chosen items were decided at. '
      + 'Amber is the two cells the highlighted answer came from — directly above is "skip", and '
      + small.items[small.items.length - 1].weight + ' columns left of that is "take".');
  }

  /** The cells a traceback actually visits, so the drawn path is the walk the
   *  chosen set came from rather than a second walk that could disagree. */
  function tracebackCells(items, chosen, capacity) {
    const taken = new Set(chosen);
    const cells = [];
    let c = capacity;

    for (let i = items.length; i > 0; i -= 1) {
      cells.push({ row: i, column: c });

      if (!taken.has(i - 1)) continue;
      c -= items[i - 1].weight;
    }
    cells.push({ row: 0, column: c });
    return cells;
  }

  function paintSpace(run) {
    const fullCheck = root.DpKnapsack.verify(run.instance.items, run.instance.capacity,
      run.full.chosen, run.full.value);
    const rows = [
      { label: 'full table', value: run.full.value, cells: run.full.report.cells,
        reconstruction: run.full.chosen.length + ' items',
        verified: fullCheck.fits && fullCheck.matches ? 'weight ' + fullCheck.weight + ' ≤ '
          + run.instance.capacity + ', value ' + fullCheck.value : 'FAILED' },
      { label: 'one row, descending', value: run.rolling.value, cells: run.rolling.report.cells,
        reconstruction: 'none — the rows it would walk no longer exist',
        verified: 'not applicable' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' + root.Format.exact(row.value) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.cells) + '</td>' +
        '<td>' + row.reconstruction + '</td><td>' + row.verified + '</td></tr>';
    }).join('');

    root.jQuery('#knp-space tbody').html(html);
    root.jQuery('#knp-space-note').text('Identical values, ' +
      root.Format.fixed(run.full.report.cells / run.rolling.report.cells, 1) + '× the memory, and only one '
      + 'of them can say which items. The one-row variant returns `chosen: null` rather than a plausible '
      + 'list, because the plausible list is the bug this whole section is about.');
  }

  function paintBounded(bounded) {
    const rows = [
      { label: 'expand every copy', run: bounded.naive },
      { label: 'binary splitting', run: bounded.binary },
      { label: 'monotonic deque', run: bounded.queue }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.value) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.expanded) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.transitions) + '</td>' +
        '<td>' + (row.run.value === bounded.naive.value ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#knp-bounded tbody').html(html);
    root.jQuery('#knp-bounded-note').text('Six item types with the selected copy count each. The deque '
      + 'version does not expand at all — its cost is independent of how many copies exist, which is why '
      + 'its "items after expansion" column reads the number of item *types*.');
  }

  function paintBits(run) {
    const capacities = [10, 100, 1000, 10000, 100000];
    let previous = null;
    const html = capacities.map(function (capacity) {
      const bits = root.DpKnapsack.bitCost(run.instance.items.length, capacity);
      const growth = previous === null ? '—' : root.Format.fixed(bits.cells / previous, 1) + '×';
      previous = bits.cells;
      return '<tr><td class="mono">' + root.Format.exact(capacity) + '</td>' +
        '<td class="mono">' + String(capacity).length + '</td>' +
        '<td class="mono">' + bits.bits + '</td>' +
        '<td class="mono">' + root.Format.exact(bits.cells) + '</td>' +
        '<td class="mono">' + growth + '</td></tr>';
    }).join('');

    root.jQuery('#knp-bitcost tbody').html(html);
    root.jQuery('#knp-bitcost-note').text('One extra digit on the capacity multiplies the table by ten and '
      + 'lengthens the input by one character — about 3.3 bits. A running time that multiplies by ten when '
      + 'the input grows by 3.3 bits is exponential in the input size, which is exactly what '
      + '"pseudo-polynomial" is a polite name for.');
  }

  function paintSubset(run) {
    const weights = run.instance.items.map(function (item) { return item.weight; });
    const target = Math.floor(run.instance.capacity / 2);
    const chosenSum = run.subset.chosen.reduce(function (total, i) { return total + weights[i]; }, 0);
    const html = '<tr><td>can a subset weigh exactly ' + target + '?</td>' +
      '<td class="mono">' + (run.subset.reachable ? 'yes' : 'no') + '</td>' +
      '<td class="mono">' + (run.subset.reachable ? run.subset.chosen.length + ' items' : '—') + '</td>' +
      '<td>' + (run.subset.reachable
        ? (chosenSum === target ? 'the witness sums to ' + chosenSum : 'WITNESS SUMS TO ' + chosenSum)
        : 'no witness to check') + '</td></tr>' +
      '<tr><td>can the weights be split into two equal halves?</td>' +
      '<td class="mono">' + (run.partition.equal ? 'yes' : 'no') + '</td>' +
      '<td class="mono">' + run.partition.bestHalf + ' against ' + run.partition.total + '</td>' +
      '<td>closest achievable split differs by ' + run.partition.difference + '</td></tr>';

    root.jQuery('#knp-subset tbody').html(html);
    root.jQuery('#knp-subset-note').text('Both are the same recurrence as the knapsack with the value '
      + 'column deleted: reachability instead of optimisation. Equal partition reports the closest split '
      + 'it could reach rather than only yes or no, because "no" with no number attached tells a caller '
      + 'nothing about how close the instance was.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
