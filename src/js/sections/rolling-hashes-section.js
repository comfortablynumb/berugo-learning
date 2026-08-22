/**
 * Section: Rabin-Karp and rolling hashes.
 *
 * Two halves that share one primitive. The first is matching by fingerprint,
 * and the interesting number is not the comparison count but the spurious-hit
 * count - windows whose hash matched and whose characters did not. With a
 * fixed base and modulus that number is attacker-controlled: a birthday search
 * over about sqrt(modulus) random strings finds a colliding pair in a second,
 * and repeating one of them defeats the filter completely.
 *
 * The second half is the same rolling hash pointed at a different question.
 * Cutting a file wherever the hash of the last few bytes has enough low zero
 * bits makes the boundaries follow the CONTENT, so inserting one byte moves
 * one boundary and leaves every other chunk byte-identical. The panel measures
 * that against a fixed-size chunker on the same edit, and the gap is why rsync
 * and every deduplicating backup tool transfer what they do.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'rolling-hashes';
  const MODULI = [101, 1009, 1000003, 999999937];
  const BIT_STEPS = [3, 4, 5, 6, 7, 8, 9];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the rolling update',
      caption: 'The hash of a window is a polynomial in the base, so moving it one place is: subtract ' +
        'the leading term, multiply by the base, add the new character. Two multiplications and two ' +
        'additions, whatever the window length — which is what makes a fingerprint per position ' +
        'affordable at all.',
      definition: [
        'flowchart LR',
        '    W["h = c₀·bᵐ⁻¹ + c₁·bᵐ⁻² + … + cₘ₋₁"] --> S["subtract c₀·bᵐ⁻¹"]',
        '    S --> M["multiply by b"]',
        '    M --> A["add cₘ"]',
        '    A --> N["h′ = c₁·bᵐ⁻¹ + … + cₘ<br/>the next window, in O(1)"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'The hash of a window is a polynomial in a base: `c₀·bᵐ⁻¹ + c₁·bᵐ⁻² + … + cₘ₋₁`, all modulo ' +
          'something. Sliding it one place is subtract, multiply, add — constant time whatever the ' +
          'window length — so matching becomes a stream of integer comparisons with a character ' +
          'comparison only when a fingerprint hits. The whole design rests on how often that hit is ' +
          'spurious.',
        '**Verification is not optional.** Rabin-Karp with the verification removed is a Monte Carlo ' +
          'algorithm that returns wrong answers at a rate you have to reason about; with it, a ' +
          'collision costs a comparison run and never a wrong answer. The spurious-hit column below ' +
          'is what that costs, and on a well-sized modulus it is zero.',
        '**A fixed base and modulus is a published function, and a birthday search breaks it.** About ' +
          '`√modulus` random strings suffice to find two with the same fingerprint — a second of ' +
          'work, no cleverness. Repeat one of them and every window of the text hashes to the ' +
          'pattern\'s value, so the filter admits everything and the matcher does the quadratic work ' +
          'it exists to avoid. Randomising the base per run breaks the pair, because the pair was a ' +
          'solution for one base only.',
        '**Content-defined chunking is the same hash, asked a different question.** Cut wherever the ' +
          'rolling hash of the last few bytes has enough low zero bits, and the boundaries follow ' +
          'the content rather than the offsets. Insert one byte and one chunk changes; every other ' +
          'chunk is byte-identical and never needs to be transferred, hashed or stored again. A ' +
          'fixed-size chunker loses everything after the insertion point, and the panel measures ' +
          'both on the same edit.'
      ],
      demo: {
        title: 'Interactive demo — the moduli, the attack, and one inserted byte',
        markup: root.RollingHashesTemplate.render()
      },
      diagram: diagram(),
      insight: 'If a rolling hash is exposed to input somebody else chooses, randomise the base at ' +
        'process start. It is one line, it costs nothing, and it converts an attacker-controlled ' +
        'quadratic blow-up into a probabilistic guarantee they cannot aim at. The same reasoning ' +
        'produced SipHash for hash tables after the 2011 flooding attacks, and it is the same ' +
        'reasoning: a deterministic hash of untrusted input is a promise that the worst case is ' +
        'reachable on demand.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.RollingHashesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* -------------------------------------------------------------- fixtures */

  const corpusFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.MatchLab.corpus(parts[0], { size: Number(parts[1]) });
  });

  const moduliFor = root.Helpers.memoise(function (key) {
    const instance = corpusFor(key);

    return MODULI.map(function (modulus) {
      const run = root.RabinKarp.search(instance.text, instance.pattern, { modulus: modulus });
      const windows = Math.max(0, instance.text.length - instance.pattern.length + 1);

      return { modulus: modulus, run: run, windows: windows,
        predicted: windows / modulus };
    });
  });

  const attackFor = root.Helpers.memoise(function () {
    return root.RabinKarp.attackRun({});
  });

  const chunkFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const instance = corpusFor(parts[0] + '|' + parts[1]);
    const at = Math.floor(instance.text.length * Number(parts[3]) / 100);

    return root.RabinKarp.insertionRun(instance.text,
      { bits: Number(parts[2]), at: at, fixed: 64 });
  });

  const bitsFor = root.Helpers.memoise(function (key) {
    const instance = corpusFor(key);

    return BIT_STEPS.map(function (bits) {
      const run = root.RabinKarp.insertionRun(instance.text,
        { bits: bits, at: Math.floor(instance.text.length / 3), fixed: 64 });

      return { bits: bits, run: run };
    });
  });

  /* -------------------------------------------------------------- painting */

  function update(app) {
    const values = panel.values();
    const base = values['rkh-corpus'] + '|' + values['rkh-size'];
    const moduli = moduliFor(base);
    const attack = attackFor('fixed');
    const chunks = chunkFor(base + '|' + values['rkh-bits'] + '|' + values['rkh-insert']);
    const chosen = moduli.filter(function (row) {
      return String(row.modulus) === values['rkh-modulus'];
    })[0] || moduli[2];

    paintMetrics(chosen, attack, chunks);
    paintWindow(corpusFor(base), chosen);
    paintModuli(moduli);
    paintAttack(attack);
    paintChunks(chunks);
    paintBits(bitsFor(base), app);
  }

  function paintMetrics(chosen, attack, chunks) {
    root.MetricGrid.update({
      'rkh-spurious': { value: root.Format.exact(chosen.run.report.spurious),
        note: 'of ' + root.Format.plural(chosen.run.report.hashHits, 'hash hit') +
          ' at modulus ' + root.Format.exact(chosen.modulus) },
      'rkh-attack': { value: attack.built ? root.Format.exact(attack.fixedSpurious) : 'not built',
        note: attack.built
          ? 'against ' + root.Format.exact(attack.randomisedWorst) + ' at the worst of ' +
            root.Format.plural(attack.trials, 'random base')
          : 'the birthday search ran out of budget' },
      'rkh-chunks': { value: root.Format.exact(chunks.chunksAfter),
        note: 'from ' + root.Format.exact(chunks.chunksBefore) +
          ' before the edit; the fixed-size chunker has ' +
          root.Format.exact(chunks.fixedAfter) },
      'rkh-shared': { value: root.Format.fixed(100 * chunks.sharedFraction, 1) + '%',
        note: root.Format.exact(chunks.shared) + ' of ' + root.Format.exact(chunks.chunksBefore) +
          ' against the fixed chunker\'s ' + root.Format.exact(chunks.fixedShared) + ' of ' +
          root.Format.exact(chunks.fixedBefore) }
    });
  }

  function paintWindow(instance, chosen) {
    const pattern = instance.pattern;
    const m = pattern.length;
    const rows = [];
    const base = root.RabinKarp.DEFAULT_BASE;
    const target = root.RabinKarp.hashOf(pattern, 0, m, base, chosen.modulus);

    for (let start = 0; start < Math.min(10, instance.text.length - m); start += 1) {
      const value = root.RabinKarp.hashOf(instance.text, start, m, base, chosen.modulus);

      rows.push({ cells: [String(start),
        root.AlignmentView.display(instance.text.substr(start, m)),
        String(value), value === target ? 'HIT' : '—',
        value === target
          ? (instance.text.substr(start, m) === pattern ? 'verified — a real occurrence'
            : 'verified — SPURIOUS, the characters differ')
          : 'no comparison made at all'] });
    }
    root.MatrixView.render(root.jQuery('#rkh-window')[0], {
      columns: ['start', 'window', 'fingerprint', 'matches the pattern?', 'what happened next'],
      rows: rows
    });
    root.jQuery('#rkh-window-note').text('The pattern "' +
      root.AlignmentView.display(pattern) + '" fingerprints to ' + root.Format.exact(target) +
      ' at modulus ' + root.Format.exact(chosen.modulus) + '. Every row above cost one integer ' +
      'comparison and one rolling update; only the HIT rows cost any character comparisons at all. ' +
      'That is the trade the whole algorithm makes — cheap per window, expensive per hit — and it ' +
      'is a good trade exactly when hits are rare.');
  }

  function paintModuli(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.modulus) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.hashHits) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.positions.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.spurious) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.predicted, 2) + '</td></tr>';
    }).join('');
    const tiny = rows[0];
    const large = rows[rows.length - 1];

    root.jQuery('#rkh-moduli tbody').html(html);
    root.jQuery('#rkh-moduli-note').text('The last column is `windows / modulus`: the expected ' +
      'number of spurious hits if the hash spread perfectly. At modulus ' +
      root.Format.exact(tiny.modulus) + ' the prediction is ' +
      root.Format.fixed(tiny.predicted, 1) + ' and the measurement is ' +
      root.Format.exact(tiny.run.report.spurious) + '; at ' + root.Format.exact(large.modulus) +
      ' the prediction is ' + root.Format.fixed(large.predicted, 4) + ' and the measurement is ' +
      root.Format.exact(large.run.report.spurious) + '. Every row finds exactly the same ' +
      root.Format.plural(rows[0].run.positions.length, 'occurrence') + ' — the modulus decides the ' +
      'work, never the answer, and that is what the verification step buys.');
  }

  function paintAttack(attack) {
    if (!attack.built) {
      root.jQuery('#rkh-defence tbody').html('<tr><td colspan="5">the birthday search ran ' +
        'out of budget before finding a pair</td></tr>');
      return;
    }
    const rows = [
      '<tr><td>fixed base ' + root.Format.exact(root.RabinKarp.DEFAULT_BASE) +
        ', text built against it</td>' +
        '<td class="mono">' + root.Format.exact(root.RabinKarp.DEFAULT_BASE) + '</td>' +
        '<td class="mono">' + root.Format.exact(attack.fixedSpurious) + '</td>' +
        '<td class="mono">' + root.Format.exact(attack.fixedComparisons) + '</td>' +
        '<td class="mono">0</td></tr>',
      '<tr><td>the same text, base randomised per run</td>' +
        '<td class="mono">random, ' + root.Format.plural(attack.trials, 'trial') + '</td>' +
        '<td class="mono">' + root.Format.exact(attack.randomisedWorst) + ' at the worst</td>' +
        '<td class="mono">' + root.Format.exact(attack.randomisedTotal) + ' in total</td>' +
        '<td class="mono">0</td></tr>',
      '<tr><td>the same text, a much larger modulus</td>' +
        '<td class="mono">fixed</td>' +
        '<td class="mono">' + root.Format.exact(attack.widerModulus) + '</td>' +
        '<td class="mono">—</td><td class="mono">0</td></tr>'
    ].join('');

    root.jQuery('#rkh-defence tbody').html(rows);
    root.jQuery('#rkh-defence-note').text('The colliding pair took ' +
      root.Format.exact(attack.examined) + ' random strings to find, against a birthday estimate ' +
      'of about ' + root.Format.exact(attack.expected) + ' — no cleverness, one second of work, ' +
      'and it is repeatable by anyone who knows the base and modulus. The text is that pair\'s ' +
      'second half repeated, so every aligned window fingerprints to the pattern\'s value: ' +
      root.Format.exact(attack.fixedSpurious) + ' spurious hits costing ' +
      root.Format.exact(attack.fixedComparisons) + ' character comparisons, to find ' +
      'nothing. Randomising the base gives ' + root.Format.exact(attack.randomisedTotal) +
      ' spurious hits across ' + root.Format.plural(attack.trials, 'trial') +
      ' on the identical text, because the pair was a solution for one base only.');
  }

  function paintChunks(run) {
    const rows = [
      '<tr><td>content-defined (rolling hash)</td>' +
        '<td class="mono">' + root.Format.exact(run.chunksBefore) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.chunksAfter) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.shared) + '</td>' +
        '<td class="mono">' + root.Format.fixed(100 * run.sharedFraction, 1) + '%</td>' +
        '<td class="mono">' + root.Format.fixed(run.meanChunk, 1) + '</td></tr>',
      '<tr><td>fixed-size, 64 bytes</td>' +
        '<td class="mono">' + root.Format.exact(run.fixedBefore) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.fixedAfter) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.fixedShared) + '</td>' +
        '<td class="mono">' + root.Format.fixed(100 * run.fixedShared /
          Math.max(1, run.fixedBefore), 1) + '%</td>' +
        '<td class="mono">64.0</td></tr>'
    ].join('');

    root.jQuery('#rkh-cdc tbody').html(rows);
    root.jQuery('#rkh-cdc-note').text('One byte inserted. The content-defined chunker keeps ' +
      root.Format.exact(run.shared) + ' of its ' + root.Format.exact(run.chunksBefore) +
      ' chunks byte-identical — ' + root.Format.fixed(100 * run.sharedFraction, 1) +
      '% — because a boundary is decided by the bytes around it and moves with them. The ' +
      'fixed-size chunker keeps ' + root.Format.exact(run.fixedShared) + ' of ' +
      root.Format.exact(run.fixedBefore) + ', or ' +
      root.Format.fixed(100 * run.fixedShared / Math.max(1, run.fixedBefore), 1) +
      '%, because every boundary after the insertion point shifted by one and every chunk after it ' +
      'is a different string. That difference is the whole of why rsync, restic, borg and every ' +
      'deduplicating store cut on content.');
  }

  function paintBits(rows, app) {
    const host = root.jQuery('#rkh-chart')[0];

    if (host) {
      root.GrowthPlot.render(host, {
        lazyLib: app.lazyLib,
        height: 220,
        series: [
          { label: 'mean chunk size', points: rows.map(function (row) {
            return { x: row.bits, y: row.run.meanChunk }; }) },
          { label: 'chunks reused after one inserted byte (%)',
            points: rows.map(function (row) {
              return { x: row.bits, y: 100 * row.run.sharedFraction }; }) }
        ],
        xLabel: 'boundary bits',
        yLabel: 'bytes / per cent',
        legendHost: root.jQuery('#rkh-legend')[0],
        summary: function () {
          return 'Mean chunk size and the reuse fraction against the boundary-bit setting.';
        }
      });
    }
    const small = rows[0];
    const large = rows[rows.length - 1];

    root.jQuery('#rkh-bits-note').text('Each extra bit halves the boundary probability and so ' +
      'doubles the mean chunk: ' + root.Format.fixed(small.run.meanChunk, 1) + ' bytes at ' +
      root.Format.exact(small.bits) + ' bits and ' + root.Format.fixed(large.run.meanChunk, 1) +
      ' at ' + root.Format.exact(large.bits) + '. The reuse fraction moves the other way — ' +
      root.Format.fixed(100 * small.run.sharedFraction, 1) + '% against ' +
      root.Format.fixed(100 * large.run.sharedFraction, 1) + '% — because a bigger chunk is a ' +
      'bigger thing to lose when the edit lands inside it. That is the whole tuning decision in a ' +
      'deduplicating store: small chunks find more duplicates and cost more index, and the ' +
      'boundary-bit setting is the dial.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
