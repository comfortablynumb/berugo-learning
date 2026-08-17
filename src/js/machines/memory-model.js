/**
 * MemoryModel - a byte-addressable memory with an access log.
 *
 * Every structure in M02 is built on this rather than on JavaScript objects, so
 * the demos can show real addresses, real strides and the exact bytes an
 * operation touched. "Bytes touched versus bytes needed" is a measurement here,
 * not an illustration.
 *
 * The access log is what M21 and M37 later feed to a cache simulator: the same
 * trace, read by a more detailed model.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MemoryModel = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const TYPES = {
    i8: { bytes: 1, read: 'getInt8', write: 'setInt8' },
    u8: { bytes: 1, read: 'getUint8', write: 'setUint8' },
    i16: { bytes: 2, read: 'getInt16', write: 'setInt16' },
    u16: { bytes: 2, read: 'getUint16', write: 'setUint16' },
    i32: { bytes: 4, read: 'getInt32', write: 'setInt32' },
    u32: { bytes: 4, read: 'getUint32', write: 'setUint32' },
    f32: { bytes: 4, read: 'getFloat32', write: 'setFloat32' },
    f64: { bytes: 8, read: 'getFloat64', write: 'setFloat64' }
  };

  function create(options) {
    const settings = options || {};
    const size = settings.bytes || 64 * 1024;
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);
    const littleEndian = settings.littleEndian !== false;

    let log = [];
    let logging = true;
    const counters = { reads: 0, writes: 0, bytesRead: 0, bytesWritten: 0 };

    function record(kind, address, bytes, label) {
      counters[kind === 'read' ? 'reads' : 'writes'] += 1;
      counters[kind === 'read' ? 'bytesRead' : 'bytesWritten'] += bytes;
      if (logging) log.push({ kind: kind, address: address, bytes: bytes, label: label || '' });
    }

    function checkRange(address, bytes) {
      if (address < 0 || address + bytes > size) {
        throw new RangeError('access outside memory: ' + address + '+' + bytes + ' of ' + size);
      }
    }

    function read(address, type, label) {
      const spec = TYPES[type] || TYPES.i32;
      checkRange(address, spec.bytes);
      record('read', address, spec.bytes, label);
      return spec.bytes === 1 ? view[spec.read](address) : view[spec.read](address, littleEndian);
    }

    function write(address, type, value, label) {
      const spec = TYPES[type] || TYPES.i32;
      checkRange(address, spec.bytes);
      record('write', address, spec.bytes, label);
      if (spec.bytes === 1) view[spec.write](address, value);
      else view[spec.write](address, value, littleEndian);
      return value;
    }

    /** Bulk move, counted as one access per byte moved - what a memcpy costs. */
    function copyWithin(target, source, bytes, label) {
      checkRange(target, bytes);
      checkRange(source, bytes);
      record('read', source, bytes, label || 'copy');
      record('write', target, bytes, label || 'copy');
      new Uint8Array(buffer).copyWithin(target, source, source + bytes);
      return bytes;
    }

    function bytesOf(type) {
      return (TYPES[type] || TYPES.i32).bytes;
    }

    /** Alignment rule: a value of size s must sit at an address divisible by s. */
    function align(address, boundary) {
      const step = boundary || 1;
      return Math.ceil(address / step) * step;
    }

    function isAligned(address, type) {
      return address % bytesOf(type) === 0;
    }

    return {
      bytes: size,
      read: read,
      write: write,
      copyWithin: copyWithin,
      bytesOf: bytesOf,
      align: align,
      isAligned: isAligned,
      raw: function () { return new Uint8Array(buffer); },
      counters: function () { return Object.assign({}, counters); },
      log: function () { return log.slice(); },
      clearLog: function () { log = []; },
      setLogging: function (flag) { logging = Boolean(flag); },
      resetCounters: function () {
        Object.keys(counters).forEach(function (key) { counters[key] = 0; });
      }
    };
  }

  /**
   * A record layout with C-style alignment and padding: fields are placed in
   * declaration order, each aligned to its own size, and the struct is padded
   * to its largest member. Reordering by decreasing size is the free win M39
   * revisits.
   */
  function layout(fields) {
    let offset = 0;
    let widest = 1;
    const placed = fields.map(function (field) {
      const width = (TYPES[field.type] || TYPES.i32).bytes;
      widest = Math.max(widest, width);
      const aligned = Math.ceil(offset / width) * width;
      const padding = aligned - offset;
      offset = aligned + width;
      return { name: field.name, type: field.type, offset: aligned, bytes: width, padding: padding };
    });

    const stride = Math.ceil(offset / widest) * widest;
    const used = placed.reduce(function (sum, field) { return sum + field.bytes; }, 0);

    return { fields: placed, stride: stride, used: used, padding: stride - used, widest: widest };
  }

  /** The same fields ordered widest-first, which is what removes the padding. */
  function packed(fields) {
    const sorted = fields.slice().sort(function (a, b) {
      return (TYPES[b.type] || TYPES.i32).bytes - (TYPES[a.type] || TYPES.i32).bytes;
    });
    return layout(sorted);
  }

  return { create: create, layout: layout, packed: packed, TYPES: TYPES };
}));
