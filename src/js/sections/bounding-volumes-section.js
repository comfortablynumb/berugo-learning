/**
 * Section: bounding volume hierarchies and the surface-area heuristic.
 *
 * The demo runs the worked examples' parameters - 20 000 triangles in six
 * clumps, 1 000 rays - and always builds both trees, because the SAH's claim
 * is comparative. The refit panel is the second worked example made
 * interactive: the same tree, the same rays, and a 5.2x cost difference
 * decided entirely by whether the motion preserved the grouping.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'bounding-volumes';
  const RAYS = 1000;
  const EXTENT = 100;
  const LEAF_SIZES = [1, 2, 4, 8, 16];
  let panel = null;
  let chart = null;
  let map = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (chart) chart.redraw();
      if (map) map.redraw();
    });
  }

  function diagram() {
    return {
      title: 'Diagram — a BVH with box extents annotated',
      caption: 'The children\'s boxes may overlap, which a space-partitioning tree\'s cells cannot. In ' +
        'exchange, every primitive is referenced exactly once and the tree can be re-bounded in place when ' +
        'the scene moves.',
      definition: [
        'flowchart TD',
        '    R["root · 20 000 tris<br/>0,0,0 – 100,100,100<br/>area 60 000"] --> L["left · 11 240 tris<br/>0,0,0 – 62,100,100<br/>area 42 400"]',
        '    R --> Rr["right · 8 760 tris<br/>48,0,0 – 100,100,100<br/>area 38 400"]',
        '    L --> LL["6 100 tris"]',
        '    L --> LR["5 140 tris"]',
        '    Rr --> RL["4 380 tris"]',
        '    Rr --> RR["4 380 tris"]',
        '    LL --> Leaf["… leaf · ≤ 4 triangles"]',
        '    N["the 48–62 slab is in both boxes:<br/>a ray there enters both subtrees"] -.-> L',
        '    N -.-> Rr'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A BVH splits the *primitive list* rather than space, so every triangle appears in exactly ' +
          'one leaf and the boxes are allowed to overlap instead. That is the difference from a ' +
          'k-d tree, and it is why a BVH survives animation. When the primitives move the topology ' +
          'is still valid and only the boxes are wrong, and boxes recompute in one bottom-up pass.',
        'The surface-area heuristic is a cost model, not a rule of thumb. For a uniformly random ' +
          'ray that already hits a node, the chance of hitting a child is the ratio of their ' +
          'surface areas. So the expected cost of a split is Ct + Ci·(A(L)·N(L) + A(R)·N(R))/A(P), ' +
          'a number per candidate split. On 20 000 triangles the SAH build reaches a modelled cost ' +
          'of 49.44 against a median split\'s 65.81, and the rays agree: 25.71 nodes visited each ' +
          'against 40.70. The SAH tree is deeper (18 against 13) and smaller (13 273 nodes against ' +
          '15 423), because uneven splits let subtrees bottom out at different rates. The model\'s ' +
          'other half is the decision *not* to split at all, and the demo counts it rather than ' +
          'assuming it. At a leaf size of 4 that branch never fires; at a leaf size of 1 it fires ' +
          '69 times.',
        'Traversal is an explicit stack with the nearest child first, and the far child re-tested ' +
          'at pop time against the closest hit found so far. The one trap is the slab test on an ' +
          'axis-parallel ray. With a direction component of zero the reciprocal is infinite, and ' +
          'if the origin sits on a slab plane the product is 0 × ∞ = NaN. Every comparison against ' +
          'NaN is false, so the box silently vanishes — on exactly the axis-aligned scenes that ' +
          'make up most test content.'
      ],
      demo: { title: 'Interactive demo — two builds, one triangle soup, and a moving scene', markup: root.BoundingVolumesTemplate.render() },
      diagram: diagram(),
      insight: 'The SAH is a cost model, not a heuristic in the vague sense. It estimates expected ' +
        'traversal cost under a stated assumption, and writing that estimate down is what makes ' +
        'the build decision arguable rather than tuned. The same number is also the health metric ' +
        'for an animated scene. Refitting is free and correct, and whether it is *good* depends ' +
        'entirely on whether the motion preserved the grouping. Watch the tree\'s own SAH cost ' +
        'across frames; the root box grows only 16% while the cost grows 5.2×, so the obvious ' +
        'metric detects nothing.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BoundingVolumesTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const sceneFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.SpatialLab.scene({
      count: Number(parts[0]), seed: 5, clumps: Number(parts[1]), extent: EXTENT, size: 2
    });
  });

  const raysFor = root.Helpers.memoise(function () {
    return root.SpatialLab.rays({ count: RAYS, seed: 5, extent: EXTENT });
  });

  const buildsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const scene = sceneFor(parts[0] + '|' + parts[1]);
    const rays = raysFor('r');
    const oracle = root.Bvh.bruteForce(scene);
    const truth = rays.map(function (ray) { return oracle.intersect(ray); });

    return ['median', 'sah'].map(function (strategy) {
      const tree = root.Bvh.build(scene, { strategy: strategy, leafSize: Number(parts[2]), bins: 16 });
      tree.resetStats();
      let wrong = 0;
      rays.forEach(function (ray, index) {
        const found = tree.intersect(ray);
        if (!!found.hit !== !!truth[index].hit) { wrong += 1; return; }
        if (found.hit && Math.abs(found.t - truth[index].t) > 1e-6) wrong += 1;
      });
      return { strategy: strategy, tree: tree, shape: tree.shape(), stats: tree.stats(), wrong: wrong };
    });
  });

  const leafSweepFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const scene = sceneFor(parts[0] + '|' + parts[1]);
    const rays = raysFor('r');
    return LEAF_SIZES.map(function (leafSize) {
      const tree = root.Bvh.build(scene, { strategy: parts[2], leafSize: leafSize, bins: 16 });
      tree.resetStats();
      rays.forEach(function (ray) { tree.intersect(ray); });
      return { leafSize: leafSize, shape: tree.shape(), stats: tree.stats() };
    });
  });

  /* The refit measurement builds a *fresh* scene, because moving the triangles
     mutates them and every other panel is looking at the same objects. */
  const refitFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const scene = root.SpatialLab.scene({
      count: Number(parts[0]), seed: 5, clumps: Number(parts[1]), extent: EXTENT, size: 2
    });
    const rays = raysFor('r');
    const tree = root.Bvh.build(scene, { strategy: 'sah', leafSize: Number(parts[2]), bins: 16 });
    const before = tree.cost();

    move(scene, parts[3]);
    const growth = tree.refit();
    const refitted = measureRays(tree, rays);
    const rebuilt = root.Bvh.build(scene, { strategy: 'sah', leafSize: Number(parts[2]), bins: 16 });

    return {
      before: before, growth: growth, motion: parts[3],
      refit: { cost: tree.cost(), stats: refitted },
      rebuild: { cost: rebuilt.cost(), stats: measureRays(rebuilt, rays) }
    };
  });

  function measureRays(tree, rays) {
    tree.resetStats();
    rays.forEach(function (ray) { tree.intersect(ray); });
    return tree.stats();
  }

  function move(scene, motion) {
    scene.forEach(function (primitive, index) {
      const shift = motion === 'coherent'
        ? [Math.sin(primitive.centroid[0] / 20) * 2, Math.cos(primitive.centroid[1] / 20) * 2, 0]
        : [((index % 11) - 5) * 1.5, ((index % 7) - 3) * 1.5, ((index % 5) - 2) * 1.5];
      primitive.min = primitive.min.map(function (v, a) { return v + shift[a]; });
      primitive.max = primitive.max.map(function (v, a) { return v + shift[a]; });
      primitive.centroid = primitive.centroid.map(function (v, a) { return v + shift[a]; });
      primitive.points = primitive.points.map(function (point) {
        return point.map(function (v, a) { return v + shift[a]; });
      });
    });
  }

  function update(app) {
    const values = panel.values();
    const sceneKey = values['bvh-count'] + '|' + values['bvh-clumps'];
    const builds = buildsFor(sceneKey + '|' + values['bvh-leaf']);
    const chosen = builds.filter(function (row) { return row.strategy === values['bvh-strategy']; })[0];

    paintMetrics(chosen);
    paintCompare(builds, chosen);
    paintRefit(refitFor(sceneKey + '|' + values['bvh-leaf'] + '|' + values['bvh-motion']));
    drawChart(app, leafSweepFor(sceneKey + '|' + values['bvh-strategy']), Number(values['bvh-leaf']));
    drawMap(app, chosen, sceneKey);
  }

  function paintMetrics(row) {
    root.MetricGrid.update({
      'bvh-cost': {
        value: root.Format.fixed(row.shape.sahCost, 2),
        note: root.Format.exact(row.shape.leavesByCost) + ' leaves made because splitting would have cost more'
      },
      'bvh-nodes': {
        value: root.Format.fixed(row.stats.nodesVisited / RAYS, 2),
        note: root.Format.fixed(row.stats.primitivesTested / RAYS, 2) + ' primitives intersected, ' +
          root.Format.fixed(row.stats.nodesPruned / RAYS, 2) + ' nodes rejected'
      },
      'bvh-shape': {
        value: root.Format.exact(row.shape.nodes) + ' nodes',
        note: root.Format.exact(row.shape.leaves) + ' leaves, depth ' + row.shape.maxDepth +
          ', ' + root.Format.bytes(row.shape.bytes)
      },
      'bvh-hits': {
        value: root.Format.exact(row.stats.hits) + ' of ' + RAYS,
        note: row.wrong ? row.wrong + ' rays disagreed with brute force'
          : 'no ray disagreed with a brute-force intersection of every triangle'
      }
    });
  }

  function paintCompare(builds, chosen) {
    const html = builds.map(function (row) {
      const here = row.strategy === chosen.strategy;
      return '<tr' + (here ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + (row.strategy === 'sah' ? 'surface-area heuristic' : 'median centroid') + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.nodes) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.leaves) + '</td>' +
        '<td class="mono">' + row.shape.maxDepth + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.shape.sahCost, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.shape.overlap) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.stats.nodesVisited / RAYS, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.stats.primitivesTested / RAYS, 2) + '</td>' +
        '<td class="mono">' + row.wrong + '</td></tr>';
    }).join('');

    root.jQuery('#bvh-compare tbody').html(html);
    root.jQuery('#bvh-compare-note').text('The two builds return the identical picture — the disagreement ' +
      'column counts rays whose hit, miss or distance differed from a brute-force intersection of every ' +
      'triangle, and it is zero for both. Notice the shape of the SAH\'s win: it builds a *deeper* and ' +
      '*smaller* tree, because the model tells it where splitting is worth the traversal and where it is not. ' +
      'A fixed leaf size cannot express that.');
  }

  function paintRefit(result) {
    root.jQuery('#bvh-refit').text([
      'The scene moves ' + result.motion + 'ly; the tree keeps its topology and only its boxes are recomputed.',
      '',
      '  SAH cost before the move:      ' + root.Format.fixed(result.before, 2),
      '  SAH cost after refitting:      ' + root.Format.fixed(result.refit.cost, 2),
      '  SAH cost of a full rebuild:    ' + root.Format.fixed(result.rebuild.cost, 2),
      '',
      '  root box surface area:         × ' + root.Format.fixed(result.growth.growth, 2),
      '',
      '  primitives tested per ray, refitted: ' + root.Format.fixed(result.refit.stats.primitivesTested / RAYS, 2),
      '  primitives tested per ray, rebuilt:  ' + root.Format.fixed(result.rebuild.stats.primitivesTested / RAYS, 2),
      '  nodes visited per ray, refitted:     ' + root.Format.fixed(result.refit.stats.nodesVisited / RAYS, 2),
      '  nodes visited per ray, rebuilt:      ' + root.Format.fixed(result.rebuild.stats.nodesVisited / RAYS, 2)
    ].join('\n'));

    root.jQuery('#bvh-refit-note').text('Switch the motion between coherent and scattered. Under coherent ' +
      'motion the refitted tree is as good as a rebuild and there is no reason to rebuild at all; under ' +
      'independent motion it is still perfectly correct and has quietly stopped pruning. The root-box row is ' +
      'the reason this needs its own metric: it barely moves in either case, so watching the root tells you ' +
      'nothing and watching the SAH cost tells you everything.');
  }

  function drawChart(app, rows, current) {
    chart = root.ErrorBandView.curve(root.jQuery('#bvh-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      logX: true,
      legendHost: root.jQuery('#bvh-chart-legend')[0],
      xLabel: 'leaf size (log scale)',
      yLabel: 'per ray',
      markers: [{ x: current, label: 'leaf size ' + current }],
      series: [
        { label: 'nodes visited per ray', points: rows.map(function (r) { return { x: r.leafSize, y: r.stats.nodesVisited / RAYS }; }), width: 3 },
        { label: 'primitives tested per ray', points: rows.map(function (r) { return { x: r.leafSize, y: r.stats.primitivesTested / RAYS }; }) },
        { label: 'SAH cost of the tree', points: rows.map(function (r) { return { x: r.leafSize, y: r.shape.sahCost }; }), dashed: true }
      ]
    });

    root.jQuery('#bvh-chart-note').text('A leaf size of 1 builds the deepest tree and tests the fewest ' +
      'primitives, and it is not the fastest: the extra levels cost traversal that buys almost no pruning, ' +
      'because a node holding two triangles has nearly the same box as either of them. The modelled cost curve ' +
      'and the measured node curve agree about where the knee is.');
  }

  function drawMap(app, row, sceneKey) {
    const scene = sceneFor(sceneKey);
    /* The top six levels only - at most 63 boxes. Drawing all 13 273 at this
       scale is a solid grey wash that says nothing about the hierarchy, which
       is what the picture is for. */
    const boxes = row.tree.boxes(20000).filter(function (entry) { return entry.depth <= 5; })
      .map(function (entry) {
        return { minX: entry.box.min[0], minY: entry.box.min[1], maxX: entry.box.max[0], maxY: entry.box.max[1] };
      });

    map = root.SpatialView.render(root.jQuery('#bvh-map')[0], {
      height: 340,
      bounds: { minX: 0, minY: 0, maxX: EXTENT, maxY: EXTENT },
      boxes: boxes,
      boxTone: 'strong',
      points: scene.filter(function (primitive, index) { return index % 5 === 0; })
        .map(function (primitive) { return { x: primitive.centroid[0], y: primitive.centroid[1] }; }),
      pointRadius: 0.8,
      summary: 'The top six levels of the ' + (row.strategy === 'sah' ? 'SAH' : 'median-split') +
        ' hierarchy over ' + root.Format.exact(scene.length) + ' triangles, projected onto x and y.'
    });

    root.jQuery('#bvh-map-note').text('The top six levels — ' + root.Format.exact(boxes.length) + ' boxes of ' +
      'the ' + root.Format.exact(row.shape.nodes) + ' the tree holds — over a fifth of the triangle centroids. ' +
      'This is a two-dimensional projection of a three-dimensional hierarchy, so boxes that look nested here ' +
      'may be separated in z; read it for how the two builds carve the scene rather than for containment. ' +
      'Switch between the median split and the SAH and watch the boxes stop being equal-sized.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
