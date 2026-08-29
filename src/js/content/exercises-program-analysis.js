/**
 * Graded exercises for the foundations and abstract interpretation (M32.1-M32.2).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'static-analysis-foundations': [{
      id: 'check-a-claim-against-a-run',
      title: 'Check an analyser against what actually happened',
      prompt: 'A claim is { block, slot, lo, hi } where a bound may be Infinity or -Infinity. ' +
        'An observation is { block, slots: { name: value } }, one per block entry of a real ' +
        'run. Write check(claims, observations) returning { violations, observations, exact, ' +
        'unbounded }: violations lists every { block, slot, value } the run produced OUTSIDE ' +
        'the claim for that block and slot; observations is the number of numeric values ' +
        'checked, not the number of records; exact counts claims whose bounds are exactly the ' +
        'smallest and largest value observed there; unbounded counts claims with an infinite ' +
        'bound. The starter only tests the lower bound and counts records rather than values, ' +
        'so it reports an analysis that claims too little as perfectly sound.',
      entry: 'lab',
      starter: [
        'function observedFor(claim, observations) {',
        '  const seen = [];',
        '',
        '  observations.forEach(function (row) {',
        '    if (row.block !== claim.block) return;',
        '    const value = row.slots[claim.slot];',
        '',
        '    if (typeof value === "number") seen.push(value);',
        '  });',
        '  return seen;',
        '}',
        '',
        'function check(claims, observations) {',
        '  const violations = [];',
        '  let exact = 0;',
        '  let unbounded = 0;',
        '',
        '  claims.forEach(function (claim) {',
        '    const seen = observedFor(claim, observations);',
        '',
        '    // Only the lower bound is tested, so every value above hi is missed.',
        '    seen.forEach(function (value) {',
        '      if (value < claim.lo) violations.push({ block: claim.block,',
        '        slot: claim.slot, value: value });',
        '    });',
        '    if (claim.lo === -Infinity || claim.hi === Infinity) unbounded += 1;',
        '    if (seen.length && Math.min.apply(null, seen) === claim.lo &&',
        '      Math.max.apply(null, seen) === claim.hi) exact += 1;',
        '  });',
        '  // The count of records, which is not the count of values checked.',
        '  return { violations: violations, observations: observations.length,',
        '    exact: exact, unbounded: unbounded };',
        '}',
        '',
        'function lab() {',
        '  return { check: check, observedFor: observedFor };',
        '}'
      ].join('\n'),
      solution: [
        'function observedFor(claim, observations) {',
        '  const seen = [];',
        '',
        '  observations.forEach(function (row) {',
        '    if (row.block !== claim.block) return;',
        '    const value = row.slots[claim.slot];',
        '',
        '    if (typeof value === "number") seen.push(value);',
        '  });',
        '  return seen;',
        '}',
        '',
        '/* Both bounds, because an over-approximation that is too NARROW at the',
        '   top is exactly as unsound as one that is too narrow at the bottom -',
        '   and the count is of values, because a verdict is worth the number of',
        '   observations behind it and records are not observations. */',
        'function check(claims, observations) {',
        '  const violations = [];',
        '  let checked = 0;',
        '  let exact = 0;',
        '  let unbounded = 0;',
        '',
        '  claims.forEach(function (claim) {',
        '    const seen = observedFor(claim, observations);',
        '',
        '    checked += seen.length;',
        '    seen.forEach(function (value) {',
        '      if (value >= claim.lo && value <= claim.hi) return;',
        '      violations.push({ block: claim.block, slot: claim.slot, value: value });',
        '    });',
        '    if (claim.lo === -Infinity || claim.hi === Infinity) unbounded += 1;',
        '    if (seen.length && Math.min.apply(null, seen) === claim.lo &&',
        '      Math.max.apply(null, seen) === claim.hi) exact += 1;',
        '  });',
        '  return { violations: violations, observations: checked,',
        '    exact: exact, unbounded: unbounded };',
        '}',
        '',
        'function lab() {',
        '  return { check: check, observedFor: observedFor };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a value above the upper bound is a violation',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.check([{ block: 'b1', slot: 'x', lo: 0, hi: 10 }], [
              { block: 'b1', slots: { x: 0 } },
              { block: 'b1', slots: { x: 12 } }
            ]);

            api.assert.equal(out.violations.length, 1, 'the value 12 is outside [0, 10]');
            api.assert.equal(out.violations[0].value, 12, 'and it is the one reported');
          }
        },
        {
          name: 'a value below the lower bound is a violation too',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.check([{ block: 'b1', slot: 'x', lo: 0, hi: 10 }],
              [{ block: 'b1', slots: { x: -3 } }]);

            api.assert.equal(out.violations.length, 1, '-3 is outside [0, 10]');
          }
        },
        {
          name: 'the verdict counts values checked, not records',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.check([
              { block: 'b1', slot: 'x', lo: 0, hi: 10 },
              { block: 'b1', slot: 'n', lo: 10, hi: 10 }
            ], [
              { block: 'b1', slots: { x: 0, n: 10 } },
              { block: 'b1', slots: { x: 2, n: 10 } }
            ]);

            api.assert.equal(out.violations.length, 0, 'nothing here is outside its claim');
            api.assert.equal(out.observations, 4, 'four numeric values were checked');
          }
        },
        {
          name: 'exact and unbounded are counted per claim',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.check([
              { block: 'b1', slot: 'x', lo: 0, hi: 2 },
              { block: 'b1', slot: 'y', lo: 0, hi: Infinity }
            ], [
              { block: 'b1', slots: { x: 0, y: 4 } },
              { block: 'b1', slots: { x: 2, y: 9 } }
            ]);

            api.assert.equal(out.exact, 1, 'x was observed at exactly 0 and 2');
            api.assert.equal(out.unbounded, 1, 'y has an infinite upper bound');
            api.assert.equal(out.violations.length, 0, 'and neither claim is broken');
          }
        },
        {
          name: 'no observations means no violations and no evidence',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.check([{ block: 'b9', slot: 'x', lo: 0, hi: 1 }],
              [{ block: 'b1', slots: { x: 99 } }]);

            api.assert.equal(out.violations.length, 0, 'nothing was observed at b9');
            api.assert.equal(out.observations, 0, 'and the count says so');
          }
        }
      ]
    }],

    'abstract-interpretation': [{
      id: 'widen-and-narrow-an-interval',
      title: 'Make the fixpoint terminate, then take back what you safely can',
      prompt: 'An interval is { lo, hi } and a bound may be -Infinity or Infinity. Write ' +
        'widen(previous, next) which keeps a bound that did not move and throws one that did ' +
        'to infinity; narrow(previous, next) which may replace an INFINITE bound with the new ' +
        'one and must never move a finite bound; and iterate(start, step, options) which ' +
        'applies step until the interval stops changing, using widen when options.widen is ' +
        'true and a plain join otherwise, and returns { value, rounds, converged } where ' +
        'converged is false if it ran out of options.budget rounds. The starter widens by ' +
        'joining, so the chain ascends one step per round and never terminates on an ' +
        'unbounded loop, and narrows any bound, which re-opens it.',
      entry: 'lab',
      starter: [
        'function join(a, b) {',
        '  return { lo: Math.min(a.lo, b.lo), hi: Math.max(a.hi, b.hi) };',
        '}',
        '',
        'function same(a, b) {',
        '  return a.lo === b.lo && a.hi === b.hi;',
        '}',
        '',
        '// A widening that is a join does not widen: the chain still ascends.',
        'function widen(previous, next) {',
        '  return join(previous, next);',
        '}',
        '',
        '// Replacing any bound re-opens the ascending chain.',
        'function narrow(previous, next) {',
        '  return { lo: next.lo, hi: next.hi };',
        '}',
        '',
        'function iterate(start, step, options) {',
        '  const budget = (options && options.budget) || 200;',
        '  const useWiden = Boolean(options && options.widen);',
        '  let value = start;',
        '  let rounds = 0;',
        '',
        '  while (rounds < budget) {',
        '    const next = step(value);',
        '    const merged = useWiden ? widen(value, next) : join(value, next);',
        '',
        '    rounds += 1;',
        '    if (same(value, merged)) return { value: value, rounds: rounds, converged: true };',
        '    value = merged;',
        '  }',
        '  return { value: value, rounds: rounds, converged: true };',
        '}',
        '',
        'function lab() {',
        '  return { join: join, widen: widen, narrow: narrow, iterate: iterate };',
        '}'
      ].join('\n'),
      solution: [
        'function join(a, b) {',
        '  return { lo: Math.min(a.lo, b.lo), hi: Math.max(a.hi, b.hi) };',
        '}',
        '',
        'function same(a, b) {',
        '  return a.lo === b.lo && a.hi === b.hi;',
        '}',
        '',
        '/* A bound that moved at all is thrown away. That is the surrender, and',
        '   it is what makes the number of rounds a property of the analyser',
        '   rather than of the programme being analysed. */',
        'function widen(previous, next) {',
        '  return { lo: next.lo < previous.lo ? -Infinity : previous.lo,',
        '    hi: next.hi > previous.hi ? Infinity : previous.hi };',
        '}',
        '',
        '/* Only an infinite bound may be replaced, and only by a finite one.',
        '   Allowing any bound to move would re-open the ascending chain and the',
        '   descending pass would not terminate either. */',
        'function narrow(previous, next) {',
        '  return { lo: previous.lo === -Infinity ? next.lo : previous.lo,',
        '    hi: previous.hi === Infinity ? next.hi : previous.hi };',
        '}',
        '',
        'function iterate(start, step, options) {',
        '  const budget = (options && options.budget) || 200;',
        '  const useWiden = Boolean(options && options.widen);',
        '  let value = start;',
        '  let rounds = 0;',
        '',
        '  while (rounds < budget) {',
        '    const next = step(value);',
        '    const merged = useWiden ? widen(value, next) : join(value, next);',
        '',
        '    rounds += 1;',
        '    if (same(value, merged)) return { value: value, rounds: rounds, converged: true };',
        '    value = merged;',
        '  }',
        '  /* Out of rounds while still changing is NOT a fixpoint, and reporting',
        '     it as one is how an unsound claim reaches a caller. */',
        '  return { value: value, rounds: rounds, converged: false };',
        '}',
        '',
        'function lab() {',
        '  return { join: join, widen: widen, narrow: narrow, iterate: iterate };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'widening throws away a bound that moved and keeps one that did not',
          assert: function (lab, api) {
            const parts = lab();
            const out = parts.widen({ lo: 0, hi: 0 }, { lo: 0, hi: 2 });

            api.assert.equal(out.lo, 0, 'the lower bound did not move, so it stays');
            api.assert.equal(out.hi, Infinity, 'the upper bound moved, so it goes to infinity');
          }
        },
        {
          name: 'the ascending chain terminates in a constant number of rounds',
          assert: function (lab, api) {
            const parts = lab();
            const step = function (value) {
              return { lo: Math.min(0, value.lo), hi: value.hi + 2 };
            };
            const out = parts.iterate({ lo: 0, hi: 0 }, step, { widen: true, budget: 50 });

            api.assert.equal(out.converged, true, 'it reached a fixpoint');
            api.assert.ok(out.rounds <= 4, 'in at most four rounds, found ' + out.rounds);
            api.assert.equal(out.value.hi, Infinity, 'having given the bound away');
          }
        },
        {
          name: 'without widening the same chain runs out of budget and says so',
          assert: function (lab, api) {
            const parts = lab();
            const step = function (value) {
              return { lo: Math.min(0, value.lo), hi: value.hi + 2 };
            };
            const out = parts.iterate({ lo: 0, hi: 0 }, step, { widen: false, budget: 20 });

            api.assert.equal(out.converged, false, 'it never stopped changing');
            api.assert.equal(out.rounds, 20, 'it used the whole budget');
            api.assert.equal(out.value.hi, 40, 'and stopped somewhere below the fixpoint');
          }
        },
        {
          name: 'narrowing replaces an infinite bound and leaves a finite one alone',
          assert: function (lab, api) {
            const parts = lab();
            const recovered = parts.narrow({ lo: 0, hi: Infinity }, { lo: 5, hi: 11 });
            const kept = parts.narrow({ lo: 0, hi: 11 }, { lo: 5, hi: 20 });

            api.assert.deepEqual(recovered, { lo: 0, hi: 11 }, 'the infinite bound came back');
            api.assert.deepEqual(kept, { lo: 0, hi: 11 }, 'a finite bound must not move');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
