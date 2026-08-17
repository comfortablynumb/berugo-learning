/** Graded exercises for the search-tree sections (M04.1-M04.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  /* Every exercise here works on plain nodes of the form { key, left, right },
     and every test rebuilds its own helpers: a graded test is serialised
     across the worker boundary, so it can use its two arguments and nothing
     else from this file. */

  registry.register({
    'bst-rotations': [
      {
        id: 'bst-rotate-right',
        title: 'The rotation, and what it must not change',
        prompt: 'rotateRight(node) takes a node whose left child exists, rotates that child above it, ' +
          'and returns the new subtree root. Three pointer writes and no comparisons — and the ' +
          'in-order sequence of the subtree must come out identical, which is what makes a rotation ' +
          'safe to apply as often as a balance rule asks for.',
        entry: 'rotateRight',
        starter: [
          'function rotateRight(node) {',
          '  const pivot = node.left;',
          '  // move pivot.right across to node, then put node under pivot',
          '  return node;',
          '}'
        ].join('\n'),
        solution: [
          'function rotateRight(node) {',
          '  const pivot = node.left;',
          '  node.left = pivot.right;',
          '  pivot.right = node;',
          '  return pivot;',
          '}'
        ].join('\n'),
        tests: [
          {
            name: 'the left child becomes the subtree root and the middle subtree moves across',
            assert: function (rotateRight, api) {
              const node = {
                key: 8,
                left: {
                  key: 4,
                  left: { key: 2, left: null, right: null },
                  right: { key: 6, left: null, right: null }
                },
                right: { key: 9, left: null, right: null }
              };

              const rotated = rotateRight(node);
              api.assert.equal(rotated.key, 4, 'the left child is now on top');
              api.assert.equal(rotated.right.key, 8, 'the old root hangs on the right');
              api.assert.equal(rotated.left.key, 2, 'the pivot keeps its left subtree');
              api.assert.equal(rotated.right.left.key, 6, 'the middle subtree moves to the old root');
              api.assert.equal(rotated.right.right.key, 9, 'the old right subtree is untouched');
            }
          },
          {
            name: 'the in-order sequence is identical before and after',
            assert: function (rotateRight, api) {
              const rng = api.Random.seeded(3);
              const insert = function (current, key) {
                if (!current) return { key: key, left: null, right: null };
                if (key < current.key) current.left = insert(current.left, key);
                else if (key > current.key) current.right = insert(current.right, key);
                return current;
              };
              const inOrder = function (n) { return n ? inOrder(n.left).concat([n.key], inOrder(n.right)) : []; };

              for (let round = 0; round < 20; round += 1) {
                let tree = null;
                for (let i = 0; i < 25; i += 1) tree = insert(tree, rng.int(200));
                if (!tree.left) continue;
                const before = inOrder(tree).join(',');
                const after = inOrder(rotateRight(tree)).join(',');
                api.assert.equal(after, before, 'round ' + round + ' changed the ordering');
              }
            }
          },
          {
            name: 'the total depth changes by exactly |A| − |C|',
            assert: function (rotateRight, api) {
              const size = function (n) { return n ? 1 + size(n.left) + size(n.right) : 0; };
              const totalDepth = function (n, depth) {
                if (!n) return 0;
                return depth + totalDepth(n.left, depth + 1) + totalDepth(n.right, depth + 1);
              };

              const spine = { key: 5, left: { key: 4, left: { key: 3, left: { key: 2, left: { key: 1, left: null, right: null }, right: null }, right: null }, right: null }, right: null };
              const before = totalDepth(spine, 1);
              const c = size(spine.right);
              const a = size(spine.left.left);
              const after = totalDepth(rotateRight(spine), 1);

              api.assert.equal(before, 15, 'a five-node left spine has total depth 15');
              api.assert.equal(after - before, c - a, 'the depth change is |C| − |A| for a right rotation');
              api.assert.equal(after, 12, 'so this one is worth exactly three levels');
            }
          }
        ]
      },
      {
        id: 'bst-delete-node',
        title: 'The three delete cases',
        prompt: 'deleteNode(root, key) returns the new root with that key removed. There are exactly ' +
          'three cases: a leaf is unlinked, a node with one child is replaced by that child, and a ' +
          'node with two children is replaced by its in-order successor — which is then deleted from ' +
          'the right subtree, where it is guaranteed to be an easier case.',
        entry: 'deleteNode',
        starter: [
          'function deleteNode(node, key) {',
          '  if (!node) return null;',
          '  if (key < node.key) { node.left = deleteNode(node.left, key); return node; }',
          '  if (key > node.key) { node.right = deleteNode(node.right, key); return node; }',
          '  // this is the node to remove: handle no child, one child and two children',
          '  return node.left;',
          '}'
        ].join('\n'),
        solution: [
          'function deleteNode(node, key) {',
          '  if (!node) return null;',
          '  if (key < node.key) { node.left = deleteNode(node.left, key); return node; }',
          '  if (key > node.key) { node.right = deleteNode(node.right, key); return node; }',
          '',
          '  if (!node.left) return node.right;',
          '  if (!node.right) return node.left;',
          '',
          '  let successor = node.right;',
          '  while (successor.left) successor = successor.left;',
          '  node.key = successor.key;',
          '  node.right = deleteNode(node.right, successor.key);',
          '  return node;',
          '}'
        ].join('\n'),
        tests: [
          {
            name: 'a leaf, a one-child node and a two-child node each come out right',
            assert: function (deleteNode, api) {
              const insert = function (current, key) {
                if (!current) return { key: key, left: null, right: null };
                if (key < current.key) current.left = insert(current.left, key);
                else if (key > current.key) current.right = insert(current.right, key);
                return current;
              };
              const inOrder = function (n) { return n ? inOrder(n.left).concat([n.key], inOrder(n.right)) : []; };

              let tree = null;
              [50, 30, 70, 20, 40, 60, 80, 65].forEach(function (key) { tree = insert(tree, key); });

              tree = deleteNode(tree, 20);
              api.assert.equal(inOrder(tree).join(','), '30,40,50,60,65,70,80', 'leaf');

              tree = deleteNode(tree, 60);
              api.assert.equal(inOrder(tree).join(','), '30,40,50,65,70,80', 'one child');

              tree = deleteNode(tree, 50);
              api.assert.equal(inOrder(tree).join(','), '30,40,65,70,80', 'two children');
            }
          },
          {
            name: 'deleting a key that is not there leaves the tree alone',
            assert: function (deleteNode, api) {
              const insert = function (current, key) {
                if (!current) return { key: key, left: null, right: null };
                if (key < current.key) current.left = insert(current.left, key);
                else if (key > current.key) current.right = insert(current.right, key);
                return current;
              };
              const inOrder = function (n) { return n ? inOrder(n.left).concat([n.key], inOrder(n.right)) : []; };

              let tree = null;
              [5, 3, 8].forEach(function (key) { tree = insert(tree, key); });
              tree = deleteNode(tree, 42);
              api.assert.equal(inOrder(tree).join(','), '3,5,8', 'nothing changes');
              tree = deleteNode(deleteNode(deleteNode(tree, 5), 3), 8);
              api.assert.equal(tree, null, 'deleting every key empties the tree');
            }
          },
          {
            name: 'the in-order sequence tracks a reference set through randomised deletion',
            assert: function (deleteNode, api) {
              const rng = api.Random.seeded(7);
              const insert = function (current, key) {
                if (!current) return { key: key, left: null, right: null };
                if (key < current.key) current.left = insert(current.left, key);
                else if (key > current.key) current.right = insert(current.right, key);
                return current;
              };
              const inOrder = function (n) { return n ? inOrder(n.left).concat([n.key], inOrder(n.right)) : []; };

              let tree = null;
              const live = new Set();
              for (let i = 0; i < 200; i += 1) {
                const key = rng.int(120);
                tree = insert(tree, key);
                live.add(key);
              }

              Array.from(live).filter(function (_, i) { return i % 3 === 0; }).forEach(function (key) {
                tree = deleteNode(tree, key);
                live.delete(key);
              });

              const expected = Array.from(live).sort(function (a, b) { return a - b; });
              api.assert.equal(inOrder(tree).join(','), expected.join(','),
                'the in-order sequence must equal the reference set after every deletion');
            }
          },
          {
            name: 'the inherited bounds still hold, not just the parent-child order',
            assert: function (deleteNode, api) {
              const rng = api.Random.seeded(11);
              const insert = function (current, key) {
                if (!current) return { key: key, left: null, right: null };
                if (key < current.key) current.left = insert(current.left, key);
                else if (key > current.key) current.right = insert(current.right, key);
                return current;
              };

              let tree = null;
              for (let i = 0; i < 150; i += 1) tree = insert(tree, rng.int(200));
              for (let i = 0; i < 60; i += 1) tree = deleteNode(tree, rng.int(200));

              const check = function (node, lo, hi) {
                if (!node) return true;
                if (lo !== null && node.key <= lo) return false;
                if (hi !== null && node.key >= hi) return false;
                return check(node.left, lo, node.key) && check(node.right, node.key, hi);
              };
              api.assert.ok(check(tree, null, null),
                'every subtree must stay inside the bounds it inherits from its ancestors');
            }
          }
        ]
      }
    ]
  });
}(typeof window !== 'undefined' ? window : null));
