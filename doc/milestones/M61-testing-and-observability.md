# M61 — Testing, debugging and observability

> **Track** Engineering practice · **Depends on** M32, M58 · **Sections** 10 · **Effort** L

**Outcome.** The three activities that decide whether a system can be maintained: finding bugs
before shipping, finding them after, and building systems that answer questions about themselves.
Everything is practised against the platform's own simulators, where the ground truth is known so a
technique's effectiveness can be scored rather than assumed.

**Shared machinery introduced.** `machines/test/bug-farm.js` — codebases with catalogued seeded
bugs (each with a known reproduction) so any testing or debugging technique can be scored by
detection rate and time-to-find; `machines/obs/telemetry.js` — metrics, logs and traces emitted by
every simulator in the platform, with a query layer and a cost model; `viz/trace-view.js` — the
distributed-trace waterfall.

---

## Sections

### 61.1 Test strategy
- **Covers** — what tests are for (confidence per unit of cost, and enabling change), the pyramid
  and its critics (the trophy, the honeycomb), test doubles taxonomy (dummy, stub, spy, mock, fake)
  and when each is appropriate, testing behaviour versus implementation, the mock-everything trap,
  contract tests at boundaries (from M60), flaky tests as a defect class with their own causes, test
  isolation, and choosing the level for a given risk.
- **Demo** — the strategy comparator: the same codebase covered by three strategies (unit-heavy,
  integration-heavy, balanced) scored against the bug farm for detection rate, runtime and
  maintenance cost when a refactor changes internals without changing behaviour.
- **Diagram** — mermaid diagram of the test levels with the bug classes each catches.
- **Lab** — write tests for a provided module that survive an internal refactor while still catching
  every behavioural bug; graded on detection rate against the bug farm *and* on how many tests break
  under a behaviour-preserving refactor.
- **Senior insight** — tests that break when internals change without behaviour changing are a tax
  on refactoring, and they are the reason teams stop refactoring; the refactor-survival score is a
  better test-suite metric than coverage.

### 61.2 Property-based testing
- **Covers** — properties versus examples, generators and their distribution design, shrinking and
  why it makes property testing usable, the property catalogue (round-trip, invariant, oracle,
  metamorphic, idempotence, commutativity), model-based/stateful testing against a simple reference
  model, and finding the property when it is not obvious.
- **Demo** — a property test against a seeded bug: the failure is found with a large random input,
  then shrunk to a minimal counter-example in front of the learner, with the shrink steps shown.
- **Diagram** — mermaid flowchart of generate → check → shrink → report.
- **Lab** — write property tests including a shrinking strategy for a custom generator; tests assert
  the seeded bugs are found within a bounded number of examples and that the reported
  counter-examples are minimal by the stated criterion.
- **Senior insight** — the highest-value property is usually the round trip (parse/print,
  encode/decode, serialise/deserialise), because it needs no oracle and it exercises both directions
  against each other; it is also the one people already have and never write.

### 61.3 Coverage and mutation testing
- **Covers** — coverage types (statement, branch, path, MC/DC) and what each does and does not
  imply, coverage as a lower bound on badness rather than a measure of goodness, the
  100%-coverage-with-no-assertions failure, mutation testing as a direct measure of test strength,
  mutation operators and equivalent mutants, the cost of mutation testing and where to apply it, and
  using mutation score to find weak assertions.
- **Demo** — a test suite at 100% coverage scored by mutation testing: a large fraction of mutants
  survive, each surviving mutant pointing at a missing assertion; adding assertions raises the
  mutation score with coverage unchanged at 100%.
- **Diagram** — mermaid diagram of a mutant surviving because a line is executed but not asserted.
- **Lab** — raise the mutation score of a provided suite above a threshold without changing
  coverage; tests assert the score and report which mutants remain alive.
- **Senior insight** — coverage tells you which code the tests *ran*, mutation tells you which code
  the tests *check*; the gap between the two numbers is the honest measure of a suite, and it is
  usually large.

### 61.4 Fuzzing in practice
- **Covers** — applying M32's fuzzing to real targets, choosing a fuzz target and its entry point,
  oracle design (crash, assertion, sanitiser, differential, round-trip), corpus construction and
  minimisation, structure-aware fuzzing with a grammar (from M25), continuous fuzzing in CI with a
  time budget, triage and deduplication of findings, and integrating found inputs as regression
  tests.
- **Demo** — fuzzing the platform's own parsers with a differential oracle against a reference
  implementation: coverage grows, a divergence is found and minimised, and the minimal input is
  promoted into the regression corpus automatically.
