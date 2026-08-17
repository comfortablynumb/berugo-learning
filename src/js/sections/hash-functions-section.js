/**
 * Section: What a hash function has to do.
 *
 * Four properties, three of them measurable here: avalanche as a 32x32 matrix,
 * uniformity as a chi-squared readout, and the composite-key bug as a
 * collision count. Speed is left to M01's benchmark harness.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'hash-functions';
  let panel = null;
  let view = null;

  const FUNCTIONS = {
    murmur3: { label: 'murmur3', string: function (k) { return root.HashFunctions.murmur3(k, 0); },
      word: function (v) { return root.HashFunctions.murmurFinalise(v); } },
    xx: { label: 'xxhash32 finaliser', string: function (k) { return root.HashFunctions.xxFinalise(root.HashFunctions.fnv1a(k)); },
      word: function (v) { return root.HashFunctions.xxFinalise(v); } },
    'fnv-1a': { label: 'FNV-1a', string: function (k) { return root.HashFunctions.fnv1a(k); },
      word: function (v) { return root.HashFunctions.fnv1a(String(v)); } },
    djb2: { label: 'djb2', string: function (k) { return root.HashFunctions.djb2(k); },
      word: function (v) { return root.HashFunctions.djb2(String(v)); } },
    weak: { label: 'weak', string: function (k) { return root.HashFunctions.weakFinalise(root.HashFunctions.fnv1a(k)); },
      word: function (v) { return root.HashFunctions.weakFinalise(v); } }
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (view) view.redraw(); });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'A hash function for a table has four jobs: be deterministic, spread keys uniformly, change ' +
          'about half the output bits when any input bit changes, and be fast. Only the first is ' +
          'free — the other three trade against each other, and all three are measurable.',
        'Avalanche is the one people skip. A function can look fine on a histogram and still leave ' +
          'the low bits correlated with the input, which matters because a table takes the *low* ' +
          'bits when it masks with capacity − 1. The matrix below shows exactly which bits a ' +
          'function failed to mix.',
        'None of this is cryptography. A table hash may be reversible and usually is; the next ' +
          'section is about what that costs you when the keys arrive from a stranger.',
        'One caution about the verdict below: "every cell within 40–60%" is only a criterion once ' +
          'there are enough samples for a cell to be measured that precisely. At 256 samples a cell ' +
          'has a 3.1-point standard error and the worst of 1 024 of them lands outside the band by ' +
          'chance, so the panel tests the deviation in standard errors instead.'
      ],
      demo: { title: 'Interactive demo — avalanche, uniformity and a composite-key bug',
        markup: root.HashFunctionsTemplate.render() },
      diagram: {
        title: 'Diagram — one mix-finalise round',
        caption: 'murmur3: absorb the word, rotate, multiply, then finalise with shift-multiply pairs.',
        definition: [
          'flowchart LR',
          '    K["input word"] --> M1["× c1"] --> R1["rotl 15"] --> M2["× c2"]',
          '    M2 --> X["h ^= k"] --> R2["rotl 13"] --> M3["h·5 + n"]',
          '    M3 --> F1["h ^= h >>> 16"] --> F2["× 0x85ebca6b"] --> F3["h ^= h >>> 13"]',
          '    F3 --> F4["× 0xc2b2ae35"] --> F5["h ^= h >>> 16"] --> OUT["32-bit hash"]'
        ].join('\n')
      },
      insight: 'XOR-ing field hashes together makes (a, b) collide with (b, a). Almost every ' +
        'hand-rolled composite hash has this bug, and it survives review because the histogram ' +
        'still looks fine — the collisions are between key pairs, not in the bucket counts.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.HashFunctionsTemplate.controls,
      onChange: function () { update(app); }
    });

    root.jQuery('#hf-legend').html(root.AvalancheView.legend());
    update(app);
  }

  function update(app) {
    const values = panel.values();
    const chosen = FUNCTIONS[values['hf-function']];

    const avalanche = root.HashLab.avalanche({
      hash: chosen.word,
      samples: values['hf-samples'],
      rng: root.Random.seeded(17)
    });

    const keys = root.HashLab.keys({
      kind: values['hf-keys'], count: values['hf-count'], rng: root.Random.seeded(23)
    });
    const distribution = root.HashLab.chiSquared({
      hash: chosen.string, keys: keys, buckets: values['hf-buckets']
    });

    paintMetrics({ avalanche: avalanche, distribution: distribution, values: values });
    paintViews(app, { avalanche: avalanche, distribution: distribution });
    paintCombine();
  }

  function paintMetrics(state) {
    const expected = state.values['hf-count'] / state.values['hf-buckets'];

    root.MetricGrid.update({
      'hf-avalanche': {
        value: state.avalanche.passes ? 'passes' : 'fails',
        note: 'range ' + state.avalanche.min.toFixed(3) + '–' + state.avalanche.max.toFixed(3) +
          ', mean ' + state.avalanche.mean.toFixed(3) +
          (state.avalanche.withinBand ? ', inside 40–60%' : ', outside 40–60%')
      },
      'hf-range': {
        value: state.avalanche.worstZ.toFixed(2) + ' σ',
        note: (state.avalanche.worstDeviation * 100).toFixed(1) + ' points, against a ' +
          (state.avalanche.standardError * 100).toFixed(1) + '-point standard error at ' +
          state.avalanche.samples + ' samples'
      },
      'hf-chi': {
        value: state.distribution.ratio.toFixed(3),
        note: state.distribution.emptyBuckets + ' empty buckets of ' + state.values['hf-buckets']
      },
      'hf-collisions': {
        value: root.Format.exact(state.distribution.maxBucket),
        note: 'expected ' + expected.toFixed(1) + ' keys per bucket'
      }
    });
  }

  function paintViews(app, state) {
    view = root.AvalancheView.render(root.jQuery('#hf-avalanche-view')[0], {
      matrix: state.avalanche.matrix, height: 250
    });

    root.BucketView.buckets(root.jQuery('#hf-histogram')[0], {
      lengths: state.distribution.counts,
      expected: state.distribution.counts.reduce(function (a, b) { return a + b; }, 0) /
        state.distribution.counts.length,
      height: 180,
      caption: 'keys per bucket; the dashed line is the uniform expectation'
    });
  }

  /** Every ordered pair of two 16-bit fields, counted for collisions. */
  function paintCombine() {
    const pairs = [];
    for (let a = 0; a < 90; a += 1) {
      for (let b = a + 1; b < 90; b += 1) pairs.push([a * 977, b * 977]);
    }

    const xor = countDistinct(pairs, root.HashFunctions.combineXor);
    const ordered = countDistinct(pairs, root.HashFunctions.combineOrdered);
    const total = pairs.length * 2;

    root.jQuery('#hf-combine').html(
      '<div>' + root.Format.exact(total) + ' ordered pairs (each (a,b) and its reverse)</div>' +
      '<div>XOR combine:     ' + root.Format.exact(xor) + ' distinct hashes → ' +
        root.Format.exact(total - xor) + ' collisions</div>' +
      '<div>ordered combine: ' + root.Format.exact(ordered) + ' distinct hashes → ' +
        root.Format.exact(total - ordered) + ' collisions</div>');
  }

  function countDistinct(pairs, combine) {
    const seen = new Set();
    pairs.forEach(function (pair) {
      seen.add(combine([pair[0], pair[1]]));
      seen.add(combine([pair[1], pair[0]]));
    });
    return seen.size;
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
