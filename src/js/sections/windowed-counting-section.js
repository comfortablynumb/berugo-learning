/**
 * Section: windows, decay and top-k over streams.
 *
 * Two queries that sound trivial and are not. "How many ones in the last N"
 * has a lower bound of Ω(N) bits for an exact answer, so DGIM gives up
 * exactness and keeps O(log² N) - 600 bits against 20 000, at a worst measured
 * error of 26%. "Top talkers in the last five minutes" is the same shape and
 * space-saving is the answer: 200 counters, every genuinely heavy key present,
 * and a per-key error bound the caller can read.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'windowed-counting';
  const PER_SIZES = [2, 4, 8, 16];
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Counting the ones in the last N positions of a stream exactly needs Ω(N) bits, because the ' +
          'algorithm has to be able to tell every one of the 2^N possible windows apart. DGIM gives ' +
          'up exactness instead: it keeps buckets of sizes 1, 2, 4, … each stamped with the position ' +
          'of its most recent one, allows at most two buckets of any size, and counts every bucket ' +
          'fully inside the window plus half of the one straddling the edge. Twenty buckets, 600 ' +
          'bits, against 20 000 for the exact ring — and a worst measured error of 26.1%.',
        'The bucket allowance is the dial. Allowing four buckets per size halves the error to 12.9% ' +
          'and doubles the memory to 1 230 bits; sixteen brings it to 3.0% at 4 350. The bound comes ' +
          'from one place — only the oldest bucket is uncertain, and with r buckets of every smaller ' +
          'size it can be at most a 1/2r fraction of the total — so the trade is a single geometric ' +
          'knob rather than a family of algorithms.',
        'The keyed version of the same question is "which keys are hot right now", and space-saving ' +
          'answers it in m counters with no hashing at all. A key that is not monitored takes over ' +
          'the *smallest* counter and inherits its value as a recorded error, so every reported count ' +
          'is an upper bound with known slack, and every key whose true frequency exceeds N/m is ' +
          'guaranteed to be in the table. Lossy counting is the mirror image: it under-estimates, by ' +
          'at most εN, and it also never misses a frequent key.'
      ],
      demo: { title: 'Interactive demo — a window, its buckets and the hot keys', markup: root.WindowedCountingTemplate.render() },
      diagram: {
        title: 'Diagram — DGIM buckets merging as the window slides',
        caption: 'A third bucket of size 1 forces the two oldest to merge into a single bucket of ' +
          'size 2, which keeps the count of buckets logarithmic in N.',
        definition: [
          'flowchart TD',
          '    A["… 1 1 · · 1 · 1 1"] --> B["buckets, newest first"]',
          '    B --> B1["size 1 @ t=99"]',
          '    B --> B2["size 1 @ t=98"]',
          '    B --> B3["size 2 @ t=95"]',
          '    B --> B4["size 4 @ t=88"]',
          '    B --> B5["size 8 @ t=71 (straddles the edge)"]',
          '    B1 --> N["a new 1 arrives → three of size 1"]',
          '    N --> M["merge the two oldest → one of size 2"]',
          '    B5 --> E["estimate = 1+1+2+4 + 8/2 = 12"]'
        ].join('\n')
      },
      insight: '"Top talkers in the last five minutes" is the single most requested streaming query in ' +
        'operations, and it has an exact-space-impossible proof behind it. Space-saving is the answer ' +
        'to reach for — but note what it does *not* do: it counts since the beginning of time, not ' +
        'over a window. Getting "in the last five minutes" as well means either decay, which changes ' +
        'the meaning of the number, or a ring of per-interval sketches, which multiplies the memory ' +
        'by the number of intervals. Decide which of those you actually meant before choosing.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.WindowedCountingTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* Two independent measurements over two different streams. Keyed
     separately so that moving a counter slider does not re-run 200 000
     positions through four DGIM trackers, and vice versa. */
  const windows = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.SketchLab.windowCompare({
      bits: root.StreamLab.binary({ length: Math.max(200000, parts[0] * 5), period: parts[1], seed: 7 }),
      windowSize: parts[0],
      perSizes: PER_SIZES
    });
  });

  const hotKeys = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.SketchLab.streamTopK({
      stream: root.StreamLab.generate({ kind: 'zipf', length: 200000, keys: 50000, skew: 1.1, seed: 5 }),
      counters: parts[0], epsilon: 0.0005, halfLife: parts[1], k: 10, support: 0.001
    });
  });

  function update(app) {
    const values = panel.values();
    const comparison = windows(values['win-size'] + '|' + values['win-period']);
    const topK = hotKeys(values['win-counters'] + '|' + values['win-halflife']);

    const chosen = comparison.rows.filter(function (row) {
      return row.perSize === Number(values['win-persize']);
    })[0] || comparison.rows[0];

    root.MetricGrid.update({
      'win-memory': {
        value: root.Format.exact(chosen.bits) + ' bits',
        note: 'against ' + root.Format.exact(comparison.exactBits) + ' — ' +
          root.Format.fixed(chosen.compression, 1) + '× smaller'
      },
      'win-error': {
        value: root.Format.percent(chosen.worstRelative, 2),
        note: 'over ' + root.Format.exact(comparison.series.length) + ' sampled instants'
      },
      'win-buckets': {
        value: root.Format.exact(chosen.buckets),
        note: 'at most ' + values['win-persize'] + ' of each power-of-two size'
      },
      'win-recall': {
        value: root.Format.percent(topK.spaceSaving.recall, 0),
        note: root.Format.exact(topK.spaceSaving.monitored) + ' counters, ' +
          root.Format.bytes(topK.spaceSaving.bytes)
      }
    });

    paintBuckets(comparison, Number(values['win-persize']));
    paintTopK(topK);
    paintGuarantees(topK, comparison);
    draw(app, comparison, Number(values['win-persize']));
  }

  function paintBuckets(comparison, perSize) {
    const rows = comparison.rows.map(function (row) {
      const current = row.perSize === perSize;
      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + row.perSize + '</td>' +
        '<td class="mono">' + root.Format.exact(row.buckets) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.bits) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.worstRelative, 2) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.statedBound, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.compression, 1) + '×</td></tr>';
    }).join('');

    root.jQuery('#win-buckets-table tbody').html(rows);
    root.jQuery('#win-buckets-table-note').text('The worst-error column halves every time the bucket ' +
      'allowance doubles, and the memory doubles with it — the trade is one clean geometric knob. ' +
      'The "bound it reports now" column is the structure\'s own statement about its current state: ' +
      'half the oldest bucket over the total, which is computable at any instant without the exact ' +
      'answer, and is what a production system would export.');
  }

  function paintTopK(topK) {
    const rows = topK.truth.map(function (row, index) {
      const saving = topK.spaceSaving.rows[index];
      const lossy = topK.lossy.rows[index];
      const decayed = topK.decayed.rows[index];
      return '<tr><td class="mono">' + (index + 1) + '</td>' +
        '<td class="mono">' + row.key + ' — ' + root.Format.exact(row.count) + '</td>' +
        '<td class="mono">' + (saving ? saving.key + ' — ' + root.Format.exact(saving.count) +
          ' (−' + root.Format.exact(saving.error) + ')' : '—') + '</td>' +
        '<td class="mono">' + (lossy ? lossy.key + ' — ' + root.Format.exact(lossy.count) : '—') + '</td>' +
        '<td class="mono">' + (decayed ? decayed.key + ' — ' + root.Format.exact(decayed.value) : '—') + '</td></tr>';
    }).join('');

    root.jQuery('#win-topk tbody').html(rows);
    root.jQuery('#win-topk-note').text('The bracketed figure in the space-saving column is that ' +
      'counter\'s inherited error: the true count lies between count − error and count. The decayed ' +
      'column\'s numbers are smaller because they are a different quantity — a half-life-weighted ' +
      'recent rate, not a total — and comparing them to the exact column is a category error, which ' +
      'is exactly the mistake a dashboard makes when it labels both "count".');
  }

  function paintGuarantees(topK, comparison) {
    root.jQuery('#win-guarantees').text([
      'DGIM, ' + comparison.rows[0].perSize + ' buckets per size',
      '  guarantee:  estimate within a relative 1/2r of the true window count',
      '  memory:     ' + root.Format.exact(comparison.rows[0].bits) + ' bits against ' +
        root.Format.exact(comparison.exactBits) + ' for the exact ring',
      '',
      'space-saving, ' + root.Format.exact(topK.spaceSaving.monitored) + ' counters',
      '  guarantee:  count − error ≤ truth ≤ count, and every key above N/m is monitored',
      '  N/m here:   ' + root.Format.exact(topK.spaceSaving.guaranteedThreshold) + ' occurrences',
      '  worst over-count in the reported top-k: ' + root.Format.exact(topK.spaceSaving.worstOver),
      '  counter takeovers during the run:       ' + root.Format.exact(topK.spaceSaving.replacements),
      '  memory:     ' + root.Format.bytes(topK.spaceSaving.bytes),
      '',
      'lossy counting, ε = 1/' + root.Format.exact(topK.lossy.width),
      '  guarantee:  count ≤ truth ≤ count + εN, and no frequent key is ever dropped',
      '  εN here:    ' + root.Format.exact(topK.lossy.errorBound),
      '  worst under-count in the reported top-k: ' + root.Format.exact(topK.lossy.worstUnder),
      '  memory:     ' + root.Format.bytes(topK.lossy.bytes) + ' for ' +
        root.Format.exact(topK.lossy.monitored) + ' entries',
      '',
      'decayed counters, half-life ' + root.Format.exact(topK.decayed.halfLife) + ' items',
      '  guarantee:  none — it answers a different question',
      '  memory:     ' + root.Format.bytes(topK.decayed.bytes) + ' for ' +
        root.Format.exact(topK.decayed.keys) + ' keys, because decay alone bounds nothing'
    ].join('\n'));

    root.jQuery('#win-guarantees-note').text('Note the last block. Exponential decay changes what ' +
      '"frequent" means and does nothing at all about memory: every key ever seen still has a ' +
      'counter, because a decayed value only reaches zero in the limit. The usable structure is ' +
      'decay *inside* space-saving, so the counters are bounded and the ordering is recent — and ' +
      'that composition is 7.9\'s subject.');
  }

  function draw(app, comparison, perSize) {
    const key = 'p' + perSize;
    const points = comparison.series.map(function (point) {
      return {
        n: point.n,
        truth: point.truth,
        estimate: point[key],
        bound: point.truth * (1 / (2 * perSize))
      };
    });

    chart = root.ErrorBandView.render(root.jQuery('#win-track-chart')[0], {
      lazyLib: app.lazyLib,
      height: 280,
      points: points,
      legendHost: root.jQuery('#win-track-legend')[0],
      truthLabel: 'exact count in the window',
      estimateLabel: 'DGIM estimate',
      bandLabel: '±1/2r of the truth',
      xLabel: 'position in the stream',
      yLabel: 'ones in the last N',
      summary: function () {
        return 'The exact count of ones in the sliding window against DGIM\'s estimate, with the ' +
          'relative bound drawn as a band.';
      }
    });

    const row = comparison.rows.filter(function (entry) { return entry.perSize === perSize; })[0];
    root.jQuery('#win-track-note').text('The estimate is a staircase: it only changes when a bucket ' +
      'expires or a merge moves a boundary, so between those events it holds still while the truth ' +
      'drifts. Worst relative error over the run was ' + root.Format.percent(row.worstRelative, 2) +
      ', from ' + root.Format.exact(row.bits) + ' bits of state.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
