/**
 * Section: Memory arrays and register files.
 *
 * A register file is storage plus the logic to reach it, and the demo measures
 * the two separately rather than repeating the slogan about which one wins.
 * Built from flip-flops the cells dominate; the access logic is the part that
 * grows with capacity, and it is the part an extra port multiplies. The ratio
 * is printed at four shapes so the trend is visible rather than asserted.
 *
 * The read-during-write measurement is the one to keep. `LogicSim.cycle`
 * reports the same cycle read on both sides of the clock edge, and on exactly
 * the cycles where a port reads the register being written the two answers
 * differ. That is not a bug in either reading — it is the question every
 * pipeline forwarding path exists to answer.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'memory-arrays';
  const Sim = root.LogicSim;
  const Memory = root.Blocks.Memory;
  const SHAPES = [{ count: 2, width: 4 }, { count: 4, width: 4 }, { count: 8, width: 4 },
    { count: 8, width: 8 }];
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
      title: 'Diagram — one write port, two read ports, and where the gates go',
      caption: 'The array is a grid of flip-flops: one row per register, one column per bit. '
        + 'Writing is a decoder — the write address turns into one enable line — and it is '
        + 'cheap, because a decoder is shared across the whole row. Reading is a multiplexer '
        + 'tree per bit per port, and that is where the cost lives: every extra read port '
        + 'duplicates the entire multiplexer structure. This is why a three-operand instruction '
        + 'set needs two read ports and one write port, why adding a third read port for a '
        + 'fused multiply-add is a real architectural decision, and why a register file with '
        + 'thirty-two entries and eight ports is one of the densest, hottest blocks on a chip.',
      definition: [
        'flowchart LR',
        'WA(["write address"]) --> DEC["decoder<br/>one enable per register"]',
        'WE(["write enable"]) --> DEC',
        'DEC --> R0["register 0"]',
        'DEC --> R1["register 1"]',
        'DEC --> RN["register n"]',
        'D(["write data"]) --> R0',
        'D --> R1',
        'D --> RN',
        'R0 --> MA["read mux A<br/>one tree per bit"]',
        'R1 --> MA',
        'RN --> MA',
        'R0 --> MB["read mux B<br/>a second whole tree"]',
        'R1 --> MB',
        'RN --> MB',
        'RA(["read address A"]) --> MA',
        'RB(["read address B"]) --> MB',
        'MA --> X["port A"]',
        'MB --> Y["port B"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A register file is an array of registers plus the logic to address it, and which half '
        + 'dominates depends on what a cell costs.** Built from flip-flops, as the demo builds '
        + 'it, a stored bit is about thirteen gates and the access logic is a fraction of the '
        + 'total. The measured share climbs from roughly a tenth at two registers to nearly a '
        + 'fifth at eight. Swap the flip-flops for six-transistor SRAM cells, which is what a '
        + 'real array does, and the same access logic becomes the dominant cost.',
      '**Writing is a decoder and reading is a multiplexer, which is the duality from the blocks '
        + 'section.** Both structures turn an address into a selection; one drives an enable '
        + 'line, the other steers data out. Recognising them means a memory is not a new kind of '
        + 'circuit, it is two blocks you already measured, arranged around some storage.',
      '**Ports are the dimension that hurts.** Doubling the registers doubles the flip-flops and '
        + 'adds one level to each read tree. Adding a read port duplicates every read tree in '
        + 'the file. That asymmetry is why superscalar processors need enormous register files, '
        + 'why register renaming makes them larger still, and why the file is often the '
        + 'frequency-limiting block.',
      '**Read-during-write is a design decision with two defensible answers.** If a port reads '
        + 'the register being written in the same cycle, it can return the old value or the new '
        + 'one. The demo measures both by sampling either side of the clock edge. Neither is '
        + 'wrong; what is wrong is not knowing which one your hardware does.',
      '**Flip-flop storage is enormously expensive per bit, which is why SRAM exists.** A '
        + 'flip-flop is around twenty transistors; an SRAM cell is six, with two of them '
        + 'shared bit lines rather than gates. That factor of three is why a register file is '
        + 'measured in hundreds of bits, a cache in millions, and they are built from different '
        + 'cells.',
      '**DRAM trades transistors for refresh.** One transistor and one capacitor per bit is the '
        + 'densest thing anybody has built, and the price is that the charge leaks. The array '
        + 'has to be read and rewritten thousands of times a second, and a read destroys the row '
        + 'it touched. Everything odd about DRAM timing follows from those two facts.',
      '**The array is a grid, so a memory access is a row and then a column.** Activating a row '
        + 'brings a whole page into the sense amplifiers, and columns are then cheap. That is '
        + 'where the memory hierarchy\'s locality assumption physically comes from — a sequential '
        + 'access pattern is not merely cache-friendly, it is row-buffer-friendly one level '
        + 'further down.',
      '**Content-addressable memory inverts the interface and pays for it.** A CAM compares the '
        + 'search key against every entry at once, which is a comparator per entry and a power '
        + 'bill to match. It is what a fully associative cache and a TLB are built from, and its '
        + 'cost is why associativity is a small number rather than a large one.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — a register file, clocked, against its reference',
        markup: root.MemArrayTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**The register file is where the memory hierarchy starts.** The asymmetry that '
      + 'shapes the whole hierarchy is visible in this one block: capacity is the cheap '
      + 'dimension and concurrent access is the expensive one. Doubling the number of '
      + 'registers costs flip-flops in proportion and adds one level to each read tree. Adding '
      + 'a port costs a whole multiplexer tree per bit and touches nothing else. That asymmetry '
      + 'propagates all the way up. A cache is '
      + 'banked rather than multiported because ports are what cost. A DRAM has one row buffer '
      + 'and gets its bandwidth from bursting along it. A database index is cheap to read and '
      + 'expensive to keep sorted under concurrent writers. In every case the capacity is the '
      + 'easy dimension and the concurrent-access dimension is the hard one. That is why '
      + '"just add more memory" works and "just add more parallel readers" does not. The second '
      + 'thing worth carrying is the read-during-write question, because it is the hardware '
      + 'version of a race condition. It has the same three possible answers: you get the '
      + 'old value, you get the new value, or the design forbids the situation. Hardware picks '
      + 'one and documents it. A pipeline that reads the register file in the same cycle a '
      + 'previous instruction writes it needs a forwarding path precisely because the answer is '
      + '"the old value". That forwarding path is one of the most bug-prone parts of a '
      + 'simple processor, for exactly the reason concurrent code is bug-prone. The correct '
      + 'behaviour depends on a timing relationship that is invisible in the source.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.MemArrayTemplate.controls,
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

  const fileFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const net = Memory.registerFile({ count: parts.count, width: parts.width });
    const cells = parts.count * parts.width;

    return { net: net, count: parts.count, width: parts.width, cells: cells,
      gates: Sim.gateCount(net), transistors: Sim.transistorCount(net),
      readDepth: readDepth(net), storage: cells * flopGates() };
  });

  /** A register bit is a flip-flop, a hold buffer and a recirculating mux, so
   *  "storage" is not one gate per bit and pretending it is would overstate
   *  the access overhead. Measured once, from a one-bit register. */
  const flopGates = root.Helpers.memoise(function () {
    return Sim.gateCount(Memory.register({ width: 1 })) - 0;
  });

  function readDepth(net) {
    const timing = root.Timing.frequency(net, {});

    return timing.logic;
  }

  function addressBits(values, prefix, address, bits) {
    for (let at = 0; at < bits; at += 1) values[prefix + at] = (address >> at) & 1;
  }

  function driveFor(step, file) {
    const bits = Math.log2(file.count);
    const values = { we: step.we, clk: 0 };

    for (let at = 0; at < file.width; at += 1) values['d' + at] = (step.data >> at) & 1;
    addressBits(values, 'wa', step.write, bits);
    addressBits(values, 'ra', step.readA, bits);
    addressBits(values, 'rb', step.readB, bits);
    return values;
  }

  function wordOf(outputs, prefix, width) {
    let value = 0;

    for (let at = 0; at < width; at += 1) value += (outputs[prefix + at] ? 1 : 0) << at;
    return value;
  }

  /* ---------------------------------------------------------- the measure */

  function planFor(view) {
    const limit = Math.pow(2, view.width) - 1;
    const target = Math.min(view.readA, view.count - 1);
    const other = (target + 1) % view.count;

    return [
      { we: 1, write: target, data: 5 & limit, readA: target, readB: other },
      { we: 0, write: target, data: 9 & limit, readA: target, readB: other },
      { we: 1, write: other, data: 9 & limit, readA: target, readB: other },
      { we: 1, write: target, data: 12 & limit,
        readA: view.sameCycle ? target : other, readB: other },
      { we: 0, write: target, data: 0, readA: target, readB: other },
      { we: 1, write: other, data: 3 & limit, readA: other, readB: target }
    ];
  }

  /** Six clocked cycles through the gates, beside the behavioural model. The
   *  model writes on the edge and reads the OLD value, which is the choice
   *  the before-edge column matches and the after-edge column does not. */
  function runCycles(view) {
    const file = fileFor(JSON.stringify({ count: view.count, width: view.width }));
    const rows = [];
    let state = null;
    let contents = new Array(view.count).fill(0);

    planFor(view).forEach(function (step, at) {
      const run = Sim.cycle(file.net, driveFor(step, file), state, 'clk');
      const model = Memory.fileReference(contents, { writeEnable: step.we,
        writeAddress: step.write, data: step.data & (Math.pow(2, view.width) - 1),
        readA: step.readA, readB: step.readB });

      state = run.state;
      contents = model.state;
      rows.push({ at: at, step: step, before: wordOf(run.before, 'x', view.width),
        after: wordOf(run.after, 'x', view.width), model: model.x });
    });
    return { file: file, rows: rows };
  }

  function reading() {
    const values = panel.values();
    const count = Number(values['ram-count']);

    return { count: count, width: Number(values['ram-width']),
      readA: Math.min(Number(values['ram-read']), count - 1),
      sameCycle: Boolean(values['ram-sameCycle']) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();
    const run = runCycles(view);

    paintMetrics(view, run);
    paintCycles(view, run);
    paintCost(view);
    paintPorts(view);
    paintTech();
    paintChart(app);
  }

  function paintMetrics(view, run) {
    const file = run.file;
    const agree = run.rows.filter(function (row) { return row.before === row.model; }).length;
    const split = run.rows.filter(function (row) { return row.before !== row.after; }).length;

    root.MetricGrid.update({
      'ram-cells': { value: file.cells,
        note: view.count + ' registers of ' + view.width + ' bits' },
      'ram-gates': { value: file.gates, note: file.transistors + ' transistors' },
      'ram-overhead': { value: (100 * (file.gates - file.storage) / file.gates).toFixed(0) + '%',
        note: (file.gates - file.storage) + ' of ' + file.gates + ' gates are decode and read '
          + 'multiplexing' },
      'ram-depth': { value: file.readDepth, note: 'register to register, through a read port' },
      'ram-cycles': { value: agree + ' of ' + run.rows.length,
        note: 'the before-edge reading against the model' },
      'ram-rdw': { value: split + ' of ' + run.rows.length + ' cycles differ',
        note: 'cycles where reading before and after the edge disagree' }
    });
  }

  function paintCycles(view, run) {
    fill('ram-cycles-table', run.rows.map(function (row) {
      return [String(row.at + 1),
        row.step.we ? 'r' + row.step.write + ' ← ' + (row.step.data &
          (Math.pow(2, view.width) - 1)) : 'none',
        'r' + row.step.readA, String(row.before), String(row.after), String(row.model),
        row.before === row.model ? 'yes' : 'NO'];
    }));
    root.Helpers.setText('ram-cycles-table-caption', cyclesCaption(view, run));
  }

  function cyclesCaption(view, run) {
    const split = run.rows.filter(function (row) { return row.before !== row.after; });

    if (!split.length) {
      return 'Six clocked cycles, with the port A reading taken on both sides of the clock '
        + 'edge. On this schedule the two readings never differ, because no cycle reads the '
        + 'register it is writing — tick the read-during-write box to arrange one.';
    }
    return 'Six clocked cycles. On cycle ' + (split[0].at + 1) + ' the port reads r' +
      split[0].step.readA + ' while the file writes it, and the two readings of the same cycle '
      + 'differ: ' + split[0].before + ' before the edge and ' + split[0].after +
      ' after it. The reference — which writes on the edge and returns the old value — matches '
      + 'the before-edge column. A pipeline that reads its operands in this cycle therefore '
      + 'needs a forwarding path, and that is where the requirement comes from.';
  }

  function paintCost(view) {
    fill('ram-cost', SHAPES.map(function (shape) {
      const file = fileFor(JSON.stringify(shape));

      return [shape.count + ' × ' + shape.width + ' bits', String(file.cells),
        String(file.gates), (file.gates / file.cells).toFixed(1), String(file.readDepth),
        (100 * (file.gates - file.storage) / file.gates).toFixed(0) + '% is access logic'];
    }));
    root.Helpers.setText('ram-cost-caption', costCaption(view));
  }

  function costCaption() {
    const small = fileFor(JSON.stringify(SHAPES[0]));
    const large = fileFor(JSON.stringify(SHAPES[2]));

    const share = function (file) {
      return (100 * (file.gates - file.storage) / file.gates).toFixed(0) + '%';
    };

    return 'Four shapes, built and measured. From ' + small.count + ' registers to ' +
      large.count + ' at the same width, the flip-flops go from ' + small.cells + ' to ' +
      large.cells + ' and the gates from ' + small.gates + ' to ' + large.gates +
      '. Storage grows in proportion; access logic grows faster, from ' + share(small) +
      ' of the total to ' + share(large) + ', because every extra register is another decoder '
      + 'term and another leaf on both read trees. In an SRAM array, where a cell costs about a '
      + 'third of a flip-flop, that same access logic is the larger half.';
  }

  function paintPorts(view) {
    const one = fileFor(JSON.stringify({ count: view.count, width: view.width }));

    fill('ram-ports', [
      ['one write port', 'a decoder and an enable per register',
        'grows with the number of registers, shared across all bits',
        'the cheap direction — every register file has one'],
      ['two read ports', 'a full multiplexer tree per bit, per port',
        'grows with registers × bits × ports; this file spends ' +
          (one.gates - one.storage) + ' gates on access logic',
        'a three-operand instruction set: add rd, rs1, rs2'],
      ['a third read port', 'another complete tree per bit',
        'roughly +50% on the read side for one more operand',
        'fused multiply-add, and the reason it is a separate design decision'],
      ['many ports', 'a comparator or a tree per port per entry',
        'quadratic pressure: area, delay and power all rise together',
        'a superscalar register file; often the frequency-limiting block'],
      ['banking instead of ports', 'split the array and accept conflicts',
        'cheap when accesses spread out, a stall when they collide',
        'multi-banked caches and GPU register files']
    ]);
    root.Helpers.setText('ram-ports-caption', 'Capacity is the easy dimension and ports are '
      + 'the hard one. That single asymmetry explains banked caches, why a load-store unit has '
      + 'so few ports, and why a wide out-of-order machine spends an enormous fraction of its '
      + 'area on the register file and its bypass network.');
  }

  function paintTech() {
    fill('ram-tech', [
      ['flip-flop', 'about 20', 'combinational read, edge-triggered write',
        'it is made of gates, so it needs no special process step',
        'register files, pipeline registers, anything small and fast'],
      ['SRAM cell', '6', 'row select, then sense the bit lines',
        'cross-coupled inverters with two access transistors: no refresh, small',
        'caches, tag arrays, TLBs — kilobytes to megabytes'],
      ['DRAM cell', '1 plus a capacitor', 'destructive read, then write back',
        'the densest storage anybody builds, at the price of refresh',
        'main memory, where density beats latency'],
      ['content-addressable', 'SRAM plus a comparator per entry',
        'compare the key against every entry at once',
        'the interface is by value rather than by address',
        'fully associative caches and TLBs, kept small because it is expensive'],
      ['flash', '1, with a floating gate', 'read fast, erase in large blocks',
        'the charge survives without power, and the erase granularity is the price',
        'storage, and the reason SSDs have a translation layer']
    ]);
    root.Helpers.setText('ram-tech-caption', 'Five technologies, ordered by transistors per '
      + 'bit. The gap between a flip-flop and an SRAM cell is roughly a factor of three, and '
      + 'between SRAM and DRAM another factor of six — which is precisely why the memory '
      + 'hierarchy has the levels it has, at the sizes it has.');
  }

  function paintChart(app) {
    const host = root.jQuery('#ram-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 260, yLabel: 'gates',
      values: SHAPES.reduce(function (out, shape) {
        const file = fileFor(JSON.stringify(shape));
        const label = shape.count + '×' + shape.width;

        out.push({ label: label + ' storage', value: file.storage, series: 0 });
        out.push({ label: label + ' access', value: file.gates - file.storage, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('ram-chart-note', chartNote());
  }

  function chartNote() {
    const small = fileFor(JSON.stringify(SHAPES[0]));
    const large = fileFor(JSON.stringify(SHAPES[2]));
    const share = function (file) {
      return (100 * (file.gates - file.storage) / file.gates).toFixed(0) + '%';
    };

    return 'Two bars per shape: the gates inside the storage cells and the gates spent getting '
      + 'at them. Access logic is ' + share(small) + ' of a ' + small.count +
      '-register file and ' + share(large) + ' of an ' + large.count + '-register one, so the '
      + 'overhead grows with capacity rather than staying flat. Two things move that ratio '
      + 'much further: adding a read port roughly doubles the right-hand bar without touching '
      + 'the left, and building the cells from SRAM rather than flip-flops cuts the left-hand '
      + 'bar by about two thirds.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
