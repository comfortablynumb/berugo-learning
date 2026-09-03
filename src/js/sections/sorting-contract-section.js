/**
 * Section: the sorting contract.
 *
 * The demo is a table rather than an animation, because the claim being made
 * is a comparison and a comparison needs columns. Four elementary sorts run
 * over the identical input and report four genuinely different cost profiles:
 * selection sort's comparison count never moves, insertion sort's collapses
 * on ordered input, bubble sort's move count is enormous and selection's is
 * almost nothing.
 *
 * The second table is the one that changes minds. It hands a broken
 * comparator to `Array.prototype.sort` - the real one - and shows what comes
 * back. Nothing throws.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'sorting-contract';
  let panel = null;
  let arrayView = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (arrayView) arrayView.redraw();
    });
  }

  function diagram() {
    return {
        title: 'Diagram — choosing a sort from the properties of the input',
        caption: 'Every branch here is a property of the data or of the caller\'s requirements, not of the ' +
          'algorithm. That is the point: the algorithm is the answer, and the questions come first.',
        definition: [
          'flowchart TD',
          '    A["what do you know about the input?"] --> B{"must equal elements keep their order?"}',
          '    B -- yes --> C{"is it nearly sorted already?"}',
          '    B -- no --> D{"many duplicate keys?"}',
          '    C -- yes --> E["insertion sort, or Timsort at scale"]',
          '    C -- no --> F["a stable merge sort"]',
          '    D -- yes --> G["three-way quicksort"]',
          '    D -- no --> H{"is the key a small integer?"}',
          '    H -- yes --> I["counting or radix sort"]',
          '    H -- no --> J["introsort / pdqsort"]'
        ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**A sort is not one operation with one cost.** It is a contract with four independent ' +
          'clauses: is it stable, is it in place, is it adaptive, and what does it assume about ' +
          'the comparator? Every algorithm in this milestone satisfies a different subset.',
        'Selection sort does exactly n(n−1)/2 = 1 999 000 comparisons on 2 000 elements, whether ' +
          'they arrive sorted, reversed or shuffled. Insertion sort does 1 999 on the sorted one ' +
          'and 993 838 on the random one. Same two algorithms, same data — and the ranking ' +
          'between them depends entirely on the shape of the input.',
        'Stability is the clause that is load-bearing and invisible. A stable sort leaves equal ' +
          'elements in the order it found them. That is what makes "sort by date, then sort by ' +
          'author" produce authors in date order rather than a scramble.',
        'Insertion and bubble sort are stable because they only ever move an element past ' +
          'something strictly greater. Selection sort is not: it swaps the minimum in from a ' +
          'distance and throws whatever was there over its equals. That is a three-line ' +
          'difference in the code, and a different guarantee for every caller.',
        'The comparator is the clause with teeth. A comparison sort assumes a strict weak ' +
          'ordering — irreflexive on equality, antisymmetric, transitive. C++ calls a violation ' +
          'undefined behaviour, and Java throws "Comparison method violates its general ' +
          'contract". JavaScript does neither. It returns an array, the array is not sorted, and ' +
          'nothing was logged. The demo below runs four broken comparators through the ' +
          'platform\'s own sort to show exactly what comes back.'
      ],
      demo: {
        title: 'Interactive demo — four sorts, one input, and a comparator that lies',
        markup: root.SortingContractTemplate.render()
      },
      diagram: diagram(),
      insight: 'An inconsistent comparator is undefined behaviour in C++ and an exception in ' +
        'Java. In JavaScript it is a wrong answer with no diagnostic at all. `(a, b) => a > b` is ' +
        'the common form. It returns `true` or `false`, `false` becomes 0, and the sort is told ' +
        'that half the pairs it asked about are equal. The result is an array that is *nearly* ' +
        'sorted, which is the worst possible outcome, because it survives a glance. Write ' +
        'comparators that return a number — and if a sort ever produces something almost right, ' +
        'suspect the comparator before the algorithm.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SortingContractTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const ELEMENTARY = ['insertion', 'selection', 'bubble', 'shell'];

  const rowsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.SortLab.compare({
      kind: parts[0], size: Number(parts[1]), seed: 3, algorithms: ELEMENTARY
    });
  });

  const comparatorsFor = root.Helpers.memoise(function () {
    return root.SortLab.comparatorReport({ size: 40, seed: 5 });
  });

  const selectionFor = root.Helpers.memoise(function (key) {
    const size = Number(key);
    return size * (size - 1) / 2;
  });

  function update(app) {
    const values = panel.values();
    const rows = rowsFor(values['soc-shape'] + '|' + values['soc-size']);

    paintMetrics(rows, values['soc-size']);
    paintElementary(rows);
    paintComparators(values['soc-comparator']);
    drawArray(app, values);
  }

  function paintMetrics(rows, size) {
    const counts = rows.map(function (row) { return row.comparisons; });
    const best = Math.min.apply(null, counts);
    const worst = Math.max.apply(null, counts);
    const cheapest = rows.filter(function (row) { return row.comparisons === best; })[0];
    const dearest = rows.filter(function (row) { return row.comparisons === worst; })[0];

    root.MetricGrid.update({
      'soc-best': { value: root.Format.exact(best), note: cheapest.label + ' on this shape' },
      'soc-worst': { value: root.Format.exact(worst), note: dearest.label + ' on the same input' },
      'soc-spread': {
        value: root.Format.fixed(worst / Math.max(1, best), 1) + '×',
        note: 'the same data, two elementary sorts'
      },
      'soc-selection': {
        value: root.Format.exact(selectionFor(String(size))),
        note: 'n(n−1)/2, identical on every shape'
      }
    });
  }

  function paintElementary(rows) {
    const html = rows.map(function (row) {
      const stable = row.unstable === 0;
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.moves) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.swaps) + '</td>' +
        '<td>' + (row.claimsStable ? 'yes' : 'no') + (row.claimsStable === stable ? '' : ' *') + '</td>' +
        '<td>' + (row.algorithm === 'selection' ? 'no' : 'yes') + '</td>' +
        '<td class="mono">' + row.wrong + '</td></tr>';
    }).join('');

    root.jQuery('#soc-elementary tbody').html(html);
    root.jQuery('#soc-elementary-note').text('Read the comparison and move columns as two separate budgets. ' +
      'Selection sort does the most comparisons of any sort here and the fewest moves of any sort here, which ' +
      'is the right trade when an element is a kilobyte and a key is an integer. Switch the shape to "already ' +
      'sorted" and watch insertion and bubble collapse to one comparison per element while selection does not ' +
      'move at all - adaptivity is a property of the algorithm, and only two of these four have it.');
  }

  function paintComparators(chosen) {
    const rows = comparatorsFor('all');
    const html = rows.map(function (row) {
      return '<tr' + (row.name === chosen ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + row.label + '</td>' +
        '<td>' + (row.threw ? 'yes' : 'no') + '</td>' +
        '<td>' + (row.sorted ? 'yes' : '<strong>no</strong>') + '</td>' +
        '<td class="mono">' + row.outOfOrderPairs + '</td>' +
        '<td class="mono">' + row.axiomViolations + '</td>' +
        '<td class="mono">' + row.sample.join(', ') + '</td></tr>';
    }).join('');

    root.jQuery('#soc-comparator-table tbody').html(html);
    const selected = rows.filter(function (row) { return row.name === chosen; })[0];
    root.jQuery('#soc-comparator-table-note').text('Every row is a real call to Array.prototype.sort with that ' +
      'comparator, on the same 40 numbers. Not one of them throws. The selected row - ' + selected.label +
      ' - left ' + selected.outOfOrderPairs + ' adjacent pairs out of order and broke ' +
      selected.axiomViolations + ' of the ordering axioms over a sample of pairs and triples. ' + selected.note);
  }

  function drawArray(app, values) {
    const source = root.SortLab.input(values['soc-shape'], Math.min(400, Number(values['soc-size'])), 3);
    const ops = root.SortOps.create({});
    const working = source.slice();
    const sortedTo = insertionPrefix(working, ops, Math.floor(working.length / 3));

    arrayView = root.ArrayView.bars(root.jQuery('#soc-array')[0], {
      height: 240,
      values: working,
      regions: [{ from: 0, to: sortedTo, role: 'sorted' }],
      markers: [{ at: sortedTo, label: 'i', role: 'active' }],
      summary: 'The array part-way through an insertion sort: the first ' + sortedTo +
        ' elements are sorted among themselves, and everything to the right is untouched.'
    });

    root.jQuery('#soc-array-note').text('An insertion sort stopped one third of the way through. The green ' +
      'prefix is sorted and the marker is the element about to be placed - which is the invariant the whole ' +
      'algorithm maintains, and the reason it costs one comparison per element on input that is already in ' +
      'order: the element about to be placed is already where it belongs, and the inner loop never runs.');
  }

  /** Insertion sort stopped after `steps` placements, so the picture is a
   *  state of the algorithm rather than a finished array. */
  function insertionPrefix(array, ops, steps) {
    const limit = Math.max(1, Math.min(steps, array.length));
    for (let i = 1; i < limit; i += 1) {
      const key = array[i];
      let j = i - 1;
      while (j >= 0 && ops.cmp(array[j], key) > 0) { ops.write(array, j + 1, array[j]); j -= 1; }
      ops.write(array, j + 1, key);
    }
    return limit;
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
