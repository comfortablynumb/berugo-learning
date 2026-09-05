/**
 * Section: State machines in hardware.
 *
 * The automata track built finite state machines as mathematics. This section
 * builds the same object out of flip-flops and gates, and then checks the two
 * against each other symbol by symbol: the transition table is the judge, the
 * netlist is the claim. Where they disagree, the netlist is wrong — which is
 * the only useful direction for that relationship to run.
 *
 * The encoding control is the real content. The same machine, the same
 * behaviour, three different assignments of bit patterns to states, and three
 * different circuits — one with the fewest flip-flops, one with the shallowest
 * decode, one that changes a single bit per step.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'hardware-state-machines';
  const Fsm = root.FsmSynth;
  const Timing = root.Timing;
  const ENCODINGS = ['binary', 'onehot', 'gray'];
  const CHECK_LENGTH = 8;
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
      title: 'Diagram — the shape every synchronous machine has',
      caption: 'One register holds the state. One block of combinational logic computes the '
        + 'next state from the current state and the inputs. A second block computes the '
        + 'output. That is the whole structure, and everything a processor does is an instance '
        + 'of it — a control unit, a cache controller, a bus protocol engine, a UART. The clock '
        + 'period is set by the longest path through the next-state logic plus the flip-flop '
        + 'overheads, so making a machine faster means either fewer levels of logic between '
        + 'states or more states with less work in each. The dotted line is the difference '
        + 'between Moore and Mealy: a Moore output reads only the register, a Mealy output '
        + 'reads the input too, which makes it one gate faster to react and one glitch harder '
        + 'to use.',
      definition: [
        'flowchart LR',
        'X(["input"]) --> NS["next-state logic<br/>combinational"]',
        'REG["state register<br/>flip-flops"] --> NS',
        'NS -->|"sampled at the clock edge"| REG',
        'REG --> OUT["output logic"]',
        'X -.->|"Mealy only"| OUT',
        'OUT --> Y["output"]',
        'CLK(["clock"]) --> REG'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Every synchronous machine is a register and two blocks of logic, and there are no '
        + 'other shapes.** The register holds the state, one block computes the next state from '
        + 'the state and the inputs, another computes the outputs. A control unit, a cache '
        + 'controller, a bus interface and a traffic light are the same circuit with different '
        + 'tables in the middle.',
      '**Synthesis from a transition table is mechanical, and the demo does it.** Each '
        + 'flip-flop\'s input is a Boolean function of the current state bits and the input. '
        + 'Those functions come out of the table, get minimised by the algorithm from two '
        + 'sections ago, and become gates. Nothing about this step requires judgement, which is '
        + 'why a language can describe the machine and a tool can build it.',
      '**The state encoding is a free choice with real consequences.** Binary uses the fewest '
        + 'flip-flops and needs a decoder to tell where it is. One-hot uses a flip-flop per '
        + 'state and the decode is a single wire, which is often shallower and faster. Gray '
        + 'changes one bit per step where the state order allows it, which matters when '
        + 'something outside the clock domain reads the state.',
      '**One-hot is usually the right default on an FPGA, and binary in a wide ASIC.** '
        + 'Flip-flops are abundant in an FPGA and logic levels are expensive, so one-hot wins. '
        + 'In an ASIC with hundreds of states, a flip-flop per state is real area, so binary '
        + 'with a decoded output wins. The demo measures both rather than asserting either.',
      '**Moore outputs are stable for the whole cycle; Mealy outputs react a cycle sooner.** A '
        + 'Moore output depends only on the state, so it changes just after the clock edge and '
        + 'is quiet for the rest of the period. A Mealy output depends on the input too, so it '
        + 'can respond within the same cycle — and it inherits every glitch on that input.',
      '**Mealy machines usually need fewer states, and that is the trade.** The demo\'s Mealy '
        + 'detector reports the pattern in the cycle the last symbol arrives; the Moore version '
        + 'needs an extra state to be in when it says so. Fewer states can mean fewer '
        + 'flip-flops, at the price of an output that is only valid while the input is.',
      '**The clock period is the longest path between two flip-flops, and the state machine is '
        + 'a path.** Setup time, clock-to-q and the next-state logic all fit inside one period, '
        + 'so a machine with deeply nested conditions in one state is a machine with a slow '
        + 'clock. Splitting one complicated state into two simple ones is the standard fix and '
        + 'it costs a cycle of latency.',
      '**An unreachable or unassigned state is a hardware hazard, not a warning.** Binary '
        + 'encoding of five states leaves three unused codes, and a glitch or a single-event '
        + 'upset can land the register in one of them. A machine with no defined transition out '
        + 'of those codes can stay there forever, which is why safety-critical designs make '
        + 'every unused code jump to reset.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — a transition table becomes flip-flops and gates',
        markup: root.HwFsmTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**The state encoding is the clearest example in this milestone of a choice that '
      + 'changes nothing about behaviour and everything about cost, and it has an exact analogue '
      + 'in software.** Binary, one-hot and Gray all implement the same transition table; they '
      + 'differ in how many flip-flops they need and how deep the logic that reads them is. '
      + 'Choosing one is choosing a representation, and choosing a representation is most of '
      + 'engineering. A bitset against a hash set, an enum against a set of booleans, a '
      + 'normalised table against a denormalised one. In every case the behaviour is fixed and '
      + 'the cost profile is not. In every case the right answer depends on what is scarce '
      + 'in the target: flip-flops on an FPGA, logic depth in a fast ASIC, memory bandwidth in '
      + 'a database. The second lesson is the unreachable state. Binary encoding of five states '
      + 'leaves three bit patterns that mean nothing, and a machine that never defines what to '
      + 'do in them is a machine that can wedge. That is exactly the illegal-enum-value problem '
      + 'and the deserialised-struct-with-an-impossible-field problem. It is the reason a state '
      + 'type that makes bad states unrepresentable is worth more than a state type with a '
      + 'comment saying which combinations are valid. In hardware the fix has a name — safe state '
      + 'encoding — and it costs gates, which is a useful reminder that the software version is '
      + 'not free either.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.HwFsmTemplate.controls,
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

  function cleanInput(text) {
    const kept = String(text || '').replace(/[^01]/g, '').slice(0, 24);

    return kept.length ? kept : '1101';
  }

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const machine = Fsm.sequenceDetector(parts.style);
    const inputs = Fsm.allInputs(CHECK_LENGTH);

    return { machine: machine, style: parts.style, scheme: parts.scheme,
      result: Fsm.compare(machine, parts.scheme, inputs), strings: inputs.length };
  });

  function reading() {
    const values = panel.values();

    return { style: values['hsm-style'], scheme: values['hsm-encoding'],
      input: cleanInput(values['hsm-input']),
      study: studyFor(JSON.stringify({ style: values['hsm-style'],
        scheme: values['hsm-encoding'] })) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();
    const abstract = Fsm.run(view.study.machine, view.input);
    const gates = Fsm.simulateMachine(view.study.result.built, view.input);

    paintMetrics(view, abstract, gates);
    paintGraph(app, view);
    paintTrace(view, abstract, gates);
    paintEncodings(view);
    paintCodes(view);
    paintStyles(view);
    paintChart(app, view);
  }

  function paintMetrics(view, abstract, gates) {
    const result = view.study.result;

    root.MetricGrid.update({
      'hsm-output': { value: gates.output || '(empty)',
        note: 'for the input ' + view.input },
      'hsm-agree': { value: abstract.output === gates.output ? 'identical' : 'DIFFERENT',
        note: 'the abstract machine says ' + abstract.output },
      'hsm-flops': { value: result.flops,
        note: view.study.machine.states.length + ' states, encoded ' + view.scheme },
      'hsm-gates': { value: result.gates, note: 'built from the minimised transition table' },
      'hsm-logic': { value: logicDepth(result), note: 'gate delays between two flip-flops' },
      'hsm-exhaustive': { value: view.study.strings,
        note: result.mismatches.length + ' mismatches over every string up to ' +
          CHECK_LENGTH + ' symbols' }
    });
  }

  /**
   * The number that sets the clock period is the register-to-register path,
   * not the input-to-output one: a state machine's slowest journey starts at a
   * flip-flop and ends at another flip-flop's data input. `criticalPath` walks
   * to the OUTPUTS, so on a Moore machine whose output is a wire off the state
   * register it reports 1 and means it — the path it measured really is that
   * short, and it is not the path the clock has to accommodate.
   */
  function timingOf(result) {
    return Timing.frequency(result.built.net, {});
  }

  function logicDepth(result) {
    return timingOf(result).logic;
  }

  function paintGraph(app, view) {
    const host = root.jQuery('#hsm-graph')[0];

    if (!host) return;
    app.mermaid.render(host, stateGraph(view.study.machine));
    root.Helpers.setText('hsm-graph-note', 'The transition table as a graph, generated from '
      + 'the same machine the synthesiser reads. A ' + view.style + ' machine puts its output '
      + (view.style === 'moore' ? 'in the state — the accepting state is the one labelled 1'
        : 'on the transition, so the pattern is reported as the last symbol arrives rather '
        + 'than in the cycle after it') + '. Every state has an edge for 0 and an edge for 1, '
      + 'which is what makes it deterministic and total.');
  }

  function stateGraph(machine) {
    const lines = ['stateDiagram-v2', '  [*] --> ' + machine.initial];

    machine.states.forEach(function (state) {
      if (machine.type === 'moore' && state.output) {
        lines.push('  ' + state.name + ' : ' + state.name + ' (output 1)');
      }
    });
    machine.transitions.forEach(function (edge) {
      const label = machine.type === 'mealy' ? edge.on + ' / ' + edge.output : String(edge.on);

      lines.push('  ' + edge.from + ' --> ' + edge.to + ' : ' + label);
    });
    return lines.join('\n');
  }

  function paintTrace(view, abstract, gates) {
    const rows = abstract.trace.map(function (step, at) {
      return [String(at + 1), String(step.input), step.from, step.to, String(step.output),
        gates.output[at], abstract.output[at] === gates.output[at] ? 'yes' : 'NO'];
    });

    fill('hsm-trace', rows);
    root.Helpers.setText('hsm-trace-caption', traceCaption(view, abstract, gates));
  }

  function traceCaption(view, abstract, gates) {
    const hits = abstract.output.split('').filter(function (ch) { return ch === '1'; }).length;

    return 'The abstract machine walks its transition table; the netlist clocks flip-flops. '
      + 'They produce the same ' + abstract.output.length + ' output bits, and the pattern is '
      + 'reported ' + hits + ' time(s) in this string. The gate column is read BEFORE the clock '
      + 'edge, which is where a downstream register would sample it — reading it after the edge '
      + 'would shift the whole output by one cycle and look like an off-by-one in the machine.'
      + (abstract.output === gates.output ? '' : ' They currently DISAGREE, which is a bug.');
  }

  function paintEncodings(view) {
    fill('hsm-encodings', ENCODINGS.map(function (scheme) {
      const study = studyFor(JSON.stringify({ style: view.style, scheme: scheme }));
      const result = study.result;

      return [scheme, String(result.flops), String(result.gates),
        String(logicDepth(result)), String(timingOf(result).period),
        result.mismatches.length === 0 ? 'none in ' + study.strings + ' strings'
          : String(result.mismatches.length) + ' — BROKEN'];
    }));
    root.Helpers.setText('hsm-encodings-caption', encodingsCaption(view));
  }

  function encodingsCaption(view) {
    const binary = studyFor(JSON.stringify({ style: view.style, scheme: 'binary' })).result;
    const hot = studyFor(JSON.stringify({ style: view.style, scheme: 'onehot' })).result;

    return 'One machine, three encodings, all checked against the transition table over every '
      + 'string up to ' + CHECK_LENGTH + ' symbols. Binary uses ' + binary.flops +
      ' flip-flops and ' + binary.gates + ' gates at logic depth ' + logicDepth(binary) +
      '; one-hot uses ' + hot.flops + ' flip-flops and ' + hot.gates + ' gates at depth ' +
      logicDepth(hot) + '. More flip-flops, shallower logic, identical behaviour — which is '
      + 'exactly why the choice is made per target rather than once.';
  }

  function paintCodes(view) {
    const machine = view.study.machine;
    const codes = ENCODINGS.map(function (scheme) { return Fsm.encode(machine, scheme); });

    fill('hsm-codes', machine.states.map(function (state) {
      return [state.name].concat(codes.map(function (coding) {
        return binaryOf(coding.codes[state.name], coding.bits);
      })).concat([String(state.output)]);
    }));
    root.Helpers.setText('hsm-codes-caption', codesCaption(view, codes));
  }

  function binaryOf(value, bits) {
    let text = '';

    for (let at = bits - 1; at >= 0; at -= 1) text += (value >> at) & 1;
    return text + ' (' + value + ')';
  }

  function codesCaption(view, codes) {
    const unused = Math.pow(2, codes[0].bits) - view.study.machine.states.length;

    return 'The actual bit patterns. Binary needs ' + codes[0].bits + ' flip-flops for ' +
      view.study.machine.states.length + ' states and therefore leaves ' + unused +
      ' unused code(s) — patterns the machine should never hold and has no defined transition '
      + 'out of. One-hot has no unused codes in that sense but has far more illegal ones: any '
      + 'pattern with two bits set. Deciding what happens in those is the difference between a '
      + 'design that recovers from an upset and one that wedges.';
  }

  function paintStyles(view) {
    const moore = studyFor(JSON.stringify({ style: 'moore', scheme: view.scheme })).result;
    const mealy = studyFor(JSON.stringify({ style: 'mealy', scheme: view.scheme })).result;

    fill('hsm-styles', [
      ['output depends on', 'the state alone', 'the state and the input',
        'Moore when the output drives something asynchronous'],
      ['when the output appears', 'the cycle AFTER the last symbol',
        'the same cycle as the last symbol', 'Mealy when a cycle of latency matters'],
      ['output stability', 'stable for the whole clock period',
        'follows the input, glitches included',
        'Moore for anything clocked elsewhere or leaving the chip'],
      ['gates for this detector', String(moore.gates) + ' at depth ' + logicDepth(moore),
        String(mealy.gates) + ' at depth ' + logicDepth(mealy),
        'measured, not assumed — the difference is small here and not always'],
      ['flip-flops', String(moore.flops), String(mealy.flops),
        'a Mealy machine often needs fewer states, which sometimes means fewer flip-flops']
    ]);
    root.Helpers.setText('hsm-styles-caption', 'Both machines detect the same pattern and '
      + 'both were checked against their own transition tables. The row that matters in '
      + 'practice is the third: a Mealy output inherits every glitch on the input, so it is the '
      + 'wrong thing to send to another clock domain, a chip pin, or anything that latches on a '
      + 'level rather than an edge.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#hsm-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'count, and gate delays',
      values: ENCODINGS.reduce(function (out, scheme) {
        const result = studyFor(JSON.stringify({ style: view.style, scheme: scheme })).result;

        out.push({ label: scheme + ' · gates', value: result.gates, series: 0 });
        out.push({ label: scheme + ' · flops', value: result.flops, series: 1 });
        out.push({ label: scheme + ' · depth', value: logicDepth(result), series: 2 });
        return out;
      }, [])
    });
    root.Helpers.setText('hsm-chart-note', chartNote(view));
  }

  function chartNote(view) {
    const binary = studyFor(JSON.stringify({ style: view.style, scheme: 'binary' })).result;
    const hot = studyFor(JSON.stringify({ style: view.style, scheme: 'onehot' })).result;

    return 'Three bars per encoding: gates, flip-flops and the logic depth between two clock '
      + 'edges. The trade is visible in the third bar — one-hot spends ' +
      (hot.flops - binary.flops) + ' extra flip-flops to reach depth ' + logicDepth(hot) +
      ' where binary needs ' + logicDepth(binary) + '. On an FPGA, where flip-flops come free '
      + 'with every lookup table, that is a straightforward win; on an ASIC with a thousand '
      + 'states it is not.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
