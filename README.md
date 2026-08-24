# Berugo Learning

An interactive, browser-only platform where senior engineers learn and **practise** computer science
and systems engineering — algorithms, data structures, automata and language theory, compilers,
computer architecture, operating systems, networking, data systems, distributed systems and
engineering craft — with a runnable JavaScript demo, an editable code lab and graded exercises in
every section.

**Not a tutorial site.** Every claim it makes is executable: if a section states a cost, a bound or
a failure mode, the demo measures or exhibits it. Where a real system cannot be reproduced
faithfully in a browser, the section models it, says so plainly, and states what the model omits.

---

## Status

**M00–M25 shipped (248 sections). Building the curriculum, milestone by milestone.**

- ✅ Curriculum designed: 65 milestones, 634 sections, 11 tracks — one file per milestone in
  [`doc/milestones/`](doc/milestones/)
- ✅ Architecture and conventions fixed — [`doc/architecture.md`](doc/architecture.md)
- ✅ Build order and dependency graph — [`doc/ROADMAP.md`](doc/ROADMAP.md)
- ✅ Scope decisions recorded — [`doc/topic-suggestions.md`](doc/topic-suggestions.md)
- ✅ **Notation decoder across all 248 sections**: every mathematical symbol carries how to say it
  and what it does, revealed on hover, tap or keyboard focus, and every formal statement whose
  notation a reader cannot pronounce carries an "In words" translation beneath it. The audience is
  a senior engineer with little or no mathematics, so the Description tab explains the idea before
  the symbol — see [`src/js/content/notation.js`](src/js/content/notation.js) for the glossary and
  [`notation-local.js`](src/js/content/notation-local.js) for the per-section meanings of α, ε, δ
  and λ.
- ✅ **M00 — platform foundation**: shell, curriculum-driven navigation, worker sandbox, graded
  code labs, content registries, D3/mermaid pipelines, progress, and three automated checks.
  4 sections live.
- ✅ **M01 — complexity, analysis and benchmarking**: witness checking, recursion trees and the
  master theorem, the three amortised arguments, indicator-variable analysis against simulation,
  decision-tree and adversary lower bounds, measured crossovers, peak-memory shapes, the doubling
  experiment, and a benchmark harness whose mistakes are switchable. 9 sections live.
- ✅ **M02 — linear structures and memory layout**: alignment and stride, AoS vs SoA, growth
  policies, pointer chasing against a simulated cache, the call stack as a memory budget, ring
  buffers and full-queue policy, batch-size trade-offs, bump/free-list/first-fit allocators and
  fragmentation, gap buffers vs piece tables vs ropes, and cache-conscious search layouts.
  9 sections live.
- ✅ **M03 — hashing and hash tables**: avalanche as a statistical test rather than a band, the
  hash-flooding attack priced against treeification and a keyed hash, chaining under the Poisson
  model, the tombstone trap and backward-shift deletion, Robin Hood against hopscotch and cuckoo,
  Swiss-table group probing, the rehash spike and its incremental fix, FKS and CHD on a static key
  set, and the insertion-ordered map behind `Map`. 9 sections live.
- ✅ **Every section carries two worked examples**: one that derives the result and one that
  inverts it — the load factor where the cache-conscious layout loses, the workload where the better
  deletion strategy ranks last, the range where a doubling table cannot tell two curves apart. Every
  figure in them is recomputed by a test.
- ✅ **M04 — search trees and disjoint sets**: rotations and the three delete cases, AVL against its
  Fibonacci bound, red-black as a 2-3-4 tree, treaps whose shape ignores insertion order, splaying
  and the skew where it starts paying, scapegoat rebuilds under the α dial, B+ trees sized from the
  page, the augmentation rule, skip lists and what p really trades, and union-find with the
  rollback its compression makes impossible. 10 sections live.
- ✅ **M05 — heaps and priority queues**: the array heap and why Floyd's build is linear, arity as a
  cache decision, heapsort's guarantee against its cache behaviour and the top-k it wins, leftist,
  skew and binomial melds, Fibonacci heaps read as an existence result, pairing heaps that beat
  them on a real machine, the position map that makes decrease-key addressable, and timing wheels
  against a heap with an M/M/1 simulator to check itself. 8 sections live.
- ✅ **M06 — tries, suffix structures and text indexes**: the prefix query a hash table cannot
  answer, path compression measured against the keys that make it pay, ternary trees and DAWG
  minimisation, Ukkonen phase by phase, suffix arrays with three constructions cross-checked,
  the suffix-automaton clone case beside the factor oracle that skips it, the BWT inverted without
  its matrix, posting-list intersection at every skew, and three fuzzy back-ends ranked by recall
  rather than latency. 9 sections live.
- ✅ **M07 — probabilistic and streaming sketches**: Bloom sizing and the error that keeps climbing
  past the n you sized for with no signal, counting/blocked/scalable variants each buying one
  property in a different currency, cuckoo and quotient filters with their load ceiling and the
  delete that silently corrupts, HyperLogLog's exact merge against the shard sum that over-counts
  by 70%, count-min's one-sided error beside count-sketch's unbiased one, four quantile sketches
  scored on value *and* rank, MinHash banding as an explicit precision/recall dial, DGIM and
  space-saving against an exact reference, and a chooser that measures its candidates rather than
  looking them up — with two working attacks on an unkeyed sketch. 9 sections live.
- ✅ **Three tabs per section, Description first**: every one of the 1 161 concepts across the built
  sections carries a full explanation — the mechanism, why it is built that way, and what breaks
  when it is ignored — and the coverage test rejects a concept that carries only a one-line gloss.
  Examples holds the demo, its charts and the code lab; References holds the reference block.
- ✅ **M08 — spatial and multidimensional indexes**: a uniform grid whose predicted cost is compared
  with its measured one on every query, the quadtree depth cap as a correctness requirement rather
  than a knob, a k-d tree with the backtrack deleted so the 60% wrong-answer rate is visible, four
  R-tree splits ordered by overlap rather than height, the surface-area heuristic evaluated as a
  cost model and then checked against the rays, Morton against Hilbert under two metrics that
  disagree, six one-dimensional range structures with the constant O(log n) hides, HNSW and product
  quantisation scored on recall rather than latency, and sweep and prune beside the tunnelling
  failure no broad phase can fix. 9 sections live.
