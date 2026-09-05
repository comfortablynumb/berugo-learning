/**
 * Section: The combinational building blocks.
 *
 * Six blocks, each built as a real netlist and each checked against a
 * behavioural model written from its specification rather than from its
 * structure. The input space of every one of these is finite, so "checked"
 * here means every vector, not a sample — which is the single largest
 * difference between verifying hardware and verifying software, and worth
 * meeting before the adders arrive.
 *
 * The comparison the section exists for is the multiplexer built two ways.
 * Same function, same interface, and a gate count that diverges exponentially
 * while the depth diverges logarithmically. Every later structure in the
 * milestone is a variation on that trade.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'combinational-blocks';
  const Sim = root.LogicSim;
  const Blocks = root.Blocks.Select;
  const Models = root.Blocks.Models;
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
      title: 'Diagram — a 4:1 multiplexer as a tree, which is the shape to remember',
      caption: 'Three 2:1 multiplexers. The low select bit chooses within each pair, the high '
        + 'bit chooses between the pairs, and the depth is two mux delays rather than one — but '
        + 'the gate count grows linearly with the width instead of exponentially. The same '
        + 'picture with the levels collapsed into one row of AND terms is the flat form: one '
        + 'gate delay, and a term per input. Everywhere a processor has to pick one of several '
        + 'values — a register read, a forwarding path, a cache way, a branch target — this '
        + 'tree is what is physically there, and its depth is why the number of forwarding '
        + 'sources in a pipeline is a design limit rather than a free choice.',
      definition: [
        'flowchart LR',
        'D0(["d0"]) --> M0["mux 2:1"]',
        'D1(["d1"]) --> M0',
        'D2(["d2"]) --> M1["mux 2:1"]',
        'D3(["d3"]) --> M1',
        'S0(["s0 — chooses within a pair"]) --> M0',
        'S0 --> M1',
        'M0 --> M2["mux 2:1"]',
        'M1 --> M2',
        'S1(["s1 — chooses between pairs"]) --> M2',
        'M2 --> Y["y<br/>depth 2, not 1"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A multiplexer is the universal combinational element, and it is everywhere in a '
        + 'processor.** Reading a register, forwarding a result, choosing a cache way, picking '
        + 'the next program counter — all of them are "select one of these". A lookup table in '
        + 'an FPGA is literally a multiplexer with its data inputs held in configuration bits, '
        + 'which is why any function at all fits into one.',
      '**Tree or flat is the same function and two different costs — and the textbook version of '
        + 'this claim is wrong on real gates.** The flat form decodes the select and gates every '
        + 'input, which is constant depth ONLY if a wide AND and a wide OR are single gates. '
        + 'Built from two-input gates, as the demo builds it, the flat 16:1 multiplexer is both '
        + 'larger and deeper than the tree. The constant-depth version needs an AND-OR array '
        + 'where a wide term is one row of transistors, which is what a PLA is and what a '
        + 'standard cell library is not.',
      '**A decoder turns an address into one hot wire, and it is the same shape as the flat '
        + 'multiplexer.** Every memory, every register file and every jump table has one, and '
        + 'its cost is why address decoding is pipelined in large arrays. Notice the duality: '
        + 'the flat mux is a decoder followed by an AND-OR, so the two blocks share a critical '
        + 'path and a cost curve.',
      '**A priority encoder is a chain, and that is why interrupt latency is what it is.** Each '
        + 'input can only win if nothing above it is set, so the "nothing above" signal ripples '
        + 'down the whole width. Equality can be a tree because OR is associative; priority '
        + 'cannot, because the answer depends on order. That is the same distinction as a '
        + 'parallel reduction against a sequential fold.',
      '**Equality and magnitude cost differently, and the reason is structural.** Equality is a '
        + 'tree of XNORs followed by an AND tree: log depth. Less-than has to find the most '
        + 'significant differing bit, which is a chain. That is why an unsigned comparison and '
        + 'a subtraction cost roughly the same: the comparator is a subtractor that throws the '
        + 'difference away.',
      '**A barrel shifter is why a variable shift is one cycle.** One multiplexer stage per bit '
        + 'of the shift amount, each stage moving by a power of two: log2(width) stages handle '
        + 'any distance. The alternative, shifting one place at a time, is width stages. A '
        + 'processor that did that would have a shift latency that depended on the operand, '
        + 'which is both slow and a timing side channel.',
      '**Every block here is exhaustively verified, and that is a hardware luxury.** A block with '
        + 'eleven inputs has 2048 possible input vectors, so the demo drives all of them through '
        + 'the netlist and through a model written from the specification. Software cannot '
        + 'usually do that; combinational hardware can, and where the space is too large the '
        + 'demo says so rather than implying coverage it did not have.',
      '**Fan-in limits are why the diagrams lie slightly.** A real library has no eight-input AND, '
        + 'so a wide term becomes a tree of two-input gates and the depth grows by another log. '
        + 'The measured numbers here already assume two-input gates, which is why the flat '
        + 'multiplexer is not quite the constant-depth block the theory promises.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — build a block, then check it against its specification',
        markup: root.BlocksTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**The reason to know these six blocks by their cost curves is that they explain the '
      + 'shape of every instruction set you will ever read.** A variable shift is one cycle '
      + 'because a barrel shifter is log-depth. A register file has two read ports because a '
      + 'third one adds a whole multiplexer tree per bit. A processor forwards from three '
      + 'places rather than ten, because each forwarding source is another input on a '
      + 'multiplexer that sits on the critical path. An interrupt controller has a priority '
      + 'chain, so its latency grows with the number of sources rather than staying flat. None '
      + 'of that is written down in the manual as a reason; the manual just gives you the '
      + 'latencies. But the reasons are all here, and they are all the same reason: depth is '
      + 'time and width is area. The second thing to take away is the verification method. '
      + 'These blocks are checked against a model of what they should do, over every input. '
      + 'The model is written from the specification in arithmetic rather than derived from '
      + 'the circuit. That is a testing discipline that transfers directly. A property written '
      + 'independently of the implementation and checked over the whole input space is worth '
      + 'more than any number of examples. Where the space is too large to walk, saying so '
      + 'is part of the result.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.BlocksTemplate.controls,
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

  function optionsFor(kind, bits, rotate) {
    if (kind === 'comparator') return { width: Math.pow(2, bits) };
    if (kind === 'barrelShifter') {
      return { width: Math.pow(2, bits + 1), rotate: rotate };
    }
    return { bits: bits };
  }

  function buildNet(kind, options) {
    if (kind === 'muxTree') return Blocks.muxTree(options);
    if (kind === 'muxFlat') return Blocks.muxFlat(options);
    if (kind === 'decoder') return Blocks.decoder(options);
    if (kind === 'priorityEncoder') return Blocks.priorityEncoder(options);
    if (kind === 'comparator') return Blocks.comparator(options);
    return Blocks.barrelShifter(options);
  }

  /* ---------------------------------------------------------- the measure */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const options = optionsFor(parts.kind, parts.bits, parts.rotate);
    const net = buildNet(parts.kind, options);
    const model = Models.modelFor(parts.kind, options);

    return { net: net, model: model, options: options, kind: parts.kind,
      gates: Sim.gateCount(net), transistors: Sim.transistorCount(net),
      path: Sim.criticalPath(net), equivalence: root.Hdl.equivalent(net, model, {}),
      vectors: sampleVectors(net) };
  });

  /** Eight input vectors spread across the space, deterministically: the first
   *  few, then a stride, so a wide block does not print only the corner where
   *  everything is zero. */
  function sampleVectors(net) {
    const total = Math.pow(2, Math.min(net.inputs.length, 16));
    const stride = Math.max(1, Math.floor(total / 8));
    const out = [];

    for (let at = 0; at < total && out.length < 8; at += stride) {
      out.push(Sim.assignmentOf(net, at));
    }
    return out;
  }

  function reading() {
    const values = panel.values();

    return studyFor(JSON.stringify({ kind: values['blk-block'],
      bits: Number(values['blk-size']), rotate: Boolean(values['blk-rotate']) }));
  }

  function show(values) {
    return Object.keys(values).map(function (name) {
      return name + '=' + (values[name] ? 1 : 0);
    }).join(' ');
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const study = reading();

    paintMetrics(study);
    paintGraph(app, study);
    paintBehaviour(study);
    paintCompare(study);
    paintScaling();
    paintUses(study);
    paintChart(app);
  }

  function paintMetrics(study) {
    const net = study.net;

    root.MetricGrid.update({
      'blk-shape': { value: net.inputs.length + ' in, ' + net.outputs.length + ' out',
        note: Math.pow(2, net.inputs.length) + ' possible input vectors' },
      'blk-gates': { value: study.gates,
        note: study.transistors + ' transistors in static CMOS' },
      'blk-depth': { value: study.path.delay, note: 'the longest chain of gates' },
      'blk-settle': { value: settleOf(study), note: 'event-driven, from all-zero inputs' },
      'blk-checked': { value: study.equivalence.checked,
        note: study.equivalence.exhaustive ? 'every vector in the space'
          : 'none — the space is too large' },
      'blk-verdict': { value: verdictOf(study), note: study.equivalence.why }
    });
  }

  function settleOf(study) {
    return Sim.simulate(study.net, study.vectors[study.vectors.length - 1],
      { record: false }).settleTime;
  }

  function verdictOf(study) {
    if (!study.equivalence.exhaustive) return 'not attempted';
    return study.equivalence.ok ? 'matches the model' : 'DISAGREES';
  }

  function paintGraph(app, study) {
    const host = root.jQuery('#blk-graph')[0];
    const built = root.CircuitGraph.definition(study.net,
      { critical: root.CircuitGraph.markPath(study.path.path) });

    if (!host) return;
    if (!built.tooLarge) app.mermaid.render(host, built.text);
    else root.jQuery(host).empty();
    root.Helpers.setText('blk-graph-note', graphNote(study, built));
  }

  function graphNote(study, built) {
    const about = root.BlocksTemplate.BLOCKS[study.kind].about;

    if (built.tooLarge) {
      return 'Not drawn: ' + built.why + '. That refusal is the point of the width control — '
        + 'the block is still simulated and still exhaustively checked at ' + study.gates
        + ' gates, but a diagram of them would be a grey rectangle. ' + about + '.';
    }
    return 'Generated from the netlist the simulator runs, so it cannot drift from it. The '
      + 'hexagons are the critical path — ' + study.path.delay + ' gate delays. ' + about + '.';
  }

  function paintBehaviour(study) {
    fill('blk-behaviour', study.vectors.map(function (values) {
      const wires = Sim.evaluate(study.net, values);
      const got = Sim.outputsOf(study.net, wires);
      const wanted = study.model(values);
      const same = Object.keys(wanted).every(function (port) {
        return (got[port] ? 1 : 0) === (wanted[port] ? 1 : 0);
      });

      return [show(values), show(got), show(wanted), same ? 'yes' : 'NO',
        String(Sim.simulate(study.net, values, { record: false }).settleTime)];
    }));
    root.Helpers.setText('blk-behaviour-caption', behaviourCaption(study));
  }

  function behaviourCaption(study) {
    return 'Eight vectors spread across the input space, run through the gates and through the '
      + 'model side by side. These eight are for reading; the verdict in the metrics above '
      + 'comes from all ' + (study.equivalence.exhaustive
      ? study.equivalence.checked + ' of them' : 'of them, which this block has too many of') +
      '. The settling column is the same circuit measured in time rather than in truth, and it '
      + 'is not constant across rows — a vector that flips more internal wires takes longer.';
  }

  function comparisonRow(kind, bits, rotate) {
    const study = studyFor(JSON.stringify({ kind: kind, bits: bits, rotate: rotate }));

    return [root.BlocksTemplate.BLOCKS[kind].label,
      study.net.inputs.length + ' in, ' + study.net.outputs.length + ' out',
      String(study.gates), String(study.transistors), String(study.path.delay),
      study.equivalence.exhaustive
        ? 'yes — ' + study.equivalence.checked + ' vectors, ' +
          (study.equivalence.ok ? 'all agree' : 'DISAGREES')
        : 'no — ' + study.net.inputs.length + ' inputs is past the limit'];
  }

  function paintCompare(study) {
    const values = panel.values();
    const bits = Number(values['blk-size']);
    const rotate = Boolean(values['blk-rotate']);

    fill('blk-compare', Object.keys(root.BlocksTemplate.BLOCKS).map(function (kind) {
      return comparisonRow(kind, bits, rotate);
    }));
    root.Helpers.setText('blk-compare-caption', 'Every block at the width you have chosen, '
      + 'built and measured by the same code. The two multiplexer rows are the same function '
      + 'and the same ports; everything else about them differs. The right-hand column is the '
      + 'part worth insisting on — a block that has not been checked against a model is a '
      + 'block somebody believes in, and the ones too wide to check say so.');
  }

  function paintScaling() {
    fill('blk-scaling', [1, 2, 3, 4].map(function (bits) {
      const tree = studyFor(JSON.stringify({ kind: 'muxTree', bits: bits, rotate: false }));
      const flat = studyFor(JSON.stringify({ kind: 'muxFlat', bits: bits, rotate: false }));

      return [Math.pow(2, bits) + ':1', String(tree.gates), String(tree.path.delay),
        String(flat.gates), String(flat.path.delay),
        (flat.gates / tree.gates).toFixed(2) + '×'];
    }));
    root.Helpers.setText('blk-scaling-caption', scalingCaption());
  }

  function scalingCaption() {
    const tree = studyFor(JSON.stringify({ kind: 'muxTree', bits: 4, rotate: false }));
    const flat = studyFor(JSON.stringify({ kind: 'muxFlat', bits: 4, rotate: false }));

    return 'The same four widths, both ways, and the result is not the one the textbook '
      + 'promises. At 16:1 the tree is ' + tree.gates + ' gates at depth ' + tree.path.delay +
      ' and the flat form is ' + flat.gates + ' gates at depth ' + flat.path.delay +
      ' — larger AND slower. "Flat is constant depth" assumes an unbounded fan-in AND and OR; '
      + 'with two-input gates the decode is itself a tree, so the flat form pays log depth '
      + 'twice. It wins only where a wide term really is one gate: a PLA row, a memory word '
      + 'line, a domino AND-OR. That is worth more than the slogan it replaces.';
  }

  function paintUses(study) {
    fill('blk-uses', [
      ['multiplexer', 'register read, result forwarding, next-PC select',
        'one cycle to choose among many sources',
        'too many forwarding paths widen the mux and lengthen the cycle'],
      ['decoder', 'instruction decode, memory row select, register write enable',
        'turns a dense address into one enable line',
        'a slow decoder pushes address setup into the previous cycle'],
      ['priority encoder', 'interrupt arbitration, free-list allocation, cache victim select',
        'the highest-priority requester, in order',
        'latency grows with the number of requesters, unlike a tree'],
      ['comparator', 'tag match, branch condition, bounds check',
        'equality in log depth, ordering in a chain',
        'a magnitude compare on the critical path costs as much as an add'],
      ['barrel shifter', 'shift and rotate instructions, field extraction, alignment',
        'any distance in ' + Math.log2(study.options.width || 8) + ' stages',
        'building it as repeated single shifts makes latency depend on the operand']
    ]);
    root.Helpers.setText('blk-uses-caption', 'The same six blocks, named where a processor '
      + 'actually contains them. The last column is the one to keep: each block has a cost '
      + 'shape, and every shape shows up as a limit somewhere in an instruction set or a '
      + 'microarchitecture.');
  }

  function paintChart(app) {
    const host = root.jQuery('#blk-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 260, logY: true, yLabel: 'gates (log scale)',
      values: [1, 2, 3, 4].reduce(function (out, bits) {
        const tree = studyFor(JSON.stringify({ kind: 'muxTree', bits: bits, rotate: false }));
        const flat = studyFor(JSON.stringify({ kind: 'muxFlat', bits: bits, rotate: false }));

        out.push({ label: Math.pow(2, bits) + ':1 tree', value: tree.gates, series: 0 });
        out.push({ label: Math.pow(2, bits) + ':1 flat', value: flat.gates, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('blk-chart-note', chartNote());
  }

  function chartNote() {
    const tree = studyFor(JSON.stringify({ kind: 'muxTree', bits: 4, rotate: false }));
    const flat = studyFor(JSON.stringify({ kind: 'muxFlat', bits: 4, rotate: false }));

    return 'Gate count on a log axis, tree against flat, as the multiplexer widens from 2:1 to '
      + '16:1. The tree grows linearly with the width and the flat form doubles with every '
      + 'select bit: ' + flat.gates + ' gates against ' + tree.gates + ' at the right-hand end, '
      + 'at depth ' + flat.path.delay + ' against ' + tree.path.delay + '. In a two-input gate '
      + 'library the flat form loses on both axes at every width measured here.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
