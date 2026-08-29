/**
 * Section: SMT solving.
 *
 * DPLL(T) as a division of labour, with the division visible: the SAT core
 * from 32.5 runs over atoms it treats as opaque propositions, the theory
 * answers one question about the conjunction it selects, and an explanation
 * comes back as a clause.
 *
 * The measurement that carries the section is the quality of that explanation.
 * The padded problem has one real conflict plus k free choices, so the number
 * of theory-consistent boolean models is exponential in k while the conflict
 * never changes. With a minimised core the loop takes two rounds at every k;
 * with the whole assignment as the explanation it takes 2, 4, 10, 28, 82 —
 * one round per model, which is enumeration wearing a solver's clothes.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'smt-solving';
  const PADS = [0, 1, 2, 3, 4];
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the loop between a solver that cannot count and one that cannot search',
      caption: 'The SAT core sees propositions with no meaning and finds an assignment '
        + 'satisfying the boolean structure. The theory sees a conjunction of literals with no '
        + 'structure and answers whether they can hold together. The only thing crossing '
        + 'between them is a clause — which is why the same core serves equality, arithmetic '
        + 'and arrays without knowing anything about them.',
      definition: [
        'flowchart LR',
        'F["formula over atoms<br/>a = b, f(a) = f(b), x - y <= 3"] --> S["SAT core<br/>every atom is an opaque proposition"]',
        'S -->|"no assignment"| U["unsatisfiable"]',
        'S -->|"a satisfying assignment"| T["theory solver<br/>is this conjunction consistent?"]',
        'T -->|"yes"| M["satisfiable — the theory model is the answer"]',
        'T -->|"no: an explanation"| C["blocking clause:<br/>not all of these together"]',
        'C --> S'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**SMT is SAT with atoms that mean something.** The formula still has boolean structure — '
        + 'clauses, negations, disjunctions — but a proposition is now `x = y` or `f(a) = b` or '
        + '`p - q <= 3` rather than an anonymous variable. That is the whole difference, and it '
        + 'is why an SMT solver can talk about programs while a SAT solver talks about bits.',
      '**DPLL(T) is a division of labour, and neither half understands the other.** The SAT '
        + 'core treats every atom as opaque and finds an assignment satisfying the structure; '
        + 'the theory takes the conjunction that assignment selects and answers one question — '
        + 'can these hold together. Nothing else crosses the boundary.',
      '**The theory answers a refutation with an EXPLANATION, and that is what makes it a loop '
        + 'rather than an enumeration.** An explanation is a subset of the asserted literals '
        + 'that is already contradictory. Negating it gives a clause the SAT core can use, and '
        + 'a small clause forbids a whole family of assignments at once.',
      '**A weak explanation degenerates the algorithm, measurably.** Return the entire '
        + 'assignment and each blocking clause rules out exactly one model, so the solver '
        + 'enumerates. The demo\'s padded problem shows it: one real conflict plus k free '
        + 'choices takes 2 rounds with a minimised core at every k, and 2, 4, 10, 28, 82 with '
        + 'the whole assignment.',
      '**Equality with uninterpreted functions is the base theory, and it is union-find with '
        + 'one extra rule.** Merge the classes named by each asserted equality — that is the '
        + 'structure from M04 — then apply congruence: if the arguments of two applications of '
        + 'the same function are already equal, the results must be merged too. A disequality '
        + 'between two terms in one class is the conflict.',
      '**Uninterpreted means the solver assumes nothing about the function except congruence.** '
        + 'That is exactly what makes it useful for programs: replace a function you cannot '
        + 'reason about with an uninterpreted symbol, and everything you prove still holds for '
        + 'the real one. It is also why you cannot prove anything that depends on what the '
        + 'function actually computes.',
      '**Difference logic is the arithmetic fragment shortest-paths decides.** Every atom is '
        + '`x - y <= c`, which is an edge from y to x of weight c; the system is satisfiable '
        + 'exactly when the graph has no negative cycle, so Bellman-Ford from M13 is the '
        + 'decision procedure and the negative cycle is the explanation.',
      '**Linear arithmetic needs a real procedure, and the one here eliminates variables.** '
        + 'Fourier-Motzkin removes a variable by pairing every upper bound with every lower '
        + 'bound; when nothing is left, a contradiction is a constant inequality that is false. '
        + 'The pairing squares the constraint count per variable, which is why it gives up on '
        + 'anything large and why real solvers use simplex.',
      '**The integers are a different problem from the rationals, and the gap shows up '
        + 'immediately.** A system with a fractional solution and no integer one is satisfiable '
        + 'over the rationals and unsatisfiable over the integers; the deductive verification '
        + 'in 32.8 fails a perfectly valid loop invariant for exactly this reason and reports '
        + 'the fractional counter-example rather than pretending.',
      '**Every answer here is checked by something that is not the solver.** A satisfiable '
        + 'answer has its boolean model re-checked against the clauses and its theory model '
        + 'against the asserted literals; an unsatisfiable answer inherits the DRAT proof of '
        + 'the final SAT call. On small problems brute force over every assignment is run as '
        + 'well, and the two verdicts must agree.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: { title: 'Interactive demo — the loop, the explanations, and what they cost',
        markup: root.SmtTemplate.render() },
      diagram: diagram(),
      insight: '**Congruence closure is union-find with a congruence rule, which means the data '
        + 'structure from M04 is doing the reasoning.** That is worth internalising because it '
        + 'generalises: most theory solvers are built from algorithms you already know — '
        + 'difference logic is Bellman-Ford, linear arithmetic is simplex, and bit-vectors are '
        + 'a circuit encoder plus the SAT solver from the previous section. An SMT solver is '
        + 'not a monolithic oracle; it is a scheduler around a handful of classical algorithms. '
        + 'The practical consequence is in how you use one. When a query comes back "unknown" '
        + 'or takes forever, the useful question is which theory your atoms landed in: mixing '
        + 'non-linear arithmetic into a query that was otherwise difference logic can change a '
        + 'millisecond into a timeout, and quantifiers move you from a decision procedure to a '
        + 'heuristic — E-matching finds instantiations by pattern and is incomplete, so an '
        + '"unknown" there means "my patterns did not fire" rather than "your property is '
        + 'false". The second consequence is about encodings, and it is the same lesson as the '
        + 'previous section: the encoding decides the difficulty far more than the solver does. '
        + 'Model your problem in the weakest theory that can express it, keep the atoms in one '
        + 'fragment where you can, and prefer a formulation whose contradictions are local — '
        + 'because a local contradiction is a small explanation, and a small explanation is '
        + 'what stops the loop turning into an enumeration.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });
    panel = root.ControlPanel.mount({
      controls: root.SmtTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function problemFor(name, pad) {
    if (name === 'padded') {
      return Object.assign(root.SmtTemplate.padded(pad),
        { about: 'one real contradiction plus ' + pad + ' independent free choices, which '
          + 'multiply the boolean models without touching the conflict' });
    }
    return root.SmtTemplate.PROBLEMS[name];
  }

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = JSON.parse(key);
    const problem = problemFor(parts[0], parts[2]);
    const options = { explanations: parts[1], rounds: 400 };
    const answer = root.Berugo.Smt.solve(problem, options);

    return { name: parts[0], problem: problem, answer: answer,
      brute: root.Berugo.Smt.bruteForce(problem),
      checked: root.Berugo.Smt.checkAnswer(problem, answer),
      proof: proofCheck(problem, answer),
      explanation: averageExplanation(answer) };
  });

  /* An unsat answer inherits the DRAT proof of the FINAL SAT call, whose
     clause set includes every blocking clause the theory contributed. Replaying
     it checks the boolean half completely and the theory half not at all, which
     is worth saying out loud rather than showing a tick. */
  function proofCheck(problem, answer) {
    if (answer.verdict !== 'unsat' || !answer.proof) return null;
    return root.Berugo.SatCheck.checkProof(
      { variables: problem.atoms.length, clauses: answer.clauses }, answer.proof);
  }

  function averageExplanation(answer) {
    const rows = answer.trace.filter(function (row) {
      return row.stage === 'theory' && !row.ok;
    });

    if (!rows.length) return 0;
    return rows.reduce(function (sum, row) { return sum + row.explanation; }, 0) / rows.length;
  }

  /** Rounds against free choices, both explanation strategies. */
  const scalingFor = root.Helpers.memoise(function () {
    return PADS.map(function (pad) {
      const problem = root.SmtTemplate.padded(pad);

      return { pad: pad,
        minimal: root.Berugo.Smt.solve(problem, { rounds: 400 }).rounds,
        full: root.Berugo.Smt.solve(problem,
          { explanations: 'full', rounds: 400 }).rounds };
    });
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(JSON.stringify([values['smt-problem'], values['smt-explain'],
      values['smt-pad']]));

    paintProblem(study);
    paintMetrics(study);
    paintLoop(study);
    paintAtoms(study);
    paintTheories(study);
    paintChart(app);
  }

  function showAtom(atom) {
    if (atom.bound !== undefined) {
      return atom.left + ' - ' + atom.right + ' <= ' + atom.bound;
    }
    return atom.left + (atom.equal === false ? ' != ' : ' = ') + atom.right;
  }

  function paintProblem(study) {
    const lines = study.problem.atoms.map(function (atom, at) {
      return 'atom ' + (at + 1) + ': ' + showAtom(atom);
    }).concat(study.problem.clauses.map(function (clause) {
      return 'clause: ' + clause.map(function (literal) {
        return (literal > 0 ? '' : 'not ') + 'atom ' + Math.abs(literal);
      }).join(' or ');
    }));

    root.jQuery('#smt-problem-text').text(lines.slice(0, 16).join('\n') +
      (lines.length > 16 ? '\n… ' + (lines.length - 16) + ' more lines' : ''));
    root.Helpers.setText('smt-problem-caption', 'This problem is ' + study.problem.about +
      '. The theory is ' + study.problem.theory + '. The SAT core sees ' +
      study.problem.atoms.length + ' propositions with no meaning attached and ' +
      study.problem.clauses.length + ' clauses over them.');
  }

  function paintMetrics(study) {
    const answer = study.answer;
    const agrees = study.brute.verdict === answer.verdict;

    root.MetricGrid.update({
      'smt-verdict': { value: answer.verdict.toUpperCase(),
        note: study.brute.verdict === 'skipped' ? 'too many atoms to brute force'
          : (agrees ? 'brute force agrees' : 'BRUTE FORCE DISAGREES') },
      'smt-rounds': { value: answer.rounds,
        note: refutations(answer) + ' of them ended in a theory refutation' },
      'smt-size': { value: study.problem.atoms.length + ' · ' + study.problem.clauses.length,
        note: 'atoms and clauses in the skeleton' },
      'smt-explanation': { value: study.explanation.toFixed(1),
        note: study.explanation ? 'literals blamed, of ' + study.problem.atoms.length +
          ' asserted' : 'nothing was refuted' },
      'smt-brute': { value: study.brute.tried === undefined ? '—' : study.brute.tried,
        note: 'assignments enumerated by the oracle' },
      'smt-checked': { value: checkedValue(study),
        note: study.proof ? 'proof steps replayed over the skeleton plus every blocking clause'
          : (study.checked.why || 'skeleton and theory model both re-checked') }
    });
  }

  function checkedValue(study) {
    if (study.proof) return study.proof.ok ? study.proof.checked : 'PROOF FAILED';
    return study.checked.ok ? study.checked.checked || 0 : 'FAILED';
  }

  function refutations(answer) {
    return answer.trace.filter(function (row) {
      return row.stage === 'theory' && !row.ok;
    }).length;
  }

  function paintLoop(study) {
    const rows = study.answer.trace;

    root.jQuery('#smt-loop tbody').html(rows.slice(0, 14).map(function (row) {
      return '<tr><td class="mono">' + (row.round + 1) + '</td><td class="mono">' + row.stage +
        '</td><td class="mono">' + outcomeOf(row) + '</td><td class="mono">' +
        (row.asserted === undefined ? '—' : row.asserted) + '</td><td class="mono">' +
        (row.explanation === undefined ? '—' : row.explanation) + '</td><td>' +
        clauseNote(row) + '</td></tr>';
    }).join('') + elision(rows));

    root.Helpers.setText('smt-loop-caption', loopCaption(study));
  }

  function elision(rows) {
    if (rows.length <= 14) return '';
    return '<tr><td colspan="6">… ' + (rows.length - 14) + ' more rounds, each refuting one '
      + 'more model …</td></tr>';
  }

  function outcomeOf(row) {
    if (row.stage === 'boolean') return row.verdict;
    return row.ok ? 'consistent' : 'refuted';
  }

  function clauseNote(row) {
    if (row.stage === 'boolean') return 'the core ran out of assignments — the answer is unsat';
    if (row.ok) return 'nothing: the theory accepted this model, so the problem is satisfiable';
    return 'a blocking clause over ' + row.explanation + ' atom' +
      (row.explanation === 1 ? '' : 's') + ', added to the skeleton';
  }

  function loopCaption(study) {
    const count = refutations(study.answer);

    if (!count) {
      return 'One round: the SAT core produced an assignment and the theory accepted it, so the '
        + 'problem is satisfiable and no explanation was ever needed. That is the best case and '
        + 'it is common — most queries a verifier makes are decided by the boolean structure.';
    }
    return count + ' theory refutation' + (count === 1 ? '' : 's') + ', each adding one clause '
      + 'to the skeleton, and then a boolean answer. The explanation column is the number to '
      + 'watch: it is the size of the clause the theory hands back, and the whole difference '
      + 'between a solver and an enumerator is whether that number stays small as the problem '
      + 'grows.';
  }

  function paintAtoms(study) {
    const model = study.answer.model || [];
    const asserted = study.answer.literals || [];

    root.jQuery('#smt-atoms tbody').html(study.problem.atoms.map(function (atom, at) {
      const value = model[at];

      return '<tr><td class="mono">' + (at + 1) + '</td><td class="mono">' + showAtom(atom) +
        '</td><td class="mono">' + (model.length ? String(value) : 'no model — unsat') +
        '</td><td>' + roleOf(study, at, value) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('smt-atoms-caption', study.answer.verdict === 'sat'
      ? 'The theory was handed the ' + asserted.length + ' literals this model selects and '
        + 'found them consistent, so the answer is satisfiable and the theory\'s own model is '
        + 'the witness. The check re-ran both halves independently.'
      : 'There is no model, so the third column is empty by construction. What the solver '
        + 'produced instead is a DRAT proof from the final SAT call, over a clause set that '
        + 'includes every blocking clause the theory contributed — which is why an SMT unsat '
        + 'answer is only as trustworthy as the theory that supplied those clauses.');
  }

  function roleOf(study, at, value) {
    if (study.answer.verdict !== 'sat') return 'part of the refuted structure';
    if (value === undefined) return 'unassigned';
    return value ? 'asserted positively to the theory' : 'asserted negatively to the theory';
  }

  const THEORIES = [
    { name: 'EUF — equality and uninterpreted functions',
      atoms: 'a = b, f(a) = g(b, c)',
      how: 'union-find over the terms, plus congruence: equal arguments force equal results',
      explains: 'a minimised subset of the merges that put the two sides of a disequality together',
      stops: 'anything about what the function computes; only congruence is assumed' },
    { name: 'difference logic', atoms: 'x - y <= c',
      how: 'an edge per atom and a negative-cycle search — Bellman-Ford from M13',
      explains: 'the negative cycle itself, which is as small an explanation as exists',
      stops: 'a constraint with two variables on one side, which is not a difference' },
    { name: 'linear arithmetic', atoms: '3x + 2y <= 7',
      how: 'Fourier-Motzkin: eliminate a variable by pairing every upper bound with every lower',
      explains: 'the whole constraint set, which is the weak case this demo measures',
      stops: 'the integers; a fractional model is a rational answer and not an integer one' },
    { name: 'bit-vectors', atoms: 'x[7:0] + y = z',
      how: 'bit-blasting: build the circuit and hand the whole thing to the SAT solver',
      explains: 'nothing separately — the SAT core does all the work',
      stops: 'nowhere in principle, and at the formula size in practice' }
  ];

  function paintTheories(study) {
    root.jQuery('#smt-theories tbody').html(THEORIES.map(function (row) {
      const current = row.name.toLowerCase().indexOf(study.problem.theory) === 0;

      return '<tr' + (current ? ' class="row-current"' : '') + '><td class="mono">' + row.name +
        '</td><td class="mono">' + root.Helpers.escapeHtml(row.atoms) + '</td><td>' +
        root.Helpers.escapeHtml(row.how) + '</td><td>' + row.explains + '</td><td>' +
        row.stops + '</td></tr>';
    }).join(''));

    root.Helpers.setText('smt-theories-caption',
      'Three of the four are classical algorithms with a solver interface bolted on, and the '
      + 'fourth is the SAT solver from 32.5 with an encoder in front. That is the honest '
      + 'description of an SMT solver: a scheduler around algorithms you already know, whose '
      + 'engineering is in the explanations and in how the theories are combined.');
  }

  function paintChart(app) {
    const host = root.jQuery('#smt-chart')[0];
    const rows = scalingFor('pads');

    if (!host) return;
    if (chart) chart.destroy();
    chart = root.GrowthPlot.render(host, {
      lazyLib: app.lazyLib, height: 250, logY: true,
      xLabel: 'independent free choices in the problem', yLabel: 'rounds of the loop (log)',
      series: [
        { label: 'a minimised core — the conflict, and nothing else',
          points: rows.map(function (row) { return { x: row.pad, y: row.minimal }; }) },
        { label: 'the whole assignment as the explanation',
          points: rows.map(function (row) { return { x: row.pad, y: row.full }; }) }
      ],
      legendHost: root.jQuery('#smt-legend')[0],
      summary: function () {
        return 'Rounds of the DPLL(T) loop against the number of free choices, for a '
          + 'minimised core and for the whole assignment.';
      }
    });
    root.Helpers.setText('smt-chart-note', chartNote(rows));
  }

  function chartNote(rows) {
    const last = rows[rows.length - 1];

    return 'The problem is one contradiction — a = b with f(a) not equal to f(b) — plus k free '
      + 'choices that the theory has no opinion about at all. The conflict never changes and '
      + 'never gets harder, so a solver whose explanation names the two atoms that clash takes '
      + rows[0].minimal + ' rounds at every k. Returning the whole assignment instead takes ' +
      rows.map(function (row) { return row.full; }).join(', ') + ' — one round per '
      + 'theory-consistent model, because each blocking clause rules out exactly one. At k = ' +
      last.pad + ' that is ' + last.full + ' rounds against ' + last.minimal + ', and the ratio '
      + 'grows without bound. This is why "the theory returns an explanation" is the whole '
      + 'architecture rather than a detail of it.';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
