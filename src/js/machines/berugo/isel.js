/**
 * Instruction selection: covering an expression tree with target instructions.
 *
 * This is the point where the compiler stops being target-independent, and the
 * design decision the section is about is that **the cost model is data, not
 * code**. Every tile below is a row — a pattern, a cost, and what it consumes
 * — so a second target is a second table rather than a second selector, and
 * changing one number changes what gets selected without touching an
 * algorithm. A selector that hard-codes "prefer multiply-add" cannot be
 * retargeted and cannot be tuned.
 *
 * The algorithm is bottom-up dynamic programming: the cheapest cover of a node
 * is the cheapest tile that matches there plus the cheapest covers of the
 * subtrees that tile leaves exposed. That is optimal for trees, and the module
 * ships an exhaustive search beside it to say so — a tiler that is subtly
 * wrong returns a valid cover at a slightly worse cost, and nothing but an
 * independent minimum notices.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Isel = api;
  }
}(this, function (root) {
  'use strict';

  const berugo = root && root.Berugo ? root.Berugo : null;
  const Ir = berugo && berugo.Ir ? berugo.Ir : require('./ir.js');

  /* --------------------------------------------------------------- the trees */

  /**
   * An expression tree per IR value whose result is read exactly once, in the
   * same block, by the instruction that follows it in dependence order. That
   * is the standard "tree region" a tiler works on: a value with two readers
   * has to live in a register, so it is a leaf of both trees rather than
   * duplicated into each.
   */
  function treesOf(block) {
    const single = singleUseValues(block);
    const byTarget = {};
    const roots = [];

    block.instructions.forEach(function (inst) {
      const target = Ir.definitionOf(inst);

      if (target) byTarget[target] = inst;
    });
    eachOf(block).forEach(function (inst) {
      collectRoots(inst, byTarget, single, roots);
    });
    return roots;
  }

  function eachOf(block) {
    return block.instructions.concat(block.terminator ? [block.terminator] : []);
  }

  /**
   * A root is a maximal expression: an instruction whose result is read more
   * than once (so it has to land in a register), or one that is not an
   * expression at all — a store, a call, a branch — in which case each of its
   * operands that IS an expression becomes a root of its own. Without the
   * second half every tree in this language is absorbed into a `storeLocal`
   * and the tiler is handed nothing, which is what the first version did.
   */
  function collectRoots(inst, byTarget, single, roots) {
    const target = Ir.definitionOf(inst);

    if (target && single[target]) return;
    if (TREE_KIND[inst.op]) {
      const built = buildTree(inst, byTarget, single);

      if (built) roots.push(built);
      return;
    }
    Ir.usesOf(inst).forEach(function (register) {
      if (!single[register] || !byTarget[register]) return;
      const built = buildTree(byTarget[register], byTarget, single);

      if (built) roots.push(built);
    });
  }

  function singleUseValues(block) {
    const counts = {};

    block.instructions.concat(block.terminator ? [block.terminator] : [])
      .forEach(function (inst) {
        Ir.usesOf(inst).forEach(function (register) {
          counts[register] = (counts[register] || 0) + 1;
        });
      });
    const single = {};

    Object.keys(counts).forEach(function (register) {
      if (counts[register] === 1) single[register] = true;
    });
    return single;
  }

  const TREE_KIND = { const: 'const', binary: 'binary', unary: 'unary',
    loadField: 'loadField', loadIndex: 'loadIndex', move: 'move' };

  function buildTree(inst, byTarget, single) {
    const kind = TREE_KIND[inst.op];

    if (!kind) return null;
    return { kind: kind, op: inst.operator || inst.field || '',
      target: Ir.definitionOf(inst),
      children: Ir.usesOf(inst).map(function (register) {
        return childFor(register, byTarget, single);
      }) };
  }

  function childFor(register, byTarget, single) {
    if (single[register] && byTarget[register]) {
      const built = buildTree(byTarget[register], byTarget, single);

      if (built) return built;
    }
    return { kind: Ir.isRegister(register) ? 'reg' : 'imm', op: String(register),
      children: [] };
  }

  /* ---------------------------------------------------------------- the tiles */

  /**
   * A tile is a pattern with holes. `pattern` is written as nested arrays —
   * `['binary:add', ['binary:mul', '_', '_'], '_']` is multiply-add — and `_`
   * is a hole the cover fills with the cheapest tree below it. `cost` is
   * cycles on the modelled target, and it is the only thing a retarget has to
   * change.
   */
  /**
   * `#imm` is a hole that only a literal fills — either an operand the IR
   * wrote inline or a `const` instruction folded into the tree. Keeping the
   * two spellings behind one token is what lets an addressing-mode tile fire
   * at all; matching only the first spelling made `ADDI` and `LDXI` dead rows
   * that never once beat their register forms.
   */
  const ARITHMETIC = { add: 1, sub: 1, mul: 3, div: 8, rem: 8 };
  const COMPARISONS = ['lt', 'le', 'gt', 'ge', 'eq', 'ne'];
  const LOGICAL = ['and', 'or'];

  const TILES = [
    { id: 'MOV', pattern: ['reg'], cost: 1, about: 'a value already in a register' },
    { id: 'MOVI', pattern: ['imm'], cost: 1, about: 'a literal into a register' },
    { id: 'CONSTI', pattern: ['const'], cost: 1, about: 'a pooled constant into a register' },
    { id: 'ADDI', pattern: ['binary:add', '_', '#imm'], cost: 1,
      about: 'register plus an immediate, no second register' },
    { id: 'MADD', pattern: ['binary:add', ['binary:mul', '_', '_'], '_'], cost: 4,
      about: 'multiply-add in one instruction, cheaper than MUL then ADD' },
    { id: 'MADDR', pattern: ['binary:add', '_', ['binary:mul', '_', '_']], cost: 4,
      about: 'the same tile with the operands the other way round' },
    { id: 'NEG', pattern: ['unary:-', '_'], cost: 1, about: 'negate' },
    { id: 'NOT', pattern: ['unary:!', '_'], cost: 1, about: 'logical not' },
    { id: 'LDF', pattern: ['loadField', '_'], cost: 3, about: 'a field load' },
    { id: 'LDXI', pattern: ['loadIndex', '_', '#imm'], cost: 2,
      about: 'an indexed load with a constant offset — one addressing mode' },
    { id: 'LDX', pattern: ['loadIndex', '_', '_'], cost: 3, about: 'an indexed load' },
    { id: 'MOVR', pattern: ['move', '_'], cost: 1, about: 'a copy' }
  ].concat(generatedTiles());

  /**
   * One row per operator rather than one hand-written tile each: a target
   * whose comparisons all cost the same should say so once, and an operator
   * with no row is a crash at selection time rather than a silently missing
   * instruction. `binary:eq` had no row until a conformance program used one.
   */
  function generatedTiles() {
    const rows = [];

    Object.keys(ARITHMETIC).forEach(function (name) {
      rows.push({ id: name.toUpperCase(), pattern: ['binary:' + name, '_', '_'],
        cost: ARITHMETIC[name], about: 'register ' + name + ' register' });
    });
    COMPARISONS.forEach(function (name) {
      rows.push({ id: 'CMP_' + name, pattern: ['binary:' + name, '_', '_'], cost: 1,
        about: 'a comparison, one cycle on this target' });
    });
    LOGICAL.forEach(function (name) {
      rows.push({ id: name.toUpperCase(), pattern: ['binary:' + name, '_', '_'], cost: 1,
        about: 'a bitwise operation' });
    });
    return rows;
  }

  function tileTable(overrides) {
    const costs = overrides || {};

    return TILES.map(function (tile) {
      return Object.assign({}, tile,
        { cost: costs[tile.id] === undefined ? tile.cost : costs[tile.id] });
    });
  }

  /* ------------------------------------------------------------- matching */

  function labelOf(node) {
    if (node.kind === 'binary' || node.kind === 'unary') return node.kind + ':' + node.op;
    return node.kind;
  }

  /**
   * A match returns the holes in order, or null. The holes are what the cover
   * recurses into, which is why the shape of the return value is a list of
   * subtrees rather than a boolean.
   */
  function match(pattern, node) {
    if (pattern === '_') return [node];
    if (pattern === '#imm') return isLiteral(node) ? [] : null;
    const head = Array.isArray(pattern) ? pattern[0] : pattern;

    if (head !== labelOf(node) && !(head === node.kind)) return null;
    const rest = Array.isArray(pattern) ? pattern.slice(1) : [];

    if (!rest.length) return [];
    if (rest.length !== node.children.length) return null;
    return matchChildren(rest, node.children);
  }

  function isLiteral(node) {
    return node.kind === 'imm' || (node.kind === 'const' && !node.children.length);
  }

  function matchChildren(patterns, children) {
    const holes = [];

    for (let at = 0; at < patterns.length; at += 1) {
      const found = match(patterns[at], children[at]);

      if (!found) return null;
      holes.push.apply(holes, found);
    }
    return holes;
  }

  /* ----------------------------------------------------- dynamic programming */

  /**
   * Bottom-up, memoised on the node. Every tile that matches here is priced as
   * its own cost plus the best cover of each hole; the cheapest wins. On a
   * tree this is optimal, which is the property the exhaustive search below
   * exists to confirm rather than to assert.
   */
  function cover(node, tiles, memo) {
    const table = memo || new Map();

    if (table.has(node)) return table.get(node);
    const options = candidates(node, tiles, table);
    const best = options.reduce(function (winner, option) {
      return !winner || option.cost < winner.cost ? option : winner;
    }, null);

    if (!best) throw new Error('no tile matches ' + labelOf(node));
    table.set(node, best);
    return best;
  }

  function candidates(node, tiles, table) {
    return tiles.map(function (tile) {
      const holes = match(tile.pattern, node);

      if (!holes) return null;
      const parts = holes.map(function (hole) { return cover(hole, tiles, table); });

      return { tile: tile.id, cost: tile.cost + parts.reduce(function (sum, part) {
        return sum + part.cost;
      }, 0), holes: parts, node: node };
    }).filter(Boolean);
  }

  /** The selected instructions, innermost first, which is emission order. */
  function emitted(best) {
    const out = [];
    const walk = function (choice) {
      choice.holes.forEach(walk);
      out.push({ tile: choice.tile, at: labelOf(choice.node) });
    };

    walk(best);
    return out;
  }

  /* ------------------------------------------------------------- the oracle */

  /**
   * Every cover, enumerated. Exponential in the tree and the only way to know
   * the dynamic-programming answer is the minimum rather than merely a good
   * one — a tiler with a wrong recurrence returns a valid cover at a slightly
   * higher cost, which reads as a target that simply has no better option.
   */
  function exhaustive(node, tiles, depth) {
    const budget = depth === undefined ? 0 : depth;

    if (budget > 24) throw new Error('the exhaustive cover is only for small trees');
    const options = tiles.map(function (tile) {
      const holes = match(tile.pattern, node);

      if (!holes) return null;
      return tile.cost + holes.reduce(function (sum, hole) {
        return sum + exhaustive(hole, tiles, budget + 1);
      }, 0);
    }).filter(function (value) { return value !== null; });

    if (!options.length) throw new Error('no tile matches ' + labelOf(node));
    return Math.min.apply(null, options);
  }

  /* --------------------------------------------------------------- reporting */

  function selectBlock(block, options) {
    const settings = options || {};
    const tiles = tileTable(settings.costs);

    return treesOf(block).map(function (tree) {
      const best = cover(tree, tiles, new Map());

      return { target: tree.target, root: labelOf(tree), size: treeSize(tree),
        cost: best.cost, tiles: emitted(best),
        instructions: emitted(best).length };
    });
  }

  function treeSize(node) {
    return 1 + node.children.reduce(function (sum, child) {
      return sum + treeSize(child);
    }, 0);
  }

  function selectFunction(fn, options) {
    const rows = [];

    fn.blocks.forEach(function (block) {
      selectBlock(block, options).forEach(function (row) {
        rows.push(Object.assign({ block: block.id }, row));
      });
    });
    return { rows: rows,
      cost: rows.reduce(function (sum, row) { return sum + row.cost; }, 0),
      instructions: rows.reduce(function (sum, row) { return sum + row.instructions; }, 0),
      trees: rows.length };
  }

  /** Every tree in a function, checked against the exhaustive minimum. */
  function checkOptimal(fn, options) {
    const settings = options || {};
    const tiles = tileTable(settings.costs);
    const rows = [];

    fn.blocks.forEach(function (block) {
      treesOf(block).forEach(function (tree) {
        if (treeSize(tree) > (settings.limit || 12)) return;
        rows.push({ block: block.id, root: labelOf(tree), size: treeSize(tree),
          dp: cover(tree, tiles, new Map()).cost, brute: exhaustive(tree, tiles, 0) });
      });
    });
    return { rows: rows, checked: rows.length,
      disagreements: rows.filter(function (row) { return row.dp !== row.brute; }).length };
  }

  /**
   * What one cost change does to the whole function. This is the section's
   * argument that the model is data: nothing is recompiled, one number moves,
   * and the selection follows.
   */
  function costSweep(fn, tile, values) {
    return values.map(function (value) {
      const costs = {};

      costs[tile] = value;
      const out = selectFunction(fn, { costs: costs });

      return { cost: value, total: out.cost, instructions: out.instructions,
        uses: countTile(out.rows, tile) };
    });
  }

  function countTile(rows, id) {
    return rows.reduce(function (sum, row) {
      return sum + row.tiles.filter(function (entry) { return entry.tile === id; }).length;
    }, 0);
  }

  return {
    TILES: TILES, tileTable: tileTable,
    treesOf: treesOf, treeSize: treeSize, labelOf: labelOf, match: match,
    cover: cover, emitted: emitted, exhaustive: exhaustive,
    selectBlock: selectBlock, selectFunction: selectFunction,
    checkOptimal: checkOptimal, costSweep: costSweep
  };
}));
