/**
 * Brv32Linker - sections, symbols, relocations and a flat image.
 *
 * An object file is three things: bytes, the symbols it defines, and the holes
 * it could not fill. Linking is placing the bytes, resolving each hole against
 * the combined symbol table, and patching the instruction that has the hole in
 * it. That is the whole job, and doing it here rather than describing it makes
 * two facts concrete.
 *
 * The first is that a relocation has a SHAPE. A branch offset lives in the
 * scrambled B-format field and reaches ±4 KB; a jump reaches ±1 MB; a
 * word in data is a plain 32-bit value. Patching the wrong shape produces an
 * instruction that decodes and jumps somewhere else, which is the worst kind
 * of wrong.
 *
 * The second is RANGE. A branch whose target is further than the field can
 * express must be reported, not truncated — and the reason large binaries need
 * veneers and thunks is exactly this limit, met at scale.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Linker = api;
  }
}(this, function (root) {
  'use strict';

  const has = root && root.Brv32;
  const Isa = has && root.Brv32.Isa ? root.Brv32.Isa : require('./isa.js');
  const Assembler = has && root.Brv32.Assembler ? root.Brv32.Assembler
    : require('./assembler.js');

  /** What each relocation shape can express, and where it puts the bits. */
  const KINDS = {
    branch: { format: 'B', low: -4096, high: 4094, about: 'a conditional branch, ±4 KB' },
    jump: { format: 'J', low: -1048576, high: 1048574, about: 'a jump, ±1 MB' },
    immediate: { format: 'I', low: -2048, high: 2047, about: 'a 12-bit immediate' },
    upper: { format: 'U', low: 0, high: 0xfffff, about: 'the upper 20 bits' }
  };

  /** Assemble one translation unit into an object: bytes, what it exports and
   *  what it still needs. */
  function compile(name, source, options) {
    const settings = options || {};
    const out = Assembler.assemble(source, { origin: 0, symbols: settings.symbols });

    return { name: name, bytes: out.bytes, symbols: out.symbols,
      relocations: out.relocations, errors: out.errors, listing: out.listing,
      size: out.bytes.length };
  }

  /** Place every object end to end and build the combined symbol table. A real
   *  linker groups by section first; the shape is the same. */
  function place(objects, options) {
    const settings = options || {};
    const base = settings.base === undefined ? 0 : settings.base;
    const placed = [];
    const symbols = Object.assign({}, settings.symbols);
    let at = base;

    objects.forEach(function (object) {
      Object.keys(object.symbols).forEach(function (name) {
        symbols[name] = object.symbols[name] + at;
      });
      placed.push({ object: object, base: at });
      at += align(object.size, settings.align || 4);
    });
    return { placed: placed, symbols: symbols, end: at, base: base };
  }

  function align(size, to) {
    return Math.ceil(size / to) * to;
  }

  function readWord(bytes, at) {
    return (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) |
      (bytes[at + 3] << 24)) >>> 0;
  }

  function writeWord(bytes, at, word) {
    bytes[at] = word & 0xff;
    bytes[at + 1] = (word >>> 8) & 0xff;
    bytes[at + 2] = (word >>> 16) & 0xff;
    bytes[at + 3] = (word >>> 24) & 0xff;
  }

  /**
   * Patch one hole. The immediate bits are cleared and re-packed through the
   * ISA's own field tables, so the linker and the assembler cannot disagree
   * about where a bit goes.
   */
  function applyOne(image, entry, symbols, base) {
    const kind = KINDS[entry.relocation.kind];
    const target = symbols[entry.relocation.symbol];

    if (target === undefined) {
      return { ok: false, symbol: entry.relocation.symbol, why: 'undefined symbol' };
    }
    const at = entry.address - base;
    const offset = target - entry.address;

    if (offset < kind.low || offset > kind.high) {
      return { ok: false, symbol: entry.relocation.symbol, offset: offset,
        why: 'out of range for ' + kind.about + ': needs ' + offset };
    }
    writeWord(image, at, patched(readWord(image, at), offset, kind));
    return { ok: true, symbol: entry.relocation.symbol, offset: offset, at: entry.address };
  }

  function patched(word, offset, kind) {
    const cleared = clearImmediate(word, kind.format);

    return (cleared | Isa.packImmediate(offset, kind.format)) >>> 0;
  }

  function clearImmediate(word, format) {
    let mask = 0;

    (Isa.IMMEDIATE_FIELDS[format] || []).forEach(function (field) {
      for (let at = field[3]; at <= field[2]; at += 1) mask |= (1 << at);
    });
    return (word & ~mask) >>> 0;
  }

  /**
   * Link: place, collect the relocations with their final addresses, apply
   * them, and report every failure rather than the first. A linker that stops
   * at the first undefined symbol makes you build once per missing name.
   */
  function link(objects, options) {
    const layout = place(objects, options);
    const image = [];

    layout.placed.forEach(function (row) {
      while (image.length < row.base - layout.base) image.push(0);
      row.object.bytes.forEach(function (byte) { image.push(byte); });
    });
    const entries = relocationEntries(layout);
    const applied = entries.map(function (entry) {
      return applyOne(image, entry, layout.symbols, layout.base);
    });
    const failed = applied.filter(function (row) { return !row.ok; });

    return { ok: failed.length === 0, image: image, symbols: layout.symbols,
      applied: applied, failed: failed, layout: layout,
      entry: layout.symbols[(options || {}).entrySymbol || '_start'] };
  }

  function relocationEntries(layout) {
    const out = [];

    layout.placed.forEach(function (row) {
      row.object.relocations.forEach(function (relocation) {
        out.push({ relocation: relocation, address: relocation.address + row.base,
          object: row.object.name });
      });
    });
    return out;
  }

  /** The linked image as a map, which is the artefact a reader wants when
   *  something ended up at an address they did not expect. */
  function mapOf(result) {
    return Object.keys(result.symbols).sort(function (left, right) {
      return result.symbols[left] - result.symbols[right];
    }).map(function (name) {
      return { name: name, address: result.symbols[name] };
    });
  }

  return { KINDS: KINDS, compile: compile, place: place, link: link, mapOf: mapOf,
    applyOne: applyOne, clearImmediate: clearImmediate, align: align };
}));
