'use strict';

/**
 * Property tests for the M17 modules, every one against an oracle that cannot
 * share a bug with the thing it is checking.
 *
 * Fixed-width arithmetic is checked against BigInt, which has no width. Bit
 * tricks are checked against the loop that does the same job the obvious way,
 * over all 2^16 low words rather than over a sample - the failures cluster at
 * zero, at powers of two and at the sign bit, which is exactly what a sample
 * of plausible inputs avoids. Bitsets are checked against `Set`. Big integers
 * are checked against BigInt again. Miller-Rabin is checked against a sieve.
 * The generators are checked against a chi-squared threshold in both tails.
 */

const test = require('node:test');
const assert = require('node:assert');

const IntegerOps = require('../../src/js/algorithms/integer-ops.js');
const BitTricks = require('../../src/js/algorithms/bit-tricks.js');
const Bitset = require('../../src/js/algorithms/bitset.js');
const FloatInspect = require('../../src/js/algorithms/float-inspect.js');
const Summation = require('../../src/js/algorithms/summation.js');
const FixedDecimal = require('../../src/js/algorithms/fixed-decimal.js');
const Bignum = require('../../src/js/algorithms/bignum.js');
const NumberTheory = require('../../src/js/algorithms/number-theory.js');
const Prng = require('../../src/js/algorithms/prng.js');
const IdGenerators = require('../../src/js/algorithms/id-generators.js');
const Random = require('../../src/js/utils/random.js');

/* -------------------------------------------------------- 17.1 integer ops */

test('integer-ops: carry and overflow come from the patterns, and disagree', function () {
  const w8 = IntegerOps.width(8, true);

  const carryOnly = IntegerOps.add(255n, 1n, w8);
  assert.strictEqual(carryOnly.carry, true, '0xFF + 0x01 leaves the unsigned range');
  assert.strictEqual(carryOnly.overflow, false, 'and as (−1) + 1 it does not leave the signed one');

  const overflowOnly = IntegerOps.add(127n, 1n, w8);
  assert.strictEqual(overflowOnly.carry, false);
  assert.strictEqual(overflowOnly.overflow, true);

  assert.deepStrictEqual(IntegerOps.add(-1n, 1n, w8).carry, IntegerOps.add(255n, 1n, w8).carry,
    '255n and −1n are the same eight-bit pattern');
});

test('integer-ops: the stored value is the exact result taken modulo the width', function () {
  const rng = Random.seeded(3);
  const widths = [8, 16, 32, 64];

  for (let trial = 0; trial < 5000; trial += 1) {
    const bits = widths[rng.int(widths.length)];
    const signed = rng.int(2) === 1;
    const w = IntegerOps.width(bits, signed);
    const span = 1n << BigInt(bits);
    const a = BigInt(rng.int(1000000)) - 500000n;
    const b = BigInt(rng.int(1000000)) - 500000n;

    ['add', 'sub', 'mul'].forEach(function (name) {
      const got = IntegerOps[name](a, b, w);
      let raw = got.exact % span;
      if (raw < 0n) raw += span;
      const expected = signed && raw >= span / 2n ? raw - span : raw;
      assert.strictEqual(got.value, expected, name + ' at ' + bits + ' bits');
    });
  }
});

test('integer-ops: negation is total unsigned and partial signed', function () {
  [8, 16, 32, 64].forEach(function (bits) {
    const signed = IntegerOps.width(bits, true);
    const asymmetry = IntegerOps.asymmetry(signed);

    assert.strictEqual(asymmetry.negationIsIdentity, true,
      'negating the minimum at ' + bits + ' bits returns the minimum');
    assert.strictEqual(asymmetry.negatives, -signed.min);
    assert.strictEqual(asymmetry.positives, signed.max);
    assert.strictEqual(asymmetry.negatives - asymmetry.positives, 1n,
      'exactly one more negative value than positive');
  });
});

test('integer-ops: dividing the minimum by −1 traps rather than answering', function () {
  const w8 = IntegerOps.width(8, true);
  assert.strictEqual(IntegerOps.div(100n, 0n, w8).trap, 'divide by zero');
  assert.strictEqual(IntegerOps.div(-128n, -1n, w8).trap, 'quotient is not representable');
  assert.strictEqual(IntegerOps.div(100n, 7n, w8).trap, undefined);
});

