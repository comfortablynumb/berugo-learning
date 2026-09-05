/**
 * Section: Cache-conscious layouts.
 *
 * The same binary search over three arrangements of the same keys. The
 * comparison counts barely move; the cache lines touched do, and that is the
 * whole argument for the memory-hierarchy track.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'cache-layouts';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () { if (chart) chart.redraw(); });
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render({
      sectionId: SECTION_ID,
      orientation: [
        'Binary search over a sorted array is optimal in comparisons and poor in memory ' +
          'behaviour. The first probe lands in the middle and the next a quarter away, so every ' +
          'early step touches a cache line it will never use again.',
        'The Eytzinger layout stores the same keys in breadth-first order, so the root and the first ' +
          'levels sit next to each other and arrive together. A blocked layout goes further and packs ' +
          'B keys per node, so one line answers B comparisons — the B-tree idea applied to a static ' +
          'array.',
        'The number to watch is misses, not distinct lines. Every layout touches about log n ' +
          'lines per query. The top of an Eytzinger tree is a handful of adjacent lines that stay ' +
          'resident across queries. The equivalent levels of a sorted binary search are spread ' +
          'one line apiece across the whole array.',
        'The model here has no prefetcher. Real Eytzinger implementations gain again from ' +
          'prefetching several levels ahead and from branch-free code, which is where the ' +
          'published ~2× comes from. What the demo isolates is the residency effect alone.'
      ],
      demo: { title: 'Interactive demo — three layouts, one search', markup: root.CacheLayoutsTemplate.render() },
      diagram: {
        title: 'Diagram — where the probes land',
        caption: 'Sorted search scatters early probes; Eytzinger clusters them at the front.',
        definition: [
          'flowchart TD',
          '    subgraph SORTED["sorted array"]',
          '        A["probe n/2"] --> B["probe n/4 or 3n/4"] --> C["probe n/8 …"]',
          '    end',
          '    subgraph EYT["eytzinger"]',
          '        D["index 1 (root)"] --> E["index 2 or 3"] --> F["index 4-7"]',
          '        F --> G["the first levels share one cache line"]',
          '    end'
        ].join('\n')
      },
      insight: 'The same algorithm, relaid out, fetches a fraction of the memory — and the effect only ' +
        'exists once the data stops fitting in cache. That is why "optimal in comparisons" and "fast" ' +
        'are different claims, and why the memory hierarchy gets its own milestone.'
    }));

    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.CacheLayoutsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function update(app) {
    const values = panel.values();
    const result = root.CacheLayouts.compare({
      n: values['layout-n'],
      queries: values['layout-queries'],
      blockSize: values['layout-block'],
      cacheLines: root.CacheSim.linesFor(values['layout-cache'] * 1024),
      rng: root.Random.seeded(97)
    });

    const byName = {};
    result.layouts.forEach(function (entry) { byName[entry.name] = entry; });
    const best = result.layouts.reduce(function (min, entry) {
      return entry.missesPerQuery < min.missesPerQuery ? entry : min;
    }, result.layouts[0]);

    ['sorted', 'eytzinger', 'blocked'].forEach(function (name) {
      root.MetricGrid.update({
        ['layout-' + name]: {
          value: byName[name].missesPerQuery.toFixed(2) + ' misses',
          note: byName[name].comparisonsPerQuery.toFixed(1) + ' comparisons and ' +
            byName[name].cacheLinesPerQuery.toFixed(1) + ' distinct lines per query'
        }
      });
    });

    root.MetricGrid.update({
      'layout-best': {
        value: best.name,
        note: best.missesPerQuery > 0
          ? root.Format.ratio(byName.sorted.missesPerQuery, best.missesPerQuery) +
            ' fewer misses than the sorted array'
          : 'the whole array fits in the cache, so nothing misses twice'
      }
    });

    paintMapping();
    draw(app, values);
  }

  function paintMapping() {
    const sorted = [];
    for (let i = 0; i < 15; i += 1) sorted.push(i * 2);
    const eytzinger = root.CacheLayouts.buildEytzinger(sorted);

    const rows = eytzinger.slice(1).map(function (value, index) {
      return '<span class="chip" style="margin:1px">[' + (index + 1) + '] = ' + value + '</span>';
    }).join('');

    root.jQuery('#layout-mapping').html(
      '<div>sorted: ' + sorted.join(' ') + '</div>' +
      '<div style="margin-top:.375rem">eytzinger: ' + rows + '</div>');
  }

  function draw(app, values) {
    const sizes = [];
    for (let n = 256; n <= Math.max(1024, values['layout-n']); n *= 2) sizes.push(n);

    const series = { sorted: [], eytzinger: [], blocked: [] };
    const cacheLines = root.CacheSim.linesFor(values['layout-cache'] * 1024);
    sizes.forEach(function (n) {
      const result = root.CacheLayouts.compare({
        n: n, queries: 300, blockSize: values['layout-block'],
        cacheLines: cacheLines, rng: root.Random.seeded(11)
      });
      result.layouts.forEach(function (entry) {
        series[entry.name].push({ x: n, y: Math.max(0.01, entry.missesPerQuery) });
      });
    });

    chart = root.GrowthPlot.render(root.jQuery('#layout-chart')[0], {
      lazyLib: app.lazyLib,
      height: 240,
      logX: true,
      series: [
        { label: 'sorted array', points: series.sorted, dots: true },
        { label: 'eytzinger', points: series.eytzinger, dots: true },
        { label: 'blocked', points: series.blocked, dots: true }
      ],
      xLabel: 'keys (log)',
      yLabel: 'cache misses per query',
      yMin: 0,
      legendHost: root.jQuery('#layout-legend')[0],
      summary: function () {
        return 'Cache misses per query for each layout as the key count grows past the cache size.';
      }
    });
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
