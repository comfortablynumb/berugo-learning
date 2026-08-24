/**
 * Context modelling: the model is where the ratio comes from.
 *
 * A compressor is two separable things: a MODEL that predicts the next symbol
 * and a CODER that spends −log2(p) bits on whatever actually arrives. The coder
 * has been solved since arithmetic coding — it hits the entropy of whatever
 * distribution it is handed, to within two bits per message. So every
 * improvement in compression since 1980 is an improvement in prediction, and
 * "compression is prediction" is a statement of arithmetic rather than a
 * slogan: the bits a message costs under a model are exactly its
 * cross-entropy, which is exactly the loss a language model reports.
 *
 * The obstacle is sparsity. An order-4 model over bytes has 2^32 contexts, and
 * any real input visits a tiny fraction of them, so most predictions are made
 * from a context seen once or never. PPM answers with ESCAPES: predict from the
 * longest matching context, and when the symbol has never been seen there,
 * emit an escape and fall back to a shorter one. The escape costs bits, so the
 * order that wins is not the highest one — this module measures where the
 * turnover is rather than asserting it.
 *
 * Context MIXING (the PAQ family) does not choose. It runs several models at
 * once and blends their predictions with weights that adapt to which model has
 * been right, which is why it wins every ratio benchmark and loses every speed
 * one.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.ContextModel = api;
}(this, function () {
  'use strict';

  function log2(x) {
    return Math.log(x) / Math.LN2;
  }

  /* ---------------------------------------------------- order-k models */

  /**
   * An adaptive order-k model with add-one smoothing: every context keeps a
   * count per symbol, and an unseen symbol still gets a probability so it can
   * be coded at all. The smoothing is why a high-order model does not crash on
   * new data, and why it is expensive - reserving mass for 255 unseen symbols
   * in every context is most of what a high-order model spends.
   */
  function orderModel(order, alphabetSize) {
    const contexts = new Map();

    function key(history) {
      return history.slice(Math.max(0, history.length - order)).join(',');
    }

    return {
      order: order,
      contexts: contexts,
      probability: function (history, symbol) {
        const entry = contexts.get(key(history));

        if (!entry) return 1 / alphabetSize;
        return ((entry.counts.get(symbol) || 0) + 1) / (entry.total + alphabetSize);
      },
      observe: function (history, symbol) {
        const k = key(history);
        let entry = contexts.get(k);

        if (!entry) {
          entry = { counts: new Map(), total: 0 };
          contexts.set(k, entry);
        }
        entry.counts.set(symbol, (entry.counts.get(symbol) || 0) + 1);
        entry.total += 1;
      }
    };
  }

  /**
   * Code a message under one order-k model and report the bits. Nothing is
   * transmitted: encoder and decoder update identically, so the model costs
   * nothing in the stream and everything in the CPU.
   */
  function costUnder(symbols, model) {
    const history = [];
    let bits = 0;
    const curve = [];
    const step = Math.max(1, Math.floor(symbols.length / 40));

    for (let i = 0; i < symbols.length; i += 1) {
      const p = model.probability(history, symbols[i]);

      bits -= log2(Math.max(p, Number.MIN_VALUE));
      model.observe(history, symbols[i]);
      history.push(symbols[i]);
      if (i % step === 0) curve.push({ at: i, bitsPerSymbol: bits / (i + 1) });
    }
    return {
      order: model.order,
      bits: bits,
      bitsPerSymbol: symbols.length === 0 ? 0 : bits / symbols.length,
      contexts: model.contexts.size,
      perContext: model.contexts.size === 0 ? 0 : symbols.length / model.contexts.size,
      curve: curve
    };
  }

  /** Orders 0..maxOrder over the same input, so the turnover is visible. */
  function orderSweep(symbols, maxOrder, alphabetSize) {
    const rows = [];

    for (let order = 0; order <= maxOrder; order += 1) {
      rows.push(costUnder(symbols, orderModel(order, alphabetSize)));
    }
    return rows;
  }

  /* -------------------------------------------------------------- PPM */

  /**
   * PPM with method-A escapes: predict from the longest context that has seen
   * anything, and when the symbol is new there, spend an escape and drop an
   * order. The escape probability is 1/(total + 1), which is the "one more
   * novel symbol than we have seen" estimate.
   *
   * The exclusion rule matters and is implemented: a symbol already ruled out
   * by a longer context cannot be predicted by a shorter one, so its mass is
   * redistributed rather than wasted. Without exclusions PPM measurably loses
   * to a plain order-k model at the same order.
   */
  function ppm(symbols, maxOrder, alphabetSize) {
    const models = [];

    for (let order = 0; order <= maxOrder; order += 1) {
      models.push(orderModel(order, alphabetSize));
    }
    const history = [];
    let bits = 0;
    let escapes = 0;

    for (let i = 0; i < symbols.length; i += 1) {
      const coded = codeOne({ models: models, history: history, alphabetSize: alphabetSize },
        symbols[i], maxOrder);

      bits += coded.bits;
      escapes += coded.escapes;
      models.forEach(function (model) { model.observe(history, symbols[i]); });
      history.push(symbols[i]);
    }
    return {
      maxOrder: maxOrder, bits: bits, escapes: escapes,
      bitsPerSymbol: symbols.length === 0 ? 0 : bits / symbols.length,
      escapesPerSymbol: symbols.length === 0 ? 0 : escapes / symbols.length
    };
  }

  /** One symbol, walking down the orders until a context has seen it. */
  function codeOne(state, symbol, maxOrder) {
    const excluded = new Set();
    let bits = 0;
    let escapes = 0;

    for (let order = maxOrder; order >= 0; order -= 1) {
      const entry = contextEntry(state.models[order], state.history, order);

      if (!entry || entry.total === 0) continue;
      const available = availableMass(entry, excluded);

      if (available.total === 0) continue;
      const count = entry.counts.get(symbol) || 0;

      if (count > 0 && !excluded.has(symbol)) {
        return { bits: bits - log2(count / (available.total + 1)), escapes: escapes };
      }
      bits -= log2(1 / (available.total + 1));
      escapes += 1;
      entry.counts.forEach(function (unused, seen) { excluded.add(seen); });
    }
    const remaining = state.alphabetSize - excluded.size;

    return { bits: bits - log2(1 / Math.max(1, remaining)), escapes: escapes };
  }

  function contextEntry(model, history, order) {
    const key = history.slice(Math.max(0, history.length - order)).join(',');

    return model.contexts.get(key);
  }

  function availableMass(entry, excluded) {
    let total = 0;

    entry.counts.forEach(function (count, symbol) {
      if (!excluded.has(symbol)) total += count;
    });
    return { total: total };
  }

  /* -------------------------------------------------- context mixing */

  /**
   * An adaptive linear mixer. Each model contributes a distribution, the
   * mixture is a weighted sum, and after every symbol the weights move along
   * the gradient of the coding loss: the derivative of −log(Σ wᵢ pᵢ(s)) with
   * respect to wᵢ is −pᵢ(s)/mixture, so a model that gave the symbol that
   * actually arrived a high probability gains weight.
   *
   * PAQ mixes in the LOGISTIC domain over binary decisions, which is better
   * behaved when one model is very confident; this is the multi-symbol linear
   * analogue, and it makes the same point — a mixture beats choosing, and the
   * weights say which model is carrying the prediction at each point in the
   * file.
   */
  function mixer(models, rate) {
    const weights = models.map(function () { return 1 / models.length; });

    return {
      models: models,
      weights: weights,
      rate: rate === undefined ? 0.05 : rate,
      mix: function (parts, symbol) {
        let p = 0;

        parts.forEach(function (part, i) { p += weights[i] * (part.get(symbol) || 0); });
        return p;
      },
      update: function (parts, symbol, mixed) {
        if (mixed <= 0) return;
        let sum = 0;

        weights.forEach(function (weight, i) {
          const gain = (parts[i].get(symbol) || 0) / mixed;

          weights[i] = Math.max(1e-4, weight * (1 + this.rate * (gain - 1)));
          sum += weights[i];
        }, this);
        weights.forEach(function (weight, i) { weights[i] = weight / sum; });
      }
    };
  }

  /** The distribution one model gives over the whole alphabet, normalised. */
  function distributionOf(model, history, alphabetSize) {
    const table = new Map();
    let sum = 0;

    for (let symbol = 0; symbol < alphabetSize; symbol += 1) {
      const p = model.probability(history, symbol);

      table.set(symbol, p);
      sum += p;
    }
    if (sum > 0) table.forEach(function (p, symbol) { table.set(symbol, p / sum); });
    return table;
  }

  /**
   * Mix several order-k models and report the cost, plus the weight trace. The
   * trace is the output worth looking at: it shows the low orders carrying the
   * first few hundred symbols and the high orders taking over once their
   * contexts have been seen more than once.
   */
  function mixedCost(symbols, orders, alphabetSize) {
    const models = orders.map(function (order) { return orderModel(order, alphabetSize); });
    const blend = mixer(models);
    const history = [];
    let bits = 0;
    const weightTrace = [];
    const step = Math.max(1, Math.floor(symbols.length / 24));

    for (let i = 0; i < symbols.length; i += 1) {
      const parts = models.map(function (model) {
        return distributionOf(model, history, alphabetSize);
      });
      const mixed = blend.mix(parts, symbols[i]);

      bits -= log2(Math.max(mixed, Number.MIN_VALUE));
      blend.update(parts, symbols[i], mixed);
      models.forEach(function (model) { model.observe(history, symbols[i]); });
      history.push(symbols[i]);
      if (i % step === 0) {
        weightTrace.push({ at: i, weights: blend.weights.slice(),
          bitsPerSymbol: bits / (i + 1) });
      }
    }
    return {
      orders: orders.slice(), bits: bits,
      bitsPerSymbol: symbols.length === 0 ? 0 : bits / symbols.length,
      weights: blend.weights.slice(), weightTrace: weightTrace
    };
  }

  return {
    orderModel: orderModel, costUnder: costUnder, orderSweep: orderSweep,
    ppm: ppm, mixer: mixer, mixedCost: mixedCost,
    distributionOf: distributionOf
  };
}));
