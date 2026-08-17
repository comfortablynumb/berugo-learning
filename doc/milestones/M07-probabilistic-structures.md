# M07 — Probabilistic and streaming sketches

> **Track** Data structures · **Depends on** M03 · **Sections** 9 · **Effort** M

**Outcome.** The structures that trade exactness for space, with their error bounds derived,
measured and *falsified* on adversarial input. Every sketch here ships with a live plot of claimed
error versus observed error, because the entire value proposition of a sketch is a bound you can
trust.

**Shared machinery introduced.** `machines/stream-lab.js` — a stream generator (uniform, Zipf,
adversarial, sliding-window, duplicate-heavy) that feeds any sketch and an exact reference
simultaneously, plotting error over time; reused by M21, M57 and M58.

---

## Sections

### 7.1 Bloom filters
- **Covers** — the bit array and k hash functions, the false-positive formula
  (1 − e^(−kn/m))^k, optimal k = (m/n) ln 2, no false negatives, no deletion, union and
  intersection semantics, and sizing from a target error rate.
- **Demo** — sizing calculator wired to a live filter: choose n and target FPR, get m and k, then
  insert real keys and watch the measured false-positive rate track the predicted curve.
- **Diagram** — mermaid diagram of one key setting k bits, and a false positive arising from three
  other keys' bits.
- **Lab** — implement `optimalParams(n, p)` and the filter itself over a `Uint8Array`; tests assert
  zero false negatives and a measured FPR within 15% of the prediction at 10⁵ keys.
- **Senior insight** — the failure mode is not the false-positive rate, it is exceeding the n you
  sized for: the error grows without any signal that it has.

### 7.2 Counting, scalable and blocked Bloom variants
- **Covers** — counting Bloom filters and counter overflow, deletable variants, scalable Bloom
  filters that add layers, blocked Bloom filters for cache locality, and partitioned versus shared
  bit arrays.
- **Demo** — the same workload through standard, counting, blocked and scalable filters, comparing
  memory, false-positive rate and simulated cache misses per query.
- **Diagram** — mermaid diagram of a scalable filter's layer chain with tightening error ratios.
- **Lab** — implement a blocked Bloom filter (one cache line per key) and show the miss-count drop
  versus the standard filter at the same FPR.
- **Senior insight** — blocked filters give up a little accuracy for one memory access instead of
  k. At high query rates that is the whole difference.

### 7.3 Cuckoo and quotient filters
- **Covers** — fingerprints instead of bits, partial-key cuckoo hashing, deletion support, the load
  factor and the insertion-failure mode, quotient filters with remainder plus metadata bits, their
  mergeability and cache friendliness, and the space comparison against Bloom at equal FPR.
- **Demo** — cuckoo filter with eviction chains animated; a graph of achieved load factor against
  fingerprint size, with the insertion-failure point marked.
- **Diagram** — mermaid diagram of the two candidate buckets derived by XOR of the fingerprint hash.
- **Lab** — implement cuckoo-filter insert with a bounded eviction chain; tests assert deletion
  correctness (only for previously inserted items) and the documented failure behaviour at high
  load.
- **Senior insight** — deleting an item you never inserted corrupts a cuckoo filter silently. The
  API looks like a set; it is not one.

### 7.4 HyperLogLog and cardinality estimation
- **Covers** — the leading-zero intuition, stochastic averaging over registers, the harmonic mean,
  the bias correction, small- and large-range corrections, HLL++ with sparse representation,
  mergeability, and the standard error 1.04/√m.
- **Demo** — feed a stream and watch the estimate track the exact distinct count, with the ±σ band
  drawn; a register histogram; a merge of two sketches shown to equal the sketch of the union.
- **Diagram** — mermaid flowchart from hash to register index and leading-zero count.
- **Lab** — implement register update and the harmonic-mean estimator; tests assert the error stays
  within 3σ across 20 seeds at cardinalities 10³, 10⁵ and 10⁷ (simulated hashes).
- **Senior insight** — mergeability is the property that matters in production: per-shard sketches
  combine into a global count with no re-scan, which is why every analytics system ships one.

### 7.5 Count-min and count-sketch
- **Covers** — the count-min sketch as a d×w counter matrix, the ε and δ parameters, one-sided
  error and why it always over-counts, count-sketch with signed hashes for unbiased estimates,
  conservative update, heavy hitters, and dot-product and range-query extensions.
- **Demo** — Zipf stream into a count-min sketch: per-item estimate versus truth as a scatter plot
  with the ε·N error bar; toggling conservative update visibly tightens it.
- **Diagram** — mermaid diagram of one item incrementing d cells and the min being taken at query.
- **Lab** — implement count-min with conservative update and a heavy-hitter query; tests assert the
  one-sided bound holds for every item and that all true heavy hitters are reported.
- **Senior insight** — count-min never under-counts, so it is safe for rate limiting and unsafe for
  billing. Knowing which direction the error points is the whole design decision.

### 7.6 Quantiles: t-digest, KLL and reservoir sampling
- **Covers** — why averages lie about latency, exact quantiles needing sorted data, reservoir
  sampling (Algorithm R and weighted variants), t-digest's scale function and accuracy at the
  tails, KLL sketches with formal guarantees, DDSketch's relative-error guarantee, and merge
  semantics.
- **Demo** — latency stream (bimodal, with a tail) into t-digest, KLL and a reservoir sample; the
  estimated p50/p99/p999 tracked against the exact values with error plotted per quantile.
