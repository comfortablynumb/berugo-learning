/**
 * SideChannelLab - a working cache-timing channel, run against the same cache
 * the out-of-order core uses.
 *
 * The claim this file exists to make honest is the one everybody gets wrong
 * about Spectre. The leak is not in the speculatively executed instructions:
 * those are squashed, their registers are reclaimed, and nothing they computed
 * survives. The leak is in the CACHE STATE they left behind, which no
 * squash touches, because a cache that undid its fills on a misprediction
 * would be a cache that never helped.
 *
 * So the lab has to have a real cache with a real tag array, and it does -
 * `machines/ooo/cache.js`, unchanged, with `probe` for measuring without
 * disturbing and `flush` for evicting one line. Every number here comes out of
 * that cache's own hit and miss latencies.
 *
 * The speculation is real too. The gadget's bounds check goes through a
 * bimodal predictor from M35; training it with in-bounds indices saturates the
 * counter, and the out-of-bounds call then mispredicts and performs the
 * dependent load before the branch resolves. Turn the training off and there
 * is no misprediction and no leak - which is the mechanism, not a switch.
 *
 * Two receivers, and they are not equivalent:
 *
 *   - FLUSH+RELOAD needs shared memory with the victim (a shared library, a
 *     deduplicated page) and recovers the value exactly, because it names the
 *     line it is asking about.
 *   - PRIME+PROBE needs no shared memory and recovers only the SET, which is
 *     a few address bits. With more values than sets it is ambiguous, and the
 *     lab reports the collisions rather than pretending they are not there.
 *
 * Nothing here escapes the simulator: there is no timer, no real memory and no
 * victim process. It is a model of a channel, built to show why the mitigation
 * has to be about the access and not about the rollback.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.SideChannelLab = api;
}(this, function (root) {
  'use strict';

  const Cache = root && root.Ooo && root.Ooo.Cache ? root.Ooo.Cache
    : require('./ooo/cache.js');
  const Predictors = root && root.Brv32 && root.Brv32.Predictors ? root.Brv32.Predictors
    : require('./brv32/predictors.js');
  const Random = root && root.Random ? root.Random : require('../utils/random.js');

  const ALPHABET = 'ABCDEFGHIJKLMNOP';
  const GADGET = 0x100;

  const DEFAULTS = { bound: 16, secret: 'CAFEBABE', probeBase: 0x8000, dataBase: 0x1000,
    cache: { sets: 16, ways: 4, lineBytes: 64, hitCycles: 1, missCycles: 20 },
    mitigation: 'none', train: 6, rounds: 5, noise: 0, seed: 11 };

  const MITIGATIONS = {
    none: { name: 'none', about: 'the gadget as written - the bounds check is a prediction' },
    fence: { name: 'speculation barrier',
      about: 'the load waits for the branch to resolve; correct, and it costs the speculation' },
    mask: { name: 'index masking',
      about: 'the index is forced in range with an AND, so no out-of-bounds address exists' }
  };

  /* -------------------------------------------------------------- building */

  /**
   * The victim's data: `bound` in-bounds bytes followed by the secret.
   *
   * Laying the secret immediately after the array is the whole of Spectre
   * variant 1. Nothing is corrupted and no bug is exploited - an index past
   * the end reads memory the program legitimately owns, and the bounds check
   * that was supposed to stop it is a branch, and branches are predicted.
   */
  function create(options) {
    const settings = Object.assign({}, DEFAULTS, options || {});
    const secret = String(settings.secret).toUpperCase();
    const data = [];

    for (let at = 0; at < settings.bound; at += 1) data.push(at % ALPHABET.length);
    secret.split('').forEach(function (letter) {
      data.push(Math.max(0, ALPHABET.indexOf(letter)));
    });
    return { config: settings, secret: secret, data: data,
      cache: Cache.create(settings.cache),
      predictor: Predictors.create('bimodal', settings),
      random: Random.seeded(settings.seed),
      counters: { speculated: 0, architectural: 0, blocked: 0, masked: 0 } };
  }

  function slots(lab) {
    return ALPHABET.length;
  }

  function probeAddress(lab, value) {
    return lab.config.probeBase + value * lab.config.cache.lineBytes;
  }

  function secretIndex(lab, at) {
    return lab.config.bound + at;
  }

  /* ---------------------------------------------------------- the gadget */

  /**
   * `if (index < bound) touch(probe[data[index] * stride])`, with the bounds
   * check going through a real predictor.
   *
   * The mitigations differ in exactly the way the mitigations differ in
   * practice. The fence stops the ACCESS; the mask stops the ADDRESS from ever
   * being out of range. Neither of them tries to undo anything, because
   * undoing is what the machine already does and it is not enough.
   */
  function gadget(lab, index) {
    const settings = lab.config;
    const wanted = settings.mitigation === 'mask'
      ? (index & (settings.bound - 1)) : index;
    const inBounds = wanted < settings.bound;
    const predicted = lab.predictor.predict(GADGET, { offset: 4 });
    const speculating = predicted && !inBounds && settings.mitigation !== 'fence';

    if (settings.mitigation === 'mask' && wanted !== index) lab.counters.masked += 1;
    if (predicted && !inBounds && settings.mitigation === 'fence') lab.counters.blocked += 1;
    if (inBounds || speculating) {
      Cache.access(lab.cache, settings.dataBase + wanted);
      Cache.access(lab.cache, probeAddress(lab, valueAt(lab, wanted)));
      lab.counters[inBounds ? 'architectural' : 'speculated'] += 1;
    }
    lab.predictor.update(GADGET, { taken: inBounds, offset: 4 });
    return { inBounds: inBounds, predicted: predicted, speculating: speculating,
      architectural: inBounds };
  }

  function valueAt(lab, index) {
    const found = lab.data[index];

    return found === undefined ? 0 : found;
  }

  /** Saturate the predictor so the bounds check says "in range". This is the
   *  attacker's whole preparation and it is entirely legitimate code. */
  function train(lab, times) {
    for (let at = 0; at < times; at += 1) gadget(lab, at % lab.config.bound);
  }

  /* ------------------------------------------------------- flush + reload */

  function flushProbes(lab) {
    for (let value = 0; value < slots(lab); value += 1) {
      Cache.flush(lab.cache, probeAddress(lab, value));
    }
  }

  /**
   * Other activity between the victim's access and the measurement, which is
   * what makes a real attack need repetition.
   *
   * Both directions matter. Something else evicting the victim's line hides a
   * real signal; something else touching an unrelated probe line manufactures
   * a false one. A noise model with only the first kind measures a channel
   * that fails safe, and no real channel does.
   */
  function disturb(lab) {
    const rate = lab.config.noise;

    for (let value = 0; value < slots(lab); value += 1) {
      if (lab.random.next() >= rate) continue;
      if (lab.random.next() < 0.5) { Cache.flush(lab.cache, probeAddress(lab, value)); continue; }
      Cache.access(lab.cache, probeAddress(lab, value));
    }
  }

  /** Time every probe line. The one the victim touched is a hit; the rest miss.
   *  This is the whole receiver, and it is why the mitigation has to stop the
   *  access rather than the result. */
  function reload(lab) {
    const timings = [];

    for (let value = 0; value < slots(lab); value += 1) {
      const found = Cache.probe(lab.cache, probeAddress(lab, value));

      Cache.access(lab.cache, probeAddress(lab, value));
      timings.push({ value: value, letter: ALPHABET[value], cycles: found.cycles,
        hit: found.hit, set: found.set });
    }
    return timings;
  }

  function fastest(timings) {
    const hits = timings.filter(function (row) { return row.hit; });

    if (hits.length !== 1) return null;
    return hits[0].value;
  }

  /* ---------------------------------------------------------- the attack */

  /** One byte, `rounds` times, majority vote. A single round is enough without
   *  noise and nowhere near enough with it. */
  function recoverByte(lab, at, rounds) {
    const votes = {};
    let last = null;

    for (let round = 0; round < rounds; round += 1) {
      train(lab, lab.config.train);
      flushProbes(lab);
      gadget(lab, secretIndex(lab, at));
      disturb(lab);
      last = reload(lab);
      const guess = fastest(last);

      if (guess !== null) votes[guess] = (votes[guess] || 0) + 1;
    }
    return { guess: winner(votes), votes: votes, timings: last };
  }

  function winner(votes) {
    const keys = Object.keys(votes);

    if (!keys.length) return null;
    return Number(keys.sort(function (left, right) {
      return votes[right] - votes[left] || Number(left) - Number(right);
    })[0]);
  }

  /**
   * The whole secret, one character at a time, with the accuracy reported
   * rather than assumed.
   *
   * The two mitigations fail in different ways and both are worth seeing. The
   * fence leaves the receiver with no hit at all, so every round abstains and
   * the recovered string is question marks. The mask leaves the channel
   * working perfectly and puts PUBLIC data through it - the recovered string
   * is the in-bounds array, deterministically, which is a good reminder that
   * a mitigation's job is not to break the channel but to keep the secret out
   * of it.
   */
  function recover(lab, options) {
    const settings = options || {};
    const rounds = settings.rounds || lab.config.rounds;
    const rows = lab.secret.split('').map(function (letter, at) {
      const found = recoverByte(lab, at, rounds);
      const guessed = found.guess === null ? '?' : ALPHABET[found.guess];

      return { at: at, expected: letter, guessed: guessed, correct: guessed === letter,
        votes: found.votes, timings: found.timings };
    });
    const correct = rows.filter(function (row) { return row.correct; }).length;

    return { rows: rows, correct: correct, total: rows.length,
      accuracy: rows.length ? correct / rows.length : 0,
      chance: 1 / ALPHABET.length, mitigation: lab.config.mitigation,
      counters: lab.counters, recovered: rows.map(function (row) {
        return row.guessed;
      }).join('') };
  }

  /* ------------------------------------------------------- prime + probe */

  /**
   * The receiver that needs no shared memory: fill every way of every set with
   * your own lines, let the victim run, and see which sets lost one.
   *
   * It recovers the SET, not the value. Where the alphabet is larger than the
   * set count - which it always is in reality, 256 values against 64 sets -
   * several values map to one set and the reading is ambiguous. The collision
   * count is reported because a channel that is ambiguous and does not say so
   * is a channel that will be believed.
   */
  function primeProbe(lab, at) {
    const geometry = lab.config.cache;

    train(lab, lab.config.train);
    Cache.flushAll(lab.cache);
    prime(lab, geometry);
    gadget(lab, secretIndex(lab, at));

    const evicted = [];

    for (let set = 0; set < geometry.sets; set += 1) {
      const missing = attackerLines(lab, geometry, set).filter(function (address) {
        return !Cache.probe(lab.cache, address).hit;
      });

      if (missing.length) evicted.push({ set: set, lines: missing.length });
    }
    return { evicted: evicted, candidates: candidatesFor(lab, evicted),
      expected: lab.secret[at] };
  }

  function prime(lab, geometry) {
    for (let set = 0; set < geometry.sets; set += 1) {
      attackerLines(lab, geometry, set).forEach(function (address) {
        Cache.access(lab.cache, address);
      });
    }
  }

  /** One address per way, all landing in the same set, in a region the victim
   *  never touches. */
  function attackerLines(lab, geometry, set) {
    const span = geometry.sets * geometry.lineBytes;
    const base = 0x40000 + set * geometry.lineBytes;
    const out = [];

    for (let way = 0; way < geometry.ways; way += 1) out.push(base + way * span);
    return out;
  }

  function candidatesFor(lab, evicted) {
    const sets = evicted.map(function (row) { return row.set; });
    const out = [];

    for (let value = 0; value < slots(lab); value += 1) {
      if (sets.indexOf(Cache.setOf(lab.cache, probeAddress(lab, value))) !== -1) {
        out.push(ALPHABET[value]);
      }
    }
    return out;
  }

  /* ------------------------------------------------------- reliability */

  /**
   * The recovery rate over several independent runs, which is the only honest
   * way to state it.
   *
   * A single run of an eight-character secret is eight Bernoulli trials, and
   * eight trials will happily report 12.5% for a channel that is at chance and
   * 87.5% for one that is not - in either direction. Averaging over seeds is
   * what turns "it worked when I tried it" into a number the test can assert
   * against, and it is the same discipline the noise itself demanded.
   */
  function reliability(options, sweep) {
    const settings = sweep || {};
    const seeds = settings.seeds || 8;
    const runs = [];

    for (let seed = 0; seed < seeds; seed += 1) {
      const lab = create(Object.assign({}, options, { seed: seed + 1 }));
      const found = recover(lab, { rounds: settings.rounds });

      runs.push({ seed: seed + 1, accuracy: found.accuracy, recovered: found.recovered });
    }
    const total = runs.reduce(function (sum, row) { return sum + row.accuracy; }, 0);

    return { runs: runs, mean: runs.length ? total / runs.length : 0,
      seeds: seeds, rounds: settings.rounds,
      chance: 1 / ALPHABET.length,
      mitigation: (options || {}).mitigation || DEFAULTS.mitigation };
  }

  /** How many values share a set, which is the resolution limit of
   *  Prime+Probe and the reason Flush+Reload is the stronger attack. */
  function ambiguity(lab) {
    const bySet = {};

    for (let value = 0; value < slots(lab); value += 1) {
      const set = Cache.setOf(lab.cache, probeAddress(lab, value));

      bySet[set] = (bySet[set] || 0) + 1;
    }
    const shared = Object.keys(bySet).filter(function (set) { return bySet[set] > 1; });

    return { sets: Object.keys(bySet).length, values: slots(lab),
      collisions: shared.length,
      worst: Object.keys(bySet).reduce(function (most, set) {
        return Math.max(most, bySet[set]);
      }, 0) };
  }

  return { ALPHABET: ALPHABET, DEFAULTS: DEFAULTS, MITIGATIONS: MITIGATIONS,
    create: create, gadget: gadget, train: train, flushProbes: flushProbes,
    reload: reload, recoverByte: recoverByte, recover: recover,
    primeProbe: primeProbe, ambiguity: ambiguity, reliability: reliability,
    probeAddress: probeAddress,
    secretIndex: secretIndex, valueAt: valueAt };
}));
