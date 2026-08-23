'use strict';

/**
 * Smoke test for the section frame.
 *
 * This exists because of a real bug: the diagram config was passed to render()
 * and a *different* object to mount(), so no diagram ever rendered and nothing
 * failed. The shell now remembers the config it rendered with, and these tests
 * hold that contract from node, against doubles.
 *
 * The frame is three tabs - Description, Examples, References - and the tests
 * below pin which block lands in which panel, that Description is the one that
 * opens, and that switching tab repaints the charts that were hidden while
 * they drew.
 */

const test = require('node:test');
const assert = require('node:assert');

const SectionShell = require('../../src/js/components/section-shell.js');
const TabController = require('../../src/js/components/tab-controller.js');
const Curriculum = require('../../src/js/core/curriculum.js');
const Helpers = require('../../src/js/utils/helpers.js');
const NotationMarkup = require('../../src/js/utils/notation-markup.js');
const NotationPanel = require('../../src/js/components/notation-panel.js');

function makeHost(options) {
  const settings = options || {};
  const exercises = settings.exercises || [];

  return {
    Helpers: Helpers,
    Curriculum: Curriculum,
    CodeLab: {
      markup: function (exercise) { return '<div class="code-lab" data-lab="' + exercise.id + '"></div>'; },
      mounted: [],
      mount: function (config) { this.mounted.push(config.exercise.id); }
    },
    TabController: {
      markup: TabController.markup,
      initCalls: [],
      init: function (options) {
        this.initCalls.push(options);
        return { activate: function () {}, current: function () { return 'description'; } };
      }
    },
    ChartBase: { repaints: 0, refreshVisible: function () { this.repaints += 1; return this.repaints; } },
    NotationMarkup: NotationMarkup,
    NotationPanel: NotationPanel,
    SectionConcepts: { markup: function (entries) { return entries ? '<concepts n="' + entries.length + '">' : ''; } },
    SectionExamples: { markup: function (entries) { return entries ? '<examples n="' + entries.length + '">' : ''; } },
    SectionReference: { markup: function (entry) { return entry ? '<reference>' : ''; } },
    ConceptRegistry: { get: function () { return settings.concepts || null; } },
    ExampleRegistry: { get: function () { return settings.examples || null; } },
    ReferenceRegistry: { get: function () { return settings.reference || null; } },
    ExerciseRegistry: { get: function () { return exercises; } },
    jQuery: function (selector) {
      const found = settings.missingHost ? [] : [{ selector: selector }];
      return found;
    }
  };
}

function makeApp() {
  return {
    runner: {},
    storage: null,
    progress: { recordLab: function () {} },
    mermaid: { calls: [], render: function (host, definition) { this.calls.push({ host: host, definition: definition }); } }
  };
}

function fullSection() {
  return {
    sectionId: 'code-engine',
    orientation: ['first', 'second'],
    demo: { title: 'Demo', markup: '<div id="demo"></div>' },
    diagram: { title: 'Diagram', definition: 'graph TD; A-->B;' },
    insight: 'the insight'
  };
}

function panelOf(html, sectionId, tabId) {
  const open = html.indexOf('id="panel-' + sectionId + '-' + tabId + '"');
  assert.ok(open !== -1, 'no ' + tabId + ' panel');
  const next = html.indexOf('id="panel-' + sectionId + '-', open + 1);
  return html.slice(open, next === -1 ? html.length : next);
}

test('shell: a teaching section renders exactly the three tabs, Description first', function () {
  const host = makeHost({ concepts: [{}, {}], examples: [{}], reference: {}, exercises: [{ id: 'lab-1' }] });
  SectionShell.__setHostForTests(host);

  const html = SectionShell.render(fullSection());

  const order = ['>Description<', '>Examples<', '>References<'];
  let cursor = -1;
  order.forEach(function (needle) {
    const at = html.indexOf(needle);
    assert.ok(at > cursor, needle + ' is missing or out of order');
    cursor = at;
  });

  assert.strictEqual((html.match(/role="tab"/g) || []).length, 3, 'three tabs, no more');
  assert.strictEqual((html.match(/role="tabpanel"/g) || []).length, 3);
  assert.ok(html.indexOf('id="panel-code-engine-description" role="tabpanel"' +
    ' aria-labelledby="panel-code-engine-description-tab">') !== -1,
    'the Description panel opens: it is the only one without hidden');
  assert.strictEqual((html.match(/hidden>/g) || []).length, 2, 'the other two start hidden');
});

test('shell: each block lands in the panel that owns it', function () {
  const host = makeHost({ concepts: [{}, {}], examples: [{}], reference: {}, exercises: [{ id: 'lab-1' }] });
  SectionShell.__setHostForTests(host);

  const html = SectionShell.render(fullSection());
  const description = panelOf(html, 'code-engine', 'description');
  const examples = panelOf(html, 'code-engine', 'examples');
  const references = panelOf(html, 'code-engine', 'references');

  ['section-orientation', '<concepts', 'diagram-code-engine', 'insight'].forEach(function (needle) {
    assert.ok(description.indexOf(needle) !== -1, needle + ' belongs in Description');
    assert.ok(examples.indexOf(needle) === -1 && references.indexOf(needle) === -1,
      needle + ' must appear once, in Description only');
  });

  ['id="demo"', '<examples', 'code-lab'].forEach(function (needle) {
    assert.ok(examples.indexOf(needle) !== -1, needle + ' belongs in Examples');
    assert.ok(description.indexOf(needle) === -1, needle + ' must not also be in Description');
  });

  assert.ok(references.indexOf('<reference') !== -1);
});

