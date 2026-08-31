/** Concepts for prefetching, DRAM, NUMA and measurement (M37.7-M37.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    prefetching: [
      {
        term: 'Coverage and accuracy, always together',
        diagram: {
          definition: [
            'flowchart LR',
            '    P["prefetches issued"] --> U["used by a later demand access"]',
            '    P --> W["never used: bandwidth and an eviction"]',
            '    U --> C["coverage: the misses removed"]',
            '    W --> A["accuracy: the fraction that were not wasted"]'
          ].join('\n'),
          caption: 'Coverage can be bought by guessing constantly. Accuracy is what says '
            + 'whether the guessing was worth it.'
        },
        plain: 'The misses it removed, and the fraction of its guesses anybody used.',
        formal: 'coverage = misses removed / baseline misses; accuracy = used / issued',
        detail: 'Almost every discussion quotes coverage and omits accuracy, and accuracy is '
          + 'the one that decides whether the mechanism is a net win. A wrong prefetch costs '
          + 'bandwidth, occupies an outstanding-miss register and evicts a line somebody was '
          + 'about to use, so a design at fifty per cent accuracy is routinely net negative '
          + 'even while its coverage figure looks excellent.',
        example: 'The stream prefetcher on a strided walk: 99% coverage at 33% accuracy, '
          + 'issuing 1,532 prefetches and adding 1,024 lines of traffic to remove 508 misses.'
      },
      {
        term: 'Next-line prefetching is free and exactly wrong on a stride',
        plain: 'Fetch line n+1 on every access to line n.',
        formal: 'no state at all, and correct exactly when the access pattern is sequential',
        detail: 'On a sequential walk it is perfect: full coverage at full accuracy for one '
          + 'extra line of traffic, and it costs nothing to build because there is nothing to '
          + 'remember. On a walk with any stride larger than a line it removes no misses '
          + 'whatever and doubles the traffic, because the line after the one you touched is '
          + 'never the line you want next. That is a wide gap in behaviour for a mechanism with '
          + 'no parameters.',
        example: 'On the strided walk: 0% coverage, 0% accuracy, and 512 extra lines of traffic.'
      },
      {
        term: 'The confidence counter is a design that is right by refusing',
        plain: 'Two accesses define a delta; only a repeated delta is evidence.',
        formal: 'act only once the same delta has been seen `confidence` times in a row',
        detail: 'In a random access pattern every pair of addresses also defines a delta, so a '
          + 'stride prefetcher without a confidence counter is a random-address generator with '
          + 'extra steps. Requiring the delta to repeat before acting means the mechanism '
          + 'issues nothing at all on a pattern with no stride to find - and doing nothing is '
          + 'the correct behaviour there, which is worth seeing a mechanism achieve '
          + 'deliberately rather than by accident.',
        example: 'On the random fixture the stride prefetcher issues zero prefetches at every '
          + 'confidence threshold.'
      },
      {
        term: 'Timeliness is a third property and distance is its control',
        plain: 'A prefetch that lands after the demand access has already stalled saved nothing.',
        formal: 'the prefetch must be issued far enough ahead to complete before the access',
        detail: 'Issuing one line ahead means the fetch begins at about the moment the program '
          + 'asks for the previous line, so the demand access still waits for most of the '
          + 'latency. Running several lines ahead fixes that and costs accuracy at the end of '
          + 'every stream, where the extra lines are fetched and the stream stops. The distance '
          + 'is therefore a trade rather than a setting to maximise, which the demo makes a '
          + 'slider for exactly that reason.',
        example: 'The stream prefetcher covers 100% of the sequential walk for 8 extra lines '
          + 'of traffic, and 99% of the strided one for 1,024.'
      },
      {
        term: 'A pointer chase cannot be prefetched by anything',
        plain: 'The next address is the value the current load returns.',
        formal: 'there is nothing to predict from until the miss has already been paid',
        detail: 'Every design on this page fails on it, and that is not an implementation gap '
          + 'to be closed by a cleverer predictor: the information does not exist yet. That is '
          + 'the same fact 36.6 measured as a 3.9x cycle difference on identical miss counts, '
          + 'and it is why the fix for a chase is always a different data structure rather than '
          + 'a better machine.',
        example: 'On the chase fixture the stride prefetcher issues nothing and the others lose '
          + 'traffic for a few accidental hits.'
      },
      {
        term: 'Pollution is the cost a miss count does not show',
        plain: 'A wrong prefetch installs a line, and the line it evicted was wanted.',
        formal: 'an inaccurate prefetcher can raise the demand miss rate on a small cache',
        detail: 'The cache has a fixed number of frames, so every prefetched line displaces '
          + 'something. When the prefetches are accurate the displaced lines were the least '
          + 'useful ones; when they are not, the prefetcher is evicting the working set to make '
          + 'room for data nobody asked for. That is how a prefetcher can make a program '
          + 'measurably slower, which sounds impossible until the frame count is remembered.',
        example: 'The traffic column in the demo is the honest measure: demand misses plus '
          + 'prefetches, whether or not anybody wanted them.'
      },
      {
        term: 'Software prefetch instructions exist for what hardware cannot see',
        plain: 'Code that knows its next-but-one address can say so.',
        formal: 'an instruction that requests a line without consuming the value',
        detail: 'A B-tree descent or a hash probe often computes the next address several steps '
          + 'before it needs the data, and no hardware predictor can infer that from the '
          + 'address stream. Stating it outright works, and is easy to get wrong in both '
          + 'directions: issued too early the line is evicted before use, too late it saves '
          + 'nothing, and either way it costs an instruction on the hot path.',
        example: 'Not modelled here, because a model of it would be a model of the programmer '
          + 'rather than of the machine.'
      },
      {
        term: 'Bandwidth spent on a guess is bandwidth somebody else needed',
        plain: 'A shared prefetcher is a shared resource.',
        formal: 'prefetch traffic competes with demand traffic for the same outstanding-miss capacity',
        detail: 'On a many-core part with several threads streaming through unrelated memory, '
          + 'an aggressive prefetcher on one core consumes miss registers and bus cycles that '
          + 'the others need, and can evict their working sets from a shared last-level cache. '
          + 'That is why prefetcher aggressiveness is tuned down on some server parts and why '
          + 'the accuracy question is a shared-resource question rather than a local one - the '
          + 'same argument as 36.7.',
        example: 'The traffic column rises much faster than the coverage column on every '
          + 'inaccurate row of the matrix.'
      }
    ],

    'dram-and-the-memory-controller': [
      {
        term: 'A bank holds one row open, and which row decides the cost',
        diagram: {
          definition: [
            'flowchart TD',
            '    R["request for row r"] --> Q{"what is open?"}',
            '    Q -->|"row r"| H["hit: 15 cycles"]',
            '    Q -->|"nothing"| M["miss: activate then read, 30"]',
            '    Q -->|"another row"| C["conflict: close, activate, read, 45"]'
          ].join('\n'),
          caption: 'Three outcomes and a factor of three. The data sheet quotes the first.'
        },
        plain: 'A hit, a miss with nothing open, or a conflict with the wrong row open.',
        formal: 'tCAS, tRCD + tCAS, or tRP + tRCD + tCAS',
        detail: 'The row buffer is a set of sense amplifiers holding one row of the bank, and '
          + 'reading a different row means closing the current one first. The three cases '
          + 'differ by a factor of three, and a loaded machine spends most of its time in the '
          + 'third - so the published latency, which is the first case, describes almost '
          + 'nothing that actually happens.',
        example: 'The bank-conflict fixture: 0% row hits and 22.3 lines per thousand cycles, '
          + 'a third of the 66.2 the sequential stream reaches.'
      },
      {
        term: 'Interleaving decides whether banks can overlap at all',
        plain: 'Bank-first spreads consecutive lines; row-first fills a row before moving on.',
        formal: 'the bank bits sit below the row bits, or above them',
        detail: 'Which address bits select the bank is a design decision with no correctness '
          + 'consequence and a large performance one. Putting them low means consecutive lines '
          + 'land in different banks, so a sequential walk activates several banks at once and '
          + 'their activation times overlap behind one another\'s transfers. Putting them high '
          + 'means a walk hammers one bank at a time, and the parallelism the hardware has is '
          + 'simply unused.',
        example: 'The sequential stream: 66.2 lines per thousand cycles bank-first against 63.2 '
          + 'row-first, and the gap widens with conflicts.'
      },
      {
        term: 'Reordering finds row hits that arrival order hides',
        plain: 'Serve the queued request that hits the open row first.',
        formal: 'FR-FCFS prefers a ready request; among equals, the oldest',
        detail: 'Two interleaved streams alternate between two rows in each bank, so under '
          + 'strict arrival order every single request is a conflict. Letting the controller '
          + 'look through its queue for one that hits the currently open row batches them '
          + 'together, and the row-hit rate goes from nothing to half without any hardware '
          + 'change at all. It is a scheduling result rather than a hardware one, which is why '
          + 'the queue depth matters so much.',
        example: 'Two interleaved streams: 0% row hits and 31.4 throughput under FCFS, 48.4% '
          + 'and 64.5 under FR-FCFS.'
      },
      {
        term: 'A policy needs something to reorder',
        plain: 'At a queue depth of one, first-ready is first-come.',
        formal: 'the reordering opportunity grows with the number of outstanding requests',
        detail: 'The controller can only choose among requests it already has, so a shallow '
          + 'queue leaves it nothing to optimise and a deep one lets it find many row hits - '
          + 'and lets a request be passed over many times. That is the same trade in both '
          + 'directions, which is why the demo reports the worst wait beside the throughput '
          + 'rather than only the flattering number.',
        example: 'The reordering table: the furthest a request is moved is bounded by the queue '
          + 'depth, which is what stops indefinite starvation.'
      },
      {
        term: 'Bank-level parallelism hides activation, not transfer',
        plain: 'Opening a row in one bank happens while another bank is transferring.',
        formal: 'banks are independent; the data bus is shared',
        detail: 'That split is the whole of why more banks help and why the help flattens. '
          + 'Activation and precharge happen inside a bank and can overlap with any other '
          + 'bank\'s activity; the transfer itself uses the one data bus and cannot. So adding '
          + 'banks hides the activation time until the bus is saturated, and after that the '
          + 'thing that helps is another channel rather than another bank.',
        example: 'The bank sweep flattens once the banks keep the bus busy, which is the point '
          + 'at which a second channel is the next move.'
      },
      {
        term: 'Latency under load is queueing, not the data sheet',
        plain: 'The service time includes however long the request sat in the queue.',
        formal: 'the useful characterisation is a loaded-latency curve, not a single number',
        detail: 'Plot latency against delivered bandwidth and the curve has a knee where '
          + 'queueing starts to dominate; a system running past that knee has latencies with no '
          + 'relation to any published figure. The same shape belongs to every shared resource '
          + 'with a scheduler in front of it - a disk, a link, a connection pool - and in every '
          + 'case the question is how far up the curve you are rather than how fast the thing '
          + 'is when idle.',
        example: 'The average service figure in the demo rises with the queue depth even while '
          + 'the throughput improves.'
      },
      {
        term: 'Fairness is what the throughput is bought with',
        plain: 'FR-FCFS passes over an older request whenever a younger one is ready.',
        formal: 'a request in an unlucky bank waits far longer than its arrival order suggests',
        detail: 'The reordering that finds row hits is exactly the reordering that leaves some '
          + 'request behind, and a policy that is fast on average with an unbounded tail is not '
          + 'one anybody can ship. Real controllers add an age threshold that forces an old '
          + 'request through regardless, which costs a little throughput to bound the tail - '
          + 'the same trade as the starvation guard in 36.7.',
        example: 'The demo reports the worst wait beside the average, and the queue depth is '
          + 'what bounds it.'
      },
      {
        term: 'Refresh is the overhead nobody chose',
        plain: 'Every row has to be read and rewritten periodically or it forgets.',
        formal: 'a bank is unavailable during its refresh, which costs a few per cent of bandwidth',
        detail: 'DRAM stores a bit as charge on a capacitor and the charge leaks, so every row '
          + 'must be refreshed every few dozen milliseconds. It costs a small and roughly '
          + 'constant fraction of the bandwidth, and it is deliberately not modelled here '
          + 'because it would move every number in the demo by the same amount and obscure the '
          + 'ones that differ. Its practical consequence is a periodic latency spike that '
          + 'real-time systems have to budget for.',
        example: 'Not modelled, and said rather than silently omitted.'
      }
    ],

    'numa-and-affinity': [
      {
        term: 'Memory is attached to a node and reaching another costs more',
        diagram: {
          definition: [
            'flowchart LR',
            '    C0["cores, node 0"] --> M0["memory 0: 80 cycles"]',
            '    C1["cores, node 1"] --> M1["memory 1: 80 cycles"]',
            '    C1 -->|"140 cycles"| M0',
            '    C0 -->|"140 cycles"| M1'
          ].join('\n'),
          caption: 'The diagonal is local. Everything else is the whole subject.'
        },
        plain: 'Local is fast, remote is not, and which you get depends on where the page is.',
        formal: 'the latency matrix is what numactl --hardware prints',
        detail: 'A ratio of about 1.75 between local and remote is representative for two '
          + 'sockets and gets worse across four. The effect is no longer confined to '
          + 'multi-socket machines: chiplets and sub-NUMA clustering produce the same asymmetry '
          + 'inside a single package, so the topology is worth checking on hardware that looks '
          + 'like one node from the outside.',
        example: 'The demo defaults to 80 cycles local and 140 remote, and the remote figure is '
          + 'a control.'
      },
      {
        term: 'First touch is the default and it is where the trouble comes from',
        plain: 'A page lands on the node of the thread that writes it first.',
        formal: 'placement is decided by the first writer, not by the eventual reader',
        detail: 'That rule is exactly right when the first writer is also the thread that will '
          + 'use the page, which is the common case for thread-local data. It is exactly wrong '
          + 'for the initialisation loop at the top of a parallel program, where one thread '
          + 'touches everything before any worker starts - and the placement decision has been '
          + 'made before anyone thought about placement.',
        example: 'The demo: all 64 pages on node 0, 50% locality, and 110 cycles per access '
          + 'against 80.'
      },
      {
        term: 'The classic mistake is a parallel-for over a fresh array',
        plain: 'Allocate, fill in one thread, then hand chunks to workers.',
        formal: 'every page is on the initialising thread\'s node, so every other worker is remote',
        detail: 'Nobody writes this misallocation; the runtime does. The array is allocated, '
          + 'the main thread zeroes or fills it, and the parallel loop then divides it - by '
          + 'which time every page has a home. The symptom is a program that does not scale '
          + 'rather than one that is slow, which is why it is so often diagnosed as lock '
          + 'contention or a bandwidth ceiling instead.',
        example: 'Moving the initialisation into the workers takes locality from 50% to 100% '
          + 'and the average access from 110 cycles to 80.'
      },
      {
        term: 'Interleaving is the answer when locality cannot be arranged',
        plain: 'Round-robin placement: mediocre for everyone, catastrophic for nobody.',
        formal: 'pages are spread across nodes by page number rather than by first touch',
        detail: 'For a shared structure that every thread touches, no placement makes everyone '
          + 'local, and interleaving at least uses the aggregate memory bandwidth of every node '
          + 'rather than saturating one. For a partitioned workload that could have been local '
          + 'it is a straight loss. That makes it the right default for one kind of data '
          + 'structure and the wrong one for another, which is why it is a policy rather than a '
          + 'fix.',
        example: 'On the partitioned workload interleaving gives the same 50% locality as the '
          + 'mistake it was meant to avoid.'
      },
      {
        term: 'Migration has to know when not to act',
        plain: 'Move a page that is persistently remote; refuse to move one that is shared.',
        formal: 'require a run of consecutive remote accesses from one node, and reset on any other',
        detail: 'Moving a page to the node that keeps asking for it is the easy half. The hard '
          + 'half is refusing to move a page that two nodes are alternating on, because a rule '
          + 'without that refusal shuttles it back and forth forever, paying the migration cost '
          + 'on every access and never getting a local one. The reset is what distinguishes an '
          + 'adaptive policy from a thrashing one.',
        example: 'The handoff pattern: 0% to 80% locality with 16 migrations. The alternating '
          + 'pattern: zero migrations.'
      },
      {
        term: 'Affinity is the other half of the rule',
        plain: 'Pinning a thread is what makes "where you will use it" stable.',
        formal: 'without affinity the scheduler can move the thread and make every access remote',
        detail: 'Placement is a statement about a pair - this page and that thread - and the '
          + 'operating system can invalidate it by moving either one. Arranging the first touch '
          + 'correctly and then letting the scheduler migrate the thread turns every local '
          + 'access into a remote one without a single page moving. That is why NUMA tuning is '
          + 'always two settings, and why the scheduling half belongs to M41.',
        example: 'Not modelled: the threads here are pinned by construction, which is the '
          + 'assumption the measurement rests on.'
      },
      {
        term: 'Diagnosing it takes one experiment and no code change',
        plain: 'If an interleaved policy makes the program faster, the problem was placement.',
        formal: 'a policy that makes everyone slightly worse helps only if some were much worse',
        detail: 'Sub-linear scaling with a healthy cache hit rate has at least three common '
          + 'causes - lock contention, a bandwidth ceiling and misplacement - and they look '
          + 'identical from the outside. Re-running under interleaved allocation discriminates '
          + 'cleanly: it can only help if the distribution of latencies was uneven, which is '
          + 'what misplacement means and what the other two do not.',
        example: 'One command, no recompilation, and a yes-or-no answer to a question that '
          + 'otherwise takes a profiler.'
      },
      {
        term: 'The same mistake appears wherever work is partitioned',
        plain: 'The thing that creates the data is not the thing that uses it.',
        formal: 'placement layers need to be told, and creation order is a poor proxy',
        detail: 'Sockets, racks, availability zones and shards all have a locality structure, '
          + 'and all of them have a default placement rule based on who touched something '
          + 'first. Data written by an ingest process and read by workers elsewhere, a shard '
          + 'key chosen by the writer, a cache warmed on one node - each is the same shape as '
          + 'the parallel-for, and each is diagnosed by asking who will read this rather than '
          + 'who wrote it.',
        example: 'The rule generalises unchanged: allocate where you will use it.'
      }
    ],

    'measuring-the-hierarchy': [
      {
        term: 'The machine will tell you its hierarchy if you time it properly',
        diagram: {
          definition: [
            'flowchart LR',
            '    S["sweep the working-set size"] --> W["walk each one, shuffled, several times"]',
            '    W --> D["discard the first pass, average the rest"]',
            '    D --> F["find the steps"]',
            '    F --> C["the size BELOW each step is a capacity"]'
          ].join('\n'),
          caption: 'Four steps and about fifty lines, and it recovers every capacity exactly.'
        },
        plain: 'Sweep the size, time the accesses, find the steps.',
        formal: 'the curve is flat while the working set fits and rises when it does not',
        detail: 'The method needs no documentation and no privileged access - only the ability '
          + 'to allocate memory and time an access - which makes it the first thing to run on '
          + 'unfamiliar hardware. It is also worth having built once for a reason beyond the '
          + 'numbers: every confounder it has to avoid is one that ruins benchmarks in every '
          + 'other subject too.',
        example: 'The demo recovers 32 KiB, 512 KiB and 8 MiB, matching the configuration '
          + 'exactly.'
      },
      {
        term: 'Associativity comes out of a conflict set',
        plain: 'Addresses one set-span apart all land in the same set.',
        formal: 'touch k addresses at stride sets x lineBytes; they all hit until k exceeds the ways',
        detail: 'The construction uses the same arithmetic that produced the performance cliff '
          + 'in 37.2, turned into an instrument. Every address of the form base plus k times '
          + 'the set span has the same index whatever k is, so a loop over k of them stays '
          + 'resident exactly while k is at most the number of ways. The largest k that still '
          + 'hits is the answer, and nothing about the machine has to be known to find it.',
        example: 'The demo recovers 8 ways, and reports the set size at which the misses '
          + 'started.'
      },
      {
        term: 'Line size comes out of a stride sweep',
        plain: 'The stride at which every access starts missing is the line size.',
        formal: 'while stride < lineBytes, several accesses share one fetch',
        detail: 'Walk a working set far too large to fit, at strides doubling from a few bytes. '
          + 'While the stride is smaller than a line, several accesses fall in each fetched '
          + 'line and the miss count is a fraction of the access count; once the stride reaches '
          + 'the line size every access is its own line and the miss count stops rising with '
          + 'the stride. The knee is the line size, and the working set has to be too large to '
          + 'fit or nothing misses at any stride.',
        example: 'The demo finds 64 bytes, which is the configured line size.'
      },
      {
        term: 'Almost all the difficulty is in what the benchmark must not do',
        plain: 'The loop is trivial; the controls are the work.',
        formal: 'each confounder answers a different question with the same code',
        detail: 'Order the chase and the prefetcher answers instead. Use a sequential walk and '
          + 'bandwidth answers instead. Include the first pass and compulsory misses lift every '
          + 'point. Share the machine and somebody else\'s workload is in the numbers. Those '
          + 'four account for a very large fraction of wrong benchmark results in every '
          + 'subject, and the demo makes each of them a switch so the wrong curves can be seen.',
        example: 'Switching the pattern to sequential removes every step and the discovery '
          + 'finds nothing at all.'
      },
      {
        term: 'Hardware counters are the other route and they lie differently',
        plain: 'A counter named for an event frequently counts a slightly different one.',
        formal: 'counters are sampled, are shared, and define their events in the manual rather than the name',
        detail: 'A "cache miss" counter may or may not include prefetches, speculative accesses '
          + 'or page-table walks, and which it does varies by generation. They are also sampled '
          + 'rather than exact and are affected by everything else on the machine. A timing '
          + 'measurement you designed and understand is often more trustworthy than a counter '
          + 'you did not, which is the opposite of the usual instinct.',
        example: 'The blind-spot table lists what the timing method cannot see, which is the '
          + 'same honesty applied in the other direction.'
      },
      {
        term: 'A result without its configuration is not a measurement',
        plain: 'State the pattern, the working set and the machine state.',
        formal: 'reproducibility requires the conditions, not only the number',
        detail: 'A latency figure without the access pattern could be a bandwidth figure. A '
          + 'bandwidth figure without the working set could be a cache measurement. A number '
          + 'from a machine with other work on it is a measurement of that work as well. This '
          + 'is the same discipline as the seeds and run counts everywhere else in the '
          + 'platform, and memory results are where it is most often skipped.',
        example: 'Every table in this milestone names the configuration it was measured under.'
      },
      {
        term: 'The translation reach can be mistaken for a cache capacity',
        plain: 'Both produce a step, at similar sizes, in the same curve.',
        formal: 'a step that moves when the page size changes was translation',
        detail: 'A 64-entry buffer over 4 KiB pages reaches 256 KiB, which sits between typical '
          + 'L1 and L2 capacities, so a step in the latency curve at that size could be either. '
          + 'The discriminating experiment is to repeat the sweep with huge pages: a step that '
          + 'moves was the translation reach and one that stays was a cache. That is one extra '
          + 'run and it resolves the ambiguity completely.',
        example: 'The blind-spot table lists it as the trap most likely to produce a confident '
          + 'wrong answer.'
      },
      {
        term: 'The same primitive is a side channel',
        plain: 'Timing an access to learn whether a line is resident.',
        formal: 'residency is observable through latency, whoever is asking',
        detail: 'This method and the Flush+Reload receiver in 36.8 do exactly the same thing: '
          + 'time an access and infer what the cache holds. Only the intent differs. That is '
          + 'worth noticing because it makes the leak a property of the hardware rather than a '
          + 'consequence of an attacker being clever - any machine whose access time depends on '
          + 'its cache state can be interrogated this way, and every useful cache has that '
          + 'property.',
        example: 'The associativity discovery here and the conflict-set construction in a '
          + 'Prime+Probe attack are the same code with different purposes.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
