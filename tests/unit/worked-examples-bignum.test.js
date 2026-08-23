'use strict';

/**
 * Every figure the M17.7-M17.10 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * Wall-clock figures are deliberately NOT asserted. The crossover table in the
 * demo carries three columns and only two of them are reproducible on another
 * machine; a test that pinned the timings would fail on hardware rather than on
 * a regression. What is asserted is the ORDER the columns cross in, which is
 * the claim the section actually makes.
 */

const test = require('node:test');
const assert = require('node:assert');

const Bignum = require('../../src/js/algorithms/bignum.js');
const NumberTheory = require('../../src/js/algorithms/number-theory.js');
const Prng = require('../../src/js/algorithms/prng.js');
const IdGenerators = require('../../src/js/algorithms/id-generators.js');
const BignumLab = require('../../src/js/machines/bignum-lab.js');
const EntropyLab = require('../../src/js/machines/entropy-lab.js');

require('../../src/js/content/concepts-bignum.js');
require('../../src/js/content/examples-bignum.js');
require('../../src/js/content/concepts-entropy.js');
require('../../src/js/content/examples-entropy.js');
const prose = require('../support/worked-example-prose.js');

/* ------------------------------------------------------------------- 17.7 */

const SWEEP = BignumLab.crossoverSweep({ sizes: [64, 128, 256, 512, 1024, 2048, 4096], runs: 3 });

function sizeRow(bits) {
  for (let i = 0; i < SWEEP.length; i += 1) {
    if (SWEEP[i].bits === bits) return SWEEP[i];
  }
  throw new Error('no size ' + bits);
}

test('arbitrary precision: the three columns cross at three different sizes', function () {
  assert.strictEqual(sizeRow(128).schoolbookOps, 64);
  assert.strictEqual(sizeRow(128).karatsubaOps, 52);
  assert.ok(sizeRow(128).opsRatio > 1, 'multiplications cross at 128 bits');
  assert.ok(sizeRow(128).totalRatio < 1, 'and total limb work does not');

  assert.strictEqual(sizeRow(2048).schoolbookTotal, 16384);
  assert.strictEqual(sizeRow(2048).karatsubaTotal, 15977);
  assert.ok(sizeRow(2048).totalRatio > 1, 'total limb work crosses at 2 048 bits');
  assert.ok(sizeRow(1024).totalRatio < 1, 'and not at 1 024');

  prose.quotes('arbitrary-precision', ['128 bits', '2 048', '64', '52', '16 384', '15 977']);
});

test('arbitrary precision: the multiplication counts at the ends of the sweep', function () {
  assert.strictEqual(sizeRow(4096).schoolbookOps, 65536);
  assert.strictEqual(sizeRow(4096).karatsubaOps, 13834);
  assert.strictEqual(sizeRow(4096).karatsubaTotal, 49374);
  assert.strictEqual(sizeRow(4096).opsRatio.toFixed(2), '4.74');
  assert.strictEqual(sizeRow(4096).limbs, 256);
  assert.strictEqual(sizeRow(512).opsRatio.toFixed(2), '1.97');

  prose.quotes('arbitrary-precision', ['65 536', '13 834', '4.74×', '1.97×']);
});

test('arbitrary precision: the base leaves the headroom the prose claims', function () {
  assert.strictEqual(Bignum.BASE, 65536);
  assert.strictEqual(Math.pow(Bignum.BASE, 2), Math.pow(2, 32));
  assert.strictEqual(53 - 32, 21, 'twenty-one bits of headroom below 2^53');

  const trace = BignumLab.limbTrace(123456789, 987654321);
  assert.strictEqual(trace.product, 121932631112635269n);
  assert.strictEqual(trace.product, trace.expected);
  assert.strictEqual(trace.left.length, 2);

  prose.quotes('arbitrary-precision',
    ['2¹⁶', '2³²', '21 bits', '121 932 631 112 635 269', '65 536']);
});

