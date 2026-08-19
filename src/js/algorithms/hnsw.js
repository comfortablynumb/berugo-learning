/**
 * HNSW - a hierarchical navigable small-world graph, and the index behind most
 * vector databases shipping today.
 *
 * The idea is a skip list in metric space. Every vector is a node in a
 * proximity graph at layer 0; a geometrically thinning subset also appears at
 * layer 1, a subset of those at layer 2, and so on. A search enters at the top
 * layer, walks greedily to the local minimum there, drops a layer with that
 * node as the entry point, and repeats. The upper layers are the long-range
 * links that stop a greedy walk taking O(n) hops across the graph, exactly as
 * a skip list's upper levels do over a sorted list.
 *
 * Two parameters, and they do different jobs:
 *   M   connections per node per layer - a build-time decision, fixed in the
 *       index, and the one that costs memory
 *   ef  the size of the candidate list during a search - a query-time dial,
 *       changeable per request, and the one that trades latency for recall
 *
 * The neighbour-selection heuristic is what makes the graph navigable rather
 * than merely dense: a candidate is kept only if it is closer to the new node
 * than to any neighbour already kept, which throws away links into a cluster
 * that is already reachable and keeps the ones that bridge to somewhere new.
 * Taking the M nearest instead builds a graph with the same degree that a
 * greedy walk gets stuck in - the difference is measured in the demo.
 */
