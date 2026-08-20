/**
 * Section: selection and order statistics.
 *
 * The demo exists to put three constants next to each other, because the
 * whole subject is constants rather than exponents: quickselect is about 2n,
 * median of medians is about 8n, and sorting is n log n. All three are
 * "linear or better in the sense that matters", and the ranking between them
 * is decided by which constant you are paying and whether you need a
 * guarantee.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'selection-and-order';
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

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Quickselect is quicksort that recurses into one side only, and that single change is the whole ' +
          'result. Quicksort\'s recurrence is T(n) = 2T(n/2) + n, which sums to n log n because every level ' +
          'still handles the whole array. Quickselect\'s is T(n) = T(n/2) + n, which sums to 2n because the ' +
          'work halves at every level. Measured on 20 000 random elements - the mean of seven pivot seeds, ' +
          'because a single run is one sample of an expectation - it costs 2.99 comparisons per element to ' +
          'find the median, where sorting the same array and indexing it costs 12.99.',
        'Median of medians is the guarantee, and its constant is the reason people are surprised by it. Split ' +
          'into groups of five, take each group\'s median, recursively select the median of those, and use ' +
          'that as the pivot: it provably discards at least 3n/10 elements per step, so the worst case is ' +
          'linear. The measured cost is 8.10 comparisons per element at 20 000 and 8.27 at 80 000 - flat, and ' +
          'about 2.7 times quickselect\'s expected cost, paid on every input to remove a worst case most ' +
          'workloads never see. It is the right choice when an adversary picks your input and the wrong one ' +
          'otherwise.',
        'The question usually asked is not "the k-th smallest" but "the top k", and those have different ' +
          'answers. A bounded max-heap of size k is one pass, O(n log k), and never needs the array in memory ' +
          '- so it is the streaming answer, and the one that works when n does not fit. Quickselect is O(n) ' +
          'and needs the whole array and permutes it. Neither dominates: the heap wins on a stream, the ' +
          'select wins on an array, and "sort then take k" is fine until it is not.'
      ],
      demo: {
        title: 'Interactive demo — three constants, one element to find',
        markup: root.SelectionAndOrderTemplate.render()
      },
      diagram: {
        title: 'Diagram — median of medians, groups of five',
        caption: 'The chosen pivot is greater than 3 elements in at least half the groups, so at least 3n/10 ' +
          'of the array is discarded whichever way the partition falls. That is the guarantee.',
        definition: [
          'flowchart TD',
          '    A["n elements"] --> B["split into ⌈n/5⌉ groups of five"]',
          '    B --> C["sort each group — 6 comparisons each, in place"]',
          '    C --> D["collect the ⌈n/5⌉ medians"]',
          '    D --> E["recursively select the median of the medians"]',
          '    E --> F["partition the whole array around it"]',
          '    F --> G["at least 3n/10 discarded — recurse on at most 7n/10"]'
        ].join('\n')
      },
      insight: '"Sort then take the k-th" is O(n log n) and is usually the right answer, because it is one ' +
        'line and the log factor is a factor of about four at twenty thousand elements rather than a factor ' +
        'of a thousand. The moment it stops being the right answer is when the sort is the hot path and k is a ' +
        'single element - and then the answer is quickselect, not a faster sort. Reaching for a cleverer sort ' +
        'to answer a selection question is the mistake: the problem is not that the sort is slow, it is that ' +
        'you are computing an order you asked one question about.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SelectionAndOrderTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const METHODS = [
    { id: 'quickselect', label: 'quickselect', bound: 'expected 2n, worst case n²' },
    { id: 'median-of-medians', label: 'median of medians', bound: 'worst case ~10n' },
    { id: 'introselect', label: 'introselect', bound: 'expected 2n, worst case linear' },
    { id: 'sort-then-index', label: 'sort, then index', bound: 'n log₂ n always' }
  ];

  /* Quickselect's cost is an *expectation* over pivot choices, and a single
     run is a single sample from a wide distribution - one unlucky seed
     reports 7n where the expectation is near 2n. Averaging over several pivot
     seeds is what makes the reported constant the quantity the analysis is
     about, and the run count travels with it in the note. */
  const PIVOT_SEEDS = [3, 11, 17, 29, 41, 53, 67];

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const values = root.SortLab.input(parts[1], Number(parts[2]), 7);
    const k = Math.min(values.length - 1, Math.max(0,
      Math.floor((Number(parts[3]) / 100) * (values.length - 1))));
    const expected = values.slice().sort(function (a, b) { return a - b; });

    let comparisons = 0;
    let discarded = 0;
    let wrong = 0;
    let value;

    PIVOT_SEEDS.forEach(function (seed) {
      const ops = root.SortOps.create({});
      const found = selectWith(parts[0], values.slice(), k, ops, seed);
      comparisons += ops.stats().comparisons;
      discarded += found.report ? (found.report.discarded || 0) : 0;
      if (values.length && found.value !== expected[k]) wrong += 1;
      value = found.value;
    });

    const runs = PIVOT_SEEDS.length;
    return {
      comparisons: Math.round(comparisons / runs),
      perElement: values.length ? comparisons / runs / values.length : 0,
      discarded: Math.round(discarded / runs),
      wrong: wrong, runs: runs,
      size: values.length, k: k, value: value
    };
  });

  function selectWith(method, list, k, ops, seed) {
    if (!list.length) return { value: undefined, report: null };
    if (method === 'median-of-medians') return root.Selection.medianOfMedians(list, k, ops);
    if (method === 'introselect') {
      return root.Selection.introSelect(list, k, ops, { random: root.Random.seeded(seed) });
    }
    if (method === 'sort-then-index') {
      list.sort(function (a, b) { return ops.cmp(a, b); });
      return { value: list[k], report: null };
    }
    return root.Selection.quickSelect(list, k, ops, { random: root.Random.seeded(seed) });
  }

  function update(app) {
    const values = panel.values();
    const key = values['sel-method'] + '|' + values['sel-shape'] + '|' + values['sel-size'] + '|' + values['sel-k'];
    const chosen = runFor(key);

    paintMetrics(chosen);
    paintMethods(values, chosen);
    paintGrowth(values);
    paintTopK(values);
    drawArray(values);
  }

  function paintMetrics(chosen) {
    root.MetricGrid.update({
      'sel-comparisons': {
        value: root.Format.exact(chosen.comparisons),
        note: 'mean of ' + chosen.runs + ' runs, element ' + root.Format.exact(chosen.k) +
          ' of ' + root.Format.exact(chosen.size)
      },
      'sel-per-element': {
        value: root.Format.fixed(chosen.perElement) + 'n',
        note: 'the constant, which is what the analysis is really about'
      },
      'sel-discarded': {
        value: root.Format.exact(chosen.discarded),
        note: chosen.discarded ? 'never looked at again' : 'this method does not discard'
      },
      'sel-wrong': { value: root.Format.exact(chosen.wrong), note: 'over all ' + chosen.runs + ' runs, against a full sort' }
    });
  }

  function paintMethods(values, chosen) {
    const html = METHODS.map(function (method) {
      const run = runFor(method.id + '|' + values['sel-shape'] + '|' + values['sel-size'] + '|' + values['sel-k']);
      return '<tr' + (method.id === values['sel-method'] ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + method.label + '</td>' +
        '<td class="mono">' + root.Format.exact(run.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.fixed(run.perElement) + 'n</td>' +
        '<td>' + method.bound + '</td>' +
        '<td class="mono">' + run.wrong + '</td></tr>';
    }).join('');

    root.jQuery('#sel-methods tbody').html(html);
    root.jQuery('#sel-methods-note').text('Every row answers the same question about the same array and gets ' +
      'the same answer — the wrong column is the check that says so. Each figure is the mean of seven runs ' +
      'with different pivot seeds, because quickselect\'s cost is an expectation and one run is one sample ' +
      'from a wide distribution. What differs is the constant in front of n, and that is the entire content ' +
      'of the comparison. Move the k slider to 0 or 100 and watch quickselect get cheaper: selecting the ' +
      'minimum discards almost everything at the first partition, while selecting the median discards half.');
  }

  function paintGrowth(values) {
    const html = [5000, 20000, 80000].map(function (size) {
      const quick = runFor('quickselect|' + values['sel-shape'] + '|' + size + '|50');
      const guaranteed = runFor('median-of-medians|' + values['sel-shape'] + '|' + size + '|50');
      const sorted = runFor('sort-then-index|' + values['sel-shape'] + '|' + size + '|50');
      return '<tr><td class="mono">' + root.Format.exact(size) + '</td>' +
        '<td class="mono">' + root.Format.fixed(quick.perElement) + 'n</td>' +
        '<td class="mono">' + root.Format.fixed(guaranteed.perElement) + 'n</td>' +
        '<td class="mono">' + root.Format.fixed(sorted.perElement) + 'n</td>' +
        '<td class="mono">' + root.Format.fixed(sorted.comparisons / Math.max(1, quick.comparisons), 1) +
        '×</td></tr>';
    }).join('');

    root.jQuery('#sel-growth tbody').html(html);
    root.jQuery('#sel-growth-note').text('The two selection columns stay flat as n grows and the sorting ' +
      'column does not — that is the difference between linear and n log n, seen as a constant that holds ' +
      'and a constant that creeps. The last column is what you actually save by asking the right question: ' +
      'it grows slowly, which is why "sort then index" survives so long before anybody notices.');
  }

  function paintTopK(values) {
    const source = root.SortLab.input(values['sel-shape'], Math.min(20000, Number(values['sel-size'])), 7);
    const reference = source.slice().sort(function (a, b) { return a - b; });

    const html = [10, 100, 1000].map(function (k) {
      const bounded = k <= source.length ? k : source.length;
      const heapOps = root.SortOps.create({});
      const heap = root.Selection.topK(source, bounded, heapOps);

      const selectOps = root.SortOps.create({});
      const list = source.slice();
      root.Selection.partialSort(list, bounded, selectOps, { random: root.Random.seeded(3) });

      const sortOps = root.SortOps.create({});
      source.slice().sort(function (a, b) { return sortOps.cmp(a, b); });

      const agree = JSON.stringify(heap) === JSON.stringify(reference.slice(0, bounded))
        && JSON.stringify(list.slice(0, bounded)) === JSON.stringify(reference.slice(0, bounded));

      return '<tr><td class="mono">' + root.Format.exact(bounded) + '</td>' +
        '<td class="mono">' + root.Format.exact(heapOps.stats().comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(selectOps.stats().comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(sortOps.stats().comparisons) + '</td>' +
        '<td>' + (agree ? 'yes' : '<strong>no</strong>') + '</td></tr>';
    }).join('');

    root.jQuery('#sel-topk tbody').html(html);
    root.jQuery('#sel-topk-note').text('All three produce the identical top k — the agree column checks it ' +
      'against a full sort. The heap is O(n log k) and the select is O(n), so the select wins and wins by ' +
      'more as k grows. The heap wins anyway whenever the data is a stream rather than an array, because it ' +
      'only ever holds k elements and quickselect needs all n of them at once. That is a memory argument, ' +
      'not a comparison-count one, and it is usually the one that decides.');
  }

  function drawArray(values) {
    const source = root.SortLab.input(values['sel-shape'], 240, 7);
    const k = Math.min(source.length - 1, Math.floor((Number(values['sel-k']) / 100) * (source.length - 1)));
    const list = source.slice();
    const ops = root.SortOps.create({});
    const pivot = list[Math.floor(list.length / 2)];
    const bounds = root.Selection.partitionThreeWay(list, 0, list.length, pivot, ops);
    const keepsLeft = k < bounds.left;

    arrayView = root.ArrayView.bars(root.jQuery('#sel-array')[0], {
      height: 240,
      values: list,
      regions: [
        { from: 0, to: bounds.left, role: keepsLeft ? 'less' : 'discarded' },
        { from: bounds.left, to: bounds.right, role: 'equal' },
        { from: bounds.right, to: list.length, role: keepsLeft ? 'discarded' : 'greater' }
      ],
      markers: [{ at: k, label: 'k', role: 'pivot' }],
      summary: 'One partition: k is at ' + k + ', so the ' + (keepsLeft ? 'right' : 'left') +
        ' side is discarded without being looked at again.'
    });

    const discarded = keepsLeft ? list.length - bounds.left : bounds.left;
    root.jQuery('#sel-array-note').text('One partition of 240 elements around the middle value. The marker is ' +
      'k. Everything shaded grey is on the wrong side of the partition to contain the k-th smallest, so a ' +
      'select discards it immediately — ' + discarded + ' of 240 elements gone after one pass, and never ' +
      'examined again. A sort would have to order that side too. Discarding rather than recursing is the ' +
      'entire difference between 2n and n log n.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
