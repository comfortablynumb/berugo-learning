/**
 * Section: Symbolic execution.
 *
 * The claim the technique makes is "this input reaches this path", and the
 * demo checks it rather than printing it: every generated model is executed by
 * `StaticLab.verifyPaths` and asserted to visit exactly the blocks its path
 * condition was collected from. A generated input that does not reach its
 * branch is the failure mode nobody notices, because the number of inputs is
 * unchanged and only their value is gone.
 *
 * The second measurement is the one that decides whether a path tree is
 * useful: how many of its leaves exist. The bounded search can only say
 * "unknown" about a path it found no model for, so the linear theory solver
 * from 32.6 is wired in to prove the impossible ones impossible — 120 of the
 * 128 leaves on the seven-branch ladder.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'symbolic-execution';
  const LADDERS = [1, 2, 3, 4, 5, 6, 7];
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
      title: 'Diagram — one fork, two paths, and what comes out of a leaf',
      caption: 'A register holds an expression rather than a number, so a branch on it cannot '
        + 'be decided and the execution forks. Each leaf carries the conjunction of the '
        + 'decisions that got it there; handing that to a solver produces either a concrete '
        + 'input that follows exactly this path, or a proof that no input does — which is a '
        + 'report of dead code.',
      definition: [
        'flowchart TD',
        'R["a is a symbol, not a number"] --> B{"if (a > 10)"}',
        'B -->|"true branch"| T["path condition: a > 10"]',
        'B -->|"false branch"| F["path condition: not (a > 10)"]',
        'T --> B2{"if (a < 5)"}',
        'B2 -->|"true"| D["a > 10 and a < 5<br/>solver: unsatisfiable"]',
        'B2 -->|"false"| S["a > 10 and not (a < 5)<br/>solver: a = 11"]',
        'D --> DD["dead code — no input reaches it"]',
        'S --> SS["a test case with a proof<br/>of reachability attached"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Symbolic execution runs the program with expressions where the values go.** A '
        + 'parameter becomes the symbol `a`; `a + 2` becomes the expression `a + 2` rather '
        + 'than a number. Nothing else about the execution changes until a decision has to be '
        + 'made about a value nobody knows.',
      '**A branch on a symbolic value cannot be decided, so the execution forks.** Both sides '
        + 'are taken, each carrying the accumulated PATH CONDITION — the conjunction of every '
        + 'decision made to get there. The path condition is the entire product of the '
        + 'technique: it is a precise, machine-checkable description of the set of inputs that '
        + 'reach this line.',
      '**Handing the path condition to a solver is what produces a test case.** A satisfying '
        + 'assignment is an input that follows exactly this path, and the demo executes every '
        + 'one of them to confirm it. That is what makes this different from fuzzing: the '
        + 'input arrives with a proof of reachability attached, rather than having happened to '
        + 'work.',
      '**An unsatisfiable path condition is a report of dead code, and it is free.** In the '
        + '`dead` fixture, `a > 10` and `a < 5` cannot both hold, so that leaf is a branch no '
        + 'input takes. Finding it costs nothing extra — the analysis was already going to ask '
        + 'the solver about that leaf.',
      '**The bounded search in this executor cannot prove a path impossible, and says so.** It '
        + 'tries every assignment in a box around zero; finding none, all it may honestly '
        + 'report is "unknown". Switch the control to the linear theory solver from 32.6 and '
        + 'the same 120 leaves of the seven-branch ladder come back proved unsatisfiable by '
        + 'variable elimination. Knowing the difference between "no answer" and "no solution" '
        + 'is the whole reason the next two sections exist.'
    ];
  }

  function moreOrientation() {
    return [
      '**Path explosion is exponential in the branches and unbounded in the loops.** Seven '
        + 'independent branches make 128 leaves; a loop with a symbolic bound has one path per '
        + 'iteration count and never finishes. The number that saves the technique is that the '
        + 'FEASIBLE paths are usually far fewer — eight of those 128 — which is why solving '
        + 'early and pruning matters more than searching fast.',
      '**Every real tool bounds the search, and a tool that hid the bound would be reporting '
        + 'coverage of the paths it happened to look at.** This one bounds depth and path '
        + 'count and reports both, including the number of paths it abandoned. Read that '
        + 'number first in any tool of this kind.',
      '**Concolic execution is the practical compromise: run concretely, collect symbolically.** '
        + 'Keep a real input, record the path condition as it runs, then negate one decision '
        + 'and solve for the next input. It never gets stuck on something the solver cannot '
        + 'model, because the concrete value is always there to fall back on — which is how a '
        + 'symbolic engine survives a hash function.',
      '**The fragment matters as much as the search.** This executor is affine: a constant plus '
        + 'a weighted sum of symbols. A product of two symbols leaves that fragment, and the '
        + 'value is marked OPAQUE rather than approximated — the `opaque` fixture forks on a '
        + 'condition it cannot express, so both leaves survive with no constraint and the '
        + 'inputs it generates prove nothing.',
      '**Environment modelling is where the effort actually goes.** A path through code that '
        + 'reads a file, calls a library or allocates must have a model of that behaviour, or '
        + 'the engine either stops or invents. Published engines are mostly a solver, a search '
        + 'heuristic, and years of environment models.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation().concat(moreOrientation()),
      demo: { title: 'Interactive demo — the path tree, and an input per leaf',
        markup: root.SymbolicTemplate.render() },
      diagram: diagram(),
      insight: '**Symbolic execution produces test cases with a proof of reachability '
        + 'attached, and that is qualitatively different from a fuzzer finding the same '
        + 'input.** The practical consequence is about where each one belongs. Symbolic '
        + 'execution is the tool for a bounded, self-contained, arithmetic-heavy piece of code '
        + 'where you want every path covered and you want to know which paths do not exist: a '
        + 'parser of a fixed-width header, a permission check, an index calculation, a state '
        + 'machine transition. It is the wrong tool for a system that talks to a database on '
        + 'every third line, because each of those calls needs a model and a wrong model is '
        + 'worse than no analysis. The second thing to take away is the dead-path report. Most '
        + 'engineers reach for this technique wanting inputs, and the unsatisfiable leaves are '
        + 'the finding that changes code: a branch no input can take is either a bug in the '
        + 'condition, a redundant check, or a piece of defensive code whose author was wrong '
        + 'about what could happen — and all three are worth a review comment. The third is a '
        + 'warning. When one of these tools reports coverage, ask what it did with the paths it '
        + 'abandoned. A tool that explored 200 paths of a 4 000-path function and reported '
        + '"all paths covered" is not lying about the 200; it is quietly redefining "all".'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.SymbolicTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const sample = root.SymbolicTemplate.SAMPLES[parts[0]];
    const compiled = root.StaticLab.compile(sample.source);
    const fn = named(compiled.program, sample.name);
    const run = root.SymbolicExec.execute(fn, { names: sample.names,
      paths: parts[2], depth: parts[3], decide: parts[1] === 'linear' ? 'linear' : null });

    return { sample: sample, fn: fn, run: run,
      verified: root.StaticLab.verifyPaths(fn, run.paths, { names: sample.names }),
      counts: countVerdicts(run) };
  });

  function named(program, name) {
    return program.functions.filter(function (fn) { return fn.name === name; })[0]
      || program.functions[0];
  }

  function countVerdicts(run) {
    const counts = { sat: 0, unsat: 0, unknown: 0 };

    run.paths.forEach(function (path) { counts[path.verdict] += 1; });
    return counts;
  }

  /** The ladder at one to seven branches: the tree against the part of it a
   *  solver says exists. */
  const explosionFor = root.Helpers.memoise(function () {
    return LADDERS.map(function (branches) {
      const compiled = root.StaticLab.compile(root.SymbolicTemplate.ladder(branches));
      const fn = named(compiled.program, 'ladder');
      const run = root.SymbolicExec.execute(fn,
        { names: ['a'], paths: 400, depth: 80, decide: 'linear' });

      return { branches: branches, paths: run.paths.length, feasible: run.feasible,
        dead: run.paths.filter(function (path) { return path.verdict === 'unsat'; }).length };
    });
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(JSON.stringify([values['sye-sample'], values['sye-decide'],
      values['sye-paths'], values['sye-depth']]));

    paintSource(study);
    paintMetrics(study);
    paintTree(study);
    paintCoverage(study);
    paintBounds();
    paintChart(app);
  }

  function paintSource(study) {
    root.jQuery('#sye-source').text(study.sample.source);
    root.Helpers.setText('sye-source-caption', 'This fixture has ' + study.sample.about +
      '. The symbols are the parameters — ' + study.sample.names.join(', ') + ' — and the '
      + 'executor forked ' + study.run.forks + ' time' + (study.run.forks === 1 ? '' : 's') +
      ', which is once per branch on a value it could not decide.');
  }

  function paintMetrics(study) {
    const covered = coverage(study);

    root.MetricGrid.update({
      'sye-paths-found': { value: study.run.paths.length,
        note: study.run.forks + ' forks over the branches it reached' },
      'sye-feasible': { value: study.counts.sat,
        note: 'each carries a concrete input that follows it' },
      'sye-dead': { value: study.counts.unsat,
        note: study.counts.unsat ? 'no input reaches these leaves at all'
          : 'nothing here was proved impossible' },
      'sye-unknown': { value: study.counts.unknown,
        note: study.counts.unknown ? 'the bounded search found no model and no proof'
          : 'every leaf was decided one way or the other' },
      'sye-truncated': { value: study.run.truncated,
        note: study.run.truncated ? 'the budget stopped the search before the tree ended'
          : 'the whole tree fitted inside the budget' },
      'sye-verified': { value: study.verified.reached + ' of ' + study.verified.checked,
        note: covered.reached + ' of ' + covered.total + ' blocks reached by these inputs' }
    });
  }

  function coverage(study) {
    const seen = {};

    study.verified.rows.forEach(function (row) {
      row.visited.forEach(function (block) { seen[block] = true; });
    });
    return { reached: Object.keys(seen).length, total: study.fn.blocks.length, seen: seen };
  }

  function paintTree(study) {
    const rows = study.run.paths.map(function (path, at) {
      const check = study.verified.rows.filter(function (row) {
        return row.condition.join('|') === path.condition.join('|');
      })[0];

      return '<tr' + (path.verdict === 'unsat' ? ' class="row-bad"' : '') +
        '><td class="mono">' + path.blocks.join(' → ') + '</td><td class="mono">' +
        (path.condition.join(' and ') || 'no constraint') + '</td><td class="mono">' +
        verdictText(path) + '</td><td class="mono">' + modelText(path) +
        '</td><td class="mono">' + reachedText(path, check, at) + '</td></tr>';
    });

    root.jQuery('#sye-tree tbody').html(elide(rows).join(''));
    root.Helpers.setText('sye-tree-caption', treeCaption(study));
  }

  function elide(rows) {
    const KEEP = 14;

    if (rows.length <= KEEP + 1) return rows;
    return rows.slice(0, KEEP).concat(['<tr><td colspan="5">… ' + (rows.length - KEEP) +
      ' more leaves, same shape …</td></tr>']);
  }

  function verdictText(path) {
    if (path.verdict === 'sat') return 'reachable';
    if (path.verdict === 'unsat') return 'IMPOSSIBLE';
    return 'undecided';
  }

  function modelText(path) {
    if (!path.model) return path.why || '—';
    return Object.keys(path.model).map(function (name) {
      return name + ' = ' + path.model[name];
    }).join(', ') || 'any input';
  }

  function reachedText(path, check) {
    if (path.verdict !== 'sat') return 'no input to run';
    if (!check) return 'not checked';
    return check.reached ? 'yes — visited ' + check.visited.join(' → ')
      : 'NO — visited ' + check.visited.join(' → ');
  }

  function treeCaption(study) {
    const missed = study.verified.missed.length;

    if (missed && opaqueHere(study)) {
      return missed + ' generated input did not follow the path it was generated for, and the '
        + 'path condition says why: it mentions `opaque`. A product of two symbols is outside '
        + 'the affine fragment, so the executor recorded no constraint for that branch and the '
        + '"input" it produced is an arbitrary one. This is the honest failure of the '
        + 'technique — outside its fragment it generates inputs that prove nothing — and it is '
        + 'visible here only because every input is executed and checked.';
    }
    if (missed) {
      return missed + ' generated input(s) did NOT follow the path they were generated for, '
        + 'which is a defect in the executor rather than a limitation of the technique: a '
        + 'model that satisfies the path condition and takes a different path means the '
        + 'condition does not describe the path.';
    }
    return 'Every reachable leaf carries an input, and every one of those inputs was executed '
      + 'and confirmed to visit exactly the blocks the leaf was collected from — ' +
      study.verified.reached + ' of ' + study.verified.checked + '. That check is the whole '
      + 'value proposition of the technique, and it is cheap: the concrete run costs less than '
      + 'the solve that produced the input.';
  }

  function opaqueHere(study) {
    return study.run.paths.some(function (path) {
      return path.condition.join(' ').indexOf('opaque') !== -1;
    });
  }

  function paintCoverage(study) {
    const seen = {};

    study.verified.rows.forEach(function (row, at) {
      row.visited.forEach(function (block) {
        seen[block] = seen[block] || { first: at, count: 0 };
        seen[block].count += 1;
      });
    });
    root.jQuery('#sye-coverage tbody').html(study.fn.blocks.map(function (block) {
      return coverageRow(study, block, seen[block.id]);
    }).join(''));
    root.Helpers.setText('sye-coverage-caption', coverageCaption(study));
  }

  function coverageRow(study, block, hit) {
    const model = hit ? study.verified.rows[hit.first].model : null;

    return '<tr' + (hit ? '' : ' class="row-bad"') + '><td class="mono">' + block.id +
      '</td><td class="mono">' + (hit ? 'yes' : 'NOT REACHED') + '</td><td class="mono">' +
      (model ? (Object.keys(model).map(function (name) {
        return name + ' = ' + model[name];
      }).join(', ') || 'any input') : '—') + '</td><td class="mono">' +
      (hit ? hit.count : 0) + '</td></tr>';
  }

  function coverageCaption(study) {
    const covered = coverage(study);

    if (covered.reached === covered.total) {
      return 'The generated inputs reach all ' + covered.total + ' blocks. That is what "path '
        + 'coverage implies block coverage" means in practice, and it is a stronger statement '
        + 'than a coverage tool makes: these inputs were derived from the paths rather than '
        + 'measured after the fact.';
    }
    return 'The inputs reach ' + covered.reached + ' of ' + covered.total + ' blocks. A block '
      + 'nothing reaches is either dead — no input can execute it, which the unsatisfiable '
      + 'leaves above will have said — or the search was cut off before it got there. Those '
      + 'are very different findings and the truncation count is how you tell them apart.';
  }

  const BOUNDS = [
    { name: 'depth limit', bounds: 'how far down one path the executor will go',
      cost: 'a loop is explored for a fixed number of iterations and no more',
      wild: 'every engine has one; KLEE calls it the maximum instruction depth' },
    { name: 'path or fork limit', bounds: 'how many leaves are kept in total',
      cost: 'the paths you get are the ones the search order happened to reach first',
      wild: 'the "state" limit, and the reason search heuristics exist' },
    { name: 'state merging', bounds: 'the width of the tree, by joining two paths into one',
      cost: 'the merged path condition is a disjunction, which is harder to solve',
      wild: 'veritesting, and dynamic state merging' },
    { name: 'function summaries', bounds: 'reanalysis, by solving a callee once',
      cost: 'a summary is an approximation, and a wrong one is invisible',
      wild: 'compositional symbolic execution, SMART' },
    { name: 'concolic fallback', bounds: 'nothing — it keeps a concrete value beside the symbol',
      cost: 'one path at a time, so it explores rather than enumerates',
      wild: 'DART, CUTE, SAGE, and most industrial deployments' }
  ];

  function paintBounds() {
    root.jQuery('#sye-bounds tbody').html(BOUNDS.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.bounds + '</td><td>' +
        root.Helpers.escapeHtml(row.cost) + '</td><td>' +
        root.Helpers.escapeHtml(row.wild) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('sye-bounds-caption',
      'The first two are budgets and the last three are engineering. A budget is honest and '
      + 'blunt: it stops, and it tells you it stopped. Merging and summarising buy width and '
      + 'depth at the price of precision that is hard to see afterwards, which is why the '
      + 'concolic fallback — keep a real input beside the symbol and never get stuck — is what '
      + 'most industrial engines actually run.');
  }

  function paintChart(app) {
    const host = root.jQuery('#sye-chart')[0];
    const rows = explosionFor('ladders');

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib, height: 250, logY: true,
      xLabel: 'independent branches in the function', yLabel: 'paths (log scale)',
      series: [
        { label: 'leaves of the tree — 2 to the power of the branches',
          points: rows.map(function (row) { return { x: row.branches, y: row.paths }; }) },
        { label: 'leaves an input can actually reach',
          points: rows.map(function (row) { return { x: row.branches, y: row.feasible }; }) }
      ],
      legendHost: root.jQuery('#sye-legend')[0],
      summary: function () { return chartNote(rows); }
    });
    root.Helpers.setText('sye-chart-note', chartNote(rows));
  }

  function chartNote(rows) {
    const last = rows[rows.length - 1];

    return 'The same ladder with one to ' + last.branches + ' branches, each comparing the one '
      + 'parameter against a different constant. The tree doubles per branch and reaches ' +
      last.paths + ' leaves; the number an input can reach grows by one per branch and reaches '
      + last.feasible + '. The other ' + last.dead + ' are proved impossible by the linear '
      + 'theory solver, because the conditions are ordered comparisons on one variable and '
      + 'most combinations of them contradict. This gap is why symbolic execution works at all '
      + 'on real code, and why an engine that solves lazily — exploring first and checking '
      + 'later — does exponentially more work than one that prunes at the fork.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
