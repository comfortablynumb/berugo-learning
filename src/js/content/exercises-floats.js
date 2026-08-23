/**
 * Graded exercises for IEEE 754, its hazards and exact representations
 * (M17.4-M17.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'ieee-754': [{
      id: 'ulp-and-next-after',
      title: 'ulp and nextAfter, by walking the representation',
      prompt: 'Return an object with `ulp(x)` and `nextAfter(x, towards)`. Both must work on the ' +
        'raw bits rather than on the value, because for a positive double the integer ordering of ' +
        'the 64-bit pattern IS the ordering of the values — the exponent field sits above the ' +
        'fraction field, so a fraction that carries into the exponent is exactly the step from ' +
        'the top of one binade to the bottom of the next. Use a `DataView` over an 8-byte buffer: ' +
        '`setFloat64` then `getBigUint64` to read the pattern, and the reverse to rebuild a value. ' +
        '`nextAfter` returns `towards` when the two are equal, NaN when either is NaN, and for ' +
        'x = 0 it returns the smallest subnormal with the sign of `towards` — 5e-324 or −5e-324, ' +
        'never the smallest normal. Otherwise add 1 to the pattern when moving away from zero and ' +
        'subtract 1 when moving towards it. `ulp(x)` is the gap from |x| to the next value further ' +
        'from zero. The starter scales by machine epsilon, which is right at 1.0 and wrong ' +
        'everywhere else.',
      entry: 'floatKit',
      starter: [
        'function floatKit() {',
        '  function ulp(x) {',
        '    // epsilon is the gap at 1.0, not a universal step',
        '    return Math.abs(x) * Number.EPSILON;',
        '  }',
        '',
        '  function nextAfter(x, towards) {',
        '    if (x === towards) return towards;',
        '    return towards > x ? x + ulp(x) : x - ulp(x);',
        '  }',
        '',
        '  return { ulp: ulp, nextAfter: nextAfter };',
        '}'
      ].join('\n'),
      solution: [
        'function floatKit() {',
        '  const view = new DataView(new ArrayBuffer(8));',
        '  const SIGN = 1n << 63n;',
        '',
        '  function bitsOf(x) { view.setFloat64(0, x); return view.getBigUint64(0); }',
        '  function fromBits(b) { view.setBigUint64(0, b); return view.getFloat64(0); }',
        '',
        '  function nextAfter(x, towards) {',
        '    if (Number.isNaN(x) || Number.isNaN(towards)) return NaN;',
        '    if (x === towards) return towards;',
        '    // stepping off zero must land on a subnormal, not on the smallest normal',
        '    if (x === 0) return towards > 0 ? 5e-324 : -5e-324;',
        '',
        '    const bits = bitsOf(x);',
        '    const away = (towards > x) === (x > 0);',
        '    if (!away && (bits & ~SIGN) === 0n) return x;',
        '    return fromBits(bits + (away ? 1n : -1n));',
        '  }',
        '',
        '  function ulp(x) {',
        '    if (Number.isNaN(x)) return NaN;',
        '    if (!Number.isFinite(x)) return Infinity;',
        '    const magnitude = Math.abs(x);',
        '    if (magnitude === 0) return 5e-324;',
        '    return nextAfter(magnitude, Infinity) - magnitude;',
        '  }',
        '',
        '  return { ulp: ulp, nextAfter: nextAfter };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the four boundaries a hand-written version gets wrong',
          assert: function (floatKit, api) {
            const kit = floatKit();
            const minNormal = 2.2250738585072014e-308;

            api.assert.equal(kit.nextAfter(0, Infinity), 5e-324,
              'up from zero must land on the smallest subnormal');
            api.assert.equal(kit.nextAfter(0, -Infinity), -5e-324,
              'down from zero must land on its negative');
            api.assert.ok(kit.nextAfter(minNormal, -Infinity) < minNormal,
              'stepping down from the smallest normal must enter the subnormals');
            api.assert.ok(kit.nextAfter(minNormal, -Infinity) > 0,
              'and must not skip to zero');
            api.assert.equal(kit.nextAfter(Number.MAX_VALUE, Infinity), Infinity,
              'up from the largest finite double is infinity');
            api.assert.equal(kit.nextAfter(1, 1), 1, 'equal values return the target unchanged');
          }
        },
        {
          name: 'the gap below a power of two is half the gap above it',
          assert: function (floatKit, api) {
            const kit = floatKit();

            api.assert.equal(kit.ulp(1), Number.EPSILON, 'the gap above 1.0 IS machine epsilon');
            api.assert.equal(1 - kit.nextAfter(1, 0), Number.EPSILON / 2,
              'the binade below 1.0 is packed twice as densely');
            api.assert.equal(kit.ulp(Math.pow(2, 52)), 1, 'at 2^52 the gap is exactly 1');
            api.assert.equal(kit.ulp(Math.pow(2, 53)), 2, 'at 2^53 it is 2');
            api.assert.equal(kit.ulp(1e16), 2, 'which is why 1e16 + 1 changes nothing');
            api.assert.equal(kit.ulp(-1), kit.ulp(1), 'ulp is about the magnitude');
          }
        },
        {
          name: 'nextAfter is strictly monotonic with nothing representable in between',
          assert: function (floatKit, api) {
            const kit = floatKit();
            const seeds = [0.1, 1, 1.5, 1e-300, 1e300, 5e-324, 2.2250738585072014e-308];

            for (let i = 0; i < seeds.length; i += 1) {
              let value = seeds[i];
              for (let step = 0; step < 200; step += 1) {
                const up = kit.nextAfter(value, Infinity);
                api.assert.ok(up > value, 'stepping up from ' + value + ' must increase it');
                api.assert.equal(kit.nextAfter(up, -Infinity), value,
                  'stepping back down must return to exactly where it started');
                api.assert.equal((value + up) / 2 === value || (value + up) / 2 === up, true,
                  'no representable value can sit strictly between two neighbours');
                value = up;
              }
            }
          }
        },
        {
          name: 'the ulp step reaches the neighbour, which the epsilon shortcut does not',
          assert: function (floatKit, api) {
            const kit = floatKit();

            for (let trial = 0; trial < 3000; trial += 1) {
              const exponent = api.rng.int(200) - 100;
              const value = (1 + api.rng.next()) * Math.pow(2, exponent);
              const gap = kit.ulp(value);

              api.assert.equal(value + gap, kit.nextAfter(value, Infinity),
                'adding one ulp to ' + value + ' must land exactly on the next double');
              api.assert.ok(value + gap / 4 === value,
                'a quarter of an ulp must round away entirely');
            }
            api.assert.equal(kit.ulp(5e-324), 5e-324,
              'in the subnormal range every gap is the same, so a magnitude-scaled step is wrong here');
          }
        }
      ]
    }],

    'floating-point-hazards': [{
      id: 'kahan-and-welford',
      title: 'Compensated summation, and a variance that cannot go negative',
      prompt: 'Return an object with `sum(values)` and `variance(values)`. `sum` must use Kahan ' +
        'compensation: keep a running `compensation`, subtract it from each incoming value to get ' +
        '`y`, form `t = sum + y`, then set `compensation = (t - sum) - y` — which is exactly the ' +
        'part of `y` that did not fit — and `sum = t`. `variance` must use Welford: for each ' +
        'value increment the count, take `delta = value - mean`, update `mean += delta / count`, ' +
        'and accumulate `m2 += delta * (value - mean)` using the NEW mean in the second factor. ' +
        'Return `m2 / count`, or 0 for an empty list. The starter sums naively and computes the ' +
        'variance from the textbook one-pass identity, which subtracts two enormous nearly equal ' +
        'numbers and is wrong by five orders of magnitude on data that sits far from zero.',
      entry: 'stableStats',
      starter: [
        'function stableStats() {',
        '  function sum(values) {',
        '    let total = 0;',
        '    for (let i = 0; i < values.length; i += 1) total += values[i];',
        '    return total;',
        '  }',
        '',
        '  function variance(values) {',
        '    if (values.length === 0) return 0;',
        '    let total = 0;',
        '    let squares = 0;',
        '    for (let i = 0; i < values.length; i += 1) {',
        '      total += values[i];',
        '      squares += values[i] * values[i];',
        '    }',
        '    // large minus large, answer small',
        '    return (squares - (total * total) / values.length) / values.length;',
        '  }',
        '',
        '  return { sum: sum, variance: variance };',
        '}'
      ].join('\n'),
      solution: [
        'function stableStats() {',
        '  function sum(values) {',
        '    let total = 0;',
        '    let compensation = 0;',
        '    for (let i = 0; i < values.length; i += 1) {',
        '      const y = values[i] - compensation;',
        '      const t = total + y;',
        '      // what did NOT fit into t',
        '      compensation = (t - total) - y;',
        '      total = t;',
        '    }',
        '    return total;',
        '  }',
        '',
        '  function variance(values) {',
        '    let count = 0;',
        '    let mean = 0;',
        '    let m2 = 0;',
        '    for (let i = 0; i < values.length; i += 1) {',
        '      count += 1;',
        '      const delta = values[i] - mean;',
        '      mean += delta / count;',
        '      // the second factor uses the NEW mean, which is what makes it stable',
        '      m2 += delta * (values[i] - mean);',
        '    }',
        '    return count === 0 ? 0 : m2 / count;',
        '  }',
        '',
        '  return { sum: sum, variance: variance };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a huge value followed by many small ones, against an exact BigInt sum',
          assert: function (stableStats, api) {
            const kit = stableStats();
            const view = new DataView(new ArrayBuffer(8));

            function exactSum(values) {
              let scale = 0;
              let seen = false;
              const parts = values.map(function (v) {
                view.setFloat64(0, v);
                const bits = view.getBigUint64(0);
                const biased = Number((bits >> 52n) & 0x7ffn);
                const fraction = bits & ((1n << 52n) - 1n);
                const mantissa = biased === 0 ? fraction : fraction | (1n << 52n);
                const signed = (bits >> 63n) === 1n ? -mantissa : mantissa;
                return { m: v === 0 ? 0n : signed, s: biased === 0 ? -1074 : biased - 1075 };
              });
              parts.forEach(function (p) {
                if (p.m === 0n) return;
                if (!seen || p.s < scale) { scale = p.s; seen = true; }
              });
              let total = 0n;
              parts.forEach(function (p) {
                if (p.m !== 0n) total += p.m << BigInt(p.s - scale);
              });
              return { m: total, s: scale };
            }

            const values = [1e16];
            for (let i = 0; i < 60000; i += 1) {
              const high = Math.floor(api.rng.next() * 2097152);
              const low = Math.floor(api.rng.next() * 4294967296);
              values.push((high * 4294967296 + low) / 9007199254740992);
            }

            const truth = exactSum(values);
            const got = kit.sum(values);
            const gotParts = exactSum([got]);
            const scale = Math.min(truth.s, gotParts.s);
            const difference = (truth.m << BigInt(truth.s - scale)) -
              (gotParts.m << BigInt(gotParts.s - scale));
            const magnitude = difference < 0n ? -difference : difference;

            api.assert.ok(magnitude * 4n <= (truth.m < 0n ? -truth.m : truth.m),
              'the compensated sum must be far closer to the exact total than a naive one');
            api.assert.ok(got > 1.0000000000009e16,
              'a naive sum absorbs the small values entirely and stays at 1e16; this returned ' + got);
          }
        },
        {
          name: 'the answer barely depends on the order the values arrive in',
          assert: function (stableStats, api) {
            const kit = stableStats();
            const values = [1e16];
            for (let i = 0; i < 40000; i += 1) values.push(1 + api.rng.next());

            const ascending = values.slice().sort(function (a, b) { return a - b; });
            const descending = ascending.slice().reverse();
            const shuffled = values.slice();
            for (let i = shuffled.length - 1; i > 0; i -= 1) {
              const j = api.rng.int(i + 1);
              const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
            }

            /* Kahan is not exactly order-independent and claiming so is an
               overstatement: the compensation is itself computed in floating
               point. What it removes is the LINEAR growth of the error with n,
               which is why four orderings land within an ulp or two of each
               other here and a naive sum spreads over tens of thousands. */
            const view = new DataView(new ArrayBuffer(8));
            function ordered(x) {
              view.setFloat64(0, x);
              const bits = view.getBigUint64(0);
              return (bits & (1n << 63n)) !== 0n
                ? (1n << 63n) - (bits & ~(1n << 63n)) : (1n << 63n) + bits;
            }
            function ulpsApart(a, b) {
              const d = ordered(a) - ordered(b);
              return d < 0n ? -d : d;
            }

            const first = kit.sum(values);
            const spread = [kit.sum(ascending), kit.sum(descending), kit.sum(shuffled)];
            for (let i = 0; i < spread.length; i += 1) {
              api.assert.ok(ulpsApart(spread[i], first) <= 4n,
                'compensated sums over four orderings must agree to within a few representable ' +
                'doubles; this pair was ' + ulpsApart(spread[i], first) + ' apart');
            }

            let naive = 0;
            for (let i = 0; i < descending.length; i += 1) naive += descending[i];
            api.assert.ok(ulpsApart(naive, first) > 1000n,
              'and a naive sum of the same values in the same order must be far further away, ' +
              'or this fixture is not testing anything');
          }
        },
        {
          name: 'variance on values clustered far from zero, where the textbook formula collapses',
          assert: function (stableStats, api) {
            const kit = stableStats();
            const centred = [];
            const offset = [];

            for (let i = 0; i < 40000; i += 1) {
              const u = api.rng.next();
              centred.push(u);
              offset.push(1e9 + u);
            }

            const near = kit.variance(centred);
            const far = kit.variance(offset);

            api.assert.ok(far > 0, 'a variance cannot be negative, whatever the offset');
            api.assert.closeTo(far, near, Math.abs(near) * 0.01,
              'adding a constant to every value must not change the variance; got ' + far +
              ' against ' + near);
            api.assert.closeTo(near, 1 / 12, 0.005,
              'the variance of a uniform draw on [0, 1) is 1/12');
          }
        },
        {
          name: 'variance stays right on the easy cases too',
          assert: function (stableStats, api) {
            const kit = stableStats();

            api.assert.equal(kit.variance([]), 0, 'an empty list has no variance to report');
            api.assert.equal(kit.variance([5]), 0, 'one value has zero variance');
            api.assert.equal(kit.variance([4, 4, 4, 4]), 0, 'identical values have zero variance');
            api.assert.closeTo(kit.variance([2, 4, 4, 4, 5, 5, 7, 9]), 4, 1e-12,
              'the textbook eight-value example has a population variance of exactly 4');

            const shifted = [2, 4, 4, 4, 5, 5, 7, 9].map(function (v) { return v + 1e8; });
            api.assert.closeTo(kit.variance(shifted), 4, 1e-6,
              'and shifting all of them by 10^8 must not move it');
          }
        }
      ]
    }],

    'fixed-and-decimal': [{
      id: 'money-rounding',
      title: 'Applying a rate to money, exactly, under a named policy',
      prompt: 'Return an object with `applyRate(cents, rate, policy)` and `total(amounts, rate, ' +
        'policy)`. `cents` is a BigInt amount in whole cents and `rate` is `{ numerator, ' +
        'denominator }` as BigInts — 8.75% arrives as 875 over 10 000. Compute the exact product ' +
        '`cents × numerator`, then divide by `denominator` and resolve the remainder under the ' +
        'named policy, all in BigInt so nothing is ever a double. Support four policies: ' +
        '`half-even` rounds a tie to the even quotient, `half-up` rounds a tie away from zero, ' +
        '`floor` goes towards minus infinity and `truncate` goes towards zero — those last two ' +
        'agree on positives and differ on negatives, which is where a refund first exposes the ' +
        'choice. Compare the remainder against half the divisor by DOUBLING it rather than by ' +
        'dividing, so no rounding decision hides inside another. `total` sums the rounded line ' +
        'items. The starter converts to a double and calls `Math.round`, which loses a cent on ' +
        'about half of every thousand ties.',
      entry: 'moneyKit',
      starter: [
        'function moneyKit() {',
        '  function applyRate(cents, rate, policy) {',
        '    // straight through a double, which is where the cent goes',
        '    const product = Number(cents) * (Number(rate.numerator) / Number(rate.denominator));',
        '    return BigInt(Math.round(product));',
        '  }',
        '',
        '  function total(amounts, rate, policy) {',
        '    let sum = 0n;',
        '    for (let i = 0; i < amounts.length; i += 1) {',
        '      sum += applyRate(amounts[i], rate, policy);',
        '    }',
        '    return sum;',
        '  }',
        '',
        '  return { applyRate: applyRate, total: total };',
        '}'
      ].join('\n'),
      solution: [
        'function moneyKit() {',
        '  function abs(v) { return v < 0n ? -v : v; }',
        '',
        '  function applyRate(cents, rate, policy) {',
        '    const numerator = cents * rate.numerator;',
        '    const denominator = rate.denominator;',
        '    const negative = (numerator < 0n) !== (denominator < 0n);',
        '    const top = abs(numerator);',
        '    const bottom = abs(denominator);',
        '    const quotient = top / bottom;',
        '    const remainder = top % bottom;',
        '',
        '    if (remainder === 0n) return negative ? -quotient : quotient;',
        '',
        '    const magnitude = resolve(quotient, remainder * 2n, bottom, policy, negative);',
        '    return negative ? -magnitude : magnitude;',
        '  }',
        '',
        '  function resolve(quotient, twice, bottom, policy, negative) {',
        '    if (policy === "truncate") return quotient;',
        '    if (policy === "floor") return negative ? quotient + 1n : quotient;',
        '    if (twice > bottom) return quotient + 1n;',
        '    if (twice < bottom) return quotient;',
        '    if (policy === "half-up") return quotient + 1n;',
        '    return (quotient & 1n) === 1n ? quotient + 1n : quotient;',
        '  }',
        '',
        '  function total(amounts, rate, policy) {',
        '    let sum = 0n;',
        '    for (let i = 0; i < amounts.length; i += 1) {',
        '      sum += applyRate(amounts[i], rate, policy);',
        '    }',
        '    return sum;',
        '  }',
        '',
        '  return { applyRate: applyRate, total: total };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the four policies on an exact tie, positive and negative',
          assert: function (moneyKit, api) {
            const kit = moneyKit();
            const half = { numerator: 1n, denominator: 2n };

            api.assert.equal(kit.applyRate(5n, half, 'half-even'), 2n, '2.5 to even is 2');
            api.assert.equal(kit.applyRate(7n, half, 'half-even'), 4n, '3.5 to even is 4');
            api.assert.equal(kit.applyRate(5n, half, 'half-up'), 3n, '2.5 away from zero is 3');
            api.assert.equal(kit.applyRate(5n, half, 'floor'), 2n, '2.5 towards minus infinity is 2');
            api.assert.equal(kit.applyRate(5n, half, 'truncate'), 2n, '2.5 towards zero is 2');

            api.assert.equal(kit.applyRate(-5n, half, 'floor'), -3n,
              '−2.5 towards minus infinity is −3');
            api.assert.equal(kit.applyRate(-5n, half, 'truncate'), -2n,
              '−2.5 towards zero is −2, which is where floor and truncate part company');
            api.assert.equal(kit.applyRate(-5n, half, 'half-up'), -3n,
              'half-up is away from zero in both directions');
          }
        },
        {
          name: 'the ties a double gets wrong at 8.75%',
          assert: function (moneyKit, api) {
            const kit = moneyKit();
            const rate = { numerator: 875n, denominator: 10000n };
            const known = [4040n, 14600n, 9000n, 11080n, 1400n, 19160n];
            const expected = [354n, 1278n, 788n, 970n, 123n, 1677n];

            for (let i = 0; i < known.length; i += 1) {
              api.assert.equal(kit.applyRate(known[i], rate, 'half-up'), expected[i],
                known[i] + ' cents at 8.75% is an exact tie and must round up');

              /* The double path a real system takes: the amount is held in
                 dollars, the rate as a decimal, and the product scaled back to
                 cents. Each of those three steps rounds, and the result lands
                 just below the tie. */
              const asDollars = Number(known[i]) / 100;
              const product = asDollars * 0.0875 * 100;
              api.assert.equal(BigInt(Math.round(product)), expected[i] - 1n,
                known[i] + ' cents gives a double product of ' + product + ', which is below the ' +
                'tie, so Math.round takes the cent downwards');
            }
          }
        },
        {
          name: '20 000 line items agree with an exact rational reference at four rates',
          assert: function (moneyKit, api) {
            const kit = moneyKit();
            const rates = [875n, 1750n, 2000n, 500n];

            for (let trial = 0; trial < 20000; trial += 1) {
              const cents = BigInt(1 + api.rng.int(200000));
              const rate = { numerator: rates[api.rng.int(rates.length)], denominator: 10000n };
              const top = cents * rate.numerator;
              const quotient = top / 10000n;
              const remainder = top % 10000n;

              let expected = quotient;
              if (remainder * 2n > 10000n) expected = quotient + 1n;
              else if (remainder * 2n === 10000n) expected = quotient + 1n;
              api.assert.equal(kit.applyRate(cents, rate, 'half-up'), expected,
                'half-up on ' + cents + ' cents at ' + rate.numerator + '/10000');

              let even = quotient;
              if (remainder * 2n > 10000n) even = quotient + 1n;
              else if (remainder * 2n === 10000n && (quotient & 1n) === 1n) even = quotient + 1n;
              api.assert.equal(kit.applyRate(cents, rate, 'half-even'), even,
                'half-even on ' + cents + ' cents');
            }
          }
        },
        {
          name: 'half-up drifts further than half-even over a batch, and the gap is the ties',
          assert: function (moneyKit, api) {
            const kit = moneyKit();
            const rate = { numerator: 875n, denominator: 10000n };
            const amounts = [];
            let ties = 0;

            for (let i = 0; i < 40000; i += 1) {
              const cents = BigInt(1 + api.rng.int(20000));
              amounts.push(cents);
              if ((cents * rate.numerator % 10000n) * 2n === 10000n) ties += 1;
            }

            const up = kit.total(amounts, rate, 'half-up');
            const even = kit.total(amounts, rate, 'half-even');
            const down = kit.total(amounts, rate, 'truncate');

            api.assert.ok(ties > 0, 'the fixture must contain exact ties or this proves nothing');
            api.assert.ok(up >= even, 'half-up sends every tie up, so it cannot total less');
            api.assert.ok(up - even <= BigInt(ties),
              'and the gap cannot exceed the number of ties, which is ' + ties);
            api.assert.ok(even > down,
              'truncation discards every fractional cent, so it must total least');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
