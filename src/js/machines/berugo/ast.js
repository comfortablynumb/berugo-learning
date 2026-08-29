/**
 * Berugo AST: node definitions, traversal, and a printer that round-trips.
 *
 * The precedence table lives here rather than in the parser, and both the
 * parser and the printer consume it. That is deliberate: a printer with its
 * own idea of precedence emits parentheses the parser does not need, or omits
 * ones it does, and either way the round-trip property fails. Keeping one
 * table means a disagreement is impossible rather than merely unlikely — and
 * the round-trip test then measures something real.
 *
 * Every node carries a `span`. Synthesised nodes carry the span of the surface
 * construct they came from, so a diagnostic about desugared code points at
 * what the developer wrote. `origin` records which construct that was.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) {
    scope.Berugo = scope.Berugo || {};
    scope.Berugo.Ast = api;
  }
}(this, function () {
  'use strict';

  /**
   * One table, two consumers. `left` is the binding power to the left of the
   * operator and `right` the power to its right; making them differ by one is
   * what encodes associativity, and `**`-style right associativity would set
   * them the other way round.
   */
  const PRECEDENCE = {
    '||': { left: 1, right: 2 }, '&&': { left: 3, right: 4 },
    '==': { left: 5, right: 6 }, '!=': { left: 5, right: 6 },
    '<': { left: 7, right: 8 }, '<=': { left: 7, right: 8 },
    '>': { left: 7, right: 8 }, '>=': { left: 7, right: 8 },
    '+': { left: 9, right: 10 }, '-': { left: 9, right: 10 },
    '*': { left: 11, right: 12 }, '/': { left: 11, right: 12 },
    '%': { left: 11, right: 12 }
  };

  const UNARY_POWER = 13;
  const POSTFIX_POWER = 15;

  /** Every node kind, and where each one's children live. */
  const CHILDREN = {
    program: ['items'],
    letDecl: ['value'], fnDecl: ['params', 'body'], importDecl: [],
    block: ['statements', 'tail'],
    exprStmt: ['expr'], assign: ['target', 'value'],
    whileStmt: ['test', 'body'], forStmt: ['iterable', 'body'],
    returnStmt: ['value'], breakStmt: [], continueStmt: [],
    num: [], str: [], bool: [], name: [], unit: [],
    unary: ['operand'], binary: ['left', 'right'],
    call: ['callee', 'args'], field: ['object'], index: ['object', 'key'],
    array: ['items'], record: ['fields'], recordField: ['value'],
    lambda: ['params', 'body'], param: [],
    ifExpr: ['test', 'then', 'other'],
    matchExpr: ['subject', 'arms'], matchArm: ['pattern', 'guard', 'body'],
    patternName: [], patternWild: [], patternLiteral: [],
    patternCtor: ['args'], patternRecord: ['fields'], patternField: ['pattern'],
    error: []
  };

  const KINDS = Object.keys(CHILDREN);

  function node(kind, span, extra) {
    return Object.assign({ kind: kind, span: span }, extra || {});
  }

  /** A node the parser synthesised, carrying the span it stands in for. */
  function synthetic(kind, span, origin, extra) {
    return Object.assign(node(kind, span, extra), { origin: origin });
  }

  function childrenOf(target) {
    const slots = CHILDREN[target.kind] || [];
    const found = [];

    slots.forEach(function (slot) {
      const value = target[slot];

      if (value === null || value === undefined) return;
      if (Array.isArray(value)) {
        value.forEach(function (entry) { if (entry) found.push(entry); });
        return;
      }
      found.push(value);
    });
    return found;
  }

  /**
   * Pre-order or post-order, with early exit. A visitor returning `false`
   * stops the walk — which is what a "find the node at this offset" query
   * needs, and what a visitor without it forces callers to fake with
   * exceptions.
   */
  function visit(target, handlers) {
    const hooks = handlers || {};
    const state = { stopped: false, visited: 0 };

    walk(target, hooks, state, null);
    return state;
  }

  function walk(target, hooks, state, parent) {
    if (state.stopped || !target || !target.kind) return;
    state.visited += 1;
    if (hooks.enter && hooks.enter(target, parent) === false) {
      state.stopped = true;
      return;
    }
    childrenOf(target).forEach(function (child) { walk(child, hooks, state, target); });
    if (state.stopped) return;
    if (hooks.exit && hooks.exit(target, parent) === false) state.stopped = true;
  }

  function collect(target, predicate) {
    const found = [];

    visit(target, { enter: function (entry) {
      if (predicate(entry)) found.push(entry);
    } });
    return found;
  }

  /** The innermost node whose span contains the offset — the editor query. */
  function nodeAt(target, offset) {
    let best = null;

    visit(target, { enter: function (entry) {
      if (!entry.span) return;
      if (entry.span.start > offset || entry.span.end < offset) return;
      if (best === null || spanWidth(entry.span) <= spanWidth(best.span)) best = entry;
    } });
    return best;
  }

  function spanWidth(span) { return span.end - span.start; }

  function countNodes(target) { return visit(target, {}).visited; }

  function depth(target) {
    const kids = childrenOf(target);

    if (kids.length === 0) return 1;
    return 1 + Math.max.apply(null, kids.map(depth));
  }

  /* ------------------------------------------------------- pretty printing */

  /**
   * Print with the fewest parentheses the parser needs. The rule is one line:
   * a child needs brackets when its own binding power is lower than the power
   * required at the position it sits in. Getting it from the same table the
   * parser uses is what makes the round-trip hold.
   */
  function print(target, options) {
    const settings = Object.assign({ indent: '  ' }, options || {});

    return printNode(target, { power: 0, indent: '', settings: settings });
  }

  const PRINTERS = {
    program: function (target, context) {
      return target.items.map(function (item) {
        return printNode(item, context);
      }).join('\n');
    },
    letDecl: function (target, context) {
      return context.indent + 'let ' + target.name
        + (target.annotation ? ': ' + printType(target.annotation) : '')
        + ' = ' + printAt(target.value, 0, context) + ';';
    },
    fnDecl: function (target, context) {
      return context.indent + 'fn ' + target.name + '(' + printParams(target.params) + ') '
        + printNode(target.body, context);
    },
    importDecl: function (target, context) {
      return context.indent + 'import ' + target.name + ';';
    },
    block: function (target, context) { return printBlock(target, context); },
    exprStmt: function (target, context) {
      return context.indent + printAt(target.expr, 0, context) + ';';
    },
    assign: function (target, context) {
      return context.indent + printAt(target.target, 0, context) + ' = '
        + printAt(target.value, 0, context) + ';';
    },
    whileStmt: function (target, context) {
      return context.indent + 'while ' + printAt(target.test, 0, context) + ' '
        + printNode(target.body, context);
    },
    forStmt: function (target, context) {
      return context.indent + 'for ' + target.name + ' in '
        + printAt(target.iterable, 0, context) + ' ' + printNode(target.body, context);
    },
    returnStmt: function (target, context) {
      return context.indent + 'return'
        + (target.value ? ' ' + printAt(target.value, 0, context) : '') + ';';
    },
    breakStmt: function (target, context) { return context.indent + 'break;'; },
    continueStmt: function (target, context) { return context.indent + 'continue;'; },
    num: function (target) { return String(target.value); },
    str: function (target) { return JSON.stringify(target.value); },
    bool: function (target) { return target.value ? 'true' : 'false'; },
    unit: function () { return 'unit'; },
    name: function (target) { return target.name; },
    error: function (target) { return '/*' + (target.why || 'error') + '*/'; },
    unary: function (target, context) {
      return target.op + printAt(target.operand, UNARY_POWER, context);
    },
    binary: function (target, context) { return printBinary(target, context); },
    call: function (target, context) {
      return printAt(target.callee, POSTFIX_POWER, context) + '('
        + target.args.map(function (arg) {
          return printAt(arg, 0, context);
        }).join(', ') + ')';
    },
    field: function (target, context) {
      return printAt(target.object, POSTFIX_POWER, context) + '.' + target.name;
    },
    index: function (target, context) {
      return printAt(target.object, POSTFIX_POWER, context) + '['
        + printAt(target.key, 0, context) + ']';
    },
    array: function (target, context) {
      return '[' + target.items.map(function (item) {
        return printAt(item, 0, context);
      }).join(', ') + ']';
    },
    record: function (target, context) {
      return '{' + (target.fields.length ? ' ' + target.fields.map(function (entry) {
        return entry.name + ': ' + printAt(entry.value, 0, context);
      }).join(', ') + ' ' : '') + '}';
    },
    lambda: function (target, context) {
      return 'fn(' + printParams(target.params) + ') => ' + printAt(target.body, 0, context);
    },
    ifExpr: function (target, context) {
      return 'if ' + printAt(target.test, 0, context) + ' ' + printNode(target.then, context)
        + ' else ' + printNode(target.other, context);
    },
    matchExpr: function (target, context) { return printMatch(target, context); }
  };

  function printNode(target, context) {
    const printer = PRINTERS[target.kind];

    if (!printer) return '/*' + target.kind + '*/';
    return printer(target, context);
  }

  /** Print a child, bracketing it only when the position demands more power. */
  function printAt(target, required, context) {
    const text = printNode(target, Object.assign({}, context, { power: required }));

    return powerOf(target) < required ? '(' + text + ')' : text;
  }

  function powerOf(target) {
    if (target.kind === 'binary') return PRECEDENCE[target.op].left;
    if (target.kind === 'unary') return UNARY_POWER;
    if (target.kind === 'lambda' || target.kind === 'ifExpr' || target.kind === 'matchExpr') {
      return 0;
    }
    return POSTFIX_POWER + 1;
  }

  /**
   * `noRightParens` is a deliberate defect, and it is here rather than in the
   * test so that both printers walk exactly the same code. It drops the power
   * requirement on the right operand, which makes `1 - (2 - 3)` print as
   * `1 - 2 - 3` — a different program. The fuzzer prints the same generated
   * corpus twice, once with each, and reports how many programs the broken one
   * loses. A round-trip suite that cannot separate these two is measuring the
   * generator rather than the printer.
   */
  function printBinary(target, context) {
    const powers = PRECEDENCE[target.op];
    const right = context.settings.noRightParens ? 0 : powers.right;

    return printAt(target.left, powers.left, context) + ' ' + target.op + ' '
      + printAt(target.right, right, context);
  }

  /**
   * A block's last expression may have no semicolon, in which case it is the
   * block's VALUE rather than a statement. That is what lets `if` be an
   * expression, and the printer has to know it: printing the tail with a
   * semicolon would turn a block that produces a number into one that produces
   * unit, so the round-trip would silently change the program rather than fail.
   */
  function printBlock(target, context) {
    if (target.statements.length === 0 && !target.tail) return '{}';
    const inner = Object.assign({}, context,
      { indent: context.indent + context.settings.indent });
    const lines = target.statements.map(function (statement) {
      return printStatement(statement, inner);
    });

    if (target.tail) lines.push(inner.indent + printAt(target.tail, 0, inner));
    return '{\n' + lines.join('\n') + '\n' + context.indent + '}';
  }

  /**
   * A statement's printer supplies its own indent, except a bare block — which
   * is printed the same way in expression position, where an indent would be
   * wrong. Desugaring produces bare blocks (a `for` loop becomes one), so
   * without this the lowered output is unreadable and the round-trip on it
   * fails for a purely cosmetic reason.
   */
  function printStatement(target, context) {
    const text = printNode(target, context);

    return target.kind === 'block' ? context.indent + text : text;
  }

  function printMatch(target, context) {
    const inner = Object.assign({}, context,
      { indent: context.indent + context.settings.indent });

    return 'match ' + printAt(target.subject, 0, context) + ' {\n'
      + target.arms.map(function (arm) {
        return inner.indent + printPattern(arm.pattern)
          + (arm.guard ? ' if ' + printAt(arm.guard, 0, inner) : '')
          + ' => ' + printAt(arm.body, 0, inner) + ',';
      }).join('\n') + '\n' + context.indent + '}';
  }

  function printParams(params) {
    return params.map(function (entry) {
      return entry.name + (entry.annotation ? ': ' + printType(entry.annotation) : '');
    }).join(', ');
  }

  /* Same reason as printType below: a pattern the parser could not complete
     has no `args`, and this printer sits on the diagnostics and fingerprint
     paths. `match =;` - eight characters from the fuzzer in 32.10 - reached
     it. */
  function printPattern(pattern) {
    if (!pattern || !pattern.kind) return '?';
    if (pattern.kind === 'patternWild') return '_';
    if (pattern.kind === 'patternName') return pattern.name || '?';
    if (pattern.kind === 'patternLiteral') return JSON.stringify(pattern.value);
    if (pattern.kind === 'patternRecord') {
      return '{ ' + (pattern.fields || []).map(function (entry) {
        return entry.name + ': ' + printPattern(entry.pattern);
      }).join(', ') + ' }';
    }
    if (!pattern.args || pattern.args.length === 0) return pattern.name || '?';
    return pattern.name + '(' + pattern.args.map(printPattern).join(', ') + ')';
  }

  /* Error recovery produces type nodes with missing children - `let:` gives a
     typeArrow whose `from` is undefined - and this printer is on the path of
     both the diagnostics and the pipeline fingerprint. Printing `?` for a node
     the parser could not complete keeps those paths total; throwing here made
     a malformed four-character input crash the purity check, which the fuzzer
     in 32.10 found and reported as an oracle failure. */
  function printType(type) {
    if (!type || !type.kind) return '?';
    if (type.kind === 'typeName') return type.name || '?';
    if (type.kind === 'typeArray') return '[' + printType(type.item) + ']';
    if (type.kind === 'typeRecord') {
      return '{ ' + type.fields.map(function (entry) {
        return entry.name + ': ' + printType(entry.type);
      }).join(', ') + ' }';
    }
    if (type.kind !== 'typeArrow') return type.kind;
    if (!type.from || !type.to) return '?';
    const from = type.from.kind === 'typeArrow'
      ? '(' + printType(type.from) + ')' : printType(type.from);

    return from + ' -> ' + printType(type.to);
  }

  /* ------------------------------------------------------------ comparing */

  /**
   * Structural equality ignoring spans. The round-trip property is stated in
   * terms of this: parse, print, reparse, and the two trees must be equal even
   * though every span moved.
   */
  function equalIgnoringSpans(left, right) {
    return JSON.stringify(strip(left)) === JSON.stringify(strip(right));
  }

  function strip(target) {
    if (Array.isArray(target)) return target.map(strip);
    if (!target || typeof target !== 'object') return target;
    const out = {};

    Object.keys(target).sort().forEach(function (key) {
      if (key === 'span' || key === 'origin' || key === 'trivia') return;
      out[key] = strip(target[key]);
    });
    return out;
  }

  /** Where the two trees first differ, for a failure a reader can act on. */
  function firstDifference(left, right, path) {
    const here = path || 'root';

    if (JSON.stringify(strip(left)) === JSON.stringify(strip(right))) return null;
    if (!left || !right || left.kind !== right.kind) {
      return { path: here, left: describe(left), right: describe(right) };
    }
    return differenceInChildren(left, right, here);
  }

  function differenceInChildren(left, right, here) {
    const kids = childrenOf(left);
    const others = childrenOf(right);

    for (let i = 0; i < Math.max(kids.length, others.length); i += 1) {
      const inner = firstDifference(kids[i], others[i], here + ' > ' + left.kind + '[' + i + ']');

      if (inner) return inner;
    }
    return { path: here, left: describe(left), right: describe(right) };
  }

  function describe(target) {
    if (!target) return 'nothing';
    return target.kind + (target.name ? ' ' + target.name : '')
      + (target.op ? ' ' + target.op : '')
      + (target.value !== undefined ? ' ' + JSON.stringify(target.value) : '');
  }

  return {
    PRECEDENCE: PRECEDENCE, UNARY_POWER: UNARY_POWER, POSTFIX_POWER: POSTFIX_POWER,
    CHILDREN: CHILDREN, KINDS: KINDS,
    node: node, synthetic: synthetic, childrenOf: childrenOf,
    visit: visit, collect: collect, nodeAt: nodeAt, countNodes: countNodes, depth: depth,
    print: print, printPattern: printPattern, printType: printType,
    equalIgnoringSpans: equalIgnoringSpans, firstDifference: firstDifference,
    describe: describe, powerOf: powerOf
  };
}));
