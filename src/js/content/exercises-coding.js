/**
 * Graded exercises for entropy, prefix codes and arithmetic coding (M22.1-M22.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'information-and-entropy': [{
      id: 'order-k-entropy',
      title: 'Order-k conditional entropy, with the reliability reported',
      prompt: 'entropy(symbols, k) must return { bits, contexts, perContext } for the order-k ' +
        'conditional entropy of the symbol array, in bits per symbol. For k = 0 that is the ' +
        'plain Shannon entropy of the whole array. For k ≥ 1, group the symbols by the k symbols ' +
        'immediately before them — the first k symbols have no full context and are not ' +
        'predicted — compute each context’s own entropy, and return the average WEIGHTED by how ' +
        'often each context occurred. `contexts` is the number of distinct contexts seen and ' +
        '`perContext` is the predicted count divided by that. The starter returns the order-0 ' +
        'answer whatever k is.',
      entry: 'entropy',
      starter: [
        'function entropy(symbols, k) {',
        '  // Order 0 only: this ignores k entirely.',
        '  const counts = new Map();',
        '',
        '  symbols.forEach(function (symbol) {',
        '    counts.set(symbol, (counts.get(symbol) || 0) + 1);',
        '  });',
        '  let bits = 0;',
        '',
        '  counts.forEach(function (count) {',
        '    const p = count / symbols.length;',
        '',
        '    bits -= p * Math.log2(p);',
        '  });',
        '  return { bits: bits, contexts: 1, perContext: symbols.length };',
        '}'
      ].join('\n'),
      solution: [
        'function entropy(symbols, k) {',
        '  function entropyOf(counts, total) {',
        '    let bits = 0;',
        '',
        '    counts.forEach(function (count) {',
        '      if (count === 0) return;',
        '      const p = count / total;',
        '',
        '      bits -= p * Math.log2(p);',
        '    });',
        '    return bits;',
        '  }',
        '  if (k === 0) {',
        '    const counts = new Map();',
        '',
        '    symbols.forEach(function (symbol) {',
        '      counts.set(symbol, (counts.get(symbol) || 0) + 1);',
        '    });',
        '    return { bits: entropyOf(counts, symbols.length), contexts: 1,',
        '      perContext: symbols.length };',
        '  }',
        '  const contexts = new Map();',
        '  const predicted = Math.max(0, symbols.length - k);',
        '',
        '  for (let i = k; i < symbols.length; i += 1) {',
        '    const key = symbols.slice(i - k, i).join(",");',
        '    let entry = contexts.get(key);',
        '',
        '    if (!entry) {',
        '      entry = { total: 0, counts: new Map() };',
        '      contexts.set(key, entry);',
        '    }',
        '    entry.total += 1;',
        '    entry.counts.set(symbols[i], (entry.counts.get(symbols[i]) || 0) + 1);',
        '  }',
        '  let bits = 0;',
        '',
        '  contexts.forEach(function (entry) {',
        '    bits += (entry.total / predicted) * entropyOf(entry.counts, entry.total);',
        '  });',
        '  return { bits: predicted === 0 ? 0 : bits, contexts: contexts.size,',
        '    perContext: contexts.size === 0 ? 0 : predicted / contexts.size };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a fair coin is one bit and a biased one matches the closed form',
          assert: function (entropy, api) {
            const rng = api.Random.seeded(3);
            const fair = [];

            for (let i = 0; i < 20000; i += 1) fair.push(rng.next() < 0.5 ? 1 : 0);
            api.assert.closeTo(entropy(fair, 0).bits, 1, 0.01, 'a fair coin carries one bit');

            const biased = [];
            const rng2 = api.Random.seeded(5);

            for (let i = 0; i < 20000; i += 1) biased.push(rng2.next() < 0.25 ? 1 : 0);
            const truth = -(0.25 * Math.log2(0.25) + 0.75 * Math.log2(0.75));

            api.assert.closeTo(entropy(biased, 0).bits, truth, 0.02,
              'H(0.25) is a closed form and the estimate must match it');
          }
        },
        {
          name: 'a first-order Markov chain has a much lower order-1 entropy',
          assert: function (entropy, api) {
            const rng = api.Random.seeded(7);
            const states = 4;
            const stay = 0.8;
            const chain = [];
            let current = 0;

            for (let i = 0; i < 20000; i += 1) {
              chain.push(current);
              if (rng.next() >= stay) {
                current = (current + 1 + Math.floor(rng.next() * (states - 1))) % states;
              }
            }
            const other = (1 - stay) / (states - 1);
            const truth = -(stay * Math.log2(stay) + (states - 1) * other * Math.log2(other));

            api.assert.closeTo(entropy(chain, 0).bits, Math.log2(states), 0.05,
              'the stationary distribution is uniform, so order 0 is log2(states)');
            api.assert.closeTo(entropy(chain, 1).bits, truth, 0.06,
              'order 1 must find the transition entropy: ' + truth.toFixed(4));
            api.assert.atMost(entropy(chain, 1).bits, entropy(chain, 0).bits - 0.5,
              'and it must be far below the order-0 figure');
          }
        },
        {
          name: 'it reports the context count and the observations per context',
          assert: function (entropy, api) {
            const symbols = [];

            for (let i = 0; i < 600; i += 1) symbols.push(i % 5);
            const first = entropy(symbols, 1);

            api.assert.equal(first.contexts, 5, 'five distinct one-symbol contexts');
            api.assert.closeTo(first.perContext, 599 / 5, 1e-9,
              'the first k symbols are not predicted, so it is (n - k) / contexts');
            api.assert.closeTo(first.bits, 0, 1e-9,
              'a cycle of period five is perfectly predictable at order 1');
          }
        },
        {
          name: 'a periodic sequence needs enough order to be predictable',
          assert: function (entropy, api) {
            const symbols = [];

            for (let i = 0; i < 900; i += 1) symbols.push([0, 1, 0, 2][i % 4]);
            api.assert.atLeast(entropy(symbols, 1).bits, 0.4,
              'order 1 cannot tell the two zeros apart, so it must be uncertain');
            api.assert.atMost(entropy(symbols, 2).bits, 0.02,
              'order 2 resolves it and the entropy must collapse');
          }
        }
      ]
    }],

    'prefix-codes-and-huffman': [{
      id: 'canonical-huffman',
      title: 'Canonical Huffman: rebuild the code from lengths alone',
      prompt: 'canonical(lengths) takes a Map from symbol to codeword LENGTH and must return a ' +
        'Map from symbol to a codeword string of 0s and 1s. Sort the entries by (length, then ' +
        'symbol ascending); assign the first the all-zero codeword of its length; and for each ' +
        'subsequent entry add one to the previous code and then shift left by the increase in ' +
        'length. Pad each codeword to its own length with leading zeros. The result must be a ' +
        'prefix code — that is what the construction guarantees, and the tests check it. The ' +
        'starter assigns codewords in symbol order without the shift, which produces collisions ' +
        'as soon as two lengths differ.',
      entry: 'canonical',
      starter: [
        'function canonical(lengths) {',
        '  // No shift on a length change: as soon as lengths differ, codewords collide.',
        '  const codes = new Map();',
        '  let code = 0;',
        '',
        '  lengths.forEach(function (length, symbol) {',
        '    codes.set(symbol, code.toString(2).padStart(length, "0"));',
        '    code += 1;',
        '  });',
        '  return codes;',
        '}'
      ].join('\n'),
      solution: [
        'function canonical(lengths) {',
        '  const entries = [];',
        '',
        '  lengths.forEach(function (length, symbol) {',
        '    entries.push({ symbol: symbol, length: length });',
        '  });',
        '  entries.sort(function (a, b) {',
        '    if (a.length !== b.length) return a.length - b.length;',
        '    return a.symbol < b.symbol ? -1 : (a.symbol > b.symbol ? 1 : 0);',
        '  });',
        '  const codes = new Map();',
        '  let code = 0;',
        '  let previous = entries.length ? entries[0].length : 0;',
        '',
        '  entries.forEach(function (entry) {',
        '    code <<= (entry.length - previous);',
        '    previous = entry.length;',
        '    codes.set(entry.symbol, code.toString(2).padStart(entry.length, "0"));',
        '    code += 1;',
        '  });',
        '  return codes;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every codeword has the length it was given',
          assert: function (canonical, api) {
            const lengths = new Map([['a', 2], ['b', 2], ['c', 3], ['d', 4], ['e', 4]]);
            const codes = canonical(lengths);

            lengths.forEach(function (length, symbol) {
              const code = codes.get(symbol);

              api.assert.equal(typeof code, 'string', symbol + ' has no codeword');
              api.assert.equal(code.length, length,
                symbol + ' should be ' + length + ' bits and is ' + code.length);
              api.assert.equal(/^[01]+$/.test(code), true, symbol + ' is not a bit string');
            });
          }
        },
        {
          name: 'it produces a prefix code — no codeword begins another',
          assert: function (canonical, api) {
            const lengths = new Map([['a', 1], ['b', 3], ['c', 3], ['d', 4], ['e', 4],
              ['f', 5], ['g', 5]]);
            const codes = canonical(lengths);
            const all = [];

            codes.forEach(function (code) { all.push(code); });
            all.forEach(function (code, i) {
              all.forEach(function (other, j) {
                if (i === j) return;
                api.assert.equal(other.indexOf(code) === 0, false,
                  code + ' is a prefix of ' + other + ' - that is not decodable');
              });
            });
          }
        },
        {
          name: 'it matches the canonical assignment exactly',
          assert: function (canonical, api) {
            const lengths = new Map([['a', 2], ['b', 2], ['c', 2], ['d', 3], ['e', 3]]);
            const codes = canonical(lengths);

            api.assert.equal(codes.get('a'), '00', 'the shortest, lowest symbol starts at zero');
            api.assert.equal(codes.get('b'), '01', 'then consecutive');
            api.assert.equal(codes.get('c'), '10');
            api.assert.equal(codes.get('d'), '110', 'a length increase shifts left');
            api.assert.equal(codes.get('e'), '111');
          }
        },
        {
          name: 'a code built from Huffman lengths decodes what it encodes',
          assert: function (canonical, api) {
            const frequencies = new Map([['e', 30], ['t', 25], ['o', 25], ['q', 12], ['z', 8]]);
            const lengths = new Map([['e', 2], ['t', 2], ['o', 2], ['q', 3], ['z', 3]]);
            const codes = canonical(lengths);
            const message = 'etoqzeeetttoqz'.split('');
            let bits = '';

            message.forEach(function (symbol) { bits += codes.get(symbol); });

            const byCode = new Map();

            codes.forEach(function (code, symbol) { byCode.set(code, symbol); });
            const out = [];
            let current = '';

            bits.split('').forEach(function (bit) {
              current += bit;
              if (byCode.has(current)) {
                out.push(byCode.get(current));
                current = '';
              }
            });
            api.assert.equal(out.join(''), message.join(''),
              'the stream must decode back to the message with no separators');
            let expected = 0;

            frequencies.forEach(function (count, symbol) {
              expected += count * lengths.get(symbol);
            });
            api.assert.atLeast(expected, 1, 'the weighted length is a real number of bits');
          }
        }
      ]
    }],

    'arithmetic-coding-and-ans': [{
      id: 'interval-coder',
      title: 'The interval walk, and the bits it costs',
      prompt: 'code(symbols, model) must narrow the interval [0, 1) by each symbol in turn and ' +
        'return { low, high, width, bits, steps }. `model` is a Map from symbol to probability ' +
        '(they sum to 1). For each symbol, the current interval [low, high) is replaced by the ' +
        'sub-interval that symbol owns: iterate the model in insertion order, accumulate the ' +
        'cumulative probability before the symbol and after it, and set the new low and high to ' +
        'low + width·before and low + width·after. `bits` is −log₂(final width) and `steps` is ' +
        'an array of the width after each symbol. The starter halves the interval per symbol, ' +
        'which is what a one-bit-per-symbol code does.',
      entry: 'code',
      starter: [
        'function code(symbols, model) {',
        '  // Halving per symbol: exactly one bit each, whatever the probabilities are.',
        '  let low = 0;',
        '  let high = 1;',
        '  const steps = [];',
        '',
        '  symbols.forEach(function () {',
        '    high = low + (high - low) / 2;',
        '    steps.push(high - low);',
        '  });',
        '  return { low: low, high: high, width: high - low,',
        '    bits: -Math.log2(high - low), steps: steps };',
        '}'
      ].join('\n'),
      solution: [
        'function code(symbols, model) {',
        '  let low = 0;',
        '  let high = 1;',
        '  const steps = [];',
        '',
        '  symbols.forEach(function (symbol) {',
        '    const width = high - low;',
        '    let before = 0;',
        '    let found = false;',
        '',
        '    model.forEach(function (p, key) {',
        '      if (found || key === symbol) {',
        '        found = found || key === symbol;',
        '        return;',
        '      }',
        '      before += p;',
        '    });',
        '    const p = model.get(symbol);',
        '',
        '    high = low + width * (before + p);',
        '    low = low + width * before;',
        '    steps.push(high - low);',
        '  });',
        '  return { low: low, high: high, width: high - low,',
        '    bits: -Math.log2(high - low), steps: steps };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the interval narrows by the symbol’s probability, not by a half',
          assert: function (code, api) {
            const model = new Map([['a', 0.6], ['b', 0.3], ['c', 0.1]]);
            const result = code(['a'], model);

            api.assert.closeTo(result.width, 0.6, 1e-12,
              'one "a" leaves an interval of width 0.6');
            api.assert.closeTo(result.low, 0, 1e-12, 'and it is the first sub-interval');

            const rare = code(['c'], model);

            api.assert.closeTo(rare.width, 0.1, 1e-12, 'one "c" leaves 0.1');
            api.assert.closeTo(rare.low, 0.9, 1e-12, 'starting at 0.9');
          }
        },
        {
          name: 'the final width is the product of the probabilities',
          assert: function (code, api) {
            const model = new Map([['a', 0.5], ['b', 0.3], ['c', 0.2]]);
            const message = ['b', 'a', 'c', 'a', 'a'];
            const result = code(message, model);
            let product = 1;

            message.forEach(function (symbol) { product *= model.get(symbol); });
            api.assert.closeTo(result.width, product, 1e-12,
              'the interval width IS the product, which is what makes the cost additive in logs');
            api.assert.closeTo(result.bits, -Math.log2(product), 1e-9,
              'and the bits are minus its base-two logarithm');
          }
        },
        {
          name: 'a skewed source costs far less than one bit per symbol',
          assert: function (code, api) {
            const model = new Map([['a', 0.99], ['b', 0.01]]);
            const message = [];

            for (let i = 0; i < 200; i += 1) message.push(i % 100 === 0 ? 'b' : 'a');
            const result = code(message, model);
            const perSymbol = result.bits / message.length;

            api.assert.atMost(perSymbol, 0.2,
              'the entropy here is 0.0808 bits per symbol; a symbol code would spend 1.0');
            api.assert.atLeast(perSymbol, 0.05, 'and it cannot be below the entropy');
          }
        },
        {
          name: 'the interval always stays inside the previous one',
          assert: function (code, api) {
            const model = new Map([['x', 0.4], ['y', 0.35], ['z', 0.25]]);
            const message = ['x', 'y', 'z', 'z', 'y', 'x', 'x'];
            const result = code(message, model);

            api.assert.equal(result.steps.length, message.length, 'one step per symbol');
            for (let i = 1; i < result.steps.length; i += 1) {
              api.assert.equal(result.steps[i] < result.steps[i - 1], true,
                'step ' + i + ' must be strictly narrower than the one before it');
            }
            api.assert.equal(result.low >= 0 && result.high <= 1, true,
              'the interval never leaves [0, 1)');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
