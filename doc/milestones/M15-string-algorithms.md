# M15 — String algorithms and pattern matching

> **Track** Algorithms · **Depends on** M06 · **Sections** 11 · **Effort** L

**Outcome.** Everything between "indexOf" and a production text-processing pipeline: the classical
matchers with their preprocessing made visible, multi-pattern automata, diff, and the regular-
expression engine argument that ends in a ReDoS incident.

**Shared machinery introduced.** `machines/match-lab.js` — runs any matcher over any corpus with
character-comparison counters, shift traces and an alignment view; `viz/alignment-view.js` — the
text-over-text alignment renderer with per-character highlighting, reused in M22 and M62.

---

## Sections

### 15.1 The matching problem and the naive algorithm
- **Covers** — exact matching definitions, the naive O(nm) scan and the inputs that realise it,
  first-character filtering, `memchr`-style skipping, what JavaScript's `indexOf` actually does,
  and the taxonomy of the algorithms that follow (prefix-based, suffix-based, hashing, automaton).
- **Demo** — naive matcher stepping character by character with the comparison counter running; an
  adversarial input generator (aaaa…aab in aaaa…a) drives it to n·m.
- **Diagram** — mermaid decision tree of the matcher families and when each wins.
- **Lab** — implement naive matching with first-character filtering and measure the comparison
  reduction on English text versus adversarial input.
- **Senior insight** — on natural-language text the naive algorithm is nearly linear, which is why
  standard libraries ship it with a filter and only escalate for pathological input.

### 15.2 KMP and the prefix function
- **Covers** — the failure/prefix function and its meaning as the longest proper border, computing
  it in O(n), the KMP scan never backing up in the text, the automaton view of KMP, and
  applications of the prefix function alone (period detection, minimal rotation, counting
  occurrences of every prefix).
- **Demo** — prefix function computed cell by cell with the border it represents highlighted in the
  pattern; the match phase shows the shift taken on each mismatch and why no text position is
  re-examined.
- **Diagram** — mermaid diagram of the pattern's borders and the failure link.
- **Lab** — implement the prefix function and use it to find the smallest period of a string; tests
  assert period correctness for randomised strings and periodic fixtures.
- **Senior insight** — the prefix function is more useful than KMP itself; period detection, border
  arrays and string-power questions all fall out of it in two lines.

### 15.3 The Z-algorithm and string periodicity
- **Covers** — the Z-array definition, linear construction with the [l, r] window, the equivalence
  with the prefix function, pattern matching via a concatenated sentinel, and periodicity lemmas
  (Fine and Wilf) with their consequences.
- **Demo** — Z-array construction with the current window drawn and each case (inside window, past
  window, extension) labelled as it is taken.
- **Diagram** — mermaid diagram of the three Z-box cases.
- **Lab** — implement the Z-algorithm and use it for matching; tests assert the Z-array matches a
  naive O(n²) computation and that match positions equal the naive matcher's.
- **Senior insight** — Z is easier to get right than KMP under time pressure and gives the same
  power; the window argument is also the template for several other linear-time string algorithms.

### 15.4 Boyer–Moore and skipping algorithms
- **Covers** — the bad-character rule, the good-suffix rule, the two tables and their construction,
  Horspool and Sunday simplifications, sublinear average behaviour, the worst case, and why real
  `strstr` implementations use a hybrid.
- **Demo** — Boyer–Moore with the right-to-left comparison order shown and the shift decision
  attributed to a rule per step; a rules toggle (bad character only, good suffix only, both)
  compares total comparisons on the same corpus.
- **Diagram** — mermaid diagram of the good-suffix shift alignment.
- **Lab** — implement the bad-character table and the shift rule; tests assert correctness against
  the naive matcher and fewer comparisons than n on a natural-language corpus.
- **Senior insight** — Boyer–Moore gets faster as the pattern gets longer, which is the opposite of
  every other matcher, and it is why long search terms feel instant.

### 15.5 Rabin–Karp and rolling hashes
- **Covers** — polynomial hashing, the rolling update, modulus and base choice, collision
  probability, double hashing, anti-hash test construction against fixed parameters, randomised
  base selection as the fix, and applications (plagiarism detection, block deduplication, rsync,
  content-defined chunking).
