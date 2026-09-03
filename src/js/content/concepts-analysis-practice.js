/**
 * Concepts for the measurement half of the analysis milestone (M01.6-M01.9):
 * constants and cache, space, empirical complexity and benchmarking.
 *
 * Split from concepts-analysis.js only for size: one file for the whole
 * milestone runs past the 1 000-line limit once every concept carries its
 * explanation.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'constants-and-cache': [
      {
        term: 'Crossover point',
        diagram: {
          definition: [
            'flowchart LR',
            '    S["small n<br/>the simple algorithm wins"] --> X{"the crossover"}',
            '    X --> B["large n<br/>the asymptotically better one wins"]',
            '    X --> H["a hybrid switches here<br/>and beats both everywhere"]'
          ].join('\n'),
          caption: 'Below the crossover the asymptotically better algorithm is the slower one. That is not a rounding error — it is where the constants live.'
        },
        plain: 'The input size where the asymptotically better algorithm actually becomes faster.',
        formal: 'smallest n with T_better(n) < T_worse(n)',
        readAs: 'The crossover is the first input size at which the algorithm with the better ' +
          'complexity class finally runs faster than the simpler one. Below it, the simpler one wins.',
        detail: [
          'Two algorithms in different complexity classes still cross at a specific size, and below ' +
            'it the worse class wins. Asymptotics only promise an ordering eventually.',
          'The crossover is set entirely by the constants. Insertion sort does more comparisons ' +
            'than merge sort in principle, but it does no allocation, no recursion and has a ' +
            'perfectly predictable access pattern. So it stays ahead to somewhere around 30 ' +
            'elements on typical hardware.',
          'That number is not a constant of nature. It moves with element size, comparison cost, ' +
            'cache and compiler, which is why it is measured on the target rather than quoted from ' +
            'a textbook.'
        ],
        example: 'Insertion sort beats merge sort below roughly 30 elements.'
      },
      {
        term: 'Hidden constant',
        plain: 'Everything the notation drops: allocation, recursion, branch misses, cache misses.',
        formal: 'T(n) = c·f(n) + lower-order terms',
        readAs: 'The real running time is some fixed multiplier c times the shape f(n), plus smaller ' +
          'terms that stop mattering as n grows. The notation keeps f and throws away c — and c is ' +
          'where most engineering effort actually goes.',
        detail: [
          'Θ deliberately quotients out the multiplier, so that algorithms can be compared ' +
            'independently of the machine. That multiplier is where most engineering lives.',
          'It absorbs the cost of an allocation per node, a mispredicted branch per iteration, a ' +
            'cache miss per access and an indirect call per comparison. Differences of 5× between ' +
            'two implementations of the same complexity class are ordinary.',
          'This is why "we rewrote it and it got four times faster" and "the complexity is ' +
            'unchanged" are both true statements about the same commit. The notation is a starting ' +
            'point for a performance discussion rather than the end of one.'
        ],
        example: 'Two Θ(n log n) sorts can differ by 5×.'
      },
      {
        term: 'Hybrid algorithm',
        plain: 'Use the asymptotically better algorithm above the crossover and the simpler one below it.',
        formal: 'if n ≤ cutoff use A else B',
        detail: [
          'Once you know a crossover exists, the obvious move is to use both algorithms on the ' +
            'sides where each wins. Every production sort does exactly this.',
          'Recursive divide-and-conquer makes it especially profitable, because the small cases are ' +
            'not rare. They are the most numerous rows of the recursion tree, so switching to ' +
            'insertion sort below a cutoff of 16 to 32 replaces the majority of the calls.',
          'Introsort adds a second switch for a different reason. It counts recursion depth and ' +
            'falls back to heapsort when the pivots go badly, buying a worst-case guarantee that ' +
            'quicksort alone does not have.'
        ],
        example: 'Timsort, introsort and pdqsort all do exactly this.'
      },
      {
        term: 'Cache locality',
        plain: 'Sequential access is far cheaper than jumping about, at the same operation count.',
        formal: 'cost per access depends on the access pattern',
        detail: [
          'Two data structures can perform identical numbers of operations and differ by an order ' +
            'of magnitude in time, because the memory system charges by pattern rather than by ' +
            'count.',
          'A sequential walk reads a full cache line per fetch, and the prefetcher sees the stride ' +
            'coming, so the next line is already in flight. A pointer chase cannot even issue the ' +
            'next load until the current one returns, which serialises the misses.',
          'That is why an array outperforms a linked list at every size for traversal, despite both ' +
            'being Θ(n). The asymptotics count the same n; the hardware does not charge the same ' +
            'price for each of them.'
        ],
        example: 'An array beats a linked list at every size, despite identical asymptotics.'
      },
      {
        term: 'Operation count versus time',
        plain: 'Counting is machine-independent and does not predict time; timing predicts time and does not transfer.',
        formal: 'report both, never one',
        detail: [
          'The two measurements have complementary defects.',
          'A count is exactly reproducible and says nothing about how long an operation takes. So ' +
            'an algorithm can win on comparisons and lose on the clock: merge sort does fewer ' +
            'comparisons than quicksort long before it runs faster, because quicksort\'s are ' +
            'cheaper.',
          'A time is what you actually care about, and it is valid only for the machine, build and ' +
            'afternoon that produced it.',
          'Reporting both makes the gap between them visible, and that gap is where the interesting ' +
            'engineering is. It is the constant, and it has a cause you can go and find.'
        ],
        example: 'Merge sort counts fewer comparisons long before it runs faster.'
      },
      {
        term: 'The line is the unit',
        diagram: {
          definition: [
            'flowchart LR',
            '    B["your code asks for 4 bytes"] --> C["the machine fetches<br/>a whole cache line"]',
            '    C --> S{"is the next access<br/>inside that same line?"}',
            '    S -->|yes| F["free — it is already there"]',
            '    S -->|no| A["another full line, from scratch"]'
          ].join('\n'),
          caption: 'Cost is lines touched, not bytes read. That single substitution explains why sequential access beats scattered access at an identical operation count.'
        },
        plain: 'Memory moves in cache lines, not bytes. What a program costs is how many lines it touches, and how much of each it uses.',
        formal: '64-byte line = 16 int32 values',
        readAs: 'A cache line is 64 bytes and a 32-bit integer is 4 bytes, so one line carries ' +
          'sixteen of them. Touch any one and the hardware has already fetched all sixteen.',
        detail: [
          'The memory system has no way to move four bytes. The smallest transfer is a 64-byte ' +
            'line, so touching one int32 costs the same as touching all sixteen in that line.',
          'Traffic is therefore lines fetched, and efficiency is the fraction of each line you ' +
            'actually use before it is evicted.',
          'A row-major sweep uses all sixteen values per line. The same sweep by column uses one, ' +
            'so it moves sixteen times the bytes to do identical arithmetic. Every layout technique ' +
            'in this track — struct-of-arrays, field reordering, hot/cold splitting, blocking — is ' +
            'an attempt to raise that fraction.'
        ],
        example: 'A row-major sweep uses all 16; the same sweep by column uses 1, and moves 16× the bytes.'
      },
      {
        term: 'Memory hierarchy',
        diagram: {
          definition: [
            'flowchart TD',
            '    R["registers"] --> L1["L1 cache"]',
            '    L1 --> L2["L2 cache"]',
            '    L2 --> L3["L3 cache"]',
            '    L3 --> M["main memory"]',
            '    M --> D["SSD"]',
            '    D --> N["each step down is roughly<br/>ten times slower and<br/>ten times larger"]'
          ].join('\n'),
          caption: 'What a program costs is mostly which level it has to reach, and only secondarily how many operations it runs.'
        },
        plain: 'Each level is roughly an order of magnitude slower and larger than the one above it.',
        formal: 'L1 ≈ 1 ns; L2 ≈ 4 ns; L3 ≈ 12 ns; DRAM ≈ 80 ns',
        readAs: 'Four levels of memory with their typical access times, fastest first. L1, L2 and L3 ' +
          'are progressively larger and slower caches, and DRAM is the main memory behind them. A ' +
          'nanosecond is a thousandth of a microsecond.',
        detail: [
          'Caches exist because fast memory is small and large memory is slow. The hardware stages ' +
            'data through levels that trade capacity against latency.',
          'The ratios matter more than the absolute figures. A DRAM access costs roughly eighty ' +
            'times an L1 hit, which is about as long as eighty arithmetic instructions would take.',
          'That is the exchange rate behind every "do more arithmetic to avoid a fetch" ' +
            'optimisation, including recomputing a value rather than storing it. It also explains ' +
            'why a working set that fits in a level behaves like a different algorithm from one ' +
            'that does not. The knee is a property of the machine, not of the code.'
        ],
        example: 'One DRAM miss costs about as much as 80 arithmetic instructions.'
      },
      {
        term: 'Blocking',
        plain: 'Restructure the loops so the working set of the inner one fits a level of cache. The arithmetic does not change; the traffic does.',
        formal: 'tile so that tile bytes < cache bytes',
        detail: [
          'A naive matrix multiply streams whole rows and columns. By the time it returns to a row ' +
            'that row has been evicted and must be fetched again, so the same data crosses the bus ' +
            'many times.',
          'Blocking splits the iteration space into tiles small enough that a tile stays resident, ' +
            'and does all the work involving that tile while it is there.',
          'The instruction count is unchanged and the answer is identical. Only the number of times ' +
            'each byte is fetched drops.',
          'Sizing is the whole trick. A 64 × 64 tile of int32 is 16 KiB, which fits comfortably in ' +
            'a 32 KiB L1 alongside the other tiles the inner loop needs.'
        ],
        example: 'A 64 × 64 int32 tile is 16 KiB, comfortably inside a 32 KiB L1.'
      }
    ],

    'space-complexity': [
      {
        term: 'Peak memory',
        plain: 'The most live bytes at any instant. This is the number that fails a machine.',
        formal: 'max over time of live allocation',
        detail: [
          'Processes are killed by the high-water mark, not by the total they have ever allocated. ' +
            'So peak is the figure that decides whether a job runs.',
          'The two numbers can be wildly different. A streaming pipeline may allocate gigabytes ' +
            'over its lifetime while never holding more than a few kilobytes at once. A job that ' +
            'materialises one list allocates far less in total, and needs all of it ' +
            'simultaneously.',
          'Peak is also the number a garbage-collected runtime makes hardest to see, since ' +
            'freed-but-uncollected memory still counts against the process. Profile the maximum of ' +
            'live bytes over time, not the sum of allocations.'
        ],
        example: 'Total allocated may be gigabytes while the peak stays kilobytes.'
      },
      {
        term: 'Auxiliary space',
        plain: 'What the algorithm needs beyond its input. "In-place" is a claim about this.',
        formal: 'space excluding the input',
        detail: [
          'The input has to exist regardless, so the interesting quantity is the extra space the ' +
            'algorithm demands on top of it. That is what auxiliary space measures, and what "in ' +
            'place" claims is O(1).',
          'Heapsort qualifies. It rearranges the array it was given and needs a handful of indices.',
          'Merge sort does not. The merge step needs somewhere to write, and the standard ' +
            'implementation asks for a second array of n elements. That is why sorting a list which ' +
            'only just fits in memory is a different problem from sorting a small one.',
          'The term is worth stating precisely, because it is routinely claimed for algorithms ' +
            'whose recursion quietly uses Θ(log n) of stack.'
        ],
        example: 'Heapsort is O(1) auxiliary; merge sort is O(n).'
      },
      {
        term: 'Streaming',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["materialise:<br/>read all n, hold all n, then process"] --> B["peak memory grows with n"]',
            '    C["stream:<br/>read one, process it, drop it"] --> D["peak memory stays constant"]',
            '    D --> E["the input may now be larger<br/>than the machine"]'
          ].join('\n'),
          caption: 'Streaming does not make the program faster. It makes the peak stop depending on the input size, which is a different and usually more valuable thing.'
        },
        plain: 'Hold one item, not the collection. Peak memory stops depending on input size.',
        formal: 'O(1) peak, O(n) time',
        readAs: 'Peak memory stays at some fixed amount no matter how large the input is, while the ' +
          'time still grows in step with it.',
        detail: [
          'If each item can be processed and discarded, peak memory becomes a constant and the ' +
            'input size stops being a limit at all. That is the difference between a job that ' +
            'handles a hundred-gigabyte file on a laptop and one that needs a bigger machine.',
          'The requirement is that the computation be expressible incrementally. Sums, counts, ' +
            'maxima, running hashes and sketches all are. Sorting and exact distinct-counting are ' +
            'not, and need either a pass structure or an approximation.',
          'The second benefit is latency, since output can begin before the input ends. The usual ' +
            'cost is throughput, since per-item overhead is paid n times.'
        ],
        example: 'Summing a file line by line rather than reading it all in.'
      },
      {
        term: 'Chunking',
        plain: 'The middle ground: bounded memory, better throughput than one item at a time.',
        formal: 'O(chunk) peak',
        detail: [
          'Item-at-a-time processing pays every fixed cost — a syscall, a round trip, a ' +
            'transaction — once per item. That is why the memory-optimal choice is often the ' +
            'slowest.',
          'Chunking amortises those fixed costs over a batch, while keeping peak memory bounded by ' +
            'the chunk rather than the input. You get most of the throughput of the materialised ' +
            'version, with a memory ceiling you choose.',
          'The chunk size is the dial. Large enough that per-batch overhead is amortised, small ' +
            'enough to stay in cache and to keep latency and retry cost acceptable. A thousand rows ' +
            'per insert is the usual starting point, precisely because the curve is flat there.'
        ],
        example: 'Batch inserts of 1 000 rows instead of one or all.'
      },
      {
        term: 'Stack space',
        diagram: {
          definition: [
            'flowchart TD',
            '    A["recurse one level deeper"] --> B["one more frame on the stack"]',
            '    B --> C{"is the depth still<br/>inside the stack limit?"}',
            '    C -->|yes| A',
            '    C -->|no| X["stack overflow —<br/>while the heap is still almost empty"]'
          ].join('\n'),
          caption: 'Recursion depth is memory, and it is charged to a separate, much smaller budget than the heap — which is why this fails on inputs the heap could hold easily.'
        },
        plain: 'Recursion depth is memory. Deep recursion overflows even when the heap is empty.',
        formal: 'depth × frame size',
        detail: [
          'Each live call holds a frame: return address, saved registers, locals, alignment ' +
            'padding. So recursion depth is a memory cost, charged to a region that was sized once ' +
            'at thread creation and cannot grow.',
          'A frame of about 96 bytes and a stack of 1 MiB means roughly ten thousand frames. That ' +
            'is far less headroom than people assume.',
          'Recursing once per element of a list therefore fails well before the heap is troubled, ' +
            'and it fails with a stack overflow rather than an allocation error. The fix is ' +
            'structural: recurse on the smaller side, convert to an explicit stack, or make the ' +
            'call a loop.'
        ],
        example: 'Recursing per list element dies at a few hundred thousand items.'
      },
      {
        term: 'Time to first result',
        plain: 'Streaming produces output immediately; materialising produces nothing until the end.',
        formal: 'latency versus throughput',
        detail: [
          'The same total work can be delivered on two very different schedules, and which one is ' +
            'right depends entirely on who is waiting.',
          'A user interface needs the first row now, so a streaming pipeline that emits as it goes ' +
            'feels fast even if it finishes later. A batch job has no one watching until the end, ' +
            'so it should choose whatever minimises total time — usually materialising, sorting, ' +
            'and processing in bulk.',
          'The mistake is inheriting one pattern for both. A report that streams row by row into an ' +
            'interactive page is right; the same code driving an overnight export is leaving ' +
            'throughput on the table.'
        ],
        example: 'A UI wants the first row; a batch job wants the last one soonest.'
      },
      {
        term: 'Working set',
        plain: 'The bytes actually touched in a window of time. It, not the allocation, is what a cache sees.',
        formal: 'W(t, τ) = pages referenced in [t − τ, t]',
        readAs: 'The working set at time t is every page the program touched during the window of ' +
          'length τ ending at t. The square brackets denote that window, from t − τ up to and ' +
          'including t.',
        detail: [
          'Caches respond to what is being referenced now, not to what has been allocated. So the ' +
            'quantity that decides hit rate is the set of bytes touched within a recent window.',
          'A structure much larger than cache performs perfectly well if each phase touches a small ' +
            'part of it. A small structure walked in a scattered order can thrash.',
          'The classic failure is a column-major sweep of a row-major matrix. 4 MiB walked by ' +
            'column touches 1 024 distinct lines per pass, with no reuse before eviction. A ' +
            '512-line cache therefore misses on every access, even though the same total data ' +
            'would fit if it were traversed the other way.'
        ],
        example: 'A 4 MiB matrix walked by column has a working set of 1024 lines per pass and thrashes a 512-line cache.'
      },
      {
        term: 'In place is about the array',
        plain: '"In place" bounds the auxiliary heap, and says nothing about the stack the recursion needs.',
        formal: 'auxiliary O(1), stack O(depth)',
        detail: [
          'Quicksort is described as in-place because it partitions within the input array and ' +
            'allocates nothing. It still needs a frame per live recursive call.',
          'Recursing on both halves without care allows a depth of n on adversarial input. At ' +
            'n = 10⁶ and a 96-byte frame that is 91.6 MiB of stack, against a default thread stack ' +
            'of about 1 MiB. The program dies of a memory cost its complexity table does not list.',
          'The standard fix is to recurse on the smaller partition and loop on the larger. That ' +
            'caps depth at log₂ n, and brings the same input down to under 2 KiB.'
        ],
        example: 'Quicksort that recurses on both sides needs 91.6 MiB of stack at n = 10⁶ — and the thread has 1 MiB.'
      }
    ],

    'empirical-complexity': [
      {
        term: 'Doubling experiment',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["time it at n"] --> R["ratio = time at 2n ÷ time at n"]',
            '    B["time it at 2n"] --> R',
            '    R --> C["ratio near 2 → linear"]',
            '    R --> D["ratio near 4 → quadratic"]',
            '    R --> E["ratio near 8 → cubic"]'
          ].join('\n'),
          caption: 'You never have to read the code. Doubling the input and reading one ratio names the class, and it names it in the units the machine actually charges.'
        },
        plain: 'Double the input and look at the cost ratio. The ratio names the exponent.',
        formal: 'T(2n)/T(n) → 2^k for Θ(n^k)',
        readAs: 'If cost grows like n to the power k, then doubling n multiplies the cost by 2 to ' +
          'the power k. So divide the two measured times and the ratio names the exponent: about 2 ' +
          'means k = 1, about 4 means k = 2, about 8 means k = 3.',
        detail: [
          'For a power law the constant cancels in a ratio. Double the input, divide the times, and ' +
            'you get 2^k directly — you never need to know c.',
          'A ratio near 2 is linear, near 4 quadratic, near 8 cubic. A little above 2 is ' +
            'linearithmic.',
          'The method is robust because it is relative. It survives a slow machine, a warm cache ' +
            'and an unfair build, as long as those conditions apply equally to both runs.',
          'Its weakness is resolution. Ratios grow multiplicatively with the exponent, so ' +
            'distinguishing n log n from n^1.1 needs far more precision than distinguishing linear ' +
            'from quadratic.'
        ],
        example: 'A ratio near 4 means quadratic.'
      },
      {
        term: 'Log-log slope',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["cost is about c·n^k<br/>(a power law)"] --> B["take the log of both axes"]',
            '    B --> C["the curve becomes a straight line"]',
            '    C --> D["its slope is k —<br/>read the exponent off the chart"]'
          ].join('\n'),
          caption: 'A power law is a straight line on log-log axes, so the exponent you are trying to identify becomes something you can measure with a ruler.'
        },
        plain: 'A power law is a straight line on log-log axes, and its slope is the exponent.',
        formal: 'log T = k·log n + log c',
        readAs: 'Take the logarithm of both sides of T = c·n^k and the power turns into a ' +
          'multiplication. What is left is the equation of a straight line: slope k, intercept ' +
          'log c. That is why a power law plots straight on log-log axes.',
        detail: [
          'Taking logs of T = c·n^k gives log T = k·log n + log c. That is a straight line whose ' +
            'slope is the exponent and whose intercept is the constant.',
          'Plotting on log-log axes therefore turns "which curve is this" into "is this straight, ' +
            'and how steep". The eye is good at that question.',
          'Curvature is informative too. An upward bend means the exponent is rising, which is what ' +
            'a cache boundary or a hidden allocation looks like.',
          'What the plot cannot do is separate curves that differ by a logarithm. A log factor is a ' +
            'gentle bend rather than a change of slope.'
        ],
        example: 'Slope 1.0 is linear; 2.0 is quadratic.'
      },
      {
        term: 'Curve fitting',
        plain: 'Fit candidate curves and compare residuals. Useful, and easy to over-trust when two candidates are close.',
        formal: 'minimise ‖y − c·f(n)‖',
        readAs: 'Pick the multiplier c that makes the candidate curve sit as close to the measured ' +
          'points as possible. The double bars mean the overall size of the gap between the two — ' +
          'one number summarising the error at every point at once.',
        detail: [
          'Fitting each candidate model and ranking them by residual is the natural mechanised ' +
            'version of reading a plot, and it works well when the candidates are far apart.',
          'It becomes misleading when they are not. Over a single decade of n, n log n and n^1.1 ' +
            'are close enough that ordinary measurement jitter decides the winner. The fit then ' +
            'reports a confident answer that would flip on a rerun.',
          'Three defences. Widen the range rather than adding points inside it. Report the ' +
            'runner-up\'s residual alongside the winner\'s. And treat a small gap between two ' +
            'models as the absence of a result.'
        ],
        example: 'n log n and n are hard to separate over one decade.'
      },
      {
        term: 'Asymptotic regime',
        plain: 'Small inputs are dominated by constants, so the measured exponent only settles at larger n.',
        formal: 'the fit applies past n₀',
        readAs: 'Whatever the fit tells you is a claim about behaviour from some input size n₀ ' +
          'upward. Points measured below n₀ describe the setup costs instead.',
        detail: [
          'Every complexity claim is about behaviour past some threshold, and measurement below ' +
            'that threshold describes the lower-order terms instead.',
          'At small n a quadratic routine spends most of its time in setup, allocation and the ' +
            'linear part. So the fitted exponent comes out near 1, and stays there until the ' +
            'quadratic term takes over.',
          'Three points from n = 8 to n = 32 are not a weak measurement of the asymptotic ' +
            'behaviour. They are a measurement of something else.',
          'Push the range up until the ratio stabilises across consecutive doublings, and treat ' +
            'that stabilisation as the evidence that you have reached the regime.'
        ],
        example: 'Three points from 8 to 32 tell you almost nothing.'
      },
      {
        term: 'Measuring the wrong thing',
        plain: 'A warm cache, a deleted loop or a quadratic input generator all produce confident nonsense.',
        formal: 'validate the measurement first',
        detail: [
          'The most expensive mistakes in empirical work are not statistical. They are measuring ' +
            'the wrong subject entirely.',
          'A dead-code-eliminated loop reports a wonderful time for work that never happened. A ' +
            'benchmark that reuses one input measures a warm cache. A generator that builds its ' +
            'test data by repeated string concatenation is often the quadratic curve you then ' +
            'attribute to the algorithm.',
          'So validate first. Check that the result is consumed. Check that the reported cost ' +
            'changes when the algorithm is deliberately made worse. And time the generator ' +
            'separately, so its shape cannot be mistaken for the subject\'s.'
        ],
        example: 'A generator that concatenates strings is often the real subject.'
      },
      {
        term: 'Resolution limit',
        plain: 'A ratio table separates classes that differ by a factor of n. It cannot separate two curves that differ by a logarithm.',
        formal: 'n log n and n^1.1 give ratios 2.15 and 2.14 over a 16× range',
        readAs: 'Two genuinely different growth shapes produce doubling ratios that differ in the ' +
          'second decimal place, even measured across a sixteenfold spread of input sizes. ' +
          'Ordinary measurement noise is larger than that gap.',
        detail: [
          'The doubling ratio for n log n creeps up as log n grows, while the ratio for n^1.1 is a ' +
            'constant 2.14. Over a realistic 16× range those two sequences agree to within a ' +
            'hundredth.',
          'Ordinary run-to-run jitter is a percent or two, so the measurement cannot distinguish ' +
            'them however many points you add.',
          'A least-squares fit does not solve this. Run it on exact n^1.1 data and it happily ' +
            'reports O(n log n), with a residual smaller than the noise.',
          'The honest conclusion is that some hypotheses are outside the resolution of the method. ' +
            'The way to separate them is a different measurement, not more of this one.'
        ],
        example: 'A least-squares fit labels exact n^1.1 data as O(n log n), with a residual smaller than 2% jitter produces.'
      },
      {
        term: 'Regime boundary',
        plain: 'When the input crosses a cache level, the measured exponent jumps for reasons that have nothing to do with the algorithm.',
        formal: 'a knee at working set ≈ cache size',
        detail: [
          'Measured cost is the algorithm\'s operation count multiplied by a per-operation price, ' +
            'and that price is not constant. It steps up each time the working set outgrows a cache ' +
            'level.',
          'So a curve can bend sharply while the algorithm does exactly what it always did, and ' +
            'fitting across the bend produces an exponent that describes neither side.',
          'The giveaway is that the knee sits at a size matching a cache boundary rather than ' +
            'anything in the code. Fit each regime separately, and report where the knee is — it is ' +
            'usually the most actionable thing the experiment found.'
        ],
        example: 'An in-memory sort looks linearithmic until the array leaves L2, then briefly looks quadratic.'
      },
      {
        term: 'Pre-asymptotic constants',
        plain: 'At small n the low-order terms dominate, so the fitted exponent describes the constants, not the class.',
        formal: 'T(n) = an² + bn + c with bn ≫ an² for small n',
        readAs: 'The true cost has a quadratic part, a linear part and a fixed part. At small n the ' +
          'linear part is much the larger, so what you measure there is the linear term wearing the ' +
          'name of the quadratic one.',
        detail: [
          'A real cost function is a sum of terms, and the leading one only leads once n is large ' +
            'enough.',
          'With T(n) = an² + bn + c and a small a, the linear term can dominate throughout the ' +
            'range you measured. The fit then reports an exponent near 1 for a genuinely quadratic ' +
            'routine, and it will be wrong by orders of magnitude when extrapolated.',
          'This is the failure mode behind "it tested fine and fell over in production at 10× the ' +
            'data".',
          'The check is to extend the range until consecutive doubling ratios stop drifting. A ' +
            'drifting ratio means the terms are still trading places.'
        ],
        example: 'Fitting over n = 100…800 can report an exponent near 1 for a genuinely quadratic routine.'
      }
    ],

    benchmarking: [
      {
        term: 'Warm-up',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["the first runs:<br/>interpreted, caches cold,<br/>nothing optimised yet"] --> D["discard them"]',
            '    D --> B["the later runs:<br/>compiled, caches warm"]',
            '    B --> M["measure only these"]',
            '    M --> W["and report how many you discarded,<br/>or nobody can check the number"]'
          ].join('\n'),
          caption: 'Without a warm-up you measure the compiler starting up. With an unreported one you measure something nobody else can reproduce.'
        },
        plain: 'Discarded runs that let the engine compile and the caches fill, so you measure steady state.',
        formal: 'discard the first k runs',
        detail: [
          'A JavaScript engine begins in an interpreter, gathers type feedback, then optimises the ' +
            'hot function. It may deoptimise it again when an assumption breaks. So the first run ' +
            'and the tenth are running different machine code.',
          'Caches, branch predictors and memory allocators warm up alongside it. Discarding the ' +
            'first runs measures the steady state, which is what a server in production is in.',
          'Steady state is a choice, though, not the truth. If the code you care about runs once, ' +
            'at startup, then the cold number is the real one and warming up hides your actual ' +
            'problem.'
        ],
        example: 'The first run of a JIT-compiled loop can be 10× the tenth.'
      },
      {
        term: 'Sink',
        plain: 'Consuming the result so the compiler cannot prove the work is dead and remove it.',
        formal: 'keep a reference to the output',
        detail: [
          'An optimiser is entitled to delete any computation whose result is never observed. A ' +
            'benchmark that throws its result away is precisely that computation.',
          'The symptom is a suspiciously round, suspiciously tiny time that does not change when ' +
            'you make the algorithm obviously worse. That is a very good reason to sanity-check ' +
            'every benchmark by slowing the subject down deliberately.',
          'The fix is a sink. Accumulate the result into a variable that escapes the measured ' +
            'region, and read it afterwards. It costs an addition per iteration, and it keeps the ' +
            'work alive.'
        ],
        example: 'Without one, a "0.001 ms" result usually means nothing ran.'
      },
      {
        term: 'Median and MAD',
        plain: 'A robust centre and a robust spread. The mean and standard deviation are moved by one outlier.',
        formal: 'MAD = median(|xᵢ − median|)',
        readAs: 'Take how far each reading sits from the middle reading — the bars mean distance, so ' +
          'the sign is dropped — and then take the middle of those distances. It is a spread that a ' +
          'handful of extreme runs cannot move.',
        detail: [
          'Benchmark noise is one-sided: interference only ever makes a run slower. So the sample ' +
            'has a long right tail, and the mean chases it. One GC pause in fifteen runs can move ' +
            'the mean several percent while leaving the median untouched.',
          'The median absolute deviation plays the same role for spread that the median plays for ' +
            'centre. Neither is moved by a minority of extreme values.',
          'Report both, and the reader learns the typical cost and how repeatable it was. Keep the ' +
            'outliers in the data rather than trimming them: they are real, and sometimes they are ' +
            'the finding.'
        ],
        example: 'One GC pause shifts the mean and leaves the median alone.'
      },
      {
        term: 'Timer resolution',
        plain: 'Browser clocks are deliberately coarse. Work below the resolution measures as zero.',
        formal: 'performance.now() is clamped',
        detail: [
          'A high-resolution timer is a side channel. It is what Spectre-style attacks used to ' +
            'read cache state, so browsers clamp performance.now() to a coarse grid. The grid is ' +
            'typically somewhere between 5 µs and 100 µs, depending on isolation headers.',
          'Anything faster than the grid measures as zero, or as one tick. Timing a single small ' +
            'operation therefore yields quantisation noise rather than a duration.',
          'The standard answer is to time a batch. Run the operation a thousand times inside one ' +
            'measured region and divide. That puts the total safely above the resolution, and ' +
            'amortises the timer call itself.'
        ],
        example: 'Time a batch of 1 000 iterations, not one.'
      },
      {
        term: 'Coordinated omission',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["closed loop:<br/>send, wait for the reply, send again"] --> S["the system stalls"]',
            '    S --> B["so the generator stalls too,<br/>and sends nothing"]',
            '    B --> C["the requests that would have been slow<br/>were never made at all"]',
            '    C --> D["the recorded latency looks healthy"]'
          ].join('\n'),
          caption: 'The measurement is not noisy, it is systematically wrong: the loop stops sampling exactly when the answer would have been bad.'
        },
        plain: 'A closed-loop generator stops sending while the system is slow, so it never measures the queue it caused.',
        formal: 'measure against intended send time',
        detail: [
          'A load generator that waits for each response before sending the next one stops issuing ' +
            'load exactly when the system stalls. The requests that should have queued during the ' +
            'stall are never sent, and never timed.',
          'The result is a latency distribution that omits its own worst cases, systematically and ' +
            'invisibly.',
          'The fix is to time each request from when it was scheduled to be sent, rather than from ' +
            'when it actually went out. A stall then shows up in every request it delayed. ' +
            'Correcting for it commonly moves a reported p99 by an order of magnitude, which is the ' +
            'size of the lie.'
        ],
        example: 'Correcting for it commonly moves p99 by 10×.'
      },
      {
        term: 'Reporting',
        plain: 'A number nobody can refute is not a result: give the median, the spread, the run count and the conditions.',
        formal: 'median ± MAD over n runs',
        readAs: 'Report the middle reading, how far readings typically sit either side of it, and ' +
          'how many runs produced both. All three, or the number cannot be argued with.',
        detail: [
          'A bare "3.2 ms" cannot be argued with, reproduced or compared. That makes it rhetoric ' +
            'rather than measurement.',
          'The minimum that makes a claim checkable is the centre, the spread, the number of runs ' +
            'and the conditions — machine, build, input size, warm or cold. With those, a reader ' +
            'can judge whether the difference you claim is larger than the noise you measured, and ' +
            'can reproduce the experiment to disagree.',
          'The discipline also protects you from yourself. Writing down the run count is when you ' +
            'notice that fifteen runs cannot support the five-percent claim in the next sentence.'
        ],
        example: '"3.2 ms (median of 15)" rather than "3.2 ms".'
      },
      {
        term: 'Coefficient of variation',
        plain: 'The spread as a fraction of the middle. It is the one measured number that decides how many runs a claim needs.',
        formal: 'CV = sigma / mu',
        readAs: 'The coefficient of variation is the standard deviation (sigma, the typical distance ' +
          'from the average) divided by the mean (mu, the average itself). Dividing one by the ' +
          'other cancels the units, which is what lets you compare noise between benchmarks of ' +
          'completely different durations.',
        detail: [
          'Absolute spread cannot be compared across benchmarks of different durations. Divide it ' +
            'by the mean and you get a dimensionless noise level that can.',
          'The CV is what converts a desired resolution into a sample size, because the number of ' +
            'runs needed scales with (CV/delta)². Halve the effect you want to detect and you need ' +
            'four times the runs.',
          'At a typical CV of 8%, resolving a 5% difference takes about 41 runs per arm. Get the ' +
            'environment quiet enough to reach CV = 3% and the same claim needs 6. Reducing noise ' +
            'is almost always cheaper than adding runs.'
        ],
        example: 'At CV = 8% a defensible 5% claim needs 41 runs per arm; at CV = 3% it needs 6.'
      },
      {
        term: 'Statistical power',
        plain: 'The chance of seeing a real difference of a given size. "No difference" from an underpowered run means nothing at all.',
        formal: 'n per arm = 2(z_a + z_b)^2 (CV/delta)^2',
        readAs: 'The runs you need per side scales with the square of your noise level divided by ' +
          'the difference you want to detect. The z terms are fixed constants, set by how confident ' +
          'you want to be. Everything that varies is in that ratio, and it is squared — so halving ' +
          'the difference you want to resolve costs four times the runs.',
        detail: [
          'Power is the probability that an experiment detects an effect that is genuinely there.',
          'Run too few samples and the experiment is not capable of resolving the difference you ' +
            'are looking for. Then "we saw no regression" reports the design of the benchmark ' +
            'rather than the behaviour of the code.',
          'The formula runs both ways, and the useful direction is backwards. Given the runs you ' +
            'can afford and the CV you measured, what is the smallest difference this experiment ' +
            'could have found?',
          'Fifteen runs at CV = 8% resolve about 8.2%. So they can neither support nor refute a 5% ' +
            'claim — and saying so is the honest result.'
        ],
        example: '15 runs at CV = 8% resolve 8.2%, so they cannot support a 5% claim in either direction.'
      }
    ],
  });
}(typeof window !== 'undefined' ? window : null));
