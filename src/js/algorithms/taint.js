/**
 * Taint analysis over Berugo IR: sources, sinks and sanitisers.
 *
 * This is the highest-value static analysis in application security, and the
 * reason is not that it is clever. It is that the model is small enough to be
 * SOUND IN PRACTICE for a fixed framework: name the functions that produce
 * untrusted data, name the ones that must not receive it, name the ones that
 * make it safe, and the analysis in between is ordinary forward propagation.
 * Every injection vulnerability — SQL, command, path traversal, cross-site
 * scripting — is an instance of one shape, and the shape is expressible in
 * three lists.
 *
 * The lists are also where it goes wrong, and the demo says so rather than
 * hiding it. A source nobody declared is a false negative and the tool is
 * silent about it; a sanitiser nobody declared is a false positive and the
 * tool is loud about it. Neither failure is in the algorithm.
 *
 * What is propagated here:
 *
 * - **direct flow** — the result of an operation on tainted data is tainted;
 * - **through locals** — a tainted value stored in a slot taints the slot,
 *   and reading it back reproduces the taint;
 * - **through calls** — a tainted argument taints the callee's parameter, and
 *   a tainted return value taints the caller's result. This is the
 *   interprocedural part and it is where a real tool becomes expensive;
 * - **through structures** — a tainted value stored into a record or array
 *   taints the whole container, which is FIELD-INSENSITIVE and therefore
 *   imprecise. Being explicit about that is the point: a tool that quietly
 *   drops taint at a field boundary has a false negative nobody can see.
 *
 * The path is kept, not just the verdict. "This value is tainted" is not a bug
 * report; "this value came from this source, through these three operations,
 * and reaches this sink" is.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Taint = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  const CONTAINERS = { makeRecord: true, makeArray: true, makeClosure: true };

  function defaultPolicy() {
    return {
      sources: ['readParam', 'readInput', 'readCookie'],
      sinks: ['query', 'exec', 'render'],
      sanitisers: ['escape', 'quote', 'validate'],
      /* 'insensitive' is what nearly every shipping tool does: one abstract
         location per container, so a tainted field taints its clean siblings.
         'sensitive' keeps one per field of a record literal and costs a map
         per allocation. Both are offered because the difference between them
         is a false-positive count rather than an opinion. */
      fields: 'insensitive'
    };
  }

  /* ------------------------------------------------------- the name resolution */

  /**
   * A call in this IR names its callee by REGISTER, so the analysis has to
   * know which function that register holds. `makeClosure` records the source
   * name, and it flows through slots exactly as a value does — which is why
   * this is tracked rather than pattern-matched on the call site.
   */
  function resolveNames(fn) {
    const regs = {};
    const slots = {};

    fn.blocks.forEach(function (block) {
      block.instructions.forEach(function (inst) {
        if (inst.op === 'makeClosure') { regs[inst.target] = inst.sourceName || inst.func; return; }
        if (inst.op === 'loadLocal') { regs[inst.target] = slots[inst.slot]; return; }
        if (inst.op === 'storeLocal') slots[inst.slot] = regs[inst.value];
      });
    });
    return regs;
  }

  function calleeName(names, inst) {
    return names[inst.callee] || inst.callee;
  }

  /* ------------------------------------------------------------ propagation */

  function emptyFacts() {
    return { regs: {}, slots: {}, fields: {} };
  }

  function taintOf(facts, name) {
    return facts.regs[name] || null;
  }

  function mark(facts, name, origin, why, inst) {
    facts.regs[name] = { origin: origin,
      path: (why ? why.path : []).concat([{ why: why ? why.label : 'source',
        op: inst ? inst.op : 'source', span: inst ? inst.span : null,
        target: name }]) };
    return facts.regs[name];
  }

  /**
   * One pass over one function. Called repeatedly by `analyse` until nothing
   * changes, because a loop can carry taint backwards through a slot and a
   * single pass would miss it.
   */
  function step(fn, policy, names, facts, report) {
    let changed = false;

    fn.blocks.forEach(function (block) {
      block.instructions.forEach(function (inst) {
        if (applyInstruction(fn, policy, names, facts, report, inst)) changed = true;
      });
    });
    return changed;
  }

  function applyInstruction(fn, policy, names, facts, report, inst) {
    if (inst.op === 'loadLocal') return copy(facts, inst.slot, inst.target, 'read', inst, true);
    if (inst.op === 'storeLocal') return copy(facts, inst.value, inst.slot, 'store', inst, false);
    if (inst.op === 'binary') return fromOperands(facts, inst, [inst.left, inst.right]);
    if (inst.op === 'unary') return fromOperands(facts, inst, [inst.operand]);
    if (CONTAINERS[inst.op]) return buildContainer(policy, facts, inst);
    if (inst.op === 'loadField') return readField(policy, facts, inst);
    if (inst.op === 'loadIndex') return fromOperands(facts, inst, [inst.object]);
    if (inst.op === 'call') return applyCall(policy, names, facts, report, inst);
    return false;
  }

  /**
   * A container is tainted if anything put into it is. Under field
   * sensitivity the per-field taint is recorded beside that, so a later
   * `loadField` can be more precise than the container as a whole — and the
   * container-level fact is still kept, because a read of a field this
   * literal did not name has nothing else to fall back on.
   */
  function buildContainer(policy, facts, inst) {
    const changed = fromOperands(facts, inst, inst.args || []);

    if (policy.fields !== 'sensitive' || !inst.fields) return changed;
    const perField = facts.fields[inst.target] || {};

    inst.fields.forEach(function (field, at) {
      perField[field] = taintOf(facts, (inst.args || [])[at]);
    });
    facts.fields[inst.target] = perField;
    return changed;
  }

  /**
   * Reading a field of a tainted record. Field-INSENSITIVELY the answer is the
   * container's taint, which is the false positive this section measures: a
   * clean field of a record that also holds a tainted one is reported.
   */
  function readField(policy, facts, inst) {
    const known = policy.fields === 'sensitive' ? facts.fields[inst.object] : null;

    if (!known || !Object.prototype.hasOwnProperty.call(known, inst.field)) {
      return fromOperands(facts, inst, [inst.object]);
    }
    if (!known[inst.field] || facts.regs[inst.target]) return false;
    mark(facts, inst.target, known[inst.field].origin,
      { path: known[inst.field].path, label: 'field ' + inst.field }, inst);
    return true;
  }

  function copy(facts, from, to, label, inst, fromSlot) {
    const source = fromSlot ? facts.slots[from] : facts.regs[from];
    const store = fromSlot ? facts.regs : facts.slots;

    /* Per-field taint has to travel with the value. Registers are `%n` and
       slots are `@n`, so one map holds both without colliding — and this runs
       before the early return, because a record whose tainted field was
       cleared still carries a field map worth copying. */
    if (facts.fields[from]) facts.fields[to] = facts.fields[from];
    if (!source || store[to]) return false;
    store[to] = { origin: source.origin,
      path: source.path.concat([{ why: label, op: inst.op, span: inst.span, target: to }]) };
    return true;
  }

  function fromOperands(facts, inst, operands) {
    if (!inst.target || facts.regs[inst.target]) return false;
    const tainted = operands.map(function (name) { return taintOf(facts, name); })
      .filter(Boolean)[0];

    if (!tainted) return false;
    mark(facts, inst.target, tainted.origin, { path: tainted.path, label: inst.op }, inst);
    return true;
  }

  /**
   * A call is the interesting instruction: a source introduces taint, a
   * sanitiser removes it, a sink reports it, and anything else propagates a
   * tainted argument to the result. The last rule is the conservative one —
   * a function that ignores its argument is treated as if it returned it —
   * and it is where the false positives come from.
   */
  function applyCall(policy, names, facts, report, inst) {
    const name = calleeName(names, inst);

    if (policy.sources.indexOf(name) !== -1) {
      if (facts.regs[inst.target]) return false;
      mark(facts, inst.target, name, null, inst);
      return true;
    }
    if (policy.sanitisers.indexOf(name) !== -1) {
      if (facts.regs[inst.target] === false) return false;
      facts.regs[inst.target] = null;
      return false;
    }
    if (policy.sinks.indexOf(name) !== -1) return reportSink(facts, report, inst, name);
    return fromOperands(facts, inst, inst.args || []);
  }

  function reportSink(facts, report, inst, name) {
    const args = (inst.args || []).map(function (arg) { return taintOf(facts, arg); })
      .filter(Boolean);

    if (!args.length) return false;
    const already = report.findings.some(function (row) { return row.at === inst; });

    if (already) return false;
    report.findings.push({ at: inst, sink: name, origin: args[0].origin,
      span: inst.span, path: args[0].path,
      hops: args[0].path.length });
    return true;
  }

  /* --------------------------------------------------------------- the run */

  /**
   * Run to a fixpoint, then report. The fixpoint matters because taint can
   * enter a slot on the back edge of a loop, and a single forward pass over
   * the block list reports nothing for
   * `while (...) { t = wrap(t); }` where the first iteration is clean.
   */
  function analyse(fn, options) {
    const settings = options || {};
    const policy = Object.assign(defaultPolicy(), settings.policy || {});
    const names = resolveNames(fn);
    const facts = emptyFacts();
    const report = { findings: [], rounds: 0, policy: policy };

    while (report.rounds < 50 && step(fn, policy, names, facts, report)) {
      report.rounds += 1;
    }
    return finish(fn, facts, report, names);
  }

  function finish(fn, facts, report, names) {
    return { findings: report.findings, rounds: report.rounds, policy: report.policy,
      tainted: Object.keys(facts.regs).filter(function (name) {
        return Boolean(facts.regs[name]);
      }),
      taintedSlots: Object.keys(facts.slots).filter(function (slot) {
        return Boolean(facts.slots[slot]);
      }),
      calls: callTable(fn, names, report.policy) };
  }

  /** Every call in the function with the role its callee plays in the policy. */
  function callTable(fn, names, policy) {
    const rows = [];

    fn.blocks.forEach(function (block) {
      block.instructions.forEach(function (inst) {
        if (inst.op !== 'call') return;
        const name = calleeName(names, inst);

        rows.push({ name: name, role: roleOf(policy, name), span: inst.span,
          args: (inst.args || []).length });
      });
    });
    return rows;
  }

  function roleOf(policy, name) {
    if (policy.sources.indexOf(name) !== -1) return 'source';
    if (policy.sinks.indexOf(name) !== -1) return 'sink';
    if (policy.sanitisers.indexOf(name) !== -1) return 'sanitiser';
    return 'ordinary';
  }

  /**
   * The two ways the model fails, made measurable. Drop a declaration and
   * re-run: removing a source loses findings (false negatives), and removing a
   * sanitiser gains them (false positives). Neither is a bug in the algorithm
   * and both are what a real deployment spends its time on.
   */
  function policySweep(fn, base) {
    const full = analyse(fn, { policy: base });
    const rows = [{ change: 'the declared policy', findings: full.findings.length,
      delta: 0 }];
    const variants = [
      { change: 'one source undeclared', policy: dropFirst(base, 'sources') },
      { change: 'one sanitiser undeclared', policy: dropFirst(base, 'sanitisers') },
      { change: 'one sink undeclared', policy: dropFirst(base, 'sinks') }
    ];

    variants.forEach(function (variant) {
      const out = analyse(fn, { policy: variant.policy });

      rows.push({ change: variant.change, findings: out.findings.length,
        delta: out.findings.length - full.findings.length });
    });
    return rows;
  }

  function dropFirst(policy, field) {
    const copyOf = Object.assign({}, policy);

    copyOf[field] = (policy[field] || []).slice(1);
    return copyOf;
  }

  return { CONTAINERS: CONTAINERS, defaultPolicy: defaultPolicy,
    resolveNames: resolveNames, calleeName: calleeName, analyse: analyse,
    policySweep: policySweep, roleOf: roleOf };
}));
