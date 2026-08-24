/**
 * AES and the block cipher modes — including the two that leak.
 *
 * ⚠ TEACHING CODE. Table-driven, not constant-time, not audited, and it must
 * never protect real data. The table lookups below are exactly the ones
 * Bernstein's cache-timing attack targets, which the constant-time section
 * measures rather than describes.
 *
 * A block cipher is a keyed permutation on 128 bits and nothing more. It does
 * not encrypt a message — it encrypts one block — and the MODE is what turns it
 * into something that handles a message. That distinction is where the failures
 * live:
 *
 * - ECB encrypts each block independently, so identical plaintext blocks give
 *   identical ciphertext blocks and the structure of the data survives
 *   encryption. The demo shows it on an image, where the result is famous.
 * - CBC chains each block into the next and needs an unpredictable IV. Its
 *   padding is checkable by the receiver, and a receiver that reveals whether
 *   padding was valid is a full plaintext-disclosure oracle.
 * - CTR turns the cipher into a stream cipher by encrypting a counter. It has
 *   no padding and no oracle — and reusing a nonce destroys everything, because
 *   two messages under one keystream XOR to the XOR of the plaintexts.
 *
 * None of these three authenticates anything. A ciphertext in any of them can
 * be modified in ways that produce predictable plaintext changes, which is why
 * the next module is about AEAD.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.BlockCipher = api;
}(this, function () {
  'use strict';

  const DISCLAIMER = 'Teaching implementation: table-driven, not constant-time, never for real data.';
  const BLOCK = 16;

  /* ------------------------------------------------------- the AES tables */

  const SBOX = new Array(256);
  const INV_SBOX = new Array(256);
  const RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36, 0x6c, 0xd8, 0xab, 0x4d];

  (function buildTables() {
    const exp = new Array(256);
    const log = new Array(256);
    let x = 1;

    for (let i = 0; i < 255; i += 1) {
      exp[i] = x;
      log[x] = i;
      x ^= (x << 1) ^ ((x & 0x80) ? 0x11b : 0);
      x &= 0xff;
    }
    for (let i = 0; i < 256; i += 1) {
      const inverse = i === 0 ? 0 : exp[(255 - log[i]) % 255];
      let s = inverse;
      let value = inverse;

      for (let r = 0; r < 4; r += 1) {
        s = ((s << 1) | (s >>> 7)) & 0xff;
        value ^= s;
      }
      SBOX[i] = (value ^ 0x63) & 0xff;
    }
    SBOX.forEach(function (value, i) { INV_SBOX[value] = i; });
  }());

  function xtime(byte) {
    return ((byte << 1) ^ ((byte & 0x80) ? 0x11b : 0)) & 0xff;
  }

  function gmul(a, b) {
    let result = 0;
    let x = a;
    let y = b;

    while (y) {
      if (y & 1) result ^= x;
      x = xtime(x);
      y >>= 1;
    }
    return result & 0xff;
  }

  /* --------------------------------------------------------- key schedule */

  /** Rijndael's key expansion: one word per round column, with a rotate,
   *  a substitution and a round constant every Nk words. */
  function expandKey(key) {
    const nk = key.length / 4;
    const rounds = nk + 6;
    const w = [];

    for (let i = 0; i < nk; i += 1) {
      w.push([key[4 * i], key[4 * i + 1], key[4 * i + 2], key[4 * i + 3]]);
    }
    for (let i = nk; i < 4 * (rounds + 1); i += 1) {
      let temp = w[i - 1].slice();

      if (i % nk === 0) {
        temp = temp.slice(1).concat(temp[0]).map(function (byte) { return SBOX[byte]; });
        temp[0] ^= RCON[i / nk - 1];
      } else if (nk > 6 && i % nk === 4) {
        temp = temp.map(function (byte) { return SBOX[byte]; });
      }
      w.push(temp.map(function (byte, j) { return byte ^ w[i - nk][j]; }));
    }
    return { words: w, rounds: rounds };
  }

  function addRoundKey(state, schedule, round) {
    for (let c = 0; c < 4; c += 1) {
      for (let r = 0; r < 4; r += 1) state[r + 4 * c] ^= schedule.words[round * 4 + c][r];
    }
  }

  /* ------------------------------------------------------- the four steps */

  function subBytes(state, table) {
    for (let i = 0; i < 16; i += 1) state[i] = table[state[i]];
  }

  function shiftRows(state, back) {
    for (let r = 1; r < 4; r += 1) {
      const row = [state[r], state[r + 4], state[r + 8], state[r + 12]];
      const shifted = back ? row.slice(4 - r).concat(row.slice(0, 4 - r))
        : row.slice(r).concat(row.slice(0, r));

      for (let c = 0; c < 4; c += 1) state[r + 4 * c] = shifted[c];
    }
  }

  function mixColumns(state, back) {
    const m = back ? [14, 11, 13, 9] : [2, 3, 1, 1];

    for (let c = 0; c < 4; c += 1) {
      const col = [state[4 * c], state[4 * c + 1], state[4 * c + 2], state[4 * c + 3]];

      for (let r = 0; r < 4; r += 1) {
        state[r + 4 * c] = gmul(col[0], m[(4 - r) % 4]) ^ gmul(col[1], m[(5 - r) % 4])
          ^ gmul(col[2], m[(6 - r) % 4]) ^ gmul(col[3], m[(7 - r) % 4]);
      }
    }
  }

  /* -------------------------------------------------------- one block */

  function encryptBlock(block, schedule) {
    const state = toState(block);

    addRoundKey(state, schedule, 0);
    for (let round = 1; round < schedule.rounds; round += 1) {
      subBytes(state, SBOX);
      shiftRows(state, false);
      mixColumns(state, false);
      addRoundKey(state, schedule, round);
    }
    subBytes(state, SBOX);
    shiftRows(state, false);
    addRoundKey(state, schedule, schedule.rounds);
    return fromState(state);
  }

  function decryptBlock(block, schedule) {
    const state = toState(block);

    addRoundKey(state, schedule, schedule.rounds);
    for (let round = schedule.rounds - 1; round > 0; round -= 1) {
      shiftRows(state, true);
      subBytes(state, INV_SBOX);
      addRoundKey(state, schedule, round);
      mixColumns(state, true);
    }
    shiftRows(state, true);
    subBytes(state, INV_SBOX);
    addRoundKey(state, schedule, 0);
    return fromState(state);
  }

  /** AES is column-major: byte i of the block is row i mod 4, column i div 4. */
  function toState(block) {
    const state = new Array(16);

    for (let i = 0; i < 16; i += 1) state[(i % 4) + 4 * Math.floor(i / 4)] = block[i];
    return state;
  }

  function fromState(state) {
    const out = new Array(16);

    for (let i = 0; i < 16; i += 1) out[i] = state[(i % 4) + 4 * Math.floor(i / 4)];
    return out;
  }

  /* -------------------------------------------------------------- padding */

  /** PKCS#7: pad with n bytes each equal to n, always adding at least one so
   *  the padding is unambiguous. That checkability is what a padding oracle
   *  exploits. */
  function padPkcs7(bytes) {
    const need = BLOCK - (bytes.length % BLOCK);
    const out = bytes.slice();

    for (let i = 0; i < need; i += 1) out.push(need);
    return out;
  }

  function unpadPkcs7(bytes) {
    if (bytes.length === 0 || bytes.length % BLOCK !== 0) return null;
    const n = bytes[bytes.length - 1];

    if (n < 1 || n > BLOCK || n > bytes.length) return null;
    for (let i = 0; i < n; i += 1) {
      if (bytes[bytes.length - 1 - i] !== n) return null;
    }
    return bytes.slice(0, bytes.length - n);
  }

  /* ---------------------------------------------------------------- modes */

  function blocksOf(bytes) {
    const out = [];

    for (let at = 0; at < bytes.length; at += BLOCK) out.push(bytes.slice(at, at + BLOCK));
    return out;
  }

  function xorBytes(a, b) {
    return a.map(function (byte, i) { return byte ^ b[i]; });
  }

  /** ECB: each block independently, so identical blocks look identical. */
  function ecbEncrypt(plaintext, key) {
    const schedule = expandKey(key);

    return blocksOf(padPkcs7(plaintext)).reduce(function (out, block) {
      return out.concat(encryptBlock(block, schedule));
    }, []);
  }

  function ecbDecrypt(ciphertext, key) {
    const schedule = expandKey(key);
    const plain = blocksOf(ciphertext).reduce(function (out, block) {
      return out.concat(decryptBlock(block, schedule));
    }, []);

    return unpadPkcs7(plain);
  }

  /** CBC: XOR each plaintext block with the previous ciphertext block. The IV
   *  must be unpredictable, and it is not a secret. */
  function cbcEncrypt(plaintext, key, iv) {
    const schedule = expandKey(key);
    let previous = iv.slice();
    const out = [];

    blocksOf(padPkcs7(plaintext)).forEach(function (block) {
      previous = encryptBlock(xorBytes(block, previous), schedule);
      out.push.apply(out, previous);
    });
    return out;
  }

  function cbcDecryptRaw(ciphertext, key, iv) {
    const schedule = expandKey(key);
    let previous = iv.slice();
    const out = [];

    blocksOf(ciphertext).forEach(function (block) {
      out.push.apply(out, xorBytes(decryptBlock(block, schedule), previous));
      previous = block;
    });
    return out;
  }

  function cbcDecrypt(ciphertext, key, iv) {
    return unpadPkcs7(cbcDecryptRaw(ciphertext, key, iv));
  }

  /**
   * CTR: encrypt a counter to make a keystream, then XOR. No padding, so no
   * padding oracle — and a repeated nonce is catastrophic, because two
   * ciphertexts under the same keystream XOR to the XOR of their plaintexts.
   */
  function ctr(data, key, nonce) {
    const schedule = expandKey(key);
    const out = [];

    for (let at = 0; at < data.length; at += BLOCK) {
      const counter = counterBlock(nonce, at / BLOCK);
      const keystream = encryptBlock(counter, schedule);

      for (let i = 0; i < BLOCK && at + i < data.length; i += 1) {
        out.push(data[at + i] ^ keystream[i]);
      }
    }
    return out;
  }

  function counterBlock(nonce, index) {
    const block = nonce.slice(0, 12);

    while (block.length < 12) block.push(0);
    block.push((index >>> 24) & 0xff, (index >>> 16) & 0xff, (index >>> 8) & 0xff, index & 0xff);
    return block;
  }

  /** The keystream itself, which is what a nonce-reuse demo needs to show. */
  function keystream(key, nonce, length) {
    return ctr(new Array(length).fill(0), key, nonce);
  }

  return {
    DISCLAIMER: DISCLAIMER, BLOCK: BLOCK, SBOX: SBOX, INV_SBOX: INV_SBOX,
    expandKey: expandKey, encryptBlock: encryptBlock, decryptBlock: decryptBlock,
    padPkcs7: padPkcs7, unpadPkcs7: unpadPkcs7, blocksOf: blocksOf, xorBytes: xorBytes,
    ecbEncrypt: ecbEncrypt, ecbDecrypt: ecbDecrypt,
    cbcEncrypt: cbcEncrypt, cbcDecrypt: cbcDecrypt, cbcDecryptRaw: cbcDecryptRaw,
    ctr: ctr, keystream: keystream, counterBlock: counterBlock, gmul: gmul
  };
}));
