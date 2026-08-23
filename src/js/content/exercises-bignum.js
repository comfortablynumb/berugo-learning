/**
 * Graded exercises for arbitrary precision and number theory (M17.7-M17.8).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'arbitrary-precision': [{
      id: 'limb-division',
      title: 'Long division on limbs, including the correction nobody reaches',
      prompt: 'Return an object with `divmodSmall(limbs, divisor)` and `divmod(numerator, ' +
        'denominator)`, operating on little-endian arrays of 16-bit limbs — index 0 is the least ' +
        'significant, and the base is 65 536. `divmodSmall` divides by a single limb: walk from ' +
        'the top, carrying the remainder, and return `{ quotient, remainder }` with the quotient ' +
        'normalised (no leading zero limbs) and the remainder a plain number. `divmod` is Knuth’s ' +
        'algorithm D. Shift both operands left so the divisor’s top limb reaches at least 32 768 ' +
        '— that shift is what bounds the quotient-digit estimate error at two — then for each ' +
        'quotient position estimate the digit from the top two limbs of the remaining numerator, ' +
        'correct it downwards while `estimate × v[n−2]` exceeds `remainder × 65536 + u[j+n−2]`, ' +
        'subtract `estimate × divisor` shifted into place, and if that subtraction goes negative ' +
        'add one copy of the divisor back and decrement the digit. Return `{ quotient, remainder, ' +
        'addBacks }`, with the remainder shifted back down. The starter skips the add-back, which ' +
        'is correct on almost every input.',
      entry: 'limbDivision',
      starter: [
        'function limbDivision() {',
        '  const BASE = 65536;',
        '',
        '  function normalise(limbs) {',
        '    let end = limbs.length;',
        '    while (end > 1 && limbs[end - 1] === 0) end -= 1;',
        '    return limbs.slice(0, end);',
        '  }',
        '',
        '  function divmodSmall(limbs, divisor) {',
        '    const quotient = new Array(limbs.length).fill(0);',
        '    let remainder = 0;',
        '    for (let i = limbs.length - 1; i >= 0; i -= 1) {',
        '      const current = remainder * BASE + limbs[i];',
        '      quotient[i] = Math.floor(current / divisor);',
        '      remainder = current % divisor;',
        '    }',
        '    return { quotient: normalise(quotient), remainder: remainder };',
        '  }',
        '',
        '  function toBig(limbs) {',
        '    let out = 0n;',
        '    for (let i = limbs.length - 1; i >= 0; i -= 1) out = (out << 16n) | BigInt(limbs[i]);',
        '    return out;',
        '  }',
        '',
        '  function fromBig(value) {',
        '    const limbs = [];',
        '    let v = value;',
        '    if (v === 0n) limbs.push(0);',
        '    while (v > 0n) { limbs.push(Number(v & 65535n)); v >>= 16n; }',
        '    return limbs;',
        '  }',
        '',
        '  function divmod(numerator, denominator) {',
        '    // the estimate, never corrected downwards past the first step',
        '    const a = toBig(numerator);',
        '    const b = toBig(denominator);',
        '    if (b === 0n) throw new Error("division by zero");',
        '    const q = a / b;',
        '    const r = a % b;',
        '    // and no add-back is ever reported',
        '    return { quotient: fromBig(q), remainder: fromBig(r), addBacks: 0 };',
        '  }',
        '',
        '  return { divmodSmall: divmodSmall, divmod: divmod };',
        '}'
      ].join('\n'),
      solution: [
        'function limbDivision() {',
        '  const BASE = 65536;',
        '  const MASK = 65535;',
        '',
        '  function normalise(limbs) {',
        '    let end = limbs.length;',
        '    while (end > 1 && limbs[end - 1] === 0) end -= 1;',
        '    return limbs.slice(0, end);',
        '  }',
        '',
        '  function divmodSmall(limbs, divisor) {',
        '    const quotient = new Array(limbs.length).fill(0);',
        '    let remainder = 0;',
        '    for (let i = limbs.length - 1; i >= 0; i -= 1) {',
        '      const current = remainder * BASE + limbs[i];',
        '      quotient[i] = Math.floor(current / divisor);',
        '      remainder = current % divisor;',
        '    }',
        '    return { quotient: normalise(quotient), remainder: remainder };',
        '  }',
        '',
        '  function compare(a, b) {',
        '    if (a.length !== b.length) return a.length > b.length ? 1 : -1;',
        '    for (let i = a.length - 1; i >= 0; i -= 1) {',
        '      if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;',
        '    }',
        '    return 0;',
        '  }',
        '',
        '  function shiftLeft(limbs, bits) {',
        '    if (bits === 0) return limbs.slice();',
        '    const out = [];',
        '    let carry = 0;',
        '    for (let i = 0; i < limbs.length; i += 1) {',
        '      out.push(((limbs[i] << bits) | carry) & MASK);',
        '      carry = limbs[i] >>> (16 - bits);',
        '    }',
        '    out.push(carry);',
        '    return out;',
        '  }',
        '',
        '  function shiftRight(limbs, bits) {',
        '    if (bits === 0) return limbs.slice();',
        '    const out = new Array(limbs.length).fill(0);',
        '    let carry = 0;',
        '    for (let i = limbs.length - 1; i >= 0; i -= 1) {',
        '      out[i] = ((limbs[i] >>> bits) | carry) & MASK;',
        '      carry = (limbs[i] << (16 - bits)) & MASK;',
        '    }',
        '    return normalise(out);',
        '  }',
        '',
        '  function bitLength(value) {',
        '    let bits = 0;',
        '    let v = value;',
        '    while (v > 0) { bits += 1; v >>>= 1; }',
        '    return bits;',
        '  }',
        '',
        '  function subtractShifted(u, v, at, factor) {',
        '    let borrow = 0;',
        '    let carry = 0;',
        '    for (let i = 0; i < v.length; i += 1) {',
        '      const product = factor * v[i] + carry;',
        '      carry = Math.floor(product / BASE);',
        '      let value = u[at + i] - (product & MASK) - borrow;',
        '      borrow = 0;',
        '      if (value < 0) { value += BASE; borrow = 1; }',
        '      u[at + i] = value;',
        '    }',
        '    const top = u[at + v.length] - carry - borrow;',
        '    if (top < 0) { u[at + v.length] = top + BASE; return true; }',
        '    u[at + v.length] = top;',
        '    return false;',
        '  }',
        '',
        '  function addShifted(u, v, at) {',
        '    let carry = 0;',
        '    for (let i = 0; i < v.length; i += 1) {',
        '      const sum = u[at + i] + v[i] + carry;',
        '      u[at + i] = sum & MASK;',
        '      carry = sum >>> 16;',
        '    }',
        '    u[at + v.length] = (u[at + v.length] + carry) & MASK;',
        '  }',
        '',
        '  function divmod(numerator, denominator) {',
        '    const den = normalise(denominator);',
        '    if (den.length === 1 && den[0] === 0) throw new Error("division by zero");',
        '    const num = normalise(numerator);',
        '    if (compare(num, den) < 0) {',
        '      return { quotient: [0], remainder: num.slice(), addBacks: 0 };',
        '    }',
        '    if (den.length === 1) {',
        '      const small = divmodSmall(num, den[0]);',
        '      return { quotient: small.quotient, remainder: [small.remainder], addBacks: 0 };',
        '    }',
        '',
        '    // the shift that bounds the estimate error at two',
        '    const shift = 16 - bitLength(den[den.length - 1]);',
        '    const u = shiftLeft(num.concat([0]), shift);',
        '    const v = normalise(shiftLeft(den, shift));',
        '    const n = v.length;',
        '    const quotient = new Array(num.length - n + 1).fill(0);',
        '    let addBacks = 0;',
        '',
        '    for (let j = quotient.length - 1; j >= 0; j -= 1) {',
        '      const top = u[j + n] * BASE + u[j + n - 1];',
        '      let estimate = Math.floor(top / v[n - 1]);',
        '      let rest = top % v[n - 1];',
        '',
        '      while (estimate >= BASE ||',
        '        estimate * v[n - 2] > rest * BASE + u[j + n - 2]) {',
        '        estimate -= 1;',
        '        rest += v[n - 1];',
        '        if (rest >= BASE) break;',
        '      }',
        '      if (subtractShifted(u, v, j, estimate)) {',
        '        estimate -= 1;',
        '        addBacks += 1;',
        '        addShifted(u, v, j);',
        '      }',
        '      quotient[j] = estimate;',
        '    }',
        '',
        '    return {',
        '      quotient: normalise(quotient),',
        '      remainder: normalise(shiftRight(u.slice(0, n), shift)),',
        '      addBacks: addBacks',
        '    };',
        '  }',
        '',
        '  return { divmodSmall: divmodSmall, divmod: divmod };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the two fixtures that force the add-back correction',
          assert: function (limbDivision, api) {
            const kit = limbDivision();

            function toBig(limbs) {
              let out = 0n;
              for (let i = limbs.length - 1; i >= 0; i -= 1) out = (out << 16n) | BigInt(limbs[i]);
              return out;
            }

            const fixtures = [
              { u: [0, 0, 0x8000, 0x7fff], v: [1, 0, 0x8000] },
              { u: [3, 0, 0, 0, 0, 0x8000], v: [1, 0, 0, 0x8000] }
            ];

            for (let i = 0; i < fixtures.length; i += 1) {
              const a = toBig(fixtures[i].u);
              const b = toBig(fixtures[i].v);
              const got = kit.divmod(fixtures[i].u, fixtures[i].v);

              api.assert.equal(toBig(got.quotient), a / b, 'quotient on fixture ' + i);
              api.assert.equal(toBig(got.remainder), a % b, 'remainder on fixture ' + i);
              api.assert.equal(got.addBacks, 1,
                'fixture ' + i + ' is constructed so the estimate is still one too large after ' +
                'the correction loop; an implementation without the add-back reports 0 here and ' +
                'is wrong');
            }
          }
        },
        {
          name: 'division by a single limb, including the boundaries',
          assert: function (limbDivision, api) {
            const kit = limbDivision();

            function toBig(limbs) {
              let out = 0n;
              for (let i = limbs.length - 1; i >= 0; i -= 1) out = (out << 16n) | BigInt(limbs[i]);
              return out;
            }

            api.assert.deepEqual(kit.divmodSmall([0], 7), { quotient: [0], remainder: 0 },
              'zero divided by anything');
            api.assert.deepEqual(kit.divmodSmall([5], 7), { quotient: [0], remainder: 5 },
              'a divisor larger than the numerator');

            for (let trial = 0; trial < 3000; trial += 1) {
              const limbs = [];
              const count = 1 + api.rng.int(8);
              for (let i = 0; i < count; i += 1) limbs.push(api.rng.int(65536));
              limbs[count - 1] = 1 + api.rng.int(65535);
              const divisor = 1 + api.rng.int(65535);

              const a = toBig(limbs);
              const got = kit.divmodSmall(limbs, divisor);
              api.assert.equal(toBig(got.quotient), a / BigInt(divisor), 'quotient on trial ' + trial);
              api.assert.equal(BigInt(got.remainder), a % BigInt(divisor),
                'remainder on trial ' + trial);
            }
          }
        },
        {
          name: '3 000 multi-limb divisions agree with BigInt',
          assert: function (limbDivision, api) {
            const kit = limbDivision();

            function toBig(limbs) {
              let out = 0n;
              for (let i = limbs.length - 1; i >= 0; i -= 1) out = (out << 16n) | BigInt(limbs[i]);
              return out;
            }

            function randomLimbs(count) {
              const limbs = [];
              for (let i = 0; i < count; i += 1) limbs.push(api.rng.int(65536));
              limbs[count - 1] = 1 + api.rng.int(65535);
              return limbs;
            }

            for (let trial = 0; trial < 3000; trial += 1) {
              const denLength = 2 + api.rng.int(3);
              const numLength = denLength + api.rng.int(4);
              const u = randomLimbs(numLength);
              const v = randomLimbs(denLength);

              const a = toBig(u);
              const b = toBig(v);
              const got = kit.divmod(u, v);

              api.assert.equal(toBig(got.quotient), a / b, 'quotient on trial ' + trial);
              api.assert.equal(toBig(got.remainder), a % b, 'remainder on trial ' + trial);
            }
          }
        },
        {
          name: 'quotient times divisor plus remainder is the numerator, and the remainder is smaller',
          assert: function (limbDivision, api) {
            const kit = limbDivision();

            function toBig(limbs) {
              let out = 0n;
              for (let i = limbs.length - 1; i >= 0; i -= 1) out = (out << 16n) | BigInt(limbs[i]);
              return out;
            }

            for (let trial = 0; trial < 2000; trial += 1) {
              const u = [];
              const v = [];
              const numLength = 3 + api.rng.int(5);
              const denLength = 1 + api.rng.int(3);
              for (let i = 0; i < numLength; i += 1) u.push(api.rng.int(65536));
              for (let i = 0; i < denLength; i += 1) v.push(api.rng.int(65536));
              u[numLength - 1] = 1 + api.rng.int(65535);
              v[denLength - 1] = 1 + api.rng.int(65535);

              const a = toBig(u);
              const b = toBig(v);
              const got = kit.divmod(u, v);
              const q = toBig(got.quotient);
              const r = toBig(got.remainder);

              api.assert.equal(q * b + r, a, 'q x b + r must reconstruct the numerator');
              api.assert.ok(r < b, 'the remainder must be smaller than the divisor');
              api.assert.ok(r >= 0n, 'and it must not be negative');
            }
          }
        }
      ]
    }],

    'modular-arithmetic': [{
      id: 'deterministic-miller-rabin',
      title: 'modPow, and Miller-Rabin with a witness set that decides',
      prompt: 'Return an object with `modPow(base, exponent, modulus)` and `isPrime(n)`, both on ' +
        'BigInt. `modPow` is square-and-multiply: reduce the base modulo n first, then walk the ' +
        'exponent’s bits from the bottom, squaring every step and multiplying into the result ' +
        'only where the bit is set. `isPrime` must be a DECISION below 2⁶⁴, not an estimate: ' +
        'reject n below 2, accept the small primes up to 37, reject anything divisible by one of ' +
        'them, then run Miller-Rabin with the deterministic witness set [2, 3, 5, 7, 11, 13, 17, ' +
        '19, 23, 29, 31, 37]. One round writes n − 1 as d × 2ˢ with d odd, computes a^d mod n, ' +
        'and accepts if that is 1 or n − 1; otherwise it squares up to s − 1 more times and ' +
        'accepts only if some square is n − 1. Reaching 1 without ever reaching n − 1 is a ' +
        'non-trivial square root of one, which a prime modulus does not have — reject. The ' +
        'starter runs a Fermat test instead, which is exactly the version every Carmichael number ' +
        'defeats.',
      entry: 'primeKit',
      starter: [
        'function primeKit() {',
        '  function modPow(base, exponent, modulus) {',
        '    let result = 1n;',
        '    let b = ((base % modulus) + modulus) % modulus;',
        '    let e = exponent;',
        '    while (e > 0n) {',
        '      if ((e & 1n) === 1n) result = (result * b) % modulus;',
        '      b = (b * b) % modulus;',
        '      e >>= 1n;',
        '    }',
        '    return result;',
        '  }',
        '',
        '  function isPrime(n) {',
        '    if (n < 2n) return false;',
        '    const bases = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];',
        '    for (let i = 0; i < bases.length; i += 1) {',
        '      if (n === bases[i]) return true;',
        '      if (n % bases[i] === 0n) return false;',
        '    }',
        '    // a Fermat test: it looks only at the END of the squaring chain',
        '    for (let i = 0; i < bases.length; i += 1) {',
        '      if (modPow(bases[i], n - 1n, n) !== 1n) return false;',
        '    }',
        '    return true;',
        '  }',
        '',
        '  return { modPow: modPow, isPrime: isPrime };',
        '}'
      ].join('\n'),
      solution: [
        'function primeKit() {',
        '  const BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n];',
        '',
        '  function modPow(base, exponent, modulus) {',
        '    let result = 1n;',
        '    let b = ((base % modulus) + modulus) % modulus;',
        '    let e = exponent;',
        '    while (e > 0n) {',
        '      if ((e & 1n) === 1n) result = (result * b) % modulus;',
        '      b = (b * b) % modulus;',
        '      e >>= 1n;',
        '    }',
        '    return result;',
        '  }',
        '',
        '  function round(n, base) {',
        '    let d = n - 1n;',
        '    let s = 0;',
        '    while ((d & 1n) === 0n) { d >>= 1n; s += 1; }',
        '',
        '    let x = modPow(base, d, n);',
        '    if (x === 1n || x === n - 1n) return true;',
        '',
        '    for (let i = 1; i < s; i += 1) {',
        '      x = (x * x) % n;',
        '      if (x === n - 1n) return true;',
        '      // reaching 1 without passing through n - 1 is a square root of',
        '      // one that a prime modulus does not have',
        '      if (x === 1n) return false;',
        '    }',
        '    return false;',
        '  }',
        '',
        '  function isPrime(n) {',
        '    if (n < 2n) return false;',
        '    for (let i = 0; i < BASES.length; i += 1) {',
        '      if (n === BASES[i]) return true;',
        '      if (n % BASES[i] === 0n) return false;',
        '    }',
        '    for (let i = 0; i < BASES.length; i += 1) {',
        '      if (!round(n, BASES[i])) return false;',
        '    }',
        '    return true;',
        '  }',
        '',
        '  return { modPow: modPow, isPrime: isPrime };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the Carmichael numbers, which every Fermat test accepts',
          assert: function (primeKit, api) {
            const kit = primeKit();
            const carmichael = [561n, 1105n, 1729n, 2465n, 2821n, 6601n, 8911n, 10585n,
              15841n, 29341n, 41041n, 46657n, 52633n, 62745n, 63973n, 75361n];

            for (let i = 0; i < carmichael.length; i += 1) {
              const n = carmichael[i];
              api.assert.equal(kit.isPrime(n), false,
                n + ' is composite; a Fermat test accepts it for every coprime base');
            }

            api.assert.equal(kit.modPow(2n, 560n, 561n), 1n,
              'and here is why: base 2 satisfies Fermat for 561 exactly');
            api.assert.equal(kit.modPow(4n, 560n, 561n), 1n, 'and so does base 4');
          }
        },
        {
          name: 'every number below 30 000 agrees with a sieve',
          assert: function (primeKit, api) {
            const kit = primeKit();
            const limit = 30000;
            const marks = new Uint8Array(limit + 1);

            for (let i = 2; i * i <= limit; i += 1) {
              if (marks[i] === 1) continue;
              for (let j = i * i; j <= limit; j += i) marks[j] = 1;
            }

            let wrong = 0;
            for (let n = 0; n <= limit; n += 1) {
              const expected = n >= 2 && marks[n] === 0;
              if (kit.isPrime(BigInt(n)) !== expected) wrong += 1;
            }
            api.assert.equal(wrong, 0, kit.isPrime ? wrong + ' disagreements below ' + limit : '');
          }
        },
        {
          name: 'modPow matches a direct computation, and its counts follow the exponent',
          assert: function (primeKit, api) {
            const kit = primeKit();

            api.assert.equal(kit.modPow(3n, 0n, 7n), 1n, 'anything to the zero is one');
            api.assert.equal(kit.modPow(0n, 5n, 7n), 0n, 'zero to a positive power is zero');
            api.assert.equal(kit.modPow(2n, 10n, 1000n), 24n, '1024 mod 1000');

            for (let trial = 0; trial < 400; trial += 1) {
              const modulus = BigInt(3 + api.rng.int(5000));
              const base = BigInt(api.rng.int(5000));
              const exponent = BigInt(api.rng.int(40));

              let expected = 1n;
              for (let i = 0n; i < exponent; i += 1n) expected = (expected * base) % modulus;
              api.assert.equal(kit.modPow(base, exponent, modulus), expected,
                base + '^' + exponent + ' mod ' + modulus);
            }
          }
        },
        {
          name: 'large primes and large composites, well past what trial division would reach',
          assert: function (primeKit, api) {
            const kit = primeKit();
            const primes = [1000003n, 1000000007n, 2147483647n, 999999000001n,
              67280421310721n, 2305843009213693951n];
            const composites = [1000001n, 2147483649n, 999999000003n,
              1000003n * 1000033n, 11489279n * 13782077n, 4759123141n];

            for (let i = 0; i < primes.length; i += 1) {
              api.assert.equal(kit.isPrime(primes[i]), true, primes[i] + ' is prime');
            }
            for (let i = 0; i < composites.length; i += 1) {
              api.assert.equal(kit.isPrime(composites[i]), false, composites[i] + ' is composite');
            }
            api.assert.equal(kit.isPrime(3215031751n), false,
              '3 215 031 751 is the smallest composite that bases 2, 3, 5 and 7 all accept, so a ' +
              'witness set chosen for a smaller bound gets it wrong');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
