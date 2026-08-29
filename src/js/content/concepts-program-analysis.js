/** Concepts for the foundations of static analysis and abstract interpretation (M32.1-M32.2). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'static-analysis-foundations': [
      {
        term: 'Soundness and completeness are properties with respect to a property',
        plain: 'Neither word means anything until you say what the analysis is claiming.',
        formal: 'sound: everything real is reported. complete: everything reported is real',
        detail: 'A tool is not "sound" the way a bridge is safe; it is sound for a stated ' +
          'property, and the same tool can be sound for null dereferences and neither sound ' +
          'nor complete for data races. This is why vendor copy saying "finds real bugs" is ' +
          'not a guarantee: a guarantee names the property and the direction. Asking which ' +
          'one a tool offers is the first question, and the answer decides how to read its ' +
          'silence.',
        example: 'The interval analysis in the demo is sound for "which values can this ' +
          'variable hold": 0 of 51 observed values fell outside its claims.'
      },
      {
        term: 'Rice\'s theorem is why approximation is mandatory rather than a compromise',
        plain: 'Every interesting question about what a program does is undecidable.',
        formal: 'no algorithm decides a non-trivial semantic property of arbitrary programs',
        readAs: 'pick any property of a program\'s behaviour that some programs have and ' +
          'others do not; no program can decide it for every input program.',
        detail: 'That result removes the option everybody wants, which is an exact answer, ' +
          'and turns the whole field into a choice about WHICH way to be wrong. It is not a ' +
          'statement about current techniques or about how fast computers are, so no amount ' +
          'of engineering removes it — the practical consequence is that any tool claiming ' +
          'both no false positives and no false negatives is either restricted to a decidable ' +
          'fragment or wrong.',
        example: 'The demo shows four analyses of one loop; all four are sound and all four ' +
          'are wrong in the same direction, by 4 to 7 claims that admit values the run never ' +
          'produced.'
      },
      {
        term: 'Over-approximation gives false positives, under-approximation false negatives',
        diagram: {
          definition: [
            'flowchart LR',
            '    O["everything the analysis says<br/>could happen"] --> R["what really happens"]',
            '    R --> U["what testing observed"]',
            '    O -.->|"the gap here is<br/>false positives"| R',
            '    R -.->|"the gap here is<br/>false negatives"| U'
          ].join('\n'),
          caption: 'A sound analysis lives in the outer ring and a test suite in the inner one. Neither is the middle, which is the thing you wanted and cannot have.'
        },
        plain: 'Claim too much and you warn about the impossible; claim too little and you miss bugs.',
        formal: 'a superset of the real behaviours, or a subset of them',
        detail: 'A type checker over-approximates and rejects programs that would have run ' +
          'correctly; a test suite under-approximates and misses everything it did not ' +
          'exercise. Both are the tool working as designed rather than failing, and an ' +
          'engineer who reads a type error as an insult or a green test run as a proof has ' +
          'mistaken which ring they are standing in. The choice between them is made per ' +
          'property, per tool, and it should be made deliberately.',
        example: 'On the loop the analysis claims x is in [0, 11] where the run produced 0 to ' +
          '10: one value of false-positive surface, on 7 of the 15 claims in the table.'
      },
      {
        term: 'Which direction to prefer is decided by what silence means',
        plain: 'Only a sound analysis has meaningful silence.',
        formal: 'a verifier must be sound; a bug finder people triage should be complete',
        detail: 'If a tool exists to prove a bug absent, an unsound one proves nothing and its ' +
          'clean report is worthless. If a tool exists to hand findings to a human, every ' +
          'false positive spends attention and past some rate the humans stop reading it — ' +
          'which makes an incomplete tool worthless in a different way. Most shipping tools ' +
          'are neither and are still valuable, provided everyone knows which failures to ' +
          'expect from them.',
        example: 'The quadrant table ends with the only column that matters in practice: what ' +
          'the tool\'s silence means, and for 3 of the 4 rows it means nothing at all.'
      },
      {
        term: 'Precision is a separate measurement from soundness',
        plain: 'How much wider the claim was than what actually happens.',
        formal: 'width of the claim minus width of the observed set, per claim',
        detail: 'Collapsing the two into one score is how the useless analyser wins: "any ' +
          'value is possible" is perfectly sound and says nothing. So the demo reports them ' +
          'as separate columns — violations, which must be zero, and the number of claims ' +
          'that are exact, wider, or at the top of the lattice. That second group is what a ' +
          'tool\'s users experience as noise, and it is the number a precision setting is ' +
          'actually buying.',
        example: 'On the counting loop: sign leaves 7 of 15 claims saying nothing, intervals ' +
          'with narrowing leave 0, and both are equally sound.'
      },
      {
        term: 'The precision axes are flow, path, context and field sensitivity',
        diagram: {
          definition: [
            'flowchart TD',
            '    A["one fact per procedure"] -->|"flow sensitivity"| B["one fact per<br/>program point"]',
            '    B -->|"path sensitivity"| C["one fact per<br/>path taken to get there"]',
            '    C -->|"context sensitivity"| D["one fact per<br/>calling context"]',
            '    D -->|"field sensitivity"| E["one fact per<br/>field of an object"]',
            '    E --> F["exact — and it does not terminate"]'
          ].join('\n'),
          caption: 'Every step down distinguishes two situations the analysis would otherwise merge, and every merge is where a false positive is created. Every step also multiplies the cost, which is why real tools stop partway.'
        },
        plain: 'Each one distinguishes situations a cheaper analysis merges.',
        formal: 'per program point, per path, per caller, per field',
        detail: 'Flow sensitivity is nearly free and nearly universal. Path sensitivity is ' +
          'exponential in the branches, which is why the symbolic executor in 32.4 has to ' +
          'bound its search. Context sensitivity means one summary per calling context or a ' +
          'k-limited approximation of that. Field sensitivity means an object\'s fields are ' +
          'separate abstract locations, and dropping it is why a clean field of a tainted ' +
          'record gets reported in 32.3.',
        example: 'Switching the taint analysis in 32.3 from field-insensitive to ' +
          'field-sensitive removes exactly one false positive on the record fixture and none ' +
          'on the array one.'
      },
      {
        term: 'A dynamic oracle can refute soundness and can never establish it',
        plain: 'It sees one run.',
        formal: 'one execution is a counter-example machine, not a proof machine',
        detail: 'Running the program and checking every observed value against the analyser\'s ' +
          'claim is the only cheap way to catch an unsound analysis, and it is completely ' +
          'one-directional: a violation is a bug in the analyser, and the absence of ' +
          'violations is the absence of evidence. That is why every soundness readout in this ' +
          'milestone prints the number of observations beside the verdict — with zero ' +
          'observations, every analysis on earth passes.',
        example: 'The counting loop check is based on 51 observed values; the nested loop on ' +
          '312. Neither number proves anything and both can refute.'
      },
      {
        term: 'Read the documentation for the guarantee, not for the adjectives',
        plain: '"Finds bugs" is marketing; "reports every X under assumptions Y" is a contract.',
        formal: 'the guarantee names a property, a direction and its modelling assumptions',
        detail: 'The assumptions are the part that decides whether the guarantee reaches your ' +
          'code: a checker that is sound provided there is no reflection, no dynamic loading ' +
          'and no native code is sound for a program that has all three in the sense that a ' +
          'weather forecast for Oslo is accurate in Lagos. Finding that sentence in the manual ' +
          'takes ten minutes and changes how every subsequent report from that tool should be ' +
          'read.',
        example: 'The demo\'s own guarantee: sound for the values of numeric locals, on ' +
          'programs whose control flow this IR represents, with no calls and no heap.'
      }
    ],

    'abstract-interpretation': [
      {
        term: 'An abstract domain is the set of claims you are willing to make',
        plain: 'Pick what your analyser can say, and it has to round everything else off.',
        formal: 'a lattice of abstract values with a concretisation back to sets of values',
        detail: 'Intervals can say "between 0 and 11" and cannot say "even". Parity can say ' +
          '"even" and cannot say "under a thousand". The congruence domain says "3 modulo 4"; ' +
          'the octagon domain says "x minus y is at most 2" and costs cubic time in the ' +
          'variables. Choosing among them is the design decision that fixes both what the ' +
          'analysis can prove and what it will cost, before a line of the transfer functions ' +
          'is written.',
        example: 'On the same loop, intervals leave 0 claims saying nothing and signs leave 7 ' +
          'of 15 — and signs cannot express the bound at all.'
      },
      {
        term: 'Abstraction and concretisation are the two directions, and only one must be faithful',
        plain: 'Up: the smallest claim covering these values. Down: every value this claim admits.',
        formal: 'a Galois connection between the concrete and abstract lattices',
        readAs: 'a pair of translations between real value sets and claims that never loses a ' +
          'real value on the way up.',
        detail: 'The requirement is one-sided: going up may add values that never occur, and ' +
          'must never drop one that does. That single asymmetry is the soundness of every ' +
          'analysis built this way, and it is why the demo checks the direction it does — ' +
          'observed values inside the claim. The other direction, adding values, is precision ' +
          'loss, which is measured separately and is never a correctness bug.',
        example: 'Abstracting the observed set {0, 2, 4, 6, 8, 10} to an interval gives [0, ' +
          '10]; the analysis reports [0, 11], which is one value wider and still sound.'
      },
      {
        term: 'A transfer function is one instruction, done to claims instead of values',
        plain: 'Adding two to a number becomes adding two to both ends of an interval.',
        formal: 'the abstract semantics of an operation, one per instruction',
        detail: 'Each one is where precision is quietly won or lost. Interval addition is ' +
          'exact; interval multiplication has to take the extremes of the four corner ' +
          'products because two negatives make a positive; interval division has to decide ' +
          'what to do about a divisor whose range includes zero. Getting one of these subtly ' +
          'too narrow is an unsoundness that no amount of fixpoint machinery will catch, ' +
          'which is what the dynamic oracle is for.',
        example: 'In the branch fixture, `0 - a` with a in [4, 4] gives [-4, -4], and the join ' +
          'with the other branch\'s [3, 3] gives [-4, 3].'
      },
      {
        term: 'A join at a merge point is a loss, and it is where false positives are born',
        diagram: {
          definition: [
            'flowchart TD',
            '    S["a is 4"] --> T{"if (a > 2)"}',
            '    T -->|"then"| X["b in [3, 3]"]',
            '    T -->|"else"| Y["b in [-4, -4]"]',
            '    X --> M["merge: b in [-4, 3]"]',
            '    Y --> M',
            '    M --> Z["b could be 0 here —<br/>and neither branch produces 0"]'
          ].join('\n'),
          caption: 'The join is the smallest interval containing both, which admits every value between them. A checker built on this would warn about a division by b.'
        },
        plain: 'Two branches arrive with different claims and one claim leaves.',
        formal: 'the least upper bound of the incoming states, taken per variable',
        detail: 'The merged claim admits everything either branch could produce and everything ' +
          'in between, which for intervals means values neither branch can ever produce. This ' +
          'is the origin of most of the noise in every tool built on this technique, and it is ' +
          'the exact thing path sensitivity buys back — at a price that is exponential in the ' +
          'branches, which is why it is bought selectively rather than switched on.',
        example: 'The branch fixture merges [3, 3] and [-4, -4] into [-4, 3], a claim that ' +
          'admits 0 although the programme never produces it.'
      },
      {
        term: 'The analysis is a fixpoint: sweep until a round changes nothing',
        plain: 'Keep recomputing every block until the answers stop moving.',
        formal: 'iterate the transfer and join until the state map is stable',
        detail: 'With the join alone the number of rounds is a property of the program being ' +
          'analysed rather than of the analyser: a loop counting to a thousand in twos needs ' +
          'one round per iteration, because each round admits exactly one more. That is ' +
          'tolerable at a bound of ten and hopeless at a thousand, and impossible when the ' +
          'bound is a parameter — which is the situation widening exists for.',
        example: 'Join only: 8 rounds at a bound of 10, 53 at 100, 103 at 200. With widening: ' +
          '3 rounds at every one of them.'
      },
      {
        term: 'Widening is deliberate surrender, and it is where termination comes from',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["round 1: x in [0, 0]"] --> B["round 2: the upper bound moved"]',
            '    B -->|"widen"| C["x in [0, plus infinity]"]',
            '    C --> D["round 3: nothing changed —<br/>this is the fixpoint"]',
            '    D -->|"narrow, reading the loop test"| E["x in [0, 11]"]'
          ].join('\n'),
          caption: 'Two rounds to terminate whatever the loop counts to, then one descending pass to take back what the branch conditions justify. The recovered bound is one wider than the truth, and that is the price.'
        },
        plain: 'If a bound moved at all, throw it to infinity instead of following it.',
        formal: 'an operator with no infinite ascending chains, applied at loop headers',
        detail: 'It is applied at loop headers and nowhere else: applying it at every merge ' +
          'also terminates and destroys the precision of every branch in the program, which ' +
          'is a common way to make an interval analysis useless while believing it is ' +
          'standard. The cost is real and visible — the bound you wanted is exactly the thing ' +
          'thrown away — and it is the reason a tool\'s usefulness on loops is almost entirely ' +
          'a function of its widening strategy.',
        example: 'Two widening steps on the counting loop take x from [0, 0] to [0, +∞] and ' +
          'the fixpoint is reached in the next round.'
      },
      {
        term: 'A round budget is not a substitute for widening: it produces a false answer',
        plain: 'An iteration that stops early has not approximated the fixpoint. It is below it.',
        formal: 'below the least fixpoint, the claim does not hold for every execution',
        detail: 'Everything above the fixpoint is sound and imprecise; everything below it is ' +
          'simply wrong. So a join-only analysis that runs out of rounds does not produce a ' +
          'weaker result, it produces a claim the program refutes — and it looks exactly like ' +
          'a converged one unless the implementation reports whether the last round changed ' +
          'anything. That flag is why the demo can show this at all rather than describing it.',
        example: 'Join only on the loop to 1000: the analysis claims x is in [0, 398] at the ' +
          'header, and one run puts 1 207 observed values outside the claim.'
      },
      {
        term: 'Narrowing descends once and only replaces infinite bounds',
        plain: 'Re-read the loop test and take back the bound widening threw away.',
        formal: 'a second, descending pass; an infinite bound may become finite, never the reverse',
        detail: 'Allowing narrowing to move any bound would re-open the ascending chain and ' +
          'the second pass would not terminate either, so the operator is deliberately ' +
          'restricted. What it recovers is whatever the branch conditions pin down, which on a ' +
          'simple counting loop is almost everything and on a nested one is the inner loop ' +
          'only. That partial recovery is the classic scheme working as designed, not a bug to ' +
          'chase.',
        example: 'The nested fixture recovers the inner counter to [0, 3] exactly, and leaves ' +
          'the outer one at [0, +∞].'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
