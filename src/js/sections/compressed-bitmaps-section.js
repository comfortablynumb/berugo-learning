/**
 * Section: compressed bitmaps — Roaring containers against word-aligned runs.
 *
 * The table deliberately includes the case where Roaring loses: on a dense
 * chunk it stores 8 208 bytes where a flat bitmap stores 8 192 and WAH stores
 * 5 164. A comparison that only shows the distribution the structure was
 * designed for is marketing, and the selection rule this section is trying to
 * teach is only visible when all three distributions are on the same screen.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'compressed-bitmaps';
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

  function diagram() {
    return {
      title: 'Diagram — one container per chunk',
      caption: 'The high 16 bits pick a chunk; the chunk decides its own representation from its own ' +
        'cardinality. Nothing about the rest of the set is consulted, which is why a set that is sparse in ' +
        'one region and dense in another pays the right price in both.',
      definition: [
        'flowchart TD',
        '    V["value 0x0002_ABCD"] --> H["high 16 bits: chunk 2"]',
        '    V --> L["low 16 bits: 0xABCD"]',
        '    H --> C{"cardinality of chunk 2"}',
        '    C -- "≤ 4 096" --> A["sorted array of 16-bit values<br/>2 bytes each"]',
        '    C -- "> 4 096" --> B["2 048-word bitmap<br/>8 192 bytes, flat"]',
        '    C -- "consecutive" --> R["run list<br/>4 bytes per run"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Roaring splits the 32-bit universe into chunks of 65 536 and picks a representation per ' +
          'chunk. It is a sorted array of 16-bit values while the chunk holds at most 4 096 of ' +
          'them, and a 2 048-word bitmap once it holds more. It is a list of runs when the values ' +
          'are consecutive. The threshold is the point where the two costs cross — 4 096 × 2 bytes ' +
          'is exactly 8 192 — so the choice is arithmetic rather than a heuristic. It is also ' +
          'made per chunk rather than for the whole set.',
        'On 20 000 values spread over 5 000 000 that is 77 array containers and 41 232 bytes. A ' +
          'flat bitmap costs 630 784, a sorted array 80 000, and word-aligned run-length encoding ' +
          '141 972, because it has no runs to find and pays a header per word. On a dense chunk ' +
          'the ranking inverts: Roaring stores 8 208 bytes where the flat bitmap stores 8 192 and ' +
          'WAH stores 5 164. Roaring is not the smallest encoding; it is the one that is never ' +
          'much worse than the best.',
        'The runs case is where run-length encoding earns its name. A chunk costing 8 208 bytes as ' +
          'a bitmap container becomes 808 after runOptimize, a 10.2× improvement from noticing ' +
          'that the values are consecutive. The container choice is not only about space. An ' +
          'intersection of a small array container with a bitmap probes 3 elements and touches 0 ' +
          'words, while two bitmaps AND 2 048 words. Choosing the algorithm per container pair is ' +
          'why Roaring is fast, not just small.'
      ],
      demo: {
        title: 'Interactive demo — three distributions, five representations, two intersection paths',
        markup: root.CompressedBitmapsTemplate.render()
      },
      diagram: diagram(),
      insight: 'The transferable idea is per-block representation choice with a cost-based ' +
        'threshold. Roaring never picks a representation for the whole set. It picks one for every ' +
        '65 536 values and switches when the arithmetic says the other is smaller. That is why it ' +
        'degrades gracefully on data it was not designed for. The same pattern shows up in column ' +
        'stores choosing an encoding per page and in allocators choosing a size class per bucket. ' +
        'The failure mode to watch is a threshold that is checked on insert and never on delete. A ' +
        'container that grew into a bitmap and shrank back to twelve values stays 8 192 bytes ' +
        'until something converts it.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.CompressedBitmapsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const kindsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.SuccinctLab.bitmapKinds({ count: parts[0], seed: parts[1] });
  });

  const pathsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    return root.SuccinctLab.intersectionPaths({ count: parts[0], seed: parts[1] });
  });

  function update(app) {
    const values = panel.values();
    const rows = kindsFor(values['cbm-count'] + '|' + values['cbm-seed']);
    const chosen = rows.filter(function (row) { return row.kind === values['cbm-kind']; })[0];

    paintMetrics(chosen);
    paintKinds(rows, chosen);
    paintPaths(pathsFor(values['cbm-count'] + '|' + values['cbm-seed']));
    drawBars(app, chosen);
  }

  function containersOf(row) {
    return Object.keys(row.shape.containers)
      .filter(function (kind) { return row.shape.containers[kind] > 0; })
      .map(function (kind) { return row.shape.containers[kind] + ' ' + kind; })
      .join(', ') || 'none';
  }

  function paintMetrics(row) {
    root.MetricGrid.update({
      'cbm-bytes': {
        value: root.Format.exact(row.shape.bytes),
        note: containersOf(row) + ' for ' + root.Format.exact(row.count) + ' values'
      },
      'cbm-bits': {
        value: root.Format.fixed(row.shape.bitsPerValue, 2),
        note: 'a sorted 32-bit array would be ' + root.Format.exact(row.shape.sortedArrayBytes) + ' bytes'
      },
      'cbm-raw': {
        value: root.Format.fixed(row.againstRaw, 2) + '×',
        note: row.againstRaw >= 1 ? 'smaller than a flat bitmap' : 'larger than a flat bitmap, on this data'
      },
      'cbm-wah': {
        value: root.Format.fixed(row.againstWah, 2) + '×',
        note: row.againstWah >= 1 ? 'smaller than WAH' : 'larger than WAH, on this data'
      }
    });
  }

  function paintKinds(rows, chosen) {
    const html = rows.map(function (row) {
      return '<tr' + (row.kind === chosen.kind ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + row.kind + '</td>' +
        '<td class="mono">' + containersOf(row) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.bytes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.optimised.bytes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.wah.bytes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.rawBitmapBytes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.sortedArrayBytes) + '</td></tr>';
    }).join('');

    root.jQuery('#cbm-kinds tbody').html(html);
    root.jQuery('#cbm-kinds-note').text('Read across the rows rather than down the columns: the sparse row ' +
      'beats every alternative, the dense row is beaten by both the flat bitmap and WAH, and the runs row is ' +
      'only competitive after runOptimize converts its bitmap container into a run container. That is the ' +
      'honest summary of Roaring — never the smallest, never far from it, and the same code either way.');
  }

  function paintPaths(paths) {
    const rows = [
      { label: 'small array container × bitmap container', path: 'probe each element of the array',
        stats: paths.mixed.stats, size: paths.mixed.size },
      { label: 'bitmap container × bitmap container', path: 'AND the words',
        stats: paths.both.stats, size: paths.both.size }
    ];

    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td>' + row.path + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.wordsTouched) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.elementsTouched) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.stats.probes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.size) + '</td></tr>';
    }).join('');

    root.jQuery('#cbm-paths tbody').html(html);
    root.jQuery('#cbm-paths-note').text('The first row is the case that makes Roaring fast on the queries ' +
      'people actually run: intersecting a five-element set with a twenty-thousand-element one costs five ' +
      'membership probes, not a scan of 2 048 words. A representation that could not tell the two operands ' +
      'apart — a flat bitmap, or WAH — has to walk the whole word range either way, and that is a bigger ' +
      'practical difference than any of the byte counts above.');
  }

  function drawBars(app, row) {
    bars = root.ErrorBandView.bars(root.jQuery('#cbm-bars')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      logY: true,
      xLabel: 'representation',
      yLabel: 'bytes (log scale)',
      values: [
        { label: 'roaring', value: Math.max(row.shape.bytes, 1), series: 0 },
        { label: 'run-optimised', value: Math.max(row.optimised.bytes, 1), series: 1 },
        { label: 'WAH', value: Math.max(row.wah.bytes, 1), series: 2 },
        { label: 'flat bitmap', value: Math.max(row.shape.rawBitmapBytes, 1), series: 3 },
        { label: 'sorted array', value: Math.max(row.shape.sortedArrayBytes, 1), series: 4 }
      ]
    });

    root.jQuery('#cbm-bars-note').text('The same ' + root.Format.exact(row.count) + ' values, five ways, on a ' +
      'log axis. Switch the distribution and the order of the bars changes completely — which is the point ' +
      'the single-distribution benchmarks in most bitmap papers hide, and the reason the container choice is ' +
      'made per chunk instead of once for the set.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
