/** Concepts for the trie, finger-tree and zipper sections (M09.4-M09.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'bit-partitioned-tries': [
      {
        term: 'Five bits per level, thirty-two children per node',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["a 32-bit hash"] --> B["take 5 bits: which of<br/>32 children?"]',
            '    B --> C["take the next 5"]',
            '    C --> D["and the next"]',
            '    D --> E["32 bits are used up<br/>after seven levels"]',
            '    E --> F["so a lookup is at most seven<br/>steps, whatever the size"]'
          ].join('\n'),
          caption: 'A wide branching factor makes the tree shallow, and shallow is what makes path copying cheap: a new version copies seven nodes rather than thirty.'
        },
        plain: 'Consume 5 bits of the key at each level, so a 32-bit key is exhausted in seven levels at the very worst.',
        formal: 'depth ≤ ⌈32/5⌉ = 7, and 32^7 = 34 359 738 368',
        readAs: 'Consuming 5 bits of the hash per level, a 32-bit hash runs out after 7 levels — and 7 levels ' +
          'of 32-way branching addresses 34 billion entries. The tree is effectively constant depth for ' +
          'any real map.',
        detail: 'This is where "O(log₃₂ n)" comes from and why immutable collections get away with calling ' +
          'themselves effectively constant time. The claim is fair rather than a fudge: seven levels covers ' +
          'thirty-four billion elements, so the depth is bounded by a small number in any program that fits in ' +
          'memory. What is *not* constant is the work per level, and a wide node makes that the thing to worry ' +
          'about - which is what the sparse layout is for.',
        example: '15 695 keys reach depth 6 of a possible 7; 200 000 vector elements need four levels of 32.'
      },
      {
        term: 'popcount(bitmap & (bit − 1)) is the whole structure',
        plain: 'Store a 32-bit occupancy map and a dense array of only the occupied children; that expression is the index.',
        formal: 'slot = popcount(bitmap & (bit − 1)), where bit = 1 << fragment',
        readAs: 'Mask off every bit below the one you want, then count the bits that remain set — that count ' +
          'is the index into the compact child array. popcount is "how many bits are 1", and it is a ' +
          'single CPU instruction.',
        detail: 'Without it a 32-way node is a 32-slot array that is almost entirely empty, and the structure ' +
          'allocates hundreds of bytes per node forever. With it a node holding three children is an array of ' +
          'three, and finding the right one is a mask, an AND and a population count - no search and no ' +
          'indirection. It is the single line that makes the whole family practical, and it is why hardware ' +
          'popcount instructions matter to a data structure at all.',
        example: 'Mean fan-out 4.99 across 3 930 nodes: sparse 219 872 bytes against 1 037 520 for dense 32-slot nodes.'
      },
      {
        term: 'A node array with holes is a bug, not an optimisation',
        plain: 'The child array length must equal the popcount of the bitmap, always.',
        formal: 'children.length === popcount(bitmap) is the invariant',
        readAs: 'The array holds exactly as many children as the bitmap has bits set — no gaps and no spares. ' +
          'That is what makes the node compact, and it is the first thing a bug in the bitmap ' +
          'arithmetic breaks.',
        detail: 'The bitmap and the array are two representations of the same fact, and the index arithmetic ' +
          'assumes they agree. If an insertion updates the bitmap without splicing the array - or splices at ' +
          'the wrong offset - every subsequent lookup on that node reads a neighbour\'s child, which returns ' +
          'plausible wrong values rather than crashing. Asserting the invariant is one line and it is the ' +
          'difference between a bug found in a test and one found in production.',
        example: 'The shape report counts nodes whose array length disagrees with their popcount; it must be zero.'
      },
      {
        term: 'Hash collisions still have to be handled',
        plain: 'Two keys whose hashes agree in all 32 bits can never be separated by going deeper.',
        formal: 'at shift ≥ 32 the trie is exhausted and the entry must hold a bucket',
        detail: 'The depth bound is exactly what creates this case: once the key material runs out there is no ' +
          'further level to push the colliding keys into, so the leaf has to hold a list. It is rare and it is ' +
          'not optional - a HAMT that recurses on equal hashes loops forever, and one that overwrites loses ' +
          'keys silently. The same situation arises whenever the hash is weak, which makes this a correctness ' +
          'requirement rather than a tail case.',
        example: '400 keys placed and 400 retrieved, with the collision path exercised deliberately.'
      },
      {
        term: 'The persistent vector is the same trie, indexed by position',
        plain: 'Use the bits of the index instead of the bits of a hash, and the trie becomes an array.',
        formal: 'element i lives at path (i >>> shift) & 31 for shift = level·5 down to 0',
        readAs: 'Read the index 5 bits at a time, from the top down: shift the bits you want into place and ' +
          'mask off the rest. Each group of 5 bits picks one of 32 children.',
        detail: 'Nothing about the structure changes; only where the five-bit fragments come from. Because ' +
          'positions are dense the nodes are full rather than sparse, so the bitmap is unnecessary and the ' +
          'child array is a plain 32-slot block. That is what makes indexing a handful of array reads and why ' +
          'Clojure, Scala and Immutable.js all ship this rather than a balanced tree of elements.',
        example: '200 000 elements in four levels of 32, and any index reachable in three pointer hops plus a read.'
      },
      {
        term: 'The tail buffer is where the appends go',
        plain: 'Keep the last up-to-32 elements outside the trie; thirty-one appends in thirty-two touch nothing else.',
        formal: 'append writes the tail; every 32nd append pushes the full tail into the trie',
        detail: 'This is a small detail that carries most of the observed performance, and it is easy to omit ' +
          'when reimplementing from a description. Without it every append rebuilds a root-to-leaf path; with ' +
          'it the common case is one array copy of at most 32 elements and no trie work at all. The same idea ' +
          'appears as a write buffer in an LSM tree and as a partial block in a chunked list - defer the ' +
          'structural work until there is a whole unit of it to do.',
        example: '20 000 appends allocate 1 840 nodes; without the tail every one of them would rebuild a path.'
      },
      {
        term: 'Transients: own your nodes and mutate them',
        plain: 'A batch build marks the nodes it creates and overwrites them in place, then withdraws the licence.',
        formal: 'a node may be mutated iff its owner token matches the batch\'s',
        detail: 'The persistent structure is correct because nobody else can see a node the batch just created, ' +
          'and the owner token is how that is checked. Every node created during the batch is fair game; every ' +
          'node inherited from before it is copied as usual. Once the batch ends the token is discarded and the ' +
          'result is an ordinary persistent value. It is the mechanism behind Clojure\'s transients and ' +
          'Immutable.js\'s `withMutations`, and it is why building a large immutable collection is not slow.',
        example: '20 000 appends: 1 840 nodes allocated persistently against 645 with a transient - 2.85× fewer.'
      },
      {
        term: '"Immutable is slow" is a claim about allocation',
        plain: 'The asymptotics are fine; what costs is the garbage a path per update produces.',
        formal: 'O(log₃₂ n) time, O(log₃₂ n) allocation, and allocation is the term that hurts',
        readAs: 'Log to base 32 is a small number — 7 at most — so both figures are effectively constant. The ' +
          'one that costs you is the allocation, because it is real garbage rather than just pointer ' +
          'chasing.',
        detail: 'A persistent update is a logarithm of pointer writes, which is not slow by any reasonable ' +
          'standard. What is expensive is that each of those writes is a *new object*, so a tight update loop ' +
          'produces garbage at a rate the collector notices. That is the whole reason transients exist, and ' +
          'recognising it is what turns "immutable data structures are slow" into the more useful "batch your ' +
          'writes and the difference disappears".',
        example: 'The same 20 000 appends, the same answer, and 1 195 nodes written in place instead of allocated.'
      }
    ],

    'finger-trees': [
      {
        term: 'Digits at the ends, a tree in the middle',
        plain: 'Each spine level holds one to four elements at each end and a finger tree of 2-3 nodes between them.',
        formal: 'Deep(prefix : Digit, middle : FingerTree of Node, suffix : Digit)',
        detail: 'The digits are the reason both ends are cheap: a push or a pop normally just grows or shrinks ' +
          'a small array, and only touches the level below when a digit overflows past four or empties. Because ' +
          'each level holds 2-3 nodes of the level beneath, the number of elements per spine level grows ' +
          'geometrically, so the deeper levels are disturbed exponentially less often. That is the whole ' +
          'amortisation argument, and it is visible in the shape of a built tree.',
        example: '3 000 elements sit in a spine 7 levels deep holding 26 elements in its digits; the rest are in 2-3 nodes.'
      },
      {
        term: 'The monoid annotation is the idea worth stealing',
        plain: 'Cache the product of everything below each node, and a predicate on that cache answers a family of queries.',
        formal: 'measure(node) = combine(measure(children)); split walks down using only the cache',
        detail: 'This is the part to take away even if you never write a finger tree. The structure does not ' +
          'know what a size, a priority or an interval is - it knows how to combine two measures and how to ' +
          'find the point where a running product first satisfies a predicate. Choosing the measure chooses the ' +
          'query, and one implementation then serves four data structures. The same trick makes a segment tree ' +
          'generic in M08.7; here it also makes split and concat work.',
        example: 'The same 1 000 items measure 1 000 under size, 49 956 under sum, 999 under max priority and 499 under max end.'
      },
      {
        term: 'Split is a descent, not a scan',
        plain: 'Find where a running measure first crosses a predicate by reading cached measures at each node.',
        formal: 'split(t, p) = (before, from) with concat(before, from) = t',
        detail: 'At each level the walk asks three questions - does the predicate turn inside the prefix, the ' +
          'middle, or the suffix - and each is answered by one cached measure and a combine. Nothing looks at an ' +
          'individual element until the very last step inside a digit. That is why split is O(log n) rather ' +
          'than O(n), and why the reconstruction property is the right test: concatenating the two halves must ' +
          'give back exactly the original.',
        example: 'Splitting a 3 000-element sequence in half visits 14 nodes; putting it back allocates 20.'
      },
      {
        term: 'One structure, four data structures',
        plain: 'Size gives a sequence, max gives a priority queue, a key gives an ordered set, a max end gives an interval map.',
        formal: 'the code is identical; only `identity`, `combine` and `measure` change',
        detail: 'A priority queue falls out by measuring each element by its priority under max: the root\'s ' +
          'measure is the largest priority in the whole sequence, and splitting on "measure ≥ that" lands ' +
          'exactly on the element holding it. An interval map falls out by measuring the maximum interval end. ' +
          'Neither needs a line of new structural code, which is the strongest possible demonstration that the ' +
          'annotation and not the tree is where the generality lives.',
        example: '400 items pushed in arrival order and popped by split come out in exactly descending priority.'
      },
      {
        term: 'Concatenation is the operation nothing else offers cheaply',
        plain: 'Two finger trees join in O(log(min)) by merging their facing digits into 2-3 nodes.',
        formal: 'append(left, middle, right) recurses down both spines at once',
        detail: 'Balanced search trees concatenate awkwardly and arrays concatenate linearly, so a structure ' +
          'that does it in a logarithm of the smaller side is genuinely unusual - and it is what makes finger ' +
          'trees the standard implementation of a functional sequence with `++`. The subtlety is that the ' +
          'middle elements have to be folded onto the correct side: prepending them onto the right-hand tree is ' +
          'a right fold, and doing it as a left fold silently reverses a run.',
        example: 'Two independently built trees of 700 and 900 elements join with their order intact.'
      },
      {
        term: 'The cost of the generality',
        plain: 'Every node carries a cached measure, and every rebuild recomputes it.',
        formal: 'one extra field per node plus one combine per structural change',
        detail: 'Nothing here is free. A finger tree is bigger than a cons list, its constants are larger than ' +
          'a plain deque\'s, and the measure has to be recomputed whenever a node is rebuilt - which is what ' +
          'the amortisation is already paying for. Reaching for one when a deque would do is the classic ' +
          'mistake; reaching for one when you need a sequence that also answers a positional or priority query ' +
          'is exactly right.',
        example: '3 000 elements build a 7-level spine; a plain cons list would be 3 000 cells and answer none of the queries.'
      },
      {
        term: 'The measure must actually be a monoid',
        plain: 'Associative with an identity, or the cached values do not compose.',
        formal: '(a ⊕ b) ⊕ c = a ⊕ (b ⊕ c) and e ⊕ a = a',
        readAs: 'The two rules a measurement must obey: brackets do not matter, and there is an identity ' +
          'element that changes nothing. Any operation with those two properties can be cached in a ' +
          'finger tree — which is why the same code counts, sums and takes maxima.',
        detail: 'The whole structure rests on being able to combine a node\'s cached measure with its ' +
          'neighbours\' in any grouping, because the grouping is whatever the tree happens to be. A ' +
          'non-associative measure gives answers that depend on the shape rather than on the contents, which ' +
          'means they change when an unrelated insertion rebalances something. Subtraction and average are the ' +
          'two that people try and that do not work.',
        example: 'Max, min, sum, gcd and "rightmost" are monoids; difference and mean are not.'
      },
      {
        term: 'Where it actually appears',
        plain: 'Haskell\'s Data.Sequence, Scala\'s finger-tree-backed collections, and interval indexes in editors.',
        formal: 'the canonical reference is Hinze and Paterson (2006)',
        detail: 'The most common real use is the one that looks least like a finger tree: a text editor that ' +
          'needs to index by character offset *and* by line number keeps one sequence annotated with a measure ' +
          'carrying both, and answers "line 400" and "character 9 512" with the same split. That is the pattern ' +
          'to recognise - not the tree, but the moment when two different indexes over the same sequence are ' +
          'wanted at once.',
        example: 'A measure of (characters, newlines) answers both "go to offset" and "go to line" from one structure.'
      }
    ],

    zippers: [
      {
        term: 'A focus plus a context',
        plain: 'Keep the subtree you are looking at, and a stack of crumbs recording how you got there.',
        formal: 'Zipper = (focus, [Crumb]) where a crumb holds the parent value and the siblings on each side',
        detail: 'The crumb is what makes going back up possible without a parent pointer, which is the thing an ' +
          'immutable tree cannot have - a parent pointer would have to be rewritten in the child whenever the ' +
          'parent changed, which is a cycle. Storing the way back in the traversal rather than in the structure ' +
          'breaks the cycle, and the result is a value you can pass around, store and compare like any other.',
        example: 'Focusing two levels down records a path of [0, 0] and two crumbs holding the siblings at each level.'
      },
      {
        term: 'It is literally a derivative',
        plain: 'The type of one-hole contexts for a data type is its formal derivative.',
        formal: 'for T(x) = 1 + x·T(x)², the context type is T\'(x)',
        detail: 'The observation is Huet\'s and McBride\'s, and it is more than a curiosity: it tells you what ' +
          'the crumb type must be for *any* structure without having to invent it. Differentiate a product and ' +
          'you get a sum of the ways to poke a hole in each factor - which is exactly "the parent value, the ' +
          'siblings to the left, the siblings to the right". It is the reason zippers can be derived ' +
          'mechanically rather than designed.',
        example: 'A binary tree\'s crumb is "value plus the other child plus which side I came from" - the derivative, written out.'
      },
      {
        term: 'Local edits cost O(1), not O(depth)',
        plain: 'An edit replaces the focus and touches nothing else; the path is rebuilt once, when you ask for the root.',
        formal: 'k edits under one focus: O(k + depth) rather than O(k · depth)',
        readAs: 'Walk to the spot once and make all k edits there, instead of descending from the root for ' +
          'each one. The depth is paid once instead of k times.',
        detail: 'This is the property the whole idea exists for. A naive persistent "update at this path" ' +
          'rebuilds the path on every single edit, so a hundred edits under one subtree pay a hundred paths. A ' +
          'zipper defers the rebuild until the focus leaves, so the same hundred edits pay one. That is the ' +
          'difference between an editor that redraws smoothly and one that allocates a tree per keystroke.',
        example: '50 edits at depth 12: 12 nodes rebuilt with a zipper against 600 without - exactly 50×.'
      },
      {
        term: 'Navigating without editing is the identity',
        plain: 'Move anywhere you like and rebuild; the result must be the original tree.',
        formal: 'toRoot(moves(focus(t))) = t',
        readAs: 'Focus somewhere, move about, walk back up, and you get the original tree back. That round ' +
          'trip is what makes a zipper a view of a structure rather than a copy of one.',
        detail: 'This is the property to test first, because it catches every sibling-ordering mistake at once. ' +
          'The left siblings are stored reversed so the nearest is at the head - that is what makes `left` an ' +
          'O(1) move - and getting the reversal wrong on the way back out produces a tree with the same nodes ' +
          'in the wrong order, which looks fine until somebody reads it. A random walk followed by a rebuild ' +
          'finds it immediately.',
        example: '200 random moves through a tree of depth 6, then rebuild: identical to the source.'
      },
      {
        term: 'The immutable answer to "I need a mutable cursor"',
        plain: 'Editors, DOM diffing and traversals all want a movable position; a zipper is one that is also a value.',
        formal: 'the cursor is data, so it can be stored, compared, undone and sent',
        detail: 'Because the zipper is an ordinary immutable value, keeping the previous one gives undo for ' +
          'free, and two of them can be compared to see what moved. A mutable cursor into a mutable tree gives ' +
          'none of that and additionally becomes invalid whenever the tree changes underneath it. The trade is ' +
          'that a zipper is a *position in a specific version*, so it does not follow the structure forward - ' +
          'which is usually what you wanted anyway.',
        example: 'A list zipper is `before` reversed, the focus, and `after` - which is a gap buffer with lists.'
      },
      {
        term: 'Lenses are the general case',
        plain: 'A zipper is a cursor for one structure; a lens is a composable getter/setter pair for any nesting.',
        formal: 'up and down are composition; a lens abstracts the pair over arbitrary shapes',
        detail: 'Once the "focus plus context" pattern is visible it turns up everywhere in immutable code, ' +
          'usually under the name of optics: a lens focuses a field, a prism focuses a case of a sum, and ' +
          'composing them builds a path into a deeply nested value that can be read and written. The value of ' +
          'seeing the zipper first is that it makes the composition concrete - moving down twice is exactly ' +
          'composing two lenses.',
        example: 'React and Redux code that does `{...state, a: {...state.a, b: x}}` is hand-writing a two-level lens.'
      },
      {
        term: 'The rebuild is where the cost lands',
        plain: 'Every `up` reconstructs one parent, so leaving the focus costs the depth once.',
        formal: 'toRoot is O(depth) and is the only non-constant operation',
        detail: 'It is worth being precise that the zipper does not remove work, it *batches* it: the path still ' +
          'has to be rebuilt, once, when the focus finally leaves. The consequence for real code is that the ' +
          'expensive thing is bouncing in and out of the root repeatedly, and the cheap thing is doing all the ' +
          'work you need at a position before moving on. That is the same locality advice as everywhere else, ' +
          'arrived at from an unusual direction.',
        example: '50 edits and one rebuild: 12 nodes. 50 edits and 50 rebuilds: 600 nodes, for the same result.'
      },
      {
        term: 'A zipper is scoped to a version',
        plain: 'It refers to one immutable tree; later updates elsewhere do not move it.',
        formal: 'the focus and crumbs hold node references from the version it was created in',
        detail: 'This is a feature and occasionally a surprise. Because a zipper holds actual nodes, it keeps ' +
          'that version alive for as long as it exists - which is exactly the garbage-collection issue from ' +
          '9.1, seen from the other side - and it will not observe edits made through a different zipper. If ' +
          'two editors need to see each other\'s changes, the zipper is the wrong abstraction and a shared ' +
          'mutable reference to the current version is the right one.',
        example: 'Editing through a zipper leaves the source tree byte-for-byte identical, which is the test that proves it.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
