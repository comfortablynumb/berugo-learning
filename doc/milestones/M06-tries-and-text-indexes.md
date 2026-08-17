# M06 — Tries, suffix structures and text indexes

> **Track** Data structures · **Depends on** M04 · **Sections** 9 · **Effort** L

**Outcome.** The structures that make text searchable: prefix trees through suffix automata,
compressed self-indexes, and the inverted index that every search engine is built on. This is the
milestone that turns "grep is O(nm)" into "here is why your search box answers in a millisecond".

**Shared machinery introduced.** `machines/text-corpus.js` — bundled small corpora (word list, DNA
string, log lines, source file) with generators for adversarial inputs; `viz/trie-view.js` — an
edge-labelled tree renderer with path highlighting, reused by M15, M22 and M52.

---

## Sections

### 6.1 Tries
- **Covers** — the prefix tree, node-per-character, alphabet arrays versus maps versus bitmaps,
  space blow-up, prefix queries, longest-prefix match, terminal markers versus sentinel characters,
  and the memory-per-key comparison against a hash table.
- **Demo** — trie builder over a word list: insert and watch shared prefixes collapse, with live
  node count, bytes per key and the search path highlighted as you type.
- **Diagram** — mermaid tree of a small trie with terminal nodes marked.
- **Lab** — implement `insert`, `has`, `withPrefix(p)` returning an iterator; tests assert
  behaviour against a reference `Set` and that `withPrefix` visits only the relevant subtree.
- **Senior insight** — a trie is not a faster hash table; it is a hash table that answers questions
  a hash table cannot, namely prefix and ordered range queries.

### 6.2 Compressed tries: radix and PATRICIA
- **Covers** — path compression, edge labels as substrings, node splitting on insert, binary
  PATRICIA tries with bit tests, adaptive radix trees (node4/16/48/256), and longest-prefix match
  for IP routing.
- **Demo** — the same key set as a plain trie and a radix trie, with node counts and memory side by
  side; an IP-routing view where a prefix table is queried for longest match.
- **Diagram** — mermaid diagram of an edge split during insertion.
- **Lab** — implement radix-trie insertion with edge splitting; tests assert set equality with a
  reference and that node count is below the plain trie's for the same keys.
- **Senior insight** — routing tables, filesystem paths and key-value prefixes are the three places
  this shows up, and the adaptive-node-size idea is what makes ART competitive with hash tables in
  main-memory databases.

### 6.3 Ternary search trees and dictionary automata
- **Covers** — the ternary layout as a memory/speed compromise, near-neighbour search, DAWG /
  deterministic acyclic word graphs, suffix-sharing minimisation, and finite-state dictionaries
  with output (transducers, previewing M24).
- **Demo** — build a DAWG from a word list incrementally, watching the suffix minimisation merge
  equivalent states; node count against the trie for the same list.
- **Diagram** — mermaid graph of a small DAWG showing shared suffixes.
- **Lab** — implement incremental DAWG minimisation with a register of equivalent states; tests
  assert the accepted language equals the input word set and that the state count is minimal for
  a known fixture.
- **Senior insight** — spell checkers ship dictionaries as DAWGs because sharing suffixes as well
  as prefixes cuts a word list by an order of magnitude, and lookup stays O(length).

### 6.4 Suffix trees
- **Covers** — the suffix trie blow-up, the compressed suffix tree, Ukkonen's online construction
  with suffix links, active point, the implicit-to-explicit conversion, and what suffix trees
  answer in O(m): substring existence, count, longest repeated substring, longest common substring.
- **Demo** — Ukkonen step-through: build a suffix tree character by character with the active point,
  remainder and suffix links drawn; each rule application is labelled.
- **Diagram** — mermaid tree of the suffix tree for `banana$` with suffix links.
- **Lab** — implement `longestRepeatedSubstring` on a built tree; tests assert results against a
  brute-force reference on randomised strings.
- **Senior insight** — suffix trees are the theoretician's structure: linear time, linear space,
  and a constant factor of 20 bytes per character that made everyone switch to suffix arrays.

### 6.5 Suffix arrays and LCP
- **Covers** — the suffix array as sorted suffix starts, naive O(n log² n) doubling, SA-IS in
  linear time, the LCP array and Kasai's algorithm, binary search for a pattern in O(m log n),
  and the memory advantage over suffix trees.
- **Demo** — build the suffix array by prefix doubling with the rank table shown at each round;
  then the LCP array with the Kasai walk animated; pattern search shown as a binary search over
  the array.
- **Diagram** — mermaid table-style diagram of suffixes, ranks and LCP values.
- **Lab** — implement Kasai's LCP construction; tests assert LCP correctness against a brute-force
  reference for randomised strings, including all-equal and all-distinct alphabets.
- **Senior insight** — suffix array plus LCP answers everything a suffix tree does, in 4–8 bytes
  per character instead of 20. That trade is why bioinformatics runs on them.

### 6.6 Suffix automata and factor oracles
- **Covers** — the suffix automaton as the minimal DFA of all substrings, online construction with
  clones, the link tree and its meaning, counting distinct substrings, the factor oracle
  approximation, and the relationship to suffix arrays.
- **Demo** — incremental suffix-automaton construction with clone events highlighted; the live
  count of distinct substrings updating as characters arrive.
