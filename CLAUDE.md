# Berugo Learning - Project Context

## Purpose
Browser-only interactive platform where senior engineers learn and *practise* computer science
and systems engineering: algorithms, data structures, automata and language theory, compilers,
computer architecture, operating systems, networking, data systems, distributed systems and
engineering craft. Every section is three tabs: **Description** (orientation, every concept
explained in full, diagram, insight), **Examples** (runnable demo with charts, worked examples,
graded code lab) and **References** (the structured reference block).

## Status
**M00–M06 are built and verified in a browser** (58 sections, tree green), each carrying 8+ concepts
with full explanations, two worked examples, a reference entry and a graded exercise. `doc/BUILD-STATE.md`
records what shipped and what the next session picks up. The rest of the curriculum follows the
order in `doc/ROADMAP.md` (65 milestones in `doc/milestones/`). Keep `npm test` and
`npm run lint:size` green at every step, and update the README status block and
`doc/BUILD-STATE.md` as milestones land.

## Tech stack
- **UI:** jQuery + Tailwind CSS (compiled to `lib/tailwind.css` by `npm run build:css`)
- **Diagrams:** mermaid.js for structural/state diagrams (no animation).
- **Charts and data-driven visuals:** D3 v7 through `viz/chart-base.js` (scales, axes, shapes,
  transitions, force/hierarchy/quadtree/contour layouts); Canvas past a few thousand elements.
  Both mermaid and D3 load on first use, never in the shell.
- **Execution:** learner code and demo algorithms run in a Web Worker sandbox
  (`src/js/core/runner.js`) with a hard timeout, captured console and streamed trace events.
- **Storage:** `localStorage` behind `core/storage-adapter.js` (theme, progress, exercise state).
- **Dependencies:** vendored into `lib/`. The app runs offline, but must be *served*
  (`npm start`) - Workers do not start from `file://`.

## Project structure
```
berugo-learning/
├── index.html            # shell only: sidebar mount, header, one empty container per section
├── manifest.webmanifest  # installable app metadata; icons live in assets/
├── sw.js                 # service worker: network-first, cache fallback (offline)
├── assets/               # icon-192.png, icon-512.png (generated PNGs, no build step)
├── lib/                  # vendored jquery / mermaid / d3 + built tailwind.css
├── src/
│   ├── css/              # main.css @imports base, theme-dark, theme-light, layout,
│   │                     #   components, code-lab, viz, content
│   └── js/
│       ├── core/         # curriculum, section-registry, navigation, state, runner,
│       │                 #   progress, storage-adapter, theme, text-scale, search-index,
│       │                 #   installer, mermaid-renderer
│       ├── algorithms/   # pure implementations, no DOM, unit tested
│       ├── machines/     # simulators: CPU, cache, scheduler, VM, TCP, Raft, ...
│       ├── viz/          # chart-base + D3/Canvas renderers, one concern per file
│       ├── sections/     # <id>-template.js (markup) + <id>-section.js (controller)
│       ├── content/      # concepts-*.js, examples-*.js, reference-*.js, exercises-*.js
│       ├── components/   # section-shell (three-tab frame), tab-controller, code-lab,
│       │                 #   control-panel, metric-grid, section-{concepts,examples,reference}
│       └── utils/        # helpers, palette, format, random, js-highlight
├── tests/                # wiring-audit.js, file-size-check.js, unit/
└── doc/                  # ROADMAP.md, architecture.md, topic-suggestions.md, milestones/
```

## Architecture rules
- **`core/curriculum.js` is the single source of syllabus truth.** The sidebar, header title,
  home map, search index and prev/next links are *rendered from it* - there is no hand-written nav
  to drift.
- **The sidebar shows tracks, not sections.** Two collapse levels (track -> milestone -> sections),
  accordion (one of each open at a time); the current section's pair opens on arrival and stays
  where the learner leaves it.
