/** Reference entries for the toolchain and the instruction-set comparison (M34.9-M34.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ReferenceRegistry : require('./registries.js').ReferenceRegistry;

  registry.register({
    'assembler-linker-and-loading': {
      summary: 'Source to object to placed layout to relocated image to a running machine, with '
        + 'every stage inspectable and four link jobs of which two fail on purpose: an '
        + 'undefined symbol, and a branch 5 012 bytes from a field that reaches 4 094 — then a '
        + 'veneer that links and runs.',
      intuition: 'An object file is bytes, symbols and holes; linking is filling the holes once '
        + 'placement has made the addresses real.',
      formulation: {
        equations: [
          {
            label: 'The four relocation shapes',
            expr: 'shape . format . range',
            terms: [
              { sym: 'branch', meaning: 'B . -4 096 to 4 094' },
              { sym: 'jump', meaning: 'J . -1 048 576 to 1 048 574' },
              { sym: 'immediate', meaning: 'I . -2 048 to 2 047' },
              { sym: 'upper', meaning: 'U . 0 to 1 048 575, a constant rather than a distance' }
            ]
          },
          {
            label: 'The four link jobs',
            expr: 'scenario . result',
            terms: [
              { sym: 'main.o + target.o', meaning: 'linked: 28 bytes, one relocation patched, a0 = 42' },
              { sym: 'main.o alone', meaning: 'refused: undefined symbol target' },
              { sym: 'with 5 000 bytes between', meaning: 'refused: needs 5012, the field reaches 4094' },
              { sym: 'with a veneer', meaning: 'linked: 5 032 bytes, branch reaches 12, jump reaches 5 004, a0 = 42' }
            ]
          },
          {
            label: 'The two passes, and what each can do',
            expr: 'pass . can . cannot yet',
            terms: [
              { sym: 'first', meaning: 'measure every instruction, address every label . encode anything with a label in it' },
              { sym: 'second', meaning: 'encode against those addresses . resolve a name from another file' },
              { sym: 'relocation record', meaning: 'note the hole: address, shape, symbol . fill it' },
              { sym: 'link', meaning: 'place, combine the symbols, patch . know anything the objects did not record' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The linker patches through the ISA\'s own field tables',
          why: 'A second implementation of the scrambled immediates would eventually disagree.',
          breaks: 'It clears by mask and re-packs with packImmediate, the assembler\'s function.'
        },
        {
          name: 'An out-of-range relocation is reported with the offset it needed',
          why: 'Truncating produces an instruction that decodes and goes somewhere else.',
          breaks: '"needs 5012" says how far over, and therefore whether a veneer will do.'
        },
        {
          name: 'Every failure is collected, not just the first',
          why: 'One build per missing symbol is a slow feedback loop for no reason.',
          breaks: 'Each relocation carries its own verdict in the applied list.'
        },
        {
          name: 'An address exists only after placement',
          why: 'It is why range errors are linker errors and appear when unrelated code grows.',
          breaks: 'The same source links at 12 bytes apart and fails at 5 012.'
        }
      ],
      complexity: [
        { operation: 'first pass', average: 'one walk of the source', worst: 'pseudo-instructions must be sized, not just counted' },
        { operation: 'second pass', average: 'one walk, one encode per instruction', worst: 'unchanged' },
        { operation: 'placement', average: 'one pass over the objects', worst: 'a real linker groups by section first, which is the same shape' },
        { operation: 'relocation', average: 'one patch per hole', worst: 'plus a veneer per unreachable target, which changes the layout again' },
        { operation: 'loading', average: 'a copy and a jump', worst: 'load-time relocation, if the addresses were not available' }
      ],
      failureModes: [
        {
          symptom: 'undefined reference to a name that clearly exists.',
          cause: 'The object defining it was not on the link line, or the name is mangled differently.',
          fix: 'Read the symbol table of each object; the demo prints defines and needs per object.'
        },
        {
          symptom: 'relocation truncated to fit, or a branch to a plausible wrong address.',
          cause: 'The target is beyond the field\'s reach and something did not refuse.',
          fix: 'Refuse and report the offset. The correct answer is a veneer or a reorganisation.'
        },
        {
          symptom: 'A link that starts failing after an unrelated file grows.',
          cause: 'Placement moved two objects further apart than a branch can reach.',
          fix: 'Nothing in the changed file will help; the fix is layout, or veneers.'
        },
        {
          symptom: 'A binary full of tiny functions nobody wrote.',
          cause: 'The linker inserted veneers for calls that could not reach directly.',
          fix: 'Not a bug — but it explains size growth and stack traces with unfamiliar names.'
        },
        {
          symptom: 'The program runs correctly in one place and crashes when loaded elsewhere.',
          cause: 'It was linked for fixed addresses and loaded at a different base.',
          fix: 'Position-independent code, or load-time relocation. This is where M39 begins.'
        }
      ],
      inTheWild: [
        'ELF, Mach-O and PE: the same three things per object, with more metadata.',
        'ld and lld, and the "relocation truncated to fit" message everybody has seen.',
        'ARM veneers and PowerPC long-branch stubs, generated for exactly this reason.',
        'The dynamic linker, which does this again at process start for shared libraries.'
      ],
      sources: [
        { title: 'Levine — Linkers and Loaders', note: 'the standard treatment; short, and entirely about this' },
        { title: 'Drepper — How To Write Shared Libraries', note: 'what changes when the addresses are not known until run time' },
        { title: 'The RISC-V ELF psABI specification', note: 'the relocation types and their exact reaches' },
        { title: 'Bryant and O\'Hallaron — Computer Systems: A Programmer\'s Perspective, chapter 7', note: 'linking, with the object formats laid out' }
      ]
    },

    'real-instruction-sets': {
      summary: 'One function — summing an array — written for RISC-V, ARM64 and x86-64, with '
        + 'each instruction\'s encoded length listed and the x86 bytes given so any row can be '
        + 'checked against the manual. All three take ten instructions and a four-instruction '
        + 'loop; the byte counts are 40, 40 and 23.',
      intuition: 'Measure a specific function and the RISC-versus-CISC argument becomes a '
        + 'narrow, checkable claim about code size.',
      formulation: {
        equations: [
          {
            label: 'The same function, counted',
            expr: 'set . instructions . bytes . loop instructions . loop bytes',
            terms: [
              { sym: 'RISC-V (RV32I)', meaning: '10 . 40 . 4 . 16' },
              { sym: 'ARM64', meaning: '10 . 40 . 4 . 16' },
              { sym: 'x86-64', meaning: '10 . 23 . 4 . 11' },
              { sym: 'density', meaning: 'x86-64 is 1.74 times denser; nothing else differs' }
            ]
          },
          {
            label: 'Four decisions, three answers',
            expr: 'property . RISC-V . ARM64 . x86-64',
            terms: [
              { sym: 'encoding width', meaning: 'fixed 4 . fixed 4 . variable 1 to 15' },
              { sym: 'architectural registers', meaning: '32 . 31 . 16' },
              { sym: 'condition codes', meaning: 'no . yes . yes' },
              { sym: 'addressing modes', meaning: 'base + offset . plus pre/post-increment and extended register . plus scaled index, on almost anything' }
            ]
          },
          {
            label: 'Where the loop instructions go',
            expr: 'machine . the four instructions',
            terms: [
              { sym: 'RISC-V', meaning: 'lw, addi, add, bne — the branch compares two registers itself' },
              { sym: 'ARM64', meaning: 'ldr post-increment, add, cmp, b.ne — the load folds the advance' },
              { sym: 'x86-64', meaning: 'add with a scaled-index memory operand, inc, cmp, jne' },
              { sym: 'the cancellation', meaning: 'ARM64 saves one on addressing and spends one on flags' }
            ]
          },
          {
            label: 'What the front end must do',
            expr: 'question . fixed width . variable width',
            terms: [
              { sym: 'where does the next instruction start', meaning: 'here plus 4 . not known until this one is decoded' },
              { sym: 'four per cycle', meaning: 'four independent decodes . a serial chain of lengths' },
              { sym: 'the fix', meaning: 'none needed . length predictors and a micro-operation cache' },
              { sym: 'our own decoder', meaning: '103 gates at 24 gate delays, duplicable' }
            ]
          }
        ]
      },
      invariants: [
        {
          name: 'The listings are reference assembly, and the section says so',
          why: 'There is no x86 assembler here; claiming compiler output would be false.',
          breaks: 'Every x86 row carries its bytes so it can be checked one row at a time.'
        },
        {
          name: 'The totals are counted from the listings, never stated separately',
          why: 'A total that does not come from the rows will eventually disagree with them.',
          breaks: 'Adding a row to a listing changes the totals in the same render.'
        },
        {
          name: 'The comparison holds the function constant',
          why: 'Most published instruction-set comparisons do not say what they held constant.',
          breaks: 'Same algorithm, same optimisation intent, lengths from the encoding rules.'
        },
        {
          name: 'The claim is about this function, not about the architectures',
          why: 'One function cannot settle an architecture, and it can refute a slogan.',
          breaks: 'The instruction counts are identical, which the usual framing does not predict.'
        }
      ],
      complexity: [
        { operation: 'decode, fixed width', average: 'boundaries by arithmetic', worst: 'unchanged; that is the property' },
        { operation: 'decode, variable width', average: 'a length chain, one instruction at a time', worst: 'up to 15 bytes each, so the chain is deep' },
        { operation: 'compare and branch, no flags', average: '1 instruction', worst: '2 when the comparison is reused' },
        { operation: 'compare and branch, with flags', average: '2 instructions', worst: '2, but the comparison can feed several branches' },
        { operation: 'array element access', average: '1 instruction on x86-64 with a scaled index', worst: '3 on RISC-V: shift, add, load' }
      ],
      failureModes: [
        {
          symptom: 'An instruction-set comparison that proves whatever the author preferred.',
          cause: 'One metric was quoted and the workload was not stated.',
          fix: 'Quote instructions and bytes, name the function, and state the method.'
        },
        {
          symptom: 'Benchmark numbers that cannot be reproduced across toolchains.',
          cause: 'Different extensions were enabled — a multiply instruction changes everything.',
          fix: 'State the extension set. M34.3 shows a factorial spending 46% of itself on software multiply.'
        },
        {
          symptom: 'An out-of-order design where independent instructions serialise.',
          cause: 'They share the flags register, which nothing in the source suggests.',
          fix: 'Rename the flags too; RISC-V avoids the problem by not having them.'
        },
        {
          symptom: 'A wide front end that cannot keep the back end fed.',
          cause: 'Variable-length decode is a serial dependency before anything else can start.',
          fix: 'A micro-operation cache, which is what every modern x86 core does.'
        },
        {
          symptom: 'A conclusion about an architecture drawn from one function.',
          cause: 'This section, if you read it as more than it says.',
          fix: 'One function refutes a slogan; it does not settle an architecture.'
        }
      ],
      inTheWild: [
        'godbolt.org, which is this comparison with real compilers and every architecture.',
        'The ARM64 and x86-64 architecture reference manuals, where the encodings here come from.',
        'Micro-operation caches in every recent x86 core, and the decode power they save.',
        'Apple silicon\'s eight-wide decode, which is affordable because ARM64 is fixed-width.'
      ],
      sources: [
        { title: 'Intel 64 and IA-32 Architectures Software Developer\'s Manual, volume 2', note: 'the opcode tables the x86 byte counts come from' },
        { title: 'Arm Architecture Reference Manual for A-profile', note: 'the ARM64 encodings and addressing modes' },
        { title: 'Blem, Menon and Sankaralingam — Power Struggles: ISA delusions (HPCA 2013)', note: 'the same question measured across whole workloads' },
        { title: 'Waterman — Design of the RISC-V Instruction Set Architecture', note: 'the reasoning for leaving condition codes out' }
      ]
    }
  });
}(typeof window !== 'undefined' ? window : null));
