/** Worked examples for the trie, finger-tree and zipper sections (M09.4-M09.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    'bit-partitioned-tries': [
      {
        title: 'Why "O(log₃₂ n)" is allowed to be called constant',
        goal: 'Take the branching factor seriously: work out what depth a 32-way trie actually reaches, and ' +
          'then measure what makes a 32-way node affordable in the first place.',
        setup: '20 000 string keys inserted into a HAMT and 20 000 elements appended to a persistent vector, ' +
          'with the node shapes reported for both.',
        steps: [
          {
            do: 'Work out the depth bound from the key width.',
            why: 'Five bits per level and a 32-bit hash is the entire argument.',
            work: '⌈32 / 5⌉ = 7 levels\n' +
              '32^7 = 34 359 738 368\n' +
              'depth 4 already covers 1 048 576',
            result: 'seven levels is the ceiling for any program that fits in memory'
          },
          {
            do: 'Check the measured depths against it.',
            why: 'A bound that is never approached is a different claim from one that is tight.',
            work: '15 695 distinct keys in the HAMT reach depth 6 of a possible 7\n' +
              '20 000 vector elements need 3 levels; 200 000 need 4',
            result: 'the depth is a small number and stays one'
          },
          {
            do: 'Look at what a 32-slot node would cost if it were stored densely.',
            why: 'This is the reason a naive 32-way trie is unusable.',
            work: '3 930 nodes × (8 + 32 × 8) bytes = 1 037 520 bytes\n' +
              'mean fan-out actually used: 4.99 of 32',
            result: '84% of every dense node is empty'
          },
          {
            do: 'Store a bitmap and only the occupied children instead.',
            why: 'popcount(bitmap & (bit − 1)) turns the sparse array into a direct index.',
            work: '3 930 nodes × 16 bytes + 19 624 occupied slots × 8 = 219 872 bytes\n' +
              'finding a child: one mask, one AND, one popcount',
            result: '4.72× smaller, with no search added'
          },
          {
            do: 'Note the invariant that makes the index arithmetic valid.',
            why: 'It is one line to assert and the failure is silent.',
            work: 'children.length === popcount(bitmap), on every node\n' +
              'measured: 0 nodes disagree',
            result: 'a node with a hole returns a neighbour\'s child rather than crashing'
          }
        ],
        answer: 'Seven levels covers thirty-four billion elements, so the depth of a bit-partitioned trie is a ' +
          'small constant in practice - 15 695 keys reach depth 6, and 200 000 vector elements need four ' +
          'levels. What makes a 32-way node affordable is the sparse layout: the same trie is 1 037 520 bytes ' +
          'with dense 32-slot nodes and 219 872 with a bitmap and popcount indexing, because the mean fan-out ' +
          'actually used is 4.99. The depth claim and the memory claim are separate, and both are needed.'
      },
      {
        title: 'The cost was never the depth; it was the allocation',
        goal: 'Invert the first example. The structure is shallow and the lookups are cheap - so find where ' +
          '"immutable collections are slow" comes from, and remove it.',
        setup: 'The same 20 000 appends to a persistent vector, run twice: once producing a new version per ' +
          'append, and once inside a transient batch that owns the nodes it creates.',
        steps: [
          {
            do: 'Count what a persistent append actually allocates.',
            why: 'Each one returns a new value, so each one has to build something.',
            work: '20 000 appends allocate 1 840 nodes\n' +
              'the final vector holds 645 nodes',
            result: 'about 1 200 nodes built and immediately made garbage'
          },
          {
            do: 'Notice what stops it being far worse.',
            why: 'A path per append would be 20 000 × 3 nodes, and it is not.',
            work: 'the last up-to-32 elements live in a tail buffer outside the trie\n' +
              '31 appends in 32 copy only the tail and touch no node at all',
            result: 'the tail buffer is most of the performance and is easy to omit'
          },
          {
            do: 'Run the identical appends inside a transient.',
            why: 'Nodes the batch created itself cannot be observed by anyone else, so they may be overwritten.',
            work: 'an owner token is stamped on every node the batch allocates\n' +
              'a node whose owner matches is mutated in place; anything inherited is copied\n' +
              '645 nodes allocated, 1 195 mutated in place',
            result: '2.85× fewer allocations for a bit-for-bit identical vector'
          },
          {
            do: 'Confirm the two results are actually the same.',
            why: 'A faster build that produces a different structure is not the same operation.',
            work: 'all 20 000 indices compared between the two vectors\n' +
              '0 differences',
            result: 'identical answers; only the garbage differs'
          },
          {
            do: 'Restate what the complaint was really about.',
            why: 'Because the asymptotics were never the problem.',
            work: 'time per append: O(log₃₂ n) - three or four levels\n' +
              'allocation per append: 1 840 objects over 20 000 appends, each of them collector work',
            result: 'the term that hurts is allocation, and batching removes it'
          }
        ],
        answer: 'A persistent append is three or four pointer writes, which is not slow - but each of those ' +
          'writes is a new object, and 20 000 appends allocate 1 840 nodes to end up holding 645. A transient ' +
          'stamps an owner token on the nodes it creates and overwrites them in place: 645 allocations, 1 195 ' +
          'in-place writes, and an identical vector. "Immutable is slow" is a claim about garbage, and the ' +
          'answer is to batch the writes - which is exactly what Clojure\'s transients and Immutable.js\'s ' +
          '`withMutations` exist for.'
      }
    ],

    'finger-trees': [
      {
        title: 'One structure, four data structures',
        goal: 'Change nothing but the monoid, and watch the same code answer four unrelated queries.',
        setup: '1 000 items, each carrying a value, a priority and an interval end, pushed into four finger ' +
          'trees that differ only in `identity`, `combine` and `measure`.',
        steps: [
          {
            do: 'Read the four measures off the roots.',
            why: 'The root\'s cached measure is the monoid product of the whole sequence.',
            work: 'size (+, 0):            1 000\n' +
              'sum of values (+, 0):     49 956\n' +
              'max priority (max, −∞):      999\n' +
              'max interval end (max, −∞):  499',
            result: 'four different facts about the same 1 000 items, all cached at the root'
          },
          {
            do: 'Confirm the trees really are structurally identical.',
            why: 'If the monoid changed the shape, the claim would be about four structures rather than one.',
            work: 'digit widths down the spine, all four trees: 1/3, 1/4, 1/3, 1/4, 1/3, 1/1',
            result: 'the same shape; only the cached numbers differ'
          },
          {
            do: 'Use the size measure to split at a position.',
            why: 'This is the sequence query, and it must be a descent rather than a scan.',
            work: '3 000 elements, split at 1 500\n' +
              '14 nodes visited\n' +
              'reassembling the halves allocates 20 nodes',
            result: 'O(log n) to cut a sequence in half and O(log n) to put it back'
          },
          {
            do: 'Use the priority measure to make the same structure a priority queue.',
            why: 'No new structural code: the split predicate does all of it.',
            work: 'root measure = the largest priority present\n' +
              'split on "measure ≥ that" lands on the element holding it\n' +
              '400 items pushed in arrival order, popped by repeated split',
            result: 'they come out in exactly descending priority order'
          },
          {
            do: 'Note what the split is actually reading.',
            why: 'It is what makes all four queries the same operation.',
            work: 'at each node: does the running product cross the predicate in the prefix, the middle or the suffix\n' +
              'answered by one cached measure and one combine, three times per level\n' +
              'no element is examined until the final digit - 14 nodes across 3 000 elements',
            result: 'one descent, guided entirely by the annotation'
          }
        ],
        answer: 'The same finger tree is a sequence, a priority queue, an ordered set and an interval map, and ' +
          'the four differ by three functions. Its root reports 1 000, 49 956, 999 and 499 for the same items ' +
          'and its spine is the identical shape in all four. Splitting a 3 000-element sequence visits 14 nodes ' +
          'and concatenating the halves allocates 20. The annotation is the idea worth stealing even if you ' +
          'never write one of these: pick the measure, and a family of queries comes free.'
      },
      {
        title: 'What the generality costs, and when not to pay it',
        goal: 'Invert the first example: instead of showing what the structure can do, price it against the ' +
          'simpler things it would replace.',
        setup: 'The same 3 000-element sequence, compared against a cons list and a plain array on the ' +
          'operations each actually supports.',
        steps: [
          {
            do: 'Look at what the tree carries per node.',
            why: 'Every cached measure is a field that has to be stored and recomputed.',
            work: 'a spine of 7 levels holding 26 elements in its digits\n' +
              'every node caches a measure; every rebuild recomputes it\n' +
              'a 2-3 node is an object with a measure and two or three children',
            result: 'materially larger per element than a cons cell'
          },
          {
            do: 'Compare against a cons list on the operation a cons list is for.',
            why: 'It is the honest baseline for a persistent sequence.',
            work: 'cons list: prepend is 1 cell and O(1), and it is already persistent\n' +
              'finger tree: pushFront is O(1) amortised and allocates more',
            result: 'for prepend-only use the list wins outright'
          },
          {
            do: 'Compare on the operations a cons list cannot do.',
            why: 'This is where the extra structure is bought.',
            work: 'index, split, concat on a cons list: O(n)\n' +
              'on a finger tree: 14 nodes visited to split 3 000 elements',
            result: 'the gap is linear against logarithmic, which is the whole point'
          },
          {
            do: 'Check the requirement the measure has to satisfy.',
            why: 'The wrong measure produces answers that depend on the tree shape.',
            work: 'combine must be associative with an identity\n' +
              'max, min, sum, gcd and "rightmost" qualify\n' +
              'subtraction and mean do not - all 4 monoids measured here qualify',
            result: 'a non-associative measure changes its answer when an unrelated insert rebalances'
          },
          {
            do: 'State the case for reaching for one.',
            why: 'The mistake is reaching for it when a deque would do.',
            work: 'need both ends cheaply → a deque is simpler\n' +
              'need both ends *and* split or concat → finger tree\n' +
              'need 2 different indexes over 1 sequence → finger tree, one measure carrying both',
            result: 'the third case is the one that has no simpler answer'
          }
        ],
        answer: 'A finger tree is bigger per element than a cons list, its constants are larger than a deque\'s, ' +
          'and every rebuild recomputes a cached measure. For prepend-only use the list wins; for both ends the ' +
          'deque wins. What has no simpler answer is the third case - a sequence that must also answer a ' +
          'positional or priority query, or two different indexes at once - and there the split that visits 14 ' +
          'nodes across 3 000 elements is replacing a linear scan. The monoid has to be genuinely associative, ' +
          'which rules out the two measures people reach for first.'
      }
    ],

    zippers: [
      {
        title: 'Fifty edits, one rebuild',
        goal: 'Measure the difference between editing an immutable tree through a zipper and editing it by ' +
          'rebuilding the path each time.',
        setup: 'A tree of depth 12. Fifty edits are applied to the same deep node, once with a zipper held at ' +
          'that node and once by navigating from the root and rebuilding for every edit.',
        steps: [
          {
            do: 'Do it the direct way: find the node, edit, rebuild, repeat.',
            why: 'This is what "update at this path" does in a persistent structure, and it is correct.',
            work: '50 edits × 12 nodes rebuilt = 600 nodes\n' +
              '50 descents of 12 moves each = 1 200 moves\n' +
              '50 separate rebuilds',
            result: '600 nodes allocated to make 50 changes to one place'
          },
          {
            do: 'Now hold a zipper at the node instead.',
            why: 'The context stack means the way back out is already recorded.',
            work: 'one descent of 12 moves to reach the node\n' +
              '50 edits, each replacing the focus and touching nothing else\n' +
              'one rebuild of 12 nodes on the way out',
            result: '12 nodes, 24 moves and 1 rebuild'
          },
          {
            do: 'Read the ratio, and check it is the number it should be.',
            why: 'It should be the edit count, not something incidental.',
            work: '600 / 12 = 50 - exactly the number of edits\n' +
              'at depth 8 with 50 edits: 400 / 8 = 50\n' +
              'at depth 16 with 100 edits: 1 600 / 16 = 100',
            result: 'the saving is the edit count, independent of the depth'
          },
          {
            do: 'Say precisely what a zipper does and does not remove.',
            why: 'It batches the work rather than eliminating it.',
            work: 'edit: O(1), replaces the focus\n' +
              'move: O(1), pushes or pops one crumb\n' +
              'toRoot: O(depth), once',
            result: 'k edits at one focus cost O(k + depth) rather than O(k · depth)'
          },
          {
            do: 'Check the property that catches sibling-ordering bugs.',
            why: 'The left siblings are stored reversed, and getting the reversal wrong is silent.',
            work: '200 random moves through a tree, then rebuild with no edits\n' +
              'compared against the source tree',
            result: 'identical - navigation alone must be the identity'
          }
        ],
        answer: '50 edits at depth 12 cost 600 rebuilt nodes the direct way and 12 through a zipper, and the ' +
          'ratio is exactly the edit count at every depth tested. The zipper does not make the rebuild cheaper; ' +
          'it defers it until the focus leaves, which turns O(k · depth) into O(k + depth). That is the ' +
          'difference between an editor that allocates a tree per keystroke and one that does not, and it is ' +
          'why a zipper is the immutable answer to "I need a mutable cursor".'
      },
      {
        title: 'What a zipper is not',
        goal: 'Invert the first example: find the cases where the zipper is the wrong tool, and be precise about ' +
          'the property that causes each.',
        setup: 'The same tree and the same zipper, used in three ways it does not support well.',
        steps: [
          {
            do: 'Bounce in and out of the root between edits.',
            why: 'The saving came from staying put, so leaving repeatedly should remove it.',
            work: 'edit, toRoot, re-focus, edit, toRoot, …\n' +
              '50 edits × 12 nodes = 600 nodes rebuilt',
            result: 'exactly the direct method - the zipper adds nothing and costs a little'
          },
          {
            do: 'Try to observe another zipper\'s edit.',
            why: 'It looks like a cursor, and a cursor into shared state would see changes.',
            work: 'a zipper holds node references from the version it was created in\n' +
              'editing through zipper A produces a new tree; zipper B still holds the 12 old nodes',
            result: 'two zippers into one tree are two independent views, not two cursors'
          },
          {
            do: 'Check what the zipper keeps alive.',
            why: 'This is the garbage-collection problem from 9.1 seen from the other side.',
            work: 'the focus and every crumb hold real nodes\n' +
              'the focus and all 12 crumbs pin that whole version',
            result: 'a forgotten zipper is a retained snapshot'
          },
          {
            do: 'Confirm the source really is untouched.',
            why: 'It is the property that makes the previous point true, and it is the one to test.',
            work: 'edit through a zipper 50 times, then inspect the original tree\n' +
              'the original\'s value at the edited path',
            result: 'unchanged - which is why the old version is still reachable'
          },
          {
            do: 'Name the case where a zipper is right.',
            why: 'The failures above all share one shape.',
            work: 'many operations at one position, then move on → zipper\n' +
              'one operation at each of many positions → path copying is simpler\n' +
              'several parties editing 1 live structure → a mutable reference to the current version',
            result: 'locality of edits is the precondition, not immutability'
          }
        ],
        answer: 'A zipper wins when edits are local and loses the moment they are not: bouncing to the root ' +
          'between edits costs the same 600 nodes as the direct method, with extra bookkeeping. It is also not ' +
          'a shared cursor - two zippers into one tree are two independent views, because each holds nodes from ' +
          'the version it was made in - and a long-lived one pins that version against collection. The ' +
          'precondition is locality of edits, and the property that makes the awkward cases awkward is exactly ' +
          'the one that makes the good case work.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
