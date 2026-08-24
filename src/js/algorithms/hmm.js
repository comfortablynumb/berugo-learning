/**
 * Hidden Markov models: a probabilistic automaton, decoded by dynamic
 * programming on a trellis.
 *
 * Viterbi is M12's dynamic programming with the states of an automaton as the
 * table's rows and the input positions as its columns. Recognising that is the
 * point of the section — it means a decoder for a new domain is a modelling
 * exercise rather than an algorithm to look up.
 *
 * Everything runs in the LOG DOMAIN, which is not a micro-optimisation. A
 * probability is a number below one and a path multiplies one per symbol, so a
 * sequence of a few hundred underflows a double to exactly zero and every path
 * ties at zero: the decoder then returns whichever path it happened to visit
 * first. Adding logs instead never underflows, and `underflowDepth` measures
 * where the naive version stops working rather than asserting that it does.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Hmm = api;
}(this, function () {
  'use strict';

  const NEG_INF = -Infinity;

  function log(value) {
    return value <= 0 ? NEG_INF : Math.log(value);
  }

  /** log(exp(a) + exp(b)) without leaving the log domain. */
  function logSum(a, b) {
    if (a === NEG_INF) return b;
    if (b === NEG_INF) return a;
    const high = Math.max(a, b);

    return high + Math.log(Math.exp(a - high) + Math.exp(b - high));
  }

  /* ------------------------------------------------------------ the model */

  /**
   * `states`, `symbols`, `initial[state]`, `transition[from][to]` and
   * `emission[state][symbol]`, all as ordinary probabilities. The logs are
   * taken once, here, so no decoder has to remember to.
   */
  function model(config) {
    return {
      states: config.states.slice(),
      symbols: config.symbols.slice(),
      initial: config.initial,
      transition: config.transition,
      emission: config.emission,
      logInitial: mapValues(config.states, function (state) {
        return log(config.initial[state]);
      }),
      logTransition: mapPairs(config.states, config.transition),
      logEmission: mapPairs(config.states, config.emission),
      label: config.label || null
    };
  }

  function mapValues(keys, fn) {
    const out = {};

    keys.forEach(function (key) { out[key] = fn(key); });
    return out;
  }

  function mapPairs(keys, table) {
    const out = {};

    keys.forEach(function (key) {
      out[key] = {};
      Object.keys(table[key] || {}).forEach(function (inner) {
        out[key][inner] = log(table[key][inner]);
      });
    });
    return out;
  }

  function logAt(table, from, to) {
    const row = table[from];

    return row && row[to] !== undefined ? row[to] : NEG_INF;
  }

  /* ------------------------------------------------------------- Viterbi */

  /**
   * The most probable state sequence. One column per observation, one row per
   * state; each cell keeps the best score reaching it and which state it came
   * from, and the answer is read back along those pointers.
   */
  function viterbi(hmm, observations) {
    const symbols = Array.isArray(observations) ? observations : String(observations).split('');

    if (symbols.length === 0) return { path: [], logProbability: 0, trellis: [] };
    const trellis = [firstColumn(hmm, symbols[0])];

    for (let t = 1; t < symbols.length; t += 1) {
      trellis.push(nextColumn(hmm, trellis[t - 1], symbols[t]));
    }
    return readBack(hmm, trellis);
  }

  function firstColumn(hmm, symbol) {
    const column = {};

    hmm.states.forEach(function (state) {
      column[state] = { score: hmm.logInitial[state] + logAt(hmm.logEmission, state, symbol),
        from: null };
    });
    return column;
  }

  function nextColumn(hmm, previous, symbol) {
    const column = {};

    hmm.states.forEach(function (state) {
      /* The back-pointer defaults to the first state rather than to null: when
         every path into this cell is impossible all the scores tie at
         -Infinity, and a null pointer would break the read-back on a sequence
         the model simply cannot produce. The score stays -Infinity, which is
         the honest answer. */
      let best = { score: NEG_INF, from: hmm.states[0] };

      hmm.states.forEach(function (from) {
        const score = previous[from].score + logAt(hmm.logTransition, from, state);

        if (score > best.score) best = { score: score, from: from };
      });
      column[state] = { score: best.score + logAt(hmm.logEmission, state, symbol),
        from: best.from };
    });
    return column;
  }

  function readBack(hmm, trellis) {
    const last = trellis[trellis.length - 1];
    let best = null;

    hmm.states.forEach(function (state) {
      if (best === null || last[state].score > last[best].score) best = state;
    });
    const path = [best];

    for (let t = trellis.length - 1; t > 0; t -= 1) {
      path.unshift(trellis[t][path[0]].from);
    }
    return { path: path, logProbability: last[best].score, trellis: trellis };
  }

  /* ------------------------------------------------- forward and backward */

  /** The total log probability of the observation sequence, summing over every
   *  path rather than taking the best one. */
  function forward(hmm, observations) {
    const symbols = Array.isArray(observations) ? observations : String(observations).split('');
    let column = mapValues(hmm.states, function (state) {
      return hmm.logInitial[state] + logAt(hmm.logEmission, state, symbols[0]);
    });
    const columns = [column];

    for (let t = 1; t < symbols.length; t += 1) {
      column = forwardStep(hmm, column, symbols[t]);
      columns.push(column);
    }
    let total = NEG_INF;

    hmm.states.forEach(function (state) { total = logSum(total, column[state]); });
    return { logProbability: total, columns: columns };
  }

  function forwardStep(hmm, previous, symbol) {
    const next = {};

    hmm.states.forEach(function (state) {
      let sum = NEG_INF;

      hmm.states.forEach(function (from) {
        sum = logSum(sum, previous[from] + logAt(hmm.logTransition, from, state));
      });
      next[state] = sum + logAt(hmm.logEmission, state, symbol);
    });
    return next;
  }

  /** The probability of each state at each position, given the whole sequence —
   *  which is a different question from the best PATH, and gives a different
   *  answer. */
  function posterior(hmm, observations) {
    const symbols = Array.isArray(observations) ? observations : String(observations).split('');
    const front = forward(hmm, symbols);
    const back = backward(hmm, symbols);

    return symbols.map(function (ignored, t) {
      const row = {};

      hmm.states.forEach(function (state) {
        row[state] = Math.exp(front.columns[t][state] + back[t][state] - front.logProbability);
      });
      return row;
    });
  }

  function backward(hmm, symbols) {
    const columns = new Array(symbols.length);

    columns[symbols.length - 1] = mapValues(hmm.states, function () { return 0; });
    for (let t = symbols.length - 2; t >= 0; t -= 1) {
      columns[t] = backwardStep(hmm, columns[t + 1], symbols[t + 1]);
    }
    return columns;
  }

  function backwardStep(hmm, next, symbol) {
    const column = {};

    hmm.states.forEach(function (state) {
      let sum = NEG_INF;

      hmm.states.forEach(function (to) {
        sum = logSum(sum, logAt(hmm.logTransition, state, to)
          + logAt(hmm.logEmission, to, symbol) + next[to]);
      });
      column[state] = sum;
    });
    return column;
  }

  /* ------------------------------------------------------- the references */

  /**
   * Every path enumerated. Exponential, and correct — the oracle Viterbi is
   * checked against on small models, because a dynamic program that is subtly
   * wrong still returns a plausible path.
   */
  function bruteForce(hmm, observations) {
    const symbols = Array.isArray(observations) ? observations : String(observations).split('');
    const paths = enumerate(hmm.states, symbols.length);
    let best = { path: null, logProbability: NEG_INF };

    paths.forEach(function (path) {
      const score = scorePath(hmm, path, symbols);

      if (score > best.logProbability) best = { path: path, logProbability: score };
    });
    return { path: best.path, logProbability: best.logProbability, paths: paths.length };
  }

  function enumerate(states, length) {
    let out = [[]];

    for (let i = 0; i < length; i += 1) {
      const next = [];

      out.forEach(function (prefix) {
        states.forEach(function (state) { next.push(prefix.concat([state])); });
      });
      out = next;
    }
    return out;
  }

  function scorePath(hmm, path, symbols) {
    let score = hmm.logInitial[path[0]] + logAt(hmm.logEmission, path[0], symbols[0]);

    for (let t = 1; t < path.length; t += 1) {
      score += logAt(hmm.logTransition, path[t - 1], path[t])
        + logAt(hmm.logEmission, path[t], symbols[t]);
    }
    return score;
  }

  /**
   * The same Viterbi in plain probabilities, which is what underflows. Kept so
   * the demo can report the length at which it stops distinguishing paths
   * rather than claiming it would.
   */
  function naiveViterbi(hmm, observations) {
    const symbols = Array.isArray(observations) ? observations : String(observations).split('');
    let column = mapValues(hmm.states, function (state) {
      return hmm.initial[state] * value(hmm.emission, state, symbols[0]);
    });

    for (let t = 1; t < symbols.length; t += 1) {
      column = naiveStep(hmm, column, symbols[t]);
    }
    let best = 0;

    hmm.states.forEach(function (state) { best = Math.max(best, column[state]); });
    return { probability: best, underflowed: best === 0 };
  }

  function naiveStep(hmm, previous, symbol) {
    const next = {};

    hmm.states.forEach(function (state) {
      let best = 0;

      hmm.states.forEach(function (from) {
        best = Math.max(best, previous[from] * value(hmm.transition, from, state));
      });
      next[state] = best * value(hmm.emission, state, symbol);
    });
    return next;
  }

  function value(table, from, to) {
    const row = table[from];

    return row && row[to] !== undefined ? row[to] : 0;
  }

  /** The sequence length at which plain-probability Viterbi hits zero. */
  function underflowDepth(hmm, symbol, limit) {
    const cap = limit === undefined ? 2000 : limit;
    const sequence = [];

    for (let length = 1; length <= cap; length += 1) {
      sequence.push(symbol);
      if (naiveViterbi(hmm, sequence).underflowed) return length;
    }
    return null;
  }

  /* ------------------------------------------------------- a sample model */

  /** A two-state weather model: the textbook shape, small enough to enumerate
   *  every path and check the decoder against it. */
  function weather() {
    return model({
      states: ['sunny', 'rainy'],
      symbols: ['walk', 'shop', 'clean'],
      initial: { sunny: 0.6, rainy: 0.4 },
      transition: { sunny: { sunny: 0.7, rainy: 0.3 }, rainy: { sunny: 0.4, rainy: 0.6 } },
      emission: {
        sunny: { walk: 0.6, shop: 0.3, clean: 0.1 },
        rainy: { walk: 0.1, shop: 0.4, clean: 0.5 }
      },
      label: 'weather'
    });
  }

  return {
    model: model, viterbi: viterbi, forward: forward, backward: backward,
    posterior: posterior, bruteForce: bruteForce, naiveViterbi: naiveViterbi,
    underflowDepth: underflowDepth, scorePath: scorePath, enumerate: enumerate,
    logSum: logSum, log: log, weather: weather, NEG_INF: NEG_INF
  };
}));
