/**
 * Graded exercises for SMT, side channels and the modern core (M36.7-M36.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'simultaneous-multithreading': [{
      id: 'fetch-arbitration',
      title: 'Round-robin fetch arbitration, with a guard that stops a thread starving',
      prompt: 'Write lab() returning { choose, run }. choose(threads, state, config) picks the '
        + 'thread that gets the front end this cycle. threads is an array of '
        + '{ name, done, sinceGrant, inFlight }; state is { grants }; config is '
        + '{ policy, guard }. Skip every thread whose done is true, and return null if none '
        + 'are live. If config.guard is above zero and any live thread has sinceGrant at or '
        + 'above it, return the one that has waited longest (earliest in the array wins a '
        + 'tie) - the guard overrides the policy. Otherwise: "roundRobin" returns the live '
        + 'thread at index state.grants modulo the live count, "icount" returns the live '
        + 'thread with the smallest inFlight (earliest wins a tie), and "priority" returns the '
        + 'first live thread. run(threads, config, cycles) steps that many cycles: each cycle '
        + 'call choose, then for the winner set sinceGrant to 0 and add 1 to its `retired`, '
        + 'and for every other live thread add 1 to sinceGrant and update its longestStarve to '
        + 'the largest sinceGrant it has reached; increment state.grants on every grant. '
        + 'Return the threads array. The starter has no guard.',
      entry: 'lab',
      starter: [
        'function choose(threads, state, config) {',
        '  var live = threads.filter(function (thread) { return !thread.done; });',
        '',
        '  if (!live.length) return null;',
        '  // No guard: strict priority starves thread 1 forever.',
        '  if (config.policy === "priority") return live[0];',
        '  if (config.policy === "roundRobin") return live[state.grants % live.length];',
        '  return live.slice().sort(function (a, b) { return a.inFlight - b.inFlight; })[0];',
        '}',
        '',
        'function run(threads, config, cycles) {',
        '  var state = { grants: 0 };',
        '  var at;',
        '',
        '  for (at = 0; at < cycles; at += 1) {',
        '    var winner = choose(threads, state, config);',
        '',
        '    if (!winner) break;',
        '    winner.sinceGrant = 0;',
        '    winner.retired += 1;',
        '    state.grants += 1;',
        '    threads.forEach(function (thread) {',
        '      if (thread === winner || thread.done) return;',
        '      thread.sinceGrant += 1;',
        '    });',
        '  }',
        '  return threads;',
        '}',
        '',
        'function lab() {',
        '  return { choose: choose, run: run };',
        '}'
      ].join('\n'),
      solution: [
        '/* The guard is one counter and it is not optional. Any priority scheme',
        '   without one has a starvation case, whether or not it has been found:',
        '   a thread that never wins the front end retires nothing at all, and',
        '   over a full run that is invisible because it finishes normally once',
        '   the thread starving it has stopped. */',
        'function choose(threads, state, config) {',
        '  var live = threads.filter(function (thread) { return !thread.done; });',
        '',
        '  if (!live.length) return null;',
        '',
        '  var starving = live.filter(function (thread) {',
        '    return config.guard > 0 && thread.sinceGrant >= config.guard;',
        '  });',
        '',
        '  if (starving.length) {',
        '    var worst = starving[0];',
        '',
        '    starving.forEach(function (thread) {',
        '      if (thread.sinceGrant > worst.sinceGrant) worst = thread;',
        '    });',
        '    return worst;',
        '  }',
        '  if (config.policy === "priority") return live[0];',
        '  if (config.policy === "roundRobin") return live[state.grants % live.length];',
        '',
        '  /* ICOUNT: a thread with many instructions in flight is either making',
        '     progress or stuck, and either way it does not need more. */',
        '  var best = live[0];',
        '',
        '  live.forEach(function (thread) {',
        '    if (thread.inFlight < best.inFlight) best = thread;',
        '  });',
        '  return best;',
        '}',
        '',
        'function run(threads, config, cycles) {',
        '  var state = { grants: 0 };',
        '  var at;',
        '',
        '  for (at = 0; at < cycles; at += 1) {',
        '    var winner = choose(threads, state, config);',
        '',
        '    if (!winner) break;',
        '    winner.sinceGrant = 0;',
        '    winner.retired += 1;',
        '    state.grants += 1;',
        '    threads.forEach(function (thread) {',
        '      if (thread === winner || thread.done) return;',
        '      thread.sinceGrant += 1;',
        '      if (thread.sinceGrant > thread.longestStarve) {',
        '        thread.longestStarve = thread.sinceGrant;',
        '      }',
        '    });',
        '  }',
        '  return threads;',
        '}',
        '',
        'function lab() {',
        '  return { choose: choose, run: run };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'strict priority with no guard starves the second thread completely',
          assert: function (lab, api) {
            const threads = [0, 1].map(function (at) {
              return { name: 't' + at, done: false, sinceGrant: 0, inFlight: 0,
                retired: 0, longestStarve: 0 };
            });

            lab().run(threads, { policy: 'priority', guard: 0 }, 100);
            api.assert.equal(threads[0].retired, 100, 'thread 0 wins every cycle');
            api.assert.equal(threads[1].retired, 0, 'and thread 1 retires nothing at all');
          }
        },
        {
          name: 'the guard makes an adversarial policy fair enough to be safe',
          assert: function (lab, api) {
            const threads = [0, 1].map(function (at) {
              return { name: 't' + at, done: false, sinceGrant: 0, inFlight: 0,
                retired: 0, longestStarve: 0 };
            });

            lab().run(threads, { policy: 'priority', guard: 4 }, 100);
            api.assert.ok(threads[1].retired > 0, 'thread 1 makes progress');
            api.assert.ok(threads[1].longestStarve <= 4,
              'and never waits longer than the guard allows');
          }
        },
        {
          name: 'round robin alternates, and a done thread is skipped',
          assert: function (lab, api) {
            const parts = lab();
            const threads = [
              { name: 'a', done: false, sinceGrant: 0, inFlight: 0, retired: 0,
                longestStarve: 0 },
              { name: 'b', done: false, sinceGrant: 0, inFlight: 0, retired: 0,
                longestStarve: 0 }
            ];

            parts.run(threads, { policy: 'roundRobin', guard: 0 }, 10);
            api.assert.equal(threads[0].retired, 5, 'five cycles each');
            api.assert.equal(threads[1].retired, 5, 'and five for the other');

            threads[1].done = true;
            api.assert.equal(parts.choose(threads, { grants: 1 },
              { policy: 'roundRobin', guard: 0 }).name, 'a',
              'a finished thread is never served');
          }
        },
        {
          name: 'ICOUNT serves the thread with fewest instructions in flight',
          assert: function (lab, api) {
            const threads = [
              { name: 'busy', done: false, sinceGrant: 0, inFlight: 20, retired: 0,
                longestStarve: 0 },
              { name: 'idle', done: false, sinceGrant: 0, inFlight: 2, retired: 0,
                longestStarve: 0 }
            ];

            api.assert.equal(lab().choose(threads, { grants: 0 },
              { policy: 'icount', guard: 0 }).name, 'idle',
              'the thread that is stuck does not need more work');
          }
        },
        {
          name: 'the guard overrides the policy rather than replacing it',
          assert: function (lab, api) {
            const threads = [
              { name: 'a', done: false, sinceGrant: 0, inFlight: 0, retired: 0,
                longestStarve: 0 },
              { name: 'b', done: false, sinceGrant: 9, inFlight: 99, retired: 0,
                longestStarve: 9 }
            ];

            api.assert.equal(lab().choose(threads, { grants: 0 },
              { policy: 'icount', guard: 4 }).name, 'b',
              'ICOUNT would pick a, and the starving thread wins anyway');
          }
        }
      ]
    }],

    'microarchitectural-side-channels': [{
      id: 'flush-and-reload',
      title: 'Build the receiver, and check it fails once the access is prevented',
      prompt: 'Write lab() returning { readOut, vote, rate }. readOut(timings, threshold) '
        + 'takes an array of { value, cycles } - one entry per probe line, in value order - '
        + 'and returns the value of the single entry whose cycles are below the threshold, or '
        + 'null when there is not exactly one such entry (no hit, or several, means the round '
        + 'abstains rather than guessing). vote(guesses) takes an array of values and nulls '
        + 'and returns the value that appears most often, ties broken towards the smaller '
        + 'value, or null when the array holds no values at all. rate(rows) takes an array of '
        + '{ expected, guessed } and returns the fraction that match, or 0 for an empty array. '
        + 'The starter picks the fastest line whatever the timings look like, so a round with '
        + 'no signal still produces a confident answer.',
      entry: 'lab',
      starter: [
        'function readOut(timings, threshold) {',
        '  // Always the fastest, even when nothing was a hit.',
        '  var best = timings[0];',
        '',
        '  timings.forEach(function (row) {',
        '    if (row.cycles < best.cycles) best = row;',
        '  });',
        '  return best ? best.value : null;',
        '}',
        '',
        'function vote(guesses) {',
        '  return guesses.length ? guesses[0] : null;',
        '}',
        '',
        'function rate(rows) {',
        '  var correct = 0;',
        '',
        '  rows.forEach(function (row) {',
        '    if (row.expected === row.guessed) correct += 1;',
        '  });',
        '  return rows.length ? correct / rows.length : 0;',
        '}',
        '',
        'function lab() {',
        '  return { readOut: readOut, vote: vote, rate: rate };',
        '}'
      ].join('\n'),
      solution: [
        '/* Exactly one hit or nothing. Two hits mean something else touched a',
        '   probe line and the reading is unusable; no hits mean the victim never',
        '   made the access at all, which is what a working mitigation looks',
        '   like. Guessing in either case would report a mitigated channel as',
        '   partially working. */',
        'function readOut(timings, threshold) {',
        '  var hits = timings.filter(function (row) { return row.cycles < threshold; });',
        '',
        '  return hits.length === 1 ? hits[0].value : null;',
        '}',
        '',
        '/* Repetition is what turns an unreliable channel into a reliable one, so',
        '   the vote has to ignore the abstentions rather than counting them as a',
        '   result. */',
        'function vote(guesses) {',
        '  var counts = {};',
        '  var best = null;',
        '',
        '  guesses.forEach(function (value) {',
        '    if (value === null || value === undefined) return;',
        '    counts[value] = (counts[value] || 0) + 1;',
        '  });',
        '  Object.keys(counts).forEach(function (key) {',
        '    var value = Number(key);',
        '',
        '    if (best === null) { best = value; return; }',
        '    if (counts[value] > counts[best]) { best = value; return; }',
        '    if (counts[value] === counts[best] && value < best) best = value;',
        '  });',
        '  return best;',
        '}',
        '',
        'function rate(rows) {',
        '  var correct = 0;',
        '',
        '  rows.forEach(function (row) {',
        '    if (row.expected === row.guessed) correct += 1;',
        '  });',
        '  return rows.length ? correct / rows.length : 0;',
        '}',
        '',
        'function lab() {',
        '  return { readOut: readOut, vote: vote, rate: rate };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'one fast line among slow ones is the secret',
          assert: function (lab, api) {
            const timings = [0, 1, 2, 3].map(function (value) {
              return { value: value, cycles: value === 2 ? 1 : 20 };
            });

            api.assert.equal(lab().readOut(timings, 10), 2,
              'the line the victim touched is the one that is fast');
          }
        },
        {
          name: 'no hit at all is an abstention, not a guess',
          assert: function (lab, api) {
            const timings = [0, 1, 2, 3].map(function (value) {
              return { value: value, cycles: 20 - value };
            });

            api.assert.equal(lab().readOut(timings, 10), null,
              'a mitigated round has no signal, and reporting the fastest miss ' +
              'would make the mitigation look partly broken');
          }
        },
        {
          name: 'two hits are noise, and also an abstention',
          assert: function (lab, api) {
            const timings = [0, 1, 2, 3].map(function (value) {
              return { value: value, cycles: (value === 1 || value === 3) ? 1 : 20 };
            });

            api.assert.equal(lab().readOut(timings, 10), null,
              'something else touched a probe line, so this round says nothing');
          }
        },
        {
          name: 'the vote ignores abstentions and takes the majority',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.vote([null, 5, null, 5, 3, null]), 5,
              'two votes for 5 against one for 3');
            api.assert.equal(parts.vote([null, null, null]), null,
              'every round abstained, so there is no answer');
            api.assert.equal(parts.vote([7, 2, 7, 2]), 2, 'a tie goes to the smaller value');
          }
        },
        {
          name: 'the recovery rate is reported against what was actually expected',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.rate([{ expected: 1, guessed: 1 },
              { expected: 2, guessed: 2 }, { expected: 3, guessed: null },
              { expected: 4, guessed: 9 }]), 0.5, 'two of four');
            api.assert.equal(parts.rate([]), 0, 'nothing attempted, nothing recovered');
          }
        }
      ]
    }],

    'anatomy-of-a-modern-core': [{
      id: 'top-down-classify',
      title: 'Charge every slot, make the categories add up, and name the fix',
      prompt: 'Write lab() returning { classify, verdict }. classify(log, width) walks an '
        + 'array of per-cycle event arrays and returns '
        + '{ slots, retiring, badSpeculation, frontEnd, backEnd, reconciles }. Each cycle '
        + 'offers `width` slots. Count the events with kind "dispatch" in that cycle: each one '
        + 'whose id appears in a later "commit" or "trap" event is a retiring slot, and each '
        + 'one that does not is a bad-speculation slot. The remaining slots of that cycle - '
        + 'width minus the dispatch count, never below zero - all go to ONE category: bad '
        + 'speculation if the machine is recovering, back end if the cycle holds a '
        + '"dispatchStall" event, and front end otherwise. The machine starts recovering in a '
        + 'cycle containing a "squash", "recover", "trap" or "memoryMisspeculation" event and '
        + 'stops in the first cycle that dispatches anything. reconciles is whether the four '
        + 'counts sum to slots. verdict(found) returns the name of the largest of the three '
        + 'non-retiring categories - "bad speculation", "front-end bound" or "back-end bound" '
        + '- with ties going to that order. The starter charges only the used slots.',
      entry: 'lab',
      starter: [
        'function classify(log, width) {',
        '  // Only the slots that were used, so the categories cannot add up.',
        '  var out = { slots: width * log.length, retiring: 0, badSpeculation: 0,',
        '    frontEnd: 0, backEnd: 0, reconciles: false };',
        '',
        '  log.forEach(function (events) {',
        '    events.forEach(function (event) {',
        '      if (event.kind === "dispatch") out.retiring += 1;',
        '    });',
        '  });',
        '  return out;',
        '}',
        '',
        'function verdict(found) {',
        '  return "back-end bound";',
        '}',
        '',
        'function lab() {',
        '  return { classify: classify, verdict: verdict };',
        '}'
      ].join('\n'),
      solution: [
        '/* An instruction that traps still commits: it reaches the head of the',
        '   buffer and writes the control registers instead of a general one.',
        '   Charging its slot to bad speculation would make every program that',
        '   ends in ecall look mildly mispredicted. */',
        'function survivors(log) {',
        '  var out = {};',
        '',
        '  log.forEach(function (events) {',
        '    events.forEach(function (event) {',
        '      if (event.kind === "commit" || event.kind === "trap") out[event.id] = true;',
        '    });',
        '  });',
        '  return out;',
        '}',
        '',
        'function has(events, kind) {',
        '  var found = false;',
        '',
        '  events.forEach(function (event) { if (event.kind === kind) found = true; });',
        '  return found;',
        '}',
        '',
        'function isRecovery(events) {',
        '  return has(events, "squash") || has(events, "recover") ||',
        '    has(events, "trap") || has(events, "memoryMisspeculation");',
        '}',
        '',
        '/* Every slot of every cycle charged exactly once. That is the whole',
        '   contribution of the method: four shares of one denominator are',
        '   comparable against each other, and a list of counters with different',
        '   denominators is not. */',
        'function classify(log, width) {',
        '  var kept = survivors(log);',
        '  var out = { slots: width * log.length, retiring: 0, badSpeculation: 0,',
        '    frontEnd: 0, backEnd: 0, reconciles: false };',
        '  var recovering = false;',
        '',
        '  log.forEach(function (events) {',
        '    var dispatched = 0;',
        '',
        '    if (isRecovery(events)) recovering = true;',
        '    events.forEach(function (event) {',
        '      if (event.kind !== "dispatch") return;',
        '      dispatched += 1;',
        '      if (kept[event.id]) out.retiring += 1;',
        '      else out.badSpeculation += 1;',
        '    });',
        '',
        '    var empty = Math.max(0, width - dispatched);',
        '',
        '    if (empty && recovering) out.badSpeculation += empty;',
        '    else if (empty && has(events, "dispatchStall")) out.backEnd += empty;',
        '    else out.frontEnd += empty;',
        '    if (dispatched) recovering = false;',
        '  });',
        '  out.reconciles = out.retiring + out.badSpeculation + out.frontEnd +',
        '    out.backEnd === out.slots;',
        '  return out;',
        '}',
        '',
        'function verdict(found) {',
        '  var best = "bad speculation";',
        '  var value = found.badSpeculation;',
        '',
        '  if (found.frontEnd > value) { best = "front-end bound"; value = found.frontEnd; }',
        '  if (found.backEnd > value) best = "back-end bound";',
        '  return best;',
        '}',
        '',
        'function lab() {',
        '  return { classify: classify, verdict: verdict };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the four categories sum to the slot budget',
          assert: function (lab, api) {
            const log = [
              [{ kind: 'dispatch', id: 0 }, { kind: 'dispatch', id: 1 }],
              [{ kind: 'dispatchStall' }],
              [{ kind: 'commit', id: 0 }, { kind: 'commit', id: 1 }]
            ];
            const got = lab().classify(log, 4);

            api.assert.equal(got.slots, 12, 'four slots in each of three cycles');
            api.assert.equal(got.reconciles, true,
              'a classifier that does not reconcile is describing rather than measuring');
            api.assert.equal(got.retiring + got.badSpeculation + got.frontEnd + got.backEnd,
              12, 'and the arithmetic says so');
          }
        },
        {
          name: 'a dispatched instruction that never commits is bad speculation',
          assert: function (lab, api) {
            const log = [
              [{ kind: 'dispatch', id: 0 }, { kind: 'dispatch', id: 1 }],
              [{ kind: 'squash', id: 0 }],
              [{ kind: 'commit', id: 0 }]
            ];
            const got = lab().classify(log, 2);

            api.assert.equal(got.retiring, 1, 'only instruction 0 committed');
            api.assert.ok(got.badSpeculation >= 1, 'instruction 1 was squashed');
          }
        },
        {
          name: 'a trapping instruction counts as retiring',
          assert: function (lab, api) {
            const log = [
              [{ kind: 'dispatch', id: 0 }],
              [{ kind: 'trap', id: 0 }]
            ];
            const got = lab().classify(log, 1);

            api.assert.equal(got.retiring, 1,
              'it reaches the head of the buffer and commits');
          }
        },
        {
          name: 'an empty slot with a stall is back end, and without one is front end',
          assert: function (lab, api) {
            const parts = lab();
            const stalled = parts.classify([[{ kind: 'dispatchStall' }]], 4);
            const quiet = parts.classify([[{ kind: 'fetch', id: 9 }]], 4);

            api.assert.equal(stalled.backEnd, 4, 'the back end refused the work');
            api.assert.equal(quiet.frontEnd, 4, 'nothing arrived and nothing refused it');
          }
        },
        {
          name: 'recovery cycles are charged to bad speculation until dispatch restarts',
          assert: function (lab, api) {
            const log = [
              [{ kind: 'recover', id: 3 }],
              [{ kind: 'fetch', id: 8 }],
              [{ kind: 'dispatch', id: 8 }],
              [{ kind: 'commit', id: 8 }]
            ];
            const got = lab().classify(log, 2);

            api.assert.equal(got.badSpeculation, 5,
              'two full cycles refetching, plus the unused slot of the cycle that restarts');
            api.assert.equal(got.frontEnd, 2, 'and the cycle after dispatch has restarted');
            api.assert.equal(got.reconciles, true, 'and it still adds up');
          }
        },
        {
          name: 'the verdict names the largest non-retiring category',
          assert: function (lab, api) {
            api.assert.equal(lab().verdict({ retiring: 900, badSpeculation: 10,
              frontEnd: 20, backEnd: 70 }), 'back-end bound',
              'retiring is never the verdict, however large');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
