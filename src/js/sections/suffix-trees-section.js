/**
 * Section: Suffix trees.
 *
 * The demo steps Ukkonen's construction one phase at a time and shows the
 * three numbers that *are* the algorithm — active node, active length,
 * remainder — because a suffix tree drawn only at the end teaches the data
 * structure and hides the construction, and the construction is the hard part.
 *
 * The size table is the honest ending: the tree answers everything in O(m) and
 * costs four to five times what a suffix array costs for the same answers.
 * That ratio, not the asymptotics, is why the field moved.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'suffix-trees';
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
        'A suffix trie holds every suffix of a text, so it answers "does P occur" in O(|P|) whatever ' +
          'the text length — and costs n(n+1)/2 nodes, which for 2 000 characters is two million. ' +
          'Compressing every non-branching chain into one edge brings that to under 2n nodes, and a ' +
          'unique terminator makes every suffix end at its own leaf so nothing is hidden inside an ' +
          'edge.',
        'Ukkonen builds it online, left to right, in linear time, out of three ideas that only work ' +
          'together. Leaves carry an open end index, so extending the text extends every leaf for ' +
          'free. The active point remembers where the last insertion happened so the next one does ' +
          'not restart at the root. Suffix links connect a point in suffix i to the same point in ' +
          'suffix i + 1, so the walk down is never repeated.',
        'The remainder is the counter to watch. Each phase adds a character and owes one more ' +
          'suffix; rule 2 splits an edge and pays one back, rule 3 finds the character already ' +
          'present and ends the phase with the debt still outstanding. A tree with a positive ' +
          'remainder is *implicit* — some suffix has no leaf yet — which is exactly what the ' +
          'terminator fixes at the end.'
      ],
      demo: {
        title: 'Interactive demo — Ukkonen, phase by phase',
        markup: root.SuffixTreesTemplate.render()
      },
      diagram: {
        title: 'Diagram — the suffix tree for banana$',
        caption: 'Six suffixes plus the terminator, seven leaves. The dashed arrows are suffix links.',
        definition: [
          'flowchart TD',
          '    R(("root"))',
          '    R -->|"$"| L1["$"]',
          '    R -->|"a"| A(("a"))',
          '    R -->|"banana$"| L2["banana$"]',
          '    R -->|"na"| N(("na"))',
          '    A -->|"$"| L3["a$"]',
          '    A -->|"na"| AN(("ana"))',
          '    AN -->|"$"| L4["ana$"]',
          '    AN -->|"na$"| L5["anana$"]',
          '    N -->|"$"| L6["na$"]',
          '    N -->|"na$"| L7["nana$"]',
          '    AN -.->|"suffix link"| N',
          '    N -.->|"suffix link"| R'
        ].join('\n')
      },
      insight: 'Every question a suffix tree answers, a suffix array plus an LCP array answers too, ' +
        'in a fifth of the memory. Build a suffix tree when you need the *tree* — the suffix links, ' +
        'the internal nodes as equivalence classes — and a suffix array when you need the answers.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SuffixTreesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function textFor(values) {
    const raw = String(values['st-text'] || '').replace(/[$]/g, '');
    return raw.length ? raw : 'banana';
  }

  function corpusFor(values) {
    if (values['st-corpus'] === 'english') return root.TextCorpus.words().join(' ').slice(0, 2000);
    if (values['st-corpus'] === 'repeat') return root.TextCorpus.repeated('a', 2000);
    return root.TextCorpus.dna(2000, 1);
  }

  function update(app) {
    const values = panel.values();
    const text = textFor(values);
    const phase = Math.min(values['st-phase'], text.length);
    const partial = text.slice(0, phase);

    const full = root.SuffixTree.build(text, { trace: true });
    const shown = root.SuffixTree.build(partial, { trace: true });
    const pattern = String(values['st-pattern'] || '');

    const trieNodes = text.length * (text.length + 1) / 2;

    root.MetricGrid.update({
      'st-nodes': {
        value: root.Format.exact(full.nodes()),
        note: 'the uncompressed suffix trie would hold ' + root.Format.exact(trieNodes) +
          ' — ' + root.Format.fixed(trieNodes / Math.max(1, full.nodes()), 1) + '× as many'
      },
      'st-bytes': {
        value: root.Format.fixed(full.bytesPerChar(), 1),
        note: root.Format.fixed(full.nodes() / Math.max(1, text.length), 2) + ' nodes per character'
      },
      'st-occurrences': {
        value: root.Format.exact(full.countOccurrences(pattern)),
        note: pattern ? '"' + pattern + '" in "' + text + '"' : 'type a pattern above'
      },
      'st-repeated': {
        value: full.longestRepeated() || '(none)',
        note: 'the deepest internal node, found without comparing anything'
      }
    });

    paintTrace(shown, partial);
    paintSizes(values);
    draw(app, shown, partial, pattern);
  }

  function paintTrace(tree, partial) {
    const rows = tree.trace.map(function (step, at) {
      return {
        highlight: at === tree.trace.length - 1,
        cells: [
          { value: step.phase },
          { value: step.added },
          { value: step.remainder },
          { value: step.activeNode },
          { value: step.activeLength },
          { value: step.nodes }
        ]
      };
    });

    root.MatrixView.render(root.jQuery('#st-trace')[0], {
      columns: ['phase', 'added', 'remainder', 'active node', 'active length', 'nodes'],
      rows: rows,
      maxRows: 45
    });

    const owed = tree.trace.length ? tree.trace[tree.trace.length - 1].remainder : 0;
    root.jQuery('#st-trace-note').text('After ' + partial.length + ' characters the tree holds ' +
      tree.nodes() + ' nodes and owes ' + owed + ' suffix' + (owed === 1 ? '' : 'es') + '. ' +
      (owed > 0
        ? 'A positive remainder means the tree is implicit: those suffixes end inside an edge and have no leaf yet.'
        : 'A remainder of zero means every suffix ends at a leaf — which the terminator guarantees at the end.'));
  }

  function paintSizes(values) {
    const corpus = corpusFor(values);
    const comparison = root.TextLab.compareSubstringIndexes({ text: corpus, probes: 60, seed: 6 });

    const rows = comparison.rows.map(function (row) {
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.units) + ' ' + row.unitLabel + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.units / corpus.length, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.bytesPerChar, 1) + '</td>' +
        '<td class="mono">' + (row.ok ? 'hold' : 'BROKEN') + '</td></tr>';
    }).join('');

    root.jQuery('#st-size-table tbody').html(rows);
    root.jQuery('#st-size-note').text('All four answered the same ' + comparison.patterns +
      ' membership questions identically' + (comparison.agree ? '' : ' — except they did not, which is a bug') +
      '. They differ only in size, and the tree is the largest of them by a factor of four to five. ' +
      'Kurtz\'s engineered implementation reaches about 20 bytes per character; this straightforward ' +
      'one lands near 40, and that gap is the whole reason suffix arrays took over.');
  }

  function draw(app, tree, partial, pattern) {
    const snapshot = root.TextLab.snapshot(tree.root(), {
      limit: 60,
      labelOf: function (child) { return tree.labelOf(child); }
    });

    const prefixes = [];
    for (let i = 1; i <= pattern.length; i += 1) prefixes.push(pattern.slice(0, i));

    chart = root.TrieView.render(root.jQuery('#st-chart')[0], {
      lazyLib: app.lazyLib,
      height: 300,
      snapshot: snapshot,
      highlight: prefixes,
      summary: function () {
        return 'The suffix tree for "' + partial + '" after ' + partial.length + ' phases.';
      }
    });

    root.jQuery('#st-chart-note').text('Edges carry substrings; leaves are suffixes. The tree shown ' +
      'is for the first ' + partial.length + ' characters, so it is the state Ukkonen has reached at ' +
      'that phase rather than the finished tree.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