- ✅ **M09 — persistent, immutable and succinct structures**: path copying, fat nodes and node
  copying priced on both axes so the cheapest write turns out to be the most expensive read, an
  amortised bound broken on purpose by reusing one version a thousand times and repaired by a
  memoised suspension, persistent segment trees whose 11 nodes per update are exactly the bound,
  bit-partitioned tries where the depth claim and the sparse-node claim are shown to be separate,
  one finger tree answering four unrelated queries by changing only the monoid, a zipper whose
  saving is the edit count rather than the depth, a two-level rank/select index that reports its
  own 7.9% overhead and the density at which the obvious array beats it, LOUDS at 2.0002 bits a
  node with the 177× headline corrected to 5.8× once the payload is added, and Roaring shown
  losing to WAH on the one input it is usually assumed to win. 9 sections live.
- ✅ **M10 — sorting, selection and searching**: four elementary sorts whose ranking inverts between
  the comparison column and the move column, four merge schedules doing identical merges and differing
  by a factor of two in movement, three partition loops on 2 000 identical values costing 2 004 997,
  31 723 and 2 012, the anti-quicksort input that drives median-of-three above n²/4 while returning
  perfectly sorted output, Timsort's merge-stack invariant broken by the de Gouw run lengths with both
  versions sorting correctly, radix sort made silently wrong by one loop direction and the key range
  that decides whether anyone notices, selection reported as the mean of seven pivot seeds because one
  run is one sample, seven binary-search mutations against thirteen probe cases where one defect is
  caught by a single case and another by no output check at all, binary search over an answer axis
  nobody stored, replacement selection removing a whole merge pass, sorting networks proved by
  exhaustion over every zero-one input, and a chooser that takes the workload as its input. 10
  sections live.

- ✅ **M11 — algorithm design paradigms**: n-queens with two prunings whose surviving fractions
  nearly multiply — 1.88% and 50.00% leaving 0.9389% where the product predicts 0.9384%, and the
  section says why the difference is there — Karatsuba measured at a flat 1.70× the n^1.585 model and
  *losing* at four digits, Strassen trading 12.5% of the multiplications for a relative error that
  grows with the side, three greedy criteria beaten by a search that reports how many instances it
  needed (5, 554 and 94 996) beside one that survives 200 000, matroids where the same greedy loop is
  exact and a matching system where it is not, a Sudoku matrix in which MRV wins on four puzzles and
  loses on the fifth, an inadmissible bound that is cheaper, silent and wrong (640 against 658),
  monotonic sweeps at two deque operations per element against a 24.8× rescan, meet in the middle
  turning 2^40 into 2^21, and Mo's algorithm whose tuned block size minimises the model while a
  larger one minimises the measurement. 9 sections live.

- ✅ **M12 — dynamic programming**: three evaluations of one recurrence measured through a single
  instrument (242 785 naive calls against 26 memoised states at n = 25), a tabulation run in the wrong
  order returning 0 from 48 cells read before they were written, patience sorting's pile tops shown to
  be increasing, exactly the right length and *not a subsequence*, coin change answering two different
  questions one loop-swap apart (4 against 9), a knapsack table whose capacity gains a digit and grows
  tenfold while the input grows 3.3 bits, Hirschberg recovering the alignment at 16 peak cells against
  56, Knuth's optimisation taking 156 split tests to 72 — and refusing when the quadrangle inequality
  fails, which it does by 1.11 × 10⁻¹⁶ of pure floating-point noise unless the check carries a
  tolerance, rerooting answering all 2 000 roots in 1 999 combines while the prefix/suffix trick is
  measured *losing* on a path and winning by 333× on a star, Held-Karp replacing 39 916 800 tours with
  49 152 cells against a 6.7 GB wall at n = 25, digit DP counting to 10¹⁸ in 190 states, four DP
  optimisations each refusing when its precondition fails, alpha-beta spanning 7 275 to 42 094 nodes
  for the same value while *reversing* the move list changes nothing at all, and a board game that is
  cyclic before any snake is placed. 11 sections live.

- ✅ **M13 — graph algorithms I**: three representations of one graph costing 25.3 KB, 38.8 KB and
  1.2 MB with the crossover measured at exactly half density, BFS and DFS doing identical work and
  differing 20 against 400 in peak memory, a build whose 4.72× speedup ceiling is reached at eight
  workers and never moves again, one extra import turning 40 ordered packages into 37 and a named
  cycle, Tarjan and Kosaraju agreeing on a partition that condenses 74 edges into 14, one redundant
  cable taking a barbell from one bridge to none while leaving both cut vertices exactly where they
  were, a four-vertex graph on which Dijkstra is confidently wrong one hop downstream of the negative
  edge, a Floyd-Warshall loop order that does the same 64 000 relaxations and is wrong on 554 of
  1 600 cells, an admissible and consistent Manhattan estimate that prunes nothing at all against ALT
  landmarks at 16.33×, a witness search that skips two shortcuts and answers 42 of 1 260 pairs
  incorrectly — twenty of them claiming no route exists — three spanning-tree algorithms agreeing on
  270 and disagreeing on which 59 edges make it, the minimax path the MST answers for free on 136 of
  198 pairs where the cheapest route does not, and binary lifting measured *losing* to the naive climb
  on a 200-node tree of depth 13 and winning by 19× on a path. 10 sections live.

- ✅ **M14 — graph algorithms II**: a maximum flow of 22 confirmed by six algorithms whose arc visits
  spread 3.4×, path filling without a residual arc returning 1 999 where the answer is 2 000 and
  falling short on 2 of 20 networks nobody arranged, a segmentation whose cut capacity rises from 92
  to 242 across the very sweep that takes its misclassification from 15.6% to zero, five project
  instances confirmed against all 256 subsets, push-relabel doing 369 relabels untuned against 50 —
  and 44 with *one* of its two heuristics, which beats the pair — a min-cost curve of 1, 2, 4, 9, 18,
  28 whose marginals never fall, Hopcroft-Karp measured *losing* to Kuhn below 32 vertices a side and
  saving 2.74× at 256, a stable matching whose proposing side moves the other side's aggregate rank
  from 10 to 20 with nobody worse off, a six-vertex graph on which bipartite-style augmentation
  returns 2 where the answer is 3 — and returns 3 on the same eight edges in a different order — a
  2-SAT relaxation of three-literal clauses that is wrongly negative on 46 of 100 instances and
  wrongly positive on none, three greedy colourings of one graph at 5, 3 and 4 against an exhaustive
  3, a force-directed layout finding a planar embedding of a grid while its energy *rises* on 34% of
  the iterations, Euler's bound catching K5 and missing K3,3 entirely, and a PageRank vector that
  leaks 57% of its probability while inverting nothing at all across 4 589 link graphs. 10 sections
  live.

