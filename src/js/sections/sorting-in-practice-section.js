/**
 * Section: sorting in practice.
 *
 * The chooser is the payoff for the whole milestone: state the workload as
 * requirements - shape, size, stability, key type - and every implementation
 * built in M10 is run against it and ranked, with the ones that fail the
 * stability requirement struck out rather than silently omitted.
 *
 * The second table is the JavaScript-specific one, and it exists because
 * `[1, 2, 10].sort()` returning `[1, 10, 2]` is still one of the most common
 * bugs in the language.
 */
(function (root) {
  'use strict';

  const SECTION_ID = 'sorting-in-practice';
  let panel = null;
  let chart = null;

  function init(app) {
    app.state.subscribe('navigation', function (event) {
      if (event.section !== SECTION_ID || !app.markRendered(SECTION_ID)) return;
      render(app);
    });
    app.state.subscribe('theme', function () {
      if (chart) chart.redraw();
    });
  }

  function diagram() {
    return {
        title: 'Diagram — from workload properties to an algorithm',
        caption: 'Every question here is about the data or the caller, and the leaves are the sorts built in ' +
          'this milestone. This is the decision the chooser makes numerically.',
        definition: [
          'flowchart TD',
          '    A["how big, and does it fit in memory?"] -- "does not fit" --> B["external merge sort — count passes"]',
          '    A -- "fits" --> C{"must equal elements keep their order?"}',
          '    C -- yes --> D{"is the input nearly sorted?"}',
          '    D -- yes --> E["Timsort — run detection pays for itself"]',
          '    D -- no --> F["a stable merge sort"]',
          '    C -- no --> G{"is the key a bounded integer?"}',
          '    G -- yes --> H["LSD radix — no comparisons at all"]',
          '    G -- no --> I{"many duplicate keys?"}',
          '    I -- yes --> J["three-way quicksort"]',
          '    I -- no --> K["pdqsort or introsort"]'
        ].join('\n')
    };
  }

  function config() {
    return {
      sectionId: SECTION_ID,
      orientation: [
        '**Every sort in this milestone wins on some input and loses on another.** The chooser ' +
          'below is what that means in practice: pick the shape, the size and whether stability ' +
          'is required, and the ranking rearranges.',
        'On 2 000 nearly-sorted elements Timsort does 3 099 comparisons and Lomuto quicksort does ' +
          '104 120. On 2 000 elements with three distinct values, three-way quicksort does 3 389 ' +
          'and Lomuto does 676 647. Neither of those is a fact about quicksort. They are facts ' +
          'about quicksort *and that input*, which is why "which sort is fastest" has no answer ' +
          'and "which sort for this workload" does.',
        'JavaScript has two specifics worth knowing. `Array.prototype.sort` has been required ' +
          'to be stable only since ES2019. Before that V8 used an unstable quicksort below 10 ' +
          'elements, and code that relied on stability was relying on an accident.',
        'The other is that the default comparator converts every element to a string and compares ' +
          'UTF-16 code units, so `[1, 2, 10].sort()` returns `[1, 10, 2]`. That is not a rounding ' +
          'error, it is a different order, and it survives review because a sorted-looking array ' +
          'of small numbers looks sorted.',
        'Sorting objects means sorting one extracted field, and the extraction has a cost the ' +
          'comparison count hides. A comparator that calls `toLowerCase()` or `localeCompare` ' +
          'runs that work O(n log n) times.',
        'The Schwartzian transform — decorate with the computed key, sort on it, undecorate — ' +
          'moves that to O(n). `Intl.Collator` exists precisely because locale-aware comparison ' +
          'is expensive enough to want hoisted out of the inner loop. Multi-key ordering is the ' +
          'same idea: write the tie-break chain down explicitly, rather than sorting three times ' +
          'and hoping stability carries it.'
      ],
      demo: {
        title: 'Interactive demo — the chooser, and the default that sorts numbers as strings',
        markup: root.SortingInPracticeTemplate.render()
      },
      diagram: diagram(),
      insight: 'The default `sort` comparing stringified numbers is still one of the most ' +
        'common bugs in JavaScript. It survives review because `[1, 2, 10]` looks sorted until ' +
        'it is `[1, 10, 2]`. The general lesson is bigger than the language. A sort that ' +
        'produces *almost* the right order is far more dangerous than one that crashes. Almost ' +
        'every failure mode in this milestone has that shape: the unstable merge, the unstable ' +
        'radix pass, the broken comparator, the quiet quadratic. When output looks nearly right, ' +
        'suspect the ordering contract before the algorithm.'
    };
  }

  function render(app) {
    root.jQuery('#' + SECTION_ID + '-content').html(app.shell.render(config()));
    app.shell.mount({ sectionId: SECTION_ID, app: app });

    panel = root.ControlPanel.mount({
      controls: root.SortingInPracticeTemplate.controls,
      onChange: function () { update(app); }
    });

    update(app);
  }

  /* Elementary sorts are excluded above a few thousand elements: including a
     quadratic sort in a chooser at n = 30 000 measures nothing except how
     long the page is willing to wait. */
  function candidatesFor(size) {
    const all = root.SortLab.algorithmNames;
    if (size <= 3000) return all;
    return all.filter(function (name) {
      return ['insertion', 'selection', 'bubble'].indexOf(name) === -1;
    });
  }

  const rowsFor = root.Helpers.memoise(function (key) {
    const parts = key.split('|');
    const size = Number(parts[1]);
    return root.SortLab.compare({
      kind: parts[0], size: size, seed: 3, algorithms: candidatesFor(size)
    });
  });

  function update(app) {
    const values = panel.values();
    const rows = rowsFor(values['sip-shape'] + '|' + values['sip-size']);
    const requiresStability = values['sip-stability'] === 'required';
    const eligible = rows.filter(function (row) {
      return !requiresStability || row.claimsStable;
    });
    const ranked = eligible.slice().sort(function (a, b) { return a.comparisons - b.comparisons; });

    paintMetrics(rows, ranked, requiresStability);
    paintChooser(rows, ranked, requiresStability);
    paintDefault();
    paintTable();
    drawChart(ranked);
  }

  /* A radix sort makes no comparisons at all, so a ratio against it is not a
     margin - it is a division by the thing that is zero. The column says so
     rather than reporting the runner-up's own count as a multiple. */
  function comparable(winner) {
    return !!winner && winner.comparisons > 0;
  }

  function winnerNote(winner) {
    if (comparable(winner)) return root.Format.exact(winner.comparisons) + ' comparisons';
    return '0 comparisons and ' + root.Format.exact(winner.moves) + ' moves — it reads the key';
  }

  function marginNote(winner, runnerUp) {
    if (!runnerUp) return 'no runner-up';
    if (!comparable(winner)) return 'the winner makes no comparisons, so this column cannot rank it';
    return 'against ' + runnerUp.label;
  }

  function paintMetrics(rows, ranked, requiresStability) {
    const winner = ranked[0];
    const runnerUp = ranked[1];
    const platform = rows.filter(function (row) { return row.algorithm === 'timsort'; })[0];
    const rejected = rows.length - ranked.length;

    root.MetricGrid.update({
      'sip-winner': {
        value: winner ? winner.label : '—',
        note: winner ? winnerNote(winner) : 'nothing qualifies'
      },
      'sip-margin': {
        value: comparable(winner) && runnerUp
          ? root.Format.fixed(runnerUp.comparisons / winner.comparisons, 2) + '×'
          : '—',
        note: marginNote(winner, runnerUp)
      },
      'sip-default': {
        value: platform ? root.Format.exact(platform.comparisons) : '—',
        note: 'V8 ships a Timsort derivative for Array.prototype.sort'
      },
      'sip-rejected': {
        value: root.Format.exact(rejected),
        note: requiresStability ? 'unstable sorts, excluded by the requirement' : 'nothing is excluded'
      }
    });
  }

  function paintChooser(rows, ranked, requiresStability) {
    const order = {};
    ranked.forEach(function (row, index) { order[row.algorithm] = index; });

    const sorted = rows.slice().sort(function (a, b) { return a.comparisons - b.comparisons; });
    const html = sorted.map(function (row) {
      const eligible = !requiresStability || row.claimsStable;
      return '<tr' + (order[row.algorithm] === 0 ? ' style="font-weight:700"' : '') +
        (eligible ? '' : ' style="opacity:.55"') + '>' +
        '<td>' + row.label + '</td>' +
        '<td class="mono">' + root.Format.exact(row.comparisons) + '</td>' +
        '<td class="mono">' + root.Format.fixed(row.comparisonsPerElement) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.moves) + '</td>' +
        '<td class="mono">' + root.Format.exact(row.allocations) + '</td>' +
        '<td>' + (row.claimsStable ? 'yes' : 'no') + '</td>' +
        '<td>' + (eligible ? 'yes' : 'ruled out') + '</td></tr>';
    }).join('');

    root.jQuery('#sip-chooser tbody').html(html);
    root.jQuery('#sip-chooser-note').text('Every implementation from this milestone, run on the workload you ' +
      'described, sorted by comparisons. The eligible column is the requirement doing its job: asking for ' +
      'stability removes quicksort, pdqsort, shell sort and selection sort outright, whatever their speed. ' +
      'Change the shape and the top of this table changes - which is the single most useful thing to know ' +
      'about sorting, and the reason a benchmark on uniform random data answers a question nobody asked. ' +
      'Elementary sorts drop out of the list above 3 000 rows because timing a quadratic sort at that size ' +
      'measures patience.');
  }

  function paintDefault() {
    const cases = [
      { call: '[1, 2, 10].sort()', input: [1, 2, 10], run: function (values) { return values.slice().sort(); } },
      {
        call: '[1, 2, 10].sort((a, b) => a - b)', input: [1, 2, 10],
        run: function (values) { return values.slice().sort(function (a, b) { return a - b; }); }
      },
      {
        call: '[1, 2, 10].sort((a, b) => a > b)', input: [1, 2, 10],
        run: function (values) { return values.slice().sort(function (a, b) { return a > b; }); }
      },
      {
        call: '[5, 40, 300].sort()', input: [5, 40, 300],
        run: function (values) { return values.slice().sort(); }
      }
    ];

    const html = cases.map(function (entry) {
      const result = entry.run(entry.input);
      const wanted = entry.input.slice().sort(function (a, b) { return a - b; });
      const ok = JSON.stringify(result) === JSON.stringify(wanted);
      return '<tr' + (ok ? '' : ' style="font-weight:700"') + '>' +
        '<td class="mono">' + entry.call + '</td>' +
        '<td class="mono">[' + entry.input.join(', ') + ']</td>' +
        '<td class="mono">[' + result.join(', ') + ']</td>' +
        '<td>' + (ok ? 'yes' : 'no') + '</td></tr>';
    }).join('');

    root.jQuery('#sip-default-table tbody').html(html);
    root.jQuery('#sip-default-table-note').text('These are real calls, evaluated in this page. The default ' +
      'comparator converts each element to a string and compares UTF-16 code units, so 10 sorts before 2 and ' +
      '300 sorts before 40. The third row is the other common form: `a > b` returns a boolean, `false` ' +
      'becomes 0, and the sort is told that most pairs are equal. None of these throw.');
  }

  const ROSTER = [
    { name: 'Ada', team: 'blue', points: 12 },
    { name: 'Émile', team: 'blue', points: 9 },
    { name: 'Zoë', team: 'amber', points: 12 },
    { name: 'ana', team: 'amber', points: 9 },
    { name: 'Bob', team: 'blue', points: 12 },
    { name: 'Ángel', team: 'amber', points: 12 }
  ];

  function paintTable() {
    const collator = new Intl.Collator('en', { sensitivity: 'base' });
    const sorted = ROSTER.slice().sort(function (a, b) {
      if (a.team !== b.team) return a.team < b.team ? -1 : 1;
      if (a.points !== b.points) return b.points - a.points;
      return collator.compare(a.name, b.name);
    });

    const html = sorted.map(function (row, index) {
      return '<tr><td class="mono">' + (index + 1) + '</td>' +
        '<td>' + row.team + '</td>' +
        '<td class="mono">' + row.points + '</td>' +
        '<td>' + row.name + '</td></tr>';
    }).join('');

    root.jQuery('#sip-table tbody').html(html);
    root.jQuery('#sip-table-note').text('Team ascending, then points descending, then name by locale — one ' +
      'comparator with the tie-break chain written out, rather than three sorts relying on stability to carry ' +
      'the earlier ones. Note where the accented names land: `Ángel` sorts next to `ana` and `Émile` next to ' +
      'the other blue names, because Intl.Collator compares base letters. A raw `<` would put every accented ' +
      'character after `z`, since it compares UTF-16 code units and `Á` is U+00C1.');
  }

  function drawChart(ranked) {
    chart = root.ArrayView.compare(root.jQuery('#sip-chart')[0], {
      height: 240,
      rows: ranked.slice(0, 10).map(function (row) {
        return {
          label: row.label.replace(/\s*\(.*\)/, ''),
          comparisons: row.comparisons,
          moves: row.moves
        };
      }),
      summary: 'Comparisons and moves for the eligible sorts, on a log axis.'
    });

    root.jQuery('#sip-chart-note').text('Blue is comparisons, orange is moves, log axis. Two sorts with the ' +
      'same blue bar and very different orange ones are the same amount of thinking and a different amount of ' +
      'copying, which is the distinction that decides things when an element is a large object rather than an ' +
      'integer. LSD radix has no blue bar at all: it is not a comparison sort, and its cost is entirely in the ' +
      'orange column.');
  }

  root.SectionRegistry.register({ id: SECTION_ID, init: init });
}(window));
