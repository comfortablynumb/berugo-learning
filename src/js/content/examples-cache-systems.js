/** Worked examples for prefetching, DRAM, NUMA and measurement (M37.7-M37.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    prefetching: [
      {
        title: 'Three prefetchers on one strided walk, and only one of them is worth having',
        goal: 'Show that coverage on its own picks the wrong design, and that reading it '
          + 'beside accuracy and traffic picks the right one.',
        setup: 'A walk of 512 lines at a stride wider than a line, against a small cache with '
          + 'no prefetcher taking 512 misses. Traffic counts every line fetched, whether '
          + 'anybody wanted it or not.',
        steps: [
          { do: 'Record the baseline.',
            why: 'Coverage is a fraction of this number.',
            work: '512 demand misses, 0 prefetches, 512 lines of traffic' },
          { do: 'Run next-line prefetching.',
            why: 'It costs nothing to build, so it is the design to beat.',
            work: '512 misses still, 512 prefetches, 0% coverage, 0% accuracy' },
          { do: 'Run the stride prefetcher.',
            why: 'It learns the delta from the address stream.',
            work: '8 misses, 506 prefetches, 100% accuracy, 98% coverage, 514 lines of traffic' },
          { do: 'Run the stream prefetcher, which runs several lines ahead.',
            why: 'It buys the last few per cent of coverage.',
            work: '4 misses, 1,532 prefetches, 99% coverage - and 33% accuracy' },
          { do: 'Compare the traffic of the last two.',
            why: 'This is the column a coverage figure hides.',
            work: '514 lines against 1,536: 1,022 extra lines for 4 fewer misses' },
          { do: 'Pick.',
            why: 'On a machine where bandwidth is the constraint, the answer is not the highest coverage.',
            work: 'stride: 504 misses removed for 2 extra lines' }
        ],
        answer: 'The stream prefetcher has the best coverage figure on the page and is a net '
          + 'loss: it spends 1,022 extra lines of bandwidth to remove four more misses than '
          + 'the stride design. Next-line, meanwhile, has 0% coverage and still doubles the '
          + 'traffic - a mechanism that is pure cost on this pattern and perfect on a '
          + 'sequential one. Coverage alone would have ranked them stream, stride, next-line; '
          + 'coverage with accuracy and traffic ranks them stride, then nothing, then the '
          + 'other two. A wrong prefetch is not free: it takes bandwidth, an outstanding-miss '
          + 'register and a cache frame somebody else was using.'
        },
      {
        title: 'The confidence counter, and a prefetcher that is right to do nothing',
        goal: 'Show that the mechanism which makes a stride prefetcher useful on a stride is '
          + 'the same one that makes it silent on a random pattern.',
        setup: 'The stride prefetcher keeps one entry per program counter: the last address, '
          + 'the last delta, and a counter that has to reach the confidence threshold before '
          + 'anything is issued. Two fixtures: a strided walk and a random one.',
        steps: [
          { do: 'Note that a delta exists between every pair of addresses, random or not.',
            why: 'This is why the naive version is a random-address generator.',
            work: '2 accesses define 1 delta, in every pattern' },
          { do: 'Run the random fixture at a confidence threshold of 1.',
            why: 'The weakest possible caution.',
            work: '0 prefetches issued, 0% coverage' },
          { do: 'Try thresholds 2 and 3.',
            why: 'To check the refusal is the mechanism rather than a lucky seed.',
            work: '0 issued at both - a delta that never repeats reaches no threshold' },
          { do: 'Run the strided fixture at the same three thresholds.',
            why: 'To price the caution on the pattern it is meant to catch.',
            work: '508 issued at 99% coverage, 506 at 98%, 504 at 98%' },
          { do: 'Compare the two columns.',
            why: 'This is the whole trade.',
            work: '2 to 4 prefetches lost at the start of each run, against 0 fired on noise' }
        ],
        answer: 'On the random pattern the prefetcher issues nothing at all, at every threshold '
          + '- and doing nothing is the correct behaviour there, because a random walk has no '
          + 'structure to exploit and every prefetch would be a wasted line plus an eviction. '
          + 'It costs two to four prefetches at the start of each stride run, which is the '
          + 'right price. The interesting comparison is against next-line, which has no '
          + 'confidence mechanism at all and therefore issues 4,073 lines on exactly the same '
          + 'random fixture, of which four are ever used. Knowing when to refuse is most of '
          + 'what separates a '
          + 'useful predictor from an expensive one.'
      }
    ],

    'dram-and-the-memory-controller': [
      {
        title: 'Reorder the queue and double the throughput without changing the hardware',
        goal: 'Measure what a scheduling decision alone is worth, by running the same two '
          + 'interleaved streams under both policies.',
        setup: 'Eight banks, 32 lines per row, bank-first interleaving, a queue depth of 16. '
          + 'Two streams walk memory 4 MiB apart, so each bank alternates between two rows. '
          + 'A row hit costs 15 cycles, a miss 30, a conflict 45.',
        steps: [
          { do: 'Run first-come-first-served and count the outcomes.',
            why: 'Consecutive arrivals alternate between two rows in each bank.',
            work: '0.0% row hits - every single request is a conflict' },
          { do: 'Record the throughput.',
            why: 'The baseline to beat.',
            work: '31.4 lines per thousand cycles of wall time' },
          { do: 'Switch to FR-FCFS: serve a queued request that hits the open row first.',
            why: 'The reordering finds hits that arrival order hid.',
            work: '48.4% row hits, 496 of 1,024 requests' },
          { do: 'Record the throughput again.',
            why: 'Same banks, same timings, same trace.',
            work: '64.5 - 2.05x, and no hardware changed' },
          { do: 'Now set the queue depth to 1 and re-run both policies.',
            why: 'A policy needs something to reorder.',
            work: 'both 0.0% row hits and 22.3 throughput - identical' },
          { do: 'Sweep the depth from 1 to 64 under FR-FCFS.',
            why: 'To see what the throughput is bought with.',
            work: 'throughput 22.3, 32.9, 51.9, 64.3, 64.5; worst wait 45, 90, 150, 270, 510' }
        ],
        answer: 'Doubling the delivered bandwidth by looking at the queue before choosing is a '
          + 'scheduling result, not a hardware one - and it evaporates entirely at a queue '
          + 'depth of one, where first-ready is first-come and the two policies are the same '
          + 'algorithm. The depth sweep shows what is being traded: throughput and the worst '
          + 'wait rise together, because the reordering that finds row hits is exactly the '
          + 'reordering that leaves a request behind. Real controllers add an age threshold on '
          + 'top to bound the tail, giving up a little throughput to do it - the same trade as '
          + 'every starvation guard in the scheduling sections.'
        },
      {
        title: 'Bank-level parallelism, and the point where more banks stop helping',
        goal: 'Separate what banks hide from what they cannot, by sweeping the bank count on a '
          + 'fixed trace.',
        setup: 'The same two-stream trace under FR-FCFS. Banks are independent - a row can be '
          + 'activated in one while another transfers - but the data bus is shared and '
          + 'serialises every transfer.',
        steps: [
          { do: 'Run with a single bank.',
            why: 'Nothing can overlap, so every activation is on the critical path.',
            work: '92.2% row hits, 17,745 cycles elapsed, 57.7 throughput' },
          { do: 'Double to two banks.',
            why: 'One bank can activate while the other transfers.',
            work: '16,905 cycles, 60.6 throughput - 1.05x' },
          { do: 'Continue to four and eight.',
            why: 'To find where the gain stops.',
            work: '64.2 then 64.5 - 1.11x and 1.12x' },
          { do: 'Try sixteen.',
            why: 'The bus should now be the constraint rather than the banks.',
            work: '64.5 - no change at all' },
          { do: 'Note what the row-hit rate did on the way.',
            why: 'Bank-first interleaving spreads a row across more banks as they multiply.',
            work: '92.2% at one bank down to 48.4% at eight' },
          { do: 'Compare the two interleavings on the sequential stream.',
            why: 'This is the address-bit decision that decides whether banks can overlap at all.',
            work: 'bank-first 66.2 against row-first 63.2' }
        ],
        answer: 'Banks hide activation and precharge; they cannot hide the transfer, because '
          + 'there is one bus. So the curve rises to about 1.12x and then flattens completely, '
          + 'and after that the thing that helps is another channel rather than a ninth bank. '
          + 'The row-hit rate falling from 92% to 48% along the way is not a regression - it is '
          + 'bank-first interleaving doing its job, spreading consecutive lines across banks so '
          + 'they can overlap, at the price of fewer accesses to each open row. Which address '
          + 'bits select the bank has no correctness consequence whatever and is worth 5% on a '
          + 'sequential stream and far more on interleaved ones.'
      }
    ],

    'numa-and-affinity': [
      {
        title: 'The parallel-for that nobody wrote wrong, costing 1.38x',
        goal: 'Reproduce the standard placement mistake, measure it, and fix it by moving the '
          + 'initialisation rather than by changing any policy.',
        setup: 'Two nodes, 80 cycles local and 140 remote, 64 pages, first-touch placement. '
          + 'Two workers then split the array in half and access their own halves. The '
          + 'initialisation pass is excluded from the figures - it is local by construction '
          + 'whoever does it.',
        steps: [
          { do: 'Have one thread on node 0 fill the whole array, then run the workers.',
            why: 'This is the shape of almost every parallel program\'s startup.',
            work: 'all 64 pages placed on node 0' },
          { do: 'Measure the locality of the worker phase.',
            why: 'Half the workers are on the wrong node.',
            work: '50.0% - 128 of 256 accesses local' },
          { do: 'Compute the average access cost.',
            why: 'The two halves pay different prices.',
            work: '0.5 x 80 + 0.5 x 140 = 110.0 cycles' },
          { do: 'Now have each worker touch its own chunk first.',
            why: 'First touch places the page on the node of the thread that writes it first.',
            work: '32 pages on node 0 and 32 on node 1' },
          { do: 'Measure again.',
            why: 'Same allocation, same loop, same accesses.',
            work: '100.0% locality, 80.0 cycles per access' },
          { do: 'Take the ratio.',
            why: 'To price a change that touches only where the initialisation loop runs.',
            work: '110.0 / 80.0 = 1.38x' }
        ],
        answer: 'Nobody writes this misallocation - the runtime does it, at the moment the '
          + 'array is filled, before anyone has thought about placement. The symptom is a '
          + 'program that does not scale rather than one that is slow, which is why it is so '
          + 'often diagnosed as lock contention or a bandwidth ceiling instead. The rule that '
          + 'fixes it is one sentence long: allocate where you will use it. Note what does '
          + 'not fix it - interleaving gives exactly the same 50% locality and 110.0 cycles on '
          + 'this workload, because a policy cannot know which thread was going to read which '
          + 'half.'
        },
      {
        title: 'A migration heuristic that has to know when not to move',
        goal: 'Show that the hard half of page migration is the refusal, by running the same '
          + 'policy against a pattern it should act on and one it should not.',
        setup: 'The policy migrates a page after a run of consecutive remote accesses from one '
          + 'node, and resets the run counter whenever a different node accesses the page. '
          + 'Two fixtures: a handoff, and two nodes alternating on every page.',
        steps: [
          { do: 'Run the handoff with migration off: node 0 allocates all 16 pages, node 1 uses them.',
            why: 'The baseline for a pattern with a stable eventual user.',
            work: '0.0% locality - every access remote' },
          { do: 'Turn migration on.',
            why: 'The accessing node is stable, so the run counter keeps climbing.',
            work: '80.0% locality, 16 migrations - one per page' },
          { do: 'Run the alternating fixture with migration off.',
            why: 'Both nodes touch every page equally, so half the accesses are remote whatever happens.',
            work: '50.0% locality' },
          { do: 'Turn migration on.',
            why: 'This is where a naive rule destroys itself.',
            work: '50.0% locality and 0 migrations' },
          { do: 'Check why nothing moved.',
            why: 'The reset is the whole mechanism.',
            work: 'the run counter resets to 1 on every access from the other node, so it never reaches 4' }
        ],
        answer: 'The easy half of migration is moving a page to the node that keeps asking for '
          + 'it: one move per page takes the handoff from nothing to 80% local. The hard half '
          + 'is refusing to move a page two nodes are sharing, and a rule without the reset '
          + 'would shuttle it back and forth forever, paying the move on every access and '
          + 'never getting a local one. Zero migrations on the alternating fixture is the '
          + 'result to look for; a heuristic that scores well on the first fixture and thrashes '
          + 'on the second is worse than no heuristic, because it fails on the workload nobody '
          + 'thought to test.'
      }
    ],

    'measuring-the-hierarchy': [
      {
        title: 'Recover four numbers about the machine with nothing but a timer',
        goal: 'Run the three discovery experiments end to end and check every answer against '
          + 'the configuration the harness was never given.',
        setup: 'A simulated machine with 32 KiB, 512 KiB and 8 MiB caches, 8 ways at the top '
          + 'level, and 64-byte lines. The harness may allocate memory and time accesses, and '
          + 'is told nothing else.',
        steps: [
          { do: 'Sweep the working set with a shuffled chase, discarding the first pass.',
            why: 'Shuffled defeats the prefetcher; discarding removes the compulsory misses.',
            work: 'steps at 32 KiB (4.50x), 512 KiB (3.50x) and 8 MiB (4.97x)' },
          { do: 'Read the size below each step.',
            why: 'The largest working set that still fitted is the capacity.',
            work: '32 KiB, 512 KiB, 8 MiB - all three exact' },
          { do: 'Build a conflict set: k addresses 64 x 64 bytes apart, all mapping to one set.',
            why: 'They all hit while k is at most the number of ways.',
            work: 'k = 1 through 8 all hit; k = 9 misses 27 times' },
          { do: 'Take the largest k that still hit.',
            why: 'That is the associativity, and nothing about the machine had to be known.',
            work: '8 - exact' },
          { do: 'Walk a working set far too large to fit, at strides doubling from 8 bytes.',
            why: 'Below the line size, several accesses share one fetch.',
            work: '4,096 misses at 8, 16, 32 and 64 B; 2,048 at 128 B' },
          { do: 'Find the stride at which the miss count stops rising.',
            why: 'Past the line size, every access is already its own line.',
            work: '64 bytes - exact' }
        ],
        answer: 'Four numbers, all exact, from about fifty lines that allocate memory and time '
          + 'accesses. The subtle points are all off-by-ones and confounders rather than '
          + 'algorithms: the capacity is the size below the step, the associativity is the '
          + 'largest k that still hits, and the line size is where the miss count stops '
          + 'rising rather than where it starts. This is the first thing worth running on '
          + 'unfamiliar hardware, because it needs no documentation, no privileged access and '
          + 'no counters whose definitions vary by generation.'
        },
      {
        title: 'Break the same measurement four ways',
        goal: 'Turn each confounder on in turn and watch the method report a confident wrong '
          + 'answer, which is what makes the controls worth having.',
        setup: 'The same sweep, with switches for the access pattern and the warm-up pass.',
        steps: [
          { do: 'Order the chase in address order instead of shuffling it.',
            why: 'The accesses still depend on each other, but now they are predictable.',
            work: 'flat at 4.0 cycles everywhere: 0 steps, and a reading of "it all fits in L1"' },
          { do: 'Switch to a sequential walk.',
            why: 'Nothing depends on anything, so the machine overlaps the accesses.',
            work: 'flat at 1.0 - below the 4-cycle L1 hit, which no latency can be' },
          { do: 'Include the first pass.',
            why: 'Its misses are compulsory at every size.',
            work: '81.3, 91.8, 125.5, 313.0: only 2 of the 3 steps clear the threshold' },
          { do: 'Consider the translation reach on a real machine.',
            why: '64 entries over 4 KiB pages reach 256 KiB, between typical L1 and L2 sizes.',
            work: 'a step at 256 KiB could be either, and the curve cannot say which' },
          { do: 'Repeat that sweep with 2 MiB pages.',
            why: 'The reach moves by 512x and a cache capacity does not move at all.',
            work: '1 extra run: a step that moved was translation, one that stayed was a cache' }
        ],
        answer: 'The loop is trivial and the controls are the work. Each of these four '
          + 'confounders produces a plausible curve and a wrong answer, and three of them fail '
          + 'silently - there is no error, just a different number. Only one of the four '
          + 'announces itself, and it is worth knowing which: the sequential walk reports 1.0 '
          + 'cycles per access, and since no access can complete faster than the cache it hits, '
          + 'a per-access time below the L1 latency is proof that throughput was measured '
          + 'rather than latency. That is the honest '
          + 'structure of a microbenchmark in any subject, which is why this section is worth '
          + 'building once even if you never need the cache sizes: a result reported without '
          + 'saying which conditions were controlled for is not a measurement of the machine. '
          + 'It is also worth noticing that this method and the Flush+Reload receiver in 36.8 '
          + 'are the same primitive - timing an access to learn what the cache holds - and '
          + 'only the intent differs.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
