# M39 — Linking, loading and the ABI

> **Track** Computer architecture · **Depends on** M34 · **Sections** 9 · **Effort** M

**Outcome.** The stage between "it compiles" and "it runs", which is where a large share of real
build and deployment failures live. Object files, symbols, relocations, dynamic linking, calling
conventions, startup and debug information — all built for the BRV32 toolchain from M34 and
inspectable byte by byte.

**Shared machinery introduced.** `machines/objfile.js` — a simplified but real ELF-shaped object
format with sections, a symbol table, relocations and debug info, plus a hex/structure inspector;
`machines/linker.js` — static and dynamic linking with a resolution log;
`machines/loader.js` — program loading into the simulated address space with relocation, PLT/GOT
setup and startup.

---

## Sections

### 39.1 The build pipeline
- **Covers** — the stages from source to running process (preprocess, compile, assemble, link,
  load, dynamic link, execute), what each stage knows and cannot know, separate compilation and its
  consequences, why the linker exists at all, translation units and the one-definition rule, and
  build systems as dependency graphs over these stages.
- **Demo** — the pipeline inspector: a multi-file program taken through every stage with the
  artefact after each shown (tokens, assembly, object bytes, linked image, loaded memory) and the
  information lost or added at each step annotated.
- **Diagram** — mermaid flowchart of the pipeline with the artefact and the tool at every edge.
- **Lab** — given a broken build, identify the failing stage from the error alone for eight cases
  (parse error, type error, missing symbol at link, missing library at load, ABI mismatch); graded
  against the ground truth.
- **Senior insight** — "undefined reference" is a link error and "cannot open shared object" is a
  load error, and the fixes have nothing in common. Placing an error in the pipeline is most of
  debugging a build.

### 39.2 Object files
- **Covers** — the ELF structure (header, section headers, program headers), the standard sections
  (`.text`, `.data`, `.rodata`, `.bss`, `.symtab`, `.strtab`, `.rela.*`), symbol tables with binding
  and visibility, local versus global versus weak symbols, common symbols, section flags and
  alignment, and comparing ELF with Mach-O and PE at a structural level.
- **Demo** — the object-file inspector: hex on the left, parsed structure on the right, with every
  field clickable to see what it means and what consumes it; the same program compiled two ways to
  compare section contents.
- **Diagram** — mermaid diagram of an ELF file's layout with section and program header tables.
- **Lab** — implement an object-file parser producing sections, symbols and relocations; tests
  assert the parse matches the assembler's own output structures for the fixture programs.
- **Senior insight** — `.bss` occupies no file bytes but does occupy memory, which is why a program
  with a large zero-initialised array is a small file; understanding the section model explains most
  binary-size surprises.

### 39.3 Static linking
- **Covers** — symbol resolution across objects, the archive (`.a`) format and the order-dependent
  extraction rule, duplicate and missing symbol diagnostics, weak symbols and overrides, section
  merging and layout, garbage collection of unreferenced sections, identical code folding, link-time
  optimisation, and link maps.
- **Demo** — the resolution log: watch the linker consume objects in order, resolve or defer each
  undefined symbol, extract archive members, and lay out sections; reorder the inputs and watch a
  link that worked now fail.
- **Diagram** — mermaid diagram of the linker's undefined-symbol set shrinking as objects are
  processed.
- **Lab** — implement archive member extraction with the classic left-to-right rule; tests assert
  that the fixture link succeeds in the correct order and fails in the reversed order with the exact
  expected undefined symbol.
- **Senior insight** — link order mattering is not a historical accident to be worked around; it is
  the resolution algorithm, and knowing it turns a mysterious failure into a one-line fix.

### 39.4 Address spaces and loading
- **Covers** — the process address space layout (text, data, bss, heap, stack, mapped regions),
  program headers as the loader's instructions, mapping versus copying, zero-filled pages,
  position-dependent versus position-independent executables, ASLR and what it randomises, stack
  and heap placement, and the loader's handoff to the entry point.
