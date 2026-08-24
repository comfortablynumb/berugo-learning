/**
 * Verifying an answer instead of computing it.
 *
 * Three algorithms, one idea: evaluate both sides of a claimed identity at a
 * random point. If the claim is true they agree everywhere and the test always
 * passes; if it is false the two sides differ as polynomials, and a non-zero
 * polynomial of degree d has at most d roots - so a point drawn from a set of
 * size S catches the lie with probability at least 1 - d/S. Repetition drives
 * that to whatever you want.
 *
 *   - Freivalds checks a claimed matrix product AB = C in O(n²) by comparing
 *     A(Bx) against Cx for random x over {0, 1}. One round catches any wrong
 *     product with probability at least 1/2, k rounds with 1 - 2^-k. Computing
 *     the product costs n^2.807 at best; checking it costs n² whatever the
 *     multiplication algorithm was, which is the entire argument for
 *     verifiable computation.
 *   - Schwartz-Zippel is the same statement for multivariate polynomials, and
 *     it is how you test that two expression trees are the same function
 *     without expanding either.
 *   - A polynomial fingerprint compares two long strings by one number, which
 *     is the same test again with the string read as a polynomial's
 *     coefficients.
 *
 * The one-sided error matters and is asserted throughout: these tests never
 * reject a correct claim. Every failure is a false accept, so repetition is
 * pure gain and there is no trade to tune.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Fingerprinting = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* -------------------------------------------------------------- matrices */

  function randomMatrix(n, rng, bound) {
    const out = [];
    const limit = bound === undefined ? 10 : bound;

    for (let i = 0; i < n; i += 1) {
      const row = new Array(n);
      for (let j = 0; j < n; j += 1) row[j] = rng.int(limit);
      out.push(row);
    }
    return out;
  }

  /** The schoolbook product, with its operation count as a reported field. */
  function multiply(a, b) {
    const n = a.length;
    const out = [];
    let operations = 0;

    for (let i = 0; i < n; i += 1) {
      const row = new Array(n).fill(0);
      for (let k = 0; k < n; k += 1) {
        for (let j = 0; j < n; j += 1) { row[j] += a[i][k] * b[k][j]; operations += 2; }
      }
      out.push(row);
    }
    return { matrix: out, operations: operations };
  }

  function applyVector(m, x, counter) {
    const n = m.length;
    const out = new Array(n).fill(0);

    for (let i = 0; i < n; i += 1) {
      for (let j = 0; j < n; j += 1) { out[i] += m[i][j] * x[j]; counter.operations += 2; }
    }
    return out;
  }

  /** Change one entry by `delta`, returning a copy and the cell changed. */
  function corrupt(matrix, options) {
    const settings = options || {};
    const rng = settings.rng;
    const out = matrix.map(function (row) { return row.slice(); });
    const cells = settings.cells === undefined ? 1 : settings.cells;
    const changed = [];

    for (let c = 0; c < cells; c += 1) {
      const i = rng.int(out.length);
      const j = rng.int(out.length);
      out[i][j] += settings.delta === undefined ? 1 : settings.delta;
      changed.push({ row: i, column: j });
    }
    return { matrix: out, changed: changed };
  }

  /**
   * Freivalds: k independent rounds, each comparing A(Bx) with Cx. Returns
   * the round the corruption was caught on - the number the demo plots
   * against 1 - 2^-k - and the operation count, which is the point.
   */
  function freivalds(claim, options) {
    const settings = options || {};
    const rng = settings.rng;
    const rounds = settings.rounds === undefined ? 8 : settings.rounds;
    const n = claim.a.length;
    const counter = { operations: 0 };

    for (let round = 0; round < rounds; round += 1) {
      const x = new Array(n);
      for (let i = 0; i < n; i += 1) x[i] = rng.int(2);
      const left = applyVector(claim.a, applyVector(claim.b, x, counter), counter);
      const right = applyVector(claim.c, x, counter);

      if (!vectorsEqual(left, right)) {
        return { rejected: true, roundsRun: round + 1, rounds: rounds,
          operations: counter.operations, bound: 1 - Math.pow(2, -(round + 1)) };
      }
    }
    return { rejected: false, roundsRun: rounds, rounds: rounds,
      operations: counter.operations, bound: 1 - Math.pow(2, -rounds) };
  }

  function vectorsEqual(a, b) {
    for (let i = 0; i < a.length; i += 1) { if (a[i] !== b[i]) return false; }
    return true;
  }

  /* ------------------------------------------------ polynomial identities */

  const FIELDS = [101, 1009, 10007, 1000003];

  function mod(value, p) {
    const out = value % p;
    return out < 0 ? out + p : out;
  }

  /**
   * Two expression trees over a prime field, evaluated at random points.
   * `left` and `right` are functions of (point, p) returning a field element;
   * `degree` is the total degree, which is what the Schwartz-Zippel bound
   * needs and which nobody can read off the tree by inspection.
   */
  function identityTest(claim, options) {
    const settings = options || {};
    const rng = settings.rng;
    const p = settings.field === undefined ? 1009 : settings.field;
    const trials = settings.trials === undefined ? 5 : settings.trials;
    const witnesses = [];

    for (let t = 0; t < trials; t += 1) {
      const point = [];
      for (let v = 0; v < claim.variables; v += 1) point.push(rng.int(p));
      const l = mod(claim.left(point, p), p);
      const r = mod(claim.right(point, p), p);
      if (l !== r) witnesses.push({ point: point, left: l, right: r, trial: t });
    }
    return { equal: witnesses.length === 0, witnesses: witnesses, trials: trials,
      field: p, bound: Math.min(1, claim.degree / p),
      failureBound: Math.pow(Math.min(1, claim.degree / p), trials) };
  }

  /** The identity the test should always accept, and the near-miss it should
   *  usually reject: (x + y)(x - y) against x² - y², and against x² - y² + xy. */
  function polynomialClaims() {
    return [
      { name: '(x + y)(x − y) = x² − y²', variables: 2, degree: 2, holds: true,
        left: function (v, p) { return mod((v[0] + v[1]) * mod(v[0] - v[1], p), p); },
        right: function (v, p) { return mod(v[0] * v[0] - v[1] * v[1], p); } },
      { name: '(x + y)³ = x³ + 3x²y + 3xy² + y³', variables: 2, degree: 3, holds: true,
        left: function (v, p) {
          const s = mod(v[0] + v[1], p);
          return mod(mod(s * s, p) * s, p);
        },
        right: function (v, p) {
          const x = v[0];
          const y = v[1];
          return mod(mod(x * x, p) * x + 3 * mod(x * x, p) * y +
            3 * x * mod(y * y, p) + mod(y * y, p) * y, p);
        } },
      { name: '(x + y)(x − y) = x² − y² + xy  (false, one term wrong)',
        variables: 2, degree: 2, holds: false,
        left: function (v, p) { return mod((v[0] + v[1]) * mod(v[0] - v[1], p), p); },
        right: function (v, p) { return mod(v[0] * v[0] - v[1] * v[1] + v[0] * v[1], p); } },
      { name: '∏(xᵢ − i) = 0  (false, but zero on most of a small field)',
        variables: 3, degree: 3, holds: false,
        left: function (v, p) {
          return mod(mod(mod(v[0] - 1, p) * mod(v[1] - 2, p), p) * mod(v[2] - 3, p), p);
        },
        right: function () { return 0; } }
    ];
  }

  /* --------------------------------------------------- string fingerprints */

  /**
   * A random-base polynomial fingerprint of a sequence of field elements:
   * Horner's rule mod p. Two unequal sequences of length n collide for at most
   * n - 1 of the p bases, because their difference is a non-zero polynomial of
   * degree at most n - 1 and a polynomial has at most as many roots as its
   * degree.
   */
  function fingerprint(values, options) {
    const settings = options || {};
    const p = settings.field === undefined ? 1000003 : settings.field;
    const base = settings.base;
    let out = 0;

    for (let i = 0; i < values.length; i += 1) {
      out = mod(out * base + values[i], p);
    }
    return out;
  }

  /** Two sequences differing in exactly one position - the ordinary case. */
  function randomPair(options) {
    const settings = options || {};
    const rng = settings.rng;
    const length = settings.length === undefined ? 5000 : settings.length;
    const p = settings.field === undefined ? 1000003 : settings.field;
    const a = new Array(length);

    for (let i = 0; i < length; i += 1) a[i] = rng.int(Math.min(p, 256));
    const b = a.slice();
    const at = rng.int(length);
    b[at] = (b[at] + 1) % Math.min(p, 256);
    return { a: a, b: b, differsAt: at, field: p, kind: 'one character' };
  }

  /**
   * The pair the n/p bound is actually about. Choose d bases you want to
   * defeat, expand the polynomial with exactly those roots, and use its
   * coefficients as the difference between the two sequences - so the
   * fingerprints agree for precisely those d bases and no others.
   *
   * Without this, the section quotes a bound of n/p beside a measured rate of
   * zero and calls that agreement. A single-character difference is a MONOMIAL:
   * its only root is base zero, which is never drawn, so it never collides at
   * any field size. The bound is a worst case and the worst case has to be
   * built.
   */
  function adversarialPair(options) {
    const settings = options || {};
    const rng = settings.rng;
    const p = settings.field === undefined ? 1000003 : settings.field;
    const wanted = Math.min(settings.roots === undefined ? 8 : settings.roots, p - 4);
    const roots = [];
    const seen = new Set();

    while (roots.length < wanted) {
      const r = 2 + rng.int(p - 3);
      if (seen.has(r)) continue;
      seen.add(r);
      roots.push(r);
    }
    const coefficients = expandRoots(roots, p);
    return { a: coefficients, b: new Array(coefficients.length).fill(0), roots: roots,
      field: p, kind: 'built to collide on ' + roots.length + ' bases' };
  }

  /** The coefficients of prod(x - r), highest power first, mod p. */
  function expandRoots(roots, p) {
    let poly = [1];

    roots.forEach(function (r) {
      const next = new Array(poly.length + 1).fill(0);
      for (let i = 0; i < poly.length; i += 1) {
        next[i] = mod(next[i] + poly[i], p);
        next[i + 1] = mod(next[i + 1] - poly[i] * r, p);
      }
      poly = next;
    });
    return poly;
  }

  /**
   * Compare the pair over many random bases and report the measured collision
   * rate beside the n/p bound. The base is redrawn every trial: with a fixed
   * base an adversary picks the second sequence to collide and the bound
   * describes nothing at all.
   */
  function compareByFingerprint(pair, options) {
    const settings = options || {};
    const rng = settings.rng;
    const p = pair.field;
    const trials = settings.trials === undefined ? 2000 : settings.trials;
    let collisions = 0;

    for (let t = 0; t < trials; t += 1) {
      const base = 2 + rng.int(p - 3);
      if (fingerprint(pair.a, { field: p, base: base }) ===
        fingerprint(pair.b, { field: p, base: base })) collisions += 1;
    }
    const degree = Math.max(pair.a.length, pair.b.length) - 1;
    return { collisions: collisions, trials: trials, rate: collisions / trials,
      bound: Math.min(1, degree / p), field: p, kind: pair.kind,
      roots: pair.roots ? pair.roots.length : 0, length: pair.a.length,
      bitsCompared: Math.log2(p), bitsInText: 8 * pair.a.length };
  }

  /* -------------------------------------------------- Merkle verification */

  function mixHash(a, b) {
    let h = (a ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
    h = (h ^ b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  function leafHash(value) {
    let h = 2166136261 >>> 0;
    const text = String(value);
    for (let i = 0; i < text.length; i += 1) {
      h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /** The full tree, level by level, so a proof is a slice of it. */
  function merkleTree(leaves) {
    const levels = [leaves.map(leafHash)];

    while (levels[levels.length - 1].length > 1) {
      const below = levels[levels.length - 1];
      const above = [];
      for (let i = 0; i < below.length; i += 2) {
        above.push(mixHash(below[i], i + 1 < below.length ? below[i + 1] : below[i]));
      }
      levels.push(above);
    }
    return { levels: levels, root: levels[levels.length - 1][0], leaves: leaves.length,
      proofLength: levels.length - 1 };
  }

  /** The sibling hashes on the path from a leaf to the root. */
  function merkleProof(tree, index) {
    const path = [];
    let at = index;

    for (let level = 0; level + 1 < tree.levels.length; level += 1) {
      const row = tree.levels[level];
      const sibling = at % 2 === 0 ? Math.min(at + 1, row.length - 1) : at - 1;
      path.push({ hash: row[sibling], onRight: at % 2 === 0 });
      at = Math.floor(at / 2);
    }
    return path;
  }

  function verifyProof(value, proof, root) {
    let h = leafHash(value);

    for (let i = 0; i < proof.length; i += 1) {
      h = proof[i].onRight ? mixHash(h, proof[i].hash) : mixHash(proof[i].hash, h);
    }
    return { valid: h === root, computed: h, root: root, hashes: proof.length };
  }

  return {
    randomMatrix: randomMatrix, multiply: multiply, corrupt: corrupt, freivalds: freivalds,
    identityTest: identityTest, polynomialClaims: polynomialClaims, FIELDS: FIELDS,
    fingerprint: fingerprint, compareByFingerprint: compareByFingerprint,
    randomPair: randomPair, adversarialPair: adversarialPair, expandRoots: expandRoots,
    merkleTree: merkleTree, merkleProof: merkleProof, verifyProof: verifyProof,
    leafHash: leafHash, mixHash: mixHash, mod: mod
  };
}));
