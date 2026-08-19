/**
 * Section: broad-phase collision detection.
 *
 * All three phases run the same scripted scene every time, so "the same
 * answer, less work" is a checked claim rather than a hope - the pair counts
 * in the table are identical by construction and the test counts are not. The
 * defaults are the worked example's: 400 discs of radius 6 at 60 units/s over
 * 120 frames of 1/30 s.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'broad-phase';
  const FRAMES = 120;
  const BOUNDS = { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  const SPEEDS = [15, 60, 150, 300, 600, 1200];
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

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A broad phase may propose pairs that do not touch and may never miss one that does. That asymmetry is ' +
          'what lets it use boxes and grids — a false positive costs one exact test and a false negative costs ' +
          'a bug nobody can reproduce — and it fixes the two numbers worth reporting. On 400 discs, all pairs ' +
          'costs 79 800 tests per frame, sweep and prune 2 370.47 and a rebuilt grid 109.97, all returning the ' +
          'identical 70.78 touching pairs.',
        'Sweep and prune is justified by temporal coherence rather than by asymptotics. Sorting 400 bodies from ' +
          'scratch costs about n²/4 swaps with an insertion sort, and the first frame duly costs 41 177; every ' +
          'frame after it costs about 165, because almost nothing changed order. This is the one place where ' +
          'insertion sort is the correct choice rather than the naive one — O(n log n) is a lower bound on ' +
          'comparisons for *random* input, and this input is not random.',
        'It is also worth being honest about which phase wins here. Sweep and prune prunes on one axis, so two ' +
          'discs far apart vertically and overlapping horizontally are still tested; a grid prunes both and ' +
          'tests 21.6× fewer pairs on this scene. Sweep and prune earns its place when object sizes vary enough ' +
          'to break a uniform grid, when the world is unbounded, or when per-frame allocation is unacceptable — ' +
          'not by default.'
      ],
      demo: { title: 'Interactive demo — three phases, one scripted scene, and the tunnelling wall', markup: root.BroadPhaseTemplate.render() },
      diagram: {
        title: 'Diagram — interval overlap on the sweep axis',
        caption: 'Bodies are sorted by their low x edge. Scanning forward from A stops at the first body whose ' +
          'low edge is past A\'s high edge, so the inner loop is bounded by the overlap rather than by n — and ' +
          'the pruning is one-dimensional, which is the honest limitation.',
        definition: [
          'flowchart LR',
          '    A["A · x 100–114"] --> B["B · x 108–122<br/>overlaps A → test"]',
          '    B --> C["C · x 120–134<br/>overlaps B → test"]',
          '    C --> D["D · x 300–314<br/>starts past C\'s end → stop"]',
          '    D --> E["E · x 305–319"]',
          '    N["A vs C: 120 > 114, so the scan from A stopped before it"] -.-> C'
        ].join('\n')
      },
      insight: 'Temporal coherence is the whole reason sweep and prune works: the sort is almost sorted every ' +
        'frame, so insertion sort is the right choice for once. But the failure this section really exists for ' +
        'is tunnelling, and no broad phase fixes it — a body moving further than its own diameter in a step can ' +
        'be on either side of another and touch it at neither sample, and an exhaustive all-pairs test at the ' +
        'frame boundary misses it just as thoroughly as the cheapest grid. The usable rule is a bound on ' +
        'maximum speed × time step against the smallest radius, enforced by substepping when it is exceeded.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BroadPhaseTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  function worldFor(key) {
    const parts = key.split('|').map(Number);
    return root.BroadPhase.world({
      count: parts[0], seed: 8, speed: parts[1], radius: parts[2], bounds: BOUNDS
    });
  }

  const runsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const scene = worldFor(parts[0] + '|' + parts[1] + '|' + parts[2]);
    const dt = 1 / Number(parts[3]);
    return root.BroadPhase.phases.map(function (phase) {
      return Object.assign(root.BroadPhase.run({
        world: scene, frames: FRAMES, phase: phase, dt: dt, checkTunnelling: true
      }), { phase: phase });
    });
  });

  const tunnelFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const dt = 1 / parts[2];
    return SPEEDS.map(function (speed) {
      const run = root.BroadPhase.run({
        world: root.BroadPhase.world({ count: parts[0], seed: 8, speed: speed, radius: parts[1], bounds: BOUNDS }),
        frames: FRAMES, phase: 'sap', dt: dt, checkTunnelling: true
      });
      return {
        speed: speed, travel: speed * dt, diameters: (speed * dt) / (2 * parts[1]),
        reported: run.reported, missed: run.missed,
        rate: run.missed / Math.max(1, run.reported + run.missed)
      };
    });
  });

  function update(app) {
    const values = panel.values();
    const key = values['bp-count'] + '|' + values['bp-speed'] + '|' + values['bp-radius'] + '|' + values['bp-step'];
    const runs = runsFor(key);
    const chosen = runs.filter(function (run) { return run.phase === values['bp-phase']; })[0];
    const brute = runs.filter(function (run) { return run.phase === 'brute'; })[0];

    paintMetrics(chosen, brute);
    paintCompare(runs, chosen, brute);
    paintTunnel(tunnelFor(values['bp-count'] + '|' + values['bp-radius'] + '|' + values['bp-step']), Number(values['bp-speed']));
    drawChart(app, chosen, runs);
    drawMap(app, chosen, Number(values['bp-radius']));
  }

  function labelFor(phase) {
    return { brute: 'all pairs', sap: 'sweep and prune', hash: 'spatial hash' }[phase];
  }

  function paintMetrics(run, brute) {
    const first = run.frames[0].swaps;
    const later = run.frames.slice(1).reduce(function (total, frame) { return total + frame.swaps; }, 0) /
      Math.max(1, run.frames.length - 1);

    root.MetricGrid.update({
      'bp-tests': {
        value: root.Format.fixed(run.testsPerFrame, 2),
        note: root.Format.fixed(brute.testsPerFrame / Math.max(run.testsPerFrame, 1e-9), 1) +
          '× fewer than all pairs'
      },
      'bp-pairs': {
        value: root.Format.fixed(run.pairsPerFrame, 2),
        note: root.Format.fixed(run.testsPerFrame / Math.max(run.pairsPerFrame, 1e-9), 1) + ' tests per pair found'
      },
      'bp-swaps': {
        value: root.Format.fixed(later, 1),
        note: first ? 'against ' + root.Format.exact(first) + ' on the first frame' : 'this phase carries no sorted order'
      },
      'bp-missed': {
        value: root.Format.exact(run.missed),
        note: 'of ' + root.Format.exact(run.reported + run.missed) + ' contacts the swept test found'
      }
    });
  }

  function paintCompare(runs, chosen, brute) {
    const html = runs.map(function (run) {
      const here = run.phase === chosen.phase;
      const first = run.frames[0].swaps;
      const later = run.frames.slice(1).reduce(function (total, frame) { return total + frame.swaps; }, 0) /
        Math.max(1, run.frames.length - 1);
      return '<tr' + (here ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + labelFor(run.phase) + '</td>' +
        '<td class="mono">' + root.Format.fixed(run.testsPerFrame, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(run.pairsPerFrame, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(run.testsPerFrame / Math.max(run.pairsPerFrame, 1e-9), 1) + '</td>' +
        '<td class="mono">' + (first ? root.Format.fixed(later, 1) + ' (first ' + root.Format.exact(first) + ')' : '—') + '</td>' +
        '<td class="mono">' + root.Format.fixed(brute.testsPerFrame / Math.max(run.testsPerFrame, 1e-9), 1) + '×</td></tr>';
    }).join('');

    root.jQuery('#bp-compare tbody').html(html);
    root.jQuery('#bp-compare-note').text('The pairs-found column is identical for all three rows, which is the ' +
      'point of running them over the same scripted scene: the broad phase is allowed to propose extra pairs ' +
      'and never to miss one, so any difference there would be a bug rather than a trade. Raise the body count ' +
      'and watch the all-pairs row grow quadratically while the other two grow linearly.');
  }

  function paintTunnel(rows, current) {
    const html = rows.map(function (row) {
      const here = row.speed === current;
      return '<tr' + (here ? ' style="font-weight:600"' : '') + '>' +
        '<td class="mono">' + row.speed + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.travel, 2) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.diameters, 2) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.reported) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.missed) + '</td>' +
        '<td class="mono">' + root.Format.percent(row.rate, 2) + '</td></tr>';
    }).join('');

    root.jQuery('#bp-tunnel tbody').html(html);
    root.jQuery('#bp-tunnel-note').text('A contact is only counted as missed when neither this frame\'s nor ' +
      'the next frame\'s exact contact set contains it — a contact that begins mid-step and is still a contact ' +
      'at the next sample is one frame of latency, which every discrete engine has and no index changes. Read ' +
      'the diameters column rather than the speed one: the failure is negligible below about half a diameter ' +
      'of travel per step and dominant above one, whatever the units happen to be. Then change the time step ' +
      'and watch the whole table move.');
  }

  function drawChart(app, chosen, runs) {
    const stride = Math.max(1, Math.round(FRAMES / 60));
    chart = root.ErrorBandView.curve(root.jQuery('#bp-chart')[0], {
      lazyLib: app.lazyLib,
      height: 260,
      logY: true,
      legendHost: root.jQuery('#bp-chart-legend')[0],
      xLabel: 'frame',
      yLabel: 'per frame (log scale)',
      series: runs.map(function (run) {
        return {
          label: labelFor(run.phase) + ' — pairs tested',
          dashed: run.phase !== chosen.phase,
          width: run.phase === chosen.phase ? 3 : 1.5,
          points: run.frames.filter(function (frame, index) { return index % stride === 0; })
            .map(function (frame) { return { x: frame.frame, y: Math.max(frame.tests, 0.5) }; })
        };
      }).concat([{
        label: 'sweep and prune — sort swaps',
        points: runs.filter(function (run) { return run.phase === 'sap'; })[0].frames
          .filter(function (frame, index) { return index % stride === 0; })
          .map(function (frame) { return { x: frame.frame, y: Math.max(frame.swaps, 0.5) }; })
      }])
    });

    root.jQuery('#bp-chart-note').text('The swap curve is the temporal-coherence argument drawn: one spike on ' +
      'frame 0 where a random order is sorted from scratch, and a flat floor afterwards. Raise the speed and ' +
      'the floor rises with it, because the bodies really are changing order — which is the same parameter ' +
      'that breaks the sampling in the table below.');
  }

  function drawMap(app, run, radius) {
    const touching = new Set();
    root.BroadPhase.contactSet(run.bodies).forEach(function (key) {
      key.split(':').forEach(function (id) { touching.add(Number(id)); });
    });

    map = root.SpatialView.render(root.jQuery('#bp-map')[0], {
      height: 300,
      bounds: BOUNDS,
      points: run.bodies,
      results: run.bodies.filter(function (body) { return touching.has(body.id); }),
      pointRadius: Math.max(1.5, radius / 3),
      summary: root.Format.exact(run.bodies.length) + ' bodies at frame ' + FRAMES +
        ', with the ones in contact highlighted.'
    });

    root.jQuery('#bp-map-note').text('The scene at the last simulated frame. Highlighted bodies are in contact ' +
      'at this instant — ' + root.Format.exact(touching.size) + ' of ' + root.Format.exact(run.bodies.length) +
      '. The picture is a still: the interesting quantities are all per-frame counts, which is why the numbers ' +
      'rather than the drawing carry this section.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
