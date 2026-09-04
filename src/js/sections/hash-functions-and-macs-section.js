/**
 * Section: hash functions and MACs.
 *
 * The measurement is a forgery. The demo takes a tag produced by the naive
 * `hash(secret ‖ message)` construction, appends text the key holder never
 * authorised, and computes a tag that the key holder's own verifier accepts —
 * without ever learning the secret. The same attack is then run against HMAC
 * and fails. Both outcomes are computed at render time, not asserted in prose.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'hash-functions-and-macs';
  const ORIGINAL = 'user=bob&role=guest';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the Merkle–Damgård chain, and why its last state is the vulnerability',
      caption: 'SHA-1 and SHA-2 absorb a message one block at a time, each block updating a ' +
        'running state, and the digest they publish IS that final state. That is the whole bug: ' +
        'anyone holding the digest holds a resumable machine. They cannot run it backwards to ' +
        'recover the secret, but they can run it FORWARD over blocks of their own choosing, which ' +
        'produces a legitimate tag for a longer message. A sponge (SHA-3) truncates its state ' +
        'before publishing, so the digest is not resumable, and HMAC hashes twice so the ' +
        'published value is the output of a hash whose input the attacker cannot extend.',
      definition: [
        'flowchart LR',
        '    IV["IV"] --> C1["compress<br/>secret ‖ message block 1"]',
        '    C1 --> C2["compress<br/>block 2"]',
        '    C2 --> C3["compress<br/>block 3 + padding"]',
        '    C3 --> T["digest = the final state<br/>PUBLISHED"]',
        '    T -. "the attacker resumes<br/>from here" .-> A["compress<br/>attacker blocks"]',
        '    A --> F["a tag the verifier accepts"]'
      ].join('\n')
    };
  }

  function orientationResistances() {
    return [
      '**⚠ Teaching code: not constant-time, not audited, never for real data.** Use ' +
        '`crypto.subtle` or libsodium. These implementations exist so the attack can be executed ' +
        'rather than described.',
      '**A hash promises three separate things and they cost different amounts.** Preimage is: ' +
        'given a digest, find any input producing it. Second preimage is: given an input, find a ' +
        'different one with the same digest.',
      'Collision is: find any two inputs that agree. The first two cost about 2^n and the third ' +
        'costs about 2^(n/2), and that gap is the birthday bound.',
      '**The birthday bound halves your digest.** SHA-256 gives 256-bit preimage resistance and ' +
        '128-bit collision resistance, and the demo computes the number of samples at which a ' +
        'collision becomes even money.',
      'It is why a collision-resistant use needs twice the output length a preimage-resistant use ' +
        'does.',
      '**Merkle–Damgård publishes its internal state as the digest.** SHA-1 and SHA-2 compress ' +
        'block by block into a running state and then print it.',
      'An attacker holding the digest holds a machine they can resume. Not run backwards, but ' +
        'forwards, over blocks of their own choosing.'
    ];
  }

  function orientationForgery() {
    return [
      '**Which makes `hash(secret ‖ message)` forgeable, and the demo forges it.** The attacker ' +
        'needs the tag and the LENGTH of the secret, not the secret itself.',
      'They compute the padding the original message would have received, resume from the ' +
        'published digest, hash their own suffix, and emit a tag the verifier accepts.',
      '**HMAC exists precisely for this, and it defeats the same attack in the demo.** Hashing ' +
        'twice with two derived keys means the published value is the OUTER hash\'s output, so ' +
        'resuming from it extends a message the verifier never hashes.',
      '`hash(message ‖ secret)` also resists extension, but loses to collisions on the message.',
      '**A sponge does not have the property at all.** SHA-3 and BLAKE3 keep a state wider than ' +
        'their output and publish a truncated slice, so there is nothing to resume from.',
      'Both offer keyed modes directly, so the HMAC wrapper is unnecessary rather than merely ' +
        'redundant.',
      '**This is still being reinvented incorrectly.** API-signing schemes that concatenate a ' +
        'shared secret with a canonicalised request and hash the result are the same construction ' +
        'as the one the demo breaks, and they ship regularly.',
      'The fix is one function call, and the failure is a complete authentication bypass.'
    ];
  }

  function orientation() {
    return orientationResistances().concat(orientationForgery());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — forge a valid tag without ever seeing the secret',
        markup: root.HashMacTemplate.render()
      },
      diagram: diagram(),
      insight: '**The length-extension property is why HMAC exists, and it is still being ' +
        'reinvented incorrectly in API-signing schemes today.** The reason it keeps happening is ' +
        'that `hash(secret ‖ request)` looks obviously correct. The secret is in there, the hash ' +
        'is strong, and no amount of staring at the digest reveals the key. The flaw is not in ' +
        'the hash at all. It is in what Merkle–Damgård chooses to publish, and it is invisible ' +
        'unless you already know to look for it. That is the general lesson of the milestone in ' +
        'one construction. The primitive is fine, the composition is the vulnerability, and the ' +
        'only defence is using the composition somebody has already attacked.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.HashMacTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const attackFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const hash = root.CryptoHash;
    const secret = hash.bytesOf('S'.repeat(Number(parts[0])));
    const original = hash.bytesOf(ORIGINAL);
    const suffix = hash.bytesOf(parts[1]);
    const naive = hash.lengthExtend({ secretLength: secret.length, original: original,
      suffix: suffix, tag: hash.naiveMac(secret, original) });
    const keyed = hash.lengthExtend({ secretLength: secret.length, original: original,
      suffix: suffix, tag: hash.hmacMac(secret, original) });

    return {
      naive: naive,
      naiveAccepted: hash.hex(hash.naiveMac(secret, naive.message)) === hash.hex(naive.tag),
      hmacAccepted: hash.hex(hash.hmacMac(secret, keyed.message)) === hash.hex(keyed.tag),
      honestTag: hash.hex(hash.naiveMac(secret, original)),
      suffix: parts[1], secretLength: secret.length
    };
  });

  function update() {
    const values = panel.values();
    const attack = attackFor(values['hsh-secret'] + '|' + values['hsh-suffix']);

    root.Helpers.setText('hsh-disclaimer', root.CryptoHash.DISCLAIMER);
    paintMetrics(attack);
    paintForgery(attack);
    paintSteps(attack);
    paintMacs();
    paintBounds();
  }

  function paintMetrics(attack) {
    const half = root.CryptoHash.birthday(256, 0).halfAt;

    root.MetricGrid.update({
      'hsh-forged': { value: attack.naiveAccepted ? 'yes' : 'no',
        note: attack.naiveAccepted
          ? 'the verifier holding the secret recomputes this exact tag'
          : 'the forgery failed, which would mean the padding rule is wrong' },
      'hsh-glue': { value: root.Format.exact(attack.naive.glueLength) + ' bytes',
        note: 'computed from the length ' + root.Format.exact(attack.secretLength) +
          ' + ' + root.Format.exact(ORIGINAL.length) + ', never from the secret' },
      'hsh-hmac': { value: attack.hmacAccepted ? 'yes' : 'no',
        note: attack.hmacAccepted
          ? 'HMAC was extended, which would be a break of HMAC'
          : 'the published value is the outer hash, and resuming it extends nothing' },
      'hsh-half': { value: half.toExponential(4),
        note: 'about 2^128 — SHA-256 gives 128-bit collision resistance, not 256' }
    });
  }

  function paintForgery(attack) {
    const hash = root.CryptoHash;
    const shown = attack.naive.message.map(function (byte) {
      return byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '·';
    }).join('');

    root.jQuery('#hsh-forgery').html(
      '<div class="mono" style="font-size:.85rem;word-break:break-all">' +
      root.Helpers.escapeHtml(shown) + '</div>' +
      '<div class="mono" style="font-size:.8rem;margin-top:.5rem">tag ' +
      hash.hex(attack.naive.tag) + '</div>');

    root.Helpers.setText('hsh-forgery-note',
      'That is the message the attacker submits and the tag they submit with it, and the ' +
      'verifier accepts the pair. The dots are the glue — ' +
      root.Format.exact(attack.naive.glueLength) + ' bytes of padding that the original message ' +
      'would have received, which the attacker reconstructs from its LENGTH alone. Anything after ' +
      'the glue is theirs: here "' + attack.suffix + '", which a parser reading the last value of ' +
      'a repeated key will happily honour. The honest tag was ' +
      attack.honestTag.slice(0, 16) + '…; the forged one is ' +
      hash.hex(attack.naive.tag).slice(0, 16) + '…, and both verify.');
  }

  function paintSteps(attack) {
    const rows = [
      { step: '1', does: 'observes one legitimate message and its tag',
        needs: 'a single request it is allowed to make',
        result: 'the tag ' + attack.honestTag.slice(0, 12) + '…' },
      { step: '2', does: 'guesses the secret length (or tries each in turn)',
        needs: 'nothing — there are only a few dozen plausible lengths',
        result: root.Format.exact(attack.secretLength) + ' bytes' },
      { step: '3', does: 'computes the padding the original message received',
        needs: 'only the total length, because padding is a function of length',
        result: root.Format.exact(attack.naive.glueLength) + ' glue bytes' },
      { step: '4', does: 'loads the published tag back in as the hash state',
        needs: 'the Merkle–Damgård property — the digest IS the state',
        result: '8 words of resumed state' },
      { step: '5', does: 'hashes its own suffix from that state',
        needs: 'the byte offset, so the length field comes out right',
        result: 'a tag for a message it invented' },
      { step: '6', does: 'submits message ‖ glue ‖ suffix with the new tag',
        needs: 'a verifier that recomputes hash(secret ‖ message)',
        result: attack.naiveAccepted ? 'accepted' : 'rejected' }
    ];

    root.jQuery('#hsh-steps tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.step + '</td><td>' + row.does + '</td><td>' + row.needs +
        '</td><td class="mono">' + row.result + '</td></tr>';
    }).join(''));

    root.Helpers.setText('hsh-steps-note',
      'Read the third column on its own: a legitimate request, a guessed length, a padding rule ' +
      'from the specification, and a resumable state. Not one row needs the secret, and not one ' +
      'row needs a weakness in SHA-256 — the hash behaves exactly as designed throughout. The ' +
      'attack costs one hash computation, works on the first try when the length guess is right, ' +
      'and can simply be repeated for every plausible length when it is not.');
  }

  function paintMacs() {
    const rows = [
      { construction: 'hash(secret ‖ message)', extendable: 'YES',
        why: 'the digest is the resumable state after the secret was absorbed',
        verdict: 'broken — the demo forges it above' },
      { construction: 'hash(message ‖ secret)', extendable: 'no',
        why: 'the attacker cannot append past the secret',
        verdict: 'weak — a collision on the message forges the tag, and it is offline' },
      { construction: 'hash(secret ‖ message ‖ secret)', extendable: 'no',
        why: 'the trailing secret blocks the resume',
        verdict: 'ad hoc — no security proof, and folklore attacks exist on variants' },
      { construction: 'HMAC-SHA-256', extendable: 'no',
        why: 'the published value is the OUTER hash, over a digest the attacker cannot extend',
        verdict: 'correct — proved secure from the compression function, RFC 2104' },
      { construction: 'KMAC / SHA-3 keyed', extendable: 'no',
        why: 'a sponge publishes a truncated slice of a wider state',
        verdict: 'correct — and needs no wrapper, because the property is absent' },
      { construction: 'BLAKE3 keyed mode', extendable: 'no',
        why: 'the key parameterises the compression function itself',
        verdict: 'correct — and faster than HMAC over SHA-256' }
    ];

    root.jQuery('#hsh-macs tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + root.Helpers.escapeHtml(row.construction) + '</td><td>' +
        row.extendable + '</td><td>' + row.why + '</td><td>' + row.verdict + '</td></tr>';
    }).join(''));

    root.Helpers.setText('hsh-macs-note',
      'Only the first row is extendable, and only the last three rows are constructions with a ' +
      'proof behind them. The middle two are the interesting failures, because they are what ' +
      'people invent when they learn about length extension and try to patch around it: moving ' +
      'the secret to the end stops the extension and opens an offline collision attack instead, ' +
      'and wrapping the message in the secret at both ends produces something nobody has ' +
      'analysed. The lesson is not "avoid concatenation", it is that inventing a MAC is a ' +
      'research problem and HMAC already solved it.');
  }

  function paintBounds() {
    const rows = [64, 128, 160, 256, 512].map(function (bits) {
      const half = root.CryptoHash.birthday(bits, 0).halfAt;

      return { bits: bits, preimage: '2^' + bits, collision: '2^' + (bits / 2),
        half: half.toExponential(4), buys: buysFor(bits) };
    });

    root.jQuery('#hsh-bounds tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.bits + '</td><td class="mono">' + row.preimage +
        '</td><td class="mono">' + row.collision + '</td><td class="mono">' + row.half +
        '</td><td>' + row.buys + '</td></tr>';
    }).join(''));

    root.Helpers.setText('hsh-bounds-note',
      'The fourth column is computed from the birthday formula rather than quoted, and it is ' +
      'roughly the square root of the space in every row — which is the whole content of the ' +
      'bound. Read the 128-bit row: a digest that resists preimages at 2^128 resists collisions ' +
      'at only about 1.7 × 10^19 samples, and that is a number an adversary with a budget has ' +
      'reached in practice. MD5 and SHA-1 both fell to collision attacks that were cheaper still, ' +
      'while their preimage resistance was never broken at all — which is exactly why "is this ' +
      'hash broken?" is the wrong question and "broken for which of the three properties?" is the ' +
      'right one.');
  }

  function buysFor(bits) {
    if (bits === 64) return 'nothing — collisions are found in seconds';
    if (bits === 128) return 'MD5-sized; collisions are practical, preimages are not';
    if (bits === 160) return 'SHA-1-sized; a collision cost about 2^63 in 2017, not 2^80';
    if (bits === 256) return 'the working default — 128-bit collision resistance';
    return 'for when collision resistance itself must be 256-bit';
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