- ✅ **M15 — string algorithms and pattern matching**: the naive scan measured at 1.05 comparisons
  per text character on English against 11.97 on adversarial input, with the first-character filter
  saving *no comparison at all*; KMP measured *losing* to it on English (1.08 against 1.07) and
  winning 6.0× on the adversarial corpus, its automaton costing 40 cells on DNA and 260 on English
  for the same ten states; Boyer-Moore falling 0.611 → 0.106 characters examined per text character
  as the pattern grows from 2 to 32 while KMP stays flat at 1.05, the bad-character rule deciding
  1 195 of 1 374 contested shifts and the best of Boyer-Moore / Horspool / Sunday changing hands
  four times across seven corpora; Rabin-Karp taking 19 spurious hits at modulus 101 and none at a
  million for the same 12 occurrences — 200 under an attack that 20 random bases defeat 20 times out
  of 20; Aho-Corasick finding 11 matches with its output chain and 9 without, the two lost being
  exactly `he` inside `she`, at 4 000 comparisons for 1 pattern and for 32 against 135 036 for
  separate scans; Manacher reusing 11 of 31 centres and beating expansion by 1.5× on random binary
  but 200.5× on a repeated character; Wu-Manber agreeing with a DP reference at every k and refusing
  at length 40, and a q-gram filter whose threshold goes negative at q = 4 so candidates per result
  jump 2.0 → 6.6 → 44.3 for the same 27 results; Myers doing 6 operations in 3 hunks against
  patience's 8 in 2, with work tracking D and not N — 13 diagonals at 1% changed, 29 041 at 60%;
  backtracking taking 1 048 576 steps against the state-set simulation's 142 at 18 characters and
  exhausting a 2 000 000-step budget at 20, while the state-set peak stays at 4 of 5 states and
  three of six patterns are catastrophic — all three nesting a quantifier over the same characters;
  and a Drain-style extractor reducing 300 log lines to 4 templates, one covering 182, where
  Jaro-Winkler scores two *different* accounts at 0.956 and Levenshtein scores one name against
  itself reordered at 0.059. 11 sections live.

- ✅ **M16 — computational geometry**: the orientation predicate measured three ways over 4 000
  near-collinear triples, where the tolerance test everyone reaches for scores 0 self-contradictions
  and 4 000 wrong answers while the naive determinant scores 1 121 and 642 — and the adaptive one
  scores 0 and 0 for an escalation rate of 0.00% on ordinary points against 62.67% on adversarial
  ones; ray casting and the winding number disagreeing on 44 of 441 probes at a pentagram's centre
  and on none of the six simple fixtures, with the bowtie crossing itself and still agreeing
  everywhere; four hull algorithms returning the identical 12-vertex hull at 789, 1 314, 1 651 and
  2 400 orientation tests, and gift wrapping costing 16 384 tests on a 1 024-point cloud and
  1 047 552 on 1 024 points arranged on a circle; a sweep replacing 66 pairwise tests with 24 events
  and agreeing with brute force on all seven fixtures including the four degenerate ones, with
  rectangle-union area at 876.00 from 9 compressed slabs and from 63 inclusion-exclusion terms;
  Delaunay checked exhaustively at 0 empty-circle violations over 108 triangles and 60 vertices,
  against 562 after 60 legal flips that leave the points, the region and the triangle count
  untouched while the mean smallest angle falls from 26.79° to 18.94°; two Voronoi constructions
  sharing no code agreeing to 3.33e-15 of relative area with 0 of 900 grid points in the wrong cell,
  and Lloyd relaxation taking the largest-to-smallest cell ratio from 65.6× to 3.2× without ever
  converging; Sutherland-Hodgman returning *nothing* against 2 of 5 concave clips and a plausible
  polygon missing 60 to 67% of its area against the other 3, where a convex decomposition lands on
  the sampled area exactly, and a buffer's disc losing 11.80% of its area at 3 corners and 0.17% at
  16; rotating calipers finding a rectangle 10.79× smaller than the axis-aligned box on diagonal
  data and exactly equal to it on a grid, with the diameter exact against every pair and the
  rectangle 0.024% better than a 3 600-angle sweep; gimbal freedom draining 45.88% by pitch 45° and
  63.40% by 60° rather than cliffing at 90°, and a ray-triangle routine agreeing with a
  differently-derived reference on all 20 000 rays; and Bresenham against rounding producing
  identical pixel sets on 2 492 of 3 000 lines with the endpoints and pixel counts always equal,
  coverage summing to 377.63 against a true area of 377.50, and a minimum translation vector that
  separates the shapes where taking the push from the centroids fails 38 of 800 overlapping pairs.
  10 sections live.

- ✅ **M17 — numbers, bits and floating point**: carry and overflow measured as the separate
  flags they are, where 0xFF + 0x01 at eight bits carries without overflowing and 0x7F + 0x01
  overflows without carrying — an earlier model computed carry from the signed sum and got the
  canonical case backwards; the De Bruijn bit scan costing *more* than the loop it replaces on
  random words, 5.00 operations against 4.00, and 9.20× less in the worst case, against SWAR
  popcount's flat 12 against 96 on every one of 85 536 checked inputs; a bitset's crossing density
  solved rather than asserted at 3 906 elements — 0.391% — under a *stated* 32-byte model for a
  `Set` entry, with word operations touching 31 250 words whatever the answer's size and iteration
  costing 51 031 steps against a scan's 1 000 000; 0.1 printed as the specific rational it is,
  3 602 879 701 896 397 / 2⁵⁵, with the spacing ladder locating 2⁵³ exactly and the three float
  comparisons disagreeing at 8 388 608 doubles apart and at 4 503 599 627 370 496; four orderings
  of one array landing 0, 41 434 and 50 078 representable doubles from the exact BigInt sum while
  compensation lands on it every time, and the textbook one-pass variance wrong by a relative
  2.619e+5 where Welford is 1.167e-7 and two passes 7.010e-11; the money claim *refuted* — a
  million transactions summed as doubles are out by 6.855e-5 of a cent and round correctly every
  time, and what they lose is equality, on 88.4% of ledgers — while applying an 8.75% rate loses a
  cent on 1 026 of 200 000 lines and a 20% rate on none, with no way to tell from the rate;
  Karatsuba crossing at 128 bits on multiplications, 2 048 on total limb work and nowhere on wall
  clock, and algorithm D's add-back firing once in 500 034 quotient digits so that two named
  fixtures are the only way it is ever tested; every coprime base fooling the Fermat test on all
  eight Carmichael numbers at 100.0% while base 2 alone rejects them, and Pollard's rho factoring a
  15-digit semiprime in 2 532 operations against trial division's exhausted 5 000 000; every
  generator passing a one-dimensional histogram including RANDU, whose statistic of 0.1 against an
  expectation of 63 is *too even* and whose triples satisfy x[n+2] = 6·x[n+1] − 9·x[n] with a
  residual of exactly 0; and a random UUID touching all 64 index pages in a 64-insert window where
  a sequence touches 14 — with UUIDv7 at 15 and out of order on 6 735 of 13 333 same-millisecond
  pairs, which is exactly what breaks a cursor. 10 sections live.

