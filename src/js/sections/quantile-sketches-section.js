/**
 * Section: quantile sketches.
 *
 * The stream is deliberately bimodal, because that is where the two kinds of
 * guarantee separate. A rank-accurate sketch can be 23% wrong about the *value*
 * at p90 while being 0.27 percentage points wrong about the *rank*, simply
 * because the quantile function is nearly vertical between the two modes. Both
 * numbers are in the demo, and reporting only one of them makes three of the
 * four sketches look either perfect or broken.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'quantile-sketches';
  const HEADLINE = [0.5, 0.9, 0.99, 0.999];
  const GUARANTEES = {
    reservoir: 'a uniform sample — no bound at all on any single quantile',
    't-digest': 'no formal bound; centroids sized to be small at both tails',
    kll: 'rank error within ε of the true rank, with ε ≈ 1/k',
    ddsketch: 'the value within a relative α of the true value'
  };
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
        'An average latency answers a question nobody asked. On the bimodal stream in the demo the ' +
          'mean sits at 58 ms, the median at 21 ms and the 99th percentile at 739 ms: the mean is ' +
          'not the typical experience and it is not the bad one either, it is an artefact of mixing ' +
          'them. Exact quantiles need the values sorted, and keeping 200 000 doubles to answer "what ' +
          'is p99" costs 1.6 MB per stream per window.',
        'Four sketches, four different bargains. A reservoir keeps k values uniformly and is honest ' +
          'in the middle and useless in the tail — 1 000 samples hold one observation past p99.9, so ' +
          'the answer there is a single measurement and reads 38.8% low. t-digest sizes its centroids ' +
          'by a scale function that keeps them tiny at both ends, so its rank error at p99.9 is 0.013 ' +
          'percentage points from 944 bytes. KLL gives a proven rank bound. DDSketch buckets values ' +
          'logarithmically and guarantees the *value* to within a relative α.',
        'The distinction the section is built on is which of those two errors a guarantee is about. ' +
          'An SLO is written in values — "p99 under 250 ms" — and only DDSketch bounds that: it is ' +
          'within 0.53% everywhere here at α = 1%. t-digest and KLL bound the rank, and on a stream ' +
          'with a gap between two modes a tiny rank error lands a long way away in value: t-digest is ' +
          '0.267 percentage points out at p90 and that is a 23.6% error in milliseconds.'
      ],
      demo: { title: 'Interactive demo — four sketches on one latency stream', markup: root.QuantileSketchesTemplate.render() },
      diagram: {
        title: 'Diagram — t-digest centroids, fine at the tails and coarse in the middle',
        caption: 'The scale function k(q) = δ/2π · asin(2q − 1) is flat near q = 0.5 and steep at both ' +
          'ends, so a centroid may absorb many points in the middle and few at the edges.',
        definition: [
          'flowchart LR',
          '    S["sorted values"] --> C1["q ≈ 0.001<br/>centroid holds 4 points"]',
          '    S --> C2["q ≈ 0.05<br/>holds 180"]',
          '    S --> C3["q ≈ 0.50<br/>holds 6 200"]',
          '    S --> C4["q ≈ 0.95<br/>holds 180"]',
          '    S --> C5["q ≈ 0.999<br/>holds 4"]',
          '    C1 --> Q["p99.9 interpolates<br/>between two small centroids"]',
          '    C5 --> Q',
          '    C3 --> M["p50 interpolates<br/>inside one large one"]'
        ].join('\n')
      },
      insight: 'Averaging p99s across shards is meaningless, and this section is the one to point at ' +
        'when someone builds a dashboard that does it. With eight shards where one is degraded, the ' +
        'mean of the per-shard p99s reads 17.4% *below* the true global p99 — it hides the outage ' +
        'rather than showing it. Merging the sketches instead lands within 0.95%, and that is the ' +
        'only reason to care whether a quantile sketch is mergeable.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.QuantileSketchesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function gridOf() {
    const out = [];
    for (let i = 1; i <= 30; i += 1) out.push(1 - Math.pow(10, -1 - 2 * (i / 30)));
    return HEADLINE.concat(out).sort(function (a, b) { return a - b; });
  }

  const comparisons = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.SketchLab.quantileCompare({
      values: root.StreamLab.latency({ length: parts[0], seed: 11, slowShare: parts[1] / 100 }),
      quantiles: gridOf(),
      reservoirSize: parts[2],
      compression: parts[3],
      k: 200,
      alpha: parts[4],
      seed: 4
    });
  });

  /* The shard panel depends on alpha alone, and it builds eight streams. */
  const shardRuns = root.Helpers.memoise(function (key) {
    return root.SketchLab.shardQuantiles({
      shards: 8, perShardLength: 25000, p: 0.99, alpha: Number(key), seed: 11
    });
  });

  function update(app) {
    const values = panel.values();
    const comparison = comparisons([
      values['qsk-length'], values['qsk-slow'], values['qsk-reservoir'],
      values['qsk-compression'], Number(values['qsk-alpha'])
    ].join('|'));
    const shards = shardRuns(values['qsk-alpha']);

    paintMetrics(comparison);
    paintTable(comparison);
    paintRank(comparison);
    paintShards(shards);
    draw(app, comparison);
  }

  function answerAt(row, p) {
    return row.answers.filter(function (answer) { return Math.abs(answer.p - p) < 1e-12; })[0];
  }

  function paintMetrics(comparison) {
    const tail = comparison.rows.map(function (row) {
      return { label: row.label, relative: Math.abs(answerAt(row, 0.999).relative), bytes: row.bytes };
    }).sort(function (a, b) { return a.relative - b.relative; });
    const cheapest = comparison.rows.slice().sort(function (a, b) { return a.bytes - b.bytes; })[0];

    const exactP99 = comparison.exact.filter(function (entry) {
      return Math.abs(entry.p - 0.99) < 1e-12;
    })[0];

    root.MetricGrid.update({
      'qsk-p99': {
        value: root.Format.fixed(exactP99.value, 1) + ' ms',
        note: 'every value kept and sorted — the answer the sketches are scored against'
      },
      'qsk-best': {
        value: tail[0].label,
        note: root.Format.percent(tail[0].relative, 2) + ' off, ' + root.Format.bytes(tail[0].bytes)
      },
      'qsk-worst': {
        value: tail[tail.length - 1].label,
        note: root.Format.percent(tail[tail.length - 1].relative, 2) + ' off, ' +
          root.Format.bytes(tail[tail.length - 1].bytes)
      },
      'qsk-memory': {
        value: root.Format.bytes(comparison.exactBytes),
        note: root.Format.fixed(comparison.exactBytes / cheapest.bytes, 0) + '× the cheapest sketch (' +
          cheapest.label + ', ' + root.Format.bytes(cheapest.bytes) + ')'
      }
    });
  }

  function paintTable(comparison) {
    const rows = comparison.rows.map(function (row) {
      const cells = HEADLINE.map(function (p) {
        const answer = answerAt(row, p);
        return '<td class="mono">' + root.Format.fixed(answer.value, 1) + '<br><span class="note">' +
          root.Format.percent(answer.relative, 2) + '</span></td>';
      }).join('');
      return '<tr><td>' + row.label + '</td><td class="mono">' + root.Format.bytes(row.bytes) + '</td>' +
        cells + '</tr>';
    }).join('');

    const exactCells = HEADLINE.map(function (p) {
      const entry = comparison.exact.filter(function (e) { return Math.abs(e.p - p) < 1e-12; })[0];
      return '<td class="mono">' + root.Format.fixed(entry.value, 1) + '</td>';
    }).join('');

    root.jQuery('#qsk-table tbody').html(
      '<tr style="font-weight:600"><td>exact</td><td class="mono">' +
      root.Format.bytes(comparison.exactBytes) + '</td>' + exactCells + '</tr>' + rows
    );
    root.jQuery('#qsk-table-note').text('Milliseconds on the first line of each cell, relative error ' +
      'on the second. Move the slow-mode share to 0% and the p90 column collapses to near-zero error ' +
      'for everything — the gap between the modes is what the disagreement is made of, not the ' +
      'sketches.');
  }

  function paintRank(comparison) {
    const rows = comparison.rows.map(function (row) {
      const worstValue = row.answers.reduce(function (worst, answer) {
        return Math.max(worst, Math.abs(answer.relative));
      }, 0);
      const worstRank = row.answers.reduce(function (worst, answer) {
        return Math.max(worst, Math.abs(answer.rank));
      }, 0);
      return '<tr><td>' + row.label + '</td>' +
        '<td>' + GUARANTEES[row.id] + '</td>' +
        '<td class="mono">' + root.Format.percent(worstValue, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(worstRank * 100, 3) + ' pp</td></tr>';
    }).join('');

    root.jQuery('#qsk-rank tbody').html(rows);
    root.jQuery('#qsk-rank-note').text('Read the last two columns as separate claims. t-digest\'s rank ' +
      'error is a fraction of a percentage point everywhere and its worst value error is large, ' +
      'because between the two modes a hair of rank is a long way in milliseconds. DDSketch is the ' +
      'reverse: its rank error is incidental and its value error is the thing it promises. An SLO is ' +
      'written in the second column\'s units.');
  }

  function paintShards(shards) {
    root.jQuery('#qsk-shards').text([
      'eight shards, seven healthy (' + root.Format.percent(shards.healthyShare, 0) +
        ' slow requests) and one degraded (' + root.Format.percent(shards.degradedShare, 0) + ')',
      '',
      'per-shard p99: ' + shards.perShard.map(function (row) {
        return root.Format.fixed(row.quantile, 0);
      }).join('  '),
      '',
      'mean of the per-shard p99s:      ' + root.Format.fixed(shards.averaged, 1) + ' ms   (' +
        root.Format.percent(shards.averagedError, 2) + ')',
      'DDSketches merged, then queried: ' + root.Format.fixed(shards.merged, 1) + ' ms   (' +
        root.Format.percent(shards.mergedError, 2) + ')',
      'true global p99:                 ' + root.Format.fixed(shards.truth, 1) + ' ms'
    ].join('\n'));

    root.jQuery('#qsk-shards-note').text('The averaged number is not a worse estimate of the global ' +
      'p99 — it is an estimate of nothing. Seven shards drag it down and the degraded one is one ' +
      'value in eight, so the dashboard reads ' +
      root.Format.percent(Math.abs(shards.averagedError), 1) + ' *below* the latency users are ' +
      'actually seeing, exactly when it matters. The merge is a bucket-wise addition and lands ' +
      'inside the sketch\'s stated α.');
  }

  function draw(app, comparison) {
    const series = comparison.rows.map(function (row) {
      return {
        label: row.label,
        points: row.answers.map(function (answer) {
          return { x: answer.p, y: Math.abs(answer.relative) * 100 };
        })
      };
    });

    chart = root.ErrorBandView.curve(root.jQuery('#qsk-error-chart')[0], {
      lazyLib: app.lazyLib,
      height: 280,
      series: series,
      legendHost: root.jQuery('#qsk-error-legend')[0],
      xLabel: 'quantile',
      yLabel: 'absolute relative value error (%)',
      xFormat: function (value) { return 'p' + (value * 100).toFixed(1); },
      summary: function () {
        return 'Absolute relative error in the returned value, quantile by quantile, for four ' +
          'sketches on the same bimodal latency stream.';
      }
    });

    root.jQuery('#qsk-error-note').text('The spike every curve except DDSketch shows is the boundary ' +
      'between the two modes, where the quantile function is nearly vertical. DDSketch is flat across ' +
      'the whole range because its buckets are multiplicative: the guarantee is on the value, so a ' +
      'steep region costs it nothing.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
