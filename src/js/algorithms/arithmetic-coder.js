/**
 * Arithmetic coding and ANS: spending a fraction of a bit per symbol.
 *
 * Huffman assigns whole bits per symbol and therefore cannot spend 0.0145 bits
 * on a symbol of probability 0.99. Arithmetic coding codes the WHOLE MESSAGE as
 * one number: start with the interval [0, 1), narrow it to the sub-interval the
 * next symbol owns, repeat, and finally emit enough bits to name a point inside
 * what is left. The interval's width is the product of the symbol
 * probabilities, so the bits needed are the sum of −log2(p) — the entropy,
 * exactly, up to two bits of termination.
 *
 * A real implementation cannot hold [0, 1) in a float. This one is the integer
 * version every codec actually uses: a 32-bit low and high, renormalising by
 * shifting out bits whose value has been decided, plus the UNDERFLOW counter
 * that handles the case where low and high straddle the midpoint and converge
 * without agreeing on a leading bit. That counter is where hand-written
 * arithmetic coders go wrong, and dropping it produces a coder that works on
 * most inputs and corrupts some, which is the worst possible failure mode.
 *
 * rANS is the modern alternative: one integer of state, a multiply and a
 * divide per symbol, table-driven, and decoding in REVERSE order because the
 * state is a stack. It gets arithmetic-coding ratios at Huffman-like speed,
 * which is why zstd, LZFSE and JPEG XL all use it.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ArithmeticCoder = api;
}(this, function () {
  'use strict';

  const PRECISION = 16;
  const TOP = (1 << PRECISION) - 1;
  const HALF = 1 << (PRECISION - 1);
  const QUARTER = 1 << (PRECISION - 2);

  /**
   * A static model: cumulative frequencies over an ordered alphabet. The total
   * must stay below 2^14 or the interval arithmetic can round a probability to
   * zero, which makes a symbol uncodeable.
   */
  function model(frequencies, alphabet) {
    const symbols = alphabet.slice();
    const cumulative = [0];
    let total = 0;

    symbols.forEach(function (symbol) {
      total += Math.max(1, frequencies.get(symbol) || 0);
      cumulative.push(total);
    });
    if (total > (1 << 14)) return rescale(frequencies, symbols);
    return { symbols: symbols, cumulative: cumulative, total: total,
      index: indexOf(symbols) };
  }

  function indexOf(symbols) {
    const map = new Map();

    symbols.forEach(function (symbol, i) { map.set(symbol, i); });
    return map;
  }

  /** Scale the counts down so the total fits, keeping every symbol at 1 or more
   *  — a symbol scaled to zero could not be coded at all. */
  function rescale(frequencies, symbols) {
    let total = 0;

    frequencies.forEach(function (count) { total += count; });
    const factor = (1 << 14) / (total + symbols.length);
    const cumulative = [0];
    let running = 0;

    symbols.forEach(function (symbol) {
      running += Math.max(1, Math.floor((frequencies.get(symbol) || 0) * factor));
      cumulative.push(running);
    });
    return { symbols: symbols, cumulative: cumulative, total: running,
      index: indexOf(symbols), rescaled: true };
  }

  /* ------------------------------------------------------------- encoding */

  function encode(symbols, m) {
    const state = { low: 0, high: TOP, pending: 0, bits: [], maxPending: 0 };

    for (let i = 0; i < symbols.length; i += 1) {
      const at = m.index.get(symbols[i]);

      if (at === undefined) throw new Error('arithmetic: symbol outside the model');
      narrow(state, m, at);
      renormalise(state);
    }
    finish(state);
    return { bits: state.bits.join(''), length: state.bits.length,
      maxPending: state.maxPending, symbols: symbols.length };
  }

  function narrow(state, m, at) {
    const range = state.high - state.low + 1;

    state.high = state.low + Math.floor(range * m.cumulative[at + 1] / m.total) - 1;
    state.low = state.low + Math.floor(range * m.cumulative[at] / m.total);
  }

  /**
   * Shift out the bits both ends agree on. The third case is the underflow one:
   * low is above a quarter and high below three quarters, so the interval
   * straddles the midpoint and neither end has decided its leading bit. The fix
   * is to remember that a bit is owed and emit its opposite later.
   */
  function renormalise(state) {
    for (;;) {
      if (state.high < HALF) {
        emit(state, 0);
      } else if (state.low >= HALF) {
        emit(state, 1);
        state.low -= HALF;
        state.high -= HALF;
      } else if (state.low >= QUARTER && state.high < 3 * QUARTER) {
        state.pending += 1;
        state.maxPending = Math.max(state.maxPending, state.pending);
        state.low -= QUARTER;
        state.high -= QUARTER;
      } else {
        return;
      }
      state.low = (state.low << 1) & TOP;
      state.high = ((state.high << 1) | 1) & TOP;
    }
  }

  function emit(state, bit) {
    state.bits.push(String(bit));
    while (state.pending > 0) {
      state.bits.push(String(1 - bit));
      state.pending -= 1;
    }
  }

  /** Two bits are enough to name a point inside any surviving interval. */
  function finish(state) {
    state.pending += 1;
    emit(state, state.low < QUARTER ? 0 : 1);
  }

  /* ------------------------------------------------------------- decoding */

  function decode(bits, m, count) {
    const reader = { bits: bits, at: 0 };
    const state = { low: 0, high: TOP, value: 0 };

    for (let i = 0; i < PRECISION; i += 1) {
      state.value = (state.value << 1) | readBit(reader);
    }
    const out = [];

    while (out.length < count) {
      const at = symbolAt(state, m);

      out.push(m.symbols[at]);
      narrow(state, m, at);
      renormaliseDecoder(state, reader);
    }
    return out;
  }

  function symbolAt(state, m) {
    const range = state.high - state.low + 1;
    const scaled = Math.floor(((state.value - state.low + 1) * m.total - 1) / range);
    let at = 0;

    while (m.cumulative[at + 1] <= scaled) at += 1;
    return at;
  }

  function renormaliseDecoder(state, reader) {
    for (;;) {
      if (state.high < HALF) {
        // nothing to subtract
      } else if (state.low >= HALF) {
        state.low -= HALF;
        state.high -= HALF;
        state.value -= HALF;
      } else if (state.low >= QUARTER && state.high < 3 * QUARTER) {
        state.low -= QUARTER;
        state.high -= QUARTER;
        state.value -= QUARTER;
      } else {
        return;
      }
      state.low = (state.low << 1) & TOP;
      state.high = ((state.high << 1) | 1) & TOP;
      state.value = ((state.value << 1) | readBit(reader)) & TOP;
    }
  }

  function readBit(reader) {
    const bit = reader.at < reader.bits.length ? reader.bits.charCodeAt(reader.at) - 48 : 0;

    reader.at += 1;
    return bit;
  }

  /* ----------------------------------------------------------------- rANS */

  const RANS_LOWER = 1 << 16;
  const RANS_BASE = 256;

  /**
   * rANS needs the frequency total to be a power of two, so the slot lookup is
   * a mask and the division a shift. Normalising to 2^scaleBits is therefore
   * part of the codec rather than a convenience: counts are scaled, every
   * symbol is held at 1 or more, and the rounding error is pushed onto the most
   * frequent symbol so the total lands exactly on 2^scaleBits.
   */
  function ransModel(frequencies, alphabet, scaleBits) {
    const bits = scaleBits === undefined ? 12 : scaleBits;
    const target = 1 << bits;
    const symbols = alphabet.slice();

    if (symbols.length > target) throw new Error('rans: alphabet larger than the frequency total');
    let total = 0;

    symbols.forEach(function (symbol) { total += Math.max(1, frequencies.get(symbol) || 0); });
    const scaled = symbols.map(function (symbol) {
      const count = Math.max(1, frequencies.get(symbol) || 0);

      return Math.max(1, Math.floor(count * target / total));
    });

    return finishRansModel(symbols, scaled, bits);
  }

  /** Push the rounding slack onto the largest count, so the total is exact. */
  function finishRansModel(symbols, scaled, bits) {
    const target = 1 << bits;
    let sum = scaled.reduce(function (a, b) { return a + b; }, 0);
    let largest = 0;

    scaled.forEach(function (count, i) { if (count > scaled[largest]) largest = i; });
    scaled[largest] += target - sum;
    while (scaled[largest] < 1) {
      let donor = 0;

      scaled.forEach(function (count, i) { if (count > scaled[donor]) donor = i; });
      scaled[donor] -= 1;
      scaled[largest] += 1;
    }
    const cumulative = [0];

    sum = 0;
    scaled.forEach(function (count) {
      sum += count;
      cumulative.push(sum);
    });
    return { symbols: symbols, cumulative: cumulative, total: target, scaleBits: bits,
      index: indexOf(symbols) };
  }

  /**
   * Encoding runs the message BACKWARDS, because the state is a stack: each
   * symbol is pushed onto x, and the decoder pops them in the order they were
   * pushed. That is not an implementation quirk to hide - it is why an ANS
   * encoder buffers the message and why its output is read from the far end.
   */
  function ransEncode(symbols, m) {
    const out = [];
    let x = RANS_LOWER;

    for (let i = symbols.length - 1; i >= 0; i -= 1) {
      const at = m.index.get(symbols[i]);

      if (at === undefined) throw new Error('rans: symbol outside the model');
      const frequency = m.cumulative[at + 1] - m.cumulative[at];
      const max = (RANS_LOWER / m.total) * RANS_BASE * frequency;

      while (x >= max) {
        out.push(x % RANS_BASE);
        x = Math.floor(x / RANS_BASE);
      }
      x = Math.floor(x / frequency) * m.total + (x % frequency) + m.cumulative[at];
    }
    out.reverse();
    return { state: x, bytes: out, symbols: symbols.length, bits: out.length * 8 + 32 };
  }

  function ransDecode(encoded, m, count) {
    const bytes = encoded.bytes;
    let x = encoded.state;
    let at = 0;
    const out = [];

    while (out.length < count) {
      const slot = x % m.total;
      const symbol = ransSlot(m, slot);
      const frequency = m.cumulative[symbol + 1] - m.cumulative[symbol];

      out.push(m.symbols[symbol]);
      x = frequency * Math.floor(x / m.total) + slot - m.cumulative[symbol];
      while (x < RANS_LOWER && at < bytes.length) {
        x = x * RANS_BASE + bytes[at];
        at += 1;
      }
    }
    return out;
  }

  /** Binary search over the cumulative table: a real tANS replaces this with a
   *  lookup table of size 2^scaleBits, which is where its speed comes from. */
  function ransSlot(m, slot) {
    let low = 0;
    let high = m.symbols.length - 1;

    while (low < high) {
      const middle = (low + high + 1) >> 1;

      if (m.cumulative[middle] <= slot) low = middle;
      else high = middle - 1;
    }
    return low;
  }

  /** The information-theoretic cost of a message under a model, in bits: the
   *  number an arithmetic coder gets to within about two bits total. */
  function idealBits(symbols, m) {
    let bits = 0;

    for (let i = 0; i < symbols.length; i += 1) {
      const at = m.index.get(symbols[i]);
      const frequency = m.cumulative[at + 1] - m.cumulative[at];

      bits -= Math.log2(frequency / m.total);
    }
    return bits;
  }

  /**
   * An adaptive model: counts start at one and rise as symbols are seen, so
   * encoder and decoder stay in step without transmitting a table at all. The
   * cost is that early symbols are coded under a bad model, which is the
   * learning curve every adaptive codec pays.
   */
  function adaptiveModel(alphabet) {
    const frequencies = new Map();

    alphabet.forEach(function (symbol) { frequencies.set(symbol, 1); });
    return {
      alphabet: alphabet.slice(),
      frequencies: frequencies,
      snapshot: function () { return model(frequencies, alphabet); },
      observe: function (symbol) {
        frequencies.set(symbol, (frequencies.get(symbol) || 0) + 1);
      }
    };
  }

  /** Code a message under an adaptive model, reporting bits only - the point is
   *  the cost curve, and the round-trip is proved by the static coder. */
  function adaptiveCost(symbols, alphabet) {
    const adaptive = adaptiveModel(alphabet);
    let bits = 0;
    const curve = [];

    for (let i = 0; i < symbols.length; i += 1) {
      const m = adaptive.snapshot();
      const at = m.index.get(symbols[i]);
      const frequency = m.cumulative[at + 1] - m.cumulative[at];

      bits -= Math.log2(frequency / m.total);
      adaptive.observe(symbols[i]);
      if (i % Math.max(1, Math.floor(symbols.length / 32)) === 0) {
        curve.push({ at: i, bitsPerSymbol: bits / (i + 1) });
      }
    }
    return { bits: bits, bitsPerSymbol: symbols.length ? bits / symbols.length : 0,
      curve: curve };
  }

  return {
    PRECISION: PRECISION, model: model, encode: encode, decode: decode,
    ransModel: ransModel, ransEncode: ransEncode, ransDecode: ransDecode,
    idealBits: idealBits, adaptiveModel: adaptiveModel, adaptiveCost: adaptiveCost
  };
}));
