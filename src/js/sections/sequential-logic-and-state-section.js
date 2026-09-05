/**
 * Section: Sequential logic — latches, flip-flops and registers.
 *
 * Feedback is the whole subject. Every circuit before this one was a DAG and
 * could be evaluated in one topological pass; a latch is a cycle, so the
 * simulator switches to bounded relaxation and the netlist acquires something
 * a truth table cannot describe — a value that depends on what happened
 * earlier.
 *
 * The sequence table is the demonstration that matters: the same inputs
 * applied in a different order leave a different value behind, which is what
 * "state" means and what no combinational block on the previous four pages
 * could do.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'sequential-logic-and-state';
  const Sim = root.LogicSim;
  const Memory = root.Blocks.Memory;
  let panel = null;
  let wave = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a master-slave flip-flop, and why it is two latches',
      caption: 'The master latch is enabled while the clock is low, so it follows the data '
        + 'input. The slave is enabled while the clock is high, so it holds during that time. '
        + 'When the clock rises the master stops following and the slave starts, which means '
        + 'the value that reaches the output is the one that was at the data input at the '
        + 'instant of the edge — and no path is ever transparent from input to output. That is '
        + 'the difference between a latch and a flip-flop, and it is why synchronous design '
        + 'works: every storage element in the machine samples at the same moment, so the logic '
        + 'between them has a whole clock period to settle and its glitches do not matter.',
      definition: [
        'flowchart LR',
        'D(["d"]) --> M["master D latch<br/>enabled while the clock is LOW"]',
        'CLK(["clk"]) --> INV["inverter"]',
        'INV --> M',
        'M --> S["slave D latch<br/>enabled while the clock is HIGH"]',
        'CLK --> S',
        'S --> Q["q — the value d had at the edge"]',
        'M -.->|"follows d, then freezes"| S',
        'S -.->|"never transparent at the same time as the master"| Q'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Feedback is what makes memory, and it turns the netlist into something a truth table '
        + 'cannot describe.** Two NOR gates wired into each other have two stable states, and '
        + 'which one they sit in depends on what was applied earlier. Every circuit before this '
        + 'section could be evaluated in one pass over a directed acyclic graph. This one has a '
        + 'cycle, so the simulator has to relax it to a fixed point instead.',
      '**The SR latch is the smallest thing that remembers, and it has an input you must not '
        + 'apply.** Set forces the output high, reset forces it low, neither holds — and both '
        + 'at once drives both outputs to the same value, which is not a state at all. When '
        + 'they are released together the pair settles wherever the delays send it, which is a '
        + 'race with no defined winner.',
      '**The D latch removes the forbidden input and adds transparency instead.** One data '
        + 'input, one enable, and no way to ask for the illegal combination. But while the '
        + 'enable is high the output follows the input, so a glitch on the data line during '
        + 'that window is stored. That is a real trade, not a strict improvement.',
      '**A flip-flop is two latches with opposite enables, and it is never transparent.** The '
        + 'master follows while the clock is low, the slave while it is high, so the value that '
        + 'survives is the one present at the edge. This costs twice the gates of a latch and it '
        + 'is what makes a whole machine samplable at one instant.',
      '**Setup and hold are constraints on the data, not on the clock.** The data must be stable '
        + 'for a setup time before the edge and a hold time after it. Miss the setup and the '
        + 'value captured is the old one — or worse, neither. Miss the hold and a fast path '
        + 'from the previous stage overwrites the value being captured, which no slower clock '
        + 'can fix.',
      '**Metastability is not a bug that can be removed.** If the data changes inside the '
        + 'aperture, the flip-flop can sit balanced between its two stable states for an '
        + 'unbounded time. The probability decays exponentially with the time allowed. That is '
        + 'why crossing a clock domain uses two flip-flops in series, and why the answer is a '
        + 'mean time between failures rather than a guarantee.',
      '**A register is n flip-flops on one clock, and the write enable must not gate the clock.** '
        + 'Recirculating the old value through a multiplexer when the enable is low keeps every '
        + 'flip-flop on the same clock edge. Gating the clock instead saves a multiplexer and '
        + 'introduces skew, which is why it is done deliberately and carefully or not at all.',
      '**Read-during-write is a real question with two correct answers.** A port sampled before '
        + 'the edge sees what was stored last cycle; sampled after, it sees what was just '
        + 'written. Both are legitimate designs, both appear in real register files, and the '
        + 'difference is exactly why a pipeline needs a forwarding path.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — the first circuit on this site with a memory',
        markup: root.StoreTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**Synchronous design is a discipline that buys away an entire class of problems.** '
      + 'It is the same bargain as a transaction boundary in a database or a frame boundary '
      + 'in a renderer. Combinational logic glitches: the previous sections measured circuits '
      + 'whose outputs dip and wobble for several gate delays before settling on the right '
      + 'answer. A synchronous machine simply agrees not to look during that time. Every '
      + 'storage element samples at the same edge, and the clock period is chosen to be longer '
      + 'than the worst path between any two of them. In exchange nobody has to reason about the '
      + 'order in which signals arrive. That is an enormous simplification, and it is paid for '
      + 'in throughput: the whole machine runs at the speed of its slowest path, whatever the '
      + 'data. The place the discipline breaks is where a signal enters from outside the clock '
      + 'domain, and there you get metastability. It is not a bug to be fixed but a probability '
      + 'to be managed. Two flip-flops in series buy enough time that the mean time '
      + 'between failures exceeds the life of the product. Every asynchronous boundary in '
      + 'software has the same shape: a lock-free queue between two threads, a signal handler, a '
      + 'hardware interrupt. It has the same answer too. Define one place where the crossing '
      + 'happens, make it as narrow as possible, and be rigorous there so the rest of the system '
      + 'can be simple.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.StoreTemplate.controls,
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

  function portsFor(kind, data, control) {
    if (kind === 'sr') return { s: data ? 1 : 0, r: control ? 1 : 0 };
    if (kind === 'd') return { d: data ? 1 : 0, en: control ? 1 : 0 };
    return { d: data ? 1 : 0, clk: control ? 1 : 0 };
  }

  const cellFor = root.Helpers.memoise(function (kind) {
    return Memory.latchCircuit(kind);
  });

  /** The cell is stateful, so a reading is a REPLAY: start from power-up and
   *  apply the steps in order. Reading it any other way would report a value
   *  that depends on which control the learner touched last. */
  function replay(kind, steps) {
    const net = cellFor(kind);
    const rows = [];
    let state = null;

    steps.forEach(function (step) {
      const run = Sim.simulate(net, portsFor(kind, step.d, step.c),
        { state: state, record: false });

      state = run.state;
      rows.push({ step: step, outputs: run.outputs, settleTime: run.settleTime,
        settled: run.settled });
    });
    return { net: net, rows: rows, state: state };
  }

  /** One sequence per cell, chosen so the last two steps apply the SAME
   *  inputs and leave different values — which is the whole of state. */
  function sequenceFor(kind) {
    if (kind === 'sr') {
      return [{ d: false, c: true, why: 'reset: force the output low' },
        { d: false, c: false, why: 'both low — hold, and the 0 stays' },
        { d: true, c: false, why: 'set: force the output high' },
        { d: false, c: false, why: 'both low again — the SAME inputs as step 2, and now it '
          + 'holds a 1' },
        { d: true, c: true, why: 'the forbidden combination: both outputs driven low' }];
    }
    return [{ d: true, c: false, why: 'data high, but the control is low' },
      { d: true, c: true, why: 'control high — a latch follows now, a flip-flop captured at '
        + 'the edge' },
      { d: false, c: true, why: 'data falls while the control is high: a latch follows it, a '
        + 'flip-flop does not' },
      { d: false, c: false, why: 'control low again — whatever is held is now held' },
      { d: true, c: false, why: 'data rises with the control low: nothing changes' }];
  }

  function reading() {
    const values = panel.values();

    return { kind: values['sto-cell'], d: Boolean(values['sto-d']),
      c: Boolean(values['sto-clock']), width: Number(values['sto-width']) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();
    const run = replay(view.kind, sequenceFor(view.kind).slice(0, 4)
      .concat([{ d: view.d, c: view.c, why: 'the inputs you have set' }]));
    const last = run.rows[run.rows.length - 1];

    paintMetrics(view, run, last);
    paintGraph(app, view, run);
    paintWave(app, view);
    paintSequence(view, run);
    paintCells(view);
    paintRegister(view);
    paintTiming(view);
  }

  function paintMetrics(view, run, last) {
    const net = run.net;
    const legal = (last.outputs.q ? 1 : 0) !== (last.outputs.nq ? 1 : 0);

    root.MetricGrid.update({
      'sto-q': { value: 'q = ' + (last.outputs.q ? 1 : 0),
        note: 'not-q = ' + (last.outputs.nq ? 1 : 0) },
      'sto-legal': { value: legal ? 'yes' : 'NO — both outputs agree',
        note: legal ? 'the cell is in one of its two stable states'
          : 'this is the forbidden input, and it is not a stored value at all' },
      'sto-gates': { value: Sim.gateCount(net),
        note: Sim.transistorCount(net) + ' transistors, against 6 for an AND' },
      'sto-settle': { value: last.settleTime,
        note: last.settled ? 'reached a stable value' : 'DID NOT SETTLE' },
      'sto-transparent': { value: transparency(view),
        note: 'measured by changing d and seeing whether q moves' },
      'sto-register': { value: registerStudy(view.width).gates + ' gates',
        note: (registerStudy(view.width).gates / view.width).toFixed(1) + ' per bit at ' +
          view.width + ' bits' }
    });
  }

  /** Transparency is measured, not asserted: hold the control where it is,
   *  flip the data, and see whether the output moved. */
  function transparency(view) {
    const net = cellFor(view.kind);
    const base = Sim.simulate(net, portsFor(view.kind, false, view.c), { record: false });
    const moved = Sim.simulate(net, portsFor(view.kind, true, view.c),
      { state: base.state, record: false });

    if (view.kind === 'sr') return 'not applicable — set and reset are not a data input';
    return (base.outputs.q ? 1 : 0) !== (moved.outputs.q ? 1 : 0)
      ? 'yes — q followed d' : 'no — q ignored d';
  }

  function paintGraph(app, view, run) {
    const host = root.jQuery('#sto-graph')[0];
    const built = root.CircuitGraph.definition(run.net, { values: null, limit: 20 });

    if (!host) return;
    if (!built.tooLarge) app.mermaid.render(host, built.text);
    else root.jQuery(host).empty();
    root.Helpers.setText('sto-graph-note', graphNote(view, run, built));
  }

  function graphNote(view, run, built) {
    const about = root.StoreTemplate.CELLS[view.kind].about;

    if (built.tooLarge) return 'Not drawn: ' + built.why + '. ' + about + '.';
    return 'Generated from the netlist. Follow the arrows and you will find a cycle — that is '
      + 'the memory, and it is why this circuit needs relaxation rather than one evaluation '
      + 'pass. ' + about + '.';
  }

  function paintWave(app, view) {
    const host = root.jQuery('#sto-wave')[0];
    const net = cellFor(view.kind);
    const settled = Sim.simulate(net, portsFor(view.kind, true, false), { record: false });
    const edge = Sim.simulate(net, portsFor(view.kind, true, true),
      { state: settled.state, record: true });

    if (!host) return;
    if (wave) wave.destroy();
    wave = root.WaveformView.render(host, { lazyLib: app.lazyLib,
      history: edge.history, signals: signalsFor(net, settled) });
    root.Helpers.setText('sto-wave-note', waveNote(view, edge));
  }

  function signalsFor(net, settled) {
    return net.order.filter(function (id) {
      return net.nodes[id].type !== 'const0' && net.nodes[id].type !== 'const1';
    }).slice(0, 8).map(function (id) {
      return { id: id, label: net.nodes[id].label || net.nodes[id].type,
        initial: settled.wires[id] };
    });
  }

  function waveNote(view, edge) {
    return 'Every wire in the cell as the control input rises with the data held high, in gate '
      + 'delays. The run settles after ' + edge.settleTime + ' delays and takes ' + edge.events +
      ' events to get there. On the flip-flop, watch the master freeze as the slave opens: the '
      + 'two are never transparent at the same time, which is the entire reason a synchronous '
      + 'machine can sample its whole state at one instant.';
  }

  function paintSequence(view, run) {
    fill('sto-sequence', run.rows.map(function (row, at) {
      return [String(at + 1), describe(view.kind, row.step),
        String(row.outputs.q ? 1 : 0), row.step.why, String(row.settleTime)];
    }));
    root.Helpers.setText('sto-sequence-caption', sequenceCaption(view, run));
  }

  function describe(kind, step) {
    if (kind === 'sr') return 's=' + (step.d ? 1 : 0) + ' r=' + (step.c ? 1 : 0);
    return 'd=' + (step.d ? 1 : 0) + ' ' + (kind === 'd' ? 'en=' : 'clk=') + (step.c ? 1 : 0);
  }

  function sequenceCaption(view, run) {
    const second = run.rows[1];
    const fourth = run.rows[3];

    if (view.kind === 'sr') {
      return 'Steps 2 and 4 apply exactly the same inputs — set and reset both low — and leave '
        + 'q at ' + (second.outputs.q ? 1 : 0) + ' and then at ' + (fourth.outputs.q ? 1 : 0) +
        '. That is what state means, and it is the first time on this site that a circuit\'s '
        + 'output has depended on anything but its inputs. Step 5 is the forbidden combination: '
        + 'both outputs go low, which is not a stored bit at all.';
    }
    return 'The replay starts from power-up and applies the steps in order, so the value shown '
      + 'is the one this history produces rather than whatever the last click left behind. '
      + 'Step 3 is the one to read: with the control high, the D latch follows the falling data '
      + 'and the flip-flop does not, because the flip-flop already captured at the edge.';
  }

  function paintCells(view) {
    fill('sto-cells', Object.keys(root.StoreTemplate.CELLS).map(function (kind) {
      const net = cellFor(kind);

      return [root.StoreTemplate.CELLS[kind].label, String(Sim.gateCount(net)),
        String(Sim.transistorCount(net)),
        kind === 'sr' ? 'always — it has no enable' :
          (kind === 'd' ? 'the enable is high' : 'never'),
        kind === 'sr' ? 'set and reset both high' : 'none',
        kind === 'sr' ? 'bus arbitration, a debouncer, the inside of every other cell'
          : (kind === 'd' ? 'a transparent pipeline stage, cheap storage in an ASIC'
            : 'every register and state machine in a synchronous design')];
    }));
    root.Helpers.setText('sto-cells-caption', cellsCaption(view));
  }

  function cellsCaption() {
    const sr = Sim.gateCount(cellFor('sr'));
    const dff = Sim.gateCount(cellFor('dff'));

    return 'Three cells, measured rather than described: ' + sr + ' gates for the SR latch and ' +
      dff + ' for the flip-flop, which is roughly the factor you pay to be edge-triggered. In '
      + 'a real library a flip-flop is around 24 transistors against 12 for a latch, and that '
      + 'ratio is why latch-based design survives in places where area matters more than '
      + 'simplicity.';
  }

  const registerStudy = root.Helpers.memoise(function (width) {
    const net = Memory.register({ width: width });

    return { net: net, gates: Sim.gateCount(net), width: width,
      transistors: Sim.transistorCount(net) };
  });

  /** Six cycles of a register, against a reference that is one JavaScript
   *  variable: the point is that the gates and the variable agree. */
  function registerRows(width) {
    const study = registerStudy(width);
    const plan = [{ d: 5, we: 1 }, { d: 9, we: 0 }, { d: 9, we: 1 }, { d: 0, we: 0 },
      { d: 12, we: 1 }, { d: 12, we: 0 }];
    let state = null;
    let held = 0;

    return plan.map(function (step, at) {
      const values = valuesFor(step, width);
      const run = Sim.cycle(study.net, values, state, 'clk');
      const before = readWord(run.before, width);
      const after = readWord(run.after, width);
      const expected = step.we ? (step.d & (Math.pow(2, width) - 1)) : held;

      state = run.state;
      held = expected;
      return [String(at + 1), String(step.d & (Math.pow(2, width) - 1)), String(step.we),
        String(before), String(after), after === expected ? String(expected) + ' — agrees'
          : String(expected) + ' — DISAGREES'];
    });
  }

  function valuesFor(step, width) {
    const values = { we: step.we };

    for (let at = 0; at < width; at += 1) values['d' + at] = (step.d >> at) & 1;
    return values;
  }

  function readWord(outputs, width) {
    let value = 0;

    for (let at = 0; at < width; at += 1) value += (outputs['q' + at] ? 1 : 0) << at;
    return value;
  }

  function paintRegister(view) {
    fill('sto-register-table', registerRows(view.width));
    root.Helpers.setText('sto-register-table-caption', registerCaption(view));
  }

  function registerCaption(view) {
    const study = registerStudy(view.width);

    return 'A ' + view.width + '-bit register — ' + study.gates + ' gates, ' +
      (study.gates / view.width).toFixed(1) + ' per bit — clocked through six cycles against a '
      + 'reference that is one variable. The two output columns are the same cycle read at two '
      + 'moments: before the edge the register still shows last cycle\'s value, after it shows '
      + 'the new one. Which of those a read port gives you is the read-during-write question, '
      + 'and it is why a pipeline forwards.';
  }

  function paintTiming() {
    fill('sto-timing', [
      ['setup time', 'the data must be stable this long BEFORE the clock edge',
        'the flip-flop captures the old value, or goes metastable',
        'the slowest combinational path between two registers sets the clock period'],
      ['hold time', 'the data must stay stable this long AFTER the edge',
        'a fast path from the previous stage overwrites the value being captured',
        'the FASTEST path, and no slower clock fixes it — you must add delay'],
      ['clock-to-q', 'how long after the edge the output is valid',
        'nothing on its own; it is a cost that eats into the next path\'s budget',
        'every timing report starts with it'],
      ['clock skew', 'the same edge arriving at two flip-flops at different times',
        'helps one constraint and hurts the other, which is why it is not simply bad',
        'a clock tree is the most carefully engineered wiring on a chip'],
      ['metastability', 'the data changed inside the aperture around the edge',
        'the output sits between 0 and 1 for an unbounded time',
        'every clock domain crossing; the answer is two flip-flops and a probability']
    ]);
    root.Helpers.setText('sto-timing-caption', 'Four constraints and one probability. The '
      + 'setup constraint is the one everybody knows because a slower clock fixes it; the hold '
      + 'constraint is the dangerous one, because it is violated by paths that are too FAST and '
      + 'slowing the clock does nothing. The next section but one turns these into arithmetic.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
