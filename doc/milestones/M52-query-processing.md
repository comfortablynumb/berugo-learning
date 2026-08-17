# M52 — Query processing and optimisation

> **Track** Data systems · **Depends on** M51, M12 · **Sections** 10 · **Effort** L

**Outcome.** A working query engine over the M51 storage: SQL in, plan out, rows back — with the
optimiser's decisions exposed at every stage. The recurring lesson is that query performance is
dominated by cardinality estimation and join order, not by operator implementation, and both are
visible here.

**Shared machinery introduced.** `machines/db/query/` — parser (from M25), binder, logical and
physical planners, cost model, statistics, and an execution engine with three models (iterator,
vectorised, compiled); `machines/db/plan-lab.js` — plan comparison with estimated versus actual
cardinalities and costs; `viz/plan-tree-view.js` — the plan tree with per-operator rows, time and
estimation error highlighted.

---

## Sections

### 52.1 The relational model and SQL semantics
- **Covers** — relations as sets versus SQL's bags, relational algebra operators and their SQL
  counterparts, three-valued logic and the traps it creates (`NOT IN` with NULLs, aggregates
  ignoring NULLs, `= NULL`), grouping and aggregation semantics, join types and their
  cardinality behaviour, subquery forms, and the declarative/procedural gap the optimiser fills.
- **Demo** — semantics explorer: run a query and see it as relational algebra, with each operator's
  input and output rows shown; NULL-handling fixtures demonstrate each three-valued-logic surprise
  with the reason.
- **Diagram** — mermaid diagram of an algebra expression tree for a join-filter-aggregate query.
- **Lab** — implement `NOT IN`, `NOT EXISTS` and left-anti-join semantics with NULLs handled
  correctly; tests assert results against a reference table where the three forms deliberately
  differ.
- **Senior insight** — `NOT IN` with a NULL in the subquery returns no rows, always; it is the most
  common correctness bug in production SQL and it produces an empty result rather than an error.

### 52.2 From text to logical plan
- **Covers** — parsing SQL (reusing M25), the catalog and name resolution, binding columns to
  tables with scope rules, type checking and implicit coercion, view expansion, common-table
  expressions and materialisation choices, predicate normalisation to conjunctive normal form, and
  the initial logical plan.
- **Demo** — the pipeline viewer: SQL text, parse tree, bound tree, normalised predicates and the
  initial logical plan side by side, with each transformation's effect highlighted.
- **Diagram** — mermaid flowchart from SQL text through binding to a logical plan.
- **Lab** — implement predicate normalisation including De Morgan transformations and constant
  folding; tests assert logical equivalence against a truth-table check over the fixture predicates.
- **Senior insight** — implicit type coercion in a predicate can silently disable an index (the
  classic string-column-compared-to-a-number); the binder is where that happens, and the plan is
  where you see the consequence.

### 52.3 Logical optimisation
- **Covers** — rewrite rules that are always good (predicate pushdown, projection pruning, constant
  folding, redundant-join elimination), predicate inference through equality classes, subquery
  decorrelation and why it matters so much, `LIMIT` pushdown, outer-join simplification when a
  predicate rejects NULLs, and rule ordering.
- **Demo** — rule-by-rule rewriting: apply each rule to a plan and see rows-estimated and cost drop,
  with a correlated subquery decorrelated into a join and its estimated cost falling by orders of
  magnitude.
- **Diagram** — mermaid diagram of a predicate moving below a join and the row counts changing.
- **Lab** — implement subquery decorrelation for a correlated `EXISTS`; tests assert identical
  results to the correlated form on all fixtures (including empty and NULL-heavy tables) and a lower
  operator-execution count.
- **Senior insight** — a correlated subquery executed per row is the classic accidental nested loop;
  decorrelation is the single largest logical-optimisation win, and knowing whether your engine does
  it changes how you write queries.

### 52.4 Cardinality estimation
- **Covers** — why the optimiser needs row counts, histograms (equi-width, equi-depth) and their
  construction, most-common-value lists, distinct-count estimation (with HyperLogLog from M07),
  selectivity formulas for predicates, the independence assumption and correlated-column failures,
  join-size estimation and error propagation through a plan, sampling, and adaptive/feedback-driven
  estimation.
- **Demo** — estimation-error explorer: for each operator in a plan, the estimated and actual row
  counts with the error factor; correlated columns are introduced and the error compounds visibly up
  the tree.
