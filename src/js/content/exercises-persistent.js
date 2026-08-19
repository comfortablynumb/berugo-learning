/**
 * Graded exercises for the persistence sections (M09.1-M09.3).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'persistence-basics': [{
      id: 'path-copying-insert',
      title: 'Path copying, and the versions it must leave alone',
      prompt: 'makeTree() must return { empty, insert, has, keys, stats }. insert(root, key) returns a *new* ' +
        'root for a binary search tree containing everything in `root` plus `key`, without modifying any node ' +
        'that `root` can reach - copy the nodes from the insertion point up to the root and share every subtree ' +
        'off that path. has(root, key) and keys(root) answer for whichever root they are given. stats() returns ' +
        '{ nodesAllocated } counted across every insert. Both halves are graded: the old roots must still be ' +
        'correct, and the allocation per insert must be a path rather than a tree.',
      entry: 'makeTree',
      starter: [
        'function makeTree() {',
        '  let nodesAllocated = 0;',
        '',
        '  function node(key) {',
        '    nodesAllocated += 1;',
        '    return { key: key, left: null, right: null };',
        '  }',
        '',
        '  return {',
        '    empty: function () { return null; },',
        '    // the ephemeral insert: correct for the newest version and destructive',
        '    insert: function (root, key) {',
        '      if (!root) return node(key);',
        '      let current = root;',
        '      for (;;) {',
        '        if (key === current.key) return root;',
        '        const side = key < current.key ? \'left\' : \'right\';',
        '        if (!current[side]) { current[side] = node(key); return root; }',
        '        current = current[side];',
        '      }',
        '    },',
        '    has: function (root, key) {',
        '      let current = root;',
        '      while (current) {',
        '        if (key === current.key) return true;',
        '        current = key < current.key ? current.left : current.right;',
        '      }',
        '      return false;',
        '    },',
        '    keys: function (root) {',
        '      const out = [];',
        '      (function walk(n) { if (!n) return; walk(n.left); out.push(n.key); walk(n.right); }(root));',
        '      return out;',
        '    },',
        '    stats: function () { return { nodesAllocated: nodesAllocated }; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeTree() {',
        '  let nodesAllocated = 0;',
        '',
        '  function node(key, left, right) {',
        '    nodesAllocated += 1;',
        '    return { key: key, left: left || null, right: right || null };',
        '  }',
        '',
        '  // one new node per level on the path, and the untouched side shared',
        '  function insert(current, key) {',
        '    if (!current) return node(key, null, null);',
        '    if (key === current.key) return current;',
        '    if (key < current.key) return node(current.key, insert(current.left, key), current.right);',
        '    return node(current.key, current.left, insert(current.right, key));',
        '  }',
        '',
        '  return {',
        '    empty: function () { return null; },',
        '    insert: insert,',
        '    has: function (root, key) {',
        '      let current = root;',
        '      while (current) {',
        '        if (key === current.key) return true;',
        '        current = key < current.key ? current.left : current.right;',
        '      }',
        '      return false;',
        '    },',
        '    keys: function (root) {',
        '      const out = [];',
        '      (function walk(n) { if (!n) return; walk(n.left); out.push(n.key); walk(n.right); }(root));',
        '      return out;',
        '    },',
        '    stats: function () { return { nodesAllocated: nodesAllocated }; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every version still answers, not just the latest',
          assert: function (makeTree, api) {
            const random = api.rng;
            const tree = makeTree();
            const roots = [tree.empty()];
            const model = [];
            const live = [];

            for (let i = 0; i < 300; i += 1) {
              const key = random.int(1000);
              roots.push(tree.insert(roots[roots.length - 1], key));
              if (live.indexOf(key) === -1) live.push(key);
              model.push(live.slice().sort(function (a, b) { return a - b; }));
            }

            for (let version = 1; version <= 300; version += 1) {
              api.assert.deepEqual(tree.keys(roots[version]), model[version - 1],
                'version ' + version + ' changed after later inserts');
            }
          }
        },
        {
          name: 'an insert allocates a path, not a tree',
          assert: function (makeTree, api) {
            const random = api.rng;
            const tree = makeTree();
            let root = tree.empty();
            for (let i = 0; i < 400; i += 1) root = tree.insert(root, random.int(4000));

            function depthOf(node) {
              if (!node) return 0;
              return 1 + Math.max(depthOf(node.left), depthOf(node.right));
            }

            const depth = depthOf(root);
            const perInsert = tree.stats().nodesAllocated / 400;
            api.assert.atMost(perInsert, depth,
              'allocated ' + perInsert.toFixed(2) + ' nodes per insert at depth ' + depth);
            api.assert.atLeast(perInsert, 2,
              'a path-copying insert has to build more than one node once the tree is deep');
          }
        },
        {
          name: 'the root you passed in is not modified',
          assert: function (makeTree, api) {
            const tree = makeTree();
            let base = tree.empty();
            [50, 25, 75, 12, 37, 62, 87].forEach(function (key) { base = tree.insert(base, key); });
            const before = tree.keys(base);

            const grown = tree.insert(base, 6);
            api.assert.deepEqual(tree.keys(base), before, 'the old root must be untouched');
            api.assert.equal(tree.has(base, 6), false, 'and must not contain the new key');
            api.assert.equal(tree.has(grown, 6), true, 'while the new root does');
            api.assert.equal(tree.keys(grown).length, before.length + 1);
          }
        },
        {
          name: 'inserting a key that is already there does not add one',
          assert: function (makeTree, api) {
            const tree = makeTree();
            let root = tree.empty();
            [5, 3, 8, 1, 4].forEach(function (key) { root = tree.insert(root, key); });

            const before = tree.stats().nodesAllocated;
            const same = tree.insert(root, 4);
            api.assert.deepEqual(tree.keys(same), [1, 3, 4, 5, 8], 'a duplicate must not appear twice');
            api.assert.deepEqual(tree.keys(root), [1, 3, 4, 5, 8]);
            api.assert.atMost(tree.stats().nodesAllocated - before, 3,
              'a duplicate insert copies the path at most, never a new leaf');
          }
        }
      ]
    }],

    'persistent-sequences': [{
      id: 'bankers-queue',
      title: 'The banker\'s queue, and the memo that makes it survive reuse',
      prompt: 'makeQueue() must return { empty, snoc, head, tail, toArray, stats }. Build a two-list queue that ' +
        'maintains |rear| ≤ |front| by rotating front ++ reverse(rear) into the front - but make that rotation a ' +
        '*memoised suspension* rather than work done at the call, using the `delay` and `force` helpers ' +
        'provided. stats() returns { steps }, counting one step per list cell walked or forced. The graded case ' +
        'is persistent reuse: one version whose next `tail` triggers a rotation, called 1 000 times. A strict ' +
        'rotation re-pays it every time; a memoised one pays it once.',
      entry: 'makeQueue',
      starter: [
        'function makeQueue() {',
        '  let steps = 0;',
        '',
        '  // provided: a suspension. force(cell) runs the thunk; a memoised',
        '  // version would remember the result and never run it twice.',
        '  function delay(thunk) { return { forced: false, value: null, thunk: thunk }; }',
        '  function eager(value) { return { forced: true, value: value, thunk: null }; }',
        '  function force(cell) { return cell.forced ? cell.value : cell.thunk(); }',
        '',
        '  const NIL = eager(null);',
        '  function cons(head, tail) { return eager({ head: head, tail: tail }); }',
        '',
        '  function toList(items) {',
        '    let list = NIL;',
        '    for (let i = items.length - 1; i >= 0; i -= 1) list = cons(items[i], list);',
        '    return list;',
        '  }',
        '',
        '  function drain(cell) {',
        '    const out = [];',
        '    let node = force(cell);',
        '    while (node) { steps += 1; out.push(node.head); node = force(node.tail); }',
        '    return out;',
        '  }',
        '',
        '  function check(queue) {',
        '    if (queue.rearLen <= queue.frontLen) return queue;',
        '    // strict rotation: correct, and re-done by every version that needs it',
        '    const items = drain(queue.front).concat(drain(queue.rear).reverse());',
        '    return { front: toList(items), rear: NIL, frontLen: items.length, rearLen: 0 };',
        '  }',
        '',
        '  return {',
        '    empty: function () { return { front: NIL, rear: NIL, frontLen: 0, rearLen: 0 }; },',
        '    snoc: function (q, value) {',
        '      return check({ front: q.front, rear: cons(value, q.rear), frontLen: q.frontLen, rearLen: q.rearLen + 1 });',
        '    },',
        '    tail: function (q) {',
        '      steps += 1;',
        '      const node = force(q.front);',
        '      return check({ front: node.tail, rear: q.rear, frontLen: q.frontLen - 1, rearLen: q.rearLen });',
        '    },',
        '    head: function (q) { const node = force(q.front); return node ? node.head : undefined; },',
        '    toArray: function (q) { return drain(q.front).concat(drain(q.rear).reverse()); },',
        '    stats: function () { return { steps: steps }; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeQueue() {',
        '  let steps = 0;',
        '',
        '  function delay(thunk) { return { forced: false, value: null, thunk: thunk }; }',
        '  function eager(value) { return { forced: true, value: value, thunk: null }; }',
        '',
        '  // the memo is the whole mechanism: the thunk runs at most once,',
        '  // however many versions come to force it',
        '  function force(cell) {',
        '    if (cell.forced) return cell.value;',
        '    cell.value = cell.thunk();',
        '    cell.forced = true;',
        '    cell.thunk = null;',
        '    return cell.value;',
        '  }',
        '',
        '  const NIL = eager(null);',
        '  function cons(head, tail) { return eager({ head: head, tail: tail }); }',
        '',
        '  function toList(items) {',
        '    let list = NIL;',
        '    for (let i = items.length - 1; i >= 0; i -= 1) list = cons(items[i], list);',
        '    return list;',
        '  }',
        '',
        '  function drain(cell) {',
        '    const out = [];',
        '    let node = force(cell);',
        '    while (node) { steps += 1; out.push(node.head); node = force(node.tail); }',
        '    return out;',
        '  }',
        '',
        '  function rotate(front, rear) {',
        '    return delay(function () {',
        '      const items = drain(front).concat(drain(rear).reverse());',
        '      return force(toList(items));',
        '    });',
        '  }',
        '',
        '  function check(queue) {',
        '    if (queue.rearLen <= queue.frontLen) return queue;',
        '    return {',
        '      front: rotate(queue.front, queue.rear), rear: NIL,',
        '      frontLen: queue.frontLen + queue.rearLen, rearLen: 0',
        '    };',
        '  }',
        '',
        '  return {',
        '    empty: function () { return { front: NIL, rear: NIL, frontLen: 0, rearLen: 0 }; },',
        '    snoc: function (q, value) {',
        '      return check({ front: q.front, rear: cons(value, q.rear), frontLen: q.frontLen, rearLen: q.rearLen + 1 });',
        '    },',
        '    tail: function (q) {',
        '      steps += 1;',
        '      const node = force(q.front);',
        '      return check({ front: node.tail, rear: q.rear, frontLen: q.frontLen - 1, rearLen: q.rearLen });',
        '    },',
        '    head: function (q) { const node = force(q.front); return node ? node.head : undefined; },',
        '    toArray: function (q) { return drain(q.front).concat(drain(q.rear).reverse()); },',
        '    stats: function () { return { steps: steps }; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'it is a FIFO queue under a mixed operation sequence',
          assert: function (makeQueue, api) {
            const random = api.rng;
            const queue = makeQueue();
            let current = queue.empty();
            const model = [];

            for (let i = 0; i < 1200; i += 1) {
              if (!model.length || random.next() < 0.6) {
                current = queue.snoc(current, i);
                model.push(i);
                continue;
              }
              api.assert.equal(queue.head(current), model[0], 'head disagreed at step ' + i);
              current = queue.tail(current);
              model.shift();
            }

            api.assert.deepEqual(queue.toArray(current), model);
          }
        },
        {
          name: 'reusing one pre-rotation version 1 000 times pays for it once',
          assert: function (makeQueue, api) {
            const queue = makeQueue();
            let current = queue.empty();
            let victim = null;

            for (let i = 0; i < 600; i += 1) {
              current = queue.snoc(current, i);
              if (current.frontLen === current.rearLen && current.frontLen >= 128) victim = current;
            }
            api.assert.ok(victim, 'the build must reach a version whose next tail rotates');

            const before = queue.stats().steps;
            for (let i = 0; i < 1000; i += 1) queue.tail(victim);
            const perReuse = (queue.stats().steps - before) / 1000;

            api.assert.atMost(perReuse, 5,
              perReuse.toFixed(2) + ' steps per reuse - the rotation is being re-paid every time');
          }
        },
        {
          name: 'the reused version keeps answering correctly',
          assert: function (makeQueue, api) {
            const queue = makeQueue();
            let current = queue.empty();
            const model = [];
            for (let i = 0; i < 200; i += 1) { current = queue.snoc(current, i); model.push(i); }

            for (let i = 0; i < 50; i += 1) {
              api.assert.equal(queue.head(current), model[0], 'head of the reused version');
              const next = queue.tail(current);
              api.assert.deepEqual(queue.toArray(next), model.slice(1),
                'tail of the reused version, attempt ' + i);
            }
            api.assert.deepEqual(queue.toArray(current), model, 'and the version itself is unchanged');
          }
        },
        {
          name: 'the invariant that bounds the rotations is maintained',
          assert: function (makeQueue, api) {
            const random = api.rng;
            const queue = makeQueue();
            let current = queue.empty();

            for (let i = 0; i < 500; i += 1) {
              current = queue.snoc(current, i);
              api.assert.atMost(current.rearLen, current.frontLen,
                'the rear grew past the front at step ' + i);
              if (random.next() < 0.3 && current.frontLen > 0) {
                current = queue.tail(current);
                api.assert.atMost(current.rearLen, current.frontLen, 'after a tail at step ' + i);
              }
            }
          }
        }
      ]
    }],

    'versioned-queries': [{
      id: 'persistent-segment-tree',
      title: 'A segment tree where every version stays queryable',
      prompt: 'makeSegmentTree(values) must return { root, update, rangeSum, stats }. root() is version 0 over ' +
        '`values`. update(root, index, value) returns a *new* root with one element replaced, rebuilding only ' +
        'the root-to-leaf path and sharing every sibling subtree. rangeSum(root, from, to) is the inclusive sum ' +
        'for whichever root it is given. stats() returns { nodesAllocated } across every update. Both are ' +
        'graded: an update must allocate exactly one path, and every historical root must still answer.',
      entry: 'makeSegmentTree',
      starter: [
        'function makeSegmentTree(values) {',
        '  const n = Math.max(1, values.length);',
        '  let nodesAllocated = 0;',
        '',
        '  function node(sum, left, right) {',
        '    nodesAllocated += 1;',
        '    return { sum: sum, left: left || null, right: right || null };',
        '  }',
        '',
        '  function build(lo, hi) {',
        '    if (lo === hi) return node(values[lo] || 0, null, null);',
        '    const mid = (lo + hi) >> 1;',
        '    const left = build(lo, mid);',
        '    const right = build(mid + 1, hi);',
        '    return node(left.sum + right.sum, left, right);',
        '  }',
        '',
        '  const first = build(0, n - 1);',
        '',
        '  // rebuilds the whole tree on every update: correct, and not sharing',
        '  function rebuild(current, lo, hi, index, value) {',
        '    if (lo === hi) return node(lo === index ? value : current.sum, null, null);',
        '    const mid = (lo + hi) >> 1;',
        '    const left = rebuild(current.left, lo, mid, index, value);',
        '    const right = rebuild(current.right, mid + 1, hi, index, value);',
        '    return node(left.sum + right.sum, left, right);',
        '  }',
        '',
        '  function descend(current, lo, hi, from, to) {',
        '    if (!current || to < lo || from > hi) return 0;',
        '    if (from <= lo && hi <= to) return current.sum;',
        '    const mid = (lo + hi) >> 1;',
        '    return descend(current.left, lo, mid, from, to) + descend(current.right, mid + 1, hi, from, to);',
        '  }',
        '',
        '  return {',
        '    root: function () { return first; },',
        '    update: function (current, index, value) { return rebuild(current, 0, n - 1, index, value); },',
        '    rangeSum: function (current, from, to) { return descend(current, 0, n - 1, from, to); },',
        '    stats: function () { return { nodesAllocated: nodesAllocated }; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeSegmentTree(values) {',
        '  const n = Math.max(1, values.length);',
        '  let nodesAllocated = 0;',
        '',
        '  function node(sum, left, right) {',
        '    nodesAllocated += 1;',
        '    return { sum: sum, left: left || null, right: right || null };',
        '  }',
        '',
        '  function build(lo, hi) {',
        '    if (lo === hi) return node(values[lo] || 0, null, null);',
        '    const mid = (lo + hi) >> 1;',
        '    const left = build(lo, mid);',
        '    const right = build(mid + 1, hi);',
        '    return node(left.sum + right.sum, left, right);',
        '  }',
        '',
        '  const first = build(0, n - 1);',
        '',
        '  // one path rebuilt; the sibling on each level is shared by reference',
        '  function assign(current, lo, hi, index, value) {',
        '    if (lo === hi) return node(value, null, null);',
        '    const mid = (lo + hi) >> 1;',
        '    if (index <= mid) {',
        '      const left = assign(current.left, lo, mid, index, value);',
        '      return node(left.sum + current.right.sum, left, current.right);',
        '    }',
        '    const right = assign(current.right, mid + 1, hi, index, value);',
        '    return node(current.left.sum + right.sum, current.left, right);',
        '  }',
        '',
        '  function descend(current, lo, hi, from, to) {',
        '    if (!current || to < lo || from > hi) return 0;',
        '    if (from <= lo && hi <= to) return current.sum;',
        '    const mid = (lo + hi) >> 1;',
        '    return descend(current.left, lo, mid, from, to) + descend(current.right, mid + 1, hi, from, to);',
        '  }',
        '',
        '  return {',
        '    root: function () { return first; },',
        '    update: function (current, index, value) { return assign(current, 0, n - 1, index, value); },',
        '    rangeSum: function (current, from, to) { return descend(current, 0, n - 1, from, to); },',
        '    stats: function () { return { nodesAllocated: nodesAllocated }; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'an update rebuilds exactly one root-to-leaf path',
          assert: function (makeSegmentTree, api) {
            const random = api.rng;
            const values = [];
            for (let i = 0; i < 1024; i += 1) values.push(random.int(100));

            const tree = makeSegmentTree(values);
            const built = tree.stats().nodesAllocated;
            let root = tree.root();
            for (let i = 0; i < 200; i += 1) root = tree.update(root, random.int(1024), random.int(100));

            const perUpdate = (tree.stats().nodesAllocated - built) / 200;
            api.assert.equal(perUpdate, 11,
              'allocated ' + perUpdate + ' nodes per update; ⌈log₂ 1 024⌉ + 1 = 11');
          }
        },
        {
          name: 'every historical version still answers range sums',
          assert: function (makeSegmentTree, api) {
            const random = api.rng;
            const values = [];
            for (let i = 0; i < 256; i += 1) values.push(random.int(50));

            const tree = makeSegmentTree(values);
            const roots = [tree.root()];
            const history = [values.slice()];

            for (let i = 0; i < 200; i += 1) {
              const index = random.int(256);
              const value = random.int(50);
              roots.push(tree.update(roots[roots.length - 1], index, value));
              const next = history[history.length - 1].slice();
              next[index] = value;
              history.push(next);
            }

            for (let version = 0; version <= 200; version += 1) {
              for (let probe = 0; probe < 3; probe += 1) {
                const a = random.int(256);
                const b = random.int(256);
                const from = Math.min(a, b);
                const to = Math.max(a, b);
                let want = 0;
                for (let i = from; i <= to; i += 1) want += history[version][i];
                api.assert.equal(tree.rangeSum(roots[version], from, to), want,
                  'version ' + version + ', range [' + from + ', ' + to + ']');
              }
            }
          }
        },
        {
          name: 'the root passed to update is unchanged',
          assert: function (makeSegmentTree, api) {
            const tree = makeSegmentTree([1, 2, 3, 4, 5, 6, 7, 8]);
            const base = tree.root();
            api.assert.equal(tree.rangeSum(base, 0, 7), 36);

            const changed = tree.update(base, 3, 100);
            api.assert.equal(tree.rangeSum(base, 0, 7), 36, 'the old version must not move');
            api.assert.equal(tree.rangeSum(changed, 0, 7), 132);
            api.assert.equal(tree.rangeSum(base, 3, 3), 4);
            api.assert.equal(tree.rangeSum(changed, 3, 3), 100);
          }
        },
        {
          name: 'keeping the history is cheap, which is the point',
          assert: function (makeSegmentTree, api) {
            const random = api.rng;
            const values = [];
            for (let i = 0; i < 512; i += 1) values.push(1);

            const tree = makeSegmentTree(values);
            let root = tree.root();
            for (let i = 0; i < 500; i += 1) root = tree.update(root, random.int(512), random.int(10));

            const total = tree.stats().nodesAllocated;
            const copyingEveryVersion = 501 * (2 * 512 - 1);
            api.assert.atMost(total, copyingEveryVersion / 50,
              'allocated ' + total + ' nodes; copying every version would be ' + copyingEveryVersion);
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
