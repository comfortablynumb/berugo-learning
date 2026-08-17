# M64 — Challenge arena, progress and spaced repetition

> **Track** Practice and mastery · **Depends on** M00 · **Sections** 8 · **Effort** L

**Outcome.** The practice layer that turns a reference site into a training system: graded
challenges across every track, a review scheduler that fights forgetting, debugging and performance
challenges scored against reference implementations, and a mastery map that tells the learner what
they cannot yet do.

**Why it is last and also early.** The infrastructure (challenge runner, scheduler, progress model)
is small enough to build after M00 if the platform is being used seriously before the curriculum is
finished; the *content* accumulates from every milestone. Building the harness early and letting
milestones contribute challenges as they land is the recommended order.

**Shared machinery introduced.** `machines/practice/` — the challenge runner (graded execution over
the M00 worker with hidden tests, complexity checks and timing), the review scheduler, the skill
graph and the analytics model, all persisted through the M00 storage adapter.

---

## Sections

### 64.1 The challenge arena
- **Covers** — the challenge model (prompt, starter code, visible tests, hidden tests, constraints,
  reference solution), difficulty tiers, tags mapped to the curriculum's skill graph, correctness
  grading plus constraint grading (complexity, memory, allowed operations), partial credit, and
  anti-gaming measures (hidden tests, randomised inputs, operation counters rather than wall clock).
- **Demo** — the arena itself: browse or filter challenges by track, tag or difficulty, solve in the
  code lab, submit and receive per-test feedback with the constraint results and a comparison
  against the reference solution's operation counts.
- **Diagram** — mermaid flowchart of a submission through visible tests, hidden tests and constraint
  checks to a verdict.
- **Lab** — the challenges themselves; this section's own exercise is a guided first solve with the
  feedback mechanics explained.
- **Senior insight** — grading on operation counts rather than wall time is what makes complexity
  requirements enforceable in a browser; it also teaches the right habit, since a wall-clock
  submission rewards micro-optimisation over the correct algorithm.

### 64.2 The interview-preparation track
- **Covers** — a curated path across the existing content aimed at technical interviews, the pattern
  catalogue (two pointers, sliding window, binary search on answer, BFS/DFS, backtracking, DP
  shapes, heap top-k, union-find, monotonic stack, interval merging), timed sessions with a
  visible clock, communicating while solving (a structured prompt to state approach, complexity and
  trade-offs before coding), and a rubric covering more than correctness.
- **Demo** — a timed session: a problem with a phase structure (clarify, approach, complexity
  estimate, implement, test, optimise), each phase timed, ending with a rubric-based self-assessment
  compared against the reference approach.
- **Diagram** — mermaid flowchart of the interview problem-solving phases with the checkpoint at
  each.
- **Lab** — complete a timed session and produce the complexity analysis before implementing; graded
  on the analysis matching the implementation and on passing within the time budget.
- **Senior insight** — stating the complexity before implementing catches most wrong approaches
  before the code is written, and it is the single habit that most improves interview performance —
  and design review performance, for the same reason.

### 64.3 Spaced repetition
- **Covers** — the forgetting curve and spacing effects, the SM-2 scheduling algorithm and its
  parameters, review-item design (a concept prompt is not a flashcard of a definition — it is a
  small applied question), scheduling from a difficulty rating, interleaving across topics versus
  blocking, the review-queue size problem and how to bound it, and measuring retention rather than
  activity.
- **Demo** — the review queue: due items with their scheduling state, a review session with the
  interval updating from the rating, and a retention chart showing predicted versus observed recall
  over time.
- **Diagram** — mermaid diagram of the SM-2 interval progression under different ratings.
- **Lab** — implement the SM-2 scheduler with ease-factor bounds and a daily review cap; tests
  assert interval progression matches the algorithm's specification, that the queue never exceeds
  the cap, and that lapsed items are reintroduced correctly.
- **Senior insight** — the review items worth scheduling are the ones you cannot re-derive: an
  algorithm you can reconstruct from first principles does not need review, and a bound, a rule or a
  failure mode does.

### 64.4 Code-reading challenges
- **Covers** — reading as a distinct trained skill, strategies (identify the shape before the
  detail, find the state, trace one input, look for the invariant), predicting behaviour before
  running, spotting the bug in unfamiliar code, reconstructing intent from implementation, and
  reading the platform's own modules as the corpus.
