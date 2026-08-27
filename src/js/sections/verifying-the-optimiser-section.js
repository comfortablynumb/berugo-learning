/**
 * Section: Verifying the optimiser.
 *
 * The measurement is the whole loop running: generate, compile, optimise,
 * compare, shrink. Choosing the broken pipeline puts a genuinely wrong pass in
 * it — naive LICM, which hoists a division past the guard that makes it safe —
 * and the harness finds a failing program and reduces it. That is the Csmith
 * loop, at a scale that fits on a page.
 *
 * The shrinker is the part people skip and the part that decides whether a
 * found bug gets fixed. It also has to refuse candidates that stop being valid
 * programs: a minimal repro that does not compile is dismissed in one line,
 * correctly.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'verifying-the-optimiser';
  let panel = null;

  const PIPELINES = {
    full: ['ssa', 'sccp', 'copy-propagation', 'value-numbering', 'peephole', 'licm', 'dead-code'],
    broken: ['ssa', 'copy-propagation', 'licm-naive', 'dead-code'],
    minimal: ['ssa']
  };

  const SEED_FAILURE = 'let d = 0;\nlet n = 0;\nlet acc = 0;\nlet pad1 = 1 + 2;\n'
    + 'let pad2 = 3 + 4;\nlet pad3 = 5 + 6;\nlet pad4 = 7 + 8;\nlet pad5 = 9 + 10;\n'
    + 'let pad6 = 11 + 12;\nlet pad7 = 13 + 14;\nlet pad8 = 15 + 16;\n'
    + 'while n < d {\n  acc = acc + 100 / d;\n  n = n + 1;\n}';

  const GATES = [
    { gate: 'the IR verifier', checks: 'ten structural invariants, after every pass',
      catches: 'a block with two terminators, a jump to nowhere, a register read and never defined',
      blind: 'a pass producing perfectly valid IR that computes the wrong thing' },
    { gate: 'the SSA check', checks: 'one definition per register, every use dominated by it',
      catches: 'a pass that moved a definition below a use, or duplicated one',
      blind: 'the same thing — valid SSA can still be the wrong program' },
    { gate: 'the differential run', checks: 'value, output, outcome and every binding',
      catches: 'a pass that changed what the program computes, however valid its output',
      blind: 'a program that does not terminate, and one that does not parse' }
  ];

  const COVERAGE = [
    { pass: 'ssa', verifier: 'a phi with the wrong edge count', ssa: 'a use not dominated',
      differential: 'a renaming that read the wrong definition' },
    { pass: 'sccp', verifier: 'a jump to a block it removed', ssa: 'a phi entry for a dead edge',
      differential: 'a fold that computed the wrong constant' },
    { pass: 'copy-propagation', verifier: 'a use of a register it deleted',
      ssa: 'nothing — it does not move definitions',
      differential: 'a copy chain followed to the wrong end' },
    { pass: 'value-numbering', verifier: 'nothing — it only rewrites operands',
      ssa: 'a replacement whose definition does not dominate the use',
      differential: 'two expressions numbered equal that are not' },
    { pass: 'licm', verifier: 'nothing — the preheader is a real block',
      ssa: 'a hoisted definition now below a use',
      differential: 'a hoist past the guard that made it safe' },
    { pass: 'dead-code', verifier: 'a use of something it removed',
      ssa: 'nothing — it only removes', differential: 'an effect removed as if it were pure' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — generate, compile, compare, shrink',
      caption: 'The loop that found hundreds of bugs in production C compilers. Generate a ' +
        'program from the grammar; compile it twice, once with the passes and once without; ' +
        'run both and compare. A disagreement is a compiler bug, and the program that exposed ' +
        'it is typically hundreds of lines of generated noise — which is where the last box ' +
        'earns its place. Without a shrinker the bug report is "this two-hundred-line program ' +
        'is miscompiled", which nobody can act on; with one it is four lines. That box is the ' +
        'part people skip, and skipping it is why a fuzzing campaign produces a backlog rather ' +
        'than a fix.',
      definition: [
        'graph LR',
        'G["generate from the grammar"] --> C["compile with the pipeline"]',
        'G --> R["compile with no passes"]',
        'C --> X["run both"]',
        'R --> X',
        'X --> Q{"same value, output, outcome, bindings?"}',
        'Q -->|yes| G',
        'Q -->|no| S["shrink while it still fails the SAME way"]',
        'S --> M["a minimal repro somebody can act on"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A verifier after every pass turns "the optimiser produced garbage" into "pass X broke ' +
        'invariant Y".** That is the difference between a failure that names itself and a ' +
        'manual bisect through an eleven-pass pipeline, and it costs one walk per pass. It is ' +
        'the highest-value thing in a middle end for exactly this reason.',
      '**The verifier is blind to the failure that matters most.** A pass can produce ' +
        'perfectly valid IR that computes the wrong thing, and no structural check will ever ' +
        'see it. Only running the program does, which is why the differential comparison is a ' +
        'gate rather than a test suite entry.',
      '**Differential testing needs the right observables, and choosing them is most of the ' +
        'design.** Every conformance program returns `unit`, so comparing return values passes ' +
        'whatever the optimiser produced. The comparison here includes the bindings a program ' +
        'leaves behind — which is what makes seventeen green rows mean something.',
      '**Random program generation gets past the cases you thought of, and only those its ' +
        'grammar can express.** This generator emits well-typed, terminating programs and ' +
        'finds nothing under the deliberately broken pipeline — because it cannot write a ' +
        'division guarded by its own loop condition, which is the shape naive LICM breaks. A ' +
        'fuzzer is bounded by its generator, and the seeded failure beside the sweep is what ' +
        'that bound looks like when it is admitted rather than hidden.',
      '**A found bug that cannot be reduced is a found bug that does not get fixed.** The ' +
        'generated program that exposes a miscompilation is hundreds of lines of noise. ' +
        'Shrinking it to something readable is the step that turns a fuzzing campaign into a ' +
        'fix, and it is the step most people leave out.',
      '**A shrinker must keep the failure the SAME failure.** A candidate that fails for a ' +
        'different reason has replaced the bug with another one, and the "minimal repro" then ' +
        'describes something nobody was investigating. Comparing the failing pass and the kind ' +
        'of failure is what makes reduction trustworthy.',
      '**A shrinker must also keep the program VALID.** Without a validity gate it happily ' +
        'deletes the declaration of a variable the loop still uses, and the result is a repro ' +
        'that does not compile — which a compiler team dismisses in one line, correctly, ' +
        'because a report about undefined behaviour is not a bug report.',
      '**Translation validation is the next step and it is a different claim.** Verifying a ' +
        'PASS proves every compilation is correct; validating a TRANSLATION proves this one ' +
        'is. The second is far cheaper and is what an SMT-backed peephole checker does, which ' +
        'is where M32 picks the thread up.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the fuzzing loop, a real failure, and the shrinker',
        markup: root.VerifyOptTemplate.render()
      },
      diagram: diagram(),
      insight: '**Csmith and its descendants found hundreds of bugs in production compilers by ' +
        'exactly this loop; the shrinker is what makes the found bugs actionable, and it is ' +
        'usually the part people skip.** The reason it gets skipped is that it feels like ' +
        'tooling rather than testing — the bug is already found, so surely the work is done. ' +
        'It is not. A miscompilation report consists of a program, and a generated program is ' +
        'unreadable: hundreds of lines, every variable named `v17`, and no indication which ' +
        'three of them matter. A compiler team receiving that has to do the reduction ' +
        'themselves before they can begin, so in practice the report sits. Reduction is also ' +
        'the step that is easy to get subtly wrong in two ways, and both make it worse than ' +
        'nothing: a shrinker that accepts any failure produces a minimal program exhibiting a ' +
        'different bug, and one that does not check validity produces a program with undefined ' +
        'behaviour, which is the single fastest way to have a real report dismissed. Both ' +
        'checks are a few lines. The loop above runs them on every candidate, and the ' +
        'reduction from a padded twenty-line program to four is what the whole apparatus is ' +
        'for.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.VerifyOptTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  /**
   * The sweep runs the generator's corpus through the chosen pipeline and
   * stops at the first failure, because the interesting output is a shrunk
   * program rather than a count of how many ways one bug can surface.
   */
  const sweepFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const pipeline = PIPELINES[parts[2]];
    const state = { checked: 0, failures: [] };

    for (let i = 0; i < parts[0] && state.failures.length < 3; i += 1) {
      check(state, root.Berugo.Fuzz.generate(parts[1] + i, { maxDepth: 3 }), pipeline);
    }
    return state;
  });

  function check(state, source, pipeline) {
    state.checked += 1;
    try {
      const out = root.PassLab.run(source, pipeline);

      if (!out.ok) state.failures.push({ source: source, step: out.firstFailure });
    } catch (error) {
      state.failures.push({ source: source, step: { pass: 'threw', why: error.message } });
    }
  }

  const shrinkFor = root.Helpers.memoise(function (pipeline) {
    return root.PassLab.shrink(SEED_FAILURE, PIPELINES[pipeline]);
  });

  const suiteFor = root.Helpers.memoise(function (pipeline) {
    return root.PassLab.suite(PIPELINES[pipeline]);
  });

  function update() {
    const values = panel.values();
    const key = JSON.stringify([Number(values['vo-count']), Number(values['vo-seed']),
      values['vo-pipeline']]);
    const sweep = sweepFor(key);
    const shrunk = shrinkFor(values['vo-pipeline']);
    const suite = suiteFor(values['vo-pipeline']);

    paintMinimal(shrunk, sweep);
    paintMetrics(sweep, shrunk, suite);
    paintGates();
    paintShrink(shrunk);
    paintSuite(suite);
    paintCoverage();
  }

  function paintMinimal(shrunk, sweep) {
    root.Helpers.setText('vo-minimal', shrunk.ok ? shrunk.source
      : 'This pipeline does not miscompile the seeded program.');
    root.Helpers.setText('vo-minimal-caption', minimalCaption(shrunk, sweep));
  }

  function minimalCaption(shrunk, sweep) {
    if (!shrunk.ok) {
      return 'The seeded program is a division guarded by a loop condition — the case naive ' +
        'LICM breaks. Under a correct pipeline it compiles and runs correctly, so there is ' +
        'nothing to shrink, and the sweep above found ' + sweep.failures.length +
        ' failures in ' + sweep.checked + ' generated programs. A fuzzing run that finds ' +
        'nothing is the expected result and not a wasted one: it is the only evidence that ' +
        'the passes hold on inputs nobody chose.';
    }
    return 'Reduced from ' + shrunk.from + ' lines and ' + shrunk.was + ' characters to ' +
      shrunk.to + ' and ' + shrunk.characters + ', in ' + shrunk.rounds + ' rounds trying ' +
      shrunk.tried + ' candidates. Every intermediate step was still a program that parses, ' +
      'resolves, and fails at the same pass in the same way — which is what makes this a ' +
      'repro rather than a coincidence.';
  }

  function paintMetrics(sweep, shrunk, suite) {
    root.MetricGrid.update({
      'vo-checked': { value: root.Format.exact(sweep.checked),
        note: 'each compiled, optimised, run, and compared against the same program unoptimised' },
      'vo-failures': { value: root.Format.exact(sweep.failures.length),
        note: sweep.failures.length
          ? 'first at pass ' + sweep.failures[0].step.pass
          : 'every generated program computes the same thing before and after — including ' +
            'under the broken pipeline, because this generator cannot write a division ' +
            'guarded by its own loop condition' },
      'vo-shrunk': { value: shrunk.ok ? shrunk.to + ' of ' + shrunk.from + ' lines' : 'nothing to shrink',
        note: shrunk.ok ? shrunk.tried + ' candidates tried, ' + shrunk.accepted + ' accepted'
          : 'this pipeline compiles the seeded program correctly' },
      'vo-suite': { value: suite.passed + ' of ' + suite.total,
        note: 'programs where every gate held after every pass' }
    });
  }

  function paintGates() {
    root.jQuery('#vo-gates tbody').html(GATES.map(function (row) {
      return '<tr><td>' + root.Helpers.escapeHtml(row.gate) + '</td><td>' +
        root.Helpers.escapeHtml(row.checks) + '</td><td>' +
        root.Helpers.escapeHtml(row.catches) + '</td><td>' +
        root.Helpers.escapeHtml(row.blind) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('vo-gates-caption',
      'The last column is the one worth reading. Two of the three gates are blind to the same ' +
      'thing — a pass that produces valid IR computing the wrong answer — and no amount of ' +
      'structural checking reaches it. That is why the differential run is a gate rather than ' +
      'a test, and it is why the third row\'s own blind spot matters: a program that does not ' +
      'terminate never reaches the comparison, so an optimiser that turns a finishing program ' +
      'into a looping one is reported as a budget outcome rather than as a wrong answer.');
  }

  function paintShrink(shrunk) {
    const rows = shrunk.ok ? [
      ['Lines', shrunk.from, shrunk.to, 'whole statements deleted while the failure persisted'],
      ['Characters', shrunk.was, shrunk.characters, 'numbers simplified towards zero, arrays shortened'],
      ['Candidates tried', 0, shrunk.tried, 'each one compiled and run to see whether it still fails'],
      ['Candidates accepted', 0, shrunk.accepted, 'the rest either passed or failed differently'],
      ['Rounds', 0, shrunk.rounds, 'the list is recomputed after every acceptance, or later edits are stale']
    ] : [];

    root.jQuery('#vo-shrink tbody').html(rows.map(function (row) {
      return '<tr><td>' + row[0] + '</td><td class="mono">' + row[1] + '</td><td class="mono">' +
        row[2] + '</td><td>' + root.Helpers.escapeHtml(row[3]) + '</td></tr>';
    }).join('') || '<tr><td colspan="4">nothing to shrink under this pipeline</td></tr>');

    root.Helpers.setText('vo-shrink-caption',
      'The last row is a real bug this shrinker had. Continuing through a candidate list ' +
      'computed from the PREVIOUS program applies stale edits — a later candidate is the old ' +
      'text with one change, so accepting it silently undoes the acceptance before it. The ' +
      'first version reported hundreds of accepted candidates and reduced twenty-four lines to ' +
      'twenty-four: it was making progress and throwing it away, and the accept count made it ' +
      'look like it was working.');
  }

  function paintSuite(suite) {
    root.jQuery('#vo-conformance tbody').html(suite.rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.before +
        '</td><td class="mono">' + row.after + '</td><td class="mono">' + row.removed +
        '</td><td>' + (row.ok ? 'yes' : 'NO — ' + row.why) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('vo-conformance-caption',
      suite.passed + ' of ' + suite.total + ' programs pass every gate after every pass, with ' +
      (suite.before - suite.after) + ' of ' + suite.before + ' instructions removed. Choosing ' +
      'the broken pipeline turns some of these to NO with a reason, which is what the column ' +
      'is for: a suite that only ever says yes has not been shown to be able to say anything ' +
      'else.');
  }

  function paintCoverage() {
    root.jQuery('#vo-coverage tbody').html(COVERAGE.map(function (row) {
      return '<tr><td class="mono">' + row.pass + '</td><td>' +
        root.Helpers.escapeHtml(row.verifier) + '</td><td>' +
        root.Helpers.escapeHtml(row.ssa) + '</td><td>' +
        root.Helpers.escapeHtml(row.differential) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('vo-coverage-caption',
      'Six passes and the failure each gate would catch in each. Reading down the columns is ' +
      'the useful direction: the verifier catches structural damage and says nothing about ' +
      'four of the six; the SSA check covers the passes that MOVE definitions; the ' +
      'differential run is the only column with an entry in every row. That is the argument ' +
      'for running all three rather than the cheapest — and for treating the last as the one ' +
      'that cannot be skipped, since it is the only one that can see a pass being wrong about ' +
      'what the program means rather than about how it is written.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