test('integer-ops: bytes round-trip in their own order and not in the other', function () {
  const w32 = IntegerOps.width(32, false);
  const trip = IntegerOps.endianRoundTrip(0x12345678n, w32);

  assert.deepStrictEqual(trip.little, [0x78, 0x56, 0x34, 0x12]);
  assert.deepStrictEqual(trip.big, [0x12, 0x34, 0x56, 0x78]);
  assert.strictEqual(trip.littleReadAsBig, 0x78563412n);
  assert.strictEqual(trip.agree, false);

  const w8 = IntegerOps.width(8, false);
  assert.strictEqual(IntegerOps.endianRoundTrip(100n, w8).agree, true,
    'a one-byte value round-trips whichever end you start from, which is why the bug survives testing');
});

/* -------------------------------------------------------- 17.2 bit tricks */

test('bit-tricks: every routine agrees with its loop over all 65 536 low words', function () {
  let disagreements = 0;

  for (let x = 0; x < 65536; x += 1) {
    BitTricks.CATALOGUE.forEach(function (trick) {
      if (trick.fast(x)[trick.field] !== trick.slow(x)[trick.field]) disagreements += 1;
    });
  }
  assert.strictEqual(disagreements, 0);
});

test('bit-tricks: and over 40 000 random 32-bit words', function () {
  const rng = Random.seeded(11);
  let disagreements = 0;

  for (let i = 0; i < 40000; i += 1) {
    const x = ((rng.int(65536) << 16) | rng.int(65536)) >>> 0;
    BitTricks.CATALOGUE.forEach(function (trick) {
      if (trick.fast(x)[trick.field] !== trick.slow(x)[trick.field]) disagreements += 1;
    });
  }
  assert.strictEqual(disagreements, 0);
});

test('bit-tricks: the two identities hold, and are stated to allow for zero', function () {
  const rng = Random.seeded(13);

  assert.strictEqual(BitTricks.clearLowestSetBit(0), 0, 'clearing on zero is zero');
  assert.strictEqual(BitTricks.lowestSetBit(0), 0, 'isolating on zero is zero');

  for (let i = 0; i < 20000; i += 1) {
    const x = ((rng.int(65536) << 16) | rng.int(65536)) >>> 0;
    if (x === 0) continue;

    assert.strictEqual(BitTricks.popcountSwar(BitTricks.clearLowestSetBit(x)).count,
      BitTricks.popcountSwar(x).count - 1);
    assert.strictEqual(BitTricks.popcountSwar(BitTricks.lowestSetBit(x)).count, 1);
    assert.strictEqual(BitTricks.lowestSetBit(x), Math.pow(2, BitTricks.ctzDeBruijn(x).index));
  }
});

test('bit-tricks: rounding up to a power of two is guarded at zero', function () {
  assert.strictEqual(BitTricks.nextPowerOfTwoSmear(0).value, 1,
    'the unguarded smear returns 0 here, which is not what a caller sizing a buffer wants');
  assert.strictEqual(BitTricks.nextPowerOfTwoSmear(1).value, 1);
  assert.strictEqual(BitTricks.nextPowerOfTwoSmear(1024).value, 1024, 'a power of two maps to itself');
  assert.strictEqual(BitTricks.nextPowerOfTwoSmear(1025).value, 2048);
});

test('bit-tricks: the De Bruijn table is an exact inverse over all 32 powers of two', function () {
  const seen = new Set();

  for (let i = 0; i < 32; i += 1) {
    const index = BitTricks.ctzDeBruijn(Math.pow(2, i) >>> 0).index;
    assert.strictEqual(index, i);
    seen.add(Math.imul(BitTricks.DE_BRUIJN32, 1 << i) >>> 27);
  }
  assert.strictEqual(seen.size, 32, 'the 32 powers of two must land on 32 distinct slots');
});

/* ----------------------------------------------------------- 17.3 bitsets */

test('bitset: set operations agree with a real Set over randomised populations', function () {
  const rng = Random.seeded(17);
  const universe = 4096;

  for (let trial = 0; trial < 200; trial += 1) {
    const left = [];
    const right = [];
    for (let i = 0; i < 400; i += 1) { left.push(rng.int(universe)); right.push(rng.int(universe)); }

    const leftSet = new Set(left);
    const rightSet = new Set(right);
    const a = Bitset.fromValues(left, universe);
    const b = Bitset.fromValues(right, universe);

    const union = Bitset.fromValues(left, universe).unionWith(b).toArray();
    const meet = Bitset.fromValues(left, universe).intersectWith(b).toArray();
    const difference = Bitset.fromValues(left, universe).differenceWith(b).toArray();

    const expectedUnion = new Set(leftSet);
    rightSet.forEach(function (v) { expectedUnion.add(v); });

    assert.strictEqual(union.length, expectedUnion.size);
    assert.strictEqual(meet.length, Array.from(leftSet).filter(function (v) {
      return rightSet.has(v);
    }).length);
    assert.strictEqual(difference.length, Array.from(leftSet).filter(function (v) {
      return !rightSet.has(v);
    }).length);
    assert.strictEqual(a.size(), leftSet.size);
  }
});

