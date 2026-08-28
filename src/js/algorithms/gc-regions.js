/**
 * Region-based heaps, evacuation, and what "garbage first" actually means.
 *
 * A region heap cuts the heap into equal-sized pieces and collects a SUBSET
 * of them per pause. That one change buys the property every low-pause
 * collector is built around: the pause is proportional to the collection set,
 * which the collector chooses, rather than to the heap, which it does not.
 *
 * The choosing is the interesting part, and it is a scheduling problem
 * wearing a garbage-collection hat. Every region offers some garbage bytes
 * (the value of collecting it) at some copying cost (its live bytes), and the
 * pause budget is a knapsack capacity. G1's "garbage first" is the greedy
 * heuristic on that knapsack: sort by garbage per unit of copying and take
 * until the budget runs out.
 *
 * Greedy on a knapsack is not optimal, so `optimalSelection` solves the same
 * instance exactly by dynamic programming and the demo reports both. A
 * heuristic that is usually within a per cent of optimal is a good heuristic;
 * saying so requires having computed the optimum, which is why the exact
 * solver is here rather than a footnote.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GcRegions = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function create(options) {
    const settings = options || {};

    return { name: 'region evacuation',
      regionBytes: settings.regionBytes === undefined ? 256 : settings.regionBytes,
      budget: settings.budget === undefined ? 192 : settings.budget,
      policy: settings.policy || 'garbage-first',
      evacuations: 0, copied: 0, reclaimed: 0 };
  }

  /* --------------------------------------------------------- the partition */

  /**
   * Objects are laid into regions in allocation order, which is what a bump
   * allocator over a region list produces. Region membership is therefore an
   * accident of when an object was born, and that is exactly why regions age
   * coherently: a region filled during one phase of the program tends to die
   * during the next.
   */
  function partition(heap, state) {
    let region = 0;
    let used = 0;

    Array.from(heap.cells.keys()).sort(function (a, b) { return a - b; })
      .forEach(function (id) {
        const cell = heap.cells.get(id);

        if (used + cell.size > state.regionBytes && used > 0) { region += 1; used = 0; }
        cell.region = region;
        used += cell.size;
      });
    return region + 1;
  }

  /**
   * What each region is worth collecting. `live` is the copying cost, since
   * evacuation moves survivors; `garbage` is what comes back. The ratio is
   * the ranking key and the reason a region full of dead objects is collected
   * first: it returns the most memory per unit of work.
   */
  function census(heap, live) {
    const rows = new Map();

    heap.cells.forEach(function (cell) {
      if (!rows.has(cell.region)) {
        rows.set(cell.region, { region: cell.region, live: 0, garbage: 0,
          objects: 0, survivors: 0 });
      }
      const row = rows.get(cell.region);

      row.objects += 1;
      if (live.has(cell.id)) { row.live += cell.size; row.survivors += 1; return; }
      row.garbage += cell.size;
    });
    rows.forEach(function (row) {
      row.ratio = row.live ? row.garbage / row.live : Infinity;
    });
    return Array.from(rows.values()).sort(function (a, b) { return a.region - b.region; });
  }

  /* --------------------------------------------------------- the choosing */

  /**
   * Garbage first: rank by garbage per byte copied and take while the pause
   * budget lasts. An empty region costs nothing to evacuate and returns
   * everything, so it always sorts first, which is why a region-based
   * collector reclaims wholly-dead regions for free.
   */
  function garbageFirst(rows, budget) {
    const ranked = rows.slice().sort(function (a, b) {
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      return b.garbage - a.garbage;
    });

    return take(rows, ranked, budget, 'garbage-first');
  }

  /** Take the emptiest regions by copying cost, ignoring what they return. */
  function emptiestFirst(rows, budget) {
    const ranked = rows.slice().sort(function (a, b) { return a.live - b.live; });

    return take(rows, ranked, budget, 'emptiest-first');
  }

  function take(rows, ranked, budget, policy) {
    const chosen = [];
    let spent = 0;

    ranked.forEach(function (row) {
      if (spent + row.live > budget) return;
      chosen.push(row.region);
      spent += row.live;
    });
    return summarise(rows, chosen, spent, policy);
  }

  /**
   * The exact answer, by dynamic programming over the copying budget. This is
   * a 0/1 knapsack: each region is an item with weight `live` and value
   * `garbage`, and the budget is the capacity. It exists so the heuristic can
   * be reported as a gap from the optimum rather than asserted to be good.
   */
  function optimalSelection(rows, budget) {
    const items = rows.filter(function (row) { return row.live <= budget; });
    const table = knapsack(items, budget);
    const chosen = recover(items, table, budget);
    const spent = chosen.reduce(function (sum, region) {
      return sum + rows.find(function (row) { return row.region === region; }).live;
    }, 0);

    return summarise(rows, chosen, spent, 'optimal');
  }

  function knapsack(items, budget) {
    const table = [new Array(budget + 1).fill(0)];

    items.forEach(function (item, at) {
      const previous = table[at];
      const next = previous.slice();

      for (let cap = item.live; cap <= budget; cap += 1) {
        next[cap] = Math.max(previous[cap], previous[cap - item.live] + item.garbage);
      }
      table.push(next);
    });
    return table;
  }

  function recover(items, table, budget) {
    const chosen = [];
    let cap = budget;

    for (let at = items.length; at > 0; at -= 1) {
      if (table[at][cap] === table[at - 1][cap]) continue;
      chosen.push(items[at - 1].region);
      cap -= items[at - 1].live;
    }
    return chosen.sort(function (a, b) { return a - b; });
  }

  function summarise(rows, chosen, spent, policy) {
    const set = new Set(chosen);
    const picked = rows.filter(function (row) { return set.has(row.region); });

    return { policy: policy, regions: chosen.slice().sort(function (a, b) { return a - b; }),
      copied: spent,
      reclaimed: picked.reduce(function (sum, row) { return sum + row.garbage; }, 0),
      survivors: picked.reduce(function (sum, row) { return sum + row.survivors; }, 0) };
  }

  const POLICIES = [
    { id: 'garbage-first', name: 'garbage first', pick: garbageFirst,
      about: 'rank by garbage per byte copied, which is what G1 does' },
    { id: 'emptiest-first', name: 'emptiest first', pick: emptiestFirst,
      about: 'take the cheapest regions to evacuate, whatever they return' },
    { id: 'optimal', name: 'exact optimum', pick: optimalSelection,
      about: 'knapsack by dynamic programming; the yardstick, not a policy' }
  ];

  function select(rows, budget, policy) {
    const row = POLICIES.find(function (entry) { return entry.id === policy; });

    return (row ? row.pick : garbageFirst)(rows, budget);
  }

  /**
   * How far the heuristic is from the best possible choice on this heap.
   * Reported as a percentage of the optimum's reclaimed bytes, because the
   * absolute gap means nothing without the denominator.
   */
  function gap(rows, budget, policy) {
    const best = optimalSelection(rows, budget);
    const got = select(rows, budget, policy || 'garbage-first');

    return { policy: got.policy, reclaimed: got.reclaimed, optimal: best.reclaimed,
      copied: got.copied, optimalCopied: best.copied,
      shortfall: best.reclaimed - got.reclaimed,
      ratio: best.reclaimed ? got.reclaimed / best.reclaimed : 1 };
  }

  /**
   * The region set on which garbage-first is NOT optimal, and why one has to
   * be constructed by hand.
   *
   * On a real heap the greedy choice is within a tenth of a per cent of the
   * knapsack optimum, because most regions are wholly dead and taking them
   * costs nothing — so a comparison against the optimum on real data says
   * "the heuristic is fine" and demonstrates nothing about the heuristic.
   * This is the shape where it loses: one region with the best ratio and a
   * live set large enough that taking it excludes two regions that together
   * return more. The optimum here is the exact knapsack answer, not an
   * estimate, so the ratio has a denominator that has been computed rather
   * than assumed.
   */
  function adversarial() {
    return [
      { region: 0, live: 60, garbage: 61, objects: 8, survivors: 4, ratio: 61 / 60 },
      { region: 1, live: 50, garbage: 50, objects: 7, survivors: 3, ratio: 1 },
      { region: 2, live: 50, garbage: 50, objects: 7, survivors: 3, ratio: 1 },
      { region: 3, live: 30, garbage: 12, objects: 5, survivors: 3, ratio: 0.4 }
    ];
  }

  /* ------------------------------------------------------------ the pause */

  /**
   * Evacuate the collection set: copy the survivors out, then free the whole
   * region. Pointers into an evacuated region have to be found and updated,
   * and the per-region remembered set is what makes that possible without
   * scanning the heap, which is the entire reason regions carry one.
   */
  function evacuate(heap, state, chosen, live) {
    const set = new Set(chosen);
    const moved = [];
    const freed = [];

    heap.cells.forEach(function (cell, id) {
      if (!set.has(cell.region)) return;
      if (live.has(id)) { moved.push(id); return; }
      freed.push(id);
    });
    const copied = moved.reduce(function (sum, id) {
      return sum + heap.cells.get(id).size;
    }, 0);
    const returned = freed.reduce(function (sum, id) {
      return sum + heap.cells.get(id).size;
    }, 0);

    freed.forEach(function (id) { drop(heap, id); });
    moved.forEach(function (id) { heap.cells.get(id).region = -1; });
    state.evacuations += 1;
    state.copied += copied;
    state.reclaimed += returned;
    return { moved: moved, freed: freed, copied: copied, reclaimed: returned,
      work: moved.length + freed.length };
  }

  function drop(heap, id) {
    const cell = heap.cells.get(id);

    if (!cell) return;
    heap.cells.delete(id);
    heap.bytes -= cell.size;
    heap.freed += cell.size;
  }

  /**
   * The per-region remembered set: for each region, which objects OUTSIDE it
   * point into it. Evacuating a region needs exactly these to fix pointers,
   * and their total size is the memory overhead a region collector pays for
   * being able to collect a subset of the heap.
   */
  function remembered(heap) {
    const sets = new Map();

    heap.cells.forEach(function (cell) {
      cell.refs.forEach(function (child) {
        const target = child === null || child === undefined
          ? null : heap.cells.get(child);

        if (!target || target.region === cell.region) return;
        if (!sets.has(target.region)) sets.set(target.region, new Set());
        sets.get(target.region).add(cell.id);
      });
    });
    return sets;
  }

  function rememberedCost(sets, wordBytes) {
    let entries = 0;

    sets.forEach(function (holders) { entries += holders.size; });
    return { entries: entries, bytes: entries * (wordBytes || 8) };
  }

  return { create: create, partition: partition, census: census,
    garbageFirst: garbageFirst, emptiestFirst: emptiestFirst,
    optimalSelection: optimalSelection, select: select, gap: gap,
    POLICIES: POLICIES, evacuate: evacuate, adversarial: adversarial,
    remembered: remembered, rememberedCost: rememberedCost };
}));
