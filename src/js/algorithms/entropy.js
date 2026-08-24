/**
 * Entropy: the floor under every compressor, measured rather than quoted.
 *
 * Shannon entropy is the average number of bits a symbol carries, and the
 * source-coding theorem says no lossless code can average fewer. That makes it
 * the only honest denominator for a compression ratio: "3x compression" says
 * nothing without saying 3x against what, and the answer is always the entropy
 * of some MODEL of the source.
 *
 * The word "model" is doing the work. An order-0 model sees each byte in
 * isolation; an order-1 model conditions on the previous byte; an order-2 model
 * on the previous two. English is about 4.1 bits per letter at order 0 and
 * about 3.3 at order 2, and the difference is exactly the redundancy a
 * context-modelling coder can remove and an order-0 coder cannot. So there is
 * no single entropy of a file - there is one number per model, and a
 * compressor's achievement is measured against the model it actually uses.
 *
 * Conditional entropy estimated from a finite sample is BIASED DOWNWARD, badly
 * so at high orders: an order-8 model over a kilobyte of text sees each context
 * once and reports an entropy near zero, which is memorisation rather than
 * modelling. This module reports the number of distinct contexts and the mean
 * observations per context alongside every estimate, so the reader can see when
 * the estimate has stopped meaning anything.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Entropy = api;
}(this, function () {
  'use strict';

  const LOG2 = Math.log(2);

  function log2(x) {
    return Math.log(x) / LOG2;
  }

  /** Symbol counts over an array-like of symbols (bytes, characters, tokens). */
  function counts(symbols) {
    const table = new Map();

    for (let i = 0; i < symbols.length; i += 1) {
      const key = symbols[i];

      table.set(key, (table.get(key) || 0) + 1);
    }
    return table;
  }

  /** Shannon entropy of a count table, in bits per symbol. */
  function entropyOf(table, total) {
    let bits = 0;

    table.forEach(function (count) {
      if (count === 0) return;
      const p = count / total;

      bits -= p * log2(p);
    });
    return bits;
  }

  /** Order-0 entropy: every symbol treated as independent of its neighbours. */
  function order0(symbols) {
    if (symbols.length === 0) return { bits: 0, symbols: 0, distinct: 0, total: 0 };
    const table = counts(symbols);

    return {
      bits: entropyOf(table, symbols.length),
      distinct: table.size,
      total: symbols.length,
      table: table
    };
  }

  /**
   * Order-k conditional entropy, estimated by counting each context's symbol
   * distribution. The context is the k symbols before the one being predicted,
   * and the first k symbols of the input have no full context so they are not
   * counted - which is why `predicted` is length - k rather than length.
   */
  function orderK(symbols, k) {
    if (k === 0) {
      const zero = order0(symbols);

      return { order: 0, bits: zero.bits, contexts: 1, predicted: zero.total,
        perContext: zero.total, distinct: zero.distinct };
    }
    const contexts = new Map();

    for (let i = k; i < symbols.length; i += 1) {
      const key = keyOf(symbols, i - k, k);
      let table = contexts.get(key);

      if (!table) {
        table = { total: 0, table: new Map() };
        contexts.set(key, table);
      }
      table.total += 1;
      table.table.set(symbols[i], (table.table.get(symbols[i]) || 0) + 1);
    }
    return summarise(contexts, k, Math.max(0, symbols.length - k));
  }

  function keyOf(symbols, from, length) {
    let key = '';

    for (let i = 0; i < length; i += 1) key += String(symbols[from + i]) + '';
    return key;
  }

  /**
   * The weighted average of each context's entropy, plus the two numbers that
   * say whether the estimate is trustworthy: how many contexts were seen and
   * how many observations each one got. Below a handful of observations per
   * context the estimate is measuring the sample rather than the source.
   */
  function summarise(contexts, order, predicted) {
    let bits = 0;

    contexts.forEach(function (entry) {
      bits += (entry.total / predicted) * entropyOf(entry.table, entry.total);
    });
    return {
      order: order,
      bits: predicted === 0 ? 0 : bits,
      contexts: contexts.size,
      predicted: predicted,
      perContext: contexts.size === 0 ? 0 : predicted / contexts.size,
      reliable: contexts.size === 0 ? false : predicted / contexts.size >= 5
    };
  }

  /** Order 0 through maxOrder, so the drop per order is visible. */
  function profile(symbols, maxOrder) {
    const rows = [];

    for (let k = 0; k <= maxOrder; k += 1) rows.push(orderK(symbols, k));
    return rows;
  }

  /**
   * Cross-entropy of `symbols` under a model's probability function, in bits
   * per symbol. This is what a compressor actually pays: the coder spends
   * -log2(p) bits on a symbol its model gave probability p, so a model that is
   * confident and wrong costs more than a model that is uncertain.
   */
  function crossEntropy(symbols, probabilityOf) {
    if (symbols.length === 0) return 0;
    let bits = 0;

    for (let i = 0; i < symbols.length; i += 1) {
      const p = probabilityOf(symbols[i], i);

      bits -= log2(Math.max(p, Number.MIN_VALUE));
    }
    return bits / symbols.length;
  }

  /**
   * KL divergence D(p || q) in bits: the extra cost of coding a source with
   * distribution p using a code built for q. It is not symmetric, and it is
   * infinite where q assigns zero to something p does not - which is why every
   * practical model reserves probability for the unseen.
   */
  function divergence(p, q) {
    let bits = 0;
    let infinite = false;

    p.forEach(function (probability, symbol) {
      if (probability === 0) return;
      const other = q.get(symbol) || 0;

      if (other === 0) {
        infinite = true;
        return;
      }
      bits += probability * log2(probability / other);
    });
    return { bits: infinite ? Infinity : bits, infinite: infinite };
  }

  /** A distribution as a Map, from counts, with optional add-one smoothing. */
  function distribution(table, total, alphabet) {
    const out = new Map();

    if (alphabet === undefined) {
      table.forEach(function (count, symbol) { out.set(symbol, count / total); });
      return out;
    }
    const denominator = total + alphabet.length;

    alphabet.forEach(function (symbol) {
      out.set(symbol, ((table.get(symbol) || 0) + 1) / denominator);
    });
    return out;
  }

  /**
   * Mutual information I(X; Y) in bits between a symbol and the one before it:
   * H(X) - H(X | previous). It is the redundancy an order-1 model can remove,
   * stated as one number.
   */
  function mutualInformation(symbols) {
    const zero = order0(symbols).bits;
    const one = orderK(symbols, 1).bits;

    return { order0: zero, order1: one, information: zero - one };
  }

  /** The floor in bytes: entropy times symbol count, rounded up. */
  function floorBytes(bits, count) {
    return Math.ceil(bits * count / 8);
  }

  /* -------------------------------------------------- synthetic sources */

  /** A biased coin, as symbols 0 and 1, with a known entropy of H(p). */
  function biasedCoin(length, p, rng) {
    const out = [];

    for (let i = 0; i < length; i += 1) out.push(rng.next() < p ? 1 : 0);
    return out;
  }

  /** The entropy of a biased coin, in closed form, to check an estimate against. */
  function binaryEntropy(p) {
    if (p <= 0 || p >= 1) return 0;
    return -(p * log2(p) + (1 - p) * log2(1 - p));
  }

  /**
   * A first-order Markov chain over `states` symbols with a given stay
   * probability. Its order-0 entropy is log2(states) - the stationary
   * distribution is uniform - and its order-1 entropy is the entropy of one
   * row, so the pair is a clean test that an estimator sees the structure.
   */
  function markovChain(length, states, stay, rng) {
    const out = [];
    let current = 0;

    for (let i = 0; i < length; i += 1) {
      out.push(current);
      if (rng.next() >= stay) {
        current = (current + 1 + Math.floor(rng.next() * (states - 1))) % states;
      }
    }
    return out;
  }

  /** The true order-1 entropy of markovChain's source. */
  function markovEntropy(states, stay) {
    const other = (1 - stay) / (states - 1);
    let bits = 0;

    if (stay > 0) bits -= stay * log2(stay);
    if (other > 0) bits -= (states - 1) * other * log2(other);
    return bits;
  }

  return {
    log2: log2, counts: counts, entropyOf: entropyOf,
    order0: order0, orderK: orderK, profile: profile,
    crossEntropy: crossEntropy, divergence: divergence, distribution: distribution,
    mutualInformation: mutualInformation, floorBytes: floorBytes,
    biasedCoin: biasedCoin, binaryEntropy: binaryEntropy,
    markovChain: markovChain, markovEntropy: markovEntropy
  };
}));
