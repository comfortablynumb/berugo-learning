/**
 * Identifier schemes, and the three properties that actually separate them:
 * whether the ids sort in creation order, how much of the key space a batch of
 * them touches, and what a holder of one can infer.
 *
 * The clock and the randomness are injected rather than reached for. That is
 * partly the usual testability argument and partly a correctness one: a
 * Snowflake generator's whole difficulty is what it does when the clock moves
 * backwards, and a generator that calls `Date.now()` directly cannot be made
 * to demonstrate it. Passing a clock in makes "the operator stepped the clock
 * back forty milliseconds" a two-line fixture.
 *
 * The locality claim - "random UUIDs destroy B-tree insert locality" - is
 * simulated rather than asserted. Each id is mapped to the index page its
 * sort key would land on, and the measurement is the number of *distinct
 * pages touched in a sliding window of inserts*: that is the working set the
 * buffer pool has to hold, and it is the quantity that decides whether the
 * index fits in memory. A time-ordered scheme touches one page; a random one
 * touches as many as the window is wide, until the window exceeds the page
 * count and it touches all of them.
 *
 * Every scheme here produces a string, and the string's byte order is the
 * comparison order a database index would use - which is exactly why UUIDv4's
 * hex text and UUIDv7's hex text behave so differently despite being the same
 * 128 bits in the same encoding.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.IdGenerators = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const HEX = '0123456789abcdef';

  function hexOf(value, digits) {
    let out = '';
    let v = BigInt(value);
    for (let i = 0; i < digits; i += 1) {
      out = HEX.charAt(Number(v & 15n)) + out;
      v >>= 4n;
    }
    return out;
  }

  /** A stream of random bits from an injected source, in whatever width the
   *  caller needs. `bits` is at most 53 per call by construction. */
  function randomBits(random, bits) {
    let out = 0n;
    let remaining = bits;
    while (remaining > 0) {
      const take = Math.min(24, remaining);
      out = (out << BigInt(take)) | BigInt(Math.floor(random() * Math.pow(2, take)));
      remaining -= take;
    }
    return out;
  }

  /* ------------------------------------------------------------ sequential */

  function sequential(options) {
    let next = (options && options.start) || 1;
    return {
      id: 'sequential',
      label: 'sequential integer',
      bits: 64,
      generate: function () {
        const value = next;
        next += 1;
        return { text: String(value).padStart(20, '0'), value: BigInt(value), time: null };
      }
    };
  }

  /* ------------------------------------------------------------- UUID v4 */

  /** The canonical 8-4-4-4-12 hexadecimal form. */
  function formatUuid(value) {
    const text = hexOf(value, 32);
    return text.slice(0, 8) + '-' + text.slice(8, 12) + '-' + text.slice(12, 16) + '-' +
      text.slice(16, 20) + '-' + text.slice(20);
  }

  /** Six bits of the 128 are not free: four say which version this is and two
   *  say it is an RFC variant. Every version pays them, which is why v4 has
   *  122 random bits rather than 128. */
  function withVersion(value, version) {
    let v = value & ~(0xfn << 76n);
    v |= BigInt(version) << 76n;
    v &= ~(0x3n << 62n);
    return v | (0x2n << 62n);
  }

  /**
   * 122 random bits with six fixed for the version and variant. Nothing is
   * derived from anything, which is the point and the cost: no collisions
   * worth worrying about, no coordination, no ordering, no locality.
   */
  function uuid4(options) {
    const random = options.random;
    return {
      id: 'uuid4',
      label: 'UUID v4 (random)',
      bits: 128,
      randomBits: 122,
      generate: function () {
        const value = withVersion(randomBits(random, 128), 4);
        return { text: formatUuid(value), value: value, time: null };
      }
    };
  }

  /* ------------------------------------------------------------- UUID v7 */

  /**
   * A 48-bit millisecond timestamp in the high bits, then the version and
   * variant, then 74 random bits. Same 128 bits and the same textual encoding
   * as v4 - and because the timestamp is at the front, the hexadecimal text
   * sorts in creation order, which is the whole reason the version exists.
   */
  function uuid7(options) {
    const random = options.random;
    const clock = options.clock;
    return {
      id: 'uuid7',
      label: 'UUID v7 (time-ordered)',
      bits: 128,
      randomBits: 74,
      generate: function () {
        const millis = BigInt(clock());
        const value = withVersion((millis << 80n) | randomBits(random, 80), 7);
        return { text: formatUuid(value), value: value, time: Number(millis) };
      }
    };
  }

  /* ---------------------------------------------------------------- ULID */

  /**
   * The same idea as UUIDv7 - 48 bits of milliseconds then 80 random bits -
   * encoded in Crockford base32 rather than hex, so it is 26 characters
   * instead of 36 and case-insensitive with no ambiguous glyphs. The encoding
   * is the entire difference, and it is a real one for anything a human reads
   * back over a phone.
   */
  function ulid(options) {
    const random = options.random;
    const clock = options.clock;
    return {
      id: 'ulid',
      label: 'ULID',
      bits: 128,
      randomBits: 80,
      generate: function () {
        const millis = BigInt(clock());
        const entropy = randomBits(random, 80);
        const value = (millis << 80n) | entropy;
        return { text: base32(value, 26), value: value, time: Number(millis) };
      }
    };
  }

  function base32(value, length) {
    let out = '';
    let v = value;
    for (let i = 0; i < length; i += 1) {
      out = CROCKFORD.charAt(Number(v & 31n)) + out;
      v >>= 5n;
    }
    return out;
  }

  /* ----------------------------------------------------------- Snowflake */

  /**
   * 41 bits of milliseconds since a custom epoch, 10 bits of machine id and 12
   * bits of per-millisecond sequence, in one 64-bit integer. It is the scheme
   * that fits in a `bigint` column, and it is the one with real operational
   * failure modes: 4 096 ids per millisecond per machine and then it must
   * wait, and a backwards clock step means either handing out a duplicate or
   * refusing to serve.
   */
  function snowflake(options) {
    const settings = options || {};
    const clock = settings.clock;
    const epoch = settings.epoch || 0;
    const machine = settings.machine || 0;
    const policy = settings.onRegression || 'wait';
    const state = { lastMillis: -1, lastClock: -1, sequence: 0, waits: 0, refusals: 0,
      regressions: 0, borrowed: 0 };

    return {
      id: 'snowflake',
      label: 'Snowflake (41 + 10 + 12)',
      bits: 64,
      randomBits: 0,
      stats: function () { return { waits: state.waits, refusals: state.refusals,
        regressions: state.regressions, borrowed: state.borrowed }; },
      generate: function () { return snowflakeStep(state, { clock: clock, epoch: epoch,
        machine: machine, policy: policy }); }
    };
  }

  /**
   * One id, including the two ways the clock can make that impossible.
   *
   * The two are counted separately on purpose. A *regression* is the clock
   * itself moving backwards - an operator, an NTP step, a virtual machine
   * resuming - and it is the case the policy is about. Being *ahead of the
   * clock* is self-inflicted: the sequence field ran out inside one
   * millisecond and the generator borrowed from the next one, so every call
   * until real time catches up sees a clock reading below its own last stamp.
   * Counting the second as the first makes a burst look like a fleet-wide
   * clock fault, which is how the wrong thing gets escalated at three in the
   * morning.
   */
  function snowflakeStep(state, config) {
    let millis = config.clock();
    const wentBackwards = millis < state.lastClock;
    state.lastClock = millis;

    if (millis < state.lastMillis) {
      /* `regressions` counts the backwards STEP, once, while the refusal test
         is about the whole interval the generator spends ahead of the clock:
         a scheme that refuses has to keep refusing until real time catches up
         past its last stamp, not just on the one call where the step landed. */
      if (wentBackwards) state.regressions += 1;
      if (config.policy === 'refuse') { state.refusals += 1; return null; }
      /* Waiting is the only policy that keeps the two guarantees the scheme is
         bought for. Serving from the old clock reading is what produces a
         duplicate, and the duplicate arrives days later as a primary-key
         violation nobody can reproduce. */
      millis = state.lastMillis;
      state.waits += 1;
    }
    if (millis === state.lastMillis) {
      state.sequence += 1;
      if (state.sequence > 4095) { state.sequence = 0; millis += 1; state.borrowed += 1; }
    } else {
      state.sequence = 0;
    }
    state.lastMillis = millis;
    const value = (BigInt(millis - config.epoch) << 22n) |
      (BigInt(config.machine) << 12n) | BigInt(state.sequence);
    return { text: value.toString().padStart(20, '0'), value: value, time: millis,
      sequence: state.sequence };
  }

  const SCHEMES = [
    { id: 'sequential', build: sequential },
    { id: 'uuid4', build: uuid4 },
    { id: 'uuid7', build: uuid7 },
    { id: 'ulid', build: ulid },
    { id: 'snowflake', build: snowflake }
  ];

  function build(id, options) {
    for (let i = 0; i < SCHEMES.length; i += 1) {
      if (SCHEMES[i].id === id) return SCHEMES[i].build(options);
    }
    return uuid4(options);
  }

  /* ------------------------------------------------------------ measuring */

  /**
   * Does the textual order match the creation order? Two answers, because the
   * time-ordered schemes give two different ones and conflating them is how
   * "UUIDv7 is sortable" turns into a wrong assumption in a paging query.
   *
   * `acrossTime` counts pairs generated in *different* milliseconds whose text
   * order disagrees with their creation order - a real violation, and zero for
   * every time-ordered scheme here. `withinTime` counts pairs from the same
   * millisecond that came out unordered, which UUIDv7 and ULID do by design
   * (the low bits are random) and Snowflake does not (the low bits are a
   * sequence counter). A cursor that pages by id is correct under Snowflake
   * and drops rows under ULID.
   */
  function sortability(ids) {
    let acrossTime = 0;
    let withinTime = 0;
    let samePairs = 0;

    for (let i = 1; i < ids.length; i += 1) {
      const sameMillisecond = ids[i].time !== null && ids[i].time === ids[i - 1].time;
      if (sameMillisecond) samePairs += 1;
      if (ids[i].text >= ids[i - 1].text) continue;
      if (sameMillisecond) withinTime += 1; else acrossTime += 1;
    }
    return { acrossTime: acrossTime, withinTime: withinTime, samePairs: samePairs,
      inversions: acrossTime + withinTime, monotonic: acrossTime + withinTime === 0,
      timeOrdered: acrossTime === 0, count: ids.length };
  }

  function uniqueness(ids) {
    const seen = new Set();
    let duplicates = 0;
    for (let i = 0; i < ids.length; i += 1) {
      if (seen.has(ids[i].text)) duplicates += 1;
      seen.add(ids[i].text);
    }
    return { duplicates: duplicates, distinct: seen.size, count: ids.length };
  }

  /**
   * The birthday bound: with r random bits, the chance that n ids collide is
   * about n^2 / 2^(r+1). Reported as the count of ids needed for a one-in-a-
   * million chance, which is a number an engineer can act on.
   */
  function collisionOutlook(randomBitCount, count) {
    if (randomBitCount === 0) return { probability: 0, safeCount: Infinity, bits: 0 };
    const space = Math.pow(2, randomBitCount);
    return {
      bits: randomBitCount,
      probability: (count * count) / (2 * space),
      safeCount: Math.sqrt(2 * space / 1e6)
    };
  }

  /**
   * Which index page each id lands on, by its rank among all the ids in the
   * batch. A B-tree splits pages where the data is, so an equal-frequency
   * partition of the actual keys is what a well-filled index looks like - and,
   * crucially, it is alphabet-independent, so hex, base32 and decimal schemes
   * are compared on their ordering rather than on their character set. An
   * earlier version derived the page from the leading characters as a fraction
   * of the byte range, which confined hex ids to a fifth of the pages and made
   * UUIDv4 look five times more local than it is.
   */
  function pageAssignment(ids, pages) {
    const order = ids.map(function (id, index) { return { text: id.text, index: index }; });
    order.sort(function (a, b) { return a.text < b.text ? -1 : (a.text > b.text ? 1 : 0); });
    const assignment = new Array(ids.length);
    for (let rank = 0; rank < order.length; rank += 1) {
      assignment[order[rank].index] = Math.min(pages - 1,
        Math.floor((rank * pages) / order.length));
    }
    return assignment;
  }

  /**
   * The index-locality simulation: how many distinct pages the last `window`
   * inserts touched. That is the working set a buffer pool has to hold to
   * avoid a disk read per insert, and it is the number that decides whether an
   * index of a billion rows stays in memory or does not.
   */
  function localitySimulation(ids, options) {
    const pages = options.pages;
    const window = options.window;
    const assignment = pageAssignment(ids, pages);
    const recent = [];
    const counts = new Map();
    let peak = 0;
    let totalWorking = 0;
    let switches = 0;

    for (let i = 0; i < assignment.length; i += 1) {
      const page = assignment[i];
      if (i > 0 && page !== assignment[i - 1]) switches += 1;
      recent.push(page);
      counts.set(page, (counts.get(page) || 0) + 1);
      if (recent.length > window) removeOldest(recent, counts);
      peak = Math.max(peak, counts.size);
      totalWorking += counts.size;
    }
    return { pages: pages, window: window, peakWorkingSet: peak,
      meanWorkingSet: totalWorking / Math.max(1, ids.length),
      pageSwitches: switches,
      switchRate: switches / Math.max(1, ids.length - 1) };
  }

  function removeOldest(recent, counts) {
    const gone = recent.shift();
    const left = counts.get(gone) - 1;
    if (left === 0) counts.delete(gone); else counts.set(gone, left);
  }

  /** What a holder of one id learns. Stated as fields rather than prose so the
   *  section can put it in a table beside the other properties. */
  const LEAKAGE = {
    sequential: { creationTime: false, ordering: true, volume: true, machine: false,
      note: 'the value IS the count, so id 4 812 tells an outsider how many rows exist' },
    uuid4: { creationTime: false, ordering: false, volume: false, machine: false,
      note: 'nothing, provided the randomness is cryptographic' },
    uuid7: { creationTime: true, ordering: true, volume: false, machine: false,
      note: 'the leading 48 bits are the creation time to the millisecond' },
    ulid: { creationTime: true, ordering: true, volume: false, machine: false,
      note: 'the same 48-bit timestamp, in base32' },
    snowflake: { creationTime: true, ordering: true, volume: true, machine: true,
      note: 'time, machine id and per-millisecond sequence are all readable by shifting' }
  };

  return {
    CROCKFORD: CROCKFORD,
    SCHEMES: SCHEMES,
    LEAKAGE: LEAKAGE,
    randomBits: randomBits,
    formatUuid: formatUuid,
    withVersion: withVersion,
    base32: base32,
    hexOf: hexOf,
    sequential: sequential,
    uuid4: uuid4,
    uuid7: uuid7,
    ulid: ulid,
    snowflake: snowflake,
    snowflakeStep: snowflakeStep,
    build: build,
    sortability: sortability,
    uniqueness: uniqueness,
    collisionOutlook: collisionOutlook,
    localitySimulation: localitySimulation,
    pageAssignment: pageAssignment
  };
}));
