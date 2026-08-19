/**
 * Three persistent queues, and the reason amortised analysis stops working
 * when a data structure is persistent.
 *
 * A queue built from two lists is the textbook amortised-O(1) structure: push
 * onto the rear, pop from the front, and when the front runs out reverse the
 * rear into it. The reversal is O(n) and it is paid for by the n cheap pushes
 * that preceded it - *if* each of those pushes happens once.
 *
 * Persistence removes that "if". An old version can be reused as often as you
 * like, so the expensive operation can be re-triggered forever while its
 * savings are only ever earned once. The credit argument is not merely hard to
 * carry out; it is false.
 *
 *   'strict'    the two-list queue. Fine ephemerally, and O(n) *per reuse*
 *               when one pre-rotation version is used repeatedly.
 *   'banker'    Okasaki's: the rotation is a memoised suspension, so the n
 *               steps are paid once however many versions force it. Amortised
 *               O(1) even persistently - but a single operation can still cost
 *               O(n), which is a different promise from the one a latency
 *               budget wants.
 *   'realtime'  incremental rotation with a schedule: one step of the pending
 *               rotation is executed per operation, so every operation is
 *               O(1) in the *worst* case and there is no spike at all.
 *
 * `steps` counts list cells forced or traversed, which is the quantity all
 * three arguments are about. Nothing here is timed; the point is a count that
 * does not depend on the machine.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.PersistentQueue = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const KINDS = ['strict', 'banker', 'realtime'];

  function emptyStats() {
    return { operations: 0, steps: 0, worstOperation: 0, rotations: 0, suspensionsForced: 0, memoHits: 0 };
  }

  function create(options) {
    const settings = options || {};
    const kind = KINDS.indexOf(settings.kind) === -1 ? 'banker' : settings.kind;
    let stats = emptyStats();
    let charged = 0;

    function step(count) {
      const n = count === undefined ? 1 : count;
      stats.steps += n;
      charged += n;
    }

    function delay(thunk) {
      /* A memoised suspension. The memo is the whole argument: without it the
         banker's queue has the strict queue's behaviour under reuse, and with
         it the n steps of a rotation are paid by whichever version forces it
         first and by none of the others. */
      return { forced: false, value: null, thunk: thunk };
    }

    function force(cell) {
      if (cell.forced) { stats.memoHits += 1; return cell.value; }
      stats.suspensionsForced += 1;
      cell.value = cell.thunk();
      cell.forced = true;
      cell.thunk = null;
      return cell.value;
    }

    function eager(value) {
      return { forced: true, value: value, thunk: null };
    }

    const NIL = eager(null);

    function cons(head, tail) {
      return eager({ head: head, tail: tail });
    }

    function isEmpty(cell) {
      return force(cell) === null;
    }

    function toArray(cell) {
      const out = [];
      let node = force(cell);
      while (node) { out.push(node.head); node = force(node.tail); }
      return out;
    }

    /* ------------------------------------------------------- strict queue */

    function strictRotate(front, rear) {
      stats.rotations += 1;
      const items = toArray(front).concat(toArray(rear).reverse());
      step(items.length);
      let list = NIL;
      for (let i = items.length - 1; i >= 0; i -= 1) list = cons(items[i], list);
      return list;
    }

    const strict = {
      empty: function () { return { front: NIL, rear: NIL, frontLen: 0, rearLen: 0 }; },
      snoc: function (queue, value) {
        return balance({ front: queue.front, rear: cons(value, queue.rear), frontLen: queue.frontLen, rearLen: queue.rearLen + 1 });
      },
      tail: function (queue) {
        step();
        const node = force(queue.front);
        return balance({ front: node.tail, rear: queue.rear, frontLen: queue.frontLen - 1, rearLen: queue.rearLen });
      }
    };

    function balance(queue) {
      if (queue.rearLen <= queue.frontLen) return queue;
      return {
        front: strictRotate(queue.front, queue.rear), rear: NIL,
        frontLen: queue.frontLen + queue.rearLen, rearLen: 0
      };
    }

    /* ------------------------------------------------------ banker's queue */

    function lazyRotate(front, rear) {
      /** front ++ reverse(rear), suspended. Forcing it walks both lists once,
       *  and the memo means it is walked once in total rather than once per
       *  version that happens to need it. */
      stats.rotations += 1;
      return delay(function () {
        const items = toArray(front).concat(toArray(rear).reverse());
        step(items.length);
        let list = NIL;
        for (let i = items.length - 1; i >= 0; i -= 1) list = cons(items[i], list);
        return force(list);
      });
    }

    const banker = {
      empty: function () { return { front: NIL, rear: NIL, frontLen: 0, rearLen: 0 }; },
      snoc: function (queue, value) {
        return check({ front: queue.front, rear: cons(value, queue.rear), frontLen: queue.frontLen, rearLen: queue.rearLen + 1 });
      },
      tail: function (queue) {
        step();
        const node = force(queue.front);
        return check({ front: node.tail, rear: queue.rear, frontLen: queue.frontLen - 1, rearLen: queue.rearLen });
      }
    };

    function check(queue) {
      if (queue.rearLen <= queue.frontLen) return queue;
      return {
        front: lazyRotate(queue.front, queue.rear), rear: NIL,
        frontLen: queue.frontLen + queue.rearLen, rearLen: 0
      };
    }

    /* ----------------------------------------------------- real-time queue */

    function incrementalRotate(front, rear, accumulator) {
      /**
       * Okasaki's rotate: instead of one O(n) suspension, a chain of n
       * suspensions each doing O(1) work, plus a schedule that forces exactly
       * one of them per queue operation. The rotation is therefore finished by
       * the time the next one is due, and no operation ever pays more than a
       * constant.
       */
      return delay(function () {
        step();
        const rearNode = force(rear);
        const frontNode = force(front);
        if (!frontNode) return { head: rearNode.head, tail: accumulator };
        return {
          head: frontNode.head,
          tail: incrementalRotate(frontNode.tail, rearNode.tail, cons(rearNode.head, accumulator))
        };
      });
    }

    const realtime = {
      empty: function () { return { front: NIL, rear: NIL, schedule: NIL }; },
      snoc: function (queue, value) {
        return exec({ front: queue.front, rear: cons(value, queue.rear), schedule: queue.schedule });
      },
      tail: function (queue) {
        step();
        const node = force(queue.front);
        return exec({ front: node.tail, rear: queue.rear, schedule: queue.schedule });
      }
    };

    function exec(queue) {
      const scheduled = force(queue.schedule);
      if (scheduled) return { front: queue.front, rear: queue.rear, schedule: scheduled.tail };
      stats.rotations += 1;
      const rotated = incrementalRotate(queue.front, queue.rear, NIL);
      return { front: rotated, rear: NIL, schedule: rotated };
    }

    const ENGINES = { strict: strict, banker: banker, realtime: realtime };
    const engine = ENGINES[kind];

    function charge(fn) {
      /** Every public operation charges its own step count, so `worstOperation`
       *  is a real per-call maximum rather than a total divided by a count. */
      return function () {
        charged = 0;
        stats.operations += 1;
        const result = fn.apply(null, arguments);
        if (charged > stats.worstOperation) stats.worstOperation = charged;
        return result;
      };
    }

    function headOf(queue) {
      const node = force(queue.front);
      return node ? node.head : undefined;
    }

    return {
      kind: kind, empty: engine.empty, head: headOf,
      snoc: charge(engine.snoc), tail: charge(engine.tail),
      isEmpty: function (queue) { return isEmpty(queue.front); },
      toArray: function (queue) {
        return toArray(queue.front).concat(toArray(queue.rear).reverse());
      },
      stats: function () { return Object.assign({}, stats); },
      resetStats: function () { stats = emptyStats(); }
    };
  }

  return { create: create, kinds: KINDS.slice() };
}));