test('shell: the concepts land in Description in the order the registry gives them', function () {
  const host = makeHost({ concepts: [{}, {}, {}], reference: {}, exercises: [] });
  SectionShell.__setHostForTests(host);

  const html = SectionShell.render({ sectionId: 'code-engine', orientation: ['x'] });
  assert.ok(panelOf(html, 'code-engine', 'description').indexOf('<concepts n="3">') !== -1,
    'every concept the section registers is rendered, not a subset');
});

test('shell: a page with only one part renders no tab strip at all', function () {
  SectionShell.__setHostForTests(makeHost({ exercises: [] }));

  const html = SectionShell.render({ sectionId: 'home', orientation: ['just text'] });

  assert.ok(html.indexOf('role="tablist"') === -1, 'home has orientation and nothing else');
  assert.ok(html.indexOf('section-orientation') !== -1);
});

test('shell: switching tab repaints the charts that drew while hidden', function () {
  const host = makeHost({ concepts: [{}], examples: [{}], reference: {}, exercises: [] });
  SectionShell.__setHostForTests(host);
  const app = makeApp();

  SectionShell.render(fullSection());
  const result = SectionShell.mount({ sectionId: 'code-engine', app: app });

  assert.ok(result.tabs, 'the strip is wired at mount');
  const options = host.TabController.initCalls[0];
  assert.strictEqual(options.stripId, 'tabs-code-engine');
  assert.strictEqual(options.panelClass, 'tabpanel-code-engine',
    'the panel selector carries the section id, or one section hides another');

  assert.strictEqual(host.ChartBase.repaints, 0);
  options.onChange('examples');
  assert.strictEqual(host.ChartBase.repaints, 1, 'the demo charts are repainted when shown');
});

test('shell: mount renders the diagram the section declared at render time', function () {
  const host = makeHost({ exercises: [] });
  SectionShell.__setHostForTests(host);
  const app = makeApp();

  SectionShell.render({
    sectionId: 'code-engine',
    diagram: { definition: 'sequenceDiagram\n A->>B: hi' }
  });
  const result = SectionShell.mount({ sectionId: 'code-engine', app: app });

  assert.strictEqual(result.diagram, true);
  assert.strictEqual(app.mermaid.calls.length, 1, 'the diagram must actually be rendered');
  assert.match(app.mermaid.calls[0].definition, /sequenceDiagram/);
});

test('shell: a section with no diagram calls the renderer not at all', function () {
  const host = makeHost({ exercises: [] });
  SectionShell.__setHostForTests(host);
  const app = makeApp();

  SectionShell.render({ sectionId: 'home', orientation: ['just text'] });
  const result = SectionShell.mount({ sectionId: 'home', app: app });

  assert.strictEqual(result.diagram, false);
  assert.strictEqual(app.mermaid.calls.length, 0);
});

test('shell: a declared diagram with no host fails loudly instead of silently', function () {
  const host = makeHost({ exercises: [], missingHost: true });
  SectionShell.__setHostForTests(host);
  const app = makeApp();

  SectionShell.render({ sectionId: 'code-engine', diagram: { definition: 'graph TD; A-->B;' } });

  assert.throws(function () {
    SectionShell.mount({ sectionId: 'code-engine', app: app });
  }, /declares a diagram but rendered no host/);
});

test('shell: every exercise the section declares is mounted exactly once', function () {
  const host = makeHost({ exercises: [{ id: 'one' }, { id: 'two' }] });
  SectionShell.__setHostForTests(host);
  const app = makeApp();

  SectionShell.render({ sectionId: 'code-engine' });
  const result = SectionShell.mount({ sectionId: 'code-engine', app: app });

  assert.strictEqual(result.labs, 2);
  assert.deepStrictEqual(host.CodeLab.mounted, ['one', 'two']);
});

test('shell: a lab result is recorded against the section that owns it', function () {
  const host = makeHost({ exercises: [{ id: 'one' }] });
  SectionShell.__setHostForTests(host);

  const recorded = [];
  const app = makeApp();
  app.progress.recordLab = function (sectionId, labId, outcome) {
    recorded.push([sectionId, labId, outcome.passed]);
  };

  let captured = null;
  host.CodeLab.mount = function (config) { captured = config; };

  SectionShell.render({ sectionId: 'code-engine' });
  SectionShell.mount({ sectionId: 'code-engine', app: app });

  captured.onResult({ ok: true, total: 3, passedCount: 3 });
  captured.onResult({ ok: true, total: 0, passedCount: 0 });

  assert.deepStrictEqual(recorded, [
    ['code-engine', 'one', true],
    ['code-engine', 'one', false]
  ], 'a run with no tests is not a pass');
});

test('shell: prev/next links come from the curriculum, not from the section', function () {
  SectionShell.__setHostForTests(makeHost({ exercises: [] }));
  const html = SectionShell.render({ sectionId: 'code-engine' });
  const next = Curriculum.next('code-engine');
  const prev = Curriculum.prev('code-engine');

  assert.ok(html.indexOf('href="#' + next.id + '"') !== -1);
  assert.ok(html.indexOf('href="#' + prev.id + '"') !== -1);
});

test('shell: orientation text is escaped, so content cannot inject markup', function () {
  SectionShell.__setHostForTests(makeHost({ exercises: [] }));
  const html = SectionShell.render({
    sectionId: 'code-engine',
    orientation: ['<img src=x onerror="alert(1)">']
  });

  assert.ok(html.indexOf('<img') === -1);
  assert.ok(html.indexOf('&lt;img') !== -1);
});
