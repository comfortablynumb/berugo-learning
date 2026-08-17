/**
 * Graded exercises for the heap sections (M05.5-M05.8): the two lazy heaps,
 * the position map that makes decrease-key addressable, and the wheel.
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'fibonacci-heaps': [{
      id: 'cascading-cut',
      title: 'cut and cascadingCut',
      prompt: 'This is the half of the Fibonacci heap that pays for the amortised bound. ' +
        'cutOut(heap, node) severs node from its parent, clears its mark, appends it to the root ' +
        'list, and then cascades: a parent that was already marked is cut in turn, all the way up; ' +
        'an unmarked non-root parent is marked instead. Nodes are ' +
        '{ key, parent, children, degree, marked }, and heap is { roots }.',
      entry: 'cutOut',
      starter: [
        'function cutOut(heap, node) {',
        '  const parent = node.parent;',
        '  if (!parent) return;',
        '  // remove node from parent.children, clear its mark, push it onto heap.roots',
        '  // then handle the parent: mark it, or cut it too if it was already marked',
        '}'
      ].join('\n'),
      solution: [
        'function cutOut(heap, node) {',
        '  const parent = node.parent;',
        '  if (!parent) return;',
        '',
        '  const at = parent.children.indexOf(node);',
        '  if (at >= 0) parent.children.splice(at, 1);',
        '  parent.degree = parent.children.length;',
        '',
        '  node.parent = null;',
        '  node.marked = false;',
        '  heap.roots.push(node);',
        '',
        '  if (!parent.parent) return;',
        '  if (!parent.marked) { parent.marked = true; return; }',
        '  cutOut(heap, parent);',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a cut node becomes an unmarked root',
          assert: function (cutOut, api) {
            const child = { key: 9, parent: null, children: [], degree: 0, marked: true };
            const parent = { key: 4, parent: null, children: [child], degree: 1, marked: false };
            child.parent = parent;
            const heap = { roots: [parent] };

            cutOut(heap, child);

            api.assert.equal(child.parent, null, 'the cut node has no parent');
            api.assert.equal(child.marked, false, 'a node loses its mark when it becomes a root');
            api.assert.equal(parent.children.length, 0, 'the parent must drop the child');
            api.assert.equal(parent.degree, 0, 'degree must follow the child count');
            api.assert.equal(heap.roots.length, 2, 'the cut node joins the root list');
          }
        },
        {
          name: 'an unmarked parent is marked rather than cut',
          assert: function (cutOut, api) {
            const child = { key: 9, parent: null, children: [], degree: 0, marked: false };
            const middle = { key: 4, parent: null, children: [child], degree: 1, marked: false };
            const top = { key: 1, parent: null, children: [middle], degree: 1, marked: false };
            child.parent = middle;
            middle.parent = top;
            const heap = { roots: [top] };

            cutOut(heap, child);

            api.assert.equal(middle.marked, true, 'losing a first child marks a node');
            api.assert.equal(middle.parent, top, 'but does not cut it');
            api.assert.equal(heap.roots.length, 2, 'only the child moved to the root list');
          }
        },
        {
          name: 'a second loss cascades up the marked chain',
          assert: function (cutOut, api) {
            /* Chain n4 -> n3 -> n2 -> n1 -> n0(root), with every internal node
               already marked: one cut must promote all of them. */
            const chain = [];
            for (let i = 0; i < 5; i += 1) {
              chain.push({ key: i, parent: null, children: [], degree: 0, marked: i > 0 && i < 4 });
            }
            for (let i = 1; i < 5; i += 1) {
              chain[i].parent = chain[i - 1];
              chain[i - 1].children.push(chain[i]);
              chain[i - 1].degree = 1;
            }
            const heap = { roots: [chain[0]] };

            cutOut(heap, chain[4]);

            api.assert.equal(heap.roots.length, 5,
              'the original root, the leaf, and the three marked ancestors between them');
            heap.roots.forEach(function (node) {
              api.assert.equal(node.marked, false, 'node ' + node.key + ' is a root and must be unmarked');
              api.assert.equal(node.parent, null, 'node ' + node.key + ' must have no parent');
            });
            api.assert.equal(chain[0].children.length, 0, 'the true root lost its whole chain');
          }
        },
        {
          name: 'the root is never marked and never cut',
          assert: function (cutOut, api) {
            const child = { key: 9, parent: null, children: [], degree: 0, marked: false };
            const top = { key: 1, parent: null, children: [child], degree: 1, marked: false };
            child.parent = top;
            const heap = { roots: [top] };

            cutOut(heap, child);
            api.assert.equal(top.marked, false, 'a root has no parent to lose, so it stays unmarked');

            cutOut(heap, top);
            api.assert.equal(heap.roots.length, 2, 'cutting a root must be a no-op, not a duplicate push');
          }
        },
        {
          name: 'degrees and child lists stay consistent over a long run',
          assert: function (cutOut, api) {
            const rng = api.Random.seeded(21);
            const nodes = [];
            for (let i = 0; i < 400; i += 1) {
              nodes.push({ key: i, parent: null, children: [], degree: 0, marked: false });
            }
            /* A random forest: each node hangs off an earlier one. */
            const heap = { roots: [nodes[0]] };
            for (let i = 1; i < nodes.length; i += 1) {
              const parent = nodes[rng.int(i)];
              nodes[i].parent = parent;
              parent.children.push(nodes[i]);
              parent.degree = parent.children.length;
              nodes[i].marked = rng.next() < 0.5;
            }

            for (let round = 0; round < 200; round += 1) {
              cutOut(heap, nodes[rng.int(nodes.length)]);
            }

            nodes.forEach(function (node) {
              api.assert.equal(node.degree, node.children.length,
                'node ' + node.key + ' stores a stale degree');
              node.children.forEach(function (child) {
                api.assert.equal(child.parent, node, 'child ' + child.key + ' points at the wrong parent');
              });
              if (!node.parent) {
                api.assert.equal(node.marked, false, 'root ' + node.key + ' must not carry a mark');
              }
            });
          }
        }
      ]
    }],

    'pairing-heaps': [{
      id: 'two-pass-merge',
      title: 'The two-pass merge that makes pop cheap',
      prompt: 'twoPass(children) collapses a popped root\'s child list into one heap. Pair the ' +
        'children left to right, then fold the pairs right to left. The one-pass version - fold ' +
        'straight down the list - is a legal heap and quadratic on the wrong workload, which is why ' +
        'the pairing pass exists. meld(a, b) is given: the smaller key adopts the larger.',
      entry: 'twoPass',
      starter: [
        'function meld(a, b) {',
        '  if (!a) return b;',
        '  if (!b) return a;',
        '  const winner = a.key <= b.key ? a : b;',
        '  const loser = winner === a ? b : a;',
        '  winner.children.push(loser);',
        '  return winner;',
        '}',
        '',
        'function twoPass(children) {',
        '  // pass one: meld children[0] with children[1], [2] with [3], ...',
        '  // pass two: fold those pairs from the right back into one root',
        '  return children[0] || null;',
        '}'
      ].join('\n'),
      solution: [
        'function meld(a, b) {',
        '  if (!a) return b;',
        '  if (!b) return a;',
        '  const winner = a.key <= b.key ? a : b;',
        '  const loser = winner === a ? b : a;',
        '  winner.children.push(loser);',
        '  return winner;',
        '}',
        '',
        'function twoPass(children) {',
        '  if (!children || !children.length) return null;',
        '',
        '  const pairs = [];',
        '  for (let i = 0; i < children.length; i += 2) {',
        '    pairs.push(meld(children[i], children[i + 1] || null));',
        '  }',
        '',
        '  let root = pairs[pairs.length - 1];',
        '  for (let i = pairs.length - 2; i >= 0; i -= 1) {',
        '    root = meld(pairs[i], root);',
        '  }',
        '  return root;',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the result is one heap holding every key',
          assert: function (twoPass, api) {
            const rng = api.Random.seeded(23);
            const children = [];
            const keys = [];
            for (let i = 0; i < 501; i += 1) {
              const key = rng.int(100000);
              keys.push(key);
              children.push({ key: key, children: [] });
            }

            const root = twoPass(children);
            const seen = [];
            const walk = function (node) {
              seen.push(node.key);
              node.children.forEach(function (child) {
                api.assert.ok(node.key <= child.key, 'heap order broken at ' + node.key);
                walk(child);
              });
            };
            walk(root);

            api.assert.equal(seen.length, keys.length, 'every child must end up in the merged heap');
            api.assert.equal(seen.slice().sort(function (a, b) { return a - b; }).join(','),
              keys.slice().sort(function (a, b) { return a - b; }).join(','));
            api.assert.equal(root.key, Math.min.apply(null, keys), 'the smallest key must be the new root');
          }
        },
        {
          name: 'the degenerate list sizes work',
          assert: function (twoPass, api) {
            api.assert.equal(twoPass([]), null, 'no children means no heap');
            const only = { key: 5, children: [] };
            api.assert.equal(twoPass([only]), only, 'a single child is already the answer');

            const a = { key: 8, children: [] };
            const b = { key: 3, children: [] };
            api.assert.equal(twoPass([a, b]).key, 3, 'two children meld into the smaller');
          }
        },
        {
          name: 'pairing halves the depth an ascending list would build',
          assert: function (twoPass, api) {
            /* Ascending children are the one-pass worst case: folding left to
               right chains every node under the first. Pairing first must not. */
            const children = [];
            for (let i = 0; i < 1024; i += 1) children.push({ key: i, children: [] });

            const root = twoPass(children);
            const depth = function (node) {
              let deepest = 0;
              node.children.forEach(function (child) {
                const below = depth(child);
                if (below > deepest) deepest = below;
              });
              return 1 + deepest;
            };

            const measured = depth(root);
            api.assert.ok(measured <= 600,
              'the merged heap is ' + measured + ' deep for 1024 ascending children; ' +
              'a one-pass fold would leave a chain of about 1024');
          }
        },
        {
          name: 'a full pop loop drains in sorted order',
          assert: function (twoPass, api) {
            const meld = function (a, b) {
              if (!a) return b;
              if (!b) return a;
              const winner = a.key <= b.key ? a : b;
              const loser = winner === a ? b : a;
              winner.children.push(loser);
              return winner;
            };

            const rng = api.Random.seeded(29);
            const keys = [];
            let root = null;
            for (let i = 0; i < 3000; i += 1) {
              const key = rng.int(100000);
              keys.push(key);
              root = meld(root, { key: key, children: [] });
            }

            const out = [];
            while (root) {
              out.push(root.key);
              root = twoPass(root.children);
            }

            api.assert.equal(out.join(','), keys.sort(function (a, b) { return a - b; }).join(','),
              'pop is twoPass(root.children) and must produce the sorted order');
          }
        }
      ]
    }],

    'indexed-priority-queues': [{
      id: 'indexed-heap',
      title: 'A heap you can reach into',
      prompt: 'indexedHeap() returns { push, pop, decreaseKey, has, size }. The heap holds ids with ' +
        'priorities; a position map records where each id currently sits so decreaseKey(id, priority) ' +
        'is O(log n) instead of a scan. Every swap must update both entries in the map - forgetting ' +
        'one is the classic bug, and it stays invisible until a decrease-key touches the stale id.',
      entry: 'indexedHeap',
      starter: [
        'function indexedHeap() {',
        '  const items = [];            // { id, priority }',
        '  const position = new Map();  // id -> index in items',
        '',
        '  function swap(a, b) {',
        '    // swap items[a] and items[b] AND both position entries',
        '  }',
        '',
        '  return {',
        '    push: function (id, priority) {},',
        '    pop: function () { return null; },',
        '    decreaseKey: function (id, priority) {},',
        '    has: function (id) { return position.has(id); },',
        '    size: function () { return items.length; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function indexedHeap() {',
        '  const items = [];',
        '  const position = new Map();',
        '',
        '  function swap(a, b) {',
        '    const tmp = items[a];',
        '    items[a] = items[b];',
        '    items[b] = tmp;',
        '    position.set(items[a].id, a);',
        '    position.set(items[b].id, b);',
        '  }',
        '',
        '  function siftUp(index) {',
        '    let at = index;',
        '    while (at > 0) {',
        '      const parent = Math.floor((at - 1) / 2);',
        '      if (items[at].priority >= items[parent].priority) return;',
        '      swap(at, parent);',
        '      at = parent;',
        '    }',
        '  }',
        '',
        '  function siftDown(index) {',
        '    let at = index;',
        '    for (;;) {',
        '      const left = 2 * at + 1;',
        '      if (left >= items.length) return;',
        '      const right = left + 1;',
        '      let best = left;',
        '      if (right < items.length && items[right].priority < items[left].priority) best = right;',
        '      if (items[best].priority >= items[at].priority) return;',
        '      swap(at, best);',
        '      at = best;',
        '    }',
        '  }',
        '',
        '  return {',
        '    push: function (id, priority) {',
        '      if (position.has(id)) return false;',
        '      items.push({ id: id, priority: priority });',
        '      position.set(id, items.length - 1);',
        '      siftUp(items.length - 1);',
        '      return true;',
        '    },',
        '    pop: function () {',
        '      if (!items.length) return null;',
        '      const top = items[0];',
        '      const last = items.pop();',
        '      position.delete(top.id);',
        '      if (items.length) {',
        '        items[0] = last;',
        '        position.set(last.id, 0);',
        '        siftDown(0);',
        '      }',
        '      return top;',
        '    },',
        '    decreaseKey: function (id, priority) {',
        '      const at = position.get(id);',
        '      if (at === undefined) return false;',
        '      if (priority >= items[at].priority) return false;',
        '      items[at].priority = priority;',
        '      siftUp(at);',
        '      return true;',
        '    },',
        '    has: function (id) { return position.has(id); },',
        '    size: function () { return items.length; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'push and pop order by priority',
          assert: function (indexedHeap, api) {
            const heap = indexedHeap();
            const rng = api.Random.seeded(31);
            const expected = [];

            for (let i = 0; i < 2000; i += 1) {
              const priority = rng.int(1000000);
              heap.push('n' + i, priority);
              expected.push(priority);
            }

            api.assert.equal(heap.size(), 2000, 'the heap holds every id');
            expected.sort(function (a, b) { return a - b; });
            for (let i = 0; i < expected.length; i += 1) {
              api.assert.equal(heap.pop().priority, expected[i], 'position ' + i + ' came out of order');
            }
            api.assert.equal(heap.pop(), null, 'an empty heap pops null');
          }
        },
        {
          name: 'the position map tracks every id through every swap',
          assert: function (indexedHeap, api) {
            const heap = indexedHeap();
            const rng = api.Random.seeded(37);
            const live = [];

            for (let i = 0; i < 3000; i += 1) {
              if (live.length && rng.next() < 0.3) {
                const popped = heap.pop();
                live.splice(live.indexOf(popped.id), 1);
                api.assert.equal(heap.has(popped.id), false, popped.id + ' is still in the map after pop');
              } else {
                const id = 'n' + i;
                heap.push(id, rng.int(100000));
                live.push(id);
              }
              if (live.length) {
                api.assert.equal(heap.has(live[rng.int(live.length)]), true,
                  'a live id must still be findable');
              }
            }
          }
        },
        {
          name: 'decreaseKey moves an id up and only up',
          assert: function (indexedHeap, api) {
            const heap = indexedHeap();
            for (let i = 0; i < 500; i += 1) heap.push('n' + i, 1000 + i);

            api.assert.equal(heap.decreaseKey('n499', 1), true, 'lowering a priority must succeed');
            api.assert.equal(heap.pop().id, 'n499', 'the decreased id must now be the minimum');

            api.assert.equal(heap.decreaseKey('n0', 99999), false,
              'raising a priority is not a decrease-key and must be refused');
            api.assert.equal(heap.pop().id, 'n0', 'a refused decrease must leave the heap untouched');

            api.assert.equal(heap.decreaseKey('missing', 1), false, 'an absent id cannot be decreased');
          }
        },
        {
          name: 'a decrease-key storm keeps the heap order',
          assert: function (indexedHeap, api) {
            const heap = indexedHeap();
            const rng = api.Random.seeded(41);
            const best = new Map();

            for (let i = 0; i < 1000; i += 1) {
              const id = 'n' + i;
              const priority = 500000 + rng.int(500000);
              heap.push(id, priority);
              best.set(id, priority);
            }

            for (let round = 0; round < 5000; round += 1) {
              const id = 'n' + rng.int(1000);
              const priority = rng.int(1000000);
              if (priority >= best.get(id)) continue;
              api.assert.equal(heap.decreaseKey(id, priority), true, 'decrease of ' + id + ' must apply');
              best.set(id, priority);
            }

            const expected = Array.from(best.values()).sort(function (a, b) { return a - b; });
            for (let i = 0; i < expected.length; i += 1) {
              const popped = heap.pop();
              api.assert.equal(popped.priority, expected[i],
                'position ' + i + ' is wrong - a swap probably left a stale position entry');
              api.assert.equal(best.get(popped.id), popped.priority,
                popped.id + ' came out with a priority it never had');
            }
          }
        }
      ]
    }],

    'timers-and-events': [{
      id: 'timer-wheel',
      title: 'A single-level timer wheel',
      prompt: 'timerWheel(slots) returns { add, cancel, tick, pending }. add(id, delay) files a timer ' +
        'into slot (now + delay) % slots; cancel(id) removes it; tick() advances one step and fires ' +
        'only the entries in the current slot that are actually due - an entry whose deadline is a ' +
        'whole revolution away sits in the same slot and must be left alone. tick must touch one ' +
        'slot, never the whole wheel, and delay is at least 1.',
      entry: 'timerWheel',
      starter: [
        'function timerWheel(slots) {',
        '  const wheel = [];',
        '  for (let i = 0; i < slots; i += 1) wheel.push([]);',
        '  let now = 0;',
        '',
        '  return {',
        '    add: function (id, delay) {},',
        '    cancel: function (id) { return false; },',
        '    tick: function () { return []; },   // ids fired this step',
        '    pending: function () { return 0; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function timerWheel(slots) {',
        '  const wheel = [];',
        '  for (let i = 0; i < slots; i += 1) wheel.push([]);',
        '  const index = new Map();',
        '  let now = 0;',
        '  let count = 0;',
        '',
        '  return {',
        '    add: function (id, delay) {',
        '      if (index.has(id)) return false;',
        '      const due = now + Math.max(1, delay);',
        '      const entry = { id: id, due: due, cancelled: false };',
        '      wheel[due % slots].push(entry);',
        '      index.set(id, entry);',
        '      count += 1;',
        '      return true;',
        '    },',
        '    cancel: function (id) {',
        '      const entry = index.get(id);',
        '      if (!entry || entry.cancelled) return false;',
        '      entry.cancelled = true;',
        '      index.delete(id);',
        '      count -= 1;',
        '      return true;',
        '    },',
        '    tick: function () {',
        '      now += 1;',
        '      const slot = wheel[now % slots];',
        '      const fired = [];',
        '      const keep = [];',
        '',
        '      slot.forEach(function (entry) {',
        '        if (entry.cancelled) return;',
        '        if (entry.due > now) { keep.push(entry); return; }',
        '        fired.push(entry.id);',
        '        index.delete(entry.id);',
        '        count -= 1;',
        '      });',
        '',
        '      wheel[now % slots] = keep;',
        '      return fired;',
        '    },',
        '    pending: function () { return count; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'a timer fires exactly on its deadline',
          assert: function (timerWheel, api) {
            const wheel = timerWheel(8);
            wheel.add('a', 1);
            wheel.add('b', 3);
            wheel.add('c', 8);

            api.assert.equal(wheel.tick().join(','), 'a', 'tick 1 fires a');
            api.assert.equal(wheel.tick().join(','), '', 'tick 2 fires nothing');
            api.assert.equal(wheel.tick().join(','), 'b', 'tick 3 fires b');
            for (let i = 4; i < 8; i += 1) {
              api.assert.equal(wheel.tick().join(','), '', 'tick ' + i + ' fires nothing');
            }
            api.assert.equal(wheel.tick().join(','), 'c', 'tick 8 fires c');
            api.assert.equal(wheel.pending(), 0, 'nothing is left pending');
          }
        },
        {
          name: 'a delay that is an exact multiple of the wheel waits a full revolution',
          assert: function (timerWheel, api) {
            /* delay === slots lands back in the slot it was filed from, so a
               wheel that fires everything it finds fires this one at once. */
            const wheel = timerWheel(16);
            wheel.add('exact', 16);
            wheel.add('double', 32);

            for (let step = 1; step <= 15; step += 1) {
              api.assert.equal(wheel.tick().length, 0, 'nothing may fire at step ' + step);
            }
            api.assert.equal(wheel.tick().join(','), 'exact', 'the exact-multiple timer fires at 16');
            for (let step = 17; step <= 31; step += 1) {
              api.assert.equal(wheel.tick().length, 0, 'nothing may fire at step ' + step);
            }
            api.assert.equal(wheel.tick().join(','), 'double', 'the two-revolution timer fires at 32');
          }
        },
        {
          name: 'a cancelled timer never fires',
          assert: function (timerWheel, api) {
            const wheel = timerWheel(64);
            const rng = api.Random.seeded(43);
            const cancelled = {};

            for (let i = 0; i < 5000; i += 1) wheel.add('t' + i, 1 + rng.int(500));
            for (let i = 0; i < 5000; i += 1) {
              if (rng.next() < 0.5) { wheel.cancel('t' + i); cancelled['t' + i] = true; }
            }

            api.assert.equal(wheel.cancel('t0'), false,
              'cancelling an already-cancelled timer must report false');

            for (let step = 0; step < 600; step += 1) {
              wheel.tick().forEach(function (id) {
                api.assert.ok(!cancelled[id], id + ' was cancelled and must never fire');
              });
            }
            api.assert.equal(wheel.pending(), 0, 'every live timer fired inside 600 ticks');
          }
        },
        {
          name: 'every timer fires once, on the right tick',
          assert: function (timerWheel, api) {
            const wheel = timerWheel(32);
            const rng = api.Random.seeded(47);
            const due = new Map();

            for (let i = 0; i < 4000; i += 1) {
              const delay = 1 + rng.int(200);
              wheel.add('t' + i, delay);
              due.set('t' + i, delay);
            }

            let fired = 0;
            for (let step = 1; step <= 200; step += 1) {
              const now = step;
              wheel.tick().forEach(function (id) {
                api.assert.equal(due.get(id), now, id + ' fired at ' + now + ' instead of ' + due.get(id));
                due.delete(id);
                fired += 1;
              });
            }

            api.assert.equal(fired, 4000, 'all 4000 timers must fire');
            api.assert.equal(due.size, 0, 'no timer may be left behind');
          }
        },
        {
          name: 'a tick touches one slot, not the whole wheel',
          assert: function (timerWheel, api) {
            /* Far-future timers must not be walked on every tick: with 200 000
               timers a scan-the-wheel implementation blows the time budget. */
            const wheel = timerWheel(256);
            const rng = api.Random.seeded(53);

            for (let i = 0; i < 200000; i += 1) wheel.add('t' + i, 5000 + rng.int(5000));

            for (let step = 0; step < 4000; step += 1) {
              api.assert.equal(wheel.tick().length, 0, 'nothing is due yet at step ' + step);
            }
            api.assert.equal(wheel.pending(), 200000, 'every timer is still waiting');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
