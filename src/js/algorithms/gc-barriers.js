/**
 * Write barriers, remembered sets and card tables.
 *
 * A barrier is a few instructions the compiler inserts on every pointer
 * store, and the reason each exists is a specific object that would otherwise
 * be freed while something still points at it. There are two entirely
 * different jobs here and they are easy to confuse:
 *
 * - a **generational** barrier records old-to-young pointers, so a nursery
 *   collection knows about references from a generation it is not tracing.
 *   Miss one and a live young object is collected;
 * - a **concurrent** barrier maintains a tri-colour invariant while the
 *   program mutates, so marking can be interrupted. Miss one and a live
 *   object of any age is collected. That is 31.5's subject and its barriers
 *   are in `gc-incremental.js`.
 *
 * The precision dial is the interesting part of the first. A remembered set
 * stores exactly which objects to rescan and costs a set insertion per store;
 * a card table marks a fixed-size region of the heap dirty with one byte
 * write and costs a scan of everything in that region. Neither is right — the
 * card size is a knob, and the demo sweeps it.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GcBarriers = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const KINDS = [
    { id: 'none', name: 'no barrier', cost: 0,
      about: 'the fastest store, and the one that loses a live object' },
    { id: 'remembered', name: 'remembered set', cost: 3,
      about: 'record the exact object; precise, and a set insertion per store' },
    { id: 'card', name: 'card table', cost: 1,
      about: 'mark a region dirty with one byte; cheap, and rescans the whole card' }
  ];

  function create(options) {
    const settings = options || {};

    return { kind: settings.kind || 'card',
      cardBytes: settings.cardBytes === undefined ? 128 : settings.cardBytes,
      promoteAfter: settings.promoteAfter === undefined ? 2 : settings.promoteAfter,
      remembered: new Set(), cards: new Set(),
      stores: 0, filtered: 0, recorded: 0, refreshed: 0, cost: 0 };
  }

  function costOf(kind) {
    const row = KINDS.find(function (entry) { return entry.id === kind; });

    return row ? row.cost : 0;
  }

  /* --------------------------------------------------------- the fast path */

  /**
   * Most stores do not need recording, and the check that says so is the
   * barrier's fast path: an old object pointing at another old object is not
   * an inter-generational reference, and neither is anything stored into a
   * young object. Filtering those out is most of what makes a barrier
   * affordable, and the filtered count is reported because it is the
   * difference between a barrier and a tax.
   */
  function store(heap, state, event) {
    const from = heap.cells.get(event.from);
    const to = event.to === null || event.to === undefined ? null : heap.cells.get(event.to);

    state.stores += 1;
    state.cost += costOf(state.kind);
    if (state.kind === 'none') return false;
    if (!from || !to) return false;
    if (!isOld(from, state) || isOld(to, state)) { state.filtered += 1; return false; }
    record(state, from);
    return true;
  }

  function isOld(cell, state) {
    return cell.age >= state.promoteAfter;
  }

  function record(state, cell) {
    state.recorded += 1;
    if (state.kind === 'remembered') { state.remembered.add(cell.id); return; }
    state.cards.add(cardOf(cell, state));
  }

  function cardOf(cell, state) {
    return Math.floor((cell.address === undefined ? cell.id * 16 : cell.address)
      / state.cardBytes);
  }

  /* ------------------------------------------------------ the extra roots */

  /**
   * What a nursery collection has to treat as a root. With a remembered set
   * that is exactly the objects recorded; with a card table it is everything
   * in a dirty card, which is more, and the ratio between the two is the
   * imprecision the cheaper barrier bought.
   */
  function extraRoots(heap, state) {
    if (state.kind === 'none') return { roots: [], scanned: 0, precision: 1 };
    if (state.kind === 'remembered') {
      const rows = Array.from(state.remembered).filter(function (id) {
        return heap.cells.has(id);
      });

      return { roots: rows, scanned: rows.length, precision: 1 };
    }
    return cardRoots(heap, state);
  }

  function cardRoots(heap, state) {
    const rows = [];
    let scanned = 0;

    heap.cells.forEach(function (cell) {
      if (!state.cards.has(cardOf(cell, state))) return;
      scanned += 1;
      if (isOld(cell, state)) rows.push(cell.id);
    });
    const useful = rows.filter(function (id) {
      return heap.cells.get(id).refs.some(function (child) {
        const target = child === null ? null : heap.cells.get(child);

        return target && !isOld(target, state);
      });
    }).length;

    return { roots: rows, scanned: scanned,
      precision: rows.length ? useful / rows.length : 1 };
  }

  /**
   * After a nursery collection, clearing the whole record is wrong.
   *
   * An old object pointing at a young one that SURVIVED still points at a
   * young one, and no further store will happen to re-record it — so clearing
   * loses the entry and the next collection frees a live object. And an
   * object promoted during this cycle becomes an old object whose existing
   * references into the nursery were never a barrier's business until now.
   *
   * Those are the only three ways an old-to-young pointer can exist: a store
   * (the barrier), an entry that is still crossing (the scanned set), and a
   * promotion (the promoted set). All three are already in the collector's
   * hand at this moment, so re-recording costs no scan the collection had not
   * already paid for — which is the point, because a refresh that walked the
   * heap would delete the reason a card table exists.
   */
  function refresh(heap, state, scanned, promoted) {
    const seen = new Set();

    clear(state);
    if (state.kind === 'none') return 0;
    (scanned || []).concat(promoted || []).forEach(function (id) {
      const cell = heap.cells.get(id);

      if (!cell || seen.has(id) || !isOld(cell, state)) return;
      seen.add(id);
      if (!crossesToYoung(heap, cell, state)) return;
      /* Counted separately from `recorded`: one is what the program's stores
         cost and the other is what the collector re-established for free out
         of a scan it had already paid for. Adding them together would price
         the barrier at nearly twice what it charges. */
      state.refreshed += 1;
      if (state.kind === 'remembered') { state.remembered.add(cell.id); return; }
      state.cards.add(cardOf(cell, state));
    });
    return seen.size;
  }

  function crossesToYoung(heap, cell, state) {
    return cell.refs.some(function (child) {
      const target = child === null || child === undefined ? null : heap.cells.get(child);

      return Boolean(target) && !isOld(target, state);
    });
  }

  function clear(state) {
    state.remembered.clear();
    state.cards.clear();
  }

  /* ---------------------------------------------------------- measurement */

  /**
   * What each barrier costs and what it buys, on one trace. The columns to
   * read together are `cost` and `scanned`: the cheap barrier spends less at
   * every store and hands the collector more objects to look at, and which
   * wins depends entirely on the ratio of stores to collections.
   */
  function compare(replay, options) {
    return KINDS.map(function (kind) {
      const out = replay(kind.id, options);

      return { kind: kind.id, name: kind.name, about: kind.about,
        stores: out.stores, filtered: out.filtered, recorded: out.recorded,
        cost: out.cost, scanned: out.scanned, missed: out.missed,
        precision: out.precision };
    });
  }

  /**
   * The card-size sweep. A smaller card is more precise and there are more of
   * them; a larger one is cheaper to mark and drags more objects into the
   * scan. There is no right answer and the shape of the curve is the point.
   */
  function cardSweep(replay, sizes, options) {
    return sizes.map(function (bytes) {
      const out = replay('card', Object.assign({ cardBytes: bytes }, options || {}));

      return { cardBytes: bytes, recorded: out.recorded, scanned: out.scanned,
        precision: out.precision, cost: out.cost, missed: out.missed };
    });
  }

  return { KINDS: KINDS, create: create, costOf: costOf, store: store,
    isOld: isOld, extraRoots: extraRoots, clear: clear, refresh: refresh,
    crossesToYoung: crossesToYoung,
    compare: compare, cardSweep: cardSweep, cardOf: cardOf };
}));
