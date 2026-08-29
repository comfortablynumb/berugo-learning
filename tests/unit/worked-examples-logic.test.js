'use strict';

/**
 * Every figure the M33.1-M33.3 content quotes, recomputed from the modules and
 * then checked against the prose.
 *
 * The section controllers are not imported - they touch `window` - so the
 * calls below reproduce what they do at their shipped control settings. A
 * default that moves fails here rather than in a reader's browser.
 */

const test = require('node:test');
const assert = require('node:assert');

const Sim = require('../../src/js/machines/logic-sim.js');
const Min = require('../../src/js/algorithms/boolean-min.js');
const TwoLevel = require('../../src/js/machines/blocks/two-level.js');
const Select = require('../../src/js/machines/blocks/select.js');
const Models = require('../../src/js/machines/blocks/models.js');
const Hdl = require('../../src/js/machines/hdl.js');
const GatesTemplate = require('../../src/js/sections/boolean-algebra-and-gates-template.js');

require('../../src/js/content/concepts-logic.js');
require('../../src/js/content/examples-logic.js');
const prose = require('../support/worked-example-prose.js');

function study(kind) {
  const net = GatesTemplate.build(Sim, kind);
  const table = Sim.truthTable(net);

  return { net: net, gates: Sim.gateCount(net), transistors: Sim.transistorCount(net),
    depth: Sim.criticalPath(net).delay,
    minterms: table.rows.reduce(function (into, row, at) {
      if (row.outputs.y) into.push(at);
      return into;
    }, []),
    agree: table.rows.filter(function (row) {
      return (row.outputs.y ? 1 : 0) ===
        (Sim.simulate(net, row.inputs, { record: false }).outputs.y ? 1 : 0);
    }).length,
    rows: table.rows.length };
}

test('gates: exclusive-or as a cell and as four NANDs', function () {
  const cell = study('xor');
  const built = study('xorFromNand');

  assert.strictEqual(cell.gates, 1, 'the library cell is one gate');
  assert.strictEqual(cell.transistors, 12, 'and twelve transistors');
  assert.strictEqual(cell.depth, 3, 'at depth 3');
  assert.strictEqual(built.gates, 4, 'the NAND build is four gates');
  assert.strictEqual(built.transistors, 16, 'and sixteen transistors');
  assert.strictEqual(built.depth, 3, 'at the same depth');
  assert.deepStrictEqual(cell.minterms, [1, 2], 'exclusive-or is 1 on rows 1 and 2');
  assert.strictEqual(cell.agree, 4, 'the two evaluators agree on every row');
  assert.strictEqual(cell.rows, 4, 'of which there are four');

  prose.quotes('boolean-algebra-and-gates',
    ['1 gate, 12 transistors, critical path 3 gate delays',
      '4 gates, 16 transistors, critical path 3 gate delays',
      '1 on rows 1 and 2 of 4', 'the two evaluators agree on 4 of 4 rows',
      '16 transistors against 12']);
});

test('gates: the NAND-only constructions cost what the prose says', function () {
  const rows = { notFromNand: [1, 4, 1], andFromNand: [2, 8, 2], orFromNand: [3, 12, 2] };

  Object.keys(rows).forEach(function (kind) {
    const net = GatesTemplate.build(Sim, kind);

    assert.strictEqual(Sim.gateCount(net), rows[kind][0], kind + ' gate count');
    assert.strictEqual(Sim.transistorCount(net), rows[kind][1], kind + ' transistors');
    assert.strictEqual(Sim.criticalPath(net).delay, rows[kind][2], kind + ' delay');
  });

  prose.quotes('boolean-algebra-and-gates',
    ['NOT costs 1 NAND, AND 2, OR 3 and XOR 4 — 4, 8, 12 and 16 transistors',
      '1, 2 and 3 NANDs — 4, 8 and 12 transistors, at delays 1, 2 and 2']);
});

