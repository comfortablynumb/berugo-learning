/**
 * Section: Scalar optimisations.
 *
 * The measurement is the SCCP fixture. `let flag = false; let n = if flag
 * { 1 / 0 } else { 7 };` cannot be folded by constant propagation alone,
 * because the division sits on a branch propagation cannot prove dead — and it
 * must not be folded, because dividing by zero at compile time is either a
 * crash or a silent infinity. SCCP proves the branch unreachable and the
 * division never happens, so the whole expression collapses. The demo runs the
 * separate passes and the combined one over the same program and reports both
 * instruction counts.
 *
 * The second is phase ordering: the same two passes in both orders over the
 * same program, with the counts. Neither order wins everywhere, which is why
 * "-O2 made it slower" is a real bug report.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'scalar-optimisations';
  let panel = null;

  const PIPELINES = {
    full: ['ssa', 'sccp', 'copy-propagation', 'value-numbering', 'peephole', 'dead-code'],
    sccp: ['ssa', 'sccp', 'dead-code'],
    plain: ['ssa', 'copy-propagation', 'peephole', 'dead-code'],
    none: ['ssa']
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — SCCP\'s two lattices, feeding each other',
      caption: 'Constant propagation tracks a value per register; unreachable-code elimination ' +
        'tracks a flag per block. Run separately, each is blocked by what the other knows: ' +
        'propagation cannot fold a value guarded by a condition it has not proved false, and ' +
        'elimination cannot prove the branch dead without knowing the condition is constant. ' +
        'Run to a JOINT fixpoint, each unblocks the other — a constant condition marks one ' +
        'successor unreachable, and a phi then meets only the operands arriving on live edges, ' +
        'so a value that is constant on every reachable path stays constant. That last clause ' +
        'is the whole of the combination.',
      definition: [
        'graph TD',
        'V["value lattice: ⊤ · a constant · ⊥"] --> B{"is a branch condition constant?"}',
        'B -->|yes| E["mark one successor unreachable"]',
        'E --> P["a phi meets only the live edges"]',
        'P --> V',
        'B -->|no| N["both successors stay reachable"]',
        'N --> P'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Every pass here is stated in terms of "the definition of this value", which SSA made ' +
        'a pointer.** Copy propagation, dead-code elimination and value numbering are a few ' +
        'dozen lines each in SSA form and would each need a dataflow analysis without it. That ' +
        'is the return on 29.4, collected here.',
      '**Copy propagation is the pass that makes SSA output readable.** Renaming turns every ' +
        'load of a promoted slot into a copy, so a freshly constructed function is full of ' +
        'them. Construction deliberately leaves them rather than trying to be clever: a simple ' +
        'construction plus a simple cleanup is easier to get right than one pass doing both.',
      '**Dead-code elimination is mark and sweep over uses, not a liveness analysis.** Start ' +
        'from what must run — terminators, stores, calls — and keep everything they ' +
        'transitively read. What is left computes a value nobody reads. The roots must also ' +
        'include the function\'s RESULTS, or the pass correctly proves the whole program dead ' +
        'and deletes it.',
      '**A call is kept whatever its result, and that is a real precision loss.** This IR has ' +
        'no purity information and `print` is a call, so removing one removes an effect the ' +
        'optimiser cannot see. Naming the limitation is better than a pass that is right most ' +
        'of the time about effects.',
      '**Value numbering is only valid where the earlier computation DOMINATES the later ' +
        'one.** Two identical expressions on sibling branches are not redundant — replacing ' +
        'the second with the first reads a register that may not have been defined on this ' +
        'path. Walking the dominator tree with a scoped table is what makes the restriction ' +
        'automatic rather than remembered.',
      '**SCCP is more than the sum of constant propagation and reachability.** Each is blocked ' +
        'by what the other knows; run to a joint fixpoint each unblocks the other. The demo\'s ' +
        'fixture is a division by zero on a branch that cannot be taken — propagation alone ' +
        'must leave it, and SCCP removes the branch and the division with it.',
      '**A fold that could fault must not be folded.** Dividing by zero at compile time either ' +
        'crashes the compiler or silently produces an infinity, and both are wrong: the ' +
        'program is entitled to fault at run time and the optimiser is not entitled to decide ' +
        'it does not. Every folder here refuses the faulting cases explicitly.',
      '**Phase ordering is genuinely unsolved.** A then B and B then A produce different code, ' +
        'and no fixed order is optimal for every program — which is why real compilers run ' +
        'passes repeatedly in a tuned order, and why "-O2 made it slower" is a real bug report ' +
        'rather than a misunderstanding.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — a pass pipeline, its gates, and two orders of the same passes',
        markup: root.ScalarTemplate.render()
      },
      diagram: diagram(),
      insight: '**Phase ordering is genuinely unsolved: real compilers run passes repeatedly ' +
        'in a tuned order because no fixed order is optimal, and that is why "-O2 made it ' +
        'slower" is a real bug report.** The reason it is unsolved rather than merely hard is ' +
        'that passes enable each other in both directions. Constant propagation exposes ' +
        'redundant expressions for value numbering; value numbering exposes constants for ' +
        'propagation. Inlining enables everything and increases code size, which makes later ' +
        'passes slower and can push a loop out of the instruction cache. There is no ordering ' +
        'that is best for all programs, and finding the best ordering for one program is a ' +
        'search over a space that grows factorially. What real compilers do instead is fix an ' +
        'order by measurement over a benchmark suite and run the cheap passes several times, ' +
        'which is why a pipeline listing looks repetitive. The practical consequence for ' +
        'anyone reporting a performance regression is that the honest question is never "is ' +
        'the optimiser broken" but "did this code move to the other side of a pass boundary" — ' +
        'and the two-column table above is the smallest possible demonstration that the ' +
        'question is real.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ScalarTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const runFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    return root.PassLab.run(root.ScalarTemplate.SAMPLES[parts[0]], PIPELINES[parts[1]]);
  });

  const comparisonFor = root.Helpers.memoise(function (sample) {
    const source = root.ScalarTemplate.SAMPLES[sample];

    return Object.keys(PIPELINES).map(function (id) {
      const out = root.PassLab.run(source, PIPELINES[id]);
      const sccp = out.steps.find(function (step) { return step.pass === 'sccp'; });
      const totals = sumReports(sccp);

      return { id: id, instructions: out.instructions,
        blocks: totals.blocks, branches: totals.branches,
        folded: totals.folded, ok: out.ok };
    });
  });

  /** One row per pass covers every function, so a total is a sum. */
  function sumReports(step) {
    const totals = { blocks: 0, branches: 0, folded: 0 };

    if (!step) return totals;
    step.reports.forEach(function (report) {
      totals.blocks += report.blocks || 0;
      totals.branches += report.branches || 0;
      totals.folded += report.folded || 0;
    });
    return totals;
  }

  const orderingFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);

    if (parts[0] === parts[1]) return null;
    return Object.keys(root.ScalarTemplate.SAMPLES).map(function (id) {
      return Object.assign({ id: id },
        root.PassLab.ordering(root.ScalarTemplate.SAMPLES[id], parts[0], parts[1]));
    });
  });

  const suiteFor = root.Helpers.memoise(function () {
    return root.PassLab.suite(PIPELINES.full);
  });

  const rulesFor = root.Helpers.memoise(function (sample) {
    const here = countRules(root.ScalarTemplate.SAMPLES[sample]);
    const everywhere = {};

    root.Berugo.Spec.CONFORMANCE.forEach(function (entry) {
      const counts = countRules(entry.source);

      Object.keys(counts).forEach(function (id) {
        everywhere[id] = (everywhere[id] || 0) + counts[id];
      });
    });
    return { here: here, everywhere: everywhere };
  });

  /** Summed over every function, not just the first the lowering emitted. */
  function countRules(source) {
    const out = root.PassLab.run(source, PIPELINES.full);
    const step = out.steps.find(function (entry) { return entry.pass === 'peephole'; });
    const counts = {};

    if (!step) return counts;
    step.reports.forEach(function (report) {
      Object.keys(report.rules || {}).forEach(function (id) {
        counts[id] = (counts[id] || 0) + report.rules[id];
      });
    });
    return counts;
  }

  function update() {
    const values = panel.values();
    const state = runFor(JSON.stringify([values['so-sample'], values['so-pipeline']]));

    paintListing(state);
    paintMetrics(state, values['so-sample']);
    paintPasses(state);
    paintSccp(values['so-sample']);
    paintOrdering(JSON.stringify([values['so-order-a'], values['so-order-b']]));
    paintRules(values['so-sample']);
    paintSuite();
  }

  function paintListing(state) {
    root.AstView.render(document.getElementById('so-listing'),
      '<pre class="ir-listing">' +
      root.CfgView.escapeHtml(root.Berugo.Ir.showFunction(state.program.functions[0])) +
      '</pre>');

    root.Helpers.setText('so-listing-caption',
      'The result of the chosen pipeline. Switching to "SSA construction only" shows what the ' +
      'passes started from — a function full of copies, one per promoted load — and the ' +
      'difference between that and the full pipeline is what the five passes are worth on ' +
      'this program.');
  }

  function paintMetrics(state, sample) {
    const first = state.steps.length ? state.steps[0].before : state.instructions;
    const sccp = state.steps.find(function (step) { return step.pass === 'sccp'; });
    const totals = sumReports(sccp);
    const dead = state.steps.find(function (step) { return step.pass === 'dead-code'; });

    root.MetricGrid.update({
      'so-size': { value: first + ' → ' + state.instructions,
        note: first === state.instructions ? 'unchanged by this pipeline'
          : root.Format.percent((first - state.instructions) / first, 1) + ' removed' },
      'so-folded': { value: root.Format.exact(totals.folded),
        note: sccp ? totals.blocks + ' blocks proved unreachable, ' +
          totals.branches + ' branches straightened' : 'SCCP is not in this pipeline' },
      'so-dead': { value: root.Format.exact(dead ? dead.changed : 0),
        note: dead ? 'reached from nothing that has to run'
          : 'dead-code elimination is not in this pipeline' },
      'so-agrees': { value: state.ok ? 'yes' : 'NO',
        note: state.ok ? 'verified, SSA still holds, and the answer is unchanged after every pass'
          : state.firstFailure.pass + ': ' + state.firstFailure.why }
    });
  }

  function paintPasses(state) {
    root.jQuery('#so-passes tbody').html(state.steps.map(function (step) {
      return '<tr><td class="mono">' + step.pass + '</td><td class="mono">' + step.before +
        ' → ' + step.after + '</td><td class="mono">' + step.changed + '</td><td>' +
        (step.verified ? 'yes' : 'NO') + '</td><td>' + (step.dominance ? 'yes' : 'NO') +
        '</td><td>' + (step.agrees ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('so-passes-caption',
      'Three gates after every pass, and each catches something different. The verifier names ' +
      'a broken invariant at the pass that broke it. The SSA check states the two invariants ' +
      'the verifier cannot without a dominator tree. The differential run is the only one that ' +
      'can see a pass producing perfectly valid IR that computes the wrong thing — which is ' +
      'the failure mode that matters, and the one a verifier alone would let through.');
  }

  function paintSccp(sample) {
    const rows = comparisonFor(sample);
    const labels = { full: 'the full pipeline', sccp: 'SCCP alone',
      plain: 'folding without reachability', none: 'SSA construction only' };

    root.jQuery('#so-sccp tbody').html(rows.map(function (row) {
      return '<tr><td>' + labels[row.id] + '</td><td class="mono">' + row.instructions +
        '</td><td class="mono">' + row.blocks + '</td><td class="mono">' + row.branches +
        '</td><td class="mono">' + row.folded + '</td></tr>';
    }).join(''));

    root.Helpers.setText('so-sccp-caption', sccpCaption(rows));
  }

  function sccpCaption(rows) {
    const withSccp = rows.find(function (row) { return row.id === 'sccp'; });
    const without = rows.find(function (row) { return row.id === 'plain'; });

    return 'The middle two rows are the comparison. Folding without reachability reaches ' +
      without.instructions + ' instructions; SCCP reaches ' + withSccp.instructions +
      ', proving ' + withSccp.blocks + ' block' + (withSccp.blocks === 1 ? '' : 's') +
      ' unreachable and straightening ' + withSccp.branches + ' branch' +
      (withSccp.branches === 1 ? '' : 'es') + ' along the way. On the guarded fixture the ' +
      'difference is a division by zero: propagation alone must leave it, because it sits on ' +
      'a branch propagation cannot prove dead and folding it would be wrong. SCCP proves the ' +
      'branch dead and the division goes with it — which is not a better folder, it is a ' +
      'different question answered.';
  }

  function paintOrdering(key) {
    const rows = orderingFor(key);

    if (!rows) {
      root.jQuery('#so-order tbody').html('<tr><td colspan="4">choose two different ' +
        'passes to compare</td></tr>');
      root.Helpers.setText('so-order-caption',
        'The two controls are set to the same pass, so there is nothing to compare.');
      return;
    }
    root.jQuery('#so-order tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' +
        row.first.instructions + '</td><td class="mono">' + row.second.instructions +
        '</td><td class="mono">' + (row.same ? 'none' : row.difference) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('so-order-caption', orderingCaption(rows));
  }

  function orderingCaption(rows) {
    const differing = rows.filter(function (row) { return !row.same; });
    const eitherWay = differing.filter(function (row) { return row.difference > 0; }).length;

    if (!differing.length) {
      return 'These two passes commute on every fixture here — the same code either way. That ' +
        'is a real answer and not a failed demonstration: some pairs genuinely do not ' +
        'interact, and knowing which is how a pipeline gets shortened.';
    }
    return differing.length + ' of ' + rows.length + ' fixtures give different code depending ' +
      'on the order, and ' + eitherWay + ' of those favour the second order. That is the ' +
      'phase-ordering problem in miniature: neither order dominates, so a compiler has to pick ' +
      'one by measurement over a benchmark suite and accept that some program somewhere gets ' +
      'the worse of it. Running the cheap passes twice is the usual mitigation, and it is why ' +
      'a real pipeline listing looks repetitive.';
  }

  function paintRules(sample) {
    const counts = rulesFor(sample);

    root.jQuery('#so-rules tbody').html(root.Berugo.PassesScalar.RULES.map(function (rule) {
      return '<tr><td class="mono">' + rule.id + '</td><td>' +
        root.Helpers.escapeHtml(rule.about) + '</td><td class="mono">' +
        (counts.here[rule.id] || 0) + '</td><td class="mono">' +
        (counts.everywhere[rule.id] || 0) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('so-rules-caption',
      'Five rules, each sound only because the IR is typed: `x * 0` is `0` for a number and is ' +
      'not for a string, so without the type the rule would have to be dropped. The last ' +
      'column is the honest one — most of these fire rarely or never on real code, and a ' +
      'peephole rule that never fires is dead weight in the pipeline. Counting them is how a ' +
      'compiler decides which rules to keep.');
  }

  function paintSuite() {
    const suite = suiteFor('all');

    root.jQuery('#so-suite tbody').html(suite.rows.map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.before +
        '</td><td class="mono">' + row.after + '</td><td class="mono">' + row.removed +
        '</td><td class="mono">' + root.Format.fixed(row.ratio, 2) + '</td><td>' +
        (row.ok ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('so-suite-caption',
      suite.passed + ' of ' + suite.total + ' programs pass every gate after every pass, and ' +
      'the pipeline removes ' + (suite.before - suite.after) + ' of ' + suite.before +
      ' instructions across the suite — ' +
      root.Format.percent((suite.before - suite.after) / suite.before, 1) + '. The ratio ' +
      'column is worth reading rather than the total: a program that shrinks to a third had ' +
      'most of its work proved unnecessary, and one that barely moves was already close to ' +
      'what the passes can express. Neither is a failure, and averaging them would hide both.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