- **Diagram** — mermaid diagram of estimation error compounding across three joins.
- **Lab** — implement equi-depth histogram construction and range-predicate selectivity; tests
  assert estimates within a stated factor of the true selectivity on the fixture distributions,
  including skewed data.
- **Senior insight** — estimation errors multiply through joins, so a 4× error at the leaves becomes
  a 1000× error at the top; that is why plan choice is so fragile and why most "the plan flipped"
  incidents are statistics problems.

### 52.5 Cost models and plan search
- **Covers** — the cost model's inputs (I/O, CPU, memory, parallelism) and its calibration, the
  System R dynamic-programming join-order search with interesting orders, the exponential search
  space, greedy and genetic alternatives for many-way joins, the Volcano/Cascades transformation
  framework with memo and groups, plan hints and when to use them, and plan stability and caching.
- **Demo** — join-order search visualiser: the DP table filling for a five-table join with the
  chosen sub-plans, the search-space size shown against the tables joined, and a switch to a greedy
  search showing which plan quality is lost.
- **Diagram** — mermaid diagram of the DP table over subsets of relations with the optimal sub-plan
  per subset.
- **Lab** — implement the System R join-order DP with interesting-order tracking; tests assert the
  chosen plan matches an exhaustive search's optimum for up to six tables under the same cost model.
- **Senior insight** — the optimiser's plan is optimal *under its cost model and its estimates*;
  when it picks something absurd, the estimates are almost always the cause, and hinting the plan
  hides the problem rather than fixing it.

### 52.6 Physical operators
- **Covers** — scans (sequential, index, index-only, bitmap), sorting with external merge (from
  M10), hash join with build and probe sides plus partitioning for memory, sort-merge join, nested
  loop with and without an index, aggregation strategies (sort-based, hash-based), spilling to disk
  when memory is exceeded, and each operator's memory and I/O profile.
- **Demo** — operator laboratory: the same join run as nested loop, hash join and sort-merge with I/O,
  memory and time reported; a memory limit is lowered until the hash join spills, and the cost
  discontinuity is visible.
- **Diagram** — mermaid diagram of a partitioned hash join with build and probe phases.
- **Lab** — implement grace hash join with partitioning and spilling; tests assert correct join
  results including duplicate keys and skewed distributions, and that memory stays within the
  configured budget.
- **Senior insight** — the spill cliff is why a query that ran in 200 ms yesterday takes 40 seconds
  today: crossing the memory threshold changes the algorithm's cost class, and nothing in the query
  changed.

