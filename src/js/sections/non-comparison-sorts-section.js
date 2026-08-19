/**
 * Section: non-comparison sorting.
 *
 * Two tables carry the section. The first prices counting sort by its key
 * range rather than by n, which is the constraint people forget. The second
 * runs the same LSD radix sort with a stable and an unstable digit pass over
 * a narrow and a wide key range - and shows that with one meaningful pass the
 * damage is invisible and with four it destroys the output.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'non-comparison-sorts';
  let panel = null;
  let histogram = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (histogram) histogram.redraw();
    });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'The Ω(n log n) bound is a statement about a *model*, not about sorting. It says an algorithm that ' +
          'learns about its input only by comparing pairs needs that many comparisons, because a decision tree ' +
          'with n! leaves has depth at least log₂(n!). Counting sort and radix sort do not compare anything: ' +
          'they read the key as an index, or as a sequence of digits. The demo below reports zero comparisons ' +
          'for every radix run, and that is not a measurement error - it is what escaping the model means.',
        'What they pay instead is a constraint on the key. Counting sort allocates one counter per possible ' +
          'value, so the memory is decided by the key range and not by n: sorting a thousand values with ' +
          'byte-sized keys needs a 1 024-byte table and beats a comparison sort, and sorting a thousand ' +
          '32-bit integers the same way needs 17 179 869 184 bytes. Radix sort fixes that by processing the ' +
          'key a digit at a time - 8 bits gives 256 buckets and four passes over 32-bit keys - which turns a ' +
          'memory problem into a pass-count problem.',
        'LSD radix has a precondition that is easy to state and easy to break: every digit pass must be ' +
          'stable. The pass on digit 1 must leave elements with equal digit-1 values in the order digit 0 put ' +
          'them, or everything the earlier passes established is undone. It is one line - scatter backwards ' +
          'through the input while decrementing the bucket cursor, not forwards - and the demo runs both. With ' +
          'a narrow key range only one pass matters and the unstable version still produces sorted output ' +
          'with the ties reordered; with a wide range four passes matter and the output is simply wrong.'
      ],
      demo: {
        title: 'Interactive demo — digit widths, key ranges, and the pass that must be stable',
        markup: root.NonComparisonSortsTemplate.render()
      },
      diagram: {
        title: 'Diagram — one LSD radix pass',
        caption: 'Count, prefix-sum, scatter. The scatter walks the input backwards so that equal digits keep ' +
          'the order the previous pass gave them, which is the whole of LSD\'s correctness.',
        definition: [
          'flowchart TD',
          '    A["for each element: count[digit(x)]++"] --> B["prefix sums: count[i] += count[i-1]"]',
          '    B --> C["walk the input BACKWARDS"]',
          '    C --> D["slot = digit(x); count[slot]--; out[count[slot]] = x"]',
          '    D --> E{"more digits?"}',
          '    E -- yes --> A',
          '    E -- no --> F["sorted"]',
          '    C --> G["walking forwards instead reverses every tie — and undoes every earlier pass"]'
        ].join('\n')
      },
      insight: 'Radix sort is stable-or-broken, and the failure is graded by how many passes actually matter. ' +
        'Sort 32-bit keys that all happen to fit in a byte and an unstable digit pass produces correctly ' +
        'ordered output with the ties scrambled - which nobody notices. Widen the keys so four passes carry ' +
        'information and the same code produces output that is not sorted at all. That means a radix sort can ' +
        'pass its tests on small keys and fail in production on large ones, from a single line that decides ' +
        'whether the scatter loop counts up or down.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.NonComparisonSortsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function keysFor(size, logRange, seed) {
    const random = root.Random.seeded(seed || 3);
    const span = Math.pow(2, logRange);
    const out = new Array(size);
    for (let i = 0; i < size; i += 1) out[i] = random.int(span);
    return out;
  }

  const runFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const values = keysFor(Number(parts[1]), Number(parts[2]), 3);
    const list = values.slice();
    const ops = root.SortOps.create({});
    const bits = Number(parts[3]);
    const unstable = parts[4] === 'unstable';
    const report = runAlgorithm(parts[0], list, ops, bits, unstable);

    let wrong = 0;
    const expected = values.slice().sort(function (a, b) { return a - b; });
    for (let i = 0; i < expected.length; i += 1) {
      if (list[i] !== expected[i]) wrong += 1;
    }
    return { report: report, stats: ops.stats(), wrong: wrong, size: values.length, values: values };
  });

  function runAlgorithm(name, list, ops, bits, unstable) {
    if (name === 'msd') {
      return root.RadixSort.msdRadixSort(list, ops,
        { bits: bits, insertionSort: root.SortsElementary.insertionSort });
    }
    if (name === 'flag') return root.RadixSort.americanFlagSort(list, ops, { bits: bits });
    if (name === 'counting') return root.RadixSort.countingSort(list, ops, {});
    if (name === 'bucket') {
      return root.RadixSort.bucketSort(list, ops, { insertionSort: root.SortsElementary.insertionSort });
    }
    return root.RadixSort.lsdRadixSort(list, ops, { bits: bits, unstable: unstable });
  }

  function update(app) {
    const values = panel.values();
    const key = values['ncs-algorithm'] + '|' + values['ncs-size'] + '|' + values['ncs-range'] + '|' +
      values['ncs-bits'] + '|' + values['ncs-stable'];
    const chosen = runFor(key);

    paintMetrics(chosen, values);
    paintWidths(values);
    paintCounting(values);
    paintStability(values);
    drawHistogram(chosen, values);
  }

  function paintMetrics(chosen, values) {
    const bits = Number(values['ncs-bits']);
    const buckets = Math.pow(2, bits);
    const passes = chosen.report.passes === undefined
      ? (chosen.report.recursions === undefined ? 1 : chosen.report.recursions)
      : chosen.report.passes;

    root.MetricGrid.update({
      'ncs-comparisons': {
        value: root.Format.exact(chosen.stats.comparisons),
        note: chosen.stats.comparisons === 0 ? 'no key was ever compared with another' : 'from the insertion fallback'
      },
      'ncs-moves': {
        value: root.Format.exact(chosen.stats.moves),
        note: root.Format.fixed(chosen.stats.moves / Math.max(1, chosen.size)) + ' per element'
      },
      'ncs-passes': { value: root.Format.exact(passes), note: 'over ' + root.Format.exact(chosen.size) + ' elements' },
      'ncs-table': {
        value: root.Format.bytes(buckets * 4),
        note: root.Format.exact(buckets) + ' counters of 4 bytes'
      }
    });
  }

  function paintWidths(values) {
    const html = [4, 8, 11, 16].map(function (bits) {
      const run = runFor('lsd|' + values['ncs-size'] + '|' + values['ncs-range'] + '|' + bits + '|stable');
      const buckets = Math.pow(2, bits);
      return '<tr' + (bits === Number(values['ncs-bits']) ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + bits + ' bits</td>' +
        '<td class="mono">' + root.Format.exact(buckets) + '</td>' +
        '<td class="mono">' + Math.ceil(32 / bits) + '</td>' +
        '<td class="mono">' + root.Format.exact(buckets * 4) + ' B</td>' +
        '<td class="mono">' + root.Format.exact(run.stats.moves) + '</td>' +
        '<td class="mono">' + run.wrong + '</td></tr>';
    }).join('');

    root.jQuery('#ncs-widths tbody').html(html);
    root.jQuery('#ncs-widths-note').text('A wider digit is fewer passes and a bigger counter table, and the ' +
      'trade is decided by the cache rather than by the arithmetic: 8 bits gives 256 counters that stay ' +
      'resident, and 16 bits gives 65 536 that do not. The move count in this table only counts passes that ' +
      'actually did something - a pass whose every key lands in one bucket is skipped, which is why keys ' +
      'narrower than 32 bits cost fewer passes than the column suggests.');
  }

  function paintCounting(values) {
    const size = Number(values['ncs-size']);
    const html = [8, 16, 20, 24, 32].map(function (logRange) {
      const range = Math.pow(2, logRange);
      const cost = root.RadixSort.countingCost(range, size);
      return '<tr' + (logRange === Number(values['ncs-range']) ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">2^' + logRange + '</td>' +
        '<td class="mono">' + root.Format.exact(cost.tableBytes) + ' B</td>' +
        '<td class="mono">' + root.Format.exact(cost.countingOperations) + '</td>' +
        '<td class="mono">' + root.Format.exact(Math.round(cost.comparisonOperations)) + '</td>' +
        '<td>' + (cost.wins ? 'counting sort' : 'a comparison sort') + '</td></tr>';
    }).join('');

    root.jQuery('#ncs-counting tbody').html(html);
    root.jQuery('#ncs-counting-note').text('Counting sort costs n + k operations and k counters, where k is ' +
      'the key range and has nothing to do with n. That is why it is unbeatable on byte-sized keys and ' +
      'unusable on 32-bit ones: the table alone is 17 GB. The crossover moves with n — sorting more elements ' +
      'makes a large table worth amortising — which is the actual rule, rather than "counting sort needs ' +
      'small keys".');
  }

  function paintStability(values) {
    const size = Math.min(4000, Number(values['ncs-size']));
    const html = [8, 20].map(function (logRange) {
      const meaningful = Math.ceil(logRange / Number(values['ncs-bits']));
      const bits = Number(values['ncs-bits']);
      const stable = stabilityCheck(size + '|' + logRange + '|' + bits + '|stable');
      const unstable = stabilityCheck(size + '|' + logRange + '|' + bits + '|unstable');
      return '<tr><td class="mono">2^' + logRange + '</td>' +
        '<td class="mono">' + meaningful + '</td>' +
        '<td>' + describe(stable) + '</td>' +
        '<td>' + describe(unstable) + '</td></tr>';
    }).join('');

    root.jQuery('#ncs-stability tbody').html(html);
    root.jQuery('#ncs-stability-note').text('The same code with the scatter loop reversed, over a narrow and a ' +
      'wide key range. With one meaningful pass the unstable version still returns sorted output and only the ' +
      'tie order is wrong — invisible unless something downstream depends on it. With several meaningful ' +
      'passes each pass undoes the last and the output is not sorted at all. A radix sort tested on small ' +
      'keys and deployed on large ones fails exactly here.');
  }

  function describe(result) {
    if (!result.sorted) return '<strong>not sorted</strong>';
    return result.stable ? 'sorted, ties kept' : 'sorted, <strong>ties reordered</strong>';
  }

  const stabilityCheck = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const size = Number(parts[0]);
    const bits = Number(parts[2]);
    const unstable = parts[3] === 'unstable';
    const random = root.Random.seeded(7);
    const span = Math.pow(2, Number(parts[1]));
    const items = [];
    for (let i = 0; i < size; i += 1) items.push({ key: random.int(span), at: i });

    const ops = root.SortOps.create({ key: function (item) { return item.key; } });
    root.RadixSort.lsdRadixSort(items, ops, {
      bits: bits, unstable: unstable, key: function (item) { return item.key; }
    });

    let sorted = true;
    let stable = true;
    for (let i = 1; i < items.length; i += 1) {
      if (items[i - 1].key > items[i].key) sorted = false;
      if (items[i - 1].key === items[i].key && items[i - 1].at > items[i].at) stable = false;
    }
    return { sorted: sorted, stable: stable };
  });

  function drawHistogram(chosen, values) {
    const bits = Number(values['ncs-bits']);
    const buckets = Math.min(64, Math.pow(2, bits));
    const counts = new Array(buckets).fill(0);
    chosen.values.forEach(function (value) {
      counts[(value >>> 0) % buckets] += 1;
    });

    histogram = root.ArrayView.bars(root.jQuery('#ncs-histogram')[0], {
      height: 240,
      values: counts,
      regions: [{ from: 0, to: counts.length, role: 'active' }],
      markers: [],
      summary: 'Bucket occupancy for the low digit: ' + counts.length + ' buckets over ' +
        root.Format.exact(chosen.size) + ' elements.'
    });

    const peak = Math.max.apply(null, counts);
    const mean = chosen.size / counts.length;
    root.jQuery('#ncs-histogram-note').text('How the low digit distributes ' + root.Format.exact(chosen.size) +
      ' elements over ' + counts.length + ' buckets: the fullest holds ' + root.Format.exact(peak) +
      ' against a mean of ' + root.Format.fixed(mean, 1) + '. A radix pass does not care how even this is — ' +
      'it is a counting pass either way. Bucket sort does: its whole complexity argument assumes the bars are ' +
      'level, and a skewed key distribution puts everything in one bucket and degrades to whatever sorts it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
