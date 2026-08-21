/**
 * Game DP: minimax, alpha-beta, win/lose labelling, Grundy numbers and
 * retrograde analysis.
 *
 * The through-line is that a game's state space is usually a *product* of
 * independent components, and the two big results here are both ways of
 * refusing to build that product.
 *
 * **Sprague-Grundy.** A sum of impartial games is equivalent to a single Nim
 * heap whose size is the XOR of the components' Grundy numbers. Three heaps of
 * 30 is 29 791 joint states and three independent computations of 31 - and the
 * XOR is not an approximation, it is exact. `grundyOfSum` computes it both
 * ways so a section can show the two agreeing.
 *
 * **Alpha-beta.** The same value as minimax from a fraction of the nodes, and
 * the fraction depends entirely on move ordering. Both node counts are
 * reported, and `alphaBeta` is asserted to return minimax's value - because
 * an alpha-beta bug prunes a branch it should have searched and returns a
 * *plausible* value, which no amount of looking at the number will reveal.
 *
 * The win/lose labelling is the third idea and the simplest: a state is losing
 * exactly when every move leads to a winning state, which is Grundy = 0 with
 * the numbers thrown away.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GameTheory = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function emptyReport() {
    return { nodes: 0, leaves: 0, pruned: 0, states: 0, transitions: 0, maxDepth: 0 };
  }

  /* ------------------------------------------------------- Grundy numbers */

  /** The minimum excludant: the smallest non-negative integer not in the set.
   *  Everything about Grundy theory rests on this one operation. */
  function mex(values) {
    const seen = new Set(values);
    let candidate = 0;

    while (seen.has(candidate)) candidate += 1;
    return candidate;
  }

  /**
   * Grundy numbers for a one-heap game, where `movesFrom(size)` lists the heap
   * sizes reachable in one move. A position is losing exactly when its Grundy
   * number is 0, so the labelling comes free.
   */
  function grundyTable(limit, movesFrom, options) {
    const report = (options || {}).report || emptyReport();
    const grundy = new Array(limit + 1).fill(0);

    for (let size = 0; size <= limit; size += 1) {
      report.states += 1;
      const reachable = movesFrom(size).map(function (next) {
        report.transitions += 1;
        return grundy[next];
      });
      grundy[size] = mex(reachable);
    }
    return { grundy: grundy, losing: grundy.map(function (g) { return g === 0; }), report: report };
  }

  /** Ordinary Nim: any positive number of tokens from one heap. */
  function nimMoves() {
    return function (size) {
      const out = [];

      for (let next = 0; next < size; next += 1) out.push(next);
      return out;
    };
  }

  /** Subtraction games: remove one of a fixed set of amounts. The Grundy
   *  sequence is eventually periodic, which the demo shows rather than states. */
  function subtractionMoves(allowed) {
    return function (size) {
      return allowed.filter(function (take) { return take <= size; })
        .map(function (take) { return size - take; });
    };
  }

  /** The XOR theorem, applied. */
  function grundyOfSum(heaps, grundy) {
    return heaps.reduce(function (total, heap) { return total ^ grundy[heap]; }, 0);
  }

  /**
   * The same answer by building the joint state space, which is the thing the
   * theorem makes unnecessary. Only ever called on small heaps - that is the
   * point, and the demo quotes both state counts side by side.
   */
  function jointGameWinner(heaps, movesFrom, options) {
    const report = (options || {}).report || emptyReport();
    const memo = new Map();

    function winning(state) {
      const key = state.join(',');

      if (memo.has(key)) return memo.get(key);
      report.states += 1;
      let result = false;

      state.forEach(function (heap, index) {
        if (result) return;
        movesFrom(heap).forEach(function (next) {
          if (result) return;
          report.transitions += 1;
          const child = state.slice();
          child[index] = next;

          if (!winning(child)) result = true;
        });
      });
      memo.set(key, result);
      return result;
    }
    return { firstPlayerWins: winning(heaps.slice()), report: report };
  }

  /** The period of an eventually periodic Grundy sequence, found rather than
   *  asserted. Returns null when no period is visible inside the table. */
  function grundyPeriod(grundy, options) {
    const settings = options || {};
    const preamble = settings.preamble || 0;
    const tail = grundy.slice(preamble);

    for (let period = 1; period <= Math.floor(tail.length / 3); period += 1) {
      let matches = true;

      for (let i = period; i < tail.length; i += 1) {
        if (tail[i] === tail[i - period]) continue;
        matches = false;
        break;
      }

      if (matches) return { period: period, from: preamble };
    }
    return null;
  }

  /* -------------------------------------------------------------- minimax */

  /**
   * Plain minimax over a game supplied as `{ moves, apply, terminal, score }`.
   * `score` is from the maximising player's point of view at every depth, so
   * the two players are one sign apart rather than two code paths.
   */
  function minimax(game, state, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();

    function go(current, maximising, depth) {
      report.nodes += 1;
      report.maxDepth = Math.max(report.maxDepth, depth);
      const done = game.terminal(current);

      if (done !== null) { report.leaves += 1; return done; }
      let best = maximising ? -Infinity : Infinity;

      game.moves(current, maximising).forEach(function (move) {
        report.transitions += 1;
        const value = go(game.apply(current, move, maximising), !maximising, depth + 1);
        best = maximising ? Math.max(best, value) : Math.min(best, value);
      });
      return best;
    }
    return { value: go(state, settings.maximising !== false, 0), report: report };
  }

  /**
   * Alpha-beta. The window is the whole algorithm: once a minimising node
   * finds a value at or below alpha, the maximising parent already has
   * something at least as good, so the rest of that node's moves cannot change
   * the answer and are never searched.
   *
   * `orderMoves` exists because the pruning is entirely at its mercy - perfect
   * ordering searches O(b^(d/2)) nodes and the worst ordering searches all of
   * them. Both are demonstrable from the same position by changing one option.
   */
  function alphaBeta(game, state, options) {
    const settings = options || {};
    const report = settings.report || emptyReport();
    const context = { game: game, report: report,
      order: settings.orderMoves || function (moves) { return moves; } };

    function go(current, maximising, alpha, beta, depth) {
      report.nodes += 1;
      report.maxDepth = Math.max(report.maxDepth, depth);
      const done = game.terminal(current);

      if (done !== null) { report.leaves += 1; return done; }
      return scan(context, go, current, { maximising: maximising, alpha: alpha, beta: beta,
        depth: depth });
    }
    return { value: go(state, settings.maximising !== false, -Infinity, Infinity, 0),
      report: report };
  }

  /**
   * One alpha-beta node's move loop, including the cutoff.
   *
   * The cutoff is `beta <= alpha`, and the count of moves it skipped is added
   * to `pruned` - which is what makes the move-ordering claim measurable: the
   * same position under two orderings returns the same value and prunes a
   * different number of branches.
   */
  function scan(context, go, current, window) {
    const moves = context.order(context.game.moves(current, window.maximising), current,
      window.maximising);
    let best = window.maximising ? -Infinity : Infinity;
    let alpha = window.alpha;
    let beta = window.beta;

    for (let i = 0; i < moves.length; i += 1) {
      context.report.transitions += 1;
      const next = context.game.apply(current, moves[i], window.maximising);
      const value = go(next, !window.maximising, alpha, beta, window.depth + 1);

      if (window.maximising) {
        best = Math.max(best, value);
        alpha = Math.max(alpha, best);
      } else {
        best = Math.min(best, value);
        beta = Math.min(beta, best);
      }

      if (beta > alpha) continue;
      context.report.pruned += moves.length - i - 1;
      break;
    }
    return best;
  }

  /* ------------------------------------------------------ retrograde analysis */

  /**
   * Label every state of a finite game win/lose/draw by working *backwards*
   * from the terminal positions, counting each state's unresolved successors.
   * This is how endgame tables are built, and it is the technique that handles
   * cycles - which a forward memoised search cannot, because a cycle is an
   * infinite recursion rather than a draw.
   */
  function retrograde(states, successors, terminalValue, options) {
    const report = (options || {}).report || emptyReport();
    const label = new Map();
    const remaining = new Map();
    const predecessors = new Map();
    const queue = [];

    states.forEach(function (state) { predecessors.set(state, []); });
    states.forEach(function (state) {
      successors(state).forEach(function (next) {
        (predecessors.get(next) || []).push(state);
      });
    });
    states.forEach(function (state) {
      report.states += 1;
      const value = terminalValue(state);
      remaining.set(state, successors(state).length);

      if (value === null) return;
      label.set(state, value);
      queue.push(state);
    });

    while (queue.length) {
      const state = queue.shift();
      const value = label.get(state);
      predecessors.get(state).forEach(function (parent) {
        report.transitions += 1;

        if (label.has(parent)) return;

        if (value === 'lose') { label.set(parent, 'win'); queue.push(parent); return; }
        remaining.set(parent, remaining.get(parent) - 1);

        if (remaining.get(parent) !== 0) return;
        label.set(parent, 'lose');
        queue.push(parent);
      });
    }
    states.forEach(function (state) {
      if (!label.has(state)) label.set(state, 'draw');
    });
    return { label: label, report: report };
  }

  /* ------------------------------------------------------------- tic-tac-toe */

  /** A tiny complete game, as the fixture alpha-beta is measured on. A board
   *  is a 9-character string of 'x', 'o' and '.'. */
  function ticTacToe() {
    const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7],
      [2, 5, 8], [0, 4, 8], [2, 4, 6]];

    function winner(board) {
      let found = null;

      LINES.forEach(function (line) {
        if (found) return;
        const a = board[line[0]];

        if (a === '.' || board[line[1]] !== a || board[line[2]] !== a) return;
        found = a;
      });
      return found;
    }
    return {
      lines: LINES,
      empty: '.........',
      moves: function (board) {
        const out = [];

        for (let i = 0; i < 9; i += 1) {
          if (board[i] === '.') out.push(i);
        }
        return out;
      },
      apply: function (board, at, maximising) {
        return board.slice(0, at) + (maximising ? 'x' : 'o') + board.slice(at + 1);
      },
      terminal: function (board) {
        const won = winner(board);

        if (won === 'x') return 1;

        if (won === 'o') return -1;
        return board.indexOf('.') === -1 ? 0 : null;
      },
      winner: winner
    };
  }

  /** Centre, then corners, then edges - the ordering that makes alpha-beta's
   *  dependence on move order measurable rather than theoretical. */
  function centreFirst(moves) {
    const rank = { 4: 0, 0: 1, 2: 1, 6: 1, 8: 1, 1: 2, 3: 2, 5: 2, 7: 2 };
    return moves.slice().sort(function (a, b) { return rank[a] - rank[b]; });
  }

  /**
   * Edges first, then corners, then the centre - the exact reverse ranking.
   *
   * Reversing the move *list* is not a worse ordering on this board: it is
   * symmetric, so `[8..0]` prunes exactly as `[0..8]` does (18 297 nodes
   * either way). A genuinely bad ordering has to be bad about the game, not
   * about the array, which is why this ranks by square quality rather than by
   * index.
   */
  function edgesFirst(moves) {
    const rank = { 4: 2, 0: 1, 2: 1, 6: 1, 8: 1, 1: 0, 3: 0, 5: 0, 7: 0 };
    return moves.slice().sort(function (a, b) { return rank[a] - rank[b]; });
  }

  /** Reversing the list, kept because the section's claim is that this is
   *  NOT a worse ordering and the counter proves it. */
  function reverseOrder(moves) {
    return moves.slice().reverse();
  }

  return {
    emptyReport: emptyReport, mex: mex,
    grundyTable: grundyTable, nimMoves: nimMoves, subtractionMoves: subtractionMoves,
    grundyOfSum: grundyOfSum, jointGameWinner: jointGameWinner, grundyPeriod: grundyPeriod,
    minimax: minimax, alphaBeta: alphaBeta, retrograde: retrograde,
    ticTacToe: ticTacToe, centreFirst: centreFirst, edgesFirst: edgesFirst,
    reverseOrder: reverseOrder
  };
}));
