/**
 * Section: password hashing and key derivation.
 *
 * Two things are measured rather than asserted. The iteration count is tuned in
 * this browser against a real verification budget, so the number the learner
 * sees is their machine's answer and not a folklore constant. And the attacker
 * economics are computed from the memory parameter: past a few tens of
 * megabytes the attacker stops being limited by cores and starts being limited
 * by RAM, which is the entire reason memory-hard functions exist.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'password-hashing';
  const BUDGET_MS = 250;
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — register, verify, and the rehash path that is usually missing',
      caption: 'Registration derives a key from the password and a fresh random salt, and stores ' +
        'the algorithm, the parameters and the salt alongside it — the record has to be ' +
        'self-describing, because the parameters will change. Verification re-derives with the ' +
        'stored parameters and compares in constant time. The dashed edge is the one most ' +
        'systems never build: on a SUCCESSFUL login the plaintext password is in hand for the ' +
        'only moment it ever will be, which is the only opportunity to re-derive at the current ' +
        'cost and replace the record. Without it, a cost parameter chosen in 2015 is still ' +
        'protecting accounts in 2026.',
      definition: [
        'flowchart TD',
        '    R["register"] --> S["fresh random salt, 16 bytes"]',
        '    S --> D["derive: algorithm + parameters + salt + password"]',
        '    D --> ST["store: algorithm, parameters, salt, key<br/>self-describing record"]',
        '    L["login"] --> V["re-derive with the STORED parameters"]',
        '    V --> C{"constant-time compare"}',
        '    C -->|no| X["reject"]',
        '    C -->|yes| A["accept"]',
        '    A -. "parameters below<br/>current policy?<br/>the password is in<br/>hand RIGHT NOW" .-> D'
      ].join('\n')
    };
  }

  function orientationSlowness() {
    return [
      '**⚠ Teaching code: not constant-time, not audited, never for real data.** Use argon2, ' +
        'bcrypt or scrypt from a maintained library, and never a hash you assembled yourself.',
      '**A password hash is deliberately slow, which inverts every other instinct you have.** ' +
        'SHA-256 is a good hash and a catastrophic password store, because being fast is its ' +
        'purpose.',
      'The demo puts an unsalted SHA-256 next to Argon2id at the same verification budget, and the ' +
        'attacker\'s guess rate differs by six orders of magnitude.',
      '**A salt is not a secret and does not need to be.** Its job is to make each stored hash a ' +
        'separate problem.',
      'One precomputed table then cannot cover the whole database, and two users with the same ' +
        'password do not visibly share a hash. The demo derives the same password under two salts ' +
        'and shows the keys differ.',
      '**A pepper is a secret, and it lives somewhere the database is not.** An application-held ' +
        'key mixed into the derivation means a stolen database alone is not enough.',
      'It defends against exactly one threat, which is database exfiltration without application ' +
        'compromise. It also complicates key rotation, so it is a considered choice rather than a ' +
        'default.'
    ];
  }

  function orientationParameters() {
    return [
      '**The parameter is the security control, not the algorithm.** Argon2id with a 4 MiB memory ' +
        'parameter is weaker than scrypt at 32 MiB.',
      'The demo\'s slider moves the memory parameter and the attacker\'s effective parallelism ' +
        'collapses with it, because their fixed RAM divides by your memory cost.',
      '**Memory hardness is what breaks GPUs and ASICs specifically.** A GPU has thousands of ' +
        'cores and comparatively little memory per core.',
      'So a function that demands tens of megabytes per guess turns thousands of parallel attempts ' +
        'into dozens. That is why PBKDF2, which needs almost no memory, is the weakest survivor of ' +
        'the four.',
      '**Tune against a measured verification time, not a number from a blog post.** The demo ' +
        'measures PBKDF2 in this browser and reports the iteration count that fits a 250 ms budget ' +
        'here.',
      'On your production hardware the answer is different, which is the point. The correct ' +
        'parameter is whatever exhausts your budget today.',
      '**Which means the rehash-on-successful-login path is mandatory and usually absent.** ' +
        'Parameters must rise as hardware improves, and the only moment you hold the plaintext ' +
        'password to re-derive with is a successful login.',
      'A system without that path is frozen at whatever cost it launched with.'
    ];
  }

  function orientation() {
    return orientationSlowness().concat(orientationParameters());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — pick a storage scheme and price the attacker',
        markup: root.PasswordTemplate.render()
      },
      diagram: diagram(),
      insight: '**The parameter, not the algorithm, is the security control, and it must be ' +
        're-tuned as hardware improves. That requires the rehash-on-successful-login path that ' +
        'most systems never build.** "We use bcrypt" is not an answer to "how expensive is a ' +
        'guess". Bcrypt at cost 4 and bcrypt at cost 12 differ by a factor of 256, and ' +
        'both are bcrypt. And a cost chosen once at launch decays. The same parameter buys less ' +
        'every year as hardware improves. A store that cannot raise it is a store whose ' +
        'security is a function of how long ago it was written. The engineering work is the ' +
        'self-describing record and the upgrade path, not the choice between three good ' +
        'algorithms.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.PasswordTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const SCHEMES = {
    sha256: { label: 'SHA-256, unsalted', verifyMs: 0.002, memoryKb: 0, salted: false },
    'sha256-salted': { label: 'SHA-256 with a salt', verifyMs: 0.002, memoryKb: 0, salted: true },
    pbkdf2: { label: 'PBKDF2-HMAC-SHA-256, 600 000', verifyMs: BUDGET_MS, memoryKb: 0,
      salted: true },
    bcrypt: { label: 'bcrypt, cost 12', verifyMs: BUDGET_MS, memoryKb: 4, salted: true },
    scrypt: { label: 'scrypt, N = 2^15', verifyMs: BUDGET_MS, memoryKb: 32768, salted: true },
    argon2id: { label: 'Argon2id', verifyMs: BUDGET_MS, memoryKb: null, salted: true }
  };

  function schemeCost(name, memoryMib) {
    const scheme = SCHEMES[name];
    const memoryKb = scheme.memoryKb === null ? memoryMib * 1024 : scheme.memoryKb;

    return root.Kdf.crackingCost({ verifyMs: scheme.verifyMs, memoryKb: memoryKb });
  }

  const tunedFor = root.Helpers.memoise(function () {
    const clock = root.performance && root.performance.now
      ? function () { return root.performance.now(); }
      : function () { return Date.now(); };

    return root.Kdf.tuneIterations({ clock: clock, budgetMs: BUDGET_MS, sample: 2000 });
  });

  const saltFor = root.Helpers.memoise(function () {
    const hash = root.CryptoHash;

    return root.Kdf.saltEffect({ password: hash.bytesOf('correct horse battery staple'),
      saltA: hash.bytesOf('salt-for-user-a'), saltB: hash.bytesOf('salt-for-user-b'),
      iterations: 500 });
  });

  const rehashFor = root.Helpers.memoise(function () {
    const hash = root.CryptoHash;
    const password = hash.bytesOf('correct horse battery staple');
    const record = root.Kdf.register({ password: password, salt: hash.bytesOf('an-old-salt'),
      iterations: 1000 });

    return root.Kdf.verifyPassword(record, password, 30000);
  });

  function update() {
    const values = panel.values();
    const memoryMib = Number(values['pwd-memory']);
    const cost = schemeCost(values['pwd-algorithm'], memoryMib);

    root.Helpers.setText('pwd-disclaimer', root.Kdf.DISCLAIMER);
    paintMetrics(cost, tunedFor(''));
    paintVerdict({ name: values['pwd-algorithm'], cost: cost, memoryMib: memoryMib });
    paintCompare(memoryMib);
    paintSweep();
    paintRecord(saltFor(''), rehashFor(''));
  }

  function paintMetrics(cost, tuned) {
    root.MetricGrid.update({
      'pwd-verify': { value: root.Format.exact(BUDGET_MS) + ' ms',
        note: 'the budget every row below is priced at, so only the parameters differ' },
      'pwd-tuned': { value: root.Format.exact(tuned.iterations),
        note: 'PBKDF2-HMAC-SHA-256 iterations that fill ' + root.Format.exact(BUDGET_MS) +
          ' ms here — ' + root.Format.fixed(tuned.perIterationMs * 1000, 2) +
          ' µs each, measured over ' + root.Format.exact(tuned.sampleIterations) },
      'pwd-guesses': { value: cost.guessesPerSecond.toExponential(3),
        note: cost.memoryLimited
          ? 'and the attacker is limited by RAM, not by cores'
          : 'the attacker uses every core they own' },
      'pwd-days': { value: cost.daysForEightChars < 1
        ? root.Format.fixed(cost.daysForEightChars * 24, 2) + ' hours'
        : root.Format.exact(Math.round(cost.daysForEightChars)) + ' days',
      note: '62^8 = 218 trillion candidates at that rate' }
    });
  }

  function paintVerdict(state) {
    const scheme = SCHEMES[state.name];
    const memory = scheme.memoryKb === null ? state.memoryMib * 1024 : scheme.memoryKb;

    root.jQuery('#pwd-verdict').html(
      '<div class="mono" style="font-size:.95rem">' + root.Helpers.escapeHtml(scheme.label) +
      (scheme.memoryKb === null ? ', ' + state.memoryMib + ' MiB' : '') + '</div>' +
      '<div class="mono" style="font-size:.85rem;margin-top:.4rem">' +
      root.Format.exact(state.cost.effectiveCores) + ' parallel guesses · ' +
      state.cost.guessesPerSecond.toExponential(3) + ' guesses/second</div>');

    root.Helpers.setText('pwd-verdict-note',
      'At a ' + root.Format.exact(BUDGET_MS) + ' ms verification budget and ' +
      root.Format.exact(memory) + ' KiB per guess, a rig with 4 096 cores and 16 GiB of memory ' +
      'runs ' + root.Format.exact(state.cost.effectiveCores) + ' guesses at a time' +
      (state.cost.memoryLimited
        ? ' — fewer than it has cores, because your memory parameter divided its RAM. That is ' +
          'the mechanism: you did not slow its cores down, you took most of them away.'
        : ' — every core it owns, because this scheme asks for almost no memory and nothing ' +
          'constrains its parallelism.') +
      ' An 8-character random password falls in ' +
      (state.cost.daysForEightChars < 1
        ? root.Format.fixed(state.cost.daysForEightChars * 24, 2) + ' hours'
        : root.Format.exact(Math.round(state.cost.daysForEightChars)) + ' days') +
      ', and a password from a leak list falls immediately regardless of the setting.');
  }

  function paintCompare(memoryMib) {
    const rows = Object.keys(SCHEMES).map(function (name) {
      const scheme = SCHEMES[name];
      const cost = schemeCost(name, memoryMib);
      const memoryKb = scheme.memoryKb === null ? memoryMib * 1024 : scheme.memoryKb;

      return { label: scheme.label, verify: scheme.verifyMs, memoryKb: memoryKb, cost: cost };
    });

    root.jQuery('#pwd-compare tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' +
        (row.verify < 1 ? row.verify + ' ms' : root.Format.exact(row.verify) + ' ms') +
        '</td><td class="mono">' + root.Format.exact(row.memoryKb) + ' KiB</td>' +
        '<td class="mono">' + root.Format.exact(row.cost.effectiveCores) + '</td>' +
        '<td class="mono">' + row.cost.guessesPerSecond.toExponential(3) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.cost.daysForEightChars, 2) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pwd-compare-note',
      'The first two rows are the same speed, because a salt does not slow anything down — it ' +
      'stops one table from covering every account, which is a different defence and not this ' +
      'column\'s. The gap between row two and row three is six orders of magnitude and comes ' +
      'entirely from spending 250 ms instead of 2 µs. The gap between rows three and six is ' +
      'smaller and comes from memory: bcrypt\'s 4 KiB is not enough to constrain a 16 GiB rig at ' +
      'all, while Argon2id at ' + root.Format.exact(memoryMib) + ' MiB is. Both facts matter, and ' +
      'the second one is the one people skip.');
  }

  function paintSweep() {
    const rows = [4, 16, 32, 64, 128, 256, 512].map(function (mib) {
      const cost = root.Kdf.crackingCost({ verifyMs: BUDGET_MS, memoryKb: mib * 1024 });

      return { mib: mib, cost: cost };
    });

    root.jQuery('#pwd-sweep tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.mib + ' MiB</td><td class="mono">' +
        root.Format.exact(row.cost.effectiveCores) + '</td><td class="mono">' +
        row.cost.guessesPerSecond.toExponential(3) + '</td><td class="mono">' +
        root.Format.fixed(row.cost.daysForEightChars, 2) + '</td><td>' +
        (row.cost.memoryLimited ? 'memory' : 'cores') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pwd-sweep-note',
      'Every row costs the defender the same 250 ms, and the attacker\'s rate falls by a factor ' +
      'of 128 from the top row to the bottom. That asymmetry is the whole argument for memory ' +
      'hardness: raising the memory parameter is free for a server verifying one login at a time ' +
      'and ruinous for a rig verifying thousands at once, because the rig\'s fixed RAM divides by ' +
      'your parameter. The last column names the binding constraint, and once it says "memory" ' +
      'every further doubling halves the attacker again.');
  }

  function paintRecord(salt, rehash) {
    const rows = [
      { part: 'Algorithm and parameters',
        lives: 'in the stored record, in plain text',
        defends: 'nothing directly — it makes the record self-describing so parameters can change',
        measured: 'a record with iterations ' + root.Format.exact(rehash.storedIterations) +
          ' verified against a current policy of ' + root.Format.exact(rehash.currentIterations) },
      { part: 'Salt, 16 random bytes per user',
        lives: 'in the stored record, not a secret',
        defends: 'precomputed tables, and cross-account correlation of equal passwords',
        measured: 'same password, two salts, keys identical: ' +
          (salt.identicalHash ? 'YES — the salt is not working' : 'no') },
      { part: 'Pepper, one application-held key',
        lives: 'in the application config or a KMS — anywhere but the database',
        defends: 'a stolen database with no application compromise',
        measured: 'not modelled here; it multiplies the attacker\'s work by an unguessable key' },
      { part: 'Rehash on successful login',
        lives: 'in the verify path, behind an "is this below policy" check',
        defends: 'parameter decay — the only moment the plaintext is available to re-derive',
        measured: 'needsRehash: ' + (rehash.needsRehash ? 'yes' : 'no') +
          ', which is what triggers the upgrade' },
      { part: 'Constant-time comparison of the derived key',
        lives: 'in the verify path',
        defends: 'a timing oracle on the stored key — small, but free to eliminate',
        measured: 'covered in the constant-time section, where the attack is executed' }
    ];

    root.jQuery('#pwd-record tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.part + '</td><td>' + row.lives + '</td><td>' + row.defends +
        '</td><td>' + row.measured + '</td></tr>';
    }).join(''));

    root.Helpers.setText('pwd-record-note',
      'The second row is measured: the same password under two salts produces two different ' +
      'keys, which is the entire mechanism and it costs nothing. The fourth row is the one ' +
      'systems skip, and the last column shows what it looks like in code — a stored record at ' +
      root.Format.exact(rehash.storedIterations) + ' iterations, a current policy of ' +
      root.Format.exact(rehash.currentIterations) + ', and a boolean saying re-derive now. ' +
      'Without that boolean the parameters chosen on launch day are the parameters forever, and ' +
      'the store gets weaker every year without anybody changing a line.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
