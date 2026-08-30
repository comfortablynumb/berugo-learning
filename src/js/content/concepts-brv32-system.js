/** Concepts for the memory interface, I/O, exceptions and privilege (M34.7-M34.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ConceptRegistry : require('./registries.js').ConceptRegistry;

  registry.register({
    'memory-interface-and-io': [
      {
        term: 'Memory-mapped means the device is an address, and nothing else marks it out',
        diagram: {
          definition: [
            'flowchart TB',
            '    L["one load or store instruction"] --> D{"top bits of the address"}',
            '    D -->|"0x00000000"| ROM["program image<br/>ordinary bytes"]',
            '    D -->|"0x10000000"| RAM["data and stack<br/>ordinary bytes"]',
            '    D -->|"0x20000000"| CON["console<br/>a character appears"]',
            '    D -->|"0x20001000"| TIM["timer<br/>a counter, and an interrupt"]',
            '    D -->|"anything else"| F["access fault"]'
          ].join('\n'),
          caption: 'One instruction, five completely different outcomes, selected by the value '
            + 'in a register. That is the whole idea and the whole hazard.'
        },
        plain: 'The same load and store instructions reach RAM and the console.',
        formal: 'a device is a region of the address space, dispatched on the top bits',
        detail: 'There is no separate I/O instruction and no flag on the access: the address '
          + 'decides. That is what makes a wild pointer write able to reboot a machine rather '
          + 'than merely corrupt data, and it is why the address map is part of the hardware '
          + 'specification rather than a software convention. It also means the whole apparatus '
          + 'of pointers, structs and arrays applies to devices, which is convenient and is '
          + 'exactly why device programming is full of surprises.',
        example: 'Writing a byte to 0x20000000 makes a character appear; writing the same byte '
          + 'to 0x10000000 stores it. Same instruction, same syntax.'
      },
      {
        term: 'A device register is not memory, and none of the differences are visible',
        plain: 'Reading can have a side effect; writing performs an action; order is the protocol.',
        formal: 'a device access is not idempotent, not cacheable and not reorderable',
        detail: 'Reading the timer twice gives two different values. Writing the console once '
          + 'prints one character and writing it twice prints two. The order of two writes is '
          + 'the protocol — data first, then command — so a compiler that reorders them issues '
          + 'a command with stale data. None of this is expressible in the source, which is why '
          + 'C has `volatile` and why `volatile` is about observability rather than about '
          + 'threads: it stops the compiler eliding and reordering accesses, and says nothing '
          + 'about what other processors see.',
        example: 'A polling loop that reads a status register through a cached variable never '
          + 'sees the device change, and the loop never ends.'
      },
      {
        term: 'Alignment is a requirement, and the fault is the feature',
        plain: 'An access must be a multiple of its width, or it traps.',
        formal: 'a w-byte access requires address mod w = 0; otherwise cause 4 or 6',
        readAs: 'an access of w bytes needs an address that divides exactly by w, and if it '
          + 'does not, the machine raises cause 4 for a load or 6 for a store.',
        detail: 'An aligned access never straddles two words, so the memory interface stays one '
          + 'access wide and the hardware stays simple. Requiring it means a misaligned access '
          + 'faults loudly with the offending address in a register, which is enormously better '
          + 'than the alternative of quietly reading the wrong bytes. The whole matrix is one '
          + 'modulo test applied uniformly — there are no special cases, which is why it is '
          + 'cheap enough to do on every access in the machine.',
        example: 'From 0x10000001: a byte load works, a half word and a word both fault. From '
          + '0x10000002: byte and half word work, the word faults.'
      },
      {
        term: 'Endianness decides which byte lives at the lowest address',
        plain: 'Little-endian: the low bits are in the first byte.',
        formal: 'byte at address a contributes bits 7:0; the byte at a+1 contributes 15:8',
        detail: 'The choice is invisible until a program writes a word and reads a byte, and '
          + 'then it decides the answer — so it has to be part of the architecture rather than '
          + 'left to the implementation. Little-endian makes a narrowing conversion free, '
          + 'because the low bytes are already at the start; big-endian makes a hex dump read in '
          + 'the order you would write the number. Both are defensible, the choice is arbitrary, '
          + 'and the only real cost is that data crossing between machines needs a stated byte '
          + 'order — which is why every network protocol specifies one.',
        example: 'Storing 0x12345678 and loading its first byte gives 0x78; the byte at the '
          + 'highest address is 0x12.'
      },
      {
        term: 'Sign extension is in the opcode, because the hardware cannot infer it',
        plain: 'lb and lbu read the same byte and produce different numbers.',
        formal: 'funct3 encodes width and signedness together, in three bits',
        detail: 'A byte loaded into a 32-bit register has to become 32 bits somehow, and whether '
          + 'the upper 24 are copies of the sign bit or zeros depends entirely on what the byte '
          + 'meant — which the hardware has no way to know. So there are two instructions per '
          + 'sub-word width, and the compiler picks from the declared type. This is the hardware '
          + 'root of a whole family of C bugs about char signedness, and the reason a language '
          + 'that does not commit to one gets different answers on different platforms.',
        example: 'The byte 0x80 loads as -128 through lb and 128 through lbu; the half word '
          + '0xbe80 loads as -16 768 or 48 768.'
      },
      {
        term: 'A fault is architectural state, not an exception object',
        plain: 'The interface returns the cause and the address instead of throwing.',
        formal: 'a failed access yields { cause, value } and no data',
        detail: 'The trap handler in the next section reads the cause and the offending address '
          + 'out of control registers, so both have to survive the failure. Modelling a fault as '
          + 'a thrown exception loses exactly the information the mechanism exists to carry, and '
          + 'it hides the fact that the processor keeps running — a fault is not a crash, it is '
          + 'a redirection. The distinction matters as soon as page faults arrive in M43, where '
          + 'the handler fixes the problem and re-runs the access.',
        example: 'A load from 0x30000000 returns cause 5 with value 0x30000000; the handler can '
          + 'report exactly which pointer was wrong.'
      },
      {
        term: 'Polling and interrupts trade waste against latency',
        plain: 'Read the status register in a loop, or let the device raise a signal.',
        formal: 'polling costs instructions while idle; an interrupt costs a trap when it fires',
        detail: 'A polling loop is simple, has predictable latency and burns the processor doing '
          + 'nothing. An interrupt costs nothing while idle and costs a trap, a handler and a '
          + 'return when it fires — which is expensive if the device is fast and frequent. Real '
          + 'systems use both and switch between them under load, which is why high-rate network '
          + 'drivers disable interrupts and poll once traffic is heavy enough that the interrupt '
          + 'rate would dominate.',
        example: 'The timer here can be read in a loop or armed to raise an interrupt; the next '
          + 'section takes the interrupt.'
      },
      {
        term: 'An address map should be small enough to hold in your head',
        plain: 'Four regions here: program, data, console, timer.',
        formal: 'every address outside a mapped region faults rather than aliasing',
        detail: 'Real address maps are enormous, and every one of them is a table exactly like '
          + 'this one — which is what a device tree is, and what a memory map in a datasheet is. '
          + 'The property worth keeping is that unmapped means fault rather than wrap or alias: '
          + 'a wild pointer that hits nothing produces a diagnosable trap, whereas one that '
          + 'silently aliases another device is a bug that reproduces once a month.',
        example: 'The map is 32 KiB of program space, 4 KiB of RAM, and two devices of 16 bytes '
          + 'each; everything else faults.'
      }
    ],

    'exceptions-and-privilege': [
      {
        term: 'A trap is four register writes and a jump',
        diagram: {
          definition: [
            'flowchart TB',
            '    T["an instruction traps"] --> A["mepc = the address of THIS instruction"]',
            '    A --> B["mcause = why<br/>sign bit set for an interrupt"]',
            '    B --> C["mtval = the offending address or word"]',
            '    C --> D["mode = machine"]',
            '    D --> E["pc = mtvec"]',
            '    E --> H["the handler runs"]',
            '    H --> M["mret: pc = mepc, mode restored"]'
          ].join('\n'),
          caption: 'The whole mechanism. Everything the operating-system track builds is policy '
            + 'written on top of these five lines.'
        },
        plain: 'Save where, save why, raise privilege, jump to a fixed address.',
        formal: 'mepc, mcause, mtval, mstatus, then pc = mtvec',
        detail: 'The program does not choose any of it. A call goes where the caller says; a '
          + 'trap goes where mtvec says, at a privilege the hardware raises, with the return '
          + 'address in a register the unprivileged program cannot write. That asymmetry is the '
          + 'entire security argument for the user/kernel boundary, and mret undoes exactly the '
          + 'four writes rather than anything more elaborate.',
        example: 'ecall at address 4 leaves mepc = 4, mcause = 11, and execution at 0x100 in '
          + 'machine mode.'
      },
      {
        term: 'Synchronous exceptions are caused by an instruction; interrupts are not',
        plain: 'The sign bit of mcause says which kind you are looking at.',
        formal: 'mcause bit 31 set means asynchronous',
        detail: 'An illegal instruction, a misaligned access and an ecall are all consequences '
          + 'of the instruction at mepc, and re-running that instruction would raise them again. '
          + 'A timer interrupt has nothing to do with the instruction it happened to land '
          + 'between — it would have arrived whatever was executing. Because the handler has to '
          + 'treat them differently, the distinction is encoded in the cause register rather '
          + 'than left to be inferred.',
        example: 'Five of the six classes the demo raises are synchronous with mtval naming the '
          + 'offending value; the timer is the one with cause bit 31 set.'
      },
      {
        term: 'The two kinds need opposite return addresses, and getting it wrong is silent',
        plain: 'Resume after an exception; resume at the interrupted instruction.',
        formal: 'an exception handler advances mepc by 4; an interrupt handler must not',
        detail: 'An exception has already happened, so returning to the same instruction repeats '
          + 'it forever unless the handler fixed the cause. An interrupt arrived between '
          + 'instructions, so advancing mepc skips an instruction that never ran. Neither '
          + 'mistake produces an error message: the first is an infinite loop and the second is '
          + 'a program that quietly computes the wrong answer, one instruction at a time, at a '
          + 'rate set by the interrupt frequency.',
        example: 'The same timer interrupt: the cause-aware handler takes 1 trap and the program '
          + 'ends with a3 = 4; the unconditional one takes 5 and a3 is still 0.'
      },
      {
        term: 'mepc holds the offending instruction, not the one after it',
        plain: 'The handler adds four itself, when it should.',
        formal: 'the hardware saves the address of the instruction that trapped',
        detail: 'A page-fault handler has to restart the access it could not complete, which it '
          + 'cannot do if the address was lost — so the hardware saves the offending address and '
          + 'leaves the adjustment to software. That makes an ecall handler responsible for '
          + 'adding four, and an off-by-four in either direction is the classic way to make a '
          + 'handler loop forever on the same instruction or skip a live one.',
        example: 'The demo\'s CSR table reads four higher than the metric above it, because the '
          + 'handler has already advanced mepc itself.'
      },
      {
        term: 'Precise means everything before is done and nothing after has happened',
        plain: 'The state must look as if execution stopped cleanly at mepc.',
        formal: 'instructions before mepc have completed; those after have had no effect',
        detail: 'Without that guarantee a handler cannot know what to restart, what to report or '
          + 'what to save, and a debugger cannot show a coherent state. On this single-cycle '
          + 'machine it is free, because only one instruction exists at a time — which is '
          + 'exactly why it is worth naming here. The moment M35 pipelines this datapath five '
          + 'instructions are in flight, and keeping the promise costs a reorder buffer and a '
          + 'commit point.',
        example: 'M36 makes this the central problem: speculation means instructions execute '
          + 'that must be undone, and precision is what says when they can be committed.'
      },
      {
        term: 'A device that cannot be acknowledged raises the same interrupt forever',
        plain: 'The handler must touch the device before returning.',
        formal: 'the timer here is cleared by writing its compare register',
        detail: 'The interrupt condition is a level, not an event: while it holds, the machine '
          + 'takes the trap again the instant the handler returns. That is a livelock rather '
          + 'than a crash — the program makes no progress and nothing anywhere reports an error '
          + '— and it is why every interrupt handler ever written ends by talking to the device. '
          + 'The same shape appears in every edge-triggered versus level-triggered event API, '
          + 'including epoll.',
        example: 'The unconditional handler in the demo never re-arms the timer, so it is '
          + 'entered five times in thirty instructions.'
      },
      {
        term: 'Privilege is a two-bit register plus the checks made against it',
        plain: 'A trap raises the mode; mret restores it.',
        formal: 'the mode decides which instructions and which CSRs are reachable',
        detail: 'There is genuinely nothing more to it at this level. The mode register decides '
          + 'whether mtvec can be written, whether mret is legal, and — once M43 adds address '
          + 'translation — which pages are reachable. Everything about kernels, system calls, '
          + 'containers and hypervisors is built from this two-bit register and the hardware '
          + 'checks around it, which is worth knowing because it sets a floor on how much any '
          + 'of those can protect.',
        example: 'A user-mode program cannot write mtvec, so it cannot redirect where its own '
          + 'traps go — which is the whole reason the boundary holds.'
      },
      {
        term: 'A system call is a deliberate exception, and that is the trick',
        plain: 'ecall traps rather than jumping.',
        formal: 'cause 11, and the destination is mtvec rather than anything the program chose',
        detail: 'The program cannot call the kernel, because calling means choosing a '
          + 'destination and the whole point is that it may not. So it traps on purpose: the '
          + 'hardware raises privilege and sends control to the one address the kernel '
          + 'installed, and the kernel reads a register to find out what was wanted. That is why '
          + 'a system call costs a trap rather than a jump, and why the cost has shaped every '
          + 'high-performance I/O interface from batching to io_uring.',
        example: 'Every program in this milestone ends in ecall, which traps with cause 11 and '
          + 'is the reason the simulator can tell "finished" from "ran off the end".'
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
