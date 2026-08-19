/**
 * Section: MinHash, SimHash and locality-sensitive hashing.
 *
 * The S-curve panel and the splits table are the section. One signature budget,
 * split three ways, produces three completely different retrieval systems: at
 * 16 bands of 8 rows the curve turns at 0.707 and the index finds 27% of the
 * true duplicate pairs with no false ones; at 32 bands of 4 it turns at 0.420
 * and finds all of them with half the proposals wrong. Neither is correct —
 * the split *is* the false-positive/false-negative decision, made explicit.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'minhash-and-lsh';
  const SPLITS = [
    { bands: 8, rows: 16 }, { bands: 16, rows: 8 }, { bands: 20, rows: 5 },
    { bands: 32, rows: 4 }, { bands: 64, rows: 2 }
  ];
  let panel = null;
  let charts = [];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      charts.forEach(function (chart) { if (chart) chart.redraw(); });
    });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'MinHash rests on one identity. For a random permutation of the universe, the probability that ' +
          'two sets have the same minimum element is exactly their Jaccard similarity, |A ∩ B| / ' +
          '|A ∪ B|. So take L independent hashes, record each one\'s minimum over the set, and the ' +
          'fraction of positions where two signatures agree is an unbiased estimate of that ' +
          'similarity — with standard error 1/√L, which is 8.8% at L = 128 and does not depend on how ' +
          'big the documents are.',
        'Banding turns the estimate into a search. Split the signature into b bands of r rows and ' +
          'call two documents candidates if any whole band matches: P = 1 − (1 − s^r)^b, an S-curve ' +
          'whose steep part sits near (1/b)^(1/r). The same 128-hash signature at 16×8 turns at 0.707 ' +
          'and proposes 3 pairs out of 1 770; at 32×4 it turns at 0.420 and proposes 22. Choosing b ' +
          'and r is choosing where on that curve you want to be wrong.',
        'SimHash answers the cosine question rather than the overlap one: one random hyperplane per ' +
          'output bit, and the fraction of differing bits estimates θ/π. It costs 8 bytes per document ' +
          'against MinHash\'s 512 and it ranks the corpus differently, because two documents can ' +
          'overlap heavily and point in different directions. Random projection is the same idea ' +
          'without the sign step, and Johnson-Lindenstrauss bounds the distortion it introduces.'
      ],
      demo: { title: 'Interactive demo — signatures, bands and the curve you are choosing', markup: root.MinhashAndLshTemplate.render() },
      diagram: {
        title: 'Diagram — the signature matrix split into bands',
        caption: 'A pair is a candidate if any single band matches entirely. More bands means more ' +
          'chances to match, so the curve turns at a lower similarity.',
        definition: [
          'flowchart TD',
          '    S["signature: 128 hashes per document"] --> B1["band 1<br/>rows 1-8"]',
          '    S --> B2["band 2<br/>rows 9-16"]',
          '    S --> BD["…"]',
          '    S --> B16["band 16<br/>rows 121-128"]',
          '    B1 --> H1["hash the 8 values<br/>→ bucket"]',
          '    B2 --> H2["hash the 8 values<br/>→ bucket"]',
          '    B16 --> H16["hash the 8 values<br/>→ bucket"]',
          '    H1 --> C["any shared bucket<br/>→ candidate pair"]',
          '    H2 --> C',
          '    H16 --> C',
          '    C --> V["verify with the exact similarity"]'
        ].join('\n')
      },
      insight: 'Banding turns a similarity threshold into a probability curve you tune; choosing r and ' +
        'b is choosing your false-positive/false-negative split, and the S-curve makes it explicit. ' +
        'The mistake is to pick a signature length first and treat b and r as an implementation ' +
        'detail — they are the whole retrieval policy, and the same 128 hashes will find everything ' +
        'or almost nothing depending on how they are cut up.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MinhashAndLshTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function update(app) {
    const values = panel.values();
    const documents = root.StreamLab.documents({
      groups: values['lsh-groups'], perGroup: 4, words: 60, seed: 3
    });
    const threshold = values['lsh-threshold'] / 100;
    const shingle = Number(values['lsh-shingle']);
    const result = root.SketchLab.deduplicate({
      documents: documents, bands: values['lsh-bands'], rows: values['lsh-rows'],
      threshold: threshold, shingle: shingle, seed: 2
    });
    const simhash = root.SketchLab.simhashCompare({
      documents: documents, bits: 64, shingle: shingle, threshold: threshold, seed: 2
    });
    const projection = root.SketchLab.projectionCheck({
      points: 60, dimensions: 400, target: values['lsh-target'], epsilon: 0.3, seed: 6
    });

    root.MetricGrid.update({
      'lsh-length': {
        value: root.Format.exact(result.signatureLength),
        note: values['lsh-bands'] + ' bands × ' + values['lsh-rows'] + ' rows, ' +
          root.Format.bytes(result.signatureLength * 4) + ' per document'
      },
      'lsh-error': {
        value: root.Format.percent(result.standardError, 2),
        note: 'worst seen over all pairs: ' + root.Format.percent(result.worstEstimateError, 2)
      },
      'lsh-recall': {
        value: root.Format.percent(result.recall, 1),
        note: root.Format.exact(result.truePairs) + ' pairs are genuinely above ' +
          root.Format.percent(threshold, 0)
      },
      'lsh-work': {
        value: root.Format.exact(result.candidates) + ' / ' + root.Format.exact(result.allPairs),
        note: root.Format.percent(1 - result.candidates / Math.max(1, result.allPairs), 1) + ' of the pairs never looked at'
      }
    });

    paintSplits(documents, threshold, shingle, values);
    paintSimhash(simhash, threshold);
    paintProjection(projection);
    charts = [drawCurve(app, result, threshold), drawScatter(app, result, threshold)];
  }

  function paintSplits(documents, threshold, shingle, values) {
    const rows = SPLITS.map(function (split) {
      const result = root.SketchLab.deduplicate({
        documents: documents, bands: split.bands, rows: split.rows,
        threshold: threshold, shingle: shingle, seed: 2
      });
      const current = split.bands === values['lsh-bands'] && split.rows === values['lsh-rows'];
      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + split.bands + ' × ' + split.rows + '</td>' +
        '<td class="mono">' + root.Format.fixed(result.curveThreshold, 3) + '</td>' +
        '<td class="mono">' + root.Format.exact(result.candidates) + '</td>' +
        '<td class="mono">' + root.Format.percent(result.recall, 1) + '</td>' +
        '<td class="mono">' + root.Format.percent(result.precision, 1) + '</td>' +
        '<td class="mono">' + root.Format.percent(1 - result.candidates / Math.max(1, result.allPairs), 1) + '</td></tr>';
    }).join('');

    root.jQuery('#lsh-splits tbody').html(rows);
    root.jQuery('#lsh-splits-note').text('Every row spends the same 128 hashes per document. The top ' +
      'row misses nearly everything and never proposes a wrong pair; the bottom row finds everything ' +
      'and proposes a great many that have to be verified. The right row is the one whose verification ' +
      'cost you can afford, which is a question about the downstream system rather than about hashing.');
  }

  function paintSimhash(simhash, threshold) {
    const rows = simhash.sweep.map(function (row) {
      return '<tr><td class="mono">≤ ' + row.cutoff + ' of ' + simhash.bits + ' bits</td>' +
        '<td class="mono">' + root.Format.exact(row.flagged) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.recall, 1) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.precision, 1) + '</td></tr>';
    }).join('');

    root.jQuery('#lsh-simhash tbody').html(rows);
    root.jQuery('#lsh-simhash-note').text('SimHash costs ' +
      root.Format.bytes(simhash.bytesPerDocument) + ' per document against MinHash\'s 512, and its ' +
      'cutoff is a number of differing bits rather than a similarity. It is scoring a different ' +
      'quantity — the angle between the token vectors, not the overlap of the sets — so a corpus ' +
      'ranked by one is not ranked by the other, and a "duplicate" threshold tuned on Jaccard does ' +
      'not transfer to Hamming distance. The rows above are the tuning that has to be redone.');
  }

  function paintProjection(projection) {
    const promised = root.MinHashLsh.jlDimension({ points: projection.points, epsilon: projection.epsilon });

    root.jQuery('#lsh-projection').text([
      'points:                          ' + projection.points + ' vectors in ' + projection.dimensions + ' dimensions',
      'pairwise distances checked:      ' + root.Format.exact(projection.pairs),
      '',
      'Johnson-Lindenstrauss asks for:  ' + root.Format.exact(promised) +
        ' dimensions to keep every distance within ±' + root.Format.percent(projection.epsilon, 0),
      'dimensions actually used:        ' + root.Format.exact(projection.target),
      '',
      'worst distortion measured:       ' + root.Format.percent(projection.worstDistortion, 2),
      'mean distortion measured:        ' + root.Format.percent(projection.meanDistortion, 2),
      'compression:                     ' + root.Format.fixed(projection.compression, 2) + '×'
    ].join('\n'));

    root.jQuery('#lsh-projection-note').text('k ≥ 8 ln n / ε² is a worst-case bound over every pair ' +
      'and its constant is generous: at 64 dimensions — a fifth of what the lemma demands for 60 ' +
      'points — the worst distortion measured is 29.95% against the 30% promised, and the mean is ' +
      '6.7%. The lemma tells you a dimension that certainly works; only measurement tells you the ' +
      'one you can actually get away with.');
  }

  function drawCurve(app, result, threshold) {
    const chart = root.ErrorBandView.curve(root.jQuery('#lsh-curve-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      yMax: 1,
      legendHost: root.jQuery('#lsh-curve-legend')[0],
      xLabel: 'true Jaccard similarity',
      yLabel: 'probability the pair is proposed',
      yFormat: function (value) { return (value * 100).toFixed(0) + '%'; },
      series: [{ label: '1 − (1 − s^r)^b', points: result.curve }],
      markers: [
        { x: result.curveThreshold, label: 'curve threshold ' + root.Format.fixed(result.curveThreshold, 3) },
        { x: threshold, label: 'what you called a duplicate' }
      ],
      summary: function () {
        return 'The S-curve for ' + result.signatureLength + ' hashes split into bands, with the ' +
          'curve threshold and the chosen duplicate threshold marked.';
      }
    });

    root.jQuery('#lsh-curve-note').text('The two markers are the whole tuning problem. Where the curve ' +
      'turns is set by b and r; where you decided a duplicate begins is a product decision. When the ' +
      'curve threshold sits to the right of it, real duplicates are missed; to the left, the ' +
      'verification stage does more work.');
    return chart;
  }

  function drawScatter(app, result, threshold) {
    const points = result.estimates.map(function (pair) {
      return { truth: pair.exact, estimate: pair.estimate };
    });

    const chart = root.ErrorBandView.scatter(root.jQuery('#lsh-scatter-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      points: points,
      bound: result.standardError,
      legendHost: root.jQuery('#lsh-scatter-legend')[0],
      xLabel: 'exact Jaccard',
      yLabel: 'estimated from the signature',
      boundLabel: '+1/√L, one standard error',
      summary: function () {
        return 'MinHash estimate against exact Jaccard for every pair in the corpus; the cloud ' +
          'straddles the exact line because the estimator is unbiased.';
      }
    });

    root.jQuery('#lsh-scatter-note').text('The cloud straddles the y = x line rather than sitting ' +
      'above it: the MinHash estimate is unbiased, unlike a count-min estimate. Its spread is ' +
      root.Format.percent(result.standardError, 2) + ' — one standard error, 1/√L — and the worst ' +
      'pair in this corpus is out by ' + root.Format.percent(result.worstEstimateError, 2) +
      '. Every one of the ' + root.Format.exact(result.allPairs) + ' pairs is plotted, which is ' +
      'precisely the work the band index exists to avoid doing.');
    return chart;
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
