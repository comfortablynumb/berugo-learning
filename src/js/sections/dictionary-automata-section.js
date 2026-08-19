/**
 * Section: Ternary search trees and dictionary automata.
 *
 * Two ideas that both start from "a trie wastes space", and go in opposite
 * directions. The ternary tree attacks the *node*: three pointers whatever the
 * alphabet, at the cost of a search that compares characters instead of
 * indexing them — and with a BST's sensitivity to insertion order, which the
 * demo makes impossible to miss by defaulting to the sorted-input disaster.
 *
 * The DAWG attacks the *set*: share suffixes as well as prefixes, and an
 * English word list collapses by 3.6×. The chart plots the state count as
 * words arrive, so the merging is visible as it happens rather than asserted
 * at the end.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'dictionary-automata';
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
        'A ternary search tree is a binary search tree whose comparison is on one character, with a ' +
          'third "equal" child that advances to the next one. Three pointers per node however large ' +
          'the alphabet, so no per-symbol waste and no hashing — but a search now compares ' +
          'characters instead of indexing them, and the tree inherits a BST\'s sensitivity to ' +
          'insertion order. Sorted input builds a right spine at every level: height 34 over the ' +
          'word list, against 18 for a median-order build of the same words.',
        'A DAWG goes the other way. A trie merges keys that start the same; a DAWG also merges keys ' +
          'that *end* the same, so "walking", "talking" and "running" share one copy of "ing". Over ' +
          '883 English words that is 721 states against the trie\'s 2 562, and lookup is still one ' +
          'step per character — the graph is a compressed dictionary you can query without ' +
          'decompressing.',
        'The construction is the interesting part. Keys arrive in sorted order, which guarantees a ' +
          'branch that has been left behind can never be extended, so it can be minimised ' +
          'immediately: a register maps a state\'s signature to a canonical state, and any state ' +
          'whose signature is already registered is replaced by it. Sorted input is a correctness ' +
          'requirement, not a convenience — insert out of order and a state that was already merged ' +
          'acquires a new edge, and every parent pointing at it silently gains a word nobody ' +
          'inserted.'
      ],
      demo: {
        title: 'Interactive demo — minimisation, insertion order and a fuzzy lookup',
        markup: root.DictionaryAutomataTemplate.render()
      },
      diagram: {
        title: 'Diagram — a DAWG sharing a suffix',
        caption: 'Three words, one copy of "ing". A trie would hold three.',
        definition: [
          'flowchart LR',
          '    S(("start")) -->|w| W(("w")) -->|a| WA(("wa")) -->|l| WAL(("wal"))',
          '    S -->|t| T(("t")) -->|a| TA(("ta")) -->|l| TAL(("tal"))',
          '    WAL -->|k| K(("·k"))',
          '    TAL -->|k| K',
          '    K -->|i| I(("i")) -->|n| N(("n")) -->|g| G((("accept")))'
        ].join('\n')
      },
      insight: 'The register is a hash map keyed on a state\'s signature, and the signature includes ' +
        'the *identities* of its targets. That is why minimisation has to run bottom-up and why it ' +
        'only works on sorted input: a signature is only stable once nothing below it can change.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DictionaryAutomataTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function wordsFor(values) {
    const words = root.TextCorpus.words().slice(0, values['dic-count']);
    if (values['dic-order'] !== 'shuffled') return words;
    return root.Random.seeded(values['dic-seed']).shuffle(words.slice());
  }

  function ternaryFor(values, words) {
    if (values['dic-order'] === 'balanced') return root.TernaryTrie.create({ keys: words, balanced: true });
    return root.TernaryTrie.create({ keys: words });
  }

  function update(app) {
    const values = panel.values();
    const words = wordsFor(values);
    const sorted = words.slice().sort();

    const dawg = root.Dawg.fromKeys(sorted);
    const trie = root.Trie.create({ layout: 'map' });
    sorted.forEach(trie.insert);
    const ternary = ternaryFor(values, words);

    const query = String(values['dic-neighbour'] || '').toLowerCase().replace(/[^a-z]/g, '');
    ternary.resetStats();
    const neighbours = query ? ternary.withinDistance(query, values['dic-budget']) : [];
    const visits = ternary.stats().nodeVisits;

    root.MetricGrid.update({
      'dic-nodes': {
        value: root.Format.exact(dawg.nodes()),
        note: 'the trie needs ' + root.Format.exact(trie.nodes()) + ' — ' +
          root.Format.fixed(trie.nodes() / Math.max(1, dawg.nodes()), 2) + '× as many'
      },
      'dic-merged': {
        value: root.Format.exact(dawg.stats().statesMerged),
        note: root.Format.exact(dawg.registerSize()) + ' distinct signatures in the register'
      },
      'dic-height': {
        value: root.Format.exact(ternary.height()),
        note: values['dic-order'] === 'sorted'
          ? 'sorted input: a spine at every level'
          : 'against ' + root.Format.exact(root.TernaryTrie.create({ keys: sorted }).height()) + ' for sorted input'
      },
      'dic-neighbours': {
        value: root.Format.exact(neighbours.length),
        note: root.Format.exact(visits) + ' node visits, out of ' + root.Format.exact(ternary.nodes())
      }
    });

    paintTable(sorted, values);
    paintNeighbours(query, values, neighbours, visits, ternary);
    draw(app, sorted, values);
  }

  function paintTable(words, values) {
    const families = ['trie-map', 'ternary', 'ternary-balanced', 'dawg'];
    const rows = root.TextLab.compareDictionaries({ keys: words, families: families }).map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.nodes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.bytes) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.bytesPerKey, 1) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.perLookup, 2) + '</td>' +
        '<td class="mono">' + (row.ok ? 'yes' : 'NO — ' + row.errors.join('; ')) + '</td></tr>';
    }).join('');

    root.jQuery('#dic-table tbody').html(rows);
    root.jQuery('#dic-table-note').text('The DAWG is the smallest and its lookup is the same one step ' +
      'per character as the trie, because sharing suffixes changes the graph and not the walk. The ' +
      'ternary tree is the largest here — three pointers per node is a good trade on a 256-symbol ' +
      'alphabet and a bad one on 26, which is exactly the kind of claim that has to be measured ' +
      'against your alphabet rather than repeated. Words used: ' + root.Format.exact(words.length) +
      ', order: ' + values['dic-order'] + '.');
  }

  function paintNeighbours(query, values, neighbours, visits, ternary) {
    if (!query) {
      root.jQuery('#dic-neighbour-out').text('(type a query above)');
      root.jQuery('#dic-neighbour-note').text('');
      return;
    }

    const shown = neighbours.slice(0, 40);
    const lines = [
      'query:            ' + query,
      'substitutions:    ' + values['dic-budget'] + ' (same length only)',
      'matches (' + neighbours.length + '): ' + (shown.length ? shown.join(', ') : '(none)'),
      '',
      'nodes visited:    ' + visits,
      'nodes in tree:    ' + ternary.nodes(),
      'fraction walked:  ' + (visits / Math.max(1, ternary.nodes())).toFixed(3)
    ];

    root.jQuery('#dic-neighbour-out').text(lines.join('\n'));
    root.jQuery('#dic-neighbour-note').text('The query never scans the dictionary. At each node the ' +
      'remaining budget decides which of the three children can still lead somewhere, and the other ' +
      'subtrees are skipped without a comparison. That is the query a hash table cannot answer at ' +
      'all and a plain trie can only answer by walking every branch.');
  }

  /** State count as words arrive, DAWG against trie: the merging as it
   *  happens, rather than one ratio at the end. */
  function draw(app, words, values) {
    const dawgPoints = [];
    const triePoints = [];
    const graph = root.Dawg.create({});
    const trie = root.Trie.create({ layout: 'map' });
    const every = Math.max(1, Math.floor(words.length / 60));

    words.forEach(function (word, i) {
      graph.insert(word);
      trie.insert(word);
      if (i % every === 0 || i === words.length - 1) {
        dawgPoints.push({ x: i + 1, y: graph.nodes() });
        triePoints.push({ x: i + 1, y: trie.nodes() });
      }
    });
    graph.finish();

    chart = root.GrowthPlot.render(root.jQuery('#dic-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      series: [
        { label: 'trie nodes', points: triePoints },
        { label: 'DAWG states', points: dawgPoints, dashed: true }
      ],
      xLabel: 'words inserted',
      yLabel: 'nodes / states',
      legendHost: root.jQuery('#dic-legend')[0],
      summary: function () {
        return 'Trie nodes against DAWG states over ' + values['dic-count'] +
          ' words: the gap is the shared suffixes.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