test('bitset: mismatched universes are refused rather than silently truncated', function () {
  const a = Bitset.create(1024);
  const b = Bitset.create(2048);
  assert.throws(function () { a.unionWith(b); }, /universes differ/);
});

test('bitset: iteration visits the population in order, and the scan agrees', function () {
  const rng = Random.seeded(19);
  const universe = 100000;
  const values = [];
  for (let i = 0; i < 500; i += 1) values.push(rng.int(universe));

  const set = Bitset.fromValues(values, universe);
  const walked = [];
  const scanned = [];
  const fast = set.forEachSetBit(function (v) { walked.push(v); });
  const slow = set.forEachByScan(function (v) { scanned.push(v); });

  assert.deepStrictEqual(walked, scanned);
  assert.deepStrictEqual(walked, walked.slice().sort(function (a, b) { return a - b; }));
  assert.strictEqual(walked.length, new Set(values).size);
  assert.ok(fast.steps < slow.steps / 10, 'the walk must cost the population, not the universe');
});

test('bitset: rank and select are inverses on the population', function () {
  const rng = Random.seeded(23);
  const universe = 8192;
  const values = [];
  for (let i = 0; i < 300; i += 1) values.push(rng.int(universe));

  const set = Bitset.fromValues(values, universe);
  const sorted = set.toArray();

  for (let i = 0; i < sorted.length; i += 1) {
    assert.strictEqual(set.select(i), sorted[i], 'select ' + i);
    assert.strictEqual(set.rank(sorted[i]), i, 'rank of the ' + i + 'th set bit');
  }
  assert.strictEqual(set.select(sorted.length), -1, 'selecting past the population returns −1');
});

test('bitset: bitboard attacks agree with a square-by-square walk', function () {
  const cases = [
    { piece: Bitset.kingAttacks, counts: { '0,0': 3, '3,3': 8, '7,7': 3 } },
    { piece: Bitset.knightAttacks, counts: { '0,0': 2, '3,3': 8, '7,7': 2 } }
  ];

  cases.forEach(function (entry) {
    Object.keys(entry.counts).forEach(function (key) {
      const parts = key.split(',');
      const board = Bitset.square(Number(parts[0]), Number(parts[1]));
      assert.strictEqual(Bitset.boardPopcount(entry.piece(board)), entry.counts[key],
        'attacks from ' + key);
    });
  });

  const rook = Bitset.rookAttacks(Bitset.square(3, 3), 0n);
  assert.strictEqual(Bitset.boardPopcount(rook), 14, 'a rook on an empty board sees 14 squares');
});

/* -------------------------------------------------------- 17.4 float inspect */

test('float-inspect: the exact decimal of 0.1 is the value everybody quotes', function () {
  assert.strictEqual(FloatInspect.exactDecimal(0.1),
    '0.1000000000000000055511151231257827021181583404541015625');
  assert.deepStrictEqual(FloatInspect.exactRational(0.1),
    { numerator: 3602879701896397n, denominator: 36028797018963968n });
  assert.strictEqual(FloatInspect.exactDecimal(1.5), '1.5');
  assert.strictEqual(FloatInspect.exactDecimal(Math.pow(2, 70)), '1180591620717411303424');
});

test('float-inspect: nextAfter is correct at the four boundaries', function () {
  const minNormal = FloatInspect.LANDMARKS.minNormal;

  assert.strictEqual(FloatInspect.nextUp(0), 5e-324);
  assert.strictEqual(FloatInspect.nextDown(0), -5e-324);
  assert.strictEqual(FloatInspect.decompose(FloatInspect.nextDown(minNormal)).kind, 'subnormal');
  assert.strictEqual(FloatInspect.nextUp(Number.MAX_VALUE), Infinity);
  assert.ok(Number.isNaN(FloatInspect.nextAfter(NaN, 1)));
  assert.strictEqual(FloatInspect.nextAfter(1, 1), 1);
});

test('float-inspect: the gap below a power of two is half the gap above', function () {
  [1, 2, 1024, Math.pow(2, 52), Math.pow(2, -30)].forEach(function (value) {
    assert.strictEqual(FloatInspect.ulp(value), 2 * FloatInspect.spacingBelow(value),
      'at the power of two ' + value);
  });
  assert.strictEqual(FloatInspect.ulp(0.1), FloatInspect.spacingBelow(0.1),
    'and they are equal away from a power of two');
});

