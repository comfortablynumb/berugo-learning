/** Reference entries for weak references, avoidance and diagnosis (M31.7-M31.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'weak-references': {
      summary: 'Four reference strengths as one bit of instruction to the tracer, an ' +
        'object-keyed cache built strong and weak over identical entries, a two-cycle ' +
        'finalisation protocol with resurrection and finaliser-reachability modelled, and a ' +
        'handle limit exhausted at iteration 17 with 6.6 per cent of the heap in use.',
      intuition: 'The collector manages memory and nothing else, so a program that runs out of ' +
        'something else while the heap is comfortable will never be rescued — and a reference ' +
        'strength is the one bit that decides whether a map is a cache or a leak.',
      formulation: {
        equations: [
          {
            label: 'One cache, twelve entries, six keys dropped',
            expr: 'strength · entries cleared · objects reclaimed · bytes held',
            terms: [
              { sym: 'strong', meaning: '0 · 0 · 600' },
              { sym: 'soft, no pressure', meaning: '0 · 0 · 600' },
              { sym: 'soft, under pressure', meaning: '6 · 12 · 312' },
              { sym: 'weak', meaning: '6 · 12 · 312' }
            ]
          },
          {
            label: 'The handle loop: 16-byte objects, a 4 KB heap, a 16-handle limit',
            expr: 'release · iterations · peak open · collections · failed at',
            terms: [
              { sym: 'by the finaliser', meaning: '17 · 17 · 0 · iteration 17' },
              { sym: 'explicitly', meaning: '64 · 1 · 0 · never' },
              { sym: 'heap in use when it failed', meaning: '0.27 KB of 4 KB' },
              { sym: 'collections a finalisable object costs', meaning: '2' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Weak references are cleared before finalisers run',
          why: 'Otherwise a finaliser could resurrect an object a weak reference has already been told is gone.',
          breaks: 'The cycle is: strong reachability, clear weak, run queued finalisers, queue the newly unreachable, then free.'
        },
        {
          name: 'A finaliser runs at most once',
          why: 'A resurrection loop would keep an object alive forever and call its cleanup repeatedly.',
          breaks: 'The object is marked finalised at the first call and leaves the queue whether or not it resurrected itself.'
        },
        {
          name: 'Everything reachable from the finalisation queue is kept',
          why: 'A finaliser running against freed objects would be reading freed memory inside a managed runtime.',
          breaks: 'Finaliser-reachability is computed as its own closure, which is why one finaliser retains a subgraph.'
        }
      ],
      complexity: [
        { operation: 'clearing weak references', average: 'proportional to the registered references', worst: 'the same; each is a slot, not an object' },
        { operation: 'a finalisable object', average: 'two collection cycles', worst: 'unbounded, if a finaliser resurrects it' },
        { operation: 'a strong object-keyed cache', average: 'retains every key forever', worst: 'the same; it is working as specified' },
        { operation: 'explicit release', average: 'constant, at the end of the block', worst: 'the same, and deterministic' }
      ],
      failureModes: [
        {
          symptom: 'The process runs out of file descriptors, sockets or connections while memory is fine.',
          cause: 'A scarce non-memory resource released by a finaliser, and no memory pressure to trigger one.',
          fix: 'Release explicitly and lexically; the finaliser is a leak detector, not a mechanism.'
        },
        {
          symptom: 'A cache keyed on objects grows without bound.',
          cause: 'Strong entries: the map is reachable and the map reaches the keys.',
          fix: 'Weak keys, or a bounded cache with an eviction policy — the second gives you control over when.'
        },
        {
          symptom: 'Behaviour differs between the test suite and production for no visible reason.',
          cause: 'A soft reference, whose clearing is a runtime policy that only fires under real memory pressure.',
          fix: 'Never let correctness depend on a soft reference; use it only where recomputation is the fallback.'
        },
        {
          symptom: 'A cleanup runs once and then never again for an object that keeps being used.',
          cause: 'A finaliser resurrected the object, and a finaliser runs at most once.',
          fix: 'Never store `this` from a finaliser; use a cleanup action that cannot reach the object.'
        }
      ],
      inTheWild: [
        'Java\'s deprecation of Object.finalize and the Cleaner API that replaced it.',
        '.NET\'s IDisposable and using, which exist because finalisation was not enough.',
        'JavaScript\'s WeakMap and FinalizationRegistry, whose documentation warns against relying on the latter.',
        'Python\'s __del__, documented with the resurrection and ordering hazards attached.'
      ],
      sources: [
        { title: 'Boehm — Destructors, finalizers, and synchronization', note: 'why finalisers are the wrong tool, argued carefully' },
        { title: 'Jones, Hosking, Moss — The Garbage Collection Handbook', note: 'chapter 12, finalisation and weak references' },
        { title: 'Bloch — Effective Java, "avoid finalizers and cleaners"', note: 'the practitioner\'s version, with the resource case' },
        { title: 'Dybvig, Bruggeman, Eby — Guardians in a generation-based garbage collector', note: 'the safe alternative to finalisation' }
      ]
    },

    'avoiding-the-collector': {
      summary: 'Three programs computing one answer at 84, 3 and 1 allocations with the ' +
        'collector work behind them going to zero, escape analysis from M29 reporting a reason ' +
        'per site rather than a score, allocation attributed to source constructs, and five ' +
        'levers ordered by hazard.',
      intuition: 'The fastest collection is the one that has nothing to collect, so allocation ' +
        'rate is the metric to attack first — and unlike every collector parameter, it is ' +
        'something your code controls.',
      formulation: {
        equations: [
          {
            label: 'One loop over forty values, written three ways',
            expr: 'programme · answer · allocations · bytes · GC work',
            terms: [
              { sym: 'a record per iteration', meaning: '820 · 84 · 2 288 · 70' },
              { sym: 'one record at the end', meaning: '820 · 3 · 360 · 6' },
              { sym: 'no records at all', meaning: '820 · 1 · 328 · 0' },
              { sym: 'at eighty iterations', meaning: '164 · 3 · 1 — only one line has a slope' }
            ]
          },
          {
            label: 'Escape analysis and allocation sites on the heavy programme',
            expr: 'measure · value',
            terms: [
              { sym: 'allocation sites', meaning: '5' },
              { sym: 'never leaving their frame', meaning: '3 — both closures and the array' },
              { sym: 'escaping', meaning: '2, both returned' },
              { sym: 'top site', meaning: 'pair:6 — 41 objects, 984 bytes, 43.0 per cent of the heap' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The answer is identical across every version',
          why: 'An allocation reduction that changes the result is not an optimisation.',
          breaks: 'Every row runs through the IR interpreter and prints the binding it produced.'
        },
        {
          name: 'An allocation escapes if ANY alias of it escapes',
          why: 'A value passed on through three moves is the same value.',
          breaks: 'The analysis tracks the alias family, which is the direction that matters: the unsound answer would stack-allocate a closure that outlives the frame.'
        },
        {
          name: 'A conservative reason is reported as conservative',
          why: '"Returned" is exact and "passed to a call" is a limit of this analysis.',
          breaks: 'Collapsing them into one number gives a score nobody can act on.'
        }
      ],
      complexity: [
        { operation: 'a stack-allocated object', average: 'a frame offset, and nothing at collection time', worst: 'the same' },
        { operation: 'a scalar-replaced object', average: 'nothing at all — it never exists', worst: 'the same' },
        { operation: 'a heap allocation', average: 'a pointer bump plus a header', worst: 'plus its share of every future collection' },
        { operation: 'a pooled object', average: 'an index into a free list', worst: 'plus a write barrier on every store into it' }
      ],
      failureModes: [
        {
          symptom: 'A microbenchmark shows an allocation costing nothing and production disagrees.',
          cause: 'The benchmark let escape analysis or scalar replacement remove it; the real program observes the object.',
          fix: 'Read the analysis rather than the timing, and check whether the value escapes in the real call site.'
        },
        {
          symptom: 'An object pool improves a benchmark and hurts production throughput.',
          cause: 'Every pooled object is old, so every store into one is an old-to-young pointer the write barrier records.',
          fix: 'Measure barrier traffic, not just allocation count; 31.4 shows what the barrier costs.'
        },
        {
          symptom: 'A rewritten hot loop allocates less and returns a different answer.',
          cause: 'The restructuring changed the computation, usually by sharing a mutable accumulator.',
          fix: 'Compare outputs on every path before comparing allocation counts.'
        },
        {
          symptom: 'An arena-based request handler crashes intermittently under load.',
          cause: 'Something outlived the phase — a reference escaped into a cache or a future.',
          fix: 'The arena constraint is checkable at the boundary; check it there rather than trusting it.'
        }
      ],
      inTheWild: [
        'HotSpot\'s escape analysis and scalar replacement, which are on by default and rarely read.',
        'Go\'s escape analysis, which -gcflags=-m prints per allocation with a reason.',
        'Netty\'s pooled byte buffers, and the reference-counting discipline they require.',
        'Java\'s Project Valhalla and C#\'s structs, which are the value-type answer to the header cost.'
      ],
      sources: [
        { title: 'Choi, Gupta, Serrano, Sreedhar, Midkiff — Escape analysis for Java', note: 'the analysis M29 implements' },
        { title: 'Blanchet — Escape analysis for object-oriented languages', note: 'the other line of work, with stack allocation' },
        { title: 'Appel — Garbage collection can be faster than stack allocation', note: 'the case against pooling, made properly' },
        { title: 'Jones, Hosking, Moss — The Garbage Collection Handbook', note: 'allocation rate as the primary lever' }
      ]
    },

    'diagnosing-gc': {
      summary: 'A workload whose retained set grows, sampled after the warm-up and judged by ' +
        'slope rather than inspection, with a GC log read for its trend, the dominator tree ' +
        'over the object graph computed by the M13 pass, a 368-hop retaining path, a snapshot ' +
        'difference by allocation site, and a heap-sizing sweep that changes everything except ' +
        'the leak.',
      intuition: 'The dominator tree on the object graph answers "if I drop this one reference, ' +
        'how much memory comes back", which is the only question a heap dump can usefully ' +
        'answer — because everything in a dump is live by construction.',
      formulation: {
        equations: [
          {
            label: 'Retained bytes over the second half of the run',
            expr: 'workload · first sample · last sample · slope · verdict',
            terms: [
              { sym: 'no leak', meaning: '2 128 · 2 128 · 0.0 · stable' },
              { sym: '15 per cent leak', meaning: '7 120 · 12 432 · 1 040.0 · not stable' },
              { sym: 'promotion rate', meaning: '16 920 bytes of 67 872 allocated — 24.9 per cent' },
              { sym: 'longest retaining path', meaning: '368 hops from a GC root' }
            ]
          },
          {
            label: 'The dominator tree and the snapshot difference',
            expr: 'measure · value',
            terms: [
              { sym: 'top object, own bytes', meaning: '40' },
              { sym: 'top object, retained bytes', meaning: '12 248 of a 12 432-byte dump' },
              { sym: 'top growing site', meaning: '32 objects retaining 920 → 61 retaining 1 880' },
              { sym: 'gain', meaning: '960 bytes between the two snapshots' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Everything in a heap dump is reachable',
          why: 'A collection runs before the snapshot is taken.',
          breaks: 'The snapshots here drop every unreachable object first, which is what a real tool gives you.'
        },
        {
          name: 'The retained size of an object is the size of everything it dominates',
          why: 'That is exactly the memory freed if it becomes unreachable, and nothing less is.',
          breaks: 'Computed with the same dominator pass M13 built for control-flow graphs, over a graph rooted at a synthetic GC-roots node.'
        },
        {
          name: 'The stability verdict is measured after the warm-up',
          why: 'A program filling its caches for the first time is growing, and looks exactly like a leak.',
          breaks: 'The samples are taken over the second half of the run, and the verdict is a slope against the mean rather than two points.'
        }
      ],
      complexity: [
        { operation: 'a heap snapshot', average: 'proportional to the live set', worst: 'plus a full collection first' },
        { operation: 'the dominator tree', average: 'near-linear in the object graph', worst: 'the same; it is the M13 pass' },
        { operation: 'a retaining path', average: 'breadth-first from the roots', worst: 'the graph, and the path can be very long' },
        { operation: 'a snapshot difference', average: 'proportional to the number of allocation sites', worst: 'the same; sites are few even when objects are many' }
      ],
      failureModes: [
        {
          symptom: 'A heap dump is opened and nothing looks wrong.',
          cause: 'It was sorted by shallow size, which always points at the largest class rather than the retainer.',
          fix: 'Sort by retained size and read the retaining path of the top row.'
        },
        {
          symptom: 'Two dumps look the same and the heap is definitely growing.',
          cause: 'They were compared by object count rather than by retained size per allocation site.',
          fix: 'Difference by site; a site that gained retained bytes names a construct in the source.'
        },
        {
          symptom: 'A service is declared to be leaking during its first minutes of life.',
          cause: 'The slope was measured across the warm-up, while caches were still filling.',
          fix: 'Sample after steady state and take a slope, not a difference of two points.'
        },
        {
          symptom: 'Enlarging the heap made the GC log look healthy and the problem came back later.',
          cause: 'Heap size moves every number in a GC log and diagnoses nothing.',
          fix: 'Watch bytes remaining after full collections; that line is unchanged by heap size.'
        }
      ],
      inTheWild: [
        'Eclipse MAT\'s dominator tree and "retained heap" column, which is this analysis.',
        'Chrome DevTools\' heap snapshot, with its retainers pane and its three-snapshot workflow.',
        'JFR and GC logs, where bytes-after-collection is the series worth graphing.',
        'The four leak shapes: unevicted caches, listener lists, thread-locals on pooled threads, and over-capturing closures.'
      ],
      sources: [
        { title: 'Lengauer and Tarjan — A fast algorithm for finding dominators in a flowgraph', note: 'the pass M13 built and this section reuses' },
        { title: 'Mitchell and Sevitsky — LeakBot: an automated and lightweight tool for diagnosing memory leaks', note: 'growth by site, automated' },
        { title: 'Jump and McKinley — Cork: dynamic memory leak detection for garbage-collected languages', note: 'the two-snapshot heap difference' },
        { title: 'Eclipse Memory Analyzer documentation — shallow and retained heap', note: 'the practitioner\'s definition of the two sizes' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