test('gates: three three-input circuits, measured and read off', function () {
  const majority = study('majority');
  const mux = study('mux');
  const hazard = study('hazard');

  assert.strictEqual(majority.gates, 5, 'majority is five gates');
  assert.strictEqual(majority.depth, 6, 'at depth 6');
  assert.deepStrictEqual(majority.minterms, [3, 5, 6, 7], 'and is 1 on four of eight rows');
  assert.strictEqual(mux.gates, 1, 'the multiplexer cell is one gate');
  assert.strictEqual(mux.depth, 3, 'at depth 3');
  assert.deepStrictEqual(mux.minterms, [1, 3, 6, 7], 'with its own four minterms');
  assert.strictEqual(hazard.gates, 4, 'the hazard circuit is four gates');
  assert.strictEqual(hazard.depth, 5, 'at depth 5');
  assert.deepStrictEqual(hazard.minterms, [3, 4, 5, 7], 'also four minterms');
  [majority, mux, hazard].forEach(function (row) {
    assert.strictEqual(row.agree, 8, 'every row agrees between the two evaluators');
  });

  prose.quotes('boolean-algebra-and-gates',
    ['5 gates at depth 6; output is 1 on rows 3, 5, 6 and 7 — 4 of 8',
      '1 gate at depth 3; 1 on rows 1, 3, 6 and 7',
      '4 gates at depth 5; 1 on rows 3, 4, 5 and 7',
      '8 of 8 rows agree for each circuit',
      'All 8 rows of the hazard circuit agree']);
});

/* --------------------------------------------------------- minimisation */

const NAMES4 = ['a', 'b', 'c', 'd'];
const NAMES3 = ['a', 'b', 'c'];
const CLASSIC = [0, 1, 2, 5, 6, 7, 8, 9, 10, 14];
const TRAP = [0, 1, 2, 5, 6, 7];
const PARITY = [1, 2, 4, 7, 8, 11, 13, 14];

function cost(terms, names) {
  const net = TwoLevel.netFor(terms, names);

  return { terms: terms.length, literals: TwoLevel.literalsOf(terms),
    gates: Sim.gateCount(net), depth: Sim.criticalPath(net).delay, net: net };
}

function canonical(minterms, bits) {
  return minterms.map(function (mask) { return Min.termOf(mask, bits); });
}

/** The demo's glitch measurement: every adjacent pair of ones, driven in both
 *  directions, counting the transitions where an output leaves and returns. */
function glitching(terms, minterms, bits, names) {
  const net = TwoLevel.netFor(terms, names);
  const pairs = Min.hazards(canonical(minterms, bits), minterms, bits);
  const bad = pairs.filter(function (pair) {
    const low = TwoLevel.valuesOf(pair.from, names);
    const high = TwoLevel.valuesOf(pair.to, names);

    return Sim.transition(net, low, high, {}).outputGlitches.length > 0 ||
      Sim.transition(net, high, low, {}).outputGlitches.length > 0;
  });

  return { pairs: pairs.length, glitching: bad.length };
}

test('minimisation: the classic four-variable function, cover by cover', function () {
  const greedy = Min.greedyCover(CLASSIC, [], 4);
  const exact = Min.minimumCover(CLASSIC, [], 4);
  const full = cost(canonical(CLASSIC, 4), NAMES4);
  const small = cost(greedy.terms, NAMES4);

  assert.strictEqual(greedy.primes.length, 6, 'six prime implicants');
  assert.strictEqual(greedy.essential.length, 2, 'of which two are essential');
  assert.deepStrictEqual([full.terms, full.literals, full.gates, full.depth], [10, 40, 43, 25],
    'the canonical form');
  assert.deepStrictEqual([small.terms, small.literals, small.gates, small.depth], [3, 7, 10, 7],
    'the greedy cover');
  assert.strictEqual(exact.terms.length, 3, 'the exhaustive minimum is also three terms');
  assert.strictEqual(TwoLevel.literalsOf(exact.terms), 7, 'and seven literals');
  assert.strictEqual(exact.searched, 64, 'after 64 subsets');
  assert.ok(Min.agrees(greedy.terms, CLASSIC, [], 4).ok, 'and the cover is correct');

  prose.quotes('logic-minimisation',
    ['10 terms, 40 literals, 43 gates at depth 25',
      '6 prime implicants, of which 2 are essential',
      '3 terms, 7 literals, 10 gates at depth 7',
      '64 subsets searched; the minimum is also 3 terms and 7 literals',
      '43 gates into 10 and depth 25 into 7']);
});