test('float-inspect: the spacing ladder locates 2^53 exactly', function () {
  const ladder = FloatInspect.spacingTable([52, 53, 54]);
  assert.strictEqual(ladder[0].gap, 1);
  assert.strictEqual(ladder[1].gap, 2);
  assert.strictEqual(ladder[2].gap, 4);
  assert.strictEqual(FloatInspect.incrementSurvives(Math.pow(2, 52)), true);
  assert.strictEqual(FloatInspect.incrementSurvives(Math.pow(2, 53)), false);
});

test('float-inspect: the ULP distance is symmetric and counts neighbours as one', function () {
  assert.strictEqual(FloatInspect.ulpsBetween(1, FloatInspect.nextUp(1)), 1n);
  assert.strictEqual(FloatInspect.ulpsBetween(FloatInspect.nextUp(1), 1), 1n);
  assert.strictEqual(FloatInspect.ulpsBetween(0.1 + 0.2, 0.3), 1n);
  assert.strictEqual(FloatInspect.ulpsBetween(1e16 + 1, 1e16), 0n, 'these are the same double');
  assert.strictEqual(FloatInspect.ulpsBetween(0, 5e-324), 1n, 'across zero into the subnormals');
});

/* ---------------------------------------------------------- 17.5 summation */

test('summation: the exact sum is exact, and rounding it is the floor', function () {
  const exact = Summation.exactSum([0.1, 0.2]);
  assert.strictEqual(Summation.toNumber(exact), 0.1 + 0.2);

  const values = [1e16, 1, 1, 1, 1];
  const truth = Summation.exactSum(values);
  assert.strictEqual(Summation.toNumber(truth), 1.0000000000000004e16,
    'four ones survive at a gap of 2 only because the exact sum is rounded, not accumulated');
});

test('summation: compensated methods beat naive on same-signed data by orders of magnitude', function () {
  const rng = Random.seeded(29);
  const values = [1e16];
  for (let i = 0; i < 100000; i += 1) {
    const high = Math.floor(rng.next() * 2097152);
    const low = Math.floor(rng.next() * 4294967296);
    values.push((high * 4294967296 + low) / 9007199254740992);
  }

  const rows = Summation.compare(values);
  const byId = {};
  rows.forEach(function (row) { byId[row.id] = row; });

  assert.ok(byId.naive.relativeError > 1e-12, 'the naive sum must actually be wrong here');
  assert.ok(byId.pairwise.relativeError < byId.naive.relativeError / 1000);
  assert.ok(byId.kahan.relativeError <= byId.pairwise.relativeError);
  assert.strictEqual(byId.kahan.sum, byId.exact.sum,
    'Kahan reaches the double the exact sum rounds to');
  assert.strictEqual(byId.neumaier.sum, byId.exact.sum);
});

test('summation: the naive answer depends on the order and the compensated one barely does', function () {
  const rng = Random.seeded(31);
  const values = [1e16];
  for (let i = 0; i < 50000; i += 1) values.push(1 + rng.next());

  const ascending = values.slice().sort(function (a, b) { return a - b; });
  const descending = ascending.slice().reverse();

  const naive = new Set([Summation.naive(values).sum, Summation.naive(ascending).sum,
    Summation.naive(descending).sum]);
  const kahan = [Summation.kahan(values).sum, Summation.kahan(ascending).sum,
    Summation.kahan(descending).sum];

  assert.ok(naive.size > 1, 'floating-point addition is not associative');
  kahan.forEach(function (value) {
    assert.ok(FloatInspect.ulpsBetween(value, kahan[0]) <= 4n,
      'compensated sums must agree to within a few representable doubles');
  });
});

test('summation: the one-pass variance collapses where Welford does not', function () {
  const rng = Random.seeded(37);
  const values = [];
  for (let i = 0; i < 40000; i += 1) values.push(1e9 + rng.next());

  const rows = Summation.varianceCompare(values);
  const byName = {};
  rows.forEach(function (row) { byName[row.name] = row; });

  assert.ok(byName['sum of squares'].relativeError > 1000,
    'the textbook formula must be catastrophically wrong on this data');
  assert.ok(byName['two pass'].relativeError < 1e-8);
  assert.ok(byName.Welford.relativeError < 1e-5);
  assert.ok(byName.Welford.relativeError > byName['two pass'].relativeError,
    'Welford is the best ONE-PASS method, not the best method');
});

/* ------------------------------------------------------ 17.6 fixed decimal */

