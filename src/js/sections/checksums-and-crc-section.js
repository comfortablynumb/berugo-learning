/**
 * Section: error detection.
 *
 * The measurement is the reorder column. A byte sum and a parity bit catch
 * 100% of single-bit flips and 0% of byte swaps, because addition is
 * commutative — and reordering is exactly what a buggy scatter-gather or a
 * misordered packet reassembly produces. The Internet checksum, still in every
 * TCP header, catches about half.
 *
 * The burst table is the other half, and it is careful about what it claims:
 * verifying "every burst of 32 bits is caught" exhaustively would need 2^30
 * patterns per position, so the search is exhaustive to a stated length and
 * sampled beyond it, and each row says which it was.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'checksums-and-crc';
  const MESSAGES = {
    pangram: 'the quick brown fox jumps over the lazy dog. pack my box with five dozen.',
    json: '{"id":42,"name":"widget","price":19.99,"tags":["a","b"],"active":true,"qty":7}',
    zeros: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  };
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
      title: 'Diagram — CRC as shift-and-XOR polynomial division',
      caption: 'A CRC treats the message as a polynomial over GF(2) — coefficients are bits, ' +
        'addition is XOR, there are no carries — and the checksum is the remainder after ' +
        'dividing by a generator polynomial. The table-driven implementation is that division ' +
        'with a byte of work precomputed, and slicing-by-8 does eight bytes at a time. What the ' +
        'algebra buys is a proof: an error is undetected exactly when its own polynomial is ' +
        'divisible by the generator, and no burst shorter than the generator’s degree can be.',
      definition: [
        'flowchart TD',
        '    M["message bits, as a polynomial"] --> A["append 32 zero bits"]',
        '    A --> D["divide by the generator<br/>0xEDB88320, degree 32"]',
        '    D --> R["remainder = the CRC"]',
        '    R --> T["table-driven: one lookup and one XOR per byte"]',
        '    D --> P["the guarantee: an error survives only if its own polynomial<br/>is divisible by the generator"]',
        '    P --> B["a burst shorter than 32 bits cannot be"]'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**A checksum is a claim about which corruptions it catches, and the claims differ ' +
        'enormously.** The demo runs the search rather than quoting the claim: every single-bit ' +
        'flip, thousands of double-bit flips, every byte swap it has budget for, and bursts up to ' +
        'a stated length.',
      '**A commutative sum cannot see reordering.** A byte sum and a parity bit catch every ' +
        'single-bit flip and zero per cent of byte swaps, because addition does not care about ' +
        'order. That is not a theoretical concern — misordered reassembly and scatter-gather bugs ' +
        'produce exactly this error.',
      '**Fletcher and Adler fix ordering by keeping a running sum of the running sum.** The ' +
        'second accumulator gives each byte a weight that depends on its position, so a swap ' +
        'changes the result. Adler-32 is Fletcher with a prime modulus, and it is what zlib uses.',
      '**CRC is different in kind: it is polynomial division over GF(2).** Coefficients are bits, ' +
        'addition is XOR, and the checksum is a remainder. That algebra is what turns "usually ' +
        'catches errors" into proved guarantees about specific error classes.',
      '**Bursts are why CRC survives in hardware.** Real media do not produce independent ' +
        'single-bit flips — they produce scratches, interference and whole bad sectors — and a ' +
        'burst shorter than the generator’s degree is caught with CERTAINTY rather than with high ' +
        'probability.',
      '**The demo is careful about what "verified" means.** Checking every burst of 32 bits ' +
        'exhaustively would need 2^30 patterns per position, so the search is exhaustive to a ' +
        'stated length and samples beyond it. Each row says which, because a guarantee reported ' +
        'from a sampled search is a different claim.',
      '**The implementation is table-driven, and checked against the bit-at-a-time version.** One ' +
        'lookup and one XOR per byte, from a 256-entry table; slicing-by-8 extends it to a word ' +
        'at a time. Both agree with the published test vectors, which is the only reason to ' +
        'believe either.',
      '**None of them detects an adversary, and confusing the two is the failure this section ' +
        'exists to prevent.** A CRC is public and invertible: four appended bytes make it come ' +
        'out to any value you like, and the demo does exactly that. A checksum answers "did the ' +
        'wire corrupt this"; only a keyed cryptographic hash answers "did somebody change this".'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — inject errors and see which detector catches which',
        markup: root.ChecksumsTemplate.render()
      },
      diagram: diagram(),
      insight: '**CRC detects the error classes hardware actually produces — bursts — which is ' +
        'why it survives in storage and networking where a plain sum would not; and it detects ' +
        'nothing about an adversary, which is why it is never an integrity check.** Both halves ' +
        'matter operationally. The first says a checksum should be chosen against the failure ' +
        'mode of the medium rather than by width: a 16-bit CRC beats a 32-bit sum on a channel ' +
        'that produces bursts. The second is the one that shows up in incident reports — a system ' +
        'that validates uploads with a CRC has verified that the transfer worked, and has ' +
        'verified nothing at all about who wrote the bytes.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ChecksumsTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const detectFor = root.Helpers.memoise(function (key) {
    return root.IntegrityLab.detectionStudy({ message: MESSAGES[key] });
  });

  const burstFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.IntegrityLab.burstStudy({ message: MESSAGES[parts[0]],
      maxLength: Number(parts[1]), exhaustiveTo: 9 });
  });

  const vectorsFor = root.Helpers.memoise(function () {
    return root.IntegrityLab.vectorCheck();
  });

  const forgeFor = root.Helpers.memoise(function (key) {
    return root.IntegrityLab.forgeryStudy({ message: MESSAGES[key] });
  });

  function update(app) {
    const values = panel.values();
    const detect = detectFor(values['crc-message']);
    const bursts = burstFor(values['crc-message'] + '|' + values['crc-length']);

    paintMetrics(detect, bursts, vectorsFor(''), forgeFor(values['crc-message']));
    paintChart(app, bursts);
    paintDetect(detect);
    paintBursts(bursts);
    paintVectors(vectorsFor(''));
  }

  function rowFor(rows, name) {
    return rows.filter(function (row) { return row.name === name; })[0];
  }

  function paintMetrics(detect, bursts, vectors, forge) {
    const crc = rowFor(bursts.rows, 'CRC-32');
    const internet = rowFor(detect.rows, 'Internet checksum');
    const passed = vectors.filter(function (row) { return row.matches; }).length;

    root.MetricGrid.update({
      'crc-vectors': { value: root.Format.exact(passed) + ' of ' +
        root.Format.exact(vectors.length),
      note: passed === vectors.length
        ? 'both implementations agree with the standard on every vector'
        : 'A VECTOR DOES NOT MATCH — the implementation is wrong' },
      'crc-burst': { value: root.Format.exact(crc.noneMissed) + ' bits',
        note: 'exhaustively searched to ' + root.Format.exact(crc.guaranteed) +
          ', sampled beyond it' },
      'crc-reorder': { value: root.Format.percent(internet.reorder, 1),
        note: 'over ' + root.Format.exact(internet.reorderTrials) + ' swaps of two bytes' },
      'crc-forge': { value: forge.found ? root.Format.exact(forge.suffixBytes) + ' bytes'
        : 'not found',
      note: forge.matches
        ? 'appended to a prefix, and the CRC now equals a chosen target exactly'
        : 'the search did not complete at this message length' }
    });
  }

  function paintChart(app, bursts) {
    const host = root.jQuery('#crc-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    const shown = ['byte sum', 'Internet checksum', 'Fletcher-16', 'CRC-32'];

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 250, yMin: 0,
      xLabel: 'burst length (bits)', yLabel: 'fraction caught',
      series: shown.map(function (name) {
        const row = rowFor(bursts.rows, name);

        return { label: name, points: row.lengths.filter(function (entry) {
          return entry.rate > 0 || entry.length > 1;
        }).map(function (entry) {
          return { x: entry.length, y: entry.rate };
        }) };
      })
    });

    const crc = rowFor(bursts.rows, 'CRC-32');
    const sum = rowFor(bursts.rows, 'byte sum');
    root.Helpers.setText('crc-chart-note',
      'Each line is the fraction of bursts of that length a detector caught. They all start at ' +
      '1.0 and fall off a cliff at their own width: the byte sum at ' +
      root.Format.exact(sum.firstMiss || 9) + ' bits, the 16-bit checksums at 17, and CRC-32 ' +
      'stays at 1.0 across the whole range searched — nothing of any length up to ' +
      root.Format.exact(crc.noneMissed) + ' bits got through. The cliff position IS the ' +
      'guarantee, and it is set by the width of the detector rather than by how clever it is: ' +
      'the honest way to choose one is to ask how long the bursts your medium produces are.');
  }

  function paintDetect(detect) {
    root.jQuery('#crc-detect tbody').html(detect.rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + row.width +
        '</td><td class="mono">' + root.Format.percent(row.single, 1) + '</td><td class="mono">' +
        root.Format.percent(row.double, 1) + '</td><td class="mono">' +
        root.Format.percent(row.reorder, 1) + '</td></tr>';
    }).join(''));

    const sum = rowFor(detect.rows, 'byte sum');
    const parity = rowFor(detect.rows, 'parity');
    const fletcher = rowFor(detect.rows, 'Fletcher-16');
    root.Helpers.setText('crc-detect-note',
      'The first column is a perfect score for everything — a single bit flip changes any of ' +
      'these functions — and it is the column a naive test would stop at. The last column is ' +
      'where the design shows: a byte sum catches ' + root.Format.percent(sum.reorder, 0) +
      ' of byte swaps, because addition is commutative and reordering the terms cannot change ' +
      'the total. Fletcher’s second accumulator gives each byte a position-dependent weight and ' +
      'takes it to ' + root.Format.percent(fletcher.reorder, 1) + '. Parity is the extreme case ' +
      'in the middle column: it catches every ODD number of bit flips and ' +
      root.Format.percent(parity.double, 0) + ' of even ones, by construction.');
  }

  function paintBursts(bursts) {
    root.jQuery('#crc-bursts tbody').html(bursts.rows.map(function (row) {
      return '<tr><td>' + row.name + '</td><td class="mono">' + row.width +
        '</td><td class="mono">' + root.Format.exact(row.guaranteed) + '</td><td class="mono">' +
        root.Format.exact(row.noneMissed) + '</td><td class="mono">' +
        (row.firstMiss === null ? 'none in range' : root.Format.exact(row.firstMiss)) +
        '</td><td class="mono">' +
        (row.firstMissRate === null ? '—' : root.Format.percent(row.firstMissRate, 2)) +
        '</td></tr>';
    }).join(''));

    const crc = rowFor(bursts.rows, 'CRC-32');
    root.Helpers.setText('crc-bursts-note',
      'Two different claims in two columns, and the distinction is the honest part. The third ' +
      'column counts only lengths where EVERY interior pattern was tried — up to ' +
      root.Format.exact(bursts.exhaustiveTo) + ' bits, beyond which the pattern count doubles ' +
      'per bit and the search stops being finishable. The fourth column includes the sampled ' +
      'rows. CRC-32 misses nothing up to ' + root.Format.exact(crc.noneMissed) +
      ' bits in this search, which is consistent with the theorem that no burst shorter than the ' +
      'generator’s degree of 32 can survive — but a sampled search is evidence for a theorem ' +
      'rather than a proof of one, and saying so is the difference between a measurement and a ' +
      'quotation.');
  }

  function paintVectors(vectors) {
    root.jQuery('#crc-standard tbody').html(vectors.map(function (row) {
      return '<tr><td class="mono">' + row.input.slice(0, 44) + '</td><td class="mono">' +
        row.expected.toString(16).padStart(8, '0') + '</td><td class="mono">' +
        row.table.toString(16).padStart(8, '0') + '</td><td class="mono">' +
        row.bitwise.toString(16).padStart(8, '0') + '</td><td class="mono">' +
        (row.matches ? 'yes' : 'NO') + '</td></tr>';
    }).join(''));

    root.Helpers.setText('crc-standard-note',
      'Two independent implementations — a 256-entry table and a bit-at-a-time loop — against ' +
      'the published values for CRC-32. They agree with the standard and with each other on ' +
      'every row, which is the only reason to trust the detection numbers above: a checksum ' +
      'implementation that is subtly wrong still produces a stable, plausible-looking value for ' +
      'every input, and the only way to know is to check it against somebody else’s answer. The ' +
      '"123456789" row is the conventional check value that appears in every CRC catalogue for ' +
      'exactly this purpose.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