- **Demo** — the loader in action: program headers read, segments mapped into the simulated address
  space, `.bss` zeroed, stack set up with arguments and environment, and control transferred — with
  the resulting memory map displayed.
- **Diagram** — mermaid diagram of a process address space with segment permissions marked.
- **Lab** — implement segment mapping and stack setup (argv, envp, auxiliary vector); tests assert
  the loaded image matches the expected memory map and that the entry point receives correctly
  formed arguments.
- **Senior insight** — the initial stack layout is an ABI contract, which is why a program can read
  `argv` before any runtime has initialised; a surprising amount of "how does main get its
  arguments" is answered right here.

### 39.5 Dynamic linking
- **Covers** — shared objects and why they exist (memory sharing, independent updates, plugin
  loading), the dynamic section and `DT_NEEDED`, the global offset table and procedure linkage
  table, lazy versus eager binding, symbol interposition and `LD_PRELOAD`, symbol versioning,
  `RPATH`/`RUNPATH` and search order, `dlopen` and plugin architectures, and the security surface
  the whole mechanism creates.
- **Demo** — call a function in a shared object and watch the PLT stub jump through the GOT to the
  resolver on the first call, then directly on the second, with the GOT entry's before and after
  values shown; interposition is then demonstrated by preloading a replacement.
- **Diagram** — mermaid sequence diagram of the first and subsequent calls through PLT and GOT.
- **Lab** — implement lazy binding: the PLT stub, the resolver call and the GOT patch; tests assert
  the first call resolves correctly, the second bypasses the resolver, and interposition changes
  which implementation runs.
- **Senior insight** — interposition means any shared function call can be replaced at load time;
  that is how profilers, sanitisers and malware all work, and it is why statically linked binaries
  are preferred in some security contexts.

### 39.6 The ABI
- **Covers** — what an ABI covers beyond calling conventions (type sizes and alignment, struct
  layout and padding, bitfield ordering, name mangling, exception-handling tables, vtable layout),
  argument passing in registers versus the stack, return values including large structs, caller- and
  callee-saved registers, the red zone, stack alignment requirements, varargs, and ABI stability as
  a compatibility contract.
- **Demo** — calling-convention explorer: define a function signature and see exactly where each
  argument goes for the BRV32 convention and, from reference data, for SysV x86-64 and AAPCS64 —
  including the cases where a struct is split, passed by reference or padded.
- **Diagram** — mermaid diagram of argument registers and the stack for a mixed-type signature.
- **Lab** — implement struct layout with alignment and padding for the ABI's rules; tests assert
  offsets and sizes match a reference table, including nested structs and arrays.
- **Senior insight** — struct layout is why adding one field can grow a struct by 8 bytes, and
  reordering fields by decreasing alignment is the free optimisation everybody forgets; the same
  rules decide FFI compatibility.

### 39.7 Startup and runtime initialisation
- **Covers** — the real entry point before `main`, C runtime startup (`crt0`), the init/fini arrays
  and static initialiser ordering (and the static initialisation order fiasco), thread-local storage
  models and the TLS access sequence, `atexit` handlers, the dynamic loader's own bootstrap, and
  measuring startup cost.
- **Demo** — startup timeline: every step from the entry point to `main` shown with its cost, for a
  static binary and a dynamically linked one with several libraries; the relocation-processing cost
  of dynamic linking is visible as a bar.
- **Diagram** — mermaid sequence diagram of the startup path including the dynamic loader.
- **Lab** — implement init-array processing with correct ordering guarantees; tests assert
  initialisers run in the specified order and that a cross-translation-unit dependency is detected as
  undefined-order rather than silently working.
- **Senior insight** — dynamic linking cost is paid at every process start, which is why
  short-lived processes in a container often spend more time relocating than working; prelinking and
  static linking are both answers to that measurement.

