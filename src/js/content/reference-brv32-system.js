/** Reference entries for the memory interface, I/O, exceptions and privilege (M34.7-M34.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'memory-interface-and-io': {
      summary: 'The real address decoder driven over every width, every alignment and every '
        + 'region: eighteen accesses, eight of which fault in two distinct classes, with the '
        + 'cause and the offending address returned as state rather than thrown. Plus sign '
        + 'against zero extension over four byte patterns, and the address map the whole thing '
        + 'dispatches on.',
      intuition: 'A device is an address, which is the entire idea and the entire hazard.',
      formulation: {
        equations: [
          {
            label: 'The address map',
            expr: 'region . base . size . kind',
            terms: [
              { sym: 'rom', meaning: '0x00000000 . 32 768 bytes . ordinary memory' },
              { sym: 'ram', meaning: '0x10000000 . 4 096 bytes . ordinary memory' },
              { sym: 'console', meaning: '0x20000000 . 16 bytes . a device: a write prints' },
              { sym: 'timer', meaning: '0x20001000 . 16 bytes . a device: a counter and a compare' },
              { sym: 'everything else', meaning: 'access fault, cause 5 on a load and 7 on a store' }
            ]
          },
          {
            label: 'Alignment: one modulo test, applied to every access',
            expr: 'a w-byte access needs address mod w = 0',
            terms: [
              { sym: '0x10000000', meaning: 'byte, half word and word all succeed' },
              { sym: '0x10000001', meaning: 'byte only; the other two are cause 4' },
              { sym: '0x10000002', meaning: 'byte and half word; the word is cause 4' },
              { sym: 'the matrix', meaning: '8 of 18 accesses fault — 5 misaligned, 3 unmapped' }
            ]
          },
          {
            label: 'The word 0xfeedbe80 at 0x10000000, read six ways',
            expr: 'width . signed . unsigned',
            terms: [
              { sym: 'byte', meaning: '-128 . 128 — the low byte is 0x80' },
              { sym: 'half word', meaning: '-16 768 . 48 768 — 0xbe80' },
              { sym: 'word', meaning: '-17 973 632 either way — the value fills the register' },
              { sym: 'byte at 0x10000003', meaning: '-2 . 254 — 0xfe, the highest byte' }
            ]
          },
          {
            label: 'What makes a device register not memory',
            expr: 'property . memory . device',
            terms: [
              { sym: 'reading twice', meaning: 'the same value . the timer counter has moved' },
              { sym: 'writing', meaning: 'stores a value . a character appears' },
              { sym: 'ordering', meaning: 'reorderable . the order is the protocol' },
              { sym: 'the consequence', meaning: 'the compiler must not cache, merge, hoist or reorder' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'Every combination is driven, not described',
          why: 'A table of what should happen is not a measurement of what does.',
          breaks: '18 accesses through the real decoder on every render.'
        },
        {
          name: 'A fault returns a cause and an address; it never returns data',
          why: 'The trap handler reads both out of CSRs, so both must survive.',
          breaks: 'cause 4 with mtval 0x10000001; cause 5 with mtval 0x30000000.'
        },
        {
          name: 'Region is decided before alignment',
          why: 'An unmapped address never reaches the alignment question.',
          breaks: 'All three widths at 0x30000000 report cause 5, not cause 4.'
        },
        {
          name: 'Signedness comes from the opcode, never from the bytes',
          why: 'The hardware cannot know what a byte meant.',
          breaks: 'The same 0x80 is -128 or 128 depending only on which instruction was used.'
        }
      ],
      complexity: [
        { operation: 'address decode', average: 'one comparison per region — four here', worst: 'a real map is a range tree, and it is on the critical path' },
        { operation: 'alignment check', average: 'one modulo, or a mask on a power of two', worst: 'unchanged — which is why it is affordable per access' },
        { operation: 'sign extension', average: 'a fan-out of one bit to 24', worst: 'free in hardware; it is wiring, not logic' },
        { operation: 'device write', average: 'a side effect, once', worst: 'twice if the compiler duplicates it, never if it elides it' },
        { operation: 'polling a device', average: 'one load per loop iteration', worst: 'unbounded — it burns the processor while nothing happens' }
      ],
      failureModes: [
        {
          symptom: 'A polling loop never notices the device change.',
          cause: 'The compiler cached the load, because a device register looks like memory.',
          fix: 'volatile, or an explicit barrier. The demo shows why the compiler cannot tell.'
        },
        {
          symptom: 'A device command is issued with the previous command\'s data.',
          cause: 'Two writes were reordered; the order was the protocol.',
          fix: 'A fence between them. Ordering is not implied by program order at this level.'
        },
        {
          symptom: 'A structure read from a file or socket has fields full of nonsense.',
          cause: 'It was written on a machine with the other byte order.',
          fix: 'State the byte order in the format; this is why network protocols specify one.'
        },
        {
          symptom: 'A comparison against 0x80 behaves differently on ARM and x86.',
          cause: 'char signedness — the compiler emitted lb on one and lbu on the other.',
          fix: 'Say signed or unsigned explicitly; the language leaves it to the platform.'
        },
        {
          symptom: 'A wild pointer write reboots the machine instead of crashing the process.',
          cause: 'The address landed in a device region, and a device write is an action.',
          fix: 'Nothing at this level — it is why an MMU exists, which is M43.'
        }
      ],
      inTheWild: [
        'Device trees and ACPI tables, which are this address map at industrial scale.',
        '/dev/mem and mmap of a device file: the same idea exposed to user space.',
        'volatile in C, and the long history of drivers that broke on a compiler upgrade.',
        'Network byte order, which exists because endianness is not a portable assumption.'
      ],
      sources: [
        { title: 'Patterson and Hennessy — Computer Organization and Design, RISC-V Edition', note: 'the memory interface and the load/store instructions' },
        { title: 'The RISC-V Instruction Set Manual, Volume II: Privileged Architecture', note: 'the fault causes and what each carries in mtval' },
        { title: 'Corbet, Rubini and Kroah-Hartman — Linux Device Drivers, chapter 9', note: 'memory-mapped I/O in practice, including the ordering rules' },
        { title: 'Cohen — On Holy Wars and a Plea for Peace (1980)', note: 'the endianness argument, named' }
      ]
    },

    'exceptions-and-privilege': {
      summary: 'Every trap class raised by a program that actually runs, with the control '
        + 'registers the hardware wrote and a handler that reads them and returns; plus two '
        + 'handlers on the same timer interrupt, where the one that is correct for all five '
        + 'exception classes silently eats an instruction per interrupt.',
      intuition: 'A trap is four register writes and a jump the program did not choose.',
      formulation: {
        equations: [
          {
            label: 'What the hardware does on a trap',
            expr: 'mepc = pc . mcause = why . mtval = the value . mode = machine . pc = mtvec',
            terms: [
              { sym: 'mepc', meaning: 'the address of the offending instruction, not the next one' },
              { sym: 'mcause', meaning: 'the reason, with bit 31 set for an interrupt' },
              { sym: 'mtval', meaning: 'the offending address or the instruction word' },
              { sym: 'mret', meaning: 'undoes exactly the privilege change and the jump' }
            ]
          },
          {
            label: 'The classes, raised by real programs',
            expr: 'class . cause . mtval',
            terms: [
              { sym: 'environment call', meaning: '11 . 0 — a deliberate exception' },
              { sym: 'illegal instruction', meaning: '2 . 0xffffffff — the offending word' },
              { sym: 'load address misaligned', meaning: '4 . 0x10000001' },
              { sym: 'store address misaligned', meaning: '6 . 0x10000002' },
              { sym: 'load access fault', meaning: '5 . 0x40000000' },
              { sym: 'timer interrupt', meaning: 'bit 31 set, cause 7 . 0 — asynchronous' }
            ]
          },
          {
            label: 'Two handlers, one timer interrupt',
            expr: 'handler . traps taken . a3 at the end',
            terms: [
              { sym: 'cause-aware: branch on the sign bit', meaning: '1 . 4 — correct' },
              { sym: 'always advance mepc by 4', meaning: '5 . 0 — one instruction lost per interrupt' },
              { sym: 'why 5 rather than 1', meaning: 'the timer was never re-armed, so the condition still held' },
              { sym: 'errors reported', meaning: '0, by either run' }
            ]
          },
          {
            label: 'The control registers',
            expr: 'name . number . what it holds',
            terms: [
              { sym: 'mstatus', meaning: '0x300 . the saved privilege and the enable bits' },
              { sym: 'mtvec', meaning: '0x305 . where every trap goes; user mode cannot write it' },
              { sym: 'mepc', meaning: '0x341 . the offending address' },
              { sym: 'mcause', meaning: '0x342 . why' },
              { sym: 'mtval', meaning: '0x343 . the offending value' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The program never chooses where a trap goes',
          why: 'That asymmetry is the whole security argument for the boundary.',
          breaks: 'mtvec is a machine-mode register; user mode cannot write it.'
        },
        {
          name: 'mepc holds the offending instruction, not the following one',
          why: 'A page-fault handler has to restart the access it could not complete.',
          breaks: 'An ecall handler adds 4 itself, and an interrupt handler must not.'
        },
        {
          name: 'Every trap class is raised by a program that runs, not asserted',
          why: 'A table of causes proves nothing about the machine that produced them.',
          breaks: 'Six classes, six runs, and the CSR values are read out of the machine.'
        },
        {
          name: 'Precision is free here and will not be',
          why: 'Only one instruction exists at a time on a single-cycle machine.',
          breaks: 'M35 puts five in flight and M36 speculates past them; both must keep the promise.'
        }
      ],
      complexity: [
        { operation: 'trap entry', average: '4 register writes and a jump', worst: 'the same; there is no search and no allocation' },
        { operation: 'trap return', average: 'one instruction — mret', worst: 'the same' },
        { operation: 'handler dispatch', average: 'one branch on the sign bit of mcause', worst: 'a table indexed by cause, in a real kernel' },
        { operation: 'acknowledging a device', average: 'one store', worst: 'omit it and the handler is re-entered forever' },
        { operation: 'precise exceptions', average: 'free on a single-cycle machine', worst: 'a reorder buffer and a commit point, once pipelined' }
      ],
      failureModes: [
        {
          symptom: 'A handler runs forever on the same instruction.',
          cause: 'It returned to mepc without fixing the cause or advancing past it.',
          fix: 'Advance mepc for a synchronous fault the handler cannot repair. Not for an interrupt.'
        },
        {
          symptom: 'A program computes a wrong answer under load and a right one when idle.',
          cause: 'The interrupt handler advances mepc, so an instruction is skipped per interrupt.',
          fix: 'Branch on the sign bit of mcause. The demo shows both handlers side by side.'
        },
        {
          symptom: 'The machine makes no progress and reports nothing.',
          cause: 'The interrupt condition still holds because the device was never acknowledged.',
          fix: 'Touch the device before mret; the timer here is cleared by writing its compare.'
        },
        {
          symptom: 'A trap handler cannot tell which pointer was wrong.',
          cause: 'The offending address was lost between the fault and the handler.',
          fix: 'mtval carries it; a fault modelled as a thrown exception usually does not.'
        },
        {
          symptom: 'A debugger shows a state that could not have existed.',
          cause: 'The exception was imprecise — work after the trapping instruction had effects.',
          fix: 'Commit in order. This is what a reorder buffer buys, and M36 pays for it.'
        }
      ],
      inTheWild: [
        'Every system call on every operating system: a deliberate exception, by design.',
        'Preemptive scheduling, which is a timer interrupt the program cannot mask.',
        'Page faults, where the handler fixes the cause and re-runs the instruction at mepc.',
        'Microcode and firmware trap handlers, and the errata that live in them.'
      ],
      sources: [
        { title: 'The RISC-V Instruction Set Manual, Volume II: Privileged Architecture', note: 'the CSRs, the causes and the exact trap semantics' },
        { title: 'Patterson and Hennessy — Computer Organization and Design, RISC-V Edition', note: 'exceptions in the single-cycle and pipelined datapaths' },
        { title: 'Smith and Pleszkun — Implementing precise interrupts in pipelined processors (1988)', note: 'why precision is hard the moment instructions overlap' },
        { title: 'Arpaci-Dusseau — Operating Systems: Three Easy Pieces, chapters 6 and 15', note: 'the same mechanism, seen from the kernel side' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
