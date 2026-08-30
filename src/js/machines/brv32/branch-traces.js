/**
 * Brv32Traces - branch traces designed to separate predictors.
 *
 * A predictor comparison is only as good as the traces it runs on. Any
 * predictor scores well on a long loop, and every predictor scores badly on
 * coin flips, so a tournament over either of those measures nothing. These
 * fixtures are built to make specific differences visible:
 *
 *   - `loop` separates one-bit from two-bit, because a one-bit counter
 *     mispredicts twice per entry to a loop and a two-bit counter once.
 *   - `alternating` is the case a per-site counter cannot do at all and a
 *     history-based predictor gets perfectly.
 *   - `correlated` is the gshare fixture: a branch whose outcome is decided by
 *     what two earlier branches did. Per-site counters see a 50/50 branch;
 *     anything with global history sees a function it can learn.
 *   - `random` is the floor. It exists so a demo cannot claim a predictor is
 *     good without showing what "as good as possible" looks like.
 *   - `filter` is the sorted-versus-unsorted result from 35.9, generated
 *     rather than asserted: the same values, the same comparison, and the only
 *     difference is the order they arrive in.
 *
 * Every trace is a list of { pc, offset, taken } - the same shape the pipeline
 * hands its predictor - so a trace fixture and a real program are
 * interchangeable as far as `Predictors.evaluate` is concerned.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Brv32 = scope.Brv32 || {};
    scope.Brv32.Traces = api;
  }
}(this, function (root) {
  'use strict';

  const Random = root && root.Random ? root.Random : require('../../utils/random.js');

  function entry(pc, taken, offset) {
    return { pc: pc >>> 0, taken: Boolean(taken),
      offset: offset === undefined ? (taken ? -8 : 8) : offset };
  }

  /** One loop branch, entered several times. The interesting number is the
   *  exit: a loop of n iterations is n-1 takens and one not-taken, and the
   *  predictors differ entirely in how they handle that last one. */
  function loop(options) {
    const settings = options || {};
    const iterations = settings.iterations || 10;
    const entries = settings.entries || 5;
    const out = [];

    for (let visit = 0; visit < entries; visit += 1) {
      for (let at = 0; at < iterations; at += 1) {
        out.push(entry(0x100, at < iterations - 1, -8));
      }
    }
    return out;
  }

  /** Taken, not taken, taken, not taken. A one-bit predictor is wrong every
   *  single time; a two-bit counter is wrong about half; a predictor with one
   *  bit of history is right after the first two. */
  function alternating(options) {
    const settings = options || {};
    const length = settings.length || 200;
    const out = [];

    for (let at = 0; at < length; at += 1) out.push(entry(0x200, at % 2 === 0, -8));
    return out;
  }

  /**
   * Three branch sites. The first two are unpredictable on their own; the
   * third is taken exactly when both of them were. A per-site counter sees the
   * third as a coin flip weighted 1 in 4 and settles on "not taken", which is
   * 75% and no better. A predictor indexed by global history sees four
   * separate cases and learns each of them, which is the whole argument for
   * gshare in one fixture.
   */
  function correlated(options) {
    const settings = options || {};
    const length = settings.length || 400;
    const random = Random.seeded(settings.seed || 20250830);
    const out = [];

    for (let at = 0; at < length; at += 1) {
      const first = random.int(2) === 1;
      const second = random.int(2) === 1;

      out.push(entry(0x300, first, 8));
      out.push(entry(0x304, second, 8));
      out.push(entry(0x308, first && second, 8));
    }
    return out;
  }

  /** The floor: nothing predicts a coin flip better than chance. */
  function random(options) {
    const settings = options || {};
    const length = settings.length || 400;
    const rng = Random.seeded(settings.seed || 20250831);
    const out = [];

    for (let at = 0; at < length; at += 1) out.push(entry(0x400, rng.int(2) === 1, 8));
    return out;
  }

  /**
   * A nested loop: an inner loop branch and an outer one. The inner branch is
   * the one that shows the one-bit predictor's double miss, because it is
   * re-entered once per outer iteration and mispredicts on both the exit and
   * the next entry.
   */
  function nested(options) {
    const settings = options || {};
    const outer = settings.outer || 20;
    const inner = settings.inner || 5;
    const out = [];

    for (let o = 0; o < outer; o += 1) {
      for (let i = 0; i < inner; i += 1) out.push(entry(0x500, i < inner - 1, -8));
      out.push(entry(0x504, o < outer - 1, -16));
    }
    return out;
  }

  /**
   * The classic: a filter over data, once sorted and once shuffled.
   *
   * The values are identical and so is the comparison, so the branch is taken
   * the same number of times either way. Only the ORDER differs, and that is
   * the whole effect: sorted data makes the branch a long run of not-taken
   * followed by a long run of taken, which any predictor gets right, and
   * shuffled data makes it a coin flip.
   */
  function filter(options) {
    const settings = options || {};
    const count = settings.count || 400;
    const threshold = settings.threshold === undefined ? 128 : settings.threshold;
    const rng = Random.seeded(settings.seed || 20250901);
    const values = [];

    for (let at = 0; at < count; at += 1) values.push(rng.int(256));
    const shuffled = values.slice();
    const sorted = values.slice().sort(function (a, b) { return a - b; });

    return { sorted: fromValues(sorted, threshold), shuffled: fromValues(shuffled, threshold),
      values: values, threshold: threshold,
      taken: values.filter(function (value) { return value >= threshold; }).length };
  }

  function fromValues(values, threshold) {
    return values.map(function (value) {
      return entry(0x600, value >= threshold, 8);
    });
  }

  /**
   * The same filter as an actual program, so the sorted-versus-shuffled result
   * can be measured on the pipeline rather than only on a trace.
   *
   * The branchy version has one data-dependent branch per element. The
   * branchless version replaces it with three instructions that compute a mask
   * and apply it - strictly more work, and no branch to get wrong. Which of
   * those wins is the whole question, and it depends entirely on whether the
   * branch was predictable.
   */
  function filterProgram(values, options) {
    const settings = options || {};
    const threshold = settings.threshold === undefined ? 128 : settings.threshold;
    const body = settings.branchless ? BRANCHLESS_BODY : BRANCHY_BODY;

    return ['  li a0, data', '  li a1, ' + values.length, '  li a2, ' + threshold,
      '  li a3, 0', 'loop:', '  beqz a1, done', '  lw a4, 0(a0)']
      .concat(body)
      .concat(['  addi a0, a0, 4', '  addi a1, a1, -1', '  j loop', 'done:', '  ecall',
        'data:'])
      .concat(values.map(function (value) { return '  .word ' + value; }))
      .join('\n');
  }

  /** One data-dependent branch per element, and it is the only difference. */
  const BRANCHY_BODY = ['  blt a4, a2, skip', '  add a3, a3, a4', 'skip:'];

  /** No branch: slt produces 0 or 1, subtracting one turns that into a mask of
   *  all zeros or all ones, and the AND applies it. Three instructions where
   *  the branchy version has one, executed every time. */
  const BRANCHLESS_BODY = ['  slt a5, a4, a2', '  addi a5, a5, -1', '  and a6, a4, a5',
    '  add a3, a3, a6'];

  /** The values both programs run over: one shuffled set and the same set
   *  sorted, so the answer is identical and only the order differs. */
  function filterData(options) {
    const settings = options || {};
    const count = settings.count || 64;
    const rng = Random.seeded(settings.seed || 20250901);
    const values = [];

    for (let at = 0; at < count; at += 1) values.push(rng.int(256));
    return { shuffled: values, sorted: values.slice().sort(function (a, b) { return a - b; }),
      threshold: settings.threshold === undefined ? 128 : settings.threshold,
      answer: values.reduce(function (sum, value) {
        return value >= (settings.threshold === undefined ? 128 : settings.threshold)
          ? sum + value : sum;
      }, 0) };
  }

  const CATALOGUE = {
    loop: { build: loop, about: 'one loop branch, entered five times' },
    alternating: { build: alternating, about: 'taken, not taken, taken, not taken' },
    correlated: { build: correlated, about: 'a branch decided by two earlier ones' },
    nested: { build: nested, about: 'an inner and an outer loop branch' },
    random: { build: random, about: 'coin flips — the floor nothing beats' }
  };

  function build(name, options) {
    const row = CATALOGUE[name];

    if (!row) throw new Error('no such trace: ' + name);
    return row.build(options);
  }

  return { CATALOGUE: CATALOGUE, build: build, loop: loop, alternating: alternating,
    correlated: correlated, nested: nested, random: random, filter: filter,
    filterProgram: filterProgram, filterData: filterData };
}));