- ✅ **M18 — numerical methods, transforms and optimisation**: the residual holding flat at
  machine precision across nine orders of conditioning while the relative error climbs from
  1.65e-16 to 1.89e-1, and the Hilbert matrix losing every correct digit by n = 13 with a residual
  still at 2.04e-16 — so every automated correctness check passes on an answer with no relationship
  to the truth; Newton fitting a convergence order of 1.957 and the secant 1.580 against the golden
  ratio, while bisection’s column is deliberately blank because an earlier version fitted it a
  confident 1.857 that means nothing — its bracket contraction of exactly 0.5000 against false
  position’s 1.0000 is the honest characterisation; Newton returning a genuine root correct to
  fifteen digits and the *wrong* one from 3 of 9 starting points, with the basin flipping between
  0.8150 and 0.8165 where the derivative vanishes; a pivot of 1e-18 destroying an answer by an
  *addition* rather than a division — 1 − 1e18 rounds to −1e18 — for a relative error of 7.07e-1
  with no exception raised, against Wilkinson’s matrix attaining the 2ⁿ⁻¹ growth bound exactly while
  partial pivoting performs zero swaps; the explicit inverse measured at 8.4× the error of the
  factorisation it was built from, for more work; κ(AᵀA) sitting at exactly κ(A)² until the
  measurement itself saturates near 1/ε, and classical Gram–Schmidt landing 4.4e+13 further from
  orthogonal than Householder on one degree-9 Vandermonde; power iteration priced entirely by the
  spectral gap at 33 iterations for 0.5 and 1 802 for 0.99 with the matrix size absent from both
  columns, and Wilkinson’s polynomial moving a root by 9.051e-1 from a perturbation in the
  eleventh digit; five times the data making a polynomial fit 5.9e+2 times *worse*, fixed twice —
  Chebyshev nodes at 8.166e-3 and a spline at 1.926e-3 — and a C² spline dipping 0.1094 below
  non-negative data while interpolating every point to 1.1e-16; the V curve bottoming out at
  h = 1e-8 and 2.97e-9 for a forward difference against √ε = 1.49e-8, with the complex step scoring
  exactly 0 because it never subtracts; reverse-mode autodiff at 9.60× less work than forward mode
  on 24 inputs and one sweep against 24; RK4’s orbital radius decaying monotonically to 0.994302
  over 200 000 steps while Verlet oscillates inside 1.000000–1.004988 — an effect that *does not
  reproduce* at h = 0.01, where both hold to a part in 10⁹, so the demo defaults to the step where
  it is real; a butterfly count of exactly (n/2)log₂n and one pure tone leaving a 74×
  peak-to-sidelobe ratio that a Blackman window takes to 54 709×, with 1 100 Hz landing on 100 Hz
  irrecoverably; and gradient descent going from 2 iterations to 9 244 as κ goes 1 → 1 000 while
  Newton takes 2 throughout, with a pure 45° rotation costing coordinate descent a factor of 34 on
  a surface whose eigenvalues did not move. 10 sections live.

- ✅ **M19 — randomised and approximation algorithms**: the smallest Carmichael number fooling the
  Fermat test on 318 of 558 bases — 57.0% — and Miller–Rabin on 8 of them, so one extra square-root
  check takes a bound of 0.57ᵏ, which never reaches 10⁻¹⁰, to 0.0143ᵏ, which reaches it in five
  rounds; a Las Vegas mean of 5.074 attempts beside a 99th percentile of 21 and a worst run of 36,
  where a budget of "twice the average" kills 11.3% of runs; Karger's bound of 1.52% measuring
  34.55% on a graph with one minimum cut and 1.65% on a cycle where it is exact — the same 2 000
  runs supporting "sixty-six times too pessimistic" and "correct to a tenth of a percent" depending
  on which event is counted — with all 66 of C₁₂'s minimum cuts turning up, which is the counting
  corollary attained; antithetic sampling cutting the variance 61.87× on a monotone integrand and
  making the measured error 2.5 times *worse* on an oscillating one, and a stratified estimator
  reporting no variance reduction at all while its error falls by a factor of 3 445 — because the
  sample-variance formula assumes draws that stratification deliberately makes non-identical; a grid
  beating sampling by 2.48e-9 against 3.19e-3 at one dimension and losing from six onwards at the
  identical 4 096-point budget; P(Z > 4) estimated as **exactly zero with a standard error of exactly
  zero** by 20 000 plain draws, and an over-shifted importance proposal putting 19 982 of 20 000
  draws past the threshold — the best hit count in the table — while being 15.7% wrong, caught only
  by a weight ESS of 75.4; an MCMC chain accepting 92.7% of its moves, which reads as perfect health,
  worth 74.9 independent draws out of 20 000 and reporting an answer 249 of its own standard errors
  from the truth, with R̂ = 1.5081 across four dispersed chains the only diagnostic that sees it;
  Freivalds catching one wrong entry in 3 600 at 0.50850, 0.24550, 0.12300 down the round counts
  with **zero** false alarms in 32 000 tests; a fingerprint pair differing in one position colliding
  0 times of 4 000 at every field size — so quoting that against the n/p bound would be a demo
  validating a theory it never tested — against a constructed pair landing on 0.08575 versus a bound
  of 0.0792; the vertex-cover algorithm with a proven factor of 2 measuring 1.5161 and attaining
  exactly 2.0000, while highest-degree greedy, which has no bound at all, measures 1.0321 on random
  graphs and 3.82 on the family built to defeat it; greedy set cover paying *exactly* H(n) —
  5.4331 at n = 128 — on Vazirani's instance and 1.2330 on instances that arose by accident; 150 of
  150 LP basic solutions half-integral and the integrality gap matching 2 − 2/n to every digit on
  the complete graphs, which is a ceiling no rounding can pass; a knapsack FPTAS asked for half the
  optimum returning 99.6452% of it from a table 25.6× smaller, and at ε = 0.01 costing 514 000 cells
  against the exact DP's 258 640 for the identical answer, because the scaling divisor has fallen to
  0.503; and 232 of 500 random assignments falling below the |E|/2 they meet in expectation, against
  a conditional-expectation walk that cannot and a pairwise-independent family of 32 assignments
  whose average is exactly 18.5000. 9 sections live.

