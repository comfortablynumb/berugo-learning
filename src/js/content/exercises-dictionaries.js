/**
 * Graded exercises for dictionaries, codecs, context models and transforms (M22.4-M22.7).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'dictionary-compression': [{
      id: 'hash-chain-matching',
      title: 'LZ77 match finding with hash chains and a search depth',
      prompt: 'compress(bytes, depth) must return an array of tokens — ' +
        '{ kind: "literal", value } or { kind: "match", distance, length } — using a 4 096-byte ' +
        'window, a minimum match of 3 and a maximum of 258. Keep a chain: a map from the hash of ' +
        'the next three bytes to the most recent position with that hash, and an array giving ' +
        'each position’s predecessor in its chain. At each position walk at most `depth` links, ' +
        'keep the longest match, and emit a match when it reaches the minimum and a literal ' +
        'otherwise. Insert every position you pass into the chain, including the ones covered by ' +
        'a match. The starter emits every byte as a literal, which round-trips and compresses ' +
        'nothing.',
      entry: 'compress',
      starter: [
        'function compress(bytes, depth) {',
        '  // Correct, and it finds no matches at all.',
        '  return bytes.map(function (value) {',
        '    return { kind: "literal", value: value };',
        '  });',
        '}'
      ].join('\n'),
      solution: [
        'function compress(bytes, depth) {',
        '  const WINDOW = 4096;',
        '  const MIN = 3;',
        '  const MAX = 258;',
        '  const heads = new Map();',
        '  const previous = new Int32Array(bytes.length).fill(-1);',
        '  const tokens = [];',
        '',
        '  function hashAt(at) {',
        '    let key = 0;',
        '',
        '    for (let i = 0; i < MIN && at + i < bytes.length; i += 1) {',
        '      key = (key * 257 + bytes[at + i]) % 1048573;',
        '    }',
        '    return key;',
        '  }',
        '  function insert(at) {',
        '    const key = hashAt(at);',
        '',
        '    previous[at] = heads.has(key) ? heads.get(key) : -1;',
        '    heads.set(key, at);',
        '  }',
        '  let at = 0;',
        '',
        '  while (at < bytes.length) {',
        '    const key = hashAt(at);',
        '    let candidate = heads.has(key) ? heads.get(key) : -1;',
        '    let best = { length: 0, distance: 0 };',
        '    let links = 0;',
        '    const limit = Math.min(bytes.length - at, MAX);',
        '',
        '    while (candidate >= 0 && links < depth && at - candidate <= WINDOW) {',
        '      links += 1;',
        '      let length = 0;',
        '',
        '      while (length < limit && bytes[candidate + length] === bytes[at + length]) {',
        '        length += 1;',
        '      }',
        '      if (length > best.length) best = { length: length, distance: at - candidate };',
        '      candidate = previous[candidate];',
        '    }',
        '    if (best.length >= MIN) {',
        '      tokens.push({ kind: "match", distance: best.distance, length: best.length });',
        '      for (let i = 0; i < best.length; i += 1) insert(at + i);',
        '      at += best.length;',
        '      continue;',
        '    }',
        '    tokens.push({ kind: "literal", value: bytes[at] });',
        '    insert(at);',
        '    at += 1;',
        '  }',
        '  return tokens;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the token stream decodes back to the input',
          assert: function (compress, api) {
            function decompress(tokens) {
              const out = [];

              tokens.forEach(function (token) {
                if (token.kind === 'literal') {
                  out.push(token.value);
                  return;
                }
                const from = out.length - token.distance;

                for (let i = 0; i < token.length; i += 1) out.push(out[from + i]);
              });
              return out;
            }
            const rng = api.Random.seeded(9);
            const words = ['the', 'quick', 'brown', 'fox', 'jumps', 'over', 'lazy', 'dog'];
            let text = '';

            while (text.length < 3000) text += words[Math.floor(rng.next() * words.length)] + ' ';
            const bytes = [];

            for (let i = 0; i < text.length; i += 1) bytes.push(text.charCodeAt(i) & 0xff);
            const back = decompress(compress(bytes, 16));

            api.assert.equal(back.join(','), bytes.join(','), 'the round-trip must be exact');
          }
        },
        {
          name: 'it finds matches, and covers most of a repetitive input with them',
          assert: function (compress, api) {
            const text = 'the quick brown fox jumps over the lazy dog. '.repeat(40);
            const bytes = [];

            for (let i = 0; i < text.length; i += 1) bytes.push(text.charCodeAt(i) & 0xff);
            const tokens = compress(bytes, 16);
            let matched = 0;
            let matches = 0;

            tokens.forEach(function (token) {
              if (token.kind !== 'match') return;
              matches += 1;
              matched += token.length;
            });
            api.assert.atLeast(matches, 5, 'a 40-times repeated sentence has matches to find');
            api.assert.atLeast(matched / bytes.length, 0.9,
              'and they should cover nearly all of it');
          }
        },
        {
          name: 'a deeper search never finds fewer matched bytes',
          assert: function (compress, api) {
            const rng = api.Random.seeded(21);
            const words = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta'];
            let text = '';

            while (text.length < 4000) text += words[Math.floor(rng.next() * words.length)] + ' ';
            const bytes = [];

            for (let i = 0; i < text.length; i += 1) bytes.push(text.charCodeAt(i) & 0xff);

            function matchedBytes(depth) {
              let total = 0;

              compress(bytes, depth).forEach(function (token) {
                if (token.kind === 'match') total += token.length;
              });
              return total;
            }
            const shallow = matchedBytes(1);
            const deep = matchedBytes(32);

            api.assert.atLeast(deep, shallow,
              'walking more of the chain cannot find less: ' + deep + ' against ' + shallow);
          }
        },
        {
          name: 'every match points backwards and stays inside the window',
          assert: function (compress, api) {
            const text = 'abcabcabcabcabcXYZabcabcabc'.repeat(30);
            const bytes = [];

            for (let i = 0; i < text.length; i += 1) bytes.push(text.charCodeAt(i) & 0xff);
            const tokens = compress(bytes, 8);
            let position = 0;

            tokens.forEach(function (token) {
              if (token.kind === 'literal') {
                position += 1;
                return;
              }
              api.assert.atLeast(token.distance, 1, 'a distance of zero is not a back-reference');
              api.assert.atMost(token.distance, Math.min(position, 4096),
                'a match cannot reach before the start or outside the window');
              api.assert.atLeast(token.length, 3, 'a match shorter than the minimum is a literal');
              position += token.length;
            });
            api.assert.equal(position, bytes.length, 'the tokens must cover the input exactly');
          }
        }
      ]
    }],

    'general-purpose-codecs': [{
      id: 'block-choice',
      title: 'The block-type decision, and the bound it guarantees',
      prompt: 'chooseBlock(bytes, codedBits) must return { stored, coded, choice, overhead, ' +
        'worstRatio } for one DEFLATE-style block. A stored block costs 5 bytes of header plus ' +
        'the raw bytes; a coded block costs ceil(codedBits / 8) bytes. `choice` is "coded" when ' +
        'the coded form is strictly smaller and "stored" otherwise, `overhead` is the stored ' +
        'size minus the input size, and `worstRatio` is the input size divided by the size of ' +
        'whichever was chosen — so a value below one is expansion. The starter always codes, ' +
        'which is what a format without a stored block has to do.',
      entry: 'chooseBlock',
      starter: [
        'function chooseBlock(bytes, codedBits) {',
        '  // No stored option: incompressible input expands by whatever the coder spends.',
        '  const coded = Math.ceil(codedBits / 8);',
        '',
        '  return {',
        '    stored: bytes.length + 5,',
        '    coded: coded,',
        '    choice: "coded",',
        '    overhead: 5,',
        '    worstRatio: bytes.length / Math.max(1, coded)',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function chooseBlock(bytes, codedBits) {',
        '  const stored = bytes.length + 5;',
        '  const coded = Math.ceil(codedBits / 8);',
        '  const choice = coded < stored ? "coded" : "stored";',
        '  const chosen = Math.min(stored, coded);',
        '',
        '  return {',
        '    stored: stored,',
        '    coded: coded,',
        '    choice: choice,',
        '    overhead: 5,',
        '    worstRatio: bytes.length / Math.max(1, chosen)',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'compressible input takes the coded block',
          assert: function (chooseBlock, api) {
            const bytes = new Array(3000).fill(65);
            const result = chooseBlock(bytes, 800);

            api.assert.equal(result.choice, 'coded', '100 bytes coded against 3 005 stored');
            api.assert.equal(result.coded, 100);
            api.assert.equal(result.stored, 3005);
            api.assert.atLeast(result.worstRatio, 29, 'the ratio is the input over the chosen size');
          }
        },
        {
          name: 'incompressible input takes the stored block',
          assert: function (chooseBlock, api) {
            const rng = api.Random.seeded(4);
            const bytes = [];

            for (let i = 0; i < 3000; i += 1) bytes.push(Math.floor(rng.next() * 256));
            const result = chooseBlock(bytes, 3000 * 9);

            api.assert.equal(result.choice, 'stored',
              'nine bits per byte is larger than the input plus five');
            api.assert.equal(result.stored, 3005);
          }
        },
        {
          name: 'the expansion is bounded by the header, whatever the coder does',
          assert: function (chooseBlock, api) {
            [3000, 12000, 60000].forEach(function (size) {
              const bytes = new Array(size).fill(1);
              const terrible = chooseBlock(bytes, size * 40);

              api.assert.equal(terrible.choice, 'stored', 'a hopeless coder must be rejected');
              api.assert.atMost(size + 5 - size, 5,
                'the expansion is the 5-byte header and nothing more');
              api.assert.atLeast(terrible.worstRatio, size / (size + 5),
                'so the worst ratio approaches one from below, never far below');
            });
          }
        },
        {
          name: 'a tie goes to the stored block',
          assert: function (chooseBlock, api) {
            const bytes = new Array(100).fill(7);
            const tie = chooseBlock(bytes, 105 * 8);

            api.assert.equal(tie.coded, 105, 'exactly the stored size');
            api.assert.equal(tie.choice, 'stored',
              'coded must be STRICTLY smaller to be worth the decode cost');
            api.assert.equal(tie.overhead, 5, 'the header is a constant');
          }
        }
      ]
    }],

    'context-modelling': [{
      id: 'order-2-model',
      title: 'An order-2 model, and the sparsity it has to survive',
      prompt: 'cost(symbols, order, alphabetSize) must return { bits, contexts } for coding the ' +
        'symbol array under an adaptive order-k model with add-one smoothing. Walk the symbols ' +
        'in order; for each one, look up the context formed by the previous `order` symbols ' +
        '(fewer at the very start), give the symbol probability (count + 1) / (total + ' +
        'alphabetSize) — or 1 / alphabetSize if the context is new — add −log₂ of that to the ' +
        'running total, and only THEN update the counts. Updating before coding is the classic ' +
        'bug: it lets the model see the symbol it is predicting, and the reported size becomes ' +
        'impossible. `contexts` is the number of distinct contexts seen.',
      entry: 'cost',
      starter: [
        'function cost(symbols, order, alphabetSize) {',
        '  // Order 0 only: it ignores the context entirely.',
        '  const counts = new Map();',
        '  let total = 0;',
        '  let bits = 0;',
        '',
        '  symbols.forEach(function (symbol) {',
        '    const p = ((counts.get(symbol) || 0) + 1) / (total + alphabetSize);',
        '',
        '    bits -= Math.log2(p);',
        '    counts.set(symbol, (counts.get(symbol) || 0) + 1);',
        '    total += 1;',
        '  });',
        '  return { bits: bits, contexts: 1 };',
        '}'
      ].join('\n'),
      solution: [
        'function cost(symbols, order, alphabetSize) {',
        '  const contexts = new Map();',
        '  let bits = 0;',
        '',
        '  symbols.forEach(function (symbol, at) {',
        '    const from = Math.max(0, at - order);',
        '    const key = symbols.slice(from, at).join(",");',
        '    const entry = contexts.get(key);',
        '    const p = entry',
        '      ? ((entry.counts.get(symbol) || 0) + 1) / (entry.total + alphabetSize)',
        '      : 1 / alphabetSize;',
        '',
        '    bits -= Math.log2(p);',
        '    if (!entry) {',
        '      contexts.set(key, { total: 1, counts: new Map([[symbol, 1]]) });',
        '      return;',
        '    }',
        '    entry.counts.set(symbol, (entry.counts.get(symbol) || 0) + 1);',
        '    entry.total += 1;',
        '  });',
        '  return { bits: bits, contexts: contexts.size };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'order 2 beats order 0 on text with real structure',
          assert: function (cost, api) {
            const text = ('the quick brown fox jumps over the lazy dog. ').repeat(30);
            const alphabet = [];
            const index = new Map();
            const symbols = [];

            for (let i = 0; i < text.length; i += 1) {
              const code = text.charCodeAt(i);

              if (!index.has(code)) {
                index.set(code, alphabet.length);
                alphabet.push(code);
              }
              symbols.push(index.get(code));
            }
            const zero = cost(symbols, 0, alphabet.length);
            const two = cost(symbols, 2, alphabet.length);

            api.assert.atMost(two.bits, zero.bits * 0.75,
              'order 2 must be clearly better: ' + two.bits.toFixed(0) + ' against ' +
              zero.bits.toFixed(0));
            api.assert.atLeast(two.contexts, 20, 'and it must have found real contexts');
          }
        },
        {
          name: 'it does not update before coding — the size must be possible',
          assert: function (cost, api) {
            const symbols = [];

            for (let i = 0; i < 400; i += 1) symbols.push(i % 7);
            const result = cost(symbols, 2, 7);

            api.assert.atLeast(result.bits, 1,
              'a model that sees the symbol first reports near-zero bits');
            api.assert.atLeast(result.bits / symbols.length, 0.005,
              'even a perfectly periodic sequence costs something to learn');
          }
        },
        {
          name: 'a bigger alphabet costs more when contexts are sparse',
          assert: function (cost, api) {
            const rng = api.Random.seeded(15);
            const symbols = [];

            for (let i = 0; i < 800; i += 1) symbols.push(Math.floor(rng.next() * 40));
            const small = cost(symbols, 2, 40);
            const large = cost(symbols, 2, 200);

            api.assert.atLeast(large.bits, small.bits,
              'reserving probability for 200 symbols costs more than for 40');
          }
        },
        {
          name: 'the context count grows with the order',
          assert: function (cost, api) {
            const rng = api.Random.seeded(23);
            const symbols = [];

            for (let i = 0; i < 1200; i += 1) symbols.push(Math.floor(rng.next() * 6));
            const one = cost(symbols, 1, 6);
            const three = cost(symbols, 3, 6);

            api.assert.atMost(one.contexts, 7, 'six symbols plus the empty starting context');
            api.assert.atLeast(three.contexts, 100,
              'order 3 over six symbols reaches into the hundreds');
            api.assert.atLeast(three.bits, one.bits,
              'and on a random source the extra contexts are pure cost');
          }
        }
      ]
    }],

    'transform-compression': [{
      id: 'move-to-front',
      title: 'Move-to-front and its inverse',
      prompt: 'transform(bytes) must return the move-to-front encoding of the byte array: start ' +
        'with the list 0..255 in order, and for each byte emit its POSITION in the list and then ' +
        'move that byte to the front. invert(indices) must undo it, starting from the same list ' +
        'and reading each index as a position. Return both from one function: ' +
        'moveToFront(bytes, indices) returns { forward, back } where `forward` is the encoding of ' +
        '`bytes` and `back` is the decoding of `indices`. The starter emits the bytes unchanged, ' +
        'which is what the encoding looks like if the list is never reordered.',
      entry: 'moveToFront',
      starter: [
        'function moveToFront(bytes, indices) {',
        '  // No reordering: the position of byte b in 0..255 is always b.',
        '  return { forward: bytes.slice(), back: indices.slice() };',
        '}'
      ].join('\n'),
      solution: [
        'function moveToFront(bytes, indices) {',
        '  function encode(input) {',
        '    const list = [];',
        '',
        '    for (let i = 0; i < 256; i += 1) list.push(i);',
        '    const out = [];',
        '',
        '    input.forEach(function (byte) {',
        '      const at = list.indexOf(byte);',
        '',
        '      out.push(at);',
        '      list.splice(at, 1);',
        '      list.unshift(byte);',
        '    });',
        '    return out;',
        '  }',
        '  function decode(input) {',
        '    const list = [];',
        '',
        '    for (let i = 0; i < 256; i += 1) list.push(i);',
        '    const out = [];',
        '',
        '    input.forEach(function (at) {',
        '      const byte = list[at];',
        '',
        '      out.push(byte);',
        '      list.splice(at, 1);',
        '      list.unshift(byte);',
        '    });',
        '    return out;',
        '  }',
        '  return { forward: encode(bytes), back: decode(indices) };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it round-trips any input',
          assert: function (moveToFront, api) {
            const rng = api.Random.seeded(31);
            const bytes = [];

            for (let i = 0; i < 500; i += 1) bytes.push(Math.floor(rng.next() * 256));
            const forward = moveToFront(bytes, []).forward;
            const back = moveToFront([], forward).back;

            api.assert.equal(back.join(','), bytes.join(','),
              'encoding then decoding must return the original bytes');
          }
        },
        {
          name: 'a run of one byte becomes a run of zeros',
          assert: function (moveToFront, api) {
            const bytes = new Array(50).fill(200);
            const forward = moveToFront(bytes, []).forward;

            api.assert.equal(forward[0], 200, 'the first occurrence costs its position in the list');
            for (let i = 1; i < forward.length; i += 1) {
              api.assert.equal(forward[i], 0,
                'every repeat is at the front of the list, so it costs zero');
            }
          }
        },
        {
          name: 'it lowers the entropy of run-structured data',
          assert: function (moveToFront, api) {
            function entropy(symbols) {
              const counts = new Map();

              symbols.forEach(function (s) { counts.set(s, (counts.get(s) || 0) + 1); });
              let bits = 0;

              counts.forEach(function (count) {
                const p = count / symbols.length;

                bits -= p * Math.log2(p);
              });
              return bits;
            }
            const bytes = [];

            [65, 66, 67, 68, 69, 70, 71, 72].forEach(function (byte) {
              for (let i = 0; i < 60; i += 1) bytes.push(byte);
            });
            const forward = moveToFront(bytes, []).forward;

            api.assert.atMost(entropy(forward), entropy(bytes) * 0.25,
              'run-structured input must collapse: ' + entropy(forward).toFixed(3) +
              ' against ' + entropy(bytes).toFixed(3));
          }
        },
        {
          name: 'it does NOT help data with no local structure',
          assert: function (moveToFront, api) {
            function entropy(symbols) {
              const counts = new Map();

              symbols.forEach(function (s) { counts.set(s, (counts.get(s) || 0) + 1); });
              let bits = 0;

              counts.forEach(function (count) {
                const p = count / symbols.length;

                bits -= p * Math.log2(p);
              });
              return bits;
            }
            const rng = api.Random.seeded(41);
            const bytes = [];

            for (let i = 0; i < 2000; i += 1) bytes.push(Math.floor(rng.next() * 64));
            const forward = moveToFront(bytes, []).forward;

            api.assert.atLeast(entropy(forward), entropy(bytes) * 0.9,
              'move-to-front needs the transform before it — on unstructured data it does nothing');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
