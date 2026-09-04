/**
 * Section: threat models and primitive selection.
 *
 * The measurement that opens the milestone is the vector table: every primitive
 * implemented here is checked against its published values at render time, and
 * the count is a metric rather than a claim. A primitive with no vector
 * coverage does not ship, because a cryptographic implementation that is subtly
 * wrong produces stable, plausible-looking output for every input and nothing
 * about that output reveals the bug.
 *
 * The chooser is the other half. Every path ends at a named audited API, which
 * is the honest answer to "which cipher should I implement": none of them.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'threat-models-and-primitives';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — from a security goal to a primitive',
      caption: 'Four goals that are routinely conflated, and the four different answers they ' +
        'need. Confidentiality hides content; integrity detects modification; authenticity says ' +
        'who produced it; non-repudiation says it to a third party. Encryption gives the first ' +
        'and — on its own — none of the others, which is why an unauthenticated ciphertext is a ' +
        'liability rather than a protection. Every leaf of this tree is a named audited API, ' +
        'because the correct answer to "which one should I implement" is always "none of them".',
      definition: [
        'flowchart TD',
        '    G{"what do you need?"} --> C["hide the content"]',
        '    G --> I["detect modification"]',
        '    G --> A["prove who produced it"]',
        '    G --> N["prove it to a THIRD party"]',
        '    C --> AEAD["AEAD — AES-GCM or ChaCha20-Poly1305<br/>gives integrity too, which is why you want it"]',
        '    I --> AEAD',
        '    A --> MAC["HMAC — both parties can produce it"]',
        '    N --> SIG["Ed25519 — only the key holder can produce it"]',
        '    AEAD --> API["crypto.subtle / libsodium"]',
        '    MAC --> API',
        '    SIG --> API'
      ].join('\n')
    };
  }

  function orientationGoals() {
    return [
      '**⚠ Everything implemented in this milestone is teaching code.** It is not constant-time, ' +
        'not side-channel hardened and not audited, and it must never protect real data.',
      'Production code uses `crypto.subtle`, libsodium or an equivalent audited library. The ' +
        'implementations exist so the attacks can be executed rather than described.',
      '**Confidentiality, integrity, authenticity and non-repudiation are four goals, not one.** ' +
        'Encryption gives the first.',
      'It gives the second only if the mode authenticates, and the third only with a key whose ' +
        'holder is known.',
      'Non-repudiation needs a signature, because a MAC is producible by the verifier and therefore ' +
        'proves nothing to anyone else.',
      '**Kerckhoffs\'s principle: the system must be secure with everything but the key public.** ' +
        'That is not a moral position, it is an engineering one.',
      'Secrets that are not keys leak, and a design whose security depends on the algorithm staying ' +
        'hidden has no way to be reviewed, rotated or replaced.',
      '**The adversary model changes the answer.** A passive eavesdropper needs confidentiality, ' +
        'and an active attacker who can modify traffic needs authentication too.',
      'An attacker who can submit chosen ciphertexts and observe the response needs a mode with no ' +
        'oracle at all. Naming the adversary first is what makes the rest of the choice mechanical.'
    ];
  }

  function orientationPractice() {
    return [
      '**"128-bit security" means the best known attack costs about 2^128 operations.** It is not ' +
        'the key length, and for RSA it is nothing like the key length.',
      'The demo tabulates the equivalences. 128-bit security is a 3 072-bit RSA key and a 256-bit ' +
        'elliptic curve.',
      '**Every primitive here is checked against published test vectors at render time.** That is ' +
        'NIST\'s AES vectors, RFC 4231 for HMAC, RFC 6070 for PBKDF2 and RFC 8439 for ' +
        'ChaCha20-Poly1305.',
      'A wrong implementation produces stable, plausible output forever. Only agreement with ' +
        'somebody else\'s answer detects it.',
      '**Most production failures are composition and parameter failures, not broken primitives.** ' +
        'AES has never been the weak point in your system.',
      'A repeated nonce, a fast password hash, an unauthenticated mode, a `===` on a token: those ' +
        'are the failures.',
      'Every one of them is demonstrated in this milestone, with the attack actually running.',
      '**Every path in the chooser ends at an audited API**, which is the practical form of "do not ' +
        'implement your own".',
      'The implementations in these sections exist to make the failure modes visible. The thing you ' +
        'should ship is one line calling a library somebody has attacked professionally.'
    ];
  }

  function orientation() {
    return orientationGoals().concat(orientationPractice());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — state a requirement, get a primitive and its failure mode',
        markup: root.ThreatModelsTemplate.render()
      },
      diagram: diagram(),
      insight: '**Most cryptographic failures in production are composition and parameter ' +
        'failures, not broken primitives. AES has never been the weak point in your system.** ' +
        'That reframes what "getting crypto right" means. The work is not choosing a strong ' +
        'algorithm, because every mainstream one is strong. It is naming the adversary and ' +
        'choosing the parameters against that adversary. It is also composing the pieces in an ' +
        'order that survives an attacker who can modify traffic and read your errors. The rest of ' +
        'this milestone runs those failures as executable attacks, which is the only way to see ' +
        'that they are ordinary engineering mistakes rather than exotic ones.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ThreatModelsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const vectorsFor = root.Helpers.memoise(function () {
    return root.CryptoLab.vectorSummary();
  });

  function update() {
    const values = panel.values();
    const table = root.CryptoLab.primitiveTable();
    const chosen = table.filter(function (row) { return row.goal === values['thr-goal']; })[0];

    root.Helpers.setText('thr-disclaimer', root.CryptoLab.DISCLAIMER);
    paintMetrics(chosen, vectorsFor(''));
    paintAnswer(chosen);
    paintMap(table);
    paintVectors(vectorsFor(''));
    paintGoals();
  }

  function paintMetrics(chosen, vectors) {
    root.MetricGrid.update({
      'thr-primitive': { value: chosen.primitive.split(':')[0].split(',')[0],
        note: chosen.primitive },
      'thr-parameters': { value: chosen.parameters.split(';')[0], note: chosen.parameters },
      'thr-failure': { value: chosen.failure.split('—')[0].trim(), note: chosen.failure },
      'thr-vectors': { value: root.Format.exact(vectors.passed) + ' of ' +
        root.Format.exact(vectors.total),
      note: vectors.passed === vectors.total
        ? 'every implementation agrees with its published values'
        : 'A VECTOR DISAGREES — nothing in this milestone can be trusted until it does' }
    });
  }

  function paintAnswer(chosen) {
    root.jQuery('#thr-answer').html('<div class="mono" style="font-size:.95rem">' +
      root.Helpers.escapeHtml(chosen.api) + '</div>');
    root.Helpers.setText('thr-answer-note',
      'For "' + chosen.goal + '" against ' + chosen.threat + ', the primitive is ' +
      chosen.primitive + ' with ' + chosen.parameters + '. The failure that actually happens is: ' +
      chosen.failure + '. The line above is what you should write — the implementations in the ' +
      'sections that follow exist so you can see what goes wrong when somebody writes it ' +
      'themselves instead.');
  }

  function paintMap(table) {
    root.jQuery('#thr-map tbody').html(table.map(function (row) {
      return '<tr><td>' + row.goal + '</td><td>' + row.threat + '</td><td>' + row.primitive +
        '</td><td>' + row.parameters + '</td><td>' + row.failure + '</td></tr>';
    }).join(''));

    root.Helpers.setText('thr-map-note',
      root.Format.exact(table.length) + ' requirements, ' + root.Format.exact(table.length) +
      ' answers, and the fourth column is where the decisions actually are. Every primitive in ' +
      'the third column is strong and none of them has ever been the weak point in a production ' +
      'breach; every entry in the fifth column is a mistake somebody shipped. Read the table ' +
      'left to right and it is a decision procedure; read the last column on its own and it is ' +
      'the syllabus for the rest of this milestone.');
  }

  function paintVectors(vectors) {
    root.jQuery('#thr-vector-table tbody').html(vectors.rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + row.source + '</td><td class="mono">' +
        row.expected.slice(0, 24) + '…</td><td class="mono">' + row.actual.slice(0, 24) +
        '…</td><td class="mono">' + (row.ok ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('thr-vector-note',
      root.Format.exact(vectors.passed) + ' of ' + root.Format.exact(vectors.total) +
      ' implementations agree with the published values, computed when this page rendered rather ' +
      'than asserted in a comment. That check is not a formality: a cryptographic implementation ' +
      'with a wrong constant, a swapped byte order or an off-by-one in its padding produces ' +
      'output that is stable, well distributed and completely wrong, and nothing about the ' +
      'output reveals it. Agreement with somebody else\'s answer is the only detector.');
  }

  function paintGoals() {
    const rows = [
      { goal: 'Confidentiality', answers: 'can an eavesdropper read this?',
        not: 'whether it was modified, or who sent it' },
      { goal: 'Integrity', answers: 'has this been changed since it was produced?',
        not: 'who produced it — a checksum answers this against noise, not against a person' },
      { goal: 'Authenticity', answers: 'was this produced by someone holding the key?',
        not: 'which of the key holders — a MAC key is shared, so either party could have' },
      { goal: 'Non-repudiation', answers: 'can I prove to a third party who produced this?',
        not: 'anything, unless a signature is used — a MAC is forgeable by the verifier' }
    ];

    root.jQuery('#thr-goals tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.goal + '</td><td>' + row.answers + '</td><td>' + row.not +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('thr-goals-note',
      'The last column is the useful one. "We encrypt it" answers the first row and nothing ' +
      'else, which is why an unauthenticated ciphertext can be modified into a different valid ' +
      'message. "We MAC it" answers the third row for two parties who share a key and cannot ' +
      'answer the fourth at all, because the verifier could have produced the tag themselves. ' +
      'Those distinctions are not pedantry — each one names a class of production failure, and ' +
      'the sections that follow execute the attacks.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
