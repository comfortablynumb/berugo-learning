/**
 * Section: matroids — when greedy is provably right.
 *
 * The checker enumerates every subset of the ground set, so the sizes here are
 * small and the oracle-call count is on the page. That is not a limitation to
 * apologise for: this is the tool you reach for once, on a ten-element model of
 * your problem, to settle whether the greedy rule someone proposed is a theorem
 * or a hope.
 *
 * Two of the five systems are deliberately not matroids, and the matching one
 * carries an instance where the generic greedy algorithm actually loses - the
 * three-edge path with weights 2, 3, 2, where taking the heaviest edge first
 * costs the two lighter ones.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'matroids';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the exchange property',
      caption: 'If A is independent, B is independent and B is larger, some element of B outside A can join A ' +
        'and keep it independent. That single property is what stops greedy from painting itself into a ' +
        'corner, and it is what fails for matchings.',
      definition: [
        'flowchart LR',
        '    A["A independent, |A| = 2"] --> Q{"is there x in B \\\\ A with A + x independent?"}',
        '    B["B independent, |B| = 3"] --> Q',
        '    Q -->|yes, always| M["matroid — greedy is optimal for every weighting"]',
        '    Q -->|no, for some pair| N["not a matroid — a weighting exists that defeats greedy"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'The previous section left a question open: how do you know a greedy rule is right, rather than right ' +
          'on the instances you tried? For a large class of problems there is an exact answer. If the feasible ' +
          'sets form a *matroid*, the generic greedy algorithm finds the maximum-weight one for every ' +
          'weighting; if they do not, some weighting defeats it. That is the Rado-Edmonds theorem, and it is ' +
          'an if-and-only-if, which is what makes it usable in both directions.',
        'A matroid needs two properties. Hereditary: every subset of an independent set is independent. ' +
          'Exchange: if A and B are independent and B is larger, some element of B can be moved into A ' +
          'keeping it independent. Acyclic edge sets satisfy both - which is why Kruskal works - and so do ' +
          '"at most k elements" and "a quota per group". Matchings satisfy the first and fail the second on ' +
          'four elements, and the demo exhibits that failing pair.',
        'The checker below enumerates the 2^n subsets, asks the oracle about each, and then searches for a ' +
          'violating pair. It returns the witness rather than a verdict, because a verdict cannot be argued ' +
          'with and a witness ends the argument. The generic greedy algorithm underneath is the same twelve ' +
          'lines for every system: sort by weight, take what keeps the set independent. Give it the ' +
          'acyclicity oracle and it is Kruskal - not "like Kruskal", the same code.'
      ],
      demo: {
        title: 'Interactive demo — the checker, its witness, and greedy against the truth',
        markup: root.MatroidsTemplate.render()
      },
      diagram: diagram(),
      insight: 'Most problems are not matroids, and knowing that early is worth more than the theorem itself. ' +
        'The practical use of this section is the shape of the question: when someone proposes a greedy rule, ' +
        'write the feasible sets down, check the exchange property on a ten-element model, and if it fails, ' +
        'the counter-example you just found is the test case. Matroid intersection - the feasible sets of two ' +
        'matroids at once - is still solvable in polynomial time but no longer by greedy, and three matroids ' +
        'is NP-hard. The cliff is that close.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.MatroidsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /** The three-edge path with weights 2, 3, 2 is the smallest instance where
   *  greedy on matchings loses; the padding edges are disjoint, so they change
   *  both totals equally and leave the gap intact. */
  function matchingInstance(size) {
    const edges = [
      { id: 0, from: 0, to: 1, weight: 2 },
      { id: 1, from: 1, to: 2, weight: 3 },
      { id: 2, from: 2, to: 3, weight: 2 }
    ];
    for (let i = 3; i < size; i += 1) {
      edges.push({ id: i, from: 2 * i, to: 2 * i + 1, weight: 1 });
    }
    return edges;
  }

  function graphInstance(size, seed) {
    const random = root.Random.seeded(seed);
    const vertices = Math.max(3, Math.ceil(Math.sqrt(size * 2)));
    const edges = [];
    for (let i = 0; i < size; i += 1) {
      const from = random.int(vertices);
      let to = random.int(vertices);
      if (to === from) to = (to + 1) % vertices;
      edges.push({ id: i, from: from, to: to, weight: 1 + random.int(20), vertices: vertices });
    }
    return edges;
  }

  const systemFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const kind = parts[0];
    const size = Number(parts[1]);
    const k = Number(parts[2]);
    const seed = Number(parts[3]);

    if (kind === 'graphic') {
      const edges = graphInstance(size, seed);
      return { kind: kind, ground: edges, oracle: root.Matroid.acyclicOracle(edges[0].vertices),
        weightOf: function (edge) { return edge.weight; }, label: 'acyclic edge sets' };
    }
    if (kind === 'matching') {
      const edges = matchingInstance(size);
      return { kind: kind, ground: edges, oracle: root.Matroid.matchingOracle(),
        weightOf: function (edge) { return edge.weight; }, label: 'matchings' };
    }
    if (kind === 'partition') {
      const random = root.Random.seeded(seed);
      const ground = [];
      for (let i = 0; i < size; i += 1) ground.push({ id: i, group: i % 3, weight: 1 + random.int(20) });
      return { kind: kind, ground: ground,
        oracle: root.Matroid.partitionOracle(function (item) { return item.group; }, { 0: k, 1: k, 2: k }),
        weightOf: function (item) { return item.weight; }, label: 'a quota of ' + k + ' per group' };
    }
    if (kind === 'handmade') {
      const ground = [];
      for (let i = 0; i < Math.min(size, 6); i += 1) ground.push({ id: i, weight: 1 + i });
      const allowed = [[], [ground[0]], [ground[1]], [ground[2]], [ground[0], ground[1]]];
      return { kind: kind, ground: ground.slice(0, 3), oracle: root.Matroid.allowedSetsOracle(allowed),
        weightOf: function (item) { return item.weight; }, label: 'a hand-written family' };
    }

    const random = root.Random.seeded(seed);
    const ground = [];
    for (let i = 0; i < size; i += 1) ground.push({ id: i, weight: 1 + random.int(20) });
    return { kind: kind, ground: ground, oracle: root.Matroid.uniformOracle(k),
      weightOf: function (item) { return item.weight; }, label: 'at most ' + k + ' elements' };
  });

  const analysisFor = root.Helpers.memoise(function (key) {
    const system = systemFor(key);
    return {
      system: system,
      analysis: root.Matroid.analyse(system.ground, system.oracle),
      greedy: root.Matroid.greedy(system.ground, system.oracle, system.weightOf),
      best: root.Matroid.bestIndependent(system.ground, system.oracle, system.weightOf)
    };
  });

  function keyFor(values, kind) {
    return (kind || values['mtr-system']) + '|' + values['mtr-ground'] + '|' + values['mtr-k'] + '|' +
      values['mtr-seed'];
  }

  function update() {
    const values = panel.values();
    const run = analysisFor(keyFor(values));

    paintMetrics(run);
    paintProperties(run);
    paintSystems(values);
    paintTrace(run);
    paintKruskal(values);
  }

  function paintMetrics(run) {
    root.MetricGrid.update({
      'mtr-verdict': {
        value: run.analysis.isMatroid ? 'yes' : 'no',
        note: run.analysis.isMatroid ? 'greedy is optimal for every weighting'
          : 'so a weighting exists that defeats greedy'
      },
      'mtr-independent': {
        value: root.Format.exact(run.analysis.independentCount),
        note: 'of ' + root.Format.exact(run.analysis.oracleCalls) + ' subsets asked about'
      },
      'mtr-greedy': {
        value: root.Format.exact(run.greedy.weight),
        note: root.Format.exact(run.greedy.chosen.length) + ' elements, ' +
          root.Format.exact(run.greedy.oracleCalls) + ' oracle calls'
      },
      'mtr-best': {
        value: root.Format.exact(run.best.weight),
        note: run.greedy.weight === run.best.weight ? 'greedy found it' :
          'greedy is short by ' + root.Format.exact(run.best.weight - run.greedy.weight)
      }
    });
  }

  function describe(elements) {
    if (!elements || !elements.length) return '∅';
    return elements.map(function (element) {
      if (element.from !== undefined) return element.from + '–' + element.to;
      return String(element.id);
    }).join(', ');
  }

  function paintProperties(run) {
    const rows = [
      { name: 'hereditary — every subset of an independent set is independent', check: run.analysis.hereditary,
        witness: function (w) { return describe(w.set) + ' is independent but ' + describe(w.subset) + ' is not'; } },
      { name: 'exchange — a larger independent set can always extend a smaller one', check: run.analysis.exchange,
        witness: function (w) { return describe(w.smaller) + ' cannot be extended from ' + describe(w.larger); } }
    ];

    const html = rows.map(function (row) {
      return '<tr><td>' + row.name + '</td>' +
        '<td class="mono">' + (row.check.holds ? 'yes' : 'no') + '</td>' +
        '<td class="mono">' + (row.check.witness ? row.witness(row.check.witness) : '—') + '</td></tr>';
    }).join('');

    root.jQuery('#mtr-properties tbody').html(html);
    root.jQuery('#mtr-properties-note').text('The witness column is the whole product of this tool. For ' +
      'matchings on a three-edge path it reads "1–2 cannot be extended from 0–1, 2–3": the middle edge is a ' +
      'maximal matching of size one beside a matching of size two, and neither of the larger set\'s edges can ' +
      'join it. That is the exchange property failing, in four elements, and it is the reason a weighting of ' +
      '2, 3, 2 defeats greedy.');
  }

  const SYSTEMS = ['graphic', 'uniform', 'partition', 'matching', 'handmade'];

  function paintSystems(values) {
    const selected = values['mtr-system'];
    const html = SYSTEMS.map(function (kind) {
      const run = analysisFor(keyFor(values, kind));
      return '<tr' + (kind === selected ? ' style="font-weight:600"' : '') + '>' +
        '<td>' + run.system.label + '</td>' +
        '<td class="mono">' + (run.analysis.isMatroid ? 'yes' : 'no') + '</td>' +
        '<td class="mono">' + root.Format.exact(run.greedy.weight) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.best.weight) + '</td>' +
        '<td class="mono">' + (run.greedy.weight === run.best.weight ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#mtr-systems tbody').html(html);
    root.jQuery('#mtr-systems-note').text('The fourth row is the one to read twice. Matchings are not a ' +
      'matroid and greedy loses on this weighting — 3 where the answer is 4 on the three-edge path, plus the ' +
      'disjoint padding, which changes both totals equally. The theorem is an if-and-only-if, so the failure ' +
      'is not bad luck with the weights: for any non-matroid, some weighting defeats greedy, and finding one ' +
      'is a matter of putting the weight on the element that blocks the most.');
  }

  function paintTrace(run) {
    const order = run.system.ground.slice().sort(function (a, b) {
      return run.system.weightOf(b) - run.system.weightOf(a);
    });
    const kept = [];
    let weight = 0;

    const html = order.slice(0, 12).map(function (element, index) {
      const takes = run.system.oracle(kept.concat([element]));
      if (takes) { kept.push(element); weight += run.system.weightOf(element); }
      return '<tr><td class="mono">' + (index + 1) + '</td>' +
        '<td class="mono">' + describe([element]) + '</td>' +
        '<td class="mono">' + root.Format.exact(run.system.weightOf(element)) + '</td>' +
        '<td class="mono">' + (takes ? 'kept' : 'rejected') + '</td>' +
        '<td class="mono">' + root.Format.exact(weight) + '</td></tr>';
    }).join('');

    root.jQuery('#mtr-trace tbody').html(html);
    root.jQuery('#mtr-trace-note').text('One pass, heaviest first, keeping whatever the oracle still calls ' +
      'independent. Nothing here knows what a graph is or what a quota is — the only thing that changes ' +
      'between the five systems is the oracle, which is what "generic greedy" means. On a matroid this pass ' +
      'is provably optimal; on the two systems below it, it is a heuristic that happens to be running the ' +
      'same code.');
  }

  function paintKruskal(values) {
    const run = analysisFor(keyFor(values, 'graphic'));
    const edges = run.system.ground;
    const oracle = run.system.oracle;
    const maximum = root.Matroid.greedy(edges, oracle, function (edge) { return edge.weight; });
    const minimum = root.Matroid.greedy(edges, oracle, function (edge) { return -edge.weight; });
    const bestMax = root.Matroid.bestIndependent(edges, oracle, function (edge) { return edge.weight; });

    const rows = [
      { label: 'maximum spanning forest (greedy, heaviest first)', run: maximum,
        weight: maximum.weight, matches: maximum.weight === bestMax.weight },
      { label: 'minimum spanning forest (the same code, negated weights)', run: minimum,
        weight: -minimum.weight, matches: true }
    ];

    const html = rows.map(function (row) {
      return '<tr><td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.chosen.length) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.weight) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.oracleCalls) + '</td>' +
        '<td class="mono">' + (row.matches ? 'yes' : 'NO') + '</td></tr>';
    }).join('');

    root.jQuery('#mtr-kruskal tbody').html(html);
    root.jQuery('#mtr-kruskal-note').text('Kruskal\'s algorithm is this section\'s generic greedy with an ' +
      'acyclicity oracle, and the minimum spanning tree is the same call with the weights negated. Neither ' +
      'is a special case that had to be proved separately: both are corollaries of the graphic matroid being ' +
      'a matroid, which is the payoff of the abstraction. The oracle-call column is the cost of doing it ' +
      'this way — a real Kruskal uses a union-find and answers each call in near-constant time instead of ' +
      'rebuilding the forest.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