- ✅ **M20 — NP-completeness, reductions and metaheuristics**: verifying a 12-vertex Hamiltonian
  certificate in 24 steps at every size while refuting an obstructed instance costs 4 794 and grows
  by a factor of 1.96 per vertex — and a *planted* instance where the search finds the answer in 13
  steps against 20 to check it, which is why a benchmark of generated YES instances measures its own
  generator; five reductions round-tripped forward, solved, mapped back and then **validated against
  the source**, with the same nine-clause formula costing 10 target-solve steps satisfiable and
  127 382 unsatisfiable through 3-colouring; six clause families of 42 variables whose DPLL node
  column spans 1 to 1 439, where the two Horn rows never branch at all and PHP(6) branches 1 439
  times on fewer clauses than the random row beside it — and the pigeonhole family measuring
  *exactly* 2·h! − 1 nodes and h! conflicts from three holes to eight, which is Haken's theorem
  observed rather than cited; one matrix under five quantifier prefixes where a SAT solver calls
  every one satisfiable and three of the five sentences are false, beside ∀x∃y and ∃y∀x on
  byte-identical clauses with opposite answers at every size; edge branching measuring a base of
  2.0030 and 2^(k+1) − 1 nodes exactly, degree branching 1.4991, and the reduction rules cutting
  every node count from 127 to 1 while *raising* the fitted base to 3.0163 — because a growth rate
  fitted where preprocessing is still engaging measures the preprocessing disengaging; a Buss kernel
  holding at 14 edges while its instance grows from 137 to 1 953; eight metaheuristics under one
  40 000-evaluation budget where plain 2-opt reaches the best tour in the table using 2 430 of it and
  four sophisticated methods spend all of it to arrive at the same place or worse, with the ranking
  reversing at 2 000 and at 160 000; pairwise at-most-one costing 1 999 000 clauses against a
  sequential counter's 5 996 at 2 000 literals, while six unit clauses of symmetry breaking take an
  unsatisfiable colouring from 1 439 search nodes to 1 — and the three encodings giving *identical*
  node counts on this DPLL, which is a fact about the solver and is reported as one; a phase
  transition whose satisfiability crossover measures 4.38 and whose cost peak measures 4.50 at 44
  variables rather than the asymptotic 4.27, with a restart cutoff of 1 000 flips cutting the mean
  from 1 582 to 1 314 and a cutoff of 100 making it 4.3 times *worse* than no restarts at all; and a
  nurse roster satisfying all five encoded requirements — checked against the produced grid by code
  the encoder never touched — while giving five nurses five shifts and three of them two, because
  fairness is an objective and a clause cannot carry one. 9 sections live.

- ✅ **M21 — online, external-memory and cache-oblivious algorithms**: the break-even ski-rental
  rule attaining 2 − 1/B *exactly* at all five purchase prices while the mean column makes a
  strategy 5× worse in the worst case look 1% worse, and a randomised strategy measuring 1.5625
  against an oblivious adversary and 3.1428 against an adaptive one; move-to-front scoring 0.3113 on
  a moving working set — an online policy beating the best offline STATIC order — and 1.8964 on the
  sweep built to defeat it; seven replacement policies against Belady on a mixed trace at 72.5% to
  58.7% against a ceiling of 72.6%, and a loop of 120 keys through a cache of 100 where six of the
  seven measure **0.0%** and W-TinyLFU measures 81.9%, because a tie in its admission contest goes
  to the incumbent; list scheduling measuring 1.5000 against exact optima and its trap attaining
  2 − 1/m to the digit, with two choices holding the maximum bin load at 3.08 where one choice
  reaches 6.83; Johnson's sevenths-thirds-halves family holding first-fit at 1.6667 at every size
  while the same items sorted pack *exactly* optimally — and the epsilon direction is the finding,
  since nudging sixths up instead makes one of each overflow the bin and the stated optimum
  unreachable; an external merge sort matching its closed form at 1.0000 across four (M, B) settings
  under a budget the simulator *enforces by throwing*, with peak-held equal to M in every row, and a
  nested-loop join costing one transfer per row against a sort-merge's 20 000 at 128 000 rows; a
  recursive matrix multiply staying within 1.176–1.333× of a tile **retuned at every cache size**,
  where that best tile is 8, 16, 32 and 4 — and the van Emde Boas layout measuring 6.65 misses per
  search against 12.00 on *identical* comparison counts at height 18, while being slightly worse at
  height 10 where the tree fits; an exact distinct-value set killed at item 345 of 200 000 against
  HyperLogLog's 4.33% error in 4 096 bytes, with the p=8 row measuring 8.38% against a predicted
  6.50% for a documented reason; a prefix sum with work 511 and span 17 scheduled greedily under
  Brent's bound at every processor count and flooring at 17 steps; and one sort predicted as
  1 048 576 comparisons, 10 240 misses, 4 096 transfers and 256 dependent steps — four numbers in
  four units, of which exactly one can be checked against a simulator, and is. 9 sections live.

- ✅ **M22 — compression, information theory and error correction**: an entropy estimator checked
  against six closed forms to within 0.0110 bits, and then used to expose its own worst failure —
  random bytes measuring 0.036 bits per byte at order 2 over 2 944 contexts seen once each, a
  number that would mean random data is 99.5% predictable and is left blank in the redundancy
  column rather than printed; Huffman pinned at *exactly* 1.0000 bits at every skew while the
  entropy falls to 0.0114, wasting **87.66×** at 999:1 where an arithmetic coder stays inside
  1.052×; that same arithmetic coder landing **+1.03 bits above the information content of a
  3 000-byte message** against Huffman's +165.0, with the pending-underflow counter reaching 10 —
  the field whose omission produces a coder that passes short tests and corrupts real files; a
  compression-level ladder that is one parameter, measuring 10.5× the search work for 22.8% better
  compression while the decoder reads *fewer* tokens; a bare LZSS **losing** to a 1984 algorithm on
  prose, because 21 bits of fixed fields per match beat 12 bits of dictionary code only once the
  tokens are entropy-coded; six codecs over seven corpora producing **two different winners** and
  66 of 66 verified round-trips, with every codec expanding random bytes and DEFLATE's 0.998
  against a bare coder's 0.893 being entirely the five-byte stored block; a plain order-k model
  getting *worse* past order 2 at 8.3 observations per context while PPM with escapes keeps falling
  to 0.350× of it, and a four-model mixture finding the best order without being told; a transform
  whose output has the entropy of its input to *every decimal place* — 4.5612 before and 4.5612
  after — followed by a stage that takes it to 0.7405; a JPEG re-encode loop that reaches a fixed
  point after **one** round when the grid is aligned and never stops losing when it is shifted three
  pixels, which turns "never re-save a JPEG" into "never re-save one after anything has moved";
  sorting a column being worth 3.59× where the encoding choice is worth 1.5×, and the same metric
  compressing 1.32× at full double precision and 9.23× rounded to the precision it was actually
  measured at; a byte sum catching 100% of single-bit flips and **0%** of byte swaps, CRC-32 missing
  no burst up to 34 bits at any position, and then a forged CRC — four appended bytes solved as a
  32×32 linear system; and Hamming corrected on **112 of 112** single-bit errors with the syndrome
  equal to the flipped position every time, 448 of 448 double errors detected rather than
  miscorrected, and an erasure code giving more durability than 3× replication at 47% of the
  storage and ten times the rebuild traffic. 11 sections live.
