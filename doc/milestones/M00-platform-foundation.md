# M00 — Platform foundation and the runnable-code engine

> **Track** Platform · **Depends on** — · **Sections** 4 · **Effort** L

**Outcome.** A working shell with theming, curriculum-driven navigation, the section pattern, the
mermaid and D3 pipelines, the sandboxed code runner, the graded-exercise harness, progress tracking
and the three automated checks. Every later milestone is "add sections", never "add plumbing".

**Why it is first and large.** The reference project this is modelled on paid for skipping this:
an 11k-line `index.html`, a 200-line hand-maintained init list, and a sidebar that could silently
disagree with the syllabus. The fixes are cheap now and impossible later.

---

## Sections

### 0.1 Home and the curriculum map
- **Covers** — what the platform is, how a section is laid out, the eleven tracks and their
  dependency graph, suggested paths (interview prep, systems depth, compiler track, full sweep).
- **Demo** — the map itself: tracks as columns, sections as cells, colour-coded by progress state
  (unvisited / visited / labs passed), click to navigate, hover for the one-line summary. Rendered
  from `Curriculum`, so it can never drift from the sidebar.
- **Diagram** — mermaid graph of track dependencies, generated from the curriculum data.
- **Lab** — none (the only section without one).
- **Senior insight** — the map doubles as a self-audit: the cells you cannot explain are the
  syllabus.

### 0.2 How this platform runs your code
- **Covers** — the worker sandbox, the message protocol, the time and step budgets, what the
  console captures, how exercises are graded, why timings are medians over repeated runs, and what
  the instrumented primitives actually count.
- **Demo** — a live protocol inspector: run a snippet, watch the `run` / `log` / `trace` / `metric`
  / `done` messages stream in with timestamps; trigger a timeout and watch the worker get
  terminated and replaced.
- **Diagram** — mermaid sequence diagram, host to worker, including the timeout path.
- **Lab** — "make this run finish inside the budget": an intentionally quadratic snippet with a
  1s budget; the exercise passes when the learner's version completes and returns the same result.
- **Senior insight** — measurement is a feature of the teaching, not decoration. Every number the
  platform shows names its counter, because "faster" without a unit is how benchmarks lie.

### 0.3 JavaScript as a systems language
- **Covers** — `ArrayBuffer`, typed arrays and `DataView`; endianness; alignment; `Number` as an
  IEEE 754 double and the 2^53 integer boundary; `BigInt`; bitwise operators coercing to int32 and
  `>>>` to uint32; `Math.imul`; NaN and `-0` semantics; `structuredClone` versus transferables;
  Workers and `SharedArrayBuffer` with `Atomics`; what V8 hidden classes mean for object shape;
  why `performance.now()` is clamped and what that costs a microbenchmark.
- **Demo** — a byte inspector: type a value, choose a view (`Int8`, `Uint32`, `Float32`,
  `Float64`, `BigInt64`), see the bytes, flip individual bits, watch every interpretation update
  at once. Endianness toggle included.
- **Diagram** — mermaid flowchart of the JS numeric tower and where each operator coerces.
- **Lab** — implement `readVarint(view, offset)` against a `DataView`; implement `hashCombine`
  with `Math.imul` and verify avalanche on the provided bit-difference test.
- **Senior insight** — nearly every "JavaScript can't do systems programming" objection is really
  "I did not know about typed arrays". This section is the prerequisite that makes the
  architecture, OS and compiler tracks honest rather than metaphorical.

### 0.4 Progress, notes and settings
- **Covers** — how progress is recorded, what is stored locally, export and import of progress as
  JSON, theme, animation speed, reduced motion, code-lab font size, and resetting a section.
- **Demo** — the settings panel plus a progress dashboard: sections completed per track, labs
  passed, current streak, and the review queue that M64 later fills.
- **Diagram** — mermaid state diagram of a section's progress states.
- **Lab** — none.
- **Senior insight** — everything is local; the export file is the whole state, which is also how
  you move progress between machines.

---

## Engineering deliverables

