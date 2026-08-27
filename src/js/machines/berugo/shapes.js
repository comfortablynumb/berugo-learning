/**
 * Hidden classes and inline caches: why "initialise every field in the
 * constructor, in the same order" is not folklore.
 *
 * A record in a dynamic language is a map from names to values, and reading a
 * field is a hash lookup — unless the runtime notices that most objects at a
 * given point have the same set of fields in the same order. That set is a
 * **shape**, shapes form a **transition tree** as fields are added, and a
 * property access can then be a bounds-checked array index behind a one-word
 * guard. That is the whole trick, and everything else here is the accounting.
 *
 * The accounting matters because the failure mode is invisible: adding the
 * same two fields in two orders produces two shapes, a site that reads from
 * both goes polymorphic, and the program is correct and slower. Nothing warns
 * you. The cost model below is stated in units rather than nanoseconds — a
 * cache hit is 1, a miss is a scan proportional to the field count — so the
 * ratios are honest even though the absolute numbers are made up.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Shapes = api;
  }
}(this, function () {
  'use strict';

  /** A hit is one guard; a miss walks the fields; a transition allocates. */
  const COST = { hit: 1, guard: 1, scan: 1, transition: 4, dictionary: 2 };

  const POLYMORPHIC_LIMIT = 4;

  /* ------------------------------------------------------- the transition tree */

  function makeTree() {
    const root = { id: 0, fields: [], transitions: new Map(), depth: 0, objects: 0 };

    return { root: root, shapes: [root], transitions: 0 };
  }

  /**
   * Adding a field to a shape either follows an existing transition or makes
   * a new one. Following is what makes two objects built the same way share a
   * shape; making one is what a different order costs, and the counter is the
   * measurement the section is about.
   */
  function transition(tree, shape, name) {
    if (shape.transitions.has(name)) return shape.transitions.get(name);
    const next = { id: tree.shapes.length, fields: shape.fields.concat([name]),
      transitions: new Map(), depth: shape.depth + 1, objects: 0, from: shape.id, via: name };

    tree.shapes.push(next);
    tree.transitions += 1;
    shape.transitions.set(name, next);
    return next;
  }

  /** Build an object by adding its fields in the given order. */
  function build(tree, names) {
    let shape = tree.root;

    names.forEach(function (name) { shape = transition(tree, shape, name); });
    shape.objects += 1;
    return { shape: shape, values: names.map(function (name, at) { return at; }) };
  }

  function offsetOf(shape, name) {
    return shape.fields.indexOf(name);
  }

  /* --------------------------------------------------------- inline caches */

  /**
   * Four states, and the third and fourth are the interesting ones.
   * **Uninitialised** has seen nothing. **Monomorphic** has seen one shape and
   * is one guard away from the value. **Polymorphic** holds a few and checks
   * them in turn. **Megamorphic** has given up and does the dictionary lookup
   * every time — and giving up is a decision, because a cache that keeps
   * growing costs more to check than the lookup it replaces.
   */
  function makeCache(site) {
    return { site: site, entries: [], hits: 0, misses: 0, cost: 0,
      state: 'uninitialised', megamorphic: false, checks: 0 };
  }

  function lookup(cache, shape, name) {
    if (cache.megamorphic) return dictionaryPath(cache, shape, name);
    const at = cache.entries.findIndex(function (entry) { return entry.shape === shape.id; });

    if (at !== -1) return hitPath(cache, at);
    return missPath(cache, shape, name);
  }

  function hitPath(cache, at) {
    cache.hits += 1;
    cache.checks += at + 1;
    cache.cost += COST.guard * (at + 1);
    return { offset: cache.entries[at].offset, hit: true, state: cache.state };
  }

  function missPath(cache, shape, name) {
    const offset = offsetOf(shape, name);

    cache.misses += 1;
    cache.cost += COST.scan * Math.max(shape.fields.length, 1);
    cache.entries.push({ shape: shape.id, offset: offset });
    cache.state = cache.entries.length === 1 ? 'monomorphic' : 'polymorphic';
    if (cache.entries.length > POLYMORPHIC_LIMIT) {
      cache.megamorphic = true;
      cache.state = 'megamorphic';
      cache.entries = [];
    }
    return { offset: offset, hit: false, state: cache.state };
  }

  function dictionaryPath(cache, shape, name) {
    cache.misses += 1;
    cache.cost += COST.dictionary * Math.max(shape.fields.length, 1);
    return { offset: offsetOf(shape, name), hit: false, state: 'megamorphic' };
  }

  /* ---------------------------------------------------------------- studies */

  /**
   * The headline demonstration: the same two field names, built in two
   * orders, read from one site. Nothing about the program changes and the
   * site goes from monomorphic to polymorphic, which is the cost the advice
   * is about.
   */
  function orderStudy(options) {
    const settings = options || {};
    const names = settings.names || ['x', 'y', 'z'];
    const count = settings.count || 1000;

    return [{ id: 'one order', orders: [names] },
      { id: 'two orders', orders: [names, names.slice().reverse()] },
      { id: 'every order', orders: permutations(names) }]
      .map(function (row) { return runStudy(row, names[0], count); });
  }

  function runStudy(row, read, count) {
    const tree = makeTree();
    const cache = makeCache(read);
    const objects = [];

    for (let at = 0; at < count; at += 1) {
      objects.push(build(tree, row.orders[at % row.orders.length]));
    }
    objects.forEach(function (object) { lookup(cache, object.shape, read); });
    return { id: row.id, orders: row.orders.length, shapes: tree.shapes.length,
      transitions: tree.transitions, state: cache.state, hits: cache.hits,
      misses: cache.misses, cost: cache.cost,
      perAccess: Number((cache.cost / count).toFixed(2)),
      checks: Number((cache.checks / Math.max(cache.hits, 1)).toFixed(2)) };
  }

  function permutations(names) {
    if (names.length <= 1) return [names.slice()];
    const out = [];

    names.forEach(function (name, at) {
      const rest = names.slice(0, at).concat(names.slice(at + 1));

      permutations(rest).forEach(function (tail) { out.push([name].concat(tail)); });
    });
    return out;
  }

  /**
   * The cache-state sweep: how per-access cost moves as a site sees one, two,
   * four, five and ten shapes. The step between four and five is the
   * polymorphic limit, and it is the only discontinuity in the table — which
   * is why "one more type at this call site" can be a cliff rather than a
   * gradient.
   */
  function stateSweep(counts, options) {
    const settings = options || {};
    const accesses = settings.accesses || 2000;

    return counts.map(function (shapes) {
      const tree = makeTree();
      const cache = makeCache('x');
      const built = [];

      for (let at = 0; at < shapes; at += 1) built.push(build(tree, fieldsFor(at)));
      for (let at = 0; at < accesses; at += 1) {
        lookup(cache, built[at % built.length].shape, 'x');
      }
      return { shapes: shapes, state: cache.state, hits: cache.hits, misses: cache.misses,
        cost: cache.cost, perAccess: Number((cache.cost / accesses).toFixed(2)) };
    });
  }

  /** Distinct shapes that all carry `x`, so the site is about shape and not name. */
  function fieldsFor(index) {
    const out = ['x'];

    for (let at = 0; at <= index; at += 1) out.push('f' + at);
    return out;
  }

  /* --------------------------------------------------- shapes from a program */

  /**
   * The shapes a real Berugo program builds, taken from the field-name lists
   * its `makeRecord` instructions carry. That is the honest bridge between
   * the model above and the language: the ORDER in the IR is the order the
   * source wrote, so a program that writes `{x, y}` in one place and
   * `{y, x}` in another really does get two shapes.
   */
  function fromProgram(program, ir) {
    const tree = makeTree();
    const sites = [];

    program.functions.forEach(function (fn) {
      ir.eachInstruction(fn, function (inst, block) {
        if (inst.op !== 'makeRecord') return;
        const object = build(tree, inst.fields.slice());

        sites.push({ fn: fn.name, block: block.id, fields: inst.fields.join(', '),
          shape: object.shape.id, depth: object.shape.depth });
      });
    });
    return { tree: tree, sites: sites, shapes: tree.shapes.length,
      transitions: tree.transitions };
  }

  /** Every shape in the tree, as a table with its parent and the field added. */
  function rows(tree) {
    return tree.shapes.map(function (shape) {
      return { id: shape.id, depth: shape.depth, fields: shape.fields.join(', ') || '—',
        from: shape.from === undefined ? '—' : String(shape.from),
        via: shape.via || '—', objects: shape.objects,
        transitions: shape.transitions.size };
    });
  }

  return {
    COST: COST, POLYMORPHIC_LIMIT: POLYMORPHIC_LIMIT,
    makeTree: makeTree, transition: transition, build: build, offsetOf: offsetOf,
    makeCache: makeCache, lookup: lookup,
    orderStudy: orderStudy, stateSweep: stateSweep, permutations: permutations,
    fromProgram: fromProgram, rows: rows
  };
}));
