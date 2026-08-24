/**
 * Section: bin packing and resource allocation.
 *
 * The number production cares about is not the bin count. It is the capacity
 * that exists, is not used, and cannot be used because it is scattered across
 * bins in pieces smaller than anything waiting — which is why the demo reports
 * utilisation and stranded capacity next to the ratio.
 *
 * The second half is the one that explains a real operational puzzle. In one
 * dimension a bin fits an item or it does not; in two, a bin can be ninety per
 * cent full of CPU and empty of memory, and no job in the queue fits it. The
 * demo packs the same jobs both ways and counts the bins that are full on one
 * axis only. That count is what a cluster reporting sixty per cent utilisation
 * while rejecting work is actually made of.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'bin-packing';
  let panel = null;
  let chart = null;

  const ONLINE = {
    'next-fit': 'online, and it only ever looks at the last bin',
    'first-fit': 'online',
    'best-fit': 'online',
    'worst-fit': 'online',
    'first-fit-decreasing': 'OFFLINE — it sorts, so it needs every item first'
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — two dimensions, where one-dimensional intuition stops working',
      caption: 'In one dimension "does it fit" is one comparison and a bin with 30% free can ' +
        'take anything smaller than 30%. In two, a bin with 30% CPU free and 5% memory free ' +
        'takes only jobs that are small on BOTH axes, and a job that is 10% CPU and 20% memory ' +
        'does not fit despite being small. There is no ordering of two-dimensional items that ' +
        'plays the role "decreasing" plays in one — sort by CPU and the memory axis fragments, ' +
        'sort by the sum and both fragment a little — which is why the offline guarantee of ' +
        '11/9 does not survive the extra axis and why cluster schedulers use heuristics with no ' +
        'bound at all.',
      definition: [
        'flowchart LR',
        '    subgraph One["one dimension"]',
        '      A["bin: 70% used"] --> B{"item is 25%?"}',
        '      B -- "yes, 25 ≤ 30" --> C["it fits"]',
        '    end',
        '    subgraph Two["two dimensions"]',
        '      D["bin: 70% CPU, 95% memory"] --> E{"item is 10% CPU, 20% memory?"}',
        '      E -- "CPU fits" --> F["10 ≤ 30 ✓"]',
        '      E -- "memory does not" --> G["20 > 5 ✗"]',
        '      F --> H["rejected — both axes must fit"]',
        '      G --> H',
        '    end'
      ].join('\n')
    };
  }

  function orientation() {
    return [
      '**Bin packing is the shape of every placement problem: fixed-size machines, items of ' +
        'assorted sizes, how many machines.** VM placement, container scheduling, memory ' +
        'allocation and disk layout are all this problem with different words, and every one of ' +
        'them is ONLINE — items arrive and are placed before the next one is known.',
      '**Offline it is NP-hard and first-fit-decreasing is within 11/9 of optimal plus a ' +
        'constant.** Sort the items largest first and put each in the earliest bin that fits. ' +
        'The demo checks that bound against the EXACT optimum on instances small enough to solve ' +
        'exhaustively, rather than against the lower bound, because the two are different ' +
        'numbers.',
      '**Online, first-fit and best-fit are 1.7-competitive and no online algorithm beats about ' +
        '1.54.** The demo’s tight instance is Johnson’s family of sevenths, thirds and halves: ' +
        'one of each fills a bin, so the optimum is one bin per group, and first-fit — seeing ' +
        'the sevenths first — measures 1.6667 at every size while the sorted version is exactly ' +
        'optimal.',
      '**Next-fit is the cheap one and it is genuinely bad.** Looking only at the last opened bin ' +
        'makes each placement O(1) and costs 27% more bins on the demo’s workload. It is the ' +
        'right choice when the item stream is enormous and the bins are cheap, and the wrong one ' +
        'the rest of the time.',
      '**Utilisation and bin count are different numbers, and the second is not the one that ' +
        'hurts.** A packing can use 96% of the capacity it opened and still be one bin above ' +
        'optimal; another can use 78% and be twenty above. The demo reports both, plus the ' +
        'STRANDED capacity — free space in bins too small for anything left in the workload.',
      '**Fragmentation is the underlying phenomenon and it is what a cluster feels.** A cluster ' +
        'reporting 60% utilisation while rejecting jobs is not short of capacity, it is short of ' +
        'CONTIGUOUS capacity, and those are different quantities that a single utilisation ' +
        'number cannot distinguish.',
      '**Two dimensions are qualitatively harder, not merely bigger.** An item fits only when ' +
        'both axes fit, so a bin can be nearly full on CPU and empty on memory and be useless to ' +
        'everything in the queue. The demo counts those bins, and on anti-correlated jobs there ' +
        'are many of them.',
      '**And the offline advantage disappears with the second axis.** "Decreasing" has no ' +
        'meaning for a two-dimensional item — sort by CPU and memory fragments, sort by the sum ' +
        'and both fragment — so first-fit-decreasing stops beating the online policies. That is ' +
        'the measured reason real cluster schedulers use heuristics with no proved bound.'
    ];
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: orientation(),
      demo: {
        title: 'Interactive demo — five policies, the exact optimum, and the second axis',
        markup: root.BinPackingTemplate.render()
      },
      diagram: diagram(),
      insight: '**When a cluster reports spare capacity and rejects jobs, measure fragmentation ' +
        'rather than adding machines.** The question to ask is not "how much is free" but "how ' +
        'much is free in pieces large enough for what is queued", and on two axes at once. The ' +
        'three moves that actually help are all about shaping the input rather than improving ' +
        'the packer: standardise instance sizes so the pieces compose, admit large jobs before ' +
        'small ones so the awkward items are placed while there is room, and repack ' +
        'periodically if the workload tolerates migration. Adding machines to a fragmented ' +
        'cluster raises the utilisation number and does not raise the number of jobs that fit.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.BinPackingTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const packFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.OnlineLab.packingStudy({ count: Number(parts[0]), seed: Number(parts[1]) });
  });

  const exactFor = root.Helpers.memoise(function () {
    return root.OnlineLab.packingExactStudy({});
  });

  const trapFor = root.Helpers.memoise(function () {
    return root.OnlineLab.packingTrapStudy({});
  });

  const dimsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.OnlineLab.twoDimensionStudy({ count: Number(parts[0]), seed: Number(parts[1]),
      skew: Number(parts[2]) });
  });

  function update(app) {
    const values = panel.values();
    const pack = packFor(values['bpk-count'] + '|' + values['bpk-seed']);
    const dims = dimsFor(values['bpk-count'] + '|' + values['bpk-seed'] + '|' + values['bpk-skew']);

    paintMetrics(pack, exactFor(''), dims);
    paintChart(app, trapFor(''));
    paintPolicies(pack);
    paintExact(exactFor(''), trapFor(''));
    paintDims(dims);
  }

  function bestOf(study) {
    return study.rows.reduce(function (winner, row) {
      return row.bins < winner.bins ? row : winner;
    }, study.rows[0]);
  }

  function paintMetrics(pack, exact, dims) {
    const best = bestOf(pack);
    const lopsided = dims.twoDimensions.reduce(function (sum, row) {
      return sum + row.lopsided;
    }, 0);

    root.MetricGrid.update({
      'bpk-best': { value: root.Format.exact(best.bins) + ' bins',
        note: best.policy + ', at ' + root.Format.percent(best.utilisation, 1) + ' utilisation' },
      'bpk-bound': { value: root.Format.exact(pack.lowerBound),
        note: root.Format.fixed(pack.totalSize, 1) + ' of total size, so no packing can use fewer' },
      'bpk-ffd': { value: root.Format.fixed(exact.decreasingWorst, 4),
        note: 'over ' + root.Format.exact(exact.instances) + ' instances solved exactly; the ' +
          'bound is 11/9 = ' + root.Format.fixed(exact.bound, 4) },
      'bpk-lopsided': { value: root.Format.exact(lopsided),
        note: 'summed over the five policies, out of ' +
          root.Format.exact(dims.twoDimensions.reduce(function (sum, row) {
            return sum + row.bins;
          }, 0)) + ' bins' }
    });
  }

  function paintChart(app, trap) {
    const host = root.jQuery('#bpk-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.curve(host, {
      lazyLib: app.lazyLib, height: 240, yMin: 1,
      xLabel: 'groups of sevenths, thirds and halves', yLabel: 'bins used ÷ optimum',
      series: [
        { label: 'first-fit', points: trap.rows.map(function (row) {
          return { x: row.groups, y: row.firstFitRatio };
        }) },
        { label: 'first-fit-decreasing', points: trap.rows.map(function (row) {
          return { x: row.groups, y: row.decreasingRatio };
        }) },
        { label: 'the online bound, 1.7', dashed: true, points: trap.rows.map(function (row) {
          return { x: row.groups, y: 1.7 };
        }) },
        { label: 'the offline bound, 11/9', dashed: true, points: trap.rows.map(function (row) {
          return { x: row.groups, y: 11 / 9 };
        }) }
      ]
    });

    const last = trap.rows[trap.rows.length - 1];
    root.Helpers.setText('bpk-chart-note',
      'The instance is built so that one seventh, one third and one half fit in a bin together ' +
      '— they sum to 0.977 — and every bin holds exactly one half, so the optimum is one bin ' +
      'per group and cannot be beaten. First-fit, seeing the items in that order, puts six ' +
      'sevenths in a bin, then two thirds in a bin, and the halves then have nowhere to go: at ' +
      root.Format.exact(last.groups) + ' groups it uses ' + root.Format.exact(last.firstFit) +
      ' bins against an optimum of ' + root.Format.exact(last.optimum) + ', a ratio of ' +
      root.Format.fixed(last.firstFitRatio, 4) + '. Sorting the identical items largest first ' +
      'brings it to ' + root.Format.fixed(last.decreasingRatio, 4) + ' — exactly optimal, on ' +
      'the same items in a different order. The epsilon direction matters and is easy to get ' +
      'wrong: nudge SIXTHS up instead and one of each no longer fits, so the stated optimum is ' +
      'unreachable and every ratio in this chart would be measured against a number no packing ' +
      'attains.');
  }

  function paintPolicies(study) {
    root.jQuery('#bpk-policies tbody').html(study.rows.map(function (row) {
      return '<tr><td class="mono">' + row.policy + '</td><td class="mono">' +
        root.Format.exact(row.bins) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 4) + '</td><td class="mono">' +
        root.Format.percent(row.utilisation, 1) + '</td><td class="mono">' +
        root.Format.fixed(row.wasted, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.stranded, 2) + '</td><td>' + (ONLINE[row.policy] || '') +
        '</td></tr>';
    }).join(''));

    const next = study.rows[0];
    const best = bestOf(study);
    root.Helpers.setText('bpk-policies-note',
      'The lower bound of ' + root.Format.exact(study.lowerBound) + ' bins ignores ' +
      'indivisibility entirely — it is the total size divided by the capacity — so it is a floor ' +
      'and never an achievable answer. Next-fit uses ' + root.Format.exact(next.bins) + ' bins ' +
      'against the best policy’s ' + root.Format.exact(best.bins) + ', which is ' +
      root.Format.percent(next.bins / best.bins - 1, 1) + ' more machines for a placement rule ' +
      'that is one comparison instead of a scan. The last two columns are where the difference ' +
      'lives: wasted capacity is what was opened and not used, and stranded capacity is the part ' +
      'of it that no remaining item could have taken — the second number is the one an operator ' +
      'feels, and it is not proportional to the first.');
  }

  function paintExact(exact, trap) {
    const rows = [
      { label: 'first-fit (online) against the exact optimum', worst: exact.firstFitWorst,
        bound: 1.7, instances: exact.instances },
      { label: 'first-fit-decreasing (offline) against the exact optimum',
        worst: exact.decreasingWorst, bound: exact.bound, instances: exact.instances }
    ].concat(trap.rows.slice(-1).map(function (row) {
      return { label: 'first-fit on the tight family at ' + row.groups + ' groups',
        worst: row.firstFitRatio, bound: 1.7, instances: 1 };
    }));

    root.jQuery('#bpk-exact tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.label + '</td><td class="mono">' +
        root.Format.fixed(row.worst, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.bound, 4) + '</td><td class="mono">' +
        (row.worst <= row.bound + 1e-9 ? 'yes' : 'NO') + '</td><td class="mono">' +
        root.Format.exact(row.instances) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('bpk-exact-note',
      'The exact optimum here comes from a branch-and-bound search over every assignment, which ' +
      'is why the instances are twelve items rather than two hundred: bin packing is NP-hard and ' +
      'the reference costs more than everything else in the section put together. That is the ' +
      'trade a measured guarantee makes — a bound checked against a lower bound is checked ' +
      'against something no packing can reach, so it always looks satisfied and proves nothing.');
  }

  function paintDims(study) {
    const byPolicy = new Map(study.oneDimension.map(function (row) { return [row.policy, row]; }));

    root.jQuery('#bpk-dims tbody').html(study.twoDimensions.map(function (row) {
      const one = byPolicy.get(row.policy);
      return '<tr><td class="mono">' + row.policy + '</td><td class="mono">' +
        root.Format.exact(one.bins) + '</td><td class="mono">' +
        root.Format.fixed(one.ratio, 4) + '</td><td class="mono">' +
        root.Format.exact(row.bins) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 4) + '</td><td class="mono">' +
        root.Format.percent(row.cpuUtilisation, 1) + '</td><td class="mono">' +
        root.Format.percent(row.memUtilisation, 1) + '</td><td class="mono">' +
        root.Format.exact(row.lopsided) + '</td></tr>';
    }).join(''));

    const oneBest = study.oneDimension.reduce(function (w, r) {
      return r.ratio < w.ratio ? r : w;
    }, study.oneDimension[0]);
    const twoBest = study.twoDimensions.reduce(function (w, r) {
      return r.ratio < w.ratio ? r : w;
    }, study.twoDimensions[0]);
    root.Helpers.setText('bpk-dims-note',
      'The same ' + root.Format.exact(study.jobs) + ' jobs, packed by the larger of their two ' +
      'demands in the first columns and by both demands in the second. The best one-dimensional ' +
      'ratio is ' + root.Format.fixed(oneBest.ratio, 4) + ' (' + oneBest.policy + ') and the ' +
      'best two-dimensional one is ' + root.Format.fixed(twoBest.ratio, 4) + ' (' +
      twoBest.policy + '). Notice which policy wins each: sorting decreasing is the clear ' +
      'winner on one axis and loses its advantage on two, because there is no ordering that is ' +
      '"decreasing" in both. The last column counts bins with room on one axis and none on the ' +
      'other, and each of those is capacity that will be reported as free and cannot be used.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
