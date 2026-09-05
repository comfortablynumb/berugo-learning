/** Concepts for the persistence sections (M09.1-M09.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'persistence-basics': [
      {
        term: 'Immutability is a promise; persistence is a property',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["immutable"] --> B["nobody is allowed<br/>to change this value"]',
            '    C["persistent"] --> D["every past version still exists<br/>and can still be queried"]',
            '    B --> E["you can be immutable and keep<br/>no history at all"]',
            '    D --> F["and persistence is what makes<br/>undo and time travel free"]'
          ].join('\n'),
          caption: 'The words get used interchangeably and mean different things. One is a restriction on writers; the other is a guarantee to readers about the past.'
        },
        plain: 'Immutable means nobody may change it. Persistent means every past version is still there and still answerable.',
        formal: 'partial: query any version, update the latest. full: update any version. confluent: merge two versions.',
        detail: [
          'The two words get used interchangeably and they are not the same claim.',
          'A frozen array is immutable and not persistent: update it and the old contents are gone ' +
            'unless you copied them.',
          'A persistent structure keeps the old version *cheaply*, which is a statement about ' +
            'representation rather than about the API.',
          'The distinction matters the moment somebody asks "what did this look like an hour ago". ' +
            'Immutability alone gives you no way to answer, and the three grades of persistence are ' +
            'exactly how much of that question you can afford.'
        ],
        example: '400 updates to a 344-key tree: every one of the 400 versions still answers, from 3 918 nodes in total.'
      },
      {
        term: 'Path copying: rebuild the path, share everything else',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["change one leaf"] --> B["copy that leaf"]',
            '    B --> C["copy its parent, pointing at the copy"]',
            '    C --> D["up to a new root"]',
            '    D --> E["every subtree hanging off that path<br/>is shared, not copied"]',
            '    E --> F["so a new version costs the depth,<br/>not the size"]'
          ].join('\n'),
          caption: 'The old root still describes the old tree perfectly, because nothing it pointed at was touched. That is what makes the previous version survive for free.'
        },
        plain: 'An update copies only the nodes from the changed leaf up to the root; every subtree off that path is shared.',
        formal: 'O(depth) new nodes per update, and queries cost exactly what the ephemeral structure costs',
        detail: [
          'This is the method behind every immutable collection library, and its appeal is that ' +
            'nothing about the read path changes.',
          'The new root points at a mixture of new and old nodes, and a query cannot tell the ' +
            'difference.',
          'The cost is the whole path, every time, which is where the folk claim that "immutable is ' +
            'slow" comes from.',
          'That claim is about allocation rather than about asymptotics, because a path is a ' +
            'logarithm and a copy is a linear scan.'
        ],
        example: 'Depth 18, and 13.12 nodes allocated per update - one path plus the rotations that rebalanced it.'
      },
      {
        term: 'Fat nodes: never copy, version-stamp instead',
        plain: 'Give each pointer field a list of (version, value) entries and append rather than overwrite.',
        formal: 'O(1) space per change; a query binary-searches a version list at every step',
        detail: [
          'This is the cheapest possible thing to do on the write side, and it is not free.',
          'The information has to go somewhere, and it goes into the read path.',
          'Every pointer traversal becomes a binary search over that field\'s history, so a query ' +
            'costs O(log n · log versions) instead of O(log n).',
          'It is the right choice when versions vastly outnumber queries, and the wrong one ' +
            'whenever reads dominate. Reads dominate most of the time, which is why path copying is ' +
            'what libraries ship.'
        ],
        example: '344 node objects for 400 versions - nothing is ever copied - at 3 574 appended field entries.'
      },
      {
        term: 'Node copying: one spare box, and a cascade',
        plain: 'Give each node one extra modification slot. Fill it on the first change; on the second, copy the node and tell the parent.',
        formal: 'O(1) amortised space per update with no query slowdown (Driscoll, Sarnak, Sleator, Tarjan)',
        detail: [
          'The point of the spare slot is that most changes fit in it, so most updates allocate ' +
            'nothing at all.',
          'When one does not fit, the node is copied with the box applied and the parent has to be ' +
            'redirected to the copy.',
          'That may fill the parent\'s box, or overflow it and cascade further.',
          'The result is the best of both: a query walks ordinary pointers, and the space is ' +
            'constant per update amortised.',
          'The cascade is the part worth measuring rather than believing, because its rarity is the ' +
            'entire argument.'
        ],
        example: '1 861 boxes filled and 1 713 cascades over 400 updates - 5.14 nodes allocated per update against path copying\'s 13.12.'
      },
      {
        term: 'Sharing is measured in distinct nodes, not allocations',
        plain: 'Count the node objects reachable from any version; that is what keeping the history actually costs.',
        formal: 'distinct nodes ≪ versions × size is the claim; anything else is not sharing',
        readAs: 'If persistence is working, the total nodes ever allocated is far below the number of ' +
          'versions times the size of each — that is what ≪ means. If it is not far below, every ' +
          'version has quietly been copied whole.',
        detail: [
          'Counting allocations flatters the fat-node method, which allocates almost nothing and ' +
            'grows its existing nodes instead.',
          'Counting only the latest version flatters everything, because the latest version is one ' +
            'tree.',
          'The honest number is how many distinct objects the whole history holds.',
          'Comparing that against what copying every version would have cost is the only way to see ' +
            'whether the structure is sharing or merely deferring.'
        ],
        example: '400 versions of a 344-key tree: 156 720 bytes by path copying against 5 504 000 for full copies - 35× less.'
      },
      {
        term: 'The read path is where the cost hides',
        plain: 'Every persistence method moves work somewhere; only path copying leaves the query untouched.',
        formal: 'path copying O(log n); fat node O(log n · log v); node copying O(log n)',
        readAs: 'Three ways to make a structure persistent and what each costs per query. Path copying is the ' +
          'simplest and the one to reach for; fat nodes add a second log because every field read has ' +
          'to search a version list.',
        detail: [
          'This is the axis that decides the choice in practice, and it is invisible in a table of ' +
            'space costs.',
          'A structure that is read a thousand times per write wants the cheapest possible query, ' +
            'and will happily pay a path per update.',
          'A structure recording an audit log that is almost never read wants the opposite.',
          'Writing the two costs down side by side turns "which method" from a matter of taste into ' +
            'arithmetic over your own read/write ratio.'
        ],
        example: 'Fat nodes save 2.05× the memory of path copying and add a binary search to every pointer hop.'
      },
      {
        term: 'A rotation is a structural change like any other',
        plain: 'Rebalancing during a persistent update copies the rotated nodes too, which is why the per-update count exceeds the depth.',
        formal: 'a treap insert is one path plus O(1) expected rotations, each rebuilding two nodes',
        detail: [
          'It is tempting to state "path copying costs exactly the depth", and it is not quite true ' +
            'for any balanced tree.',
          'The rebalancing that keeps the depth logarithmic is itself a set of pointer changes on ' +
            'that path.',
          'The measured figure is a small multiple of the depth rather than the depth. Quoting the ' +
            'clean version is the kind of small dishonesty that makes a later measurement look ' +
            'like a bug.',
          'Hashed priorities are used here so the shape depends on the key set and not the arrival ' +
            'order.'
        ],
        example: '13.12 nodes per update at depth 18 - the path, plus the rotations that kept it at 18.'
      },
      {
        term: 'Garbage collection is what turns persistence into MVCC',
        plain: 'A database keeps old versions the same way, and adds a rule for when they may be dropped.',
        formal: 'a version is collectable once no reader can still reach it',
        detail: [
          'Snapshot isolation, time-travel queries and copy-on-write filesystems are all this ' +
            'structure with a reachability rule attached.',
          'Keep every version, and free the nodes that no live snapshot can still see.',
          'That is why the space accounting here is not academic. It is the thing a database ' +
            'operator is watching when a long-running transaction stops old versions from being ' +
            'freed and the table doubles in size.',
          'The structure is the easy half; deciding when a version dies is the hard one.'
        ],
        example: 'Every version here is retained deliberately; a real system frees them and calls the result MVCC.'
      }
    ],

    'persistent-sequences': [
      {
        term: 'Cons lists are persistent for free',
        plain: 'Prepending to a singly linked list creates one cell and shares the entire tail.',
        formal: 'cons is O(1) space and O(1) time, and every previous list is still intact',
        detail: [
          'This is why functional languages default to them, and why they are the wrong default ' +
            'for almost everything else.',
          'The one operation that is free is the one at the front, and indexing, appending and ' +
            'concatenating are all linear.',
          'The interesting question is not how to make a list persistent - it already is.',
          'It is how to get a *queue*, where the natural implementation needs both ends and the ' +
            'cheap end is only one of them.'
        ],
        example: 'A queue built from two lists is the standard answer, and persistence is what breaks it.'
      },
      {
        term: 'Persistence destroys amortised analysis',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["an expensive operation<br/>pays off saved credit"] --> B["in a normal structure that<br/>version is gone — it cannot recur"]',
            '    C["in a PERSISTENT structure the old<br/>version is still there"] --> D["trigger the expensive step<br/>again from it"]',
            '    D --> C',
            '    D --> E["the same credit is spent<br/>over and over"]'
          ].join('\n'),
          caption: 'Amortised bounds assume the past cannot be revisited. Persistence makes that assumption false, which is why persistent structures need worst-case bounds or lazy evaluation.'
        },
        plain: 'An expensive operation can be paid for once and then re-triggered from the same old version forever.',
        formal: 'the credit argument assumes each version is used once; persistence removes that assumption',
        detail: [
          'This is the most important idea in the section and it is not a subtlety.',
          'A two-list queue amortises its O(n) reversal against the n cheap pushes that preceded ' +
            'it, which is a valid argument exactly when each of those pushes happens once.',
          'Hold on to the version just before the reversal and call `tail` on it a thousand times, ' +
            'and you pay the reversal a thousand times while earning its savings once.',
          'The bound is not merely hard to prove; it is false.'
        ],
        example: 'One pre-rotation version reused 1 000 times: 510.00 steps per reuse against the banker\'s queue\'s 1.50.'
      },
      {
        term: 'A memoised suspension repairs it',
        plain: 'Make the expensive rotation a lazy value that remembers its result, and every version that forces it shares the answer.',
        formal: 'Okasaki\'s banker\'s queue: amortised O(1) even under arbitrary reuse',
        detail: [
          'The repair is precise. The rotation becomes a thunk stored in the queue, so the thousand ' +
            'reuses all point at the *same* suspension. The first one to force it pays for all of ' +
            'them.',
          'Note what is doing the work: the memo, not the laziness.',
          'A lazy value without memoisation recomputes on every force and behaves exactly like the ' +
            'strict queue.',
          'That is why "use lazy evaluation" is not the lesson and "share the computation" is.'
        ],
        example: '1 000 reuses force the suspension 8 times and hit the memo 1 518 times: 1.50 steps per reuse.'
      },
      {
        term: 'Amortised is not worst case, and laziness does not fix that',
        plain: 'The banker\'s queue still has a single operation that pays for the whole rotation.',
        formal: 'measured worst operation: strict 511 steps, banker 1 014, real-time 2',
        detail: [
          'This is the result that surprises people, and it is worth stating plainly.',
          'The banker\'s queue has a *larger* worst-case operation than the strict queue on the ' +
            'same run, because deferring the rotations lets two of them come due together.',
          'It fixes persistence and it does not fix latency.',
          'If the requirement is a frame budget or a tail-latency SLO rather than a total, ' +
            'amortised O(1) is the wrong promise however the credits are argued.'
        ],
        example: 'Both queues average 1.49 steps per operation; one spikes to 511 and the other to 1 014.'
      },
      {
        term: 'Real-time queues: do one step of the rotation per operation',
        plain: 'Split the rotation into n suspensions of constant work and keep a schedule that forces exactly one per operation.',
        formal: 'O(1) worst case per operation, not amortised',
        detail: [
          'The schedule is the whole trick.',
          'Instead of one suspension that does n units of work, incremental rotation builds a chain ' +
            'of n suspensions each doing one unit, and every queue operation forces the next link.',
          'The rotation is therefore complete before the next one is due, so no operation ever pays ' +
            'more than a constant and there is no spike to re-trigger.',
          'It is more code, and it is the only version of the three that can be put behind a ' +
            'latency budget.'
        ],
        example: 'Worst operation of 2 steps over a 1 024-operation run, at a mean of 1.00 against the others\' 1.49.'
      },
      {
        term: 'Scheduling generalises beyond queues',
        plain: 'Any amortised structure can be made worst-case by paying its debt in instalments.',
        formal: 'debt per suspension, discharged at a fixed rate per operation',
        detail: [
          'Okasaki\'s framework turns "this operation is expensive but rare" into "this operation ' +
            'is divided into pieces and one piece is paid per step".',
          'The same technique gives real-time versions of catenable lists, deques and heaps.',
          'The engineering value is not the specific structures but the move itself.',
          'When a spike is unacceptable, look for a way to do a bounded slice of the expensive work ' +
            'on every ordinary operation rather than all of it on one.'
        ],
        example: 'The same idea appears as incremental rehashing in M03 and incremental compaction in an LSM tree.'
      },
      {
        term: 'The steps are counted, not timed',
        plain: 'Every measurement here is list cells forced or traversed, so it does not depend on the machine.',
        formal: 'one step = one suspension forced or one cell walked',
        detail: [
          'Timing a lazy structure in a JIT-compiled runtime measures the runtime at least as much ' +
            'as the structure.',
          'Allocation, escape analysis and inline caches all move the numbers more than the ' +
            'algorithmic difference does.',
          'Counting the operations the analysis is actually about gives a figure that reproduces ' +
            'exactly.',
          'It can also be compared against the bound on paper, which is the only comparison worth ' +
            'making here.'
        ],
        example: 'The 340× gap between the strict and banker\'s queues is a step count, and it is the same on every run.'
      },
      {
        term: 'Which one to reach for',
        plain: 'Ephemeral use: the strict queue. Persistent use: the banker\'s. A latency budget: real-time.',
        formal: 'the three columns are reuse safety, average cost and worst-case cost',
        detail: [
          'The decision is not about elegance.',
          'If the queue is used linearly - each version once - the strict two-list queue is the ' +
            'simplest correct thing, and its amortised bound holds.',
          'If old versions are retained or replayed, the memoised suspension is what keeps the ' +
            'bound true.',
          'If a single operation must never exceed a constant, only the scheduled version delivers ' +
            'that, and it is worth the extra code precisely and only then.'
        ],
        example: 'Same 512-element workload: mean 1.49, 1.49 and 1.00 steps; worst 511, 1 014 and 2.'
      }
    ],

    'versioned-queries': [
      {
        term: 'A persistent segment tree is path copying with a payload',
        plain: 'An update rebuilds one root-to-leaf path and shares every sibling subtree.',
        formal: 'exactly ⌈log₂ n⌉ + 1 new nodes per update',
        readAs: 'Each update rebuilds only the root-to-leaf path, which is the tree height plus the leaf ' +
          'itself. Everything else is shared with the previous version, untouched.',
        detail: [
          'This is the cleanest instance of structural sharing there is, because the count is exact ' +
            'rather than expected.',
          'A segment tree over n leaves is perfectly balanced, there is no rebalancing, and an ' +
            'update touches precisely the path.',
          'The measured figure and the bound are the same number.',
          'That makes it the right structure to see the idea in, before meeting the ones where ' +
            'rotations blur it.'
        ],
        example: '1 024 leaves and 500 updates: 11 nodes per update against a bound of ⌈log₂ 1 024⌉ + 1 = 11.'
      },
      {
        term: 'Keeping every version is cheap; copying every version is not',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["snapshot the whole array<br/>on every update"] --> B["n bytes per version"]',
            '    C["path-copy on every update"] --> D["log n nodes per version"]',
            '    B --> E["500 versions of 1 024 elements:<br/>megabytes"]',
            '    D --> F["the same history: kilobytes"]'
          ].join('\n'),
          caption: 'Every version stays queryable either way. The difference is entirely whether the parts that did not change are shared or duplicated.'
        },
        plain: 'The whole history costs the initial tree plus one path per update.',
        formal: 'O(n + u log n) against O(u · n) for snapshots',
        readAs: 'Persistence costs one build plus a log per update. Taking a full snapshot per update costs a ' +
          'copy each time. The gap between those two is the entire reason the structure exists.',
        detail: [
          'The arithmetic is worth doing once, because the ratio is larger than intuition suggests.',
          'Take 500 versions of a 1 024-element array. That is half a million element-slots if each ' +
            'version is a copy, and about seven and a half thousand nodes if the versions share.',
          'The gap widens linearly with the number of versions.',
          'That is why snapshotting a database by copying pages is a completely different ' +
            'engineering proposition from snapshotting it by sharing them.'
        ],
        example: '241 504 bytes for 501 versions, against 32 817 504 if each version were copied - 135.9× less.'
      },
      {
        term: 'Query any version at the cost of the current one',
        plain: 'A historical query is an ordinary descent from that version\'s root; nothing about it is slower.',
        formal: 'the version is a root pointer, not a search key',
        detail: [
          'This is what separates a persistent structure from a change log.',
          'Reconstructing a past state from a log is O(changes). Reading it from a persistent ' +
            'structure is O(log n), and identical to reading the present.',
          'That property is what makes time-travel queries and snapshot isolation feasible rather ' +
            'than merely possible.',
          'It is why a database\'s MVCC layer stores versions as structure rather than as deltas to ' +
            'replay.'
        ],
        example: '2 004 historical range-sum queries spread over all 501 versions: 0 disagreed with the model.'
      },
      {
        term: 'One version per prefix answers order statistics',
        plain: 'Build a counting tree over the value domain after each element; subtracting two versions counts a range.',
        formal: 'version r+1 minus version l counts exactly the values in positions [l, r]',
        readAs: 'Subtract one persistent version from another and what remains is exactly the elements added ' +
          'between them — the square brackets meaning both ends are included. Two roots and a ' +
          'subtraction answer a range query with no extra structure.',
        detail: [
          'The trick is worth learning as a technique rather than as a structure.',
          'Two persistent trees built from the same shape can be walked *together*, and the ' +
            'difference of their stored counts is the count for the interval between them.',
          'So a descent guided by that difference finds the k-th smallest value in a range in one ' +
            'pass.',
          'No subtraction of trees actually happens; the descent just reads both and takes the ' +
            'difference at each step.'
        ],
        example: '512 values over a 1 000-value domain: k-th smallest in any range in 10.0 descents, 0 wrong of 300.'
      },
      {
        term: 'It beats the merge-sort tree it replaces',
        plain: 'The same query cost M08 O(log² n) time and O(n log n) memory; this costs O(log n) and O(n log n) nodes.',
        formal: 'one descent of the value domain rather than a binary search inside every canonical node',
        detail: [
          'M08.7 answered "how many values below x in this range" with a merge-sort tree.',
          'That tree stores a sorted copy of the data at every level, and binary-searches inside ' +
            'each of the canonical nodes a query decomposes into.',
          'The persistent construction answers the harder question - the k-th smallest, not just a ' +
            'count - in a single descent, because the version difference has already done the ' +
            'decomposition.',
          'It is a good example of a structure being replaced by a *representation*.'
        ],
        example: '10.98 nodes per value stored, and a query that is 10 descents rather than 45 nodes and 58 comparisons.'
      },
      {
        term: 'Copy-on-write is the same idea at page granularity',
        plain: 'Filesystems and databases share unchanged pages between snapshots and rewrite only the touched path.',
        formal: 'B-tree path copying: a write rebuilds one root-to-leaf path of pages',
        detail: [
          'ZFS, Btrfs, LMDB and every modern storage engine that offers snapshots implements ' +
            'exactly the structure in this section. A page is the node and a disk block is the ' +
            'pointer.',
          'The consequences are the ones the section predicts.',
          'Snapshots are almost free, a write amplifies to a path of pages rather than one, and old ' +
            'versions live until something decides they are unreachable.',
          'Recognising it is what makes storage-engine documentation legible.'
        ],
        example: 'A 4 KB page tree of depth 4 rewrites 4 pages per update and shares the rest, whatever the snapshot count.'
      },
      {
        term: 'The version is data, and it can be branched',
        plain: 'Nothing forces versions to form a line; updating an old version makes a tree of versions.',
        formal: 'partial persistence gives a path, full persistence gives a DAG',
        detail: [
          'Because an update takes a root and returns a root, applying one to an *old* root ' +
            'produces a branch rather than an extension.',
          'That is full persistence, and it is what makes this structure the natural fit for ' +
            'anything with a branching history.',
          'Git is the obvious example, and a database with long-lived read snapshots is the common ' +
            'one.',
          'The only thing branching costs is that "the latest version" stops being a well-defined ' +
            'idea.'
        ],
        example: 'Every version here is a root pointer, so branching from version 200 is the same call as extending version 500.'
      },
      {
        term: 'The space accounting has to be per version',
        plain: 'Report nodes added by each version, not the total, or sharing is invisible.',
        formal: 'nodes(v) − nodes(v−1) is the number the structure is chosen for',
        readAs: 'The figure that matters is how many nodes one more version costs, not how many exist in ' +
          'total. If that difference is the tree height, the sharing is working.',
        detail: [
          'A total node count grows with the history whatever the structure does, so it cannot ' +
            'distinguish sharing from copying.',
          'The per-version delta can, and it is also the number an operator needs.',
          'It says what one more snapshot will cost, which is the question actually being asked ' +
            'when somebody wonders whether to keep hourly snapshots for a month.',
          'Reporting the total instead is how a structure that has stopped sharing goes unnoticed.'
        ],
        example: 'Every update adds exactly 11 nodes here, whatever the version number or the history length.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