test('arbitrary precision: the add-back rate and the fixtures that force it', function () {
  const search = BignumLab.addBackSearch({ budget: 200000 });

  assert.strictEqual(search.quotientDigits, 500034);
  assert.strictEqual(search.addBacks, 1);
  assert.strictEqual(search.wrong, 0);
  assert.strictEqual(search.ratePerDigit.toExponential(2), '2.00e-6');
  assert.strictEqual(search.knuthEstimate.toExponential(2), '3.05e-5');

  assert.strictEqual(search.fixtures.length, 2);
  search.fixtures.forEach(function (fixture) {
    assert.strictEqual(fixture.addBacks, 1, fixture.label);
    assert.strictEqual(fixture.quotientCorrect, true);
    assert.strictEqual(fixture.remainderCorrect, true);
  });

  prose.quotes('arbitrary-precision', ['500 034', '2.00e-6', '3.05e-5']);
});

test('arbitrary precision: division agrees with BigInt over 4 000 randomised operands', function () {
  const audit = BignumLab.divisionAudit({ trials: 4000 });

  assert.strictEqual(audit.trials, 4000);
  assert.strictEqual(audit.wrongQuotients, 0);
  assert.strictEqual(audit.wrongRemainders, 0);

  prose.quotes('arbitrary-precision', ['4 000']);
});

test('arbitrary precision: modPow counts name the exponent, which is what leaks', function () {
  const public65537 = BignumLab.modPowRun({ exponent: 65537 });
  const wide = BignumLab.modPowRun({ exponent: 131071 });
  const ordinary = BignumLab.modPowRun({ exponent: 123456789 });

  assert.strictEqual(public65537.exponentBits, 17);
  assert.strictEqual(public65537.setBits, 2);
  assert.strictEqual(public65537.plain.squarings, 17);
  assert.strictEqual(public65537.plain.multiplications, 2);

  assert.strictEqual(wide.exponentBits, 17, 'the same width');
  assert.strictEqual(wide.setBits, 17, 'and every bit set');
  assert.strictEqual(wide.plain.squarings, 17, 'so the same squaring count');
  assert.strictEqual(wide.plain.multiplications, 17, 'and eight and a half times as many multiplications');

  assert.strictEqual(ordinary.plain.squarings, 27);
  assert.strictEqual(ordinary.plain.multiplications, 16);
  [public65537, wide, ordinary].forEach(function (run) {
    assert.strictEqual(run.agree, true, 'Montgomery form must agree');
    assert.strictEqual(run.squaringsMatchBits, true);
    assert.strictEqual(run.multipliesMatchPopcount, true);
  });

  prose.quotes('arbitrary-precision', ['65 537', '131 071', '17 squarings', '2 multiplications']);
  prose.quotes('modular-arithmetic', ['27 squarings', '16 multiplications']);
});

/* ------------------------------------------------------------------- 17.8 */

test('modular arithmetic: every Carmichael number is fooled by every coprime base', function () {
  const rows = BignumLab.primalityTable({});

  assert.strictEqual(rows.length, 8);
  rows.forEach(function (row) {
    assert.strictEqual(row.fermatPasses, row.coprimeBases, String(row.n) + ' must be fooled 100%');
    assert.strictEqual(row.fermatFoolRate, 1);
    assert.strictEqual(row.millerSaysPrime, false);
    assert.strictEqual(row.millerWitness, 2n, 'base 2 alone catches all eight');
    assert.strictEqual(row.factors.length, 3, 'Korselt: a product of three distinct primes');
  });

  assert.strictEqual(rows[0].coprimeBases, 319);
  assert.strictEqual(rows[1].coprimeBases, 767);
  assert.strictEqual(rows[2].coprimeBases, 1295);

  prose.quotes('modular-arithmetic',
    ['319 of 319', '767 of 767', '1 295 of 1 295', '100.0%', '3 × 11 × 17']);
});

test('modular arithmetic: the witness trail for 561 is the sequence the prose shows', function () {
  const trail = BignumLab.millerRabinTrail(561n);

  assert.strictEqual(trail.prime, false);
  assert.strictEqual(trail.witness, 2n);
  assert.strictEqual(trail.reason, 'a non-trivial square root of 1');
  assert.deepStrictEqual(trail.rows[0].trail, [263n, 166n, 67n, 1n]);
  assert.strictEqual(trail.rows[0].squarings, 4);
  assert.strictEqual((67n * 67n) % 561n, 1n, '67 is a square root of one modulo 561');
  assert.strictEqual(trail.agreesWithFullTest, true);

  prose.quotes('modular-arithmetic', ['263 → 166 → 67 → 1', '67']);
});

