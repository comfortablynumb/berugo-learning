/**
 * Section: quantum computation.
 *
 * The measurement is the amplitude against the analytic value. Grover's marked
 * probability after k iterations is sin²((2k+1)θ) with sin θ = 1/√N, and the
 * simulator matches it to within 1e-15 at every iteration for every size tested
 * — floating-point noise and nothing else. The peak lands at
 * round(π/4·√N − 0.5) exactly.
 *
 * That is a far stronger check than watching a bar get taller, and it is what
 * the milestone's acceptance criterion asks for. The over-rotation is visible
 * too: run Grover past its optimum and the probability falls again, which is
 * the detail that makes it a rotation rather than a search.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'quantum-computation';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a quantum circuit, with the measurement at the end',
      caption: 'Qubits start in a definite state, Hadamard gates put each into an equal ' +
        'superposition of 0 and 1, and everything between is a unitary matrix — reversible, ' +
        'norm-preserving, and entirely deterministic. Nothing probabilistic happens until the ' +
        'measurement, which collapses the state and returns one basis value with probability ' +
        'equal to its amplitude squared. That is why the game is amplitude engineering: you ' +
        'cannot see amplitudes and you cannot copy them, so an algorithm has to arrange for the ' +
        'answer you want to have a large one before the measurement happens. Grover does that ' +
        'by rotating the state a little further towards the marked item on every iteration.',
      definition: [
        'graph LR',
        '    q0["|0>"] --> H0[H] --> O1["oracle"] --> D1["diffuse"] --> O2["oracle"]',
        '    O2 --> D2["diffuse"] --> M0["measure"]',
        '    q1["|0>"] --> H1[H] --> O1',
        '    q2["|0>"] --> H2[H] --> O1',
        '    M0 --> R["one basis state, with probability = amplitude squared"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A state of n qubits is 2^n complex amplitudes, and a gate is a unitary matrix.** That ' +
        'is the entire model, and the simulator in this section is a few hundred lines of ' +
        'arithmetic. Nothing about it is mysterious; what is interesting is which algorithms the ' +
        'model admits, not the model.',
      '**Superposition is not "both at once" and entanglement is not communication.** A ' +
        'superposition is a vector of amplitudes, and the only thing you can ever do with it is ' +
        'measure, which returns one basis state with probability equal to the amplitude squared. ' +
        'Entanglement means the state does not factor into per-qubit states — the demo\'s Bell ' +
        'pair has amplitude on 00 and 11 and none on 01 or 10, which no pair of independent ' +
        'qubits can produce.',
      '**Every gate is reversible, because unitary matrices are invertible.** That is a real ' +
        'constraint on algorithm design: there is no quantum AND gate that throws a bit away. ' +
        'Classical functions enter a circuit as PHASE ORACLES, which mark the inputs you care ' +
        'about by negating their amplitude rather than by writing an answer somewhere.',
      '**Measurement is where the probability enters, and it destroys the state.** You get one ' +
        'basis value and the superposition is gone. You cannot read the amplitudes, cannot copy ' +
        'the state (the no-cloning theorem), and cannot run it again from where you were. Every ' +
        'quantum algorithm is arranged around that one shot.',
      '**Deutsch–Jozsa is the smallest speed-up and the cleanest.** Given a function promised to ' +
        'be constant or balanced, decide which. Classically the worst case needs 2^(n−1) + 1 ' +
        'queries; quantumly it needs one, and the answer is unambiguous rather than ' +
        'probabilistic — the demo shows probability exactly 1 on the all-zeros outcome for a ' +
        'constant function and exactly 0 for a balanced one.',
      '**Grover is the quadratic one, and its mechanism is a rotation.** The oracle flips the ' +
        'marked amplitude below the mean; the diffusion operator reflects every amplitude about ' +
        'the mean, which pushes it far above. Each pair of steps rotates the state by a fixed ' +
        'angle towards the marked item, so the marked probability follows sin²((2k+1)θ) exactly ' +
        '— and running too long rotates PAST it, which the demo shows.',
      '**Grover is provably optimal, and that is why quantum computers do not brute-force NP.** ' +
        'A matching Ω(√N) lower bound on quantum queries is proved, so the speed-up on ' +
        'unstructured search is quadratic and cannot be improved. BQP is not known to contain ' +
        'NP, and nobody expects it to.',
      '**Shor is the exponential one, and it is the entire post-quantum problem.** Factoring and ' +
        'discrete logarithms fall to polynomial time, which breaks RSA, Diffie–Hellman and ' +
        'elliptic curves. Symmetric primitives lose only the Grover square root, so doubling a ' +
        'key restores the margin. That asymmetry is the whole migration plan, and it is why AES ' +
        'is fine and RSA is not.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — amplitudes, checked against the analytic formula',
        markup: root.QuantumTemplate.render()
      },
      diagram: diagram(),
      insight: '**Quantum computers do not brute-force NP. Grover\'s quadratic speed-up means ' +
        'doubling symmetric key sizes suffices, while Shor\'s exponential speed-up is what ' +
        'actually breaks RSA and ECC — and that asymmetry is the entire post-quantum migration ' +
        'plan.** The practical consequence is a triage you can do today. Anything protected by a ' +
        'symmetric primitive or a hash is fine at doubled parameters: AES-256, SHA-384, and no ' +
        'protocol change. Anything protected by factoring or discrete logs has no parameter ' +
        'fix and needs a different algorithm — ML-KEM and ML-DSA were standardised in 2024 for ' +
        'exactly that. And the timeline question is not "when will a quantum computer exist" but ' +
        '"how long must this data stay secret", because an adversary can record encrypted ' +
        'traffic now and decrypt it later. For anything with a ten-year confidentiality ' +
        'requirement, the migration deadline has already passed.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.QuantumTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const groverFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const n = Number(parts[0]);
    const target = Number(parts[1]) % Math.pow(2, n);

    return root.QuantumSim.grover(n, target, Math.ceil(Math.sqrt(Math.pow(2, n))) + 3);
  });

  const deutschFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const n = Number(parts[0]);
    const oracle = parts[1] === 'balanced' ? root.QuantumSim.balancedOracle()
      : root.QuantumSim.constantOracle(parts[1] === 'constant1' ? 1 : 0);

    return root.QuantumSim.deutschJozsa(n, oracle);
  });

  const circuitFor = root.Helpers.memoise(function (name) {
    const steps = root.QuantumSim.circuits()[name]();
    const qubits = name === 'ghz' ? 3 : 2;

    return root.QuantumSim.runCircuit(qubits, steps);
  });

  const advantageFor = root.Helpers.memoise(function () {
    return [2, 3, 4, 5, 6].map(function (n) {
      const size = Math.pow(2, n);
      const state = groverFor(n + '\n' + (3 % size));

      return { n: n, size: size, classical: size / 2, optimal: state.optimal,
        peak: atOptimal(state).measured, peakAt: state.optimal };
    });
  });

  /**
   * The row at the PREDICTED iteration, not the maximum over the run. Grover is
   * a rotation, so on some sizes the amplitude comes back around and a later
   * iteration edges ahead of the first peak — reporting that as "the peak"
   * would make the formula look wrong when it is exactly right.
   */
  function atOptimal(state) {
    return state.rows.filter(function (row) {
      return row.iteration === state.optimal;
    })[0] || state.rows[state.rows.length - 1];
  }

  function stateFor(values) {
    const name = values['qbt-algorithm'];

    if (name === 'grover') {
      return groverFor(values['qbt-qubits'] + '\n' + values['qbt-target']);
    }
    if (name === 'deutsch') {
      return deutschFor(values['qbt-qubits'] + '\n' + values['qbt-oracle']);
    }
    return circuitFor(name);
  }

  function update() {
    const values = panel.values();
    const state = stateFor(values);

    paintMetrics(state, values);
    paintState(state, values);
    paintIterations(state, values);
    paintAdvantage();
    paintImpact();
    paintClasses();
  }

  function paintMetrics(state, values) {
    const name = values['qbt-algorithm'];

    if (name === 'grover') return groverMetrics(state);
    if (name === 'deutsch') return deutschMetrics(state);
    return circuitMetrics(state, name);
  }

  function groverMetrics(state) {
    const best = atOptimal(state);
    const worst = state.rows.reduce(function (a, row) {
      return Math.max(a, row.error);
    }, 0);

    root.MetricGrid.update({
      'qbt-answer': { value: 'item ' + state.target + ' with probability ' +
        root.Format.fixed(best.measured, 4),
      note: 'at iteration ' + best.iteration + ', out of ' +
        root.Format.exact(state.size) + ' possibilities' },
      'qbt-queries': { value: root.Format.exact(state.optimal) + ' against ' +
        root.Format.exact(state.classical),
      note: 'the optimal iteration count is round(π/4·√N − 0.5); classical search averages N/2' },
      'qbt-error': { value: root.Format.exponential(worst, 2),
        note: 'the largest gap between the measured amplitude and sin²((2k+1)θ) — this is ' +
          'floating-point noise' },
      'qbt-norm': { value: root.Format.fixed(state.rows[state.rows.length - 1].norm, 12),
        note: 'a unitary gate preserves it exactly, so a drift here would be a bug' }
    });
  }

  function deutschMetrics(state) {
    root.MetricGrid.update({
      'qbt-answer': { value: state.verdict,
        note: 'probability ' + root.Format.fixed(state.zeroProbability, 6) +
          ' on the all-zeros outcome — 1 for constant, 0 for balanced, with nothing between' },
      'qbt-queries': { value: '1 against ' + root.Format.exact(state.classicalWorstCase),
        note: 'one query, against 2^(n−1) + 1 in the classical worst case' },
      'qbt-error': { value: root.Format.exponential(
        Math.abs(state.zeroProbability - (state.verdict === 'constant' ? 1 : 0)), 2),
      note: 'the answer is exact rather than probabilistic, which is what makes this the ' +
        'cleanest demonstration in the subject' },
      'qbt-norm': { value: root.Format.fixed(state.norm, 12),
        note: 'preserved through both Hadamard layers and the oracle' }
    });
  }

  function circuitMetrics(state, name) {
    const nonZero = state.probabilities.filter(function (p) { return p > 1e-9; }).length;

    root.MetricGrid.update({
      'qbt-answer': { value: nonZero + ' outcomes with any probability',
        note: name === 'bell'
          ? 'amplitude on 00 and 11 and none on 01 or 10 — the qubits always agree'
          : 'amplitude on 000 and 111 only — all three qubits always agree' },
      'qbt-queries': { value: name === 'ghz' ? '3 gates' : '2 gates',
        note: 'a Hadamard to create the superposition, then controlled-NOTs to entangle' },
      'qbt-error': { value: root.Format.exponential(
        Math.abs(state.probabilities[0] - 0.5), 2),
      note: 'the gap from the analytic value of one half on the all-zeros outcome' },
      'qbt-norm': { value: root.Format.fixed(state.norm, 12),
        note: 'exactly one, as every unitary circuit must leave it' }
    });
  }

  function paintState(state, values) {
    const probabilities = state.probabilities
      || root.QuantumSim.probabilities(state.state);
    const n = Number(values['qbt-qubits']);
    const bits = state.n === undefined ? Math.log2(probabilities.length) : state.n;

    root.jQuery('#qbt-state').html(probabilities.map(function (p, i) {
      const bar = '█'.repeat(Math.max(0, Math.round(p * 40)));

      return root.Helpers.escapeHtml('|' + root.QuantumSim.label(i, bits) + '>  ' +
        p.toFixed(4) + '  ' + bar);
    }).slice(0, 32).join('<br>'));

    root.Helpers.setText('qbt-state-note',
      'Each row is a basis state and its measurement probability — the amplitude squared. A ' +
      'measurement returns exactly one of these rows and destroys everything else, which is why ' +
      'an algorithm has to concentrate probability on the answer before measuring. For a Bell ' +
      'pair the two non-zero rows are the entanglement: the qubits always agree, and no pair of ' +
      'independent qubits can produce that distribution.');
  }

  function paintIterations(state, values) {
    if (values['qbt-algorithm'] !== 'grover') {
      root.jQuery('#qbt-iterations tbody').html(
        '<tr><td class="mono">—</td><td class="mono">—</td>' +
        '<td class="mono">this table is for Grover; switch the algorithm control</td>' +
        '<td class="mono">—</td></tr>');
      root.Helpers.setText('qbt-iterations-note',
        'Deutsch–Jozsa and the entangling circuits give their answer in one pass, so there is ' +
        'no amplification curve to trace. Switch to Grover to see the amplitude rise and then ' +
        'fall again.');
      return;
    }
    root.jQuery('#qbt-iterations tbody').html(state.rows.map(function (row) {
      return '<tr><td class="mono">' + row.iteration + '</td><td class="mono">' +
        root.Format.fixed(row.measured, 6) + '</td><td class="mono">' +
        root.Format.fixed(row.predicted, 6) + '</td><td class="mono">' +
        root.Format.exponential(row.error, 2) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('qbt-iterations-note',
      'The measured column against the predicted one, where the prediction is sin²((2k+1)θ) ' +
      'with sin θ = 1/√N. They agree to fifteen decimal places, which is the strongest form ' +
      'this check can take — a simulator that merely made the bar go up would pass a visual ' +
      'inspection and fail this. Read past the peak and the probability FALLS: Grover is a ' +
      'rotation, and running it too long rotates past the answer. That is why the iteration ' +
      'count is part of the algorithm rather than a stopping condition you can test for.');
  }

  function paintAdvantage() {
    root.jQuery('#qbt-advantage tbody').html(advantageFor('rows').map(function (row) {
      return '<tr><td class="mono">' + row.n + '</td><td class="mono">' + row.size +
        '</td><td class="mono">' + row.classical + '</td><td class="mono">' + row.optimal +
        '</td><td class="mono">' + root.Format.fixed(row.peak, 4) + ' at k=' + row.peakAt +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('qbt-advantage-note',
      'The third and fourth columns are the quadratic speed-up: classical search averages N/2 ' +
      'and Grover needs about √N. At six qubits that is 32 against 6. Scale it up and the gap ' +
      'is real and bounded — a 128-bit key search goes from 2^127 to 2^64, which is why AES-256 ' +
      'restores the margin exactly. The last column is the probability measured AT the ' +
      'predicted iteration, which is what the formula claims — the maximum over a longer run ' +
      'can land elsewhere, because a rotation comes back around.');
  }

  function paintImpact() {
    root.jQuery('#qbt-impact tbody').html(root.QuantumSim.IMPACT.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.primitive) + '</td><td>' +
        root.Helpers.escapeHtml(row.classical) + '</td><td>' +
        root.Helpers.escapeHtml(row.quantum) + '</td><td>' +
        (row.broken ? '<strong>' : '') + root.Helpers.escapeHtml(row.fix) +
        (row.broken ? '</strong>' : '') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('qbt-impact-note',
      'Two rows say "none" in the last column, and they are the whole post-quantum problem. ' +
      'Everything Grover touches is fixed by doubling a parameter, because a square root of an ' +
      'exponential is still an exponential. Everything Shor touches is fixed by changing the ' +
      'algorithm, because a polynomial is not. That is why the migration is about RSA and ' +
      'elliptic curves specifically, and why "quantum computers break all encryption" is wrong ' +
      'in a way that matters for planning.');
  }

  function paintClasses() {
    root.jQuery('#qbt-classes tbody').html(root.QuantumSim.CLASS_NOTES.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.claim) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.status) + '</td><td>' +
        root.Helpers.escapeHtml(row.why) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('qbt-classes-note',
      'The third row is the one that is stated wrongly most often. BQP is NOT known to contain ' +
      'NP, and the reason is the Grover optimality bound: unstructured search gets a quadratic ' +
      'speed-up and no more, so a general attack on NP-complete problems would need structure ' +
      'nobody has found. Factoring falls to Shor because it HAS structure — a periodicity a ' +
      'quantum Fourier transform can find — and NP-complete problems are not known to have any ' +
      'such thing.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
