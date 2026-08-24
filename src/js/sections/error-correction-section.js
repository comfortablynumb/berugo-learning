/**
 * Section: error correction.
 *
 * Two exhaustive searches carry this section. Hamming is checked against every
 * data word and every single-bit position — 112 of 112 corrected, with the
 * syndrome equal to the flipped position's index every time — and every
 * double-bit error over the SECDED word, 448 of 448 detected rather than
 * miscorrected. Reed–Solomon is corrupted at rising error counts until it
 * fails, so the correction limit is observed rather than cited.
 *
 * The durability table is the operational half, and it reports the column
 * nobody quotes: an erasure code gives 3× replication's durability at 1.5×
 * storage, and pays for it by reading k fragments from k machines to
 * reconstruct one lost one.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'error-correction';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — an (n, k) code, and what its parity buys',
      caption: 'n symbols carry k of data, and the n − k parity symbols are what the code spends. ' +
        'Any k of the n suffice to reconstruct everything, which gives two different guarantees ' +
        'from the same parity: up to n − k ERASURES — positions known to be bad, because a disc ' +
        'is missing or a read failed — or up to (n − k)/2 unknown ERRORS, because finding where ' +
        'the damage is costs as much redundancy as fixing it. That factor of two is why storage ' +
        'systems care so much about failure detection: a failure that announces itself is worth ' +
        'twice as much parity as one that does not.',
      definition: [
        'flowchart LR',
        '    D["k data symbols"] --> E["encode over GF(256)"]',
        '    E --> C["n symbols: the data, unchanged, plus n − k parity"]',
        '    C --> S1["up to n − k ERASURES repaired<br/>positions known bad"]',
        '    C --> S2["up to (n − k)/2 ERRORS corrected<br/>positions unknown"]',
        '    C --> S3["beyond that: detected, and the decoder must say so"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Correction repairs damage without asking for a retransmission**, which is the only ' +
        'option when there is nobody to ask: a scratched disc, a cosmic ray in a DRAM cell, a QR ' +
        'code with a coffee ring on it, a storage node that is simply gone.',
      '**Hamming’s construction reads the error’s position out of the syndrome.** Put parity bits ' +
        'at the powers of two, each covering the positions whose index has that bit set, and the ' +
        'failing parities spell the bad position’s index in binary. The demo checks that on every ' +
        'data word and every position.',
      '**One more parity bit turns single-error-correct into SECDED.** A double error leaves the ' +
        'syndrome non-zero and the overall parity even, which is a state a single error cannot ' +
        'produce — so it is reported rather than "corrected" into a third error. That is what ECC ' +
        'memory does, and the demo verifies all 448 double-bit cases.',
      '**Reed–Solomon works over symbols and over a finite field.** n symbols carry k of data, ' +
        'any k of them reconstruct everything, and the arithmetic is GF(256) — bytes, with XOR ' +
        'for addition and a table for multiplication, so there is no floating point to lose ' +
        'precision to.',
      '**Erasures are worth twice as much parity as errors.** A missing disc announces itself, so ' +
        'there is nothing to locate and n − k of them can be repaired; an unknown error costs ' +
        'redundancy to FIND as well as to fix, so only (n − k)/2 are correctable. The demo shows ' +
        'both limits on the same codeword.',
      '**Past the limit the decoder must say so.** A decoder without a limit check can ' +
        '"correct" to a valid but wrong codeword, which is silent data corruption produced by the ' +
        'error-correction machinery itself. The demo’s table has a row past the limit and it ' +
        'reports beyond-limit rather than a plausible answer.',
      '**Erasure coding gives 3× replication’s durability at about 1.5× storage**, which is why ' +
        'every large object store uses it. The demo tabulates the trade at four parameter ' +
        'choices with the storage factor beside the loss tolerance.',
      '**The cost nobody mentions is on the read path.** Replication reads one copy; an erasure ' +
        'code reconstructs a lost fragment by reading k fragments from k machines, so one failure ' +
        'turns one read into k reads across the network. That reconstruction amplification is the ' +
        'operational price, and it is in the last column.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — corrupt a codeword and watch the limit arrive',
        markup: root.ErrorCorrectionTemplate.render()
      },
      diagram: diagram(),
      insight: '**Erasure coding gives the same durability as 3× replication at around 1.5× ' +
        'storage — and its reconstruction read amplification is the operational cost nobody ' +
        'mentions.** A cluster that switches from replication to an (n, k) code halves its ' +
        'storage bill and multiplies its cross-network traffic during recovery by k, which is ' +
        'fine on a quiet Tuesday and is exactly what turns a single node failure into a cascading ' +
        'one. The other half of the reading is the erasure/error distinction: detection is worth ' +
        'twice as much parity as correction, so anything that makes a failure announce itself — ' +
        'a checksum per fragment, a health check that fails fast — is doubling the value of the ' +
        'redundancy you already paid for.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ErrorCorrectionTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const hammingFor = root.Helpers.memoise(function () {
    return root.IntegrityLab.hammingStudy();
  });

  const rsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.IntegrityLab.reedSolomonStudy({ k: Number(parts[0]), parity: Number(parts[1]) });
  });

  const erasureFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.IntegrityLab.erasureStudy({ k: Number(parts[0]), parity: Number(parts[1]) });
  });

  const durabilityFor = root.Helpers.memoise(function () {
    return root.IntegrityLab.durabilityStudy({});
  });

  function update(app) {
    const values = panel.values();
    const key = values['ecc-data'] + '|' + values['ecc-parity'];

    paintMetrics(hammingFor(''), rsFor(key), erasureFor(key));
    paintChart(app, durabilityFor(''));
    paintRs(rsFor(key));
    paintErasures(erasureFor(key));
    paintDurability(durabilityFor(''));
  }

  function paintMetrics(hamming, rs, erasures) {
    const repaired = erasures.rows.filter(function (row) { return row.repaired; });

    root.MetricGrid.update({
      'ecc-hamming': { value: root.Format.exact(hamming.singleCorrected) + ' of ' +
        root.Format.exact(hamming.singleTrials),
      note: 'every one of ' + root.Format.exact(hamming.dataWords) +
          ' data words, at every bit position, with the right syndrome' },
      'ecc-secded': { value: root.Format.exact(hamming.doubleDetected) + ' of ' +
        root.Format.exact(hamming.doubleTrials),
      note: 'flagged as a double error rather than miscorrected into a third' },
      'ecc-limit': { value: root.Format.exact(rs.limit) + ' symbols',
        note: 'RS(' + rs.n + ', ' + rs.k + ') with ' + rs.parity +
          ' parity symbols — the search fails at ' + (rs.limit + 1) },
      'ecc-erasures': { value: root.Format.exact(repaired.length - 1) + ' symbols',
        note: 'twice the error limit, because a known position costs nothing to locate' }
    });
  }

  function paintChart(app, durability) {
    const host = root.jQuery('#ecc-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, yMin: 0,
      xLabel: 'losses tolerated', yLabel: 'storage multiplier',
      series: [
        { label: 'replication', points: durability.filter(function (row) {
          return row.kind === 'replication';
        }).map(function (row) { return { x: row.tolerates, y: row.storage }; }) },
        { label: 'erasure coding', points: durability.filter(function (row) {
          return row.kind === 'erasure';
        }).sort(function (a, b) { return a.tolerates - b.tolerates; })
          .map(function (row) { return { x: row.tolerates, y: row.storage }; }) }
      ]
    });

    const three = durability.filter(function (row) { return row.name === '3× replication'; })[0];
    const rs = durability.filter(function (row) { return row.name === 'RS(12, 8)'; })[0];
    root.Helpers.setText('ecc-chart-note',
      'Two lines, and the gap between them is the reason erasure coding exists. Replication ' +
      'climbs one whole copy per extra loss tolerated: ' +
      root.Format.fixed(three.storage, 1) + '× storage to survive ' +
      root.Format.exact(three.tolerates) + ' losses. The erasure line survives ' +
      root.Format.exact(rs.tolerates) + ' at ' + root.Format.fixed(rs.storage, 2) +
      '× — twice the tolerance for half the storage. What the plot cannot show is the ' +
      'reconstruction cost, which is why the table below carries it as its own column: ' +
      'replication rebuilds a lost copy by reading one, and RS(12, 8) rebuilds a lost fragment ' +
      'by reading ' + root.Format.exact(rs.reconstructReads) + '.');
  }

  function paintRs(rs) {
    root.jQuery('#ecc-rs tbody').html(rs.rows.map(function (row) {
      return '<tr><td class="mono">' + row.errors + '</td><td class="mono">' +
        (row.withinLimit ? 'yes' : 'no') + '</td><td class="mono">' + row.status +
        '</td><td class="mono">' + (row.recovered ? 'yes' : 'no') + '</td></tr>';
    }).join(''));

    const past = rs.rows.filter(function (row) { return !row.withinLimit; })[0];
    root.Helpers.setText('ecc-rs-note',
      'RS(' + rs.n + ', ' + rs.k + ') over GF(256): ' + rs.k + ' data symbols, ' + rs.parity +
      ' parity, so the correction limit is ' + root.Format.exact(rs.limit) +
      ' unknown errors. Every row up to that limit recovers the original data exactly; the row ' +
      'at ' + root.Format.exact(past.errors) + ' errors reports "' + past.status +
      '" rather than returning something. That last behaviour is the important one — a decoder ' +
      'that keeps searching past its limit will eventually land on a DIFFERENT valid codeword ' +
      'and return it confidently, which is silent corruption manufactured by the ' +
      'error-correction machinery itself.');
  }

  function paintErasures(erasures) {
    root.jQuery('#ecc-repair tbody').html(erasures.rows.map(function (row) {
      return '<tr><td class="mono">' + row.erasures + '</td><td class="mono">' +
        (row.withinLimit ? 'yes' : 'no') + '</td><td class="mono">' +
        (row.repaired ? 'yes' : 'no') + '</td><td>' + (row.reason || '—') + '</td></tr>';
    }).join(''));

    const failed = erasures.rows.filter(function (row) { return !row.repaired; })[0];
    root.Helpers.setText('ecc-repair-note',
      'The same codeword, the same parity, and one difference: the decoder is TOLD which ' +
      'positions are bad. It repairs ' + root.Format.exact(erasures.parity) +
      ' of them — every parity symbol buys back exactly one erasure — against ' +
      root.Format.exact(Math.floor(erasures.parity / 2)) + ' unknown errors in the table above. ' +
      'The first failing row is at ' + (failed ? root.Format.exact(failed.erasures) : '—') +
      ', and it fails by refusing rather than by returning something wrong. This factor of two ' +
      'is why distributed storage cares so much about failure DETECTION: a node that is known to ' +
      'be down is worth twice as much as one that is silently returning bad bytes.');
  }

  function paintDurability(rows) {
    root.jQuery('#ecc-durability tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' +
        root.Format.fixed(row.storage, 2) + '×</td><td class="mono">' +
        root.Format.exact(row.tolerates) + '</td><td class="mono">' +
        root.Format.exact(row.reconstructReads) + '</td><td class="mono">' +
        root.Format.fixed(row.storageAgainstThree, 2) + '×</td></tr>';
    }).join(''));

    const three = rows.filter(function (row) { return row.name === '3× replication'; })[0];
    const rs = rows.filter(function (row) { return row.name === 'RS(14, 10)'; })[0];
    root.Helpers.setText('ecc-durability-note',
      'Compare the third row down against three-way replication: ' +
      root.Format.fixed(rs.storage, 2) + '× storage against ' +
      root.Format.fixed(three.storage, 1) + '×, tolerating ' + root.Format.exact(rs.tolerates) +
      ' losses against ' + root.Format.exact(three.tolerates) + '. That is more durability for ' +
      root.Format.percent(rs.storageAgainstThree, 0) + ' of the storage, and it is why every ' +
      'large object store made this switch. The fourth column is the bill: reconstructing one ' +
      'lost fragment reads ' + root.Format.exact(rs.reconstructReads) +
      ' fragments from ' + root.Format.exact(rs.reconstructReads) + ' machines, where ' +
      'replication reads one. On a quiet day that is invisible; during a correlated failure it ' +
      'is the traffic that turns one dead node into a busy cluster.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
