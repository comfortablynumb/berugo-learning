/** Worked examples for Kolmogorov complexity and quantum computation (M26.9-M26.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'kolmogorov-complexity-and-randomness': [
      {
        title: 'The counting bound, checked by brute force',
        goal: 'Verify a pigeonhole argument over every string rather than trusting it.',
        setup: 'Every binary string of a given length, run through four codecs, with the count ' +
          'that compress by k bits compared to 2^(n−k) − 1.',
        steps: [
          { do: 'Check n = 10, k = 1.', why: 'The bound allows half of them.',
            work: '1 024 strings, bound 511, and 2 actually compress' },
          { do: 'Check n = 12, k = 2.', why: 'The figure the section quotes.',
            work: '4 096 strings, bound 1 023, and 26 actually compress' },
          { do: 'Check n = 16, k = 2.', why: 'Four times the strings.',
            work: '65 536 strings, bound 16 383, and 136 actually compress' },
          { do: 'Check n = 16, k = 4.', why: 'A tighter demand.',
            work: '65 536 strings, bound 4 095, and 52 actually compress' },
          { do: 'Confirm the bound holds everywhere.',
            why: 'A single violation would mean a decoder that cannot decode.',
            work: 'within the bound at all 4 pairs, with headroom of 997 or more in every case' }
        ],
        answer: 'The bound is a hard ceiling with no assumptions about the code, and real codecs ' +
          'come nowhere near it — 26 against an allowance of 1 023. Compression works because ' +
          'real data has structure a specific codec exploits, and the ceiling is about what is ' +
          'possible rather than what happens.'
      },
      {
        title: 'The string with a one-line rule that every codec calls random',
        goal: 'Show that an upper bound is not a value.',
        setup: 'Four 32-bit strings whose complexity a reader can predict, each run through the ' +
          'literal, run-length, period and dictionary codecs.',
        steps: [
          { do: 'Compress 32 zeros.', why: 'One run, or a 1-bit period.',
            work: '9 bits via the period codec — a 1-bit block plus 8 bits for the length' },
          { do: 'Compress the alternating string.', why: 'Period 2.',
            work: '10 bits via the same codec' },
          { do: 'Compress the perfect-squares string.',
            why: 'Bit i is 1 exactly when i is a perfect square — a one-line rule.',
            work: '32 bits via the LITERAL codec; no other codec beat it' },
          { do: 'Compress a fixed pseudo-random string.',
            why: 'Produced by a 20-line generator, so its true complexity is also small.',
            work: '32 bits, literal again' },
          { do: 'Measure how many strings resist everything.',
            why: 'Put the two special cases in context.',
            work: 'over 99% at every length from 8 to 16 bits — 65 064 of 65 536 at n = 16' }
        ],
        answer: 'Two strings with tiny true complexity are measured as incompressible, because ' +
          'no codec here happens to look for their rule. Any of them could be extended to catch ' +
          'one, and the next rule would defeat the extension — which is the uncomputability of K ' +
          'showing up as a practical fact rather than as a theorem.'
      }
    ],

    'quantum-computation': [
      {
        title: 'Grover’s amplitudes against the analytic formula',
        goal: 'Validate a simulator to fifteen decimal places rather than by eye.',
        setup: 'Grover search over n qubits with one marked item, with the measured probability ' +
          'at each iteration compared to sin²((2k+1)θ) where sin θ = 1/√N.',
        steps: [
          { do: 'Run at 2 qubits.', why: 'Four items, and one iteration is exact.',
            work: 'peak 1.0000 at k = 1, matching the formula to 8.88e-16' },
          { do: 'Run at 4 qubits.', why: 'Sixteen items.',
            work: 'peak 0.9613 at k = 3, error 4.44e-16, against a classical average of 8' },
          { do: 'Run at 5 qubits.', why: 'Thirty-two items.',
            work: 'peak 0.9992 at k = 4, error 7.77e-16, against a classical average of 16' },
          { do: 'Run at 6 qubits.', why: 'Sixty-four items.',
            work: 'peak 0.9966 at k = 6, error 1.67e-16, against a classical average of 32' },
          { do: 'Run past the optimum.',
            why: 'Grover is a rotation, not a search that converges.',
            work: 'at 4 qubits the probability falls from 0.961 at k = 3 to 0.582 at k = 4 and ' +
              '0.125 at k = 5' }
        ],
        answer: 'Every measured amplitude matches the closed form to within floating-point noise, ' +
          'and the peak lands at round(π/4·√N − 0.5) at every size. The over-rotation is the ' +
          'detail worth keeping: the iteration count is part of the algorithm rather than a ' +
          'stopping condition you can test for, because there is no way to check whether you ' +
          'have arrived without destroying the state.'
      },
      {
        title: 'One query against 2^(n−1) + 1, and what it costs to have that',
        goal: 'Show the smallest quantum speed-up exactly, and the entanglement it needs.',
        setup: 'Deutsch–Jozsa on a function promised constant or balanced, plus a Bell pair and ' +
          'a GHZ state.',
        steps: [
          { do: 'Run Deutsch–Jozsa at 3 qubits with a constant oracle.',
            why: 'All the amplitude should return to the all-zeros state.',
            work: 'probability exactly 1.000000 on |000>, against a classical worst case of 5 ' +
              'queries' },
          { do: 'Run it with a balanced oracle.', why: 'Interference should cancel it exactly.',
            work: 'probability exactly 0.000000 on |000> — unambiguous, not probabilistic' },
          { do: 'Run it at 4 qubits.', why: 'The classical worst case doubles.',
            work: '1 query against 9; the quantum answer is still exact' },
          { do: 'Build a Bell pair with two gates.',
            why: 'Entanglement, and the smallest example of it.',
            work: 'probabilities 0.5000, 0, 0, 0.5000 — the qubits always agree' },
          { do: 'Build a GHZ state with three gates.', why: 'Three qubits correlated.',
            work: 'probabilities 0.5000 on |000> and 0.5000 on |111>, zero on the other six' }
        ],
        answer: 'One query where the classical worst case needs five or nine, with a probability ' +
          'of exactly one rather than a high one. That exactness is what makes Deutsch–Jozsa the ' +
          'cleanest demonstration in the subject, even though the problem is artificial — and ' +
          'the Bell pair shows the resource it depends on in two gates.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