- **Unbuilt tracks are in `curriculum.js` too**, as `planned: [{ id, title, sections }]` with no
  `sections` array. `sections()` walks `groups` only, so the wiring audit, search index and
  prev/next never see them - but the sidebar and the home map do. `builtCount(track)` and
  `plannedCount(track)` report the two numbers.
- **Header chrome:** global search (`core/search-index.js` + `views/search-view.js`), text scale
  (`core/text-scale.js`, one `--text-scale` multiplier on the root font size), theme, install.
- **Sections self-register.** `SectionRegistry.register({ id, init })`; `app.js` only calls
  `SectionRegistry.initAll()`. Never add a per-section call to `app.js`.
- **One activation event: `navigation`.** `StateManager.emit('navigation', { section })`.
  A section renders its template into `#<id>-content` on first activation, then binds.
- **All markup lives in `sections/<id>-template.js`.** `index.html` stays a shell.
- **Nothing runs learner code on the main thread.** Go through `Runner`, which is an interface
  with a Worker backend and an inline backend so tests can mock it.
- **Charts go through `viz/chart-base.js`** for margins, resize, axes and theme colours. A
  renderer with its own margin convention or a colour literal is a review failure.
- **Colours come from `utils/palette.js` or `--hue-*` CSS variables**, never literals, and
  Tailwind class names are written in full (composed names get purged).
- **Mermaid renders through `core/mermaid-renderer.js`**, which re-renders on theme change.
- **Seeded randomness comes from `utils/random.js`** so a learner can compare two runs.
- **`SectionShell.render(config)` then `SectionShell.mount({ sectionId, app })`.** The shell keeps
  the config from render; never pass it twice.
- **The section frame is three tabs and the shell owns them.** Description (orientation, concepts,
  diagram, insight), Examples (demo, worked examples, code lab), References. A section never builds
  a strip: `components/tab-controller.js` is the only tab implementation, and its `panelClass`
  carries the section id because it hides panels by selector. Switching tab calls
  `ChartBase.refreshVisible()`, since a chart drawn in a hidden panel measured no width.
- **Every concept needs a `detail` paragraph** (>= 240 characters, enforced by
  `content-coverage.test.js`): the mechanism, why it is built that way, what breaks without it.
  `plain` is the one-line gloss; `detail` is the teaching.
- **jQuery is the UI layer** (events, DOM, values). Logic modules stay DOM-free so `node --test`
  can load them directly.
- Global rules apply: interfaces for dependencies, functions <= 50 lines, files < 1000 lines,
  <= 4 parameters, no test touching a real filesystem/network/DOM-less-than-a-double.

## Commands
```
npm start           # serve on :3002 (required - Workers need http://)
npm test            # wiring audit + unit tests
npm run lint:size   # file/function size report
npm run build:css   # after any markup or template change
```

## Adding a section
1. `algorithms/<name>.js` or `machines/<name>.js` for the logic (pure, unit-tested).
2. `sections/<id>-template.js` + `sections/<id>-section.js` (calls `SectionRegistry.register`).
3. Add the entry to `core/curriculum.js` in the right group - the sidebar follows automatically.
4. Add `concepts` (>= 6, each with `term`, `plain`, `formal`, `detail`, `example`), `examples`
   (>= 2), `reference` (>= 3 sources, >= 3 failure modes) and `exercises` entries in
   `src/js/content/`. The coverage test enforces those floors. Concepts are split per half-milestone
   (`concepts-linear.js` / `concepts-linear-buffers.js`) to stay under 1 000 lines.
5. Add the script tags to `index.html` (the wiring audit fails on an unloaded module, and the
   content coverage and exercise tests discover the new content files on their own).
6. Add module property tests in `tests/unit/<topic>-modules.test.js`, and recompute every figure
   the worked examples quote in `tests/unit/worked-examples-<topic>.test.js`.
7. `npm test && npm run build:css`, then open the section in Chrome and run its exercise.
