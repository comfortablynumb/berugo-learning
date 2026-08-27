/** Reference entries for scheduling, WebAssembly and the JIT (M30.5-M30.7). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'machine-scheduling': {
      summary: 'A dependence DAG with true, memory and effect edges, list scheduling by ' +
        'critical-path priority, an in-order pipeline model that reports stalls, and register ' +
        'pressure measured beside the cycle count so the trade is visible.',
      intuition: 'Results arrive late, so the schedule tries to put independent work in the ' +
        'gap — and every instruction it moves earlier keeps its result alive for longer, which ' +
        'is the bill the register allocator pays.',
      formulation: {
        equations: [
          {
            label: 'Three loads feeding one sum',
            expr: 'order · cycles · stalls · peak pressure',
            terms: [
              { sym: 'source order', meaning: '34 · 16 · 2' },
              { sym: 'list scheduled', meaning: '32 · 14 · 3' },
              { sym: 'instructions', meaning: '18 either way — scheduling reorders' },
              { sym: 'dependence edges', meaning: '28, and 0 violated' }
            ]
          },
          {
            label: 'The same block at rising load latency',
            expr: 'latency · cycles · stalls · cycles saved',
            terms: [
              { sym: '1', meaning: '23 · 5 · 2' },
              { sym: '4', meaning: '32 · 14 · 2' },
              { sym: '8', meaning: '44 · 26 · 2' },
              { sym: '16', meaning: '68 · 50 · 2 — the saving never grows' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every dependence edge points forwards in the new order',
          why: 'A reordering that violates one reads a value before it is computed, which is whatever was in the register.',
          breaks: 'The legality check walks every edge and the violation count is reported per block.'
        },
        {
          name: 'A load does not move above a store, and nothing crosses a call',
          why: 'Proving otherwise needs alias analysis, which this pass does not consult, and a call may do anything.',
          breaks: 'Memory and effect edges are added to the DAG explicitly, so the constraint is data rather than an assumption in the algorithm.'
        },
        {
          name: 'Peak register pressure is reported beside the cycle count',
          why: 'A schedule that removes stalls by raising the peak past the register count has bought them with spills.',
          breaks: 'Both orders report a peak, and the difference is the cost the next pass will pay.'
        }
      ],
      complexity: [
        { operation: 'building the DAG', average: 'O(instructions squared) for the ordering edges', worst: 'O(instructions × uses) for the true edges' },
        { operation: 'critical paths', average: 'O(nodes + edges) in one reverse pass', worst: 'same' },
        { operation: 'list scheduling', average: 'O(nodes squared) with a linear ready-list scan', worst: 'O(nodes log nodes) with a priority queue' },
        { operation: 'the pipeline model', average: 'O(nodes) — one issue per instruction', worst: 'in-order, one issue per cycle, by construction' }
      ],
      failureModes: [
        {
          symptom: 'The scheduled code is faster in the model and slower on the machine.',
          cause: 'The higher peak pressure caused spills the model does not simulate.',
          fix: 'Report pressure with cycles and schedule again after allocation, on the spill code.'
        },
        {
          symptom: 'A reordering produces a wrong answer only sometimes.',
          cause: 'A dependence edge was missing, so a load moved above a store it aliased.',
          fix: 'Add memory and effect edges conservatively; removing them needs alias information, not optimism.'
        },
        {
          symptom: 'The schedule is legal and no better than source order.',
          cause: 'The ready-list priority is arbitrary, so the critical path is not being followed.',
          fix: 'Prioritise by latency-weighted height and compare against the source order as a control.'
        },
        {
          symptom: 'A faster memory makes the pass look ineffective.',
          cause: 'The saving is bounded by the independent work in the block, not by the latency.',
          fix: 'Report the saving across a latency sweep; a constant saving is the honest finding.'
        }
      ],
      inTheWild: [
        'Every optimising compiler for an in-order machine, where scheduling is the difference between fast and unusable.',
        'GCC and LLVM, which both schedule before and after register allocation for exactly the reason this section measures.',
        'Itanium and the VLIW family, where the compiler schedule IS the execution order and there is no hardware to rescue it.',
        'Profile-guided block layout, which is this idea at a larger grain and needs the profile a JIT collects.'
      ],
      sources: [
        { title: 'Cooper and Torczon — Engineering a Compiler', note: 'list scheduling and the pressure interaction' },
        { title: 'Muchnick — Advanced Compiler Design and Implementation', note: 'the dependence DAG and edge kinds' },
        { title: 'Goodman and Hsu — Code scheduling and register allocation in large basic blocks', note: 'the fight between the two passes, measured' },
        { title: 'Hennessy and Patterson — Computer Architecture', note: 'where the latencies come from, and M35\'s pipeline' }
      ]
    },

    'targeting-webassembly': {
      summary: 'A real module builder producing bytes the host validates and runs, a ' +
        'stackifier that turns a control-flow graph back into structured control flow, and a ' +
        'numeric subset stated per program rather than hidden.',
      intuition: 'wasm has no jumps, so the compiler has to undo the graph every earlier phase ' +
        'built — and it has no dynamic values, so a dynamically typed language reaches it ' +
        'either through a heap or through a subset.',
      formulation: {
        equations: [
          {
            label: 'The loop fixture, compiled',
            expr: 'section · bytes',
            terms: [
              { sym: 'type', meaning: '5' },
              { sym: 'function', meaning: '2' },
              { sym: 'global', meaning: '25' },
              { sym: 'export · code · total', meaning: '18 · 168 · 237' }
            ]
          },
          {
            label: 'The conformance suite',
            expr: 'measure · value',
            terms: [
              { sym: 'in the numeric subset', meaning: '8 of 17' },
              { sym: 'validating in the host', meaning: '8 of 8' },
              { sym: 'agreeing with the interpreter', meaning: '8 of 8' },
              { sym: 'total module size', meaning: '1 177 bytes' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The module validates in the host, not in this compiler',
          why: 'A self-checked module proves that the compiler and its own checker agree, which is not the claim being made.',
          breaks: 'Validation goes through the host WebAssembly implementation and is a reported column.'
        },
        {
          name: 'An irreducible graph is refused rather than approximated',
          why: 'There is no structured form for it, so anything emitted would be a different program or an invalid module.',
          breaks: 'Reducibility is checked before emission and reported as a reason the program is outside the subset.'
        },
        {
          name: 'Every excluded program carries the reason it is excluded',
          why: 'A back end that silently skips what it cannot handle shows a perfect agreement column that means nothing.',
          breaks: 'The suite reports the first reason per program, per instruction or per binding.'
        },
        {
          name: 'A division traps where the language faults',
          why: 'wasm produces an infinity and Berugo faults, so an unguarded division is a silent disagreement.',
          breaks: 'The divisor is compared against zero and the module traps, at the cost of five instructions per division.'
        }
      ],
      complexity: [
        { operation: 'the stackifier', average: 'O(blocks + edges) given the dominator tree', worst: 'plus the cost of dominance from M29.3' },
        { operation: 'emitting a function', average: 'O(instructions)', worst: 'one pass, with branches resolved by context depth' },
        { operation: 'encoding an integer', average: 'O(bytes) — LEB128, one byte per seven bits', worst: 'five bytes for a 32-bit value' },
        { operation: 'the subset check', average: 'O(instructions) plus a whole-program type fixpoint', worst: 'bounded at 8 rounds' }
      ],
      failureModes: [
        {
          symptom: 'The module fails validation with an unhelpful offset.',
          cause: 'A section length, a vector count or a local declaration disagrees with what follows it.',
          fix: 'Build each section as a length-prefixed byte list rather than writing into a buffer with a cursor.'
        },
        {
          symptom: 'A branch goes to the wrong place.',
          cause: 'A `br` depth counts enclosing constructs, and an `if` is one of them.',
          fix: 'Push a context entry for the `if` as well as for blocks and loops; the bug is silent and produces a different program.'
        },
        {
          symptom: 'A Bool comes back as 1.',
          cause: 'Every value in the module is an f64 and the declared type was not carried across.',
          fix: 'Record the type per observable and print accordingly; a binding with no single type is outside the subset.'
        },
        {
          symptom: 'A program with `goto` cannot be compiled at all.',
          cause: 'Its graph is irreducible and wasm has no unstructured branch.',
          fix: 'Duplicate blocks until it is reducible, or emit a dispatch loop, and know that both are expensive.'
        }
      ],
      inTheWild: [
        'Emscripten and Binaryen, whose relooper and its successors are the production version of this problem.',
        'Rust and Clang targeting wasm, where LLVM has to restructure control flow before emission.',
        'The WebAssembly specification\'s own validation rules, which are a typed abstract interpretation of the stack.',
        'Any language with `goto` targeting wasm, which is where node splitting stops being a footnote.'
      ],
      sources: [
        { title: 'Haas et al. — Bringing the web up to speed with WebAssembly (2017)', note: 'the design, and why control flow is structured' },
        { title: 'Ramsey — Beyond Relooper: recursive translation of unstructured control flow', note: 'the algorithm this stackifier implements' },
        { title: 'Zakai — Emscripten and the relooper algorithm', note: 'the first widely used answer to the same problem' },
        { title: 'The WebAssembly Core Specification', note: 'the binary format, section by section' }
      ]
    },

    'jit-compilation': {
      summary: 'Three tiers with hotness counters and on-stack replacement, a profile that ' +
        'justifies guarded fast paths, deoptimisation that returns to the interpreter at the ' +
        'same instruction, and a differential run against a never-compiled execution.',
      intuition: 'Compiling costs time the program is not running, so compile only what is hot; ' +
        'speculate on what the profile saw, and make the speculation safe by keeping a way back.',
      formulation: {
        equations: [
          {
            label: 'A hot loop at the top level',
            expr: 'measure · value',
            terms: [
              { sym: 'compilations', meaning: '2, both entered at a loop back edge' },
              { sym: 'guarded fast paths', meaning: '4' },
              { sym: 'profiled sites', meaning: '4, all monomorphic on numbers' },
              { sym: 'agreement with a never-compiled run', meaning: 'value, output, outcome and every binding' }
            ]
          },
          {
            label: 'The baseline threshold, swept',
            expr: 'threshold · compilations · share of the run compiled',
            terms: [
              { sym: '5', meaning: '2 · 96.2 per cent' },
              { sym: '20', meaning: '2 · 84.9 per cent' },
              { sym: '100', meaning: '2 · 25.0 per cent' },
              { sym: '200', meaning: '0 · 0 per cent — nothing got warm in time' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A guard is checked before the instruction changes anything',
          why: 'Deoptimisation rewinds the program counter, so the instruction it resumes must not have started.',
          breaks: 'The fast paths read their operands, check, and only then consume — a deopt resumes an untouched frame.'
        },
        {
          name: 'The compiled result equals the interpreted result',
          why: 'Speculation is the one place the compiler assumes something it has not proved.',
          breaks: 'Every run is compared against the same program with every tier disabled, and the deopt count is reported beside it.'
        },
        {
          name: 'A function that deoptimises repeatedly stops being speculated on',
          why: 'Otherwise a genuinely polymorphic function recompiles and falls back on every pass, and the program gets slower as it runs.',
          breaks: 'After two deoptimisations the function is compiled without guards.'
        }
      ],
      complexity: [
        { operation: 'baseline compilation', average: 'O(instructions) — one closure per instruction', worst: 'paid once per function that gets warm' },
        { operation: 'optimising compilation', average: 'O(instructions) plus one guard per speculated site', worst: 'paid again after every deoptimisation' },
        { operation: 'profiling', average: 'O(1) per observed instruction', worst: 'a set insertion per operand' },
        { operation: 'deoptimisation', average: 'O(1) — rewind the counter and drop the code', worst: 'on a real machine, rebuilding an interpreter frame from a compiled one' }
      ],
      failureModes: [
        {
          symptom: 'A benchmark of a JIT-compiled language reports a number nobody can reproduce.',
          cause: 'The workload changed shape partway through, so it measured the deopt path.',
          fix: 'Report warm-up and steady state separately, and the deoptimisation count with both.'
        },
        {
          symptom: 'A program gets slower the longer it runs.',
          cause: 'A polymorphic function is recompiling and deoptimising on every pass through a loop.',
          fix: 'Stop speculating on a function after a small number of deoptimisations.'
        },
        {
          symptom: 'A deopt produces a wrong answer once in a thousand runs.',
          cause: 'The guard was checked after the instruction had consumed its operands.',
          fix: 'Check first, consume second; the ordering is the whole correctness argument.'
        },
        {
          symptom: 'The hottest loop in the program is never compiled.',
          cause: 'The function containing it is entered once, so an entry counter never crosses.',
          fix: 'Count loop back edges too, and transfer the running frame — which is on-stack replacement.'
        }
      ],
      inTheWild: [
        'HotSpot, whose C1 and C2 tiers and deoptimisation machinery are the canonical implementation.',
        'V8, whose Ignition interpreter, Sparkplug baseline and TurboFan optimiser are three tiers with the same structure.',
        'PyPy and LuaJIT, which trace rather than compile whole methods and need the same guards and the same way back.',
        'CPython 3.11 onwards, whose adaptive specialising interpreter is speculation with guards and no compiler at all.'
      ],
      sources: [
        { title: 'Hölzle, Chambers, Ungar — Debugging optimized code with dynamic deoptimization', note: 'the mechanism, and the metadata it needs' },
        { title: 'Hölzle and Ungar — Reconciling responsiveness with performance in pure OO languages', note: 'tiering and when to compile' },
        { title: 'Fink and Qian — Design, implementation and evaluation of adaptive recompilation with on-stack replacement', note: 'OSR, and why a counter on entry is not enough' },
        { title: 'Aycock — A brief history of just-in-time', note: 'where the ideas came from and how often they were reinvented' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
