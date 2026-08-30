/**
 * Brv32Predictors - branch predictors behind one interface.
 *
 * Every predictor here answers the same two questions - will this branch be
 * taken, and where does it go - and is told the answer afterwards. That shared
 * shape is what makes the tournament in 35.6 a comparison rather than a set of
 * anecdotes: the same trace, the same accounting, and the differences are the
 * predictors.
 *
 * The direction predictors and the target predictors are separate on purpose.
 * A conditional branch needs a direction and a target it can compute from the
 * instruction; an indirect jump needs a target it cannot. That split is why
 * returns are essentially free (a return-address stack predicts them almost
 * perfectly) and indirect calls are not.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Predictors = api;
  }
}(this, function () {
  'use strict';

  const DEFAULT_BITS = 10;

  function indexOf(pc, bits) {
    return ((pc >>> 2) & ((1 << bits) - 1));
  }

  /* ------------------------------------------------------ direction schemes */

  /** Never taken. The cheapest predictor there is, and the baseline every
   *  other one has to beat by enough to justify its area. */
  function staticNotTaken() {
    return {
      name: 'static: never taken',
      about: 'no state at all, and it is right whenever a loop is not looping',
      predict: function () { return false; },
      update: function () {},
      state: function () { return []; }
    };
  }

  /** Backward taken, forward not taken. One comparison, and it captures the
   *  fact that a loop branch goes backwards and is usually taken. */
  function staticBackward() {
    return {
      name: 'static: backward taken',
      about: 'a backward branch is a loop, and a loop usually loops',
      predict: function (pc, info) { return Boolean(info && info.offset < 0); },
      update: function () {},
      state: function () { return []; }
    };
  }

  /** One bit per site: predict whatever happened last time. A loop of n
   *  iterations costs two mispredicts, not one - the exit, and then the first
   *  iteration of the next entry to the loop. */
  function oneBit(options) {
    const bits = (options && options.bits) || DEFAULT_BITS;
    const table = new Array(1 << bits).fill(0);
    const touched = [];

    return {
      name: 'one-bit',
      about: 'predict what happened last time; a loop costs two mispredicts per entry',
      predict: function (pc) { return table[indexOf(pc, bits)] === 1; },
      update: function (pc, outcome) {
        const at = indexOf(pc, bits);

        note(touched, at);
        table[at] = outcome.taken ? 1 : 0;
      },
      state: function () { return report(touched, table); }
    };
  }

  /* A table of a thousand counters is mostly untouched, so showing the first
     sixteen shows sixteen initial values and says nothing. These two keep the
     slots that were actually used, in the order they were first used, which is
     what a reader wants to see. */
  function note(touched, at) {
    if (touched.indexOf(at) === -1) touched.push(at);
  }

  function report(touched, table) {
    return touched.slice(0, 16).map(function (at) {
      return { index: at, value: table[at] };
    });
  }

  /** Two bits per site, saturating. It takes two mistakes to change its mind,
   *  which removes the loop-boundary double miss and is why almost every real
   *  predictor is built on this counter. */
  function bimodal(options) {
    const bits = (options && options.bits) || DEFAULT_BITS;
    const table = new Array(1 << bits).fill(1);
    const touched = [];

    return {
      name: 'bimodal (2-bit)',
      about: 'a saturating counter per site: two mistakes to change its mind',
      predict: function (pc) { return table[indexOf(pc, bits)] >= 2; },
      update: function (pc, outcome) {
        const at = indexOf(pc, bits);

        note(touched, at);
        table[at] = saturate(table[at], outcome.taken);
      },
      state: function () { return report(touched, table); }
    };
  }

  function saturate(value, taken) {
    if (taken) return Math.min(3, value + 1);
    return Math.max(0, value - 1);
  }

  /**
   * gshare: index the counter table with the program counter exclusive-ored
   * with a global history of recent outcomes.
   *
   * The exclusive-or is the whole idea. It spreads one branch site across
   * several counters, one per history pattern, so a branch whose outcome
   * depends on what an earlier branch did gets a separate counter for each
   * case. It costs aliasing - two unrelated sites can collide - and the
   * correlated fixture in the demo is what shows the trade paying off.
   */
  function gshare(options) {
    const bits = (options && options.bits) || DEFAULT_BITS;
    const historyBits = (options && options.historyBits) || bits;
    const table = new Array(1 << bits).fill(1);
    const touched = [];
    let history = 0;

    function slot(pc) {
      return (indexOf(pc, bits) ^ (history & ((1 << historyBits) - 1))) & ((1 << bits) - 1);
    }

    return {
      name: 'gshare',
      about: 'the site exclusive-ored with a global history, so correlated branches separate',
      predict: function (pc) { return table[slot(pc)] >= 2; },
      update: function (pc, outcome) {
        const at = slot(pc);

        note(touched, at);
        table[at] = saturate(table[at], outcome.taken);
        history = ((history << 1) | (outcome.taken ? 1 : 0)) & ((1 << historyBits) - 1);
      },
      state: function () { return report(touched, table); },
      history: function () { return history; }
    };
  }

  /**
   * A tournament predictor: two predictors and a chooser that learns which one
   * to believe per site. It is strictly more area than either, and it wins
   * because real programs contain both kinds of branch.
   */
  function tournament(options) {
    const bits = (options && options.bits) || DEFAULT_BITS;
    const local = bimodal({ bits: bits });
    const global = gshare({ bits: bits });
    const chooser = new Array(1 << bits).fill(1);
    const chosen = [];
    let last = { local: false, global: false };

    return {
      name: 'tournament',
      about: 'bimodal and gshare, with a counter per site deciding which to believe',
      predict: function (pc, info) {
        last = { local: local.predict(pc, info), global: global.predict(pc, info) };
        return chooser[indexOf(pc, bits)] >= 2 ? last.global : last.local;
      },
      update: function (pc, outcome) {
        const at = indexOf(pc, bits);

        note(chosen, at);
        if (last.global !== last.local) {
          chooser[at] = saturate(chooser[at], last.global === outcome.taken);
        }
        local.update(pc, outcome);
        global.update(pc, outcome);
      },
      state: function () { return report(chosen, chooser); }
    };
  }

  /**
   * TAGE-lite: a base predictor plus tagged tables indexed with geometrically
   * longer histories, and the longest matching tag wins.
   *
   * The real thing has more tables, better allocation policy and a usefulness
   * counter; this keeps the idea that makes it work - a branch that needs
   * fifty bits of history and a branch that needs two can both be predicted
   * well, because each one is answered by the table whose history length it
   * actually needs.
   */
  function tageLite(options) {
    const bits = (options && options.bits) || DEFAULT_BITS;
    const base = bimodal({ bits: bits });
    const lengths = (options && options.lengths) || [2, 4, 8, 16];
    const tables = lengths.map(function () {
      return new Array(1 << bits).fill(null);
    });
    let history = 0;

    function slot(pc, length) {
      const mask = length >= 31 ? 0x7fffffff : ((1 << length) - 1);

      return ((indexOf(pc, bits) ^ (history & mask) ^ ((history & mask) >>> bits)) &
        ((1 << bits) - 1));
    }

    function tagOf(pc, length) {
      return ((pc >>> 2) ^ (history & ((1 << Math.min(length, 20)) - 1))) & 0xff;
    }

    function longestMatch(pc) {
      for (let at = lengths.length - 1; at >= 0; at -= 1) {
        const entry = tables[at][slot(pc, lengths[at])];

        if (entry && entry.tag === tagOf(pc, lengths[at])) return { at: at, entry: entry };
      }
      return null;
    }

    return {
      name: 'TAGE-lite',
      about: 'tagged tables at geometric history lengths; the longest match answers',
      predict: function (pc, info) {
        const match = longestMatch(pc);

        return match ? match.entry.counter >= 2 : base.predict(pc, info);
      },
      update: function (pc, outcome) {
        updateTage(pc, outcome, { tables: tables, lengths: lengths, base: base,
          slot: slot, tagOf: tagOf, longestMatch: longestMatch });
        history = ((history << 1) | (outcome.taken ? 1 : 0)) & 0x7fffffff;
      },
      state: function () {
        return tables.map(function (table) {
          return table.filter(function (entry) { return entry; }).length;
        });
      }
    };
  }

  /** Update the matching table, and allocate a longer one when it was wrong.
   *  Allocation is what lets a branch migrate to the history length it needs. */
  function updateTage(pc, outcome, parts) {
    const match = parts.longestMatch(pc);

    parts.base.update(pc, outcome);
    if (match) {
      match.entry.counter = saturate(match.entry.counter, outcome.taken);
      if ((match.entry.counter >= 2) === outcome.taken) return;
    }
    const start = match ? match.at + 1 : 0;

    for (let at = start; at < parts.lengths.length; at += 1) {
      const where = parts.slot(pc, parts.lengths[at]);

      if (parts.tables[at][where]) continue;
      parts.tables[at][where] = { tag: parts.tagOf(pc, parts.lengths[at]),
        counter: outcome.taken ? 2 : 1 };
      return;
    }
  }

  /* --------------------------------------------------------- target schemes */

  /** A branch target buffer: the address a taken branch went to last time.
   *  Without one, a predictor that says "taken" has nowhere to send the
   *  fetch. */
  function createBtb(options) {
    const bits = (options && options.bits) || DEFAULT_BITS;
    const table = new Array(1 << bits).fill(null);

    return {
      lookup: function (pc) {
        const entry = table[indexOf(pc, bits)];

        return entry && entry.pc === (pc >>> 0) ? entry.target : null;
      },
      update: function (pc, target) {
        table[indexOf(pc, bits)] = { pc: pc >>> 0, target: target >>> 0 };
      },
      size: function () {
        return table.filter(function (entry) { return entry; }).length;
      }
    };
  }

  /**
   * A return-address stack. A call pushes the address after it and a return
   * pops - so a return is predicted from where the call was, not from where
   * the return went last time, which is why returns are almost free and
   * indirect calls are not.
   */
  function createRas(options) {
    const depth = (options && options.depth) || 8;
    const stack = [];
    let overflowed = 0;

    return {
      push: function (address) {
        stack.push(address >>> 0);
        if (stack.length > depth) { stack.shift(); overflowed += 1; }
      },
      pop: function () { return stack.length ? stack.pop() : null; },
      peek: function () { return stack.length ? stack[stack.length - 1] : null; },
      depth: function () { return stack.length; },
      capacity: depth,
      overflows: function () { return overflowed; }
    };
  }

  const KINDS = {
    'static-not-taken': staticNotTaken,
    'static-backward': staticBackward,
    'one-bit': oneBit,
    bimodal: bimodal,
    gshare: gshare,
    tournament: tournament,
    tage: tageLite
  };

  function create(kind, options) {
    const build = KINDS[kind];

    if (!build) throw new Error('no such predictor: ' + kind);
    const predictor = build(options);

    predictor.kind = kind;
    return predictor;
  }

  /** Run a trace of { pc, offset, taken } through a predictor and report the
   *  accuracy, per site as well as overall - because an average hides exactly
   *  the branch that is costing you. */
  function evaluate(kind, trace, options) {
    const predictor = create(kind, options);
    const sites = {};
    let correct = 0;

    trace.forEach(function (row) {
      const guess = predictor.predict(row.pc, row);
      const site = sites[row.pc] || (sites[row.pc] = { pc: row.pc, seen: 0, right: 0 });

      site.seen += 1;
      if (guess === row.taken) { correct += 1; site.right += 1; }
      predictor.update(row.pc, row);
    });
    return { kind: kind, name: predictor.name, about: predictor.about,
      seen: trace.length, correct: correct,
      accuracy: trace.length ? correct / trace.length : 0,
      sites: Object.keys(sites).map(function (key) { return sites[key]; }),
      state: predictor.state() };
  }

  return { KINDS: Object.keys(KINDS), create: create, evaluate: evaluate,
    createBtb: createBtb, createRas: createRas, saturate: saturate };
}));
