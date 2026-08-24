/**
 * Shamir secret sharing, commitments and Merkle trees.
 *
 * ⚠ TEACHING CODE. Not constant-time, not audited, never for real data.
 *
 * Three constructions that share one idea: replace "trust me" with "check this".
 *
 * Shamir's scheme is a fact about polynomials. A polynomial of degree k − 1 is
 * determined by any k points on it and by NO fewer — with k − 1 points, every
 * value of the constant term is still consistent with exactly one polynomial,
 * so k − 1 shares leave the secret exactly as uncertain as it was. That is
 * information-theoretic rather than computational: it does not depend on an
 * attacker's resources at all.
 *
 * A commitment is "I have decided, and I will prove later that I have not
 * changed my mind" — hiding (the commitment reveals nothing) and binding (you
 * cannot open it two ways).
 *
 * A Merkle tree is the most reusable idea in the milestone. It turns "trust the
 * server's list" into "verify one path of log n hashes", and it is why Git,
 * Certificate Transparency, blockchains, backup systems and replication
 * protocols all look slightly alike.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Threshold = api;
}(this, function (root) {
  'use strict';

  const Hash = root && root.CryptoHash ? root.CryptoHash : require('./crypto-hash.js');

  const DISCLAIMER = 'Teaching implementation: not constant-time, not audited, never for real data.';

  /* ------------------------------------------------ Shamir secret sharing */

  const PRIME = 2147483647n;

  function mod(value, p) {
    return ((value % p) + p) % p;
  }

  function inverse(a, p) {
    let [oldR, r] = [mod(a, p), p];
    let [oldS, s] = [1n, 0n];

    while (r !== 0n) {
      const q = oldR / r;

      [oldR, r] = [r, oldR - q * r];
      [oldS, s] = [s, oldS - q * s];
    }
    return mod(oldS, p);
  }

  /**
   * Split a secret into n shares of which any k reconstruct it. The secret is
   * the constant term of a random polynomial of degree k − 1, and each share is
   * one point on it.
   */
  function split(config) {
    const p = config.prime === undefined ? PRIME : config.prime;
    const coefficients = [mod(config.secret, p)];

    for (let i = 1; i < config.k; i += 1) {
      coefficients.push(mod(BigInt(Math.floor(config.rng.next() * 1e9)), p));
    }
    const shares = [];

    for (let x = 1; x <= config.n; x += 1) {
      shares.push({ x: BigInt(x), y: evaluate(coefficients, BigInt(x), p) });
    }
    return { shares: shares, k: config.k, n: config.n, prime: p,
      degree: config.k - 1, coefficients: coefficients };
  }

  function evaluate(coefficients, x, p) {
    let value = 0n;

    for (let i = coefficients.length - 1; i >= 0; i -= 1) {
      value = mod(value * x + coefficients[i], p);
    }
    return value;
  }

  /**
   * Lagrange interpolation at zero: the constant term is a weighted sum of the
   * shares, and the weights depend only on the x coordinates. Any k shares give
   * the same answer, which is the guarantee stated as arithmetic.
   */
  function reconstruct(shares, prime) {
    return interpolateAt(shares, 0n, prime === undefined ? PRIME : prime);
  }

  /** The same Lagrange sum evaluated anywhere, so `underdetermined` can ask
   *  what a candidate secret would imply about a share nobody holds. */
  function interpolateAt(points, at, prime) {
    const p = prime === undefined ? PRIME : prime;
    let value = 0n;

    points.forEach(function (point, i) {
      let numerator = 1n;
      let denominator = 1n;

      points.forEach(function (other, j) {
        if (i === j) return;
        numerator = mod(numerator * mod(at - other.x, p), p);
        denominator = mod(denominator * mod(point.x - other.x, p), p);
      });
      value = mod(value + point.y * numerator % p * inverse(denominator, p), p);
    });
    return value;
  }

  /**
   * What k − 1 shares actually tell an attacker: for EVERY candidate secret
   * there is exactly one polynomial through those shares with that constant
   * term. The demo enumerates candidates and shows each one is consistent,
   * which is what "information-theoretic" means made checkable.
   */
  function underdetermined(config) {
    const p = config.prime === undefined ? PRIME : config.prime;
    const shares = config.shares;
    const probe = config.probe === undefined ? BigInt(shares.length + 90) : config.probe;
    const candidates = [];
    const seen = new Set();

    for (let i = 0; i < config.candidates; i += 1) {
      const guess = mod(BigInt(config.from === undefined ? 0 : config.from) + BigInt(i), p);
      const points = [{ x: 0n, y: guess }].concat(shares);

      candidates.push({ secret: guess, implies: interpolateAt(points, probe, p),
        consistent: reproduces(points, shares, p) });
      seen.add(candidates[candidates.length - 1].implies.toString());
    }
    return {
      shares: shares.length, needed: config.k, probe: probe,
      candidates: candidates, distinctImplied: seen.size,
      allConsistent: candidates.every(function (entry) { return entry.consistent; })
    };
  }

  /** Does the polynomial through `points` still pass through every share the
   *  attacker actually holds? It must, for every candidate — which is what
   *  "these shares constrain nothing" means, checked rather than asserted. */
  function reproduces(points, shares, prime) {
    return shares.every(function (share) {
      return interpolateAt(points, share.x, prime) === share.y;
    });
  }

  /* ------------------------------------------------------------ commitments */

  /** Commit with a random opening value, so the commitment hides the message;
   *  the hash binds it, because opening it two ways means a collision. */
  function commit(message, rng) {
    const opening = [];

    for (let i = 0; i < 32; i += 1) opening.push(Math.floor(rng.next() * 256));
    return { commitment: Hash.sha256(opening.concat(message)), opening: opening };
  }

  function openCommitment(commitment, opening, message) {
    const recomputed = Hash.sha256(opening.concat(message));

    return recomputed.every(function (byte, i) { return byte === commitment[i]; });
  }

  /* ---------------------------------------------------------- Merkle trees */

  function leafHash(value) {
    return Hash.sha256([0x00].concat(value));
  }

  function nodeHash(left, right) {
    return Hash.sha256([0x01].concat(left).concat(right));
  }

  /**
   * The tree, level by level. An odd node at a level is carried up unchanged
   * rather than duplicated — duplicating is the bug behind Bitcoin's CVE-2012-2459,
   * where two different trees produced the same root.
   */
  function buildTree(values) {
    if (values.length === 0) return { root: Hash.sha256([]), levels: [], leaves: 0 };
    let level = values.map(leafHash);
    const levels = [level];

    while (level.length > 1) {
      const next = [];

      for (let i = 0; i < level.length; i += 2) {
        next.push(i + 1 < level.length ? nodeHash(level[i], level[i + 1]) : level[i]);
      }
      level = next;
      levels.push(level);
    }
    return { root: level[0], levels: levels, leaves: values.length };
  }

  /** The sibling hashes from a leaf to the root, with the side each one sits
   *  on — which is all a verifier needs, and it is log n of them. */
  function proof(tree, index) {
    const path = [];
    let at = index;

    for (let level = 0; level < tree.levels.length - 1; level += 1) {
      const nodes = tree.levels[level];
      const sibling = at % 2 === 0 ? at + 1 : at - 1;

      if (sibling < nodes.length) path.push({ hash: nodes[sibling], right: at % 2 === 0 });
      at = Math.floor(at / 2);
    }
    return { index: index, path: path, length: path.length };
  }

  function verifyProof(config) {
    let running = leafHash(config.value);

    config.proof.path.forEach(function (step) {
      running = step.right ? nodeHash(running, step.hash) : nodeHash(step.hash, running);
    });
    return running.every(function (byte, i) { return byte === config.root[i]; });
  }

  /** Proof size against list size — the reason this construction is everywhere:
   *  a million entries need twenty hashes to prove membership. */
  function proofCost(sizes) {
    return sizes.map(function (size) {
      return { entries: size, proofHashes: Math.ceil(Math.log2(size)),
        proofBytes: Math.ceil(Math.log2(size)) * 32,
        fullListBytes: size * 32,
        saving: size * 32 / Math.max(1, Math.ceil(Math.log2(size)) * 32) };
    });
  }

  return {
    DISCLAIMER: DISCLAIMER, PRIME: PRIME,
    split: split, reconstruct: reconstruct, evaluate: evaluate, underdetermined: underdetermined,
    interpolateAt: interpolateAt,
    commit: commit, openCommitment: openCommitment,
    buildTree: buildTree, proof: proof, verifyProof: verifyProof, proofCost: proofCost,
    leafHash: leafHash, nodeHash: nodeHash, inverse: inverse
  };
}));
