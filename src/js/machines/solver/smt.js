/**
 * DPLL(T): a SAT solver that does not know what the atoms mean, and a theory
 * solver that does not know about search.
 *
 * The architecture is the whole idea and it is worth stating as a division of
 * labour. The formula is a boolean structure over ATOMS — `x = y`, `f(a) =
 * b`, `p - q <= 3` — and the SAT core treats each atom as an opaque
 * proposition. It finds an assignment satisfying the boolean structure and
 * hands the resulting conjunction of theory literals to the theory solver,
 * which knows nothing about clauses and answers one question: is this set of
 * literals consistent.
 *
 * If it is, the problem is satisfiable and the theory's model is the answer.
 * If it is not, the theory returns an EXPLANATION — a subset of the literals
 * that is already contradictory — and the negation of that subset becomes a
 * new clause for the SAT core. That clause is why the loop terminates and why
 * it is not enumeration: a good explanation forbids a whole family of
 * assignments at once, and a lazy solver that returns the entire assignment as
 * its explanation degenerates into trying every model in turn.
 *
 * This is the *lazy* combination. Eager solvers bit-blast the theory into
 * propositional logic up front, which is what bit-vector solvers do; the trade
 * is a much larger formula against never leaving the SAT core.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.Berugo = root.Berugo || {};
    root.Berugo.Smt = api;
  }
}(typeof window !== 'undefined' ? window : null, function (root) {
  'use strict';

  const Sat = pick('Sat', './sat.js');
  const SatCheck = pick('SatCheck', './check.js');
  const Euf = pick('TheoryEuf', './theories/euf.js');
  const Difference = pick('TheoryDifference', './theories/difference.js');

  function pick(name, file) {
    if (root && root.Berugo && root.Berugo[name]) return root.Berugo[name];
    return require(file);
  }

  const THEORIES = { euf: Euf, difference: Difference };

  function theoryFor(name) {
    return THEORIES[name] || Euf;
  }

  /* ---------------------------------------------------------- the atoms */

  /**
   * An atom is a theory literal written positively; the boolean skeleton
   * refers to it by a one-based index, exactly as DIMACS does. Negating a
   * literal in the skeleton negates the atom, which is what lets the SAT core
   * stay ignorant of what any of them mean.
   */
  function assertedLiterals(atoms, model) {
    return atoms.map(function (atom, at) {
      const literal = model[at] ? Object.assign({}, atom) : negateAtom(atom);

      /* The literal carries the index of the atom it came from, and the
         theory hands the same object back in its explanation. Matching on
         the printed form instead looks equivalent and is not: two atoms with
         the same terms are two independent propositions to the SAT core, and
         mapping an explanation to the first one that looks right blocks the
         wrong assignment and the loop never converges. */
      literal.atom = at;
      return literal;
    });
  }

  function negateAtom(atom) {
    return Object.assign({}, atom, { equal: atom.equal === false });
  }

  function indexOfSource(atoms, source) {
    for (let at = 0; at < atoms.length; at += 1) {
      if (atoms[at] === source) return at + 1;
      if (atoms[at].negated === source) return -(at + 1);
    }
    return 0;
  }

  /**
   * The blocking clause. Each literal in the explanation was asserted with a
   * polarity; the clause says "not all of these again", which is the negation
   * of their conjunction and therefore implied by the theory.
   */
  function blockingClause(atoms, explanation, model) {
    const clause = [];
    const seen = {};

    explanation.forEach(function (literal) {
      const at = literal.atom;

      if (at === undefined || seen[at]) return;
      seen[at] = true;
      clause.push(model[at] ? -(at + 1) : at + 1);
    });
    return clause;
  }

  /* ---------------------------------------------------------- the loop */

  /**
   * Solve, and report the loop as it ran. `rounds` is the number of times the
   * theory refuted the SAT core's model, which is the number people should be
   * looking at: one round means the boolean structure did all the work, and
   * many rounds mean the explanations are weak.
   */
  function solve(problem, options) {
    const settings = options || {};
    const theory = theoryFor(problem.theory);
    const atoms = problem.atoms;
    const clauses = problem.clauses.map(function (row) { return row.slice(); });
    const trace = [];
    const limit = settings.rounds || 200;

    for (let round = 0; round < limit; round += 1) {
      const outcome = oneRound(theory, atoms, clauses, trace, round);

      if (outcome) return Object.assign({ rounds: trace.length, trace: trace }, outcome);
    }
    return { verdict: 'unknown', rounds: trace.length, trace: trace,
      why: 'the theory refuted ' + limit + ' models without the core running out' };
  }

  function oneRound(theory, atoms, clauses, trace, round) {
    const boolean = Sat.solve({ variables: atoms.length, clauses: clauses }, {});

    if (boolean.verdict !== 'sat') {
      trace.push({ round: round, stage: 'boolean', verdict: boolean.verdict });
      return { verdict: boolean.verdict, boolean: boolean,
        proof: boolean.proof, clauses: clauses };
    }
    const literals = assertedLiterals(atoms, boolean.model);
    const verdict = theory.check(literals);

    trace.push({ round: round, stage: 'theory', ok: verdict.ok,
      asserted: literals.length,
      explanation: verdict.ok ? 0 : verdict.explanation.length });
    if (verdict.ok) {
      return { verdict: 'sat', model: boolean.model, literals: literals,
        theoryModel: verdict.model, clauses: clauses };
    }
    clauses.push(blockingClause(atoms, verdict.explanation, boolean.model));
    return null;
  }

  /* -------------------------------------------------------- the checkers */

  /**
   * An SMT answer is checked in two independent halves, because it can be
   * wrong in two independent ways: the boolean assignment may not satisfy the
   * clause structure, or the theory literals it selects may not be consistent.
   * Neither check shares code with the search.
   */
  function checkAnswer(problem, answer) {
    if (answer.verdict !== 'sat') return { ok: true, checked: 0, why: 'nothing to check' };
    const boolean = SatCheck.checkModel(
      { variables: problem.atoms.length, clauses: problem.clauses }, answer.model);

    if (!boolean.ok) return { ok: false, why: 'the boolean skeleton: ' + boolean.why };
    const theory = theoryFor(problem.theory);
    const literals = assertedLiterals(problem.atoms, answer.model);
    const consistent = theory.check(literals);

    if (!consistent.ok) return { ok: false, why: 'the theory literals are inconsistent' };
    const model = theory.checkModel(literals, answer.theoryModel);

    if (!model.ok) return { ok: false, why: 'the theory model: ' + model.why };
    return { ok: true, checked: problem.clauses.length + literals.length };
  }

  /**
   * The oracle: every boolean assignment tried, and the theory asked about
   * each one that satisfies the skeleton. Exponential, and therefore the right
   * thing for a fixture with a dozen atoms and the wrong thing for anything
   * else — which is exactly the trade every brute-force oracle in this project
   * makes.
   */
  function bruteForce(problem, limit) {
    const atoms = problem.atoms;

    if (atoms.length > (limit || 14)) return { verdict: 'skipped', atoms: atoms.length };
    const theory = theoryFor(problem.theory);
    const total = Math.pow(2, atoms.length);

    for (let mask = 0; mask < total; mask += 1) {
      const model = [];

      for (let at = 0; at < atoms.length; at += 1) model.push(Boolean((mask >> at) & 1));
      if (!SatCheck.checkModel({ variables: atoms.length, clauses: problem.clauses },
        model).ok) continue;
      if (theory.check(assertedLiterals(atoms, model)).ok) {
        return { verdict: 'sat', model: model, tried: mask + 1 };
      }
    }
    return { verdict: 'unsat', tried: total };
  }

  /**
   * The unsat core over the ASSERTIONS rather than over the clauses: drop each
   * top-level assertion and ask whether the problem is still unsatisfiable.
   * That is the artefact a verification tool shows a user, because it names
   * the annotations that are in conflict rather than the clauses a translator
   * produced.
   */
  function unsatCore(problem, options) {
    const assertions = problem.clauses;
    let needed = assertions.slice();

    assertions.forEach(function (clause) {
      const without = needed.filter(function (row) { return row !== clause; });
      const trial = solve({ atoms: problem.atoms, clauses: without,
        theory: problem.theory }, options);

      if (trial.verdict !== 'unsat') return;
      needed = without;
    });
    return needed;
  }

  return { THEORIES: THEORIES, theoryFor: theoryFor, negateAtom: negateAtom,
    assertedLiterals: assertedLiterals, blockingClause: blockingClause,
    indexOfSource: indexOfSource, solve: solve, checkAnswer: checkAnswer,
    bruteForce: bruteForce, unsatCore: unsatCore };
}));
