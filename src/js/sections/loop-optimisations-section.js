/**
 * Section: Loop optimisations.
 *
 * The measurement is the trap fixture, and it is the whole section. `while
 * n < d { acc = acc + 100 / d; }` with `d = 0` never runs its body, so the
 * division never happens. The division is loop-invariant, so a hoist is
 * tempting — and hoisting it into the preheader runs it once, on a path where
 * the loop body ran zero times, and divides by zero.
 *
 * Both versions are here and both are run. The safe one hoists four things and
 * refuses one with a reason; the naive one hoists five and turns a working
 * program into a runtime fault. That is a safety condition demonstrated rather
 * than asserted, which is the only form in which anybody believes one.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'loop-optimisations';
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
      title: 'Diagram — hoisting into the preheader, and the condition on it',
      caption: 'A preheader is a block that runs once, immediately before the loop, and that ' +
        'every entry passes through — so it is the only place a computation can be moved to ' +
        'and still be available inside. The condition on the move is the whole of this ' +
        'section. A computation that cannot fault may be hoisted freely: running it once when ' +
        'the body ran zero times costs a little and changes nothing. One that CAN fault may ' +
        'only be hoisted if its block dominates every exit of the loop, which is to say that ' +
        'if the loop runs at all, that block runs — so the fault would have happened anyway. ' +
        'A division inside a conditional in the body fails that test however invariant it is.',
      definition: [
        'graph TD',
        'B["before the loop"] --> P["preheader — runs exactly once"]',
        'P --> H["header: tests the guard"]',
        'H -->|"true"| Y["body"]',
        'Y --> H',
        'H -->|"false"| X["after"]',
        'P -.->|"safe: cannot fault"| OK["hoist freely"]',
        'P -.->|"can fault"| Q{"does its block dominate every loop exit?"}',
        'Q -->|yes| OK',
        'Q -->|no| NO["leave it where it is"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A loop body runs many times and the preheader runs once, which is the entire ' +
        'economic argument.** Moving one instruction out of a body that runs a thousand times ' +
        'saves nine hundred and ninety-nine executions of it. That is why loop optimisation is ' +
        'where the measurable wins are, and why the safety conditions are worth being careful ' +
        'about — the payoff makes the temptation strong.',
      '**Invariance is a fixpoint, not a single sweep.** A value is loop-invariant when every ' +
        'operand is defined outside the loop or is itself invariant, and one invariant ' +
        'definition can make another invariant. Stopping after one pass finds only the ' +
        'shallowest, which looks like the pass working and quietly leaves most of the win.',
      '**Hoisting a computation that can fault is only legal if it would have run anyway.** ' +
        'The condition is dominance: the instruction\'s block must dominate every exit of the ' +
        'loop, so entering the loop at all guarantees reaching it. That single sentence is ' +
        'where most hand-written loop optimisations become bugs.',
      '**Only two operations in this instruction set can fault, and the list is a whitelist.** ' +
        'Division and remainder by zero. Everything else is total. `mayFault` is a whitelist ' +
        'rather than a blacklist deliberately: a new opcode should be unsafe to hoist until ' +
        'somebody has thought about it, not safe by default because nobody added it to a list.',
      '**Loads are excluded from hoisting entirely here, and that is an admission.** A load can ' +
        'only be moved out of a loop if nothing in the loop writes the same memory, which is ' +
        'the aliasing question 29.9 is about. Without that analysis the honest answer is to ' +
        'refuse, and the section says so rather than hoisting and hoping.',
      '**A basic induction variable is a phi at the header whose back-edge value is itself ' +
        'plus an invariant.** That pattern is small enough that failing to look for it is the ' +
        'only reason not to, and recognising it is the precondition for strength reduction, ' +
        'for bounds analysis, and for knowing a loop\'s trip count at all.',
      '**Nesting depth is what a cost model multiplies by, and the multiplication is ' +
        'assumed.** An inner loop\'s body runs once per iteration of every loop enclosing it. ' +
        'Without a static trip count the factor has to be assumed — this demo assumes ten per ' +
        'level and says so, because an unlabelled assumption in a cost column is how a ' +
        'heuristic becomes folklore.',
      '**Unswitching is reported here rather than performed, and the reason is the ' +
        'verifier.** Hoisting an invariant branch out of a loop means duplicating the loop, ' +
        'which needs a block cloner; a pass that duplicates blocks without one produces IR the ' +
        'verifier rejects. Reporting the opportunity honestly is better than shipping a ' +
        'transformation that fails its own gate.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the safe hoist, the naive one, and the program between them',
        markup: root.LoopOptTemplate.render()
      },
      diagram: diagram(),
      insight: '**Hoisting a division or a load out of a loop is only legal if it cannot trap ' +
        'or fault when the loop body would not have executed; that single condition is where ' +
        'most hand-written "optimisations" become bugs.** The reason it catches people is that ' +
        'the transformation is obviously correct in the case everyone pictures — a loop that ' +
        'runs, an expression that does not change, a computation moved to where it happens ' +
        'once instead of a thousand times. Every part of that is true. What the picture omits ' +
        'is the loop that runs zero times, and a loop guard is very often precisely the check ' +
        'that makes the body safe: `while n < d` with `d` zero is not an edge case, it is the ' +
        'empty-input case that every program has. Move a division by `d` above that guard and ' +
        'the program faults on input it used to handle. The general form is worth carrying: an ' +
        'optimisation that moves code EARLIER has to justify itself against every path where ' +
        'the code would not have run, and the justification is nearly always a dominance ' +
        'question. The demo has both versions because a safety condition nobody has watched ' +
        'fail is a safety condition somebody will eventually remove for being in the way.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.LoopOptTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const runFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const source = root.LoopOptTemplate.SAMPLES[parts[0]];
    const pipeline = BASE.concat([parts[1] ? 'licm' : 'licm-naive']);
    const out = root.PassLab.run(source, pipeline);
    const step = out.steps[out.steps.length - 1];

    return { out: out, step: step,
      hoisted: sum(step, 'hoisted'), refused: sum(step, 'refused'),
      reasons: step.reports.reduce(function (all, row) {
        return all.concat(row.reasons || []);
      }, []) };
  });

  function sum(step, field) {
    return step.reports.reduce(function (total, row) { return total + (row[field] || 0); }, 0);
  }

  const comparisonFor = root.Helpers.memoise(function (sample) {
    return [true, false].map(function (safe) {
      const state = runFor(JSON.stringify([sample, safe]));

      return { safe: safe, hoisted: state.hoisted, refused: state.refused,
        before: state.out.baseline.outcome,
        after: root.Berugo.IrInterp.run(state.out.program).outcome,
        agrees: state.step.agrees, why: state.step.why };
    });
  });

  const loopsFor = root.Helpers.memoise(function (sample) {
    const out = root.PassLab.run(root.LoopOptTemplate.SAMPLES[sample], BASE);
    const fn = out.program.functions[out.program.functions.length - 1];

    return { report: root.Berugo.PassesLoop.report(fn),
      induction: root.Berugo.PassesLoop.inductionVariables(fn),
      unswitch: root.Berugo.PassesLoop.unswitchOpportunities(fn) };
  });

  function update() {
    const values = panel.values();
    const state = runFor(JSON.stringify([values['lo-sample'], Boolean(values['lo-safe'])]));
    const loops = loopsFor(values['lo-sample']);

    paintListing(state);
    paintMetrics(state, loops);
    paintComparison(values['lo-sample']);
    paintRefusals(state);
    paintLoops(loops);
    paintInduction(loops);
    paintUnswitch(loops);
  }

  function paintListing(state) {
    const fn = state.out.program.functions[state.out.program.functions.length - 1];

    root.AstView.render(document.getElementById('lo-listing'),
      '<pre class="ir-listing">' +
      root.CfgView.escapeHtml(root.Berugo.Ir.showFunction(fn)) + '</pre>');

    root.Helpers.setText('lo-listing-caption',
      'The preheader is the block just before the loop header — everything hoisted landed ' +
      'there. Reading it beside the body is the clearest picture of what the pass did: the ' +
      'instructions that moved are the ones that would have been recomputed identically on ' +
      'every iteration.');
  }

  function paintMetrics(state, loops) {
    const body = loops.report.reduce(function (best, row) {
      return Math.max(best, row.body);
    }, 0);

    root.MetricGrid.update({
      'lo-hoisted': { value: root.Format.exact(state.hoisted),
        note: state.hoisted ? 'moved into the preheader, where they run once'
          : 'nothing in this loop is invariant, or there is no preheader to move to' },
      'lo-refused': { value: root.Format.exact(state.refused),
        note: state.refused ? 'invariant, and could fault on a path the loop body never took'
          : 'nothing invariant here can fault' },
      'lo-body': { value: root.Format.exact(body),
        note: loops.report.length ? 'the largest loop body; a trip count multiplies this'
          : 'no loops in this program' },
      'lo-agrees': { value: state.step.agrees ? 'yes' : 'NO',
        note: state.step.agrees ? 'same value, output, outcome and bindings as before the pass'
          : state.step.why }
    });
  }

  function paintComparison(sample) {
    const rows = comparisonFor(sample);

    root.jQuery('#lo-compare tbody').html(rows.map(function (row) {
      return '<tr><td>' + (row.safe ? 'safe — checks the fault condition' : 'naive — hoists anything invariant') +
        '</td><td class="mono">' + row.hoisted + '</td><td class="mono">' + row.refused +
        '</td><td class="mono">' + row.before + '</td><td class="mono">' + row.after +
        '</td><td>' + (row.agrees ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('lo-compare-caption', comparisonCaption(rows));
  }

  function comparisonCaption(rows) {
    const safe = rows[0];
    const naive = rows[1];

    if (safe.agrees && !naive.agrees) {
      return 'The safe version hoists ' + safe.hoisted + ' and refuses ' + safe.refused +
        '; the naive one hoists ' + naive.hoisted + ' and turns a program that finished into ' +
        'one that ' + naive.after + 's. That is the safety condition demonstrated rather than ' +
        'asserted — and the difference is one instruction, which is what makes it so easy to ' +
        'remove for being in the way. Both versions produce IR the verifier accepts, so ' +
        'nothing but running the program catches it.';
    }
    if (safe.hoisted === naive.hoisted) {
      return 'Both versions hoist the same ' + safe.hoisted + ' computations and both preserve ' +
        'behaviour, because nothing invariant in this loop can fault. That is the ordinary ' +
        'case and it is worth seeing: the safety check costs nothing here and the two passes ' +
        'are indistinguishable. Switch to the trapping fixture for the case where they are not.';
    }
    return 'The safe version hoists ' + safe.hoisted + ' and the naive one ' + naive.hoisted +
      ', and both preserve behaviour on this program — the refusal was unnecessary here, which ' +
      'is the honest cost of a conservative condition. A dominance test that refuses a legal ' +
      'hoist loses a little; one that permits an illegal one loses the program.';
  }

  function paintRefusals(state) {
    root.jQuery('#lo-refusals tbody').html(state.reasons.map(function (row) {
      return '<tr><td class="mono">' + (row.register || row.loop || '—') + '</td><td>' +
        root.Helpers.escapeHtml(row.why) + '</td></tr>';
    }).join('') || '<tr><td colspan="2">nothing was refused</td></tr>');

    root.Helpers.setText('lo-refusals-caption',
      'A refusal names the register and the reason. Two reasons appear: an instruction that may ' +
      'fault and whose block does not dominate every loop exit, and a loop with no preheader ' +
      'to hoist into. The second is not a safety issue but a structural one — a header reached ' +
      'from two places outside the loop has no single block that runs once before it, and ' +
      'creating one is a graph transformation this pass deliberately does not perform.');
  }

  function paintLoops(loops) {
    root.jQuery('#lo-loops tbody').html(loops.report.map(function (row) {
      return '<tr><td class="mono">' + row.header + '</td><td class="mono">' + row.depth +
        '</td><td class="mono">' + row.body + '</td><td class="mono">' + row.weighted +
        '</td><td class="mono">' + row.invariant + '</td><td class="mono">' + row.induction +
        '</td><td class="mono">' + row.exits + '</td></tr>';
    }).join('') || '<tr><td colspan="7">no loops in this program</td></tr>');

    root.Helpers.setText('lo-loops-caption',
      'The weighted column charges each loop body once per assumed iteration of every loop ' +
      'enclosing it, at ten per level. Ten is an assumption and is named as one: a static trip ' +
      'count is unavailable for most loops, so every cost model in every compiler is doing ' +
      'something like this. What the column is good for is comparing two loops in the same ' +
      'function, where the assumption cancels; what it is not good for is a number in a ' +
      'report, which is how a heuristic becomes folklore.');
  }

  function paintInduction(loops) {
    root.jQuery('#lo-induction tbody').html(loops.induction.map(function (row) {
      return '<tr><td class="mono">' + row.register + '</td><td class="mono">' + row.start +
        '</td><td class="mono">' + row.operator + '</td><td class="mono">' +
        (row.constant === null ? row.step : row.constant) + '</td><td class="mono">' +
        row.header + '</td></tr>';
    }).join('') || '<tr><td colspan="5">no induction variable in this program</td></tr>');

    root.Helpers.setText('lo-induction-caption',
      'Each row is a phi at a loop header whose back-edge value is itself plus an invariant ' +
      'amount — the definition of a basic induction variable, recognised by pattern rather ' +
      'than by analysis. A loop lowered from `for` always has one, because the lowering ' +
      'introduced the index; a `while` has one only if the programmer wrote a counter, which ' +
      'is why the two fixtures differ.');
  }

  function paintUnswitch(loops) {
    root.jQuery('#lo-unswitch tbody').html(loops.unswitch.map(function (row) {
      return '<tr><td class="mono">' + row.loop + '</td><td class="mono">' + row.block +
        '</td><td class="mono">' + row.condition + '</td><td class="mono">' + row.bodySize +
        '</td><td class="mono">' + (row.bodySize + row.duplicated) + '</td></tr>';
    }).join('') || '<tr><td colspan="5">no loop-invariant branch inside a loop here</td></tr>');

    root.Helpers.setText('lo-unswitch-caption',
      'Reported, not performed. Unswitching hoists a loop-invariant test out of the loop and ' +
      'duplicates the body once per outcome — so the last column is the code size afterwards, ' +
      'which is roughly double. That trade is the whole decision, and it is one a compiler ' +
      'makes against an instruction-cache budget rather than a rule. Performing it needs a ' +
      'block cloner, and a pass that duplicates blocks without one produces IR the verifier ' +
      'rejects; shipping the opportunity is more honest than shipping a transformation that ' +
      'fails its own gate.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
