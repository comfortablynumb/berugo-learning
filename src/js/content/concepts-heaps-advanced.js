/** Concepts for the amortised and systems heap sections (M05.5-M05.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'fibonacci-heaps': [
      {
        term: 'Do nothing until forced',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["insert"] --> B["drop the node in a root list. done."]',
            '    C["meld"] --> D["concatenate two root lists. done."]',
            '    E["decrease-key"] --> F["cut the node out, drop it<br/>in the root list. done."]',
            '    B --> G["extract-min is the only operation<br/>that ever tidies up"]',
            '    D --> G',
            '    F --> G'
          ].join('\n'),
          caption: 'Every cheap operation defers its work onto extract-min, which is the only one that pays. That is the whole design, and the reason decrease-key is O(1) amortised.'
        },
        plain: 'Insert drops a node in a root list. Meld concatenates two lists. Decrease-key cuts and drops. None of them tidies up.',
        formal: 'O(1) worst case for insert, meld and decrease-key',
        detail: [
          'The design principle is deferral.',
          'Every operation that can avoid restructuring does avoid it, leaving a root list that ' +
            'may be as long as the number of insertions.',
          'The mess is paid for exactly once, by the extract-min that finally has to find the ' +
            'minimum and cannot do it without consolidating.',
          'That is the same trade as a lazy hash table rehash or a deferred garbage collection. ' +
            'The amortised cost is excellent and the individual expensive operation is real.'
        ],
        example: 'Inserting a million elements does no linking at all; the first extract-min links all of them.'
      },
      {
        term: 'Consolidation',
        plain: 'Extract-min collapses the root list so no two roots share a degree, using an array indexed by degree.',
        formal: 'at most log_φ(n) + 1 roots afterwards',
        readAs: 'After a consolidation the root list is at most log of n taken to base φ (phi, the golden ' +
          'ratio, about 1.618), plus one. The golden ratio appears because the degree bound comes from ' +
          'a Fibonacci argument.',
        detail: [
          'The consolidation walks the root list, and for each root repeatedly links it with ' +
            'whatever root already occupies its degree slot. That is the binomial carry from ' +
            'M05.4, done all at once.',
          'Afterwards the root list has at most one tree per degree, so its length is bounded by ' +
            'the maximum degree, which is bounded by log_φ(n).',
          'The array has to be sized from that bound, and getting the bound wrong is the classic ' +
            'implementation bug. Too small, and the loop indexes past the end at a size nobody ' +
            'tested.'
        ],
        example: 'After a pop from a 40 000-node heap the root list held 5 trees with a maximum degree of 15.'
      },
      {
        term: 'The mark bit',
        plain: 'A node is marked when it loses a child while being a child. Losing a second one cuts it too.',
        formal: 'marked ⇒ has already lost one child since becoming a child',
        readAs: 'The mark on a node is a memory: it has lost one child since it was last made a child of ' +
          'someone. Losing a second one cuts the node loose too, which is what keeps the trees from ' +
          'being shredded.',
        detail: [
          'The mark is the bookkeeping that makes the amortised analysis work, and it has one rule ' +
            'that is easy to break. Only a child can be marked, so promoting a node to the root ' +
            'list must clear it.',
          'Miss that in extract-min — where the children of the removed minimum are all promoted — ' +
            'and you get marked roots, which is silently wrong rather than loudly broken.',
          'This platform hit exactly that bug, and the invariant check that says "a root is ' +
            'marked" is what caught it.'
        ],
        example: 'The children promoted by an extract-min must have their marks cleared, or a later cascade fires against nothing.'
      },
      {
        term: 'Cascading cuts',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a node loses a child"] --> B{"was it already marked?"}',
            '    B -->|no| C["mark it, and stop"]',
            '    B -->|yes| D["cut it to the root list too"]',
            '    D --> E["and now its parent has<br/>lost a child"]',
            '    E --> A'
          ].join('\n'),
          caption: 'A node may lose one child quietly. Losing a second means its subtree has thinned too far, so it is cut out — and the cascade is what keeps the trees fat enough for the bound.'
        },
        plain: 'Cutting a marked node cuts its parent too, and the parent\'s parent if that was marked, up the tree.',
        formal: 'a node of degree d keeps at least F(d + 2) descendants',
        readAs: 'A node with d children is guaranteed at least the (d+2)-th Fibonacci number of descendants ' +
          'underneath it. Since Fibonacci numbers grow like φ to the power of d, the degree can never ' +
          'exceed log base φ of n.',
        detail: [
          'Without the cascade a node could lose all of its children one at a time and keep a high ' +
            'degree while holding almost nothing. That would break the degree bound, and with it ' +
            'the analysis.',
          'The cascade limits each non-root node to losing one child before it is cut itself, ' +
            'which forces a degree-d node to retain at least F(d + 2) descendants.',
          'That is where the Fibonacci numbers come from, and where the name does. It gives the ' +
            'maximum degree bound of log_φ(n).'
        ],
        example: 'On the demo Dijkstra run, 7 029 cuts produced 1 569 cascading cuts.'
      },
      {
        term: 'The amortised bounds',
        plain: 'O(1) insert, meld and decrease-key; O(log n) extract-min. All amortised, by a potential function.',
        formal: 'Φ = trees + 2·marked nodes',
        readAs: 'The stored potential is the number of trees in the root list plus twice the number of marked ' +
          'nodes. Cheap operations add to it and the expensive consolidation spends it, which is what ' +
          'makes the amortised bounds come out.',
        detail: [
          'The potential counts the mess: one unit per root and two per marked node.',
          'An insert adds a root, and so pays one unit of potential on top of its constant work.',
          'A decrease-key that cuts adds a root and clears a mark, which is why the cascade is ' +
            'free in amortised terms. An extract-min discharges the accumulated potential by ' +
            'consolidating.',
          'The bounds are correct and the analysis is beautiful, and neither fact says anything ' +
            'about what the operations cost in nanoseconds.'
        ],
        example: 'Fredman and Tarjan introduced the structure to improve Dijkstra to O(E + V log V), which it does.'
      },
      {
        term: 'The theory–practice gap',
        plain: 'The Fibonacci heap does the fewest comparisons on Dijkstra and finishes last on the clock.',
        formal: 'operation counts confirm the bounds; wall clock contradicts them',
        detail: [
          'On a 22 500-node grid the Fibonacci heap performed 258 493 comparisons against a binary ' +
            'heap\'s 336 961. The theory is not wrong.',
          'It was also the slowest of the four queues measured.',
          'The reason is that comparisons are not what the run spends its time on. Each node ' +
            'carries six fields, every one of them a pointer into scattered memory, and the ' +
            'consolidation walks a degree array per pop.',
          'Being able to show both columns is more persuasive than knowing either.'
        ],
        example: 'Fewest comparisons and slowest wall clock, on the same run, on the same graph.'
      },
      {
        term: 'Where it does win',
        plain: 'Meld is genuinely O(1) — two circular lists spliced with four pointer writes.',
        formal: 'no other family melds in constant time',
        detail: [
          'The one bound no competitor matches is the meld.',
          'A leftist or binomial heap melds in O(log n), and an array heap cannot meld at all.',
          'A Fibonacci heap concatenates two circular doubly linked lists and compares two minimum ' +
            'pointers, which is four writes and one comparison regardless of size.',
          'If an algorithm melds heaps in a loop — some minimum-spanning-tree and clustering ' +
            'algorithms do — that is where the structure earns its place. The argument is about ' +
            'meld rather than about decrease-key.'
        ],
        example: 'Melding two million-element heaps costs four pointer writes and one comparison.'
      },
      {
        term: 'What to take from it',
        plain: 'It is a proof technique that happens to be implementable, and it is the right way to read the paper.',
        formal: 'an existence result for the bound, not an engineering recommendation',
        detail: [
          'Fredman and Tarjan built the structure to prove that Dijkstra could run in ' +
            'O(E + V log V), and it does.',
          'That is a theorem about what is possible, and it was worth proving whether or not ' +
            'anyone shipped it.',
          'The engineering lesson is separate and just as useful. An amortised bound is a ' +
            'statement about a cost model. If your cost model counts comparisons while your ' +
            'machine charges for cache misses, the bound can be right and the recommendation ' +
            'wrong.',
          'The next section is the structure that took the idea and made it practical.'
        ],
        example: 'Larkin, Sen and Tarjan measured the whole family and concluded the simple structures win.'
      }
    ],

    'pairing-heaps': [
      {
        term: 'One primitive: link',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["compare two roots"] --> B["the loser becomes the winner\'s<br/>newest child"]',
            '    B --> C["insert = link with a single node"]',
            '    B --> D["meld = link two roots"]',
            '    B --> E["decrease-key = cut out, then link"]',
            '    C --> F["one operation, and everything<br/>else is a line on top of it"]',
            '    D --> F',
            '    E --> F'
          ].join('\n'),
          caption: 'A Fibonacci heap needs marks, degrees and cascading cuts to reach its bound. This reaches nearly the same one from a single comparison rule.'
        },
        plain: 'Compare two roots; the loser becomes the winner\'s newest child. Everything else is built from that.',
        formal: 'insert = link; meld = link; decrease-key = cut then link',
        detail: [
          'A pairing heap is a single multiway tree in heap order, and its whole structural ' +
            'vocabulary is one operation.',
          'Insert links a new node with the root. Meld links two roots. Decrease-key cuts the node ' +
            'out of its parent\'s child list and links it back at the top.',
          'None of these needs a degree, a mark, a rank or a consolidation array.',
          'The node has a key, a child pointer and two sibling pointers, and that is the entire ' +
            'representation.'
        ],
        example: 'A pairing-heap node has four fields; a Fibonacci-heap node has six and a mark bit.'
      },
      {
        term: 'The two-pass merge',
        plain: 'Pop orphans the root\'s children. Pair them left to right, then fold the pairs right to left.',
        formal: 'pass one pairs adjacent siblings; pass two accumulates',
        detail: [
          'This is the only operation that does more than one link, and its shape is the entire ' +
            'design.',
          'The first pass walks the child list linking each adjacent pair, which halves the list ' +
            'and — crucially — does so without building a chain.',
          'The second pass folds the results from the right.',
          'Both passes together do the same number of links as the naive fold, so the cost is not ' +
            'in the count. It is in the shape left behind, which the next pop has to walk.'
        ],
        example: 'Eight children become four pairs, then one tree three levels deep rather than a spine seven deep.'
      },
      {
        term: 'Why pairing first matters',
        plain: 'A single left-to-right fold builds a spine, and the next pop pays for it. The pairing pass is not optional.',
        formal: 'one-pass merge degrades to Θ(n) behaviour',
        readAs: 'Pairing heaps get their bound from merging siblings two at a time before folding them ' +
          'together. Skip that first pass and the structure degenerates into a list.',
        detail: [
          'Folding the children left to right in one pass links each child under the accumulated ' +
            'result, which produces a path rather than a tree. The following pop has to walk that ' +
            'path.',
          'The pairing pass breaks the list into independent pairs first, so the result is bushy.',
          'Measured over 30 000 balanced operations the two-pass merge did 46 189 comparisons ' +
            'against the one-pass version\'s 55 856, and the gap widens as the workload leans on ' +
            'pop.',
          'The demo keeps the one-pass version as a control for exactly this reason.'
        ],
        example: 'Two-pass: 46 189 comparisons. One-pass, same operations: 55 856 — 17% more.'
      },
      {
        term: 'The open bounds',
        plain: 'O(log n) amortised is proved for everything. decrease-key sits between Ω(log log n) and O(log n), and nobody has closed it.',
        formal: 'Fredman et al. 1986; the lower bound is Fredman 1999',
        detail: [
          'The pairing heap is the rare structure whose practical status is settled and whose ' +
            'theory is not.',
          'Every operation is O(log n) amortised, which is enough for it to be a sound choice.',
          'The precise cost of decrease-key has resisted analysis for forty years. It is known not ' +
            'to be O(1), and it is not known to be worse than O(log log n) in practice.',
          'Measurements consistently behave as if it were constant, which is why the structure ' +
            'wins benchmarks that the analysis says it should lose.'
        ],
        example: 'Its decrease-key is provably not O(1) and measurably indistinguishable from it.'
      },
      {
        term: 'Against the Fibonacci heap',
        plain: 'Fewer fields, no consolidation, no marks, and it wins the measurements the Fibonacci heap was built for.',
        formal: 'four fields per node against six plus a mark',
        detail: [
          'The pairing heap is what a Fibonacci heap becomes when the bookkeeping is replaced by ' +
            'self-adjustment. It is the same relationship splay trees have to AVL trees.',
          'It gives up the O(1) decrease-key bound and keeps the behaviour. It gives up the degree ' +
            'array and the mark bit and keeps the performance.',
          'On the demo\'s Dijkstra run it did 278 257 comparisons against the Fibonacci heap\'s ' +
            '258 493, and finished faster.',
          'The comparison count was never the bottleneck.'
        ],
        example: 'boost::heap and LEDA both ship pairing heaps as the practical decrease-key structure.'
      },
      {
        term: 'Rank-pairing heaps',
        plain: 'Add a rank field and a repair rule, and the O(1) decrease-key bound comes back — with the simplicity mostly intact.',
        formal: 'Haeupler, Sen, Tarjan 2011',
        detail: [
          'Rank-pairing heaps were designed to get the Fibonacci bounds out of a ' +
            'pairing-heap-shaped structure.',
          'Each node carries a rank, decrease-key cuts and then repairs ranks along a path, and ' +
            'the analysis recovers O(1) amortised decrease-key with O(log n) extract-min.',
          'They are simpler than Fibonacci heaps and measurably competitive, and they are still ' +
            'rarely used.',
          'That says something about how much of a structure\'s adoption is decided by what is ' +
            'already in the standard library.'
        ],
        example: 'They achieve the Fibonacci bounds with one integer per node and no mark bit.'
      },
      {
        term: 'Cutting is cheap because nothing is repaired',
        plain: 'decrease-key unlinks the node and links it at the root. There is no cascade and no invariant to restore.',
        formal: 'two pointer updates and one comparison',
        detail: [
          'A Fibonacci heap\'s decrease-key has to consider the mark, possibly cascade, and ' +
            'possibly update the minimum — a handful of branches on a cold path.',
          'A pairing heap\'s splices the subtree out of its sibling list and links it with the ' +
            'root, and that is all. No mark to check, no parent to visit beyond the splice, no ' +
            'bound to preserve.',
          'Measured on a decrease-key-heavy mix it did 93 946 comparisons against the Fibonacci ' +
            'heap\'s 106 945, with 11 923 cuts against 7 029 cuts plus 1 569 cascades.'
        ],
        example: 'A pairing decrease-key touches the node, its two siblings and the root — five pointers, no branches on a mark.'
      },
      {
        term: 'When to reach for it',
        plain: 'When decrease-key matters and the structure is not an array heap. Otherwise use the array heap.',
        formal: 'the practical decrease-key queue',
        detail: [
          'The decision tree is short.',
          'If the workload is pushes and pops, use a binary or 4-ary array heap. Nothing beats one ' +
            'allocation and perfect locality.',
          'If it needs decrease-key and the handle map of an indexed array heap is unwelcome, use ' +
            'a pairing heap. If it needs constant-time meld in a loop, use a Fibonacci heap and ' +
            'accept the constants.',
          'The case for a Fibonacci heap over a pairing heap on decrease-key alone is one the ' +
            'measurements do not support.'
        ],
        example: 'Most "we used a Fibonacci heap" codebases should have used a pairing heap, and the benchmarks agree.'
      }
    ],

    'indexed-priority-queues': [
      {
        term: 'The handle problem',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["decrease-key needs to find<br/>the element first"] --> B["a heap is an array in<br/>no order you can search"]',
            '    B --> C["scanning it is O(n),<br/>which loses the whole point"]',
            '    C --> D["so keep a map from handle to slot,<br/>updated on every swap"]'
          ].join('\n'),
          caption: 'Decrease-key is why an indexed heap exists. Without a handle map the find dominates, and the O(log n) decrease is O(n) in practice.'
        },
        plain: 'decrease-key needs to find the element first, and a heap is an array in no useful order.',
        formal: 'locating an arbitrary key is Θ(n) without an index',
        readAs: 'A heap can find its minimum instantly and any other element not at all. Changing a specific ' +
          'key needs a separate map from key to position, kept in step with every swap.',
        detail: [
          'Every statement of the decrease-key bound quietly assumes you already hold a pointer to ' +
            'the node.',
          'In an array heap you do not. The element for node 4 711 is at whatever slot the sifts ' +
            'have left it in, and finding it means scanning.',
          'That turns an O(log n) operation into an O(n) one, and makes the whole idea pointless.',
          'So an indexed priority queue is not an optimisation but the precondition for the ' +
            'operation existing at all.'
        ],
        example: 'Without a position map, Dijkstra with decrease-key is O(V²) rather than O(E log V).'
      },
      {
        term: 'The position map',
        plain: 'A third array: handle → slot, updated on every swap the heap makes.',
        formal: 'positions[ids[i]] === i, for every i',
        readAs: 'The index and the heap agree: whatever id sits at heap position i, the index maps that id ' +
          'back to i. Every swap has to update both, and this is the invariant a bug in that update ' +
          'breaks.',
        detail: [
          'The map is the whole mechanism, and the invariant is one line: the slot recorded for a ' +
            'handle is the slot that actually holds it.',
          'Maintaining it means every swap writes three things rather than two, which is a real ' +
            'cost on the hottest path in the structure.',
          'The invariant is also the thing to assert in tests, because a stale entry does not ' +
            'crash. It silently decreases the wrong element, and the algorithm above happily ' +
            'produces a wrong answer that looks plausible.'
        ],
        example: 'A missed position update makes decreaseKey edit a neighbour\'s key, and Dijkstra returns short distances.'
      },
      {
        term: 'Lazy insertion',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a better key arrives for<br/>something already in the queue"] --> B["do not decrease anything —<br/>just push a second entry"]',
            '    B --> C["when a stale entry pops,<br/>recognise it and skip it"]',
            '    C --> D["no position map, no handles,<br/>and a larger queue"]'
          ].join('\n'),
          caption: 'It does more total work and usually still wins on the clock, because the position map it removes was costing a write on every single swap the heap made.'
        },
        plain: 'Do not decrease anything: push a second entry with the better key and ignore the stale one when it surfaces.',
        formal: 'push on improvement, skip on pop if already settled',
        detail: [
          'The alternative removes the handle map entirely.',
          'When a shorter path is found, push a new entry rather than editing the old one.',
          'When a pop produces a node that has already been settled — or whose key is worse than ' +
            'the recorded distance — discard it and pop again.',
          'The structure needs nothing beyond push and pop, so any heap works, and the code is ' +
            'shorter than the indexed version by the entire position map.',
          'This is what most shipped Dijkstra implementations actually contain.'
        ],
        example: 'On the demo graph, lazy insertion pushed 29 573 entries and discarded 7 073 of them as stale.'
      },
      {
        term: 'What lazy costs',
        plain: 'More pushes, more comparisons, a larger queue — and it still usually wins on the clock.',
        formal: 'queue bounded by E rather than V',
        detail: [
          'The lazy version does more of everything the counters measure. On a 22 500-node grid it ' +
            'pushed 29 573 entries against 22 500, made 444 333 comparisons against 336 961, and ' +
            'peaked at 398 queue entries against 291.',
          'It finished first anyway, because none of its operations touch a hash map and its heap ' +
            'is a plain array.',
          'That is the same lesson as M05.5 from the other direction. The counter and the clock ' +
            'disagree, and which one matters depends on what the machine is actually charging for.'
        ],
        example: '32% more comparisons, 37% larger queue, and faster in wall clock on the same graph.'
      },
      {
        term: 'The unbounded queue',
        plain: 'A lazy queue grows with the number of improvements, not the number of nodes — and nothing stops it.',
        formal: 'worst case one entry per edge',
        detail: [
          'This is the failure mode people forget.',
          'The indexed queue holds at most one entry per node, so its memory is bounded by V and ' +
            'cannot surprise you.',
          'The lazy queue holds one entry per improvement, which on a dense graph approaches E — ' +
            'an order of magnitude more — and on a pathological input, more still.',
          'Nothing in the algorithm notices until the allocator does. The fix is not to abandon ' +
            'the technique but to bound it: cap the queue, or fall back to the indexed form above ' +
            'a threshold.'
        ],
        example: 'On a dense graph the lazy queue can hold |E| entries where the indexed one holds |V|.'
      },
      {
        term: 'Stale-entry detection',
        plain: 'Two checks: has this node been settled, and is this key worse than the best known?',
        formal: 'if (done[v]) skip; if (key > distance[v]) skip',
        detail: [
          'Both checks are needed and they catch different things.',
          'The settled check discards entries for nodes already finalised, which is the common ' +
            'case.',
          'The key check discards entries superseded by a later improvement for a node not yet ' +
            'settled: the second push made the first obsolete.',
          'Omitting the second is a subtle bug. The algorithm still terminates and still produces ' +
            'correct distances, but it relaxes edges from stale distances and does measurably more ' +
            'work.'
        ],
        example: 'The demo counted 7 073 stale pops out of 29 573 pushes — a quarter of the queue traffic.'
      },
      {
        term: 'Handles beyond Dijkstra',
        plain: 'Anything that changes a queued item\'s priority needs one: schedulers, event loops, cache eviction.',
        formal: 'update-in-place requires identity',
        detail: [
          'The pattern generalises past graph algorithms.',
          'Think of a scheduler that reprioritises a runnable task, an event loop that reschedules ' +
            'a timer, or an LRU-with-priorities cache that promotes an entry. All of them need to ' +
            'reach into the queue and change something.',
          'All of them face the same choice. Either give the structure identity through a handle ' +
            'map, or make entries immutable and tolerate duplicates.',
          'Which is right depends on whether the memory or the code is the scarcer resource.'
        ],
        example: 'A timer reschedule is a decrease-key, and the same lazy-versus-indexed decision applies.'
      },
      {
        term: 'The simpler option is usually right',
        plain: 'Lazy insertion is faster and shorter. Reach for the indexed heap when the memory bound matters.',
        formal: 'simplicity is a measurable property',
        detail: [
          'The indexed heap is the version in the textbooks and the lazy one is the version in the ' +
            'repositories, and the measurements support the repositories.',
          'The honest decision rule is about the queue size rather than the speed.',
          'If the graph is sparse and the queue stays small, take the simpler code. If the graph ' +
            'is dense, or the input is adversarial, or the memory ceiling is real, pay for the ' +
            'handle map.',
          'Either way, measure the peak queue size. It is the number the choice actually turns on.'
        ],
        example: 'The peak queue size is the metric to instrument, because it is the one that fails a machine.'
      }
    ],

    'timers-and-events': [
      {
        term: 'Timers are not a heap problem',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a heap answers:<br/>what is the smallest key?"] --> B["exactly, and in log n"]',
            '    C["a timer only needs:<br/>what is due this tick?"] --> D["a bucket per tick answers it<br/>in constant time"]',
            '    D --> E["exactness was never required,<br/>so it was never worth paying for"]'
          ].join('\n'),
          caption: 'The heap is solving a harder question than the one being asked. Dropping the ordering you do not need is what turns log n into O(1).'
        },
        plain: 'A heap answers "what is the smallest key" exactly. A timeout only needs "what is due this tick".',
        formal: 'quantised time turns a search into an array index',
        detail: 'The whole insight is that a timeout can afford to be imprecise. Once time is ' +
          'quantised into ticks, a timer does not need to be found by comparison — it can be filed ' +
          'in the bucket for the tick it is due, and expiry becomes "walk one bucket". Adding is an ' +
          'array index, cancelling is a flag, and no comparison is performed anywhere. That is why ' +
          'kernels file timeouts in wheels and why a heap, which answers a harder question, charges ' +
          'for the difference.',
        example: 'Over 100 000 timers, the heap made 3 059 313 comparisons and the wheel made none.'
      },
      {
        term: 'The simple wheel',
        plain: 'One array of buckets, indexed by due tick modulo the wheel width. Timers further out ride round again.',
        formal: 'slot = due mod slots',
        readAs: 'A timer\'s bucket is its due time wrapped around the number of slots — the remainder after ' +
          'dividing. That turns "find the next timer" from a search into an array index.',
        detail: 'A single wheel of s slots covers s ticks exactly. A timer due further out is filed in ' +
          'the slot it will eventually land on and skipped on each earlier visit, so a long-dated ' +
          'timer is touched once per revolution. That is fine when the delays are short and uniform ' +
          'and wasteful when they are not — which is what the hierarchical version fixes. The ' +
          'implementation trap is the revolution counter: a delay that is an exact multiple of the ' +
          'wheel width lands in the slot it was filed from, so the first visit is the due tick, and ' +
          'a naive counter is off by one revolution.',
        example: 'A 4 096-slot wheel over 100 000 timers touched 20 entries per tick — one bucket\'s worth.'
      },
      {
        term: 'Hierarchical wheels',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["wheel 1 — one bucket per tick"] --> B["wheel 2 — one bucket per<br/>full turn of wheel 1"]',
            '    B --> C["wheel 3 — one bucket per<br/>full turn of wheel 2"]',
            '    C --> D["a far-future timer waits in<br/>a coarse wheel"]',
            '    D --> E["and cascades down as its time nears"]'
          ].join('\n'),
          caption: 'The same trick as positional notation: a few wheels of modest width cover an enormous range, and each timer is only handled once per level.'
        },
        plain: 'Several wheels, each covering the span of the one below times its width. Entries cascade down as time passes.',
        formal: 'level L spans slots^(L+1) ticks',
        readAs: 'Each level of a hierarchical timer wheel covers the number of slots raised to one more ' +
          'power, so a handful of levels covers an enormous range at one tick of resolution.',
        detail: 'The hierarchy is the same idea as a clock face: seconds, minutes, hours. A timer due ' +
          'a long time out is filed on a coarse wheel, and when the finer wheels wrap past it, the ' +
          'coarse bucket is emptied and its entries refiled where they now belong. Each timer ' +
          'cascades at most once per level, so the cost is O(levels) rather than O(revolutions), and ' +
          'the total span is slots^levels — five levels of 64 covers a billion ticks. Linux uses ' +
          'exactly this shape.',
        example: 'A 2 × 64 wheel touched 12.23 entries per tick against the flat wheel\'s 20.00, at the cost of cascades.'
      },
      {
        term: 'Cancellation is the common case',
        plain: 'Most timeouts are cancelled before they fire, so cancel has to be cheap and expiry has to tolerate corpses.',
        formal: 'flag it, and drop it when the bucket is next walked',
        detail: 'A timeout is usually set in the hope that it will not fire — the request arrives, ' +
          'the timer is cancelled, and the entry becomes a corpse. Removing it from the middle of a ' +
          'bucket costs the bucket length, so real implementations mark it instead and let the next ' +
          'walk drop it for free. A heap has the same choice and a worse version of it: a cancelled ' +
          'entry cannot be removed cheaply either, so it is carried until it surfaces at the root, ' +
          'which is a longer wait and more memory.',
        example: 'With half the timers cancelled, the wheel drops corpses during a bucket walk it was doing anyway.'
      },
      {
        term: 'Bounded precision as a feature',
        plain: 'A wheel cannot distinguish two timers in the same tick. That is exactly what a timeout does not need.',
        formal: 'resolution = one tick, chosen by the caller',
        detail: 'The trade is explicit and it is the right one for the workload. A network timeout of ' +
          '30 seconds does not care about a millisecond, and a keepalive does not care about ten. ' +
          'Choosing the tick sets the precision, the memory (slots × levels) and the per-tick cost ' +
          'all at once, and a system with a known deadline distribution can size it exactly. Where ' +
          'precision genuinely matters — a discrete-event simulation, a real-time scheduler — the ' +
          'heap comes back, because there is nothing legitimate to quantise.',
        example: 'Linux uses a 1 ms tick for its timer wheels and a separate hrtimer red-black tree for anything finer.'
      },
      {
        term: 'The event-simulation clock',
        plain: 'Simulated time jumps to the next event, so the cost is the number of events rather than the length of the interval.',
        formal: 'the priority queue is the clock',
        detail: 'A discrete-event simulation never advances time in steps. It pops the earliest ' +
          'scheduled event, sets the clock to that timestamp, runs the handler — which typically ' +
          'schedules more events — and repeats. Nothing is computed for the gaps, so simulating an ' +
          'hour of a quiet system costs almost nothing and simulating a busy millisecond costs a ' +
          'lot. This is the case where a heap is the right structure, because event times are ' +
          'arbitrary reals and there is nothing to bucket them into.',
        example: 'The M/M/1 demo simulates 200 000 time units in about 320 000 events.'
      },
      {
        term: 'Tie-breaking and reproducibility',
        plain: 'Two events at the same instant must be ordered by something, or the simulation depends on heap internals.',
        formal: 'key = (time, sequence number)',
        detail: 'A heap makes no promise about equal keys, so two events scheduled for the same ' +
          'timestamp can come out in either order — and if the handlers interact, the whole ' +
          'simulation becomes irreproducible for reasons that have nothing to do with the model. The ' +
          'fix is to extend the key with a monotonically increasing sequence number, which makes the ' +
          'order deterministic and documents that it is insertion order. Any simulation that cannot ' +
          'be replayed exactly is a simulation whose bugs cannot be found.',
        example: 'This kernel keys events by time × 10⁶ + sequence, so a replay is exact.'
      },
      {
        term: 'Little\'s law, from the other side',
        plain: 'The simulation reproduces L = λ·W to four decimal places, which is what makes it trustworthy.',
        formal: 'L = λ·W; L = ρ/(1 − ρ); W = 1/(μ − λ)',
        readAs: 'Three queueing results: the number in the system equals arrival rate times time spent (true ' +
          'of any queue at all); for this particular model that number is utilisation over one minus ' +
          'utilisation; and the wait is one over the slack between service and arrival rates. The 1 − ρ ' +
          'in the denominator is why a queue at 99% utilisation is a hundred times worse than one at ' +
          '90%.',
        detail: 'M02.5 introduced Little\'s law as a measurement tool that needs no assumptions. Here ' +
          'it is a check on the simulator: measure the time-average number in the system, the ' +
          'per-customer average time in the system, and the arrival rate, and the three must satisfy ' +
          'L = λ·W exactly. They do, to four decimals, at every utilisation — and the measured L and ' +
          'W also match the closed forms ρ/(1 − ρ) and 1/(μ − λ) to about one percent. A simulator ' +
          'that reproduces a known result is one you can point at an unknown one.',
        example: 'At ρ = 0.9 the simulation measured L = 8.871 against a predicted 9.000, and L ÷ (λ·W) = 1.0000.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
