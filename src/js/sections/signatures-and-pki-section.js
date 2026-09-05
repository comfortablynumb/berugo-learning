/**
 * Section: signatures, certificates and PKI.
 *
 * The demo recovers an ECDSA private key from two signatures that shared a
 * nonce — the arithmetic is four modular operations and it is executed here,
 * not narrated. Switching the signer to a deterministic nonce makes the same
 * two messages produce different nonces and the recovery returns a value that
 * is not the key. The second half builds five certificate chains, four of them
 * broken in one specific way each, and runs a real validator over all of them.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'signatures-and-pki';
  const FIRST = 'transfer 100 to alice';
  const SECOND = 'transfer 900 to mallory';
  const SECRET = 1234n;
  const NOW = 2026;
  const HOST = 'shop.example.com';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a chain, and the check applied at each link',
      caption: 'A certificate is a signed statement that a name owns a key, and a chain is a ' +
        'sequence of such statements ending at a key the client already trusts. Validation is ' +
        'not one check but a list applied at every link: the signature must verify under the ' +
        'issuer above, the validity window must contain the current time, an intermediate must ' +
        'actually be marked as a CA and carry the certificate-signing usage, and the leaf\'s ' +
        'names must cover the host being visited. Skipping any one of them has been a real ' +
        'vulnerability — the basic-constraints check in particular, whose absence let anyone with ' +
        'any valid certificate mint one for any site.',
      definition: [
        'flowchart TD',
        '    R["trust anchor — Root CA<br/>already in the store"] --> C1',
        '    C1["Issuing CA<br/>CA:TRUE, certSign"] --> C2',
        '    C2["leaf — shop.example.com<br/>CA:FALSE"] --> H["the connection"]',
        '    R -. "check: signature verifies" .-> C1',
        '    R -. "check: CA:TRUE and<br/>certSign" .-> C1',
        '    C1 -. "check: signature verifies" .-> C2',
        '    C1 -. "check: validity window<br/>contains now" .-> C2',
        '    C2 -. "check: a name covers<br/>the host" .-> H'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**⚠ Teaching code: not constant-time, not audited, never for real data.** The curve here ' +
        'has a 3 359-element group so the arithmetic is readable. Use Ed25519.',
      '**A signature and a MAC answer different questions.** A MAC key is shared, so either ' +
        'holder could have produced the tag — it proves authenticity to the two of you and ' +
        'nothing to anybody else. A signature is produced by a private key and checked with a ' +
        'public one, so a third party can be convinced. That is non-repudiation.',
      '**ECDSA needs a fresh secret nonce for every signature, and reusing one hands over the ' +
        'private key.** Two signatures with the same k share the same r, which is visible on the ' +
        'wire. From there the key falls out of four modular operations, and the demo performs ' +
        'them.',
      '**This is not a theoretical failure.** The PlayStation 3 firmware signing key fell to it ' +
        'in 2010, because Sony used a constant nonce. Bitcoin wallets on Android lost funds in ' +
        '2013, because a broken `SecureRandom` repeated values. Same bug, different decade.',
      '**Deterministic nonces (RFC 6979) remove the requirement rather than restating it.** ' +
        'Derive k by HMAC over the private key and the message hash. It is unpredictable to ' +
        'anyone without the key, it never repeats across different messages, and it needs no ' +
        'entropy at signing time. EdDSA builds the same idea into the scheme.',
      '**A certificate is a signed statement that a name owns a key, and validation is a list of ' +
        'checks.** The demo runs the list: signature under the issuer, validity window, ' +
        'basic constraints, key usage, issuer/subject linkage and host-name matching. Four of the ' +
        'five chains are broken in exactly one place, and the failing check is named.',
      '**Wildcard matching is narrower than people assume.** `*.example.com` matches ' +
        '`shop.example.com` and does NOT match `a.b.example.com` or bare `example.com`. Getting ' +
        'that comparison wrong is a certificate-validation bug of the same class as skipping it.',
      '**Revocation barely works, which is why certificates got short instead.** CRLs are large ' +
        'and stale, OCSP adds a request to a third party on every connection and fails open, and ' +
        'stapling helps only when the server cooperates. The practical answer became 90-day ' +
        'certificates and Certificate Transparency logs that make misissuance visible.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — recover a signing key, then validate five chains',
        markup: root.SignaturesTemplate.render()
      },
      diagram: diagram(),
      insight: '**The PlayStation 3 and several Bitcoin wallet compromises were the same ECDSA ' +
        'nonce bug.** Deterministic nonces exist because "generate a good random number every ' +
        'time" is a requirement systems fail at. That is worth stating as a design principle ' +
        'rather than a war story. A scheme whose security depends on the caller doing something ' +
        'correctly every single time will eventually meet a caller who does not. Here the ' +
        'failure is total and retroactive: every signature ever made with that key is now ' +
        'forgeable. The fix was not better documentation about nonces. It was changing the ' +
        'scheme so there is no nonce to get wrong, which is the same move that produced AEAD, ' +
        'X25519 and Argon2\'s single-call interface.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SignaturesTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function curve() { return root.PublicKey.demoCurve(); }
  function bytes(text) { return root.CryptoHash.bytesOf(text); }

  const signingFor = root.Helpers.memoise(function (strategy) {
    const sig = root.Signatures;
    const c = curve();
    const key = sig.keyPair(SECRET, c);
    const first = bytes(FIRST);
    const second = bytes(SECOND);
    const nonces = strategy === 'reused'
      ? { a: 777n, b: 777n }
      : { a: sig.deterministicNonce({ curve: c, key: key, message: first }),
        b: sig.deterministicNonce({ curve: c, key: key, message: second }) };
    const one = sig.sign({ curve: c, key: key, k: nonces.a, message: first });
    const two = sig.sign({ curve: c, key: key, k: nonces.b, message: second });
    const attack = one.r === two.r
      ? sig.recoverFromReusedNonce({ curve: c, first: one, second: two })
      : { k: null, d: null, sharedR: false };

    return { key: key, one: one, two: two, nonces: nonces, attack: attack,
      recovered: attack.d !== null && attack.d === key.d,
      verified: sig.verify({ curve: c, publicKey: key.q, message: first, signature: one }) };
  });

  const chainFor = root.Helpers.memoise(function (variant) {
    const sig = root.Signatures;
    const c = curve();
    const keys = { anchor: sig.keyPair(9001n, c), ca: sig.keyPair(9002n, c),
      leaf: sig.keyPair(9003n, c), rogue: sig.keyPair(9004n, c) };
    const anchor = sig.certificate({ subject: 'Berugo Root CA', issuer: 'Berugo Root CA',
      notBefore: 2020, notAfter: 2040, isCa: true, key: keys.anchor, keyUsage: ['certSign'] });
    const chain = buildChain({ variant: variant, keys: keys, curve: c, anchor: anchor });

    return { result: sig.validateChain({ chain: chain.chain, trustAnchor: anchor, curve: c,
      at: NOW, host: chain.host }), host: chain.host, describes: chain.describes };
  });

  function buildChain(state) {
    const sig = root.Signatures;
    const ca = sig.signCertificate(sig.certificate({ subject: 'Berugo Issuing CA',
      issuer: 'Berugo Root CA', notBefore: 2023, notAfter: 2033, isCa: true, key: state.keys.ca,
      keyUsage: ['certSign'] }), state.keys.anchor, state.curve);
    const leafSpec = { subject: HOST, issuer: 'Berugo Issuing CA', notBefore: 2025,
      notAfter: 2027, isCa: false, key: state.keys.leaf,
      names: [HOST, '*.' + HOST] };

    if (state.variant === 'expired') {
      leafSpec.notBefore = 2019;
      leafSpec.notAfter = 2021;
    }
    const leaf = sig.signCertificate(sig.certificate(leafSpec), state.keys.ca, state.curve);

    if (state.variant === 'tampered') leaf.names = ['bank.example.com'];
    if (state.variant === 'leaf-signs-leaf') return leafSignsLeaf(state, ca);
    return { chain: [leaf, ca],
      host: state.variant === 'wrong-host' ? 'bank.example.com' : HOST,
      describes: describeVariant(state.variant) };
  }

  /* The chain that basic constraints exists to stop: an ordinary site
   * certificate, with CA:FALSE, used to issue a certificate for another name. */
  function leafSignsLeaf(state, ca) {
    const sig = root.Signatures;
    const rogueIssuer = sig.signCertificate(sig.certificate({ subject: 'blog.example.org',
      issuer: 'Berugo Issuing CA', notBefore: 2025, notAfter: 2027, isCa: false,
      key: state.keys.rogue, names: ['blog.example.org'] }), state.keys.ca, state.curve);
    const victim = sig.signCertificate(sig.certificate({ subject: HOST,
      issuer: 'blog.example.org', notBefore: 2025, notAfter: 2027, isCa: false,
      key: state.keys.leaf, names: [HOST] }), state.keys.rogue, state.curve);

    return { chain: [victim, rogueIssuer, ca], host: HOST,
      describes: describeVariant('leaf-signs-leaf') };
  }

  function describeVariant(variant) {
    if (variant === 'expired') return 'the leaf’s validity window ended before now';
    if (variant === 'wrong-host') return 'the client asked for a host the leaf does not cover';
    if (variant === 'leaf-signs-leaf') {
      return 'an ordinary site certificate was used to issue another certificate';
    }
    if (variant === 'tampered') return 'the leaf’s names were edited after it was signed';
    return 'every check should pass';
  }

  function update() {
    const values = panel.values();
    const signing = signingFor(values['sig-nonce']);
    const chain = chainFor(values['sig-chain']);

    root.Helpers.setText('sig-disclaimer', root.Signatures.DISCLAIMER);
    paintMetrics(signing, chain);
    paintLeak(signing, values['sig-nonce']);
    paintRecover(signing);
    paintChecks(chain, values['sig-chain']);
    paintKinds();
    paintRevocation();
  }

  function paintMetrics(signing, chain) {
    const passed = chain.result.checks.filter(function (check) { return check.ok; }).length;

    root.MetricGrid.update({
      'sig-shared': { value: signing.attack.sharedR ? 'yes' : 'no',
        note: signing.attack.sharedR
          ? 'r = ' + signing.one.r.toString() + ' in both — visible to anyone watching'
          : 'different nonces gave different r values, and there is nothing to exploit' },
      'sig-recovered': { value: signing.recovered ? signing.attack.d.toString() : 'no',
        note: signing.recovered
          ? 'the signer’s actual private key, d = ' + signing.key.d.toString()
          : 'the recovery has no two signatures sharing r to work from' },
      'sig-checks': { value: root.Format.exact(passed) + ' of ' +
        root.Format.exact(chain.result.checks.length),
      note: chain.result.failed.length === 0
        ? 'every check the validator applies'
        : 'failing: ' + chain.result.failed[0].name },
      'sig-valid': { value: chain.result.valid ? 'accepted' : 'rejected',
        note: chain.describes }
    });
  }

  function paintLeak(signing, strategy) {
    root.jQuery('#sig-leak').html(
      '<div class="mono" style="font-size:.85rem">k₁ = ' + signing.nonces.a.toString() +
      ' · k₂ = ' + signing.nonces.b.toString() + '</div>' +
      '<div class="mono" style="font-size:.85rem">r₁ = ' + signing.one.r.toString() +
      ' · r₂ = ' + signing.two.r.toString() + '</div>' +
      '<div class="mono" style="font-size:.9rem;margin-top:.4rem">recovered d = ' +
      (signing.recovered ? signing.attack.d.toString() : 'nothing') +
      ' · true d = ' + signing.key.d.toString() + '</div>');

    root.Helpers.setText('sig-leak-note', strategy === 'reused'
      ? 'Both signatures used k = ' + signing.nonces.a.toString() + ', so both carry r = ' +
        signing.one.r.toString() + ' — the symptom is on the wire, in the signature itself, and ' +
        'anyone scanning a blockchain or a firmware archive can find it by looking for repeated ' +
        'r values. From there the private key is four modular operations away, and the demo ' +
        'performed them: recovered ' + signing.attack.d.toString() + ', actual ' +
        signing.key.d.toString() + '. Every signature this key ever made is now forgeable, ' +
        'retroactively.'
      : 'The nonces are ' + signing.nonces.a.toString() + ' and ' + signing.nonces.b.toString() +
        ', derived by HMAC over the private key and each message hash. They differ because the ' +
        'messages differ, they are unpredictable to anyone without the key, and they are stable ' +
        'across runs — sign the same message twice and you get the same signature, which is a ' +
        'feature for testing and for reproducible builds. No entropy was consumed at signing ' +
        'time, so there is no bad random number generator to fail. The r values differ and the ' +
        'recovery has nothing to work with.');
  }

  function paintRecover(signing) {
    const c = curve();
    const a = signing.attack;
    const rows = [
      { step: 'Notice the shared r', maths: 'r = (k·G).x, so equal r means equal k',
        value: 'r₁ = ' + signing.one.r.toString() + ', r₂ = ' + signing.two.r.toString() },
      { step: 'Write both signature equations', maths: 's = k⁻¹(z + r·d) mod n',
        value: 's₁ = ' + signing.one.s.toString() + ', s₂ = ' + signing.two.s.toString() },
      { step: 'Subtract them', maths: 'k = (z₁ − z₂)·(s₁ − s₂)⁻¹ mod n',
        value: a.k === null ? 'not available' : 'k = ' + a.k.toString() },
      { step: 'Solve one equation for d', maths: 'd = (s₁·k − z₁)·r⁻¹ mod n',
        value: a.d === null ? 'not available' : 'd = ' + a.d.toString() },
      { step: 'Compare with the real key', maths: 'the signer never published this',
        value: signing.key.d.toString() + (signing.recovered ? ' — recovered' : ' — not recovered') },
      { step: 'Group order for reference', maths: 'n, the number of points the generator reaches',
        value: c.n.toString() }
    ];

    root.jQuery('#sig-recover tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.step + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.maths) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.value) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('sig-recover-note',
      'Two subtractions and two modular inverses — that is the entire attack, and it is why the ' +
      'nonce requirement is not advice but a precondition. Note what is NOT needed: no weakness ' +
      'in the curve, no side channel, no access to the signer, and no large computation. The ' +
      'attacker needs two signatures, which are public by definition, and the arithmetic runs in ' +
      'microseconds at any key size. That is the difference between a bug that degrades security ' +
      'and one that removes it.');
  }

  function paintChecks(chain, variant) {
    root.jQuery('#sig-chain-checks tbody').html(chain.result.checks.map(function (check) {
      return '<tr><td>' + check.name + '</td><td class="mono">' + (check.ok ? 'ok' : 'FAIL') +
        '</td><td>' + check.detail + '</td></tr>';
    }).join(''));

    const failed = chain.result.failed;

    root.Helpers.setText('sig-chain-note',
      'Validating "' + variant + '" against host ' + chain.host + ' applied ' +
      root.Format.exact(chain.result.checks.length) + ' checks and ' +
      (failed.length === 0
        ? 'all of them passed. Every row is a separate way a chain can be wrong, and a client ' +
          'that omits any single row accepts certificates it should not.'
        : root.Format.exact(failed.length) + ' failed, starting with "' + failed[0].name +
          '". That one row is the whole difference between this chain and the valid one — every ' +
          'other check still passes, which is exactly why a validator that skips it sees nothing ' +
          'wrong.') +
      ' Real validation adds more: extended key usage, name constraints, path-length limits, ' +
      'signature-algorithm policy, and revocation. The list only grows.');
  }

  function paintKinds() {
    const rows = [
      { property: 'Who can produce it', mac: 'anyone holding the shared key',
        signature: 'only the private-key holder',
        consequence: 'a MAC proves nothing to a third party, because the verifier could have made it' },
      { property: 'Who can verify it', mac: 'anyone holding the shared key',
        signature: 'anyone at all, from the public key',
        consequence: 'signatures scale to parties who have never met' },
      { property: 'Size', mac: '32 bytes for HMAC-SHA-256',
        signature: '64 bytes for Ed25519, 256+ for RSA',
        consequence: 'MACs are cheaper where both ends share a key already' },
      { property: 'Speed', mac: 'one or two hash passes',
        signature: 'elliptic-curve or modular exponentiation, orders slower',
        consequence: 'per-packet authentication uses MACs; per-session setup uses signatures' },
      { property: 'Non-repudiation', mac: 'no', signature: 'yes',
        consequence: 'the reason certificates, code signing and audit logs use signatures' },
      { property: 'What a key compromise costs', mac: 'forgery from now on',
        signature: 'forgery from now on AND every past signature becomes suspect',
        consequence: 'timestamping and transparency logs exist to bound this' }
    ];

    root.jQuery('#sig-kinds tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.property + '</td><td>' + row.mac + '</td><td>' + row.signature +
        '</td><td>' + row.consequence + '</td></tr>';
    }).join(''));

    root.Helpers.setText('sig-kinds-note',
      'The first row is the distinction everything else follows from. Because a MAC key is ' +
      'shared, the verifier could have produced the tag themselves, so a MAC can never settle a ' +
      'dispute between the two parties holding it — and that is not a weakness, it is what makes ' +
      'MACs fast and symmetric. Choose a signature when a third party has to be convinced, and a ' +
      'MAC when the two ends already share a key and speed matters. Using a signature for ' +
      'per-packet authentication is a performance mistake; using a MAC for an audit log is a ' +
      'design mistake.');
  }

  function paintRevocation() {
    const rows = [
      { mechanism: 'CRL — certificate revocation list',
        learns: 'downloads a list of revoked serials from the CA',
        wrong: 'the list is large, cached and stale; browsers largely stopped fetching them',
        status: 'effectively abandoned for the public web' },
      { mechanism: 'OCSP — an online query per certificate',
        learns: 'asks the CA about this specific certificate',
        wrong: 'adds a third-party round trip, leaks browsing to the CA, and fails OPEN when the ' +
          'responder is unreachable — so blocking the responder defeats it',
        status: 'being retired; Let’s Encrypt stopped issuing OCSP URLs in 2025' },
      { mechanism: 'OCSP stapling', learns: 'the server presents a fresh signed status itself',
        wrong: 'only works if the server staples, and "must-staple" is rarely set',
        status: 'useful where deployed, not universal' },
      { mechanism: 'Short-lived certificates', learns: 'nothing — expiry does the work',
        wrong: 'requires automated issuance and renewal to be reliable',
        status: 'the practical answer; 90 days is standard and shorter is coming' },
      { mechanism: 'Certificate Transparency',
        learns: 'every issued certificate is logged publicly and monitored',
        wrong: 'detects misissuance rather than preventing it',
        status: 'required by browsers, and it has caught real misissuance' }
    ];

    root.jQuery('#sig-revocation tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.mechanism + '</td><td>' + row.learns + '</td><td>' + row.wrong +
        '</td><td>' + row.status + '</td></tr>';
    }).join(''));

    root.Helpers.setText('sig-revocation-note',
      'The uncomfortable summary is that the two mechanisms designed to revoke a certificate ' +
      'both failed operationally, and the industry solved the problem by making certificates ' +
      'expire quickly instead. Read the OCSP row carefully: it fails open, so an attacker able ' +
      'to use a stolen certificate is generally also able to block the query that would report ' +
      'it stolen. Certificate Transparency is a different kind of answer — it does not stop ' +
      'misissuance, it makes it impossible to do quietly, and that has proved more useful than ' +
      'any revocation protocol.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
