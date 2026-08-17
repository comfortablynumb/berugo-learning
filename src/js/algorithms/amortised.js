/**
 * Amortised analysis, with the credit visible.
 *
 * The potential is derived from the growth factor rather than hard-coded:
 * phi = (r*size - capacity) / (r - 1). See the note on potential() below.
 *
 * A dynamic array whose growth factor is a parameter, instrumented so the
 * three methods can be shown against the same operation trace:
 *   aggregate  - total copies / operations
 *   accounting - a charge per push, banked and spent on the copy
 *   potential  - Φ = (r·size − capacity)/(r − 1), which must never go negative
 *
 * The potential is asserted rather than described: if the credit ever goes
 * negative the analysis is wrong, and the test says so.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Amortised = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function createDynamicArray(options) {
    const settings = options || {};
    const factor = settings.factor || 2;
    const shrinkAt = settings.shrinkAt || 0;      // 0 disables shrinking
    const charge = settings.charge || 3;          // accounting method: credits per push

    let capacity = settings.initialCapacity || 1;
    let size = 0;
    let totalCopies = 0;
    let bank = 0;
    const trace = [];

    /*
     * The textbook potential 2*size - capacity is the factor-2 special case of
     *     phi = (r*size - capacity) / (r - 1)
     * which is 0 right after a grow and equals the capacity just before the
     * next one - exactly enough to pay for the copy. Using the doubling form
     * with r = 3 drives the potential to -2185 over 3000 pushes, so the
     * argument has to be re-derived per factor rather than copied.
     */
    function potential() {
      if (factor <= 1) return 0;
      return (factor * size - capacity) / (factor - 1);
    }

    function grow() {
      const next = Math.max(capacity + 1, Math.ceil(capacity * factor));
      totalCopies += size;
      const copies = size;
      capacity = next;
      return copies;
    }

    function shrink() {
      const next = Math.max(1, Math.ceil(capacity / 2));
      totalCopies += size;
      const copies = size;
      capacity = next;
      return copies;
    }

    function push() {
      const before = potential();
      let copies = 0;
      if (size === capacity) copies = grow();

      size += 1;
      bank += charge - 1 - copies;

      const record = {
        op: 'push', index: trace.length, copies: copies, cost: 1 + copies,
        size: size, capacity: capacity,
        potentialBefore: before, potentialAfter: potential(), bank: bank
      };
      trace.push(record);
      return record;
    }

    function pop() {
      if (size === 0) return null;
      const before = potential();
      size -= 1;
      let copies = 0;
      if (shrinkAt && capacity > 1 && size <= capacity * shrinkAt) copies = shrink();

      const record = {
        op: 'pop', index: trace.length, copies: copies, cost: 1 + copies,
        size: size, capacity: capacity,
        potentialBefore: before, potentialAfter: potential(), bank: bank
      };
      trace.push(record);
      return record;
    }

    function summary() {
      const total = trace.reduce(function (sum, record) { return sum + record.cost; }, 0);
      return {
        operations: trace.length,
        totalCost: total,
        amortised: trace.length ? total / trace.length : 0,
        totalCopies: totalCopies,
        capacity: capacity,
        size: size,
        wasted: capacity - size,
        utilisation: capacity ? size / capacity : 0,
        minPotential: trace.reduce(function (min, r) { return Math.min(min, r.potentialAfter); }, Infinity),
        factor: factor
      };
    }

    return {
      push: push, pop: pop, trace: function () { return trace; }, summary: summary,
      size: function () { return size; }, capacity: function () { return capacity; }
    };
  }

  /**
   * Total bytes copied for n pushes at a given growth factor, plus whether the
   * allocator could reuse the sum of the freed blocks - the actual argument for
   * a factor below the golden ratio.
   */
  function growthCost(factor, n) {
    let capacity = 1;
    let copies = 0;
    const capacities = [1];

    for (let size = 1; size <= n; size += 1) {
      if (size > capacity) {
        copies += size - 1;
        capacity = Math.max(capacity + 1, Math.ceil(capacity * factor));
        capacities.push(capacity);
      }
    }

    const freedSum = capacities.slice(0, -1).reduce(function (sum, c) { return sum + c; }, 0);
    return {
      factor: factor,
      copies: copies,
      copiesPerPush: copies / n,
      finalCapacity: capacity,
      wasted: capacity - n,
      reuseable: freedSum >= capacity,
      freedSum: freedSum
    };
  }

  return { createDynamicArray: createDynamicArray, growthCost: growthCost };
}));
