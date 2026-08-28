/** Reference entries for copying, incremental and modern collectors (M31.4-M31.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'generational-collection': {
      summary: 'Cheney\'s copying collector with the survivors-not-heap cost model measured ' +
        'across four heap sizes, the generational hypothesis measured on the trace rather than ' +
        'quoted, promotion and nursery sizing swept, and three write barriers compared with the ' +
        'barrier-free variant demonstrably losing live objects.',
      intuition: 'Copying costs time proportional to what survives, so a nursery full of dead ' +
        'objects is nearly free to collect — and the write barrier is the price of being ' +
        'allowed to ignore the old generation while doing it.',
      formulation: {
        equations: [
          {
            label: 'Work per collection against heap size, one fixed workload',
            expr: 'heap · mark-sweep · copying',
            terms: [
              { sym: '4 096', meaning: '218.0 · 162.2' },
              { sym: '8 192', meaning: '367.3 · 163.7' },
              { sym: '16 384', meaning: '669.0 · 165.0' },
              { sym: '32 768', meaning: '1 270.0 · 178.0' }
            ]
          },
          {
            label: 'Three barriers on one trace, 262 pointer stores',
            expr: 'barrier · store cost · objects scanned · table bytes · live objects freed',
            terms: [
              { sym: 'none', meaning: '0 · 0 · 0 · 208' },
              { sym: 'remembered set', meaning: '786 · 349 · 1 880 · 0' },
              { sym: 'card table (128 B)', meaning: '262 · 655 · 332 · 0' },
              { sym: 'measured survival', meaning: '17.2 per cent, mean over 8 windows' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A root outside the collected generation is scanned but never copied',
          why: 'An old object is not collected by a minor collection; its references into the nursery still have to be followed.',
          breaks: 'Getting this wrong freed 16 live objects with every barrier setting producing the identical failure.'
        },
        {
          name: 'Every old-to-young pointer is in the remembered record at collection time',
          why: 'It is a root the collector would otherwise never look at.',
          breaks: 'A pointer gets there by a store (the barrier), by still crossing after a collection (the re-record), or by promotion.'
        },
        {
          name: 'A barrier record survives a collection if the pointer still crosses',
          why: 'No further store will re-record an entry whose young referent merely survived.',
          breaks: 'The record is rebuilt from the objects the collection already scanned and the ones it promoted, so it costs no extra scan.'
        }
      ],
      complexity: [
        { operation: 'allocation', average: 'a pointer bump', worst: 'the same; free space is one run' },
        { operation: 'a minor collection', average: 'proportional to the nursery survivors', worst: 'plus the remembered roots scanned' },
        { operation: 'a major collection', average: 'proportional to the whole live set', worst: 'the same, and it is the p99' },
        { operation: 'a pointer store', average: 'the barrier fast path — a comparison', worst: 'a set insertion or a card write' }
      ],
      failureModes: [
        {
          symptom: 'A generational collector frees objects the program is still using.',
          cause: 'A missing or cleared write barrier record for an old-to-young pointer.',
          fix: 'Check the reclaimed set against reachability at every collection; the barrier-free variant here loses 208.'
        },
        {
          symptom: 'Nursery collections are frequent and expensive at the same time.',
          cause: 'A high survival rate — the hypothesis does not hold for this workload.',
          fix: 'Measure the survival rate before tuning the nursery; at 60 per cent the design is the worst one available.'
        },
        {
          symptom: 'Shrinking the nursery makes total GC work go up.',
          cause: 'It changed the promotion rate as well as the collection frequency, and the two move cost in opposite directions.',
          fix: 'Sweep it rather than reasoning about it; the curve here is not monotone.'
        },
        {
          symptom: 'The p99 pause is unchanged after moving to a generational collector.',
          cause: 'The p99 is the full collection, which the generational design has not removed.',
          fix: 'Expect it, and look at 31.5 or 31.6 if the tail is what the budget is written against.'
        }
      ],
      inTheWild: [
        'HotSpot\'s young generation with its card table, which is where most engineers meet this.',
        'V8\'s Orinoco scavenger, which is a parallel semi-space copy of the nursery.',
        '.NET\'s three generations, with the card table exposed in its ETW events.',
        'Every "eden / survivor / tenured" diagram, which is this section with three spaces instead of two.'
      ],
      sources: [
        { title: 'Cheney — A nonrecursive list compacting algorithm', note: 'the copying collector, in two pages' },
        { title: 'Ungar — Generation scavenging: a non-disruptive high performance storage reclamation algorithm', note: 'the generational hypothesis and the remembered set' },
        { title: 'Lieberman and Hewitt — A real-time garbage collector based on the lifetimes of objects', note: 'generations, first' },
        { title: 'Hölzle — A fast write barrier for generational garbage collectors', note: 'the card table and its cost model' }
      ]
    },

    'incremental-collection': {
      summary: 'The black-to-white pointer built by hand and then searched for over 10 000 ' +
        'randomised interleavings of mutation and marking, two barriers that prevent it with ' +
        'their floating garbage measured, allocate-black stated as the third rule, and the ' +
        'slice size shown to bound the median pause and not the tail.',
      intuition: 'There is exactly one garbage-collection correctness bug — a scanned object ' +
        'acquiring a reference the marker will never follow — and every barrier design is a ' +
        'different way of preventing that one shape.',
      formulation: {
        equations: [
          {
            label: '2 000 randomised interleavings, checked against a liveness oracle',
            expr: 'barrier · runs losing a live object · objects lost · dead objects left',
            terms: [
              { sym: 'none', meaning: '15 · 20 · 636' },
              { sym: 'incremental update (Dijkstra)', meaning: '0 · 0 · 650' },
              { sym: 'snapshot at the beginning (Yuasa)', meaning: '0 · 0 · 1 521' },
              { sym: 'SATB against Dijkstra', meaning: '2.34 times the floating garbage' }
            ]
          },
          {
            label: 'The slice bounds the median, not the tail',
            expr: 'slice · collections · p50 · p99 · total GC work',
            terms: [
              { sym: '1', meaning: '504 · 1 · 76 · 1 188' },
              { sym: '8', meaning: '82 · 8 · 100 · 1 227' },
              { sym: '64', meaning: '20 · 64 · 121 · 1 209' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'No black object points at a white one',
          why: 'A black object will not be rescanned, so a white child of one is never reached.',
          breaks: 'Dijkstra\'s barrier shades the new target; Yuasa\'s achieves the same end by preserving the starting snapshot instead.'
        },
        {
          name: 'Objects allocated during a cycle are not white',
          why: 'They were not reachable when the roots were scanned, so a finishing mark would sweep them.',
          breaks: 'Allocate-black, which costs nothing because the colour is set as the header is written.'
        },
        {
          name: 'The mutator can only publish references it already holds',
          why: 'It is the precondition SATB\'s correctness rests on, and allocation is the single exception.',
          breaks: 'The stress harness draws both ends of every store from the currently reachable set; drawing from the whole heap failed SATB on 329 of 2 000 runs with stores no program could make.'
        }
      ],
      complexity: [
        { operation: 'one marking slice', average: 'the slice size, by construction', worst: 'the same — this is what bounded means' },
        { operation: 'a pointer store while marking', average: 'a colour check', worst: 'plus shading one object grey' },
        { operation: 'the sweep at the end of a cycle', average: 'proportional to the heap', worst: 'the same, and it is the p99' },
        { operation: 'floating garbage', average: 'objects that died during the cycle', worst: 'with SATB, everything reachable when it began' }
      ],
      failureModes: [
        {
          symptom: 'A concurrent collector loses an object once in a few thousand cycles.',
          cause: 'A missing barrier on some store path — the black-to-white pointer.',
          fix: 'Randomised interleaving against a liveness oracle; example-based tests will not contain the shape.'
        },
        {
          symptom: 'Moving to a concurrent collector makes the same heap setting thrash.',
          cause: 'Floating garbage: a concurrent collector needs more headroom above the live set.',
          fix: 'Size the heap for the live set plus a cycle\'s worth of garbage.'
        },
        {
          symptom: 'The median pause improved and the p99 did not.',
          cause: 'Marking was made incremental and the sweep was not.',
          fix: 'Read which phases a collector made concurrent; "concurrent marking" says exactly which half.'
        },
        {
          symptom: 'A stress harness passes for every barrier including none.',
          cause: 'The generated interleavings cannot produce the shape — usually because the ordering is not forced.',
          fix: 'The barrier-free variant must fail the harness, or the harness is measuring nothing.'
        }
      ],
      inTheWild: [
        'G1 and Shenandoah, which both use a snapshot-at-the-beginning barrier.',
        'Go\'s collector, which uses a hybrid Dijkstra/Yuasa barrier and allocates black.',
        'V8\'s incremental marking, with its marking work scheduled against allocation.',
        'Every "concurrent mark, stop-the-world sweep" collector, which is the half-measure the slice sweep exposes.'
      ],
      sources: [
        { title: 'Dijkstra, Lamport, Martin, Scholten, Steffens — On-the-fly garbage collection: an exercise in cooperation', note: 'the incremental-update barrier' },
        { title: 'Yuasa — Real-time garbage collection on general-purpose machines', note: 'snapshot at the beginning' },
        { title: 'Steele — Multiprocessing compactifying garbage collection', note: 'the earliest treatment of the mutator-collector race' },
        { title: 'Pirinen — Barrier techniques for incremental tracing', note: 'the taxonomy the two barriers here sit in' }
      ]
    },

    'modern-collectors': {
      summary: 'Eight designs replayed over one trace with pause percentiles rather than ' +
        'averages, a region heap partitioned and censused, garbage-first ranked against the ' +
        'exact knapsack optimum on real and adversarial region sets, and six published ' +
        'collectors placed by four questions.',
      intuition: '"Garbage first" is literally a scheduling heuristic — collect the regions ' +
        'with the most garbage per unit of copying work — and reading it that way makes the ' +
        'tuning flags legible.',
      formulation: {
        equations: [
          {
            label: 'Eight designs, one trace, an 8 192-byte heap',
            expr: 'design · p50 · p99 · throughput · peak',
            terms: [
              { sym: 'reference counting', meaning: '0 · 0 · 0.570 · 7 336' },
              { sym: 'mark-sweep', meaning: '371 · 382 · 0.667 · 8 192' },
              { sym: 'mark-compact', meaning: '460 · 471 · 0.621 · 8 192' },
              { sym: 'semi-space copying', meaning: '178 · 186 · 0.816 · 8 192' },
              { sym: 'generational copying', meaning: '80 · 184 · 0.571 · 8 224' },
              { sym: 'incremental marking', meaning: '8 · 101 · 0.805 · 8 320' },
              { sym: 'region evacuation', meaning: '189 · 239 · 0.769 · 8 192' }
            ]
          },
          {
            label: 'Greedy against the exact optimum',
            expr: 'region set · policy · reclaimed · optimal · share',
            terms: [
              { sym: 'this heap', meaning: 'garbage-first · 37 760 · 37 776 · 100.0 per cent' },
              { sym: 'this heap', meaning: 'emptiest-first · 37 320 · 37 776 · 98.8 per cent' },
              { sym: 'built to defeat it', meaning: 'garbage-first · 73 · 100 · 73.0 per cent' },
              { sym: 'built to defeat it', meaning: 'emptiest-first · 62 · 100 · 62.0 per cent' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The collection set fits the pause budget by construction',
          why: 'That is what makes the pause a target rather than a consequence.',
          breaks: 'Regions are taken in ranked order while the copying budget lasts, and the budget is the pause.'
        },
        {
          name: 'Every reference into an evacuated region is found and updated',
          why: 'Otherwise a survivor is reachable through a stale pointer into freed space.',
          breaks: 'The per-region remembered set is what makes this possible without scanning the heap.'
        },
        {
          name: 'A ratio against an optimum is only meaningful once the optimum is computed',
          why: 'A heuristic compared against itself always looks good.',
          breaks: 'Both optima here are exact 0-1 knapsack solutions by dynamic programming.'
        }
      ],
      complexity: [
        { operation: 'region selection', average: 'a sort of the regions plus a linear take', worst: 'the same; the exact answer is pseudo-polynomial' },
        { operation: 'evacuation', average: 'proportional to the survivors in the collection set', worst: 'bounded by the pause budget, by construction' },
        { operation: 'a pointer store', average: 'a cross-region check plus a record', worst: 'more often than a generational barrier, because regions are many' },
        { operation: 'a concurrent read', average: 'a load barrier check', worst: 'plus a forwarding read if the object moved' }
      ],
      failureModes: [
        {
          symptom: 'A pause-target flag is set and the collector misses it under load.',
          cause: 'A budget is only a budget while the collector can keep up; behind, it must take more.',
          fix: 'Read the target as a scheduling input rather than a guarantee, and watch the collection-set size.'
        },
        {
          symptom: 'A region collector spends a surprising amount of memory on metadata.',
          cause: 'Per-region remembered sets, which are several per cent of the heap in production.',
          fix: 'Larger regions reduce the count; the trade is coarser selection.'
        },
        {
          symptom: 'A collector with excellent pause numbers has poor throughput.',
          cause: 'It evacuates concurrently, which needs a read barrier, and reads outnumber writes.',
          fix: 'Expect it; it is the stated trade of Shenandoah and ZGC rather than a defect.'
        },
        {
          symptom: 'A benchmark ranks two collectors and the ranking does not survive production.',
          cause: 'One workload, one heap size, and probably one column.',
          fix: 'Every winner here changes when the heap size does; rank on the axis your budget is on.'
        }
      ],
      inTheWild: [
        'G1, whose name is the heuristic and whose flags are its parameters.',
        'Shenandoah and ZGC, which evacuate concurrently behind a load barrier.',
        'ZGC\'s coloured pointers, which put mark and remap state in unused address bits.',
        'Go and CPython, which are on this table as the designs that deliberately do not move objects.'
      ],
      sources: [
        { title: 'Detlefs, Flood, Heller, Printezis — Garbage-first garbage collection', note: 'the region heap and the ranking' },
        { title: 'Flood et al. — Shenandoah: an open-source concurrent compacting garbage collector', note: 'concurrent evacuation and the Brooks pointer' },
        { title: 'Liden and Karlsson — ZGC: a scalable low-latency garbage collector', note: 'coloured pointers and load barriers' },
        { title: 'Hudson and Moss — Incremental collection of mature objects', note: 'the train algorithm, which is where region-at-a-time starts' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
