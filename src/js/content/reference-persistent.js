/** Reference entries for the persistence sections (M09.1-M09.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'persistence-basics': {
      summary: 'Three ways to keep every version of a search tree - path copying, fat nodes and node copying - ' +
        'with the space and the read cost of each measured rather than quoted.',
      intuition: 'An update has to record a change somewhere. Path copying puts it in new nodes, fat nodes put ' +
        'it in a version list inside the old ones, and node copying puts it in a spare slot and copies only ' +
        'when the slot is full. Whatever is saved on the write is paid on the read.',
      formulation: {
        equations: [
          {
            label: 'Path copying',
            expr: 'O(depth) new nodes per update; query unchanged',
            terms: [
              { sym: 'measured', meaning: '13.12 nodes per update at depth 18; 156 720 bytes for 400 versions' },
              { sym: 'read', meaning: '8.61 probes per query - identical to the ephemeral tree' }
            ]
          },
          {
            label: 'Fat nodes',
            expr: 'O(1) space per change; query O(log n · log v)',
            terms: [
              { sym: 'measured', meaning: '344 node objects for 400 versions, 3 574 appended entries, 76 448 bytes' },
              { sym: 'read', meaning: '16.66 probes per query - 1.94× path copying' }
            ]
          },
          {
            label: 'Node copying',
            expr: 'O(1) amortised space; query unchanged',
            terms: [
              { sym: 'measured', meaning: '1 861 boxes filled, 1 713 cascades, 5.14 nodes per update' },
              { sym: 'read', meaning: '8.61 probes - the box is one comparison, not a search' }
            ]
          },
          {
            label: 'The baseline',
            expr: 'copying every version costs versions × size',
            terms: [
              { sym: 'measured', meaning: '5 504 000 bytes against path copying\'s 156 720 - 35× more' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every version answers, not just the latest',
          why: 'It is the definition of persistence and the only property a test can meaningfully check.',
          breaks: 'A snapshot read returns data that never existed, and no end-state test notices.'
        },
        {
          name: 'A version is never mutated once created',
          why: 'Path copying and node copying both rely on old nodes being immutable below the change.',
          breaks: 'Editing a shared subtree silently rewrites history in every version that reaches it.'
        },
        {
          name: 'The tree shape depends on the key set, not the arrival order',
          why: 'Hashed treap priorities keep the depth logarithmic whatever order the keys came in.',
          breaks: 'Sorted input builds a path, and every per-update figure becomes a statement about the input.'
        }
      ],
      complexity: [
        { operation: 'path copying: update / query', average: 'O(log n) / O(log n)', worst: 'O(n) / O(n) if unbalanced' },
        { operation: 'fat node: update / query', average: 'O(1) space, O(log n) time / O(log n · log v)', worst: 'O(log n · log v)' },
        { operation: 'node copying: update / query', average: 'O(1) amortised space / O(log n)', worst: 'O(n) on a full cascade' },
        { operation: 'space, all methods', average: 'O(n + u · cost per update)', worst: 'O(u · n) if sharing fails' },
        { operation: 'full copies', average: 'O(u · n)', worst: 'O(u · n)' }
      ],
      failureModes: [
        {
          symptom: 'An old snapshot returns rows that were never committed together.',
          cause: 'A shared subtree was mutated in place by a later update.',
          fix: 'Replay the whole history against a model on every test run, not just the final state.'
        },
        {
          symptom: 'Memory grows linearly with the number of versions.',
          cause: 'Sharing is not happening - each update is copying more than a path.',
          fix: 'Count distinct nodes reachable from any version, not allocations; the two diverge exactly here.'
        },
        {
          symptom: 'Queries get slower as the history grows.',
          cause: 'A fat-node representation: every pointer hop binary-searches a version list.',
          fix: 'Expected behaviour - measure the read/write ratio and switch to path copying if reads dominate.'
        },
        {
          symptom: 'Counters read as zero after a reset.',
          cause: 'The reset rebound the stats object while a helper still held the old reference.',
          fix: 'Clear counters in place rather than replacing the object.'
        }
      ],
      inTheWild: [
        { system: 'Clojure, Scala and Immutable.js', how: 'path copying over bit-partitioned tries for every collection' },
        { system: 'Git', how: 'path copying over trees of blobs; a commit shares every unchanged directory' },
        { system: 'PostgreSQL and InnoDB MVCC', how: 'persistence plus a rule for when a version becomes unreachable' },
        { system: 'ZFS and Btrfs', how: 'copy-on-write at page granularity - path copying with a disk block as the pointer' }
      ],
      sources: [
        { title: 'Making Data Structures Persistent', where: 'Driscoll, Sarnak, Sleator, Tarjan - JCSS, 1989' },
        { title: 'Purely Functional Data Structures', where: 'Chris Okasaki - Cambridge University Press, 1998' },
        { title: 'Planar Point Location Using Persistent Search Trees', where: 'Sarnak and Tarjan - CACM, 1986' },
        { title: 'Fully Persistent Lists with Catenation', where: 'Driscoll, Sleator, Tarjan - JACM, 1994' }
      ]
    },

    'persistent-sequences': {
      summary: 'Why persistence invalidates amortised analysis, and the two repairs - a memoised suspension for ' +
        'the amortised bound and an explicit schedule for the worst case.',
      intuition: 'A credit argument assumes each version is consumed once. Persistence lets an old version be ' +
        'reused forever, so the expensive operation can be re-triggered while its savings are earned only once.',
      formulation: {
        equations: [
          {
            label: 'The broken bound',
            expr: 'amortised O(1) holds iff each version is used once',
            terms: [
              { sym: 'measured', meaning: 'one pre-rotation version reused 1 000 times: 510.00 steps each' }
            ]
          },
          {
            label: 'Banker\'s queue',
            expr: 'front ++ reverse(rear), as a memoised suspension',
            terms: [
              { sym: 'measured', meaning: '1.50 steps per reuse; the suspension is forced 8 times and memo-hit 1 518' },
              { sym: 'ratio', meaning: '340× less work than the strict queue for the identical calls' }
            ]
          },
          {
            label: 'Real-time queue',
            expr: 'incremental rotation plus a schedule forcing one step per operation',
            terms: [
              { sym: 'measured', meaning: 'worst operation 2 steps over 1 024 operations, at a mean of 1.00' }
            ]
          },
          {
            label: 'Worst case against amortised',
            expr: 'measured worst single operation over a linear run',
            terms: [
              { sym: 'strict', meaning: '511 steps' },
              { sym: 'banker', meaning: '1 014 steps - larger, because deferred rotations come due together' },
              { sym: 'real-time', meaning: '2 steps' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The rear is never longer than the front',
          why: 'It is what bounds the rotation frequency and makes the amortised argument possible at all.',
          breaks: 'Rotations happen every operation and the queue degenerates to a linear structure.'
        },
        {
          name: 'A suspension is forced at most once',
          why: 'The memo, not the laziness, is what survives persistent reuse.',
          breaks: 'The banker\'s queue behaves exactly like the strict one and the bound is false again.'
        },
        {
          name: 'The schedule is advanced on every operation',
          why: 'The rotation must complete before the next one becomes due.',
          breaks: 'The real-time queue loses its worst-case bound and becomes an expensive banker\'s queue.'
        }
      ],
      complexity: [
        { operation: 'strict: snoc / tail, linear use', average: 'O(1) amortised', worst: 'O(n) at a rotation' },
        { operation: 'strict: under persistent reuse', average: 'O(n) per operation', worst: 'O(n)' },
        { operation: 'banker: snoc / tail', average: 'O(1) amortised, even persistently', worst: 'O(n) on the forcing operation' },
        { operation: 'real-time: snoc / tail', average: 'O(1)', worst: 'O(1)' },
        { operation: 'space, all three', average: 'O(n)', worst: 'O(n) per retained version chain' }
      ],
      failureModes: [
        {
          symptom: 'A queue is fast in a benchmark and pathological in a replay or an undo stack.',
          cause: 'Amortised analysis under persistent reuse - the classic case.',
          fix: 'Memoise the rotation, or use the real-time variant if a per-operation bound is required.'
        },
        {
          symptom: 'Frame times spike periodically with no change in load.',
          cause: 'An amortised structure paying off its debt in one operation.',
          fix: 'Schedule the work: do a bounded slice on every ordinary operation instead of all of it on one.'
        },
        {
          symptom: 'Making it lazy did not help.',
          cause: 'A suspension without memoisation recomputes on every force.',
          fix: 'The memo is the mechanism; check it is actually being hit.'
        },
        {
          symptom: 'Timings disagree between runs and machines.',
          cause: 'Timing a lazy structure measures the runtime\'s allocator as much as the algorithm.',
          fix: 'Count suspensions forced and cells walked, which reproduce exactly and match the analysis.'
        }
      ],
      inTheWild: [
        { system: 'Haskell\'s Data.Sequence', how: 'persistent sequences whose bounds depend on exactly this analysis' },
        { system: 'Undo stacks and time-travel debuggers', how: 'the canonical case of reusing an old version repeatedly' },
        { system: 'Incremental rehashing (M03.7)', how: 'the same scheduling idea applied to a hash table\'s resize' },
        { system: 'LSM compaction throttling', how: 'a bounded slice of merge work per write, for the same reason' }
      ],
      sources: [
        { title: 'Purely Functional Data Structures', where: 'Chris Okasaki - chapters 6 and 7' },
        { title: 'Simple and Efficient Purely Functional Queues and Deques', where: 'Chris Okasaki - JFP, 1995' },
        { title: 'Real-Time Queue Operations in Pure LISP', where: 'Hood and Melville - IPL, 1981' },
        { title: 'Amortized Computational Complexity', where: 'Robert Tarjan - SIAM J. Alg. Disc. Meth., 1985' }
      ]
    },

    'versioned-queries': {
      summary: 'Persistent segment trees: path copying with a payload, versioned range queries at the cost of ' +
        'current ones, and the prefix construction that answers range order statistics.',
      intuition: 'A segment tree never rotates, so an update rebuilds exactly one root-to-leaf path and shares ' +
        'every sibling. Keeping the root of each version is all that is needed to query the past.',
      formulation: {
        equations: [
          {
            label: 'Cost per version',
            expr: 'exactly ⌈log₂ n⌉ + 1 new nodes',
            terms: [
              { sym: 'measured', meaning: '1 024 leaves: 11 nodes per update, matching the bound exactly' }
            ]
          },
          {
            label: 'Space against snapshots',
            expr: 'O(n + u log n) against O(u · n)',
            terms: [
              { sym: 'measured', meaning: '241 504 bytes for 501 versions against 32 817 504 copied - 135.9×' }
            ]
          },
          {
            label: 'Prefix construction',
            expr: 'version r+1 minus version l counts positions [l, r]',
            terms: [
              { sym: 'measured', meaning: '512 values over a 1 000 domain: 10.98 nodes per value, 10.0 descents per query' },
              { sym: 'against', meaning: 'M08\'s merge-sort tree: 44.85 nodes and 57.78 comparisons for a weaker query' }
            ]
          },
          {
            label: 'Historical query',
            expr: 'a version is a root pointer, so reading the past is O(log n)',
            terms: [
              { sym: 'contrast', meaning: 'replaying a change log to reconstruct a version is O(changes)' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'A node\'s stored value is correct for its own subtree',
          why: 'A query that stops at a node reads it without descending.',
          breaks: 'Answers that are right whenever the range aligns with a node - the M08.7 lazy bug again.'
        },
        {
          name: 'The two prefix versions have identical shape',
          why: 'The quantile descent walks them together and subtracts node by node.',
          breaks: 'The subtraction compares unrelated subtrees and the k-th smallest is nonsense.'
        },
        {
          name: 'Old roots are retained for as long as anyone may ask',
          why: 'A version is only queryable while its root is reachable.',
          breaks: 'A historical query on a collected version - the failure MVCC garbage collection has to avoid.'
        }
      ],
      complexity: [
        { operation: 'update', average: 'O(log n) time and O(log n) new nodes', worst: 'O(log n)' },
        { operation: 'range query at any version', average: 'O(log n)', worst: 'O(log n)' },
        { operation: 'range k-th smallest', average: 'O(log domain)', worst: 'O(log domain)' },
        { operation: 'space for u versions', average: 'O(n + u log n)', worst: 'O(n + u log n)' },
        { operation: 'build', average: 'O(n)', worst: 'O(n)' }
      ],
      failureModes: [
        {
          symptom: 'A time-travel query returns the current data.',
          cause: 'The version argument is ignored and the latest root is used.',
          fix: 'Test every version against a replayed model, not the tip - the bug is invisible otherwise.'
        },
        {
          symptom: 'Storage grows without bound while the table does not.',
          cause: 'Old versions are reachable because a long-running transaction still holds a snapshot.',
          fix: 'This is the MVCC bloat problem; the structure is behaving correctly and the retention rule is not.'
        },
        {
          symptom: 'The k-th smallest is off by one at the range edges.',
          cause: 'Prefix versions are half-open; version r+1 minus version l covers [l, r].',
          fix: 'Check against a sorted slice over randomised ranges, including single-element ones.'
        },
        {
          symptom: 'Per-version cost looks fine and total memory does not.',
          cause: 'The total grows with the history whatever the structure does.',
          fix: 'Report nodes added per version; it is also the number that answers "what will one more snapshot cost".'
        }
      ],
      inTheWild: [
        { system: 'Snapshot isolation in PostgreSQL and MySQL', how: 'row versions plus visibility rules - persistence with garbage collection' },
        { system: 'LMDB', how: 'copy-on-write B+ tree; a read transaction pins a root and sees a consistent past' },
        { system: 'Competitive programming', how: 'the persistent segment tree is the standard answer to range k-th smallest' },
        { system: 'Datomic and immutable databases', how: 'the whole history is the database and a query names a time' }
      ],
      sources: [
        { title: 'Making Data Structures Persistent', where: 'Driscoll, Sarnak, Sleator, Tarjan - JCSS, 1989' },
        { title: 'Planar Point Location Using Persistent Search Trees', where: 'Sarnak and Tarjan - CACM, 1986' },
        { title: 'Competitive Programmer\'s Handbook', where: 'Antti Laaksonen - persistent structures chapter' },
        { title: 'The Design and Implementation of a Log-Structured File System', where: 'Rosenblum and Ousterhout - TOCS, 1992' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
