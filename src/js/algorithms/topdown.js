/**
 * Topdown - four numbers that say which half of the machine to look at.
 *
 * Performance work on a modern core used to mean reading a list of two hundred
 * hardware counters and guessing. Yasin's top-down method replaced that with a
 * decision procedure: every issue slot the machine had is charged to exactly
 * one of four categories, and the largest one tells you where to look before
 * you have read a line of assembly.
 *
 *   - RETIRING          the slot did useful work. More is better, and a
 *                       program that is 80% retiring is not going to be fixed
 *                       by the processor.
 *   - BAD SPECULATION   the slot was used by an instruction that never
 *                       retired, or lost while recovering from one. Branchy
 *                       code and unpredictable data land here.
 *   - FRONT-END BOUND   the slot was empty and the back end was ready for it.
 *                       Fetch, decode, prediction and code layout.
 *   - BACK-END BOUND    the slot was empty because the back end could not
 *                       accept it. Full window, exhausted registers, memory.
 *
 * The accounting is the load-bearing part. A cycle offers `width` slots and
 * every one of them is charged to exactly one category, so the four shares sum
 * to 100% by construction rather than by luck. An analyser whose categories do
 * not add up is not measuring the machine, it is describing it - and this one
 * is asserted to add up on every program in the test suite.
 *
 * The input is the event log of `machines/ooo-core.js`, which is the same log
 * the in-flight window is drawn from, so the picture and the breakdown cannot
 * disagree.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Topdown = api;
}(this, function () {
  'use strict';

  const CATEGORIES = [
    { key: 'retiring', name: 'retiring',
      about: 'slots used by instructions that went on to commit - the useful work',
      then: 'the machine is doing what it was asked; make the program ask for less' },
    { key: 'badSpeculation', name: 'bad speculation',
      about: 'slots used by instructions that were squashed, plus the slots lost recovering',
      then: 'a branch or a memory dependence is unpredictable; change the data or the shape' },
    { key: 'frontEnd', name: 'front-end bound',
      about: 'slots the back end would have taken and the front end did not deliver',
      then: 'fetch, decode or code layout - the instructions were not there in time' },
    { key: 'backEnd', name: 'back-end bound',
      about: 'slots the front end had ready and the back end refused',
      then: 'the window, the registers or memory - something downstream is full' }
  ];

  /** Every event that means the machine threw work away. The cycles after one
   *  of these, until dispatch restarts, are the recovery, and they belong to
   *  bad speculation rather than to the front end that was told to refetch. */
  const RECOVERY = ['recover', 'squash', 'trap', 'memoryMisspeculation'];

  function isRecovery(event) {
    return RECOVERY.indexOf(event.kind) !== -1;
  }

  /**
   * Which dispatched instructions eventually became architectural state.
   *
   * A trap counts: the faulting instruction reaches the head of the reorder
   * buffer and commits, it simply writes the control registers instead of a
   * general one. Charging its slot to bad speculation would make every program
   * that ends in `ecall` look mildly mispredicted.
   */
  function retiredIds(log) {
    const out = new Set();

    log.forEach(function (row) {
      row.events.forEach(function (event) {
        if (event.kind === 'commit' || event.kind === 'trap') out.add(event.id);
      });
    });
    return out;
  }

  function countKind(events, kind) {
    return events.filter(function (event) { return event.kind === kind; }).length;
  }

  /* --------------------------------------------------------------- the split */

  function blank() {
    return { retiring: 0, badSpeculation: 0, frontEnd: 0, backEnd: 0 };
  }

  /**
   * One pass over the log, charging every slot in every cycle.
   *
   * The dispatched slots are split by whether the instruction survived; the
   * empty ones go to whichever of the three stall categories the cycle was in.
   * Nothing is left over and nothing is counted twice, which is the only
   * property of this function that matters.
   */
  function classify(core) {
    const log = core.log || [];
    const width = Math.max(1, core.config ? core.config.width : 4);
    const retired = retiredIds(log);
    const slots = blank();
    const detail = { badSpeculation: {}, frontEnd: {}, backEnd: {} };
    let recovering = false;

    log.forEach(function (row) {
      const dispatched = row.events.filter(function (event) {
        return event.kind === 'dispatch';
      });

      recovering = recovering || row.events.some(isRecovery);
      dispatched.forEach(function (event) {
        slots[retired.has(event.id) ? 'retiring' : 'badSpeculation'] += 1;
      });
      chargeEmpty({ slots: slots, detail: detail },
        { width: width, dispatched: dispatched.length, recovering: recovering }, row);
      if (dispatched.length) recovering = false;
    });
    return report(core, slots, detail, width);
  }

  /**
   * The empty slots of one cycle, charged to exactly one category.
   *
   * The order is not arbitrary. Recovery wins over a full window, because a
   * window that is full of instructions about to be squashed is not the
   * program's problem; and a back-end stall wins over the front end, because
   * a front end that is not delivering into a machine that could not take it
   * anyway has not cost anything.
   */
  function chargeEmpty(into, cycle, row) {
    const empty = Math.max(0, cycle.width - cycle.dispatched);
    const stalls = row.events.filter(function (event) {
      return event.kind === 'dispatchStall';
    });

    if (!empty) return;
    if (cycle.recovering) {
      into.slots.badSpeculation += empty;
      add(into.detail.badSpeculation, recoveryReason(row), empty);
      return;
    }
    if (stalls.length) {
      into.slots.backEnd += empty;
      add(into.detail.backEnd, stalls[0].reason, empty);
      return;
    }
    into.slots.frontEnd += empty;
    add(into.detail.frontEnd, frontEndReason(row), empty);
  }

  function add(bucket, key, count) {
    bucket[key] = (bucket[key] || 0) + count;
  }

  function recoveryReason(row) {
    const found = row.events.filter(isRecovery)[0];

    if (!found) return 'refetching after a squash';
    if (found.kind === 'trap') return 'an exception was taken';
    if (found.kind === 'memoryMisspeculation') return 'a load read an address a store then wrote';
    return 'a branch went the other way';
  }

  /**
   * Why the front end delivered nothing, which on a short program is often
   * not a front-end problem at all.
   *
   * A machine whose window is large enough to hold the entire program runs out
   * of program rather than out of fetch bandwidth, and saying so is the honest
   * version - the fix for it is a longer program, not a wider decoder. Real
   * traces do not have that shape and the section says as much.
   */
  function frontEndReason(row) {
    if (countKind(row.events, 'fetch')) return 'fetched this cycle, not yet dispatchable';
    if (countKind(row.events, 'resume')) return 'the machine was drained and is restarting';
    if (row.window && row.window.length) {
      return 'the whole program is already in flight - nothing left to fetch';
    }
    return 'no instruction was available to dispatch';
  }

  /* ------------------------------------------------------------- the report */

  function report(core, slots, detail, width) {
    const total = width * (core.log ? core.log.length : 0);
    const rows = CATEGORIES.map(function (category) {
      return { key: category.key, name: category.name, about: category.about,
        then: category.then, slots: slots[category.key],
        share: total ? slots[category.key] / total : 0,
        detail: breakdown(detail[category.key]) };
    });
    const counted = rows.reduce(function (sum, row) { return sum + row.slots; }, 0);

    return { width: width, cycles: core.log ? core.log.length : 0, slots: total,
      counted: counted, reconciles: counted === total, rows: rows,
      dominant: dominant(rows), shares: shares(rows) };
  }

  function breakdown(bucket) {
    return Object.keys(bucket || {}).map(function (reason) {
      return { reason: reason, slots: bucket[reason] };
    }).sort(function (left, right) { return right.slots - left.slots; });
  }

  function shares(rows) {
    const out = {};

    rows.forEach(function (row) { out[row.key] = row.share; });
    return out;
  }

  function dominant(rows) {
    const stalls = rows.filter(function (row) { return row.key !== 'retiring'; })
      .sort(function (left, right) { return right.slots - left.slots; });

    return stalls.length ? stalls[0] : null;
  }

  /** The advice, which is the whole reason anybody runs this: a category and
   *  what to do about it, rather than four numbers and a shrug. */
  function verdict(found) {
    const worst = found.dominant;

    if (!worst || !worst.slots) {
      return 'Every slot retired. Nothing in the machine is being wasted, so the only way '
        + 'to make this faster is to execute fewer instructions.';
    }
    const top = worst.detail[0];

    return 'Mostly ' + worst.name + ' at ' + (100 * worst.share).toFixed(1) + '% of slots: '
      + worst.then + (top ? '. The largest single reason is "' + top.reason + '" at '
        + top.slots + ' slots.' : '.');
  }

  return { CATEGORIES: CATEGORIES, classify: classify, verdict: verdict };
}));
