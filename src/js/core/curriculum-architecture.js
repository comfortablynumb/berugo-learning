/**
 * The computer architecture track: digital logic through the modern core.
 *
 * Track data only - no API. It lives in its own file because the syllabus
 * passed a thousand lines again at M36, and because this is the track that
 * grows fastest: every milestone from M33 onwards adds nine or ten sections
 * with a paragraph each. Splitting per track rather than per milestone keeps
 * the seam in a place that does not move.
 *
 * `core/curriculum.js` assembles this with the other track files into the one
 * ordered syllabus every view renders from, and it remains the single source of
 * truth for the ORDER.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CurriculumArchitecture = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  return [
    {
      id: 'architecture',
      title: 'Computer architecture',
      summary: 'From a gate to an out-of-order core, and the memory hierarchy underneath it.',
      groups: [
        {
          id: 'M33',
          title: 'Digital logic and sequential circuits',
          summary: 'From two transistors to a register file, every circuit simulated gate by gate with real propagation delays — and every block checked over its whole input space against a behavioural model that shares none of its code.',
          sections: [
            {
              id: 'boolean-algebra-and-gates',
              title: 'Boolean algebra and gates',
              summary: 'One truth table derived by running the circuit, the canonical forms generated from that table, and the price of functional completeness measured in transistors and gate delays.',
              tags: ['truth table', 'boolean function', 'nand', 'functional completeness', 'de morgan', 'canonical form', 'sum of products', 'cmos', 'propagation delay', 'fan-in']
            },
            {
              id: 'logic-minimisation',
              title: 'Combinational logic design and minimisation',
              summary: 'Prime implicants, the covering problem, and the hazard minimisation leaves behind',
              tags: ['karnaugh', 'quine-mccluskey', 'set cover', 'static hazard']
            },
            {
              id: 'combinational-blocks',
              title: 'The combinational building blocks',
              summary: 'Multiplexers, decoders, priority encoders, comparators and barrel shifters, each checked against its specification',
              tags: ['multiplexer', 'decoder', 'barrel shifter', 'exhaustive verification']
            },
            {
              id: 'arithmetic-circuits',
              title: 'Arithmetic circuits',
              summary: 'Ripple, lookahead and select adders, the multiplier array, and why the latency table looks the way it does',
              tags: ['adder', 'carry lookahead', 'multiplier', 'twos complement']
            },
            {
              id: 'arithmetic-logic-unit',
              title: 'The arithmetic logic unit',
              summary: 'One adder, four operations and the four flags every conditional branch reads',
              tags: ['alu', 'condition codes', 'overflow', 'signed and unsigned']
            },
            {
              id: 'sequential-logic-and-state',
              title: 'Sequential logic: latches, flip-flops and registers',
              summary: 'Feedback, the first circuit with a memory, and the setup and hold constraints it imposes',
              tags: ['latch', 'flip-flop', 'setup and hold', 'metastability']
            },
            {
              id: 'hardware-state-machines',
              title: 'State machines in hardware',
              summary: 'Transition tables become flip-flops and gates, and the state encoding is a free choice with real costs',
              tags: ['fsm', 'state encoding', 'one-hot', 'moore and mealy']
            },
            {
              id: 'memory-arrays',
              title: 'Memory arrays and register files',
              summary: 'Storage is the cheap half: decoders, read ports and the read-during-write question',
              tags: ['register file', 'sram', 'dram', 'read during write']
            },
            {
              id: 'timing-clocking-and-power',
              title: 'Timing, clocking and power',
              summary: 'Static timing analysis on the circuits just built, and the power bill their switching produces',
              tags: ['static timing', 'slack', 'pipelining', 'dynamic power']
            },
            {
              id: 'hardware-description-and-verification',
              title: 'Describing hardware, and proving it right',
              summary: 'Modules, elaboration, exhaustive equivalence checking, and what coverage does not tell you',
              tags: ['hdl', 'elaboration', 'equivalence checking', 'coverage']
            }]
        },
        {
          id: 'M34',
          title: 'ISA, assembly, datapath and control',
          summary: 'A complete RV32I-compatible processor: the instruction set as data, an assembler and linker, and a single-cycle datapath built from M33 gates and checked against a behavioural simulator instruction by instruction.',
          sections: [
            {
              id: 'instruction-set-design',
              title: 'Instruction set design',
              summary: 'Three machine models computing the same expression, and the arithmetic of what fits in an instruction',
              tags: ['isa', 'encoding', 'risc and cisc', 'code density']
            },
            {
              id: 'brv32-instruction-set',
              title: 'The BRV32 instruction set',
              summary: 'Six formats, the scrambled immediates and the hardware reason for them, checked against published encodings',
              tags: ['riscv', 'encoding', 'instruction format', 'immediate']
            },
            {
              id: 'assembly-programming',
              title: 'Assembly programming',
              summary: 'Four real programs, single-stepped, with the stack frames of a recursion visible as they stack up',
              tags: ['assembly', 'calling convention', 'stack frame', 'recursion']
            },
            {
              id: 'single-cycle-datapath',
              title: 'The single-cycle datapath',
              summary: 'A processor of 5945 gates built from M33 blocks, stepped instruction by instruction against a behavioural reference',
              tags: ['datapath', 'single cycle', 'gate level', 'differential testing']
            },
            {
              id: 'the-control-unit',
              title: 'The control unit',
              summary: 'Opcode to control vector, as a table and as 103 gates, with each signal forced in turn to see what breaks',
              tags: ['control signals', 'hardwired control', 'microcode', 'decoder']
            },
            {
              id: 'multi-cycle-execution',
              title: 'Multi-cycle execution',
              summary: 'The performance equation applied to two real machines, where the shorter clock loses and the break-even is named',
              tags: ['cpi', 'performance equation', 'control fsm', 'clock period']
            },
            {
              id: 'memory-interface-and-io',
              title: 'Memory interface and I/O',
              summary: 'Widths, alignment, sign extension and memory-mapped devices, with every combination driven and the faults asserted',
              tags: ['alignment', 'endianness', 'memory-mapped io', 'sign extension']
            },
            {
              id: 'exceptions-and-privilege',
              title: 'Exceptions, interrupts and privilege',
              summary: 'Every trap class raised by a real program, with the CSRs, the handler and the return visible at each step',
              tags: ['traps', 'interrupts', 'csr', 'privilege']
            },
            {
              id: 'assembler-linker-and-loading',
              title: 'Assembler, linker and loading',
              summary: 'Source to object to linked image to running machine, with an out-of-range relocation reported rather than truncated',
              tags: ['two-pass assembly', 'relocation', 'symbol table', 'loader']
            },
            {
              id: 'real-instruction-sets',
              title: 'Real instruction sets compared',
              summary: 'One function in RISC-V, ARM64 and x86-64, counted and explained decision by decision',
              tags: ['risc-v', 'arm64', 'x86-64', 'code density']
            }]
        },
        {
          id: 'M35',
          title: 'Pipelining, hazards and branch prediction',
          summary: 'The M34 processor cut into five stages, with every stall and flush attributed to a cause, a forwarding unit whose classic bug is a control, and predictors measured on fixtures built to separate them.',
          sections: [
            {
              id: 'pipelining-fundamentals',
              title: 'Pipelining fundamentals',
              summary: 'Five stages, one instruction per cycle, and every cycle attributed to retiring, filling, stalling or flushing',
              tags: ['pipeline', 'throughput', 'latency', 'ipc']
            },
            {
              id: 'structural-hazards',
              title: 'Structural hazards',
              summary: 'One memory or two, and the stall count that decides which is worth building',
              tags: ['resource conflict', 'harvard split', 'arbitration', 'queueing']
            },
            {
              id: 'data-hazards-and-forwarding',
              title: 'Data hazards and forwarding',
              summary: 'Five dependency shapes and three forwarding units, one of which carries the classic double-hazard bug',
              tags: ['forwarding', 'load-use', 'raw hazard', 'instruction scheduling']
            },
            {
              id: 'control-hazards',
              title: 'Control hazards',
              summary: 'Move the branch resolution point and watch the flushes halve and the stalls appear',
              tags: ['branch penalty', 'flush', 'early resolution', 'delayed branch']
            },
            {
              id: 'branch-prediction-basics',
              title: 'Branch prediction: the basics',
              summary: 'One-bit against two-bit on patterns built to separate them, with accuracy reported per site',
              tags: ['saturating counter', 'branch history', 'return-address stack', 'btb']
            },
            {
              id: 'advanced-branch-prediction',
              title: 'Advanced branch prediction',
              summary: 'gshare, tournament and TAGE on a correlated fixture, where the overall average hides the difference',
              tags: ['gshare', 'global history', 'tage', 'aliasing']
            },
            {
              id: 'precise-exceptions-pipelined',
              title: 'Precise exceptions in a pipeline',
              summary: 'Five fault classes with five instructions in flight, and the state proved identical to a machine with one',
              tags: ['precise exceptions', 'squash', 'commit point', 'serialising']
            },
            {
              id: 'pipeline-depth-limits',
              title: 'Deeper pipelines and their limits',
              summary: 'The depth curve, its bottom, and the industry experiment that found the same answer',
              tags: ['pipeline depth', 'frequency', 'performance per watt', 'pentium 4']
            },
            {
              id: 'pipeline-friendly-code',
              title: 'Writing pipeline-friendly code',
              summary: 'The sorted-array result reproduced with mispredict counts, and a branchless variant that loses here and wins elsewhere',
              tags: ['branchless', 'mispredicts', 'measurement', 'profiling']
            }]
        },
        {
          id: 'M36',
          title: 'Superscalar, out-of-order execution and speculation',
          summary: 'The M35 pipeline with its ordering broken and rebuilt out of renaming, a reorder buffer and a load/store queue: matched-pair kernels that differ in one structural property, an independent ILP bound the simulator is never allowed to exceed, and a cache-timing channel that recovers a secret and then stops when the mitigation lands.',
          sections: [
            {
              id: 'instruction-level-parallelism',
              title: 'Instruction-level parallelism and its limits',
              summary: 'The dependence graph of a run, its critical path, and the bound no microarchitecture can beat',
              tags: ['dependence graph', 'critical path', 'ilp', 'raw war waw']
            },
            {
              id: 'dynamic-scheduling',
              title: 'Dynamic scheduling: scoreboarding and Tomasulo',
              summary: 'Renaming removes the two dependences that were about names, and the fixture that shows what it is worth',
              tags: ['tomasulo', 'register renaming', 'alias table', 'wakeup and select']
            },
            {
              id: 'reorder-buffer-and-precise-state',
              title: 'The reorder buffer and precise state',
              summary: 'Out-of-order completion, in-order commit, and an exception raised with thirty instructions in flight',
              tags: ['reorder buffer', 'precise exceptions', 'commit', 'speculative state']
            },
            {
              id: 'superscalar-issue',
              title: 'Superscalar issue',
              summary: 'The width curve for ten programs, with the reason each one stopped rising named rather than guessed',
              tags: ['issue width', 'ports', 'wakeup select', 'saturation']
            },
            {
              id: 'speculation-and-recovery',
              title: 'Speculation and recovery',
              summary: 'Checkpoint restore against a drain, the wasted work counted, and memory dependence speculation switched off',
              tags: ['misprediction', 'checkpoint', 'store sets', 'wasted work']
            },
            {
              id: 'memory-level-parallelism',
              title: 'Memory-level parallelism',
              summary: 'The same loads over the same bytes, once as a stride and once as a chase, with the misses counted both ways',
              tags: ['mshr', 'mlp', 'pointer chasing', 'non-blocking cache']
            },
            {
              id: 'simultaneous-multithreading',
              title: 'Simultaneous multithreading',
              summary: 'Two threads on one core with shared ports and one window, and the policy that starves one of them',
              tags: ['smt', 'icount', 'partitioning', 'starvation']
            },
            {
              id: 'microarchitectural-side-channels',
              title: 'Microarchitectural side channels',
              summary: 'A working Flush+Reload receiver that recovers a secret, and two mitigations that fail in different ways',
              tags: ['spectre', 'flush and reload', 'prime and probe', 'mitigation']
            },
            {
              id: 'anatomy-of-a-modern-core',
              title: 'Anatomy of a modern core',
              summary: 'Top-down analysis over the event log: four categories that sum to 100%, and the change each one implies',
              tags: ['top-down', 'front-end bound', 'back-end bound', 'bad speculation']
            }]
        },
        {
          id: 'M37',
          title: 'Caches and the memory hierarchy',
          summary: 'A configurable multi-level cache, a TLB, a DRAM model and a NUMA topology, all measured rather than described: the three Cs sum exactly, the parameter-discovery method recovers the configured sizes from timing alone, and a prefetcher that removes 98% of the misses is reported as the net loss it is.',
          sections: [
            {
              id: 'memory-hierarchy-numbers',
              title: 'The hierarchy and the numbers',
              summary: 'Latency recovered from timing alone: four cycles, eighteen, sixty-three, three hundred',
              tags: ['locality', 'latency', 'processor-memory gap', 'pointer chase']
            },
            {
              id: 'cache-organisation',
              title: 'Cache organisation',
              summary: 'Tag, index and offset, and the stride that turns a 32 KiB cache into 256 bytes',
              tags: ['set associative', 'tag and index', 'line size', 'conflict']
            },
            {
              id: 'cache-policies',
              title: 'Policies: writes and replacement',
              summary: 'Five replacement policies where only the one with no state survives the cyclic pattern, and the write policy that moves 250x the traffic',
              tags: ['write back', 'write allocate', 'pseudo-LRU', 'rrip']
            },
            {
              id: 'cache-performance-analysis',
              title: 'Cache performance analysis',
              summary: 'The three Cs by parallel simulation, summing exactly, and each one naming a different fix',
              tags: ['three cs', 'amat', 'conflict', 'capacity']
            },
            {
              id: 'cache-friendly-software',
              title: 'Optimising software for the cache',
              summary: 'One matrix multiply, four versions, and 13.7x fewer trips to memory',
              tags: ['loop interchange', 'blocking', 'padding', 'tile size']
            },
            {
              id: 'virtual-memory-and-the-tlb',
              title: 'Virtual memory and the TLB',
              summary: 'A reach cliff at exactly 256 KiB, and huge pages taking 106 cycles per access down to 1',
              tags: ['tlb', 'page table walk', 'reach', 'huge pages']
            },
            {
              id: 'prefetching',
              title: 'Prefetching',
              summary: 'Coverage without accuracy, measured: 98% of the misses removed and a net loss',
              tags: ['stride prefetcher', 'coverage', 'accuracy', 'pollution']
            },
            {
              id: 'dram-and-the-memory-controller',
              title: 'DRAM and the memory controller',
              summary: 'Row hits, misses and conflicts on a bank timeline, and the reordering that doubles throughput',
              tags: ['row buffer', 'bank parallelism', 'FR-FCFS', 'interleaving']
            },
            {
              id: 'numa-and-affinity',
              title: 'NUMA and affinity',
              summary: 'The parallel-for that allocates everything on one node, and what it costs',
              tags: ['first touch', 'affinity', 'page migration', 'remote latency']
            },
            {
              id: 'measuring-the-hierarchy',
              title: 'Measuring the hierarchy',
              summary: 'Cache sizes, line size and associativity recovered from timing, and the confounders that break it',
              tags: ['microbenchmark', 'parameter discovery', 'stream', 'roofline']
            }]
        }
      ],
      planned: [
        { id: 'M38', title: 'Cache coherence and memory consistency', sections: 9 },
        { id: 'M39', title: 'Linking, loading and the ABI', sections: 9 },
        { id: 'M40', title: 'GPUs, SIMD and domain-specific accelerators', sections: 9 }
      ]
    }
  ];
}));
