/**
 * DatapathView - the datapath schematic, with this instruction's path lit up.
 *
 * The diagram is generated from the control signals the machine is actually
 * running, so it cannot drift from the CPU: a multiplexer's label says which
 * input it is selecting right now, and the blocks that are idle this cycle are
 * drawn as idle. That last part is the point of the picture. In a single-cycle
 * machine every instruction pays for the slowest path, and seeing the data
 * memory sit unused during an `add` is what makes the waste concrete rather
 * than theoretical.
 *
 * It lives in a module rather than in a section because a definition built at
 * run time is not covered by the guard that parses every section's static
 * diagram, and as a module it can be handed to the real parser in a test.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.DatapathView = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function hex(value) {
    return '0x' + ((value || 0) >>> 0).toString(16).padStart(8, '0');
  }

  function node(id, label, active) {
    return '  ' + id + (active ? '{{"' : '["') + label + (active ? '"}}' : '"]');
  }

  /** Every element of the datapath, with whether this instruction uses it. */
  function elements(view) {
    const signals = view.signals || {};

    return [
      { id: 'PC', label: 'program counter<br/>' + hex(view.pc), active: true },
      { id: 'IMEM', label: 'instruction memory<br/>' + hex(view.word), active: true },
      { id: 'REGS', label: 'register file<br/>x' + view.rs1 + ', x' + view.rs2 +
        ' out · x' + view.rd + ' in', active: true },
      { id: 'IMM', label: 'immediate generator<br/>' + (view.imm === undefined ? '—'
        : view.imm), active: view.usesImmediate },
      { id: 'ALU', label: 'ALU<br/>' + hex(view.alu), active: true },
      { id: 'DMEM', label: 'data memory<br/>' + memoryLabel(view),
        active: Boolean(signals.memRead || signals.memWrite) },
      { id: 'WB', label: 'write back<br/>' + writeBackLabel(view),
        active: Boolean(signals.regWrite) },
      { id: 'NEXT', label: 'next PC<br/>' + hex(view.next), active: true }
    ];
  }

  function memoryLabel(view) {
    const signals = view.signals || {};

    if (signals.memRead) return 'read ' + hex(view.address);
    if (signals.memWrite) return 'write ' + hex(view.address);
    return 'idle this cycle';
  }

  const WRITE_BACK = ['ALU result', 'memory', 'PC + 4', 'immediate'];

  function writeBackLabel(view) {
    const signals = view.signals || {};

    if (!signals.regWrite) return 'no register written';
    return WRITE_BACK[signals.writeBack || 0] + ' → x' + view.rd;
  }

  /** The wires, labelled with what the multiplexers chose. A dotted edge is a
   *  path that exists in the hardware and is not carrying this instruction. */
  function edges(view) {
    const signals = view.signals || {};
    const aluSource = signals.aluSrc ? 'immediate' : 'rs2';
    const pcSource = view.taken ? 'branch or jump target' : 'PC + 4';

    return [
      '  PC --> IMEM',
      '  IMEM --> REGS',
      '  IMEM --> IMM',
      '  REGS -->|"rs1"| ALU',
      arrow('IMM', 'ALU', 'immediate', signals.aluSrc),
      arrow('REGS', 'ALU', 'rs2', !signals.aluSrc),
      '  ALU -->|"' + aluSource + ' selected"| DMEM',
      arrow('DMEM', 'WB', 'loaded value', signals.memRead),
      arrow('ALU', 'WB', 'result', !signals.memRead && signals.regWrite),
      '  WB --> REGS',
      '  ALU --> NEXT',
      '  NEXT -->|"' + pcSource + '"| PC'
    ];
  }

  function arrow(from, to, label, active) {
    return '  ' + from + (active ? ' -->|"' : ' -.->|"') + label + '"| ' + to;
  }

  function definition(view) {
    const lines = ['flowchart LR'];

    elements(view).forEach(function (element) {
      lines.push(node(element.id, element.label, element.active));
    });
    return lines.concat(edges(view)).join('\n');
  }

  /** A per-instruction-class summary of what was idle, which is the number the
   *  single-cycle section is really about. */
  function idleBlocks(view) {
    return elements(view).filter(function (element) { return !element.active; })
      .map(function (element) { return element.id; });
  }

  return { definition: definition, elements: elements, edges: edges,
    idleBlocks: idleBlocks, hex: hex, WRITE_BACK: WRITE_BACK };
}));