- **Diagram** — mermaid flowchart of the fuzz loop with the oracle and corpus feedback.
- **Lab** — build a fuzz target with a differential oracle for a provided pair of implementations;
  tests assert the seeded divergence is found within the time budget and that the reported input is
  minimal.
- **Senior insight** — a fuzzer without an oracle only finds crashes, and most bugs are not crashes;
  a differential oracle against an obviously-correct slow implementation is the cheapest strong
  oracle available and it is usually already in the repository as the "naive" version.

### 61.5 Debugging methodology
- **Covers** — debugging as hypothesis testing rather than inspection, reproducing first and
  reducing second, binary search over space (bisecting the code path) and over time (bisecting the
  history), delta debugging for automatic input minimisation, reading stack traces and core dumps,
  the "what changed" question, avoiding the confirmation trap, and knowing when to stop and rewrite.
- **Demo** — the debugging scoreboard: the same bug approached by inspection versus hypothesis-driven
  bisection, with steps taken and time-to-find recorded; the bug farm supplies the ground truth so
  the comparison is scored.
- **Diagram** — mermaid flowchart of the hypothesis loop: predict, test, eliminate, narrow.
- **Lab** — implement delta debugging (ddmin) for input minimisation; tests assert the minimised
  input still reproduces the failure and is minimal under the algorithm's 1-minimality definition.
- **Senior insight** — every debugging session should be able to state the current hypothesis and
  the experiment that would falsify it; when it cannot, you are reading code, and reading code has a
  much worse average time-to-find.