test('modular arithmetic: rho and trial division diverge by a factor of about two thousand', function () {
  const race = BignumLab.factorRace(158346127852483n, { trialBudget: 5000000, rhoBudget: 400000 });

  assert.deepStrictEqual(race.factors, [11489279n, 13782077n]);
  assert.strictEqual(race.trialOperations, 5000000);
  assert.strictEqual(race.trialComplete, false);
  assert.strictEqual(race.rhoOperations, 2532);
  assert.strictEqual(Math.round(race.speedup), 1975);
  assert.strictEqual(Math.round(Math.sqrt(11489279)), 3390, 'the birthday bound rho lands near');

  const easy = BignumLab.factorRace(561n, {});
  assert.strictEqual(easy.trialOperations, 7);
  assert.strictEqual(easy.rhoOperations, 1);

  prose.quotes('modular-arithmetic',
    ['11 489 279', '13 782 077', '5 000 000', '2 532', '1 975', '3 390', '7 operations']);
});

test('modular arithmetic: the two sieves and the two gcds', function () {
  const sieve = BignumLab.sieveRace(1000000);
  const gcd = BignumLab.gcdRace({ trials: 4000, bits: 64 });

  assert.strictEqual(sieve.primes, 78498);
  assert.strictEqual(sieve.classicWrites, 2122048);
  assert.strictEqual(sieve.linearWrites, 921501);
  assert.strictEqual(sieve.writeRatio.toFixed(2), '2.30');
  assert.strictEqual(sieve.byteRatio, 4);
  assert.strictEqual(sieve.agree, true);

  assert.strictEqual(gcd.euclidMean.toFixed(2), '14.06');
  assert.strictEqual(gcd.binaryMean.toFixed(2), '77.06');
  assert.strictEqual(gcd.disagreements, 0);

  prose.quotes('modular-arithmetic',
    ['2 122 048', '921 501', '14.06', '77.06', '4 000 pairs', '78 498']);
});

test('modular arithmetic: the CRT round trip is exact while the moduli are wide enough', function () {
  const run = BignumLab.crtRun(1234567n, [7, 11, 13, 17, 19, 23]);

  assert.strictEqual(run.correct, true);
  assert.strictEqual(run.rebuilt, 1234567n);
  assert.strictEqual(run.modulus, 7436429n);
  assert.strictEqual(run.wideEnough, true);

  const narrow = BignumLab.crtRun(1234567n, [7, 11, 13]);
  assert.strictEqual(narrow.wideEnough, false);
  assert.strictEqual(narrow.correct, false, 'too narrow, and nothing raises an error');

  prose.quotes('modular-arithmetic', ['1 234 567', '7 436 429']);
});

test('modular arithmetic: the deterministic witness sets are the published ones', function () {
  assert.deepStrictEqual(NumberTheory.witnessesFor(1000n), [2n]);
  assert.deepStrictEqual(NumberTheory.witnessesFor(1000000n), [2n, 3n]);
  assert.strictEqual(NumberTheory.witnessesFor(1n << 63n).length, 12);
  assert.strictEqual(NumberTheory.millerRabin(3215031751n).prime, false,
    'the smallest composite that bases 2, 3, 5 and 7 all accept');

  prose.quotes('modular-arithmetic', ['twelve fixed bases', '2⁶⁴', '1 373 653']);
});

/* ------------------------------------------------------------------- 17.9 */

const GENERATORS = EntropyLab.generatorTable({ samples: 200000, seed: 12345 });

function generatorRow(id) {
  for (let i = 0; i < GENERATORS.length; i += 1) {
    if (GENERATORS[i].id === id) return GENERATORS[i];
  }
  throw new Error('no generator ' + id);
}

test('random generation: the high-bit test rejects nothing on the upper tail', function () {
  GENERATORS.forEach(function (row) {
    assert.strictEqual(row.highBits.verdict === 'uneven', false,
      row.id + ' must not fail on the upper tail of the easy test');
  });
  assert.strictEqual(generatorRow('randu').highBits.statistic.toFixed(1), '0.1');
  assert.strictEqual(generatorRow('randu').highBits.verdict, 'too even');
  assert.strictEqual(generatorRow('randu').highBits.lowerCritical.toFixed(1), '45.7');
  assert.strictEqual(generatorRow('randu').highBits.critical.toFixed(1), '82.5');
  assert.strictEqual(generatorRow('randu').highBits.degrees, 63);

  prose.quotes('random-generation', ['0.1', '45.7 to 82.5', '63']);
});

