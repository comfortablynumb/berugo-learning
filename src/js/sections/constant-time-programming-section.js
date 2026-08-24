/**
 * Section: constant-time programming and side channels.
 *
 * The attack is executed, not narrated: an early-exit comparison is probed byte
 * by byte with averaged timing measurements and the secret token comes out. The
 * branchless comparison is then attacked with identical code and identical
 * conditions and produces nothing. The noise sweep is the honest part — a
 * timing attack is not free at a distance, and the table shows exactly how much
 * averaging each noise level costs, including the level at which the attacker
 * needs more measurements than the demo gives them.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'constant-time-programming';
  const SECRET = [0x9f, 0x3c, 0x71, 0x08];
  const SEED = 42;
  const NOISES = ['0.4', '1.2', '3', '6'];
  const SAMPLES = [10, 20, 40, 80, 160, 320];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a secret-dependent branch against a branchless select',
      caption: 'The left path decides what to do based on a secret, so how long it takes depends ' +
        'on the secret — and time is observable from anywhere. The right path does the same work ' +
        'either way and picks the answer with arithmetic: build a mask that is all-ones or ' +
        'all-zeros from the condition, and combine both candidates with it. The two rules are ' +
        'that shape generalised. Never branch on a secret, because the branch takes different ' +
        'time and trains the predictor differently; never index memory with a secret, because ' +
        'the cache line you touch is visible to anything sharing that cache.',
      definition: [
        'flowchart TD',
        '    S["secret byte"] --> B{"if secret == guess"}',
        '    B -->|equal| L1["continue — one more iteration"]',
        '    B -->|differ| L2["return immediately"]',
        '    L1 --> T["time depends on the secret"]',
        '    L2 --> T',
        '    S2["secret byte"] --> M["mask = -(condition &amp; 1)"]',
        '    M --> C["result = (a &amp; mask) | (b &amp; ~mask)"]',
        '    C --> U["time is the same for every secret"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**⚠ Teaching code: not constant-time, not audited, never for real data.** JavaScript ' +
        'cannot guarantee constant time at all — the JIT, the garbage collector and the engine\'s ' +
        'internal representations all vary with data. The patterns are the lesson; the guarantee ' +
        'needs a language and a compiler that offer one.',
      '**Two rules cover almost everything: do not branch on a secret, do not index memory with ' +
        'a secret.** The first leaks through time and branch prediction; the second leaks through ' +
        'the cache, which is shared with everyone else on the machine. Every constant-time ' +
        'pattern in the demo is one of those two rules applied.',
      '**`===` on a token is a remote timing oracle, and the demo empties one.** A comparison ' +
        'that returns as soon as two bytes differ takes longer for a guess with a correct prefix. ' +
        'Averaging enough measurements makes that difference visible, and the attacker then ' +
        'recovers the secret one byte at a time.',
      '**That turns an exponential search into a linear one.** Guessing a 4-byte token blind ' +
        'costs 2^32 attempts. Byte-at-a-time costs 4 × 256 = 1 024 guesses, and the demo reports ' +
        'both numbers. The difference is not "somewhat easier" — it is the whole security of the ' +
        'token.',
      '**Distance costs measurements, and the sweep says how many.** The same attack that works ' +
        'in ten samples on a quiet machine needs eighty across a noisy network and more than the ' +
        'demo budget when the noise doubles again. Averaging beats noise as the square root of ' +
        'the sample count, so the attacker pays but never stops.',
      '**The constant-time version resists the identical attack, and it is measured too.** The ' +
        'demo reports the separation between right-byte and wrong-byte timings in standard ' +
        'deviations: several deviations for the early-exit version, essentially zero for the ' +
        'masked one.',
      '**Table lookups leak through the cache even when the code has no branches.** The original ' +
        'cache-timing attacks on AES exploited exactly this — the S-box index is secret-derived, ' +
        'so which cache line is fetched depends on the key. The fixes are bit-sliced ' +
        'implementations, hardware AES instructions, or scanning the whole table.',
      '**A compiler will happily reintroduce a branch you removed.** Writing branchless source ' +
        'is not the same as compiling to branchless code: optimisers recognise select patterns ' +
        'and turn them back into jumps. Real implementations use volatile barriers, hand-written ' +
        'assembly, or verification tools, and then MEASURE — which is the only check that ' +
        'survives a compiler upgrade.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — recover a secret token from timing, then fail against a masked compare',
        markup: root.ConstantTimeTemplate.render()
      },
      diagram: diagram(),
      insight: '**`===` on a token is a remote timing oracle. Over a network the signal is small, ' +
        'but it is statistically recoverable, and the fix costs one function.** The reason this ' +
        'one is worth internalising is the asymmetry: the attacker\'s cost is a constant factor ' +
        'in measurements, while the defender\'s cost is a single call to a comparison that ' +
        'already exists in every crypto library. There is no performance argument for the early ' +
        'exit — comparing 32 bytes unconditionally is nothing — and no situation where the ' +
        'variable-time version is worth its risk. It survives in code because `a === b` is what ' +
        'everyone types, which is exactly why it needs to be on a review checklist.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ConstantTimeTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  function comparatorFor(name) {
    return name === 'naive' ? root.ConstantTime.naiveWork : root.ConstantTime.constantWork;
  }

  const attackFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');

    return root.ConstantTime.timingAttack({ secret: SECRET, compare: comparatorFor(parts[0]),
      rng: root.Random.seeded(SEED), samples: Number(parts[2]), noise: Number(parts[1]) });
  });

  const profileFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');

    return root.ConstantTime.timingProfile({ secret: SECRET, compare: comparatorFor(parts[0]),
      rng: root.Random.seeded(7), samples: Number(parts[2]), noise: Number(parts[1]),
      trials: 60 });
  });

  function update() {
    const values = panel.values();
    const key = values['ctp-compare'] + '|' + values['ctp-noise'] + '|' + values['ctp-samples'];
    const attack = attackFor(key);

    root.Helpers.setText('ctp-disclaimer', root.ConstantTime.DISCLAIMER);
    paintMetrics(attack, profileFor(key));
    paintToken(attack, values);
    paintProfile(values['ctp-noise'], values['ctp-samples']);
    paintSweep(values['ctp-compare']);
    paintRules();
    paintChannels();
  }

  function paintMetrics(attack, profile) {
    const matched = attack.recovered.filter(function (byte, i) {
      return byte === SECRET[i];
    }).length;

    root.MetricGrid.update({
      'ctp-recovered': { value: root.Format.exact(matched) + ' of ' +
        root.Format.exact(SECRET.length),
      note: 'recovered byte by byte, from response times alone' },
      'ctp-separation': { value: root.Format.fixed(profile.separation, 4) + ' σ',
        note: profile.separation > 1
          ? 'the right byte is plainly slower — one measurement almost decides it'
          : 'below one deviation: the two distributions overlap and the signal is gone' },
      'ctp-cost': { value: root.Format.exact(attack.measurements) + ' timings',
        note: root.Format.exact(attack.searchSpace) + ' guesses against a brute-force space of ' +
          attack.bruteForce.toExponential(3) },
      'ctp-verdict': { value: attack.succeeded ? 'yes' : 'no',
        note: attack.succeeded
          ? 'the token was reconstructed exactly, with no key material involved'
          : 'not at these conditions — see the sweep for what it would take' }
    });
  }

  function paintToken(attack, values) {
    const hex = function (bytes) {
      return bytes.map(function (byte) {
        return ('0' + byte.toString(16)).slice(-2);
      }).join(' ');
    };

    root.jQuery('#ctp-token').html(
      '<div class="mono" style="font-size:.9rem">secret&nbsp;&nbsp;&nbsp; ' + hex(SECRET) +
      '</div><div class="mono" style="font-size:.9rem">recovered ' + hex(attack.recovered) +
      '</div>');

    root.Helpers.setText('ctp-token-note', attack.succeeded
      ? 'The attacker never saw the token. They sent guesses, timed the responses, kept the byte ' +
        'value whose response was slowest, and moved to the next position — ' +
        root.Format.exact(attack.searchSpace) + ' guesses in total against a brute-force space ' +
        'of ' + attack.bruteForce.toExponential(3) + '. That collapse from exponential to linear ' +
        'is the entire effect of the early exit, and it happens because a guess with a correct ' +
        'prefix survives one more loop iteration than a guess without one.'
      : 'The attack did not reconstruct the token under these conditions — ' +
        (values['ctp-compare'] === 'constant'
          ? 'the branchless comparison does the same work for every input, so there is no ' +
            'timing difference to average out no matter how many samples the attacker takes. ' +
            'Turn the noise down and add samples: it still fails, because the signal is not ' +
            'small here, it is absent.'
          : 'at this noise level ' + values['ctp-samples'] + ' samples per guess is not enough ' +
            'averaging. That is a budget problem rather than a defence: the sweep below shows the ' +
            'sample count that succeeds, and averaging beats noise as its square root, so the ' +
            'attacker simply pays more.'));
  }

  function paintProfile(noise, samples) {
    const rows = [
      { label: 'Early exit — what === compiles to', name: 'naive' },
      { label: 'Branchless, bit-masked', name: 'constant' }
    ].map(function (row) {
      const profile = profileFor(row.name + '|' + noise + '|' + samples);

      return { label: row.label, profile: profile };
    });

    root.jQuery('#ctp-profile tbody').html(rows.map(function (row) {
      const p = row.profile;

      return '<tr><td>' + row.label + '</td><td class="mono">' +
        root.Format.fixed(p.right.mean, 4) + ' ± ' + root.Format.fixed(p.right.deviation, 4) +
        '</td><td class="mono">' + root.Format.fixed(p.wrong.mean, 4) + ' ± ' +
        root.Format.fixed(p.wrong.deviation, 4) + '</td><td class="mono">' +
        root.Format.fixed(p.separation, 4) + ' σ</td><td>' +
        (p.separation > 1 ? 'YES' : 'no') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ctp-profile-note',
      'Two distributions per row, each averaged over 60 trials at ' + samples +
      ' measurements apiece, under identical noise. The early-exit row separates the right first ' +
      'byte from the wrong one by ' +
      root.Format.fixed(rows[0].profile.separation, 2) + ' deviations, which is a signal an ' +
      'attacker can act on without much averaging at all. The branchless row separates them by ' +
      root.Format.fixed(rows[1].profile.separation, 4) + ' — the means differ only by the noise ' +
      'itself, and no amount of sampling will pull a secret out of that. Note also that the ' +
      'branchless row is SLOWER in absolute terms, because it always compares every byte. That ' +
      'is the entire cost of the fix.');
  }

  function paintSweep(compare) {
    const rows = NOISES.map(function (noise) {
      return { noise: noise, cells: SAMPLES.map(function (samples) {
        return attackFor(compare + '|' + noise + '|' + samples).succeeded;
      }) };
    });

    root.jQuery('#ctp-sweep tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.noise + '</td>' + row.cells.map(function (ok) {
        return '<td class="mono">' + (ok ? 'recovered' : '—') + '</td>';
      }).join('') + '</tr>';
    }).join(''));

    const first = rows[0].cells.filter(Boolean).length;
    const last = rows[rows.length - 1].cells.filter(Boolean).length;

    root.Helpers.setText('ctp-sweep-note', compare === 'naive'
      ? 'The quiet row recovers the token at every sample count (' + root.Format.exact(first) +
        ' of ' + root.Format.exact(SAMPLES.length) + '); the noisiest recovers it at ' +
        root.Format.exact(last) + '. Reading down a column shows what distance costs, and ' +
        'reading across a row shows the remedy: more measurements. Averaging suppresses noise as ' +
        'the square root of the sample count, so quadrupling the samples halves the effective ' +
        'noise — an attacker on a congested link is inconvenienced, not stopped. This is why ' +
        '"the signal is too small over a network" has never been a defence, and why the 2003 ' +
        'remote-timing work on OpenSSL mattered.'
      : 'Every cell is empty, at every noise level and every sample count, because the ' +
        'branchless comparison performs the same work whatever the secret is. There is no small ' +
        'signal here for averaging to find — the difference the attacker is measuring does not ' +
        'exist. Compare this table against the early-exit version: same attacker, same code, ' +
        'same conditions, and the only change is which comparison the server called.');
  }

  function paintRules() {
    const rows = [
      { instead: 'if (a === b) return ok;',
        write: 'diff |= a[i] ^ b[i], for every i; return diff === 0',
        why: 'every byte is touched whatever the input, so the loop count is fixed' },
      { instead: 'if (secret) x = a; else x = b;',
        write: 'mask = -(secret &amp; 1); x = (a &amp; mask) | (b &amp; ~mask)',
        why: 'both values are computed and the choice is arithmetic, so no branch is taken' },
      { instead: 'table[secretIndex]',
        write: 'scan the whole table, selecting with a mask per entry',
        why: 'every cache line is touched, so the access pattern carries no information' },
      { instead: 'if (a &lt; b) …',
        write: '((~a &amp; b) | (~(a ^ b) &amp; (a - b))) &gt;&gt;&gt; 31',
        why: 'the sign bit of the borrow gives the comparison with no conditional' },
      { instead: 'while (x &gt; 0) { … }  on a secret x',
        write: 'loop a fixed number of times and mask the effect of each iteration',
        why: 'the iteration count is what leaks — RSA and ECC blinding exist for this' },
      { instead: 'return early on a bad MAC, later on bad padding',
        write: 'compute both, combine the results, return one indistinguishable failure',
        why: 'two rejection paths with different timing IS the padding oracle' }
    ];

    root.jQuery('#ctp-rules tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + row.instead + '</td><td class="mono">' + row.write +
        '</td><td>' + row.why + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ctp-rules-note',
      'Every row does more work than the version it replaces, and every row does the SAME work ' +
      'for every input, which is the trade. The last row connects this section back to the ' +
      'padding oracle: those two rejection paths were a timing difference, and returning a ' +
      'single indistinguishable failure is the constant-time discipline applied at the protocol ' +
      'level rather than the byte level. The fifth row is where the discipline gets genuinely ' +
      'hard — a secret-dependent loop count in a modular exponentiation is not fixed by a mask, ' +
      'which is why RSA and ECC implementations use blinding as well.');
  }

  function paintChannels() {
    const rows = [
      { channel: 'Timing', observes: 'how long an operation takes',
        needs: 'nothing but the ability to make requests — even remotely',
        defence: 'constant-time code; the demo above' },
      { channel: 'Cache timing', observes: 'which cache lines were touched',
        needs: 'code running on the same machine, often the same core',
        defence: 'bit-slicing, hardware AES instructions, or scanning the whole table' },
      { channel: 'Branch prediction', observes: 'which way a branch went',
        needs: 'co-resident code, and it survives many mitigations',
        defence: 'no secret-dependent branches at all' },
      { channel: 'Power analysis', observes: 'current draw during the operation',
        needs: 'physical access to the device',
        defence: 'masking, randomised execution order, dedicated hardware' },
      { channel: 'Electromagnetic', observes: 'radiated emissions',
        needs: 'physical proximity, sometimes only nearby',
        defence: 'shielding, plus the same masking as power analysis' },
      { channel: 'Speculative execution', observes: 'the microarchitectural trace of work that ' +
        'was rolled back', needs: 'co-resident code, and a gadget in the victim',
      defence: 'compiler and kernel mitigations; largely out of the application’s hands' }
    ];

    root.jQuery('#ctp-channels tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.channel + '</td><td>' + row.observes + '</td><td>' + row.needs +
        '</td><td>' + row.defence + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ctp-channels-note',
      'The third column is the one to design against, because it is a threat-model question ' +
      'rather than a cryptographic one. The first row needs nothing at all — anybody who can ' +
      'send a request can time the response — which is why it is the row every web application ' +
      'has to care about and the only one the demo can execute. Rows two, three and six need ' +
      'co-resident code, which is the shared-hosting and multi-tenant cloud threat model. Rows ' +
      'four and five need physical access, which matters for smart cards and hardware wallets ' +
      'and generally not for a server in a locked building.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
