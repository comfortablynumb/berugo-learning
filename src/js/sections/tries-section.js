/**
 * Section: Tries.
 *
 * The demo is built to kill the usual claim that a trie is a faster hash
 * table. It is not: an 883-word trie costs 93 bytes per key with map nodes
 * against a hash table's ~40, and a lookup walks one node per character where a
 * hash table hashes once. What the trie answers that the hash table cannot is
 * the search box: every completion of a prefix, in order, in time proportional
 * to the answer.
 *
 * The layout selector is the second half. The structure does not change; only
 * the per-node child storage does, and the memory moves by a factor of nine.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'tries';
  const LAYOUTS = ['map', 'array', 'sorted'];
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
        'A trie stores a key one character per edge, so every key that starts the same way shares ' +
          'the same nodes. Lookup is one step per character and never compares whole keys, which ' +
          'means the cost is the length of the query rather than the size of the dictionary. A ' +
          'node is a key when it carries a terminal marker — not when it is a leaf, because "an" ' +
          'and "ant" both have to be storable.',
        'It is not a faster hash table. Over an 883-word list the map-node trie holds 2 562 nodes ' +
          'at 93 bytes per key. A lookup takes five character steps where a hash table takes one ' +
          'hash and one probe. What the trie buys is the query a hash table cannot answer at ' +
          'all: every key under a prefix, in sorted order, in time proportional to the answer.',
        'The child storage is a real decision and the demo makes it visible. A 26-slot array per ' +
          'node is one index per step and 650 bytes per key; a sorted child array is a binary ' +
          'search per step and 73. On a 4-letter DNA alphabet in a 256-slot array, 98% of the ' +
          'slots are empty. That is where the "tries waste memory" reputation comes from, and it ' +
          'is a property of one layout rather than of the structure.'
      ],
      demo: { title: 'Interactive demo — the search box, and what a node costs', markup: root.TriesTemplate.render() },
      diagram: {
        title: 'Diagram — a trie over five words',
        caption: 'Double circles are terminal markers. "can" is a key and also a prefix of "candle".',
        definition: [
          'flowchart TD',
          '    R(("·")) -->|c| C(("c"))',
          '    C -->|a| CA(("ca"))',
          '    CA -->|n| CAN((("can")))',
          '    CAN -->|d| CAND(("cand"))',
          '    CAND -->|l| CANDL(("candl"))',
          '    CANDL -->|e| CANDLE((("candle")))',
          '    CA -->|r| CAR((("car")))',
          '    CAR -->|t| CART((("cart")))',
          '    R -->|d| D(("d"))',
          '    D -->|o| DO((("do")))'
        ].join('\n')
      },
      insight: 'Reach for a trie when the question is a prefix or an ordered range, not when the ' +
        'question is "is this key present". A hash table wins the membership test on every axis, ' +
        'and loses completely the moment the product asks for autocomplete.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.TriesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function keysFor(values) {
    return root.TextCorpus.words().slice(0, values['tr-keys']);
  }

  function buildTrie(values, layout) {
    const trie = root.Trie.create({ layout: layout || values['tr-layout'] });
    keysFor(values).forEach(trie.insert);
    return trie;
  }

  function update(app) {
    const values = panel.values();
    const keys = keysFor(values);
    const trie = buildTrie(values);
    const query = String(values['tr-query'] || '').toLowerCase().replace(/[^a-z]/g, '');

    const misses = root.TextLab.missesFor(keys, Math.max(1, Math.floor(keys.length / 4)), 4);
    trie.resetStats();
    keys.forEach(trie.has);
    misses.forEach(trie.has);
    const steps = trie.stats().charSteps / (keys.length + misses.length);

    const completions = query ? trie.withPrefix(query) : keys.slice();

    root.MetricGrid.update({
      'tr-nodes': {
        value: root.Format.exact(trie.nodes()),
        note: root.Format.fixed(trie.nodes() / Math.max(1, keys.length), 2) + ' per key, ' +
          root.Format.fixed(trie.nodes() / Math.max(1, totalCharacters(keys)), 2) + ' per character'
      },
      'tr-bytes': {
        value: root.Format.fixed(trie.bytes() / Math.max(1, keys.length), 1),
        note: root.Format.bytes(trie.bytes()) + ' for ' + root.Format.exact(keys.length) + ' keys'
      },
      'tr-completions': {
        value: root.Format.exact(completions.length),
        note: query ? 'under "' + query + '"' : 'the whole dictionary — no prefix typed'
      },
      'tr-lookup': {
        value: root.Format.fixed(steps, 2),
        note: 'a hash table would hash once and probe once'
      }
    });

    paintAnswers(trie, query, completions, keys);
    paintLayouts(values, keys);
    draw(app, trie, values, query);
  }

  function totalCharacters(keys) {
    return keys.reduce(function (total, key) { return total + key.length; }, 0);
  }

  function paintAnswers(trie, query, completions, keys) {
    const path = trie.pathFor(query);
    const walked = path.path.map(function (step) { return step.symbol || '·'; }).join(' → ');
    const shown = completions.slice(0, 24);

    const lines = [
      'prefix walk:      ' + (walked || '·') +
        (path.complete ? '' : '  ← the walk fell off the trie'),
      'is a key itself:  ' + (path.found ? 'yes' : 'no'),
      'longest key that prefixes it: ' + (trie.longestPrefixOf(query) || '(none)'),
      '',
      'completions (' + completions.length + '):',
      shown.length ? shown.join(', ') + (completions.length > shown.length ? ', …' : '') : '(none)'
    ];

    root.jQuery('#tr-answers').text(lines.join('\n'));
    root.jQuery('#tr-answers-note').text('The completion list costs one walk to the prefix node plus ' +
      'one visit per answer. A hash table would have to test all ' + root.Format.exact(keys.length) +
      ' keys, because hashing destroys exactly the ordering this query needs.');
  }

  function paintLayouts(values, keys) {
    const hashBytes = keys.length * 40;
    const rows = LAYOUTS.map(function (layout) {
      const trie = buildTrie(values, layout);
      const current = layout === values['tr-layout'];
      return '<tr' + (current ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + layout + '</td>' +
        '<td class="mono">' + root.Format.exact(trie.nodes()) + '</td>' +
        '<td class="mono">' + root.Format.exact(trie.bytes()) + '</td>' +
        '<td class="mono">' + root.Format.fixed(trie.bytes() / Math.max(1, keys.length), 1) + '</td>' +
        '<td class="mono">' + root.Format.fixed(trie.bytes() / hashBytes, 2) + '×</td></tr>';
    }).join('');

    root.jQuery('#tr-layout-table tbody').html(rows);
    root.jQuery('#tr-layout-note').text('The node count is identical in all three — the structure has ' +
      'not changed. Only the per-node child storage has, and it moves the memory by a factor of nine. ' +
      'The hash-table column assumes 40 bytes per entry, which is roughly what an open-addressing ' +
      'table costs at a sane load factor.');
  }

  function draw(app, trie, values, query) {
    const snapshot = root.TextLab.snapshot(trie.root(), {
      limit: values['tr-draw'],
      childrenOf: trie.childrenOf,
      labelOf: function (child, symbol) { return symbol; }
    });

    const prefixes = [];
    for (let i = 0; i <= query.length; i += 1) prefixes.push(query.slice(0, i));

    chart = root.TrieView.render(root.jQuery('#tr-chart')[0], {
      lazyLib: app.lazyLib,
      height: 300,
      snapshot: snapshot,
      highlight: prefixes,
      summary: function () {
        return 'A trie over ' + values['tr-keys'] + ' words, ' + values['tr-draw'] +
          ' nodes drawn, with the path for "' + query + '" highlighted.';
      }
    });

    root.jQuery('#tr-chart-note').text('Green nodes are keys. The drawing stops at ' +
      values['tr-draw'] + ' of ' + root.Format.exact(trie.nodes()) +
      ' nodes — a picture of the whole trie is a picture of nothing.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