test('minimisation: the trap function, where greedy loses', function () {
  const greedy = Min.greedyCover(TRAP, [], 3);
  const exact = Min.minimumCover(TRAP, [], 3);
  const bad = cost(greedy.terms, NAMES3);
  const best = cost(exact.terms, NAMES3);

  assert.strictEqual(greedy.essential.length, 0, 'no prime is forced');
  assert.deepStrictEqual([bad.terms, bad.literals, bad.gates, bad.depth], [4, 8, 10, 9],
    'what greedy produces');
  assert.deepStrictEqual([best.terms, best.literals, best.gates, best.depth], [3, 6, 8, 7],
    'and what the search finds');
  assert.strictEqual(exact.primes, 6, 'six primes');
  assert.strictEqual(exact.searched, 64, 'and 64 subsets of them');

  prose.quotes('logic-minimisation',
    ['4 terms, 8 literals, 10 gates at depth 9',
      '3 terms, 6 literals, 8 gates at depth 7 — greedy loses by 2 literals',
      'exhaustive search over 64 subsets of 6 primes finds 3 terms and 6 literals']);
});

test('minimisation: the hazard, and what removing it costs', function () {
  const greedy = Min.greedyCover(CLASSIC, [], 4);
  const before = glitching(greedy.terms, CLASSIC, 4, NAMES4);
  const extra = Min.hazards(greedy.terms, CLASSIC, 4).map(function (row) { return row.fix; });
  const fixed = greedy.terms.concat(extra.filter(function (term, at, list) {
    return list.indexOf(term) === at && greedy.terms.indexOf(term) === -1;
  })).sort();
  const after = glitching(fixed, CLASSIC, 4, NAMES4);
  const priced = cost(fixed, NAMES4);
  const small = cost(greedy.terms, NAMES4);

  assert.strictEqual(before.pairs, 13, 'thirteen adjacent pairs of ones');
  assert.strictEqual(before.glitching, 4, 'four of which glitch');
  assert.strictEqual(after.glitching, 0, 'and none do once the redundant terms are back');
  assert.deepStrictEqual([priced.terms, priced.literals, priced.gates, priced.depth],
    [7, 19, 22, 15], 'the hazard-free cover');
  assert.strictEqual(priced.gates - small.gates, 12, 'twelve extra gates');
  assert.strictEqual(priced.depth - small.depth, 8, 'and eight extra gate delays');
  assert.ok(Min.agrees(fixed, CLASSIC, [], 4).ok, 'still the same function');

  prose.quotes('logic-minimisation',
    ['4 of 13 adjacent pairs make the output dip',
      '0 of 13 glitch, at 7 terms, 19 literals, 22 gates and depth 15',
      'costs 12 gates and 8 gate delays']);
});

test('minimisation: parity has nothing to merge', function () {
  const greedy = Min.greedyCover(PARITY, [], 4);

  assert.strictEqual(TwoLevel.literalsOf(canonical(PARITY, 4)), 32, 'canonically 32 literals');
  assert.strictEqual(TwoLevel.literalsOf(greedy.terms), 32, 'and 32 after minimisation');
  assert.strictEqual(greedy.terms.length, 8, 'one term per minterm');
  assert.strictEqual(Min.hazards(canonical(PARITY, 4), PARITY, 4).length, 0,
    'no two minterms are adjacent');

  prose.quotes('logic-minimisation',
    ['32 literals canonically and 32 literals after minimisation, with 0 adjacent pairs']);
});

/* -------------------------------------------------------------- blocks */

function blockCost(net) {
  return { gates: Sim.gateCount(net), transistors: Sim.transistorCount(net),
    depth: Sim.criticalPath(net).delay, inputs: net.inputs.length };
}

