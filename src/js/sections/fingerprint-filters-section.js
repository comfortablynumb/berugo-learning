/**
 * Section: cuckoo and quotient filters.
 *
 * Both store a fingerprint rather than setting bits, and that one change buys
 * deletion and costs a hard capacity ceiling. The demo is built around the two
 * consequences a Bloom filter does not have: an insert that can *fail*, and a
 * delete that can corrupt.
 *
 * The phantom-delete panel is the part to keep. It looks like a set API, the
 * removal is accepted, nothing is reported, and from then on the filter answers
 * "no" about keys it holds.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'fingerprint-filters';
  /* The probe count the worked example quotes, so the demo shows those figures. */
  const PROBES = 50000;
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A cuckoo filter stores an f-bit fingerprint of each key in one of two candidate buckets. The ' +
          'second bucket is derived from the first by XOR with a hash of the *fingerprint*, so a ' +
          'relocation can compute where an evicted fingerprint may go without the key it came from — ' +
          'which is what makes the structure possible at all, since the keys were never stored. That ' +
          'XOR is an involution only when the bucket count is a power of two.',
        'The trade against Bloom is space against a ceiling. At 8-bit fingerprints and four slots per ' +
          'bucket the table fills to 97.1% and costs 8.24 bits per item at a measured 2.98% error; a ' +
          'Bloom filter at that error costs about 7 bits. Below a per-cent or so the ranking reverses, ' +
          'because Bloom pays 1.44·log₂(1/ε) and the fingerprint pays log₂(1/ε) plus the bucket ' +
          'overhead. The ceiling has no equivalent at all: past 97% an insert simply fails.',
        'A quotient filter reaches the same place from the other side. The fingerprint is split into a ' +
          'slot index and a remainder, and three metadata bits per slot record enough to rebuild which ' +
          'remainder belongs to which quotient after linear probing moved it. A query reads one ' +
          'contiguous run — 1.00 cache lines against a Bloom filter\'s 6.88 — and the whole table can ' +
          'be read out in ascending fingerprint order, which is what makes two of them mergeable ' +
          'without either key set.'
      ],
      demo: { title: 'Interactive demo — filling, failing, deleting and merging', markup: root.FingerprintFiltersTemplate.render() },
      diagram: {
        title: 'Diagram — the two candidate buckets, and why the XOR has to be one',
        caption: 'From either bucket, XOR with the same hash of the fingerprint returns the other. ' +
          'That is why a relocation never needs the original key.',
        definition: [
          'flowchart LR',
          '    K["key x"] --> F["fingerprint f = h_f(x)"]',
          '    K --> I1["i1 = h(x) mod b"]',
          '    F --> HF["h(f) mod b"]',
          '    I1 --> X["i2 = i1 XOR h(f)"]',
          '    HF --> X',
          '    X --> B2["bucket i2"]',
          '    I1 --> B1["bucket i1"]',
          '    B2 -->|"XOR h(f) again"| B1',
          '    B1 -->|"XOR h(f)"| B2'
        ].join('\n')
      },
      insight: 'Deleting an item you never inserted corrupts a cuckoo filter silently. The API looks ' +
        'like a set — add, contains, remove — and it is not one: remove finds *a* matching fingerprint ' +
        'and clears it, which may belong to a different key entirely. Every production use needs an ' +
        'invariant on the caller\'s side that a removal is only ever issued for something that was ' +
        'inserted, and that invariant lives outside the filter where nothing enforces it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.FingerprintFiltersTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /** Everything the panels need, measured once from the current control values. */
  function measure(values) {
    const capacity = Number(values['fpf-capacity']);
    const bucketSize = Number(values['fpf-bucket']);
    const bits = values['fpf-bits'];

    return {
      capacity: capacity,
      bits: bits,
      profile: root.FilterLab.chainProfile({
        capacity: capacity, bucketSize: bucketSize, fingerprintBits: bits,
        maxKicks: values['fpf-kicks'], seed: 5
      }),
      sweep: root.FilterLab.cuckooSweep({
        capacity: capacity, bucketSize: bucketSize, seed: 5, probes: PROBES,
        fingerprintBits: [4, 6, 8, 10, 12, 14, 16]
      }),
      buckets: root.FilterLab.bucketSweep({ capacity: capacity, fingerprintBits: bits, seed: 5 }),
      phantom: root.FilterLab.phantomDeletes({
        n: Math.floor(capacity / 3), capacity: capacity, fingerprintBits: bits, seed: 3
      }),
      space: root.FilterLab.spaceAtError({
        n: 8000, p: Number(values['fpf-target']), seed: 9, probes: PROBES
      }),
      merge: root.FilterLab.quotientMerge({ n: 2000 })
    };
  }

  const measured = root.Helpers.memoise(function (key) {
    return measure(JSON.parse(key));
  });

  function update(app) {
    const values = panel.values();
    const state = measured(JSON.stringify(values));
    const capacity = state.capacity;
    const bits = state.bits;
    const profile = state.profile;
    const sweep = state.sweep;
    const buckets = state.buckets;
    const phantom = state.phantom;
    const space = state.space;
    const merge = state.merge;
    const current = sweep.filter(function (row) { return row.fingerprintBits === bits; })[0] || sweep[0];

    root.MetricGrid.update({
      'fpf-load': {
        value: root.Format.percent(profile.load, 2),
        note: root.Format.exact(profile.inserted) + ' of ' + root.Format.exact(capacity) + ' slots'
      },
      'fpf-kicksper': {
        value: root.Format.fixed(profile.meanChain, 2),
        note: 'longest chain ' + profile.longest.length + ', at insert ' + root.Format.exact(profile.longest.at)
      },
      'fpf-error': {
        value: root.Format.percent(current.measured, 3),
        note: 'predicted ' + root.Format.percent(current.predicted, 3) + ' at f = ' + bits + ' bits'
      },
      'fpf-damage': {
        value: root.Format.exact(phantom.falseNegatives),
        note: root.Format.exact(phantom.accepted) + ' of ' + root.Format.exact(phantom.ghosts) +
          ' phantom deletes were accepted'
      }
    });

    paintSweep(sweep, bits);
    paintBuckets(buckets);
    paintPhantom(phantom);
    paintSpace(space);
    paintMerge(merge);
    draw(app, profile);
  }

  function paintSweep(sweep, bits) {
    const rows = sweep.map(function (row) {
      const current = row.fingerprintBits === bits;
      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + row.fingerprintBits + ' bits</td>' +
        '<td class="mono">' + root.Format.exact(row.inserted) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.load, 2) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.predicted, 4) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.measured, 4) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.bitsPerItem, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.kicksPerInsert, 2) + '</td></tr>';
    }).join('');

    root.jQuery('#fpf-sweep tbody').html(rows);
    root.jQuery('#fpf-sweep-note').text('The load column barely moves down the table and the error ' +
      'column halves at every row. Those are two independent dials: how full the table gets is decided ' +
      'by the bucket geometry, and how often it lies is decided by the fingerprint width. A fingerprint ' +
      'is a whole number of bits, so you cannot ask for 1% — you get 3.1% or 0.78% and choose which ' +
      'side to be on.');
  }

  function paintBuckets(buckets) {
    const rows = buckets.map(function (row) {
      return '<tr><td class="mono">' + row.bucketSize + '</td>' +
        '<td class="mono">' + root.Format.percent(row.load, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.inserted) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.kicksPerInsert, 2) + '</td></tr>';
    }).join('');

    root.jQuery('#fpf-buckets tbody').html(rows);
    root.jQuery('#fpf-buckets-note').text('One slot per bucket is plain cuckoo hashing and it jams at ' +
      'about half full — the classic result. Four slots is where the curve flattens, and it is why ' +
      'every cuckoo filter in the wild uses four: the load goes from 88% to 97% and the eviction cost ' +
      'does not get worse.');
  }

  function paintPhantom(phantom) {
    root.jQuery('#fpf-phantom').text([
      'keys inserted:                       ' + root.Format.exact(phantom.inserted),
      'deletes issued for keys never added: ' + root.Format.exact(phantom.ghosts),
      'deletes the filter accepted:         ' + root.Format.exact(phantom.accepted) +
        '  (it found a matching fingerprint)',
      'deletes it refused:                  ' + root.Format.exact(phantom.ghosts - phantom.accepted),
      '',
      'keys now missing that were inserted: ' + root.Format.exact(phantom.falseNegatives),
      'errors reported at the time:         0'
    ].join('\n'));

    root.jQuery('#fpf-phantom-note').text('Every accepted phantom delete removed a real key\'s ' +
      'fingerprint, because a fingerprint collision is exactly what the filter cannot distinguish. ' +
      'The number of accepted phantoms is the false-positive rate times the number of attempts, so ' +
      'the damage scales with the error rate you chose — and a filter is normally chosen with a ' +
      'tolerable error rate in mind, not a tolerable corruption rate.');
  }

  function paintSpace(space) {
    const rows = space.rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.bitsPerItem, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.bitsPerItemFull, 2) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.predicted, 4) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.measured, 4) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.linesPerQuery, 2) + '</td>' +
        '<td class="mono">' + row.deletes + '</td></tr>';
    }).join('');

    root.jQuery('#fpf-space tbody').html(rows);
    root.jQuery('#fpf-space-note').text('Two memory columns, because the textbook comparison assumes ' +
      'a full table and a real one is rounded up to a power of two. For ' + root.Format.exact(space.keys) +
      ' keys the bucketed families are about half empty, and that rounding — not the algorithm — is ' +
      'most of the difference in the first column. The second column is the comparison the papers make.');
  }

  function paintMerge(merge) {
    root.jQuery('#fpf-merge').text([
      'left filter:   ' + root.Format.exact(merge.left.count()) + ' fingerprints, q = ' +
        merge.left.quotientBits() + ', r = ' + merge.remainderBefore,
      'right filter:  ' + root.Format.exact(merge.right.count()) + ' fingerprints, same shape',
      '',
      'merged filter: ' + root.Format.exact(merge.merged.count()) + ' fingerprints, q = ' +
        merge.merged.quotientBits() + ', r = ' + merge.remainderAfter,
      '  one bit moved from the remainder to the quotient, so p = q + r is unchanged',
      '  and every fingerprint survives untouched',
      '',
      'fingerprint multiset preserved exactly: ' + (merge.fingerprintsPreserved ? 'yes' : 'NO'),
      'bits: ' + root.Format.exact(merge.bitsBefore) + ' → ' + root.Format.exact(merge.bitsAfter),
      'keys consulted during the merge: 0'
    ].join('\n'));

    root.jQuery('#fpf-merge-note').text('The merge is one linear pass over two ascending read-outs. ' +
      'Nothing is rehashed, because nothing can be: the keys are gone. That is the property a ' +
      'per-shard filter needs, and a Bloom filter has it only when both sides were built with the ' +
      'identical m, k and seed.');
  }

  function draw(app, profile) {
    const values = profile.histogram
      .filter(function (row) { return row.length <= 12; })
      .map(function (row) { return { label: String(row.length), value: row.count }; });
    const tail = profile.histogram
      .filter(function (row) { return row.length > 12; })
      .reduce(function (sum, row) { return sum + row.count; }, 0);
    values.push({ label: '13+', value: tail });

    chart = root.ErrorBandView.bars(root.jQuery('#fpf-chain-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      values: values,
      xLabel: 'evictions needed by one insert',
      yLabel: 'inserts',
      summary: function () {
        return 'Most inserts need no eviction at all; the tail runs to ' + profile.longest.length +
          ' and is what the chain limit exists to bound.';
      }
    });

    const free = profile.histogram.filter(function (row) { return row.length === 0; })[0];
    root.jQuery('#fpf-chain-note').text(root.Format.percent(free.count / profile.inserted, 1) +
      ' of inserts found a free slot immediately and evicted nothing. The mean is ' +
      root.Format.fixed(profile.meanChain, 2) + ' and the longest chain in this fill was ' +
      profile.longest.length + ' — a factor of ' +
      root.Format.exact(Math.round(profile.longest.length / Math.max(0.01, profile.meanChain))) +
      ' between the average and the worst, which is why an insert cost quoted as a mean is not a ' +
      'latency budget.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
