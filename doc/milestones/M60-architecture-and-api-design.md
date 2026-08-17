# M60 — Software architecture, API and schema design

> **Track** Engineering practice · **Depends on** M52, M57 · **Sections** 11 · **Effort** L

**Outcome.** The judgement half of senior work, made concrete: modularity measured rather than
asserted, architectural styles compared on the same problem, APIs evolved through compatibility
tests, and migrations executed in a simulator where the rollback actually has to work. Every
section produces an artefact a reviewer could argue with, not a principle to agree with.

**Shared machinery introduced.** `machines/arch/system-sim.js` — a service-topology simulator
(services, calls, data stores, deploys, versions) built on M57's resilience components, where an
architecture can be run under load and failure; `machines/arch/coupling.js` — dependency-graph
metrics over a codebase or a design; `machines/arch/compat-check.js` — schema and API compatibility
checking with a generated corpus.

---

## Sections

### 60.1 Modularity
- **Covers** — coupling and cohesion with measurable definitions, information hiding and Parnas's
  criterion (hide what is likely to change), dependency direction and the acyclic requirement,
  interface segregation in practice, the difference between layering and slicing by feature,
  package-by-layer versus package-by-feature, and measuring modularity (fan-in/fan-out, instability,
  cycle detection with M13's SCC).
- **Demo** — the dependency analyser: a codebase's module graph with cycles highlighted (using SCC),
  instability and abstractness computed per module, and the effect of a proposed refactor previewed
  on the metrics.
- **Diagram** — mermaid graph of a module dependency graph with a cycle and the boundary that breaks
  it.
- **Lab** — break the cycles in a provided module graph by introducing an interface; tests assert
  the graph is acyclic, that no module's fan-out increases beyond a bound, and that the public
  surface did not grow.
- **Senior insight** — Parnas's criterion is the one that still decides well: modules should be
  organised around what is likely to change, not around what the data looks like, and most layered
  architectures fail exactly there.

### 60.2 Patterns, principles and their limits
- **Covers** — the GoF patterns worth knowing today, the ones that became language features
  (strategy as a function, iterator as a protocol, singleton as a module), over-patterning as a
  cost, SOLID's actual meaning with the frequent misreadings (single responsibility is about reasons
  to change, dependency inversion is not "use a DI container"), the cost of indirection, and when a
  direct implementation is the better engineering.
- **Demo** — the refactoring comparator: the same requirement implemented directly, with a pattern,
  and over-patterned, with lines of code, indirection depth, change-cost simulation (how many files
  a given change touches) and readability metrics compared.
- **Diagram** — mermaid diagram of the same feature's call path in the direct and pattern-based
  versions.
- **Lab** — given three change requests, predict the touched-file count for each design, then verify
  by making the changes; graded on the predictions and on whether the chosen design minimises total
  change cost across all three.
- **Senior insight** — a pattern's value is entirely in the changes it makes cheap, so the honest
  test is naming the change you expect; a pattern introduced for a change that never comes is pure
  cost.

