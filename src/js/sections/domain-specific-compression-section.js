/**
 * Section: domain-specific compression.
 *
 * Two measurements carry this section. The first is that SORTING the column is
 * worth more than the encoding choice: the same encoder on the same values,
 * sorted and shuffled, differs by nearly four times — which is why columnar
 * formats care so much about clustering keys and why "which codec" is the
 * second question.
 *
 * The second is Gorilla's dependence on the mantissa. A metric stored at full
 * double precision compresses 1.3×; the same metric rounded to the precision it
 * is actually measured at compresses over ten times. That is a fact about IEEE
 * 754 rather than about the encoder, and it is the difference between a
 * time-series store that works and one that does not.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'domain-specific-compression';
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
      title: 'Diagram — choosing an encoding from what the column is',
      caption: 'A columnar writer knows things a general-purpose compressor cannot see: whether ' +
        'the column is sorted, how many distinct values it holds, whether it is a timestamp or a ' +
        'measurement. Each of those facts selects an encoding, and the selection is worth more ' +
        'than any amount of entropy coding afterwards. The branch that matters most is the first ' +
        'one: sorting a column changes which branch every later question takes.',
      definition: [
        'flowchart TD',
        '    C["a column"] --> S{"is it sorted?"}',
        '    S -->|yes| D["delta code first<br/>gaps are small, so everything after is cheap"]',
        '    S -->|no, but it could be| SORT["sort it — usually worth more than the encoding choice"]',
        '    S -->|no, and order matters| K{"what type?"}',
        '    D --> K',
        '    K -->|integers| I["varint / bit-pack / frame-of-reference / Simple-8b"]',
        '    K -->|low-cardinality strings| DICT["dictionary, then run-length on the codes"]',
        '    K -->|floats from a sensor| G["Gorilla XOR — and check the precision first"]',
        '    K -->|anything else| GP["a general-purpose codec, and measure it"]'
      ].join('\n')
    };
  }

  function orientationIntegers() {
    return [
      '**A general-purpose compressor sees bytes. A columnar writer knows what the column means.** ' +
        'Sorted timestamps, low-cardinality labels and a metric that barely moves are each worth ' +
        'more than any amount of Huffman coding.',
      'Each of those facts selects a representation, rather than coding a bad one better.',
      '**Delta coding is the first move on anything ordered.** Sorted timestamps become gaps of ' +
        'one to four.',
      'The demo measures the same column at 8 bytes per value raw, and well under one after delta ' +
        'plus a variable-length code.',
      '**Zigzag is what makes delta safe for signed values.** Mapping −1 to 1 and 1 to 2 keeps ' +
        'small magnitudes small.',
      'Without it a two’s-complement −1 would be all ones, and cost ten varint bytes.',
      '**Bit-packing is one width for the whole block, so a single outlier costs everything.** ' +
        'Frame-of-reference fixes it by subtracting a block minimum and re-choosing the width per ' +
        'block.',
      'Simple-8b goes further and re-chooses per 64-bit word.'
    ];
  }

  function orientationColumns() {
    return [
      '**Sorting the column is usually worth more than the encoding choice.** The demo runs the ' +
        'identical encoder on the identical values, sorted and shuffled, and the delta-based ' +
        'encodings differ by nearly four times.',
      'That is why columnar formats care about clustering keys, and it is the first thing to try.',
      '**A dictionary plus run-length coding is the whole story for a label column**, and the run ' +
        'count depends entirely on whether the column is sorted.',
      'The demo shows a five-distinct-value column going from over sixteen hundred runs to five.',
      '**Gorilla XORs consecutive doubles and stores only the bits between the leading and ' +
        'trailing zeros.** It works because IEEE 754 puts the exponent and the high mantissa at ' +
        'the top of the word.',
      'Those are the parts that do not change on a slowly-varying metric.',
      '**Gorilla’s ratio is a fact about the mantissa, not about the encoder.** A metric stored at ' +
        'full double precision compresses about 1.3×.',
      'The same metric rounded to the precision it is genuinely measured at compresses over ten ' +
        'times. Store what you measured, not what the float type can hold.'
    ];
  }

  function orientation() {
    return orientationIntegers().concat(orientationColumns());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — integer columns, label columns and float series',
        markup: root.DomainSpecificTemplate.render()
      },
      diagram: diagram(),
      insight: '**Sorting before encoding is often worth more than the encoding choice, which is ' +
        'why columnar formats care so much about clustering keys.** The Gorilla rows carry a ' +
        'second habit worth taking away. Check what precision your data actually has before ' +
        'storing it. A gauge that reports to one decimal place, held in a double, has fifty-odd ' +
        'mantissa bits of noise in it. Every one of those bits defeats the XOR window, turns a ' +
        'ten-times ratio into a one-point-three, and costs storage forever. Rounding to the ' +
        'measured precision is not lossy in any meaningful sense. It is declining to store ' +
        'digits that were never measured.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DomainSpecificTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const integersFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.ColumnarLab.integerStudy({ count: Number(parts[0]), seed: Number(parts[1]) });
  });

  const sortingFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.ColumnarLab.sortingStudy({ count: Number(parts[0]), seed: Number(parts[1]) });
  });

  const cardinalityFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.ColumnarLab.cardinalityStudy({ count: Number(parts[0]) * 2,
      seed: Number(parts[1]) });
  });

  const floatsFor = root.Helpers.memoise(function (key) {
    return root.ColumnarLab.floatStudy({ count: Number(key) });
  });

  function update(app) {
    const values = panel.values();
    const key = values['dsc-count'] + '|' + values['dsc-seed'];

    paintMetrics(integersFor(key), sortingFor(key), floatsFor(values['dsc-count']));
    paintChart(app, sortingFor(key));
    paintIntegers(integersFor(key));
    paintCardinality(cardinalityFor(key));
    paintFloats(floatsFor(values['dsc-count']));
  }

  function bestRow(column) {
    return column.rows.reduce(function (best, row) {
      return row.bytes < best.bytes ? row : best;
    }, column.rows[0]);
  }

  function paintMetrics(integers, sorting, floats) {
    const sorted = integers[0];
    const best = bestRow(sorted);
    const bestGain = sorting.rows.reduce(function (most, row) {
      return row.gain > most.gain ? row : most;
    }, sorting.rows[0]);
    const rounded = floats.filter(function (row) { return row.name === 'rounded to 0.1'; })[0];
    const full = floats.filter(function (row) {
      return row.name === 'random walk, full precision';
    })[0];

    root.MetricGrid.update({
      'dsc-best': { value: root.Format.fixed(best.ratio, 1) + '×',
        note: best.name + ', at ' + root.Format.fixed(best.bitsPerValue, 2) + ' bits per value' },
      'dsc-sorting': { value: root.Format.fixed(bestGain.gain, 2) + '×',
        note: bestGain.name + ': ' + root.Format.exact(bestGain.sortedBytes) +
          ' bytes sorted against ' + root.Format.exact(bestGain.shuffledBytes) + ' shuffled' },
      'dsc-gorilla': { value: root.Format.fixed(rounded.ratio, 2) + '×',
        note: 'the same walk at full double precision: ' +
          root.Format.fixed(full.ratio, 2) + '×' },
      'dsc-exact': { value: floats.filter(function (row) { return row.exact; }).length + ' of ' +
        floats.length,
      note: 'every series returns bit-for-bit — Gorilla is lossless' }
    });
  }

  function paintChart(app, sorting) {
    const host = root.jQuery('#dsc-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 240, yMin: 0,
      xLabel: 'encoding (in table order)', yLabel: 'bytes',
      series: [
        { label: 'sorted', points: sorting.rows.map(function (row, i) {
          return { x: i, y: row.sortedBytes };
        }) },
        { label: 'shuffled — identical values, identical encoder',
          points: sorting.rows.map(function (row, i) {
            return { x: i, y: row.shuffledBytes };
          }) }
      ]
    });

    const best = sorting.rows.reduce(function (most, row) {
      return row.gain > most.gain ? row : most;
    }, sorting.rows[0]);
    root.Helpers.setText('dsc-chart-note',
      'The same ' + root.Format.exact(sorting.values) + ' values through the same six encoders, ' +
      'twice: once sorted and once shuffled. The two lines are identical at the left — a raw ' +
      'array and a varint do not care about order — and diverge sharply once delta coding ' +
      'enters, because a sorted column has small gaps and a shuffled one has large signed ones. ' +
      'The widest gap is ' + best.name + ' at ' + root.Format.fixed(best.gain, 2) +
      '×. That is one property of the data being worth more than every encoding decision on the ' +
      'x axis, which is the argument for clustering keys in a columnar store.');
  }

  function paintIntegers(columns) {
    root.jQuery('#dsc-integers tbody').html(columns.map(function (column) {
      const best = bestRow(column);

      return '<tr><td>' + column.column + '</td>' +
        column.rows.map(function (row) {
          return '<td class="mono">' + root.Format.exact(row.bytes) + '</td>';
        }).join('') +
        '<td>' + best.name.replace('delta + ', '') + '</td></tr>';
    }).join(''));

    const sorted = columns[0];
    const shuffled = columns[1];
    root.Helpers.setText('dsc-integers-note',
      'The first two rows are the same values in a different order, and every delta-based ' +
      'column differs by a factor: ' + root.Format.exact(bestRow(sorted).bytes) +
      ' bytes sorted against ' + root.Format.exact(bestRow(shuffled).bytes) + ' shuffled. The ' +
      'last row is the case for frame-of-reference and Simple-8b: a column of large but similar ' +
      'values packs as if it were small once the block minimum is subtracted, and one outlier ' +
      'costs a block or a word rather than the whole column. Bit-packing is the counter-example ' +
      'in the same row — one width for everything, so the widest value sets the price for all of ' +
      'them.');
  }

  function paintCardinality(rows) {
    root.jQuery('#dsc-cardinality tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.cardinality) +
        '</td><td class="mono">' + row.width + ' bits</td><td class="mono">' +
        root.Format.exact(row.dictionaryBytes) + '</td><td class="mono">' +
        root.Format.exact(row.runsUnsorted) + '</td><td class="mono">' +
        root.Format.exact(row.runsSorted) + '</td><td class="mono">' +
        root.Format.exact(row.rleUnsortedBytes) + '</td><td class="mono">' +
        root.Format.exact(row.rleSortedBytes) + '</td></tr>';
    }).join(''));

    const low = rows[0];
    const high = rows[rows.length - 1];
    root.Helpers.setText('dsc-cardinality-note',
      'A dictionary turns a string column into small integers and its width is the logarithm of ' +
      'the cardinality — ' + low.width + ' bits at ' + root.Format.exact(low.cardinality) +
      ' distinct values and ' + high.width + ' at ' + root.Format.exact(high.cardinality) +
      '. The two run columns are where sorting reappears: at ' +
      root.Format.exact(low.cardinality) + ' distinct values an unsorted column has ' +
      root.Format.exact(low.runsUnsorted) + ' runs and a sorted one has ' +
      root.Format.exact(low.runsSorted) + '. At the bottom of the table the cardinality equals ' +
      'the row count, the dictionary stops helping, and no amount of sorting recovers it — which ' +
      'is why a high-cardinality column is the one that dominates a columnar file’s size.');
  }

  function paintFloats(rows) {
    root.jQuery('#dsc-floats tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' +
        root.Format.exact(row.rawBytes) + '</td><td class="mono">' +
        root.Format.exact(row.bytes) + '</td><td class="mono">' +
        root.Format.fixed(row.bitsPerValue, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 2) + '×</td><td class="mono">' +
        (row.exact ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    const full = rows[0];
    const rounded = rows[1];
    const constant = rows.filter(function (row) { return row.name === 'constant'; })[0];
    const noise = rows[rows.length - 1];
    root.Helpers.setText('dsc-floats-note',
      'The first two rows are the SAME random walk, and the only difference is that the second ' +
      'is rounded to one decimal place — the precision such a metric is actually measured at. ' +
      'The ratio goes from ' + root.Format.fixed(full.ratio, 2) + '× to ' +
      root.Format.fixed(rounded.ratio, 2) + '×, a factor of ' +
      root.Format.fixed(rounded.ratio / full.ratio, 1) + ', because every low mantissa bit that ' +
      'moves widens the XOR window and costs a bit per sample forever. The constant row shows ' +
      'the ceiling at ' + root.Format.fixed(constant.ratio, 0) + '× — one control bit per value ' +
      '— and the noise row shows the floor at ' + root.Format.fixed(noise.ratio, 2) +
      '×. Every row round-trips exactly: this is a lossless encoding, and the rounding in row ' +
      'two is a decision about what to store rather than something the codec did.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
