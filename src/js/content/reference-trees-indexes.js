/** Reference blocks for B-trees and augmented trees (M04.7-M04.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'b-trees': {
      summary: 'A search tree whose node is one unit of I/O, so the branching factor comes from the ' +
        'page size — and, in the B+ form, whose leaves are chained into the range scan every database ' +
        'index depends on.',
      intuition: 'A page read costs the same whether you use one byte of it or all of it, so make the ' +
        'node a page and fill it with children. The height falls with log_B rather than log₂, which ' +
        'is why a million keys are three reads deep.',
      formulation: {
        equations: [
          {
            label: 'The order',
            expr: 'order = ⌊(page + key) / (key + pointer)⌋',
            terms: [
              { sym: '4 KB, 8-byte keys', meaning: '256 children' },
              { sym: '4 KB, 64-byte keys', meaning: '57 children — a whole extra level at a million keys' }
            ]
          },
          {
            label: 'Lookup cost',
            expr: 'page reads = ⌈log_B(n)⌉ with full pages, ⌈log_{B·fill}(n)⌉ in reality',
            terms: [
              { sym: 'fill', meaning: '0.502 after a sequential load, 0.686 after a random one' },
              { sym: 'measured', meaning: '3 reads for 10⁶ keys on a 4 KB page' }
            ]
          },
          {
            label: 'Range scan',
            expr: 'reads = height + ⌈rows / rows-per-leaf⌉',
            terms: [
              { sym: 'measured', meaning: '10 rows cost 3 reads, 10 000 rows cost 81' }
            ]
          }
        ],
        derivation: [
          'Every split leaves two half-full pages. A sequential load never revisits the left half, so ' +
            'occupancy settles near 50%; a random load refills them and converges on ln 2 = 69.3%.',
          'A leaf split copies its separator upward because that key is data; an internal split moves ' +
            'its median upward because a separator is not.',
          'The leaf chain means a scan pays the descent once and then reads one page per leaf-full of ' +
            'rows, touching no internal page again.'
        ]
      },
      invariants: [
        {
          name: 'Every leaf is at the same depth',
          why: 'It is what makes the read cost uniform, and it is what splitting upward preserves.',
          breaks: 'A split that grows a subtree rather than the root puts leaves at different depths.'
        },
        {
          name: 'Every node except the root holds at least ⌈(order − 1)/2⌉ keys',
          why: 'It keeps the branching factor real rather than nominal.',
          breaks: 'A deletion that neither borrows nor merges leaves pages that hold almost nothing.'
        },
        {
          name: 'A node with k keys has exactly k + 1 children',
          why: 'The separators partition the key space between the children.',
          breaks: 'Off-by-one in a split leaves a child unreachable and its keys lost.'
        }
      ],
      complexity: [
        { operation: 'search', average: 'Θ(log_B n)', worst: 'Θ(log_B n)', note: '3 page reads at 10⁶ keys, 4 KB pages' },
        { operation: 'insert', average: 'Θ(log_B n)', worst: 'Θ(log_B n)', note: 'a split can propagate to the root' },
        { operation: 'delete', average: 'Θ(log_B n)', worst: 'Θ(log_B n)', note: 'borrow from a sibling, or merge' },
        { operation: 'range scan', average: 'Θ(log_B n + k/B)', worst: 'same', note: 'one descent, then the leaf chain' },
        { operation: 'bulk load', average: 'Θ(n)', worst: 'Θ(n)', note: 'one pass over sorted input, no splits' },
        { operation: 'space', average: 'Θ(n / fill)', worst: 'Θ(2n)', note: 'occupancy decides the index size' }
      ],
      failureModes: [
        {
          symptom: 'An index is twice the expected size after a bulk import.',
          cause: 'Rows were inserted in sorted order, so every page split down the middle and never refilled.',
          fix: 'Bulk load, or rebuild the index afterwards — occupancy goes from 50% to the requested fill factor.'
        },
        {
          symptom: 'A query that returns many rows is far slower than the row count suggests.',
          cause: 'The plan is doing an index seek per row instead of a range scan along the leaf chain.',
          fix: 'A scan of 10 000 rows costs 81 page reads; 10 000 seeks cost 30 000.'
        },
        {
          symptom: 'Changing a key column from an integer to a string added an I/O per lookup.',
          cause: 'The key appears in the order formula, so a wider key means fewer children and another level.',
          fix: 'Narrow the key, or use prefix compression and suffix truncation on the separators.'
        },
        {
          symptom: 'Deletions leave the index large and slow.',
          cause: 'Pages emptied without merging, so the branching factor collapsed while the height stayed.',
          fix: 'Implement borrow and merge on underflow; check the fill invariant in tests.'
        }
      ],
      inTheWild: [
        { system: 'InnoDB, PostgreSQL, SQLite', how: 'B+ trees with 16 KB, 8 KB and configurable pages — the clustered index is the table' },
        { system: 'Filesystems: NTFS, ext4, XFS, Btrfs', how: 'directory indexes and extent maps, sized to the block' },
        { system: 'LMDB and other memory-mapped stores', how: 'B+ trees where the page is a memory page and copy-on-write gives the snapshot' }
      ],
      sources: [
        { title: 'Bayer, McCreight — Organization and maintenance of large ordered indices (1972)', where: 'the original B-tree paper' },
        { title: 'Comer — The ubiquitous B-tree (ACM Computing Surveys 1979)', where: 'the survey that named the variants' },
        { title: 'Graefe — Modern B-tree techniques (2011)', where: 'compression, concurrency and the practical engineering' },
        { title: 'Cormen et al. — Introduction to Algorithms, ch. 18', where: 'split and merge, with the disk-access model' }
      ]
    },

    'augmented-trees': {
      summary: 'An ordinary balanced tree with an extra field per node, maintained through every ' +
        'rotation — and one rule that decides which fields are possible at all.',
      intuition: 'If a field can be recomputed from the node and the same field on its two children, ' +
        'a rotation can repair it in constant time. If it cannot, the repair costs a subtree walk and ' +
        'the structure stops being logarithmic.',
      formulation: {
        equations: [
          {
            label: 'The rule',
            expr: 'field(node) = f(node, field(left), field(right))',
            terms: [
              { sym: 'passes', meaning: 'size, sum, min, max, height, max-endpoint' },
              { sym: 'fails', meaning: 'median, distinct count, k-th value' }
            ]
          },
          {
            label: 'Order statistics',
            expr: 'select(k): descend by comparing k against size(left) + 1',
            terms: [
              { sym: 'measured', meaning: '13 node visits at n = 100 000' }
            ]
          },
          {
            label: 'Interval stabbing',
            expr: 'maxEnd(subtree) < point ⇒ prune the whole subtree',
            terms: [
              { sym: 'measured', meaning: '22 node visits over 18 211 intervals, 6 subtrees pruned' }
            ]
          }
        ],
        derivation: [
          'A rotation changes the children of exactly two nodes, so exactly two fields need ' +
            'recomputing — the one that moved down first, then the one that moved up.',
          'A range query that uses the stored subtree sum adds whole subtrees and descends only the ' +
            'two boundary paths, which is O(log n) rather than O(range).',
          'A field that fails the rule can often be replaced by one that passes and answers the same ' +
            'question by descent: the median is select(⌈n/2⌉).'
        ]
      },
      invariants: [
        {
          name: 'Every stored field equals what its children imply',
          why: 'A stale field returns plausible wrong answers rather than failing.',
          breaks: 'Recomputing the upper node of a rotation before the lower one leaves it stale.'
        },
        {
          name: 'The field is recomputed on every structural change',
          why: 'Insertion, deletion and rotation all change somebody\'s children.',
          breaks: 'Updating on insert but not on rebalance is the classic partial implementation.'
        },
        {
          name: 'The query uses the field rather than merely carrying it',
          why: 'A stored subtree sum with a walk-everything query costs the same as no augmentation.',
          breaks: '1 020 node visits instead of 51 for the same range sum.'
        }
      ],
      complexity: [
        { operation: 'select(k)', average: 'Θ(log n)', worst: 'Θ(log n)', note: '13 visits at n = 100 000' },
        { operation: 'rank(key)', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'the mirror of select' },
        { operation: 'stab(point)', average: 'Θ(log n + k)', worst: 'Θ(n)', note: 'k is the number of hits' },
        { operation: 'rangeSum(lo, hi)', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'whole subtrees added, not walked' },
        { operation: 'insert / delete', average: 'Θ(log n)', worst: 'Θ(log n)', note: 'plus O(1) field repair per rotation' },
        { operation: 'space', average: 'Θ(n)', worst: 'Θ(n)', note: 'one field per node per augmentation' }
      ],
      failureModes: [
        {
          symptom: 'select(k) returns a key that is not the k-th smallest.',
          cause: 'A rotation recomputed the sizes in the wrong order, so the upper node read a stale value.',
          fix: 'Recompute the node that moved down first; assert every field against its children in tests.'
        },
        {
          symptom: 'A range sum is correct but no faster than a scan.',
          cause: 'The query visits every node in the range instead of adding whole subtrees.',
          fix: 'Carry the bounds down the recursion and return the stored sum when a subtree is fully inside.'
        },
        {
          symptom: 'An augmentation idea will not stay correct however it is patched.',
          cause: 'The field is not computable from the node and its two children.',
          fix: 'Apply the rule explicitly; look for a maintainable field that answers the same question.'
        },
        {
          symptom: 'Traversals got slower after adding a second augmentation.',
          cause: 'The node grew past a cache line, so every descent costs an extra fetch.',
          fix: 'Measure the node size; drop fields that are not queried, or split the cold ones out.'
        }
      ],
      inTheWild: [
        { system: 'Linux kernel augmented rbtrees', how: 'max-endpoint intervals for the virtual memory area lookup' },
        { system: 'Haskell Data.Map, Scala TreeMap', how: 'weight-balanced trees whose stored sizes give index lookup for free' },
        { system: 'Genome browsers and schedulers', how: 'interval trees for "which features overlap this position"' }
      ],
      sources: [
        { title: 'Cormen et al. — Introduction to Algorithms, ch. 14', where: 'the augmentation recipe, order-statistic and interval trees' },
        { title: 'de Berg et al. — Computational Geometry, ch. 10', where: 'interval and segment trees in their geometric setting' },
        { title: 'Linux Documentation/core-api/rbtree.rst', where: 'the augmented rbtree callbacks as shipped' },
        { title: 'Adams — Efficient sets: a balancing act (JFP 1993)', where: 'weight-balanced trees, where the size field is the balance rule' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
