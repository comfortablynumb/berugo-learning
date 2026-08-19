/** Reference entries for the trie, finger-tree and zipper sections (M09.4-M09.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'bit-partitioned-tries': {
      summary: 'Hash array mapped tries and persistent vectors: 32-way branching, popcount-indexed sparse ' +
        'nodes, a tail buffer, and transients for batch mutation.',
      intuition: 'Consume five bits of the key per level so the depth is at most seven, then store only the ' +
        'occupied children and find one with a population count instead of a search.',
      formulation: {
        equations: [
          {
            label: 'The index',
            expr: 'slot = popcount(bitmap & (bit − 1)), bit = 1 << ((key >>> shift) & 31)',
            terms: [
              { sym: 'why', meaning: 'a node with three children is an array of three, not 32 with 29 holes' },
              { sym: 'invariant', meaning: 'children.length === popcount(bitmap), always' }
            ]
          },
          {
            label: 'Depth',
            expr: '⌈32 / 5⌉ = 7, and 32^7 = 34 359 738 368',
            terms: [
              { sym: 'measured', meaning: '15 695 keys reach depth 6; 200 000 vector elements need 4 levels' }
            ]
          },
          {
            label: 'Sparse against dense nodes',
            expr: 'nodes·16 + slots·8 against nodes·(8 + 32·8)',
            terms: [
              { sym: 'measured', meaning: '219 872 bytes against 1 037 520 - 4.72×, at a mean fan-out of 4.99' }
            ]
          },
          {
            label: 'Transients',
            expr: 'a node may be mutated iff its owner token matches the batch',
            terms: [
              { sym: 'measured', meaning: '20 000 appends: 1 840 nodes allocated persistently, 645 with a transient' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The child array length equals the bitmap\'s popcount',
          why: 'The index arithmetic assumes the two representations agree.',
          breaks: 'Lookups return a neighbour\'s child - plausible wrong values rather than a crash.'
        },
        {
          name: 'Keys with identical hashes are kept in a bucket',
          why: 'Once 32 bits of key material are consumed there is no deeper level to separate them.',
          breaks: 'Infinite recursion, or a silently lost key if the entry is overwritten instead.'
        },
        {
          name: 'A transient only mutates nodes it created',
          why: 'Anything inherited is still visible to another version.',
          breaks: 'A batch build rewrites the structure the caller passed in - the worst kind of aliasing bug.'
        }
      ],
      complexity: [
        { operation: 'get / set', average: 'O(log₃₂ n) - at most 7 levels', worst: 'O(7) plus a collision bucket scan' },
        { operation: 'vector index', average: 'O(log₃₂ n)', worst: 'O(4) at 200 000 elements' },
        { operation: 'vector append', average: 'O(1) amortised - the tail absorbs 31 of 32', worst: 'O(log₃₂ n) when the tail is pushed' },
        { operation: 'memory per node', average: '16 bytes plus 8 per occupied slot', worst: '16 plus 256 when full' },
        { operation: 'batch build', average: 'O(n) with a transient', worst: 'O(n log₃₂ n) allocations without one' }
      ],
      failureModes: [
        {
          symptom: 'Some keys are missing after many inserts.',
          cause: 'Hash collisions at full depth resolved by overwriting rather than bucketing.',
          fix: 'Handle shift ≥ 32 explicitly and test with keys engineered to collide.'
        },
        {
          symptom: 'Indexes past a power-of-32 boundary read undefined.',
          cause: 'The root-overflow path built the path to the retired tail one level too shallow.',
          fix: 'Build the new path at the *old* root\'s shift; test at 32, 1 024, 32 768 and beyond.'
        },
        {
          symptom: 'Building a large collection is slow and the profile is all GC.',
          cause: 'A new node per level per update, all immediately garbage.',
          fix: 'Use a transient for the batch; the answers are identical and the allocation drops 2.85×.'
        },
        {
          symptom: 'Nodes are far larger than expected.',
          cause: 'Dense 32-slot arrays instead of a bitmap and a packed array.',
          fix: 'Popcount indexing; the mean fan-out is about 5, so 84% of a dense node is empty.'
        }
      ],
      inTheWild: [
        { system: 'Clojure', how: 'PersistentHashMap and PersistentVector - the original 32-way implementations with transients' },
        { system: 'Scala', how: 'immutable.HashMap and Vector, on the same design' },
        { system: 'Immutable.js', how: 'Map and List, with withMutations as the transient interface' },
        { system: 'Erlang and Elixir maps', how: 'a HAMT above 32 entries, a flat array below' }
      ],
      sources: [
        { title: 'Ideal Hash Trees', where: 'Phil Bagwell - EPFL technical report, 2001' },
        { title: 'RRB-Trees: Efficient Immutable Vectors', where: 'Bagwell and Rompf - EPFL, 2011' },
        { title: 'Understanding Clojure\'s Persistent Vectors', where: 'Jean Niklas L\'orange - hypirion.com, 2013' },
        { title: 'Optimizing Hash-Array Mapped Tries', where: 'Steindorfer and Vinju - OOPSLA, 2015' }
      ]
    },

    'finger-trees': {
      summary: 'A 2-3 finger tree with monoidal annotations: O(1) amortised access at both ends, O(log n) split ' +
        'and concat, and one implementation serving four data structures.',
      intuition: 'Digits of one to four elements at each end of every spine level absorb pushes and pops; the ' +
        'cached monoid product at each node lets split find a position without looking at an element.',
      formulation: {
        equations: [
          {
            label: 'The shape',
            expr: 'Deep(prefix : Digit, middle : FingerTree of Node, suffix : Digit)',
            terms: [
              { sym: 'measured', meaning: '3 000 elements: a 7-level spine holding 26 elements in its digits' }
            ]
          },
          {
            label: 'The annotation',
            expr: 'measure(node) = combine over children; split walks on the cache alone',
            terms: [
              { sym: 'requirement', meaning: 'combine must be associative with an identity - a monoid' },
              { sym: 'measured', meaning: 'the same 1 000 items measure 1 000, 49 956, 999 and 499 under four monoids' }
            ]
          },
          {
            label: 'Split',
            expr: 'split(t, p) = (before, from) with concat(before, from) = t',
            terms: [
              { sym: 'measured', meaning: 'splitting 3 000 elements visits 14 nodes; rejoining allocates 20' }
            ]
          },
          {
            label: 'Concat',
            expr: 'append(left, middle, right), recursing down both spines',
            terms: [
              { sym: 'trap', meaning: 'folding the middle onto the right is a *right* fold; a left fold reverses the run' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every digit holds one to four elements',
          why: 'Fewer means the level should have collapsed; more means it should have pushed down.',
          breaks: 'The amortisation argument fails and the spine stops being logarithmic.'
        },
        {
          name: 'A node\'s cached measure equals the product of its children\'s',
          why: 'Split reads only the cache, so a stale one sends the descent to the wrong subtree.',
          breaks: 'Wrong answers that depend on the tree shape rather than the contents.'
        },
        {
          name: 'concat(split(t)) reconstructs t exactly',
          why: 'It is the one property that catches every digit and fold mistake at once.',
          breaks: 'Elements reordered or duplicated across the cut, usually only when it crosses a spine level.'
        }
      ],
      complexity: [
        { operation: 'pushFront / pushBack', average: 'O(1) amortised', worst: 'O(log n) when a digit cascades' },
        { operation: 'popFront / popBack', average: 'O(1) amortised', worst: 'O(log n)' },
        { operation: 'split', average: 'O(log n)', worst: 'O(log n)' },
        { operation: 'concat', average: 'O(log(min(m, n)))', worst: 'O(log(min(m, n)))' },
        { operation: 'measure of the whole', average: 'O(1) - cached at the root', worst: 'O(1)' }
      ],
      failureModes: [
        {
          symptom: 'A concatenation silently reverses part of the sequence.',
          cause: 'The middle elements were folded onto the right-hand tree left-to-right.',
          fix: 'Right fold when prepending, left fold when appending; the bug only appears across a spine level.'
        },
        {
          symptom: 'A query returns different answers after an unrelated insert.',
          cause: 'The measure is not associative, so the answer depends on the grouping.',
          fix: 'Check the monoid laws; subtraction and mean are the two people try.'
        },
        {
          symptom: 'It is slower than the deque it replaced.',
          cause: 'Using a finger tree for an operation set a deque already covers.',
          fix: 'Reach for one when split, concat or an annotated query is needed - not for two-ended access alone.'
        },
        {
          symptom: 'Split lands one element off.',
          cause: 'The focused element belongs to the right-hand part by convention.',
          fix: 'Assert reconstruction over randomised split points, including 0 and n.'
        }
      ],
      inTheWild: [
        { system: 'Haskell\'s Data.Sequence', how: 'the canonical implementation, annotated by size' },
        { system: 'Text editors', how: 'a measure of (characters, newlines) answers "go to offset" and "go to line" from one structure' },
        { system: 'Scala and Clojure interval libraries', how: 'max-interval-end annotations for overlap queries' },
        { system: 'Priority search queues', how: 'the priority monoid, giving delete-max by split' }
      ],
      sources: [
        { title: 'Finger Trees: A Simple General-Purpose Data Structure', where: 'Hinze and Paterson - JFP, 2006' },
        { title: 'Purely Functional Data Structures', where: 'Chris Okasaki - the implicit recursive slowdown chapter' },
        { title: 'Purely Functional Worst Case Constant Time Catenable Sorted Lists', where: 'Kaplan and Tarjan - ESA, 1996' },
        { title: 'Data.Sequence documentation', where: 'the containers package - the practical reference' }
      ]
    },

    zippers: {
      summary: 'A focused position plus a context stack: O(1) navigation and editing inside an immutable ' +
        'structure, with one O(depth) rebuild when the focus finally leaves.',
      intuition: 'An immutable tree cannot hold parent pointers, so the way back out is recorded in the ' +
        'traversal instead. The result is an ordinary value that behaves like a cursor.',
      formulation: {
        equations: [
          {
            label: 'The representation',
            expr: 'Zipper = (focus, [Crumb]); Crumb = (parent value, left siblings reversed, right siblings)',
            terms: [
              { sym: 'why reversed', meaning: 'the nearest left sibling is at the head, which makes `left` O(1)' }
            ]
          },
          {
            label: 'The derivative',
            expr: 'the one-hole context type of T is T′',
            terms: [
              { sym: 'consequence', meaning: 'the crumb type can be derived mechanically rather than invented' }
            ]
          },
          {
            label: 'Edit cost',
            expr: 'k edits at one focus: O(k + depth) against O(k · depth)',
            terms: [
              { sym: 'measured', meaning: '50 edits at depth 12: 12 nodes rebuilt against 600 - exactly 50×' },
              { sym: 'stable', meaning: 'the ratio is the edit count at depth 8, 12 and 16 alike' }
            ]
          },
          {
            label: 'The identity law',
            expr: 'toRoot(moves(focus(t))) = t',
            terms: [
              { sym: 'why', meaning: 'it catches every sibling-ordering mistake, which are otherwise silent' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Navigation without editing rebuilds the original exactly',
          why: 'Moving is supposed to be free of side effects on the structure.',
          breaks: 'A tree with the right nodes in the wrong sibling order, discovered much later.'
        },
        {
          name: 'The source structure is never modified',
          why: 'It is what makes the old version still reachable and the zipper a value.',
          breaks: 'Both versions change together and persistence is gone.'
        },
        {
          name: 'Left siblings are stored nearest-first',
          why: '`left` and `right` are O(1) only if the adjacent sibling is at the head.',
          breaks: 'Either a linear move or a reversed reconstruction, depending on which half is wrong.'
        }
      ],
      complexity: [
        { operation: 'down / up / left / right', average: 'O(1)', worst: 'O(1)' },
        { operation: 'replace / edit', average: 'O(1)', worst: 'O(1)' },
        { operation: 'toRoot', average: 'O(depth)', worst: 'O(depth)' },
        { operation: 'k local edits', average: 'O(k + depth)', worst: 'O(k + depth)' },
        { operation: 'memory', average: 'O(depth) crumbs plus the pinned version', worst: 'O(n) if the version is large' }
      ],
      failureModes: [
        {
          symptom: 'The rebuilt tree has children in the wrong order.',
          cause: 'The reversed left-sibling list was not un-reversed on the way back up.',
          fix: 'Random-walk then rebuild with no edits, and compare against the source.'
        },
        {
          symptom: 'A zipper does not see edits made elsewhere.',
          cause: 'It holds nodes from the version it was created in; it is a view, not a cursor.',
          fix: 'Working design, wrong abstraction - share a reference to the current version instead.'
        },
        {
          symptom: 'Memory is retained long after a structure was replaced.',
          cause: 'A live zipper pins its whole version against collection.',
          fix: 'Drop the zipper when the edit session ends; this is 9.1\'s retention problem from the other side.'
        },
        {
          symptom: 'The zipper is no faster than direct path copying.',
          cause: 'The focus leaves and returns between edits, so every edit still pays a rebuild.',
          fix: 'Batch the work at a position; locality of edits is the precondition.'
        }
      ],
      inTheWild: [
        { system: 'Text and structure editors', how: 'the cursor is a zipper, so undo is just keeping the previous one' },
        { system: 'Virtual DOM diffing', how: 'a focused traversal of two trees with the path recorded' },
        { system: 'Lens and optics libraries', how: 'the general case - composable getter/setter pairs into nested values' },
        { system: 'XMonad', how: 'the window layout is a zipper, so "the focused window" is structural' }
      ],
      sources: [
        { title: 'The Zipper', where: 'Gérard Huet - JFP, 1997' },
        { title: 'The Derivative of a Regular Type is its Type of One-Hole Contexts', where: 'Conor McBride, 2001' },
        { title: 'Learn You a Haskell: Zippers', where: 'Miran Lipovača - the standard gentle introduction' },
        { title: 'Lenses, Folds and Traversals', where: 'Edward Kmett - the optics generalisation' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