- ✅ **M23 — applied cryptography and constant-time programming**: six published test vectors —
  FIPS 180-4, FIPS 197, RFC 4231, RFC 6070 and RFC 8439 — recomputed at render time rather than
  asserted in a comment, because a cryptographic implementation with a wrong constant produces
  stable, well-distributed, completely wrong output and nothing else detects it; a statistical
  generator state-recovered from **one** observed value and its next eight predicted *exactly*,
  while the same stream measures **7.9553 bits of entropy per byte** over 4 000 samples and its low
  byte measures 1.2946 with 17 distinct values — both equally predictable, only one of them looking
  it; a length-extension forgery computing **29 glue bytes** from a length nobody hid and producing
  a tag the key holder's own verifier accepts, with the identical attack rejected by HMAC; six
  password stores priced at one 250 ms budget, from 4.096 × 10¹⁰ guesses per second down to
  2.048 × 10⁴, and a memory sweep dividing the attacker by **128×** at unchanged defender cost while
  bcrypt's 4 KiB does not constrain a 16 GiB rig at all; an image whose 144 blocks collapse to **26
  distinct ciphertext blocks** under ECB against 145 under CBC, drawn as pixels so the shape is
  visible; a padding oracle decrypting a 30-byte message in **2 749 yes-or-no answers** without
  touching AES, and five edited bytes rewriting a CTR plaintext with **zero** queries; one repeated
  nonce handing over a 15-byte plaintext in full and then a tag AES-GCM *accepts*, with the birthday
  bound putting random 96-bit nonces at 1.164 × 10⁻¹⁰ risk at 2³² messages and **39.35%** at 2⁴⁸;
  one eavesdropper, one loop, breaking Diffie–Hellman in 872 steps at 13 bits and giving up at 31,
  and one chosen-ciphertext query recovering a textbook RSA plaintext that trial division would have
  found in 1 060 divisions anyway; an ECDSA private key falling out of two signatures sharing a
  nonce in **four modular operations**, and five certificate chains run through a real validator
  that applies 9 checks to the well-formed one and 14 to the leaf-signs-leaf case, each broken chain
  failing on exactly its own check; a stolen session state opening **3 of 10** messages — none
  before the theft, none after the ratchet turned, with nobody detecting the compromise; a 4-byte
  token recovered from timing in **1 024 guesses** against a blind space of 4.295 × 10⁹, separating
  right bytes from wrong by 4.5029 σ where the branchless comparison separates them by 0.0885 and
  fails in all 24 cells of the noise sweep; and every one of 10 three-share Shamir subsets
  reconstructing exactly while two shares silently return 446 296 622 and rule out **none** of the
  candidates, next to a Merkle proof of one entry in a billion at 30 hashes and 960 bytes against
  34.4 GB. Every attack executes; nothing is narrated. 11 sections live.
- ✅ **M24 — regular languages and finite automata** (the automata track opens): eight languages
  each run against the weakest machine that recognises them, with a finite automaton checked
  string by string wherever one exists — **15 of 127** strings for "ends in abb" and a 4-state
  machine agreeing on all of them, against **4 of 127** for aⁿbⁿ and no automaton offered because
  none exists; five DFAs checked against arithmetic rather than against themselves, with
  divisibility by 7 built from `r → (2r + b) mod 7` and agreeing on **511 of 511** binary strings
  up to length 8; the exponential family measured at **256 minimal states for 18 positions** —
  exactly the predicted 2⁸ — with the subset construction landing one state above the bound at
  every n and minimisation removing precisely that one; three constructions on one pattern at
  **14, 6 and 4 states**, all cross-checked over 511 strings, and the derivative DFA reaching the
  minimal machine with no minimisation pass; Moore, Hopcroft and Brzozowski all returning 4 states
  and a brute-force Myhill–Nerode count that never builds a machine agreeing with them, with the
  witness suffix printed for every pair of classes; the same regex read back off the machine at
  **40 characters in one elimination order and 44 in another**, both round-tripping — because the
  minimal automaton is unique and the minimal expression is not; one product construction with
  four accepting rules deciding containment and returning **"b"** as the shortest string one
  language admits and the other refuses, confirmed by re-running both originals on it; the pumping
  lemma played as the adversary game with all **10 decompositions enumerated and 0 surviving** for
  aⁿbⁿ — and **4 of 10 surviving** on a language that is regular, where it correctly proves
  nothing; two text transducers composed into a single pass and checked against chaining on **204
  of 204** inputs, with a 1-state Mealy case folder growing to **29 states** in Moore form; a
  generated lexer reporting **3 of its 7 decisions** as positions where a shorter match had
  already succeeded and was passed over, and a structural ReDoS analyser getting **9 of 9**
  verdicts right — including one pattern that looks dangerous and is not — before exploding the
  flagged ones at **425 979 backtracking steps against 100 simulation steps**; Viterbi checked
  against every enumerated path with plain probabilities measured to reach **exactly zero at 619
  steps** for one symbol and never within 2 000 for another; and a server that may wait forever
  **passing the safety check and failing the liveness one**, with a lasso no finite test could
  find. 11 sections live.
