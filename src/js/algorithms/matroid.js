/**
 * Matroids: the structure that decides, in advance, whether greedy is right.
 *
 * A matroid is a ground set with a family of "independent" subsets satisfying
 * two properties:
 *
 *   hereditary - every subset of an independent set is independent;
 *   exchange   - if A and B are independent and |A| < |B|, some element of
 *                B \ A can be added to A and keep it independent.
 *
 * The Rado-Edmonds theorem says the generic greedy algorithm - sort the ground
 * set by weight, take each element if it keeps the set independent - finds a
 * maximum-weight independent set *if and only if* the family is a matroid. That
 * turns "does greedy work here?" from an argument into a check, and one
 * counter-example to the exchange property ends the discussion.
 *
 * `checkExchange` performs that check by enumeration over an independence
 * oracle, and returns the violating pair rather than a boolean, because a
 * verdict without a witness is not usable in a design review. Enumeration is
 * exponential in the ground set, which is why the ground sets here are small
 * and the size is a reported field: this is a tool for settling an argument
 * about a structure, not a subroutine.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Matroid = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const MAX_GROUND = 20;

  function subsetsOf(size) {
    const out = [];
    for (let mask = 0; mask < (1 << size); mask += 1) out.push(mask);
    return out;
  }

  function membersOf(mask, ground) {
    const out = [];
    for (let i = 0; i < ground.length; i += 1) {
      if (mask & (1 << i)) out.push(ground[i]);
    }
    return out;
  }

  function popcount(mask) {
    let n = mask;
    let total = 0;
    while (n) { total += n & 1; n >>>= 1; }
    return total;
  }

  /**
   * Every independent subset, by asking the oracle about each of the 2^n
   * candidates. `oracleCalls` is reported because that number is the reason
   * this is a teaching tool and not an algorithm.
   */
  function independentSets(ground, isIndependent) {
    if (ground.length > MAX_GROUND) throw new Error('ground set too large to enumerate: ' + ground.length);
    const independent = [];
    let oracleCalls = 0;

    subsetsOf(ground.length).forEach(function (mask) {
      oracleCalls += 1;
      if (isIndependent(membersOf(mask, ground))) independent.push(mask);
    });
    return { independent: independent, oracleCalls: oracleCalls };
  }

  /** Hereditary: no independent set may contain a dependent one. */
  function checkHereditary(ground, independent) {
    const set = new Set(independent);
    for (let i = 0; i < independent.length; i += 1) {
      const mask = independent[i];
      for (let bit = 0; bit < ground.length; bit += 1) {
        if (!(mask & (1 << bit))) continue;
        const smaller = mask & ~(1 << bit);
        if (!set.has(smaller)) {
          return {
            holds: false,
            witness: { set: membersOf(mask, ground), subset: membersOf(smaller, ground) }
          };
        }
      }
    }
    return { holds: true, witness: null };
  }

  /** Exchange: the property that makes greedy correct, and the one a
   *  plausible-looking independence system usually fails. */
  function checkExchange(ground, independent) {
    const set = new Set(independent);

    for (let i = 0; i < independent.length; i += 1) {
      for (let j = 0; j < independent.length; j += 1) {
        const a = independent[i];
        const b = independent[j];
        if (popcount(a) >= popcount(b)) continue;

        let extendable = false;
        for (let bit = 0; bit < ground.length; bit += 1) {
          if (!(b & (1 << bit)) || (a & (1 << bit))) continue;
          if (set.has(a | (1 << bit))) { extendable = true; break; }
        }
        if (!extendable) {
          return {
            holds: false,
            witness: { smaller: membersOf(a, ground), larger: membersOf(b, ground) }
          };
        }
      }
    }
    return { holds: true, witness: null };
  }

  /**
   * Is this independence system a matroid? Both properties, both witnesses.
   * A caller that only reads `isMatroid` is using half of the answer.
   */
  function analyse(ground, isIndependent) {
    const found = independentSets(ground, isIndependent);
    const hereditary = checkHereditary(ground, found.independent);
    const exchange = checkExchange(ground, found.independent);

    return {
      groundSize: ground.length,
      independentCount: found.independent.length,
      oracleCalls: found.oracleCalls,
      hereditary: hereditary,
      exchange: exchange,
      isMatroid: hereditary.holds && exchange.holds
    };
  }

  /**
   * The generic greedy algorithm over an independence oracle. This is Kruskal
   * when the oracle is acyclicity, and it is the *same code* - which is the
   * point of the abstraction rather than a curiosity about it.
   */
  function greedy(ground, isIndependent, weightOf) {
    const order = ground.slice().sort(function (a, b) { return weightOf(b) - weightOf(a); });
    const chosen = [];
    let oracleCalls = 0;
    let weight = 0;

    order.forEach(function (element) {
      oracleCalls += 1;
      if (!isIndependent(chosen.concat([element]))) return;
      chosen.push(element);
      weight += weightOf(element);
    });
    return { chosen: chosen, weight: weight, oracleCalls: oracleCalls };
  }

  /** Exhaustive maximum-weight independent set, so the greedy claim is checked
   *  rather than trusted. */
  function bestIndependent(ground, isIndependent, weightOf) {
    const found = independentSets(ground, isIndependent);
    let best = { chosen: [], weight: -Infinity };

    found.independent.forEach(function (mask) {
      const members = membersOf(mask, ground);
      const weight = members.reduce(function (total, element) { return total + weightOf(element); }, 0);
      if (weight > best.weight) best = { chosen: members, weight: weight };
    });
    return best;
  }

  /* ------------------------------------------------------- known instances */

  /** The graphic matroid: a set of edges is independent when it is acyclic.
   *  Greedy over it is exactly Kruskal's algorithm. */
  function acyclicOracle(vertexCount) {
    return function (edges) {
      const parent = [];
      for (let i = 0; i < vertexCount; i += 1) parent.push(i);

      function find(x) {
        let root = x;
        while (parent[root] !== root) root = parent[root];
        return root;
      }

      for (let i = 0; i < edges.length; i += 1) {
        const a = find(edges[i].from);
        const b = find(edges[i].to);
        if (a === b) return false;
        parent[a] = b;
      }
      return true;
    };
  }

  /** A uniform matroid: any subset of size at most k. The simplest matroid
   *  there is, and useful as the control the checker must accept. */
  function uniformOracle(k) {
    return function (elements) { return elements.length <= k; };
  }

  /** A partition matroid: at most `quota[group]` elements from each group. */
  function partitionOracle(groupOf, quotas) {
    return function (elements) {
      const counts = {};
      for (let i = 0; i < elements.length; i += 1) {
        const group = groupOf(elements[i]);
        counts[group] = (counts[group] || 0) + 1;
        if (counts[group] > (quotas[group] === undefined ? Infinity : quotas[group])) return false;
      }
      return true;
    };
  }

  /**
   * Matchings in a graph: a set of edges is independent when no two share a
   * vertex. This is hereditary and it is *not* a matroid, and the smallest
   * counter-example is a path of three edges - {middle} cannot be extended
   * from {first, last}, so the exchange property fails on four elements.
   * It exists here because "the sets look independent enough" is exactly the
   * reasoning the checker is meant to refute.
   */
  function matchingOracle() {
    return function (edges) {
      const used = new Set();
      for (let i = 0; i < edges.length; i += 1) {
        if (used.has(edges[i].from) || used.has(edges[i].to)) return false;
        used.add(edges[i].from);
        used.add(edges[i].to);
      }
      return true;
    };
  }

  /**
   * A hereditary system that is *not* a matroid: subsets of a fixed list of
   * "allowed" sets. It exists so the checker has something to reject, and so
   * the counter-example the demo shows is a real exchange violation rather
   * than a contrived error.
   */
  function allowedSetsOracle(allowed) {
    const keys = new Set(allowed.map(function (set) { return set.slice().sort().join(','); }));
    return function (elements) {
      return keys.has(elements.slice().sort().join(','));
    };
  }

  return {
    MAX_GROUND: MAX_GROUND,
    membersOf: membersOf,
    popcount: popcount,
    independentSets: independentSets,
    checkHereditary: checkHereditary,
    checkExchange: checkExchange,
    analyse: analyse,
    greedy: greedy,
    bestIndependent: bestIndependent,
    acyclicOracle: acyclicOracle,
    uniformOracle: uniformOracle,
    partitionOracle: partitionOracle,
    matchingOracle: matchingOracle,
    allowedSetsOracle: allowedSetsOracle
  };
}));
