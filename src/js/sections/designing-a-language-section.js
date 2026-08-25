/**
 * Section: Designing the language.
 *
 * The measurement is the cost table. Every feature is scored twice — units of
 * work in the parser, and units of work in every stage after it — and the two
 * columns disagree in a way that is the whole point of the section. Pattern
 * matching costs 4 in the parser and 5 afterwards; annotations cost 1 and 1.
 * A feature is cheap where you write it and expensive where you have to keep
 * it working, and the ratio column is where that becomes visible before
 * anything is committed to.
 *
 * The second measurement is coverage: every feature must be exercised by at
 * least one conformance program, and the table says which. A spec with a
 * feature nothing runs is a spec with a feature nobody has checked.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'designing-a-language';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — source to execution, and what this milestone owns',
      caption: 'Ten stages across four milestones, each a pure function of the one before it. ' +
        'M28 owns the five on the left: text becomes tokens, tokens become a tree, the tree ' +
        'gains a binding table and a type table, and then it is lowered to a smaller core. ' +
        'Everything to the right of the core is a later milestone, and the reason the core is ' +
        'the boundary is that it is the last representation a human would recognise as their ' +
        'program. The shading is the point of drawing it now: a feature added to the surface ' +
        'language creates work in every shaded box AND in every unshaded one, and the cost ' +
        'table below scores both.',
      definition: [
        'graph LR',
        'S["source text"] --> L["lex — 28.2"]',
        'L --> P["parse — 28.3"]',
        'P --> A["AST tools — 28.4"]',
        'A --> R["resolve — 28.5"]',
        'R --> T["typecheck — 28.6"]',
        'T --> D["desugar to core — 28.7"]',
        'D --> I["IR and SSA — M29"]',
        'I --> O["optimise — M29"]',
        'O --> C["bytecode and JIT — M30"]',
        'C --> G["collect — M31"]',
        'classDef here fill:#dbeafe,stroke:#1d4ed8,stroke-width:2px;',
        'classDef later fill:#f1f5f9,stroke:#94a3b8,stroke-dasharray:4 3;',
        'class L,P,A,R,T,D here;',
        'class I,O,C,G later;'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A language specification is a deliverable, not a preamble.** Berugo\'s spec is a data ' +
        'file: every feature carries its grammar production, its typing rule, its evaluation ' +
        'rule and a runnable example, and the browser above renders that file rather than a ' +
        'description of it. The consequence is that the spec cannot drift — the conformance ' +
        'suite runs the examples, and a test asserts that every stage the spec names exists.',
      '**Four rules per feature, and each one is a different question.** The grammar says what ' +
        'you may write; the typing rule says when it is meaningful; the evaluation rule says ' +
        'what it does; the example says what it looks like. Most language arguments are two ' +
        'people answering different ones of those four, and writing all four down is what ends ' +
        'the argument.',
      '**A feature is cheap in the parser and expensive in the optimiser.** That is the ' +
        'sentence the cost table exists to make concrete. `match` is four units of parser work ' +
        'and five units afterwards — exhaustiveness checking, decision-tree compilation, and ' +
        'every later pass that has to preserve the tree. Annotations are one and one. Deciding ' +
        'where the cost lands is language design, and it is much cheaper to decide it here ' +
        'than after three milestones of implementation depend on the answer.',
      '**The non-goals are part of the spec and are written down.** v1 has no exceptions and no ' +
        'mutation of captured variables. Both are deferred to a named milestone for a named ' +
        'reason — exceptions need stack unwinding, which M30 will have a call stack for; ' +
        'mutable capture forces boxing or escape analysis, which is M29\'s subject. A language ' +
        'with no stated non-goals grows one feature at a time until nobody can say what it is.',
      '**Every feature must be covered by a conformance program, and coverage is a column.** ' +
        'The suite is fifteen programs and each one names the features it exercises. A feature ' +
        'covered by nothing is a feature nobody has run, which in practice means a feature that ' +
        'does not work — and the table reports that as a gap rather than leaving it to be ' +
        'discovered three stages later.',
      '**Versioning is a design decision made now.** The spec is labelled `Berugo v1 (M28)` ' +
        'because M29 will add mutable capture and M30 will add exceptions, and each of those ' +
        'changes what earlier stages must handle. Naming the version means a golden file can ' +
        'say which language it was recorded against, instead of silently describing a language ' +
        'that no longer exists.',
      '**The pipeline diagram is the design tool, not the documentation.** Adding a feature ' +
        'means walking the diagram and asking, at each box, what changes. String interpolation ' +
        'costs the lexer a mode, the parser nothing, and the desugarer a rewrite; sum types ' +
        'cost the parser a form and the checker an exhaustiveness algorithm. Doing that walk ' +
        'before committing is the difference between a language you can finish and one you ' +
        'cannot.',
      '**Small enough to build, large enough to be interesting.** Berugo has expressions with ' +
        'precedence, let bindings, first-class functions and closures, records, arrays, sum ' +
        'types with pattern matching, three loop forms, modules and Hindley–Milner inference ' +
        'with annotations allowed. That is roughly the smallest set that forces every interesting ' +
        'problem in the next four milestones to actually arise.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the spec, and what each feature will cost',
        markup: root.DesignLanguageTemplate.render()
      },
      diagram: diagram(),
      insight: '**The feature you can add in an afternoon is the one that costs the most, ' +
        'because the afternoon is spent in the parser and the cost is paid everywhere else.** ' +
        'Pattern matching is a morning\'s work in a Pratt parser and it is the reason ' +
        'exhaustiveness checking exists, the reason the IR needs a decision tree, and the ' +
        'reason every optimisation pass has to preserve arm ordering. Nothing in the parser ' +
        'tells you that. What tells you is walking the pipeline diagram before you write the ' +
        'production and asking, box by box, what has to change — and then writing the answer ' +
        'down as a number, because "it will need some work in the back end" is not a number ' +
        'and cannot be compared against another feature\'s. The cost table above is that walk, ' +
        'done once, for eleven features. It is also why the two most valuable rows are the ' +
        'ones at the bottom: `annotations` and `literals` cost about the same everywhere, ' +
        'which is what a feature that is genuinely cheap looks like.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DesignLanguageTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const costFor = root.Helpers.memoise(function (key) {
    return root.Berugo.Spec.costTable().slice().sort(function (a, b) {
      return b[key] - a[key];
    });
  });

  const coverageFor = root.Helpers.memoise(function () {
    return root.Berugo.Spec.coverage();
  });

  const stagesFor = root.Helpers.memoise(function () {
    const byStage = root.Berugo.Spec.featuresByStage();

    return root.Berugo.Spec.STAGES.map(function (stage) {
      return Object.assign({ features: byStage[stage.id] || [] }, stage);
    });
  });

  function update() {
    const values = panel.values();

    paintMetrics();
    paintRules(values['dl-feature']);
    paintCost(values['dl-order']);
    paintStages();
    paintCoverage();
    paintGoals();
  }

  function paintMetrics() {
    const cost = costFor('total');
    const parse = cost.reduce(function (sum, row) { return sum + row.parse; }, 0);
    const later = cost.reduce(function (sum, row) { return sum + row.later; }, 0);

    root.MetricGrid.update({
      'dl-features': { value: root.Format.exact(root.Berugo.Spec.FEATURES.length),
        note: 'each carrying a grammar production, a typing rule, an evaluation rule and an example' },
      'dl-programs': { value: root.Format.exact(root.Berugo.Spec.CONFORMANCE.length),
        note: root.Berugo.Spec.ERROR_SUITE.length + ' more programs make up the error suite' },
      'dl-split': { value: parse + ' → ' + later,
        note: 'summed over all eleven features, work after the parser is ' +
          (later / parse).toFixed(2) + '× the work in it' },
      'dl-deferred': { value: root.Format.exact(root.Berugo.Spec.NON_GOALS.length),
        note: 'each deferred to a named milestone rather than left open' }
    });
  }

  function paintRules(id) {
    const feature = root.Berugo.Spec.feature(id);
    const stage = root.Berugo.Spec.stage(feature.stage);
    const rows = [
      ['Grammar', feature.grammar], ['Typing rule', feature.typing],
      ['Evaluation rule', feature.evaluation], ['Example', feature.example],
      ['First implemented in', stage.name + ' (' + stage.section + ', ' + stage.milestone + ')']
    ];

    root.jQuery('#dl-rules tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row[0]) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row[1]) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dl-rules-caption', feature.note + ' The four rules answer four ' +
      'different questions — what you may write, when it means something, what it does, and ' +
      'what it looks like — and a feature missing any one of them is a feature two people can ' +
      'implement differently while both believing they followed the spec.');
  }

  function paintCost(order) {
    const rows = costFor(order);

    root.jQuery('#dl-cost-table tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.name) + '</td><td class="mono">' +
        row.parse + '</td><td class="mono">' + row.later + '</td><td class="mono">' +
        row.total + '</td><td class="mono">' + row.ratio.toFixed(2) + '×</td><td>' +
        root.Helpers.escapeHtml(row.lands) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dl-cost-table-caption', costCaption(rows));
  }

  function costCaption(rows) {
    const worst = rows.reduce(function (best, row) {
      return row.ratio > best.ratio ? row : best;
    }, rows[0]);
    const heaviest = rows.reduce(function (best, row) {
      return row.later > best.later ? row : best;
    }, rows[0]);

    return 'The units are relative, not hours: what matters is that the two columns are ' +
      'scored separately, so a feature cannot hide its cost in the one you were not looking ' +
      'at. ' + heaviest.name + ' is the heaviest after the parser at ' + heaviest.later +
      ' units, and ' + worst.name + ' has the worst ratio at ' + worst.ratio.toFixed(2) +
      '× — every unit spent parsing it buys that much work later. Sorting by parser work ' +
      'alone gives a completely different ranking, which is exactly why a language designed ' +
      'from the parser outwards ends up with an unfinishable back end.';
  }

  function paintStages() {
    const rows = stagesFor('all');
    const mine = rows.filter(function (row) { return row.milestone === 'M28'; }).length;

    root.jQuery('#dl-stage-table tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.name) + '</td><td>' +
        root.Helpers.escapeHtml(row.milestone) + '</td><td>' +
        root.Helpers.escapeHtml(row.section || '—') + '</td><td>' +
        root.Helpers.escapeHtml(row.takes) + '</td><td>' +
        root.Helpers.escapeHtml(row.gives) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.features.join(', ') || '—') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dl-stage-table-caption',
      mine + ' of the ' + rows.length + ' stages are built in this milestone, and each is a ' +
      'pure function of the one before it — a claim the pipeline checks by running everything ' +
      'twice and comparing all five artefacts. The last column is where a feature first has ' +
      'to be dealt with, not where it stops mattering: `match` first appears in the type ' +
      'checker because that is where exhaustiveness lives, and it goes on costing something ' +
      'in every stage to its right.');
  }

  function paintCoverage() {
    const rows = coverageFor('all');
    const covered = rows.filter(function (row) { return row.covered; }).length;

    root.jQuery('#dl-coverage-table tbody').html(rows.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.name) + '</td><td class="mono">' +
        row.programs + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.ids.join(', ') || 'none') + '</td><td>' +
        (row.covered ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dl-coverage-table-caption',
      covered + ' of ' + rows.length + ' features are exercised by at least one conformance ' +
      'program. This column is a build-breaking test rather than a report: a feature nothing ' +
      'runs is a feature nobody has checked, and the failure mode is not that it is missing ' +
      'but that it half works — parsing correctly and type-checking wrongly, say, which no ' +
      'amount of reading the spec reveals.');
  }

  function paintGoals() {
    root.jQuery('#dl-goals-table tbody').html(root.Berugo.Spec.NON_GOALS.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.name) + '</td><td>' +
        root.Helpers.escapeHtml(row.why) + '</td><td>' +
        root.Helpers.escapeHtml(row.deferredTo) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dl-goals-table-caption',
      'A non-goal with a reason and a destination is a design decision; a non-goal without ' +
      'them is a thing somebody forgot. Each row here names the milestone that will meet the ' +
      'feature and the reason it is worth meeting on its own — which is also a promise that ' +
      'the earlier stages will have to change when it arrives, and a warning to keep them ' +
      'small enough that they can.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
