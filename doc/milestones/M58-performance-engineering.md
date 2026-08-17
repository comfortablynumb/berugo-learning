# M58 — Performance engineering and queueing theory

> **Track** Engineering practice · **Depends on** M01, M37 · **Sections** 10 · **Effort** L

**Outcome.** A method rather than a bag of tricks: state the question, choose the metric, measure it
correctly, model the system, change one thing, verify. The queueing-theory half explains the
behaviour every engineer has seen and few can predict — why latency explodes at 80% utilisation and
why adding a server sometimes does nothing.

**Shared machinery introduced.** `machines/perf/service-sim.js` — a service simulator with arrival
processes, service-time distributions, queues, concurrency limits and multi-tier dependencies;
`machines/perf/profiler.js` — a sampling profiler over the platform's own worker executions
producing flame graphs; `viz/flamegraph-view.js` and `viz/latency-view.js` (from M45).

---

## Sections

### 58.1 Performance methodology
- **Covers** — starting from a question rather than a tool, the USE method (utilisation, saturation,
  errors) for resources and the RED method (rate, errors, duration) for services, the four golden
  signals, workload characterisation as the prerequisite, defining "fast enough" as a distribution
  target, and the anti-methods (streetlight, blame-someone-else, random change).
- **Demo** — the methodology walkthrough on a misbehaving simulated service: apply USE to each
  resource and RED to each endpoint, narrowing to the saturated resource in a handful of steps, with
  the checklist visible as it is worked through.
- **Diagram** — mermaid flowchart of the USE method applied across resources.
- **Lab** — diagnose three simulated services using USE/RED and name the bottleneck resource;
  graded against the ground truth built into each scenario.
- **Senior insight** — the highest-value habit is asking "what would I expect this number to be"
  before looking; a measurement without a prior is just a number, and it is why people stare at
  dashboards without concluding anything.

### 58.2 Measuring latency
- **Covers** — why averages are useless for latency, percentiles and their correct interpretation,
  why percentiles cannot be averaged or summed across services, histograms and HDR histograms with
  their bucketing error, coordinated omission (from M45) and its correction, sampling bias,
  measuring at the right boundary (client versus server), and reporting a distribution honestly.
- **Demo** — the same run reported five ways: mean, median, p99, the full histogram and a CDF — with
  a bimodal distribution where the mean falls in the empty valley between the two modes; averaging
  per-shard p99s is shown to produce a number that does not exist in the data.
- **Diagram** — mermaid diagram of a bimodal latency distribution with the mean marked in the gap.
- **Lab** — implement an HDR-style histogram with bounded relative error and correct percentile
  queries; tests assert reported percentiles are within the configured error against exact sorted
  data across skewed distributions.
- **Senior insight** — "the average latency is 40 ms" is compatible with half of users waiting 5 ms
  and half waiting 75 ms; the histogram is the only honest report, and the mean should generally not
  appear on a latency dashboard at all.

### 58.3 Profiling
- **Covers** — sampling versus instrumentation and their bias profiles, CPU profiles versus wall-clock
  profiles, off-CPU analysis for blocked time, allocation profiling, flame graphs and how to read
  them (and how not to), inverted/icicle views for finding hot leaves, profiler skew and safepoint
  bias, and profiling in production with continuous profilers.
- **Demo** — the profiler applied to a workload with both CPU-heavy and blocking phases: the CPU
  flame graph misses the blocking entirely, the wall-clock profile finds it, and the off-CPU view
  attributes it to the specific wait.
- **Diagram** — mermaid diagram of a stack-sample aggregation becoming a flame graph.
- **Lab** — implement stack-sample aggregation into a flame-graph tree with self and total time;
  tests assert the aggregation matches a reference for recorded sample sets and that self times sum
  to the total.
- **Senior insight** — a CPU profile of a service that spends 90% of its time waiting shows you the
  10%; the first question about any profile is which clock it used, and most tools default to the
  wrong one for I/O-bound services.

### 58.4 Queueing theory
- **Covers** — arrival and service processes, Little's law (L = λW) and its remarkable generality,
  utilisation and the utilisation law, M/M/1's response-time formula and the hyperbolic explosion
  near ρ = 1, M/M/c and the pooling benefit, variability's effect via the Kingman approximation,
  why queueing delay dominates service time under load, and applying the models to thread pools,
  connection pools and disk queues.
