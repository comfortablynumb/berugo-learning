/**
 * Section: protocol construction.
 *
 * Forward secrecy and post-compromise security are two different properties
 * with two different mechanisms, and this demo separates them by measurement.
 * Steal the chain state at message k and the symmetric ratchet keeps every
 * earlier message safe — that is forward secrecy, and the exposed indices are
 * counted. Keep reading and the attacker stays in until a DH ratchet turns, at
 * which point the root key changes to something their stolen state cannot
 * produce — that is post-compromise security, and the recovery point is
 * reported rather than claimed.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'protocol-construction';
  const MESSAGES = 10;
  const SCRIPT = ['alice', 'alice', 'bob', 'alice', 'bob', 'bob', 'alice', 'bob'];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the two ratchets, and which property each one provides',
      caption: 'The symmetric ratchet advances a chain key by a one-way function for every ' +
        'message, so a message key can be derived going forward and never backwards: that is ' +
        'forward secrecy, and it costs one hash per message. The DH ratchet runs whenever the ' +
        'conversation changes direction, mixing a fresh Diffie–Hellman output into the root key ' +
        'so the new chain depends on a secret the attacker never saw: that is post-compromise ' +
        'security, and it costs one key exchange per turn. Neither mechanism provides the other ' +
        'property, which is why the double ratchet is double.',
      definition: [
        'sequenceDiagram',
        '    participant A as Alice',
        '    participant B as Bob',
        '    Note over A,B: root key from the initial agreement',
        '    A->>B: msg 1 — chain key advances (symmetric ratchet)',
        '    A->>B: msg 2 — chain key advances again',
        '    Note over A,B: earlier message keys are unrecoverable — forward secrecy',
        '    B->>A: reply — new DH public, root key remixed (DH ratchet)',
        '    Note over A,B: a stolen chain key is now useless — post-compromise security',
        '    A->>B: msg 3 — new chain, new keys'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**⚠ Teaching code: not constant-time, not audited, never for real data.** Use libsignal, ' +
        'Noise or TLS 1.3 rather than assembling a protocol from primitives.',
      '**A protocol is what turns primitives into a conversation.** Encryption protects a ' +
        'message. A protocol decides who the other party is and which keys this session uses. It ' +
        'also decides what happens when a message arrives twice or out of order, and what state ' +
        'survives a restart. Every one of those is a place to be attacked, and none of them is a ' +
        'primitive.',
      '**Key agreement without authentication buys nothing against an active attacker.** ' +
        'Diffie–Hellman with an unauthenticated peer agrees a key with whoever answered, which ' +
        'may be a machine in the middle running two exchanges. Binding the exchange to an ' +
        'identity — a signature, a certificate, a pre-shared key — is the other half.',
      '**Forward secrecy means a key stolen today does not open yesterday.** The mechanism is ' +
        'one-way derivation: each message key comes from a chain key that is then replaced by a ' +
        'hash of itself, so the old value cannot be reconstructed. The demo steals a chain state ' +
        'and counts which messages survive.',
      '**Post-compromise security means a key stolen today stops working tomorrow.** That is a ' +
        'different property and needs new secret material, which is what the DH ratchet ' +
        'contributes on every change of direction. The demo shows the exact message at which the ' +
        'attacker loses access.',
      '**"We use TLS" answers neither question about your stored messages.** TLS gives forward ' +
        'secrecy on the wire and ends at the server. If the application then stores the plaintext ' +
        'or a long-lived key, the properties the transport provided do not extend to that store. ' +
        'The threat model that matters is a different one.',
      '**Freshness and replay protection are separate again.** An attacker who cannot read or ' +
        'modify a message can still send it twice. Counters, per-message nonces bound into the ' +
        'derivation and windowed sequence checks are what stop that, and none of them is implied ' +
        'by authenticated encryption.',
      '**Downgrade attacks target the negotiation, not the algorithms.** If a protocol lets a ' +
        'network attacker steer both ends towards a weaker option, the strongest option is ' +
        'irrelevant. TLS 1.3 responded by removing almost everything negotiable and ' +
        'authenticating the transcript of what remains.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — steal a session state and watch when it stops working',
        markup: root.ProtocolTemplate.render()
      },
      diagram: diagram(),
      insight: '**Forward secrecy and post-compromise security are different properties with ' +
        'different mechanisms.** "We use TLS" answers neither question about your ' +
        'application-layer message store. The demo makes the difference concrete. The symmetric ' +
        'ratchet protects the past and does nothing for the future; the DH ratchet protects the ' +
        'future and does nothing for the past. You need both to bound a compromise on either ' +
        'side. The application lesson follows directly. Transport security ends at the server. ' +
        'If your messages sit in a database under a key that has not changed since deployment, ' +
        'neither property applies to the data that actually matters.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ProtocolTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function rootKey() {
    return root.CryptoHash.sha256(root.CryptoHash.bytesOf('shared secret from the initial agreement'));
  }

  const secrecyFor = root.Helpers.memoise(function (compromiseAt) {
    return root.Ratchet.forwardSecrecy({ rootChainKey: rootKey(), messages: MESSAGES,
      compromiseAt: Number(compromiseAt) });
  });

  const compromiseFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');

    return root.Ratchet.postCompromise({ curve: root.PublicKey.demoCurve(), rootKey: rootKey(),
      alicePrivate: 11n, bobPrivate: 23n, aliceSecondPrivate: 31n, bobSecondPrivate: 67n,
      messages: MESSAGES, compromiseAt: Number(parts[0]), ratchetAt: Number(parts[1]) });
  });

  const conversationFor = root.Helpers.memoise(function () {
    return root.Ratchet.conversation({ curve: root.PublicKey.demoCurve(), rootKey: rootKey(),
      alicePrivate: 11n, bobPrivate: 23n, aliceKeys: [31n, 41n, 53n], bobKeys: [67n, 79n, 97n],
      script: SCRIPT });
  });

  function update() {
    const values = panel.values();
    const compromiseAt = Number(values['pro-compromise']);
    const ratchetAt = Math.max(compromiseAt + 1, Number(values['pro-ratchet']));
    const secrecy = secrecyFor(String(compromiseAt));
    const run = compromiseFor(compromiseAt + '|' + ratchetAt);
    const conversation = conversationFor('');

    root.Helpers.setText('pro-disclaimer', root.Ratchet.DISCLAIMER);
    paintMetrics({ secrecy: secrecy, run: run, conversation: conversation,
      compromiseAt: compromiseAt, ratchetAt: ratchetAt });
    paintRadius({ secrecy: secrecy, run: run, compromiseAt: compromiseAt, ratchetAt: ratchetAt });
    paintTimeline(run, compromiseAt);
    paintConversation(conversation);
    paintProperties();
    paintHandshake();
  }

  function paintMetrics(state) {
    root.MetricGrid.update({
      'pro-past': { value: root.Format.exact(state.compromiseAt) + ' of ' +
        root.Format.exact(MESSAGES),
      note: state.secrecy.pastSafe
        ? 'every message before the theft stays unreadable — the chain only runs forwards'
        : 'an earlier message was derivable, which would break forward secrecy' },
      'pro-future': { value: root.Format.exact(state.run.readable.length) + ' messages',
        note: 'from the theft at ' + root.Format.exact(state.compromiseAt) +
          ' until the ratchet at ' + root.Format.exact(state.ratchetAt) },
      'pro-recover': { value: state.run.recoveredAt === undefined
        ? 'never in this run'
        : 'message ' + root.Format.exact(state.run.recoveredAt),
      note: state.run.recoveredAt === undefined
        ? 'no DH ratchet turned inside the window, so the attacker stayed in'
        : 'the root key mixed in a Diffie–Hellman output the attacker never saw' },
      'pro-delivered': { value: state.conversation.allDelivered
        ? root.Format.exact(state.conversation.messages.length) + ' of ' +
          root.Format.exact(state.conversation.messages.length)
        : 'incomplete',
      note: root.Format.exact(state.conversation.ratchets) +
          ' ratchet steps across the conversation, and every message still decrypted' }
    });
  }

  function paintRadius(state) {
    const exposed = state.secrecy.exposedIndices;

    root.jQuery('#pro-radius').html(
      '<div class="mono" style="font-size:.9rem">messages 0…' +
      root.Format.exact(MESSAGES - 1) + '</div>' +
      '<div class="mono" style="font-size:1.05rem;letter-spacing:.18em">' +
      Array.from({ length: MESSAGES }, function (ignored, i) {
        return exposed.indexOf(i) === -1 ? '·' : '✗';
      }).join('') + '</div>' +
      '<div class="mono" style="font-size:.8rem">✗ derivable from the stolen chain state</div>');

    root.Helpers.setText('pro-radius-note',
      'The attacker took the chain state at message ' + root.Format.exact(state.compromiseAt) +
      '. Everything before it stays closed — ' + root.Format.exact(state.compromiseAt) +
      ' messages — because each chain key is the hash of the last and hashing does not run ' +
      'backwards. Everything after it is open, because deriving forward is exactly what the ' +
      'legitimate party does. That is the shape of forward secrecy: it bounds the past ' +
      'perfectly and the future not at all, which is precisely why a second mechanism is ' +
      'needed. In the timeline below, the DH ratchet at message ' +
      root.Format.exact(state.ratchetAt) + ' is that second mechanism' +
      (state.run.recoveredAt === undefined
        ? ', though it did not close the window in this configuration.'
        : ', and it closes the window at message ' + root.Format.exact(state.run.recoveredAt) +
          '.'));
  }

  function paintTimeline(run, compromiseAt) {
    root.jQuery('#pro-timeline tbody').html(run.timeline.map(function (entry) {
      return '<tr><td class="mono">' + entry.index + '</td><td class="mono">' + entry.ratchets +
        '</td><td class="mono">' + (entry.readableWithStolenRoot ? 'YES' : 'no') + '</td><td>' +
        reasonFor(entry, compromiseAt, run.ratchetAt) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pro-timeline-note',
      'The middle column is the mechanism and the third is the consequence. Before the theft the ' +
      'attacker has nothing; from the theft at ' + root.Format.exact(compromiseAt) +
      ' they hold the root key and read along; and at the DH ratchet the root key is remixed ' +
      'with a fresh Diffie–Hellman output, which is material they never had, so the chain they ' +
      'are tracking stops matching. The important detail is that the recovery is not a repair ' +
      'action anybody took — nobody detected the compromise, nobody rotated anything. The ' +
      'protocol heals because turning the ratchet is what it does anyway on every change of ' +
      'direction.');
  }

  function reasonFor(entry, compromiseAt, ratchetAt) {
    if (entry.index < compromiseAt) return 'before the theft — the attacker holds nothing yet';
    if (entry.readableWithStolenRoot) return 'the root key is still the stolen one';
    if (entry.index >= ratchetAt) return 'the DH ratchet mixed in a secret the attacker never saw';
    return 'the root key has moved on';
  }

  function paintConversation(conversation) {
    let previous = null;

    root.jQuery('#pro-conversation tbody').html(conversation.messages.map(function (entry, i) {
      const changed = previous !== null && previous !== entry.from;

      previous = entry.from;
      return '<tr><td class="mono">' + i + '</td><td>' + entry.from + '</td><td class="mono">' +
        (changed ? 'yes — DH ratchet' : 'no') + '</td><td class="mono">' +
        (entry.keysMatch ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pro-conversation-note',
      'Eight messages in a realistic pattern — bursts from one side, then a reply — with ' +
      root.Format.exact(conversation.ratchets) + ' ratchet steps and every message decrypting ' +
      'correctly at the other end. That last column is the part a description skips over and an ' +
      'implementation lives or dies on: both sides have to arrive at the same key from different ' +
      'state, every time, including when messages cross in flight or arrive out of order. The ' +
      'derivation is one hash per message and one key exchange per turn, and getting the ' +
      'bookkeeping right is most of what a real implementation of this is.');
  }

  function paintProperties() {
    const rows = [
      { property: 'Forward secrecy',
        question: 'does a key stolen today open yesterday’s messages?',
        mechanism: 'one-way chain: derive the message key, replace the chain key with a hash',
        has: 'the symmetric ratchet; TLS 1.3 for the transport; not a static-key store' },
      { property: 'Post-compromise security',
        question: 'does a key stolen today still work tomorrow?',
        mechanism: 'mix new Diffie–Hellman output into the root on every change of direction',
        has: 'the DH ratchet; nothing that keeps one long-lived key' },
      { property: 'Replay protection',
        question: 'can an attacker send a captured message again?',
        mechanism: 'per-message counters, a sliding acceptance window, keys deleted after use',
        has: 'the ratchet by construction; TLS 1.3 0-RTT explicitly does NOT' },
      { property: 'Downgrade resistance',
        question: 'can an attacker steer both ends to a weaker option?',
        mechanism: 'authenticate the negotiation transcript, and remove options entirely',
        has: 'TLS 1.3, which cut the negotiable surface to almost nothing' }
    ];

    root.jQuery('#pro-properties tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.property + '</td><td>' + row.question + '</td><td>' +
        row.mechanism + '</td><td>' + row.has + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pro-properties-note',
      'Four rows, four mechanisms, and no mechanism appears twice — which is the point. It is ' +
      'tempting to treat these as degrees of "how secure is the protocol", and they are not: ' +
      'each one is a separate question with a separate answer, and a system can have any subset. ' +
      'The third row is the one most often assumed for free, and TLS 1.3\'s 0-RTT mode is the ' +
      'counterexample worth remembering — early data is replayable by design, which is a ' +
      'deliberate trade of a security property for a round trip.');
  }

  function paintHandshake() {
    const rows = [
      { step: 'ClientHello', sent: 'a fresh key-share for a named group, plus supported versions',
        establishes: 'the client’s half of the key agreement, sent before anything is agreed — ' +
          'which is why the round trip is saved' },
      { step: 'ServerHello', sent: 'the server’s key-share',
        establishes: 'the shared secret; from here everything is encrypted, including the rest ' +
          'of the handshake' },
      { step: 'Key schedule', sent: 'nothing — both sides derive',
        establishes: 'handshake and application traffic secrets by HKDF over the transcript hash' },
      { step: 'Certificate and CertificateVerify', sent: 'the chain, and a signature over the ' +
        'transcript', establishes: 'that the peer holds the private key AND that the transcript ' +
          'was not tampered with — the anti-downgrade binding' },
      { step: 'Finished', sent: 'a MAC over the whole transcript, both directions',
        establishes: 'that both sides saw identical handshakes; a mismatch aborts' },
      { step: 'Ephemeral keys discarded', sent: 'nothing',
        establishes: 'forward secrecy — the session key cannot be recovered from the long-term key' }
    ];

    root.jQuery('#pro-handshake tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.step + '</td><td>' + row.sent + '</td><td>' + row.establishes +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('pro-handshake-note',
      'Read the fourth and fifth rows together: the signature and the Finished MAC are both over ' +
      'the TRANSCRIPT, not over the message being sent. That is what makes downgrade attacks ' +
      'fail — an attacker who edits the ClientHello to remove strong options changes the ' +
      'transcript, and both sides detect it when the handshake is authenticated at the end. The ' +
      'last row is why RSA key transport was removed: with an ephemeral exchange, a long-term key ' +
      'stolen years later cannot decrypt recorded traffic, and with RSA key transport it could. ' +
      'M50 builds the full handshake; this is the cryptographic skeleton it hangs on.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
