/**
 * Section: Fourier transforms and signal processing.
 *
 * Three things are being measured rather than asserted here.
 *
 * The butterfly count is exactly (n/2)log2(n) - not "about", exactly - and it
 * sits beside the naive DFT's n^2 so the saving is a ratio in a column rather
 * than an asymptotic claim. At n = 256 that is 64x.
 *
 * The leakage table is the one people find surprising. A pure sine wave whose
 * frequency lands between bins smears across the whole spectrum, and the fix
 * is not more resolution - it is a window, which changes how the captured
 * segment ENDS. Rectangular leaves a 74x peak-to-sidelobe ratio; Blackman
 * leaves 54 709x, on the same signal.
 *
 * And aliasing is a table of where each frequency lands, because "it appears
 * somewhere else" is much less convincing than seeing 1100 Hz show up at 100.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'fourier-transforms';
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
      title: 'Diagram — one radix-2 butterfly stage, and why the input arrives bit-reversed',
      caption: 'Each stage pairs elements a fixed distance apart, multiplies one by a twiddle ' +
        'factor, and produces a sum and a difference — that is the butterfly, and it is two ' +
        'operations for two outputs. The recursion splits even-indexed from odd-indexed samples ' +
        'at every level, and applying that split repeatedly lands each sample at the position ' +
        'given by its index with the bits reversed. Permuting the input by bit-reversal up front ' +
        'is what lets the iterative version work in place, with no recursion and no extra array.',
      definition: [
        'flowchart LR',
        '    A["x0"] --> P["bit-reversal<br/>permutation"]',
        '    B["x1"] --> P',
        '    C["x2"] --> P',
        '    D["x3"] --> P',
        '    P --> S1["stage 1<br/>pairs 1 apart"]',
        '    S1 --> S2["stage 2<br/>pairs 2 apart"]',
        '    S2 --> S3["...log2(n) stages,<br/>n/2 butterflies each"]',
        '    S3 --> O["X0..Xn-1, in order"]',
        '    T["twiddle w = exp(-2*pi*i*k/n)"] -.-> S1',
        '    T -.-> S2'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The DFT asks one question n times: how much of frequency k is in this signal?** Each ' +
        'answer is a sum over all n samples multiplied by a complex exponential, so the whole ' +
        'transform is a matrix–vector product costing n².',
      'It is also perfectly invertible, because the signal and its spectrum are the same ' +
        'information in two bases.',
      'That is why filtering in the frequency domain and transforming back is a legitimate ' +
        'operation rather than an approximation.',
      '**The FFT computes exactly that, in (n/2)log₂n butterflies.** Splitting the sum into ' +
        'even-indexed and odd-indexed samples produces two half-size transforms plus a twiddle ' +
        'multiply.',
      'Recursing gives log₂n stages of n/2 butterflies each. The result is the same numbers to ' +
        'rounding, and the demo checks it against the naive DFT.',
      'At n = 256 it costs 64 times fewer operations. This algorithm is the reason real-time ' +
        'spectral processing exists at all.',
      '**Leakage is what happens when a frequency does not land exactly on a bin.** The transform ' +
        'assumes the segment you gave it repeats forever.',
      'If the wave does not fit a whole number of times, the wrap-around has a discontinuity, and a ' +
        'discontinuity has energy at every frequency.',
      'The result is a pure tone smeared across the entire spectrum. Windows fix it by tapering the ' +
        'segment to zero at both ends, which removes the jump.',
      '**Aliasing is not recoverable and the fix has to happen before sampling.** Anything above ' +
        'half the sample rate folds back and appears as a lower frequency, indistinguishable from ' +
        'a real component at that frequency.',
      'Once the samples are taken the information is gone. No filter afterwards can separate them.',
      'That is why an anti-aliasing filter is analogue and sits before the converter, and why the ' +
        'same problem in a metrics pipeline has to be fixed at collection.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — butterflies, windows, aliasing and exact convolution',
        markup: root.FourierTransformsTemplate.render()
      },
      diagram: diagram(),
      insight: 'Aliasing is not an audio curiosity. An undersampled metrics dashboard shows ' +
        'phantom periodicity for exactly the same reason, and the fix is exactly the same: filter ' +
        'before you sample. A CPU spike every 55 seconds, scraped once a minute, appears as a slow ' +
        'oscillation with a period of about eleven minutes. No amount of analysis on the stored ' +
        'series can distinguish that from a real eleven-minute cycle, because at the sampling ' +
        'instants they are the same numbers. The general rule is worth carrying beyond signals. ' +
        '**When you reduce the rate of anything — sampling, logging, polling — average over the ' +
        'interval rather than taking an instantaneous reading.** The average is a low-pass filter, ' +
        'and it is the difference between a downsampled series and a fictional one.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.FourierTransformsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const raceFor = root.Helpers.memoise(function () {
    return root.AnalysisLab.transformRace({});
  });

  const roundTripFor = root.Helpers.memoise(function () {
    return root.AnalysisLab.roundTripStudy();
  });

  const spectrumFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.AnalysisLab.spectrumRun({
      window: parts[0], size: Number(parts[1]), rate: Number(parts[1]),
      components: [{ frequency: Number(parts[2]) / 2, amplitude: 1 },
        { frequency: 40, amplitude: 0.4 }]
    });
  });

  const leakageFor = root.Helpers.memoise(function (key) {
    return root.AnalysisLab.leakageStudy({ frequency: Number(key) / 2 });
  });

  const aliasFor = root.Helpers.memoise(function () {
    return root.AnalysisLab.aliasTable({});
  });

  const convolutionFor = root.Helpers.memoise(function () {
    return root.AnalysisLab.convolutionRace({});
  });

  function update(app) {
    const values = panel.values();
    const race = raceFor('');
    const leakage = leakageFor(values['ft-frequency']);

    paintMetrics(race, roundTripFor(''), leakage, values['ft-window']);
    paintChart(app, spectrumFor(values['ft-window'] + '|' + values['ft-size'] + '|' +
      values['ft-frequency']));
    paintRace(race);
    paintWindows(leakage, values['ft-window']);
    paintAlias(aliasFor(''));
    paintConvolution(convolutionFor(''));
  }

  function windowOf(rows, id) {
    return rows.filter(function (row) { return row.id === id; })[0] || rows[0];
  }

  function paintMetrics(race, roundTrip, leakage, windowId) {
    const at256 = race[race.length - 1];
    const largest = roundTrip[roundTrip.length - 1];

    root.MetricGrid.update({
      'ft-butterflies': { value: root.Format.count(at256.butterflies),
        note: 'the naive DFT needs ' + root.Format.exact(at256.naiveOperations) },
      'ft-saving': { value: root.Format.fixed(at256.saving, 1) + '×',
        note: 'at n = ' + root.Format.exact(at256.n) },
      'ft-roundtrip': { value: root.Format.exponential(largest.relativeError, 2),
        note: 'the milestone asks for better than 1e-10' },
      'ft-leakage': { value: root.Format.count(Math.round(windowOf(leakage, windowId).ratio)) + '×',
        note: 'rectangular leaves ' +
          root.Format.count(Math.round(windowOf(leakage, 'rectangular').ratio)) + '×' }
    });
  }

  function paintChart(app, spectrum) {
    const host = root.jQuery('#ft-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.FunctionPlot.curves(host, {
      lazyLib: app.lazyLib,
      height: 250,
      xLabel: 'frequency (Hz)',
      yLabel: 'magnitude',
      series: [{ label: 'magnitude spectrum',
        points: spectrum.magnitudes.map(function (value, index) {
          return { x: spectrum.bins[index], y: value };
        }) }],
      legendHost: root.jQuery('#ft-legend')[0]
    });

    root.Helpers.setText('ft-chart-note',
      'Two components went in, at ' +
      spectrum.components.map(function (component) {
        return root.Format.fixed(component.frequency, 1) + ' Hz';
      }).join(' and ') + '. If a frequency lands exactly on a bin, the transform shows a single ' +
      'clean spike. Set the frequency slider to an odd value — half-integer frequencies — and ' +
      'watch the spike spread into a skirt covering the whole axis: the segment no longer holds a ' +
      'whole number of cycles, so the assumed periodic extension has a jump in it, and the jump ' +
      'has energy everywhere. Then change the window and watch the skirt collapse.');
  }

  function paintRace(rows) {
    root.jQuery('#ft-race tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.n + '</td><td>' + root.Format.exact(row.butterflies) + '</td><td>' +
        root.Format.exact(row.expected) + '</td><td>' + root.Format.exact(row.naiveOperations) +
        '</td><td class="mono">' + root.Format.fixed(row.saving, 1) + '×</td><td class="mono">' +
        root.Format.exponential(row.difference, 2) + '</td></tr>';
    }).join(''));

    const last = rows[rows.length - 1];
    root.Helpers.setText('ft-race-note',
      'The second and third columns are equal on every row: the butterfly count is exactly ' +
      '(n/2)log₂n, not approximately it. The last column is the difference between the FFT’s ' +
      'answer and the naive DFT’s — ' + root.Format.exponential(last.difference, 1) +
      ' at n = ' + root.Format.exact(last.n) + ', which is accumulated rounding and nothing else. ' +
      'The FFT is not an approximation of the transform; it is the same transform computed by ' +
      'noticing that the n² multiplications contain only n distinct values, arranged so that most ' +
      'of the work is shared.');
  }

  function paintWindows(rows, chosen) {
    root.jQuery('#ft-windows tbody').html(rows.map(function (row) {
      return '<tr' + (row.id === chosen ? ' class="matrix-row-lit"' : '') + '><td>' + row.label +
        '</td><td class="mono">' + root.Format.fixed(row.peak, 3) + '</td><td class="mono">' +
        root.Format.exponential(row.sidelobe, 2) + '</td><td class="mono">' +
        root.Format.count(Math.round(row.ratio)) + '×</td></tr>';
    }).join(''));

    const rect = windowOf(rows, 'rectangular');
    const blackman = windowOf(rows, 'blackman');
    root.Helpers.setText('ft-windows-note',
      'One sine wave, at a frequency deliberately placed between bins. With no window the worst ' +
      'distant sidelobe is only ' + root.Format.exact(Math.round(rect.ratio)) +
      '× below the peak — a second tone 40 dB quieter would be invisible under that skirt. ' +
      'Blackman gets it to ' + root.Format.exact(Math.round(blackman.ratio)) + '×. The cost is ' +
      'in the peak column: windowing throws away signal at the edges, so the peak is lower and ' +
      'slightly wider. That is the whole trade — resolution against dynamic range — and it is why ' +
      'there are several windows rather than one best one. It is also not a ladder: Hamming ' +
      'scores ' + root.Format.exact(Math.round(windowOf(rows, 'hamming').ratio)) + '× against ' +
      'Hann’s ' + root.Format.exact(Math.round(windowOf(rows, 'hann').ratio)) + '× on this ' +
      'measurement, because Hamming is tuned to flatten the FIRST sidelobe and pays for it with ' +
      'a slower roll-off further out — and “further out” is what this column measures.');
  }

  function paintAlias(rows) {
    root.jQuery('#ft-alias tbody').html(rows.map(function (row) {
      return '<tr' + (row.aliased ? ' class="matrix-row-lit"' : '') + '><td class="mono">' +
        root.Format.count(row.frequency) + ' Hz</td><td class="mono">' +
        root.Format.count(row.apparent) + ' Hz</td><td>' +
        (row.aliased ? 'yes — and it cannot be undone' : 'no') + '</td></tr>';
    }).join(''));

    const aliased = rows.filter(function (row) { return row.aliased; });
    root.Helpers.setText('ft-alias-note',
      'The sample rate is 1 kHz, so the Nyquist limit is 500 Hz and ' +
      root.Format.exact(aliased.length) + ' of these ' + root.Format.exact(rows.length) +
      ' components fold. 700 Hz appears at 300, 1100 appears at 100 — and once the samples exist ' +
      'there is nothing in them that distinguishes a 1100 Hz tone from a 100 Hz one, because at ' +
      'the sampling instants the two waves take the same values. That is why an anti-aliasing ' +
      'filter is analogue and sits before the converter: it is the last moment at which the ' +
      'information still exists.');
  }

  function paintConvolution(study) {
    const rows = [
      { label: 'schoolbook', operations: study.naiveOperations, values: study.naive,
        matches: true },
      { label: 'through the FFT, then rounded', operations: study.fftButterflies,
        values: study.fft, matches: study.fftMatches },
      { label: 'number-theoretic transform, exact integers',
        operations: study.fftButterflies, values: study.exact, matches: study.nttMatches }
    ];

    root.jQuery('#ft-convolution tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' + root.Format.count(row.operations) +
        '</td><td class="mono">' + (row.values ? row.values.join(', ') : '—') + '</td><td>' +
        (row.matches ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ft-convolution-note',
      'Multiplying two polynomials is convolving their coefficients, so the convolution theorem — ' +
      'transform both, multiply pointwise, transform back — turns an n² multiplication into an ' +
      'n log n one. Read the operations column before believing that: at these lengths the ' +
      'schoolbook method costs ' + root.Format.exact(study.naiveOperations) + ' operations and ' +
      'the transform route costs ' + root.Format.exact(study.fftButterflies) + '. Asymptotically ' +
      'better is losing here, because n log n only beats n² once n is large enough to pay for ' +
      'three transforms, and every library that uses this has a length threshold below which it ' +
      'calls the quadratic routine instead. Through the FFT the answer is floating point and has ' +
      'to be rounded: the worst ' +
      'error here is ' + root.Format.exponential(study.worstFloatError, 2) + ', comfortably ' +
      'roundable, but that is a fact about these inputs and not a guarantee. The NTT does the same ' +
      'algorithm in modular integer arithmetic, so it is exact with no rounding at all, valid ' +
      'while the largest possible coefficient (' +
      root.Format.count(study.bound.largestPossible) + ' here) stays under the modulus — ' +
      root.Format.count(study.bound.modulus) + ', with ' +
      root.Format.count(Math.round(study.bound.headroom)) + '× of headroom. This is how big ' +
      'integers get multiplied, and it connects straight back to Karatsuba in 17.8.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