- **Demo** — the response-time curve: an interactive M/M/1 and M/M/c model with utilisation,
  variability and server count as controls, plotted against a discrete-event simulation of the same
  parameters so the model's accuracy (and its assumptions' limits) are visible.
- **Diagram** — mermaid diagram of the response-time-versus-utilisation curve with the knee marked.
- **Lab** — apply Little's law to size a thread pool for a stated arrival rate and latency target,
  then verify by simulation; tests assert the predicted concurrency matches the simulated
  requirement within a tolerance.
- **Senior insight** — at 80% utilisation, response time is 5× the service time; at 90% it is 10×.
  That curve, not a CPU-percentage threshold, is why capacity planning targets 60–70% and why
  "the CPU is only at 85%" is not reassuring.

### 58.5 Capacity planning and scalability
- **Covers** — headroom as a latency requirement rather than a safety margin, saturation versus
  utilisation, the knee of the curve, the Universal Scalability Law with its contention and
  coherency terms (and the retrograde region where adding capacity *reduces* throughput), fitting
  the USL to measured data, forecasting with growth, and designing a load test that finds the knee.
- **Demo** — USL fitting: measure throughput across concurrency levels on the simulated service, fit
  the contention and coherency coefficients, and see the predicted peak and retrograde region —
  then push past it and watch the prediction hold.
- **Diagram** — mermaid diagram of the USL curve with linear, contention-limited and retrograde
  regions.
- **Lab** — fit the USL to a measured dataset and predict the optimal concurrency; tests assert the
  fit's parameters and the predicted peak match the simulator's actual peak within a tolerance.
- **Senior insight** — the coherency term means some systems get *slower* with more nodes; when a
  scale-out produces no improvement, fitting the USL tells you whether you are contention-limited
  (fixable by removing a serial section) or coherency-limited (fixable only by changing the design).

### 58.6 Tail latency at scale
- **Covers** — why the tail dominates user experience in fan-out systems, the arithmetic of tail
  amplification (a 1-in-100 slow response becomes near-certain across 100 parallel calls), sources
  of tail latency (queueing, GC, background work, contention, retries), hedged and tied requests,
  request reissue with a deadline, micro-partitioning and selective replication, and designing for
  tail tolerance instead of chasing individual slow paths.
- **Demo** — fan-out amplification: a service calling N backends, with the overall p99 computed and
  measured as N grows from 1 to 100; hedging after p95 is enabled and the tail collapses with the
  extra load quantified.
- **Diagram** — mermaid diagram of a fan-out where the slowest of N determines the response.
- **Lab** — implement hedged requests with a deadline and a hedge budget; tests assert the p99
  improvement and that the additional load stays within the configured budget.
- **Senior insight** — with 100 parallel backend calls, your p99 is roughly your backends' p99.99;
  that arithmetic is why large fan-out services obsess over tails and why fixing the mean does
  nothing for them.

### 58.7 The optimisation workflow
- **Covers** — measure, model, change one thing, verify, attribute; Amdahl's law bounding the payoff
  and Gustafson's reframing, choosing what to optimise by potential rather than by ease, the cost of
  an optimisation in complexity, knowing when to stop (the roofline or the theoretical bound), and
  keeping a performance log so improvements do not silently regress.
- **Demo** — the workflow applied to a slow function: baseline, profile, hypothesis, change,
  re-measure, attribute — with a deliberately misleading step included where the "obvious"
  optimisation makes it slower and the measurement catches it.
- **Diagram** — mermaid flowchart of the optimisation loop with the verification gate.
- **Lab** — optimise a provided workload to a target with a required attribution table; graded on
  the measured improvement *and* on whether each claimed contribution is supported by its own
  measurement.
- **Senior insight** — Amdahl's law says optimising a component that is 20% of runtime caps your
  gain at 20%, no matter how good the optimisation; computing that ceiling before starting is a
  two-minute step that routinely cancels the work.

### 58.8 Mapping symptoms to subsystems
- **Covers** — the cross-track synthesis: CPU-bound symptoms and top-down analysis (M36),
  memory-bound symptoms and the hierarchy (M37), lock-bound symptoms (M42), I/O-bound symptoms
  (M44), network-bound symptoms (M49), GC-bound symptoms (M31), and the diagnostic questions that
  distinguish them quickly.
- **Demo** — the symptom-to-subsystem workbench: eight unlabelled workloads, each bound by a
  different subsystem, with the full metric set available; the learner classifies each and the
  ground truth with the deciding signal is then shown.
