/**
 * Section: authenticated encryption.
 *
 * Two executed attacks and a budget. Encrypting two messages under one nonce
 * publishes the XOR of their keystreams, and the demo reads the second
 * plaintext straight out of the two ciphertexts. Then, with GHASH's
 * authentication key in hand, it forges a tag for a ciphertext the sender never
 * produced and the receiver accepts it — which is the part that makes nonce
 * reuse worse than "the plaintexts leaked". The budget is the birthday
 * computation on a 96-bit nonce, which is why random nonces have a message
 * ceiling most designs never write down.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'authenticated-encryption';
  const FIRST = 'attack at dawn!';
  const SECOND = 'retreat by dusk';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the AEAD interface, and the channel that is authenticated but not encrypted',
      caption: 'An AEAD takes four inputs and returns two, and the shape of that interface is the ' +
        'design advice. Key and nonce are separate because the nonce is public and must never ' +
        'repeat; associated data is authenticated but not encrypted, which is where routing ' +
        'headers, message types and version numbers belong — visible to the network, but ' +
        'unchangeable without detection. Decryption returns plaintext OR a failure and never ' +
        'both, so there is no code path in which unverified bytes reach the application. Every ' +
        'attack in the previous section needed such a path to exist.',
      definition: [
        'flowchart LR',
        '    K["key"] --> E["AEAD encrypt"]',
        '    N["nonce — public, NEVER repeated"] --> E',
        '    P["plaintext — encrypted and authenticated"] --> E',
        '    A["associated data — authenticated, NOT encrypted"] --> E',
        '    E --> C["ciphertext"]',
        '    E --> T["tag"]',
        '    C --> D["AEAD decrypt"]',
        '    T --> D',
        '    A --> D',
        '    D --> OK["plaintext"]',
        '    D --> NO["failure — and NOTHING else"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**⚠ Teaching code: not constant-time, not audited, never for real data.** Use AES-GCM or ' +
        'ChaCha20-Poly1305 from `crypto.subtle` or libsodium — never a composition you assembled.',
      '**Confidentiality without integrity is almost always the wrong product.** The previous ' +
        'section edited a ciphertext into a different sentence with no key. An AEAD makes that ' +
        'impossible by refusing to return plaintext at all unless a tag the attacker cannot ' +
        'compute checks out first.',
      '**Encrypt-then-MAC is the only order with a general proof.** Tag the ciphertext, verify ' +
        'before you decrypt, and a forged ciphertext never reaches the decryption code — which ' +
        'removes the padding oracle by removing the code path it lived in. MAC-then-encrypt ' +
        'decrypts first and is how the padding oracles of the 2000s happened.',
      '**AEAD is that composition as a single interface, so the order cannot be got wrong.** One ' +
        'call, one key, and a decrypt that returns plaintext or a failure and never both. The ' +
        'associated-data channel authenticates headers without encrypting them.',
      '**Reusing a nonce under one key is the failure, and the demo executes it.** Both ' +
        'messages get the same keystream, so their ciphertexts XOR to their plaintexts XOR. The ' +
        'demo recovers the second message from the two ciphertexts and the first message alone.',
      '**And for GCM it is worse than plaintext disclosure: the authentication key falls too.** ' +
        'The demo takes GHASH\'s key, derives the tag mask from one known pair, then produces a ' +
        'valid tag for a ciphertext the sender never wrote — the receiver accepts it. Nonce ' +
        'reuse turns an eavesdropper into a forger.',
      '**GCM\'s 96-bit nonce gives random nonces a message ceiling, and the slider computes it.** ' +
        'Collisions follow the birthday bound, so the safe volume per key is around 2^32 ' +
        'messages, not 2^96. A counter nonce has no such ceiling and no such analysis, which is ' +
        'why it is the better default when a counter is available.',
      '**Misuse-resistant modes exist for when it is not.** AES-GCM-SIV derives its nonce from ' +
        'the message, so repeating a nonce leaks only that two messages were identical rather ' +
        'than handing over the keystream. It costs a second pass over the plaintext, which is a ' +
        'reasonable price where nonce uniqueness cannot be guaranteed.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — reuse one nonce, read the second message and forge a tag',
        markup: root.AeadTemplate.render()
      },
      diagram: diagram(),
      insight: '**With GCM, random nonces are unsafe past roughly 2^32 messages per key.** The ' +
        'fix is a counter nonce and a key-rotation policy, and most systems have neither written ' +
        'down. 2^32 messages sounds astronomical. It stops sounding astronomical once it is a ' +
        'fleet of services sharing one key through a config file, and then it is a few months. ' +
        'Nothing announces the crossing — no error, no metric, no degradation — and the failure ' +
        'when a nonce does repeat is not partial. The engineering answer is boring: use a ' +
        'counter when you have one, bound the message count per key when you do not, and rotate.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.AeadTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function bytes(text) { return root.CryptoLab.bytesOf(text); }

  const reuseFor = root.Helpers.memoise(function () {
    const aead = root.Aead;
    const key = bytes('0123456789abcdef');
    const nonce = bytes('reused-nonce');
    const run = aead.nonceReuse({ key: key, nonce: nonce, first: bytes(FIRST),
      second: bytes(SECOND) });

    return { run: run, forge: forgeFrom({ aead: aead, key: key, nonce: nonce, run: run }) };
  });

  /* The forgery the recovered authentication key enables. One known
   * (ciphertext, tag) pair gives the tag mask; from there any ciphertext of the
   * attacker's choosing gets a tag the receiver accepts. */
  function forgeFrom(state) {
    const aead = state.aead;
    const known = state.run.first;
    const mask = aead.xorBytes(known.tag, aead.ghash(state.run.authKey, [], known.ciphertext));
    const edited = known.ciphertext.slice();

    edited[0] ^= 0x20;
    edited[1] ^= 0x20;
    const tag = aead.xorBytes(aead.ghash(state.run.authKey, [], edited), mask);
    const checked = aead.gcmDecrypt({ key: state.key, nonce: state.nonce, ciphertext: edited,
      tag: tag, associated: [] });

    return { accepted: checked.verified, mask: mask, tag: tag,
      delivered: (checked.plaintext || []).map(function (byte) {
        return String.fromCharCode(byte);
      }).join('') };
  }

  const tamperFor = root.Helpers.memoise(function (suite) {
    return suite === 'aes-gcm' ? gcmTamper() : chachaTamper();
  });

  function gcmTamper() {
    const aead = root.Aead;
    const key = bytes('0123456789abcdef');
    const nonce = bytes('a-unique-once');
    const sealed = aead.gcmEncrypt({ key: key, nonce: nonce, plaintext: bytes('balance=1000'),
      associated: bytes('to=alice') });
    const check = function (change) {
      return aead.gcmDecrypt({ key: key, nonce: nonce,
        ciphertext: change.ciphertext || sealed.ciphertext,
        tag: change.tag || sealed.tag,
        associated: change.associated || bytes('to=alice') }).verified;
    };

    return trials(sealed, check);
  }

  function chachaTamper() {
    const aead = root.Aead;
    const key = bytes('0123456789abcdef0123456789abcdef');
    const nonce = bytes('unique-once1');
    const sealed = aead.chachaPolyEncrypt({ key: key, nonce: nonce,
      plaintext: bytes('balance=1000'), associated: bytes('to=alice') });
    const check = function (change) {
      return aead.chachaPolyDecrypt({ key: key, nonce: nonce,
        ciphertext: change.ciphertext || sealed.ciphertext,
        tag: change.tag || sealed.tag,
        associated: change.associated || bytes('to=alice') }).verified;
    };

    return trials(sealed, check);
  }

  function trials(sealed, check) {
    const flipped = sealed.ciphertext.slice();
    const truncated = sealed.tag.slice(0, sealed.tag.length - 1);
    const zeroed = sealed.tag.map(function () { return 0; });

    flipped[0] ^= 0x01;
    return [
      { change: 'nothing — the honest ciphertext', accepted: check({}),
        why: 'the tag was computed over exactly these bytes' },
      { change: 'one bit of the ciphertext', accepted: check({ ciphertext: flipped }),
        why: 'the tag covers the ciphertext, so any edit invalidates it' },
      { change: 'the associated data only',
        accepted: check({ associated: bytes('to=mallory') }),
        why: 'associated data is authenticated even though it is not encrypted' },
      { change: 'the tag, truncated by a byte', accepted: check({ tag: truncated }),
        why: 'a short tag is not a weaker tag, it is a rejected one' },
      { change: 'the tag, replaced with zeros', accepted: check({ tag: zeroed }),
        why: 'forging a tag means guessing 128 bits' }
    ];
  }

  function update() {
    const values = panel.values();
    const reuse = reuseFor('');
    const exponent = Number(values['aea-messages']);

    root.Helpers.setText('aea-disclaimer', root.Aead.DISCLAIMER);
    paintMetrics(reuse, exponent);
    paintReveal(reuse);
    paintSteps(reuse);
    paintOrder();
    paintTamper(tamperFor(values['aea-suite']), values['aea-suite']);
    paintNonce(exponent);
  }

  function collisionAt(exponent) {
    return root.CryptoHash.birthday(96, Math.pow(2, exponent)).probability;
  }

  function paintMetrics(reuse, exponent) {
    const probability = collisionAt(exponent);

    root.MetricGrid.update({
      'aea-keystream': { value: reuse.run.keystreamIdentical ? 'yes' : 'no',
        note: 'the two ciphertexts XOR to exactly the two plaintexts XOR' },
      'aea-recovered': { value: reuse.run.recoveredMatches
        ? root.Format.exact(SECOND.length) + ' of ' + root.Format.exact(SECOND.length) + ' bytes'
        : 'partial',
      note: 'recovered from the ciphertexts and one known plaintext, with no key' },
      'aea-forged': { value: reuse.forge.accepted ? 'accepted' : 'rejected',
        note: reuse.forge.accepted
          ? 'a tag for a ciphertext the sender never produced, and GCM verified it'
          : 'the forgery failed, which would mean GHASH is not linear' },
      'aea-collision': { value: probability < 1e-4
        ? probability.toExponential(3)
        : root.Format.fixed(probability * 100, 4) + '%',
      note: 'at 2^' + root.Format.exact(exponent) + ' messages under one key — the standard ' +
          'ceiling is where this stays under 2^-32, not under one half' }
    });
  }

  function paintReveal(reuse) {
    const text = reuse.run.recovered.map(function (byte) {
      return String.fromCharCode(byte);
    }).join('');

    root.jQuery('#aea-reveal').html(
      '<div class="mono" style="font-size:.9rem">known: ' + root.Helpers.escapeHtml(FIRST) +
      '</div><div class="mono" style="font-size:.9rem">recovered: ' +
      root.Helpers.escapeHtml(text) + '</div>' +
      '<div class="mono" style="font-size:.85rem;margin-top:.4rem">forged plaintext delivered: ' +
      root.Helpers.escapeHtml(reuse.forge.delivered) + '</div>');

    root.Helpers.setText('aea-reveal-note',
      'The eavesdropper knew one plaintext — a login banner, a fixed header, a message they sent ' +
      'themselves — and saw two ciphertexts produced under the same nonce. That is enough: the ' +
      'keystreams are identical, so the ciphertexts cancel to the plaintexts, and subtracting the ' +
      'known one leaves the other. The third line is the part that makes this different from an ' +
      'ordinary keystream reuse: with GHASH\'s key recovered, the attacker also produced a tag ' +
      'for a ciphertext of their own and GCM accepted it. They are no longer only reading.');
  }

  function paintSteps(reuse) {
    const hex = root.CryptoLab.hex;
    const rows = [
      { step: 'Two ciphertexts, one nonce',
        maths: 'C1 = P1 XOR S,  C2 = P2 XOR S',
        gives: 'the same keystream S in both' },
      { step: 'XOR the ciphertexts',
        maths: 'C1 XOR C2 = P1 XOR P2',
        gives: hex(reuse.run.ciphertextXor).slice(0, 20) + '… — the keystream cancels' },
      { step: 'Subtract the known plaintext',
        maths: '(P1 XOR P2) XOR P1 = P2',
        gives: '"' + reuse.run.recovered.map(function (byte) {
          return String.fromCharCode(byte);
        }).join('') + '"' },
      { step: 'Take GHASH’s key H',
        maths: 'H = E_k(0^128), the same for every message under this key',
        gives: hex(reuse.run.authKey).slice(0, 20) + '…' },
      { step: 'Derive the tag mask from a known pair',
        maths: 'mask = tag1 XOR GHASH(H, A, C1)',
        gives: hex(reuse.forge.mask).slice(0, 20) + '…' },
      { step: 'Tag any ciphertext you like',
        maths: 'tag′ = GHASH(H, A, C′) XOR mask',
        gives: reuse.forge.accepted ? 'accepted by the receiver' : 'rejected' }
    ];

    root.jQuery('#aea-steps tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.step + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.maths) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.gives) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('aea-steps-note',
      'The first three rows are the classic keystream reuse and they apply to CTR, ChaCha20 and ' +
      'every stream cipher. The last three are specific to GCM and are why its nonce requirement ' +
      'is stricter than "do not repeat, it leaks a bit". GHASH is a polynomial evaluation, which ' +
      'is linear, and linearity is exactly what an attacker needs to turn one known ' +
      '(ciphertext, tag) pair into a tag for any ciphertext at all. Confidentiality and ' +
      'authenticity fall together, from one repeated 96-bit value.');
  }

  function paintOrder() {
    const rows = [
      { order: 'Encrypt-then-MAC', verify: 'yes — the tag covers the ciphertext',
        used: 'IPsec, and every modern AEAD internally',
        verdict: 'correct — a forged ciphertext never reaches the decryption code' },
      { order: 'MAC-then-encrypt', verify: 'no — you must decrypt to find the tag',
        used: 'TLS up to 1.2, in the CBC suites',
        verdict: 'the padding-oracle shape; the decrypt path runs on attacker input' },
      { order: 'Encrypt-and-MAC', verify: 'no — the tag is over the plaintext',
        used: 'SSH',
        verdict: 'leaks plaintext equality through the tag, and needs the decrypt path too' },
      { order: 'AEAD as one interface', verify: 'yes — the API has no other order',
        used: 'TLS 1.3, WireGuard, Signal, age',
        verdict: 'correct, and the composition cannot be got wrong because it is not exposed' }
    ];

    root.jQuery('#aea-order tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.order + '</td><td>' + row.verify + '</td><td>' + row.used +
        '</td><td>' + row.verdict + '</td></tr>';
    }).join(''));

    root.Helpers.setText('aea-order-note',
      'The second column decides the other two. If the tag can be checked before anything is ' +
      'decrypted, then attacker-controlled bytes never reach the decryption code and there is no ' +
      'oracle to build — which is the whole reason the padding oracle of the previous section ' +
      'exists in TLS 1.2 and not in TLS 1.3. The fourth row is the practical lesson: the ' +
      'reliable fix was not teaching everyone the right order, it was removing the choice from ' +
      'the interface.');
  }

  function paintTamper(rows, suite) {
    root.jQuery('#aea-tamper tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.change + '</td><td class="mono">' +
        (row.accepted ? 'YES' : 'no') + '</td><td>' + row.why + '</td></tr>';
    }).join(''));

    const rejected = rows.filter(function (row) { return !row.accepted; }).length;

    root.Helpers.setText('aea-tamper-note',
      root.Format.exact(rejected) + ' of ' + root.Format.exact(rows.length) +
      ' were rejected by ' + suite + ', and the one that was accepted is the honest ciphertext — ' +
      'each row is an actual decryption attempt run when this page rendered, not a claim. The ' +
      'third row is the one worth pausing on: the associated data was never encrypted and is ' +
      'plainly visible on the wire, and changing it still fails the check. That is what the ' +
      'channel is for — routing headers, message types and version numbers that middleboxes must ' +
      'read and nobody may alter.');
  }

  function paintNonce(exponent) {
    const rows = [
      { strategy: 'Counter, 96-bit', risk: 'none while the counter is never reset',
        fails: 'a restart from stored state, a VM clone, or two writers sharing a key',
        use: 'the default whenever one writer owns the key' },
      { strategy: 'Random, 96-bit',
        risk: collisionAt(exponent).toExponential(3) + ' at 2^' + exponent + ' messages',
        fails: 'past roughly 2^32 messages per key — silently',
        use: 'when writers cannot coordinate, with a message budget written down' },
      { strategy: 'Random, 192-bit (XChaCha20)', risk: 'negligible at any realistic volume',
        fails: 'effectively never; the extended nonce is why XChaCha exists',
        use: 'when writers cannot coordinate and you would rather not do the arithmetic' },
      { strategy: 'Synthetic (AES-GCM-SIV)', risk: 'a repeat leaks only that two messages matched',
        fails: 'nothing catastrophically — that is the point of misuse resistance',
        use: 'when nonce uniqueness cannot be guaranteed and a second pass is affordable' }
    ];

    root.jQuery('#aea-nonce tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.strategy + '</td><td class="mono">' + row.risk + '</td><td>' +
        row.fails + '</td><td>' + row.use + '</td></tr>';
    }).join(''));

    root.Helpers.setText('aea-nonce-note',
      'The second row is the one that catches people, and the slider is there to make it ' +
      'concrete: at 2^' + root.Format.exact(exponent) + ' messages under one key the collision ' +
      'probability is ' + collisionAt(exponent).toExponential(3) + ', and it is the birthday ' +
      'bound rather than 2^96 that governs — the risk grows with the SQUARE of the message count, ' +
      'so every doubling of traffic quadruples it. Note what the 2^32 ceiling actually is: at ' +
      'that volume the probability is around 2^-33, and the standard picks the limit so the ' +
      'chance stays below 2^-32, not so it stays below one half. Pull the slider past 2^48 and ' +
      'the number stops looking like a rounding error. Nothing signals the crossing — no error, ' +
      'no metric, no slow degradation — and the failure when it happens is the whole attack ' +
      'above. Rows three and four exist because "just use a counter" is not always available.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
