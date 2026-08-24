/**
 * The columnar bench: what knowing the column type is worth.
 *
 * Every study here runs the same encodings over columns that differ only in a
 * property a general-purpose compressor cannot see — whether the values are
 * sorted, how many distinct ones there are, how many mantissa bits actually
 * move. The single finding the whole section is arranged around is that
 * SORTING the column is usually worth more than the encoding choice, and it is
 * measured as a ratio between two runs of the identical encoder rather than
 * asserted.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ColumnarLab = api;
}(this, function (root) {
  'use strict';

  const Codecs = root && root.IntegerCodecs ? root.IntegerCodecs
    : require('../algorithms/integer-codecs.js');
  const Random = root && root.Random ? root.Random : require('../utils/random.js');

  /* ------------------------------------------------------------- columns */

  /** Four integer columns with different shapes, so the ranking changes. */
  function columns(options) {
    const settings = options || {};
    const count = settings.count === undefined ? 2000 : settings.count;
    const seed = settings.seed === undefined ? 11 : settings.seed;

    return [
      { name: 'timestamps (sorted)', values: timestamps(count, seed),
        note: 'monotone, small gaps: delta turns large numbers into tiny ones' },
      { name: 'timestamps (shuffled)', values: shuffle(timestamps(count, seed), seed + 1),
        note: 'the same values in a different order — the only thing that changed' },
      { name: 'ids (sparse, sorted)', values: sparseIds(count, seed),
        note: 'sorted but with large gaps: delta helps, bit-packing less so' },
      { name: 'measurements (unsorted)', values: measurements(count, seed),
        note: 'a bounded range with no order: frame-of-reference is the fit' }
    ];
  }

  function timestamps(count, seed) {
    const rng = Random.seeded(seed);
    const out = [];
    let at = 1700000000;

    for (let i = 0; i < count; i += 1) {
      at += 1 + Math.floor(rng.next() * 4);
      out.push(at);
    }
    return out;
  }

  function sparseIds(count, seed) {
    const rng = Random.seeded(seed + 7);
    const out = [];
    let at = 0;

    for (let i = 0; i < count; i += 1) {
      at += 1 + Math.floor(rng.next() * 5000);
      out.push(at);
    }
    return out;
  }

  function measurements(count, seed) {
    const rng = Random.seeded(seed + 13);
    const out = [];

    for (let i = 0; i < count; i += 1) out.push(90000 + Math.floor(rng.next() * 400));
    return out;
  }

  function shuffle(values, seed) {
    const rng = Random.seeded(seed);
    const out = values.slice();

    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      const held = out[i];

      out[i] = out[j];
      out[j] = held;
    }
    return out;
  }

  /* ------------------------------------------------------------ encodings */

  const ENCODINGS = [
    { name: 'raw 64-bit', run: function (values) {
      return { bytes: values.length * 8 };
    }, note: 'the baseline every other row is measured against' },
    { name: 'varint', run: function (values) { return Codecs.varint(values); },
      note: 'seven payload bits per byte: only helps if the values are small' },
    { name: 'delta + varint', run: function (values) {
      return Codecs.varint(Codecs.delta(values).map(Codecs.zigzag));
    }, note: 'the gaps are small when the column is sorted, and not otherwise' },
    { name: 'delta + bit-packed', run: function (values) {
      return Codecs.bitPack(Codecs.delta(values).map(Codecs.zigzag));
    }, note: 'one width for the whole column: a single outlier costs everything' },
    { name: 'delta + frame-of-reference', run: function (values) {
      return Codecs.frameOfReference(Codecs.delta(values).map(Codecs.zigzag), 128);
    }, note: 'a width per 128-value block, so an outlier costs one block' },
    { name: 'delta + Simple-8b', run: function (values) {
      return Codecs.simple8b(Codecs.delta(values).map(Codecs.zigzag));
    }, note: 'a width per 64-bit word: the outlier costs one word' }
  ];

  /** Every encoding on every column, with the round-trip of the delta chain
   *  checked so a size is never reported for something that cannot be read. */
  function integerStudy(options) {
    return columns(options).map(function (column) {
      const raw = column.values.length * 8;
      const restored = Codecs.undelta(Codecs.delta(column.values));

      return {
        column: column.name, note: column.note, values: column.values.length,
        rawBytes: raw,
        roundTrip: restored.join(',') === column.values.join(','),
        rows: ENCODINGS.map(function (encoding) {
          const result = encoding.run(column.values);

          return { name: encoding.name, note: encoding.note, bytes: result.bytes,
            ratio: raw / Math.max(1, result.bytes),
            bitsPerValue: result.bytes * 8 / column.values.length };
        })
      };
    });
  }

  /**
   * The sorting comparison, stated as one number per encoding: the same values,
   * the same encoder, sorted and shuffled. Anything above one is what sorting
   * bought, and on a delta-based encoding it is a factor rather than a
   * percentage.
   */
  function sortingStudy(options) {
    const settings = options || {};
    const values = timestamps(settings.count === undefined ? 2000 : settings.count,
      settings.seed === undefined ? 11 : settings.seed);
    const shuffled = shuffle(values, 99);

    return {
      values: values.length,
      rows: ENCODINGS.map(function (encoding) {
        const sortedBytes = encoding.run(values).bytes;
        const shuffledBytes = encoding.run(shuffled).bytes;

        return { name: encoding.name, sortedBytes: sortedBytes, shuffledBytes: shuffledBytes,
          gain: shuffledBytes / Math.max(1, sortedBytes) };
      })
    };
  }

  /** Dictionary and run-length coding against cardinality, with and without a
   *  sort — the pair of levers a columnar writer actually has. */
  function cardinalityStudy(options) {
    const settings = options || {};
    const count = settings.count === undefined ? 4000 : settings.count;
    const cardinalities = settings.cardinalities || [2, 8, 64, 512, 4000];
    const rng = Random.seeded(settings.seed === undefined ? 5 : settings.seed);

    return cardinalities.map(function (cardinality) {
      const values = [];

      for (let i = 0; i < count; i += 1) {
        values.push('value-' + Math.floor(rng.next() * cardinality));
      }
      const sorted = values.slice().sort();
      const dictionary = Codecs.dictionary(values);

      return {
        cardinality: cardinality, values: count,
        rawBytes: count * 12,
        dictionaryBytes: dictionary.bytes, width: dictionary.width,
        runsUnsorted: Codecs.runLength(values).runs,
        runsSorted: Codecs.runLength(sorted).runs,
        rleUnsortedBytes: Codecs.runLength(Codecs.dictionary(values).codes).bytes,
        rleSortedBytes: Codecs.runLength(Codecs.dictionary(sorted).codes).bytes
      };
    });
  }

  /* ------------------------------------------------------------- Gorilla */

  /**
   * Gorilla against how much of the mantissa actually moves. A metric stored at
   * full double precision compresses badly and the SAME metric rounded to the
   * precision it is really measured at compresses an order of magnitude better,
   * because the XOR window collapses. That is the finding, and it is a fact
   * about the representation rather than about the encoder.
   */
  function floatStudy(options) {
    const settings = options || {};
    const count = settings.count === undefined ? 2000 : settings.count;
    const series = [
      { name: 'random walk, full precision', values: walk(count, 0.05, null, 21),
        note: 'every mantissa bit moves: the XOR window is wide' },
      { name: 'rounded to 0.1', values: walk(count, 0.05, 0.1, 21),
        note: 'the precision the metric is actually measured at' },
      { name: 'rounded to 1', values: walk(count, 0.05, 1, 21),
        note: 'a gauge that only ever reports whole units' },
      { name: 'monotone counter', values: counter(count),
        note: 'the XOR is the increment, and it repeats' },
      { name: 'constant', values: new Array(count).fill(42),
        note: 'every XOR is zero: one control bit per value' },
      { name: 'uniform noise', values: noise(count, 33),
        note: 'the worst case, and it is reported rather than omitted' }
    ];

    return series.map(function (entry) {
      const encoded = Codecs.gorilla(entry.values);
      const restored = Codecs.gorillaRoundTrip(entry.values);

      return {
        name: entry.name, note: entry.note, values: entry.values.length,
        rawBytes: entry.values.length * 8, bytes: encoded.bytes,
        bitsPerValue: encoded.bits / entry.values.length,
        ratio: encoded.ratio,
        exact: restored.every(function (value, i) { return value === entry.values[i]; })
      };
    });
  }

  function walk(count, step, round, seed) {
    const rng = Random.seeded(seed);
    const out = [];
    let at = 72.5;

    for (let i = 0; i < count; i += 1) {
      at += (rng.next() - 0.5) * step;
      out.push(round ? Math.round(at / round) * round : at);
    }
    return out;
  }

  function counter(count) {
    const out = [];

    for (let i = 0; i < count; i += 1) out.push(i * 1);
    return out;
  }

  function noise(count, seed) {
    const rng = Random.seeded(seed);
    const out = [];

    for (let i = 0; i < count; i += 1) out.push(rng.next() * 1000);
    return out;
  }

  return {
    ENCODINGS: ENCODINGS, columns: columns,
    integerStudy: integerStudy, sortingStudy: sortingStudy,
    cardinalityStudy: cardinalityStudy, floatStudy: floatStudy
  };
}));
