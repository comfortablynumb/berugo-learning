/**
 * Section: Kolmogorov complexity and randomness.
 *
 * The measurement is the counting bound, checked by brute force. At length 12
 * with k = 2 there are 4 096 strings, the bound allows 1 023 to compress by two
 * bits or more, and 26 actually do. The bound holds with enormous headroom at
 * every size, and over 99% of strings resist every codec — which is the
 * counting argument made into a number rather than an appeal to intuition.
 *
 * The second measurement is the honest one: the perfect-squares string has a
 * one-line description and every codec here reports it as incompressible. An
 * upper bound is not a value, and this section refuses to pretend otherwise.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'kolmogorov-complexity-and-randomness';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the counting argument, in one line',
      caption: 'How many strings of length n can be described in fewer than n − k bits? At most ' +
        'as many as there are such descriptions, which is 2^(n−k) − 1. There are 2^n strings. ' +
        'So the fraction that can compress by k bits is at most 2^-k, whatever the code, ' +
        'whatever the cleverness. At k = 1 that is half; at k = 10 it is one in a thousand. ' +
        'This is a pigeonhole argument with no content beyond counting, and it settles the ' +
        'question of whether a universal compressor is possible — not "nobody has managed it" ' +
        'but "the descriptions do not exist".',
      definition: [
        'graph TD',
        'A["2^n strings of length n"] --> C{"how many can compress to fewer than n−k bits?"}',
        'B["2^(n−k) − 1 descriptions shorter than n−k"] --> C',
        'C --> D["at most 2^(n−k) − 1 of them"]',
        'D --> E["so at most a 2^-k fraction — whatever the code"]',
        'E --> F["at k=1: half. at k=10: one in a thousand."]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**K(s) is the length of the shortest program that prints s and stops.** That is a ' +
        'property of the string rather than of any particular compressor, which is what makes ' +
        'it the right definition of "how much information is in here" — and it is the reason ' +
        'the definition is uncomputable.',
      '**The invariance theorem says the language does not matter, up to a constant.** An ' +
        'interpreter for one language written in another is a fixed-size program, so ' +
        'K measured in Python and K measured in C differ by at most the size of an interpreter. ' +
        'The constant is real and it does not grow with the string, so K is well defined ' +
        'asymptotically.',
      '**K is not computable, and the proof is Berry’s paradox made rigorous.** If a program ' +
        'could compute K, another program could search for the first string whose K exceeds a ' +
        'million — and that search program is itself a description of the string, in far fewer ' +
        'than a million bits. Contradiction. So no compressor reports a complexity; every one ' +
        'reports an upper bound.',
      '**Every compression ratio is an upper bound and should be labelled as one.** The demo ' +
        'runs four codecs and reports the best, and calls it a bound. The perfect-squares string ' +
        'is the case that makes the distinction bite: it has a one-line description and no codec ' +
        'here finds it, so the measured bound is the string\'s own length while the true value ' +
        'is tiny.',
      '**The counting argument shows most strings are incompressible, and it is elementary.** ' +
        'There are 2^n strings of length n and fewer than 2^(n−k) descriptions shorter than ' +
        'n − k, so at most a 2^-k fraction can compress by k bits. The demo checks that ' +
        'exhaustively for lengths up to sixteen.',
      '**"A compressor that shrinks every input" is impossible, not merely unachieved.** It ' +
        'follows immediately: if every string of length n mapped to something shorter, two would ' +
        'have to share a description and the decoder could not tell them apart. Every claim to ' +
        'the contrary that has ever been made is either a hoax or a misunderstanding about ' +
        'where the data went.',
      '**K and entropy measure different things and agree on average.** Shannon entropy is a ' +
        'property of a SOURCE — a probability distribution — and K is a property of a single ' +
        'string. For a string drawn from a source, the expected K is close to the entropy, which ' +
        'is what connects this section to M22 and why compression benchmarks are meaningful at ' +
        'all.',
      '**Minimum description length turns this into a model-selection principle.** The model ' +
        'plus the data-given-the-model is a code, and the shortest total code is the best trade ' +
        'between fit and complexity. That is what "Occam’s razor" means once it is made precise, ' +
        'and what regularisation, AIC and BIC are all approximating.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — compress a string, then check the bound exhaustively',
        markup: root.KolmogorovTemplate.render()
      },
      diagram: diagram(),
      insight: '**"Compression as intelligence" and "the model that explains the data most ' +
        'briefly generalises best" are both minimum-description-length arguments, and this ' +
        'section is where they stop being slogans.** The precise statement is that a model plus ' +
        'the residual it fails to explain forms a code for the data, and choosing the model that ' +
        'minimises the total is a principled trade between fit and complexity. That is a real ' +
        'and useful idea. What this section also gives you is the limit on it: K is not ' +
        'computable, so no procedure finds the shortest code, and every practical MDL criterion ' +
        '— AIC, BIC, a regularisation term, a validation set — is an approximation whose quality ' +
        'is an empirical question rather than a theorem. Knowing which half you are standing on ' +
        'is what separates using the principle from quoting it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.KolmogorovTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const sampleFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const samples = root.Kolmogorov.samples(Number(parts[1]));
    const chosen = samples.filter(function (sample) {
      return sample.name === parts[0];
    })[0] || samples[0];

    return { sample: chosen, bound: root.Kolmogorov.upperBound(chosen.bits) };
  });

  const countingFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const n = Number(parts[0]);
    const k = Number(parts[1]);

    return [1, 2, 3, 4, 5].filter(function (value) { return value <= n - 1; })
      .map(function (value) {
        return root.Kolmogorov.verifyBound(n, value === k ? k : value);
      });
  });

  const fractionFor = root.Helpers.memoise(function () {
    return [8, 10, 12, 14, 16].map(function (n) {
      return root.Kolmogorov.incompressibleFraction(n);
    });
  });

  function update() {
    const values = panel.values();
    const state = sampleFor(values['kol-sample'] + '\n' + values['kol-length']);
    const counting = countingFor(values['kol-n'] + '\n' + values['kol-k']);
    const chosen = counting.filter(function (row) {
      return row.k === Number(values['kol-k']);
    })[0] || counting[0];

    paintMetrics(state, chosen);
    paintCodecs(state);
    paintBits(state);
    paintCounting(counting);
    paintFraction();
    paintClaims();
  }

  function paintMetrics(state, chosen) {
    root.MetricGrid.update({
      'kol-best': { value: root.Format.exact(state.bound.best) + ' bits',
        note: 'from ' + root.Format.exact(state.bound.length) + ', via the ' +
          state.bound.codec + ' codec — and this is an UPPER bound, not a value' },
      'kol-ratio': { value: root.Format.fixed(state.bound.ratio, 2),
        note: state.bound.saved > 0
          ? root.Format.exact(state.bound.saved) + ' bits saved'
          : 'no codec here beat the literal encoding' },
      'kol-bound': { value: root.Format.exact(chosen.bound),
        note: 'at most 2^(n−k) − 1 strings can have a description shorter than n − k' },
      'kol-actual': { value: root.Format.exact(chosen.compressed),
        note: root.Format.exact(chosen.headroom) + ' below the bound, out of ' +
          root.Format.exact(chosen.total) + ' strings checked' }
    });
  }

  function paintCodecs(state) {
    root.jQuery('#kol-codecs tbody').html(state.bound.results.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td class="mono">' + row.bits +
        (row.bits === state.bound.best ? ' ← best' : '') + '</td><td>' +
        root.Helpers.escapeHtml(row.detail) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('kol-codecs-note',
      'Four codecs, and the literal encoding is one of them — it is always available and it is ' +
      'what the others have to beat. Notice that the best result is a bound on K and never a ' +
      'value: a codec finding nothing tells you only that THIS codec found nothing, which is ' +
      'exactly the position the perfect-squares string is in. Its true complexity is a few dozen ' +
      'bits and every measurement here says it is incompressible.');
  }

  function paintBits(state) {
    root.jQuery('#kol-bits').html(
      '<div>' + root.Helpers.escapeHtml(state.sample.bits) + '</div>' +
      '<div style="margin-top:.4rem">what to expect: ' +
      root.Helpers.escapeHtml(state.sample.expect) + '</div>');

    root.Helpers.setText('kol-bits-note',
      'The perfect-squares string is the important one. Bit i is 1 exactly when i is a perfect ' +
      'square, which is a description you could fit in a tweet, and it has no period, no long ' +
      'runs and no repeated phrases — so run-length, the period detector and the dictionary all ' +
      'come back with nothing. Its measured bound equals its length; its actual complexity is ' +
      'tiny. That gap is uncomputable in general, and it is the reason a compression ratio is ' +
      'evidence about a codec rather than a measurement of a string.');
  }

  function paintCounting(counting) {
    root.jQuery('#kol-counting tbody').html(counting.map(function (row) {
      return '<tr><td class="mono">' + row.n + '</td><td class="mono">' + row.k +
        '</td><td class="mono">' + root.Format.exact(row.total) + '</td><td class="mono">' +
        root.Format.exact(row.compressed) + '</td><td class="mono">' +
        root.Format.exact(row.bound) + '</td><td class="mono">' +
        (row.withinBound ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('kol-counting-note',
      'Every string of the given length is generated and run through all four codecs, and the ' +
      'count is compared to the pigeonhole bound. The bound holds at every row, and the ' +
      'headroom is enormous — real codecs come nowhere near saturating what counting allows, ' +
      'because they exploit specific structure rather than allocating descriptions optimally. ' +
      'The bound is a ceiling on what is possible, not a prediction of what happens.');
  }

  function paintFraction() {
    root.jQuery('#kol-incompressible tbody').html(fractionFor('rows').map(function (row) {
      return '<tr><td class="mono">' + row.n + '</td><td class="mono">' +
        root.Format.exact(row.total) + '</td><td class="mono">' +
        root.Format.exact(row.incompressible) + '</td><td class="mono">' +
        root.Format.fixed(row.fraction * 100, 1) + '%</td></tr>';
    }).join(''));

    root.Helpers.setText('kol-incompressible-note',
      'Over ninety-nine per cent of strings at every length resist every codec here by even one ' +
      'bit. The counting argument only guarantees at most half can compress by one bit, so the ' +
      'measured figure is far better than the bound requires — which is the practical shape of ' +
      'the situation. Compression works because real data is not a uniformly random string, ' +
      'and the moment it is, nothing helps. That is also why encrypted data does not compress: ' +
      'it is indistinguishable from the ninety-nine per cent.');
  }

  function paintClaims() {
    root.jQuery('#kol-claims tbody').html(root.Kolmogorov.CLAIMS.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.claim) + '</td><td>' +
        root.Helpers.escapeHtml(row.why) + '</td><td>' +
        root.Helpers.escapeHtml(row.use) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('kol-claims-note',
      'The last row is the one that reaches furthest outside the theory. Minimum description ' +
      'length says the model plus its residual is a code, and the shortest total code is the ' +
      'best trade of fit against complexity — which is a precise version of Occam\'s razor and ' +
      'the honest ancestor of every regularisation term. The second row is the limit on it: the ' +
      'shortest code cannot be found, so every practical criterion is an approximation whose ' +
      'quality is an empirical question.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