test('random generation: the low bits separate what the high bits do not', function () {
  assert.strictEqual(generatorRow('randu').lowBits.statistic.toFixed(1), '600000.0');
  assert.strictEqual(generatorRow('randu').lowBits.verdict, 'uneven');
  assert.strictEqual(generatorRow('numerical-recipes').lowBits.statistic, 0);
  assert.strictEqual(generatorRow('numerical-recipes').lowBits.verdict, 'too even');
  assert.strictEqual(generatorRow('pcg32').lowBits.verdict, 'plausible');

  prose.quotes('random-generation', ['600 000.0', '0.0', '256']);
});

test('random generation: the bit periods and the linear identity', function () {
  const heat = EntropyLab.bitHeat('randu', { samples: 20000, seed: 1 });
  const periods = heat.periods.slice(0, 6).map(function (entry) { return entry.period; });

  assert.deepStrictEqual(periods, [1, 2, 1, 4, 8, 16]);
  assert.strictEqual((100 * heat.worstDeviation).toFixed(2), '50.00');
  assert.strictEqual(Prng.lcgPlaneResidual(Prng.build('randu', 1), 2000).holds, true);
  assert.strictEqual(Prng.lcgPlaneResidual(Prng.build('minstd', 1), 2000).holds, false);

  prose.quotes('random-generation', ['1, 2, 1, 4, 8 and 16', '50.00 points', '2 000 triples']);
});

test('random generation: the modulo bias is predicted and then arrives', function () {
  const table = EntropyLab.biasTable({ bits: 8, n: 200, samples: 400000 });
  const rows = {};
  table.rows.forEach(function (row) { rows[row.id] = row; });

  assert.strictEqual(table.predicted.favoured, 56);
  assert.strictEqual(table.predicted.ratio, 2);
  assert.strictEqual(table.atFullWidth.ratio.toFixed(9), '1.000000047');

  assert.strictEqual(rows.modulo.statistic.toFixed(1), '49161.2');
  assert.strictEqual(rows.modulo.spread.toFixed(3), '2.219');
  assert.strictEqual(rows.modulo.drawsPerSample, 1);
  assert.strictEqual(rows.rejection.drawsPerSample.toFixed(4), '1.2790');
  assert.strictEqual(rows.lemire.drawsPerSample.toFixed(4), '1.2807');
  assert.strictEqual(rows.rejection.passes, true);
  assert.strictEqual(rows.lemire.passes, true);

  prose.quotes('random-generation', ['56', '2.000×', '2.219', '1.2790', '1.2807']);
});

test('random generation: the two shuffles, counted rather than argued about', function () {
  const shuffle = EntropyLab.shuffleTable({ size: 3, trials: 120000, seed: 5 });

  assert.strictEqual(shuffle.paths, 27);
  assert.strictEqual(shuffle.outcomes, 6);
  assert.strictEqual(shuffle.divides, false);
  assert.strictEqual(shuffle.expected, 20000);
  assert.strictEqual(shuffle.correct.statistic.toFixed(1), '7.0');
  assert.strictEqual(shuffle.naive.statistic.toFixed(1), '1509.7');
  assert.strictEqual(shuffle.correct.critical.toFixed(1), '11.0');

  const naiveCounts = shuffle.naive.rows.map(function (row) { return row.count; });
  assert.strictEqual(Math.min.apply(null, naiveCounts), 17640);
  assert.strictEqual(Math.max.apply(null, naiveCounts), 22290);

  prose.quotes('random-generation',
    ['27', '120 000', '20 000', '7.0', '1 509.7', '11.0', '17 640', '22 290']);
});

/* ------------------------------------------------------------------ 17.10 */

const SCHEMES = EntropyLab.schemeTable({ count: 20000, idsPerMillisecond: 3, window: 64,
  pages: 4096, seed: 42 });

function schemeRow(id) {
  for (let i = 0; i < SCHEMES.length; i += 1) {
    if (SCHEMES[i].id === id) return SCHEMES[i];
  }
  throw new Error('no scheme ' + id);
}

