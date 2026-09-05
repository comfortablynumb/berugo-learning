/** Concepts for the prefix-structure sections (M06.1-M06.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    tries: [
      {
        term: 'One node per distinct prefix',
        diagram: {
          definition: [
            'flowchart LR',
            '    R["root — the empty prefix"] --> C["c"]',
            '    C --> CA["ca"]',
            '    CA --> CAT["cat ✓"]',
            '    CA --> CAR["car ✓"]',
            '    CAR --> CART["cart ✓"]'
          ].join('\n'),
          caption: 'The shared prefix is stored once, not once per key. Everything a trie is good at follows from that, and so does everything it is bad at.'
        },
        plain: 'Every node is a prefix of at least one key, and every prefix of a key is a node.',
        formal: 'nodes = |{ p : p is a prefix of some key }|',
        readAs: 'The trie holds one node per distinct prefix of any key. The outer bars mean "how ' +
          'many", the braces are a set, and the colon reads "such that". So the whole line is "the ' +
          'count of strings p such that p is a prefix of some key".',
        detail: [
          'This is the whole data structure stated once, and every property follows from it.',
          'The node count is the number of distinct prefixes, not the number of keys and not the ' +
            'number of characters. Take 883 English words: they hold 4 732 characters between them ' +
            'and produce 2 562 nodes, because the words share their beginnings.',
          'Lookup is a walk down that sequence of prefixes, so it costs one step per query ' +
            'character and never touches a key it is not spelling.',
          'It also means the structure is entirely determined by the key set. Insertion order ' +
            'changes nothing, which is a property no comparison-based tree has.'
        ],
        example: '2 562 nodes for 883 words: 2.90 nodes per key, 0.54 per character.'
      },
      {
        term: 'Terminal markers, not sentinels',
        plain: 'A node is a key when it carries a terminal flag, not when it is a leaf.',
        formal: 'key(node) ⇔ node.terminal',
        readAs: 'A node stores a key exactly when it is marked terminal. Both directions matter: an unmarked ' +
          'node is a waypoint even if it spells a real word, and a marked node is a key even if it has ' +
          'children below it.',
        detail: [
          'The alternative is to append a sentinel character to every key so that keys always end ' +
            'at leaves.',
          'It works and it costs a node per key. "an" and "ant" become "an$" and "ant$", which ' +
            'share only "an" and need two extra nodes where a terminal flag needs one bit each.',
          'The flag also keeps the invariant simple: a node is a key or it is not, independent of ' +
            'whether anything hangs below it.',
          'That matters for deletion, where the node for "an" has to survive the removal of "ant".'
        ],
        example: 'insert("an") then insert("ant") adds one node; with a sentinel it would add two.'
      },
      {
        term: 'The prefix query is the point',
        plain: 'Every key under a prefix is the subtree below the prefix node, in sorted order.',
        formal: 'withPrefix(p) costs |p| + |answer|, independent of the dictionary size',
        readAs: 'A prefix query costs the length of the prefix to walk down, plus the size of what it returns ' +
          'to collect. The bars mean length. Nothing in that depends on how many keys the trie holds, ' +
          'which is what a hash table cannot match.',
        detail: [
          'This is the query a hash table cannot answer at all, because hashing deliberately ' +
            'destroys the ordering it needs.',
          'A hash table asked for every key beginning with "con" has to test all 883 keys. The ' +
            'trie walks three nodes and then enumerates a subtree of 22 answers.',
          'That asymmetry is the actual reason to reach for a trie, and it generalises.',
          'Anything that is a downward-closed question about key structure — prefixes, ordered ' +
            'ranges, longest match — is cheap here and impossible there.'
        ],
        example: '"con" walks 3 nodes and enumerates 22 completions out of 883 words.'
      },
      {
        term: 'Not a faster hash table',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["is this exact key present?"] --> B["hash table: one hash,<br/>one probe, less memory"]',
            '    C["which keys start with this?"] --> D["trie: walk the prefix,<br/>then read the subtree"]',
            '    D --> E["a hash table cannot answer<br/>this question at all"]'
          ].join('\n'),
          caption: 'On membership alone the hash table wins on every axis. Reach for a trie when the question is about prefixes, and never as a general-purpose replacement.'
        },
        plain: 'On membership alone a hash table wins on memory and on steps per lookup.',
        formal: 'trie: |query| character steps; hash: one hash, one probe',
        detail: [
          'The trie costs 92.8 bytes per key with map nodes, against roughly 40 for an ' +
            'open-addressing hash table at a sane load factor. A lookup takes 5.04 character steps ' +
            'against one hash and one probe.',
          'Each of those steps is a pointer chase into an unpredictable location, which is far ' +
            'worse for the cache than a single probe.',
          'The trie is not the faster structure. It is the structure that answers a different ' +
            'question, and a design that reaches for it to speed up membership has read the ' +
            'reputation rather than the numbers.'
        ],
        example: '92.8 bytes per key against a hash table\'s ~40, and 5.04 steps against 1.'
      },
      {
        term: 'The child-storage decision',
        plain: 'How a node stores its children changes the memory by an order of magnitude and the structure not at all.',
        formal: 'map; alphabet-sized array; sorted array + binary search',
        detail: [
          'A map per node costs one entry per real child.',
          'An array with a slot per alphabet symbol makes each step a single index and pays for ' +
            'every unused slot. A sorted child array pays nothing per symbol and costs ' +
            'log(children) comparisons per step.',
          'Over the same 2 562-node trie the three cost 81 968, 573 888 and 64 041 bytes — a ' +
            'factor of nine between the extremes for identical behaviour.',
          'This is the decision the "tries waste memory" reputation is really about, and it is a ' +
            'property of one layout rather than of the idea.'
        ],
        example: 'array 573 888 bytes, map 81 968, sorted 64 041 — same 2 562 nodes.'
      },
      {
        term: 'The alphabet tax',
        plain: 'An alphabet-sized node wastes a slot for every symbol the node does not use.',
        formal: 'waste = (|Σ| − children) / |Σ|',
        readAs: 'How much of an array-per-node is empty: the alphabet size minus the children actually ' +
          'present, over the alphabet size. Σ here is the alphabet, not a sum, and the bars are its ' +
          'size.',
        detail: [
          'A 256-slot node is the natural choice for arbitrary bytes, and it is the wrong one ' +
            'almost always, because fan-out is not uniform.',
          'A DNA sequence uses 4 of those 256 slots, which is 98% waste per node, and even English ' +
            'text leaves most nodes with a handful of children.',
          'The tax is worst exactly where tries are most attractive: deep structures over small ' +
            'alphabets.',
          'That is why every serious implementation either sizes the node by its fan-out or ' +
            'abandons the array entirely.'
        ],
        example: 'a 4-symbol DNA alphabet in a 256-slot node leaves 98% of the slots empty.'
      },
      {
        term: 'Longest-prefix match',
        plain: 'The longest key that is a prefix of a query, found in one downward walk.',
        formal: 'longestPrefixOf(t) = the deepest terminal node on the path spelling t',
        detail: [
          'The walk remembers the last terminal node it passed, and returns it when the path ends ' +
            'or falls off the trie. The whole query costs one pass rather than one lookup per ' +
            'candidate length.',
          'This is the routing-table query and the filesystem-mount query and the URL-router ' +
            'query, and every one of them is a linear scan of the rule table without it.',
          'It is also the operation that makes a trie the right structure for dispatch. That holds ' +
            'even when the key set is small enough that a hash table would be fine for membership.'
        ],
        example: 'longestPrefixOf("contracts") returns "contract" — one walk, not eight lookups.'
      },
      {
        term: 'Deletion has to prune',
        plain: 'Clearing the terminal flag is correct and leaves the node behind.',
        formal: 'after removal, walk up while childCount = 0 and not terminal',
        detail: [
          'A trie that never prunes stays correct forever — the key set it reports is exactly ' +
            'right — and its node count only grows.',
          'That is the failure mode. A long-running trie under an insert-delete workload silently ' +
            'accumulates the skeleton of every key it has ever held. The memory graph then looks ' +
            'like a leak with no leak in it.',
          'The fix is a walk back up the insertion path detaching any node that is neither a key ' +
            'nor a parent. It costs the same length as the deletion itself, and has to be written ' +
            'on purpose.'
        ],
        example: 'deleting 442 of 883 words takes the trie from 2 562 nodes to 1 504.'
      }
    ],

    'compressed-tries': [
      {
        term: 'A node only where the keys branch',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["plain trie:<br/>r → o → m → a → n → e"] --> B["six nodes for one chain"]',
            '    C["compressed:<br/>one edge labelled romane"] --> D["one node, one substring"]',
            '    D --> E["a node exists only where<br/>two keys actually diverge"]'
          ].join('\n'),
          caption: 'The node count stops depending on how long the keys are and starts depending on how many of them there are — which is usually a far smaller number.'
        },
        plain: 'Collapse every non-branching chain into one edge carrying a substring.',
        formal: 'nodes ≤ 2k − 1 for k keys, whatever the key length',
        readAs: 'A compressed trie over k keys has at most 2k − 1 nodes, no matter how long the keys are — ' +
          'because every internal node has at least two children, and a binary tree with k leaves has ' +
          'fewer than k internal nodes.',
        detail: 'A plain trie\'s node count is bounded by the total number of characters; a radix ' +
          'trie\'s is bounded by the number of keys, because a node exists only where the key set ' +
          'branches or a key ends. That bound is independent of key length, which is the whole ' +
          'point: doubling the length of every key doubles a plain trie and leaves a radix trie ' +
          'exactly as it was. The cost is that a step now compares a substring rather than a ' +
          'character, so lookups do more character work per node and fewer pointer chases.',
        example: '400 hex keys of 32 characters: 12 212 plain nodes against 544 radix nodes.'
      },
      {
        term: 'The saving tracks the distinct tails',
        plain: 'Compression removes the chain after keys diverge — not the prefix they share.',
        formal: 'saved ≈ Σ (length of each key\'s unshared tail) − 1 per key',
        readAs: 'Compression saves one node for every character in a key\'s unshared tail, less the one node ' +
          'that tail still needs. So the saving tracks how distinctive the keys are, not how many there ' +
          'are.',
        detail: 'This is the sentence that clears up the usual confusion. A plain trie already ' +
          'shares prefixes; that is what a trie *is*. What it cannot do is collapse the run of ' +
          'single-child nodes that follows the point where a key stops sharing, and that run is as ' +
          'long as the key\'s unique tail. So the compression factor is set by how long the tails ' +
          'are: 2.14× on English words, which diverge after two or three characters and then end ' +
          'quickly, and 22× on 32-character hex keys, which diverge immediately and then run on.',
        example: '400 words: 2.14×. 400 paths: 9.98×. 400 hex keys: 22.45×.'
      },
      {
        term: 'The split is the whole algorithm',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["inserting romulus against<br/>an edge labelled romane"] --> B["they agree on rom,<br/>then differ"]',
            '    B --> C["cut the edge at the agreement point"]',
            '    C --> D["rom becomes a node with<br/>two children: ane and ulus"]'
          ].join('\n'),
          caption: 'Every insertion is either a walk that fits an existing edge or one split. There is no rebalancing and no third case.'
        },
        plain: 'When a key and an edge agree for a while and then differ, the edge becomes two.',
        formal: 'edge → head(shared) + tail(rest), new leaf under head',
        readAs: 'Splitting an edge means cutting it into the part the new key shares and the part it does ' +
          'not, then hanging the new leaf off the join. The arrow is "becomes".',
        detail: 'Insertion has three cases and only this one is interesting. The shared part becomes ' +
          'a new internal node, the old child keeps the remainder of its label and hangs below it, ' +
          'and the incoming key hangs beside it. The case that gets written wrong is the one where ' +
          'the incoming key *ends* exactly at the split point: the new internal node is itself a ' +
          'key, and code that always creates a leaf for the new key loses it silently. That bug ' +
          'survives every "insert then look up" test that does not happen to insert a key which is ' +
          'a proper prefix of another.',
        example: 'inserting 400 English words performs 163 splits.'
      },
      {
        term: 'A prefix can end inside an edge',
        plain: 'A prefix query may stop halfway along an edge label, and that is still a valid prefix.',
        formal: 'descend(p) may return (node, partial) with p shorter than the edge',
        detail: 'This is the query-side counterpart of the split, and it breaks a naive port of the ' +
          'plain-trie code. Searching for "conn" in a trie whose edge reads "connect" ends four ' +
          'characters into a seven-character label. For membership the answer is no — the walk did ' +
          'not end on a node. For a prefix query the answer is the entire subtree below that edge, ' +
          'and the completion text has to be reconstructed as the consumed prefix plus the rest of ' +
          'the label. Code that treats a partial match as a miss returns nothing for exactly the ' +
          'prefixes a user is most likely to type.',
        example: 'the prefix "conn" ends inside the edge "connect" and still has completions.'
      },
      {
        term: 'PATRICIA is a radix trie over bits',
        plain: 'Make the alphabet {0, 1} and the edges bit ranges, and you have a routing table.',
        formal: 'longest-prefix match over binary strings = one downward walk',
        detail: 'An IPv4 prefix is a bit string with a length: 10.0.0.0/8 is the first eight bits of ' +
          '00001010…. "Which route applies to this address" is longest-prefix match over those bit ' +
          'strings, which is exactly the query a radix trie answers in one walk down. That is why ' +
          'routers do not scan their tables: with several matching prefixes the walk naturally ends ' +
          'at the deepest one, and the walk length is bounded by 32 bits regardless of how many ' +
          'routes there are.',
        example: '10.1.2.7 matches /0, /8, /16 and /24; the walk ends at /24 without comparing them.'
      },
      {
        term: 'Adaptive node sizes',
        plain: 'Choose the child layout by fan-out: a small list for few children, an array for many.',
        formal: 'node4; node16; node48; node256',
        detail: 'Fan-out is not uniform, and over 400 English words 94.5% of the radix nodes have ' +
          'four children or fewer. Sizing every node for the maximum therefore wastes almost all of ' +
          'the memory, and sizing them all as maps costs an indirection on the hot path. ART picks ' +
          'a layout per node from a small set and promotes a node when it outgrows its class, which ' +
          'is what makes a radix trie competitive with a hash table in a main-memory database — the ' +
          'small nodes, which are nearly all of them, stay small and stay scannable.',
        example: 'over 400 words: 533 node4, 30 node16, 1 node48, 0 node256.'
      },
      {
        term: 'Over-allocation is the price',
        plain: 'A node4 holds four slots whether it uses one or four.',
        formal: 'bytes = header + label + capacity(class) × slot',
        readAs: 'What one adaptive node costs: its header, its edge label, and the slots its size class ' +
          'reserves multiplied by the slot width. Growing a node means moving to the next class up.',
        detail: 'The adaptive scheme trades a little waste for a lot of locality, and on a small ' +
          'key set the trade can go the wrong way — a map node holding one child costs one entry ' +
          'where a node4 costs four slots. That is worth stating rather than hiding, because it ' +
          'sets where the technique belongs: ART is for a large index where the alternative is a ' +
          'pointer chase per level, not for a few hundred keys where a map is already small enough ' +
          'to sit in cache.',
        example: 'on 400 words the ART layout costs more bytes per key than plain map nodes.'
      },
      {
        term: 'Lookups do more character work',
        plain: 'Compression moves cost from pointer chases into substring comparisons.',
        formal: 'plain: |query| pointer steps; radix: fewer steps, each comparing a label',
        detail: 'This is the honest counterweight to the node-count column. A plain-trie lookup takes ' +
          'one step per query character, each a hash or an index into a child container. A radix ' +
          'lookup takes one step per *edge*, and each step compares the whole edge label against ' +
          'the query — so it does at least as many character comparisons and far fewer pointer ' +
          'dereferences. On a machine where a cache miss costs about eighty comparisons that trade ' +
          'is strongly favourable, which is a hardware argument rather than an algorithmic one, and ' +
          'the counters alone will not show it.',
        example: '400 words: 9.46 character steps per radix lookup against 5.56 in the plain trie.'
      }
    ],

    'dictionary-automata': [
      {
        term: 'Three pointers, whatever the alphabet',
        diagram: {
          definition: [
            'flowchart LR',
            '    A["an array-mapped trie node"] --> B["one slot per alphabet symbol —<br/>mostly empty"]',
            '    C["a ternary node: one symbol,<br/>and lo / eq / hi"] --> D["three pointers, always"]',
            '    D --> E["the alphabet size stops<br/>appearing in the memory cost"]',
            '    E --> F["which is what makes it usable<br/>on Unicode"]'
          ].join('\n'),
          caption: 'A 256-way node wastes almost all its slots on real text, and a Unicode-wide one is not affordable at all. Three pointers is the price regardless.'
        },
        plain: 'A ternary node holds one symbol and lo/eq/hi pointers, so the alphabet costs nothing.',
        formal: 'node = { symbol, terminal, lo, eq, hi }',
        readAs: 'A ternary trie node holds one character and three pointers: go to lo if the query character ' +
          'is smaller, hi if larger, and eq to advance to the next character. Only eq consumes input.',
        detail: 'The ternary search tree is the compromise between a map node and an array node: no ' +
          'per-symbol slot, no hash per step, a fixed three pointers per node. A search compares ' +
          'the current query character against the node symbol and goes left, right or — on a match ' +
          '— down and forward to the next query character. That makes the cost length plus a ' +
          'binary-search-like term per level, so it is more comparisons than a trie and less memory ' +
          'than an array trie, and which side of that trade wins depends entirely on the alphabet ' +
          'size.',
        example: 'over 883 words it costs 118.9 bytes per key and 21.3 comparisons per lookup.'
      },
      {
        term: 'Insertion order decides the shape',
        plain: 'A ternary tree is a BST at every level, so sorted input builds a spine.',
        formal: 'sorted insertion: height Θ(n) at each character position',
        readAs: 'Inserting keys in sorted order sends every one down the same side, so the ternary trie ' +
          'degenerates into a list at each character position. Shuffle or use the median character ' +
          'instead.',
        detail: 'This is the inherited defect and it is easy to walk into, because a dictionary is ' +
          'usually already sorted. Inserting the word list in order gives height 34; inserting the ' +
          'same words by recursive median selection gives 18, and the lookup cost falls from 36.2 ' +
          'comparisons to 21.3. Nothing about the key set changed. A real build either shuffles or ' +
          'inserts by median, and an implementation that does neither is a linked list wearing a ' +
          'tree\'s interface — the same failure a plain BST has, for the same reason.',
        example: 'height 34 from sorted input against 18 from median order, over the same 883 words.'
      },
      {
        term: 'Near-neighbour search by pruning',
        plain: 'At each node the remaining edit budget decides which of the three children can still match.',
        formal: 'visit lo/hi only while budget > 0; charge eq by whether the symbols match',
        detail: 'This is the query that justifies the structure. Because the tree is ordered on ' +
          'symbols, a node with the budget exhausted can only be matched by its `eq` child, and the ' +
          'other two subtrees are skipped without a comparison. A distance-1 query over 883 words ' +
          'visits 106 nodes of 2 561 — four percent of the tree — and returns exactly the right ' +
          'answer. A hash table cannot answer this at all and a plain trie can only answer it by ' +
          'walking every branch, because it has no ordering to prune on.',
        example: 'within 1 substitution of "cat": can, car, cat, cut, eat, hat — 106 nodes visited.'
      },
      {
        term: 'Sharing suffixes as well as prefixes',
        plain: 'A DAWG merges keys that end the same way, not only keys that start the same way.',
        formal: 'states = |{ equivalence classes of remaining-suffix sets }|',
        readAs: 'A DAWG has one state per group of positions that have the same set of continuations. Two ' +
          'prefixes that can be completed in identical ways are the same state, which is what lets the ' +
          'structure share the tails of words.',
        detail: 'A trie merges "walking" and "talking" up to the point they differ and then keeps two ' +
          'separate copies of "king". A DAWG notices that the two subtrees accept the same language ' +
          'and makes them one state. That turns the tree into a DAG, and over an English word list ' +
          'it collapses 2 562 nodes into 721 — because English morphology means a few thousand ' +
          'words share a few dozen endings. Lookup does not change at all: it is still one ' +
          'transition per character, so this is compression you query without decompressing.',
        example: '721 states against the trie\'s 2 562 nodes — 3.55× fewer, 3.22× fewer bytes.'
      },
      {
        term: 'The register',
        plain: 'A map from a state\'s signature to the canonical state with that signature.',
        formal: 'signature(s) = terminal(s) ⧺ sorted (symbol, id(target)) pairs',
        detail: 'Minimisation is a hash lookup: two states are the same state exactly when they ' +
          'accept the same language, and for a deterministic acyclic automaton that is decidable ' +
          'from the terminal flag plus the identities of the targets. So the algorithm keeps a map ' +
          'keyed on that signature, and any newly finished state whose signature is already present ' +
          'is discarded and its parent repointed. The signature includes target *identities*, not ' +
          'target contents, which is why minimisation must run bottom-up — a signature is only ' +
          'stable once nothing below it can still change.',
        example: '883 words produce 720 distinct signatures and 1 841 merges.'
      },
      {
        term: 'Sorted input is a correctness requirement',
        plain: 'Keys must arrive in order, or a merged state can silently gain a word nobody inserted.',
        formal: 'sorted arrival ⇒ a left-behind branch can never be extended',
        readAs: 'When keys arrive in order, any branch you have moved past can never receive another key — ' +
          'which is exactly what lets it be frozen and shared immediately, rather than at the end.',
        detail: 'The incremental algorithm minimises a branch the moment it is left behind, which is ' +
          'only safe because sorted arrival guarantees no later key will extend it. Break that and ' +
          'the failure is invisible: a state that was merged into a canonical one acquires a new ' +
          'edge, and every parent that was repointed at it now accepts a word that was never ' +
          'inserted. The automaton is still deterministic, still acyclic, still passes "does it ' +
          'accept everything I put in" — and accepts a superset. Rejecting unsorted input is ' +
          'cheaper than any test that would catch this.',
        example: 'the builder throws on an out-of-order key rather than producing a superset.'
      },
      {
        term: 'A DAG has many paths to one state',
        plain: 'Enumerating the language must memoise on the path, never on the state.',
        formal: 'words(s) = Σ over incoming paths, not a property of s alone',
        readAs: 'How many words pass through a state is a total over every path that reaches it, so you ' +
          'cannot read it off the state itself. That is the difference between a trie, where each node ' +
          'has one parent, and a DAWG, where it may have many.',
        detail: 'In a trie every node is reached by exactly one string, so a traversal can carry the ' +
          'spelling and a visited-set on nodes is harmless. In a DAWG a state is reached by many ' +
          'strings — that is the compression — so marking a state visited drops every word that ' +
          'would have reached it by another route. This is the enumeration bug that follows ' +
          'immediately from the structure, and it shows up as a `keys()` that returns fewer words ' +
          'than were inserted while every individual lookup still succeeds.',
        example: 'the walk carries (state, spelling) pairs, so one state can yield many words.'
      },
      {
        term: 'The lookup cost does not change',
        plain: 'Sharing suffixes compresses the graph and leaves the walk at one step per character.',
        formal: 'lookup = |query| transitions, in trie and DAWG alike',
        detail: 'This is what makes a DAWG the right way to ship a dictionary rather than an ' +
          'interesting curiosity. Compression schemes usually charge for decompression at query ' +
          'time; here the compressed form is the query structure. Measured over the same word list ' +
          'both the trie and the DAWG do 5.04 character steps per lookup, and the DAWG does it in ' +
          '28.8 bytes per key against 92.8. That is why spell checkers ship word lists as automata ' +
          'and why the technique survives into finite-state transducers, which add an output tape ' +
          'to the same idea.',
        example: '5.04 steps per lookup in both, at 28.8 bytes per key against 92.8.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