| Path | Purpose |
|---|---|
| `index.html` | Shell: head, sidebar mount, header, section containers, ordered script tags. No inline script, no section markup |
| `package.json` | `start`, `test`, `test:wiring`, `test:unit`, `lint:size`, `build:css` |
| `tailwind.config.js` | `content: ['./index.html', './src/js/**/*.js']`, `darkMode: ['selector', '[data-theme="dark"]']` |
| `lib/` | Vendored `jquery-3.7.1.min.js`, `mermaid.min.js`, `d3.v7.min.js`, built `tailwind.css` |
| `src/css/` | `main.css` importing `base`, `theme-dark`, `theme-light`, `layout`, `components`, `code-lab`, `viz`, `content` |
| `src/js/core/curriculum.js` | Groups and sections, the single source of syllabus truth |
| `src/js/core/section-registry.js` | `register` / `initAll` / `get`; throws on duplicate id |
| `src/js/core/state.js` | Store plus pub/sub; the only events are `navigation`, `theme`, `progress`, `runner:*` |
| `src/js/core/navigation.js` | Hash routing, lazy activation, prev/next, `Ctrl+K` search over curriculum |
| `src/js/core/runner.js` | `Runner` interface; `WorkerBackend` and `InlineBackend`; pool, budgets, terminate |
| `src/js/core/worker-bootstrap.js` | Worker-side: console capture, `emit`, seeded `rng`, step counter, error framing |
| `src/js/core/progress.js` | Section status, lab results, streaks; depends on `StorageAdapter` |
| `src/js/core/storage-adapter.js` | Thin `localStorage` interface with an in-memory double for tests |
| `src/js/core/mermaid-renderer.js` | On-demand render, hash cache, theme-variable injection, re-render on `theme` |
| `src/js/core/lazy-lib.js` | Loads `mermaid` and `d3` on first use, once, with a pending-promise guard |
| `src/js/core/theme.js` | Theme toggle and persistence |
| `src/js/components/code-lab.js` | Editor, toolbar, console, verdict panel; one instance per lab |
| `src/js/components/section-shell.js` | Renders orientation / demo / lab / concepts / reference frames uniformly |
| `src/js/components/{section-concepts,section-examples,section-reference}.js` | Content renderers |
| `src/js/components/tab-controller.js` | The only tab implementation |
| `src/js/views/{sidebar,home,settings}-view.js` | Curriculum-driven chrome |
| `src/js/utils/` | `helpers`, `palette`, `format`, `random`, `js-highlight`, `dom`, `assert` |
| `src/js/viz/chart-base.js` | D3 chart scaffold: margins, responsive resize, axes, theme palette, `render`/`update` contract |
| `src/js/viz/{canvas,legend,tooltip}.js` | Canvas surface, legends and tooltips shared by every later `*-view.js` |
| `tests/wiring-audit.js` | The static audit described in `architecture.md` section 8 |
| `tests/file-size-check.js` | 1000-line file and 50-line function limits |
| `tests/unit/` | Suites for runner protocol, curriculum integrity, progress, registry, highlighter, plot scales |

---

## Content

Concepts, worked examples and reference entries exist for 0.2 and 0.3. Registries and the
coverage test ship here even though only four sections exist, so the floor is enforced from the
first added section onward.

---

## Acceptance criteria

- [ ] `npm start` serves the site; every route in the curriculum resolves and renders.
- [ ] The sidebar, home map, header title and prev/next links are all generated from
      `curriculum.js`. Deleting a section from the curriculum removes it everywhere.
- [ ] A section renders only when first activated (verified by a spy in the smoke test).
- [ ] `Runner` executes a snippet in a worker, streams logs, enforces the 2s budget, terminates on
      overrun and reports `timeout` without wedging the pool.
- [ ] `InlineBackend` satisfies the identical protocol and is what unit tests use.
- [ ] A graded exercise reports per-assertion pass/fail and persists its result across reload.
- [ ] Both themes pass WCAG AA on every text pair in all four sections; mermaid diagrams re-render
      on theme switch with no hard-coded colour.
- [ ] `npm test` green: wiring audit plus unit suites. `npm run lint:size` reports zero offenders.
- [ ] Total transferred bytes before first paint under 400 KB; mermaid is fetched on first diagram
      and D3 on first chart, each exactly once even when two sections request it concurrently.
- [ ] Progress export produces a JSON file that import restores exactly.

---

## Sources

- MDN — Web Workers, `structuredClone`, typed arrays, `Atomics`, `performance.now` clamping
- ECMA-262 — numeric types, `ToInt32` / `ToUint32` coercion, `Math.imul`
- WCAG 2.2 — contrast minimums
- mermaid documentation — `initialize`, `render`, `themeVariables`
