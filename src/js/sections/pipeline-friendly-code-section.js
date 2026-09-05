/**
 * Section: Writing pipeline-friendly code.
 *
 * The classic "sorted array is faster" result, reproduced with the mechanism
 * visible: the same 64 values, the same comparison, the same answer, and the
 * only difference is the order they arrive in. Sorting turns a data-dependent
 * branch into two long runs that any predictor gets right; shuffling turns it
 * into a coin flip.
 *
 * The branchless variant is here as the honest counterweight. It removes the
 * branch entirely and costs three instructions per element, and on THIS
 * machine - a five-stage pipeline with a two-cycle penalty - it loses in every
 * case. The section computes the penalty at which it starts winning rather
 * than recommending it, because the recommendation depends on a number that is
 * a property of the machine and not of the code.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'pipeline-friendly-code';
  const Pipeline = root.Brv32.Pipeline;
  const Traces = root.Brv32.Traces;
  const Assembler = root.Brv32.Assembler;
  let panel = null;
  let chart = null;

  const COUNT = 64;
  const SHAPES = ['branchy', 'branchless'];
  const ORDERS = ['sorted', 'shuffled'];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — branchless or branchy, and the question that decides it',
      caption: 'The decision is not about elegance and it is not about instruction count. A '
        + 'branch costs nothing when it is predictable and costs the misprediction penalty '
        + 'when it is not; branchless code costs its extra instructions every single time. So '
        + 'the comparison is extra instructions against mispredict rate times penalty, and '
        + 'two of those three numbers are properties of the machine rather than of the code.',
      definition: [
        'flowchart TB',
        '    S["a data-dependent branch in a hot loop"] --> M{"is it predictable?"}',
        '    M -->|"yes: sorted, or a stable pattern"| K["leave it alone — a predicted branch is free"]',
        '    M -->|"no: data-dependent, near 50/50"| P{"what is the penalty?"}',
        '    P -->|"small: a shallow pipeline"| K2["still leave it: the extra instructions cost more"]',
        '    P -->|"large: a deep out-of-order machine"| B["branchless: a mask, or a conditional move"]',
        '    M -->|"can the data be sorted?"| SO["sort it — the branch becomes predictable"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The sorted-array result is real, and it is about prediction rather than about '
        + 'memory.** The same values, the same comparison and the same answer: only the order '
        + 'differs. Sorted data makes the branch a long run of not-taken followed by a long '
        + 'run of taken, which any two-bit counter gets right. Shuffled data makes it a coin '
        + 'flip that nothing predicts.',
      '**Measure mispredicts, not just time.** A timing difference has a dozen possible '
        + 'explanations — cache behaviour, memory layout, the compiler having a good day. A '
        + 'mispredict count has one, and this demo reports both so the mechanism is visible '
        + 'rather than inferred.',
      '**Branchless code trades a possible mispredict for a guaranteed dependency.** The mask '
        + 'form here computes a comparison, turns it into all-ones or all-zeros, and ands it '
        + 'with the value. That is three instructions, executed for every element, with no '
        + 'branch to get wrong. It is insensitive to the data order, which is its whole appeal.',
      '**On this machine branchless loses, and that is the point of measuring.** A two-cycle '
        + 'penalty times about thirty extra mispredicts is far less than three extra '
        + 'instructions times sixty-four elements. The demo computes the penalty at which the '
        + 'answer flips rather than recommending one shape over the other.',
      '**Sorting the data is usually the better fix, when it is available.** It makes the '
        + 'branch predictable rather than removing it, so the loop keeps its early exit and '
        + 'its shorter instruction count. It is also the fix that stops working the moment the '
        + 'data cannot be sorted, which is most of the time.',
      '**Unrolling reduces branch density and does not touch the unpredictable branch.** It '
        + 'removes loop-control branches, which were predictable anyway, so it helps for other '
        + 'reasons — fewer instructions, more scheduling freedom — and not for this one.',
      '**An indirect call in a hot loop is the expensive shape.** A direction is one bit and a '
        + 'target is a full address; a virtual call through a pointer that varies is close to '
        + 'unpredictable. That is why devirtualisation is worth so much, and why hot loops in '
        + 'performance-critical code avoid polymorphism.',
      '**Only measurement tells you which case you are in, and the measurement is cheap.** '
        + 'Every real processor has a mispredicted-branch counter, every profiler can read it, '
        + 'and it answers the question directly. Guessing is what produces branchless code in '
        + 'loops whose branches were perfectly predictable.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — the branch laboratory',
        markup: root.BranchlessTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**Branchless code is a bet that a branch is unpredictable, and losing that bet is '
      + 'silent.** The branchy loop pays nothing when the predictor is right and pays the '
      + 'penalty when it is wrong. The branchless loop pays its extra instructions every '
      + 'single iteration, unconditionally, whether or not there was ever a misprediction to '
      + 'avoid. So the comparison is three extra instructions per element against the '
      + 'mispredict rate multiplied by the penalty. On this five-stage machine, with a '
      + 'two-cycle penalty, the bet loses even on shuffled data. On a deep out-of-order core '
      + 'with a twenty-cycle penalty the same code wins comfortably. Nothing about the source '
      + 'changed; the machine did. That is why this is the last section of the milestone. '
      + 'Every technique here is conditional on numbers you have to go and measure. The '
      + 'ones that matter — mispredict rate and misprediction penalty — are properties of the '
      + 'processor and the data rather than of the code you are looking at. The discipline is '
      + 'not "prefer branchless" or "prefer branchy". It is to know which of the three numbers '
      + 'you are actually short of, and every modern processor will tell you if you ask it.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.BranchlessTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------- plumbing */

  function fill(id, rows) {
    root.jQuery('#' + id + ' tbody').html(rows.map(function (cells) {
      return '<tr>' + cells.map(function (cell) {
        return '<td>' + root.Helpers.escapeHtml(String(cell)) + '</td>';
      }).join('') + '</tr>';
    }).join(''));
  }

  const data = root.Helpers.memoise(function () {
    return Traces.filterData({ count: COUNT });
  });

  const runOf = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const values = data('one')[parts.order];
    const source = Traces.filterProgram(values, { threshold: data('one').threshold,
      branchless: parts.shape === 'branchless' });
    const image = Assembler.assemble(source, { origin: 0 });
    const machine = Pipeline.create({ image: image.bytes, entry: 0, predictor: 'bimodal' });

    Pipeline.run(machine, { cycles: 8000, stopOnTrap: true });
    return { summary: Pipeline.summary(machine), answer: Pipeline.snapshot(machine).registers[13] };
  });

  function keyFor(shape, order) {
    return JSON.stringify({ shape: shape, order: order });
  }

  /**
   * How large the misprediction penalty would have to be before the branchless
   * shape wins. Both runs are measured on this machine at its own 2-cycle
   * penalty, and the extra cycles the branchless form spends on instructions
   * are divided by the mispredicts it avoids.
   */
  function breakEven(order) {
    const branchy = runOf(keyFor('branchy', order)).summary;
    const branchless = runOf(keyFor('branchless', order)).summary;
    const saved = branchy.mispredicts - branchless.mispredicts;

    if (saved <= 0) return null;
    return { saved: saved, penalty: 2 + (branchless.cycles - branchy.cycles) / saved };
  }

  function reading() {
    const values = panel.values();

    return { order: values['pfc-order'], shape: values['pfc-shape'],
      penalty: Number(values['pfc-penalty']),
      run: runOf(keyFor(values['pfc-shape'], values['pfc-order'])),
      other: runOf(keyFor(values['pfc-shape'] === 'branchy' ? 'branchless' : 'branchy',
        values['pfc-order'])) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintMatrix(view);
    paintCode();
    paintPenalty(view);
    paintTechniques();
    paintDiscipline();
    paintChart(app);
  }

  function paintMetrics(view) {
    const summary = view.run.summary;
    const other = view.other.summary;
    const found = breakEven(view.order);

    root.MetricGrid.update({
      'pfc-answer': { value: view.run.answer,
        note: 'every combination computes ' + data('one').answer },
      'pfc-cycles': { value: summary.cycles,
        note: 'IPC ' + summary.ipc.toFixed(3) },
      'pfc-instructions': { value: summary.retired,
        note: view.shape === 'branchless' ? 'three more per element than the branchy form'
          : 'one branch per element' },
      'pfc-mispredicts': { value: summary.mispredicts,
        note: 'of ' + summary.predictions + ' predictions' },
      'pfc-versus': { value: (summary.cycles - other.cycles) + ' cycles',
        note: summary.cycles < other.cycles ? 'faster than the other shape'
          : 'slower than the other shape' },
      'pfc-breakeven': { value: found ? found.penalty.toFixed(1) + ' cycles' : 'never',
        note: found ? 'above this, branchless wins on shuffled data'
          : 'branchless avoids no mispredicts on sorted data' }
    });
  }

  function paintMatrix(view) {
    const rows = [];

    SHAPES.forEach(function (shape) {
      ORDERS.forEach(function (order) {
        const run = runOf(keyFor(shape, order));
        const here = shape === view.shape && order === view.order;

        rows.push([shape + (here ? ' <-' : ''), order, run.answer, run.summary.retired,
          run.summary.mispredicts, run.summary.cycles]);
      });
    });
    fill('pfc-matrix', rows);
    root.Helpers.setText('pfc-matrix-caption', matrixCaption());
  }

  function matrixCaption() {
    const sorted = runOf(keyFor('branchy', 'sorted')).summary;
    const shuffled = runOf(keyFor('branchy', 'shuffled')).summary;
    const less = runOf(keyFor('branchless', 'shuffled')).summary;

    return 'Every row computes ' + data('one').answer + ', because it is the same values and '
      + 'the same comparison. The branchy rows differ by ' + (shuffled.cycles - sorted.cycles)
      + ' cycles purely because of the order the data arrives in — ' + sorted.mispredicts
      + ' mispredicts against ' + shuffled.mispredicts + '. The branchless rows are identical '
      + 'to each other, which is exactly what removing the branch buys, and both are slower '
      + 'than the branchy shuffled run at ' + less.cycles + ' cycles against '
      + shuffled.cycles + '.';
  }

  function paintCode() {
    fill('pfc-code', [
      ['lw a4, 0(a0)', 'lw a4, 0(a0)', 'the load is the same'],
      ['blt a4, a2, skip', 'slt a5, a4, a2', 'a comparison that produces a value, not a jump'],
      ['add a3, a3, a4', 'addi a5, a5, -1', 'turn 0 or 1 into a mask of all zeros or all ones'],
      ['skip:', 'and a6, a4, a5', 'apply the mask: the value, or zero'],
      ['', 'add a3, a3, a6', 'add unconditionally — adding zero is a no-op'],
      ['2 instructions, one of them a branch', '4 instructions, none of them a branch',
        'three extra instructions per element, and no branch to mispredict']
    ]);
    root.Helpers.setText('pfc-code-caption', 'The branchless form is not clever, and that '
      + 'matters: slt produces 0 or 1, subtracting one turns that into a mask, and the AND '
      + 'applies it. Every element pays for all four instructions whether or not it passes the '
      + 'test, which is the cost that has to be weighed against the mispredicts it avoids.');
  }

  function paintPenalty(view) {
    const branchy = runOf(keyFor('branchy', 'shuffled')).summary;
    const branchless = runOf(keyFor('branchless', 'shuffled')).summary;

    fill('pfc-penalty-table', [2, 5, 10, 20].map(function (penalty) {
      const branchyAt = branchy.cycles + (penalty - 2) * branchy.mispredicts;
      const branchlessAt = branchless.cycles + (penalty - 2) * branchless.mispredicts;

      return [penalty + ' cycles', branchyAt, branchlessAt,
        branchlessAt < branchyAt ? 'branchless' : 'branchy',
        describeMachine(penalty)];
    }));
    root.Helpers.setText('pfc-penalty-table-caption', 'The measured run is the first row; the '
      + 'rest scale its mispredict count by a larger penalty, which is the only term that '
      + 'changes between these machines. The same source, unchanged, loses on a shallow '
      + 'pipeline and wins on a deep one — so "is branchless faster" is not a question about '
      + 'the code at all.');
  }

  function describeMachine(penalty) {
    if (penalty <= 2) return 'this five-stage pipeline, measured';
    if (penalty <= 5) return 'a modest superscalar';
    if (penalty <= 10) return 'a typical modern core';
    return 'a deeply pipelined out-of-order machine';
  }

  function paintTechniques() {
    fill('pfc-techniques', [
      ['sort the data', 'makes the branch predictable rather than removing it',
        'whenever the data can be sorted and the sort is amortised',
        'when it cannot be sorted, which is most of the time'],
      ['branchless masking', 'replaces the branch with arithmetic',
        'when the branch is near 50/50 and the penalty is large',
        'when the branch was predictable — the extra work is then pure loss'],
      ['conditional move', 'the same idea as one instruction, where the ISA has it',
        'the same case, and cheaper than the mask form',
        'the same case, plus it creates a data dependency the scheduler cannot break'],
      ['loop unrolling', 'removes loop-control branches and gives the scheduler more to work with',
        'almost always a small win',
        'it does nothing for the unpredictable branch, which is the one costing you'],
      ['avoid indirect calls in hot loops', 'removes an unpredictable target, not a direction',
        'when the target actually varies', 'when it does not — the predictor handles it']
    ]);
    root.Helpers.setText('pfc-techniques-caption', 'The second and third rows have the same '
      + 'condition attached and it is the one people skip: branchless helps only when the '
      + 'branch was unpredictable. Applied to a predictable branch it is a guaranteed cost '
      + 'replacing an avoided one, and it makes the code both slower and harder to read.');
  }

  function paintDiscipline() {
    fill('pfc-discipline', [
      ['is this branch actually mispredicted?',
        'read the processor\'s mispredicted-branch counter, per address, with a profiler',
        'guess from the source, and rewrite branches that were free'],
      ['what does a mispredict cost here?',
        'the pipeline depth and the resolution stage: 2 cycles here, 15 to 20 on a modern core',
        'assume it is large, because articles about branchless code assume it is'],
      ['how often does the branch run?',
        'a profile; a branch outside a hot loop cannot matter however unpredictable it is',
        'optimise the branch that was easiest to find'],
      ['did the change help?',
        'measure both, on the real data, with the counters as well as the clock',
        'measure once, on sorted test data, and ship it']
    ]);
    root.Helpers.setText('pfc-discipline-caption', 'The fourth row is where this section ends '
      + 'up, and the parenthetical matters: measuring on test data that happens to be sorted '
      + 'is how a branchless rewrite gets shipped for a branch that was never mispredicted in '
      + 'production. The counters are free, every profiler reads them, and they answer the '
      + 'question the timing alone cannot.');
  }

  function paintChart(app) {
    const host = root.jQuery('#pfc-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 260, yLabel: 'cycles',
      values: SHAPES.reduce(function (out, shape, index) {
        ORDERS.forEach(function (order) {
          out.push({ label: shape + ' ' + order,
            value: runOf(keyFor(shape, order)).summary.cycles, series: index });
        });
        return out;
      }, [])
    });
    root.Helpers.setText('pfc-chart-note', 'Four bars, one answer. The two branchy bars '
      + 'differ only in the order the data arrived; the two branchless bars are the same '
      + 'height, which is the whole point of removing the branch. On this machine both '
      + 'branchless bars are taller than either branchy bar — the insurance costs more than '
      + 'the risk it covers, at a two-cycle penalty.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
