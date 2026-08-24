/**
 * CYK: dynamic programming over substrings, and the second general parser.
 *
 * The table has one cell per (start, length) pair holding the nonterminals
 * that derive that substring. A cell is filled from every way of splitting its
 * substring in two, which is why the grammar must be in Chomsky normal form —
 * a production of exactly two nonterminals is what makes "split in two" the
 * only case to consider. That requirement is the whole trade: CYK is short and
 * obviously correct and needs the grammar rewritten first, while Earley takes
 * the grammar as it is and is longer and subtler.
 *
 * Both are here because they are each other's check. A disagreement between
 * them is either a bug in a parser or a bug in the normal-form conversion, and
 * either way it is a bug — which is what the differential test in this
 * milestone is for.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Cyk = api;
}(this, function (root) {
  'use strict';

  const Grammar = root && root.Grammar ? root.Grammar : require('../machines/grammar.js');
  const Transform = root && root.GrammarTransform ? root.GrammarTransform
    : require('./grammar-transform.js');

  /**
   * Recognise, keeping the table. `grammar` is converted to Chomsky normal
   * form here rather than being required in it, so a caller can hand over any
   * grammar and the empty string is handled separately — CNF cannot express it
   * except as a start production, and the table has no cell for a substring of
   * length zero.
   */
  function parse(grammar, tokens) {
    const cnf = Transform.toChomskyNormalForm(grammar).grammar;

    if (tokens.length === 0) {
      const empty = cnf.byLhs[cnf.start].some(function (rule) { return rule.rhs.length === 0; });

      return { accepted: empty, table: [], cnf: cnf, tokens: [], cells: 0, entries: 0 };
    }
    const table = buildTable(cnf, tokens);

    return {
      accepted: (table[0][tokens.length - 1] || {})[cnf.start] !== undefined,
      table: table, cnf: cnf, tokens: tokens.slice(),
      cells: tokens.length * (tokens.length + 1) / 2,
      entries: countEntries(table)
    };
  }

  function buildTable(cnf, tokens) {
    const n = tokens.length;
    const table = [];

    for (let i = 0; i < n; i += 1) {
      table.push([]);
      for (let j = 0; j < n; j += 1) table[i].push({});
    }
    tokens.forEach(function (token, i) {
      cnf.productions.forEach(function (rule) {
        if (rule.rhs.length === 1 && rule.rhs[0] === token) table[i][i][rule.lhs] = [];
      });
    });
    for (let length = 2; length <= n; length += 1) {
      for (let start = 0; start + length <= n; start += 1) {
        fillCell(cnf, table, start, length);
      }
    }
    return table;
  }

  /** One cell, from every split of its substring. The split point is the only
   *  loop CNF leaves to write. */
  function fillCell(cnf, table, start, length) {
    const end = start + length - 1;

    for (let split = start; split < end; split += 1) {
      cnf.productions.forEach(function (rule) {
        if (rule.rhs.length !== 2) return;
        if (table[start][split][rule.rhs[0]] === undefined) return;
        if (table[split + 1][end][rule.rhs[1]] === undefined) return;
        if (!table[start][end][rule.lhs]) table[start][end][rule.lhs] = [];
        table[start][end][rule.lhs].push({ rule: rule, split: split });
      });
    }
  }

  function countEntries(table) {
    let total = 0;

    table.forEach(function (row) {
      row.forEach(function (cell) { total += Object.keys(cell).length; });
    });
    return total;
  }

  function accepts(grammar, tokens) {
    return parse(grammar, tokens).accepted;
  }

  /** The table as rows for the demo: one per (start, length) with the
   *  nonterminals that derive that substring. */
  function tableRows(result) {
    const rows = [];
    const n = result.tokens.length;

    for (let length = 1; length <= n; length += 1) {
      for (let start = 0; start + length <= n; start += 1) {
        const cell = result.table[start][start + length - 1];

        rows.push({ start: start, length: length,
          substring: result.tokens.slice(start, start + length).join(' '),
          symbols: Object.keys(cell).sort(),
          splits: Object.keys(cell).reduce(function (total, key) {
            return total + (cell[key] ? cell[key].length : 0);
          }, 0) });
      }
    }
    return rows;
  }

  /** One parse tree, taking the first split in every cell — enough to show
   *  that the recogniser found a derivation, and not the whole forest. */
  function tree(result) {
    if (!result.accepted) return null;
    if (result.tokens.length === 0) return Grammar.node(result.cnf.start, []);
    return build(result, 0, result.tokens.length - 1, result.cnf.start);
  }

  function build(result, start, end, symbol) {
    const entry = result.table[start][end][symbol];

    if (entry === undefined) return null;
    if (start === end && entry.length === 0) {
      return Grammar.node(symbol, [Grammar.node(result.tokens[start], null)]);
    }
    const choice = entry[0];

    return Grammar.node(symbol, [
      build(result, start, choice.split, choice.rule.rhs[0]),
      build(result, choice.split + 1, end, choice.rule.rhs[1])
    ]);
  }

  return { parse: parse, accepts: accepts, tableRows: tableRows, tree: tree };
}));
