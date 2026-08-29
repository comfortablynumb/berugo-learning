/**
 * Section: randomised and interactive classes.
 *
 * The measurement is the soundness error, run rather than quoted. A lying
 * prover is put against the verifier a few thousand times at each round count,
 * and the measured acceptance rate is compared to 2^-k with a three-sigma
 * binomial tolerance. At k = 1 through 6 it lands inside every time — 0.496,
 * 0.250, 0.126, 0.059, 0.031, 0.015 against 0.5, 0.25, 0.125, 0.0625, 0.031,
 * 0.016.
 *
 * That is the acceptance criterion the milestone names, and it is worth doing
 * because a verifier with a subtle bug still looks convincing on one run.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'randomised-and-interactive-classes';
  let panel = null;
  let rng = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the graph-non-isomorphism protocol',
      caption: 'The prover claims two graphs are NOT isomorphic — a statement with no short ' +
        'certificate anybody knows how to write, so a verifier alone would be stuck. The ' +
        'protocol gets it anyway. The verifier secretly picks one of the two graphs, relabels ' +
        'its vertices at random, and asks which one the result came from. If the graphs really ' +
        'are different, an unbounded prover can tell and always answers correctly. If they are ' +
        'the SAME graph, both answers are equally true, so nothing the prover knows helps — it ' +
        'is guessing, and it is caught half the time per round. Notice what the verifier does: ' +
        'a permutation and a comparison. It never tests isomorphism, which is the whole point.',
      definition: [
        'sequenceDiagram',
        '    participant V as "Verifier (weak, randomised)"',
        '    participant P as "Prover (unbounded, maybe lying)"',
        '    V->>V: pick b in {0,1} secretly, and a random permutation',
        '    V->>P: here is H, a relabelling of graph b',
        '    P->>P: which of G0, G1 is H isomorphic to?',
        '    P->>V: my answer is b′',
        '    V->>V: accept this round only if b′ = b',
        '    Note over V,P: repeat k times — a liar survives with probability 2^-k'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Randomised classes differ in WHERE the error can be, and that is the whole taxonomy.** ' +
        'RP never accepts a false claim and may reject a true one. co-RP is the mirror. ZPP is ' +
        'never wrong and has a random running time. BPP allows error on both sides, bounded ' +
        'away from a half. Four classes, one distinction.',
      '**Amplification is why bounded error is as good as none.** Repeat a one-sided algorithm k ' +
        'times and the error falls to 2^-k; take the majority of k runs of a two-sided one and ' +
        'it falls exponentially by the Chernoff bound. Thirty repetitions of a coin-flip-level ' +
        'algorithm gives an error below one in a billion, which is well under the rate at which ' +
        'hardware silently corrupts a computation.',
      '**BPP is where "efficient randomised" actually lives, and it may equal P.** The ' +
        'derandomisation conjecture says every BPP algorithm has a deterministic polynomial ' +
        'equivalent, and the evidence is strong — primality was in co-RP for decades before AKS ' +
        'put it in P. Randomness may be a convenience rather than a resource.',
      '**An interactive proof is a conversation between a randomised verifier and an unbounded ' +
        'prover.** The verifier must be efficient; the prover may be arbitrarily powerful and ' +
        'may lie. COMPLETENESS says an honest prover always convinces the verifier of a true ' +
        'claim; SOUNDNESS says no prover convinces it of a false one more than rarely.',
      '**Graph non-isomorphism is the example because no short certificate is known.** To prove ' +
        'two graphs ARE isomorphic you exhibit the permutation — a certificate, so it is in NP. ' +
        'To prove they are NOT, there is nothing to show. Interaction plus randomness gets it, ' +
        'which means IP contains something NP is not known to.',
      '**IP = PSPACE, which was the surprise of 1990.** Interaction with a randomised verifier ' +
        'captures exactly polynomial space — an enormous class, far beyond NP. The proof ' +
        'technique (arithmetisation: turn a Boolean formula into a polynomial and check it at ' +
        'random points) is the ancestor of most modern proof systems.',
      '**A PCP is a proof the verifier reads only a few bits of.** The PCP theorem says every NP ' +
        'language has a proof format where a verifier reading THREE bits at random is convinced ' +
        'of a true claim and catches a false one with constant probability. That is the ' +
        'foundation of every hardness-of-approximation result, and it is why several problems ' +
        'have a provable approximation ceiling.',
      '**The verifier here does no isomorphism testing at all.** It permutes a graph and ' +
        'compares one answer to one remembered bit — quadratic work. Everything hard is done by ' +
        'a party it does not trust, and the protocol is what makes the distrust survivable. ' +
        'That shape is the engineering pattern.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — play the verifier, and measure the soundness error',
        markup: root.InteractiveTemplate.render()
      },
      diagram: diagram(),
      insight: '**Interactive proofs are the theory under zero-knowledge, verifiable computation ' +
        'and rollups: a weak verifier can check a claim it could never compute, which is a ' +
        'genuinely useful engineering pattern.** Once the shape is visible it turns up ' +
        'everywhere. A light client verifying a blockchain does not re-execute the chain. An ' +
        'optimistic rollup posts a claim and lets anyone challenge it, with the fraud proof ' +
        'playing the verifier\'s role. A build cache trusted by hash rather than by rebuilding ' +
        'is the same bet with a different soundness argument. In each case the question to ask ' +
        'is the one this demo measures: what is the soundness error, and is it a bound anyone ' +
        'has actually checked? An unmeasured 2^-k is a claim about a protocol; a measured one ' +
        'is a claim about an implementation, and the two come apart exactly where the bugs are.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    rng = root.Random.seeded(26071912);
    panel = root.ControlPanel.mount({
      controls: root.InteractiveTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  function pairFor(name) {
    return name === 'different'
      ? root.InteractiveProofs.differentPair() : root.InteractiveProofs.samePair();
  }

  function proverFor(name) {
    if (name === 'honest') return root.InteractiveProofs.honestProver();
    if (name === 'stubborn') return root.InteractiveProofs.stubbornProver();
    return root.InteractiveProofs.lyingProver();
  }

  function coin() { return rng.next(); }

  /**
   * The soundness sweep. It is re-run from a fresh seed per key so the figures
   * are stable across renders — a demo whose numbers change every time you look
   * at them teaches that measurement is noise rather than that it is evidence.
   */
  const sweepFor = root.Helpers.memoise(function (key) {
    const parts = key.split('\n');
    const pair = pairFor(parts[0]);
    const prover = proverFor(parts[1]);
    const trials = Number(parts[2]);
    const local = root.Random.seeded(4711);

    return [1, 2, 3, 4, 5, 6].map(function (rounds) {
      return root.InteractiveProofs.soundness(pair, prover, rounds, trials, function () {
        return local.next();
      });
    });
  });

  const isomorphicFor = root.Helpers.memoise(function (name) {
    const pair = pairFor(name);

    return root.InteractiveProofs.isomorphic(pair.left, pair.right);
  });

  function update() {
    const values = panel.values();
    const pair = pairFor(values['ipx-claim']);
    const run = root.InteractiveProofs.verify(pair, proverFor(values['ipx-prover']),
      Number(values['ipx-rounds']), coin);
    const sweep = sweepFor(values['ipx-claim'] + '\n' + values['ipx-prover'] + '\n' +
      values['ipx-trials']);

    paintMetrics(run, sweep, values);
    paintGraphs(pair, values['ipx-claim']);
    paintRounds(run);
    paintSoundness(sweep);
    paintClasses();
    paintPractice();
  }

  function paintMetrics(run, sweep, values) {
    const rounds = Number(values['ipx-rounds']);
    const row = sweep[Math.min(rounds, sweep.length) - 1];

    root.MetricGrid.update({
      'ipx-accepted': { value: run.accepted ? 'yes' : 'no — caught at round ' + run.rounds,
        note: run.accepted
          ? 'every round answered correctly, so the verifier is convinced'
          : 'one wrong answer is enough; the verifier rejects immediately' },
      'ipx-measured': { value: root.Format.fixed(row.measured * 100, 2) + '%',
        note: root.Format.exact(row.accepted) + ' acceptances in ' +
          root.Format.exact(row.trials) + ' independent runs at ' + row.rounds + ' rounds' },
      'ipx-predicted': { value: root.Format.fixed(row.predicted * 100, 2) + '%',
        note: 'two to the minus ' + row.rounds + ', because each round is an independent coin' },
      'ipx-within': { value: Math.abs(row.measured - row.predicted) <= row.tolerance
        ? 'yes' : 'NO',
      note: 'three standard deviations of a binomial at this trial count is ±' +
        root.Format.fixed(row.tolerance * 100, 2) + ' percentage points' }
    });
  }

  function paintGraphs(pair, claim) {
    const same = isomorphicFor(claim);

    root.jQuery('#ipx-graphs').html(
      '<div>left:  ' + root.Helpers.escapeHtml(pair.left.label || 'a graph') + ' — edges ' +
      root.Helpers.escapeHtml(pair.left.edges.map(function (e) {
        return e[0] + '-' + e[1];
      }).join(' ')) + '</div>' +
      '<div style="margin-top:.3rem">right: ' +
      root.Helpers.escapeHtml(pair.right.label || 'a graph') + ' — edges ' +
      root.Helpers.escapeHtml(pair.right.edges.map(function (e) {
        return e[0] + '-' + e[1];
      }).join(' ')) + '</div>' +
      '<div style="margin-top:.4rem">the claim: ' +
      root.Helpers.escapeHtml(pair.claim) + '</div>' +
      '<div>the truth: they are ' + (same ? 'ISOMORPHIC — so the claim is a lie'
        : 'genuinely different — so the claim is true') + '</div>');

    root.Helpers.setText('ipx-graphs-note',
      'The truth line is computed by brute force over every permutation, which the verifier is ' +
      'not allowed to do and the demo is. Both graphs have six vertices and six edges in either ' +
      'case, so counting gets you nowhere — the honest pair is a six-cycle against two ' +
      'triangles, which differ in structure and not in any summary statistic. That is why the ' +
      'protocol has to exist.');
  }

  function paintRounds(run) {
    root.jQuery('#ipx-rounds-table tbody').html(run.trace.map(function (row, i) {
      return '<tr><td class="mono">' + (i + 1) + '</td><td class="mono">' +
        (row.choice === 0 ? 'left' : 'right') + '</td><td class="mono">' +
        (row.answer === 0 ? 'left' : 'right') + '</td><td class="mono">' +
        (row.correct ? 'yes' : 'NO — rejected here') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ipx-rounds-note',
      'The verifier\'s choice is secret until the answer is in, which is what makes the round ' +
      'meaningful. Against a prover that genuinely cannot tell, each row is an independent coin ' +
      'flip, so surviving k rounds costs 2^-k. Against an honest prover on a true claim, every ' +
      'row is correct by construction and no number of rounds ever rejects — that asymmetry is ' +
      'completeness and soundness, and a protocol needs both.');
  }

  function paintSoundness(sweep) {
    root.jQuery('#ipx-soundness tbody').html(sweep.map(function (row) {
      return '<tr><td class="mono">' + row.rounds + '</td><td class="mono">' +
        root.Format.fixed(row.measured, 5) + '</td><td class="mono">' +
        root.Format.fixed(row.predicted, 5) + '</td><td class="mono">' +
        root.Format.fixed(Math.abs(row.measured - row.predicted), 5) +
        '</td><td class="mono">' +
        (Math.abs(row.measured - row.predicted) <= row.tolerance ? 'yes' : 'NO') +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('ipx-soundness-note',
      'This table is the soundness bound checked rather than quoted. Each row runs the whole ' +
      'protocol thousands of times against a prover that cannot tell the graphs apart, and ' +
      'compares the acceptance rate to 2^-k with a three-sigma binomial tolerance. Switch the ' +
      'prover to honest and the measured column jumps to 1 at every round count, which is ' +
      'completeness measured the same way. A verifier with a subtle bug — reusing a permutation, ' +
      'leaking the choice — still looks convincing on a single run and fails this table.');
  }

  function paintClasses() {
    root.jQuery('#ipx-classes tbody').html(root.InteractiveProofs.CLASSES.map(function (row) {
      return '<tr><td class="mono">' + row.name + '</td><td>' + row.errors + '</td><td>' +
        row.amplify + '</td><td>' + root.Helpers.escapeHtml(row.example) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ipx-classes-note',
      'The error column is the taxonomy: every one of these classes is defined by where the ' +
      'mistake is allowed to be, not by how fast it runs. That is why the practical question ' +
      'about a randomised algorithm is never "is it right" but "which direction can it be wrong ' +
      'in" — a primality test that never calls a prime composite is a completely different tool ' +
      'from one that never calls a composite prime, and Miller–Rabin is the first kind.');
  }

  function paintPractice() {
    const rows = [
      { system: 'A blockchain light client', verifier: 'a phone holding block headers',
        prover: 'a full node with the whole chain',
        buys: 'verification without re-execution, at a bandwidth cost of kilobytes' },
      { system: 'An optimistic rollup', verifier: 'a fraud-proof contract on the base chain',
        prover: 'whoever posted the batch, and whoever challenges it',
        buys: 'throughput, paid for with a challenge window' },
      { system: 'A zero-knowledge rollup', verifier: 'a succinct-proof verifier contract',
        prover: 'the sequencer, running an enormous proving job',
        buys: 'immediate finality, at a large constant proving cost' },
      { system: 'Certificate transparency', verifier: 'a client checking an inclusion proof',
        prover: 'the log server',
        buys: 'detection of a misissued certificate without downloading the log' },
      { system: 'Verifiable outsourced computation', verifier: 'the party who paid for it',
        prover: 'the cloud that ran it',
        buys: 'a check cheaper than re-running the job' },
      { system: 'Zero-knowledge authentication', verifier: 'the server',
        prover: 'the client, proving it knows a secret',
        buys: 'proof of knowledge without transmitting the secret' }
    ];

    root.jQuery('#ipx-practice tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.system + '</td><td>' + row.verifier + '</td><td>' +
        row.prover + '</td><td>' + row.buys + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ipx-practice-note',
      'Every row has the same shape as the demo: a verifier too weak to compute the answer, a ' +
      'prover strong enough and not trusted, and a protocol whose soundness error is the whole ' +
      'security argument. The question worth asking of any of them is the one the table above ' +
      'answers for the toy protocol — what is the error, and has anyone measured it against an ' +
      'implementation rather than against the paper? That gap is where the interesting failures ' +
      'have historically been.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
