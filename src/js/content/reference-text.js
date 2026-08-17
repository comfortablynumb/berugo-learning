/** Reference entries for the prefix-structure sections (M06.1-M06.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    tries: {
      summary: 'A tree whose edges are characters and whose nodes are the distinct prefixes of the ' +
        'key set, answering prefix and longest-match queries a hash table cannot.',
      intuition: 'Spell the key down the tree. Everything that starts the same way shares the same ' +
        'path, so the subtree below a prefix is exactly the set of keys that begin with it.',
      formulation: {
        equations: [
          {
            label: 'Size',
            expr: 'nodes = |{ p : p is a prefix of some key }| ≤ Σ |key|',
            terms: [
              { sym: 'measured', meaning: '883 English words hold 4 732 characters and produce 2 562 nodes' }
            ]
          },
          {
            label: 'Lookup',
            expr: 'has(k) = O(|k|) character steps, independent of the dictionary size',
            terms: [
              { sym: 'per step', meaning: 'a map lookup, an array index or a binary search, by layout' }
            ]
          },
          {
            label: 'Prefix query',
            expr: 'withPrefix(p) = O(|p| + |answer|)',
            terms: [
              { sym: 'the point', meaning: 'proportional to the answer, never to the dictionary' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every node is a prefix, every prefix is a node',
          why: 'The structure is fully determined by the key set, so insertion order changes nothing.',
          breaks: 'A node reachable by no key is a leak; a missing prefix node is a lost key.'
        },
        {
          name: 'A node is a key exactly when its terminal flag is set',
          why: 'Being a leaf is neither necessary nor sufficient — "an" is a key and a prefix of "ant".',
          breaks: 'Treating leaves as the key set loses every key that is a prefix of another.'
        },
        {
          name: 'No node is both childless and non-terminal',
          why: 'Such a node is unreachable by any query and pure overhead.',
          breaks: 'Deletion that clears the flag without pruning leaves one behind for every key removed.'
        }
      ],
      complexity: [
        { operation: 'insert', average: 'Θ(|key|)', worst: 'Θ(|key|)', note: 'one step per character' },
        { operation: 'lookup', average: 'Θ(|key|)', worst: 'Θ(|key|)', note: 'measured at 5.04 steps over the word list' },
        { operation: 'delete', average: 'Θ(|key|)', worst: 'Θ(|key|)', note: 'including the upward prune' },
        { operation: 'prefix query', average: 'Θ(|p| + k)', worst: 'Θ(|p| + k)', note: 'k = answers returned' },
        { operation: 'longest prefix', average: 'Θ(|text|)', worst: 'Θ(|text|)', note: 'one downward walk' },
        { operation: 'space', average: 'Θ(nodes × layout)', worst: 'Θ(Σ|key| × |Σ|)', note: '72.5 to 649.9 bytes per key by layout' }
      ],
      failureModes: [
        {
          symptom: 'Memory grows steadily under an insert-delete workload and never falls.',
          cause: 'Deletion clears the terminal flag and leaves the nodes in place.',
          fix: 'Walk back up the path detaching any node that is neither a key nor a parent.'
        },
        {
          symptom: 'A DNA or byte-keyed trie uses hundreds of megabytes for a small key set.',
          cause: 'An alphabet-sized child array, mostly empty — 98% waste on a 4-symbol alphabet in 256 slots.',
          fix: 'Use a map, a sorted child array, or a node size chosen by fan-out.'
        },
        {
          symptom: 'The trie was adopted to speed up membership and made it slower.',
          cause: 'It costs 2.32× the memory of a hash table and five times the pointer chases.',
          fix: 'Keep the hash table for membership; add the trie only for the prefix queries.'
        },
        {
          symptom: 'A key that is a prefix of another disappears after inserting the longer one.',
          cause: 'The implementation marks keys by leaf-ness rather than by a terminal flag.',
          fix: 'Store the flag; never infer keyhood from the child count.'
        }
      ],
      inTheWild: [
        { system: 'IP routing tables', how: 'longest-prefix match over a bitwise trie, one walk per packet' },
        { system: 'Autocomplete back-ends', how: 'prefix query plus a score, which is a trie plus subtree maxima' },
        { system: 'Redis, LevelDB key scans', how: 'ordered range queries over string keys — the same downward-closed shape' }
      ],
      sources: [
        { title: 'Fredkin — Trie Memory (CACM 1960)', where: 'the original, and the name' },
        { title: 'Knuth — TAOCP volume 3, section 6.3', where: 'digital searching, with the space analysis' },
        { title: 'Sedgewick, Wayne — Algorithms, chapter 5.2', where: 'R-way tries and the alphabet cost' },
        { title: 'Bentley, Sedgewick — Fast algorithms for sorting and searching strings (SODA 1997)', where: 'why the array node is usually wrong' }
      ]
    },

    'compressed-tries': {
      summary: 'A trie with every non-branching chain collapsed onto one edge, so the node count is ' +
        'bounded by the number of keys rather than by their total length.',
      intuition: 'A node earns its place only where the key set branches. Everything between two ' +
        'branch points is a substring, and a substring fits on an edge.',
      formulation: {
        equations: [
          {
            label: 'Size',
            expr: 'nodes ≤ 2k − 1 for k keys, whatever the key length',
            terms: [
              { sym: 'measured', meaning: '~1.4 nodes per key across word, path and hex key sets' }
            ]
          },
          {
            label: 'Compression factor',
            expr: 'plain / radix ≈ (Σ distinct prefixes) / (1.4 k)',
            terms: [
              { sym: 'tracks', meaning: 'the length of the unshared tails, not the shared prefixes' }
            ]
          },
          {
            label: 'Longest-prefix match over bits',
            expr: 'PATRICIA: alphabet {0, 1}, edges are bit ranges',
            terms: [
              { sym: 'IPv4', meaning: 'a /n prefix is the first n bits; the walk ends at the deepest match' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'No node has exactly one child unless it is itself a key',
          why: 'That is the definition of compressed — a single-child non-key node should have been collapsed.',
          breaks: 'A split that forgets to mark the new internal node as a key leaves one and loses a key.'
        },
        {
          name: 'Every edge label is non-empty and starts with the symbol it is filed under',
          why: 'The first character is the dispatch key; an empty label makes the walk loop.',
          breaks: 'A split at position 0 produces an empty head label and an infinite descent.'
        },
        {
          name: 'A prefix ending inside an edge is still a valid prefix',
          why: 'The subtree below that edge is the answer, even though the walk stopped mid-label.',
          breaks: 'Treating a partial edge match as a miss returns nothing for most typed prefixes.'
        }
      ],
      complexity: [
        { operation: 'insert', average: 'Θ(|key|)', worst: 'Θ(|key|)', note: 'plus one split at most' },
        { operation: 'lookup', average: 'Θ(|key|)', worst: 'Θ(|key|)', note: 'fewer nodes, more character comparisons' },
        { operation: 'longest prefix', average: 'Θ(|text|)', worst: 'Θ(|text|)', note: 'the routing query' },
        { operation: 'prefix query', average: 'Θ(|p| + k)', worst: 'Θ(|p| + k)', note: 'partial edge match included' },
        { operation: 'space', average: 'Θ(k)', worst: 'Θ(k)', note: 'independent of key length' },
        { operation: 'ART node promotion', average: 'O(1) amortised', worst: 'Θ(children)', note: 'copying into the next size class' }
      ],
      failureModes: [
        {
          symptom: 'A key that is a proper prefix of another is silently lost.',
          cause: 'The split created the internal node without marking it terminal when the new key ended there.',
          fix: 'Handle the shared === rest.length case explicitly; test with a key set containing such a pair.'
        },
        {
          symptom: 'Prefix search returns nothing for prefixes users actually type.',
          cause: 'The walk ends inside an edge and is treated as a miss.',
          fix: 'Return the subtree below the partially matched edge, reconstructing the completion text.'
        },
        {
          symptom: 'Compression was adopted and saved almost nothing.',
          cause: 'The keys are short and branch densely — English words compress only 2.14×.',
          fix: 'Measure the unshared tail length first; the saving tracks that, not the shared prefix.'
        },
        {
          symptom: 'The adaptive node sizes made the index larger.',
          cause: 'A node4 allocates four slots for one child, and 94.5% of nodes are node4s.',
          fix: 'Use ART where the alternative is a pointer chase per level, not on small key sets.'
        }
      ],
      inTheWild: [
        { system: 'Linux kernel routing (LC-trie, fib_trie)', how: 'PATRICIA over address bits with level compression' },
        { system: 'HyPer, DuckDB, other main-memory databases', how: 'adaptive radix trees as the primary index' },
        { system: 'Ethereum Merkle-Patricia trie', how: 'radix trie over hex nibbles with hashes at each node' }
      ],
      sources: [
        { title: 'Morrison — PATRICIA (JACM 1968)', where: 'the original bitwise radix trie' },
        { title: 'Leis, Kemper, Neumann — The Adaptive Radix Tree (ICDE 2013)', where: 'node4/16/48/256 and the measurements' },
        { title: 'Knuth — TAOCP volume 3, section 6.3', where: 'digital search trees and path compression' },
        { title: 'Sklower — A tree-based packet routing table for Berkeley Unix (1991)', where: 'why routers use this shape' }
      ]
    },

    'dictionary-automata': {
      summary: 'Two answers to "a trie is too big": a ternary layout with three pointers per node, ' +
        'and a DAWG that shares suffixes as well as prefixes.',
      intuition: 'The ternary tree makes each node cheap. The DAWG notices that two subtrees ' +
        'accepting the same language are the same object and keeps one.',
      formulation: {
        equations: [
          {
            label: 'Ternary node',
            expr: 'node = { symbol, terminal, lo, eq, hi } — 3 pointers, any alphabet',
            terms: [
              { sym: 'search', meaning: 'lo/hi compare within a level; eq advances to the next character' }
            ]
          },
          {
            label: 'DAWG state identity',
            expr: 'signature(s) = terminal(s) ⧺ sorted (symbol, id(target)) pairs',
            terms: [
              { sym: 'minimal', meaning: 'two states with equal signatures accept the same language' }
            ]
          },
          {
            label: 'Measured compression',
            expr: '2 562 trie nodes → 721 DAWG states over 883 English words',
            terms: [
              { sym: 'lookup', meaning: 'unchanged at 5.04 character steps' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The ternary tree is ordered at every level',
          why: 'lo holds smaller symbols and hi larger ones; the near-neighbour pruning depends on it.',
          breaks: 'An unordered insert makes withinDistance silently skip valid subtrees.'
        },
        {
          name: 'No two reachable DAWG states share a signature',
          why: 'That is what minimal means, and it is checkable directly after the build finishes.',
          breaks: 'A missed merge leaves the automaton correct and larger, so only this check finds it.'
        },
        {
          name: 'The DAWG is acyclic',
          why: 'A cycle would accept infinitely many words and make enumeration non-terminating.',
          breaks: 'Repointing a parent at a descendant during minimisation creates one.'
        }
      ],
      complexity: [
        { operation: 'ternary lookup', average: 'Θ(|key| + log n)', worst: 'Θ(|key| · n)', note: 'sorted insertion is the worst case' },
        { operation: 'ternary near-neighbour', average: 'sublinear with pruning', worst: 'Θ(n)', note: '106 of 2 561 nodes at distance 1' },
        { operation: 'DAWG lookup', average: 'Θ(|key|)', worst: 'Θ(|key|)', note: 'one transition per character' },
        { operation: 'DAWG construction', average: 'Θ(Σ|key|)', worst: 'Θ(Σ|key|)', note: 'one register lookup per state' },
        { operation: 'DAWG enumeration', average: 'Θ(output)', worst: 'Θ(output)', note: 'must memoise on the path, not the state' },
        { operation: 'space', average: 'Θ(states + edges)', worst: 'Θ(Σ|key|)', note: '28.8 bytes per key against a trie\'s 92.8' }
      ],
      failureModes: [
        {
          symptom: 'A ternary tree built from a dictionary performs like a linked list.',
          cause: 'The dictionary was sorted, and a ternary tree is a BST at every level.',
          fix: 'Insert by recursive median selection or shuffle: height 34 becomes 18.'
        },
        {
          symptom: 'The DAWG accepts words that were never inserted.',
          cause: 'Keys arrived out of order, so an already-minimised state acquired a new edge.',
          fix: 'Sort before inserting, and reject unsorted input rather than trusting the caller.'
        },
        {
          symptom: 'Enumerating the DAWG returns fewer words than were inserted.',
          cause: 'The traversal memoised on the state, and a DAG state is reached by many paths.',
          fix: 'Carry the spelling; treat (state, spelling) as the traversal unit.'
        },
        {
          symptom: 'Minimisation produces a graph that is still trie-sized.',
          cause: 'The register was keyed on state contents rather than on target identities, so nothing matched.',
          fix: 'Include the target ids in the signature and minimise strictly bottom-up.'
        }
      ],
      inTheWild: [
        { system: 'Hunspell, aspell and most spell checkers', how: 'word lists shipped as minimised automata' },
        { system: 'Lucene FST term dictionaries', how: 'the same minimisation with an output tape attached' },
        { system: 'Scrabble and word-game engines', how: 'DAWG lookup with a rack-constrained traversal' }
      ],
      sources: [
        { title: 'Bentley, Sedgewick — Fast algorithms for sorting and searching strings (SODA 1997)', where: 'ternary search trees, with the balancing advice' },
        { title: 'Daciuk, Mihov, Watson, Watson — Incremental construction of minimal acyclic FSAs (1998)', where: 'the register algorithm used here' },
        { title: 'Blumer et al. — The smallest automaton recognizing the subwords of a text (1985)', where: 'the DAWG, and its size bounds' },
        { title: 'Mohri — Finite-state transducers in language and speech processing (1997)', where: 'where dictionary automata go next' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