test('fixed-decimal: every rounding policy resolves a tie the way it says', function () {
  const answers = {
    'half-even': [2n, 4n], 'half-up': [3n, 4n], 'half-down': [2n, 3n],
    floor: [2n, 3n], ceil: [3n, 4n], truncate: [2n, 3n]
  };

  Object.keys(answers).forEach(function (policy) {
    assert.strictEqual(FixedDecimal.roundQuotient(5n, 2n, policy), answers[policy][0],
      '2.5 under ' + policy);
    assert.strictEqual(FixedDecimal.roundQuotient(7n, 2n, policy), answers[policy][1],
      '3.5 under ' + policy);
  });

  assert.strictEqual(FixedDecimal.roundQuotient(-5n, 2n, 'floor'), -3n);
  assert.strictEqual(FixedDecimal.roundQuotient(-5n, 2n, 'truncate'), -2n,
    'floor and truncate agree on positives and differ on negatives');
});

test('fixed-decimal: scaled integers are exact where doubles are not', function () {
  const money = FixedDecimal.scaled(10, 2, 'half-even');
  let cents = 0n;
  let asDouble = 0;

  for (let i = 0; i < 10; i += 1) { cents = money.add(cents, 10n); asDouble += 0.1; }

  assert.strictEqual(money.toString(cents), '1.00');
  assert.notStrictEqual(asDouble, 1, 'ten tenths as doubles is not one');
  assert.strictEqual(money.toString(money.fromString('-3.27')), '-3.27');
});

test('fixed-decimal: a rational reference is exact and its denominator grows', function () {
  let value = FixedDecimal.rational(0n, 1n);
  for (let i = 1; i <= 50; i += 1) {
    value = FixedDecimal.ratAdd(value, FixedDecimal.rational(1n, BigInt(i)));
  }
  assert.ok(FixedDecimal.ratWidth(value).denominatorBits > 60,
    'the denominator grows without bound, which is why rationals are the oracle and not the ledger');
  assert.ok(Math.abs(FixedDecimal.ratToNumber(value) - 4.4992053) < 1e-6);
});

/* -------------------------------------------------------------- 17.7 bignum */

test('bignum: multiplication, addition and subtraction agree with BigInt', function () {
  const rng = Random.seeded(41);

  for (let trial = 0; trial < 1500; trial += 1) {
    const a = randomBig(rng, 1 + rng.int(300));
    const b = randomBig(rng, 1 + rng.int(200));

    assert.strictEqual(Bignum.toBigInt(Bignum.add(Bignum.fromBigInt(a), Bignum.fromBigInt(b))), a + b);
    assert.strictEqual(Bignum.toBigInt(Bignum.sub(Bignum.fromBigInt(a), Bignum.fromBigInt(b))), a - b);
    assert.strictEqual(Bignum.toBigInt(Bignum.mul(Bignum.fromBigInt(a), Bignum.fromBigInt(b))), a * b);
    assert.strictEqual(Bignum.toBigInt(Bignum.mul(Bignum.fromBigInt(a), Bignum.fromBigInt(b),
      { algorithm: 'karatsuba' })), a * b, 'Karatsuba must agree with schoolbook');
  }
});

function randomBig(rng, bits) {
  let value = 1n;
  for (let i = 1; i < bits; i += 1) value = (value << 1n) | BigInt(rng.int(2));
  return value;
}

test('bignum: division agrees with BigInt, including the short paths', function () {
  const rng = Random.seeded(43);

  for (let trial = 0; trial < 2000; trial += 1) {
    const a = randomBig(rng, 1 + rng.int(400));
    const b = randomBig(rng, 1 + rng.int(400));
    const result = Bignum.div(Bignum.fromBigInt(a), Bignum.fromBigInt(b));

    assert.strictEqual(Bignum.toBigInt(result.quotient), a / b);
    assert.strictEqual(Bignum.toBigInt(result.remainder), a % b);
  }
});

test('bignum: the add-back fixtures reach a branch random inputs do not', function () {
  assert.ok(Bignum.ADD_BACK_FIXTURES.length >= 2);

  Bignum.ADD_BACK_FIXTURES.forEach(function (fixture) {
    const a = Bignum.toBigInt({ sign: 1, limbs: fixture.u });
    const b = Bignum.toBigInt({ sign: 1, limbs: fixture.v });
    const result = Bignum.div(Bignum.fromBigInt(a), Bignum.fromBigInt(b));

    assert.strictEqual(result.addBacks, 1, fixture.label + ' must fire the correction');
    assert.strictEqual(Bignum.toBigInt(result.quotient), a / b);
    assert.strictEqual(Bignum.toBigInt(result.remainder), a % b);
  });
});

