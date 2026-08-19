/**
 * Sorting networks: a sort with no branches, no data dependence and a fixed
 * shape - which is exactly what a GPU, an FPGA or a SIMD lane wants and
 * exactly what a CPU running one comparison at a time does not.
 *
 * A network is a list of compare-exchange pairs, applied in a fixed order
 * whatever the data. Nothing is decided at run time: the same 63 comparators
 * run for a sorted input and a reversed one. That is the trade. Bitonic sort
 * does O(n log² n) comparisons where merge sort does O(n log n) - strictly
 * more work - but it does them in O(log² n) *rounds*, and every comparator in
 * a round is independent, so with enough parallelism the depth is the time.
 *
 * The zero-one principle is why a network can be verified at all: a
 * comparator network sorts every input of arbitrary values if and only if it
 * sorts every input of 0s and 1s. That turns "is this network correct" from
 * an infinite question into 2^n finite ones, and `verifyZeroOne` does exactly
 * that - which is how the deliberately-broken network in the demo is caught.
 *
 * Bitonic sort needs a power-of-two length. Padding to the next power of two
 * with +Infinity is the standard fix and is not free: at n = 1 025 it doubles
 * the work, and the section shows that cliff rather than hiding it.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SortingNetworks = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /** A comparator: if the values at `a` and `b` are out of the wanted order,
   *  exchange them. `ascending` false builds the descending half a bitonic
   *  merge needs. */
  function compareExchange(array, a, b, ascending, ops) {
    const order = ops.cmp(array[a], array[b]);
    if (ascending ? order > 0 : order < 0) ops.swap(array, a, b);
  }

  /**
   * Batcher's bitonic sort, as a list of comparators rather than as a
   * recursion, so the network can be drawn and its depth measured.
   *
   * Each comparator carries the round it belongs to. Two comparators in the
   * same round touch disjoint wires, so a machine with enough lanes runs a
   * whole round at once - and the number of rounds, not the number of
   * comparators, is what that machine pays.
   */
  function bitonicNetwork(n) {
    const comparators = [];
    let round = 0;

    for (let k = 2; k <= n; k *= 2) {
      /* Integer halving. `j /= 2` looks equivalent and is not: it walks off
         into 0.5, 0.25, … and only reaches zero after a thousand denormal
         steps, so the stage counter - the depth - comes out meaningless
         while the comparator list stays correct. */
      for (let j = k >> 1; j > 0; j >>= 1) {
        for (let i = 0; i < n; i += 1) {
          const partner = i ^ j;
          if (partner <= i) continue;
          comparators.push({ a: i, b: partner, ascending: (i & k) === 0, round: round });
        }
        round += 1;
      }
    }
    return { size: n, comparators: comparators, rounds: round, depth: round };
  }

  /**
   * Batcher's odd-even merge sort. Fewer comparators than bitonic at the same
   * size and the same O(log² n) depth, and it is the one people actually
   * build in hardware - bitonic is the one people teach because its recursion
   * is prettier.
   */
  function oddEvenNetwork(n) {
    const comparators = [];

    for (let p = 1; p < n; p *= 2) {
      for (let k = p; k >= 1; k >>= 1) {
        for (let j = k % p; j <= n - 1 - k; j += 2 * k) {
          for (let i = 0; i <= Math.min(k - 1, n - j - k - 1); i += 1) {
            if (Math.floor((i + j) / (p * 2)) === Math.floor((i + j + k) / (p * 2))) {
              comparators.push({ a: i + j, b: i + j + k, ascending: true, round: 0 });
            }
          }
        }
      }
    }
    return withRounds(n, comparators);
  }

  /**
   * Assign each comparator the earliest round in which both its wires are
   * free. This is what makes "depth" a measurement rather than a formula, and
   * it is the number a parallel implementation is bounded by.
   */
  function withRounds(n, comparators) {
    const freeAt = new Array(n).fill(0);
    let depth = 0;

    comparators.forEach(function (comparator) {
      const round = Math.max(freeAt[comparator.a], freeAt[comparator.b]);
      comparator.round = round;
      freeAt[comparator.a] = round + 1;
      freeAt[comparator.b] = round + 1;
      if (round + 1 > depth) depth = round + 1;
    });

    return { size: n, comparators: comparators, rounds: depth, depth: depth };
  }

  /** An insertion network - the naive n(n-1)/2 comparators - for the size
   *  comparison. It is correct, it is tiny to state, and its depth is 2n-3,
   *  which is the number that rules it out for hardware. */
  function insertionNetwork(n) {
    const comparators = [];
    for (let i = 1; i < n; i += 1) {
      for (let j = i; j > 0; j -= 1) comparators.push({ a: j - 1, b: j, ascending: true, round: 0 });
    }
    return withRounds(n, comparators);
  }

  /** Run a network over an array. Padding to a power of two happens here, not
   *  in the network, so the pad cost is visible in the report. */
  function apply(network, values, ops) {
    const padded = values.slice();
    let pad = 0;
    while (padded.length < network.size) { padded.push(Infinity); pad += 1; }
    if (pad) ops.alloc(pad);

    network.comparators.forEach(function (comparator) {
      compareExchange(padded, comparator.a, comparator.b, comparator.ascending, ops);
    });

    for (let i = 0; i < values.length; i += 1) ops.write(values, i, padded[i]);
    return { padded: pad, comparators: network.comparators.length, depth: network.depth };
  }

  /**
   * The zero-one principle, applied exhaustively.
   *
   * A comparator network sorts all inputs if and only if it sorts all 2^n
   * inputs of zeros and ones. So a network of 8 wires is fully verified by
   * 256 runs, which is a complete proof rather than a sample - and it is the
   * only verification technique in this milestone that is exhaustive.
   */
  function verifyZeroOne(network) {
    const n = network.size;
    if (n > 16) return { checked: 0, failures: 0, exhaustive: false, reason: 'n > 16' };

    const total = 1 << n;
    let failures = 0;
    let firstFailure = null;

    for (let mask = 0; mask < total; mask += 1) {
      const wires = [];
      for (let i = 0; i < n; i += 1) wires.push((mask >>> i) & 1);
      const input = wires.slice();

      network.comparators.forEach(function (comparator) {
        const a = wires[comparator.a];
        const b = wires[comparator.b];
        const wantSwap = comparator.ascending ? a > b : a < b;
        if (wantSwap) { wires[comparator.a] = b; wires[comparator.b] = a; }
      });

      for (let i = 1; i < n; i += 1) {
        if (wires[i - 1] > wires[i]) {
          failures += 1;
          if (!firstFailure) firstFailure = { input: input, output: wires.slice() };
          break;
        }
      }
    }

    return {
      checked: total, failures: failures, exhaustive: true,
      sorts: failures === 0, firstFailure: firstFailure
    };
  }

  /** Delete one comparator, so the demo has a broken network the zero-one
   *  check can catch. Which one is deleted matters: some deletions are caught
   *  by 1 of 256 inputs. */
  function withoutComparator(network, index) {
    const comparators = network.comparators.filter(function (unused, at) { return at !== index; });
    return { size: network.size, comparators: comparators, rounds: network.rounds, depth: network.depth };
  }

  /** How many of the 2^n zero-one inputs catch each single-comparator
   *  deletion. The minimum over the network is the interesting figure: it is
   *  how lucky a random test would have to be. */
  function deletionSensitivity(network) {
    return network.comparators.map(function (comparator, index) {
      const broken = withoutComparator(network, index);
      const result = verifyZeroOne(broken);
      return { index: index, a: comparator.a, b: comparator.b, caughtBy: result.failures, of: result.checked };
    });
  }

  const NETWORKS = {
    bitonic: { label: 'bitonic (Batcher)', build: bitonicNetwork, powerOfTwo: true },
    'odd-even': { label: 'odd-even merge (Batcher)', build: oddEvenNetwork, powerOfTwo: true },
    insertion: { label: 'insertion network', build: insertionNetwork, powerOfTwo: false }
  };

  function nextPowerOfTwo(n) {
    let size = 1;
    while (size < n) size *= 2;
    return size;
  }

  /** The size/depth table the section compares against a sequential sort. */
  function costTable(sizes) {
    return sizes.map(function (n) {
      const padded = nextPowerOfTwo(n);
      const bitonic = bitonicNetwork(padded);
      const oddEven = oddEvenNetwork(padded);
      return {
        n: n, padded: padded, padding: padded - n,
        bitonicComparators: bitonic.comparators.length, bitonicDepth: bitonic.depth,
        oddEvenComparators: oddEven.comparators.length, oddEvenDepth: oddEven.depth,
        sequential: Math.round(n * Math.max(1, Math.log2(Math.max(2, n))))
      };
    });
  }

  return {
    compareExchange: compareExchange,
    bitonicNetwork: bitonicNetwork,
    oddEvenNetwork: oddEvenNetwork,
    insertionNetwork: insertionNetwork,
    apply: apply,
    verifyZeroOne: verifyZeroOne,
    withoutComparator: withoutComparator,
    deletionSensitivity: deletionSensitivity,
    nextPowerOfTwo: nextPowerOfTwo,
    costTable: costTable,
    networks: NETWORKS,
    kinds: Object.keys(NETWORKS)
  };
}));
