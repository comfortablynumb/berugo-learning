# M57 — Stream processing and resilience engineering

> **Track** Distributed systems · **Depends on** M56, M07 · **Sections** 10 · **Effort** L

**Outcome.** The two halves of running distributed systems in production: moving events reliably
(queues, logs, stream processing, delivery semantics) and surviving failure (backpressure, retries,
circuit breakers, rate limiting, load shedding). Every pattern is implemented and then broken under
injected failure so its actual guarantee is measured.

**Shared machinery introduced.** `machines/stream/` — a log-based broker with partitions, offsets,
replication and consumer groups; a stream-processing engine with windows, watermarks and
checkpointing; `machines/resilience/` — retry, breaker, bulkhead, limiter and shedder components
behind one interface, plus a dependency-failure injector; `viz/pipeline-view.js` — the topology with
live queue depths and latency.

---

## Sections

### 57.1 Messaging fundamentals
- **Covers** — queues versus logs as the two models, point-to-point versus publish/subscribe,
  delivery semantics (at-most-once, at-least-once, and why exactly-once is a property of the whole
  pipeline rather than the transport), ordering guarantees and their scope, consumer groups and
  partition assignment, acknowledgement and redelivery, dead-letter queues, and the message-loss
  scenarios each design permits.
- **Demo** — the semantics laboratory: the same producer/consumer flow with acknowledgement placed
  before or after processing, with a crash injected in between, showing message loss in one
  configuration and duplication in the other — the two halves of the exactly-once problem.
- **Diagram** — mermaid sequence diagram of ack-before-process and ack-after-process with the crash
  window marked.
- **Lab** — implement at-least-once delivery with redelivery on unacknowledged messages; tests
  assert no message is lost across injected consumer crashes and that every duplicate is detectable
  by its identifier.
- **Senior insight** — you always choose between duplicates and loss at the transport level; the
  "exactly-once" systems that exist achieve it by making processing idempotent or transactional
  downstream, never by making delivery magic.

### 57.2 Log-based brokers
- **Covers** — the partitioned append-only log, offsets as consumer state, ordering within a
  partition only, partition-key selection (from M56) determining both ordering and load, retention
  by time and size, compaction for changelog topics, replication with in-sync replicas and acks
  settings, leader election per partition, and idempotent producers plus transactions for
  end-to-end atomicity.
- **Demo** — broker explorer: producers appending to partitions, consumer groups with their offsets,
  a rebalance triggered by adding a consumer with the partition reassignment shown, and a broker
  failure with the in-sync-replica set shrinking and the acks setting deciding whether writes are
  lost.
- **Diagram** — mermaid diagram of partitions, replicas, the ISR set and consumer-group offsets.
- **Lab** — implement consumer-group partition assignment with rebalancing; tests assert every
  partition is assigned exactly once, that offsets survive rebalance without loss or duplication
  beyond the at-least-once contract, and that the assignment is balanced.
- **Senior insight** — a rebalance stops consumption for the whole group, so a slow consumer's
  session timeout can pause a pipeline; the "why did our lag spike with no traffic change" incident
  is nearly always a rebalance storm.

### 57.3 Stream processing
- **Covers** — stateless versus stateful operators, keyed state and its partitioning, windowing
  (tumbling, sliding, session) with event time versus processing time, watermarks as the progress
  estimate and the late-data decision (drop, side output, allowed lateness), triggers and
  incremental emission, checkpointing state consistently with the Chandy–Lamport snapshot
  algorithm, and state-store backends.
- **Demo** — the windowing laboratory: an out-of-order event stream with an adjustable watermark
  policy, showing which events land in which window, which arrive late and what each policy does
  with them, plus the effect on result accuracy and latency.
- **Diagram** — mermaid diagram of event-time windows with a watermark advancing and a late event
  arriving.
- **Lab** — implement watermark generation and late-data handling with allowed lateness; tests
  assert window results are correct for in-order input, that late events within the allowance update
  results, and that events beyond it go to the side output rather than being silently dropped.
- **Senior insight** — the watermark is a bet about how late data can be, and it is the single knob
  trading result completeness against result latency; systems that hide it produce results that are
  quietly wrong at the tail.

### 57.4 Exactly-once in practice
- **Covers** — the end-to-end problem, idempotent consumers with deduplication keys and the state
  they require, transactional writes to the sink, the two-phase-commit-shaped protocols streaming
  systems use, effectively-once as the honest name, side effects that cannot be transactional
  (emails, payments, external APIs) and the compensation or idempotency-key patterns for them, and
  where deduplication state can be bounded.
- **Demo** — a pipeline with a non-transactional sink: duplicates appear after an injected failure,
  then an idempotency key with a bounded dedup window removes them, with the window's memory cost
  and the duplicate-escape rate when the window is too small both measured.
