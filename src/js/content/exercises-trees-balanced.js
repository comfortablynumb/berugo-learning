/** Graded exercises for AVL and red-black trees (M04.2-M04.3). */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'avl-trees': [{
      id: 'avl-rebalance',
      title: 'rebalance(node): the four cases',
      prompt: 'Nodes are { key, left, right, height }. rebalance(node) recomputes the node\'s height, ' +
        'then fixes it if its balance factor has reached ±2, returning the new subtree root. The four ' +
        'cases are LL, LR, RL and RR: the outer ones need a single rotation, the inner ones need the ' +
        'inner child rotated first. Every node whose children changed must have its height ' +
        'recomputed — and the lower node before the upper one.',
      entry: 'rebalance',
      starter: [
        'function heightOf(node) { return node ? node.height : 0; }',
        '',
        'function update(node) {',
        '  node.height = 1 + Math.max(heightOf(node.left), heightOf(node.right));',
        '  return node;',
        '}',
        '',
        'function rotateLeft(node) {',
        '  const pivot = node.right;',
        '  node.right = pivot.left;',
        '  pivot.left = node;',
        '  // update the node that moved down, then the one that moved up',
        '  return pivot;',
        '}',
        '',
        'function rotateRight(node) {',
        '  const pivot = node.left;',
        '  node.left = pivot.right;',
        '  pivot.right = node;',
        '  return pivot;',
        '}',
        '',
        'function rebalance(node) {',
        '  update(node);',
        '  // if the balance factor is +2 or -2, pick one of the four cases',
        '  return node;',
        '}'
      ].join('\n'),
      solution: [
        'function heightOf(node) { return node ? node.height : 0; }',
        '',
        'function update(node) {',
        '  node.height = 1 + Math.max(heightOf(node.left), heightOf(node.right));',
        '  return node;',
        '}',
        '',
        'function balanceOf(node) { return heightOf(node.left) - heightOf(node.right); }',
        '',
        'function rotateLeft(node) {',
        '  const pivot = node.right;',
        '  node.right = pivot.left;',
        '  pivot.left = node;',
        '  update(pivot.left);',
        '  return update(pivot);',
        '}',
        '',
        'function rotateRight(node) {',
        '  const pivot = node.left;',
        '  node.left = pivot.right;',
        '  pivot.right = node;',
        '  update(pivot.right);',
        '  return update(pivot);',
        '}',
        '',
        'function rebalance(node) {',
        '  update(node);',
        '  const balance = balanceOf(node);',
        '',
        '  if (balance > 1) {',
        '    if (balanceOf(node.left) < 0) node.left = rotateLeft(node.left);',
        '    return rotateRight(node);',
        '  }',
        '  if (balance < -1) {',
        '    if (balanceOf(node.right) > 0) node.right = rotateRight(node.right);',
        '    return rotateLeft(node);',
        '  }',
        '  return node;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the LL case is fixed by one rotation',
          assert: function (rebalance, api) {
            const leaf = function (key) { return { key: key, left: null, right: null, height: 1 }; };
            const node = {
              key: 30,
              left: { key: 20, left: leaf(10), right: null, height: 2 },
              right: null,
              height: 3
            };

            const fixed = rebalance(node);
            api.assert.equal(fixed.key, 20, 'the middle key becomes the root');
            api.assert.equal(fixed.left.key, 10);
            api.assert.equal(fixed.right.key, 30);
            api.assert.equal(fixed.height, 2, 'and the heights are recomputed');
          }
        },
        {
          name: 'the LR case needs the inner rotation first',
          assert: function (rebalance, api) {
            const leaf = function (key) { return { key: key, left: null, right: null, height: 1 }; };
            const node = {
              key: 30,
              left: { key: 10, left: null, right: leaf(20), height: 2 },
              right: null,
              height: 3
            };

            const fixed = rebalance(node);
            api.assert.equal(fixed.key, 20, 'the inner node comes to the top');
            api.assert.equal(fixed.left.key, 10);
            api.assert.equal(fixed.right.key, 30);
            api.assert.equal(fixed.height, 2);
          }
        },
        {
          name: 'a balanced node is returned untouched, with its height refreshed',
          assert: function (rebalance, api) {
            const leaf = function (key) { return { key: key, left: null, right: null, height: 1 }; };
            const node = { key: 20, left: leaf(10), right: leaf(30), height: 99 };

            const fixed = rebalance(node);
            api.assert.equal(fixed.key, 20, 'no rotation happens');
            api.assert.equal(fixed.height, 2, 'but the stale height is corrected');
          }
        },
        {
          name: 'built into a full insert, the invariant holds over 2 000 randomised keys',
          assert: function (rebalance, api) {
            const rng = api.Random.seeded(5);
            const heightOf = function (node) { return node ? node.height : 0; };

            const insert = function (node, key) {
              if (!node) return { key: key, left: null, right: null, height: 1 };
              if (key < node.key) node.left = insert(node.left, key);
              else if (key > node.key) node.right = insert(node.right, key);
              else return node;
              return rebalance(node);
            };

            let tree = null;
            const live = new Set();
            for (let i = 0; i < 2000; i += 1) {
              const key = rng.int(10000);
              tree = insert(tree, key);
              live.add(key);
            }

            const inOrder = function (n) { return n ? inOrder(n.left).concat([n.key], inOrder(n.right)) : []; };
            const expected = Array.from(live).sort(function (a, b) { return a - b; });
            api.assert.equal(inOrder(tree).join(','), expected.join(','), 'the keys must all still be there');

            const check = function (node) {
              if (!node) return true;
              const balance = heightOf(node.left) - heightOf(node.right);
              if (balance > 1 || balance < -1) return false;
              if (node.height !== 1 + Math.max(heightOf(node.left), heightOf(node.right))) return false;
              return check(node.left) && check(node.right);
            };
            api.assert.ok(check(tree), 'every balance factor within ±1, and every height correct');
            api.assert.ok(tree.height <= 1.4404 * Math.log2(expected.length + 2) - 0.328,
              'and the whole tree inside the AVL height bound');
          }
        }
      ]
    }],

    'red-black-trees': [{
      id: 'rb-insert-fixup',
      title: 'insertFixup: recolour, or rotate and stop',
      prompt: 'Nodes are { key, left, right, parent, red }. The new node has just been linked in as ' +
        'red. insertFixup(node, root) repairs any red-red violation and returns the (possibly new) ' +
        'root. Two cases: if the uncle is red, recolour parent, uncle and grandparent, then continue ' +
        'from the grandparent; if the uncle is black, rotate — the inner case needs two rotations, ' +
        'the outer one needs one — and stop. Finish by painting the root black. Helpers rotateLeft ' +
        'and rotateRight are provided and maintain parent pointers; they return the new root.',
      entry: 'insertFixup',
      starter: [
        'function isRed(node) { return Boolean(node && node.red); }',
        '',
        'function rotateLeft(root, node) {',
        '  const pivot = node.right;',
        '  node.right = pivot.left;',
        '  if (pivot.left) pivot.left.parent = node;',
        '  pivot.parent = node.parent;',
        '  if (!node.parent) root = pivot;',
        '  else if (node.parent.left === node) node.parent.left = pivot;',
        '  else node.parent.right = pivot;',
        '  pivot.left = node;',
        '  node.parent = pivot;',
        '  return root;',
        '}',
        '',
        'function rotateRight(root, node) {',
        '  const pivot = node.left;',
        '  node.left = pivot.right;',
        '  if (pivot.right) pivot.right.parent = node;',
        '  pivot.parent = node.parent;',
        '  if (!node.parent) root = pivot;',
        '  else if (node.parent.right === node) node.parent.right = pivot;',
        '  else node.parent.left = pivot;',
        '  pivot.right = node;',
        '  node.parent = pivot;',
        '  return root;',
        '}',
        '',
        'function insertFixup(node, root) {',
        '  // while the parent is red, repair; then paint the root black',
        '  return root;',
        '}'
      ].join('\n'),
      solution: [
        'function isRed(node) { return Boolean(node && node.red); }',
        '',
        'function rotateLeft(root, node) {',
        '  const pivot = node.right;',
        '  node.right = pivot.left;',
        '  if (pivot.left) pivot.left.parent = node;',
        '  pivot.parent = node.parent;',
        '  if (!node.parent) root = pivot;',
        '  else if (node.parent.left === node) node.parent.left = pivot;',
        '  else node.parent.right = pivot;',
        '  pivot.left = node;',
        '  node.parent = pivot;',
        '  return root;',
        '}',
        '',
        'function rotateRight(root, node) {',
        '  const pivot = node.left;',
        '  node.left = pivot.right;',
        '  if (pivot.right) pivot.right.parent = node;',
        '  pivot.parent = node.parent;',
        '  if (!node.parent) root = pivot;',
        '  else if (node.parent.right === node) node.parent.right = pivot;',
        '  else node.parent.left = pivot;',
        '  pivot.right = node;',
        '  node.parent = pivot;',
        '  return root;',
        '}',
        '',
        'function insertFixup(node, root) {',
        '  let current = node;',
        '  let top = root;',
        '',
        '  while (current.parent && current.parent.red) {',
        '    const parent = current.parent;',
        '    const grand = parent.parent;',
        '    const onLeft = grand.left === parent;',
        '    const uncle = onLeft ? grand.right : grand.left;',
        '',
        '    if (isRed(uncle)) {',
        '      parent.red = false;',
        '      uncle.red = false;',
        '      grand.red = true;',
        '      current = grand;',
        '      continue;',
        '    }',
        '',
        '    if (onLeft && current === parent.right) {',
        '      current = parent;',
        '      top = rotateLeft(top, current);',
        '    } else if (!onLeft && current === parent.left) {',
        '      current = parent;',
        '      top = rotateRight(top, current);',
        '    }',
        '',
        '    current.parent.red = false;',
        '    grand.red = true;',
        '    top = onLeft ? rotateRight(top, grand) : rotateLeft(top, grand);',
        '  }',
        '',
        '  top.red = false;',
        '  return top;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a red uncle is handled by recolouring, with no rotation',
          assert: function (insertFixup, api) {
            const node = function (key, red) { return { key: key, left: null, right: null, parent: null, red: red }; };
            const grand = node(20, false);
            const parent = node(10, true);
            const uncle = node(30, true);
            const fresh = node(5, true);

            grand.left = parent; parent.parent = grand;
            grand.right = uncle; uncle.parent = grand;
            parent.left = fresh; fresh.parent = parent;

            const root = insertFixup(fresh, grand);
            api.assert.equal(root.key, 20, 'the shape does not change');
            api.assert.equal(root.red, false, 'the root ends black');
            api.assert.equal(root.left.red, false, 'the parent is repainted black');
            api.assert.equal(root.right.red, false, 'and so is the uncle');
          }
        },
        {
          name: 'a black uncle in the outer case is one rotation',
          assert: function (insertFixup, api) {
            const node = function (key, red) { return { key: key, left: null, right: null, parent: null, red: red }; };
            const grand = node(30, false);
            const parent = node(20, true);
            const fresh = node(10, true);

            grand.left = parent; parent.parent = grand;
            parent.left = fresh; fresh.parent = parent;

            const root = insertFixup(fresh, grand);
            api.assert.equal(root.key, 20, 'the parent rotates to the top');
            api.assert.equal(root.red, false);
            api.assert.equal(root.left.key, 10);
            api.assert.equal(root.right.key, 30);
            api.assert.ok(root.left.red && root.right.red, 'and both children end red');
          }
        },
        {
          name: 'all five invariants hold after 2 000 randomised insertions',
          assert: function (insertFixup, api) {
            const rng = api.Random.seeded(4);
            let root = null;

            const insert = function (key) {
              if (!root) { root = { key: key, left: null, right: null, parent: null, red: false }; return; }
              let node = root;
              for (;;) {
                if (key === node.key) return;
                const side = key < node.key ? 'left' : 'right';
                if (!node[side]) {
                  node[side] = { key: key, left: null, right: null, parent: node, red: true };
                  root = insertFixup(node[side], root);
                  return;
                }
                node = node[side];
              }
            };

            const live = new Set();
            for (let i = 0; i < 2000; i += 1) {
              const key = rng.int(10000);
              insert(key);
              live.add(key);
            }

            api.assert.equal(root.red, false, 'rule two: the root is black');
            api.assert.equal(root.parent, null, 'the root has no parent');

            const heights = new Set();
            const walk = function (node, black) {
              if (!node) { heights.add(black + 1); return true; }
              if (node.red && ((node.left && node.left.red) || (node.right && node.right.red))) return false;
              if (node.left && node.left.parent !== node) return false;
              if (node.right && node.right.parent !== node) return false;
              const next = black + (node.red ? 0 : 1);
              return walk(node.left, next) && walk(node.right, next);
            };

            api.assert.ok(walk(root, 0), 'rule four: no red node has a red child, and parents agree');
            api.assert.equal(heights.size, 1, 'rule five: every path holds the same number of black nodes');

            const inOrder = function (n) { return n ? inOrder(n.left).concat([n.key], inOrder(n.right)) : []; };
            const expected = Array.from(live).sort(function (a, b) { return a - b; });
            api.assert.equal(inOrder(root).join(','), expected.join(','), 'and it is still a search tree');
          }
        },
        {
          name: 'the height stays inside 2 log2(n + 1)',
          assert: function (insertFixup, api) {
            const rng = api.Random.seeded(6);
            let root = null;
            let count = 0;

            for (let i = 0; i < 3000; i += 1) {
              const key = rng.int(50000);
              if (!root) { root = { key: key, left: null, right: null, parent: null, red: false }; count = 1; continue; }
              let node = root;
              let placed = false;
              while (!placed) {
                if (key === node.key) break;
                const side = key < node.key ? 'left' : 'right';
                if (!node[side]) {
                  node[side] = { key: key, left: null, right: null, parent: node, red: true };
                  root = insertFixup(node[side], root);
                  count += 1;
                  placed = true;
                } else {
                  node = node[side];
                }
              }
            }

            const height = function (node) { return node ? 1 + Math.max(height(node.left), height(node.right)) : 0; };
            api.assert.ok(height(root) <= 2 * Math.log2(count + 1),
              'height ' + height(root) + ' must be inside 2·log2(' + count + ' + 1)');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
