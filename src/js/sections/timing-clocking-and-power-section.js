/**
 * Section: Timing, clocking and power.
 *
 * This is static timing analysis on circuits the previous sections built. The
 * numbers are not estimates: every path is walked in the netlist, the critical
 * one is printed gate by gate, and the switching activity comes from running
 * real transitions and counting how often each wire moved.
 *
 * The glitch measurement is the reason power sits in the same section as
 * timing. A wire that changes twice before settling did no useful work and
 * cost exactly as much as a wire that changed once, so the hazard from the
 * minimisation section reappears here as a power bill.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'timing-clocking-and-power';
  const Sim = root.LogicSim;
  const Timing = root.Timing;
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
      title: 'Diagram — what has to fit inside one clock period',
      caption: 'The clock period must cover three things in series: the time from the clock '
        + 'edge until the launching flip-flop presents its value, the longest combinational '
        + 'path to the capturing flip-flop, and the setup time that flip-flop needs before the '
        + 'next edge. That is the setup constraint, and a slower clock always fixes it. The '
        + 'hold constraint is the other direction and it is the dangerous one: the SHORTEST '
        + 'path from launch to capture must be longer than the hold time, or the new value '
        + 'arrives before the old one has been captured — and slowing the clock does nothing at '
        + 'all, because both edges move together. Fixing a hold violation means adding delay to '
        + 'a path that is too fast, which is the only situation in engineering where the '
        + 'solution is to make something slower.',
      definition: [
        'flowchart LR',
        'E1(["clock edge n"]) --> L["launch flip-flop"]',
        'L -->|"clock-to-q"| C["combinational logic"]',
        'C -->|"longest path: setup constraint"| K["capture flip-flop"]',
        'C -.->|"shortest path: hold constraint"| K',
        'E2(["clock edge n+1"]) --> K',
        'K --> S["setup time<br/>must be met before edge n+1"]',
        'E1 -.->|"skew: the same edge arrives late here"| E2'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Static timing analysis walks paths, it does not simulate.** Every path from a start '
        + 'point to an end point is measured, and the worst one is reported. A start point is '
        + 'an input or a flip-flop output; an end point is an output or a flip-flop data input. '
        + 'This covers every possible '
        + 'input pattern at once, which is why it is what tools actually do and why simulation '
        + 'is not a substitute for it.',
      '**The clock period is clock-to-q, plus the logic, plus setup — and only the middle term '
        + 'is yours.** The overhead is paid once per stage whatever the logic does, which is '
        + 'what puts a floor under how far pipelining can go. The demo prints the overhead as a '
        + 'share of the period so that floor is visible rather than theoretical.',
      '**There are four classes of path and they are constrained differently.** '
        + 'Register-to-register sets the clock period. Input-to-register is an input setup '
        + 'requirement on whoever drives you. Register-to-output is a delay you impose on '
        + 'whoever reads you. Input-to-output is a pure combinational block with no clock in '
        + 'it at all.',
      '**Slack is the number a timing report exists to produce.** Target period minus required '
        + 'period: positive is headroom, negative is a design that does not run at the speed it '
        + 'was asked for. Every optimisation in a synthesis tool is aimed at the most negative '
        + 'slack, and every other path is ignored until that one is fixed.',
      '**Setup violations are fixed by a slower clock; hold violations are not.** A hold '
        + 'violation means the fastest path from one flip-flop to the next is shorter than the '
        + 'hold time, so the new value arrives before the old one was captured. Both clock '
        + 'edges move together when you slow the clock, so the only fix is to add delay — '
        + 'literally to insert buffers whose purpose is to be slow.',
      '**Pipelining buys throughput and pays in latency, and the overhead sets the ceiling.** '
        + 'Cutting the logic into k stages divides the logic term by k and adds the flip-flop '
        + 'overhead to each, so the speed-up saturates. The demo computes where — and the '
        + 'ceiling is the whole logic delay divided by the per-stage overhead, which is a small '
        + 'number in practice.',
      '**Dynamic power is proportional to how often wires change, so glitches cost real energy.** '
        + 'A wire that settles after changing three times burned three times the switching '
        + 'energy of one that changed once. The demo counts both from a real simulation, so the '
        + 'hazard from the minimisation section shows up here as a measured share of wasted '
        + 'switching.',
      '**Power goes as voltage squared, which is why the industry stopped raising frequency.** '
        + 'Two cores at half the frequency do the same work as one at full, and the lower '
        + 'frequency allows a lower voltage. The square makes that a large win. The '
        + 'demo\'s power table is that comparison, and it is the whole reason your laptop has '
        + 'eight cores rather than one very fast one.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — a timing report, and the power bill behind it',
        markup: root.TimingTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**The clock period is a budget, and every architectural decision in a processor is '
      + 'an argument about how to spend it.** Read a register, add, check a condition, select a '
      + 'result: everything that has to happen between two flip-flops is charged '
      + 'against one period. The period is set by the worst case over every input the '
      + 'circuit might ever see. That is why deeper pipelines were the answer for a decade '
      + '(smaller budget per stage, more stages) and why they stopped being the answer. The '
      + 'per-stage overhead is fixed, so the speed-up saturates, and every extra stage costs a '
      + 'cycle of branch misprediction penalty. The power half of the story is the one that '
      + 'ended the frequency race outright. Dynamic power goes as the square of the voltage, '
      + 'and a lower clock frequency permits a lower voltage. So two cores at half speed use '
      + 'dramatically less power than one core at full speed for the same throughput, provided '
      + 'the work can be split. That proviso is the whole of parallel programming. It is '
      + 'why Amdahl\'s law stopped being an academic curiosity around 2005 and became the thing '
      + 'that determines whether your software gets faster. The last thing to take away is '
      + 'smaller and sharper: glitches cost energy. A circuit that computes the right answer '
      + 'after wobbling three times has burned three times the switching energy of one that '
      + 'settled directly. That is why the redundant term that removed a hazard two sections '
      + 'ago also removed a power cost — the same fix, measured in a different unit.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.TimingTemplate.controls,
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

  function buildCircuit(kind) {
    if (kind === 'lookahead8') return root.Blocks.Adder.carryLookahead({ width: 8 });
    if (kind === 'alu8') return root.Blocks.Alu.alu({ width: 8 });
    if (kind === 'fsm') {
      return root.FsmSynth.synthesise(root.FsmSynth.sequenceDetector('moore'), 'binary').net;
    }
    if (kind === 'hazard') return hazardNet();
    return root.Blocks.Adder.rippleCarry({ width: 8 });
  }

  /** The circuit from the minimisation section, built by the same module, so
   *  the power measurement and the hazard measurement are of one netlist. */
  function hazardNet() {
    return root.Blocks.TwoLevel.netFor(['11-', '-01'], ['a', 'b', 'c']);
  }

  /**
   * Transitions to measure activity over: seeded random vectors across every
   * input, in pairs. A uniform walk of the low bits was tried first and it
   * measured almost no glitching, because consecutive vectors differ in one
   * or two bits and a glitch needs several inputs moving at once — which is a
   * good illustration of a benchmark that measures the sampling rather than
   * the circuit.
   */
  function transitionsFor(net) {
    const random = root.Random.seeded(20250829);
    const pairs = [];

    for (let at = 0; at < 32; at += 1) {
      pairs.push([vectorFor(net, random), vectorFor(net, random)]);
    }
    return pairs;
  }

  function vectorFor(net, random) {
    const values = {};

    net.inputs.forEach(function (id) {
      values[net.nodes[id].label] = random.int(2);
    });
    return values;
  }

  /* ---------------------------------------------------------- the measure */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const net = buildCircuit(parts.kind);
    const timing = Timing.frequency(net, { target: parts.target });

    return { net: net, kind: parts.kind, timing: timing,
      activity: Timing.activity(net, transitionsFor(net)),
      gates: Sim.gateCount(net) };
  });

  function reading() {
    const values = panel.values();

    return { kind: values['clk-circuit'], target: Number(values['clk-target']),
      stages: Number(values['clk-stages']), cores: Number(values['clk-cores']),
      study: studyFor(JSON.stringify({ kind: values['clk-circuit'],
        target: Number(values['clk-target']) })) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintPaths(view);
    paintCritical(view);
    paintPipeline(view);
    paintPower(view);
    paintRules(view);
    paintChart(app, view);
  }

  function paintMetrics(view) {
    const timing = view.study.timing;
    const activity = view.study.activity;

    root.MetricGrid.update({
      'clk-period': { value: timing.period,
        note: timing.logic + ' of logic plus ' + timing.overhead + ' of flip-flop overhead' },
      'clk-slack': { value: timing.slack,
        note: timing.slack >= 0 ? 'it fits, with room to spare'
          : 'it does NOT fit at this target' },
      'clk-limit': { value: timing.limitedBy || 'nothing measurable',
        note: 'the worst of the four path classes' },
      'clk-overhead': { value: (100 * timing.overhead / timing.period).toFixed(0) + '%',
        note: timing.overhead + ' gate delays, paid once per pipeline stage' },
      'clk-activity': { value: activity.perTransition.toFixed(1),
        note: 'over ' + activity.transitions + ' input transitions' },
      'clk-wasted': { value: (100 * activity.wastedShare).toFixed(1) + '%',
        note: activity.wasted + ' of ' + activity.changes + ' changes were glitches' }
    });
  }

  function paintPaths(view) {
    const worst = view.study.timing.worst;
    const meaning = {
      'register to register': 'sets the clock period — this is the one that matters',
      'input to register': 'a setup requirement you impose on whoever drives your inputs',
      'register to output': 'a delay you impose on whoever samples your outputs',
      'input to output': 'a pure combinational path, constrained by the system around it'
    };
    const rows = Object.keys(meaning).filter(function (key) { return worst[key]; })
      .map(function (key) {
        return [key, String(worst[key].delay), worst[key].from, worst[key].to, meaning[key]];
      });

    fill('clk-paths', rows.length ? rows
      : [['none', '—', '—', '—', 'this netlist has no measurable path']]);
    root.Helpers.setText('clk-paths-caption', pathsCaption(view, worst));
  }

  function pathsCaption(view, worst) {
    const register = worst['register to register'];

    if (!register) {
      return 'This circuit has no flip-flops, so it has no register-to-register path and no '
        + 'clock period of its own. Its delay becomes part of somebody else\'s period — which '
        + 'is exactly how a combinational block is budgeted in a real design, and why an '
        + 'adder\'s depth is a system-level number rather than a local one.';
    }
    return 'Four classes, and only the first sets this circuit\'s own clock period: ' +
      register.delay + ' gate delays from ' + register.from + ' to ' + register.to +
      '. The others are contracts with whatever is on the other side of the chip boundary, '
      + 'which is why a timing report has separate constraints for them.';
  }

  function paintCritical(view) {
    const critical = view.study.timing.critical;
    const period = view.study.timing.period;
    let running = 0;

    fill('clk-critical', (critical ? critical.path : []).map(function (step, at) {
      running += step.delay || 0;
      return [String(at + 1), (step.type || '?') + ' (' + (step.label || '-') + ')',
        String(step.delay || 0),
        String(running), (100 * (step.delay || 0) / period).toFixed(1) + '%'];
    }));
    root.Helpers.setText('clk-critical-caption', criticalCaption(view, critical));
  }

  function criticalCaption(view, critical) {
    if (!critical) return 'No path to report on this netlist.';
    return 'The worst path in the circuit, gate by gate — ' + critical.path.length +
      ' elements totalling ' + critical.delay + ' gate delays, from ' + critical.from + ' to ' +
      critical.to + '. This is the list a synthesis tool works down when it is trying to close '
      + 'timing: replace a gate with a faster one, refactor the logic, or cut the path with '
      + 'another pipeline register. Nothing else in the design matters until this list gets '
      + 'shorter.';
  }

  function paintPipeline(view) {
    const estimate = Timing.pipelineEstimate(view.study.timing.logic, view.stages, {});

    fill('clk-pipeline', estimate.rows.map(function (row) {
      return [String(row.stages), String(row.period), row.throughput.toFixed(4),
        String(row.latency), row.speedup.toFixed(2) + '×',
        (100 * estimate.overhead / row.period).toFixed(0) + '%'];
    }));
    root.Helpers.setText('clk-pipeline-caption', pipelineCaption(view, estimate));
  }

  function pipelineCaption(view, estimate) {
    const last = estimate.rows[estimate.rows.length - 1];

    return 'Cutting ' + view.study.timing.logic + ' gate delays of logic into stages. At ' +
      last.stages + ' stages the period is ' + last.period + ' for a speed-up of ' +
      last.speedup.toFixed(2) + '×, and the flip-flop overhead has grown to ' +
      (100 * estimate.overhead / last.period).toFixed(0) + '% of every cycle. The ceiling — '
      + 'the speed-up you would get from infinitely many stages — is ' +
      estimate.ceiling.toFixed(2) + '×, because the overhead is paid whatever you do. Latency '
      + 'gets worse the whole way down the table, which is the cost nobody advertises.';
  }

  function paintPower(view) {
    const scale = Timing.scaling({ cores: view.cores, exponent: 1 });
    const rows = [
      ['one core at full speed', '1.00', '1.00', '1.0', scale.single.total.toFixed(3),
        'the baseline'],
      [view.cores + ' cores at 1/' + view.cores + ' the frequency', scale.voltage.toFixed(3),
        (1 / view.cores).toFixed(3), String(view.cores), scale.many.total.toFixed(3),
        'yes — if the work divides'],
      ['one core, voltage held, frequency doubled', '1.00', '2.00', '1.0',
        Timing.power({ activity: 1, voltage: 1, frequency: 2 }).total.toFixed(3),
        'twice the throughput, and this is the row that stopped scaling'],
      ['the glitch-free version of this circuit',
        '1.00', '1.00', (1 - view.study.activity.wastedShare).toFixed(3),
        Timing.power({ activity: 1 - view.study.activity.wastedShare,
          voltage: 1, frequency: 1 }).total.toFixed(3),
        'same throughput, less switching']
    ];

    fill('clk-power', rows);
    root.Helpers.setText('clk-power-caption', powerCaption(view, scale));
  }

  function powerCaption(view, scale) {
    return 'Relative power, not watts: activity × voltage² × frequency, plus a leakage term '
      + 'that grows with voltage alone. ' + view.cores + ' cores at 1/' + view.cores +
      ' of the frequency, with the voltage scaled down in proportion, use ' +
      (100 * scale.ratio).toFixed(0) + '% of the power of one core at full speed for the same '
      + 'total work. The square on the voltage is doing all of that, and it is the entire '
      + 'reason the industry turned to multicore rather than to higher clocks.';
  }

  function paintRules(view) {
    fill('clk-rules', [
      ['negative setup slack', 'the logic does not fit in the period you asked for',
        'a slower clock, shallower logic, faster gates, or another pipeline stage',
        'buying a faster part with the same architecture'],
      ['negative hold slack', 'a path is too FAST: it overwrites the value being captured',
        'insert buffers to slow the path down',
        'slowing the clock — both edges move together, so nothing changes'],
      ['most of the period is overhead',
        'you have pipelined past the point where it helps',
        'fewer, fatter stages',
        'more stages: the speed-up ceiling is fixed by the overhead'],
      ['high glitch share',
        String((100 * view.study.activity.wastedShare).toFixed(1)) + '% of switching here '
          + 'computed nothing and cost full price',
        'balance path delays, or add the redundant terms that remove the hazards',
        'a faster clock — glitches happen inside the period either way'],
      ['clock skew', 'the same edge reaches two flip-flops at different times',
        'a balanced clock tree, and deliberate skew where it helps setup',
        'ignoring it: skew helps one constraint and hurts the other']
    ]);
    root.Helpers.setText('clk-rules-caption', 'Five findings from a timing report and what '
      + 'each one actually means. The second row is the one that catches people: a hold '
      + 'violation is a circuit that is too fast, and no amount of slowing the clock will '
      + 'help.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#clk-chart')[0];
    const estimate = Timing.pipelineEstimate(view.study.timing.logic, 8, {});

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 260, yLabel: 'clock period, and speed-up × 10',
      values: estimate.rows.reduce(function (out, row) {
        out.push({ label: row.stages + ' stages · period', value: row.period, series: 0 });
        out.push({ label: row.stages + ' stages · speed-up', value: row.speedup * 10,
          series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('clk-chart-note', chartNote(view, estimate));
  }

  function chartNote(view, estimate) {
    const two = estimate.rows[1];
    const eight = estimate.rows[7];

    return 'Clock period falling and speed-up rising as the same logic is cut into more '
      + 'stages, for the circuit selected above. Two stages give ' + two.speedup.toFixed(2) +
      '× and eight give ' + eight.speedup.toFixed(2) + '×, against a ceiling of ' +
      estimate.ceiling.toFixed(2) + '× — the period bars flatten out because the flip-flop '
      + 'overhead of ' + estimate.overhead + ' gate delays does not divide.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