- **Diagram** — mermaid diagram of the read–process–write cycle with the commit points that make it
  atomic.
- **Lab** — implement an idempotent sink with a bounded deduplication window; tests assert no
  duplicate effect within the window across injected failures, and that the escape behaviour beyond
  the window is documented and detected rather than silent.
- **Senior insight** — deduplication state is unbounded in principle and bounded in practice, so
  every exactly-once claim has a time horizon; knowing yours (and what happens past it) is the
  difference between a guarantee and a slogan.

### 57.5 Event-driven architecture
- **Covers** — events as facts versus commands as requests, event sourcing with the log as the
  source of truth, projections and CQRS read models, replay and rebuilding projections, change data
  capture from a database log (linking to M53), the transactional outbox for atomic
  database-plus-message writes, event schema design and evolution (from M62), and the operational
  cost of a replayable log.
- **Demo** — event-sourced order system: commands producing events, projections built by replay, a
  projection bug fixed and the projection rebuilt from the log, and a schema change handled by an
  upcaster with old events still readable.
- **Diagram** — mermaid diagram of commands, the event log, projections and the read model.
- **Lab** — implement the transactional outbox with a relay; tests assert that a database commit and
  its message are atomic across every injected failure point (no message without the commit, no
  commit without eventual delivery).
- **Senior insight** — dual writes (database then broker) are unsafe at every failure point, and the
  outbox is the standard fix; teams rediscover this after their first "the row exists but the event
  never fired" incident.

### 57.6 Backpressure and flow control
- **Covers** — what happens when a consumer is slower than a producer, unbounded queues as latent
  outages, bounded queues and the three responses (block, drop, reject), credit-based flow control,
  reactive-streams-style demand signalling, propagating backpressure across a pipeline and to the
  client, the relationship to queueing theory (M58), and buffer sizing.
- **Demo** — the pipeline under overload: unbounded queues show memory growing and latency rising
  without bound until failure; bounded queues with each policy show the trade — blocking propagates
  slowness, dropping loses data, rejecting fails fast — with the numbers for each.
- **Diagram** — mermaid diagram of demand signalling propagating from consumer to producer.
- **Lab** — implement credit-based flow control across a two-stage pipeline; tests assert memory
  stays bounded under sustained overload, that no message is lost, and that the producer's rate
  converges to the consumer's capacity.
- **Senior insight** — an unbounded queue does not prevent overload, it converts a fast failure into
  a slow, memory-exhausting one; the first question about any queue in a design review is what
  bounds it.

### 57.7 Retries, timeouts and idempotency
- **Covers** — timeouts as a required parameter of every remote call, deadline propagation across a
  call chain, retry policies with exponential backoff and jitter (and why jitter is not optional),
  retry budgets and amplification through a call graph, which errors are retryable, idempotency keys
  for safe retry of writes, hedged requests for tail latency, and the retry-storm failure mode.
- **Demo** — retry-amplification simulator: a three-layer call chain each retrying three times
  produces 27× load on the deepest service during a partial outage; retry budgets and
  circuit-breaking cap it, with the load multiplier shown at each layer.
- **Diagram** — mermaid diagram of retry amplification through a call graph with multipliers per
  layer.
- **Lab** — implement retry with full-jitter backoff and a token-bucket retry budget; tests assert
  the amplification factor stays below the budget under a simulated outage and that the backoff
  distribution avoids synchronised retry waves.
- **Senior insight** — retries turn a partial outage into a total one through amplification, and
  jitter plus a budget is the cheap fix; the metastable failure literature is mostly about systems
  that could not exit this state even after the original fault was gone.

### 57.8 Circuit breakers, bulkheads and degradation
- **Covers** — the circuit-breaker state machine (closed, open, half-open) with its thresholds and
  probing, failing fast to protect both caller and callee, bulkheads isolating resource pools per
  dependency, timeouts as the precondition for any of this to work, graceful degradation with
  fallbacks and cached or default responses, feature-level shedding by priority, and the
  observability a breaker needs.
- **Demo** — dependency-failure drill: one slow dependency saturates a shared pool and takes down
  unrelated endpoints; bulkheads contain it, and a circuit breaker opens with the fallback keeping
  the endpoint responsive — each stage measured in success rate and latency.
- **Diagram** — mermaid state diagram of the circuit breaker with its transition conditions.
- **Lab** — implement the breaker with a sliding-window failure rate and half-open probing; tests
  assert it opens within the specified window under failure, admits exactly one probe when
  half-open, and closes only after sustained success.
- **Senior insight** — a shared connection pool is a shared fate: one slow dependency exhausts it
  and every endpoint fails. Bulkheads are unglamorous and they are the difference between one broken
  feature and one broken service.

