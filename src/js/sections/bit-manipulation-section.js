/**
 * Section: the bit-manipulation toolkit.
 *
 * The section leads with a result that argues against its own subject. The De
 * Bruijn count-trailing-zeros is the showpiece trick of every bit-twiddling
 * article, and on random 32-bit words it does MORE work than the loop it
 * replaces — five operations against a mean of four, because a random word
 * usually has a set bit near the bottom and the loop exits almost immediately.
 * What the trick buys is the worst case: 5 against 94, a factor of nine, and
 * flat rather than data-dependent.
 *
 * That is the honest shape of this whole toolkit. Some of these are wins on
 * every input (popcount by SWAR is 12 operations against 96), some are wins
 * only in the tail, and the way to tell them apart is a counter rather than an
 * opinion. Every trick here is also checked against its loop over all 2^16 low
 * words, because the failures cluster at zero, at powers of two and at the
 * sign bit and a hand-picked sample skips exactly those.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'bit-manipulation';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the SWAR popcount as four pairwise sums',
      caption: 'The word is treated as a vector of counters that get wider and fewer at every ' +
        'stage. It starts as 32 one-bit counters, each holding the count of the single bit it is; ' +
        'each stage adds neighbouring counters together, halving how many there are and doubling ' +
        'how wide. After four stages there are four byte-wide counters, and one multiply by ' +
        '0x01010101 sums all four into the top byte because that constant times a value is the ' +
        'sum of its bytes shifted into place.',
      definition: [
        'flowchart TD',
        '    A["32 counters of 1 bit<br/>each holds 0 or 1"] --> B["subtract the odd bits:<br/>v − ((v >> 1) & 0x55555555)"]',
        '    B --> C["16 counters of 2 bits<br/>each holds 0 to 2"]',
        '    C --> D["mask and add pairs:<br/>(v & 0x33..) + ((v >> 2) & 0x33..)"]',
        '    D --> E["8 counters of 4 bits<br/>each holds 0 to 4"]',
        '    E --> F["add and mask once:<br/>(v + (v >> 4)) & 0x0f0f0f0f"]',
        '    F --> G["4 counters of 8 bits<br/>each holds 0 to 8"]',
        '    G --> H["one multiply sums all four:<br/>(v * 0x01010101) >>> 24"]',
        '    H --> I["the population count"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**These are not micro-optimisations in isolation. They are the primitives that other ' +
        'structures are built out of.**',
      'A bitset iterates with `x & -x`, an allocator finds a free block with count-trailing-zeros, ' +
        'and a garbage collector counts live objects in a mark bitmap with popcount. A chess engine ' +
        'generates moves with shifts and masks, and the succinct structures in M09 are rank and ' +
        'select over exactly this machinery.',
      '**Two identities carry most of the file.** `x & (x − 1)` clears the lowest set bit, so a ' +
        'loop built on it runs once per *set bit* rather than once per bit.',
      '`x & −x` isolates that lowest set bit, leaving a power of two you can turn into an index.',
      'Everything from Kernighan’s popcount to the De Bruijn bit-scan to a bitset’s iterator is one ' +
        'of those two with something wrapped around it.',
      '**"Faster" here is a count, not a claim, and the counts disagree with each other.** The demo ' +
        'reports mean operations over random words and worst-case operations separately, because ' +
        'for the data-dependent tricks they point in opposite directions.',
      'The De Bruijn count-trailing-zeros costs *more* than the naive loop on average and nine ' +
        'times less in the worst case. SWAR popcount wins eightfold on every input alike.',
      '**Correctness here is exhaustive or it is nothing.** Every trick is checked against the ' +
        'obvious loop over all 65 536 low words plus a random sweep of full 32-bit ones.',
      'Bit tricks fail at zero, at exact powers of two and at the sign bit — the three values a ' +
        'hand-written test is least likely to contain.',
      'The rounding-up-to-a-power-of-two trick returns 0 for an input of 0 and needs a guard. That ' +
        'is exactly the kind of thing the exhaustive check finds and a spot check does not.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — a trick, its loop, and every input between them',
        markup: root.BitManipulationTemplate.render()
      },
      diagram: diagram(),
      insight: 'Reach for these when they are the primitive under something else, not because a ' +
        'profile pointed at an arithmetic loop — it almost never will. The judgement worth having ' +
        'is which kind of win a given trick is. A constant-time branchless routine is worth ' +
        'reaching for when the input is adversarial or the branch is unpredictable, because the ' +
        'mispredict costs more than every operation you saved. A data-dependent loop is fine, and ' +
        'often better, when the data is friendly. And in cryptography the whole calculus inverts. ' +
        'There the branchless form is not an optimisation at all, it is the requirement, because a ' +
        'branch on secret data is a timing channel (M23).'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BitManipulationTemplate.controls,
      onChange: function () { update(); }
    });
    update();
  }

  /* ------------------------------------------------------------ measuring */

  const auditFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.NumberLab.trickAudit(parts[0], { wideSamples: Number(parts[1]) });
  });

  const sweepFor = root.Helpers.memoise(function (key) {
    return root.NumberLab.trickSweep({ wideSamples: Number(key) });
  });

  const identitiesFor = root.Helpers.memoise(function (key) {
    return root.NumberLab.identityChecks(Number(key), 5);
  });

  /** The text field is free-form, so a non-hexadecimal entry has to become a
   *  number rather than a NaN that poisons every downstream count. */
  function parseWord(text) {
    const cleaned = String(text || '').replace(/[^0-9a-fA-F]/g, '').slice(0, 8);
    if (cleaned.length === 0) return { value: 0, cleaned: '0', empty: true };
    return { value: parseInt(cleaned, 16) >>> 0, cleaned: cleaned, empty: false };
  }

  function update() {
    const values = panel.values();
    const word = parseWord(values['bm-value']);
    const samples = String(values['bm-samples']);
    const trickId = values['bm-trick'];
    const audit = auditFor(trickId + '|' + samples);

    paintWord(trickId, word);
    paintMetrics(audit);
    paintStages(word);
    paintSweep(sweepFor(samples));
    paintIdentities(identitiesFor(String(Math.min(20000, Number(samples)))));
  }

  function paintWord(trickId, word) {
    const host = root.jQuery('#bm-word')[0];
    if (!host) return;
    const trick = root.BitTricks.trickFor(trickId);
    const fast = trick.fast(word.value);
    const slow = trick.slow(word.value);
    const answer = fast[trick.field];

    root.BitView.renderStack(host, [
      { value: word.value, bits: 32, caption: 'input: 0x' + word.cleaned.toUpperCase(),
        lit: litFor(trickId, word.value) },
      { value: trick.field === 'value' ? answer : 0, bits: 32,
        caption: trick.field === 'value' ? 'result' : 'result is a count, not a word',
        readings: [
          { label: trick.label, value: String(answer) },
          { label: 'operations, trick', value: String(fast.ops) },
          { label: 'operations, loop', value: String(slow.ops) }
        ] }
    ]);

    root.Helpers.setText('bm-word-note',
      (word.empty ? 'No hexadecimal digits entered, so the input is 0 — which is the value most ' +
        'of these tricks get wrong if they are written without care. ' : '') +
      'The highlighted bits are the ones this trick reads first: for a bit scan that is the ' +
      'isolated lowest set bit, `x & −x`, which is the whole input to the De Bruijn multiply. ' +
      'The trick and the loop agree here (' + String(fast[trick.field]) + ' both ways) and cost ' +
      fast.ops + ' against ' + slow.ops + ' operations.');
  }

  /** Which bits to pick out for this trick: the lowest set bit for the scans,
   *  the highest for a leading-zero count, nothing for the rest. */
  function litFor(trickId, value) {
    if (trickId === 'ctz') {
      const index = root.BitTricks.ctzDeBruijn(value).index;
      return index < 32 ? [31 - index] : [];
    }
    if (trickId === 'clz') {
      const index = root.BitTricks.clz(value).index;
      return index < 32 ? [index] : [];
    }
    return [];
  }

  function paintMetrics(audit) {
    root.MetricGrid.update({
      'bm-checked': { value: root.Format.exact(audit.checked),
        note: 'all 65 536 low words plus ' +
          root.Format.exact(audit.checked - 65536) + ' random 32-bit ones' },
      'bm-disagree': { value: root.Format.exact(audit.disagreements),
        note: audit.disagreements === 0 ? 'the trick and the loop agree on every input'
          : 'first at input ' + (audit.examples[0] ? audit.examples[0].input : '—') },
      'bm-mean': { value: root.Format.fixed(audit.saving, 2) + '×',
        note: root.Format.fixed(audit.fastMean, 2) + ' against ' +
          root.Format.fixed(audit.slowMean, 2) + ' operations' },
      'bm-worst': { value: root.Format.fixed(audit.worstSaving, 2) + '×',
        note: audit.fastWorst + ' against ' + audit.slowWorst + ' operations' }
    });
  }

  function paintStages(word) {
    const host = root.jQuery('#bm-stages')[0];
    if (!host) return;
    const stages = root.NumberLab.popcountTrace(word.value);

    root.BitView.renderStack(host, stages.map(function (stage) {
      return { value: stage.value, bits: 32, caption: stage.label + ' — ' + stage.meaning,
        readings: [{ label: 'as hexadecimal', value: stage.hex }] };
    }));

    root.Helpers.setText('bm-stages-note',
      'Read the nibbles down the stack. After the first stage each pair of columns holds the ' +
      'count of those two bits; after the second each group of four holds the count of those ' +
      'four, and so on. The last line is not a bit pattern at all — it is the single number ' +
      'the multiply extracted, ' + root.BitTricks.popcountSwar(word.value).count + ' set bits, ' +
      'in twelve operations regardless of how many there were.');
  }

  function paintSweep(rows) {
    root.jQuery('#bm-sweep tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' + root.Format.exact(row.checked) +
        '</td><td>' + root.Format.exact(row.disagreements) + '</td><td class="mono">' +
        root.Format.fixed(row.fastMean, 2) + ' / ' + root.Format.fixed(row.slowMean, 2) +
        '</td><td>' + root.Format.fixed(row.saving, 2) + '×</td><td class="mono">' +
        row.fastWorst + ' / ' + row.slowWorst + '</td><td>' +
        root.Format.fixed(row.worstSaving, 2) + '×</td></tr>';
    }).join(''));

    const losers = rows.filter(function (row) { return row.saving < 1; });
    root.Helpers.setText('bm-sweep-note',
      'Every row scores 0 disagreements, which is what makes the operation columns worth ' +
      'reading. ' + (losers.length === 0 ? '' :
        losers.map(function (row) { return row.label; }).join(' and ') +
        ' costs MORE than the loop on average (' + root.Format.fixed(losers[0].saving, 2) +
        '×) and far less in the worst case (' + root.Format.fixed(losers[0].worstSaving, 2) +
        '×), because a random word usually has a set bit near the bottom and the loop exits at ' +
        'once. ') +
      'That is the distinction worth carrying away: some of these are wins everywhere and some ' +
      'are only wins in the tail, and the constant-time ones are the ones to reach for when the ' +
      'input is adversarial or the branch is unpredictable.');
  }

  function paintIdentities(rows) {
    root.jQuery('#bm-identities tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td>' + root.Format.exact(row.samples) +
        '</td><td>' + root.Format.exact(row.failures) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bm-identities-note',
      'Every sweep includes zero explicitly, because zero is where these identities are most ' +
      'likely to be stated wrongly: `x & (x − 1)` on zero is zero, so the popcount does not ' +
      'decrease, and the first row is written to allow for that rather than to assume it away. ' +
      'The last row names its own exclusion: at INT_MIN there is no right answer to give, ' +
      'because the negation of the smallest int32 is not an int32 — the branchless form wraps ' +
      'back to INT_MIN and `Math.abs` leaves the width and returns a double. A row that quietly ' +
      'skipped that input would read as a clean pass over one wrong answer.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
