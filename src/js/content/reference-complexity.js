/** Reference entries for time, space, randomised classes and circuits (M26.5-M26.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'time-complexity-classes': {
      summary: 'Fifteen problems with their class, best known algorithm, best known lower bound ' +
        'and open questions kept in four separate columns — and only eight of the bounds are ' +
        'proved unconditionally, most of those inside a restricted model.',
      intuition: 'Being precise about which of four things a hardness claim means is what makes ' +
        'it credible.',
      formulation: {
        equations: [
          {
            label: 'What each growth rate costs at 10^9 operations per second',
            expr: 'rate at n = 40 · operations · wall clock',
            terms: [
              { sym: 'n²', meaning: '1 600 — microseconds' },
              { sym: 'n¹⁰', meaning: '1.05 × 10^16 — about four months, and it is in P' },
              { sym: '2ⁿ at n = 40', meaning: '1.10 × 10^12 — about eighteen minutes' },
              { sym: '2ⁿ at n = 60', meaning: '1.15 × 10^18 — about 36 years' },
              { sym: 'the feasible n', meaning: '44 at 10^6 ops/s, 54 at 10^9, 64 at 10^12, 74 at 10^15' }
            ]
          },
          {
            label: 'The four columns, and why they are separate',
            expr: 'class · best algorithm · best lower bound · what is open',
            terms: [
              { sym: 'SAT', meaning: 'NP-complete · exponential · NOTHING proved · P versus NP' },
              { sym: 'sorting', meaning: 'P · O(n log n) · Omega(n log n) PROVED, comparison model only · nothing' },
              { sym: 'matrix multiplication', meaning: 'P · O(n^2.371) nobody runs · Omega(n²) trivially · whether the exponent is 2' },
              { sym: 'factoring', meaning: 'NP ∩ co-NP ∩ BQP · sub-exponential · nothing · whether it is in P' },
              { sym: 'the totals', meaning: '8 of 15 unconditional, 8 of 15 with a genuine open question' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Class membership and best known algorithm are separate facts',
          why: 'Collapsing them is the commonest way a complexity claim becomes false.',
          breaks: 'The atlas keeps four columns, and the SAT row reads "exponential" beside "nothing proved".'
        },
        {
          name: 'A proved bound names its model',
          why: '"Sorting is n log n" is true in the comparison model and false for integers.',
          breaks: 'Every unconditional entry carries its model restriction in the same cell.'
        },
        {
          name: 'The hierarchy separations are marked as unconditional and the rest are not',
          why: 'P ⊊ EXPTIME is a theorem; P ≠ NP is a belief.',
          breaks: 'The tower table marks three separations as strict and leaves six containments open.'
        },
        {
          name: 'The cost table is computed rather than described',
          why: '"Exponential" as a word conveys nothing about where the cliff is.',
          breaks: 'A thousandfold faster machine buys ten more inputs against 2ⁿ, which is the whole story.'
        }
      ],
      complexity: [
        { operation: 'the time hierarchy separation', average: 'diagonalisation over g-time machines', worst: 'costs a log factor, from the simulation' },
        { operation: 'a padding argument', average: 'pad instances to the larger bound', worst: 'moves an existing separation to where the class definitions can see it' },
        { operation: 'verifying an NP certificate', average: 'polynomial by definition', worst: 'polynomial' },
        { operation: 'finding an NP certificate', average: 'exponential by the best known method', worst: 'no superpolynomial lower bound is proved' }
      ],
      failureModes: [
        {
          symptom: 'A team stops looking for an algorithm because the problem is "exponential".',
          cause: 'A fact about the literature read as a proved limit.',
          fix: 'Ask which of four things is meant. Only a proved bound in a stated model closes the question.'
        },
        {
          symptom: 'An asymptotically better algorithm makes the system slower.',
          cause: 'A galactic algorithm whose crossover is beyond any real input.',
          fix: 'Measure at your sizes. The exponent is a limit and the limit may be unreachable.'
        },
        {
          symptom: 'An O(n) claim does not survive contact with large integers.',
          cause: 'The unit-cost RAM charging one step for unbounded arithmetic.',
          fix: 'Name the cost model when the values grow, which is exactly when it matters.'
        },
        {
          symptom: 'NP-completeness is cited as proof that no efficient algorithm exists.',
          cause: 'It proves that one would settle P versus NP, which is not the same claim.',
          fix: 'Say what it actually gives: excellent evidence, and a reduction you can reuse.'
        }
      ],
      inTheWild: [
        'SAT solvers handling millions of clauses on problems that are formally intractable.',
        'The Clay Institute’s million-dollar P versus NP prize, unclaimed since 2000.',
        'Every "this is NP-hard so we use a heuristic" decision in a production planner.',
        'Strassen and its successors, none of which is used in any BLAS implementation.'
      ],
      sources: [
        { title: 'Hartmanis and Stearns — On the computational complexity of algorithms (1965)', note: 'the time hierarchy theorem, and the birth of the field' },
        { title: 'Arora and Barak — Computational Complexity: A Modern Approach', note: 'the classes, the barriers, and what is actually known' },
        { title: 'Baker, Gill and Solovay — Relativizations of the P =? NP question (1975)', note: 'why diagonalisation cannot settle it' },
        { title: 'Garey and Johnson — Computers and Intractability', note: 'the NP-completeness catalogue everyone still reaches for' }
      ]
    },

    'space-bounded-computation': {
      summary: 'A memory meter counting bits as they are taken and released, so log space is a ' +
        'number rather than a label: 10 240 bits for breadth-first search against a Savitch bound ' +
        'of 300 at a thousand vertices — and Savitch unrunnable at that size.',
      intuition: 'Space can be reused and time cannot, so recomputation is a legitimate ' +
        'alternative to caching.',
      formulation: {
        equations: [
          {
            label: 'Measured, on a path graph',
            expr: 'vertices · BFS bits / steps · Savitch bits / steps · time ratio',
            terms: [
              { sym: '4', meaning: '8 / 4 · 12 / 18 · 4.5×' },
              { sym: '8', meaning: '24 / 8 · 27 / 417 · 52.1×' },
              { sym: '12', meaning: '48 / 12 · 48 / 9 325 · 777.1×' },
              { sym: 'the catch', meaning: 'the memory figures are EQUAL at 12 vertices — the advantage is asymptotic' }
            ]
          },
          {
            label: 'Where the curves actually diverge',
            expr: 'vertices · BFS bits measured · Savitch bound computed · ratio',
            terms: [
              { sym: '8', meaning: '24 · 27 · 0.89×' },
              { sym: '64', meaning: '384 · 108 · 3.56×' },
              { sym: '256', meaning: '2 048 · 192 · 10.67×' },
              { sym: '1 024', meaning: '10 240 · 300 · 34.13× — and Savitch cannot be run here' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Memory is metered, not labelled',
          why: 'A "log-space" implementation with an accidental memo table is a linear-space one wearing a label.',
          breaks: 'Every allocation is registered as taken and deregistered as released; the peak is a high-water mark.'
        },
        {
          name: 'The measured column and the projected column are visibly different',
          why: 'Savitch cannot be run at a thousand vertices, so its figure there is a bound.',
          breaks: 'The table header says "measured" and "bound", and the note says why.'
        },
        {
          name: 'Both algorithms must agree before the trade means anything',
          why: 'A faster wrong answer is not a point on the curve.',
          breaks: 'The agreement metric is checked at every graph and size.'
        },
        {
          name: 'SPACE counts the work tape only',
          why: 'Otherwise sublinear classes are empty and L does not exist.',
          breaks: 'The meter counts allocations, not the graph being read.'
        }
      ],
      complexity: [
        { operation: 'BFS reachability', average: 'O(V + E) time, O(V log V) bits', worst: 'the same — the visited set is never released' },
        { operation: 'Savitch reachability', average: 'O(log² n) bits', worst: 'n^log n time — 9 325 calls on 12 vertices' },
        { operation: 'one Savitch frame', average: '3 vertex indices', worst: '3 × ceil(log n) bits, released on return' },
        { operation: 'the recursion depth', average: 'ceil(log n)', worst: '4 levels at 12 vertices, 10 at 1 024' }
      ],
      failureModes: [
        {
          symptom: 'An algorithm labelled log-space uses linear memory.',
          cause: 'A memo table, a visited set, or an accumulator added for speed.',
          fix: 'Meter it. The label is a claim and the meter is a measurement.'
        },
        {
          symptom: 'A theoretical space bound is quoted without its time cost.',
          cause: 'Half the result.',
          fix: 'Savitch is 34× less memory at 1 024 vertices and unrunnable there. Both halves or neither.'
        },
        {
          symptom: 'A system runs out of memory and the team buys more.',
          cause: 'Treating the space-time trade as fixed rather than as a dial.',
          fix: 'Recomputation is a design option — checkpointing, replay, windows — and often the correctness-preserving one.'
        },
        {
          symptom: 'Someone asserts nondeterminism must help as much in space as in time.',
          cause: 'The two questions look identical and have different answers.',
          fix: 'Savitch settles the space one; P versus NP is open. Squaring a polynomial is a polynomial and squaring an exponential is not.'
        }
      ],
      inTheWild: [
        'Gradient checkpointing in every large-model training framework.',
        'Log-structured merge trees, which keep the log and rebuild the indexes.',
        'Reingold’s 2004 log-space algorithm for undirected reachability, which surprised everyone.',
        'Streaming query engines that hold a window rather than the history.'
      ],
      sources: [
        { title: 'Savitch — Relationships between nondeterministic and deterministic tape complexities (1970)', note: 'the midpoint recursion, and PSPACE = NPSPACE' },
        { title: 'Immerman (1988) and Szelepcsényi (1987) — independently, NL = coNL', note: 'inductive counting, and the surprise' },
        { title: 'Reingold — Undirected connectivity in log-space (2008)', note: 'the result that put undirected reachability in L' },
        { title: 'Arora and Barak — Computational Complexity', note: 'the space classes and their relationships, systematically' }
      ]
    },

    'randomised-and-interactive-classes': {
      summary: 'The soundness error of the graph-non-isomorphism protocol measured over 2 000 ' +
        'runs per round count and landing within three sigma of 2^-k at every one — 0.505, ' +
        '0.254, 0.123, 0.066, 0.0285, 0.0135 against 0.5 down to 0.0156.',
      intuition: 'A weak verifier can check a claim it could never compute, and the soundness ' +
        'error is the entire security argument.',
      formulation: {
        equations: [
          {
            label: 'The protocol, one round',
            expr: 'pick b at random, permute graph b, ask which it was, accept iff correct',
            terms: [
              { sym: 'honest prover on a true claim', meaning: 'always right — completeness' },
              { sym: 'any prover on a false claim', meaning: 'both answers are true, so it is guessing' },
              { sym: 'the verifier’s work', meaning: 'one permutation of an n×n matrix and one comparison' },
              { sym: 'k rounds', meaning: 'soundness error 2^-k' }
            ]
          },
          {
            label: 'Measured against the bound, 2 000 trials per row',
            expr: 'rounds · measured · predicted · three-sigma tolerance',
            terms: [
              { sym: '1', meaning: '0.50500 · 0.50000 · ±0.03354' },
              { sym: '2', meaning: '0.25400 · 0.25000 · ±0.02905' },
              { sym: '4', meaning: '0.06600 · 0.06250 · ±0.01624' },
              { sym: '6', meaning: '0.01350 · 0.01563 · ±0.00832' },
              { sym: 'completeness', meaning: 'the honest prover accepted 500 of 500 at 8 rounds' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Soundness is measured, not quoted',
          why: 'A verifier with a subtle bug still looks convincing on one run.',
          breaks: 'Six round counts, thousands of trials each, compared to 2^-k with a binomial tolerance.'
        },
        {
          name: 'Completeness is measured too',
          why: 'A protocol that never accepts is perfectly sound and useless.',
          breaks: 'The honest prover on a true claim is accepted 500 times out of 500.'
        },
        {
          name: 'The verifier never tests isomorphism',
          why: 'It is supposed to be weak; that is the whole point of the arrangement.',
          breaks: 'One permutation and one comparison per round — O(n²), and the brute-force test is only used by the demo to state the truth.'
        },
        {
          name: 'A deterministic lying strategy fares no better than a random one',
          why: 'The verifier’s coin is what decides, not the prover’s.',
          breaks: 'The stubborn prover measures the same 2^-k as the guessing one.'
        }
      ],
      complexity: [
        { operation: 'one verifier round', average: 'O(n²) — a permutation and a comparison', worst: 'O(n²)' },
        { operation: 'k rounds', average: 'O(k n²)', worst: 'O(k n²), with soundness error 2^-k' },
        { operation: 'the honest prover', average: 'unbounded — it solves graph isomorphism', worst: 'the model allows this' },
        { operation: 'the demo’s truth oracle', average: 'n! permutations', worst: '720 at six vertices, which is why the demo stays small' },
        { operation: 'amplifying a BPP algorithm', average: 'k runs and a majority', worst: 'error falls exponentially by Chernoff' }
      ],
      failureModes: [
        {
          symptom: 'A protocol’s soundness is quoted from the paper and never measured.',
          cause: 'The bound is about the protocol; the bug is in the implementation.',
          fix: 'Run a dishonest prover thousands of times and compare the acceptance rate to the bound.'
        },
        {
          symptom: 'A verifier accepts a false claim more often than it should.',
          cause: 'A reused permutation, a leaked choice, or a predictable coin.',
          fix: 'The soundness measurement catches all three; a single successful run catches none.'
        },
        {
          symptom: 'A randomised algorithm is described as "probably right" with no direction.',
          cause: 'The error direction is the whole taxonomy and it was omitted.',
          fix: 'Say which side it can be wrong on. RP and co-RP support completely different uses.'
        },
        {
          symptom: 'Someone dismisses randomised algorithms as unreliable.',
          cause: 'Not comparing the error rate to the alternatives.',
          fix: 'Thirty repetitions gives an error below one in a billion — under the rate of silent hardware corruption.'
        }
      ],
      inTheWild: [
        'Miller–Rabin, still preferred over AKS because a deterministic guarantee is not worth the constant.',
        'Blockchain light clients and optimistic rollups, both verifier-and-prover arrangements.',
        'Certificate transparency inclusion proofs.',
        'Zero-knowledge authentication, where the protocol proves knowledge without transmitting it.'
      ],
      sources: [
        { title: 'Goldwasser, Micali and Rackoff — The knowledge complexity of interactive proof systems (1985)', note: 'the model, and zero knowledge' },
        { title: 'Goldreich, Micali and Wigderson — Proofs that yield nothing but their validity (1991)', note: 'the graph non-isomorphism protocol this section runs' },
        { title: 'Shamir — IP = PSPACE (1992)', note: 'arithmetisation, and the surprise' },
        { title: 'Arora, Lund, Motwani, Sudan and Szegedy — Proof verification and hardness of approximation (1998)', note: 'the PCP theorem and what it costs approximation algorithms' }
      ]
    },

    'circuits-and-non-uniform-computation': {
      summary: 'Size against depth with correctness checked over every input at every width: at ' +
        'six bits a ripple-carry carry-out is 21 gates and 11 deep, and carry-lookahead is 28 ' +
        'gates and 3 deep — constant in the width.',
      intuition: 'Depth is latency and size is area, and it is the same trade an ALU makes ' +
        'physically.',
      formulation: {
        equations: [
          {
            label: 'The carry-out, measured both ways',
            expr: 'width · ripple size / depth · lookahead size / depth',
            terms: [
              { sym: '2', meaning: '5 / 3 · 6 / 3' },
              { sym: '4', meaning: '13 / 7 · 15 / 3' },
              { sym: '6', meaning: '21 / 11 · 28 / 3' },
              { sym: '8', meaning: '29 / 15 · 45 / 3' },
              { sym: 'at 20 ps per gate', meaning: '220 ps against 60 ps at six bits' }
            ]
          },
          {
            label: 'OR and PARITY, which differ only under unbounded fan-in',
            expr: 'width 16 · chain · tree · flat',
            terms: [
              { sym: 'OR', meaning: '15 gates / depth 15 · 15 / 4 · 1 / 1' },
              { sym: 'PARITY', meaning: '15 / 15 · 15 / 4 · IMPOSSIBLE at constant depth' },
              { sym: 'the separation', meaning: 'proved by Furst, Saxe and Sipser; tight by Håstad' },
              { sym: 'what it means', meaning: 'the difference is about the model, not about the function looking harder' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Correctness is checked exhaustively beside size and depth',
          why: 'A family that grows beautifully and computes the wrong thing is the easy mistake here.',
          breaks: '256 input combinations at width 8, every one compared to the function written independently.'
        },
        {
          name: 'Depth is reported as latency, in picoseconds',
          why: 'That is what the number physically means, and it makes the trade concrete.',
          breaks: 'A gate-delay control multiplies through, so "logarithmic depth" becomes a time.'
        },
        {
          name: 'Fan-in is stated for every family',
          why: 'Constant depth is bought entirely by allowing one gate to take every input.',
          breaks: 'The arrangements table has a fan-in column, and the two constant-depth rows are the two unbounded ones.'
        },
        {
          name: 'Non-uniformity is not glossed over',
          why: 'P/poly containing undecidable languages is the fact that makes circuit lower bounds strong.',
          breaks: 'The class table states it, and states that nothing explicit is known to need superpolynomial size.'
        }
      ],
      complexity: [
        { operation: 'evaluating a circuit', average: 'O(size)', worst: 'O(size) — one pass in topological order' },
        { operation: 'the truth table', average: 'O(2^n × size)', worst: '256 rows at eight inputs, and out of reach at thirty-two' },
        { operation: 'ripple-carry', average: 'size 4n − 3, depth 2n − 1', worst: '29 gates and depth 15 at width 8' },
        { operation: 'carry-lookahead', average: 'size quadratic in n, depth 3', worst: '45 gates and depth 3 at width 8' },
        { operation: 'OR or PARITY as a tree', average: 'n − 1 gates, ceil(log n) depth', worst: '15 gates and depth 4 at width 16' }
      ],
      failureModes: [
        {
          symptom: 'A parallel implementation is no faster than the sequential one.',
          cause: 'The computation is a long dependency chain — deep, not wide.',
          fix: 'Restructure to reduce depth: a tree reduction, a prefix scan, or a lookahead.'
        },
        {
          symptom: 'A circuit family passes its tests and fails at a larger width.',
          cause: 'The construction was checked at one width and generalised by hope.',
          fix: 'Check exhaustively at every width the family is used at; it is cheap below sixteen inputs.'
        },
        {
          symptom: 'An AC⁰ result is applied to real hardware and does not hold.',
          cause: 'The model charges nothing for unbounded fan-in, and a wide gate is slow.',
          fix: 'Name the idealisation. NC¹ with bounded fan-in is the closer model for silicon.'
        },
        {
          symptom: 'A circuit lower bound proof attempt stalls.',
          cause: 'Relativisation, or the natural-proofs barrier.',
          fix: 'Nothing practical — but knowing the barriers exist explains why almost nothing is proved.'
        }
      ],
      inTheWild: [
        'Carry-lookahead adders in every processor since the 1960s.',
        'Prefix-sum scans in every data-parallel library, which are the same depth reduction.',
        'The NC versus P question, which is the formal version of "does this parallelise".',
        'Håstad’s switching lemma, one of the few unconditional lower bounds in the whole field.'
      ],
      sources: [
        { title: 'Furst, Saxe and Sipser — Parity, circuits, and the polynomial-time hierarchy (1984)', note: 'PARITY is not in AC⁰' },
        { title: 'Håstad — Almost optimal lower bounds for small depth circuits (1986)', note: 'the switching lemma, and the tight bound' },
        { title: 'Razborov and Rudich — Natural proofs (1997)', note: 'why the obvious techniques cannot work' },
        { title: 'Arora and Barak — Computational Complexity', note: 'circuit classes, P/poly, and the barriers' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
