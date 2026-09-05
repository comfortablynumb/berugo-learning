/**
 * Section: Pipelining fundamentals.
 *
 * The M34 datapath spends 148 of its 175 gate delays in one stage, which is
 * why the multi-cycle machine of 34.6 lost. Pipelining takes the same short
 * clock and does not pay the cycles for it, and this section is where that
 * claim is measured rather than asserted: the same programs, the same unit
 * (gate delays), and both machines run.
 *
 * Everything here comes from `machines/brv32/pipeline.js`, which has its own
 * register file and operand selection and agrees with the M34 behavioural
 * simulator instruction by instruction. The stage-by-cycle diagram is built
 * from that machine's cycle log, so it cannot drift from the numbers beside
 * it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'pipelining-fundamentals';
  const Pipeline = root.Brv32.Pipeline;
  const Assembler = root.Brv32.Assembler;
  const Programs = root.Brv32.Programs;
  const View = root.PipelineView;
  let panel = null;
  let chart = null;

  /* Measured in M34.4: the whole datapath is 175 gate delays of logic plus 3
     of flip-flop overhead, and the slowest single block in it is the ALU at
     148. So a five-stage split of THIS datapath has a period of 151, not of
     175/5 + 3 = 38 - the stages are nowhere near balanced, and the section
     reports both numbers because the gap between them is the lesson. */
  const SINGLE_PERIOD = 178;
  const STAGE_PERIOD = 151;
  const BALANCED_PERIOD = 38;
  const NAMES = ['sum', 'arrayMax', 'strlen', 'factorial'];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — five instructions, five stages, one cycle apart',
      caption: 'Read down a column to see what the machine is doing in one cycle: five '
        + 'different instructions, each in a different stage. Read across a row to see one '
        + 'instruction take five cycles from start to finish. Both readings are true at once, '
        + 'and the gap between them is the whole idea — throughput is one instruction per '
        + 'cycle while latency is five.',
      definition: [
        'flowchart LR',
        '    subgraph c1["cycle 1"]',
        '        A1["i1: fetch"]',
        '    end',
        '    subgraph c2["cycle 2"]',
        '        A2["i1: decode"]',
        '        B2["i2: fetch"]',
        '    end',
        '    subgraph c3["cycle 3"]',
        '        A3["i1: execute"]',
        '        B3["i2: decode"]',
        '        C3["i3: fetch"]',
        '    end',
        '    subgraph c4["cycle 4"]',
        '        A4["i1: memory"]',
        '        B4["i2: execute"]',
        '        C4["i3: decode"]',
        '    end',
        '    subgraph c5["cycle 5"]',
        '        A5["i1: write back"]',
        '        B5["i2: memory"]',
        '        C5["i3: execute"]',
        '    end',
        '    A1 --> A2 --> A3 --> A4 --> A5',
        '    B2 --> B3 --> B4 --> B5',
        '    C3 --> C4 --> C5'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Pipelining overlaps instructions; it does not make any one of them faster.** Five '
        + 'stages means five instructions in flight, each in a different stage, and one '
        + 'finishing per cycle once the pipeline is full. The instruction itself still takes '
        + 'five cycles from fetch to write-back — longer, in fact, than it took on the '
        + 'single-cycle machine, because of the registers between the stages.',
      '**The clock period is the longest stage, not the longest path — and on this datapath '
        + 'that is barely an improvement.** The ALU alone is 148 of the 175 gate delays, so '
        + 'cutting the machine into five stages gives a period of 151 against 178. Pipelining '
        + 'an unbalanced datapath buys almost nothing, and the demo reports it losing rather '
        + 'than quietly assuming an even split.',
      '**Balance the stages and the same pipeline is nearly four times faster.** Divided '
        + 'evenly, 175 gate delays over five stages is 35 each, so the period would be 38 '
        + 'rather than 151. That gap is the entire benefit of pipelining. Getting it means '
        + 'replacing the ripple-carry adder from 33.6 — which is why "pipeline it" is not a '
        + 'design and "balance it, then pipeline it" is.',
      '**A pipeline register has to carry everything a later stage will need.** The '
        + 'destination register number is needed in write-back, four stages after decode read '
        + 'it; the immediate is needed in execute; the store data is needed in memory. Nothing '
        + 'can be looked up later, because by then the instruction that produced it is gone — '
        + 'so every field either travels or does not exist.',
      '**The ideal speed-up is the stage count and nobody gets it.** Filling the pipeline '
        + 'costs four cycles at the start, every stall costs one, and every flush costs two. '
        + 'The demo attributes every cycle to one of those four causes and the totals '
        + 'reconcile exactly, which is the check that keeps the model honest.',
      '**Latency gets worse and it is not a small effect.** Each pipeline register adds its '
        + 'own setup and clock-to-output time, so five short stages take longer end to end '
        + 'than one long one. Nobody advertises this. It is why a deeply pipelined '
        + 'processor can feel worse on a latency-sensitive workload than a shallower one.',
      '**IPC is the number to watch, and it is not the whole story either.** Instructions per '
        + 'cycle says how well the pipeline is being kept full; the clock period says how long '
        + 'a cycle is. The product is time, and 34.6 is the section that showed what happens '
        + 'when somebody quotes one of them.',
      '**The same trade appears wherever work is overlapped.** Request pipelining in HTTP, '
        + 'batching in a message queue, a GPU running many threads to hide memory latency. '
        + 'Every one of them raises throughput by making each individual unit of work take '
        + 'longer. Every one of them is a bad idea for a workload that cares about the '
        + 'individual unit.',
      '**Overlap creates hazards, and the next three sections are the bill.** One instruction '
        + 'reads a register that an instruction still in flight has not written yet. Two '
        + 'stages want one memory. A branch has a direction that is not known until three '
        + 'instructions later have been fetched. None of these exist in a machine that does '
        + 'one instruction at a time.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — the same program on both machines',
        markup: root.PipelineTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**Pipelining is the first place in this curriculum where making something faster '
      + 'means making every individual unit of work slower.** Recognising that shape is '
      + 'worth more than the mechanism. One instruction now takes five cycles instead of '
      + 'one, and each of those cycles has a pipeline register\'s setup time charged to it. '
      + 'The latency of a single instruction in isolation is therefore worse than it was. What '
      + 'improved is the rate at which instructions finish when there are many of them, and '
      + 'that is only an improvement if there are many of them. The same trade is everywhere '
      + 'once you know to look. HTTP request pipelining raises the number of requests a '
      + 'connection can carry, and raises the latency of the one behind a slow response. '
      + 'Batching raises a queue\'s throughput and delays every message that arrives just after '
      + 'a batch closes. A GPU runs thousands of threads to hide memory latency, and each '
      + 'thread is far slower than a CPU thread would be. In every case the honest question is '
      + 'the same one, and it is not "is this faster" but "which of throughput and latency does '
      + 'this workload actually pay for". A trading system and a batch analytics job want '
      + 'opposite answers from the same hardware, and the reason they do is on this page.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.PipelineTemplate.controls,
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

  const machineFor = root.Helpers.memoise(function (name) {
    const image = Assembler.assemble(Programs.CATALOGUE[name].source, { origin: 0 });
    const machine = Pipeline.create({ image: image.bytes, entry: 0, predictor: 'bimodal' });

    Pipeline.run(machine, { cycles: 3000, stopOnTrap: true });
    return { machine: machine, summary: Pipeline.summary(machine) };
  });

  function reading() {
    const values = panel.values();

    return { name: values['pfx-program'], cycles: Number(values['pfx-cycles']),
      run: machineFor(values['pfx-program']) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintAttribution(view);
    paintDiagram(view);
    paintCompare(view);
    paintRegisters();
    paintTradeoff();
    paintChart(app);
  }

  function timesFor(name) {
    const summary = machineFor(name).summary;

    return { pipelined: summary.cycles * STAGE_PERIOD,
      balanced: summary.cycles * BALANCED_PERIOD,
      single: summary.retired * SINGLE_PERIOD, summary: summary };
  }

  function paintMetrics(view) {
    const times = timesFor(view.name);
    const summary = view.run.summary;

    root.MetricGrid.update({
      'pfx-cycles-total': { value: summary.cycles,
        note: summary.retired + ' instructions retired' },
      'pfx-ipc': { value: summary.ipc.toFixed(3),
        note: 'the ideal is 1.000 and nothing reaches it' },
      'pfx-period': { value: STAGE_PERIOD,
        note: 'the 148-delay ALU stage plus 3 of overhead — the stages are not balanced' },
      'pfx-time': { value: times.pipelined,
        note: summary.cycles + ' cycles x ' + STAGE_PERIOD + ', against ' + times.single +
          ' single-cycle' },
      'pfx-single': { value: times.balanced,
        note: 'the same run at a balanced ' + BALANCED_PERIOD + '-delay period' },
      'pfx-latency': { value: 5 * STAGE_PERIOD,
        note: 'one instruction end to end, against ' + SINGLE_PERIOD + ' single-cycle' }
    });
  }

  function paintAttribution(view) {
    const found = View.attribution(view.run.summary);

    fill('pfx-attribution', found.rows.map(function (row) {
      return [row.name, row.cycles,
        (100 * row.cycles / found.cycles).toFixed(1) + '%', row.about];
    }));
    root.Helpers.setText('pfx-attribution-caption', 'Every cycle is accounted for and the '
      + 'total is ' + found.total + ' against ' + found.cycles + ' — '
      + (found.reconciles ? 'they reconcile, which is the check that keeps this honest.'
        : 'THEY DO NOT RECONCILE, which means the model is measuring something it has not '
          + 'described.') + ' A pipeline diagram that does not add up is decoration.');
  }

  function paintDiagram(view) {
    root.jQuery('#pfx-diagram').html(View.markup(view.run.machine, { cycles: view.cycles }));
    root.jQuery('#pfx-legend').html(legend());
    root.Helpers.setText('pfx-diagram-note', 'Read down a column for one cycle and across a '
      + 'row for one instruction. A row that repeats a stage was held there — the outline '
      + 'says whether by a stall or a flush, and hovering gives the reason the simulator '
      + 'recorded. The first four cycles are the fill: the pipeline is not yet retiring '
      + 'anything, and nothing can be done about that except run for longer.');
  }

  function legend() {
    return Pipeline.STAGES.map(function (stage) {
      return '<span class="pipe-key"><span class="pipe-swatch ' + View.STAGE_CLASS[stage] +
        '"></span>' + stage + '</span>';
    }).join('') +
      '<span class="pipe-key"><span class="pipe-swatch pipe-stall"></span>stalled</span>' +
      '<span class="pipe-key"><span class="pipe-swatch pipe-flush"></span>flushed</span>';
  }

  function paintCompare(view) {
    const times = timesFor(view.name);
    const summary = times.summary;

    fill('pfx-compare', [
      ['single cycle (34.4)', summary.retired, SINGLE_PERIOD, times.single, 'the baseline'],
      ['pipelined, stages as they are', summary.cycles, STAGE_PERIOD, times.pipelined,
        ratioText(times.single, times.pipelined)],
      ['pipelined, stages balanced', summary.cycles, BALANCED_PERIOD, times.balanced,
        ratioText(times.single, times.balanced)],
      ['balanced and hazard-free', summary.retired + 4, BALANCED_PERIOD,
        (summary.retired + 4) * BALANCED_PERIOD,
        ratioText(times.single, (summary.retired + 4) * BALANCED_PERIOD)]
    ]);
    root.Helpers.setText('pfx-compare-caption', compareCaption(times));
  }

  function ratioText(baseline, value) {
    if (value === baseline) return 'the same';
    return value < baseline ? (baseline / value).toFixed(2) + 'x faster than single cycle'
      : (value / baseline).toFixed(2) + 'x slower than single cycle';
  }

  function compareCaption(times) {
    const summary = times.summary;

    return 'The second row is the honest result and it is not the textbook one: pipelining '
      + 'THIS datapath into five stages is '
      + (times.pipelined > times.single ? 'slower' : 'barely faster')
      + ' than not pipelining it, because the stages are nowhere near balanced — the ALU '
      + 'alone is 148 of the 175 gate delays, so the period only falls from ' + SINGLE_PERIOD
      + ' to ' + STAGE_PERIOD + '. The third row is the same run with the logic divided '
      + 'evenly, at ' + BALANCED_PERIOD + ' delays a stage: '
      + (times.single / times.balanced).toFixed(1) + ' times faster. Pipelining does not pay '
      + 'for an unbalanced split, and balancing this one means replacing the ripple-carry '
      + 'adder of 33.6. The fourth row removes the hazards as well, which are worth '
      + (summary.cycles - summary.retired - 4) + ' cycles here and are what the next three '
      + 'sections are about.';
  }

  function paintRegisters() {
    fill('pfx-registers', [
      ['IF/ID', 'the instruction word and the address it was fetched from',
        'the address is needed to compute a branch target two stages later'],
      ['ID/EX', 'both source values, the immediate, the destination number and the control vector',
        'the register file is being read by a different instruction by then'],
      ['EX/MEM', 'the ALU result, the store data and the destination number',
        'the ALU is computing something else in the very next cycle'],
      ['MEM/WB', 'the value to write back and the destination number',
        'nothing else in the machine still knows which register this instruction wanted']
    ]);
    root.Helpers.setText('pfx-registers-caption', 'The destination register number appears in '
      + 'three of the four rows, which surprises people: it is read in decode and used in '
      + 'write-back, four stages later, so it has to be carried the whole way. That is the '
      + 'general rule — a pipeline register holds everything a later stage will need, because '
      + 'by the time the later stage runs there is nowhere left to look it up.');
  }

  function paintTradeoff() {
    fill('pfx-tradeoff', [
      ['this pipeline', 'throughput: one instruction finishes per cycle',
        'latency: five cycles instead of one, plus a register delay each',
        'the whole of this section'],
      ['HTTP request pipelining', 'requests in flight per connection',
        'one slow response blocks everything behind it',
        'head-of-line blocking, which is why HTTP/2 multiplexes and QUIC goes further'],
      ['batching in a queue', 'messages per second',
        'a message arriving just after a batch closes waits for the next one',
        'every "increase the batch size" performance fix'],
      ['a GPU\'s many threads', 'work completed per unit of memory bandwidth',
        'any single thread is far slower than a CPU thread',
        'why a GPU is wrong for a latency-bound task, whatever its throughput']
    ]);
    root.Helpers.setText('pfx-tradeoff-caption', 'Four systems, one shape. Each of them buys '
      + 'throughput by making an individual unit of work take longer, and each of them is the '
      + 'wrong choice for a workload that pays for the individual unit. Recognising the shape '
      + 'is worth more than the mechanism, because the mechanism is different every time and '
      + 'the question to ask is always the same one.');
  }

  function paintChart(app) {
    const host = root.jQuery('#pfx-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'gate delays',
      values: NAMES.reduce(function (out, name) {
        const times = timesFor(name);

        out.push({ label: name + ' single', value: times.single, series: 0 });
        out.push({ label: name + ' pipelined', value: times.pipelined, series: 1 });
        out.push({ label: name + ' balanced', value: times.balanced, series: 2 });
        return out;
      }, [])
    });
    root.Helpers.setText('pfx-chart-note', 'Three bars per program, in gate delays — the only '
      + 'unit these machines share. The middle bar is this datapath pipelined as it actually '
      + 'is, and it is level with the single-cycle bar or slightly worse; the third is the '
      + 'same pipeline with its logic divided evenly between the stages. The whole benefit of '
      + 'pipelining is in the gap between the second and third bars, which makes it a '
      + 'statement about stage balance rather than about pipelining.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