test('bignum: Karatsuba does fewer multiplications and more total work at small sizes', function () {
  const rng = Random.seeded(47);
  const a = Bignum.fromBigInt(randomBig(rng, 128));
  const b = Bignum.fromBigInt(randomBig(rng, 128));

  const school = Bignum.counter();
  const kara = Bignum.counter();
  Bignum.mul(a, b, { algorithm: 'schoolbook', stats: school });
  Bignum.mul(a, b, { algorithm: 'karatsuba', stats: kara });

  assert.ok(kara.limbOps < school.limbOps, 'fewer multiplications, which is the flattering column');
  assert.ok(kara.limbOps + kara.adds > school.limbOps + school.adds,
    'and more total limb work at this size, which is the column that gets left out');
});

test('bignum: modPow counts match the exponent, and Montgomery agrees', function () {
  const modulus = 1000000007n;

  [65537n, 65535n, 123456789n].forEach(function (exponent) {
    const plain = Bignum.modPow(3n, exponent, modulus);
    const montgomery = Bignum.montgomeryPow(3n, exponent, modulus);

    assert.strictEqual(plain.value, montgomery.value);
    assert.strictEqual(plain.stats.squarings, exponent.toString(2).length,
      'one squaring per bit');
    assert.strictEqual(plain.stats.multiplications, exponent.toString(2).replace(/0/g, '').length,
      'one multiplication per SET bit, which is what leaks');
  });
});

/* ------------------------------------------------------ 17.8 number theory */

test('number-theory: Miller-Rabin agrees with a sieve to 200 000', function () {
  const limit = 200000;
  const marks = new Uint8Array(limit + 1);
  for (let i = 2; i * i <= limit; i += 1) {
    if (marks[i] === 1) continue;
    for (let j = i * i; j <= limit; j += i) marks[j] = 1;
  }

  let disagreements = 0;
  for (let n = 0; n <= limit; n += 1) {
    const expected = n >= 2 && marks[n] === 0;
    if (NumberTheory.millerRabin(BigInt(n)).prime !== expected) disagreements += 1;
  }
  assert.strictEqual(disagreements, 0);
});

test('number-theory: every Carmichael number fools every coprime Fermat base', function () {
  NumberTheory.CARMICHAEL.slice(0, 6).forEach(function (n) {
    let coprime = 0;
    let passes = 0;

    for (let base = 2n; base < n; base += 1n) {
      const result = NumberTheory.fermatTest(n, base);
      if (result.shared) continue;
      coprime += 1;
      if (result.passes) passes += 1;
    }
    assert.strictEqual(passes, coprime, n + ' must be fooled by every coprime base');
    assert.strictEqual(NumberTheory.millerRabin(n).prime, false,
      'and Miller-Rabin must still reject it');
  });
});

test('number-theory: the two sieves find the same primes at different costs', function () {
  const classic = NumberTheory.sieveEratosthenes(200000);
  const linear = NumberTheory.linearSieve(200000);

  assert.deepStrictEqual(classic.primes, linear.primes);
  assert.ok(linear.writes < classic.writes,
    'the linear sieve marks each composite exactly once');
  assert.deepStrictEqual(NumberTheory.factorBySieve(123456, linear.smallest),
    [2, 2, 2, 2, 2, 2, 3, 643]);
});

test('number-theory: gcd, inverses and CRT hold together', function () {
  const rng = Random.seeded(53);

  for (let trial = 0; trial < 2000; trial += 1) {
    const a = BigInt(1 + rng.int(1000000));
    const b = BigInt(1 + rng.int(1000000));
    const euclid = NumberTheory.gcd(a, b);

    assert.strictEqual(euclid.value, NumberTheory.binaryGcd(a, b).value);
    const extended = NumberTheory.extendedGcd(a, b);
    assert.strictEqual(extended.x * a + extended.y * b, extended.g,
      'Bezout: g must be a combination of a and b');
  }

  const crt = NumberTheory.crt([{ residue: 5n, modulus: 7n }, { residue: 4n, modulus: 11n },
    { residue: 9n, modulus: 13n }]);
  assert.strictEqual(crt.modulus, 1001n);
  assert.strictEqual(crt.value % 7n, 5n);
  assert.strictEqual(NumberTheory.crt([{ residue: 1n, modulus: 4n },
    { residue: 2n, modulus: 6n }]).value, null, 'non-coprime moduli must be refused');
});

test('number-theory: rho finds a factor far faster than trial division on a semiprime', function () {
  const n = 11489279n * 13782077n;
  const rho = NumberTheory.pollardRho(n, { budget: 400000 });
  const trial = NumberTheory.trialDivision(n, 200000);

  assert.ok(rho.factor !== null, 'rho must find a factor');
  assert.strictEqual(n % rho.factor, 0n);
  assert.strictEqual(trial.complete, false, 'trial division must not finish in that budget');
  assert.ok(rho.operations < trial.operations / 50);
});

