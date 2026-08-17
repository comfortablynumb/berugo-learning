/** Worked examples for the prefix-structure sections (M06.1-M06.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExampleRegistry : require('./registries.js').ExampleRegistry;

  registry.register({
    tries: [
      {
        title: 'What a trie costs against a hash table',
        goal: 'Price the structure on the question a hash table is good at, before claiming anything else.',
        setup: 'The 883-word list, inserted into a trie with map nodes, and a hash table assumed to ' +
          'cost 40 bytes per entry at a sane load factor.',
        steps: [
          {
            do: 'Count the nodes and relate them to the keys and the characters.',
            why: 'A trie\'s size is neither of those numbers, and guessing which is a common error.',
            work: '883 keys holding 4 732 characters\n2 562 nodes = 2.90 per key, 0.54 per character',
            result: 'the words share about half their characters by prefix'
          },
          {
            do: 'Convert the nodes to bytes.',
            why: 'Nodes are not comparable across structures; bytes are.',
            work: 'map nodes: 81 968 bytes total\n81 968 ÷ 883 = 92.8 bytes per key',
            result: '92.8 bytes per key'
          },
          {
            do: 'Compare with the hash table.',
            why: 'This is the comparison the "tries are fast" claim is implicitly making.',
            work: 'hash table: 883 × 40 = 35 320 bytes\n81 968 ÷ 35 320 = 2.32',
            result: '2.32× the memory'
          },
          {
            do: 'Compare the work per lookup.',
            why: 'Steps are the honest counter here, and each trie step is a pointer chase.',
            work: 'measured over 883 hits and 220 near-miss lookups: 5.04 character steps each\nhash table: one hash, one probe',
            result: '5× the steps, and every one of them an unpredictable memory access'
          },
          {
            do: 'State the conclusion in the form that survives.',
            why: 'So the structure is not chosen for a property it does not have.',
            work: 'memory 2.32× worse, steps 5.04 against 1\nnothing in this comparison favours the trie',
            result: 'on membership alone the hash table wins on every axis measured'
          }
        ],
        answer: 'A trie over 883 words costs 92.8 bytes per key against a hash table\'s 40, and 5.04 ' +
          'character steps per lookup against one hash and one probe. It is 2.32× the memory and ' +
          'about five times the pointer chasing for the same answer — so if membership is the ' +
          'question, the trie is the wrong structure, and the reason to build one has to come from ' +
          'somewhere else.'
      },
      {
        title: 'The query that pays for it',
        goal: 'Find the query where the hash table cannot compete at all, and price it.',
        setup: 'The same trie, asked for every word beginning with "con".',
        steps: [
          {
            do: 'Walk to the prefix node.',
            why: 'This is the whole cost of finding where the answer lives.',
            work: 'c → o → n: 3 character steps',
            result: 'the subtree below that node is the answer, already isolated'
          },
          {
            do: 'Enumerate the subtree.',
            why: 'The enumeration is proportional to the answer, not to the dictionary.',
            work: '22 completions, visited in sorted order\ntotal: 3 steps + 22 answers',
            result: '22 words: concept, concern, conclude, condition, …'
          },
          {
            do: 'Ask the hash table the same question.',
            why: 'To make the asymmetry concrete rather than asserted.',
            work: 'a hash destroys the ordering, so there is no shortcut\n883 keys must be tested, one prefix comparison each',
            result: '883 tests against 25 steps — 35× the work, and it grows with the dictionary'
          },
          {
            do: 'Add the second query the ordering buys.',
            why: 'Longest-prefix match is the same walk, remembering where it last passed a key.',
            work: 'longestPrefixOf("contracts") walks 9 characters and returns "contract"\nthe hash-table version is 9 separate lookups',
            result: 'one pass instead of one lookup per candidate length'
          },
          {
            do: 'Read the two examples together.',
            why: 'The decision is not "which structure is better" but "which question is being asked".',
            work: 'membership: hash wins 2.32× on memory and 5× on steps\nprefix: trie wins 35× at this size, and by more as the dictionary grows',
            result: 'the trie is bought for the second column, and paid for out of the first'
          }
        ],
        answer: 'Every completion of "con" costs 3 character steps plus one visit per answer — 25 ' +
          'operations for 22 words — where a hash table has to test all 883 keys because hashing ' +
          'destroyed the ordering the query needs. That gap widens with the dictionary while the ' +
          'trie\'s 2.32× memory penalty stays fixed, which is the trade the structure exists to make.'
      }
    ],

    'compressed-tries': [
      {
        title: 'Where path compression actually pays',
        goal: 'Show that the compression factor is a property of the keys, and find what it tracks.',
        setup: 'Three key sets of 400 keys each, put into a plain trie and a radix trie.',
        steps: [
          {
            do: 'Start with English words.',
            why: 'The case where a plain trie already does well.',
            work: 'plain 1 206 nodes, radix 564\nratio 2.14×, 163 edge splits',
            result: 'about half the nodes removed'
          },
          {
            do: 'Try filesystem-style paths.',
            why: 'Long keys that share a directory prefix and then diverge.',
            work: 'plain 5 799 nodes, radix 581\nratio 9.98×, 180 edge splits',
            result: '90% of the nodes removed'
          },
          {
            do: 'Try 32-character hex keys.',
            why: 'The extreme: long keys that share almost nothing.',
            work: 'plain 12 212 nodes, radix 544\nratio 22.45×, 143 edge splits',
            result: '96% of the nodes removed'
          },
          {
            do: 'Find what the three ratios track.',
            why: 'The obvious guess — shared prefix length — is wrong, and the numbers say so.',
            work: 'hex keys share almost no prefix and compress best: 22.45×\nthe radix node count barely moves: 564, 581, 544',
            result: 'the radix trie is 1.36 to 1.45 nodes per key throughout; it is the plain trie that varies'
          },
          {
            do: 'State the rule that follows.',
            why: 'So the technique is applied where it pays.',
            work: 'plain nodes ≈ distinct prefixes: 1 206, 5 799, 12 212\nradix nodes ≈ 1.4 × keys: 564, 581, 544',
            result: 'compression removes the tails, so measure the tails, not the prefixes'
          }
        ],
        answer: 'The radix trie holds 564, 581 and 544 nodes for the three key sets — essentially ' +
          '1.36 to 1.45 per key throughout — while the plain trie holds 1 206, 5 799 and 12 212. So the ' +
          'ratio is set entirely by the plain trie, and what it measures is the length of the ' +
          'unshared tail after keys diverge. A shared prefix is not what compression saves; a plain ' +
          'trie already shares those.'
      },
      {
        title: 'The node sizes, and the case they lose',
        goal: 'Price ART\'s adaptive nodes on a key set small enough to make them lose.',
        setup: '400 English words in a radix trie, with adaptive node sizes on and off.',
        steps: [
          {
            do: 'Count where the nodes land by fan-out.',
            why: 'This is the observation the whole scheme rests on.',
            work: 'node4 (≤ 4 children): 533\nnode16: 30 · node48: 1 · node256: 0',
            result: '94.5% of the nodes have four children or fewer'
          },
          {
            do: 'Work out what a uniform 256-slot node would cost.',
            why: 'To price the layout the adaptive scheme is replacing.',
            work: '564 nodes × 256 slots × 8 bytes = 1 155 072 bytes\nactual radix trie with map nodes: 23 749',
            result: 'a uniform maximum-size node is 48.6× the memory'
          },
          {
            do: 'Price the adaptive version on this key set.',
            why: 'The honest measurement, including where it goes the wrong way.',
            work: 'radix with map nodes: 59.4 bytes per key\nradix with ART node sizes: 96.8 bytes per key',
            result: 'the adaptive version is larger here, not smaller'
          },
          {
            do: 'Explain the inversion rather than hiding it.',
            why: 'A technique presented without its failure case is a recommendation, not a measurement.',
            work: 'a node4 allocates 4 slots whether it uses 1 or 4\nwith 533 mostly-empty node4s, that over-allocation dominates',
            result: 'ART trades waste for locality, and at 400 keys there is no locality to win'
          },
          {
            do: 'State where the technique belongs.',
            why: 'So it is used for the reason it exists.',
            work: 'the map node costs 1 indirection per level, and a lookup here walks 9.46 of them\nART removes the indirection and pays in slots: 4 per node4, 533 of them',
            result: 'worth it when the alternative is a pointer chase per level, which needs a large index'
          }
        ],
        answer: 'Adaptive node sizes are right about the distribution — 94.5% of nodes have four ' +
          'children or fewer, and sizing them all at 256 slots would cost 48.6× the memory — and on ' +
          '400 keys they still lose to plain map nodes, 96.8 bytes per key against 59.4, because a ' +
          'node4 allocates four slots to hold one child. The technique buys locality with waste, ' +
          'which is only a good trade at a size where the indirection is the cost.'
      }
    ],

    'dictionary-automata': [
      {
        title: 'What sharing suffixes is worth',
        goal: 'Measure a DAWG against the trie it minimises, on size and on lookup cost.',
        setup: 'The 883-word list, built as a trie and as a DAWG by incremental minimisation.',
        steps: [
          {
            do: 'Count the states against the nodes.',
            why: 'This is the compression, and it comes entirely from shared endings.',
            work: 'trie: 2 562 nodes\nDAWG: 721 states — 3.55× fewer',
            result: 'two thirds of the trie was duplicated suffix structure'
          },
          {
            do: 'Count the merges the construction performed.',
            why: 'To see the minimisation happen rather than infer it from the total.',
            work: '1 841 states merged into existing ones\n720 distinct signatures ended up in the register',
            result: 'every merge is one subtree recognised as a duplicate of another'
          },
          {
            do: 'Convert both to bytes.',
            why: 'States and nodes hold different things, so the node ratio is not the memory ratio.',
            work: 'trie 81 968 bytes, DAWG 25 450\n81 968 ÷ 25 450 = 3.22',
            result: '3.22× smaller — slightly less than the 3.55× node ratio, because a DAWG state carries more edges'
          },
          {
            do: 'Measure what the compression cost the query.',
            why: 'This is the number that decides whether the structure is shippable.',
            work: 'trie: 5.04 character steps per lookup\nDAWG: 5.04 character steps per lookup',
            result: 'identical — the walk did not change at all'
          },
          {
            do: 'Say why that combination is unusual.',
            why: 'Compression normally charges for decompression.',
            work: '3.22× smaller and 0 extra work per lookup\na compressed dictionary you would normally decompress; here the compressed form is the query structure',
            result: 'which is why spell checkers ship word lists as automata'
          }
        ],
        answer: 'Minimisation takes 2 562 trie nodes to 721 DAWG states and 81 968 bytes to 25 450 — ' +
          '3.22× smaller — while the lookup stays at exactly 5.04 character steps, because sharing ' +
          'suffixes changes the graph and not the walk. That is compression you query without ' +
          'decompressing, which is the whole reason the format is shipped rather than merely studied.'
      },
      {
        title: 'The insertion order nobody thinks about',
        goal: 'Show that a ternary tree built from a dictionary is built the worst possible way.',
        setup: 'The same 883 words inserted into a ternary search tree in sorted order and in median order.',
        steps: [
          {
            do: 'Insert in sorted order and measure the height.',
            why: 'A dictionary arrives sorted, so this is the default rather than a pathological case.',
            work: 'sorted insertion: height 34\n2 561 nodes',
            result: 'a right spine at every character position'
          },
          {
            do: 'Insert the same words by recursive median selection.',
            why: 'The identical key set, so any difference is the order alone.',
            work: 'median order: height 18\n2 561 nodes — exactly the same count',
            result: 'height halved, memory unchanged'
          },
          {
            do: 'Measure what the height cost the lookups.',
            why: 'Height is a proxy; the comparison count is the bill.',
            work: 'sorted: 36.24 character comparisons per lookup\nmedian: 21.32',
            result: '41% of the work was the insertion order, not the data'
          },
          {
            do: 'Compare with the trie over the same words.',
            why: 'To place the ternary tree honestly among its alternatives.',
            work: 'trie: 5.04 steps, 92.8 bytes per key\nternary (median): 21.32 comparisons, 118.9 bytes per key',
            result: 'more comparisons and more memory, on a 26-letter alphabet'
          },
          {
            do: 'Find the query that justifies it anyway.',
            why: 'A structure that loses on every column would not be in the section.',
            work: 'within 1 substitution of "cat": can, car, cat, cut, eat, hat\n106 nodes visited of 2 561 — 4.1% of the tree',
            result: 'the ordering prunes; a trie has nothing to prune on'
          }
        ],
        answer: 'Sorted insertion costs height 34 and 36.24 comparisons per lookup; the same words in ' +
          'median order cost height 18 and 21.32 — 41% of the work was the order alone. Even ' +
          'balanced it loses to a trie on both memory and steps at this alphabet size, and what it ' +
          'buys is the near-neighbour query: six matches within one substitution of "cat", found by ' +
          'visiting 4.1% of the tree.'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
