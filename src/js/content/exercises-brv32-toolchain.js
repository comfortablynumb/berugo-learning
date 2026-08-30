/**
 * Graded exercises for the toolchain and the instruction-set comparison
 * (M34.9-M34.10).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'assembler-linker-and-loading': [{
      id: 'apply-relocations',
      title: 'Place the objects, then fill the holes — or refuse',
      prompt: 'Write lab() returning { place, resolve }. place(objects) takes objects of the '
        + 'form { name, size, symbols, relocations } — symbols mapping a name to an offset '
        + 'within the object, relocations being { address, symbol, kind } with the address also '
        + 'relative to the object — and returns { placed, symbols }: placed is one '
        + '{ name, base } per object, laid end to end from 0 with each base rounded up to a '
        + 'multiple of 4, and symbols is the combined table mapping each name to its final '
        + 'address. resolve(layout, objects, ranges) returns one result per relocation, in '
        + 'object order: { symbol, ok, offset, why }. The offset is the target address minus '
        + 'the relocation\'s final address. A symbol with no definition gives ok false and why '
        + '"undefined symbol", with no offset. An offset outside ranges[kind] — which is '
        + '{ low, high } — gives ok false and why "out of range: needs N". Anything else is ok '
        + 'true. The starter forgets the alignment and clamps an out-of-range offset instead of '
        + 'reporting it.',
      entry: 'lab',
      starter: [
        'function place(objects) {',
        '  // No alignment, so an odd-sized object leaves every later address',
        '  // one byte out.',
        '  const placed = [];',
        '  const symbols = {};',
        '  let at = 0;',
        '',
        '  objects.forEach(function (object) {',
        '    Object.keys(object.symbols).forEach(function (name) {',
        '      symbols[name] = object.symbols[name] + at;',
        '    });',
        '    placed.push({ name: object.name, base: at });',
        '    at += object.size;',
        '  });',
        '  return { placed: placed, symbols: symbols };',
        '}',
        '',
        'function resolve(layout, objects, ranges) {',
        '  const out = [];',
        '',
        '  objects.forEach(function (object, index) {',
        '    const base = layout.placed[index].base;',
        '',
        '    object.relocations.forEach(function (relocation) {',
        '      const target = layout.symbols[relocation.symbol];',
        '      const range = ranges[relocation.kind];',
        '      let offset = target - (relocation.address + base);',
        '',
        '      // Clamping. The branch will decode perfectly and go somewhere else.',
        '      if (offset > range.high) offset = range.high;',
        '      if (offset < range.low) offset = range.low;',
        '      out.push({ symbol: relocation.symbol, ok: true, offset: offset });',
        '    });',
        '  });',
        '  return out;',
        '}',
        '',
        'function lab() {',
        '  return { place: place, resolve: resolve };',
        '}'
      ].join('\n'),
      solution: [
        'function place(objects) {',
        '  const placed = [];',
        '  const symbols = {};',
        '  let at = 0;',
        '',
        '  objects.forEach(function (object) {',
        '    Object.keys(object.symbols).forEach(function (name) {',
        '      symbols[name] = object.symbols[name] + at;',
        '    });',
        '    placed.push({ name: object.name, base: at });',
        '    at += Math.ceil(object.size / 4) * 4;',
        '  });',
        '  return { placed: placed, symbols: symbols };',
        '}',
        '',
        '/* An offset that does not fit has no correct encoding, so there is',
        '   nothing to write. Reporting the number it needed is what says whether',
        '   a veneer would be enough. */',
        'function resolve(layout, objects, ranges) {',
        '  const out = [];',
        '',
        '  objects.forEach(function (object, index) {',
        '    const base = layout.placed[index].base;',
        '',
        '    object.relocations.forEach(function (relocation) {',
        '      out.push(one(relocation, base, layout, ranges));',
        '    });',
        '  });',
        '  return out;',
        '}',
        '',
        'function one(relocation, base, layout, ranges) {',
        '  const target = layout.symbols[relocation.symbol];',
        '',
        '  if (target === undefined) {',
        '    return { symbol: relocation.symbol, ok: false, why: "undefined symbol" };',
        '  }',
        '  const offset = target - (relocation.address + base);',
        '  const range = ranges[relocation.kind];',
        '',
        '  if (offset < range.low || offset > range.high) {',
        '    return { symbol: relocation.symbol, ok: false, offset: offset,',
        '      why: "out of range: needs " + offset };',
        '  }',
        '  return { symbol: relocation.symbol, ok: true, offset: offset };',
        '}',
        '',
        'function lab() {',
        '  return { place: place, resolve: resolve };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'placement aligns every base, so an odd-sized object does not shift the rest',
          assert: function (lab, api) {
            const parts = lab();
            const layout = parts.place([
              { name: 'a.o', size: 6, symbols: { start: 0 }, relocations: [] },
              { name: 'b.o', size: 8, symbols: { target: 0 }, relocations: [] }
            ]);

            api.assert.equal(layout.placed[0].base, 0, 'the first object starts at 0');
            api.assert.equal(layout.placed[1].base, 8, '6 bytes rounded up to 8');
            api.assert.equal(layout.symbols.target, 8, 'and the symbol follows its object');
          }
        },
        {
          name: 'a reachable relocation is patched, and the offset is the distance',
          assert: function (lab, api) {
            const parts = lab();
            const objects = [
              { name: 'main.o', size: 20, symbols: { _start: 0 },
                relocations: [{ address: 8, symbol: 'target', kind: 'branch' }] },
              { name: 'target.o', size: 8, symbols: { target: 0 }, relocations: [] }
            ];
            const ranges = { branch: { low: -4096, high: 4094 } };
            const out = parts.resolve(parts.place(objects), objects, ranges);

            api.assert.equal(out.length, 1, 'one hole');
            api.assert.equal(out[0].ok, true, 'and it fits');
            api.assert.equal(out[0].offset, 12, 'target is at 20, the branch is at 8');
          }
        },
        {
          name: 'five thousand unrelated bytes break the same link, with the number reported',
          assert: function (lab, api) {
            const parts = lab();
            const objects = [
              { name: 'main.o', size: 20, symbols: { _start: 0 },
                relocations: [{ address: 8, symbol: 'target', kind: 'branch' }] },
              { name: 'pad.o', size: 5000, symbols: {}, relocations: [] },
              { name: 'target.o', size: 8, symbols: { target: 0 }, relocations: [] }
            ];
            const ranges = { branch: { low: -4096, high: 4094 } };
            const out = parts.resolve(parts.place(objects), objects, ranges);

            api.assert.equal(out[0].ok, false, 'no correct encoding exists');
            api.assert.equal(out[0].offset, 5012, 'the distance is still computed');
            api.assert.equal(out[0].why, 'out of range: needs 5012',
              'and reported, rather than truncated to something that decodes');
          }
        },
        {
          name: 'an undefined symbol has no offset at all',
          assert: function (lab, api) {
            const parts = lab();
            const objects = [
              { name: 'main.o', size: 20, symbols: { _start: 0 },
                relocations: [{ address: 8, symbol: 'target', kind: 'branch' }] }
            ];
            const ranges = { branch: { low: -4096, high: 4094 } };
            const out = parts.resolve(parts.place(objects), objects, ranges);

            api.assert.equal(out[0].ok, false, 'the link fails');
            api.assert.equal(out[0].why, 'undefined symbol', 'and for a different reason');
            api.assert.equal(out[0].offset, undefined,
              'there is no distance to compute when there is no target');
          }
        }
      ]
    }],

    'real-instruction-sets': [{
      id: 'identify-the-isa',
      title: 'Identify the instruction set from the listing alone',
      prompt: 'Write lab() returning { measure, identify }. measure(listing) takes rows of '
        + '{ text, bytes, loop } and returns { instructions, bytes, loopInstructions, '
        + 'loopBytes, widths } — widths being the distinct encoded lengths present, sorted '
        + 'ascending. identify(listing) names the architecture from the evidence: return '
        + '"x86-64" when more than one distinct instruction length appears; otherwise the '
        + 'listing is fixed-width, so return "arm64" when any row\'s text starts with "cmp" '
        + '(a separate compare implies a flags register) and "riscv" when none does. The '
        + 'starter identifies by fixed width alone, which cannot tell the two RISC machines '
        + 'apart, and counts the loop rows as the whole listing.',
      entry: 'lab',
      starter: [
        'function measure(listing) {',
        '  // The loop counts are copies of the totals, so a loop-body',
        '  // comparison would say every machine spends its whole function there.',
        '  const bytes = listing.reduce(function (sum, row) { return sum + row.bytes; }, 0);',
        '',
        '  return { instructions: listing.length, bytes: bytes,',
        '    loopInstructions: listing.length, loopBytes: bytes,',
        '    widths: [listing[0].bytes] };',
        '}',
        '',
        'function identify(listing) {',
        '  // Fixed width is not enough: RISC-V and ARM64 are both 4 bytes.',
        '  const first = listing[0].bytes;',
        '  const fixed = listing.every(function (row) { return row.bytes === first; });',
        '',
        '  return fixed ? "riscv" : "x86-64";',
        '}',
        '',
        'function lab() {',
        '  return { measure: measure, identify: identify };',
        '}'
      ].join('\n'),
      solution: [
        'function measure(listing) {',
        '  const loop = listing.filter(function (row) { return row.loop; });',
        '  const seen = {};',
        '',
        '  listing.forEach(function (row) { seen[row.bytes] = true; });',
        '  return { instructions: listing.length,',
        '    bytes: total(listing), loopInstructions: loop.length, loopBytes: total(loop),',
        '    widths: Object.keys(seen).map(Number).sort(function (a, b) { return a - b; }) };',
        '}',
        '',
        'function total(rows) {',
        '  return rows.reduce(function (sum, row) { return sum + row.bytes; }, 0);',
        '}',
        '',
        '/* Two questions, in order. More than one instruction length means a',
        '   variable-width encoding, which settles it. Otherwise the listing is',
        '   fixed-width and the distinguishing evidence is whether a compare is',
        '   an instruction of its own - which is the same as asking whether the',
        '   machine has a flags register. */',
        'function identify(listing) {',
        '  const widths = measure(listing).widths;',
        '',
        '  if (widths.length > 1) return "x86-64";',
        '  const compares = listing.some(function (row) {',
        '    return String(row.text).trim().indexOf("cmp") === 0;',
        '  });',
        '',
        '  return compares ? "arm64" : "riscv";',
        '}',
        '',
        'function lab() {',
        '  return { measure: measure, identify: identify };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the RISC-V listing: ten instructions, forty bytes, four in the loop',
          assert: function (lab, api) {
            const parts = lab();
            const listing = [
              { text: 'li a2, 0', bytes: 4, loop: false },
              { text: 'blez a1, .done', bytes: 4, loop: false },
              { text: 'slli a3, a1, 2', bytes: 4, loop: false },
              { text: 'add a3, a0, a3', bytes: 4, loop: false },
              { text: 'lw a4, 0(a0)', bytes: 4, loop: true },
              { text: 'addi a0, a0, 4', bytes: 4, loop: true },
              { text: 'add a2, a2, a4', bytes: 4, loop: true },
              { text: 'bne a0, a3, .loop', bytes: 4, loop: true },
              { text: 'mv a0, a2', bytes: 4, loop: false },
              { text: 'ret', bytes: 4, loop: false }
            ];
            const got = parts.measure(listing);

            api.assert.equal(got.instructions, 10, 'ten instructions');
            api.assert.equal(got.bytes, 40, 'at four bytes each');
            api.assert.equal(got.loopInstructions, 4, 'four of them run per element');
            api.assert.equal(got.loopBytes, 16, 'which is what the fetcher pays per iteration');
            api.assert.deepEqual(got.widths, [4], 'one length, so fixed width');
            api.assert.equal(parts.identify(listing), 'riscv',
              'fixed width and no separate compare');
          }
        },
        {
          name: 'the ARM64 listing is also fixed width, and the compare gives it away',
          assert: function (lab, api) {
            const parts = lab();
            const listing = [
              { text: 'mov w2, wzr', bytes: 4, loop: false },
              { text: 'cmp w1, #0', bytes: 4, loop: false },
              { text: 'b.le .done', bytes: 4, loop: false },
              { text: 'add x3, x0, w1, sxtw #2', bytes: 4, loop: false },
              { text: 'ldr w4, [x0], #4', bytes: 4, loop: true },
              { text: 'add w2, w2, w4', bytes: 4, loop: true },
              { text: 'cmp x0, x3', bytes: 4, loop: true },
              { text: 'b.ne .loop', bytes: 4, loop: true },
              { text: 'mov w0, w2', bytes: 4, loop: false },
              { text: 'ret', bytes: 4, loop: false }
            ];

            api.assert.deepEqual(parts.measure(listing).widths, [4], 'still four bytes each');
            api.assert.equal(parts.measure(listing).bytes, 40, 'and still forty bytes');
            api.assert.equal(parts.identify(listing), 'arm64',
              'a compare of its own means a flags register, which RISC-V does not have');
          }
        },
        {
          name: 'the x86-64 listing is denser, and its lengths differ',
          assert: function (lab, api) {
            const parts = lab();
            const listing = [
              { text: 'xor eax, eax', bytes: 2, loop: false },
              { text: 'test esi, esi', bytes: 2, loop: false },
              { text: 'jle .done', bytes: 2, loop: false },
              { text: 'movsxd rdx, esi', bytes: 3, loop: false },
              { text: 'xor ecx, ecx', bytes: 2, loop: false },
              { text: 'add eax, [rdi+rcx*4]', bytes: 3, loop: true },
              { text: 'inc rcx', bytes: 3, loop: true },
              { text: 'cmp rcx, rdx', bytes: 3, loop: true },
              { text: 'jne .loop', bytes: 2, loop: true },
              { text: 'ret', bytes: 1, loop: false }
            ];
            const got = parts.measure(listing);

            api.assert.equal(got.instructions, 10, 'the same instruction count as the others');
            api.assert.equal(got.bytes, 23, 'and 23 bytes against 40');
            api.assert.equal(got.loopBytes, 11, 'eleven bytes per iteration against sixteen');
            api.assert.deepEqual(got.widths, [1, 2, 3], 'three distinct lengths');
            api.assert.equal(parts.identify(listing), 'x86-64', 'which settles it on its own');
          }
        },
        {
          name: 'a single row is enough when its length is unusual, and not when it is not',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.identify([{ text: 'ret', bytes: 1, loop: false },
              { text: 'xor eax, eax', bytes: 2, loop: false }]), 'x86-64',
              'two lengths in two instructions');
            api.assert.equal(parts.identify([{ text: 'ret', bytes: 4, loop: false }]), 'riscv',
              'one fixed-width row with no compare falls to the default');
            api.assert.equal(parts.identify([{ text: 'cmp x0, x3', bytes: 4, loop: false }]),
              'arm64', 'and one compare is enough to say there are flags');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
