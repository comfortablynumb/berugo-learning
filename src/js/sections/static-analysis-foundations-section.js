/**
 * Section: Foundations of static analysis.
 *
 * The measurement is the gap between what an analyser says is possible and
 * what a run actually did, reported as two separate numbers because they are
 * two separate properties. Soundness is "nothing observed fell outside the
 * claim" and precision is "how much wider the claim was", and a tool that
 * collapsed them into one score would let the useless analyser — everything is
 * possible — come out perfect.
 *
 * The four precision levels are the same property asked four ways, and the
 * progression is the point: sign says nothing about the loop counter, parity
 * says something true and irrelevant, intervals with widening alone say
 * "somewhere above zero", and intervals with narrowing say [0, 11] where the
 * truth is [0, 10].
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'static-analysis-foundations';
  const LEVELS = [
    { id: 'sign', name: 'sign', domain: 'sign', narrow: true,
      says: 'negative, zero or positive' },
    { id: 'parity', name: 'parity', domain: 'parity', narrow: true,
      says: 'even or odd' },
    { id: 'widen', name: 'intervals, widening only', domain: 'interval', narrow: false,
      says: 'a lower and an upper bound, with the loop bound thrown away' },
    { id: 'narrow', name: 'intervals, widening then narrowing', domain: 'interval',
      narrow: true, says: 'a lower and an upper bound, recovered where a branch constrains it' }
  ];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — over- and under-approximating the set of real behaviours',
      caption: 'The concrete set is what the program actually does, and it is not computable. '
        + 'A SOUND analysis reports a superset: everything real is inside it, so anything it '
        + 'rules out is genuinely impossible — and the extra is false positives. An analysis '
        + 'that reports a subset is COMPLETE instead: everything it reports is real, and what '
        + 'it misses is false negatives. Rice\'s theorem is why you must pick one; nothing '
        + 'computes the set itself.',
      definition: [
        'graph TD',
        'O["over-approximation — sound"] --> C',
        'C["what the program really does"] --> U["under-approximation — complete"]',
        'O -.->|"the extra is false positives"| FP["reported, never happens"]',
        'U -.->|"the gap is false negatives"| FN["happens, never reported"]',
        'R["Rice: the set itself is not computable"] --> C'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Soundness and completeness are properties of an analysis WITH RESPECT TO a property, '
        + 'and quoting either without the property is meaningless.** A sound null-check analysis '
        + 'reports every possible null dereference; a complete one reports only real ones. The '
        + 'same tool can be sound for one property and neither for another, which is why '
        + '"is this analysis sound" is not a question.',
      '**Rice\'s theorem is why approximation is mandatory rather than a compromise.** Any '
        + 'non-trivial property of a program\'s behaviour is undecidable, so no analysis '
        + 'computes the exact answer. Everything that follows is a choice about WHICH way to be '
        + 'wrong, and the interesting engineering is in that choice.',
      '**Over-approximate and you get false positives; under-approximate and you get false '
        + 'negatives.** A type checker over-approximates and rejects programs that would have '
        + 'worked. A test suite under-approximates and misses bugs it did not exercise. Neither '
        + 'is a defect of the tool; both are the tool doing what it was built to do.',
      '**Which one to prefer depends entirely on what silence means.** A verifier that proves '
        + 'the absence of a bug must be sound, or its proof is worthless. A bug finder that a '
        + 'human triages should be complete, or the humans stop reading it. Most shipping tools '
        + 'are neither and are still valuable — but only to somebody who knows which failures '
        + 'to expect.',
      '**Precision is measurable, and it is not the same question as soundness.** The demo '
        + 'reports both: values observed outside the claim (which must be zero) and how much '
        + 'wider the claim was than what happened (which is where the false positives live). An '
        + 'analysis that says "any value is possible" is perfectly sound and completely '
        + 'useless.',
      '**The precision axes are flow, path, context and field sensitivity, and each one '
        + 'multiplies the cost.** Flow sensitivity distinguishes program points; path '
        + 'sensitivity distinguishes the branches taken to get there; context sensitivity '
        + 'distinguishes callers; field sensitivity distinguishes an object\'s fields from the '
        + 'object. Real tools drop the ones their property does not need.',
      '**A dynamic oracle can prove an analysis unsound and can never prove one sound.** It '
        + 'sees one run. The demo reports the number of observations the verdict is based on '
        + 'precisely so that "no violations" cannot be read as "correct" — with zero '
        + 'observations, every analysis passes.',
      '**Read a tool\'s documentation for the guarantee, not for the adjectives.** "Finds bugs" '
        + 'is not a guarantee. "Reports every dereference of a value that may be null under '
        + 'these modelling assumptions" is one, and the assumptions are the part that decides '
        + 'whether the guarantee applies to your code.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — four precisions, one property, one run',
        markup: root.FoundationsTemplate.render() },
      diagram: diagram(),
      insight: '**A linter that reports no error is telling you nothing unless you know '
        + 'whether it is sound.** That sentence is the whole reason this section comes first. '
        + 'Most tools an engineer meets are neither sound nor complete: they are heuristics '
        + 'tuned so that the reports a team receives are mostly worth reading, which is a '
        + 'commercial property rather than a logical one. That is fine, and it is valuable, and '
        + 'it means a clean run is evidence of nothing in particular. The mistake is not using '
        + 'those tools; it is reading their silence as a proof. What to do instead is concrete. '
        + 'For each tool you rely on, find the sentence in its documentation that says what it '
        + 'guarantees, and notice whether it is a statement about the reports it makes or about '
        + 'the ones it does not. A type checker\'s guarantee is of the second kind and is why a '
        + 'type error is worth fixing rather than suppressing. A bug finder\'s is of the first '
        + 'kind, and a clean run means the heuristics did not fire. And when a tool offers a '
        + 'precision setting — inlining depth, path limits, "aggressive" modes — it is offering '
        + 'you a position on the trade this demo measures: more precision means fewer false '
        + 'positives and more time, and past some point it means the analysis gives up on your '
        + 'largest functions and quietly reports nothing about exactly the code you most wanted '
        + 'checked.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.FoundationsTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (sample) {
    const source = root.FoundationsTemplate.SAMPLES[sample];
    const compiled = root.StaticLab.compile(source);
    const run = root.StaticLab.observe(compiled.fn, {});

    return { source: source, fn: compiled.fn, run: run,
      levels: LEVELS.map(function (level) { return oneLevel(compiled.fn, run, level); }) };
  });

  function oneLevel(fn, run, level) {
    const analysis = root.StaticLab.analyse(fn, { domain: level.domain,
      narrow: level.narrow });

    return { level: level, analysis: analysis,
      soundness: root.StaticLab.soundness(analysis, run),
      precision: root.StaticLab.precision(analysis, run) };
  }

  function update() {
    const values = panel.values();
    const study = studyFor(values['saf-sample']);
    const chosen = study.levels.filter(function (row) {
      return row.level.id === values['saf-precision'];
    })[0];

    paintSource(study, chosen);
    paintMetrics(chosen, study);
    paintLevels(study, values['saf-precision']);
    paintClaims(chosen);
    paintQuadrant();
    paintAxes();
  }

  function paintSource(study, chosen) {
    root.jQuery('#saf-source').text(study.source);
    root.Helpers.setText('saf-source-caption',
      'Run once and analysed four ways. The run visits ' + study.run.steps +
      ' blocks, and the check reads the state at the start AND the end of each visit — ' +
      study.run.observations.length + ' snapshots' +
      (study.run.gaveUp ? ', giving up on ' + study.run.gaveUp : '') + '. The analysis at "'
      + chosen.level.name + '" can say: ' + chosen.level.says + '.');
  }

  function paintMetrics(chosen, study) {
    root.MetricGrid.update({
      'saf-sound': { value: chosen.precision.unsound,
        note: chosen.precision.unsound ? 'the analysis is unsound on this programme'
          : 'every observed value lay inside the claim' },
      'saf-exact': { value: chosen.precision.exact + ' of ' + chosen.precision.total,
        note: 'the claim was exactly the set of values that occurred' },
      'saf-unbounded': { value: chosen.precision.unbounded,
        note: 'claims at the top of the lattice, which rule nothing out' },
      'saf-observations': { value: chosen.soundness.observations,
        note: study.run.exhausted ? 'the run hit its step budget'
          : 'one run, so this can refute soundness and never establish it' }
    });
  }

  function paintLevels(study, chosen) {
    root.jQuery('#saf-levels tbody').html(study.levels.map(function (row) {
      return '<tr' + (row.level.id === chosen ? ' class="row-current"' : '') +
        '><td class="mono">' + row.level.name + '</td><td>' + row.level.says +
        '</td><td class="mono">' + row.precision.total + '</td><td class="mono">' +
        row.precision.exact + '</td><td class="mono">' + row.precision.unbounded +
        '</td><td class="mono">' + row.precision.unsound + '</td></tr>';
    }).join(''));

    root.Helpers.setText('saf-levels-caption', levelsCaption(study));
  }

  function levelsCaption(study) {
    const sign = study.levels[0];
    const narrow = study.levels[3];

    return 'Every row is sound — ' + study.levels.filter(function (row) {
      return row.precision.unsound === 0;
    }).length + ' of ' + study.levels.length + ' with nothing observed outside the claim — and '
      + 'they differ entirely in how much they say. Sign leaves ' + sign.precision.unbounded
      + ' claims at the top of its lattice; intervals with narrowing leave '
      + narrow.precision.unbounded + '. The "exact" column is not comparable ACROSS domains, '
      + 'because "even" and "[0, 10]" are different kinds of statement — it is comparable down '
      + 'each column, and the useful reading is the last two together.';
  }

  function paintClaims(chosen) {
    const rows = chosen.precision.rows;

    root.jQuery('#saf-claims tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.block + ' · ' + row.at +
        '</td><td class="mono">' + row.slot +
        '</td><td class="mono">' + row.claim + '</td><td class="mono">' + row.observedLo +
        '…' + row.observedHi + '</td><td class="mono">' + row.distinct +
        '</td><td class="mono">' + verdictOf(row) + '</td></tr>';
    }).join('') || '<tr><td colspan="6">this run reached no block with a numeric local in '
      + 'it</td></tr>');

    root.Helpers.setText('saf-claims-caption', claimsCaption(chosen));
  }

  function verdictOf(row) {
    if (!row.contains) return 'UNSOUND';
    if (row.width === Infinity) return 'says nothing';
    if (row.width === row.observedWidth) return 'exact';
    return 'sound, ' + (row.width - row.observedWidth) + ' wider';
  }

  function claimsCaption(chosen) {
    const loose = chosen.precision.rows.filter(function (row) {
      return row.contains && row.width !== row.observedWidth;
    }).length;

    return 'Each row is one variable at one program point. "Sound, n wider" is a false-positive '
      + 'surface: the analysis admits ' + loose + ' claims here that contain values this run '
      + 'never produced, and a checker built on it would warn about every one of them. That is '
      + 'not a defect — it is the price of an answer that holds for every run rather than for '
      + 'this one — and it is the number a tool\'s users experience as noise.';
  }

  const QUADRANT = [
    { name: 'reports every real null dereference, and some that cannot happen',
      every: 'yes', only: 'no', verdict: 'sound, not complete',
      silence: 'a proof: it cannot happen' },
    { name: 'reports only real ones, and misses some',
      every: 'no', only: 'yes', verdict: 'complete, not sound',
      silence: 'nothing; it may simply not have looked' },
    { name: 'reports exactly the real ones',
      every: 'yes', only: 'yes', verdict: 'both — and undecidable in general',
      silence: 'a proof, and unavailable' },
    { name: 'reports some real ones and some impossible ones',
      every: 'no', only: 'no', verdict: 'neither — and this is most tools',
      silence: 'nothing at all' }
  ];

  function paintQuadrant() {
    root.jQuery('#saf-quadrant tbody').html(QUADRANT.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + row.every +
        '</td><td class="mono">' + row.only + '</td><td class="mono">' + row.verdict +
        '</td><td>' + row.silence + '</td></tr>';
    }).join(''));

    root.Helpers.setText('saf-quadrant-caption',
      'The last column is the one to read. Only a SOUND analysis has meaningful silence, and '
      + 'that is the entire practical consequence of the distinction: it decides whether a '
      + 'clean run is evidence. Most tools are on the last row and are still worth running — '
      + 'they are heuristics tuned so the reports are usually worth reading, which is a '
      + 'commercial property rather than a logical one.');
  }

  const AXES = [
    { axis: 'flow sensitivity', what: 'the value at THIS point from the value anywhere',
      cost: 'one abstract state per program point instead of one per procedure',
      dropped: 'never — a flow-insensitive analysis is rarely worth running' },
    { axis: 'path sensitivity', what: 'the branches taken to get here',
      cost: 'exponential in the branches, which is why 32.4 bounds its search',
      dropped: 'almost always, and recovered selectively by refinement' },
    { axis: 'context sensitivity', what: 'one caller from another',
      cost: 'one summary per calling context, or a k-limited approximation',
      dropped: 'past a small k; M29\'s escape analysis gives up at the call entirely' },
    { axis: 'field sensitivity', what: 'an object\'s fields from the object',
      cost: 'one abstract location per field, and aliasing between them',
      dropped: 'often — the taint analysis in 32.3 is field-insensitive and says so' }
  ];

  function paintAxes() {
    root.jQuery('#saf-axes tbody').html(AXES.map(function (row) {
      return '<tr><td class="mono">' + row.axis + '</td><td>' + row.what + '</td><td>' +
        root.Helpers.escapeHtml(row.cost) + '</td><td>' +
        root.Helpers.escapeHtml(row.dropped) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('saf-axes-caption',
      'Every axis is a way of distinguishing two situations the analysis would otherwise merge, '
      + 'and every merge is a place false positives are created. The last column is where the '
      + 'engineering is: a tool that kept all four at full precision would be exact and would '
      + 'not terminate, so the question is never "how precise" but "precise about what".');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