### 60.3 Domain modelling
- **Covers** — the model as a decision about language and boundaries, entities versus value objects,
  aggregates as consistency boundaries (connecting to M53's transaction boundaries), invariants
  enforced at the boundary, bounded contexts and context mapping, anti-corruption layers, ubiquitous
  language, and the mapping between the domain model and the storage model.
- **Demo** — aggregate-boundary explorer: the same domain modelled with different aggregate
  boundaries, run under concurrent load in the simulator, showing which boundary produces contention
  (too large) and which produces cross-aggregate consistency problems (too small).
- **Diagram** — mermaid diagram of bounded contexts with the translation at each context boundary.
- **Lab** — choose aggregate boundaries for a described domain and enforce its invariants; tests
  assert every invariant holds under concurrent operations and that no operation spans two
  aggregates transactionally.
- **Senior insight** — the aggregate boundary is the transaction boundary, so it is a *concurrency*
  decision disguised as a modelling one; getting it wrong shows up as either lock contention or
  broken invariants, and both are traced back to this choice.

### 60.4 Architectural styles
- **Covers** — layered, hexagonal/ports-and-adapters, clean architecture, event-driven, pipeline and
  plugin styles with the problems each solves, the modular monolith versus microservices decision
  with its real costs (network calls, partial failure, data consistency, operational overhead,
  organisational alignment), Conway's law, and the distributed monolith as the common failure.
- **Demo** — the same system built as a modular monolith and as microservices, run in the simulator
  under identical load and failure: latency, failure modes, deployment independence and operational
  complexity are all measured, including the microservice version's cascading failure that the
  monolith cannot have.
- **Diagram** — mermaid diagram of the same feature's call path in both architectures with the
  process and network boundaries marked.
- **Lab** — decompose a monolith into services along the boundaries you choose, then run the
  workload; graded on latency, on the number of cross-service transactions required (fewer is
  better) and on failure containment.
- **Senior insight** — every service boundary you draw across a transaction becomes a distributed
  transaction or an eventual-consistency problem; drawing boundaries where transactions do not cross
  is the entire skill, and it is why the aggregate work in 60.3 comes first.

### 60.5 API design: resources and semantics
- **Covers** — resource modelling, HTTP method semantics and idempotency (from M50), status-code
  selection, error-response design with machine-readable codes, pagination strategies (offset versus
  cursor) and their consistency properties, filtering and sorting, bulk and batch endpoints, partial
  responses, long-running operations, rate-limit communication, and API ergonomics as a measurable
  property.
- **Demo** — the pagination laboratory: offset and cursor pagination over a dataset with concurrent
  inserts and deletes, showing the duplicated and skipped items offset pagination produces and the
  stability cursors provide, with the anomaly count reported.
- **Diagram** — mermaid diagram of offset pagination skipping an item after a concurrent insert.
- **Lab** — implement cursor-based pagination with a stable sort key and opaque cursors; tests
  assert no duplicates or omissions under concurrent modification, and that cursors survive a
  reasonable schema change.
- **Senior insight** — offset pagination over a mutating dataset is quietly incorrect, and the bug
  reports read as "some records are missing from the export"; the cursor version costs one composite
  index and removes the class.

### 60.6 API styles and contracts
- **Covers** — REST versus RPC/gRPC versus GraphQL versus async/webhook APIs with the selection
  criteria, versioning strategies (URL, header, media type) and the compatibility rules that make
  versioning rare, deprecation processes with usage telemetry, contract testing between consumers
  and providers, API documentation generated from the contract, webhook design (retries, ordering,
  idempotency, signature verification), and client-generation trade-offs.
- **Demo** — the contract-test harness: a provider change is made and consumer contract tests run,
  catching a breaking change before deploy; the same change with a compatible approach passes, with
  the difference in the contract diff highlighted.
- **Diagram** — mermaid diagram of consumer-driven contract testing between two services.
- **Lab** — implement webhook delivery with signature verification, retries with backoff and
  idempotency keys; tests assert at-least-once delivery, signature rejection of tampered payloads,
  and that a consumer processing duplicates has no duplicate effect.
- **Senior insight** — a webhook is an API you operate on someone else's behalf, and the consumer
  will be down: delivery needs retries, retries need idempotency keys, and the signature must cover
  the timestamp or replay is trivial.

### 60.7 Schema and data evolution
- **Covers** — backward and forward compatibility with precise definitions, the compatibility rules
  per format (protobuf field numbers and reserved ranges, Avro's writer/reader schema resolution,
  JSON Schema's looser guarantees), adding and removing fields safely, enum evolution and the
  unknown-value problem, the expand-contract migration pattern, rolling deploys with mixed versions,
  and testing compatibility mechanically.
- **Demo** — the compatibility matrix: every schema version read and written by every other version
  in the simulator, with each cell showing success, data loss or failure; a field renamed without
  the expand-contract dance shows up as a red row immediately.
- **Diagram** — mermaid diagram of the expand-contract sequence across deploys.
- **Lab** — evolve a schema through three changes (add optional field, rename a field, change a
  type) keeping every deployed version interoperable; tests assert the full compatibility matrix
  passes at every step, including mixed-version rolling deploys.
- **Senior insight** — during a rolling deploy both versions run simultaneously, so every change
  must be compatible in *both* directions for one release; the rename that "worked in staging" is
  the classic failure because staging deployed atomically.

### 60.8 Caching architecture
- **Covers** — cache placement (client, CDN, gateway, application, database) and what each can
  safely cache, the invalidation strategies (TTL, event-driven, versioned keys) with their staleness
  and complexity trade-offs, cache stampedes and their prevention (request coalescing, early
  recomputation, jittered TTLs), negative caching, cache-aside versus read-through versus
  write-through, consistency between cache and source of truth, and measuring hit ratio and its
  economics.
- **Demo** — the stampede: a hot key expires under load and every request hits the origin
  simultaneously, with the origin's queue exploding; request coalescing and jittered expiry are each
  applied and the origin load is measured for all three.
- **Diagram** — mermaid diagram of a cache stampede and the coalescing single-flight fix.
- **Lab** — implement single-flight request coalescing with a stale-while-revalidate policy; tests
  assert exactly one origin fetch per key per expiry under 1000 concurrent requests and that stale
  data is served within the configured window rather than blocking.
- **Senior insight** — cache expiry synchronises requests, which is why a stampede is a *thundering
  herd* rather than a gradual increase; jitter plus single-flight is a small amount of code that
  removes an entire outage class.

### 60.9 Consistency in application design
- **Covers** — where transactions can and cannot reach, aggregate boundaries as the transactional
  unit (from 60.3), sagas with compensating actions and their partial-failure states, eventual
  consistency's user-interface consequences (optimistic UI, read-your-writes for the actor), idempotent
  handlers as a design requirement, exactly-once effects at the boundary (from M57), and designing
  the failure states rather than discovering them.
- **Demo** — the saga simulator: a multi-service business operation with a failure injected at every
  step, showing which compensations run and what intermediate states are user-visible; the same
  operation as a distributed transaction is shown blocking instead.
- **Diagram** — mermaid state diagram of a saga with compensation paths from each step.
- **Lab** — implement a saga with idempotent steps and compensations; tests assert that for every
  failure point the system reaches a consistent end state, that compensations are idempotent under
  retry, and that no step's effect survives its own compensation.
- **Senior insight** — a compensation is not a rollback: the intermediate state was visible and may
  have caused side effects, so "refund the payment" is a different operation from "the payment never
  happened", and the product needs to know which one it gets.

### 60.10 Evolution and migration
- **Covers** — the strangler-fig pattern, branch by abstraction, dual writes and their failure modes
  (with the outbox alternative from M57), backfills at scale with throttling and resumability,
  online schema changes, feature flags for decoupling deploy from release, canary and staged
  rollouts with automated rollback criteria, rollback planning including data changes that cannot be
  rolled back, and knowing when to stop a migration.
- **Demo** — the migration simulator: run a strangler migration with traffic shifted progressively,
  a divergence between old and new systems detected by shadow comparison, and a rollback executed —
  including the case where a data change makes rollback impossible and the plan must be different.
- **Diagram** — mermaid diagram of a strangler migration with the routing façade and traffic shares.
- **Lab** — execute a migration with shadow traffic, comparison and progressive rollout; tests
  assert output equivalence between old and new paths on shadow traffic, that rollback restores the
  previous behaviour at every stage, and that no data is lost in either direction.
- **Senior insight** — shadow traffic with automated comparison is what turns a risky migration into
  a boring one; teams skip it because it is work, and then discover the divergence with production
  traffic instead.

### 60.11 Making and recording architectural decisions
- **Covers** — architecture decision records and what makes one useful (context, options,
  consequences, not just the choice), trade-off analysis with explicit criteria, back-of-the-envelope
  sizing (using M58's models) to check feasibility before designing, recognising over-engineering
  and premature generality, reversible versus irreversible decisions and matching the deliberation
  to the cost, reviewing someone else's design, and writing a design document that can be
  disagreed with.
- **Demo** — the design-review workbench: a design document with an embedded sizing calculator and a
  simulator run of its topology, where changing an assumption (traffic, payload size, fan-out)
  updates the feasibility verdict and the cost estimate live.
- **Diagram** — mermaid decision matrix relating decision reversibility to the deliberation it
  warrants.
- **Lab** — write an ADR for a described decision including a back-of-the-envelope feasibility
  check; graded against a rubric covering context, at least two genuinely considered alternatives,
  quantified consequences and an explicit reversibility assessment.
- **Senior insight** — the most valuable line in an ADR is the one describing what would make the
  decision wrong; it converts a defended position into a testable claim, and it is what lets the
  next team revisit it without re-litigating everything.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/arch/system-sim.js` | Service topology, calls, versions, deploys, failure injection |
| `src/js/machines/arch/coupling.js` | Dependency graph metrics, cycle detection, refactor preview |
| `src/js/machines/arch/compat-check.js` | Schema/API compatibility matrix over generated corpora |
| `src/js/machines/arch/pagination.js` | Offset and cursor implementations with anomaly detection |
| `src/js/machines/arch/webhooks.js` | Delivery, retries, signatures, idempotency |
| `src/js/machines/arch/cache-tier.js` | Placement, invalidation, single-flight, stampede scenarios |
| `src/js/machines/arch/saga.js` | Orchestration, compensations, failure-point enumeration |
| `src/js/machines/arch/migration.js` | Strangler routing, shadow traffic, comparison, rollback |
| `src/js/content/adr-templates.js` | ADR structure, review rubrics, sizing worksheets |

---

## Acceptance criteria

- [ ] Architecture comparisons are run in the simulator under identical load and failure schedules;
      prose-only comparisons fail review.
- [ ] The compatibility matrix is generated by executing every version pair, never asserted from the
      format's documentation.
- [ ] Pagination tests assert zero duplicates and zero omissions under concurrent modification.
- [ ] Saga tests enumerate *every* failure point and assert a consistent end state at each.
- [ ] The cache lab asserts exactly one origin fetch per key per expiry under high concurrency.
- [ ] Migration tests assert output equivalence on shadow traffic and successful rollback at every
      stage.
- [ ] Each design-judgement lab is graded against a rubric with a hidden reference solution, and
      partial credit is explained rather than scored silently.

---

## Sources

- Parnas — *On the criteria to be used in decomposing systems into modules*
- Evans — *Domain-Driven Design*; Vernon — *Implementing Domain-Driven Design*
- Fowler — *Patterns of Enterprise Application Architecture*, and the strangler-fig and branch-by-abstraction writeups
- Newman — *Building Microservices* and *Monolith to Microservices*
- Kleppmann — *Designing Data-Intensive Applications*, encoding and evolution chapter
- Nygard — *Documenting architecture decisions* (ADRs)
- Google — the API Improvement Proposals (AIPs)
- Garcia-Molina, Salem — *Sagas*
