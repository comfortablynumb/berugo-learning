/**
 * Section: Fuzzing.
 *
 * The loop is the easy half and the demo says so by measuring the other one.
 * The same fuzzer runs against the same target with the oracle set as a
 * control: with crashes alone it finds the planted crash and nothing else,
 * and with a differential reference it also finds `[)` — two characters, a
 * wrong answer, no crash, and the shape of most real bugs.
 *
 * The front-end target is not a toy. Running this loop against it found two
 * inputs that made the pipeline's own reporting path throw — `let:` and
 * `l = match 1;` — because the AST printer assumed error recovery had produced
 * complete nodes. Both are fixed in `machines/berugo/ast.js`; the fuzzer is
 * the reason anybody knew.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'coverage-guided-fuzzing';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the loop, and the two things that make it work',
      caption: 'Everything on the left is a random generator. The feedback edge at the bottom '
        + 'is what turns it into a search: an input that reached behaviour nothing else '
        + 'reached is kept and built on, so progress accumulates instead of being rediscovered. '
        + 'The box on the right is the oracle, and without it the only bug this can find is a '
        + 'crash.',
      definition: [
        'flowchart LR',
        'C["corpus"] --> P["pick an input"]',
        'P --> M["mutate: insert, delete,<br/>replace, duplicate, splice"]',
        'M --> R["run the target"]',
        'R --> O{"oracle:<br/>crash? invariant? differential?"}',
        'O -->|"a failure"| F["finding — then shrink it"]',
        'O -->|"no failure"| N{"new coverage?"}',
        'N -->|"yes"| C',
        'N -->|"no"| D["discard — most inputs end here"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The loop is four lines and it is not where the difficulty is.** Take an input from the '
        + 'corpus, mutate it, run the target, and keep the mutant if it reached anything new. '
        + 'Everything hard about fuzzing is in the two things that loop needs from you: a '
        + 'coverage signal and an oracle.',
      '**Coverage feedback is what turns random input into a search.** Without it a fuzzer has '
        + 'no gradient at all and finds only what a random generator finds — which, against a '
        + 'parser, is almost nothing. With it, an input that gets one token deeper is preserved '
        + 'and built on, so the corpus becomes a summary of the behaviours found rather than a '
        + 'log of the inputs tried.',
      '**Most executions are discarded, and that is the loop working.** The demo reports the '
        + 'corpus beside the executions: a few dozen inputs kept out of a couple of thousand '
        + 'run. An input that covers nothing new has told you nothing, and keeping it would '
        + 'make every later mutation slower for no reason.',
      '**The oracle is the hard part, and the demo measures exactly that.** Switch the control '
        + 'to crashes only and the bracket target yields one finding: the planted crash at a '
        + 'nesting depth of seven. Switch the differential reference back on and it also finds '
        + '`[)` — two characters, no crash, and a wrong answer. Most real bugs are the second '
        + 'kind.',
      '**Three oracles cover different ground, and none of them is optional.** A crash is any '
        + 'exception from code whose contract is to report errors. An invariant is a property '
        + 'of the output — here, that every AST node\'s span lies inside the source. A '
        + 'differential compares two implementations of the same thing, which is how you find '
        + 'wrong answers with no assertion available.',
      '**A fuzzer against a compiler front end is testing the error path, and that is the '
        + 'point.** Almost every mutated input is invalid, so almost every run exercises the '
        + 'diagnostics rather than the happy path — which is precisely the code that gets the '
        + 'least attention and the most malformed input in production.',
      '**Shrinking is what makes a finding usable.** A crash on nine random characters is a '
        + 'puzzle; the same crash on seven, with the irrelevant ones deleted, is a bug report. '
        + 'The demo shrinks by removing spans and keeping any candidate that still fails, which '
        + 'is delta debugging in its simplest form.',
      '**Deduplication is what stops a hundred thousand findings from being one report each.** '
        + 'The same defect is reached by thousands of different inputs; grouping by the failure '
        + 'rather than by the input is what makes the count meaningful — the demo reports how '
        + 'many times each distinct finding was hit.',
      '**Corpus minimisation is a set-cover problem, solved greedily by size.** Keep the '
        + 'smallest input that contributes each edge and drop the rest; the measurement that '
        + 'matters is that TOTAL COVERAGE IS UNCHANGED, because a minimisation that loses an '
        + 'edge has lost a test. On the front-end corpus that is 24 inputs down to 22 and 473 '
        + 'bytes down to 423, with all 60 edges kept.',
      '**Structure-aware fuzzing is the next step up, and it is a trade.** A grammar-based '
        + 'generator from M25 produces inputs that reach deep into the program on the first '
        + 'try, and it never produces the malformed input that breaks the error path. Real '
        + 'campaigns run both.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — the loop, the oracles, and what each one finds',
        markup: root.FuzzTemplate.render() },
      diagram: diagram(),
      insight: '**The oracle is the hard part, not the mutation: without sanitisers, '
        + 'assertions or a differential reference, a fuzzer can only find crashes, and most '
        + 'bugs are not crashes.** The demo makes that a number rather than an opinion, and the '
        + 'practical consequence is where to spend an afternoon. Wiring a fuzzer to a parser '
        + 'takes an hour and finds the crashes; making it find wrong ANSWERS takes an oracle, '
        + 'and the cheapest oracles are usually already available in your codebase. A '
        + 'round-trip property — parse then print then parse again — costs ten lines and covers '
        + 'an enormous amount. A slow reference implementation you already trust makes a '
        + 'differential. An assertion you were too nervous to leave enabled in production is '
        + 'exactly what a fuzzing build should turn back on. The second practical point is '
        + 'about where to point it: the error path. Almost every mutated input is invalid, so a '
        + 'fuzzer spends its time in the code that handles malformed input — which is the code '
        + 'with the least test coverage and the most hostile users, and it is where both of the '
        + 'real bugs behind this section were found. The third is a warning about the coverage '
        + 'curve. It flattens, always, and a flat curve does not mean the target is clean; it '
        + 'means the mutations you have are no longer reaching new behaviour. That is the '
        + 'moment to add a seed, a dictionary, or a grammar — not the moment to declare '
        + 'victory.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.FuzzTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function targetFor(name, oracles) {
    if (name === 'brackets') {
      return function (input) {
        return root.FuzzTarget.brackets(input,
          { oracles: oracles === 'crash' ? ['crash'] : ['crash', 'differential'] });
      };
    }
    if (oracles === 'crash') return crashOnly(root.FuzzTarget.frontEnd);
    return root.FuzzTarget.frontEnd;
  }

  /* The front end's deeper oracles cannot be switched off inside the target
     without duplicating it, so they are filtered here: the run is identical
     and only what counts as a finding changes, which is the comparison the
     control is for. */
  function crashOnly(target) {
    return function (input) {
      const out = target(input);

      if (out.verdict === 'crash') return out;
      return { coverage: out.coverage, verdict: 'ok', detail: out.detail };
    };
  }

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const spec = root.FuzzTemplate.TARGETS[parts[0]];
    const target = targetFor(parts[0], parts[1]);
    const run = root.Fuzzer.run(target,
      { iterations: parts[2], seed: parts[3], seeds: spec.seeds });

    return { name: parts[0], spec: spec, target: target, run: run,
      minimised: root.Fuzzer.minimise(run.corpus),
      findings: run.crashes.map(function (row) {
        return { row: row, shrunk: root.Fuzzer.shrink(target, row.input, {}) };
      }) };
  });

  /** The same run under both oracle settings, so the table can price them. */
  const oraclesFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return ['crash', 'all'].reduce(function (into, setting) {
      into[setting] = studyFor(JSON.stringify([parts[0], setting, parts[1], parts[2]]))
        .run.crashes;
      return into;
    }, {});
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(JSON.stringify([values['cgf-target'], values['cgf-oracles'],
      values['cgf-iterations'], values['cgf-seed']]));

    paintTarget(study);
    paintMetrics(study);
    paintFindings(study);
    paintOracles(values);
    paintCorpus(study);
    paintMutators();
    paintChart(app, study);
  }

  function paintTarget(study) {
    root.jQuery('#cgf-target-text').text('seeds:\n' + study.spec.seeds.map(function (seed) {
      return '  ' + JSON.stringify(seed);
    }).join('\n') + '\n\ncoverage signal: ' + describeCoverage(study.name) +
      '\noracles: ' + study.run.crashes.length + ' distinct findings');
    root.Helpers.setText('cgf-target-caption', 'The target is ' + study.spec.about +
      '. Every input is run once; the corpus keeps only the ones that reached behaviour the '
      + 'corpus had not reached before, which is ' + study.run.corpus.length + ' of ' +
      study.run.executions + ' here.');
  }

  function describeCoverage(name) {
    if (name === 'brackets') return 'the deepest nesting, the bracket kinds seen, the verdict';
    return 'stages reached, diagnostics raised, token kinds, AST node kinds';
  }

  function paintMetrics(study) {
    const minimised = study.minimised;

    root.MetricGrid.update({
      'cgf-executions': { value: study.run.executions,
        note: study.run.rejected + ' covered nothing new and were discarded' },
      'cgf-edges': { value: study.run.edges, note: 'distinct behaviours in the corpus' },
      'cgf-corpus': { value: study.run.corpus.length,
        note: 'kept out of ' + study.run.executions + ' run' },
      'cgf-findings': { value: study.run.crashes.length,
        note: study.run.crashes.length ? 'deduplicated by failure, not by input'
          : 'nothing failed under these oracles' },
      'cgf-minimised': { value: minimised.after + ' of ' + minimised.before,
        note: minimised.coverage.length + ' edges kept — a minimisation that loses one is broken' },
      'cgf-bytes': { value: (minimised.bytesBefore - minimised.bytesAfter),
        note: minimised.bytesBefore + ' bytes down to ' + minimised.bytesAfter }
    });
  }

  function paintFindings(study) {
    root.jQuery('#cgf-findings-table tbody').html(study.findings.map(function (entry) {
      return '<tr class="row-bad"><td class="mono">' + entry.row.verdict +
        '</td><td class="mono">' + escapeInput(entry.row.input) + '</td><td class="mono">' +
        escapeInput(entry.shrunk.input) + ' (' + entry.shrunk.from + ' to ' +
        entry.shrunk.to + ' bytes)</td><td class="mono">' + entry.row.count +
        '</td><td>' + root.Helpers.escapeHtml(entry.row.detail) + '</td></tr>';
    }).join('') || '<tr><td colspan="5">nothing failed under these oracles, which is not the '
      + 'same as nothing being wrong</td></tr>');

    root.Helpers.setText('cgf-findings-table-caption', findingsCaption(study));
  }

  function escapeInput(input) {
    return root.Helpers.escapeHtml(JSON.stringify(input));
  }

  function findingsCaption(study) {
    if (!study.findings.length) {
      return 'No finding under this oracle set. On the front end that is a real result — the '
        + 'two crashes this loop found while the section was written are fixed — and on the '
        + 'bracket matcher with crashes only it is the section\'s whole point: the wrong answer '
        + 'is still there, and nothing is looking for it.';
    }
    return 'Each row is a distinct failure with the number of inputs that reached it, because '
      + 'the same defect is found thousands of times and one report per input would be useless. '
      + 'The shrinking column is what turns a finding into a bug report: delete any span of the '
      + 'input that still fails, repeat, and what is left is the minimum that reproduces it.';
  }

  const ORACLES = [
    { id: 'crash', name: 'crash', checks: 'any exception from code whose contract is to report',
      blind: 'every bug that produces a wrong answer without falling over' },
    { id: 'invariant', name: 'invariant',
      checks: 'a property of the output — every span inside the source, every node with an origin',
      blind: 'anything the property does not mention' },
    { id: 'differential', name: 'differential',
      checks: 'two implementations of the same thing, compared',
      blind: 'a bug both implementations share, which is why the reference must be independent' }
  ];

  function paintOracles(values) {
    const both = oraclesFor(JSON.stringify([values['cgf-target'], values['cgf-iterations'],
      values['cgf-seed']]));

    root.jQuery('#cgf-oracle-table tbody').html(ORACLES.map(function (row) {
      const found = both.all.filter(function (entry) {
        return entry.verdict === row.id || (row.id === 'crash' && entry.verdict === 'oracle');
      });

      return '<tr><td class="mono">' + row.name + '</td><td>' + row.checks +
        '</td><td class="mono">' + found.length + '</td><td>' +
        root.Helpers.escapeHtml(row.blind) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('cgf-oracle-table-caption',
      'With crashes alone this run finds ' + both.crash.length + ' failure' +
      (both.crash.length === 1 ? '' : 's') + '; with every oracle it finds ' + both.all.length +
      '. That difference is the entire argument of this section, and it is why the first thing '
      + 'to do with a fuzzing setup is not to make it faster but to give it something to check '
      + 'beyond "did it throw".');
  }

  function paintCorpus(study) {
    const kept = {};

    study.minimised.corpus.forEach(function (entry) { kept[entry.input] = true; });
    root.jQuery('#cgf-corpus-table tbody').html(study.run.corpus.slice(0, 12)
      .map(function (entry) {
        return '<tr><td class="mono">' + escapeInput(entry.input) + '</td><td class="mono">' +
          entry.input.length + '</td><td class="mono">' + entry.coverage.length +
          '</td><td class="mono">' + (kept[entry.input] ? 'kept' : 'dropped') + '</td></tr>';
      }).join('') + elision(study));

    root.Helpers.setText('cgf-corpus-table-caption',
      'The corpus is the fuzzer\'s memory, and every entry earned its place by covering '
      + 'something no earlier entry did. Minimisation then keeps the smallest input '
      + 'contributing each edge: ' + study.minimised.before + ' entries down to ' +
      study.minimised.after + ', ' + study.minimised.bytesBefore + ' bytes down to ' +
      study.minimised.bytesAfter + ', and the same ' + study.minimised.coverage.length +
      ' edges. That last number is the one to assert on — a smaller corpus that lost an edge '
      + 'has lost a test.');
  }

  function elision(study) {
    if (study.run.corpus.length <= 12) return '';
    return '<tr><td colspan="4">… ' + (study.run.corpus.length - 12) +
      ' more corpus entries …</td></tr>';
  }

  const MUTATORS = [
    { name: 'insert', does: 'splice a token in at a random position',
      why: 'reaches constructs the corpus has never contained' },
    { name: 'delete', does: 'remove a run of characters',
      why: 'the operator that makes inputs smaller, and the basis of shrinking' },
    { name: 'replace', does: 'overwrite a run with a token',
      why: 'changes a construct without changing the shape around it' },
    { name: 'duplicate', does: 'copy a slice of the input somewhere else',
      why: 'nesting and repetition, which is where depth limits are found' },
    { name: 'splice', does: 'join the head of one corpus entry to the tail of another',
      why: 'combines two behaviours the corpus already found, and is why the corpus matters' }
  ];

  function paintMutators() {
    root.jQuery('#cgf-mutators tbody').html(MUTATORS.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.does + '</td><td>' +
        root.Helpers.escapeHtml(row.why) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('cgf-mutators-caption',
      'None of these is clever, and that is deliberate: the intelligence in a coverage-guided '
      + 'fuzzer is in what it KEEPS, not in what it generates. The splice operator is the one '
      + 'that shows it — it can only work because the corpus holds inputs that reached '
      + 'different behaviours, so combining them is a good bet rather than a random one.');
  }

  function paintChart(app, study) {
    const host = root.jQuery('#cgf-chart')[0];
    const history = study.run.history;

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib, height: 250,
      xLabel: 'executions', yLabel: 'edges covered and corpus size',
      series: [
        { label: 'coverage — distinct behaviours reached',
          points: sample(history, 'edges') },
        { label: 'corpus — inputs kept', points: sample(history, 'corpus') }
      ],
      legendHost: root.jQuery('#cgf-legend')[0],
      summary: function () {
        return 'Coverage and corpus size against executions, over the whole run.';
      }
    });
    root.Helpers.setText('cgf-chart-note', chartNote(study));
  }

  function sample(history, field) {
    const step = Math.max(1, Math.round(history.length / 120));

    return history.filter(function (row, at) {
      return at % step === 0 || at === history.length - 1;
    }).map(function (row) {
      return { x: row.executions, y: row[field] };
    });
  }

  function chartNote(study) {
    const history = study.run.history;
    const half = history[Math.floor(history.length / 2)];
    const last = history[history.length - 1];

    return 'The curve flattens, and it always does. Half way through this run the corpus had '
      + 'reached ' + half.edges + ' of the ' + last.edges + ' edges it ends with, from ' +
      half.executions + ' of ' + last.executions + ' executions — so the second half of the '
      + 'budget bought ' + (last.edges - half.edges) + ' more. A flat curve does not mean the '
      + 'target is clean; it means these mutations have stopped reaching new behaviour, and '
      + 'the answer is a new seed, a dictionary or a grammar rather than a longer run.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