### 39.8 Debug information and symbolication
- **Covers** — DWARF's structure (compilation units, DIEs, line-number program), mapping addresses
  to source lines and inlined frames, unwind tables and how a stack trace is produced without frame
  pointers, symbol tables versus debug info, stripping and separate debug files, build IDs and
  symbol servers, and symbolicating a crash from production.
- **Demo** — take an address in the simulated program and symbolicate it: function, file, line and
  the inlining chain, using the line program and DWARF data emitted by the M28–M30 toolchain; a
  stripped variant shows what is lost and how a build ID recovers it.
- **Diagram** — mermaid diagram of the address → line-table → source-location resolution path.
- **Lab** — implement the line-number-program state machine to build the address-to-line table;
  tests assert lookups match the compiler's recorded mapping for every instruction in the fixtures.
- **Senior insight** — unwinding without frame pointers depends entirely on `.eh_frame`-style
  tables, which is why omitting frame pointers is safe for correctness and painful for profilers —
  and why the debate about compiling with them keeps returning.

### 39.9 Linking problems in practice
- **Covers** — the diagnostic catalogue: undefined symbols, duplicate definitions, ABI mismatch
  between compilers or standard-library versions, symbol version errors, the diamond dependency
  problem, static/dynamic mixing hazards, C++ ODR violations that link but misbehave, binary size
  reduction, and the trade-offs of static linking for containers and distribution.
- **Demo** — the failure gallery: each problem reproduced in the simulated toolchain with the exact
  error the real toolchain would give, the underlying cause shown in the object files, and the fix
  applied and re-linked.
- **Diagram** — mermaid decision flowchart from a link/load error message to its cause.
- **Lab** — diagnose and fix five broken builds using only the object inspector and the resolution
  log; graded on the fix and the stated cause.
- **Senior insight** — an ODR violation links cleanly and produces a program where the same type has
  two layouts; it is the worst class of build bug precisely because nothing fails until runtime, and
  identical-code-folding can even hide it further.

---

## Modules

| Path | Purpose |
|---|---|
| `src/js/machines/objfile.js` | ELF-shaped format, parser, writer, hex/structure inspector |
| `src/js/machines/linker.js` | Symbol resolution, archives, section layout, relocations, GC, map file |
| `src/js/machines/dynlink.js` | Shared objects, GOT/PLT, lazy binding, interposition, versioning |
| `src/js/machines/loader.js` | Segment mapping, stack setup, auxiliary vector, entry transfer |
| `src/js/machines/abi.js` | Calling conventions, struct layout, alignment rules per target |
| `src/js/machines/startup.js` | crt-equivalent, init/fini arrays, TLS setup, atexit |
| `src/js/machines/debuginfo.js` | Line-number program, DIE tree, unwind tables, symbolication |
| `src/js/viz/memory-map-view.js` | Address-space map with segments and permissions |
| `src/js/viz/hex-view.js` | Byte inspector with structure overlay |

---

## Acceptance criteria

- [ ] The object writer and parser round-trip every fixture program byte for byte.
- [ ] Static linking reproduces the documented order-dependent archive behaviour, with tests for
      both the working and failing orders.
- [ ] Relocations are applied correctly for every relocation type in the toolchain, verified by
      executing the linked program on the M34 CPU.
- [ ] Lazy binding patches the GOT exactly once per symbol, asserted by counting resolver calls.
- [ ] Struct-layout computation matches the reference table for every fixture, including nested and
      bitfield cases.
- [ ] Symbolication resolves every instruction address to the correct source line and inlining
      chain, checked against the compiler's own records.

---

## Sources

- Levine — *Linkers and Loaders*
- Drepper — *How to write shared libraries*
- The System V ABI and the RISC-V ELF psABI specifications
- The DWARF Debugging Information Format specification
- Bryant, O'Hallaron — *Computer Systems: A Programmer's Perspective*, the linking chapter
- Kell, Mulligan, Sewell — *The missing link: explaining ELF static linking, semantically*
