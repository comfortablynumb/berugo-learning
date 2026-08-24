/**
 * SHA-1, SHA-256 and HMAC — and the length-extension attack that HMAC exists
 * to prevent.
 *
 * ⚠ TEACHING CODE. These implementations are for understanding. They are not
 * constant-time, not side-channel hardened and not audited, and they must never
 * protect real data. Production code uses `crypto.subtle`, libsodium or an
 * equivalent audited library.
 *
 * The interesting property here is structural rather than cryptographic. SHA-1
 * and SHA-256 are Merkle–Damgård constructions: the digest IS the internal
 * state after the last block. So anyone holding H(secret ‖ message) holds the
 * machine's state, and can carry on hashing from it — appending data and
 * producing a valid digest for a secret they never learned. That is not a
 * weakness in the compression function; it is what "the digest is the state"
 * means, and it is why `hash(key ‖ message)` is not a MAC.
 *
 * HMAC fixes it by hashing twice with two derived keys, so the attacker sees
 * the digest of an INNER hash and cannot resume the outer one. SHA-3's sponge
 * fixes it differently, by keeping part of the state permanently hidden.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.CryptoHash = api;
}(this, function () {
  'use strict';

  const DISCLAIMER = 'Teaching implementation: not constant-time, not audited, never for real data.';

  /* ------------------------------------------------------------ utilities */

  function bytesOf(text) {
    const out = [];

    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i);

      if (code < 0x80) {
        out.push(code);
      } else if (code < 0x800) {
        out.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else {
        out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      }
    }
    return out;
  }

  function hex(bytes) {
    return bytes.map(function (byte) {
      return (byte & 0xff).toString(16).padStart(2, '0');
    }).join('');
  }

  function fromHex(text) {
    const out = [];

    for (let i = 0; i + 1 < text.length; i += 2) out.push(parseInt(text.slice(i, i + 2), 16));
    return out;
  }

  function rotl(value, by) {
    return ((value << by) | (value >>> (32 - by))) >>> 0;
  }

  function rotr(value, by) {
    return ((value >>> by) | (value << (32 - by))) >>> 0;
  }

  /**
   * Merkle–Damgård padding: a 1 bit, then zeros, then the message length in
   * bits as a 64-bit big-endian integer. `extra` lets the length field claim a
   * longer message than the bytes provided, which is exactly what a
   * length-extension attack needs.
   */
  function pad(bytes, extra) {
    const total = bytes.length + (extra === undefined ? 0 : extra);
    const padded = bytes.slice();

    padded.push(0x80);
    while (padded.length % 64 !== 56) padded.push(0);
    const bits = total * 8;

    for (let i = 7; i >= 0; i -= 1) padded.push(Math.floor(bits / Math.pow(256, i)) & 0xff);
    return padded;
  }

  function words(block, at) {
    const out = new Array(16);

    for (let i = 0; i < 16; i += 1) {
      out[i] = ((block[at + i * 4] << 24) | (block[at + i * 4 + 1] << 16)
        | (block[at + i * 4 + 2] << 8) | block[at + i * 4 + 3]) >>> 0;
    }
    return out;
  }

  function stateBytes(state) {
    const out = [];

    state.forEach(function (word) {
      out.push((word >>> 24) & 0xff, (word >>> 16) & 0xff, (word >>> 8) & 0xff, word & 0xff);
    });
    return out;
  }

  /* --------------------------------------------------------------- SHA-1 */

  const SHA1_INIT = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];

  function sha1Block(state, block, at) {
    const w = words(block, at).concat(new Array(64).fill(0));

    for (let i = 16; i < 80; i += 1) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let a = state[0];
    let b = state[1];
    let c = state[2];
    let d = state[3];
    let e = state[4];

    for (let i = 0; i < 80; i += 1) {
      const round = sha1Round(i, b, c, d);
      const temp = (rotl(a, 5) + round.f + e + round.k + w[i]) >>> 0;

      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    return [(state[0] + a) >>> 0, (state[1] + b) >>> 0, (state[2] + c) >>> 0,
      (state[3] + d) >>> 0, (state[4] + e) >>> 0];
  }

  function sha1Round(i, b, c, d) {
    if (i < 20) return { f: ((b & c) | (~b & d)) >>> 0, k: 0x5a827999 };
    if (i < 40) return { f: (b ^ c ^ d) >>> 0, k: 0x6ed9eba1 };
    if (i < 60) return { f: ((b & c) | (b & d) | (c & d)) >>> 0, k: 0x8f1bbcdc };
    return { f: (b ^ c ^ d) >>> 0, k: 0xca62c1d6 };
  }

  /** SHA-1, optionally resumed from a captured state — which is the attack. */
  function sha1(bytes, options) {
    const settings = options || {};
    let state = settings.state ? settings.state.slice() : SHA1_INIT.slice();
    const padded = pad(bytes, settings.lengthOffset);

    for (let at = 0; at < padded.length; at += 64) state = sha1Block(state, padded, at);
    return stateBytes(state);
  }

  /* -------------------------------------------------------------- SHA-256 */

  const K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  const SHA256_INIT = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

  function sha256Block(state, block, at) {
    const w = words(block, at).concat(new Array(48).fill(0));

    for (let i = 16; i < 64; i += 1) {
      const s0 = (rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)) >>> 0;

      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    return sha256Rounds(state, w);
  }

  function sha256Rounds(state, w) {
    let a = state[0];
    let b = state[1];
    let c = state[2];
    let d = state[3];
    let e = state[4];
    let f = state[5];
    let g = state[6];
    let h = state[7];

    for (let i = 0; i < 64; i += 1) {
      const s1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const t1 = (h + s1 + ch + K256[i] + w[i]) >>> 0;
      const s0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const t2 = (s0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    return [a, b, c, d, e, f, g, h].map(function (value, i) {
      return (state[i] + value) >>> 0;
    });
  }

  /**
   * SHA-256. `options.state` resumes from a captured internal state and
   * `options.lengthOffset` makes the padding claim a longer message — together
   * they are the whole length-extension attack, and they are exposed
   * deliberately so the demo can execute it rather than describe it.
   */
  function sha256(bytes, options) {
    const settings = options || {};
    let state = settings.state ? settings.state.slice() : SHA256_INIT.slice();
    const padded = pad(bytes, settings.lengthOffset);

    for (let at = 0; at < padded.length; at += 64) state = sha256Block(state, padded, at);
    return stateBytes(state);
  }

  /** A digest read back as the internal state it is. That equivalence is the
   *  vulnerability, and there is no way to have one without the other in a
   *  Merkle–Damgård hash. */
  function stateOf(digest) {
    const state = [];

    for (let i = 0; i < digest.length; i += 4) {
      state.push(((digest[i] << 24) | (digest[i + 1] << 16)
        | (digest[i + 2] << 8) | digest[i + 3]) >>> 0);
    }
    return state;
  }

  /* ----------------------------------------------------------------- HMAC */

  const HASHES = {
    'sha-1': { fn: sha1, blockSize: 64, digestSize: 20 },
    'sha-256': { fn: sha256, blockSize: 64, digestSize: 32 }
  };

  /**
   * HMAC: hash twice, with two keys derived from one by XOR with constants.
   * The attacker sees the digest of the INNER hash, not a state they can
   * resume, so length extension buys them nothing.
   */
  function hmac(name, key, message) {
    const spec = HASHES[name];

    if (!spec) throw new Error('crypto-hash: unknown hash ' + name);
    let block = key.length > spec.blockSize ? spec.fn(key) : key.slice();

    while (block.length < spec.blockSize) block.push(0);
    const inner = block.map(function (byte) { return byte ^ 0x36; });
    const outer = block.map(function (byte) { return byte ^ 0x5c; });

    return spec.fn(outer.concat(spec.fn(inner.concat(message))));
  }

  /* --------------------------------------------- the length-extension attack */

  /**
   * Forge a valid tag for `original ‖ glue ‖ suffix` knowing only the tag of
   * `secret ‖ original` and the LENGTH of the secret — never the secret itself.
   *
   * The glue is the padding the original message would have received, which the
   * attacker can compute because padding depends only on length. Resume the
   * hash from the published digest, hash the suffix, and the result is a
   * legitimate tag for a message the key holder never authorised.
   */
  function lengthExtend(config) {
    const state = stateOf(config.tag);
    const originalLength = config.secretLength + config.original.length;
    const glue = glueFor(originalLength);
    const forgedMessage = config.original.concat(glue).concat(config.suffix);
    const spec = HASHES[config.hash || 'sha-256'];
    const forgedTag = spec.fn(config.suffix, {
      state: state,
      lengthOffset: originalLength + glue.length
    });

    return { message: forgedMessage, tag: forgedTag, glue: glue,
      glueLength: glue.length, resumedFrom: state };
  }

  /**
   * The padding a message of this many bytes would have received. The attacker
   * can compute it because padding depends only on the LENGTH — which is why
   * knowing the secret's length is enough and knowing the secret is not
   * required.
   */
  function glueFor(length) {
    const out = [0x80];

    while ((length + out.length) % 64 !== 56) out.push(0);
    const bits = length * 8;

    for (let i = 7; i >= 0; i -= 1) out.push(Math.floor(bits / Math.pow(256, i)) & 0xff);
    return out;
  }

  /** The naive construction the attack defeats, and the one it does not. */
  function naiveMac(secret, message) {
    return sha256(secret.concat(message));
  }

  function hmacMac(secret, message) {
    return hmac('sha-256', secret, message);
  }

  /* --------------------------------------------------------- birthday bound */

  /**
   * The collision probability after q samples from a space of 2^bits, and the
   * q at which it reaches one half. The square root is the whole point: a
   * 128-bit digest gives 64-bit collision resistance, which is why a
   * collision-resistant hash needs twice the output length of a
   * preimage-resistant one.
   */
  function birthday(bits, samples) {
    const space = Math.pow(2, bits);
    const exponent = -(samples * (samples - 1)) / (2 * space);

    return { probability: 1 - Math.exp(exponent), space: space,
      halfAt: Math.sqrt(2 * Math.LN2 * space) };
  }

  return {
    DISCLAIMER: DISCLAIMER, HASHES: HASHES,
    bytesOf: bytesOf, hex: hex, fromHex: fromHex, pad: pad, stateOf: stateOf,
    sha1: sha1, sha256: sha256, hmac: hmac,
    lengthExtend: lengthExtend, glueFor: glueFor, naiveMac: naiveMac, hmacMac: hmacMac,
    birthday: birthday
  };
}));
