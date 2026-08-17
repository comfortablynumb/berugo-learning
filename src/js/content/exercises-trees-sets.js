/** Graded exercises for skip lists and disjoint set union (M04.9-M04.10). */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'skip-lists': [{
      id: 'skip-insert',
      title: 'The update vector, and the splice that uses it',
      prompt: 'A node is { key, value, forward } where forward is an array of one pointer per level. ' +
        'Export skipList as a function returning { insert, search }. Both start the same way: walk ' +
        'from the top level, move forward while the next key is smaller, and drop a level when it is ' +
        'not — recording the last node visited on each level. That record is the update vector, and ' +
        'insert splices the new node into exactly the levels it was promoted to. api.rng gives you ' +
        'the coin: rng.next() < p promotes.',
      entry: 'skipList',
      starter: [
        'function skipList(options) {',
        '  const p = options.p;',
        '  const maxLevel = options.maxLevel;',
        '  const rng = options.rng;',
        '  const head = { key: null, value: null, forward: new Array(maxLevel).fill(null) };',
        '  let levels = 1;',
        '',
        '  function randomLevel() {',
        '    let level = 1;',
        '    while (level < maxLevel && rng.next() < p) level += 1;',
        '    return level;',
        '  }',
        '',
        '  function findUpdate(key) {',
        '    const update = new Array(maxLevel).fill(head);',
        '    // walk down from the top level, recording the last node on each',
        '    return { update: update, next: head.forward[0] };',
        '  }',
        '',
        '  function insert(key, value) {',
        '    const found = findUpdate(key);',
        '    // splice a new node into levels 0 .. randomLevel() - 1',
        '    return true;',
        '  }',
        '',
        '  function search(key) {',
        '    const found = findUpdate(key);',
        '    return found.next && found.next.key === key ? found.next.value : undefined;',
        '  }',
        '',
        '  return { insert: insert, search: search };',
        '}'
      ].join('\n'),
      solution: [
        'function skipList(options) {',
        '  const p = options.p;',
        '  const maxLevel = options.maxLevel;',
        '  const rng = options.rng;',
        '  const head = { key: null, value: null, forward: new Array(maxLevel).fill(null) };',
        '  let levels = 1;',
        '',
        '  function randomLevel() {',
        '    let level = 1;',
        '    while (level < maxLevel && rng.next() < p) level += 1;',
        '    return level;',
        '  }',
        '',
        '  function findUpdate(key) {',
        '    const update = new Array(maxLevel).fill(head);',
        '    let node = head;',
        '    for (let level = levels - 1; level >= 0; level -= 1) {',
        '      while (node.forward[level] && node.forward[level].key < key) node = node.forward[level];',
        '      update[level] = node;',
        '    }',
        '    return { update: update, next: node.forward[0] };',
        '  }',
        '',
        '  function insert(key, value) {',
        '    const found = findUpdate(key);',
        '    if (found.next && found.next.key === key) { found.next.value = value; return false; }',
        '',
        '    const level = randomLevel();',
        '    if (level > levels) levels = level;',
        '',
        '    const node = { key: key, value: value, forward: new Array(level).fill(null) };',
        '    for (let i = 0; i < level; i += 1) {',
        '      node.forward[i] = found.update[i].forward[i] || null;',
        '      found.update[i].forward[i] = node;',
        '    }',
        '    return true;',
        '  }',
        '',
        '  function search(key) {',
        '    const found = findUpdate(key);',
        '    return found.next && found.next.key === key ? found.next.value : undefined;',
        '  }',
        '',
        '  return { insert: insert, search: search };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every inserted key is findable, and absent keys are not',
          assert: function (skipList, api) {
            const list = skipList({ p: 0.5, maxLevel: 16, rng: api.Random.seeded(3) });
            const rng = api.Random.seeded(9);
            const live = new Map();

            for (let i = 0; i < 2000; i += 1) {
              const key = rng.int(10000);
              list.insert(key, key * 2);
              live.set(key, key * 2);
            }

            live.forEach(function (value, key) {
              api.assert.equal(list.search(key), value, 'key ' + key + ' must be findable');
            });
            for (let i = 0; i < 200; i += 1) {
              const key = 20000 + i;
              api.assert.equal(list.search(key), undefined, 'absent key ' + key);
            }
          }
        },
        {
          name: 'reinserting a key updates it rather than duplicating it',
          assert: function (skipList, api) {
            const list = skipList({ p: 0.5, maxLevel: 16, rng: api.Random.seeded(4) });

            api.assert.equal(list.insert(42, 'first'), true, 'the first insert is new');
            api.assert.equal(list.insert(42, 'second'), false, 'the second is an update');
            api.assert.equal(list.search(42), 'second');
          }
        },
        {
          name: 'the express lanes are actually used — the search is not a linear walk',
          assert: function (skipList, api) {
            let comparisons = 0;
            const countingRng = api.Random.seeded(7);

            const list = skipList({ p: 0.5, maxLevel: 16, rng: countingRng });
            for (let key = 0; key < 5000; key += 1) list.insert(key, key);

            /* Count comparisons by wrapping the keys in objects whose valueOf
               is counted. A level-0-only walk costs thousands. */
            const probe = { valueOf: function () { comparisons += 1; return 4000; } };
            list.search(probe);

            api.assert.ok(comparisons < 400,
              'the search made ' + comparisons + ' comparisons for a key 4 000 nodes in; ' +
              'a level-0 walk would make about 4 000');
          }
        },
        {
          name: 'a search over an empty list is safe',
          assert: function (skipList, api) {
            const list = skipList({ p: 0.5, maxLevel: 16, rng: api.Random.seeded(1) });
            api.assert.equal(list.search(10), undefined);
            list.insert(10, 'ten');
            api.assert.equal(list.search(10), 'ten');
            api.assert.equal(list.search(5), undefined);
            api.assert.equal(list.search(15), undefined);
          }
        }
      ]
    }],

    'disjoint-sets': [{
      id: 'dsu-rank-compression',
      title: 'Union by rank, path compression, and the rollback variant',
      prompt: 'Export disjointSet as a function taking (n, options) and returning ' +
        '{ find, union, connected, components }. With options.compress true, find must apply full ' +
        'path compression; with it false, find must walk without rewriting anything and union must ' +
        'record enough to support undo(). union always attaches the lower-rank root under the ' +
        'higher, and raises the rank only when the two are equal.',
      entry: 'disjointSet',
      starter: [
        'function disjointSet(n, options) {',
        '  const compress = options.compress;',
        '  const parent = [];',
        '  const rank = [];',
        '  const journal = [];',
        '  let components = n;',
        '  for (let i = 0; i < n; i += 1) { parent[i] = i; rank[i] = 0; }',
        '',
        '  function find(x) {',
        '    // walk to the root; if compress is on, point the path at it',
        '    return x;',
        '  }',
        '',
        '  function union(a, b) {',
        '    // attach the lower rank under the higher, and journal it when not compressing',
        '    return false;',
        '  }',
        '',
        '  function undo() {',
        '    return false;',
        '  }',
        '',
        '  return {',
        '    find: find, union: union, undo: undo,',
        '    connected: function (a, b) { return find(a) === find(b); },',
        '    components: function () { return components; },',
        '    snapshot: function () { return { parent: parent.slice(), rank: rank.slice() }; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function disjointSet(n, options) {',
        '  const compress = options.compress;',
        '  const parent = [];',
        '  const rank = [];',
        '  const journal = [];',
        '  let components = n;',
        '  for (let i = 0; i < n; i += 1) { parent[i] = i; rank[i] = 0; }',
        '',
        '  function rootOf(x) {',
        '    let node = x;',
        '    while (parent[node] !== node) node = parent[node];',
        '    return node;',
        '  }',
        '',
        '  function find(x) {',
        '    const top = rootOf(x);',
        '    if (!compress) return top;',
        '    let node = x;',
        '    while (parent[node] !== top) {',
        '      const next = parent[node];',
        '      parent[node] = top;',
        '      node = next;',
        '    }',
        '    return top;',
        '  }',
        '',
        '  function union(a, b) {',
        '    const ra = find(a);',
        '    const rb = find(b);',
        '    if (ra === rb) { if (!compress) journal.push(null); return false; }',
        '',
        '    const keep = rank[ra] < rank[rb] ? rb : ra;',
        '    const attach = keep === ra ? rb : ra;',
        '',
        '    if (!compress) journal.push({ child: attach, root: keep, rank: rank[keep] });',
        '    parent[attach] = keep;',
        '    if (rank[keep] === rank[attach]) rank[keep] += 1;',
        '    components -= 1;',
        '    return true;',
        '  }',
        '',
        '  function undo() {',
        '    if (!journal.length) return false;',
        '    const entry = journal.pop();',
        '    if (!entry) return false;',
        '    parent[entry.child] = entry.child;',
        '    rank[entry.root] = entry.rank;',
        '    components += 1;',
        '    return true;',
        '  }',
        '',
        '  return {',
        '    find: find, union: union, undo: undo,',
        '    connected: function (a, b) { return find(a) === find(b); },',
        '    components: function () { return components; },',
        '    snapshot: function () { return { parent: parent.slice(), rank: rank.slice() }; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'connectivity matches a reference forest over 4 000 random unions',
          assert: function (disjointSet, api) {
            const dsu = disjointSet(2000, { compress: true });
            const rng = api.Random.seeded(9);
            const parent = [];
            for (let i = 0; i < 2000; i += 1) parent[i] = i;
            const rootOf = function (x) {
              let node = x;
              while (parent[node] !== node) node = parent[node];
              return node;
            };

            for (let i = 0; i < 4000; i += 1) {
              const a = rng.int(2000);
              const b = rng.int(2000);
              const merged = dsu.union(a, b);
              const ra = rootOf(a);
              const rb = rootOf(b);
              const expected = ra !== rb;
              if (expected) parent[ra] = rb;
              api.assert.equal(merged, expected, 'union(' + a + ', ' + b + ')');
            }

            for (let i = 0; i < 400; i += 1) {
              const a = rng.int(2000);
              const b = rng.int(2000);
              api.assert.equal(dsu.connected(a, b), rootOf(a) === rootOf(b), 'connected(' + a + ', ' + b + ')');
            }
          }
        },
        {
          name: 'union by rank keeps the forest shallow even with no compression',
          assert: function (disjointSet, api) {
            const dsu = disjointSet(4000, { compress: false });
            const rng = api.Random.seeded(11);
            for (let i = 0; i < 8000; i += 1) dsu.union(rng.int(4000), rng.int(4000));

            const snapshot = dsu.snapshot();
            let deepest = 0;
            for (let i = 0; i < 4000; i += 1) {
              let node = i;
              let hops = 0;
              while (snapshot.parent[node] !== node) { node = snapshot.parent[node]; hops += 1; }
              deepest = Math.max(deepest, hops);
            }
            api.assert.ok(deepest <= Math.log2(4000),
              'the deepest node is ' + deepest + ' hops; union by rank alone bounds it at log2(n)');
          }
        },
        {
          name: 'compression flattens the forest and the plain walk does not',
          assert: function (disjointSet, api) {
            const depths = function (dsu, n) {
              const snapshot = dsu.snapshot();
              let deepest = 0;
              for (let i = 0; i < n; i += 1) {
                let node = i;
                let hops = 0;
                while (snapshot.parent[node] !== node) { node = snapshot.parent[node]; hops += 1; }
                deepest = Math.max(deepest, hops);
              }
              return deepest;
            };

            const flat = disjointSet(2000, { compress: true });
            const plain = disjointSet(2000, { compress: false });
            const rng = api.Random.seeded(13);

            for (let i = 0; i < 4000; i += 1) {
              const a = rng.int(2000);
              const b = rng.int(2000);
              flat.union(a, b);
              plain.union(a, b);
            }
            for (let i = 0; i < 2000; i += 1) { flat.find(i); plain.find(i); }

            api.assert.ok(depths(flat, 2000) <= 1,
              'after a find on every element a compressing forest is flat, measured ' + depths(flat, 2000));
            api.assert.ok(depths(plain, 2000) > depths(flat, 2000),
              'and a non-compressing one is not');
          }
        },
        {
          name: 'undo restores the exact arrays, in reverse order',
          assert: function (disjointSet, api) {
            const dsu = disjointSet(200, { compress: false });
            const rng = api.Random.seeded(21);
            const checkpoints = [];

            for (let i = 0; i < 100; i += 1) {
              checkpoints.push(JSON.stringify(dsu.snapshot()));
              dsu.union(rng.int(200), rng.int(200));
            }
            for (let i = 99; i >= 0; i -= 1) {
              dsu.undo();
              api.assert.equal(JSON.stringify(dsu.snapshot()), checkpoints[i],
                'undo ' + i + ' must restore the exact prior parent and rank arrays');
            }
            api.assert.equal(dsu.components(), 200, 'every union has been undone');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
