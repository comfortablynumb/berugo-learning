/**
 * Section: public-key cryptography.
 *
 * The claim under test is that the parameter size IS the security, so the demo
 * measures rather than asserts it: the same eavesdropper runs the same
 * brute-force discrete log against four moduli and the step count is reported,
 * including the size at which it gives up. Alongside it, textbook RSA is broken
 * with a single chosen-ciphertext query, which is what OAEP exists to prevent
 * and what "textbook" means in practice.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'public-key-cryptography';
  const MODULI = ['7919', '104729', '1299709', '2147483647'];
  const GENERATOR = 5n;
  const CAP = 2000000;
  const RSA = { p: 1061n, q: 1553n, e: 17n, message: 42n };
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — ECDH: two private scalars, one shared point',
      caption: 'Each side multiplies the curve\'s fixed generator by a secret scalar and sends ' +
        'the resulting point. Each then multiplies the point they received by their own scalar, ' +
        'and because scalar multiplication commutes both land on the same point — a value that ' +
        'was never transmitted and that neither side chose alone. The eavesdropper has the ' +
        'generator, both public points and the curve, and would need to invert scalar ' +
        'multiplication to get a private key. That is the elliptic-curve discrete-log problem, ' +
        'and no algorithm better than square-root-of-the-group-order is known for a well-chosen ' +
        'curve — which is exactly why a 256-bit curve matches a 3 072-bit RSA modulus.',
      definition: [
        'sequenceDiagram',
        '    participant A as Alice',
        '    participant N as Network',
        '    participant B as Bob',
        '    Note over A: pick scalar a, secret',
        '    Note over B: pick scalar b, secret',
        '    A->>N: A = a·G',
        '    N->>B: A',
        '    B->>N: B = b·G',
        '    N->>A: B',
        '    Note over A: shared = a·B',
        '    Note over B: shared = b·A',
        '    Note over N: sees G, A, B — needs the discrete log to get a or b'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**⚠ Teaching code: not constant-time, not audited, never for real data.** These key sizes ' +
        'are chosen to be breakable in a browser. Use X25519 and Ed25519 through an audited ' +
        'library.',
      '**Public-key cryptography rests on problems that are easy one way and hard the other.** ' +
        'Multiplying two primes is easy and factoring the product is not; exponentiating in a ' +
        'group is easy and taking the logarithm is not. Everything else is engineering on top of ' +
        'those two assumptions, and neither has been proved hard.',
      '**Diffie–Hellman produces a shared secret that was never transmitted, and the demo runs ' +
        'it.** Both sides exponentiate the other\'s public value with their own private one and ' +
        'land on the same number. The eavesdropper sees the modulus, the generator and both ' +
        'public values, and that is genuinely not enough — at a large enough size.',
      '**"At a large enough size" is the whole sentence, and the demo measures where it stops ' +
        'being true.** The same brute-force discrete log runs against four moduli: it wins in ' +
        'under a thousand steps at 13 bits, takes over a hundred thousand at 21, and gives up ' +
        'at 31. Nothing about the protocol changed — only the parameter.',
      '**RSA encryption without padding is broken, and one query proves it.** RSA is ' +
        'multiplicative: multiply a ciphertext by s^e and the decryption comes back multiplied ' +
        'by s. An attacker with any decryption oracle submits a blinded copy of a ciphertext ' +
        'they are not allowed to send, divides by s, and reads the plaintext.',
      '**OAEP and PSS are what make RSA usable, and they are not optional decoration.** Padding ' +
        'destroys the multiplicative structure the attack needs, and adds randomness so equal ' +
        'plaintexts do not give equal ciphertexts. Textbook RSA has neither property, and ' +
        '"textbook" in an implementation means exactly this.',
      '**Elliptic curves get the same security from far smaller keys.** The best attack on a ' +
        'well-chosen curve is square-root in the group order, while factoring has index-calculus ' +
        'methods that are subexponential — so 128-bit security is a 256-bit curve and a ' +
        '3 072-bit RSA modulus, and the gap widens as the level rises.',
      '**X25519 and Ed25519 exist because parameters were the failure, not the mathematics.** ' +
        'They fix the curve, forbid the invalid-point and small-subgroup cases by construction, ' +
        'and leave nothing to choose. That is a design response to a decade of deployments broken ' +
        'by parameters rather than by any attack on the underlying problem.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — agree a secret, then watch an eavesdropper break it by size',
        markup: root.PublicKeyTemplate.render()
      },
      diagram: diagram(),
      insight: '**RSA\'s failure modes are almost all padding and parameter failures. The maths ' +
        'is fine; the deployments were not, which is why modern protocols moved to X25519 and ' +
        'Ed25519 with no parameter choices to get wrong.** Look at what the demo actually breaks: ' +
        'not the factoring assumption, but a missing padding scheme and a modulus somebody chose ' +
        'too small. That is the pattern across twenty years of RSA incidents — Bleichenbacher ' +
        'padding oracles, shared moduli from bad key generation, small public exponents applied ' +
        'to unpadded messages, and 512-bit export keys still being accepted. The industry\'s ' +
        'answer was not better RSA advice, it was primitives with no dials on them, and that is ' +
        'the transferable lesson: when a parameter can be wrong, eventually it will be.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PublicKeyTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const exchangeFor = root.Helpers.memoise(function (modulus) {
    const pk = root.PublicKey;
    const p = BigInt(modulus);
    const exchange = pk.diffieHellman({ p: p, g: GENERATOR, a: (p * 61n) / 100n,
      b: (p * 37n) / 100n });
    const log = pk.discreteLog(exchange.alicePublic, GENERATOR, p, CAP);
    const eve = log.found ? pk.modPow(exchange.bobPublic, BigInt(log.x), p) : null;

    return { p: p, exchange: exchange, log: log, eve: eve,
      bits: p.toString(2).length,
      eveWon: eve !== null && eve === exchange.aliceShared };
  });

  const rsaFor = root.Helpers.memoise(function (blind) {
    const pk = root.PublicKey;
    const key = pk.rsaKey(RSA.p, RSA.q, RSA.e);
    const ciphertext = pk.rsaEncrypt(RSA.message, key);
    const attack = pk.malleabilityAttack({ key: key, ciphertext: ciphertext,
      blind: BigInt(blind), oracle: function (value) { return pk.rsaDecrypt(value, key); } });

    return { key: key, ciphertext: ciphertext, attack: attack,
      factored: pk.factor(key.n),
      recovered: attack.recovered === RSA.message };
  });

  function update() {
    const values = panel.values();
    const exchange = exchangeFor(values['pkc-modulus']);
    const rsa = rsaFor(values['pkc-blind']);

    root.Helpers.setText('pkc-disclaimer', root.PublicKey.DISCLAIMER);
    paintMetrics(exchange, rsa);
    paintEve(exchange);
    paintExchange(exchange);
    paintSizes();
    paintRsa(rsa);
    paintStrength();
  }

  function paintMetrics(exchange, rsa) {
    root.MetricGrid.update({
      'pkc-agree': { value: exchange.exchange.aliceShared === exchange.exchange.bobShared
        ? 'yes' : 'no',
      note: 'shared secret ' + exchange.exchange.aliceShared.toString() +
          ', which never crossed the wire' },
      'pkc-break': { value: exchange.log.found
        ? root.Format.exact(exchange.log.steps)
        : 'gave up at ' + root.Format.exact(CAP),
      note: exchange.log.found
        ? 'and the eavesdropper reached the same shared secret: ' +
          (exchange.eveWon ? 'yes' : 'no')
        : 'at ' + root.Format.exact(exchange.bits) + ' bits the same code runs out of budget' },
      'pkc-factor': { value: root.Format.exact(rsa.factored.steps) + ' divisions',
        note: 'recovered p = ' + rsa.factored.p.toString() + ', q = ' + rsa.factored.q.toString() +
          ' from a ' + root.Format.exact(rsa.key.bits) + '-bit modulus' },
      'pkc-recovered': { value: rsa.recovered ? rsa.attack.recovered.toString() : 'failed',
        note: rsa.recovered
          ? 'the true plaintext, from one query on a ciphertext the oracle refused'
          : 'the attack failed, which would mean RSA is not multiplicative' }
    });
  }

  function paintEve(exchange) {
    root.jQuery('#pkc-eve').html(
      '<div class="mono" style="font-size:.9rem">modulus ' + exchange.p.toString() + ' · ' +
      root.Format.exact(exchange.bits) + ' bits</div>' +
      '<div class="mono" style="font-size:.9rem">' +
      (exchange.log.found
        ? 'solved in ' + root.Format.exact(exchange.log.steps) + ' steps → shared secret ' +
          exchange.eve.toString()
        : 'unsolved after ' + root.Format.exact(CAP) + ' steps') + '</div>');

    root.Helpers.setText('pkc-eve-note',
      exchange.log.found
        ? 'The eavesdropper recovered an exponent x with g^x equal to Alice\'s public value in ' +
          root.Format.exact(exchange.log.steps) + ' steps, raised Bob\'s public value to it, and ' +
          'landed on ' + exchange.eve.toString() + ' — the same secret Alice and Bob agreed. ' +
          'Note that x need not be Alice\'s actual private exponent: any solution to the discrete ' +
          'log works, which is one of several reasons the brute force is cheaper than it looks. ' +
          'Nothing about the protocol was wrong here. The modulus was ' +
          root.Format.exact(exchange.bits) + ' bits.'
        : 'At ' + root.Format.exact(exchange.bits) + ' bits the identical attack ran ' +
          root.Format.exact(CAP) + ' steps and found nothing, so the exchange held. That is the ' +
          'entire difference between the rows of the table below — same protocol, same code, ' +
          'same attacker, one parameter. Real deployments use 2 048 bits or more for finite-field ' +
          'Diffie–Hellman precisely because this search, done cleverly rather than naively, still ' +
          'reaches further than most people expect.');
  }

  function paintExchange(state) {
    const e = state.exchange;
    const rows = [
      { step: 'Agree the group publicly', alice: 'p = ' + e.p.toString() + ', g = ' + e.g.toString(),
        bob: 'p = ' + e.p.toString() + ', g = ' + e.g.toString(),
        wire: 'p and g — both public, and often standardised' },
      { step: 'Pick a private exponent', alice: 'a = ' + e.alicePrivate.toString() + ' (secret)',
        bob: 'b = ' + e.bobPrivate.toString() + ' (secret)', wire: 'nothing' },
      { step: 'Send the public value', alice: 'A = g^a mod p = ' + e.alicePublic.toString(),
        bob: 'B = g^b mod p = ' + e.bobPublic.toString(), wire: 'A and B, in the clear' },
      { step: 'Raise what you received',
        alice: 'B^a mod p = ' + e.aliceShared.toString(),
        bob: 'A^b mod p = ' + e.bobShared.toString(),
        wire: 'nothing — the shared value is never sent' },
      { step: 'What the eavesdropper must do', alice: '—', bob: '—',
        wire: state.log.found
          ? 'solve the discrete log: done in ' + root.Format.exact(state.log.steps) + ' steps here'
          : 'solve the discrete log: not done in ' + root.Format.exact(CAP) + ' steps here' }
    ];

    root.jQuery('#pkc-exchange tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.step + '</td><td class="mono">' + row.alice + '</td><td class="mono">' +
        row.bob + '</td><td>' + row.wire + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pkc-exchange-note',
      'Both parties compute g^(ab) by different routes and neither ever transmits it, which is ' +
      'the trick in one line. The last column is what an eavesdropper holds, and it is almost ' +
      'everything: the group, the generator and both public values. What they lack is either ' +
      'private exponent, and the only known route to one is the discrete logarithm. Note also ' +
      'what this exchange does NOT provide — there is no authentication anywhere in the table, so ' +
      'an active attacker who sits in the middle and runs two exchanges reads everything. ' +
      'Diffie–Hellman is a key agreement, not a protocol.');
  }

  function paintSizes() {
    const rows = MODULI.map(function (modulus) {
      const run = exchangeFor(modulus);

      return { modulus: modulus, bits: run.bits, steps: run.log.steps, found: run.log.found,
        won: run.eveWon };
    });

    root.jQuery('#pkc-sizes tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(Number(row.modulus)) + '</td><td class="mono">' +
        row.bits + '</td><td class="mono">' +
        (row.found ? root.Format.exact(row.steps) : '> ' + root.Format.exact(CAP)) +
        '</td><td>' + (row.won ? 'yes' : 'no') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pkc-sizes-note',
      'Four rows, one attacker, one piece of code, and the step count roughly tracks the size of ' +
      'the group. That is the argument for key size stated as a measurement rather than a rule of ' +
      'thumb: the protocol is not stronger at 31 bits than at 13, it is the same protocol, and ' +
      'the only thing standing between the eavesdropper and the secret is how long the search ' +
      'takes. Real parameters are chosen so that the best KNOWN search — index calculus for ' +
      'finite fields, Pollard rho for curves, not this loop — is out of reach for the lifetime ' +
      'of the data, which is why the recommended sizes rise over time without any protocol ' +
      'changing.');
  }

  function paintRsa(rsa) {
    const a = rsa.attack;
    const rows = [
      { step: 'The key', maths: 'n = p·q, public e, private d',
        value: 'n = ' + rsa.key.n.toString() + ', e = ' + rsa.key.e.toString() + ', d = ' +
          rsa.key.d.toString() },
      { step: 'The ciphertext the attacker may NOT submit', maths: 'c = m^e mod n',
        value: rsa.ciphertext.toString() },
      { step: 'Blind it', maths: 'c′ = c · s^e mod n',
        value: 's = ' + a.blindFactor.toString() + ', c′ = ' + a.blinded.toString() },
      { step: 'Submit c′ to the oracle', maths: '(c · s^e)^d = m · s mod n',
        value: a.oracleAnswer.toString() },
      { step: 'Divide by s', maths: 'm = (m·s) · s^-1 mod n', value: a.recovered.toString() },
      { step: 'Factor the modulus instead', maths: 'trial division up to √n',
        value: rsa.factored.steps + ' steps → ' + rsa.factored.p.toString() + ' × ' +
          rsa.factored.q.toString() }
    ];

    root.jQuery('#pkc-rsa tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.step + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.maths) + '</td><td class="mono">' + row.value + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pkc-rsa-note',
      'The recovered value is ' + a.recovered.toString() + ' and the true plaintext was ' +
      RSA.message.toString() + ', from a single oracle query on a ciphertext the attacker ' +
      'constructed rather than the one they were refused. The property that makes it work is ' +
      'that RSA is multiplicative — (m·s)^e = m^e · s^e — which is a feature in some settings ' +
      'and a complete break in this one. OAEP removes it by padding the message with structure ' +
      'and randomness that a multiplied ciphertext will not decrypt to, and the last row is the ' +
      'other lesson: at ' + root.Format.exact(rsa.key.bits) + ' bits none of this is needed, ' +
      'because trial division factors the modulus in ' + root.Format.exact(rsa.factored.steps) +
      ' divisions.');
  }

  function paintStrength() {
    const rows = root.PublicKey.keySizeTable();

    root.jQuery('#pkc-strength tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.bits + '-bit</td><td class="mono">' +
        root.Format.exact(row.rsa) + '</td><td class="mono">' + root.Format.exact(row.dh) +
        '</td><td class="mono">' + root.Format.exact(row.ecc) + '</td><td>' + row.note +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('pkc-strength-note',
      'Read across the 128-bit row: the same strength costs a 3 072-bit RSA modulus and a ' +
      '256-bit curve, a factor of twelve in key size and far more in operation cost. And the gap ' +
      'widens down the table — at 256-bit security RSA needs 15 360 bits, which is why nobody ' +
      'deploys it there and everybody deploys curves. The reason is not that RSA is badly ' +
      'designed: factoring has subexponential algorithms and the elliptic-curve discrete log does ' +
      'not, so RSA moduli must grow much faster than curve orders to keep pace. "2 048-bit RSA" ' +
      'and "256-bit ECC" are not comparable numbers, and treating key length as strength is one ' +
      'of the most common mistakes in this area.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