test('integer algorithms: the working set is the number that separates the schemes', function () {
  assert.strictEqual(schemeRow('uuid4').peakWorkingSet, 64, 'the whole insert window');
  assert.strictEqual((100 * schemeRow('uuid4').switchRate).toFixed(1), '100.0');
  assert.strictEqual(schemeRow('sequential').peakWorkingSet, 14);
  assert.strictEqual((100 * schemeRow('sequential').switchRate).toFixed(1), '20.5');
  assert.strictEqual(schemeRow('snowflake').peakWorkingSet, 14);
  assert.strictEqual(schemeRow('uuid7').peakWorkingSet, 15);
  assert.strictEqual((100 * schemeRow('uuid7').switchRate).toFixed(1), '38.8');

  prose.quotes('integer-algorithms', ['64', '14', '15', '100.0%', '20.5%', '38.8%']);
});

test('integer algorithms: ordering is two properties, not one', function () {
  ['sequential', 'uuid7', 'ulid', 'snowflake'].forEach(function (id) {
    assert.strictEqual(schemeRow(id).acrossTime, 0, id + ' sorts across milliseconds');
  });
  assert.strictEqual(schemeRow('uuid4').acrossTime, 9963);

  assert.strictEqual(schemeRow('uuid7').withinTime, 6735);
  assert.strictEqual(schemeRow('uuid7').samePairs, 13333);
  assert.strictEqual(schemeRow('ulid').withinTime, 6665);
  assert.strictEqual(schemeRow('snowflake').withinTime, 0);
  assert.strictEqual(schemeRow('snowflake').samePairs, 13333);

  SCHEMES.forEach(function (row) {
    assert.strictEqual(row.duplicates, 0, row.id + ' must not repeat');
  });

  prose.quotes('integer-algorithms', ['6 735 of 13 333', '0 inversions']);
});

test('integer algorithms: both clock policies keep uniqueness and spend different things', function () {
  const rows = {};
  EntropyLab.clockRegression({ step: 40, before: 5, after: 8 }).forEach(function (row) {
    rows[row.policy] = row;
  });

  assert.strictEqual(rows.wait.issued, 13);
  assert.strictEqual(rows.wait.dropped, 0);
  assert.strictEqual(rows.wait.stats.waits, 8);
  assert.strictEqual(rows.refuse.issued, 5);
  assert.strictEqual(rows.refuse.dropped, 8);

  ['wait', 'refuse'].forEach(function (policy) {
    assert.strictEqual(rows[policy].duplicates, 0, policy + ' must stay unique');
    assert.strictEqual(rows[policy].monotonic, true, policy + ' must stay monotonic');
    assert.strictEqual(rows[policy].stats.regressions, 1, 'one backwards step, counted once');
  });

  prose.quotes('integer-algorithms', ['13 of 13', '5 of 13', '8']);
});

test('integer algorithms: the sequence ceiling borrows exactly one millisecond', function () {
  const burst = EntropyLab.burst({ count: 5000 });

  assert.strictEqual(burst.issued, 5000);
  assert.strictEqual(burst.duplicates, 0);
  assert.strictEqual(burst.millisecondsUsed, 2);
  assert.strictEqual(burst.borrowedFromTheFuture, 1);
  assert.strictEqual(burst.perMillisecondCeiling, 4096);
  assert.strictEqual(burst.stats.regressions, 0,
    'being ahead of the clock by your own doing is not a clock fault');

  prose.quotes('integer-algorithms', ['5 000', '4 096', '904']);
});

test('integer algorithms: the leakage table is the locality table inverted', function () {
  const leak = IdGenerators.LEAKAGE;

  assert.strictEqual(leak.uuid4.creationTime, false);
  assert.strictEqual(leak.uuid4.ordering, false);
  assert.strictEqual(leak.uuid7.creationTime, true);
  assert.strictEqual(leak.snowflake.machine, true);
  assert.strictEqual(leak.sequential.volume, true);

  const local = ['sequential', 'snowflake'];
  local.forEach(function (id) {
    assert.ok(schemeRow(id).peakWorkingSet < schemeRow('uuid4').peakWorkingSet,
      id + ' indexes better than a random UUID and leaks more');
    assert.strictEqual(leak[id].ordering, true);
  });

  prose.quotes('integer-algorithms', ['4 812']);
});
