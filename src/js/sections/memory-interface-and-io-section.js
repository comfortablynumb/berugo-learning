/**
 * Section: Memory interface and I/O.
 *
 * "Memory-mapped" means a device is an address, and everything strange about
 * device programming follows from that one sentence. This section drives the
 * real address decoder from `machines/brv32/devices.js`: every width against
 * every alignment against every region, with the faults reported as
 * architectural state rather than thrown, because a trap handler is going to
 * read the cause and the offending address.
 *
 * The sign-extension half is the other place a memory interface goes wrong
 * quietly. The same four bytes read as lb, lbu, lh, lhu and lw give five
 * different numbers, and the opcode is the only thing that decides which.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'memory-interface-and-io';
  const Devices = root.Brv32.Devices;
  const Assembler = root.Brv32.Assembler;
  const Reference = root.Brv32.Reference;
  const Programs = root.Brv32.Programs;
  let panel = null;
  let chart = null;

  const BASE = 0x10000000;
  const ADDRESSES = ['0x10000000', '0x10000001', '0x10000002', '0x10000003',
    '0x20000000', '0x30000000'];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one dispatch on the top bits of every access',
      caption: 'Every load and store is decoded before it reaches anything: aligned or not, '
        + 'mapped or not, RAM or device. Three of those four outcomes are faults, and the '
        + 'fourth splits into two completely different kinds of thing that share an '
        + 'instruction. That shared instruction is the whole idea of memory-mapped I/O and '
        + 'the source of every surprise in it.',
      definition: [
        'flowchart TB',
        '    A["load or store:<br/>address and width"] --> AL{"address a multiple<br/>of the width?"}',
        '    AL -->|"no"| F1["trap: misaligned<br/>cause 4 or 6"]',
        '    AL -->|"yes"| MP{"which region?"}',
        '    MP -->|"unmapped"| F2["trap: access fault<br/>cause 5 or 7"]',
        '    MP -->|"0x00000000 rom<br/>0x10000000 ram"| RAM["read or write bytes"]',
        '    MP -->|"0x20000000 console<br/>0x20001000 timer"| DEV["a side effect:<br/>a character appears,<br/>a counter is set"]',
        '    RAM --> EX["sign or zero extend<br/>by opcode"]',
        '    DEV --> EX'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Memory-mapped means the device is an address, and nothing else distinguishes it.** '
        + 'The same load and store instructions reach RAM and the console; the only difference '
        + 'is which region the top bits select. That is why a wild pointer write can reboot a '
        + 'machine, and why the address map is part of the hardware specification rather than '
        + 'a software convention.',
      '**A device register is not memory, and the differences are all invisible in the '
        + 'source.** Reading it can have a side effect, reading it twice can give different '
        + 'answers, and writing it can do something the compiler cannot see. So the compiler '
        + 'must not cache, reorder, merge or elide these accesses — which is what `volatile` '
        + 'asks for in C and what a fence asks for at the hardware level.',
      '**Alignment is a requirement here, and the fault is the feature.** An access must be a '
        + 'multiple of its width, or it traps with the offending address in a register. The '
        + 'alternative — quietly reading the wrong bytes — is how an out-of-range access '
        + 'becomes a bug found three modules later, so the interface refuses rather than '
        + 'improvises.',
      '**Endianness decides which byte of a word lives at the lowest address.** BRV32 is '
        + 'little-endian, so storing 0x12345678 as a word and loading its first byte gives '
        + '0x78. The moment a program writes a word and reads a byte the choice becomes '
        + 'visible, which is why it is specified rather than left to the implementation.',
      '**Sign extension is encoded in the opcode, because the hardware cannot infer it.** A '
        + 'byte loaded into a 32-bit register has to become 32 bits somehow, and whether the '
        + 'top 24 are copies of the sign bit or zeros depends on what the byte meant. Hence lb '
        + 'and lbu: same address, same bytes, different numbers.',
      '**A fault is architectural state, not an exception object.** The interface returns the '
        + 'cause and the address rather than throwing, because the trap handler in the next '
        + 'section is going to read both out of CSRs. Modelling it any other way loses exactly '
        + 'the information the mechanism exists to carry.',
      '**Polling and interrupts are two ways to notice a device, and they trade latency for '
        + 'waste.** A polling loop reads the status register until something changes, burning '
        + 'the processor; an interrupt lets the device raise a signal and costs a trap. The '
        + 'timer here does both, and M45 turns this into a whole event-loop argument.',
      '**The address map should be small enough to hold in your head.** Four regions here: '
        + 'the program image, the data and stack, the console and the timer. Real maps are '
        + 'enormous, and every one of them is a table exactly like this one, which is what a '
        + 'device tree is for.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — every width against every alignment',
        markup: root.MemoryIoTemplate.render() },
      diagram: diagram(),
      insight: insight()
    };
  }

  function insight() {
    return '**"Memory-mapped" is three words that quietly delete the distinction between '
      + 'storing a value and performing an action, and almost everything difficult about '
      + 'device programming is the recovery of that distinction by hand.** A write to '
      + '0x10000000 puts a number somewhere; a write to 0x20000000 makes a character appear. '
      + 'The instruction is the same, the syntax is the same, and the compiler has no way to '
      + 'tell them apart — so it will happily cache the value, hoist the write out of a loop, '
      + 'merge two writes into one, or reorder them, all of which are correct for memory and '
      + 'catastrophic for a device. That is what `volatile` is for, and it is why `volatile` '
      + 'is not a concurrency primitive: it says "this access is observable", not "this access '
      + 'is ordered against other threads", and confusing the two has produced a long history '
      + 'of drivers that work until the compiler is upgraded. The transferable idea is that '
      + 'when two things with completely different semantics share a syntax, the burden of '
      + 'telling them apart moves to the programmer and stays there forever. It is the same '
      + 'reason an ORM that makes a network round trip look like a field access produces '
      + 'code with a hundred queries in a loop: making the expensive thing look like the '
      + 'cheap thing does not make it cheap, it just removes the reminder.';
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.MemoryIoTemplate.controls,
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

  /** A memory with the chosen pattern stored as a word at the base of RAM.
   *  Everything on the page reads this one state, so the byte table and the
   *  results below it cannot drift apart. */
  const stateWith = root.Helpers.memoise(function (pattern) {
    const memory = Devices.create({});

    Devices.writeWord(memory, BASE, Number(pattern) >>> 0, 4);
    return memory;
  });

  function accessOf(pattern, address, width, signed) {
    return Devices.read(stateWith(pattern), Number(address) >>> 0, width, signed);
  }

  const consoleRun = root.Helpers.memoise(function () {
    const image = Assembler.assemble(Programs.CATALOGUE.console.source, { origin: 0 });
    const machine = Reference.create({ image: image.bytes, entry: 0 });

    Reference.run(machine, { budget: 3000, stopOnTrap: true });
    return machine.memory.console;
  });

  /** Every combination the interface can meet, driven rather than described. */
  const matrix = root.Helpers.memoise(function (pattern) {
    return ADDRESSES.map(function (address) {
      return { address: address, cells: [1, 2, 4].map(function (width) {
        return accessOf(pattern, address, width, true);
      }) };
    });
  });

  function reading() {
    const values = panel.values();
    const width = Number(values['mmi-width']);
    const pattern = values['mmi-pattern'];

    return { pattern: pattern, address: values['mmi-address'], width: width,
      signed: Boolean(values['mmi-signed']),
      out: accessOf(pattern, values['mmi-address'], width, Boolean(values['mmi-signed'])),
      other: accessOf(pattern, values['mmi-address'], width, !values['mmi-signed']),
      matrix: matrix(pattern) };
  }

  /* --------------------------------------------------------------- render */

  function update(app) {
    const view = reading();

    paintMetrics(view);
    paintBytes(view);
    paintMatrix(view);
    paintExtension(view);
    paintMap(view);
    paintMmio(view);
    paintChart(app, view);
  }

  function show(out) {
    return out.fault ? out.fault.name : String(out.value);
  }

  function paintMetrics(view) {
    const region = Devices.regionOf(Number(view.address) >>> 0);
    const faults = view.matrix.reduce(function (sum, row) {
      return sum + row.cells.filter(function (cell) { return cell.fault; }).length;
    }, 0);

    root.MetricGrid.update({
      'mmi-result': { value: show(view.out),
        note: view.width + '-byte ' + (view.signed ? 'signed' : 'unsigned') + ' load' },
      'mmi-region': { value: region ? region.name : 'unmapped',
        note: region ? region.about : 'nothing answers at this address' },
      'mmi-fault': { value: view.out.fault ? 'cause ' + view.out.fault.cause : 'none',
        note: view.out.fault ? view.out.fault.name : 'the access is aligned and mapped' },
      'mmi-extension': { value: show(view.other),
        note: view.signed ? 'the unsigned opcode, same bytes' : 'the signed opcode, same bytes' },
      'mmi-combinations': { value: view.matrix.length * 3,
        note: faults + ' of them fault, and the rest return a value' },
      'mmi-console': { value: JSON.stringify(consoleRun('one')),
        note: 'written one byte at a time to 0x20000000' }
    });
  }

  function paintBytes(view) {
    const base = Number(view.address) >>> 0;
    const memory = stateWith(view.pattern);

    fill('mmi-bytes', [0, 1, 2, 3].map(function (offset) {
      const at = BASE + offset;
      const used = !view.out.fault && at >= base && at < base + view.width;

      return ['0x' + at.toString(16),
        '0x' + Devices.readWord(memory, at, 1).toString(16).padStart(2, '0'),
        used ? 'yes' : 'no',
        used ? 'bits ' + (8 * (at - base) + 7) + ':' + (8 * (at - base)) : '-'];
    }));
    root.Helpers.setText('mmi-bytes-caption', bytesCaption(view));
  }

  function bytesCaption(view) {
    if (view.out.fault) {
      return 'This access faults — ' + view.out.fault.name + ' at 0x' +
        (view.out.fault.value >>> 0).toString(16) + ' — so no byte is read at all. The '
        + 'address and the cause both survive into the trap, which is what the next section '
        + 'reads out of the CSRs.';
    }
    const filled = 32 - 8 * view.width;

    return 'Little-endian: the byte at the lowest address contributes the lowest bits. A '
      + view.width + '-byte load from 0x' + (Number(view.address) >>> 0).toString(16)
      + ' takes ' + view.width + ' of these 4 bytes and ' +
      (filled === 0 ? 'fills the register exactly, so the signed and unsigned opcodes agree'
        : (view.signed ? 'copies the top bit of the last one into the remaining ' + filled +
          ' bits' : 'fills the remaining ' + filled + ' bits with zeros')) +
      ', which is where the ' + view.out.value + ' above comes from.';
  }

  function paintMatrix(view) {
    fill('mmi-matrix', view.matrix.map(function (row) {
      const region = Devices.regionOf(Number(row.address) >>> 0);

      return [row.address + (row.address === view.address ? ' <-' : '')]
        .concat(row.cells.map(show))
        .concat([decidesIt(row, region)]);
    }));
    root.Helpers.setText('mmi-matrix-caption', 'Every width against every alignment, driven '
      + 'rather than described. An address one byte along takes a byte and refuses a half '
      + 'word and a word; an address two bytes along takes both of the first two and refuses '
      + 'the word. Nothing here is a special case — it is one modulo test, applied to every '
      + 'access in the machine.');
  }

  /** Why this row reads the way it does: the region first, because an
   *  unmapped address never gets as far as the alignment question. */
  function decidesIt(row, region) {
    if (!region) return 'no region contains this address';
    const taken = row.cells.filter(function (cell) { return !cell.fault; }).length;

    return 'in ' + region.name + '; ' + taken + ' of 3 widths divide this address';
  }

  const PATTERNS = ['0xfeedbe80', '0x000000ff', '0x12345678', '0x80008000'];

  function paintExtension(view) {
    fill('mmi-extension-table', PATTERNS.reduce(function (out, pattern) {
      [1, 2].forEach(function (width) {
        const signed = accessOf(pattern, '0x10000000', width, true);
        const unsigned = accessOf(pattern, '0x10000000', width, false);

        out.push([pattern, width === 1 ? 'byte' : 'half word', show(signed), show(unsigned),
          signed.value === unsigned.value ? 'the top bit is clear, so they agree'
            : 'the top bit is set, so the signed opcode fills 0xffffff and the other 0x000000']);
      });
      return out;
    }, []));
    root.Helpers.setText('mmi-extension-table-caption', 'Same address, same bytes, different '
      + 'opcode. This is the hardware root of an entire family of C bugs about char '
      + 'signedness: a language that does not commit to one gets different answers on '
      + 'different platforms, and the platform difference is exactly which of these two '
      + 'instructions the compiler emits.');
  }

  function paintMap(view) {
    fill('mmi-map', Devices.MAP.map(function (region) {
      return [region.name, '0x' + region.base.toString(16).padStart(8, '0'),
        region.size + ' bytes', region.kind, region.about];
    }));
    root.Helpers.setText('mmi-map-caption', 'Four regions, and the third column is the one '
      + 'that matters: a device is 16 bytes of address space that behaves nothing like the '
      + 'bytes on either side of it. Everything outside these four ranges faults, which is '
      + 'the only reason a wild pointer is survivable here.');
  }

  function paintMmio(view) {
    fill('mmi-mmio', [
      ['reading twice', 'the same value both times',
        'the timer counter has moved', 'a loop that reads once and caches never sees the device change'],
      ['writing', 'stores a value', 'performs an action — a character appears',
        'the compiler merges or hoists the write, and the action happens once or never'],
      ['ordering', 'the compiler may reorder freely',
        'the order is the protocol: set the data, then the command',
        'a reordered pair issues a command with the previous data'],
      ['width', 'any width the alignment allows',
        'the device decides, and the wrong one may be ignored',
        'a byte write to a word register that silently does nothing'],
      ['an address error', 'a fault, usually',
        'whatever that device does with a write it did not expect',
        'this is why a wild pointer can reboot a machine rather than crash a process']
    ]);
    root.Helpers.setText('mmi-mmio-caption', 'None of these differences is visible in the '
      + 'source, and all of them are visible in the behaviour. That gap is what `volatile` '
      + 'exists to close in C, and it is why `volatile` is about observability rather than '
      + 'about threads — a distinction that has produced a long history of drivers that '
      + 'worked until the compiler was upgraded.');
  }

  function paintChart(app, view) {
    const host = root.jQuery('#mmi-chart')[0];

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250, yLabel: 'value loaded',
      values: [1, 2, 4].reduce(function (out, width) {
        const label = width === 1 ? 'byte' : (width === 2 ? 'half' : 'word');

        out.push({ label: label + ' signed',
          value: accessOf(view.pattern, '0x10000000', width, true).value, series: 0 });
        out.push({ label: label + ' unsigned',
          value: accessOf(view.pattern, '0x10000000', width, false).value, series: 1 });
        return out;
      }, [])
    });
    root.Helpers.setText('mmi-chart-note', 'The same 32 bits at the same address, read six '
      + 'ways. The signed bars go negative wherever the top bit of the loaded field is set, '
      + 'and the unsigned ones never do — and at four bytes there is no choice to make, '
      + 'because the value already fills the register. Nothing in memory changed between any '
      + 'two of these bars.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
