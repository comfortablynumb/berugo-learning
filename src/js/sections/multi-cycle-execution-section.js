/**
 * Section: Multi-cycle execution.
 *
 * The single-cycle machine of 34.4 charges every instruction the delay of the
 * slowest path in the whole datapath. Cutting that path into stages with a
 * register between them shortens the clock and lengthens every instruction,
 * and whether that is a win is arithmetic rather than opinion:
 *
 *     time = instructions x cycles-per-instruction x clock period
 *
 * Everything on this page is measured. The stage delays come from building
 * each stage as a netlist and walking it; the instruction mix comes from
 * running the program on the behavioural simulator and counting classes; the
 * CPI is that mix weighted by the cycles each class needs. On this datapath
 * the multi-cycle machine LOSES, because one stage holds most of the period —
 * and the section says so, with the break-even stage period named.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'multi-cycle-execution';
  const Sim = root.LogicSim;
  const Assembler = root.Brv32.Assembler;
  const Programs = root.Brv32.Programs;
  const Multicycle = root.Brv32.Multicycle;
  const GateCpu = root.Brv32.GateCpu;
  let panel = null;
  let chart = null;

  const NAMES = ['sum', 'factorial', 'arrayMax', 'strlen', 'console'];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the control FSM, and where each class leaves it',
      caption: 'Every instruction visits fetch and decode. After that the class decides: a '
        + 'branch is finished once the ALU has compared, a store computes an address and '
        + 'writes memory but has nothing to write back, and only a load walks all five '
        + 'stages. That is where cycles-per-instruction comes from — it is not a property of '
        + 'the machine alone but of the machine and the program together.',
      definition: [
        'stateDiagram-v2',
        '    [*] --> fetch',
        '    fetch --> decode',
        '    decode --> execute: arithmetic, load, store, branch, jump',
        '    decode --> [*]: system — 2 cycles',
        '    execute --> [*]: branch — 3 cycles',
        '    execute --> memory: load, store',
        '    execute --> writeback: arithmetic, jump — 4 cycles',
        '    memory --> writeback: load — 5 cycles',
        '    memory --> [*]: store — 4 cycles',
        '    writeback --> [*]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**The performance equation is the only honest way to compare two designs.** Time is '
        + 'instructions times cycles-per-instruction times clock period, and every design '
        + 'change moves at least two of those terms. A machine with a lower clock period and a '
        + 'higher CPI can be slower; a machine with fewer instructions and a longer clock can '
        + 'be slower too. Quoting one factor is how benchmarks lie without stating anything '
        + 'false.',
      '**Multi-cycle execution shortens the clock by cutting the datapath into stages.** A '
        + 'register between two stages means the signal only has to cross one of them per '
        + 'cycle. The period is then set by the longest stage rather than by the whole path. '
        + 'The instruction now takes several cycles, and the components can be shared between '
        + 'stages because they are used at different times.',
      '**CPI is measured, not assumed.** Each instruction class visits a different set of '
        + 'stages: a branch decides in execute and stops, a store never writes back, only a '
        + 'load needs all five. The CPI of a program is the mix of classes it actually '
        + 'executed, weighted by cycles — so the same machine has a different CPI on every '
        + 'program.',
      '**The gain is bounded by the worst stage, and here one stage holds most of the '
        + 'period.** The execute stage is 148 gate delays of a 175-delay path, so cutting the '
        + 'datapath into stages barely shortens the clock: 178 becomes 151. Paying four '
        + 'cycles for that is a straightforward loss, and the demo reports it as one.',
      '**A negative result is more useful with a break-even number attached.** Saying '
        + '"multi-cycle loses here" is an observation; saying "it wins once the stage period '
        + 'is below 45 gate delays" is a target. The demo computes that number from the same '
        + 'measurements rather than leaving the reader to rearrange the equation.',
      '**The fix for an unbalanced stage is to split the stage, not to add more of them.** A '
        + 'faster adder — carry-lookahead or carry-select from 33.6 — moves the execute stage '
        + 'down and the whole comparison with it. This is the same lesson as any pipeline in '
        + 'software: adding stages around the bottleneck does nothing for the bottleneck.',
      '**Sharing hardware between stages is the historical reason multi-cycle designs '
        + 'existed.** One memory can serve both fetch and data access if they happen in '
        + 'different cycles, and one adder can compute both the next program counter and an '
        + 'address. When transistors were the scarce resource that mattered more than the '
        + 'clock, which is exactly the trade that has since inverted.',
      '**Pipelining is the design that takes the short clock without paying the cycles.** '
        + 'Multi-cycle shortens the period and multiplies the cycles; pipelining shortens the '
        + 'period and keeps one instruction finishing per cycle by overlapping them. That is '
        + 'the whole idea of M35, and the arithmetic on this page is what makes it worth the '
        + 'hazards it introduces.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — two machines, one program, one equation',
        markup: root.MulticycleTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**A design that lowers the clock period and raises the cycle count has not made '
      + 'anything faster until somebody multiplies.** The multi-cycle machine on this page is '
      + 'a textbook design applied to a real datapath, and it loses by more than three times. '
      + 'That is not because the idea is wrong. This datapath has one stage holding 148 '
      + 'of its 175 gate delays, so cutting it into stages buys almost nothing and costs '
      + 'nearly four cycles per instruction. The same shape appears every time a system is '
      + 'decomposed. Splitting a slow operation into steps helps only in proportion to how '
      + 'evenly the work divides. An unbalanced split makes things worse, by adding '
      + 'per-step overhead to a critical path that did not get shorter. This is why the '
      + 'performance equation is worth internalising as a habit rather than a formula. '
      + 'Somebody proposes breaking a service into stages, a queue between two components, or '
      + 'a batch into smaller batches. The question is always the same three factors: how many '
      + 'units of work, how many steps each, how long a step. Improving one while quietly '
      + 'worsening another is the most common way an optimisation turns out to be a '
      + 'regression. It is invisible unless you insist on the product rather than the '
      + 'factor.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.MulticycleTemplate.controls,
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

  const imageFor = root.Helpers.memoise(function (name) {
    return Assembler.assemble(Programs.CATALOGUE[name].source, { origin: 0 });
  });

  /** The single-cycle period, from the same netlist section 34.4 measures. */
  const singlePeriod = root.Helpers.memoise(function () {
    const machine = GateCpu.create({ image: [], entry: 0 });

    return root.Timing.frequency(machine.net, {});
  });

  const stages = root.Helpers.memoise(function () {
    return Multicycle.stageDelays();
  });

  const comparison = root.Helpers.memoise(function (name) {
    return Multicycle.compare(imageFor(name).bytes, {
      stages: stages('one'), singlePeriod: singlePeriod('one').period, budget: 3000 });
  });

  /** The multi-cycle time at a stage period the learner chose, so the
   *  break-even number is something to aim at rather than to read. */
  function multiTimeAt(row, period) {
    return row.multi.cycles * period;
  }

  function reading() {
    const values = panel.values();

    return { name: values['mcy-program'], stage: Number(values['mcy-stage']),
      row: comparison(values['mcy-program']), single: singlePeriod('one'),
      stages: stages('one') };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintEquation(view);
    paintStages(view);
    paintClasses(view);
    paintMix(view);
    paintPrograms(view);
    paintBreakEven(view);
    paintChart(app, view);
  }

  function timeOf(row) {
    return { single: row.single.cycles * row.single.period,
      multi: row.multi.cycles * row.multi.period };
  }

  function paintMetrics(view) {
    const times = timeOf(view.row);
    const ratio = times.multi / times.single;

    root.MetricGrid.update({
      'mcy-single-period': { value: view.row.single.period,
        note: view.single.logic + ' of logic plus ' + view.row.overhead + ' of overhead' },
      'mcy-multi-period': { value: view.row.multi.period,
        note: 'the ' + view.row.slowest + '-delay execute stage, plus the same overhead' },
      'mcy-cpi': { value: view.row.cpi.toFixed(2),
        note: 'from ' + view.row.mix.retired + ' instructions actually executed' },
      'mcy-single-time': { value: times.single,
        note: view.row.single.cycles + ' cycles x ' + view.row.single.period },
      'mcy-multi-time': { value: times.multi,
        note: view.row.multi.cycles + ' cycles x ' + view.row.multi.period },
      'mcy-verdict': { value: times.multi > times.single ? 'single cycle' : 'multi cycle',
        note: (times.multi > times.single ? ratio.toFixed(1) + 'x slower multi-cycle'
          : (1 / ratio).toFixed(1) + 'x faster multi-cycle') + ' on this program' }
    });
  }

  function paintEquation(view) {
    const times = timeOf(view.row);

    fill('mcy-equation', [
      ['instructions', String(view.row.mix.retired), String(view.row.mix.retired),
        'the same program, so this term is identical'],
      ['cycles per instruction', '1.00', view.row.cpi.toFixed(2),
        'measured from the class mix the program actually executed'],
      ['clock period', String(view.row.single.period), String(view.row.multi.period),
        'the whole datapath against the slowest stage, both plus 3 of overhead'],
      ['total, in gate delays', String(times.single), String(times.multi),
        'the product — which is the only term worth comparing']
    ]);
    root.Helpers.setText('mcy-equation-caption', 'The multi-cycle machine has the shorter '
      + 'clock and loses anyway: ' + view.row.single.period + ' against '
      + view.row.multi.period + ' is a 15% saving, and ' + view.row.cpi.toFixed(2)
      + ' cycles per instruction is a ' + view.row.cpi.toFixed(2) + '-times cost. Two of the '
      + 'three factors moved, in opposite directions, and only the product settles it.');
  }

  const STAGE_ABOUT = {
    decode: 'read two registers out of the file — 1 024 flip-flops and two multiplexer trees',
    execute: 'the ALU: a 32-bit ripple carry, a barrel shifter and a result multiplexer',
    address: 'a 32-bit adder for the next program counter or a branch target'
  };

  function paintStages(view) {
    fill('mcy-stages', view.stages.map(function (row) {
      return [row.name, String(row.gates), String(row.delay) + ' gate delays',
        STAGE_ABOUT[row.name] || ''];
    }));
    root.Helpers.setText('mcy-stages-caption', 'Each stage was built as a netlist on its own '
      + 'and walked, rather than estimated. The execute stage is ' + view.row.slowest
      + ' gate delays against the decode stage\'s ' + view.stages[0].delay + ', so the clock '
      + 'is set almost entirely by one of them — which is exactly the condition under which '
      + 'splitting a datapath into stages does not pay.');
  }

  const SKIPS = { arithmetic: 'the memory stage', load: 'nothing — it is the longest',
    store: 'the write-back stage', branch: 'memory and write back',
    jump: 'the memory stage', system: 'everything after decode' };

  function paintClasses(view) {
    fill('mcy-classes', Multicycle.fsm().map(function (row) {
      return [row.kind, row.stages.join(' -> '), String(row.cycles), SKIPS[row.kind] || ''];
    }));
    root.Helpers.setText('mcy-classes-caption', 'A load needs all five stages; a branch is '
      + 'finished after three. That spread is where CPI comes from, and it is why a '
      + 'load-heavy program and a branch-heavy program have different CPIs on the same '
      + 'machine — the number is a property of the pair, never of the machine alone.');
  }

  function paintMix(view) {
    const counts = view.row.mix.counts;
    const total = view.row.mix.retired;

    fill('mcy-mix', Object.keys(counts).map(function (kind) {
      const cycles = Multicycle.CLASSES[kind].cycles;

      return [kind, String(counts[kind]),
        (100 * counts[kind] / total).toFixed(0) + '%', String(cycles),
        String(counts[kind] * cycles)];
    }));
    root.Helpers.setText('mcy-mix-caption', 'The mix is counted by running the program, not '
      + 'assumed from a textbook table. ' + total + ' instructions produce a CPI of '
      + view.row.cpi.toFixed(2) + ', and changing the program changes it — which is the '
      + 'reason a CPI quoted without a workload means nothing.');
  }

  function paintPrograms(view) {
    fill('mcy-programs', NAMES.map(function (name) {
      const row = comparison(name);
      const times = timeOf(row);

      return [name + (name === view.name ? ' <-' : ''), String(row.mix.retired),
        row.cpi.toFixed(2), String(times.single), String(times.multi),
        times.multi > times.single ? 'single cycle, by ' +
          (times.multi / times.single).toFixed(1) + 'x' : 'multi cycle'];
    }));
    root.Helpers.setText('mcy-programs-caption', 'Five programs, one verdict: the '
      + 'single-cycle machine wins every one of them on this datapath. The margin varies with '
      + 'the instruction mix — a program full of branches has a lower CPI than one full of '
      + 'loads — but not nearly enough to change the answer, because the clock barely moved.');
  }

  function paintBreakEven(view) {
    const times = timeOf(view.row);

    fill('mcy-breakeven', [
      ['stage period', String(view.row.multi.period) + ' gate delays',
        String(view.row.breakEven) + ' or lower',
        'it would need the execute stage below ' + (view.row.breakEven - view.row.overhead) +
          ' delays — a carry-lookahead adder gets part of the way'],
      ['multi-cycle time at your chosen ' + view.stage + ' delays',
        String(multiTimeAt(view.row, view.stage)),
        'under ' + times.single + ' to win',
        multiTimeAt(view.row, view.stage) < times.single
          ? 'at this period the multi-cycle machine wins'
          : 'still ' + (multiTimeAt(view.row, view.stage) / times.single).toFixed(1) +
            'x slower'],
      ['CPI', view.row.cpi.toFixed(2), 'below ' +
        (view.row.single.period / view.row.multi.period).toFixed(2),
        'only a different program does that, and no real mix is that branch-heavy'],
      ['what actually fixes it', 'shorten the execute stage',
        'or overlap the stages instead of serialising them',
        'the second is pipelining, which is the whole of M35']
    ]);
    root.Helpers.setText('mcy-breakeven-caption', 'The break-even stage period is '
      + view.row.breakEven + ' gate delays, against the ' + view.row.multi.period
      + ' this design achieves. Naming that number is what turns a negative result into a '
      + 'specification: it says how much faster the slowest stage would have to be before the '
      + 'idea is worth revisiting.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#mcy-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'gate delays',
      values: NAMES.reduce(function (out, name) {
        const times = timeOf(comparison(name));

        out.push({ label: name + ' single', value: times.single, series: 0 });
        out.push({ label: name + ' multi', value: times.multi, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('mcy-chart-note', 'Two bars per program: total time on the '
      + 'single-cycle machine and on the multi-cycle one, in gate delays — the only unit both '
      + 'machines share. The multi-cycle bar is taller on every program, by between 3.1 and '
      + '3.4 times, and the gap is almost entirely the cycle count rather than the clock.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
