/**
 * Section: meet in the middle and bidirectional search.
 *
 * The comparison table only runs brute force where brute force can finish -
 * up to n = 22 - and the projection table covers the rest with a measured
 * extrapolation rather than the word "infeasible". Both are on the page,
 * because the interesting claim is about n = 40 and the verification is only
 * possible at n = 22.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'meet-in-the-middle';
  const BRUTE_LIMIT = 22;
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — two frontiers meeting',
      caption: 'One search of radius d costs b^d. Two searches of radius d/2 cost 2·b^(d/2), and the answer ' +
        'is the first node both have reached. The meeting test has to run as each node is generated, not ' +
        'after the level finishes, or odd-length paths come back one edge too long.',
      definition: [
        'flowchart LR',
        '    S["start"] --> F1["frontier at depth 1"]',
        '    F1 --> F2["frontier at depth d/2"]',
        '    F2 --> M["a node both sides have seen"]',
        '    B2["frontier at depth d/2"] --> M',
        '    B1["frontier at depth 1"] --> B2',
        '    T["goal"] --> B1',
        '    M --> A["distance = depth from start + depth from goal"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Subset sum over n items is 2^n states.** Split the items into two halves, enumerate ' +
          'each half separately, sort one side, and binary-search it once for every element of ' +
          'the other. The cost becomes 2^(n/2) · n, which at n = 40 is about a million states ' +
          'instead of a trillion.',
        'Nothing clever happened to the problem. The technique is entirely a change of shape, and ' +
          'it is the clearest example in this milestone of an asymptotic win with no insight into ' +
          'the domain at all.',
        'The price is memory. Both halves have to be materialised, so the peak is 2 · 2^(n/2) ' +
          'partial sums. That is the reason the technique tops out somewhere near n = 50 whatever ' +
          'the machine.',
        'The demo reports that number beside the state count rather than only the speedup, ' +
          'because the trade is the technique: halving the exponent in time costs an exponential ' +
          'in space.',
        'Bidirectional search is the same idea on a graph. A breadth-first search to depth d ' +
          'touches b^d nodes, and two searches of depth d/2 touch 2·b^(d/2). On a branching ' +
          'factor of 3 at depth 8 that is 3 281 states against 22.',
        'The subtlety is the meeting test. A node has to be checked against the other side\'s ' +
          'visited set at the moment it is generated. Checking after the level completes returns ' +
          'a distance one too large whenever the true path has odd length.'
      ],
      demo: {
        title: 'Interactive demo — halved exponents, and what they cost in memory',
        markup: root.MeetInTheMiddleTemplate.render()
      },
      diagram: diagram(),
      insight: 'The technique is worth knowing mostly as a reflex. When an exponential search ' +
        'is exactly twice too big, ask whether the state splits into two independent halves that ' +
        'can be recombined by a search rather than by enumeration. That question also has a ' +
        'negative answer worth recognising. If the halves interact, there is nothing to sort and ' +
        'nothing to look up, and the split buys nothing. Subset sum splits because the total is ' +
        'a sum. A problem whose halves constrain each other, like graph colouring across the ' +
        'cut, does not.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MeetInTheMiddleTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const instanceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[1]);
    const values = [];
    for (let i = 0; i < parts[0]; i += 1) values.push(1 + random.int(5000));
    const total = values.reduce(function (a, b) { return a + b; }, 0);
    return { values: values, target: Math.round(total / 2), total: total };
  });

  const midFor = root.Helpers.memoise(function (key) {
    const instance = instanceFor(key);
    return root.MeetInMiddle.closestSubsetSum(instance.values, instance.target, {});
  });

  const bruteFor = root.Helpers.memoise(function (key) {
    const instance = instanceFor(key);
    return root.MeetInMiddle.closestSubsetSumBruteForce(instance.values, instance.target,
      { maxItems: BRUTE_LIMIT });
  });

  const graphFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const built = root.MeetInMiddle.regularGraph(parts[0], parts[1]);
    return {
      built: built,
      plain: root.MeetInMiddle.breadthFirst(built.graph, 0, built.deepest),
      bidi: root.MeetInMiddle.bidirectional(built.graph, 0, built.deepest)
    };
  });

  function update() {
    const values = panel.values();
    const key = values['mim-items'] + '|' + values['mim-seed'];
    const run = midFor(key);

    paintMetrics(values, run);
    paintHalves(values, run);
    paintCompare(values);
    paintProjection(values);
    paintBidirectional(values);
  }

  function paintMetrics(values, run) {
    const n = Number(values['mim-items']);
    const full = Math.pow(2, n);
    root.MetricGrid.update({
      'mim-states': {
        value: root.Format.exact(run.report.statesGenerated),
        note: '2 × 2^' + Math.floor(n / 2) + ', plus ' + root.Format.exact(run.report.probes) + ' binary-search probes'
      },
      'mim-brute': {
        value: full > 1e15 ? full.toExponential(2) : root.Format.exact(full),
        note: '2^' + n + ' subsets'
      },
      'mim-saving': {
        value: root.Format.exact(Math.round(full / Math.max(1, run.report.statesGenerated))) + '×',
        note: 'fewer states, for the same answer'
      },
      'mim-memory': {
        value: root.Format.exact(run.report.peakMemory),
        note: 'partial sums resident at once — the price of the halving'
      }
    });
  }

  function paintHalves(values, run) {
    const instance = instanceFor(values['mim-items'] + '|' + values['mim-seed']);
    const n = instance.values.length;
    const half = Math.floor(n / 2);
    const left = instance.values.slice(0, half);
    const right = instance.values.slice(half);

    const rows = [
      { label: 'left half', items: left },
      { label: 'right half', items: right }
    ];

    const html = rows.map(function (row) {
      const total = row.items.reduce(function (a, b) { return a + b; }, 0);
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + row.items.length + '</td>' +
        '<td class="mono">' + root.Format.exact(Math.pow(2, row.items.length)) + '</td>' +
        '<td class="mono">0</td>' +
        '<td class="mono">' + root.Format.exact(total) + '</td></tr>';
    }).join('');

    root.jQuery('#mim-halves tbody').html(html);
    root.jQuery('#mim-halves-note').text('The target is ' + root.Format.exact(instance.target) +
      ', half of the total. Each left-half sum is looked up once in the sorted right-half list for the ' +
      'largest partner that still fits, which is ' + root.Format.exact(run.report.probes) +
      ' binary-search probes in total. The best achievable sum is ' + root.Format.exact(run.sum) +
      ', using ' + root.Format.exact(run.chosen.length) + ' of the ' + root.Format.exact(n) + ' items.');
  }

  function paintCompare(values) {
    const seed = values['mim-seed'];
    const sizes = [12, 16, 20, 22];
    const html = sizes.map(function (n) {
      const key = n + '|' + seed;
      const mid = midFor(key);
      const brute = bruteFor(key);
      return '<tr><td class="mono">' + n + '</td>' +
        '<td class="mono">' + root.Format.exact(mid.report.statesGenerated) + '</td>' +
        '<td class="mono">' + root.Format.exact(brute.report.statesGenerated) + '</td>' +
        '<td class="mono">' + root.Format.fixed(brute.report.statesGenerated /
          Math.max(1, mid.report.statesGenerated), 1) + '×</td>' +
        '<td class="mono">' + root.Format.exact(mid.sum) + '</td>' +
        '<td class="mono">' + (mid.sum === brute.sum ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#mim-compare tbody').html(html);
    root.jQuery('#mim-compare-note').text('Brute force is run only up to n = ' + BRUTE_LIMIT +
      ', which is where it still finishes in a browser. That is exactly the point of the table: the ' +
      'technique is verified where verification is possible, and the last column is the only reason to ' +
      'trust the rows further down the page where it is not. The ratio grows as 2^(n/2), so it doubles for ' +
      'every two items added.');
  }

  function paintProjection(values) {
    const seed = values['mim-seed'];
    const html = [30, 40, Number(values['mim-items'])].map(function (n) {
      const projection = root.MeetInMiddle.projectedBruteForce(n, { sampleSize: 18 });
      const mid = midFor(n + '|' + seed);
      const years = projection.projectedYears;
      const time = years > 1 ? root.Format.fixed(years, 1) + ' years'
        : root.Format.fixed(projection.projectedMs / 1000, 1) + ' seconds';
      return '<tr><td class="mono">' + n + '</td>' +
        '<td class="mono">' + projection.states.toExponential(2) + '</td>' +
        '<td class="mono">' + time + '</td>' +
        '<td class="mono">' + root.Format.exact(mid.report.statesGenerated) + '</td></tr>';
    }).join('');

    root.jQuery('#mim-projection tbody').html(html);
    root.jQuery('#mim-projection-note').text('The projected time is measured, not guessed: an 18-item ' +
      'exhaustive search is timed in this page and extrapolated by doubling. "Infeasible" is not a number ' +
      'and does not belong in a table — the whole argument for the technique is a comparison, and a ' +
      'comparison needs two figures. The right-hand column is what the same instance costs when the ' +
      'exponent is halved.');
  }

  function paintBidirectional(values) {
    const run = graphFor(values['mim-branch'] + '|' + values['mim-depth']);
    const b = Number(values['mim-branch']);
    const d = Number(values['mim-depth']);

    const rows = [
      { label: 'breadth-first from the start', result: run.plain, prediction: Math.pow(b, d) },
      { label: 'bidirectional', result: run.bidi, prediction: 2 * Math.pow(b, d / 2) }
    ];

    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.result.report.statesGenerated) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.result.report.peakMemory) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.result.distance) + '</td>' +
        '<td class="mono">' + root.Format.exact(Math.round(row.prediction)) + '</td></tr>';
    }).join('');

    root.jQuery('#mim-bidi tbody').html(html);
    root.jQuery('#mim-bidi-note').text('Both rows return distance ' + root.Format.exact(run.bidi.distance) +
      ', which is the check that the meeting test is right — a bidirectional search that tests too late ' +
      'reports one more. The tree here is regular, so the b^d and 2·b^(d/2) predictions are exact rather ' +
      'than asymptotic, and the measurement sits below the forward prediction because the search stops the ' +
      'moment it reaches the goal rather than completing the level.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
