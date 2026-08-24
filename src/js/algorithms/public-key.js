/**
 * RSA, Diffie–Hellman and elliptic curves — at sizes small enough to break.
 *
 * ⚠ TEACHING CODE. The parameters here are deliberately tiny so that the demo
 * can break them in the browser, which is the point: the parameter size IS the
 * security, and nothing else about the arithmetic changes between a group a
 * laptop breaks in a second and one nothing breaks. Never use any of this.
 *
 * Three things are worth carrying out of this module:
 *
 * - **Textbook RSA is malleable.** Encryption is m^e mod n, so the ciphertext
 *   of 2m is 2^e times the ciphertext of m. An attacker who can get one chosen
 *   ciphertext decrypted can recover any other plaintext, and the demo does
 *   exactly that. OAEP exists because of this, not as a formality.
 * - **Diffie–Hellman's security is the discrete logarithm.** The demo runs the
 *   whole exchange with both parties' arithmetic visible and then breaks it by
 *   brute force, which takes milliseconds at 16 bits and is the same algorithm
 *   at 2048.
 * - **Elliptic curves get the same security from far smaller numbers**, because
 *   the best known attack on a well-chosen curve is generic square-root work
 *   rather than index calculus.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.PublicKey = api;
}(this, function () {
  'use strict';

  const DISCLAIMER = 'Teaching implementation: toy parameters, breakable by design, never for real data.';

  /* ------------------------------------------------------- modular arithmetic */

  function modPow(base, exponent, modulus) {
    let result = 1n;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;

    while (e > 0n) {
      if (e & 1n) result = (result * b) % modulus;
      b = (b * b) % modulus;
      e >>= 1n;
    }
    return result;
  }

  /** The extended Euclidean algorithm, which is where the private exponent and
   *  every division in a finite field comes from. */
  function egcd(a, b) {
    if (b === 0n) return { g: a, x: 1n, y: 0n };
    const inner = egcd(b, a % b);

    return { g: inner.g, x: inner.y, y: inner.x - (a / b) * inner.y };
  }

  function modInverse(a, m) {
    const result = egcd(((a % m) + m) % m, m);

    if (result.g !== 1n) return null;
    return ((result.x % m) + m) % m;
  }

  function isProbablePrime(n, rounds) {
    if (n < 2n) return false;
    for (const small of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
      if (n === small) return true;
      if (n % small === 0n) return false;
    }
    let d = n - 1n;
    let r = 0n;

    while (d % 2n === 0n) {
      d /= 2n;
      r += 1n;
    }
    for (let i = 0; i < (rounds === undefined ? 12 : rounds); i += 1) {
      const a = 2n + BigInt(i) * 3n;

      if (!millerRabin(n, a % (n - 3n) + 2n, d, r)) return false;
    }
    return true;
  }

  function millerRabin(n, a, d, r) {
    let x = modPow(a, d, n);

    if (x === 1n || x === n - 1n) return true;
    for (let i = 1n; i < r; i += 1n) {
      x = (x * x) % n;
      if (x === n - 1n) return true;
    }
    return false;
  }

  /* --------------------------------------------------------------- RSA */

  /** Key generation from two primes. Real generation searches for primes of
   *  1024 bits or more; this takes them as parameters so the demo can show a
   *  key an attacker can factor. */
  function rsaKey(p, q, e) {
    const n = p * q;
    const phi = (p - 1n) * (q - 1n);
    const exponent = e === undefined ? 65537n : e;
    const d = modInverse(exponent, phi);

    if (d === null) return null;
    return { n: n, e: exponent, d: d, p: p, q: q, phi: phi,
      bits: n.toString(2).length };
  }

  function rsaEncrypt(message, key) {
    return modPow(message, key.e, key.n);
  }

  function rsaDecrypt(ciphertext, key) {
    return modPow(ciphertext, key.d, key.n);
  }

  /** Factoring by trial division: hopeless at 2048 bits and instant at 32,
   *  which is the whole argument for key size stated as a measurement. */
  function factor(n) {
    let steps = 0;

    for (let i = 2n; i * i <= n; i += 1n) {
      steps += 1;
      if (n % i === 0n) return { p: i, q: n / i, steps: steps };
    }
    return { p: null, q: null, steps: steps };
  }

  /**
   * The chosen-ciphertext malleability attack on textbook RSA. The attacker has
   * a ciphertext c they may not submit, and an oracle that decrypts anything
   * else. Multiply c by s^e, submit that, and divide the answer by s: RSA's
   * homomorphism hands the plaintext over.
   */
  function malleabilityAttack(config) {
    const s = config.blind === undefined ? 2n : config.blind;
    const blinded = (config.ciphertext * modPow(s, config.key.e, config.key.n)) % config.key.n;
    const oracleAnswer = config.oracle(blinded);
    const recovered = (oracleAnswer * modInverse(s, config.key.n)) % config.key.n;

    return { blindFactor: s, blinded: blinded, oracleAnswer: oracleAnswer,
      recovered: recovered };
  }

  /* ------------------------------------------------------ Diffie–Hellman */

  /** The exchange, with every intermediate value kept so the demo can show
   *  both parties and the eavesdropper side by side. */
  function diffieHellman(config) {
    const p = config.p;
    const g = config.g;
    const A = modPow(g, config.a, p);
    const B = modPow(g, config.b, p);

    return {
      p: p, g: g,
      alicePrivate: config.a, bobPrivate: config.b,
      alicePublic: A, bobPublic: B,
      aliceShared: modPow(B, config.a, p),
      bobShared: modPow(A, config.b, p),
      eavesdropperSees: { p: p, g: g, A: A, B: B }
    };
  }

  /** Brute-force discrete log: the attack the parameter size is chosen to make
   *  infeasible, run here to show that it is only infeasible because of size. */
  function discreteLog(target, g, p, limit) {
    const cap = limit === undefined ? 1e7 : limit;
    let value = 1n;

    for (let x = 0; x < cap; x += 1) {
      if (value === target) return { x: x, steps: x + 1, found: true };
      value = (value * g) % p;
    }
    return { x: null, steps: cap, found: false };
  }

  /* ------------------------------------------------------ elliptic curves */

  /**
   * A short Weierstrass curve y² = x³ + ax + b over a prime field. The group
   * law is the chord-and-tangent construction: the line through two points hits
   * the curve in a third, and the sum is its reflection.
   */
  function curve(a, b, p, gx, gy, order) {
    return { a: a, b: b, p: p, g: { x: gx, y: gy }, n: order };
  }

  const INFINITY = { infinity: true };

  function isOnCurve(point, c) {
    if (point.infinity) return true;
    const left = (point.y * point.y) % c.p;
    const right = (point.x * point.x % c.p * point.x + c.a * point.x + c.b) % c.p;

    return ((left - right) % c.p + c.p) % c.p === 0n;
  }

  function pointAdd(p1, p2, c) {
    if (p1.infinity) return p2;
    if (p2.infinity) return p1;
    if (p1.x === p2.x && (p1.y + p2.y) % c.p === 0n) return INFINITY;
    const slope = p1.x === p2.x && p1.y === p2.y
      ? ((3n * p1.x * p1.x + c.a) * modInverse(2n * p1.y, c.p)) % c.p
      : ((p2.y - p1.y + c.p) * modInverse(((p2.x - p1.x) % c.p + c.p) % c.p, c.p)) % c.p;
    const x = (((slope * slope - p1.x - p2.x) % c.p) + c.p) % c.p;
    const y = (((slope * (p1.x - x) - p1.y) % c.p) + c.p) % c.p;

    return { x: x, y: y };
  }

  /** Double-and-add. A real implementation makes this constant-time, because
   *  the branch below is on a bit of the SECRET scalar. */
  function scalarMul(k, point, c) {
    let result = INFINITY;
    let addend = point;
    let scalar = k;

    while (scalar > 0n) {
      if (scalar & 1n) result = pointAdd(result, addend, c);
      addend = pointAdd(addend, addend, c);
      scalar >>= 1n;
    }
    return result;
  }

  function ecdh(config) {
    const c = config.curve;
    const A = scalarMul(config.a, c.g, c);
    const B = scalarMul(config.b, c.g, c);

    return {
      alicePublic: A, bobPublic: B,
      aliceShared: scalarMul(config.a, B, c),
      bobShared: scalarMul(config.b, A, c)
    };
  }

  /** A small curve whose order is known, so the demo can walk the whole group
   *  and break a key by exhaustive search. */
  function toyCurve() {
    return curve(2n, 3n, 97n, 3n, 6n, 5n);
  }

  /**
   * A larger curve for the ECDH and ECDSA demos: y² = x³ + 3x + 1 over the
   * prime 10 007, with a generator of PRIME order 3 359. The order has to be
   * prime for ECDSA — every signature inverts a nonce modulo it, and a
   * composite order leaves nonces with no inverse. Still breakable by
   * exhaustive search in a fraction of a second, which is deliberate: the
   * arithmetic is identical to a curve nothing breaks, and only the size
   * differs.
   */
  function demoCurve() {
    return curve(3n, 1n, 10007n, 8n, 4836n, 3359n);
  }

  /** Security levels as they are actually quoted, so the comparison between
   *  families is a table rather than an assertion. */
  function keySizeTable() {
    return [
      { bits: 80, rsa: 1024, dh: 1024, ecc: 160, note: 'broken in practice; no longer acceptable' },
      { bits: 112, rsa: 2048, dh: 2048, ecc: 224, note: 'the current minimum for new systems' },
      { bits: 128, rsa: 3072, dh: 3072, ecc: 256, note: 'the common target — X25519 and P-256 live here' },
      { bits: 192, rsa: 7680, dh: 7680, ecc: 384, note: 'where RSA key sizes become operationally painful' },
      { bits: 256, rsa: 15360, dh: 15360, ecc: 512, note: 'RSA is impractical; elliptic curves are routine' }
    ];
  }

  return {
    DISCLAIMER: DISCLAIMER, INFINITY: INFINITY,
    modPow: modPow, egcd: egcd, modInverse: modInverse, isProbablePrime: isProbablePrime,
    rsaKey: rsaKey, rsaEncrypt: rsaEncrypt, rsaDecrypt: rsaDecrypt, factor: factor,
    malleabilityAttack: malleabilityAttack,
    diffieHellman: diffieHellman, discreteLog: discreteLog,
    curve: curve, isOnCurve: isOnCurve, pointAdd: pointAdd, scalarMul: scalarMul,
    ecdh: ecdh, toyCurve: toyCurve, demoCurve: demoCurve, keySizeTable: keySizeTable
  };
}));
