/**
 * Graded exercises for the succinct sections (M09.7-M09.9).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'rank-and-select': [{
      id: 'rank-select-index',
      title: 'rank in a constant number of probes, select without a scan',
      prompt: 'makeBitVector(bits) must return { rank1, select1, stats }. rank1(i) counts the set bits strictly ' +
        'before position i; select1(k) returns the position of the k-th set bit, 1-based. The bits are packed ' +
        'into 32-bit words behind the provided word(i) accessor, and every call to it is counted. Build the ' +
        'two-level index - a cumulative count per 2 048-bit superblock and a relative count per 256-bit block - ' +
        'so rank1 reads at most one block of words and select1 finds its block through the index rather than by ' +
        'walking the vector. stats() reports { wordProbes, indexBytes }.',
      entry: 'makeBitVector',
      starter: [
        'function makeBitVector(bits) {',
        '  const WORD = 32;',
        '  const length = bits.length;',
        '  let wordProbes = 0;',
        '',
        '  // provided: the packed vector, reachable only through word(i)',
        '  const words = new Uint32Array(Math.ceil(length / WORD) + 1);',
        '  for (let i = 0; i < length; i += 1) {',
        '    if (bits[i]) words[i >>> 5] |= (1 << (i & 31));',
        '  }',
        '  function word(index) { wordProbes += 1; return words[index] >>> 0; }',
        '  function popcount(value) {',
        '    let n = value - ((value >>> 1) & 0x55555555);',
        '    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);',
        '    n = (n + (n >>> 4)) & 0x0f0f0f0f;',
        '    return (Math.imul(n, 0x01010101) >>> 24);',
        '  }',
        '',
        '  // correct, and it reads the whole prefix every single time',
        '  function rank1(at) {',
        '    const limit = Math.min(Math.max(at, 0), length);',
        '    let ones = 0;',
        '    for (let i = 0; i < (limit >>> 5); i += 1) ones += popcount(word(i));',
        '    const rest = limit & 31;',
        '    if (rest) ones += popcount(word(limit >>> 5) & ((1 << rest) - 1));',
        '    return ones;',
        '  }',
        '',
        '  function select1(k) {',
        '    if (k < 1) return -1;',
        '    let seen = 0;',
        '    for (let i = 0; i < length; i += 1) {',
        '      if (word(i >>> 5) & (1 << (i & 31))) {',
        '        seen += 1;',
        '        if (seen === k) return i;',
        '      }',
        '    }',
        '    return -1;',
        '  }',
        '',
        '  return {',
        '    length: length,',
        '    rank1: rank1,',
        '    select1: select1,',
        '    stats: function () { return { wordProbes: wordProbes, indexBytes: 0 }; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeBitVector(bits) {',
        '  const WORD = 32;',
        '  const BLOCK = 256;',
        '  const SUPERBLOCK = 2048;',
        '  const length = bits.length;',
        '  let wordProbes = 0;',
        '',
        '  const words = new Uint32Array(Math.ceil(length / WORD) + 1);',
        '  for (let i = 0; i < length; i += 1) {',
        '    if (bits[i]) words[i >>> 5] |= (1 << (i & 31));',
        '  }',
        '  function word(index) { wordProbes += 1; return words[index] >>> 0; }',
        '  function popcount(value) {',
        '    let n = value - ((value >>> 1) & 0x55555555);',
        '    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);',
        '    n = (n + (n >>> 4)) & 0x0f0f0f0f;',
        '    return (Math.imul(n, 0x01010101) >>> 24);',
        '  }',
        '',
        '  // built once: absolute counts every 2 048 bits, relative every 256',
        '  const superblocks = new Uint32Array(Math.ceil(length / SUPERBLOCK) + 1);',
        '  const blocks = new Uint16Array(Math.ceil(length / BLOCK) + 1);',
        '  (function build() {',
        '    let total = 0;',
        '    let inSuper = 0;',
        '    for (let block = 0; block * BLOCK <= length; block += 1) {',
        '      if ((block * BLOCK) % SUPERBLOCK === 0) {',
        '        superblocks[(block * BLOCK) / SUPERBLOCK] = total;',
        '        inSuper = 0;',
        '      }',
        '      blocks[block] = inSuper;',
        '      let ones = 0;',
        '      for (let i = block * BLOCK; i < Math.min((block + 1) * BLOCK, length); i += 1) {',
        '        if (bits[i]) ones += 1;',
        '      }',
        '      total += ones;',
        '      inSuper += ones;',
        '    }',
        '  }());',
        '  const totalOnes = (function () { let n = 0; for (let i = 0; i < length; i += 1) if (bits[i]) n += 1; return n; }());',
        '',
        '  function rank1(at) {',
        '    const limit = Math.min(Math.max(at, 0), length);',
        '    if (limit === 0) return 0;',
        '    const block = Math.floor(limit / BLOCK);',
        '    let ones = superblocks[Math.floor(limit / SUPERBLOCK)] + blocks[block];',
        '    const firstWord = (block * BLOCK) >>> 5;',
        '    for (let i = firstWord; i < (limit >>> 5); i += 1) ones += popcount(word(i));',
        '    const rest = limit & 31;',
        '    if (rest) ones += popcount(word(limit >>> 5) & ((1 << rest) - 1));',
        '    return ones;',
        '  }',
        '',
        '  // the index answers "which block", so no part of the vector is walked',
        '  function blockOf(k) {',
        '    let lo = 0;',
        '    let hi = Math.max(0, Math.ceil(length / BLOCK) - 1);',
        '    while (lo < hi) {',
        '      const mid = (lo + hi + 1) >> 1;',
        '      const before = superblocks[Math.floor((mid * BLOCK) / SUPERBLOCK)] + blocks[mid];',
        '      if (before < k) lo = mid; else hi = mid - 1;',
        '    }',
        '    return lo;',
        '  }',
        '',
        '  function select1(k) {',
        '    if (k < 1 || k > totalOnes) return -1;',
        '    const block = blockOf(k);',
        '    let seen = superblocks[Math.floor((block * BLOCK) / SUPERBLOCK)] + blocks[block];',
        '    for (let index = (block * BLOCK) >>> 5; index < words.length; index += 1) {',
        '      const current = word(index);',
        '      const ones = popcount(current);',
        '      if (seen + ones >= k) {',
        '        for (let bit = 0; bit < 32; bit += 1) {',
        '          if (current & (1 << bit)) {',
        '            seen += 1;',
        '            if (seen === k) return index * 32 + bit;',
        '          }',
        '        }',
        '      }',
        '      seen += ones;',
        '    }',
        '    return -1;',
        '  }',
        '',
        '  return {',
        '    length: length,',
        '    rank1: rank1,',
        '    select1: select1,',
        '    stats: function () {',
        '      return { wordProbes: wordProbes, indexBytes: superblocks.length * 4 + blocks.length * 2 };',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'rank1 agrees with a naive scan, including the edges',
          assert: function (makeBitVector, api) {
            const random = api.rng;
            const bits = [];
            for (let i = 0; i < 20000; i += 1) bits.push(random.next() < 0.37 ? 1 : 0);

            const vector = makeBitVector(bits);
            const prefix = [0];
            for (let i = 0; i < bits.length; i += 1) prefix.push(prefix[i] + bits[i]);

            const probes = [0, 1, 255, 256, 257, 2047, 2048, 2049, 19999, 20000];
            probes.forEach(function (at) {
              api.assert.equal(vector.rank1(at), prefix[at], 'rank1(' + at + ')');
            });
            for (let trial = 0; trial < 500; trial += 1) {
              const at = random.int(20001);
              api.assert.equal(vector.rank1(at), prefix[at], 'rank1(' + at + ')');
            }
          }
        },
        {
          name: 'select1 agrees with a naive scan',
          assert: function (makeBitVector, api) {
            const random = api.rng;
            const bits = [];
            const positions = [];
            for (let i = 0; i < 12000; i += 1) {
              const bit = random.next() < 0.2 ? 1 : 0;
              bits.push(bit);
              if (bit) positions.push(i);
            }

            const vector = makeBitVector(bits);
            api.assert.equal(vector.select1(1), positions[0], 'the first set bit');
            api.assert.equal(vector.select1(positions.length), positions[positions.length - 1], 'the last one');
            api.assert.equal(vector.select1(positions.length + 1), -1, 'past the last one');
            api.assert.equal(vector.select1(0), -1, 'select1 is 1-based');

            for (let trial = 0; trial < 400; trial += 1) {
              const k = random.int(positions.length) + 1;
              api.assert.equal(vector.select1(k), positions[k - 1], 'select1(' + k + ')');
            }
          }
        },
        {
          name: 'rank1 reads a block, not a prefix',
          assert: function (makeBitVector, api) {
            const random = api.rng;
            const bits = [];
            for (let i = 0; i < 65536; i += 1) bits.push(random.next() < 0.5 ? 1 : 0);

            const vector = makeBitVector(bits);
            const before = vector.stats().wordProbes;
            for (let trial = 0; trial < 500; trial += 1) vector.rank1(random.int(65537));
            const perCall = (vector.stats().wordProbes - before) / 500;

            api.assert.atMost(perCall, 10,
              perCall.toFixed(1) + ' word probes per rank; a 256-bit block is 8 words');
          }
        },
        {
          name: 'select1 finds its block through the index, and the index is small',
          assert: function (makeBitVector, api) {
            const random = api.rng;
            const bits = [];
            let ones = 0;
            for (let i = 0; i < 65536; i += 1) {
              const bit = random.next() < 0.5 ? 1 : 0;
              bits.push(bit);
              ones += bit;
            }

            const vector = makeBitVector(bits);
            const before = vector.stats().wordProbes;
            for (let trial = 0; trial < 300; trial += 1) vector.select1(random.int(ones) + 1);
            const perCall = (vector.stats().wordProbes - before) / 300;

            api.assert.atMost(perCall, 24,
              perCall.toFixed(1) + ' word probes per select - the index has to narrow it down first');

            const indexBytes = vector.stats().indexBytes;
            api.assert.atLeast(indexBytes, 1, 'no index was built');
            api.assert.atMost(indexBytes, 65536 / 8 * 0.3,
              indexBytes + ' index bytes over ' + (65536 / 8) + ' data bytes is not succinct');
          }
        }
      ]
    }],

    'succinct-trees': [{
      id: 'louds-navigation',
      title: 'Navigating a tree that is only a bit string',
      prompt: 'makeLouds(tree) must return { bits, degree, child, parent, nextSibling, valueOf }. Encode the ' +
        'tree in LOUDS: a super-root block "10", then for every node in level order, one 1 per child followed ' +
        'by a 0. Nodes are numbered by the order of the 1 bits, so the real root is node 1. Implement the ' +
        'navigation from the provided rank/select helpers alone - child(x, i), parent(x), nextSibling(x) and ' +
        'degree(x) must read the bit string, never a pointer. valueOf(x) maps a node number back to the value ' +
        'stored in level order. The test walks both structures and compares them node by node.',
      entry: 'makeLouds',
      starter: [
        'function makeLouds(tree) {',
        '  const bits = [];',
        '  const values = [];',
        '',
        '  // level order, one block per node: a 1 per child, then a 0',
        '  (function encode() {',
        '    const queue = [tree];',
        '    while (queue.length) {',
        '      const node = queue.shift();',
        '      values.push(node.value);',
        '      const children = node.children || [];',
        '      for (let i = 0; i < children.length; i += 1) { bits.push(1); queue.push(children[i]); }',
        '      bits.push(0);',
        '    }',
        '  }());',
        '',
        '  // provided: rank and select over the bit string',
        '  function rank1(at) { let n = 0; for (let i = 0; i < at && i < bits.length; i += 1) if (bits[i]) n += 1; return n; }',
        '  function rank0(at) { return Math.min(at, bits.length) - rank1(at); }',
        '  function select1(k) { let n = 0; for (let i = 0; i < bits.length; i += 1) { if (bits[i]) { n += 1; if (n === k) return i; } } return -1; }',
        '  function select0(k) { let n = 0; for (let i = 0; i < bits.length; i += 1) { if (!bits[i]) { n += 1; if (n === k) return i; } } return -1; }',
        '',
        '  function blockStart(x) { return x === 0 ? 0 : select0(x) + 1; }',
        '',
        '  function degree(x) { return select0(x + 1) - blockStart(x); }',
        '',
        '  function child(x, index) {',
        '    if (index < 0 || index >= degree(x)) return -1;',
        '    return rank1(blockStart(x) + index) + 1;',
        '  }',
        '',
        '  function parent(x) {',
        '    if (x <= 0) return -1;',
        '    return rank0(select1(x));',
        '  }',
        '',
        '  function nextSibling(x) {',
        '    if (x <= 0) return -1;',
        '    const at = select1(x);',
        '    return bits[at + 1] ? x + 1 : -1;',
        '  }',
        '',
        '  return {',
        '    bits: bits,',
        '    degree: degree,',
        '    child: child,',
        '    parent: parent,',
        '    nextSibling: nextSibling,',
        '    valueOf: function (x) { return values[x - 1]; }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeLouds(tree) {',
        '  const bits = [1, 0];',
        '  const values = [];',
        '',
        '  // the super-root block "10" comes first: it is what makes node 1 the',
        '  // real root and lets parent() land on 0 instead of running off the end',
        '  (function encode() {',
        '    const queue = [tree];',
        '    while (queue.length) {',
        '      const node = queue.shift();',
        '      values.push(node.value);',
        '      const children = node.children || [];',
        '      for (let i = 0; i < children.length; i += 1) { bits.push(1); queue.push(children[i]); }',
        '      bits.push(0);',
        '    }',
        '  }());',
        '',
        '  function rank1(at) { let n = 0; for (let i = 0; i < at && i < bits.length; i += 1) if (bits[i]) n += 1; return n; }',
        '  function rank0(at) { return Math.min(at, bits.length) - rank1(at); }',
        '  function select1(k) { let n = 0; for (let i = 0; i < bits.length; i += 1) { if (bits[i]) { n += 1; if (n === k) return i; } } return -1; }',
        '  function select0(k) { let n = 0; for (let i = 0; i < bits.length; i += 1) { if (!bits[i]) { n += 1; if (n === k) return i; } } return -1; }',
        '',
        '  // node x owns the block that ends at the (x+1)-th zero',
        '  function blockStart(x) { return x === 0 ? 0 : select0(x) + 1; }',
        '',
        '  function degree(x) {',
        '    const end = select0(x + 1);',
        '    if (end < 0) return 0;',
        '    return end - blockStart(x);',
        '  }',
        '',
        '  function child(x, index) {',
        '    if (index < 0 || index >= degree(x)) return -1;',
        '    return rank1(blockStart(x) + index) + 1;',
        '  }',
        '',
        '  function parent(x) {',
        '    if (x <= 1) return -1;',
        '    return rank0(select1(x));',
        '  }',
        '',
        '  function nextSibling(x) {',
        '    if (x <= 1) return -1;',
        '    const at = select1(x);',
        '    return bits[at + 1] ? x + 1 : -1;',
        '  }',
        '',
        '  return {',
        '    bits: bits,',
        '    degree: degree,',
        '    child: child,',
        '    parent: parent,',
        '    nextSibling: nextSibling,',
        '    valueOf: function (x) { return values[x - 1]; }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the encoding is 2n + 1 bits with one zero per node',
          assert: function (makeLouds, api) {
            const random = api.rng;
            let counter = 0;

            function build(depth) {
              counter += 1;
              const node = { value: 'n' + counter, children: [] };
              if (depth === 0) return node;
              const fanout = random.int(4);
              for (let i = 0; i < fanout; i += 1) node.children.push(build(depth - 1));
              return node;
            }

            const tree = build(6);
            const louds = makeLouds(tree);
            const ones = louds.bits.filter(function (b) { return b === 1; }).length;
            const zeros = louds.bits.length - ones;

            api.assert.equal(zeros, counter + 1, 'one zero per node, plus one for the super-root');
            api.assert.equal(ones, counter, 'one 1 per edge: n - 1 real edges plus the one into the root');
            api.assert.equal(louds.bits.length, 2 * counter + 1);
          }
        },
        {
          name: 'a level-order walk of the bit string matches the pointer tree exactly',
          assert: function (makeLouds, api) {
            const random = api.rng;
            let counter = 0;

            function build(depth) {
              counter += 1;
              const node = { value: 'v' + counter, children: [] };
              if (depth === 0) return node;
              const fanout = 1 + random.int(3);
              for (let i = 0; i < fanout; i += 1) node.children.push(build(depth - 1));
              return node;
            }

            const tree = build(5);
            const louds = makeLouds(tree);

            const pointerOrder = [];
            const queue = [tree];
            while (queue.length) {
              const node = queue.shift();
              pointerOrder.push({ value: node.value, degree: (node.children || []).length });
              (node.children || []).forEach(function (c) { queue.push(c); });
            }

            const bitOrder = [];
            const walk = [1];
            while (walk.length) {
              const x = walk.shift();
              const degree = louds.degree(x);
              bitOrder.push({ value: louds.valueOf(x), degree: degree });
              for (let i = 0; i < degree; i += 1) walk.push(louds.child(x, i));
            }

            api.assert.deepEqual(bitOrder, pointerOrder, 'the two traversals diverged');
          }
        },
        {
          name: 'parent undoes child everywhere in the tree',
          assert: function (makeLouds, api) {
            const random = api.rng;
            let counter = 0;

            function build(depth) {
              counter += 1;
              const node = { value: counter, children: [] };
              if (depth === 0) return node;
              for (let i = 0; i < 1 + random.int(3); i += 1) node.children.push(build(depth - 1));
              return node;
            }

            const louds = makeLouds(build(5));
            api.assert.equal(louds.parent(1), -1, 'the root has no parent');

            const walk = [1];
            let checked = 0;
            while (walk.length) {
              const x = walk.shift();
              for (let i = 0; i < louds.degree(x); i += 1) {
                const c = louds.child(x, i);
                api.assert.equal(louds.parent(c), x, 'parent(child(' + x + ', ' + i + ')) was ' + louds.parent(c));
                checked += 1;
                walk.push(c);
              }
            }
            api.assert.atLeast(checked, 20, 'the tree should have had children to check');
          }
        },
        {
          name: 'nextSibling walks a child list and stops at the end',
          assert: function (makeLouds, api) {
            const tree = {
              value: 'root',
              children: [
                { value: 'a', children: [{ value: 'a1', children: [] }, { value: 'a2', children: [] }] },
                { value: 'b', children: [] },
                { value: 'c', children: [{ value: 'c1', children: [] }] }
              ]
            };

            const louds = makeLouds(tree);
            api.assert.equal(louds.valueOf(1), 'root');
            api.assert.equal(louds.degree(1), 3);

            const seen = [];
            let x = louds.child(1, 0);
            while (x !== -1) { seen.push(louds.valueOf(x)); x = louds.nextSibling(x); }
            api.assert.deepEqual(seen, ['a', 'b', 'c']);

            const inner = [];
            let y = louds.child(louds.child(1, 0), 0);
            while (y !== -1) { inner.push(louds.valueOf(y)); y = louds.nextSibling(y); }
            api.assert.deepEqual(inner, ['a1', 'a2']);
            api.assert.equal(louds.degree(louds.child(1, 1)), 0, 'b is a leaf');
          }
        }
      ]
    }],

    'compressed-bitmaps': [{
      id: 'roaring-containers',
      title: 'Choosing a container per chunk, and intersecting across kinds',
      prompt: 'makeBitmap() must return { add, has, containers, intersect, memoryBytes }. Split the 32-bit ' +
        'universe into chunks of 65 536 and give each chunk its own container: a sorted array of 16-bit values ' +
        'while it holds at most 4 096 of them, a 2 048-word bitmap once it holds more. Report each container as ' +
        '{ key, kind, count }. intersect(other) returns a sorted array of the values in both, taking the cheap ' +
        'path per pair - array against array walks the two arrays, array against bitmap tests each element, ' +
        'bitmap against bitmap ANDs the words. memoryBytes() is 8 per container plus 2 per array element or ' +
        '8 192 per bitmap.',
      entry: 'makeBitmap',
      starter: [
        'function makeBitmap() {',
        '  const CHUNK = 65536;',
        '  const chunks = new Map();',
        '',
        '  // one bitmap per chunk, whatever the density: correct and never small',
        '  function containerFor(key) {',
        '    if (!chunks.has(key)) chunks.set(key, { key: key, kind: \'bitmap\', words: new Uint32Array(2048), count: 0 });',
        '    return chunks.get(key);',
        '  }',
        '',
        '  function add(value) {',
        '    const key = Math.floor(value / CHUNK);',
        '    const low = value % CHUNK;',
        '    const container = containerFor(key);',
        '    if (container.words[low >>> 5] & (1 << (low & 31))) return;',
        '    container.words[low >>> 5] |= (1 << (low & 31));',
        '    container.count += 1;',
        '  }',
        '',
        '  function has(value) {',
        '    const container = chunks.get(Math.floor(value / CHUNK));',
        '    if (!container) return false;',
        '    const low = value % CHUNK;',
        '    return (container.words[low >>> 5] & (1 << (low & 31))) !== 0;',
        '  }',
        '',
        '  function values(container) {',
        '    const out = [];',
        '    for (let i = 0; i < CHUNK; i += 1) {',
        '      if (container.words[i >>> 5] & (1 << (i & 31))) out.push(container.key * CHUNK + i);',
        '    }',
        '    return out;',
        '  }',
        '',
        '  return {',
        '    add: add,',
        '    has: has,',
        '    containers: function () {',
        '      return Array.from(chunks.values()).map(function (c) {',
        '        return { key: c.key, kind: c.kind, count: c.count };',
        '      }).sort(function (a, b) { return a.key - b.key; });',
        '    },',
        '    intersect: function (other) {',
        '      const out = [];',
        '      Array.from(chunks.values()).forEach(function (container) {',
        '        values(container).forEach(function (value) { if (other.has(value)) out.push(value); });',
        '      });',
        '      return out.sort(function (a, b) { return a - b; });',
        '    },',
        '    memoryBytes: function () { return chunks.size * (8 + 8192); }',
        '  };',
        '}'
      ].join('\n'),
      solution: [
        'function makeBitmap() {',
        '  const CHUNK = 65536;',
        '  const ARRAY_MAX = 4096;',
        '  const chunks = new Map();',
        '',
        '  function containerFor(key) {',
        '    if (!chunks.has(key)) chunks.set(key, { key: key, kind: \'array\', values: [], count: 0 });',
        '    return chunks.get(key);',
        '  }',
        '',
        '  // the conversion is the whole idea: a chunk pays 2 bytes per value',
        '  // until a flat bitmap becomes the cheaper of the two',
        '  function promote(container) {',
        '    const words = new Uint32Array(2048);',
        '    container.values.forEach(function (low) { words[low >>> 5] |= (1 << (low & 31)); });',
        '    container.kind = \'bitmap\';',
        '    container.words = words;',
        '    container.values = null;',
        '  }',
        '',
        '  function lowerBound(list, target) {',
        '    let lo = 0;',
        '    let hi = list.length;',
        '    while (lo < hi) { const mid = (lo + hi) >> 1; if (list[mid] < target) lo = mid + 1; else hi = mid; }',
        '    return lo;',
        '  }',
        '',
        '  function add(value) {',
        '    const key = Math.floor(value / CHUNK);',
        '    const low = value % CHUNK;',
        '    const container = containerFor(key);',
        '    if (container.kind === \'bitmap\') {',
        '      if (container.words[low >>> 5] & (1 << (low & 31))) return;',
        '      container.words[low >>> 5] |= (1 << (low & 31));',
        '      container.count += 1;',
        '      return;',
        '    }',
        '    const at = lowerBound(container.values, low);',
        '    if (container.values[at] === low) return;',
        '    container.values.splice(at, 0, low);',
        '    container.count += 1;',
        '    if (container.count > ARRAY_MAX) promote(container);',
        '  }',
        '',
        '  function hasLow(container, low) {',
        '    if (!container) return false;',
        '    if (container.kind === \'bitmap\') return (container.words[low >>> 5] & (1 << (low & 31))) !== 0;',
        '    return container.values[lowerBound(container.values, low)] === low;',
        '  }',
        '',
        '  function lows(container) {',
        '    if (container.kind === \'array\') return container.values.slice();',
        '    const out = [];',
        '    for (let i = 0; i < 2048; i += 1) {',
        '      let word = container.words[i];',
        '      while (word) {',
        '        const bit = word & -word;',
        '        out.push(i * 32 + Math.round(Math.log2(bit >>> 0)));',
        '        word ^= bit;',
        '      }',
        '    }',
        '    return out;',
        '  }',
        '',
        '  function meetArrays(a, b) {',
        '    const out = [];',
        '    let i = 0;',
        '    let j = 0;',
        '    while (i < a.length && j < b.length) {',
        '      if (a[i] === b[j]) { out.push(a[i]); i += 1; j += 1; }',
        '      else if (a[i] < b[j]) i += 1;',
        '      else j += 1;',
        '    }',
        '    return out;',
        '  }',
        '',
        '  function meet(mine, theirs) {',
        '    if (mine.kind === \'bitmap\' && theirs.kind === \'bitmap\') {',
        '      const out = [];',
        '      for (let i = 0; i < 2048; i += 1) {',
        '        let word = mine.words[i] & theirs.words[i];',
        '        while (word) {',
        '          const bit = word & -word;',
        '          out.push(i * 32 + Math.round(Math.log2(bit >>> 0)));',
        '          word ^= bit;',
        '        }',
        '      }',
        '      return out;',
        '    }',
        '    if (mine.kind === \'array\' && theirs.kind === \'array\') return meetArrays(mine.values, theirs.values);',
        '    const probe = mine.kind === \'array\' ? mine : theirs;',
        '    const target = mine.kind === \'array\' ? theirs : mine;',
        '    return probe.values.filter(function (low) { return hasLow(target, low); });',
        '  }',
        '',
        '  return {',
        '    add: add,',
        '    has: function (value) { return hasLow(chunks.get(Math.floor(value / CHUNK)), value % CHUNK); },',
        '    raw: function (key) { return chunks.get(key); },',
        '    containers: function () {',
        '      return Array.from(chunks.values()).map(function (c) {',
        '        return { key: c.key, kind: c.kind, count: c.count };',
        '      }).sort(function (a, b) { return a.key - b.key; });',
        '    },',
        '    intersect: function (other) {',
        '      const out = [];',
        '      Array.from(chunks.values()).forEach(function (mine) {',
        '        const theirs = other.raw ? other.raw(mine.key) : null;',
        '        if (theirs) meet(mine, theirs).forEach(function (low) { out.push(mine.key * CHUNK + low); });',
        '        else lows(mine).forEach(function (low) { if (other.has(mine.key * CHUNK + low)) out.push(mine.key * CHUNK + low); });',
        '      });',
        '      return out.sort(function (a, b) { return a - b; });',
        '    },',
        '    memoryBytes: function () {',
        '      let bytes = 0;',
        '      chunks.forEach(function (c) { bytes += 8 + (c.kind === \'array\' ? 2 * c.count : 8192); });',
        '      return bytes;',
        '    }',
        '  };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'membership agrees with a plain set',
          assert: function (makeBitmap, api) {
            const random = api.rng;
            const bitmap = makeBitmap();
            const model = new Set();

            for (let i = 0; i < 8000; i += 1) {
              const value = random.int(400000);
              bitmap.add(value);
              model.add(value);
            }
            model.forEach(function (value) {
              api.assert.equal(bitmap.has(value), true, 'missing ' + value);
            });
            for (let i = 0; i < 2000; i += 1) {
              const value = random.int(400000);
              api.assert.equal(bitmap.has(value), model.has(value), 'disagreed on ' + value);
            }
          }
        },
        {
          name: 'the container kind follows the density, not the chunk',
          assert: function (makeBitmap, api) {
            const bitmap = makeBitmap();
            for (let i = 0; i < 100; i += 1) bitmap.add(i * 7);
            for (let i = 0; i < 20000; i += 1) bitmap.add(65536 + i);

            const containers = bitmap.containers();
            api.assert.equal(containers.length, 2);
            api.assert.equal(containers[0].kind, 'array', 'a 100-value chunk should stay an array');
            api.assert.equal(containers[0].count, 100);
            api.assert.equal(containers[1].kind, 'bitmap', 'a 20 000-value chunk should be a bitmap');
            api.assert.equal(containers[1].count, 20000);
          }
        },
        {
          name: 'intersect agrees with a set intersection across every container pairing',
          assert: function (makeBitmap, api) {
            const random = api.rng;
            const left = makeBitmap();
            const right = makeBitmap();
            const leftModel = new Set();
            const rightModel = new Set();

            function fill(target, model, key, count) {
              for (let i = 0; i < count; i += 1) {
                const value = key * 65536 + random.int(65536);
                target.add(value);
                model.add(value);
              }
            }

            fill(left, leftModel, 0, 200);
            fill(right, rightModel, 0, 300);
            fill(left, leftModel, 1, 20000);
            fill(right, rightModel, 1, 300);
            fill(left, leftModel, 2, 20000);
            fill(right, rightModel, 2, 20000);
            fill(left, leftModel, 3, 500);

            const want = Array.from(leftModel).filter(function (v) { return rightModel.has(v); })
              .sort(function (a, b) { return a - b; });
            api.assert.deepEqual(left.intersect(right), want);
            api.assert.deepEqual(right.intersect(left), want, 'intersection has to be symmetric');
          }
        },
        {
          name: 'a sparse set costs far less than a flat bitmap over the same range',
          assert: function (makeBitmap, api) {
            const random = api.rng;
            const bitmap = makeBitmap();
            const values = new Set();
            while (values.size < 20000) values.add(random.int(5000000));
            values.forEach(function (value) { bitmap.add(value); });

            const bytes = bitmap.memoryBytes();
            const flat = 5000000 / 8;
            api.assert.atMost(bytes, flat / 4,
              bytes + ' bytes for 20 000 values; a flat bitmap over the range is ' + flat);

            const dense = makeBitmap();
            for (let i = 0; i < 60000; i += 1) dense.add(i);
            api.assert.atMost(dense.memoryBytes(), 8300,
              'a full chunk should cost one 8 192-byte bitmap, not ' + dense.memoryBytes() + ' bytes');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
