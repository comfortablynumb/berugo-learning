/** Concepts for dynamic analysis, fuzzing and specification (M32.9-M32.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'dynamic-analysis': [
      {
        term: 'A dynamic analysis sees one execution and must reason about the others',
        plain: 'The interleaving that happened is usually the correct one.',
        formal: 'the trace is a witness; the conclusion is about every schedule of that trace',
        detail: 'A race detector that only reported what actually overlapped would find almost '
          + 'nothing, because the run that happened to work is the run you have. The whole '
          + 'technique is inferring what COULD have happened from what did, which is why a '
          + 'happens-before detector finds races in a test suite where every assertion passed '
          + 'and nothing looked wrong.',
        example: 'The seven fixtures here contain 3 locations that can really race, and no run '
          + 'of them ever produces a wrong answer.'
      },
      {
        term: 'Instrumentation decides where a tool can run, and that decides what it finds',
        plain: 'Source, IR, binary, or sampling — each sees different things at different cost.',
        formal: 'overhead ranges from a few per cent to a hundred times',
        detail: 'IR or bytecode instrumentation is what sanitisers and race detectors use: it '
          + 'sees everything the compiler sees, uniformly, at two to twenty times slowdown, '
          + 'which fits a test suite and not production. A sampling profiler costs one to five '
          + 'per cent and runs in production, and can never see a race because everything '
          + 'interesting happens between samples. Neither can be moved into the other\'s place '
          + 'by tuning.',
        example: 'The demo runs on recorded traces, which costs nothing and is why it can '
          + 'afford to enumerate every schedule.'
      },
      {
        term: 'Vector clocks are the whole of happens-before detection',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["thread 1: write x"] --> R["release L<br/>the lock takes a copy<br/>of thread 1\'s clock"]',
            '    R --> Q["acquire L<br/>thread 2 joins that clock<br/>into its own"]',
            '    Q --> B["thread 2: write x"]',
            '    A -.->|"now ordered:<br/>no schedule runs them together"| B',
            '    C["no release and acquire between them"] -.->|"unordered"| D["a race"]'
          ].join('\n'),
          caption: 'A release stores the clock, a matching acquire joins it, and fork and join copy clocks between threads. Two conflicting accesses race when neither clock precedes the other.'
        },
        plain: 'Each thread carries a clock; synchronisation copies clocks between them.',
        formal: 'two accesses race when neither precedes the other and one is a write',
        detail: 'That is the entire algorithm, and its cost is one clock comparison per pair of '
          + 'conflicting accesses rather than a search over schedules. It is also why it is '
          + 'exact on the trace it sees: the partial order it computes is the real one, so '
          + 'anything it reports really can happen and anything it misses did not appear in '
          + 'this run.',
        example: 'Across all seven fixtures happens-before reports 3 races and 0 false '
          + 'positives, measured against every schedule.'
      },
      {
        term: 'The lockset algorithm asks a different question and gets different answers',
        plain: 'Is one lock held at every access to this location?',
        formal: 'intersect the locks held at each access; an empty intersection is reported',
        detail: 'It is cheap, it needs no clocks, and it is not a question about ordering — '
          + 'which is why it reports locations that a fork, a join or an initialisation before '
          + 'publication has made perfectly safe. The distinction matters when reading a '
          + 'report: a lockset tool is telling you about a locking discipline, and a violated '
          + 'locking discipline is not the same thing as a race.',
        example: 'Plain lockset reports 4 locations no schedule can race — config, result, '
          + 'table and queue.'
      },
      {
        term: 'Eraser\'s state machine is the difference between the algorithm described and published',
        diagram: {
          definition: [
            'flowchart LR',
            '    V["virgin"] -->|"first access"| E["exclusive to that thread<br/>— never reported"]',
            '    E -->|"another thread READS"| S["shared<br/>— refine the lockset, do not report"]',
            '    S -->|"another thread WRITES"| M["shared-modified<br/>— report an empty lockset"]',
            '    E -->|"another thread WRITES"| M'
          ].join('\n'),
          caption: 'Three of the four false positives disappear with this one refinement: initialisation before publication never leaves exclusive, and read-only sharing stops at shared.'
        },
        plain: 'Only report a location a second thread has written.',
        formal: 'virgin, exclusive, shared, shared-modified — reports come from the last state',
        detail: 'The refinement costs one state per location and removes the two commonest '
          + 'false positives outright. What it cannot remove is the third: a location written '
          + 'under a lock and then handed to a new thread reaches shared-modified with an empty '
          + 'lockset, and nothing in the algorithm looks at the fork that made it safe. That '
          + 'residual is structural rather than a tuning problem.',
        example: 'The state machine takes the lockset from 4 false positives to 1, and the one '
          + 'that remains is the fork.'
      },
      {
        term: 'The oracle for a race detector is every schedule, not another detector',
        plain: 'Take the program order out of the trace and run all the interleavings.',
        formal: 'a race exists when some legal schedule runs two conflicting accesses adjacently',
        detail: 'Judging one detector by another is how two tools agree on a wrong answer. The '
          + 'oracle here enumerates every interleaving the locks, forks and joins allow, which '
          + 'is exponential and exact — affordable exactly because a fixture is a dozen events. '
          + 'It reports whether it was exhaustive, because a truncated enumeration that found '
          + 'no race is indistinguishable from a program that has none.',
        example: 'The seven fixtures take 5 to 25 schedule states each to settle, all '
          + 'exhaustively.'
      },
      {
        term: 'Coverage criteria are not interchangeable, and the gap between the first two is large',
        plain: 'Every line run once is a much weaker claim than both sides of every branch.',
        formal: 'statement, branch, path and MC/DC, in increasing strength and cost',
        detail: 'Statement coverage is what most tools report and what most teams quote; branch '
          + 'coverage is the first criterion that says anything about decisions. Path coverage '
          + 'is exponential and is exactly what the symbolic executor in 32.4 has to bound. '
          + 'MC/DC exists because branch coverage is too weak for avionics and path coverage is '
          + 'unaffordable, and it requires each condition to be shown to change the outcome on '
          + 'its own.',
        example: 'A function with three ifs can reach 100 per cent statement coverage while '
          + 'missing half of its 8 paths.'
      },
      {
        term: 'A dynamic tool says nothing about code that did not run',
        plain: 'That is the standing gap, and no amount of engineering closes it.',
        formal: 'the analysis is sound for the observed execution and silent about the rest',
        detail: 'It is the exact mirror of the static analyses earlier in this milestone, which '
          + 'talk about every execution and pay for it in false positives. A race in a branch '
          + 'your tests never take is invisible to every dynamic tool ever built, and an '
          + 'unreachable state a static analyser warns about is invisible to every dynamic one '
          + 'too. Running both is not belt and braces; it is covering two different halves.',
        example: 'The demo\'s verdicts are all about the seven recorded traces, and say nothing '
          + 'about any execution that produced a different trace.'
      }
    ],

    'coverage-guided-fuzzing': [
      {
        term: 'The loop is four lines, and coverage feedback is what makes it a search',
        diagram: {
          definition: [
            'flowchart LR',
            '    C["corpus"] --> P["pick and mutate"]',
            '    P --> R["run"]',
            '    R --> N{"reached anything new?"}',
            '    N -->|"yes"| K["keep it — progress accumulates"]',
            '    K --> C',
            '    N -->|"no"| D["discard — 1 192 of 1 202 inputs here"]'
          ].join('\n'),
          caption: 'Without the feedback edge this is a random generator, which against a parser finds nothing. With it, an input that gets one token deeper is preserved and built on.'
        },
        plain: 'Mutate an input, run it, keep it if it reached something new.',
        formal: 'the corpus is a summary of behaviours found, not a log of inputs tried',
        detail: 'The discard rate is the loop working rather than a waste: an input covering '
          + 'nothing new has told you nothing, and keeping it would slow every later mutation. '
          + 'What makes the corpus valuable is that each entry represents a behaviour somebody '
          + 'reached once — which is why the splice mutator, joining the head of one entry to '
          + 'the tail of another, is a good bet rather than a random one.',
        example: 'Against the bracket target: 1 202 executions, 10 inputs kept, 16 distinct '
          + 'behaviours covered.'
      },
      {
        term: 'The oracle is the hard part, and it is measurable',
        plain: 'Without one, the only bug a fuzzer can find is a crash.',
        formal: 'crash, invariant and differential oracles find disjoint classes of bug',
        detail: 'A crash oracle is free and finds the subset of bugs that fall over. An '
          + 'invariant checks a property of the output, so it finds wrong results the program '
          + 'was happy with. A differential compares two implementations and finds anything '
          + 'they disagree about, which is why the reference has to be independent — a bug both '
          + 'share is invisible to it. Most real bugs are not crashes, so a fuzzer with only '
          + 'the first oracle is a crash finder.',
        example: 'With crashes alone the bracket target yields 1 finding; with a differential '
          + 'reference it yields 2, and the extra one is `[)`.'
      },
      {
        term: 'A wrong answer with no crash is the normal case',
        plain: 'Two characters, no exception, and the result is false.',
        formal: 'the counting implementation accepts `[)` and the stack reference rejects it',
        detail: 'The planted defect is deliberately ordinary: counting bracket depth instead of '
          + 'keeping a stack is a real shortcut people take, and it is wrong in a way that '
          + 'never throws. That is the shape of most defects a fuzzer could find and a crash '
          + 'oracle cannot, and it is the argument for spending an afternoon on an oracle '
          + 'rather than on making the loop faster.',
        example: 'The fuzzer finds `[)` after 71 hits on the same defect, and the shrinker '
          + 'cannot make it smaller than 2 bytes.'
      },
      {
        term: 'Shrinking turns a finding into a bug report',
        plain: 'Delete any span that still fails, and repeat.',
        formal: 'delta debugging: the minimum input that reproduces the failure',
        detail: 'A crash on nine random characters is a puzzle, and the same crash on seven '
          + 'with the irrelevant characters removed is a bug report — the difference is an hour '
          + 'of somebody\'s attention per finding, multiplied by every finding. The rule is '
          + 'that a candidate is kept only when it fails in the SAME way, which is what stops '
          + 'the shrinker from wandering into a different bug.',
        example: 'The nesting crash shrinks from 9 bytes to 7, which is the minimum that '
          + 'reaches a depth of seven.'
      },
      {
        term: 'Deduplication is what makes the finding count mean anything',
        plain: 'The same defect is reached by thousands of different inputs.',
        formal: 'group by the failure, not by the input that produced it',
        detail: 'Without it a campaign reports one finding per crashing input and the triage '
          + 'cost is proportional to how long the fuzzer ran, which is exactly backwards. '
          + 'Grouping by the failure — the message, the stack, the invariant broken — turns '
          + 'thousands of inputs into a handful of bugs with a hit count attached, and the hit '
          + 'count is itself useful: a defect reached by many inputs is usually shallow and '
          + 'easy to trigger in production.',
        example: 'Two findings on the bracket target, hit 71 and 69 times respectively out of '
          + '1 202 executions.'
      },
      {
        term: 'Corpus minimisation is set cover, and the coverage must not move',
        plain: 'Keep the smallest input contributing each edge; drop the rest.',
        formal: 'greedy by size, and total coverage before must equal total coverage after',
        detail: 'A corpus grows monotonically and most of it becomes redundant, which slows '
          + 'every future campaign that starts from it. The greedy set cover is the standard '
          + 'answer, and the measurement that matters is not how much smaller the corpus got '
          + 'but that the coverage did not change — a minimisation that loses an edge has lost '
          + 'a test, silently, and the next campaign starts from a worse position.',
        example: 'The front-end corpus goes from 24 inputs to 22 and from 473 bytes to 423, '
          + 'with all 60 edges kept.'
      },
      {
        term: 'A fuzzer against a front end is testing the error path',
        plain: 'Almost every mutated input is invalid.',
        formal: 'the loop spends its budget in the diagnostics rather than the happy path',
        detail: 'That is a feature: error handling is the code with the least test coverage and '
          + 'the most hostile input in production, and it is where both of the real defects '
          + 'behind this section were found. Both were in the PRINTER — the code that formats a '
          + 'tree for a diagnostic — which had assumed error recovery produced complete nodes, '
          + 'and neither would ever have been reached by a valid program.',
        example: '`let:` and `l = match 1;` — four and twelve characters — made the front end\'s '
          + 'own reporting path throw.'
      },
      {
        term: 'The coverage curve always flattens, and a flat curve is not a clean target',
        plain: 'It means these mutations have stopped reaching new behaviour.',
        formal: 'new edges per execution falls towards zero in every campaign',
        detail: 'Reading a flat curve as "the target is clean" is the commonest mistake in '
          + 'fuzzing practice; what it says is that the search has exhausted what this corpus '
          + 'and these mutators can reach. The answer is a new seed, a dictionary of tokens, a '
          + 'grammar from M25 to produce structurally valid inputs, or a different oracle — not '
          + 'a longer run at the same settings.',
        example: 'Half the budget buys most of the coverage; the second half of a 1 202-'
          + 'execution run adds only a handful of edges.'
      }
    ],

    'specifying-systems': [
      {
        term: 'The value is in writing the specification, not in the checker',
        plain: 'Deciding what the variables are forces the questions nobody asked.',
        formal: 'the model checker mostly confirms what writing the spec already revealed',
        detail: 'That is the least intuitive finding in the field and every industrial report '
          + 'says it. It changes what the technique is for: not "prove the system correct" but '
          + '"write down, as data, what the protocol\'s variables are, what changes them, and '
          + 'what must never be true — and notice how many of those questions you cannot '
          + 'answer". The unanswerable ones are the finding; the checker turns a suspicion into '
          + 'a trace.',
        example: 'Four specifications here, each a few dozen lines, and two of them are wrong '
          + 'in ways the trace states in four and five steps.'
      },
      {
        term: 'A specification is data, which is why somebody will read it',
        diagram: {
          definition: [
            'flowchart LR',
            '    D["variables, init, actions, invariants<br/>— all of it strings and booleans"] --> P["prints as a table"]',
            '    D --> C["compiles to the checker from 32.7"]',
            '    P --> R["reviewed by people who<br/>will never run a checker"]',
            '    C --> T["a counter-example naming actions,<br/>not bit patterns"]',
            '    R --> V["most of the value"]',
            '    T --> V'
          ].join('\n'),
          caption: 'Nothing in the specification is a function. That single constraint is what lets it be printed, diffed, reviewed and checked, and the review is where the reports say the value comes from.'
        },
        plain: 'Named variables, actions as "when these hold, set those", invariants as implications.',
        formal: 'no functions anywhere, so the whole spec is printable and diffable',
        detail: 'The constraint costs expressiveness — booleans only here, where a real '
          + 'modelling language has sets, functions and integers — and buys reviewability. It '
          + 'also keeps the state space small enough to enumerate exhaustively, which is what '
          + 'lets two independent checkers be compared against each other. A real language pays '
          + 'for its expressiveness with a state space no explicit search can walk.',
        example: 'Two-phase commit is 8 variables and 8 actions, and the whole thing prints in '
          + 'a table of nine rows.'
      },
      {
        term: 'An invariant is an implication, and writing it that way matters',
        plain: '"Whenever the coordinator has committed, both participants had voted."',
        formal: 'when these hold, those must too',
        detail: 'It is checkable at every state, it reads like a sentence an engineer would '
          + 'say, and it names the situation it is about — which is what makes a violation '
          + 'report meaningful. A bare predicate over the whole state is technically equivalent '
          + 'and is neither reviewable nor localisable when it fails.',
        example: 'The blocking scenario breaks "no participant is stuck", named in the report '
          + 'rather than derived from it.'
      },
      {
        term: 'A model with no failures in it will be clean, and its cleanliness means nothing',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["two-phase commit,<br/>no failure modelled"] --> B["10 reachable states<br/>every invariant holds"]',
            '    C["the same protocol plus<br/>one action: the coordinator fails"] --> D["19 reachable states<br/>broken in 4 steps"]',
            '    B -.->|"the difference is one action"| D'
          ].join('\n'),
          caption: 'The blocking scenario two-phase commit is famous for does not appear until the crash is modelled. A model is exactly as informative as the failures somebody thought to write down.'
        },
        plain: 'Model the crash, the lost message, the duplicate delivery.',
        formal: 'the reachable set only contains behaviours the actions permit',
        detail: 'This is where most first attempts go wrong, and the failure mode is quiet: the '
          + 'checker reports success, everyone relaxes, and the model was describing a world '
          + 'where nothing goes wrong. The behaviours worth modelling are exactly the ones your '
          + 'tests do not produce and your users will — a node that stops, a message that '
          + 'arrives twice, a reply that never comes.',
        example: 'Adding one action to two-phase commit takes it from 10 reachable states and '
          + 'clean to 19 and broken in 4 steps.'
      },
      {
        term: 'The counter-example arrives in the specification\'s vocabulary',
        plain: 'A sequence of named actions, not a sequence of bit patterns.',
        formal: 'each step names the action, what it changed, and what holds afterwards',
        detail: 'Both forms carry the same information and only one of them is a design '
          + 'discussion. This is where a modelling language earns its keep over hand-written '
          + 'state machines: the compiler from spec to model keeps the names, so the checker '
          + 'can hand back "prepare, vote, the coordinator fails, participant 1 is blocked" '
          + 'instead of four bit vectors.',
        example: 'Four steps, four action names, and the invariant it broke — short enough for '
          + 'a design document.'
      },
      {
        term: 'Small scope is a defensible position rather than a compromise',
        plain: 'Almost every protocol bug appears with two or three participants.',
        formal: 'the small-scope hypothesis, and the reason exhaustive checking is affordable',
        detail: 'These models have two participants and boolean variables and they find the bug '
          + 'the protocol is known for. Scaling the model up multiplies the state space without '
          + 'usually adding new BEHAVIOURS, which is why modelling three servers rather than a '
          + 'hundred is the right engineering call — and why the reachable-state count in the '
          + 'demo is a number a browser can enumerate at all.',
        example: 'Two-phase commit reaches 19 of the 256 states its 8 variables allow.'
      },
      {
        term: 'Refinement is the obligation nobody discharges mechanically',
        plain: 'A checked model says nothing about the code.',
        formal: 'every behaviour of the implementation must be a behaviour of the model',
        detail: 'The gap is closed by review, by conformance testing that drives the '
          + 'implementation from the spec, or by nothing at all — and in industry it is usually '
          + 'the third. Being honest about which one you have is the difference between a proof '
          + 'and a comfortable feeling, and the published reports are careful about it: they '
          + 'claim the DESIGNS were wrong and were fixed, not that the systems are correct.',
        example: 'The demo checks the model and can say nothing whatsoever about any '
          + 'implementation of it.'
      },
      {
        term: 'The cost is small and the value is uneven, so choose the target',
        plain: 'Days for a protocol whose failures are expensive; never for code a test would catch.',
        formal: 'the checks here run in milliseconds; the thinking takes days',
        detail: 'The industrial record is consistent about where it pays: replication, '
          + 'consistency, failover, consensus — designs whose failures are rare, expensive and '
          + 'nearly impossible to reproduce. It is equally consistent about the cost, which is '
          + 'weeks of engineer time per specification and not the checking. Applying it to '
          + 'business logic that changes every sprint is how verification efforts die.',
        example: 'Every check in this demo finishes in milliseconds over at most 36 '
          + 'transitions.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
