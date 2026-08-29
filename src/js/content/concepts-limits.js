/** Concepts for Kolmogorov complexity and quantum computation (M26.9-M26.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'kolmogorov-complexity-and-randomness': [
      {
        term: 'K(s) is the length of the shortest program that prints s',
        plain: 'A property of the string, not of any particular compressor.',
        formal: 'K(s) = min { |p| : U(p) = s } for a fixed universal machine U',
        readAs: 'The complexity of a string is the length of the shortest program that outputs it and stops.',
        detail: 'That is the right definition of "how much information is in here" precisely ' +
          'because it does not mention a codec — a string is complex if nothing short describes ' +
          'it, whatever the description language. It is also, for exactly that reason, ' +
          'uncomputable, and everything else in the section follows from those two facts ' +
          'together.',
        example: 'The demo reports the best of four codecs and calls it an upper bound, because ' +
          'that is all any of them can offer.'
      },
      {
        term: 'The invariance theorem says the language does not matter, up to a constant',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["shortest program in Python"] --> C["the two differ by at most<br/>a fixed constant"]',
            '    B["shortest program in C"] --> C',
            '    C --> D["because an interpreter for one,<br/>written in the other,<br/>is a program of fixed size"]',
            '    D --> E["so K is a property of the string,<br/>not of your language choice"]'
          ].join('\n'),
          caption: 'Without this the whole idea would be arbitrary. The constant is real and does not grow with the string, which is what makes the measure well defined.'
        },
        plain: 'An interpreter for one language written in another is a fixed-size program.',
        formal: 'K_A(s) is at most K_B(s) plus the size of a B-interpreter written in A',
        detail: 'The constant is real and it does not grow with the string, so K is well defined ' +
          'asymptotically even though its exact value depends on the machine. That is the ' +
          'theorem that makes the whole notion legitimate: without it, "the complexity of this ' +
          'string" would be a fact about the choice of programming language.',
        example: 'The claims table lists it first, with the interpreter argument as its reason.'
      },
      {
        term: 'K is not computable, by a formalised Berry paradox',
        plain: 'A program that computes K could describe a string too complex to describe.',
        formal: 'search for the first s with K(s) > 10^6; that search is a description of s in far fewer bits',
        detail: 'The contradiction is immediate and it is the same shape as "the smallest number ' +
          'not describable in fewer than twenty words", which describes that number in thirteen. ' +
          'What makes the formal version work rather than being a play on words is that ' +
          '"describable" has been given a precise meaning: the length of a program.',
        example: 'Every codec in the demo reports a bound; none reports a value, and the ' +
          'difference is labelled everywhere.'
      },
      {
        term: 'A compression ratio is evidence about a codec, not a measurement of a string',
        plain: 'The perfect-squares string has a one-line rule and every codec calls it incompressible.',
        formal: 'the measured bound equals the string length; the true complexity is a few dozen bits',
        detail: 'That gap is the honest content of the section. Bit i is 1 exactly when i is a ' +
          'perfect square, which has no period, no long runs and no repeated phrases — so ' +
          'run-length, the period detector and the dictionary all return nothing. Any of them ' +
          'could be extended to catch it, and the next rule would defeat the extension.',
        example: 'All zeros compresses to 9 bits from 32; the perfect squares compresses to 32.'
      },
      {
        term: 'The counting argument shows most strings are incompressible',
        plain: 'At most a 2^-k fraction of length-n strings can compress by k bits.',
        formal: 'there are 2^n strings and only 2^(n−k) − 1 descriptions shorter than n − k',
        detail: 'It is pigeonhole with no cleverness in it: a decodable code cannot map two ' +
          'inputs to the same description, so the count of short descriptions is a hard ceiling ' +
          'regardless of the code. That is why "a compressor that shrinks every input" is ' +
          'impossible rather than merely unachieved, and why every claim to have built one is a ' +
          'hoax or a misunderstanding about where the data went.',
        example: 'At n = 12 and k = 2 the bound allows 1 023 of 4 096 strings; 26 actually ' +
          'compress.'
      },
      {
        term: 'Real codecs come nowhere near saturating the bound',
        plain: 'The ceiling says half could compress by one bit; measurement says under one per cent.',
        formal: 'the bound is what is possible, not a prediction of what happens',
        detail: 'Compression works because real data is not a uniformly random string — it has ' +
          'structure a specific codec was built to exploit — and the moment the data is random, ' +
          'nothing helps. That is also why encrypted output does not compress: it is ' +
          'indistinguishable from the ninety-nine per cent that resist everything.',
        example: 'Over 99% of strings at every length from 8 to 16 bits resist all four codecs by ' +
          'even one bit.'
      },
      {
        term: 'K and entropy measure different things and agree on average',
        plain: 'Entropy is a property of a source; K is a property of a single string.',
        formal: 'for s drawn from a source, the expected K is close to the entropy rate',
        detail: 'That connection is what makes compression benchmarks meaningful at all, and it ' +
          'is what links this section to M22. It also explains a common confusion: a single ' +
          'string has no entropy, and a source has no Kolmogorov complexity, so a claim that ' +
          'mixes the two is using one of the words loosely.',
        example: 'The claims table names Shannon’s source coding theorem as the lower bound ' +
          'compression obeys on average.'
      },
      {
        term: 'Minimum description length is Occam’s razor made precise',
        plain: 'The model plus the data-given-the-model is a code; take the shortest total.',
        formal: 'minimise |model| + |data encoded using the model|',
        detail: 'That is a real trade between fit and complexity, and it is the honest ancestor ' +
          'of every regularisation term. The limit on it is the second concept in this list: the ' +
          'shortest code cannot be found, so AIC, BIC, a penalty term and a validation set are ' +
          'all approximations whose quality is an empirical question rather than a theorem.',
        example: 'The claims table ends with it, and names what it is used for outside the ' +
          'theory.'
      }
    ],

    'quantum-computation': [
      {
        term: 'A state of n qubits is 2^n complex amplitudes',
        plain: 'A gate is a unitary matrix applied to them.',
        formal: 'the state is a unit vector in a 2^n-dimensional complex space',
        detail: 'That is the entire model, and a simulator for it is a few hundred lines of ' +
          'arithmetic. Nothing about it is mysterious. What is interesting is which ALGORITHMS ' +
          'the model admits, and the answer is: fewer than people expect, and the two that exist ' +
          'have very different consequences.',
        example: 'The demo\'s simulator applies single-qubit gates in 2^n work by pairing basis ' +
          'states that differ in one bit.'
      },
      {
        term: 'Superposition is a vector, and measurement is the only way to look at it',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["n qubits: 2^n amplitudes,<br/>all present at once"] --> B["gates transform the whole vector"]',
            '    B --> C["measure"]',
            '    C --> D["you get ONE basis state,<br/>with probability equal to<br/>its amplitude squared"]',
            '    D --> E["the rest of the vector is gone"]',
            '    E --> F["so the algorithm must make the<br/>answer likely BEFORE you look"]'
          ].join('\n'),
          caption: 'The parallelism is real and almost entirely unreadable. Every quantum algorithm is a way of arranging interference so that the wanted state has most of the amplitude.'
        },
        plain: 'You get one basis state, with probability equal to the amplitude squared.',
        formal: 'P(i) = |amplitude_i|²',
        detail: 'You cannot read amplitudes, cannot copy the state (the no-cloning theorem ' +
          'follows from linearity), and cannot resume from where you were — the measurement ' +
          'destroys it. Every quantum algorithm is arranged around that one shot, which is why ' +
          'the game is concentrating probability on the answer before measuring rather than ' +
          'computing many answers at once.',
        example: 'The demo prints the probability of every basis state, which is what a ' +
          'measurement would sample from.'
      },
      {
        term: 'Entanglement means the state does not factor',
        plain: 'A Bell pair has amplitude on 00 and 11 and none on 01 or 10.',
        formal: 'no pair of single-qubit states has that joint distribution',
        detail: 'Two independent qubits each in an equal superposition give all four outcomes at ' +
          'a quarter each; the Bell pair gives two outcomes at a half each, and the qubits ' +
          'always agree. That is a genuinely different object, produced by two gates, and it is ' +
          'not communication — measuring one tells you the other without sending anything, and ' +
          'without letting you choose what it says.',
        example: 'The demo\'s Bell circuit gives probabilities 0.5, 0, 0, 0.5 exactly.'
      },
      {
        term: 'Every gate is reversible, which constrains algorithm design',
        plain: 'There is no quantum AND gate that throws a bit away.',
        formal: 'unitary matrices are invertible, so every step can be undone',
        detail: 'Classical functions therefore enter a circuit as PHASE ORACLES, which mark the ' +
          'inputs you care about by negating their amplitude rather than by writing an answer ' +
          'somewhere. That indirection is why quantum algorithms look so unlike classical ones ' +
          'even when they solve the same problem.',
        example: 'Grover\'s oracle negates the marked amplitude and writes nothing.'
      },
      {
        term: 'Deutsch–Jozsa is the smallest speed-up and the cleanest',
        plain: 'One query where the classical worst case needs 2^(n−1) + 1.',
        formal: 'a constant function leaves all amplitude on |0...0>; a balanced one leaves none',
        detail: 'The answer is unambiguous rather than probabilistic, which is what makes it the ' +
          'clearest demonstration in the subject even though the problem itself is artificial. ' +
          'It shows the mechanism — interference cancelling the wrong answers exactly — with no ' +
          'approximation anywhere.',
        example: 'Probability exactly 1.000000 for constant and exactly 0.000000 for balanced, at ' +
          'every width tested.'
      },
      {
        term: 'Grover is a rotation, and running it too long rotates past the answer',
        plain: 'The oracle flips the marked amplitude below the mean; diffusion reflects about the mean.',
        formal: 'the marked probability after k iterations is sin²((2k+1)θ) with sin θ = 1/√N',
        readAs: 'The chance of measuring the marked item after k rounds is the square of the sine of two k plus one, times an angle whose sine is one over the square root of the search space.',
        detail: 'That formula is exact, which makes it a real check rather than a plausibility ' +
          'argument: the simulator matches it to within floating-point noise at every iteration. ' +
          'It also has a consequence people miss — the probability FALLS after the optimum, so ' +
          'the iteration count is part of the algorithm rather than a stopping condition you can ' +
          'test for.',
        example: 'At four qubits the peak is 0.9613 at iteration 3, matching the formula to ' +
          '4 × 10^-16.'
      },
      {
        term: 'Grover is provably optimal, and that is why BQP is not known to contain NP',
        plain: 'The quadratic speed-up on unstructured search cannot be improved.',
        formal: 'a matching Omega(sqrt(N)) lower bound on quantum queries is proved',
        readAs: 'Any quantum algorithm needs at least about the square root of N queries for unstructured search.',
        detail: 'So a general attack on NP-complete problems would need structure nobody has ' +
          'found. Factoring falls to Shor because it HAS structure — a periodicity a quantum ' +
          'Fourier transform can find — and NP-complete problems are not known to have any such ' +
          'thing. "Quantum computers will brute-force NP" is the single most common wrong claim ' +
          'in this area.',
        example: 'The class-notes table marks BQP containing NP as "not known, and widely ' +
          'doubted".'
      },
      {
        term: 'Grover is quadratic and Shor is exponential, and that asymmetry is the migration plan',
        plain: 'Doubling a symmetric key restores the margin; RSA has no parameter fix.',
        formal: 'AES-128 falls to 2^64 by Grover; RSA-2048 falls to polynomial time by Shor',
        detail: 'Everything Grover touches is fixed by doubling a parameter, because the square ' +
          'root of an exponential is still an exponential. Everything Shor touches needs a ' +
          'different algorithm, because a polynomial is not. That is why the post-quantum ' +
          'migration is about RSA and elliptic curves specifically and not about AES, and why ' +
          '"quantum breaks all encryption" is wrong in a way that matters for planning.',
        example: 'Two of the six rows in the impact table say "none" in the fix column, and both ' +
          'are Shor’s.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