- **Diagram** — mermaid decision flowchart from symptom to subsystem with the deciding metric on
  each branch.
- **Lab** — classify all eight workloads and name the single metric that decided each; graded
  against the ground truth with partial credit for the right subsystem via the wrong evidence.
- **Senior insight** — high CPU with low IPC is a memory problem, not a CPU problem; that one
  distinction (from M36's top-down method) redirects more investigations than any other single fact
  in this milestone.

### 58.9 Service-level benchmarking
- **Covers** — designing a load test that answers a question, open versus closed workload models and
  when each is right, arrival-process realism, warm-up and steady state, running long enough to see
  GC and cache effects, comparing two versions with statistical rigour (confidence intervals,
  effect size, repeated runs), A/B testing in production, and reporting results with the conditions
  attached.
- **Demo** — two service versions compared: a single run suggests version B is 8% faster, repeated
  runs with confidence intervals show the difference is inside the noise, and a longer run reveals
  version B is actually slower once its cache behaviour stabilises.
- **Diagram** — mermaid flowchart of the benchmark protocol from hypothesis to reported interval.
- **Lab** — design and run a comparison that reaches a statistically supported conclusion; graded on
  whether the conclusion's confidence interval excludes zero and whether the protocol's validity
  checks pass.
- **Senior insight** — most performance comparisons in engineering discussions have a sample size of
  one and a difference smaller than the run-to-run variance; asking for the interval is the fastest
  way to end an unproductive argument.

### 58.10 An end-to-end case study
- **Covers** — a full optimisation of a multi-tier simulated service: characterise the workload,
  find the bottleneck, model the expected gain, apply the change, verify, then repeat as the
  bottleneck moves — including the point where the next optimisation is not worth its complexity.
- **Demo** — the case study, replayable step by step: each change with its predicted and measured
  effect, the bottleneck moving between tiers, and a final summary attributing the total improvement
  to each change.
- **Diagram** — mermaid diagram of the service topology with the bottleneck's location at each stage
  of the study.
- **Lab** — take the service from its baseline to a stated latency target with a required change
  log; graded on the target, on attribution quality, and on a complexity budget (a limited number of
  changes) so that indiscriminate changes cannot pass.
- **Senior insight** — the bottleneck always moves, and the discipline is re-measuring after every
  change rather than applying a planned list; the plan made before the first measurement is
  obsolete after it.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/perf/service-sim.js` | Multi-tier service with queues, concurrency limits, dependencies |
| `src/js/machines/perf/queueing.js` | M/M/1, M/M/c, Kingman, Little's law, USL fitting |
| `src/js/machines/perf/profiler.js` | Sampling profiler, CPU/wall/off-CPU modes, allocation profiling |
| `src/js/algorithms/histogram.js` | HDR-style histogram with bounded relative error |
| `src/js/algorithms/statistics.js` | Confidence intervals, effect size, bootstrap comparison |
| `src/js/machines/perf/loadgen.js` | Open/closed models, arrival processes, omission correction |
| `src/js/viz/flamegraph-view.js` | Flame and icicle graphs with self/total attribution |
| `src/js/viz/queueing-view.js` | Response-time curves, USL fits, utilisation plots |

---

## Acceptance criteria

- [ ] Every latency result in this milestone is reported as a distribution; the mean alone is never
      displayed as a headline number.
- [ ] Percentile computation is validated against exact sorted data within the histogram's stated
      error bound.
- [ ] The queueing models are validated against discrete-event simulation across the utilisation
      range, and the section states where the model's assumptions break.
- [ ] USL fits are validated by predicting a held-out concurrency level's throughput.
- [ ] The hedging lab reports both the tail improvement and the extra load, and asserts the budget.
- [ ] Benchmark comparisons report confidence intervals; a comparison without one fails the
      harness's validity check.
- [ ] The case-study lab enforces a change budget so improvement must be attributed, not sprayed.

---

## Sources

- Gregg — *Systems Performance* and *BPF Performance Tools*
- Little — the proof of L = λW; Kingman — the heavy-traffic approximation
- Gunther — *Guerrilla Capacity Planning* (the Universal Scalability Law)
- Dean, Barroso — *The tail at scale*
- Tene — *How not to measure latency*
- Georges, Buytaert, Eeckhout — *Statistically rigorous Java performance evaluation*
- Gregg — the flame-graph and off-CPU analysis writeups
- Yasin — *A top-down method for performance analysis and counters architecture*
