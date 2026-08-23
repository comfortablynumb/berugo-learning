/**
 * SectionShell - renders the three-tab frame every section shares.
 *
 * A section supplies its orientation text, its demo markup and its diagram;
 * the shell adds the code labs, concepts, worked examples and reference from
 * the content registries and wires the labs to the runner. That is why a new
 * section is "logic + template + content" and never "plumbing".
 *
 * The frame is three tabs, in this order, and Description is the one that
 * opens:
 *
 *   Description - orientation, every concept explained in full, the diagram
 *                 and the senior insight. What the section teaches.
 *   Examples    - the interactive demo and its charts, the worked examples
 *                 with their arithmetic, and the graded code lab.
 *   References  - the reference block: formulation, costs, invariants,
 *                 failure modes, where it shows up in the wild, and sources.
 *
 * A part that has no content drops its tab rather than opening empty, so the
 * home and settings pages - which have orientation and nothing else - render
 * as a plain page with no strip at all.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.SectionShell = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  /* The shell reaches for browser globals (jQuery, the registries, the content
     renderers). They are read through this indirection so the node smoke test
     can supply doubles - the alternative is that the shell's wiring is only
     ever exercised in a browser, which is how the mount() bug got in. */
  let host = scope;

  function esc(value) {
    return host.Helpers.escapeHtml(value);
  }

  /* Orientation and the insight are prose the learner meets before any
     concept, so they get their own annotator rather than sharing one: a symbol
     first met in the opening paragraph should be decoded there too. */
  function mark(sectionId) {
    return host.NotationMarkup.createAnnotator({ sectionId: sectionId });
  }

  function orientation(paragraphs, sectionId) {
    if (!paragraphs || !paragraphs.length) return '';
    const annotate = mark(sectionId);
    return '<div class="section-orientation">' +
      paragraphs.map(function (text) { return '<p>' + annotate.annotate(text) + '</p>'; }).join('') +
      '</div>';
  }

  function demo(config) {
    if (!config || !config.markup) return '';
    return '<section class="section-block">' +
      '<h3>' + esc(config.title || 'Interactive demo') + '</h3>' +
      config.markup +
      '</section>';
  }

  function diagram(config, sectionId) {
    if (!config) return '';
    return '<section class="section-block">' +
      '<h3>' + esc(config.title || 'Diagram') + '</h3>' +
      '<div class="card"><div class="card-body">' +
      '<div id="diagram-' + esc(sectionId) + '" class="mermaid-host"></div>' +
      (config.caption ? '<p class="note">' + esc(config.caption) + '</p>' : '') +
      '</div></div>' +
      '</section>';
  }

  function labs(exercises) {
    if (!exercises || !exercises.length) return '';
    return '<section class="section-block">' +
      '<h3>Code lab</h3>' +
      exercises.map(function (exercise) { return host.CodeLab.markup(exercise); }).join('') +
      '</section>';
  }

  function insight(text, sectionId) {
    if (!text) return '';
    return '<div class="insight"><strong>Senior insight.</strong> ' +
      mark(sectionId).annotate(text) + '</div>';
  }

  function navLinks(sectionId) {
    const prev = host.Curriculum.prev(sectionId);
    const next = host.Curriculum.next(sectionId);
    return '<nav class="section-nav">' +
      (prev ? '<a class="btn btn-sm" href="#' + prev.id + '">← ' + esc(prev.title) + '</a>' : '<span></span>') +
      (next ? '<a class="btn btn-sm" href="#' + next.id + '">' + esc(next.title) + ' →</a>' : '<span></span>') +
      '</nav>';
  }

  function describe(config, sectionId) {
    return orientation(config.orientation, sectionId) +
      host.SectionConcepts.markup(host.ConceptRegistry.get(sectionId), { sectionId: sectionId }) +
      diagram(config.diagram, sectionId) +
      insight(config.insight, sectionId);
  }

  function exemplify(config, sectionId, exercises) {
    return demo(config.demo) +
      host.SectionExamples.markup(host.ExampleRegistry.get(sectionId)) +
      labs(exercises);
  }

  /** The three panels, in order, with the empty ones dropped. */
  function tabsFor(config, sectionId, exercises) {
    return [
      { id: 'description', label: 'Description', panelClass: 'panel-prose',
        content: describe(config, sectionId) },
      { id: 'examples', label: 'Examples', content: exemplify(config, sectionId, exercises) },
      { id: 'references', label: 'References',
        content: host.SectionReference.markup(host.ReferenceRegistry.get(sectionId)) }
    ].filter(function (tab) { return Boolean(tab.content); });
  }

  /* The panel class carries the section id because TabController hides panels
     by selector: one shared class and opening a tab here would hide the panel
     of every other section already in the DOM. */
  function tabOptions(sectionId, tabs) {
    return {
      stripId: 'tabs-' + sectionId,
      stripExtraClass: 'section-tabs',
      panelPrefix: 'panel-' + sectionId + '-',
      panelClass: 'tabpanel-' + sectionId,
      panelExtraClass: 'section-tabpanel',
      tabs: tabs
    };
  }

  /* The config a section rendered with is remembered here, so mount() cannot be
     handed a different one. An earlier version took the config twice and the
     diagram silently never rendered: the two calls had drifted. */
  const configs = new Map();

  function render(config) {
    const sectionId = config.sectionId;
    const exercises = host.ExerciseRegistry.get(sectionId) || [];
    configs.set(sectionId, config);

    const tabs = tabsFor(config, sectionId, exercises);
    const body = tabs.length > 1
      ? host.TabController.markup(tabOptions(sectionId, tabs))
      : (tabs.length ? tabs[0].content : '');

    return body + navLinks(sectionId);
  }

  function mountLabs(sectionId, exercises, app) {
    exercises.forEach(function (exercise) {
      host.CodeLab.mount({
        exercise: exercise,
        sectionId: sectionId,
        runner: app.runner,
        storage: app.storage,
        onResult: function (result) {
          app.progress.recordLab(sectionId, exercise.id, {
            passed: result.ok && result.total > 0,
            total: result.total,
            passedCount: result.passedCount
          });
        }
      });
    });
  }

  function mountDiagram(sectionId, config, app) {
    if (!config.diagram || !config.diagram.definition) return false;
    const diagramHost = host.jQuery('#diagram-' + sectionId)[0];
    if (!diagramHost) throw new Error('section ' + sectionId + ' declares a diagram but rendered no host');
    app.mermaid.render(diagramHost, config.diagram.definition);
    return true;
  }

  /* A chart drawn while its tab was hidden measured no width, so every chart
     that is now on screen is repainted when the learner switches tab. */
  function mountTabs(sectionId) {
    return host.TabController.init(Object.assign(tabOptions(sectionId, []), {
      onChange: function () {
        if (host.ChartBase) host.ChartBase.refreshVisible();
      }
    }));
  }

  /* Notation chips explain themselves through a CSS panel, and only a browser
     can say whether that panel would run off the column. This is that measure. */
  function mountNotation(sectionId) {
    const container = host.jQuery('#' + sectionId + '-content')[0];
    host.NotationPanel.watch();
    return host.NotationPanel.place(container);
  }

  /** Mounts everything the shell owns: labs, the diagram, then the tab strip.
   *  Sections call this after injecting the rendered markup, then wire their
   *  own demo. Takes only { sectionId, app }: the rest comes from the config
   *  the section rendered with. */
  function mount(options) {
    const sectionId = options.sectionId;
    const app = options.app;
    const config = configs.get(sectionId) || {};
    const exercises = host.ExerciseRegistry.get(sectionId) || [];

    mountLabs(sectionId, exercises, app);
    const drewDiagram = mountDiagram(sectionId, config, app);
    const tabs = mountTabs(sectionId);
    const flipped = mountNotation(sectionId);

    return { labs: exercises.length, diagram: drewDiagram, tabs: tabs, notation: flipped };
  }

  return {
    render: render,
    mount: mount,
    configFor: function (id) { return configs.get(id) || null; },
    /** Test-only: swap the browser globals for doubles. */
    __setHostForTests: function (next) { host = next; configs.clear(); }
  };
}));