### 52.7 Execution models
- **Covers** — the iterator (Volcano) model and its per-tuple virtual-call overhead, vectorised
  execution over batches and why it suits columnar data (from M51), compilation of a plan to code
  (using M30's techniques) and its compile-time trade-off, morsel-driven parallelism, pipeline
  breakers, and the memory-bandwidth-bound reality of modern analytical execution.
- **Demo** — the same query executed by all three models with per-tuple overhead, instructions per
  row and total time measured; batch size is adjustable and the cache-behaviour effect (from M37)
  appears in the curve.
- **Diagram** — mermaid diagram of tuple-at-a-time versus batch-at-a-time dataflow through
  operators.
- **Lab** — implement vectorised filter and projection over column batches; tests assert identical
  results to the tuple-at-a-time version and a measured reduction in per-row overhead, with the
  optimal batch size located empirically.
- **Senior insight** — vectorisation wins by amortising interpretation overhead and by being
  cache- and SIMD-friendly; the optimal batch size is the one that keeps a batch in L1/L2, which
  connects this directly to M37.

### 52.8 Parallel and distributed execution
- **Covers** — intra-operator parallelism with partitioning, exchange operators, broadcast versus
  shuffle joins and the size threshold between them, partition skew and its mitigation (salting,
  adaptive repartitioning), straggler handling, the cost of shuffling and how to avoid it
  (co-location, partition pruning), and adaptive execution that re-plans mid-query.
- **Demo** — distributed plan simulator: a join executed as broadcast and as shuffle across N nodes,
  with data moved, per-node time and total time compared; a skewed key distribution creates a
  straggler that dominates the query, then salting fixes it.
- **Diagram** — mermaid diagram of a shuffle exchange redistributing rows by join key across nodes.
- **Lab** — implement skew detection and salted repartitioning; tests assert identical results and a
  measured reduction in the maximum per-node work on the skewed fixture.
- **Senior insight** — one hot key can make a 100-node cluster as slow as one node; skew is the
  default failure mode of distributed joins and the fix is always some form of splitting the hot key
  deliberately.

### 52.9 Reading and fixing plans
- **Covers** — reading `EXPLAIN` and `EXPLAIN ANALYZE` output, spotting estimation errors by
  comparing estimated with actual rows, the anti-pattern catalogue (function on an indexed column,
  implicit cast, leading wildcard, `OR` preventing index use, unnecessary `DISTINCT`, N+1 query
  patterns), index selection from a plan, statistics maintenance and when to force a refresh, and
  plan regression after a data-distribution change.
- **Demo** — the plan clinic: a set of slow queries with their plans; for each, the learner
  identifies the problem from the estimated/actual mismatch and applies a fix (rewrite, index,
  statistics), then re-runs and sees the new plan and time.
- **Diagram** — mermaid decision flowchart from a plan symptom to its likely cause.
- **Lab** — fix five slow queries in the clinic; graded on the measured improvement and on whether
  the fix addresses the identified cause rather than adding an index that masks it.
- **Senior insight** — the first thing to read in a plan is estimated versus actual rows on every
  node; the first place they diverge by a large factor is the cause, and everything above it is a
  consequence.

### 52.10 Streaming queries and incremental views
- **Covers** — the batch/stream duality, continuous queries, windowing (tumbling, sliding, session)
  and event-time versus processing-time, watermarks and late data (developed further in M57),
  materialised views and their maintenance strategies (full recompute, incremental), delta rules
  for incremental view maintenance, differential dataflow's idea, and the consistency question for
  a view that lags.
- **Demo** — the same aggregate computed by full recompute and by incremental maintenance as updates
  arrive, with work per update and result latency compared; out-of-order events are injected and the
  watermark policy decides what is included.
- **Diagram** — mermaid diagram of an incremental view maintenance rule propagating a delta through
  a join.
- **Lab** — implement incremental maintenance for a join-aggregate view under insertions and
  deletions; tests assert the maintained view equals a full recompute after every update, including
  deletions that remove the last contributing row.
- **Senior insight** — incremental maintenance under deletion is the hard half (counts can go to
  zero, groups disappear), and view-maintenance implementations that only handle appends break
  quietly the first time a row is deleted.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/db/query/parser.js` | SQL parsing built on M25's parser infrastructure |
| `src/js/machines/db/query/binder.js` | Catalog, name resolution, type checking, view expansion |
| `src/js/machines/db/query/logical.js` | Logical plan, rewrite rules, decorrelation |
| `src/js/machines/db/query/stats.js` | Histograms, distinct counts, selectivity, join estimation |
| `src/js/machines/db/query/optimizer.js` | Cost model, System R DP, Cascades-style transformation |
| `src/js/machines/db/query/operators.js` | Scans, sorts, joins, aggregation with spilling |
| `src/js/machines/db/query/exec-models.js` | Iterator, vectorised and compiled execution |
| `src/js/machines/db/query/distributed.js` | Exchange, broadcast/shuffle, skew handling |
| `src/js/machines/db/query/streaming.js` | Windows, watermarks, incremental view maintenance |
| `src/js/machines/db/plan-lab.js` | Plan comparison, estimated vs actual, regression detection |
| `src/js/viz/plan-tree-view.js` | Plan tree with per-node rows, cost and error highlighting |

---

## Acceptance criteria

- [ ] Every query is validated against a reference execution (a simple, obviously-correct
      interpreter) over randomised data, including NULL-heavy and empty-table cases.
- [ ] Every rewrite rule is verified semantics-preserving by differential testing against the
      unoptimised plan.
- [ ] The join-order DP matches exhaustive search for up to six tables under the same cost model.
- [ ] Plans display estimated *and* actual cardinalities; a plan view without both fails review.
- [ ] The hash join respects its memory budget and spills correctly, asserted by peak-memory
      measurement.
- [ ] Execution models produce identical results, asserted row for row including ordering
      guarantees.
- [ ] Incremental view maintenance equals full recompute after every update in randomised
      insert/delete sequences.

---

## Sources

- Hellerstein, Stonebraker, Hamilton — *Architecture of a Database System*
- Selinger et al. — *Access path selection in a relational database management system*
- Graefe — *The Cascades framework for query optimization*; *Query evaluation techniques for large databases*
- Leis et al. — *How good are query optimizers, really?*
- Boncz, Zukowski, Nes — *MonetDB/X100: hyper-pipelining query execution*
- Neumann — *Efficiently compiling efficient query plans for modern hardware*
- Leis et al. — *Morsel-driven parallelism*
- Akidau et al. — *The dataflow model* (streaming semantics)
