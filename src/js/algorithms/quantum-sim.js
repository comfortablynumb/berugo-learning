/**
 * A state-vector quantum simulator, with every amplitude checkable against an
 * analytic value.
 *
 * The state of n qubits is 2^n complex amplitudes, and a gate is a unitary
 * matrix applied to them. That is the entire model — there is no mysticism in
 * it, and the simulator below is a few hundred lines of arithmetic. What makes
 * quantum computing interesting is not the model but which algorithms the
 * model admits, and two of them are here:
 *
 *   - **Deutsch–Jozsa**, the smallest speed-up: one query where a classical
 *     algorithm needs 2^(n−1) + 1 in the worst case.
 *   - **Grover**, the quadratic one: sqrt(N) queries where classical search
 *     needs N/2 on average. The marked amplitude follows sin((2k+1)θ) exactly,
 *     and the demo checks the measured amplitude against that formula rather
 *     than eyeballing the curve.
 *
 * The asymmetry between those two speed-ups is the whole post-quantum
 * migration plan: Grover is quadratic, so doubling a symmetric key restores
 * the margin, and Shor is exponential, so RSA and ECC have no such fix.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.QuantumSim = api;
}(this, function () {
  'use strict';

  const ROOT_HALF = Math.SQRT1_2;

  /* ---------------------------------------------------------- the state */

  /** n qubits, all zero: amplitude 1 on |00…0> and 0 everywhere else. */
  function zeroState(n) {
    const size = Math.pow(2, n);
    const real = new Array(size).fill(0);
    const imag = new Array(size).fill(0);

    real[0] = 1;
    return { n: n, size: size, real: real, imag: imag };
  }

  function clone(state) {
    return { n: state.n, size: state.size, real: state.real.slice(),
      imag: state.imag.slice() };
  }

  /** The probability of each basis state — amplitude squared, which is the
   *  only place the complex numbers become observable. */
  function probabilities(state) {
    return state.real.map(function (re, i) {
      return re * re + state.imag[i] * state.imag[i];
    });
  }

  /** The total probability, which must stay at 1: a unitary gate preserves it,
   *  and a drift away from 1 is the cheapest possible bug detector. */
  function norm(state) {
    return probabilities(state).reduce(function (a, b) { return a + b; }, 0);
  }

  function label(index, n) {
    return index.toString(2).padStart(n, '0');
  }

  /* ---------------------------------------------------------- the gates */

  /**
   * Apply a single-qubit 2x2 matrix to one qubit, by pairing every basis state
   * with the one differing in that bit. That pairing is why a single-qubit
   * gate costs 2^n work and not 4^n — it is 2^(n−1) independent 2x2 products.
   */
  function apply1(state, qubit, matrix) {
    const stride = Math.pow(2, qubit);

    for (let i = 0; i < state.size; i += 1) {
      if ((i & stride) !== 0) continue;
      const j = i | stride;
      const ar = state.real[i];
      const ai = state.imag[i];
      const br = state.real[j];
      const bi = state.imag[j];

      state.real[i] = matrix[0] * ar - matrix[1] * ai + matrix[2] * br - matrix[3] * bi;
      state.imag[i] = matrix[0] * ai + matrix[1] * ar + matrix[2] * bi + matrix[3] * br;
      state.real[j] = matrix[4] * ar - matrix[5] * ai + matrix[6] * br - matrix[7] * bi;
      state.imag[j] = matrix[4] * ai + matrix[5] * ar + matrix[6] * bi + matrix[7] * br;
    }
    return state;
  }

  /* Matrices as [re00, im00, re01, im01, re10, im10, re11, im11]. */
  const MATRICES = {
    h: [ROOT_HALF, 0, ROOT_HALF, 0, ROOT_HALF, 0, -ROOT_HALF, 0],
    x: [0, 0, 1, 0, 1, 0, 0, 0],
    y: [0, 0, 0, -1, 0, 1, 0, 0],
    z: [1, 0, 0, 0, 0, 0, -1, 0],
    s: [1, 0, 0, 0, 0, 0, 0, 1],
    t: [1, 0, 0, 0, 0, 0, ROOT_HALF, ROOT_HALF]
  };

  function gate(state, name, qubit) {
    return apply1(state, qubit, MATRICES[name]);
  }

  function hadamardAll(state) {
    for (let q = 0; q < state.n; q += 1) gate(state, 'h', q);
    return state;
  }

  /** Controlled-NOT: flip the target where the control is 1. Entanglement
   *  enters here and nowhere else in this gate set. */
  function cnot(state, control, target) {
    const cBit = Math.pow(2, control);
    const tBit = Math.pow(2, target);

    for (let i = 0; i < state.size; i += 1) {
      if ((i & cBit) === 0 || (i & tBit) !== 0) continue;
      const j = i | tBit;
      const re = state.real[i];
      const im = state.imag[i];

      state.real[i] = state.real[j];
      state.imag[i] = state.imag[j];
      state.real[j] = re;
      state.imag[j] = im;
    }
    return state;
  }

  /** A phase oracle: negate the amplitude of every basis state the predicate
   *  marks. This is how a classical function enters a quantum circuit. */
  function phaseOracle(state, marks) {
    for (let i = 0; i < state.size; i += 1) {
      if (!marks(i)) continue;
      state.real[i] = -state.real[i];
      state.imag[i] = -state.imag[i];
    }
    return state;
  }

  /* ------------------------------------------------------------- Grover */

  /**
   * Grover's diffusion operator: reflect every amplitude about the mean. That
   * one sentence is the whole of it, and it is why the algorithm works —
   * the oracle flips the marked amplitude below the mean, and the reflection
   * then pushes it far above.
   */
  function diffuse(state) {
    let mean = 0;
    let meanImag = 0;

    for (let i = 0; i < state.size; i += 1) {
      mean += state.real[i];
      meanImag += state.imag[i];
    }
    mean /= state.size;
    meanImag /= state.size;
    for (let i = 0; i < state.size; i += 1) {
      state.real[i] = 2 * mean - state.real[i];
      state.imag[i] = 2 * meanImag - state.imag[i];
    }
    return state;
  }

  /**
   * Grover's search over n qubits with one marked item, run for `iterations`
   * rounds, reporting the marked probability after each.
   *
   * The predicted amplitude after k iterations is sin((2k+1)theta) where
   * sin(theta) = 1/sqrt(N). The demo compares the measured value to that
   * formula at every step, which is a far stronger check than "the bar got
   * taller".
   */
  function grover(n, target, iterations) {
    const size = Math.pow(2, n);
    const theta = Math.asin(1 / Math.sqrt(size));
    const state = hadamardAll(zeroState(n));
    const marks = function (i) { return i === target; };
    const rows = [];

    rows.push(groverRow(state, target, 0, theta));
    for (let k = 1; k <= iterations; k += 1) {
      phaseOracle(state, marks);
      diffuse(state);
      rows.push(groverRow(state, target, k, theta));
    }
    return { n: n, size: size, target: target, theta: theta, rows: rows, state: state,
      optimal: Math.round((Math.PI / 4) * Math.sqrt(size) - 0.5),
      classical: size / 2 };
  }

  function groverRow(state, target, k, theta) {
    const measured = probabilities(state)[target];
    const predicted = Math.pow(Math.sin((2 * k + 1) * theta), 2);

    return { iteration: k, measured: measured, predicted: predicted,
      error: Math.abs(measured - predicted), norm: norm(state) };
  }

  /* ------------------------------------------------------ Deutsch–Jozsa */

  /**
   * Deutsch–Jozsa: given a function promised to be constant or balanced,
   * decide which. Classically the worst case needs 2^(n−1) + 1 queries;
   * quantumly it needs one.
   *
   * The measurement is unambiguous rather than probabilistic: a constant
   * function leaves all the amplitude on |00…0> and a balanced one leaves
   * none there at all, which is why this is the cleanest demonstration in the
   * subject even though the problem itself is artificial.
   */
  function deutschJozsa(n, oracle) {
    const state = hadamardAll(zeroState(n));

    phaseOracle(state, function (i) { return oracle(i) === 1; });
    hadamardAll(state);
    const probs = probabilities(state);

    return { n: n, zeroProbability: probs[0],
      verdict: probs[0] > 0.5 ? 'constant' : 'balanced',
      queries: 1, classicalWorstCase: Math.pow(2, n - 1) + 1,
      probabilities: probs, norm: norm(state) };
  }

  function constantOracle(value) {
    return function () { return value; };
  }

  /** Balanced by the parity of the index, which is the standard example and
   *  is exactly the PARITY function the circuits section shows is not in AC⁰. */
  function balancedOracle() {
    return function (i) {
      let bits = i;
      let parity = 0;

      while (bits) { parity ^= bits & 1; bits >>= 1; }
      return parity;
    };
  }

  /* ------------------------------------------------------------ circuits */

  /** A named circuit, applied step by step so the demo can show the state
   *  after each gate. */
  function runCircuit(n, steps) {
    const state = zeroState(n);
    const trace = [{ step: 0, gate: 'start', probabilities: probabilities(state),
      norm: norm(state) }];

    steps.forEach(function (step, i) {
      if (step.gate === 'cnot') cnot(state, step.control, step.target);
      else gate(state, step.gate, step.qubit);
      trace.push({ step: i + 1,
        gate: step.gate + (step.gate === 'cnot'
          ? ' ' + step.control + '→' + step.target : ' q' + step.qubit),
        probabilities: probabilities(state), norm: norm(state) });
    });
    return { state: state, trace: trace, probabilities: probabilities(state),
      norm: norm(state) };
  }

  /** The Bell pair: the two-line circuit that produces entanglement, and the
   *  standard first thing anybody runs. */
  function bell() {
    return [{ gate: 'h', qubit: 0 }, { gate: 'cnot', control: 0, target: 1 }];
  }

  /** GHZ: three qubits, all correlated. */
  function ghz() {
    return [{ gate: 'h', qubit: 0 }, { gate: 'cnot', control: 0, target: 1 },
      { gate: 'cnot', control: 1, target: 2 }];
  }

  /** Two Hadamards are the identity, which is the reversibility of the model
   *  in its smallest form and a useful sanity check. */
  function selfInverse() {
    return [{ gate: 'h', qubit: 0 }, { gate: 'h', qubit: 0 }];
  }

  function circuits() {
    return { bell: bell, ghz: ghz, selfInverse: selfInverse };
  }

  /* --------------------------------------------------------- what it means */

  /** The comparison table this section really exists for. */
  const IMPACT = [
    { primitive: 'AES-128', classical: '2^128 operations', quantum: '2^64 by Grover',
      fix: 'use AES-256; the quadratic speed-up is answered by doubling the key',
      broken: false },
    { primitive: 'SHA-256 preimage', classical: '2^256', quantum: '2^128 by Grover',
      fix: 'already comfortable; SHA-384 if you want the margin', broken: false },
    { primitive: 'RSA-2048', classical: 'best known is sub-exponential (number field sieve)',
      quantum: 'polynomial, by Shor',
      fix: 'none — migrate to a post-quantum scheme', broken: true },
    { primitive: 'ECDH / ECDSA P-256', classical: '2^128 by Pollard rho',
      quantum: 'polynomial, by Shor',
      fix: 'none — the discrete log falls to the same algorithm', broken: true },
    { primitive: 'ML-KEM (Kyber)', classical: 'lattice reduction, exponential',
      quantum: 'no known polynomial attack',
      fix: 'this IS the fix; standardised by NIST in 2024', broken: false },
    { primitive: 'SLH-DSA (SPHINCS+)', classical: 'hash security',
      quantum: 'Grover on the hash only',
      fix: 'conservative by construction, at the cost of large signatures', broken: false }
  ];

  /** Where BQP sits, which is the fact most often stated wrongly. */
  const CLASS_NOTES = [
    { claim: 'BQP contains P', status: 'known', why: 'a quantum computer can run a classical one' },
    { claim: 'BQP contains factoring', status: 'known', why: 'Shor’s algorithm' },
    { claim: 'BQP contains NP', status: 'NOT known, and widely doubted',
      why: 'Grover gives a quadratic speed-up on unstructured search and no more; a general ' +
        'NP-complete speed-up would need structure nobody has found' },
    { claim: 'BQP is contained in PSPACE', status: 'known',
      why: 'simulate the state vector, summing amplitudes in polynomial space' },
    { claim: 'P = BQP', status: 'open', why: 'no separation is proved either way' }
  ];

  return {
    ROOT_HALF: ROOT_HALF, MATRICES: MATRICES, IMPACT: IMPACT, CLASS_NOTES: CLASS_NOTES,
    zeroState: zeroState, clone: clone, probabilities: probabilities, norm: norm,
    label: label, apply1: apply1, gate: gate, hadamardAll: hadamardAll, cnot: cnot,
    phaseOracle: phaseOracle, diffuse: diffuse, grover: grover,
    deutschJozsa: deutschJozsa, constantOracle: constantOracle, balancedOracle: balancedOracle,
    runCircuit: runCircuit, bell: bell, ghz: ghz, selfInverse: selfInverse, circuits: circuits
  };
}));
