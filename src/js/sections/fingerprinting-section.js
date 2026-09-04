/**
 * Section: fingerprinting.
 *
 * One idea, three instances, and the same measurement each time: evaluate both
 * sides of a claimed identity at a random point, and read off how often a lie
 * survives.
 *
 * The number that makes the section is the false-alarm column. It is zero in
 * every row of every table, at every round count and every field size, and it
 * is zero for a structural reason rather than by luck: a true identity holds
 * at every point, so no draw can refute it. That is what one-sided error means
 * concretely, and it is why repetition here is pure gain with nothing to tune
 * - the only cost of another round is another round.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'fingerprinting';
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
      title: 'Diagram — checking a matrix product without computing one',
      caption: 'Multiplying A by B costs n³ with the schoolbook algorithm and n^2.807 with ' +
        'Strassen. Checking a claimed C costs n² whatever algorithm produced it, because ' +
        'A(Bx) is three matrix–vector products rather than a matrix–matrix one. The identity ' +
        'being tested is (AB − C)x = 0: if AB ≠ C then AB − C has a non-zero row, and a random ' +
        'x over {0, 1} makes that row’s dot product non-zero with probability at least a half. ' +
        'Nothing about the argument depends on how C was produced, which is exactly why ' +
        'verification composes with untrusted computation.',
      definition: [
        'flowchart LR',
        '    A["claimed: A · B = C"] --> B["draw x in {0,1}^n"]',
        '    B --> C["left = A(Bx)<br/>two mat-vec: 2n^2"]',
        '    B --> D["right = Cx<br/>one mat-vec: n^2"]',
        '    C --> E{"left = right ?"}',
        '    D --> E',
        '    E -- no --> F["REJECT<br/>always correct"]',
        '    E -- yes --> G["accept this round<br/>wrong with prob <= 1/2"]',
        '    G --> B'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Verifying an answer can be asymptotically cheaper than producing it.** Freivalds checks a ' +
        'claimed matrix product in O(n²) by comparing A(Bx) against Cx for a random 0/1 vector x.',
      'Producing the product costs at best n^2.807, and checking it costs n² whatever produced it.',
      'The demo shows the two operation counts side by side, and the gap widens with n because one ' +
        'is cubic and the other quadratic.',
      '**The whole family is one lemma.** A non-zero polynomial of total degree d over a field has ' +
        'at most d/|F| of the field as roots, which is Schwartz–Zippel.',
      'So evaluating both sides of a false identity at a random point catches it with probability ' +
        'at least 1 − d/|F|.',
      'Freivalds is that lemma with the polynomial being the bilinear form (AB − C)x. A string ' +
        'fingerprint is that lemma with the string read as a polynomial’s coefficients.',
      '**The error is one-sided, and that is worth more than the constant.** A true identity holds ' +
        'at every point, so the test never rejects a correct claim.',
      'The false-alarm column in every table on this page is structurally zero.',
      'Repetition therefore has no trade-off. Each round multiplies the failure probability ' +
        'without any risk of accumulating false positives.',
      '**The field size is the dial, and it must be chosen against the degree.** The bound is ' +
        'd/|F|, so a degree-3 identity over ℤ mod 101 is caught only 97% of the time per round.',
      'The same identity over a 32-bit prime is caught essentially always.',
      'Testing over a field smaller than the degree proves nothing at all, which is the mistake ' +
        'behind every "I tried a few values and it worked".',
      '**A fingerprint is a random hash, and a fixed base is not a fingerprint.** Comparing two ' +
        'strings by one field element works because the base is drawn at random after the strings ' +
        'are fixed.',
      'With a fixed base, an adversary constructs a collision offline and the n/p bound describes ' +
        'nothing.',
      'This is the same argument as universal hashing in 3.2, arriving from the polynomial side.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — a corrupted product, two identities and a Merkle path',
        markup: root.FingerprintingTemplate.render()
      },
      diagram: diagram(),
      insight: '**"Trust but verify" is a cost argument, not a slogan, and this section is where ' +
        'it gets its numbers.** Every distributed protocol that accepts work from a machine it ' +
        'does not control rests on verification being cheaper than recomputation. A Merkle proof ' +
        'is a logarithmic number of hashes against re-downloading the object, and Freivalds is n² ' +
        'against n³. The habit worth taking away is smaller and more immediate. **When you have ' +
        'an expensive computation and a claimed result, look for an identity the result must ' +
        'satisfy before you look for a second implementation.** A residual check on a linear ' +
        'solve, a checksum on a rebuilt index, a random spot-check of a migration: all of them ' +
        'are this lemma. All of them cost a fraction of the thing they check.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.FingerprintingTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const freivaldsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.RandomizedLab.freivaldsStudy({ size: Number(parts[0]), cells: Number(parts[1]),
      trials: 4000, maxRounds: 8, seed: 4 });
  });

  const identityFor = root.Helpers.memoise(function () {
    return root.RandomizedLab.identityStudy({ trials: 2000 });
  });

  const stringsFor = root.Helpers.memoise(function () {
    return root.RandomizedLab.fingerprintStudy({ length: 5000, trials: 4000, roots: 8, seed: 12 });
  });

  function update(app) {
    const values = panel.values();
    const freivalds = freivaldsFor(values['frv-size'] + '|' + values['frv-cells']);
    const identity = identityFor('');
    const strings = stringsFor('');

    paintMetrics(freivalds, strings);
    paintChart(app, freivalds);
    paintRounds(freivalds);
    paintIdentity(identity, Number(values['frv-field']));
    paintStrings(strings);
    paintMerkle(strings);
  }

  function paintMetrics(freivalds, strings) {
    const first = freivalds.rows[0];
    const alarms = freivalds.rows.reduce(function (a, row) { return a + row.falseAlarms; }, 0);
    root.MetricGrid.update({
      'frv-detect': { value: root.Format.percent(1 - first.measured, 1),
        note: 'exactly 50% is predicted here, ±' +
          root.Format.percent(Math.sqrt(0.25 / first.trials), 1) + ' over ' +
          root.Format.exact(first.trials) + ' seeds' },
      'frv-alarms': { value: root.Format.exact(alarms),
        note: 'across every round count — a true identity has no counter-example to find' },
      'frv-cost': { value: root.Format.fixed(freivalds.multiplyCost / freivalds.verifyCost, 1) + '×',
        note: root.Format.exact(freivalds.multiplyCost) + ' to multiply, ' +
          root.Format.exact(freivalds.verifyCost) + ' to check it eight times' },
      'frv-proof': { value: root.Format.exact(strings.tree.proofLength),
        note: 'for ' + root.Format.exact(strings.tree.leaves) + ' chunks — log₂ of the leaf count' }
    });
  }

  function paintChart(app, freivalds) {
    const host = root.jQuery('#frv-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 260,
      xLabel: 'independent rounds', yLabel: 'probability the corruption is caught',
      yMin: 0, yMax: 1.02,
      series: [
        { label: 'measured detection', points: freivalds.rows.map(function (row) {
          return { x: row.rounds, y: 1 - row.measured };
        }) },
        { label: '1 − 2⁻ᵏ, the proven floor', dashed: true,
          points: freivalds.rows.map(function (row) {
            return { x: row.rounds, y: 1 - row.bound };
          }) },
        { label: 'false alarms on a correct product', points: freivalds.rows.map(function (row) {
          return { x: row.rounds, y: row.falseAlarms / row.trials };
        }) }
      ],
      legendHost: root.jQuery('#frv-legend')[0]
    });

    root.Helpers.setText('frv-chart-note',
      'The measured curve sits on or just above the proven floor at every round count, which is ' +
      'what a tight one-sided bound looks like. The third series is flat on zero and stays ' +
      'there: it is not a small number, it is structurally zero, because A(Bx) and Cx agree at ' +
      'every x when AB = C and there is no draw that could disagree. That flat line is the ' +
      'property that makes repetition free.');
  }

  function paintRounds(freivalds) {
    root.jQuery('#frv-rounds tbody').html(freivalds.rows.map(function (row) {
      return '<tr><td class="mono">' + row.rounds + '</td><td class="mono">' +
        root.Format.exact(row.missed) + ' / ' + root.Format.exact(row.trials) +
        '</td><td class="mono">' + root.Format.fixed(row.measured, 5) + '</td><td class="mono">' +
        root.Format.fixed(row.bound, 5) + '</td><td class="mono">' +
        root.Format.exact(row.falseAlarms) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('frv-rounds-note',
      'One corrupted entry in a ' + root.Format.exact(freivalds.size) + ' × ' +
      root.Format.exact(freivalds.size) + ' product — ' +
      root.Format.exponential(1 / (freivalds.size * freivalds.size), 1) +
      ' of the matrix — and one round catches it about half the time. The measured column ' +
      'tracks 2⁻ᵏ closely rather than sitting far below it, which tells you the bound is tight ' +
      'for this corruption: a single wrong entry is the hardest case, because the difference ' +
      'matrix has exactly one non-zero row and the test only sees it when x picks out that ' +
      'column. Raise the corruption slider and the measured column drops away from the bound, ' +
      'because more wrong entries mean more ways to be caught.');
  }

  function paintIdentity(identity, field) {
    const rows = identity.rows.filter(function (row) { return row.field === field; });
    root.jQuery('#frv-identity tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.claim + '</td><td>' + (row.holds ? 'yes' : 'no') +
        '</td><td class="mono">' + row.degree + '</td><td class="mono">' +
        root.Format.exact(row.accepted) + ' / ' + root.Format.exact(row.trials) +
        '</td><td class="mono">' + root.Format.fixed(row.rate, 5) + '</td><td class="mono">' +
        (row.holds ? '— (always accepted)' : root.Format.fixed(row.bound, 5)) + '</td></tr>';
    }).join(''));

    const trueRows = rows.filter(function (row) { return row.holds; });
    const falseRows = rows.filter(function (row) { return !row.holds; });
    root.Helpers.setText('frv-identity-note',
      'The two true identities are accepted ' +
      root.Format.exact(trueRows.reduce(function (a, r) { return a + r.accepted; }, 0)) +
      ' times out of ' + root.Format.exact(trueRows.reduce(function (a, r) {
        return a + r.trials;
      }, 0)) + ' — every single draw, because they hold at every point of the field. The false ' +
      'ones slip through at ' + falseRows.map(function (row) {
        return root.Format.fixed(row.rate, 4);
      }).join(' and ') + ' against bounds of ' + falseRows.map(function (row) {
        return root.Format.fixed(row.bound, 4);
      }).join(' and ') + '. The last claim is the instructive one: ∏(xᵢ − i) is zero on a large ' +
      'part of a small field even though it is not the zero polynomial, which is precisely the ' +
      'case the lemma is stated for. Shrink the field to 101 and watch the accept rate climb — ' +
      'a test over a field smaller than the degree is not a test.');
  }

  function paintStrings(strings) {
    root.jQuery('#frv-strings tbody').html(strings.rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.field) + '</td><td class="mono">' +
        root.Format.fixed(row.ordinary.bitsCompared, 1) + ' vs ' +
        root.Format.exact(row.ordinary.bitsInText) + '</td><td class="mono">' +
        root.Format.exact(row.ordinary.collisions) + ' / ' +
        root.Format.exact(row.ordinary.trials) + '</td><td class="mono">' +
        root.Format.exact(row.adversarial.collisions) + ' / ' +
        root.Format.exact(row.adversarial.trials) + ' = ' +
        root.Format.fixed(row.adversarial.rate, 5) + '</td><td class="mono">' +
        root.Format.exponential(row.adversarial.bound, 2) + '</td></tr>';
    }).join(''));

    const small = strings.rows[0];
    const large = strings.rows[strings.rows.length - 1];
    root.Helpers.setText('frv-strings-note',
      'The two collision columns are the point of this table and they disagree completely. ' +
      'Two sequences of ' + root.Format.exact(strings.length) + ' symbols differing in exactly ' +
      'one position never collide at any field size — not rarely, never — because their ' +
      'difference is a single term c·bᵏ whose only root is base zero, and zero is not among the ' +
      'bases drawn. A bound of n/p beside a measured rate of zero is not agreement, and ' +
      'reporting it as agreement is the trap. The right-hand pair is the case the bound is ' +
      'about: ' + root.Format.exact(strings.roots) + ' bases chosen in advance, the polynomial ' +
      'with exactly those roots expanded, and its coefficients used as the difference — so the ' +
      'measured rate is ' + root.Format.fixed(small.adversarial.rate, 4) + ' at p = ' +
      root.Format.exact(small.field) + ' against a bound of ' +
      root.Format.exponential(small.adversarial.bound, 2) + ', and ' +
      root.Format.fixed(large.adversarial.rate, 5) + ' at p = ' +
      root.Format.exact(large.field) + '. That is what a worst case looks like when somebody ' +
      'builds it, and it is why the base has to be drawn AFTER the sequences are fixed.');
  }

  function paintMerkle(strings) {
    const tree = strings.tree;
    const index = Math.min(3, tree.leaves - 1);
    const chunk = strings.chunks[index];
    const proof = root.Fingerprinting.merkleProof(tree, index);
    const good = root.Fingerprinting.verifyProof(chunk, proof, tree.root);
    const bad = root.Fingerprinting.verifyProof(chunk + 'x', proof, tree.root);
    const rows = [
      { check: 'the whole object, re-hashed', touched: root.Format.exact(strings.length) +
        ' characters', result: 'the only option without a tree' },
      { check: 'chunk ' + index + ' against the root', touched: root.Format.exact(proof.length) +
        ' sibling hashes', result: good.valid ? 'verified' : 'REJECTED' },
      { check: 'the same chunk with one character added', touched: root.Format.exact(proof.length) +
        ' sibling hashes', result: bad.valid ? 'accepted — a collision' : 'rejected, as it should be' }
    ];
    root.jQuery('#frv-merkle tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.check + '</td><td class="mono">' + row.touched + '</td><td>' +
        row.result + '</td></tr>';
    }).join(''));

    root.Helpers.setText('frv-merkle-note',
      'A Merkle tree over ' + root.Format.exact(tree.leaves) + ' chunks lets one chunk be ' +
      'checked against a single root hash using ' + root.Format.exact(tree.proofLength) +
      ' siblings — log₂ of the leaf count. This is the same trade as Freivalds in a different ' +
      'shape: an expensive object, a cheap certificate, and a verifier that never has to trust ' +
      'the producer. M54 builds on it directly, and the hash here is a simple mixing function ' +
      'rather than a cryptographic one, so it demonstrates the structure and not the security.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
