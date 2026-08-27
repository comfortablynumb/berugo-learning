/**
 * Section: Interprocedural optimisation.
 *
 * The measurement is the escape table. Three records are allocated in one
 * program — one returned, one passed to a call that only reads it, one never
 * leaving the frame — and the analysis separates them with a REASON rather
 * than a verdict. The reason matters because the middle one is imprecise: a
 * callee that only reads its argument does not make it escape, and proving
 * that needs an interprocedural summary this analysis does not compute. A
 * verdict alone would report two escapes and give nobody a way to tell which
 * of them is real.
 *
 * The second is the call graph's indirect column. A call through a value the
 * optimiser cannot trace is not an edge it may assume away, and reporting the
 * two kinds separately is what stops a whole-program pass from believing it
 * has seen every caller.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'interprocedural-optimisation';
  let panel = null;

  const BASE = ['ssa', 'copy-propagation'];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a call is a wall, and inlining removes it',
      caption: 'On the left, the optimiser can see that the argument is the constant 5 and can ' +
        'see the body — and can do nothing with either, because the call is between them. It ' +
        'cannot fold `n + 1` because it does not know `n`; it cannot prove the record does not ' +
        'escape because it cannot see what the callee does with it. On the right the wall is ' +
        'gone and every scalar pass in 29.6 applies to a body it previously could not reach. ' +
        'That is why inlining is described as the enabling transformation rather than as an ' +
        'optimisation in its own right, and why the budget that decides where to apply it gets ' +
        'so much of a compiler\'s attention.',
      definition: [
        'graph LR',
        'A["let r = inc(5)"] --> W["the call: a wall"]',
        'W --> B["fn inc(n) { return n + 1; }"]',
        'A -.->|"cannot fold: n is unknown here"| X["nothing"]',
        'I["after inlining"] --> C["let r = 5 + 1"]',
        'C --> F["SCCP folds it to 6"]',
        'F --> D["dead-code removes the rest"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Inlining is the optimisation that unlocks the others, which is why it gets the ' +
        'budget.** A call is a wall: the optimiser cannot see that an argument is constant, ' +
        'cannot value-number across it, cannot prove a record does not escape. Removing the ' +
        'wall lets every scalar pass work on a body it could not previously reach — and it is ' +
        'why a refactor that moves code across a function boundary can change performance by a ' +
        'factor.',
      '**The heuristic is a budget rather than a rule, and every real one has this shape.** ' +
        'Inlining is unboundedly profitable and unboundedly expensive, so something has to say ' +
        'stop. Costing a site by the callee\'s size and spending from a fixed budget on the ' +
        'best ratio first is the skeleton under all the tuning.',
      '**A direct edge needs a callee the optimiser can name at that point.** A call through a ' +
        'value it cannot trace is an INDIRECT edge, and the two must be reported separately — ' +
        'because a whole-program pass that treats them as one assumes it has seen every ' +
        'caller, which is exactly the assumption that makes devirtualisation unsound.',
      '**SSA turns every direct call into an apparently indirect one unless you look ' +
        'through the copies.** Renaming makes the callee register a copy of the closure rather ' +
        'than the closure itself, so a call graph built without following move chains reports ' +
        'no direct edges at all — an inliner with nothing to do, and no error message.',
      '**Recursive edges are excluded outright here rather than depth-limited.** A depth limit ' +
        'is a second number to tune, and the exclusion is reported so the omission is visible. ' +
        'Real compilers do inline recursive calls to a bounded depth, and the number they ' +
        'choose is another benchmark-suite decision rather than a principle.',
      '**An allocation escapes when some path lets it outlive the frame: returned, stored, ' +
        'captured, or passed to a call.** Anything else can live on the stack, which costs no ' +
        'collector and no allocation. In a language with closures the question is mostly "is ' +
        'this captured", which is why M28\'s resolver recorded captures — though this ' +
        'recomputes them over the IR, because after inlining the tree it recorded them from no ' +
        'longer exists.',
      '**"Passed to a call" is the conservative rule and it costs real precision.** A record ' +
        'passed to a function that only reads it does not escape, and proving that needs an ' +
        'interprocedural summary. Reporting the reason per allocation is what makes the ' +
        'imprecision visible instead of leaving a number nobody can explain.',
      '**A tail call can reuse its frame, and recognising one is a two-instruction pattern.** ' +
        'A call whose result is returned immediately. Performing the transformation needs the ' +
        'calling convention M30 defines, so this reports the sites — which is the honest half ' +
        'of the work that can be done here.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the call graph, the budget, and what escapes',
        markup: root.InterprocTemplate.render()
      },
      diagram: diagram(),
      insight: '**Inlining is the optimisation that unlocks the others, which is why compilers ' +
        'spend so much of their budget on the heuristic — and why a small refactor across a ' +
        'function boundary can change performance by a factor.** The second half is the part ' +
        'worth carrying into ordinary work. Extracting three lines into a helper is a ' +
        'readability improvement with no runtime cost, right up to the point where the helper ' +
        'stops being inlined — because it grew past the size threshold, because it acquired a ' +
        'second caller, because it became virtual, because a loop in it made the cost estimate ' +
        'rise. Nothing about the source says which side of the line the function is on, and ' +
        'the line moves between compiler versions. That is not an argument against extracting ' +
        'functions, which is almost always right; it is an argument for knowing that the ' +
        'performance model has a cliff in it, and for measuring across the refactor rather ' +
        'than reasoning about it. The corollary for reading a profile is that a hot function ' +
        'which "should have been inlined" is a question with a real answer — most compilers ' +
        'will tell you why they declined, and the reason is usually a number you can change.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.InterprocTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const stateFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const out = root.PassLab.run(root.InterprocTemplate.SAMPLES[parts[0]], BASE);
    const program = out.program;

    return { program: program, graph: root.Berugo.Interproc.callGraph(program),
      plan: root.Berugo.Interproc.plan(program, { budget: parts[1] }),
      escapes: root.Berugo.Interproc.escapeProgram(program),
      tails: program.functions.reduce(function (sum, fn) {
        return sum + root.Berugo.Interproc.tailCalls(fn).length;
      }, 0) };
  });

  const budgetSweepFor = root.Helpers.memoise(function (sample) {
    const out = root.PassLab.run(root.InterprocTemplate.SAMPLES[sample], BASE);

    return [0, 10, 20, 40, 80, 120].map(function (budget) {
      const plan = root.Berugo.Interproc.plan(out.program, { budget: budget });

      return { budget: budget, chosen: plan.chosen.length, spent: plan.spent,
        skipped: plan.candidates.length - plan.chosen.length };
    });
  });

  const suiteFor = root.Helpers.memoise(function () {
    return root.Berugo.Spec.CONFORMANCE.map(function (entry) {
      const out = root.PassLab.run(entry.source, BASE);
      const summary = root.Berugo.Interproc.summary(out.program);

      return Object.assign({ id: entry.id }, summary);
    });
  });

  function update() {
    const values = panel.values();
    const state = stateFor(JSON.stringify([values['ip-sample'], Number(values['ip-budget'])]));

    paintGraph(state);
    paintMetrics(state);
    paintCandidates(state);
    paintEscape(state);
    paintBudget(values['ip-sample']);
    paintSuite();
  }

  function paintGraph(state) {
    const direct = state.graph.edges.map(function (edge) {
      return '<tr><td class="mono">' + edge.from + '</td><td class="mono">' + edge.to +
        '</td><td class="mono">' + edge.block + '</td><td>direct</td></tr>';
    });
    const indirect = state.graph.indirect.map(function (edge) {
      return '<tr><td class="mono">' + edge.from + '</td><td class="mono">through ' +
        edge.callee + '</td><td class="mono">' + edge.block +
        '</td><td>indirect</td></tr>';
    });

    root.jQuery('#ip-graph tbody').html(direct.concat(indirect).join('') ||
      '<tr><td colspan="4">no calls in this program</td></tr>');

    root.Helpers.setText('ip-graph-caption',
      'A direct edge names a callee the optimiser can identify at that point; an indirect one ' +
      'names only the register the call goes through. The distinction is not pedantry — a ' +
      'whole-program pass that treats an indirect call as "no callers I have not seen" will ' +
      'devirtualise something that has one, and the failure appears only when the other ' +
      'implementation is loaded.');
  }

  function paintMetrics(state) {
    const escapes = state.escapes;

    root.MetricGrid.update({
      'ip-calls': { value: state.graph.edges.length + ' / ' + state.graph.indirect.length,
        note: state.graph.recursive.length + ' of the direct edges are recursive and are ' +
          'excluded from inlining outright' },
      'ip-inlined': { value: state.plan.chosen.length + ' of ' + state.plan.candidates.length,
        note: state.plan.spent + ' spent from a budget of ' + state.plan.budget },
      'ip-stack': { value: escapes.stack + ' of ' + escapes.allocations,
        note: escapes.escaping + ' escape; the rest could live on the frame that made them' },
      'ip-tail': { value: root.Format.exact(state.tails),
        note: state.tails ? 'each could reuse its caller\'s frame, once M30 defines the convention'
          : 'no call here returns its result unchanged' }
    });
  }

  function paintCandidates(state) {
    const chosen = new Set(state.plan.chosen.map(function (row) {
      return row.from + '->' + row.to + '@' + row.block;
    }));

    root.jQuery('#ip-candidates tbody').html(state.plan.candidates.map(function (row) {
      const key = row.from + '->' + row.to + '@' + row.block;

      return '<tr><td class="mono">' + row.from + ' calls ' + row.to + ' in ' + row.block +
        '</td><td class="mono">' + row.size + '</td><td class="mono">' + row.benefit +
        '</td><td class="mono">' + root.Format.fixed(row.ratio, 2) + '</td><td>' +
        (chosen.has(key) ? 'yes' : 'no') + '</td></tr>';
    }).join('') || '<tr><td colspan="5">no inlinable call site — every call here is indirect ' +
      'or recursive</td></tr>');

    root.Helpers.setText('ip-candidates-caption',
      'Cost is the callee\'s size; benefit is the call overhead saved plus a bonus per ' +
      'constant argument, because those unlock folding in the body. Both numbers are made up, ' +
      'as every real heuristic\'s are — what matters is that they are reported per site, so ' +
      'the budget\'s decisions can be read rather than guessed at. A production inliner adds ' +
      'call-site frequency from a profile, which is the single biggest improvement available ' +
      'and needs a profile to exist.');
  }

  function paintEscape(state) {
    const rows = [];

    state.escapes.functions.forEach(function (fn) {
      fn.allocations.forEach(function (row) {
        rows.push(Object.assign({ fn: fn.fn }, row));
      });
    });

    root.jQuery('#ip-escape tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.fn + '</td><td class="mono">' + row.op +
        '</td><td class="mono">' + row.register + '</td><td>' +
        (row.escapes ? 'yes' : 'no') + '</td><td>' + root.Helpers.escapeHtml(row.why) +
        '</td></tr>';
    }).join('') || '<tr><td colspan="5">this program allocates nothing</td></tr>');

    root.Helpers.setText('ip-escape-caption',
      'The reason column is where the imprecision lives. "Returned" and "captured by a ' +
      'closure" are exact — the value genuinely outlives the frame. "Passed to a call" is ' +
      'conservative: a callee that only reads its argument does not make it escape, and ' +
      'proving that needs a summary per function that this analysis does not compute. ' +
      'Reporting the reason rather than the verdict is what makes the difference between the ' +
      'two visible instead of leaving a number nobody can explain.');
  }

  function paintBudget(sample) {
    const rows = budgetSweepFor(sample);

    root.jQuery('#ip-budget-table tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.budget + '</td><td class="mono">' + row.chosen +
        '</td><td class="mono">' + row.spent + '</td><td class="mono">' + row.skipped +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('ip-budget-table-caption',
      'Raising the budget takes more sites in ratio order, and the last column is what is ' +
      'still declined. On a small program the curve flattens quickly because there is nothing ' +
      'left to take; on a real one it does not, and the shape of that curve is what a compiler ' +
      'team argues about. A budget of zero is the useful control: it is what the rest of the ' +
      'pipeline achieves with no inlining at all.');
  }

  function paintSuite() {
    const rows = suiteFor('all');
    const allocations = rows.reduce(function (sum, row) { return sum + row.allocations; }, 0);
    const stack = rows.reduce(function (sum, row) { return sum + row.stack; }, 0);

    root.jQuery('#ip-suite tbody').html(rows.filter(function (row) {
      return row.allocations > 0 || row.calls > 0 || row.indirect > 0;
    }).map(function (row) {
      return '<tr><td class="mono">' + row.id + '</td><td class="mono">' + row.functions +
        '</td><td class="mono">' + row.calls + '</td><td class="mono">' + row.indirect +
        '</td><td class="mono">' + row.allocations + '</td><td class="mono">' + row.stack +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('ip-suite-caption',
      stack + ' of ' + allocations + ' allocations across the suite could live on the stack — ' +
      root.Format.percent(stack / allocations, 1) + '. Programs with no calls and no ' +
      'allocations are not listed. The indirect column is worth reading beside the direct one: ' +
      'every closure passed as an argument becomes an indirect call inside the callee, so a ' +
      'higher-order program has more of them, and that is the precision a devirtualisation ' +
      'pass with type feedback would be trying to recover.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
