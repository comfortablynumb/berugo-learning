/**
 * Section: modular arithmetic and number theory.
 *
 * Two claims here are usually taught wrongly and the demo settles both with a
 * count.
 *
 * A Fermat test is not a probabilistic primality test on a Carmichael number -
 * it is a wrong answer with certainty. 561 passes for every one of the 319
 * bases coprime to it, so the "probability of a false positive" for that input
 * is exactly 1, not 2^-k. Miller-Rabin's extra condition, which asks for a
 * non-trivial square root of one along the way, catches it with the first base
 * it tries.
 *
 * And Miller-Rabin below 2^64 is not probabilistic either. Twelve fixed bases
 * decide primality outright for every input under that bound, verified
 * exhaustively; quoting an error rate for a 64-bit primality check is a
 * misunderstanding of what the witness sets are.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'modular-arithmetic';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — one Miller–Rabin round, and the two ways it can end',
      caption: 'Write n − 1 as d × 2ˢ. If n is prime then a^d is either already 1, or one of the ' +
        's squarings that follow passes through −1 — because in a prime modulus the only square ' +
        'roots of 1 are ±1. A composite that reaches 1 without passing through −1 has just handed ' +
        'over a non-trivial square root of one, which is a proof that it is composite. That extra ' +
        'condition is the entire difference from the Fermat test, and it is why Carmichael ' +
        'numbers do not fool it.',
      definition: [
        'flowchart TD',
        '    A["write n − 1 = d x 2^s<br/>with d odd"] --> B["x = a^d mod n"]',
        '    B --> C{"x = 1 or x = n − 1?"}',
        '    C -- yes --> D["probable prime<br/>for this base"]',
        '    C -- no --> E["square: x = x^2 mod n<br/>repeat up to s−1 times"]',
        '    E --> F{"x = n − 1?"}',
        '    F -- yes --> D',
        '    F -- no --> G{"x = 1?"}',
        '    G -- yes --> H["COMPOSITE<br/>a non-trivial square root of 1"]',
        '    G -- no --> I{"squarings left?"}',
        '    I -- yes --> E',
        '    I -- no --> J["COMPOSITE<br/>never reached −1"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Modular arithmetic is the arithmetic of a finite wheel.** Addition, subtraction and ' +
        'multiplication all commute with taking the remainder, so a long computation can be ' +
        'reduced at every step and never leave the modulus.',
      'Division is the exception. `a/b mod n` means multiplying by b’s inverse, that inverse exists ' +
        'only when b and n are coprime, and the extended Euclidean algorithm is what produces it.',
      '**A Fermat test is not a primality test, and on a Carmichael number it is not probabilistic ' +
        'either.** Fermat’s little theorem says a^(n−1) ≡ 1 for every prime n and every base ' +
        'coprime to it.',
      'And 561, 1105 and 1729 satisfy it for *every* coprime base as well. For those inputs the ' +
        'false-positive rate is 1, not 2⁻ᵏ, and running more bases does not help at all.',
      '**Miller–Rabin closes the hole by looking at square roots of one.** In a prime modulus the ' +
        'only square roots of 1 are 1 and −1. So a squaring chain that arrives at 1 without passing ' +
        'through −1 is a certificate of compositeness.',
      'And for bounded ranges the test is *deterministic*: small fixed witness sets have been ' +
        'verified exhaustively, and twelve fixed bases settle every input below 2⁶⁴.',
      '**Factoring is the asymmetry everything else rests on.** Trial division costs the square ' +
        'root of n. Pollard’s rho costs the square root of the *smallest factor*, by a birthday ' +
        'argument on a pseudorandom walk.',
      'So a large number with one small factor falls instantly and a product of two equal-sized ' +
        'primes does not. That is precisely why an RSA modulus is built that way.',
      'It is also why the sieve of Eratosthenes is still how you get the small primes that make ' +
        'trial division worth trying first.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — witnesses, Carmichael numbers, factoring and sieves',
        markup: root.ModularArithmeticTemplate.render()
      },
      diagram: diagram(),
      insight: 'The practical rules are short. **For anything under 2⁶⁴, use deterministic ' +
        'Miller–Rabin with the published witness set and stop calling it probabilistic.** There is ' +
        'no error rate to quote. **Never use a Fermat test alone**, because the inputs it is wrong ' +
        'on are a named, enumerable set that an adversary can simply look up. And in competitive ' +
        'settings, two cheap facts do most of the work. A linear sieve gives you ' +
        'smallest-prime-factor for every number under the limit, which turns factorisation into ' +
        'array lookups. The Chinese remainder theorem lets a computation that would overflow be run ' +
        'modulo several small primes and reassembled — provided the product of the moduli exceeds ' +
        'the answer. That is the condition people forget, and the one that makes the result ' +
        'silently wrong when it fails.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ModularArithmeticTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const CRT_MODULI = [7, 11, 13, 17, 19, 23];

  const trailFor = root.Helpers.memoise(function (key) {
    return root.BignumLab.millerRabinTrail(BigInt(key));
  });

  const carmichaelFor = root.Helpers.memoise(function () {
    return root.BignumLab.primalityTable({});
  });

  const factorFor = root.Helpers.memoise(function (key) {
    return root.BignumLab.factorRace(BigInt(key), { trialBudget: 5000000, rhoBudget: 400000 });
  });

  /* A fixed semiprime always sits beside whatever the control selects. Without
     it the factoring card is meaningless at the section's own default: 561 has
     a factor of 3, so trial division finds it in 7 operations and rho in 1,
     and the asymmetry the card exists to show is invisible. */
  const REFERENCE_SEMIPRIME = '158346127852483';

  const sieveFor = root.Helpers.memoise(function (key) {
    return root.BignumLab.sieveRace(Number(key));
  });

  const gcdFor = root.Helpers.memoise(function (key) {
    return root.BignumLab.gcdRace({ trials: 4000, bits: Number(key) });
  });

  const crtFor = root.Helpers.memoise(function (key) {
    return root.BignumLab.crtRun(BigInt(key), CRT_MODULI);
  });

  const primalityRowFor = root.Helpers.memoise(function (key) {
    return root.BignumLab.primalityTable({ numbers: [BigInt(key)] })[0];
  });

  function update() {
    const values = panel.values();
    const number = String(values['ma-number']);

    paintTrail(trailFor(number));
    paintMetrics(number, String(values['ma-limit']));
    paintCarmichael(carmichaelFor(''));
    paintFactor(factorFor(number), factorFor(REFERENCE_SEMIPRIME));
    paintSieve(sieveFor(String(values['ma-limit'])), gcdFor(String(values['ma-gcd-bits'])));
    paintCrt(crtFor(String(Math.abs(Math.trunc(Number(values['ma-crt']))) || 1)));
  }

  function paintTrail(trail) {
    root.jQuery('#ma-trail tbody').html(trail.rows.map(function (row) {
      return '<tr><td class="mono">' + String(row.base) + '</td><td>' + row.squarings +
        '</td><td class="mono">' + row.trail.slice(0, 6).map(String).join(' → ') +
        (row.trail.length > 6 ? ' …' : '') + '</td><td>' +
        (row.probablePrime ? 'probable prime' : 'COMPOSITE — ' + row.reason) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ma-trail-note',
      'The witness set for a number this size is ' + trail.witnessCount + ' base' +
      (trail.witnessCount === 1 ? ', verified' : 's, each verified') + ' exhaustively against ' +
      'every composite below its bound — so this is a decision, not an estimate. ' + (trail.prime
        ? 'All of them passed, so ' + String(trail.n) + ' is prime; there is no residual ' +
          'probability to quote.'
        : 'Base ' + String(trail.witness) + ' rejected it, with the reason in the last column. ' +
          'The residue sequence is what a Fermat test throws away: it ends at 1, which is what ' +
          'Fermat checks, and it got there without passing through n − 1, which is what ' +
          'Miller–Rabin checks.'));
  }

  function paintMetrics(number, limit) {
    const trail = trailFor(number);
    const row = primalityRowFor(number);
    const reference = factorFor(REFERENCE_SEMIPRIME);
    const sieve = sieveFor(limit);

    root.MetricGrid.update({
      'ma-verdict': { value: trail.prime ? 'prime' : 'composite',
        note: trail.prime ? 'all ' + trail.witnessCount + ' witnesses passed'
          : 'witness ' + String(trail.witness) },
      'ma-fermat': { value: root.Format.exact(row.fermatPasses) + ' / ' +
        root.Format.exact(row.coprimeBases),
        note: row.coprimeBases === 0 ? 'no coprime bases below the cap'
          : root.Format.fixed(100 * row.fermatFoolRate, 1) + '% of coprime bases are fooled' },
      /* The reference semiprime, not the selected number: at the section's own
         default of 561 the race is 7 operations against 1 and the metric
         would report a 7x "speedup" that is really two trivial answers. */
      'ma-speedup': { value: reference.speedup === null ? '—'
        : root.Format.fixed(reference.speedup, 0) + '×',
        note: root.Format.exact(reference.trialOperations) + ' against ' +
          root.Format.exact(reference.rhoOperations) + ' operations, on the 15-digit semiprime' },
      'ma-sieve': { value: root.Format.fixed(sieve.writeRatio, 2) + '×',
        note: root.Format.exact(sieve.classicWrites) + ' against ' +
          root.Format.exact(sieve.linearWrites) + ' marks' }
    });
  }

  function paintCarmichael(rows) {
    root.jQuery('#ma-carmichael tbody').html(rows.map(function (row) {
      return '<tr><td class="mono">' + String(row.n) + '</td><td class="mono">' +
        row.factors.map(String).join(' × ') + '</td><td>' +
        root.Format.exact(row.coprimeBases) + '</td><td>' +
        root.Format.exact(row.fermatPasses) + '</td><td>' +
        root.Format.fixed(100 * row.fermatFoolRate, 1) + '%</td><td>' +
        (row.millerSaysPrime ? 'says prime' : 'composite') + '</td><td class="mono">' +
        String(row.millerWitness) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ma-carmichael-note',
      'Every row is 100%. That is the fact worth carrying away: on a Carmichael number the ' +
      'Fermat test does not have a small error probability, it has an error probability of one, ' +
      'and running a thousand bases changes nothing. Every one of these is a product of three ' +
      'distinct primes — that is Korselt’s criterion at work — and they are enumerable, so an ' +
      'adversary picking an input does not have to be lucky. Miller–Rabin rejects all eight with ' +
      'base 2 alone — the smallest witness there is — and the last column says how: most of them ' +
      'hand over a square root of one that is neither 1 nor n − 1, which a prime modulus does not ' +
      'have, and the rest never reach −1 at all. That second condition is the entire difference ' +
      'from the Fermat test.');
  }

  const FACTOR_ROWS = [
    { name: 'the number', read: function (row) { return String(row.value); } },
    { name: 'factors', read: function (row) { return row.factors.map(String).join(' × '); } },
    { name: 'smallest factor',
      read: function (row) {
        return row.smallestFactor === null ? '—' : String(row.smallestFactor);
      } },
    { name: 'trial division operations',
      read: function (row) {
        return root.Format.exact(row.trialOperations) +
          (row.trialComplete ? '' : ' (budget exhausted)');
      } },
    { name: 'Pollard rho operations',
      read: function (row) { return root.Format.exact(row.rhoOperations); } },
    { name: 'trial division against rho',
      read: function (row) {
        return row.speedup === null ? '—' : root.Format.fixed(row.speedup, 1) + '×';
      } }
  ];

  function paintFactor(chosen, reference) {
    root.jQuery('#ma-factor tbody').html(FACTOR_ROWS.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + row.read(chosen) +
        '</td><td class="mono">' + row.read(reference) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ma-factor-note',
      'Both methods return the same factorisation, and their costs are governed by different ' +
      'quantities: trial division walks up to √n, and rho expects about √p steps where p is the ' +
      'SMALLEST factor. The second column is fixed at a product of two seven-digit primes so the ' +
      'contrast is always on screen — there rho is ' +
      (reference.speedup === null ? 'the only method that finishes at all'
        : root.Format.fixed(reference.speedup, 0) + '× cheaper') +
      '. Select a number with a small factor and both methods collapse to a handful of ' +
      'operations, which is the same fact from the other side: what makes an RSA modulus hard is ' +
      'not its size, it is that its smallest factor is as large as its size allows.');
  }

  function paintSieve(sieve, gcd) {
    const rows = [
      { name: 'sieve of Eratosthenes',
        work: root.Format.exact(sieve.classicWrites) + ' marks',
        memory: root.Format.bytes(sieve.classicBytes) + ' (one byte a number)' },
      { name: 'linear sieve',
        work: root.Format.exact(sieve.linearWrites) + ' marks, one per composite',
        memory: root.Format.bytes(sieve.linearBytes) + ' (a 32-bit factor a number)' },
      { name: 'Euclid’s gcd', work: root.Format.fixed(gcd.euclidMean, 2) + ' divisions a pair',
        memory: 'needs a divider' },
      { name: 'Stein’s binary gcd',
        work: root.Format.fixed(gcd.binaryMean, 2) + ' shifts and subtractions a pair',
        memory: 'no division at all' }
    ];

    root.jQuery('#ma-sieves tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + row.work + '</td><td>' + row.memory +
        '</td></tr>';
    }).join(''));

    root.Helpers.setText('ma-sieves-note',
      'Both sieves find the same ' + root.Format.exact(sieve.primes) + ' primes. The linear ' +
      'sieve writes ' + root.Format.fixed(sieve.writeRatio, 2) + '× fewer marks because it only ' +
      'ever marks a composite from its smallest prime factor — and it leaves that factor behind, ' +
      'which turns factorising anything under the limit into array lookups. It pays ' +
      root.Format.fixed(sieve.byteRatio, 0) + '× the memory for it. The two gcds are the same ' +
      'trade in miniature: Stein does ' + root.Format.fixed(gcd.binaryMean / gcd.euclidMean, 1) +
      '× more iterations and each one is a shift rather than a division, with ' +
      root.Format.exact(gcd.disagreements) + ' disagreements over ' +
      root.Format.exact(gcd.trials) + ' pairs.');
  }

  function paintCrt(crt) {
    root.jQuery('#ma-crt-table tbody').html(crt.congruences.map(function (congruence, index) {
      const step = crt.steps[index];
      return '<tr><td class="mono">' + String(congruence.modulus) + '</td><td class="mono">' +
        String(congruence.residue) + '</td><td class="mono">' + String(step.residue) +
        '</td><td class="mono">0 … ' + String(step.modulus - 1n) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('ma-crt-note',
      'Each row narrows the answer: after the last modulus the value is pinned to one residue in ' +
      String(crt.modulus) + ', and the rebuilt value is ' + String(crt.rebuilt) + ' against an ' +
      'original of ' + String(crt.value) + ' — ' + (crt.correct ? 'a match' : 'a MISMATCH') +
      '. Watch the last column: the reconstruction is only correct while the product of the ' +
      'moduli exceeds the value, and here it ' + (crt.wideEnough ? 'does' : 'DOES NOT') + '. ' +
      'That is the condition people forget, and when it fails nothing raises an error — the ' +
      'answer comes back wrapped, and it looks exactly like a valid answer.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
