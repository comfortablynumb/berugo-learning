/**
 * The double ratchet: forward secrecy and post-compromise security, which are
 * two different properties with two different mechanisms.
 *
 * ⚠ TEACHING CODE. Not constant-time, not audited, never for real data.
 *
 * - **Forward secrecy** means a compromise TODAY does not expose yesterday's
 *   messages. It comes from the symmetric ratchet: each message key is derived
 *   from a chain key, the chain key is then replaced by its own successor, and
 *   the old chain key is deleted. Since the KDF is one-way, holding the current
 *   chain key gives no route back to an earlier one.
 * - **Post-compromise security** — sometimes called future secrecy — means a
 *   compromise today stops mattering after both parties have exchanged fresh
 *   key material. It comes from the DH ratchet: every reply carries a new
 *   public key, and the new root key mixes in a shared secret the attacker
 *   never saw.
 *
 * Neither property is implied by "we use TLS". TLS gives forward secrecy on the
 * transport, and says nothing at all about the message store at either end.
 */
(function (root, factory) {
  const scope = typeof window !== 'undefined' ? window : null;
  const api = factory(scope);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (scope) scope.Ratchet = api;
}(this, function (root) {
  'use strict';

  const Hash = root && root.CryptoHash ? root.CryptoHash : require('./crypto-hash.js');
  const Pk = root && root.PublicKey ? root.PublicKey : require('./public-key.js');

  const DISCLAIMER = 'Teaching implementation: not constant-time, not audited, never for real data.';

  function label(text) {
    return Hash.bytesOf(text);
  }

  /* ---------------------------------------------------- symmetric ratchet */

  /**
   * One step: from a chain key, derive a message key and the NEXT chain key
   * with two different labels, then forget the old chain key. Two labels rather
   * than one is what stops the message key and the next chain key being the
   * same value, which would leak the chain forward.
   */
  function chainStep(chainKey) {
    return {
      messageKey: Hash.hmac('sha-256', chainKey, label('message')),
      nextChainKey: Hash.hmac('sha-256', chainKey, label('chain'))
    };
  }

  /** Run the chain for n messages, keeping every key so the demo can show what
   *  an attacker holding a later state can and cannot compute. */
  function chain(chainKey, count) {
    const keys = [];
    let current = chainKey.slice();

    for (let i = 0; i < count; i += 1) {
      const step = chainStep(current);

      keys.push({ index: i, messageKey: step.messageKey, chainKey: current });
      current = step.nextChainKey;
    }
    return { keys: keys, finalChainKey: current };
  }

  /**
   * The forward-secrecy check, done as a search rather than an assertion: given
   * the chain key at step t, can any earlier message key be produced by
   * stepping forward from it? Stepping forward is the only operation available,
   * so the answer is no — and the demo confirms it by trying.
   */
  function forwardSecrecy(config) {
    const run = chain(config.rootChainKey, config.messages);
    const compromisedAt = config.compromiseAt;
    const attackerState = run.keys[compromisedAt].chainKey;
    const derivable = [];
    let current = attackerState.slice();

    for (let i = compromisedAt; i < config.messages; i += 1) {
      const step = chainStep(current);

      derivable.push({ index: i, messageKey: step.messageKey });
      current = step.nextChainKey;
    }
    const exposed = run.keys.filter(function (entry) {
      return derivable.some(function (found) {
        return found.messageKey.every(function (byte, i) {
          return byte === entry.messageKey[i];
        });
      });
    });

    return {
      messages: config.messages,
      compromisedAt: compromisedAt,
      exposedIndices: exposed.map(function (entry) { return entry.index; }),
      pastSafe: exposed.every(function (entry) { return entry.index >= compromisedAt; }),
      futureExposed: exposed.length === config.messages - compromisedAt
    };
  }

  /* ----------------------------------------------------------- DH ratchet */

  /**
   * A session between two parties. Each side holds a root key and a sending
   * chain; a message carries the sender's current public key, and receiving a
   * NEW public key triggers a DH ratchet step — a fresh shared secret mixed
   * into the root, and a fresh chain on both sides.
   */
  function session(config) {
    const curve = config.curve;

    return {
      curve: curve,
      rootKey: config.rootKey.slice(),
      selfPrivate: config.selfPrivate,
      selfPublic: Pk.scalarMul(config.selfPrivate, curve.g, curve),
      remotePublic: config.remotePublic,
      sendChain: config.sendChain ? config.sendChain.slice() : config.rootKey.slice(),
      receiveChain: config.receiveChain ? config.receiveChain.slice() : config.rootKey.slice(),
      sent: 0, received: 0, ratchets: 0
    };
  }

  /**
   * Mix a fresh DH secret into the root and take a new chain key from it —
   * which is what makes a past compromise stop mattering.
   *
   * `role` says which side of the step this is. Both parties derive the SAME
   * chain key from the same mixed root; it is the sender's sending chain and
   * the receiver's receiving chain. Deriving two different keys with two labels
   * here is the bug that makes a hand-written ratchet deliver nothing after the
   * first turn change, because the two sides then step different chains.
   */
  function dhRatchet(state, remotePublic, role) {
    const shared = Pk.scalarMul(state.selfPrivate, remotePublic, state.curve);
    const material = Hash.bytesOf(String(shared.x) + ':' + String(shared.y));
    const mixed = Hash.hmac('sha-256', state.rootKey, material);
    const chainKey = Hash.hmac('sha-256', mixed, label('chain-key'));
    const next = { rootKey: mixed, remotePublic: remotePublic,
      ratchets: state.ratchets + 1 };

    if (role === 'receive') next.receiveChain = chainKey;
    else next.sendChain = chainKey;
    return Object.assign({}, state, next);
  }

  function sendMessage(state) {
    const step = chainStep(state.sendChain);

    return {
      state: Object.assign({}, state, { sendChain: step.nextChainKey, sent: state.sent + 1 }),
      messageKey: step.messageKey,
      header: { publicKey: state.selfPublic, index: state.sent }
    };
  }

  function receiveMessage(state, header) {
    let current = state;

    if (header.publicKey && !samePoint(header.publicKey, state.remotePublic)) {
      current = dhRatchet(state, header.publicKey, 'receive');
    }
    const step = chainStep(current.receiveChain);

    return {
      state: Object.assign({}, current,
        { receiveChain: step.nextChainKey, received: current.received + 1 }),
      messageKey: step.messageKey
    };
  }

  function samePoint(a, b) {
    if (!a || !b) return false;
    if (a.infinity || b.infinity) return a.infinity === b.infinity;
    return a.x === b.x && a.y === b.y;
  }

  /**
   * The whole point of the DH ratchet, as a measurement: compromise the root
   * key at a chosen message, then check which later messages the attacker can
   * still read. Before the next ratchet step they can read everything; after
   * it, nothing — because the new root mixes a secret they never saw.
   */
  function postCompromise(config) {
    const curve = config.curve;
    let alice = session({ curve: curve, rootKey: config.rootKey,
      selfPrivate: config.alicePrivate,
      remotePublic: Pk.scalarMul(config.bobPrivate, curve.g, curve) });
    const timeline = [];
    let stolenRoot = null;

    for (let i = 0; i < config.messages; i += 1) {
      if (i === config.compromiseAt) stolenRoot = alice.rootKey.slice();
      if (i === config.ratchetAt) {
        alice = dhRatchet(Object.assign({}, alice,
          { selfPrivate: config.aliceSecondPrivate }),
        Pk.scalarMul(config.bobSecondPrivate, curve.g, curve), 'send');
      }
      const sent = sendMessage(alice);

      alice = sent.state;
      timeline.push({
        index: i,
        rootKey: alice.rootKey,
        ratchets: alice.ratchets,
        readableWithStolenRoot: stolenRoot !== null
          && alice.rootKey.every(function (byte, at) { return byte === stolenRoot[at]; })
      });
    }
    return {
      timeline: timeline,
      compromisedAt: config.compromiseAt,
      ratchetAt: config.ratchetAt,
      readable: timeline.filter(function (entry) { return entry.readableWithStolenRoot; })
        .map(function (entry) { return entry.index; }),
      recoveredAt: timeline.filter(function (entry) {
        return entry.index >= config.compromiseAt && !entry.readableWithStolenRoot;
      }).map(function (entry) { return entry.index; })[0]
    };
  }

  /**
   * Two parties exchanging messages. The DH ratchet is what makes this a
   * DOUBLE ratchet: whenever a party becomes the sender after having been the
   * receiver, it rotates its key pair, and the new public key in the header
   * triggers a ratchet step on the other side. Runs of messages from one party
   * advance only the symmetric chain, which is why the ratchet count in the
   * trace rises on turn changes and nowhere else.
   */
  function conversation(config) {
    const curve = config.curve;
    const parties = startParties(config);
    const messages = [];
    let previousSender = null;
    let aliceKeyAt = 0;
    let bobKeyAt = 0;

    config.script.forEach(function (from, i) {
      const turnChanged = previousSender !== null && previousSender !== from;

      if (turnChanged) {
        const keys = from === 'alice' ? config.aliceKeys : config.bobKeys;
        const at = from === 'alice' ? (aliceKeyAt += 1) : (bobKeyAt += 1);
        const next = keys[at % keys.length];

        parties[from] = rotate(parties[from], next, curve);
      }
      messages.push(deliver(parties, from, i));
      previousSender = from;
    });
    return { messages: messages, alice: parties.alice, bob: parties.bob,
      ratchets: parties.alice.ratchets + parties.bob.ratchets,
      allDelivered: messages.every(function (entry) { return entry.keysMatch; }) };
  }

  function startParties(config) {
    const curve = config.curve;

    return {
      alice: session({ curve: curve, rootKey: config.rootKey,
        selfPrivate: config.aliceKeys[0],
        remotePublic: Pk.scalarMul(config.bobKeys[0], curve.g, curve) }),
      bob: session({ curve: curve, rootKey: config.rootKey,
        selfPrivate: config.bobKeys[0],
        remotePublic: Pk.scalarMul(config.aliceKeys[0], curve.g, curve) })
    };
  }

  /** A fresh key pair, and a DH ratchet against the remote public key already
   *  held — which is exactly what a real implementation does before replying. */
  function rotate(state, privateKey, curve) {
    const rotated = Object.assign({}, state, {
      selfPrivate: privateKey,
      selfPublic: Pk.scalarMul(privateKey, curve.g, curve)
    });

    return dhRatchet(rotated, state.remotePublic, 'send');
  }

  function deliver(parties, from, index) {
    const other = from === 'alice' ? 'bob' : 'alice';
    const sent = sendMessage(parties[from]);

    parties[from] = sent.state;
    const got = receiveMessage(parties[other], sent.header);

    parties[other] = got.state;
    return {
      index: index, from: from,
      keysMatch: sent.messageKey.every(function (byte, at) {
        return byte === got.messageKey[at];
      }),
      senderKey: sent.messageKey,
      ratchets: parties[other].ratchets
    };
  }

  return {
    DISCLAIMER: DISCLAIMER,
    chainStep: chainStep, chain: chain, forwardSecrecy: forwardSecrecy,
    session: session, dhRatchet: dhRatchet, sendMessage: sendMessage,
    receiveMessage: receiveMessage, postCompromise: postCompromise,
    conversation: conversation
  };
}));
