/**
 * Packing arrivals into bins, and why a cluster reports spare capacity while
 * rejecting jobs.
 *
 * Bin packing is the shape of every placement problem: fixed-size machines,
 * items of assorted sizes, and the question of how many machines are needed.
 * Offline it is NP-hard and first-fit-decreasing is within 11/9 of optimal plus
 * a constant. Online — items arriving one at a time with no lookahead — no
 * algorithm can do better than about 1.54, and first-fit and best-fit both sit
 * at 1.7 in the worst case.
 *
 * The number that matters in production is not the bin count but the
 * FRAGMENTATION: the capacity that exists, is not used, and cannot be used
 * because it is scattered across bins in pieces smaller than anything waiting.
 * A cluster at 60% utilisation rejecting jobs is not short of capacity, it is
 * short of contiguous capacity, and the two are different quantities that this
 * module reports separately.
 *
 * Two dimensions make it qualitatively harder and the module measures that
 * rather than asserting it. In one dimension a bin either fits an item or does
 * not; in two, an item can fit by CPU and not by memory, so a bin can be 90%
 * full on one axis and unusable on the other. There is no ordering of
 * two-dimensional items that plays the role "decreasing" plays in one, which is
 * why the offline guarantee does not survive the extra axis.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.BinPacking = api;
}(typeof window !== 'undefined' ? window : null, function (scope) {
  'use strict';

  const Random = scope && scope.Random ? scope.Random : require('../utils/random.js');

  const POLICIES = ['next-fit', 'first-fit', 'best-fit', 'worst-fit', 'first-fit-decreasing'];

  /* ---------------------------------------------------------- one dimension */

  /**
   * All five policies in one loop, because they differ only in which open bin
   * is chosen. Next-fit looks at the last bin alone, first-fit at the earliest
   * that fits, best-fit at the tightest, worst-fit at the loosest, and
   * first-fit-decreasing is first-fit given the items sorted — which is the
   * only offline member of the family.
   */
  function pack(items, capacity, policy) {
    const order = policy === 'first-fit-decreasing'
      ? items.slice().sort(function (a, b) { return b - a; })
      : items.slice();
    const bins = [];
    const placement = [];

    order.forEach(function (size) {
      const at = chooseBin(bins, size, capacity, policy);
      if (at === -1) { bins.push(size); placement.push(bins.length - 1); return; }
      bins[at] += size;
      placement.push(at);
    });
    return summarise(bins, order, capacity, policy, placement);
  }

  function chooseBin(bins, size, capacity, policy) {
    if (bins.length === 0) return -1;
    if (policy === 'next-fit') {
      return bins[bins.length - 1] + size <= capacity ? bins.length - 1 : -1;
    }
    let best = -1;

    for (let i = 0; i < bins.length; i += 1) {
      if (bins[i] + size > capacity) continue;
      if (policy === 'first-fit' || policy === 'first-fit-decreasing') return i;
      if (best === -1) { best = i; continue; }
      const tighter = bins[i] > bins[best];
      if (policy === 'best-fit' ? tighter : !tighter) best = i;
    }
    return best;
  }

  /**
   * `wasted` is the capacity that exists in opened bins and is not used;
   * `fragmentation` is the part of it that no single remaining item could have
   * used, which is the quantity a cluster operator actually feels.
   */
  function summarise(bins, items, capacity, policy, placement) {
    const total = items.reduce(function (a, b) { return a + b; }, 0);
    const smallest = items.length ? Math.min.apply(null, items) : 0;
    let stranded = 0;

    bins.forEach(function (used) {
      const free = capacity - used;
      if (free < smallest) stranded += free;
    });
    return { policy: policy, bins: bins.length, loads: bins.slice(), placement: placement,
      capacity: capacity, used: total, wasted: bins.length * capacity - total,
      stranded: stranded, utilisation: total / Math.max(1, bins.length * capacity),
      lowerBound: Math.ceil(total / capacity) };
  }

  /** The LP relaxation's bound: total size over bin capacity, rounded up. It
   *  ignores indivisibility entirely, so it is a floor and never the answer. */
  function lowerBound(items, capacity) {
    return Math.ceil(items.reduce(function (a, b) { return a + b; }, 0) / capacity);
  }

  /** Exact bin count by search, for instances small enough to be a reference. */
  function exactBins(items, capacity, limit) {
    const cap = limit === undefined ? 400000 : limit;
    const order = items.slice().sort(function (a, b) { return b - a; });
    const state = { best: order.length, nodes: 0, budget: cap, exhausted: false };

    packExact(order, 0, [], capacity, state);
    return { bins: state.best, nodes: state.nodes, exhausted: state.exhausted };
  }

  function packExact(items, index, bins, capacity, state) {
    state.nodes += 1;
    if (state.nodes > state.budget) { state.exhausted = true; return; }
    if (index === items.length) { state.best = Math.min(state.best, bins.length); return; }
    if (bins.length >= state.best) return;

    for (let i = 0; i < bins.length; i += 1) {
      if (bins[i] + items[index] > capacity) continue;
      bins[i] += items[index];
      packExact(items, index + 1, bins, capacity, state);
      bins[i] -= items[index];
    }
    bins.push(items[index]);
    packExact(items, index + 1, bins, capacity, state);
    bins.pop();
  }

  /**
   * The family that pushes first-fit to 1.7: sixths, thirds and halves in an
   * order that makes every bin hold one of each and then leaves the halves
   * with nowhere to go. Sorted decreasing the same items pack perfectly, which
   * is the whole argument for the offline variant.
   */
  /**
   * Johnson's family, and the epsilon has to go the way it goes here.
   * A seventh, a third and a half sum to 0.976, so one of each still fits
   * after each is nudged UP by epsilon - the optimum really is one bin per
   * group, and every bin holds exactly one half, so it cannot be beaten.
   * Nudging sixths up instead makes one of each sum past the capacity, and
   * the stated optimum becomes unreachable: the ratio then measures against
   * a number no packing attains.
   */
  function firstFitTrap(groups) {
    const items = [];

    for (let g = 0; g < groups; g += 1) items.push(1 / 7 + 0.0001);
    for (let g = 0; g < groups; g += 1) items.push(1 / 3 + 0.0001);
    for (let g = 0; g < groups; g += 1) items.push(1 / 2 + 0.0001);
    return { items: items, capacity: 1, optimum: groups,
      reason: 'each bin holds one seventh, one third and one half; first-fit fills bins with '
        + 'sevenths first, six to a bin, and the halves then have nowhere to go' };
  }

  /* --------------------------------------------------------- two dimensions */

  /**
   * The same policies with two independent axes. An item fits only when BOTH
   * axes fit, and "tightest" needs a scalar, so best-fit scores a bin by the
   * remaining capacity it would leave summed across the axes — a choice, not a
   * law, and one the demo can be argued with about.
   */
  function pack2d(items, capacity, policy) {
    const order = policy === 'first-fit-decreasing'
      ? items.slice().sort(function (a, b) {
        return (b.cpu / capacity.cpu + b.mem / capacity.mem) -
          (a.cpu / capacity.cpu + a.mem / capacity.mem);
      })
      : items.slice();
    const bins = [];

    order.forEach(function (item) {
      const at = choose2d(bins, item, capacity, policy);
      if (at === -1) { bins.push({ cpu: item.cpu, mem: item.mem }); return; }
      bins[at].cpu += item.cpu;
      bins[at].mem += item.mem;
    });
    return summarise2d(bins, order, capacity, policy);
  }

  function fits(bin, item, capacity) {
    return bin.cpu + item.cpu <= capacity.cpu && bin.mem + item.mem <= capacity.mem;
  }

  function choose2d(bins, item, capacity, policy) {
    if (bins.length === 0) return -1;
    if (policy === 'next-fit') {
      return fits(bins[bins.length - 1], item, capacity) ? bins.length - 1 : -1;
    }
    let best = -1;
    let bestScore = Infinity;

    for (let i = 0; i < bins.length; i += 1) {
      if (!fits(bins[i], item, capacity)) continue;
      if (policy === 'first-fit' || policy === 'first-fit-decreasing') return i;
      const slack = (capacity.cpu - bins[i].cpu - item.cpu) / capacity.cpu +
        (capacity.mem - bins[i].mem - item.mem) / capacity.mem;
      const score = policy === 'best-fit' ? slack : -slack;
      if (score >= bestScore) continue;
      bestScore = score;
      best = i;
    }
    return best;
  }

  /**
   * The two-dimensional summary carries the number one-dimensional intuition
   * misses: how many bins have capacity on one axis and none on the other.
   * That is where "60% utilised and rejecting jobs" comes from.
   */
  function summarise2d(bins, items, capacity, policy) {
    const totals = items.reduce(function (sum, item) {
      return { cpu: sum.cpu + item.cpu, mem: sum.mem + item.mem };
    }, { cpu: 0, mem: 0 });
    const smallest = smallestItem(items);
    let lopsided = 0;
    let stranded = 0;

    bins.forEach(function (bin) {
      const freeCpu = capacity.cpu - bin.cpu;
      const freeMem = capacity.mem - bin.mem;
      if (freeCpu < smallest.cpu !== (freeMem < smallest.mem)) lopsided += 1;
      if (freeCpu < smallest.cpu || freeMem < smallest.mem) {
        stranded += freeCpu / capacity.cpu + freeMem / capacity.mem;
      }
    });
    return { policy: policy, bins: bins.length, loads: bins.slice(), capacity: capacity,
      cpuUtilisation: totals.cpu / Math.max(1, bins.length * capacity.cpu),
      memUtilisation: totals.mem / Math.max(1, bins.length * capacity.mem),
      lopsided: lopsided, strandedBins: stranded / 2,
      lowerBound: Math.max(Math.ceil(totals.cpu / capacity.cpu),
        Math.ceil(totals.mem / capacity.mem)) };
  }

  function smallestItem(items) {
    return items.reduce(function (best, item) {
      return { cpu: Math.min(best.cpu, item.cpu), mem: Math.min(best.mem, item.mem) };
    }, { cpu: Infinity, mem: Infinity });
  }

  /* -------------------------------------------------------------- generators */

  function randomItems(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 1 : settings.seed);
    const count = settings.count === undefined ? 200 : settings.count;
    const low = settings.low === undefined ? 0.05 : settings.low;
    const high = settings.high === undefined ? 0.6 : settings.high;
    const out = [];

    for (let i = 0; i < count; i += 1) out.push(low + rng.next() * (high - low));
    return out;
  }

  /**
   * Jobs whose two axes are ANTI-correlated: a CPU-heavy job is memory-light
   * and the reverse. That is the realistic shape and it is the one where a
   * cluster fragments, because the axes fill at different rates in every bin.
   */
  function randomJobs(options) {
    const settings = options || {};
    const rng = Random.seeded(settings.seed === undefined ? 2 : settings.seed);
    const count = settings.count === undefined ? 200 : settings.count;
    const skew = settings.skew === undefined ? 0.8 : settings.skew;
    const out = [];

    for (let i = 0; i < count; i += 1) {
      const tilt = rng.next();
      out.push({ cpu: 0.05 + tilt * skew * 0.55, mem: 0.05 + (1 - tilt) * skew * 0.55 });
    }
    return out;
  }

  return {
    POLICIES: POLICIES,
    pack: pack, lowerBound: lowerBound, exactBins: exactBins, firstFitTrap: firstFitTrap,
    pack2d: pack2d, fits: fits, randomItems: randomItems, randomJobs: randomJobs
  };
}));
