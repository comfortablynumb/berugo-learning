/**
 * Section: Autocomplete and fuzzy search.
 *
 * Three back-ends answer the same query side by side, and the column that
 * matters is recall rather than speed. The BK-tree and the Levenshtein
 * automaton are exact; the n-gram index is fast and returns 30-60% of the
 * answers at distance 1, which looks exactly like a working search box until
 * someone measures it. Putting the three in one table is the only way to make
 * that visible.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'autocomplete-and-fuzzy';
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
        'A BK-tree keys each child by its edit distance to its parent, and prunes with the triangle ' +
          'inequality: if the query is distance d from a node, only children at distances d − k … ' +
          'd + k can hold an answer within budget k. That is the entire structure, and it is why ' +
          'the metric must be a real metric — swap in a similarity that violates the triangle ' +
          'inequality and the pruning drops correct answers without any error at all.',
        'A Levenshtein automaton walks the dictionary carrying the dynamic-programming row as its ' +
          'state, and cuts a subtree the moment that row\'s minimum passes the budget, because no ' +
          'descendant can bring it back down. It scales with the alphabet and the budget rather ' +
          'than with the dictionary, which is why it is the one that survives a dictionary of ' +
          'millions.',
        'An n-gram index is the fast, approximate option: index each word by its character n-grams, ' +
          'retrieve everything sharing enough of them, verify each candidate. It visits two orders ' +
          'of magnitude fewer nodes and returns a *subset* of the answers — a short word within ' +
          'distance k may share no n-grams with the query at all. That is a legitimate trade for ' +
          'a suggestion box and a bug for a lookup, and the difference is which one you were told ' +
          'you were getting.'
      ],
      demo: {
        title: 'Interactive demo — three back-ends, one query, and the recall column',
        markup: root.AutocompleteAndFuzzyTemplate.render()
      },
      diagram: {
        title: 'Diagram — pruning a BK-tree',
        caption: 'The query is distance 3 from the root; at budget 1 only the children keyed 2, 3 and 4 are visited.',
        definition: [
          'flowchart TD',
          '    R["book · d(query, book) = 3"]',
          '    R -->|1| C1["books — skipped"]',
          '    R -->|2| C2["boo — visited"]',
          '    R -->|3| C3["cake — visited"]',
          '    R -->|4| C4["cape — visited"]',
          '    R -->|6| C6["boarding — skipped"]'
        ].join('\n')
      },
      insight: 'Ask any fuzzy search what its recall is before asking what its latency is. A back-end ' +
        'that returns 60% of the matches and a back-end that returns all of them look identical ' +
        'from the outside, and the gap only ever shows up as a user saying "it did not find my ' +
        'thing" — which nobody files as a bug.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.AutocompleteAndFuzzyTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function wordsFor(values) {
    return root.TextCorpus.words().slice(0, values['af-words']);
  }

  function queryFor(values) {
    return String(values['af-query'] || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  function update(app) {
    const values = panel.values();
    const words = wordsFor(values);
    const query = queryFor(values);
    const budget = values['af-budget'];

    const comparison = root.TextLab.compareFuzzy({
      words: words,
      queries: query ? [query] : [],
      budget: budget,
      gramSize: values['af-gram']
    });

    const exact = comparison.rows.filter(function (row) { return row.exact; });
    const cheapest = exact.reduce(function (best, row) {
      return !best || row.visits < best.visits ? row : best;
    }, null);
    const ngram = comparison.rows.filter(function (row) { return row.id === 'ngram'; })[0];

    const completions = completionsFor(words, values);

    root.MetricGrid.update({
      'af-exact': {
        value: root.Format.exact(comparison.expected),
        note: query ? 'within ' + budget + ' edit' + (budget === 1 ? '' : 's') + ' of "' + query + '"'
          : 'type a query above'
      },
      'af-cheapest': {
        value: cheapest ? cheapest.label : '—',
        note: cheapest ? root.Format.exact(cheapest.visits) + ' visits over ' +
          root.Format.exact(words.length) + ' words' : 'no exact back-end agreed'
      },
      'af-recall': {
        value: ngram ? root.Format.fixed(ngram.recall, 3) : '—',
        note: ngram ? root.Format.exact(ngram.visits) + ' candidates verified, ' +
          root.Format.fixed(ngram.visits / Math.max(1, cheapest ? cheapest.visits : 1), 3) +
          '× the visits of the cheapest exact one' : ''
      },
      'af-completions': {
        value: root.Format.exact(completions.results.length),
        note: root.Format.exact(completions.pruned) + ' subtrees skipped by the stored maxima'
      }
    });

    paintTable(comparison, words);
    paintResults(words, values, query, budget);
    paintCompletions(completions, values);
    draw(app, words, values, query);
  }

  function paintTable(comparison, words) {
    const rows = comparison.rows.map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.visits) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.found) + ' of ' + root.Format.exact(comparison.expected) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.recall, 3) + '</td>' +
        '<td class="mono">' + (row.exact ? 'yes' : 'NO — returns a subset') + '</td></tr>';
    }).join('');

    root.jQuery('#af-table tbody').html(rows);
    root.jQuery('#af-table-note').text('Over ' + root.Format.exact(words.length) +
      ' words. The visits column is not comparable across back-ends — a BK-tree visit is a distance ' +
      'computation, an automaton visit is a trie node, an n-gram visit is a verification — which is ' +
      'why the recall column is the one to read first. Two of these are exact whatever the budget; ' +
      'one is not, and its recall falls as the budget rises.');
  }

  function paintResults(words, values, query, budget) {
    if (!query) {
      root.jQuery('#af-results').text('(type a query above)');
      root.jQuery('#af-results-note').text('');
      return;
    }

    const truth = root.FuzzySearch.bruteForce(words, query, budget, null);
    const bk = root.FuzzySearch.bkTree(words).search(query, budget);
    const dictionary = root.FuzzySearch.dictionaryTrie(words);
    const automaton = root.FuzzySearch.automatonSearch(dictionary.root, query, budget, null);
    const grams = root.FuzzySearch.ngramIndex(words, { size: values['af-gram'] }).search(query, budget);
    const missed = truth.filter(function (word) { return grams.indexOf(word) === -1; });

    const lines = [
      'brute force (' + truth.length + '): ' + (truth.join(', ') || '(none)'),
      'BK-tree     (' + bk.length + '): ' + (bk.join(', ') || '(none)'),
      'automaton   (' + automaton.length + '): ' + (automaton.join(', ') || '(none)'),
      'n-gram      (' + grams.length + '): ' + (grams.join(', ') || '(none)'),
      '',
      'missed by the n-gram index: ' + (missed.join(', ') || '(none)')
    ];

    root.jQuery('#af-results').text(lines.join('\n'));
    root.jQuery('#af-results-note').text(missed.length
      ? 'Those words are within ' + budget + ' edit' + (budget === 1 ? '' : 's') +
        ' and share too few ' + values['af-gram'] + '-grams with the query to be retrieved. Nothing ' +
        'in the index knows they were skipped, which is what makes this failure mode expensive.'
      : 'At this query and budget the n-gram index happened to find everything. Change the query and ' +
        'it will not — the threshold is a heuristic, not a bound.');
  }

  function completionsFor(words, values) {
    const scored = root.FuzzySearch.scoredTrie(words.map(function (word, at) {
      return { word: word, score: words.length - at };
    }));
    const prefix = String(values['af-prefix'] || '').toLowerCase().replace(/[^a-z]/g, '');
    scored.resetStats();
    const results = scored.complete(prefix, values['af-topk']);
    return { scored: scored, prefix: prefix, results: results, pruned: scored.stats().pruned };
  }

  function paintCompletions(completions, values) {
    const lines = [
      'prefix: "' + completions.prefix + '"   k = ' + values['af-topk'],
      '',
      completions.results.length
        ? completions.results.map(function (entry, at) {
          return String(at + 1).padStart(2) + '. ' + entry.word.padEnd(14) + ' score ' + entry.score;
        }).join('\n')
        : '(no completions for that prefix)',
      '',
      'nodes visited:      ' + completions.scored.stats().nodeVisits,
      'subtrees pruned:    ' + completions.pruned,
      'nodes in the trie:  ' + completions.scored.nodes()
    ];

    root.jQuery('#af-complete').text(lines.join('\n'));
    root.jQuery('#af-complete-note').text('Each node stores the best score anywhere below it, so the ' +
      'walk is a best-first search that abandons a subtree the moment its maximum cannot beat the ' +
      'current k-th answer. Without those maxima the only correct algorithm is "enumerate the whole ' +
      'subtree and sort it", which on a common prefix means enumerating most of the dictionary to ' +
      'return eight rows.');
  }

  function draw(app, words, values, query) {
    if (!query) return;
    const series = { 'bk-tree': [], automaton: [], ngram: [] };

    [0, 1, 2, 3].forEach(function (budget) {
      const comparison = root.TextLab.compareFuzzy({
        words: words,
        queries: [query],
        budget: budget,
        gramSize: values['af-gram']
      });
      comparison.rows.forEach(function (row) {
        series[row.id].push({ x: budget, y: Math.max(1, row.visits) });
      });
    });

    chart = root.GrowthPlot.render(root.jQuery('#af-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      series: [
        { label: 'BK-tree', points: series['bk-tree'] },
        { label: 'Levenshtein automaton', points: series.automaton, dashed: true },
        { label: 'n-gram index', points: series.ngram, dots: true }
      ],
      xLabel: 'edit distance allowed',
      yLabel: 'visits (log)',
      legendHost: root.jQuery('#af-legend')[0],
      summary: function () {
        return 'Visits against edit budget for "' + query + '" over ' + words.length + ' words.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
