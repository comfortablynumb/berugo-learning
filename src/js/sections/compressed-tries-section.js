/**
 * Section: Compressed tries — radix and PATRICIA.
 *
 * The demo's job is to show that path compression is worth a factor that
 * *depends on the key set*, not a constant. On 400 English words the radix trie
 * halves the node count; on 400 filesystem-style paths it removes 90% of them,
 * and on 32-character hex keys 96%. What it removes is the non-branching chain
 * after the keys diverge - a shared prefix is something a plain trie already
 * handles, which is the confusion this section exists to clear up.
 *
 * The ART node sizes are the second half, and they are the case where the
 * memory column goes the *wrong* way on a small key set — a node4 allocates
 * four slots whether it uses one or four — which is worth showing rather than
 * hiding.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'compressed-tries';

  const ROUTES = [
    { cidr: '0.0.0.0/0', via: 'default gateway' },
    { cidr: '10.0.0.0/8', via: 'core router' },
    { cidr: '10.1.0.0/16', via: 'edge switch' },
    { cidr: '10.1.2.0/24', via: 'rack top-of-rack' },
    { cidr: '192.168.0.0/16', via: 'lab network' }
  ];

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
        'A radix trie keeps a node only where the key set branches or ends, and puts the characters ' +
          'in between on the edge. The node count stops being "one per character" and becomes ' +
          '"one per branch", which is bounded by 2k − 1 for k keys however long the keys are. The ' +
          'saving is therefore a property of the keys: on 400 English words it is 2.1×, and on 400 ' +
          'filesystem-style paths — long, and distinct only near the end — it is 10×.',
        'Insertion has three cases and only the third is interesting. When the incoming key and an ' +
          'existing edge agree for a while and then differ, the edge splits: an internal node ' +
          'appears at the divergence point and the old child hangs below it. The case that gets ' +
          'written wrong is the one where the new key *ends* exactly at the split point — the new ' +
          'internal node is itself a key, and forgetting that loses it silently.',
        'PATRICIA is the same structure over the alphabet {0, 1}, which is what makes it a routing ' +
          'table: an IPv4 prefix is a bit string, and "which route applies" is longest-prefix ' +
          'match, one downward walk. Adaptive radix trees add the last piece — a node stores its ' +
          'children in a layout chosen by fan-out, so the small nodes, which are almost all of ' +
          'them, stay small. That is what makes ART competitive with a hash table in a ' +
          'main-memory database.'
      ],
      demo: {
        title: 'Interactive demo — compression, node sizes and a route',
        markup: root.CompressedTriesTemplate.render()
      },
      diagram: {
        title: 'Diagram — an edge splitting on insert',
        caption: 'Inserting "romulus" into a trie holding "romane" splits the edge "roman" at "rom".',
        definition: [
          'flowchart TD',
          '    subgraph before["before"]',
          '        B0(("·")) -->|"roman"| B1((("romane")))',
          '    end',
          '    subgraph after["after"]',
          '        A0(("·")) -->|"rom"| A1(("rom"))',
          '        A1 -->|"ane"| A2((("romane")))',
          '        A1 -->|"ulus"| A3((("romulus")))',
          '    end'
        ].join('\n')
      },
      insight: 'A shared *prefix* is not what a radix trie saves — a plain trie already shares those. ' +
        'What it removes is the non-branching chain after the keys diverge, so the saving tracks the ' +
        'length of the distinct tails. Measure that before reaching for one: on short, densely ' +
        'branching keys it saves little and costs you edge-splitting code that is easy to get wrong.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.CompressedTriesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function keysFor(values) {
    const count = values['ct-count'];
    if (values['ct-keys'] === 'hashes') return root.TextCorpus.hexKeys(count, 32, 9);
    if (values['ct-keys'] === 'paths') {
      const words = root.TextCorpus.words();
      const out = [];
      for (let i = 0; i < count; i += 1) {
        out.push('/usr/local/share/' + words[i % words.length] + '/' + words[(i * 7) % words.length] + '.conf');
      }
      return Array.from(new Set(out));
    }
    return root.TextCorpus.words().slice(0, count);
  }

  function alphabetFor(keys) {
    return root.TextCorpus.alphabetOf(keys.join('')).join('');
  }

  function buildBoth(values) {
    const keys = keysFor(values);
    const plain = root.Trie.create({ layout: 'map', alphabet: alphabetFor(keys) });
    keys.forEach(plain.insert);

    const radix = root.RadixTrie.create({ adaptive: values['ct-adaptive'] });
    keys.forEach(radix.insert);

    return { keys: keys, plain: plain, radix: radix };
  }

  function lookupCost(structure, keys) {
    structure.resetStats();
    keys.forEach(structure.has);
    const stats = structure.stats();
    return stats.charSteps / Math.max(1, keys.length);
  }

  function update(app) {
    const values = panel.values();
    const built = buildBoth(values);
    const table = root.RadixTrie.routingTable(ROUTES);
    const route = table.lookup(String(values['ct-address'] || '').trim());

    root.MetricGrid.update({
      'ct-nodes': {
        value: root.Format.exact(built.radix.nodes()),
        note: 'the plain trie needs ' + root.Format.exact(built.plain.nodes()) + ' — ' +
          root.Format.fixed(built.plain.nodes() / Math.max(1, built.radix.nodes()), 2) + '× as many'
      },
      'ct-bytes': {
        value: root.Format.fixed(built.radix.bytes() / Math.max(1, built.keys.length), 1),
        note: 'the plain trie costs ' +
          root.Format.fixed(built.plain.bytes() / Math.max(1, built.keys.length), 1) +
          (values['ct-adaptive'] ? ' — ART over-allocates on small nodes' : '')
      },
      'ct-splits': {
        value: root.Format.exact(built.radix.stats().splits),
        note: 'out of ' + root.Format.exact(built.keys.length) + ' insertions'
      },
      'ct-route': {
        value: route ? route.via : 'no route',
        note: route ? '/' + route.length + ' matched, out of ' + table.size() + ' prefixes' : 'not even a default'
      }
    });

    paintTable(built);
    paintRoutes(table, values);
    paintClasses(built, values);
    draw(app, built, values);
  }

  function paintTable(built) {
    const rows = [
      { label: 'plain trie', structure: built.plain },
      { label: 'radix trie', structure: built.radix }
    ].map(function (row) {
      const cost = lookupCost(row.structure, built.keys);
      return '<tr><td class="mono">' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.structure.nodes()) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.structure.nodes() / Math.max(1, built.keys.length), 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.structure.bytes()) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.structure.bytes() / Math.max(1, built.keys.length), 1) + '</td>' +
        '<td class="mono">' + root.Format.fixed(cost, 2) + '</td></tr>';
    }).join('');

    root.jQuery('#ct-table tbody').html(rows);

    const characters = built.keys.reduce(function (total, key) { return total + key.length; }, 0);
    root.jQuery('#ct-table-note').text('The keys hold ' + root.Format.exact(characters) +
      ' characters between them and share ' +
      root.Format.fixed(1 - built.plain.nodes() / Math.max(1, characters), 2) +
      ' of them by prefix. The radix trie removes the chains that sharing leaves behind — and its ' +
      'lookup does more character comparisons per key, because comparing an edge label is a ' +
      'substring compare rather than a single step.');
  }

  function paintRoutes(table, values) {
    const address = String(values['ct-address'] || '').trim();
    let bits = '';
    try { bits = root.RadixTrie.ipToBits(address); } catch (error) { bits = ''; }
    const match = table.lookup(address);

    const rows = ROUTES.map(function (route) {
      const prefix = root.RadixTrie.prefixToBits(route.cidr);
      const applies = bits.slice(0, prefix.length) === prefix;
      const chosen = match && match.bits === prefix;
      return '<tr' + (chosen ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + route.cidr + '</td>' +
        '<td class="mono">' + (prefix || '(empty — matches everything)') + '</td>' +
        '<td class="mono">' + prefix.length + '</td>' +
        '<td class="mono">' + route.via + '</td>' +
        '<td class="mono">' + (applies ? (chosen ? 'yes — longest' : 'yes') : 'no') + '</td></tr>';
    }).join('');

    root.jQuery('#ct-route-table tbody').html(rows);
    root.jQuery('#ct-route-table-note').text(bits
      ? address + ' is ' + bits + ' in binary. Several prefixes match; the router takes the longest, ' +
        'which is one walk down the bit trie rather than a scan of the table.'
      : 'That is not a dotted-quad address, so there is nothing to route.');
  }

  function paintClasses(built, values) {
    if (!values['ct-adaptive']) {
      root.jQuery('#ct-classes').text('Adaptive node sizes are off: every node holds a map, whatever ' +
        'its fan-out.\nTurn them on to see where the nodes actually land.');
      root.jQuery('#ct-classes-note').text('A map per node is what a JavaScript implementation writes. ' +
        'ART exists because in a compiled language that indirection is the whole cost.');
      return;
    }

    const classes = built.radix.nodeClasses();
    const total = Object.keys(classes).reduce(function (sum, key) { return sum + classes[key]; }, 0);
    const lines = root.RadixTrie.ADAPTIVE_CLASSES.map(function (klass) {
      const count = classes[klass.name] || 0;
      const share = total ? (100 * count / total) : 0;
      return klass.name.padEnd(9) + ' up to ' + String(klass.upTo).padStart(3) + ' children: ' +
        String(count).padStart(6) + '  (' + share.toFixed(1) + '%)';
    });

    root.jQuery('#ct-classes').text(lines.join('\n'));
    root.jQuery('#ct-classes-note').text('Nearly every node is a node4. That is the observation ART ' +
      'is built on: fan-out is not uniform, so sizing every node for the maximum wastes almost all ' +
      'of the memory. It is also why the bytes-per-key column above can go up on a small key set — ' +
      'a node4 allocates four slots whether it uses one or four.');
  }

  function draw(app, built, values) {
    const snapshot = root.TextLab.snapshot(built.radix.root(), {
      limit: 90,
      labelOf: function (child) { return child.label; }
    });

    chart = root.TrieView.render(root.jQuery('#ct-chart')[0], {
      lazyLib: app.lazyLib,
      height: 300,
      snapshot: snapshot,
      summary: function () {
        return 'A radix trie over ' + built.keys.length + ' keys, ' + built.radix.nodes() +
          ' nodes against the plain trie\'s ' + built.plain.nodes() + '.';
      }
    });

    root.jQuery('#ct-chart-note').text('Edge labels are substrings, not characters — that is the ' +
      'compression. The drawing stops at 90 of ' + root.Format.exact(built.radix.nodes()) + ' nodes.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
