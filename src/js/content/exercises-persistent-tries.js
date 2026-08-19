/**
 * Graded exercises for the trie, finger-tree and zipper sections (M09.4-M09.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'bit-partitioned-tries': [{
      id: 'popcount-sparse-nodes',
      title: 'A 32-way trie whose nodes hold only the slots that exist',
      prompt: 'makeMap() must return { empty, assoc, get, entries }. Build a persistent map over 5-bit chunks ' +
        'of the provided 32-bit hash. A branch is { kind: \'branch\', bitmap, slots } and the graded property is ' +
        'the one that makes the structure worth using: `slots` holds *only* the occupied children, in bitmap ' +
        'order, so slots.length === popcount(bitmap) at every node and the child for chunk c lives at index ' +
        'popcount(bitmap & ((1 << c) - 1)). Leaves are { kind: \'leaf\', hash, key, value } and equal hashes ' +
        'collect into { kind: \'collision\', hash, entries }. assoc returns a new root and leaves the old one alone.',
      entry: 'makeMap',
      starter: [
        'function makeMap() {',
        '  const BITS = 5;',
        '',
        '  // provided: a 32-bit FNV-1a hash and a population count',
        '  function hashOf(key) {',
        '    let h = 0x811c9dc5;',
        '    const text = String(key);',
        '    for (let i = 0; i < text.length; i += 1) {',
        '      h ^= text.charCodeAt(i);',
        '      h = Math.imul(h, 0x01000193) >>> 0;',
        '    }',
        '    return h >>> 0;',
        '  }',
        '  function popcount(word) { let n = word, c = 0; while (n) { n &= n - 1; c += 1; } return c; }',
        '  function chunk(hash, depth) { return (hash >>> (depth * BITS)) & 31; }',
        '',
        '  function leaf(hash, key, value) { return { kind: \'leaf\', hash: hash, key: key, value: value }; }',
        '',
        '  // a dense branch: correct, and 32 slots wide however few children it has',
        '  function branch() { return { kind: \'branch\', bitmap: 0, slots: new Array(32).fill(null) }; }',
        '',
        '  function assoc(node, depth, hash, key, value) {',
        '    if (!node) return leaf(hash, key, value);',
        '    if (node.kind === \'leaf\') {',
        '      if (node.key === key) return leaf(hash, key, value);',
        '      if (node.hash === hash || depth >= 6) {',
        '        return { kind: \'collision\', hash: node.hash, entries: [',
        '          { key: node.key, value: node.value }, { key: key, value: value }] };',
        '      }',
        '      const promoted = branch();',
        '      promoted.bitmap = 1 << chunk(node.hash, depth);',
        '      promoted.slots[chunk(node.hash, depth)] = node;',
        '      return assoc(promoted, depth, hash, key, value);',
        '    }',
        '    if (node.kind === \'collision\') {',
        '      const entries = node.entries.filter(function (e) { return e.key !== key; });',
        '      return { kind: \'collision\', hash: node.hash, entries: entries.concat([{ key: key, value: value }]) };',
        '    }',
        '    const at = chunk(hash, depth);',
        '    const slots = node.slots.slice();',
        '    slots[at] = assoc(node.slots[at], depth + 1, hash, key, value);',
        '    return { kind: \'branch\', bitmap: node.bitmap | (1 << at), slots: slots };',
        '  }',
        '',
        '  function lookup(node, depth, hash, key) {',
        '    if (!node) return undefined;',
        '    if (node.kind === \'leaf\') return node.key === key ? node.value : undefined;',
        '    if (node.kind === \'collision\') {',
        '      const hit = node.entries.filter(function (e) { return e.key === key; })[0];',
        '      return hit ? hit.value : undefined;',
        '    }',
        '    return lookup(node.slots[chunk(hash, depth)], depth + 1, hash, key);',
        '  }',
        '',
        '  function collect(node, out) {',
        '    if (!node) return out;',
        '    if (node.kind === \'leaf\') { out.push({ key: node.key, value: node.value }); return out; }',
        '    if (node.kind === \'collision\') { node.entries.forEach(function (e) { out.push(e); }); return out; }',
        '    node.slots.forEach(function (child) { collect(child, out); });',
        '    return out;',
        '  }',
        '',
        '  return {',
        '    empty: function () { return null; },',
        '    assoc: function (node, key, value) { return assoc(node, 0, hashOf(key), key, value); },',
        '    get: function (node, key) { return lookup(node, 0, hashOf(key), key); },',
        '    entries: function (node) { return collect(node, []); }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeMap() {',
        '  const BITS = 5;',
        '',
        '  function hashOf(key) {',
        '    let h = 0x811c9dc5;',
        '    const text = String(key);',
        '    for (let i = 0; i < text.length; i += 1) {',
        '      h ^= text.charCodeAt(i);',
        '      h = Math.imul(h, 0x01000193) >>> 0;',
        '    }',
        '    return h >>> 0;',
        '  }',
        '  function popcount(word) { let n = word, c = 0; while (n) { n &= n - 1; c += 1; } return c; }',
        '  function chunk(hash, depth) { return (hash >>> (depth * BITS)) & 31; }',
        '',
        '  function leaf(hash, key, value) { return { kind: \'leaf\', hash: hash, key: key, value: value }; }',
        '',
        '  // the two lines the whole structure rests on: a bit says whether the',
        '  // child exists, and the ones below it say where it sits',
        '  function bitFor(hash, depth) { return 1 << chunk(hash, depth); }',
        '  function slotFor(bitmap, bit) { return popcount(bitmap & (bit - 1)); }',
        '',
        '  function assoc(node, depth, hash, key, value) {',
        '    if (!node) return leaf(hash, key, value);',
        '    if (node.kind === \'leaf\') {',
        '      if (node.key === key) return leaf(hash, key, value);',
        '      if (node.hash === hash || depth >= 6) {',
        '        return { kind: \'collision\', hash: node.hash, entries: [',
        '          { key: node.key, value: node.value }, { key: key, value: value }] };',
        '      }',
        '      const promoted = { kind: \'branch\', bitmap: bitFor(node.hash, depth), slots: [node] };',
        '      return assoc(promoted, depth, hash, key, value);',
        '    }',
        '    if (node.kind === \'collision\') {',
        '      const entries = node.entries.filter(function (e) { return e.key !== key; });',
        '      return { kind: \'collision\', hash: node.hash, entries: entries.concat([{ key: key, value: value }]) };',
        '    }',
        '    const bit = bitFor(hash, depth);',
        '    const index = slotFor(node.bitmap, bit);',
        '    const slots = node.slots.slice();',
        '    if (node.bitmap & bit) slots[index] = assoc(node.slots[index], depth + 1, hash, key, value);',
        '    else slots.splice(index, 0, leaf(hash, key, value));',
        '    return { kind: \'branch\', bitmap: node.bitmap | bit, slots: slots };',
        '  }',
        '',
        '  function lookup(node, depth, hash, key) {',
        '    if (!node) return undefined;',
        '    if (node.kind === \'leaf\') return node.key === key ? node.value : undefined;',
        '    if (node.kind === \'collision\') {',
        '      const hit = node.entries.filter(function (e) { return e.key === key; })[0];',
        '      return hit ? hit.value : undefined;',
        '    }',
        '    const bit = bitFor(hash, depth);',
        '    if (!(node.bitmap & bit)) return undefined;',
        '    return lookup(node.slots[slotFor(node.bitmap, bit)], depth + 1, hash, key);',
        '  }',
        '',
        '  function collect(node, out) {',
        '    if (!node) return out;',
        '    if (node.kind === \'leaf\') { out.push({ key: node.key, value: node.value }); return out; }',
        '    if (node.kind === \'collision\') { node.entries.forEach(function (e) { out.push(e); }); return out; }',
        '    node.slots.forEach(function (child) { collect(child, out); });',
        '    return out;',
        '  }',
        '',
        '  return {',
        '    empty: function () { return null; },',
        '    assoc: function (node, key, value) { return assoc(node, 0, hashOf(key), key, value); },',
        '    get: function (node, key) { return lookup(node, 0, hashOf(key), key); },',
        '    entries: function (node) { return collect(node, []); }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'every node holds exactly popcount(bitmap) slots',
          assert: function (makeMap, api) {
            const random = api.rng;
            const map = makeMap();
            let node = map.empty();
            for (let i = 0; i < 2000; i += 1) node = map.assoc(node, 'key-' + random.int(100000), i);

            function popcount(word) { let n = word, c = 0; while (n) { n &= n - 1; c += 1; } return c; }
            let branches = 0;

            (function walk(current) {
              if (!current || current.kind !== 'branch') return;
              branches += 1;
              api.assert.equal(current.slots.length, popcount(current.bitmap),
                'a branch with bitmap popcount ' + popcount(current.bitmap) +
                ' held ' + current.slots.length + ' slots');
              current.slots.forEach(function (child) {
                api.assert.ok(child, 'a compact node must not contain an empty slot');
                walk(child);
              });
            }(node));

            api.assert.atLeast(branches, 50, 'the trie should have branched by 2 000 keys');
          }
        },
        {
          name: 'lookups agree with a plain map',
          assert: function (makeMap, api) {
            const random = api.rng;
            const map = makeMap();
            const model = {};
            let node = map.empty();

            for (let i = 0; i < 1500; i += 1) {
              const key = 'k' + random.int(600);
              const value = random.int(1000000);
              node = map.assoc(node, key, value);
              model[key] = value;
            }

            Object.keys(model).forEach(function (key) {
              api.assert.equal(map.get(node, key), model[key], 'lookup of ' + key);
            });
            api.assert.equal(map.get(node, 'absent-key'), undefined);
            api.assert.equal(map.entries(node).length, Object.keys(model).length);
          }
        },
        {
          name: 'the root you passed in still answers the old way',
          assert: function (makeMap, api) {
            const map = makeMap();
            let base = map.empty();
            for (let i = 0; i < 400; i += 1) base = map.assoc(base, 'id-' + i, i);

            const changed = map.assoc(map.assoc(base, 'id-7', 999), 'id-fresh', 1);
            api.assert.equal(map.get(base, 'id-7'), 7, 'the old version must keep the old value');
            api.assert.equal(map.get(changed, 'id-7'), 999);
            api.assert.equal(map.get(base, 'id-fresh'), undefined);
            api.assert.equal(map.get(changed, 'id-fresh'), 1);
            api.assert.equal(map.entries(base).length, 400);
          }
        },
        {
          name: 'the trie stays shallow and its slots stay dense',
          assert: function (makeMap, api) {
            const map = makeMap();
            let node = map.empty();
            for (let i = 0; i < 3000; i += 1) node = map.assoc(node, 'entry:' + i, i);

            let slots = 0;
            let deepest = 0;

            (function walk(current, depth) {
              if (!current) return;
              deepest = Math.max(deepest, depth);
              if (current.kind !== 'branch') return;
              slots += current.slots.length;
              current.slots.forEach(function (child) { walk(child, depth + 1); });
            }(node, 0));

            api.assert.atMost(deepest, 7, 'a 5-bit trie over 3 000 keys should not be ' + deepest + ' deep');
            api.assert.atMost(slots / 3000, 1.6,
              (slots / 3000).toFixed(2) + ' slots per key - a dense node array wastes the rest');
          }
        }
      ]
    }],

    'finger-trees': [{
      id: 'measured-split',
      title: 'Splitting by measure, not by index',
      prompt: 'makeMeasuredTree(monoid) is given fromArray/toArray and a balanced tree of measured nodes. ' +
        'Write measure(tree) and split(tree, predicate). The split point is the first position where the ' +
        'measure of the prefix satisfies the predicate; return { left, right } whose contents concatenate back ' +
        'to the original. The graded part is *how* you find it: descend by comparing the accumulated measure ' +
        'against each subtree\'s cached annotation, so a 4 096-element tree is split by reading a handful of ' +
        'annotations. Every read of node.measure is counted, and the test checks the count.',
      entry: 'makeMeasuredTree',
      starter: [
        'function makeMeasuredTree(monoid) {',
        '  let measureReads = 0;',
        '',
        '  // provided: nodes whose `measure` is cached at construction and counted on read',
        '  function annotate(node, value) {',
        '    node.built = value;  // the same number, readable while building without being counted',
        '    Object.defineProperty(node, \'measure\', {',
        '      get: function () { measureReads += 1; return value; }',
        '    });',
        '    return node;',
        '  }',
        '  function leaf(item) { return annotate({ leaf: true, item: item, size: 1 }, monoid.lift(item)); }',
        '  function branch(left, right) {',
        '    return annotate({ leaf: false, left: left, right: right, size: left.size + right.size },',
        '      monoid.combine(left.built, right.built));',
        '  }',
        '  function fromArray(items) {',
        '    if (!items.length) return null;',
        '    let level = items.map(leaf);',
        '    while (level.length > 1) {',
        '      const next = [];',
        '      for (let i = 0; i < level.length; i += 2) {',
        '        next.push(i + 1 < level.length ? branch(level[i], level[i + 1]) : level[i]);',
        '      }',
        '      level = next;',
        '    }',
        '    return level[0];',
        '  }',
        '  function toArray(tree) {',
        '    const out = [];',
        '    (function walk(n) { if (!n) return; if (n.leaf) { out.push(n.item); return; } walk(n.left); walk(n.right); }(tree));',
        '    return out;',
        '  }',
        '',
        '  return {',
        '    fromArray: fromArray,',
        '    toArray: toArray,',
        '    measure: function (tree) { return tree ? tree.measure : monoid.empty; },',
        '    // correct, and it reads every annotation in the tree to get there',
        '    split: function (tree, predicate) {',
        '      const items = toArray(tree);',
        '      let accumulated = monoid.empty;',
        '      let at = items.length;',
        '      for (let i = 0; i < items.length; i += 1) {',
        '        accumulated = monoid.combine(accumulated, leaf(items[i]).measure);',
        '        if (predicate(accumulated)) { at = i; break; }',
        '      }',
        '      return { left: fromArray(items.slice(0, at)), right: fromArray(items.slice(at)) };',
        '    },',
        '    stats: function () { return { measureReads: measureReads }; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeMeasuredTree(monoid) {',
        '  let measureReads = 0;',
        '',
        '  function annotate(node, value) {',
        '    node.built = value;  // the same number, readable while building without being counted',
        '    Object.defineProperty(node, \'measure\', {',
        '      get: function () { measureReads += 1; return value; }',
        '    });',
        '    return node;',
        '  }',
        '  function leaf(item) { return annotate({ leaf: true, item: item, size: 1 }, monoid.lift(item)); }',
        '  function branch(left, right) {',
        '    return annotate({ leaf: false, left: left, right: right, size: left.size + right.size },',
        '      monoid.combine(left.built, right.built));',
        '  }',
        '  function fromArray(items) {',
        '    if (!items.length) return null;',
        '    let level = items.map(leaf);',
        '    while (level.length > 1) {',
        '      const next = [];',
        '      for (let i = 0; i < level.length; i += 2) {',
        '        next.push(i + 1 < level.length ? branch(level[i], level[i + 1]) : level[i]);',
        '      }',
        '      level = next;',
        '    }',
        '    return level[0];',
        '  }',
        '  function toArray(tree) {',
        '    const out = [];',
        '    (function walk(n) { if (!n) return; if (n.leaf) { out.push(n.item); return; } walk(n.left); walk(n.right); }(tree));',
        '    return out;',
        '  }',
        '',
        '  // the annotation on the left child answers "is the split in here?"',
        '  // in one read, so a whole subtree is skipped without being walked',
        '  function locate(node, accumulated, predicate) {',
        '    if (node.leaf) return 0;',
        '    const throughLeft = monoid.combine(accumulated, node.left.measure);',
        '    if (predicate(throughLeft)) return locate(node.left, accumulated, predicate);',
        '    return node.left.size + locate(node.right, throughLeft, predicate);',
        '  }',
        '',
        '  return {',
        '    fromArray: fromArray,',
        '    toArray: toArray,',
        '    measure: function (tree) { return tree ? tree.measure : monoid.empty; },',
        '    split: function (tree, predicate) {',
        '      if (!tree) return { left: null, right: null };',
        '      const items = toArray(tree);',
        '      if (!predicate(tree.measure)) return { left: tree, right: null };',
        '      const at = locate(tree, monoid.empty, predicate);',
        '      return { left: fromArray(items.slice(0, at)), right: fromArray(items.slice(at)) };',
        '    },',
        '    stats: function () { return { measureReads: measureReads }; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the two halves concatenate back to the original',
          assert: function (makeMeasuredTree, api) {
            const random = api.rng;
            const sum = {
              empty: 0,
              lift: function (item) { return item; },
              combine: function (a, b) { return a + b; }
            };
            const tree = makeMeasuredTree(sum);
            const items = [];
            for (let i = 0; i < 600; i += 1) items.push(random.int(20) + 1);
            const built = tree.fromArray(items);

            for (let trial = 0; trial < 40; trial += 1) {
              const target = random.int(tree.measure(built) + 20);
              const parts = tree.split(built, function (m) { return m > target; });
              const rebuilt = tree.toArray(parts.left).concat(tree.toArray(parts.right));
              api.assert.deepEqual(rebuilt, items, 'target ' + target + ' lost or reordered elements');
            }
          }
        },
        {
          name: 'the split point is the first prefix that satisfies the predicate',
          assert: function (makeMeasuredTree, api) {
            const random = api.rng;
            const sum = {
              empty: 0,
              lift: function (item) { return item; },
              combine: function (a, b) { return a + b; }
            };
            const tree = makeMeasuredTree(sum);
            const items = [];
            for (let i = 0; i < 400; i += 1) items.push(random.int(9) + 1);
            const built = tree.fromArray(items);

            for (let trial = 0; trial < 30; trial += 1) {
              const target = random.int(2200);
              let running = 0;
              let want = items.length;
              for (let i = 0; i < items.length; i += 1) {
                running += items[i];
                if (running > target) { want = i; break; }
              }
              const parts = tree.split(built, function (m) { return m > target; });
              api.assert.equal(tree.toArray(parts.left).length, want,
                'split at ' + target + ' put ' + tree.toArray(parts.left).length + ' left, expected ' + want);
            }
          }
        },
        {
          name: 'a different monoid splits at a different place, with the same code',
          assert: function (makeMeasuredTree, api) {
            const longest = {
              empty: 0,
              lift: function (item) { return String(item).length; },
              combine: function (a, b) { return Math.max(a, b); }
            };
            const tree = makeMeasuredTree(longest);
            const words = ['a', 'bb', 'c', 'dddd', 'ee', 'f', 'ggggggg', 'h'];
            const built = tree.fromArray(words);

            api.assert.equal(tree.measure(built), 7, 'the root measure is the longest word');
            const parts = tree.split(built, function (m) { return m >= 4; });
            api.assert.deepEqual(tree.toArray(parts.left), ['a', 'bb', 'c']);
            api.assert.deepEqual(tree.toArray(parts.right), ['dddd', 'ee', 'f', 'ggggggg', 'h']);
          }
        },
        {
          name: 'the descent reads a handful of annotations, not all of them',
          assert: function (makeMeasuredTree, api) {
            const size = {
              empty: 0,
              lift: function () { return 1; },
              combine: function (a, b) { return a + b; }
            };
            const tree = makeMeasuredTree(size);
            const items = [];
            for (let i = 0; i < 4096; i += 1) items.push(i);
            const built = tree.fromArray(items);

            const before = tree.stats().measureReads;
            tree.split(built, function (m) { return m > 2731; });
            const reads = tree.stats().measureReads - before;

            api.assert.atMost(reads, 64,
              reads + ' annotation reads to split 4 096 elements; the descent needs about ⌈log₂ n⌉');
          }
        }
      ]
    }],

    zippers: [{
      id: 'tree-zipper',
      title: 'A zipper that rebuilds the path and shares everything else',
      prompt: 'makeZipper() must return { from, down, up, left, right, replace, focus, toRoot }. A tree node is ' +
        '{ value, children }. A zipper holds the focused node plus enough context to walk back out. ' +
        'down(z, i) enters child i, up(z) rebuilds the parent, left/right step between siblings, replace(z, node) ' +
        'swaps the focus, focus(z) reads it and toRoot(z) walks all the way out. The graded property is sharing: ' +
        'after an edit, every subtree you did not pass through must come back === the original object, so a ' +
        'rebuild costs the depth rather than the tree.',
      entry: 'makeZipper',
      starter: [
        'function makeZipper() {',
        '  function from(tree) { return { focus: tree, path: [] }; }',
        '',
        '  // a deep copy on the way out: correct shape, no sharing at all',
        '  function copy(node) {',
        '    return { value: node.value, children: (node.children || []).map(copy) };',
        '  }',
        '',
        '  function down(z, index) {',
        '    const children = z.focus.children || [];',
        '    if (index < 0 || index >= children.length) return null;',
        '    return {',
        '      focus: children[index],',
        '      path: z.path.concat([{ value: z.focus.value, children: children, index: index }])',
        '    };',
        '  }',
        '',
        '  function up(z) {',
        '    if (!z.path.length) return null;',
        '    const step = z.path[z.path.length - 1];',
        '    const children = step.children.slice();',
        '    children[step.index] = z.focus;',
        '    return { focus: copy({ value: step.value, children: children }), path: z.path.slice(0, -1) };',
        '  }',
        '',
        '  function sibling(z, delta) {',
        '    if (!z.path.length) return null;',
        '    const step = z.path[z.path.length - 1];',
        '    const index = step.index + delta;',
        '    if (index < 0 || index >= step.children.length) return null;',
        '    const children = step.children.slice();',
        '    children[step.index] = z.focus;',
        '    return {',
        '      focus: children[index],',
        '      path: z.path.slice(0, -1).concat([{ value: step.value, children: children, index: index }])',
        '    };',
        '  }',
        '',
        '  return {',
        '    from: from,',
        '    down: down,',
        '    up: up,',
        '    left: function (z) { return sibling(z, -1); },',
        '    right: function (z) { return sibling(z, 1); },',
        '    replace: function (z, node) { return { focus: node, path: z.path }; },',
        '    focus: function (z) { return z.focus; },',
        '    toRoot: function (z) { let current = z; while (current.path.length) current = up(current); return current.focus; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeZipper() {',
        '  function from(tree) { return { focus: tree, path: [] }; }',
        '',
        '  function down(z, index) {',
        '    const children = z.focus.children || [];',
        '    if (index < 0 || index >= children.length) return null;',
        '    return {',
        '      focus: children[index],',
        '      path: z.path.concat([{ value: z.focus.value, children: children, index: index }])',
        '    };',
        '  }',
        '',
        '  // the parent is rebuilt with one slot changed; every other child is',
        '  // put back by reference, so an untouched subtree is the same object',
        '  function up(z) {',
        '    if (!z.path.length) return null;',
        '    const step = z.path[z.path.length - 1];',
        '    if (step.children[step.index] === z.focus) {',
        '      return { focus: { value: step.value, children: step.children }, path: z.path.slice(0, -1) };',
        '    }',
        '    const children = step.children.slice();',
        '    children[step.index] = z.focus;',
        '    return { focus: { value: step.value, children: children }, path: z.path.slice(0, -1) };',
        '  }',
        '',
        '  function sibling(z, delta) {',
        '    if (!z.path.length) return null;',
        '    const step = z.path[z.path.length - 1];',
        '    const index = step.index + delta;',
        '    if (index < 0 || index >= step.children.length) return null;',
        '    const children = step.children.slice();',
        '    children[step.index] = z.focus;',
        '    return {',
        '      focus: children[index],',
        '      path: z.path.slice(0, -1).concat([{ value: step.value, children: children, index: index }])',
        '    };',
        '  }',
        '',
        '  return {',
        '    from: from,',
        '    down: down,',
        '    up: up,',
        '    left: function (z) { return sibling(z, -1); },',
        '    right: function (z) { return sibling(z, 1); },',
        '    replace: function (z, node) { return { focus: node, path: z.path }; },',
        '    focus: function (z) { return z.focus; },',
        '    toRoot: function (z) { let current = z; while (current.path.length) current = up(current); return current.focus; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'walking down and back out with no edit returns the same tree',
          assert: function (makeZipper, api) {
            const random = api.rng;
            const zip = makeZipper();

            function build(depth, label) {
              if (depth === 0) return { value: label, children: [] };
              const children = [];
              for (let i = 0; i < 3; i += 1) children.push(build(depth - 1, label + '.' + i));
              return { value: label, children: children };
            }

            const tree = build(5, 'r');
            for (let trial = 0; trial < 20; trial += 1) {
              let z = zip.from(tree);
              for (let step = 0; step < 5; step += 1) z = zip.down(z, random.int(3));
              const back = zip.toRoot(z);
              api.assert.deepEqual(back, tree, 'a round trip changed the tree on trial ' + trial);
            }
          }
        },
        {
          name: 'an edit rebuilds the path and shares every other subtree',
          assert: function (makeZipper, api) {
            const zip = makeZipper();

            function build(depth, label) {
              if (depth === 0) return { value: label, children: [] };
              const children = [];
              for (let i = 0; i < 4; i += 1) children.push(build(depth - 1, label + '.' + i));
              return { value: label, children: children };
            }

            const tree = build(4, 'r');
            let z = zip.from(tree);
            const passed = [];
            [1, 2, 0, 3].forEach(function (index) {
              passed.push(z.focus);
              z = zip.down(z, index);
            });
            const edited = zip.toRoot(zip.replace(z, { value: 'edited', children: [] }));

            let shared = 0;
            let copied = 0;
            (function compare(before, after) {
              if (before === after) { shared += 1; return; }
              copied += 1;
              (before.children || []).forEach(function (child, i) { compare(child, after.children[i]); });
            }(tree, edited));

            api.assert.equal(copied, 5, copied + ' nodes rebuilt; the path is 4 deep plus the new leaf');
            api.assert.atLeast(shared, 12, 'only ' + shared + ' subtrees came back by reference');
            api.assert.equal(passed.length, 4);
          }
        },
        {
          name: 'left and right move among siblings without disturbing them',
          assert: function (makeZipper, api) {
            const zip = makeZipper();
            const tree = {
              value: 'root',
              children: [
                { value: 'a', children: [] },
                { value: 'b', children: [] },
                { value: 'c', children: [] }
              ]
            };

            let z = zip.down(zip.from(tree), 1);
            api.assert.equal(zip.focus(z).value, 'b');
            api.assert.equal(zip.focus(zip.left(z)).value, 'a');
            api.assert.equal(zip.focus(zip.right(z)).value, 'c');
            api.assert.equal(zip.left(zip.down(zip.from(tree), 0)), null, 'no sibling to the left of the first');
            api.assert.equal(zip.right(zip.down(zip.from(tree), 2)), null, 'nor right of the last');

            const moved = zip.toRoot(zip.right(zip.right(zip.left(z))));
            api.assert.deepEqual(moved, tree, 'moving between siblings must not change the tree');
          }
        },
        {
          name: 'edits at several places accumulate correctly',
          assert: function (makeZipper, api) {
            const zip = makeZipper();
            const tree = {
              value: 'root',
              children: [
                { value: 'x', children: [{ value: 'x1', children: [] }, { value: 'x2', children: [] }] },
                { value: 'y', children: [{ value: 'y1', children: [] }] }
              ]
            };

            let z = zip.down(zip.down(zip.from(tree), 0), 1);
            z = zip.replace(z, { value: 'X2', children: [] });
            z = zip.up(z);
            z = zip.up(z);
            z = zip.down(zip.down(z, 1), 0);
            z = zip.replace(z, { value: 'Y1', children: [] });
            const result = zip.toRoot(z);

            api.assert.equal(result.children[0].children[1].value, 'X2');
            api.assert.equal(result.children[1].children[0].value, 'Y1');
            api.assert.equal(result.children[0].children[0].value, 'x1');
            api.assert.equal(tree.children[0].children[1].value, 'x2', 'the original must be untouched');
            api.assert.equal(tree.children[1].children[0].value, 'y1');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