- **Diagram** — mermaid state graph of the suffix automaton for a short string with suffix links.
- **Lab** — implement `extend(char)` including the clone case; tests assert the automaton accepts
  exactly the substrings of the input for randomised strings up to length 200.
- **Senior insight** — the clone case is the entire difficulty, and it is where every from-memory
  implementation goes wrong; the invariant to check is that each state's endpos set is exactly the
  union of its link children's.

### 6.7 Burrows–Wheeler transform and the FM-index
- **Covers** — the BWT as a reversible permutation, the last-first mapping, inverting without
  storing the matrix, run-length friendliness, the FM-index with rank structures, backward search,
  and the self-index idea: the index *is* the compressed text.
- **Demo** — BWT builder showing the rotation matrix for short inputs and the derived last column;
  backward search animated over the C table and rank queries, counting occurrences without ever
  decompressing.
- **Diagram** — mermaid diagram of the LF-mapping cycle.
- **Lab** — implement `inverseBWT` using LF-mapping in O(n); tests assert round-trip equality for
  randomised strings including repeated characters.
- **Senior insight** — the FM-index is why a read aligner can search a 3-gigabase genome in a
  couple of gigabytes of RAM: the compressed representation is directly searchable.

### 6.8 Inverted indexes and postings
- **Covers** — document-term inversion, postings lists, skip pointers, delta encoding with
  variable-byte and Simple-9/PForDelta, positional indexes for phrase queries, index construction
  by external merge, and the intersection algorithms (galloping, SvS) that dominate query time.
- **Demo** — index a small corpus, then run boolean and phrase queries with the intersection walk
  animated over the postings, showing comparisons saved by skip pointers.
- **Diagram** — mermaid diagram of a postings list with skip pointers.
- **Lab** — implement galloping intersection of two sorted postings lists; tests assert the correct
  result and fewer comparisons than a linear merge on skewed-length inputs.
- **Senior insight** — the ranking model gets the attention, but query latency lives in the
  intersection loop and the posting compression. M52 picks this up for scoring and top-k.

### 6.9 Autocomplete and fuzzy search
- **Covers** — top-k completion with scored tries, precomputed subtree maxima, BK-trees over an
  edit-distance metric, Levenshtein automata and their intersection with a dictionary DAWG,
  n-gram indexes, and the accuracy/latency trade of each.
- **Demo** — type into a search box and watch three back-ends answer in parallel: prefix trie with
  scores, BK-tree with distance k, and a Levenshtein automaton walking the dictionary — with node
  visits and latency reported for each.
- **Diagram** — mermaid diagram of a Levenshtein automaton for a short pattern at distance 1.
- **Lab** — implement the BK-tree insert and range query using the triangle inequality to prune;
  tests assert the returned set equals brute force within distance k and that visits are below a
  threshold.
- **Senior insight** — the triangle inequality is the whole trick in a BK-tree, and it is why the
  metric must be a real metric: swap in a non-metric similarity and the pruning silently drops
  correct answers.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/trie.js`, `radix-trie.js`, `ternary-trie.js`, `dawg.js` | Prefix structures |
| `src/js/algorithms/suffix-tree.js` | Ukkonen with suffix links and step trace |
| `src/js/algorithms/suffix-array.js` | Doubling and SA-IS, Kasai LCP |
| `src/js/algorithms/suffix-automaton.js` | Online construction with clones |
| `src/js/algorithms/bwt.js` | Transform, inverse, FM-index with rank/select |
| `src/js/algorithms/inverted-index.js` | Postings, delta coding, intersection strategies |
| `src/js/algorithms/fuzzy-search.js` | BK-tree, Levenshtein automaton, n-gram index |
| `src/js/machines/text-corpus.js` | Corpora and adversarial string generators |
| `src/js/viz/trie-view.js` | Edge-labelled tree with path highlight |
| `src/js/viz/matrix-view.js` | Table renderer for suffix arrays, LCP and BWT rotations |

---

## Acceptance criteria

- [ ] Suffix array, suffix tree and suffix automaton all answer "is P a substring of T" identically
      on 10³ randomised strings, cross-checked against brute force.
- [ ] SA-IS output matches the doubling construction for every corpus, including inputs with a
      one-letter alphabet.
- [ ] BWT round-trips exactly for all corpora, including strings with repeated sentinels rejected
      by a clear error.
- [ ] The suffix automaton's distinct-substring count matches the suffix-array-plus-LCP formula.
- [ ] Memory per character is reported for suffix tree, suffix array and FM-index on the same input
      and the ratios are within the ranges the section text claims.
- [ ] Fuzzy search returns exactly the brute-force result set for distance 1 and 2 over the word
      corpus.

---

## Sources

- Gusfield — *Algorithms on Strings, Trees and Sequences*
- Ukkonen — *On-line construction of suffix trees*
- Manber, Myers — *Suffix arrays: a new method for on-line string searches*
- Nong, Zhang, Chan — *Two efficient algorithms for linear time suffix array construction* (SA-IS)
- Kasai et al. — *Linear-time longest-common-prefix computation*
- Burrows, Wheeler — *A block-sorting lossless data compression algorithm*
- Ferragina, Manzini — *Opportunistic data structures with applications* (FM-index)
- Leis, Kemper, Neumann — *The adaptive radix tree*
- Schulz, Mihov — *Fast string correction with Levenshtein automata*
