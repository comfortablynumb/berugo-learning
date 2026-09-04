/**
 * Section: decision problems, P, NP and certificates.
 *
 * The demo puts four columns beside each other and the section is the
 * comparison between the third and the fifth: verifying a certificate costs a
 * few dozen steps, searching a YES instance is sometimes cheap because the
 * search stumbles onto the planted answer, and searching a NO instance costs
 * thousands because nothing short of exhausting the space proves an answer is
 * absent.
 *
 * That asymmetry is the whole point, and it is the reason the demo generates
 * NO instances with a stated structural obstruction rather than by rejection
 * sampling: "there is no Hamiltonian cycle because vertex 11 has degree one"
 * is a fact a reader can check, and it makes the exhaustion honest rather
 * than a timeout.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'decision-problems';
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
      title: 'Diagram — P, NP, NP-complete and NP-hard, with the open question marked',
      caption: 'P is the problems a machine can SOLVE in polynomial time; NP is the problems ' +
        'whose YES answers it can CHECK in polynomial time given a certificate. Every problem ' +
        'in P is in NP — solve it and ignore the certificate — and whether the containment is ' +
        'strict is the open question. NP-hard means "at least as hard as everything in NP under ' +
        'polynomial-time reduction", which says nothing about being in NP: the halting problem ' +
        'is NP-hard and is not in NP at all. NP-complete is the intersection, and it is where ' +
        'SAT, clique, Hamiltonian cycle and the rest live. co-NP is the mirror — problems whose ' +
        'NO answers have short certificates — and NP = co-NP is a second open question that ' +
        'would follow from P = NP but is not known to be equivalent to it.',
      definition: [
        'flowchart TD',
        '    NPH["NP-hard<br/>at least as hard as all of NP"]',
        '    NP["NP<br/>YES answers checkable in polynomial time"]',
        '    P["P<br/>solvable in polynomial time"]',
        '    CONP["co-NP<br/>NO answers checkable"]',
        '    NPC["NP-complete<br/>SAT, clique, 3-colouring, subset sum"]',
        '    HALT["halting problem<br/>NP-hard, not in NP"]',
        '    NP --> NPC',
        '    NPH --> NPC',
        '    NPH --> HALT',
        '    P --> NP',
        '    P --> CONP',
        '    NP -.-> Q{"P = NP?<br/>open"}',
        '    CONP -.-> Q'
      ].join('\n')
    };
  }

  function orientationDefinitions() {
    return [
      '**A decision problem asks a yes-or-no question, and that is a restriction with no cost.** ' +
        '"What is the smallest vertex cover?" becomes "is there a vertex cover of size at most ' +
        'k?". The optimisation answer follows from a logarithmic number of calls to the decision ' +
        'one.',
      'The restriction is worth making because complexity theory is built on languages, meaning ' +
        'sets of strings.',
      'A decision problem *is* a language, so the whole apparatus becomes available for the price ' +
        'of a binary search over k.',
      '**NP is defined by checking, not by searching, and that is the definition that explains ' +
        'what these problems have in common.** A problem is in NP when every YES instance has a ' +
        'certificate — an assignment, a tour, a subset — that a polynomial-time verifier accepts.',
      'Every NO instance has none that it accepts.',
      'The demo runs both sides. The verifier costs a few dozen steps on every problem in the ' +
        'table, and the search costs thousands on the same instances.',
      '**The gap is not visible on YES instances.** A backtracking search on a graph with a ' +
        'planted Hamiltonian cycle often finds it almost immediately, because it wanders into the ' +
        'planted answer.',
      'The demo shows that column, and it is sometimes *smaller* than the verifier’s.',
      'The honest comparison is on the NO side, where the search has to exhaust its space to say ' +
        '"there is none" and the verifier’s cost has not moved at all.',
      '**A verifier must reject malformed certificates as firmly as wrong ones.** Consider a ' +
        'Hamiltonian certificate that repeats a vertex, a subset-sum certificate with an ' +
        'out-of-range index, or a colouring one entry short.',
      'Each has to be a rejection rather than a crash or an accidental accept, or "the verifier ' +
        'accepted" stops meaning anything.',
      'The demo feeds each verifier a corrupted certificate and a malformed one, and reports what ' +
        'came back.'
    ];
  }

  function orientationClasses() {
    return [
      '**co-NP is the mirror and it is not known to be the same class.** There is no known short ' +
        'certificate for "this formula is unsatisfiable", and the only general witness is a ' +
        'resolution proof, which can be exponentially long.',
      'That asymmetry is why a SAT solver answering SAT hands you an assignment you can check in a ' +
        'second. A solver answering UNSAT hands you either a proof file measured in gigabytes or ' +
        'nothing at all.',
      '**NP-hard and NP-complete are different claims and the difference matters.** NP-hard means ' +
        'everything in NP reduces to it. NP-complete means that *and* membership in NP.',
      'The halting problem is NP-hard and is not in NP, so "NP-hard" alone carries no promise that ' +
        'an answer can even be recognised, let alone found.',
      '**The practical reading of NP is "easy to check, hard to find", and whole industries live ' +
        'in that gap.** Proof-of-work is a puzzle whose solution is one hash to verify and 2⁷⁰ ' +
        'hashes to find.',
      'Verifiable computation, puzzle-based rate limiting and every commitment scheme are the same ' +
        'shape. The gap the demo measures is the product.',
      '**P versus NP is a question about certificates, not about cleverness.** It asks whether ' +
        'every problem whose answers can be checked quickly can also be *solved* quickly.',
      'Almost nobody expects the answer to be yes, and the reason to care is not the prize.',
      'It is that the question has resisted fifty years of attack. That is the strongest practical ' +
        'evidence available that a particular problem in front of you is not about to fall to a ' +
        'better algorithm.'
    ];
  }

  function orientation() {
    return orientationDefinitions().concat(orientationClasses());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — four verifiers, four searches, and the two sides of each problem',
        markup: root.DecisionProblemsTemplate.render()
      },
      diagram: diagram(),
      insight: '**When somebody says a problem is NP-complete, the useful follow-up is "what is ' +
        'the certificate?"** The answer tells you what to build. If a certificate exists and is ' +
        'short, you can always ship a *checker* even when you cannot ship a solver. A checker ' +
        'turns an unverifiable heuristic into an auditable one. That is the single highest-value ' +
        'move available in this whole area, and it costs an afternoon. Let the heuristic propose, ' +
        'let the verifier decide, and log every rejection. It converts "the optimiser produced a ' +
        'schedule" into "the optimiser produced a schedule that satisfies every stated ' +
        'constraint". That is a different sentence, and the only one worth putting in front of an ' +
        'operations team.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DecisionProblemsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const studyFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NpLab.certificateStudy({ size: Number(parts[0]), seed: Number(parts[1]) });
  });

  const sweepFor = root.Helpers.memoise(function () {
    return root.NpLab.costSweep({ from: 8, to: 15 });
  });

  function update(app) {
    const values = panel.values();
    const study = studyFor(values['dcp-size'] + '|' + values['dcp-seed']);
    const sweep = sweepFor('');

    paintMetrics(study);
    paintChart(app, sweep);
    paintCosts(study);
    paintRejection(study);
    paintSweep(sweep);
    paintProblems();
  }

  function paintMetrics(study) {
    const verify = Math.max.apply(null, study.rows.map(function (row) { return row.verifySteps; }));
    const search = Math.max.apply(null, study.rows.map(function (row) { return row.searchNoSteps; }));
    const rejected = study.rows.filter(function (row) {
      return row.wrongRejected && row.malformedRejected;
    }).length;

    root.MetricGrid.update({
      'dcp-verify': { value: root.Format.exact(verify),
        note: 'the most any of the four verifiers spent on a valid certificate' },
      'dcp-search': { value: root.Format.exact(search),
        note: 'the most any of the four searches spent proving there is no answer' },
      'dcp-gap': { value: root.Format.fixed(search / Math.max(1, verify), 0) + '×',
        note: 'and it grows without bound as the instance grows' },
      'dcp-rejects': { value: rejected * 2 + ' of ' + study.rows.length * 2,
        note: 'every corrupted and every malformed certificate must be refused' }
    });
  }

  function paintChart(app, sweep) {
    const host = root.jQuery('#dcp-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, logY: true, yMin: 1,
      xLabel: 'vertices', yLabel: 'steps (log scale)',
      series: [
        { label: 'verify a certificate', points: sweep.rows.map(function (row) {
          return { x: row.n, y: row.verify };
        }) },
        { label: 'search, planted YES instance', points: sweep.rows.map(function (row) {
          return { x: row.n, y: row.searchYes };
        }) },
        { label: 'search, obstructed NO instance', points: sweep.rows.map(function (row) {
          return { x: row.n, y: row.searchNo };
        }) }
      ]
    });

    const first = sweep.rows[0];
    const last = sweep.rows[sweep.rows.length - 1];
    root.Helpers.setText('dcp-chart-note',
      'Hamiltonian cycle at every size from ' + first.n + ' to ' + last.n + ' vertices. ' +
      'Verification goes from ' + root.Format.exact(first.verify) + ' steps to ' +
      root.Format.exact(last.verify) + ' — it is linear, and on a logarithmic axis a linear ' +
      'function is almost a flat line. The NO search goes from ' +
      root.Format.exact(first.searchNo) + ' to ' + root.Format.exact(last.searchNo) + ', a ' +
      'factor of about ' + root.Format.fixed(sweep.growth, 2) + ' per extra vertex. The middle ' +
      'curve is the same search on a graph that HAS a cycle, and it is far below the third — ' +
      'which is exactly why a demo that only ran YES instances would show nothing.');
  }

  function paintCosts(study) {
    root.jQuery('#dcp-costs tbody').html(study.rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' + row.certificate + '</td><td class="mono">' +
        root.Format.exact(row.verifySteps) + '</td><td class="mono">' +
        root.Format.exact(row.searchYesSteps) + '</td><td class="mono">' +
        root.Format.exact(row.searchNoSteps) + '</td><td class="mono">' +
        root.Format.fixed(row.ratioNo, 1) + '×</td><td>' + row.space + '</td></tr>';
    }).join(''));

    const cheapest = study.rows.reduce(function (best, row) {
      return row.searchYesSteps < best.searchYesSteps ? row : best;
    }, study.rows[0]);
    root.Helpers.setText('dcp-costs-note',
      'The fourth column is the one to argue with. On ' + cheapest.label.toLowerCase() +
      ' the search finds the planted answer in ' + root.Format.exact(cheapest.searchYesSteps) +
      ' steps, against ' + root.Format.exact(cheapest.verifySteps) + ' to verify one — the ' +
      'search is comparable to the check, and on a planted instance it is sometimes cheaper. ' +
      'Nothing about hardness is visible there. The fifth column is the same search on an ' +
      'instance built to have no answer, and it is the one that grows: the smallest ratio in ' +
      'the table is ' + root.Format.fixed(Math.min.apply(null, study.rows.map(function (row) {
        return row.ratioNo;
      })), 1) + '× and the largest is ' +
      root.Format.fixed(Math.max.apply(null, study.rows.map(function (row) {
        return row.ratioNo;
      })), 1) + '×. The last column is what the search would have to enumerate in the worst ' +
      'case, and it is why the numbers move the way they do.');
  }

  function paintRejection(study) {
    root.jQuery('#dcp-rejection tbody').html(study.rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' +
        (row.verifyAccepted ? 'accepted' : 'REJECTED — the fixture is broken') +
        '</td><td>' + verdict(row.wrongRejected, row.wrongReason) + '</td><td>' +
        verdict(row.malformedRejected, row.malformedReason) + '</td><td>' + row.reason +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('dcp-rejection-note',
      'Three certificates per problem: the planted one, the same one with a single value ' +
      'changed, and one that is not the right shape at all. The middle column is the easy ' +
      'case — a swapped pair of vertices breaks an edge and the walk notices. The third is the ' +
      'one implementations get wrong: a short array, an index past the end, a colour outside ' +
      'the palette. Each has to come back as a named rejection rather than an exception or an ' +
      'accidental accept, because a verifier is a security boundary the moment anything ' +
      'untrusted supplies the certificate — which is precisely the proof-of-work setting.');
  }

  function verdict(rejected, reason) {
    if (!rejected) return '<span class="mono">ACCEPTED — this is a bug</span>';
    return 'rejected: ' + (reason || 'no reason given');
  }

  function paintSweep(sweep) {
    root.jQuery('#dcp-sweep tbody').html(sweep.rows.map(function (row) {
      return '<tr><td class="mono">' + row.n + '</td><td class="mono">' +
        root.Format.exact(row.verify) + '</td><td class="mono">' +
        root.Format.exact(row.searchYes) + '</td><td class="mono">' +
        root.Format.exact(row.searchNo) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dcp-sweep-note',
      'The verifier column is 2n exactly: one pass to confirm the order is a permutation ' +
      'and one to confirm every consecutive pair is an edge. The NO column multiplies by about ' +
      root.Format.fixed(sweep.growth, 2) + ' per vertex. Those two sentences are the whole ' +
      'difference between P and NP as anybody actually experiences it.');
  }

  function paintProblems() {
    root.jQuery('#dcp-problems tbody').html(root.NpVerifiers.PROBLEMS.map(function (problem) {
      return '<tr><td>' + problem.label + '</td><td>' + problem.certificate +
        '</td><td class="mono">' + problem.verifyCost + '</td><td class="mono">' +
        problem.searchCost + '</td></tr>';
    }).join(''));

    root.Helpers.setText('dcp-problems-note',
      'Six problems, six certificate shapes, and every verification cost in the third column is ' +
      'a polynomial while every search cost in the fourth is not. That table IS the definition ' +
      'of NP: a problem belongs when a certificate of polynomial length exists and a ' +
      'polynomial-time verifier accepts exactly the YES instances. Note what is missing — there ' +
      'is no row for "this formula is unsatisfiable", because nobody knows a short certificate ' +
      'for it, and that missing row is co-NP.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
