/**
 * Section: symmetric encryption and block cipher modes.
 *
 * Three attacks run here, all of them executed rather than described. The
 * picture is encrypted in ECB and the shape survives, which the distinct-block
 * count quantifies. The padding oracle decrypts a CBC ciphertext byte by byte
 * from an accept/reject answer alone, and the recovered text is printed. And a
 * CTR ciphertext is edited in flight so the recipient reads a different message
 * from the one that was sent — the malleability that authentication exists to
 * stop.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'symmetric-encryption';
  const KEY = '0123456789abcdef';
  const IV = 'fedcba9876543210';
  let panel = null;
  let surface = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — CBC chains, CTR counts, ECB does neither',
      caption: 'ECB sends every block through the same keyed permutation with nothing else mixed ' +
        'in, so equal plaintext blocks give equal ciphertext blocks and the structure of the ' +
        'message survives encryption. CBC breaks that by XORing each plaintext block with the ' +
        'previous ciphertext block, which makes the chain position-dependent — at the cost of ' +
        'being sequential to encrypt and needing padding, which is where the oracle lives. CTR ' +
        'never encrypts the plaintext at all: it encrypts a counter to make a keystream and XORs. ' +
        'That is parallel, needs no padding, and fails catastrophically if a counter value is ' +
        'ever reused under one key.',
      definition: [
        'flowchart TD',
        '    subgraph ECB',
        '      P1["block 1"] --> E1["E_k"] --> C1["cipher 1"]',
        '      P2["block 2 — IDENTICAL"] --> E2["E_k"] --> C2["cipher 2 — ALSO IDENTICAL"]',
        '    end',
        '    subgraph CBC',
        '      IV["IV"] --> X1(("XOR"))',
        '      Q1["block 1"] --> X1 --> F1["E_k"] --> D1["cipher 1"]',
        '      D1 --> X2(("XOR"))',
        '      Q2["block 2"] --> X2 --> F2["E_k"] --> D2["cipher 2"]',
        '    end',
        '    subgraph CTR',
        '      N1["nonce ‖ 1"] --> G1["E_k"] --> K1["keystream 1"] --> Y1(("XOR"))',
        '      R1["block 1"] --> Y1 --> S1["cipher 1"]',
        '    end'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**⚠ Teaching code: not constant-time, not audited, never for real data.** Use AES-GCM or ' +
        'ChaCha20-Poly1305 through an audited library; the raw modes below are here to be broken.',
      '**A block cipher is a keyed permutation on a fixed-size block, and nothing more.** AES ' +
        'maps 16 bytes to 16 bytes reversibly under a key, through rounds of substitution and ' +
        'permutation. It has no notion of a message, a length or an order — everything about ' +
        'encrypting real data is the MODE, and every failure in this section is a mode failure.',
      '**ECB leaks structure, and the picture in the demo shows it.** Encrypting each block ' +
        'independently means identical plaintext blocks give identical ciphertext blocks. The ' +
        'demo counts distinct blocks: the plaintext image and its ECB ciphertext have almost the ' +
        'same count, and the shape is still visible.',
      '**CBC needs an unpredictable IV, and reusing one leaks equality of prefixes.** Chaining ' +
        'each block into the next makes position matter, but the first block is XORed with the ' +
        'IV, so a fixed IV means two messages with the same opening reveal that they do.',
      '**CTR needs a never-repeated counter, and repeating one is worse than any of this.** The ' +
        'keystream is a function of the key and the counter alone, so encrypting two messages at ' +
        'the same counter value publishes the XOR of the two plaintexts. There is no partial ' +
        'failure here.',
      '**The padding oracle turns one bit of feedback into full decryption, and the demo runs ' +
        'it.** An attacker who can tell "the padding was invalid" from any other outcome — an ' +
        'error message, a status code, a response time — recovers the plaintext at about 128 ' +
        'queries per byte, without the key and without touching AES.',
      '**Unauthenticated ciphertext is malleable, and the demo edits one.** Flipping a bit in a ' +
        'CTR ciphertext flips exactly that bit in the plaintext, so an attacker who knows the ' +
        'message format rewrites its contents. Encryption without integrity is not a weaker ' +
        'protection, it is a different one that leaves this door open.',
      '**Which is why every one of these modes is the wrong answer in production.** ECB, CBC and ' +
        'CTR are components of authenticated modes, not choices you make. The next section builds ' +
        'the authenticated interface, and everything demonstrated here is a reason it exists.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — the ECB picture, a live padding oracle and a bit flip',
        markup: root.SymmetricTemplate.render()
      },
      diagram: diagram(),
      insight: '**The padding oracle needs only a yes/no answer, which means any error message ' +
        'or timing difference that distinguishes "bad padding" from "bad MAC" is a full plaintext ' +
        'disclosure.** That is a much stronger statement than it first sounds. The attacker does ' +
        'not need the key, does not need a weakness in AES, and does not need to see any ' +
        'plaintext — a single distinguishable bit, leaked however incidentally, is worth the ' +
        'whole message at roughly 128 queries per byte. It is why "we return a generic error" is ' +
        'a cryptographic requirement rather than a courtesy, why the timing of the two rejection ' +
        'paths has to match, and ultimately why the answer is a mode that never has two rejection ' +
        'paths to confuse.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SymmetricTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function keyBytes() { return root.CryptoLab.bytesOf(KEY); }
  function ivBytes() { return root.CryptoLab.bytesOf(IV); }

  const pictureFor = root.Helpers.memoise(function () {
    const image = root.CryptoLab.testImage(48, 48);
    const leak = root.CryptoLab.ecbLeakage({ image: image.data, key: keyBytes(), iv: ivBytes() });
    const ctr = root.BlockCipher.ctr(image.data, keyBytes(),
      root.CryptoLab.bytesOf('picture-nonce'));

    return { image: image, leak: leak, ctr: ctr,
      ctrDistinct: root.BlockImageView.distinctBlocks(ctr, 16) };
  });

  const oracleFor = root.Helpers.memoise(function (message) {
    const cipher = root.BlockCipher;
    const plaintext = root.CryptoLab.bytesOf(message);
    const ciphertext = cipher.cbcEncrypt(plaintext, keyBytes(), ivBytes());
    const attack = root.CryptoLab.paddingOracleAttack({ key: keyBytes(), iv: ivBytes(),
      ciphertext: ciphertext });

    return { attack: attack, ciphertext: ciphertext, plaintext: plaintext,
      text: (attack.plaintext || []).map(function (byte) {
        return String.fromCharCode(byte);
      }).join('') };
  });

  /* Flip the bits that turn "guest" into "admin" straight through a CTR
   * ciphertext. Nothing here needs the key: XOR is linear, so an edit to the
   * ciphertext is the identical edit to the plaintext. */
  const flipFor = root.Helpers.memoise(function () {
    const cipher = root.BlockCipher;
    const original = 'user=bob;role=guest';
    const target = 'user=bob;role=admin';
    const nonce = root.CryptoLab.bytesOf('one-shot-nonce');
    const ciphertext = cipher.ctr(root.CryptoLab.bytesOf(original), keyBytes(), nonce);
    const edited = ciphertext.slice();

    for (let i = 0; i < original.length; i += 1) {
      edited[i] ^= original.charCodeAt(i) ^ target.charCodeAt(i);
    }
    const delivered = cipher.ctr(edited, keyBytes(), nonce)
      .map(function (byte) { return String.fromCharCode(byte); }).join('');

    return { original: original, target: target, delivered: delivered,
      changed: edited.filter(function (byte, i) { return byte !== ciphertext[i]; }).length,
      succeeded: delivered === target, ciphertext: ciphertext, edited: edited };
  });

  function update() {
    const values = panel.values();
    const picture = pictureFor('');
    const oracle = oracleFor(values['sym-message']);
    const flip = flipFor('');

    root.Helpers.setText('sym-disclaimer', root.BlockCipher.DISCLAIMER);
    paintPicture(picture, values['sym-mode']);
    paintMetrics({ picture: picture, oracle: oracle, flip: flip, mode: values['sym-mode'] });
    paintRecovery(oracle);
    paintModes();
    paintOracle(oracle);
    paintMalleable(flip);
  }

  function paintPicture(picture, mode) {
    const host = document.getElementById('sym-picture');
    const shape = { width: picture.image.width, height: picture.image.height };
    const wrap = function (data) {
      return { width: shape.width, height: shape.height, data: data };
    };

    if (surface) surface.destroy();
    surface = root.BlockImageView.render(host, {
      images: [wrap(picture.image.data), wrap(picture.leak.ecb), wrap(picture.leak.cbc),
        wrap(picture.ctr)],
      titles: ['plaintext', 'ECB', 'CBC', 'CTR'],
      height: 200
    });

    root.Helpers.setText('sym-picture-note',
      'The second panel is the argument. Those are ciphertext bytes drawn as pixels, and the ' +
      'shape is still there — because ECB sends every 16-byte block through the same permutation ' +
      'with nothing to distinguish one position from another, so the ' +
      root.Format.exact(picture.leak.blocks) + ' blocks of this image collapse to just ' +
      root.Format.exact(picture.leak.ecbDistinct) + ' distinct ciphertext blocks, tracking the ' +
      root.Format.exact(picture.leak.plaintextDistinct) + ' distinct blocks the plaintext had. ' +
      'CBC gives ' + root.Format.exact(picture.leak.cbcDistinct) + ' distinct blocks — one per ' +
      'position, including the padding block it adds — and CTR gives ' +
      root.Format.exact(picture.ctrDistinct) + ' with no padding at all. Both of those panels are ' +
      'noise. The selector currently reads "' + mode + '"; the metric below reports that mode, ' +
      'and the modes table says what each one leaks beyond what this picture shows.');
  }

  function paintMetrics(state) {
    const leak = state.picture.leak;
    const distinct = state.mode === 'ecb' ? leak.ecbDistinct
      : state.mode === 'cbc' ? leak.cbcDistinct : state.picture.ctrDistinct;

    root.MetricGrid.update({
      'sym-distinct': { value: root.Format.exact(distinct) + ' of ' +
        root.Format.exact(leak.blocks),
      note: state.mode === 'ecb'
        ? 'the plaintext had ' + root.Format.exact(leak.plaintextDistinct) +
          ' — ECB preserved the count and the picture'
        : 'a chained or counter mode gives one distinct block per position' },
      'sym-recovered': { value: root.Format.exact((state.oracle.attack.plaintext || []).length) +
        ' bytes',
      note: state.oracle.attack.succeeded
        ? 'the whole message, from an oracle that only ever said yes or no'
        : 'the attack failed, which would mean the padding check is not a distinguisher' },
      'sym-queries': { value: root.Format.exact(state.oracle.attack.queries),
        note: root.Format.fixed(state.oracle.attack.queriesPerByte, 1) +
          ' per byte on average — bounded by 256, never by the key size' },
      'sym-flip': { value: state.flip.succeeded ? 'succeeded' : 'failed',
        note: root.Format.exact(state.flip.changed) +
          ' ciphertext bytes edited, and the recipient decrypts a different sentence' }
    });
  }

  function paintRecovery(oracle) {
    root.jQuery('#sym-recovery').html(
      '<div class="mono" style="font-size:.9rem;word-break:break-all">' +
      root.Helpers.escapeHtml(oracle.text) + '</div>');

    root.Helpers.setText('sym-recovery-note',
      'That text was never decrypted with the key. It was reconstructed from ' +
      root.Format.exact(oracle.attack.queries) + ' questions of the form "does this ciphertext ' +
      'have valid padding?", each answered yes or no. The attacker forges a previous block that ' +
      'makes the target block decrypt to padding of length 1, then 2, then 3, learning one byte ' +
      'of the intermediate state each time and XORing it with the real previous block to get the ' +
      'plaintext byte. AES was never attacked, the key was never guessed, and the only thing the ' +
      'server did wrong was distinguish one failure from another.');
  }

  function paintModes() {
    const rows = [
      { mode: 'ECB', needs: 'nothing', reuse: 'not applicable', parallel: 'yes',
        leaks: 'equality of plaintext blocks — which is the whole picture above' },
      { mode: 'CBC', needs: 'an unpredictable IV per message',
        reuse: 'leaks whether two messages share a prefix; a PREDICTABLE IV is the BEAST attack',
        parallel: 'decrypt only', leaks: 'nothing more, but it is malleable and it needs padding' },
      { mode: 'CFB', needs: 'a unique IV', reuse: 'as CBC', parallel: 'decrypt only',
        leaks: 'nothing more; largely of historical interest now' },
      { mode: 'CTR', needs: 'a never-repeated counter per key',
        reuse: 'publishes the XOR of both plaintexts — total, immediate failure',
        parallel: 'both ways', leaks: 'nothing while the counter is unique; no padding at all' },
      { mode: 'ChaCha20', needs: 'a never-repeated 96-bit nonce',
        reuse: 'identical failure to CTR', parallel: 'both ways',
        leaks: 'nothing while the nonce is unique; fast without AES hardware' }
    ];

    root.jQuery('#sym-modes tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.mode + '</td><td>' + row.needs + '</td><td>' + row.reuse +
        '</td><td>' + row.parallel + '</td><td>' + row.leaks + '</td></tr>';
    }).join(''));

    root.Helpers.setText('sym-modes-note',
      'The third column is where the operational risk lives, and it is not the same risk in ' +
      'every row. ECB has no value to reuse and fails anyway. CBC degrades: a repeated IV leaks a ' +
      'shared prefix, which is bad but bounded. CTR and ChaCha20 do not degrade at all — one ' +
      'repeat under one key hands over the XOR of two plaintexts, which for anything with known ' +
      'structure is both messages. None of the five rows provides integrity, and every one of ' +
      'them is malleable, which is what the last table demonstrates.');
  }

  function paintOracle(oracle) {
    const blocks = root.BlockCipher.blocksOf(oracle.ciphertext);
    const perBlock = Math.round(oracle.attack.queries / Math.max(1, blocks.length));
    const rows = blocks.map(function (block, index) {
      const bytes = (oracle.attack.recovered || []).slice(index * 16, index * 16 + 16);

      return { index: index + 1, queries: perBlock, bytes: bytes,
        text: bytes.map(function (byte) {
          return byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '·';
        }).join('') };
    });

    root.jQuery('#sym-oracle tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.index + '</td><td class="mono">' +
        root.Format.exact(row.queries) + '</td><td class="mono">' +
        root.Format.exact(row.bytes.length) + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.text) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('sym-oracle-note',
      root.Format.exact(blocks.length) + ' blocks, about ' + root.Format.exact(perBlock) +
      ' queries each, and the cost is linear in the length of the message rather than exponential ' +
      'in anything. That is the shape of the whole attack: each byte costs at most 256 queries ' +
      'because there are only 256 values to try, and the previously recovered bytes are what let ' +
      'the attacker forge padding of the next length. A message of a kilobyte costs a few hundred ' +
      'thousand requests, which is an afternoon against a service with no rate limiting and no ' +
      'alerting on repeated decryption failures.');
  }

  function paintMalleable(flip) {
    const rows = [
      { stage: 'What the sender encrypted', bytes: root.Format.exact(flip.original.length) +
        ' bytes', sees: flip.original },
      { stage: 'What the attacker changed',
        bytes: root.Format.exact(flip.changed) + ' ciphertext bytes XORed',
        sees: 'the attacker never saw the plaintext — only guessed the format' },
      { stage: 'What the recipient decrypted',
        bytes: root.Format.exact(flip.delivered.length) + ' bytes',
        sees: flip.delivered },
      { stage: 'What an authenticated mode would have done',
        bytes: 'one tag check',
        sees: 'rejected the ciphertext before decrypting a single byte' }
    ];

    root.jQuery('#sym-malleable tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.stage + '</td><td class="mono">' + row.bytes + '</td><td class="mono">' +
        root.Helpers.escapeHtml(row.sees) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('sym-malleable-note',
      'The attacker changed ' + root.Format.exact(flip.changed) + ' ciphertext bytes and the ' +
      'recipient read a different sentence, ' +
      (flip.succeeded ? 'exactly the one the attacker chose' : 'though not the intended one') +
      '. No key was involved and nothing was decrypted along the way — XOR is linear, so an edit ' +
      'to the ciphertext is precisely the same edit to the plaintext. The only defence is a tag ' +
      'the attacker cannot recompute, which is the fourth row and the subject of the next ' +
      'section. Until that row exists, "the traffic is encrypted" says nothing about whether the ' +
      'traffic still says what its sender wrote.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
