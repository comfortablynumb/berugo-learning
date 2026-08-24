/**
 * Section: weighted and probabilistic automata.
 *
 * Two measurements. Viterbi is checked against brute-force enumeration of every
 * path — the only reference that cannot share a bug with the dynamic program —
 * and the log domain is justified by measuring where the plain-probability
 * version reaches exactly zero. That second number is the honest form of "use
 * logs": not a rule of thumb, a sequence length.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'weighted-and-probabilistic';
  const LENGTHS = [100, 300, 500, 700, 1000];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a trellis, with the best path marked',
      caption: 'Unroll the automaton over time: one column per observation, one row per state, ' +
        'and an edge for every transition. A path through the trellis is a state sequence, and ' +
        'its score is the sum of the transition and emission logs along it. Viterbi fills the ' +
        'columns left to right keeping only the best way to reach each cell and a pointer to ' +
        'where it came from — which is dynamic programming from M12 with the states as rows. ' +
        'The forward algorithm fills the same grid but SUMS instead of maximising, and answers ' +
        'a different question: not "which path" but "how likely is this observation at all".',
      definition: [
        'flowchart LR',
        '    s1["sunny<br/>t=1"] --> s2["sunny<br/>t=2"] --> s3["sunny<br/>t=3"]',
        '    r1["rainy<br/>t=1"] --> r2["rainy<br/>t=2"] --> r3["rainy<br/>t=3"]',
        '    s1 --> r2',
        '    r1 --> s2',
        '    s2 --> r3',
        '    r2 --> s3',
        '    s1 -. "best path" .-> r2',
        '    r2 -. "best path" .-> r3'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Put weights on the transitions and running the machine becomes a shortest-path ' +
        'problem.** Which weights and which "shortest" is the choice of SEMIRING: add along a ' +
        'path and minimise between paths, or multiply and maximise, or multiply and sum. The ' +
        'algorithm does not change.',
      '**A hidden Markov model is a probabilistic automaton whose states you cannot see.** You ' +
        'observe emissions and want the state sequence that best explains them — which is ' +
        'exactly decoding, and exactly what a part-of-speech tagger or a noisy-channel spell ' +
        'corrector does.',
      '**Viterbi is dynamic programming on a trellis, and recognising that is the point.** One ' +
        'column per observation, one row per state, each cell keeping the best score into it and ' +
        'a back-pointer. Nothing about it is specific to speech or language.',
      '**The demo checks it against brute force.** Every path is enumerated on the small model ' +
        'and the best one compared with Viterbi\'s. A dynamic program with a subtly wrong ' +
        'recurrence returns a plausible path, and only an independent reference catches it.',
      '**The log domain is not a micro-optimisation.** A path multiplies one probability per ' +
        'symbol, so a few hundred symbols underflow a double to exactly zero and every path then ' +
        'ties at zero — the decoder returns whichever it happened to visit first. The demo ' +
        'measures the length at which that happens.',
      '**Adding logs never underflows, which is the whole trick.** The same recurrence with ' +
        'multiplication replaced by addition and probabilities replaced by their logarithms. The ' +
        'sum in the forward algorithm needs a little more care — `log(e^a + e^b)` computed by ' +
        'factoring out the larger term.',
      '**The best path and the most likely state at each step are DIFFERENT answers.** Viterbi ' +
        'maximises over whole sequences; the posterior maximises each position independently, ' +
        'and the sequence of per-position winners may not even be a valid path. The demo prints ' +
        'both and they can disagree.',
      '**Weighted transducers compose, and that is how real decoders are built.** A speech ' +
        'system composes context, lexicon and language-model transducers into one weighted ' +
        'machine and decodes with a single shortest-path search — the same composition as ' +
        'section 24.8 with weights carried along.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — decode a sequence, and find where plain probabilities die',
        markup: root.WeightedTemplate.render()
      },
      diagram: diagram(),
      insight: '**Viterbi is dynamic programming on a trellis; recognising that is what lets you ' +
        'build a decoder for a new domain without looking up an algorithm.** The recurrence is ' +
        'the same one M12 uses for edit distance and longest common subsequence — best score ' +
        'into a cell, plus a back-pointer, read the answer back along the pointers. What makes ' +
        'it feel like a different subject is the vocabulary: emissions, transitions, priors. ' +
        'Strip those and it is a grid with a max over predecessors, which means any problem you ' +
        'can phrase as "a sequence of hidden choices explaining an observed sequence" already ' +
        'has a decoder, and you write it rather than find it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.WeightedTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function model() {
    return root.Hmm.weather();
  }

  const decodeFor = root.Helpers.memoise(function (key) {
    const hmm = model();
    const observations = key.split(',');

    return { hmm: hmm, observations: observations,
      viterbi: root.Hmm.viterbi(hmm, observations),
      brute: root.Hmm.bruteForce(hmm, observations),
      forward: root.Hmm.forward(hmm, observations),
      posterior: root.Hmm.posterior(hmm, observations) };
  });

  const underflowFor = root.Helpers.memoise(function (symbol) {
    const hmm = model();
    const depth = root.Hmm.underflowDepth(hmm, symbol, 2000);
    const rows = LENGTHS.map(function (length) {
      const sequence = [];

      for (let i = 0; i < length; i += 1) sequence.push(symbol);
      return { length: length, plain: root.Hmm.naiveViterbi(hmm, sequence).probability,
        log: root.Hmm.viterbi(hmm, sequence).logProbability };
    });

    return { depth: depth, rows: rows, symbol: symbol };
  });

  function update() {
    const values = panel.values();
    const state = decodeFor(values['wgt-observations']);
    const underflow = underflowFor(values['wgt-symbol']);

    paintMetrics(state, underflow);
    paintDecode(state);
    paintTrellis(state);
    paintPosterior(state);
    paintUnderflow(underflow);
    paintSemirings();
  }

  function paintMetrics(state, underflow) {
    const matches = state.viterbi.path.join(',') === state.brute.path.join(',');

    root.MetricGrid.update({
      'wgt-path': { value: state.viterbi.path.join(' → '),
        note: 'log probability ' + root.Format.fixed(state.viterbi.logProbability, 4) },
      'wgt-brute': { value: matches ? 'yes' : 'NO',
        note: root.Format.exact(state.brute.paths) + ' paths enumerated, best log probability ' +
          root.Format.fixed(state.brute.logProbability, 4) },
      'wgt-total': { value: root.Format.fixed(Math.exp(state.forward.logProbability), 6),
        note: 'summed over all ' + root.Format.exact(state.brute.paths) +
          ' paths; the best single path contributes ' +
          root.Format.fixed(Math.exp(state.viterbi.logProbability), 6) },
      'wgt-underflow': { value: underflow.depth === null
        ? 'not within 2 000' : root.Format.exact(underflow.depth),
      note: underflow.depth === null
        ? 'repeating "' + underflow.symbol + '" stays above the smallest double for 2 000 steps'
        : 'repeating "' + underflow.symbol + '" reaches exactly zero at that length' }
    });
  }

  function paintDecode(state) {
    root.jQuery('#wgt-decode').html(
      '<div class="mono" style="font-size:.85rem">observed: ' +
      state.observations.join(', ') + '</div>' +
      '<div class="mono" style="font-size:.85rem">viterbi : ' +
      state.viterbi.path.join(', ') + '</div>' +
      '<div class="mono" style="font-size:.85rem">brute   : ' +
      state.brute.path.join(', ') + '</div>' +
      '<div class="mono" style="font-size:.85rem;margin-top:.4rem">log P(best path) = ' +
      root.Format.fixed(state.viterbi.logProbability, 6) + '</div>');

    root.Helpers.setText('wgt-decode-note',
      'Two decoders, one answer. Viterbi filled ' +
      root.Format.exact(state.observations.length) + ' columns of ' +
      root.Format.exact(state.hmm.states.length) + ' cells — ' +
      root.Format.exact(state.observations.length * state.hmm.states.length) +
      ' cells in total — while the brute force enumerated all ' +
      root.Format.exact(state.brute.paths) + ' paths. The costs diverge immediately: doubling ' +
      'the sequence length doubles the trellis and squares the path count, so the reference is ' +
      'only usable as a test and never as an implementation. That is exactly the role it plays ' +
      'here.');
  }

  function paintTrellis(state) {
    const trellis = state.viterbi.trellis;

    root.jQuery('#wgt-trellis tbody').html(trellis.map(function (column, t) {
      return '<tr><td class="mono">' + t + '</td><td class="mono">' +
        state.observations[t] + '</td><td class="mono">' +
        root.Format.fixed(column.sunny.score, 4) + '</td><td class="mono">' +
        root.Format.fixed(column.rainy.score, 4) + '</td><td class="mono">' +
        state.viterbi.path[t] + '</td></tr>';
    }).join(''));

    root.Helpers.setText('wgt-trellis-note',
      'Every score is a log probability, so they are negative and they only ever get more ' +
      'negative — which is the property that makes the log domain safe: adding negative numbers ' +
      'never rounds to a value the machine cannot represent, while multiplying numbers below one ' +
      'reaches zero. The last column is read BACKWARDS from the final best cell along the ' +
      'stored pointers, which is why a greedy left-to-right choice of the best cell per column ' +
      'is not the same thing and can produce a sequence with no valid transitions in it.');
  }

  function paintPosterior(state) {
    root.jQuery('#wgt-posterior tbody').html(state.posterior.map(function (row, t) {
      const best = row.sunny >= row.rainy ? 'sunny' : 'rainy';

      return '<tr><td class="mono">' + t + '</td><td class="mono">' + state.viterbi.path[t] +
        '</td><td class="mono">' + root.Format.fixed(row.sunny, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.rainy, 4) + '</td><td class="mono">' + best +
        (best === state.viterbi.path[t] ? '' : ' ← differs') + '</td></tr>';
    }).join(''));

    const differ = state.posterior.filter(function (row, t) {
      return (row.sunny >= row.rainy ? 'sunny' : 'rainy') !== state.viterbi.path[t];
    }).length;

    root.Helpers.setText('wgt-posterior-note',
      'The two middle columns are the forward–backward posterior: the probability of each state ' +
      'at each position given the WHOLE observation sequence, past and future. They differ from ' +
      'the Viterbi path at ' + root.Format.exact(differ) + ' of ' +
      root.Format.exact(state.posterior.length) + ' positions here, and the difference is not a ' +
      'bug in either. Viterbi maximises over complete sequences and the posterior maximises each ' +
      'position independently, so stringing the per-position winners together can produce a ' +
      'sequence with a zero-probability transition in it. Which one you want depends on whether ' +
      'you are asked for a path or for a label.');
  }

  function paintUnderflow(underflow) {
    root.jQuery('#wgt-underflow-table tbody').html(underflow.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.length) + '</td><td class="mono">' +
        (row.plain === 0 ? '0 — underflowed' : row.plain.toExponential(3)) +
        '</td><td class="mono">' + root.Format.fixed(row.log, 2) + '</td><td class="mono">' +
        (row.plain === 0 ? 'NO' : 'yes') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('wgt-underflow-caption', underflow.depth === null
      ? 'Repeating "' + underflow.symbol + '" never underflows within 2 000 steps, because this ' +
        'symbol has the highest emission probability and the self-transition to match — the ' +
        'per-step factor stays close enough to one. That is worth seeing: the failure depends on ' +
        'the model and the data, so "it worked in testing" is exactly what you would expect right ' +
        'up until a different input arrives.'
      : 'Plain probabilities reach exactly zero at length ' +
        root.Format.exact(underflow.depth) + ' for this symbol, and the log column keeps going ' +
        'with no trouble at all. Once the plain version is zero every path ties, so the decoder ' +
        'is choosing arbitrarily rather than failing loudly — which is the dangerous shape of ' +
        'this bug. It does not throw, it does not warn, and the output is still a valid-looking ' +
        'state sequence.');
  }

  function paintSemirings() {
    const rows = [
      { name: 'Tropical (min, +)', along: 'add the weights', between: 'take the minimum',
        computes: 'the shortest path — the standard decoder' },
      { name: 'Viterbi (max, ×)', along: 'multiply probabilities',
        between: 'take the maximum', computes: 'the most probable path — and it underflows' },
      { name: 'Log (max, +)', along: 'add log probabilities', between: 'take the maximum',
        computes: 'the same path as the row above, without underflowing' },
      { name: 'Probability (+, ×)', along: 'multiply', between: 'sum',
        computes: 'the total probability of the observations — the forward algorithm' },
      { name: 'Boolean (∨, ∧)', along: 'require every step', between: 'accept if any path works',
        computes: 'ordinary acceptance — a plain automaton is the Boolean case' },
      { name: 'Counting (+, ×) over integers', along: 'multiply the counts',
        between: 'sum them', computes: 'how many accepting paths there are — the ambiguity ' +
          'measure section 24.9 uses' }
    ];

    root.jQuery('#wgt-semirings tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + row.along + '</td><td>' + row.between +
        '</td><td>' + row.computes + '</td></tr>';
    }).join(''));

    root.Helpers.setText('wgt-semirings-note',
      'Six rows, one algorithm. Fill the trellis left to right, combine along a path with the ' +
      'first operation and between paths with the second, and the semiring decides what you have ' +
      'computed — a shortest path, a best decoding, a total probability, an acceptance test or a ' +
      'path count. The fifth row is the one that reframes the whole milestone: an ordinary ' +
      'automaton is the Boolean case of this, so everything in sections 24.1 to 24.9 has been a ' +
      'weighted automaton with the weights left out.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
