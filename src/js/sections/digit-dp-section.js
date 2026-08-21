/**
 * Section: DP on DAGs and digit DP.
 *
 * The headline claim is that digit DP's cost depends on how many digits the
 * bound has rather than on how large it is, so the scale table runs the same
 * count at 10^6, 10^12 and 10^18 and reports the states each needed. Three
 * numbers a few dozen apart, across a range that spans twelve orders of
 * magnitude, is the whole argument.
 *
 * Every count is checked against counting the numbers one at a time, on ranges
 * small enough for that to finish. The check matters more than usual here: the
 * classic digit-DP bug is the number zero, which the natural `started &&
 * accepting` termination silently drops - so the count comes out one short and
 * nothing about it looks wrong.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'digit-dp';
  const BRUTE_LIMIT = 200000;
  let panel = null;

  const PROPERTIES = {
    adjacent: { build: function () { return root.DpDigit.noEqualAdjacent(); },
      state: 'the previous digit' },
    increasing: { build: function () { return root.DpDigit.strictlyIncreasing(); },
      state: 'the previous digit' },
    divisible: { build: function () { return root.DpDigit.digitSumDivisibleBy(3); },
      state: 'the digit sum so far, modulo 3' },
    thirteen: { build: function () { return root.DpDigit.containsThirteen(); },
      state: 'how much of "13" has been seen' }
  };

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — tight and free',
      caption: 'While every digit so far equals the bound\'s, the next digit is capped. The first digit ' +
        'chosen below the bound\'s releases the cap for good - and that is the only thing the tight flag ' +
        'does. Without it the count runs past the bound; frozen on, it stops at the bound\'s own prefix.',
      definition: [
        'flowchart LR',
        '    T["tight at position i"] -->|"digit < bound[i]"| F["free for every later position"]',
        '    T -->|"digit == bound[i]"| T2["still tight at i+1"]',
        '    T -->|"digit > bound[i]"| X["not allowed"]',
        '    F --> F2["free at i+1 — all ten digits"]',
        '    F2 --> M["free states are memoisable; tight ones are on one path only"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'Digit DP answers "how many numbers in [L, R] have property P" by walking the bound\'s digits left ' +
          'to right instead of walking the numbers. The state is (position, whatever the property needs to ' +
          'remember, **tight**), and tight means every digit chosen so far equals the bound\'s. While tight ' +
          'the next digit is capped; the moment a smaller digit is chosen the number is already below the ' +
          'bound and every later digit is free.',
        '**Only the free states are memoisable, and that is why the technique works.** A tight state lies ' +
          'on exactly one path - the bound\'s own prefix - so there is nothing to reuse and at most one ' +
          'per position exists. Everything else is shared across an enormous number of prefixes. The ' +
          'result is that the work depends on the bound\'s *length*: counting to 10¹⁸ costs about three ' +
          'times counting to 10⁶, not a trillion times.',
        '**The property is a DFA, and once that is seen the whole family collapses into one walk.** "No ' +
          'two equal adjacent digits" remembers the previous digit; "digit sum divisible by 3" remembers a ' +
          'residue; "contains 13" is a two-state matcher. The same counting code drives all of them, which ' +
          'is the bridge to M24 - and counting the strings a DFA accepts is this algorithm with the tight ' +
          'flag deleted.',
        '**The number zero is where this goes wrong.** Leading zeros must not make "007" and "7" two ' +
          'different numbers, so the walk carries a `started` flag - and the natural termination, "count ' +
          'this if it started and the automaton accepts", silently drops zero itself. The count comes out ' +
          'exactly one short on every property that accepts it, ranges still agree because the error ' +
          'cancels in the subtraction, and nothing looks wrong. Only counting one by one finds it.'
      ],
      demo: {
        title: 'Interactive demo — four properties, a range check, and the cost against the value',
        markup: root.DigitDpTemplate.render()
      },
      diagram: diagram(),
      insight: 'Whenever a counting question has a range too large to iterate, the answer is almost always ' +
        '"walk the representation, not the values". Digit DP is that idea for numbers; the same move gives ' +
        'you counting over strings by walking an automaton, and counting over trees by walking the shape. ' +
        'The recognition test is simple: if the bound appears in the *size* of your loop rather than in the ' +
        'number of *digits* of your loop, there is a representation walk hiding underneath. And whatever ' +
        'the representation, check the smallest element of the range explicitly — that is where the ' +
        'off-by-one lives.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DigitDpTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const rangeFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const automaton = PROPERTIES[parts[0]].build();
    const low = Math.min(Number(parts[1]), Number(parts[2]));
    const high = Math.max(Number(parts[1]), Number(parts[2]));
    const run = root.DpDigit.countInRange(low, high, automaton, {});
    const brute = high - low <= BRUTE_LIMIT
      ? root.DpDigit.countBruteForce(low, high, automaton) : null;
    return { automaton: automaton, low: low, high: high, run: run, brute: brute };
  });

  const propertiesFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const low = Math.min(parts[0], parts[1]);
    const high = Math.max(parts[0], parts[1]);
    return Object.keys(PROPERTIES).map(function (name) {
      const automaton = PROPERTIES[name].build();
      const run = root.DpDigit.countInRange(low, high, automaton, {});
      return { name: name, automaton: automaton, state: PROPERTIES[name].state, run: run,
        brute: high - low <= BRUTE_LIMIT
          ? root.DpDigit.countBruteForce(low, high, automaton) : null };
    });
  });

  const scaleFor = root.Helpers.memoise(function (key) {
    const automaton = PROPERTIES[key].build();
    return [1000, 1000000, 1000000000000, 1000000000000000000].map(function (bound) {
      const run = root.DpDigit.countUpTo(bound, automaton, {});
      return { bound: bound, run: run };
    });
  });

  const dagFor = root.Helpers.memoise(function (key) {
    const n = Number(key);
    const random = root.Random.seeded(7);
    const adjacency = [];

    for (let i = 0; i < n; i += 1) adjacency.push([]);

    for (let from = 0; from < n; from += 1) {
      for (let to = from + 1; to < n; to += 1) {
        if (random.next() >= 0.25) continue;
        adjacency[from].push({ to: to, weight: 1 + random.int(9) });
      }
    }
    return { adjacency: adjacency, longest: root.DpDigit.longestPath(adjacency, {}),
      paths: root.DpDigit.countPaths(adjacency, 0, {}),
      strings: root.DpDigit.countAcceptedStrings(root.DpDigit.noEqualAdjacent(),
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 4, {}) };
  });

  function keyFor(values) {
    return values['dgt-property'] + '|' + values['dgt-low'] + '|' + values['dgt-high'];
  }

  function update() {
    const values = panel.values();
    const run = rangeFor(keyFor(values));

    paintMetrics(run);
    paintScale(scaleFor(values['dgt-property']));
    paintProperties(propertiesFor(values['dgt-low'] + '|' + values['dgt-high']));
    paintTight(run);
    paintDag(dagFor(String(values['dgt-nodes'])));
  }

  function paintMetrics(run) {
    const span = run.high - run.low + 1;

    root.MetricGrid.update({
      'dgt-count': {
        value: root.Format.exact(run.run.count),
        note: run.brute === null ? 'the range is too wide to count one by one here'
          : (run.brute === run.run.count ? 'counting one by one agrees'
            : 'COUNTING ONE BY ONE DISAGREES')
      },
      'dgt-states': { value: root.Format.exact(run.run.report.states),
        note: 'both bounds together, memoised on the free states only' },
      'dgt-brute': { value: root.Format.exact(span),
        note: 'every value in [' + run.low + ', ' + run.high + ']' },
      'dgt-ratio': { value: root.Format.fixed(span / Math.max(1, run.run.report.states), 1) + '×',
        note: 'at this range; widen it and this grows without bound' }
    });
  }

  function paintScale(rows) {
    const html = rows.map(function (row) {
      return '<tr><td class="mono">10^' + String(row.bound).length + ' − 1 ≈ ' +
        root.Format.exact(row.bound) + '</td>' +
        '<td class="mono">' + row.run.report.digits + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.count) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.states) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.bound) + ' steps</td></tr>';
    }).join('');

    root.jQuery('#dgt-scale tbody').html(html);
    root.jQuery('#dgt-scale-note').text('The bound spans fifteen orders of magnitude and the state count '
      + 'roughly triples. That is the whole technique: the work is proportional to the number of digits, '
      + 'and the last column — what it would cost to look at each value — is proportional to the value.');
  }

  function paintProperties(rows) {
    const html = rows.map(function (row) {
      return '<tr><td>' + row.automaton.name + '</td><td>' + row.state + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.count) + '</td>' +
        '<td class="mono">' + (row.brute === null ? '—' : root.Format.exact(row.brute)) + '</td>' +
        '<td>' + (row.brute === null ? 'not checked at this width'
          : (row.brute === row.run.count ? 'yes' : 'NO')) + '</td></tr>';
    }).join('');

    root.jQuery('#dgt-properties tbody').html(html);
    root.jQuery('#dgt-properties-note').text('One counting walk, four automata. The state column is the '
      + 'part that has to be designed; everything else is shared code. Note that "contains 13" has a real '
      + 'accepting condition while the other three accept every reachable state — a rejected transition '
      + 'and a non-accepting state are different mechanisms and both are needed.');
  }

  function paintTight(run) {
    const upper = run.run.upper;
    const lower = run.run.lower;

    root.MatrixView.render(root.jQuery('#dgt-tight')[0], {
      columns: ['Quantity', 'Value', 'What it is'],
      rows: [
        { cells: ['count up to ' + run.high, root.Format.exact(upper),
          'the walk over ' + String(run.high).length + ' digits'] },
        { cells: ['count up to ' + (run.low - 1), root.Format.exact(lower),
          'the same walk, one digit string shorter'] },
        { cells: ['difference', root.Format.exact(run.run.count),
          'the answer for the inclusive range'] },
        { cells: ['zero counted?', root.Format.exact(root.DpDigit.countUpTo(0, run.automaton, {}).count),
          'the value the naive termination drops'] }
      ]
    });
    root.jQuery('#dgt-tight-note').text('An inclusive range is two counts and a subtraction, and `low − 1` '
      + 'is where the off-by-one lives — which is why it is written once in the module rather than at each '
      + 'call site. The last row is the number zero: on the properties that accept it, dropping it makes '
      + 'every prefix count one short while every RANGE stays right, because the error cancels.');
  }

  function paintDag(dag) {
    const rows = [
      { question: 'longest path', answer: dag.longest.cyclic ? 'the graph has a cycle'
        : root.Format.exact(dag.longest.length) + ' over ' + dag.longest.path.length + ' nodes',
      states: dag.longest.report.states, transitions: dag.longest.report.transitions,
      note: 'NP-hard on a general graph, linear here — the order is the whole difference' },
      { question: 'paths from node 0', answer: dag.paths.cyclic ? 'the graph has a cycle'
        : root.Format.exact(dag.paths.counts.reduce(function (a, b) { return a + b; }, 0)) + ' in total',
      states: dag.paths.report.states, transitions: dag.paths.report.transitions,
      note: dag.paths.exact ? 'still inside the safe integer range'
        : 'PAST THE SAFE INTEGER RANGE — these counts are rounded' },
      { question: 'four-digit strings with no equal adjacent digits',
        answer: root.Format.exact(dag.strings.count) + ' (10 × 9³ = 7 290)',
        states: dag.strings.report.states, transitions: dag.strings.report.transitions,
        note: 'the same walk with the tight flag removed — this is automaton DP' }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.question + '</td><td class="mono">' + row.answer + '</td>' +
        '<td class="mono">' + root.Format.exact(row.states) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.transitions) + '</td>' +
        '<td>' + row.note + '</td></tr>';
    }).join('');

    root.jQuery('#dgt-dag tbody').html(html);
    root.jQuery('#dgt-dag-note').text('A DP is a walk over a DAG of subproblems, and here the DAG is the '
      + 'input rather than something the recursion implies — which makes the point without any recursion '
      + 'to look at. The path counter reports whether it stayed inside the safe integer range instead of '
      + 'silently returning a rounded double.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
