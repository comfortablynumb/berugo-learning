/** Worked examples for dynamic analysis, fuzzing and specification (M32.9-M32.11). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'dynamic-analysis': [
      {
        title: 'Two detectors, seven traces, and an oracle that runs every schedule',
        goal: 'Price the false positives instead of describing them.',
        setup: 'Seven recorded traces — unsynchronised, locked, different locks, a partial '
          + 'lock, a fork handover, read-only sharing, and a location published through a fork. '
          + 'The oracle takes the per-thread program order out of each and enumerates every '
          + 'interleaving the locks, forks and joins allow.',
        steps: [
          { do: 'Enumerate the schedules of each trace and record which locations can race.',
            why: 'A detector may not be its own judge.',
            work: '3 of the 7 traces can race, over 5 to 25 schedule states each' },
          { do: 'Run the happens-before detector over all seven.',
            why: 'Vector clocks compute the real partial order of the observed trace.',
            work: '3 found, 0 false positives, 0 missed' },
          { do: 'Run the plain lockset algorithm over the same seven.',
            why: 'It asks about locks rather than about ordering.',
            work: '3 found, and 4 locations reported that no schedule can race' },
          { do: 'Switch on Eraser\'s state machine and re-run.',
            why: 'Report only a location a second thread has written.',
            work: '3 found, 1 false positive — three of the four are gone' },
          { do: 'Look at the one that survives.',
            why: 'It is structural rather than a tuning problem.',
            work: '1 location — written under a lock, then handed to a new thread by a fork' }
        ],
        answer: 'Both detectors find every real race, which is the column nobody may lose, and '
          + 'they differ entirely in what else they report. Eraser\'s state machine removes the '
          + 'two commonest false positives — initialisation before publication, and read-only '
          + 'sharing — because both leave the location in a state the machine does not report '
          + 'from. The one it cannot remove is the fork, and no lockset algorithm can: nothing '
          + 'in it looks at ordering, so nothing in it can know that a fork makes two writes '
          + 'impossible to overlap. That is the argument for vector clocks in one sentence.'
      },
      {
        title: 'The trace that races and the trace that only looks like it',
        goal: 'Read two traces that a lockset cannot tell apart.',
        setup: 'The `differentLocks` trace: two threads each write `balance`, each holding a '
          + 'different lock. The `handover` trace: the main thread writes `config`, forks a '
          + 'worker, and the worker reads it. Neither has a lock covering both accesses.',
        steps: [
          { do: 'Enumerate the schedules of the different-locks trace.',
            why: 'Two locks that never conflict order nothing.',
            work: '25 schedule states, and balance is reachable as a race' },
          { do: 'Enumerate the schedules of the handover trace.',
            why: 'A fork orders everything before it against everything after.',
            work: '7 schedule states, and no schedule runs the two accesses together' },
          { do: 'Ask the lockset algorithm about both.',
            why: 'It computes the same answer for both, because it asks the same question.',
            work: 'both reported: 0 locks in the intersection either way' },
          { do: 'Ask happens-before about both.',
            why: 'It computes the partial order rather than the locking discipline.',
            work: '1 reported — balance — and config and result not' },
          { do: 'Read the events the fork sits between.',
            why: 'This is the edge the lockset has no representation for.',
            work: 'event 0 writes config, event 1 forks, event 2 reads config' }
        ],
        answer: 'The two traces are indistinguishable to a lockset and completely different to '
          + 'a schedule enumerator: one has a location two threads can touch at once, and the '
          + 'other has a location whose accesses are separated by a fork. That is why a '
          + 'violated locking discipline is not the same thing as a race, and why a report from '
          + 'a lockset tool on a field written once during construction is almost certainly '
          + 'noise. It is also why the false positives cluster where they do — initialisation, '
          + 'read-only data, and ownership handed between threads are exactly the patterns that '
          + 'synchronise without locking.'
      }
    ],

    'coverage-guided-fuzzing': [
      {
        title: 'The same loop, the same target, and one more oracle',
        goal: 'Measure what an oracle is worth.',
        setup: 'A bracket matcher that counts depth instead of keeping a stack. It has two '
          + 'planted defects: it accepts `[)` without complaining, and it throws at a nesting '
          + 'depth of seven. The fuzzer runs 1 200 mutations from the seeds `()` and `[]`.',
        steps: [
          { do: 'Run with a crash oracle alone.',
            why: 'This is what a fuzzer with no assertions can see.',
            work: '1 202 executions, 1 finding: the crash at depth seven' },
          { do: 'Add a differential reference — a stack-based matcher — and re-run.',
            why: 'The same executions, judged by something that knows the right answer.',
            work: '2 findings; the extra one is `[)`' },
          { do: 'Shrink both findings.',
            why: 'A minimal input is a bug report; a random one is a puzzle.',
            work: 'the crash goes from 9 bytes to 7; `[)` is already 2 and cannot shrink' },
          { do: 'Read the hit counts.',
            why: 'Deduplication is what makes a finding count mean anything.',
            work: '71 inputs reached the wrong answer and 69 reached the crash' },
          { do: 'Read the corpus and the coverage.',
            why: 'Almost everything the loop runs is discarded, and that is the loop working.',
            work: '10 inputs kept of 1 202 run, covering 16 distinct behaviours' }
        ],
        answer: 'One extra oracle doubles the findings and the extra one is the interesting '
          + 'kind: two characters, no exception, and a wrong answer. That is the shape of most '
          + 'defects, which is why the first thing to do with a fuzzing setup is not to make it '
          + 'faster but to give it something to check beyond "did it throw". The cheapest '
          + 'oracles are usually already in the codebase — a round-trip property, a slow '
          + 'reference implementation, an assertion somebody disabled in production — and each '
          + 'of them turns a crash finder into a bug finder.'
      },
      {
        title: 'What the loop found in the front end, and what minimisation is for',
        goal: 'Run the same fuzzer against real code and read both results.',
        setup: 'The Berugo front end — lex, parse, resolve, typecheck, desugar — whose contract '
          + 'is to REPORT errors rather than raise them. Coverage is the stages reached, the '
          + 'diagnostics raised, the token kinds and the AST node kinds. 1 200 mutations from '
          + 'two valid seeds.',
        steps: [
          { do: 'Run the loop and read the coverage.',
            why: 'A behavioural fingerprint is the coverage signal here.',
            work: '1 202 executions, 60 distinct behaviours, 24 inputs kept' },
          { do: 'Read the findings from the first run of this loop, before the fixes.',
            why: 'The reason the section exists.',
            work: '2 crashes, on inputs of 4 and 12 characters' },
          { do: 'Look at where they were.',
            why: 'It says something about which code a fuzzer reaches.',
            work: 'both in the AST printer, on the diagnostics path, on 2 kinds of incomplete node' },
          { do: 'Minimise the corpus.',
            why: 'A corpus grows monotonically and most of it becomes redundant.',
            work: '24 inputs down to 22, and 473 bytes down to 423' },
          { do: 'Compare the coverage before and after minimising.',
            why: 'This is the number that must not move.',
            work: '60 edges before, 60 after' }
        ],
        answer: 'Both defects were in the code that formats a tree for an error message, and '
          + 'neither would ever be reached by a valid program — which is exactly what a fuzzer '
          + 'is for, because almost every mutated input is invalid and the error path is the '
          + 'code with the least test coverage and the most hostile input in production. The '
          + 'minimisation result is the other lesson: a smaller corpus is only useful if it '
          + 'covers the same ground, so the assertion to write is on the coverage rather than '
          + 'on the size. A minimisation that quietly loses an edge has lost a test, and the '
          + 'next campaign starts from a worse position with no indication that anything '
          + 'happened.'
      }
    ],

    'specifying-systems': [
      {
        title: 'One action away from the bug two-phase commit is famous for',
        goal: 'Watch a clean model become a broken one by modelling a failure.',
        setup: 'Two-phase commit as data: 8 boolean variables, 8 actions written as "when these '
          + 'hold, set those", and three invariants written as implications. The variant '
          + 'without failures drops the three actions that model a coordinator crash.',
        steps: [
          { do: 'Check the variant with no failure modelled.',
            why: 'This is what a first model usually looks like.',
            work: '10 reachable states, 14 transitions, every invariant holds' },
          { do: 'Add the crash and re-check.',
            why: 'One action: the coordinator may fail after collecting votes.',
            work: '19 reachable states of the 256 the variables allow, 36 transitions' },
          { do: 'Read the counter-example.',
            why: 'It arrives naming actions rather than bit patterns.',
            work: '4 steps: prepare, participant 1 votes, the coordinator fails, participant 1 is blocked' },
          { do: 'Read which invariant broke.',
            why: 'An invariant written as an implication names the situation it is about.',
            work: '"no participant is stuck", after the state where stuck1 became true' },
          { do: 'Replay the trace against the specification.',
            why: 'A trace nobody replays is a story.',
            work: '4 guards re-checked, and the final state really breaks the invariant' }
        ],
        answer: 'The difference between a spotless model and the blocking scenario is one '
          + 'action, and that is the whole lesson: a model is exactly as informative as the '
          + 'failures somebody thought to write down. The scenario itself is not a bug in the '
          + 'protocol — once a participant has voted it may not decide alone, so a coordinator '
          + 'that dies leaves it holding locks — and it is the reason three-phase commit and '
          + 'consensus exist. What the exercise buys is that a room full of engineers can see '
          + 'it in four steps, in the protocol\'s own vocabulary, before any code exists.'
      },
      {
        title: 'Idempotence, stated as a property rather than as advice',
        goal: 'Specify a retry and let the checker find the duplicate.',
        setup: 'A client sends a request, the network may lose it, the server applies it, the '
          + 'client retries. Six boolean variables, five actions, and one invariant: no request '
          + 'is applied twice. The keyed variant replaces one action — the server that sees a '
          + 'key it has already handled does nothing.',
        steps: [
          { do: 'Check the protocol with no idempotence key.',
            why: 'The specification most engineers actually need.',
            work: '8 reachable states of 64, and a violation' },
          { do: 'Read the trace.',
            why: 'Five steps, each an action somebody would recognise.',
            work: '5 actions: send, lose, apply, retry, apply again' },
          { do: 'Swap in the keyed variant.',
            why: 'The only difference is what the server does when it recognises the request.',
            work: 'the same 8 reachable states, and every invariant holds' },
          { do: 'Compare the two state spaces.',
            why: 'The fix is not about size; it is about which transitions exist.',
            work: '8 transitions in each, and one of them goes somewhere different' },
          { do: 'Read the invariant that was checked.',
            why: 'It is the whole specification of idempotence.',
            work: 'when twice, require not twice — 1 line' }
        ],
        answer: 'Idempotence is usually taught as advice and it is a property: "no request is '
          + 'applied twice", checkable at every reachable state. Writing it down turns a '
          + 'discussion about retries into a five-step trace, and the fix into a single action '
          + 'that either exists or does not. Note how small the state spaces are — 8 states, 8 '
          + 'transitions, milliseconds to check — because that is the honest cost picture: the '
          + 'expensive part of specification is the thinking, and the checking is free.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
