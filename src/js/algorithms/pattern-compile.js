/**
 * Compiling pattern matching: decision trees, exhaustiveness and dead clauses.
 *
 * A `match` is not a chain of `if`s. A compiler turns the clause matrix into a
 * decision tree in which every constructor test happens once, and the quality
 * of that tree is decided by which *column* it tests first — a choice with no
 * effect on meaning and a large effect on code size.
 *
 * The same machinery answers the two questions a good compiler warns about.
 * Exhaustiveness: is there a value no clause matches? Redundancy: is there a
 * clause no value can reach? Both reduce to Maranget's *usefulness* relation —
 * a pattern vector is useful against a matrix when some value matches it and
 * none of the rows above. Exhaustiveness is "the all-wildcards vector is not
 * useful"; redundancy is "row i is not useful against rows 1..i-1". One
 * algorithm, and the counterexample falls out of it rather than being guessed.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.PatternCompile = api;
}(this, function () {
  'use strict';

  /* ---------------------------------------------------------- signatures */

  /**
   * A type is a fixed set of constructors with arities. The set has to be
   * *closed* for exhaustiveness to mean anything — which is exactly why an
   * open type (a string, an integer) makes every match need a default.
   */
  const TYPES = {
    Bool: [{ name: 'true', arity: 0 }, { name: 'false', arity: 0 }],
    Colour: [{ name: 'red', arity: 0 }, { name: 'green', arity: 0 },
      { name: 'blue', arity: 0 }],
    Option: [{ name: 'none', arity: 0 }, { name: 'some', arity: 1, args: ['Bool'] }],
    List: [{ name: 'nil', arity: 0 },
      { name: 'cons', arity: 2, args: ['Bool', 'List'] }],
    Tree: [{ name: 'leaf', arity: 0 },
      { name: 'node', arity: 3, args: ['Tree', 'Bool', 'Tree'] }],
    Pair: [{ name: 'pair', arity: 2, args: ['Bool', 'Bool'] }]
  };

  function constructorsOf(typeName) { return TYPES[typeName] || []; }

  function constructorNamed(typeName, name) {
    return constructorsOf(typeName).filter(function (entry) {
      return entry.name === name;
    })[0];
  }

  /* ------------------------------------------------------------ patterns */

  function wildcard() { return { kind: 'wild' }; }
  function constructorPattern(name, args) {
    return { kind: 'con', name: name, args: args || [] };
  }

  function showPattern(pattern) {
    if (pattern.kind === 'wild') return '_';
    if (pattern.args.length === 0) return pattern.name;
    return pattern.name + '(' + pattern.args.map(showPattern).join(', ') + ')';
  }

  function showRow(row) {
    return row.map(showPattern).join(' , ');
  }

  /** A compact source syntax so fixtures read like real match arms. */
  function parsePattern(text) {
    const tokens = String(text).match(/[A-Za-z_][A-Za-z0-9_]*|[(),]/g) || [];
    const state = { tokens: tokens, at: 0 };
    const pattern = parseOne(state);

    if (state.at < tokens.length) throw new Error('unexpected pattern token');
    return pattern;
  }

  /**
   * A name the signature knows is a constructor; anything else is a variable,
   * and a variable matches everything — which is why it compiles to the same
   * thing as `_`, and why binding a name costs nothing in the decision tree.
   */
  function parseOne(state) {
    const token = state.tokens[state.at];

    state.at += 1;
    if (state.tokens[state.at] === '(') {
      state.at += 1;
      return constructorPattern(token, parseArguments(state));
    }
    return KNOWN.indexOf(token) === -1 ? wildcard() : constructorPattern(token, []);
  }

  function parseArguments(state) {
    const args = [];

    while (state.tokens[state.at] !== ')') {
      args.push(parseOne(state));
      if (state.tokens[state.at] === ',') state.at += 1;
    }
    state.at += 1;
    return args;
  }

  const KNOWN = Object.keys(TYPES).reduce(function (names, typeName) {
    return names.concat(constructorsOf(typeName).map(function (entry) {
      return entry.name;
    }));
  }, []);

  function parseRow(text) {
    return String(text).split(';').map(function (part) {
      return parsePattern(part.trim());
    });
  }

  /* ---------------------------------------------------- matrix operations */

  /** Specialise by a constructor: keep the rows that could match, unfold them. */
  function specialise(matrix, name, arity) {
    const rows = [];

    matrix.forEach(function (row) {
      const head = row[0];

      if (head.kind === 'wild') {
        rows.push(fill(arity).concat(row.slice(1)));
        return;
      }
      if (head.name !== name) return;
      rows.push(head.args.concat(row.slice(1)));
    });
    return rows;
  }

  function fill(count) {
    const out = [];

    for (let i = 0; i < count; i += 1) out.push(wildcard());
    return out;
  }

  /** The default matrix: the rows that do not test the first column at all. */
  function defaultMatrix(matrix) {
    return matrix.filter(function (row) {
      return row[0].kind === 'wild';
    }).map(function (row) { return row.slice(1); });
  }

  function headConstructors(matrix) {
    const names = [];

    matrix.forEach(function (row) {
      if (row[0].kind !== 'con') return;
      if (names.indexOf(row[0].name) === -1) names.push(row[0].name);
    });
    return names;
  }

  /* ------------------------------------------------------- usefulness */

  /**
   * Maranget's `U(P, q)`: is there a value matching `q` that no row of `P`
   * matches? Returns the witness when there is one, which is what turns a
   * warning into a message a reader can act on.
   */
  function useful(matrix, vector, types) {
    if (vector.length === 0) return matrix.length === 0 ? { useful: true, witness: [] } : { useful: false };
    if (vector[0].kind === 'con') return usefulConstructor(matrix, vector, types);
    return usefulWildcard(matrix, vector, types);
  }

  function usefulConstructor(matrix, vector, types) {
    const head = vector[0];
    const entry = constructorNamed(types[0], head.name);
    const arity = entry ? entry.arity : head.args.length;
    const inner = useful(specialise(matrix, head.name, arity),
      head.args.concat(vector.slice(1)), argumentTypes(types, head.name));

    if (!inner.useful) return { useful: false };
    return { useful: true,
      witness: [constructorPattern(head.name, inner.witness.slice(0, arity))]
        .concat(inner.witness.slice(arity)) };
  }

  function argumentTypes(types, name) {
    const entry = constructorNamed(types[0], name);
    const args = entry && entry.args ? entry.args : fill(entry ? entry.arity : 0)
      .map(function () { return types[0]; });

    return args.concat(types.slice(1));
  }

  /**
   * The wildcard case is where exhaustiveness actually lives. If the matrix's
   * head constructors cover the type, the only way to be useful is to be
   * useful under one of them; if they do not, a missing constructor is itself
   * the witness.
   */
  function usefulWildcard(matrix, vector, types) {
    const present = headConstructors(matrix);
    const all = constructorsOf(types[0]);
    const missing = all.filter(function (entry) {
      return present.indexOf(entry.name) === -1;
    });

    if (all.length > 0 && missing.length === 0) {
      return usefulUnderEach(matrix, vector, types, all);
    }
    return usefulByDefault(matrix, vector, types, missing);
  }

  function usefulUnderEach(matrix, vector, types, all) {
    for (let i = 0; i < all.length; i += 1) {
      const probe = constructorPattern(all[i].name, fill(all[i].arity));
      const inner = useful(matrix, [probe].concat(vector.slice(1)), types);

      if (inner.useful) return inner;
    }
    return { useful: false };
  }

  function usefulByDefault(matrix, vector, types, missing) {
    const inner = useful(defaultMatrix(matrix), vector.slice(1), types.slice(1));

    if (!inner.useful) return { useful: false };
    const head = missing.length > 0
      ? constructorPattern(missing[0].name, fill(missing[0].arity))
      : wildcard();

    return { useful: true, witness: [head].concat(inner.witness) };
  }

  /* ------------------------------------------------- the two questions */

  /** Is any value unmatched? If so, here it is. */
  function exhaustive(matrix, types) {
    const probe = fill(types.length);
    const result = useful(matrix, probe, types);

    return { exhaustive: !result.useful,
      witness: result.useful ? showRow(result.witness) : '',
      missing: result.useful ? result.witness : null };
  }

  /** Which clauses can never run, and why. */
  function redundant(matrix, types) {
    return matrix.map(function (row, index) {
      const above = matrix.slice(0, index);
      const result = useful(above, row, types);

      return { index: index, row: showRow(row), reachable: result.useful,
        why: result.useful ? '' : 'every value matching it already matched an earlier clause' };
    });
  }

  /* ------------------------------------------------------ decision trees */

  const HEURISTICS = {
    first: { label: 'leftmost column',
      score: function () { return 0; } },
    smallDefault: { label: 'smallest default matrix',
      score: function (matrix, column) { return -defaultSize(matrix, column); } },
    necessity: { label: 'most rows testing the column',
      score: function (matrix, column) { return tested(matrix, column); } },
    fewestBranches: { label: 'fewest head constructors',
      score: function (matrix, column) { return -branchCount(matrix, column); } }
  };

  function defaultSize(matrix, column) {
    return matrix.filter(function (row) { return row[column].kind === 'wild'; }).length;
  }

  function tested(matrix, column) {
    return matrix.filter(function (row) { return row[column].kind === 'con'; }).length;
  }

  function branchCount(matrix, column) {
    return headConstructors(matrix.map(function (row) {
      return row.slice(column);
    })).length;
  }

  /**
   * Build the tree. Each node either succeeds with a clause index, fails, or
   * switches on one column; the heuristic only chooses *which* column, so the
   * trees all decide the same thing at different sizes.
   */
  function compile(matrix, types, heuristicName) {
    const rows = matrix.map(function (row, index) {
      return { patterns: row.slice(), clause: index };
    });

    return build(rows, types.slice(), HEURISTICS[heuristicName || 'first'], 0);
  }

  function build(rows, types, heuristic, depth) {
    if (rows.length === 0) return { kind: 'fail', depth: depth };
    if (rows[0].patterns.every(isWild)) {
      return { kind: 'leaf', clause: rows[0].clause, depth: depth };
    }
    const column = chooseColumn(rows, heuristic);

    return switchOn(rows, types, heuristic, { column: column, depth: depth });
  }

  function isWild(pattern) { return pattern.kind === 'wild'; }

  function chooseColumn(rows, heuristic) {
    const matrix = rows.map(function (row) { return row.patterns; });
    let best = 0;
    let bestScore = -Infinity;

    for (let column = 0; column < matrix[0].length; column += 1) {
      if (matrix.every(function (row) { return row[column].kind === 'wild'; })) continue;
      const score = heuristic.score(matrix, column);

      if (score <= bestScore) continue;
      bestScore = score;
      best = column;
    }
    return best;
  }

  function switchOn(rows, types, heuristic, position) {
    const column = position.column;
    const matrix = rows.map(function (row) { return row.patterns; });
    const present = headConstructors(matrix.map(function (row) { return row.slice(column); }));
    const all = constructorsOf(types[column]);
    const node = { kind: 'switch', column: column, type: types[column],
      depth: position.depth, cases: [], fallback: null };

    present.forEach(function (name) {
      node.cases.push(caseFor(rows, types, heuristic, { column: column, name: name,
        depth: position.depth }));
    });
    return withFallback(node, rows, types, heuristic, all, present);
  }

  function caseFor(rows, types, heuristic, spec) {
    const entry = constructorNamed(types[spec.column], spec.name)
      || { arity: 0, args: [] };
    const inner = rows.map(function (row) {
      return specialiseRow(row, spec.column, spec.name, entry.arity);
    }).filter(Boolean);
    const innerTypes = types.slice(0, spec.column)
      .concat(entry.args || fill(entry.arity).map(function () { return types[spec.column]; }))
      .concat(types.slice(spec.column + 1));

    return { name: spec.name, arity: entry.arity,
      tree: build(inner, innerTypes, heuristic, spec.depth + 1) };
  }

  function specialiseRow(row, column, name, arity) {
    const head = row.patterns[column];

    if (head.kind === 'wild') {
      return { clause: row.clause, patterns: row.patterns.slice(0, column)
        .concat(fill(arity)).concat(row.patterns.slice(column + 1)) };
    }
    if (head.name !== name) return null;
    return { clause: row.clause, patterns: row.patterns.slice(0, column)
      .concat(head.args).concat(row.patterns.slice(column + 1)) };
  }

  function withFallback(node, rows, types, heuristic, all, present) {
    if (all.length > 0 && present.length === all.length) return node;
    const rest = rows.filter(function (row) {
      return row.patterns[node.column].kind === 'wild';
    }).map(function (row) {
      return { clause: row.clause, patterns: row.patterns.slice(0, node.column)
        .concat(row.patterns.slice(node.column + 1)) };
    });
    const restTypes = types.slice(0, node.column).concat(types.slice(node.column + 1));

    node.fallback = build(rest, restTypes, heuristic, node.depth + 1);
    return node;
  }

  /* ------------------------------------------------------------ metrics */

  function treeSize(node) {
    if (node.kind !== 'switch') return 1;
    return node.cases.reduce(function (total, entry) {
      return total + treeSize(entry.tree);
    }, 1) + (node.fallback ? treeSize(node.fallback) : 0);
  }

  function treeTests(node) {
    if (node.kind !== 'switch') return 0;
    return node.cases.reduce(function (total, entry) {
      return total + treeTests(entry.tree);
    }, 1) + (node.fallback ? treeTests(node.fallback) : 0);
  }

  function treeDepth(node) {
    if (node.kind !== 'switch') return 1;
    const inner = node.cases.map(function (entry) { return treeDepth(entry.tree); })
      .concat(node.fallback ? [treeDepth(node.fallback)] : []);

    return 1 + Math.max.apply(null, inner.concat([0]));
  }

  function leafClauses(node, into) {
    const found = into || [];

    if (node.kind === 'leaf') {
      if (found.indexOf(node.clause) === -1) found.push(node.clause);
      return found;
    }
    if (node.kind !== 'switch') return found;
    node.cases.forEach(function (entry) { leafClauses(entry.tree, found); });
    if (node.fallback) leafClauses(node.fallback, found);
    return found;
  }

  /**
   * How many values a type has, counting only those built from at most `depth`
   * nested constructors. A finite type saturates immediately; a recursive one
   * keeps growing, which is why exhaustiveness cannot be checked by
   * enumerating values and needs the usefulness algorithm instead.
   */
  function valueCount(typeName, depth) {
    if (depth < 0) return 0;
    return constructorsOf(typeName).reduce(function (total, entry) {
      return total + argumentProduct(entry, depth);
    }, 0);
  }

  function argumentProduct(entry, depth) {
    const args = entry.args || [];

    if (entry.arity === 0) return 1;
    return args.reduce(function (product, argType) {
      return product * valueCount(argType, depth - 1);
    }, 1);
  }

  /** Every heuristic on one matrix, so "which column first" becomes a number. */
  function heuristicTable(matrix, types) {
    return Object.keys(HEURISTICS).map(function (name) {
      const tree = compile(matrix, types, name);

      return { name: name, label: HEURISTICS[name].label, size: treeSize(tree),
        tests: treeTests(tree), depth: treeDepth(tree),
        clauses: leafClauses(tree).length, tree: tree };
    });
  }

  return {
    TYPES: TYPES, HEURISTICS: HEURISTICS, constructorsOf: constructorsOf,
    wildcard: wildcard, constructorPattern: constructorPattern,
    showPattern: showPattern, showRow: showRow, parsePattern: parsePattern, parseRow: parseRow,
    specialise: specialise, defaultMatrix: defaultMatrix, headConstructors: headConstructors,
    useful: useful, exhaustive: exhaustive, redundant: redundant,
    compile: compile, treeSize: treeSize, treeTests: treeTests, treeDepth: treeDepth,
    valueCount: valueCount,
    leafClauses: leafClauses, heuristicTable: heuristicTable
  };
}));