- **Demo** — rolling-hash window over text with the hash value updating and collisions flagged; an
  adversarial generator produces a colliding string for a fixed base and modulus, and randomising
  the base defeats it.
- **Diagram** — mermaid diagram of the rolling update removing the leading term and appending.
- **Lab** — implement a rolling hash with a randomised base and 2-modulus scheme, plus
  content-defined chunking with a Rabin fingerprint; tests assert no false negatives and stable
  chunk boundaries under insertion.
- **Senior insight** — content-defined chunking is why rsync and modern backup tools transfer only
  what changed: shifting the file by one byte moves the boundaries with the content, not with the
  offsets.

### 15.6 Aho–Corasick multi-pattern matching
- **Covers** — the trie of patterns, failure links as the generalisation of KMP, output links for
  overlapping matches, construction by BFS, matching all patterns in one pass, the automaton
  conversion (goto table), and applications (intrusion detection, tokenising keyword sets, content
  filters).
- **Demo** — build the automaton for a pattern set with failure and output links drawn; the scan
  animates over the text with the active state and all reported matches, including nested ones.
- **Diagram** — mermaid state graph of the goto trie with failure links dashed.
- **Lab** — implement failure-link construction by BFS and the output-link chain; tests assert every
  occurrence of every pattern is reported exactly once, including overlaps and patterns that are
  suffixes of each other.
- **Senior insight** — the suffix-pattern case (`he` inside `she`) is the one that breaks
  hand-rolled implementations; output links exist precisely for it.

### 15.7 Palindromes: Manacher and the palindromic tree
- **Covers** — the odd/even problem and the sentinel trick, Manacher's linear algorithm with the
  mirror argument, counting palindromic substrings, the eertree (palindromic tree) and its two
  roots, and palindromic factorisation.
- **Demo** — Manacher's radius array built with the mirror reuse highlighted per position; the
  eertree grows incrementally with suffix links drawn.
- **Diagram** — mermaid diagram of the mirror reuse inside the current palindrome.
- **Lab** — implement Manacher's algorithm returning all maximal palindromes; tests assert results
  match a brute-force O(n²) expansion on randomised strings.
- **Senior insight** — the mirror argument is the same amortisation as the Z-window: you never
  re-examine what an earlier structure already proved.

### 15.8 Approximate matching
- **Covers** — k-mismatch and k-difference matching, the bitap (Shift-Or) algorithm and its
  bit-parallel elegance, Ukkonen's banded edit distance with a cutoff, the four-Russians idea,
  q-gram filtering as a prefilter, and the accuracy/latency trade of each.
- **Demo** — fuzzy search over a log corpus with k adjustable: bitap's bit vectors shown per
  character, the banded DP grid drawn beside it, and candidate counts before and after q-gram
  filtering.
- **Diagram** — mermaid diagram of the banded DP region for a distance cutoff.
- **Lab** — implement bitap for k = 0 and k = 1 using bitwise operations on 32-bit words; tests
  assert match positions equal a DP reference for randomised patterns up to length 32.
- **Senior insight** — bitap processes 32 pattern positions per machine word, which is why
  `agrep`-style tools are fast; the limit is the word size, and that is the entire design
  constraint.

### 15.9 Diff and merge
- **Covers** — diff as LCS and why that is the wrong framing for real files, Myers's O(ND) algorithm
  and the edit graph, the greedy furthest-reaching D-path, linear-space refinement, patience diff
  and histogram diff for readable output, three-way merge, conflict detection, and diff heuristics
  in Git.
- **Demo** — the edit graph with Myers's furthest-reaching path traced diagonal by diagonal; a
  side-by-side diff view generated from the trace; a toggle to patience diff on a file where LCS
  produces an unreadable result.
- **Diagram** — mermaid diagram of the edit graph with snake segments highlighted.
- **Lab** — implement Myers's algorithm returning an edit script; tests assert the script transforms
  A into B exactly and that its length equals the true edit distance for randomised inputs.
- **Senior insight** — LCS-optimal diffs are frequently the least readable ones; patience diff
  exists because minimal edit scripts and human-legible edit scripts are different objectives.

### 15.10 Regular expression engines
- **Covers** — backtracking engines versus Thompson NFA simulation, the pathological cases
  (`(a+)+b`) and catastrophic backtracking, ReDoS as a real vulnerability class, DFA caching,
  capture groups and why they complicate the linear-time approach, possessive quantifiers and
  atomic groups, RE2's design decision, and testing a regex for exponential behaviour.
