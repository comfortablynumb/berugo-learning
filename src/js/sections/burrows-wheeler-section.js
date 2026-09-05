/**
 * Section: Burrows–Wheeler transform and the FM-index.
 *
 * Two things have to land, and the demo separates them deliberately. First the
 * transform: the rotation matrix is drawn for short inputs because that is
 * what the transform is *defined* as, and then the definition is thrown away —
 * the last column comes straight from the suffix array, and the inverse comes
 * from LF-mapping without any matrix at all.
 *
 * Then the index: backward search is shown one character at a time with the
 * range narrowing, because "counting occurrences in O(m) without
 * decompressing" is a claim that only becomes real when you watch the range
 * shrink. The checkpoint slider is the space/time dial a real FM-index
 * exposes, and it is the section's honest ending: the structure is not free,
 * it just moves the cost somewhere you can choose.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'burrows-wheeler';
  const BLOCKS = [8, 32, 128];
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
        'The transform sorts every rotation of the text and takes the last column. It looks like ' +
          'a destructive operation and it is not. The i-th occurrence of a character in the last ' +
          'column is the same occurrence as the i-th in the first column. And the first column is ' +
          'just the sorted characters. That correspondence is the LF mapping. It walks the ' +
          'original text backwards one character per step, so the transform inverts from a count ' +
          'table and a rank structure, without the matrix that defined it.',
        'It also groups equal characters, because rotations that begin the same way sort together ' +
          'and so their preceding characters land adjacently. That is why the last column runs. ' +
          'Log lines here transform into a few hundred runs where random text of the same length ' +
          'gives almost none, and run-length coding is what turns that into compression.',
        'The FM-index is the same machinery used as a search index. Backward search reads the ' +
          'pattern right to left, maintaining the suffix-array range of rows prefixed by what it ' +
          'has read. That is two rank queries per character, so counting occurrences is O(m) and ' +
          'does not depend on the text length. The index *is* the compressed text — which is how ' +
          'a read aligner searches a 3-gigabase genome in a couple of gigabytes.'
      ],
      demo: {
        title: 'Interactive demo — the transform, the inverse and backward search',
        markup: root.BurrowsWheelerTemplate.render()
      },
      diagram: {
        title: 'Diagram — the LF mapping',
        caption: 'The third "i" of the last column is the third "i" of the first column. That is the whole inverse.',
        definition: [
          'flowchart LR',
          '    L["last column<br/>i p s s m $ p i s s i i"] -->|"C[c] + rank(c, row)"| F["first column<br/>$ i i i i m p p s s s s"]',
          '    F -->|"row of the previous<br/>character"| L'
        ].join('\n')
      },
      insight: 'The rotation matrix is a definition, not an implementation — building it is O(n²) ' +
        'characters and no real implementation ever does. Sort the suffixes instead; the last column ' +
        'is the character before each suffix, which the suffix array already tells you.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BurrowsWheelerTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function suffixArrayOf(text) {
    return root.SuffixArray.build(text, { method: 'sais' }).sa;
  }

  function textFor(values) {
    const raw = String(values['bw-text'] || '').trim();
    return raw.length ? raw : 'mississippi';
  }

  function corpusFor(values) {
    const kind = values['bw-corpus'];
    if (kind === 'logs') return root.TextCorpus.logs(200, 2).join(' ');
    if (kind === 'english') return root.TextCorpus.words().join(' ').slice(0, 4000);
    if (kind === 'random') return root.TextCorpus.randomText(4000, 26, 4);
    return root.TextCorpus.dna(4000, 1);
  }

  function indexFor(text, blockSize) {
    return root.Bwt.fmIndex(text, {
      suffixArrayOf: suffixArrayOf,
      rank: 'sampled',
      blockSize: blockSize
    });
  }

  function update(app) {
    const values = panel.values();
    const text = textFor(values);
    const index = indexFor(text, values['bw-block']);
    const pattern = String(values['bw-pattern'] || '');

    index.resetStats();
    const count = pattern ? index.count(pattern) : 0;
    const steps = index.stats().rankSteps;

    const corpus = corpusFor(values);
    const corpusIndex = indexFor(corpus, values['bw-block']);

    root.MetricGrid.update({
      'bw-runs': {
        value: root.Format.exact(corpusIndex.runs()),
        note: root.Format.fixed(corpus.length / Math.max(1, corpusIndex.runs()), 1) +
          ' characters per run on the ' + values['bw-corpus'] + ' corpus'
      },
      'bw-count': {
        value: root.Format.exact(count),
        note: pattern
          ? 'brute force finds ' + root.TextCorpus.occurrences(text, pattern).length
          : 'type a pattern above'
      },
      'bw-steps': {
        value: root.Format.exact(steps),
        note: 'with a checkpoint every ' + values['bw-block'] + ' positions'
      },
      'bw-bytes': {
        value: root.Format.fixed(corpusIndex.bytesPerChar(), 2),
        note: 'a suffix array plus LCP costs 9'
      }
    });

    paintMatrix(text, index);
    paintSearch(text, index, pattern);
    paintInverse(text, index);
    paintBlocks(corpus, values);
  }

  function paintMatrix(text, index) {
    const withSentinel = text + root.Bwt.SENTINEL;
    const rotations = root.Bwt.rotations(withSentinel);

    root.MatrixView.render(root.jQuery('#bw-matrix')[0], {
      columns: ['row'].concat(withSentinel.split('').map(function (_, i) { return String(i); })),
      rows: root.MatrixView.rotationRows(rotations),
      maxRows: 32
    });

    root.jQuery('#bw-matrix-note').text('The first column is the sorted characters and the last is the ' +
      'transform: ' + root.MatrixView.display(index.last) + '. Neither column has to be built this ' +
      'way — the suffix array gives the last column directly, in O(n) rather than the O(n²) ' +
      'characters this picture costs.');
  }

  function paintSearch(text, index, pattern) {
    if (!pattern.length) {
      root.jQuery('#bw-search').html('');
      root.jQuery('#bw-search-note').text('Type a pattern to watch the range narrow.');
      return;
    }

    const rows = [];
    let first = 0;
    let last = index.last.length;

    for (let i = pattern.length - 1; i >= 0; i -= 1) {
      const symbol = pattern[i];
      const before = index.counts.before.has(symbol) ? index.counts.before.get(symbol) : null;
      if (before === null) {
        rows.push({ cells: [{ value: symbol }, { value: '—' }, { value: '—' }, { value: 0 },
          { value: 'not in the text at all' }] });
        first = 0;
        last = 0;
        break;
      }

      const nextFirst = before + rankOf(index, symbol, first);
      const nextLast = before + rankOf(index, symbol, last);
      rows.push({
        highlight: i === 0,
        cells: [
          { value: symbol },
          { value: nextFirst },
          { value: nextLast },
          { value: Math.max(0, nextLast - nextFirst) },
          { value: 'C[' + symbol + '] = ' + before }
        ]
      });
      first = nextFirst;
      last = nextLast;
      if (first >= last) break;
    }

    root.MatrixView.render(root.jQuery('#bw-search')[0], {
      columns: ['character (right to left)', 'range first', 'range last', 'rows left', 'count table'],
      rows: rows
    });

    root.jQuery('#bw-search-note').text('Each step is two rank queries and one table lookup, so the ' +
      'whole search is ' + (2 * pattern.length) + ' rank queries for a pattern of length ' +
      pattern.length + ' — and the text length never enters it. The final "rows left" is the ' +
      'occurrence count: ' + Math.max(0, last - first) + '.');
  }

  function rankOf(index, symbol, upTo) {
    let count = 0;
    for (let i = 0; i < upTo; i += 1) if (index.last[i] === symbol) count += 1;
    return count;
  }

  function paintInverse(text, index) {
    index.resetStats();
    const recovered = index.inverse();
    const stats = index.stats();

    const lines = [
      'last column:  ' + root.MatrixView.display(index.last),
      'first column: ' + root.MatrixView.display(index.firstColumn()),
      '',
      'LF steps taken:   ' + stats.lfSteps + ' (one per character)',
      'rank queries:     ' + stats.rankQueries,
      'matrix rows built: 0',
      '',
      'recovered:    ' + recovered,
      'original:     ' + text,
      'round-trip:   ' + (recovered === text ? 'exact' : 'BROKEN')
    ];

    root.jQuery('#bw-inverse').text(lines.join('\n'));
    root.jQuery('#bw-inverse-note').text('The inverse never materialises a rotation. It starts at row ' +
      '0 — the sentinel\'s rotation, so its last character is the text\'s last character — and ' +
      'follows LF backwards. One step per character, and the only structures it reads are the count ' +
      'table and the rank checkpoints.');
  }

  function paintBlocks(corpus, values) {
    /* The probe has to come from the corpus: a pattern that does not occur
       makes every row read zero and the comparison say nothing. */
    const probe = corpus.substr(Math.floor(corpus.length / 3), 4);
    const truth = indexFor(corpus, 32).count(probe);

    const rows = BLOCKS.map(function (blockSize) {
      const index = indexFor(corpus, blockSize);
      index.resetStats();
      const count = index.count(probe);
      const current = blockSize === values['bw-block'];

      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + blockSize + '</td>' +
        '<td class="mono">' + root.Format.exact(index.rankBytes) + '</td>' +
        '<td class="mono">' + root.Format.fixed(index.bytesPerChar(), 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(index.stats().rankSteps) + '</td>' +
        '<td class="mono">' + (count === truth ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#bw-block-table tbody').html(rows);
    root.jQuery('#bw-block-note').text('Counting "' + root.MatrixView.display(probe) + '" (' +
      truth + ' occurrences) over ' + root.Format.exact(corpus.length) +
      ' characters. A checkpoint every 8 positions makes rank almost free and the index large; every ' +
      '128 makes the index small and every rank query a short scan. Neither is more correct — the ' +
      'answer column is identical — which is exactly what a space/time dial should look like.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
