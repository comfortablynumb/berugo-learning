/** Reference entries for Kolmogorov complexity and quantum computation (M26.9-M26.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'kolmogorov-complexity-and-randomness': {
      summary: 'The counting bound checked by brute force over every string up to sixteen bits, ' +
        'with over 99% resisting every codec — and one string with a one-line rule that all four ' +
        'of them report as incompressible.',
      intuition: 'K is not computable, so every compressor reports an upper bound and none ' +
        'reports a value.',
      formulation: {
        equations: [
          {
            label: 'The counting bound, checked exhaustively',
            expr: 'n · k · strings · compress by k · the bound allows',
            terms: [
              { sym: '10, 1', meaning: '1 024 · 2 · 511' },
              { sym: '12, 2', meaning: '4 096 · 26 · 1 023' },
              { sym: '16, 2', meaning: '65 536 · 136 · 16 383' },
              { sym: '16, 4', meaning: '65 536 · 52 · 4 095' },
              { sym: 'the ceiling', meaning: '2^(n−k) − 1, because that is how many shorter descriptions exist' }
            ]
          },
          {
            label: 'Four 32-bit strings, and their measured bounds',
            expr: 'string · best bound · which codec',
            terms: [
              { sym: 'all zeros', meaning: '9 bits · the period codec' },
              { sym: 'alternating', meaning: '10 bits · the period codec' },
              { sym: 'the perfect squares', meaning: '32 bits · the LITERAL — and its true complexity is tiny' },
              { sym: 'a fixed pseudo-random string', meaning: '32 bits · the literal, from a 20-line generator' },
              { sym: 'incompressible fraction', meaning: 'over 99% at every length from 8 to 16 bits' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every reported number is labelled as an upper bound',
          why: 'K is uncomputable; a number presented without the qualifier is a lie about what was measured.',
          breaks: 'The metric label says "best upper bound" and the note repeats why.'
        },
        {
          name: 'The counting bound is verified rather than asserted',
          why: 'It is exactly the kind of claim that sounds obviously true and is easy to state slightly wrong.',
          breaks: 'Every string of the length is generated and run through all four codecs; the count is compared to the ceiling.'
        },
        {
          name: 'A string with a short rule that no codec finds is included on purpose',
          why: 'Without it the section would teach that compression ratio measures complexity.',
          breaks: 'The perfect-squares string measures at its full 32 bits and has a one-line description.'
        },
        {
          name: 'The literal encoding is one of the codecs',
          why: 'It is always available and it is what every other codec has to beat.',
          breaks: 'Two of the four samples come back with the literal as the best result.'
        }
      ],
      complexity: [
        { operation: 'run-length encoding', average: 'O(n)', worst: 'O(n) — 5 bits per run' },
        { operation: 'the period detector', average: 'O(n²) over candidate periods', worst: 'O(n²)' },
        { operation: 'the dictionary codec', average: 'O(n) phrases', worst: 'O(n log n) bits for the indexes' },
        { operation: 'verifying the counting bound at length n', average: 'O(2^n × codec cost)', worst: '65 536 strings at n = 16, which is why it stops there' },
        { operation: 'computing K', average: 'no algorithm exists', worst: 'no algorithm exists' }
      ],
      failureModes: [
        {
          symptom: 'A compression ratio is quoted as the information content of a file.',
          cause: 'An upper bound reported as a value.',
          fix: 'Say which codec. The number is a fact about the codec meeting that data.'
        },
        {
          symptom: 'Someone claims a compressor that shrinks every input.',
          cause: 'A counting impossibility, not an engineering gap.',
          fix: 'The pigeonhole argument settles it: two inputs would share a description.'
        },
        {
          symptom: 'Encrypted or already-compressed data does not compress further.',
          cause: 'It is indistinguishable from the 99% that resist everything.',
          fix: 'Compress before encrypting, and never after — and be aware that doing so leaks length.'
        },
        {
          symptom: 'An MDL criterion is treated as finding the objectively best model.',
          cause: 'The shortest code cannot be found, so every criterion is an approximation.',
          fix: 'Treat AIC, BIC and regularisation as heuristics whose quality is empirical.'
        }
      ],
      inTheWild: [
        'The Hutter Prize, which pays for compressing Wikipedia and is explicitly an MDL argument.',
        'Normalised compression distance, used for clustering when no feature space is obvious.',
        'Every "compression is intelligence" argument, which is this section stated loosely.',
        'Chaitin’s Omega, a real number whose digits encode the halting problem and are uncomputable.'
      ],
      sources: [
        { title: 'Kolmogorov — Three approaches to the quantitative definition of information (1965)', note: 'the definition, and the invariance theorem' },
        { title: 'Li and Vitányi — An Introduction to Kolmogorov Complexity and Its Applications', note: 'the standard reference, including the counting arguments' },
        { title: 'Chaitin — On the length of programs for computing finite binary sequences (1966)', note: 'the independent discovery, and Omega' },
        { title: 'Rissanen — Modeling by shortest data description (1978)', note: 'minimum description length as a model-selection principle' }
      ]
    },

    'quantum-computation': {
      summary: 'Grover amplitudes matching sin²((2k+1)θ) to within 10^-15 at every iteration and ' +
        'every size, with the peak at round(π/4·√N − 0.5) exactly — and the over-rotation past it ' +
        'visible, because Grover is a rotation rather than a search that converges.',
      intuition: 'Grover is quadratic and Shor is exponential, and that asymmetry is the entire ' +
        'post-quantum migration plan.',
      formulation: {
        equations: [
          {
            label: 'Grover, measured against the closed form',
            expr: 'qubits · N · optimal k · probability at k · largest error',
            terms: [
              { sym: '2', meaning: '4 · 1 · 1.0000 · 8.88e-16' },
              { sym: '4', meaning: '16 · 3 · 0.9613 · 4.44e-16' },
              { sym: '5', meaning: '32 · 4 · 0.9992 · 7.77e-16' },
              { sym: '6', meaning: '64 · 6 · 0.9966 · 1.67e-16' },
              { sym: 'the formula', meaning: 'sin²((2k+1)θ) with sin θ = 1/√N' }
            ]
          },
          {
            label: 'What a quantum computer does to each primitive',
            expr: 'primitive · classical · quantum · the fix',
            terms: [
              { sym: 'AES-128', meaning: '2^128 · 2^64 by Grover · use AES-256' },
              { sym: 'SHA-256 preimage', meaning: '2^256 · 2^128 by Grover · already comfortable' },
              { sym: 'RSA-2048', meaning: 'sub-exponential · POLYNOMIAL by Shor · none — migrate' },
              { sym: 'ECDH P-256', meaning: '2^128 · POLYNOMIAL by Shor · none — migrate' },
              { sym: 'ML-KEM', meaning: 'exponential · no known polynomial attack · this IS the fix' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Amplitudes are validated against analytic values, not eyeballed',
          why: 'A simulator that merely makes the bar go up passes visual inspection.',
          breaks: 'Every iteration is compared to the closed form; the largest gap is 1.7e-15.'
        },
        {
          name: 'Total probability stays at exactly one',
          why: 'A unitary gate preserves it, so drift is the cheapest possible bug detector.',
          breaks: 'The norm metric reads 1.000000000000 after every circuit in the demo.'
        },
        {
          name: 'The probability at the PREDICTED iteration is what is reported',
          why: 'Grover is a rotation, so the maximum over a longer run can land elsewhere.',
          breaks: 'Reporting the run maximum would make the formula look wrong when it is exactly right.'
        },
        {
          name: 'The over-rotation is shown rather than hidden',
          why: 'It is what makes Grover a rotation rather than a convergent search.',
          breaks: 'At four qubits the probability falls from 0.961 at k = 3 to 0.125 at k = 5.'
        }
      ],
      complexity: [
        { operation: 'a single-qubit gate', average: 'O(2^n) — 2^(n−1) independent 2×2 products', worst: 'the same' },
        { operation: 'a controlled-NOT', average: 'O(2^n)', worst: 'O(2^n)' },
        { operation: 'Grover, one iteration', average: 'O(2^n) in simulation', worst: 'O(1) oracle queries on real hardware' },
        { operation: 'Grover, total queries', average: 'about π/4 × sqrt(N)', worst: 'Omega(sqrt(N)) is PROVED, so it is optimal' },
        { operation: 'classical unstructured search', average: 'N/2', worst: 'N' },
        { operation: 'Deutsch–Jozsa', average: '1 query', worst: '1, against 2^(n−1) + 1 classically' }
      ],
      failureModes: [
        {
          symptom: '"Quantum computers will break all encryption."',
          cause: 'Conflating Grover’s quadratic speed-up with Shor’s exponential one.',
          fix: 'AES-256 and SHA-384 are fine. RSA and elliptic curves are not, and need different algorithms.'
        },
        {
          symptom: '"Quantum computers will brute-force NP-complete problems."',
          cause: 'Grover applied to search without noticing the matching lower bound.',
          fix: 'Omega(sqrt(N)) is proved, so the speed-up is quadratic and cannot be improved. BQP is not known to contain NP.'
        },
        {
          symptom: 'A Grover implementation gets worse the longer it runs.',
          cause: 'It is a rotation; past the optimum it rotates away from the answer.',
          fix: 'Compute the iteration count from N. There is no way to test whether you have arrived.'
        },
        {
          symptom: 'A migration plan is scheduled against "when quantum computers arrive".',
          cause: 'The wrong deadline — traffic recorded today can be decrypted later.',
          fix: 'Schedule against how long the data must stay secret. For ten-year secrets the deadline has passed.'
        }
      ],
      inTheWild: [
        'NIST’s 2024 post-quantum standards: ML-KEM, ML-DSA and SLH-DSA.',
        'Harvest-now-decrypt-later, which is why the migration deadline is about data lifetime.',
        'Shor’s algorithm run on 15 and 21 — the largest numbers factored without cheating.',
        'Error correction, where thousands of physical qubits are needed per logical one.'
      ],
      sources: [
        { title: 'Nielsen and Chuang — Quantum Computation and Quantum Information', note: 'the standard reference for the model and the algorithms' },
        { title: 'Grover — A fast quantum mechanical algorithm for database search (1996)', note: 'the algorithm, and the amplitude formula this section checks' },
        { title: 'Shor — Polynomial-time algorithms for prime factorization and discrete logarithms (1997)', note: 'the exponential speed-up that motivates the migration' },
        { title: 'Bennett, Bernstein, Brassard and Vazirani — Strengths and weaknesses of quantum computing (1997)', note: 'the Omega(sqrt(N)) lower bound that makes Grover optimal' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
