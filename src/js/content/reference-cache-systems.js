/** Reference entries for prefetching, DRAM, NUMA and measurement (M37.7-M37.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    prefetching: {
      summary: 'Three prefetcher designs measured on four access patterns, with coverage, '
        + 'accuracy and traffic reported together so the design with the best coverage figure '
        + 'can be seen losing. The confidence counter is the mechanism worth taking away: it '
        + 'is what makes a stride prefetcher silent on a random pattern, and doing nothing is '
        + 'the correct behaviour there.',
      intuition: 'Coverage can be bought by guessing constantly. Accuracy is what says whether '
        + 'the guessing was worth it.',
      formulation: {
        equations: [
          {
            label: 'The two figures, which are only meaningful together',
            expr: 'coverage = misses removed / baseline misses; accuracy = used / issued',
            readAs: 'coverage is the share of the original misses it removed; accuracy is the '
              + 'share of its guesses anybody used',
            terms: [
              { sym: 'baseline', meaning: '512 demand misses on the strided walk' },
              { sym: 'stride', meaning: '98% coverage, 100% accuracy, 514 lines of traffic' },
              { sym: 'stream', meaning: '99% coverage, 33% accuracy, 1,536 lines of traffic' },
              { sym: 'the verdict', meaning: '1,022 extra lines to remove four more misses' }
            ]
          },
          {
            label: 'Four patterns, three designs, and no design that wins everywhere',
            expr: 'coverage and traffic, per pattern',
            terms: [
              { sym: 'sequential', meaning: 'next-line 100% coverage for 2 extra lines - free and exactly right' },
              { sym: 'strided', meaning: 'next-line 0% coverage and 512 extra lines; stride 98% for 2' },
              { sym: 'random', meaning: 'stride issues nothing; next-line issues 4,076 useless lines' },
              { sym: 'pointer chase', meaning: 'every design fails, and no design can help' }
            ]
          },
          {
            label: 'The confidence counter on the random fixture',
            expr: 'act only on a delta that has repeated',
            terms: [
              { sym: 'threshold 1', meaning: '0 prefetches issued' },
              { sym: 'threshold 2', meaning: '0 issued' },
              { sym: 'threshold 3', meaning: '0 issued' },
              { sym: 'what it costs on a stride', meaning: '508, 506, 504 issued at 99%, 98%, 98% coverage' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Traffic is demand misses plus every prefetch',
          why: 'A prefetch nobody used still occupied the bus and a cache frame.',
          breaks: 'The demo reports it as a column beside coverage.'
        },
        {
          name: 'A stride prefetcher issues nothing on a random pattern',
          why: 'A delta that never repeats never reaches any confidence threshold.',
          breaks: 'Zero prefetches at thresholds 1, 2 and 3.'
        },
        {
          name: 'The table is indexed by program counter, not by address',
          why: 'Two loops walking one array have two strides and one address stream.',
          breaks: 'One entry per access site, each with its own last address and delta.'
        },
        {
          name: 'A pointer chase cannot be prefetched by any design here',
          why: 'The next address is the value the current load returns.',
          breaks: 'Not a gap to close: the information does not exist before the miss is paid.'
        }
      ],
      complexity: [
        { operation: 'next-line', average: 'no state at all', worst: 'doubles the traffic on any non-sequential pattern' },
        { operation: 'stride', average: 'one table entry per access site: last address, delta, counter', worst: 'two interleaved strides from one site defeat a single entry' },
        { operation: 'stream', average: 'a few lines of lookahead per detected stream', worst: 'the distance costs accuracy at the end of every stream' },
        { operation: 'issuing a prefetch', average: 'one outstanding-miss register and one line of bandwidth', worst: 'plus an eviction, which is the cost a miss count does not show' }
      ],
      failureModes: [
        {
          symptom: 'A prefetcher with excellent coverage makes the program slower.',
          cause: 'Low accuracy: the wasted lines cost bandwidth and evicted the working set.',
          fix: 'Report accuracy and traffic beside coverage, and prefer the design with fewer wasted lines.'
        },
        {
          symptom: 'A prefetcher does nothing on a linked structure.',
          cause: 'A chase has no predictable address stream.',
          fix: 'Change the structure - an array, or fatter nodes that hold several addresses.'
        },
        {
          symptom: 'Prefetching helps one core and hurts the others.',
          cause: 'Outstanding-miss registers and last-level capacity are shared.',
          fix: 'Tune aggressiveness as a shared-resource decision, not a per-core one.'
        },
        {
          symptom: 'A software prefetch instruction makes no difference.',
          cause: 'Issued too late to hide the latency, or too early and evicted before use.',
          fix: 'Tune the distance; the useful window is bounded on both sides.'
        }
      ],
      inTheWild: [
        'The L1 and L2 stream and stride prefetchers on every current x86 and ARM part.',
        'Prefetcher aggressiveness settings in server firmware, tuned down for bandwidth-bound workloads.',
        'Software prefetch intrinsics in B-tree and hash-join implementations.',
        'Readahead in file systems and databases, which is next-line at a different granularity.'
      ],
      sources: [
        { title: 'Baer and Chen - An Effective On-Chip Preloading Scheme to Reduce Data Access Penalty (1991)', note: 'the stride prefetcher and its confidence state' },
        { title: 'Jouppi - Improving Direct-Mapped Cache Performance by the Addition of a Small Fully-Associative Cache and Prefetch Buffers (1990)', note: 'stream buffers' },
        { title: 'Falsafi and Wenisch - A Primer on Hardware Prefetching (2014)', note: 'the modern survey, including the accuracy argument' },
        { title: 'Intel 64 and IA-32 Optimization Reference Manual', note: 'which prefetchers a real part has and what defeats them' }
      ]
    },

    'dram-and-the-memory-controller': {
      summary: 'What "a memory access" costs once the row buffer, the banks, the shared bus '
        + 'and the controller queue are in the picture. Three outcomes span a factor of three '
        + 'in cost; interleaving decides whether banks can overlap; and a scheduling policy '
        + 'that reorders the queue doubles the delivered bandwidth on interleaved streams '
        + 'without any hardware change at all - and evaporates completely at a queue depth of one.',
      intuition: 'Three outcomes and a factor of three. The data sheet quotes the first.',
      formulation: {
        equations: [
          {
            label: 'The three outcomes',
            expr: 'row hit, row miss, row conflict',
            terms: [
              { sym: 'row hit', meaning: 'the row is open: tCAS = 15 cycles' },
              { sym: 'row miss', meaning: 'nothing open: tRCD + tCAS = 30' },
              { sym: 'row conflict', meaning: 'the wrong row open: tRP + tRCD + tCAS = 45' },
              { sym: 'what a loaded machine sees', meaning: 'mostly the third, plus the queueing' }
            ]
          },
          {
            label: 'Scheduling on two interleaved streams, queue depth 16',
            expr: 'FR-FCFS prefers a request that hits the open row',
            terms: [
              { sym: 'FCFS', meaning: '0.0% row hits, 31.4 lines per thousand cycles' },
              { sym: 'FR-FCFS', meaning: '48.4% row hits, 64.5 - 2.05x, same hardware' },
              { sym: 'at queue depth 1', meaning: 'both 0.0% and 22.3 - identical' },
              { sym: 'the reading', meaning: 'a policy needs something to reorder' }
            ]
          },
          {
            label: 'What the throughput is bought with: the depth sweep under FR-FCFS',
            expr: 'throughput and worst wait rise together',
            terms: [
              { sym: 'depth 1', meaning: '22.3 throughput, worst wait 45 cycles' },
              { sym: 'depth 4', meaning: '51.9, worst wait 150' },
              { sym: 'depth 16', meaning: '64.5, worst wait 510' },
              { sym: 'depth 64', meaning: '64.5, worst wait 1,230 - all tail, no throughput' }
            ]
          },
          {
            label: 'Bank-level parallelism, and where it stops',
            expr: 'banks hide activation; the bus is shared',
            terms: [
              { sym: '1 bank', meaning: '17,745 cycles, 57.7 throughput' },
              { sym: '4 banks', meaning: '64.2 - 1.11x' },
              { sym: '8 and 16 banks', meaning: '64.5 - 1.12x, and flat from there' },
              { sym: 'interleaving', meaning: 'bank-first 66.2 against row-first 63.2 on a sequential stream' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A bank holds exactly one row open',
          why: 'Reading a different row means closing the current one first.',
          breaks: 'It is what makes the third outcome cost three times the first.'
        },
        {
          name: 'Banks overlap and the data bus does not',
          why: 'A model with a single clock makes eight banks behave like one.',
          breaks: 'Per-bank freeAt against a shared busUntil, which is what the demo simulates.'
        },
        {
          name: 'At a queue depth of one the two policies are the same algorithm',
          why: 'First-ready is first-come when there is nothing else queued.',
          breaks: 'Identical row-hit rate and throughput at depth 1.'
        },
        {
          name: 'Reordering is bounded by the queue depth',
          why: 'A request can only be passed over by requests already queued.',
          breaks: 'It is what stops FR-FCFS starving anybody indefinitely.'
        }
      ],
      complexity: [
        { operation: 'a row hit', average: 'tCAS', worst: 'plus however long it waited in the queue' },
        { operation: 'choosing under FCFS', average: 'take the head', worst: 'constant' },
        { operation: 'choosing under FR-FCFS', average: 'scan the queue for a ready request', worst: 'linear in the queue depth, per selection' },
        { operation: 'refresh', average: 'a few per cent of bandwidth, not modelled here', worst: 'a periodic latency spike a real-time budget has to carry' }
      ],
      failureModes: [
        {
          symptom: 'Measured memory latency is nothing like the data sheet.',
          cause: 'The published figure is the row-hit case on an idle part.',
          fix: 'Characterise with a loaded-latency curve and report where on it you are running.'
        },
        {
          symptom: 'A sequential stream gets a fraction of the expected bandwidth.',
          cause: 'Row-first interleaving, so the walk hammers one bank and nothing overlaps.',
          fix: 'It is an address-bit decision in the platform; bank-first spreads consecutive lines.'
        },
        {
          symptom: 'Two well-behaved streams together are far worse than either alone.',
          cause: 'They alternate rows in each bank, so every request is a conflict.',
          fix: 'Reordering recovers most of it - 0% to 48% row hits and 2.05x throughput.'
        },
        {
          symptom: 'Average latency is fine and some requests take forever.',
          cause: 'The reordering that finds row hits is what leaves a request behind.',
          fix: 'An age threshold that forces an old request through, at a small throughput cost.'
        }
      ],
      inTheWild: [
        'FR-FCFS is the baseline in essentially every published memory-controller study.',
        'Channel and bank interleaving settings in server firmware.',
        'Memory-controller quality-of-service on multi-tenant server parts.',
        'The same shape one layer out: I/O schedulers, and any queue with a reordering policy.'
      ],
      sources: [
        { title: 'Rixner et al. - Memory Access Scheduling (ISCA 2000)', note: 'FR-FCFS and the row-buffer argument' },
        { title: 'Jacob, Ng and Wang - Memory Systems: Cache, DRAM, Disk', note: 'the timing parameters, in full' },
        { title: 'Mutlu and Moscibroda - Stall-Time Fair Memory Access Scheduling (MICRO 2007)', note: 'what fairness costs and why it is needed' },
        { title: 'JEDEC DDR4/DDR5 specifications', note: 'where tCAS, tRCD and tRP are actually defined' }
      ]
    },

    'numa-and-affinity': {
      summary: 'Memory attached to a node, a latency matrix whose diagonal is local, and the '
        + 'first-touch rule that decides which side of it every page lands on. The section '
        + 'reproduces the standard parallel-for mistake, measures it at 1.38x, and fixes it by '
        + 'moving the initialisation rather than by changing a policy. Migration is then shown '
        + 'to be an easy rule with a hard exception: refusing to move a shared page.',
      intuition: 'The diagonal is local. Everything else is the whole subject.',
      formulation: {
        equations: [
          {
            label: 'The topology, as the demo models it',
            expr: 'local against remote, per node pair',
            terms: [
              { sym: 'local', meaning: '80 cycles' },
              { sym: 'remote', meaning: '140 cycles - a ratio of 1.75' },
              { sym: 'on real hardware', meaning: 'what numactl --hardware prints' },
              { sym: 'the trend', meaning: 'chiplets and sub-NUMA clustering bring it inside one package' }
            ]
          },
          {
            label: 'The mistake and the fix, on the same loop',
            expr: 'first touch places the page on the writer\'s node',
            terms: [
              { sym: 'one thread initialises', meaning: 'all 64 pages on node 0, 50.0% locality, 110.0 cycles' },
              { sym: 'each worker initialises its own chunk', meaning: '32 pages per node, 100.0%, 80.0 cycles' },
              { sym: 'the cost', meaning: '1.38x, for a change that moves one loop' },
              { sym: 'what interleaving gives', meaning: 'the same 50.0% and 110.0 - a policy cannot know who will read' }
            ]
          },
          {
            label: 'Migration on two patterns, and the reset that separates them',
            expr: 'act on a run of remote accesses from one node; reset on any other node',
            terms: [
              { sym: 'handoff', meaning: '0.0% to 80.0% locality, 16 migrations - one per page' },
              { sym: 'alternating', meaning: '50.0% unchanged, 0 migrations' },
              { sym: 'without the reset', meaning: 'the page shuttles forever, paying the move every time' },
              { sym: 'the lesson', meaning: 'the refusal is the hard half of the heuristic' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'First touch is decided by the first writer, not the eventual reader',
          why: 'It is exactly right for thread-local data and exactly wrong for an init loop.',
          breaks: 'All 64 pages land on node 0 when one thread fills the array.'
        },
        {
          name: 'The initialisation pass is excluded from the figures',
          why: 'It is local by construction under first touch whoever does it.',
          breaks: 'Counting it would flatter the bad row.'
        },
        {
          name: 'Migration produces zero moves on an alternating pattern',
          why: 'The run counter resets whenever a different node accesses the page.',
          breaks: 'Measured as 0 migrations on the shared fixture.'
        },
        {
          name: 'Placement is a statement about a page and a thread together',
          why: 'The scheduler can invalidate it by moving either one.',
          breaks: 'The demo pins its threads, which is the assumption the measurement rests on.'
        }
      ],
      complexity: [
        { operation: 'a local access', average: '80 cycles', worst: 'the same' },
        { operation: 'a remote access', average: '140 cycles', worst: 'worse across more than two nodes' },
        { operation: 'migrating a page', average: 'a copy plus a translation shootdown', worst: 'paid on every access if the heuristic thrashes' },
        { operation: 'diagnosing it', average: 'one re-run under an interleaved policy', worst: 'no code change and no recompilation' }
      ],
      failureModes: [
        {
          symptom: 'A parallel program stops scaling past one socket.',
          cause: 'One thread initialised the array, so every page is on its node.',
          fix: 'Touch each chunk from the thread that will use it.'
        },
        {
          symptom: 'Interleaved allocation makes a partitioned workload slower.',
          cause: 'Interleaving is for shared structures; a partitioned one could have been local.',
          fix: 'Arrange first touch instead - the policy was never the problem.'
        },
        {
          symptom: 'Automatic migration makes things worse.',
          cause: 'Pages shared by two nodes are moved back and forth on every access.',
          fix: 'Require a run of accesses from one node, and reset the counter on any other.'
        },
        {
          symptom: 'Placement is arranged correctly and the program is still remote-heavy.',
          cause: 'The scheduler moved the thread, so the page is now on the wrong node.',
          fix: 'Pin the threads; placement is a property of the pair.'
        }
      ],
      inTheWild: [
        'numactl and the first-touch discipline in every HPC code base.',
        'Linux AutoNUMA, whose heuristics are the migration problem in production.',
        'JVM and database NUMA-aware allocators.',
        'Sub-NUMA clustering and chiplet topologies, which put this inside a single socket.'
      ],
      sources: [
        { title: 'Lameter - NUMA (an overview), ACM Queue 2013', note: 'the placement rules and the tooling' },
        { title: 'Dashti et al. - Traffic Management: A Holistic Approach to Memory Placement (ASPLOS 2013)', note: 'why congestion, not just latency, drives placement' },
        { title: 'Linux Documentation: numa_memory_policy and AutoNUMA', note: 'the policies as implemented' },
        { title: 'Hennessy and Patterson - Computer Architecture, chapter 5', note: 'distributed shared memory and its latency asymmetry' }
      ]
    },

    'measuring-the-hierarchy': {
      summary: 'The microbenchmark that recovers the cache capacities, the associativity and '
        + 'the line size from timing alone, with every confounder it must avoid exposed as a '
        + 'control so the wrong curves can be produced deliberately. It is short code and the '
        + 'difficulty is entirely in what it must not do, which is the honest structure of a '
        + 'microbenchmark in any subject.',
      intuition: 'Four steps and about fifty lines, and it recovers every capacity exactly.',
      formulation: {
        equations: [
          {
            label: 'Capacities from the working-set sweep',
            expr: 'the size BELOW each step',
            terms: [
              { sym: 'step at 32 KiB', meaning: '4.0 to 18.0 cycles - a 4.50x rise' },
              { sym: 'step at 512 KiB', meaning: '18.0 to 63.0 - 3.50x' },
              { sym: 'step at 8 MiB', meaning: '63.0 to 313.0 - 4.97x' },
              { sym: 'against the configuration', meaning: 'all three exact' }
            ]
          },
          {
            label: 'Associativity from a conflict set',
            expr: 'k addresses at stride sets x line bytes all map to one set',
            terms: [
              { sym: 'k = 1 to 8', meaning: 'all hit on re-reference' },
              { sym: 'k = 9', meaning: '27 misses - more lines than ways' },
              { sym: 'the answer', meaning: 'the largest k that still hits: 8' },
              { sym: 'what it needs to know', meaning: 'nothing about the machine' }
            ]
          },
          {
            label: 'Line size from a stride sweep on a set too large to fit',
            expr: 'the stride at which the miss count stops rising',
            terms: [
              { sym: '8, 16, 32 B', meaning: '4,096 misses - several accesses share each fetch' },
              { sym: '64 B', meaning: '4,096 misses, one access per line' },
              { sym: '128 B', meaning: '2,048 - the accesses, not the lines, have halved' },
              { sym: 'the answer', meaning: '64 bytes, which is the configured line size' }
            ]
          },
          {
            label: 'The four confounders, each a switch in the demo',
            expr: 'what the measurement accidentally measures instead',
            terms: [
              { sym: 'an ordered chase', meaning: 'the prefetcher follows it: the steps flatten' },
              { sym: 'a sequential walk', meaning: 'bandwidth, not latency: no steps at all' },
              { sym: 'including the first pass', meaning: 'compulsory misses at every size lift the whole curve' },
              { sym: 'the translation reach', meaning: '256 KiB, between L1 and L2 - repeat with huge pages' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The harness is told none of the configuration',
          why: 'A discovery method that reads the answer is not a measurement.',
          breaks: 'It may allocate memory and time accesses, and nothing else.'
        },
        {
          name: 'The chase must be shuffled',
          why: 'One access outstanding at a time is what makes it a latency measurement.',
          breaks: 'The ordered variant is a control, so the wrong curve can be seen.'
        },
        {
          name: 'The first pass is discarded',
          why: 'Its misses are compulsory at every working-set size.',
          breaks: 'Including it lifts the curve and flattens the steps the method looks for.'
        },
        {
          name: 'The line-size sweep needs a set too large to fit',
          why: 'Otherwise nothing misses at any stride and the knee never appears.',
          breaks: 'It is the one precondition that is easy to omit and silent when omitted.'
        }
      ],
      complexity: [
        { operation: 'one sweep point', average: 'passes x lines, with the first pass discarded', worst: 'dominated by the largest working set' },
        { operation: 'step detection', average: 'one pass with a ratio threshold', worst: 'a threshold too high misses a shallow step' },
        { operation: 'the conflict-set construction', average: 'ways + 2 trials of a few passes each', worst: 'trivial next to the sweep' },
        { operation: 'the stride sweep', average: 'one pass per stride over a large set', worst: 'the same' }
      ],
      failureModes: [
        {
          symptom: 'The measurement finds no steps.',
          cause: 'A sequential walk, which measures bandwidth rather than latency.',
          fix: 'Shuffle the chase; only one access may be outstanding at a time.'
        },
        {
          symptom: 'Every cache is reported as twice its real size.',
          cause: 'The size above the step was read instead of the size below it.',
          fix: 'The capacity is the largest working set that still fitted.'
        },
        {
          symptom: 'A step is confidently attributed to a cache and it was the TLB.',
          cause: '64 entries over 4 KiB pages reach 256 KiB, near a real cache boundary.',
          fix: 'Repeat with huge pages: a step that moves was translation.'
        },
        {
          symptom: 'A hardware counter and a timing measurement disagree.',
          cause: 'The counter\'s event is defined in the manual, not by its name; it may include prefetches or walks.',
          fix: 'Prefer the measurement you designed and understand, and report the conditions with it.'
        }
      ],
      inTheWild: [
        'lmbench and the memory-mountain benchmarks, which are this sweep.',
        'The cache-size detection in tuned libraries such as ATLAS and OpenBLAS.',
        'Cloud instance characterisation, where the documentation is thin and the hardware varies.',
        'Flush+Reload and Prime+Probe, which are this same primitive with a different intent (36.8).'
      ],
      sources: [
        { title: 'McVoy and Staelin - lmbench: Portable Tools for Performance Analysis (1996)', note: 'the latency sweep as a portable tool' },
        { title: 'Bryant and O\'Hallaron - Computer Systems, chapter 6', note: 'the memory mountain and how to read it' },
        { title: 'Yotov et al. - Automatic Measurement of Memory Hierarchy Parameters (SIGMETRICS 2005)', note: 'the discovery routines, done rigorously' },
        { title: 'Gregg - Systems Performance', note: 'the general discipline: report the conditions with the number' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