- ✅ **M25 — context-free languages and parsing**: every parser differentially tested against
  Earley on **13 186 parser-input checks** across eight grammars with **zero disagreements**, and
  Earley itself checked against a brute-force derivation search so the reference is not trusted
  either; ambiguity as a count rather than an opinion — **1, 1, 2 and 5 trees** for one to four
  operands of `E → E + E | a`, with the shortest ambiguous input found by search and both tree
  shapes printed; six grammar transformations run in sequence with the language re-checked against
  the original at every step, taking **6 productions over 3 nonterminals to 33 over 22** with zero
  differences — and the first input whose tree SHAPE changed named, because that is the thing the
  language check is designed not to see; a pushdown automaton with **1 state and 4 transitions**
  matching any bracket depth, and the CFG→PDA construction agreeing with Earley on **31 of 31**
  exhaustive inputs; LL(1) conflicts reported with the two competing productions and a **minimal
  input that reaches the cell** — `"a"`, `"ibtx"`, `"(a)"` — and the repair applied live so two
  grammars reach zero conflicts and the dangling else does not; LR(0)'s **2 shift/reduce conflicts
  dropping to 0** under SLR on the same 12 states, with every conflict naming its state, its
  token, both actions and the items responsible — *state 7, on `e`, shift to 8 against reduce by
  `S → i E t S`*; canonical LR(1)'s **14 states merged to 13** by core, gaining **2
  reduce/reduce conflicts** that exist in neither LR(1) nor SLR, with the pooled lookaheads shown;
  a shared packed parse forest of **87 nodes holding 16 796 distinct trees** at 21 tokens, with
  Earley, CYK and GLR agreeing on every input including the nullable grammar that breaks naive
  Earley implementations; packrat measured at **606 207 plain steps against 124 memoised** — a
  ratio of **4 888.8×** with 28 memo entries — and the PEG alternative that can never win named
  with its reason; a Pratt binding-power table you can edit, with **ten expected parenthesisations
  asserted** and cross-checked against an equivalent precedence *grammar* parsed by Earley; the
  same nested template through two lexers, where the one without a mode stack finds **0
  interpolations instead of 2** and reports no error at all; three recovery strategies on one
  broken file at **1 diagnostic / 1 survivor, 3 / 4 and 3 / 5**; and eight constructs where the
  published grammar is not the language, each with a runnable failing input and the fix that
  shipped — including **6 of 6** automatic-semicolon-insertion cases asserted against the
  ECMAScript rules. 12 sections live.

`npm test` is green — wiring audit, 4 376 unit tests, and a **render audit** that boots the whole
app headlessly and activates all 248 sections, failing on anything that throws while rendering, any
table left with an empty body, and any metric tile still showing a placeholder without a note
explaining it. `npm run lint:size` reports no offenders.

The render audit is not a substitute for opening the page, and M16's browser pass proved it: every chart in the platform drawn on a **logarithmic y axis** was rendering its axes, its grid and its legend with no data in them at all. A d3 log scale handed a domain floor of zero does not throw — `nice()` rounds the floor down to the power of ten below it, that underflows to zero, and every point then maps to NaN. Twenty-eight sections across M01–M16 were affected. `viz/growth-plot.js` now forces a positive floor for any logarithmic axis, and `tests/unit/growth-plot.test.js` pins the invariant.

### The shell

- **The whole syllabus in the nav.** The sidebar lists all eleven tracks — *How to use this site*,
  Algorithms, Data structures, Computer architecture, Operating systems, Automata/languages/compilers,
  Networking, Data systems, Distributed systems, Engineering practice, Practice and mastery — and
  opens to milestones, then sections. Tracks that are planned and not built are listed with their
  milestones and section counts, marked as planned, so the map shows what the platform teaches
  rather than only what happens to be finished. One track and one milestone stay open at a time, so
  the nav is the same height at 214 sections and at 634.
- **Search across everything.** The header search indexes concepts, worked examples, reference
  entries and exercises as well as section titles, so "tombstone", "Little's law" or "round half to
  even" lands on the section that explains it. Ctrl/Cmd+K focuses it; arrows and Enter drive it.
- **Text size and theme** live in the header. The size is a multiplier on the root font, so every
  rem in the stylesheet follows it, and both preferences persist.
- **Installable and offline.** A manifest, icons and a network-first service worker make it an
  installable app that keeps working with no network. The Install button appears only when the
  browser says it can.

---

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| UI | jQuery + Tailwind CSS | No framework; every section reads as plain DOM code |
| Structural diagrams | mermaid.js | State machines, pipelines, protocols, memory layouts |
| Charts and data-driven visuals | D3 v7 via `viz/chart-base.js` | Scales, axes, transitions and the layout algorithms (force, hierarchy, quadtree, contour); Canvas past a few thousand elements |
| Code execution | Web Worker sandbox with hard timeouts | Learner code never touches the page |
| Storage | `localStorage` behind an adapter interface | Theme, progress, lab state — all local, all exportable |
| Build | `tailwindcss` CLI only | One command; no bundler, no transpiler |

All dependencies are vendored into `lib/`, and mermaid and D3 load on first use rather than sitting
in the shell. The site works offline — but it must be **served**, not opened as a file, because Web
Workers do not start from a `file://` origin.

---

## Quick start

> Available from M00 onwards.

```bash
npm install          # devDependencies only: tailwindcss, serve
npm run build:css    # compile lib/tailwind.css
npm start            # serve on http://localhost:3002
```

Then open `http://localhost:3002`. Other commands:

```bash
npm test             # wiring audit + unit tests — must be green before any commit
npm run test:wiring  # static audit of index.html and every module
npm run test:unit    # node --test over the DOM-free logic modules
npm run lint:size    # files over 1000 lines, functions over 50 lines
```

---

## What a section looks like

Every section is the same three tabs, and **Description** is the one that opens:

| Tab | What is in it |
|---|---|
| **Description** | Orientation — what the thing is, what problem it solves, and the misconception experienced engineers usually carry about it — then **every concept explained in full**: a plain statement, the formal one, a paragraph on the mechanism and on what breaks without it, and a concrete instance. Then the structural diagram and the senior insight. |
| **Examples** | The interactive demo with its charts and live metrics, the worked examples that show the arithmetic with real numbers, and the editable code lab with its graded exercises. |
| **References** | Formulation, invariants, complexity, failure modes, real-world uses, sources. |

The concept explanations are the substance of the Description tab: 1 161 of them across the built
sections, averaging about 490 characters each, and the coverage test rejects a concept that carries
only a one-line gloss.

For example, section **3.4 Open addressing** (milestone M03) opens on Description with why open
addressing beats chaining on cache locality and eight concepts explained — including why the choice
of probe sequence decides whether you can delete without tombstones at all. Examples gives you a
slot array where you insert keys and watch the probe sequence walk, with a live plot of the expected
probe count `1/(1-α)` against the measured one, and a code lab that has you implement backward-shift
deletion, whose tests assert that lookups do not degrade after 10⁵ mixed operations — which the
tombstone version fails. References states the complexity table, the load-factor limits and the
tombstone failure mode with its production symptoms.

---

## The runnable-code engine

The differentiator: everything is runnable, and you can edit it.

```js
// What a graded exercise looks like as data
{
  id: 'open-addressing-backward-shift',
  prompt: 'Implement deletion by backward shift, not by tombstone.',
  starter: 'export function remove(table, key) {\n  // ...\n}',
  tests: [
    { name: 'removes the key',        assert: (fn) => /* ... */ },
    { name: 'no lookup regression',   assert: (fn) => /* 1e5 mixed ops */ },
    { name: 'cluster invariant holds', assert: (fn) => /* ... */ }
  ]
}
```

