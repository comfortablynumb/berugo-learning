/**
 * Section: Inverted indexes and postings.
 *
 * The structure is a map from term to sorted document list, which takes one
 * sentence. Everything worth a section is downstream of that: which
 * intersection algorithm, which posting encoding, and whether positions are
 * worth their weight.
 *
 * The skew slider is the demo's centre, because the usual advice ("use
 * galloping") is only right on one side of it. At 10 against 100 000 galloping
 * does 370× fewer comparisons than a linear merge; at 50 000 against 100 000 it
 * does more. A strategy chosen without measuring the skew is a coin flip.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'inverted-indexes';
  const LONG_LIST = 100000;
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
        'An inverted index maps each term to the sorted list of documents holding it. A boolean AND ' +
          'query is the intersection of those lists, and because they are sorted the intersection is ' +
          'a merge rather than a set operation. One free optimisation dominates every clever one: ' +
          'intersect the shortest list first, because the result can only shrink.',
        'Which merge matters, and it depends on the shape of the query rather than on the algorithm. ' +
          'A linear merge walks both lists in step and costs the sum of their lengths. Skip pointers ' +
          'every √n entries let it jump over runs that cannot match. Galloping probes 1, 2, 4, 8 … ' +
          'positions ahead and then binary-searches the bracket. That is O(m log(n/m)) — ' +
          'enormously better when one list is rare and one is common, and worse when they are the ' +
          'same length.',
        'Postings are stored as gaps rather than ids, because gaps are small and small numbers ' +
          'compress. Variable-byte gets most gaps into one byte; Simple-9 packs several into a ' +
          '32-bit word. Positions, which phrase queries need, cost more than the postings they ' +
          'annotate — which is why phrase search is a feature you enable rather than one you ' +
          'always have.'
      ],
      demo: {
        title: 'Interactive demo — intersection, encoding and the skew that decides',
        markup: root.InvertedIndexesTemplate.render()
      },
      diagram: {
        title: 'Diagram — a postings list with skip pointers',
        caption: 'A skip pointer lets the walk jump a whole block when the target is past its end.',
        definition: [
          'flowchart LR',
          '    P0["2"] --> P1["9"] --> P2["17"] --> P3["24"] --> P4["31"] --> P5["48"] --> P6["66"] --> P7["79"]',
          '    P0 -.->|"skip"| P3',
          '    P3 -.->|"skip"| P6'
        ].join('\n')
      },
      insight: 'The ranking model gets the attention and the intersection loop gets the latency. ' +
        'Before tuning a scorer, measure how much of the query budget is spent walking postings. ' +
        'It is usually most of it, and the fix is a different merge or a smaller encoding rather ' +
        'than a better model.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.InvertedIndexesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function buildIndex(values) {
    const documents = root.TextCorpus.zipfDocuments({
      count: values['ii-docs'],
      vocabulary: values['ii-vocab'],
      perDocument: 12,
      seed: values['ii-seed']
    });
    const index = root.InvertedIndex.create({ positions: true });
    index.addAll(documents);
    return index;
  }

  /** A long list and a short one at the requested skew, sharing some entries. */
  function skewedLists(shortLength, seed) {
    const rng = root.Random.seeded(seed);
    const long = [];
    for (let i = 0; i < LONG_LIST; i += 1) long.push(i * 2);

    const chosen = new Set();
    while (chosen.size < Math.min(shortLength, LONG_LIST)) chosen.add(rng.int(LONG_LIST * 2));
    return { long: long, short: Array.from(chosen).sort(function (a, b) { return a - b; }) };
  }

  function update(app) {
    const values = panel.values();
    const index = buildIndex(values);
    const encoding = index.encodingReport();

    const sizes = index.terms().map(function (term) { return { term: term, size: index.lookup(term).length }; })
      .sort(function (a, b) { return b.size - a.size; });
    const common = sizes[0];
    const rare = sizes[sizes.length - 1];

    index.resetStats();
    const hits = index.search(common.term + ' ' + rare.term, values['ii-strategy']);
    const queryComparisons = index.stats().comparisons;

    root.MetricGrid.update({
      'ii-postings': {
        value: root.Format.exact(encoding.entries),
        note: root.Format.exact(index.vocabulary()) + ' terms over ' +
          root.Format.exact(index.documents()) + ' documents'
      },
      'ii-bits': {
        value: root.Format.fixed(encoding.varbyteBitsPerPosting, 2),
        note: 'Simple-9 gets ' + root.Format.fixed(encoding.simple9BitsPerPosting, 2) +
          '; raw ids cost 32'
      },
      'ii-query': {
        value: root.Format.exact(queryComparisons),
        note: '"' + common.term + '" (' + root.Format.exact(common.size) + ') AND "' +
          rare.term + '" (' + root.Format.exact(rare.size) + ') → ' + hits.length + ' hits'
      },
      'ii-positions': {
        value: root.Format.fixed(index.positionBytes() / Math.max(1, encoding.varbyteBytes), 2) + '×',
        note: root.Format.bytes(index.positionBytes()) + ' of positions against ' +
          root.Format.bytes(encoding.varbyteBytes) + ' of postings'
      }
    });

    paintStrategies(values);
    paintEncodings(encoding);
    paintQuery(index, values, common, rare);
    draw(app, values);
  }

  function paintStrategies(values) {
    const lists = skewedLists(values['ii-skew'], values['ii-seed']);
    const reference = root.InvertedIndex.linearIntersect(lists.long, lists.short, root.InvertedIndex.newStats());

    const rows = root.InvertedIndex.STRATEGIES.map(function (strategy) {
      const stats = root.InvertedIndex.newStats();
      const result = root.InvertedIndex.intersect(lists.long, lists.short, strategy, stats);
      const current = strategy === values['ii-strategy'];

      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + strategy + '</td>' +
        '<td class="mono">' + root.Format.exact(stats.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(stats.postingsVisited) + '</td>' +
        '<td class="mono">' + root.Format.exact(stats.skipsTaken) + '</td>' +
        '<td class="mono">' + root.Format.exact(stats.probes) + '</td>' +
        '<td class="mono">' + (result.join(',') === reference.join(',') ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#ii-strategy-table tbody').html(rows);
    root.jQuery('#ii-strategy-note').text('Intersecting ' + root.Format.exact(lists.short.length) +
      ' entries with ' + root.Format.exact(lists.long.length) + ' — a skew of 1 to ' +
      root.Format.fixed(lists.long.length / Math.max(1, lists.short.length), 0) +
      '. All three return the identical result; only the cost differs, and which one wins flips as ' +
      'the skew closes.');
  }

  function paintEncodings(encoding) {
    const rows = [
      { label: 'raw 32-bit ids', bytes: encoding.rawBytes, bits: encoding.rawBitsPerPosting },
      { label: 'gaps, variable-byte', bytes: encoding.varbyteBytes, bits: encoding.varbyteBitsPerPosting },
      { label: 'gaps, Simple-9', bytes: encoding.simple9Bytes, bits: encoding.simple9BitsPerPosting }
    ].map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.bytes) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.bits, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.bytes / Math.max(1, encoding.rawBytes), 2) + '×</td></tr>';
    }).join('');

    root.jQuery('#ii-encoding-table tbody').html(rows);
    root.jQuery('#ii-encoding-note').text('The encoding is applied to gaps, not ids, and that is the ' +
      'whole trick: a dense posting list has small gaps whatever its ids are. The compression ratio ' +
      'therefore moves with the *density* of each term — a term in every document compresses far ' +
      'better than a rare one — which is why a single "bits per posting" figure is an average over ' +
      'a very wide spread.');
  }

  function paintQuery(index, values, common, rare) {
    index.resetStats();
    const booleanHits = index.search(common.term + ' ' + rare.term, values['ii-strategy']);
    const booleanCost = index.stats().comparisons;

    index.resetStats();
    const phraseHits = index.phrase(common.term + ' ' + rare.term, values['ii-strategy']);
    const phraseCost = index.stats().comparisons;

    const lines = [
      'query: ' + common.term + ' AND ' + rare.term,
      '  "' + common.term + '" appears in ' + common.size + ' documents',
      '  "' + rare.term + '" appears in ' + rare.size + ' documents',
      '  intersected shortest-first: ' + booleanHits.length + ' documents, ' + booleanCost + ' comparisons',
      '',
      'phrase: "' + common.term + ' ' + rare.term + '" (adjacent, in this order)',
      '  candidates from the boolean query: ' + booleanHits.length,
      '  surviving the position check:      ' + phraseHits.length,
      '  comparisons:                       ' + phraseCost
    ];

    root.jQuery('#ii-query-out').text(lines.join('\n'));
    root.jQuery('#ii-query-out-note').text('The phrase query is the boolean query plus a position check, ' +
      'so it can never return more documents and it always costs more. Without a positional index ' +
      'it is not answerable at all — the boolean result is the closest you can get, and it is a ' +
      'different answer rather than an approximate one.');
  }

  function draw(app, values) {
    const points = { linear: [], skip: [], galloping: [] };
    const skews = [10, 30, 100, 300, 1000, 3000, 10000, 30000, 50000];

    skews.forEach(function (shortLength) {
      const lists = skewedLists(shortLength, values['ii-seed']);
      root.InvertedIndex.STRATEGIES.forEach(function (strategy) {
        const stats = root.InvertedIndex.newStats();
        root.InvertedIndex.intersect(lists.long, lists.short, strategy, stats);
        points[strategy].push({ x: shortLength, y: Math.max(1, stats.comparisons) });
      });
    });

    chart = root.GrowthPlot.render(root.jQuery('#ii-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      logX: true,
      logY: true,
      series: [
        { label: 'linear merge', points: points.linear },
        { label: 'skip pointers', points: points.skip, dashed: true },
        { label: 'galloping', points: points.galloping, dots: true }
      ],
      xLabel: 'shorter list length (log), against 100 000',
      yLabel: 'comparisons (log)',
      legendHost: root.jQuery('#ii-legend')[0],
      summary: function () {
        return 'Intersection cost against list-length skew: galloping wins by orders of magnitude on ' +
          'the left and loses on the right.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