### 61.6 Record, replay and time-travel debugging
- **Covers** — determinism as a debugging superpower, record-and-replay of inputs and scheduling
  (using M47's deterministic scheduler), reverse execution, snapshot debugging, capturing enough
  context in production to reproduce locally (input capture, sampling, sanitisation), the overhead
  and privacy constraints, and designing systems to be replayable (pure cores, injected clocks and
  randomness, event-sourced state).
- **Demo** — a non-deterministic failure recorded once and then replayed deterministically as many
  times as needed, stepping forwards and backwards through the recorded execution to the divergence
  point.
- **Diagram** — mermaid diagram of the recorded sources of non-determinism (clock, randomness,
  scheduling, I/O) being replayed from the log.
- **Lab** — make a provided component replayable by injecting its non-deterministic dependencies,
  then record and replay a failure; tests assert byte-identical replay across runs and that the
  recording contains no sensitive data.
- **Senior insight** — the design changes that make a system replayable — inject the clock, inject
  randomness, keep the core pure — are the same ones that make it testable; replayability is a
  side effect of good structure rather than an extra feature.

### 61.7 Observability: the three signals
- **Covers** — metrics (counter, gauge, histogram, summary), cardinality as the cost driver and the
  label-explosion failure, aggregation and what it destroys, structured logging with correlation
  ids, log levels and sampling under load, log cost economics, distributed tracing with spans and
  context propagation, sampling strategies (head, tail, adaptive), and choosing which signal answers
  which question.
- **Demo** — the same incident investigated three ways: metrics show *that* something is wrong,
  traces show *where*, logs show *why* — with the cost of each signal at the observed volume
  computed, and a cardinality explosion demonstrated by adding a user-id label.
- **Diagram** — mermaid diagram of a trace with spans across services and the propagated context.
- **Lab** — implement trace-context propagation through the simulated call graph including async
  boundaries; tests assert every span is correctly parented, that the trace reconstructs the true
  call graph, and that context survives queue hops.
- **Senior insight** — cardinality is the metrics bill: one unbounded label (user id, URL with ids,
  error message) multiplies every series and is the standard way an observability budget is
  destroyed overnight.

### 61.8 SLOs and alerting
- **Covers** — service level indicators chosen from the user's perspective, objectives as targets
  with a time window, error budgets and what they permit, alerting on symptoms rather than causes,
  burn-rate alerting with multiple windows, alert fatigue and the paging threshold, the difference
  between a page and a ticket, dashboards designed to answer a question rather than display
  everything, and runbooks tied to alerts.
- **Demo** — the alerting laboratory: a service with an injected degradation, compared under
  threshold alerting (noisy, late) and multi-window burn-rate alerting (timely, quiet), with false
  positives and detection time measured for each configuration.
- **Diagram** — mermaid diagram of multi-window burn-rate alerting with fast and slow windows.
- **Lab** — define SLIs and SLOs for a simulated service and implement burn-rate alerting; tests
  assert the alert fires within the target detection time for real degradations and does not fire
  for the injected non-events.
- **Senior insight** — alerting on causes (CPU high, queue long) produces pages for things users
  never noticed; alerting on the SLI produces pages that always matter, and the burn-rate window
  pair is what makes it both timely and quiet.

### 61.9 Production diagnosis
- **Covers** — correlating signals across metrics, traces and logs, the USE/RED methods applied to
  live systems (from M58), continuous profiling in production and its overhead budget, diagnosing
  without reproducing, safe production experiments, the incident timeline as an artefact, blameless
  post-incident review with contributing factors rather than a root cause, and turning findings into
  tests or alerts.
- **Demo** — a full incident replay: the alert fires, the responder navigates from the SLI burn to
  the trace to the log line to the offending code path, with each step's evidence recorded into a
  timeline that becomes the post-incident document.
- **Diagram** — mermaid diagram of the diagnosis path from symptom through the three signals to the
  cause.
- **Lab** — diagnose three simulated incidents from telemetry alone, producing a timeline and a
  contributing-factor analysis; graded against the ground truth with credit for identifying the
  detection gap as well as the fault.
- **Senior insight** — the most valuable output of a post-incident review is usually not the fix but
  the *detection* improvement: the fault will recur in a different form, and the question "how long
  until we would have known" is the one that generalises.

### 61.10 Building diagnosable systems
- **Covers** — designing for diagnosis from the start: instrumentation as a first-class requirement,
  meaningful health checks (and why a `200 OK` from a process that cannot reach its database is
  worse than nothing), readiness versus liveness, feature flags and kill switches as diagnostic
  tools, staged rollouts with automated analysis, deploy markers correlated with metrics,
  observability-driven development, and the debuggability review as part of design review.
- **Demo** — two versions of the same service, one instrumented for diagnosis and one not, subjected
  to the same fault: the time-to-diagnosis is measured for each, and the instrumented version's
  extra cost (CPU, cardinality, log volume) is measured too so the trade is explicit.
- **Diagram** — mermaid diagram of a request path with the instrumentation points and what each
  answers.
- **Lab** — instrument a provided service so that every fault in the injection suite is diagnosable
  from telemetry alone within a time budget; graded on diagnosis time across all faults and on
  staying within a stated telemetry-cost budget.
- **Senior insight** — the cheapest observability decision is a health check that actually checks
  dependencies, and the most expensive is unbounded label cardinality; both are made in an afternoon
  early on and are painful to change later.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/test/bug-farm.js` | Seeded-bug codebases with known reproductions and scoring |
| `src/js/algorithms/property-testing.js` | Generators, shrinking, stateful/model-based harness |
| `src/js/algorithms/mutation-testing.js` | Mutation operators, runner, score, equivalent-mutant handling |
| `src/js/algorithms/delta-debug.js` | ddmin input minimisation |
| `src/js/machines/test/record-replay.js` | Dependency injection points, recording, deterministic replay |
| `src/js/machines/obs/telemetry.js` | Metrics, structured logs, traces, cardinality and cost model |
| `src/js/machines/obs/tracing.js` | Span model, context propagation across async and queue hops |
| `src/js/machines/obs/slo.js` | SLI computation, error budgets, burn-rate alerting |
| `src/js/machines/obs/incident-lab.js` | Injected incidents with ground truth and timeline capture |
| `src/js/viz/trace-view.js` | Distributed-trace waterfall with span detail |

---

## Acceptance criteria

- [ ] Every testing technique is scored against the bug farm (detection rate and time), so claims
      about effectiveness are measured.
- [ ] The refactor-survival score is reported alongside coverage and mutation score for every
      example suite.
- [ ] Property-test shrinking produces minimal counter-examples by a stated criterion, asserted in
      tests.
- [ ] Replay is byte-identical across runs, asserted by comparing full execution traces.
- [ ] Trace-context propagation is verified against the true call graph, including async and
      queue-crossing spans.
- [ ] Alerting labs assert both detection time and false-positive count; a detection-only assertion
      fails review.
- [ ] The diagnosability lab enforces a telemetry-cost budget so instrumentation cannot be scored by
      volume alone.

---

## Sources

- Beck — *Test-Driven Development: By Example*; Meszaros — *xUnit Test Patterns* (doubles taxonomy)
- Hughes — *QuickCheck: a lightweight tool for random testing of Haskell programs*
- Zeller, Hildebrandt — *Simplifying and isolating failure-inducing input* (delta debugging)
- Zeller — *Why Programs Fail: A Guide to Systematic Debugging*
- Jia, Harman — *An analysis and survey of the development of mutation testing*
- O'Callahan et al. — *Engineering record and replay for deployability* (rr)
- Majors, Fong-Jones, Miranda — *Observability Engineering*
- Beyer et al. — *Site Reliability Engineering* and *The SRE Workbook* (SLOs, burn-rate alerting)
- Allspaw — *Blameless postmortems and a just culture*