/* ---------------------------------------------------------------- 17.9 prng */

/**
 * A chi-squared verdict at the 5% level rejects a good generator one run in
 * twenty, and this file checks nine of them - so asserting `passes` directly
 * would fail about half the time for no reason at all. The bound used here is
 * twice the degrees of freedom, which is 5.6 standard deviations at 63 degrees
 * and 10 at 199: far outside anything chance produces, and far inside the
 * effects these tests are about, which are three to five orders of magnitude.
 * The demo keeps the 5% threshold because a reader watching one number wants
 * the conventional one; a suite that must not flake does not.
 */
function farFromPlausible(verdict) {
  return verdict.statistic > 2 * verdict.degrees;
}

test('prng: every generator is plausible on its high bits, and one is far too even', function () {
  const verdicts = {};

  Prng.GENERATORS.forEach(function (entry) {
    const source = Prng.sourceOf(Prng.build(entry.id, 12345), 24);
    const counts = Prng.bucketCounts(source, { buckets: 64, samples: 100000 });
    verdicts[entry.id] = Prng.uniformityVerdict(counts.buckets, 100000);
  });

  assert.strictEqual(verdicts.randu.verdict, 'too even',
    'a full-period generator sweeps every value exactly once, so its counts are impossibly regular');
  assert.ok(verdicts.randu.statistic < 5,
    'and the statistic is near zero rather than near its expectation of 63');

  ['pcg32', 'mt19937', 'splitmix64', 'xorshift128', 'minstd'].forEach(function (id) {
    assert.ok(!farFromPlausible(verdicts[id]),
      id + ' scored ' + verdicts[id].statistic.toFixed(1) + ' over ' + verdicts[id].degrees +
      ' degrees of freedom, which is far outside what chance produces');
  });
});

test('prng: RANDU satisfies its linear identity and nothing else does', function () {
  assert.strictEqual(Prng.lcgPlaneResidual(Prng.build('randu', 1), 2000).holds, true);
  assert.strictEqual(Prng.lcgPlaneResidual(Prng.build('minstd', 1), 500).holds, false);
  assert.strictEqual(Prng.lcgPlaneResidual(Prng.build('pcg32', 1), 500).holds, false);
});

test('prng: the low bits of a power-of-two-modulus LCG have short periods', function () {
  assert.strictEqual(Prng.bitPeriod(Prng.build('randu', 1), 0, 256), 1, 'bit 0 never changes');
  assert.strictEqual(Prng.bitPeriod(Prng.build('numerical-recipes', 1), 0, 256), 2);
  assert.strictEqual(Prng.bitPeriod(Prng.build('numerical-recipes', 1), 3, 256), 16);
  assert.strictEqual(Prng.bitPeriod(Prng.build('pcg32', 1), 0, 256), null,
    'PCG permutes its output, so its low bits have no short period');
});

test('prng: modulo is biased exactly as predicted, and the fixes are not', function () {
  const predicted = Prng.moduloBias(256, 200);
  assert.strictEqual(predicted.favoured, 56);
  assert.strictEqual(predicted.ratio, 2);

  const methods = { modulo: Prng.boundedModulo, rejection: Prng.boundedRejection,
    lemire: Prng.boundedLemire };
  const verdicts = {};

  Object.keys(methods).forEach(function (id) {
    const source = Prng.sourceOf(Prng.build('pcg32', 99), 8);
    const counts = Prng.bucketCounts(source,
      { buckets: 200, samples: 200000, method: methods[id] });
    verdicts[id] = Prng.uniformityVerdict(counts.buckets, 200000);
  });

  assert.ok(verdicts.modulo.statistic > 100 * verdicts.modulo.degrees,
    'the modulo draw must fail by orders of magnitude, not marginally; it scored ' +
    verdicts.modulo.statistic.toFixed(0) + ' over ' + verdicts.modulo.degrees + ' degrees');
  assert.ok(!farFromPlausible(verdicts.rejection),
    'rejection scored ' + verdicts.rejection.statistic.toFixed(1));
  assert.ok(!farFromPlausible(verdicts.lemire),
    'Lemire scored ' + verdicts.lemire.statistic.toFixed(1));
});