- **Diagram** — mermaid diagram of t-digest centroids clustering finely at the tails.
- **Lab** — implement reservoir sampling (Algorithm R) and prove uniformity empirically; tests
  assert each element's selection frequency is within tolerance over 10⁴ trials.
- **Senior insight** — averaging p99s across shards is meaningless; this section is the one to
  point at when someone builds a dashboard that does it.

### 7.7 MinHash, SimHash and locality-sensitive hashing
- **Covers** — Jaccard similarity, min-hash signatures and the probability identity, banding for
  candidate generation, the S-curve and threshold tuning, SimHash for cosine similarity, random
  projections and the Johnson–Lindenstrauss lemma, and LSH for nearest-neighbour search.
- **Demo** — document deduplication over a small corpus: signature length and band count sliders
  redraw the S-curve and update precision/recall against the exact Jaccard values.
- **Diagram** — mermaid diagram of the signature matrix split into bands.
- **Lab** — implement the min-hash signature and the banding candidate generator; tests assert the
  estimated Jaccard is within tolerance of exact for randomised set pairs.
- **Senior insight** — banding turns a similarity threshold into a probability curve you tune;
  choosing r and b is choosing your false-positive/false-negative split, and the S-curve makes it
  explicit.

### 7.8 Frequency estimation under a window and decay
- **Covers** — sliding-window counting, exponential histograms, the DGIM algorithm for counting
  ones in a window, time-decayed counters, and space-saving / lossy-counting for top-k over
  streams.
- **Demo** — sliding-window counter on a bursty stream: exact window count against DGIM's estimate
  with its relative-error bound; a space-saving top-k table updating live with its guaranteed and
  observed error.
- **Diagram** — mermaid diagram of DGIM buckets merging as the window slides.
- **Lab** — implement space-saving top-k with the counter-replacement rule; tests assert every true
  top-k item is reported and the over-estimate never exceeds the minimum counter.
- **Senior insight** — "top talkers in the last five minutes" is the single most requested streaming
  query in operations, and it has an exact-space-impossible proof behind it. Space-saving is the
  answer to reach for.

### 7.9 Choosing and combining sketches
- **Covers** — the error/space/mergeability trade-off table, composing sketches (per-key HLL inside
  a count-min, sketch-of-sketches), when exactness is cheaper than you think, adversarial input
  breaking a non-keyed sketch, and how to test a sketch in CI.
- **Demo** — sketch chooser: state the question (distinct count, heavy hitters, quantiles,
  membership, similarity), the space budget and the error tolerance, and get a ranked
  recommendation with each candidate's measured performance on the current stream.
- **Diagram** — mermaid decision flowchart across the sketch families.
- **Lab** — given a target and a memory budget, pick and configure a sketch to pass a hidden
  accuracy test; graded on both accuracy and memory.
- **Senior insight** — the sketch is usually the easy part; the hard parts are seeding it against
  adversarial keys and having a plan for when the input exceeds the sizing assumption.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/algorithms/bloom-filter.js` | Standard, counting, scalable, blocked |
| `src/js/algorithms/cuckoo-filter.js`, `quotient-filter.js` | Fingerprint filters |
| `src/js/algorithms/hyperloglog.js` | Registers, bias correction, sparse mode, merge |
| `src/js/algorithms/count-min.js` | Count-min, count-sketch, conservative update |
| `src/js/algorithms/quantile-sketches.js` | Reservoir, t-digest, KLL, DDSketch |
| `src/js/algorithms/minhash-lsh.js` | MinHash, SimHash, banding, random projection |
| `src/js/algorithms/window-counters.js` | DGIM, exponential histogram, space-saving |
| `src/js/machines/stream-lab.js` | Stream generators, exact reference, error tracking |
| `src/js/viz/error-band-view.js` | Estimate-versus-truth plots with bound bands |

---

## Acceptance criteria

- [ ] Every sketch is tested against an exact reference on the same stream, and the assertion is
      the *stated bound*, not a hand-tuned tolerance.
- [ ] Bloom filters report zero false negatives across all tests; cuckoo filters document and test
      the delete-what-you-never-inserted hazard.
- [ ] HLL merge equals the sketch of the concatenated stream, exactly, for all seeds.
- [ ] Count-min's estimate is asserted to be greater than or equal to the true count for every key,
      always.
- [ ] Quantile sketches are checked at p50, p90, p99 and p999 on a bimodal distribution, not just a
      uniform one.
- [ ] Each demo displays both the predicted error and the measured error; the section fails review
      if only one is shown.

---

## Sources

- Bloom — *Space/time trade-offs in hash coding with allowable errors*
- Fan, Andersen, Kaminsky, Mitzenmacher — *Cuckoo filter*
- Flajolet et al. — *HyperLogLog*; Heule, Nunkesser, Hall — *HyperLogLog in practice*
- Cormode, Muthukrishnan — *An improved data stream summary: the count-min sketch*
- Dunning, Ertl — *Computing extremely accurate quantiles using t-digests*
- Karnin, Lang, Liberty — *Optimal quantile approximation in streams* (KLL)
- Broder — *On the resemblance and containment of documents* (MinHash)
- Datar, Gionis, Indyk, Motwani — *Maintaining stream statistics over sliding windows* (DGIM)
- Metwally, Agrawal, El Abbadi — *Efficient computation of frequent and top-k elements*
