/**
 * Brv32Devices - the address space, and the devices that live in it.
 *
 * "Memory-mapped" means a device is an address, and this module is what that
 * sentence costs: one dispatch on the top bits of every access, deciding
 * whether a word goes to RAM or to a console register. Everything odd about
 * device programming follows from it — a wild pointer can hit a device, a
 * device read is not idempotent, and the compiler must not cache or reorder
 * these accesses because they are not memory even though they look like it.
 *
 * The faults are the other half. A load or store must be naturally aligned and
 * must land in a mapped region; both failures raise a trap with the offending
 * address rather than silently truncating, because "silently truncating" is
 * how an out-of-range access becomes a bug you find three modules later.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Devices = api;
  }
}(this, function () {
  'use strict';

  /** The map is deliberately small and printable: a reader should be able to
   *  hold the whole address space in their head. */
  const MAP = [
    /* 32 KiB of program space, not 4: a branch reaches 4 094 bytes, so a
       region of 4 096 makes "the target is out of branch range" and "the
       target is off the end of memory" the same event, and the linker
       section could not demonstrate a veneer at all. */
    { name: 'rom', base: 0x00000000, size: 0x8000, kind: 'ram',
      about: 'program image, loaded before reset' },
    { name: 'ram', base: 0x10000000, size: 0x1000, kind: 'ram',
      about: 'data and stack' },
    { name: 'console', base: 0x20000000, size: 0x10, kind: 'device',
      about: 'write a byte here and it appears' },
    { name: 'timer', base: 0x20001000, size: 0x10, kind: 'device',
      about: 'a counter and a compare register that raises an interrupt' }
  ];

  const CAUSE = { misalignedLoad: 4, faultLoad: 5, misalignedStore: 6, faultStore: 7,
    illegal: 2, misalignedFetch: 0 };

  function regionOf(address) {
    const value = address >>> 0;

    return MAP.filter(function (region) {
      return value >= region.base && value < region.base + region.size;
    })[0] || null;
  }

  function create(options) {
    const settings = options || {};

    return { cells: {}, console: '', timer: { count: 0, compare: 0, pending: false },
      trace: [], limit: settings.limit || 0, faults: [] };
  }

  function raw(state, address) {
    const value = state.cells[address >>> 0];

    return value === undefined ? 0 : value & 0xff;
  }

  function loadImage(state, base, bytes) {
    bytes.forEach(function (byte, at) {
      state.cells[(base + at) >>> 0] = byte & 0xff;
    });
    return state;
  }

  /** Words are little-endian, which is a convention rather than a law — and
   *  the reason a byte pointer into an integer sees the low byte first. */
  function readWord(state, address, width) {
    let value = 0;

    for (let at = 0; at < width; at += 1) value |= raw(state, address + at) << (8 * at);
    return value >>> 0;
  }

  function writeWord(state, address, value, width) {
    for (let at = 0; at < width; at += 1) {
      state.cells[(address + at) >>> 0] = (value >>> (8 * at)) & 0xff;
    }
  }

  function extend(value, width, signed) {
    if (!signed || width === 4) return value | 0;
    const sign = 1 << (8 * width - 1);

    return ((value & (sign - 1)) - (value & sign)) | 0;
  }

  function misaligned(address, width) {
    return (address >>> 0) % width !== 0;
  }

  /* ------------------------------------------------------------- devices */

  function deviceRead(state, region, address, width) {
    const offset = (address >>> 0) - region.base;

    if (region.name === 'timer' && offset === 0) return state.timer.count >>> 0;
    if (region.name === 'timer' && offset === 4) return state.timer.compare >>> 0;
    if (region.name === 'console' && offset === 4) return 1;
    return readWord(state, address, width);
  }

  function deviceWrite(state, region, address, value) {
    const offset = (address >>> 0) - region.base;

    if (region.name === 'console' && offset === 0) {
      state.console += String.fromCharCode(value & 0xff);
      return;
    }
    /* Writing either timer register acknowledges the interrupt. A device that
       cannot be acknowledged raises the same interrupt again the instant the
       handler returns, which is a livelock rather than a bug you can see. */
    if (region.name === 'timer' && offset === 4) {
      state.timer.compare = value >>> 0;
      state.timer.pending = false;
      return;
    }
    if (region.name === 'timer' && offset === 0) {
      state.timer.count = value >>> 0;
      state.timer.pending = false;
      return;
    }
    writeWord(state, address, value, 4);
  }

  /* --------------------------------------------------------- the interface */

  /** Both `read` and `write` return a fault rather than throwing, because a
   *  fault is architectural state — the trap handler is going to read the
   *  cause and the address, and an exception object would lose both. */
  /**
   * Whether an access is legal, WITHOUT performing it.
   *
   * An in-order machine never needs this: it can attempt the access and use
   * the fault the attempt returns. An out-of-order machine does, because a
   * store must know whether it will fault long before it is allowed to write
   * anything - the fault has to travel with the instruction to commit, and the
   * write must not happen until it gets there. Attempting the store to find
   * out would be the one thing precise exceptions forbid.
   *
   * The two faults are the same two in both directions and differ only in the
   * cause number, which is why this is one function rather than two that drift.
   */
  function checkAccess(state, address, width, store) {
    const target = address >>> 0;

    if (misaligned(target, width)) {
      return { fault: { cause: store ? CAUSE.misalignedStore : CAUSE.misalignedLoad,
        value: target, name: store ? 'misaligned store' : 'misaligned load' } };
    }
    const region = regionOf(target);

    if (!region) {
      return { fault: { cause: store ? CAUSE.faultStore : CAUSE.faultLoad, value: target,
        name: store ? 'store to unmapped memory' : 'load from unmapped memory' } };
    }
    return { region: region };
  }

  function read(state, address, width, signed) {
    const target = address >>> 0;
    const checked = checkAccess(state, target, width, false);

    if (checked.fault) return checked;
    const region = checked.region;
    const value = region.kind === 'device'
      ? deviceRead(state, region, target, width)
      : readWord(state, target, width);

    return { value: extend(value, width, signed), region: region.name };
  }

  function write(state, address, value, width) {
    const target = address >>> 0;
    const checked = checkAccess(state, target, width, true);

    if (checked.fault) return checked;
    if (checked.region.kind === 'device') deviceWrite(state, checked.region, target, value);
    else writeWord(state, target, value, width);
    return { region: checked.region.name };
  }

  /** One tick of the timer, which is where an asynchronous interrupt comes
   *  from: nothing the program did caused it. */
  function tick(state) {
    state.timer.count = (state.timer.count + 1) >>> 0;
    if (state.timer.compare > 0 && state.timer.count >= state.timer.compare) {
      state.timer.pending = true;
    }
    return state.timer.pending;
  }

  return { MAP: MAP, CAUSE: CAUSE, create: create, regionOf: regionOf, loadImage: loadImage,
    read: read, write: write, checkAccess: checkAccess, tick: tick, readWord: readWord,
    writeWord: writeWord, extend: extend, misaligned: misaligned };
}));
