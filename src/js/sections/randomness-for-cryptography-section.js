/**
 * Section: randomness for cryptography.
 *
 * The measurement is the prediction table. A linear congruential generator's
 * state IS its output, so one observed value determines every value that
 * follows — and the demo predicts them exactly rather than approximately. The
 * entropy of that same output measures fine, which is the trap: statistical
 * quality and unpredictability are different properties, and every test in a
 * randomness test suite measures the first.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'randomness-for-cryptography';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — an entropy pool feeding a DRBG',
      caption: 'The kernel collects unpredictable events — interrupt timings, device jitter, a ' +
        'hardware source where one exists — into a pool, and a deterministic generator expands ' +
        'that seed into as many bytes as anyone asks for. Two properties matter and both are ' +
        'about the arrows: the pool must have accumulated real entropy BEFORE the first key is ' +
        'generated, and the generator must be reseeded so that a state compromise does not last ' +
        'forever. The blocking-versus-non-blocking argument about /dev/random is about the first ' +
        'arrow only, and on a modern kernel it is settled: use the non-blocking interface after ' +
        'the pool is initialised, and getrandom(2) will not return until it is.',
      definition: [
        'flowchart LR',
        '    I["interrupt timings"] --> P["entropy pool"]',
        '    D["device jitter"] --> P',
        '    H["hardware RNG, where present"] --> P',
        '    P --> S["seed"]',
        '    S --> G["DRBG — a keyed generator"]',
        '    G --> O["getrandom / crypto.getRandomValues"]',
        '    G -. "reseed, so a state<br/>compromise expires" .-> P',
        '    B["boot, VM clone, container start"] -. "the pool may be EMPTY<br/>here" .-> P'
      ].join('\n')
    };
  }

  function orientationKinds() {
    return [
      '**⚠ Teaching code: not constant-time, not audited, never for real data.** Use the platform ' +
        'CSPRNG, which is `crypto.getRandomValues` in a browser and `crypto.randomBytes` or ' +
        '`getrandom(2)` on a server. Do not seed it yourself.',
      '**A statistical PRNG and a CSPRNG are different KINDS of thing, not different qualities.** ' +
        'A statistical generator promises its output passes distribution tests.',
      'A CSPRNG promises that seeing any amount of output tells you nothing about the rest. The ' +
        'first says nothing at all about the second.',
      '**A linear congruential generator\'s state is its output.** Observe one value and you have ' +
        'the state. Apply the public recurrence and you have every value that follows.',
      'The demo does exactly that and predicts them EXACTLY, not statistically and not ' +
        'approximately.',
      '**And the output still looks random.** The demo measures the entropy of the same sequence ' +
        'it just predicted perfectly, and it is close to the maximum.',
      'Every statistical test in every test suite measures that quantity, which is why passing them ' +
        'is not evidence of anything a key generator needs.'
    ];
  }

  function orientationFailures() {
    return [
      '**`Math.random()` is a statistical PRNG in every engine.** It is not seeded from an entropy ' +
        'pool, and its state is recoverable from its output.',
      'It has been used to generate session tokens, password-reset links and API keys in shipped ' +
        'software repeatedly.',
      '**The /dev/random blocking myth is settled and the answer is the non-blocking one.** On a ' +
        'modern Linux kernel, once the pool is initialised the two devices are the same generator.',
      '`getrandom(2)` blocks only until initialisation and then never again. Draining an "entropy ' +
        'count" is not a thing that happens.',
      '**The real failures are at boot, in VMs and after a fork.** A device generating a key before ' +
        'its pool has entropy produces a predictable key.',
      'A cloned VM image resumes with a cloned pool, and a forked child that inherits generator ' +
        'state produces the same stream as its parent.',
      'The Heninger study found tens of thousands of duplicate RSA keys on the public internet from ' +
        'exactly this.',
      '**Randomness failures are silent and total.** Nothing looks wrong. The keys are valid, the ' +
        'protocol works, the tests pass, and the security is zero.',
      'There is no monitoring that detects it after the fact, which is why the only defence is ' +
        'using the platform generator and never rolling your own.'
    ];
  }

  function orientation() {
    return orientationKinds().concat(orientationFailures());
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — recover a generator’s state and predict its future exactly',
        markup: root.RandomnessTemplate.render()
      },
      diagram: diagram(),
      insight: '**The 2012 studies found tens of thousands of duplicate RSA keys on the public ' +
        'internet, because embedded devices generated them before their entropy pool had ' +
        'anything in it. Randomness failures are silent and total.** That is the shape of the ' +
        'whole problem: there is no symptom. The keys validate, the handshakes succeed, the ' +
        'traffic is encrypted, and an attacker who knows the device model can regenerate the ' +
        'private key. Nothing in a test suite, a monitoring dashboard or a code review catches ' +
        'it, so the defence has to be structural. Use the platform CSPRNG, never seed it ' +
        'yourself, and treat "generate a key at first boot" as a design smell that needs an ' +
        'entropy source or a deferred key generation.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RandomnessTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const lcgFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.CryptoLab.lcgRecovery({ a: 1103515245, c: 12345, m: 2147483648, seed: 42,
      observe: Number(parts[0]), predict: Number(parts[1]) });
  });

  const streamFor = root.Helpers.memoise(function () {
    const run = root.CryptoLab.lcgRecovery({ a: 1103515245, c: 12345, m: 2147483648, seed: 42,
      observe: 4000, predict: 1 });

    return {
      high: root.CryptoLab.outputEntropy(run.observed.map(function (value) {
        return Math.floor(value / 8388608) % 256;
      })),
      low: root.CryptoLab.outputEntropy(run.observed.map(function (value) {
        return value % 256;
      }))
    };
  });

  /* The same attack, run against a keyed generator. The attacker observes
   * outputs, assumes the last one is the state — which is what worked on the
   * LCG — and applies the public recurrence forward. Counting the hits is an
   * executed attack, not an assertion that it would fail. */
  const csprngFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const generator = root.CryptoLab.csprng(root.CryptoLab.bytesOf('an entropy-pool seed'));
    const observed = [];
    const actual = [];

    for (let i = 0; i < Number(parts[0]); i += 1) observed.push(word(generator.next()));
    for (let i = 0; i < Number(parts[1]); i += 1) actual.push(word(generator.next()));
    const predicted = [];
    let next = observed[observed.length - 1];

    for (let i = 0; i < actual.length; i += 1) {
      next = (1103515245 * next + 12345) % 2147483648;
      predicted.push(next);
    }
    return { observed: observed, predicted: predicted, actual: actual,
      matched: predicted.filter(function (value, i) { return value === actual[i]; }).length };
  });

  function word(bytes) {
    return ((bytes[0] << 23) | (bytes[1] << 15) | (bytes[2] << 7) | (bytes[3] >>> 1)) >>> 0;
  }

  function update() {
    const values = panel.values();
    const lcg = lcgFor(values['rnd-observe'] + '|' + values['rnd-predict']);

    root.Helpers.setText('rnd-disclaimer', root.CryptoLab.DISCLAIMER);
    paintMetrics(lcg, streamFor(''),
      csprngFor(values['rnd-observe'] + '|' + values['rnd-predict']));
    paintPredictions(lcg);
    paintCompare(streamFor(''));
    paintEntropy();
  }

  function paintMetrics(lcg, stream, csprng) {
    const matched = lcg.predicted.filter(function (value, i) {
      return value === lcg.actual[i];
    }).length;

    root.MetricGrid.update({
      'rnd-exact': { value: root.Format.exact(matched) + ' of ' +
        root.Format.exact(lcg.predicted.length),
      note: lcg.exact ? 'every one, exactly — not statistically'
        : 'the prediction failed, which would mean the recurrence is wrong' },
      'rnd-needed': { value: root.Format.exact(lcg.observationsNeeded),
        note: 'the state IS the output, so one value is the whole secret' },
      'rnd-entropy': { value: root.Format.fixed(stream.high.bits, 4) + ' bits',
        note: 'per byte of the HIGH bits over ' + root.Format.exact(stream.high.samples) +
          ' samples — near the maximum of 8, and completely predictable' },
      'rnd-csprng': { value: root.Format.exact(csprng.matched) + ' of ' +
        root.Format.exact(csprng.actual.length),
      note: csprng.matched === 0
        ? 'the identical attack, run against a keyed generator — every prediction wrong'
        : 'a prediction landed, which at this width would be coincidence rather than a break' }
    });
  }

  function paintPredictions(lcg) {
    root.jQuery('#rnd-forecast tbody').html(lcg.predicted.map(function (value, i) {
      return '<tr><td class="mono">' + (i + 1) + '</td><td class="mono">' +
        root.Format.exact(value) + '</td><td class="mono">' +
        root.Format.exact(lcg.actual[i]) + '</td><td class="mono">' +
        (value === lcg.actual[i] ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rnd-forecast-note',
      'The attacker observed ' + root.Format.exact(lcg.observed.length) +
      ' output values and then predicted the next ' + root.Format.exact(lcg.predicted.length) +
      ' — every one of them exactly. There is no statistics in that table and no probability: ' +
      'the generator is a public recurrence, its state is the last value it produced, and ' +
      'applying the recurrence forward is the whole attack. A generator with this property can ' +
      'never produce a key, a nonce, a session token or a password-reset link, and that is not a ' +
      'matter of degree.');
  }

  function paintCompare(stream) {
    const rows = [
      { property: 'Distribution', statistical: 'uniform, passes test suites',
        csprng: 'uniform, passes the same suites',
        why: 'identical — which is why passing them proves nothing' },
      { property: 'Period', statistical: 'long, and stated in the documentation',
        csprng: 'effectively unbounded',
        why: 'also not the property that matters' },
      { property: 'Predicting the next output', statistical: 'trivial from one or two outputs',
        csprng: 'requires breaking the underlying cipher or hash',
        why: 'this is the whole difference' },
      { property: 'Recovering past output', statistical: 'the recurrence runs backwards too',
        csprng: 'not possible after reseeding — that is forward secrecy',
        why: 'a state compromise should not expose yesterday\'s keys' },
      { property: 'Seeding', statistical: 'a number you choose, often the clock',
        csprng: 'an entropy pool the kernel maintains',
        why: 'a seed an attacker can guess is a key an attacker can guess' },
      { property: 'What to call', statistical: 'Math.random, rand(), a Mersenne Twister',
        csprng: 'crypto.getRandomValues, crypto.randomBytes, getrandom(2)',
        why: 'the API name is the whole decision' }
    ];

    root.jQuery('#rnd-compare tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.property + '</td><td>' + row.statistical + '</td><td>' +
        row.csprng + '</td><td>' + row.why + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rnd-compare-note',
      'The first two rows are identical, and they are the rows a test suite measures. That is ' +
      'the trap in one table: a statistical generator is BUILT to pass distribution tests, so ' +
      'passing them is evidence of nothing at all about unpredictability. The third row is the ' +
      'entire distinction, and the last row is the entire remedy — the decision is which function ' +
      'you call, and there is no configuration, tuning or analysis to do beyond that. The measured ' +
      'entropy makes the first row concrete and adds a second trap: the HIGH byte of this ' +
      'generator carries ' + root.Format.fixed(stream.high.bits, 4) + ' bits of the possible 8 ' +
      'over ' + root.Format.exact(stream.high.samples) + ' samples and takes all ' +
      root.Format.exact(stream.high.distinct) + ' values, while the LOW byte of the same values ' +
      'carries only ' + root.Format.fixed(stream.low.bits, 4) + ' bits and takes ' +
      root.Format.exact(stream.low.distinct) + ' distinct values in the whole run. Both bytes are ' +
      'equally predictable; only one of them looks it.');
  }

  function paintEntropy() {
    const rows = [
      { situation: 'First boot of an embedded device',
        happens: 'the pool has almost nothing in it; the generator is seeded from a near-constant',
        consequence: 'Heninger et al. found tens of thousands of duplicate RSA keys and shared ' +
          'primes on the public internet, from exactly this' },
      { situation: 'A cloned VM image or a container from a golden image',
        happens: 'every clone resumes with the same pool state and the same generator state',
        consequence: 'identical "random" values across every instance until something reseeds' },
      { situation: 'fork() with a userspace generator',
        happens: 'parent and child continue the same stream from the same state',
        consequence: 'two processes emit identical nonces — which for AES-GCM is catastrophic' },
      { situation: 'A seeded PRNG "for reproducibility" in production',
        happens: 'the seed is in the code, the config or the clock',
        consequence: 'every value it ever produced is derivable by anyone who reads the repository' },
      { situation: 'Modern Linux, after the pool is initialised',
        happens: 'getrandom(2) returns immediately and never blocks again',
        consequence: 'nothing — this is the case where the folklore about draining entropy is wrong' }
    ];

    root.jQuery('#rnd-sources tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.situation + '</td><td>' + row.happens + '</td><td>' +
        row.consequence + '</td></tr>';
    }).join(''));

    root.Helpers.setText('rnd-sources-note',
      'Four failure situations and one non-failure. The last row matters because the folklore ' +
      'points the wrong way: people avoid the non-blocking device out of a belief that entropy is ' +
      'consumed by use, and then reach for something worse. Entropy is not consumed — once the ' +
      'pool is initialised the generator is a keyed function and can produce unlimited output. ' +
      'The genuine problems are all in the first four rows, and every one of them is about the ' +
      'moment BEFORE the pool has anything in it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
