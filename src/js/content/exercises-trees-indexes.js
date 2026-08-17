/** Graded exercises for B-trees and augmented trees (M04.7-M04.8). */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'b-trees': [{
      id: 'btree-leaf-split',
      title: 'splitLeaf and splitInternal',
      prompt: 'Pages are { leaf, keys, values, next } and { leaf: false, keys, children }. ' +
        'splitPage(page) splits a full page in half and returns { separator, node } — the new right ' +
        'page and the key that must go up to the parent. The two cases differ in one detail that ' +
        'decides whether the tree loses keys: a leaf COPIES the first key of the right half upward, ' +
        'because that key is data and has to stay in a leaf; an internal page MOVES its median ' +
        'upward, because a separator is not data. Leaves must also stay chained through `next`.',
      entry: 'splitPage',
      starter: [
        'function splitPage(page) {',
        '  if (page.leaf) {',
        '    const at = Math.ceil(page.keys.length / 2);',
        '    const right = { leaf: true, keys: page.keys.splice(at), values: page.values.splice(at), next: null };',
        '    // link the leaves, and send the right separator up',
        '    return { separator: page.keys[0], node: right };',
        '  }',
        '',
        '  const at = Math.floor(page.keys.length / 2);',
        '  const right = { leaf: false, keys: page.keys.splice(at + 1), children: page.children.splice(at + 1) };',
        '  // the median goes up and must not stay behind',
        '  return { separator: page.keys[at], node: right };',
        '}'
      ].join('\n'),
      solution: [
        'function splitPage(page) {',
        '  if (page.leaf) {',
        '    const at = Math.ceil(page.keys.length / 2);',
        '    const right = { leaf: true, keys: page.keys.splice(at), values: page.values.splice(at), next: page.next };',
        '    page.next = right;',
        '    return { separator: right.keys[0], node: right };',
        '  }',
        '',
        '  const at = Math.floor(page.keys.length / 2);',
        '  const separator = page.keys[at];',
        '  const right = { leaf: false, keys: page.keys.splice(at + 1), children: page.children.splice(at + 1) };',
        '  page.keys.pop();',
        '  return { separator: separator, node: right };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a leaf split copies its separator and keeps every key',
          assert: function (splitPage, api) {
            const leaf = {
              leaf: true,
              keys: [10, 20, 30, 40, 50],
              values: ['a', 'b', 'c', 'd', 'e'],
              next: null
            };

            const split = splitPage(leaf);
            api.assert.equal(leaf.keys.concat(split.node.keys).join(','), '10,20,30,40,50',
              'no key may be lost in a leaf split');
            api.assert.equal(split.separator, split.node.keys[0],
              'the separator is a copy of the first key of the right half');
            api.assert.equal(split.node.keys.indexOf(split.separator) >= 0, true,
              'and that key must still be present in the leaf');
          }
        },
        {
          name: 'a leaf split keeps the leaves chained',
          assert: function (splitPage, api) {
            const tail = { leaf: true, keys: [90], values: ['z'], next: null };
            const leaf = { leaf: true, keys: [10, 20, 30, 40], values: ['a', 'b', 'c', 'd'], next: tail };

            const split = splitPage(leaf);
            api.assert.equal(leaf.next, split.node, 'the left half points at the new right half');
            api.assert.equal(split.node.next, tail, 'and the right half inherits the old next pointer');
          }
        },
        {
          name: 'an internal split moves its median rather than copying it',
          assert: function (splitPage, api) {
            const kids = [0, 1, 2, 3, 4, 5].map(function (i) {
              return { leaf: true, keys: [i * 10], values: [i], next: null };
            });
            const page = { leaf: false, keys: [10, 20, 30, 40, 50], children: kids };

            const split = splitPage(page);
            api.assert.equal(page.keys.indexOf(split.separator), -1,
              'the promoted key must NOT stay in the left page');
            api.assert.equal(split.node.keys.indexOf(split.separator), -1,
              'nor in the right page — an internal separator moves, it does not copy');
            api.assert.equal(page.keys.length + split.node.keys.length + 1, 5,
              'the five keys become two halves plus the one that went up');
          }
        },
        {
          name: 'a node always keeps one more child than it has keys',
          assert: function (splitPage, api) {
            const kids = [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
              return { leaf: true, keys: [i * 10], values: [i], next: null };
            });
            const page = { leaf: false, keys: [10, 20, 30, 40, 50, 60, 70], children: kids };

            const split = splitPage(page);
            api.assert.equal(page.children.length, page.keys.length + 1, 'left half');
            api.assert.equal(split.node.children.length, split.node.keys.length + 1, 'right half');
            api.assert.equal(page.children.length + split.node.children.length, 8,
              'and every child is still attached to exactly one of them');
          }
        }
      ]
    }],

    'augmented-trees': [{
      id: 'augmented-select-rank',
      title: 'select(k) and rank(key) on an order-statistic tree',
      prompt: 'Nodes are { key, left, right, size }, with size already maintained as ' +
        '1 + size(left) + size(right). Export orderStatistics as a function returning ' +
        '{ select, rank }. select(root, k) returns the k-th smallest key, 1-based. rank(root, key) ' +
        'returns how many keys are at or below it. Both must be a single root-to-leaf descent — no ' +
        'counting, no traversal, no arrays.',
      entry: 'orderStatistics',
      starter: [
        'function sizeOf(node) { return node ? node.size : 0; }',
        '',
        'function select(node, k) {',
        '  // compare k against the left subtree size and descend',
        '  return node ? node.key : undefined;',
        '}',
        '',
        'function rank(node, key) {',
        '  // accumulate the left sizes of every node you pass going right',
        '  return 0;',
        '}',
        '',
        'function orderStatistics() {',
        '  return { select: select, rank: rank };',
        '}'
      ].join('\n'),
      solution: [
        'function sizeOf(node) { return node ? node.size : 0; }',
        '',
        'function select(node, k) {',
        '  let current = node;',
        '  let remaining = k;',
        '  while (current) {',
        '    const left = sizeOf(current.left);',
        '    if (remaining === left + 1) return current.key;',
        '    if (remaining <= left) { current = current.left; continue; }',
        '    remaining -= left + 1;',
        '    current = current.right;',
        '  }',
        '  return undefined;',
        '}',
        '',
        'function rank(node, key) {',
        '  let current = node;',
        '  let seen = 0;',
        '  while (current) {',
        '    if (key < current.key) { current = current.left; continue; }',
        '    seen += sizeOf(current.left) + 1;',
        '    if (key === current.key) return seen;',
        '    current = current.right;',
        '  }',
        '  return seen;',
        '}',
        '',
        'function orderStatistics() {',
        '  return { select: select, rank: rank };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'select and rank agree with a sorted array over 2 000 keys',
          assert: function (orderStatistics, api) {
            const ops = orderStatistics();
            const rng = api.Random.seeded(5);

            const insert = function (node, key) {
              if (!node) return { key: key, left: null, right: null, size: 1 };
              if (key < node.key) node.left = insert(node.left, key);
              else if (key > node.key) node.right = insert(node.right, key);
              else return node;
              node.size = 1 + (node.left ? node.left.size : 0) + (node.right ? node.right.size : 0);
              return node;
            };

            let tree = null;
            const live = new Set();
            for (let i = 0; i < 2000; i += 1) {
              const key = rng.int(100000);
              tree = insert(tree, key);
              live.add(key);
            }
            const sorted = Array.from(live).sort(function (a, b) { return a - b; });

            for (let k = 1; k <= sorted.length; k += 37) {
              api.assert.equal(ops.select(tree, k), sorted[k - 1], 'select(' + k + ')');
            }
            for (let i = 0; i < sorted.length; i += 41) {
              api.assert.equal(ops.rank(tree, sorted[i]), i + 1, 'rank(' + sorted[i] + ')');
            }
          }
        },
        {
          name: 'the boundaries behave: first, last and out of range',
          assert: function (orderStatistics, api) {
            const ops = orderStatistics();
            const build = function (keys) {
              let node = null;
              const insert = function (current, key) {
                if (!current) return { key: key, left: null, right: null, size: 1 };
                if (key < current.key) current.left = insert(current.left, key);
                else if (key > current.key) current.right = insert(current.right, key);
                current.size = 1 + (current.left ? current.left.size : 0) + (current.right ? current.right.size : 0);
                return current;
              };
              keys.forEach(function (key) { node = insert(node, key); });
              return node;
            };

            const tree = build([50, 30, 70, 20, 40, 60, 80]);
            api.assert.equal(ops.select(tree, 1), 20, 'the smallest');
            api.assert.equal(ops.select(tree, 7), 80, 'the largest');
            api.assert.equal(ops.select(tree, 8), undefined, 'past the end');
            api.assert.equal(ops.rank(tree, 20), 1);
            api.assert.equal(ops.rank(tree, 80), 7);
            api.assert.equal(ops.rank(tree, 45), 3, 'an absent key counts what is below it: 20, 30 and 40');
          }
        },
        {
          name: 'select is a descent, not a traversal',
          assert: function (orderStatistics, api) {
            const ops = orderStatistics();

            /* A perfectly balanced tree of 1 023 keys. A descent touches at
               most 10 nodes; anything that counts or scans touches hundreds. */
            const build = function (lo, hi) {
              if (lo > hi) return null;
              const mid = (lo + hi) >> 1;
              const node = { key: mid, left: build(lo, mid - 1), right: build(mid + 1, hi), size: 0 };
              node.size = 1 + (node.left ? node.left.size : 0) + (node.right ? node.right.size : 0);
              return node;
            };

            let visits = 0;
            const tree = build(1, 1023);
            const counted = function (node) {
              if (!node) return null;
              visits += 1;
              return node;
            };

            /* Wrap the tree so every node access is counted. */
            const wrap = function (node) {
              if (!node) return null;
              const proxy = { key: node.key, size: node.size };
              Object.defineProperty(proxy, 'left', { get: function () { return wrap(counted(node.left)); } });
              Object.defineProperty(proxy, 'right', { get: function () { return wrap(counted(node.right)); } });
              return proxy;
            };

            ops.select(wrap(tree), 700);
            api.assert.ok(visits <= 20, 'select touched ' + visits + ' nodes; a descent needs at most 10');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
