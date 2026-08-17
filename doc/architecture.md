# Architecture

How the platform is put together, and the conventions every milestone is written against.
This document is normative: a milestone says *what* to build, this says *how* it must be built.

---

## 1. Constraints

| Constraint | Reason |
|---|---|
| No framework — jQuery + Tailwind, plus mermaid and D3 as libraries | The stack the project is specified in; libraries are used for diagrams and charts, not to structure the app, so every section stays readable as plain DOM code |
| No runtime network access | The platform must work on a plane. All dependencies vendored into `lib/` |
| One build step, `npm run build:css` | Tailwind purges unused classes; nothing else compiles |
| Served over `http://`, not opened as a file | Web Workers do not start from a `file://` origin |
| Every claim is executable | If a section states a cost, a bound or a behaviour, the demo must measure or exhibit it |

---

## 2. Runtime layout

```
index.html
  ├─ #sidebar-mount        rendered from Curriculum
  ├─ #header-title         rendered from Curriculum
  └─ main
       └─ <section data-section="quicksort" hidden>
            └─ <div id="quicksort-content"></div>   <- template renders here on first activation
```

`index.html` holds no section markup, no inline script and no hand-written navigation. It is a
shell plus the ordered `<script>` tags. The wiring audit fails on inline scripts and on a
`<section>` whose id is not in the curriculum.

### Boot sequence

1. `ThemeManager.init()` — reads the stored theme and sets `data-theme` on `<html>` before first paint.
2. `SidebarView.render()` and `HomeView.render()` read `Curriculum`.
3. `SectionRegistry.initAll()` — each section module binds its delegated handlers. No rendering yet.
4. `Navigation.init()` — resolves the hash, shows one section, emits `navigation`.
5. The active section renders its template, then draws.

Rendering is lazy: a section that is never visited never builds its DOM, never starts a worker and
never renders a mermaid diagram. With ~500 sections planned this is not an optimisation, it is the
only way the page stays responsive.

---

## 3. Core modules (`src/js/core/`)

| Module | Responsibility | Notes |
|---|---|---|
| `curriculum.js` | Ordered groups -> sections -> `{ id, title, tags }` | Single source of truth. Sidebar, home map, prev/next and header all read it |
| `section-registry.js` | `register({ id, init })`, `initAll()`, `get(id)` | Replaces a hand-maintained init list; duplicate ids throw at load |
| `state.js` | `get / set / update / subscribe / emit` over a plain object | Only `navigation`, `theme`, `progress` and `runner:*` events exist |
| `navigation.js` | Hash routing, section show/hide, prev/next, `Ctrl+K` search | Emits `navigation` and nothing else |
| `runner.js` | Runs code off the main thread behind an interface | See section 5 |
| `progress.js` | Per-section status, exercise results, streaks | Depends on `StorageAdapter`, not on `localStorage` directly |
| `storage-adapter.js` | `get / set / remove` over `localStorage` | Injected, so unit tests pass an in-memory double |
| `mermaid-renderer.js` | Queued render, theme variables, error surface | See section 6 |
| `lazy-lib.js` | Loads mermaid and D3 on first use, once | Keeps both out of the shell; see section 10 |
| `theme.js` | Light/dark toggle, persistence, `theme` event | Sets `data-theme` on `<html>` |

### Dependency rule

Anything that touches the outside world — storage, workers, timers, `performance.now`, the DOM —
is reached through a small interface object created in one place and passed in. Sections receive
what they need as a single options object (the four-parameter rule). That is what makes the
`node --test` suites possible without jsdom.

---

## 4. Section anatomy

Every section is the same five things, in the same order, so a reader who has used one has used
all of them:

1. **Orientation** — three to six sentences: what the thing is, what problem it solves, and the one
   misconception experienced engineers usually carry about it.
2. **Interactive demo** — the mechanism, manipulable. Controls left, visualisation right.
3. **Code lab** — the real implementation, editable and runnable, with graded exercises.
4. **Concepts and worked examples** — terminology with a plain and a formal statement; worked
   examples that show the arithmetic with real numbers, step by step.