- **Sandboxed.** Runs in a Web Worker created from a Blob URL, with a wall-clock budget (2 s by
  default) and a step budget. Overrun terminates the worker and reports `timeout`. Learner code
  cannot reach the page, storage or the network.
- **Measured honestly.** Complexity demos do not rewrite your code to count operations — they hand
  the algorithm instrumented primitives (`ops.cmp`, `ops.swap`, an instrumented array, an
  instrumented cache) and count what passes through them. Every readout names its counter. Timings
  are medians over repeated runs with the run count shown, never a single sample.
- **Deterministic.** The worker gets a seed and a seeded RNG, so two runs with the same seed produce
  the same trace. "Change one line and compare" actually works.

---

## Curriculum

Full detail in [`doc/ROADMAP.md`](doc/ROADMAP.md); one file per milestone in
[`doc/milestones/`](doc/milestones/).

| Track | Milestones | Covers |
|---|---|---|
| 0 · Platform | M00–M01 | The engine; complexity, analysis and benchmarking methodology |
| 1 · Data structures | M02–M09 | Memory layout, hashing, search trees, heaps, text indexes, sketches, spatial indexes, persistent and succinct structures |
| 2 · Algorithms | M10–M23 | Sorting, design paradigms, DP, graphs, strings, geometry, numbers and floating point, numerical methods, randomised and approximation algorithms, NP-completeness, online and external memory, compression and coding, applied cryptography |
| 3 · Languages and compilers | M24–M32 | Automata, parsing, computability, lambda calculus and types, then a full compiler: front end, SSA optimiser, VM and JIT, garbage collector, program analysis with SAT/SMT and model checking |
| 4 · Computer architecture | M33–M40 | Gates to ALU to CPU to pipeline to out-of-order; caches, coherence and consistency; linking and the ABI; GPUs and accelerators |
| 5 · Operating systems | M41–M47 | Processes and scheduling, synchronisation, virtual memory and allocators, file systems and crash consistency, I/O and event loops, virtualisation, applied concurrency |
| 6 · Networking | M48–M50 | Link/IP/routing, TCP and congestion control and QUIC, DNS/TLS/HTTP and the web stack |
| 7 · Data systems | M51–M53 | Storage engines and indexes, query processing and optimisation, transactions and recovery |
| 8 · Distributed systems | M54–M57 | Time and consistency and replication, consensus, partitioning and CRDTs, streaming and resilience |
| 9 · Engineering practice | M58–M62 | Performance engineering and queueing theory, security engineering, architecture and API design, testing and observability, systems data (Unicode, time, serialisation, IDs) |
| 10 · Practice and mastery | M63–M64 | Twelve build-your-own-X capstones; challenge arena, spaced repetition, mastery map |

Three things run through the whole curriculum rather than sitting in one track:

- **One machine, built up.** M33's gates become M34's CPU, which M35 pipelines, M36 makes
  out-of-order, M37 gives a memory hierarchy, M41 runs an OS on, and M46 virtualises.
- **One language, built up.** M28's front end feeds M29's optimiser, M30's VM and JIT, M31's
  collector and M32's analysers — and M34's CPU runs its compiled output.
- **One measurement discipline.** Every number names its counter or its run count. Every bound is
  compared against a measurement. Every claimed guarantee has a test that breaks the version without
  it.

---

## Project structure

```
berugo-learning/
├── index.html            # shell only: sidebar mount, header, one empty container per section
├── lib/                  # vendored jquery / mermaid / d3 + built tailwind.css
├── src/
│   ├── css/              # main.css @imports base, themes, layout, components, code-lab, viz, content
│   └── js/
│       ├── core/         # curriculum, section-registry, navigation, state, runner, progress, theme
│       ├── algorithms/   # pure implementations — no DOM, unit tested
│       ├── machines/     # simulators: CPU, cache, scheduler, VM, storage engine, TCP, Raft, ...
│       ├── viz/          # chart-base + D3/Canvas renderers, one concern per file
│       ├── sections/     # <id>-template.js (markup) + <id>-section.js (controller)
│       ├── content/      # concepts-*.js, examples-*.js, reference-*.js, exercises-*.js
│       ├── components/   # section-shell (the three-tab frame), tab-controller, code-lab
│       └── utils/        # helpers, palette, format, random, js-highlight
├── tests/                # wiring-audit.js, file-size-check.js, unit/
└── doc/                  # ROADMAP.md, architecture.md, topic-suggestions.md, milestones/
```

---

## Adding a section

1. `algorithms/<name>.js` or `machines/<name>.js` — the logic. Pure, DOM-free, unit tested.
2. `sections/<id>-template.js` — markup only, no logic. `sections/<id>-section.js` — the controller,
   which calls `SectionRegistry.register({ id, init })`.
3. Add the entry to `core/curriculum.js` in the right group. The sidebar, home map, header title and
   prev/next links all follow automatically — there is no separate navigation to update.
4. Add `concepts`, `examples`, `reference` and `exercises` entries under `src/js/content/`. The
   coverage test fails if any are missing — including a concept without its `detail` paragraph,
   which is what the Description tab is made of.
5. Add the script tags to `index.html`. The wiring audit fails on a module the shell never loads,
   and the content coverage and exercise suites discover new content files by themselves.
6. Add module property tests in `tests/unit/<topic>-modules.test.js`, and recompute every figure the
   worked examples quote in `tests/unit/worked-examples-<topic>.test.js` — a measured number that
   moves should fail the build rather than quietly make the prose wrong.
7. `npm test && npm run build:css`, then open the section in Chrome and run its exercise through the
   real worker.

Conventions that the audit and the size lint enforce: no inline scripts, no markup in `index.html`,
no colour literals (use `utils/palette.js` or the `--hue-*` variables), charts through
`viz/chart-base.js` rather than a hand-rolled margin convention, no hand-rolled tab strips,
files under 1000 lines, functions under 50 lines, at most four parameters, dependencies behind
interfaces so unit tests can pass doubles.

---

## Documentation

| Document | What it is |
|---|---|
| [`doc/ROADMAP.md`](doc/ROADMAP.md) | The 65 milestones, their dependencies, effort estimates and the recommended build order |
| [`doc/architecture.md`](doc/architecture.md) | Normative: how the platform is built — module layout, the runner protocol, diagram rules, content-as-data, testing, performance budget |
| [`doc/topic-suggestions.md`](doc/topic-suggestions.md) | What was added beyond the original brief and why, what was left out, and how to cut scope |
| [`doc/milestones/*.md`](doc/milestones/) | One per milestone: every section with what it covers, its demo, its diagram, its lab and the senior-level insight, plus modules, acceptance criteria and sources |
| [`CLAUDE.md`](CLAUDE.md) | Minimal project context for tooling and new sessions |

---

## Licence

MIT.
