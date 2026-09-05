/**
 * Section: bit-partitioned tries — HAMTs, persistent vectors and transients.
 *
 * Two structures, one idea: cut the key into 5-bit chunks and let a bitmap
 * plus a population count stand in for a 32-slot array. The map demo measures
 * what that sparse layout saves; the vector demo measures what a transient
 * saves on top of it, which is the part that turns "elegant" into "usable".
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'bit-partitioned-tries';
  let panel = null;
  let bars = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (bars) bars.redraw();
    });
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A hash array mapped trie splits the 32-bit hash into 5-bit chunks, so every level ' +
          'branches 32 ways and the whole map is at most seven levels deep. The trick that makes ' +
          'it practical is the node layout. A 32-bit bitmap says which children exist. The child ' +
          'for chunk c sits at index popcount(bitmap & ((1 << c) − 1)) of an array holding only ' +
          'the occupied slots. Over 15 695 keys that is 3 930 nodes holding 19 624 slots — a ' +
          'mean fan-out of 4.99 rather than 32.',
        'The saving is the difference between paying for the slots you have and paying for the ' +
          'slots you could have had. That is 219 872 bytes sparse against 1 037 520 dense, 4.72×. ' +
          'It costs ' +
          'one popcount per level, which is a single instruction on every processor this will ever ' +
          'run on. It is the reason Clojure, Scala and Haskell all ship the same structure.',
        'A persistent vector is the same trie keyed by the index instead of a hash, and it exposes ' +
          'the cost that pure structures always have. Building 20 000 elements one at a time ' +
          'allocates 1 840 nodes, because every append copies the path it touches. A transient — a ' +
          'temporarily mutable copy with an ownership token — brings that to 645 by mutating the ' +
          '1 195 nodes it already owns, 2.85× fewer. It hands back an ordinary persistent vector ' +
          'at the end.'
      ],
      demo: {
        title: 'Interactive demo — sparse nodes, and the transient that pays for the build',
        markup: root.BitPartitionedTriesTemplate.render()
      },
      diagram: {
        title: 'Diagram — bitmap, popcount, slot',
        caption: 'The bitmap is the index. Bit c is set when a child exists for chunk c, and the number of set ' +
          'bits below c is that child\'s position in the compact array — so a node with three children stores ' +
          'three pointers and still answers "which slot" in one instruction.',
        definition: [
          'flowchart LR',
          '    H["hash 0x…3A"] --> C["chunk = hash & 31 = 26"]',
          '    C --> B["bitmap 0b0100_0100_0000_0000_0000_0100_0000_0001"]',
          '    B --> T{"bit 26 set?"}',
          '    T -- no --> M["absent"]',
          '    T -- yes --> P["popcount(bitmap & (1&lt;&lt;26) − 1) = 2"]',
          '    P --> S["slots[2] — the third of three pointers"]'
        ].join('\n')
      },
      insight: 'The bitmap-and-popcount node is the transferable idea here, and it is not specific ' +
        'to maps. Any time a fixed-width array is mostly empty, one word of presence bits plus a ' +
        'population count turns it into a dense array with O(1) indexing. The transient is the ' +
        'other half of the lesson. A persistent structure built one operation at a time pays for ' +
        'versions nobody will ever look at. The fix is not to abandon persistence, but to admit ' +
        'the intermediate versions are unobservable and mutate them under an ownership token that ' +
        'makes the admission checkable.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BitPartitionedTriesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const mapFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.VersionLab.mapCompare({ count: parts[0], seed: parts[1] });
  });

  const vectorFor = root.Helpers.memoise(function (key) {
    return root.VersionLab.vectorAllocations({ count: Number(key) });
  });

  function update(app) {
    const values = panel.values();
    const maps = mapFor(values['bpt-count'] + '|' + values['bpt-seed']);
    const vector = vectorFor(values['bpt-count']);

    paintMetrics(values['bpt-structure'], maps, vector);
    paintMap(maps);
    paintVector(vector);
    drawBars(app, values['bpt-structure'], maps, vector);
  }

  function paintMetrics(structure, maps, vector) {
    if (structure === 'map') {
      paintMapMetrics(maps);
      return;
    }

    root.MetricGrid.update({
      'bpt-nodes': {
        value: root.Format.exact(vector.shape.nodes),
        note: 'holding ' + root.Format.exact(vector.count) + ' elements'
      },
      'bpt-slots': {
        value: root.Format.exact(vector.transient.nodesAllocated),
        note: 'against ' + root.Format.exact(vector.persistent.nodesAllocated) + ' without a transient'
      },
      'bpt-depth': {
        value: root.Format.exact(vector.shape.levels),
        note: 'a 32-way trie plus a ' + root.Format.exact(vector.shape.tail) + '-slot tail'
      },
      'bpt-saving': {
        value: root.Format.fixed(vector.saving, 2) + '×',
        note: root.Format.exact(vector.transient.nodesMutated) + ' nodes mutated in place instead of copied'
      }
    });
  }

  function paintMapMetrics(maps) {
    root.MetricGrid.update({
      'bpt-nodes': {
        value: root.Format.exact(maps.shape.nodes),
        note: 'for ' + root.Format.exact(maps.shape.entries) + ' distinct keys'
      },
      'bpt-slots': {
        value: root.Format.exact(maps.shape.slots),
        note: 'a dense layout would hold ' + root.Format.exact(maps.shape.nodes * 32)
      },
      'bpt-depth': {
        value: root.Format.exact(maps.shape.maxDepth),
        note: '⌈32 / 5⌉ = ' + root.Format.exact(maps.depthBound) + ' is the bound'
      },
      'bpt-saving': {
        value: root.Format.fixed(maps.denseSaving, 2) + '×',
        note: root.Format.exact(maps.shape.emptySlots) + ' empty slots stored'
      }
    });
  }

  function paintMap(maps) {
    const rows = [
      { label: 'bitmap + popcount (sparse)', slots: maps.shape.slots, bytes: maps.shape.bytesSparse },
      { label: '32 slots per node (dense)', slots: maps.shape.nodes * 32, bytes: maps.shape.bytesDense }
    ];

    const html = rows.map(function (row, index) {
      return '<tr' + (index === 0 ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(maps.shape.nodes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.slots) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.slots / Math.max(1, maps.shape.nodes), 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(maps.shape.maxDepth) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.bytes) + '</td>' +
        '<td class="mono">' + root.Format.exact(maps.wrong) + '</td></tr>';
    }).join('');

    root.jQuery('#bpt-map tbody').html(html);
    root.jQuery('#bpt-map-note').text('Both rows are the same trie; only the node layout differs, which is why ' +
      'the node count, the depth and the answers are identical and only the slot count moves. The mean fan-out ' +
      'of ' + root.Format.fixed(maps.shape.meanFanout, 2) + ' is the whole argument: a 32-way node is almost ' +
      'always mostly empty, and paying for 32 pointers to store five of them is the default a bitmap removes.');
  }

  function paintVector(vector) {
    const rows = [
      { label: 'persistent, one append at a time', stats: vector.persistent },
      { label: 'through a transient, then frozen', stats: vector.transient }
    ];

    const html = rows.map(function (row, index) {
      return '<tr' + (index === 1 ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.nodesAllocated) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.nodesMutated) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.stats.nodesAllocated / Math.max(1, vector.count), 4) + '</td>' +
        '<td class="mono">' + root.Format.exact(vector.shape.levels) + '</td>' +
        '<td class="mono">' + root.Format.exact(vector.shape.tail) + '</td>' +
        '<td class="mono">' + root.Format.exact(vector.wrong) + '</td></tr>';
    }).join('');

    root.jQuery('#bpt-vector tbody').html(html);
    root.jQuery('#bpt-vector-note').text('Both builds produce a vector that answers every one of the ' +
      root.Format.exact(vector.count) + ' indices correctly — the last column is the check, and it is zero for ' +
      'both. The tail is why the per-append figure is so far below the depth: 31 appends out of 32 touch only a ' +
      'small buffer, and the trie is disturbed on the 32nd. The transient removes what is left, by owning the ' +
      'nodes it just made instead of copying them again.');
  }

  function drawBars(app, structure, maps, vector) {
    const values = structure === 'map'
      ? [{ label: 'sparse nodes', value: maps.shape.bytesSparse, series: 0 },
        { label: 'dense nodes', value: maps.shape.bytesDense, series: 1 }]
      : [{ label: 'with a transient', value: vector.transient.nodesAllocated, series: 0 },
        { label: 'one append at a time', value: vector.persistent.nodesAllocated, series: 1 }];

    bars = root.ErrorBandView.bars(root.jQuery('#bpt-bars')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      xLabel: structure === 'map' ? 'node layout' : 'build',
      yLabel: structure === 'map' ? 'bytes' : 'nodes allocated',
      values: values
    });

    root.jQuery('#bpt-bars-note').text(structure === 'map'
      ? 'The same map, the same answers, the same depth — ' + root.Format.fixed(maps.denseSaving, 2) +
        '× the memory, decided by whether a node stores its empty slots. Change the seed and the ratio barely ' +
        'moves, because it is a property of how a 32-way trie fills rather than of these particular keys.'
      : 'The same ' + root.Format.exact(vector.count) + ' appends and the same final vector, at ' +
        root.Format.fixed(vector.saving, 2) + '× fewer allocations. The transient is not a different data ' +
        'structure: it is the same trie with an ownership token, and the token is what makes mutating a node ' +
        'safe — no other version can be pointing at one you own.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