5. **Reference** — formulation, invariants, complexity table, failure modes, real-world uses,
   primary sources.

File split per section:

```
src/js/sections/<id>-template.js   pure markup string, no logic, no state
src/js/sections/<id>-section.js    controller: register, render on first nav, bind, draw
src/js/algorithms/<name>.js        the logic being taught — pure, DOM-free, unit tested
src/js/viz/<name>-view.js          the drawing — takes data, returns/updates SVG or Canvas
src/js/content/{concepts,examples,reference,exercises}-<group>.js
```

A section controller never contains the algorithm, and an algorithm module never touches the DOM.
That separation is what lets `tests/unit/` cover the teaching material itself.

---

## 5. The runnable-code engine

The differentiator of this platform: everything is runnable, and the learner can edit it.

```
CodeLab (component)
   |-- editor      textarea + highlighted <pre> overlay + line numbers (utils/js-highlight.js)
   |-- toolbar     Run | Reset | Solution | Step | Speed
   |-- console     captured stdout/stderr, structured, virtualised
   |-- verdict     per-exercise assertion results
             |
             v
   Runner (interface)
   |-- WorkerBackend   default: Blob-URL worker, hard timeout, terminate on overrun
   |-- InlineBackend   test double and last-resort fallback; identical message protocol
```

**Protocol.** The host posts `{ type: 'run', code, entry, args, seed, limits }`. The worker replies
with a stream of `{ type: 'log' | 'trace' | 'metric' | 'done' | 'error' }`. Every message is
structured-cloneable; nothing holds a reference to a DOM node.

**Safety.** A run gets a wall-clock budget (2s default, per-section override) and a step budget.
Overrun terminates the worker and reports `timeout`. Workers are pooled and reused; a terminated
worker is replaced. Learner code cannot reach the page, storage or the network.

**Measurement, honestly.** Complexity demos do not parse or rewrite learner code to count
operations. They hand the algorithm instrumented primitives — `ops.cmp(a, b)`, `ops.swap(i, j)`, an
instrumented array proxy with read/write counters, an instrumented cache, an instrumented
allocator — and count what actually passes through them. Each readout names the counter it shows.
Wall-clock timings are reported as a median over repeated runs, with the run count visible, never
a single sample and never compared across machines.

**Determinism.** The worker receives a seed and exposes `rng()` from `utils/random.js`. Two runs
with the same seed produce the same trace, which is what makes "change one line and compare" work
as a teaching device.

**Exercises.** An exercise is data: `{ id, prompt, starter, solution, tests: [{ name, assert }] }`.
Tests run in the same worker against the learner's export. A test is a pure function over the
learner's function — no DOM, no timing-based assertions, no network.

---

## 6. Diagrams and visualisation

**mermaid** for structure that does not animate: state machines, pipelines, protocol exchanges,
module relationships, memory layouts, decision trees, sequence diagrams. Rendered through
`core/mermaid-renderer.js`, which initialises mermaid with `startOnLoad: false`, renders on demand,
caches by definition hash, and re-renders every visible diagram on the `theme` event using
`themeVariables` read from the CSS custom properties — so a diagram never carries a hard-coded
colour.

**D3** for charts and anything data-driven the learner manipulates: array bars, tree nodes, graph
canvases, pipeline stage timelines, page tables, packet timelines, latency distributions, growth
curves. D3 is used for what it is good at — scales, axes, shapes, transitions, and the layout
algorithms (force, hierarchy, treemap, quadtree, contours) — not as a rendering framework. Every
renderer lives in its own file under `src/js/viz/` and exposes `render(container, data, options)`
and `update(data)`, so animation re-binds data rather than rebuilding the DOM.

The D3 modules actually in use are: `d3-selection`, `d3-transition`, `d3-scale`, `d3-axis`,
`d3-shape`, `d3-array`, `d3-format`, `d3-force` (graph and topology views in M13, M14, M48, M54,
M56), `d3-hierarchy` (trees in M04, M06, M09, M25, M29), `d3-quadtree` (hit testing in M08, M16),
`d3-contour` (optimisation surfaces in M18), `d3-drag` and `d3-zoom`. Vendor the full
`d3.v7.min.js` for convenience, or a trimmed bundle of exactly that list once the set stops moving.

