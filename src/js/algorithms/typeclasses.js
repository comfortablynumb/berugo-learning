/**
 * Type classes as dictionary passing: how ad-hoc polymorphism compiles.
 *
 * A constraint `Eq a =>` is not magic. It is an extra argument: the compiler
 * finds, at every call site, a record of method implementations for the type
 * that turned up, and passes it. `Eq a => Eq [a]` becomes a *function* from a
 * dictionary to a dictionary, so resolving `Eq [[Int]]` builds a two-level
 * structure at compile time and the runtime cost is a record field lookup.
 *
 * Three things go wrong in practice, and all three are visible here. Overlap:
 * two instances match and the choice is not forced, so the program's meaning
 * depends on which one the compiler picked — this is why coherence is a rule
 * and not an optimisation. Ambiguity: a type variable appears in the
 * constraints but not in the type, so no call site can ever determine it.
 * Orphans: an instance defined where neither the class nor the type lives,
 * which is what lets two libraries disagree about the same instance.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.TypeClasses = api;
}(this, function () {
  'use strict';

  /* ------------------------------------------------------------- classes */

  const CLASSES = {
    Eq: { methods: ['equals'], superclasses: [], note: 'equality' },
    Ord: { methods: ['compare'], superclasses: ['Eq'],
      note: 'ordering, which presupposes equality' },
    Show: { methods: ['show'], superclasses: [], note: 'rendering to text' },
    Num: { methods: ['add', 'zero'], superclasses: ['Eq'], note: 'arithmetic' },
    Read: { methods: ['read'], superclasses: [], note: 'parsing from text' }
  };

  /**
   * An instance head is a class plus a type shape; its context is the list of
   * constraints that must hold first. `Eq a => Eq [a]` is `{ className: 'Eq',
   * head: 'List a', context: ['Eq a'] }` — a dictionary-valued function.
   */
  const INSTANCES = [
    { className: 'Eq', head: 'Int', context: [], home: 'base' },
    { className: 'Eq', head: 'Bool', context: [], home: 'base' },
    { className: 'Eq', head: 'String', context: [], home: 'base' },
    { className: 'Eq', head: 'List a', context: ['Eq a'], home: 'base' },
    { className: 'Eq', head: 'Pair a b', context: ['Eq a', 'Eq b'], home: 'base' },
    { className: 'Ord', head: 'Int', context: [], home: 'base' },
    { className: 'Ord', head: 'String', context: [], home: 'base' },
    { className: 'Ord', head: 'List a', context: ['Ord a'], home: 'base' },
    { className: 'Show', head: 'Int', context: [], home: 'base' },
    { className: 'Show', head: 'Bool', context: [], home: 'base' },
    { className: 'Show', head: 'String', context: [], home: 'base' },
    { className: 'Show', head: 'List a', context: ['Show a'], home: 'base' },
    { className: 'Show', head: 'Pair a b', context: ['Show a', 'Show b'], home: 'base' },
    { className: 'Num', head: 'Int', context: [], home: 'base' },
    { className: 'Read', head: 'Int', context: [], home: 'base' }
  ];

  /** Instances that overlap or are orphaned, switched on by the demo. */
  const RISKY = [
    { className: 'Show', head: 'List Int', context: [], home: 'pretty',
      risk: 'overlaps Show (List a)' },
    { className: 'Eq', head: 'List Bool', context: [], home: 'app',
      risk: 'overlaps Eq (List a) and lives in neither home' }
  ];

  /* ------------------------------------------------------ type matching */

  function parseType(text) {
    const tokens = String(text).match(/[A-Za-z][A-Za-z0-9]*|[()]/g) || [];
    const state = { tokens: tokens, at: 0 };
    const type = parseApplication(state);

    if (state.at < tokens.length) throw new Error('unexpected type token');
    return type;
  }

  function parseApplication(state) {
    const head = parseAtom(state);
    const args = [];

    while (state.tokens[state.at] !== undefined && state.tokens[state.at] !== ')') {
      args.push(parseAtom(state));
    }
    if (args.length === 0) return head;
    return { name: head.name, args: args, variable: false };
  }

  function parseAtom(state) {
    const token = state.tokens[state.at];

    state.at += 1;
    if (token === '(') {
      const inner = parseApplication(state);

      state.at += 1;
      return inner;
    }
    return { name: token, args: [], variable: /^[a-z]/.test(token) };
  }

  function showType(type) {
    if (type.args.length === 0) return type.name;
    return type.name + ' ' + type.args.map(function (arg) {
      return arg.args.length === 0 ? showType(arg) : '(' + showType(arg) + ')';
    }).join(' ');
  }

  /** One-way matching: the instance head may have variables, the goal may not. */
  function match(head, goal, bindings) {
    const bound = bindings || {};

    if (head.variable) {
      if (bound[head.name] !== undefined) {
        return showType(bound[head.name]) === showType(goal) ? bound : null;
      }
      bound[head.name] = goal;
      return bound;
    }
    if (head.name !== goal.name || head.args.length !== goal.args.length) return null;
    return matchArguments(head, goal, bound);
  }

  function matchArguments(head, goal, bound) {
    let current = bound;

    for (let i = 0; i < head.args.length; i += 1) {
      current = match(head.args[i], goal.args[i], current);
      if (current === null) return null;
    }
    return current;
  }

  function substitute(type, bindings) {
    if (type.variable) return bindings[type.name] === undefined ? type : bindings[type.name];
    return { name: type.name, variable: false,
      args: type.args.map(function (arg) { return substitute(arg, bindings); }) };
  }

  /* --------------------------------------------------------- resolution */

  function parseConstraint(text) {
    const parts = String(text).trim().split(/\s+/);

    return { className: parts[0], type: parseType(parts.slice(1).join(' ')) };
  }

  function showConstraint(constraint) {
    const text = showType(constraint.type);

    return constraint.className + ' '
      + (constraint.type.args.length === 0 ? text : '(' + text + ')');
  }

  /**
   * Resolve a constraint into a dictionary expression. Returns the tree, the
   * instances it used, and — when it fails — which sub-goal had no instance,
   * which is the message a compiler prints.
   */
  function resolve(constraint, options) {
    const settings = options || {};
    const pool = INSTANCES.concat(settings.risky ? RISKY : []);

    return solve(parseConstraint(showConstraint(constraint)), pool, settings, 0);
  }

  function solve(goal, pool, settings, depth) {
    const node = { goal: showConstraint(goal), children: [], depth: depth };

    if (depth > 12) {
      return Object.assign(node, { ok: false, why: 'resolution did not terminate' });
    }
    if (goal.type.variable) {
      return Object.assign(node, { ok: false, ambiguous: true,
        why: showConstraint(goal) + ' has a type variable no call site can fix' });
    }
    return solveWith(goal, pool, settings, node);
  }

  function solveWith(goal, pool, settings, node) {
    const candidates = pool.filter(function (instance) {
      return instance.className === goal.className
        && match(parseType(instance.head), goal.type, {}) !== null;
    });

    if (candidates.length === 0) {
      return Object.assign(node, { ok: false,
        why: 'no instance for ' + showConstraint(goal) });
    }
    node.candidates = candidates.length;
    node.overlapping = candidates.length > 1;
    if (candidates.length > 1 && !settings.allowOverlap) {
      return Object.assign(node, { ok: false, overlap: true,
        why: candidates.length + ' instances match ' + showConstraint(goal) + ': '
          + candidates.map(function (c) { return c.className + ' (' + c.head + ')'; }).join(', ') });
    }
    return buildDictionary(goal, candidates, pool, settings, node);
  }

  function buildDictionary(goal, candidates, pool, settings, node) {
    const chosen = pickInstance(candidates);
    const bindings = match(parseType(chosen.head), goal.type, {});

    node.instance = chosen.className + ' (' + chosen.head + ')';
    node.home = chosen.home;
    const context = chosen.context.map(function (text) {
      const parsed = parseConstraint(text);

      return { className: parsed.className, type: substitute(parsed.type, bindings) };
    }).concat(settings.superclasses ? superclassGoals(goal) : []);

    return solveContext(context, pool, settings, node);
  }

  /** Most specific wins — which is exactly what makes overlap a choice. */
  function pickInstance(candidates) {
    return candidates.slice().sort(function (left, right) {
      return specificity(right.head) - specificity(left.head);
    })[0];
  }

  function specificity(head) {
    return (head.match(/[A-Z][A-Za-z0-9]*/g) || []).length;
  }

  function superclassGoals(goal) {
    return (CLASSES[goal.className] || { superclasses: [] }).superclasses
      .map(function (name) { return { className: name, type: goal.type }; });
  }

  function solveContext(context, pool, settings, node) {
    for (let i = 0; i < context.length; i += 1) {
      const child = solve(context[i], pool, settings, node.depth + 1);

      node.children.push(child);
      if (!child.ok) {
        return Object.assign(node, { ok: false, why: child.why,
          overlap: child.overlap, ambiguous: child.ambiguous });
      }
    }
    return Object.assign(node, { ok: true, why: '' });
  }

  /* ------------------------------------------------------- what it built */

  /** The dictionary expression, the way a compiler would emit it. */
  function dictionaryText(node) {
    if (!node.ok) return '⊥';
    const name = 'd' + node.instance.replace(/[^A-Za-z]/g, '');

    if (node.children.length === 0) return name;
    return name + '(' + node.children.map(dictionaryText).join(', ') + ')';
  }

  function countDictionaries(node) {
    return node.children.reduce(function (total, child) {
      return total + countDictionaries(child);
    }, node.ok ? 1 : 0);
  }

  function depthOf(node) {
    return 1 + node.children.reduce(function (best, child) {
      return Math.max(best, depthOf(child));
    }, 0);
  }

  function methodsOf(className) {
    const own = (CLASSES[className] || { methods: [] }).methods;

    return (CLASSES[className] || { superclasses: [] }).superclasses
      .reduce(function (all, name) { return all.concat(methodsOf(name)); }, own.slice());
  }

  /** Resolve one constraint and report everything the demo prints. */
  function analyse(text, options) {
    const constraint = parseConstraint(text);
    const tree = resolve(constraint, options);

    return { constraint: text, ok: tree.ok, why: tree.why,
      overlap: Boolean(tree.overlap), ambiguous: Boolean(tree.ambiguous),
      dictionary: dictionaryText(tree), dictionaries: countDictionaries(tree),
      depth: depthOf(tree), tree: tree,
      methods: tree.ok ? methodsOf(constraint.className) : [] };
  }

  const GOALS = [
    { text: 'Eq Int', note: 'a ground instance, one dictionary' },
    { text: 'Eq (List Int)', note: 'one level of context' },
    { text: 'Eq (List (List Int))', note: 'two levels, built at compile time' },
    { text: 'Eq (Pair Int (List Bool))', note: 'two constraints in one context' },
    { text: 'Ord (List Int)', note: 'Ord needs Eq underneath it as a superclass' },
    { text: 'Show (Pair (List Int) Bool)', note: 'nested, four dictionaries' },
    { text: 'Eq (List Double)', note: 'no instance for the element type' },
    { text: 'Num (List Int)', note: 'no instance for the shape at all' },
    { text: 'Show a', note: 'ambiguous: nothing determines a' }
  ];

  function sweep(options) {
    return GOALS.map(function (goal) {
      return Object.assign({ note: goal.note }, analyse(goal.text, options));
    });
  }

  /**
   * The coherence demonstration: turn the risky instances on and the same goal
   * resolves to a different dictionary, so the *meaning* of the program moved.
   */
  function coherenceContrast() {
    const strict = analyse('Show (List Int)', { risky: true });
    const permissive = analyse('Show (List Int)', { risky: true, allowOverlap: true });
    const plain = analyse('Show (List Int)', {});

    return { plain: plain, strict: strict, permissive: permissive,
      differs: plain.dictionary !== permissive.dictionary,
      rejected: !strict.ok && strict.overlap };
  }

  return {
    CLASSES: CLASSES, INSTANCES: INSTANCES, RISKY: RISKY, GOALS: GOALS,
    parseType: parseType, showType: showType, match: match, substitute: substitute,
    parseConstraint: parseConstraint, showConstraint: showConstraint,
    resolve: resolve, analyse: analyse, sweep: sweep, dictionaryText: dictionaryText,
    countDictionaries: countDictionaries, depthOf: depthOf, methodsOf: methodsOf,
    coherenceContrast: coherenceContrast
  };
}));