test('prng: the naive shuffle cannot be uniform and Fisher-Yates is', function () {
  const correct = Prng.permutationCounts(3,
    { trials: 60000, source: Prng.sourceOf(Prng.build('pcg32', 5)) });
  const naive = Prng.permutationCounts(3,
    { trials: 60000, source: Prng.sourceOf(Prng.build('pcg32', 5)), naive: true });

  const counts = function (rows) { return rows.map(function (r) { return r.count; }); };
  const good = Prng.uniformityVerdict(counts(correct), 60000);
  const bad = Prng.uniformityVerdict(counts(naive), 60000);

  assert.ok(!farFromPlausible(good), 'Fisher-Yates scored ' + good.statistic.toFixed(1));
  assert.ok(bad.statistic > 50 * bad.degrees,
    'the naive shuffle must fail by orders of magnitude; it scored ' + bad.statistic.toFixed(1));
  assert.strictEqual(Math.pow(3, 3) % 6, 3, 'n! does not divide n^n, so the bias is forced');
});

/* --------------------------------------------------------- 17.10 identifiers */

test('id-generators: time-ordered schemes have no cross-millisecond inversions', function () {
  const rows = {};

  ['sequential', 'uuid4', 'uuid7', 'ulid', 'snowflake'].forEach(function (id) {
    const rng = Random.seeded(42);
    let clock = 1700000000000;
    let issued = 0;
    const generator = IdGenerators.build(id, {
      random: function () { return rng.next(); },
      clock: function () { if (issued > 0 && issued % 3 === 0) clock += 1; issued += 1; return clock; },
      epoch: 1700000000000, machine: 7
    });

    const ids = [];
    for (let i = 0; i < 4000; i += 1) ids.push(generator.generate());
    rows[id] = IdGenerators.sortability(ids);
    assert.strictEqual(IdGenerators.uniqueness(ids).duplicates, 0, id + ' must not repeat');
  });

  assert.ok(rows.uuid4.acrossTime > 0, 'a random UUID does not sort by time');
  ['sequential', 'uuid7', 'ulid', 'snowflake'].forEach(function (id) {
    assert.strictEqual(rows[id].acrossTime, 0, id + ' must sort across milliseconds');
  });
  assert.ok(rows.uuid7.withinTime > 0, 'and UUIDv7 must NOT sort within one');
  assert.strictEqual(rows.snowflake.withinTime, 0, 'while Snowflake must');
});

test('id-generators: a random key touches the whole insert window and an ordered one does not', function () {
  function batchFor(id) {
    const rng = Random.seeded(42);
    let clock = 1700000000000;
    let issued = 0;
    const generator = IdGenerators.build(id, {
      random: function () { return rng.next(); },
      clock: function () { if (issued > 0 && issued % 3 === 0) clock += 1; issued += 1; return clock; },
      epoch: 1700000000000, machine: 7
    });
    const ids = [];
    for (let i = 0; i < 8000; i += 1) ids.push(generator.generate());
    return IdGenerators.localitySimulation(ids, { pages: 2048, window: 64 });
  }

  const random = batchFor('uuid4');
  const ordered = batchFor('uuid7');
  const sequential = batchFor('sequential');

  assert.strictEqual(random.peakWorkingSet, 64, 'every insert lands on a different page');
  assert.ok(ordered.peakWorkingSet < 30);
  assert.ok(sequential.switchRate < ordered.switchRate,
    'intra-millisecond randomness costs UUIDv7 some locality against a pure sequence');
});

test('id-generators: a backwards clock never produces a duplicate under either policy', function () {
  ['wait', 'refuse'].forEach(function (policy) {
    let now = 1000;
    const generator = IdGenerators.snowflake({ clock: function () { return now; },
      epoch: 0, machine: 3, onRegression: policy });

    const ids = [];
    for (let i = 0; i < 5; i += 1) { const id = generator.generate(); if (id) ids.push(id); }
    now -= 40;
    for (let i = 0; i < 8; i += 1) { const id = generator.generate(); if (id) ids.push(id); }

    assert.strictEqual(IdGenerators.uniqueness(ids).duplicates, 0, policy + ' must stay unique');
    assert.strictEqual(IdGenerators.sortability(ids).monotonic, true,
      policy + ' must stay monotonic');
    assert.strictEqual(generator.stats().regressions, 1, 'one backwards STEP, counted once');
  });
});

test('id-generators: the sequence ceiling borrows rather than repeating', function () {
  const generator = IdGenerators.snowflake({ clock: function () { return 5000; },
    epoch: 0, machine: 1 });
  const ids = [];
  for (let i = 0; i < 5000; i += 1) ids.push(generator.generate());

  assert.strictEqual(IdGenerators.uniqueness(ids).duplicates, 0);
  assert.strictEqual(ids[4095].sequence, 4095, 'twelve bits is 4 096 per millisecond');
  assert.strictEqual(ids[4096].sequence, 0);
  assert.strictEqual(generator.stats().borrowed, 1, 'borrowing is counted apart from a regression');
  assert.strictEqual(generator.stats().regressions, 0,
    'being ahead of the clock by your own doing is not a clock fault');
});