test('blocks: the multiplexer tree against the flat form at four widths', function () {
  const rows = [1, 2, 3, 4].map(function (bits) {
    return { bits: bits, tree: blockCost(Select.muxTree({ bits: bits })),
      flat: blockCost(Select.muxFlat({ bits: bits })) };
  });

  assert.deepStrictEqual(rows.map(function (row) { return row.tree.gates; }), [1, 3, 7, 15],
    'tree gate counts');
  assert.deepStrictEqual(rows.map(function (row) { return row.tree.depth; }), [3, 6, 9, 12],
    'tree depths');
  assert.deepStrictEqual(rows.map(function (row) { return row.flat.gates; }), [4, 13, 34, 83],
    'flat gate counts');
  assert.deepStrictEqual(rows.map(function (row) { return row.flat.depth; }), [5, 9, 13, 17],
    'flat depths — deeper, not constant');

  prose.quotes('combinational-blocks',
    ['tree 1 gate at depth 3; flat 4 gates at depth 5',
      'tree 3 gates at depth 6; flat 13 gates at depth 9',
      'tree 7 gates at depth 9; flat 34 gates at depth 13',
      'tree 15 gates at depth 12; flat 83 gates at depth 17',
      'the tree is 15 gates at depth 12 and the flat form is 83 gates at depth 17']);
});

test('blocks: each block agrees with its model over the space it can walk', function () {
  const cases = [
    { name: 'muxTree', net: Select.muxTree({ bits: 2 }), model: Models.modelFor('muxTree',
      { bits: 2 }), vectors: 64 },
    { name: 'decoder', net: Select.decoder({ bits: 2 }), model: Models.modelFor('decoder',
      { bits: 2 }), vectors: 4 },
    { name: 'priority', net: Select.priorityEncoder({ bits: 2 }),
      model: Models.modelFor('priorityEncoder', { bits: 2 }), vectors: 16 },
    { name: 'comparator', net: Select.comparator({ width: 4 }),
      model: Models.modelFor('comparator', { width: 4 }), vectors: 256 },
    { name: 'shifter', net: Select.barrelShifter({ width: 8 }),
      model: Models.modelFor('barrelShifter', { width: 8 }), vectors: 2048 }
  ];

  cases.forEach(function (row) {
    const verdict = Hdl.equivalent(row.net, row.model, {});

    assert.strictEqual(verdict.exhaustive, true, row.name + ' is exhaustively checkable');
    assert.strictEqual(verdict.ok, true, row.name + ' agrees with its model');
    assert.strictEqual(verdict.checked, row.vectors, row.name + ' vector count');
  });

  const wide = Hdl.equivalent(Select.muxTree({ bits: 4 }),
    Models.modelFor('muxTree', { bits: 4 }), {});

  assert.strictEqual(wide.exhaustive, false, 'the 16:1 multiplexer is refused');
  assert.strictEqual(wide.inputs, 20, 'because it has twenty inputs');

  prose.quotes('combinational-blocks',
    ['both agree on 64 of 64', '6 gates at depth 3, agreeing with the model on 4 of 4 vectors',
      '9 gates at depth 7, agreeing on 16 of 16 vectors',
      '24 gates and 152 transistors at depth 13, agreeing on 256 of 256',
      '24 gates and 288 transistors at depth 9, agreeing on 2 048 of 2 048',
      '20 inputs is 1 048 576 vectors']);
});

test('blocks: the individual costs the prose quotes', function () {
  const decoder2 = blockCost(Select.decoder({ bits: 2 }));
  const decoder3 = blockCost(Select.decoder({ bits: 3 }));
  const priority = blockCost(Select.priorityEncoder({ bits: 2 }));
  const comparator = blockCost(Select.comparator({ width: 4 }));
  const shifter = blockCost(Select.barrelShifter({ width: 8 }));

  assert.deepStrictEqual([decoder2.gates, decoder2.depth], [6, 3], '2-bit decoder');
  assert.deepStrictEqual([decoder3.gates, decoder3.depth], [19, 5], '3-bit decoder');
  assert.deepStrictEqual([priority.gates, priority.depth], [9, 7], '4-input priority encoder');
  assert.deepStrictEqual([comparator.gates, comparator.transistors, comparator.depth],
    [24, 152, 13], '4-bit comparator');
  assert.deepStrictEqual([shifter.gates, shifter.transistors, shifter.depth], [24, 288, 9],
    '8-bit barrel shifter');

  prose.quotes('combinational-blocks',
    ['the 3-bit version is 19 gates at depth 5',
      'A 4-bit comparator is 24 gates and 152 transistors at depth 13',
      'An 8-bit barrel shifter is 24 gates and 288 transistors at depth 9']);
});
