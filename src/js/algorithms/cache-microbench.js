/**
 * CacheMicrobench - the access patterns that isolate one level of the
 * hierarchy, and the method that recovers a cache's parameters from timing
 * alone.
 *
 * Two patterns do most of the work and they measure different things.
 *
 * A POINTER CHASE measures latency: every address is the value the previous
 * load returned, so exactly one access is outstanding and the time per access
 * is the full round trip. Nothing overlaps, no prefetcher can predict it, and
 * that is the point - it is the only way to see a level's latency rather than
 * its bandwidth.
 *
 * A STREAM measures bandwidth: the addresses are known in advance, so the
 * machine runs as many accesses in parallel as it has resources for. Reporting
 * a stream time as a latency, or a chase time as a bandwidth, is the most
 * common way to get a memory measurement wrong by an order of magnitude.
 *
 * Parameter discovery walks the working-set size and looks for the steps in
 * the latency curve. It works, it is about fifty lines, and it is worth
 * knowing twice over: it is how you find out what an unfamiliar machine has,
 * and it is the same primitive as the timing side channels in M36.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.CacheMicrobench = api;
}(this, function (root) {
  'use strict';

  const Random = root && root.Random ? root.Random : require('../utils/random.js');
  const Hierarchy = root && root.Memory && root.Memory.Hierarchy ? root.Memory.Hierarchy
    : require('../machines/memory/hierarchy.js');
  const Prefetchers = root && root.Prefetchers ? root.Prefetchers
    : require('./prefetchers.js');

  /**
   * What the machine underneath the measurement can do, which is what makes
   * the two mistakes mistakes.
   *
   * `outstanding` is how many INDEPENDENT accesses can be in flight at once -
   * the miss registers of 36.6. A dependent chain cannot use them, because
   * each address is the value the last load returned; a walk over known
   * addresses uses all of them, and that is the entire difference between a
   * latency measurement and a bandwidth one.
   *
   * `issueCycles` is the floor: however much overlaps, the machine still has
   * to start each access, one per cycle. It is what makes an overlapped walk
   * report a per-access time BELOW the L1 hit latency - a number that is
   * impossible for a latency and is the clearest tell that the wrong quantity
   * has been measured.
   */
  const MACHINE = { outstanding: 10, issueCycles: 1 };

  /* ------------------------------------------------------------ patterns */

  function repeat(count, make) {
    const out = [];

    for (let at = 0; at < count; at += 1) out.push(make(at));
    return out;
  }

  /**
   * A cycle through every line of a region in a shuffled order, so the next
   * address is unpredictable and each access waits for the one before.
   *
   * The shuffle is what defeats the prefetcher. A chase laid out in order is
   * a sequential walk wearing a disguise, and it measures bandwidth while
   * claiming to measure latency.
   */
  function pointerChase(options) {
    const settings = options || {};
    const lineBytes = settings.lineBytes || 64;
    const lines = Math.max(1, Math.floor((settings.bytes || 4096) / lineBytes));
    const random = Random.seeded(settings.seed === undefined ? 11 : settings.seed);
    const order = random.shuffle(repeat(lines, function (at) { return at; }));
    const trace = [];
    const passes = settings.passes || 4;

    for (let pass = 0; pass < passes; pass += 1) {
      order.forEach(function (line) {
        trace.push({ address: (settings.base || 0) + line * lineBytes });
      });
    }
    return { trace: trace, lines: lines, bytes: lines * lineBytes, kind: 'chase',
      passes: passes };
  }

  /**
   * The same dependent chain laid out in ADDRESS order, which is the mistake
   * rather than the method.
   *
   * The trace is byte for byte the sequential walk below; only the dependence
   * differs, and a list of addresses cannot express dependence. That is why it
   * is a separate generator rather than a flag on the walk: the accesses still
   * wait for one another, so nothing overlaps, and what breaks the measurement
   * is not bandwidth but the prefetcher, which follows an ordered chase
   * perfectly happily.
   */
  function orderedChase(options) {
    const found = stream(options);

    return { trace: found.trace, lines: found.lines, bytes: found.bytes,
      kind: 'chase', passes: found.passes };
  }

  /** Every line of a region in order, which is what a prefetcher was built
   *  for and what a bandwidth measurement needs. */
  function stream(options) {
    const settings = options || {};
    const lineBytes = settings.lineBytes || 64;
    const lines = Math.max(1, Math.floor((settings.bytes || 4096) / lineBytes));
    const trace = [];
    const passes = settings.passes || 4;

    for (let pass = 0; pass < passes; pass += 1) {
      for (let line = 0; line < lines; line += 1) {
        trace.push({ address: (settings.base || 0) + line * lineBytes,
          write: Boolean(settings.write) });
      }
    }
    return { trace: trace, lines: lines, bytes: lines * lineBytes, kind: 'stream',
      passes: passes };
  }

  /** The three ways to walk a working set, of which two are the classic
   *  mistakes. Every one of them touches exactly the same bytes. */
  const PATTERNS = {
    chase: { label: 'pointer chase — shuffled and dependent: measures latency',
      make: pointerChase,
      about: 'the method: one access outstanding, and nothing to predict' },
    ordered: { label: 'ordered chase — dependent, but perfectly predictable',
      make: orderedChase,
      about: 'still one access at a time, but the prefetcher answers instead' },
    stream: { label: 'sequential — independent and predictable: measures bandwidth',
      make: stream,
      about: 'the addresses are known in advance, so the machine overlaps them' }
  };

  function patternFor(name, options) {
    const chosen = PATTERNS[name] || PATTERNS.chase;

    return chosen.make(options);
  }

  /** A strided walk, which is the pattern a stride prefetcher exists for and
   *  the one that falls off a cliff when the stride hits the set count. */
  function strided(options) {
    const settings = options || {};
    const step = settings.step || 256;
    const count = settings.count || 64;
    const trace = [];

    for (let pass = 0; pass < (settings.passes || 4); pass += 1) {
      for (let at = 0; at < count; at += 1) {
        trace.push({ address: (settings.base || 0) + at * step });
      }
    }
    return { trace: trace, lines: count, bytes: count * step, kind: 'strided' };
  }

  function randomAccess(options) {
    const settings = options || {};
    const lineBytes = settings.lineBytes || 64;
    const lines = Math.max(1, Math.floor((settings.bytes || 4096) / lineBytes));
    const random = Random.seeded(settings.seed === undefined ? 3 : settings.seed);
    const count = settings.count || lines * 4;

    return { trace: repeat(count, function () {
      return { address: (settings.base || 0) + random.int(lines) * lineBytes };
    }), lines: lines, bytes: lines * lineBytes, kind: 'random' };
  }

  /* ------------------------------------------------------- the harness */

  /**
   * Issue whatever this access suggests fetching, and say how many lines that
   * cost.
   *
   * The prefetcher is a real one rather than a switch: it is the stride design
   * from `prefetchers.js`, learning deltas from the addresses it is actually
   * given. That is what makes the pattern control honest - nothing tells it
   * which walk it is looking at, it issues nothing on a shuffled chase because
   * no delta ever repeats, and it covers an ordered one because one does.
   *
   * A prefetched line is not charged to the access that triggered it. It
   * happens off the critical path, which is the whole point of prefetching;
   * what it costs is bandwidth and a cache frame, and 37.7 is where that bill
   * is measured.
   */
  function issuePrefetches(state, entry) {
    if (!state.prefetcher) return;
    const bytes = state.prefetcher.settings.lineBytes;

    Prefetchers.suggest(state.prefetcher, entry).forEach(function (address) {
      const line = Math.floor(address / bytes);

      if (address < 0 || state.pending.has(line)) return;
      state.pending.add(line);
      Hierarchy.access(state.hierarchy, { address: address });
      state.prefetched += 1;
    });
  }

  /**
   * When this access finishes, given how many can be in flight.
   *
   * A dependent chain has one slot, so each access starts when the last one
   * finished and the average is the mean latency. Independent accesses have
   * `outstanding` slots: access i waits only for access i minus that, which is
   * the sliding window a machine's miss registers actually implement. The
   * issue floor applies to both.
   */
  function completionOf(state, latency) {
    const at = state.counted;
    const slot = at % state.ring.length;
    const finish = Math.max(state.ring[slot] + latency,
      (at + 1) * MACHINE.issueCycles);

    state.ring[slot] = finish;
    state.counted += 1;
    return finish;
  }

  /**
   * Walk a working set and time it the way a machine would run it.
   *
   * The warm-up pass is executed and not timed, which is what "discard the
   * first pass" means: its misses are compulsory at every working-set size, so
   * timing them lifts every point on the curve. The clock starts afterwards,
   * with nothing outstanding, exactly as a benchmark that warms up and then
   * starts its timer.
   */
  function timedWalk(options) {
    const settings = options || {};
    const pattern = settings.pattern || pointerChase(settings);
    const slots = pattern.kind === 'stream'
      ? (settings.outstanding || MACHINE.outstanding) : 1;
    const state = { hierarchy: Hierarchy.create(settings.hierarchy || {}),
      prefetcher: settings.prefetch === false ? null
        : Prefetchers.create('stride', Object.assign({ degree: 4, confidence: 2,
          lineBytes: settings.lineBytes || 64 }, settings.prefetcher)),
      pending: new Set(), ring: new Array(slots).fill(0), counted: 0, prefetched: 0 };
    const skip = settings.warm === false ? 0
      : pattern.trace.length / (pattern.passes || 1);
    let elapsed = 0;

    pattern.trace.forEach(function (entry, at) {
      state.pending.delete(Math.floor(entry.address / (settings.lineBytes || 64)));
      issuePrefetches(state, entry);
      const latency = Hierarchy.access(state.hierarchy, entry).cycles;

      if (at < skip) return;
      elapsed = Math.max(elapsed, completionOf(state, latency));
    });
    return { cycles: state.counted ? elapsed / state.counted : 0, elapsed: elapsed,
      accesses: state.counted, prefetched: state.prefetched, lines: pattern.lines,
      outstanding: slots, kind: pattern.kind };
  }

  /* --------------------------------------------------------- the ladder */

  /**
   * Cycles per access over each working-set size, which is the curve the whole
   * discovery method reads.
   *
   * The pattern is a parameter rather than a constant because two thirds of
   * the difficulty is in getting it wrong: the shuffled chase measures the
   * hierarchy, and the other two measure the prefetcher and the bandwidth
   * while looking exactly as plausible.
   */
  function ladder(options) {
    const settings = options || {};
    const sizes = settings.sizes || defaultSizes();

    return sizes.map(function (bytes) {
      const pattern = patternFor(settings.pattern, { bytes: bytes,
        lineBytes: settings.lineBytes || 64, passes: settings.passes || 4,
        seed: settings.seed === undefined ? 2 : settings.seed });
      const found = timedWalk(Object.assign({}, settings, { pattern: pattern }));

      return { bytes: bytes, cycles: found.cycles, lines: found.lines,
        prefetched: found.prefetched, outstanding: found.outstanding };
    });
  }

  function defaultSizes() {
    const out = [];

    for (let bytes = 1024; bytes <= 16 * 1024 * 1024; bytes *= 2) out.push(bytes);
    return out;
  }

  /**
   * Where the latency curve steps up, which is where a level ran out.
   *
   * A step is reported when the average latency rises by more than the given
   * factor between two adjacent sizes. The size BELOW the step is the reported
   * capacity, because that is the largest working set that still fitted - and
   * getting that off by one is how a discovery routine reports every cache as
   * twice its real size.
   */
  function steps(curve, factor) {
    const threshold = factor || 1.35;
    const out = [];

    for (let at = 1; at < curve.length; at += 1) {
      const before = curve[at - 1];
      const after = curve[at];

      if (before.cycles <= 0) continue;
      if (after.cycles / before.cycles < threshold) continue;
      out.push({ capacity: before.bytes, from: before.cycles, to: after.cycles,
        ratio: after.cycles / before.cycles });
    }
    return out;
  }

  /**
   * Associativity, by building a conflict set.
   *
   * Every address `base + k * sets * lineBytes` maps to the same set whatever
   * `k` is, so touching k+1 of them in a loop starts missing exactly when k+1
   * exceeds the number of ways. The largest k that still hits is the
   * associativity, and the method needs no documentation for the machine at
   * all - only the ability to time an access.
   */
  function discoverAssociativity(options) {
    const settings = options || {};
    const stride = settings.stride || 64 * 64;
    const limit = settings.limit || 32;
    let last = 0;

    for (let ways = 1; ways <= limit; ways += 1) {
      const hierarchy = Hierarchy.create(settings.hierarchy || {});
      const trace = [];

      for (let pass = 0; pass < 4; pass += 1) {
        for (let at = 0; at < ways; at += 1) trace.push({ address: at * stride });
      }
      const warm = ways;
      let misses = 0;

      trace.forEach(function (entry, at) {
        const found = Hierarchy.access(hierarchy, entry);

        if (at >= warm && found.level > 0) misses += 1;
      });
      if (misses === 0) last = ways;
      else return { associativity: last, failedAt: ways };
    }
    return { associativity: last, failedAt: null };
  }

  return { MACHINE: MACHINE, PATTERNS: PATTERNS, pointerChase: pointerChase,
    orderedChase: orderedChase, stream: stream, strided: strided,
    randomAccess: randomAccess, patternFor: patternFor, timedWalk: timedWalk,
    ladder: ladder, steps: steps, defaultSizes: defaultSizes,
    discoverAssociativity: discoverAssociativity };
}));
