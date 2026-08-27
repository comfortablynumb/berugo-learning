/**
 * Points-to analysis, and the place compilers give up first.
 *
 * Memory breaks SSA. A register has one definition and a heap location does
 * not, so `p.x` after a store through `q` is only the old value if `p` and `q`
 * cannot be the same object — and answering that is alias analysis. Every
 * load and store elimination in a real compiler is gated on it, which is why
 * `restrict`, ownership types and immutability pay off in generated code and
 * not only in reasoning: they hand the optimiser an answer it otherwise has
 * to compute badly.
 *
 * Two classic analyses are here, and the pair is the point:
 *
 * - **Andersen's** is inclusion-based. `p = q` means everything q points to, p
 *   also points to — a subset constraint, solved to a fixpoint. Precise, and
 *   cubic in the worst case.
 * - **Steensgaard's** is unification-based. `p = q` means p and q point to the
 *   SAME set, merged. Almost linear, and it loses precision the moment two
 *   unrelated pointers are ever assigned to each other, because the merge is
 *   permanent and symmetric.
 *
 * Running both on the same program and reporting the difference is the honest
 * way to teach the trade: the fast one is not approximately as good, it is
 * coarser in a way that a single example makes obvious.
 *
 * Soundness is the property that matters and the one that is checked: every
 * alias that really happens must be reported. The dynamic oracle records which
 * registers actually referred to the same object during a run, and both
 * analyses must be supersets of it. An analysis that is merely precise and
 * unsound is worse than useless, because every pass downstream trusts it.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Alias = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');

  const ALLOCATIONS = ['makeRecord', 'makeArray', 'makeClosure'];

  /** Every allocation site, which is what a pointer can point AT. */
  function sites(fn) {
    const found = [];

    Ir.eachInstruction(fn, function (inst, block) {
      if (ALLOCATIONS.indexOf(inst.op) === -1) return;
      found.push({ id: inst.target, op: inst.op, block: block.id });
    });
    return found;
  }

  /* ------------------------------------------------------------- Andersen */

  /**
   * Constraints, then a fixpoint. `x = alloc` adds the site to x; `x = y` adds
   * a subset edge from y to x; a phi adds one from each operand. The loop runs
   * until nothing grows, which terminates because the sets only ever gain
   * members from a finite pool.
   */
  function andersen(fn) {
    const points = {};
    const edges = [];

    Ir.eachInstruction(fn, function (inst) {
      collectConstraints(inst, points, edges);
    });
    const rounds = saturate(points, edges);

    return { name: 'Andersen', points: points, edges: edges.length, rounds: rounds,
      pairs: aliasPairs(points) };
  }

  function collectConstraints(inst, points, edges) {
    const target = Ir.definitionOf(inst);

    if (!target) return;
    if (ALLOCATIONS.indexOf(inst.op) !== -1) {
      points[target] = new Set([target]);
      return;
    }
    if (!points[target]) points[target] = new Set();
    if (inst.op === 'move') { edges.push({ from: inst.from, to: target }); return; }
    if (inst.op === 'phi') {
      inst.incoming.forEach(function (entry) {
        if (entry.value) edges.push({ from: entry.value, to: target });
      });
    }
  }

  function saturate(points, edges) {
    let changed = true;
    let rounds = 0;

    while (changed) {
      changed = false;
      rounds += 1;
      if (rounds > 5000) break;
      edges.forEach(function (edge) {
        if (propagate(points, edge)) changed = true;
      });
    }
    return rounds;
  }

  function propagate(points, edge) {
    const from = points[edge.from];

    if (!from) return false;
    if (!points[edge.to]) points[edge.to] = new Set();
    let grew = false;

    from.forEach(function (site) {
      if (points[edge.to].has(site)) return;
      points[edge.to].add(site);
      grew = true;
    });
    return grew;
  }

  /* ---------------------------------------------------------- Steensgaard */

  /**
   * Union-find over the same constraints. Every assignment MERGES the two
   * classes rather than adding an edge, so the relation is symmetric — which
   * is where the precision goes, and why the demo compares the pair counts
   * rather than describing the difference.
   */
  function steensgaard(fn) {
    const parent = {};
    const merges = { count: 0 };

    Ir.eachInstruction(fn, function (inst) {
      const target = Ir.definitionOf(inst);

      if (!target) return;
      find(parent, target);
      if (inst.op === 'move') { unify(parent, target, inst.from, merges); return; }
      if (inst.op !== 'phi') return;
      inst.incoming.forEach(function (entry) {
        if (entry.value) unify(parent, target, entry.value, merges);
      });
    });
    return finishSteensgaard(fn, parent, merges);
  }

  function find(parent, id) {
    if (parent[id] === undefined) parent[id] = id;
    while (parent[id] !== id) {
      parent[id] = parent[parent[id]];
      id = parent[id];
    }
    return id;
  }

  function unify(parent, a, b, merges) {
    const rootA = find(parent, a);
    const rootB = find(parent, b);

    if (rootA === rootB) return;
    parent[rootB] = rootA;
    merges.count += 1;
  }

  function finishSteensgaard(fn, parent, merges) {
    const points = {};
    const classSites = {};

    sites(fn).forEach(function (site) {
      const root = find(parent, site.id);

      if (!classSites[root]) classSites[root] = new Set();
      classSites[root].add(site.id);
    });
    Object.keys(parent).forEach(function (id) {
      points[id] = new Set(classSites[find(parent, id)] || []);
    });
    return { name: 'Steensgaard', points: points, merges: merges.count,
      classes: new Set(Object.keys(parent).map(function (id) {
        return find(parent, id);
      })).size, pairs: aliasPairs(points) };
  }

  /* ---------------------------------------------------------------- pairs */

  /** Two registers may alias when their points-to sets share a site. */
  function aliasPairs(points) {
    const names = Object.keys(points).filter(function (id) {
      return points[id] && points[id].size;
    }).sort();
    const pairs = [];

    names.forEach(function (a, at) {
      names.slice(at + 1).forEach(function (b) {
        if (!shares(points[a], points[b])) return;
        pairs.push(a + '~' + b);
      });
    });
    return pairs;
  }

  function shares(a, b) {
    let found = false;

    a.forEach(function (site) { if (b.has(site)) found = true; });
    return found;
  }

  /* --------------------------------------------------------- the oracle */

  /**
   * The dynamic alias oracle: run the program and record which registers held
   * the SAME object. Every pair it reports must be reported by both analyses,
   * or the analysis is unsound and every pass that trusted it is wrong.
   *
   * It is an under-approximation by construction — it only sees the paths this
   * input took — which is exactly the right shape for a soundness check. A
   * static analysis must be a superset of what actually happened; it may be a
   * strict superset, and the amount by which is its imprecision.
   */
  function dynamicPairs(fn, trace) {
    const byObject = new Map();

    trace.forEach(function (entry) {
      if (!entry.object || typeof entry.object !== 'object') return;
      if (!byObject.has(entry.object)) byObject.set(entry.object, new Set());
      byObject.get(entry.object).add(entry.register);
    });
    return collectPairs(byObject, fn);
  }

  function collectPairs(byObject, fn) {
    const pairs = new Set();

    byObject.forEach(function (registers) {
      const names = Array.from(registers).sort();

      names.forEach(function (a, at) {
        names.slice(at + 1).forEach(function (b) { pairs.add(a + '~' + b); });
      });
    });
    return { pairs: Array.from(pairs).sort(), objects: byObject.size, fn: fn.name };
  }

  /**
   * Soundness: every dynamic pair is in the static result. `missed` must be
   * empty; `extra` is the imprecision, and the two analyses differ almost
   * entirely in that second number.
   */
  function checkSound(staticResult, dynamic) {
    const reported = new Set(staticResult.pairs);
    const missed = dynamic.pairs.filter(function (pair) { return !reported.has(pair); });

    return { sound: missed.length === 0, missed: missed,
      reported: staticResult.pairs.length, actual: dynamic.pairs.length,
      extra: staticResult.pairs.length - (dynamic.pairs.length - missed.length) };
  }

  /* ------------------------------------------------- load/store elimination */

  /**
   * A load can be replaced by the value of an earlier store to the same field
   * of the same object when nothing in between may write it. "May write" is
   * the alias question, so this pass is exactly as good as the analysis it is
   * handed — which is what the demo measures by running it with each.
   */
  function redundantLoads(fn, analysis) {
    const found = [];

    fn.blocks.forEach(function (block) {
      scanBlock(block, analysis, found);
    });
    return found;
  }

  /**
   * Two kinds of redundancy, and the second is the commoner one. A load after
   * a STORE to the same location can read the stored value; a load after
   * another LOAD of the same location can read the first load's result. An
   * elimination that only handles the first misses most of what is available
   * — real code reads the same field twice far more often than it writes and
   * then reads it.
   */
  function scanBlock(block, analysis, found) {
    const known = new Map();

    block.instructions.forEach(function (inst) {
      if (inst.op === 'storeField') { recordStore(inst, known, analysis); return; }
      /* A call may write anything this analysis cannot see into, so every
         remembered location is invalidated. That is the conservative rule and
         it is where most of the available elimination goes. */
      if (inst.op === 'call') { known.clear(); return; }
      if (inst.op !== 'loadField') return;
      recordLoad(inst, known, block, found);
    });
  }

  function recordLoad(inst, known, block, found) {
    const key = inst.object + '.' + inst.field;

    if (known.has(key)) {
      found.push({ block: block.id, register: inst.target, from: known.get(key),
        field: inst.field, kind: known.get(key) === inst.target ? 'load' : 'available' });
      return;
    }
    known.set(key, inst.target);
  }

  function recordStore(inst, known, analysis) {
    const key = inst.object + '.' + inst.field;

    invalidateAliases(inst, known, analysis);
    known.set(key, inst.value);
  }

  /** A store through a pointer that may alias invalidates what it may reach. */
  function invalidateAliases(inst, stored, analysis) {
    const points = analysis.points[inst.object];

    Array.from(stored.keys()).forEach(function (key) {
      const other = key.split('.')[0];

      if (other === inst.object) return;
      if (!points || !analysis.points[other]) { stored.delete(key); return; }
      if (shares(points, analysis.points[other])) stored.delete(key);
    });
  }

  function compare(fn) {
    const a = andersen(fn);
    const s = steensgaard(fn);

    return { andersen: a, steensgaard: s,
      sites: sites(fn).length,
      andersenPairs: a.pairs.length, steensgaardPairs: s.pairs.length,
      lost: s.pairs.length - a.pairs.length,
      andersenLoads: redundantLoads(fn, a).length,
      steensgaardLoads: redundantLoads(fn, s).length };
  }

  return {
    ALLOCATIONS: ALLOCATIONS, sites: sites,
    andersen: andersen, steensgaard: steensgaard, aliasPairs: aliasPairs,
    dynamicPairs: dynamicPairs, checkSound: checkSound,
    redundantLoads: redundantLoads, compare: compare
  };
}));
