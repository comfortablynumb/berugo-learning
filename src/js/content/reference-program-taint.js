/** Reference entries for taint analysis and symbolic execution (M32.3-M32.4). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'taint-analysis': {
      summary: 'A taint tracker over six fixtures with the whole propagation path kept, every ' +
        'finding confirmed or refuted by a dynamic taint oracle that runs the same programme, ' +
        'field sensitivity switchable and priced at one false positive, and a policy sweep ' +
        'showing that two of the three ways to misdeclare the model are completely silent.',
      intuition: 'The algorithm is a reachability walk over three declared lists, so every ' +
        'failure of a taint analysis in the field is a missing declaration rather than a ' +
        'missing idea — and the failure that matters is invisible.',
      formulation: {
        equations: [
          {
            label: 'The record fixture: two sink calls, one really tainted',
            expr: 'container precision · findings · confirmed · refuted by the run',
            terms: [
              { sym: 'field-insensitive', meaning: '2 · 1 · 1' },
              { sym: 'field-sensitive', meaning: '1 · 1 · 0' },
              { sym: 'the array fixture, both ways', meaning: '1 · 0 · 1' },
              { sym: 'hops on the confirmed path', meaning: '7 — source, store, read, makeRecord, store, read, loadField' }
            ]
          },
          {
            label: 'The policy sweep on the direct fixture',
            expr: 'change · findings · delta · how you would notice',
            terms: [
              { sym: 'the declared policy', meaning: '1 · 0 · baseline' },
              { sym: 'one source undeclared', meaning: '0 · -1 · not at all' },
              { sym: 'one sanitiser undeclared', meaning: '2 · +1 · a human triages it' },
              { sym: 'one sink undeclared', meaning: '0 · -1 · not at all' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The analysis runs to a fixpoint, not for one pass',
          why: 'A loop can taint a variable after it has already been copied, and a single forward sweep reports nothing.',
          breaks: 'The back-edge fixture needs 2 rounds; with one round its sink is never reported.'
        },
        {
          name: 'An unsummarised callee propagates the taint of its arguments',
          why: 'Assuming otherwise would lose real flows through any function the tool has no model for.',
          breaks: 'The ignores fixture reports a sink fed by a callee that returns a constant — a false positive by design.'
        },
        {
          name: 'A sanitiser is trusted absolutely',
          why: 'The model has no way to check that the cleaner is right for the context the value ends up in.',
          breaks: 'A sanitiser declared for the wrong context makes the tool confidently clean about exploitable code.'
        }
      ],
      complexity: [
        { operation: 'one propagation round', average: 'linear in the instructions', worst: 'the same' },
        { operation: 'rounds to a fixpoint', average: 'one or two on straight-line and simple loops', worst: 'bounded by the lattice height, which here is one bit per location' },
        { operation: 'field-insensitive containers', average: 'one abstract location per allocation', worst: 'the same, and every field of it aliases every other' },
        { operation: 'field-sensitive containers', average: 'one location per field, plus a map per allocation site', worst: 'the same; the cost is memory rather than time' },
        { operation: 'the dynamic taint oracle', average: 'one interpreted run with a bit beside every value', worst: 'the observed path only, which is what makes it an oracle rather than a proof' }
      ],
      failureModes: [
        {
          symptom: 'The tool reports nothing on a codebase you know has injection bugs.',
          cause: 'The entry points are internal — an in-house RPC layer or deserialiser — and are not in the source list.',
          fix: 'Audit the source list against the frameworks in use before believing any clean report.'
        },
        {
          symptom: 'Dozens of findings on code that passes request objects around.',
          cause: 'Field-insensitive containers: one tainted field makes every field of the record tainted.',
          fix: 'Switch on field sensitivity if the tool has it; where it does not, split the object rather than arguing with the report.'
        },
        {
          symptom: 'A finding on a value that a helper function demonstrably discards.',
          cause: 'The conservative rule for unsummarised callees, which assumes the result carries the argument\'s taint.',
          fix: 'Write a summary for the helper; this is the bulk of the tuning work in every deployment.'
        },
        {
          symptom: 'A vulnerability ships through a path the tool marked clean.',
          cause: 'A declared sanitiser that escapes for the wrong context, so the analysis stopped following a value that was still dangerous.',
          fix: 'Review the sanitiser list the way you would review a cryptographic primitive; everything downstream trusts it and nothing downstream checks.'
        }
      ],
      inTheWild: [
        'CodeQL and Semgrep, whose taint rules are exactly source, sink and sanitiser lists written as queries.',
        'The OWASP benchmark suites, which exist because tools disagree so much on the same fixtures.',
        'Android\'s FlowDroid, notable for publishing its source and sink lists as data.',
        'TypeScript\'s control-flow narrowing, the same flow-sensitive machinery carrying nullability instead of taint.'
      ],
      sources: [
        { title: 'Denning — A lattice model of secure information flow', note: 'the origin: taint as a lattice and a dataflow problem' },
        { title: 'Sabelfeld, Myers — Language-based information-flow security', note: 'the survey that frames sources, sinks and declassification' },
        { title: 'Arzt et al. — FlowDroid', note: 'a precise, field-sensitive taint analysis with its trade-offs measured' },
        { title: 'Schwartz, Avgerinos, Brumley — All you ever wanted to know about dynamic taint analysis', note: 'the dynamic side, and why the two answers differ' }
      ]
    },

    'symbolic-execution': {
      summary: 'A path tree with a concrete input at every reachable leaf, each one executed ' +
        'and asserted to visit exactly the blocks its path condition came from, the linear ' +
        'theory solver from 32.6 proving 120 of the 128 leaves of a seven-branch ladder ' +
        'impossible, and a fixture outside the affine fragment whose generated inputs go ' +
        'somewhere else.',
      intuition: 'The path condition describes exactly the inputs that reach a line, so what ' +
        'comes out of a leaf is a test case with a proof of reachability attached — or a ' +
        'report that the branch is dead.',
      formulation: {
        equations: [
          {
            label: 'A ladder of k independent branches over one parameter',
            expr: 'branches · leaves · reachable · proved impossible',
            terms: [
              { sym: '1', meaning: '2 · 2 · 0' },
              { sym: '3', meaning: '8 · 4 · 4' },
              { sym: '5', meaning: '32 · 6 · 26' },
              { sym: '7', meaning: '128 · 8 · 120' }
            ]
          },
          {
            label: 'Three fixtures, with every generated input executed',
            expr: 'fixture · leaves · inputs reaching their path · blocks covered',
            terms: [
              { sym: 'classify — nested branch', meaning: '3 · 3 of 3 · 7 of 7' },
              { sym: 'guard — impossible inner branch', meaning: '3 · 2 of 2 · 6 of 7' },
              { sym: 'scale — a product of two symbols', meaning: '2 · 1 of 2 · 3 of 4' },
              { sym: 'the ladder at 7 branches, 64-path budget', meaning: '64 kept, 1 abandoned · 7 of 7 · 21 of 22' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A generated input must follow the path it was generated for',
          why: 'The whole claim of the technique is reachability; an input that satisfies the condition and goes elsewhere means the condition does not describe the path.',
          breaks: 'Every model is executed by the harness and its visited blocks compared with the leaf\'s.'
        },
        {
          name: 'A bounded search reports unknown, never unsat',
          why: 'Finding no model inside a box is not a proof that none exists, and reporting it as one would invent dead code.',
          breaks: 'unsat is only ever produced by the theory solver, and it comes with the contradiction it derived.'
        },
        {
          name: 'A value outside the affine fragment is marked opaque rather than approximated',
          why: 'Pretending to model a product of two symbols would produce path conditions that are silently wrong.',
          breaks: 'The scale fixture forks with no constraint recorded, and the verification catches the input that then misses its path.'
        },
        {
          name: 'Truncation is reported',
          why: 'Coverage over the paths a search happened to reach is not coverage, and the difference is invisible without the count.',
          breaks: 'The executor reports paths abandoned at the budget beside the paths it kept.'
        }
      ],
      complexity: [
        { operation: 'leaves of the path tree', average: 'up to 2 to the power of the branches', worst: 'unbounded when a loop bound is symbolic' },
        { operation: 'reachable leaves, ordered comparisons on one variable', average: 'one per branch, plus one', worst: 'the same; this is the gap the technique lives in' },
        { operation: 'the bounded model search', average: 'the box size to the power of the symbols', worst: 'the same, which is why it is capped at 4 symbols here' },
        { operation: 'the linear decision procedure', average: 'variable elimination, quadratic per variable in the constraints', worst: 'doubly exponential in the worst case; it gives up past 4 000 constraints' },
        { operation: 'verifying one generated input', average: 'one concrete run of the function', worst: 'cheaper than the solve that produced it' }
      ],
      failureModes: [
        {
          symptom: 'The engine reports high path coverage and finds nothing.',
          cause: 'It covered the paths it could reach inside its budget and reported that as all of them.',
          fix: 'Read the abandoned-path count first; without it, a coverage figure from this kind of tool is unscoped.'
        },
        {
          symptom: 'Analysis never terminates on a function with a loop.',
          cause: 'A symbolic loop bound gives one path per iteration count, so the tree has no end.',
          fix: 'A depth budget, loop summarisation, or concolic execution with a concrete trip count.'
        },
        {
          symptom: 'Generated inputs do not reproduce the behaviour they were meant to.',
          cause: 'Part of the path condition involves values the engine could not model — a hash, a library call, an environment read.',
          fix: 'Concolic execution: keep the concrete value beside the symbol, so an unmodellable value costs one branch rather than the run.'
        },
        {
          symptom: 'The engine reports a branch as unreachable and a test reaches it.',
          cause: 'An unsat answer produced by a bounded search rather than a decision procedure, or a wrong environment model.',
          fix: 'Only ever emit unsat from a procedure that produces the contradiction; treat everything else as unknown.'
        }
      ],
      inTheWild: [
        'KLEE, the LLVM-based engine most published results come from, and its environment-model problem.',
        'Microsoft SAGE, which found a large share of the file-parser bugs in Windows using concolic execution.',
        'Java PathFinder and angr, for bytecode and binaries respectively.',
        'The DART and CUTE papers, which introduced concolic execution precisely because pure symbolic execution kept getting stuck.'
      ],
      sources: [
        { title: 'King — Symbolic execution and program testing (1976)', note: 'the original statement of the technique' },
        { title: 'Cadar, Dunbar, Engler — KLEE', note: 'the practical engine, with the search heuristics that make it work' },
        { title: 'Godefroid, Klarlund, Sen — DART: directed automated random testing', note: 'concolic execution and why it was needed' },
        { title: 'Baldoni et al. — A survey of symbolic execution techniques', note: 'the modern map, including merging and state explosion mitigations' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
