/**
 * Systematic enumeration with undo: n-queens, Sudoku and graph colouring,
 * each with the prunings and heuristics available individually.
 *
 * Backtracking is exhaustive search that never builds the whole state space.
 * It walks a tree of partial assignments, and everything interesting is in
 * *when* it notices that a branch is dead. The same solver with the diagonal
 * check moved from the leaf to the placement visits three orders of magnitude
 * fewer nodes on eight queens, and returns the identical answer - which is why
 * every pruning here is a flag rather than a rewrite: the node count is the
 * measurement, and it is only meaningful against the same solver.
 *
 * The undo step is where the bugs live. Anything mutated on the way down has
 * to be restored exactly on the way back up, and a forgotten restore does not
 * throw - it silently removes solutions or invents them. Every mutation in
 * this file is paired with its undo inside the same function, and the domain
 * bookkeeping for forward checking records what it removed so the restore
 * cannot drift from the removal.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Backtracking = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const DEFAULT_BUDGET = 5000000;

  function emptyReport() {
    return {
      nodes: 0, leaves: 0, backtracks: 0, solutions: 0,
      placements: 0, rejects: 0, propagations: 0, eliminated: 0,
      budgetExhausted: false
    };
  }

  /* ------------------------------------------------------------- n-queens */

  function conflictsWith(board, row, column) {
    for (let r = 0; r < row; r += 1) {
      const c = board[r];
      if (c === column) return true;
      if (row - r === Math.abs(column - c)) return true;
    }
    return false;
  }

  /** A completed board is legal only if no pair of queens attacks. This is the
   *  check the leaf-only configuration relies on, and it is what makes that
   *  configuration a real control rather than a broken solver. */
  function boardIsLegal(board) {
    for (let row = 1; row < board.length; row += 1) {
      if (conflictsWith(board, row, board[row])) return false;
    }
    return true;
  }

  function mirrorOf(board) {
    const n = board.length;
    return board.map(function (column) { return n - 1 - column; });
  }

  /** Column choices for one row, most-constrained-first when asked: the column
   *  that survives in the fewest later rows is tried first, so a dead branch
   *  dies at this level rather than several levels down. */
  function orderColumns(board, row, limit, settings) {
    const columns = [];
    for (let column = 0; column < limit; column += 1) columns.push(column);
    if (!settings.mostConstrained) return columns;

    const n = board.length;
    return columns.map(function (column) {
      let survivors = 0;
      for (let next = 0; next < n; next += 1) {
        board[row] = column;
        if (!conflictsWith(board, row + 1, next)) survivors += 1;
      }
      return { column: column, survivors: survivors };
    }).sort(function (a, b) { return a.survivors - b.survivors; })
      .map(function (entry) { return entry.column; });
  }

  /**
   * n-queens with each pruning individually switchable.
   *
   * `earlyDiagonal: false` is the honest control: the solver still assigns one
   * queen per row and one column per queen, but it only tests the diagonals at
   * the leaf. That is the same search with the feasibility check moved, and
   * the node ratio between the two is the section's whole point.
   */
  function nQueens(n, options) {
    const settings = options || {};
    const report = emptyReport();
    const budget = settings.nodeBudget || DEFAULT_BUDGET;
    const board = new Array(n).fill(-1);
    const used = new Array(n).fill(false);
    const found = [];
    const halfWidth = settings.symmetry ? Math.ceil(n / 2) : n;

    /* Symmetry breaking has to keep the boards even when the caller only
       wants a count, because the count is produced by mirroring them. */
    function record() {
      report.solutions += 1;
      if (!settings.countOnly || settings.symmetry) found.push(board.slice());
    }

    function descend(row) {
      if (report.nodes >= budget) {
        report.budgetExhausted = true;
        return;
      }
      report.nodes += 1;

      if (row === n) {
        report.leaves += 1;
        if (settings.earlyDiagonal === false && !boardIsLegal(board)) report.rejects += 1;
        else record();
        return;
      }

      const limit = row === 0 ? halfWidth : n;
      const columns = orderColumns(board, row, limit, settings);
      for (let i = 0; i < columns.length; i += 1) {
        const column = columns[i];
        if (used[column]) { report.rejects += 1; continue; }
        if (settings.earlyDiagonal !== false && conflictsWith(board, row, column)) {
          report.rejects += 1;
          continue;
        }
        board[row] = column;
        used[column] = true;
        report.placements += 1;
        descend(row + 1);
        used[column] = false;
        board[row] = -1;
        report.backtracks += 1;
        /* Ordering heuristics only pay when the search can stop: enumerating
           every solution walks the same tree whatever order it walks it in. */
        if (settings.firstOnly && report.solutions > 0) return;
      }
    }

    descend(0);
    if (settings.symmetry) return withMirrors(found, report, settings);
    return { solutions: settings.countOnly ? [] : found, report: report };
  }

  /** Symmetry breaking restricts the first row to the left half; the boards it
   *  did not visit are exactly the mirrors of the ones it did. Mirroring back
   *  through a set keeps the count exact for odd n, where a middle-column
   *  solution can be its own mirror. */
  function withMirrors(found, report, settings) {
    const seen = new Set();
    const solutions = [];
    found.forEach(function (board) {
      [board, mirrorOf(board)].forEach(function (candidate) {
        const key = candidate.join(',');
        if (seen.has(key)) return;
        seen.add(key);
        if (!settings.countOnly) solutions.push(candidate);
      });
    });
    report.solutions = seen.size;
    return { solutions: solutions, report: report };
  }

  /* --------------------------------------------------------------- Sudoku */

  const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const ALL_DIGITS = 0x3fe;   // bits 1..9

  function unitsOf(cell) {
    const row = Math.floor(cell / 9);
    const column = cell % 9;
    const boxRow = Math.floor(row / 3) * 3;
    const boxColumn = Math.floor(column / 3) * 3;
    const peers = new Set();

    for (let i = 0; i < 9; i += 1) {
      peers.add(row * 9 + i);
      peers.add(i * 9 + column);
      peers.add((boxRow + Math.floor(i / 3)) * 9 + boxColumn + (i % 3));
    }
    peers.delete(cell);
    return Array.from(peers);
  }

  const PEERS = (function () {
    const table = [];
    for (let cell = 0; cell < 81; cell += 1) table.push(unitsOf(cell));
    return table;
  }());

  function parsePuzzle(text) {
    const cells = String(text).replace(/[^0-9.]/g, '').split('');
    return cells.map(function (character) {
      return character === '.' || character === '0' ? 0 : Number(character);
    });
  }

  /** The digits a cell can still take, as a bitmask over 1..9, computed from
   *  scratch. Used to build the initial state and by callers that only want
   *  the answer for one cell. */
  function candidateMask(grid, cell) {
    const peers = PEERS[cell];
    let used = 0;
    for (let i = 0; i < peers.length; i += 1) {
      const value = grid[peers[i]];
      if (value) used |= 1 << value;
    }
    return ALL_DIGITS & ~used;
  }

  function maskCount(mask) {
    let n = mask;
    let total = 0;
    while (n) { n &= n - 1; total += 1; }
    return total;
  }

  function digitsOfMask(mask) {
    const out = [];
    for (let digit = 1; digit <= 9; digit += 1) {
      if (mask & (1 << digit)) out.push(digit);
    }
    return out;
  }

  /** The digits a cell can still take, given what its peers already hold. */
  function legalDigits(grid, cell) {
    return digitsOfMask(candidateMask(grid, cell));
  }

  /**
   * The search state: the grid, plus a candidate mask per empty cell kept in
   * step with it incrementally.
   *
   * Recomputing a cell's mask costs twenty peer reads, and MRV asks for all
   * eighty-one of them at every node. Maintaining them on assignment instead
   * turns that into eighty-one array reads, which is the difference between a
   * demo that renders and one that does not - and it is also the standard
   * shape of a real CSP solver, where the domains are the state.
   */
  function makeState(grid) {
    const masks = new Array(81).fill(0);
    for (let cell = 0; cell < 81; cell += 1) {
      if (!grid[cell]) masks[cell] = candidateMask(grid, cell);
    }
    return { grid: grid, masks: masks };
  }

  /** Assign, recording every mask bit removed so the undo is a replay. */
  function place(state, cell, digit) {
    const bit = 1 << digit;
    const removals = [cell];
    state.grid[cell] = digit;
    state.masks[cell] = 0;

    const peers = PEERS[cell];
    for (let i = 0; i < peers.length; i += 1) {
      const peer = peers[i];
      if (state.grid[peer] || !(state.masks[peer] & bit)) continue;
      state.masks[peer] &= ~bit;
      removals.push(peer);
    }
    return { cell: cell, digit: digit, touched: removals };
  }

  function unplace(state, record) {
    const bit = 1 << record.digit;
    state.grid[record.cell] = 0;
    for (let i = 1; i < record.touched.length; i += 1) state.masks[record.touched[i]] |= bit;
    state.masks[record.cell] = candidateMask(state.grid, record.cell);
  }

  /** Naive order takes the first empty cell; MRV takes the one with the fewest
   *  legal digits, which finds a dead branch at this level instead of eight
   *  levels down. A cell with no legal digit ends the branch immediately. */
  function chooseCell(state, settings) {
    let bestCell = -1;
    let bestCount = 10;

    for (let cell = 0; cell < 81; cell += 1) {
      if (state.grid[cell]) continue;
      if (!settings.mrv) return { cell: cell, digits: digitsOfMask(state.masks[cell]) };
      const count = maskCount(state.masks[cell]);
      if (count < bestCount) { bestCell = cell; bestCount = count; }
      if (count === 0) break;
    }
    if (bestCell === -1) return null;
    return { cell: bestCell, digits: digitsOfMask(state.masks[bestCell]) };
  }

  /** Forward checking: after an assignment, every empty cell must still have
   *  somewhere to go. It costs one scan per node and removes whole subtrees. */
  function anyCellStuck(state) {
    for (let cell = 0; cell < 81; cell += 1) {
      if (!state.grid[cell] && state.masks[cell] === 0) return true;
    }
    return false;
  }

  /** Constraint propagation to a fixed point: a cell with exactly one
   *  candidate is filled, which usually gives another. The records are
   *  returned so the caller's undo is a replay of what happened rather than a
   *  recomputation that can disagree with it. */
  function propagate(state, report) {
    const filled = [];
    let changed = true;

    while (changed) {
      changed = false;
      for (let cell = 0; cell < 81; cell += 1) {
        if (state.grid[cell]) continue;
        const mask = state.masks[cell];
        if (mask === 0) return { filled: filled, wiped: true };
        if (maskCount(mask) > 1) continue;
        filled.push(place(state, cell, digitsOfMask(mask)[0]));
        report.propagations += 1;
        report.eliminated += 1;
        changed = true;
      }
    }
    return { filled: filled, wiped: false };
  }

  function unfill(state, filled) {
    for (let i = filled.length - 1; i >= 0; i -= 1) unplace(state, filled[i]);
  }

  /**
   * Sudoku by backtracking, with the heuristics as flags.
   *
   * `mrv` picks the cell with the fewest remaining values; `forward` rejects a
   * branch the moment any empty cell has nowhere left to go; `ac3` propagates
   * singles to a fixed point after every assignment. Each is a strictly larger
   * amount of work per node, and each is worth it only if it removes more
   * nodes than it costs - which is what the demo measures rather than assumes.
   */
  function solveSudoku(puzzle, options) {
    const settings = options || {};
    const report = emptyReport();
    const budget = settings.nodeBudget || DEFAULT_BUDGET;
    const state = makeState(parsePuzzle(puzzle));
    let answer = null;

    function afterAssign() {
      if (settings.forward && anyCellStuck(state)) { report.rejects += 1; return null; }
      if (!settings.ac3) return { filled: [] };
      const propagated = propagate(state, report);
      if (propagated.wiped) { report.rejects += 1; unfill(state, propagated.filled); return null; }
      return propagated;
    }

    function descend() {
      if (report.nodes >= budget) { report.budgetExhausted = true; return false; }
      report.nodes += 1;

      const choice = chooseCell(state, settings);
      if (!choice) {
        report.leaves += 1;
        report.solutions += 1;
        answer = state.grid.slice();
        return true;
      }

      for (let i = 0; i < choice.digits.length; i += 1) {
        const record = place(state, choice.cell, choice.digits[i]);
        report.placements += 1;
        const propagated = afterAssign();
        if (propagated && descend()) return true;
        if (propagated) unfill(state, propagated.filled);
        unplace(state, record);
        report.backtracks += 1;
      }
      return false;
    }

    if (settings.ac3) propagate(state, report);
    const solved = descend();
    return { solved: solved, grid: answer, report: report };
  }

  /* ------------------------------------------------------ graph colouring */

  /**
   * k-colouring by backtracking. `degreeOrder` sorts the vertices by degree
   * first, which is the cheapest heuristic there is and usually the one that
   * decides whether the search finishes.
   */
  function colourGraph(adjacency, k, options) {
    const settings = options || {};
    const report = emptyReport();
    const budget = settings.nodeBudget || DEFAULT_BUDGET;
    const n = adjacency.length;
    const colours = new Array(n).fill(-1);

    const order = [];
    for (let i = 0; i < n; i += 1) order.push(i);
    if (settings.degreeOrder) {
      order.sort(function (a, b) { return adjacency[b].length - adjacency[a].length; });
    }

    function available(vertex, colour) {
      return adjacency[vertex].every(function (neighbour) { return colours[neighbour] !== colour; });
    }

    function descend(at) {
      if (report.nodes >= budget) { report.budgetExhausted = true; return false; }
      report.nodes += 1;
      if (at === n) { report.leaves += 1; report.solutions += 1; return true; }

      const vertex = order[at];
      for (let colour = 0; colour < k; colour += 1) {
        if (!available(vertex, colour)) { report.rejects += 1; continue; }
        colours[vertex] = colour;
        report.placements += 1;
        if (descend(at + 1)) return true;
        colours[vertex] = -1;
        report.backtracks += 1;
      }
      return false;
    }

    const ok = descend(0);
    return { coloured: ok, colours: ok ? colours.slice() : null, report: report };
  }

  return {
    DEFAULT_BUDGET: DEFAULT_BUDGET,
    nQueens: nQueens,
    boardIsLegal: boardIsLegal,
    mirrorOf: mirrorOf,
    parsePuzzle: parsePuzzle,
    solveSudoku: solveSudoku,
    peersOf: function (cell) { return PEERS[cell].slice(); },
    legalDigits: legalDigits,
    colourGraph: colourGraph
  };
}));