- **Demo** — the same pattern run by a backtracking engine and a Thompson simulation on the same
  input, with step counts plotted as the input grows: one curve is exponential, the other linear,
  on the same screen.
- **Diagram** — mermaid state graph of the Thompson construction for `(a|b)*abb`.
- **Lab** — implement the Thompson NFA simulation (parallel state set) for a small regex subset;
  tests assert identical match/no-match results to a backtracking reference and a step count linear
  in input length on the pathological pattern.
- **Senior insight** — a regex from user input on a backtracking engine is a denial-of-service
  primitive. This section is the practical half of M24, which builds the theory.

### 15.11 Text processing in production
- **Covers** — tokenisation strategies (whitespace, rule-based, subword/BPE), normalisation before
  comparison (linking to M62), similarity metrics (Levenshtein ratio, Jaro–Winkler, cosine over
  n-grams, Jaccard over shingles), log parsing and template extraction (Drain-style), and building
  a matcher pipeline with a prefilter, a verifier and a budget.
- **Demo** — a log-parsing pipeline: raw lines in, templates extracted, variable fields identified,
  with per-stage throughput and the resulting template tree shown.
- **Diagram** — mermaid flowchart of the prefilter/verify pipeline with the selectivity at each
  stage.
- **Lab** — build a name-matching pipeline (normalise, block by q-gram, verify by Jaro–Winkler);
  tests assert precision and recall thresholds against a labelled fixture.
- **Senior insight** — the prefilter's selectivity, not the verifier's speed, decides the throughput
  of every matching pipeline; measure candidates-per-result before optimising anything else.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/kmp.js`, `z-algorithm.js` | Prefix function, Z-array, period detection |
| `src/js/algorithms/boyer-moore.js` | Bad-character and good-suffix tables, Horspool, Sunday |
| `src/js/algorithms/rabin-karp.js` | Rolling hash, double hashing, content-defined chunking |
| `src/js/algorithms/aho-corasick.js` | Goto, failure and output links, automaton conversion |
| `src/js/algorithms/manacher.js`, `eertree.js` | Palindromic structures |
| `src/js/algorithms/approximate-match.js` | Bitap, banded DP, q-gram filtering |
| `src/js/algorithms/diff.js` | Myers, linear-space variant, patience, histogram, three-way merge |
| `src/js/algorithms/regex-engine.js` | Parser, Thompson construction, NFA simulation, backtracker |
| `src/js/algorithms/text-pipeline.js` | Tokenisers, similarity metrics, log-template extraction |
| `src/js/machines/match-lab.js` | Corpora, counters, shift traces, adversarial generators |
| `src/js/viz/alignment-view.js` | Text-over-text alignment rendering |

---

## Acceptance criteria

- [ ] Every matcher returns identical occurrence lists to the naive matcher on every corpus,
      including empty patterns, single characters and full-text patterns.
- [ ] Comparison counts are reported per matcher, and the adversarial corpus demonstrably separates
      them.
- [ ] Aho–Corasick reports overlapping and nested matches exactly once each, asserted against a
      brute-force multi-pattern oracle.
- [ ] The anti-hash generator in 15.5 produces a real collision for the fixed-parameter hash, and
      the randomised variant survives 10³ attempts.
- [ ] Myers's edit script provably transforms A into B, applied and compared, for 10³ randomised
      pairs.
- [ ] The regex section demonstrates measured exponential versus linear step counts on the same
      pattern, and the Thompson implementation agrees with the backtracker on all fixtures.

---

## Sources

- Gusfield — *Algorithms on Strings, Trees and Sequences*
- Knuth, Morris, Pratt — *Fast pattern matching in strings*
- Boyer, Moore — *A fast string searching algorithm*
- Karp, Rabin — *Efficient randomized pattern-matching algorithms*
- Aho, Corasick — *Efficient string matching: an aid to bibliographic search*
- Manacher — the linear-time palindrome algorithm
- Baeza-Yates, Gonnet — *A new approach to text searching* (bitap)
- Myers — *An O(ND) difference algorithm and its variations*
- Cox — *Regular expression matching can be simple and fast*