### 57.9 Rate limiting and admission control
- **Covers** — token bucket and leaky bucket with their burst semantics, fixed and sliding windows,
  distributed rate limiting and its coordination cost (local approximation versus central counter),
  per-tenant fairness and weighted fair queueing, priority-based admission control, load shedding by
  request cost and criticality, latency-based shedding (CoDel applied to a service queue), and
  communicating limits to clients.
- **Demo** — the admission-control laboratory: a service under overload with each strategy applied,
  showing goodput, fairness across tenants and p99 latency; without shedding, goodput collapses at
  saturation, and with it, goodput stays flat.
- **Diagram** — mermaid diagram of the request path with the limiter, the queue and the shedder.
- **Lab** — implement latency-based load shedding using a queue-delay signal; tests assert goodput
  is maintained under 3× overload and that shed requests are rejected quickly rather than queued.
- **Senior insight** — the goal is goodput, not throughput: a saturated service doing work that
  clients have already timed out on is doing negative work, and shedding early is what keeps the
  useful fraction high.

### 57.10 Chaos and resilience testing
- **Covers** — testing failure deliberately, the dependency-failure matrix (what happens if each
  dependency is slow, failing, or returning garbage), fault injection in a controlled blast radius,
  game days and their format, steady-state hypotheses, measuring blast radius and recovery time,
  building a resilient pipeline end to end, and the organisational side (runbooks, alerts,
  post-incident review) that connects to M61.
- **Demo** — the full pipeline under a chaos schedule: dependencies degraded one at a time, with the
  system's steady-state metric tracked and each failure classified as contained, degraded or
  cascading; the resulting matrix is generated automatically.
- **Diagram** — mermaid diagram of the dependency graph annotated with each dependency's failure
  impact.
- **Lab** — build a pipeline that survives the full chaos schedule with a stated degradation
  contract; graded on the measured steady-state metric under every injected failure and on whether
  the degradation matches the contract.
- **Senior insight** — the dependency-failure matrix is the highest-value artefact in this
  milestone: writing down, per dependency, what the system does when it fails turns unknown
  behaviour into a design decision, and it usually reveals two or three surprises immediately.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/stream/broker.js` | Partitions, offsets, retention, compaction, ISR replication |
| `src/js/machines/stream/consumer-group.js` | Assignment, rebalancing, offset commits |
| `src/js/machines/stream/processor.js` | Operators, keyed state, windows, watermarks, checkpoints |
| `src/js/machines/stream/exactly-once.js` | Idempotent sinks, dedup windows, transactional commits |
| `src/js/machines/stream/event-sourcing.js` | Event log, projections, replay, outbox relay |
| `src/js/machines/resilience/flow-control.js` | Bounded queues, credit-based demand, policies |
| `src/js/machines/resilience/retry.js` | Backoff, jitter, budgets, hedging, deadline propagation |
| `src/js/machines/resilience/breaker.js` | Circuit breaker, bulkheads, fallbacks |
| `src/js/machines/resilience/limiter.js` | Token/leaky bucket, fair queueing, shedding |
| `src/js/machines/resilience/chaos.js` | Dependency fault injection and matrix generation |
| `src/js/viz/pipeline-view.js` | Topology with queue depths, rates and latency |

---

## Acceptance criteria

- [ ] Delivery-semantics claims are demonstrated by crash injection: the at-least-once
      implementation loses nothing and the duplicates it produces are detectable.
- [ ] Watermark and late-data behaviour is asserted per policy, including that dropped events are
      counted and surfaced rather than silently discarded.
- [ ] The outbox implementation is verified atomic across every injected failure point.
- [ ] Backpressure tests assert bounded memory under sustained overload, not merely correct
      behaviour at normal load.
- [ ] Retry-amplification is measured through the call graph, and the budget's cap is asserted.
- [ ] The circuit breaker's state transitions are asserted against its specification, including the
      single-probe half-open rule.
- [ ] Load-shedding tests assert goodput under overload; a throughput-only assertion fails review.
- [ ] The chaos matrix is generated from executed injections, never hand-written.

---

## Sources

- Kleppmann — *Designing Data-Intensive Applications*, streaming chapters
- Kreps — *The Log: what every software engineer should know about real-time data's unifying abstraction*
- Akidau et al. — *The dataflow model*; *Streaming 101/102*
- Chandy, Lamport — *Distributed snapshots: determining global states of distributed systems*
- Carbone et al. — *Lightweight asynchronous snapshots for distributed dataflows* (Flink)
- Nygard — *Release It!*
- Brooker — the AWS Builders' Library articles on timeouts, retries and jitter
- Bronson et al. — *Metastable failures in distributed systems*
- Basiri et al. — *Chaos engineering*
