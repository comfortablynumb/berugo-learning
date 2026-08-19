/**
 * Section: Suffix arrays and LCP.
 *
 * The array table is the demo's centre: ranks, LCP values and the suffixes
 * themselves side by side, with the pattern's matching range highlighted. Once
 * the LCP column is visible next to the suffixes it stops being a column of
 * numbers and becomes obviously what it is.
 *
 * The three constructions run on the same input so the cost columns can be
 * compared, and the naive one is kept precisely because it is the reference
 * the other two are checked against — a construction that is fast and wrong is
 * the failure mode here, and only a cross-check catches it.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'suffix-arrays';
  const METHODS = ['naive', 'doubling', 'sais'];
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A suffix array is the list of suffix start positions in sorted order — one integer per ' +
          'character, against a suffix tree\'s node with four fields. Searching for a pattern is a ' +
          'binary search over that list, O(m log n), and the answer is a contiguous range: every ' +
          'suffix beginning with the pattern sorts together, which is the whole reason the ' +
          'structure works.',
        'The LCP array is what makes it as powerful as the tree. lcp[i] is how many characters ' +
          'suffix sa[i] shares with sa[i−1], and Kasai computes the whole array in O(n) by walking ' +
          'the suffixes in *text* order rather than array order: dropping the leading character of a ' +
          'suffix can shorten its overlap with its neighbour by at most one, so the counter falls by ' +
          'at most one per step and can only rise n times overall.',
        'Construction is where the engineering is. Sorting the suffixes as strings is O(n² log n) ' +
          'because each comparison is O(n). Prefix doubling sorts by the first character, then uses ' +
          'the resulting ranks to sort by the first 2, 4, 8 … characters — log n rounds, each a ' +
          'sort of integer pairs. SA-IS classifies each position as S or L, places the LMS ' +
          'substrings by induced sorting and recurses on the reduced string, and is linear. All ' +
          'three must produce the identical array, including on a one-letter alphabet.'
      ],
      demo: {
        title: 'Interactive demo — the array, the LCPs and the doubling rounds',
        markup: root.SuffixArraysTemplate.render()
      },
      diagram: {
        title: 'Diagram — the suffix array of banana',
        caption: 'Sorted suffixes, their start positions, and the overlap with the row above.',
        definition: [
          'flowchart LR',
          '    R0["rank 0 · start 5 · lcp 0 · a"]',
          '    R1["rank 1 · start 3 · lcp 1 · ana"]',
          '    R2["rank 2 · start 1 · lcp 3 · anana"]',
          '    R3["rank 3 · start 0 · lcp 0 · banana"]',
          '    R4["rank 4 · start 4 · lcp 0 · na"]',
          '    R5["rank 5 · start 2 · lcp 2 · nana"]',
          '    R0 --> R1 --> R2 --> R3 --> R4 --> R5'
        ].join('\n')
      },
      insight: 'Suffix array plus LCP answers everything a suffix tree does at 9 bytes per character ' +
        'instead of 40. When someone says "we need a suffix tree", the question to ask is which ' +
        'answer they need — because it is almost always one the array gives.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SuffixArraysTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function textFor(values) {
    const raw = String(values['sa-text'] || '').trim();
    return raw.length ? raw : 'mississippi';
  }

  function corpusFor(values) {
    if (values['sa-corpus'] === 'english') return root.TextCorpus.words().join(' ').slice(0, 4000);
    if (values['sa-corpus'] === 'repeat') return root.TextCorpus.repeated('a', 4000);
    if (values['sa-corpus'] === 'binary') return root.TextCorpus.randomText(4000, 2, 4);
    return root.TextCorpus.dna(4000, 1);
  }

  function update(app) {
    const values = panel.values();
    const text = textFor(values);
    const built = root.SuffixArray.build(text, { method: values['sa-method'], trace: true });
    const pattern = String(values['sa-pattern'] || '');
    const range = pattern ? built.rangeOf(pattern) : { first: 0, last: 0, count: 0 };

    root.MetricGrid.update({
      'sa-rounds': {
        value: root.Format.exact(built.stats().rounds || 0),
        note: 'ceil(log2 ' + text.length + ') = ' + Math.ceil(Math.log2(Math.max(2, text.length))) +
          (values['sa-method'] === 'doubling' ? '' : ' — this method does not double')
      },
      'sa-distinct': {
        value: root.Format.exact(built.distinctSubstrings()),
        note: text.length + '·' + (text.length + 1) + '/2 = ' +
          root.Format.exact(text.length * (text.length + 1) / 2) + ', less Σ lcp = ' +
          root.Format.exact(built.lcp.reduce(function (a, b) { return a + b; }, 0))
      },
      'sa-occurrences': {
        value: root.Format.exact(range.count),
        note: range.count ? 'ranks ' + range.first + '…' + (range.last - 1) + ', one contiguous range'
          : (pattern ? '"' + pattern + '" does not occur' : 'type a pattern above')
      },
      'sa-repeated': {
        value: built.longestRepeated() || '(none)',
        note: 'the largest LCP entry, which is ' + Math.max.apply(null, built.lcp.concat([0]))
      }
    });

    paintArray(built, text, range, pattern);
    paintRounds(values, text);
    paintMethods(values);
  }

  function paintArray(built, text, range, pattern) {
    const rows = root.MatrixView.suffixRows({ text: text, sa: built.sa, lcp: built.lcp, width: 26 })
      .map(function (row, rank) {
        const inRange = rank >= range.first && rank < range.last;
        return { highlight: inRange, cells: row.cells };
      });

    root.MatrixView.render(root.jQuery('#sa-table')[0], {
      columns: ['rank', 'start', 'lcp', 'suffix'],
      rows: rows,
      maxRows: 42
    });

    root.jQuery('#sa-table-note').text(pattern
      ? 'Every suffix beginning with "' + pattern + '" sorts together, so the answer is the ' +
        'highlighted range — ' + range.count + ' of ' + text.length +
        ' suffixes — found by two binary searches rather than by a scan.'
      : 'The LCP column is the overlap with the row above. Reading it down the table is reading the ' +
        'repeated structure of the text.');
  }

  function paintRounds(values, text) {
    if (values['sa-method'] !== 'doubling') {
      root.jQuery('#sa-rounds-table').html('');
      root.jQuery('#sa-rounds-table-note').text('The rank table is what prefix doubling *is*, so it is only ' +
        'shown for that construction. SA-IS has no rounds — it recurses on a reduced string — and ' +
        'the naive sort has no intermediate state at all.');
      return;
    }

    const built = root.SuffixArray.build(text, { method: 'doubling', trace: true });
    const rows = built.trace.map(function (round) {
      return {
        cells: [{ value: 'sorted by ' + round.step }].concat(
          round.order.map(function (start) { return { value: start }; })
        )
      };
    });

    root.MatrixView.render(root.jQuery('#sa-rounds-table')[0], {
      columns: ['round'].concat(built.sa.map(function (_, i) { return String(i); })),
      rows: rows,
      maxRows: 14
    });

    root.jQuery('#sa-rounds-table-note').text('Each row is the suffix order after sorting by that many ' +
      'leading characters. The order stops changing once every rank is distinct, which is why the ' +
      'loop can exit early rather than always running log n times — it took ' +
      built.trace.length + ' round' + (built.trace.length === 1 ? '' : 's') + ' here.');
  }

  function paintMethods(values) {
    const corpus = corpusFor(values);
    const reference = root.SuffixArray.build(corpus, { method: 'sais' }).sa.join(',');

    const rows = METHODS.map(function (method) {
      const built = root.SuffixArray.build(corpus, { method: method });
      const stats = built.stats();
      const same = built.sa.join(',') === reference;
      const current = method === values['sa-method'];

      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + method + '</td>' +
        '<td class="mono">' + root.Format.exact(stats.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(stats.charComparisons) + '</td>' +
        '<td class="mono">' + root.Format.exact(method === 'sais' ? stats.recursions : stats.rounds) + '</td>' +
        '<td class="mono">' + (same ? 'yes' : 'NO — this construction is wrong') + '</td></tr>';
    }).join('');

    root.jQuery('#sa-methods tbody').html(rows);
    root.jQuery('#sa-methods-note').text('Over ' + root.Format.exact(corpus.length) +
      ' characters. The naive sort\'s comparison count looks competitive until you read the next ' +
      'column: each of its comparisons walks characters, and on repetitive input it walks a lot of ' +
      'them. SA-IS does no character comparisons at all after the first pass — it sorts by induction ' +
      'rather than by comparing — which is what buys the linear bound.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
