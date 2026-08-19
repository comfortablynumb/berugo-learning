/**
 * Section: choosing and combining sketches.
 *
 * The chooser measures rather than consults. State a question, a budget and a
 * tolerance, and every candidate is built, fed the current stream and scored
 * against the exact answer - so the recommendation is a measurement and the
 * trade-off table below it is a summary of measurements rather than a source
 * of them.
 *
 * The two attack panels are the other half. A filter whose seed is published
 * gives up 50 manufactured false positives for about 100 probes each at a 1%
 * error rate, and none of them transfer to a filter seeded differently. That
 * is the whole argument for a per-process seed, and it is cheap to demonstrate
 * and impossible to argue with.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'choosing-sketches';
  const TRADEOFF = [
    ['membership', 'Bloom filter', 'the answer (false positives)', 'one-sided: never a false negative',
      'same shape only', '9.6 bits per key at 1%'],
    ['membership, with deletes', 'cuckoo filter', 'the answer', 'one-sided, until a phantom delete',
      'no', '8.2 bits per item at 3%'],
    ['membership, mergeable', 'quotient filter', 'the answer', 'one-sided', 'yes',
      '13.3 bits per item at 0.4%'],
    ['distinct count', 'HyperLogLog', 'the count, relatively', 'two-sided, unbiased', 'yes, exactly',
      '3 072 bytes at σ = 1.6%'],
    ['frequency of a key', 'count-min', 'the count, additively', 'one-sided: never under', 'yes',
      'ε·N with ε = e/w'],
    ['frequency, unbiased', 'count-sketch', 'the count, relative to ‖f‖₂', 'two-sided', 'yes',
      'same matrix, median instead of min'],
    ['hot keys', 'space-saving', 'the count, additively', 'one-sided: never under', 'approximately',
      '8 000 bytes for 200 counters'],
    ['quantiles by rank', 't-digest / KLL', 'the rank', 'two-sided', 'yes', '944 bytes at δ = 100'],
    ['quantiles by value', 'DDSketch', 'the value, relatively', 'two-sided, bounded by α', 'yes, exactly',
      '4 116 bytes at α = 1%'],
    ['similarity', 'MinHash + banding', 'the similarity estimate', 'two-sided, unbiased', 'yes',
      '512 bytes per document at L = 128'],
    ['ones in a window', 'DGIM', 'the count, relatively', 'two-sided', 'no', '600 bits for N = 20 000']
  ];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
        title: 'Diagram — which family the question points at',
        caption: 'The first branch is what the question is about; the second is what your system does ' +
          'with a wrong answer.',
        definition: [
          'flowchart TD',
          '    Q{"what is the question?"} --> M["is this key present?"]',
          '    Q --> D["how many distinct?"]',
          '    Q --> F["how often?"]',
          '    Q --> P["what is p99?"]',
          '    Q --> S["which are similar?"]',
          '    M --> M1{"do you delete?"}',
          '    M1 -->|no| MB["Bloom, or blocked Bloom<br/>if the query rate is the problem"]',
          '    M1 -->|yes| MC["cuckoo filter<br/>— and guard the delete path"]',
          '    D --> DH["HyperLogLog<br/>— merges exactly"]',
          '    F --> F1{"can you survive an over-count?"}',
          '    F1 -->|yes| FC["count-min<br/>(conservative update)"]',
          '    F1 -->|no| FE["count-sketch, or exact"]',
          '    P --> P1{"is the SLO in values or ranks?"}',
          '    P1 -->|values| PD["DDSketch"]',
          '    P1 -->|ranks| PT["t-digest or KLL"]',
          '    S --> SM["MinHash + banding<br/>— tune b and r on the S-curve"]'
        ].join('\n')
      };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'The choice between sketches is three questions, not one. What is the error *on* — the answer, ' +
          'the count, the rank or the value? Which direction can it go, and is that the direction your ' +
          'system can survive? And do two of them merge, because a system that shards will eventually ' +
          'need to combine them and retrofitting mergeability means changing the sketch. The table ' +
          'below is those three columns for every structure in the milestone.',
        'The option people forget to price is exactness. A Set holding 21 619 string keys costs about ' +
          '1.2 MB here, which is a lot against a Bloom filter\'s 26 KB and nothing at all against the ' +
          'machine it would run on. Sketches earn their place when the key count is genuinely large, ' +
          'when there are many streams rather than one, or when the answer has to move over a network ' +
          '— and the chooser prices the exact option in every ranking so the comparison is visible.',
        'Every structure here assumes the keys are independent of the hash, and an attacker who knows ' +
          'the seed breaks that for the price of arithmetic. Fifty false positives can be manufactured ' +
          'against a 1% filter for about 104 probes each, and a count-min sketch at 32 × 3 can have one ' +
          'key\'s estimate driven from 100 to 40 100 by finding eight keys that collide with it ' +
          'in every row. Both attacks evaporate against a seed the attacker does not have.'
      ],
      demo: { title: 'Interactive demo — the chooser, and two attacks', markup: root.ChoosingSketchesTemplate.render() },
      diagram: diagram(),
      insight: 'The sketch is usually the easy part; the hard parts are seeding it against adversarial ' +
        'keys and having a plan for when the input exceeds the sizing assumption. Both of those are ' +
        'operational work that no library does for you: a per-process seed that is never logged, and ' +
        'an exported counter of how many keys have gone in against how many the structure was built ' +
        'for. A sketch with neither is a correctness incident with a delay fuse on it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ChoosingSketchesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function update() {
    const values = panel.values();
    const ranking = root.SketchChooser.recommend({
      question: values['chs-question'],
      budget: Number(values['chs-budget']),
      tolerance: Number(values['chs-tolerance']),
      probes: 20000,
      seed: 3
    });
    const attack = root.SketchChooser.filterAttack({
      n: 5000, p: Number(values['chs-attack-target']), want: 50, budget: 400000
    });
    const sketchAttack = root.SketchChooser.sketchAttack({
      width: 32, depth: 3, want: 8, budget: 600000, honest: 100, perAttacker: 5000
    });
    const exact = ranking.rows.filter(function (row) { return row.id === 'exact'; })[0];

    root.MetricGrid.update({
      'chs-winner': {
        value: ranking.winner ? ranking.winner.label : 'nothing fits',
        note: ranking.winner ? ranking.winner.detail : 'raise the budget or the tolerance'
      },
      'chs-cost': {
        value: ranking.winner ? root.Format.bytes(ranking.winner.bytes) : '—',
        note: ranking.winner
          ? root.Format.percent(ranking.winner.error, 3) + ' error, against a ' +
            root.Format.percent(ranking.tolerance, 2) + ' tolerance'
          : 'no candidate met both constraints'
      },
      'chs-exact': {
        value: exact ? root.Format.bytes(exact.bytes) : '—',
        note: exact && ranking.winner
          ? root.Format.fixed(exact.bytes / ranking.winner.bytes, 0) + '× the recommendation, and always right'
          : 'the option to price first'
      },
      'chs-attack': {
        value: root.Format.exact(attack.perHit),
        note: root.Format.exact(attack.found) + ' false positives from ' +
          root.Format.exact(attack.examined) + ' probes'
      }
    });

    paintRanking(ranking);
    paintTradeoff();
    paintFilterAttack(attack);
    paintSketchAttack(sketchAttack);
    paintCi(ranking);
  }

  function paintRanking(ranking) {
    const rows = ranking.rows.map(function (row) {
      const usable = row.fits && row.accurate;
      return '<tr' + (usable ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + row.label + '<br><span class="note">' + row.detail + '</span></td>' +
        '<td class="mono">' + root.Format.bytes(row.bytes) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.error, 3) + '</td>' +
        '<td class="mono">' + row.mergeable + '</td>' +
        '<td class="mono">' + row.verdict + '</td></tr>';
    }).join('');

    root.jQuery('#chs-ranking tbody').html(rows);
    root.jQuery('#chs-ranking-note').text('The metric is ' + ranking.metric + ', measured against the ' +
      'exact answer on a stream of ' + root.Format.exact(ranking.items) + ' items over ' +
      root.Format.exact(ranking.distinct) + ' distinct keys. Nothing in this ranking comes from a ' +
      'table — every row was built and fed the same input, which is the only way the answer stays ' +
      'right when the stream changes shape.');
  }

  function paintTradeoff() {
    const rows = TRADEOFF.map(function (row) {
      return '<tr>' + row.map(function (cell, index) {
        return index === 0 || index === 1 ? '<td>' + cell + '</td>' : '<td class="mono">' + cell + '</td>';
      }).join('') + '</tr>';
    }).join('');

    root.jQuery('#chs-tradeoff tbody').html(rows);
    root.jQuery('#chs-tradeoff-note').text('Read the third and fourth columns together before the ' +
      'sixth. "Count-min is more accurate than count-sketch" is false and "count-min is safe where ' +
      'count-sketch is not" is true, and only the direction column carries that. Composing sketches ' +
      'inherits the worst of the rows involved: a per-key HyperLogLog inside a count-min is ' +
      'one-sided in the outer count and two-sided in the inner one, so the composed answer is ' +
      'neither.');
  }

  function paintFilterAttack(attack) {
    root.jQuery('#chs-filter-attack').text([
      'filter: ' + root.Format.exact(attack.shape.m) + ' bits, k = ' + attack.shape.k +
        ', target ' + root.Format.percent(attack.target, 1) + ', seed published',
      '',
      'false positives wanted:      ' + root.Format.exact(attack.found),
      'candidate keys examined:     ' + root.Format.exact(attack.examined),
      'probes per manufactured hit: ' + root.Format.exact(attack.perHit) +
        '   (1/ε predicts ' + root.Format.exact(attack.expectedPerHit) + ')',
      'sample: ' + attack.sample.join(', '),
      '',
      'the same keys against a filter with a different seed:',
      '  reported present: ' + root.Format.exact(attack.transferred) +
        '   (chance alone predicts ' + root.Format.fixed(attack.expectedTransferred, 2) + ')'
    ].join('\n'));

    root.jQuery('#chs-filter-attack-note').text('The attack costs exactly 1/ε probes per hit, so the ' +
      'defence is not a lower error rate — halving ε doubles the attacker\'s work and doubles your ' +
      'memory. The defence is the seed: a per-process value the attacker cannot precompute against, ' +
      'and one that is not in the config file, the logs or the source.');
  }

  function paintSketchAttack(attack) {
    root.jQuery('#chs-sketch-attack').text([
      'sketch: ' + attack.width + ' × ' + attack.depth + ', seed published',
      '',
      'keys that collide with the victim in every row: ' + root.Format.exact(attack.found),
      'candidates examined to find them:               ' + root.Format.exact(attack.examined),
      'cost per collision:                             ' + root.Format.exact(attack.perHit) +
        '   (w^d predicts ' + root.Format.exact(attack.expectedPerHit) + ')',
      '',
      'victim\'s true count:      ' + root.Format.exact(attack.trueCount),
      'estimate before the flood: ' + root.Format.exact(attack.before),
      'estimate after the flood:  ' + root.Format.exact(attack.after) +
        '   — ' + root.Format.fixed(attack.inflation, 0) + '× the truth',
      '',
      'the same search against a 2 048 × 5 sketch would cost ' +
        attack.productionCost.toExponential(2) + ' candidates'
    ].join('\n'));

    root.jQuery('#chs-sketch-attack-note').text('The estimate is still an upper bound — count-min\'s ' +
      'guarantee has not been violated, because ε·N grew with the flood. That is the uncomfortable ' +
      'part: the sketch is behaving exactly as specified while reporting a number that is ' +
      root.Format.fixed(attack.inflation, 0) + '× wrong, and a rate limiter reading it would ban a ' +
      'user who did nothing. A guarantee that holds is not the same as an answer you can act on.');
  }

  function paintCi(ranking) {
    root.jQuery('#chs-ci').text([
      'What a sketch\'s test suite has to assert, and what each one catches:',
      '',
      '1. no false negatives, over the whole key set',
      '     catches a filter that lost a key during a resize or a relocation',
      '2. the stated bound, not a hand-tuned tolerance',
      '     catches a change that quietly widens the error until the test passes again',
      '3. the estimate\'s *direction*, key by key',
      '     catches a switch from count-min to count-sketch made for accuracy',
      '4. merge(a, b) equals the sketch of the concatenation, exactly where it can be',
      '     catches a merge that drops a shard — the estimates would still look plausible',
      '5. an adversarial key set, not only a random one',
      '     catches a hash whose rows are correlated: the guarantee assumes they are not',
      '6. the structure at and past the n it was sized for',
      '     catches every sizing assumption that was never written down',
      '',
      'this section\'s ranking re-runs 1 and 2 on every change: the current winner is ' +
        (ranking.winner ? ranking.winner.label : 'none') + ', at ' +
        (ranking.winner ? root.Format.percent(ranking.winner.error, 3) : '—') + ' measured error'
    ].join('\n'));

    root.jQuery('#chs-ci-note').text('Item 2 is the one that decays. A tolerance written as "within ' +
      '15%" outlives the reason it was 15%, and the next person widens it rather than asking why the ' +
      'error moved. Assert the formula — ε·N, 1.04/√m, α — computed from the structure\'s own ' +
      'parameters, and the test fails when the structure changes rather than when the number does.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
