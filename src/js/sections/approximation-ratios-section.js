/**
 * Section: approximation-ratios.
 *
 * The measurement that decides how this section is written: on two hundred
 * random graphs, the algorithm with a proven ratio of 2 measures a mean of
 * 1.52 and attains exactly 2.00 on its worst instance, and the algorithm with
 * NO bound at all - repeatedly take the highest-degree vertex - measures a
 * mean of 1.03 and never exceeds 1.29.
 *
 * On random inputs the unprovable algorithm wins comfortably. The trap table
 * then builds the family where it loses by a factor that grows like ln k,
 * measured at 3.82 for k = 100 while the matching algorithm stays at 1.98.
 * Both facts are true at once and the section refuses to pick one: the ratio
 * is a promise about the input you have not seen, and the distribution is a
 * description of the inputs you have.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'approximation-ratios';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — why doubling a spanning tree bounds the travelling salesman',
      caption: 'The argument is three inequalities and no algorithm. Deleting one edge from an ' +
        'optimal tour leaves a spanning path, which is a spanning tree, so MST ≤ OPT. Doubling ' +
        'every tree edge gives a graph where every vertex has even degree, so an Eulerian circuit ' +
        'exists and costs 2·MST. Walking that circuit and skipping vertices already visited can ' +
        'only shorten it, by the triangle inequality — so the tour is at most 2·MST ≤ 2·OPT. ' +
        'Every step needs the metric assumption, and without it no constant-factor ' +
        'approximation exists at all unless P = NP.',
      definition: [
        'flowchart TD',
        '    A["optimal tour, cost OPT"] -- "delete one edge" --> B["a spanning path<br/>cost <= OPT"]',
        '    B -- "a path is a tree" --> C["MST <= OPT"]',
        '    C -- "double every edge" --> D["all degrees even<br/>cost 2 * MST"]',
        '    D -- "Euler circuit" --> E["a walk visiting every vertex<br/>cost 2 * MST"]',
        '    E -- "skip repeats" --> F["a tour<br/>cost <= 2 * MST <= 2 * OPT"]',
        '    E -.- G["triangle inequality:<br/>shortcutting never lengthens"]',
        '    D -.- H["Christofides: match the ODD<br/>vertices instead, cost <= OPT/2"]',
        '    H --> I["tour <= 1.5 * OPT"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**A ratio is what separates an approximation algorithm from a heuristic.** For a ' +
          'minimisation problem, a ρ-approximation returns a solution of cost at most ρ times ' +
          'the optimum on EVERY input; for maximisation, at least 1/ρ of it. Without that ' +
          'quantifier there is no statement, and a heuristic can be arbitrarily bad on an input ' +
          'you have not tried. The demo measures every ratio against an exact optimum computed by ' +
          'enumeration, so nothing on this page is assumed.',
        '**The 2-approximation for vertex cover looks wasteful and is the one you can defend.** ' +
          'Take a maximal matching and keep BOTH endpoints of every matched edge. Any cover must ' +
          'take at least one endpoint per matched edge, so the matching size is a lower bound on ' +
          'the optimum and the answer is at most twice it — a certificate that proves the ratio ' +
          'for the instance in hand without knowing the optimum at all.',
        '**The clever-looking alternative has no constant ratio.** Repeatedly taking the ' +
          'highest-degree vertex is the first improvement everyone proposes, and it is Θ(log n) ' +
          'away from optimal on a constructible family. On random graphs it beats the matching ' +
          'algorithm handsomely; on the trap it does not. Both measurements are in the demo, and ' +
          'neither one alone is the answer.',
        '**Greedy set cover is ln n and that bound is attained, not approached.** Repeatedly take ' +
          'the set with the best coverage per unit cost; the cost is at most H(n) times the ' +
          'optimum. The demo builds Vazirani’s instance where greedy pays exactly H(n) — 5.43 ' +
          'against an optimum of 1.01 at n = 128 — and shows the same algorithm within a few ' +
          'percent of optimal on random instances.',
        '**Metric TSP is where the bound comes from a lower bound rather than the algorithm.** ' +
          'MST ≤ OPT because deleting a tour edge leaves a spanning tree; doubling gives a walk ' +
          'of 2·MST; shortcutting cannot lengthen it under the triangle inequality. Christofides ' +
          'replaces the doubling with a minimum-weight perfect matching on the odd-degree ' +
          'vertices, which costs at most OPT/2, and gets 3/2 — the best ratio known for metric ' +
          'TSP for forty-five years.'
      ],
      demo: {
        title: 'Interactive demo — ratio distributions against exact optima, and the tight instances',
        markup: root.ApproximationRatiosTemplate.render()
      },
      diagram: diagram(),
      insight: '**The ratio is a worst case and the distribution is what you will see, and ' +
        'shipping decisions need both.** The demo makes the point twice over. Greedy set cover ' +
        'has a ln n bound and measures 1.23 on random instances; highest-degree vertex cover has ' +
        'no bound and measures 1.03. If you only know the bounds you will write an exact solver ' +
        'you did not need; if you only know the measurements you will ship something that fails ' +
        'on the one input that matters. **The professional position is to use the algorithm with ' +
        'the guarantee, know its measured distribution, and keep the exact solver for instances ' +
        'small enough to afford it** — which, as the enumeration counts in this demo show, is a ' +
        'smaller set than people expect.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.ApproximationRatiosTemplate.controls,
      onChange: function () { update(app); }
    });
    update(app);
  }

  /* ------------------------------------------------------------ measuring */

  const coverFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    return root.ApproxLab.coverStudy({ n: Number(parts[0]), density: Number(parts[1]),
      instances: Number(parts[2]) });
  });

  const setCoverFor = root.Helpers.memoise(function () {
    return root.ApproxLab.setCoverStudy({ instances: 120 });
  });

  const tspFor = root.Helpers.memoise(function () {
    return root.ApproxLab.tspStudy({ instances: 60, cities: 10 });
  });

  const otherFor = root.Helpers.memoise(function () {
    return root.ApproxLab.otherRatios({ points: 16, machines: 4 });
  });

  const trapFor = root.Helpers.memoise(function (key) {
    const top = Number(key);
    const sizes = [20, 40, 60, 80, 100, 120, 140, 160, 180, 200].filter(function (k) {
      return k <= top;
    });
    return sizes.map(function (k) {
      const instance = root.Approximation.degreeTrapInstance(k);
      const matching = root.Approximation.vertexCoverMatching(instance.graph);
      const degree = root.Approximation.vertexCoverGreedyDegree(instance.graph);
      return { k: k, vertices: instance.graph.n, optimum: instance.optimum,
        matching: matching.size, degree: degree.size, ratio: degree.size / instance.optimum,
        matchingRatio: matching.size / instance.optimum };
    });
  });

  function update(app) {
    const values = panel.values();
    const cover = coverFor(values['arx-n'] + '|' + values['arx-density'] + '|' +
      values['arx-instances']);
    const setCover = setCoverFor('');
    const tsp = tspFor('');
    const other = otherFor('');
    const trap = trapFor(values['arx-trap']);

    paintMetrics(cover, tsp, setCover);
    paintChart(app, cover);
    paintCover(cover);
    paintTrap(trap);
    paintSetCover(setCover);
    paintTsp(tsp);
    paintOther(other, setCover);
  }

  function methodRow(cover, name) {
    for (let i = 0; i < cover.summary.length; i += 1) {
      if (cover.summary[i].method === name) return cover.summary[i];
    }
    return cover.summary[0];
  }

  function paintMetrics(cover, tsp, setCover) {
    const matching = methodRow(cover, 'maximal matching');
    const degree = methodRow(cover, 'highest degree');
    const tight = setCover.tight[setCover.tight.length - 1];
    root.MetricGrid.update({
      'arx-matching': { value: root.Format.fixed(matching.mean, 3),
        note: 'worst ' + root.Format.fixed(matching.max, 3) + ' over ' +
          root.Format.exact(cover.instances) + ' instances, proven bound 2' },
      'arx-degree': { value: root.Format.fixed(degree.mean, 3),
        note: 'worst ' + root.Format.fixed(degree.max, 3) + ' here, and unbounded in general' },
      'arx-tour': { value: root.Format.fixed(tsp.christofides.mean, 4),
        note: 'worst ' + root.Format.fixed(tsp.christofides.max, 4) + ', proven bound 1.5' },
      'arx-tight': { value: root.Format.fixed(tight.ratio, 3),
        note: 'at n = ' + root.Format.exact(tight.n) + ', where H(n) = ' +
          root.Format.fixed(tight.harmonic, 3) }
    });
  }

  function paintChart(app, cover) {
    const host = root.jQuery('#arx-chart')[0];
    if (!host) return;
    if (chart) chart.destroy();

    chart = root.ErrorBandView.bars(host, {
      lazyLib: app.lazyLib, height: 250,
      xLabel: 'algorithm', yLabel: 'ratio to the exact optimum',
      values: cover.summary.filter(function (entry) {
        return entry.method !== 'LP relaxation';
      }).reduce(function (out, entry, index) {
        out.push({ label: shortName(entry.method) + ' mean', value: entry.mean, series: index });
        out.push({ label: shortName(entry.method) + ' worst', value: entry.max, series: index });
        return out;
      }, [])
    });

    root.Helpers.setText('arx-chart-note',
      'Each algorithm appears twice: its mean over the instance set and its worst single ' +
      'instance. The pairs are what the section is about — the mean is what you will experience ' +
      'and the worst is what you can be held to. Every one of these is a ratio against an exact ' +
      'optimum found by enumeration, not against another approximation.');
  }

  function shortName(method) {
    if (method === 'maximal matching') return 'matching';
    if (method === 'highest degree') return 'degree';
    if (method === 'LP + rounding') return 'LP round';
    return method;
  }

  function paintCover(cover) {
    root.jQuery('#arx-cover tbody').html(cover.summary.map(function (entry) {
      const bound = boundFor(entry.method);
      return '<tr><td>' + entry.method + '</td><td class="mono">' + bound + '</td><td class="mono">' +
        root.Format.fixed(entry.mean, 4) + '</td><td class="mono">' +
        root.Format.fixed(entry.median, 4) + '</td><td class="mono">' +
        root.Format.fixed(entry.max, 4) + '</td><td class="mono">' +
        root.Format.exact(entry.violations) + '</td><td class="mono">' +
        root.Format.exact(entry.invalid) + '</td></tr>';
    }).join(''));

    const matching = methodRow(cover, 'maximal matching');
    const degree = methodRow(cover, 'highest degree');
    const relaxation = methodRow(cover, 'LP relaxation');
    root.Helpers.setText('arx-cover-note',
      'The last two columns are the ones that make the table trustworthy. Not one of ' +
      root.Format.exact(cover.instances) + ' answers violated its bound, and not one was ' +
      'infeasible — a cover that misses an edge is smaller than a valid one and would flatter ' +
      'the ratio column, so feasibility is checked separately rather than inferred from the ' +
      'cost. Now read the first two rows against each other: the matching algorithm has the ' +
      'proof and measures ' + root.Format.fixed(matching.mean, 3) + ' with a worst case of ' +
      'exactly ' + root.Format.fixed(matching.max, 2) + ', and highest-degree greedy has no ' +
      'bound and measures ' + root.Format.fixed(degree.mean, 3) + '. The last row is not an ' +
      'algorithm at all: the LP relaxation is a lower bound, so its ratio is below 1 by ' +
      'construction — ' + root.Format.fixed(relaxation.mean, 3) + ' on average — and it is in ' +
      'the table because 19.7 turns it into one.');
  }

  function boundFor(method) {
    if (method === 'highest degree') return 'none';
    if (method === 'LP relaxation') return 'a lower bound';
    return '2';
  }

  function paintTrap(trap) {
    root.jQuery('#arx-trap-table tbody').html(trap.map(function (row) {
      return '<tr><td class="mono">' + row.k + '</td><td class="mono">' +
        root.Format.exact(row.vertices) + '</td><td class="mono">' +
        root.Format.exact(row.optimum) + '</td><td class="mono">' +
        root.Format.exact(row.matching) + ' (' + root.Format.fixed(row.matchingRatio, 2) + '×)' +
        '</td><td class="mono">' + root.Format.exact(row.degree) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 2) + '×</td></tr>';
    }).join(''));

    const last = trap[trap.length - 1];
    root.Helpers.setText('arx-trap-note',
      'A left side of k vertices, and for each i a group of right vertices each joined to i of ' +
      'them. The left side is a cover of size k and it is minimum, by König’s theorem — so the ' +
      'optimum column is exact rather than approximated. Greedy takes every right vertex ' +
      'instead, because each group’s degree exceeds any left vertex’s at the moment it is ' +
      'considered, and its ratio grows like H(k) − 1: ' + root.Format.fixed(last.ratio, 2) +
      '× at k = ' + root.Format.exact(last.k) + ' while the matching algorithm holds at ' +
      root.Format.fixed(last.matchingRatio, 2) + '×. The two curves cross somewhere around ' +
      'k = 20, and nothing about a random graph would ever tell you that.');
  }

  function paintSetCover(setCover) {
    root.jQuery('#arx-setcover tbody').html(setCover.tight.map(function (row) {
      return '<tr><td class="mono">' + root.Format.exact(row.n) + '</td><td class="mono">' +
        root.Format.fixed(row.greedy, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.optimum, 2) + '</td><td class="mono">' +
        root.Format.fixed(row.ratio, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.harmonic, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.naturalLog, 4) + '</td></tr>';
    }).join(''));

    const last = setCover.tight[setCover.tight.length - 1];
    root.Helpers.setText('arx-setcover-note',
      'The greedy column and the H(n) column are the same number to every digit shown, which is ' +
      'what "the bound is tight" means when it is demonstrated rather than asserted. The ' +
      'instance is Vazirani’s: singleton sets priced at 1/(n − i) so that the cheapest remaining ' +
      'one always beats the whole universe on coverage-per-cost by a hair, and greedy pays ' +
      '1/n + 1/(n−1) + … + 1 for an optimum of ' + root.Format.fixed(last.optimum, 2) +
      '. On the ' + root.Format.exact(setCover.summary.count) + ' random instances the same ' +
      'algorithm measures a mean of ' + root.Format.fixed(setCover.summary.mean, 3) +
      ' and a worst of ' + root.Format.fixed(setCover.summary.max, 3) + '. Somebody had to ' +
      'build the bad case; it does not turn up by accident.');
  }

  function paintTsp(tsp) {
    const rows = [
      { method: 'MST (a lower bound, not a tour)', bound: '≤ 1', spread: tsp.lowerBound },
      { method: 'double the tree, shortcut', bound: '2', spread: tsp.doubled },
      { method: 'Christofides', bound: '1.5', spread: tsp.christofides }
    ];
    root.jQuery('#arx-tsp-table tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.method + '</td><td class="mono">' + row.bound +
        '</td><td class="mono">' + root.Format.fixed(row.spread.mean, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.spread.median, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.spread.max, 4) + '</td><td class="mono">' +
        root.Format.fixed(row.spread.min, 4) + '</td></tr>';
    }).join(''));

    root.Helpers.setText('arx-tsp-note',
      'Every tour here is scored against Held–Karp, which is exact and costs 2ⁿn² — which is ' +
      'why the instances have ' + root.Format.exact(tsp.cities) + ' cities. The first row is ' +
      'the lower bound the whole argument rests on: the minimum spanning tree averages ' +
      root.Format.percent(tsp.lowerBound.mean, 1) + ' of the optimal tour, and the doubling ' +
      'argument turns that into a factor-2 guarantee. Both algorithms measure far inside their ' +
      'bounds — ' + root.Format.fixed(tsp.doubled.mean, 3) + ' and ' +
      root.Format.fixed(tsp.christofides.mean, 3) + ' — and Christofides wins on the mean, the ' +
      'median and the worst case, for the cost of one perfect matching on the odd-degree ' +
      'vertices.');
  }

  function paintOther(other, setCover) {
    const rows = other.centres.map(function (row) {
      return { problem: 'k-centre, k = ' + row.k, algorithm: 'farthest-first traversal',
        bound: '2', measured: root.Format.fixed(row.ratio, 4) + '×',
        note: 'exact optimum from ' + root.Format.exact(row.examined) + ' choices of centres' };
    });
    rows.push({ problem: 'load balancing', algorithm: 'list scheduling',
      bound: root.Format.fixed(2 - 1 / other.scheduling.machines, 3),
      measured: root.Format.fixed(other.scheduling.plain.mean, 4) + '× mean, ' +
        root.Format.fixed(other.scheduling.plain.max, 4) + '× worst',
      note: 'on the tight instance it reaches exactly ' +
        root.Format.fixed(other.scheduling.trap.plain / other.scheduling.trap.optimum, 3) + '×' });
    rows.push({ problem: 'load balancing', algorithm: 'longest-processing-time first',
      bound: root.Format.fixed(4 / 3 - 1 / (3 * other.scheduling.machines), 3),
      measured: root.Format.fixed(other.scheduling.lpt.mean, 4) + '× mean, ' +
        root.Format.fixed(other.scheduling.lpt.max, 4) + '× worst',
      note: 'the same algorithm plus a sort, and it solves the tight instance exactly' });
    rows.push({ problem: 'set cover', algorithm: 'greedy, random instances',
      bound: 'H(largest set)', measured: root.Format.fixed(setCover.summary.mean, 4) + '× mean, ' +
        root.Format.fixed(setCover.summary.max, 4) + '× worst',
      note: 'against exact optima from subset enumeration' });

    root.jQuery('#arx-other tbody').html(rows.map(function (row) {
      return '<tr><td>' + row.problem + '</td><td>' + row.algorithm + '</td><td class="mono">' +
        row.bound + '</td><td class="mono">' + row.measured + '</td><td>' + row.note + '</td></tr>';
    }).join(''));

    root.Helpers.setText('arx-other-note',
      'The scheduling pair is the cheapest lesson in the milestone. List scheduling assigns each ' +
      'job to the least-loaded machine and is 2 − 1/m; sorting the jobs longest-first before ' +
      'doing exactly the same thing improves the bound to 4/3 − 1/(3m) and the measured mean ' +
      'from ' + root.Format.fixed(other.scheduling.plain.mean, 3) + ' to ' +
      root.Format.fixed(other.scheduling.lpt.mean, 3) + '. The tight instance for the ' +
      'unsorted version is m(m−1) unit jobs followed by one job of length m — the long job ' +
      'arrives last and there is nowhere good left to put it — and LPT solves it exactly, ' +
      'because sorting is precisely the fix for that failure.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
