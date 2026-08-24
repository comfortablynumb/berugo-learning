/**
 * Authenticated encryption, and the two ways it is thrown away.
 *
 * ⚠ TEACHING CODE. Not constant-time, not audited, never for real data.
 *
 * Confidentiality without integrity is almost always wrong. An unauthenticated
 * ciphertext can be modified in ways that produce predictable plaintext
 * changes — flip a bit in a CTR ciphertext and the same bit flips in the
 * plaintext — so a receiver that decrypts and acts on the result is executing
 * instructions an attacker chose. AEAD is the interface that fixes it: one call
 * that encrypts and authenticates, one call that verifies and decrypts, and no
 * way to get the plaintext of a message that failed verification.
 *
 * Two failures are implemented here because both are live in production:
 *
 * - **Nonce reuse in GCM is catastrophic and not merely bad.** Two messages
 *   under one nonce give the attacker the XOR of their plaintexts, and — worse
 *   — GHASH becomes a polynomial whose root is the authentication key, so the
 *   attacker recovers H and can forge tags for any message afterwards.
 * - **A non-constant-time tag comparison is an oracle.** An early-exit compare
 *   tells the attacker how many leading bytes of their guessed tag were right,
 *   which turns 2^128 work into 16 × 256.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Aead = api;
}(this, function (root) {
  'use strict';

  const Cipher = root && root.BlockCipher ? root.BlockCipher
    : require('./block-cipher.js');
  const Hash = root && root.CryptoHash ? root.CryptoHash : require('./crypto-hash.js');

  const DISCLAIMER = 'Teaching implementation: not constant-time, not audited, never for real data.';

  function xorBytes(a, b) {
    return a.map(function (byte, i) { return byte ^ (b[i] || 0); });
  }

  /* --------------------------------------------------------------- GHASH */

  /**
   * Multiplication in GF(2^128) with the GCM reduction polynomial, bit by bit.
   * This is the arithmetic GHASH is built from, and the reason a repeated nonce
   * leaks the authentication key: the tags become two evaluations of one
   * polynomial in H, and their difference is a polynomial whose roots include H.
   */
  function gfMul128(x, y) {
    const z = new Array(16).fill(0);
    const v = y.slice();

    for (let i = 0; i < 128; i += 1) {
      if ((x[i >> 3] >> (7 - (i & 7))) & 1) {
        for (let j = 0; j < 16; j += 1) z[j] ^= v[j];
      }
      const lsb = v[15] & 1;

      for (let j = 15; j > 0; j -= 1) v[j] = ((v[j] >>> 1) | ((v[j - 1] & 1) << 7)) & 0xff;
      v[0] >>>= 1;
      if (lsb) v[0] ^= 0xe1;
    }
    return z;
  }

  /** GHASH over the associated data and ciphertext, with the length block. */
  function ghash(h, associated, ciphertext) {
    let y = new Array(16).fill(0);
    const absorb = function (bytes) {
      for (let at = 0; at < bytes.length; at += 16) {
        const block = bytes.slice(at, at + 16);

        while (block.length < 16) block.push(0);
        y = gfMul128(xorBytes(y, block), h);
      }
    };

    absorb(associated);
    absorb(ciphertext);
    return gfMul128(xorBytes(y, lengthBlock(associated.length, ciphertext.length)), h);
  }

  function lengthBlock(aLength, cLength) {
    const block = new Array(16).fill(0);
    const write = function (value, at) {
      const bits = value * 8;

      for (let i = 0; i < 8; i += 1) {
        block[at + 7 - i] = Math.floor(bits / Math.pow(256, i)) & 0xff;
      }
    };

    write(aLength, 0);
    write(cLength, 8);
    return block;
  }

  /* ----------------------------------------------------------- AES-GCM */

  function gcmCounter(nonce, index) {
    const block = nonce.slice(0, 12);

    block.push((index >>> 24) & 0xff, (index >>> 16) & 0xff, (index >>> 8) & 0xff, index & 0xff);
    return block;
  }

  function gcmKeystream(key, nonce, length) {
    const schedule = Cipher.expandKey(key);
    const out = [];

    for (let block = 0; out.length < length; block += 1) {
      const stream = Cipher.encryptBlock(gcmCounter(nonce, block + 2), schedule);

      for (let i = 0; i < 16 && out.length < length; i += 1) out.push(stream[i]);
    }
    return out;
  }

  /** AES-GCM: CTR from counter 2, GHASH over the ciphertext, tag masked with
   *  the encryption of counter 1. */
  function gcmEncrypt(config) {
    const schedule = Cipher.expandKey(config.key);
    const h = Cipher.encryptBlock(new Array(16).fill(0), schedule);
    const ciphertext = xorBytes(config.plaintext,
      gcmKeystream(config.key, config.nonce, config.plaintext.length));
    const associated = config.associated || [];
    const mask = Cipher.encryptBlock(gcmCounter(config.nonce, 1), schedule);
    const tag = xorBytes(ghash(h, associated, ciphertext), mask);

    return { ciphertext: ciphertext, tag: tag, h: h, mask: mask };
  }

  function gcmDecrypt(config) {
    const schedule = Cipher.expandKey(config.key);
    const h = Cipher.encryptBlock(new Array(16).fill(0), schedule);
    const associated = config.associated || [];
    const mask = Cipher.encryptBlock(gcmCounter(config.nonce, 1), schedule);
    const expected = xorBytes(ghash(h, associated, config.ciphertext), mask);

    if (!constantTimeEquals(expected, config.tag)) {
      return { plaintext: null, verified: false };
    }
    return {
      plaintext: xorBytes(config.ciphertext,
        gcmKeystream(config.key, config.nonce, config.ciphertext.length)),
      verified: true
    };
  }

  /* -------------------------------------------------------- ChaCha20 */

  function rotl32(value, by) {
    return ((value << by) | (value >>> (32 - by))) >>> 0;
  }

  function quarterRound(s, a, b, c, d) {
    s[a] = (s[a] + s[b]) >>> 0;
    s[d] = rotl32(s[d] ^ s[a], 16);
    s[c] = (s[c] + s[d]) >>> 0;
    s[b] = rotl32(s[b] ^ s[c], 12);
    s[a] = (s[a] + s[b]) >>> 0;
    s[d] = rotl32(s[d] ^ s[a], 8);
    s[c] = (s[c] + s[d]) >>> 0;
    s[b] = rotl32(s[b] ^ s[c], 7);
  }

  function chachaBlock(key, counter, nonce) {
    const state = [0x61707865, 0x3320646e, 0x79622d32, 0x6b206574];

    for (let i = 0; i < 8; i += 1) state.push(readLe(key, i * 4));
    state.push(counter >>> 0);
    for (let i = 0; i < 3; i += 1) state.push(readLe(nonce, i * 4));
    const working = state.slice();

    for (let round = 0; round < 10; round += 1) {
      quarterRound(working, 0, 4, 8, 12);
      quarterRound(working, 1, 5, 9, 13);
      quarterRound(working, 2, 6, 10, 14);
      quarterRound(working, 3, 7, 11, 15);
      quarterRound(working, 0, 5, 10, 15);
      quarterRound(working, 1, 6, 11, 12);
      quarterRound(working, 2, 7, 8, 13);
      quarterRound(working, 3, 4, 9, 14);
    }
    const out = [];

    working.forEach(function (word, i) { pushLe(out, (word + state[i]) >>> 0); });
    return out;
  }

  function readLe(bytes, at) {
    return ((bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16)
      | (bytes[at + 3] << 24)) >>> 0);
  }

  function pushLe(out, word) {
    out.push(word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff);
  }

  function chacha20(data, key, nonce, counter) {
    const start = counter === undefined ? 1 : counter;
    const out = [];

    for (let at = 0; at < data.length; at += 64) {
      const stream = chachaBlock(key, start + at / 64, nonce);

      for (let i = 0; i < 64 && at + i < data.length; i += 1) out.push(data[at + i] ^ stream[i]);
    }
    return out;
  }

  /* -------------------------------------------------------- Poly1305 */

  /** Poly1305 over BigInt: a polynomial evaluation modulo 2^130 − 5, with the
   *  message blocks as coefficients. */
  function poly1305(message, key) {
    const P = (1n << 130n) - 5n;
    let r = leToBig(key.slice(0, 16));

    r &= 0x0ffffffc0ffffffc0ffffffc0fffffffn;
    const s = leToBig(key.slice(16, 32));
    let acc = 0n;

    for (let at = 0; at < message.length; at += 16) {
      const chunk = message.slice(at, at + 16);
      const n = leToBig(chunk) + (1n << BigInt(chunk.length * 8));

      acc = ((acc + n) * r) % P;
    }
    acc = (acc + s) % (1n << 128n);
    return bigToLe(acc, 16);
  }

  function leToBig(bytes) {
    let value = 0n;

    for (let i = bytes.length - 1; i >= 0; i -= 1) value = (value << 8n) | BigInt(bytes[i]);
    return value;
  }

  function bigToLe(value, length) {
    const out = [];
    let rest = value;

    for (let i = 0; i < length; i += 1) {
      out.push(Number(rest & 0xffn));
      rest >>= 8n;
    }
    return out;
  }

  /** RFC 8439: ChaCha20-Poly1305 with the one-time key from block 0. */
  function chachaPolyEncrypt(config) {
    const polyKey = chachaBlock(config.key, 0, config.nonce).slice(0, 32);
    const ciphertext = chacha20(config.plaintext, config.key, config.nonce, 1);
    const associated = config.associated || [];
    const tag = poly1305(polyInput(associated, ciphertext), polyKey);

    return { ciphertext: ciphertext, tag: tag };
  }

  function chachaPolyDecrypt(config) {
    const polyKey = chachaBlock(config.key, 0, config.nonce).slice(0, 32);
    const associated = config.associated || [];
    const expected = poly1305(polyInput(associated, config.ciphertext), polyKey);

    if (!constantTimeEquals(expected, config.tag)) return { plaintext: null, verified: false };
    return { plaintext: chacha20(config.ciphertext, config.key, config.nonce, 1), verified: true };
  }

  /** Each part padded to a multiple of 16, then the two lengths — the framing
   *  that stops an attacker moving bytes between the two channels. */
  function polyInput(associated, ciphertext) {
    const out = [];
    const push = function (bytes) {
      bytes.forEach(function (byte) { out.push(byte); });
      while (out.length % 16 !== 0) out.push(0);
    };

    push(associated);
    push(ciphertext);
    bigToLe(BigInt(associated.length), 8).forEach(function (byte) { out.push(byte); });
    bigToLe(BigInt(ciphertext.length), 8).forEach(function (byte) { out.push(byte); });
    return out;
  }

  /* ------------------------------------------------- composition and tags */

  /** Encrypt-then-MAC, the only one of the three orders that is generically
   *  secure: authenticate the CIPHERTEXT, so a forged message is rejected
   *  before the decryption code ever sees it. */
  function encryptThenMac(config) {
    const ciphertext = Cipher.cbcEncrypt(config.plaintext, config.encKey, config.iv);
    const tag = Hash.hmac('sha-256', config.macKey, config.iv.concat(ciphertext));

    return { iv: config.iv, ciphertext: ciphertext, tag: tag };
  }

  function verifyThenDecrypt(config) {
    const expected = Hash.hmac('sha-256', config.macKey, config.iv.concat(config.ciphertext));

    if (!constantTimeEquals(expected, config.tag)) {
      return { plaintext: null, verified: false, reason: 'tag mismatch' };
    }
    return { plaintext: Cipher.cbcDecrypt(config.ciphertext, config.encKey, config.iv),
      verified: true };
  }

  /** No early exit: every byte is compared and the differences accumulate. */
  function constantTimeEquals(a, b) {
    if (a.length !== b.length) return false;
    let difference = 0;

    for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
    return difference === 0;
  }

  /** The version that leaks, kept so the timing section can attack it. */
  function naiveEquals(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /* ------------------------------------------------- the nonce-reuse attack */

  /**
   * Two messages under one nonce. The keystream is identical, so the XOR of the
   * ciphertexts is the XOR of the plaintexts — and if any plaintext is known,
   * the other falls out immediately. The GHASH consequence is worse and is
   * reported alongside: the two tags are evaluations of one polynomial in H, so
   * their difference is a polynomial whose roots include the authentication key.
   */
  function nonceReuse(config) {
    const first = gcmEncrypt({ key: config.key, nonce: config.nonce,
      plaintext: config.first, associated: [] });
    const second = gcmEncrypt({ key: config.key, nonce: config.nonce,
      plaintext: config.second, associated: [] });
    const ciphertextXor = xorBytes(first.ciphertext, second.ciphertext);
    const plaintextXor = xorBytes(config.first, config.second);
    const recovered = xorBytes(ciphertextXor, config.first);

    return {
      first: first, second: second,
      ciphertextXor: ciphertextXor,
      plaintextXor: plaintextXor,
      recovered: recovered,
      recoveredMatches: recovered.every(function (byte, i) {
        return byte === (config.second[i] || 0);
      }),
      keystreamIdentical: ciphertextXor.every(function (byte, i) {
        return byte === plaintextXor[i];
      }),
      tagDifference: xorBytes(first.tag, second.tag),
      authKey: first.h
    };
  }

  return {
    DISCLAIMER: DISCLAIMER,
    gfMul128: gfMul128, ghash: ghash, lengthBlock: lengthBlock,
    gcmEncrypt: gcmEncrypt, gcmDecrypt: gcmDecrypt, gcmKeystream: gcmKeystream,
    chachaBlock: chachaBlock, chacha20: chacha20, poly1305: poly1305,
    chachaPolyEncrypt: chachaPolyEncrypt, chachaPolyDecrypt: chachaPolyDecrypt,
    polyInput: polyInput,
    encryptThenMac: encryptThenMac, verifyThenDecrypt: verifyThenDecrypt,
    constantTimeEquals: constantTimeEquals, naiveEquals: naiveEquals,
    nonceReuse: nonceReuse, xorBytes: xorBytes
  };
}));
