/**
 * Graded exercises for error detection and error correction (M22.10-M22.11).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'checksums-and-crc': [{
      id: 'table-driven-crc32',
      title: 'Table-driven CRC-32, against the published vectors',
      prompt: 'crc32(bytes) must return the standard CRC-32 (the one gzip, PNG and Ethernet use) ' +
        'of a byte array, as an unsigned 32-bit number. Build a 256-entry table: for each n, ' +
        'start with c = n and repeat eight times — if the low bit is set, c = 0xEDB88320 XOR ' +
        '(c >>> 1), otherwise c = c >>> 1. Then start the running value at 0xFFFFFFFF, and for ' +
        'each byte set crc = table[(crc XOR byte) AND 0xFF] XOR (crc >>> 8). Finally XOR with ' +
        '0xFFFFFFFF and return it as unsigned. The starter is a byte sum, which is a valid ' +
        'checksum and catches none of the errors this one does.',
      entry: 'crc32',
      starter: [
        'function crc32(bytes) {',
        '  // A byte sum: 8 bits of state, blind to reordering, and not a CRC.',
        '  let sum = 0;',
        '',
        '  bytes.forEach(function (byte) { sum = (sum + byte) & 0xffffffff; });',
        '  return sum >>> 0;',
        '}'
      ].join('\n'),
      solution: [
        'function crc32(bytes) {',
        '  const table = [];',
        '',
        '  for (let n = 0; n < 256; n += 1) {',
        '    let c = n;',
        '',
        '    for (let k = 0; k < 8; k += 1) {',
        '      c = (c & 1) ? ((0xedb88320 ^ (c >>> 1)) >>> 0) : (c >>> 1);',
        '    }',
        '    table.push(c >>> 0);',
        '  }',
        '  let crc = 0xffffffff;',
        '',
        '  for (let i = 0; i < bytes.length; i += 1) {',
        '    crc = (table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0;',
        '  }',
        '  return (crc ^ 0xffffffff) >>> 0;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it matches the published check values',
          assert: function (crc32, api) {
            function bytesOf(text) {
              const out = [];

              for (let i = 0; i < text.length; i += 1) out.push(text.charCodeAt(i) & 0xff);
              return out;
            }
            const cases = [
              { input: '', expect: 0x00000000 },
              { input: 'a', expect: 0xe8b7be43 },
              { input: 'abc', expect: 0x352441c2 },
              { input: '123456789', expect: 0xcbf43926 },
              { input: 'The quick brown fox jumps over the lazy dog', expect: 0x414fa339 }
            ];

            cases.forEach(function (entry) {
              api.assert.equal(crc32(bytesOf(entry.input)), entry.expect >>> 0,
                '"' + entry.input.slice(0, 20) + '" should be 0x' +
                (entry.expect >>> 0).toString(16));
            });
          }
        },
        {
          name: 'it catches every single-bit error',
          assert: function (crc32, api) {
            const rng = api.Random.seeded(11);
            const bytes = [];

            for (let i = 0; i < 40; i += 1) bytes.push(Math.floor(rng.next() * 256));
            const original = crc32(bytes);

            for (let at = 0; at < bytes.length * 8; at += 1) {
              const bad = bytes.slice();

              bad[at >> 3] ^= 1 << (at & 7);
              api.assert.equal(crc32(bad) !== original, true,
                'flipping bit ' + at + ' must change the CRC');
            }
          }
        },
        {
          name: 'it catches every burst up to its own degree',
          assert: function (crc32, api) {
            const rng = api.Random.seeded(13);
            const bytes = [];

            for (let i = 0; i < 24; i += 1) bytes.push(Math.floor(rng.next() * 256));
            const original = crc32(bytes);
            let trials = 0;

            for (let length = 1; length <= 8; length += 1) {
              const patterns = length <= 2 ? 1 : Math.pow(2, length - 2);

              for (let at = 0; at + length <= bytes.length * 8; at += 5) {
                for (let pattern = 0; pattern < patterns; pattern += 1) {
                  const bad = bytes.slice();

                  for (let i = 0; i < length; i += 1) {
                    const bit = (i === 0 || i === length - 1) ? 1 : ((pattern >> (i - 1)) & 1);

                    if (bit) bad[(at + i) >> 3] ^= 1 << ((at + i) & 7);
                  }
                  trials += 1;
                  api.assert.equal(crc32(bad) !== original, true,
                    'a burst of ' + length + ' bits at ' + at + ' survived');
                }
              }
            }
            api.assert.atLeast(trials, 500, 'the search should be substantial');
          }
        },
        {
          name: 'it is not a sum: reordering changes it',
          assert: function (crc32, api) {
            const bytes = [1, 2, 3, 4, 5, 6, 7, 8];
            const swapped = [1, 2, 4, 3, 5, 6, 7, 8];

            api.assert.equal(crc32(bytes) !== crc32(swapped), true,
              'swapping two bytes must change a CRC — a plain sum would not notice');
            const appended = bytes.concat([0]);

            api.assert.equal(crc32(bytes) !== crc32(appended), true,
              'appending a zero byte must change it too');
          }
        }
      ]
    }],

    'error-correction': [{
      id: 'hamming-7-4',
      title: 'Hamming(7,4): the syndrome is the address',
      prompt: 'hamming(dataBits, received) must return { encoded, syndrome, corrected, data }. To ' +
        'ENCODE: place the four data bits at one-based positions 3, 5, 6 and 7, and set the ' +
        'parity bits so that p1 (position 1) = d3 XOR d5 XOR d7, p2 = d3 XOR d6 XOR d7 and p4 = ' +
        'd5 XOR d6 XOR d7 — each parity bit covers the positions whose one-based index has its ' +
        'own bit set. Return the seven bits as `encoded`, zero-indexed. To DECODE `received` ' +
        '(seven bits): recompute the three parities, read the syndrome as s1 + 2·s2 + 4·s4, and ' +
        'when it is non-zero flip the bit at that ONE-BASED position. Return the syndrome, the ' +
        'corrected word and the four data bits. The starter encodes correctly and never corrects.',
      entry: 'hamming',
      starter: [
        'function hamming(dataBits, received) {',
        '  const code = [0, 0, 0, 0, 0, 0, 0, 0];',
        '',
        '  code[3] = dataBits[0] & 1;',
        '  code[5] = dataBits[1] & 1;',
        '  code[6] = dataBits[2] & 1;',
        '  code[7] = dataBits[3] & 1;',
        '  code[1] = code[3] ^ code[5] ^ code[7];',
        '  code[2] = code[3] ^ code[6] ^ code[7];',
        '  code[4] = code[5] ^ code[6] ^ code[7];',
        '',
        '  // No correction: whatever arrived is passed straight through.',
        '  return {',
        '    encoded: code.slice(1),',
        '    syndrome: 0,',
        '    corrected: received.slice(),',
        '    data: [received[2], received[4], received[5], received[6]]',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function hamming(dataBits, received) {',
        '  const code = [0, 0, 0, 0, 0, 0, 0, 0];',
        '',
        '  code[3] = dataBits[0] & 1;',
        '  code[5] = dataBits[1] & 1;',
        '  code[6] = dataBits[2] & 1;',
        '  code[7] = dataBits[3] & 1;',
        '  code[1] = code[3] ^ code[5] ^ code[7];',
        '  code[2] = code[3] ^ code[6] ^ code[7];',
        '  code[4] = code[5] ^ code[6] ^ code[7];',
        '',
        '  const word = [0].concat(received);',
        '  const s1 = word[1] ^ word[3] ^ word[5] ^ word[7];',
        '  const s2 = word[2] ^ word[3] ^ word[6] ^ word[7];',
        '  const s4 = word[4] ^ word[5] ^ word[6] ^ word[7];',
        '  const syndrome = s1 + 2 * s2 + 4 * s4;',
        '  const corrected = received.slice();',
        '',
        '  if (syndrome !== 0) corrected[syndrome - 1] ^= 1;',
        '  return {',
        '    encoded: code.slice(1),',
        '    syndrome: syndrome,',
        '    corrected: corrected,',
        '    data: [corrected[2], corrected[4], corrected[5], corrected[6]]',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a clean word decodes with a zero syndrome',
          assert: function (hamming, api) {
            for (let word = 0; word < 16; word += 1) {
              const bits = [(word >> 3) & 1, (word >> 2) & 1, (word >> 1) & 1, word & 1];
              const encoded = hamming(bits, [0, 0, 0, 0, 0, 0, 0]).encoded;
              const decoded = hamming(bits, encoded);

              api.assert.equal(decoded.syndrome, 0,
                'word ' + word + ': an uncorrupted codeword has syndrome zero');
              api.assert.equal(decoded.data.join(''), bits.join(''),
                'word ' + word + ': the data must come back unchanged');
            }
          }
        },
        {
          name: 'the syndrome IS the one-based position of the flipped bit',
          assert: function (hamming, api) {
            for (let word = 0; word < 16; word += 1) {
              const bits = [(word >> 3) & 1, (word >> 2) & 1, (word >> 1) & 1, word & 1];
              const encoded = hamming(bits, [0, 0, 0, 0, 0, 0, 0]).encoded;

              for (let at = 0; at < 7; at += 1) {
                const bad = encoded.slice();

                bad[at] ^= 1;
                const decoded = hamming(bits, bad);

                api.assert.equal(decoded.syndrome, at + 1,
                  'flipping index ' + at + ' should give syndrome ' + (at + 1));
              }
            }
          }
        },
        {
          name: 'it corrects every single-bit error, exhaustively',
          assert: function (hamming, api) {
            let corrected = 0;

            for (let word = 0; word < 16; word += 1) {
              const bits = [(word >> 3) & 1, (word >> 2) & 1, (word >> 1) & 1, word & 1];
              const encoded = hamming(bits, [0, 0, 0, 0, 0, 0, 0]).encoded;

              for (let at = 0; at < 7; at += 1) {
                const bad = encoded.slice();

                bad[at] ^= 1;
                const decoded = hamming(bits, bad);

                if (decoded.data.join('') === bits.join('')) corrected += 1;
                api.assert.equal(decoded.corrected.join(''), encoded.join(''),
                  'the corrected word must equal the original codeword');
              }
            }
            api.assert.equal(corrected, 112, 'all 16 words × 7 positions must be corrected');
          }
        },
        {
          name: 'a double error is miscorrected — which is why SECDED exists',
          assert: function (hamming, api) {
            const bits = [1, 0, 1, 1];
            const encoded = hamming(bits, [0, 0, 0, 0, 0, 0, 0]).encoded;
            let wrong = 0;

            for (let a = 0; a < 7; a += 1) {
              for (let b = a + 1; b < 7; b += 1) {
                const bad = encoded.slice();

                bad[a] ^= 1;
                bad[b] ^= 1;
                const decoded = hamming(bits, bad);

                if (decoded.data.join('') !== bits.join('')) wrong += 1;
              }
            }
            api.assert.atLeast(wrong, 20,
              'a plain Hamming code cannot handle two errors, and it does not fail quietly — ' +
              'it flips a third bit and reports success');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
