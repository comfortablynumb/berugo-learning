/**
 * Section: reduction workshop.
 *
 * The requirement is written down twice, by two pieces of code that share
 * nothing: an encoder that turns it into clauses, and a checker that reads a
 * finished schedule and tests each stated requirement directly. A schedule the
 * solver returns is decoded and then run through the checker, and any
 * requirement it fails is an ENCODING defect rather than an infeasible
 * instance.
 *
 * That is the section's whole claim, and the demo also shows the other half:
 * three of the scenario's requirements are preferences, a clause cannot carry
 * a preference, and the roster's numbers on them are reported next to the ones
 * that were encoded. "The solver said yes" and "the roster is acceptable" are
 * different sentences, and the gap between them is where rostering projects
 * fail.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'reduction-workshop';
  let panel = null;

  const CATALOGUE = [
    { problem: 'shift and exam scheduling',
      formulation: 'graph colouring, or SAT with one variable per (person, slot)',
      assumes: 'conflicts are pairwise and known in advance, and every slot is interchangeable',
      diverges: 'a soft preference for consecutive shifts is not a colour constraint; encoding it hard removes feasible rosters' },
    { problem: 'dependency resolution',
      formulation: 'SAT — requirements are Horn, alternatives and conflicts are not',
      assumes: 'a package is present or absent, with no version ordering inside the Boolean',
      diverges: '"prefer the newest version that works" is an objective, so the model needs MaxSAT or a search over bounds' },
    { problem: 'resource allocation and assignment',
      formulation: 'bipartite matching or min-cost flow — polynomial, not NP-hard',
      assumes: 'each unit of resource goes to exactly one consumer and costs are additive',
      diverges: 'any "these two must go together" constraint breaks the flow structure and pushes it to ILP' },
    { problem: 'vehicle routing and delivery',
      formulation: 'TSP variants — capacitated, with time windows',
      assumes: 'travel times are fixed, symmetric and known',
      diverges: 'traffic makes the matrix asymmetric and time-dependent, and the optimal tour changes with the departure time' },
    { problem: 'facility or warehouse layout',
      formulation: 'quadratic assignment',
      assumes: 'the flow between each pair of departments is a single number',
      diverges: 'flow depends on the layout itself once congestion matters, so the objective is not actually quadratic' },
    { problem: 'feature selection under a size limit',
      formulation: 'knapsack, or set cover when coverage is what matters',
      assumes: 'the value of a set is the sum of its members’ values',
      diverges: 'features interact, so value is not additive and the greedy bound stops applying' }
  ];

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — requirements to formulation, with every assumption written on an arrow',
      caption: 'The arrows are where the modelling happens and each one carries an assumption ' +
        'that may or may not hold. "At most one shift per nurse per day" becomes an at-most-one ' +
        'constraint and the assumption is trivially true. "Exactly this many nurses on each ' +
        'shift" becomes a cardinality constraint and assumes the demand is hard rather than a ' +
        'target. "Shifts should be fairly distributed" has no arrow at all, because a clause ' +
        'cannot express a preference — and the honest model records that as an omission with a ' +
        'measured value beside it rather than dropping it. The validation arrow at the bottom is ' +
        'the one that closes the loop: it reads the finished schedule and checks each ' +
        'requirement in the requirement’s own language.',
      definition: [
        'flowchart TD',
        '    R1["at most one shift per nurse per day"] -->|"exact"| C1["at-most-one over 3 literals"]',
        '    R2["each shift needs its headcount"] -->|"assumes demand is hard, not a target"| C2["cardinality, at-least-k and at-most-k"]',
        '    R3["no day shift after a night shift"] -->|"exact"| C3["one binary clause per nurse per day"]',
        '    R4["at most k shifts per nurse"] -->|"exact"| C4["sequential counter"]',
        '    R5["a rest day in every window"] -->|"assumes worked shifts = worked days"| C5["at-most-(w−1) per window"]',
        '    R6["shifts should be shared fairly"] -->|"NO CLAUSE CAN SAY THIS"| X["needs MaxSAT or ILP"]',
        '    C1 --> F["one CNF"]',
        '    C2 --> F',
        '    C3 --> F',
        '    C4 --> F',
        '    C5 --> F',
        '    F --> S["solver"] --> D["decode to a schedule"]',
        '    D --> V["validate against R1..R5 directly"]',
        '    V -->|"any failure is an ENCODING bug"| C1'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Modelling is the act of choosing which known problem your problem is, and it is ' +
        'where the risk lives.** Shift scheduling is colouring; dependency resolution is SAT; ' +
        'resource allocation is flow or matching; routing is a TSP variant; layout is quadratic ' +
        'assignment. Recognising the shape gives you decades of solver engineering for free — ' +
        'and it also commits you to every assumption the shape carries.',
      '**Write the requirement down twice.** Once as a model, and once as a checker that reads ' +
        'a finished answer and tests the requirement in its own language. The two must share ' +
        'no code, because a checker written from the model checks the model and would agree ' +
        'with a wrong one exactly as happily. The demo runs the solver’s schedule through that ' +
        'checker and reports each requirement separately.',
      '**The failure mode is not a slow solver. It is a model that quietly does not represent ' +
        'the requirement.** The solver returns quickly and correctly with the answer to a ' +
        'different question, and nothing downstream can tell — the schedule looks like a ' +
        'schedule. Validating the mapped-back answer against the original constraints is the ' +
        'only defence, and it is cheap.',
      '**Every arrow from a requirement to a constraint carries an assumption, and some are ' +
        'wrong.** "At least one rest day in every window of four" is encoded here as "at most ' +
        'three of the twelve shift variables in that window", which is correct only because a ' +
        'nurse works at most one shift a day. That equivalence is true today and would stop ' +
        'being true the moment split shifts appeared — so the checker counts worked DAYS ' +
        'directly rather than trusting it.',
      '**A hard constraint is a clause and a preference is an objective, and SAT has no ' +
        'objective.** "Weekend shifts should be shared evenly" cannot be a clause. Encoding it ' +
        'as one — "nobody works more than two weekends" — turns a preference into a constraint ' +
        'and can make a feasible instance infeasible, with no indication of which requirement ' +
        'caused it. The honest model lists it as unmodelled and reports what the roster ' +
        'achieved anyway.',
      '**"UNSAT" and "budget exhausted" are completely different claims.** The first says no ' +
        'schedule satisfies every constraint; the second says this solver did not find one in ' +
        'the time it was given. The demo’s frontier table has rows of both kinds, side by side, ' +
        'and the difference between them is the difference between "relax a requirement" and ' +
        '"wait longer or improve the model".',
      '**An infeasibility diagnosis has to be built, because the solver does not provide one.** ' +
        'When the answer is UNSAT the solver says nothing about which requirement caused it. ' +
        'The practical technique is to solve with each constraint group relaxed in turn, or to ' +
        'ask for an unsatisfiable core; the counting argument — capacity against demand — is ' +
        'usually cheaper and catches the common case before the solver is called at all.',
      '**The catalogue is worth memorising because recognition is most of the work.** Once you ' +
        'see that your problem is matching rather than colouring, the algorithm is polynomial ' +
        'and the conversation is over. Half of "this is NP-hard" claims in practice are ' +
        'misidentifications of a problem that has a fast exact algorithm, and the other half ' +
        'are correct and mean "encode it and call a solver".'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — model a roster, solve it, and check it against every requirement',
        markup: root.ReductionWorkshopTemplate.render()
      },
      diagram: diagram(),
      insight: '**Ship the validator, not just the solver.** The artefact that makes an ' +
        'optimisation system trustworthy is not the model and not the solver — it is the piece ' +
        'of code that takes the produced answer and the original written requirements and says ' +
        'which requirements the answer satisfies. It is usually a morning’s work, it runs in ' +
        'milliseconds, it catches every encoding drift the model will ever acquire, and it turns ' +
        '"the optimiser produced a schedule" into "the optimiser produced a schedule that ' +
        'satisfies requirements one through five and scores this on the three we could not ' +
        'encode". Only the second sentence is worth putting in front of the people who have to ' +
        'work the shifts.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ReductionWorkshopTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function optionsFrom(values) {
    return { nurses: values['rwk-nurses'], days: values['rwk-days'],
      demand: String(values['rwk-demand']).split(',').map(Number),
      maxShifts: values['rwk-max'] };
  }

  const gapFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.SolverLab.modelGap({ nurses: Number(parts[0]), days: Number(parts[1]),
      demand: parts[2].split(',').map(Number), maxShifts: Number(parts[3]) });
  });

  const frontierFor = root.Helpers.memoise(function () {
    return root.SolverLab.feasibilityFrontier({});
  });

  function update(app) {
    const values = panel.values();
    const options = optionsFrom(values);
    const gap = gapFor(options.nurses + '|' + options.days + '|' + options.demand.join(',') +
      '|' + options.maxShifts);

    paintMetrics(gap);
    paintGrid(gap);
    paintHard(gap);
    paintSoft(gap);
    paintFrontier(frontierFor(''));
    paintCatalogue();
  }

  function paintMetrics(gap) {
    const study = gap.study;
    const validation = study.validation;

    root.MetricGrid.update({
      'rwk-model': { value: root.Format.exact(study.model.clauses) + ' clauses',
        note: root.Format.exact(study.model.variables) + ' variables, of which ' +
          root.Format.exact(study.model.variables - study.model.decisionVariables) +
          ' are counters the encoding introduced' },
      'rwk-solve': { value: root.Format.exact(study.solved.stats.nodes) + ' nodes',
        note: study.feasible
          ? 'a roster exists, found in ' + root.Format.duration(study.millis)
          : (study.solved.exhausted ? 'budget exhausted — NOT a proof of infeasibility'
            : 'proved infeasible in ' + root.Format.duration(study.millis)) },
      'rwk-checked': { value: validation === null ? '—'
        : root.Format.exact(validation.checks.filter(function (check) { return check.ok; }).length) +
          ' of ' + root.Format.exact(validation.checks.length),
        note: validation === null ? 'no schedule to check'
          : (validation.satisfied ? 'every stated requirement holds in the schedule itself'
            : 'A REQUIREMENT FAILED — the encoding has drifted') },
      'rwk-unmodelled': { value: root.Format.exact(gap.soft.length),
        note: 'preferences that are objectives rather than constraints' }
    });
  }

  function paintGrid(gap) {
    const study = gap.study;
    const host = root.jQuery('#rwk-grid');

    if (!study.feasible) {
      host.html('<p class="note">No schedule to draw — see the note below.</p>');
      root.Helpers.setText('rwk-grid-note', study.note);
      return;
    }
    host.html(gridMarkup(study));
    root.Helpers.setText('rwk-grid-note', gridNote(gap));
  }

  function gridMarkup(study) {
    const spec = study.spec;
    const head = ['<tr><th>Nurse</th>'];

    for (let day = 0; day < spec.days; day += 1) head.push('<th>d' + day + '</th>');
    head.push('<th>shifts</th></tr>');
    const body = study.schedule.map(function (row, nurse) {
      const cells = row.map(function (shift) {
        return '<td class="mono">' + (shift < 0 ? '·' : spec.shifts[shift].charAt(0).toUpperCase()) +
          '</td>';
      }).join('');
      const worked = row.filter(function (shift) { return shift >= 0; }).length;
      return '<tr><td class="mono">n' + nurse + '</td>' + cells + '<td class="mono">' + worked +
        '</td></tr>';
    }).join('');
    return '<table class="ref-table"><thead>' + head.join('') + '</thead><tbody>' + body +
      '</tbody></table>';
  }

  function gridNote(gap) {
    const spec = gap.study.spec;
    const stats = gap.stats;

    return 'D is a day shift, E an evening, N a night, and · a rest day. Every column holds ' +
      'exactly ' + spec.demand.join(', ') + ' nurses on the three shifts, no nurse works two ' +
      'shifts in a day, none works a day shift after a night, none exceeds ' +
      root.Format.exact(spec.maxShifts) + ' shifts, and each has a rest day in every window of ' +
      root.Format.exact(spec.restWindow) + '. Every one of those was checked against this grid ' +
      'rather than against the formula. The right-hand column is where the unmodelled ' +
      'requirements show: the shifts range from ' +
      root.Format.exact(Math.min.apply(null, stats.perNurse)) + ' to ' +
      root.Format.exact(Math.max.apply(null, stats.perNurse)) + ', which satisfies every hard ' +
      'constraint and is not what anybody means by a fair roster.';
  }

  function paintHard(gap) {
    root.jQuery('#rwk-hard tbody').html(gap.hard.map(function (row) {
      return '<tr><td>' + row.text + '</td><td class="mono">' + root.Format.exact(row.clauses) +
        '</td><td class="mono">' + root.Format.exact(row.auxiliary) + '</td><td class="mono">' +
        (row.ok === null ? 'not checked' : (row.ok ? 'holds' : 'FAILS')) + '</td><td class="mono">' +
        (row.failures === null ? '—' : root.Format.exact(row.failures)) + '</td></tr>';
    }).join(''));

    const biggest = gap.hard.reduce(function (best, row) {
      return row.clauses > best.clauses ? row : best;
    }, gap.hard[0]);
    root.Helpers.setText('rwk-hard-note',
      'The clause column is a useful surprise: the cheap-sounding requirements are the expensive ' +
      'ones. "' + biggest.text + '" costs ' + root.Format.exact(biggest.clauses) + ' clauses and ' +
      root.Format.exact(biggest.auxiliary) + ' auxiliary variables, because a cardinality ' +
      'constraint needs a counter and a counter is a grid of carry variables. The fourth column ' +
      'is the point of the section — it is produced by code that reads the finished grid and ' +
      'tests each requirement in the requirement’s own words, sharing nothing with the encoder. ' +
      'A row that says FAILS is an encoding bug, and it is the only way one becomes visible.');
  }

  function paintSoft(gap) {
    root.jQuery('#rwk-soft tbody').html(gap.soft.map(function (row) {
      return '<tr><td>' + row.text + '</td><td>' + row.why + '</td><td class="mono">' +
        row.achieved + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rwk-soft-note',
      'These are requirements from the same conversation as the ones above, and the model does ' +
      'not carry any of them. They are not oversights: a clause is a hard constraint and each of ' +
      'these is a preference, so encoding one as a clause would make feasible rosters infeasible ' +
      'and give no indication of why. The right-hand column is what this roster happens to ' +
      'achieve on each, computed but not optimised, and the spread in it is the honest measure ' +
      'of the gap between "satisfies the model" and "is a roster somebody would accept". ' +
      'Closing that gap means MaxSAT, an ILP objective, or a search over a fairness bound — ' +
      'which is a different tool, not a bigger formula.');
  }

  function paintFrontier(frontier) {
    root.jQuery('#rwk-frontier tbody').html(frontier.rows.map(function (row) {
      return '<tr><td class="mono">' + row.nurses + '</td><td class="mono">' +
        root.Format.exact(row.capacity) + '</td><td class="mono">' +
        root.Format.exact(row.required) + '</td><td class="mono">' +
        root.Format.exact(row.clauses) + '</td><td class="mono">' + verdict(row) +
        '</td><td class="mono">' + root.Format.exact(row.nodes) + '</td><td class="mono">' +
        root.Format.duration(row.millis) + '</td><td class="mono">' +
        (row.valid === null ? '—' : (row.valid ? 'yes' : 'NO — BUG')) + '</td></tr>';
    }).join(''));

    const exhausted = frontier.rows.filter(function (row) { return row.exhausted; });
    const proved = frontier.rows.filter(function (row) {
      return !row.feasible && !row.exhausted;
    });
    root.Helpers.setText('rwk-frontier-note', frontierNote(frontier, exhausted, proved));
  }

  function verdict(row) {
    if (row.feasible) return 'a roster exists';
    if (row.exhausted) return 'budget exhausted';
    return 'proved infeasible';
  }

  function frontierNote(frontier, exhausted, proved) {
    const counting = frontier.rows.filter(function (row) { return row.capacity < row.required; });

    return 'Three different answers appear in the fifth column and only two of them are claims. ' +
      root.Format.exact(counting.length) + ' rows have less capacity than the demand requires — ' +
      'a one-line counting argument any reader can check — and the solver PROVES it for ' +
      root.Format.exact(proved.length) + ' of them and runs out of budget on ' +
      root.Format.exact(exhausted.length) + '. Those two rows describe the same instance to a ' +
      'human and completely different situations to a caller: one says relax a requirement, the ' +
      'other says nothing at all. Treating "budget exhausted" as UNSAT is the mistake this ' +
      'section exists to prevent, and it is easy to make because both come back as "no answer". ' +
      'It is also why the counting check belongs in the code BEFORE the solver call: it is free, ' +
      'it is exact, and it catches the common case with a reason attached.';
  }

  function paintCatalogue() {
    root.jQuery('#rwk-catalogue tbody').html(CATALOGUE.map(function (row) {
      return '<tr><td>' + row.problem + '</td><td>' + row.formulation + '</td><td>' +
        row.assumes + '</td><td>' + row.diverges + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rwk-catalogue-note',
      'The third column is the one to read before writing any code. Every mapping in this table ' +
      'is standard and every one of them assumes something the requirements did not say — that ' +
      'costs are additive, that travel times are fixed, that a slot is interchangeable with any ' +
      'other. Those assumptions are usually fine, and when one is not, the symptom is a model ' +
      'that solves quickly and produces answers the domain experts reject for reasons they find ' +
      'hard to articulate. Note the third row especially: assignment is a POLYNOMIAL problem, ' +
      'and treating it as NP-hard because it feels like scheduling is the commonest ' +
      'misidentification in this table.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
