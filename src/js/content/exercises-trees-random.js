/** Graded exercises for treaps, splay trees and scapegoat trees (M04.4-M04.6). */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    treaps: [
      {
        id: 'treap-split',
        title: 'split(node, key)',
        prompt: 'Nodes are { key, priority, left, right }. split(node, key) returns ' +
          '{ left, right } where left holds every key below `key` and right holds the rest. Both ' +
          'halves must come out as valid treaps — both orders intact — and the walk must follow one ' +
          'root-to-leaf path rather than rebuilding anything.',
        entry: 'split',
        starter: [
          'function split(node, key) {',
          '  if (!node) return { left: null, right: null };',
          '  // decide which half this node belongs to, then recurse into the child',
          '  // that still straddles the cut',
          '  return { left: node, right: null };',
          '}'
        ].join('\n'),
        solution: [
          'function split(node, key) {',
          '  if (!node) return { left: null, right: null };',
          '',
          '  if (node.key < key) {',
          '    const parts = split(node.right, key);',
          '    node.right = parts.left;',
          '    return { left: node, right: parts.right };',
          '  }',
          '',
          '  const parts = split(node.left, key);',
          '  node.left = parts.right;',
          '  return { left: parts.left, right: node };',
          '}'
        ].join('\n'),
        tests: [
          {
            name: 'the two halves hold the right keys, in order',
            assert: function (split, api) {
              const build = function (keys, seed) {
                const rng = api.Random.seeded(seed);
                let node = null;
                const insert = function (current, key, priority) {
                  if (!current) return { key: key, priority: priority, left: null, right: null };
                  if (key < current.key) {
                    current.left = insert(current.left, key, priority);
                    if (current.left.priority > current.priority) {
                      const pivot = current.left;
                      current.left = pivot.right;
                      pivot.right = current;
                      return pivot;
                    }
                    return current;
                  }
                  current.right = insert(current.right, key, priority);
                  if (current.right.priority > current.priority) {
                    const pivot = current.right;
                    current.right = pivot.left;
                    pivot.left = current;
                    return pivot;
                  }
                  return current;
                };
                keys.forEach(function (key) { node = insert(node, key, rng.next()); });
                return node;
              };

              const inOrder = function (n) { return n ? inOrder(n.left).concat([n.key], inOrder(n.right)) : []; };
              const keys = [];
              for (let i = 0; i < 200; i += 1) keys.push(i);

              const parts = split(build(keys, 3), 120);
              api.assert.equal(inOrder(parts.left).join(','), keys.slice(0, 120).join(','), 'left half');
              api.assert.equal(inOrder(parts.right).join(','), keys.slice(120).join(','), 'right half');
            }
          },
          {
            name: 'both halves are still treaps',
            assert: function (split, api) {
              const rng = api.Random.seeded(11);
              const nodes = [];
              for (let i = 0; i < 300; i += 1) nodes.push({ key: i, priority: rng.next(), left: null, right: null });

              /* Build by repeated split/merge is circular, so build by the
                 rotation method and then check what split produced. */
              let node = null;
              const insert = function (current, fresh) {
                if (!current) return fresh;
                if (fresh.key < current.key) {
                  current.left = insert(current.left, fresh);
                  if (current.left.priority > current.priority) {
                    const pivot = current.left;
                    current.left = pivot.right;
                    pivot.right = current;
                    return pivot;
                  }
                } else {
                  current.right = insert(current.right, fresh);
                  if (current.right.priority > current.priority) {
                    const pivot = current.right;
                    current.right = pivot.left;
                    pivot.left = current;
                    return pivot;
                  }
                }
                return current;
              };
              nodes.forEach(function (fresh) { node = insert(node, fresh); });

              const parts = split(node, 150);
              const check = function (current, lo, hi) {
                if (!current) return true;
                if (lo !== null && current.key < lo) return false;
                if (hi !== null && current.key >= hi) return false;
                if (current.left && current.left.priority > current.priority) return false;
                if (current.right && current.right.priority > current.priority) return false;
                return check(current.left, lo, current.key) && check(current.right, current.key, hi);
              };

              api.assert.ok(check(parts.left, null, 150), 'the left half is a treap');
              api.assert.ok(check(parts.right, 150, null), 'the right half is a treap');
            }
          },
          {
            name: 'splitting below the minimum or above the maximum leaves one side empty',
            assert: function (split, api) {
              const node = {
                key: 20, priority: 0.9, left: null, right: null
              };
              node.left = { key: 10, priority: 0.5, left: null, right: null };
              node.right = { key: 30, priority: 0.4, left: null, right: null };

              const low = split({ key: 20, priority: 0.9,
                left: { key: 10, priority: 0.5, left: null, right: null },
                right: { key: 30, priority: 0.4, left: null, right: null } }, 5);
              api.assert.equal(low.left, null, 'nothing is below 5');
              api.assert.ok(low.right !== null, 'and everything is at or above it');

              const high = split(node, 100);
              api.assert.equal(high.right, null, 'nothing is at or above 100');
              api.assert.ok(high.left !== null);
            }
          }
        ]
      },
      {
        id: 'treap-merge',
        title: 'merge(left, right)',
        prompt: 'merge(left, right) joins two treaps where every key in `left` is below every key in ' +
          '`right`, and returns the joined treap. Whichever root has the higher priority stays on ' +
          'top; the other side is merged into the appropriate child. It is the inverse of split, and ' +
          'together they are the whole structure.',
        entry: 'merge',
        starter: [
          'function merge(left, right) {',
          '  if (!left) return right;',
          '  if (!right) return left;',
          '  // the higher priority becomes the root; merge the rest into its child',
          '  return left;',
          '}'
        ].join('\n'),
        solution: [
          'function merge(left, right) {',
          '  if (!left) return right;',
          '  if (!right) return left;',
          '',
          '  if (left.priority > right.priority) {',
          '    left.right = merge(left.right, right);',
          '    return left;',
          '  }',
          '  right.left = merge(left, right.left);',
          '  return right;',
          '}'
        ].join('\n'),
        tests: [
          {
            name: 'the joined treap holds both key sets in order',
            assert: function (merge, api) {
              const chain = function (keys, priorities) {
                let node = null;
                for (let i = keys.length - 1; i >= 0; i -= 1) {
                  node = { key: keys[i], priority: priorities[i], left: null, right: node };
                }
                return node;
              };

              const inOrder = function (n) { return n ? inOrder(n.left).concat([n.key], inOrder(n.right)) : []; };
              const left = chain([1, 2, 3], [0.9, 0.5, 0.2]);
              const right = chain([4, 5, 6], [0.8, 0.4, 0.1]);

              api.assert.equal(inOrder(merge(left, right)).join(','), '1,2,3,4,5,6');
            }
          },
          {
            name: 'the heap order survives the join',
            assert: function (merge, api) {
              const rng = api.Random.seeded(21);
              const buildRange = function (from, to) {
                let node = null;
                const insert = function (current, fresh) {
                  if (!current) return fresh;
                  if (fresh.key < current.key) {
                    current.left = insert(current.left, fresh);
                    if (current.left.priority > current.priority) {
                      const pivot = current.left;
                      current.left = pivot.right;
                      pivot.right = current;
                      return pivot;
                    }
                  } else {
                    current.right = insert(current.right, fresh);
                    if (current.right.priority > current.priority) {
                      const pivot = current.right;
                      current.right = pivot.left;
                      pivot.left = current;
                      return pivot;
                    }
                  }
                  return current;
                };
                for (let key = from; key < to; key += 1) {
                  node = insert(node, { key: key, priority: rng.next(), left: null, right: null });
                }
                return node;
              };

              const joined = merge(buildRange(0, 150), buildRange(150, 300));
              const check = function (current) {
                if (!current) return true;
                if (current.left && (current.left.priority > current.priority || current.left.key > current.key)) return false;
                if (current.right && (current.right.priority > current.priority || current.right.key < current.key)) return false;
                return check(current.left) && check(current.right);
              };

              api.assert.ok(check(joined), 'both orders must hold in the joined treap');

              const inOrder = function (n) { return n ? inOrder(n.left).concat([n.key], inOrder(n.right)) : []; };
              api.assert.equal(inOrder(joined).length, 300, 'and every key is still there');
            }
          },
          {
            name: 'merging with an empty side returns the other side unchanged',
            assert: function (merge, api) {
              const only = { key: 7, priority: 0.5, left: null, right: null };
              api.assert.equal(merge(null, only), only);
              api.assert.equal(merge(only, null), only);
              api.assert.equal(merge(null, null), null);
            }
          }
        ]
      }
    ],

    'splay-trees': [{
      id: 'splay-to-root',
      title: 'splay(node): zig, zig-zig, zig-zag',
      prompt: 'Nodes are { key, left, right, parent }. splay(node) rotates the node to the root and ' +
        'returns it. Three cases: if the parent is the root, one rotation (zig); if the node and its ' +
        'parent lean the same way, rotate the PARENT first and then the node (zig-zig); if they lean ' +
        'opposite ways, rotate the node twice (zig-zag). The zig-zig ordering is the whole algorithm ' +
        '— rotating the node twice instead also reaches the root and gives no amortised bound. ' +
        'rotateUp(node) is provided and maintains every parent link.',
      entry: 'splay',
      starter: [
        'function rotateUp(node) {',
        '  const parent = node.parent;',
        '  const grand = parent.parent;',
        '  if (parent.left === node) {',
        '    parent.left = node.right;',
        '    if (node.right) node.right.parent = parent;',
        '    node.right = parent;',
        '  } else {',
        '    parent.right = node.left;',
        '    if (node.left) node.left.parent = parent;',
        '    node.left = parent;',
        '  }',
        '  parent.parent = node;',
        '  node.parent = grand;',
        '  if (grand) {',
        '    if (grand.left === parent) grand.left = node;',
        '    else grand.right = node;',
        '  }',
        '}',
        '',
        'function splay(node) {',
        '  // rotate to the root in pairs',
        '  return node;',
        '}'
      ].join('\n'),
      solution: [
        'function rotateUp(node) {',
        '  const parent = node.parent;',
        '  const grand = parent.parent;',
        '  if (parent.left === node) {',
        '    parent.left = node.right;',
        '    if (node.right) node.right.parent = parent;',
        '    node.right = parent;',
        '  } else {',
        '    parent.right = node.left;',
        '    if (node.left) node.left.parent = parent;',
        '    node.left = parent;',
        '  }',
        '  parent.parent = node;',
        '  node.parent = grand;',
        '  if (grand) {',
        '    if (grand.left === parent) grand.left = node;',
        '    else grand.right = node;',
        '  }',
        '}',
        '',
        'function splay(node) {',
        '  while (node.parent) {',
        '    const parent = node.parent;',
        '    const grand = parent.parent;',
        '',
        '    if (!grand) {',
        '      rotateUp(node);',
        '    } else if ((parent.left === node) === (grand.left === parent)) {',
        '      rotateUp(parent);',
        '      rotateUp(node);',
        '    } else {',
        '      rotateUp(node);',
        '      rotateUp(node);',
        '    }',
        '  }',
        '  return node;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the accessed node ends as the root, with no parent',
          assert: function (splay, api) {
            const build = function (keys) {
              let root = null;
              const nodes = new Map();
              keys.forEach(function (key) {
                const fresh = { key: key, left: null, right: null, parent: null };
                nodes.set(key, fresh);
                if (!root) { root = fresh; return; }
                let node = root;
                for (;;) {
                  const side = key < node.key ? 'left' : 'right';
                  if (!node[side]) { node[side] = fresh; fresh.parent = node; return; }
                  node = node[side];
                }
              });
              return { root: root, nodes: nodes };
            };

            const tree = build([50, 30, 70, 20, 40, 60, 80, 10, 25, 35, 45]);
            const root = splay(tree.nodes.get(10));
            api.assert.equal(root.key, 10, 'the deepest key comes to the top');
            api.assert.equal(root.parent, null, 'and the root has no parent');
          }
        },
        {
          name: 'the in-order sequence is untouched',
          assert: function (splay, api) {
            const rng = api.Random.seeded(13);
            let root = null;
            const nodes = [];

            for (let i = 0; i < 300; i += 1) {
              const key = rng.int(5000);
              const fresh = { key: key, left: null, right: null, parent: null };
              if (!root) { root = fresh; nodes.push(fresh); continue; }
              let node = root;
              let placed = false;
              while (!placed) {
                if (key === node.key) break;
                const side = key < node.key ? 'left' : 'right';
                if (!node[side]) { node[side] = fresh; fresh.parent = node; nodes.push(fresh); placed = true; }
                else node = node[side];
              }
            }

            const inOrder = function (n) { return n ? inOrder(n.left).concat([n.key], inOrder(n.right)) : []; };
            const before = inOrder(root).join(',');

            for (let i = 0; i < 50; i += 1) {
              root = splay(nodes[(i * 7) % nodes.length]);
              api.assert.equal(inOrder(root).join(','), before, 'splay ' + i + ' changed the ordering');
            }
          }
        },
        {
          name: 'zig-zig rotates the parent first, which is what halves the depth',
          assert: function (splay, api) {
            /* A 16-node right spine. A correct splay of the deepest node
               halves the path and leaves height 10; move-to-root reaches the
               same root and leaves the spine at 16, which is the whole
               difference between the two algorithms. */
            const build = function (n) {
              let root = null;
              for (let key = n; key >= 1; key -= 1) {
                const fresh = { key: key, left: null, right: root, parent: null };
                if (root) root.parent = fresh;
                root = fresh;
              }
              return root;
            };
            const height = function (n) { return n ? 1 + Math.max(height(n.left), height(n.right)) : 0; };

            let root = build(16);
            let deepest = root;
            while (deepest.right) deepest = deepest.right;

            const top = splay(deepest);
            api.assert.equal(top.key, 16, 'the deepest key comes to the root');
            api.assert.ok(height(top) <= 10,
              'a correct splay leaves height 10 here; this one left ' + height(top) +
              ', which is what rotating the node twice instead of the parent gives');
            api.assert.ok(height(top) < 16, 'move-to-root would leave the spine untouched at 16');
          }
        },
        {
          name: 'every parent pointer still agrees with its child pointer',
          assert: function (splay, api) {
            const rng = api.Random.seeded(29);
            let root = null;
            const nodes = [];

            for (let i = 0; i < 200; i += 1) {
              const key = rng.int(2000);
              const fresh = { key: key, left: null, right: null, parent: null };
              if (!root) { root = fresh; nodes.push(fresh); continue; }
              let node = root;
              for (;;) {
                if (key === node.key) break;
                const side = key < node.key ? 'left' : 'right';
                if (!node[side]) { node[side] = fresh; fresh.parent = node; nodes.push(fresh); break; }
                node = node[side];
              }
            }

            for (let i = 0; i < 40; i += 1) root = splay(nodes[(i * 11) % nodes.length]);

            const check = function (n) {
              if (!n) return true;
              if (n.left && n.left.parent !== n) return false;
              if (n.right && n.right.parent !== n) return false;
              return check(n.left) && check(n.right);
            };
            api.assert.equal(root.parent, null);
            api.assert.ok(check(root), 'a rotation that forgets a parent link detaches a subtree');
          }
        }
      ]
    }],

    'scapegoat-trees': [{
      id: 'scapegoat-rebuild',
      title: 'rebuild(node): flatten, then rebuild balanced',
      prompt: 'Nodes are { key, left, right }. rebuild(node) returns the same nodes relinked into a ' +
        'perfectly balanced tree over the same keys. Two linear passes: an in-order flatten into an ' +
        'array, then a recursive midpoint build. It must allocate no nodes — the point of the ' +
        'structure is that a rebuild is a relink, which on disk is one sequential write.',
      entry: 'rebuild',
      starter: [
        'function flatten(node, out) {',
        '  if (!node) return out;',
        '  flatten(node.left, out);',
        '  out.push(node);',
        '  flatten(node.right, out);',
        '  return out;',
        '}',
        '',
        'function rebuild(node) {',
        '  const nodes = flatten(node, []);',
        '  // relink them so the middle node is the root, recursively',
        '  return node;',
        '}'
      ].join('\n'),
      solution: [
        'function flatten(node, out) {',
        '  if (!node) return out;',
        '  flatten(node.left, out);',
        '  out.push(node);',
        '  flatten(node.right, out);',
        '  return out;',
        '}',
        '',
        'function build(nodes, lo, hi) {',
        '  if (lo > hi) return null;',
        '  const mid = (lo + hi) >> 1;',
        '  const node = nodes[mid];',
        '  node.left = build(nodes, lo, mid - 1);',
        '  node.right = build(nodes, mid + 1, hi);',
        '  return node;',
        '}',
        '',
        'function rebuild(node) {',
        '  const nodes = flatten(node, []);',
        '  return build(nodes, 0, nodes.length - 1);',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a spine becomes a perfectly balanced tree over the same keys',
          assert: function (rebuild, api) {
            let root = null;
            for (let key = 15; key >= 1; key -= 1) root = { key: key, left: null, right: root };

            const inOrder = function (n) { return n ? inOrder(n.left).concat([n.key], inOrder(n.right)) : []; };
            const height = function (n) { return n ? 1 + Math.max(height(n.left), height(n.right)) : 0; };

            const before = inOrder(root).join(',');
            const rebuilt = rebuild(root);

            api.assert.equal(inOrder(rebuilt).join(','), before, 'the keys and their order are unchanged');
            api.assert.equal(height(rebuilt), 4, '15 nodes fit exactly in 4 levels');
          }
        },
        {
          name: 'the rebuilt tree is as shallow as the key count allows, at several sizes',
          assert: function (rebuild, api) {
            const height = function (n) { return n ? 1 + Math.max(height(n.left), height(n.right)) : 0; };

            [1, 2, 7, 8, 100, 1000].forEach(function (size) {
              let root = null;
              for (let key = size; key >= 1; key -= 1) root = { key: key, left: null, right: root };
              const rebuilt = rebuild(root);
              api.assert.equal(height(rebuilt), Math.ceil(Math.log2(size + 1)),
                size + ' nodes must rebuild to exactly ceil(log2(n + 1)) levels');
            });
          }
        },
        {
          name: 'it relinks the existing nodes rather than allocating new ones',
          assert: function (rebuild, api) {
            let root = null;
            const originals = [];
            for (let key = 10; key >= 1; key -= 1) {
              root = { key: key, left: null, right: root, tag: 'original-' + key };
              originals.push(root);
            }

            const rebuilt = rebuild(root);
            const seen = [];
            const walk = function (n) { if (!n) return; walk(n.left); seen.push(n); walk(n.right); };
            walk(rebuilt);

            api.assert.equal(seen.length, 10);
            seen.forEach(function (node) {
              api.assert.equal(node.tag, 'original-' + node.key,
                'node ' + node.key + ' must be the original object, not a copy');
            });
          }
        },
        {
          name: 'it still works on an already balanced tree, and on randomised shapes',
          assert: function (rebuild, api) {
            const rng = api.Random.seeded(17);
            const insert = function (node, key) {
              if (!node) return { key: key, left: null, right: null };
              if (key < node.key) node.left = insert(node.left, key);
              else if (key > node.key) node.right = insert(node.right, key);
              return node;
            };
            const inOrder = function (n) { return n ? inOrder(n.left).concat([n.key], inOrder(n.right)) : []; };
            const height = function (n) { return n ? 1 + Math.max(height(n.left), height(n.right)) : 0; };

            for (let round = 0; round < 10; round += 1) {
              let tree = null;
              const live = new Set();
              for (let i = 0; i < 200; i += 1) {
                const key = rng.int(1000);
                tree = insert(tree, key);
                live.add(key);
              }
              const expected = Array.from(live).sort(function (a, b) { return a - b; });
              const rebuilt = rebuild(tree);
              api.assert.equal(inOrder(rebuilt).join(','), expected.join(','), 'round ' + round);
              api.assert.equal(height(rebuilt), Math.ceil(Math.log2(expected.length + 1)), 'round ' + round + ' height');
            }
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
