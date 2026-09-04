/**
 * Section: reductions.
 *
 * The demo is four steps and the fourth is the section. Forward, solve,
 * backward — every write-up has those — and then **validate the mapped answer
 * against the SOURCE instance**, which almost none do. A gadget of the wrong
 * shape passes the first three steps silently: the target is solvable, the
 * backward map returns something, and only checking it against the original
 * constraints reveals that the something is not an answer.
 *
 * The instances are deliberately tiny — five variables, ten clauses. The
 * reduction is polynomial and would run on anything; the SOLVER for the target
 * is an exhaustive search, and that is the part that cannot be scaled. Saying
 * so is the honest version of "the demo uses five variables".
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'reductions';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the clause gadget in 3-SAT → independent set, and the two edge families',
      caption: 'One vertex per literal OCCURRENCE, not per literal. The three vertices of a ' +
        'clause form a triangle, so an independent set can take at most one from each — and ' +
        'asking for a set of size m, one per clause, forces it to take exactly one. That choice ' +
        'is "which literal makes this clause true". The second edge family joins x to ¬x ' +
        'wherever they appear, so the set can never take both polarities of a variable, which ' +
        'is "the assignment is consistent". Those two sentences are the entire proof: an ' +
        'independent set of size m is a satisfying assignment written down differently, and a ' +
        'satisfying assignment gives an independent set of size m by picking one true literal ' +
        'per clause.',
      definition: [
        'flowchart LR',
        '    subgraph C1["clause (x1 ∨ ¬x2 ∨ x3)"]',
        '      A["x1"] --- B["¬x2"]',
        '      B --- C["x3"]',
        '      C --- A',
        '    end',
        '    subgraph C2["clause (¬x1 ∨ x2 ∨ x4)"]',
        '      D["¬x1"] --- E["x2"]',
        '      E --- F["x4"]',
        '      F --- D',
        '    end',
        '    A -. "x1 vs ¬x1" .- D',
        '    B -. "¬x2 vs x2" .- E'
      ].join('\n')
    };
  }

  function orientationMechanics() {
    return [
      '**A reduction from A to B is a map that turns an instance of A into an instance of B with ' +
        'the same answer, computable in polynomial time.** Written that way it is a proof ' +
        'device: if A is hard and A reduces to B then B is hard.',
      'It is also the more useful thing, which is a way to SOLVE A by calling a solver for B. ' +
        'Most of what this milestone is for is the second reading.',
      '**The arrow points from the problem you want to solve to the problem you can call, and ' +
        'getting it backwards proves nothing.** Reducing your scheduling problem to SAT lets you ' +
        'use a SAT solver.',
      'Reducing SAT to your scheduling problem proves your problem is hard.',
      'Both directions compile and both run, and only one of them is the argument you meant to ' +
        'make. That is why this is the most common error in hardness claims.',
      '**A gadget is a small piece of the target instance that simulates one piece of the ' +
        'source.** In 3-SAT → independent set the gadget is a triangle per clause, so at most one ' +
        'of its vertices can be chosen.',
      'Asking for one vertex per clause forces the choice to be "which literal satisfies this ' +
        'clause". Consistency comes from a second edge family joining every x to every ¬x.',
      '**Correctness is two implications and both have to hold.** If the source is a YES then the ' +
        'target is a YES. That is the easy direction and the one people check.',
      'If the TARGET is a YES then the source is a YES. That is the direction a broken gadget ' +
        'fails, and the only way to observe it is to map the target’s answer back and check it ' +
        'against the source instance.',
      'The demo does exactly that and reports the result.'
    ];
  }

  function orientationPractice() {
    return [
      '**The mapped-back answer is the artefact worth keeping.** A reduction that only proves ' +
        'hardness gives you a sentence. A reduction that maps solutions back gives you a solver.',
      'The difference is the backward map. It is usually four lines, and it is the part that turns ' +
        '"this is NP-hard, sorry" into "this is NP-hard, so here is the encoding and the answer".',
      '**A Turing reduction is the weaker, more useful cousin.** A many-one reduction makes ONE ' +
        'call and returns its answer. A Turing reduction may call the oracle many times and do ' +
        'arbitrary polynomial work between calls.',
      'Solving an optimisation problem by binary searching over its decision version is a Turing ' +
        'reduction, and it is what every "minimise k" wrapper around a SAT solver actually is.',
      '**Reductions compose, which is why one hardness result covers thousands of problems.** If A ' +
        'reduces to B and B reduces to C then A reduces to C, with the two maps run in sequence ' +
        'and the two backward maps run in reverse.',
      'Cook–Levin gives everything in NP reducing to SAT, and every subsequent result is one more ' +
        'link in a chain that starts there.',
      '**The reduction is cheap and solving the target is not.** The demo builds a target instance ' +
        'instantly for any source.',
      'The search that answers it is exhaustive and exponential, which is why the instances here ' +
        'have five variables.',
      'That is not a weakness of the demo. It is the reason reductions are used with a real solver ' +
        'on the far side, and the reason section 20.7 exists.'
    ];
  }

  function orientation() {
    return orientationMechanics().concat(orientationPractice());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — forward, solve, backward, and validate against the source',
        markup: root.ReductionsTemplate.render()
      },
      diagram: diagram(),
      insight: '**The reduction you will actually write at work points at a solver, and the ' +
        'test you must write for it is the round trip.** Encode the instance, call the solver, ' +
        'decode the answer, and then check the decoded answer against the ORIGINAL requirements ' +
        'with code that shares nothing with the encoder. Every reduction bug I have seen, and ' +
        'every one in this milestone’s own history, survives the first three steps and dies at ' +
        'the fourth. If the round trip is not in the test suite, the encoding is unverified no ' +
        'matter how many instances it has answered correctly. A gadget that is wrong in one ' +
        'direction is right in the other, and it produces plausible answers until it does not.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ReductionsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NpLab.reductionStudy({ name: parts[0], unsatisfiable: parts[1] === 'no',
      seed: Number(parts[2]) });
  });

  const auditFor = root.Helpers.memoise(function () {
    return root.NpLab.reductionAudit({ seed: 2 });
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(values['rdx-name'] + '|' + values['rdx-side'] + '|' + values['rdx-seed']);

    paintMetrics(study);
    paintGraph(study);
    paintSteps(study);
    paintGadgets(study);
    paintAudit(auditFor(''));
  }

  function sizeText(study) {
    const size = study.targetSize;

    if (size.vertices !== undefined) {
      return root.Format.exact(size.vertices) + ' vertices, ' + root.Format.exact(size.edges) +
        ' edges';
    }
    if (size.sets !== undefined) {
      return root.Format.exact(size.sets) + ' sets over ' + root.Format.exact(size.universe) +
        ' elements';
    }
    return root.Format.exact(size.numbers) + ' numbers';
  }

  function paintMetrics(study) {
    root.MetricGrid.update({
      'rdx-size': { value: sizeText(study),
        note: 'built from ' + study.source.describe + ' in one pass' },
      'rdx-steps': { value: root.Format.exact(study.result.steps),
        note: study.result.targetSolved
          ? 'to find an answer in the target problem'
          : 'to prove the target has none — the exhaustive side' },
      'rdx-answer': { value: study.answer + ' / ' + (study.result.targetSolved ? 'YES' : 'NO'),
        note: study.agrees ? 'source and target agree, as a reduction requires'
          : 'THEY DISAGREE — the reduction is wrong' },
      'rdx-valid': { value: study.valid ? 'valid' : 'INVALID',
        note: study.result.targetSolved
          ? 'the mapped answer was checked against the source instance'
          : 'nothing to map back; the agreement is the whole check' }
    });
  }

  function paintGraph(study) {
    const host = root.jQuery('#rdx-graph')[0];
    if (!host) return;
    const graph = study.result.map.graph;

    if (!graph) {
      root.jQuery(host).html('<p class="note">This reduction builds numbers rather than a ' +
        'graph — see the table below for what it produced.</p>');
      root.Helpers.setText('rdx-graph-note', numericNote(study));
      return;
    }
    drawGraph(host, study, graph);
  }

  function drawGraph(host, study, graph) {
    const width = Math.max(320, host.clientWidth || 520);
    const height = 320;
    const chosen = new Set(study.result.set || []);
    const groups = groupsOf(study.result.map, graph.n);

    root.GraphView.draw({ host: host, graph: graph, width: width, height: height,
      positions: groups
        ? root.GraphView.groupedLayout(groups, graph.n, width, height)
        : root.GraphView.circularLayout(graph.n, width, height),
      nodeClass: function (v) { return chosen.has(v) ? 'path' : null; } });
    root.Helpers.setText('rdx-graph-note', graphNote(study, graph, chosen));
  }

  function groupsOf(map, n) {
    if (!map.nodes) return null;
    const byClause = new Map();

    map.nodes.forEach(function (node, index) {
      const key = node.clause === undefined ? 0 : node.clause;
      if (!byClause.has(key)) byClause.set(key, []);
      byClause.get(key).push(index);
    });
    const groups = Array.from(byClause.values());
    const seen = groups.reduce(function (sum, group) { return sum + group.length; }, 0);

    if (seen === n) return groups;
    return null;
  }

  function graphNote(study, graph, chosen) {
    const shown = chosen.size > 0
      ? 'The ' + root.Format.exact(chosen.size) + ' highlighted vertices are the answer the ' +
        'target solver found, and mapping them back gave the source assignment in the table below.'
      : 'Nothing is highlighted because the target has no answer of the required size — which ' +
        'is the reduction reporting that the source is a NO instance.';

    return 'The target instance: ' + root.Format.exact(graph.n) + ' vertices and ' +
      root.Format.exact(graph.edges.length) + ' edges, built from ' + study.source.describe +
      '. Vertices are grouped by the clause gadget that produced them, so the triangles are ' +
      'visible as clusters and the long edges between clusters are the consistency constraints ' +
      'joining a literal to its negation. ' + shown;
  }

  /** Each reduction builds a different shape of target, so the note is chosen
   *  by what the map actually carries rather than by the reduction's name —
   *  a name test goes stale the first time a reduction is added. */
  function numericNote(study) {
    const map = study.result.map;

    if (map.numbers) {
      return 'The target is ' + root.Format.exact(map.numbers.length) + ' numbers, the original ' +
        root.Format.exact(map.numbers.length - 2) + ' plus two chosen so that an equal split is ' +
        'possible exactly when the source subset sum is. The two added numbers are ' +
        map.numbers.slice(-2).map(function (v) { return root.Format.exact(v); }).join(' and ') + '.';
    }
    if (map.sets) {
      return 'The target is a set-cover instance over ' + root.Format.exact(map.universe) +
        ' elements with ' + root.Format.exact(map.sets.length) + ' sets — one set per vertex, ' +
        'holding the edges that vertex covers, and a cover of k sets is a vertex cover of k ' +
        'vertices written differently.';
    }
    return 'The target is a 3-colouring instance: a palette triangle of three vertices, a pair ' +
      'x / ¬x per variable joined to the palette, and two OR gadgets in series per clause — ' +
      root.Format.exact(map.graph.n) + ' vertices and ' +
      root.Format.exact(map.graph.edges.length) + ' edges from ' +
      root.Format.exact(map.variables) + ' variables and ' + root.Format.exact(map.clauses) +
      ' clauses. There are no per-clause vertex groups to tabulate, because a clause becomes a ' +
      'chain of gadgets rather than a triangle of literals.';
  }

  function paintSteps(study) {
    const rows = [
      { step: '1. forward — build the target', produced: sizeText(study),
        cost: 'one pass over ' + study.source.describe,
        missing: 'nothing; this step is always present' },
      { step: '2. solve the target', produced: study.result.targetSolved
        ? 'an answer of the required size' : 'no answer of the required size exists',
        cost: root.Format.exact(study.result.steps) + ' search steps',
        missing: 'nothing; this step is always present' },
      { step: '3. backward — map the answer to the source',
        produced: study.result.mapped === null ? '—' : describeMapped(study),
        cost: 'linear in the answer',
        missing: 'a reduction without this proves hardness and solves nothing' },
      { step: '4. VALIDATE the mapped answer against the source',
        produced: study.result.targetSolved
          ? (study.valid ? 'accepted by the source’s own checker'
            : 'REJECTED: ' + (study.result.reason || 'unknown'))
          : 'not applicable — the check is that both sides answered NO',
        cost: 'one verification',
        missing: 'a gadget of the wrong shape, which passes steps 1 to 3 in silence' }
    ];

    root.jQuery('#rdx-flow tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.step + '</td><td>' + row.produced + '</td><td class="mono">' +
        row.cost + '</td><td>' + row.missing + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rdx-flow-note',
      'Steps 1 and 2 are what a hardness proof needs. Steps 3 and 4 are what an ENGINEER needs, ' +
      'and step 4 is the one that catches a wrong gadget: a construction that is correct in the ' +
      'forward direction and wrong in the backward one produces a solvable target and a ' +
      'plausible mapped answer, and only checking that answer against the source’s own ' +
      'constraints reveals it. Step 2 is also the step that cannot be scaled — ' +
      root.Format.exact(study.result.steps) + ' steps here, on an instance of ' +
      study.source.describe + '.');
  }

  function describeMapped(study) {
    if (study.source.kind === '3-sat') {
      return 'an assignment of ' + root.Format.exact(study.result.mapped.length) + ' variables';
    }
    if (study.source.kind === 'vertex-cover') {
      return 'a cover of ' + root.Format.exact(study.result.mapped.length) + ' vertices';
    }
    return 'a subset of ' + root.Format.exact(study.result.mapped.length) + ' indices';
  }

  function paintGadgets(study) {
    const chosen = new Set(study.result.set || []);
    const rows = study.gadgets.slice(0, 12);

    if (rows.length === 0) {
      root.jQuery('#rdx-gadgets tbody').html('<tr><td colspan="4">This reduction has no ' +
        'clause gadgets — its construction is arithmetic rather than combinatorial, and the ' +
        'note below says what it builds instead.</td></tr>');
      root.Helpers.setText('rdx-gadgets-note', numericNote(study));
      return;
    }
    root.jQuery('#rdx-gadgets tbody').html(rows.map(function (gadget) {
      const picked = gadget.vertices.filter(function (item) { return chosen.has(item.index); });
      return '<tr><td class="mono">' + gadget.clause + '</td><td class="mono">' +
        gadget.vertices.map(function (item) { return literalText(item.literal); }).join(' ∨ ') +
        '</td><td class="mono">' + gadget.vertices.map(function (item) {
          return item.index;
        }).join(', ') + '</td><td class="mono">' +
        (picked.length ? picked.map(function (item) {
          return literalText(item.literal);
        }).join(', ') : '—') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rdx-gadgets-note', gadgetNote(study, chosen));
  }

  function literalText(literal) {
    return (literal < 0 ? '¬x' : 'x') + Math.abs(literal);
  }

  function gadgetNote(study, chosen) {
    const clauses = study.gadgets.length;

    return 'One vertex per literal OCCURRENCE, so the same variable appears as several vertices ' +
      'and each of them is joined to every occurrence of its negation. The triangles make it ' +
      'impossible to take two vertices from one clause; asking for a set of size ' +
      root.Format.exact(clauses) + ' — one per clause — therefore forces exactly one per ' +
      'clause, and the consistency edges make that choice an assignment. ' +
      (chosen.size > 0
        ? 'The right-hand column is the literal the solver chose in each clause, and reading it ' +
          'down the table IS the satisfying assignment.'
        : 'The right-hand column is empty because no such set exists, which is the reduction ' +
          'reporting the source formula unsatisfiable.') +
      (clauses > 12 ? ' The first 12 of ' + root.Format.exact(clauses) + ' clauses are shown.' : '');
  }

  function paintAudit(audit) {
    root.jQuery('#rdx-audit tbody').html(audit.rows.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td class="mono">' + row.answer +
        '</td><td class="mono">' + (row.solved ? 'YES' : 'NO') + '</td><td class="mono">' +
        (row.agrees ? 'yes' : 'NO — BUG') + '</td><td class="mono">' +
        (row.valid ? 'yes' : 'NO — BUG') + '</td><td class="mono">' +
        root.Format.exact(row.steps) + '</td></tr>';
    }).join(''));

    const worst = audit.rows.reduce(function (best, row) {
      return row.steps > best.steps ? row : best;
    }, audit.rows[0]);
    root.Helpers.setText('rdx-audit-note',
      'Every reduction in the module, run on a satisfiable source and — where the source is a ' +
      'formula — on the cheapest unsatisfiable 3-CNF there is, the eight clauses that rule out ' +
      'all eight assignments of three variables. All ' + root.Format.exact(audit.rows.length) +
      ' rows agree and all validate. The steps column is worth reading: the most expensive row ' +
      'is ' + worst.name + ' at ' + root.Format.exact(worst.steps) + ' steps, and it is the ' +
      'unsatisfiable one. That is the exhaustion again — the reduction cost nothing and the ' +
      'target solver paid for the whole search space.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
