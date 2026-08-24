/**
 * Graded exercises for constant-time code and applied constructions (M23.10-M23.11).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'constant-time-programming': [{
      id: 'branchless-compare-and-select',
      title: 'Compare and select without branching on a secret',
      prompt: 'ct(op, args) must implement two branchless primitives. op "select" takes ' +
        '{ condition, whenTrue, whenFalse } of 32-bit values and returns whenTrue when condition ' +
        'is 1 and whenFalse when it is 0 — using a mask, not an if. op "equals" takes ' +
        '{ a, b } of byte arrays and returns true only if they are identical, reading EVERY byte ' +
        'of both no matter where they first differ, and treating a length mismatch as a failure. ' +
        'The tests watch which indices you read, so an early exit is detected directly. The ' +
        'starter uses an if and a short-circuiting loop.',
      entry: 'ct',
      starter: [
        'function ct(op, args) {',
        '  if (op === \'select\') {',
        '    // A branch on a secret condition: observable from anywhere.',
        '    if (args.condition) return args.whenTrue;',
        '    return args.whenFalse;',
        '  }',
        '  if (op === \'equals\') {',
        '    if (args.a.length !== args.b.length) return false;',
        '    for (let i = 0; i < args.a.length; i += 1) {',
        '      if (args.a[i] !== args.b[i]) return false;',
        '    }',
        '    return true;',
        '  }',
        '  return null;',
        '}'
      ].join('\n'),
      solution: [
        'function ct(op, args) {',
        '  if (op === \'select\') {',
        '    const mask = -(args.condition & 1);',
        '',
        '    return ((args.whenTrue & mask) | (args.whenFalse & ~mask)) >>> 0;',
        '  }',
        '  if (op === \'equals\') {',
        '    const a = args.a;',
        '    const b = args.b;',
        '    let diff = a.length ^ b.length;',
        '    const limit = Math.max(a.length, b.length);',
        '',
        '    for (let i = 0; i < limit; i += 1) {',
        '      const left = i < a.length ? a[i] : 0;',
        '      const right = i < b.length ? b[i] : 0;',
        '',
        '      diff |= left ^ right;',
        '    }',
        '    return diff === 0;',
        '  }',
        '  return null;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'select returns the right value for both conditions',
          assert: function (ct, api) {
            api.assert.equal(ct('select', { condition: 1, whenTrue: 0xaa, whenFalse: 0xbb }),
              0xaa, 'condition 1 selects the first value');
            api.assert.equal(ct('select', { condition: 0, whenTrue: 0xaa, whenFalse: 0xbb }),
              0xbb, 'condition 0 selects the second');
            api.assert.equal(
              ct('select', { condition: 1, whenTrue: 0xffffffff, whenFalse: 0 }) >>> 0,
              0xffffffff, 'and it must survive the full 32-bit range');
            api.assert.equal(
              ct('select', { condition: 0, whenTrue: 0xffffffff, whenFalse: 0x12345678 }) >>> 0,
              0x12345678, 'in both directions');
          }
        },
        {
          name: 'equals is correct, including on lengths',
          assert: function (ct, api) {
            api.assert.equal(ct('equals', { a: [1, 2, 3], b: [1, 2, 3] }), true,
              'identical arrays are equal');
            api.assert.equal(ct('equals', { a: [1, 2, 3], b: [1, 2, 4] }), false,
              'a difference in the last byte is a difference');
            api.assert.equal(ct('equals', { a: [1, 2, 3], b: [9, 2, 3] }), false,
              'and so is one in the first');
            api.assert.equal(ct('equals', { a: [1, 2, 3], b: [1, 2] }), false,
              'a short tag is a rejected tag');
            api.assert.equal(ct('equals', { a: [], b: [] }), true, 'two empty arrays are equal');
          }
        },
        {
          name: 'equals reads every byte, whatever the inputs',
          assert: function (ct, api) {
            function watched(values, reads) {
              const out = [];

              values.forEach(function (value, index) {
                Object.defineProperty(out, index, {
                  enumerable: true,
                  configurable: true,
                  get: function () { reads.push(index); return value; }
                });
              });
              out.length = values.length;
              return out;
            }
            const secret = [10, 20, 30, 40, 50, 60, 70, 80];

            const earlyReads = [];
            const early = watched([99, 20, 30, 40, 50, 60, 70, 80], earlyReads);

            ct('equals', { a: watched(secret, []), b: early });
            api.assert.equal(new Set(earlyReads).size, 8,
              'byte 0 already differs, and all 8 must still be read');

            const lateReads = [];
            const late = watched([10, 20, 30, 40, 50, 60, 70, 99], lateReads);

            ct('equals', { a: watched(secret, []), b: late });
            api.assert.equal(new Set(lateReads).size, 8,
              'and a difference in the last byte must read the same 8');
          }
        }
      ]
    }],

    'applied-constructions': [{
      id: 'shamir-reconstruction',
      title: 'Reconstruct a shared secret, and check what one share short reveals',
      prompt: 'shamir(op, args) must work over a prime field with BigInt values. op "evaluate" ' +
        'takes { coefficients, x, prime } and returns the polynomial evaluated at x, modulo the ' +
        'prime, with coefficients[0] the constant term. op "interpolate" takes { points, at, ' +
        'prime } and returns the value at `at` of the unique polynomial through those points, by ' +
        'Lagrange interpolation — reconstructing a secret is this with at = 0. Every result must ' +
        'be a non-negative BigInt below the prime. The starter sums the shares, which is what ' +
        'the scheme is NOT.',
      entry: 'shamir',
      opsLimit: 4000000,
      starter: [
        'function shamir(op, args) {',
        '  if (op === \'evaluate\') {',
        '    let value = 0n;',
        '',
        '    args.coefficients.forEach(function (c) { value = (value + c) % args.prime; });',
        '    return value;',
        '  }',
        '  if (op === \'interpolate\') {',
        '    let total = 0n;',
        '',
        '    args.points.forEach(function (p) { total = (total + p.y) % args.prime; });',
        '    return total;',
        '  }',
        '  return null;',
        '}'
      ].join('\n'),
      solution: [
        'function shamir(op, args) {',
        '  function mod(value, p) { return ((value % p) + p) % p; }',
        '  function inverse(a, p) {',
        '    let [oldR, r] = [mod(a, p), p];',
        '    let [oldS, s] = [1n, 0n];',
        '',
        '    while (r !== 0n) {',
        '      const q = oldR / r;',
        '',
        '      [oldR, r] = [r, oldR - q * r];',
        '      [oldS, s] = [s, oldS - q * s];',
        '    }',
        '    return mod(oldS, p);',
        '  }',
        '  if (op === \'evaluate\') {',
        '    const p = args.prime;',
        '    let value = 0n;',
        '',
        '    for (let i = args.coefficients.length - 1; i >= 0; i -= 1) {',
        '      value = mod(value * args.x + args.coefficients[i], p);',
        '    }',
        '    return value;',
        '  }',
        '  if (op === \'interpolate\') {',
        '    const p = args.prime;',
        '    const points = args.points;',
        '    let value = 0n;',
        '',
        '    points.forEach(function (point, i) {',
        '      let numerator = 1n;',
        '      let denominator = 1n;',
        '',
        '      points.forEach(function (other, j) {',
        '        if (i === j) return;',
        '        numerator = mod(numerator * mod(args.at - other.x, p), p);',
        '        denominator = mod(denominator * mod(point.x - other.x, p), p);',
        '      });',
        '      value = mod(value + point.y * numerator % p * inverse(denominator, p), p);',
        '    });',
        '    return value;',
        '  }',
        '  return null;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every k-subset of the shares reconstructs the same secret',
          assert: function (shamir, api) {
            const prime = 2147483647n;
            const coefficients = [1234567n, 987654n, 246813n];
            const shares = [];

            for (let x = 1n; x <= 5n; x += 1n) {
              shares.push({ x: x,
                y: shamir('evaluate', { coefficients: coefficients, x: x, prime: prime }) });
            }
            let subsets = 0;

            for (let a = 0; a < 5; a += 1) {
              for (let b = a + 1; b < 5; b += 1) {
                for (let c = b + 1; c < 5; c += 1) {
                  const picked = [shares[a], shares[b], shares[c]];
                  const secret = shamir('interpolate',
                    { points: picked, at: 0n, prime: prime });

                  api.assert.equal(secret.toString(), '1234567',
                    'shares ' + a + ',' + b + ',' + c + ' must reconstruct the secret');
                  subsets += 1;
                }
              }
            }
            api.assert.equal(subsets, 10, 'all 10 three-share subsets must have been checked');
          }
        },
        {
          name: 'one share short returns a wrong value rather than an error',
          assert: function (shamir, api) {
            const prime = 2147483647n;
            const coefficients = [1234567n, 987654n, 246813n];
            const shares = [];

            for (let x = 1n; x <= 5n; x += 1n) {
              shares.push({ x: x,
                y: shamir('evaluate', { coefficients: coefficients, x: x, prime: prime }) });
            }
            const short = shamir('interpolate',
              { points: [shares[0], shares[1]], at: 0n, prime: prime });

            api.assert.ok(short >= 0n && short < prime, 'it still returns a field element');
            api.assert.notEqual(short.toString(), '1234567',
              'and it is not the secret — which is why the share count must be checked');
          }
        },
        {
          name: 'every candidate secret is consistent with k − 1 shares',
          assert: function (shamir, api) {
            const prime = 2147483647n;
            const coefficients = [1234567n, 987654n, 246813n];
            const held = [];

            for (let x = 1n; x <= 2n; x += 1n) {
              held.push({ x: x,
                y: shamir('evaluate', { coefficients: coefficients, x: x, prime: prime }) });
            }
            const implied = new Set();

            for (let guess = 1234564n; guess < 1234572n; guess += 1n) {
              const points = [{ x: 0n, y: guess }].concat(held);

              held.forEach(function (share) {
                const back = shamir('interpolate',
                  { points: points, at: share.x, prime: prime });

                api.assert.equal(back.toString(), share.y.toString(),
                  'the polynomial through candidate ' + guess + ' must still fit every held share');
              });
              implied.add(shamir('interpolate',
                { points: points, at: 92n, prime: prime }).toString());
            }
            api.assert.equal(implied.size, 8,
              'and each candidate implies a different value for a share nobody holds');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
