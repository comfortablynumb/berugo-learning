/**
 * Graded exercises for miss analysis, cache-friendly code and the TLB
 * (M37.4-M37.6).
 *
 * Every test is self-contained - it is serialised with Function.prototype
 * .toString() and rebuilt inside the sandbox, so it can close over nothing.
 */
(function (root) {
  'use strict';

  const registry = root ? root.ExerciseRegistry : require('./registries.js').ExerciseRegistry;

  registry.register({
    'cache-performance-analysis': [{
      id: 'three-cs-classifier',
      title: 'Attribute every miss to exactly one category, and make them reconcile',
      prompt: 'Write lab() returning { classify, advise }. classify(rows) takes one row per '
        + 'access, each { line, realHit, idealHit } where realHit is what the cache under test '
        + 'did and idealHit is what a fully associative cache of the same capacity did, and '
        + 'returns { compulsory, capacity, conflict, misses }. A row that hit in the real cache '
        + 'is not a miss at all. Of the misses: the first reference to a line is compulsory; '
        + 'one the fully associative cache also missed is capacity; one it hit is conflict. '
        + 'misses is the real miss count, and the three categories must sum to it exactly. '
        + 'advise(counts) returns "touch less data", "block the loop" or "change the mapping" '
        + 'for a dominant compulsory, capacity or conflict count respectively. The starter '
        + 'classifies before checking whether the access missed at all, so its categories '
        + 'count hits.',
      entry: 'lab',
      starter: [
        'function classify(rows) {',
        '  var seen = {};',
        '  var counts = { compulsory: 0, capacity: 0, conflict: 0, misses: 0 };',
        '',
        '  rows.forEach(function (row) {',
        '    var first = seen[row.line] !== true;',
        '',
        '    seen[row.line] = true;',
        '    // Wrong: a hit is classified too, so nothing sums to the miss count.',
        '    if (first) counts.compulsory += 1;',
        '    else if (row.idealHit) counts.conflict += 1;',
        '    else counts.capacity += 1;',
        '    if (!row.realHit) counts.misses += 1;',
        '  });',
        '  return counts;',
        '}',
        '',
        'function advise(counts) {',
        '  return "block the loop";',
        '}',
        '',
        'function lab() {',
        '  return { classify: classify, advise: advise };',
        '}'
      ].join('\n'),
      solution: [
        '/* The order matters: hits leave first, then the first-reference question,',
        '   then the fully associative one. Every miss goes down exactly one path,',
        '   which is what makes the three sum to the miss count rather than',
        '   approximate it. */',
        'function classify(rows) {',
        '  var seen = {};',
        '  var counts = { compulsory: 0, capacity: 0, conflict: 0, misses: 0 };',
        '',
        '  rows.forEach(function (row) {',
        '    var first = seen[row.line] !== true;',
        '',
        '    seen[row.line] = true;',
        '    if (row.realHit) return;',
        '    counts.misses += 1;',
        '    if (first) counts.compulsory += 1;',
        '    else if (row.idealHit) counts.conflict += 1;',
        '    else counts.capacity += 1;',
        '  });',
        '  return counts;',
        '}',
        '',
        'function advise(counts) {',
        '  var order = [',
        '    { key: "compulsory", say: "touch less data" },',
        '    { key: "capacity", say: "block the loop" },',
        '    { key: "conflict", say: "change the mapping" }',
        '  ];',
        '',
        '  order.sort(function (left, right) { return counts[right.key] - counts[left.key]; });',
        '  return order[0].say;',
        '}',
        '',
        'function lab() {',
        '  return { classify: classify, advise: advise };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'the three categories sum to the miss count exactly',
          assert: function (lab, api) {
            const rows = [
              { line: 1, realHit: false, idealHit: false },
              { line: 2, realHit: false, idealHit: false },
              { line: 1, realHit: true, idealHit: true },
              { line: 2, realHit: false, idealHit: true },
              { line: 3, realHit: false, idealHit: false },
              { line: 3, realHit: false, idealHit: false }
            ];
            const got = lab().classify(rows);

            api.assert.equal(got.misses, 5, 'one of the six accesses hit');
            api.assert.equal(got.compulsory, 3, 'three lines, each seen for the first time');
            api.assert.equal(got.conflict, 1, 'the fully associative cache would have hit');
            api.assert.equal(got.capacity, 1, 'both caches missed on a line already seen');
            api.assert.equal(got.compulsory + got.capacity + got.conflict, got.misses,
              'the categories reconcile');
          }
        },
        {
          name: 'a run that hits everything after the first pass is all compulsory',
          assert: function (lab, api) {
            const rows = [];

            for (let pass = 0; pass < 3; pass += 1) {
              for (let line = 0; line < 4; line += 1) {
                rows.push({ line: line, realHit: pass > 0, idealHit: pass > 0 });
              }
            }
            const got = lab().classify(rows);

            api.assert.equal(got.misses, 4, 'four lines, missed once each');
            api.assert.equal(got.compulsory, 4, 'no cache of any design could have had them');
            api.assert.equal(got.capacity + got.conflict, 0, 'nothing left to attribute');
          }
        },
        {
          name: 'the dominant category picks the transformation',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.advise({ compulsory: 1536, capacity: 8064, conflict: 32392 }),
              'change the mapping', 'conflict dominates the naive matrix multiply');
            api.assert.equal(parts.advise({ compulsory: 1536, capacity: 8015, conflict: 0 }),
              'block the loop', 'after the interchange it is capacity');
          }
        }
      ]
    }],

    'cache-friendly-software': [{
      id: 'tile-and-pad',
      title: 'Size a tile from the capacity, and find the padding that breaks a collision',
      prompt: 'Write lab() returning { tileFor, needsPadding, padTo }. tileFor(capacityBytes, '
        + 'elementBytes) returns the largest whole t such that three t-by-t tiles of elements '
        + 'fit in the capacity - three, because a tile of the output is computed from a '
        + 'tile-row and a tile-column of the inputs. needsPadding(rowBytes, setSpanBytes) '
        + 'returns true when the row stride divides the set span, which is when every row of '
        + 'a matrix starts in the same set. padTo(rowElements, elementBytes, setSpanBytes) '
        + 'returns the smallest number of extra ELEMENTS per row that makes needsPadding '
        + 'false, or 0 if no padding is needed. The starter sizes one tile instead of three '
        + 'and never reports a collision.',
      entry: 'lab',
      starter: [
        'function tileFor(capacityBytes, elementBytes) {',
        '  // Wrong: one tile, not the three that have to be resident at once.',
        '  return Math.floor(Math.sqrt(capacityBytes / elementBytes));',
        '}',
        '',
        'function needsPadding(rowBytes, setSpanBytes) {',
        '  return false;',
        '}',
        '',
        'function padTo(rowElements, elementBytes, setSpanBytes) {',
        '  return 0;',
        '}',
        '',
        'function lab() {',
        '  return { tileFor: tileFor, needsPadding: needsPadding, padTo: padTo };',
        '}'
      ].join('\n'),
      solution: [
        '/* Three tiles, not one: the factor of three is the commonest way this',
        '   calculation is got wrong, and it produces a tile that is 1.7x too big. */',
        'function tileFor(capacityBytes, elementBytes) {',
        '  return Math.floor(Math.sqrt(capacityBytes / (3 * elementBytes)));',
        '}',
        '',
        '/* Every row starts in the same set when the stride divides the span - so',
        '   the rows walk one set instead of spreading across the table. */',
        'function needsPadding(rowBytes, setSpanBytes) {',
        '  return rowBytes > 0 && setSpanBytes % rowBytes === 0;',
        '}',
        '',
        'function padTo(rowElements, elementBytes, setSpanBytes) {',
        '  var extra = 0;',
        '',
        '  while (needsPadding((rowElements + extra) * elementBytes, setSpanBytes)) {',
        '    extra += 1;',
        '  }',
        '  return extra;',
        '}',
        '',
        'function lab() {',
        '  return { tileFor: tileFor, needsPadding: needsPadding, padTo: padTo };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: 'three tiles of 8-byte elements in 32 KiB gives 36, not 64',
          assert: function (lab, api) {
            const got = lab().tileFor(32768, 8);

            api.assert.equal(got, 36, 'sizing one tile would have said 64');
          }
        },
        {
          name: 'a 512-byte row stride divides a 4096-byte set span',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.ok(parts.needsPadding(512, 4096), 'every row starts in the same set');
            api.assert.ok(!parts.needsPadding(520, 4096), 'one extra element breaks it');
            api.assert.ok(!parts.needsPadding(4104, 4096), 'a stride larger than the span is fine');
          }
        },
        {
          name: 'one element of padding is enough for a 64-wide matrix of doubles',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.padTo(64, 8, 4096), 1, '512 bytes to 520');
            api.assert.equal(parts.padTo(65, 8, 4096), 0, 'an odd width needs nothing');
          }
        }
      ]
    }],

    'virtual-memory-and-the-tlb': [{
      id: 'reach-and-walk',
      title: 'Compute a translation reach, and price what falling off it costs',
      prompt: 'Write lab() returning { reach, costPerAccess, pageSizeFor }. '
        + 'reach(entries, pageBytes) returns how much memory the buffer can describe. '
        + 'costPerAccess(config) takes { hitRate, hitCycles, levels, levelCycles } and returns '
        + 'the average translation cost, remembering that a walk is levels dependent accesses '
        + 'and that the lookup is paid on a miss as well as on a hit. pageSizeFor(entries, '
        + 'workingSetBytes, sizes) returns the smallest page size from the sizes array whose '
        + 'reach covers the working set, or null if none does. The starter forgets that the '
        + 'levels are dependent and charges one access for the whole walk.',
      entry: 'lab',
      starter: [
        'function reach(entries, pageBytes) {',
        '  return entries * pageBytes;',
        '}',
        '',
        'function costPerAccess(config) {',
        '  // Wrong: the walk is charged as a single access, not as levels of them.',
        '  var miss = config.hitCycles + config.levelCycles;',
        '',
        '  return config.hitRate * config.hitCycles + (1 - config.hitRate) * miss;',
        '}',
        '',
        'function pageSizeFor(entries, workingSetBytes, sizes) {',
        '  return sizes[0];',
        '}',
        '',
        'function lab() {',
        '  return { reach: reach, costPerAccess: costPerAccess, pageSizeFor: pageSizeFor };',
        '}'
      ].join('\n'),
      solution: [
        'function reach(entries, pageBytes) {',
        '  return entries * pageBytes;',
        '}',
        '',
        '/* The levels are DEPENDENT - each address comes from the previous read -',
        '   so nothing overlaps and the walk costs levels full accesses. That is',
        '   why a translation miss is far worse than "one extra access". */',
        'function costPerAccess(config) {',
        '  var walk = config.levels * config.levelCycles + config.hitCycles;',
        '',
        '  return config.hitRate * config.hitCycles + (1 - config.hitRate) * walk;',
        '}',
        '',
        'function pageSizeFor(entries, workingSetBytes, sizes) {',
        '  var ordered = sizes.slice().sort(function (left, right) { return left - right; });',
        '  var found = null;',
        '',
        '  ordered.forEach(function (size) {',
        '    if (found === null && reach(entries, size) >= workingSetBytes) found = size;',
        '  });',
        '  return found;',
        '}',
        '',
        'function lab() {',
        '  return { reach: reach, costPerAccess: costPerAccess, pageSizeFor: pageSizeFor };',
        '}'
      ].join('\n'),
      tests: [
        {
          name: '64 entries over 4 KiB pages reach 256 KiB',
          assert: function (lab, api) {
            const parts = lab();

            api.assert.equal(parts.reach(64, 4096), 262144, 'entries times page size');
            api.assert.equal(parts.reach(64, 2097152), 134217728, '2 MiB pages reach 128 MiB');
          }
        },
        {
          name: 'a four-level walk at 30 cycles costs 121, not 31',
          assert: function (lab, api) {
            const got = lab().costPerAccess({ hitRate: 0.246, hitCycles: 1,
              levels: 4, levelCycles: 30 });

            api.assert.ok(Math.abs(got - 91.5) < 0.1,
              'the measured figure at four times the reach is 91.5 cycles per access');
          }
        },
        {
          name: 'the page size is chosen by whether its reach covers the working set',
          assert: function (lab, api) {
            const parts = lab();
            const sizes = [4096, 2097152];

            api.assert.equal(parts.pageSizeFor(64, 131072, sizes), 4096, '128 KiB already fits');
            api.assert.equal(parts.pageSizeFor(64, 1048576, sizes), 2097152, '1 MiB needs huge pages');
            api.assert.equal(parts.pageSizeFor(64, 1e12, sizes), null, 'nothing here reaches a terabyte');
          }
        }
      ]
    }]
  });
}(typeof window !== 'undefined' ? window : null));