**`viz/chart-base.js`** is the only place that knows about margins, responsive resize, axis styling
and theme colours. A renderer that hand-rolls its own margin convention or reads a colour from
anywhere but the palette is a review failure — a single hue cannot pass contrast in both themes, so
colours come from `utils/palette.js` or the `--hue-*` CSS variables.

**Canvas** where the element count goes past a few thousand: cache heat maps, memory maps,
particle-scale simulations, large point clouds. D3's scales and layouts still do the maths there;
only the drawing changes.

Text inside SVG uses the `.chart-text` class, never a `fill` literal, so it follows the theme. Text
drawn on a fixed-colour shape takes its colour from `Palette.readableOn(fill)`. Both rules are
checked by the contrast probe (section 9), which measures an SVG label against the shape actually
painted behind it.

---

## 7. Content as data

Concepts, worked examples, reference entries and exercises are data files, not markup, registered
into four registries keyed by section id. That is what makes coverage testable:
`tests/unit/content-coverage.test.js` fails when a section in the curriculum has no concepts, no
reference entry, or fewer than the required number of worked-example steps.

Shape, abridged:

```js
ReferenceRegistry.register({
  'hash-tables': {
    summary: '...',
    intuition: '...',
    formulation: { equations: [{ label, expr, terms: [{ sym, meaning }] }], derivation: [] },
    invariants: [{ name, why, breaks }],
    complexity: [{ operation, average, worst, note }],
    failureModes: [{ symptom, cause, fix }],
    inTheWild: [{ system, how }],
    sources: [{ title, where }]
  }
});
```

Worked examples carry `{ do, why, work, result }` per step, where `work` contains the actual
arithmetic with real numbers. Where a worked example states a computed figure, a unit test
recomputes it independently, so editing the setup without editing the numbers fails the build.

---

## 8. Testing

| Command | What it does |
|---|---|
| `npm test` | wiring audit, then `node --test tests/unit/*.test.js` |
| `npm run lint:size` | reports files over 1000 lines and functions over 50 lines; fails on new offenders |
| `npm run build:css` | Tailwind build; run after any markup change |

**Wiring audit** — a static pass over `index.html` and every module that fails on: dead controls (a
handler with no matching id), dangling selectors (an id used by JS that no template emits), unknown
events, duplicate ids, a missing `#<id>-content` container, inline scripts, a curriculum section
with no registered module, and a registered module with no curriculum entry.

**Unit tests** cover the algorithm and machine modules directly: sorting stability, tree balance
invariants after randomised operation sequences, automaton equivalence after minimisation, parser
round-trips, allocator invariants, scheduler fairness, congestion-window trajectories, consensus
safety under a scripted partition. Model-level properties are asserted with property-based loops
over a seeded generator, not a handful of examples.

**Section smoke tests** fire each section's `navigation` subscriber against DOM and Runner doubles,
so every render path executes at least once in CI.

---

## 9. Accessibility and theming

Two themes, both required to pass WCAG AA for every text/background pair; contrast is checked by
`tests/browser/contrast-probe.js` rather than assumed. Every interactive control is reachable by
keyboard, each demo canvas exposes a text summary of its current state for screen readers, and no
colour is the only carrier of meaning — shape, label or pattern always doubles it.

---

## 10. Performance budget

| Budget | Value |
|---|---|
| Initial HTML + CSS + JS parsed before first paint | < 400 KB. mermaid loads on first diagram, D3 on first chart — neither is in the shell |
| Section activation to first draw | < 100 ms |
| Worker run wall clock | 2 s default, per-section override, hard terminate |
| Frame budget during animation | 16 ms; simulations yield, never block |

Long-running simulations yield with `setTimeout`, not `requestAnimationFrame`, so they still
complete in a background tab.
