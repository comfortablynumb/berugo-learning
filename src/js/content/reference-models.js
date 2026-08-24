/** Reference entries for streaming, work and span, and cost models (M21.7-M21.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'streaming-model': {
      summary: 'A 200 000-item stream under an enforced byte budget: the exact distinct-value set ' +
        'killed at item 345, HyperLogLog at four register counts against its own error formula, ' +
        'three quantile sketches scored on RANK, and five questions sorted by whether one pass ' +
        'can answer them at all.',
      intuition: 'One pass and sub-linear space together forbid a great deal, and knowing which ' +
        'side of that line a requirement falls on is what the model is for.',
      formulation: {
        equations: [
          {
            label: 'The two constraints, and the error law that follows',
            expr: 'space o(n), one pass, arbitrary order · HyperLogLog error ≈ 1.04/√m',
            readAs: 'Space growing more slowly than the input, a single pass, no control over the ' +
              'order; and a relative error of about one point oh four over the square root of the ' +
              'register count.',
            terms: [
              { sym: 'why both constraints', meaning: 'one pass with unbounded space is trivial; sub-linear space with two passes is easy' },
              { sym: 'the square-root law', meaning: 'quadruple the registers to halve the error — a sweet spot, not a knob to turn to the end' },
              { sym: 'cash-register vs turnstile', meaning: 'whether the stream can subtract; several sketches silently do not survive deletions' },
              { sym: 'the enforced budget', meaning: 'the demo kills a structure that exceeds it rather than warning' }
            ]
          },
          {
            label: 'Distinct counting, 19 990 true distinct values, budget 8 192 bytes',
            expr: 'structure · bytes · answer · measured error · predicted error',
            terms: [
              { sym: 'exact set', meaning: '8 208 bytes — KILLED at item 345 of 200 000; the full answer would need 479 760' },
              { sym: 'HyperLogLog p=4 and p=8', meaning: '16 bytes, 11.30% against 26.00% · 256 bytes, 8.38% against 6.50%' },
              { sym: 'HyperLogLog p=12', meaning: '4 096 bytes, answers 20 855, 4.33% against 1.63% — the best inside the budget' },
              { sym: 'HyperLogLog p=14', meaning: '16 384 bytes, 0.73% — and killed, like the exact set' }
            ]
          },
          {
            label: 'Quantiles: every number is a RANK, so a perfect answer reads 0.5000/0.9000/0.9900',
            expr: 'structure · bytes · p50 · p90 · p99 · worst rank error',
            terms: [
              { sym: 'reservoir of 1 000', meaning: '8 000 bytes · 0.4982 · 0.8962 · 0.9796 · 1.045%' },
              { sym: 't-digest', meaning: '928 bytes · 0.5001 · 0.8995 · 0.9897 · 0.050%' },
              { sym: 'KLL', meaning: '1 264 bytes · 0.5013 · 0.9023 · 0.9926 · 0.260%' },
              { sym: 'why t-digest wins at the tail', meaning: 'a reservoir is uniform and so equally wrong everywhere; t-digest spends memory near 0 and 1' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The space budget is enforced, not asserted',
          why: 'Almost every treatment says the exact structure does not fit and then runs one to check the sketch.',
          breaks: 'The demo kills the exact set at 8 208 bytes having seen 345 of 200 000 items, so the claim is a measurement.'
        },
        {
          name: 'A quantile answer is reported as a rank',
          why: 'The guarantee is on rank, and the value error depends entirely on the distribution.',
          breaks: 'Reporting values makes a heavy-tailed p99 look wildly wrong when the sketch met its guarantee exactly.'
        },
        {
          name: 'A measured error above the predicted one is explained, not dropped',
          why: 'It is either a bug, a missing correction or a real limit, and only one of those is acceptable.',
          breaks: 'The demo’s p=8 row measures 8.38% against 6.50% and names the uncorrected bias band as the reason.'
        }
      ],
      complexity: [
        { operation: 'exact distinct set', average: 'O(distinct) space — 479 760 bytes here', worst: 'exceeds any sub-linear budget; killed at item 345' },
        { operation: 'HyperLogLog', average: 'O(m) space, O(1) per item; 1.04/√m relative error', worst: 'biased high between roughly 2.5m and 4m distinct values without a correction' },
        { operation: 'reservoir sampling', average: 'O(k) space, one draw per item; uniform accuracy', worst: '1.045% worst rank error at 8 000 bytes — poor at the tails by construction' },
        { operation: 't-digest', average: 'O(compression) space; 0.050% worst rank error at 928 bytes', worst: 'no worst-case rank bound; the guarantee is empirical' },
        { operation: 'KLL', average: 'O((1/ε)·log log(1/δ)) space; 0.260% at 1 264 bytes', worst: 'a proved ε rank bound, which t-digest does not have' },
        { operation: 'count-min', average: 'O(width × depth) space; over-estimates by at most εN', worst: 'the one-sided error makes exact-singleton questions unanswerable' }
      ],
      failureModes: [
        {
          symptom: 'A distinct-count dashboard drifts from the warehouse number.',
          cause: 'It is a sketch with a stated relative error, and nobody wrote the error next to the number.',
          fix: 'Publish the configured error beside the metric. At 4 096 bytes it is about 4%, and that is the product decision.'
        },
        {
          symptom: 'A p99 latency number is wildly wrong while the sketch reports meeting its guarantee.',
          cause: 'The guarantee bounds RANK; on a heavy tail a 1% rank error is a large value error.',
          fix: 'Use a tail-focused sketch, and validate against retained raw data for one window rather than trusting the rank bound to mean a value bound.'
        },
        {
          symptom: 'A sketch produces nonsense after a backfill or a correction.',
          cause: 'The stream became a turnstile stream — it now subtracts — and the structure does not support deletions.',
          fix: 'Ask which model applies before choosing. HyperLogLog cannot remove at all; rebuild the window instead.'
        },
        {
          symptom: 'A requirement to find keys seen exactly once cannot be met.',
          cause: 'It is not hard, it is impossible in one pass in sub-linear space — an over-counting sketch cannot certify a count of one.',
          fix: 'Negotiate the requirement: retain the data, take a second pass, or ask a different question.'
        }
      ],
      inTheWild: [
        'Redis PFCOUNT and the HyperLogLog implementations in Presto, Druid and BigQuery.',
        'Latency dashboards built on t-digest or DDSketch, whose numbers are ranks rather than values.',
        'Network telemetry using count-min sketches for heavy hitters at line rate.',
        'Anything with a "approximate" toggle in a query engine — that toggle chooses this model.'
      ],
      sources: [
        { title: 'Muthukrishnan — Data Streams: Algorithms and Applications', note: 'the survey that defined the area’s shape, cash-register and turnstile included' },
        { title: 'Flajolet, Fusy, Gandouet and Meunier — HyperLogLog (2007)', note: 'the estimator, the 1.04/√m law and the bias band' },
        { title: 'Karnin, Lang and Liberty — Optimal quantile approximation in streams (2016)', note: 'KLL, and the proved rank bound t-digest lacks' },
        { title: 'Cormode and Muthukrishnan — An improved data stream summary: the count-min sketch (2005)', note: 'the one-sided error and what it forbids' }
      ]
    },

    'work-and-span': {
      summary: 'Three prefix-sum algorithms measured for work and span on a recorded dependency ' +
        'graph, greedily scheduled onto eight processor counts against Brent’s bound, and the two ' +
        'scaling laws evaluated on four serial fractions.',
      intuition: 'Work says what a computation costs and span says how fast it can possibly go; ' +
        'both are properties of the algorithm rather than of any machine.',
      formulation: {
        equations: [
          {
            label: 'The two numbers and the three consequences',
            expr: 'parallelism = T₁/T∞ · T_p ≤ T₁/p + T∞ · speed-up ≤ min(p, T₁/T∞)',
            readAs: 'Parallelism is work divided by span; the time on p processors is at most work ' +
              'over p plus the span; and the speed-up never exceeds the smaller of p and the ' +
              'parallelism.',
            terms: [
              { sym: 'T₁, the work', meaning: 'the total operation count — the time on one processor' },
              { sym: 'T∞, the span', meaning: 'the longest chain of dependent operations — the time on unlimited processors' },
              { sym: 'Brent’s theorem', meaning: 'any GREEDY schedule is within a factor of two of optimal, so scheduling is not where the performance is' },
              { sym: 'the ceiling', meaning: 'past T₁/T∞ processors, the extra ones have nothing to do' }
            ]
          },
          {
            label: 'Three scans over 256 elements',
            expr: 'algorithm · work · span · parallelism · work relative to the loop',
            terms: [
              { sym: 'sequential', meaning: '256 · 256 · 1.0× · 1.00× — span equals work' },
              { sym: 'Blelloch up/down-sweep', meaning: '511 · 17 · 30.1× · 2.00×, against 2n = 512 and 2·log₂ 256 = 16' },
              { sym: 'Hillis–Steele', meaning: '1 793 · 8 · 224.1× · 7.00× — more parallelism, seven times the work' },
              { sym: 'the reading', meaning: 'neither is better in the abstract; the processor count decides' }
            ]
          },
          {
            label: 'A greedy schedule of the Blelloch graph against Brent’s bound',
            expr: 'processors · measured · bound · speed-up · utilisation · time ÷ span',
            terms: [
              { sym: '1 and 2', meaning: '511/528 · 1.00× · 100.0% and 257/273 · 1.99× · 99.4%' },
              { sym: '16', meaning: '39 against 49 · 13.10× · 81.9% · 2.29× the span' },
              { sym: '64', meaning: '19 against 25 · 26.89× · 42.0% · 1.12× the span' },
              { sym: '256', meaning: '17 against 19 · 30.06× · 11.7% · 1.00× — the span, attained exactly' }
            ]
          },
          {
            label: 'Amdahl and Gustafson on the same four serial fractions',
            expr: 'serial fraction · Amdahl ceiling · at 8 · at 1 024 · Gustafson at 1 024',
            terms: [
              { sym: '0.1%', meaning: '1000× · 7.9 · 506.2 · 1023×' },
              { sym: '1.0%', meaning: '100× · 7.5 · 91.2 · 1014×' },
              { sym: '5.0%', meaning: '20× · 5.9 · 19.6 · 973× — 128× the machine for 3.3× the speed' },
              { sym: '20.0%', meaning: '5× · 3.3 · 5.0 · 819× — the same fraction, a different question' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Work and span are quoted together',
          why: 'An algorithm described by one of them alone cannot be compared to anything.',
          breaks: 'Hillis–Steele is 7.5× better than Blelloch on span and 3.5× worse on work; either number alone picks a winner and the pair does not.'
        },
        {
          name: 'The schedule is measured on a recorded graph, not computed from a formula',
          why: 'Brent’s bound is an upper bound, so a measurement above it would be a bug in the scheduler.',
          breaks: 'The demo measures 39 steps at 16 processors against a bound of 49 — the bound is confirmed rather than assumed.'
        },
        {
          name: 'Amdahl and Gustafson are labelled with the question they answer',
          why: 'They give 5.0× and 819× on identical inputs.',
          breaks: 'Quoting one at the other is the standard mistake in capacity arguments, and both numbers are correct.'
        }
      ],
      complexity: [
        { operation: 'sequential scan', average: 'work 256, span 256 at n = 256', worst: 'parallelism 1.0× — processors do nothing for it' },
        { operation: 'Blelloch scan', average: 'work 2n, span 2·log₂ n; measured 511 and 17', worst: 'parallelism 30.1×, and the schedule floors at 17 steps' },
        { operation: 'Hillis–Steele scan', average: 'work n·log₂ n, span log₂ n; measured 1 793 and 8', worst: '7.00× the sequential work — pays for the shorter path' },
        { operation: 'greedy scheduling', average: 'T₁/p + T∞ by Brent; measured below the bound in every row', worst: 'within a factor of two of optimal, whatever the graph' },
        { operation: 'Amdahl scaling', average: '1/(s + (1 − s)/p)', worst: 'capped at 1/s — 5× at a 20% serial fraction, on any machine' },
        { operation: 'Gustafson scaling', average: 's + p·(1 − s)', worst: 'applies only when the problem grows with the machine' }
      ],
      failureModes: [
        {
          symptom: 'Doubling the cores did not halve the runtime.',
          cause: 'The processor count passed the parallelism, so the extra cores had nothing to do.',
          fix: 'Compute work over span first. The demo’s scan takes 17 steps at 256 processors and would take 17 at a million.'
        },
        {
          symptom: 'A profiler shows low CPU utilisation under a parallel load.',
          cause: 'The dependency graph runs out of ready work near the ends — not a scheduling failure.',
          fix: 'Change the algorithm for one with more parallelism, or run more independent problems at once. The demo’s utilisation falls to 11.7% with a perfect scheduler.'
        },
        {
          symptom: 'A parallel rewrite is slower than the sequential version at low core counts.',
          cause: 'It is not work-efficient — Hillis–Steele does 7× the work for a shorter span.',
          fix: 'Match the algorithm to the machine: work-efficient below the parallelism, span-optimal above it.'
        },
        {
          symptom: 'A capacity plan promises linear scaling and delivers a plateau.',
          cause: 'It quoted Gustafson for an Amdahl problem — a fixed dataset does not grow with the fleet.',
          fix: 'Ask whether the work grows when the machine does, and measure the serial fraction before buying anything.'
        }
      ],
      inTheWild: [
        'Cilk, TBB, Rayon and Java’s ForkJoinPool, all of which are work-stealing greedy schedulers with Brent’s guarantee.',
        'GPU scan primitives in CUB and Thrust, which are Blelloch’s scan with a tuned base case.',
        'Spark and Flink stage planning, where the span is the critical path through the DAG.',
        'Capacity arguments about core counts, which are Amdahl calculations whether or not anybody says so.'
      ],
      sources: [
        { title: 'Blelloch — Prefix sums and their applications (1990)', note: 'the up-sweep/down-sweep scan and the case for it as a primitive' },
        { title: 'Brent — The parallel evaluation of general arithmetic expressions (1974)', note: 'the bound, and why greedy suffices' },
        { title: 'Blumofe and Leiserson — Scheduling multithreaded computations by work stealing (1999)', note: 'how a real runtime attains the greedy guarantee' },
        { title: 'Amdahl (1967) and Gustafson (1988)', note: 'the two laws, in the two papers, answering the two different questions' }
      ]
    },

    'choosing-a-cost-model': {
      summary: 'One sort predicted under four cost models in four different units, the DAM ' +
        'prediction checked against its own simulator, four access patterns measured for waste, ' +
        'and a five-question checklist whose order is the point.',
      intuition: 'A cost model is not right or wrong, it is applicable or not — and it is ' +
        'applicable when the thing it counts is the thing that is scarce.',
      formulation: {
        equations: [
          {
            label: 'The same sort of 65 536 records, under four models',
            expr: 'model · what it counts · prediction · when it is the right one',
            terms: [
              { sym: 'RAM', meaning: '1 048 576 comparisons — right when the data fits in cache and one core does the work' },
              { sym: 'cache-aware', meaning: '10 240 misses — right when the data fits in memory and the working set does not fit in cache' },
              { sym: 'external memory', meaning: '4 096 block transfers — right when the data does not fit in memory' },
              { sym: 'parallel', meaning: '256 dependent steps — right when there are more processors than the span can use' }
            ]
          },
          {
            label: 'The one prediction that can be validated',
            expr: 'measured transfers against predicted, under an enforced memory budget',
            terms: [
              { sym: 'the check', meaning: 'sorting 16 384 records costs 1 024 transfers against a prediction of 1 024' },
              { sym: 'why only this one', meaning: 'the other three count things no single runtime measurement can separate' },
              { sym: 'what it licenses', meaning: 'using the closed form at sizes too large to run' },
              { sym: 'the spread', meaning: '4 096× between the largest and smallest prediction, in four different units' }
            ]
          },
          {
            label: 'Four access patterns over one 4 096-element array',
            expr: 'pattern · accesses · misses · miss rate · bytes fetched ÷ bytes used',
            terms: [
              { sym: 'sequential scan', meaning: '4 096 · 512 · 12.5% · 1.0× — the compulsory minimum' },
              { sym: 'stride of 8 doubles (one line)', meaning: '512 · 512 · 100.0% · 8.0×' },
              { sym: 'stride of 64 doubles', meaning: '64 · 64 · 100.0% · 8.0× — the rate saturates and stays' },
              { sym: 'random probe', meaning: '4 096 · 3 604 · 88.0% · 7.0× — 3 of the 4 are memory-bound' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A prediction carries its unit',
          why: 'Comparisons, misses, transfers and steps are counts of different events.',
          breaks: 'Reading the four predictions as competing estimates makes 256 look like the best algorithm and 1 048 576 the worst.'
        },
        {
          name: 'The model is validated against something before it is used',
          why: 'A model nobody has ever compared against anything is a preference rather than a prediction.',
          breaks: 'The DAM row is checked at 1 024 against 1 024; the other three rows say plainly that they cannot be.'
        },
        {
          name: 'The checklist is answered in order',
          why: 'Data placement changes which algorithm to use; parallelism only changes how a chosen one is run.',
          breaks: 'Asking about parallelism first produces a beautifully parallel algorithm bound by block transfers — a real and expensive failure.'
        }
      ],
      complexity: [
        { operation: 'RAM model', average: 'one unit per operation; predicts well inside cache', worst: 'silently wrong by orders of magnitude once the working set spills' },
        { operation: 'cache-aware model', average: 'counts misses; needs the cache size and line size', worst: 'a parameter fitted to one machine, so it travels badly' },
        { operation: 'external-memory model', average: 'counts block transfers with M and B', worst: 'irrelevant while the data fits in memory' },
        { operation: 'parallel (work/span) model', average: 'counts the critical path', worst: 'predicts nothing useful when work rather than depth is the constraint' },
        { operation: 'bytes fetched per byte used', average: 'two hardware counters; 1.0× is compulsory traffic', worst: 'measured 8.0× on a strided walk — a layout problem, not a loop problem' },
        { operation: 'the off-machine case', average: 'count round trips', worst: 'none of the four models applies, which is the commonest real answer' }
      ],
      failureModes: [
        {
          symptom: 'An algorithm with a better complexity is slower in production.',
          cause: 'Its complexity is in a unit that is not the bottleneck — usually operations, when the bottleneck is transfers.',
          fix: 'Say what the unit is before comparing. The demo’s four predictions of the same sort span 4 096×.'
        },
        {
          symptom: 'A loop resists every micro-optimisation.',
          cause: 'Its stride exceeds a cache line, so every access misses and the body is not the cost.',
          fix: 'Measure bytes fetched over bytes used. Above about 2× the fix is layout — structure-of-arrays, or a different traversal.'
        },
        {
          symptom: 'A parallel rewrite delivered no speed-up.',
          cause: 'The work was bound by block transfers, and parallelism was chosen before data placement.',
          fix: 'Walk the checklist in order. The first two questions are about where the data sits.'
        },
        {
          symptom: 'A careful complexity analysis predicts nothing about the service’s latency.',
          cause: 'The time is going into round trips, and every model on the page counts something on the machine.',
          fix: 'Measure time in system calls and network waits against time on the CPU first, and count round trips when it dominates.'
        }
      ],
      inTheWild: [
        'Query planners, which pick a model per operator and cost in pages.',
        'Data-layout work in game engines and numerical kernels, which is the bytes-per-byte metric applied.',
        'Profiler counters — cache misses, IPC, stall cycles — each of which is a model’s unit made measurable.',
        'Any design document comparing two complexities without naming the unit, which is where this section applies most.'
      ],
      sources: [
        { title: 'Aggarwal and Vitter — The input/output complexity of sorting (1988)', note: 'the external-memory model as a deliberate choice of unit' },
        { title: 'Hennessy and Patterson — Computer Architecture: A Quantitative Approach', note: 'the memory hierarchy and the counters that measure it' },
        { title: 'Blelloch and Maggs — Parallel algorithms (survey)', note: 'the work/span model beside the sequential ones' },
        { title: 'Frigo et al. — Cache-oblivious algorithms (1999)', note: 'a model chosen to avoid needing the machine’s parameters at all' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
