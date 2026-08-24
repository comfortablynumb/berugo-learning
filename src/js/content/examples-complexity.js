/** Worked examples for time, space, randomised classes and circuits (M26.5-M26.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'time-complexity-classes': [
      {
        title: 'What each growth rate costs, at a billion operations a second',
        goal: 'Turn "exponential" from a word into a number of years.',
        setup: 'Eight growth rates at n = 40 and a machine doing 10^9 operations per second, ' +
          'with the wall clock computed for each.',
        steps: [
          { do: 'Compute n log n and n² at n = 40.',
            why: 'The rates nobody worries about.',
            work: '213 and 1 600 operations — microseconds' },
          { do: 'Compute n¹⁰.', why: 'Polynomial, in P, and already hopeless.',
            work: '1.05 × 10^16 operations — about four months at a billion per second' },
          { do: 'Compute 2ⁿ at n = 40.', why: 'Exponential, and still fine.',
            work: '1.10 × 10^12 operations — about eighteen minutes' },
          { do: 'Compute 2ⁿ at n = 60.', why: 'Twenty more inputs.',
            work: '1.15 × 10^18 operations — about 36 years' },
          { do: 'Find the largest n that fits in a year, at four machine speeds.',
            why: 'Faster hardware barely moves the boundary.',
            work: 'n = 44 at 10^6 ops/s, 54 at 10^9, 64 at 10^12, 74 at 10^15 — ten inputs per ' +
              'thousandfold speed-up' }
        ],
        answer: 'Two things fall out. An n¹⁰ algorithm is in P and unusable, which is why P is a ' +
          'proxy for tractability rather than a definition of it. And a thousandfold faster ' +
          'machine buys ten more inputs against 2ⁿ — the boundary between trivial and impossible ' +
          'is a few units wide and hardware barely shifts it.'
      },
      {
        title: 'The atlas: four columns that keep getting collapsed into one',
        goal: 'Separate class membership, best algorithm, best lower bound and what is open.',
        setup: 'Fifteen problems, each with all four recorded, and a flag marking which bounds ' +
          'are unconditional.',
        steps: [
          { do: 'Count the unconditional bounds.',
            why: 'Proved outright rather than resting on P versus NP.',
            work: '8 of 15 — and most of those are in restricted models' },
          { do: 'Read the SAT row.',
            why: 'The commonest complexity claim there is.',
            work: 'best algorithm exponential; best lower bound NOTHING — in 60 years no ' +
              'superpolynomial bound has been proved' },
          { do: 'Read the sorting row.',
            why: 'A genuinely proved bound, and a model restriction.',
            work: '1 of the 8 unconditional bounds: Omega(n log n) PROVED, and only in the comparison ' +
              'model — radix sort is linear for integers' },
          { do: 'Read the matrix multiplication row.',
            why: 'The confusion running the other way.',
            work: 'O(n^2.371) exists and nobody runs it; every post-Strassen improvement is ' +
              'galactic' },
          { do: 'Count the problems with a genuine open question.',
            why: 'This is where the field actually is.',
            work: '8 of 15 have an open question about their complexity' }
        ],
        answer: 'Eight proved bounds and eight open questions out of fifteen problems, and almost ' +
          'every proved bound comes with a model restriction attached. "Proved in the comparison ' +
          'model" and "believed unless P = NP" support completely different decisions — the ' +
          'first closes a line of investigation and the second says look harder.'
      }
    ],

    'space-bounded-computation': [
      {
        title: 'Two algorithms for one question, with the memory actually metered',
        goal: 'Measure the space-time trade instead of asserting it.',
        setup: 'Directed reachability on a path graph, answered by breadth-first search and by ' +
          'Savitch’s recursive midpoint search, with every allocation registered and released.',
        steps: [
          { do: 'Run both on a 4-vertex path.',
            why: 'Small enough that both numbers are readable.',
            work: 'BFS 8 bits and 4 steps; Savitch 12 bits and 18 steps — 4.5× the time' },
          { do: 'Run both on an 8-vertex path.',
            why: 'The time cost grows much faster than the space saving.',
            work: 'BFS 24 bits and 8 steps; Savitch 27 bits and 417 steps — 52.1×' },
          { do: 'Run both on a 12-vertex path.',
            why: 'Far enough to see where this is going.',
            work: 'BFS 48 bits and 12 steps; Savitch 48 bits and 9 325 steps — 777.1×' },
          { do: 'Note that the memory figures are equal at 12 vertices.',
            why: 'The asymptotic advantage has not arrived yet.',
            work: '48 bits each — Savitch is 3 indices × 4 levels, BFS is 12 indices' },
          { do: 'Check both answers agree at every size.',
            why: 'A trade is only a trade if both sides are correct.',
            work: '0 disagreements' }
        ],
        answer: 'At the sizes where Savitch runs, it uses about as much memory as BFS and ' +
          'hundreds of times the work. That is the honest picture: the theorem proves the space ' +
          'is available and offers no way to spend it, and stating the log² bound without the ' +
          'time column beside it would be quoting half a result.'
      },
      {
        title: 'Where the memory curves actually diverge',
        goal: 'Project the two curves out to sizes Savitch cannot reach.',
        setup: 'BFS measured at every size, and the Savitch bound computed as three vertex ' +
          'indices times the recursion depth.',
        steps: [
          { do: 'Compare at 8 vertices.', why: 'Savitch is still behind.',
            work: 'BFS 24 bits, bound 27 — a ratio of 0.89' },
          { do: 'Compare at 64.', why: 'The crossover has happened.',
            work: 'BFS 384 bits, bound 108 — 3.56×' },
          { do: 'Compare at 256.', why: 'Linear against logarithmic, pulling apart.',
            work: 'BFS 2 048 bits, bound 192 — 10.67×' },
          { do: 'Compare at 1 024.', why: 'The figure the section quotes.',
            work: 'BFS 10 240 bits, bound 300 — 34.13×' },
          { do: 'Note which column is measured and which is computed.',
            why: 'Only one of them is a measurement.',
            work: 'BFS measured at all 4 sizes; the Savitch column is a BOUND, because it ' +
              'cannot be run here' }
        ],
        answer: 'Thirty-four times less memory at a thousand vertices, and unrunnable at that ' +
          'size because the time is n^log n. Both halves belong in the same sentence. The dial ' +
          'is real and useful — gradient checkpointing, log-structured storage and streaming ' +
          'windows all sit on it — and Savitch marks where it ends rather than where anybody ' +
          'operates.'
      }
    ],

    'randomised-and-interactive-classes': [
      {
        title: 'Measuring the soundness error instead of quoting it',
        goal: 'Check that a lying prover survives with probability 2^-k, over thousands of runs.',
        setup: 'Two graphs that ARE isomorphic, a prover claiming they are not, and a verifier ' +
          'running k rounds — repeated 2 000 times per round count.',
        steps: [
          { do: 'Run one round, 2 000 times.',
            why: 'A prover that cannot tell is guessing.',
            work: 'measured 0.50500 against a predicted 0.5 — within a tolerance of 0.03354' },
          { do: 'Run two rounds.', why: 'Each round is an independent coin.',
            work: 'measured 0.25400 against 0.25' },
          { do: 'Run four rounds.', why: 'The error is falling geometrically.',
            work: 'measured 0.06600 against 0.0625' },
          { do: 'Run six rounds.', why: 'Far enough to be a useful guarantee.',
            work: 'measured 0.01350 against 0.015625 — within 0.00832' },
          { do: 'Run the HONEST prover on a true claim, 500 times at eight rounds.',
            why: 'Soundness without completeness is worthless.',
            work: 'accepted 500 of 500' }
        ],
        answer: 'Six round counts, every measurement inside three standard deviations of 2^-k, ' +
          'and an honest prover never rejected. That pair is what a protocol needs, and a ' +
          'verifier with a subtle bug — reusing a permutation, leaking the choice — still looks ' +
          'convincing on one run and fails this table.'
      },
      {
        title: 'A verifier that checks something it could never compute',
        goal: 'Show where the power comes from, and what the verifier actually does.',
        setup: 'A six-cycle against two triangles — same vertex count, same edge count — and a ' +
          'prover claiming they are not isomorphic.',
        steps: [
          { do: 'Check whether the graphs really differ.',
            why: 'By brute force over all permutations, which the verifier may not do.',
            work: '720 permutations checked; they are genuinely different' },
          { do: 'Note what summary statistics say.',
            why: 'Counting gets you nowhere on this pair.',
            work: '6 vertices and 6 edges each — identical' },
          { do: 'Watch the verifier’s work in one round.',
            why: 'This is its entire computation.',
            work: 'one permutation of a 6×6 matrix and one comparison — O(n²)' },
          { do: 'Ask what certificate would prove the claim classically.',
            why: 'To prove they ARE isomorphic you show the permutation.',
            work: '1 permutation proves isomorphism; for NON-isomorphism there is nothing to show, and ' +
              'no short certificate is known' },
          { do: 'Count the rounds needed for a one-in-a-thousand guarantee.',
            why: 'Amplification is the whole cost model.',
            work: '10 rounds, at 2^-10 = 0.00098' }
        ],
        answer: 'The verifier does one permutation and one comparison per round and never tests ' +
          'isomorphism at all. Everything hard is done by a party it does not trust, and the ' +
          'protocol makes the distrust survivable — which is the pattern under light clients, ' +
          'rollups, certificate transparency and verifiable computation.'
      }
    ],

    'circuits-and-non-uniform-computation': [
      {
        title: 'Size against depth: the trade every ALU makes',
        goal: 'Measure the same function built two ways, with correctness checked exhaustively.',
        setup: 'The carry-out bit of an adder, built as a ripple-carry chain and as a ' +
          'carry-lookahead tree, at widths 2 through 8.',
        steps: [
          { do: 'Build both at width 2.', why: 'The constants are visible here.',
            work: 'ripple 5 gates / depth 3; lookahead 6 gates / depth 3' },
          { do: 'Build both at width 4.', why: 'The depths separate.',
            work: 'ripple 13 / 7; lookahead 15 / 3' },
          { do: 'Build both at width 6.', why: 'The figure the section quotes.',
            work: 'ripple 21 / 11; lookahead 28 / 3' },
          { do: 'Build both at width 8.', why: 'One curve is linear and one is constant.',
            work: 'ripple 29 / 15; lookahead 45 / 3' },
          { do: 'Check every input combination at every width.',
            why: 'A family that grows nicely and computes the wrong thing is the easy mistake.',
            work: '256 combinations at width 8, all correct for both' }
        ],
        answer: 'A third more area for a latency that stops growing with the width. At 20 ' +
          'picoseconds per gate that is 220 ps against 60 ps at six bits, and the gap widens ' +
          'with every added bit. Every processor you have used made that trade, and it is the ' +
          'same manoeuvre as a prefix-sum scan or a tree reduction.'
      },
      {
        title: 'OR and PARITY look identical until fan-in is unbounded',
        goal: 'Show why AC⁰ is defined the way it is, and where the lower bound lives.',
        setup: 'OR and PARITY over n bits, built as chains, as trees, and — for OR — as a single ' +
          'unbounded-fan-in gate.',
        steps: [
          { do: 'Build both as chains at width 16.',
            why: 'Minimum size, maximum depth.', work: 'both 15 gates and 15 deep' },
          { do: 'Build both as trees at width 16.',
            why: 'Same size, logarithmic depth — the chain was simply worse.',
            work: 'both 15 gates and 4 deep' },
          { do: 'Build OR with one unbounded-fan-in gate.',
            why: 'Constant depth is only possible this way.',
            work: '1 gate, depth 1, at every width from 2 to 16' },
          { do: 'Try to do the same for PARITY.',
            why: 'This is the lower bound.',
            work: 'no constant-depth polynomial-size family exists — proved by Håstad in 1986' },
          { do: 'Compare the bounded-fan-in columns.',
            why: 'The two functions are indistinguishable there.',
            work: 'identical size and depth at all 4 widths — the difference is entirely about ' +
              'the model' }
        ],
        answer: 'With two-input gates the two functions cost exactly the same. The separation ' +
          'appears only when a single gate may take every input at once, which is what AC⁰ ' +
          'allows and what makes PARITY-not-in-AC⁰ a statement about the model rather than about ' +
          'the function looking harder. It is also one of very few unconditional circuit lower ' +
          'bounds anybody has.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
