/**
 * Abstract interpretation over Berugo IR, and the two operators that make it
 * terminate and then make it useful again.
 *
 * The idea is one substitution. Run the program, but over a domain of
 * DESCRIPTIONS instead of values: instead of `x = 7` record `x is in [7, 7]`,
 * and instead of adding two numbers add two intervals. Every operation gets an
 * abstract counterpart, every merge point joins the descriptions arriving on
 * each edge, and the analysis is a fixpoint of that. What it computes is
 * necessarily an over-approximation — the abstraction throws information away
 * — which is why the answer is always "no value outside this set is possible"
 * and never "every value in this set happens".
 *
 * **Widening is where termination comes from and where precision goes to
 * die.** An interval lattice has infinite ascending chains — [0,0], [0,1],
 * [0,2] and so on — so a loop that increments a counter never reaches a
 * fixpoint. Widening jumps: if a bound moved, send it to infinity rather than
 * to the next value. That terminates in two steps and it also throws away the
 * loop bound the analysis existed to find.
 *
 * **Narrowing is the second pass that gets some of it back.** Once the
 * fixpoint is reached, re-apply the transfer functions WITHOUT widening: the
 * loop condition now constrains the infinite bound, and `x < n` pulls it back
 * to something finite. A tool's usefulness on loops is almost entirely a
 * function of these two operators, which is why they are stepped and labelled
 * in the demo rather than folded into one number.
 *
 * Three domains ship, because the point of the framework is that the domain is
 * a parameter: sign, parity and interval. They abstract the same programs to
 * different precision, and the one that is precise enough for your question is
 * the cheapest one that answers it.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AbstractInterp = api;
}(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';

  const Cfg = pick('Cfg', '../machines/berugo/cfg.js');

  function pick(name, file) {
    if (root && root.Berugo && root.Berugo[name]) return root.Berugo[name];
    return require(file);
  }

  const INF = Infinity;

  /* ------------------------------------------------------ the interval domain */

  const Interval = {
    name: 'interval',
    about: 'a lower and an upper bound per variable',
    bottom: function () { return null; },
    top: function () { return { lo: -INF, hi: INF }; },
    isBottom: function (value) { return value === null; },
    constant: function (n) { return { lo: n, hi: n }; },
    equal: function (a, b) {
      if (a === null || b === null) return a === b;
      return a.lo === b.lo && a.hi === b.hi;
    },
    show: function (value) {
      if (value === null) return '⊥';
      return '[' + bound(value.lo) + ', ' + bound(value.hi) + ']';
    },
    join: function (a, b) {
      if (a === null) return b;
      if (b === null) return a;
      return { lo: Math.min(a.lo, b.lo), hi: Math.max(a.hi, b.hi) };
    },
    meet: function (a, b) {
      if (a === null || b === null) return null;
      const lo = Math.max(a.lo, b.lo);
      const hi = Math.min(a.hi, b.hi);

      return lo > hi ? null : { lo: lo, hi: hi };
    },
    /* Widen: a bound that moved goes to infinity rather than to the next
       value. Two steps instead of an infinite chain, and the loop bound the
       analysis was looking for is the thing it discards. */
    widen: function (a, b) {
      if (a === null) return b;
      if (b === null) return a;
      return { lo: b.lo < a.lo ? -INF : a.lo, hi: b.hi > a.hi ? INF : a.hi };
    },
    /* Narrow: only an INFINITE bound may be replaced, and only by a finite
       one. Allowing any bound to move would re-open the ascending chain and
       the second pass would not terminate either. */
    narrow: function (a, b) {
      if (a === null || b === null) return null;
      return { lo: a.lo === -INF ? b.lo : a.lo, hi: a.hi === INF ? b.hi : a.hi };
    },
    add: function (a, b) { return lift(a, b, function () {
      return { lo: a.lo + b.lo, hi: a.hi + b.hi };
    }); },
    sub: function (a, b) { return lift(a, b, function () {
      return { lo: a.lo - b.hi, hi: a.hi - b.lo };
    }); },
    mul: function (a, b) { return lift(a, b, function () {
      const corners = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi]
        .map(function (value) { return Number.isNaN(value) ? 0 : value; });

      return { lo: Math.min.apply(null, corners), hi: Math.max.apply(null, corners) };
    }); },
    contains: function (value, n) {
      return value !== null && n >= value.lo && n <= value.hi;
    },
    /* Refine under `x < limit` and its relatives — this is what narrowing has
       to work with, and a domain that cannot express the refinement gains
       nothing from a second pass. */
    below: function (value, limit, strict) {
      if (value === null || limit === null) return value;
      const hi = strict ? limit.hi - 1 : limit.hi;

      return Interval.meet(value, { lo: -INF, hi: hi });
    },
    above: function (value, limit, strict) {
      if (value === null || limit === null) return value;
      const lo = strict ? limit.lo + 1 : limit.lo;

      return Interval.meet(value, { lo: lo, hi: INF });
    }
  };

  function lift(a, b, fn) {
    if (a === null || b === null) return null;
    return fn();
  }

  function bound(value) {
    if (value === INF) return '+∞';
    if (value === -INF) return '−∞';
    return String(value);
  }

  /* ---------------------------------------------------------- sign and parity */

  const SIGNS = ['⊥', '-', '0', '+', '⊤'];

  const Sign = {
    name: 'sign',
    about: 'negative, zero, positive, or unknown',
    bottom: function () { return '⊥'; },
    top: function () { return '⊤'; },
    isBottom: function (value) { return value === '⊥'; },
    constant: function (n) { return n < 0 ? '-' : (n > 0 ? '+' : '0'); },
    equal: function (a, b) { return a === b; },
    show: function (value) { return value; },
    join: function (a, b) {
      if (a === '⊥') return b;
      if (b === '⊥') return a;
      return a === b ? a : '⊤';
    },
    meet: function (a, b) {
      if (a === '⊤') return b;
      if (b === '⊤') return a;
      return a === b ? a : '⊥';
    },
    widen: function (a, b) { return Sign.join(a, b); },
    narrow: function (a, b) { return a === '⊤' ? b : a; },
    add: function (a, b) { return signAdd(a, b); },
    sub: function (a, b) { return signAdd(a, negateSign(b)); },
    mul: function (a, b) {
      if (a === '⊥' || b === '⊥') return '⊥';
      if (a === '0' || b === '0') return '0';
      if (a === '⊤' || b === '⊤') return '⊤';
      return a === b ? '+' : '-';
    },
    contains: function (value, n) {
      return value === '⊤' || value === Sign.constant(n);
    },
    below: function (value) { return value; },
    above: function (value) { return value; }
  };

  function negateSign(value) {
    if (value === '-') return '+';
    if (value === '+') return '-';
    return value;
  }

  function signAdd(a, b) {
    if (a === '⊥' || b === '⊥') return '⊥';
    if (a === '0') return b;
    if (b === '0') return a;
    if (a === '⊤' || b === '⊤') return '⊤';
    return a === b ? a : '⊤';
  }

  const Parity = {
    name: 'parity',
    about: 'even, odd, or unknown',
    bottom: function () { return '⊥'; },
    top: function () { return '⊤'; },
    isBottom: function (value) { return value === '⊥'; },
    constant: function (n) { return Math.abs(n % 2) === 1 ? 'odd' : 'even'; },
    equal: function (a, b) { return a === b; },
    show: function (value) { return value; },
    join: function (a, b) {
      if (a === '⊥') return b;
      if (b === '⊥') return a;
      return a === b ? a : '⊤';
    },
    meet: function (a, b) {
      if (a === '⊤') return b;
      if (b === '⊤') return a;
      return a === b ? a : '⊥';
    },
    widen: function (a, b) { return Parity.join(a, b); },
    narrow: function (a, b) { return a === '⊤' ? b : a; },
    add: function (a, b) { return parityAdd(a, b); },
    sub: function (a, b) { return parityAdd(a, b); },
    mul: function (a, b) {
      if (a === '⊥' || b === '⊥') return '⊥';
      if (a === 'even' || b === 'even') return 'even';
      if (a === '⊤' || b === '⊤') return '⊤';
      return 'odd';
    },
    contains: function (value, n) {
      return value === '⊤' || value === Parity.constant(n);
    },
    below: function (value) { return value; },
    above: function (value) { return value; }
  };

  function parityAdd(a, b) {
    if (a === '⊥' || b === '⊥') return '⊥';
    if (a === '⊤' || b === '⊤') return '⊤';
    return a === b ? 'even' : 'odd';
  }

  const DOMAINS = { interval: Interval, sign: Sign, parity: Parity };

  function domainFor(name) {
    return DOMAINS[name] || Interval;
  }

  /* --------------------------------------------------------- the fixpoint */

  /**
   * The abstract state at a program point: every local slot and every SSA
   * register mapped to a domain value. Registers are included because the
   * comparisons that guard a loop are computed into them, and refining a
   * branch means knowing which registers a condition was built from.
   */
  function emptyState() {
    return { slots: {}, regs: {}, compares: {}, loads: {} };
  }

  function readSlot(domain, state, slot) {
    return state.slots[slot] === undefined ? domain.top() : state.slots[slot];
  }

  function readReg(domain, state, name) {
    return state.regs[name] === undefined ? domain.top() : state.regs[name];
  }

  /**
   * `loads` travels with the state, and forgetting it is a silent precision
   * bug rather than a crash. A refinement discovered about a register has to
   * find its way back to the slot the register was loaded from; without the
   * map the narrowing pass runs, terminates, and changes nothing, which reads
   * exactly like a domain that cannot be narrowed.
   */
  function cloneState(state) {
    return { slots: Object.assign({}, state.slots), regs: Object.assign({}, state.regs),
      compares: Object.assign({}, state.compares),
      loads: Object.assign({}, state.loads || {}) };
  }

  function joinStates(domain, a, b) {
    if (!a) return b ? cloneState(b) : null;
    if (!b) return cloneState(a);
    const out = emptyState();

    Object.keys(a.slots).concat(Object.keys(b.slots)).forEach(function (slot) {
      out.slots[slot] = domain.join(readSlot(domain, a, slot), readSlot(domain, b, slot));
    });
    Object.keys(a.regs).concat(Object.keys(b.regs)).forEach(function (name) {
      out.regs[name] = domain.join(readReg(domain, a, name), readReg(domain, b, name));
    });
    out.compares = Object.assign({}, a.compares, b.compares);
    out.loads = Object.assign({}, a.loads || {}, b.loads || {});
    return out;
  }

  function combineStates(domain, a, b, operator) {
    if (!a) return b ? cloneState(b) : null;
    if (!b) return cloneState(a);
    const out = emptyState();

    Object.keys(a.slots).concat(Object.keys(b.slots)).forEach(function (slot) {
      out.slots[slot] = domain[operator](readSlot(domain, a, slot),
        readSlot(domain, b, slot));
    });
    Object.keys(a.regs).concat(Object.keys(b.regs)).forEach(function (name) {
      out.regs[name] = domain[operator](readReg(domain, a, name), readReg(domain, b, name));
    });
    out.compares = Object.assign({}, a.compares, b.compares);
    out.loads = Object.assign({}, a.loads || {}, b.loads || {});
    return out;
  }

  function sameState(domain, a, b) {
    if (!a || !b) return a === b;
    const keys = Object.keys(a.slots).concat(Object.keys(b.slots));

    return keys.every(function (slot) {
      return domain.equal(readSlot(domain, a, slot), readSlot(domain, b, slot));
    });
  }

  /* ------------------------------------------------------ transfer functions */

  const ARITH = { add: 'add', sub: 'sub', mul: 'mul' };
  const COMPARES = { lt: true, le: true, gt: true, ge: true, eq: true, ne: true };

  function transfer(domain, state, inst) {
    if (inst.op === 'const') {
      state.regs[inst.target] = typeof inst.value === 'number'
        ? domain.constant(inst.value) : domain.top();
      return state;
    }
    if (inst.op === 'loadLocal') {
      state.regs[inst.target] = readSlot(domain, state, inst.slot);
      return state;
    }
    if (inst.op === 'storeLocal') {
      state.slots[inst.slot] = readReg(domain, state, inst.value);
      return state;
    }
    if (inst.op === 'binary') return transferBinary(domain, state, inst);
    if (inst.target) state.regs[inst.target] = domain.top();
    return state;
  }

  function transferBinary(domain, state, inst) {
    const left = readReg(domain, state, inst.left);
    const right = readReg(domain, state, inst.right);

    if (ARITH[inst.operator]) {
      state.regs[inst.target] = domain[ARITH[inst.operator]](left, right);
      return state;
    }
    state.regs[inst.target] = domain.top();
    /* Remember what the comparison was ABOUT, not what it evaluated to. That
       record is the only thing that lets a branch refine the operands, and it
       is why a domain with no `below`/`above` gains nothing from narrowing. */
    if (COMPARES[inst.operator]) {
      state.compares[inst.target] = { operator: inst.operator,
        left: inst.left, right: inst.right };
    }
    return state;
  }

  /**
   * Refine the state along one edge out of a conditional branch. `x < n` on
   * the taken edge bounds x above by n and n below by x; on the other edge the
   * negation does the same the other way. Without this the narrowing pass has
   * nothing to narrow with and the loop bound stays at infinity.
   */
  function refine(domain, state, condition, taken) {
    if (!condition) return state;
    const out = cloneState(state);
    const left = readReg(domain, state, condition.left);
    const right = readReg(domain, state, condition.right);
    const operator = taken ? condition.operator : invert(condition.operator);

    if (operator === 'lt' || operator === 'le') {
      out.regs[condition.left] = domain.below(left, right, operator === 'lt');
      out.regs[condition.right] = domain.above(right, left, operator === 'lt');
    }
    if (operator === 'gt' || operator === 'ge') {
      out.regs[condition.left] = domain.above(left, right, operator === 'gt');
      out.regs[condition.right] = domain.below(right, left, operator === 'gt');
    }
    return propagateToSlots(domain, out, state);
  }

  function invert(operator) {
    return { lt: 'ge', le: 'gt', gt: 'le', ge: 'lt', eq: 'ne', ne: 'eq' }[operator];
  }

  /**
   * A refinement discovered about a register has to reach the slot it was
   * loaded from, or the next iteration reads the unrefined value straight back
   * out of the slot and the narrowing is undone before it is used.
   */
  function propagateToSlots(domain, refined, before) {
    Object.keys(refined.regs).forEach(function (name) {
      const source = refined.loads && refined.loads[name];

      if (!source) return;
      refined.slots[source] = domain.meet(readSlot(domain, refined, source),
        refined.regs[name]);
    });
    return refined;
  }

  function recordLoads(state, block) {
    state.loads = Object.assign({}, state.loads || {});
    block.instructions.forEach(function (inst) {
      if (inst.op === 'loadLocal') state.loads[inst.target] = inst.slot;
    });
    return state;
  }

  return { INF: INF, SIGNS: SIGNS, DOMAINS: DOMAINS, domainFor: domainFor,
    Interval: Interval, Sign: Sign, Parity: Parity, bound: bound, Cfg: Cfg,
    emptyState: emptyState, readSlot: readSlot, readReg: readReg,
    cloneState: cloneState, joinStates: joinStates, combineStates: combineStates,
    sameState: sameState, transfer: transfer, refine: refine, invert: invert,
    recordLoads: recordLoads };
}));