(function (root, factory) {
  const api = factory(root, typeof require === 'function' ? require : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Hnsw = api;
}(typeof window !== 'undefined' ? window : null, function (scope, requireFn) {
  'use strict';

  function randomLib() {
    if (scope && scope.Random) return scope.Random;
    return requireFn ? requireFn('../utils/random.js') : null;
  }

  function emptyStats() {
    return { queries: 0, distanceComputations: 0, hops: 0, layersDescended: 0 };
  }

  function distanceSquared(a, b) {
    let total = 0;
    for (let i = 0; i < a.length; i += 1) {
      const d = a[i] - b[i];
      total += d * d;
    }
    return total;
  }

  /** Ascending-by-distance insert. ef is in the tens, so the memmove costs
   *  less than the branch-heavy heap it replaces. */
  function insertSorted(list, entry) {
    let at = list.length;
    while (at > 0 && list[at - 1].distance > entry.distance) at -= 1;
    list.splice(at, 0, entry);
    return list;
  }

  function build(vectors, options) {
    const settings = options || {};
    const M = Math.max(2, Math.floor(settings.M || 8));
    const M0 = M * 2;
    const efConstruction = Math.max(M, Math.floor(settings.efConstruction || 32));
    const heuristic = settings.select !== 'nearest';
    const levelScale = 1 / Math.log(M);
    const random = randomLib().seeded(settings.seed || 1);
    const nodes = [];
    let entryPoint = -1;
    let topLayer = -1;
    let stats = emptyStats();
    const counters = { linkOperations: 0, prunes: 0 };

    function randomLevel() {
      return Math.floor(-Math.log(Math.max(random.next(), 1e-12)) * levelScale);
    }

    function distanceTo(index, query) {
      stats.distanceComputations += 1;
      return distanceSquared(nodes[index].v, query);
    }

    function neighboursAt(index, layer) {
      return nodes[index].links[layer] || [];
    }

    /** The one primitive both build and search use: a best-first walk of one
     *  layer, keeping the `ef` closest seen. ef = 1 is plain greedy descent. */
    function searchLayer(query, entries, request) {
      const visited = new Set(entries);
      const candidates = [];
      const results = [];

      entries.forEach(function (index) {
        const entry = { index: index, distance: distanceTo(index, query) };
        insertSorted(candidates, entry);
        insertSorted(results, entry);
      });

      while (candidates.length) {
        const nearest = candidates.shift();
        if (results.length >= request.ef && nearest.distance > results[results.length - 1].distance) break;
        stats.hops += 1;
        expand(nearest, query, { layer: request.layer, ef: request.ef, visited: visited, candidates: candidates, results: results });
      }

      return results.slice(0, request.ef);
    }

    function expand(from, query, state) {
      const links = neighboursAt(from.index, state.layer);
      for (let i = 0; i < links.length; i += 1) {
        const index = links[i];
        if (state.visited.has(index)) continue;
        state.visited.add(index);
        const distance = distanceTo(index, query);
        const worst = state.results.length ? state.results[state.results.length - 1].distance : Infinity;
        if (state.results.length >= state.ef && distance >= worst) continue;
        insertSorted(state.candidates, { index: index, distance: distance });
        insertSorted(state.results, { index: index, distance: distance });
        if (state.results.length > state.ef) state.results.pop();
      }
    }

    /** Malkov's neighbour heuristic - see the module header. */
    function select(candidates, wanted) {
      if (!heuristic) return candidates.slice(0, wanted);
      const kept = [];
      for (let i = 0; i < candidates.length && kept.length < wanted; i += 1) {
        const candidate = candidates[i];
        let dominated = false;
        for (let j = 0; j < kept.length; j += 1) {
          stats.distanceComputations += 1;
          if (distanceSquared(nodes[candidate.index].v, nodes[kept[j].index].v) < candidate.distance) {
            dominated = true;
            break;
          }
        }
        if (!dominated) kept.push(candidate);
      }
      /* If the heuristic rejected almost everything, fill back up from the
         nearest rejects: a node with one link is a dead end, and an index that
         builds dead ends has recall that collapses without warning. */
      for (let i = 0; i < candidates.length && kept.length < wanted; i += 1) {
        if (kept.indexOf(candidates[i]) === -1) kept.push(candidates[i]);
      }
      return kept;
    }

    function connect(index, chosen, layer) {
      const limit = layer === 0 ? M0 : M;
      nodes[index].links[layer] = chosen.map(function (entry) { return entry.index; });
      counters.linkOperations += chosen.length;

      chosen.forEach(function (entry) {
        const list = neighboursAt(entry.index, layer).slice();
        if (list.indexOf(index) === -1) list.push(index);
        if (list.length <= limit) { nodes[entry.index].links[layer] = list; return; }
        counters.prunes += 1;
        const scored = list.map(function (other) {
          return { index: other, distance: distanceTo(other, nodes[entry.index].v) };
        }).sort(function (a, b) { return a.distance - b.distance; });
        nodes[entry.index].links[layer] = select(scored, limit).map(function (item) { return item.index; });
      });
    }

    function add(vector) {
      const level = randomLevel();
      const index = nodes.length;
      nodes.push({ id: vector.id, v: vector.v, level: level, links: [] });
      for (let layer = 0; layer <= level; layer += 1) nodes[index].links[layer] = [];

      if (entryPoint === -1) { entryPoint = index; topLayer = level; return index; }

      let entries = [entryPoint];
      for (let layer = topLayer; layer > level; layer -= 1) {
        entries = searchLayer(vector.v, entries, { layer: layer, ef: 1 }).map(pluck);
      }

      for (let layer = Math.min(topLayer, level); layer >= 0; layer -= 1) {
        const found = searchLayer(vector.v, entries, { layer: layer, ef: efConstruction });
        connect(index, select(found, layer === 0 ? M0 : M), layer);
        entries = found.map(pluck);
      }

      if (level > topLayer) { topLayer = level; entryPoint = index; }
      return index;
    }

    function pluck(entry) { return entry.index; }

    vectors.forEach(add);

    /* --------------------------------------------------------- searching */

    function search(query, k, ef) {
      const beam = Math.max(k || 1, Math.floor(ef || 32));
      stats.queries += 1;
      if (entryPoint === -1) return [];

      let entries = [entryPoint];
      for (let layer = topLayer; layer > 0; layer -= 1) {
        entries = searchLayer(query, entries, { layer: layer, ef: 1 }).map(pluck);
        stats.layersDescended += 1;
      }

      return searchLayer(query, entries, { layer: 0, ef: beam })
        .slice(0, Math.max(1, k || 1))
        .map(function (entry) { return { id: nodes[entry.index].id, distance: entry.distance }; });
    }

    /** The descent, layer by layer, for the animation: which node the walk
     *  entered each layer at and which it left it at. */
    function descentPath(query) {
      const out = [];
      if (entryPoint === -1) return out;
      let entries = [entryPoint];

      for (let layer = topLayer; layer >= 0; layer -= 1) {
        const found = searchLayer(query, entries, { layer: layer, ef: layer === 0 ? 8 : 1 });
        out.push({
          layer: layer,
          from: nodes[entries[0]].id,
          to: nodes[found[0].index].id,
          distance: Math.sqrt(found[0].distance),
          members: layerMembers(layer).length
        });
        entries = found.map(pluck);
      }

      return out;
    }

    function layerMembers(layer) {
      const out = [];
      nodes.forEach(function (node, index) { if (node.level >= layer) out.push(index); });
      return out;
    }

    /** The graph at one layer, as ids, for drawing it. */
    function graph(layer) {
      return layerMembers(layer).map(function (index) {
        return {
          id: nodes[index].id,
          v: nodes[index].v,
          links: neighboursAt(index, layer).map(function (other) { return nodes[other].id; })
        };
      });
    }

    function shape() {
      const perLayer = [];
      for (let layer = 0; layer <= topLayer; layer += 1) {
        const members = layerMembers(layer);
        const degrees = members.map(function (index) { return neighboursAt(index, layer).length; });
        perLayer.push({
          layer: layer,
          nodes: members.length,
          meanDegree: degrees.length ? degrees.reduce(function (a, b) { return a + b; }, 0) / degrees.length : 0,
          maxDegree: degrees.length ? Math.max.apply(null, degrees) : 0,
          orphans: degrees.filter(function (degree) { return degree === 0; }).length
        });
      }

      const links = perLayer.reduce(function (total, row) { return total + row.nodes * row.meanDegree; }, 0);
      const dims = nodes.length ? nodes[0].v.length : 0;
      return {
        nodes: nodes.length,
        layers: topLayer + 1,
        perLayer: perLayer,
        links: Math.round(links),
        M: M,
        efConstruction: efConstruction,
        select: heuristic ? 'heuristic' : 'nearest',
        linkOperations: counters.linkOperations,
        prunes: counters.prunes,
        bytes: nodes.length * dims * 8 + Math.round(links) * 4
      };
    }

    /** Every node must be reachable from the entry point at layer 0, or its
     *  vectors are in the index and can never be returned. */
    function checkInvariants() {
      const problems = [];
      const seen = new Set();
      const stack = entryPoint === -1 ? [] : [entryPoint];

      while (stack.length) {
        const index = stack.pop();
        if (seen.has(index)) continue;
        seen.add(index);
        neighboursAt(index, 0).forEach(function (other) { stack.push(other); });
      }

      if (seen.size !== nodes.length) {
        problems.push((nodes.length - seen.size) + ' of ' + nodes.length + ' nodes unreachable at layer 0');
      }
      nodes.forEach(function (node, index) {
        if (node.level > topLayer) problems.push('node ' + index + ' claims a layer above the entry point');
      });

      return { ok: !problems.length, problems: problems, reachable: seen.size };
    }

    /* The shared index interface, assembled in its own function so the factory
       body stays under the size limit and readable. */
    function handle() {
      return {
        kind: 'hnsw',
        search: search,
        descentPath: descentPath,
        graph: graph,
        shape: shape,
        checkInvariants: checkInvariants,
        bytes: function () { return shape().bytes; },
        size: function () { return nodes.length; },
        stats: function () { return Object.assign({}, stats); },
        resetStats: function () { stats = emptyStats(); }
      };
    }

    return handle();
  }

  return { build: build, distanceSquared: distanceSquared };
}));
