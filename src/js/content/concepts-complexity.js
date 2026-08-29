/** Concepts for time, space, randomised classes and circuits (M26.5-M26.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'time-complexity-classes': [
      {
        term: 'TIME and NTIME are defined on machines, not on problems',
        plain: 'P is every language a machine decides in polynomial time; NP the same nondeterministically.',
        formal: 'P = union of TIME(n^k) · NP = union of NTIME(n^k)',
        detail: 'That is worth stating because the classes are constantly discussed as though ' +
          'they were properties of problems in the abstract. They are properties of what a ' +
          'specific machine model can do within a bound, which is why the model has to be named ' +
          'before any claim about them means anything.',
        example: 'The atlas lists class membership separately from the best known algorithm, ' +
          'because the two are different facts.'
      },
      {
        term: 'NP is the class of problems with short certificates',
        plain: 'A yes instance has a proof a polynomial-time verifier can check.',
        formal: 'L in NP iff there is a polynomial-time V and a bound k with x in L iff some certificate c of length n^k satisfies V(x, c)',
        readAs: 'A string is in the language exactly when some short certificate convinces a fast verifier.',
        detail: 'Guessing and verifying are the same definition seen from two sides, and the ' +
          'certificate view is the one that makes reductions constructible: to show a problem is ' +
          'NP-complete you exhibit a transformation that turns certificates into certificates. ' +
          'It is also why factoring is in NP and co-NP at once — the factors certify both ' +
          'answers.',
        example: 'The atlas marks factoring as being in NP and co-NP, which is evidence it is ' +
          'not NP-complete.'
      },
      {
        term: 'The time hierarchy theorem proves more time buys more, unconditionally',
        plain: 'If f grows sufficiently faster than g, TIME(g) is strictly inside TIME(f).',
        formal: 'TIME(g) ⊊ TIME(f) when f grows faster than g log g',
        readAs: 'Some languages can be decided within the larger time bound and provably not within the smaller one, whenever the larger grows faster than the smaller times its own logarithm.',
        detail: 'The proof is diagonalisation again: build a machine that simulates each g-time ' +
          'machine and does the opposite, which needs a little more than g time to do. That ' +
          '"little more" is the logarithmic factor in the statement, and it comes from the cost ' +
          'of simulation rather than from anything deep.',
        example: 'It gives P ⊊ EXPTIME immediately, which is one of the two unconditional ' +
          'separations in the tower table.'
      },
      {
        term: 'P versus NP is not settled by the same argument, and the reason has a name',
        plain: 'The hierarchy separates classes at different bounds in one model; P and NP are two models at one bound.',
        formal: 'relativisation: any argument that works with an oracle attached cannot separate P from NP',
        detail: 'Baker, Gill and Solovay showed there are oracles making P = NP and others making ' +
          'P ≠ NP, so any proof technique that would still work with an oracle bolted on cannot ' +
          'settle it. Diagonalisation is such a technique. That is one of two known barriers, ' +
          'and it is why fifty years of effort has not closed a gap that looks smaller than one ' +
          'that is closed.',
        example: 'The tower diagram marks the two proved separations with dashes and leaves six ' +
          'containments unmarked.'
      },
      {
        term: 'P is a proxy for tractable and it is a bad one nothing has replaced',
        plain: 'An n^100 algorithm is in P and useless.',
        formal: 'polynomials compose, so a polynomial algorithm calling a polynomial subroutine is polynomial',
        detail: 'That closure property is what P actually buys and why the class survived: it is ' +
          'robust under composition, under changing the machine model, and under reasonable ' +
          'encoding changes. Tractability is not robust under any of those, which is why the ' +
          'proxy persists despite everyone knowing it is imperfect.',
        example: 'At n = 60 an n^10 algorithm needs about 6 × 10^17 operations — in P, and ' +
          'nineteen years at a billion per second.'
      },
      {
        term: '"This problem is exponential" is almost always about the best known algorithm',
        plain: 'No superpolynomial lower bound is proved for SAT, or for any NP-complete problem.',
        formal: 'best known algorithm and best known lower bound are separate columns',
        detail: 'The atlas keeps them separate on purpose, because collapsing them is the ' +
          'commonest way a complexity claim becomes false. For SAT the two entries are ' +
          '"exponential in the worst case" and "nothing" — the gap between them is where P ' +
          'versus NP lives, and treating the first as a limit closes an investigation that is ' +
          'still open.',
        example: 'Eight of the fifteen atlas entries have an unconditional bound; the rest rest ' +
          'on P versus NP or on nothing.'
      },
      {
        term: 'Galactic algorithms are the same confusion, running the other way',
        plain: 'An asymptotic result is about a limit, and the limit may be past any practical size.',
        formal: 'matrix multiplication has an O(n^2.371) algorithm nobody runs',
        detail: 'Every improvement since Strassen has constants that make the algorithm slower ' +
          'than the schoolbook method on any matrix that fits in a data centre. That is not a ' +
          'defect in the result — the exponent is real and the mathematics is correct — it is a ' +
          'reminder that "asymptotically faster" and "faster" are different claims.',
        example: 'The atlas note for matrix multiplication says exactly this, beside the ' +
          'exponent.'
      },
      {
        term: 'Ask which of four things a hardness claim means',
        plain: 'A proved bound, NP-completeness, the state of the literature, or a hunch.',
        formal: 'the four differ in what would have to change for the claim to be wrong',
        detail: 'A proved lower bound in a stated model is a fact you can build on. ' +
          'NP-completeness says a polynomial algorithm would settle a famous open problem, which ' +
          'is excellent evidence and not a proof. "The best known algorithm is exponential" is a ' +
          'fact about the literature. And "it feels hard" is none of those. The first two close ' +
          'a line of investigation; the second two say look harder.',
        example: 'The claims table pairs seven common statements with what is actually true and ' +
          'what each rests on.'
      }
    ],

    'space-bounded-computation': [
      {
        term: 'Space can be reused and time cannot',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a cell of the work tape"] --> B["write, overwrite,<br/>write again"]',
            '    B --> C["the same cell serves<br/>a million steps"]',
            '    D["a step of time"] --> E["once spent, it is gone"]',
            '    C --> F["so space classes are far more<br/>forgiving, and every difference<br/>between the two families<br/>comes from this"]',
            '    E --> F'
          ].join('\n'),
          caption: 'It is why PSPACE contains NP, why savings on space collapse nondeterminism, and why the space hierarchy is tighter than the time one.'
        },
        plain: 'Every difference between the two families of classes comes from that.',
        formal: 'a machine may revisit a cell; it may not revisit a step',
        detail: 'So a space-bounded machine can run for an enormous time in a small amount of ' +
          'memory — a machine with s bits of work tape has at most 2^s distinct configurations ' +
          'and can visit all of them. That asymmetry is why nondeterminism costs a squaring in ' +
          'space and an apparent exponential in time.',
        example: 'The Savitch recursion holds three indices per level and runs for thousands of ' +
          'steps on a twelve-vertex graph.'
      },
      {
        term: 'SPACE counts the work tape only',
        plain: 'The input is read-only and free; the scratch space is what is charged for.',
        formal: 'a two-tape model: read-only input, read-write work tape, and only the second is measured',
        detail: 'Without that convention every class would contain at least linear space and the ' +
          'sublinear classes would be empty, so L would not exist as a meaningful object. It is ' +
          'a definitional choice made to keep an interesting question askable, which is worth ' +
          'noticing because it is easy to mistake for a fact about machines.',
        example: 'The memory meter counts only what the algorithm allocates, not the graph it ' +
          'reads.'
      },
      {
        term: 'L is a constant number of pointers into the input',
        plain: 'Logarithmic space holds a fixed number of indices and nothing else.',
        formal: 'log n bits is exactly enough for one index into an input of length n',
        detail: 'So an L algorithm is one that walks the input with a handful of cursors, which ' +
          'is a very concrete restriction — no visited set, no queue, no accumulator of size ' +
          'proportional to anything. Reingold showed in 2004 that UNDIRECTED reachability fits, ' +
          'which was a genuine surprise and does not extend to directed graphs.',
        example: 'An index into a 1 024-vertex graph costs 10 bits, and Savitch holds 30 of them ' +
          'at the deepest point.'
      },
      {
        term: 'Directed reachability is NL-complete, and it is the whole section',
        plain: 'Guess the path one vertex at a time, holding only the current vertex and a counter.',
        formal: 'every NL problem reduces to it in log space',
        detail: 'That is why this one problem carries the class: any log-space nondeterministic ' +
          'computation is a walk through its own configuration graph, and asking whether it ' +
          'accepts is asking whether an accepting configuration is reachable. The problem is not ' +
          'an example of NL; it is NL with the labels changed.',
        example: 'The demo runs it two ways and measures the memory each actually held.'
      },
      {
        term: 'Savitch: nondeterminism costs at most a squaring in space',
        plain: 'Guess a midpoint and recurse on both halves with half the budget.',
        formal: 'NSPACE(f) is contained in SPACE(f²)',
        detail: 'The recursion is log n levels deep and each frame holds three vertex indices, ' +
          'so the total is O(log² n) bits. Nothing else is stored anywhere — no visited set, no ' +
          'memo table — and the cost is that each level tries every midpoint and re-explores ' +
          'both halves from scratch, giving n^log n work.',
        example: 'At twelve vertices: 48 bits and 9 325 calls, against BFS at 48 bits and 12 ' +
          'steps — the space advantage only appears at larger n.'
      },
      {
        term: 'PSPACE = NPSPACE, and the same argument gives nothing for time',
        plain: 'Squaring a polynomial is a polynomial; squaring an exponential is not.',
        formal: 'Savitch settles the space question and leaves P versus NP untouched',
        detail: 'One theorem, two questions, and only one of them answered — which is a striking ' +
          'asymmetry given how similar the two questions look when stated. It is the clearest ' +
          'available illustration that space and time are not the same resource wearing ' +
          'different labels.',
        example: 'The class table marks PSPACE = NPSPACE as settled and P versus NP as open.'
      },
      {
        term: 'NL = coNL, which nobody expected',
        plain: 'Nondeterministic space classes are closed under complement.',
        formal: 'Immerman and Szelepcsényi, independently, 1987',
        detail: 'The technique — inductive counting — computes the NUMBER of reachable vertices ' +
          'at each distance without storing which they are, and then uses that count to verify ' +
          'non-reachability. The analogous question for time, whether NP = coNP, is wide open and ' +
          'believed false, which makes the space result all the more surprising.',
        example: 'The class table names it beside NL, because it is the fact about that class ' +
          'most likely to be mis-stated.'
      },
      {
        term: 'Recomputation is a legitimate alternative to caching',
        plain: 'Keep less, derive more — and the trade is a dial rather than a mistake.',
        formal: 'the space-time product is what a design actually chooses',
        detail: 'Gradient checkpointing, log-structured storage, streaming windows, ' +
          'content-hashed build caches and Merkle proofs are all points on that dial. What is ' +
          'worth noticing is that the reason is often correctness rather than memory pressure: a ' +
          'cache that is only a hint cannot be stale, and one durable artefact is simpler than ' +
          'two kept consistent.',
        example: 'The practice table lists seven systems with what each stores and what each ' +
          're-derives.'
      }
    ],

    'randomised-and-interactive-classes': [
      {
        term: 'The randomised classes differ in where the error is allowed to be',
        plain: 'RP never accepts a false claim; co-RP never rejects a true one; BPP allows both.',
        formal: 'RP: no error on no-instances · co-RP: no error on yes-instances · BPP: bounded error on both',
        detail: 'That is the whole taxonomy, and it is the practical question about any ' +
          'randomised algorithm: not "is it right" but "which direction can it be wrong in". A ' +
          'primality test that never calls a prime composite is a completely different tool from ' +
          'one that never calls a composite prime.',
        example: 'The class table lists six with their error direction and how each amplifies.'
      },
      {
        term: 'Amplification makes bounded error as good as none',
        plain: 'Repeat and take the majority; the error falls exponentially.',
        formal: 'one-sided: 2^-k after k runs · two-sided: exponentially by the Chernoff bound',
        detail: 'Thirty repetitions of a coin-flip-level algorithm gives an error below one in a ' +
          'billion, which is well under the rate at which hardware silently corrupts a ' +
          'computation. That comparison is the honest way to think about it: randomised failure ' +
          'is engineered down until it is smaller than failures nobody worries about.',
        example: 'The soundness table measures 2^-k for k from 1 to 6 and lands within three ' +
          'sigma at every row.'
      },
      {
        term: 'BPP may equal P, and the evidence is decent',
        plain: 'Randomness may be a convenience rather than a resource.',
        formal: 'the derandomisation conjecture: every BPP algorithm has a deterministic polynomial equivalent',
        detail: 'Primality was in co-RP for decades before AKS put it in P, which is the ' +
          'clearest data point. The conjecture rests on circuit lower bounds nobody can prove, ' +
          'so it is believed rather than known — but it means the practical value of randomness ' +
          'may be constant factors and simplicity rather than power.',
        example: 'The atlas note for primality records that everyone still uses Miller–Rabin, ' +
          'because the deterministic guarantee is not worth the constant.'
      },
      {
        term: 'An interactive proof is a conversation with an untrusted prover',
        plain: 'The verifier must be efficient; the prover may be unbounded and may lie.',
        formal: 'completeness: an honest prover always convinces on a true claim · soundness: no prover convinces often on a false one',
        detail: 'Both halves are needed and they are measured differently. Completeness is ' +
          'checked by running the honest prover and finding no rejections; soundness by running a ' +
          'lying one many times and comparing the acceptance rate to the bound. A protocol with ' +
          'only one half checked is a protocol with an untested failure mode.',
        example: 'The honest prover is accepted 500 times out of 500 at eight rounds; the lying ' +
          'one is accepted 1.35% of the time at six.'
      },
      {
        term: 'Graph non-isomorphism has no short certificate anybody knows',
        plain: 'To prove two graphs ARE isomorphic you show the permutation; to prove they are not, there is nothing to show.',
        formal: 'GI is in NP; its complement is not known to be',
        detail: 'That is why it is the standard example: interaction plus randomness verifies ' +
          'something a certificate cannot, which means IP contains a problem NP is not known to. ' +
          'The protocol is one line — permute one of the graphs and ask which it was — and its ' +
          'verifier does no isomorphism testing at all.',
        example: 'The demo\'s honest pair is a six-cycle against two triangles: same vertex ' +
          'count, same edge count, different structure.'
      },
      {
        term: 'The verifier’s randomness is what makes the round mean anything',
        plain: 'The choice is secret until the answer is in.',
        formal: 'soundness is over the verifier’s coins, not the prover’s',
        detail: 'A deterministic verifier would be predictable, and a prover that knows which ' +
          'graph will be chosen answers correctly every time regardless of the truth. That is ' +
          'why the stubborn prover — which always answers the same thing — fares exactly as well ' +
          'as the guessing one: the verifier\'s coin is what decides, not the prover\'s strategy.',
        example: 'The stubborn and guessing provers both land on 2^-k, measured separately.'
      },
      {
        term: 'IP = PSPACE, which was the surprise of 1990',
        plain: 'Interaction with a randomised verifier captures exactly polynomial space.',
        formal: 'Shamir, building on Lund, Fortnow, Karloff and Nisan',
        detail: 'An enormous class, far beyond NP, verified by a conversation with a polynomial ' +
          'verifier. The technique — arithmetisation, turning a Boolean formula into a ' +
          'polynomial and checking it at random points — is the ancestor of most modern proof ' +
          'systems, including the ones under succinct proofs today.',
        example: 'The class table lists IP with graph non-isomorphism as its example and the ' +
          'PSPACE equality as its note.'
      },
      {
        term: 'A weak verifier checking a claim it could never compute is an engineering pattern',
        plain: 'Light clients, rollups, certificate transparency and outsourced computation are all this.',
        formal: 'the soundness error is the security argument, and it is a number',
        detail: 'In each case the question worth asking is the one the demo answers for the toy ' +
          'protocol: what is the error, and has anyone measured it against an implementation ' +
          'rather than against the paper? An unmeasured 2^-k is a claim about a protocol; a ' +
          'measured one is a claim about code, and the gap between them is where the interesting ' +
          'failures have been.',
        example: 'The practice table lists six deployed systems with their verifier, their prover ' +
          'and what the arrangement buys.'
      }
    ],

    'circuits-and-non-uniform-computation': [
      {
        term: 'A circuit works for exactly one input length',
        plain: 'To handle every length you need a family, one circuit per n.',
        formal: 'a circuit family is a sequence C_1, C_2, ... with C_n taking n inputs',
        detail: 'Everything strange about this model follows from that. A family is a different ' +
          'kind of object from an algorithm — it is an infinite sequence of finite objects, and ' +
          'nothing requires the sequence to be generated by anything. Holding that distinction ' +
          'is what makes the rest of the section make sense.',
        example: 'The demo builds a family and reports size and depth at each width separately.'
      },
      {
        term: 'Size is area and depth is latency',
        plain: 'Both readings are physical, and hardware makes exactly this trade.',
        formal: 'size = gate count · depth = longest path from an input to the output',
        detail: 'Every gate on the critical path must settle before the next can start, so depth ' +
          'multiplied by a gate delay is a propagation time. The demo does that multiplication ' +
          'because it is how a hardware engineer reads the number, and because it makes ' +
          '"logarithmic depth" into picoseconds.',
        example: 'A six-bit ripple carry is 21 gates and 11 deep; lookahead is 28 gates and 3 ' +
          'deep — 220 ps against 60 ps at 20 ps per gate.'
      },
      {
        term: 'Depth is also parallel time',
        plain: 'Every gate at the same level can fire simultaneously.',
        formal: 'a depth-d circuit computes in d steps given unlimited processors',
        detail: 'That is what makes NC — polylogarithmic depth, polynomial size — the formal ' +
          'meaning of "parallelises well", and what makes a P-complete problem one nobody knows ' +
          'how to parallelise. Whether NC = P is open, and it is the parallel-computing version ' +
          'of P versus NP.',
        example: 'The layer view shows the gate count per level; an OR tree over eight inputs is ' +
          '8, 4, 2, 1.'
      },
      {
        term: 'Non-uniformity means P/poly contains undecidable languages',
        plain: 'Nothing requires a program to generate the family.',
        formal: 'encode the answer to an undecidable question one bit per input length',
        detail: 'Each individual circuit is then a constant — perfectly finite and perfectly ' +
          'legal — and the family as a whole decides something no algorithm can. That is not a ' +
          'loophole to be patched; it is what makes circuit lower bounds the strongest kind, ' +
          'because proving one rules out every algorithm AND every family nobody could write ' +
          'down.',
        example: 'The class table marks P/poly as containing undecidable languages and ' +
          'provably excluding nothing anybody can name.'
      },
      {
        term: 'Unbounded fan-in is what makes constant depth possible',
        plain: 'With two-input gates, seeing every input at all needs logarithmic depth.',
        formal: 'AC⁰ allows a gate to take any number of inputs; NC¹ does not',
        detail: 'That single difference separates the two classes, and it is a real hardware ' +
          'idealisation — a wide gate is slower in practice, so AC⁰ charges nothing for ' +
          'something that is not free. Knowing which idealisation a class makes is what stops ' +
          'the results being applied where they do not hold.',
        example: 'OR over sixteen bits is 1 gate at depth 1 with unbounded fan-in, and 15 gates ' +
          'at depth 4 without.'
      },
      {
        term: 'PARITY is not in AC⁰, and it is one of very few unconditional lower bounds',
        plain: 'Constant depth needs exponential size for it, proved.',
        formal: 'Furst, Saxe and Sipser (1984); tight by Håstad’s switching lemma (1986)',
        detail: 'OR sits comfortably in AC⁰ and PARITY does not, and the two look almost ' +
          'identical when built with bounded fan-in — same size, same depth. The difference only ' +
          'appears when a single gate may take every input, which is exactly what makes the ' +
          'result about the model rather than about the function\'s apparent difficulty.',
        example: 'The demo builds both as chains and trees, and the size and depth columns are ' +
          'identical at every width.'
      },
      {
        term: 'The two barriers explain why so little is proved',
        plain: 'Relativisation and natural proofs block almost every technique anyone has tried.',
        formal: 'relativisation: it works with an oracle · natural proofs: it would break pseudorandom generators',
        detail: 'Razborov and Rudich showed that any lower-bound argument that is broad enough ' +
          'to apply to most functions and constructive enough to check would contradict the ' +
          'hardness assumptions cryptography rests on. So a technique that proves circuit lower ' +
          'bounds must be either narrow or non-constructive, and nobody has found one that is ' +
          'either and works.',
        example: 'The class table lists nothing in the exclusion column for any class but AC⁰.'
      },
      {
        term: 'Correctness has to be checked beside size and depth',
        plain: 'A family that grows beautifully and computes the wrong thing is the easiest mistake here.',
        formal: 'exhaustive over all 2^n inputs, against the function written independently',
        detail: 'A size-and-depth table with no correctness column beside it is measuring the ' +
          'wrong object, because the interesting circuits in this section are the ones where the ' +
          'construction is subtle — the carry-lookahead chain in particular is easy to build ' +
          'almost right. Exhaustive checking is possible at these widths and stops being ' +
          'possible almost immediately after.',
        example: 'Every width in the demo is checked over every input combination — 256 of them ' +
          'at eight inputs.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
