/** Reference entries for dynamic analysis, fuzzing and specification (M32.9-M32.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'dynamic-analysis': {
      summary: 'Happens-before against locksets over seven traces, with an oracle that '
        + 'enumerates every schedule the synchronisation allows rather than trusting either '
        + 'detector — 3 real races, 0 false positives from vector clocks, 4 from a plain '
        + 'lockset and 1 after Eraser\'s state machine.',
      intuition: 'A detector only sees the interleaving that happened, so it has to reason '
        + 'about happens-before rather than about what actually overlapped — which is how it '
        + 'finds races in a run where nothing went wrong.',
      formulation: {
        equations: [
          {
            label: 'Seven traces, three detectors, judged by every schedule',
            expr: 'detector · real races found · reported and impossible',
            terms: [
              { sym: 'the schedule oracle', meaning: '3 · —' },
              { sym: 'happens-before', meaning: '3 · 0' },
              { sym: 'lockset, plain', meaning: '3 · 4' },
              { sym: 'lockset, Eraser state machine', meaning: '3 · 1' }
            ]
          },
          {
            label: 'What the surviving false positive is',
            expr: 'trace · what happens · why the lockset reports it',
            terms: [
              { sym: 'handover', meaning: 'written, then a fork, then read · no lock covers both' },
              { sym: 'readOnly', meaning: 'two threads read · no lock at all' },
              { sym: 'published', meaning: 'written under a lock, forked, written again · no common lock' },
              { sym: 'schedule states to settle each trace', meaning: '5 to 25' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The oracle enumerates schedules; it is not another detector',
          why: 'Judging one detector by another is how two tools agree on a wrong answer.',
          breaks: 'Program order comes from the trace, and every interleaving the locks, forks and joins allow is explored.'
        },
        {
          name: 'An exhausted enumeration is reported as one',
          why: 'A truncated search that found no race looks exactly like a program that has none.',
          breaks: 'The oracle carries an `exhausted` flag beside every verdict.'
        },
        {
          name: 'Both detectors must find every real race',
          why: 'A false positive costs an engineer ten minutes; a missed race is the bug the tool exists to find.',
          breaks: 'The missed column is asserted to be zero on every fixture, for both algorithms.'
        }
      ],
      complexity: [
        { operation: 'happens-before, per event', average: 'one clock join or one comparison per conflicting pair', worst: 'linear in the threads per operation' },
        { operation: 'lockset, per access', average: 'an intersection with the held set', worst: 'linear in the locks held' },
        { operation: 'the schedule oracle', average: 'the reachable interleaving states', worst: 'exponential in the events, which is why fixtures are a dozen' },
        { operation: 'IR instrumentation at run time', average: '2 to 20 times slowdown', worst: 'the same, and it decides whether the tool runs in CI' },
        { operation: 'sampling', average: 'one to five per cent', worst: 'the same, and it can never see a race' }
      ],
      failureModes: [
        {
          symptom: 'A race detector reports a field written once during construction.',
          cause: 'A lockset algorithm without the state machine: initialisation before publication has no common lock.',
          fix: 'Use a happens-before detector, or read lockset reports on immutable-after-construction data as noise.'
        },
        {
          symptom: 'A race detector finds nothing and the system still corrupts data.',
          cause: 'The racing code path never ran under the detector.',
          fix: 'Dynamic analysis is silent about code that did not run; increase coverage or pair it with a static analysis.'
        },
        {
          symptom: 'A coverage figure of 100 per cent hides half the behaviour.',
          cause: 'It was statement coverage, and the branches were never taken both ways.',
          fix: 'Report the criterion beside the number, and target branch coverage at minimum.'
        },
        {
          symptom: 'The team disables the sanitiser because CI got too slow.',
          cause: 'Instrumentation at 10 to 20 times was applied to the whole suite.',
          fix: 'Run it on a subset, or nightly; the overhead decides where a tool can live and cannot be tuned away.'
        }
      ],
      inTheWild: [
        'ThreadSanitizer, which is FastTrack-style happens-before and is why races are findable at all in C++ and Go.',
        'Eraser and the lockset algorithm, and the state machine that made it usable.',
        'Java\'s Java PathFinder and the race detectors built into the JVM tooling.',
        'AddressSanitizer and Valgrind, the same instrumentation idea applied to memory errors.'
      ],
      sources: [
        { title: 'Savage et al. — Eraser: a dynamic data race detector', note: 'the lockset algorithm, with the state machine' },
        { title: 'Flanagan, Freund — FastTrack', note: 'vector clocks made cheap enough to ship' },
        { title: 'Lamport — Time, clocks and the ordering of events', note: 'happens-before itself' },
        { title: 'Serebryany et al. — ThreadSanitizer', note: 'what it costs to run this on real programs' }
      ]
    },

    'coverage-guided-fuzzing': {
      summary: 'The AFL loop against two targets, with the oracle set as a control: crashes '
        + 'alone find one planted defect and a differential reference finds both, including a '
        + 'two-character wrong answer that never throws — plus corpus minimisation that keeps '
        + 'all 60 edges while dropping bytes.',
      intuition: 'The mutation is easy and the oracle is the hard part: without sanitisers, '
        + 'assertions or a reference implementation, the only bug a fuzzer can find is a crash, '
        + 'and most bugs are not crashes.',
      formulation: {
        equations: [
          {
            label: 'The bracket target, 1 200 mutations from two seeds',
            expr: 'oracles · executions · findings · what is missed',
            terms: [
              { sym: 'crashes only', meaning: '1 202 · 1 · the wrong answer' },
              { sym: 'crashes and a differential', meaning: '1 202 · 2 · nothing planted' },
              { sym: 'the wrong answer, shrunk', meaning: '`[)` — 2 bytes, 71 hits' },
              { sym: 'the crash, shrunk', meaning: '9 bytes to 7, 69 hits' }
            ]
          },
          {
            label: 'The front end, same loop and budget',
            expr: 'measurement · value',
            terms: [
              { sym: 'executions · coverage · corpus', meaning: '1 202 · 60 · 24' },
              { sym: 'corpus after minimisation', meaning: '22 entries, 423 bytes of 473' },
              { sym: 'coverage after minimisation', meaning: '60 — unchanged, which is the point' },
              { sym: 'defects this loop found', meaning: '2, on inputs of 4 and 12 characters' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'An input joins the corpus only if it covered something new',
          why: 'The corpus is a summary of behaviours, not a log of inputs, and a redundant entry slows every later mutation.',
          breaks: 'Roughly 1 192 of 1 202 executions here are discarded.'
        },
        {
          name: 'Minimisation must not change total coverage',
          why: 'A smaller corpus that lost an edge has lost a test, silently.',
          breaks: 'Coverage is compared before and after: 60 edges either way.'
        },
        {
          name: 'A shrunk input must fail the same way',
          why: 'Otherwise the shrinker wanders into a different bug and reports a minimum for the wrong one.',
          breaks: 'Every candidate is re-run and kept only if the verdict matches the original.'
        },
        {
          name: 'Findings are grouped by failure, not by input',
          why: 'The same defect is reached thousands of times, and one report per input is unusable.',
          breaks: 'Two findings here, hit 71 and 69 times.'
        }
      ],
      complexity: [
        { operation: 'one iteration', average: 'one mutation and one execution of the target', worst: 'the target dominates, always' },
        { operation: 'coverage comparison', average: 'a set difference against the edges seen', worst: 'linear in the edges the input covered' },
        { operation: 'shrinking', average: 'delta debugging: quadratic in the input in the worst case', worst: 'bounded here at 60 rounds' },
        { operation: 'corpus minimisation', average: 'greedy set cover, sorted by size', worst: 'not optimal — set cover is NP-hard, and greedy is what everyone ships' },
        { operation: 'the coverage curve', average: 'flattens in every campaign', worst: 'and a flat curve is not a clean target' }
      ],
      failureModes: [
        {
          symptom: 'A long campaign finds nothing and the code is full of bugs.',
          cause: 'Only a crash oracle: every wrong answer that does not throw is invisible.',
          fix: 'Add a round-trip property, a slow reference implementation, or the assertions somebody disabled.'
        },
        {
          symptom: 'The coverage curve flattens after an hour.',
          cause: 'The corpus and the mutators can no longer reach new behaviour.',
          fix: 'A new seed, a token dictionary, or a grammar-based generator — not a longer run.'
        },
        {
          symptom: 'Thousands of findings, all the same bug.',
          cause: 'No deduplication: one report per crashing input.',
          fix: 'Group by the failure signature and report a hit count.'
        },
        {
          symptom: 'A campaign that starts from a saved corpus is slower every time.',
          cause: 'The corpus grew monotonically and most of it is redundant.',
          fix: 'Minimise it, and assert the coverage is unchanged afterwards.'
        }
      ],
      inTheWild: [
        'AFL and libFuzzer, which made coverage-guided fuzzing standard practice.',
        'OSS-Fuzz, which runs it continuously against hundreds of open-source projects.',
        'Microsoft SAGE, which found a large share of the file-parser bugs in Windows.',
        'Csmith and the compiler-fuzzing literature, where the oracle is a differential between compilers.'
      ],
      sources: [
        { title: 'Zalewski — American Fuzzy Lop technical whitepaper', note: 'the loop, the edge coverage and the corpus' },
        { title: 'Zeller, Hildebrandt — Simplifying and isolating failure-inducing input', note: 'delta debugging, which is what shrinking is' },
        { title: 'Yang et al. — Finding and understanding bugs in C compilers', note: 'Csmith: the oracle problem solved by differential testing' },
        { title: 'Bohme, Pham, Roychoudhury — Coverage-based greybox fuzzing as Markov chain', note: 'why seed scheduling matters as much as mutation' }
      ]
    },

    'specifying-systems': {
      summary: 'Four specifications written as data — two-phase commit with and without a '
        + 'modelled crash, a retry with and without an idempotence key — compiled to the '
        + 'checker from 32.7, with counter-examples in the specification\'s own vocabulary and '
        + 'every trace replayed.',
      intuition: 'The value is in the specification, which forces the ambiguities out; the '
        + 'checker mostly confirms what writing it already revealed.',
      formulation: {
        equations: [
          {
            label: 'Four specifications, checked exhaustively',
            expr: 'spec · reachable of allowed · transitions · verdict',
            terms: [
              { sym: 'two-phase commit, crash modelled', meaning: '19 of 256 · 36 · broken in 4 steps' },
              { sym: 'two-phase commit, no failures', meaning: '10 of 256 · 14 · clean' },
              { sym: 'retry, no idempotence key', meaning: '8 of 64 · 8 · broken in 5 steps' },
              { sym: 'retry with a key', meaning: '8 of 64 · 8 · clean' }
            ]
          },
          {
            label: 'The blocking scenario, step by step',
            expr: 'step · action · what holds afterwards',
            terms: [
              { sym: '1', meaning: 'coordinator sends prepare · prepare' },
              { sym: '2', meaning: 'participant 1 votes yes · prepare, v1' },
              { sym: '3', meaning: 'the coordinator fails · prepare, v1, down' },
              { sym: '4', meaning: 'participant 1 is blocked · stuck1 — the invariant breaks' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Nothing in a specification is a function',
          why: 'A spec that prints as a table gets reviewed by people who will never run a checker, and the review is where the value is.',
          breaks: 'Variables, initial values, guards and effects are all strings and booleans.'
        },
        {
          name: 'An invariant is an implication',
          why: '"Whenever this holds, that must too" is checkable at every state and reads like a sentence.',
          breaks: 'A violation names the invariant it broke rather than reporting a bare false.'
        },
        {
          name: 'Every counter-example is replayed against the specification',
          why: 'A trace produced by a buggy successor generation is indistinguishable from a real one.',
          breaks: 'Each guard is re-checked and the final state confirmed to break an invariant.'
        },
        {
          name: 'A model says nothing about an implementation',
          why: 'The refinement obligation is discharged by review or conformance testing, and usually by neither.',
          breaks: 'The reports here claim the design is wrong, never that any code is right.'
        }
      ],
      complexity: [
        { operation: 'checking a specification here', average: 'the reachable state count — 8 to 19', worst: 'exponential in the variables, which is why they are boolean' },
        { operation: 'adding one boolean variable', average: 'doubles the state space the variables allow', worst: 'the same, and the reachable set usually grows more slowly' },
        { operation: 'adding one action', average: 'more transitions and often more reachable states', worst: 'the crash action takes two-phase commit from 10 states to 19' },
        { operation: 'writing the specification', average: 'days to weeks per protocol', worst: 'and it is where all the cost is' },
        { operation: 'running the check', average: 'milliseconds at this scale', worst: 'hours for an industrial model, which is still the cheap part' }
      ],
      failureModes: [
        {
          symptom: 'The model checks clean and the system fails in production.',
          cause: 'No failures were modelled, so the reachable set contains no failure behaviours.',
          fix: 'Model the crash, the lost message, the duplicate delivery — the behaviours your tests do not produce.'
        },
        {
          symptom: 'The specification is written and nobody reads it.',
          cause: 'It is code rather than data, so reading it requires running it.',
          fix: 'Keep it printable; a table in a design document is reviewed by people a checker never reaches.'
        },
        {
          symptom: 'A proved model is quoted as a guarantee about the implementation.',
          cause: 'The refinement obligation was never discharged.',
          fix: 'Say which one you have; conformance testing driven from the spec is the practical middle ground.'
        },
        {
          symptom: 'The state space explodes before anything is checked.',
          cause: 'The model has integers, sets or too many participants.',
          fix: 'Abstract aggressively and rely on the small-scope hypothesis: two or three participants find almost every protocol bug.'
        }
      ],
      inTheWild: [
        'Amazon\'s use of TLA+ on S3, DynamoDB and EBS, with bugs found at trace depths of 35.',
        'Azure Cosmos DB, whose consistency levels are specified in TLA+.',
        'seL4 and CompCert, at the other end of the cost scale — full functional correctness proofs.',
        'Property-based testing (QuickCheck, Hypothesis), the executable end of the same idea.'
      ],
      sources: [
        { title: 'Newcombe et al. — How Amazon Web Services uses formal methods', note: 'the industrial report everybody cites, including the costs' },
        { title: 'Lamport — Specifying Systems', note: 'TLA+ itself, and the argument for specification before code' },
        { title: 'Jackson — Software Abstractions', note: 'Alloy, and the small-scope hypothesis stated properly' },
        { title: 'Gray — Notes on data base operating systems', note: 'two-phase commit and its blocking problem, from the source' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
