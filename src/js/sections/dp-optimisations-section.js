/**
 * Section: DP optimisations.
 *
 * Four techniques, one page, and the same column on every row: **does the
 * precondition hold?** That is the section. Each of these is a narrowing of a
 * search, so a false precondition does not raise - it excludes the optimum and
 * returns a worse number faster.
 *
 * The broken-precondition panel is therefore not a footnote. It runs the hull
 * on an instance whose prefix sums are not monotone, with the guard forced
 * off, and prints the value beside the correct one. Two numbers, both
 * plausible, one wrong, and the only warning anywhere is the check the
 * optimised solver would have refused on.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'dp-optimisations';
  let panel = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
  }

  function diagram() {
    return {
      title: 'Diagram — the lower envelope of candidate lines',
      caption: 'Each earlier state contributes a line. The best transition at x is the lowest line there, ' +
        'and only the lines on the lower envelope can ever be lowest - the rest are dominated everywhere ' +
        'and can be discarded the moment that is known.',
      definition: [
        'flowchart LR',
        '    S["dp[i] + P[i]^2, slope -2P[i]"] --> H["push onto the hull"]',
        '    H --> B{"does the new line make the previous one useless?"}',
        '    B -->|yes| P["pop it — it is below nothing, anywhere"]',
        '    B -->|no| K["keep it"]',
        '    P --> B',
        '    K --> Q["query at x = P[j]: walk the pointer forward, never back"]'
      ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        'A DP whose transition looks at every earlier state is quadratic, and there are four standard ways ' +
          'to make it not be. The **convex hull trick** applies when the transition cost is linear in a ' +
          'query value: expand the square and `dp[i] + (P[j] − P[i])²` becomes the minimum of a set of ' +
          'lines evaluated at P[j]. **Divide and conquer optimisation** applies when the optimal split ' +
          'point is monotone. The **monotonic queue** applies when the transition looks at a sliding ' +
          'window. The **Lagrangian trick** turns "exactly k groups" into a search over a penalty.',
        '**Every one of them has a precondition, and every one of them is silently wrong without it.** ' +
          'The hull needs decreasing slopes and increasing queries, which for this cost function means ' +
          'non-negative values. Divide and conquer needs the argmin to be monotone. The Lagrangian trick ' +
          'needs the cost to be convex in the group count. None of these produce an error when violated; ' +
          'they produce a number that is too large, computed faster.',
        '**So the solvers here refuse.** Each one tests its precondition against the actual instance and ' +
          'returns `refused: true` with a witness rather than an answer. `force: true` is how the demo ' +
          'shows what running it anyway produces — and the panel below prints that number next to the ' +
          'correct one so the failure is visible rather than described.',
        '**Li Chao is the one that gives up the preconditions.** It answers the same minimum-of-lines ' +
          'query with lines added in any order and queried in any order, for a log factor. That is the ' +
          'trade worth remembering: the hull is faster and the tree is the one still correct when the ' +
          'data stops cooperating, which in practice is most of the time.'
      ],
      demo: {
        title: 'Interactive demo — four narrowings, and what each one needs to be true',
        markup: root.DpOptimisationsTemplate.render()
      },
      diagram: diagram(),
      insight: 'Treat every DP optimisation as a claim with a proof obligation attached, and discharge the ' +
        'obligation in a test rather than in your head. The test is cheap: run the optimised and ' +
        'unoptimised versions on a few hundred random instances and assert the values are equal. That one ' +
        'test catches every precondition violation there is, including the ones you did not know the ' +
        'optimisation had, and it keeps catching them when somebody later changes the cost function and ' +
        'does not realise the optimisation depended on its shape.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.DpOptimisationsTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  const instanceFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[2]);
    const values = [];

    for (let i = 0; i < parts[0]; i += 1) values.push(1 + random.int(20));
    return root.DpOptimizations.groupingInstance(values, parts[1]);
  });

  const runFor = root.Helpers.memoise(function (key) {
    const instance = instanceFor(key);
    return { instance: instance,
      naive: root.DpOptimizations.groupingNaive(instance, {}),
      hull: root.DpOptimizations.groupingHull(instance, {}),
      monotone: root.DpOptimizations.checkHullMonotone(instance) };
  });

  /* Divide and conquer optimisation and the aliens trick are both quadratic
     to *check*, so they run on a shortened copy - and the note says so rather
     than letting the transition counts look comparable to the hull's. */
  const layeredFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const groups = Number(parts[0]);
    const full = instanceFor(parts.slice(1).join('|'));
    const values = full.values.slice(0, Math.min(full.values.length, 120));
    const instance = root.DpOptimizations.groupingInstance(values, 0);
    return { values: values, instance: instance, groups: groups,
      exact: root.DpOptimizations.groupingExactly(values, groups, {}),
      divide: root.DpOptimizations.groupingDivideConquer(instance, groups, {}),
      aliens: root.DpOptimizations.aliensTrick(values, groups, {}) };
  });

  /* The instance the hull is NOT allowed to run on: negative values make the
     prefix sums fall, so slopes rise and queries move backwards. */
  const brokenFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|').map(Number);
    const random = root.Random.seeded(parts[2] + 100);
    const values = [];

    for (let i = 0; i < 60; i += 1) values.push(random.int(21) - 10);
    const instance = root.DpOptimizations.groupingInstance(values, parts[1]);
    let forced = null;

    try {
      forced = root.DpOptimizations.groupingHull(instance, { force: true });
    } catch (error) {
      forced = { threw: String(error.message) };
    }
    return { instance: instance, naive: root.DpOptimizations.groupingNaive(instance, {}),
      refused: root.DpOptimizations.groupingHull(instance, {}), forced: forced,
      monotone: root.DpOptimizations.checkHullMonotone(instance) };
  });

  const windowFor = root.Helpers.memoise(function (key) {
    const instance = instanceFor(key);
    const width = Math.max(2, Math.floor(instance.values.length / 8));
    return { width: width,
      deque: root.DpOptimizations.slidingWindowDp(instance.values, width, {}),
      naive: root.DpOptimizations.slidingWindowNaive(instance.values, width, {}) };
  });

  function keyFor(values) {
    return values['dop-size'] + '|' + values['dop-penalty'] + '|' + values['dop-seed'];
  }

  function update() {
    const values = panel.values();
    const key = keyFor(values);
    const run = runFor(key);
    const layered = layeredFor(values['dop-groups'] + '|' + key);

    paintMetrics(run);
    paintMethods(run, layered);
    paintLines(run);
    paintBroken(brokenFor(key));
    paintAliens(layered);
    paintWindow(windowFor(key));
  }

  function paintMetrics(run) {
    const naive = run.naive.report.transitions;
    const hull = run.hull.refused ? null : run.hull.report.transitions;

    root.MetricGrid.update({
      'dop-value': { value: root.Format.exact(run.naive.value),
        note: run.hull.refused ? 'the hull refused on this instance'
          : (run.hull.value === run.naive.value ? 'the hull agrees exactly'
            : 'THE HULL DISAGREES WITH THE QUADRATIC REFERENCE') },
      'dop-naive': { value: root.Format.exact(naive), note: 'every (i, j) pair with i < j' },
      'dop-hull': { value: hull === null ? '—' : root.Format.exact(hull),
        note: hull === null ? 'not run' : 'line insertions plus pointer walks' },
      'dop-factor': { value: hull === null ? '—' : root.Format.fixed(naive / hull, 1) + '×',
        note: hull === null ? 'nothing to compare' : 'at ' + run.instance.n + ' elements' }
    });
  }

  function paintMethods(run, layered) {
    const rows = [
      { method: 'quadratic reference', precondition: 'none', holds: '—',
        value: run.naive.value, transitions: run.naive.report.transitions },
      { method: 'convex hull trick', precondition: 'slopes fall, queries rise',
        holds: run.monotone.holds ? 'yes' : 'no',
        value: run.hull.refused ? null : run.hull.value,
        transitions: run.hull.refused ? null : run.hull.report.transitions },
      { method: 'divide and conquer optimisation', precondition: 'the argmin is monotone',
        holds: layered.divide.refused ? 'no' : 'yes',
        value: layered.divide.refused ? null : layered.divide.value,
        transitions: layered.divide.refused ? null : layered.divide.report.transitions },
      { method: 'monotonic queue', precondition: 'the transition window slides',
        holds: 'yes', value: null, transitions: null }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.method + '</td><td>' + row.precondition + '</td>' +
        '<td>' + row.holds + '</td>' +
        '<td class="mono">' + (row.value === null ? '—' : root.Format.exact(row.value)) + '</td>' +
        '<td class="mono">' + (row.transitions === null ? '—'
          : root.Format.exact(row.transitions)) + '</td></tr>';
    }).join('');

    root.jQuery('#dop-methods tbody').html(html);
    root.jQuery('#dop-methods-note').text('The divide-and-conquer row runs on a ' + layered.values.length +
      '-element prefix and a fixed group count, because checking its precondition is itself quadratic — '
      + 'so its transition count is not comparable with the hull\'s. The monotonic-queue row is measured '
      + 'separately below, on a sliding transition rather than this one.');
  }

  function paintLines(run) {
    if (run.hull.refused) {
      root.jQuery('#dop-lines tbody').html('<tr><td colspan="4">The hull did not run on this instance.</td></tr>');
      root.jQuery('#dop-lines-note').text('Nothing to show: the preconditions failed and the solver refused.');
      return;
    }
    const hull = root.DpOptimizations.createHull({});

    for (let i = 0; i <= Math.min(run.instance.n, 40); i += 1) {
      hull.add(-2 * run.instance.prefix[i], i * i);
    }
    const lines = hull.lines().slice(0, 12);
    const html = lines.map(function (line, index) {
      const next = lines[index + 1];
      const crossing = next
        ? root.Format.fixed((next.c - line.c) / (line.m - next.m), 2) : 'the end';
      return '<tr><td class="mono">' + index + '</td>' +
        '<td class="mono">' + root.Format.fixed(line.m, 1) + '</td>' +
        '<td class="mono">' + root.Format.fixed(line.c, 1) + '</td>' +
        '<td class="mono">' + crossing + '</td></tr>';
    }).join('');

    root.jQuery('#dop-lines tbody').html(html);
    root.jQuery('#dop-lines-note').text('Showing ' + lines.length + ' of ' + hull.size() +
      ' surviving lines. Slopes fall down the table and the crossing points rise, which is what makes the '
      + 'query a forward pointer walk rather than a search: as x increases the answer only ever moves '
      + 'right, so the pointer never goes back and the whole sweep is linear.');
  }

  function paintBroken(broken) {
    const forcedValue = broken.forced.threw ? 'threw: ' + broken.forced.threw
      : root.Format.exact(broken.forced.value);
    const rows = [
      { cells: ['quadratic reference', root.Format.exact(broken.naive.value),
        'always correct'] },
      { cells: ['hull, guard on', 'refused',
        'the check found the prefix sums falling at index ' + broken.monotone.witness.at] },
      { cells: ['hull, guard forced off', forcedValue,
        broken.forced.threw ? 'the hull itself detected the violation'
          : (broken.forced.value === broken.naive.value
            ? 'it happened to agree on this instance'
            : 'WRONG, and nothing said so')] }
    ];

    root.MatrixView.render(root.jQuery('#dop-broken')[0], {
      columns: ['Run', 'Value', 'What happened'],
      rows: rows
    });
    root.jQuery('#dop-broken-note').text('This instance has negative values, so the prefix sums fall and '
      + 'both preconditions break. With the guard on the solver returns a witness instead of a number; '
      + 'with it forced off the failure is whatever it happens to be. Either the hull catches the '
      + 'violation itself, or it returns a value — and a returned value here is the outcome the whole '
      + 'section is warning about.');
  }

  function paintAliens(layered) {
    const rows = [
      { approach: 'two-dimensional DP (layer per group)', value: layered.exact.value,
        transitions: layered.exact.report.transitions, landed: 'by construction' },
      { approach: 'divide and conquer optimisation',
        value: layered.divide.refused ? null : layered.divide.value,
        transitions: layered.divide.refused ? null : layered.divide.report.transitions,
        landed: layered.divide.refused ? 'refused — the argmin is not monotone' : 'by construction' },
      { approach: 'Lagrangian (aliens) penalty search', value: layered.aliens.value,
        transitions: layered.aliens.report.transitions,
        landed: layered.aliens.exact ? 'yes, at penalty '
          + root.Format.fixed(layered.aliens.penalty, 2) : 'no — ' + layered.aliens.reason }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.approach + '</td>' +
        '<td class="mono">' + (row.value === null ? '—' : root.Format.exact(row.value)) + '</td>' +
        '<td class="mono">' + (row.transitions === null ? '—'
          : root.Format.exact(row.transitions)) + '</td>' +
        '<td>' + row.landed + '</td></tr>';
    }).join('');

    root.jQuery('#dop-aliens tbody').html(html);
    root.jQuery('#dop-aliens-note').text('Splitting ' + layered.values.length + ' values into exactly '
      + layered.groups + ' groups. The Lagrangian search removes the second dimension by pricing a group '
      + 'and binary-searching the price — and its honest failure is that the group count can jump straight '
      + 'over k, in which case it reports that rather than answering for k − 1.');
  }

  function paintWindow(window) {
    const rows = [
      { method: 'monotonic deque', run: window.deque },
      { method: 'rescan the window', run: window.naive }
    ];
    const html = rows.map(function (row) {
      return '<tr><td>' + row.method + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.value) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.transitions) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.run.report.popped) + '</td></tr>';
    }).join('');

    root.jQuery('#dop-window tbody').html(html);
    root.jQuery('#dop-window-note').text('A transition that looks back over a window of ' + window.width +
      ' entries. This is the M11.7 amortisation applied to a DP transition rather than to an array query: '
      + 'each index enters the deque once and leaves once, so the whole sweep is linear whatever the '
      + 'window width, while the rescan is proportional to it.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
