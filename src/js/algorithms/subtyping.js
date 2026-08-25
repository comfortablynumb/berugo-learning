/**
 * Subtyping and variance: when one type may stand in for another.
 *
 * The rule that surprises people is the one for functions. A function is a
 * subtype of another when it *accepts more* and *returns less* — contravariant
 * in the argument, covariant in the result. It follows from substitutability:
 * anywhere the caller may pass a `Circle`, a function declared over `Shape`
 * still copes, so `Shape → Circle` is safely usable as `Circle → Shape`.
 *
 * Variance is the same rule lifted to a type constructor. Read-only positions
 * are covariant, write-only positions contravariant, and anything readable
 * *and* writable is invariant — which is why a mutable cell can never be
 * covariant, and why Java's covariant arrays are a hole the language has to
 * plug with a runtime check. This module derives subtyping judgements, and it
 * finds the witnesses for the unsound rules rather than asserting they exist.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Subtyping = api;
}(this, function () {
  'use strict';

  /* -------------------------------------------------------------- types */

  function prim(name) { return { kind: 'prim', name: name }; }
  function record(fields) { return { kind: 'record', fields: fields }; }
  function arrow(from, to) { return { kind: 'arrow', from: from, to: to }; }
  function generic(name, args) { return { kind: 'generic', name: name, args: args }; }

  const TOP = { kind: 'top', name: '⊤' };
  const BOTTOM = { kind: 'bottom', name: '⊥' };

  /** The primitive hierarchy the demo works over, declared once. */
  const PRIMITIVES = {
    Integer: ['Number'], Double: ['Number'], Number: ['Value'],
    String: ['Value'], Boolean: ['Value'], Value: []
  };

  /** How each constructor's parameters behave, which is the whole lesson. */
  const VARIANCE = {
    List: ['covariant'], ReadOnlyList: ['covariant'],
    Sink: ['contravariant'], Ref: ['invariant'], Array: ['invariant'],
    CovariantArray: ['covariant'], Map: ['invariant', 'covariant']
  };

  function showType(type, inner) {
    if (type.kind === 'prim' || type.kind === 'top' || type.kind === 'bottom') return type.name;
    if (type.kind === 'generic') {
      return type.name + '<' + type.args.map(function (arg) {
        return showType(arg, false);
      }).join(', ') + '>';
    }
    if (type.kind === 'record') {
      return '{' + Object.keys(type.fields).map(function (name) {
        return name + ': ' + showType(type.fields[name], false);
      }).join(', ') + '}';
    }
    const text = showType(type.from, true) + ' → ' + showType(type.to, false);

    return inner ? '(' + text + ')' : text;
  }

  /* --------------------------------------------------------- the relation */

  /**
   * `isSubtype(a, b)` builds a derivation. Every node names the rule it used
   * and, on failure, the exact pair that could not be related — because "type
   * error" without the pair is the difference between a usable compiler and an
   * unusable one.
   */
  function isSubtype(left, right, options) {
    const settings = options || {};
    const node = { left: showType(left, false), right: showType(right, false),
      children: [], rule: '', ok: false, why: '' };

    if (right.kind === 'top') return finish(node, 'S-Top', true, '');
    if (left.kind === 'bottom') return finish(node, 'S-Bottom', true, '');
    if (sameShape(left, right) && showType(left, false) === showType(right, false)) {
      return finish(node, 'S-Refl', true, '');
    }
    return byShape(left, right, node, settings);
  }

  function sameShape(left, right) { return left.kind === right.kind; }

  function finish(node, rule, ok, why) {
    node.rule = rule;
    node.ok = ok;
    node.why = why;
    return node;
  }

  function byShape(left, right, node, settings) {
    if (left.kind === 'prim' && right.kind === 'prim') {
      return primitiveStep(left, right, node);
    }
    if (left.kind === 'record' && right.kind === 'record') {
      return recordStep(left, right, node, settings);
    }
    if (left.kind === 'arrow' && right.kind === 'arrow') {
      return arrowStep(left, right, node, settings);
    }
    if (left.kind === 'generic' && right.kind === 'generic') {
      return genericStep(left, right, node, settings);
    }
    return finish(node, 'S-None', false,
      showType(left, false) + ' and ' + showType(right, false) + ' have different shapes');
  }

  /** Reflexive-transitive closure of the declared hierarchy. */
  function primitiveStep(left, right, node) {
    const chain = pathBetween(left.name, right.name);

    if (chain === null) {
      return finish(node, 'S-Prim', false,
        left.name + ' is not declared below ' + right.name);
    }
    node.chain = chain;
    return finish(node, chain.length === 1 ? 'S-Refl' : 'S-Trans', true, '');
  }

  function pathBetween(from, to) {
    if (from === to) return [from];
    const parents = PRIMITIVES[from] || [];

    for (let i = 0; i < parents.length; i += 1) {
      const rest = pathBetween(parents[i], to);

      if (rest !== null) return [from].concat(rest);
    }
    return null;
  }

  /**
   * Width (more fields is a subtype), depth (each field is a subtype) and
   * permutation (order does not matter) all fall out of one rule: every field
   * the supertype names must be present and a subtype.
   */
  function recordStep(left, right, node, settings) {
    const names = Object.keys(right.fields);
    const missing = names.filter(function (name) {
      return left.fields[name] === undefined;
    });

    if (missing.length > 0) {
      return finish(node, 'S-RcdWidth', false,
        'missing field' + (missing.length > 1 ? 's ' : ' ') + missing.join(', '));
    }
    return recordDepth(left, right, names, node, settings);
  }

  function recordDepth(left, right, names, node, settings) {
    for (let i = 0; i < names.length; i += 1) {
      const child = isSubtype(left.fields[names[i]], right.fields[names[i]], settings);

      child.label = 'field ' + names[i];
      node.children.push(child);
      if (!child.ok) {
        return finish(node, 'S-RcdDepth', false, 'field ' + names[i] + ': ' + child.why);
      }
    }
    return finish(node, node.children.length === 0 ? 'S-RcdWidth' : 'S-RcdDepth', true, '');
  }

  /** Contravariant in the argument, covariant in the result. */
  function arrowStep(left, right, node, settings) {
    const argument = isSubtype(right.from, left.from, settings);
    const result = isSubtype(left.to, right.to, settings);

    argument.label = 'argument (flipped)';
    result.label = 'result';
    node.children.push(argument, result);
    if (!argument.ok) {
      return finish(node, 'S-Arrow', false,
        'the argument goes the other way: needs ' + showType(right.from, false)
          + ' ≤ ' + showType(left.from, false) + ', but ' + argument.why);
    }
    if (!result.ok) return finish(node, 'S-Arrow', false, 'result: ' + result.why);
    return finish(node, 'S-Arrow', true, '');
  }

  function genericStep(left, right, node, settings) {
    if (left.name !== right.name || left.args.length !== right.args.length) {
      return finish(node, 'S-Generic', false,
        left.name + ' and ' + right.name + ' are different constructors');
    }
    return genericArguments(left, right, node, settings);
  }

  function genericArguments(left, right, node, settings) {
    const variances = VARIANCE[left.name] || left.args.map(function () { return 'invariant'; });

    for (let i = 0; i < left.args.length; i += 1) {
      const child = checkParameter(left.args[i], right.args[i], variances[i], settings);

      child.label = 'parameter ' + (i + 1) + ' (' + variances[i] + ')';
      node.children.push(child);
      if (!child.ok) {
        return finish(node, 'S-Generic', false,
          left.name + ' is ' + variances[i] + ' in parameter ' + (i + 1) + ': ' + child.why);
      }
    }
    return finish(node, 'S-Generic', true, '');
  }

  function checkParameter(left, right, variance, settings) {
    if (variance === 'covariant') return isSubtype(left, right, settings);
    if (variance === 'contravariant') return isSubtype(right, left, settings);
    return invariantStep(left, right, settings);
  }

  function invariantStep(left, right, settings) {
    const forward = isSubtype(left, right, settings);
    const back = isSubtype(right, left, settings);
    const ok = forward.ok && back.ok;

    return { left: showType(left, false), right: showType(right, false),
      rule: 'S-Invariant', ok: ok, children: [forward, back],
      why: ok ? '' : 'invariant, so the two must be the same type' };
  }

  /* ------------------------------------------------------- join and meet */

  /**
   * The least common supertype. A language needs it wherever two branches of a
   * conditional must agree, and where no join exists the compiler must either
   * widen to ⊤ or reject.
   */
  function join(left, right) {
    if (isSubtype(left, right).ok) return right;
    if (isSubtype(right, left).ok) return left;
    if (left.kind === 'record' && right.kind === 'record') return joinRecords(left, right);
    if (left.kind === 'prim' && right.kind === 'prim') return joinPrimitives(left, right);
    return TOP;
  }

  function joinRecords(left, right) {
    const fields = {};

    Object.keys(left.fields).forEach(function (name) {
      if (right.fields[name] === undefined) return;
      fields[name] = join(left.fields[name], right.fields[name]);
    });
    return record(fields);
  }

  function joinPrimitives(left, right) {
    const chain = ancestors(left.name);
    const other = ancestors(right.name);
    const shared = chain.filter(function (name) { return other.indexOf(name) !== -1; });

    return shared.length === 0 ? TOP : prim(shared[0]);
  }

  function ancestors(name) {
    const seen = [name];
    let frontier = [name];

    while (frontier.length > 0) {
      const next = [];

      frontier.forEach(function (current) {
        (PRIMITIVES[current] || []).forEach(function (parent) {
          if (seen.indexOf(parent) !== -1) return;
          seen.push(parent);
          next.push(parent);
        });
      });
      frontier = next;
    }
    return seen;
  }

  /** The greatest common subtype: for records, every field of either. */
  function meet(left, right) {
    if (isSubtype(left, right).ok) return left;
    if (isSubtype(right, left).ok) return right;
    if (left.kind === 'record' && right.kind === 'record') return meetRecords(left, right);
    return BOTTOM;
  }

  function meetRecords(left, right) {
    const fields = Object.assign({}, left.fields);
    let sound = true;

    Object.keys(right.fields).forEach(function (name) {
      if (fields[name] === undefined) {
        fields[name] = right.fields[name];
        return;
      }
      const inner = meet(fields[name], right.fields[name]);

      if (inner.kind === 'bottom') sound = false;
      fields[name] = inner;
    });
    return sound ? record(fields) : BOTTOM;
  }

  /* ------------------------------------------------- the unsoundness hunt */

  /**
   * Covariant mutable containers are unsound, and this finds the witness
   * rather than quoting the rule. For each pair the covariant rule admits, it
   * asks: is there a value the *supertype* accepts that the underlying
   * container cannot hold? If yes, that assignment is a store that must fail
   * at runtime — which is exactly `ArrayStoreException`.
   */
  function unsoundWitnesses() {
    const elements = ['Integer', 'Double', 'Number', 'String'].map(prim);
    const found = [];

    elements.forEach(function (narrow) {
      elements.forEach(function (wide) {
        const witness = witnessFor(narrow, wide, elements);

        if (witness) found.push(witness);
      });
    });
    return found;
  }

  function witnessFor(narrow, wide, elements) {
    if (showType(narrow, false) === showType(wide, false)) return null;
    if (!isSubtype(generic('CovariantArray', [narrow]),
      generic('CovariantArray', [wide])).ok) return null;
    const bad = elements.filter(function (candidate) {
      return isSubtype(candidate, wide).ok && !isSubtype(candidate, narrow).ok;
    });

    if (bad.length === 0) return null;
    return { narrow: narrow.name, wide: wide.name, stored: bad[0].name,
      allowed: 'CovariantArray<' + narrow.name + '> ≤ CovariantArray<' + wide.name + '>',
      breaks: 'writing a ' + bad[0].name + ' through the ' + wide.name
        + ' view puts it in an array of ' + narrow.name,
      invariantRejects: !isSubtype(generic('Array', [narrow]),
        generic('Array', [wide])).ok };
  }

  /** The same containers under the right variance, to show what it costs. */
  function varianceTable() {
    const pairs = [['List', 'covariant'], ['Sink', 'contravariant'],
      ['Ref', 'invariant'], ['CovariantArray', 'covariant'], ['Array', 'invariant']];

    return pairs.map(function (pair) {
      const up = isSubtype(generic(pair[0], [prim('Integer')]),
        generic(pair[0], [prim('Number')]));
      const down = isSubtype(generic(pair[0], [prim('Number')]),
        generic(pair[0], [prim('Integer')]));

      return { name: pair[0], variance: pair[1],
        widening: up.ok, narrowing: down.ok,
        reads: pair[1] === 'contravariant' ? 'write only' : 'read',
        sound: pair[0] !== 'CovariantArray' };
    });
  }

  return {
    prim: prim, record: record, arrow: arrow, generic: generic, TOP: TOP, BOTTOM: BOTTOM,
    PRIMITIVES: PRIMITIVES, VARIANCE: VARIANCE,
    showType: showType, isSubtype: isSubtype, join: join, meet: meet,
    ancestors: ancestors, unsoundWitnesses: unsoundWitnesses, varianceTable: varianceTable
  };
}));
