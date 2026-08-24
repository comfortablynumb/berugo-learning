/**
 * DEFLATE: LZ77 and Huffman, in the format everything actually uses.
 *
 * RFC 1951 is the most widely deployed compression format in existence — gzip,
 * zlib, PNG, zip and HTTP Content-Encoding are all this — and it is a
 * deliberately modest design: LZ77 with a 32 KB window, then Huffman coding of
 * the literal/length and distance alphabets. What makes it worth reading is the
 * BLOCK STRUCTURE. Every block independently chooses one of three encodings:
 *
 * - stored: no compression at all, for data that does not compress, so DEFLATE
 *   never expands its input by more than five bytes per 64 KB;
 * - fixed Huffman: a code table baked into the specification, so nothing has to
 *   be transmitted, which wins on short blocks;
 * - dynamic Huffman: a code fitted to this block, transmitted as code LENGTHS
 *   which are themselves run-length and Huffman coded.
 *
 * That third layer is where readers give up, and it is worth following: the
 * lengths are coded with a third alphabet of 19 symbols, whose own lengths are
 * sent as 3-bit fields in a fixed permuted order chosen so the common ones come
 * first and the tail can be truncated.
 *
 * Bit order is the other trap. DEFLATE packs bits into bytes starting at the
 * LEAST significant bit, but Huffman codes are written most-significant-bit
 * first. A decoder that gets one of those backwards produces plausible garbage
 * rather than an error.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Deflate = api;
}(this, function () {
  'use strict';

  const LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59,
    67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3,
    4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DISTANCE_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385,
    513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DISTANCE_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7,
    8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

  /* ---------------------------------------------------------- bit reader */

  /** LSB-first within each byte, which is what the format specifies. */
  function reader(bytes) {
    return { bytes: bytes, at: 0, bit: 0, read: 0 };
  }

  function readBit(state) {
    if (state.at >= state.bytes.length) throw new Error('deflate: input ended mid-stream');
    const bit = (state.bytes[state.at] >> state.bit) & 1;

    state.bit += 1;
    state.read += 1;
    if (state.bit === 8) {
      state.bit = 0;
      state.at += 1;
    }
    return bit;
  }

  /** An n-bit integer, least significant bit first — used for lengths, extra
   *  bits and header fields, but never for a Huffman codeword. */
  function readBits(state, n) {
    let value = 0;

    for (let i = 0; i < n; i += 1) value |= readBit(state) << i;
    return value;
  }

  function alignToByte(state) {
    if (state.bit !== 0) {
      state.bit = 0;
      state.at += 1;
    }
  }

  /* ------------------------------------------------- canonical decoding */

  /**
   * A canonical Huffman decoder built from code lengths, exactly as RFC 1951
   * describes it: count the lengths, find the first code of each length, then
   * assign consecutively in symbol order. Symbols of length zero are absent
   * from the code and must never be assigned one.
   */
  function buildDecoder(lengths) {
    const maximum = lengths.reduce(function (a, b) { return Math.max(a, b); }, 0);
    const countByLength = new Array(maximum + 1).fill(0);

    lengths.forEach(function (length) { if (length > 0) countByLength[length] += 1; });
    const firstCode = new Array(maximum + 2).fill(0);
    let code = 0;

    for (let length = 1; length <= maximum; length += 1) {
      code = (code + countByLength[length - 1]) << 1;
      firstCode[length] = code;
    }
    const table = new Map();
    const next = firstCode.slice();

    lengths.forEach(function (length, symbol) {
      if (length === 0) return;
      table.set(length + ':' + next[length], symbol);
      next[length] += 1;
    });
    return { table: table, maximum: maximum };
  }

  /** Huffman codewords are read most significant bit first, unlike every other
   *  field in the format. */
  function decodeSymbol(state, decoder) {
    let code = 0;

    for (let length = 1; length <= decoder.maximum; length += 1) {
      code = (code << 1) | readBit(state);
      const symbol = decoder.table.get(length + ':' + code);

      if (symbol !== undefined) return symbol;
    }
    throw new Error('deflate: no codeword matched');
  }

  /* ------------------------------------------------------------- decoder */

  const FIXED = fixedTables();

  function fixedTables() {
    const literals = new Array(288).fill(0);

    for (let i = 0; i < 144; i += 1) literals[i] = 8;
    for (let i = 144; i < 256; i += 1) literals[i] = 9;
    for (let i = 256; i < 280; i += 1) literals[i] = 7;
    for (let i = 280; i < 288; i += 1) literals[i] = 8;
    return { literals: buildDecoder(literals), distances: buildDecoder(new Array(30).fill(5)) };
  }

  /** Decode a whole raw DEFLATE stream, reporting what each block was. */
  function inflate(bytes) {
    const state = reader(bytes);
    const out = [];
    const blocks = [];
    let final = 0;

    do {
      final = readBit(state);
      const type = readBits(state, 2);
      const before = out.length;

      if (type === 0) storedBlock(state, out);
      else if (type === 1) huffmanBlock(state, out, FIXED);
      else if (type === 2) huffmanBlock(state, out, dynamicTables(state));
      else throw new Error('deflate: reserved block type');
      blocks.push({ type: type, kind: ['stored', 'fixed', 'dynamic'][type],
        bytes: out.length - before, final: final === 1 });
    } while (!final);
    return { bytes: out, blocks: blocks, bitsRead: state.read };
  }

  function storedBlock(state, out) {
    alignToByte(state);
    const length = readBits(state, 16);
    const complement = readBits(state, 16);

    if ((length ^ 0xffff) !== complement) throw new Error('deflate: stored length check failed');
    for (let i = 0; i < length; i += 1) out.push(readBits(state, 8));
  }

  function huffmanBlock(state, out, tables) {
    for (;;) {
      const symbol = decodeSymbol(state, tables.literals);

      if (symbol < 256) {
        out.push(symbol);
        continue;
      }
      if (symbol === 256) return;
      copyMatch(state, out, tables, symbol - 257);
    }
  }

  /** The overlapping copy: a distance of one and a length of 258 is a run, and
   *  the copy must read bytes it is itself writing. */
  function copyMatch(state, out, tables, index) {
    const length = LENGTH_BASE[index] + readBits(state, LENGTH_EXTRA[index]);
    const distanceCode = decodeSymbol(state, tables.distances);
    const distance = DISTANCE_BASE[distanceCode] + readBits(state, DISTANCE_EXTRA[distanceCode]);

    if (distance > out.length) throw new Error('deflate: distance past the start of the output');
    const from = out.length - distance;

    for (let i = 0; i < length; i += 1) out.push(out[from + i]);
  }

  /**
   * The dynamic header: how many literal, distance and code-length codes are
   * present, then the code-length code's own lengths in a permuted order, then
   * the two real alphabets' lengths coded with it.
   */
  function dynamicTables(state) {
    const literalCount = readBits(state, 5) + 257;
    const distanceCount = readBits(state, 5) + 1;
    const lengthCount = readBits(state, 4) + 4;
    const codeLengths = new Array(19).fill(0);

    for (let i = 0; i < lengthCount; i += 1) {
      codeLengths[CODE_LENGTH_ORDER[i]] = readBits(state, 3);
    }
    const lengthDecoder = buildDecoder(codeLengths);
    const lengths = readCodeLengths(state, lengthDecoder, literalCount + distanceCount);

    return {
      literals: buildDecoder(lengths.slice(0, literalCount)),
      distances: buildDecoder(lengths.slice(literalCount)),
      literalCount: literalCount, distanceCount: distanceCount, lengthCount: lengthCount
    };
  }

  /** 16 repeats the previous length, 17 and 18 are runs of zero. This is the
   *  run-length layer that makes a sparse table cheap. */
  function readCodeLengths(state, decoder, count) {
    const lengths = [];

    while (lengths.length < count) {
      const symbol = decodeSymbol(state, decoder);

      if (symbol < 16) {
        lengths.push(symbol);
      } else if (symbol === 16) {
        const repeat = readBits(state, 2) + 3;
        const previous = lengths[lengths.length - 1];

        for (let i = 0; i < repeat; i += 1) lengths.push(previous);
      } else {
        const repeat = symbol === 17 ? readBits(state, 3) + 3 : readBits(state, 7) + 11;

        for (let i = 0; i < repeat; i += 1) lengths.push(0);
      }
    }
    return lengths;
  }

  /* ------------------------------------------------------------- encoder */

  function writer() {
    return { bytes: [], current: 0, bit: 0 };
  }

  function writeBit(state, bit) {
    state.current |= (bit & 1) << state.bit;
    state.bit += 1;
    if (state.bit === 8) {
      state.bytes.push(state.current);
      state.current = 0;
      state.bit = 0;
    }
  }

  function writeBits(state, value, n) {
    for (let i = 0; i < n; i += 1) writeBit(state, (value >> i) & 1);
  }

  /** A Huffman codeword, most significant bit first. */
  function writeCode(state, code, length) {
    for (let i = length - 1; i >= 0; i -= 1) writeBit(state, (code >> i) & 1);
  }

  function flush(state) {
    if (state.bit > 0) {
      state.bytes.push(state.current);
      state.current = 0;
      state.bit = 0;
    }
    return state.bytes;
  }

  /**
   * A fixed-Huffman encoder over an LZ token stream. It is enough to produce
   * streams the decoder above reads back, and enough to show the block-type
   * decision: a block whose tokens are all literals of high entropy is cheaper
   * stored than coded, and this reports both costs so the choice is visible
   * rather than asserted.
   */
  function deflateFixed(tokens) {
    const state = writer();

    writeBit(state, 1);
    writeBits(state, 1, 2);
    tokens.forEach(function (token) {
      if (token.kind === 'literal') {
        writeFixedLiteral(state, token.value);
        return;
      }
      writeFixedMatch(state, token);
    });
    writeFixedLiteral(state, 256);
    return flush(state);
  }

  function writeFixedLiteral(state, symbol) {
    if (symbol < 144) writeCode(state, 0x30 + symbol, 8);
    else if (symbol < 256) writeCode(state, 0x190 + symbol - 144, 9);
    else if (symbol < 280) writeCode(state, symbol - 256, 7);
    else writeCode(state, 0xc0 + symbol - 280, 8);
  }

  function writeFixedMatch(state, token) {
    const lengthCode = codeFor(LENGTH_BASE, LENGTH_EXTRA, token.length);

    writeFixedLiteral(state, 257 + lengthCode.index);
    writeBits(state, lengthCode.extra, LENGTH_EXTRA[lengthCode.index]);
    const distanceCode = codeFor(DISTANCE_BASE, DISTANCE_EXTRA, token.distance);

    writeCode(state, distanceCode.index, 5);
    writeBits(state, distanceCode.extra, DISTANCE_EXTRA[distanceCode.index]);
  }

  function codeFor(base, extra, value) {
    let index = 0;

    while (index + 1 < base.length && base[index + 1] <= value) index += 1;
    return { index: index, extra: value - base[index] };
  }

  /** A stored block, which is the floor DEFLATE guarantees: five bytes of
   *  overhead per block and never more. */
  function storeBlock(bytes) {
    const out = [0x01, bytes.length & 0xff, (bytes.length >> 8) & 0xff,
      (~bytes.length) & 0xff, ((~bytes.length) >> 8) & 0xff];

    bytes.forEach(function (byte) { out.push(byte); });
    return out;
  }

  /** Which block type is cheapest for this data, measured rather than guessed. */
  function chooseBlock(bytes, tokens) {
    const stored = storeBlock(bytes).length;
    const fixed = deflateFixed(tokens).length;

    return {
      storedBytes: stored, fixedBytes: fixed,
      choice: fixed < stored ? 'fixed' : 'stored',
      overhead: stored - bytes.length
    };
  }

  return {
    LENGTH_BASE: LENGTH_BASE, DISTANCE_BASE: DISTANCE_BASE,
    CODE_LENGTH_ORDER: CODE_LENGTH_ORDER,
    reader: reader, readBit: readBit, readBits: readBits,
    buildDecoder: buildDecoder, decodeSymbol: decodeSymbol,
    inflate: inflate, deflateFixed: deflateFixed, storeBlock: storeBlock,
    chooseBlock: chooseBlock, fixedTables: fixedTables
  };
}));