- **Demo** — a reading challenge: an unfamiliar implementation with a prediction prompt ("what does
  this return for input X"), the learner's prediction recorded, then the code executed with the
  actual trace shown and the divergence explained.
- **Diagram** — mermaid flowchart of a reading strategy from shape to state to invariant.
- **Lab** — read three implementations, predict their behaviour on given inputs and identify the
  seeded bug in one; graded on prediction accuracy and on locating the bug's line.
- **Senior insight** — prediction before execution is what converts reading into learning; reading
  code and then running it teaches far less than committing to an answer first and being wrong.

### 64.5 Design challenges
- **Covers** — system-design prompts with explicit requirements and constraints, the structured
  approach (clarify requirements, estimate scale, define the API, sketch the data model, choose the
  architecture, address failure and scale, state trade-offs), back-of-the-envelope calculators
  wired to M58's models, a rubric that rewards trade-off reasoning over naming technologies, and
  reference solutions with their own stated weaknesses.
- **Demo** — a design challenge with an embedded sizing calculator: entering traffic and payload
  assumptions produces storage, bandwidth and instance-count estimates, and the M60 simulator can
  run the proposed topology under the stated load.
- **Diagram** — mermaid flowchart of the design-interview structure with the artefact produced at
  each step.
- **Lab** — produce a design with a sizing calculation and a stated failure-mode analysis; graded
  against a rubric covering requirements, sizing arithmetic, data model, failure handling and
  explicit trade-offs.
- **Senior insight** — the sizing arithmetic is the part that separates a design from a diagram: an
  architecture that cannot store the stated volume or serve the stated rate is wrong regardless of
  how conventional it looks.

### 64.6 Debugging challenges
- **Covers** — challenges where the code is broken and the tests are the oracle, across every track
  (a subtly wrong balanced tree, a race in a lock-free queue, an off-by-one in a parser, a
  cache-invalidation bug, a distributed-consistency violation), the discipline of reproducing before
  fixing, and scoring by time-to-find and by whether the fix addresses the cause.
- **Demo** — a debugging challenge with the failing test visible, the reproduction available, and
  optional tool assists (tracer, replay, race detector) each recorded so the learner can see which
  tools shortened the search.
- **Diagram** — mermaid flowchart of the debugging loop with the tool choice at each stage.
- **Lab** — fix five seeded bugs across different tracks; graded on tests passing, on time-to-find,
  and on a check that the fix is at the cause rather than suppressing the symptom (the hidden tests
  include cases the symptom-suppressing fix fails).
- **Senior insight** — the hidden test that catches a symptom-suppressing fix is the same idea as a
  regression test written from the cause rather than the report; if the fix cannot be explained
  mechanically, it probably is not one.

### 64.7 Performance challenges
- **Covers** — optimisation under a measured constraint, challenges specifying a target in
  operation counts, simulated cache misses or simulated cycles rather than wall time, correctness as
  a gate before performance is scored, a leaderboard against the reference implementation and
  anonymised percentiles, required attribution of each change's contribution, and the
  complexity-budget rule that prevents unreadable wins.
- **Demo** — a performance challenge run: baseline measured, the learner's changes measured
  incrementally with per-change attribution, and the final result placed against the reference and
  the distribution of prior submissions.
- **Diagram** — mermaid flowchart of the scored optimisation loop with the correctness gate.
- **Lab** — meet the performance target on three challenges from different tracks with attribution;
  graded on the target, the attribution and the correctness gate.
- **Senior insight** — scoring on simulated counters rather than wall clock makes results comparable
  across machines and stops the exercise from becoming a benchmark of the learner's hardware — the
  same argument the platform makes for every measurement it reports.

### 64.8 Progress, mastery and study plans
- **Covers** — the skill graph derived from the curriculum with prerequisite edges, per-skill
  mastery estimated from section completion, lab results, challenge performance and review
  retention, gap analysis against a target role or goal, generated study plans with an ordering that
  respects prerequisites, honest presentation of uncertainty in the estimates, and progress export.
- **Demo** — the mastery map: the skill graph coloured by estimated mastery with confidence
  indicated, a gap analysis against a chosen goal, and a generated plan with the next five sections
  and their rationale.
- **Diagram** — mermaid graph of a skill subgraph with prerequisites and mastery levels annotated.
- **Lab** — implement the mastery estimator combining the evidence sources with a stated weighting
  and a confidence measure; tests assert monotonicity (more evidence of success never lowers the
  estimate), that a skill with no evidence is reported as unknown rather than zero, and that plans
  never suggest a section whose prerequisites are unmet.
- **Senior insight** — "unknown" and "not mastered" are different states, and conflating them is
  what makes learning dashboards demotivating and useless; the map's job is to point at the next
  useful thing, not to score the learner.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/practice/challenge-runner.js` | Graded execution, hidden tests, constraint checks |
| `src/js/machines/practice/scheduler.js` | SM-2 review scheduling, queue caps, lapse handling |
| `src/js/machines/practice/skill-graph.js` | Skills, prerequisites, mastery estimation, confidence |
| `src/js/machines/practice/study-plan.js` | Gap analysis and prerequisite-respecting plan generation |
| `src/js/machines/practice/session.js` | Timed sessions, phase prompts, rubric capture |
| `src/js/machines/practice/leaderboard.js` | Local percentile comparison against reference runs |
| `src/js/content/challenges/` | Challenge definitions contributed by every milestone |
| `src/js/content/review-items/` | Spaced-repetition items contributed by every milestone |
| `src/js/viz/mastery-map-view.js` | Skill graph with mastery and confidence rendering |

---

## Acceptance criteria

- [ ] Challenge grading uses operation counters or simulated metrics, never wall-clock time, for any
      complexity or performance constraint.
- [ ] Hidden tests include randomised inputs, so a solution that special-cases the visible tests
      fails.
- [ ] Every debugging challenge includes at least one hidden test that a symptom-suppressing fix
      fails.
- [ ] The scheduler's interval progression matches the SM-2 specification exactly, asserted per
      rating path, and the daily queue cap is enforced.
- [ ] Mastery estimates distinguish "unknown" from "low", and the estimator is monotone in success
      evidence, both asserted.
- [ ] Generated study plans never violate a prerequisite edge, asserted over randomised progress
      states.
- [ ] Every challenge in the library has a reference solution that passes its own hidden tests and
      constraints, verified in CI.
- [ ] All progress data is local, exportable and importable, round-tripping exactly.

---

## Sources

- Ebbinghaus — the forgetting curve; Cepeda et al. — the distributed-practice meta-analysis
- Wozniak — the SM-2 algorithm description
- Roediger, Karpicke — *Test-enhanced learning: taking memory tests improves long-term retention*
- Rohrer, Taylor — the interleaving studies
- Ericsson, Krampe, Tesch-Römer — *The role of deliberate practice in the acquisition of expert performance*
- Bjork — desirable difficulties
