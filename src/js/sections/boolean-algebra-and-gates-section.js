/**
 * Section: Boolean algebra and gates.
 *
 * The demo derives rather than asserts. The truth table is produced by running
 * the circuit on every input combination, the canonical forms are read off
 * that table, and the diagram is generated from the same netlist the simulator
 * executes — so nothing on the page can drift from anything else on it.
 *
 * The two evaluators are both run on every row: the zero-delay reference and
 * the event-driven simulation. They must agree on the value and they say
 * different things about the time, which is the distinction the rest of the
 * milestone is built on.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'boolean-algebra-and-gates';
  const ORDER = ['xor', 'xorFromNand', 'notFromNand', 'andFromNand', 'orFromNand',
    'majority', 'mux', 'hazard'];
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
      title: 'Diagram — a CMOS inverter, which is where the delay comes from',
      caption: 'Two transistors, wired so that exactly one of them conducts. A high input '
        + 'switches the lower one on and connects the output to ground; a low input switches '
        + 'the upper one on and connects it to the supply. The output does not change '
        + 'instantly because the wire and the next gate\'s inputs have capacitance, and '
        + 'charging that through a transistor takes time — which is the propagation delay '
        + 'every number in this milestone is counted in. NAND and NOR are the cheap gates '
        + 'because they are one pull-up network and one pull-down network; AND is a NAND with '
        + 'an inverter after it, which is why it costs more and takes longer.',
      definition: [
        'flowchart TD',
        'V["supply"] --> P["p-type transistor<br/>conducts when the input is LOW"]',
        'P --> O["output"]',
        'O --> N["n-type transistor<br/>conducts when the input is HIGH"]',
        'N --> G["ground"]',
        'I["input"] -.->|"drives both gates"| P',
        'I -.-> N',
        'O -.->|"charging the next gate\'s capacitance<br/>is the propagation delay"| D["delay"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A Boolean function is a table, and everything else is an implementation of it.** Two '
        + 'inputs give four rows, three give eight, n give 2 to the n. Any assignment of '
        + 'zeros and ones to those rows is a function somebody could want. The demo derives '
        + 'the table by running the circuit, which is the right direction: the circuit is the '
        + 'claim and the table is what it actually does.',
      '**Any function can be written as a sum of products, mechanically.** Take the rows where '
        + 'the output is 1, write each as an AND of every input in the polarity that row has, '
        + 'and OR them together. That is the canonical sum of products, it is never minimal, '
        + 'and it exists for every function — which is what makes AND, OR and NOT functionally '
        + 'complete.',
      '**NAND alone is functionally complete, and the demo builds the proof.** A NAND with its '
        + 'inputs tied together is an inverter, and NAND followed by that inverter is AND. '
        + 'Inverting both inputs before a NAND gives OR, which is De Morgan\'s law as a '
        + 'circuit. So a chip can be built from one gate type, and the cost of doing it is '
        + 'visible in the table.',
      '**De Morgan\'s laws are the reason inverting gates dominate.** Not (a and b) is (not a) '
        + 'or (not b). Likewise not (a or b) is (not a) and (not b), so any AND-OR structure '
        + 'can be rewritten into NANDs or NORs. In static CMOS the inverting gates are the cheap ones, '
        + 'so that rewrite is not a curiosity, it is what the synthesis tool does.',
      '**A gate is transistors, and the count is the area.** An inverter is 2, a NAND or NOR is '
        + '4, an AND or OR is 6 because it is an inverting gate plus an inverter, and an XOR is '
        + '12. Those numbers are why the same function can cost twice as much depending on how '
        + 'it is factored, and why XOR-heavy logic is expensive.',
      '**Depth is latency and width is area, which is the trade the whole milestone measures.** '
        + 'A function can be computed by a shallow wide circuit or a deep narrow one; the first '
        + 'is fast and large, the second is slow and small. Every construction in the next four '
        + 'sections is a position on that line, and the circuit-complexity section in M26 '
        + 'stated the same trade formally.',
      '**Fan-in and fan-out are the physical limits behind the arithmetic.** A gate with many '
        + 'inputs is slow because the transistors are in series; a gate driving many loads is '
        + 'slow because it must charge all of them. Real libraries stop at three or four inputs '
        + 'and insert buffers, which is why an eight-input AND in a diagram is a tree of '
        + 'two-input ANDs in the silicon.',
      '**The truth table and the waveform are two different answers, and both are needed.** The '
        + 'table says what the circuit computes and the simulation says what it does on the way '
        + 'there. The `hazard` circuit in the demo is correct on all eight rows of its table, '
        + 'and its output still dips during one input change. The next section fixes that, and '
        + 'the sequential sections explain why you can usually ignore it.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — toggle the inputs, read the table off the circuit',
        markup: root.GatesTemplate.render() },
      diagram: diagram(),
      insight: '**Everything above this section is an abstraction over "a gate takes time and '
        + 'area", and the two numbers move in opposite directions.** That is the sentence to '
        + 'carry into the rest of the milestone, because every construction from here on is a '
        + 'choice between them. The flat multiplexer against the tree, the lookahead adder '
        + 'against the ripple, one-hot state encoding against binary. None of those is better; '
        + 'each is a position on a line whose ends are "fast and enormous" and "small and '
        + 'slow". The practical payoff for somebody who writes software is in reading '
        + 'instruction latency tables. The manual says a 64-bit add is one cycle, a variable '
        + 'shift is one cycle, a multiply is three and a divide is twenty. Those numbers are '
        + 'not arbitrary: they are gate depths. The add and the shift are log-depth networks, '
        + 'the multiply is an array of adders, and the divide is a sequence of subtractions '
        + 'that cannot be parallelised the same way. Knowing that turns the table from a list '
        + 'of magic numbers into something you can predict. It is why "avoid division in a '
        + 'hot loop" is durable advice while most micro-optimisation folklore is not.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.GatesTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function netFor(kind) {
    return root.GatesTemplate.build(root.LogicSim, kind);
  }

  const studyFor = root.Helpers.memoise(function (kind) {
    const net = netFor(kind);
    const table = root.LogicSim.truthTable(net);
    const rows = table.rows.map(function (row) {
      const run = root.LogicSim.simulate(net, row.inputs, { record: false });

      return { inputs: row.inputs, output: row.outputs.y, simulated: run.outputs.y,
        settle: run.settleTime };
    });

    return { kind: kind, net: net, rows: rows,
      spec: root.GatesTemplate.CIRCUITS[kind],
      agree: rows.filter(function (row) { return row.output === row.simulated; }).length,
      minterms: rows.reduce(function (into, row, at) {
        if (row.output) into.push(at);
        return into;
      }, []) };
  });

  function valuesFrom(net, controls) {
    const values = {};

    net.inputs.forEach(function (id) {
      const label = net.nodes[id].label;

      values[label] = controls['bag-' + label] ? 1 : 0;
    });
    return values;
  }

  function update(app) {
    const controls = panel.values();
    const study = studyFor(controls['bag-circuit']);
    const values = valuesFrom(study.net, controls);
    const run = root.LogicSim.simulate(study.net, values, { record: false });

    paintGraph(app, study, values, run);
    paintMetrics(study, run);
    paintTruth(study, values);
    paintCanonical(study);
    paintUniversal();
    paintCost();
    paintChart(app);
  }

  function paintGraph(app, study, values, run) {
    const host = root.jQuery('#bag-circuit-graph')[0];
    const critical = root.LogicSim.criticalPath(study.net);
    const built = root.CircuitGraph.definition(study.net,
      { values: run.wires, critical: root.CircuitGraph.markPath(critical.path) });

    if (!host) return;
    if (!built.tooLarge) app.mermaid.render(host, built.text);
    root.Helpers.setText('bag-circuit-note', 'This circuit is ' + study.spec.about +
      '. Every box shows the value it is holding for the inputs you have set; the hexagons are '
      + 'the critical path, which is the longest chain of gates from any input to the output — '
      + critical.delay + ' gate delays here. The diagram is generated from the netlist the '
      + 'simulator runs, so it cannot drift from it.');
  }

  function paintMetrics(study, run) {
    const gates = root.LogicSim.gateCount(study.net);

    root.MetricGrid.update({
      'bag-output': { value: run.outputs.y,
        note: 'settled after ' + run.events + ' events' },
      'bag-gates': { value: gates,
        note: root.LogicSim.transistorCount(study.net) + ' transistors in static CMOS' },
      'bag-depth': { value: root.LogicSim.criticalPath(study.net).delay,
        note: 'the longest input-to-output chain' },
      'bag-settle': { value: run.settleTime,
        note: run.settled ? 'the last wire stopped changing here' : 'IT NEVER SETTLED' },
      'bag-minterms': { value: study.minterms.length + ' of ' + study.rows.length,
        note: 'rows ' + (study.minterms.join(', ') || 'none') },
      'bag-agree': { value: study.agree + ' of ' + study.rows.length,
        note: 'the zero-delay reference against the event-driven run' }
    });
  }

  function showInputs(inputs) {
    return Object.keys(inputs).map(function (name) {
      return name + '=' + inputs[name];
    }).join(' ');
  }

  function paintTruth(study, values) {
    const current = showInputs(values);

    root.jQuery('#bag-truth tbody').html(study.rows.map(function (row, at) {
      const same = showInputs(row.inputs) === current;

      return '<tr' + (same ? ' class="row-current"' : '') + '><td class="mono">' + at +
        '</td><td class="mono">' + showInputs(row.inputs) + '</td><td class="mono">' +
        row.output + '</td><td class="mono">' + row.simulated + '</td><td class="mono">' +
        row.settle + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bag-truth-caption',
      'Nobody wrote this table down: it is the circuit run on every input combination, which '
      + 'for ' + study.net.inputs.length + ' inputs is ' + study.rows.length + ' rows and is '
      + 'exhaustive. The last two columns are the two evaluators — the zero-delay reference and '
      + 'the event-driven simulation — and they agree on ' + study.agree + ' of ' +
      study.rows.length + ' rows, which is the differential this milestone runs everywhere.');
  }

  function paintCanonical(study) {
    const names = study.net.inputs.map(function (id) { return study.net.nodes[id].label; });
    const bits = names.length;
    const cover = root.BooleanMin.greedyCover(study.minterms, [], bits);
    const rows = [
      { form: 'minterms', what: 'the rows where the output is 1',
        value: study.minterms.join(', ') || 'none' },
      { form: 'canonical sum of products',
        what: 'one AND per minterm, all ORed — mechanical, never minimal',
        value: canonicalSop(study.minterms, names, bits) },
      { form: 'minimised sum of products',
        what: 'the same function after merging adjacent terms',
        value: root.BooleanMin.expression(cover.terms, names) },
      { form: 'literals', what: 'the cost of the minimised form, which is roughly the gates',
        value: cover.cost + ' literals in ' + cover.terms.length + ' terms' }
    ];

    root.jQuery('#bag-canonical tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.form + '</td><td>' + row.what +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.value) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bag-canonical-caption',
      'The canonical form is generated from the table and the minimised form from the canonical '
      + 'one, so both describe this circuit rather than a circuit somebody meant to build. The '
      + 'gap between the two rows is what the next section is about: the canonical form is '
      + 'always available and always larger than it needs to be.');
  }

  function canonicalSop(minterms, names, bits) {
    if (!minterms.length) return '0';
    return minterms.map(function (mask) {
      return names.map(function (name, at) {
        return ((mask >> at) & 1) ? name : 'not ' + name;
      }).join(' and ');
    }).join(' or ');
  }

  function paintUniversal() {
    const rows = [
      { name: 'not', direct: 'not', built: 'notFromNand' },
      { name: 'and', direct: 'and', built: 'andFromNand' },
      { name: 'or', direct: 'or', built: 'orFromNand' },
      { name: 'exclusive or', direct: 'xor', built: 'xorFromNand' }
    ];

    root.jQuery('#bag-universal tbody').html(rows.map(function (row) {
      const net = netFor(row.built);
      const single = root.LogicSim.TRANSISTORS[row.direct];

      return '<tr><td class="mono">' + row.name + '</td><td class="mono">' + single +
        ' transistors</td><td class="mono">' + root.LogicSim.gateCount(net) +
        ' NANDs</td><td class="mono">' + root.LogicSim.transistorCount(net) +
        '</td><td class="mono">' + root.LogicSim.criticalPath(net).delay + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bag-universal-caption',
      'Functional completeness is not an abstract property here: each row is a circuit the '
      + 'demo can run, and the last two columns are what it costs to insist on one gate type. '
      + 'NAND-only XOR is four gates and sixteen transistors against twelve for the library '
      + 'cell — which is why a standard cell library ships XOR as a cell rather than leaving '
      + 'the synthesiser to build one.');
  }

  const COSTS = [
    { gate: 'not', why: 'one pull-up and one pull-down transistor: the whole of CMOS' },
    { gate: 'nand', why: 'two in series pulling down, two in parallel pulling up' },
    { gate: 'nor', why: 'the dual of NAND, and slower because the series devices are p-type' },
    { gate: 'and', why: 'a NAND followed by an inverter — inverting gates are the primitives' },
    { gate: 'or', why: 'a NOR followed by an inverter, for the same reason' },
    { gate: 'xor', why: 'no single-stage CMOS structure computes it; it is built from four' }
  ];

  function paintCost() {
    root.jQuery('#bag-cost tbody').html(COSTS.map(function (row) {
      return '<tr><td class="mono">' + row.gate + '</td><td class="mono">' +
        root.LogicSim.TRANSISTORS[row.gate] + '</td><td class="mono">' +
        root.LogicSim.DELAY[row.gate] + '</td><td>' +
        root.Helpers.escapeHtml(row.why) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bag-cost-caption',
      'The pattern in the first column is the one to remember: the inverting gates are cheap '
      + 'and the non-inverting ones are an inverting gate plus an inverter. That single fact is '
      + 'why De Morgan\'s laws are an engineering tool rather than an identity, and why a '
      + 'synthesised netlist is full of NANDs and NORs even when the source described ANDs and '
      + 'ORs.');
  }

  function paintChart(app) {
    const host = root.jQuery('#bag-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'transistors, and gate delays',
      values: ORDER.reduce(function (out, kind) {
        const net = netFor(kind);

        out.push({ label: kind + ' · area', value: root.LogicSim.transistorCount(net),
          series: 0 });
        out.push({ label: kind + ' · depth', value: root.LogicSim.criticalPath(net).delay,
          series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('bag-chart-note', chartNote());
  }

  function chartNote() {
    const single = netFor('xor');
    const built = netFor('xorFromNand');

    return 'Two bars per circuit: transistors and gate delays, which are area and latency. The '
      + 'two exclusive-or rows are the comparison worth reading — ' +
      root.LogicSim.transistorCount(single) + ' transistors at depth ' +
      root.LogicSim.criticalPath(single).delay + ' as a library cell, against ' +
      root.LogicSim.transistorCount(built) + ' at depth ' +
      root.LogicSim.criticalPath(built).delay + ' when built from NANDs. Functional '
      + 'completeness says the second one is possible; the numbers say why nobody ships it.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
