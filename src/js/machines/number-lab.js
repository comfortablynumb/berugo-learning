/**
 * NumberLab - the harness for the integer half of M17: widths and overflow,
 * the bit-trick toolkit, and bitsets against the general-purpose set.
 *
 * Three of the four things here compare an implementation against an oracle
 * that cannot be wrong. Bit tricks are checked against the loop that does the
 * same job the obvious way, over every 16-bit input rather than over a sample,
 * because the failures cluster at zero, at powers of two and at the sign bit
 * and a sample skips exactly those. Bitset operations are checked against a
 * `Set`, which has no bugs to share with them. Fixed-width arithmetic is
 * checked against BigInt, which has no width at all.
 *
 * The memory comparison is the one number here that is a *model* rather than a
 * measurement, and it is labelled as one. A JavaScript engine does not expose
 * the size of a `Set`, so `SET_BYTES_PER_ENTRY` states an assumption -
 * 32 bytes for a small-integer entry, being one hash-table slot plus one entry
 * record in V8's OrderedHashSet - and every derived figure carries it. Quoting
 * a memory ratio without stating that constant would be inventing a
 * measurement, so the constant is reported in the result and the section
 * quotes it.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.NumberLab = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Integers = scope && scope.IntegerOps ? scope.IntegerOps
    : require('../algorithms/integer-ops.js');
  const Tricks = scope && scope.BitTricks ? scope.BitTricks
    : require('../algorithms/bit-tricks.js');
  const Bits = scope && scope.Bitset ? scope.Bitset : require('../algorithms/bitset.js');
  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');

  /** One hash slot plus one entry record for a small integer, in V8. Stated
   *  because it cannot be measured from inside the language. */
  const SET_BYTES_PER_ENTRY = 32;

  /* --------------------------------------------------- 17.1 integer widths */

  /**
   * Everything the bit inspector shows for one value at one width: the
   * pattern, the two readings of it, the bytes in both orders, and what the
   * four arithmetic operations do against a second operand.
   */
  function inspect(value, options) {
    const settings = options || {};
    const bits = settings.bits || 32;
    const signed = settings.signed !== false;
    const w = Integers.width(bits, signed);
    const unsigned = Integers.width(bits, false);

    return {
      width: w,
      bits: Integers.bitArray(value, w),
      binary: Integers.bitString(value, w),
      hex: Integers.hexString(value, w),
      signedValue: Integers.wrap(value, Integers.width(bits, true)),
      unsignedValue: Integers.wrap(value, unsigned),
      stored: Integers.wrap(value, w),
      outOfRange: !Integers.inRange(Integers.toBig(value), w),
      endian: Integers.endianRoundTrip(value, w),
      asymmetry: Integers.asymmetry(w)
    };
  }

  const OPERATIONS = [
    { id: 'add', label: 'a + b', run: Integers.add },
    { id: 'sub', label: 'a − b', run: Integers.sub },
    { id: 'mul', label: 'a × b', run: Integers.mul },
    { id: 'div', label: 'a ÷ b', run: Integers.div }
  ];

  /** Every operation under every overflow policy, with the two flags. */
  function arithmeticTable(a, b, options) {
    const settings = options || {};
    const w = Integers.width(settings.bits || 8, settings.signed !== false);
    return OPERATIONS.map(function (operation) {
      const result = operation.run(a, b, w);
      if (result.trap && result.exact === null) {
        return { id: operation.id, label: operation.label, trap: result.trap, exact: null };
      }
      return {
        id: operation.id,
        label: operation.label,
        exact: result.exact,
        carry: result.carry,
        overflow: result.overflow,
        trap: result.trap || null,
        policies: Integers.policies(result.exact, w)
      };
    });
  }

  /** The marks a number wheel wants: zero, the two range ends, and the value. */
  function wheelMarks(bits, value) {
    const signed = Integers.width(bits, true);
    return [
      { pattern: 0n, label: '0', hue: 'gray' },
      { pattern: Integers.pattern(signed.max, signed), label: String(signed.max), hue: 'green' },
      { pattern: Integers.pattern(signed.min, signed), label: String(signed.min), hue: 'red' },
      { pattern: Integers.pattern(value, signed), label: 'value', hue: 'blue' }
    ];
  }

  /**
   * The JavaScript coercion cases worth seeing side by side. Each row is an
   * expression whose value surprises somebody at least once a career.
   */
  function coercionTable() {
    return [
      { expression: '1 << 31', value: 1 << 31, note: 'the shift lands on the sign bit, so int32 reads it as negative' },
      { expression: '(1 << 31) >>> 0', value: (1 << 31) >>> 0, note: 'the only shift that yields uint32' },
      { expression: '1 << 32', value: 1 << 32, note: 'the shift count is taken modulo 32, so this is a shift of 0' },
      { expression: '2147483647 + 1 | 0', value: 2147483647 + 1 | 0, note: 'the addition is a double; the coercion wraps it' },
      { expression: '4294967296 | 0', value: 4294967296 | 0, note: 'ToInt32 wraps rather than clamping or throwing' },
      { expression: '-1 >>> 0', value: -1 >>> 0, note: 'the same 32 bits read unsigned' },
      { expression: '~~3.7', value: ~~3.7, note: 'double negation truncates towards zero, and only to int32' },
      { expression: '(2 ** 53) + 1 === 2 ** 53', value: (Math.pow(2, 53) + 1 === Math.pow(2, 53)), note: 'above 2^53 the gap between doubles is 2, so adding one changes nothing' }
    ];
  }

  /** The two multiplications that disagree, at the size where they start to. */
  function multiplicationDrift(pairs) {
    return pairs.map(function (pair) {
      const found = Integers.multiplyThreeWays(pair[0], pair[1]);
      return {
        a: pair[0], b: pair[1],
        exact: found.exact,
        asDouble: found.asDouble,
        doubleIsExact: found.doubleIsExact,
        imul: found.imul,
        error: found.doubleIsExact ? 0n : found.exact - BigInt(Math.round(found.asDouble))
      };
    });
  }

  /* ------------------------------------------------------- 17.2 bit tricks */

  /**
   * A trick against its loop over every 16-bit input, plus a random sweep of
   * 32-bit ones. `disagreements` is a field rather than an exception: a bit
   * trick fails by returning a plausible number, and a harness that throws on
   * the first mismatch cannot report how many there were.
   */
  function trickAudit(id, options) {
    const settings = options || {};
    const trick = Tricks.trickFor(id);
    const rng = Random.seeded(settings.seed || 1);
    const state = { disagreements: 0, fastOps: 0, slowOps: 0, checked: 0, examples: [],
      fastWorst: 0, slowWorst: 0 };

    for (let x = 0; x < 65536; x += 1) auditOne(trick, x, state);
    for (let i = 0; i < (settings.wideSamples || 20000); i += 1) {
      auditOne(trick, (rng.int(65536) << 16 | rng.int(65536)) >>> 0, state);
    }
    return {
      id: trick.id, label: trick.label,
      checked: state.checked,
      disagreements: state.disagreements,
      examples: state.examples,
      fastOps: state.fastOps, slowOps: state.slowOps,
      fastMean: state.fastOps / state.checked,
      slowMean: state.slowOps / state.checked,
      fastWorst: state.fastWorst, slowWorst: state.slowWorst,
      /* Two savings, because for the data-dependent tricks they point in
         different directions: the mean over random words is what a profile
         reports, and the worst case is what a latency budget has to hold. */
      saving: state.slowOps / Math.max(1, state.fastOps),
      worstSaving: state.slowWorst / Math.max(1, state.fastWorst)
    };
  }

  function auditOne(trick, value, state) {
    const fast = trick.fast(value);
    const slow = trick.slow(value);
    state.checked += 1;
    state.fastOps += fast.ops;
    state.slowOps += slow.ops;
    state.fastWorst = Math.max(state.fastWorst, fast.ops);
    state.slowWorst = Math.max(state.slowWorst, slow.ops);
    if (fast[trick.field] === slow[trick.field]) return;
    state.disagreements += 1;
    if (state.examples.length < 5) {
      state.examples.push({ input: value, fast: fast[trick.field], slow: slow[trick.field] });
    }
  }

  /** Every trick audited at once, which is the table the section leads with. */
  function trickSweep(options) {
    return Tricks.CATALOGUE.map(function (entry) { return trickAudit(entry.id, options); });
  }

  /** The SWAR popcount's stages, as words the bit view can stack. */
  function popcountTrace(value) {
    return Tricks.popcountStages(value).map(function (stage) {
      return { label: stage.label, meaning: stage.meaning, value: stage.value,
        hex: '0x' + (stage.value >>> 0).toString(16).padStart(8, '0') };
    });
  }

  /** The identities the toolkit is built on, each checked rather than quoted. */
  function identityChecks(samples, seed) {
    const rng = Random.seeded(seed || 5);
    const rows = [
      { name: 'x & (x − 1) clears the lowest set bit',
        check: function (x) { return Tricks.popcountSwar(Tricks.clearLowestSetBit(x)).count ===
          Math.max(0, Tricks.popcountSwar(x).count - 1); } },
      { name: 'x & −x isolates the lowest set bit',
        check: function (x) { return x === 0 || Tricks.popcountSwar(Tricks.lowestSetBit(x)).count === 1; } },
      { name: 'ctz(x) is the index of that isolated bit',
        check: function (x) { return x === 0 || Tricks.lowestSetBit(x) === Math.pow(2, Tricks.ctzDeBruijn(x).index); } },
      { name: 'popcount + clz + ctz never exceed 32',
        check: function (x) { return Tricks.popcountSwar(x).count <= 32 && Tricks.clz(x).index <= 32; } },
      { name: 'gray codes of consecutive values differ in one bit',
        check: function (x) { return Tricks.popcountSwar((Tricks.grayEncode(x) ^ Tricks.grayEncode(x + 1)) >>> 0).count === 1; } },
      { name: 'reversing twice is the identity',
        check: function (x) { return Tricks.reverseSwar(Tricks.reverseSwar(x).value).value === (x >>> 0); } },
      /* INT_MIN is excluded because there is no right answer at int32: its
         negation is not representable, so the branchless form wraps back to
         INT_MIN while `Math.abs` leaves int32 entirely and returns a double.
         Stating the exclusion in the row name is the honest move - silently
         skipping it is how a routine ships with one wrong input. */
      { name: 'branchless abs matches Math.abs on int32, except at INT_MIN',
        check: function (x) { return (x | 0) === -2147483648 || Tricks.absBranchless(x | 0) === Math.abs(x | 0); } }
    ];

    return rows.map(function (row) {
      let failures = 0;
      for (let i = 0; i < samples; i += 1) {
        const value = (rng.int(65536) << 16 | rng.int(65536)) >>> 0;
        if (!row.check(value)) failures += 1;
      }
      if (!row.check(0)) failures += 1;
      return { name: row.name, failures: failures, samples: samples + 1 };
    });
  }

  /* ---------------------------------------------------------- 17.3 bitsets */

  /**
   * The sieve of Eratosthenes over a bitset and over a `Set`, with the work
   * counted on both sides. The sieve is the fair comparison because it is
   * dense by construction - which is exactly the regime a bitset wins - and
   * the density sweep below is what shows where it stops winning.
   */
  function sieveComparison(limit) {
    const bitset = Bits.create(limit + 1);
    let bitWrites = 0;
    for (let i = 2; i * i <= limit; i += 1) {
      if (bitset.has(i)) continue;
      for (let j = i * i; j <= limit; j += i) { bitset.add(j); bitWrites += 1; }
    }
    const composite = new Set();
    let setWrites = 0;
    for (let i = 2; i * i <= limit; i += 1) {
      if (composite.has(i)) continue;
      for (let j = i * i; j <= limit; j += i) { composite.add(j); setWrites += 1; }
    }
    return {
      limit: limit,
      primes: limit - 1 - bitset.size(),
      composites: composite.size,
      agree: composite.size === bitset.size(),
      bitsetBytes: bitset.bytes(),
      setBytes: composite.size * SET_BYTES_PER_ENTRY,
      bytesPerEntry: SET_BYTES_PER_ENTRY,
      ratio: (composite.size * SET_BYTES_PER_ENTRY) / bitset.bytes(),
      bitWrites: bitWrites,
      setWrites: setWrites
    };
  }

  /**
   * Where a bitset stops being the right answer. At a fixed universe the
   * bitset's memory is constant and the set's is proportional to the
   * population, so there is a density below which the set is smaller - and it
   * is far lower than most people guess, because a Set entry costs 32 bytes
   * against a bit's one eighth of one.
   */
  function densitySweep(universe, densities) {
    const bitsetBytes = Bits.wordsFor(universe) * 4;
    return densities.map(function (density) {
      const population = Math.round(universe * density);
      const setBytes = population * SET_BYTES_PER_ENTRY;
      return {
        density: density,
        population: population,
        bitsetBytes: bitsetBytes,
        setBytes: setBytes,
        ratio: setBytes / bitsetBytes,
        bitsetWins: setBytes > bitsetBytes
      };
    });
  }

  /** The crossover density, solved rather than searched: the population at
   *  which the two representations cost the same. */
  function crossoverDensity(universe) {
    const bitsetBytes = Bits.wordsFor(universe) * 4;
    const population = bitsetBytes / SET_BYTES_PER_ENTRY;
    return { universe: universe, population: population, density: population / universe,
      bitsetBytes: bitsetBytes, bytesPerEntry: SET_BYTES_PER_ENTRY };
  }

  /**
   * Set operations over a bitset and over a `Set`, on the same two
   * populations. `disagreements` compares the resulting element sets, so a
   * word-loop bug shows as a count rather than as a plausible answer.
   */
  function setOperationRun(options) {
    const settings = options || {};
    const universe = settings.universe || 1000000;
    const rng = Random.seeded(settings.seed || 11);
    const left = buildPair(universe, settings.population || 20000, rng);
    const right = buildPair(universe, settings.population || 20000, rng);

    return ['intersect', 'union', 'difference'].map(function (name) {
      return operationRow(name, left, right, universe);
    });
  }

  function buildPair(universe, population, rng) {
    const values = [];
    const seen = new Set();
    while (values.length < population) {
      const value = rng.int(universe);
      if (seen.has(value)) continue;
      seen.add(value);
      values.push(value);
    }
    return { values: values, set: seen };
  }

  function operationRow(name, left, right, universe) {
    const bitset = Bits.fromValues(left.values, universe);
    const other = Bits.fromValues(right.values, universe);
    if (name === 'intersect') bitset.intersectWith(other);
    if (name === 'union') bitset.unionWith(other);
    if (name === 'difference') bitset.differenceWith(other);

    const reference = referenceOperation(name, left.set, right.set);
    const got = bitset.toArray();
    let disagreements = Math.abs(got.length - reference.size);
    for (let i = 0; i < got.length; i += 1) if (!reference.has(got[i])) disagreements += 1;

    return {
      operation: name,
      size: got.length,
      referenceSize: reference.size,
      disagreements: disagreements,
      wordsTouched: bitset.stats().words,
      setProbes: name === 'union' ? left.set.size + right.set.size : left.set.size
    };
  }

  function referenceOperation(name, left, right) {
    const out = new Set();
    left.forEach(function (value) {
      const inRight = right.has(value);
      if (name === 'intersect' && inRight) out.add(value);
      if (name === 'union') out.add(value);
      if (name === 'difference' && !inRight) out.add(value);
    });
    if (name === 'union') right.forEach(function (value) { out.add(value); });
    return out;
  }

  /**
   * Iterating the population against iterating the universe. The saving is
   * exactly the sparsity, and it is the reason `x & -x` is in every bitset
   * implementation worth using.
   */
  function iterationCost(universe, population, seed) {
    const rng = Random.seeded(seed || 13);
    const values = [];
    for (let i = 0; i < population; i += 1) values.push(rng.int(universe));
    const bitset = Bits.fromValues(values, universe);
    let visited = 0;
    const fast = bitset.forEachSetBit(function () { visited += 1; });
    let scanned = 0;
    const slow = bitset.forEachByScan(function () { scanned += 1; });
    return {
      universe: universe, population: bitset.size(),
      visited: visited, scanned: scanned, agree: visited === scanned,
      fastSteps: fast.steps, slowSteps: slow.steps,
      saving: slow.steps / Math.max(1, fast.steps),
      words: bitset.wordCount()
    };
  }

  /* -------------------------------------------------------------- bitboards */

  const PIECES = [
    { id: 'king', label: 'king', attacks: Bits.kingAttacks, sliding: false },
    { id: 'knight', label: 'knight', attacks: Bits.knightAttacks, sliding: false },
    { id: 'rook', label: 'rook', attacks: Bits.rookAttacks, sliding: true }
  ];

  /** One piece on one square, its attack mask, and the same answer computed by
   *  walking the board square by square. */
  function bitboardScene(options) {
    const settings = options || {};
    const piece = pieceFor(settings.piece || 'knight');
    const board = Bits.square(settings.file || 3, settings.rank || 3);
    const occupancy = occupancyOf(settings.blockers || []);
    const mask = piece.sliding ? piece.attacks(board, occupancy) : piece.attacks(board);
    const reference = referenceAttacks(piece.id, settings, occupancy);

    return {
      piece: piece.id,
      from: { file: settings.file || 3, rank: settings.rank || 3 },
      mask: mask,
      squares: Bits.boardPopcount(mask),
      bits: Bits.boardBits(mask),
      occupancyBits: Bits.boardBits(occupancy),
      disagreements: countDisagreements(mask, reference),
      operations: piece.sliding ? 28 : (piece.id === 'king' ? 6 : 16),
      referenceOperations: 64
    };
  }

  function pieceFor(id) {
    for (let i = 0; i < PIECES.length; i += 1) if (PIECES[i].id === id) return PIECES[i];
    return PIECES[1];
  }

  function occupancyOf(blockers) {
    let board = 0n;
    for (let i = 0; i < blockers.length; i += 1) {
      board |= Bits.square(blockers[i].file, blockers[i].rank);
    }
    return board;
  }

  /** The obvious implementation: try every offset from every square, checking
   *  the board edges by arithmetic on file and rank. */
  function referenceAttacks(id, settings, occupancy) {
    const file = settings.file || 3;
    const rank = settings.rank || 3;
    const offsets = OFFSETS[id];
    let board = 0n;
    for (let i = 0; i < offsets.length; i += 1) {
      board |= walkOffset(offsets[i], { file: file, rank: rank, occupancy: occupancy,
        sliding: id === 'rook' });
    }
    return board;
  }

  const OFFSETS = {
    king: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
    knight: [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]],
    rook: [[1, 0], [-1, 0], [0, 1], [0, -1]]
  };

  function walkOffset(offset, context) {
    let board = 0n;
    let file = context.file + offset[0];
    let rank = context.rank + offset[1];
    while (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
      const square = Bits.square(file, rank);
      board |= square;
      if (!context.sliding || (square & context.occupancy) !== 0n) break;
      file += offset[0];
      rank += offset[1];
    }
    return board;
  }

  function countDisagreements(a, b) {
    return Bits.boardPopcount(a ^ b);
  }

  return {
    SET_BYTES_PER_ENTRY: SET_BYTES_PER_ENTRY,
    OPERATIONS: OPERATIONS,
    PIECES: PIECES,
    inspect: inspect,
    arithmeticTable: arithmeticTable,
    wheelMarks: wheelMarks,
    coercionTable: coercionTable,
    multiplicationDrift: multiplicationDrift,
    trickAudit: trickAudit,
    trickSweep: trickSweep,
    popcountTrace: popcountTrace,
    identityChecks: identityChecks,
    sieveComparison: sieveComparison,
    densitySweep: densitySweep,
    crossoverDensity: crossoverDensity,
    setOperationRun: setOperationRun,
    iterationCost: iterationCost,
    bitboardScene: bitboardScene
  };
}));
