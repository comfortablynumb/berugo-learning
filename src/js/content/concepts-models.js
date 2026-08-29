/** Concepts for streaming, work and span, and choosing a cost model (M21.7-M21.9). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'streaming-model': [
      {
        term: 'The streaming model is two constraints, and they are the whole subject',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["one pass over the data"] --> C["everything in this milestone<br/>follows from these two"]',
            '    B["space far smaller than the input"] --> C',
            '    C --> D["you cannot store it,<br/>so you summarise it"]',
            '    C --> E["you cannot revisit it,<br/>so you decide as it arrives"]'
          ].join('\n'),
          caption: 'Exactness is not one of the constraints, and that is precisely what has to be given up: every structure here trades a known error for fitting in memory.'
        },
        plain: 'One pass over the data, in an order nobody chose, in sub-linear space.',
        formal: 'space o(n), a single pass, and no control over the arrival order',
        readAs: 'The space used has to grow more slowly than the length of the input, the data ' +
          'is seen once in whatever order it arrives, and none of it can be revisited.',
        detail: 'Every result in the area follows from those two constraints together. One pass ' +
          'alone is easy if the space is unbounded — keep everything and answer at the end. ' +
          'Sub-linear space alone is easy with two passes — the second pass can use what the ' +
          'first learned. It is the conjunction that forbids things, and the forbidding is ' +
          'structural rather than a gap somebody will close.',
        example: 'The demo’s exact distinct-value set is killed at item 345 of 200 000 — it is not ' +
          'slow, it does not fit.'
      },
      {
        term: 'The budget is enforced by killing the structure, not by warning',
        plain: 'A structure that exceeds its byte budget stops, and reports where.',
        formal: 'each structure reports its own byte footprint; the harness kills it at the budget',
        detail: 'This is the difference between a demonstration and an assertion. Almost every ' +
          'streaming tutorial says "an exact set does not fit" and then quietly runs one to check ' +
          'the sketch’s answer. Killing it means the claim is measured, and the item index where ' +
          'it died is a real number a reader can reason about — 345 items into a stream of two ' +
          'hundred thousand, which is 0.17% of the way through.',
        example: 'The demo kills the exact set at 8 208 bytes against a budget of 8 192, and kills ' +
          'HyperLogLog p=14 at 16 384 bytes too.'
      },
      {
        term: 'HyperLogLog buys accuracy with registers at one over the square root',
        plain: 'Quadruple the memory to halve the error.',
        formal: 'relative error ≈ 1.04/√m for m registers',
        readAs: 'The relative error is about one point oh four divided by the square root of the ' +
          'number of registers.',
        detail: 'The square-root law is why the accuracy-space plot is a straight line on ' +
          'logarithmic axes, and why there is a practical sweet spot rather than a knob worth ' +
          'turning to the end. Going from 4 096 registers to 16 384 costs four times the memory ' +
          'and halves the error; going further halves it again for another four times. Somewhere ' +
          'around a few kilobytes the error is small enough that the next halving is not worth ' +
          'the bytes, and that is where every production configuration sits.',
        example: 'The demo measures 11.30%, 8.38%, 4.33% and 0.73% at 16, 256, 4 096 and 16 384 ' +
          'bytes.'
      },
      {
        term: 'A sketch’s measured error can exceed its predicted error, for a documented reason',
        plain: 'The raw estimator reads high in a particular band of cardinalities.',
        formal: 'HyperLogLog’s raw estimate is biased upward for cardinalities between roughly 2.5m and 4m',
        detail: 'Production implementations correct that band — with linear counting below it and ' +
          'an empirical bias table inside it — and a teaching implementation that skips the ' +
          'correction will measure worse than the formula says. The honest move is to report both ' +
          'columns and name the reason, because "the measurement disagrees with the theory" is ' +
          'either a bug, a missing correction, or a real limit, and only one of those is fine.',
        example: 'The demo measures 8.38% at p=8 against a predicted 6.50%, and names the ' +
          'uncorrected band rather than hiding the row.'
      },
      {
        term: 'A quantile sketch bounds RANK error, not value error',
        plain: 'It promises the answer is near the right position, not near the right number.',
        formal: 'a returned value v satisfies rank(v) ∈ [q − ε, q + ε]; the VALUE error depends on the distribution',
        readAs: 'The rank of the returned value lies within epsilon of the requested quantile; ' +
          'nothing is promised about how far the value itself is from the true one.',
        detail: 'On a heavy-tailed distribution a rank error of one per cent at the ninety-ninth ' +
          'percentile can be an enormous difference in milliseconds, because the values are ' +
          'spread out there. This is the most commonly misread guarantee in latency monitoring: ' +
          'the dashboards quote a value and the sketch guarantees a position, and the two are only ' +
          'close where the distribution is dense.',
        example: 'The demo reports ranks rather than values — 0.5001, 0.8995 and 0.9897 for ' +
          't-digest against the requested 0.50, 0.90 and 0.99.'
      },
      {
        term: 'Which sketch to reach for depends on where the accuracy is wanted',
        plain: 'A reservoir is equally wrong everywhere; t-digest keeps resolution at the tails.',
        formal: 'reservoir sampling is uniform; t-digest allocates smaller clusters near 0 and 1',
        detail: 'A uniform sample of a thousand items answers the median well and the p99 badly, ' +
          'because only ten of its samples are past the ninety-ninth percentile. t-digest ' +
          'deliberately spends its memory where the tails are, which is why it wins on the ' +
          'measurement that matters for latency. That is a design choice matched to a question, ' +
          'not a strictly better structure — for a median, a reservoir at the same size is fine ' +
          'and simpler.',
        example: 'The demo measures a worst rank error of 1.045% for a 1 000-item reservoir at ' +
          '8 000 bytes and 0.050% for t-digest at 928.'
      },
      {
        term: 'Some questions have no one-pass answer, even approximately',
        plain: 'A sketch that over-counts cannot certify a count of exactly one.',
        formal: 'exact singleton detection and exact maximum gap both need Ω(n) space in one pass',
        readAs: 'Both of those questions need space at least of the order of the number of ' +
          'items in the stream, which is exactly what the model does not have.',
        detail: 'Knowing which side of the line a requirement falls on is the practical value of ' +
          'the model, because it turns an engineering argument into a settled one. "Which keys ' +
          'appeared exactly once" is not hard, it is impossible in the constraints, so the ' +
          'negotiation is about the requirement — retain the data, take two passes, or ask a ' +
          'different question — and never about the implementation.',
        example: 'The demo’s table marks 2 of 5 questions as having no one-pass answer, with the ' +
          'structural reason in the row.'
      },
      {
        term: 'Cash-register and turnstile streams are different models',
        plain: 'Whether the stream can subtract as well as add.',
        formal: 'cash-register: updates are non-negative · turnstile: updates may be negative',
        detail: 'Several sketches that work on the first silently do not work on the second. ' +
          'HyperLogLog cannot remove an element at all; count-min tolerates deletions only in the ' +
          'strict turnstile model where counts stay non-negative. Asking which model applies is a ' +
          'good early question for any real deployment, because retractions, corrections and ' +
          'late-arriving cancellations turn a cash-register design into a turnstile one without ' +
          'anybody deciding to.',
        example: 'A distinct-user count fed by an event log with retractions is a turnstile ' +
          'stream, and the demo’s HyperLogLog rows do not apply to it.'
      }
    ],

    'work-and-span': [
      {
        term: 'Work and span are the two numbers, and they answer different questions',
        plain: 'Total operations, and the longest chain of dependent ones.',
        formal: 'work T₁ = the time on one processor · span T∞ = the time on infinitely many',
        readAs: 'T-one is the total work, the time on a single processor; T-infinity is the span, ' +
          'the time given unlimited processors.',
        detail: 'Work says what the computation costs and span says how fast it can possibly go. ' +
          'They are properties of the ALGORITHM rather than of any machine, which is what makes ' +
          'them worth computing before buying hardware: the ratio is the speed-up ceiling, and no ' +
          'scheduler, language or runtime beats it. Everything else in parallel performance is ' +
          'about how close a real system gets to that ratio.',
        example: 'The demo’s work-efficient scan over 256 elements has work 511 and span 17, so ' +
          'its ceiling is 30.1×.'
      },
      {
        term: 'Parallelism is work over span, and it is a ceiling rather than a promise',
        plain: 'Beyond that many processors, the extra ones have nothing to do.',
        formal: 'parallelism = T₁/T∞; speed-up on p processors is at most min(p, T₁/T∞)',
        readAs: 'The parallelism is the work divided by the span, and the speed-up on p ' +
          'processors is at most the smaller of p and that ratio.',
        detail: 'This is the number to compute before a discussion about core counts, because it ' +
          'settles the discussion. The demo’s scan floors at 17 steps: at 256 processors it takes ' +
          '17 and at a million it would still take 17, since the critical path has to be walked ' +
          'one step at a time. Adding processors past the parallelism is not a diminishing return, ' +
          'it is a zero one.',
        example: 'The demo’s schedule reaches 30.06× speed-up at 256 processors and the span is ' +
          'attained exactly — time ÷ span reads 1.00×.'
      },
      {
        term: 'Brent’s theorem says a greedy schedule is within a factor of two',
        plain: 'Never leave a processor idle when work is ready, and you are close to optimal.',
        formal: 'T_p ≤ T₁/p + T∞, and since both terms are lower bounds, T_p ≤ 2·T_opt',
        readAs: 'The time on p processors is at most the work divided by p plus the span, and ' +
          'because each of those is separately a lower bound, greedy is within twice optimal.',
        detail: 'The consequence is that scheduling is not where the performance is. Any greedy ' +
          'scheduler — including a work-stealing runtime, which is greedy with a cheap ' +
          'approximation — lands within a factor of two of the best possible, so the way to go ' +
          'faster is to change the work or the span. That is why parallel performance work is ' +
          'about restructuring algorithms rather than tuning thread pools.',
        example: 'The demo measures 39 steps at 16 processors against Brent’s bound of 49, and 17 ' +
          'against 19 at 256.'
      },
      {
        term: 'A prefix sum is not inherently sequential, and the proof is a tree',
        plain: 'Up-sweep builds a reduction tree; down-sweep hands each node its left-hand sum.',
        formal: 'Blelloch scan: 2(n − 1) additions in 2·log₂ n levels',
        readAs: 'Twice n minus one additions, arranged in two times the base-two logarithm of n ' +
          'levels.',
        detail: 'Each output of a scan needs the one before it, which looks like a chain of length ' +
          'n — and the tree formulation gets the same answers with a critical path of 2 log n. ' +
          'The up-sweep computes every subtree sum in n − 1 additions; the down-sweep pushes the ' +
          'sum of everything to the left back down in another n − 1. Every parallel compaction, ' +
          'radix sort and sparse-matrix routine is built on it, which is why it is called the ' +
          'canonical primitive rather than a trick.',
        example: 'The demo measures 511 work and 17 span at n = 256, against 2n = 512 and ' +
          '2·log₂(256) = 16.'
      },
      {
        term: 'Work efficiency is the price paid for span, and it is a real price',
        plain: 'A shorter critical path usually costs more total operations.',
        formal: 'a work-efficient algorithm has T₁ within a constant of the best sequential one',
        readAs: 'The total work is within a constant factor of the best known sequential ' +
          'algorithm for the same problem.',
        detail: 'Hillis–Steele reaches a span of log n rather than 2 log n and does seven times ' +
          'the work of the sequential loop to get there. Neither is better in the abstract: with ' +
          'a handful of processors the extra work dominates and the work-efficient version wins, ' +
          'and with thousands the span dominates and the other does. Which is why the two ' +
          'numbers have to be quoted together — an algorithm described by one of them alone ' +
          'cannot be compared to anything.',
        example: 'The demo measures work 511 and span 17 for Blelloch against work 1 793 and span ' +
          '8 for Hillis–Steele, at 2.00× and 7.00× the sequential loop.'
      },
      {
        term: 'Utilisation falls as processors are added, and that is the graph running dry',
        plain: 'Near the end of the schedule there is not enough ready work to go round.',
        formal: 'utilisation = T₁ / (p · T_p); it falls whenever T_p is limited by the span',
        readAs: 'Utilisation is the work divided by the processor count times the time actually ' +
          'taken, and it falls whenever that time is set by the span rather than by the work.',
        detail: 'It is tempting to read falling utilisation as a scheduling failure and go looking ' +
          'for a better runtime. It is usually the dependency graph: at the top of a reduction ' +
          'tree there are two ready operations and 254 idle processors, and no scheduler invents ' +
          'work that does not exist. The fix is a different algorithm with more parallelism, or ' +
          'more independent problems run at once.',
        example: 'The demo’s utilisation falls from 100.0% at one processor to 11.7% at 256, while ' +
          'the schedule length falls from 511 to 17.'
      },
      {
        term: 'Amdahl’s law is a ceiling on a fixed problem',
        plain: 'The serial fraction sets a maximum speed-up whatever the machine.',
        formal: 'speed-up ≤ 1/s where s is the serial fraction; on p processors, 1/(s + (1 − s)/p)',
        readAs: 'The speed-up is at most one over the serial fraction, and on p processors it is ' +
          'one over the serial fraction plus the parallel fraction divided by p.',
        detail: 'Five per cent serial caps the speed-up at twenty, so a thousand processors ' +
          'deliver 19.6 and the other 980 are idle. The number is brutal and it is arithmetic: ' +
          'the serial part is walked at the same speed whatever surrounds it. Measuring the ' +
          'serial fraction — startup, coordination, the final merge, the lock — is therefore the ' +
          'first thing to do, because it says whether the exercise is worth starting.',
        example: 'The demo reports ceilings of 1000×, 100×, 20× and 5× at serial fractions of ' +
          '0.1%, 1%, 5% and 20%.'
      },
      {
        term: 'Gustafson asks a different question and gets a different answer',
        plain: 'Not how much faster a fixed problem runs, but how much bigger a problem fits.',
        formal: 'scaled speed-up = s + p·(1 − s), for a problem whose parallel part grows with p',
        readAs: 'The scaled speed-up is the serial fraction plus p times the parallel fraction, ' +
          'for a problem that is made bigger as the machine gets bigger.',
        detail: 'At 20% serial Amdahl says 5.0× on a thousand processors and Gustafson says 819×, ' +
          'and neither is wrong — they are answers to different questions. The one that applies ' +
          'is decided by whether the workload grows when the machine does: a nightly batch over ' +
          'a fixed dataset is Amdahl, and a service whose traffic grows with its fleet is ' +
          'Gustafson. Quoting one at the other is the standard mistake in capacity arguments.',
        example: 'The demo’s last column reads 1023×, 1014×, 973× and 819× at the four serial ' +
          'fractions, beside Amdahl’s 506.2, 91.2, 19.6 and 5.0.'
      }
    ],

    'choosing-a-cost-model': [
      {
        term: 'A cost model is a choice about what to count',
        plain: 'Operations, cache misses, block transfers or the critical path.',
        formal: 'a model names a unit; the analysis is a count in that unit, and the unit has to be the bottleneck',
        detail: 'All four models in this section are correct — they are counts of real things — and ' +
          'three of them predict nothing about any given runtime. That is the whole subject: a ' +
          'model is not right or wrong, it is applicable or not, and it is applicable when the ' +
          'thing it counts is the thing that is scarce. Choosing before analysing is what ' +
          'separates a useful complexity argument from an academic one.',
        example: 'The demo predicts 1 048 576, 10 240, 4 096 and 256 for the same sort of 65 536 ' +
          'records — a spread of 4 096× across four units.'
      },
      {
        term: 'The four predictions are in different units and cannot be compared',
        plain: 'Comparisons, misses, transfers and dependent steps are four different things.',
        formal: 'the numbers are counts of distinct events; only their proxy for runtime is shared',
        detail: 'The bar chart in the demo is only meaningful because all four are being used as ' +
          'stand-ins for one runtime, and the section’s question is which of them that runtime ' +
          'actually tracks. Treating the largest number as the worst algorithm, or the smallest ' +
          'as the best, is a category error that shows up constantly in design documents that ' +
          'compare an O(n log n) against an O(n/B · log) without saying what the units are.',
        example: 'The demo’s four rows read 1 048 576 comparisons, 10 240 cache misses, 4 096 ' +
          'block transfers and 256 dependent steps.'
      },
      {
        term: 'A model earns trust by being checked against its own simulator',
        plain: 'Three of the four cannot be compared to a runtime; one can be compared to a count.',
        formal: 'the DAM prediction is checked against the measured transfer count under an enforced budget',
        detail: 'A model nobody has ever compared against anything is a preference rather than a ' +
          'prediction. The external-memory row is checkable because a simulator can count exactly ' +
          'what it claims to count, and the agreement is what licenses using the formula at sizes ' +
          'too large to run. That is the general recipe: validate the model where it can be ' +
          'validated cheaply, then extrapolate with a stated assumption.',
        example: 'The demo sorts 16 384 records under the DAM simulator for 1 024 transfers ' +
          'against a prediction of 1 024.'
      },
      {
        term: 'Once the stride exceeds a cache line, every access misses',
        plain: 'The miss RATE hits 100% and stays there, however few accesses there are.',
        formal: 'accesses that are more than B apart share no line, so misses = accesses',
        detail: 'This is the most actionable measurement in the section, because it explains why ' +
          'a loop that touches one field of every struct in an array is paying the full line cost ' +
          'per element — sixty-four bytes fetched to use eight. It is a layout problem and no ' +
          'amount of optimising the loop body touches it; the fix is structure-of-arrays, or a ' +
          'different traversal, and both are decided before the loop is written.',
        example: 'The demo measures a 100% miss rate at strides of 8 and 64 doubles, fetching 8.0 ' +
          'bytes for every byte used in both.'
      },
      {
        term: 'Bytes fetched per byte used is the number that names the binding resource',
        plain: 'One means perfect; eight means seven eighths of the bus is wasted.',
        formal: 'waste = bytes fetched / bytes used; at 1.0 the traffic is compulsory',
        detail: 'A miss rate alone does not say whether the memory system is the problem, because ' +
          'a low rate on a huge number of accesses still saturates the bus. The ratio does: it ' +
          'compares what crossed the bus against what the computation needed, and anything far ' +
          'above one is memory-bound with a layout cause. It is also measurable on a real machine ' +
          'from two hardware counters, which makes it a diagnostic rather than a model.',
        example: 'The demo measures 1.0× for a sequential scan and 7.0× to 8.0× for the strided ' +
          'and random patterns, marking 3 of 4 as memory-bound.'
      },
      {
        term: 'The order of the questions matters more than the answers',
        plain: 'Ask where the data sits before asking about parallelism.',
        formal: 'working set vs cache · data vs memory · blockwise vs random · idle processors · off-machine',
        detail: 'Asking about parallelism first produces a beautifully parallel algorithm that is ' +
          'bound by block transfers and does not speed up — a real and expensive failure mode ' +
          'rather than a hypothetical one. The data-placement questions come first because they ' +
          'change which algorithm to use, and the parallel question comes after because it only ' +
          'changes how an already-chosen algorithm is run.',
        example: 'The demo’s checklist puts the working-set question first and the network ' +
          'question last, with a way to measure each in its final column.'
      },
      {
        term: 'Every question on the checklist is answerable by measurement, not judgement',
        plain: 'Working-set size, input size, bytes per byte, utilisation, time in syscalls.',
        formal: 'each row names an instrument: a counter, a size comparison or a profile',
        detail: 'That is what keeps the exercise from becoming an architecture debate. Each of the ' +
          'five measurements is available in an afternoon, and each one closes a branch of the ' +
          'decision tree. The alternative — arguing from experience about which model applies — ' +
          'is exactly how a team ends up optimising the wrong quantity for a quarter.',
        example: 'The demo’s final column names the instrument per row: working-set size against ' +
          'cache size, input size against RAM, bytes fetched over bytes used, utilisation under ' +
          'load, and time in system calls.'
      },
      {
        term: 'When the bottleneck is off the machine, none of the four models applies',
        plain: 'Count round trips instead.',
        formal: 'if time is dominated by network and syscall waits, operation, miss, transfer and span counts are all irrelevant',
        detail: 'This is the branch that catches most real systems, and it is at the top of the ' +
          'decision diagram because when it applies nothing else does. A service spending ninety ' +
          'per cent of its latency waiting on three sequential round trips is not helped by any ' +
          'improvement to any of the four counts; it is helped by making two of the round trips ' +
          'concurrent. Saying so plainly is more useful than a complexity analysis of the part ' +
          'that is not the problem.',
        example: 'The demo’s checklist row measures time in system calls and network waits against ' +
          'time on the CPU, and says none of the four models applies when the first dominates.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
