/**
 * RegisterView - the register file, the control registers and memory, as rows.
 *
 * Four sections show the same machine state and they should show it the same
 * way, so the formatting lives here: a register is its number, its
 * calling-convention name, its value in hex and the same value as a signed
 * decimal, because which of those you want depends entirely on what you think
 * is in it.
 *
 * `changed` is the field that makes a step readable. A register view where
 * everything is the same colour makes you diff two screenshots by eye; one
 * that says which registers this instruction moved is a debugger.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.RegisterView = api;
}(this, function (root) {
  'use strict';

  const Isa = root && root.Brv32 && root.Brv32.Isa ? root.Brv32.Isa
    : require('../machines/brv32/isa.js');

  function hex(value, width) {
    return '0x' + ((value || 0) >>> 0).toString(16).padStart(width || 8, '0');
  }

  /** Only the registers a program has touched, plus the ones it always uses.
   *  Thirty-two rows of zero is not a register view, it is wallpaper. */
  function rows(registers, options) {
    const settings = options || {};
    const previous = settings.previous || [];
    const always = settings.always || [0, 1, 2, 10, 11];

    return registers.map(function (value, index) {
      return { index: index, name: Isa.REGISTER_NAMES[index] || ('x' + index),
        value: value | 0, hex: hex(value), signed: value | 0,
        changed: previous.length > 0 && (previous[index] | 0) !== (value | 0),
        interesting: value !== 0 || always.indexOf(index) !== -1 };
    }).filter(function (row) {
      return settings.all || row.interesting || row.changed;
    });
  }

  /** Memory as words, with the region each address falls in — because "which
   *  device did I just write to" is the question a memory view exists for. */
  function memoryRows(devices, options) {
    const settings = options || {};
    const base = settings.base || 0;
    const count = settings.count || 8;
    const out = [];

    for (let at = 0; at < count; at += 1) {
      const address = base + 4 * at;
      const region = devices.regionOf ? devices.regionOf(address) : null;

      out.push({ address: address, hex: hex(address), value: settings.read(address),
        region: region ? region.name : 'unmapped' });
    }
    return out;
  }

  function csrRows(traps) {
    return traps.map(function (row) {
      return { name: row.name, number: hex(row.number, 3), value: row.value,
        hex: hex(row.value) };
    });
  }

  /** A signed and an unsigned reading of the same bits, which is the only
   *  honest way to print a machine word. */
  function both(value) {
    return (value | 0) + ' signed · ' + (value >>> 0) + ' unsigned';
  }

  return { rows: rows, memoryRows: memoryRows, csrRows: csrRows, hex: hex, both: both };
}));
